# 🎮 坦克运动 Demo — 3D 坦克对战游戏

> **当前版本：v0.79.37** | 基于 Three.js 的多模块 3D 浏览器游戏 + 地图编辑器
> 支持单人探索和本地双人对战（1P 键盘+鼠标 + 2P 手柄）。
> 游戏效果一览：

- **GLB T-34/85 坦克模型**：双纹理（1P 绿色 + 2P 黄色），GLTFLoader 异步加载，程序化模型仅作回退
- **地貌纹理系统**：Splat Map + 程序化纹理混合，6种地形（草地/泥地/沙地/水泥地/柏油/地砖）
- **程序化草丛系统**：弯曲草叶 + InstancedMesh 优化 + 空间分块 + 距离剔除（FPS 大幅提升）
- **独立地图系统**：.map.json 格式存储，单人模式可选地图
- **3 种建筑**：平房（山墙屋顶+窗框+门+烟囱）、别墅（二层退台+阳台+四面窗）、公寓（底商+住宅层+退台天台）
- **2 种树木**：锥形树、球形树
- **风车磨坊**：十字叶片+连接轴，带旋转动画
- **粒子系统**：火焰/烟雾/爆炸/碎片/炮口焰/火花/曳光弹
- **音频系统**：全套 Web Audio API 程序化音效
- **双人分屏对战**：2个独立视口 + 指向箭头 + 殉爆系统 + 独立大平原地图

---

## 快速开始

### 运行方式

由于加载 `.glb` 3D 模型需要 HTTP 协议，需启动本地服务器。

**统一方案（推荐）**：

```bash
# Windows: 双击 start-server.bat 或命令行运行
start-server.bat

# Linux/Mac: 运行脚本
chmod +x start-server.sh && ./start-server.sh

# 然后浏览器访问 http://127.0.0.1:8080
```

**备选方案（手动）**：

```bash
# 在项目目录下执行
python -m http.server 8080 --bind 127.0.0.1
# 然后浏览器访问 http://127.0.0.1:8080
```

> **端口约定**：统一使用 **8080** 端口，绑定 127.0.0.1。

### 操作说明

| 模式     | 操作                                                                         |
| -------- | ---------------------------------------------------------------------------- |
| 单人     | WASD驾驶 / 鼠标瞄准 / 左键开炮 / ESC返回                                     |
| 双人     | 1P键鼠 + 2P手柄（左摇杆驾驶/右摇杆炮塔/RT开炮）                              |
| 手柄     | 左摇杆驾驶 / 右摇杆炮塔旋转+炮管俯仰 / RT开炮 / 粘滞切换（不动鼠标不回键鼠） |
| 模型预览 | 鼠标拖拽旋转 / 滚轮缩放 / 下拉菜单切换 / ESC返回                             |

---

## 技术栈

| 技术     | 版本/说明                                    |
| -------- | -------------------------------------------- |
| Three.js | 0.160.0 (UMD 构建，本地加载)                 |
| 粒子系统 | fireSmokeParticles.js（火焰/烟雾/爆炸效果）  |
| 音频     | Web Audio API（程序化生成，无外部音频文件）  |
| 部署     | 本地 HTTP 服务器（所有依赖本地化，无需网络） |

---

## 项目结构

```
坦克对战demo/
├── index.html             # 主入口文件（HTML + CSS + JS 游戏引擎）
├── model_factory.html     # 🏭 通用程序化模型编辑器（含 T-34/85 v1.6）
├── map_editor.html        # 🗺 地图编辑器（7阶段完成）
├── three.min.js           # Three.js 库（UMD 构建，~654KB，本地加载）
├── GLTFLoader.js          # GLTF 模型加载器（用于加载 .glb 文件）
├── fireSmokeParticles.js  # 粒子系统模块（火焰/烟雾/爆炸效果）
├── grass.js               # 程序化草丛生成（弯曲草叶 InstancedMesh + 空间分块）
├── fbx-test.html          # FBX 模型测试页
├── glb-test.html          # GLB 模型测试页
├── zombie_prototype.html  # 程序化丧尸模型原型（独立运行）
├── AGENTS.md           # 🤖 Codex 专属协作文档 (v0.61.0)
├── README.md              # 本文件
├── docs/                  # 📄 协作文档（T-34/85 v1.6 看图AI交互记录）
│   ├── t34-85-v1.6-spec-for-vision-ai.md    # 识图AI规范文档
│   ├── t34-85-v1.6-env-deps.md              # 环境依赖说明
│   ├── t34-85-v1.6-feedback-to-vision-ai.md # r1~r13交互反馈
│   ├── t34-85-v1.6-r13-params.md            # r13完整参数表
│   └── t34-85-v1.6-handoff-to-vision-ai.md  # 识图AI交接文件
├── combat/                # PvE 战斗系统
│   ├── enemyAI.js         # AI 状态机（PATROL/CHASE/ENGAGE/FLEE/STUNNED/DEAD）
│   └── scoreSystem.js     # 积分系统（localStorage 持久化）
├── maps/                  # 地图配置文件
│   ├── test_map_01a.map.json  # 单人测试地图（池塘+河流+高地+盆地，地貌纹理版）
│   ├── test_map_01b.map.json  # 双人对战地图（大平原）
│   ├── test_map_02a.map.json  # 单人进阶地图（程序化草丛覆盖版）
│   ├── test_map_03a.map.json  # PvE战斗地图（装甲突击车）
│   └── test_map_04a.map.json  # PvE丧尸地图（2只丧尸GLB版）
└── models/                # 模型文件夹
    ├── modelRegistry.js   # 模型注册表（统一管理+权重随机）
    ├── terrainTextures.js # 程序化地形纹理生成（FBM噪声，6种地形）
    ├── tank.js            # 简化坦克模型（GLB 加载失败时的回退方案）
    ├── t34-85.js          # T-34/85 程序化模型（GLB 加载失败时的回退方案）
    ├── trees.js           # 树木模型（锥形树/球形树）
    ├── buildings.js       # 建筑模型（平房精细化/别墅精细化/公寓）
    ├── windmill.js        # 风车磨坊模型（BoxGeometry十字叶片+连接轴）
    ├── fbx/               # FBX 格式 3D 模型文件
    └── glb/               # GLB 格式 3D 坦克模型（主力使用，GLTFLoader 加载）
```

### 代码结构

```
index.html:
  ├── HTML: #menu-overlay（主菜单）、#game-container（游戏容器）
  │       ├── 主菜单：标题 + 版本号 + 模式选择 + 更新日志
  │       ├── HUD：返回按钮 + 操作提示条
  │       ├── 双人：分屏分隔线 + 对战结果覆盖层 + 方向指示箭头
  │       └── 血条/装填条：Canvas 平面（billboard 始终面向摄像机）
  ├── CSS：响应式菜单、半透明控件、箭头 UI
  └── JS：完整游戏引擎，见下方模块分解

fireSmokeParticles.js:
  ├── DamageEffects 类 — 坦克受伤时的持续火焰烟雾（40火焰 + 30烟雾）
  └── ExplosionEffects 类 — 坦克死亡时的一次性爆炸效果（120火焰 + 80烟雾）
      ├── 火焰粒子：白色/黄色/橙色/红色，AdditiveBlending 混合
      ├── 烟雾粒子：灰色，NormalBlending 混合
      └── 渐隐机制：基于最小生命周期比例平滑淡出
```

### JS 模块分解

```
├── DOM 引用 & 状态变量
├── 音频系统（engine / fire / explosion / hit / debris）
├── 状态机（gameMode: menu | single | versus）
├── 键盘/手柄输入处理
├── 玩家工厂（createPlayer）
├── 场景初始化（渲染器 / 光照 / 地面 / 坦克 / 障碍物 / 摄像机）
├── 地面系统（200×200 Canvas 网格纹理；单人分段地形+河流+池塘+桥梁，双人大平原）
├── 地貌纹理系统（SplatMap + 6种 FBM 程序化地形纹理混合）
├── 程序化草丛系统（弯曲草叶 + InstancedMesh + 空间分块 + 距离剔除）
├── 坦克模型系统（GLB 主力 + 程序化回退，GLTFLoader 双缓存异步加载）
├── 障碍物系统（泊松盘采样 + 6种建筑/树木 + LOD可见性管理）
├── 运动物理（差速驱动 / 加速制动惯性 / 碰撞检测 / 俯仰效果）
├── 火炮系统（炮弹 / 曳光弹 / 炮口焰 / 碎片 / 命中火花）
├── 坦克爆炸系统（大型火焰烟雾 + 殉爆连锁反应）
├── 殉爆系统（坦克爆炸引爆近距离障碍物，3.5米半径）
├── 游戏循环（gameLoop / versusGameLoop）
├── 摄像机（第三人称追尾视角 + 双人分屏）
├── 双人对战系统（分屏渲染 / 血条 / 装填条 / 胜负判定 / 大平原独立地图）
├── 指向箭头系统（透视投影 + 屏幕坐标映射 + behind检测）
└── 事件绑定（resize / ESC 返回菜单）
```

---

## 游戏系统详解

### 世界参数

| 参数           | 值           | 说明                                                    |
| -------------- | ------------ | ------------------------------------------------------- |
| 世界大小       | 200×200 单位 | ±100 边界空气墙；双人对战为平坦平原，单人模式为分段地形 |
| 障碍物数量     | 350          | 泊松盘采样，最小间距 6 单位                             |
| 出生安全区     | 半径 10 单位 | 中心无障碍物                                            |
| 障碍物可见距离 | 65 单位      | 超出则隐藏（性能优化）                                  |

### 障碍物类型

| 类型   | 比例 | 碰撞半径 | 说明                                    |
| ------ | ---- | -------- | --------------------------------------- |
| 锥形树 | 35%  | 0.45     | 0.7~1.6 高度随机                        |
| 球形树 | 35%  | 0.45     | 0.7~1.4 高度随机                        |
| 平房   | 10%  | 0.55     | 山墙屋顶+窗框+门+烟囱（精细化）         |
| 别墅   | 10%  | 0.55     | 二层退台+石墙木墙+阳台+四面窗（精细化） |
| 公寓   | 7%   | 0.55     | 底商石材+白色瓷砖住宅层+退台天台+设备箱 |
| 风车   | 3%   | 0.50     | BoxGeometry十字叶片，绕X轴旋转          |

### 坦克物理

| 参数     | 值          | 说明             |
| -------- | ----------- | ---------------- |
| 履带间距 | 3.2         | 差速转向基准     |
| 最高速度 | 4.0 单位/秒 |                  |
| 加速率   | 6.0         | 同向加速         |
| 制动率   | 10.0        | 反向制动（急刹） |
| 惯性滑行 | 3.5         | 松手后自然减速   |
| 碰撞半径 | 0.55        | 半宽             |
| 俯仰增益 | 0.12        | 加减速车体倾斜   |
| 最大俯仰 | 0.18 rad    | ≈10°             |

### 炮弹 & 战斗系统

| 参数     | 值           | 说明                       |
| -------- | ------------ | -------------------------- |
| 炮弹初速 | 33.0 单位/秒 | 水平分量                   |
| 初始上扬 | 0.3          | 垂直初速（vy），低弹道     |
| 重力     | 1.0          | 平射弹道                   |
| 最大射程 | 300 单位     | 超出自毁                   |
| 装填时间 | 2.0 秒       |                            |
| 伤害     | 20 HP        | 5炮击杀（100 HP）          |
| 碎片数   | 12           | 命中障碍物产生碎块         |
| 碎片寿命 | 3.0 秒       | 渐隐消失                   |
| 殉爆半径 | 3.5 米       | 坦克爆炸触发障碍物连锁爆炸 |

### 坦克爆炸效果（v0.13.5+）

- **受伤效果**（HP < 50）：坦克燃起火焰 + 散发烟雾
- **死亡爆炸**（HP = 0）：大型爆炸火焰烟雾（120火焰+80烟雾）

### 殉爆系统（v0.13.6+）

- 坦克死亡爆炸后，3.5米半径内的障碍物被引爆
- 障碍物被殉爆时产生碎块散开效果（不产生火焰）
- 防止无限递归：殉爆链内部爆炸传入 `skipChain=true`

### 音频系统

全部使用 Web Audio API 程序化生成，无需外部音频文件。

### 摄像机

- **类型**：第三人称追尾视角，FOV 55°
- **位置**：坦克后方 14 单位，上方 10 单位
- **分屏时**：左半屏用 `camera`（P1），右半屏用 `camera2`（P2）

### 双人分屏渲染流程

每帧：reset viewport/scissor → 全屏 → 更新物理 → 左半屏 render → 右半屏 render → 指向箭头

### 指向箭头系统

- **显示条件**：两玩家距离 > 25 单位
- **隐藏条件**：距离 < 20 单位

### 双人对战规则

- 初始位置：P1 (-15, 0)，P2 (15, 0)
- HP：100，每炮 20 伤害，5 炮击杀

---

## 完整版本历史

### v0.79.37 — 人类士兵模型类别（4 变体）+ 专属动画 + 左右镜像修正（2026-08-18）

- **新类别“人类士兵”**：模型工厂 🧍 人形敌人新增 4 变体（全部 v1-成年男骨架烘焙，活人肤色 `skin_live` + 直立动画）：`校园保安`（大檐帽+荧光背心+警棍）、`步枪兵`（迷彩+头盔+战术背心+AK）、`霰弹枪兵`（泵动霰弹枪）、`火箭筒兵`（RPG-7）。服装用 `__cloth__` 占位材质联动换装（藏青/迷彩），Canvas 程序化林地迷彩两侧统一
- **武器**（挂 r_hand，O 轨道驱动姿态）：警棍 0.51/AK 0.67（弧形弹匣前弯+握把向枪托）/霰弹枪 0.77（管状弹仓+泵护木）/RPG 0.98（锥形战斗部+尾喷喇叭口）；帽子/头盔半球 center() 补偿修复刺穿，霰弹枪部件 z 首尾相接修复脱节
- **3 套专属动画集 `deriveSoldierAnims`**（删除 Punch）：
  - **保安**：待机/走/跑单手垂棍；攻击=曲臂蓄力（屈肘 -1.25 举棍过肩水平后引）→ 直臂横扫（躯干转体 ±1.0rad 腰发力，扫弧 2.25rad/129°）+ 弓步蹬地
  - **枪兵**：待机/走/跑双手 low ready（右手握把左手托护木，武器仰角公式 y=-sin(臂角+补偿) 校准枪口指左前地面 28°）；攻击=**步枪贴腮瞄准**（臂全水平枪抬到腮高+头右倾贴枪，眼过准星照门）/ **霰弹枪腰射**；枪口焰 3 连发脉冲 + 躯干后坐抖动
  - **火箭筒兵**：待机斜背（管轴左下→右上，战斗部从右肩露出）；攻击=卸筒上肩（背→肩六轨道过渡）→ 双手握把（真实骨架网格搜索：右手→后把 0.14/左手→前把 0.013）→ 前后双向火焰 + 战斗部 z 0→4.5 射出
- **左右镜像修正（第一人称约定）**：模型面朝 +Z 时 +X=左/-X=右（l_eye 在 +X 证实）；待机枪口左偏 wy+0.4、贴腮头右倾 headZ+0.35、RPG 斜背 ry-0.95 战斗部露右肩、肩扛管位右肩 x-0.22
- **特效**：火焰节点初始 scale 0.001 隐藏 + 轨道脉冲点亮（emissive×3 过曝亮黄白枪口焰）；`humanoid_factory.js` 扩展关节 scale 复位改恢复初始值（切动画火焰归隐）
- **验证**：`verify_poses.js` 16（世界系数值：枪口朝向/贴腮高度/双手握把距离/斜背方向）+ `verify_soldier_anims.js` 20 + 模型结构 22 + 游戏冒烟 0 错误；投影像素级铁证（机匣/头盔同排 15px）；Qwen 视觉复核 4 项
- **改动文件**: `models/humanoid_config.js`（4 变体+14 addon+武器挂载+SOLDIER_ANIM_CFG+deriveSoldierAnims+GUN_CHEEK_AIM/RPG_FIRE_ARMS 镜像）+ `js/humanoid_factory.js`（scale 复位）+ `models/enemies.js`+`model_factory.html`（flash_orange 材质+迷彩贴图+变体切换 bakeModel 路径）

### v0.79.36 — 校园丧尸实装 + 碾压修复 + 瞄准设置 + 地图切换碰撞清理（2026-08-18）

- **校园丧尸实装**: 刷怪丧尸补齐 `cfg.type='zombie'`、HP条、受击白膜、完整 AI 初始化和动画系统；校园丧尸动画集补 `Hit → Stagger` 别名；清掉金福园小学地图里的 4 只旧测试丧尸，正式使用 `spawnConfig` 刷怪
- **碾压系统修复**: 碾压判定提前到坦克-敌人碰撞推离之前，避免距离被推到 1.6 后永远无法进入 1.3；死亡丧尸不再参与碰撞推离，坦克可碾压后直接通过
- **瞄准控制设置**: 首页新增 `⚙️ 设置`，坦克瞄准支持“世界指向（默认）/ 车体指向”，设置保存到 localStorage；键鼠鼠标世界点与手柄右摇杆在两种模式下均正确生效
- **地图切换碰撞清理**: 切换地图时清空 `_campusBuildings` / `_campusBuildingGroups`，修复离开金福园后 01a/04a 炮弹命中虚空碰撞体
- **模型工厂与校园人形**: Torus 默认分段修复，眼镜/项链在工厂可见；眼镜缩小加中梁并贴近头部；项链改为水平绕颈；死亡动画 root 高度按骨架从站立平滑下沉，不再瞬间升高
- **渲染与 UI**: 树木 InstancedMesh 关闭视锥剔除，修复开炮瞬间树冠消失；换弹条防 Q 键重复、切换弹种时立即同步装填状态
- **旧版丧尸攻击修复**: 04a 旧版丧尸动画集使用 `Attack`，引擎攻击映射不再写死 `Swing`，旧丧尸可正常挥击并造成伤害
- **验证**: Playwright 覆盖金福园/01a/04a 切换、丧尸攻击/碾压/血条/动画、设置持久化；0 控制台错误

### v0.79.35 — 丧尸步态交叉循环 + 教师裤管修正 + 男学生短裤白缝线（2026-08-16）

- **步态（用户报告"双脚同时屈膝向后蹬地"）**: 量化定位——旧 Walk 双腿后摆窗重叠 ~1/4 周期（l 正窗 0.17~0.65 ∩ r 正窗 0.11~0.40/0.67~0.80）且双膝全程屈着（≥0.15/0.42）→ 双蹬相。重设计**一迈一撑交叉循环**：后蹬窗严格错开（左 0.20~0.56 / 右 0.77~0.24，一腿 >+0.15 后蹬时另一腿必 <−0.05 前迈，违例帧 0/400）；支撑腿膝伸直蹬地（触地 0.08→蹬地 0.18）、摆动腿屈膝抬脚（Walk 峰 0.62 / Run 峰 0.85）；瘸拖特征保留（右幅值减半前 −0.18/蹬 +0.15 + 膝恒僵 0.40~0.58 不伸直）；左右前迈峰交错 0.45/0.50 半周期
- **裙约束保障**: 新步态幅值落在 v0.79.34 验证包络内（前踢 ≤0.45/0.28、左后蹬 0.30、右后蹬 0.15）——裙底逐帧仿真余量 0.020/0.011 反而更宽松
- **教师裤管（用户报告"上半截戳出来一截"）**: 根因 = v0.79.29 调参漏算渲染层 pivot 补偿（childComp=−pivot，addon 实际位置 = position − 父pivot）——大腿段注释算"裤底到膝 0.345"，实际髋系 0.518 = **膝下 0.172 超长**，屈膝时大腿段底角穿透小腿段 0.12。修正：高 0.46→**0.32** + position −0.115→−0.042 → 底沿真实膝下 0.052（真实膝 = ll.pos−ulPivot+llPivot ≠ 髋−大腿长，浏览器实测校准）；Run 穿透 0.12→0.025（粗盖细落差），后侧 0 开缝
- **男学生短裤白色侧缝线**: 短裤 Box 新增 `ah_sm_seam` 装饰子节点（0.006×0.18×0.028，button_white 纯白，贴双腿外侧面）；`applyWrapScale` 支持 `_deco`（尺寸不改写 + x 吸附 wrap 后半宽贴面）；顺带修 `wrapMax` 收集（新增 `firstWrapNode`，短裤带 children 后旧 `children[0]` 会错拿缝线 0.003 漏掉本体 0.075）
- **验证**: 步态数据层 14（verify_zombie_gait：无双蹬/交叉/伸直蹬地/抬脚/瘸腿/相位）+ 渲染层 11 + 裙 26+14 + 裤管 8 + 缝线 12+9 + 回归 53（烘焙变体 23/Die 15/裤裙 9/贴颈 6）；0 控制台错误
- **改动文件**: `models/humanoid_config.js`（deriveZombieAnims Walk/Run 腿×4、trousers_grey、shorts_m+applyWrapScale+firstWrapNode）+ index/engine/README/CLAUDE/CODEBUDDY/trae/AGENTS(版本同步 v0.79.35)

### v0.79.34 — 女裙收窄 + 圆台化 + 椭圆顶 + 学生裙膝上5cm（2026-08-16）

- **需求**: ①女学生/女教师裙又长又臃肿（裙摆撑开防穿模）②裙改圆台防腿刺破锥面+包裹骨盆 ③顶面椭圆防正面/背面腰部圆弧凸出 ④学生裙膝上5cm
- **复核发现（用户观察验证）**: 裙底平面腿扫掠仅 x±0.075 两窄带 z∈[-0.08,+0.13]（前偏），后半圆富余——且旧裙摆轨道**相位反了**（前踢帧裙后仰帮倒忙，前向需求被自己撑大）。逐帧仿真：锥心前移+跟腿耦合可省 1/3 全宽；旧圆锥在骨盆下方有 **-0.048 腿刺穿带**（被骨盆遮挡不可见）
- **裙摆收窄**: `skirtTracks` 重构为 **0.35×左大腿轨道**（Walk/Run 自动派生跟腿耦合）+ 裙轴 z+0.02 前移 + gapBottom 0.19/0.22→**0.13**——rBottom 0.247/0.277→**0.187**（全宽减 1/3，Run 极限余量 0.014/0.009）
- **圆锥→圆台**: rTop 0.077→**0.157**（=腿r+0.10）——腰口包裹骨盆（半宽 0.15），修腿刺穿，锥面斜率 ~10°→~5°；裙排除出 wrapMax（圆形外层自包裹，混入会把骨盆撑成方板反捅穿裙壁）——副产品 student_f 骨盆恢复原深 0.147
- **椭圆顶圆台（新几何 EllipFrustum）**: 顶椭圆 **rx0.157（盖骨盆宽）×rz0.105（贴合躯干厚度）** 底面保持圆 r0.187——正面腰部圆弧凸出 0.084→0.032（-62%），背面藏进衬衫下摆；`mkEllipFrustum` 在 enemies.js + model_factory.html 两侧同步（16段侧面+双盖+平面UV）
- **学生裙缩短**: 0.32→**0.295**（裙底-0.1725=膝上 0.0498）；教师裙不动（膝上 0.068）
- **角刺出钳制**: 裙变体骨盆顶深≤0.14（隐形内部件零代价）+ 下躯干衬衫盒底深≤0.14/底偏≥-0.01（旧后角距轴 0.215 刺出 8cm→0.033 与圆台持平，正面底缘不变）
- **验证**: 数据层 26（椭圆壁全高扫描/膝上5cm/角刺出量化）+ Playwright 14（顶环椭圆/底环圆/裙长/工厂耦合轨道/0错误）+ 回归 30（Die 贴地 15/裙长 9/贴颈 6）；`artifacts/verify_skirt_space.js` + `verify_skirt_runtime.js`
- **改动文件**: `models/humanoid_config.js`（skirtTracks 耦合+WRAP zRatio+EllipFrustum 裙×2+SKIRT_PELVIS_TD/SKIRT_TLOWER 钳制+wrapMax 排除裙）+ `models/enemies.js`（mkEllipFrustum+case）+ `model_factory.html`（buildEllipFrustum+case）+ index/engine/README/CLAUDE/CODEBUDDY/trae/AGENTS(版本同步 v0.79.34)

### v0.79.33 — 红领巾贴颈 + 袖子稍粗 + 红袖口归位（2026-08-16）

- **需求**: ①学生红领巾侧面看悬空没贴衣服 ②袖子太粗（比胳膊稍粗一点即可）③学生红袖口（袖口圈）落在手腕上——应在短袖末端
- **红领巾悬空根因**: 红领巾 Group position z=**0.1 是旧树遗留值**（旧颈半径 0.12 时代贴颈），新骨架颈仅 r 0.04——整体悬在颈前 0.1。修复 Group z→0.008、结心 0.043（球 r 0.03 与颈相交 0.027）、飘带后缘 0.043——实测结后缘 0.091 < 颈前 0.131 贴合
- **袖子稍粗**: 4 个袖子 WRAP gap 0.008→**0.004**（数据层袖比臂每侧粗 0.004；实测含手臂 rest 旋转 bbox 噪声）
- **红袖口归位**: polo_cuff 旧挂 `l_forearm` position -0.18（旧长袖设计）渲染落手腕——改挂**上臂末端** position -0.07（渲染 y=0.13=短袖底），实测 cuff 中心 0.820 ≈ 短袖底 0.807 + 半高（红圈包袖口）
- **验证**: Playwright 6（贴颈/袖粗×2/cuff 位置×2）+ 回归 38；`artifacts/verify_v7933.js`
- **改动文件**: `models/humanoid_config.js`（red_scarf/polo_cuff×2/袖子 WRAP×4）+ index/engine/README/CLAUDE/CODEBUDDY/trae/AGENTS(版本同步 v0.79.33)

### v0.79.32 — 袖子盖肩 + 血迹改 Canvas 贴图渲染（2026-08-16）

