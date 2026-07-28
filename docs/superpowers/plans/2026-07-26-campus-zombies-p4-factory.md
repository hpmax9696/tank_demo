# 校园 4 种丧尸 · 模型工厂接入实现计划 (P4)

> **For agentic workers:** REQUIRED SUB-SKILL: Use Superpowers:subagent-driven-development (recommended) or Superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让模型工厂（`model_factory.html`）能选择「🧟 校园丧尸」、渲染穿校服的人形、用体型滑块（身高/体型/驼背/曲线）与变体下拉实时调参、在动画展台播放 6 个动作（待机/步行/奔跑/攻击/受击/死亡）、Ctrl+S 固化变体定义回 `humanoid_config.js`——建立"设计→固化"闭环，为 P6 校服精修打基础。

**Architecture:** 新增 `js/humanoid_factory.js`（工厂展台桥接层，**自包含**——工厂页不加载 `enemies.js`，故自带 6 动作关键帧 + 轻量 keyframe lerp + `REST_POSES` 偏移，镜像 `enemies.js:createHumanoidAnimationSystem`）。`model_factory.html` 6 处接入：脚本加载 / `MODEL_CONFIGS`+下拉 / `MATERIAL_DEFS` / `getModelAnims`+`_buildAnimList` / `createGeometry` 补 Plane（硬阻塞）/ `buildGUI` 体型参数模块。`server.py` 新增嵌套对象定位 helper 支持单变体固化。

**Tech Stack:** Three.js r160、原生 JS（IIFE + window 暴露）、lil-gui、Python `http.server`、CDP + Playwright 验证。

## Global Constraints

- **零回归**：不动现有六足/坦克/虎式/建筑的工厂路径与游戏侧 `enemies.js`（人形 factory 自包含，不依赖 `EnemyModels`/`AnimationSystem`）。工厂页**不加载** `enemies.js`（已确认 `model_factory.html` 无 `enemies.js`/`ModelRegistry`/`EnemyModels` 引用）。
- **变体名约定**：`student_m / student_f / teacher_m / teacher_f`——同时是 `HUMANOID_VARIANTS` key、`MODEL_CONFIGS.humanoid` 渲染入参、固化 `variant` 字段。
- **尺度**：`METERS_PER_UNIT = 1.3`。工厂展台只做外观预览，不做游戏缩放（`createCampusZombie` 的包围盒缩放属游戏侧，工厂渲染 `buildHumanoid` 产出原样）。
- **接口同构**：`window.HumanoidAnims` 字段与 `window.HexapodAnims` 1:1 对照（`names/durations/directions/turnRates/collectRefs/updateFrame/resetState/destroyPivots/restorePlates`），外加 `categories`（动画分类标签，供 `_buildAnimList` 用）。
- **调试着色策略**：人形**不走** hexapod 那套始终调试色 + EdgesGeometry 轮廓线（人形 mesh 多，轮廓线会视觉混乱）。人形走 `MATERIAL_DEFS` 真实材质（校服/肤色纯色近似，Canvas 贴图留 P6）。`getMaterial` 的调试色分支条件**不改**。
- **验证基线**：每个 task 完成后 CDP 加载 `model_factory.html` 控制台 0 错误；最终 task 用 Playwright 端到端验证。
- **行号基准**：本 plan 行号基于当前 `model_factory.html`（~4758 行）。前置 task 的插入会使后续 task 行号下移，执行时用 Grep 按代码锚点定位（plan 给出锚点代码）。

## File Structure

| 文件                      | 责任                                                                                                                                                                          | 本 plan 改动 |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| `js/humanoid_factory.js`  | 工厂展台人形动画桥接（自包含 6 动作 + lerp + rest 偏移），暴露 `window.HumanoidAnims`                                                                                         | 新建 ~210 行 |
| `model_factory.html`      | 6 处接入：脚本加载 / `createGeometry` Plane / `MODEL_CONFIGS`+modelOptions / 贴地 / `MATERIAL_DEFS` / `getModelAnims`+`_buildAnimList` / `buildGUI` 体型模块 / `_doSave` 固化 | 改 ~120 行   |
| `models/model_configs.js` | `MODEL_CONFIGS` 加 `humanoid` entry + getter                                                                                                                                  | 改 ~3 行     |
| `server.py`               | `_find_variant_bounds` helper + `solidify_config` 解析 `humanoid:variant`                                                                                                     | 改 ~30 行    |
| `index.html`              | 无（`humanoid_config.js` 已在 P1 加载；`humanoid_factory.js` 仅工厂用，不加进游戏）                                                                                           | 0            |

**本 plan 不含（后续）**：P5 `tools/enemy_marker.html` 放置工具页、P6 校服 Canvas 贴图精修（校徽/斜纹/红领巾）、人形 factory 关键帧与 `enemies.js` 统一（Z 档）。

---

## Task 1: 工厂渲染接入（Plane 支持 + config 脚本 + MODEL_CONFIGS + modelOptions + 贴地）

**Files:**

- Modify: `model_factory.html`（createGeometry L1074 后；脚本 L483 后；modelOptions L3394-3400；rebuildModel L2665 后）
- Modify: `models/model_configs.js`（L30 + L33）

