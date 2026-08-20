// js/humanoid_factory.js
// 工厂展台人形动画桥接 —— 自包含（工厂页不加载 enemies.js，故自带关键帧 + lerp + rest 偏移）
// 动画配置自 humanoid_config BASE_ANIMS/版本 anims/变体 zombieAnims（v0.79.11+ 数据驱动）
// 动画表动态适配配置 actions 键（v0.79.24：丧尸变体 6 动画无 Punch，骨架 7 动画全量）
// 暴露 window.HumanoidAnims，接口与 window.HexapodAnims 同构（外加 categories）
(function () {
  var M = window;

  // ── 动画键序/名称/默认时长（按配置实际存在的键生成列表）──
  var ANIM_ORDER = ['Idle', 'Walk', 'Run', 'Swing', 'Punch', 'Stagger', 'Die'];
  var NAME_MAP = { Idle: '待机', Walk: '步行', Run: '奔跑', Swing: '挥击', Punch: '拳击', Stagger: '受击', Die: '死亡' };
  var DUR_DEFAULT_S = { Idle: 2.0, Walk: 1.4, Run: 0.8, Swing: 1.0, Punch: 1.0, Stagger: 0.5, Die: 1.5 };
  var CAT_OF = { Idle: '待机', Walk: '移动', Run: '移动', Swing: '攻击', Punch: '攻击', Stagger: '受击', Die: '死亡' };

  var _names = [];
  var _durations = [];
  var _keys = [];
  var _categories = [];

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
  function _buildAnimDefs(actions, P, O) {
    var defs = {};
    Object.keys(actions || {}).forEach(function (name) {
      defs[name] = (actions[name] || []).map(function (t) {
        return {
          target: t.kind === 'P' ? P[t.joint] : O[t.joint],
          prop: t.prop,
          axis: t.axis,
          restKey: t.restKey || null,
          keys: t.keys,
        };
      });
    });
    return defs;
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

  // 旋转类 rest 的 y 轴读取：'pelvis:y' 是 position rest 键（骨盆高度），不能当 rotation.y 应用
  // （否则骨盆被扭转 → 死亡躺姿侧倾、只有单肩单脚着地的根源）
  function _rotRestY(n) {
    return n === 'pelvis' ? undefined : _rest[n + ':y'];
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
    // 动画配置：优先 model_factory 注入的当前骨架/变体 anims；兜底 BASE_ANIMS
    var animsCfg = M._currentHumanoidAnims || cfg.BASE_ANIMS;
    _rest = (animsCfg && animsCfg.restPoses) || cfg.REST_POSES || {};
    _P = {};
    _O = {};
    cfg.JOINT_NAMES.forEach(function (n) {
      _P[n] = _root.getObjectByName(n + '_pivot');
      _O[n] = _root.getObjectByName(n);
    });
    _O.root = _root.getObjectByName('root') || _root;
    _P.root = _O.root;
    // 扩展：收集动画轨道涉及的非 JOINT_NAMES 关节（裙摆/武器/特效 addon 节点）
    // v0.79.37b: 记录收集时初始 scale——复位恢复初始值（火焰 _fx 节点默认 0.001 隐藏，
    // 旧逻辑无条件 scale.y=1 会把火焰复成可见细条）
    var _cfgActs = animsCfg && animsCfg.actions;
    var _extJoints = {};
    var _extScale0 = {};
    Object.keys(_cfgActs || {}).forEach(function (an) {
      (_cfgActs[an] || []).forEach(function (t) {
        if (!_P[t.joint] && !_O[t.joint]) {
          var o = _root.getObjectByName(t.joint);
          if (o) {
            _O[t.joint] = o;
            _extJoints[t.joint] = true;
            _extScale0[t.joint] = o.scale ? [o.scale.x, o.scale.y, o.scale.z] : null;
          }
        }
      });
    });
    _animDefs = _buildAnimDefs(animsCfg && animsCfg.actions, _P, _O);
    // 动态动画表：按配置 actions 实际存在的键生成（丧尸 6 项 / 骨架 7 项）——原地更新保持引用
    var cfgDur = (animsCfg && animsCfg.durations) || {};
    var newNames = [];
    var newKeys = [];
    var newDurs = [];
    var newCats = [];
    var lastCat = null;
    ANIM_ORDER.forEach(function (k) {
      if (!(animsCfg && animsCfg.actions && animsCfg.actions[k])) return;
      var idx = newKeys.length;
      var durS = cfgDur[k] || DUR_DEFAULT_S[k] || 1.0;
      newKeys.push(k);
      newNames.push(NAME_MAP[k] + ' (' + k + ')');
      newDurs.push(Math.round(durS * 1000));
      var cat = CAT_OF[k];
      if (cat !== lastCat) {
        newCats.push({ label: '── ' + cat + ' ──', at: idx });
        lastCat = cat;
      }
    });
    var total = newKeys.length;
    _names.length = 0;
    _keys.length = 0;
    _durations.length = 0;
    _categories.length = 0;
    newNames.forEach(function (n, i) {
      _names.push(i + 1 + '/' + total + ' ' + n);
      _keys.push(newKeys[i]);
      _durations.push(newDurs[i]);
    });
    newCats.forEach(function (c) { _categories.push(c); });
    // 动画开始前把全关节复位到 rest 基线（手臂 z 外张等），保证动画姿势与固定状态一致（修"胳膊内夹"）
    // 同时复位 pelvis 的 position.y 到该骨架基线（修"切换动画残留偏移导致身体歪斜"）
    if (_O.pelvis && _rest['pelvis:y'] !== undefined) {
      _O.pelvis.position.y = _rest['pelvis:y'];
    }
    Object.keys(_P).forEach(function (n) {
      var pv = _P[n];
      if (pv && pv !== _root) {
        pv.rotation.set(0, 0, 0);
        var rx = _rest[n + ':x'],
          ry = _rotRestY(n),
          rz = _rest[n + ':z'];
        if (rx !== undefined) pv.rotation.x = rx;
        if (ry !== undefined) pv.rotation.y = ry;
        if (rz !== undefined) pv.rotation.z = rz;
      }
    });
    // 无 pivot 的关节（torso 等，动画直接转原对象）：同样应用 rest rotation 基线
    Object.keys(_O).forEach(function (n) {
      var ov = _O[n];
      if (ov && !_P[n] && ov !== _root) {
        ov.rotation.set(0, 0, 0);
        var rx = _rest[n + ':x'],
          ry = _rotRestY(n),
          rz = _rest[n + ':z'];
        if (rx !== undefined) ov.rotation.x = rx;
        if (ry !== undefined) ov.rotation.y = ry;
        if (rz !== undefined) ov.rotation.z = rz;
        // 扩展关节（裙/武器/特效）复位：恢复收集时初始 scale（火焰归隐 0.001；武器/裙回 1）
        // position.y 不清零——裙挂载位被清会"上移一截"（v0.79.29）
        if (_extJoints[n]) {
          var _s0 = _extScale0[n];
          if (_s0) ov.scale.set(_s0[0], _s0[1], _s0[2]);
          else if (ov.scale) ov.scale.y = 1;
        }
      }
    });
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
          ry = _rotRestY(n),
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