- **需求**: ①学生男/学生女/教师男肩膀裸露（女教师露肩用户无意见）——袖子盖过肩线 ②立体血迹多面体突兀——**用渲染皮肤的方式渲染上衣**（Canvas 贴图：底色+斑驳+血迹），不要立体血迹
- **袖子盖肩**: 短袖加长 0.16→**0.22** + 上移（学生袖顶 1.050≥肩 1.037、教师女 1.239≥1.209）；教师男长袖上臂段 0.34/上移（袖顶 1.240≥1.207）——实测全部盖肩
- **血迹贴图化（皮肤式渲染）**: 新增 `makeBloodyCloth(base, speck, blood)` Canvas——底色+斑驳点（900 个）+ 6 块深红血迹斑块（椭圆 radial gradient 随机旋转压扁）+ 14 飞溅小点 + 3 道细血痕；3 张贴图 `polo_blood`（白底）/`shirt_blood`（蓝底）/`pink_blood`（粉底），DEFS/MATERIAL_DEFS 的 polo_white/shirt_blue/pink_tee 改挂 map（color 白由贴图供色）；**删除全部血迹几何**（胸前 6 薄片+袖子血块，blood_splatter addon 移除）
- **⚠️ 自定义几何补 UV**: RidgeBox/TaperedBox/TaperedHex/Wedge 原**无 UV**（贴图不显示）——enemies 侧 4 个 mk 函数补平面映射 UV（x/bw+0.5, y/h）；工厂侧 4 个 build 函数已有固定 0-1 UV 无需改
- **验证**: Playwright 15（盖肩×3/血衣贴图 map/血迹几何已删/长袖三项/刘海）+ 回归 38；`artifacts/verify_v7931.js`
- **改动文件**: `models/humanoid_config.js`（袖子加长上移+删血迹几何+变体 addons）+ `models/enemies.js`（mk 函数 UV+血衣贴图+DEFS）+ `model_factory.html`（血衣贴图+MATERIAL_DEFS）+ 文档(版本同步 v0.79.32)

### v0.79.31 — 四变体穿上衣（含袖子+平面血迹）+ 刘海圆弧贴头（2026-08-16）

- **需求**: ①学生女刘海直线排布悬浮空中——需圆弧状贴合头部 ②四变体上躯干与四肢同色（皮肤）没穿上衣——学生白短袖 polo / 教师女粉红短袖 T 恤 / 教师男蓝色长袖衬衫，衣服上有血迹（**平面不规则红色斑块，非立体血滴**——用户澄清）
- **上衣系统**: 新增 `VARIANT_TOP`（torso_upper 材质：polo_white/shirt_blue 0x3f6399/pink_tee 0xe38ba0）；学生下躯干 polo 色外放、教师裤裙色扎入（保持）；新材质键 pink_tee/shirt_blue/blood_red 两侧（enemies getHumanoidMat + 工厂 MATERIAL_DEFS）
- **袖子**: `DUAL_LIMB_ADDONS` 双挂 + WRAP 半径联动——学生白短袖/教师女粉短袖（盖肩头）/教师男蓝长袖双段（上臂+前臂，实测盖肩 1.191≥1.207、盖腕 0.604≤0.677、不盖手 0.919≥0.689）
- **平面血迹**: 血滴球 → **薄 Box（厚 0.004）交叠成不规则斑块**（胸前 6 块 rotation.z 各异 + 袖子 1-2 块），深红 0x7a1020，贴前表面微凸
- **刘海圆弧贴头**: 根因 x=±0.115 **超出头半径 0.112**（悬浮）+ 直线排布。重排：块中心 (0.098, 0.0542, 0.001) 贴球面（y=sqrt(r²-x²)）+ **绕 Y ±1.56 朝向头心**——实测中心距头心 0.092（贴球面不悬浮）
- **教师男 Die 补偿**: 长袖袖端下探致四肢更低 → root 高度 0.04→0.09（Die 贴地回归）
- **验证**: Node 14 + Playwright 12（上衣色/袖子存在+覆盖几何/血迹/刘海贴球面）+ 回归 47；`artifacts/verify_v7931.js`
- **改动文件**: `models/humanoid_config.js`（VARIANT_TOP+袖子×4+血迹+刘海+dieRootY）+ `models/enemies.js`/`model_factory.html`（3 材质键）+ 文档(版本同步 v0.79.31)

### v0.79.30 — 学生短裤上移盖骨盆 + 教师女发髻加大凸出（2026-08-16）

- **需求**: ①学生短裤与骨盆之间有空隙——上移一点 ②教师女发髻太扁平——加大凸出
- **短裤上移**: shorts_m position.y -0.1→**-0.06**（⚠️ 渲染 y = position.y + 0.2 pivot 补偿——数值减小是**下移**，方向易反；实测裤顶盖入骨盆 +0.033 消除间隙）
- **发髻加大**: bun_f 半径 0.055→**0.075** + 后移 z -0.078→**-0.1**（直径 0.147、后凸 0.069 不再扁平）
- **验证**: Playwright 实测（裤顶 0.478 vs 骨盆底 0.445 重叠 +0.033/发髻 0.147/后凸 0.069）+ 回归 32；0 错误
- **改动文件**: `models/humanoid_config.js`（shorts_m position/size + bun_f）+ 文档(版本同步 v0.79.30)

### v0.79.29 — 教师裤缩短/女裙缩短+切动画上移修复/领巾结缩小/刘海加宽（2026-08-16）

- **需求**: ①男教师裤子太长比脚低 ②女变体切动画界面裙子上移一截+裙子太长 ③红领巾结大得像红花 ④刘海缺口不够/块窄/位置低有缝隙
- **教师裤**: 大腿段 0.68→**0.46**（中心下移髋下 0.115，裤底到膝）+ 小腿段 0.6→**0.35**（底≈踝）——旧 0.68≈整条腿长（大腿仅 0.3465）致裤比脚低
- **裙缩短+上移修复**: 学生裙 0.425→**0.32**/教师 0.525→**0.38**（提升裙摆露小腿）；**切动画上移根因 = 工厂 collectRefs 把扩展关节 position.y 清零**（裙挂载位 -0.0375/-0.0875 被清）——Die 裙轨道 v0.79.27 已删，该复位不再需要，删除
- **红领巾**: 结 0.07→**0.03** + 飘带 0.06×0.22→0.035×0.11（不再像红花）
- **刘海**: 块宽 0.035→0.045、外移 ±0.05→**±0.115**（内缘 0.0925 缺口覆盖双眼 ±0.083）、上移 y 0.03→**0.055**（与头顶头发衔接，发底-刘海顶差 <0.03 无缝隙）
- **验证**: Playwright 9（裤底≥脚底/裙底高于踝/切动画 Δ=0.0000/领巾结 0.06/刘海缺口/衔接/0 错误）+ 回归 44；`artifacts/verify_v7929.js`
- **改动文件**: `models/humanoid_config.js`（裤×2/裙×2/领巾/刘海）+ `js/humanoid_factory.js`（裙 position.y 不复位）+ 文档(版本同步 v0.79.29)

### v0.79.28 — 饰物降位缩尺寸 + 教师下躯干裤裙色 + 刘海分块露眼（2026-08-16）

- **需求**: ①教师男/学生胸前饰物尺寸过大、位置比肩膀还高 ②教师上下躯干换裤裙色（上衣扎进下装）③学生女刘海完全挡眼——分左右两块留缺口
- **饰物过高的根因（重要）**: snap 贴胸时未考虑 **pivot 补偿**——渲染层子件 position 自动 += -pivot（torso_upper pivot[1]=-0.145 → +0.145），snap y 按几何坐标设置导致**整体抬高半截躯干**（位置落到肩线以上）。修复：`position.y = yy + pivot[1]` 补偿。同时饰物再缩：领带 0.2→**0.15**、校徽 0.055→**0.045**、肩章 0.12→**0.09**、门襟 0.2→0.15、领子 0.06→0.05
- **教师下躯干裤裙色**: bakeModel 对 teacher_m/teacher_f 的 `torso_lower` materialId → trousers_grey（衬衫扎进裤裙语义）；学生 polo 外放保持 skin
- **刘海分块**: fringe_f 单 Box → Group 左右两块（±0.05、宽 0.035），中间缺口 0.03+ 露眼（实测眼 x0.095 落在缺口 0.048~0.112 内）
- **验证**: Node 5（贴胸间隙与 snap 期望值精确一致 0.005/0.006/0.008/0.012——数据层复算为权威）+ Playwright 9（饰物低于肩 0.15+/领带 0.15/裤裙色 0x3a3a42/刘海缺口）+ 回归 56；`artifacts/verify_v7928.js`、`verify_addon_fit.js`（贴胸断言重构：浏览器稀疏顶点切片不可靠→数据层复算）
- **改动文件**: `models/humanoid_config.js`（snap pivot 补偿+饰物尺寸+教师 torso_lower 材质+刘海分块）+ 文档(版本同步 v0.79.28)

### v0.79.27 — 骨盆裤裙同色 + 死亡整体下沉贴地（2026-08-16）

- **需求**: ①骨盆部件颜色改为裤/裙同色 ②死亡时大裙子前摆撑地导致人物浮空——**倒地姿势不变，只把人物整体高度降低**，躯干四肢贴地，裙前摆自然没入地面（用户方案，非旋转/拉长花活）
- **骨盆同色**: 烘焙层新增 `PELVIS_CLOTH` 映射（学生→shorts_red 短裤红 0xb81c28 / 教师→trousers_grey 裤裙灰 0x3a3a42）——v0.79.5"上衣扎进裤裙"语义迁移到新烘焙树（此前 pelvis 材质仍是上衣色）
- **死亡整体下沉**: 根因——Die root 高度末帧 0.475 是 legacy 树躺地值，**新树整体悬空 ~0.31**（躯干/四肢/头全部离地，实测各部位 min.y 0.30~0.35）。修复：删除 v0.79.26/27 初版加的裙轨道（旋转/scale 花活），**Die root 高度末帧按骨架定制**（学生 0.1 / 教师男 0.04 / 教师女 0.12）——躯干贴地（trunkMin ≈0±0.03）、四肢贴地（微穿 ≤9cm 为散落自然）、裙摆圆环自然没入（skirtMin -0.11）
- **验证**: Playwright 15（四变体×无裙轨道/躯干贴地/四肢贴地/裙没入）+ 回归（v7926 9/baked 23）；`artifacts/verify_v7927.js`
- **改动文件**: `models/humanoid_config.js`（PELVIS_CLOTH+bakeModel 骨盆材质+deriveZombieAnims dieRootY 参数+删 Die 裙轨道）+ index/engine/README/CLAUDE/CODEBUDDY/trae/AGENTS(版本同步 v0.79.27)

### v0.79.26 — 发型露眼/衣物收小/裙摆动画/死亡裙前摆没入地面（2026-08-16）

- **需求**: ①发型太低挡眼——像头盔一样后倾露出眼睛 ②裤/裙/胸前配饰太大（配饰能挡头）③裙子在动画中不随身体摆动显僵硬 ④死亡时裙子撑地导致身体悬空——改成裙前摆没入地面、身体贴地
- **发型头盔式后倾**: short_hair_m Group rotation.x **-0.35**（前缘上抬+后缘下压，实测发下缘 y0.944 > 眼 y0.934 露眼）+ y 微调
- **衣物收小**: WRAP gap 裤 0.03→**0.016**（短裤烘焙宽 0.182→0.15）、短裤长 0.26→0.2 改膝上；裙摆 gapBottom 0.34/0.41→**0.19/0.22**（裙摆 r 0.46/0.53→0.25/0.30）；校徽 0.07→0.055、肩章 0.18×0.22→**0.09×0.12**、领带 0.26→0.2、领子 y0.82→0.7 且 0.08×0.06→0.06×0.045
- **裙摆动轨道**（zombieAnims 按变体裙名注入：学生 ah_skirt / 教师 ah_gskirt）: Idle 微摆、Walk 前后 ±0.14+左右 ±0.07（随步态）、Run ×1.4 增强——挂 pelvis 的裙节点由播放器 P/O 表**扩展关节**驱动（enemies/humanoid_factory 收集非 JOINT_NAMES 轨道关节）；切动画复位循环扩展覆盖裙（含 position）
- **Die 裙前摆没入地面**: 裙 rotation.x -1.35（前翻，与 root 前倒 1.57 同轴叠加净 22° 前摆）+ **position.z +0.5**——躺平后局部 z 映射世界 y，裙口下沉穿地（裙底实测 -0.229），身体贴地（bodyMin 0.007）；⚠️ 关键认知：躺平后 position.y 局部是 z 方向（无效），z 才是下沉轴
- **修复游戏裙空几何 bug（重要）**: enemies.js buildHumanoidRig 的 Cylinder case `node.segments || 8`——裙节点 segments 是数组 `[16,1]` → CylinderGeometry radialSegments 数组→NaN→**空几何（游戏裙一直隐形不渲染）**。修复 `Array.isArray ? [0] : segments`。工厂侧本就取 `[0]` 正常
- **验证**: Node 15 + Playwright 6（发型露眼/裙摆幅 0.19/Die 身体贴地 0.007/裙没地 -0.229/裙前翻）+ 回归 35（baked_variants 23/addon_fit 12/upright_game）；`artifacts/verify_v7926.js`（顶点法 bbox——headless 无渲染帧时 Box3.setFromObject 矩阵合成不可靠）
- **改动文件**: `models/humanoid_config.js`（发型/裤裙/配饰/裙轨道+Die 下沉）+ `models/enemies.js`（Cylinder 段数组修复+O 表扩展+play 复位扩展）+ `js/humanoid_factory.js`（O 表扩展+裙 position 复位）+ index/engine/README/CLAUDE/CODEBUDDY/trae/AGENTS(版本同步 v0.79.26)

### v0.79.25 — addon 适配新骨架四项修正（2026-08-16）

- **需求**: ①教师女不再需要旧版楔形胸臀 ②鞋子太巨大（比脚大一丝即可）③发型像斗笠（缩小+双面渲染，下方观察可见）④教师男/学生胸前配饰悬空没贴住衣服
- **教师女去胸臀**: `HUMANOID_VARIANTS.teacher_f.addons` 删 `bust`/`hips`（v2-成年女性骨架自带曲线，楔形是旧树时代补形）
- **鞋子贴脚**: 三种鞋 Box `0.2×0.12×0.32`→`0.118×0.055×0.235`（脚 0.112×0.045×0.225，宽/长各 +0.006/+0.010 防穿模），position 对齐脚心
- **发型适配**: short_hair_m 半球 r 0.22→**0.118**（新头 r 0.089~0.112，斗笠消除）+ mesh 上移 r/2（geo.center() 后半球原点在 bbox 中心，赤道对头心）+ **side:2 双面渲染**（enemies.js/model_factory 两侧渲染层支持 `node.side===2 → mat.clone()+DoubleSide`）；ponytail（圆柱 r0.06→0.035 长 0.4→0.3）/fringe/bun 同步按新头径缩小重定位
- **snap 贴胸机制**: ADDON_LIBRARY def 加 `snap:{y,x,out}`（badge/stripes/tie/placket/collar）——bakeModel 注入时按**各骨架 torso_upper(RidgeBox) 前表面公式**（含脊线分段插值）计算目标高度处的 z 并改挂 torso_upper；x 按半宽插值钳制。配饰在任何骨架上自动贴合不悬空
- **验证**: Node 11 + Playwright 12（工厂实测鞋宽 Δ0.005/长 Δ0.008/底 Δ0.0076 贴脚、发型头顶高出 0.016 直径贴近、DoubleSide、校徽贴胸切片间隙 0.015、领带贴合、教师女无胸臀、0 错误）+ 回归（baked_variants 23/upright_game 全过）；`artifacts/verify_addon_fit.js`（同高度顶点切片法验证贴附——整体 bbox 对斜面躯干不公平）
- **改动文件**: `models/humanoid_config.js`（teacher_f addons+鞋×3+发型×4+snap 参数+bakeModel snap 逻辑）+ `models/enemies.js`/`model_factory.html`（side:2 渲染）+ index/engine/README/CLAUDE/CODEBUDDY/trae/AGENTS(版本同步 v0.79.25)

### v0.79.24 — 四变体新骨架烘焙 + 丧尸专属动画（含衣服发型）（2026-08-16）

- **需求**: 根据 v1-成年男、v2-成年女性、v1-儿童三个骨架烘焙学生男/女、教师男/女四个校园丧尸变体（替换旧变体）；丧尸专属动画不含拳击，除死亡外全带佝偻体态，Walk/Run 一瘸一拐拖行，Run 双臂前伸抬着表现抓猎物；衣服发型沿用早先保留的旧变体 addon 定义（25 件）
- **烘焙管线（humanoid_config 文件尾重写）**: `VARIANT_SKELETON` 映射（学生→v1-儿童 / 教师男→v1-成年男 / 教师女→v2-成年女性）+ `VARIANT_BODY` 体型（teacher_f curves 0.7）+ `bakeModel` 增强为**完整 addon 注入**（镜像/双挂鞋裤/WRAP 包裹联动 build/curves 放大/学生下摆 grow——对齐 buildHumanoid 主装配逻辑），四变体 tree 从裸 21 节点 → 穿衣 28~40 节点
- **丧尸动画集 `deriveZombieAnims`**: 版本动画深拷贝 → 删 Punch（6 动画）+ 驼背 rest 注入 + **Walk 拖行**（左腿正常步幅/右腿膝僵直 0.42~0.58 不弯+右腿摆幅减半+躯干左右摇摆+骨盆跛动，2.2s 慢速）+ **Run 奔袭**（双上臂前伸 -1.25 同相+前臂垂抓 -0.5+头前探+拖行快步，1.0s）+ Stagger 改偏移制 + durations 表。Die 保留骨架版（瘫平无驼背残留）
- **消费端**: 工厂变体模式用 `zombieAnims`（动画表**动态生成**——humanoid_factory collectRefs 按配置 actions 键建 6/7 项列表+categories+durations，原地更新保持引用）；游戏 `createCampusZombie` **直连 MODELS 烘焙树**（新树 l/r 解剖学与动画数据层一致，**去掉 mirrorAnimsForLegacyTree**；DUR 从配置 durations 读取）
- **修复烘焙 NaN**: 下摆 grow 曾把 TaperedBox 9 参数截断为 3 参数（tw/td/ox/oz 丢失→NaN 几何）且教师误 grow（骨架名≠变体名条件错）——改为按 `_variantKey` 判定 + `size.slice()` 只放大底面宽/深保留其余参数
- **验证**: Node 35（烘焙树节点数/双挂/动画集/驼背/拖行/前伸/durations/直立 anims 保留）+ Playwright 23（工厂 8：动画表 6 项无拳击/2200ms/穿衣 mesh36/右膝僵直采样/双臂前伸 -1.19/手在身前；游戏 15：四变体穿衣渲染 28~40 mesh+无 Punch+驼背+Run 前伸+Walk 拖行；0 错误）+ 回归更新（punch2/run_forearm/upright_game 断言适配 v0.79.24 语义 9+13+17 全过）；`artifacts/verify_baked_variants.js`
- **改动文件**: `models/humanoid_config.js`（VARIANT 表+bakeModel 增强+deriveZombieAnims+MODELS 重建+pelvis 修复）+ `js/humanoid_factory.js`（动态动画表）+ `model_factory.html`（变体 zombieAnims）+ `models/enemies.js`（直连烘焙树+DUR 配置化，删镜像调用）+ index/engine/README/CLAUDE/CODEBUDDY/trae/AGENTS(版本同步 v0.79.24)

### v0.79.23 — 奔跑前迈膝弯明显化（2026-08-16）

- **需求**: 奔跑动画腿部前迈时，膝盖弯得更明显一点
- **根因**: 旧值前迈极限（大腿前摆 -0.85）时膝 **-0.3**（负值=过伸反张，直膝棍腿）——既不符合跑步技术（前摆膝保持 30°+ 弯曲）也不符合生理（膝不过伸）
- **修复（×5 副本）**: `l/r_lower_leg` 前迈极限 -0.3→**+0.5**（弯折 29°，前迈腿呈 L 形）；着地过渡 0.05→**0.25**（缓冲微弯）；摆动折叠期 1.85 保留（脚跟收臀）；r 侧半周期平移
- **验证**: Playwright 7（左右前迈膝弯 0.46/0.46 ≥0.4、膝高于踝 Δ0.128 小腿倾斜=弯折可见、髋高于膝 Δ0.138、折叠期 1.80/1.80 保留、0 错误）+ 回归（run_forearm 13/walk_phase 3）；`artifacts/verify_run_knee.js`
- **改动文件**: `models/humanoid_config.js`（Run lower_leg keys ×10）+ index/engine/README/CLAUDE/CODEBUDDY/trae/AGENTS(版本同步 v0.79.23)

### v0.79.22 — 跑步前臂上弯（拳指下巴前方，最低点不低于水平）（2026-08-16）

- **需求**: 跑步时前臂向上弯，拳头指向下巴前方；前臂摆动最低点至少和地面水平，不指向地面
- **根因（几何）**: 前臂净前弯 = |upper.x + forearm.x| 需全程 ≥ 1.57（90°）。旧值后摆 -1.70（净 1.20 ✗ 指向地面）/过渡 -1.52（净 1.37 ✗）；上臂后摆 +0.5 会抵消前臂屈肘
- **修复（×5 副本）**: forearm x 后摆 -1.70→**-2.10**（净 1.60° 略高于水平）/过渡 -1.52→**-1.75**/前摆 -1.35→**-1.55**（净 2.05=上仰 27°，拳指下巴前方）；r 侧反相同步
- **验证**: 数学自检 5/5（净前弯全程 ≥90° 步长 0.02 采样）+ Playwright 4（实测前臂方向 yDir 最低 +0.025 高于水平/前摆拳高于肘 Δ0.154/拳 y0.88 距下巴 ~0.1/0 错误）+ 回归（run_forearm 13 更新断言/punch2 8/walk_phase 3）；`artifacts/verify_forearm_up.js`
- **改动文件**: `models/humanoid_config.js`（Run forearm keys ×10）+ index/engine/README/CLAUDE/CODEBUDDY/trae/AGENTS(版本同步 v0.79.22)

### v0.79.21 — 步行左右步距不均修复（r_upper_leg 相位错 0.25）（2026-08-16）

- **需求**: 用户观察 Walk 左腿和右腿迈的幅度不一样
- **根因**: 数值本身左右对称（r 是 l 的平移），但**相位错 0.25 而非 0.5**——`r_upper_leg` 前摆极值在 t=0.25（应在 t=0.5），左右脚迈步节拍 0.25/0.75 交替不等距，右腿迈步时左腿尚未蹬到位 → 一步大一步小。v0.79.11 步态数据化引入，数值对称性检查发现不了相位错误（r_lower_leg 错相 0.5 正确、Run 正确，仅 Walk 的 upper_leg 有此 bug）
- **修复（×5 副本）**: `r_upper_leg` 改为 l 的精确半周期平移 `0:0.12, 0.25:0.25, 0.5:-0.45, 0.75:-0.08, 1:0.12`（数学等价 r(t)≡l(t±0.5)）；顺带 `pelvis.y` 单峰（每周期只颠一次）改双峰 0/0.03 两步两颠
- **验证**: Node 15（5 副本 r(t)≡l(t±0.5) 数值恒等 maxErr=0 + pelvis 5 键）+ Playwright 3（工厂实测左右踝前摆极值严格交替 R@42→L@86→R@130，间隔恒 44 帧≈半周期 43.75，修复前为 22/66 不等距）+ 回归（verify_run_forearm 13 + verify_punch2 8）；`artifacts/verify_walk_phase.js`
- **改动文件**: `models/humanoid_config.js`（Walk r_upper_leg+pelvis ×5）+ index/engine/README/CLAUDE/CODEBUDDY/trae/AGENTS(版本同步 v0.79.21)

### v0.79.20 — 奔跑前臂向前中线内收（2026-08-16）

- **需求**: 奔跑时前臂向身体前方中线收一点（跑步摆臂标准姿态：手朝前中线方向摆动，不过中线）
- **Run 前臂 z 轴内收轨道（×5 副本）**: 新增 l/r_forearm rotation.z 轨道，与屈肘摆臂同相位——前摆时手向前中线收拢 -0.20 rad（l 侧）、后摆微收 -0.06；r 侧反相（前摆 0.06/后摆 0.20）。工厂树 l 侧 z 负=内收；游戏侧 mirrorAnimsForLegacyTree z 取负后方向仍向中线（镜像对称自动适配，实测 +0.07/+0.19）
- **验证**: Playwright 13（工厂屈肘 5 项+z 内收 4 项、游戏 Run 屈肘+z 镜像内收、Walk 前臂归零回归、0 错误）+ verify_punch2 回归 8/8（verify_punch.js 为 v0.79.17 首版脚本，其值断言 0.42/-1.35 在 v0.79.18 已改 0.52/-1.4，被 verify_punch2 取代）；`artifacts/verify_run_forearm.js` 扩展 z 断言
- **改动文件**: `models/humanoid_config.js`（Run z 轨道×5）+ index/engine/README/CLAUDE/CODEBUDDY/trae/AGENTS(版本同步 v0.79.20)

### v0.79.19 — 跑步摆臂屈肘 90° + 切动画关节残留修复（2026-08-16）