**Interfaces:**

- Consumes: `window.HumanoidConfig`（P1 已暴露，含 `HUMANOID_BASE`/`HUMANOID_VARIANTS`/`buildHumanoid`）
- Produces: 工厂下拉可选「🧟 校园丧尸」，`MODEL_CONFIGS.humanoid` 可渲染（初值裸骨架），`createGeometry` 支持 `type:'Plane'`

- [ ] **Step 1: `createGeometry` 加 `Plane` case（硬阻塞修复）**

定位 `model_factory.html` 的 `case 'Torus':` 行（约 L1073-1074，锚点 `return new THREE.TorusGeometry(s[0], s[1] || 0.05, seg[0] || 8, seg[1] || 12);`），在其后、`case 'Lathe':` 之前插入：

```js
          case 'Plane':
            return new THREE.PlaneGeometry(s[0], s[1] || s[0], seg[0] || 1, seg[1] || 1);
```

> 说明：`humanoid_config.js` 的 `ADDON_LIBRARY` 用 `type:'Plane'`（校徽片 `school_badge`、斜纹片 `shoulder_stripes`）。不加此 case 会落到 `default: return null` → mesh.geometry=null → 渲染报错。

- [ ] **Step 2: 加载 `humanoid_config.js` 脚本**

定位 `model_factory.html` 的 `<script src="models/hexapod_config.js"></script>`（约 L483），在其**下一行**插入：

```html
<script src="models/humanoid_config.js"></script>
```

> 必须排在 `<script src="models/model_configs.js">`（L485）**之前**，因为 Step 3 的 `MODEL_CONFIGS` 求值时读 `window.HumanoidConfig`。

- [ ] **Step 3: `MODEL_CONFIGS` 加 `humanoid` entry**

定位 `models/model_configs.js` 的 `MODEL_CONFIGS` 定义（约 L30，锚点 `hexapod: (window.HexapodConfig && window.HexapodConfig.HEXAPOD_CONFIG) || {}`），在该行后加：

```js
  humanoid: (window.HumanoidConfig && window.HumanoidConfig.HUMANOID_BASE) || {},
```

定位同文件 `window.ModelConfigs = {` 块（约 L33，锚点 `get HEXAPOD_CONFIG() { ... }`），在该 getter 后加：

```js
  get HUMANOID_BASE() { return (window.HumanoidConfig && window.HumanoidConfig.HUMANOID_BASE) || {}; },
```

> 初值用 `HUMANOID_BASE`（裸骨架，静态，简单）。Task 5 的体型 GUI 会把 `MODEL_CONFIGS.humanoid` 动态替换为 `buildHumanoid(变体,参数)` 产出（穿校服）。

- [ ] **Step 4: modelOptions 下拉加「🧟 校园丧尸」**

定位 `model_factory.html` 的 `const modelOptions = {`（约 L3394-3400，锚点 `'🦗 六足战车': 'hexapod',`），在该行后加：

```js
  '🧟 校园丧尸': 'humanoid',
```

- [ ] **Step 5: rebuildModel 加人形贴地**

定位 `model_factory.html` rebuildModel 内六足贴地块的结束 `}`（约 L2665，锚点是 `hexRoot.updateMatrixWorld(true); }` 那段的闭合括号），在其后、`// 六足战车始终线框` 注释前插入：

```js
// 校园丧尸：贴地（脚底 y=0）
if (currentModelType === 'humanoid') {
  var humRoot = null;
  modelRoot.children.forEach(function (c) {
    if (c.name === 'root') humRoot = c;
  });
  if (humRoot) {
    humRoot.position.y = 0;
    humRoot.updateMatrixWorld(true);
    var hbox = new THREE.Box3().setFromObject(humRoot);
    humRoot.position.y = -hbox.min.y;
    humRoot.updateMatrixWorld(true);
  }
}
```

> 人形 config 根节点 `name:'root'`（`humanoid_config.js` HUMANOID_BASE 根）。仿 hexapod 按 name 找根 + bbox.min.y 抵消贴地。

- [ ] **Step 6: CDP 验证渲染无错**

启动 `python server.py`，CDP 打开 `http://127.0.0.1:8080/model_factory.html`，控制台执行：

```js
// 切到人形
document.querySelector('[aria-label]'); // 仅占位；实际用 GUI 下拉选「🧟 校园丧尸」
```

或直接在控制台：

```js
currentModelType = 'humanoid';
rebuildModel();
console.log('meshCount:', modelRoot.children[0] ? modelRoot.children[0].children.length : 'empty');
```

Expected：控制台 0 错误；`modelRoot` 下出现 `name:'root'` 的人形骨架（裸骨架，灰default色，因 Task 3 未加材质）；`getObjectByName('torso_pivot')` 存在。

- [ ] **Step 7: Commit**

```bash
git add model_factory.html models/model_configs.js
git commit -m "feat(P4): 工厂渲染接入人形(Plane支持+脚本+MODEL_CONFIGS+modelOptions+贴地)"
```

---

## Task 2: `js/humanoid_factory.js` 工厂动画桥接（自包含）

**Files:**

