# CLAUDE.md

3D 坦克对战游戏 — Three.js r160 浏览器游戏 + 地图编辑器 + PvE 战斗 | v0.79.37

## 运行

```bash
python server.py
```

访问 `http://127.0.0.1:8080`（必须 127.0.0.1，禁止 localhost）

`server.py` 提供静态文件服务 + `/api/solidify` 固化端点（模型工厂 Ctrl+S 直接写源文件）。

提供 `preview_url` 前：先杀残留 Python 进程，再启动单一服务，确认就绪后才调用。

## 文件结构

```
├── index.html         # 核心游戏框架 (~1068行)：UI框架+菜单+脚本加载
├── js/engine.js        # 游戏引擎 (~8133行)：状态机/场景/物理/瞄准/摄像机/AI/训练场/狙击
├── js/                # 游戏模块（12个）
│   ├── waters.js      # 水体模块 (~326行)：池塘水面+河流alphaMap遮罩平面+碰撞体+动画
│   ├── bridges.js     # 桥梁模块 (~165行)：编辑器桥+参数化桥+碰撞检测+可视化
│   ├── debugcolliders.js  # 碰撞可视化 (~122行)：F3切换(默认关)，从运行时数据反向生成
│   ├── obstacles.js   # 环境对象 (~3188行)：树木/建筑/InstancedMesh管理
│   ├── shells.js      # 炮弹系统 (~363行)：炮弹+碎片对象池(P-burst-2)
│   ├── audio.js       # 音频系统 (~322行)：锁定音+卡壳音+爆炸音
│   ├── fireSmokeParticles.js  # 粒子系统 (~572行)
│   ├── mg.js          # 机枪系统 (~209行)
│   ├── bars.js        # UI 血条/装填条 (~85行)
│   ├── input.js       # 输入处理 (~74行)：WASD+手柄5段力度
│   ├── spatialGrid.js # 空间网格 (~110行)
│   ├── sportsFields.js # 球场模块 (~400行)：标线纹理+UV重映射+球门/篮球架+可碎登记
│   ├── sky.js         # 动态天空系统 (~271行)：渐变穹顶+噪声云层+太阳光晕
│   ├── profiled_extrude.js # ProfiledExtrude 几何类型 (~116行)：XY轮廓+roofProfile拉伸
│   └── tank_specs.js  # 坦克规格参数 (~96行)：历史数据查询
├── js/hexapod_aimLine.js     # 六足加特林瞄准线 (~295行)：双段着色+5层碰撞+颜色状态机
├── models/hexapod_config.js  # 六足战车共享模型配置 (~70行)：ANIM_TABLE(23项)+腿配置
├── js/hexapod_core.js        # 六足CCD IK核心模块 (~1188行)：纯计算层，模型工厂+游戏共享，hipAxis/bodyWriter参数化
├── js/hexapod_factory.js     # 六足工厂适配器 (~884行)：nodeMap→legRefs+IK测试+转弯验证+武器校准
├── js/hexapod_enemy.js       # 六足游戏适配器 (~328行)：getObjectByName→legRefs; 卡住检测; bodySpeed用desiredVel
├── js/hexapod_probe.js       # 六足步态测量探针 (~208行)：stepGait采样; F7/F8快捷键; Stats/Compare; localStorage
├── js/playerControllers/     # 模块化玩家角色控制器 (可插拔)
│   ├── manager.js            # PlayerControllerManager (~122行)：注册表+当前角色+update分发+能力探测
│   └── hexapodPlayer.js      # 六足玩家控制器 (~1408行)：WASD+鼠标+加特林+导弹+锁定+AI托管+装填
├── map_editor.html    # 地图编辑器 (~1790行)
├── js/editor_*.js     # 编辑器模块（6个）
│   ├── editor_terrainGen.js  # 地形+村落生成 (~914行)：双管线(地形/村落)+掩码网格+FloodFill+A*+容量预验证
│   ├── editor_genStatus.js   # 生成状态面板 (~181行)：实时进度+统计+质量评分+自动隐藏
│   ├── editor_entities.js    # 实体管理 (~653行)：标记+CRUD+配置面板+列表+建筑朝向(yaw)
│   ├── editor_waterBridge.js # 水体桥梁 (~659行)：水面+河床+桥梁检测
│   ├── editor_data.js        # 数据持久化 (~504行)：蓝图+JSON+init
│   └── editor_terrainPaint.js # 地形绘制 (~335行)：笔刷+高度图画布
├── model_factory.html # 程序化模型编辑器 (~5000行)
├── models/            # 模型文件 (GLB主力 + 程序化兜底)
│   ├── enemies.js     # 敌方单位模型 (~1965行)：装甲突击车+程序化丧尸
│   ├── t34_v16_builder.js # T-34/85 v1.6 坦克构建器 (~1441行)：\_TANK_PROFILE 共享动画框架
│   ├── tiger_v16_builder.js # 虎式 I 坦克构建器 (~904行)：MG34+马蹄形炮塔+沙漠迷彩
│   └── buildings.js   # 建筑模型 (~385行)：3种建筑+category分类+阴影
├── server.py          # 开发服务器 (~324行)：静态文件 + POST /api/solidify 固化端点
├── maps/              # .map.json 地图配置
├── combat/            # AI状态机 + 积分系统
│   ├── enemyAI.js     # AI状态机 (~1280行)：巡逻→追击→绕圈+六足ENGAGE+武器优先级
│   └── scoreSystem.js # 积分系统 (~127行)
├── docs/              # 协作文档（perf_optimization_plan / ai-search-design / obstacle_conventions）
└── CODEBUDDY.md       # 详细架构/参数/已知问题/待办 → 查阅细节时读它
```

## 摄像机系统 (v0.59.0)

- **Pointer Lock**: 进入游戏自动请求 `gameContainer.requestPointerLock()`，鼠标锁定到屏幕中心
- **X轴驱动视角**: `e.movementX * 0.004` 累加到 `cameraYaw`，`placeCamera()` 用 `cameraYaw` 定位摄像机
- **Y轴虚拟准星**: `e.movementY` 累加到 `_virtualMouseY`，射线投射用 `(centerX, virtualY)` 做瞄准
- **独立于车身/炮塔**: `cameraYaw` 完全解耦，车身转向不再带动画面
- **点击重锁**: `gameContainer.click` → 重新请求 pointer lock
- **ESC退出**: `returnToMenu()` 开头 `document.exitPointerLock()`

## 炮塔稳定器 (v0.59.0)

- `updateAiming()` / `updateAimingForVs()` 开头：`turretYaw += hullDyaw`（车体转多少，炮塔反向补偿多少）
- `tankGroup.rotation.y = π/2 - state.yaw`，世界炮塔 = `tankGroup.rotation.y + turretYaw`
- 车体 yaw 增加 → tankGroup Y 减小 → turretYaw 需增加等量补偿
- 补偿不计入 `turretAngVel` 限速，瞬间完成

## 手柄视角+炮塔 (v0.59.2)

- **右摇杆X叠加模型**: `turretYaw += hullDyaw(稳定器) + stickToTarget(-gpx)*rate*dt(右摇杆)` — 两者叠加不互搏
  - 例: 左摇杆右转30°/s, 右摇杆右推50°/s → 炮塔相对车体右转20°/s, 世界右转50°/s
- **视角同步**: 右摇杆激活时 `cameraYaw = atan2(barrelDir.z, barrelDir.x)` 每帧跟踪炮管世界朝向, 瞄准线始终居中
- **右摇杆方向**: `stickToTarget(gpx)` 驱动cameraYaw (右推→视角右转). 炮塔turretYaw使用`stickToTarget(-gpx)`取反 (Three.js右手定则)
- **稳定器互搏已解决**: 初版尝试过世界空间转换/反馈纠偏等方案, 最终回归简单叠加模型

## 敌方坦克平衡 (v0.59.2)

- **炮塔转速**: `aimTurretAt()` 的 turnSpeed 从 3.0/4.0 rad/s (172~229°/s) 降为 1.5 rad/s (86°/s), 默认值 3.0→1.0
- **炮弹散布**: `fireEnemyTrainingShell` 散布从 spread=0.035(≈2°) 扩大为 0.07(≈4°)

## 六足死亡武器清理 (v0.59.2)

- **死亡护栏**: 六足武器代码入口(`engine.js:3268`)增加 `if (enemy.dead || hai.state==='dead') continue`
- **复活枢轴清理**: `HexapodEnemy.init()` 开头: ①调用`_deathEnd(oldCtx)`清理旧context的武器垂下枢轴 ②利用`_weaponParents`递归清除所有残留`_death_wp_*`节点
- **createHexapod保存父引用**: `root.userData._weaponParents` 记录武器原始parent+localTransform

## 核心全局变量

`scene`, `players[]`, `bullets[]`, `explosions[]`, `obstacles[]`, `currentMapData`, `cameraYaw`

## 尺度标定 (v0.65.5)

- **`METERS_PER_UNIT = 1.3` 米/单位**（`engine.js:248`）。标定：真实 T-34/85 高 2.6m ÷ 坦克模型渲染高 1.99 单位 = 1.306，取干净值 1.3（旧值 4.706 偏大 3.6 倍，导致"3m 树像草"）。
- **障碍物渲染高度公式**：`targetHeightM / METERS_PER_UNIT`（与 ud.height/baseHeight 无关，scale 抵消）。仅 `obstacles.js` 4 处使用此系数。
- **各障碍物 targetHeightMinM/MaxM（米）**：conical 2~~4.2 | spherical 2~~3.9 | oak 2.5~~5 | bungalow 2.5~~3.3 | villa 3~~5.5 | apartment 4.2~~9.7 | windmill 2.8~~5.5（草丛 0.2~~1.0m 直接米制不经系数）。
- **裸单位参数数值不变**：worldHalfW=150、AI 距离、fog、阴影、坦克速度等保持原值，米含义基于 1 单位=1.3m（比旧系数合理：viewDist 470m→131m、MAX_SPEED 164km/h→37km/h）。
- **地图编辑器 UI 显示米**（×1.3）：info-size/overlayInfo/尺寸滑块均显示米，内部仍存单位。
- 详见 `docs/obstacle_conventions.md`。

## 生成管线（v0.51.0 新增）

三个按钮驱动两条独立管线：

| 按钮              | 函数                         | 说明                                                                       |
| ----------------- | ---------------------------- | -------------------------------------------------------------------------- |
| 🎲 一键全部       | `generateAll()`              | 管线A→管线B，完整地图                                                      |
| 🌍 仅生成地形     | `generateTerrainOnly()`      | 管线A：FBM→自动平整→生态区→池塘。结束后可手画河流                          |
| 🏘️ 生成道路与村落 | `generateRoadsAndVillages()` | 管线B：读当前terrain+water→掩码→主干道→FloodFill→选址预验证→落地→树木→桥梁 |

### 管线A（仅地形）

FBM高程 → 自动平整（保峰压谷） → 生态区分区 → 池塘

### 管线B（道路+村落+障碍物）

构建掩码（MG_BUILDABLE/FORBIDDEN/WATER/ROAD）→ A\*主干道 → Flood Fill区域分割 → 村落选址+容量预验证 → 落地（广场整平+村路+建筑+连接路）→ 分层采样树木 → 桥梁检测 → roadSystem存储

### 新增数据结构

- `MaskGrid` (Uint8Array位掩码)：`MG_BUILDABLE|MG_FORBIDDEN|MG_WATER|MG_ROAD|MG_PLAZA|MG_BUILDING|MG_BUFFER`
- `BuildableRegion`：FloodFill连通区（面积/质心/平坦度/包围半径）
- `VillagePlan`：预验证选址（广场+支路+建筑槽位+容量）
- `GenerationReport`：诊断报告（统计+失败原因+质量评分+种子+耗时）

### 关键函数

- `_autoFlatten(cfg)`: 保峰压谷 — 保留N个山峰，谷削至 keepRatio%
- `buildMaskGrid(cfg)`: 从当前地形+水体构建全图禁建掩码
- `_findBuildableRegions()`: BFS连通域分析
- `_simulateBuildingSlots()`: 建筑簇模拟（2-4个角度簇，每簇独立撒点）
- `_growBranchRoad()`: 贪心支路生长（沿最低粗糙度梯度）
- `_clusterByAngle()`: 建筑按角度分群（生成连接路用）
- `createRng(seed)`: Mulberry32确定性随机

