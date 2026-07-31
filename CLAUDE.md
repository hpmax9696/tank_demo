# CLAUDE.md

3D 坦克对战游戏 — Three.js r160 浏览器游戏 + 地图编辑器 + PvE 战斗 | v0.79.1

## 运行

```bash
python server.py
```

访问 `http://127.0.0.1:8080`（必须 127.0.0.1，禁止 localhost）

`server.py` 提供静态文件服务 + `/api/solidify` 固化端点（模型工厂 Ctrl+S 直接写源文件）。

提供 `preview_url` 前：先杀残留 Python 进程，再启动单一服务，确认就绪后才调用。

## 文件结构

```
├── index.html         # 核心游戏框架 (~1047行)：UI框架+菜单+脚本加载
├── js/engine.js        # 游戏引擎 (~7631行)：状态机/场景/物理/瞄准/摄像机/AI/训练场/狙击
├── js/                # 游戏模块（12个）
│   ├── waters.js      # 水体模块 (~326行)：池塘水面+河流alphaMap遮罩平面+碰撞体+动画
│   ├── bridges.js     # 桥梁模块 (~165行)：编辑器桥+参数化桥+碰撞检测+可视化
│   ├── debugcolliders.js  # 碰撞可视化 (~122行)：F3切换(默认关)，从运行时数据反向生成
│   ├── obstacles.js   # 环境对象 (~878行)：树木/建筑/InstancedMesh管理
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
├── model_factory.html # 程序化模型编辑器 (~4758行)
├── models/            # 模型文件 (GLB主力 + 程序化兜底)
│   ├── enemies.js     # 敌方单位模型 (~1324行)：装甲突击车+程序化丧尸
│   ├── t34_v16_builder.js # T-34/85 v1.6 坦克构建器 (~1441行)：\_TANK_PROFILE 共享动画框架
│   ├── tiger_v16_builder.js # 虎式 I 坦克构建器 (~904行)：MG34+马蹄形炮塔+沙漠迷彩
│   └── buildings.js   # 建筑模型 (~385行)：3种建筑+category分类+阴影
├── server.py          # 开发服务器 (~145行)：静态文件 + POST /api/solidify 固化端点
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

## v0.78.4 本次会话变更 (2026-07-25)

### 校门系统 + hpBar 修复

- **校门模型 createGates**(`js/obstacles.js`): 每门 gateGroup(门柱0.6×4.5m砖红 + 门头横梁CanvasTexture校名"金福园小学" + 双扇铁栅门紧闭对开2.5m深灰金属 + 黄黑斜纹警戒带1m×2条 + "禁止出入"立牌0.8×1.2m红圈图标); CanvasTexture辅助(\_makeGateNameTex/\_makeTapeTex/\_makeSignTex); type='wall' polygon不可摧毁 + \_registerCampusBuilding半透明 + 子mesh入\_campusBuildings炮弹命中
- **工具页 gate_marker.html**: 照搬planter_marker框架; snapToBoundary(点击→最近boundary边投影+ry=atan2(-ez,ex)边方向+Z朝外); 宽度滑块4-15m + 旋转滑块-180~180°(每门独立); 保存POST /api/solidify {type:'gates'}
- **draw旋转语义**: Three.js Ry(x'=x cos+z sin, z'=-x sin+z cos)统一(createGates rotation.y顺时针, 工具页draw改同向); hitZone用Ry逆(world→local)
- **围墙开口裁剪**: createBoundaryWalls(targetScene,boundary,gates) gateSkip算每门最近边+t范围; 段[t0,t1]被门裁剪(画门外部分), 开口精确=门宽, 墙段端紧贴门柱(替代v0.78.3整段跳过致开口过大)
- **server.py**: solidify_campus + do_POST白名单加 gates 分支
- **数据**: `campus.obstacles.gates=[{cx,cz,width,ry,name}]`; 消费者 obstacles.js(createGates) + gate_marker.html + server.py
- **hpBar修复**: enterGame(engine.js:7107) `hpBarGroup.visible=false`误设(应true) → 单人模式血条消失; reloadBar(7106)true正常; 拦截visible setter定位enterGame设reloadBar true但hpBar保持初始false; 7107改true
- **改动文件**: `tools/gate_marker.html`(新) + `js/obstacles.js`(createGates+createBoundaryWalls裁剪) + `server.py`(gates分支) + `maps/campus.map.json`(gates字段) + `js/engine.js`(hpBar 7107)

## v0.78.3 本次会话变更 (2026-07-25)

### 花坛可被炮弹整体摧毁

- **根因**: createPlanterZones obstacleData `height=WALL_HEIGHT(0.5)` 只墙高 → 炮弹打树木上部(y>0.8)超 `obsTopLimit` 跳过圆柱 → 穿过; 且无 `groupRef` → 摧毁逻辑不触发; 共享几何(ringGeo/soilGeo/TreeModels)不能 dispose
- **修复**: obstacleData `height 0.5→5`(含树木, 炮弹打任意部位命中圆柱) + `groupRef=planterGroup` + `hideOnly=true`; 摧毁逻辑 `od.hideOnly → visible=false` 软删除(不 dispose 共享几何, 同球门做法)
- **实测**: 12 花坛 height=5+hideOnly+groupRef, visible 可控, 0 错误
- **改动文件**: `js/obstacles.js`(createPlanterZones obstacleData) + `js/engine.js`(炮弹摧毁逻辑 hideOnly 分支)
- **新增 obstacleData 字段**: `hideOnly`(布尔, 摧毁时 visible=false 不 dispose 共享几何)

## v0.78.2 本次会话变更 (2026-07-25)

### 相机建筑遮挡半透明（替代前移避障）

- **移除前移避障+纯半透明**: placeCamera移除前移避障(几何反馈循环: 原位命中→前移→新射线边界不命中→回原位→振荡→"边缘角度"现象); 改为整栋建筑半透明(opacity 0.35); 相机不动→命中集稳定→无闪烁。小地图 `_hullOccluded = 命中集非空`
- **setBuildingFade**: `window.setBuildingFade(group, opacity)` 按材质 uuid 去重 clone(`transparent+DoubleSide+depthWrite=false`); DoubleSide 解决相机穿入建筑内 FrontSide 背面剔除(墙消失附件浮空); 首次 clone 缓存后续零开销; 支持材质数组 `[wallMat, roofMat]`
- **墙mesh纳入bldGroup**: 墙mesh(campus-bld)原本直接 `targetScene.add` 不在 bldGroup(campus-bld-detail)→fade 漏墙 + 射线 `intersectObjects(bldGroup树)` 检测不到墙(完全被挡无半透明/墙消失附件浮空); 纳入 bldGroup(清自身变换, bldGroup 提供同变换 `rotation.x=-PI/2 + stiltY`)
- **围墙/天桥/B7纳入**: `_registerCampusBuilding(obj)` 辅助函数标记 `_isCampusBuilding` + push `_campusBuildingGroups`; 4 处调用(体育馆壳 `_shellMesh` / B7拱顶 `_domeGrp` / 天桥 `_bmesh` / 围墙 46 段); 实测 56 建筑对象全标记
- **placeCamera半透明状态机**: 降频 150ms 射线 `intersectObjects(_campusBuildingGroups, true)` recursive; 命中 mesh 沿 parent 链找 `_isCampusBuilding` Group; diff 命中集(新增 fade 0.35 / 移除恢复 1)
- **小地图闪烁修复**: placeCamera 原每帧开头 `_hullOccluded=false` 但检测每 150ms→非检测帧(约9帧) false 导致小地图每 150ms 闪; 改为只在检测帧更新, 非检测帧保持上次值
- **半透明时瞄准穿透**: `_filterAimTargets(arr)` 过滤 `_fadedGroups`(当前半透明建筑)+parent 链; updateAiming + 狙击/六足两处替换; 半透明时瞄准射线穿过半透明建筑命中后面目标; 非半透明时 `_fadedGroups` 空返回原 arr(零影响)
- **新增数据结构/全局**: `window._campusBuildingGroups`(建筑顶层对象列表); `window._registerCampusBuilding(obj)`; `window.setBuildingFade(group, opacity)`; engine.js 模块级 `_fadedGroups`(Set) / `_lastOccluCheck` / `_OCCLU_INTERVAL=150`
- **改动文件**: `js/engine.js`(placeCamera 移除前移+半透明状态机+`_filterAimTargets`) + `js/obstacles.js`(`_campusBuildingGroups` 初始化 + `setBuildingFade` + `_registerCampusBuilding` + 墙mesh 纳入 bldGroup + 4 处标记)

## v0.78.1 本次会话变更 (2026-07-25)

### 厕所碰撞体点变换 + 炮弹递归命中修复

- **厕所碰撞polygon点变换**: 盒变换(`Box3.applyMatrix4` 对轴对齐盒旋转取 8 角 AABB 会膨胀)→点变换(8 角逐个 `applyMatrix4`); 修复旋转楼体进深 5.5m→20.38m(3.7 倍); 实测进深 20.38→6.94m 贴合墙体, 每侧少挡 6.7m
- **炮弹Raycaster递归**: `intersectObjects(_cb, false)`→`true`; 修复厕所以 Group(无 geometry)入 `_campusBuildings` 时非递归不命中→炮弹穿楼无飞溅/焦痕/地面音效; 命中后 spawnFragments+spawnHitSparks+playGroundHitSound+spawnWallScorchMark
- **改动文件**: `js/obstacles.js`(厕所碰撞polygon点变换) + `js/engine.js`(炮弹 Raycaster recursive)

## v0.78.0 本次会话变更 (2026-07-20)

### 校园架空层与车棚碰撞体修复 + 厕所天桥碰撞 + HE溅射守卫 + 焦痕修复

- **架空层碰撞修复**: `checkCollision` 增加 `minY` 高度感知（地面高度<minY时跳过polygon/box，仅柱子cylinder阻挡）。教学楼 B5 obstacleData 增加 `minY: _stiltY`（=3m），架空层柱子增加 obstacleData 条目（r=0.35, type='wall'）
- **车棚碰撞修复**: 四角柱 obstacleData（r=0.28, type='wall'），拱顶 mesh 入 `_campusBuildings`（炮弹 Raycaster 命中）。从体育馆 polygon 挖除车棚区域（`holes` 字段 + point-in-hole 射线法检测）
- **B7 室内运动场碰撞**: 拱顶壳+端盖+8面墙共11子mesh入 `_campusBuildings`，炮弹可命中 dome 墙壁
- **厕所碰撞修复**: 抛弃不存在的 `insertObstacle`，用 `inst.matrixWorld` 逆变换计算紧致局部 AABB → 世界空间旋转矩形 polygon。厕所 mesh 入 `_campusBuildings`
- **天桥碰撞修复**: mesh 入 `_campusBuildings`（坦克仍可从桥下穿行，无 obstacleData）
- **HE 溅射不可摧毁守卫**: 补充 `if (od.polygon || od.box || od.type === 'wall') continue;`（v0.67.1 声称已添加但代码缺失，本次实测修复）
- **墙面焦痕修复**: Raycaster `face.normal` 从局部空间经 `hitObj.localToWorld` 转世界空间后调用 `spawnWallScorchMark`
- **调试可视化**: F9 键切换厕所碰撞体半透明红色显示（footprint 填充面+轮廓线+四角高度柱）
- **改动文件**: `js/engine.js`(+35行) + `js/obstacles.js`(+120行)

### 碰撞体审查完整结论

| 实体           |   坦克碰撞    |   炮弹碰撞   | 瞄准线 |  可摧毁   | 状态                        |
| -------------- | :-----------: | :----------: | :----: | :-------: | --------------------------- |
| 教学楼B5架空层 |   ✅ 仅柱子   |      ✅      |   ✅   |    ❌     | minY+柱子cylinder           |
| 车棚           |  ✅ 仅四角柱  |   ✅ 拱顶    |   ✅   |    ❌     | holes挖除+柱子cylinder      |
| B7室内运动场   |    ✅ box     |  ✅ dome墙   |   ✅   |    ❌     | 11子mesh入\_campusBuildings |
| 厕所           |  ✅ polygon   | ✅ Raycaster |   ✅   |    ❌     | matrixWorld逆变换polygon    |
| 天桥           | ❌ 穿行(设计) | ✅ Raycaster |   ✅   |    ❌     | 入\_campusBuildings         |
| HE溅射守卫     |      N/A      |     N/A      |  N/A   | ✅ 已保护 | polygon/box/wall continue   |

### 新增数据结构

- `obstacleData[i].minY`: 可选，地面开口高度。`checkCollision` 中 `getGroundHeight(x,z) < minY` 时跳过 polygon/box
- `obstacleData[i].holes`: 可选，`[[x,z],...][]` 挖除多边形数组。点在 hole 内时跳过碰撞
- `window._toiletDebugGroups`: F9 厕所碰撞体调试可视化 Group 数组

## v0.77.0 本次会话变更 (2026-07-20)

### 法国梧桐树丛打点系统（工具页 + 精细模型 + 3D 渲染）

- **工具页**: `tools/tree_marker.html`(新~320行) 点击打点放置梧桐树丛标记（绿三角树形图标+虚线集群范围5m半径），框架照搬 planter_marker（canvas + w2c/c2w + 点选/拖拽/删除/保存）
- **精细模型**: `models/plane_tree.js`(新~260行) 法国梧桐(Platanus × acerifolia) 程序化4组件模型 — 树干(CylinderGeometry+正弦噪声模拟树皮)+5主枝+5二级枝辐射排列+70+椭球5层宽穹顶树冠(~2500三角)+3-5对悬挂种子球
- **3D 渲染** (`js/obstacles.js` createTreeZones ~105行): 每个 zone 生成 3-5 棵树（半径5单位内随机撒点），InstancedMesh(4IM: 树干+树冠+细节+阴影代理)，碰撞注册(type='plane_tree', r=0.3)，disposeTreeInstance 扩展 imDetail
- **server.py**: solidify_campus + do_POST 新增 `treeZones` 类型分支
- **数据格式**: `campus.obstacles.treeZones = [{cx, cz}, ...]`

### 厕所前墙窗户

- **models/buildings.js** `createToiletWindows()`(~35行): 男女厕前墙(Z_FRONT面)各一行窗户，贴面不挖洞(框#555+玻璃#bcd4e6)，polygonOffset 防 z-fighting，离墙 0.08/0.10

### 改动文件

- `tools/tree_marker.html`(新) + `models/plane_tree.js`(新) + `js/obstacles.js`(+105) + `server.py`(+6) + `models/buildings.js`(+35) + `maps/campus.map.json`(+1) + `index.html`(+1)

## v0.76.0 本次会话变更 (2026-07-20)

### 花坛打点系统（工具页打点→地图保存→3D渲染）

- **新工具页**: `tools/planter_marker.html` 点击地图放置花坛圆形标记（ø2m），支持拖拽移动/Delete删除/保存到地图。框架照搬 toilet_zone_marker（canvas + w2c/c2w 坐标变换 + 校园底图渲染）
- **数据格式**: `campus.obstacles.planterZones = [{cx, cz}, ...]`，简单位置数组（花坛固定尺寸无需 w/d/ry）
- **3D 渲染** (`js/obstacles.js` createPlanterZones ~80行): 每个花坛 = 环柱墙（Shape+Path 孔洞→ExtrudeGeometry，ø2m×高0.5m×壁厚0.3m，#c0b8a8 混凝土）+ 泥土圆盘（CircleGeometry，棕色 #8B6914）+ 中心树木（复用 TreeModels.spherical 共享几何，scale≈3.85→5m高）。碰撞体重接 push 进 obstacleData（r=1.0 圆柱，坦克不可穿过）
- **server.py**: solidify_campus + do_POST 新增 `planterZones` 类型分支
- **改动文件**: `tools/planter_marker.html`(新建) + `js/obstacles.js`(+80行) + `server.py`(+5行) + `maps/campus.map.json`(新增空 planterZones 字段)

### 数据格式变更

- 新增字段: `campus.obstacles.planterZones = [{cx, cz}, ...]`
- 消费者: `js/obstacles.js`(渲染+碰撞) + `tools/planter_marker.html`(加载/保存)

---

## v0.75.0 本次会话变更 (2026-07-20)

### 二层厕所楼完整重构（独立 HTML 模型移植）

- **新模块移植**: 从独立 Three.js HTML 模型(v8加宽)完整移植 `createToilet` 函数(~500行)
- **结构**: 楼梯间(4m,双跑并排) + 洗手区(3.5m) + 厕所(~18m), 层高3m×2
- **双跑楼梯**: 两跑平行并列(同Z起止), 中间楼梯井; 9级×2跑, 休息平台+梁柱+F2出口楼板
- **配套设施**: 每层洗手台+3水龙头+镜子; 厕所蹲位隔间+蹲便器+水箱(前后墙双排); 一楼小便池
- **SVG 标志**: Canvas2D 重绘男(蓝底)/女(红底)图标, 贴洗手-厕所隔墙门旁
- **栏杆系统**: 楼梯扶手(四元数对齐斜面)+F2前脸栏杆+F2楼梯洞口栏杆+平台栏杆
- **坐标系**: 内部前=+Z, innerG.rotation.y=π 旋转对齐游戏约定(前=-Z)
- **尺寸调整**: 进深7→5.5m(后墙缩进,innerG.z偏移)+向篮球场平移1.7m

### 篮球场纹理升级

- **蓝色塑胶底**: 4个篮球场草地(#4A8C3F)→蓝色(#2b6eb3); 足球场不变
- **红色区域**: 中圈+罚球区矩形涂红(#c8332b); 罚球圈(半圆)不涂红——白线覆盖于红色之上
- **新增辅助函数**: `_fillRect`/`_fillCircle` (场地坐标→canvas填充)
- **改动文件**: `js/sportsFields.js`(~35行变更)

### 数据格式变更

无。

## v0.73.0 本次会话变更 (2026-07-19)

### 球场标线+球门+篮球架（SDD 子代理流程，6任务全绿）

- **新模块 js/sportsFields.js (~400行)**: 按 grounds 名匹配('足球场'/大篮球场*/小篮球场*)接管场地渲染。整场 CanvasTexture(草底平铺+白线0.12u, 缓存key `_courtTexV1<kind>`)+UV重映射(footprint局部归一化, makeMapper统一(long,short)坐标系); polygonOffset -3/-6 全库置顶
- **足球场**: 沿长轴分2子场(各16×23.7u), 各画边线/中线/中圈r2.3/两端禁区7×3/点球点; 4球门(3×2m白框+3片半透明网)在子场端线中点; **双柱碰撞(r0.15)坦克撞门框停**(门宽2.31<坦克碰撞直径2.4, 物理合理), 命中任一柱整门碎
- **篮球场**: 大场5人制(三分r5.2/罚球区3.8×4.4)/小场3人制(r3.4/2.5×2.9)缩小全场; 8篮球架(底座+立柱+悬臂+白底红框篮板CanvasTexture+橙Torus筐), 筐高大2.35u(3.05m)/小2.0u(2.6m); 三分弧心与筐心精确对齐(hoopD=1.425/1.025, armLen扣0.225保3D零回归)
- **engine.js 摧毁增强(2处)**: ①主循环直接命中: parent判空+campus-前缀共享材质dispose保护+兄弟碰撞体联动清理(destroyed+grid.remove+splice) ②HE溅射: destroyed软删除(visible=false不remove, 依托既有destroyed守卫**根治同批命中双柱null.parent崩溃**——该崩溃被gameLoop try-catch吞成僵尸弹极隐蔽)
- **接线**: obstacles.js createGrounds 循环+5行(命名场地转交buildCourt/buildEquipment后continue); index.html +1 script; **零数据格式变更**(按名匹配)
- **碰撞登记**: obstacleData.push直接登记(insertObstacle不存在——createToiletZones的typeof守卫永假, 厕所至今无碰撞体, 已知遗留)
- **验证**: pw_sports_test T1-T5b全PASS(真炮弹端到端摧毁+HE软删除); map01a回归10s零错误DC312; CDP 0错误
- **改动**: js/sportsFields.js(新) + js/engine.js + js/obstacles.js + index.html + docs/superpowers/{specs,plans}

### 厕所标志/高窗修复

- **标志不可见根因**: signFront=-hD+wallT+0.02 在前墙内侧(墙占[-1.0,-0.92], 标志-0.90)被墙挡; 修为 -hD-0.02 贴外墙面
- **标志颜色偏亮**: CanvasTexture 未标 SRGBColorSpace 被当 linear 二次提亮(#1a3a5c→#6090a8); 补 colorSpace
- **标志降高**: signY=wallH\*0.616(≈1.36); 女标志两腿 46/72→51/67 与男标志腿距一致(6px); 纹理缓存key V10→V11
- **高窗嵌墙**: 4扇窗 z=±(hD-wallT/2∓0.01) 在墙体内; 修为 ±(hD+0.01) 贴外墙面, 前墙窗转半圈朝外(FrontSide剔除), 升高 wallH-0.4→wallH-0.25 避开标志
- **改动**: models/buildings.js

### 已知问题（新增/更新）

1. 厕所无碰撞体(insertObstacle不存在, createToiletZones守卫永假)——坦克可穿厕所
2. HE摧毁球门后Group以visible=false残留scene(软删除固有, geometry已回收无泄漏)
3. gameLoop大try-catch把崩溃吞成console.warn(本次HE崩溃靠僵尸弹症状定位, 建议升error级)
4. vs模式摧毁路径预置bug: engine.js:6660 splice用checkObs索引会误删(campus不进vs, 未修)

---

## v0.72.0 本次会话变更 (2026-07-18)

### 厕所区域系统 + 运动场门窗分化 + 车棚柱修复

- **厕所区域系统**: tools/toilet_zone_marker.html(新) 对角线拖拽画矩形+旋转→POST /api/solidify→campus.map.json toiletZones→obstacles.js createToiletZones渲染→models/buildings.js createToilet(rowLen)模型(男厕37.5%+洗手区25%带镜台5龙头+女厕37.5%三连体,对开门+男女Canvas标志牌)
- **运动场门窗分化**: ExtrudeGeometry→拱顶壳(BufferGeometry米白)+墙面板(BoxGeometry,腰线下绿漆#6b8e5a上米黄)+蓝腰线(#4477aa,四面,polygonOffset防z-fighting)+朝桥面1对开门+6高窗+背桥面7高窗+拱端盖(ShapeGeometry)
- **车棚柱修复**: 长宽双向内收(拱跨88%,脊线5%)+柱顶按外侧边缘(圆心+半径)算拱高防刺破+腰线漆面0.02厚贴墙外表面
- **镜子实时反射**: WebGLRenderTarget+每帧反射相机(隐藏镜子本体,天蓝背景),引擎gameLoop中更新
- **厕所标志**: Canvas纹理(CanvasTexture,深蓝圆底+白色男女图标,premultiplyAlpha)+MeshBasicMaterial(transparent+depthWrite:false,贴前墙外表面)
- **改动**: models/buildings.js + js/obstacles.js + tools/toilet_zone_marker.html(新) + server.py + maps/campus.map.json + js/engine.js(反射循环)

### 门窗修复+一楼去外廊+工具房+车棚敞棚 (v0.71.0)

- **门阈值修复**: 0.02→0.005 (边长>35u时0.7/len<0.02门被误删)
- **AC修复**: forceY!==undefined→!=null (调用方传null→[null]仅1层) + 窗间墙定点布局替代均布避让
- **一楼去外廊**: addCorridorToEdge fl=0→fl=1; 门窗保留(学生从门直入广场)
- **工具房5间房**: edgeMarks(ei=1朝运动场) + \_nRooms=5/\_singleDoor参数; computeWindowRanges支持\_nr覆盖
- **车棚敞棚**: 封闭椭圆柱→单片BufferGeometry拱面(32段扫掠); 四角柱内收88%+柱高随拱(顶拱底不凸)
- **改动**: js/obstacles.js + maps/campus.map.json

---

## v0.70.0 本次会话变更 (2026-07-17)

### 校园建筑门窗系统

- **5栋教学楼门窗贴面**: 外廊面(前门+后门+多扇窗)+空调面(窗对称+空调避让); 教室自动划分(宽≈8u整除边长)
- **computeWindowRanges**: 按教室单元计算窗户沿边 t 范围
- **addDoorsAndWindows**: 沿边逐层逐教室生成门窗薄Box(门0.7×2.0u #8B6914; 窗台0.8u窗高1.2u玻璃#c8ddf0; 3-4扇细框#666)
- **addACToEdge 避让**: 新增 winRanges 参数, AC 中心距窗范围<0.6u(半宽0.5+余量)跳过
- **架空层柱子**: 内移0.55u(质心判内)+去角柱+obstacleMeshes追踪防泄漏
- **外廊侧墙+天花板**: 每层两端侧墙(顶层到天花板)+顶层天花板(与建筑屋顶齐平)
- **改动文件**: js/obstacles.js(+299/-7行)
- **验证**: CDP 0错误; Playwright 校园地图 60门+857窗+374框+16柱; 01a零回归

### 数据格式变更

无。

---

## v0.69.0 本次会话变更 (2026-07-17)

### 校园外廊/空调标记 v2 调整(纯覆盖 + 天桥子段裁剪 + b7 空调)

- **纯覆盖模式**: 弃 fallback, 无 edgeMarks 的楼不画外廊/空调(工具房自动无)。删 fallback 分支 + edges/innerScore/courtyardX/Z dead code(-96行)
- **天桥子段级裁剪**: edgeBridgeOverlaps 返回 {yRange, segRange}(共线+投影算连接子段)。贴天桥的边天桥层只裁连接子段(如 B5 ei=3 t∈[0,0.4]),其余段画外廊;横杆/挑板分段(方案A)
- **b7 空调**: 工具支持标 b7_buildings 4 边;dome 分支读 b7 edgeMarks,拱顶长边(ei=0/2)墙面挂空调(\_b7w 坐标推导)。b7 只空调
- **改动文件**: server.py + tools/building_edge_marker.html + js/obstacles.js
- **验证**: CDP 0错误; Playwright 工具房0mesh + B5子段裁剪 + b7空调7mesh

### 数据格式变更(消费者同步)

- 新增字段: campus.obstacles.b7_buildings[i].edgeMarks = [{ei, type:'ac'}]
- footprintBuildings[i] 语义变: 无 edgeMarks → 不画(弃 fallback)
- 消费者: js/obstacles.js + tools/building_edge_marker.html + server.py

## v0.68.0 本次会话变更 (2026-07-16)

### 校园建筑外廊/空调标记系统(工具标记 → 地图 → 渲染)

- **工具闭环**: tools/building_edge_marker.html 加 load 回填 edgeMarks + "保存标记到地图"按钮(POST /api/solidify)+ draw 画天桥 footprint(紫色虚线提示)。clearMarks+save 显式清除已落盘标记
- **server 写回**: solidify_campus 扩展接收 edgeMarks,写回 footprintBuildings[i].edgeMarks,空数组删字段回 fallback,保持坐标内联格式
- **渲染接入**: obstacles.js 读 fp.edgeMarks(覆盖语义:有标记只画标记边,无则 fallback innerScore 自动推断)。helper: edgeByFootprintIdx(按 footprint 点索引取边,不依赖 edges 下标)+ edgeBridgeOverlaps(边贴天桥检测)
- **天桥楼层裁剪**: 标记边 + fallback 边都跳过天桥 Y 区间(6~9)的层。顺带修复 v0.67.5 天桥实装后 fallback 自动推断栏杆穿天桥的潜在穿插
- **架空层**: 隐式跳过(栏杆第0层落 y=\_stiltY 架空层顶)
- **改动文件**: server.py + tools/building_edge_marker.html + js/obstacles.js
- **验证**: CDP 0 错误; Playwright 工具闭环(标记→保存→回填→清除)+ 游戏渲染(覆盖/fallback 天桥层裁剪到 0 mesh); map01a 零回归

### 数据格式变更(消费者同步)

- 新增字段: campus.obstacles.footprintBuildings[i].edgeMarks = [{ei, type:'corridor'|'ac'}](数组非空才覆盖,空/无字段→fallback)
- 消费者: js/obstacles.js(渲染) + tools/building_edge_marker.html(回填/保存) + server.py(写回)

## v0.67.5 本次会话变更 (2026-07-15)

### 校园现实化：楼高 + 人行天桥 + 教学楼架空层

- **现实信息同步(楼高)**: 综合楼×3(B2/B3/B6)+教学楼×2(B4/B5)=5层(height=15, floorH=3); 工具房(B1)=平房(height=3)。楼层逻辑由height驱动(floor(wallH/3)外廊空调+round(h/3)墙纹理)
- **教学楼 L 型去短翼→正交矩形**: B5 原 L 型(短翼=西北突 P2-P3-P4-P5)去掉短翼,主体 P0-P1-P2-P*新(P*新=P2+(P0-P1), 已验证 P0-P1⊥P1-P2)
- **人行天桥(空中连廊)**: `obstacles.bridges` 新数组。天桥 footprint 贴三栋真实斜边(偏13°: 南界主体北边段/北界B6南边段/东界垂直建筑边/西端B3东南),封闭白瓷砖 box,三层地板 `floorY=6`+一层厚 `thickness=3`(天花9),连教学楼+B3+B6 三层。obstacles.js 加 bridge 渲染(ExtrudeGeometry 空中,只入 obstacleMeshes 炮弹 Raycaster,不入 obstacleData 坦克可从桥下穿)
- **教学楼一楼架空层**: B5 `stiltFloor=1`。楼体 ExtrudeGeometry 从 y=3 起(depth=h-3=12,4层墙),架空层 y=0~3 柱子支撑(沿 footprint 边每5单位圆柱 r0.3)。外廊/空调 wallH 改 `h-_stiltY`+bldGroup.position.y=\_stiltY(跳过架空层,从2层起)
- **改动文件**: maps/campus.map.json(楼高+命名+主体矩形+bridges+stiltFloor) + js/obstacles.js(bridge渲染+架空层+柱子+外廊空调偏移)
- **验证**: CDP 校园+3工具 0 错误; Playwright 天桥 mesh 确认; 教学楼架空层 mesh position.y=3

### 数据格式变更(消费者同步)

- 新增字段: `campus.obstacles.bridges`([{footprint,floorY,thickness,name}]); `footprintBuildings[i].stiltFloor`(架空层数)
- 消费者: js/obstacles.js(bridge 渲染+架空层) + tools/building_edge_marker.html(命名,暂不显示 bridge)

## v0.67.4 本次会话变更 (2026-07-14)

### 校园工具：旋转对齐 + 命名功能 + B7 双栋数据化

- **3 工具旋转对齐上帝模式**: building_edge_marker + track_zone_marker 投影改中心式两轴取反(照搬 b7_builder 已验证的 w2s/s2w), canvas 上北/下南/左东/右西, 与 F4 上帝视角一致。b7_builder 已对齐(不动), map_bounds_tool 是 Leaflet(不动)
- **building_edge_marker 命名功能**: N 键命名模式(与外廊 R/空调 B 标记模式并列), 面拾取(pointInPoly 射线法 + b7 矩形局部坐标旋转判断)命名建筑/运动场/B7 双栋, 经 /api/solidify 写回 campus.map.json。B7 footprint(dome) 跳过命名(命名落到 b7_buildings)
- **B7 双栋数据化(方案A)**: obstacles.b7_buildings 顶层数组(室内运动场 vaultH10 + 车棚 vaultH5), obstacles.js dome 分支硬编码 `_b7blds` 改读 `_campusB7Buildings`(带 fallback 硬编码), 参数逐字取自原硬编码(零回归)。B7 footprint name 清空
- **server.py /api/solidify campus 分支**: solidify_campus 接收 `{type:'campus', names:{buildings/grounds/b7}, b7_buildings?}` 写回 maps/campus.map.json。正则内联纯数字数组(保持原文件坐标内联格式, 避免 json.dump 展开致全文件重排)
- **b7_builder 数据闭环**: IIFE 从 obstacles.b7_buildings 加载初值(无则 resetDefault) + "保存到地图"按钮(saveB7 POST solidify 整体替换 b7_buildings)
- **SDD 流程**: 8 任务 subagent-driven(spec→plan→逐任务实现+per-task review), 全部 review clean(T7 一 Critical saveB7 选择器 null→getElementById 已修实测通过)。ledger 见 `.superpowers/sdd/progress.md`
- **改动文件**: server.py + maps/campus.map.json + js/obstacles.js + tools/building_edge_marker.html + tools/track_zone_marker.html + tools/b7_builder.html
- **验证**: Playwright 实测 3 工具 0 pageerror + 命名保存落盘重载 + b7_builder wings=2/保存✅反馈; CDP 0 错误
- **已知遗留(Minor, 非阻塞)**: T2 EOF 缺末尾换行; T3 Prettier 重排 dome 相邻代码; T4 边缘高亮偏移线法向未翻转(纯装饰); T6 nameMode 下 hover 走边缘/空串无法清名

### 数据格式变更(消费者同步)

- 新增字段 `campus.obstacles.b7_buildings`(与 footprintBuildings/grounds 同级); footprintBuildings[].name + grounds[].name 写入值
- 消费者: js/obstacles.js(dome 分支读 b7_buildings) + tools/building_edge_marker.html(显示/命名) + tools/b7_builder.html(加载/保存) + tools/track_zone_marker.html(仅旋转)

## v0.67.1 本次会话变更 (2026-07-13)

### 校园建筑围墙碰撞修复 + 2D 射线-多边形精确求交

- **围墙碰撞检测修复**: 围墙 mesh 推入 `window._campusBuildings` 数组，与建筑统一走碰撞检测流程
- **2D 射线-多边形精确求交**: 淘汰不可靠的 ExtrudeGeometry 逐三角面 raycast，改为炮弹射线投影到 XZ 平面对 footprint 多边形每条边做射线-线段求交。命中点精确落在建筑墙面（非 AABB 虚空面），边法线驱动焦痕朝向
- **命中效果对齐地面撞击**: 建筑/围墙命中播放 `playGroundHitSound()`（低沉撞击）+ `spawnGroundDebris()`（泥块飞溅）+ `spawnWallScorchMark(pos, normal)`（墙面焦痕平行于墙面），与炮弹落地效果一致
- **HE 溅射不可摧毁守卫**: 高爆弹溅射循环加 `if (od.polygon || od.box || od.type === 'wall') continue;`，校园建筑/围墙不可被 HE 摧毁
- **踩坑**: `Ray.distanceToPoint()` 返回垂直距离（非沿射线距离）→ 交点恰在射线上垂直距离 ≈0 → 所有建筑立即"命中"; `Box3.setFromObject()` 对旋转 ExtrudeGeometry 算出错误包围盒; ExtrudeGeometry 逐三角 raycast 短射线段易从面间缝隙穿过
- **改动文件**: `js/engine.js`（主循环+vs 模式炮弹碰撞检测重写）+ `js/obstacles.js`（围墙推入 `_campusBuildings` + 预存 `userData._polygon`/`_wallH`）+ `js/shells.js`（新增 `spawnWallScorchMark`）

### 已知问题

1. avg fps 41.5 仍非稳定 60（剩余 GC 20ms），待 P-burst-3
2. 坡地一头翘起一头陷地（坦克/敌人偶发）
3. 对山丘目标弹道偏低
4. 六足武器俯仰旋转轴不正确

---

## v0.67.0 本次会话变更 (2026-07-12)

### 金福园小学真实校园地图（OSM 导入）

- **数据采集**: map_bounds_tool.html 边界框选工具(Leaflet卫星图+Overpass OSM)→人工打点框校园+设楼高→导出 jinfuyuan_school.json(WGS84)
- **转换器**: tools/build_campus_map.js 投影(切平面+居中+÷1.3)→campus.map.json(flat:true + footprintBuildings + grounds + boundary)
- **建筑渲染**: obstacles.js createFootprintBuildings(ExtrudeGeometry真实footprint拉伸) + createGrounds(操场ShapeGeometry) + createBoundaryWalls(围墙box拆段) + createCampusGround(瓷砖CanvasTexture)
- **campus 材质**: buildings.js 加 campusWallM/campusRoofM/campusPitchM(全局共享, polygonOffset)
- **入口**: 单人地图选择(\_index.json + type:'single')

### 碰撞系统重构（大物体不用圆/圆柱）

- **坦克碰撞**: checkCollision 加 circleVsPolygon(圆-多边形) + box(AABB) 分支; footprint建筑有 polygon+box 字段
- **炮弹碰撞**: 加 Raycaster vs \_campusBuildings mesh(精确墙面命中); 圆柱检测跳过 polygon/box(避免外接圆虚空触发)
- **不可摧毁实体**: footprint建筑/围墙炮弹命中只碎片+火花+低沉音(playHitSound), 不移除碰撞; 树/随机建筑可摧毁(playExplosionSound)
- **弹道线**: 体积检测跳过 polygon/box(避免外接圆提前截断), Raycaster 精确
- **围墙拆段**: 长墙按12单位拆段(中心密集, queryByDistance 覆盖)
- **瓷砖地面**: polygonOffset 层叠(草地<瓷砖<操场, 都y=0)
- **教训**: 大物体(非圆柱/球)碰撞/检测不用圆/圆柱(半径小穿模大虚空触发)→用polygon/box/Raycaster

### 相机避障 + 狙击小地图

- **相机避障**: placeCamera 检测相机→坦克射线 vs \_campusBuildings, 被挡时前移到坦克后方3+下降平视(非俯视)
- **被挡自动小地图**: window.\_hullOccluded 标志, 第三人称被挡时显示 sniper-minimap(车体线框+车首三角)

### 上帝模式修复

- **F4 相机**: 降到穹顶内(1.3maxExt), 南上方俯瞰(北朝上); 数据层 x 取反补偿右手系东朝左

## v0.66.1 本次会话变更 (2026-07-08)

### 修复玩家六足 F2 碰撞体可视化蓝灰六棱柱残留

- **现象**: 玩家六足按 F2(碰撞体可视化) OFF 后，场景偶现蓝灰六棱柱(#4b4b62)残留在六足位置并跟随移动
- **残留物本体**: `models/enemies.js:1247` 的 `_lodCylinder` — LOD 远距替身几何(`CylinderGeometry(0.5,0.7,2.5,6)`=六棱台 + 蓝灰 `0x4a4a5a`，初始 `visible=false`，挂 root 下→跟随移动)。`#4b4b62` 为截图取色(实为 `0x4a4a5a`)
- **根因**: `collisionSystem._setRenderVisible` 切换渲染模型可见性时，跳过条件只含 `_col_` 前缀；F2 OFF(`vis=true`)时把 `_lodCylinder` 误设 `visible=true`。**玩家六足不进 LOD 循环**(`engine.js:3695` 仅遍历 `enemies[]`)→ 无 LOD 每帧修正 → 永久残留。敌人六足被 LOD 每帧 `cyl.visible=isFar` 修正故不复现(解释了"玩家六足偶现")
- **修复**: `js/collisionSystem.js:80` `_setRenderVisible` 增加 `_lod` 前缀跳过 — LOD 几何归 `engine.js` LOD 系统自管，碰撞体可视化不再误碰
- **验证**: Playwright 实测玩家六足 F2 ON→OFF 往返后 `_lodCylinder.visible` 保持 `false`，0 控制台错误

