# 可复用人形敌人管线 + 金福园校园 4 种丧尸设计

- **日期**：2026-07-26
- **状态**：待审阅
- **关联**：`models/enemies.js`、`model_factory.html`、`combat/enemyAI.js`、`maps/campus.map.json`、`server.py`
- **范围档位**：Y（标准）—— 工厂接入 + 基骨架抽象 + 放置工具页

---

## 1. 背景与动机

项目需为金福园小学地图新增 4 种丧尸敌人（学生男 / 学生女 / 教师男 / 教师女）。但更根本的诉求是：**人形敌人的开发流程必须可复用**，不能每规划一种敌人就新造一个轮子。

现有架构本应提供两条工具链：

- **设计工具**：模型工厂（`model_factory.html`）+ 动画展台 —— 设计模型骨架/贴图/动画
- **实现工具**：地图编辑器的敌人放置 + 行为调整 —— 把敌人放进地图、调参数

但调研证实，对人形敌人这两条链都断了。

## 2. 目标与非目标

### 目标

1. 建立一条**可复用的人形敌人开发管线**：设计（工厂+展台）→ 放置行为（工具页）→ 运行（createEnemies），以后新增人形敌人只走 GUI + 数据，不改代码。
2. 作为首批内容，产出金福园校园 4 种丧尸（学生男女 / 教师男女），穿真实校服 / 白领装，体型随机，轻度丧尸化，师生两层强度，初始游荡 + 定时门刷新。

### 非目标（Y 档不含）

- **不统一**现有丧尸（`createAnimationSystem`）与六足动画系统。人形走新建专用动画系统，旧系统零改动。
- **不做**重度丧尸化（缺肢 / 大面积溃烂）。
- **不做**模型工厂的"通用骨骼查找表 / 跨模型共享动画库"（属 Z 档）。

## 3. 现状诊断（调研结论）

### 3.1 两断点 + 一缺层

| 断点       | 现状                                                                                                                                                                                                                                                    | 后果                                                   |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| ① 设计层断 | `zombie_prototype.html` 在 v0.47.0 被删；模型工厂**未加载** `enemies.js`；`MODEL_CONFIGS['enemy']` 仅占位 2 块；`ZOMBIE_CONFIG`（`enemies.js:294-470`）IIFE 私有不暴露；`MODEL_MAP` 无人形；动画展台对 enemy **返回 null**（`model_factory.html:2025`） | 设计人形只能手改 enemies.js 硬编码，无 GUI、无固化闭环 |
| ② 实现层断 | 地图编辑器对 campus 不适用（4 根因）                                                                                                                                                                                                                    | campus 放敌人绕开编辑器                                |
| ③ 缺抽象层 | 无"基骨架+变体派生"；三类模型命名各搞各的；丧尸动画绝对角度 vs 六足 rest-pose 偏移，不统一                                                                                                                                                              | 每种人形只能 copy-paste 整棵 CONFIG                    |

### 3.2 campus 编辑器不适用 4 根因

1. 编辑器只认 `entities[]`，campus 建筑在 `obstacles.footprintBuildings[]`，`importMapJson`（`editor_data.js:181-259`）不读 footprint → 导入后建筑全消失
2. 编辑器**深度耦合程序化 heightmap**（强制 1m/格 PlaneGeometry），campus 是 `flat:true` 无高度图
3. `exportMapJson` schema **无 footprint/flat/gates 等字段** → 导出会清零 campus 所有 OSM 成果
4. campus 走另一条管线（`obstacles.js:3155` 直接读 footprint + `mapLoader.js:83` flat 走 versus 分支）

### 3.3 可复用的现成件（好消息）