## 必须遵守的规则

1. **版本号同步 8 处**：`index.html`（title + menu-version + changelog + 调试信息 + console.log）+ `README.md`（开头版本号 + 版本历史 + 代码规模）
2. **Changelog 裁剪**：`.changelog` 只保留最近 5 条，多了删最旧的
3. **Commit 格式**：`git commit -m "vX.Y.Z: 描述"`
4. **Git 推送**：`git push origin master` (Gitee 主仓库)
5. **修改后 Ctrl+F5** 强制刷新验证
6. **自动验证**：修改代码后自动用 Chrome headless CDP 抓取控制台错误，无误后才通知用户；有错则自行修复再验证，直到通过
7. **模块优先**：新功能优先以独立 JS 模块加载，三个主文件（index/map_editor/model_factory）不宜再增大，主文件仅作框架和加载器
8. **文档同步**：更新 CLAUDE.md 时同步更新 CODEBUDDY.md（参数/架构/已知问题）和 `.trae/rules/project_rules.md`（规则/文件行数），三份文档保持一致
9. **标记工具→Demo 坐标对齐**：新建工具页(drag画矩形→保存到campus.map.json)时，必须使用与工具页逐字相同的 zoneCorners 旋转公式生成 footprint，球门位置用 `_localToWorld(b, lEnd, S/2)`（短边中点），**绝不**用 `_localToWorld(b, L/2, sEnd)`（长边中点=90°错位）。详见 [[tool-demo-coordinate-mapping]]
10. **修改 server.py 后必须重启服务器**：任何对 `server.py` 的修改（新增 solidify 类型/端点/逻辑等），提交后必须 `taskkill //F //IM python.exe && python server.py` 重启，否则用户保存工具页数据时会报 400 错误。这是第三次犯同样的错误（toiletZones/soccerFields/calibration），不可再犯。
11. **不逐轮发版（重要，用户 2026-08-16 规定）**：每完成一轮修改**不要**自动增加版本号、不要同步 8 处版本号、不要更新 changelog/版本历史/4 份 AI 文档的版本段——这些操作很费 token 和版本号资源。**只有用户明确说出"发版、移交、推送"等命令时才做**完整版本流程（版本号 8 处同步 + changelog 裁剪 + README 版本历史 + 4 文档版本段）。日常修改只需实现 + 验证（Playwright/CDP 0 错误），改动文件说明放在最终汇报里。

## 六足战车 IK 系统

### 腿结构（6条腿，每条 4 DOF）

```
legGroup (Y旋转=水平摆角)
  └── thighPivot (X旋转=髋抬腿) [L1≈0.7]
        ├── 大腿 mesh + 髋球 + 警示条
        └── shinPivot (X旋转=膝) [L2≈0.55]
              ├── 小腿 mesh + 膝球
              └── anklePivot (X旋转=踝)
                    ├── 踝球 (Sphere r=0.05, anklePivot原点)
                    └── 尖刺足 (Cone, 锥尖朝下≈0.28)
```

### 单腿 IK 测试（`toggleHexIKTest`）

- **按钮**：模型工厂 `#toggle-iktest`，仅六足战车可用
- **子菜单**：腿选择(左前/左中/左后) + 模式选择(Y轴下蹲/X轴左右/Z轴前后)
- **算法**：CCD (Cyclic Coordinate Descent)，40迭代 + 0.5阻尼，踝关节锁死
- **关节顺序**：thigh.X → shin.X → legGroup.Y（3关节，踝不参与）
- **接地**：尖刺足锥尖单点固定，无需脚掌校平

### 动画展台（`toggleAnimShowcase`）

- **23 动画**：21步态 + 踉跄 + 死亡。列表左侧垂直滚动，7分类分隔
- **步态参数**：stride/stepH 由 `_hexaStrides`/`_hexaStepHeights` 数组驱动 (21项)，direction+turnRate 正交组合
- **步态周期公式**：静态转弯 `gaitPeriod=1.05/|ω|`，移动转弯 0.72s，直行 0.38~0.7s；实装后换连续钳位 `clamp(1.05/|ω|, 0.5, 0.8)`
- **CCD迭代**：高速转 `20+|ω|×13`，低速转 `20+|ω|×8`，奔跑 30，其余 15
- **三角步态**：A组(左前+右中+左后)与B组(右前+左中+右后)交替支撑/摆动
- **循环无缝**：同动画loop不reset腿关节；切动画时自动复位

### 转弯验证（`toggleHexTurnTest`）

- **按钮**：模型工厂 `#toggle-turntest`，仅六足战车可用
- **策略**：隐藏武器+上车体，仅保留下车体+6腿，极慢旋转(0.3rad/s)
- **可视化**：🔵蓝球=bodyCenter, 🔴红球=plantPos, 🟢绿球=swingTarget
- **公式**：swingTo = bodyCenter + rotate(plantPos-bodyCenter, -turnRate×T_cycle)
- **CCD**：damp=0.8, ccdIters=20+|turnRate|×13, T_cycle=3.5s

### 受击踉跄（`triggerHexStagger`）

- **调用**：`triggerHexStagger(worldDir, force)` — AI/玩家命中时触发
- **四阶段**：冲击(0.12s)→踉跄(0.35s)→恢复(0.50s)→回归
- **机制**：身体沿受击方向位移+倾斜，2~3条反方向腿跺地支撑，CCD damp=0.7

### 死亡瘫倒（`triggerHexDeath`）

- **调用**：`triggerHexDeath()` — 血量归零时触发
- **四阶段**：昂首(0.22s)→极点(0.1s)→瘫软(0.7s)→触地(0.5s)
- **机制**：前腿撑地昂起→身体急坠至groundY+0.14→damp 0.85→0.03，6腿伸展外摊，6种各异瘫姿

### 武器俯仰校准（`toggleWeaponCalibrate`）

- **按钮**：模型工厂 `#toggle-weaponcal`，仅六足战车可用
- **状态**：瞄准线可视化OK，武器实体旋转有bug（层级重组导致飞移）
- **待修**：枢轴组创建逻辑

### CCD 系统

- **核心**：`_ccdLeg(leg, target, iters, damp)` — damp 默认 0.5，转弯用 0.8，死亡渐降至0.03
- **固定脚距**：`leg._initFootDist` 初始化时缓存，swingTo用定值防CCD误差漂移
- **落地Y**：`leg._groundY` 初始接地高度，防止代际漂移
- **髋Y限位(v0.56.0)**：`leg._yLimit` — 中腿±0.7rad(≈40°)，前后腿±0.45rad(≈25°)，防转弯时腿360°缠绕
- **加特林枪管簇动画(v0.56.1)**：`_hexaCollectRefs`中为每侧加特林创建`_barrelCluster`子Group，将4根枪管移入簇后`cluster.rotation.x`绕中央轴公转。模型工厂23动画均可见。`_updateGatlingSpin(dt)`在`_hexaUpdateFrame`末尾调用
- **六足贴地(v0.56.1)**：`createHexapod()`存储`_hexapodTemplateBaseY`到`userData._baseY`，游戏循环`position.y=groundHeight+_baseY`

### 六足敌人 AI 系统（v0.59.0 绕圈+武器策略）

六足 AI 使用独立于普通车辆的 `updateHexapodEngage` (enemyAI.js:645-800)。

- **绕圈移动**：切向+径向分解。`rightX/rightZ * tangentW * sd` 侧移绕圈，`fwdX/fwdZ * radialW` 径向距离修正。身体始终面朝玩家，绕圈靠侧移
- **武器优先级**：`resolveWeaponAction` — 加特林(近) > 导弹+后退(过热有弹) > 纯后退(过热无弹) > 导弹(中距离) > 无
- **CHASE导弹**：远距离追击时 `dist > 5 && dist < missileRange` 发射导弹
- **过热后退**：`weaponAction='missile_retreat'` 时 `radialW=-0.5` 后退+发射导弹拉开距离冷却
- **步频自适应** (`hexapod_core.js`)：游戏模式 `gaitPeriod = clamp(2*stride/bodySpeed, 0.22, 0.8)`，腿摆快而非跨大步
- **身体位移同步**：AI存 `_desiredVelX/Z`，`stepGait` 的 `desiredMove` 参数在步态内部移动身体，腿驱动而非追赶
- **碰撞检测**：玩家 vs 敌人（半径 0.6 推离），炮弹 vs 敌人（扫掠球-圆柱），敌我均互斥
- **已知问题**：复活后腿部偶有异常；武器俯仰旋转轴不正确

## 游戏模式

- `menu` | `single` | `versus` | `combat` | `training`
- WASD驾驶 + 鼠标瞄准 + 左键开炮 / ESC返回

### 训练场模式（v0.56.0 新增，v0.57.0 六足CCD IK）

主菜单"训练场"按钮 → 配置面板 → 选我方/敌方单位 + 敌方行为 → 地图01a，相距100单位。

| 配置项   | 可选值                                                      |
| -------- | ----------------------------------------------------------- | ------------------------ | --- |
| 我方     | 坦克、六足(灰色不可选)                                      |
| 敌方     | 坦克(T-34/85全参数对齐)、**六足(CCD IK动画)**、突击车、丧尸 |
| 敌方行为 | 主动攻击(出生即追击)、反击(受击才还手)、不反击(完全被动)    | 坦克速度6.0, 炮塔转速1.0 |     |

- **敌方T-34坦克**：HP/速度/炮弹/MG/过热参数全面对齐玩家，炮塔独立瞄准+炮管俯仰+弹道重力补偿
- **敌方六足(v0.57.0 CCD IK)**：`js/hexapod_enemy.js`多实例CCD IK+三角步态+踉跄+死亡。homeOffset相对定位防下陷，髋Z轴修正，动态步幅自适应速度。加特林+导弹独立武器系统，MG不触发踉跄
- **无限重生**：敌我死亡1s后在出生点重生，玩家被火焰/丧尸击杀也复活。ESC退出训练
- **敌方AI**：`engageDist:30`(六足)/`50`(坦克)，`gatlingRange:30`，CHASE阶段追击，ENGAGE阶段绕圈攻击
- 相关变量：`isTrainingMode`, `trainingPlayerSpawn`, `trainingEnemySpawn`, `trainingRespawnQueued`
- **已知问题(v0.59.2)**：敌人上坡后偶发不复活；复活后偶发不追击；坡地地形适配不完美(翘头/陷地)；对山丘目标弹道偏低；上坡悬浮

## 详细文档

查看 **CODEBUDDY.md** — 关键参数表、架构详解、已知问题、待完成任务、交接流程

查看 **docs/obstacle_conventions.md** — 新增建筑/树木种类的开发规范（IM 合并、材质全局化、透明 proxy 阴影、阴影策略决策树）

---

## v0.79.37 本次会话变更 (2026-08-18)

### 人类士兵模型类别（4 变体）+ 专属动画 + 左右镜像修正

