# CLAUDE.md

3D 坦克对战游戏 — Three.js r160 浏览器游戏 + 地图编辑器 + PvE 战斗 | v0.79.8

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