- **六足是工厂接入范本**：`hexapod_config.js` 暴露 `window.HexapodConfig`（配置+关节元数据），`hexapod_factory.js` 桥接暴露 `window.HexapodAnims`。丧尸/人形照抄这套 7 步可接入。
- **`solidify` 括号匹配与字段无关**（`server.py:27-58`），扩展到人形/enemies 容易；`solidify_campus` 加 `enemies` 分支只需 ~5 行。
- **`toilet_zone_marker.html` 是敌人放置工具的现成骨架**（Canvas 2D 顶视图 + boundary/建筑底图 + `w2c/c2w` + 区域 CRUD）。
- **`createEnemies`（`engine.js:5328-5469`）已直接读 `currentMapData.enemies`**，campus 加 enemies 段即出敌人，引擎零改。
- **编辑器成熟敌人逻辑可剥离**：`defaultEnemyCfg`（`editor_entities.js:6-56`）、8 字段行为面板（`:442-587`）、3 行为模式、批量编辑、巡逻点 —— 纯逻辑，可搬进独立工具页。
- **`AnimationSystem` 按节点名 `nodeName+'_pivot'` 找 pivot**，骨架同名即可复用动作。

## 4. 总体架构（目标管线）

```
┌─ 设计层 ──────────────────────────────────────────────────┐
│ 模型工厂 + 动画展台                                        │
│  人形骨架/校服贴图/体型参数/动画 可视化编辑 + 展台预览       │
│  Ctrl+S ──solidify(humanoid)──> models/humanoid_config.js  │
└────────────────────────────────────────────────────────────┘
                          ↓ modelType / variant
┌─ 实现层 ──────────────────────────────────────────────────┐
│ 敌人放置工具页 tools/enemy_marker.html (fork toilet)       │
│  campus 顶视图 + 放置敌人 + 行为面板(8字段+3模式) + 巡逻    │
│  + 刷新配置面板(间隔/每批/上限/比例/门)                     │
│  保存 ──solidify(enemies)──> campus.map.json.enemies       │
└────────────────────────────────────────────────────────────┘
                          ↓ currentMapData.enemies + spawnConfig
┌─ 运行层 ──────────────────────────────────────────────────┐
│ createEnemies 按 type 分发 createCampusZombie(...)         │
│ campus_spawner.js 定时从门刷新补到上限                      │
│  → 游戏里出现 4 种校园丧尸                                 │
└────────────────────────────────────────────────────────────┘
```

**核心复用价值**：以后加新人形敌人 = 在 `humanoid_config.js` 的 `HUMANOID_VARIANTS` 加一条 + 必要时 `ADDON_LIBRARY` 加装饰 → 工厂 GUI 编辑预览 → Ctrl+S 固化。零工厂代码改动、零引擎改动。

## 5. 详细设计 —— A 设计层

### 5.1 新增 `models/humanoid_config.js`（纯数据，仿 `hexapod_config.js`）