- **新类别**: 模型工厂 🧍 人形敌人新增 4 变体（全部 v1-成年男烘焙，活人肤色 `skin_live` + 直立动画）——`校园保安`（大檐帽+荧光背心+警棍）/`步枪兵`（迷彩+头盔+战术背心+AK）/`霰弹枪兵`（泵动霰弹枪）/`火箭筒兵`（RPG-7）。服装 `__cloth__` 占位材质联动换装；Canvas 程序化林地迷彩两侧统一；武器挂 r_hand 由 O 轨道驱动姿态（警棍 0.51/AK 0.67/霰弹 0.77/RPG 0.98）
- **几何修**: 半球 `geo.center()` 补偿修帽子刺穿（盔顶-头顶余量 0.047）；弹匣向枪口弯（rotation.x 负）；握把向枪托弯（rotation.x 正）；霰弹枪部件 z 首尾相接修脱节
- **动画集 `deriveSoldierAnims`**（删 Punch）：保安=曲臂蓄力（屈肘-1.25 举棍过肩水平后引）→直臂横扫（躯干转体 ±1.0rad，扫弧 2.25rad/129°）+弓步；枪兵=双手 low ready（武器仰角公式 `y=-sin(臂总屈角+武器补偿)`，待机补偿 2.0 → 枪口指左前地面 28°）+ 攻击**步枪贴腮瞄准**（臂全水平-1.5 枪抬到腮高、头右倾 headZ+0.35 贴枪）/霰弹腰射 + 枪口焰 3 连发脉冲 + 躯干后坐抖动；火箭筒兵=斜背（管轴左下→右上，战斗部露**右肩**）+ 攻击卸筒上肩（背→肩六轨道）→ 双手握把（真实骨架网格搜索：右手→后把 0.142/左手→前把 0.013）→ 前后双向火焰 + 战斗部 z 0→4.5 射出
- **左右镜像修正（第一人称约定）**: 模型面朝 +Z 时 +X=左/-X=右（l_eye 在 +X 证实）；待机枪口左偏 `GUN_CARRY_AZI=+0.4`、贴腮头右倾 `GUN_CHEEK_AIM.headZ=+0.35`、RPG 斜背 `ry=-0.95` 战斗部露右肩、肩扛管位右肩 `x=-0.22`（旧值全部反）
- **特效**: 火焰节点初始 scale 0.001 隐藏 + 轨道脉冲点亮（emissive×3 过曝亮黄白枪口焰）；`humanoid_factory.js` 扩展关节 scale 复位改恢复收集时初始值（切动画火焰归隐）
- **验证**: verify_poses 16（世界系数值：枪口朝向/贴腮高度/双手握把距离/斜背方向）+ verify_soldier_anims 20 + 模型结构 22 + 游戏冒烟 0 错误；投影像素级铁证（机匣/头盔同排 15px）；Qwen 视觉复核（低分辨率下误判 4 次，改用像素判据）；probe_axis/sweep/larm/grip 实验脚本沉淀
- **改动文件**: `models/humanoid_config.js`（4 变体+14 addon+SOLDIER_ANIM_CFG+deriveSoldierAnims+GUN_CHEEK_AIM/RPG_FIRE_ARMS）+ `js/humanoid_factory.js` + `models/enemies.js` + `model_factory.html`（flash_orange/迷彩贴图/变体切换 bakeModel 路径）

## v0.79.36 本次会话变更 (2026-08-18)

### 校园丧尸实装 + 碾压修复 + 瞄准设置 + 地图切换碰撞清理

- **校园丧尸实装**: `campus_spawner._spawnEnemy` 补齐 `cfg.type='zombie'`、HP条、受击白膜、完整 AI 初始化；`createHumanoidAnimationSystem` 补 `Hit→Stagger` 别名；金福园地图清掉 4 只旧测试丧尸，改为纯 `spawnConfig` 刷怪
- **碾压系统修复**: 坦克-敌人碰撞推离前先判断 `tryCrushZombie`，允许在 1.8 范围判定；死亡丧尸 `ai.state==='dead'` 不再参与碰撞推离，坦克可压过尸体
- **瞄准控制设置**: 首页新增 `⚙️ 设置` 面板，`aimControlMode` 支持 `world`（默认）/`hull`；`updateAiming` / `updateAimingForVs` 按模式驱动世界角或局部角；localStorage 持久化
- **地图切换碰撞清理**: `clearCampusCollisionRefs()` 在 `rebuildMap` / `rebuildMapAsync` 清空 `_campusBuildings` / `_campusBuildingGroups`，修复离开金福园后 01a/04a 炮弹命中虚空
- **模型工厂与校园人形**: Torus 默认分段 8×12 修复眼镜/项链在工厂可见；眼镜缩为 0.022/0.006 加中梁并贴近头部；项链水平绕颈；Die root 高度按骨架从站立平滑下沉，不再跳高
- **渲染与 UI**: 树冠 InstancedMesh 关闭 `frustumCulled`；换弹 Q 防重复、`beginShellSwitchReload()` 立即同步装填条；旧版丧尸 Attack 动画映射修复，04a 丧尸可正常攻击
- **验证**: Playwright 覆盖金福园/01a/04a、碾压、攻击、血条、设置；0 控制台错误
- **改动**: index.html + engine.js + obstacles.js + campus_spawner.js + maps/campus.map.json + model_factory.html + enemies.js + humanoid_config.js + 文档(版本同步 v0.79.36)

## v0.79.35 本次会话变更 (2026-08-16)

### 丧尸步态交叉循环 + 教师裤管修正 + 男学生短裤白缝线

- **步态（用户报告"双脚同时屈膝后蹬"）**: 量化定位——旧 Walk 双腿后摆窗重叠 ~1/4 周期（l 正窗 0.17~0.65 ∩ r 正窗 0.11~0.40/0.67~0.80）且双膝全程屈着（≥0.15/0.42）→ 双蹬相。重设计**一迈一撑交叉循环**（deriveZombieAnims Walk/Run 腿×4 轨道 8 关键帧）：后蹬窗严格错开（左 0.20~0.56 / 右 0.77~0.24）；支撑腿膝伸直蹬地（触地 0.08→蹬 0.18）、摆动腿屈膝抬脚（Walk 峰 0.62 / Run 峰 0.85）；瘸拖特征保留（右幅值减半 + 膝恒僵 0.40~0.58）；左右前迈峰交错 0.45/0.50 半周期
- **裙约束保障**: 新步态幅值落在 v0.79.34 包络内（前踢 ≤0.45/0.28、左后蹬 0.30、右后蹬 0.15）——裙底逐帧余量 0.020/0.011 反更宽松
- **教师裤管（用户报告"上半截戳出来"）**: 根因 = v0.79.29 漏算渲染层 pivot 补偿（childComp=−pivot，addon 实际位置 = position − 父pivot）——注释算"裤底到膝 0.345"，实际髋系 0.518 = **膝下 0.172 超长**，屈膝穿透 0.12。修正：高 0.46→**0.32** + position −0.115→−0.042 → 真实膝（ll.pos−ulPivot+llPivot≠髋−大腿长，浏览器校准）下 0.052；穿透 0.12→0.025，后侧 0 开缝
- **男学生短裤白缝线**: `shorts_m` 加 `ah_sm_seam` 装饰子节点（0.006×0.18×0.028，button_white，双腿外侧）；`applyWrapScale` 支持 `_deco`（尺寸不改写 + x 吸附 wrap 后半宽贴面）；顺带修 `wrapMax` 收集（`firstWrapNode`：短裤带 children 后旧 `children[0]` 错拿缝线漏本体）
- **验证**: verify_zombie_gait（数据 14）+ verify_gait_runtime（渲染 11）+ 裙 26+14 + verify_trouber_overlap 8 + verify_shorts_seam 12+9 + 回归 53（v7927/29/33/baked）；0 错误
- **改动**: humanoid_config（Walk/Run 腿轨道、trousers_grey、shorts_m+applyWrapScale+firstWrapNode）+ 文档(版本同步 v0.79.35)

## v0.79.34 本次会话变更 (2026-08-16)

### 女裙收窄 + 圆台化 + 椭圆顶 + 学生裙膝上5cm

- **复核（用户观察验证）**: 裙底腿扫掠仅 x±0.075 两窄带 z∈[-0.08,+0.13]（前偏），后半圆富余；旧裙摆轨道**相位反了**（前踢帧裙后仰帮倒忙）。旧圆锥 rTop 0.077 锥尖埋进骨盆、骨盆下方有 -0.048 腿刺穿带（被遮挡不可见）
- **裙摆收窄**: `skirtTracks` → **0.35×左大腿轨道**（跟腿耦合，Walk/Run 自动派生）+ 裙轴 z+0.02 + gapBottom→0.13 → rBottom 0.247/0.277→**0.187**（全宽减 1/3，Run 余量 0.014/0.009）
- **圆台化**: rTop 0.077→0.157（包裹骨盆半宽 0.15）；**裙排除出 wrapMax**（圆形外层自包裹，混入会把骨盆撑成方板反捅穿裙壁）→ student_f 骨盆恢复原深 0.147
- **椭圆顶（新几何 EllipFrustum）**: 顶椭圆 rx0.157×rz0.105（正/背面腰部圆弧凸出 0.084→0.032）底面保持圆；`mkEllipFrustum` enemies+factory 两侧同步（16段侧面+双盖+平面UV）
- **学生裙**: 0.32→**0.295**（膝上 0.0498）；教师不动（膝上 0.068）
- **角刺出钳制**: `SKIRT_PELVIS_TD=0.14`（骨盆顶深，隐形内部件）+ `SKIRT_TLOWER_BD=0.14/BZ=-0.01`（衬衫盒底面，旧后角刺出 8cm→0.033）——两套装配器（buildHumanoid+bakeModel）同步
- **验证**: `artifacts/verify_skirt_space.js`（数据层 26：椭圆壁全高扫描/膝上5cm/角刺出量化）+ `verify_skirt_runtime.js`（Playwright 14）+ 回归 30（v7927/29/33）
- **改动**: humanoid_config（耦合轨道+WRAP zRatio+EllipFrustum×2+钳制+wrapMax）+ enemies/model_factory（mkEllipFrustum）+ 文档(版本同步 v0.79.34)

## v0.79.33 本次会话变更 (2026-08-16)

### 红领巾贴颈 + 袖子稍粗 + 红袖口归位

- **红领巾悬空根因**: Group z=**0.1 旧树遗留值**（旧颈 r0.12），新颈 r0.04 → 整体悬空 0.1。改 z0.008/结心 0.043（与颈相交 0.027）
- **袖子**: WRAP gap 0.008→0.004（稍粗一点）；**红袖口**: 旧挂 l_forearm -0.18 落手腕 → 挂上臂末端 -0.07（渲染 0.13=短袖底）
- **验证**: `artifacts/verify_v7933.js`（贴颈/袖粗/cuff 位置）
- **改动**: humanoid_config（red_scarf/polo_cuff/WRAP×4）+ 文档(版本同步 v0.79.33)

## v0.79.32 本次会话变更 (2026-08-16)

### 袖子盖肩 + 血迹改 Canvas 贴图渲染（皮肤式）

- **袖子盖肩**: 短袖 0.16→0.22+上移（学生 1.050≥1.037/教师女 1.239≥1.209/教师男长袖 1.240≥1.207）——实测全盖肩
- **血迹贴图化**: `makeBloodyCloth` Canvas（底色+900 斑驳点+6 血斑椭圆+14 溅点+3 血痕）——polo_blood/shirt_blood/pink_blood 三张贴图，DEFS 改挂 map（color 白由贴图供色）；**删除全部血迹几何**（blood_splatter addon+袖子血块）
- **⚠️ 自定义几何 UV**: RidgeBox/TaperedBox/TaperedHex/Wedge 无 UV→贴图不显示——enemies 4 个 mk 函数补平面映射 UV（x/bw+0.5, y/h）；工厂 build 函数已有固定 0-1 UV
- **验证**: `artifacts/verify_v7931.js`（盖肩×3/血衣 map/血迹几何删/长袖/刘海）
- **改动**: humanoid_config（袖子+删血迹）+ enemies（UV+血衣贴图+DEFS）+ model_factory（血衣贴图+MATERIAL_DEFS）+ 文档(版本同步 v0.79.32)

## v0.79.31 本次会话变更 (2026-08-16)

### 四变体穿上衣（袖子+平面血迹）+ 刘海圆弧贴头

- **上衣系统**: `VARIANT_TOP`（torso_upper：学生 polo_white/教师男 shirt_blue/教师女 pink_tee）+ 学生下躯干 polo 色；新材质键 pink_tee/shirt_blue/blood_red 两侧同步
- **袖子**: `DUAL_LIMB_ADDONS`（bakeModel parents 链加）+ WRAP 半径联动；短袖盖肩头/长袖双段盖全臂（实测盖肩/盖腕/不盖手）
- **平面血迹**: **薄 Box（厚 0.004）交叠成不规则斑块**（用户澄清非立体血滴球）——胸前 6 块 + 袖子 1-2 块，rotation.z 各异，贴前表面
- **刘海悬浮根因**: 块 x=±0.115 **超出头半径 0.112** + 直线排布。重排：块贴球面点 (0.098, 0.0542) + **绕 Y 朝向头心**（rotation.y ±1.56）——实测中心距头心 0.092
- **教师男 Die**: 长袖袖端下探 → root 0.04→0.09
- **验证**: `artifacts/verify_v7931.js`（Node 14 + Playwright 12）
- **改动**: humanoid_config（VARIANT_TOP/袖子/血迹/刘海/dieRootY）+ enemies/model_factory（材质键）+ 文档(版本同步 v0.79.31)

## v0.79.30 本次会话变更 (2026-08-16)

### 学生短裤上移盖骨盆 + 教师女发髻加大凸出