- **需求**: 步行两臂伸直没问题，但跑步胳膊还是直的就违和——查跑步摆臂技术（肘关节弯曲约 90°，前摆手至下颌/肘角略开，后摆肘向后上方拉/肘角收紧）
- **Run 前臂屈肘轨道（×5 副本）**: 新增 l/r_forearm rotation.x 轨道——屈肘 90° 基线（-1.52）+ 摆臂动力学：前摆时肘角甩开 -1.35（77°）、后摆时收紧 -1.70（97°），左右反相与上臂摆动同步；上臂 ±0.5 摆幅不变；Walk 保持直臂（用户确认无问题）
- **切动画关节残留修复（重要）**: 游戏 `_updateLayer` 只写当前动画的轨道——Run（新写前臂）切 Walk（无前臂轨道）后**前臂永远弯着**；Die 后 head z 0.7 残留同类。修复：`createHumanoidAnimationSystem` 包装 play——切动画时把**非新动画轨道的关节**复位到创建时树静态姿态（uuid 对比轨道 target；hunch 驼背等树静态保持）。工厂侧本就有 resetState 不受影响
- **codemod 事故与修复**: 首版 Run 插入 codemod 把轨道插到数组 `]` 之后（对象里出现非法元素）+ compact 缺逗号——写括号匹配修复脚本移正位置（`artifacts/fix_run_insert.js`），eval 自检 5/5 恢复；顺手重排 4 个 Punch 块缩进对齐
- **验证**: Node 30（5 副本轨道/反相/Walk 无前臂/Punch 未损）+ Playwright 8（工厂屈肘 97°/77°/平均 87°、游戏 Run 屈肘、Walk 前臂 0 复位、0 错误）+ 全量回归（verify_punch2 8/verify_punch 12/verify_upright_game 17——其中 rest head:z 断言更新为镜像语义 -0.08）；脚本 `artifacts/verify_run_forearm.js`
- **改动文件**: `models/humanoid_config.js`（Run 前臂轨道×5+Punch 缩进）+ `models/enemies.js`（play 包装复位）+ index/engine/README/CLAUDE/CODEBUDDY/trae/AGENTS(版本同步 v0.79.19)

### v0.79.18 — 拳击力度感增强（蓄力极限：肘拉到躯干后方）（2026-08-16）

- **需求**: 拳击力度感不够，拳头收回蓄力的距离不够——收回到极限，让右胳膊肘位于躯干后方
- **蓄力极限（t=0.45）**: r_upper_arm x -0.3→**+0.85**（上臂后摆 49°，肘部拉到躯干后方 0.21 单位/肩后 0.15）+ r_forearm x **-2.05**（极限屈肘 117°，拳收到肩侧 z≈-0.01，较护卫位收回 0.19）+ 扭腰反向拧至 **-0.32** + 躯干微后仰 -0.06（拉弓式预拉伸）+ 左护拳收紧 -0.35/-1.95 + 后膝深弯 0.65 重心后坐
- **爆发增强（t=0.55）**: 蓄力→出拳上臂摆幅 **2.25 rad**（0.85→-1.4，此前仅 1.05），拳行程 0.57m 于 0.1s 内完成（工厂实测 Δz 0.44/游戏 0.63）+ 扭腰 -0.32→**+0.52**（总幅度 0.84 rad，较旧 0.6 增 40%）+ 躯干前倾 0.2 + 后腿蹬直 0.65→0.08 + 前腿踩实 -0.38 + 重心下沉 -0.06
- **验证**: Node 35（5 副本蓄力/爆发值+摆幅>2.2+旧值清除）+ Playwright 工厂 5（肘在躯干后 d=-0.21/肘在肩后 -0.15/拳收回 -0.19/摆幅 0.44/拳在身前 0.51）+ 游戏 2（镜像摆幅 0.63/Die 外张回归）+ 0 错误；脚本 `artifacts/verify_punch2.js`（独立采样重置，修上一版累计采样 bug）
- **改动文件**: `models/humanoid_config.js`（Punch 关键帧重写 ×5 处）+ index/engine/README/CLAUDE/CODEBUDDY/trae/AGENTS(版本同步 v0.79.18)

### v0.79.17 — 攻击拆分"挥击"+ 新增"拳击"动画 + legacy 树镜像修复（2026-08-16）

- **需求**: 骨架基础动画"攻击"改名"挥击"（Swing），另加"拳击"（Punch）动画——右手举起握拳、右胳膊向后拉蓄力、然后向前直拳，同时左胳膊护卫、腰在过程中扭转、腿部前后分立（右直拳 orthodox 站架，参考拳击直拳技术：左脚前/右脚后/转髋带动右肩/护手）
- **Punch 13 轨道**（1.0s，BASE_ANIMS+4 版本副本同步）: torso y（扭腰 -0.18 蓄力→+0.42 爆发右肩前送→回收）+ torso x（前倾偏移制 restKey）+ torso_upper y（腰上部跟随，工厂有/游戏 legacy 无）+ head y（-0.18 反向保持看目标）+ r_upper_arm/r_forearm x（护卫 -0.45/-1.75→后拉 -0.3/-1.85→爆发 -1.35/-0.25 伸直→收回）+ l_upper_arm/l_forearm x（护卫全程，出拳瞬间收紧 -0.62/-1.98）+ l/r_upper_leg x（站架左前 -0.3/右后 +0.25，冲击时前踩后蹬）+ l/r_lower_leg x（前膝微弯/后膝蓄力 0.55→蹬直 0.15）+ pelvis y（重心微沉 -0.04）
- **Attack→Swing 改名**: humanoid_config 5 处 actions 键（codemod 括号匹配，compact 1 + pretty 4）+ humanoid_factory 列表（7 动画 1/7~7/7，攻击分类含挥击+拳击）+ enemies.js DUR + engine.js 丧尸攻击 nameMap `attack:'Swing'`
- **legacy 树左右镜像修复（重要发现）**: HUMANOID_BASE 系（游戏用）l_/r_ 命名与新数据层（工厂用）镜像——legacy l_upper_arm x=-0.3、新树 x=+0.171，均面朝 +Z；rotation **y/z 轴在两树语义相反**（x 轴与位置不受影响）。此前所有动画只用 x 轴+位置轨道所以从未暴露；Punch 首次用 y 轴扭腰即触发。修复：enemies.js `mirrorAnimsForLegacyTree()`——游戏消费时对 rotation y/z 轨道值取负 + rest y/z 键取负（pelvis:y 位置键排除），两侧动作协调（游戏侧左右手互换但出拳/扭腰/护手方向正确）；顺带修复游戏 Die 双臂 z 外张自 v0.79.11 起实际向内插身体的隐性 bug
- **验证**: Node 155 断言（5 处 Swing 6 轨道/Punch 13 轨道/t 单调/扭腰峰值/站架）+ Playwright 工厂 6（列表 7 项/右拳前伸 Δz0.23/护卫拳高位/扭腰右肩前送 Δ0.14/左拳护卫 Δ0.10/Swing 回归）+ 游戏 6（镜像后扭腰出拳侧肩前送 Δ0.11/前臂前伸 Δ0.30/Die 外张修复 d0.10/rest=-0.09/Walk 回归）+ 0 错误
- **改动文件**: `models/humanoid_config.js`（Attack→Swing×5+Punch×5）+ `js/humanoid_factory.js`（7 动画表）+ `models/enemies.js`（DUR+mirrorAnimsForLegacyTree+接入）+ `js/engine.js`（nameMap Swing）+ index/README/CLAUDE/CODEBUDDY/trae/AGENTS(版本同步 v0.79.17)

### v0.79.16 — 变体名加"校园丧尸"后缀（2026-08-16）

- **需求**: 工厂体型参数面板变体下拉的名称后加"校园丧尸"后缀，与"人形敌人"总类名区分（当前四变体都是校园丧尸系，未来非丧尸人形可加直立变体并列）
- **改动**: `models/humanoid_config.js` `HUMANOID_VARIANTS` 四个 name：`学生(男/女)`→`学生(男/女)·校园丧尸`、`教师(男/女)`→`教师(男/女)·校园丧尸`。name 仅工厂变体下拉消费（`model_factory.html` variantOptions）；游戏侧全部用内部键（student_m 等，userData.variant/solidify 定位），零影响
- **验证**: Playwright 工厂切人形敌人 → 体型参数变体下拉断言四项带后缀 + 切换变体加载 + 0 控制台错误
- **改动文件**: `models/humanoid_config.js`(4 name) + index/engine/README/CLAUDE/CODEBUDDY/trae/AGENTS(版本同步 v0.79.16)

### v0.79.15 — 模型菜单更名"人形敌人"（2026-08-16）

- **需求**: 考虑到人形敌人不一定都是丧尸，模型工厂选择模型菜单中的"校园丧尸"更名"人形敌人"
- **改动**: `model_factory.html` modelOptions 下拉 `'🧟 校园丧尸'` → `'🧍 人形敌人'`（图标 🧟 丧尸→🧍 人形与语义一致）。内部键 `humanoid` 不变，骨架/烘焙/动画管线零改动；代码注释中的"校园丧尸"字样保留（描述的是校园丧尸系变体数据）
- **验证**: Playwright 加载 model_factory.html 断言下拉选项文字"🧍 人形敌人" + 切换加载正常 + 0 控制台错误
- **改动文件**: `model_factory.html`(modelOptions) + index/engine/README/CLAUDE/CODEBUDDY/trae/AGENTS(版本同步 v0.79.15)

### v0.79.14 — 基础骨架动画直立化（驼背移至丧尸烘焙层）（2026-08-16）

- **需求**: 模型工厂骨架(共通)模式的待机/走路/跑步默认驼背（髋部前弯），但人类敌人不一定都是丧尸——基础骨架动画应直立，丧尸模型烘焙时再加驼背
- **直立化**（5 处 rest 基线三键归零 torso:x/neck:x/head:z）: `REST_POSES` + 4 个 `SKELETON_VERSIONS[key].anims.restPoses`（手臂外张 z ±0.09 与各自 pelvis:y 保留）。Attack 轨道 restKey 偏移制自动适配（直立人前弯峰值 0.3 / 丧尸 0.5）；Run torso 绝对前倾轨道两态共用不变
- **丧尸驼背烘焙注入**: MODELS 的 anims 运行时从版本深拷贝继承（`humanoid_config.js` 文件尾），新增 `ZOMBIE_HUNCH = {torso:x 0.2, neck:x 0.22, head:z 0.08}` 在继承后 `Object.assign` 注入 restPoses——游戏丧尸与工厂变体(丧尸)动画视觉与旧版完全一致；深拷贝隔离不污染版本直立基线
- **legacy 树静态驼背归零**: `HUMANOID_BASE` 字面量 torso/neck/head 固化 rotation（0.2/0.22/0.02+0.08）归零（三副 SKELETON_BY_VARIANT 树运行时深拷贝自动跟随）——消除与新 hunch 公式的双重驼背
- **hunch 参数语义**: `deriveNode` 从 `rotation[0]+(hunch-0.2)` 改为 `rotation[0]+hunch`（0=直立，正值=驼背量；旧公式 hunch<0.2 会产生后仰）。游戏 Idle/Walk/Run 无 torso 轨道→保持树静态驼背= hunch（student 0.1~0.25 随机 / teacher 0~0.05 近直立，与旧版行为一致）
- **验证**: Node 数据断言 27/27（REST/版本直立 + MODELS 注入 + 隔离 + hunch 派生）+ Playwright 工厂 7/7（骨架共通 Idle/Walk torso=0 直立 / Run 前倾 0.234 / 变体丧尸驼背 0.2+0.22）+ 游戏侧 17/17（4 变体静态驼背 + asys rest 基线 + 0 错误）
- **改动文件**: `models/humanoid_config.js`（REST_POSES + 4 版本 + ZOMBIE_HUNCH 注入 + deriveNode + HUMANOID_BASE 三节点）+ index/engine(版本同步 v0.79.14)

### v0.79.13 — 攻击动画双关节弯腰（2026-08-14）

- **髋+腰链式前弯**: 用户指出攻击下挥时只有腰（上下躯干交界）在弯、髋（下躯干-骨盆交界）无动作显僵硬。Attack 新增 `torso`（髋）rotation.x 轨道（restKey `torso:x` 偏移制，0=驼背基线）：举臂蓄力时髋**后仰 0.12 预拉伸** → 下挥瞬间**爆发前弯 +0.30** → 回收；腰部（torso_upper）0.5→0.42 微调。下挥峰值双弯合计 ~0.78 rad（45°），力量从髋→腰→臂链式传导
- **游戏侧顺带改善**: 实测发现游戏 legacy 树（SKELETON_BY_VARIANT）**无 torso_upper 节点**——旧 Attack 的腰部轨道在游戏里一直是 no-op（躯干完全不动）；本次新增的髋轨道（torso，legacy 树存在）让游戏丧尸攻击首次有躯干动作。legacy 树补 torso_upper 迁移记为已知问题
- **验证**: Playwright 工厂骨架模式 Attack 时序采样（髋 0.20→0.44 峰值→0.19 回落 / 腰 0→0.35 峰值→0 回落 / 手最低 0.583 无插地 / rootY 恒定无上浮）+ 时间膨胀定格峰值帧 Qwen 视觉评估（链式双弯✓ 下挥力量感✓ 无插地✓）+ 游戏侧 student_m/teacher_f 双变体髋轨道生效 + 6 动画全回归 0 错误
- **改动文件**: `models/humanoid_config.js`（Attack 6 轨道 ×5 处）+ index/README/CLAUDE/CODEBUDDY/trae/AGENTS(版本同步 v0.79.13)

### v0.79.12 — 死亡动画瘫平重做（2026-08-14）

- **展台骨盆扭转修复（根因）**: `humanoid_factory.js` 的 collectRefs/resetState 复位循环把位置 rest 键 `pelvis:y`（骨盆高度 0.5）误当**旋转 y** 应用 → 展台动画一启动骨盆就被扭转 28.6°，死亡躺姿侧倾、只有单肩单脚蹭地。新增 `_rotRestY` 辅助排除位置键（顺带修复所有展台动画的隐性扭转）
- **死亡关键帧重做**（BASE_ANIMS + 4 骨架版本副本同步）: ①前倒 90° 时拉直 REST 驼背（torso 0.2→0 / neck 0.22→0.05），脊椎平摊不再"头朝下栽"；②双臂**外张**（修复符号反了导致的"胳膊内收插进躯干"）：左臂张 ~54°/右臂 ~34°；③**屈肘**且左右不等角（左 ~23°/右 ~32°），手落至胸脚同平面贴地；④头侧转贴地（head z→0.7，侧脸颊着地）；⑤髋微屈压脚贴地 + 双腿微外分（左 0.1/右 0.16）+ 膝微屈放松；⑥膝先屈再倒（0.25s 屈膝 0.35 失稳感）
- **root 高度轨道重写**: 旧轨道 t0=0 与游戏树 root 自然高度 0.75 不符 → 游戏内死亡**瞬间瞬移下沉 0.35**；改为 0.75→0.475（游戏树坐标系躺地补偿，工厂展台被逐帧贴地覆盖不受影响）
- **已知残留**: 游戏侧旧 HUMANOID_BASE 树（儿童头大位低）俯卧时头部微插地 ~0.1（1.5s 尸体展示期内，共享关键帧无法兼顾新旧树拓扑）
- **验证**: Playwright 骨架/变体双模式 ×（死亡终态关节坐标/倒地中间帧/死亡后回待机复位/Walk 对称回归）+ 游戏侧三变体 createCampusZombie Die 管线 + Qwen 视觉评估（平躺摊平/双臂外张屈肘不等角/头侧转贴地/无僵硬 全部确认）+ 0 控制台错误

### v0.60.0 — 狙击模式+动态天空系统（2026-06-15）

- **狙击模式**: 右键切换第一人称, 指挥塔视角FOV25°, 自由观察±60°仰角-45°俯角, 0.0015灵敏度精瞄
- **炮口跟随**: 屏幕中心射线投射驱动炮塔, 视线到哪里炮口跟到哪里; 退出时cameraYaw对齐炮管朝向
- **俯视小地图**: 左下角圆形线框, 车体朝向+三角车首, 上方=摄像机指向, HP颜色红→绿
- **动态天空 sky.js**: 倒置球体渐变着色器(天顶深蓝→地平线淡蓝白), 太阳光晕, 两层FBM噪声云层飘移
- **性能**: 零纹理纯着色器, ~4100顶点, <0.5ms/帧; 地图尺寸自适应; 围墙移除

### v0.79.11 — 人形动画系统重构（2026-08-14）

- **每骨架一套独立动画（管线架构落地）**: `humanoid_config.js` 新增 `BASE_ANIMS`（基本动画模板：restPoses + 6 动作关键帧），每个 `SKELETON_VERSIONS[key].anims` 深拷贝独立一份（restPoses 骨盆基线 = 该骨架 pelvis 高度），`MODELS[变体].anims` 烘焙时继承所属骨架；`enemies.js` 与 `humanoid_factory.js` 播放器全部数据驱动化——**消除"双份关键帧镜像"技术债**（顺带修复：游戏侧此前还是 v0.79.3 之前未同步的反向步态）
- **步态按人体数据重设计**: 走路 髋前屈 26°/后伸 14°/摆动期膝屈 63°；跑步 49°/20°/86°（脚跟踢臀）；对侧摆臂（交换左右臂曲线）；膝弯符号修复（v0.79.3 只翻大腿没翻小腿的遗留）；手臂外张基线 5°（±0.09）
- **攻击重做**: 慢举双手（腰不动）→ 0.1s 快速前挥 + 上躯干弯腰。新增 `torso_upper` 关节（pivot 在腰线）+ **绑骨层级迁移**（neck/双臂移挂 torso_upper，弯腰时头颈手臂自动跟随）；JOINT_NAMES 补 torso_upper
- **死亡重做**: 前倒平摊贴地（程序化补偿 0.072）+ 手臂自然散落（俯卧后对称参数 l z=-0.3 / r z=+0.3）；修复 pelvis 位置切换残留（collectRefs 复位到骨架基线）
- **骨架编辑工作流**: 移除"工作骨架"概念（默认编辑 = v1-成年中性基础骨架；冻结按钮改名"冻结分支"）；删除 v1-成年女骨架（teacher_f 重定向 v2-成年女性）
- **其他**: Shift 精细滑动重写（所有 number 滑杆通用 + input 兜底）；`window._doSave`/`window._deleteSkeletonVersion` 暴露供测试
- **验证**: Playwright 动画驱动数值断言（关节角度/贴地高度）+ 0 控制台错误

### v0.79.10 — 骨架命名版本保存修复（2026-08-14）

- **修复命名版本保存丢失**: 骨架模式下选中命名版本（如 v1-成年男）编辑后点保存，`_doSave` 此前**无条件写回 WORKING_SKELETON**（工作骨架）并固化 `humanoid_skeleton`——修改进了工作骨架，命名版本文件不变，强制刷新即"丢失"。修复：按 `_humanoidSkelVer` 分流——选中命名版本 → 写回 `SKELETON_VERSIONS[key].tree` + `humanoid_versions` 整体固化；工作骨架 → 原路径 `WORKING_SKELETON` + `humanoid_skeleton`
- **暴露**: `window._doSave`（供测试/调试）
- **验证**: Playwright 全链路（切 v1-成年男 → 改 pelvis posY 0.375→0.5 → 保存 → 内存 0.5 → **刷新后源文件仍 0.5**）+ 0 控制台错误

### v0.79.9 — 骨架版本解耦 + 删除功能（2026-08-14）

- **骨架解耦（修复污染链）**: 定位"编辑/保存一个骨架版本影响所有版本"根因——humanoid_config.js 中 v1-男/女/儿童 原为 `_deriveProportion(WORKING_SKELETON, ...)` 运行时派生，页面每次加载从工作骨架重算，编辑工作骨架即传导到所有版本；且固化流程在整体字面量之后残留一组 v0.79.6 逐条赋值（运行时覆盖正确数据）。已**删除重复赋值段**，四个 v1 版本 + 新冻结版本全部为**独立字面值**（互不影响，编辑/保存各自独立）
- **新增删除功能**: 模型工厂骨架模式新增「🗑️ 删除当前版本」按钮——确认后删除该版本 + 通过 `/api/solidify humanoid_versions` 固化到源文件 + 版本下拉自动刷新
- **数据**: v1-成年中性/男/儿童恢复 v0.79.6 原始（pelvis posY 0.375）；v1-成年女 + v2-成年女性-2026-08-14 保留用户编辑数据（0.5）
- **验证**: Node vm 数据断言全过 + Playwright 页面运行时 0 错误 + 删除完整链路实测（临时版本 6→5、confirm 弹窗、源文件无污染）

### v0.79.8 — 模型工厂 Three.js 本地化（2026-08-13）

- **CDN→本地**: 用户报模型工厂 `ERR_QUIC_PROTOCOL_ERROR`（three.module.js / OrbitControls.js 加载失败，unpkg CDN 网络层问题）。已将 importmap 三个 CDN 依赖本地化：`js/three.module.js` + `js/addons/controls/OrbitControls.js` + `js/addons/geometries/RoundedBoxGeometry.js` + `js/lil-gui.esm.js`（均从 unpkg three@0.160.0 / lil-gui@0.18.0 原样下载，无内部外部依赖）
- **效果**: 模型工厂完全离线可用，不再受 CDN/QUIC 干扰
- **验证**: Playwright 0 控制台错误 + canvas/modelRoot/部件树正常 + 网络面板 0 unpkg 请求

### v0.79.7 — 模型工厂坐标轴修复 + 方位标识开关（2026-08-13）

- **坐标轴 X/Z 标反修复**: 曾为适配六足战车朝向做 X↔Z 交换（红线标 Z、蓝线标 X），与部件参数标准坐标系冲突，导致"改部件 z 数值却动 x 方向"的误解；已改回标准 Three.js 右手系（**红=+X / 绿=+Y / 蓝=+Z**），部件参数与标签一致
- **方位标识开关**: 底栏新增「🧭 坐标轴」按钮，可随时隐藏/显示坐标轴线条与方向标签（仿 toggle-helpers 模式，axesGroup.visible 控制）
- **顺带修复**: engine.js 调试信息版本号从遗留的 v0.77.0 同步为 v0.79.7
- **验证**: Playwright 加载 model_factory.html 0 控制台错误 + 开关点击文字切换正确（隐藏↔显示）+ vision.py 顶视图截图确认红 X/蓝 Z 标签位置正确

### v0.79.6 — 成年女胸臀曲线 + 儿童骨架眼睛修复（2026-08-13）

- **RidgeBox 五边形截面（胸）**: 新增几何类型，胸前一条水平脊线（脊线长=截面宽度插值 `bw+(ridgeY/h)(tw-bw)`，脊线 z=前面插值+ridgeZ），侧面截面四边形→五边形；只给 v1-成年女 torso_upper，默认 ridgeY=0.20/ridgeZ=0.04
- **TaperedBox 底面偏移（臀）**: TaperedBox 从 7 参数扩展 9 参数（加底面偏移 bx/bz，缺省 0 向后兼容）；torso_lower 底面 bz=-0.04 后凸、pelvis Box→TaperedBox 顶面 oz=-0.04 对齐
- **v1-成年女 派生**: `_applyFemaleCurves` 只覆盖 v1-成年女的 torso_upper/torso_lower/pelvis，不污染共享 WORKING_SKELETON 和其他骨架
- **工厂调参面板**: TaperedBox 加「底面偏移」滑块 + RidgeBox 9 参数滑块（含脊线高度/凸出，ridgeZ≥0、ridgeY 几何钳制 [0,h]）
- **setBone 眼睛修复**: Sphere 节点子 position 全轴等比 + size 等比缩放（原只缩 y），修儿童骨架头放大后眼睛没入头里
- **验证**: 数据断言 7/7 + 渲染检查 + vision.py 侧视图确认 S 曲线无破面 + CDP 全程 0 错误

### v0.79.5 — 校园丧尸三副骨架 + 比例重定 + 女教师 S 曲线精修（2026-08-09）

- **鞋/裤段贴地修复**: ah_tc_l/ah_tr_l size 匹配腿长 + position=0；rebuildModel 贴地排除手臂指尖（防臂长致身高虚高/脚悬浮/比例失真）
- **三副独立骨架**: HUMANOID_BASE 拆 STUDENT_BASE（学生共享）/TEACHER_M_BASE/TEACHER_F_BASE，buildHumanoid 选骨架，关节名对齐复用 addon/动画
- **比例重定**: setBone 同步 size+pivot+子position（防空隙/手臂超肩）；学生加长臂、男教师长腿+缩头、女教师 S 曲线（长腿+窄肩+收腰）
- **女教师精修**: 沙漏躯干（两 TaperedBox）+ 椭圆 pelvis（TaperedHex）+ 胸/臀楔形（Wedge 梯形底）+ curves 0.7 + 胳膊腿细
- **取消上衣下摆**: 教师 pelvis 显裤/裙色（衬衫扎进裤裙）
- **新几何**: Wedge/TaperedHex 补全（工厂 + enemies.js createGeometry），法线顺序修正
- **游戏侧**: 教师 fixed 体型（学生保留随机）；createGeometry 补 TaperedBox/TaperedHex/Wedge

### v0.79.4 — 性能修复：训练场手动模式 fps 崩根因（2026-08-04）

- **obstacleMeshes 污染修复（根因）**: `updateAiming` 的 `aimTargets = _filterAimTargets(obstacleMeshes)` 在无半透明建筑时返回原数组 → 敌人循环 `aimTargets.push(en)` 每帧把敌方坦克 push 进 obstacleMeshes → 数组线性暴涨（训练场 535→1707）→ 弹道线/瞄准/MG raycast 目标暴涨 → fps 崩到个位数。**手动模式 updateAiming 每帧跑 → 崩；AI 托管跳过 → 不崩**（v0.78.2 引入）
- **玩家碰撞命中修复**: 敌方炮弹命中玩家碰撞体 → `csHit.unit = player1`（手动模式包装对象无 position）→ 误调 `onEnemyDamaged(player1)` 扣玩家血 + 残血后 `en.position.x` 抛 TypeError 每帧中断 gameLoop（v0.66.0 碰撞体系统引入）→ 改正确玩家受伤路径
- **弹道线零分配**: 几何/向量全复用（原每帧 dispose+new BufferGeometry + 70×Vector3 → GC 累积 → fps 单调下降）+ 敌人圆柱检测替代 780 子 mesh 递归 raycast + 障碍物 150m 距离过滤 + Raycaster 复用
- **瞄准优化**: 丧尸射线-圆柱检测替代整 mesh 递归 raycast（校园图 780 目标）+ 零分配
- **验证**: 训练场手动交战 2 分钟 fps 10-29→**168-180 稳定**，obstacleMeshes 恒定 24，combat 阶段 0.35-0.67ms，0 错误；04a 弹道线 57→7ms；全图 0 错误