```js
// ① 基础骨架树（节点名与现有丧尸一字对齐 → 动画系统直接复用）
const HUMANOID_BASE = { name:'root', children:[
  pelvis → torso → neck → head(+l_eye_glow, r_eye_glow),
  l_upper_arm → l_forearm, r_upper_arm → r_forearm,
  l_upper_leg → l_lower_leg → l_foot, r_upper_leg → r_lower_leg → r_foot
]};

// ② 体型参数（工厂"体型滑块"读它，派生多节点 size/pivot/rotation）
const BODY_PARAMS = {
  height: { default:1.4, range:[1.0,1.8] },  // 整体缩放 + 头身比(矮→头大)
  build:  { default:0.5, range:[0,1] },       // 胖瘦 → torso/四肢粗细（女教师取低值=纤瘦）
  hunch:  { default:0.2, range:[0,0.4] },     // 驼背 → torso.rotation.x
  curves: { default:0, range:[0,1] },         // 女性曲线(0=平/1=丰满) → 派生胸部半球大小/臀部加宽/腰部收细（仅女教师启用）
};

// ③ 变体定义（4 种校园丧尸；加新人形敌人 = 加一条）
const HUMANOID_VARIANTS = {
  student_m: { name:'学生(男)', materials:{torso:'polo_white', limb:'skin_zombie'},
               addons:['short_hair_m','red_scarf','polo_collar','polo_placket','polo_cuff_l','polo_cuff_r',
                        'school_badge','shoulder_stripes','shorts_m','shoes_blue'],
               bodyRange:{ height:[1.1,1.5], hunch:[0.1,0.25] } },
  student_f: { name:'学生(女)', materials:{torso:'polo_white', limb:'skin_zombie'},
               addons:['ponytail_f','fringe_f','red_scarf','polo_collar','polo_placket','polo_cuff_l','polo_cuff_r',
                        'school_badge','shoulder_stripes','pleated_skirt_f','shoes_white'],
               bodyRange:{ height:[1.1,1.5], hunch:[0.1,0.25] } },
  teacher_m: { name:'教师(男)', materials:{torso:'teacher_shirt_m', limb:'skin_zombie'},
               addons:['short_hair','tie_opt','glasses_opt','trousers_grey','leather_shoes','briefcase_opt'],
               bodyRange:{ height:[1.55,1.75], hunch:[0,0.05] } },
  teacher_f: { name:'教师(女)', materials:{torso:'blouse_white', limb:'skin_zombie'},
               addons:['bun_f','bust','hips','skirt_grey','leather_shoes','necklace_opt'],
               bodyRange:{ height:[1.55,1.75], hunch:[0,0.05], build:[0.30,0.45], curves:[0.6,0.9] } },
};

// ④ 装饰节点库（addon 定义，按变体 addons 列表挂到骨架指定父节点）
const ADDON_LIBRARY = {
  short_hair_m:  { parent:'head', node:{...} },
  ponytail_f:    { parent:'head', node:{...} },   // 黑色 Cylinder+Sphere 束
  fringe_f:      { parent:'head', node:{...} },   // 齐刘海
  red_scarf:     { parent:'neck', node:{...} },   // 红三角布+结
  polo_collar:   { parent:'torso', node:{...} },  // 红翻领
  polo_placket:  { parent:'torso', node:{...} },  // 白门襟+2纽扣
  polo_cuff_l/r: { parent:'l_forearm'/'r_forearm', node:{...} }, // 红罗纹+白细边
  school_badge:  { parent:'torso', node:{...} },  // 左胸校徽片(贴图)
  shoulder_stripes:{ parent:'torso', node:{...} },// 单侧肩腰斜纹片
  shorts_m:        { parent:'pelvis', node:{...} },
  pleated_skirt_f: { parent:'pelvis', node:{...} },
  shoes_blue:      { parent:'foot', node:{...} },   // 含鞋+袜（深蓝鞋+红袜）
  shoes_white:     { parent:'foot', node:{...} },   // 含鞋+袜（白鞋+白袜红边）
  // 教师装饰节点（teacher_shirt_m/blouse_white 是 torso materialId，非 addon，见 variants.materials）
  trousers_grey:   { parent:'pelvis', node:{...} },
  skirt_grey:      { parent:'pelvis', node:{...} },
  leather_shoes:   { parent:'foot', node:{...} },
  bust:            { parent:'torso', node:{...} },  // 胸部双半球(scale 随 curves)，衬衫材质覆盖显弧度
  hips:            { parent:'pelvis', node:{...} }, // 臀部加宽(scale 随 curves)，裙下弧度
  tie_opt / glasses_opt / briefcase_opt / bun_f / necklace_opt: {...}   // 可选装饰
};
// 注：带斜杠的键名（polo_cuff_l/r 等）为示意简写，实现时拆为独立 key；鞋/袜分别按 l_foot/r_foot 挂载

// ⑤ 关节元数据 + rest pose（统一到 rest-pose 偏移模型）
const JOINT_NAMES = { torso:'torso', neck:'neck', head:'head',
  lUpperArm:'l_upper_arm', lForearm:'l_forearm', rUpperArm:'r_upper_arm', rForearm:'r_forearm',
  lUpperLeg:'l_upper_leg', lLowerLeg:'l_lower_leg', lFoot:'l_foot',
  rUpperLeg:'r_upper_leg', rLowerLeg:'r_lower_leg', rFoot:'r_foot' };
const REST_POSES = { torso:[...], head:[...], l_upper_arm:[...], ... };

window.HumanoidConfig = { HUMANOID_BASE, BODY_PARAMS, HUMANOID_VARIANTS, ADDON_LIBRARY, JOINT_NAMES, REST_POSES };
```