- **短裤**: shorts_m position.y -0.1→-0.06（⚠️ **渲染 y = position.y + pivot 补偿，数值减小=下移**——首改 -0.14 方向反了实测间隙变大）；裤顶盖入骨盆 +0.033
- **发髻**: bun_f 0.055→0.075 + 后移 z -0.1（直径 0.147/后凸 0.069）
- **改动**: humanoid_config（shorts_m/bun_f）+ 文档(版本同步 v0.79.30)

## v0.79.29 本次会话变更 (2026-08-16)

### 教师裤缩短/女裙缩短+切动画上移修复/领巾结缩小/刘海加宽

- **教师裤**: 大腿段 0.68→0.46（中心髋下 0.115 裤底到膝）+小腿段 0.6→0.35（底≈踝）——旧 0.68≈整条腿长（大腿 0.3465）致裤比脚低
- **裙上移根因（重要）**: 工厂 collectRefs 把扩展关节 position.y 清零（裙挂载位 -0.0375/-0.0875 被清）→ 切动画界面裙上移一截。Die 裙轨道 v0.79.27 已删，复位不再需要 → 删除。**扩展关节复位只应复位动画轨道改过的量**
- **裙缩短**: 学生 0.425→0.32/教师 0.525→0.38（提升裙摆露小腿）
- **领巾**: 结 0.07→0.03+飘带缩（不再像红花）；**刘海**: 宽 0.045+外移 ±0.115（缺口覆盖双眼）+上移 y0.055（与头顶衔接）
- **验证**: `artifacts/verify_v7929.js`（裤底≥脚底/裙底高于踝/切动画 Δ=0/领巾/刘海）
- **改动**: humanoid_config（裤/裙/领巾/刘海）+ humanoid_factory（position.y 不复位）+ 文档(版本同步 v0.79.29)

## v0.79.28 本次会话变更 (2026-08-16)

### 饰物降位缩尺寸 + 教师下躯干裤裙色 + 刘海分块露眼

- **饰物过高根因**: snap 贴胸**缺 pivot 补偿**——渲染层子件 position += -pivot（torso_upper pivot -0.145 → +0.145），snap y 几何坐标直接设置导致整体抬高半截躯干（饰物到肩线上）。修复 `position.y = yy + pivot[1]`；饰物再缩（领带 0.15/校徽 0.045/肩章 0.09）
- **教师下躯干裤裙色**: bakeModel 对 teacher_* 的 torso_lower → trousers_grey（衬衫扎裤裙）；学生 polo 外放保持 skin
- **刘海分块**: fringe_f 单 Box → Group 左右两块 ±0.05/宽 0.035，中间缺口露眼（眼 x0.095 ∈ [0.048,0.112]）
- **验证教训**: 浏览器 RidgeBox 顶点稀疏（底/脊/顶 3 行）+ headless 矩阵错值 → 切片断言不可靠；**贴胸权威验证 = 数据层 snap 公式复算**（间隙与期望值精确一致）；`artifacts/verify_v7928.js`、`verify_addon_fit.js`（断言重构）
- **改动**: humanoid_config（snap 补偿+尺寸+torso_lower+刘海）+ 文档(版本同步 v0.79.28)

## v0.79.27 本次会话变更 (2026-08-16)

### 骨盆裤裙同色 + 死亡整体下沉贴地（用户方案：姿势不变只降高度）

- **骨盆同色**: `PELVIS_CLOTH`（学生 shorts_red/教师 trousers_grey）bakeModel 后处理改 pelvis materialId
- **死亡浮空根因**: Die root 高度末帧 0.475 是 legacy 躺地值，**新树整体悬空 0.31**（实测各部位 min.y 0.30~0.35）。**修复 = 整体下沉**：删掉 v0.79.26 的裙 position.z 下沉和初版 scale 花活（用户明确不要），Die root 高度末帧按骨架定制（学生 0.1/教师男 0.04/教师女 0.12）——躯干贴地 trunkMin≈0、裙摆圆环自然没入 skirtMin -0.11、四肢微穿 ≤9cm 为散落自然
- **验证**: `artifacts/verify_v7927.js` 15 项（四变体：无裙轨道/躯干贴地/四肢贴地/裙没入）+ 回归 32
- **改动**: humanoid_config（PELVIS_CLOTH+dieRootY 参数+删 Die 裙轨道）+ 文档(版本同步 v0.79.27)

## v0.79.26 本次会话变更 (2026-08-16)

### 发型露眼/衣物收小/裙摆动画/死亡裙前摆没入地面

- **发型**: short_hair_m Group rotation.x -0.35 头盔式后倾（前缘上抬露眼）
- **衣物收小**: 裤 WRAP gap 0.016/短裤膝上/裙摆 r 0.25~0.30/校徽 0.055/肩章 0.09×0.12/领带 0.2/领子 y0.7
- **裙摆动轨道**: zombieAnims 按变体裙名（ah_skirt/ah_gskirt）注入 Idle/Walk/Run 摆动——**播放器 P/O 表扩展收集非 JOINT_NAMES 轨道关节**（enemies+humanoid_factory 两处）；切动画复位扩展覆盖裙（rotation+position）
- **Die 裙没地**: 裙 rotation -1.35 + **position.z +0.5**——⚠️ **躺平后局部 y 是 z 方向（无效），z 才是世界下沉轴**（前倒 90° 后局部 +Z→世界 -Y）；实测裙底 -0.229 没入地面、身体贴地 0.007
- **修游戏裙空几何**: enemies buildHumanoidRig Cylinder `segments||8` 吃数组 [16,1] → NaN 段数 → 空几何（游戏裙一直隐形）。`Array.isArray?[0]:seg`
- **验证**: `artifacts/verify_v7926.js`（顶点法 bbox——headless 无渲染帧 Box3.setFromObject 矩阵合成不可靠，须用 matrixWorld+顶点）
- **改动**: humanoid_config + enemies（Cylinder/O 表/play 复位）+ humanoid_factory（O 表/裙复位）+ 文档(版本同步 v0.79.26)

## v0.79.25 本次会话变更 (2026-08-16)

### addon 适配新骨架四项修正

- **教师女去胸臀**: addons 删 bust/hips（v2 骨架自带曲线）；**鞋子**: 0.2×0.12×0.32→0.118×0.055×0.235（脚大一丝防穿模）；**发型**: 半球 r0.22 斗笠→0.118 贴头 + mesh y=r/2（geo.center 补偿）+ `side:2` 双面渲染（两侧渲染层 mat.clone()+DoubleSide）
- **snap 贴胸机制**: def 加 `snap:{y,x,out}`，bakeModel 按 torso_upper(RidgeBox) 前表面公式（脊线分段插值）计算 z 改挂——badge/stripes/tie/placket/collar 任意骨架自动贴合。**改 addon 挂点注意**: 静态 position 无法适配多骨架几何差异，用 snap 计算
- **验证方法**: 同高度顶点切片验证贴附（整体 bbox 对斜面/锥度躯干不公平）；`artifacts/verify_addon_fit.js`
- **改动**: humanoid_config + enemies/model_factory(side) + 文档(版本同步 v0.79.25)

## v0.79.24 本次会话变更 (2026-08-16)

### 四变体新骨架烘焙 + 丧尸专属动画（含衣服发型）

- **烘焙管线**: `VARIANT_SKELETON`（学生→v1-儿童/教师男→v1-成年男/教师女→v2-成年女性）+ `bakeModel` 完整 addon 注入（镜像/双挂/WRAP/curves 放大/学生下摆 grow），tree 裸 21 → 穿衣 28~40 节点；衣服发型用旧 `HUMANOID_VARIANTS.addons`（25 件 addon 库保留未删）
- **丧尸动画集 `deriveZombieAnims`**: 删 Punch + 驼背 rest + Walk 拖行（左腿好右腿瘸膝僵直 0.42~0.58+躯干摇摆+跛动骨盆，2.2s）+ Run 奔袭（双上臂前伸 -1.25 同相+前臂垂抓 -0.5+头前探，1.0s）+ durations 表；Die 保留骨架版。`MODELS[v]` 双动画：`anims`（骨架直立 7 动画）+ `zombieAnims`（丧尸 6 动画）
- **消费端**: 工厂变体模式→zombieAnims；`humanoid_factory` 动画表**动态生成**（按配置 actions 键 6/7 项+categories+durations，原地更新保持引用）；游戏 `createCampusZombie` 直连 MODELS 烘焙树——**新树 l/r 与动画数据层一致，mirrorAnimsForLegacyTree 不再使用**（函数保留给 legacy 兜底）
- **⚠️ 烘焙 NaN 教训**: 下摆 grow 曾把 TaperedBox 9 参数截断为 3 → NaN 几何；且教师误 grow（骨架名≠变体名条件错）。修复：`_variantKey` 判定 + `size.slice()` 只放大底面宽/深。**改 size 数组必须保留全部参数位**
- **验证**: Node 35 + Playwright 23 + 回归 39（旧脚本断言适配丧尸动画语义）；`artifacts/verify_baked_variants.js`
- **改动文件**: humanoid_config（VARIANT 表+bakeModel+deriveZombieAnims+MODELS+pelvis 修复）+ humanoid_factory（动态表）+ model_factory（zombieAnims）+ enemies（直连烘焙树+DUR 配置化）+ 文档(版本同步 v0.79.24)

## v0.79.23 本次会话变更 (2026-08-16)

### 奔跑前迈膝弯明显化

- **根因**: 旧值前迈极限膝 **-0.3（过伸反张）**——直膝棍腿，膝负值本身违反生理（膝不过伸）
- **新值**: l/r_lower_leg 前迈 -0.3→+0.5（L 形弯折）/着地 0.05→0.25 缓冲/折叠期 1.85 保留；r 半周期平移
- **验证**: `artifacts/verify_run_knee.js`（前迈膝 0.46、膝高于踝 Δ0.128=小腿倾斜、折叠 1.80 保留）
- **改动文件**: humanoid_config（Run lower_leg ×10）+ index/engine/README/CLAUDE/CODEBUDDY/trae/AGENTS(版本同步 v0.79.23)

## v0.79.22 本次会话变更 (2026-08-16)

### 跑步前臂上弯（拳指下巴前方，最低点不低于水平）

- **几何公式**: 前臂净前弯 = |upper.x + forearm.x| 需全程 ≥ 1.57（90°）——上臂后摆 +0.5 会抵消前臂屈肘，只看 forearm 值会误判
- **新值**: forearm x 后摆 -2.10（净 1.60）/过渡 -1.75（净 1.60）/前摆 -1.55（净 2.05=上仰 27° 拳指下巴）；实测前臂 yDir 最低 +0.025、拳 y0.88 距下巴 0.1
- **验证**: `artifacts/verify_forearm_up.js`（前臂方向向量断言——elbow→hand 的归一化 y 分量 ≥ -0.05 即不低于水平，比旋转值断言更直接）
- **改动文件**: humanoid_config（Run forearm ×10）+ index/engine/README/CLAUDE/CODEBUDDY/trae/AGENTS(版本同步 v0.79.22)

## v0.79.21 本次会话变更 (2026-08-16)

### 步行左右步距不均修复（r_upper_leg 相位错 0.25）

- **根因**: Walk `r_upper_leg` 与 l 错相 **0.25**（应 **0.5** 半周期）——左右脚迈步节拍 0.25/0.75 交替不等距 → 一步大一步小。v0.79.11 引入；**数值对称性检查发现不了相位错误**（需验证 r(t)≡l(t±0.5) 恒等或实测极值帧等距）。r_lower_leg/Run 均正确，仅此一处
- **修复**: r_upper_leg = l 半周期平移（0:0.12, 0.25:0.25, 0.5:-0.45, 0.75:-0.08, 1:0.12）×5；pelvis 单峰→双峰（两步两颠）
- **验证**: 极值帧 R@42→L@86→R@130 间隔恒 44 帧（半周期 43.75）+ r(t)≡l(t±0.5) maxErr=0；`artifacts/verify_walk_phase.js`
- **⚠️ 步态左右对称验证方法**: 采样全周期找左右踝/膝 z 局部极大值帧号，断言交错且间隔=半周期；只比 min/max 范围测不出相位 bug

## v0.79.20 本次会话变更 (2026-08-16)

### 奔跑前臂向前中线内收