- Create: `js/humanoid_factory.js`
- Modify: `model_factory.html`（脚本加载区，Task 1 Step 2 插入的 `humanoid_config.js` 行之后）

**Interfaces:**

- Consumes: `window.HumanoidConfig`（`JOINT_NAMES`/`REST_POSES`）、`window.modelRoot`（工厂全局，rebuildModel 产出）
- Produces: `window.HumanoidAnims = { names, durations, directions, turnRates, categories, collectRefs, updateFrame, resetState, destroyPivots, restorePlates }`
- 关键：工厂**不加载** `enemies.js`，故本文件**自包含** 6 动作关键帧（镜像 `enemies.js:createHumanoidAnimationSystem` L1164-1473 的 define 内容）+ 轻量 keyframe lerp + rest 偏移。不依赖 `AnimationSystem` 类。

- [ ] **Step 1: 创建 `js/humanoid_factory.js`**

```js
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
          restKey: null,
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
          restKey: null,
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
            { t: 0, v: -0.1 },
            { t: 0.25, v: -0.5 },
            { t: 0.5, v: 0.1 },
            { t: 0.75, v: 0.5 },
            { t: 1, v: -0.1 },
          ],
        },
        {
          target: P.r_upper_leg,
          prop: 'rotation',
          axis: 'x',
          restKey: null,
          keys: [
            { t: 0, v: 0.5 },
            { t: 0.25, v: 0.1 },
            { t: 0.5, v: -0.1 },
            { t: 0.75, v: -0.5 },
            { t: 1, v: 0.5 },
          ],
        },
        {
          target: P.l_lower_leg,
          prop: 'rotation',
          axis: 'x',
          restKey: null,
          keys: [
            { t: 0, v: 0 },
            { t: 0.5, v: -0.4 },
            { t: 1, v: 0 },
          ],
        },
        {
          target: P.r_lower_leg,
          prop: 'rotation',
          axis: 'x',
          restKey: null,
          keys: [
            { t: 0, v: -0.4 },
            { t: 0.5, v: 0 },
            { t: 1, v: -0.4 },
          ],
        },
        {
          target: P.l_upper_arm,
          prop: 'rotation',
          axis: 'x',
          restKey: null,
          keys: [
            { t: 0, v: 0 },
            { t: 0.5, v: -0.3 },
            { t: 1, v: 0 },
          ],
        },
        {
          target: P.r_upper_arm,
          prop: 'rotation',
          axis: 'x',
          restKey: null,
          keys: [
            { t: 0, v: -0.3 },
            { t: 0.5, v: 0 },
            { t: 1, v: -0.3 },
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
            { t: 0, v: 0 },
            { t: 1, v: 0.2 },
          ],
        },
        {
          target: O.pelvis,
          prop: 'position',
          axis: 'y',
          restKey: null,
          keys: [
            { t: 0, v: 0 },
            { t: 0.5, v: 0.07 },
            { t: 1, v: 0 },
          ],
        },
        {
          target: P.l_upper_leg,
          prop: 'rotation',
          axis: 'x',
          restKey: null,
          keys: [
            { t: 0, v: -0.1 },
            { t: 0.25, v: -0.7 },
            { t: 0.5, v: 0.1 },
            { t: 0.75, v: 0.8 },
            { t: 1, v: -0.1 },
          ],
        },
        {
          target: P.r_upper_leg,
          prop: 'rotation',
          axis: 'x',
          restKey: null,
          keys: [
            { t: 0, v: 0.8 },
            { t: 0.25, v: 0.1 },
            { t: 0.5, v: -0.1 },
            { t: 0.75, v: -0.7 },
            { t: 1, v: 0.8 },
          ],
        },
        {
          target: P.l_lower_leg,
          prop: 'rotation',
          axis: 'x',
          restKey: null,
          keys: [
            { t: 0, v: 0 },
            { t: 0.5, v: -0.6 },
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
            { t: 0.5, v: 0 },
            { t: 1, v: -0.6 },
          ],
        },
        {
          target: P.l_upper_arm,
          prop: 'rotation',
          axis: 'x',
          restKey: null,
          keys: [
            { t: 0, v: 0 },
            { t: 0.5, v: -0.6 },
            { t: 1, v: 0 },
          ],
        },
        {
          target: P.r_upper_arm,
          prop: 'rotation',
          axis: 'x',
          restKey: null,
          keys: [
            { t: 0, v: -0.6 },
            { t: 0.5, v: 0 },
            { t: 1, v: -0.6 },
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
          val = k0.v + ((k1.v - k0.v) * (t - k0.t)) / (k1.t - k0.t);
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
    collectRefs(); // 重新抓 ref + 复位关节到 rest（collectRefs 内 _curKey='Idle'）
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
```

- [ ] **Step 2: `model_factory.html` 加载 `humanoid_factory.js`**

定位 Task 1 Step 2 插入的 `<script src="models/humanoid_config.js"></script>` 行，在其**下一行**插入：

```html
<script src="js/humanoid_factory.js"></script>
```

> 普通 script（非 module），排在 `model_configs.js`（L485）与内联 module（L487+）之前。内联 module 的 `getModelAnims` 引用 `window.HumanoidAnims`，须在其求值前就绪。