### 5.2 装配函数 `buildHumanoid(variantKey, params)`（工厂与游戏共用）

深拷贝 `HUMANOID_BASE` → 按 `params`(height/build/hunch/curves) 派生各节点 size/pivot/rotation（含头身比；`curves>0` 时腰部 torso 收细、并按曲线值放大 `bust`/`hips` 装饰节点尺寸）→ 套变体 `materials` → 按 `addons` 从 `ADDON_LIBRARY` 追加装饰节点 → 返回 config 树。工厂 `buildFromConfig` 渲染它；游戏 `createCampusZombie({variant,heightM,seed})` 也调它构骨架。

### 5.3 新增 `js/humanoid_factory.js`（桥接层，仿 `hexapod_factory.js`）

暴露 `window.HumanoidAnims = { names, durations, collectRefs, updateFrame, resetState, destroyPivots, restorePlates }`。`collectRefs` 按 `JOINT_NAMES` 从 nodeMap 抓 pivot；`updateFrame(dt,t,elapsed,dur,phaseIdx)` 把动作映射成工厂展台 phase 模型。

### 5.4 模型工厂改造清单（6 项）

| #   | 改动                                                                                                                                    | 位置                                                     |
| --- | --------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| 1   | 加载 `humanoid_config.js` + `humanoid_factory.js`                                                                                       | `model_factory.html:483, 4756`                           |
| 2   | `MODEL_CONFIGS` 加 `humanoid`；modelOptions 加"🧑 人形"                                                                                 | `models/model_configs.js:30` / `model_factory.html:3394` |
| 3   | `MATERIAL_DEFS` 加人形材质(skin_zombie/polo_white/teacher_shirt/eye_glow/...)；`getMaterial` 加人形贴图分支（调 Canvas 生成）           | `model_factory.html:491-528`                             |
| 4   | `getModelAnims` 的 `enemy:null` 旁加 `humanoid: window.HumanoidAnims`；`_buildAnimList` 分类标签按模型分支（人形：待机/移动/攻击/死亡） | `model_factory.html:2025, 2483`                          |
| 5   | **新增"体型参数"GUI 模块**：读 `BODY_PARAMS` 出滑块，onChange 调 `buildHumanoid` 重建（工厂新能力，主要工作量）                         | 新模块                                                   |
| 6   | `server.py MODEL_MAP` 加 `'humanoid': ('models/humanoid_config.js', ...)`                                                               | `server.py:18`                                           |

### 5.5 固化策略

工厂编辑某变体时，前端序列化该变体 override → `solidify` 按 `HUMANOID_VARIANTS['student_m']` 这类小对象定位替换（`_find_config_bounds` 现有括号匹配可直接用）。`HUMANOID_BASE` / `BODY_PARAMS` 稳定少改。

## 6. 详细设计 —— B 内容层（4 种丧尸）

### 6.1 学生校服依据（用户提供，逐字锁定）

