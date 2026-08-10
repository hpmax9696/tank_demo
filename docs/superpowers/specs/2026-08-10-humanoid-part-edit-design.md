# 校园丧尸「骨架/变体两层编辑 + 版本化烘焙」设计

**日期**：2026-08-10
**关联**：v0.79.5 校园丧尸精修后续；`humanoid_config.js` / `model_factory.html` / `enemies.js` / `campus_spawner.js` / `server.py`
**状态**：设计中（待用户复审 → writing-plans）
**前置 plan**：`docs/superpowers/plans/2026-08-09-campus-zombie-part-edit.md`（待 brainstorm 起点）

## 背景与结构性问题

v0.79.5 精修女教师 S 曲线时，反复「我改 `humanoid_config.js` 数值 → 用户视觉确认 → 再改」，低效。用户希望像六足战车那样在工厂**点选部件 → 调参 → 保存**。

但校园丧尸与六足有**结构性差异**：六足/坦克的 `MODEL_CONFIGS` 是源文件顶层 `const` 字面值，工厂「点选 → 改 mesh → `syncConfigFromScene` → 固化字面值」零摩擦。而校园丧尸的 `MODEL_CONFIGS.humanoid` 是 `buildHumanoid()` 的**派生产物**，源文件存的是派生前散件（`HUMANOID_BASE` + `setBone` 调用 + `ADDON_LIBRARY` + `deriveNode` 的 build/curves/hunch 缩放 + `WRAP_ADDONS` 包裹）。**编辑对象 ≠ 源**，保存必须反推多层派生，无误差保存不可能——这是结构性问题，UI 层解决不了。

同时用户揭示更大愿景：**人形敌人流水线**——通用骨架为基底，批量产生不同敌人。

## 目标

1. **消除派生链**：四变体烘焙成字面值 tree，编辑对象 = 源，WYSIWYG 保存零反推
2. **两层编辑**：骨架层（通用拓扑，共通）+ 变体层（特色，个性化）
3. **版本化骨架**：骨架冻结版本、变体快照式烘焙、**不传播**（改骨架不自动影响已烘焙变体）
4. **重做精细拟真骨架白模**：我程序化搭基底，用户工厂精调
5. **流水线**：通用拓扑骨架 → 三比例版本 → 四变体裸体 → 个性化（发型/服饰/武器）

## 非目标（后续阶段）

- 变体动画适配编辑 UI（本次预留 `MODELS[variant].anims`，运行回退骨架基础动画）
- 武器 addon 专用编辑 UI（`bakeModel` 参数层支持即可）
- 流水线扩展到更多敌人类型（架构支持，不实装）

## 人形敌人生产管线

### 外形（6 步）

1. **我起初始白模**：通用拓扑 + 写实基准比例（成年中性，7.5 头身）
2. **用户微调白模**：工厂 🦴 骨架模式 WYSIWYG
3. **冻结三个骨架版本**：儿童（中性）/ 成年男 / 成年女——拓扑一致（动画复用），比例不同；冻结时弹命名框（默认 `v{N}-{类别}-日期`，`N` 由现存版本号推测；可改 / 加备注），入版本库永久保留
4. **烘焙四个变体裸体**：儿童男、儿童女（**同参数烘焙、体型相同、分开存储**）、成年男、成年女——每个变体 = 独立个性化基础
5. **我加发型 / 服装 / 装饰 / 武器**：程序化个性化（`bakeModel` 参数 + addon 注入）
6. **用户继续微调**：工厂 🧍 变体模式 WYSIWYG，外形细节，保存

### 动画

- **基础动画**（Idle/Walk/Run/Attack/Stagger/Die）在骨架层——步骤 1-3，白模带动画验证拓扑，冻结三版本时动画随之，拓扑一致 → 三版本共享
- **变体适配动画**——步骤 4-6 之后，比例不同需微调；属后续阶段，本次预留

## 架构

