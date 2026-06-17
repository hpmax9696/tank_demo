/**
 * HexapodPlayerController — 六足玩家控制器 v0.1
 *
 * 第一个基于 PlayerControllerManager 的可插拔玩家角色。用 WASD+鼠标操控六足,
 * 用于训练场精确测量 bodyWriter=false 模式的步态姿态。
 *
 * 复用 HexapodEnemy.init/update 的全部 CCD IK 步态管线 — 与游戏敌人同路径,
 * 保证步态可对比。仅 ai 字段改由玩家输入填充 (而非 EnemyAI)。
 *
 * 操控:
 *   W/S 前进/后退 (animIndex 1/3, 走步态)
 *   A/D 左右平移 (animIndex 5/6)
 *   鼠标左右 → 六足朝向 (hex.rotation.y = cameraYaw, 与坦克"鼠标转视角"不同)
 *   无武器 (turretPivot 置 null, canSniper=false)
 */
var HexapodPlayerController = (function () {
'use strict';

  var WALK_SPEED = 2.5;   // 玩家六足行走速度 (测量用, 与敌人 cfg.speed 量级一致)

  function create(spawnCtx) {
    // spawnCtx: { scene, getGroundHeight, position:{x,z}, yaw }

    var _root = null;     // 六足根 Object3D
    var _ai = null;       // 喂给 HexapodEnemy.update 的 ai 对象
    var _ctx = null;      // CCD IK context (HexapodEnemy.init 返回)

    var _pos = { x: spawnCtx.position.x, z: spawnCtx.position.z };
    var _yaw = spawnCtx.yaw;
    var _gh = spawnCtx.getGroundHeight;
    var _scene = spawnCtx.scene;
    var _p1 = spawnCtx.player1 || null;   // player1 引用 (engine.js 经 spawnCtx 传入, 非 window)

    function _clampToWorld(x, z) {
      var p1 = window.player1;
      var HW = (typeof window.playHalfW !== 'undefined') ? window.playHalfW : 100;
      var HD = (typeof window.playHalfD !== 'undefined') ? window.playHalfD : 100;
      var margin = 2.0;   // 留腿空间
      x = Math.max(-HW + margin, Math.min(HW - margin, x));
      z = Math.max(-HD + margin, Math.min(HD - margin, z));
      return { x: x, z: z };
    }

    var ctrl = {
      type: 'hexapod',

      // ════════════════════════════════════════
      //  核心 4 方法
      // ════════════════════════════════════════
      onSpawn: function (ctx) {
        // 1. 创建六足模型 (程序化, 复用敌人模型工厂, 含 _baseY/_barrelClusters/_legJoints)
        _root = window.EnemyModels.createHexapod();
        if (!_root) { console.error('[HexPlayer] createHexapod 失败'); return; }
        _root.rotation.order = 'YXZ';

        // 2. 先定位到地面 + 朝向 (对齐敌人 enterTrainingMode: position.set(x,gy,z) 然后 init)
        //    注意: 不能加 userData._baseY (那是模板负偏移), init 内部会自动抬升并算 ctx._baseY
        var gy = _gh(_pos.x, _pos.z);
        _root.position.set(_pos.x, gy, _pos.z);
        _root.rotation.y = _yaw;

        // 3. 建 CCD context (init 内部自动抬升 root.position.y + 算 ctx._baseY, bodyWriter=false)
        _ctx = window.HexapodEnemy.init(_root);
        _ctx._isPlayer = true;   // 玩家模式: 支撑相钉脚实际落地位置(对齐工厂), 而非敌人式的 home 相对定位

        // 4. ai 对象 (HexapodEnemy.update 读取的字段)
        _ai = {
          state: 'engage',          // 非 'dead'/'stagger' 即可
          animRequest: 'idle',
          _desiredVelX: 0,
          _desiredVelZ: 0,
          spinUp: 0,
          _overheated: false,
          _missileAmmoL: 0,
          _missileAmmoR: 0,
          isPlayer: true            // 跳过卡住检测(玩家明确按WASD就是要走)
        };
        _root.ai = _ai;            // HexapodEnemy.update 通过 enemy.ai 访问

        // 5. 绑血条壳: 六足 root → player1.group, 清坦克专属引用 (用 _p1, 非 window.player1)
        var p1 = _p1;
        if (p1) {
          p1.group = _root;
          p1.state = p1.state || {};
          p1.state.x = _pos.x; p1.state.z = _pos.z; p1.state.yaw = _yaw;
          p1.turretPivot = null;
          p1.barrelPivot = null;
          p1.mgGroup = null;
          p1.leftWheels = []; p1.rightWheels = [];
          // 把全局 tankGroup 也指向六足 root (坦克模式退出后恢复, 见 enterTrainingMode 重建)
          if (typeof window.tankGroup !== 'undefined') window.tankGroup = _root;
        }

        _scene.add(_root);
      },

      update: function (dt, input) {
        if (!_root || !_ai) return;
        var frozen = (_p1 && _p1.dead);

        // ── 1. WASD → animRequest (主轴法, 前/后优先, 只要走步态 1/3/5/6) ──
        var fwdKey = frozen ? 0 : (input.forward || 0);
        var strKey = frozen ? 0 : (input.strafe || 0);
        var req = 'idle';
        if (fwdKey > 0.1) req = 'move_forward';
        else if (fwdKey < -0.1) req = 'move_backward';
        else if (strKey > 0.1) req = 'strafe_right';
        else if (strKey < -0.1) req = 'strafe_left';
        _ai.animRequest = req;

        // ── 2. 转向 + 期望速度 ──
        //    cameraYaw 由 gameLoop 经 input 传入 (engine.js 顶层 let, 不挂 window)
        if (input.cameraYaw !== undefined && !isNaN(input.cameraYaw)) _yaw = input.cameraYaw;
        // 朝向: π-cameraYaw 使 stepGait 的 fwdBody = 视线方向 (车尾朝摄像机, 看到车尾, 与坦克一致)
        _root.rotation.y = Math.PI - _yaw;
        // 期望速度 (世界系, 摄像机视线坐标系): W=视线前(屏幕里), D=视线右
        var fX = Math.cos(_yaw), fZ = Math.sin(_yaw);     // 视线前
        var rX = -Math.sin(_yaw), rZ = Math.cos(_yaw);    // 视线右
        _ai._desiredVelX = (fX * fwdKey + rX * strKey) * WALK_SPEED;
        _ai._desiredVelZ = (fZ * fwdKey + rZ * strKey) * WALK_SPEED;

        // ── 4. 复用 HexapodEnemy.update: 步态/CCD/地形/加特林spin ──
        //    内部 stepGait 的 desiredMove 会驱动 _root.position
        window.HexapodEnemy.update(_root, dt);

        // ── 5. 碰撞 + 空气墙 (复用全局 checkCollision) ──
        var nx = _root.position.x, nz = _root.position.z;
        if (typeof window.checkCollision === 'function') {
          var col = window.checkCollision(nx, nz, 0.6);
          if (col && col.hit) { nx += col.pushX; nz += col.pushZ; }
        }
        var cl = _clampToWorld(nx, nz);
        nx = cl.x; nz = cl.z;

        // ── 6. 应用碰撞钳制后的 x/z (Y 由 stepGait 内部用 ctx._baseY 维持, 不在此覆盖) ──
        _root.position.x = nx;
        _root.position.z = nz;
        _pos.x = nx; _pos.z = nz;

        // ── 7. 同步血条壳 ──
        if (_p1) {
          _p1.state.x = nx; _p1.state.z = nz; _p1.state.yaw = _yaw;
        }
      },

      getPose: function () {
        return { x: _pos.x, z: _pos.z, yaw: _yaw };
      },

      getGroup: function () { return _root; },

      // ════════════════════════════════════════
      //  可选能力钩子
      // ════════════════════════════════════════
      canSniper: function () { return false; },   // 无炮塔, 不支持狙击

      onRespawn: function () {
        // 重建 CCD IK context (与 _processTrainingRespawn 对六足敌人一致)
        if (_root && window.HexapodEnemy) {
          _ctx = window.HexapodEnemy.init(_root);
          _root.ai = _ai;
        }
        _ai.animRequest = 'idle';
        _ai._desiredVelX = 0; _ai._desiredVelZ = 0;
      },

      onHit: function (dmg, hitDir) {
        if (_ctx && hitDir && window.HexapodEnemy) {
          window.HexapodEnemy.triggerStagger(_ctx, hitDir, Math.min(1, (dmg || 10) / 40));
        }
      },

      dispose: function () {
        if (_root && _root.parent) _root.parent.remove(_root);
        _root = null; _ctx = null; _ai = null;
      }
    };

    return ctrl;
  }

  // 文件加载即注册
  if (window.PlayerControllerManager) {
    window.PlayerControllerManager.register('hexapod', create);
  } else {
    console.error('[HexPlayer] PlayerControllerManager 未加载, 无法注册');
  }

  return { create: create };
})();
window.HexapodPlayerController = HexapodPlayerController;
