# 校园丧尸两层编辑 · Phase 1：精细骨架白模 + 数据结构 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 重构 `humanoid_config.js` 为版本化数据结构（`SKELETON_VERSIONS` / `WORKING_SKELETON` / `MODELS` / `bakeModel`），搭精细拟真骨架白模（通用拓扑 + 写实比例），工厂能加载显示并冻结三比例版本。

**Architecture:** 新数据层 + 写实 7.5 头身低多边形通用骨架（含手）+ 工厂最小骨架/变体模式切换（WYSIWYG 编辑留 Phase 3）。`bakeModel` 从现有 `buildHumanoid` 提取派生逻辑（`deriveNode` + addon 注入），改输入为「骨架版本 + 参数」。

**Tech Stack:** Three.js r160 / 浏览器 JS / Playwright + CDP 验证 / python `server.py`

## Global Constraints

- 验证：Playwright 端到端 + CDP 抓 console（项目无单测框架），每次改动 CDP 0 错误（CLAUDE.md 规则 6）
- 访问 `http://127.0.0.1:8080`（禁 localhost）
- 通用拓扑：所有骨架版本 + 变体，关节名 / 父子 / pivot 一字对齐（动画复用前提）
- 现有四变体保留作参考，Phase 1 **不动游戏侧**（`enemies.js` / `campus_spawner.js` 仍用旧 `buildHumanoid`）
- 改 `server.py` 后必须重启（规则 10）—— Phase 1 不改 server.py

## 关键接口契约（跨 task）

```js
window.HumanoidConfig = {
  SKELETON_VERSIONS,            // { [verKey]: { date, note, tree } }
  WORKING_SKELETON,             // 骨架配置 tree（字面值，工厂骨架模式编辑对象）
  MODELS,                       // { [variant]: { _skeletonVer, tree, anims } }
  bakeModel(skeletonVer, params), // → tree（深拷贝版本骨架 + 派生 + addon 注入）
  getSkeletonList(),            // → ['v1-儿童-…', ...]（版本 key 数组）
  getVariantList(),             // → ['student_m','student_f','teacher_m','teacher_f']
  // 保留（旧接口，Phase 1 游戏侧仍用，Phase 4 移除）
  HUMANOID_BASE, ADDON_LIBRARY, JOINT_NAMES, REST_POSES, buildHumanoid,
};
```

**通用拓扑关节名**（一字对齐，含新增手）：
`root` / `pelvis` / `torso` / `neck` / `head` / `l_eye_glow` / `r_eye_glow` / `l_upper_arm` / `l_forearm` / `l_hand` / `r_upper_arm` / `r_forearm` / `r_hand` / `l_upper_leg` / `l_lower_leg` / `l_foot` / `r_upper_leg` / `r_lower_leg` / `r_foot`

---

### Task 1: `humanoid_config.js` 数据结构重构（框架）

**Files:**

- Modify: `models/humanoid_config.js`（新增数据层；保留 `ADDON_LIBRARY` / `deriveNode` / `setBone` / `findNode` / `mirrorX` / `scaleGroup` / `JOINT_NAMES` / `REST_POSES`，供 `bakeModel` 复用）

**Interfaces:**

- Consumes: 现有 `HUMANOID_BASE` / `deriveNode` / `ADDON_LIBRARY` / addon 注入逻辑（`buildHumanoid` 内 L900-970）
- Produces: `SKELETON_VERSIONS` / `WORKING_SKELETON` / `MODELS` / `bakeModel(skeletonVer, params)` / `getSkeletonList()` / `getVariantList()`（见契约）

- [ ] **Step 1: 在 IIFE 末尾（`window.HumanoidConfig` 之前）新增数据层框架**

在 `models/humanoid_config.js` 的 `buildHumanoid` 函数之后、`window.HumanoidConfig` 之前插入：