## v0.60.x 本次会话变更 (2026-06-15)

### 狙击模式（第一人称）

- **右键切换**：`mousedown button=2` 切换 `_sniperMode`，FOV 25°（约1.8x变焦），指挥塔视角
- **自由观察**：`cameraYaw` + `_sniperPitch` 驱动，水平复用第三人称yaw，垂直独立（movementY驱动）
- **俯仰限位**：±60°仰角 / -45°俯角（`Math.max(-PI/4, Math.min(PI/3, ...))`）
- **精瞄灵敏度**：`SNIPER_MOUSE_SENSITIVITY=0.0015`（第三人称0.004的37.5%）
- **炮口跟随**：`mouseX/Y` 固定屏幕中心 → `updateAiming` 射线投射驱动炮塔追踪视线
- **天空瞄准fallback**：射线打不到地面时，用相机前向200m虚拟瞄准点兜底
- **退出同步**：`cameraYaw = atan2(bd.z, bd.x)` 对齐炮管世界朝向，第三人称无缝切到炮口后方
- **摄像机前置**：沿炮塔前方偏移0.8单位，清出炮盾避免遮挡
- **UI管理**：狙击时隐藏十字线/弹道线/3D血条装填条，退出时一次性恢复
- **俯视小地图**：左下角140px圆形canvas，线框车体+三角车首指示前方，上方=摄像机朝向，HP红→绿