- **Run 前臂 z 轨道**: l/r_forearm rotation.z 前摆收向中线 -0.20（l 侧）/后摆微收 -0.06，r 侧反相；与屈肘 x 摆臂同相位。游戏镜像 z 取负后方向仍向中线（+0.07/+0.19 实测）
- **符号约定**: 工厂树 l 侧 z 负=内收 / r 侧 z 正=内收；上臂自然外张 rest z ±0.09 不变
- **验证**: Playwright 13（z 内收 4 项+屈肘 5+游戏镜像+回归）+ verify_punch2 8/8；verify_punch.js（v0.79.17 首版）值断言过时弃用
- **改动文件**: humanoid_config（Run z×5）+ index/engine/README/CLAUDE/CODEBUDDY/trae/AGENTS(版本同步 v0.79.20)

## v0.79.19 本次会话变更 (2026-08-16)

### 跑步摆臂屈肘 90° + 切动画关节残留修复

- **Run 前臂轨道**: l/r_forearm x 屈肘 90° 基线 -1.52，前摆甩开 -1.35（77°）/后摆收紧 -1.70（97°）左右反相（跑步技术：肘弯~90°，前摆肘角略开后摆收紧）；Walk 保持直臂
- **⚠️ 切动画残留修复**: 游戏 `_updateLayer` 只写当前动画轨道——新轨道（Run 前臂）写入后切无该轨道动画（Walk）即**永久残留**（Die 后 head 歪同类）。修复：`createHumanoidAnimationSystem` 包装 play，切动画时非新动画轨道关节复位到**创建时树静态**（uuid 对比；树静态含 hunch 驼背保持）。**新增轨道务必考虑其在其他动画的复位**（工厂侧 resetState 已覆盖）
- **codemod 教训**: 数组插入要在 `]` **之前**不是之后（首版插到数组外成对象非法元素）；compact 拼接 join(',') 别漏逗号；改完立即 eval 自检
- **验证**: Node 30 + Playwright 8 + 全量回归 37（verify_punch2/punch/upright_game；rest head:z 断言改镜像 -0.08）；`artifacts/verify_run_forearm.js`
- **改动文件**: humanoid_config（Run 前臂×5）+ enemies（play 包装）+ index/engine/README/CLAUDE/CODEBUDDY/trae/AGENTS(版本同步 v0.79.19)

## v0.79.18 本次会话变更 (2026-08-16)

### 拳击力度感增强（蓄力极限：肘拉到躯干后方）

- **蓄力极限(t=0.45)**: r_upper_arm x +0.85（上臂后摆 49°，**肘部拉到躯干后方 0.21**/肩后 0.15）+ r_forearm x -2.05（极限屈肘，拳收肩侧，较护卫位收回 0.19）+ 扭腰反向 -0.32 + 躯干后仰 -0.06 + 后膝深弯 0.65 重心后坐
- **爆发(t=0.55)**: 摆幅 2.25 rad（+0.85→-1.4），拳行程 0.57m/0.1s；扭腰 -0.32→+0.52（0.84 rad）；后腿蹬直 0.65→0.08；重心下沉 -0.06
- **验证**: Node 35 + Playwright 8（肘位/摆幅/收回/游戏镜像 0.63）+ 0 错误；`artifacts/verify_punch2.js`。**坑**: 展台采样必须每次 collectRefs 重置——连续 sample 会累计 _t 跨过峰值
- **改动文件**: humanoid_config（Punch ×5）+ index/engine/README/CLAUDE/CODEBUDDY/trae/AGENTS(版本同步 v0.79.18)

## v0.79.17 本次会话变更 (2026-08-16)

### 攻击拆分"挥击"+ 新增"拳击"动画 + legacy 树镜像修复

- **改名**: 基础动画 Attack→Swing（挥击），humanoid_config 5 处 actions 键 + humanoid_factory 7 动画列表 + enemies.js DUR + engine.js 丧尸 nameMap `attack:'Swing'`
- **新增 Punch（拳击，右直拳 orthodox，13 轨道 1.0s ×5 副本）**: 前后站架（左腿前 -0.3/右腿后 +0.25，膝微弯）+ 双拳护脸（upper -0.45/forearm -1.75 弯肘）+ 右拳后拉蓄力→爆发直出（-1.35/-0.25 伸直）+ 左拳护卫全程收紧 + 扭腰（torso y：-0.18 蓄力→+0.42 右肩前送）+ head y 反向看目标 + torso x 前倾（restKey 偏移制）+ 后膝蹬直 + pelvis 微沉
- **⚠️ legacy 树左右镜像（重要架构事实）**: HUMANOID_BASE 系（游戏消费）l_/r_ 与新数据层（工厂消费）**镜像**——legacy l_upper_arm x=-0.3、新树 +0.171，均面朝 +Z；rotation **y/z 轴语义相反**（x 轴/位置不受影响）。此前动画全用 x 轴从未暴露；Punch 扭腰首次触发
- **镜像修复**: enemies.js `mirrorAnimsForLegacyTree()` 游戏消费时对 rotation y/z 轨道值取负 + rest y/z 键取负（pelvis:y 位置排除）——两侧动作协调（游戏左右手互换但方向正确）；**顺带修复游戏 Die 双臂 z 自 v0.79.11 起向内插身体的隐性 bug**
- **验证**: Node 155 + Playwright 工厂 6（右拳 Δz0.23/扭腰 Δ0.14/护卫）+ 游戏 6（镜像协调 Δ0.11/Die 外张 0.10）+ 0 错误；脚本 `artifacts/verify_punch.js`
- **改动文件**: humanoid_config（Swing×5+Punch×5）+ humanoid_factory（7 动画表）+ enemies（DUR+mirror+接入）+ engine（nameMap）+ index/README/CLAUDE/CODEBUDDY/trae/AGENTS(版本同步 v0.79.17)

## v0.79.16 本次会话变更 (2026-08-16)

### 变体名加"校园丧尸"后缀

- **改动**: `humanoid_config.js` `HUMANOID_VARIANTS` 四个 name 加后缀——`学生(男/女)·校园丧尸`、`教师(男/女)·校园丧尸`。与"人形敌人"总类名区分（非丧尸人形后续可并列加变体）
- **零影响保证**: name 仅工厂变体下拉消费；游戏侧全用内部键（student_m/userData.variant/solidify `humanoid:variant` 按键定位）
- **改动文件**: `models/humanoid_config.js`(4 name) + index/engine/README/CLAUDE/CODEBUDDY/trae/AGENTS(版本同步 v0.79.16)

## v0.79.15 本次会话变更 (2026-08-16)

### 模型菜单更名"人形敌人"

- **改动**: `model_factory.html` modelOptions 下拉 `'🧟 校园丧尸'` → `'🧍 人形敌人'`（人形敌人不一定都是丧尸；内部键 `humanoid` 不变，管线零改动）
- **验证**: Playwright 断言下拉文字 + 切换加载 + 0 错误
- **改动文件**: `model_factory.html` + index/engine/README/CLAUDE/CODEBUDDY/trae/AGENTS(版本同步 v0.79.15)

## v0.79.14 本次会话变更 (2026-08-16)

### 基础骨架动画直立化（驼背移至丧尸烘焙层）

用户需求：工厂骨架(共通)的 Idle/Walk/Run 默认驼背，但人类敌人不一定都是丧尸——基础骨架动画直立，烘焙出丧尸模型再加驼背。

- **直立化（5 处 rest 三键归零）**: `REST_POSES` + 4 个 `SKELETON_VERSIONS[key].anims.restPoses` 的 `torso:x(0.2)/neck:x(0.22)/head:z(0.08)` → 0（手臂外张 z±0.09 与 pelvis:y 保留）。Attack 轨道 restKey 偏移制自动适配（直立峰值 0.3 / 丧尸 0.5）；Run torso 绝对前倾 0.3 两态共用
- **丧尸烘焙注入**: MODELS anims 运行时从版本深拷贝（文件尾），新增 `ZOMBIE_HUNCH={torso:x:0.2,neck:x:0.22,head:z:0.08}` 继承后注入 restPoses——游戏丧尸/工厂变体视觉与旧版一致；深拷贝隔离不污染版本
- **legacy 树静态驼背归零**: HUMANOID_BASE 字面量 torso/neck/head rotation（0.2/0.22/0.02+0.08）→ 0（SKELETON_BY_VARIANT 三树运行时深拷贝自动跟随），消除与新 hunch 公式双重驼背
- **deriveNode hunch 语义**: `+(hunch-0.2)` → `+hunch`（0=直立，正值=驼背；旧公式 hunch<0.2 后仰不合理）。游戏 Idle/Walk/Run 无 torso 轨道→保持树静态驼背=hunch（student 0.1~0.25 / teacher 0~0.05，旧行为一致）
- **关键机制注意**: 游戏侧 AnimationSystem **无** collectRefs 式 rest 复位——驼背=树静态（torso_pivot），rest 基线只对带 restKey 轨道生效；工厂侧 humanoid_factory collectRefs 有 rest 复位。teacher_f torso 是 Group（沙漏躯干）无 pivot
- **验证**: Node 断言 27/27 + Playwright 工厂 7/7（骨架 Idle/Walk torso=0 / 变体驼背 0.2+0.22）+ 游戏 17/17（4 变体）+ 0 错误
- **改动文件**: `models/humanoid_config.js`（REST_POSES+4版本+ZOMBIE_HUNCH+deriveNode+HUMANOID_BASE）+ index/engine/README/CLAUDE/CODEBUDDY/trae/AGENTS(版本同步 v0.79.14)

## v0.79.13 本次会话变更 (2026-08-14)

### 攻击动画双关节弯腰（髋+腰链式前弯表现下挥力量感）

用户指出：攻击双手下挥时只有腰（上躯干-下躯干交界）前弯，髋（下躯干-骨盆交界）无动作显僵硬，要求两关节都前弯。

- **新增髋轨道**: Attack 增加 `torso`(kind O) rotation.x 轨道，restKey `torso:x` 偏移制（0=驼背基线，工厂/游戏共用 rest 表无缝）。时序：举臂蓄力髋**后仰 -0.12 预拉伸** → t0.55 **爆发前弯 +0.30** → t0.78 回收 +0.08 → 归零
- **腰部微调**: torso_upper 0.5→0.42（峰值），加 0.02 蓄力前微伸。峰值双弯合计 ~0.78 rad，力量从髋→腰→臂链式传导
- **游戏侧发现**: legacy 树（SKELETON_BY_VARIANT，游戏 buildHumanoid 实际用）**无 torso_upper 节点**——旧腰部轨道在游戏一直是 no-op（丧尸攻击躯干全不动）；新髋轨道（torso 存在）让游戏首次有攻击躯干动作。legacy 树迁移 torso_upper 记为已知问题（涉及三棵 legacy 树层级手术，下轮处理）
- **验证**: Playwright 时序采样（髋 0.20→0.44→0.19 / 腰 0→0.35→0 / 手最低 0.583 / rootY 恒定）+ 时间膨胀定格峰值视觉评估（链式双弯/力量感/无插地）+ 游戏 student_m/teacher_f 髋轨道生效 + 6 动画回归 0 错误
- **改动文件**: `models/humanoid_config.js`（Attack 6 轨道×5 处：BASE_ANIMS+4 版本副本）+ index/README/CLAUDE/CODEBUDDY/trae/AGENTS(版本同步 v0.79.13)

## v0.79.12 本次会话变更 (2026-08-14)

### 死亡动画瘫平重做（修复"僵硬斜靠/单肩单脚着地/胳膊内收插躯干"）

用户报告模型工厂校园丧尸骨架(共通)死亡动画异常。Playwright 定位 3 个根因并重做：

