/**
 * 六足战车敌人动画适配器 v0.58.0
 *
 * 薄封装 HexapodCore，处理 getObjectByName 引用收集 + bodyWriter=false (游戏模式)。
 * 替换旧 hexapod_enemy.js，从 ~890行 缩减到 ~150行。
 */

var HexapodEnemy = (function() {
  var THREE = window.THREE;
  var CORE = window.HexapodCore;
  var CFG = window.HexapodConfig;

  var LEG_CONFIG = CFG.LEG_CONFIG;

  // ═══════════════════════════════════════════
  //  init: getObjectByName → legRefs → core.initContext
  // ═══════════════════════════════════════════
  function init(enemyGroup) {
    var root = enemyGroup;
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

    var prefixes = LEG_CONFIG.prefixes;
    var tripodA = LEG_CONFIG.tripodA;

    var legRefs = [];
    for (var li = 0; li < prefixes.length; li++) {
      var prefix = prefixes[li];
      var hipGroup = root.getObjectByName(prefix + '腿');
      var thighPv = root.getObjectByName(prefix + '大腿_pivot');
      var shinPv  = root.getObjectByName(prefix + '小腿_pivot');
      var anklePv = root.getObjectByName(prefix + '脚踝_pivot');
      var spikeMesh = root.getObjectByName(prefix + '尖刺足');

      if (!hipGroup || !thighPv || !shinPv || !anklePv || !spikeMesh) {
        console.warn('HexapodEnemy.init: missing leg parts for ' + prefix);
        continue;
      }

      var restHip = hipGroup.rotation.z;  // game uses Z-axis hip
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
        _yLimit: (prefix.indexOf('中') >= 0) ? LEG_CONFIG.yLimitMiddle : LEG_CONFIG.yLimitFront
      });
    }

    // 收集武器引用（用于死亡垂下）
    var weaponRefs = [];
    ['左加特林', '右加特林', '左导弹巢', '右导弹巢'].forEach(function(name) {
      var wg = root.getObjectByName(name);
      var mount = root.getObjectByName(name.replace('加特林', '加特林支架').replace('导弹巢', '导弹支架'));
      if (wg && mount) {
        weaponRefs.push({
          name: name, weaponGroup: wg, mount: mount,
          isGatling: name.indexOf('加特林') >= 0
        });
      }
    });

    // 枪管簇 (createHexapod 已创建)
    var barrelClusters = root.userData._barrelClusters || [];

    // 初始化 core context (game mode: bodyWriter=false, hipAxis='z')
    var ctx = CORE.initContext(legRefs, root, {
      hipAxis: 'z',
      groundHeightFn: (typeof window.getGroundHeight === 'function') ? window.getGroundHeight : null,
      bodyWriter: false
    });

    ctx._weaponRefs = weaponRefs;
    ctx._barrelClusters = barrelClusters;

    root.userData._hexAnimState = ctx;
    return ctx;
  }

  // ═══════════════════════════════════════════
  //  AI animRequest → animIndex 映射
  // ═══════════════════════════════════════════
  function _animRequestToIndex(animRequest, ctx, ai) {
    if (animRequest === 'death') return 22;
    if (ctx._staggerActive || animRequest === 'stagger') return 21;

    switch (animRequest) {
      case 'idle':           return 0;
      case 'move_forward':   return 1;
      case 'move_backward':  return 3;
      case 'strafe_left':    return 5;
      case 'strafe_right':   return 6;
      case 'turn_left':
        return (ai && ai.state === 'engage') ? 9 : 7;  // Walk Turn L vs Static Turn L
      case 'turn_right':
        return (ai && ai.state === 'engage') ? 10 : 8;
      case 'attack':
        // 攻击时若身体在移动/旋转但动画是Idle, 自动选择合适动画
        if (ctx._curAnimIndex === 0 && ctx._prevBodyPos) {
          var bd2 = new THREE.Vector3().subVectors(ctx.root.position, ctx._prevBodyPos);
          bd2.y = 0;
          var turning = Math.abs(CORE.angleDiff(ctx._prevBodyYaw, ctx.root.rotation.y)) > 0.01;
          if (bd2.length() > 0.05 && turning) {
            ctx._curAnimIndex = 9; return 9; // Walk Turn L (绕圈)
          } else if (bd2.length() > 0.05) {
            ctx._curAnimIndex = 1; return 1; // Walk
          }
        }
        return ctx._curAnimIndex;
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
      CORE.updateGatlingSpin(ctx._barrelClusters, dt, 3);
      return;
    }

    var ai = enemy.ai;
    var animRequest = (ai && ai.animRequest) ? ai.animRequest : 'idle';

    // 身体速度估算 (从 enemy.position 读取)
    var bodySpeed = 0;
    var bodyTurnSpeed = 0;
    if (ctx._prevBodyPos) {
      var bd = new THREE.Vector3().subVectors(enemy.position, ctx._prevBodyPos);
      bd.y = 0;
      bodySpeed = bd.length() / Math.max(dt, 0.001);
      bodyTurnSpeed = Math.abs(CORE.angleDiff(ctx._prevBodyYaw, enemy.rotation.y)) / Math.max(dt, 0.001);
      ctx._totalDist = (ctx._totalDist || 0) + bd.length() + Math.abs(bodyTurnSpeed) * dt * 0.7;
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

    // 空闲/卡住检测
    if (bodySpeed < 0.03 && bodyTurnSpeed < 0.05) {
      ctx._slowFrames = (ctx._slowFrames || 0) + 1;
    } else {
      ctx._slowFrames = 0;
    }
    var movingReqs = ['move_forward', 'move_backward', 'strafe_left', 'strafe_right', 'turn_left', 'turn_right'];
    if (ctx._slowFrames >= 6 && movingReqs.indexOf(animRequest) >= 0) {
      animRequest = 'idle';
    }

    // 踉跄进行中
    if (ctx._staggerActive) {
      CORE._staggerUpdate(ctx, dt);
      // 加特林 spin 跟随 AI
      var spinRPS2 = 3;
      if (ai && ai.spinUp !== undefined) spinRPS2 = 3 + ai.spinUp * 27;
      CORE.updateGatlingSpin(ctx._barrelClusters, dt, spinRPS2);
      return;
    }

    // 死亡进行中
    if (ctx._deathActive) {
      CORE._deathUpdate(ctx, dt);
      CORE.updateGatlingSpin(ctx._barrelClusters, dt, 3);
      return;
    }

    var animIndex = _animRequestToIndex(animRequest, ctx, ai);
    var dir = CFG.animField(animIndex, 2);
    var cfgTurnRate = CFG.animField(animIndex, 3);
    var isIdle = (dir === 0 && cfgTurnRate === 0);

    // 动画切换检测
    if (ctx._lastAnimIndex !== undefined && ctx._lastAnimIndex !== animIndex) {
      CORE.resetPose(ctx);
    }
    ctx._lastAnimIndex = animIndex;
    ctx._curAnimIndex = animIndex;

    if (!isIdle) {
      if (!ctx._gaitInit) CORE._initGait(ctx);
      CORE.stepGait(ctx, dt, { animIndex: animIndex, bodySpeed: bodySpeed });
    } else {
      CORE.stepIdle(ctx, dt);
    }

    // 加特林
    var spinRPS = 3;
    if (ai && ai.spinUp !== undefined) spinRPS = 3 + ai.spinUp * 27;
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
    triggerDeath: triggerDeath
  };
})();