### 动态天空系统（`js/sky.js`）

- **天空穹顶**：倒置球体（半径`maxSide*1.7`），顶点着色器渐变（天顶深蓝→地平线淡蓝白），太阳光晕
- **云层**：两层FBM值噪声（`fract(sin(dot(...)))` 哈希），smoothstep软边缘，不同scale/speed飘移
- **零纹理**：纯着色器算法，~80 ALU ops/pixel，0 纹理采样，<0.5ms/帧
- **地图自适应**：穹顶半径/fog距离/camera far基于`maxSide`按比例计算，`SkySystem.resize()`适配地图切换
- **接管**：`scene.background=null` + `scene.fog` 由sky.js管理；围墙移除（天空穹顶替代）
- **太阳**：上午10点方位角120°仰角35°，`uSunDir` 统一天空着色器和场景方向光
- **GLSL precision**：两个片段着色器均已添加 `precision highp float;`（防移动端编译失败）
- **shader优化**：移除冗余 `normalize(uSunDir)`，JS端已保证归一化
- **sunLight对齐**：`getSunDir()` API → engine.js用其对齐DirectionalLight位置和阴影方向
- **雾优化**：`fogNear = maxSide*0.4`（从0.8降低，大气透视更早生效）

### 六足AI修复（v0.60.1~v0.60.3）