- **根因1 展台骨盆扭转**: `humanoid_factory.js` collectRefs/resetState 复位循环把位置 rest 键 `pelvis:y`(骨盆高度)误当**旋转 y** 应用 → 展台一启动骨盆扭转 28.6°，躺姿侧倾只剩右肩右脚蹭地。新增 `_rotRestY(n)` 排除 pelvis 位置键（顺带修复所有展台动画的隐性扭转）
- **根因2 双臂符号反**: 旧 Die l z=-0.3/r z=+0.3 都是向内收（正确外张为 l+/r−）→ 手越过中线插进躯干
- **根因3 驼背鼻冲**: REST 驼背(torso 0.2+neck 0.22)在 90° 前倒后变成头朝下栽、膝僵直 → 木板式僵硬
- **新 Die 关键帧**（15 轨道，BASE_ANIMS+4 版本副本同步）：前倒 root 90°(加速-过冲-回落) + 拉直驼背(torso→0/neck→0.05) + 头侧转贴地(head z→0.7) + 双臂外张(左54°/右34°) + 屈肘不等角(左-0.4/右-0.55，手落胸脚同平面) + 髋微屈压脚(-0.06/-0.1) + 双腿微外分(z ±0.1/0.16) + 膝先屈0.35失稳再倒 + 落地微弹
- **root 高度轨道重写**: 旧 t0=0 与游戏树 root 自然高度 0.75 不符 → 游戏内死亡瞬间瞬移下沉 0.35；改 0.75→0.475（游戏树躺地补偿；工厂被逐帧贴地覆盖不受影响）
- **已知残留**: 游戏侧旧 HUMANOID_BASE 树(儿童头大位低)俯卧头部微插地~0.1（尸体1.5s展示期，共享关键帧无法兼顾新旧树拓扑）
- **验证**: Playwright 骨架/变体双模式×(终态关节坐标/中间帧/死亡后复位/Walk对称回归) + 游戏侧三变体 Die 管线 + Qwen 视觉评估(平躺摊平/双臂外张屈肘不等角/头侧转贴地/无僵硬) + 0 控制台错误
- **改动文件**: `js/humanoid_factory.js`(_rotRestY) + `models/humanoid_config.js`(Die 关键帧×5处) + index/README/CLAUDE/CODEBDDY/trae/AGENTS(版本同步 v0.79.12)

## v0.79.11 本次会话变更 (2026-08-14)

### 人形动画系统重构（每骨架一套动画）+ 步态/攻击/死亡重做

用户确立流水线设计（见 `memory/humanoid-pipeline.md`）：**每骨架维护一套基本动画**，烘焙变体继承，新关卡人形（军/警/矿）符合三大骨架即可零适配。实施：

- **架构**: `humanoid_config.js` 新增 `BASE_ANIMS`（restPoses + 6 动作关键帧模板）；每个 `SKELETON_VERSIONS[key].anims` 独立深拷贝（restPoses['pelvis:y'] = 该骨架 pelvis 高度）；`MODELS[v].anims` 烘焙继承；`enemies.js`/`humanoid_factory.js` 播放器数据驱动化——**消除双份关键帧镜像债**（顺带发现游戏侧还是 v0.79.3 前未同步的反向步态）
- **步态人体数据化**: 走路 髋前屈 26°/后伸 14°/摆动期膝屈 63°；跑步 49°/20°/86°；对侧摆臂；膝弯符号修复（v0.79.3 只翻大腿的遗留）；手臂外张 5°
- **攻击重做**: 慢举（腰不动）→ 0.1s 快速前挥+上躯干弯腰。新增 `torso_upper` 关节（pivot 在腰线）+ **绑骨层级迁移**（neck/双臂移挂 torso_upper）；JOINT_NAMES 补 torso_upper
- **死亡重做**: 前倒平摊贴地 + 手臂自然散落（俯卧后 l z=-0.3/r z=+0.3）；修 pelvis 切换残留（collectRefs 复位）；贴地补偿 0.072
- **骨架编辑工作流**: 移除"工作骨架"UI（默认=成年中性）；冻结按钮改名"冻结分支"；删除 v1-成年女（teacher_f → v2-成年女性）
- **其他**: Shift 精细滑动重写（全滑杆通用+input 兜底）；`window._doSave`/`window._deleteSkeletonVersion` 暴露
- **已知问题(新)**: 死亡瘫倒姿态仍有微调空间（用户最后确认"不理想"但时间晚，下轮继续）
- **改动文件**: `models/humanoid_config.js`(BASE_ANIMS+版本anims+层级迁移+torso_upper) + `models/enemies.js`(播放器数据驱动) + `js/humanoid_factory.js`(数据驱动+rest/pelvis复位) + `model_factory.html`(骨架编辑工作流+动画注入+Shift滑动) + memory/humanoid-pipeline.md(新) + index/README/CLAUDE/CODEBUDDY/trae/AGENTS(版本同步 v0.79.11)

## v0.79.10 本次会话变更 (2026-08-14)

### 骨架命名版本保存修复

用户报告：选中 v1-成年男 编辑（骨盆 0.375→0.5、降腿）保存固化后强制刷新仍是 0.375。定位：`_doSave` 骨架模式分支**无条件写回 WORKING_SKELETON** + 固化 `humanoid_skeleton`——修改进了工作骨架，命名版本源文件不变。修复：按 `_humanoidSkelVer` 分流——**选中命名版本 → 写回 `SKELETON_VERSIONS[key].tree` + `humanoid_versions` 整体固化**；工作骨架 → 原路径。暴露 `window._doSave` 供测试。

- **验证**: Playwright 全链路（切 v1-成年男 → pelvis posY 0.375→0.5 → 保存 → 内存 0.5 → 刷新后源文件仍 0.5）+ 0 控制台错误
- **改动文件**: `model_factory.html`(_doSave 按版本分流+window 暴露) + index/README/CLAUDE/CODEBUDDY/trae/AGENTS(版本同步 v0.79.10)

## v0.79.9 本次会话变更 (2026-08-14)

### 骨架版本解耦（修复污染链）+ 删除骨架版本功能

用户报告：编辑一个骨架版本保存后影响其他版本；期望骨架间完全独立、自由保存，冻结仅用于备份/分支。排查定位**污染链根因**：

- **根因**: humanoid_config.js 中 v1-男/女/儿童 原为 `_deriveProportion(WORKING_SKELETON, ...)` **运行时派生**——页面每次加载从工作骨架重算，编辑/保存工作骨架即传导到所有版本（2026-08-13 用户误编辑事故机制）；且 server.py 固化 humanoid_versions 在整体字面量之后**残留一组 v0.79.6 逐条赋值**（`SKELETON_VERSIONS['v1-...'] = {...}`），运行时覆盖正确字面量
- **修复**: 删除残留的逐条赋值段（-573 行）；四个 v1 版本 + 新冻结版本全部为**独立字面值**（`var SKELETON_VERSIONS = {...}` 整体对象，互不影响）；SKELETON_VERSIONS 上方加防回归注释（禁止派生写法）
- **新增删除功能**: 模型工厂骨架模式 `modeF` 新增「🗑️ 删除当前版本」按钮 → `deleteSkeletonVersion(key?)`（confirm → delete SKELETON_VERSIONS[key] → 若为当前选中则回退工作骨架+rebuildModel → 下拉选项刷新 `_verCtrl.options()` → `/api/solidify humanoid_versions` 固化）；暴露 `window._deleteSkeletonVersion` 供测试
- **数据**: v1-成年中性/男/儿童 = v0.79.6 原始（pelvis posY 0.375）；v1-成年女 + v2-成年女性-2026-08-14（用户冻结）= 用户编辑数据（0.5）
- **验证**: Node vm 数据断言全过（四版本+MODELS 烘焙 teacher_f=0.5）+ Playwright 页面运行时 0 错误 + 删除完整链路实测（临时版本 6→5、confirm 弹窗接受、源文件无 tmp-test 污染）
- **改动文件**: `models/humanoid_config.js`(删重复赋值+注释) + `model_factory.html`(删除功能+verCtrl刷新) + index/README/CLAUDE/CODEBUDDY/trae/AGENTS(版本同步 v0.79.9)

## v0.79.8 本次会话变更 (2026-08-13)

### 模型工厂 Three.js 本地化（修复 ERR_QUIC_PROTOCOL_ERROR）

用户报模型工厂控制台 `ERR_QUIC_PROTOCOL_ERROR`（three.module.js / OrbitControls.js 加载失败）。定位：`model_factory.html` 的 importmap 走 **unpkg CDN**，浏览器访问 CDN 时 QUIC/UDP 网络层失败（环境网络问题，非本地服务）。

- **CDN→本地**: importmap 三个依赖全部本地化——`js/three.module.js`(1.27MB) + `js/addons/controls/OrbitControls.js` + `js/addons/geometries/RoundedBoxGeometry.js` + `js/lil-gui.esm.js`，均从 unpkg three@0.160.0 / lil-gui@0.18.0 原样下载（已验证无内部外部 import，OrbitControls/RoundedBoxGeometry 仅 import 'three'）
- **效果**: 模型工厂完全离线可用，不再受 CDN/QUIC 干扰
- **验证**: Playwright 0 控制台错误 + canvas/modelRoot/HumanoidConfig/HumanoidAnims/部件树全部正常 + 网络面板 0 unpkg 请求
- **改动文件**: `model_factory.html`(importmap) + `js/three.module.js`(新) + `js/addons/controls/OrbitControls.js`(新) + `js/addons/geometries/RoundedBoxGeometry.js`(新) + `js/lil-gui.esm.js`(新) + index/README/CLAUDE/CODEBUDDY/trae/AGENTS(版本同步 v0.79.8)

## v0.79.7 本次会话变更 (2026-08-13)

### 模型工厂坐标轴 X/Z 标反修复 + 方位标识开关

用户报告：模型工厂场景的方位标识 x/z 似乎反了——改部件 z 数值，动的却是 x 方向位置。定位：`model_factory.html` 的 `addLabeledAxes` 曾为"适配六足战车朝向"做 X↔Z 交换（红线标 Z、蓝线标 X），与部件参数的标准 Three.js 坐标（`position[z]`→世界 Z 轴）冲突 → 标签误导。修复 + 新增开关：

- **坐标轴改回标准**: 红=+X / 绿=+Y / 蓝=+Z（Three.js 右手系），标签与部件参数坐标系一致；线条与标签全部收集到 `axesGroup`（`model_factory.html` addLabeledAxes）
- **新增开关**: 底栏 `#toggle-axes`「🧭 隐藏坐标轴」按钮，点击切换 `axesGroup.visible` + 按钮文字（仿 toggle-helpers 模式）
- **顺带修复**: engine.js 调试信息版本号从遗留的 v0.77.0 同步为 v0.79.7（此前多轮漏同步）
- **验证**: Playwright 加载 model_factory.html 0 控制台错误 + 开关点击文字切换正确（隐藏↔显示）+ vision.py 顶视图截图确认红 X/蓝 Z 标签位置正确
- **改动文件**: `model_factory.html`(addLabeledAxes 标准坐标+axesGroup+按钮+事件绑定) + `js/engine.js`(调试版本号) + index/README/CLAUDE/CODEBUDDY/trae/AGENTS(版本同步 v0.79.7)

## v0.79.6 本次会话变更 (2026-08-13)

### 成年女胸臀曲线 + 儿童骨架眼睛修复

- **RidgeBox 五边形截面（胸）**: 新增几何类型 `buildRidgeBox`/`mkRidgeBox`（两处 createGeometry），胸前一条水平脊线（脊线长=截面宽度插值 `bw+(ridgeY/h)(tw-bw)`，脊线 z=前面插值+ridgeZ），侧面截面四边形→五边形。只给 v1-成年女 `torso_upper`，默认 ridgeY=0.20/ridgeZ=0.04
- **TaperedBox 底面偏移（臀）**: TaperedBox 从 7 参数扩展 9 参数（加底面偏移 bx/bz，缺省 0 向后兼容）；`torso_lower` 底面 bz=-0.04 后凸、`pelvis` Box→TaperedBox 顶面 oz=-0.04 对齐（臀部=两者交界边后凸）
- **v1-成年女 派生**: `_applyFemaleCurves` 只覆盖 v1-成年女 的 torso_upper/torso_lower/pelvis，不污染共享 WORKING_SKELETON 和其他骨架
- **工厂调参面板**: TaperedBox 加「↙ 底面偏移」滑块 + RidgeBox 9 参数滑块（含「🐻 胸前脊线」脊线高度/凸出；ridgeZ≥0、ridgeY 几何钳制 [0,h] 防破面/畸形）
- **setBone 眼睛修复**: Sphere 节点子 position 全轴等比 + size 等比缩放（原只缩 y），修儿童骨架 head 放大后眼睛没入头里
- **执行方式**: subagent-driven-development（3 task 各派 implementer + reviewer，final review opus 通过）
- **验证**: 数据断言 7/7 + 渲染检查 + vision.py 侧视图确认 S 曲线无破面 + CDP 全程 0 错误
- **改动文件**: `model_factory.html`(RidgeBox几何+调参面板) + `models/enemies.js`(mkRidgeBox+bx/bz) + `models/humanoid_config.js`(\_applyFemaleCurves+setBone) + index/README/CLAUDE/CODEBUDDY/trae(版本同步)

