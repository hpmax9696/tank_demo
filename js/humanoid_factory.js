// js/humanoid_factory.js
// 工厂展台人形动画桥接 —— 自包含（工厂页不加载 enemies.js，故自带关键帧 + lerp + rest 偏移）
// 关键帧镜像 models/enemies.js:createHumanoidAnimationSystem（Idle/Walk/Run/Attack/Stagger/Die）
// 暴露 window.HumanoidAnims，接口与 window.HexapodAnims 同构（外加 categories）
(function () {
  var M = window;

  // ── 动画名表（与 enemies.js createHumanoidAnimationSystem 的 define 顺序一致）──
  var _names = [
    '1/6 待机 (Idle)',
    '2/6 步行 (Walk)',
    '3/6 奔跑 (Run)',
    '4/6 攻击 (Attack)',
    '5/6 受击 (Stagger)',
    '6/6 死亡 (Die)',
  ];
  var _durations = [2000, 1400, 800, 1000, 500, 1500]; // ms
  var _keys = ['Idle', 'Walk', 'Run', 'Attack', 'Stagger', 'Die'];
  var _categories = [
    { label: '── 待机 ──', at: 0 },
    { label: '── 移动 ──', at: 1 },
    { label: '── 攻击 ──', at: 3 },
    { label: '── 受击 ──', at: 4 },
    { label: '── 死亡 ──', at: 5 },
  ];

  // ── 运行时状态 ──
  var _root = null,
    _P = {},
    _O = {},
    _rest = {},
    _animDefs = null;
  var _curKey = null,
    _t = 0,
    _loop = true;

  // ── 6 动作关键帧定义（collectRefs 绑定 target 后构建）──
  // 结构与 enemies.js 一致：{target, prop, axis, restKey, keys:[{t,v}]}
  // restKey 命中 REST_POSES 时，v 作偏移量叠加到 rest 基线（与 AnimationSystem._updateLayer 同逻辑）
  function _buildAnimDefs(P, O) {
    return {
      Idle: [
        {
          target: P.torso,
          prop: 'rotation',
          axis: 'z',
          restKey: null,
          keys: [
            { t: 0, v: 0 },
            { t: 0.5, v: 0.03 },
            { t: 1, v: 0 },
          ],
        },
        {
          target: O.pelvis,
          prop: 'position',
          axis: 'y',
          restKey: 'pelvis:y',
          keys: [
            { t: 0, v: 0 },
            { t: 0.5, v: 0.02 },
            { t: 1, v: 0 },
          ],
        },
        {
          target: P.head,
          prop: 'rotation',
          axis: 'z',
          restKey: 'head:z',
          keys: [
            { t: 0, v: 0 },
            { t: 0.5, v: -0.04 },
            { t: 1, v: 0 },
          ],
        },
      ],
      Walk: [
        {
          target: O.pelvis,
          prop: 'position',
          axis: 'y',
          restKey: 'pelvis:y',
          keys: [
            { t: 0, v: 0 },
            { t: 0.5, v: 0.04 },
            { t: 1, v: 0 },
          ],
        },
        {
          target: P.l_upper_leg,
          prop: 'rotation',
          axis: 'x',
          restKey: null,
          keys: [
            { t: 0, v: 0.6 },
            { t: 0.25, v: 0 },
            { t: 0.5, v: -0.25 },
            { t: 0.75, v: 0 },
            { t: 1, v: 0.6 },
          ],
        },
        {
          target: P.r_upper_leg,
          prop: 'rotation',
          axis: 'x',
          restKey: null,
          keys: [
            { t: 0, v: -0.25 },
            { t: 0.25, v: 0 },
            { t: 0.5, v: 0.6 },
            { t: 0.75, v: 0 },
            { t: 1, v: -0.25 },
          ],
        },
        {
          target: P.l_lower_leg,
          prop: 'rotation',
          axis: 'x',
          restKey: null,
          keys: [
            { t: 0, v: 0 },
            { t: 0.25, v: -0.3 },
            { t: 0.5, v: -0.6 },
            { t: 0.75, v: -0.3 },
            { t: 1, v: 0 },
          ],
        },
        {
          target: P.r_lower_leg,
          prop: 'rotation',
          axis: 'x',
          restKey: null,
          keys: [
            { t: 0, v: -0.6 },
            { t: 0.25, v: -0.3 },
            { t: 0.5, v: 0 },
            { t: 0.75, v: -0.3 },
            { t: 1, v: -0.6 },
          ],
        },
        {
          target: P.l_upper_arm,
          prop: 'rotation',
          axis: 'x',
          restKey: null,
          keys: [
            { t: 0, v: -0.35 },
            { t: 0.25, v: -0.1 },
            { t: 0.5, v: 0.35 },
            { t: 0.75, v: -0.1 },
            { t: 1, v: -0.35 },
          ],
        },
        {
          target: P.r_upper_arm,
          prop: 'rotation',
          axis: 'x',
          restKey: null,
          keys: [
            { t: 0, v: 0.35 },
            { t: 0.25, v: 0.1 },
            { t: 0.5, v: -0.35 },
            { t: 0.75, v: 0.1 },
            { t: 1, v: 0.35 },
          ],
        },
      ],
      Run: [
        {
          target: P.torso,
          prop: 'rotation',
          axis: 'x',
          restKey: null,
          keys: [
            { t: 0, v: 0.3 },
            { t: 0.5, v: 0.15 },
            { t: 1, v: 0.3 },
          ],
        },
        {
          target: O.pelvis,
          prop: 'position',
          axis: 'y',
          restKey: 'pelvis:y',
          keys: [
            { t: 0, v: 0 },
            { t: 0.5, v: 0.08 },
            { t: 1, v: 0 },
          ],
        },
        {
          target: P.l_upper_leg,
          prop: 'rotation',
          axis: 'x',
          restKey: null,
          keys: [
            { t: 0, v: 0.8 },
            { t: 0.25, v: 0 },
            { t: 0.5, v: -0.35 },
            { t: 0.75, v: 0 },
            { t: 1, v: 0.8 },
          ],
        },
        {
          target: P.r_upper_leg,
          prop: 'rotation',
          axis: 'x',
          restKey: null,
          keys: [
            { t: 0, v: -0.35 },
            { t: 0.25, v: 0 },
            { t: 0.5, v: 0.8 },
            { t: 0.75, v: 0 },
            { t: 1, v: -0.35 },
          ],
        },
        {
          target: P.l_lower_leg,
          prop: 'rotation',
          axis: 'x',
          restKey: null,
          keys: [
            { t: 0, v: 0 },
            { t: 0.25, v: -0.4 },
            { t: 0.5, v: -0.7 },
            { t: 0.75, v: -0.4 },
            { t: 1, v: 0 },
          ],
        },
        {
          target: P.r_lower_leg,
          prop: 'rotation',
          axis: 'x',
          restKey: null,
          keys: [
            { t: 0, v: -0.7 },
            { t: 0.25, v: -0.4 },
            { t: 0.5, v: 0 },
            { t: 0.75, v: -0.4 },
            { t: 1, v: -0.7 },
          ],
        },
        {
          target: P.l_upper_arm,
          prop: 'rotation',
          axis: 'x',
          restKey: null,
          keys: [
            { t: 0, v: -0.5 },
            { t: 0.25, v: -0.15 },
            { t: 0.5, v: 0.5 },
            { t: 0.75, v: -0.15 },
            { t: 1, v: -0.5 },
          ],
        },
        {
          target: P.r_upper_arm,
          prop: 'rotation',
          axis: 'x',
          restKey: null,
          keys: [
            { t: 0, v: 0.5 },
            { t: 0.25, v: 0.15 },
            { t: 0.5, v: -0.5 },
            { t: 0.75, v: 0.15 },
            { t: 1, v: 0.5 },
          ],
        },
      ],
      Attack: [
        {
          target: P.r_upper_arm,
          prop: 'rotation',
          axis: 'x',
          restKey: null,
          keys: [
            { t: 0, v: -0.4 },
            { t: 0.35, v: -1.8 },
            { t: 1, v: -0.4 },
          ],
        },
        {
          target: P.r_forearm,
          prop: 'rotation',
          axis: 'x',
          restKey: null,
          keys: [
            { t: 0, v: -1.6 },
            { t: 0.35, v: -0.1 },
            { t: 1, v: -1.6 },
          ],
        },
        {
          target: P.torso,
          prop: 'rotation',
          axis: 'x',
          restKey: null,
          keys: [
            { t: 0, v: 0 },
            { t: 0.3, v: 0.25 },
            { t: 1, v: 0 },
          ],
        },
      ],
      Stagger: [
        {
          target: P.torso,
          prop: 'rotation',
          axis: 'x',
          restKey: null,
          keys: [
            { t: 0, v: 0 },
            { t: 0.2, v: -0.3 },
            { t: 1, v: 0 },
          ],
        },
        {
          target: P.head,
          prop: 'rotation',
          axis: 'x',
          restKey: null,
          keys: [
            { t: 0, v: 0 },
            { t: 0.15, v: -0.4 },
            { t: 1, v: 0 },
          ],
        },
      ],
      Die: [
        {
          target: P.root,
          prop: 'rotation',
          axis: 'x',
          restKey: null,
          keys: [
            { t: 0, v: 0 },
            { t: 0.333, v: Math.PI * 0.48 },
            { t: 1, v: Math.PI * 0.5 },
          ],
        },
        {
          target: O.root,
          prop: 'position',
          axis: 'y',
          restKey: null,
          keys: [
            { t: 0, v: 0 },
            { t: 0.333, v: -0.15 },
            { t: 0.667, v: -0.45 },
            { t: 1, v: -0.45 },
          ],
        },
        {
          target: P.torso,
          prop: 'rotation',
          axis: 'x',
          restKey: null,
          keys: [
            { t: 0, v: 0 },
            { t: 0.333, v: -0.15 },
            { t: 1, v: -0.35 },
          ],
        },
        {
          target: P.l_upper_arm,
          prop: 'rotation',
          axis: 'z',
          restKey: 'l_upper_arm:z',
          keys: [
            { t: 0, v: 0 },
            { t: 0.667, v: -0.6 },
            { t: 1, v: -0.8 },
          ],
        },
        {
          target: P.r_upper_arm,
          prop: 'rotation',
          axis: 'z',
          restKey: 'r_upper_arm:z',
          keys: [
            { t: 0, v: 0 },
            { t: 0.667, v: 0.6 },
            { t: 1, v: 0.8 },
          ],
        },
      ],
    };
  }

  // ── keyframe lerp + rest 偏移（镜像 AnimationSystem._updateLayer）──
  function _applyTrack(td, t) {
    if (!td.target) return;
    var keys = td.keys;
    var val;
    if (t <= keys[0].t) val = keys[0].v;
    else if (t >= keys[keys.length - 1].t) val = keys[keys.length - 1].v;
    else {
      for (var i = 1; i < keys.length; i++) {
        if (t <= keys[i].t) {
          var k0 = keys[i - 1],
            k1 = keys[i];
          val = k0.v + (k1.v - k0.v) * ((t - k0.t) / (k1.t - k0.t));
          break;
        }
      }
    }
    if (val !== undefined) {
      if (td.restKey && _rest[td.restKey] !== undefined) val = _rest[td.restKey] + val;
      if (td.axis) td.target[td.prop][td.axis] = val;
      else td.target[td.prop] = val;
    }
  }

  // ── HexapodAnims 同构接口 ──
  function collectRefs() {
    var cfg = M.HumanoidConfig;
    if (!cfg) {
      console.warn('HumanoidAnims: HumanoidConfig 未就绪');
      return;
    }
    _root = M.modelRoot ? M.modelRoot.getObjectByName('root') || M.modelRoot : null;
    if (!_root) {
      console.warn('HumanoidAnims: modelRoot/root 未找到');
      return;
    }
    _rest = cfg.REST_POSES || {};
    _P = {};
    _O = {};
    cfg.JOINT_NAMES.forEach(function (n) {
      _P[n] = _root.getObjectByName(n + '_pivot');
      _O[n] = _root.getObjectByName(n);
    });
    _O.root = _root.getObjectByName('root') || _root;
    _P.root = _O.root;
    _animDefs = _buildAnimDefs(_P, _O);
    if (!_P.torso)
      console.warn('HumanoidAnims: torso_pivot 未找到（buildFromConfig 未生成 pivot?）');
    _curKey = 'Idle';
    _t = 0;
    _loop = true;
  }

  function updateFrame(dt, t, elapsed, duration, animIndex) {
    if (!_animDefs || !_curKey) return;
    var idx = animIndex != null ? animIndex : 0;
    var key = _keys[idx] || 'Idle';
    if (key !== _curKey) {
      _curKey = key;
      _t = 0;
      _loop = key !== 'Die'; // Die 不循环，播完定格
    }
    var dur = (_durations[idx] || 1000) / 1000; // 秒
    _t += dt / dur;
    if (_loop) _t = _t % 1.0;
    else _t = Math.min(_t, 1.0);
    var defs = _animDefs[key] || [];
    for (var i = 0; i < defs.length; i++) _applyTrack(defs[i], _t);
  }

  function resetState() {
    if (!_root) return;
    _curKey = 'Idle';
    _t = 0;
    _loop = true;
    _root.rotation.set(0, 0, 0); // Die 改了 root.rotation，复位
    // 全关节复位到 REST 基线：Die 等动画改过的关节（torso x / arm z 等）在 Idle 无对应 track，
    // 不复位会残留变形（用户观察"死亡后播放其他动画变形"）
    Object.keys(_P).forEach(function (n) {
      var pv = _P[n];
      if (pv && pv !== _root) {
        pv.rotation.set(0, 0, 0);
        var rx = _rest[n + ':x'],
          ry = _rest[n + ':y'],
          rz = _rest[n + ':z'];
        if (rx !== undefined) pv.rotation.x = rx;
        if (ry !== undefined) pv.rotation.y = ry;
        if (rz !== undefined) pv.rotation.z = rz;
      }
    });
    collectRefs(); // 重新抓 ref（collectRefs 内 _curKey='Idle'）
  }

  function destroyPivots() {
    _root = null;
    _P = {};
    _O = {};
    _animDefs = null;
    _curKey = null;
    _t = 0;
  }

  M.HumanoidAnims = {
    names: _names,
    durations: _durations,
    directions: [],
    turnRates: [],
    categories: _categories,
    collectRefs: collectRefs,
    updateFrame: updateFrame,
    resetState: resetState,
    destroyPivots: destroyPivots,
    restorePlates: function () {},
  };
  console.log('🧑 humanoid_factory 已就绪 | 动画数:', _names.length);
})();