```js
// ═══ 新数据层（Phase 1）：版本化骨架 + 字面值变体 + 烘焙工具 ═══
// WORKING_SKELETON：工厂骨架模式的编辑对象（Task 2 替换为精细白模；此处先用现有 BASE 让框架跑通）
var WORKING_SKELETON = JSON.parse(JSON.stringify(HUMANOID_BASE));

// SKELETON_VERSIONS：冻结版本库（Task 4 填三比例版本；此处空）
var SKELETON_VERSIONS = {};

// MODELS：四变体字面值 tree（Phase 2 烘焙填充；此处占位用旧 buildHumanoid 让工厂变体模式能显示）
var MODELS = {};
Object.keys(HUMANOID_VARIANTS).forEach(function (vk) {
  MODELS[vk] = { _skeletonVer: null, tree: buildHumanoid(vk, {}), anims: null };
});

// bakeModel：从骨架版本烘焙字面值 tree（复用 deriveNode + addon 注入逻辑）
//   skeletonVer: SKELETON_VERSIONS 的 key；params: { height, build, hunch, curves, addons }
function bakeModel(skeletonVer, params) {
  var ver = SKELETON_VERSIONS[skeletonVer];
  if (!ver) {
    console.warn('bakeModel: 未知骨架版本', skeletonVer);
    return null;
  }
  params = params || {};
  // 深拷贝版本骨架 + 派生（复用 deriveNode：build/curves/hunch 缩放）
  var variant = { materials: HUMANOID_VARIANTS.student_m.materials, addons: params.addons || [] };
  var tree = deriveNode(
    JSON.parse(JSON.stringify(ver.tree)),
    {
      height: params.height != null ? params.height : 1.4,
      build: params.build != null ? params.build : BODY_PARAMS.build.default,
      hunch: params.hunch != null ? params.hunch : 0.2,
      curves: params.curves != null ? params.curves : 0,
    },
    variant
  );
  // addon 注入（复用 buildHumanoid 的 L900-953 逻辑：解析材质/镜像/curves 放大/WRAP 包裹）
  (params.addons || []).forEach(function (key) {
    var def = ADDON_LIBRARY[key];
    if (!def) return;
    var parents = def.parent ? [def.parent] : [];
    parents.forEach(function (par) {
      var parentNode = findNode(tree, par);
      if (!parentNode) return;
      parentNode.children = parentNode.children || [];
      var clone = JSON.parse(JSON.stringify(def.node));
      resolveAddonMaterials(clone, variant.materials);
      parentNode.children.push(clone);
    });
  });
  tree._params = { height: params.height != null ? params.height : 1.4 };
  return tree;
}
function getSkeletonList() {
  return Object.keys(SKELETON_VERSIONS);
}
function getVariantList() {
  return Object.keys(MODELS);
}
```

- [ ] **Step 2: 扩展 `window.HumanoidConfig` 导出**

将 `window.HumanoidConfig = { ... }`（L993-1001）改为：

```js
window.HumanoidConfig = {
  HUMANOID_BASE,
  BODY_PARAMS,
  HUMANOID_VARIANTS,
  ADDON_LIBRARY,
  JOINT_NAMES,
  REST_POSES,
  buildHumanoid, // 旧接口（Phase 1 游戏侧仍用）
  SKELETON_VERSIONS,
  WORKING_SKELETON,
  MODELS, // 新数据层
  bakeModel,
  getSkeletonList,
  getVariantList,
};
console.log(
  '🧑 人形配置已就绪 | 变体:',
  Object.keys(HUMANOID_VARIANTS).join('/'),
  '| 骨架版本:',
  Object.keys(SKELETON_VERSIONS).length
);
```

- [ ] **Step 3: CDP 验证 0 错误 + 新结构可访问**

Run: `taskkill //F //IM python.exe 2>nul; python server.py`（后台），等待就绪。
Playwright 加载 `http://127.0.0.1:8080/model_factory.html`，evaluate：

```js
JSON.stringify({
  hasNew: !!(
    HumanoidConfig.SKELETON_VERSIONS &&
    HumanoidConfig.WORKING_SKELETON &&
    HumanoidConfig.MODELS &&
    HumanoidConfig.bakeModel
  ),
  variantKeys: HumanoidConfig.getVariantList(),
  skeletonCount: HumanoidConfig.getSkeletonList().length,
  teacherFtree: !!HumanoidConfig.MODELS.teacher_f.tree,
});
```

Expected: `hasNew=true` / `variantKeys` 四项 / `skeletonCount=0`（Task 4 填）/ `teacherFtree=true`。
CDP 抓 console：0 error。

- [ ] **Step 4: Commit**

```bash
git add models/humanoid_config.js
git commit -m "feat(humanoid): Phase1 数据层 SKELETON_VERSIONS/WORKING_SKELETON/MODELS/bakeModel"
```