### 数据模型（`humanoid_config.js` 新结构）

```js
// ① 骨架版本库 —— 冻结字面值骨架树，永久保留备查
const SKELETON_VERSIONS = {
  'v1-儿童-20260810':   { date:'2026-08-10', note:'初始儿童比例', tree:{ …通用拓扑+儿童比例… } },
  'v1-成年男-20260810': { date:'2026-08-10', note:'初始成年男',   tree:{ … } },
  'v1-成年女-20260810': { date:'2026-08-10', note:'初始成年女',   tree:{ … } },
  // 改骨架 → 冻结新版本（v2-…）追加，旧版不动
};

// ② 当前工作骨架 —— 工厂骨架模式的编辑对象（保存中间态）
const WORKING_SKELETON = { …字面值骨架… };

// ③ 四变体字面值 tree —— 工厂变体模式的编辑对象 + 游戏读取源
const MODELS = {
  student_m: { _skeletonVer:'v1-儿童-20260810',   tree:{ …裸体+校服… }, anims:null },
  student_f: { _skeletonVer:'v1-儿童-20260810',   tree:{ …裸体+裙… },   anims:null },
  teacher_m: { _skeletonVer:'v1-成年男-20260810', tree:{ …裸体+长裤… }, anims:null },
  teacher_f: { _skeletonVer:'v1-成年女-20260810', tree:{ …裸体+S曲线… },anims:null },
};

// ④ 生成器（保留，角色降为烘焙工具，运行时/变体编辑不再调用）
const ADDON_LIBRARY = { … };                          // 素材库（规范化批量生成）
function bakeModel(skeletonVer, params) { … }         // 选骨架版本+参数→生成字面值 tree
```

**要点**

- **通用拓扑**：所有骨架版本 + 四变体，关节名 / 父子 / pivot 一字对齐 → 动画通用复用
- 工厂编辑对象 = `MODELS[variant].tree`（变体特色）或 `WORKING_SKELETON`（骨架共通）
- 游戏读取 = `MODELS[variant].tree`
- `anims` 预留（`null` → 运行回退骨架基础动画）

### 工厂两层编辑（`model_factory.html`）

humanoid 顶部模式切换：🦴 骨架模式 / 🧍 变体模式。

**🦴 骨架模式**（编辑 `WORKING_SKELETON`，共通底层）

- 点选骨架节点 WYSIWYG 调（size/position/rotation/material），复用六足交互（`selectedParts` / `nodeMap` / `focusPanel` / `setupRaycaster`）
- **新增部件**（加手/爪）：选中节点 →「添加子节点」→ 选几何类型（先支持 Box/Sphere/Cone/Cylinder；TaperedBox/Wedge/TaperedHex 后补）+ 命名 + 默认 size → 插入
- 「❄️ 冻结版本」按钮 → 弹命名框（默认 `v{N}-{类别}-日期`，`N` 由现存版本推测；可改 / 加备注）→ 写入 `SKELETON_VERSIONS`
- 「💾 保存骨架」→ 写回 `WORKING_SKELETON` 常量

**🧍 变体模式**（编辑 `MODELS[variant].tree`，特色）

- 顶部变体下拉（student_m/f、teacher_m/f）
- 点选部件 WYSIWYG 调特色（身材 / 服饰 / 发型细节）→ 实时预览
- 「💾 保存」→ 写回该变体 tree 常量（编辑对象 = 源，零反推）

**🔥 烘焙**（骨架 → 变体桥梁）

- 「从骨架烘焙」→ 选骨架版本(下拉) + 目标变体 + 参数（默认该变体预设：teacher_f curves=0.7 等）→ `bakeModel` 生成 → 覆盖该变体 tree（特色丢失，**弹确认**）+ 更新 `_skeletonVer`

### 游戏侧（`enemies.js` + `campus_spawner.js`）