- [ ] **Step 3: CDP 验证 factory 加载**

CDP 加载 `model_factory.html`，控制台执行：

```js
console.log(
  'HumanoidAnims:',
  !!window.HumanoidAnims,
  'names:',
  window.HumanoidAnims && window.HumanoidAnims.names.length
);
```

Expected：`HumanoidAnims: true names: 6`；控制台 0 错误；console 可见 `🧑 humanoid_factory 已就绪 | 动画数: 6`。

- [ ] **Step 4: Commit**

```bash
git add js/humanoid_factory.js model_factory.html
git commit -m "feat(P4): humanoid_factory.js 工厂展台动画桥接(自包含6动作+lerp+rest偏移)"
```

---

## Task 3: 人形材质（`MATERIAL_DEFS` 补全）

**Files:**

- Modify: `model_factory.html`（`MATERIAL_DEFS` L491-528）

**Interfaces:**

- Consumes: `humanoid_config.js` 的 materialId 命名（`polo_white`/`skin_zombie`/`eye_glow`/...）
- Produces: 人形各部位走 `getMaterial` fallback（L629 `MATERIAL_DEFS[matId] || default`）返回真实颜色，不再是 default 中灰

- [ ] **Step 1: `MATERIAL_DEFS` 加人形 materialId**

定位 `model_factory.html` 的 `const MATERIAL_DEFS = {`（约 L491），在 `warning_yellow: { ... },` 行后、`default: { ... }` 之前插入（颜色取自 `enemies.js:getHumanoidMat` DEFS，纯色近似，Canvas 贴图留 P6）：

```js
        // ── 校园人形丧尸（纯色近似，Canvas 贴图留 P6）──
        polo_white: { color: 0xf4f4f0, roughness: 0.7, metalness: 0.0 },
        teacher_shirt: { color: 0xf2f2ee, roughness: 0.65, metalness: 0.0 },
        blouse_white: { color: 0xf6f6f2, roughness: 0.65, metalness: 0.0 },
        skin_zombie: { color: 0xc9cfc0, roughness: 0.85, metalness: 0.0 },
        eye_glow: { color: 0x110000, roughness: 0.4, metalness: 0.0, emissive: 0xff3300, emissiveIntensity: 3 },
        hair_black: { color: 0x1a1a1a, roughness: 0.8, metalness: 0.0 },
        scarf_red: { color: 0xc8202a, roughness: 0.7, metalness: 0.0 },
        collar_red: { color: 0xc8202a, roughness: 0.65, metalness: 0.0 },
        button_white: { color: 0xf8f8f8, roughness: 0.5, metalness: 0.0 },
        shorts_red: { color: 0xb81c28, roughness: 0.7, metalness: 0.0 },
        trousers_grey: { color: 0x3a3a42, roughness: 0.7, metalness: 0.0 },
        shoes_blue: { color: 0x22335a, roughness: 0.55, metalness: 0.1 },
        shoes_white: { color: 0xf0f0ec, roughness: 0.55, metalness: 0.1 },
        leather_black: { color: 0x18181c, roughness: 0.4, metalness: 0.1 },
        tie_blue: { color: 0x1f3a6a, roughness: 0.6, metalness: 0.0 },
        frame_dark: { color: 0x222222, roughness: 0.5, metalness: 0.1 },
        briefcase_brown: { color: 0x5a3a22, roughness: 0.55, metalness: 0.0 },
        metal_gold: { color: 0xc8a040, roughness: 0.3, metalness: 0.7 },
        school_badge: { color: 0xffffff, roughness: 0.7, metalness: 0.0 },
        shoulder_stripes: { color: 0xd83232, roughness: 0.7, metalness: 0.0 },
```

> `getMaterial`（L603-640）无需改：人形 materialId 不在 hexColors 调试色表 → 落到 L629 `MATERIAL_DEFS[matId]` 命中上述定义 → 返回真实材质。`eye_glow` 的 `emissive` 字段会被 `{...def}` 展开进 `MeshStandardMaterial`（与 `warning_yellow` 同机制）。

- [ ] **Step 2: CDP 验证材质生效**

CDP 加载 `model_factory.html`，切到人形（GUI 下拉或 `currentModelType='humanoid'; rebuildModel();`），控制台执行：

```js
var t = modelRoot.getObjectByName('torso_mesh') || modelRoot.getObjectByName('torso');
console.log(
  'torso mat color:',
  t && t.material && t.material.color ? '#' + t.material.color.getHexString() : 'n/a'
);
```

Expected：torso 材质为 `polo_white` 色 `#f4f4f0`（裸骨架 HUMANOID_BASE 的 torso materialId=`__cloth__`，会被 Task 5 的 buildHumanoid 解析为 `polo_white`；Task 3 阶段裸骨架 torso 是 `__cloth__` 占位 → 落 default 中灰，这是正常的，Task 5 接体型 GUI 后变白）。本步主要确认 `MATERIAL_DEFS` 无语法错 + 控制台 0 错误。

- [ ] **Step 3: Commit**

```bash
git add model_factory.html
git commit -m "feat(P4): MATERIAL_DEFS 补全 20 个人形 materialId 纯色定义"
```