---

### Task 2: 精细骨架白模（`WORKING_SKELETON`，写实 7.5 头身）

**Files:**

- Modify: `models/humanoid_config.js`（替换 `WORKING_SKELETON` 为精细白模；新增 `l_hand`/`r_hand` 节点）

**Interfaces:**

- Consumes: Task 1 的 `WORKING_SKELETON` 槽位
- Produces: 写实骨架 tree，关节名含 `l_hand`/`r_hand`（通用拓扑），供 Task 4 派生三版本

**写实比例目标**（成人中性基准，7.5 头身，身高 H；骨架用模型单位，后续 `_params.height/1.3` 归一）：

| 部位 | 关节名           | type     | 写实比例（×H）                   | 起始值（H≈1.35）           |
| ---- | ---------------- | -------- | -------------------------------- | -------------------------- |
| 骨盆 | pelvis           | Box      | 高 H/10, 宽 H/3.4, 深 H/4        | size [0.40, 0.135, 0.34]   |
| 躯干 | torso            | Box      | 高 H/4.4, 宽 H/3.6, 深 H/5.5     | size [0.375, 0.307, 0.245] |
| 颈   | neck             | Cylinder | 高 H/22, r H/42                  | size [0.032, 0.061, 0.032] |
| 头   | head             | Sphere   | r H/15                           | size [0.09]                |
| 上臂 | l/r_upper_arm    | Cylinder | 高 H/5.2, r H/26                 | size [0.052, 0.26, 0.052]  |
| 前臂 | l/r_forearm      | Cylinder | 高 H/5.6, r H/30                 | size [0.045, 0.241, 0.045] |
| 手   | l/r_hand         | Box      | 长 H/13, 宽 H/26, 深 H/30        | size [0.052, 0.104, 0.045] |
| 大腿 | l/r_upper_leg    | Cylinder | 高 H/4.3, r H/22                 | size [0.061, 0.314, 0.061] |
| 小腿 | l/r_lower_leg    | Cylinder | 高 H/4.3, r H/26                 | size [0.052, 0.314, 0.052] |
| 脚   | l/r_foot         | Box      | 长 H/6, 高 H/30, 宽 H/12         | size [0.112, 0.045, 0.225] |
| 肩宽 | 上臂 position[0] | —        | 男 H/4.4 / 女 H/5.2 / 中性 H/4.8 | ±0.28                      |

- [ ] **Step 1: 替换 `WORKING_SKELETON` 为按上表搭建的写实骨架 tree**

按现有 `HUMANOID_BASE` 的堆叠结构（root → pelvis → torso → neck → head + 四肢；position/pivot 沿用现有相对堆叠规则：关节在顶用 `pivot=[0,+half,0]`、在底用 `pivot=[0,-half,0]`，子节点 position 沿父节点轴向衔接），把各段 size 换成上表起始值，并新增 `l_hand`/`r_hand` 挂在 `l_forearm`/`r_forearm` 末端。

手节点示例（挂 l_forearm 末端）：

```js
{ name:'l_hand', type:'Box', size:[0.052, 0.104, 0.045],
  position:[0, -0.241, 0], pivot:[0, 0.052, 0], materialId:'__skin__' }
```

（`position.y=-前臂高` 衔接前臂末端；`pivot` 在手顶=腕关节）

材质全用占位 `__skin__`（白模，Phase 2 烘焙时由变体 `materials` 解析）。

- [ ] **Step 2: Playwright 加载骨架，截图 + 测比例**

工厂骨架模式需 Task 3 才能切；此处先临时把 `MODEL_CONFIGS.humanoid` 测试桩指向 `WORKING_SKELETON`（或直接在 console evaluate `buildFromConfig(HumanoidConfig.WORKING_SKELETON, ...)`）。Playwright 截图正/侧视图，并用 bbox 测：

```js
// 测上身(肩-腰):下身(腰-脚)、腿长/身高、臂展/身高、头/身高
var bb = new THREE.Box3().setFromObject(root);
// 各段 y 范围 → 比例
```

Expected（写实目标）：上身:下身 ≈ 1.0、腿长/身高 ≈ 0.48、臂展/身高 ≈ 0.95-1.0、头/身高 ≈ 1/7.5。