- **复活腿部冻结**：`_processTrainingRespawn` 补回 `HexapodEnemy.init(en)` 重建CCD IK上下文
- **复活后退**：`retreating` 条件 `radialW > 0.3`→`radialW < -0.3`（太近才后退，太远应前进）
- **复活导弹弹药**：重置 `_missileAmmoL/R=4`，防止打光后永久无弹
- **武器优先级重构**：过热优先`missile_retreat`（后退+导弹），非过热导弹窗口15~50m，极近距(≤15m)加特林
- **加特林过热停转**：`ai._overheated` 时 `spinRPS=0`，两处update已修复

### 参数变更

- 围墙高度：80→移除
- 围墙颜色：`#8899aa`→移除
- `scene.fog` 颜色：`#8899aa`→`#c8d8e0`；near/far：`maxSide*0.8/1.6`→`maxSide*0.4/1.6`
- `camera.far`：300→`maxSide*2.2`
- 六足导弹最远距离：40→50
- 六足导弹最近距离：3→15
- `renderer.outputColorSpace`：新增 `THREE.SRGBColorSpace`
- 天空穹顶分段：`64×32`→`96×48`

### 性能优化（v0.60.4）

- **草丛InstancedMesh合并**：按单元格分块(每类型8×8=64DC)→按类型合并(每类型1DC)，草丛draw call从~48-192降至固定3
- **草材质降级**：`MeshStandardMaterial`→`MeshLambertMaterial`（PBR→漫反射，GPU着色器开销降~30%）
- **草片面剔除**：`DoubleSide`→`FrontSide`（片段着色器调用减半）
- **河流碰撞空间网格化**：`waters.js`创建时同步构建`_riverGrid`(SpatialGrid, cellSize=10)，`checkCollision`/`isInRiver`/多轮推离全部改用`queryByDistance`，O(n)→O(1)
- **调试面板**：新增 `renderer.info.render.points` 显示（点粒子数）

---

## v0.61.0 本次会话变更 (2026-06-17)

### 模块化玩家角色控制器（可插拔架构）

- **`js/playerControllers/manager.js`**：`window.PlayerControllerManager` 调度层，注册表+当前角色+update分发。采用"默认透传"模式——`isActive()=false`（坦克）时 gameLoop 走原代码（零回归）；`=true`（六足等注册角色）时跳过坦克物理块
- **接口契约**：核心4方法（`type/onSpawn/update/getPose/dispose`）+ 可选能力钩子（`getGroup/canSniper/handleWeapons/onRespawn/onHit`，typeof 探测）。武器/炮塔进可选钩子（六足无武器，避免接口污染）
- **`js/playerControllers/hexapodPlayer.js`**：第一个新角色，WASD 八方向+鼠标转向，复用 `HexapodEnemy.init/update` 的 CCD IK 步态管线
- **扩展性**：未来新增角色（丧尸/突击车）只需 1 文件 + 1 script + 1 按钮，不改 engine.js
- **⚠️ 关键坑：`engine.js` 顶层 `let` 不挂 `window`**（player1/cameraYaw/scene/gameMode 等）。控制器是独立模块，**绝不能用 `window.cameraYaw` 读取**——会得到 undefined → `Object3D.rotation=NaN` → 所有子 mesh 投影到 NaN 位置（屏幕外）。正确做法：经 `input.cameraYaw` 参数传入（gameLoop 分发时传），或经 `spawnCtx.player1`。其他角色实现时严格遵守这个参数通道。
- **engine.js 6处PCM守卫**：gameLoop(1466)/enterTrainingMode(5135)/placeCamera(3170)/\_processTrainingRespawn(4065)/returnToMenu(5011)/updateTrajectoryLine(1254)
- **六足→坦克切换修复**：六足退出后重选坦克时检测 `_polluted`（player1被壳化），自动重建坦克模型+全局引用(tankGroup/leftWheels/reloadBarGroup)，并 deactivate PCM
- **UI适配**：六足模式隐藏血条/装填条/弹道线（无武器），禁止狙击（无炮塔）

### 六足步态姿势对齐（经探针数据量化定位+修复）

- **探针工具 `js/hexapod_probe.js`**：`__hexProbeStart/Stop/Stats/Compare` + `F7/F8` 快捷键 + localStorage 持久化（同源页面共享），输出精简统计（关节角 min/max/range + hipPeriodJump）。量化对比模型工厂(bodyWriter=true) vs 游戏(bodyWriter=false)的步态差异
- **Bug1：bodySpeed 时序bug**（`hexapod_enemy.js:178`）：`ctx._prevBodyPos` 在 stepGait 末尾更新成当前位置，下一帧位置差恒=0 → `spd` 恒=0 → `gaitPeriod` 固定0.7（本应自适应）+ `dynamicStride` 与身体失同步。**修复**：bodySpeed 改用 `|ai._desiredVel|` 直接算（精确），位置差仅作 fallback
- **Bug2：支撑相锁定策略**（`hexapod_core.js` stepGait）：工厂用 `plantPos`（脚实际落地世界位置，钉前方）；游戏端用 `_legHomePos`（身体下方 home）→ CCD 把脚从前方硬拉回下方 → 髋限位卡 0.45 + 膝弯 0.96 + 周期跳变 0.259。**修复**：玩家六足（`ctx._isPlayer`）支撑相用 `tipLocal.applyMatrix4(anklePivot.matrixWorld)` 钉实际位置（对齐 factory），敌人保持 `_legHomePos`（绕圈补偿）
- **Bug3：fwdBody 离散方向**：`fwdBody`（腿摆动方向）用 `animIndex` 离散 `dir`（仅X/Z轴），但实际 `desiredMove` 可斜向 → 腿摆向与身体移动方向不一致→飞。**修复**：玩家模式 `fwdBody` 用 `desiredMove` 真实方向（连续单位向量），自动支持八方位/斜向/手柄 360°
- **Bug4：turnRate 被 bodySpeed 传递屏蔽**：`params.bodySpeed` 已传 → `actualTurnRate` 不估算 → turnRate=0 → 未知实际转向。暂用 `ctx._isPlayer?0`（TurnRate=0 不走圆弧摆动），但鼠标转向叠加仍需单独处理
- **修复后效果**（`__hexProbeStats` 对比）：hip range 0.45→0.154(工厂0.131)、shin range 0.96→0.29(工厂0.32)、fx range 0.43→0.09(工厂0.13)、hipPeriodJump 0.26→0、spd 0→2.5、period 0.7→0.22（自适应）
- **频率差异**：玩家 period 0.22（快步频，走速2.5）vs 工厂 0.7（展台Walk慢）——这是速度差异，姿势已对齐

### 技术支持

- **Playwright 自动化验证**：`npx playwright 1.60`（Node.js，chromium headless）用于真实复现 gameLoop 的运行时行为（raf 正常触发，不像旧 CDP headless 不触发 raf）。位于 `pw_test.js`（诊断用，用后清理）。后续步态调试可继续用此工具
- **状态栏**：`~/.claude/settings.json` 已配置 `statusLine`（python 脚本解析 Claude Code JSON stdin），显示模型·输出风格·会话·上下文%·PR

---

## v0.61.1 本次会话变更 (2026-06-17)

### 六足玩家步进式转向架构（根治 #5 转向腿飞 + #6 长期漂移）