---

## Task 4: 动画展台接入（`getModelAnims` + `_buildAnimList`）

**Files:**

- Modify: `model_factory.html`（`getModelAnims` L2022；`_buildAnimList` L2483-2492）

**Interfaces:**

- Consumes: `window.HumanoidAnims`（Task 2）
- Produces: 人形在动画展台可播 6 动作，分类标签为 待机/移动/攻击/受击/死亡

- [ ] **Step 1: `getModelAnims` 加 `humanoid` 分支**

定位 `model_factory.html` 的 `hexapod: window.HexapodAnims || null,`（约 L2022），在其后加：

```js
          humanoid: window.HumanoidAnims || null,
```

- [ ] **Step 2: `_buildAnimList` 用 `ma.categories` 分支**

定位 `model_factory.html` `_buildAnimList` 内的 `var categories = [`（约 L2483），把整段硬编码 categories（L2483-2492）替换为优先取 `ma.categories`：

```js
var categories = ma.categories || [
  { label: '── 待机 ──', at: 0 },
  { label: '── 行进 (前进/后退) ──', at: 1 },
  { label: '── 平移 (步行) ──', at: 5 },
  { label: '── 转弯 (原地) ──', at: 7 },
  { label: '── 转弯 (移动) ──', at: 9 },
  { label: '── 平移 (奔跑) ──', at: 19 },
  { label: '── 受击 ──', at: 21 },
  { label: '── 死亡 ──', at: 22 },
];
```

> `HexapodAnims` 无 `categories` 字段 → 走 fallback（原 hexapod 8 分类，零回归）。`HumanoidAnims` 有 `categories` → 走人形 5 分类。

- [ ] **Step 3: CDP 验证动画展台**

CDP 加载 `model_factory.html`，切人形后控制台执行（模拟开展台）：

```js
currentModelType = 'humanoid';
rebuildModel();
setTimeout(function () {
  var ma = getModelAnims();
  console.log(
    'ma:',
    !!ma,
    'names:',
    ma && ma.names.length,
    'cats:',
    ma && ma.categories && ma.categories.length
  );
  if (ma && ma.collectRefs) {
    ma.collectRefs();
    console.log('collectRefs OK, torso_pivot:', !!modelRoot.getObjectByName('torso_pivot'));
  }
}, 500);
```

Expected：`ma: true names: 6 cats: 5`；`collectRefs OK, torso_pivot: true`；0 错误。

> 注：裸骨架（HUMANOID_BASE）的 torso materialId 是 `__cloth__` 占位，pivot 命名 `torso_pivot` 由 buildFromConfig 生成（config 有 pivot 字段）。collectRefs 能抓到 pivot 即可播动画。

- [ ] **Step 4: Commit**

```bash
git add model_factory.html
git commit -m "feat(P4): getModelAnims+_buildAnimList 接入人形动画展台(categories分支)"
```

---

## Task 5: 体型参数 GUI 模块（变体下拉 + 4 滑块）

**Files:**

- Modify: `model_factory.html`（`buildGUI` L3448 后；新增 `_applyHumanoidEdit` 函数）

**Interfaces:**

- Consumes: `HumanoidConfig.buildHumanoid(variantKey, params)` / `BODY_PARAMS` / `HUMANOID_VARIANTS`
- Produces: 工厂切到人形时显示「🧍 体型参数」文件夹，变体下拉 + height/build/hunch/curves 滑块实时重建模型（`MODEL_CONFIGS.humanoid` 动态替换为 `buildHumanoid` 产出，穿校服）

- [ ] **Step 1: 新增 `_applyHumanoidEdit` 函数（模块级）**

定位 `model_factory.html` 内联 module 中 `function rebuildModel()` 定义之前（或在 `getModelAnims` 附近），加模块级状态 + 重建函数：

```js
// ── 人形体型编辑状态（工厂专用）──
var _humanoidEdit = {
  variant: 'student_m',
  params: { height: 1.3, build: 0.5, hunch: 0.2, curves: 0 },
};
function _applyHumanoidEdit() {
  if (currentModelType !== 'humanoid' || !window.HumanoidConfig) return;
  var tree = window.HumanoidConfig.buildHumanoid(_humanoidEdit.variant, _humanoidEdit.params);
  if (tree) {
    MODEL_CONFIGS.humanoid = tree;
    rebuildModel();
  }
}
window._applyHumanoidEdit = _applyHumanoidEdit; // 供 CDP 测试
```

> `buildHumanoid` 产出含 addon（校服/装饰）+ 体型派生（hunch/curves）的完整树。`rebuildModel`（L2641）会深拷贝它再 buildFromConfig。

- [ ] **Step 2: `buildGUI` 加「🧍 体型参数」文件夹**

定位 `model_factory.html` `buildGUI` 内 `_buildCamoCtrl(modelFolder);`（约 L3448，紧邻其后是 `selectAllFolder` 创建），在 `_buildCamoCtrl(modelFolder);` 行后插入：