## v0.79.5 本次会话变更 (2026-08-09)

### 校园丧尸三副骨架 + 比例重定 + 女教师 S 曲线精修 + 鞋修复

用户报告：① 男教师皮鞋在裤管膝盖位置（视觉腿长一倍）；② 四变体共享骨架上身长下身短、臂短。经系统调试定位根因（ah_tc_l 小腿裤段 size 0.7 远大于腿长 + 贴地用整体 bbox 含指尖），并按「男女学生共享 / 男女教师分开各一套 + 女教师精细曲线 + 教师游戏固定」重做：

- **鞋/裤段贴地修复**（会话开头）: `ah_tc_l`/`ah_tr_l` size 高度匹配腿长（0.42/0.48）+ position=0 中心对齐；rebuildModel 贴地改**排除手臂指尖**（旧逻辑用整体 bbox.min，臂长后指尖低于脚底 → 指尖着地脚悬浮 → 身高虚高比例失真，pw 测上身:下身 1.28→2.12 的元凶）
- **三副独立骨架**(`humanoid_config.js`): `HUMANOID_BASE` 深拷贝派生 `STUDENT_BASE`(学生共享)/`TEACHER_M_BASE`/`TEACHER_F_BASE`，`SKELETON_BY_VARIANT` 映射 + `buildHumanoid` 选骨架。关节名一字对齐复用 ADDON_LIBRARY/动画
- **比例重定(游戏风格化)**: `setBone(同步 size+pivot=size/2+子position)` 防缩 size 后 pivot 硬编码错位（空隙/手臂超肩）。学生仅加长臂(0.52/0.48)；男教师腿0.65/0.60+臂0.55/0.50+头0.17+肩0.36；女教师腿0.70/0.65+臂0.52/0.47+头0.16+肩0.28（几何比例 1.70→1.04-1.18）
- **女教师 S 曲线**: 沙漏躯干(torso Box→Group 两 TaperedBox 肩0.52→腰0.30→臀0.56) + 椭圆 pelvis(Box→TaperedHex 臀0.62腰0.54) + 胸/臀楔形(两球/扁球→**Wedge** 底梯形+顶线，靠肩宽/靠腿宽) + curves 默认0.7（scaleGroup 放大 bust/hips）+ 胳膊腿细(radius 减) + 臀楔形贴下躯干(torso_lower)底边重合
- **取消上衣下摆**: 教师 pelvis 不再 grow 衣服延伸，男 pelvis 显裤色 / 女 pelvis 显裙色（trousers_grey），衬衫/上衣扎进裤裙
- **新几何 Wedge/TaperedHex**: 工厂 + enemies.js createGeometry 均补（buildWedge 梯形底面+顶线5面 / mkTaperedHex 六棱台），法线顺序修正（底面 quad(A,B,C,D) + 上侧面 quad(D,E,F,C)）
- **游戏侧教师固定/学生随机**(`enemies.js`+`campus_spawner.js`): createCampusZombie 教师 build/hunch 取 bodyRange[0]、女 curves0.7；campus_spawner 教师身高固定1.65、学生随机1.1-1.5
- **执行方式**: brainstorming(三段设计确认) → writing-plans(spec + 实现计划 docs/superpowers/) → executing-plans(inline,Playwright bbox 验证 + CDP 0错误)。pw world 比例测被 height 归一/贴地动态干扰，改用骨架 size 几何比例 + 视觉确认
- **改动文件**: `models/humanoid_config.js`(三骨架+setBone+沙漏+Wedge pelvis+下摆+curves) + `model_factory.html`(buildWedge+buildTaperedHex+createGeometry Wedge case+贴地排除臂+变体onchange curves) + `models/enemies.js`(createGeometry 补 TaperedBox/TaperedHex/Wedge+createCampusZombie 教师固定) + `js/campus_spawner.js`(教师身高固定) + 文档
- **已知问题(新)**: 校园丧尸部件暂不支持工厂「选中调参+保存」（像六足战车那样），后续做

---

## v0.79.4 本次会话变更 (2026-08-04)

### 训练场手动模式 fps 崩根因修复 + 弹道线/瞄准零分配（性能专项）

用户报告：04a/金福园小学性能异常低下 + 训练场 t34 手动操控一段时间后 fps 崩到个位数（AI 托管正常 160+）。经 systematic-debugging 全流程定位 3 个独立根因：

- **根因1（主因，训练场手动崩）**: `updateAiming` 的 `aimTargets = _filterAimTargets(obstacleMeshes)` —— `_filterAimTargets` 在 `_fadedGroups` 空时**直接返回原数组**（v0.78.2 校园半透明特性引入）→ `aimTargets === obstacleMeshes` → 敌人循环 `aimTargets.push(en)` **每帧把敌方坦克 push 进 obstacleMeshes** → 数组线性暴涨（实测 535→1707，每帧 +1）→ 弹道线/瞄准/MG 的 raycast 目标线性暴涨 → 每帧开销线性涨 → fps 崩。**手动模式 updateAiming 每帧跑 → 崩；AI 托管跳过 → 不崩**（完美解释用户观察）。修复：`.slice()` 拷贝。定位方法：`Array.prototype.push` 钩子（addInitScript 早于引擎脚本）抓 push 调用栈 → `updateAiming:1635`
- **根因2（控制台 TypeError）**: 敌方炮弹命中玩家碰撞体 → `CollisionSystem.raycastShell` 返回 `csHit.unit = player1`（手动模式 player1 是包装对象**无 position**，AI 托管挂兼容接口才有）→ 误调 `onEnemyDamaged(player1)` 把玩家当敌人扣血 + 玩家残血后 `en.position.x` 抛 TypeError → 每帧 try-catch 中断 gameLoop（v0.66.0 碰撞体系统引入）。修复：`csHit.unit === player1` 分支走正确玩家受伤路径（hp 扣减 + `_killPlayerInTraining`）
- **根因3（04a/金福园卡）**: `updateTrajectoryLine` 每帧 `dispose + new BufferGeometry` + 70×`new Vector3` + `prev.clone()`（60fps 每分钟 ~27 万对象）→ 老生代 GC 负担逐帧累积 → fps 单调下降（真机 4 分钟长跑 30.9→14.6 验证；禁几何重建后 21.6→29.1 回升）→ 修复：**零分配**（模块级 `_trajArr` Float32Array 预分配 + `_trajPrev/_trajTmp/_trajSeg/_trajHit` 复用 + 几何只更新 `setDrawRange`/`needsUpdate` 不重建 + `setDrawRange` 渲染）+ 敌人圆柱检测替代 780 子 mesh 递归 raycast + 障碍物 150m 距离过滤 + `_trajRc` 复用
- **瞄准优化**（同根因延伸）: 丧尸射线-圆柱检测替代整 mesh 递归 raycast（校园图 30 丧尸×26 子 mesh = 780 目标，16ms/帧）+ `_aimV2d/_aimP/_aimD/_aimW/_aimDir/_aimCamDir/_aimQ/_aimRc` 零分配
- **验证**: 训练场手动交战 2 分钟 **fps 10-29 → 168-180 稳定**，obstacleMeshes 恒定 24，combat 阶段 42→0.35-0.67ms，gameLoop error 0；04a 弹道线 57→7ms；三图 0 错误
- **方法论沉淀**: ① headless rAF 被软渲染钳制 4fps + 后台节流 → 帧时间不可用，必须**有头 + 真 GPU（RTX 5060）+ 反节流参数**（`--disable-renderer-backgrounding` 等）长跑复现；② 游戏内置 `perfDisplay`（物理/战斗/更新/渲染 4 阶段探针）直接定位 combat 段暴涨；③ `Array.prototype.push` 钩子抓数组污染调用栈；④ 阶段对比（T1 vs T2 profile）看增长热点
- **改动文件**: `js/engine.js`（aimTargets slice + 玩家碰撞分支 + 弹道线零分配重写 + 瞄准零分配 + 丧尸圆柱）+ index/README/CLAUDE/CODEBUDDY/trae（版本同步 v0.79.4）
- **已知问题（新）**: 无。弹道线/瞄准零分配后与虎式时期（v0.65.13）idle 性能相当（165 vs 174fps）

---

## v0.79.3 本次会话变更 (2026-08-03)

### 校园丧尸人形精修（白模修复 + 衣物联动 + 步态 + 裙锥形化）

- **首次切换白模修复**(`model_factory.html`): `MODEL_CONFIGS.humanoid` 初始 = `HUMANOID_BASE`(model_configs.js:680, 纯骨架白模), 切模型/autoLoad 只调 rebuildModel 不触发变体构建 → **rebuildModel 入口守卫**: 配置树无 `_params`(buildHumanoid 标记)时自动 buildHumanoid(当前变体+参数); height 归一(1.4/1.3)从 \_applyHumanoidEdit 移入 rebuildModel humanoid 分支统一执行
- **衣物随 build 联动**(`humanoid_config.js`): WRAP_ADDONS 表驱动——包裹衣物尺寸 = 派生后肢体半径 + 固定间隙(袖口 0.01/短裤裤 0.03/裙腰 0.02/裙摆 0.34~0.41), build 0/0.5/1 全档间隙恒定不穿模; 裙 = **锥形 Cylinder**(腰口细 gap 0.02 被上衣盖住→pelvis 不 grow 与 torso 协调; 裙摆按 Run 极限表面位移 `√(0.13²+(摆长×sin0.8)²)+腿半径` 覆盖)
- **上衣下摆包裹保证**: pelvis 半宽/深 = max(原值×_bF, 裤裙半宽+0.02) **单向联动**(build 大增宽, 小不回缩防收窄破怀); torso 完全不动(校徽/条纹/领带挂件贴前表面, 增厚会被吞)
- **男教师长裤**: 原裤高 0.5(≈47cm 短裤感)→ 拆**大腿段**(挂 l_upper_leg pivot, 高 0.6)+**小腿段**(trousers_grey_calf 挂 l_lower_leg pivot, 高 0.7)盖到脚踝; DUAL_LEG_ADDONS 双挂左右腿(Box 中心 x=0 无需镜像); 裤腿随髋摆/膝弯
- **步态方向修正**(`humanoid_factory.js`): Three.js 绕 X 轴 rotation.x>0=后蹬/负=前踢——原关键帧方向写反(后蹬写 -0.6 实为前踢)→ Walk 后蹬 +0.6/前踢 -0.25, Run 后蹬 +0.8/前踢 -0.35, 膝弯清障 -0.6/-0.7, 对侧摆臂 ±0.35/±0.5
- **展台沉地修复**: pelvis.position.y 关键帧绝对赋值 0(骨盆 0.375 砸地) → REST_POSES 加 `'pelvis:y': 0.375` + Idle/Walk/Run 三轨改 restKey 偏移; updateAnimShowcase 对 humanoid **每帧动态贴地**(position.y = -bbox.min.y, Die 躺倒/切换全贴地); Die 一次性播放停留 1.5s 回待机(humanoid index 5 与六足 22 同分支)
- **resetState 全关节复位**(`humanoid_factory.js`): Die 改过的关节(torso x/arm z)在 Idle 无 track 残留变形 → 全 pivot rotation 复位到 REST 基线后 collectRefs
- **女生裙比例**: 裙腰口对齐衣服下摆(pelvis 局部 0.175 内, torso 底沿衔接)、裙摆上移露小腿(学生摆 -0.25 → 露 0.62 单位, 教师摆 -0.35 → 露 0.52)
- **改动文件**: `model_factory.html`(+58/-) + `js/humanoid_factory.js`(+121/-) + `models/humanoid_config.js`(+150/-) + index/README/CLAUDE/CODEBUDDY/trae(版本同步)
- **验证**: Playwright 全链路(首次白模 12 断言 / 包裹矩阵四变体×build 12/12 / 关键帧方向 / 展台贴地 7/7 / Die 复位 / 裙 Run 极限覆盖 10/10 / 男教师长裤) + 游戏校园地图 0 错误
- **执行方式**: 主 session 内联(systematic-debugging 流程, 逐问题根因→修复→验证)

### 已知问题（新增）

