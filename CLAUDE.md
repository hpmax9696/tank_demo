# CLAUDE.md

3D 坦克对战游戏 — Three.js r160 浏览器游戏 + 地图编辑器 + PvE 战斗 | v0.61.3

## 运行

```bash
python -m http.server 8080 --bind 127.0.0.1
```
访问 `http://127.0.0.1:8080`（必须 127.0.0.1，禁止 localhost）

提供 `preview_url` 前：先杀残留 Python 进程，再启动单一服务，确认就绪后才调用。

## 文件结构

```
├── index.html         # 核心游戏引擎 (~780行)：UI框架+菜单+脚本加载
├── js/engine.js        # 游戏引擎 (~6100行)：状态机/场景/物理/瞄准/摄像机/AI/训练场/狙击
├── js/                # 游戏模块（14个）
│   ├── waters.js      # 水体模块 (~317行)：池塘水面+河流alphaMap遮罩平面+碰撞体+动画
│   ├── bridges.js     # 桥梁模块 (~165行)：编辑器桥+参数化桥+碰撞检测+可视化
│   ├── debugcolliders.js  # 碰撞可视化 (~122行)：F3切换(默认关)，从运行时数据反向生成
│   ├── obstacles.js   # 环境对象 (~794行)：树木/建筑/InstancedMesh管理
│   ├── shells.js      # 炮弹系统 (~309行)
│   ├── audio.js       # 音频系统 (~240行)
│   ├── fireSmokeParticles.js  # 粒子系统 (~536行)
│   ├── mg.js          # 机枪系统 (~198行)
│   ├── bars.js        # UI 血条/装填条 (~80行)
│   ├── input.js       # 输入处理 (~70行)：WASD+手柄5段力度
│   ├── spatialGrid.js # 空间网格 (~110行)
│   ├── sky.js         # 动态天空系统 (~200行)：渐变穹顶+噪声云层+太阳光晕
│   ├── three.min.js   # Three.js r160 压缩库
│   └── BufferGeometryUtils.js  # Three.js 工具函数
├── models/hexapod_config.js # 六足战车共享模型配置+动画参数表：3节腿(大腿+小腿+尖刺足)+4DOF+ANIM_TABLE(23项)+腿配置
├── js/hexapod_core.js        # 六足CCD IK核心模块 (~920行)：纯计算层，模型工厂+游戏共享，hipAxis/bodyWriter参数化
├── js/hexapod_factory.js     # 六足工厂适配器 (~600行)：nodeMap→legRefs+IK测试+转弯验证+武器校准
├── js/hexapod_enemy.js       # 六足游戏适配器 (~230行)：getObjectByName→legRefs, bodyWriter=false; 卡住检测(敌人); bodySpeed用desiredVel
├── js/hexapod_probe.js       # 六足步态测量探针 (~190行)：stepGait末尾采样左前腿; F7/F8快捷键; __hexProbeStart/Stop/Stats/Compare; localStorage持久化
├── js/playerControllers/     # 模块化玩家角色控制器 (可插拔)
│   ├── manager.js            # PlayerControllerManager (~80行)：注册表+当前角色+update分发+能力探测
│   └── hexapodPlayer.js      # 六足玩家控制器 (~160行)：WASD+鼠标转向; 复用HexapodEnemy管线; _isPlayer支撑相plantPos
├── map_editor.html    # 地图编辑器 (~1800行)：v0.53.0
├── js/editor_*.js     # 编辑器模块（6个）
│   ├── editor_terrainGen.js  # 地形+村落生成 (~750行)：双管线(地形/村落)+掩码网格+FloodFill+A*+容量预验证
│   ├── editor_genStatus.js   # 生成状态面板 (~120行)：实时进度+统计+质量评分+自动隐藏
│   ├── editor_entities.js    # 实体管理 (~645行)：标记+CRUD+配置面板+列表+建筑朝向(yaw)
│   ├── editor_waterBridge.js # 水体桥梁 (~659行)：水面+河床+桥梁检测
│   ├── editor_data.js        # 数据持久化 (~503行)：蓝图+JSON+init
│   └── editor_terrainPaint.js # 地形绘制 (~335行)：笔刷+高度图画布
├── model_factory.html # 程序化模型编辑器 (~2428行)
├── models/            # 模型文件 (GLB主力 + 程序化兜底)
├── maps/              # .map.json 地图配置
├── combat/            # AI状态机 + 积分系统
├── docs/              # 协作文档
└── CODEBUDDY.md       # 详细架构/参数/已知问题/待办 → 查阅细节时读它
├── AGENTS.md           # Codex 专属文档（本次新增）
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

## 生成管线（v0.51.0 新增）

三个按钮驱动两条独立管线：

| 按钮 | 函数 | 说明 |
|------|------|------|
| 🎲 一键全部 | `generateAll()` | 管线A→管线B，完整地图 |
| 🌍 仅生成地形 | `generateTerrainOnly()` | 管线A：FBM→自动平整→生态区→池塘。结束后可手画河流 |
| 🏘️ 生成道路与村落 | `generateRoadsAndVillages()` | 管线B：读当前terrain+water→掩码→主干道→FloodFill→选址预验证→落地→树木→桥梁 |

### 管线A（仅地形）
FBM高程 → 自动平整（保峰压谷） → 生态区分区 → 池塘

### 管线B（道路+村落+障碍物）
构建掩码（MG_BUILDABLE/FORBIDDEN/WATER/ROAD）→ A*主干道 → Flood Fill区域分割 → 村落选址+容量预验证 → 落地（广场整平+村路+建筑+连接路）→ 分层采样树木 → 桥梁检测 → roadSystem存储

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

| 配置项 | 可选值 |
|--------|--------|
| 我方 | 坦克、六足(灰色不可选) |
| 敌方 | 坦克(T-34/85全参数对齐)、**六足(CCD IK动画)**、突击车、丧尸 |
| 敌方行为 | 主动攻击(出生即追击)、反击(受击才还手)、不反击(完全被动) | 坦克速度6.0, 炮塔转速1.0 | |

- **敌方T-34坦克**：HP/速度/炮弹/MG/过热参数全面对齐玩家，炮塔独立瞄准+炮管俯仰+弹道重力补偿
- **敌方六足(v0.57.0 CCD IK)**：`js/hexapod_enemy.js`多实例CCD IK+三角步态+踉跄+死亡。homeOffset相对定位防下陷，髋Z轴修正，动态步幅自适应速度。加特林+导弹独立武器系统，MG不触发踉跄
- **无限重生**：敌我死亡1s后在出生点重生，玩家被火焰/丧尸击杀也复活。ESC退出训练
- **敌方AI**：`engageDist:30`(六足)/`50`(坦克)，`gatlingRange:30`，CHASE阶段追击，ENGAGE阶段绕圈攻击
- 相关变量：`isTrainingMode`, `trainingPlayerSpawn`, `trainingEnemySpawn`, `trainingRespawnQueued`
- **已知问题(v0.59.2)**：敌人上坡后偶发不复活；复活后偶发不追击；坡地地形适配不完美(翘头/陷地)；对山丘目标弹道偏低；上坡悬浮

## 详细文档

查看 **CODEBUDDY.md** — 关键参数表、架构详解、已知问题、待完成任务、交接流程

---

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
- **engine.js 6处PCM守卫**：gameLoop(1466)/enterTrainingMode(5135)/placeCamera(3170)/_processTrainingRespawn(4065)/returnToMenu(5011)/updateTrajectoryLine(1254)
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
- **根因4 pitch/roll 轴互换（最隐蔽）**：六足车头本地 **−X**（坦克是 −Z），YXZ 下 `rotation.x`=侧倾、`rotation.z`=俯仰，与坦克**相反**；原代码照坦克赋值（rotation.x←pitch, rotation.z←roll）→ 正对坡顶（前后落差）错误地变成侧倾。**修复**：`_rollT` 去负号 + 交换赋值（`rotation.x`←侧倾 _smRoll，`rotation.z`←俯仰 _smPitch）
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
- **改动**：hexapodPlayer.js（RUN_SPEED + _isRun 判定 + desiredVel 用 _spd）+ hexapod_enemy.js `_animRequestToIndex` 加 `move_forward_run→2`、`move_backward_run→4`
- **验证**：Playwright 键盘W→animIndex2/vel5，低力度0.5→animIndex1/vel1.25；CDP 0 错误