- [ ] **Step 3: 视觉迭代（起始值→测→微调）**

按 Step 2 实测比例 vs 目标，微调偏离部位的 size/position（写实公式允许 ±10%）。重复 Step 2 直到四项比例达标。这是建模迭代，不是一次性——预期 2-4 轮。

- [ ] **Step 4: CDP 0 错误 + Commit**

CDP 抓 console：0 error。

```bash
git add models/humanoid_config.js
git commit -m "feat(humanoid): Phase1 精细骨架白模 WORKING_SKELETON(写实7.5头身+手)"
```

---

### Task 3: 工厂骨架/变体模式切换 + 加载显示

**Files:**

- Modify: `model_factory.html`（humanoid 加模式切换 + 加载逻辑）

**Interfaces:**

- Consumes: Task 1 的 `HumanoidConfig.WORKING_SKELETON` / `MODELS` / `getVariantList`
- Produces: 工厂能切 🦴骨架模式（显示 `WORKING_SKELETON`）/ 🧍变体模式（显示 `MODELS[variant].tree`）

- [ ] **Step 1: 加模式状态 + GUI 切换**

在 `model_factory.html` 找到 `_humanoidEdit` 定义处（Grep `_humanoidEdit`），加 `_humanoidMode` 字段：

```js
var _humanoidEdit = { variant:'student_m', params:{...} };
var _humanoidMode = 'variant'; // 'skeleton' | 'variant'
```

在 `buildGUI` 的「🧍 体型参数」文件夹（L3731 附近）之前，加模式切换 folder：

```js
if (currentModelType === 'humanoid' && window.HumanoidConfig) {
  var modeF = gui.addFolder('🔀 编辑模式');
  modeF
    .add({ mode: _humanoidMode }, 'mode', {
      '🧍 变体(特色)': 'variant',
      '🦴 骨架(共通)': 'skeleton',
    })
    .name('模式')
    .onChange(function (v) {
      _humanoidMode = v;
      rebuildModel();
    });
  modeF.open();
}
```

- [ ] **Step 2: rebuildModel humanoid 分支按模式加载**

改 `rebuildModel` 的 humanoid 分支（L2870-2879），按 `_humanoidMode` 选源：

```js
if (currentModelType === 'humanoid' && window.HumanoidConfig) {
  if (_humanoidMode === 'skeleton') {
    MODEL_CONFIGS.humanoid = JSON.parse(JSON.stringify(window.HumanoidConfig.WORKING_SKELETON));
  } else {
    // 变体模式：加载 MODELS[当前变体].tree
    var M = window.HumanoidConfig.MODELS[_humanoidEdit.variant];
    MODEL_CONFIGS.humanoid = M
      ? JSON.parse(JSON.stringify(M.tree))
      : window.HumanoidConfig.buildHumanoid(_humanoidEdit.variant, _humanoidEdit.params);
  }
}
```

（替换原 `!MODEL_CONFIGS.humanoid._params` 的 buildHumanoid 守卫）

- [ ] **Step 3: Playwright 验证模式切换**

切 humanoid → 默认变体模式显示 student_m；切骨架模式显示 WORKING_SKELETON 白模；切变体 teacher_f 显示女模。各截图 + CDP 0 错误。

- [ ] **Step 4: Commit**

```bash
git add model_factory.html
git commit -m "feat(factory): Phase1 humanoid 骨架/变体模式切换+加载"
```

---

### Task 4: 冻结三比例版本 + bakeModel 烘焙

**Files:**

- Modify: `models/humanoid_config.js`（填 `SKELETON_VERSIONS` 三版本）

**Interfaces:**

- Consumes: Task 2 的 `WORKING_SKELETON`（写实中性基底）
- Produces: `SKELETON_VERSIONS` 含三比例版本（儿童/成年男/成年女）；`bakeModel` 能从版本烘焙

- [ ] **Step 1: 写派生函数 + 填三版本**

在 Task 1 数据层之后加：

