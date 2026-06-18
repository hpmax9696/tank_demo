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

  var WALK_SPEED = 2.5;   // 走速 (手柄低力度 <0.7)
  var RUN_SPEED = 5.0;    // 跑速 (键盘满力度 / 手柄高力度 ≥0.7)

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
        _root.rotation.y = Math.PI - _yaw;   // 车头朝 _yaw(视线); 后续由 stepGait 步态驱动转向

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

        // ── 1. WASD/摇杆 → animRequest (主轴法, 前/后优先) ──
        //    键盘满力度(=1)或手柄高力度(≥0.7)→ 跑(run步态); 手柄低力度(<0.7)→ 走(walk步态)
        var fwdKey = frozen ? 0 : (input.forward || 0);
        var strKey = frozen ? 0 : (input.strafe || 0);
        var _maxAbs = Math.max(Math.abs(fwdKey), Math.abs(strKey));
        var _isRun = _maxAbs >= 0.7;
        var req = 'idle';
        if (fwdKey > 0.1) req = _isRun ? 'move_forward_run' : 'move_forward';
        else if (fwdKey < -0.1) req = _isRun ? 'move_backward_run' : 'move_backward';
        else if (strKey > 0.1) req = _isRun ? 'strafe_run_right' : 'strafe_right';
        else if (strKey < -0.1) req = _isRun ? 'strafe_run_left' : 'strafe_left';
        _ai.animRequest = req;

        // ── 2. 转向 + 期望速度 (步进式转向, 视角自由跟鼠标) ──
        //    视角=鼠标(cameraYaw)即时自由; 身体朝向由 stepGait 步进慢追(笨重, 腿蹬地转)。
        //    移动按视角(W=鼠标看的方向); 转向中身体朝向滞后视角, 腿先迈向新方向引导转身。
        var _prevYaw = _yaw;
        if (input.cameraYaw !== undefined && !isNaN(input.cameraYaw)) _yaw = input.cameraYaw;
        var _dyaw = window.HexapodCore.angleDiff(_prevYaw, _yaw);
        var _turnSign = (_dyaw > 0.0005) ? 1 : (_dyaw < -0.0005 ? -1 : 0);
        _ai._targetYaw = Math.PI - _yaw;  // 身体步进追此目标(腿蹬地转向)
        // 移动按视角(鼠标看的方向): W=视线前, D=视线右
        var fX = Math.cos(_yaw), fZ = Math.sin(_yaw);
        var rX = -Math.sin(_yaw), rZ = Math.cos(_yaw);
        var _spd = _isRun ? RUN_SPEED : WALK_SPEED;
        _ai._desiredVelX = (fX * fwdKey + rX * strKey) * _spd;
        _ai._desiredVelZ = (fZ * fwdKey + rZ * strKey) * _spd;
        // 静止转向: 无WASD但鼠标在转 → turn步态(腿蹬地原地转)
        if (Math.abs(fwdKey) < 0.1 && Math.abs(strKey) < 0.1 && _turnSign !== 0) {
          _ai.animRequest = (_turnSign > 0) ? 'turn_right' : 'turn_left';
        }

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

        // ── 7. 同步血条壳 (yaw = 身体实际车头, 非视角目标) ──
        if (_p1) {
          _p1.state.x = nx; _p1.state.z = nz; _p1.state.yaw = _root ? (Math.PI - _root.rotation.y) : _yaw;
        }
      },

      getPose: function () {
        // yaw = 身体实际车头朝向(stepGait 步态步进式驱动, 慢追 _yaw 视角目标)
        return { x: _pos.x, z: _pos.z, yaw: _root ? (Math.PI - _root.rotation.y) : _yaw };
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
          _ctx._isPlayer = true;   // 修复: init 返回新 ctx, 必须重设, 否则玩家步态分支失效
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
