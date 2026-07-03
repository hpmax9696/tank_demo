/**
 * 六足战车敌人动画适配器 v0.58.0
 *
 * 薄封装 HexapodCore，处理 getObjectByName 引用收集 + bodyWriter=false (游戏模式)。
 * 替换旧 hexapod_enemy.js，从 ~890行 缩减到 ~150行。
 */

var HexapodEnemy = (function () {
  var THREE = window.THREE;
  var CORE = window.HexapodCore;
  var CFG = window.HexapodConfig;

  // ═══════════════════════════════════════════
  //  init: getObjectByName → legRefs → core.initContext
  // ═══════════════════════════════════════════
  function init(enemyGroup) {
    var root = enemyGroup;
    // ── 清理旧死亡动画残留的武器枢轴 (修复多次复活后 _death_wp_* 累积嵌套) ──
    // 根因: 死亡动画1.52s > 重生延迟1.0s, init()先于_deathEnd执行,
    //       旧context被丢弃, _death_wp_*枢轴永不被清理, 每轮嵌套累积
    var oldCtx = root.userData._hexAnimState;
    if (oldCtx && oldCtx.deathState && oldCtx.deathState.weaponPivots) {
      CORE._deathEnd(oldCtx);
    }
    // 兜底: 利用 createHexapod 保存的原始父引用, 递归清除所有残留 _death_wp_* 节点
    var weaponParents = root.userData._weaponParents;
    if (weaponParents) {
      Object.keys(weaponParents).forEach(function (name) {
        var info = weaponParents[name];
        var wg = root.getObjectByName(name);
        if (!wg) return;
        // 沿父链向上清除所有 _death_wp_* 枢轴
        while (wg.parent && wg.parent.name && wg.parent.name.indexOf('_death_wp_') === 0) {
          var pivot = wg.parent;
          var grandParent = pivot.parent;
          // pivot 下所有子节点移回 grandParent
          while (pivot.children.length > 0) {
            var child = pivot.children[0];
            pivot.remove(child);
            if (grandParent) grandParent.add(child);
          }
          if (grandParent) grandParent.remove(pivot);
        }
        // 确保武器在正确的原始父节点下
        if (wg.parent !== info.parent && info.parent) {
          if (wg.parent) wg.parent.remove(wg);
          info.parent.add(wg);
          wg.position.copy(info.localPos);
          wg.quaternion.copy(info.localQuat);
          wg.scale.copy(info.localScale);
        }
      });
    }
    // 复活时关节可能处于死亡瘫倒姿态, 先用 createHexapod 保存的 rest 值复位
    var savedLegs = root.userData._legJoints;
    if (savedLegs) {
      for (var si = 0; si < savedLegs.length; si++) {
        var sl = savedLegs[si];
        if (sl.hipGrp) sl.hipGrp.rotation.z = sl.restHipZ;
        if (sl.thighPv) sl.thighPv.rotation.x = sl.restHipX;
        if (sl.shinPv) sl.shinPv.rotation.x = sl.restKnee;
        if (sl.anklePv) sl.anklePv.rotation.x = sl.restAnkle;
      }
    }
    root.updateMatrixWorld(true);

    var LEG_CONFIG = CFG.LEG_CONFIG;
    if (!LEG_CONFIG) {
      console.error('HexapodEnemy.init: HexapodConfig.LEG_CONFIG not found');
      return null;
    }
    var prefixes = LEG_CONFIG.prefixes;
    var tripodA = LEG_CONFIG.tripodA;

    var legRefs = [];
    for (var li = 0; li < prefixes.length; li++) {
      var prefix = prefixes[li];
      var hipGroup = root.getObjectByName(prefix + '腿');
      var thighPv = root.getObjectByName(prefix + '大腿_pivot');
      var shinPv = root.getObjectByName(prefix + '小腿_pivot');
      var anklePv = root.getObjectByName(prefix + '脚踝_pivot');
      var spikeMesh = root.getObjectByName(prefix + '尖刺足');

      if (!hipGroup || !thighPv || !shinPv || !anklePv || !spikeMesh) {
        console.warn('HexapodEnemy.init: missing leg parts for ' + prefix);
        continue;
      }

      var restHip = hipGroup.rotation.z; // game uses Z-axis hip
      legRefs.push({
        prefix: prefix,
        tripodA: !!tripodA[prefix],
        hipJoint: hipGroup,
        thighPivot: thighPv,
        shinPivot: shinPv,
        anklePivot: anklePv,
        spikeMesh: spikeMesh,
        restHip: restHip,
        restThigh: thighPv.rotation.x,
        restShin: shinPv.rotation.x,
        restAnkle: anklePv.rotation.x,
        _shinSign: shinPv.rotation.x > 0 ? 1 : -1,
        _yLimit: prefix.indexOf('中') >= 0 ? LEG_CONFIG.yLimitMiddle : LEG_CONFIG.yLimitFront,
      });
    }

    // 收集武器引用（用于死亡垂下）
    var weaponRefs = [];
    ['左加特林', '右加特林', '左导弹巢', '右导弹巢'].forEach(function (name) {
      var wg = root.getObjectByName(name);
      var mount = root.getObjectByName(
        name.replace('加特林', '加特林支架').replace('导弹巢', '导弹支架')
      );
      if (wg && mount) {
        weaponRefs.push({
          name: name,
          weaponGroup: wg,
          mount: mount,
          isGatling: name.indexOf('加特林') >= 0,
        });
      }
    });

    // 枪管簇 (createHexapod 已创建)
    var barrelClusters = root.userData._barrelClusters || [];

    // 初始化 core context (game mode: bodyWriter=false, hipAxis='z')
    var ctx = CORE.initContext(legRefs, root, {
      hipAxis: 'z',
      groundHeightFn: typeof window.getGroundHeight === 'function' ? window.getGroundHeight : null,
      bodyWriter: false,
    });

    ctx._weaponRefs = weaponRefs;
    ctx._barrelClusters = barrelClusters;

    root.userData._hexAnimState = ctx;

    // ── 碰撞体 ──
    if (window.CollisionSystem && window.HexapodConfig) {
      if (HexapodConfig.COLLISION_PARTS && HexapodConfig.COLLISION_PARTS.length) {
        CollisionSystem.buildFromModel(root, { group: root }, HexapodConfig.COLLISION_PARTS);
      } else if (HexapodConfig.COLLISION_SHAPES) {
        CollisionSystem.attach(root, { group: root }, HexapodConfig.COLLISION_SHAPES);
      }
    }

    return ctx;
  }

  // ═══════════════════════════════════════════
  //  AI animRequest → animIndex 映射
  // ═══════════════════════════════════════════
  function _animRequestToIndex(animRequest, ctx, ai) {
    if (animRequest === 'death') return 22;
    if (ctx._staggerActive || animRequest === 'stagger') return 21;

    switch (animRequest) {
      case 'idle':
        return 0;
      case 'move_forward':
        return 1;
      case 'move_forward_run':
        return 2;
      case 'move_backward':
        return 3;
      case 'move_backward_run':
        return 4;
      case 'strafe_left':
        return 5;
      case 'strafe_right':
        return 6;
      case 'strafe_run_left':
        return 19;
      case 'strafe_run_right':
        return 20;
      case 'turn_left':
        return ai && ai.state === 'engage' ? 9 : 7; // Walk Turn L vs Static Turn L
      case 'turn_right':
        return ai && ai.state === 'engage' ? 10 : 8;
      case 'attack':
        // 开火通过 ai.gatlingRequest/ai.missileRequest 标志驱动，不再设置 attack 动画
        // AI 始终设置移动动画，此 case 仅作兜底
        return ctx._curAnimIndex || 0;
      default:
        return 0;
    }
  }

  // ═══════════════════════════════════════════
  //  update: 每帧由 engine.js gameLoop 调用
  // ═══════════════════════════════════════════
  function update(enemy, dt) {
    var ctx = enemy.userData._hexAnimState;
    if (!ctx) return;

    // 死亡动画已播完 → 冻结
    if (ctx._deathDone) {
      CORE.updateGatlingSpin(ctx._barrelClusters, dt, 0);
      return;
    }

    var ai = enemy.ai;
    var animRequest = ai && ai.animRequest ? ai.animRequest : 'idle';

    // 身体速度: 优先用 ai 期望速度 (精确, 避免 _prevBodyPos 时序bug导致恒0)
    var bodySpeed = 0;
    var bodyTurnSpeed = 0;
    if (ai && (ai._desiredVelX !== undefined || ai._desiredVelZ !== undefined)) {
      bodySpeed = Math.sqrt(
        (ai._desiredVelX || 0) * (ai._desiredVelX || 0) +
          (ai._desiredVelZ || 0) * (ai._desiredVelZ || 0)
      );
    }
    if (ctx._prevBodyPos) {
      if (bodySpeed === 0) {
        // fallback: 位置差估算 (无 desiredVel 时, 如老式敌人)
        var bd = new THREE.Vector3().subVectors(enemy.position, ctx._prevBodyPos);
        bd.y = 0;
        bodySpeed = bd.length() / Math.max(dt, 0.001);
      }
      bodyTurnSpeed =
        Math.abs(CORE.angleDiff(ctx._prevBodyYaw, enemy.rotation.y)) / Math.max(dt, 0.001);
      ctx._totalDist = (ctx._totalDist || 0) + bodySpeed * dt + Math.abs(bodyTurnSpeed) * dt * 0.7;
    }

    // 死亡触发（一次性）
    if (animRequest === 'death' && !ctx._deathActive && !ctx._deathDone) {
      CORE.triggerDeath(ctx, ctx._weaponRefs);
    }
    // 踉跄触发（一次性，AI 可能设 animRequest='stagger'）
    if (animRequest === 'stagger' && !ctx._staggerActive && !ctx._staggerDone) {
      var staggerDir = new THREE.Vector3(0, 0, 1); // 默认前方
      if (ai && ai._lastHitDir) staggerDir.copy(ai._lastHitDir);
      CORE.triggerStagger(ctx, staggerDir, ai && ai._lastHitForce ? ai._lastHitForce : 0.5);
    }

    // 空闲/卡住检测 (玩家操控跳过: 玩家明确按WASD就是要走, 不该被卡住检测强制idle)
    if (!ai.isPlayer) {
      if (bodySpeed < 0.03 && bodyTurnSpeed < 0.05) {
        ctx._slowFrames = (ctx._slowFrames || 0) + 1;
      } else {
        ctx._slowFrames = 0;
      }
      var movingReqs = [
        'move_forward',
        'move_backward',
        'strafe_left',
        'strafe_right',
        'strafe_run_left',
        'strafe_run_right',
        'turn_left',
        'turn_right',
      ];
      if (ctx._slowFrames >= 6 && movingReqs.indexOf(animRequest) >= 0) {
        animRequest = 'idle';
      }
    }

    // 踉跄进行中: 强制停转+停射+散热
    if (ctx._staggerActive) {
      CORE._staggerUpdate(ctx, dt);
      if (ai) {
        ai.spinUp = Math.max(0, (ai.spinUp || 0) - dt * 3); // 快速衰减停转
        ai.gatlingRequest = false;
        ai.missileRequest = false;
        ai.heat = Math.max(0, (ai.heat || 0) - 18 * dt); // 强制散热
      }
      CORE.updateGatlingSpin(ctx._barrelClusters, dt, 0); // 枪管停转
      return;
    }

    // 死亡进行中
    if (ctx._deathActive) {
      CORE._deathUpdate(ctx, dt);
      CORE.updateGatlingSpin(ctx._barrelClusters, dt, 0);
      return;
    }

    var animIndex = _animRequestToIndex(animRequest, ctx, ai);
    var dir = CFG.animField(animIndex, 2);
    var cfgTurnRate = CFG.animField(animIndex, 3);
    var isIdle = !ctx._isPlayer && dir === 0 && cfgTurnRate === 0; // 玩家始终stepGait: 步进转向需持续追视角, 鼠标停后身体仍要转到位(不受idle打断)

    // 动画切换检测 (玩家模式跳过: 步进转向腿状态自主连续, 来回转鼠标时 turn_l↔turn_r
    // 频繁切换, 若每次 resetPose 会清步进计时器+腿姿态, 致静止转向永远启动不了)
    if (ctx._lastAnimIndex !== undefined && ctx._lastAnimIndex !== animIndex && !ctx._isPlayer) {
      CORE.resetPose(ctx);
    }
    ctx._lastAnimIndex = animIndex;
    ctx._curAnimIndex = animIndex;

    if (!isIdle) {
      if (!ctx._gaitInit) CORE._initGait(ctx);
      // 游戏模式: AI 期望速度 → stepGait 内部应用, 保证步态与位移同步
      var dm = null;
      if (ai && (ai._desiredVelX !== undefined || ai._desiredVelZ !== undefined)) {
        dm = { dx: (ai._desiredVelX || 0) * dt, dz: (ai._desiredVelZ || 0) * dt };
      }
      CORE.stepGait(ctx, dt, {
        animIndex: animIndex,
        bodySpeed: bodySpeed,
        desiredMove: dm,
        targetYaw: ai && ai._targetYaw !== undefined ? ai._targetYaw : undefined,
      });
    } else {
      CORE.stepIdle(ctx, dt);
    }

    // 加特林（过热停转）
    var spinRPS = 0;
    if (ai && !ai._overheated && ai.spinUp !== undefined) spinRPS = (ai.spinUp || 0) * 30; // spinUp 0→停, 1→30RPS(满)
    CORE.updateGatlingSpin(ctx._barrelClusters, dt, spinRPS);
  }

  // ═══════════════════════════════════════════
  //  triggerStagger / triggerDeath (外部调用)
  // ═══════════════════════════════════════════
  function triggerStagger(ctx, hitWorldDir, force) {
    if (!ctx) return;
    CORE.triggerStagger(ctx, hitWorldDir, force);
  }

  function triggerDeath(ctx) {
    if (!ctx) return;
    CORE.triggerDeath(ctx, ctx._weaponRefs);
  }

  // ═══════════════════════════════════════════
  //  Public API
  // ═══════════════════════════════════════════
  return {
    init: init,
    update: update,
    triggerStagger: triggerStagger,
    triggerDeath: triggerDeath,
  };
})();