**男生**：黑色短碎发（额前碎发整齐、两侧推短）；白色宽松短袖 Polo 衫（珠地网眼涤棉、轻微光泽）；**纯红翻领**；前襟短门襟 + **2 粒白纽扣**；袖口**红罗纹滚边 + 外缘白细条纹**；左胸**绿色小树校徽**（伞状树冠 + 简洁树干）+ 下方**橙色"金福园小学"**；肩→腰**单侧不对称红/粉/绿斜纹色块（不可铺满）**；颈间**鲜红红领巾**（标准结、两尖角垂胸前）；下身**朱红运动短裤**（膝上、松紧腰、裤脚+侧缝白细滚边）；**深蓝运动鞋 + 红短袜**。

**女生**：乌黑长发**单马尾**（红色发绳）+ **齐刘海**；上衣**同男生同款 Polo**；同样红领巾、校徽、单侧斜纹；下身**朱红百褶短裙**（膝上一拳、松紧腰、均匀褶裥、腰头/裙侧白细滚边）；**白运动鞋 + 白短袜（袜口红细边）**。

### 6.2 材质/贴图方案（分部位材质 + 关键 Canvas 贴图）

程序化骨架无法整身 UV，采用分部位材质 + 局部小贴图。基础骨架节点赋材质：torso→`polo_white`、四肢→`skin_zombie`、脚→`shoes_*`、head→`skin_zombie`。

**3 张关键 Canvas 贴图（全局缓存共享，仿 `createZombieMaterials`）**：

- `polo_white`：白底 + 极细珠地网眼纹理（微光泽 roughness）
- `school_badge`：128² 绿树 + 橙色"金福园小学"（贴左胸片）
- `skin_zombie`：白皙底 → 轻微灰绿偏色 + 少量暗斑（轻度丧尸化，不溃烂）
- `shoulder_stripes`：红/粉/绿斜条小贴图，贴单侧肩腰（保证不对称）

纯色材质（红领/短裤/裙/鞋/发/眼等）复用 `MeshStandardMaterial`，DEFS 字典加 ID 即可。

### 6.3 男女师生几何差异（`ADDON_LIBRARY` 节点，见 5.1 ④）

### 6.4 丧尸化叠加（**轻度**，辨认度优先）

| 维度     | 处理                                                        |
| -------- | ----------------------------------------------------------- |
| 皮肤     | `skin_zombie`：白皙 → 轻微灰绿偏色 + 少量暗斑（**不溃烂**） |
| 眼       | `eye_glow` 发光红/橙（丧尸标志，保留）                      |
| 衣物     | **基本完好**，仅少量血污点缀（不撕裂、不破洞）              |
| 体态     | 轻度驼背（hunch 学生 0.1–0.25）、少量随机跛行、轻微歪头     |
| **不做** | 缺肢、大面积溃烂、严重破损                                  |

### 6.5 教师外形（默认白领装）

- **教师男**：短寸发 + 白衬衫（纽扣线）+ 深灰西裤 + 深蓝领带（可选）+ 皮鞋 + 眼镜（可选）+ 公文包（可选）
- **教师女**：盘发 + 白衬衫 + 深灰及膝裙 + 皮鞋 + 项链（可选）；**女性体态**——整体纤瘦（`build` 偏小 0.30–0.45）、胸部隆起（`bust` 双半球 addon，衬衫覆盖显弧度）、臀部隆起（`hips` addon，裙下弧度）、腰肢收细（torso 按 `curves` 收窄），由 `curves` 参数（0.6–0.9）驱动

### 6.6 体型参数化

- `height`：学生 1.1–1.5m（0.85–1.15u）、教师 1.55–1.75m（1.19–1.35u），`seed` 在变体 `bodyRange` 内随机
- **头身比**：矮→头大（1:4，`headScale×1.15`）、高年级 1:5、教师 1:7（`×0.85`）
- `hunch`、肤色深浅、是否跛行 全部 `seed` 随机
- **`curves`（仅女教师）**：0=平 / 1=丰满，驱动胸部半球大小 + 臀部加宽 + 腰部收细；**学生男女不启用**（小孩体型不分性别，仅发型/服装区分）；男教师不启用

### 6.7 师生两层强度 + AI + 刷新