### v0.79.3 — 校园丧尸人形精修（2026-08-03）

- **首次切换白模修复**: `MODEL_CONFIGS.humanoid` 初始 = `HUMANOID_BASE` 白模（无服饰/未缩放），切模型/autoLoad 只调 rebuildModel 不触发变体构建 → `rebuildModel` 入口加守卫（配置树无 `_params` 时自动 buildHumanoid）+ height 归一统一移入 rebuildModel
- **衣物随 build 联动**: WRAP_ADDONS 表（袖口 0.01 / 裤 0.03 / 裙 0.02 腰 + 0.34~0.41 摆）——包裹衣物尺寸 = 肢体半径×_bF + 固定间隙，build 0/0.5/1 全档不穿模
- **上衣下摆包裹保证**: pelvis 半宽/深 = max(原值×_bF, 裤裙半宽+0.02) 单向联动（build 小不回缩）；torso 不动（校徽/条纹/领带挂件贴前表面，增厚会被吞）
- **男教师长裤**: 裤高 0.5(≈47cm 短裤感)→拆大腿段(挂髋 pivot)+小腿段(挂膝 pivot)盖到脚踝，随髋摆/膝弯
- **步态方向修正**: Three.js rotation.x>0=后蹬、<0=前踢——原关键帧方向写反（前踢 0.55/后蹬 0.6 实为双前踢）→ 后蹬 0.6/0.8、前踢 0.25/0.35、膝弯清障 -0.6/-0.7、对侧摆臂
- **展台沉地修复**: pelvis.position.y 关键帧绝对赋值 0（骨盆从 0.375 砸地）→ REST_POSES 加 `pelvis:y:0.375` + 三轨改 restKey 偏移；展台每帧动态贴地（Die 躺倒/动画切换均贴地）+ Die 一次性播放停留回待机
- **resetState 全关节复位**: Die 用过的关节（torso x/arm z）在 Idle 无 track 残留变形 → 全 pivot 复位到 REST 基线
- **女生裙锥形化**: 裙 = 锥形 Cylinder（腰口 = 腿半径+0.02 细，被上衣盖住 → pelvis 不再 grow，与 torso 协调）；裙摆半径按 Run 极限(0.8rad) 大腿表面位移 `√(0.13²+(摆长×sin0.8)²)+腿半径`（学生摆 -0.25 → 0.46，教师摆 -0.35 → 0.53）；裙摆上移露小腿（学生 0.62 / 教师 0.52 单位）
- 验证: 全链路 Playwright 断言（包裹矩阵 12/12 + 关键帧方向 + 贴地 7/7 + Die 复位 + 裙 Run 极限覆盖）+ 游戏校园地图 0 错误

### v0.79.2 — 校园丧尸校服精修（2026-08-01）

- **Sphere thetaLength 支持**: enemies.js buildHumanoidRig + 工厂 createGeometry 的 Sphere case 加 `thetaLength`（默认 π 向后兼容）；现有 Sphere 节点（头/眼/球/纽扣）零回归
- **头发半球 + 女生发型 base**: `short_hair_m` ah_m 加 `thetaLength:π/2`（真半球，不再全球没入头）；`student_f`/`teacher_f` addons 加 `short_hair_m`（马尾/发髻在头发 base 上，非光头）
- **hips 几何修复**: 居中球 → 后侧扁椭球（`scale:[1,0.85,0.55]` + 后移 `z:-0.1`），curves 放大保持 X>Y>Z 比例，前侧不凸（修复前后两侧同膨问题）
- **工厂 Canvas 贴图**: `getMaterial` 加 `createHumanoidTextures`（polo 珠地/skin 暗斑/badge 校徽/stripes 斜条）+ `MATERIAL_DEFS` 4 materialId 加 map + `getMaterial` 命中 map 转 CanvasTexture；与游戏 enemies.js 统一
- 验证: teacher_f 视觉（发髻在头发 base + 胸前凸 + 臀后凸/前不凸）+ student_m canvas 像素（珠地 33%/校徽 16% 彩色/斜纹 22% 彩色）+ 0 错误

### v0.79.1 — 校园敌人放置工具页（2026-07-31）

- **enemy_marker.html 工具页**(fork toilet_zone_marker, ~700行): 7类型敌人圆点CRUD(4校园丧尸+assault/zombie/hexapod)+视野圈+巡逻折线; 行为面板(8字段HP/速度/视野/攻击/冷却/掉落/回血/得分 + 3模式 reactive/aggressive/none); 巡逻点编辑(巡逻模式点击添加+清除); 刷新配置面板(enabled/initialCount/interval/batch/cap + 4比例) + 门提取(extractDoors corridor边中点) + 门圆点拖动
- **保存闭环**: POST `{type:'enemies', enemies, spawnConfig}`（扁平 enemy + `position[x,y,z]` + `patrolPath[[x,z]]` + `doors[[x,z]]`）; server.py enemies 端点 P2 已做整体替换
- **游戏零改动**: createEnemies(P1) + campus_spawner(P3) 已消费 enemies + spawnConfig
- **暴露**: enemies/campusData/spawnConfig/newEnemy/saveEnemies 到 window（CDP/测试）
- 验证: Playwright 放敌人+改行为+加巡逻+设刷新→保存→重载确认(扁平字段+数组格式)+0错误

### v0.79.0 — 校园丧尸模型工厂接入（2026-07-28）

- **humanoid_factory.js 工厂展台桥接**: 自包含6动作(Idle/Walk/Run/Attack/Stagger/Die)+keyframe lerp+REST_POSES偏移, 镜像enemies.js createHumanoidAnimationSystem(工厂页不加载enemies.js故自包含); 暴露window.HumanoidAnims接口与HexapodAnims同构(+categories)
- **工厂6项接入**: createGeometry加Plane case(校徽/斜纹片addon用,不加则渲染报错) + humanoid_config.js脚本加载 + MODEL_CONFIGS humanoid entry + modelOptions🧟校园丧尸 + rebuildModel人形贴地 + MATERIAL_DEFS补20个人形materialId纯色 + getModelAnims humanoid分支 + \_buildAnimList categories分支(hexapod无categories走fallback零回归)
- **体型参数GUI(工厂新能力)**: 变体下拉(student_m/student_f/teacher_m/teacher_f) + height/build/hunch/curves滑块 + \_applyHumanoidEdit实时buildHumanoid重建(穿校服预览)
- **solidify单变体固化**: server.py新增\_find_variant_bounds嵌套定位HUMANOID_VARIANTS[key](修正_find_config_bounds只认顶层const的局限) + solidify_config解析humanoid:variant + \_doSave人形分支
- **rebuildModel修复**: window.modelRoot每次rebuild保持fresh(humanoid_factory.collectRefs依赖,修正原一次性快照stale隐患)
- **执行方式**: Task1用subagent(sonnet)+reviewer通过; Task2起因Claude API周/月限额429改主session(glm-5.2)内联执行(executing-plans模式), 每 task CDP/Playwright验证0错误

### v0.78.4 — 校门系统+hpBar修复（2026-07-25）

- **校门系统**: createGates(铁栅门双扇紧闭+门柱4.5m+门头横梁校名"金福园小学"+黄黑警戒带+禁止出入立牌); 工具页gate_marker.html打点snap沿围墙边(atan2(-ez,ex)边方向+朝外)+宽度滑块(4-15m)+旋转滑块(-180~180°); createBoundaryWalls围墙开口裁剪(段被门分画门外, 开口精确=门宽); type='wall' polygon不可摧毁+\_registerCampusBuilding半透明
- **数据**: campus.obstacles.gates=[{cx,cz,width,ry,name}]; server.py gates分支
- **hpBar修复**: enterGame(engine.js:7107) hpBarGroup.visible误设false→true(单人模式血条消失); 拦截visible setter定位
- **实测**: 2门渲染(部件齐全)+围墙开口精确+hpBar/reloadBar同显隐, 0错误

### v0.78.3 — 花坛可被炮弹整体摧毁（2026-07-25）

- **根因**: createPlanterZones obstacleData `height=WALL_HEIGHT(0.5)` 只墙高 → 炮弹打树木上部(y>0.8)超 `obsTopLimit` 跳过圆柱 → 穿过; 无 `groupRef` → 摧毁不触发; 共享几何(ringGeo/soilGeo/TreeModels)不能 dispose
- **修复**: obstacleData `height 0.5→5`(含树木, 炮弹打任意部位命中圆柱) + `groupRef=planterGroup` + `hideOnly=true`; 摧毁逻辑 `od.hideOnly → visible=false` 软删除(不 dispose 共享几何, 同球门做法)
- **实测**: 12 花坛全标记 height=5+hideOnly+groupRef, visible 可控, 0 错误

### v0.78.2 — 相机建筑遮挡半透明（2026-07-25）

- **移除前移避障+纯半透明**: placeCamera移除前移避障(几何反馈循环: 原位命中→前移→新射线边界不命中→回原位→振荡); 改为整栋建筑半透明(opacity 0.35); 相机不动→命中集稳定→无闪烁
- **DoubleSide clone材质去重**: setBuildingFade按材质uuid去重clone(transparent+DoubleSide+depthWrite=false); DoubleSide解决相机穿入建筑内FrontSide背面剔除(墙消失附件浮空); 缓存首次clone后续零开销
- **墙mesh纳入bldGroup**: 墙mesh(campus-bld)原本直接add scene不在bldGroup(campus-bld-detail)→fade漏墙+射线检测不到墙; 纳入bldGroup(清自身变换)+setBuildingFade支持材质数组[wallMat,roofMat]
- **围墙/天桥/B7纳入**: \_registerCampusBuilding辅助函数标记+收集; 4处(体育馆壳\_shellMesh/B7拱顶\_domeGrp/天桥\_bmesh/围墙46段); 56建筑对象全标记
- **小地图闪烁修复**: placeCamera原每帧开头\_hullOccluded=false但检测每150ms→非检测帧false闪烁; 改为只在检测帧更新
- **半透明时瞄准穿透**: \_filterAimTargets过滤\_fadedGroups(半透明建筑); updateAiming+狙击/六足两处; 半透明时瞄准穿过建筑命中后面目标

### v0.78.1 — 厕所碰撞体+炮弹命中修复（2026-07-25）

- **厕所碰撞体点变换**: 厕所碰撞polygon算法从盒变换(`Box3.applyMatrix4`对轴对齐盒旋转会膨胀)改为点变换(8角逐个`applyMatrix4`); 修复旋转楼体进深从真实5.5m膨胀到20.38m(3.7倍); 实测进深20.38→6.94m贴合墙体, 每侧少挡6.7m
- **炮弹递归命中厕所**: 炮弹Raycaster从`intersectObjects(_cb, false)`改为`true`(递归); 修复厕所以Group(无geometry)入`_campusBuildings`时非递归不命中→炮弹穿楼无飞溅/焦痕/地面音效, 转走圆柱检测又因polygon被continue跳过→命中后方可破坏物; 修复后命中厕所墙面触发spawnFragments+spawnHitSparks+playGroundHitSound+spawnWallScorchMark

### v0.78.0 — 校园架空层车棚碰撞修复+厕所天桥碰撞+HE守卫+焦痕（2026-07-20）

- **架空层**: checkCollision增加minY高度感知; 教学楼B5 polygon增加minY=3跳过地面碰撞; 架空层柱子圆柱碰撞体登记
- **车棚**: 四角柱圆柱碰撞体登记; 拱顶mesh加入\_campusBuildings炮弹Raycaster命中; hole polygon从体育馆碰撞中挖除
- **B7室内运动场**: 拱顶壳+端盖+8面墙共11子mesh加入\_campusBuildings, 炮弹可命中dome墙壁
- **厕所**: 抛弃不存在的insertObstacle, 用inst.matrixWorld逆变换计算紧致polygon; 加入\_campusBuildings
- **天桥**: mesh加入\_campusBuildings, 炮弹Raycaster可命中桥体; 坦克仍可从桥下穿行(无obstacleData)
- **HE溅射守卫**: 补充od.polygon||od.box||od.type==='wall' continue守卫(声称v0.67.1修复但代码缺失)
- **焦痕修复**: Raycaster命中面法线从局部空间转世界空间后再调用spawnWallScorchMark
- **调试**: F9键切换厕所碰撞体半透明红色可视化(footprint填充+轮廓线+四角高度柱)
- **改动**: js/engine.js(+35)+js/obstacles.js(+120)+models/buildings.js(厕所碰撞段重写)

### v0.77.0 — 法国梧桐树丛+厕所窗户（2026-07-20）