- **根因**：原架构 `_root.rotation.y = π-_yaw` 身体每帧紧跟视角，腿被动追 → 转向时髋关节顶 ±0.45 限位 → 腿飞；摆动落点 swingFrom+估算步距与身体实际位移失配 → 漂移累积
- **步进式转向**（用户方案）：turnRate 离散化，每步态周期(0.32s)采样目标转向量→单步转角(clamp≤0.5rad)→整周期恒定执行。身体由 stepGait 步态驱动转向(腿蹬地+预伸)，非每帧跟视角
- **视角/机体解耦**：视角即时跟鼠标(cameraYaw)，身体步进慢追(笨重延迟, 平移补精细瞄准)；移动按视角(W=鼠标看的方向)
- **摆动闭环**：swingTo=homeW+速度前瞻(根治#6漂移, 每周期重置无累积) + 圆弧预伸(摆动腿往转向反向伸, 蹬地准备)
- **持续追视角**：玩家始终走 stepGait(不受 animRequest idle 打断, 鼠标停后身体继续转到位)；玩家跳过动画切换 resetPose(步进状态连续)
- **髋限位**：玩家 ×1.35(0.45→0.61/0.7→0.95)，容纳转向髋补偿
- **onRespawn**：重建 ctx 后重设 `_isPlayer`(既存bug)
- **改动文件**：`js/hexapod_core.js` stepGait(步进turnRate+身体驱动+圆弧+玩家始终分支) / `js/playerControllers/hexapodPlayer.js`(targetYaw+移动按视角+getPose身体实际) / `js/hexapod_enemy.js`(透传targetYaw+玩家跳过resetPose+玩家始终stepGait) / `js/engine.js` placeCamera(视角跟cameraYaw)
- **关键参数**：`STEP_PERIOD=0.32` `MAX_STEP=0.5` `IDLE_THR=0.02`（均在 stepGait 玩家分支，可调）

### 已知问题

1. 坡地一头翘起一头陷地（地形适应不平滑）
2. 对山丘目标弹道偏低
3. 只会对山丘开炮不会绕路
4. 六足武器俯仰旋转轴不正确（待校准）
5. ~~六足玩家转向腿飞~~ **v0.61.1 已修复**（步进式转向架构：身体由步态驱动转向+腿圆弧预伸，髋限位放宽容纳）
6. ~~长时间 WASD 步态漂移~~ **v0.61.1 已修复**（摆动闭环 homeW+速度前瞻，每周期重置无累积）

---

## v0.61.2 本次会话变更 (2026-06-18)

### 六足玩家坡地地形适应修复（4 项根因，逐层定位）

- **根因1 接通地形适应**（`engine.js`）：`getGroundHeight` 是脚本作用域局部函数，从未挂 window；`HexapodEnemy.init`（`hexapod_enemy.js:123`）取 `window.getGroundHeight` 得 null → `ctx.groundHeightFn=null` → stepGait 第441行 `if(ctx.groundHeightFn)` 永不成立 → 车身 pitch/roll 代码从不执行、position.y 也不跟随地形（车身完全水平）。**修复**：`window.getGroundHeight = getGroundHeight;`
- **根因2 防过度倾斜**（`hexapod_core.js` stepGait）：采样 `sD=1.2` 太小（六足前后腿跨~1m，1.2m 没覆盖车身），对 FBM 高频+河岸落水过敏，实测局部采样坡度(48°)远大于宏观(16°)。**修复**：sD 1.2→2.0 + 落水/陡崖过滤（采样点 `< h_center-1.2` 用 center 替代）+ 平滑（HEX_SMOOTH=12）
- **根因3 hRgt 方向反**：原照搬坦克公式 `(-cos(yaw+π/2), sin(yaw+π/2))`，但六足车头朝向不同 → 左右反（绿箭头指左）。**修复**：hRgt = `hFwd×up = (-sin yaw, -cos yaw)`（右侧）
- **根因4 pitch/roll 轴互换（最隐蔽）**：六足车头本地 **−X**（坦克是 −Z），YXZ 下 `rotation.x`=侧倾、`rotation.z`=俯仰，与坦克**相反**；原代码照坦克赋值（rotation.x←pitch, rotation.z←roll）→ 正对坡顶（前后落差）错误地变成侧倾。**修复**：`_rollT` 去负号 + 交换赋值（`rotation.x`←侧倾 \_smRoll，`rotation.z`←俯仰 \_smPitch）
- **可视化排查法**：临时在六足加红(hFwd)/绿(hRgt)箭头+黄球(采样点)，用户肉眼对比模型车头，定位根因3/4（纯数据测 hFwd/hRgt 都正确但 roll 仍错）。用后已还原
- **验证**：Playwright 实测连续缓坡 pitch=9.6° roll=0.3°（俯仰主导）、陡岸不暴涨、0 console 错误
- **顺带修复**：六足敌人地形适应（同一 HexapodEnemy.init 路径，原同样 groundHeightFn=null）

### 已知问题（更新）

1. 坡地一头翘起一头陷地（**六足玩家已修**，坦克/敌人仍偶发）
2. 对山丘目标弹道偏低
3. 只会对山丘开炮不会绕路
4. 六足武器俯仰旋转轴不正确（待校准）

---

## v0.61.3 本次会话变更 (2026-06-18)

### 加特林枪管旋转状态机修复（3 根因）

- **根因1**（`hexapod_core.js` updateGatlingSpin）：`spinRPS = spinRPS || 3`，0 被 `||` 当 3 → 枪管恒转 3 RPS（"总在转"直接根因）。**修复**：`|| 0`
- **根因2**（`hexapod_enemy.js`）：调用方默认 `spinRPS=3`（spinUp=0 不攻击也转），死亡中/完成传 3。**修复**：`spinRPS = (spinUp||0)*30`（0 停/30 满），死亡传 0
- **根因3**（`enemyAI.js`）：过热恢复 `heat<20` 解除。**修复**：`heat<=0`（强制散热必须降到 0 才能再旋转→达标→射击）
- **完整状态机**：不攻击/不在射程→spinUp衰减停转；攻击→spinUp渐增加速旋转；spinUp>0.7达标→射击+枪管发热变红（barrelMats emissive）；heat≥80过热停射停转；heat降到0才解除。玩家六足无武器→枪管永静

### 六足玩家跑/走恢复

- **键盘 WASD（满力度1）→ 跑**：Run 步态（animIndex 2/4），`RUN_SPEED=5.0`
- **手柄摇杆低力度（<0.7）→ 走**：Walk 步态（1/3），`WALK_SPEED=2.5`；手柄高力度（0.75/1）→ 跑
- **判定**：`_isRun = max(|forward|,|strafe|) ≥ 0.7`；strafe_run_left/right = 19/20
- 原 v0.61.0 调试期为统一走（降低步态调试难度），现恢复正常
- **改动**：hexapodPlayer.js（RUN_SPEED + \_isRun 判定 + desiredVel 用 \_spd）+ hexapod_enemy.js `_animRequestToIndex` 加 `move_forward_run→2`、`move_backward_run→4`
- **验证**：Playwright 键盘W→animIndex2/vel5，低力度0.5→animIndex1/vel1.25；CDP 0 错误

---

## v0.61.4 本次会话变更 (2026-06-18)

### 六足玩家加特林双瞄准线

- **连续射线 + 双段着色**（`js/hexapod_aimLine.js` v0.3）：左右加特林各一条连续直线（无重力），从枪口沿枪管指向延伸到被截断为止（射向虚空延伸到 MAX_LEN=80m 自然终止）。**绿段**枪口→25m(子弹射程)，**红段**25m→截断点(命中点或MAX_LEN)；命中<25m时仅绿段。24段采样，5层碰撞（地面/水体/桥面/障碍物Mesh/敌人圆柱扫掠）。球形标志仅命中物体时显示
- **俯仰追踪光标**（对标坦克 updateAiming）：engine.js 用 `aimRaycaster` 真实 raycast（`intersectObject(groundMesh)` + 障碍物Mesh），NDC Y 取反（`-(_virtualMouseY/h)*2+1`，与坦克一致）→ 命中点 `aimTarget` 经 PCM input 传入控制器 → hexapodPlayer 反算俯仰角（pivot局部空间 `atan2(localDir.y, -localDir.x)`，左右平均）→ clamp(-0.7俯~+1.05仰) → 平滑跟随(15/dt)
- **⚠️ 关键坑（方向反）**：pitch 约定"负=俯/正=仰"，但绕 pivot 局部 Z 轴物理旋转"正=俯/负=仰"，故应用时必须**取反**：`setFromAxisAngle(_Z_AXIS, -_gatlingPitch)`。取反前下拉鼠标枪口朝天（dirY=+0.644），取反后正确下俯（dirY=-0.644）
- **望天 fallback**：射线打不到地面/障碍（望天）时，用 `aimRaycaster.ray.direction`（已反映鼠标Y）×100m 构造高空 aimTarget → 加特林仰起追踪光标（非保持上次）
- **矩阵时序**：设 pivot.quaternion 后立即 `updateMatrixWorld()`，否则 getWeaponAimData 的 localToWorld 读到上一帧旧枪口方向
- **颜色状态机**：正常绿近/红远；过热全红；冷却中全橙
- **射程对齐**：25m = 子弹实际 maxDist（spawnHexapodGatlingBullet）
- **PCM扩展**：manager.js 新增 `hasAimLine()`；input 新增 `aimTarget` 字段
- **生命周期**：onSpawn激活 / dispose清理 / 死亡隐藏 / 复活恢复
- **改动文件**：hexapodPlayer.js(+55行) / hexapod_aimLine.js(新建~260行) / manager.js(+8行) / engine.js(+12行) / index.html(+1行)
- **验证**：CDP 0 错误；Playwright 实测俯仰（下拉dirY=-0.644俯/上推dirY=+0.122仰）+ 瞄准线（水平2绿14.6m/望天2绿25+2红55球隐/下拉2绿1.3m球显）

---

## v0.63.0 本次会话变更 (2026-06-21)

### 坦克炮塔世界空间重构

- **世界空间陀螺仪炮塔**: `worldTurretYaw` 持久存储炮塔绝对世界方向，鼠标/摇杆直接驱动
- **删除瞬时稳定器**: 移除 `turretYaw += hullDyaw`，公式 `turretYaw = worldTurretYaw - (π/2 - hullYaw)` 替代
- **同向不再迟钝**: 车体+鼠标同向转时炮塔以满 30°/s 追光标，无稳定器与瞄准互搏
- **惰性初始化**: `worldTurretYaw: undefined` → 首帧自动对齐，所有模式/spawn/respawn 零改动
- **改动范围**: 仅 `engine.js` ~40行；敌人/六足/摄像机/俯仰 均不受影响

---

## v0.65.2 本次会话变更 (2026-06-24)

### 单人模式性能优化

**地面射线高度图优化**: updateAiming 的 groundMesh raycast (131072三角 brute-force 14ms) 是单人模式出生点 30fps 的元凶(非战斗)。用 `_raycastGroundHM` 沿射线步进+二分(基于 getGroundHeight O(1))替代, 同时改 4 处(单人/双人/六足)。物理阶段 19→1-7ms, 单人 01a 出生点 fps 30→48(+60%)。

**P0-1 建筑 IM 合并(v0.65.2 根因定位有误，v0.65.3 已修复)**: 当时诊断为"material 引用比较无法跨组合并"，并据此加 category 字段+扩大 targetHeight 范围+castShadow=true。**但 MCP 实测推翻该诊断**——真正根因是 obstacles.js 外层循环遍历每个子 mesh 而非唯一材质，同材质被重复建 IM(实测 141 bld-im 中窗户材质被建 56 次)。v0.65.3 按 material 去重+材质全局化修复，141→18，详见 v0.65.3 段。

### 已知问题（更新）

1. ~~坦克AI托管: 偶发敌方驶入池塘~~ + ~~偶发远距离对峙/出界~~ **v0.65.1 已修复**
2. avg fps 41.5 仍非稳定60(剩余 GC 20ms 来自未池化 spawn: 炮弹 mesh/ringFX/ExplosionEffects), 待 P-burst-3 续做
3. 坡地一头翘起一头陷地(坦克/敌人偶发)
4. 对山丘目标弹道偏低
5. 六足武器俯仰旋转轴不正确(待校准)
6. ~~P0-1 建筑 IM 合并~~ **v0.65.3 已修复**(141→18 bld-im, 见下)

---

## v0.65.3 本次会话变更 (2026-06-24)

### 建筑 InstancedMesh 碎片化合并修复（bld-im 141→18，零画质损失）

**背景**: v0.65.2 把 P0-1 根因诊断为"randomBuildingMaker 返回不同拓扑"，commit/perf plan 据此写"141 待合并"。但经 Three.js DevTools MCP 实测(map01a 单人)，**该诊断有误**。

**真实根因（实测确认，非推断）**: 当前 141 个 bld-im 但仅 15 种唯一材质颜色——窗户材质 #aaccff 被建了 **56 个 IM**、灰框 #888888 建 52 个。根因是 `js/obstacles.js` 外层 `for (const mt of matTemplates)` 遍历**每个子 mesh**（一栋建筑多扇窗/栏杆）而非**唯一材质**，同材质被重复建 IM；叠加 `models/buildings.js` 每次 create 都 new 新材质实例。与建筑拓扑/分组(targetHeight)无关。

**修复（3 处）**:

- `models/buildings.js`: 3 个 create 函数的材质提升为 18 个模块级全局常量，同 category 建筑共享 material 对象（合并前提）
- `js/obstacles.js`: 外层循环加 `seenMat` Set 按 material 对象去重，每个唯一材质只建 1 个 IM（核心修复，56→1 的来源）
- `js/obstacles.js`: 清理路径保护全局材质——bld-im 重建时只 dispose geometry 不 dispose material（顺带修了 bld-im 不被清理的泄漏）

**实测对比（map01a 单人，MCP run_js）**: bld-im 141→**18**(-87%) | 窗户材质 IM 56→3 | 三角面 1.58M→1.23M(-22%) | 建筑 shadow caster 141→18 | 控制台 0 错误 | 视觉零损失(截图分析确认) | 3 次进出地图材质正常(dispose 安全验证)

**注**: 主通道 DC 311→308 基本持平——因 frustum culling，之前 141 个小 IM 多被视野剔除，实际渲染 DC 本就 ~18；真实收益在三角面(-22%,GPU 填充率)+阴影 caster(-87%,阴影 pass 减负)+IM 对象数(-87%,CPU 场景遍历/矩阵更新)。跨 category 共享通用材质(18→~15 IM)留作后续可选优化。

---

## v0.65.6 本次会话变更 (2026-06-26)

### 建筑朝向基础（地图 yaw 传递 + 编辑器朝向标识 + R 键旋转）

- **根因**: mapLoader 转建筑时丢 yaw（只取 x/z/type），obstacles 读错字段名（angle vs yaw）→ 所有建筑同朝向
- **修复**: `mapLoader.js:222` 补传 `yaw: e.yaw||0` + `obstacles.js:821` 用 `bld.yaw`
- **编辑器 marker 加门**: `editor_entities.js` createBuildingMarker 三种建筑 +Z 面加亮黄门（薄盒外突），对称低模朝向可辨识
- **R 键旋转 UI**: `map_editor.html` 选中建筑 R 键步进 15°（Shift 反向），更新 ent.yaw + marker.rotation.y
- **推后**: 村落生成器 `_findClosestRoadAngle` 朝向差 90°（让 +X 朝道路，门窗在 +Z）→ 建筑门未精确朝道路，待修

---

## v0.65.13 本次会话变更 (2026-07-02)

### 虎式坦克动画展台实装

- **5 个动画**: 炮塔360°旋转 / 炮管俯仰 / MG34高射机枪旋转俯仰 / 履带前进 / 履带后退
- **真实炮管俯仰角**: -8° ~ +15°(真实虎式88mm KwK 36 L/56, Wikipedia查证), 替代T-34原25°/-10°随意值
- **MG34防空旋转**: 以`MG枢轴支柱`顶端为轴心(实测pivot位置[0.68,-1.182,-0.81]=支柱position+H/2), 水平360°+俯仰-5°~80°(能朝天)
- **\_TANK_PROFILE 差异化**: T-34/虎式共用`_tank*`框架(collectRefs/updateFrame/reset/destroy), 按模型差异化: 履带名(左履带链/左履带)、MG支柱名(MG枪座支柱/MG枢轴支柱)、MG旋转部件(5/8个)、炮管俯仰角、MG旋转参数

### 展台回归修复(前置 Bug)

- **根因**: `model_factory.html`中`computeTrackTotalLen`/`updateTrackPlates`两函数**只有调用零定义**(v0.65.9履带绕紧重构遗漏, 履带总长逻辑被内联进buildTrackChain/getTrackPlateTransform但未抽成函数)
- **现象**: T-34/虎式点展台→collectRefs执行到履带处理抛ReferenceError→`animPhase=1`不执行→updateAnimShowcase首行`animPhase===0`早退→**不播放**
- **修复**: 从getTrackPlateTransform抽取6段长度公式补回computeTrackTotalLen; 新增updateTrackPlates(沿路径环形取模平移履带板)。修复后T-34/六足展台均恢复(实测0错误, anim-item 5/5/23)

### 关键坑

- **MG pivot 位置**: 旧`pivot.position.set(0, pivotY, 0)`写死X/Z=0, T-34支柱在mgGroup原点侥幸成立; 虎式支柱在(0.68,\_,-0.81), 沿用会让枪管绕车体中心半径0.9大圆甩飞。改用支柱完整坐标(x, y+H/2, z), T-34零回归(支柱x/z=0等价旧值)
- **炮管俯仰轴心**: 用户要求=炮盾与炮塔前板接触面中心。旧用炮盾中心(mantletWorld)偏前半个炮盾厚度。改用"炮塔前板前端面"(前板中心z+厚/2, 虎式实测[0,-0.772,1.907]=接触面); T-34无"炮塔前板"→fallback炮盾中心(零回归)。虎式炮盾是Cylinder(沿Z h=0.5)、T-34炮盾是Sphere(scale[1,0.7,0.6])几何不同, 故用前板更稳
- **nodeMap 结构**: 叶子mesh的`info.group`是包装Group直接挂父Group, `info.group.position`=配置position(mgGroup无pivot则pivotComp=[0,0,0]); MG部件迁移逻辑对虎式同样成立

### 验证(Playwright + nodeMap userData 诊断)

- 虎式切对(MG枢轴支柱=true) + 三动画在转: case1 turretRotY=2.657rad, case3 MG yaw=2.436rad/pitch=74.5°, case2 炮管pitch=10.6°(均在真实范围)
- MG pivot 实测[0.68,-1.182,-0.81]=支柱顶端 ✓; 0 console错误
- **注意**: `window._animRefs` 是 stale 副本(\_tankCollectRefs里`animRefs={}`重置闭包变量未同步window), 诊断pivot要用`nodeMap.get(name).group.userData.animXxxPivot`

### 关键文件变更

| 文件                 | 改动                                                                                                                                  |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `model_factory.html` | 补computeTrackTotalLen/updateTrackPlates + \_TANK_PROFILE + tiger_v16注册 + \_tankCollectRefs/UpdateFrame用profile + MG pivot完整坐标 |

---

## v0.65.12 本次会话变更 (2026-07-01)

### 虎式 MG34 高射机枪升级

- **9 部件**：环形导轨(Torus)→枢轴支柱(Cylinder)→机匣(Box)→散热套管(Cylinder,粗管标志特征)→枪管尖→双鼓弹匣×2(扁Cylinder并排,🥁招牌特征)→握把(Box,木色)→环形瞄具(小Torus)
- **历史原型**：MG34 防空型，散热套管包裹枪管+顶部双鼓弹匣+环形防空瞄具，无制退器无防盾

### 虎式热带沙漠迷彩系统

- **Canvas 程序纹理**：沙米色系(对齐截图取色)，底色 `#e0d898` + 黄棕斑块 `#f0e8a8`/`#d8d090`/`#c8c078` + 深褐点缀 `#786050`
- **底色乘法修复**：`mat.color.set(0x808080)` 中间灰，杜绝 MATERIAL_DEFS 暗色(base 0x4a5c2e/0x3d4f25)与纹理相乘压暗
- **动态迷彩下拉**：虎式显示 `🔧调试色(高亮轮廓)` + `🏜热带沙漠迷彩`；其他模型显示丛林/沙漠。切换模型类型自动同步迷彩默认值
- **调试色模式**：`getMaterial` 仅在 `currentCamoType==='debug'` 时使用 hexColors 高亮色；切迷彩则跳过 hexColors，走正常 PBR+纹理
- **非调试色取消轮廓线**：2 处 EdgesGeometry 创建逻辑加 `currentCamoType==='debug'` 条件

### 材质覆盖（14 处 `dark_steel`/`barrel_steel` → camo）

- **炮管总成**：炮盾(camo_green)、主炮管(camo_green)、抽烟器(camo_dark)、炮口制退器(camo_dark)、同轴机枪(camo_dark)
- **炮塔顶部**：指挥塔舱盖(camo_green)、装填手舱盖(camo_green)
- **车体**：左后挡泥板、右后挡泥板、MG枪托、炮塔座圈 → camo_dark
- **排气管**：左右排气管 → camo_dark

### ProfiledExtrude 侧面 UV 修复

- **根因**：`addQuad` 内每个面写死 `uvs(0,0,1,0,1,1,0,1)` → 纹理在每窄面上独立平铺→密集马赛克
- **修复**：`addQuad(a,b,c,d,u0,u1)` — U 沿轮廓周长递增 `(i/N, (i+1)/N)`，V 从底 0 到顶 1
- **影响**：炮塔主体+炮塔尾舱的圆弧拉伸面纹理正常环绕

### 关键文件变更

| 文件                          | 改动                                                          |
| ----------------------------- | ------------------------------------------------------------- |
| `models/tiger_v16_builder.js` | MG34 9 部件替换 + 14 处材质 camo 化                           |
| `model_factory.html`          | 热带沙漠迷彩生成+动态下拉+底色修复+UV修复+轮廓线条件+缓存清理 |

### 已知问题（同 v0.65.11）

1. avg fps 41.5 仍非稳定 60(剩余 GC 20ms)，待 P-burst-3 续做
2. 坡地一头翘起一头陷地(坦克/敌人偶发)
3. 对山丘目标弹道偏低
4. 六足武器俯仰旋转轴不正确(待校准)

---

## v0.65.11 本次会话变更 (2026-07-01)

### 模型工厂 UX 改进

- **Shift 减速滑块**：Shift+拖滑块=精细 1/10，capture 劫持 lil-gui slider 绝对映射改用相对增量
- **多选→自动滚动**：框选 ≥2 部件右侧面板 scrollIntoView 到 📦批量编辑
- **PE 预设+控制点+arc clockwise**：shape 预设下拉 6 种（马蹄形/矩形/梯形/半圆/六边形/扇环）+ roofProfile 增删滑块 + arc 命令扩展 clockwise
- **PE shape 缩放**：X/Y 缩放 + ⚡一键×2，createGeometry 内应用 shapeScale

### PE 2D 可视化拖拽编辑器

- **`js/pe_shape_editor.js`**：独立模块，overlay+canvas 渲染 shape + 3 类控制点（蓝■line端点/绿●arc圆心/黄●半径/角度），拖拽改 shape 后 rAF 节流 rebuild
- **typeList 加 ProfiledExtrude**：形状下拉含 PE，switchType + TYPE_DEFAULTS 默认参数注入

### 虎式 + T-34 左右命名调换（驾驶员视角 x>0=左）

- 虎式 name 调换 30 个（翼子板/履带/负重轮/诱导轮/主动轮等），plateWidth 0.5→0.85
- T-34 name 调换 32 个（同 + 油箱/排气管/履带链/扶手/烟雾弹架），游戏引擎不受影响（按 position 收集轮子）
- **螺栓朝外侧**：`isLeft` 改按世界 position.x 判断 + `boltY` 反号（轮子 rotation.z=π/2 局部+Y→世界-X）
- **履带修复**：最后一块 plate 浮点累积落原点（getTrackPlateTransform 兜底 pos→pA）

### 关键文件

| 文件                          | 改动                                                                   |
| ----------------------------- | ---------------------------------------------------------------------- |
| `model_factory.html`          | Shift减速+多选滚动+PE预设/控制点/缩放/2D编辑+typeListPE+boltY+履带兜底 |
| `js/pe_shape_editor.js`       | 新建 2D 拖拽编辑器                                                     |
| `models/tiger_v16_builder.js` | plateWidth 0.85 + name调换30                                           |
| `models/t34_v16_builder.js`   | name调换32 + boltY反号                                                 |

### 已知问题

1. avg fps 41.5 仍非稳定60（剩余GC 20ms），待P-burst-3续做
2. 坡地一头翘起一头陷地（坦克/敌人偶发）
3. 对山丘目标弹道偏低
4. 六足武器俯仰旋转轴不正确（待校准）

---

## v0.65.10 本次会话变更 (2026-06-30)

### 新增 ProfiledExtrude 几何类型（第 11 种）

- **`buildProfiledExtrude(shapeDef, roofProfile, arcSegments)`**：XY 轮廓 + roofProfile 沿 Z 变高拉伸。算法：THREE.Shape 解析 shape（line→lineTo / arc→absarc）→ roofH(y) 线性插值 → 侧面独立 quad strip → ShapeGeometry 三角化底面 + 翻转索引屋顶 → 合并 + computeVertexNormals
- **shape 格式**：`['line', x, y]` + `['arc', cx, cy, r, startAngle, endAngle]` 数组，支持任意凹多边形轮廓
- **roofProfile 格式**：`[[y_position, z_height], ...]` 沿 Y 轴（前后）定义可变高度，自动排序+插值
- `createGeometry` 新增 `case 'ProfiledExtrude'` 分支（L1048-1061）；GUI 面板（圆弧分段滑块 + Shape JSON + 屋顶剖面 JSON）

### 虎式炮塔马蹄形建模

- **炮塔主体**（`models/tiger_v16_builder.js`）：Box → ProfiledExtrude，马蹄形俯视轮廓（前脸 1.4 + 后方弧 r=0.75）+ 两段屋顶（前斜面 0.45→转折 0.65→后水平 0.65），rotation [-π/2,0,0] 转 Y-up 站立

### 法线保障（4 项机制）

| 机制               | 说明                                         |
| ------------------ | -------------------------------------------- |
| quad 独立顶点      | 每个 quad 不复用相邻 segment 顶点 → 侧面硬边 |
| cap Z ±0.0001 偏移 | 破坏与侧面顶点 hash 匹配 → cap/side 接缝硬边 |
| 屋顶翻转索引       | roof cap 每 3 个索引逆序 → 法线朝 +Z（外）   |
| winding 验证       | 所有面 winding 经推导确认 → FrontSide 即正常 |

### 关键文件变更

| 文件                          | 改动                                                           |
| ----------------------------- | -------------------------------------------------------------- |
| `model_factory.html`          | +buildProfiledExtrude(~95 行) + createGeometry case + GUI 面板 |
| `models/tiger_v16_builder.js` | 炮塔主体 Box→ProfiledExtrude + 12 参数                         |

### 已知问题（同 v0.65.9）

1. avg fps 41.5 仍非稳定60(剩余GC 20ms)，待P-burst-3续做
2. 坡地一头翘起一头陷地(坦克/敌人偶发)
3. 对山丘目标弹道偏低
4. 六足武器俯仰旋转轴不正确(待校准)

---

## v0.65.9 本次会话变更 (2026-06-30)

### 模型工厂框选交互 + 批量滑块 bug 修复

- **Ctrl+左键框选**：`setupRaycaster` 加框选模式（maybeBox→拖拽>4px 转 boxActive），Ctrl+down 立即暂停 OrbitControls，青色选择框；绑定已存在但从未调用的 `boxSelect()`
- **Shift+Ctrl+左键增选**：橙色选择框，追加不清空、不重置滑块；Ctrl+框选=替换+重置滑块；Ctrl+点击(未拖)=toggle 保留
- **批量滑块切换重置修复**：累积式滑块(ΔX/Y/Z + ΔRX/RY/RZ)的 `_prevBatch/_prevRot` 在 `buildGUI` 闭包不随选择重置 → 换一批部件后 Δy 残留上次值需填双倍。**修复**：模块级 `batchState` + `resetBatchSliders()`（清 6 值 + updateDisplay），在单选/框选/全选/清空调用；Ctrl+点击追加不调（保留连续编辑）
- **左上角 #info 操作提示区**：重组 4 行（视角/选择/框选/快捷键），颜色对应交互（框选青/增选橙），max-width:340px
- **改动**：`model_factory.html`（setupRaycaster 重写 + boxSelect additive + resetBatchSliders + #info）

### tank-track-fit 履带绕紧 skill（可复用）

- **新建** `.claude/skills/tank-track-fit/`：SKILL.md(6 段封闭路径模型图解) + `compute_track_params.py`(自动算 trackParams) + `verify_track_fit.py`(Playwright 截图 + PIL 像素验证)
- **流程**：读轮子位置 → node eval 解析配置(兼容 JSON/JS 字面量, 格式化器转换) → 转履带组局部坐标 → 复现 6 段周长算 count → `--apply` 写回 → 像素测间隙(<3px=紧贴, 避免肉眼/AI 视觉误判)
- **触发**："绕紧履带/调整履带/履带脱空"。任意"诱导轮前+主动轮后+等高负重轮"拓扑坦克可用(T-34/虎式/未来新坦克)
- **踩坑固化进脚本**：格式化器 JSON→JS 字面量(node eval 兼容) / Windows GBK(stdout reconfigure utf-8) / lil-gui select value=显示文本 / 项目用 node playwright(subprocess 调 node)

### TrackChain 几何参数化

- `model_factory.html` `buildTrackChain`/`getTrackPlateTransform` 加 `roadWheel*` 参数(roadWheelFrontZ/RearZ/Y/Radius)，**默认值=T-34 原值(零回归)**
- 虎式 trackParams 改真实轮子坐标(诱导轮 Z=2.5/Y=0.85/r=0.4，主动轮 Z=-2.9/Y=0.6/r=0.45，负重轮 Z=±1.7/Y=0.55/r=0.48)，履带组局部系

### 缓存 & localStorage 覆盖根治

- **server.py no-cache 头**：`end_headers` override 发 `Cache-Control:no-store`（`SimpleHTTPRequestHandler` 默认不发, 浏览器启发式缓存 .js 导致 Ctrl+F5 都难清）
- **autoLoad 不再覆盖文件**：之前 localStorage 旧配置 `Object.assign` 覆盖文件新值("改文件不生效"真凶, Ctrl+F5/no-cache 都管不到 localStorage)；改为只恢复"上次模型类型", 配置以源文件为准
- **\_doSave 去 JSON 下载**：固化(/api/solidify)正常, 移除下载备份(避免下载文件夹堆同名文件)
- **多 python 残留**：两个进程同 LISTENING 8080 导致连到旧进程(无 no-cache 头)→ 杀光残留起单一服务

### 关键文件变更

| 文件                             | 改动                                                                                            |
| -------------------------------- | ----------------------------------------------------------------------------------------------- |
| `model_factory.html`             | setupRaycaster 框选/增选 + boxSelect additive + resetBatchSliders + #info + autoLoad + \_doSave |
| `server.py`                      | end_headers override 加 no-cache 头                                                             |
| `js/engine.js`                   | console.log 版本号                                                                              |
| `models/tiger_v16_builder.js`    | TIGER_I_V16_CONFIG trackParams 固化(诱导轮/主动轮真实坐标)                                      |
| `.claude/skills/tank-track-fit/` | 新建 skill(SKILL.md + 2 脚本)                                                                   |

### 已知问题（更新）

1. avg fps 41.5 仍非稳定60(剩余GC 20ms)，待P-burst-3续做
2. 坡地一头翘起一头陷地(坦克/敌人偶发)
3. 对山丘目标弹道偏低
4. 六足武器俯仰旋转轴不正确(待校准)

---

## v0.65.8 本次会话变更 (2026-06-29)

### 模型工厂固化一键保存

- **server.py**：自定义 HTTP 服务器，基于 `http.server.SimpleHTTPRequestHandler`，新增 `POST /api/solidify` 端点
- **固化端点**：接收 `{modelType, config}` JSON，括号匹配定位源文件中 `const XXX_CONFIG = {...};` 并替换，支持 tiger_v16/tank_v16/hexapod 三种模型
- **Ctrl+S 三合一**：`_doSave()` 函数同时执行 ①POST 固化到源文件 ②存 localStorage ③下载 JSON 备份
- **启动方式**：`python server.py`（替代 `python -m http.server`）
- **涉及文件**：`server.py`（新建 145 行）、`model_factory.html`（`_doSave()` + 2 处调用）、`CLAUDE.md`（运行命令更新）

### 虎式坦克调试着色（模型工厂）

- **彩色材质**：扩展 `getMaterial()` hexapod 条件到 `tiger_v16`，新增虎式专用色：`camo_green`→亮绿 `#77DD44`、`camo_dark`→暗绿 `#558833`、`wood`→木棕 `#DD9944`。复用已有 `dark_steel`(蓝)、`barrel_steel`(红)、`steel`(紫)
- **部件轮廓线框**：`rebuildModel()` 线框创建从六足专用块分离为独立条件块（hexapod + tiger_v16 共享），网格编辑更新时同步重建
- **涉及文件**：`model_factory.html`（3 处条件扩展）

### 切换模型六足 UI 自动清理

- **`toggleHexTurnTest()` 守卫修复**：modelType 守卫从函数顶部移到 turn-ON 路径内（对齐 `toggleWeaponCalibrate()` 模式），turn-OFF 始终可用
- **`rebuildModel()` 清理顺序**：在移除旧模型**之前**统一清理 IK 测试+转弯验证+射击校准（确保 pivot/nodeMap 引用有效时执行场景清理）
- **`updateAnimButton()` 加固**：turn test 加 active 检查 + 直接隐藏 `weaponcal-panel`/`anim-list`/`anim-status` 面板
- **`ModelRegistry` 防御**：加 `if (window.ModelRegistry)` 守卫，防模型工厂页面未加载 registry 时报错
- **涉及文件**：`js/hexapod_factory.js`（守卫后移+暴露 `_hexTurnActive`）、`model_factory.html`（`rebuildModel()` + `updateAnimButton()`）

### UI 精简

- **移除冗余按钮**：📋 输出姿态、💾 应用到 Config、📥 导出JSON固化、📂 加载（共 4 个），全局操作只剩 撤销/保存/重置
- **BoxHelper 默认关闭**：`showHelpersGlobal = false`，按钮仍可手动开启

### 关键文件变更

| 文件                          | 改动                                                                                   |
| ----------------------------- | -------------------------------------------------------------------------------------- |
| `server.py`                   | 新建 — 开发服务器+固化端点                                                             |
| `model_factory.html`          | `_doSave()` 保存函数 + 虎式着色(3处) + 六足UI清理(2处) + 删冗余按钮 + BoxHelper 默认关 |
| `js/hexapod_factory.js`       | `toggleHexTurnTest()` 守卫修复 + `_hexTurnActive` 暴露                                 |
| `models/tiger_v16_builder.js` | `TIGER_I_V16_CONFIG` 固化（用户手动调整）+ `ModelRegistry` 防御                        |

---

## 地面纹理改进方案调研 (2026-06-26)

### 道路/广场马赛克 3 大根因（已定位）

1. **splatMap 整数硬切**（`mapLoader.js:413`）：每 cell 单类型，边界像素级锯齿、无羽化。草地笔触随机掩盖硬切，asphalt/concrete/brick 图案规整 → 强马赛克
2. **2048 合成贴图 + 规整重复**（`mapLoader.js:562/600`）：`texTile=worldSize/8≈25m`，同一 256px tile 每 25m 原样重复 → aliasing
3. **主路浮空单色 strip**（`obstacles.js:186` `_roadMat` 纯色 `#4a4a4a`；`:330` `mainOff` 浮空）：与地面沥青割裂

### splat shader 软混合方案（一期，治本）

- **从"1 张 2048 合成贴图"改为"6 张高频 tile + splatMap DataTexture + onBeforeCompile 注入"**
- **手动双线性采样 splatMap** → 4 邻域 cell 按权重混合 → 软边界（根治硬切）
- **tile UV 高频平铺 + hash 随机旋转**（0/90/180/270°）→ 消除规整重复 aliasing
- **编辑器+运行时共享** `applySplatShader()` 函数 → 所见即所得
- **兼容 vertexColors**（编辑器水体）、PBR 光照/阴影/雾不动

### 主路拱顶倒角管道 + 标线方案（一期）

- **buildRoadStrip 截面泛化**：矩形截面 → 路拱顶（crown=0.08m）+ 边缘埋地倒角（-0.4m 吸收地形起伏）
- **去浮空贴地**：roadCenterY = getTerrainHeight()，边缘埋地容差 ~0.4m
- **标线**：路径 UV（U=弧长, V=横向）→ 中线虚线 + 边线实线，随拱微弯（真实道路排水造型）
- **parallel transport**：复用现有 `-dz/segLen,dx/segLen` 稳定 up 向量法

### 路口扩展可行性（预留，一期不做）

- **路段(segment)+路口(junction)两层架构**：管道扫掠路段+路口平整 patch，不相冲
- **数据结构预留**：`roadSystem.roads` 数组、手画路路径持久化（当前路径画 splatMap 即丢）
- **路口检测**：线段相交 O(n²) + 路口区域多边形 + 停止线/斑马线 → 全确定性几何

### 一期实现计划

详见 `~/.claude/plans/quirky-hatching-rainbow.md` | 范围：splat shader + mainRoad 管道标线 + 路径预留 | 留 milestone：手画路管道/路口/路面整形

---

## v0.65.5 本次会话变更 (2026-06-25)

### 树冠阴影透明 proxy（推翻 v0.65.4 物理遮挡方案）

- **背景**: v0.65.4 用"物理遮挡藏小 proxy"（缩到核心球簇 r=0.13），阴影只剩树冠一半像树干影
- **根因**: v0.65.4 踩坑只测了 `layers`/`colorWrite`，未测 `transparent+opacity=0` 方案
- **修复**: proxy 改透明——`proxyMat = MeshBasicMaterial({transparent:true, opacity:0, depthWrite:false})` + `castShadow=true`。主通道透明看不见，阴影 pass 用独立 DepthMaterial 只看几何不看材质透明度，照常投阴影。proxy 放大到 r=0.22 覆盖整个树冠投完整树荫
- **原理**: Three.js 两遍渲染，主 pass 看材质（opacity=0 不可见），阴影 pass 看几何（DepthMaterial 不读透明度），互不干扰
- spherical/oak 用透明 proxy（r=0.22, y压扁0.72/0.85）；conical 保持直接 castShadow（448三角质量最好，不适合球proxy）

### proxy 生命周期修复（摧毁后阴影残留）

- **根因**: obstacleData 只存 imTrunk/imCrown，disposeTreeInstance 隐藏时漏 proxy → 树摧毁后 proxy 阴影残留地面
- **修复**: spherical/oak 的 obstacleData 加 `imProxy` 字段 + disposeTreeInstance 同步隐藏 proxy 实例（一处覆盖全部 5 个调用点）

### 环境对象开发规范文档

- 新增 `docs/obstacle_conventions.md`：新增建筑/树木种类的规范（3铁律：IM强制/材质全局化/dispose分级 + 建筑 checklist + 树木 checklist含阴影决策树 + 生命周期同步 + 8条反面清单）
- CLAUDE.md 文件结构 + 详细文档段加索引

### 尺度标定（METERS_PER_UNIT 4.706→1.3）

- **根因**: `METERS_PER_UNIT=8/1.7≈4.706` 偏大 3.6 倍，障碍物"米"配置被压缩（3m 树渲染 0.64 单位 = 坦克 32%，像草）
- **标定**: 真实 T-34/85 高 2.6m（Tanks Encyclopedia）÷ 坦克渲染 1.99 单位（MCP 实测）= 1.306，取 1.3
- **策略（保持视觉，不全局放大）**: METERS_PER_UNIT→1.3；障碍物 targetHeightMinM/MaxM 改真实米数（新值=旧渲染单位×1.3，保持视觉），下限"像草"的调高到坦克 75%+
  - conical 3~~15→2~~4.2 | spherical 3~~14→2~~3.9 | oak 4~~18→2.5~~5 | bungalow 2~~12→2.5~~3.3 | villa 6~~20→3~~5.5 | apartment 15~~35→4.2~~9.7 | windmill 10~~20→2.8~~5.5
- 裸单位参数（地图/AI/fog/阴影/速度）数值不变，米含义基于 1 单位=1.3m 自动正确
- 地图编辑器尺寸 UI 显示米（×1.3）：info-size/overlayInfo/4滑块 min/max/value 米化，内部仍存单位

### 关键文件变更

| 文件                                                      | 改动                                                                              |
| --------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `js/obstacles.js`                                         | 透明 proxy（proxyMat+makeCrownProxy r=0.22）+ imProxy 生命周期 + conical 注释修正 |
| `js/engine.js`                                            | METERS_PER_UNIT = 1.3（标定注释）                                                 |
| `models/buildings.js`/`trees.js`/`windmill.js`            | 7 处 targetHeightMinM/MaxM 真实米数                                               |
| `map_editor.html`                                         | 尺寸 UI 米显示（info-size/overlayInfo/滑块米化）                                  |
| `docs/obstacle_conventions.md`                            | 新建环境对象规范文档                                                              |
| `CLAUDE.md`/`CODEBUDDY.md`/`.trae/rules/project_rules.md` | 尺度标定段 + 规范索引                                                             |

### 已知问题（更新）

1. avg fps 41.5 仍非稳定60(剩余GC 20ms来自未池化spawn)，待P-burst-3续做
2. 坡地一头翘起一头陷地(坦克/敌人偶发)
3. 对山丘目标弹道偏低
4. 六足武器俯仰旋转轴不正确(待校准)

---

## v0.65.4 本次会话变更 (2026-06-25)

### 树冠阴影恢复（shadow proxy）

**背景**: v0.64.0 为省阴影开销把树冠 castShadow=false（树冠无影子，只有树干）。用户要求恢复树冠影子。

**方案**（per perf plan P0-2）:

- **spherical/oak（圆形树冠）**: 极简 proxy IM（IcosahedronGeometry 20面球，半径=crownGeo包围球×0.8），castShadow=true 投影；proxy 球缩小藏入树冠内部，靠不透明树冠物理遮挡（主通道看不见）。阴影开销 20三角/棵 vs 精细树冠 8000三角/棵。
- **conical（尖锥松树）**: 扁平三角棱柱(448三角/棵)藏不住球 → 直接 crownIM.castShadow=true 投影。

**踩坑（Three.js r160 实测，重要）**:

- ❌ layers 不可行：proxy.layers.set(1)+sunLight.shadow.camera.layers.enable(1)，阴影相机仍看不到 layer1 → 不投影
- ❌ colorWrite=false 不可行：连带跳过阴影 pass
- ✅ 最终：proxy 藏树冠内靠物理遮挡（不依赖 layers/colorWrite）

**改动**: `js/obstacles.js` makeCrownProxy 辅助 + spherical/oak 接入 + conical castShadow=true。
**验证状态**: ⚠️ 已实现+node check通过+spherical/oak proxy 截图确认被圆形树冠遮挡+有影子。**待明早多角度验证 proxy 不露出 + 阴影开销实测 + 多次进出 dispose 安全**。

---

## v0.65.1 本次会话变更 (2026-06-24)

### 坦克AI远距离对峙/出界修复

训练场坦克对攻偶发"两车远远对峙不开炮"(用户睡午觉回来发现, 敌方出地图边界进虚空)。诊断观测: state=chase, dist=118.8m, fireTimer=-152(152s没开炮), ePos=[-116,163]贴近虚空边界。

**根因**: updateChase 不区分"超视野距离"和"地形遮挡", 一律侧向迂回; 侧向目标=`enemy+侧向×30`是纯侧向不朝玩家 → 持续侧推 → moveEnemyToward无边界约束 → 推出地图进虚空 → 越来越远卡CHASE(state≠engage不开炮)。之前的retreating修复是另一个bug(ENGAGE振荡), 非此对峙根因。

- **updateChase 区分超距离/遮挡**(`combat/enemyAI.js`): `dist>viewDist`直线追近(不再侧向, 否则永远追不上); 视野内地形遮挡时侧向目标朝玩家(`pp+侧向×10`, 既靠近又绕遮挡)
- **moveEnemyToward 边界 clamp**: `window.worldHalfW/D`(150)硬限制, 任何情况推不出地图
- **(顺带)updateEngage retreating 判断修正**: `radialW<-0.3`→`>0.3`(原方向反: 偏远靠近radialW=-1被误判倒车→ENGAGE振荡); wr加`shellRange||engageDist`fallback(坦克实际flameRange=55)

### 训练场对攻性能优化(P-burst, 目标稳定60fps)

性能基准测试定位: 坦克对攻瓶颈是**CPU端burst(战斗阶段)**, 非GPU渲染。最坏帧150ms中~37ms是GC停顿。文档原优化方案(`docs/perf_optimization_plan.md`, 降DC/三角/阴影)针对稳态渲染, 不解决spike → 重新评估后新增P-burst方向。

- **P-burst-1 炮弹循环临时向量复用**(`js/engine.js`): prevPos用`_shellPrev` ping-pong缓冲(免每帧clone污染扫掠碰撞), lookAt/velDir/moveVec复用`_shellTmpA/B/C`; gameLoop+updateShellsFragsMuzzle两份循环同改。**战斗阶段burst 29.48→13ms**
- **P-burst-2 碎片对象池**(`js/shells.js`+`js/engine.js`): `_fragGeo`共享单位Box(大小用mesh.scale)+`_fragPool`+`_acquireFrag`/`_releaseFrag`; `_spawnSparkParticles`/`spawnFragments`/`spawnGroundDebris`改从池取; 5处fragments销毁+5处groundDebris销毁全改`_releaseFrag`回收(共享geometry绝不dispose, 漏一处dispose全毁)。**GC停顿 37→20ms, 碎片池复用59个**
- **累计**: 最坏帧 150→50ms(**-67%**), GC 37→20ms(**-46%**); p50=16.7ms(60fps)不变(稳态未动,符合预期)
- **关键诊断法**: tab后台raf暂停致采样失败(`visibilityState=hidden`, perf_monitor/injected采样全失效); 改用setInterval+localStorage监控; 4阶段perfAcc采样(4阶段max和 vs 帧max 差额=GC停顿估计)

### 已知问题(更新)

1. ~~坦克AI托管: 偶发敌方驶入池塘~~ + ~~偶发远距离对峙/出界~~ **v0.65.1 已修复**(updateChase超距离直线追+moveEnemyToward边界clamp)
2. avg fps 41.5仍非稳定60(剩余GC 20ms来自未池化spawn: 炮弹mesh/ringFX/ExplosionEffects), 待P-burst-3续做
3. 坡地一头翘起一头陷地(坦克/敌人偶发)
4. 对山丘目标弹道偏低
5. 六足武器俯仰旋转轴不正确(待校准)

---

## v0.65.0 本次会话变更 (2026-06-23)

### 坦克AI托管完整修复（10层根因）

训练场敌我坦克AI托管从"双方不动"逐层修到"双方移动+炮塔追踪+双向对攻+多轮复活稳定"。每层独立根因:

1. **player1无.position**(包装对象vs敌方Object3D): `updateEnemyAI(player1)`抛TypeError中断帧 → 加Object3D兼容接口(position/rotation/userData引用group); findNearestPlayer兼容target位置(`p.group?p.group.position:p.position`)
2. **朝向约定**(enemyAI硬编码车头-X, 坦克实际+Z): 加`enemyForward/enemyTargetYaw/enemyIsTank`helper按cfg.type选约定; canSeeTarget/moveEnemyToward/updateEngage/aimTurretAt统一调用
3. **玩家不开炮**: `fireEnemyTrainingShell`硬编码朝player1; 提取`_spawnTrainingShell`共享 + 新增`firePlayerTrainingShell`(owner:player1,isEnemyShell:false) + 玩家AI块开炮(命中借2503行`s.owner===player1`)
4. **炮塔不转**: gameLoop:2220每帧覆盖`player1.turretPivot=turretYaw`; AI托管跳过2220/2223覆盖(让aimTurretAt独占)
5. **视角跟车体**: `cameraYaw=炮管世界方向`(atan2(bd.z,bd.x), 对标手柄1381)
6. **敌人侧滑**: updateEngage前进用转向前朝向 → 改转向后重算enemyForward(履带式先转再走)
7. **车头90°/炮击低**: 敌方模型7228旋转-90°(车头+Z→+X)与AI+Z约定不符 → 删旋转; CHASE→ENGAGE改全向π(极近绕圈canSeeTarget视野锥不满足)
8. **玩家不动**: resetTank设POINT_A[0,0]+gameLoop 1895/2207双向同步循环(group↔tankState互相覆盖) → enterTrainingMode设group.position(出生点)+group.rotation.y(朝敌方)
9. **复活后不动**: `_killEnemyInTraining`/`_killPlayerInTraining`只设dead不设hp=0, 复活检测`hp<=0` → kill函数加hp=0(防御状态一致); PATROL→CHASE改距离only(去canSeeTarget地形误判); 玩家复活路径朝向(group.rotation.y=π/2-yaw)
10. **复活远卡住**: A复活获知(敌方复活设玩家ai.state=chase+target+lastSeenPlayerPos) + B PATROL搜寻(updatePatrol无patrolPath时朝lastSeenPlayerPos移动/到达探索)

### 池塘空气墙验证

三方均调`checkCollision`(含池塘1274+河流1244): 玩家坦克(engine:2071/2102)、敌方坦克(engine:3831)、敌六足(engine:3347)、玩家六足(hexapodPlayer:1183 via window.checkCollision)。`window.checkCollision/isInRiver/isInPond`均已暴露。Playwright实测敌方30s+引诱均未入池塘。**偶发入水难复现**。

### 关键文件变更

| 文件                       | 改动                                                                                                                                                                                                |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `js/engine.js`             | player1 Object3D兼容 + 玩家AI块开炮 + placeCamera视角跟炮管 + resetTank初始化group + 复活朝向/状态hp=0 + 敌方复活获知玩家 + `_spawnTrainingShell`/`firePlayerTrainingShell` + 删7228模型旋转        |
| `combat/enemyAI.js`        | `enemyForward/enemyTargetYaw/enemyIsTank`helper + canSeeTarget/moveEnemyToward/updateEngage/aimTurretAt按约定 + PATROL→CHASE距离only + CHASE→ENGAGE全向π + updatePatrol搜寻 + findNearestPlayer兼容 |
| `docs/ai-search-design.md` | 新增: AI搜寻设计(A+B)                                                                                                                                                                               |

### 已知问题

1. 坦克AI托管: 偶发敌方坦克驶入池塘(难复现, checkCollision代码层面生效)
2. 坡地一头翘起一头陷地(坦克/敌人偶发)
3. 对山丘目标弹道偏低
4. 六足武器俯仰旋转轴不正确(待校准)

---

## v0.64.0 本次会话变更 (2026-06-23)

### 训练场AI托管系统

- **玩家AI托管**: 训练配置新增"🤖 我方AI托管"复选框（AI托管/手动操控），默认AI托管
- **六足AI托管**: `hexapodPlayer.js` AI分支调用 `updateHexapodEngage` 驱动机体（绕圈+武器决策），桥接AI武器指令到玩家射击系统（加特林spinUp同步、导弹直接发射），复活后重置 bodyYaw/targetYaw 防朝向漂移
- **坦克AI托管**: engine.js 游戏循环内复用 `EnemyAI.updateEnemyAI` 控制玩家坦克（巡逻→追击→绕圈+炮塔瞄准+开火），跳过原有 WASD/鼠标/updateAiming
- **视角自动跟随**: `placeCamera()` AI模式用 `getPose().yaw` + tank `cameraYaw`（非鼠标手控）
- **武器参数对齐**: 敌我加特林射程统一50m（maxDist + gatlingRange），子弹碰撞用 `checkCollision` 替代 Raycaster

### 性能优化

- **CCD矩阵局部化**: `_ccdLeg` 迭代内 `root.updateMatrixWorld(true)`（全六足树~50节点）→ 首次全树 + 后续仅本腿子树（~~5节点），节点访问量降~~12倍；IK 耗时从 22ms→9ms，fps +54%
- **子弹碰撞空间网格**: 玩家加特林子弹 `Raycaster.intersectObjects(obsMeshes)` → `window.checkCollision(pos, 0.15)`（空间网格 O(1)），raycast 7.6ms→~3ms
- **树冠+建筑阴影优化**: 三类树冠+建筑IM `castShadow=false`（树干保留），减少阴影caster
- **HEX_CCD_SCALE开关**: `hexapod_core.js` stepGait 加全局缩放因子（默认1.0保持原质量），工厂页面设 `window.HEX_CCD_SCALE=1.0`

### 关键文件变更

| 文件                                    | 改动                                                                                |
| --------------------------------------- | ----------------------------------------------------------------------------------- |
| `js/engine.js`                          | +AI托管逻辑（坦克/六足）+ placeCamera AI跟随 + 出生点±4m + 训练UI绑定 + 敌参数对齐  |
| `js/playerControllers/hexapodPlayer.js` | AI分支（updateHexapodEngage + 武器桥接 + 复活修复 + 加特林俯仰)+ 子弹checkCollision |
| `js/playerControllers/manager.js`       | +isAiDriven() 接口（供 placeCamera 探测）                                           |
| `js/hexapod_core.js`                    | \_ccdLeg 局部矩阵更新 + HEX_CCD_SCALE 开关                                          |
| `combat/enemyAI.js`                     | updateHexapodEngage 导出到 window.EnemyAI                                           |
| `index.html`                            | AI托管UI复选框                                                                      |