```js
// 人形体型参数（仅 humanoid 显示）
if (currentModelType === 'humanoid' && window.HumanoidConfig) {
  var bodyF = gui.addFolder('🧍 体型参数');
  var BP = window.HumanoidConfig.BODY_PARAMS;
  var variantOptions = {};
  Object.keys(window.HumanoidConfig.HUMANOID_VARIANTS).forEach(function (k) {
    variantOptions[window.HumanoidConfig.HUMANOID_VARIANTS[k].name] = k;
  });
  bodyF
    .add(_humanoidEdit, 'variant', variantOptions)
    .name('变体')
    .onChange(function () {
      _applyHumanoidEdit();
    });
  var nameMap = { height: '身高', build: '体型', hunch: '驼背', curves: '曲线' };
  Object.keys(BP).forEach(function (k) {
    _humanoidEdit.params[k] = BP[k].default;
    bodyF
      .add(_humanoidEdit.params, k, BP[k].range[0], BP[k].range[1], 0.01)
      .name(nameMap[k] || k)
      .onChange(function () {
        _applyHumanoidEdit();
      });
  });
  bodyF.open();
}
```

- [ ] **Step 3: CDP 验证体型滑块重建**

CDP 加载 `model_factory.html`，切人形，控制台执行：

```js
// 默认 student_m 裸骨架 → 应用编辑后变穿校服
_applyHumanoidEdit();
setTimeout(function () {
  var tree = MODEL_CONFIGS.humanoid;
  console.log(
    'hasAddon:',
    !!(tree && tree.children && tree.children[0] && tree.children[0].children.length > 3)
  );
  console.log(
    'torso mat:',
    (function () {
      var t = modelRoot.getObjectByName('torso');
      return t && t.material && t.material.color ? '#' + t.material.color.getHexString() : 'n/a';
    })()
  );
}, 500);
// 调驼背
_humanoidEdit.params.hunch = 0.4;
_applyHumanoidEdit();
```

Expected：`_applyHumanoidEdit()` 后模型重建（穿校服，有 addon 节点）；torso 材质变 `#f4f4f0`（polo_white）；调 hunch 后 torso 倾斜变化；0 错误。

- [ ] **Step 4: Commit**

```bash
git add model_factory.html
git commit -m "feat(P4): 体型参数GUI(变体下拉+height/build/hunch/curves滑块实时重建)"
```

---

## Task 6: solidify humanoid 固化（单变体写回 `HUMANOID_VARIANTS`）

**Files:**

- Modify: `server.py`（`_find_variant_bounds` 新增 + `solidify_config` 解析 `humanoid:variant`）
- Modify: `model_factory.html`（`_doSave` 人形分支）

**Interfaces:**

- Consumes: `server.py:_find_config_bounds`（定位顶层 `HUMANOID_VARIANTS`）
- Produces: 工厂 Ctrl+S 时 POST `{modelType:'humanoid:'+variant, config: variantDef}`，server 定位 `HUMANOID_VARIANTS` 内对应 key 块并替换

> 背景：`_find_config_bounds`（server.py:27-58）正则头强制 `const` 前缀，**不能**定位嵌套 key（如 `student_m: {...}`）。本 task 新增 `_find_variant_bounds(text, parent_const, variant_key)`：先定位顶层 `HUMANOID_VARIANTS` 块 → 块内正则找 `variant_key\s*:` → 从该处 `{` 数括号匹配 → 返回区间。

- [ ] **Step 1: `server.py` 新增 `_find_variant_bounds` helper**

定位 `server.py` 的 `_find_config_bounds` 函数定义之后（约 L58 后），加：

```python
def _find_variant_bounds(text, parent_const, variant_key):
    """定位 const PARENT = {...} 块内 variant_key: {...} 子对象的字符区间。
    返回 (val_start, val_end)：从 variant_key 冒号后的 '{' 到匹配的 '}'。
    找不到返回 (None, None)。"""
    # 1) 先定位父 const 块
    ps, pe = _find_config_bounds(text, parent_const)
    if ps is None:
        return (None, None)
    parent_block = text[ps:pe]
    # 2) 块内正则找 variant_key:
    import re
    m = re.search(r'\b' + re.escape(variant_key) + r'\s*:\s*\{', parent_block)
    if not m:
        return (None, None)
    # 3) 从 '{' 数括号深度
    brace_start = m.end() - 1  # m.end() 指向 '{' 之后
    depth = 0
    i = brace_start
    while i < len(parent_block):
        c = parent_block[i]
        if c == '{':
            depth += 1
        elif c == '}':
            depth -= 1
            if depth == 0:
                val_start = ps + brace_start
                val_end = ps + i + 1
                return (val_start, val_end)
        i += 1
    return (None, None)
```

- [ ] **Step 2: `solidify_config` 解析 `humanoid:variant` 后缀**

定位 `server.py` 的 `def solidify_config(model_type, config_json_str):`（约 L61），在函数开头（查 MODEL_MAP 之前）加嵌套分支：