| 类型           | HP  | 速度      | 伤害 | 感知 | 定位     |
| -------------- | --- | --------- | ---- | ---- | -------- |
| 学生（男女同） | 40  | 2.0（快） | 8    | 中   | 弱快群   |
| 教师（男女同） | 120 | 1.0（慢） | 20   | 远   | 慢壮血厚 |

- **AI**：复用现有丧尸 8 状态机（IDLE/PATROL/ALERT/PURSUIT/SEARCH/ATTACK/STAGGER/DEAD），师生仅参数差异，零改
- **刷新（标准档）**：初始游荡 15（spawner 进图按比例在校园可达点生成）+ 每 20s 从随机门刷 6 + 上限 30；比例 学生男 40% / 学生女 35% / 教师男 15% / 教师女 10%。参数写入 `spawnConfig`（见 7.2），工具页可调

## 7. 详细设计 —— C 实现层

### 7.1 敌人放置工具页 `tools/enemy_marker.html`（fork `toilet_zone_marker.html`）

复用样板（Canvas 2D 顶视图 + campus 底图 boundary/footprintBuildings/grounds + `w2c/c2w`）。

| 功能                                          | 实现                                                                                                                                      |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| 7 种敌人选择器                                | student_m / student_f / teacher_m / teacher_f + assault / zombie / hexapod（色块图标）                                                    |
| 放置/选中/移动/删除                           | 圆点（类型色）+ 拖拽 + Delete                                                                                                             |
| 行为面板（剥离 `editor_entities.js:442-587`） | 8 字段 + 3 行为模式(reactive/aggressive/none) + 批量编辑                                                                                  |
| 巡逻点                                        | 选中后切巡逻模式，点击添加，橙色折线                                                                                                      |
| **刷新配置面板**                              | 开关 / 初始数量(initialCount) / 间隔(T) / 每批(M) / 上限(Cap) / 4 种比例 / 门勾选（从 `footprintBuildings.edgeMarks` 的 corridor 门提取） |
| 保存/加载                                     | `POST /api/solidify {type:'enemies', enemies, spawnConfig}` / fetch campus.map.json 回填                                                  |

### 7.2 `campus.map.json` 新增两段

```js
"enemies": [
  // 可选：工具页手放的固定敌人（剧情/固定巡逻型）；初始游荡主要由 spawnConfig 生成
  { "id":"e1", "type":"student_m", "_seed": 12345, "position":[x,0,z],
    "patrolPath":[[x,z]...],
    "cfg":{ "hp":40, "speed":2.0, "viewDist":25, "attackDamage":8,
            "attackCooldown":1.5, "dropRate":0.25, "dropHeal":30, "score":50,
            "reactive":true, "aggressive":false } }
],
"spawnConfig": {
  "enabled": true, "initialCount": 15, "interval": 20, "batch": 6, "cap": 30,
  "ratio": { "student_m":0.40, "student_f":0.35, "teacher_m":0.15, "teacher_f":0.10 },
  "doors": [ ... ]  // 从 edgeMarks corridor 门自动提取，工具页可勾选
}
```

### 7.3 `server.py` 扩展（~5 行）

`solidify_campus` 加分支：`data['enemies'] = payload['enemies']; data['spawnConfig'] = payload['spawnConfig']`。enemies/spawnConfig 是新段直接写，不破坏现有内联格式。

### 7.4 `createEnemies` 扩展（`engine.js:5346` 附近）

```js
} else if (ecfg.type === 'student_m' || ecfg.type === 'student_f'
        || ecfg.type === 'teacher_m' || ecfg.type === 'teacher_f') {
  model = window.EnemyModels.createCampusZombie({ variant: ecfg.type, seed: ecfg._seed });
}
```

**两个关键对接修正**（否则 AI 行为错误）：

