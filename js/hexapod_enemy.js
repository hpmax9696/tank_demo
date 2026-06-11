/**
 * 六足战车敌人动画模块 — 多实例 CCD IK + 三角步态
 * v0.57.0: 从 hexapod_anim.js 重构，支撑相锥尖世界坐标固定（反打滑）
 *
 * 核心约束：支撑相脚的尖刺足锥尖锁定在世界空间固定点。
 * 身体位移由 AI 驱动，CCD 自动补偿关节使锥尖不滑动。
 */

var HexapodEnemy = (function() {
  var THREE = window.THREE;

  // ── 常量 ──
  var LEG_PREFIXES = ['左前', '右前', '左中', '右中', '左后', '右后'];
  var TRIPOD_A = { '左前': true, '右中': true, '左后': true };

  // 动画参数表 (与 hexapod_anim.js 对齐)
  var ANIM_NAMES = [
    'Idle', 'Walk', 'Run', 'Walk Back', 'Run Back',
    'Strafe Left', 'Strafe Right',
    'Static Turn L', 'Static Turn R',
    'Walk Turn L', 'Walk Turn R',
    'Strafe Turn L', 'Strafe Turn R',
    'Walk Back Turn L', 'Walk Back Turn R',
    'Run Turn L', 'Run Turn R',
    'Run Back Turn L', 'Run Back Turn R',
    'Strafe Run L', 'Strafe Run R',
    'Stagger', 'Death'
  ];
  var ANIM_DIRECTIONS = [0, 1, 1, -1, -1, 2, -2, 1, 1, 1, 1, 2, -2, -1, -1, 1, 1, -1, -1, 2, -2, 0, 0];
  var ANIM_TURN_RATES = [0, 0, 0, 0, 0, 0, 0, 1.2, -1.2, 0.5, -0.5, -0.45, 0.45, 0.5, -0.5, 0.7, -0.7, 0.7, -0.7, 0, 0, 0, 0];
  var ANIM_STRIDES     = [0, 0.22, 0.38, 0.18, 0.28, 0.14, 0.14, 0.135, 0.135, 0.22, 0.22, 0.14, 0.14, 0.18, 0.18, 0.38, 0.38, 0.28, 0.28, 0.19, 0.19, 0, 0];
  var ANIM_STEP_HEIGHTS = [0, 0.15, 0.24, 0.12, 0.18, 0.10, 0.10, 0.10, 0.10, 0.15, 0.15, 0.10, 0.10, 0.12, 0.12, 0.24, 0.24, 0.18, 0.18, 0.18, 0.18, 0, 0];

  // ── 工具函数 ──
  function _worldX(joint) {
    var q = new THREE.Quaternion(); joint.getWorldQuaternion(q);
    return new THREE.Vector3(1, 0, 0).applyQuaternion(q).normalize();
  }
  function _worldY(joint) {
    var q = new THREE.Quaternion(); joint.getWorldQuaternion(q);
    return new THREE.Vector3(0, 1, 0).applyQuaternion(q).normalize();
  }
  function _worldZ(joint) {
    var q = new THREE.Quaternion(); joint.getWorldQuaternion(q);
    return new THREE.Vector3(0, 0, 1).applyQuaternion(q).normalize();
  }
  function angleDiff(a, b) {
    var d = b - a;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return d;
  }
  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

  // ═══════════════════════════════════════════
  //  CCD IK 解算器 (单腿, 3关节: thigh.X → shin.X → hip.Y)
  // ═══════════════════════════════════════════
  function _ccdLeg(leg, targetWorld, iters, damp, root) {
    damp = damp || 0.5;
    var hipGroup = leg.hipGroup;
    var thighPv = leg.thighPivot;
    var shinPv = leg.shinPivot;
    var anklePv = leg.anklePivot;

    // 踝关节锁死（尖刺足锥尖单点接地，无需校平）
    anklePv.rotation.x = leg.restAnkle;

    for (var iter = 0; iter < iters; iter++) {
      root.updateMatrixWorld(true);

      var tipW = leg.tipLocal.clone().applyMatrix4(anklePv.matrixWorld);

      // 1. Thigh X (髋抬腿)
      var tW = new THREE.Vector3(); thighPv.getWorldPosition(tW);
      var d = tipW.clone().sub(tW).normalize();
      var dt = targetWorld.clone().sub(tW).normalize();
      var ax = new THREE.Vector3().crossVectors(d, dt);
      var l = ax.length();
      if (l > 0.0003) {
        ax.normalize();
        thighPv.rotation.x += Math.atan2(l, d.dot(dt)) * ax.dot(_worldX(thighPv)) * damp;
      }
      // 髋X限位：±2.8rad (≈±160°)，宽松限制防CCD完全发散
      if (thighPv.rotation.x > 2.8) thighPv.rotation.x = 2.8;
      else if (thighPv.rotation.x < -2.8) thighPv.rotation.x = -2.8;

      // 2. Shin X (膝)
      var sW = new THREE.Vector3(); shinPv.getWorldPosition(sW);
      root.updateMatrixWorld(true);
      tipW = leg.tipLocal.clone().applyMatrix4(anklePv.matrixWorld);
      d = tipW.clone().sub(sW).normalize();
      dt = targetWorld.clone().sub(sW).normalize();
      ax = new THREE.Vector3().crossVectors(d, dt);
      l = ax.length();
      if (l > 0.0003) {
        ax.normalize();
        shinPv.rotation.x += Math.atan2(l, d.dot(dt)) * ax.dot(_worldX(shinPv)) * damp;
      }

      // 膝关节防反曲：禁止穿越零点（自然弯曲方向），留0.05rad安全边界
      if (leg._shinSign > 0) {
        if (shinPv.rotation.x < 0.05) shinPv.rotation.x = 0.05;
      } else {
        if (shinPv.rotation.x > -0.05) shinPv.rotation.x = -0.05;
      }

      // 3. Hip Z (水平摆角) — 六足模型 hip 绕 Z 轴旋转
      var hW = new THREE.Vector3(); thighPv.getWorldPosition(hW);
      root.updateMatrixWorld(true);
      tipW = leg.tipLocal.clone().applyMatrix4(anklePv.matrixWorld);
      d = tipW.clone().sub(hW).normalize();
      dt = targetWorld.clone().sub(hW).normalize();
      ax = new THREE.Vector3().crossVectors(d, dt);
      l = ax.length();
      if (l > 0.0003) {
        ax.normalize();
        hipGroup.rotation.z += Math.atan2(l, d.dot(dt)) * ax.dot(_worldZ(hipGroup)) * damp;
      }

      // 髋Z限位：相对休息姿态最多±yLimit rad，防360°自由旋转致腿缠绕
      var yLimit = leg._yLimit || 0.7;
      var zDiff = hipGroup.rotation.z - leg.restHipZ;
      while (zDiff > Math.PI) zDiff -= 2 * Math.PI;
      while (zDiff < -Math.PI) zDiff += 2 * Math.PI;
      if (zDiff > yLimit) { hipGroup.rotation.z = leg.restHipZ + yLimit; }
      else if (zDiff < -yLimit) { hipGroup.rotation.z = leg.restHipZ - yLimit; }
    }
  }

  // ═══════════════════════════════════════════
  //  初始化：从敌人体收集引用，创建动画状态
  // ═══════════════════════════════════════════
  function init(enemyGroup) {
    var root = enemyGroup;
    root.updateMatrixWorld(true);

    var legs = [];
    var rootWorldPos = new THREE.Vector3(); root.getWorldPosition(rootWorldPos);

    for (var li = 0; li < LEG_PREFIXES.length; li++) {
      var prefix = LEG_PREFIXES[li];
      var hipGroup = root.getObjectByName(prefix + '腿');
      var thighPv = root.getObjectByName(prefix + '大腿_pivot');
      var shinPv  = root.getObjectByName(prefix + '小腿_pivot');
      var anklePv = root.getObjectByName(prefix + '脚踝_pivot');
      var spikeMesh = root.getObjectByName(prefix + '尖刺足');

      if (!hipGroup || !thighPv || !shinPv || !anklePv || !spikeMesh) {
        console.warn('HexapodEnemy.init: 找不到腿部件: ' + prefix);
        continue;
      }

      // 休息姿态
      var restHipZ = hipGroup.rotation.z;
      var restHipX = thighPv.rotation.x;
      var restKnee = shinPv.rotation.x;
      var restAnkle = anklePv.rotation.x;

      // 锥尖在 anklePivot 本地空间中的位置
      root.updateMatrixWorld(true);
      var sb = new THREE.Box3().setFromObject(spikeMesh);
      var tipWorld = new THREE.Vector3(
        (sb.min.x + sb.max.x) / 2,
        sb.min.y,
        (sb.min.z + sb.max.z) / 2
      );
      var tipLocal = anklePv.worldToLocal(tipWorld.clone());

      // 脚到身体中心的 XZ 距离（固定值，防止 CCD 误差漂移）
      root.updateMatrixWorld(true);
      var hw2 = new THREE.Vector3(); root.getWorldPosition(hw2);
      var tipW2 = tipLocal.clone().applyMatrix4(anklePv.matrixWorld);
      var initFootDist = Math.sqrt(
        (tipW2.x - hw2.x) * (tipW2.x - hw2.x) +
        (tipW2.z - hw2.z) * (tipW2.z - hw2.z)
      );

      // 膝弯方向：休息姿态 knee 的正负号
      var shinSign = restKnee > 0 ? 1 : -1;

      // 髋Z限位：中腿 ±0.7rad(≈40°)，前后腿 ±0.45rad(≈25°)
      var yLimit = (prefix.indexOf('中') >= 0) ? 0.7 : 0.45;

      // 初始接地高度
      var groundY = tipW2.y;

      legs.push({
        prefix: prefix,
        tripodA: !!TRIPOD_A[prefix],
        hipGroup: hipGroup,
        thighPivot: thighPv,
        shinPivot: shinPv,
        anklePivot: anklePv,
        spikeMesh: spikeMesh,

        restHipZ: restHipZ,
        restHipX: restHipX,
        restKnee: restKnee,
        restAnkle: restAnkle,

        tipLocal: tipLocal,
        _initFootDist: initFootDist,
        _shinSign: shinSign,
        _yLimit: yLimit,
        _groundY: groundY,

        // 步态状态（初始 null，运行时填充）
        plantPos: null,
        swingFrom: null,
        swingTo: null,
        _wasStance: undefined
      });
    }

    // 收集武器引用
    var weapons = [];
    ['左加特林', '右加特林', '左导弹巢', '右导弹巢'].forEach(function(name) {
      var wg = root.getObjectByName(name);
      var mount = root.getObjectByName(name.replace('加特林', '加特林支架').replace('导弹巢', '导弹支架'));
      if (wg) {
        weapons.push({
          name: name,
          weaponGroup: wg,
          mount: mount,
          isGatling: name.indexOf('加特林') >= 0
        });
      }
    });

    // 收集加特林枪管簇 (已在 createHexapod 中创建)
    var barrelClusters = root.userData._barrelClusters || [];

    var state = {
      root: root,
      legs: legs,
      weapons: weapons,
      barrelClusters: barrelClusters,

      // 身体休息姿态
      restPosY: root.position.y,
      restRotY: root.rotation.y,
      _baseY: root.userData._baseY || 0,

      // 步态状态
      _gaitInit: false,
      _totalDist: 0,
      _gaitActive: false,
      _curAnimIndex: 0,
      _slowFrames: 0,
      _lastAnimIndex: -1,
      _lastAnimIndex: -1,
      _prevBodyYaw: root.rotation.y,
      _prevBodyPos: root.position.clone(),

      // 踉跄 / 死亡
      _staggerActive: false,
      _staggerDone: false,
      _deathActive: false,
      _deathDone: false,
      staggerState: null,
      deathState: null,
      _lastAnimRequest: ''
    };

    // ── 自动抬升：让最低尖刺足恰好触地(Y=0)，身体自然抬高 ──
    root.updateMatrixWorld(true);
    var lowestTipY = Infinity;
    for (var li3 = 0; li3 < legs.length; li3++) {
      var l3 = legs[li3];
      var tw3 = l3.tipLocal.clone().applyMatrix4(l3.anklePivot.matrixWorld);
      if (tw3.y < lowestTipY) lowestTipY = tw3.y;
    }
    if (lowestTipY < 0) {
      var liftAmount = -lowestTipY;
      root.position.y += liftAmount;
    }
    state.restPosY = root.position.y;
    state._baseY = root.position.y - (typeof window.getGroundHeight === 'function'
      ? window.getGroundHeight(root.position.x, root.position.z) : 0);

    // ── 计算每腿的休息姿态脚位（相对身体中心，本地空间）──
    root.updateMatrixWorld(true);
    var bodyCenter = new THREE.Vector3(); root.getWorldPosition(bodyCenter);
    for (var li4 = 0; li4 < legs.length; li4++) {
      var l4 = legs[li4];
      var tipW4 = l4.tipLocal.clone().applyMatrix4(l4.anklePivot.matrixWorld);
      l4._groundY = tipW4.y;
      // homeOffset: 脚在身体本地空间中的位置（随身体移动和旋转）
      l4.homeOffset = root.worldToLocal(tipW4.clone());
      // 初始脚距（转弯用）
      l4._initFootDist = Math.sqrt(
        (tipW4.x - bodyCenter.x) * (tipW4.x - bodyCenter.x) +
        (tipW4.z - bodyCenter.z) * (tipW4.z - bodyCenter.z)
      );
    }

    root.userData._hexAnimState = state;
    return state;
  }

  // ═══════════════════════════════════════════
  //  计算腿在身体当前位置下的"家"位置（世界空间，地面高度）
  // ═══════════════════════════════════════════
  function _legHomePos(state, leg) {
    var root = state.root;
    var bodyC = new THREE.Vector3(); root.getWorldPosition(bodyC);
    // homeOffset 是本地空间偏移，转换到世界空间
    var worldHome = leg.homeOffset.clone().applyMatrix4(root.matrixWorld);
    worldHome.y = typeof window.getGroundHeight === 'function'
      ? window.getGroundHeight(worldHome.x, worldHome.z) : leg._groundY;
    return worldHome;
  }

  // ═══════════════════════════════════════════
  //  步态更新（核心）— 基于 homeOffset，永远可达
  // ═══════════════════════════════════════════
  function _updateGait(state, dt, animIndex) {
    var dir = (animIndex >= 0 && animIndex < ANIM_DIRECTIONS.length)
      ? ANIM_DIRECTIONS[animIndex] : 0;
    var cfgTurnRate = (animIndex >= 0 && animIndex < ANIM_TURN_RATES.length)
      ? ANIM_TURN_RATES[animIndex] : 0;
    var stride = (animIndex >= 0 && animIndex < ANIM_STRIDES.length)
      ? ANIM_STRIDES[animIndex] : 0;
    var stepH = (animIndex >= 0 && animIndex < ANIM_STEP_HEIGHTS.length)
      ? ANIM_STEP_HEIGHTS[animIndex] : 0.1;

    var root = state.root;

    // 身体状态
    var curBodyYaw = root.rotation.y;
    var actualTurnRate = angleDiff(state._prevBodyYaw, curBodyYaw) / Math.max(dt, 0.001);
    state._prevBodyYaw = curBodyYaw;
    var turnRate = (cfgTurnRate !== 0) ? cfgTurnRate : (Math.abs(actualTurnRate) > 0.05 ? actualTurnRate : 0);

    // 动态步幅和步态周期
    var bodySpeedNow = 0;
    if (state._prevBodyPos) {
      var bdv = new THREE.Vector3().subVectors(root.position, state._prevBodyPos);
      bdv.y = 0; bodySpeedNow = bdv.length() / Math.max(dt, 0.001);
    }
    var gaitPeriod = 0.7;
    if (Math.abs(turnRate) > 1.0) gaitPeriod = clamp(1.05 / Math.abs(turnRate), 0.4, 0.8);
    else if (Math.abs(turnRate) > 0.05) gaitPeriod = 0.6;
    else if (bodySpeedNow > 1.5) gaitPeriod = clamp(2.0 / bodySpeedNow, 0.3, 0.7);
    var dynamicStride = Math.max(stride, bodySpeedNow * gaitPeriod * 0.5);
    var gaitCycles = state._totalDist / Math.max(dynamicStride * 2, 0.001);

    var ccdIters = (Math.abs(turnRate) > 0.05) ? 30 : (stride > 0 ? 20 : 15);
    var damp = (Math.abs(turnRate) > 0.05) ? 0.8 : 0.5;

    // 前进方向
    var fwdBody;
    if (dir === 2 || dir === -2) fwdBody = new THREE.Vector3(0, 0, dir / 2);
    else fwdBody = new THREE.Vector3(-1 * dir, 0, 0);
    root.localToWorld(fwdBody);
    var hw = new THREE.Vector3(); root.getWorldPosition(hw);
    fwdBody.sub(hw).normalize();

    // 地形高度
    if (typeof window.getGroundHeight === 'function') {
      var gh = window.getGroundHeight;
      var hwPos = new THREE.Vector3(); root.getWorldPosition(hwPos);
      root.position.y = gh(hwPos.x, hwPos.z) + (state._baseY || 0);
    }
    root.updateMatrixWorld(true);

    // ── 逐腿步态 ──
    for (var li = 0; li < state.legs.length; li++) {
      var leg = state.legs[li];
      var phaseOffset = leg.tripodA ? 0 : 0.5;
      var gaitT = (gaitCycles + phaseOffset) % 1;
      var inStance = (gaitT < 0.5);
      var stanceFrac = inStance ? gaitT * 2 : (gaitT - 0.5) * 2;

      if (inStance) {
        // 支撑相：脚位 = 进入支撑相时的 homePos（世界固定点，防打滑）
        if (!leg._wasStance) {
          leg._stanceTarget = _legHomePos(state, leg);
        }
        _ccdLeg(leg, leg._stanceTarget, ccdIters, damp, root);
      } else {
        // 摆动相：脚从 stanceTarget 摆向新的 homePos + 步幅前进
        if (leg._wasStance) {
          leg._swingFrom = leg._stanceTarget.clone();
          leg._swingTo = _legHomePos(state, leg);
          // 前进偏移：落地点在 homePos 前方 dynamicStride*2
          leg._swingTo.x += fwdBody.x * dynamicStride * 2;
          leg._swingTo.z += fwdBody.z * dynamicStride * 2;
          leg._swingTo.y = typeof window.getGroundHeight === 'function'
            ? window.getGroundHeight(leg._swingTo.x, leg._swingTo.z) : leg._groundY;
        }
        if (!leg._swingFrom || !leg._swingTo) {
          // 首次入摆动相：从 homePos 起步
          leg._swingFrom = _legHomePos(state, leg);
          leg._swingTo = leg._swingFrom.clone();
          leg._swingTo.x += fwdBody.x * dynamicStride * 2;
          leg._swingTo.z += fwdBody.z * dynamicStride * 2;
          leg._swingTo.y = typeof window.getGroundHeight === 'function'
            ? window.getGroundHeight(leg._swingTo.x, leg._swingTo.z) : leg._groundY;
        }
        // Lerp + 弧线
        var target = new THREE.Vector3().lerpVectors(leg._swingFrom, leg._swingTo, stanceFrac);
        target.y += Math.sin(stanceFrac * Math.PI) * stepH;
        if (stanceFrac > 0.7) {
          var gY = typeof window.getGroundHeight === 'function'
            ? window.getGroundHeight(target.x, target.z) : leg._groundY;
          if (target.y < gY) target.y = gY + 0.03;
        }
        _ccdLeg(leg, target, ccdIters, damp, root);
      }
      leg._wasStance = inStance;
    }

    // 加特林枪管旋转
    _updateGatlingSpin(state, dt);
  }

  // ═══════════════════════════════════════════
  //  加特林枪管簇公转 (3 RPS)
  // ═══════════════════════════════════════════
  var _barrelSpinAccum = 0;
  function _updateGatlingSpin(state, dt) {
    var clusters = state.barrelClusters;
    if (!clusters || clusters.length === 0) return;
    // 枪管转速跟随 AI spinUp: 0→3 RPS(待机), 1→30 RPS(满速开火)
    var spinUp = (state.root.userData && state.root.ai) ? (state.root.ai.spinUp || 0) : 0;
    var spinRPS = 3 + spinUp * 27;
    var delta = spinRPS * Math.PI * 2 * dt;
    for (var ci = 0; ci < clusters.length; ci++) {
      var cluster = clusters[ci];
      if (!cluster) continue;
      cluster.rotation.x += delta;
    }
  }

  // ═══════════════════════════════════════════
  //  AI animRequest → 动画 index 映射
  // ═══════════════════════════════════════════
  function _animRequestToIndex(animRequest, state, ai) {
    // 死亡优先
    if (animRequest === 'death') return 22;
    if (state._staggerActive) return 21;

    // 踉跄一次性触发
    if (animRequest === 'stagger') return 21;

    switch (animRequest) {
      case 'idle':        return 0;
      case 'move_forward': return 1;   // Walk
      case 'move_backward': return 3;  // Walk Back
      case 'strafe_left':  return 5;   // Strafe Left
      case 'strafe_right': return 6;   // Strafe Right
      case 'turn_left':
        // 静态转弯 vs 步行转弯
        if (ai && ai.state === 'engage') return 10; // Walk Turn L
        return 8;  // Static Turn L
      case 'turn_right':
        if (ai && ai.state === 'engage') return 11; // Walk Turn R
        return 9;  // Static Turn R
      case 'attack':
        // 攻击不改变移动动画，返回当前动画
        return state._curAnimIndex;
      default:
        return 0;
    }
  }

  // ═══════════════════════════════════════════
  //  主更新入口（每帧由 gameLoop 调用）
  // ═══════════════════════════════════════════
  function update(enemy, dt) {
    var state = enemy.userData._hexAnimState;
    if (!state) return;

    // 死亡动画已播完 → 冻结姿态，不再更新
    if (state._deathDone) {
      _updateGatlingSpin(state, dt);
      return;
    }

    var ai = enemy.ai;
    var animRequest = (ai && ai.animRequest) ? ai.animRequest : 'idle';

    // ── 全局位移跟踪（不受动画模式影响）──
    var bodySpeed = 0;
    var bodyTurnSpeed = 0;
    if (state._prevBodyPos) {
      var bd = new THREE.Vector3().subVectors(enemy.position, state._prevBodyPos);
      bd.y = 0;
      bodySpeed = bd.length() / Math.max(dt, 0.001);
      bodyTurnSpeed = Math.abs(angleDiff(state._prevBodyYaw, enemy.rotation.y)) / Math.max(dt, 0.001);
      // 全局累加位移（含旋转弧长贡献）
      state._totalDist += bd.length() + Math.abs(bodyTurnSpeed) * dt * 0.7;
    }
    // ── 空闲/卡住检测 ──
    if (bodySpeed < 0.03 && bodyTurnSpeed < 0.05) {
      state._slowFrames = (state._slowFrames || 0) + 1;
    } else {
      state._slowFrames = 0;
    }
    if (state._slowFrames >= 6 && (animRequest === 'move_forward' || animRequest === 'move_backward'
        || animRequest === 'strafe_left' || animRequest === 'strafe_right' || animRequest === 'turn_left' || animRequest === 'turn_right')) {
      animRequest = 'idle';
    }

    // ── 踉跄进行中 ──
    if (state._staggerActive) {
      _staggerUpdate(state, dt);
      _updateGatlingSpin(state, dt);
      return;
    }

    // ── 死亡进行中 ──
    if (state._deathActive) {
      _deathUpdate(state, dt);
      _updateGatlingSpin(state, dt);
      return;
    }

    // ── 踉跄动画触发（外部 triggerStagger 调用，此处仅作 animRequest 路径兜底）──
    if (animRequest === 'stagger' && !state._staggerActive) {
      var hitDir = ai._lastHitDir || new THREE.Vector3(0, 0, 1);
      triggerStagger(state, hitDir, ai._lastHitForce || 0.5);
      return;
    }

    // ── 死亡动画触发 ──
    if (animRequest === 'death' && !state._deathActive && !state._deathDone) {
      triggerDeath(state);
      return;
    }

    // 动画切换检测
    var animIndex = _animRequestToIndex(animRequest, state, ai);
    var switched = (animIndex !== state._lastAnimIndex);
    state._lastAnimIndex = animIndex;  // 始终更新，确保 _lastAnimIndex 最新

    if (switched) {
      // 切换动画：清除上一种动画的脚步追踪状态
      for (var li = 0; li < state.legs.length; li++) {
        var lg = state.legs[li];
        lg._stanceTarget = null;
        lg._swingFrom = null;
        lg._swingTo = null;
        lg._wasStance = undefined;
      }
    }

    state._curAnimIndex = animIndex;

    var dir = (animIndex >= 0 && animIndex < ANIM_DIRECTIONS.length)
      ? ANIM_DIRECTIONS[animIndex] : 0;
    var cfgTurnRate = (animIndex >= 0 && animIndex < ANIM_TURN_RATES.length)
      ? ANIM_TURN_RATES[animIndex] : 0;
    var isIdle = (dir === 0 && cfgTurnRate === 0);

    if (!isIdle) {
      _updateGait(state, dt, animIndex);
    } else {
      // Idle：所有腿回到标准站姿（homeOffset + 地面高度），自然恢复
      state._gaitInit = false;

      // 身体微呼吸
      var bob = Math.sin(performance.now() / 1000 * Math.PI * 2) * 0.04;
      var hwPos2 = new THREE.Vector3(); state.root.getWorldPosition(hwPos2);
      if (typeof window.getGroundHeight === 'function') {
        state.root.position.y = window.getGroundHeight(hwPos2.x, hwPos2.z) + (state._baseY || 0) + bob;
      } else {
        state.root.position.y = state.restPosY + bob;
      }
      state.root.updateMatrixWorld(true);

      // 所有腿 CCD 到各自 homePos（永远可达），空闲/复活时自然回到标准站姿
      for (var li2 = 0; li2 < state.legs.length; li2++) {
        var leg2 = state.legs[li2];
        var homeTarget = _legHomePos(state, leg2);
        _ccdLeg(leg2, homeTarget, 20, 0.5, state.root);
      }

      _updateGatlingSpin(state, dt);
    }

    // 更新 prev 状态用于下一帧速度/角速度计算
    state._prevBodyYaw = state.root.rotation.y;
    state._prevBodyPos.copy(state.root.position);
  }

  // ═══════════════════════════════════════════
  //  受击踉跄系统
  // ═══════════════════════════════════════════
  function _easeOut(t) { return 1 - Math.pow(1 - t, 3); }
  function _easeInOut(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

  function triggerStagger(state, hitWorldDir, force) {
    if (!state || !state.root || !state.legs.length) return;
    force = clamp(force || 0.5, 0.15, 1);

    var dirWorld = new THREE.Vector3(hitWorldDir.x, 0, hitWorldDir.z);
    if (dirWorld.length() < 0.01) dirWorld.set(0, 0, 1);
    dirWorld.normalize();

    state.root.updateMatrixWorld(true);
    var hp = new THREE.Vector3(); state.root.getWorldPosition(hp);

    // 转本地方向，判断哪些腿在受击对面（用于跺地支撑）
    var localEnd = state.root.worldToLocal(hp.clone().add(dirWorld));
    var lx = localEnd.x, lz = localEnd.z;

    // 保存所有脚当前世界位置
    var plants = [];
    for (var li = 0; li < state.legs.length; li++) {
      var l = state.legs[li];
      plants.push(l.tipLocal.clone().applyMatrix4(l.anklePivot.matrixWorld));
    }

    // 按腿位置打分，选出受击反向侧 2~3 条腿跺地
    var scores = [];
    for (var li2 = 0; li2 < state.legs.length; li2++) {
      var pf = state.legs[li2].prefix;
      var sc = 0;
      if (pf.indexOf('前') >= 0) sc -= lx;
      if (pf.indexOf('后') >= 0) sc += lx;
      if (pf.indexOf('左') >= 0) sc -= lz;
      if (pf.indexOf('右') >= 0) sc += lz;
      scores.push({ i: li2, s: sc });
    }
    scores.sort(function(a, b) { return b.s - a.s; });
    var stompIdx = [scores[0].i, scores[1].i];
    if (Math.random() < 0.4) stompIdx.push(scores[2].i);

    var push = 0.22 * force;
    var restY = state.restPosY;
    var restX = state.root.position.x;
    var restZ = state.root.position.z;

    state.staggerState = {
      t0: performance.now() / 1000,
      force: force, dir: dirWorld,
      tImp: 0.12, tStag: 0.35, tRec: 0.50,
      pushX: dirWorld.x * push, pushZ: dirWorld.z * push,
      tiltX: dirWorld.z * 0.10 * force, tiltZ: -dirWorld.x * 0.10 * force,
      plants: plants,
      stompIdx: stompIdx, stompTargets: {}, stompFired: false,
      bodyStart: hp.clone(),
      restY: restY, restX: restX, restZ: restZ
    };
    state._staggerActive = true;
  }

  function _staggerUpdate(state, dt) {
    if (!state.staggerState) return;
    var s = state.staggerState;
    var elapsed = performance.now() / 1000 - s.t0;
    var total = s.tImp + s.tStag + s.tRec;
    if (elapsed >= total) { _staggerEnd(state); return; }

    var root = state.root;
    var inImp = elapsed < s.tImp;
    var inStag = elapsed >= s.tImp && elapsed < s.tImp + s.tStag;

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
        var li = s.stompIdx[si];
        s.stompTargets[li] = {
          from: s.plants[li].clone(),
          to: s.plants[li].clone().add(new THREE.Vector3(-s.dir.x * 0.1 * s.force, 0.04, -s.dir.z * 0.1 * s.force))
        };
      }
      s.stompFired = true;
    }

    // 逐腿 CCD
    for (var li3 = 0; li3 < state.legs.length; li3++) {
      var leg = state.legs[li3];
      var tgt;
      if (s.stompTargets[li3]) {
        var st = s.stompTargets[li3];
        var frac = Math.min(1, (elapsed - s.tImp) / (s.tStag * 0.35));
        tgt = new THREE.Vector3().lerpVectors(st.from, st.to, _easeOut(frac));
        tgt.y += Math.sin(Math.min(frac, 1) * Math.PI) * 0.07;
      } else {
        tgt = s.plants[li3];
      }
      _ccdLeg(leg, tgt, 25, 0.7, root);
    }
  }

  function _staggerEnd(state) {
    // 保存当前身体位置（踉跄期间身体被推移了，不强制复位）
    state.staggerState = null;
    state._staggerActive = false;
    state._staggerDone = false; // 允许再次触发
    // 复位腿部关节到休息姿态
    if (state.root) {
      state.root.updateMatrixWorld(true);
    }
    for (var li = 0; li < state.legs.length; li++) {
      var lg = state.legs[li];
      lg._stanceTarget = null;
      lg._swingFrom = null;
      lg._swingTo = null;
      lg._wasStance = undefined;
      lg.thighPivot.rotation.x = lg.restHipX;
      lg.shinPivot.rotation.x = lg.restKnee;
      lg.anklePivot.rotation.x = lg.restAnkle;
      lg.hipGroup.rotation.z = lg.restHipZ;
    }
  }

  // ═══════════════════════════════════════════
  //  死亡瘫倒系统
  // ═══════════════════════════════════════════
  function triggerDeath(state) {
    if (!state || !state.root || !state.legs.length) return;

    state.root.updateMatrixWorld(true);
    var root = state.root;
    var bodyC = new THREE.Vector3(); root.getWorldPosition(bodyC);
    var restX = root.position.x;
    var restZ = root.position.z;
    var restY = root.position.y;

    // 地面高度
    var groundY = restY;
    var startPlants = [];
    for (var li = 0; li < state.legs.length; li++) {
      var l = state.legs[li];
      var tw = l.tipLocal.clone().applyMatrix4(l.anklePivot.matrixWorld);
      startPlants.push(tw.clone());
      if (tw.y < groundY) groundY = tw.y;
    }
    var bellyY = groundY + 0.14;

    // 每腿各异的死亡瘫姿
    var splayPresets = [
      { mul: 1.18, ao: 0.55 },
      { mul: 1.25, ao: -0.15 },
      { mul: 1.22, ao: 0.08 },
      { mul: 1.30, ao: -0.45 },
      { mul: 1.15, ao: -0.50 },
      { mul: 1.20, ao: 0.60 },
    ];
    var deathTargets = [];
    for (var li2 = 0; li2 < state.legs.length; li2++) {
      var fromB = startPlants[li2].clone().sub(bodyC); fromB.y = 0;
      var baseAngle = Math.atan2(fromB.z, fromB.x);
      var baseDist = fromB.length() || 0.5;
      var sp = splayPresets[li2];
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
    for (var li3 = 0; li3 < state.legs.length; li3++) {
      var pf2 = state.legs[li3].prefix;
      var p = startPlants[li3].clone();
      if (pf2.indexOf('前') >= 0) {
        var toBody = bodyC.clone().sub(p); toBody.y = 0;
        toBody.normalize().multiplyScalar(0.06);
        p.add(toBody);
      }
      p.y = groundY;
      rearTargets.push(p);
    }

    state.deathState = {
      t0: performance.now() / 1000,
      tRearUp: 0.22, tApex: 0.10, tCollapse: 0.7, tSettle: 0.5,
      restY: restY, restX: restX, restZ: restZ,
      bellyY: bellyY, groundY: groundY,
      peakY: restY + 0.12,
      startPlants: startPlants,
      rearTargets: rearTargets,
      deathTargets: deathTargets
    };
    state._deathActive = true;
  }

  function _deathUpdate(state, dt) {
    if (!state.deathState) return;
    var ds = state.deathState;
    var elapsed = performance.now() / 1000 - ds.t0;
    var tRear = ds.tRearUp, tApex = ds.tApex;
    var tPhase2 = tRear + tApex;
    var tPhase3 = tPhase2 + ds.tCollapse;
    var total = tPhase3 + ds.tSettle;
    if (elapsed >= total) { _deathEnd(state); return; }

    var root = state.root;
    var phase = elapsed < tRear ? 0
      : elapsed < tPhase2 ? 1
      : elapsed < tPhase3 ? 2
      : 3;

    // 身体 Y
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
    root.position.x = ds.restX;
    root.position.z = ds.restZ;

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

    // CCD damp 渐降
    var damp;
    if (phase <= 1) damp = 0.85;
    else if (phase === 2) damp = 0.85 - 0.82 * Math.min(1, (elapsed - tPhase2) / ds.tCollapse);
    else damp = 0.03;

    // 腿靶点
    for (var li = 0; li < state.legs.length; li++) {
      var leg = state.legs[li];
      var tgt;
      if (phase <= 1) {
        tgt = ds.rearTargets[li];
      } else if (phase === 2) {
        var cf3 = _easeInOut((elapsed - tPhase2) / ds.tCollapse);
        tgt = new THREE.Vector3().lerpVectors(ds.rearTargets[li], ds.deathTargets[li], cf3);
      } else {
        tgt = ds.deathTargets[li];
      }
      _ccdLeg(leg, tgt, phase >= 3 ? 10 : 20, damp, root);
    }
  }

  function _deathEnd(state) {
    state.deathState = null;
    state._deathActive = false;
    state._deathDone = true;
  }

  // ═══════════════════════════════════════════
  //  公开 API
  // ═══════════════════════════════════════════
  return {
    init: init,
    update: update,
    triggerStagger: triggerStagger,
    triggerDeath: triggerDeath,
    ANIM_NAMES: ANIM_NAMES
  };
})();