```python
def solidify_config(model_type, config_json_str):
    # 人形按变体固化：modelType 形如 'humanoid:student_m'
    if model_type.startswith('humanoid:'):
        variant_key = model_type.split(':', 1)[1]
        filepath = 'models/humanoid_config.js'
        with open(filepath, 'r', encoding='utf-8') as f:
            text = f.read()
        vs, ve = _find_variant_bounds(text, 'HUMANOID_VARIANTS', variant_key)
        if vs is None:
            raise ValueError(f'variant {variant_key} not found in HUMANOID_VARIANTS')
        config_obj = json.loads(config_json_str)
        formatted = json.dumps(config_obj, indent=2, ensure_ascii=False)
        new_text = text[:vs] + formatted + text[ve:]
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_text)
        return filepath
    # …原 MODEL_MAP 逻辑保持不变…
```

> 把原函数体（MODEL_MAP 查找 + `_find_config_bounds` + 替换）保留在 `if` 之后。`do_POST`（L199-224）无需改：`humanoid:student_m` 不在 campus 白名单 → 走 `solidify_config(model_type, config_json)` 路径（L212-220）。

- [ ] **Step 3: `model_factory.html` `_doSave` 加人形分支**

定位 `model_factory.html` 的 `_doSave` 函数（搜 `function _doSave` 或 `modelType:` 在 fetch solidify 处）。在构造 POST payload 处加人形分支：

```js
// 在 _doSave 内，构造 payload 处：
var payload;
if (currentModelType === 'humanoid' && window.HumanoidConfig) {
  // 固化当前变体定义到 HUMANOID_VARIANTS[variant]
  var variantDef = window.HumanoidConfig.HUMANOID_VARIANTS[_humanoidEdit.variant];
  payload = {
    modelType: 'humanoid:' + _humanoidEdit.variant,
    config: JSON.parse(JSON.stringify(variantDef)),
  };
} else {
  payload = { modelType: currentModelType, config: MODEL_CONFIGS[currentModelType] };
}
// …原 fetch('/api/solidify', { body: JSON.stringify(payload) }）保持…
```

> 实际执行时读 `_doSave` 现有结构，把 `modelType: currentModelType, config: MODEL_CONFIGS[currentModelType]` 这处替换为上面的分支。注意保留 `_doSave` 的 localStorage 存档与 JSON 下载部分（若 v0.65.9 已移除下载则只存 localStorage）。

- [ ] **Step 4: 重启 server + CDP 验证固化**

```bash
taskkill //F //IM python.exe && python server.py
```

CDP 加载 `model_factory.html`，切人形 → 选变体 `teacher_f` → 改某参数 → Ctrl+S（触发 `_doSave`）。控制台执行验证：

```js
// 读回源文件确认写入
fetch('models/humanoid_config.js')
  .then((r) => r.text())
  .then((t) => {
    var i = t.indexOf('teacher_f');
    console.log('teacher_f 段存在:', i > 0);
    console.log('含 blouse_white:', t.indexOf('blouse_white', i) > 0);
  });
```

Expected：`teacher_f 段存在: true`；固化后 `humanoid_config.js` 的 `HUMANOID_VARIANTS.teacher_f` 块被 json.dumps 重写（标准格式，注释丢失——可接受，与 hexapod 同）；0 错误。

- [ ] **Step 5: Commit**

```bash
git add server.py model_factory.html
git commit -m "feat(P4): solidify humanoid 单变体固化(_find_variant_bounds+_doSave分支)"
```

---

## Task 7: 端到端验证（Playwright）

**Files:**

- Test: 临时 `pw_test_p4_factory.js`（用后清理）

**Interfaces:**

- Consumes: Task 1-6 全部

- [ ] **Step 1: 写 Playwright 验证脚本 `pw_test_p4_factory.js`**

```js
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('http://127.0.0.1:8080/model_factory.html');
  await page.waitForFunction(() => window.HumanoidAnims && window.HumanoidConfig, null, {
    timeout: 15000,
  });
  // 切到人形 + 应用体型编辑（穿校服）
  await page.evaluate(() => {
    currentModelType = 'humanoid';
    _applyHumanoidEdit();
  });
  await page.waitForTimeout(800);
  // 验证渲染 + addon + 动画展台
  const result = await page.evaluate(() => {
    const ma = getModelAnims();
    if (ma && ma.collectRefs) ma.collectRefs();
    const root = modelRoot.getObjectByName('root');
    let meshCount = 0;
    if (root)
      root.traverse(() => {
        meshCount++;
      });
    return {
      hasRoot: !!root,
      meshCount,
      torso_pivot: !!modelRoot.getObjectByName('torso_pivot'),
      animNames: ma && ma.names.length,
      addonBadge: !!modelRoot.getObjectByName('ah_badge'),
    };
  });
  // 测试动画播放（Walk 一段时间）
  await page.evaluate(() => {
    window._testAnimIdx = 1;
  }); // 占位：展台 updateFrame 由 animate 循环驱动
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'pw_p4_factory.png', fullPage: false });
  console.log(JSON.stringify(result, null, 2));
  console.log('consoleErrors:', errors.length, errors.slice(0, 5));
  await browser.close();
  if (!result.hasRoot || result.meshCount < 5 || result.animNames !== 6 || errors.length)
    process.exit(1);
})();
```

- [ ] **Step 2: 启动服务并运行**

```bash
python server.py &
node pw_test_p4_factory.js
```