1. **enemyType 必须设 'zombie'**：createEnemies 现有 `model.userData.enemyType = ecfg.type`（`engine.js:5377`）会把人形设成 `'student_m'`，而 `enemyAI.js:529` 的 `isZombie` 判断只认 `cfg.type==='zombie' || userData.enemyType==='zombie'` —— 人形会**误走车辆 AI**（PATROL/CHASE/ENGAGE）而非丧尸 8 状态机。必须对人形 4 类型改设 `userData.enemyType = 'zombie'`，变体名另存 `userData.variant = ecfg.type`。
2. **\_noTerrainPitch 判断扩展**：createEnemies 现有判断 `ecfg.type==='zombie' || ecfg.type==='hexapod'`（`engine.js:5380`）不含人形类型，人形会跟随地形俯仰（人形单位应直立）。改为基于 `userData.enemyType==='zombie'` 判断（覆盖所有人形变体）。

其余（cfg 透传 `model.cfg = ecfg`、hp、随机朝向、AI 初始 idle/animRequest）复用现有丧尸路径。

### 7.5 刷新系统新模块 `js/campus_spawner.js`（campus 专用）

`createEnemies` 是一次性调用，定时刷新需独立逻辑：

- 进图时若 `currentMapData.spawnConfig.enabled` → 启动 spawner，**立即生成 `initialCount` 只初始游荡敌人**（按 `ratio` 抽类型，在校园可达点随机落位：避开 `footprintBuildings` 内部、围墙 boundary 内，优先广场/操场/道路）
- 之后每 `interval` 秒检查 `enemies.length < cap` → 从随机 `door`（edgeMarks corridor 门位置）生成 `batch` 只（按 `ratio` 抽类型），调 `createCampusZombie` + 注册 `enemies[]` + ai
- `campus.map.json.enemies`（工具页手放的固定敌人）由 `createEnemies` 直接生成，与 spawner 独立；spawner 只管 `initialCount` + 定时补充
- 每只生成时分配 `_seed`（决定体型/肤色/驼背/跛行等随机外观），存盘可复现
- gameLoop 调 `spawner.update(dt)`；非 campus / 无 spawnConfig 不激活

### 7.6 与现有系统对接

| 系统           | 对接方式                                                        |
| -------------- | --------------------------------------------------------------- |
| 碰撞           | 复用现有丧尸圆柱碰撞（学生半径略小）                            |
| 瞄准/受击/摧毁 | 复用 enemyAI damage 路径：受击→STAGGER，HP0→Die→渐隐移除        |
| LOD            | 复用现有丧尸 LOD 圆柱，颜色按 role（学生灰绿 / 教师深灰）       |
| 性能           | 模板克隆 + 共享贴图 + LOD，上限 30 控开销；校园建筑多需实测帧率 |
| 尺度           | `heightM ÷ METERS_PER_UNIT(1.3)` → 单位                         |

### 7.7 动画系统策略（关键，零回归）

现有丧尸 `createAnimationSystem` 用绝对角度，六足用 rest-pose 偏移。本次 **Y 档不统一旧系统**：

- **新建 `createHumanoidAnimationSystem`**（仿六足 rest-pose 偏移，读 `humanoid_config.js` 的 `REST_POSES`），人形 4 种丧尸共享
- **不动**现有丧尸 `createAnimationSystem` 和六足 —— 零回归
- 动作清单：Idle / Walk / Run（学生快）/ Attack / Stagger / Die + 可选 Limp（跛行）
- 加新动作改动量 ~15–25 行（`asys.define` + engine nameMap + enemyAI animRequest）

## 8. 数据 schema 汇总

**新增全局**：`window.HumanoidConfig`、`window.HumanoidAnims`、`window.EnemyModels.createCampusZombie`、`window.CampusSpawner`

**campus.map.json**：新增 `enemies[]`（消费端 schema，type 用 `student_m` 等变体名）、`spawnConfig{}`
**消费者**：`js/engine.js`(createEnemies) + `js/campus_spawner.js` + `tools/enemy_marker.html` + `server.py`(solidify_campus)