- **梧桐工具**: tools/tree_marker.html 点击打点放置梧桐树丛(每点3-5棵9-12m), 绿三角图标+虚线集群范围
- **精细模型**: models/plane_tree.js(260行) 树干(锥形+树皮噪声)+5主枝+70椭球宽穹顶冠+3-5对悬挂种子球
- **3D渲染**: js/obstacles.js createTreeZones(~105行) InstancedMesh(4IM: 树干+树冠+细节+阴影代理)
- **厕所窗户**: 男女厕前墙贴面窗户(框#555+玻璃#bcd4e6,polygonOffset防闪烁,离墙0.08/0.10)
- **数据**: campus.obstacles.treeZones=[{cx,cz},...]; server.py+6行treeZones分支
- **改动**: tools/tree_marker.html(新320行)+models/plane_tree.js(新260行)+js/obstacles.js(+105)+server.py(+6)+index.html(+1)

### v0.76.0 — 花坛打点系统（2026-07-20）

- **花坛工具**: tools/planter_marker.html 点击放置ø2m圆形花坛(环柱墙0.5m高×0.3m厚)+中心5m球形树
- **3D渲染**: js/obstacles.js createPlanterZones(~80行) Shape+Path孔洞→ExtrudeGeometry环柱墙+土壤圆盘+TreeModels.spherical复用
- **碰撞**: 直接push进obstacleData(r=1.0圆柱,坦克不可穿过)
- **数据**: campus.obstacles.planterZones=[{cx,cz},...]; server.py+5行planterZones分支
- **改动**: tools/planter_marker.html(新) + js/obstacles.js(+80) + server.py(+5) + maps/campus.map.json

### v0.75.0 — 足球场soccerFields+坐标校准验证（2026-07-19）

- **足球子场工具链**: tools/soccer_zone_marker.html 标记→campus.map.json soccerFields→js/sportsFields.js createSoccerFields渲染
- **坐标转换规律验证**: tools/calibration_marker.html(4色边矩形→6面立方体)19轮迭代确认工具页↔demo完全对齐
- **足球场**: 2子场标线(整场CanvasTexture+UV重映射)+4球门(双柱可碎,r0.15,门宽3.4m占短边15%)
- **server.py**: toiletZones条件改正向白名单,杜绝新工具误覆盖; 新增soccerFields/calibration类型支持
- **规则固化**: CLAUDE.md规则#9(标记工具坐标对齐)+#10(改server.py后重启); memory [[tool-demo-coordinate-mapping]]
- **改动**: js/sportsFields.js + js/obstacles.js + server.py + tools/soccer_zone_marker.html(新) + memory

### v0.73.0 — 球场标线+球门+篮球架（2026-07-19）

- **球场标线**: js/sportsFields.js(新模块) 整场 CanvasTexture(草底平铺+白线 0.12u)+UV 重映射(footprint 局部归一化); 足球场沿长轴分 2 子场各 1 套标线; 大篮球场 5 人制/小篮球场 3 人制缩小全场; polygonOffset -3/-6 置顶防 z-fight
- **球门×4**: 5人制 3×2m 白框+半透明网, 双柱小圆柱碰撞(r0.15)坦克撞门框停; 命中任一柱整门碎(兄弟碰撞体联动清理)
- **篮球架×8**: 立柱+悬臂+白底红框篮板+橙筐; 筐高大场 3.05m/小场 2.6m; 三分弧心与筐心精确对齐
- **engine.js 摧毁增强**: 直接命中兄弟清理+HE 溅射 destroyed 软删除(根治同批命中 null.parent 崩溃); campus- 前缀共享材质保护
- **厕所修复**: 标志从墙内侧移到外墙面+sRGB 色彩空间(深蓝不再偏亮)+降至 0.616 墙高+女标志腿距对齐男标志; 4 扇高窗外置抬高不再嵌墙
- **改动**: js/sportsFields.js(新~400行) + js/engine.js + js/obstacles.js + index.html + models/buildings.js

### v0.72.0 — 厕所区域系统+运动场门窗分化+车棚柱修复（2026-07-18）

- **厕所区域系统**: tools/toilet_zone_marker.html 工具页(对角线拖拽画矩形+旋转)+ maps/campus.map.json toiletZones 数据 + obstacles.js createToiletZones 渲染 + models/buildings.js createToilet 模型(男厕+洗手区带镜台5龙头+女厕三连体)
- **运动场门窗分化**: 拱顶米白+外墙绿漆(腰线以下#6b8e5a)+蓝腰线+朝桥面1对开门6高窗+背桥面7高窗+拱端盖
- **车棚柱修复**: 长宽双向内收(拱跨88%/脊线5%)+柱顶按外侧边缘算拱高防刺破
- **镜子反射**: WebGLRenderTarget实时反射(每帧反射相机渲染)
- **改动**: models/buildings.js + js/obstacles.js + tools/toilet_zone_marker.html(新) + server.py + maps/campus.map.json

### v0.71.0 — 门窗修复+一楼去外廊+工具房+车棚敞棚（2026-07-18）

- **门阈值修复**: doorT1-doorT0>0.02→0.005(长边>35u门不丢); AC forceY!==undefined→!=null(传null不误判单层)
- **AC窗间墙布局**: 放弃均布+窗避让,改为教室交界间隙定点(每教室≥1台)
- **一楼去外廊**: addCorridorToEdge fl=0→1(栏杆/挑板跳一楼,学生从门直入广场)
- **工具房5间房**: 加edgeMarks(ei=1朝运动场)+\_nRooms=5+\_singleDoor; addDoorsAndWindows/computeWindowRanges支持覆盖参数
- **车棚敞棚**: 封闭椭圆柱→单片BufferGeometry拱面(32段扫掠)+四角柱内收88%+柱高随拱(顶拱底不凸)
- **改动**: js/obstacles.js + maps/campus.map.json

### v0.70.0 — 校园建筑门窗系统（2026-07-17）

- **门窗贴面**: 5栋教学楼外廊面门+多扇窗+空调面窗对称; 教室自动划分(宽≈8u整除边长)
- **走廊面**: 每教室前门(0.7u)+后门(0.7u)+中间多扇窗(3-4扇细框, 窗台0.8u高1.2u玻璃#c8ddf0)
- **空调面**: 窗户对称+空调外机避让窗户; 天桥子段裁剪
- **架空层柱子**: 内移0.55u+去角柱+清理防泄漏(obstacleMeshes追踪)
- **外廊侧墙+天花板**: 每层两端侧墙+顶层天花板(与建筑屋顶齐平)
- **改动**: js/obstacles.js — computeWindowRanges + addDoorsAndWindows + addACToEdge避让
- **验证**: CDP 0错误; Playwright 60门+857窗+374框

### v0.69.0 — 校园外廊/空调标记 v2(纯覆盖+天桥子段裁剪+b7空调)（2026-07-17）

- **纯覆盖模式**: 弃 fallback,无 edgeMarks 的楼不画外廊/空调(工具房自动无)。删 fallback 分支 + edges/innerScore/courtyardX/Z dead code(-96行)
- **天桥子段级裁剪**: `edgeBridgeOverlaps` 返回 `{yRange, segRange}`(共线+投影算连接子段)。贴天桥的边天桥层只裁连接子段(如 B5 ei=3 t∈[0,0.4]),其余段画外廊;横杆/挑板分段(方案A)
- **b7 空调**: 工具支持标 `b7_buildings` 4 边;dome 分支读 b7 `edgeMarks`,拱顶长边(ei=0/2)墙面挂空调(`_b7w` 坐标推导)。b7 只空调
- **改动文件**: `server.py` + `tools/building_edge_marker.html` + `js/obstacles.js`
- **验证**: CDP 0 错误; Playwright 工具房 0 mesh + B5 子段裁剪 + b7 空调 7 mesh

### v0.68.0 — 校园外廊/空调标记系统(工具→地图→渲染+天桥避让)（2026-07-16）

- **工具闭环**: `tools/building_edge_marker.html` 加 load 回填 edgeMarks + "保存标记到地图"按钮(POST `/api/solidify`)+ draw 画天桥 footprint(紫色虚线提示)。clearMarks+save 显式清除已落盘标记
- **server 写回**: `solidify_campus` 扩展接收 edgeMarks，写回 `footprintBuildings[i].edgeMarks`，空数组删字段回 fallback，保持坐标内联格式
- **渲染接入**: `obstacles.js` 读 `fp.edgeMarks`(覆盖语义:有标记只画标记边,无则 fallback innerScore 自动推断)。helper: `edgeByFootprintIdx`(按 footprint 点索引取边,不依赖 edges 下标)+ `edgeBridgeOverlaps`(边贴天桥检测)
- **天桥楼层裁剪**: 标记边 + fallback 边都跳过天桥 Y 区间(6~9)的层。顺带修复 v0.67.5 天桥实装后 fallback 自动推断栏杆穿天桥的潜在穿插
- **架空层**: 隐式跳过(栏杆第 0 层落 y=\_stiltY 架空层顶)
- **改动文件**: `server.py` + `tools/building_edge_marker.html` + `js/obstacles.js`
- **验证**: CDP 0 错误; Playwright 工具闭环(标记→保存→回填→清除)+ 游戏渲染(覆盖/fallback 天桥层裁剪到 0 mesh); map01a 零回归

### v0.67.5 — 校园现实化(楼高+天桥+架空层)（2026-07-15）

- **现实信息同步(楼高)**: 综合楼×3(B2/B3/B6)+教学楼×2(B4/B5)=5层(height=15,floorH=3); 工具房(B1)=平房(height=3)。楼层逻辑由height驱动(floor(wallH/3)外廊空调+round(h/3)墙纹理)
- **教学楼L型去短翼→正交矩形**: B5原L型去掉西北短翼,主体P0-P1-P2-P*新(P*新=P2+(P0-P1), P0-P1⊥P1-P2)
- **人行天桥(空中连廊)**: obstacles.bridges新数组。footprint贴三栋真实斜边(偏13°:南界主体北边段/北界B6南边段/东界垂直建筑边/西端B3东南),封闭白瓷砖box,三层地板floorY=6+一层厚3(天花9),连教学楼+B3+B6三层。只入obstacleMeshes(炮弹Raycaster),坦克可从桥下穿
- **教学楼一楼架空层**: B5 stiltFloor=1。楼体ExtrudeGeometry从y=3起(4层墙),架空层y=0~3柱子支撑(沿边每5单位圆柱)。外廊/空调wallH改h-\_stiltY+bldGroup上移\_stiltY(跳过架空层)
- **改动文件**: maps/campus.map.json(楼高+命名+主体矩形+bridges+stiltFloor) + js/obstacles.js(bridge渲染+架空层+柱子+外廊空调偏移)

### v0.67.4 — 校园工具旋转对齐+命名+B7双栋数据化（2026-07-14）

- **3工具旋转对齐上帝模式**: building_edge_marker + track_zone_marker 投影改中心式两轴取反(照搬b7_builder w2s/s2w), canvas上北/下南/左东/右西, 与F4上帝视角一致
- **building_edge_marker 命名功能**: N键命名模式(与外廊R/空调B并列), 面拾取(pointInPoly射线法+b7矩形局部坐标旋转)命名建筑/运动场/B7双栋, 经/api/solidify写回campus.map.json
- **B7双栋数据化(方案A)**: obstacles.b7_buildings顶层数组(室内运动场vaultH10+车棚vaultH5), obstacles.js dome分支硬编码改读数据(带fallback), 参数逐字取自原硬编码(零回归); B7 footprint name清空
- **server.py /api/solidify campus分支**: 接收{type:'campus',names,b7_buildings?}写回campus.map.json, 正则内联纯数字数组保持坐标内联格式
- **b7_builder数据闭环**: 从obstacles.b7_buildings加载初值+保存到地图按钮(saveB7)
- **改动文件**: server.py + maps/campus.map.json + js/obstacles.js + tools/building_edge_marker.html + tools/track_zone_marker.html + tools/b7_builder.html

### v0.67.3 — 校园建筑真实化+B7双栋拱顶（2026-07-14）

- **建筑墙面纹理**: Canvas程序化512×256纹理(暖白瓷砖底色+4窗/行渐变玻璃+白框窗格+楼层混凝土分界梁+随机污渍), 每建筑独立repeat(U周长/6, V层高/3)
- **敞开式外廊**: 自动检测朝内院边(内院中心点积法)→每层栏杆柱(Cylinder)+顶部/中间横杆+楼层挑板(BoxGeometry外挑0.85u)
- **空调外机**: 朝外边每5u间距BoxGeometry+支架, 每层重复
- **B7体育馆**: 删除原方形建筑+校外B1; 改双栋参数化拱顶(运动场38×23 vaultH10 + 车棚14×17 vaultH5), EllipseCurve截面(直墙+椭圆弧), per-building vaultH/archRatio独立
- **打点工具坐标对齐**: b7_builder/track_zone_marker 工具页面2D地图翻转180°对齐上帝模式(上北右西), 3D预览摄像机同步; 固化Shape坐标系转换规则(rotation.x=-PI/2→Z取反)
- **改动文件**: models/buildings.js(墙面/屋顶纹理+railing材质) + js/obstacles.js(createFootprintBuildings重构+dome参数化) + tools/b7_builder.html(新建) + tools/building_edge_marker.html(新建) + tools/track_zone_marker.html(坐标对齐) + maps/campus.map.json(删B1+ B7改dome)

### v0.67.2 — 校园地面三层分区(地砖+跑道+草地)+精确打点跑道边界（2026-07-13）

- **地面分区**: 东北室内教学区→地砖(浅灰网格瓷砖,原createCampusGround恢复); 西南运动区→塑胶跑道(砖红#CC4035+颗粒纹理); 运动场内部→真实草地(TerrainTextures.grass() FBM噪声+6000草叶描边)
- **跑道边界**: 用户打点工具(tools/track_zone_marker.html)精确划定6顶点多边形, E→F贝塞尔曲线段(quadraticCurveTo); 修复Shape坐标系Z轴取反(rotation.x=-PI/2矩阵ShapeY→World-Z)
- **顺修**: createObstacles末尾同步window.obstacleMeshes(修复obstacleMeshes=[]重赋值后window引用断裂,影响六足加特林碰撞检测)
- **改动文件**: js/obstacles.js(createCampusGround恢复+createSportsTrackZone新增+createGrounds草地+createObstacles调用顺序)+models/buildings.js(campusGrassM纯色fallback)

### v0.67.1 — 校园建筑围墙碰撞修复 + 2D射线-多边形精确求交（2026-07-13）

- **围墙碰撞修复**: 围墙mesh推入\_campusBuildings数组, 炮弹Raycaster/AABB正确检测命中
- **2D射线-多边形精确求交**: 替代不可靠的ExtrudeGeometry逐三角raycast, 炮弹射线投影到XZ平面对footprint多边形做线段求交, 命中点精确落在墙面上
- **命中效果对齐地面**: 建筑/围墙命中播放playGroundHitSound(低沉撞击)+spawnGroundDebris(泥块)+spawnWallScorchMark(墙面焦痕平行于墙), 与炮弹落地效果一致
- **HE溅射守卫**: 高爆弹溅射伤害跳过polygon/box/type==='wall'障碍物, 校园建筑/围墙不可被HE摧毁
- **改动文件**: js/engine.js(主循环+vs模式)+js/obstacles.js(预存polygon+墙高)+js/shells.js(spawnWallScorchMark)

### v0.67.0 — 金福园小学真实校园地图 + 建筑多边形碰撞 + 炮弹Raycaster墙面检测（2026-07-12）

- **校园地图**: 基于韶关金福园小学OSM数据生成真实比例地图(161×217m)。OSM Overpass→边界框选工具(map_bounds_tool.html)→footprint+楼高→转换器(tools/build_campus_map.js)→campus.map.json
- **建筑渲染**: 真实footprint多边形ExtrudeGeometry拉伸(8栋教学楼), 10块操场(ShapeGeometry红塑胶), 围墙(boundary 4m高box拆段), 围墙内瓷砖地面(CanvasTexture程序化)
- **碰撞系统重构**: 大物体用polygon(圆-多边形)+box(AABB), 不再用圆/圆柱(穿模/虚空触发); checkCollision加circleVsPolygon; 炮弹碰撞加Raycaster vs campus-bld mesh(精确墙面)
- **炮弹不可摧毁实体**: footprint建筑/围墙不可摧毁(只碎片火花+低沉命中音), 树/随机建筑可摧毁(爆炸音)
- **相机避障**: 建筑挡视线时相机前移+下降(越过建筑到坦克侧平视), 非俯视; 被挡时自动显示左下角小地图(车体朝向)
- **弹道线修复**: 体积检测跳过polygon/box(避免外接圆提前截断), Raycaster精确命中建筑表面
- **上帝模式**: F4相机降到穹顶内(看得见地面), 南上方俯瞰(北朝上)
- **教训**: 大物体(非圆柱/球)碰撞/检测不用圆/圆柱——用polygon/box/Raycaster

### v0.66.1 — 修复玩家六足F2碰撞体可视化蓝灰六棱柱残留（2026-07-08）

- **根因**: 残留物=`models/enemies.js:1247` 的 `_lodCylinder`(LOD远距替身几何,CylinderGeometry(0.5,0.7,2.5,6)=六棱台+蓝灰0x4a4a5a,初始visible=false)。`#4b4b62`为截图取色(实为0x4a4a5a)
- **触发链**: `collisionSystem._setRenderVisible` 跳过条件只含`_col_`前缀,F2 OFF 时误设`_lodCylinder.visible=true`;玩家六足不进LOD循环(engine.js:3695 仅遍历enemies)→无人修正→永久残留。敌人六足被LOD每帧`cyl.visible=isFar`修正故不复现
- **修复**: `_setRenderVisible`增加`_lod`前缀跳过(`js/collisionSystem.js:80`),LOD几何归engine.js LOD系统自管,碰撞体可视化不再误碰
- **验证**: Playwright实测玩家六足 F2 ON→OFF 往返后`_lodCylinder.visible`保持false,0控制台错误

### v0.66.0 — 碰撞体系统：模型减面+F2可视化切换（2026-07-03）

- **碰撞体系统**: 从简化圆柱→模型减面精确匹配轮廓。SimplifyModifier 按部件减面（虎式4493→627 tris, T-34 ~4500→698 tris），splitX自动分离车体/履带
- **F2 碰撞体可视化**: camera layer 1 叠加半透明彩色碰撞体，一键切换渲染模型/碰撞体视图
- **虎式迷彩修复**: T-34 builder `generateCamoTexture` 新增 `tropical_desert`，`getMaterial` color设为中间灰防暗色底压暗纹理
- **MG枪口位置**: 按 spec `mgMuzzleOffset` 替代硬编码；虎式MG34支柱顶端建 `mgPivot` 替代 mgGroup 原点旋转
- **新文件**: `js/collisionSystem.js`(碰撞体核心), `js/tank_specs.js`(坦克参数), `js/SimplifyModifier.js`(减面算法), `js/profiled_extrude.js`
- **[已修复] 玩家六足 F2 OFF 蓝灰六棱柱残留(#4b4b62)**: 根因=`models/enemies.js:1247` 的 `_lodCylinder`(LOD远距替身几何,六棱台+蓝灰0x4a4a5a,初始visible=false)被 `collisionSystem._setRenderVisible` 在 F2 OFF 时误设 visible=true;玩家六足不进 LOD 循环→无人修正→残留。修复=`_setRenderVisible` 跳过 `_lod` 前缀 mesh

### v0.65.13 — 虎式动画展台+展台回归修复（2026-07-02）

- **虎式动画展台**: 炮塔360°旋转+炮管俯仰-8~~15°(真实88mm KwK36 L/56)+MG34高射机枪绕MG枢轴支柱顶端防空旋转(-5~~80°)+履带前进/后退
- **\_TANK_PROFILE**: T-34/虎式共用\_tank\*框架, 按模型差异化(履带名/MG支柱名/MG旋转部件/俯仰角/MG旋转参数), 复用非重写
- **展台回归修复**: 补回缺失的computeTrackTotalLen/updateTrackPlates两函数(v0.65.9履带绕紧重构遗漏, 致T-34/虎式点展台collectRefs抛ReferenceError→animPhase不置1→不播放)
- **MG轴心**: pivot用支柱完整坐标(x,y+H/2,z), 虎式支柱偏离mgGroup原点(0.68,\_,-0.81)枪管不再绕车体中心甩飞; T-34支柱在原点零回归

### v0.65.12 — 虎式MG34高射机枪+热带沙漠迷彩+材质覆盖+UV修复（2026-07-01）

- **虎式MG34高射机枪**: 9部件(环形导轨/枢轴支柱/机匣/散热套管/枪管尖/双鼓弹匣/握把/环形瞄具), 对标T-34复杂度
- **热带沙漠迷彩**: Canvas程序纹理(橄榄绿底+黄棕斑块,截图取色); 虎式默认调试色, 下拉切换迷彩
- **底色乘法修复**: MeshStandardMaterial.color×texture暗色相乘→中间灰0x808080, 纹理解除压暗
- **ProfiledExtrude UV修复**: 侧面quad从死UV改为周长递增U+高度V, 炮塔主体/尾舱纹理正常
- **材质覆盖**: 炮管总成(炮盾/主炮管/抽烟器/制退器/同轴机枪)+舱盖×2+排气管×2+挡泥板×2+座圈+MG枪托 共14处→camo
- **非调试色取消轮廓线**: 切迷彩自动隐藏EdgesGeometry线框

### v0.65.11 — PE编辑器+左右命名修复+螺栓外侧（2026-07-01）

- **模型工厂 UX**: Shift减速滑块(精细1/10)/多选自动滚动/PE预设6种+roofProfile控制点+arc clockwise
- **PE 2D编辑器**: js/pe_shape_editor.js 独立模块，overlay+canvas拖拽控制点改shape
- **虎式+T-34左右命名调换**: 虎式30个+T-34 32个部件左右name对调(驾驶员视角x>0=左)
- **螺栓朝外侧**: isLeft改按世界position.x+boltY反号(rotation.z=π/2)
- **履带修复**: plateWidth 0.5→0.85; 最后板浮点落原点fix

### v0.65.10 — 新增ProfiledExtrude几何类型 + 虎式炮塔马蹄形建模（2026-06-30）

- **ProfiledExtrude 几何类型**：新增第 11 种几何类型，支持可变高度拉伸。Shape 定义 2D 轮廓（直线 + 圆弧），roofProfile 定义沿 Y 轴不同位置的高度（支持多段折线屋顶）
- **虎式炮塔重构**：炮塔主体 Box → ProfiledExtrude，马蹄形俯视轮廓（前脸宽 1.4 + 后方弧半径 0.75）+ 两段式屋顶（前斜面 0.45→转折 0.65→后水平 0.65）
- **法线保障**：4 项机制——每个 quad 独立顶点(硬边)、cap 顶点 Z±0.0001(防 computeVertexNormals 混合)、屋顶翻转索引(法线 +Z)、所有面 winding 经推导验证(FrontSide 即正常)
- **改动文件**：`model_factory.html`(~150 行新代码) + `models/tiger_v16_builder.js`(炮塔配置)

### v0.65.9 — 模型工厂框选交互 + 履带绕紧skill + 缓存根治（2026-06-30）

- **模型工厂框选交互**：Ctrl+左键拖拽框选（青色框）+ Shift+Ctrl 增选（橙色框，追加），拖拽时暂停 OrbitControls；批量编辑累积滑块（ΔX/Y/Z/旋转）切换选择时重置，修复"换一批部件后 Δy 残留上次值，需填双倍"的 bug
- **tank-track-fit 履带绕紧 skill**：根据诱导轮/主动轮/负重轮位置自动算 trackParams + Playwright 截图 + PIL 像素级验证贴合（`.claude/skills/tank-track-fit/`），任意坦克可复用
- **TrackChain 几何参数化**：`buildTrackChain`/`getTrackPlateTransform` 加 `roadWheel*` 参数（默认 T-34 值零回归），虎式等任意拓扑坦克可配置履带
- **缓存根治**：`server.py` 加 no-cache 头（SimpleHTTPRequestHandler 默认不发 Cache-Control，浏览器启发式缓存 .js）；`autoLoad` 不再用 localStorage 覆盖源文件配置（"改文件不生效"的真凶）；`_doSave` 移除 JSON 下载

### v0.65.8 — 模型工厂固化一键保存 + 虎式调试着色 + UI清理（2026-06-29）

- **模型工厂 Ctrl+S 直接固化**：创建 `server.py` 自定义服务器，新增 `/api/solidify` POST 端点，保存按钮同时写源文件 + localStorage + 下载备份
- **虎式坦克调试着色**：彩色材质（camo_green 亮绿/camo_dark 暗绿/dark_steel 蓝/barrel_steel 红/steel 紫/wood 棕）+ 部件轮廓线框，对标六足战车
- **切换模型六足 UI 自动清理**：修复 `toggleHexTurnTest()` 守卫顺序（turn-OFF 前移到 modelType 守卫之前），`rebuildModel()` 在移除旧模型前统一清理 IK/转弯/射击校准状态，武器校准瞄准线正确移除
- **UI 精简**：移除冗余按钮（加载/输出姿态/应用到 Config/导出JSON固化），BoxHelper 默认关闭

### v0.65.7 — 地面纹理方案调研 + 文档更新（2026-06-26）

- 定位道路/广场马赛克 3 大根因：splatMap 整数硬切无羽化、2048 合成 tile 规整重复 aliasing、主路浮空单色 strip 与地面割裂
- 调研 splat shader 软混合方案（手动双线性 + 高频平铺 + hash 抗重复旋转），根治 splatMap 所有区域马赛克，编辑器+运行时共享
- 设计主路拱顶倒角管道（路拱 crown=0.08m + 边缘埋地倒角 -0.4m 吸收地形起伏）+ 路径 UV 标线（中线虚线+边线实线）
- 预留路口扩展数据结构（`roadSystem.roads[]` + 手画路路径持久化），segment+junction 两层架构为后继 milestone
- 一期计划详见 `.claude/plans/quirky-hatching-rainbow.md`

### v0.65.6 — 建筑朝向基础（2026-06-26）

- 修复建筑朝向丢失：mapLoader 转建筑时补传 `yaw`，obstacles 用 `bld.yaw`（原读错字段名 `angle`）
- 编辑器建筑 marker 加 +Z 亮黄门（薄盒外突），对称低模朝向可辨识
- R 键旋转选中建筑（Shift+R 反向，15° 步进），支持多选
- ⏳ 推后：村落生成器 `_findClosestRoadAngle` 朝向差 90°（门未精确朝道路）

### v0.65.5 — 树冠透明 proxy + 尺度标定（2026-06-25）

- 树冠 proxy 改透明方案（`opacity=0` + `castShadow`），主通道看不见但阴影 pass 照投，**推翻 v0.65.4 物理遮挡方案**，投完整树荫
- proxy 生命周期修复：树摧毁后 proxy 阴影残留 → obstacleData 加 `imProxy` 字段 + `disposeTreeInstance` 同步隐藏
- 新增环境对象开发规范文档 `docs/obstacle_conventions.md`
- 尺度标定：`METERS_PER_UNIT` 4.706→1.3（真实 T-34/85 高 2.6m ÷ 坦克渲染 1.99 单位），障碍物米数标对 + "像草"的下限调高，地图编辑器尺寸 UI 显示米

### v0.65.4 — 树冠阴影恢复 shadow proxy（2026-06-25）

- **树冠阴影恢复(零画质损失)**: v0.64.0 为省开销把树冠castShadow=false(树冠无影子)。spherical/oak用极简proxy球(20面IcosahedronGeometry,半径×0.8)藏树冠内投影(靠不透明树冠遮挡,主通道看不见,省8000→20三角);conical扁平棱柱(448三角)藏不住球→直接castShadow。踩坑(Three.js r160实测):layers.set(1)+shadow.camera.layers.enable(1)阴影相机仍看不到layer1;colorWrite=false连带跳过阴影pass→最终用物理遮挡。⚠️待多角度验证proxy不露出+阴影开销实测

### v0.65.3 — 建筑 InstancedMesh 合并修复（2026-06-24）

- **建筑 IM 碎片化合并修复(bld-im 141→18, 零画质损失)**: v0.65.2 诊断(随机拓扑/材质引用)有误, MCP实测真实根因=obstacles.js外层循环遍历每个子mesh而非唯一材质,同材质重复建IM(窗户#aaccff建56个)。修复: buildings.js 18材质全局化 + obstacles.js seenMat按material去重 + dispose路径保护全局材质。实测: 三角面1.58M→1.23M(-22%), 建筑shadow caster 141→18(-87%), 控制台0错误, 3次进出地图材质正常

### v0.65.2 — 地面射线高度图优化 + 建筑分类（2026-06-24）

- **地面射线高度图优化**: updateAiming(4处:单人/双人/六足)用高度图步进+二分(O(1),~0.1ms)替代groundMesh brute-force raycast(131k三角14ms), 物理阶段 19→1-7ms, 单人01a出生点fps 30→48
- **建筑分类+阴影恢复**: 3种建筑userData加category字段+扩大targetHeight范围(2-12/6-20/15-35); 建筑InstancedMesh设castShadow=true(之前false致无投影)
- **P0-1建筑IM合并(根因定位)**: obstacles.js按targetHeight细致分组+materials对象引用比较(每次createFn新建实例)导致141个bld-im(每10inst); 按material值合并的完整方案待续

### v0.65.1 — 坦克AI对峙/出界修复 + 对攻性能优化（2026-06-24）

- **坦克AI远距离对峙/出界修复**: updateChase 超视野距离时直线追近(原侧向迂回纯侧向不靠近, 把坦克推出地图进虚空, dist堆积到118m卡CHASE不开炮); 视野内地形遮挡时侧向目标朝玩家(既靠近又包抄); moveEnemyToward 加边界 clamp(worldHalfW/D防出界)
- **训练场对攻性能优化(P-burst)**: 炮弹循环临时向量复用(P-burst-1, 战斗阶段burst 29→13ms, 复用\_shellPrev/\_shellTmp免每帧new) + 碎片/泥块对象池(P-burst-2, fragments+groundDebris共享\_fragGeo+池复用, GC停顿 37→20ms); 累计最坏帧 150→50ms(-67%)

### v0.65.0 — 坦克AI托管完整修复（2026-06-23）

- **坦克AI托管完整修复(10层根因)**: 训练场敌我坦克AI托管从"双方不动"修到"双方移动+炮塔追踪+双向对攻+多轮复活稳定"。逐层定位: player1 Object3D兼容接口 / 朝向-X+Z约定helper / aimTurretAt按约定 / 玩家开炮firePlayerTrainingShell / 炮塔覆盖跳过 / 视角跟炮管 / updateEngage转向后再走 / 模型旋转90°(AI+Z) / resetTank+双向同步初始化 / 复活状态hp=0
- **复活/丢失后AI搜寻(A+B)**: 复活获知(设chase+target立即对追) + PATROL搜寻兜底(朝lastSeenPlayerPos/探索, 不原地卡死)
- **池塘空气墙验证**: 三方(玩家坦克/敌方坦克/六足)均调checkCollision(含池塘+河流), window.checkCollision已暴露; 偶发入水难复现

### v0.64.0 — AI托管+性能优化（2026-06-23）

- **训练场AI托管**: 训练场新增"我方AI托管"选项，双方自动对攻无需手动操控；支持六足（复用敌方CCD IK+武器系统）和坦克（复用EnemyAI状态机）
- **CCD矩阵局部化**: `_ccdLeg` 迭代内 `root.updateMatrixWorld(true)`（全六足树~50节点）→ 首次全树 + 后续仅本腿子树（~5节点），节点访问量降12倍
- **子弹碰撞空间网格**: 加特林子弹 `Raycaster.intersectObjects(obsMeshes)` → `checkCollision`（空间网格 O(1)），raycast 耗时 7.6ms→~3ms
- **双方武器参数对齐**: 敌我加特林射程(maxDist/gatlingRange)统一50m，避免一方逼近一方后退
- **综合FPS**: 六足对攻 22.5→37.4 (+66%)

### v0.63.1 — Bug修复×8（2026-06-22）

- **六足右摇杆Y轴翻转**: 上推=下俯（飞机摇杆风格）
- **六足出生点阴影缺失**: PCM 激活时阴影相机跟随六足位置
- **踉跄加特林状态机**: 踉跄时强制停转+停射+散热，踉跄结束后AI恢复决策
- **坦克炮弹不让敌六足踉跄**: 圆柱碰撞改为走完整 `onEnemyDamaged` 调用链
- **坦克复活位置**: 复活时同步 `tankState` 防止同帧物理覆写
- **敌坦克坡地倾斜**: 前向/右侧方向公式修正，对齐模型实际朝向
- **爆炸火光粒子残留**: `ExplosionEffects.dispose()` 增加 `scene.remove()`
- **敌六足不受碰撞**: 增加 `checkCollision`（障碍物+河流+池塘），存活/死亡两路径

### v0.63.0 — 坦克炮塔世界空间重构（2026-06-21）

- **世界空间陀螺仪炮塔**：炮塔方向独立于车体，鼠标/摇杆直驱 worldTurretYaw，车体转动不影响炮塔世界指向
- **删除瞬时稳定器**：移除 `turretYaw += hullDyaw` 补偿，公式 `turretYaw = worldTurretYaw - (π/2 - hullYaw)` 替代
- **同向不再迟钝**：车体+鼠标同向转时炮塔满 30°/s 追光标，不再有稳定器和瞄准互搏
- **仅改 engine.js**：~40 行，惰性初始化覆盖所有模式/spawn/respawn

### v0.62.0 — 玩家六足武器实装（2026-06-20）

- **加特林系统**：左右键独立控制，spinUp渐进旋转→射击→发热→过热强制冷却，枪管红热发光，枪口焰粒子+命中火花，全覆盖碰撞检测(障碍物Raycaster+地面+水面+敌人)，击杀爆炸效果，射程35m
- **导弹系统**：空格键锁定制导，锁定框跟随光标(300×200px)，绿圈缩圈锁定(1s)→红圈发射，左右导弹巢交替发射(各4发)，10s装填+3D装填条UI，超出距离/装填中警报文字，导弹追踪lastTargetPos无限射程
- **HP观瞄球体**：克隆材质防共享劫持，绿(满血)→红(空血)渐变
- **Bug修复**：六足MG自动射击禁用、子弹穿透(改用XZ平面距离+Raycaster)、敌人不爆(补spawnExplosion)、重生朝向(onRespawn覆盖坦克默认值)、观瞄球体劫持(材质克隆)
- **锁定框(200→300×200px)跟随光标**、装填条改为3D世界空间(对齐坦克bars.js公式)
- **俯仰追踪光标**：engine.js 真实 raycast（与坦克 updateAiming 同源）→ 世界目标 → 反算俯仰角，下俯/上仰 -40°~+60°
- **颜色状态机**：正常绿近/红远；过热(overheated)全红；冷却中(heat>0)全橙
- **球形标志**：仅命中物体时显示；望天隐藏
- **新增文件**：`js/hexapod_aimLine.js` (~260行)
- **修改文件**：hexapodPlayer.js(+55行) / manager.js(+8行) / engine.js(+12行) / index.html(+1行)

### v0.61.3 — 加特林旋转状态机 + 六足玩家跑/走（2026-06-18）

- **加特林枪管旋转修复（3根因）**：① `updateGatlingSpin` 内 `spinRPS||3`→`||0`（0 被 `||` 当 3，**枪管恒转的直接根因**）；② `hexapod_enemy.js` 调用方默认 3 → 基于 spinUp（`spinUp*30`，0停/30满），死亡传 0；③ `enemyAI.js` 过热恢复 `heat<20`→`heat<=0`（强制散热必须降到 0 才能再旋转→达标→射击）
- **状态机**：不攻击/不在射程→spinUp 衰减停转；攻击→spinUp 渐增加速旋转；spinUp>0.7 达标射击+发热变红；heat≥80 过热停射停转；heat 降到 0 才解除；玩家六足无武器→枪管永静
- **六足玩家跑/走恢复**：键盘 WASD（满力度1）→ 跑（Run 步态 2/4，5.0 m/s）；手柄摇杆低力度（<0.7）→ 走（Walk 1/3，2.5）；strafe_run 19/20。原调试期统一走
- **验证**：Playwright 实测键盘 W→animIndex2/vel5，低力度 0.5→animIndex1/vel1.25，玩家六足枪管静止；CDP 0 错误
- **改动**：hexapod_core.js updateGatlingSpin / hexapod_enemy.js spinRPS+动画映射 / enemyAI.js 过热阈值 / hexapodPlayer.js 跑走判定+RUN_SPEED

### v0.61.2 — 六足玩家坡地地形适应修复（2026-06-18）

- **接通地形适应**: `getGroundHeight` 挂 window（原为 engine.js 局部函数，`HexapodEnemy.init` 取 `window.getGroundHeight` 得 null → `ctx.groundHeightFn=null` → stepGait 地形 pitch/roll 代码从不执行，车身完全水平）
- **防过度倾斜**: stepGait 采样 sD 1.2→2.0（车身尺度）+ 落水/陡崖过滤（采样点 `< h_center-1.2` 用 center 替代，防河岸采样暴涨到 40-65°）+ 平滑（HEX_SMOOTH=12）
- **hRgt 方向修正**: 原照搬坦克公式 `(-cos(yaw+π/2), sin(yaw+π/2))`，但六足车头朝向不同致左右反；改为 `hFwd×up = (-sin yaw, -cos yaw)`（右侧）
- **pitch/roll 轴修正（最隐蔽）**: 六足车头本地 **−X**（坦克是 −Z），YXZ 下 `rotation.x`=侧倾、`rotation.z`=俯仰，与坦克相反；原代码照坦克赋值致前后落差错误地变成侧倾；修正 `_rollT` 去负号 + 交换赋值（`rotation.x`←侧倾，`rotation.z`←俯仰），正对坡顶只俯仰不侧倾
- **效果**: Playwright 实测连续缓坡 pitch=9.6° roll=0.3°（俯仰主导），陡岸不暴涨，0 console 错误
- **改动**: engine.js（挂 window.getGroundHeight）/ hexapod_core.js stepGait 地形段；顺带修复六足敌人地形适应（同一 init 路径）

### v0.61.1 — 六足玩家步进式转向架构（2026-06-17）

- **步进式转向架构**: turnRate离散化，每步态周期(0.32s)采样目标转向量→单步转角(≤0.5rad)→整周期恒定执行；身体由stepGait步态驱动转向(腿蹬地+预伸)，非每帧跟视角
- **视角/机体解耦**: 视角即时跟鼠标(cameraYaw)，身体步进慢追(笨重延迟，平移补精细瞄准)；移动按视角(W=鼠标看的方向)
- **根治#5转向腿飞**: 腿圆弧预伸(转向反向)+支撑蹬地，髋限位玩家×1.35(0.45→0.61)容纳
- **根治#6长期漂移**: 摆动闭环homeW+速度前瞻，每周期重置无累积
- **持续追视角**: 玩家始终stepGait(鼠标停后身体继续转到位)，跳过动画切换resetPose(步进状态连续)
- **参数**: STEP_PERIOD=0.32 MAX_STEP=0.5 IDLE_THR=0.02（stepGait玩家分支可调）
- **改动**: hexapod_core.js stepGait / hexapodPlayer.js / hexapod_enemy.js / engine.js placeCamera

### v0.61.0 — 六足步态姿势对齐+玩家控制器+探针工具（2026-06-17）

- **模块化玩家角色控制器**: `js/playerControllers/` 可插拔架构，`PlayerControllerManager` 注册表+能力探测，六足玩家(WASD八方向+鼠标转向)，坦克零回归
- **六足步态姿势对齐**: bodySpeed时序bug修复(用desiredVel)，玩家支撑相钉plantPos(对齐工厂)，fwdBody跟随真实移动方向(8方位连续)，hip 0.45→0.15, shin 0.96→0.29, fx 0.43→0.09, hipPeriodJump 0
- **探针测量工具**: `js/hexapod_probe.js`，F7/F8快捷键，localStorage持久化，`__hexProbeStats/Compare` 精简统计
- **Playwright自动化**: npx playwright 1.60用于真实复现gameLoop运行时行为
- **状态栏**: statusLine显示模型·输出风格·会话·上下文%·PR
- **已知问题**: 六足玩家鼠标转向+移动叠加仍会飞(turnRate=0); 长时间WASD误差积累

### v0.60.4 — 性能优化+天空修复（2026-06-15）

- **草丛合并**: InstancedMesh按单元格分块(每类型~64DC)→按类型合并(固定3DC), draw call降90%+
- **草材质优化**: MeshStandardMaterial→MeshLambertMaterial(PBR→漫反射, GPU开销降~30%)
- **草片面剔除**: DoubleSide→FrontSide, 片段着色器调用减半
- **河流碰撞网格化**: 新建\_riverGrid(SpatialGrid), checkCollision/isInRiver/多轮推离全部O(1)查询
- **天空GLSL修复**: 两个片段着色器添加precision highp float, 移除冗余normalize(uSunDir)
- **sunLight对齐**: getSunDir()API→engine.js用其对齐DirectionalLight位置和阴影方向
- **渲染器**: 新增renderer.outputColorSpace=SRGBColorSpace
- **雾优化**: fogNear=maxSide\*0.8→0.4, 大气透视更早生效
- **穹顶分段**: 64×32→96×48, 天空球体更平滑
- **调试面板**: 新增renderer.info.render.points显示

### v0.60.1~v0.60.3 — 六足复活修复+武器平衡（2026-06-15）

- **六足复活腿部冻结**: 补回HexapodEnemy.init()重建CCD IK上下文
- **复活后退修复**: retreating条件 radialW< -0.3
- **复活弹药重置**: \_missileAmmoL/R=4
- **导弹窗口**: 15~50m（过热优先missile_retreat后退拉开）
- **加特林过热停转**: spinRPS=0

### v0.59.1 — 手柄视角+稳定器叠加+六足武器修复+敌方平衡（2026-06-12）

- **手柄视角跟随**: 右摇杆X同步驱动视角cameraYaw + 炮塔turretYaw(叠加不互搏), 右摇杆首次推入自动对齐瞄准线
- **稳定器叠加修复**: 回退错误的"世界空间转换"和"反馈纠偏"方案, 恢复稳定器+右摇杆简单叠加模型
- **六足死亡武器清理**: 武器代码入口增加死亡护栏(`enemy.dead || ai.state==='dead'`→continue), 防止虚空加特林/导弹
- **六足复活枢轴累积修复**: init()开头递归清理残留`_death_wp_*`武器枢轴(根因: 死亡1.52s>重生1.0s), createHexapod保存`_weaponParents`原始父引用
- **敌方炮塔转速**: 3.0~~4.0→1.5 rad/s(原6~~8倍于玩家), 不再瞬瞄
- **敌方炮弹散布**: 0.035→0.07(≈2°→4°)

### v0.59.0 — 摄像机+AI+碰撞+装填提示（2026-06-12）

- **摄像机鼠标驱动**: PointerLock API, 鼠标横轴转视角(独立于车身/炮塔), Y轴虚拟准星位置
- **WoT式炮塔稳定器**: 车体转向即时反向补偿turretYaw, 弹道线不漂移
- **六足AI绕圈+武器策略**: 切向+径向分解真绕圈, CHASE导弹→ENGAGE加特林, 过热后退+导弹
- **敌我碰撞**: 玩家vs敌人碰撞推离, 炮弹扫掠球检测命中六足/丧尸/突击车
- **瞄准射线纳入敌人**: 准星+弹道线截断于敌人身体(六足排除腿mesh)
- **装填提示**: 准星周围圆点顺时针走满; 手柄装填完成短震
- **UI条跟摄像机**: 血条/装填条始终在屏幕两侧, 不再跟随车身朝向
- **转向手感**: 删除递增缓启动, COAST 7→20 停止延迟0.2s

### v0.58.0 — 六足动画系统重构（2026-06-11）

- **核心模块 `js/hexapod_core.js`** (~920行): 从模型工厂移植CCD IK+三角步态+踉跄+死亡, 纯计算层
- **数据打通**: 23动画参数表迁入 `models/hexapod_config.js`, 模型工厂+游戏读同一份ANIM_TABLE
- **工厂适配器 `js/hexapod_factory.js`** (~600行): 替代旧hexapod_anim.js, nodeMap→legRefs→core
- **游戏适配器重写 `js/hexapod_enemy.js`** (890→~220行): getObjectByName→legRefs→core, 薄封装
- **髋轴参数化**: hipAxis='y'|'z' 处理模型工厂(Y轴)和游戏(Z轴,skeletonGroup旋转)差异
- **homeOffset相对定位**: 休息姿态足端在身体本地空间偏移, 永远可达
- **NaN根因修复**: ANIM_TABLE字段索引偏移→方向读为字符串→数学运算产生NaN→模型消失
- **已知问题**: AI绕圈攻击逻辑待完善(六足ENGAGE后移动不明显); 训练场复活后第二轮动画偶有异常

### v0.57.0 — 训练场六足CCD IK动画（2026-06-11）

- **六足CCD IK动画系统**: 新建 `js/hexapod_enemy.js` (~890行), 从模型工厂移植CCD IK+三角步态+踉跄+死亡
- **homeOffset相对定位**: 脚位基于休息姿态偏移, 永远在腿可达范围内, 防止累积误差导致反曲/下陷/浮空
- **髋Z轴修正**: 六足模型hip绕Z轴旋转, 修正CCD投影从错误的`_worldY`改为`_worldZ`
- **武器系统独立**: 加特林发射+导弹发射+枪管红热+观瞄发光从旧动画块分离, 不受CCD激活状态影响
- **MG不触发踉跄**: `onEnemyDamaged`增加`skipStagger`参数, MG高射速不触发受击动画防定身
- **动态步幅**: 步态周期/步幅按身体实际速度自适应, 支撑相位移不超过腿长
- **关节限位优化**: 膝关节仅防反曲(近零拦截), 髋关节宽松限位(±2.8rad), 匹配模型工厂行为
- **自动抬升**: `init()`时计算最低尖刺足→抬升身体至标准站姿高度, 空闲/idle自然回到标准姿态
- **动画切换平滑**: 不再弹跳关节到休息姿态, 仅清步态状态让CCD自然过渡
- **已知问题**: 动画切换后偶有腿部绷直(CCD过渡未完成); 卡障碍物时步态仍会尝试推进

### v0.56.1 — 训练场六足敌人+枪管动画（2026-06-10）

- **训练场六足敌人**: 可选择六足为敌方, 模型正确显示+贴地站立, AI可驱动(主动/反击/不反击)
- **模型工厂加特林枪管动画**: 23动画中枪管簇绕中央轴公转(3 RPS), 解决圆柱对称无法自转可见问题
- **六足底部贴地**: 存储`_hexapodTemplateBaseY`到`userData._baseY`, 游戏循环`ground+Y+baseY`贴地
- **玩家死亡修复**: 训练场被火焰/丧尸击杀不再弹出结算画面, 改为复活
- **丧尸重生修复**: 重生时AnimationSystem重置为Idle, 不再保持死亡卧倒姿势
- **已知问题**: 游戏端加特林俯仰旋转轴不对(模型工厂OK); 装甲突击车障碍物平移(AI通用)

### v0.56.0 — 训练场+六足髋限位（2026-06-10）

- **训练场模式**: 主菜单"退出"替换为"训练场"，可选我方/敌方单位类型与敌方行为模式
- **敌方坦克**: T-34/85模型，全参数对齐玩家(HP/速度/炮弹/MG/过热)，炮塔独立瞄准+炮管俯仰+弹道重力补偿
- **无限重生**: 敌我死亡1秒后在出生点重生，主动/反击/不反击三种AI行为
- **六足髋限位**: 髋关节Y轴±0.7rad(中腿)/±0.45rad(前后腿)，防止转弯时腿缠绕
- **命中检测修复**: 敌方炮弹命中判定移至正确的游戏循环，polygonOffset警告消除

### v0.55.1 — 武器校准修复+城市迷彩+地形适应+关节限制（2026-06-06）

- **武器校准修复**: 旋转轴world→local坐标转换，枢轴定位修复，武器不再悬空
- **武器俯仰限位**: 加特林[-17°,+20°]，导弹巢[-60°,+30°]，滑块硬钳位
- **死亡动画武器垂下**: 瘫倒阶段武器绕支架逐渐下垂至机械限位
- **膝关节反曲夹紧**: CCD每次迭代后钳位shin角，禁止穿越零点；plantPos同步修复
- **地形坡度适应**: 装甲突击车增加侧倾(rotation.z)；六足独立管理(hexapod_anim)
- **尖刺足贴地**: 模型预览bbox计算前updateMatrixWorld，自动抬升贴地
- **城市迷彩纹理**: 亮灰底色+深浅灰/蓝灰/银灰斑纹+建筑棱角线，观瞄设备保留原色
- **玩家操控计划**: 六足驾驶映射+瞄准线+武器系统设计文档

### v0.55.0 — 23动画+踉跄+死亡+武器校准（2026-06-06）

- **23动画**: 21步态+踉跄+死亡，stride/stepH数组驱动，步态周期由turnRate推导
- **CCD系统**: damp=0.8转弯/0.5直行，\_initFootDist防漂移，动画循环无缝衔接
- **受击踉跄**: 4阶段CCD驱动(冲击→踉跄→恢复→回归)，反方向腿跺地支撑
- **死亡瘫倒**: 昂首→瘫软→触地，damp 0.85→0.03，6腿各异伸展
- **引擎拆分**: index.html内嵌JS(~5483行)提取到js/engine.js，主文件→627行
- **武器校准**: 瞄准线+双滑块控制俯仰(有旋转bug待修)

### v0.54.0 — 六足腿结构简化+尖刺足（2026-06-04）

- **腿结构简化**: 3节腿(大腿+小腿+尖刺足)，4DOF(髋摆+髋抬+膝+踝)，锥尖单点接地
- **三角步态**: 待机/步行/奔跑，A组(左前+右中+左后)与B组交替支撑/摆动
- **CCD IK测试**: 6DOF CCD(40迭代+0.5阻尼)，单腿IK测试(3模式×3腿型)

### v0.53.0 — 六足战车精英敌人+模型工厂增强（2026-06-03）

- **六足战车精英敌人**：程序化模型（~90部件），昆虫腿外伸姿态（大腿Y+夹角60°/前后±60°），三角步态9种动画
- **武器系统**：两挺加特林机炮+两个导弹/火箭巢，仅俯仰旋转（-20~+45°/ -10~+60°），水平瞄准靠车体转向
- **AI平衡**：车身转向延迟1.5rad/s + 加特林旋转提速0.8s + 过热管理（+25/s射击-15/s冷却，>80停火） + 子弹散布±3°
- **模型工厂增强**：漫反射光照（无死黑面）+ 彩色线框模式 + XYZ轴文字标签 + Group旋转滑杆 + 多选批量旋转
- **截图工具链**：CDP headless截图脚本 + vision.py交叉对比 + 固化脚本
- **架构改进**：模型配置提取到独立共享文件 `models/hexapod_config.js`，模型工厂和游戏端同源
- **代码规模**：+~1500行（enemies.js +400, enemyAI.js +130, index.html +100, model_factory.html +80, hexapod_config.js +350, editor +40, 工具脚本 +400）

### v0.51.0 — 性能优化+CDP验证+村落修复（2026-06-02）

- **FBM 优化**: 大地图自动降采样（>400m→½分辨率，bilinear插值），800m 从 54s→~15s（~3.5×）
- **密度参数**: sqrt 非线性缩放替代线性（池塘 36→5，村落数适配面积）
- **多轮选址**: 3轮递进搜索+自适应间距（小图40m/大图80m）+回避已有plaza+平坦度硬门槛0.35
- **广场安全**: plazaR+roadW/2+5m 安全距离，防止村落穿越主路
- **纹理修复**: moistRaw 归一化修正（92%泥地→70%草地）
- **CDP 自动验证**: cdp_verify.py（WebSocket+注入Error收集+进程级清理+误报过滤）
- **面板修复**: 删除硬编码重复 gen-status-panel + setProperty('important')
- **工具**: +cdp_verify.py(~379行) + vision.py(~121行) + favicon.ico
- **编辑器**: editor_terrainGen.js(~914行，+164行优化+选址+密度修复)
- **Flood Fill区域分割**: BFS连通域分析→按面积×平坦度评分排序→加权随机选址
- **容量预验证**: 选址前内存模拟建筑放置，不足minBuildings则放弃并记录原因
- **建筑簇分布**: 2-4个角度簇(村前方向±100°扇形)，簇心距广场25-55m，每簇独立撒建筑
- **建筑朝向**: 面朝最近道路段(atan2计算yaw)，不再全部朝北
- **连接路**: 广场边缘到每个建筑簇中心画水泥连接路
- **支路截断**: 支路止于主路边缘(mainHalfW+1m)，避免混凝土覆盖柏油
- **确定性随机**: Mulberry32 PRNG，seed=0自动随机，相同种子→完全相同地图
- **生成状态面板**: editor_genStatus.js，实时阶段进度+统计+质量评分+失败原因+30s自动隐藏
- **密度参数**: 村落数/树木数/池塘数按可建面积自动换算，适配200-800m地图
- **CDP自动验证**: Chrome DevTools Protocol直接捕获真实浏览器控制台，0错误通过
- **已知问题**: 800×800地图耗时~54s(FBM瓶颈)；密度参数需调整(36池塘过多)
- **编辑器模块增至6个**: +editor_genStatus.js(~120行)

### v0.49.0 — 编辑器模块拆分+池塘碰撞修复（2026-06-01）

- **编辑器模块拆分**: map_editor.html 从5167行拆为5模块(1762行,-66%)，主文件仅留框架+事件绑定
- **池塘碰撞修复**: checkCollision()增加椭圆边界推离，敌人/丧尸不再突破池塘空气墙
- **模块优先架构**: 新功能优先独立JS模块，三个主文件不宜再增大，主文件作框架/加载器
- **自动验证**: Chrome headless CDP抓取控制台错误，有错则自修复循环，无误再通知用户

### v0.48.0 — 河面AlphaMap+主路A\*寻路+修复（2026-05-31）

- **河面AlphaMap**: strip被Canvas遮罩平面彻底替换，2048px Canvas绘河道路径为白色→alphaMap裁切，弯道零自交
- **主路A\*寻路**: 局部贪心等高线搜索→A\*全局寻路，指数坡度惩罚(slope≥0.35断路)+加权启发(×0.7)+StringPulling后处理
- **村路/广场splatMap化**: 移除3D strip，改用编辑器splatMap贴图+广场圆形填充，只主路保留strip
- **建筑群半圆约束**: 分支前进方向±90°内分布，避免连接路跨回主路
- **蓝图base64解码修复**: demo端convertBlueprintToMapConfig补充heightmapB64/splatMapB64解码
- **死亡UI**: HP归零瞬间bar隐藏+输入切断，重生恢复；战败画面加"重新开始"按钮
- **F4上帝视角**: 关雾+增FOV+拉远相机，俯瞰全图；退出自动重置
- **F3碰撞可视化默认关闭**: \_debugVisible=false
- **P7死代码清理**: waters.js删75行(\_catmullRom/\_smoothPathCR/subdivideSharpCorners等)，index.html删20行(scene2/tankHull/getTerrainTypeAt)，obstacles.js修botMesh重复推送

### v0.47.0 — 地形系统重构+道路路径化（2026-05-31）

### v0.46.0 — 模块拆分+水面ShapeGeometry+编辑器裁剪+手柄优化（2026-05-30）

- **模块拆分完成**: waters.js(~405行)+bridges.js(~177行)+debugcolliders.js(~120行) 从index.html拆出，index.html 5554→5094行
- **编辑器河面ShapeGeometry**: earcut三角化闭合多边形（右岸+左岸），替代条带方案，消除弯道自交
- **桥梁碰撞修复**: lx/lz轴互换bug（纵向/横向检测颠倒，致桥面碰撞全错）、老格式桥isOnBridge无限Z轴延伸修复
- **getBridgeSurfaceY**: 实际桥面高度支持（编辑器桥不再硬编码BRIDGE_SURFACE_Y=0.175）
- **effHw弯道缩窄公式修复**: cos(dAng/2) 替代无效 min(1,1/cos)
- **虚空拖拽裁剪**: 编辑器河流/道路边界钳制+间距去重+虚空桥过滤
- **手柄优化**: stickToTarget 3段→5段力度(0.25/0.5/0.75/1.0)、倒车转向反转改用实际速度判定、摇杆换向dirFlip检测
- **F3碰撞可视化**: 从riverColliders[]和currentMapData.bridges运行时数据反向生成
- **履带参数**: TRACK_ACCEL/COAST随MAX_SPEED翻倍同步调整(10/16/7)
- index.html 5094行, waters.js ~405行, bridges.js ~177行, debugcolliders.js ~120行, input.js ~71行

### v0.45.0 — 水体/桥梁/出生点数据对接修复（2026-05-29）

- **编辑器-游戏数据对接**: saveBlueprints TypedArray自动转Array、exportMapJson始终含heightmap+河流+桥端点、矩形地图纹理坐标修复
- **水体系统增强**: 多河流支持、交叉水面统一、河床基准一致（排除已挖区）、端点方向裁剪、河岸钳制多距离采样
- **游戏端水面渲染**: 弯曲路径平滑滤波、NaN防护、重复创建消除、FrontSide材质
- **桥梁系统重写**: 编辑器桥定向+deckY高度、游戏端碰撞检测(isOnBridge支持任意朝向)
- **出生点修复**: 游戏端读取spawnPoints、编辑器唯一性保护、坦克速度翻倍(4→8m/s)
- **调试**: 红色环可视化河岸空气墙
- index.html 5454行, map_editor.html ~3100行, maploader.js新增

### v0.44.0 — 地图拆分+桥梁修复+编辑器增强（2026-05-28）

- **地图数据文件拆分**：地图数据从 index.html 内联拆分到 maps/\*.map.json 独立文件，新增 maps/\_index.json manifest，启动时动态 fetch 加载
- **桥梁引道重写**：平整区（桥覆盖段统一高度）+ 两端斜坡（向内陆渐变），\_carvedCells 记录修改可撤销，修复重复生成凹坑累积
- **蓝色纹理修复**：桥梁雕琢不再写入 editedVerticesPaint，避免触发 vertexColors 水体蓝染
- **河床统一深度**：水面=河岸最低-3m，河床=地图最低-10m，自动计算无需手动设深度
- **编辑器功能增强**：3D视口Ctrl+单击多选实体、Shift+框选、Delete键删除、实体列表排序分色、随机生成面板移至右侧
- **河流生成重构**：mouseup统一判断河流/湖泊意图，分段水面剖面，走廊法雕刻+边缘平滑
- **多段河流穿越**：detectAndBuildBridges 改为进入/退出状态机，蛇形道路每段独立建桥
- **小地图村落自适应**：scaleF缩放村落规模，广场位置动态调整，分支长度适配地图尺寸
- **WORLD_SIZE/WORLD_HALF残余清理**：~25处改为独立X/Z尺寸变量，适配矩形地图
- **修复**：编辑器蓝图加载尺寸变量同步、弹道预测线重建、loadBlueprint桥梁网格清理

### v0.43.0 — 灵活地图尺寸+矩形地图（2026-05-27）

- **灵活地图尺寸**：地图编辑器支持独立 X/Z 尺寸（playWidth×playDepth / worldWidth×worldDepth），任意矩形
- **坐标系全链路适配**：引入 hmStepW/hmStepD（X/Z独立网格步长），水体/地形/水面/桥梁/编程生成全面适配矩形地图
- **摄像机动态适配**：camera.far 和阴影相机范围跟随地图尺寸动态调整
- **编辑器摄像控件修复**：平移/旋转方向修正 + 右键平移 + 实体选中离开模式自动清除高亮
- **Poisson采样矩形化**：从圆形(totalRadius)改为矩形(halfW/halfD)适配
- **EnemyAI空间网格**：从固定10×10改为动态ceil(playW/20)×ceil(playD/20)
- **5张测试地图**：添加 playWidth/playDepth/worldWidth/worldDepth 字段
- **遗留问题**：程序化生成中少量 WORLD_SIZE/WORLD_HALF 残留（半径换算、道路/村庄边界），矩形地图上略偏大

### v0.42.1 — 游戏结束画面+战斗统计（2026-05-26）

- 生命耗尽显示游戏结束蒙版+详细统计面板（积分/击杀/时间/伤害）+死亡记录+ESC返回菜单

### v0.42.0 — 双人模式+桥梁修复（2026-05-26）

- **updateMatrixWorld()**：在 rotation.set 后立即调用，瞄准系统读取当帧矩阵

### v0.39.0 — 操作方式重构：WASD驾驶+鼠标瞄准+炮塔/炮管（2026-05-25）

- **WASD 驾驶模型**：取代旧 W/S/↑/↓ 双履带独立控制，A/D 原地转向，W+A/D 行进转向
- **鼠标瞄准系统**：十字准星跟随鼠标 → Raycaster 投射到地形 → 炮塔旋转+炮管俯仰追踪
- **重力补偿**：瞄准角自动计入炮弹飞行重力下坠，预先抬高炮管
- **绿/红准星**：射程内+无遮挡+角度可达→绿色；否则红色；红准星也可开炮
- **手柄弹道预测线**：抛物线弧线从炮口出发，遇障碍截断，碰撞点光点标记
- **手柄右摇杆**：X轴炮塔旋转+Y轴炮管俯仰，到达±极限硬停止，归中不自动回中
- **开炮**：鼠标左键+手柄RT；Space+LT 预留同轴机枪
- **双人模式**：1P 键鼠+准星，2P 手柄+预测线
- **修复**：A/D方向、准星颜色、炮弹轨迹朝向、俯仰方向、鼠标按住不开火

### v0.38.1 — 模型工厂清理优化（2026-05-24）

- **删除"当前版" TANK_CONFIG（~190行）**：切换菜单只保留 v1.6/建筑/敌人
- **新增"📥 导出JSON固化"按钮**：一键下载完整嵌套配置JSON，解决Console输出扁平列表的局限
- **透视视图相机拉远**：pos [2.5,2.0,3.5] → [5.0,3.5,6.0]
- **清除 TrackChain 诊断日志**（~64行 console.log）
- **新增 `固化.ps1` 脚本**：一行命令完成 JSON→源码 替换
- **修复 localStorage 自动加载旧版 'tank' 模型导致的崩溃**

### v0.38.0 — 履带系统重构 TrackChain r21（2026-05-24）

- **TrackChain 6点+2弧精确几何模型**：用户设计理想拓扑，6个关键点(A~F) + BC/FA两段标准圆弧 + 4段线性插值
- **负重轮间距比例修正**：b1~b5边缘间隙按 2:3:1:1 分配，b2→b3间距最大，符合真实T-34/85
- **诱导轮/主动轮Y上调**：a1(cy=0.52→0.58)、c1(cy=0.45→0.50)，顶部与负重轮平齐(Y=0.80)
- **wheelR半径修正**：Cylinder size[0]实为半径非直径，wheelR从0.20→0.40
- **Z轴方向修正**：圆弧段 Z = center.z - r\*cos(angle)（屏幕左=Z+方向取负）
- **BC弧改为逆时针短弧**：12→11→10→9→8→7 (150°)，避免走顺时针长弧
- **移除调试标记**：清理钟面Sprite和6点彩色球体+文字标签
- **model_factory.html** TrackChain段数从8→6段，移除sin²调制等复杂逻辑

### v0.37.1 — 清理废弃分支（2026-05-23）

- **删除T-34-85 v1.5模型**：移除 `createT34_85_v1_5()` 函数及 `T34_85_V15_CONFIG` 配置
- **删除模型工厂切换接口**：移除 GUI 中的 `t34_v15` 选项、`currentTankVersion` 变量、版本切换代码
- **ModelRegistry 清理**：移除 `t34-85_v1_5-green` 和 `t34-85_v1_5-desert` 注册
- **T-34/85 v1.6 迭代至 r13**：与看图AI协作13轮，模型工厂新增切换入口
  - 新增 `docs/` 目录：规范文档+环境依赖+r1~r13交互反馈+参数表+交接文件
  - 环境改进：正交/透视切换、背景调色盘、5灯光照栈+阴影、TrackChain绿线可视化
  - v1.6 当前 44 部件，含6段履带路径+10个负重轮+六棱台炮塔+发烟筒+外挂油箱

### v0.37.0 — 模型工厂修复 (model_factory.html)（2026-05-23）

- **TaperedHex六棱台法线修复**：侧面索引绕序修正（法线朝外），底面/顶面改用公共顶点扇形三角化，消除全黑/透明问题
- **Group位置保存修复**：`syncConfigFromScene` 不再跳过 Group 节点，炮塔总成/炮管总成的移动可正确保存到 localStorage
- **Cylinder语法补全**：添加 TaperedHex 分支时遗漏 Cylinder 的 `else if` 条件头，导致 SyntaxError
- **配置固化**：炮塔主体 TaperedHex + 下车体/上车体 TaperedBox + 18个部件参数更新

### v0.36.1 — 模型工厂 (model_factory.html)（2026-05-22）

- **🏭 模型工厂**：独立通用程序化模型编辑器 `model_factory.html`，~1580行
- **7种几何类型**：Box / TaperedBox(台型) / RoundedBox(倒角) / Cylinder / Sphere / Torus / Lathe / Extrude
- **TaperedBox**：自研台型几何体，顶底矩形不同大小，用于精致车体底盘
- **选择系统**：单击单选 + Ctrl多选 + 全选按钮，选中部件金色/青色高亮 + 左下角路径面包屑
- **批量编辑**：多选时批量位置偏移(累积式滑杆)+颜色+材质，Delete删除，Esc取消
- **结构编辑**：每个部件可重命名(中文名)+形状切换+添加/删除子部件，Lathe/Extrude轮廓JSON编辑
- **撤销系统**：onChange内联快照，Ctrl+Z逐步撤销，最多50步
- **视图切换**：7种预设视图(透视/前/后/左/右/顶/底)，平滑动画过渡
- **数据持久化**：Ctrl+S保存到localStorage，自动加载上次状态
- **坦克中文命名**：底盘/上层结构/翼子板/炮塔总成/炮管总成/指挥塔等18个部件
- 新增文件：`model_factory.html`（~1580行）

### v0.36.0 — 水面修复（2026-05-21）

- **根因发现**：游戏循环每帧执行 `waterPlane.position.y = WATER_LEVEL(-1.0) + sin(...)` 硬编码覆盖，`createWaterSurface()` 中计算的水面高度完全无效
- **修复**：`waterPlane.userData.baseY` 存储实际水面高度，游戏循环改用 `baseY` 替代 `WATER_LEVEL` 常量
- **椭圆形水面**：水面从圆形改为椭圆（`a = rx×1.25`, `b = rz×1.25`），覆盖完整池塘雕刻范围
- **堤岸修整**：`createGround()` 中池塘边缘 `ed=1.0~1.25` 范围地形平滑过渡到水面高度，消除盆地侧壁悬空
- 修复范围：`index.html`（水面创建 + 游戏循环）

### v0.35.0 — 编辑器地图全链路修复（2026-05-21）

- **坐标映射修复**：getTerrainHeight 编辑器高度图 half 100→150，与纹理 300×300 坐标系统一，消除河床 ~19m 偏移
- **分段水面**：createRiverWater 使用 riverWaterLevels 分段水位替代单一全局水位，水面跟随河床起伏
- **河流宽度**：convertBlueprintToMapConfig 传递 riverWidth，水面宽度匹配编辑器画笔半径
- **空气墙修复**：碰撞半径 hw+1.5→hw+4，密度 ↑35；createBridge 不再清空 riverColliders
- **树木载入**：createObstacles 消费 editorTrees（InstancedMesh 顺序修正）；编辑器实体边界 spawnR→±150；随机障碍物清零（JS falsy 陷阱修复）
- **巡逻卡住**：enemyAI.js 卡住检测改用距巡逻点距离缩小替代绝对位移，消除敌人互推振荡
- **水面不可见修复**：三角形绕序修正为逆时针（法线朝上），添加 `DoubleSide` 兜底；主游戏编辑器河流同步修复
- **水面沉入河床**：`waterBaseLevel = maxOrigH - brushStrength × 0.6`，水面在凹槽内而非浮在地表
- **锐角折叠修复**：贝塞尔预平滑（`subdivideSharpCorners`）在折角>40°处插入插值点，消除条带顶点交叉
- **5项编辑器bug修复**：`isEdited`→`isEdited_w`、`t0`作用域提升、`adjustedWaterLevel`→`waterBaseLevel`、`polygonOffset` 深度冲突、水面采样点改用平滑路径
- **日志清理**：精简河流/树木诊断输出，保留关键摘要
- 修复范围：`map_editor.html` + `index.html`（~150行修改）

### v0.34.0 — 加载画面+编辑器地图对接+批量编辑+巡逻分散（2026-05-21）

- **加载画面**：进入任意地图时显示黑色底+渐变色进度条+7步状态提示，解决干等问题
- **编辑器地图贴图修复**：convertBlueprintToMapConfig传递splatMap，generateSplatMap优先使用，修复全绿问题
- **编辑器河流水面对齐**：蓝图层传递waterLevel，createRiverWater优先使用蓝图水位，替代硬编码-1
- **编辑器河流空气墙**：editorBridges路径添加riverColliders，河流路径均匀生成~20个碰撞点
- **敌人批量属性编辑**：多选敌人时属性面板支持批量写入HP/速度/视野/行为模式
- **实体列表分类折叠**：建筑/树木默认折叠（随机生成不常编辑），出生点/敌人保持展开
- **巡逻分散**：多敌人共享路线时均匀分散起始路径点索引，避免扎堆堵塞
- **卡死检测优化**：巡逻卡住超时3s→1.5s，连续卡住≥3点随机偏移2-6m
- **文档压缩**：CODEBUDDY.md 569→248行(-56%)，README.md 1109→655行(-41%)

### v0.33.1 — 桥梁引道地形修整 + 水平桥面（2026-05-20）

- **桥梁修整**：桥面改回水平 BoxGeometry，两端引道 5m 范围地形渐变（挖方/填方），解决悬崖撞墙
- **桥梁检测**：使用 `pointToSegmentDist` + 河流实际半宽替代硬编码阈值
- **桥面栏杆**：Line 栏杆随桥面角度
- **引道网格**：BufferGeometry 斜坡面板衔接桥面与地面

### v0.33.0 — 分段水面剖面，起伏地形河流正确（2026-05-20）

- **分段水面剖面**：每段水面 = min(前段水面, 本地形-strength×0.3)，单调不增，解决起伏地形河面溢出
- **走廊雕刻使用局部水面**：每个单元格用最近段的局部水面做 cap
- **水面网格跟随剖面**：createWaterLayer 每个单元格独立水面高度
- **端点削波**：距路径起点/终点 hw 范围内深度线性归零
- **走廊法河床雕刻**（v0.32.5）：不再沿路径叠刷子，直接计算走廊内每个网格单元格深度
- **ease-out falloff**（v0.32.6）：t(2-t) 替代 smoothstep，河岸过渡宽 3-7 倍
- **统一网格单元水面**（v0.32.2~v0.32.3）：河流+湖泊统一从高度图网格构建四边形，消除弯道重叠
- **移除 mousedown applyBrush**（v0.32.5）：避免起点圆形坑与走廊不匹配
- **线性 falloff → ease-out falloff**（v0.32.4→v0.32.6）：逐步平滑河岸坡度
- 全部修改在 `map_editor.html`

### v0.32.0 — 河流生成功能修复（2026-05-19）

- **性能优化**：`applyBrush` 添加 `skipGeoUpdate` 参数，批量雕刻时跳过几何体更新，`mouseup` 时一次性 `createGround()` 重建
- **河床雕刻逻辑修复**：`targetH = 原始地形 - 下切深度`，保证下切效果；`finalH = min(targetH, waterBaseLevel - 0.5)` 保证河床低于水面
- **水面创建逻辑重写**：使用矩形条带法（直接用 `w.points` 构建），消除 CatmullRom 曲线法向量扭曲导致的"射线状蓝色扭曲"
- **海平面计算修复**：取轨迹上最高原始地形高度，确保水面高于所有轨迹点
- **调试日志增强**：添加性能耗时日志（`performance.now()`）、河床高度抽查日志、水面顶点数日志
- 修复范围：`map_editor.html` 水体系统相关函数（~100行修改）

### v0.31.0 — 河流碰撞检测+自动桥梁（2026-05-19）

- **河流碰撞检测**：`isPointInWater()` 统一检测池塘+河流，建筑/树木不再生成到河流中
- **自动桥梁**：`detectAndBuildBridges()` 支持河流折线检测，道路跨越河流自动生成桥梁
- **isPtInPond 增强**：自动同时检查 `mapData.waters` 中的河流水体
- **randomGenerateTerrain**：障碍物放置使用 `isPointInWater()` 替换旧池塘检测
- 修复范围：`map_editor.html` 4处关键函数（~60行新增/修改）

### v0.30.0 — 树状道路+村落系统（2026-05-18）

- **道路+村落树状生成**：index.html 和 map_editor.html 双端实现，主路→村路→广场→建筑集群+连接小路
- **index.html 道路系统**：generateRoadVillageSystem 生成主路(1-2条)+垂直村路分支(2-4条)+村落，泊松采样排除道路区域
- **map_editor.html 村落生成重写**：randomGenerateVillage 全流程重制，首先生成主路再分支再到广场和建筑，不再事后清除"远建"
- **modelRegistry 扩展**：新增 randomBuildingMaker() 建筑专用随机选择
- **控制台调试日志**：详细输出生成阶段、村庄数量、建筑数量、树木数量
- **Bug 修复**：spawns is not iterable（spawnPoints 非数组安全保护）

### v0.29.0 — 地图编辑器 Phase 1-6 完成（2026-05-15）

- **Phase 1-5 地图编辑器**：独立 `map_editor.html`（~2700行），300×300世界+200×200空气墙
- **编辑工具**：高度笔刷5种+SplatMap纹理6种+实体放置5类+水体+桥梁+巡逻路径
- **多选编组**：Ctrl/Shift多选、双击选同类、Alt+双击选同大类、编组管理、批量巡逻复制
- **蓝图系统**：localStorage暂存/恢复草稿、文件导入/导出、参数化地形拟合
- **3D功能**：透视相机+选中高亮环+拖拽连续放置+实体地形联动
- **Phase 5 敌人配置面板**：HP/速度/视野/攻击伤害/冷却/掉落/回血/行为模式/得分编辑，实时写入 cfg
- **Phase 6 UndoManager**：50步快照栈+Ctrl+Z/Y快捷键+完整场景恢复（几何体+实体+水体+桥梁）
- **Phase 6 主游戏集成**：index.html动态读取localStorage蓝图→地图选择列表追加📝编辑器地图→离散高度图模式
- **Phase 6 性能优化**：3D视口限帧30fps+笔刷脏矩形批处理延迟到帧末+防抖刷新

### v0.28.1 — 丧尸3层LOD + 贴图提亮 + 机枪强化 + 修理箱程序化重制（2026-05-14）

- **丧尸3层LOD**：near(<30m)全帧动画→medium(30~70m)冻结骨架→far(>70m)圆柱占位，5m滞后带防抖动
- **丧尸贴图提亮**：基底#8B9B7E→#A9B89E，血渍/溃烂/污垢全面提亮，缩小与LOD圆柱的色差
- **机枪强化**：射速5→10发/秒，过热时间4→6秒，DPS 10→20
- **引擎音量减半**：engine gain 0.1→0.05，track noise 0.06→0.03
- **程序化修理箱重制**：ExtrudeGeometry倒角红箱(0.30×0.25×0.10)+黑Torus提手+扳手螺丝刀PNG图标+底部金属边条+发光环，取代旧GLB(172K tris)
- **清理**：移除pickups.js中GLB预加载代码(~50行)

### v0.28.0 — 丧尸AI重写：8状态机+30只集群+2层仇恨连锁+巡逻随机化+碾压系统+性能优化（2026-05-13）

- **丧尸8状态AI**：IDLE→PATROL→ALERT→PURSUIT→SEARCH→ATTACK→STAGGER→DEAD，~180行独立状态机
- **30只丧尸04a地图**：5×6网格疏散布局（min 5.3m / max 53m），每只独立巡逻路径
- **2层仇恨连锁**：受击→L1邻居(25m)→L2邻居(25m)→止，防止全图唤醒
- **巡逻随机化**：独立IDLE时长(1.5~4.5s)、20%概率节点暂停、随机初始朝向(360°)
- **坦克碾压系统**：三重条件（速度>3.0 + 合速度>4.5 + 正面30°锥），低速不碾
- **MG音效重做**："突突突"三连方波低音脉冲
- **纹理浅色化**：所有丧尸纹理层提亮~20%
- **性能优化三项**：
  - 几何体模板克隆（首只构建→`clone(true)`复用）
  - 动画LOD分帧（0~~30m全帧/30~~55m~15fps/>55m冻结）
  - 空间网格加速（20m格10×10，仇恨查询降低~90%）
- **修复**：GLB坦克模型恢复（清理误删的createPlayerTank~120行）、HP条实时归零、丧尸影子、v0.26.11遗落配置碎片

### v0.27.0 — 新程序化丧尸集成：GLB系统清理 + enemies.js重写 + 04a部署5只（2026-05-13）

- **GLB丧尸系统清理**：移除约300行 GLB加载/缓存/蒙皮克隆/动画控制器代码
- **enemies.js重写**：从 zombie_prototype.html 移植 ZOMBIE_CONFIG + buildZombieFromConfig + AnimationSystem（6动作），替换旧300行丧尸代码
- **index.html适配**：简化createEnemies丧尸创建→直接调用createZombie()，动画驱动从zombieMixer→AnimationSystem
- **地图更新**：04a新增 zm-03/zm-04/zm-05，总计5只丧尸
- **代码清理**：注销 tank.js 的 green/desert 注册，删除GLB丧尸模型预览菜单条目

### v0.27.0-原型 — 程序化丧尸模型原型：ZOMBIE_CONFIG + 关节pivot + 程序化贴图 + AnimationSystem（2026-05-13）

- **`zombie_prototype.html`** 独立原型文件（~900行），包含完整工具链
- **ZOMBIE_CONFIG** 层级树配置：24个节点（含11个关节pivot），458 tris
- **buildZombieFromConfig()** 递归构建函数：Box/Sphere/Cylinder + 关节pivot补偿算法
- **程序化贴图**：Canvas 2D 生成 256×256 diffuse + roughness（血渍/溃烂/污垢）
- **材质字典**：skin_rot / cloth_torn / eye_glow，materialId 复用 MeshStandardMaterial
- **自动插入部件**：发光眼睛(emissive #ff2200) × 2 + 血迹滴落 × 4
- **AnimationSystem**：自定义动画系统（6种动作：Idle/Hit/Attack/Walk/Run/Die）
- **lil-gui 调试面板**：18个部件位置/角度滑杆 + 固化JSON输出
- **Three.js CDN**：r160 (unpkg)，独立运行无需主项目环境

### v0.26.14 — 丧尸GLB尺寸修复：Armature.scale→1+双倍掉落+纹理恢复（2026-05-12）

-**修复**：
-- **尺寸修复**：`Armature.scale=(1,1,1)` 消除Blender导出的0.01压缩，`boneInverses=inv(boneWorld)`重算，`model.scale≈0.95`
-- **双倍掉落**：死亡动画添加`deathAnimDone`防重复标记
-- **纹理恢复**：关闭`ZOMBIE_GLB_DEBUG`，恢复原始GLB材质
-- **MG击杀**：僵尸更新环添加全局安全网（hp≤0→dead，不限状态）
-- **🔴 已知遗留**：丧尸渲染异常（两条飘带），可能因`Armature.scale`变化影响骨骼蒙皮

### v0.26.13 — GLB包围盒世界矩阵修复+僵尸尺寸/位置恢复正常+MG击杀安全网（2026-05-12）

-**修复**：
-- **巨人bug**：包围盒计算改用 `gltf.scene.updateMatrixWorld(true)` + `c.matrixWorld` 替代 `c.updateMatrix()` + `c.matrix`。局部矩阵不包含 Armature scale=0.01，导致 bboxMinY=-0.95m → position.y=90m（浮空）。世界矩阵修正后 bboxMinY≈-0.0095 → 正常贴地。
-- **MG击杀**：僵尸更新中添加全局安全网（不论状态，hp≤0 立即→dead）。之前仅 STUNNED 状态下有 hp≤0 检查，MG击杀时可能跳过。
-- ZOMBIE_GLB_DEBUG 恢复开启（MeshNormalMaterial 替代纹理便于验证尺寸）
-- **🔴 验证中**：04a地图丧尸尺寸/位置/动画是否全部正常

### v0.26.12 — 丧尸GLB渲染诊断：Armature.scale根因+baseScale补偿公式（2026-05-12）

-**诊断成果**：
-- **Armature scale=0.01根因**：GLB中 `Object3D "Armature"` 自带 `scale=(0.01,0.01,0.01)`，使1.9m模型渲染为0.019m
-- **补偿公式**：`baseScale = targetH / (sz.y × armatureScale) = 1.8 / (1.9 × 0.01) = 94.74`，放大外层model.scale补偿
-- **不可改Armature.scale**：直接修改会破坏骨骼绑定矩阵（`inverseBindMatrices`）
-- frutumCulled=false已应用、SkinnedMesh MeshNormalMaterial诊断已添加
-- SkinnedMesh 仍不可见 → 怀疑 `clone(true)` 骨骼引用未重新绑定

### v0.26.11 — 分图04a丧尸专属+GLB预加载+丧尸死亡无爆炸+动画hash匹配（2026-05-12）

-**改进**：
-- **地图分拆**：03a恢复为纯装甲突击车(av-01/av-02)，新建04a丧尸专属地图(zm-01/zm-02，出生距离~90m)
-- **GLB预加载**：页面初始化时即启动丧尸GLB异步加载+挂起队列自动升级
-- **丧尸死亡**：倒地动画播完后直接移除实例，无爆炸/碎片/音效
-- **动画名hash匹配**：KNOWN_MAP改为hash前缀（20aff4d1=idle, 97951ef0=walk, adfdbf68=run, 31d8bc8b=attack, 38bab115=hit, 6981c077=death）
-- **丧尸禁用地形俯仰**：`_noTerrainPitch = true`
-- **🔴 已知遗留**：丧尸GLB出现位置异常(挤在出生点)、尺寸巨大、T-pose不动。AnimationMixer绑定group而非SkinnedMesh可能是动画不播放的原因；GLB Armature层级transform可能导致定位/尺寸异常。

### v0.26.10 — 丧尸GLB动画集成：AI状态驱动6动作+STUNNED定身+近战命中帧判定+死亡动画（2026-05-12）

-**新增**：
-- 丧尸GLB动画集成：6个GLB骨骼动画（待机/走路/跑步/挥击/受击/倒地）与AI状态机双向映射
-- 新增 AI_STATE.STUNNED：丧尸受击后循环受击动画定身，1.5秒未再受击恢复
-- 挥击动画命中帧检测：动画播放到~60%时一次性扣血（间隔式伤害），冷却2秒方可再次攻击
-- 死亡动画：丧尸死亡播放倒地动画（单次），播完后触发爆炸+碎片+移除模型
-- 丧尸GLB缓存系统：首次加载→clone(true)复用，回退程序化模型兜底
-- 测试03a地图加入2只丧尸（zm-01/zm-02，间距5-8m，含巡逻路径+近战参数）
-- 敌间碰撞按类型区分半径：丧尸0.4m，车辆0.85m
-- cleanupEnemies 支持丧尸 mixer 内存清理

-

### v0.26.9 — GLB预览缩放统一+红色工具箱GLB+包围盒重构（2026-05-12）

**改进**：

- GLB预览包围盒计算重构：改用各Mesh几何体local包围盒8角点×mesh.matrix变换到模型空间（排除骨骼Armature干扰）
- 模型预览统一缩放到1.5m高度，底面精确贴地（原3.0m，不统一导致部分模型悬浮或埋地）
- 程序化模型定位修复：`position.sub(center*s)` → `position.set(-cx*s, -minY*s, -cz*s)`，底面精确对齐y=0
- 丧尸多动作GLB不自动播放动画（T-Pose静止姿态，按←→键手动控制，避免骨骼动画帧导致脚抬离地面）

**新增**：

- 模型预览→GLB模型→新增「维修工具箱 (红色)」条目（`models/glb/红色维修工具箱减面.glb`）
- 战利品工具箱改用GLB模型优先加载（`models/pickups.js`，`preloadGLB()`），程序化回退兜底

- 丧尸GLB缓存克隆复用（1.8m高度，程序化makeZombie回退兜底）

### v0.26.8 — 丧尸多动作GLB模型+动画切换（2026-05-11）

**新增**：

- `models/glb/丧尸多动作.glb`：Blender多动画GLB模型
- 菜单模型预览 → GLB模型 → 新增「丧尸 (多动作)」条目
- 多动画切换：按 ← → 方向键在动画之间循环切换
- 人形模型缩放修复：用高度Y轴而非最大维度（避免T-Pose时缩放错误）
- 包围盒尺寸日志（F12控制台查看）

**已知问题**：GLB文件导入Blender显示异常（巨大棱角球+仅mesh），但预览可用。

### v0.26.7 — 丧尸高精GLB模型预览（2026-05-11）

**新增**：

- 从OneDrive导入丧尸高精GLB模型（27.63MB）到 `models/glb/zombie.glb`
- 菜单模型预览 → GLB模型 → 新增「丧尸 (高精)」条目
- GLB路径映射重构为名称→路径表，便于后续扩展更多GLB模型
- 预览中自动检测骨骼动画并播放（`AnimationMixer` + `Clock` 驱动）

### v0.26.6 — 混元3D丧尸GLB模型生成方案（2026-05-11）

**计划**：

- 混元3D「3D人物生成」→ T-Pose 丧尸白模（50K面）
- Blender Decimate → ~3K三角面（保留关键轮廓）
- 骨骼绑定 Armature + 自动蒙皮
- 5个动画：idle/walk/sprint/lunge/death
- 导出 GLB（勾选 Animation）→ `models/glb/zombie.glb`
- 提示词已备妥：三种方案（文生3D/图生3D/备用变体）

### v0.26.5 — 战利品掉落系统+丧尸模型（2026-05-10）

**新增**：

- 战利品掉落系统：医疗工具箱模型（红箱白十字+扳手+发光环），敌人死亡100%掉落
- 拾取物悬停旋转+微浮动画，接近3m自动拾取，回血+30HP
- 专属拾取音效（上升音阶叮铃），满血状态穿越不拾取
- 丧尸近战杂兵模型（灰白皮肤+肋骨外露+破牛仔裤+前伸抓握手势）
- 巡逻卡障碍物检测：3秒无法接近自动跳过路径点
- 敌人间碰撞检测（间距<1.7m推开）
  **修复**：
- MG射线排除自身坦克（修复出生后子弹打中自己导致无伤害）
- 敌人出生点安全距离调整（移至40m外，避免出生即交战）

### v0.26.4 — 4个PvE战斗bug修复（2026-05-10）

**修复**：

- av-01巡逻启动：初始朝向面向第一巡逻点，moveEnemyToward添加NaN/dt防护
- 敌人地形俯仰：车身rotation.x随地形坡度变化（av-02不再水平悬浮）
- MG音效频率修复：updateMGAutoTarget移出敌人循环（2敌人时不再每帧调用2次）
- 仇恨共享：shareAggro广播，受击敌人40m内盟友同步切换CHASE

### v0.26.3 — 火焰伤害跳距模型修复（2026-05-10）

**修复**：

- 火焰视觉射程12→18u，传播速度14→28u/s，与伤害模型统一
- 火焰伤害改为跳距模型（火焰前沿=已消耗跳数×4.2u，触达才扣血），替代不稳定的elapsed/propDelay判断
- 修复第5跳火伤因 isFlaming 提前关闭而丢失
- 近防机枪发射音效独立化
- MAP_CONFIGS 补充 av-02 敌人配置（原硬编码只含 av-01）

### v0.26.0 — PvE战斗系统架构搭建（2026-05-10）

**新增**：

- 装甲突击车模型（`models/enemies.js`）：低矮六轮浅棕迷彩装甲车，V形铲斗冲撞角+炮塔喷火器
- AI状态机（`combat/enemyAI.js`）：PATROL→CHASE→ENGAGE 被动反击模式
- 积分系统（`combat/scoreSystem.js`）：地图高分记录+累计总分，localStorage 持久化
- PvE战斗地图（`maps/test_map_03a.map.json`）：噪声地形+池塘+河流+桥梁+350障碍物+1辆突击车
- index.html 新增 `combat` 模式：敌人生成/HP血条/碰撞检测/火焰伤害/玩家重生/积分结算/清空积分

### v0.25.4 — 双人模式阴影修复（2026-05-09）

**修复**：versusGameLoop添加阴影相机更新，跟随两玩家坐标中点，按玩家间距动态扩展ortho范围（he=max(18, dist\*0.6+5)），确保双方均有阴影。

### v0.25.3 — 炮弹轨迹计入地形俯仰（2026-05-09）

**修复**：炮弹发射时计算地形俯仰（`terrainPitch`）+ 加速俯仰 + 后坐力 + 基础仰角(5.7°)，恢复标准 `cos/sin(totalAngle)` 投射。解决平地射程短(~66u→~200u)、上坡砸眼前、下坡飞过远的路径不匹配问题。

### v0.25.2 — 炮弹轨迹修复+坡面焦痕修复（2026-05-09）

**修复**：①炮弹发射改用水平速度不变方案（`fx*SHELL_SPEED`），基础仰角从0.009rad加大到0.03rad（~1.7°），消除平地下坠和上下坡轨迹异常 ②焦痕法线采样间距从0.15→0.5，polygonOffset从-1→-4，法线偏移从0.02→0.06，修复坡面焦痕不可见/半圆问题。

### v0.25.1 — 炮弹俯仰发射角+焦痕贴合坡度（2026-05-09）

**修复**：①炮弹发射角计入坦克俯仰（`barrelAngle + 0.3/SHELL_SPEED`），坡地不再飞天或砸脚 ②焦痕用法线采样（`getGroundHeight`三点差分）计算地形法线，圆面旋转贴合坡面，用`polygonOffset`防z-fighting。

### v0.25.0 — 地面命中效果：焦痕+碎片+音效（2026-05-09）

**新功能**：炮弹击中地面（非障碍物/坦克）时产生：①闷响命中音效 ②15个土块碎片飞溅（~~1秒消失）③黑色圆形焦痕（2.5~~3秒渐消淡出，depthWrite=false避免Z-fighting）。同时清理机制覆盖单人/双人/地图重建场景。

### v0.24.10 — 阴影优化：PCFShadow+512分辨率+相机36m跟随（2026-05-09）

**优化**：性能探针定位渲染阶段阴影占18ms/帧。三项优化：阴影类型降级（PCFSoftShadowMap→PCFShadowMap，省采样开销）、贴图1024→512、阴影相机从120×120收紧到36×36且每帧跟随坦克。预期渲染耗时从27ms降至~10ms。

### v0.24.9 — 四阶段性能探针+遮挡透明材质池优化（2026-05-09）

**诊断**：gameLoop插入四阶段探针（物理/战斗/杂项/渲染），实时显示各阶段ms耗时用于定位瓶颈。**优化**：遮挡半透明改用材质池（Map<原始材质→半透明clone>），消除每0.3s的clone/dispose循环，透明clone一次创建后永久复用。

### v0.24.8 — 半透明材质共享Bug修复+阴影优化（2026-05-09）

**修复**：遮挡检测使用material.clone()避免影响共享材质，恢复时dispose还原。阴影贴图2048→1024，草丛关闭castShadow。渲染阶段仍较慢（~30fps），根因待定位。

### v0.24.7 — 移除外围障碍物+遮挡检测降频+距离预过滤（2026-05-09）

**优化**：移除外围障碍物（spawnRadius 148→98, count 600→350），陡视角不可见；遮挡检测降频到0.3s+2D线段8m预过滤，性能恢复60fps。

### v0.24.6 — 河流扩展300m+障碍物遮挡半透明（2026-05-09）

**修复**：河流几何体扩展到300m防止空气墙处截断；新增摄像机-坦克射线检测，遮挡障碍物自动半透明(opacity=0.3)。

### v0.24.5 — 移除天空系统+调整LOD+清理无用变量（2026-05-09）

**重构**：移除 Sky.js+createPreethamSky（陡视角不可见，省GPU）；清理groundEdgeLine/fogRing残余；OBS_RADIUS 65→90, GRASS_RADIUS 70→95；FOV 40°→45°；background匹配雾色。

### v0.24.4 — 陡视角方案：摄像机压低天空（2026-05-09）

**改进**：摄像机后方9.75m/上方9m单人（1.5x）、双人9.6m/8.4m（1.2x），俯角保持坦克在画面下1/3处；Fog 70-110m，移除环形雾盖；视线内看不到地图边缘/折角。

### v0.24.3 — 环形雾盖渐隐+边框线移除+Fog拉远（2026-05-09）

**改进**：取消地形边缘下陷（外圈自然平整）；创建ShaderMaterial环形雾盖（100-150m径向smoothstep渐隐）；移除空气墙边框线；Fog far 80→250，地面始终可见（障碍物保持OBS_VISIBLE_RADIUS=65隐藏）。

### v0.24.2 — 天际线渐隐，地形边缘顶点沉入雾中（2026-05-09）

**改进**：300×300地形边缘（空气墙100m外→边缘150m）顶点高度ease-out渐降至-8m，融入雾色#8899aa，消除01a/01b天际线硬边界。versus平坦地图同样受益。

### v0.24.1 — 去掉外圈下沉，纹理覆盖300×300（2026-05-09）

**修复**：去掉01a外圈-25m异常下沉，地形成自然平面；纹理系统(splatMap/复合纹理)覆盖全300×300地面，01a/01b空气墙外远景可见自然草地。

### v0.24.0 — 地形扩展300×300，删除裙边（2026-05-09）

**改进**：01a/01b 地图扩展到300×300（空气墙外50m缓冲区）；删除所有裙边；02a保持200×200仅删裙边；扩展地图障碍物600个(spawnRadius=148)。

### v0.23.2 — 「裙边」正方形环带向下倾斜（2026-05-09）

**修复**：RingGeometry圆形→ShapeGeometry正方形挖孔环带，完全贴合地图边界；外边缘向下倾斜20m融入雾中，消除四角漏空。

### v0.23.1 — 环形裙边修复（2026-05-09）

**修复**：groundSkirtPlane 从 400×400 实心平面→RingGeometry 环形（内半径102/外半径200），不再遮住河流/池塘/盆地凹陷地形。

### v0.23.0 — 「换天」Preetham大气散射天空（2026-05-09）

**改进**：

- 废弃全景纹理天空球，替换为 Three.js Sky 组件（Preetham 物理大气散射模型）
- 瑞利散射 + 米氏散射模拟真实天空色彩、太阳光盘、天顶到地平线自然渐变
- 新增 Sky.js（~170行），适配全局 THREE 命名空间，与 GLTFLoader.js 加载方式一致
- 移除 sky-panorama.png 纹理加载（~1.6MB），消除网络请求，零纹理依赖
- 移除 createDistantMountains() 旧远山锥体代码（已废弃）
- 场景背景色从纯色→null，由天空球自然填充
- 雾色调整为 #8899aa 中性蓝灰，匹配新天空色调

### v0.22.2 — 全景山脉天空球 + 裙边地面（2026-05-08）

**改进**：

- 远山从36个低多边形锥体→Equirectangular全景纹理天空球（sky-panorama.png，Shader采样）
- 新增400×400裙边地面（纯色 #5a6a4a），填充地图边缘到雾远平面空隙，避免"世界尽头"暴露
- 天空球半径从400m→280m（适配摄像机 far=300m）
- 全景纹理采用自定义 ShaderMaterial 采样，不受场景雾效影响

### v0.22.1 — 炮弹外形重构：圆柱身+锥形弹头（2026-05-08）

**改进**：

- 炮弹从直圆柱→圆柱弹体(0.18m长) + 锥形弹头(0.08m)，Group 组合，更贴近真实炮弹外形
- 统一使用 disposeShellMesh() 清理，兼容 Group 遍历销毁子网格

### v0.22.0 — 天空穹顶+远山环带，告别黑雾（2026-05-08）

**新增**：

- 天空穹顶：400m半径渐变天空球（ShaderMaterial），顶部深蓝(#1a3a5c)→地平线浅蓝白(#8cb4d8)
- 远山环带：36座低多边形山峰环(155m半径)，朦胧远山自然过渡到雾中
- 雾色融合：Fog #000000→#5a7a9a（天空蓝灰），与天空穹顶色调统一
- 场景背景从纯黑改为天空底色 #7a9ab4
- 摄像机 far 200→300m，确保天空球始终可见
- 性能开销极低：天空球 960△ + 远山 360△ = 约 1320 三角形

### v0.21.10 — 雾距平衡调整（2026-05-08）

**修复**：

- Fog 平衡：near 80m / far 120m（原 near 120/far 200 性能开销大，回退到合理范围）
- 障碍物可见半径 65m，草丛可见半径 70m

### v0.21.9 — 黑雾消退，视野扩大（2026-05-08）

**修复**：

- Fog 距离大幅扩大：near 50→120m, far 80→200m
- 障碍物可见半径 48→80m，草丛可见半径 55→85m
- 出生点即可远眺桥梁和远处建筑，不再被黑雾笼罩

### v0.21.8 — 河床覆盖泥地纹理（2026-05-08）

**修复**：

- 01a/02a 地图河床纹理：河水下方区域统一覆盖泥地（generateSplatMap 中 dist<=rhw 也设 mud）
- 不再透过河水看到草地斑块

### v0.21.7 — 炮弹碰撞修复+桥梁入口修复+场景架构简化（2026-05-08）

**修复**：

- 炮弹垂直碰撞检测移除 obsBottom 检查：高地建筑不再因 terrainY 偏移而"无敌"
- 桥梁入口空气墙修复：河岸碰撞体不再阻挡桥头引道（isOnBridge(x) 范围豁免）
- 场景架构简化：移除无用的 scene2 预建，统一使用 scene1 + rebuildMap 动态切换
- 双人模式地形残留修复：进入对战模式后正确重建为平坦大平原

### v0.21.6 — targetScene 参数修复（2026-05-08）

**修复**：

- `createGround()` 和 `createObstacles()` 误删 `targetScene` 参数导致黑屏
- 新增 `POINT_A_X=0, POINT_A_Z=0` 常量（单人模式出生点）
- 所有 `scene.add` 在这两个函数内统一改为 `targetScene.add`

### v0.21.5 — targetScene 引用修复（2026-05-08）

**修复**：

- `targetScene is not defined` 错误，两处 `targetScene` 引用统一改为 `scene`

### v0.21.4 — 摄像机优化+曳光弹（2026-05-08）

**升级**：

- 拉近摄像机距离（单人 BEHIND 10→7，上方 7→5；双人 BEHIND 15→12，上方 9→7）
- 缩小 FOV（单人 55→50；双人 65→55）
- 障碍物 LOD 调整：`OBS_RADIUS=55`，obbB 缩小至 0.4
- 炮弹增加曳光弹发光效果（黄色 AdditiveBlending 发光球体，跟随弹道）

### v0.21.3 — FBM 噪声地形斑块+草丛密度提升（2026-05-08）

**升级**：

- FBM 分形噪声生成自然地形斑块：草地~~50% + 泥地~~28% + 沙地~22%
- 02a 草丛密度大幅提升：spacing 2.8→1.8, density 0.65→0.80
- 地形斑块与特殊地貌（河岸、池塘边、山顶）无缝衔接

### v0.21.2 — FPS 显示+草丛显示修复（2026-05-07）

**修复**：

- FPS 始终为 0 的问题（时钟未正确启动）
- 草丛模型不显示的问题

### v0.21.1 — 草丛模型预览+坦克 favicon（2026-05-07）

**升级**：

- 模型预览菜单添加草丛选项
- 新增坦克 favicon 图标

### v0.21.0 — 弯曲草叶草丛+次级模型预览+性能评估（2026-05-07）

**新增**：

- 程序化弯曲草叶模型（低/中/高三类，BoxGeometry）
- 分类次级模型预览菜单
- InstancedMesh 优化 + FPS 对比显示

### v0.20.1 — RIVER_DEPTH 未定义修复（2026-05-08）

**修复**：

- `RIVER_DEPTH is not defined` 导致黑屏
- 精简 changelog 只保留当前版本

### v0.20.0 — 地貌纹理系统+地图选择（2026-05-08）

**新增**：

- 地貌纹理系统（方案B+C融合）：Splat Map（256×256 Uint8编码6种地形类型）+ Canvas程序化纹理混合生成2048×2048复合地表纹理
- 6种程序化地形纹理：草地/泥地/沙地/水泥地/柏油路面/地砖地面，使用FBM分形噪声程序化生成，无外部纹理依赖
- 独立地图系统：地图配置存放为 `.map.json` 文件（`maps/test_map_01a.map.json`、`maps/test_map_01b.map.json`）
- 单人模式地图选择面板：点击"单人模式"后显示地图列表，选择地图后再进入游戏
- 地图配置结构：size/spawnPoints/terrain/terrainTypes/waters/bridges/obstacles 字段
- 地形参数统一通过 `currentMapData` 访问（`_t()`/`_getPond()`/`_getRiver()` 等），支持运行时切换地图

### v0.19.3 — 双人对战地图分离+黑屏修复（2026-05-07）

**升级**：

- 双人对战地图改为大平原：平坦地面无地形起伏，无水面/池塘/河流/桥梁，只保留随机障碍物
- 单人模式保留完整地形系统（池塘+河流+高地盆地），两种模式共用地形系统和除地图外的配置
- 新增 `isVersusMap` 全局标志：控制地形生成/水面/障碍物物理/空气墙等模块的条件分支
- 新增 `rebuildMap()` 函数：模式切换时自动清理旧地面/水面/障碍物并重建场景
- 修改 `getTerrainHeight()`/`getGroundHeight()`：对战中返回 0（平原地形）
- 修改 `createGround()`：对战模式使用无分段 PlaneGeometry，单人模式保持高度图地形
- 修改 `initScene()`：水面/河流水面/桥梁仅单人模式创建
- 修改 `createObstacles()`：对战模式跳过池塘/河流区域排除逻辑
- 修改 `updatePlayerPhysics()`：池塘/河流/桥梁空气墙仅单人模式生效

**修复**：

- 双人对战黑屏 bug：`const by` 在 `if(p.reloadBarGroup)` 块内声明，但在 `if(p.hpBarGroup)` 块中引用导致 `ReferenceError`，中断 `requestAnimationFrame` 循环。修复：将 `by` 声明提升到外层作用域

### v0.19.2 — 河流系统：蛇形河流+桥梁+流动水面（2026-05-07）

**新增**：

- 蛇形河流横贯场景(Z≈-60)：振幅8m周期30m，宽10~15m正弦变化，深5m
- 半透明流动水面距地平线1m，正弦波顶点动画模拟流水
- 8m宽桥梁(X=0)：木板桥面+双侧栏杆+石质桥墩
- 桥梁区域地型不下陷，坦克可通过桥梁安全过河
- 河流空气墙阻止坦克涉水；障碍物排除河流区域(桥梁除外)

### v0.19.1 — 地形系统：鸡蛋形池塘+高地盆地（2026-05-07）

**新增**：

- 200×200分段地形(1m精度)
- 鸡蛋形池塘(中心0,50 半轴4.5×6m 深5m)，半透明水面可见池底
- 池塘空气墙阻止坦克驶入
- 高地+盆地(40,-30)：高斯山丘高4m半径8m + 偏置盆地下陷3m半径5m
- 坦克/摄像机/炮弹/碎块/障碍物/伤害特效全部适配地形高度
- 地形坡度俯仰叠加加速度俯仰；修复旋转顺序为YXZ确保坡度俯仰正确

### v0.18.0~~v0.18.36 — T-34/85 模型精细化 + 渲染修复（2026-05-06~~07）

T-34/85 v6 真实照片对标重构 → 技术图纸修正 → 炮塔/履带/尾部/甲板/格栅迭代优化 → 障碍物同步缩放 → 公寓精细化 → Viewport高DPI修复 → 清理诊断代码。共36个子版本。

### v0.16.1 ~ v0.13.0

（略，见早期版本详情）

---

## 坦克模型系统

坦克使用 **GLB 模型**（`models/glb/`）作为主力方案，通过 `GLTFLoader` 异步加载：

| GLB 文件                     | 颜色 | 用途               |
| ---------------------------- | :--: | ------------------ |
| `t34-85_textured.glb`        | 绿色 | 单人模式 + 双人 1P |
| `t34-85_textured_yellow.glb` | 黄色 | 双人 2P            |

- **双缓存机制**：绿色/黄色各自独立缓存，首次加载后克隆复用
- **程序化回退**：`t34-85.js` / `tank.js` 仅在 GLB 加载失败时启用（兜底方案）
- **自动缩放到碰撞体系**：GLB 模型加载后按车长 1.70 单位统一缩放

---

## 项目移交清单

### 文件交付

| 文件                      |     行数     | 说明                                           |
| ------------------------- | :----------: | ---------------------------------------------- |
| `index.html`              |    ~6950     | HTML+CSS+JS 游戏引擎主体                       |
| `three.min.js`            |      —       | Three.js 库（本地加载，无需 CDN）              |
| `GLTFLoader.js`           |      —       | GLTF 模型加载器（加载 .glb 文件）              |
| `fireSmokeParticles.js`   |     ~390     | 火焰/烟雾/爆炸粒子系统                         |
| `models/modelRegistry.js` |     ~66      | 模型注册表                                     |
| `models/tank.js`          |     ~85      | 简化坦克模型（GLB 加载失败时的回退方案）       |
| `models/t34-85.js`        |     ~640     | T-34/85 程序化模型（GLB 加载失败时的回退方案） |
| `models/trees.js`         |     ~60      | 2 种树木模型                                   |
| `models/buildings.js`     |     ~220     | 3 种建筑模型（平房/别墅/公寓精细化）           |
| `models/windmill.js`      |     ~59      | 风车磨坊模型                                   |
| `README.md`               |      —       | 本文件                                         |
| **总计**                  | **~7400 行** | **纯 JavaScript + HTML + CSS**                 |

> 全部文件离线可用，无须网络和包管理器。需本地 HTTP 服务器加载 .glb 模型。

### 运行方式

1. 复制整个 `坦克对战demo/` 文件夹到目标电脑
2. 在项目目录下启动本地服务器：`python -m http.server 8080 --bind 127.0.0.1`
3. 浏览器访问 `http://127.0.0.1:8080`
4. 修改代码后刷新浏览器（`Ctrl+F5` 强制刷新清除缓存）
5. 所有现代浏览器均可运行（Chrome / Edge / Firefox）

### 当前功能状态

| 模块           |   状态    | 说明                                              |
| -------------- | :-------: | ------------------------------------------------- |
| 单人模式       |  ✅ 完成  | WASD + 空格 + 鼠标视角                            |
| 双人对战       |  ✅ 完成  | 1P键盘 + 2P手柄，分屏渲染，独立大平原地图         |
| 模型预览       |  ✅ 完成  | 拖拽/缩放/切换模型，含草丛预览                    |
| GLB 坦克模型   |  ✅ 完成  | 双纹理（1P绿+2P黄），GLTFLoader 异步加载+缓存克隆 |
| 程序化坦克回退 |  ✅ 兜底  | t34-85.js / tank.js 在 GLB 失败时自动启用         |
| 地貌纹理系统   |  ✅ 完成  | SplatMap + 6种 FBM 程序化地形纹理                 |
| 程序化草丛系统 |  ✅ 完成  | 弯曲草叶 + InstancedMesh + 空间分块 + 距离剔除    |
| 平房建筑       | ✅ 精细化 | 山墙屋顶+窗框+门+烟囱                             |
| 别墅建筑       | ✅ 精细化 | 二层退台+石墙木墙+阳台+四面窗                     |
| 公寓建筑       | ✅ 精细化 | 底商石材+白色瓷砖住宅+退台天台                    |
| 风车磨坊       | ✅ 三修复 | 十字叶片+连接轴+侧面旋转                          |
| 曳光弹特效     |  ✅ 完成  | 黄色 AdditiveBlending 发光球体，跟随弹道          |
| 粒子系统       |    ✅     | 火焰/烟雾/爆炸/碎片/炮口焰/火花                   |
| 音频系统       |    ✅     | Web Audio API 原生生成                            |
| 殉爆系统       |    ✅     | 坦克爆炸引爆附近障碍物                            |
| 障碍物随机朝向 |    ✅     | 各方向随机旋转                                    |
| 游戏模式切换   | ✅ 已修复 | 进出模式坦克/特效正确清理                         |
| 预览模式切换   | ✅ 已修复 | canvas 清理防止叠加                               |
| FPS 性能显示   |  ✅ 修复  | FPS 实时显示（草丛优化后显著提升）                |
| 摄像机优化     |  ✅ 完成  | 拉近距离 + 缩小 FOV（v0.21.4）                    |

### Git 仓库信息

- **Gitee**（主仓库）：`https://gitee.com/hpmax9696/tank_demo.git`
- **GitHub**（备用）：`git@github.com:hpmax9696/tank_demo.git`（SSH 密钥已验证域名）
- **远端配置**：`origin` → Gitee，`github` → GitHub
- **提交格式**：`git commit -m "vX.Y.Z: 描述"`

### 更新 SOP（每次修改后执行）

```bash
git add -A
git commit -m "vX.Y.Z: 描述"
git push origin master              # Gitee
git push github master              # GitHub（失败跳过）

# 同步 OneDrive 备份
Copy-Item -Path "index.html","README.md","three.min.js","GLTFLoader.js","fireSmokeParticles.js" -Destination "C:\Users\hpmax\OneDrive\共享软件\坦克对战demo\" -Force
Copy-Item -Path "maps\*" -Destination "C:\Users\hpmax\OneDrive\共享软件\坦克对战demo\maps\" -Recurse -Force
Copy-Item -Path "models\*" -Destination "C:\Users\hpmax\OneDrive\共享软件\坦克对战demo\models\" -Recurse -Force
```

### ⚠️ 版本号同步检查清单（每次更新必须执行）

1. `index.html` `<title>` 标签中的版本号
2. `index.html` `.menu-version` 菜单版本显示
3. `index.html` `.changelog` 追加当前版本更新记录
4. `index.html` 调试信息中的版本号（`'vX.Y.Z  dpr:' + ...`）
5. `index.html` `console.log('🎮 坦克运动demo vX.Y.Z | ...')`
6. `README.md` 开头版本号
7. `README.md` 版本历史中追加当前版本
8. `README.md` 代码规模 / console.log示例中的版本号

### 调试建议

1. 打开开发者工具（F12）查看 Console 日志
2. 当前版本 console.log：`⚡ 坦克运动demo v0.43.0 | 灵活地图尺寸+矩形地图+编辑器摄像控件修复`
3. 页面右上角有调试信息（版本号/FPS/里程/坦克坐标/可见障碍物数量）
4. 修改代码后 `Ctrl+F5` 强制刷新，或关闭标签页重新访问 localhost 确保不使用缓存

### 代码规模（截至 v0.79.37）

| 分类             | 文件                                                                                                                                                                                              |      行数      |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------: |
| 核心框架         | `index.html` + `js/engine.js`                                                                                                                                                                     |  1175 + 8255   |
| 游戏模块 (14个)  | waters(370) bridges(165) debugcolliders(122) obstacles(3193) shells(396) audio(322) fireSmoke(572) mg(262) bars(147) input(74) spatialGrid(110) sky(271) sportsFields(573) campus_spawner(251) |      6828      |
| 人形系统 (2个)   | humanoid_config(10510) humanoid_factory(258)                                                                                                                                                      |     10768      |
| 六足系统 (6个)   | core(1188) factory(884) enemy(328) probe(208) aimLine(295) config(70)                                                                                                                             |      2973      |
| 玩家控制器 (2个) | manager(122) hexapodPlayer(1408)                                                                                                                                                                  |      1530      |
| 地图编辑器 (7个) | map_editor.html(1790) terrainGen(914) genStatus(181) entities(653) waterBridge(659) data(504) terrainPaint(335)                                                                                   |      5036      |
| 模型工厂         | `model_factory.html`                                                                                                                                                                              |      5636      |
| 模型系统 (14个)  | enemies(1894) t34_v16(1441) tiger_v16(904) t34-85(628) buildings(364) trees(262) grass(207) pickups(133) registry(88) tank(84) windmill(57) textures(52) model_configs(700) hexapod_config(70)    |      6893      |
| 战斗系统 (2个)   | enemyAI(1280) scoreSystem(127)                                                                                                                                                                    |      1407      |
| 地图加载         | `maploader.js`                                                                                                                                                                                    |      191       |
| **总计**         | **51 个源文件**                                                                                                                                                                                   | **~50,400 行** |

---

## 当前版本关键参数（v0.39.1）

| 参数            | 值                                                             | 说明                                   |
| --------------- | -------------------------------------------------------------- | -------------------------------------- |
| 世界大小        | 200×200 单位                                                   | 双人对战为平坦平原，单人模式为分段地形 |
| 障碍物数量      | 350                                                            | 泊松盘采样，最小间距 6 单位            |
| 出生安全区      | 半径 10 单位                                                   | 中心无障碍物                           |
| 障碍物可见半径  | 55 单位                                                        | 超出则隐藏（性能优化）                 |
| 单人摄像机      | 后方14.625 / 上方10                                            | FOV 48°，far=300m                      |
| 双人摄像机      | 后方14.4 / 上方9.5                                             | FOV 48°，far=300m                      |
| 坦克最高速度    | 4.0 单位/秒                                                    | MAX_SPEED                              |
| 炮弹初速        | 33.0 单位/秒                                                   | SHELL_SPEED                            |
| 炮弹重力        | 1.0 单位/秒²                                                   | SHELL_GRAVITY                          |
| 炮弹最大射程    | 300 单位                                                       | SHELL_MAX_DIST                         |
| 准星有效射程    | 150 单位                                                       | 超过变红                               |
| 准星判定        | 四阶段（障碍物射线→抛物线地形→shellR容差→目标跳回）            | —                                      |
| 炮弹壳半径      | 0.18m                                                          | shellR，用于体积容差碰撞               |
| 地形碰撞采样    | 12 点抛物线采样，飞行中段跳过终点                              | —                                      |
| 弹道预测线      | 全模式启用 + 抛物线 + 地形截断 + 障碍物 shellR + 敌人/丧尸截断 | —                                      |
| 装填时间        | 2.0 秒                                                         | RELOAD_TIME                            |
| 炮塔旋转速度    | ~30°/s                                                         | turretAngVel                           |
| 炮管俯仰速度    | ~20°/s                                                         | barrelAngVel                           |
| 炮管俯仰范围    | -10° ~ +25°                                                    | maxDown/maxUp                          |
| 草地可见半径    | 55 单位                                                        | 空间分块优化                           |
| 雾色/雾距       | #8899aa 蓝灰 / 70-110m                                         | Fog                                    |
| 炮弹外形        | 圆柱体+锥形弹头                                                | Group 组合，0.18m弹体+0.08m锥头        |
| 炮弹初速        | 33.0 单位/秒                                                   | 曳光弹效果                             |
| 装甲突击车HP    | 60                                                             | 敌人生命值                             |
| 喷火伤害        | 8/跳×3跳                                                       | 突击车火焰伤害                         |
| 玩家命数        | 3 (combat)                                                     | PvE战斗模式复活次数                    |
| 程序化丧尸      | ZOMBIE_CONFIG 24节点 + 458 tris                                | zombie_prototype.html 独立原型         |
| AnimationSystem | 6 动作 (Idle/Hit/Attack/Walk/Run/Die)                          | 手动插值动画，不依赖 Mixer             |

### v0.59.2 参数变更

| 参数               | 旧值      | 新值      | 说明           |
| ------------------ | --------- | --------- | -------------- |
| 炮弹初速           | 33.0 m/s  | 50.0 m/s  | shells.js      |
| 训练场敌方坦克速度 | 3.5       | 6.0       | engine.js      |
| 敌方炮塔转速       | 1.5 rad/s | 1.0 rad/s | enemyAI.js     |
| TRACK_ACCEL        | 10.0      | 40.0      | 更灵敏的加速   |
| TRACK_DECEL        | 16.0      | 40.0      | 更快的制动     |
| TRACK_COAST        | 20.0      | 40.0      | 更快的滑行减速 |
| 阴影贴图           | 1024      | 512       | 性能优化       |
| 碰撞迭代           | 3         | 1         | 性能优化       |

---

## 版权

坦克 3D 模型和游戏逻辑为原创。
Three.js MIT 许可证。
音频 Web Audio API 程序化生成，无版权问题。
