/**
 * PlayerControllerManager — 模块化玩家角色控制器调度层 v0.1
 *
 * 用途: 把"玩家操控什么角色"做成可插拔模块。坦克走 engine.js 原 gameLoop 路径
 *       (特权默认角色, isActive()=false 透传); 其他角色(六足/丧尸/...)实现控制器
 *       并 register() 后, 由本调度器在 gameLoop 中分发 update。
 *
 * 接口契约 (控制器 factory(spawnCtx) 返回的对象):
 *   核心 4 方法 (必须):
 *     type: string                       角色类型 id, 唯一 ('hexapod'/'zombie'...)
 *     onSpawn(spawnCtx)                  创建/复位3D模型、定位、绑 player1.group
 *     update(dt, input)                  每帧: 输入→物理→动画→位移; input={left,right,forward,strafe}
 *     getPose() → {x,z,yaw}              世界位置+朝向, 供 placeCamera/碰撞/复活
 *     dispose()                          销毁模型、清理资源
 *   可选能力钩子 (typeof 探测):
 *     getGroup() → Object3D             根节点 (placeCamera 第三人称位置来源)
 *     canSniper() → bool                是否支持狙击模式 (六足 false)
 *     handleWeapons?(dt)                 开炮/MG (六足不实现 → hasWeapons()=false)
 *     onRespawn?()                       复活钩子 (六足重建 CCD ctx)
 *     onHit?(dmg, hitDir)                受击反馈
 *
 * 调度契约: isActive()=false 时 gameLoop 完全走原坦克代码 (零改动); =true 时
 *           gameLoop 跳过坦克物理块, 转而调 update()。坦克是"特权默认角色"。
 */
var PlayerControllerManager = (function () {
  'use strict';

  // type → factory(spawnCtx) → controller instance
  var _registry = {};
  // 当前激活的控制器实例 (null = 坦克默认路径)
  var _active = null;

  function register(type, factory) {
    if (_registry[type]) console.warn('[PCM] 重复注册角色: ' + type);
    _registry[type] = factory;
  }

  function isRegistered(type) {
    return !!_registry[type];
  }

  // 进入模式时调用 (engine.js enterTrainingMode)
  // type='tank' 或未注册 → _active=null (走原 gameLoop)
  // 否则 → factory + onSpawn
  function activate(type, spawnCtx) {
    deactivate();
    if (type === 'tank' || type === undefined || type === null || !_registry[type]) {
      _active = null;
      return null;
    }
    var factory = _registry[type];
    _active = factory(spawnCtx);
    if (_active && typeof _active.onSpawn === 'function') _active.onSpawn(spawnCtx);
    return _active;
  }

  function deactivate() {
    if (_active) {
      if (typeof _active.dispose === 'function') _active.dispose();
      _active = null;
    }
  }

  function getActive() {
    return _active;
  }
  function isActive() {
    return _active !== null;
  }

  // gameLoop 每帧调用: _active 存在则跑控制器并返回 true (公共层据此跳过坦克物理)
  function update(dt, input) {
    if (!_active) return false;
    _active.update(dt, input);
    return true;
  }

  // 公共层访问位置的唯一口子 (placeCamera/碰撞/开炮基准)
  // null → 公共层回退到全局 tankGroup.position
  function getPose() {
    if (!_active || typeof _active.getPose !== 'function') return null;
    return _active.getPose();
  }

  function getGroup() {
    if (!_active || typeof _active.getGroup !== 'function') return null;
    return _active.getGroup();
  }

  function hasWeapons() {
    return !!(_active && typeof _active.handleWeapons === 'function');
  }

  function hasAimLine() {
    return !!(_active && typeof _active.getWeaponAimData === 'function');
  }

  function canSniper() {
    return !!(_active && typeof _active.canSniper === 'function' && _active.canSniper());
  }

  function isAiDriven() {
    return !!(_active && typeof _active.isAiDriven === 'function' && _active.isAiDriven());
  }

  return {
    register: register,
    isRegistered: isRegistered,
    activate: activate,
    deactivate: deactivate,
    getActive: getActive,
    isActive: isActive,
    update: update,
    getPose: getPose,
    getGroup: getGroup,
    hasWeapons: hasWeapons,
    hasAimLine: hasAimLine,
    canSniper: canSniper,
    isAiDriven: isAiDriven,
  };
})();
window.PlayerControllerManager = PlayerControllerManager;