- `createCampusZombie(variant)` → 读 `HC.MODELS[variant].tree`（字面值）→ `buildFromConfig` 装配
- **教师**（teacher_m/f）：scale = 1.0 固定，不随机
- **学生**（student_m/f）：tree × size 系数（离散三档 `[0.92, 1.0, 1.08]` 随机选），不随机 build/hunch/curves
- `campus_spawner` 门刷新：同上
- 碰撞体：size 系数同步缩放丧尸碰撞 cylinder（半径 / 高度）
- **移除**：build/hunch/curves 运行时随机逻辑（已烘焙进 tree）

### server 固化（`server.py`）

- 用现有 `_find_config_bounds` 整体替换顶层 const：`SKELETON_VERSIONS`（冻结）/ `WORKING_SKELETON`（保存骨架）/ `MODELS`（保存变体）
- `_find_variant_bounds` 退休

### 动画

- 基础动画关键帧（现有 `humanoid_factory.js` / `enemies.js:createHumanoidAnimationSystem` 镜像那套）归骨架层
- 变体 `anims` 预留，`null` 时回退基础动画
- 精细骨架若新增关节（如手指），基础动作（不涉及手指）应可复用；后续扩展

## 精细骨架基底方向（我搭）

- **比例**：写实成人 7.5 头身（当前 ~6.5），腿占身高 ~0.48、臂展 ≈ 身高、写实肩宽 / 腰髋
- **精细度**：低多边形拟真——比当前 Box/Cylinder 堆叠精细（更准肢体锥度、关节球、手脚细节），不追超高面数（游戏敌人要性能）
- **风格**：写实基底 + 轻微游戏风格化（腿略长、姿态有型）
- **三比例版本**：从通用拓扑派生 儿童（缩放 + 儿童比例）/ 成年男（肩宽窄髋）/ 成年女（S 曲线：窄肩收腰长腿），均写实拟真
- 搭出后用户工厂精调 → 冻结 v1

## 迁移

- 现有四变体（v0.79.5）**降为烘焙参考**（比例 / 服饰 / S 曲线程度的参照），不直接迁移
- 我重新搭精细骨架白模基底（替代当前粗糙 `HUMANOID_BASE`）
- 初始 `SKELETON_VERSIONS`：从白模冻结三版本（儿童 / 成年男 / 成年女）
- 初始 `MODELS`：从三版本烘焙四变体裸体（参考现有变体个性化）
- `deriveNode` / `setBone` 逻辑移入 `bakeModel`（仅烘焙时用）；`BODY_PARAMS` / `HUMANOID_VARIANTS` 转为烘焙参数预设

## 测试

1. **工厂 WYSIWYG**：四变体调 size → 保存 → 重载确认字面值写回（保存前后 tree 一致，零误差）
2. **骨架 → 变体**：🦴 加手节点 → ❄️ 冻结 v2 → 🔥 烘焙 v2→新变体，确认手带入、`_skeletonVer` 更新
3. **精细骨架质量**：白模比例 / 精细度达写实基准（迭代视觉确认）
4. **游戏**：campus 地图四变体正常刷出，学生三档 size 系数、教师固定；AI / 碰撞 / 动画正常；CDP 0 错误
5. **server**：固化 `SKELETON_VERSIONS` / `WORKING_SKELETON` / `MODELS` 三 const 写回正确

## 风险

- 精细骨架白模质量需迭代（搭 → 看 → 改）
- 烘焙参数复现现有个性化（仅参考，不必精确复刻 v0.79.5）
- 精细骨架新增关节对动画兼容的影响（关节名一致应可复用，需验证）
- 工厂骨架模式「新增节点」是六足没有的新能力，需实现 + 验证
- 这是较大重构（重做骨架 + 改数据结构 + 工厂两层 + 游戏侧 + server），`writing-plans` 阶段需分阶段实现（如：① 精细骨架基底 → ② 数据结构 + 烘焙 → ③ 工厂两层编辑 → ④ 游戏侧接入 → ⑤ server 固化）