**变体名约定**：`student_m / student_f / teacher_m / teacher_f`（同时是 `HUMANOID_VARIANTS` key、createEnemies type、工具页敌人类型）

## 9. 风险与对策

1. **campus `flat:true` 走 versus 分支**（`mapLoader.js:83`）→ 需运行时验证 versus 模式下 `createEnemies` 仍被调用（`engine.js:5187` 只看 `currentMapData.enemies`，应 OK，但需实测）
2. **工厂编辑人形单节点时动画播放中 pivot 错位**（G9）→ 加"编辑即暂停展台"保护
3. **30 只人形 + 校园密集建筑帧率** → LOD 触发距离实测，必要时降上限
4. **校徽"金福园小学"中文字 Canvas 渲染** → `fillText` 中文需字体可用，测浏览器默认字体；不行则用拼音/英文 fallback 或纯树形校徽
5. **solidify 写 humanoid 多 const 文件** → 优先固化单个 `HUMANOID_VARIANTS[key]` 小对象；`_find_config_bounds` 现取第一个匹配，需确认定位准确
6. **createEnemies 人形 type 对接**（易错）→ 新 type 走 createCampusZombie 后，必须设 `userData.enemyType='zombie'`（否则 AI 误走车辆状态机）+ 扩展 `_noTerrainPitch` 判断，详见 7.4

## 10. 建议实施顺序（供 writing-plans 参考）

1. **P1 核心可跑**：`humanoid_config.js` + `createHumanoidAnimationSystem` + `createCampusZombie` + `createEnemies` 4 type 分支 → 纯代码能在校园跑出 4 种丧尸（先用硬编码测试敌人体）
2. **P2 数据闭环**：`server.py` enemies/spawnConfig 分支 + 手写一份 campus.map.json.enemies 测试数据 → createEnemies 消费验证
3. **P3 刷新系统**：`campus_spawner.js` + gameLoop 接线
4. **P4 工厂接入**：`humanoid_factory.js` + 工厂 6 项改造 + 体型参数 GUI 模块 + solidify humanoid
5. **P5 放置工具页**：`enemy_marker.html`（fork toilet_marker）+ 行为/巡逻/刷新配置面板
6. **P6 精修验证**：校服贴图精修（校徽/斜纹/红领巾）、师生强度调参、CDP + Playwright 验证、帧率实测

## 11. 关键 file:line 索引

- 现有丧尸：`models/enemies.js:294-470`(ZOMBIE_CONFIG) / `:193-290`(createZombieMaterials) / `:472-626`(buildZombieFromConfig) / `:670-873`(AnimationSystem+6动作) / `:881-917`(createZombie) / `:927-938`(导出+注册)
- 工厂：`model_factory.html:491-528`(MATERIAL_DEFS) / `:1432-1635`(buildFromConfig) / `:2000-2028`(getModelAnims, enemy:null) / `:2483-2492`(动画分类标签) / `:3394`(modelOptions) / `:4756`(脚本加载)
- 六足范本：`models/hexapod_config.js:1097-1104`(window.HexapodConfig) / `js/hexapod_factory.js:322-332`(window.HexapodAnims)
- 固化：`server.py:18-22`(MODEL_MAP) / `:27-58`(\_find_config_bounds) / `:91-170`(solidify_campus) / `:193-218`(do_POST)
- 运行：`js/engine.js:5328-5469`(createEnemies) / `:3970-3986`(动画 nameMap) / `combat/enemyAI.js:479-757`(丧尸 8 状态机+moveZombieToward)
- campus：`maps/campus.map.json` / `js/obstacles.js:3155`(读 footprint) / `js/mapLoader.js:83`(flat→versus)
- 放置工具样板：`tools/toilet_zone_marker.html`（Canvas 2D + w2c/c2w + boundary 底图）