### 性能基线

- 六足对攻（双方CCD IK+加特林+导弹）: 22.5→37.4 fps (+66%)
- 坦克对攻（无CCD IK，纯AI+物理）: 待测

### 已知问题

1. 坦克AI托管首版（复用EnemyAI），位置同步有一帧延迟，持续测试中
2. 六足AI托管中距离二人转+导弹射程匹配问题已修复
3. 坡地一头翘起一头陷地（坦克/敌人偶发）
4. 对山丘目标弹道偏低
5. 六足武器俯仰旋转轴不正确（待校准）

---

## v0.62.0 本次会话变更 (2026-06-19~20)

### 玩家六足加特林实装

- **左右独立控制**：左键→右加特林(模型名反)，右键→左加特林，各独立状态机
- **spinUp→射击**：按住0.8s达标→10rps射击→发热25/s→heat≥80过热停转→强制冷却28/s到0恢复
- **普通冷却**：松手18/s冷却，随时可恢复；过热强制冷却效率更高但锁定到0
- **枪管红热**：emissive lerp(冷钢0x5a5a64→红热0xff4400)，与热量成正比
- **过热反馈**：按键触发卡壳音(`playGatlingJamSound`)+头顶"过热"字样闪现1.5s+瞄准线全红
- **枪口焰+命中火花**：3-5个黄/橙色小球沿枪管飞出+`spawnSilentHitSparks`复用MG效果
- **全覆盖碰撞**：沿路径Raycaster横扫障碍物Mesh+地面高度+水面+敌人XZ距离，命中即停不穿透
- **击杀爆炸**：敌人HP归零→`spawnExplosion`+`spawnFragments`+`playExplosionSound`
- **射程提升**：25m→35m，瞄准线同步
- **观瞄球体HP发光**：`观瞄球体_mesh`克隆材质，绿(满血)→红(空血)渐变