Expected：stdout 输出 `hasRoot: true`、`meshCount` > 5（含 addon）、`torso_pivot: true`、`animNames: 6`、`addonBadge: true`（校徽 addon）；`consoleErrors: 0`；截图 `pw_p4_factory.png` 可见穿校服人形。

- [ ] **Step 3: 视觉检查（人工/截图分析）**

打开 `pw_p4_factory.png` 或手动进 `http://127.0.0.1:8080/model_factory.html` 确认：

- 选「🧟 校园丧尸」→ 渲染穿校服人形（学生白 Polo + 红领巾 + 校徽 + 深蓝短裤；女学生马尾；教师衬衫西裤/裙）
- 变体下拉切 4 种，外观各异
- 体型滑块（身高/驼背/曲线）拖动 → 模型实时变化（女教师 curves 调高 → 胸臀放大）
- 动画展台 6 动作播放（待机微摆/步行/奔跑/攻击挥爪/受击后仰/死亡前扑）
- Ctrl+S 固化后 `humanoid_config.js` 对应变体更新

- [ ] **Step 4: 清理临时脚本并提交**

```bash
rm pw_test_p4_factory.js pw_p4_factory.png
git add -A
git commit -m "test(P4): 验证校园丧尸工厂接入端到端(渲染/体型/动画/固化)"
```

---

## Self-Review 结论

**Spec 覆盖**：本 plan 覆盖 spec 第 5.3 节（`humanoid_factory.js` 桥接层，自包含变体——spec 假设工厂加载 enemies.js，实际不加载，本 plan 据实改为自包含）、5.4（工厂 6 项改造：脚本加载/`MODEL_CONFIGS`+modelOptions/`MATERIAL_DEFS`+getMaterial/`getModelAnims`+`_buildAnimList`/体型 GUI/`createGeometry` Plane）、5.5（solidify 单变体定位替换——spec 说"\_find_config_bounds 现有括号匹配可直接用"，实际只认顶层 const，本 plan 新增 `_find_variant_bounds` 修正）、第 10 节 P4 全部。

**与 spec 的偏差（已修正）**：

1. spec 5.4 改造 3 说"`getMaterial` 加人形贴图分支（调 Canvas 生成）"——本 plan 改为 `MATERIAL_DEFS` 纯色近似（Canvas 贴图留 P6），避免工厂页生成 Canvas 贴图的复杂度。
2. spec 5.5 说固化用 `_find_config_bounds`——实际该函数只认顶层 const，本 plan 新增 `_find_variant_bounds` 嵌套定位。
3. spec 假设 `humanoid_factory.js` 复用 `createHumanoidAnimationSystem`——工厂不加载 enemies.js，本 plan 让 factory 自包含关键帧（与 enemies.js 镜像，spec 非目标"不做跨模型共享动画库"允许）。

**类型一致性**：`window.HumanoidAnims` 字段与 `HexapodAnims` 同构（names/durations/collectRefs/updateFrame/resetState/destroyPivots/restorePlates + directions/turnRates 空数组占位）+ categories。变体名 `student_m/student_f/teacher_m/teacher_f` 在 `HUMANOID_VARIANTS` key、`_humanoidEdit.variant`、固化 `modelType:'humanoid:'+variant`、`buildHumanoid(variant,params)` 四处一致。`updateFrame(dt,t,elapsed,duration,animIndex)` 签名与 `_tankUpdateFrame`/`HexapodAnims.updateFrame` 一致。

**主要风险**：

1. **Die 动画 root.position.y 偏移**（P1 Minor M-2 留档）：Die 用 `O.root position y` 相对偏移（0→-0.45），叠加 config root 的 position.y（0.75）→ 0.30，可能穿地。工厂展台预览可接受；`resetState` 复位 root.rotation + collectRefs 重置关节。
2. **`buildHumanoid` 产出含 `_addonKey`/`_params`/`_slot` 字段**：buildFromConfig 不读这些字段（只用 type/name/size/position/rotation/pivot/materialId/segments/children），无害。固化时发的是 `HUMANOID_VARIANTS[variant]`（不含这些运行时字段），安全。
3. **`node.color` 绕过 getMaterial**（model_factory L1513-1519）：人形 config 节点用 `materialId` 不用 `color`（已确认 `humanoid_config.js` ADDON_LIBRARY 全用 materialId），此风险不适用。
4. **行号下移**：前置 task 插入使后续 task 行号偏移，执行时用 Grep 按锚点代码定位（plan 每步给锚点）。
5. **`humanoid_factory.js` 关键帧与 `enemies.js` 镜像同步**：两份关键帧独立，未来改动作要改两处（spec Z 档才统一）。本 plan Task 2 注释已标明镜像源 `enemies.js:createHumanoidAnimationSystem L1164-1473`。

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-26-campus-zombies-p4-factory.md`. Two execution options:

**1. Subagent-Driven (recommended)** — 每个 task 派一个 fresh subagent 实现，task 间两阶段 review，快速迭代。

**2. Inline Execution** — 本会话内按 executing-plans 批量执行，带检查点。

选哪种？本 plan 覆盖 P4 工厂接入全流程；P5（放置工具页）/P6（校服精修）在 P4 完成验收后各自单独规划。