```js
// 从 WORKING_SKELETON（写实成人中性）派生三比例版本
function _deriveProportion(base, cfg) {
  var tree = JSON.parse(JSON.stringify(base));
  // cfg: { head, torso, leg, arm, shoulder } 比例缩放因子（相对成人中性 1.0）
  // 用 setBone 改腿长/臂长/头，setShoulder 改肩
  if (cfg.leg) {
    setBone(tree, 'l_upper_leg', 0.314 * cfg.leg, 'top');
    setBone(tree, 'r_upper_leg', 0.314 * cfg.leg, 'top');
    setBone(tree, 'l_lower_leg', 0.314 * cfg.leg, 'top');
    setBone(tree, 'r_lower_leg', 0.314 * cfg.leg, 'top');
  }
  if (cfg.arm) {
    setBone(tree, 'l_upper_arm', 0.26 * cfg.arm, 'top');
    setBone(tree, 'r_upper_arm', 0.26 * cfg.arm, 'top');
    setBone(tree, 'l_forearm', 0.241 * cfg.arm, 'top');
    setBone(tree, 'r_forearm', 0.241 * cfg.arm, 'top');
  }
  if (cfg.head) {
    setBone(tree, 'head', 0.09 * cfg.head, 'bottom');
  }
  if (cfg.shoulder) setShoulder(tree, 0.28 * cfg.shoulder);
  return tree;
}
SKELETON_VERSIONS['v1-成年中性-20260810'] = {
  date: '2026-08-10',
  note: '写实成人中性基准',
  tree: JSON.parse(JSON.stringify(WORKING_SKELETON)),
};
SKELETON_VERSIONS['v1-成年男-20260810'] = {
  date: '2026-08-10',
  note: '成年男(肩宽)',
  tree: _deriveProportion(WORKING_SKELETON, { shoulder: 1.15 }),
};
SKELETON_VERSIONS['v1-成年女-20260810'] = {
  date: '2026-08-10',
  note: '成年女(S曲线基准)',
  tree: _deriveProportion(WORKING_SKELETON, { shoulder: 0.9, leg: 1.05 }),
};
SKELETON_VERSIONS['v1-儿童-20260810'] = {
  date: '2026-08-10',
  note: '儿童(头大腿短)',
  tree: _deriveProportion(WORKING_SKELETON, { head: 1.35, leg: 0.8, torso: 1.05 }),
};
```

（`setBone`/`setShoulder` 复用现有；儿童头大 1/6 头身 = head×1.35、腿短 = leg×0.80）

- [ ] **Step 2: Playwright 验证三版本 + bakeModel**

evaluate：

```js
var HC = HumanoidConfig;
var vers = HC.getSkeletonList(); // 期望 4 项（中性/男/女/儿童）
var baked = HC.bakeModel('v1-成年女-20260810', { height: 1.65, curves: 0.7, addons: [] });
JSON.stringify({ verCount: vers.length, vers: vers, bakedHead: baked ? baked.name : null });
```

Expected: `verCount=4` / `bakedHead='root'`。CDP 0 错误。

- [ ] **Step 3: 视觉抽检三版本比例差异**

临时加载四版本 tree 各截图：儿童头大腿短、成年男肩宽、成年女窄肩长腿、中性居中。比例差异可见。

- [ ] **Step 4: Commit**

```bash
git add models/humanoid_config.js
git commit -m "feat(humanoid): Phase1 冻结三比例骨架版本+bakeModel烘焙"
```

---

## Self-Review

**Spec 覆盖（Phase 1 范围）**：

- 数据模型 SKELETON_VERSIONS/WORKING_SKELETON/MODELS/bakeModel → Task 1 ✓
- 精细骨架白模（写实比例 + 手）→ Task 2 ✓
- 工厂骨架/变体模式加载 → Task 3 ✓
- 冻结三版本 + 烘焙 → Task 4 ✓
- （WYSIWYG 编辑/新增节点/冻结UI/server固化/游戏侧 → Phase 2-5，本 plan 范围外）

**占位扫描**：无 TBD/TODO；Task 2 起始值为写实公式算出的具体数字（非占位），Step 3 明确为建模迭代。

**类型一致**：`bakeModel(skeletonVer, params)` 签名 Task 1 定义、Task 4 调用一致；`getSkeletonList`/`getVariantList` 一致；关节名 `l_hand`/`r_hand` Task 2 新增、契约列出。

**风险**：Task 2 写实比例起始值需 Playwright 实测迭代（预期 2-4 轮微调）；Task 3 改 rebuildModel 守卫要保证旧变体模式（buildHumanoid 兜底）不破。