### 玩家六足导弹系统实装

- **空格键锁定制导**：锁定框跟随光标(300×200px)，敌在框内按空格→绿圈缩1s→红圈+锁定音→松开发射
- **锁定状态机**：IDLE→LOCKING(敌出框/松手/死亡→取消)→LOCKED(敌出框不取消，死亡才取消)→松手发射
- **超出距离/装填中**：超50m或框内无敌→"超出距离"；双巢无弹→"装填中"；按住空格持续显示+按瞬间播一次失败音
- **交替发射**：左右导弹巢轮流，单侧4发用尽自动跳对侧；双空时锁定框红闪+按空格失败音
- **装填10s**：弹药归零启动，3D装填条挂六足两侧(仿坦克bars.js，世界坐标定位面朝摄像机)
- **导弹参数对齐敌方**：speed=20, damage=25, blastRadius=1.5, maxTurnRate=1.2, boost=0.25s, maxFlight=8s
- **无射程限制**：追踪lastTargetPos(目标死后追最后位置撞地)，仅撞地或8s超时自毁
- **PCM扩展**：input新增`spaceDown/spaceJustPressed/camera/mouseX/mouseY/obstacleMeshes`
- **音频新增**：`playLockOnSound`(双频电子嘀声)、`playGatlingJamSound`(金属卡壳)
- **window桥接**：`enemies`/`obstacleMeshes`/`obstacleData`暴露到window供模块化控制器访问

### Bug修复

- **MG禁用**：`mg.js:updateMGAutoTarget`增加`!player.mgGroup`判断，六足模式不自动射击
- **子弹穿模**：改用XZ平面距离+Raycaster横扫障碍物，替代3D距离(避免Y差误判)
- **敌人不爆**：`onEnemyDamaged`返回值触发`spawnExplosion`+`spawnFragments`
- **重生朝向**：onRespawn用六足公式`rotation.y = π - cameraYaw`覆盖引擎坦克默认值
- **观瞄球体劫持**：克隆材质防共享，敌人逻辑不再影响玩家
- **锁定圈竖线**：移除`rotation.x = -π/2`(LineLoop点已在XZ平面)
- **装填条飞天**：改`_scene.add`世界坐标(原`_root.add`当本地偏移)

### 关键文件行数变化

- `hexapodPlayer.js`: ~160→~1050行
- `audio.js`: ~240→~310行
- `engine.js`: ~6100→~6250行
- `index.html`: ~780→~800行
- `hexapod_aimLine.js`: ~260→~270行