1. 裙摆边缘与大腿的临界重叠在 Run 极限(0.8rad)下余量 0.025~0.028(已数学覆盖, 动态中不可辨)
2. `ah_sh_l` 命名冲突: 短裤裤腿与鞋(shoes_blue/white/leather_shoes)同名, findNode/getObjectByName 取第一个——测试需用 \_addonKey 或关节子树定位(渲染无影响)

---

## v0.79.2 本次会话变更 (2026-08-01)

### 校园丧尸校服精修（P6，feature/campus-zombies-p6 → master）

- **Sphere thetaLength 支持**(两侧 createGeometry): `models/enemies.js` buildHumanoidRig 的 `case 'Sphere'`（锚点 `const s = node.segments || [8, 6]`）+ `model_factory.html` createGeometry 的 Sphere case，加 `node.thetaLength != null ? node.thetaLength : Math.PI`（默认 π 全球，向后兼容）。**只改 buildHumanoidRig**，不碰 enemies.js 另两处 Sphere（L515 createZombie / L1669）
- **头发半球 + 女生发型 base**(`humanoid_config.js`): `short_hair_m` ah_m Sphere 加 `thetaLength: Math.PI/2`（真半球，扣头顶不再全球没入；读码发现已是 Sphere r=0.22 非 spec 假设的 Box）；`student_f`/`teacher_f` addons 在 ponytail_f/bun_f 前加 `short_hair_m`（马尾/发髻在半球头发 base 上，非光头）
- **hips 几何修复**(`humanoid_config.js`，用户指出): 居中球（position z=0）→ 后侧扁椭球（`position:[0,-0.02,-0.1]` 后移 + `scale:[1,0.85,0.55]` X胯宽/Y臀扁/Z前后浅）；curves 放大（`scaleGroup(clone, 0.6+curves*0.8)` uniform）保持 X>Y>Z 比例，后侧凸、前侧（z 正）因 scale 0.55 压扁基本不凸。修复"前后两侧同时膨大"不合理问题
- **工厂 Canvas 贴图**(`model_factory.html`): `getMaterial` 加 `createHumanoidTextures()`（复刻 `enemies.js:createHumanoidMaterials` 的 4 张 Canvas：polo 1200 珠地点/skin 400 斑点+6 暗斑/badge 绿树 3 圆+树干+橙"金福园小学"+YaHei fallback/stripes 红粉绿 4 斜条）+ `MATERIAL_DEFS` 的 polo_white/skin_zombie/school_badge/shoulder_stripes 加 `map` 字段 + `getMaterial` 命中 `def.map` 时把字符串 key 转 CanvasTexture。与游戏两侧统一
- **改动文件**: `model_factory.html`(+119) + `models/enemies.js`(+2) + `models/humanoid_config.js`(+13) + spec/plan 文档 + index/README/CLAUDE/CODEBUDDY/trae(版本同步)
- **验证**: Playwright teacher_f 截图（发髻在头发 base + 胸前凸 + **臀后凸/前侧不凸** hips 修复视觉确认）+ student_m canvas 像素（珠地 33% 非白/校徽 16% 彩色/斜纹 22% 彩色/skin 暗斑）+ 全程 review Approved + 0 错误
- **执行方式**: subagent-driven（Task 1-4 各派 sonnet implementer + reviewer Approved；Task 5 验证 controller 自做）

### 已知问题（新增）

1. P6 贴图在 headless 截图（低分辨率）下不可辨（珠地点 sub-pixel / 校徽 0.07 单位几像素）；用户浏览器高分辨率 + 近看可见（canvas 像素内容已确认正确）
2. 头发半球 thetaLength=π/2 是上半球（头顶以上），头侧覆盖度有限——必要时微调 thetaLength（如 π/2+0.3）或 Group position y

---

## v0.79.1 本次会话变更 (2026-07-31)

### 校园敌人放置工具页（P5，feature/campus-zombies-p5 → master）

- **`tools/enemy_marker.html` 新建**(~700行, fork `tools/toilet_zone_marker.html`): 校园敌人放置工具页。7 类型敌人圆点 CRUD（student_m/student_f/teacher_m/teacher_f + assault/zombie/hexapod，色块图标）+ 视野虚线圈（viewDist 半径）+ 巡逻折线（patrolPath）
- **行为面板**(剥自 `map_editor.html:1064-1102` + `editor_entities.js:442-587`，去批量): 8 字段（HP/速度/视野/攻击伤害/攻击冷却/掉落概率/回血量/击杀得分）+ 3 模式按钮（reactive/aggressive/none），选中敌人时回填+写入**扁平字段**
- **巡逻点编辑**: 巡逻模式按钮切换，点击画布给选中敌人加巡逻点（橙色折线+序号点），清除按钮
- **刷新配置面板**: enabled/initialCount/interval/batch/cap + 4 比例（student_m/f/teacher_m/f）+ 门提取（`extractDoors` 复制自 `campus_spawner._extractDoors` corridor 边中点）+ 门圆点可视化拖动
- **保存**: POST `/api/solidify {type:'enemies', enemies, spawnConfig}`（server.py L195-199 整体替换）。落盘格式：**扁平 enemy**（hp/speed/.../reactive/aggressive 直接挂根，**不套 cfg**）+ `position:[x,y,z]` 3 元数组 + `patrolPath:[[x,z],...]` 二元组 + `spawnConfig.doors:[[x,z],...]`
- **游戏零改动**: `createEnemies`(P1) + `campus_spawner`(P3) 已消费 `enemies` + `spawnConfig`，本 plan 零改动 engine.js/campus_spawner/enemies.js
- **暴露**: `enemies`/`campusData`/`spawnConfig`/`newEnemy`/`saveEnemies` 到 window（CDP/测试，loadCampus 末尾 fresh）
- **执行方式**: 用户选内联执行（P5 单文件 fork，task 耦合高）；一次建完工具页（Task 1-4 合并）+ Playwright 端到端验证（Task 5）
- **改动文件**: `tools/enemy_marker.html`(新) + `docs/superpowers/plans/2026-07-31-campus-zombies-p5-enemy-marker.md`(plan) + index/README/CLAUDE/CODEBUDDY/trae(版本同步)
- **验证**: Playwright 放 teacher_f+hp150+巡逻2点+cap40 → 保存 → 重载确认(savedHp150+savedPatrol2+savedPos[8,0,8]+scDoors6)；截图视觉确认(底图+敌人圆点+视野圈+蓝色门方块+7类型按钮+行为面板+刷新配置+敌人列表)；0 控制台错误

### 数据格式（消费者同步）

- `campus.map.json` 顶层 `enemies[]`：扁平字段（不套 cfg）+ `position[x,y,z]` + `patrolPath[[x,z]]`（工具页写入；createEnemies/campus_spawner 消费）
- `campus.map.json` 顶层 `spawnConfig{}`：enabled/initialCount/interval/batch/cap/ratio/doors（doors 由工具页 extractDoors 提取落盘；之前无 doors 走 campus_spawner.\_extractDoors 兜底）
- 消费者: `js/engine.js`(createEnemies) + `js/campus_spawner.js` + `tools/enemy_marker.html`(读写) + `server.py`(solidify_campus enemies 分支)

### 已知问题（新增）

1. 工具页测试保存会写 campus.map.json（P5 验证后已 git checkout 恢复 P1 测试数据；用户首次用工具页配置真实数据后落盘）
2. 门位置用 corridor 边中点近似（spawner 实际 ±1.25m 随机扰动，中点足够；精确"每间教室一扇门"留后续，参考 obstacles.js:912-944）

---

## v0.79.0 本次会话变更 (2026-07-28)

### 校园丧尸模型工厂接入（P4，feature/campus-zombies-p4 → master）

- **`js/humanoid_factory.js` 工厂展台桥接**(新建~210行): 自包含6动作(Idle/Walk/Run/Attack/Stagger/Die)+keyframe lerp+REST_POSES偏移, 镜像 `enemies.js:createHumanoidAnimationSystem`(工厂页**不加载**enemies.js故自包含; spec非目标"不做跨模型共享动画库"允许关键帧镜像)。暴露 `window.HumanoidAnims`(names/durations/directions/turnRates/categories/collectRefs/updateFrame/resetState/destroyPivots/restorePlates) 接口与 `HexapodAnims` 同构(+categories 供 `_buildAnimList`)
- **工厂6项接入**(`model_factory.html`): ①`createGeometry` 加 `case 'Plane'`(校徽/斜纹 addon 用 type:'Plane',不加则 default return null 渲染报错——**硬阻塞**) ②加载 humanoid_config.js 脚本(hexapod_config 后) ③MODEL_CONFIGS 加 humanoid entry+getter(`models/model_configs.js`) ④modelOptions 加 `'🧟 校园丧尸':'humanoid'` ⑤rebuildModel 人形贴地(仿 hexapod bbox.min.y) ⑥MATERIAL_DEFS 补20个人形 materialId 纯色(polo_white/skin_zombie/eye_glow 等, Canvas 贴图留 P6) ⑦getModelAnims 加 `humanoid: window.HumanoidAnims||null` ⑧`_buildAnimList` `categories=(ma.categories)||[默认]`(hexapod 无 categories 走 fallback 零回归)
- **体型参数 GUI(工厂新能力)**: buildGUI 加「🧍 体型参数」文件夹, 变体下拉(student_m/f+teacher_m/f)+height/build/hunch/curves 滑块; `_applyHumanoidEdit` 调 `buildHumanoid(variant,params)` 重建 MODEL_CONFIGS.humanoid+rebuildModel(穿校服实时预览); 暴露 `window._applyHumanoidEdit`
- **solidify humanoid 单变体固化**(`server.py`+`model_factory.html`): 新增 `_find_variant_bounds(text,parent_const,variant_key)` 嵌套定位(先 `_find_config_bounds` 定位 HUMANOID_VARIANTS 顶层块→块内正则找 variant_key:→数括号匹配); `solidify_config` 解析 `humanoid:variant` 后缀; `_doSave` 人形分支发 `{modelType:'humanoid:'+variant, config:HUMANOID_VARIANTS[variant]}`。**修正 spec 5.5 误判**——`_find_config_bounds` 只认顶层 const, 嵌套 variant 需新 helper
- **rebuildModel window.modelRoot fresh 修复**: 原 `window.modelRoot=modelRoot`(L4660 一次性赋值)在 rebuildModel 换引用后 stale; 在 rebuildModel 开头加 `window.modelRoot=modelRoot`, 每次 rebuild 保持 fresh(humanoid_factory.collectRefs 依赖; hexapod 也受益)
- **执行方式**: Task1 用 subagent(sonnet)+reviewer Approved; Task2 起因 **Claude API 周/月限额 429**(限额 2026-07-28 10:51 重置)改主 session(glm-5.2)内联执行(executing-plans 模式), 每 task CDP/Playwright 验证 0 错误
- **改动文件**: `js/humanoid_factory.js`(新) + `model_factory.html`(+106) + `models/model_configs.js`(+humanoid entry; prettier 膨胀 700 行语义零变更) + `server.py`(+42) + index/README/CLAUDE/CODEBUDDY/trae(版本同步)
- **验证**: Playwright 切人形→穿校服(校徽 ah_badge+红领巾 ah_sc_knot)→动画展台6动作5分类→变体切女教师(胸 ah_bust_l+裙 ah_gskirt)→固化(server 200+字段完整+buildHumanoid 仍工作); 截图视觉确认(白Polo+红领巾+灰绿皮肤+972tris+体型GUI); 0 控制台错误全程
- **关联(P1-P3 文档滞后补记)**: `models/humanoid_config.js`(P1,基骨架+变体+buildHumanoid) / `js/campus_spawner.js`(P3,定时门刷新) / `models/enemies.js` createCampusZombie+createHumanoidAnimationSystem(P1) 文件结构段未逐行补, 见各 plan 文档

### 已知问题（新增/更新）

1. humanoid_factory 关键帧与 enemies.js createHumanoidAnimationSystem 镜像(两份独立, 改动作改两处; Z 档统一)
2. model_configs.js prettier 膨胀 36→700 行(语义零变更, reviewer 程序验证; 可加 .prettierignore 恢复紧凑)
3. Die 动画 root.position.y 偏移可能穿地(工厂预览可接受, resetState 复位)

---

## 历史变更（已归档）

v0.78.4 及更早的会话变更已移至 `docs/CLAUDE_history_archive.md`（2026-08-08 瘦身，原 83k 字符超 40k 限制）。完整原文备份：`docs/CLAUDE.md.bak`；git log 同样保留全部历史。
