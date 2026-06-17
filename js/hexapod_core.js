/**
 * 六足战车 CCD IK 动画核心模块 v0.58.0
 *
 * 纯计算层：不负责引用收集、身体位移决策、动画选择、UI。
 * 模型工厂和游戏通过薄适配器共享此模块。
 *
 * 依赖: window.THREE, window.HexapodConfig
 */
var HexapodCore = (function() {
  // lazy access: model_factory.html 中 window.THREE 由 deferred module 设置
  function T() { return window.THREE; }
  var CFG = window.HexapodConfig;

  // ── 工具函数 ──
  function _worldX(j) {
    var q = new (T()).Quaternion(); j.getWorldQuaternion(q);
    return new (T()).Vector3(1, 0, 0).applyQuaternion(q).normalize();
  }
  function _worldY(j) {
    var q = new (T()).Quaternion(); j.getWorldQuaternion(q);
    return new (T()).Vector3(0, 1, 0).applyQuaternion(q).normalize();
  }
  function _worldZ(j) {
    var q = new (T()).Quaternion(); j.getWorldQuaternion(q);
    return new (T()).Vector3(0, 0, 1).applyQuaternion(q).normalize();
  }
  function angleDiff(a, b) {
    var d = b - a;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return d;
  }
  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function _easeOut(t) { return 1 - Math.pow(1 - t, 3); }
  function _easeInOut(t) { return t < 0.5 ? 2*t*t : 1 - Math.pow(-2*t+2, 2)/2; }

  // ═══════════════════════════════════════════
  //  CCD IK 解算器 (单腿, 3关节)
  //  joint order: thigh.X → shin.X → hip.{Y|Z}
  //  踝关节锁死，不参与CCD
  // ═══════════════════════════════════════════
  function _ccdLeg(ctx, leg, targetWorld, iters, damp) {
    damp = damp || 0.5;
    var root = ctx.root;
    var hipJoint = leg.hipJoint;
    var thighPv = leg.thighPivot;
    var shinPv = leg.shinPivot;
    var anklePv = leg.anklePivot;

    // 踝锁死
    anklePv.rotation.x = leg.restAnkle;

    // hip axis accessor
    var hipGetRot, hipSetRot, hipWorldAxis;
    if (ctx.hipAxis === 'z') {
      hipGetRot = function() { return hipJoint.rotation.z; };
      hipSetRot = function(v) { hipJoint.rotation.z = v; };
      hipWorldAxis = _worldZ;
      leg._hipRestRot = leg.restHip;
      // restHip stored as Z rotation
    } else {
      // default 'y'
      hipGetRot = function() { return hipJoint.rotation.y; };
      hipSetRot = function(v) { hipJoint.rotation.y = v; };
      hipWorldAxis = _worldY;
      leg._hipRestRot = leg.restHip;
    }

    for (var iter = 0; iter < iters; iter++) {
      root.updateMatrixWorld(true);

      var tipW = leg.tipLocal.clone().applyMatrix4(anklePv.matrixWorld);
      var d, l;

      // 1. Thigh X (髋抬腿)
      var tW = new (T()).Vector3(); thighPv.getWorldPosition(tW);
      d = tipW.clone().sub(tW).normalize();
      var dt = targetWorld.clone().sub(tW).normalize();
      var ax = new (T()).Vector3().crossVectors(d, dt);
      l = ax.length();
      if (l > 0.0003) {
        ax.normalize();
        thighPv.rotation.x += Math.atan2(l, d.dot(dt)) * ax.dot(_worldX(thighPv)) * damp;
      }
      // 髋X限位: ±2.8rad (宽松限制, 防完全发散)
      if (thighPv.rotation.x > 2.8) thighPv.rotation.x = 2.8;
      else if (thighPv.rotation.x < -2.8) thighPv.rotation.x = -2.8;

      // 2. Shin X (膝)
      var sW = new (T()).Vector3(); shinPv.getWorldPosition(sW);
      root.updateMatrixWorld(true);
      tipW = leg.tipLocal.clone().applyMatrix4(anklePv.matrixWorld);
      d = tipW.clone().sub(sW).normalize();
      dt = targetWorld.clone().sub(sW).normalize();
      ax = new (T()).Vector3().crossVectors(d, dt);
      l = ax.length();
      if (l > 0.0003) {
        ax.normalize();
        shinPv.rotation.x += Math.atan2(l, d.dot(dt)) * ax.dot(_worldX(shinPv)) * damp;
      }
      // 膝关节防反曲
      if (leg._shinSign > 0) { if (shinPv.rotation.x < 0.05) shinPv.rotation.x = 0.05; }
      else                   { if (shinPv.rotation.x > -0.05) shinPv.rotation.x = -0.05; }

      // 3. Hip (水平摆角)
      var hW = new (T()).Vector3(); thighPv.getWorldPosition(hW);
      root.updateMatrixWorld(true);
      tipW = leg.tipLocal.clone().applyMatrix4(anklePv.matrixWorld);
      d = tipW.clone().sub(hW).normalize();
      dt = targetWorld.clone().sub(hW).normalize();
      ax = new (T()).Vector3().crossVectors(d, dt);
      l = ax.length();
      if (l > 0.0003) {
        ax.normalize();
        var newRot = hipGetRot() + Math.atan2(l, d.dot(dt)) * ax.dot(hipWorldAxis(hipJoint)) * damp;
        hipSetRot(newRot);
      }
      // 髋限位: 相对rest最多±yLimit rad
      var yLimit = leg._yLimit || 0.7;
      if (ctx._isPlayer) yLimit *= 1.35;  // 玩家放宽(0.45→0.61/0.7→0.95): 容纳转向髋补偿, 防#5腿飞
      var diff = hipGetRot() - (leg._hipRestRot || 0);
      while (diff > Math.PI) diff -= 2 * Math.PI;
      while (diff < -Math.PI) diff += 2 * Math.PI;
      if (diff > yLimit) { hipSetRot((leg._hipRestRot || 0) + yLimit); }
      else if (diff < -yLimit) { hipSetRot((leg._hipRestRot || 0) - yLimit); }
    }
  }

  // ═══════════════════════════════════════════
  //  _legHomePos: 脚在身体当前位置下的"家"位置（世界空间）
  // ═══════════════════════════════════════════
  function _legHomePos(ctx, leg) {
    var root = ctx.root;
    var worldHome = leg.homeOffset.clone().applyMatrix4(root.matrixWorld);
    if (ctx.groundHeightFn) {
      worldHome.y = ctx.groundHeightFn(worldHome.x, worldHome.z);
    } else {
      worldHome.y = leg._groundY;
    }
    return worldHome;
  }

  // ═══════════════════════════════════════════
  //  initContext: 一次性世界坐标采样
  //  legRefs = [{ prefix, tripodA, hipJoint, thighPivot, shinPivot, anklePivot,
  //               spikeMesh, restHip, restThigh, restShin, restAnkle,
  //               _shinSign, _yLimit }]
  //  opts = { hipAxis:'y'|'z', groundHeightFn, bodyWriter:bool }
  // ═══════════════════════════════════════════
  function initContext(legRefs, root, opts) {
    opts = opts || {};
    var ctx = {
      root: root,
      legs: [],
      hipAxis: opts.hipAxis || 'y',
      groundHeightFn: opts.groundHeightFn || null,
      bodyWriter: !!opts.bodyWriter,

      // 步态状态
      _gaitInit: false,
      _totalDist: 0,
      _gaitActive: false,
      _prevTotalDist: 0,
      _totalTime: 0,
      _curAnimIndex: 0,
      _prevBodyYaw: root.rotation.y,
      _prevBodyPos: root.position.clone(),
      _slowFrames: 0,

      // 踉跄 / 死亡
      _staggerActive: false,
      _staggerDone: false,
      _deathActive: false,
      _deathDone: false,
      staggerState: null,
      deathState: null,

      // 武器垂下枢轴 (死亡时创建)
      _weaponPivots: null
    };

    // 防御NaN（模型工厂偶发未初始化x/z）
    if (isNaN(root.position.x)) root.position.x = 0;
    if (isNaN(root.position.z)) root.position.z = 0;
    root.updateMatrixWorld(true);
    var rootWorldPos = new (T()).Vector3(); root.getWorldPosition(rootWorldPos);

    for (var li = 0; li < legRefs.length; li++) {
      var ref = legRefs[li];
      var hipJoint = ref.hipJoint;
      var thighPv = ref.thighPivot;
      var shinPv = ref.shinPivot;
      var anklePv = ref.anklePivot;
      var spikeMesh = ref.spikeMesh;

      // 锥尖在 anklePivot 本地空间中的位置
      root.updateMatrixWorld(true);
      var sb = new (T()).Box3().setFromObject(spikeMesh);
      var tipWorld = new (T()).Vector3(
        (sb.min.x + sb.max.x) / 2,
        sb.min.y,
        (sb.min.z + sb.max.z) / 2
      );
      var tipLocal = anklePv.worldToLocal(tipWorld.clone());

      // 脚到身体中心的 XZ 距离（固定值，防 CCD 误差漂移）
      root.updateMatrixWorld(true);
      var hw2 = new (T()).Vector3(); root.getWorldPosition(hw2);
      var tipW2 = tipLocal.clone().applyMatrix4(anklePv.matrixWorld);
      var initFootDist = Math.sqrt(
        (tipW2.x - hw2.x) * (tipW2.x - hw2.x) +
        (tipW2.z - hw2.z) * (tipW2.z - hw2.z)
      );

      // homeOffset: 休息姿态足端在本地方空间的偏移（相对定位）
      var homeOffset = root.worldToLocal(tipW2.clone());

      var leg = {
        prefix: ref.prefix,
        tripodA: !!ref.tripodA,
        hipJoint: hipJoint,
        thighPivot: thighPv,
        shinPivot: shinPv,
        anklePivot: anklePv,
        spikeMesh: spikeMesh,

        restHip: ref.restHip,
        restThigh: ref.restThigh,
        restShin: ref.restShin,
        restAnkle: ref.restAnkle,

        tipLocal: tipLocal,
        homeOffset: homeOffset,
        _initFootDist: initFootDist,
        _shinSign: ref._shinSign,
        _yLimit: ref._yLimit,
        _groundY: tipW2.y,

        // 步态状态
        plantPos: null,
        swingFrom: null,
        swingTo: null,
        _wasStance: undefined,
        _stanceTarget: null
      };
      ctx.legs.push(leg);
    }

    // ── 身体休息姿态 ──
    ctx.restPosX = root.position.x;
    ctx.restPosY = root.position.y;
    ctx.restPosZ = root.position.z;
    ctx.restRotY = root.rotation.y;
    ctx._baseY = root.userData._baseY || 0;

    // ── 自动抬升 ──
    root.updateMatrixWorld(true);
    var lowestTipY = Infinity;
    for (var li2 = 0; li2 < ctx.legs.length; li2++) {
      var l2 = ctx.legs[li2];
      var tw3 = l2.tipLocal.clone().applyMatrix4(l2.anklePivot.matrixWorld);
      if (tw3.y < lowestTipY) lowestTipY = tw3.y;
    }
    if (lowestTipY < 0) {
      root.position.y += (-lowestTipY);
    }
    // 抬升后重新捕获 homeOffset / _groundY（否则 stepIdle 用旧值导致 CCD 拉腿到极端位置）
    root.updateMatrixWorld(true);
    for (var li3 = 0; li3 < ctx.legs.length; li3++) {
      var l3 = ctx.legs[li3];
      var tw4 = l3.tipLocal.clone().applyMatrix4(l3.anklePivot.matrixWorld);
      l3._groundY = tw4.y;
      l3.homeOffset = root.worldToLocal(tw4.clone());
    }
    ctx.restPosY = root.position.y;

    // 若有 terrain，计算 _baseY
    if (ctx.groundHeightFn) {
      var hwPos = new (T()).Vector3(); root.getWorldPosition(hwPos);
      ctx._baseY = root.position.y - ctx.groundHeightFn(hwPos.x, hwPos.z);
    }

    root.userData._hexCoreCtx = ctx;
    return ctx;
  }

  // ═══════════════════════════════════════════
  //  步态初始化
  // ═══════════════════════════════════════════
  function _initGait(ctx) {
    ctx.root.updateMatrixWorld(true);
    for (var li = 0; li < ctx.legs.length; li++) {
      var leg = ctx.legs[li];
      var tipW = leg.tipLocal.clone().applyMatrix4(leg.anklePivot.matrixWorld);
      leg.plantPos = tipW.clone();
      leg._groundY = tipW.y;
      leg.swingFrom = null; leg.swingTo = null;
      leg._stanceTarget = null;
    }
    ctx._prevTotalDist = 0;
    ctx._totalDist = 0;
    ctx._gaitInit = true;
  }

  // ═══════════════════════════════════════════
  //  stepGait: 三角步态更新
  //  params = { animIndex, bodySpeed, turnRate, spinRPS, desiredMove: {dx, dz} }
  //  desiredMove: 游戏模式下外部期望的身体位移（在步态目标计算后、CCD前应用）
  // ═══════════════════════════════════════════
  function stepGait(ctx, dt, params) {
    params = params || {};
    var animIndex = params.animIndex || 0;
    var cfg = CFG;
    var dir = cfg.animField(animIndex, 2);
    var cfgTurnRate = cfg.animField(animIndex, 3);
    var stride = cfg.animField(animIndex, 4);
    var stepH = cfg.animField(animIndex, 5);
    var root = ctx.root;

    // ── 身体速度检测 (bodyWriter=false 时从root位置读取) ──
    var bodySpeedNow = params.bodySpeed || 0;
    var actualTurnRate = 0;
    if (ctx._isPlayer) {
      // 步进式转向(用户方案): 每步态周期采样目标转向量→单步转角→整周期恒定执行。
      // 身体由步态驱动转向(腿蹬地+预伸), 非每帧跟视角。鼠标停/反向: 当前步走完下步才响应。
      var STEP_PERIOD = 0.32;   // 转向步态周期(s)
      var MAX_STEP = 0.5;       // 单步最大转角(rad, ~28°)
      var IDLE_THR = 0.02;      // 剩余角差<此值不转(防抖); 减小让转向更接近视角精确到位
      if (ctx._stepTimer === undefined) { ctx._stepTimer = 0; ctx._stepTurn = 0; }
      ctx._stepTimer += dt;
      if (ctx._stepTimer >= STEP_PERIOD) {
        ctx._stepTimer -= STEP_PERIOD;
        var _remain = (params.targetYaw !== undefined && !isNaN(params.targetYaw))
          ? angleDiff(root.rotation.y, params.targetYaw) : 0;
        ctx._stepTurn = (Math.abs(_remain) > IDLE_THR) ? clamp(_remain, -MAX_STEP, MAX_STEP) : 0;
      }
      actualTurnRate = (ctx._stepTurn || 0) / STEP_PERIOD;  // 本步恒定角速度
    } else if (!ctx.bodyWriter && params.bodySpeed === undefined) {
      var bdv = new (T()).Vector3().subVectors(root.position, ctx._prevBodyPos);
      bdv.y = 0;
      bodySpeedNow = bdv.length() / Math.max(dt, 0.001);
      actualTurnRate = angleDiff(ctx._prevBodyYaw, root.rotation.y) / Math.max(dt, 0.001);
    }
    var turnRate = ctx._isPlayer
      ? actualTurnRate
      : ((cfgTurnRate !== 0) ? cfgTurnRate
        : (Math.abs(actualTurnRate) > 0.05 ? actualTurnRate : 0));

    // ── 步态周期 ──
    var gaitPeriod;
    if (ctx._isPlayer && Math.abs(turnRate) > 0.05) {
      // 玩家转向: 固定步态周期0.32(步进式), 单步转角已clamp≤0.5, 半周期髋补偿≤0.25<限位0.61
      gaitPeriod = 0.32;
    } else if (Math.abs(turnRate) > 1.0) {
      gaitPeriod = clamp(1.05 / Math.abs(turnRate), 0.4, 0.8);
    } else if (Math.abs(turnRate) > 0.05) {
      gaitPeriod = 0.72;
    } else if (!ctx.bodyWriter && bodySpeedNow > 0.3) {
      // 游戏模式: 步频自适应 bodySpeed, 保持动态步幅≈设计步幅
      // 公式: period = 2*stride/bodySpeed, 使每周期移动距离=2*stride
      gaitPeriod = clamp(2.0 * Math.max(stride, 0.10) / Math.max(bodySpeedNow, 0.1), 0.22, 0.8);
    } else if (bodySpeedNow > 1.5) {
      gaitPeriod = clamp(2.0 / bodySpeedNow, 0.3, 0.7);
    } else {
      gaitPeriod = stride > 0.30 ? 0.38 : 0.7;
    }

    // 动态步幅（按 AI 速度自适应，但不超过腿长 70% 防止够不到）
    var avgReach = 0;
    for (var liR = 0; liR < ctx.legs.length; liR++) avgReach += ctx.legs[liR]._initFootDist;
    avgReach /= Math.max(ctx.legs.length, 1);
    var dynamicStride = Math.max(stride, bodySpeedNow * gaitPeriod * 0.5);
    dynamicStride = Math.min(dynamicStride, avgReach * 0.7);

    // CCD参数
    var ccdIters;
    if (Math.abs(turnRate) > 1.0) {
      ccdIters = 20 + Math.round(Math.abs(turnRate) * 13);
    } else if (Math.abs(turnRate) > 0.05) {
      ccdIters = 20 + Math.round(Math.abs(turnRate) * 8);
    } else if (stride > 0.30) {
      ccdIters = 30;
    } else {
      ccdIters = 15;
    }
    var damp = (Math.abs(turnRate) > 0.05) ? 0.8 : 0.5;

    // ── 累计时间+距离 ──
    if (ctx._totalTime === undefined) ctx._totalTime = 0;
    ctx._totalTime += dt;
    var totalT = ctx._totalTime;
    var gaitCycles = totalT / gaitPeriod;

    // 全局距离累计 (供动画切换检测)
    ctx._totalDist = (ctx._totalDist || 0) + bodySpeedNow * dt + Math.abs(turnRate) * dt * 0.7;
    var bodyBob = Math.sin(gaitCycles * Math.PI * 2) * 0.03;

    // ── 身体旋转 (bodyWriter 或 玩家步进式 都由步态驱动写) ──
    var isStaticTurn = (animIndex === 7 || animIndex === 8);
    if (ctx.bodyWriter || ctx._isPlayer) {
      root.rotation.y += turnRate * dt;   // 玩家: 步进式驱动身体转向(腿蹬地转, 非每帧跟视角)
    }

    // 前进方向
    var fwdBody;
    if (dir === 2 || dir === -2) {
      fwdBody = new (T()).Vector3(0, 0, dir / 2);
    } else {
      fwdBody = new (T()).Vector3(-1 * dir, 0, 0);
    }
    root.localToWorld(fwdBody);
    var hw = new (T()).Vector3(); root.getWorldPosition(hw);
    fwdBody.sub(hw).normalize();
    // 玩家模式: fwdBody 改用真实移动方向(连续, 支持8方位/斜向/手柄360°), 不用 animIndex 离散dir
    if (ctx._isPlayer && params.desiredMove) {
      var _dmn = Math.sqrt(params.desiredMove.dx * params.desiredMove.dx + params.desiredMove.dz * params.desiredMove.dz);
      if (_dmn > 0.001) fwdBody.set(params.desiredMove.dx / _dmn, 0, params.desiredMove.dz / _dmn);
    }

    // ── 身体平移 ──
    var totalDist = gaitCycles * dynamicStride * 2;
    var deltaDist = totalDist - (ctx._prevTotalDist || 0);
    ctx._prevTotalDist = totalDist;
    ctx.bodyDelta = { dx: 0, dz: 0, dyaw: turnRate * dt };
    if (ctx.bodyWriter) {
      if (!isStaticTurn) {
        root.position.x += fwdBody.x * deltaDist;
        root.position.z += fwdBody.z * deltaDist;
      }
      ctx.bodyDelta.dx = fwdBody.x * deltaDist;
      ctx.bodyDelta.dz = fwdBody.z * deltaDist;
    } else if (params.desiredMove) {
      // 游戏模式: AI驱动位移, 在此处应用使步态目标计算时身体已在新位置
      root.position.x += params.desiredMove.dx || 0;
      root.position.z += params.desiredMove.dz || 0;
      ctx.bodyDelta.dx = params.desiredMove.dx || 0;
      ctx.bodyDelta.dz = params.desiredMove.dz || 0;
    }

    // ── 地形适应 / 身体高度 ──
    if (ctx.groundHeightFn) {
      var hwPos = new (T()).Vector3(); root.getWorldPosition(hwPos);
      root.position.y = ctx.groundHeightFn(hwPos.x, hwPos.z) + (ctx._baseY || 0);
      // 地形俯仰侧倾
      if (!root.rotation.order || root.rotation.order !== 'YXZ') {
        root.rotation.order = 'YXZ';
      }
      var hYaw = root.rotation.y;
      var hFwdX = -Math.cos(hYaw), hFwdZ = Math.sin(hYaw);
      var hRgtX = -Math.cos(hYaw + Math.PI/2), hRgtZ = Math.sin(hYaw + Math.PI/2);
      var sD = 1.2;
      var fhT = ctx.groundHeightFn(hwPos.x + hFwdX * sD, hwPos.z + hFwdZ * sD);
      var bhT = ctx.groundHeightFn(hwPos.x - hFwdX * sD, hwPos.z - hFwdZ * sD);
      root.rotation.x = -Math.atan2(fhT - bhT, sD * 2);
      var lhT = ctx.groundHeightFn(hwPos.x - hRgtX * sD, hwPos.z - hRgtZ * sD);
      var rhT = ctx.groundHeightFn(hwPos.x + hRgtX * sD, hwPos.z + hRgtZ * sD);
      root.rotation.z = -Math.atan2(rhT - lhT, sD * 2);
    } else if (ctx.bodyWriter) {
      root.position.y = ctx.restPosY - (isStaticTurn ? 0 : bodyBob);
    }
    root.updateMatrixWorld(true);

    // ── 逐腿步态 ──
    for (var li = 0; li < ctx.legs.length; li++) {
      var leg = ctx.legs[li];
      var phaseOffset = leg.tripodA ? 0 : 0.5;
      var gaitT = (gaitCycles + phaseOffset) % 1;
      var inStance = (gaitT < 0.5);
      var stanceFrac = inStance ? gaitT * 2 : (gaitT - 0.5) * 2;

      if (inStance) {
        // 支撑相: 脚锁定
        if (!leg._wasStance) {
          if (ctx.bodyWriter) {
            // 模型工厂模式: plantPos 世界绝对锁定
            root.updateMatrixWorld(true);
            leg.plantPos = leg.tipLocal.clone().applyMatrix4(leg.anklePivot.matrixWorld);
          } else if (ctx._isPlayer) {
            // 玩家模式: 钉脚实际落地位置 (对齐工厂 plantPos; 配合 bodySpeed修复, dynamicStride对称不失同步)
            root.updateMatrixWorld(true);
            leg._stanceTarget = leg.tipLocal.clone().applyMatrix4(leg.anklePivot.matrixWorld);
          } else {
            // 敌人模式: homeOffset 相对定位 (绕圈变速需要此补偿防失同步)
            leg._stanceTarget = _legHomePos(ctx, leg);
          }
        }
        var stanceTarget = ctx.bodyWriter ? leg.plantPos : leg._stanceTarget;
        _ccdLeg(ctx, leg, stanceTarget, ccdIters, damp);
      } else {
        // 摆动相: 从 plantPos/stanceTarget 摆向新的落地位置
        if (leg._wasStance) {
          leg.swingFrom = ctx.bodyWriter ? leg.plantPos.clone() : (leg._stanceTarget ? leg._stanceTarget.clone() : _legHomePos(ctx, leg));
          if (ctx._isPlayer) {
            // 玩家摆动闭环: 身体标准立足 + 速度前瞻 + 步进转向圆弧预伸
            // (#6: homeW闭环每周期重置无漂移; 步进turnRate整周期恒定, 圆弧让腿往转向反向预伸准备蹬地)
            var phomeW = _legHomePos(ctx, leg);
            var phalfP = gaitPeriod * 0.5;
            var pvx = params.desiredMove ? (params.desiredMove.dx || 0) / Math.max(dt, 0.001) : 0;
            var pvz = params.desiredMove ? (params.desiredMove.dz || 0) / Math.max(dt, 0.001) : 0;
            leg.swingTo = phomeW.clone();
            leg.swingTo.x += pvx * phalfP;
            leg.swingTo.z += pvz * phalfP;
            if (Math.abs(turnRate) > 0.05) {
              // 圆弧预伸: 摆动腿往转向反向伸(蹬地准备), 步进turnRate整周期恒定
              var pbc = new (T()).Vector3(); root.getWorldPosition(pbc);
              var ptf = leg.swingTo.clone().sub(pbc); ptf.y = 0;
              var pna = Math.atan2(ptf.z, ptf.x) - turnRate * gaitPeriod;
              var pfd = leg._initFootDist || ptf.length() || 1;
              leg.swingTo.x = pbc.x + Math.cos(pna) * pfd + pvx * phalfP;
              leg.swingTo.z = pbc.z + Math.sin(pna) * pfd + pvz * phalfP;
            }
            leg.swingTo.y = ctx.groundHeightFn ? ctx.groundHeightFn(leg.swingTo.x, leg.swingTo.z) : leg._groundY;
          } else if (turnRate !== 0) {
            var bodyC = new (T()).Vector3(); root.getWorldPosition(bodyC);
            var toFoot = leg.swingFrom.clone().sub(bodyC); toFoot.y = 0;
            var footAngle = Math.atan2(toFoot.z, toFoot.x);
            var newAngle = footAngle - turnRate * gaitPeriod;
            var footDist = leg._initFootDist || (toFoot.length() || 1);
            leg.swingTo = bodyC.clone();
            leg.swingTo.x += Math.cos(newAngle) * footDist;
            leg.swingTo.z += Math.sin(newAngle) * footDist;
            leg.swingTo.y = ctx.groundHeightFn
              ? ctx.groundHeightFn(leg.swingTo.x, leg.swingTo.z)
              : leg._groundY;
            if (!isStaticTurn) {
              leg.swingTo.x += fwdBody.x * dynamicStride * 2;
              leg.swingTo.z += fwdBody.z * dynamicStride * 2;
            }
          } else {
            leg.swingTo = leg.swingFrom.clone();
            leg.swingTo.x += fwdBody.x * dynamicStride * 2;
            leg.swingTo.z += fwdBody.z * dynamicStride * 2;
          }
        }
        // 首次入摆动相防护
        if (!leg.swingFrom || !leg.swingTo) {
          root.updateMatrixWorld(true);
          leg.plantPos = leg.tipLocal.clone().applyMatrix4(leg.anklePivot.matrixWorld);
          leg.swingFrom = leg.plantPos.clone();
          if (ctx._isPlayer) {
            // 玩家首次入摆动防护: 闭环 (homeW+速度前瞻+步进圆弧)
            var fhomeW = _legHomePos(ctx, leg);
            var fhalfP = gaitPeriod * 0.5;
            var fvx = params.desiredMove ? (params.desiredMove.dx || 0) / Math.max(dt, 0.001) : 0;
            var fvz = params.desiredMove ? (params.desiredMove.dz || 0) / Math.max(dt, 0.001) : 0;
            leg.swingTo = fhomeW.clone();
            leg.swingTo.x += fvx * fhalfP;
            leg.swingTo.z += fvz * fhalfP;
            if (Math.abs(turnRate) > 0.05) {
              var fbc = new (T()).Vector3(); root.getWorldPosition(fbc);
              var ftf = leg.swingTo.clone().sub(fbc); ftf.y = 0;
              var fna = Math.atan2(ftf.z, ftf.x) - turnRate * gaitPeriod;
              var ffd = leg._initFootDist || ftf.length() || 1;
              leg.swingTo.x = fbc.x + Math.cos(fna) * ffd + fvx * fhalfP;
              leg.swingTo.z = fbc.z + Math.sin(fna) * ffd + fvz * fhalfP;
            }
            leg.swingTo.y = ctx.groundHeightFn ? ctx.groundHeightFn(leg.swingTo.x, leg.swingTo.z) : leg._groundY;
          } else if (turnRate !== 0) {
            var bodyC2 = new (T()).Vector3(); root.getWorldPosition(bodyC2);
            var tf2 = leg.plantPos.clone().sub(bodyC2); tf2.y = 0;
            var fa2 = Math.atan2(tf2.z, tf2.x);
            var fd2 = leg._initFootDist || (tf2.length() || 1);
            leg.swingTo = bodyC2.clone();
            leg.swingTo.x += Math.cos(fa2 - turnRate * gaitPeriod) * fd2;
            leg.swingTo.z += Math.sin(fa2 - turnRate * gaitPeriod) * fd2;
            leg.swingTo.y = leg._groundY;
          } else {
            leg.swingTo = leg.plantPos.clone();
            leg.swingTo.x += fwdBody.x * dynamicStride * 2;
            leg.swingTo.z += fwdBody.z * dynamicStride * 2;
          }
        }
        var target = new (T()).Vector3().lerpVectors(leg.swingFrom, leg.swingTo, stanceFrac);
        target.y += Math.sin(stanceFrac * Math.PI) * stepH;
        // 摆向末段确保不低于地面
        if (stanceFrac > 0.7) {
          var gY = ctx.groundHeightFn
            ? ctx.groundHeightFn(target.x, target.z)
            : leg._groundY;
          if (target.y < gY) target.y = gY + 0.03;
        }
        _ccdLeg(ctx, leg, target, ccdIters, damp);
      }
      leg._wasStance = inStance;

      // ── 测量探针 (仅左前腿, 只读) ──
      if (leg.prefix === '左前' && typeof window.__hexProbeSample === 'function') {
        window.__hexProbeSample(ctx, {
          totalTime: totalT, animIndex: animIndex, gaitT: gaitT, inStance: inStance,
          gaitPeriod: gaitPeriod, dynamicStride: dynamicStride,
          bodySpeedNow: bodySpeedNow, turnRate: turnRate
        });
      }
    }

    // 保存位置用于下一帧速度估算
    ctx._prevBodyYaw = root.rotation.y;
    ctx._prevBodyPos.copy(root.position);
  }

  // ═══════════════════════════════════════════
  //  stepIdle: 待机姿态
  // ═══════════════════════════════════════════
  function stepIdle(ctx, dt, t) {
    t = t || 0;
    var root = ctx.root;
    ctx._gaitInit = false;
    ctx._totalTime = 0;

    if (isNaN(root.position.x)) root.position.x = 0;
    if (isNaN(root.position.z)) root.position.z = 0;

    if (ctx.bodyWriter) {
      var bodyBob = (1 - Math.cos(t * Math.PI * 2)) / 2 * 0.08;
      root.position.y = ctx.restPosY - bodyBob;
    } else if (ctx.groundHeightFn) {
      var hwPos = new (T()).Vector3(); root.getWorldPosition(hwPos);
      root.position.y = ctx.groundHeightFn(hwPos.x, hwPos.z) + (ctx._baseY || 0);
    }
    root.updateMatrixWorld(true);

    for (var li = 0; li < ctx.legs.length; li++) {
      var leg = ctx.legs[li];
      var homePos = _legHomePos(ctx, leg);
      _ccdLeg(ctx, leg, homePos, 15, 0.5);
    }

    if (isNaN(root.position.x)) root.position.x = 0;
    if (isNaN(root.position.z)) root.position.z = 0;
    ctx._prevBodyYaw = root.rotation.y;
    ctx._prevBodyPos.copy(root.position);
  }

  // ═══════════════════════════════════════════
  //  重置姿态（切动画时调用）
  // ═══════════════════════════════════════════
  function resetPose(ctx) {
    ctx._gaitInit = false;
    ctx._prevTotalDist = 0;
    ctx._totalTime = 0;
    // 防御NaN
    if (isNaN(ctx.root.position.x)) ctx.root.position.x = 0;
    if (isNaN(ctx.root.position.z)) ctx.root.position.z = 0;
    for (var li = 0; li < ctx.legs.length; li++) {
      var leg = ctx.legs[li];
      leg.thighPivot.rotation.x = leg.restThigh;
      leg.shinPivot.rotation.x = leg.restShin;
      leg.anklePivot.rotation.x = leg.restAnkle;
      if (ctx.hipAxis === 'z') {
        leg.hipJoint.rotation.z = leg.restHip;
      } else {
        leg.hipJoint.rotation.y = leg.restHip;
      }
      leg.plantPos = null; leg.swingFrom = null; leg.swingTo = null;
      leg._wasStance = undefined; leg._stanceTarget = null;
    }
    ctx._staggerDone = false;
    ctx._deathDone = false;
    ctx._stepTimer = 0; ctx._stepTurn = 0;   // 玩家步进转向状态重置(切动画/复活)
    ctx.root.updateMatrixWorld(true);
  }

  // ═══════════════════════════════════════════
  //  triggerStagger: 受击踉跄
  // ═══════════════════════════════════════════
  function triggerStagger(ctx, hitWorldDir, force) {
    if (!ctx || !ctx.legs.length) return;
    force = Math.max(0.15, Math.min(1, force || 0.5));
    var dirWorld = new (T()).Vector3(hitWorldDir.x, 0, hitWorldDir.z);
    if (dirWorld.length() < 0.01) dirWorld.set(0, 0, 1);
    dirWorld.normalize();

    var root = ctx.root;
    root.updateMatrixWorld(true);
    var hp = new (T()).Vector3(); root.getWorldPosition(hp);

    // 转本地方向，判断哪些腿在受击对面
    var localEnd = root.worldToLocal(hp.clone().add(dirWorld));
    var lx = localEnd.x, lz = localEnd.z;

    // 保存所有脚当前位置
    var plants = [];
    for (var li = 0; li < ctx.legs.length; li++) {
      var l = ctx.legs[li];
      plants.push(l.tipLocal.clone().applyMatrix4(l.anklePivot.matrixWorld));
    }

    // 按腿位置打分，选受击反向侧2~3条腿跺地
    var scores = [];
    for (var li2 = 0; li2 < ctx.legs.length; li2++) {
      var pf = ctx.legs[li2].prefix;
      var sc = 0;
      if (pf.indexOf('前') >= 0) sc -= lx;
      if (pf.indexOf('后') >= 0) sc += lx;
      if (pf.indexOf('左') >= 0) sc -= lz;
      if (pf.indexOf('右') >= 0) sc += lz;
      scores.push({ i: li2, s: sc });
    }
    scores.sort(function(a, b) { return b.s - a.s; });
    var stompIdx = [scores[0].i, scores[1].i];
    if (ctx.legs.length >= 6 && Math.random() < 0.4) stompIdx.push(scores[2].i);

    var push = 0.22 * force;
    ctx.staggerState = {
      t0: performance.now() / 1000,
      force: force, dir: dirWorld,
      tImp: 0.12, tStag: 0.35, tRec: 0.50,
      pushX: dirWorld.x * push, pushZ: dirWorld.z * push,
      tiltX: dirWorld.z * 0.10 * force, tiltZ: -dirWorld.x * 0.10 * force,
      plants: plants,
      stompIdx: stompIdx, stompTargets: {}, stompFired: false,
      bodyStart: hp.clone()
    };
    ctx._gaitActive = false;
    ctx._staggerActive = true;
  }

  function _staggerUpdate(ctx, dt) {
    if (!ctx.staggerState) return;
    var s = ctx.staggerState;
    var elapsed = performance.now() / 1000 - s.t0;
    var total = s.tImp + s.tStag + s.tRec;
    if (elapsed >= total) { _staggerEnd(ctx); return; }

    var root = ctx.root;
    var inImp = elapsed < s.tImp;
    var inStag = elapsed >= s.tImp && elapsed < s.tImp + s.tStag;
    var inRec = elapsed >= s.tImp + s.tStag;

    // 身体位移
    var bFrac;
    if (inImp) bFrac = _easeOut(elapsed / s.tImp);
    else if (inStag) bFrac = 1 + 0.08 * Math.sin((elapsed - s.tImp) / s.tStag * Math.PI * 3);
    else bFrac = 1 - _easeInOut((elapsed - s.tImp - s.tStag) / s.tRec);
    root.position.x = s.bodyStart.x + s.pushX * bFrac;
    root.position.z = s.bodyStart.z + s.pushZ * bFrac;

    // 身体倾斜
    var tFrac = inImp ? _easeOut(elapsed / s.tImp) : inStag ? 1 : 1 - _easeInOut((elapsed - s.tImp - s.tStag) / s.tRec);
    root.rotation.x = s.tiltX * tFrac;
    root.rotation.z = s.tiltZ * tFrac;
    root.updateMatrixWorld(true);

    // 跺脚触发
    if (inStag && !s.stompFired) {
      for (var si = 0; si < s.stompIdx.length; si++) {
        var liIdx = s.stompIdx[si];
        s.stompTargets[liIdx] = {
          from: s.plants[liIdx].clone(),
          to: s.plants[liIdx].clone().add(new (T()).Vector3(-s.dir.x * 0.1 * s.force, 0.04, -s.dir.z * 0.1 * s.force))
        };
      }
      s.stompFired = true;
    }

    // 逐腿CCD
    for (var li3 = 0; li3 < ctx.legs.length; li3++) {
      var leg = ctx.legs[li3];
      var tgt;
      if (s.stompTargets[li3]) {
        var st = s.stompTargets[li3];
        var frac = Math.min(1, (elapsed - s.tImp) / (s.tStag * 0.35));
        tgt = new (T()).Vector3().lerpVectors(st.from, st.to, _easeOut(frac));
        tgt.y += Math.sin(Math.min(frac, 1) * Math.PI) * 0.07;
      } else {
        tgt = s.plants[li3];
      }
      _ccdLeg(ctx, leg, tgt, 25, 0.7);
    }
  }

  function _staggerEnd(ctx) {
    ctx.staggerState = null;
    ctx._staggerActive = false;
    ctx._staggerDone = true;
    if (ctx.root && ctx.bodyWriter) {
      ctx.root.rotation.set(0, ctx.restRotY || 0, 0);
    }
    resetPose(ctx);
  }

  // ═══════════════════════════════════════════
  //  triggerDeath: 死亡瘫倒
  // ═══════════════════════════════════════════
  function triggerDeath(ctx, weaponRefs) {
    if (!ctx || !ctx.legs.length) return;
    var root = ctx.root;
    root.updateMatrixWorld(true);
    var restY = root.position.y;
    var restX = root.position.x;
    var restZ = root.position.z;
    var bodyC = new (T()).Vector3(); root.getWorldPosition(bodyC);

    // 地面高度
    var groundY = restY;
    var startPlants = [];
    for (var li = 0; li < ctx.legs.length; li++) {
      var l = ctx.legs[li];
      var tw = l.tipLocal.clone().applyMatrix4(l.anklePivot.matrixWorld);
      startPlants.push(tw.clone());
      if (tw.y < groundY) groundY = tw.y;
    }
    var bellyY = groundY + 0.14;

    // 死亡瘫姿
    var splayPresets = CFG.DEATH_SPLAY_PRESETS || [];
    var deathTargets = [];
    for (var li2 = 0; li2 < ctx.legs.length; li2++) {
      var fromB = startPlants[li2].clone().sub(bodyC); fromB.y = 0;
      var baseAngle = Math.atan2(fromB.z, fromB.x);
      var baseDist = fromB.length() || 0.5;
      var sp = (li2 < splayPresets.length) ? splayPresets[li2] : { mul: 1.2, ao: 0 };
      var dd = baseDist * sp.mul;
      var da = sp.ao + (Math.random() - 0.5) * 0.12;
      var dAngle = baseAngle + da;
      var dt2 = bodyC.clone();
      dt2.x += Math.cos(dAngle) * dd;
      dt2.z += Math.sin(dAngle) * dd;
      dt2.y = groundY;
      deathTargets.push(dt2);
    }

    // 昂首阶段：前腿撑地
    var rearTargets = [];
    for (var li3 = 0; li3 < ctx.legs.length; li3++) {
      var pf2 = ctx.legs[li3].prefix;
      var p = startPlants[li3].clone();
      if (pf2 && pf2.indexOf('前') >= 0) {
        var toBody = bodyC.clone().sub(p); toBody.y = 0;
        toBody.normalize().multiplyScalar(0.06);
        p.add(toBody);
      }
      p.y = groundY;
      rearTargets.push(p);
    }

    ctx.deathState = {
      t0: performance.now() / 1000,
      tRearUp: 0.22, tApex: 0.10, tCollapse: 0.7, tSettle: 0.5,
      restY: restY, restX: restX, restZ: restZ,
      bellyY: bellyY, groundY: groundY,
      peakY: restY + 0.12,
      startPlants: startPlants,
      rearTargets: rearTargets,
      deathTargets: deathTargets
    };

    // 武器垂下枢轴
    if (weaponRefs && weaponRefs.length) {
      ctx.deathState.weaponPivots = _createWeaponPivots(ctx, weaponRefs);
    } else {
      ctx.deathState.weaponPivots = null;
    }

    ctx._gaitActive = false;
    ctx._deathActive = true;
  }

  function _createWeaponPivots(ctx, weaponRefs) {
    var root = ctx.root;
    var pivots = [];
    for (var wi = 0; wi < weaponRefs.length; wi++) {
      var wr = weaponRefs[wi];
      var wg = wr.weaponGroup, mount = wr.mount;
      if (!wg || !mount) continue;
      var gp = wg.parent;
      var mountLocal = mount.position.clone();
      var origMatrix = wg.matrix.clone();

      var mwp = new (T()).Vector3(); mount.getWorldPosition(mwp);
      var gpWorldPos = new (T()).Vector3(); gp.getWorldPosition(gpWorldPos);
      var gpWorldQuat = new (T()).Quaternion(); gp.getWorldQuaternion(gpWorldQuat);
      var mountInGP = mwp.clone().sub(gpWorldPos).applyQuaternion(gpWorldQuat.clone().invert());

      var wq = new (T()).Quaternion(); wg.getWorldQuaternion(wq);
      var lzWorld = new (T()).Vector3(0, 0, 1).applyQuaternion(wq).normalize();
      var lzInGP = lzWorld.clone().applyQuaternion(gpWorldQuat.clone().invert()).normalize();

      var pivot = new (T()).Group();
      pivot.name = '_death_wp_' + wi;
      gp.remove(wg);
      gp.add(pivot);
      pivot.position.copy(mountInGP);
      pivot.rotation.set(0, 0, 0);
      pivot.add(wg);
      wg.position.copy(mountLocal).multiplyScalar(-1);
      gp.updateMatrixWorld(true);

      pivots.push({
        pivot: pivot, weaponGroup: wg, grandParent: gp,
        origMatrix: origMatrix, lz: lzInGP,
        isGatling: wr.isGatling
      });
    }
    return pivots;
  }

  function _cleanupWeaponPivots(ctx) {
    if (!ctx.deathState || !ctx.deathState.weaponPivots) return;
    var pivots = ctx.deathState.weaponPivots;
    for (var pi = 0; pi < pivots.length; pi++) {
      var pv = pivots[pi];
      pv.pivot.remove(pv.weaponGroup);
      pv.grandParent.add(pv.weaponGroup);
      pv.weaponGroup.matrix.copy(pv.origMatrix);
      pv.weaponGroup.matrix.decompose(pv.weaponGroup.position, pv.weaponGroup.quaternion, pv.weaponGroup.scale);
      pv.grandParent.remove(pv.pivot);
    }
    ctx.deathState.weaponPivots = null;
  }

  function _deathUpdate(ctx, dt) {
    if (!ctx.deathState) return;
    var ds = ctx.deathState;
    var elapsed = performance.now() / 1000 - ds.t0;
    var tRear = ds.tRearUp, tApex = ds.tApex;
    var tPhase2 = tRear + tApex;
    var tPhase3 = tPhase2 + ds.tCollapse;
    var total = tPhase3 + ds.tSettle;
    if (elapsed >= total) { _deathEnd(ctx); return; }

    var root = ctx.root;

    var phase = elapsed < tRear ? 0
              : elapsed < tPhase2 ? 1
              : elapsed < tPhase3 ? 2
              : 3;

    // 身体Y
    if (phase === 0) {
      var rf = _easeOut(elapsed / tRear);
      root.position.y = ds.restY + (ds.peakY - ds.restY) * rf;
    } else if (phase === 1) {
      root.position.y = ds.peakY;
    } else if (phase === 2) {
      var cf = _easeInOut((elapsed - tPhase2) / ds.tCollapse);
      root.position.y = ds.peakY + (ds.bellyY - ds.peakY) * cf;
    } else {
      root.position.y = ds.bellyY;
    }
    root.position.x = ds.restX; root.position.z = ds.restZ;

    // 身体倾斜
    if (phase === 0) {
      root.rotation.x = -0.10 * _easeOut(elapsed / tRear);
      root.rotation.z = 0;
    } else if (phase === 1) {
      root.rotation.x = -0.10;
      root.rotation.z = 0;
    } else if (phase === 2) {
      var cf2 = _easeInOut((elapsed - tPhase2) / ds.tCollapse);
      root.rotation.x = -0.10 + 0.22 * cf2;
      root.rotation.z = 0.07 * cf2;
    } else {
      root.rotation.x = 0.12;
      root.rotation.z = 0.07;
    }
    root.updateMatrixWorld(true);

    // damp
    var damp;
    if (phase <= 1) damp = 0.85;
    else if (phase === 2) damp = 0.85 - 0.82 * Math.min(1, (elapsed - tPhase2) / ds.tCollapse);
    else damp = 0.03;

    // 腿靶点
    for (var li = 0; li < ctx.legs.length; li++) {
      var leg = ctx.legs[li];
      var tgt;
      if (phase <= 1) {
        tgt = ds.rearTargets[li];
      } else if (phase === 2) {
        var cf3 = _easeInOut((elapsed - tPhase2) / ds.tCollapse);
        tgt = new (T()).Vector3().lerpVectors(ds.rearTargets[li], ds.deathTargets[li], cf3);
      } else {
        tgt = ds.deathTargets[li];
      }
      _ccdLeg(ctx, leg, tgt, phase >= 3 ? 10 : 20, damp);
    }

    // 武器垂下
    if (ds.weaponPivots && ds.weaponPivots.length) {
      var droopFrac;
      if (phase <= 1) {
        droopFrac = -0.25;
      } else if (phase === 2) {
        var cf4 = _easeInOut((elapsed - tPhase2) / ds.tCollapse);
        droopFrac = -0.25 + 1.25 * cf4;
      } else {
        droopFrac = 1.0;
      }
      for (var pi = 0; pi < ds.weaponPivots.length; pi++) {
        var wpv = ds.weaponPivots[pi];
        var maxDroopRad = (wpv.isGatling ? 20 : 30) * Math.PI / 180;
        var angle = droopFrac * maxDroopRad;
        if (angle > maxDroopRad) angle = maxDroopRad;
        if (angle < -5 * Math.PI / 180) angle = -5 * Math.PI / 180;
        wpv.pivot.quaternion.setFromAxisAngle(wpv.lz, angle);
      }
    }
  }

  function _deathEnd(ctx) {
    _cleanupWeaponPivots(ctx);
    ctx.deathState = null;
    ctx._deathActive = false;
    ctx._deathDone = true;
  }

  // ═══════════════════════════════════════════
  //  加特林枪管旋转
  // ═══════════════════════════════════════════
  function updateGatlingSpin(barrelClusters, dt, spinRPS) {
    if (!barrelClusters || barrelClusters.length === 0) return;
    spinRPS = spinRPS || 3;
    var delta = spinRPS * Math.PI * 2 * dt;
    for (var ci = 0; ci < barrelClusters.length; ci++) {
      var cluster = barrelClusters[ci];
      if (!cluster) continue;
      cluster.rotation.x += delta;
    }
  }

  // ═══════════════════════════════════════════
  //  Public API
  // ═══════════════════════════════════════════
  return {
    initContext: initContext,
    stepGait: stepGait,
    stepIdle: stepIdle,
    resetPose: resetPose,
    triggerStagger: triggerStagger,
    triggerDeath: triggerDeath,
    updateGatlingSpin: updateGatlingSpin,

    // 暴露给适配器的内部函数
    _staggerUpdate: _staggerUpdate,
    _staggerEnd: _staggerEnd,
    _deathUpdate: _deathUpdate,
    _deathEnd: _deathEnd,
    _cleanupWeaponPivots: _cleanupWeaponPivots,
    _legHomePos: _legHomePos,
    _ccdLeg: _ccdLeg,
    _initGait: _initGait,

    // 工具函数
    _worldX: _worldX,
    _worldY: _worldY,
    _worldZ: _worldZ,
    angleDiff: angleDiff,
    clamp: clamp,
    _easeOut: _easeOut,
    _easeInOut: _easeInOut
  };
})();
