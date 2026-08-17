# CODEBUDDY.md — v0.79.34

This file provides guidance to CodeBuddy when working with code in this repository.

## ⚠️ 每次提供预览前必须执行（AI 必读）

提供 `preview_url` 之前，必须先确保 HTTP 服务符合以下规则，否则会出现 `chrome-error://chromewebdata/` 错误：

1. **清理残留进程**: 先杀掉所有 Python 进程
   ```powershell
   Get-Process python -ErrorAction SilentlyContinue | Stop-Process -Force
   ```
2. **启动单一服务**: `python -m http.server 8080 --bind 127.0.0.1`
3. **验证唯一进程**: `netstat -ano | findstr ":8080.*LISTENING"` 应只显示一行 `127.0.0.1:8080`
4. **使用 127.0.0.1**: preview_url 用 `http://127.0.0.1:8080`，禁止用 localhost
5. **先启动再预览**: 确认服务就绪后才调用 `preview_url`

## 🤖 多 AI 协作（v0.59.2 新增）

本仓库同时由 4 个 AI 工具协作开发，各有专属文档：

| AI 工具     | 专属文档                     | 职责偏重                 |
| ----------- | ---------------------------- | ------------------------ |
| Claude Code | CLAUDE.md                    | 架构级重构、复杂新功能   |
| CodeBuddy   | CODEBUDDY.md                 | 详细参数表、已知问题清单 |
| Trae        | .trae/rules/project_rules.md | 跨会话规则、文件行数     |
| Codex       | AGENTS.md                    | 即时修复、调试排查       |

⚠️ 修改任意一个专属文档后，应同步更新其他 3 个的相关部分。

## 开发环境

**启动本地服务器**（必须，GLB 模型需要 HTTP 协议）:

```bash
# 方式1: 双击 start-server.bat（推荐，自动清理端口+打开浏览器）
# 方式2: 命令行手动启动
python -m http.server 8080 --bind 127.0.0.1
```

**访问地址**: `http://127.0.0.1:8080`（必须用 127.0.0.1，不要用 localhost）

**强制刷新**: `Ctrl+F5`（清除浏览器缓存）

**⚠️ 如果页面无法加载**: 关闭所有 Python 进程后重新运行 `start-server.bat`，脚本会自动清理端口。

```bash
# 手动清理命令（备用）:
Get-Process python -ErrorAction SilentlyContinue | Stop-Process -Force
```

**代码同步位置**: Gitee (origin) + GitHub (github) + OneDrive (`C:\Users\hpmax\OneDrive\共享软件\坦克对战demo\`)

## 版本号同步清单

每次更新必须同步以下 8 处版本号，否则调试信息与实际版本不一致：

1. `index.html` `<title>` 标签
2. `index.html` `.menu-version` 菜单显示
3. `index.html` `.changelog` 追加记录（⚠️ 追加后裁剪到最近5条，见下方规则）
4. `index.html` 调试信息版本号
5. `index.html` `console.log` 版本号
6. `README.md` 开头版本号
7. `README.md` 版本历史追加
8. `README.md` 代码规模注释

### ⚠️ 菜单 changelog 裁剪规则（强制执行）

菜单页面的 `.changelog` 区域**仅保留最近 5 条**版本记录（`cl-title`），多余的旧条目必须删除。否则会撑破菜单界面、逼近标题区。

每次追加新版本后，如果条目数 > 5，裁剪最旧的一条。保持格式为 `<div class="cl-title">图标 vX.Y.Z 类型 — 简短描述</div>`，一行一条。

**Git 提交格式**: `git commit -m "vX.Y.Z: 描述"`

### ⚠️ 不逐轮发版（强制执行，用户 2026-08-16 规定）

每完成一轮修改**不要**自动增加版本号、不要同步 8 处版本号、不要更新 changelog/版本历史/4 份 AI 文档的版本段——这些操作很费 token 和版本号资源。**只有用户明确说出"发版、移交、推送"等命令时才做**完整版本流程（版本号 8 处同步 + changelog 裁剪 + README 版本历史 + 4 文档版本段）。日常修改只需实现 + 验证（Playwright/CDP 0 错误），改动文件说明放在最终汇报里。

## 尺度标定 (v0.65.5)

- **`METERS_PER_UNIT = 1.3` 米/单位**（`js/engine.js:248`）。标定：真实 T-34/85 高 2.6m（Tanks Encyclopedia）÷ 坦克模型渲染高 1.99 单位（MCP Box3 实测）= 1.306，取干净值 1.3。旧值 `8/1.7≈4.706` 偏大 3.6 倍，导致"3m 配置的树只渲染 0.64 单位 = 坦克 32%，像草"。
- **渲染公式**：障碍物渲染高度（单位）= `targetHeightM / METERS_PER_UNIT`，与 ud.height/baseHeight 无关（scale 抵消）。仅 `js/obstacles.js` 4 处使用此系数。
- **各障碍物新 targetHeightMinM/MaxM（米）**：conical 2~~4.2 | spherical 2~~3.9 | oak 2.5~~5 | bungalow 2.5~~3.3 | villa 3~~5.5 | apartment 4.2~~9.7 | windmill 2.8~~5.5（草丛 0.2~~1.0m 直接米制不经系数）。
- **裸单位参数不变**：worldHalfW=150、engageDist=50、fog、阴影、MAX_SPEED=8 等保持原值。新系数下 1 单位=1.3m，米含义自动正确（旧 4.706 曾导致 viewDist=470m、MAX_SPEED=164km/h 等荒谬值）。
- **地图编辑器 UI 米显示**（×1.3）：info-size / overlayInfo / 尺寸滑块（dim-worldW 等 min/max/value 均米化，读取 ÷1.3，同步 ×1.3）。

## 核心架构

### 游戏引擎（模块化拆分后）

项目已从单一 `index.html` 拆分为多个独立模块：

| 文件                | 行数  | 功能                                                                                            |
| ------------------- | :---: | ----------------------------------------------------------------------------------------------- |
| `index.html`        | ~1034 | 核心游戏框架（UI框架+菜单+脚本加载+训练配置）                                                   |
| `waters.js`         | ~326  | 水体系统（池塘水面+河流alphaMap遮罩平面+碰撞体+动画）                                           |
| `bridges.js`        | ~165  | 桥梁系统（编辑器桥+参数化桥+碰撞检测+虚空过滤）                                                 |
| `debugcolliders.js` | ~122  | 碰撞体可视化（F3切换，从运行时数据反向生成红环/蓝板/红条）                                      |
| `audio.js`          | ~322  | 音频系统（引擎声/开火/爆炸/命中/锁定音/卡壳音）                                                 |
| `input.js`          |  ~74  | 输入处理（WASD驾驶+手柄5段力度+倒车转向修正）                                                   |
| `shells.js`         | ~363  | 炮弹系统（发射/爆炸/溅射+碎片对象池P-burst-2）                                                  |
| `mg.js`             | ~209  | 机枪系统（自动锁敌/弹道/过热）                                                                  |
| `bars.js`           |  ~85  | UI元素（血条/装填条/HUD）                                                                       |
| `obstacles.js`      | ~1757 | 环境对象（树木/建筑/IM合并去重+category分类+材质全局化+校园 footprintBuildings/edgeMarks/天桥） |

### 地图编辑器（v0.49.0 模块拆分后）

`map_editor.html` 已从 ~5167 行拆分为 1 主文件 + 5 模块：

| 文件                        | 行数  | 功能                                                                   |
| --------------------------- | :---: | ---------------------------------------------------------------------- |
| `map_editor.html`           | ~1790 | 核心框架（尺寸/撤销/事件绑定/3D场景/地面）                             |
| `js/editor_terrainGen.js`   | ~914  | 地形生成（FBM噪声+A\*寻路+主干道+村路+村落建筑集群+树木填充+平整）     |
| `js/editor_genStatus.js`    | ~181  | 生成状态面板（实时进度+统计+质量评分+自动隐藏）                        |
| `js/editor_entities.js`     | ~653  | 实体管理（出生点/树/建筑/敌人标记+CRUD+配置面板+实体列表+分组+巡逻线） |
| `js/editor_waterBridge.js`  | ~659  | 水体桥梁（水体记录+水面3D+河床雕刻+桥梁创建+桥梁检测+道路清理）        |
| `js/editor_data.js`         | ~504  | 数据持久化（蓝图CRUD+JSON导入导出+base64编解码+init/animate）          |
| `js/editor_terrainPaint.js` | ~335  | 地形绘制（纹理合成+高度图画布+5种笔刷+相机控制）                       |

### 游戏引擎（index.html）

`index.html` 是核心游戏框架，约 1034 行，主要负责 UI 和脚本加载。游戏逻辑已拆分到 `js/engine.js` (~7543行)：

```
├── 状态机: gameMode = 'menu' | 'single' | 'versus' | 'combat' | 'training'
├── 训练场: 主菜单→配置面板(我方/敌方/行为)→01a地图100单位间距→无限重生
├── 玩家工厂: createPlayer() — 创建坦克实例
├── 场景初始化: initScene() — 渲染器/光照/雾/地面/坦克/障碍物
├── 天空系统: 已移除（v0.24.5，陡视角不可见，节省性能）
├── 地面系统: createGround() — 分段地形 + 地貌纹理
├── 物理系统: updatePlayerPhysics() — 差速驱动/碰撞/俯仰
├── 瞄准系统: updateAiming() — 世界方向→坦克本地四元数逆变换 + 重力补偿 + 地形坡度补偿
├── 准星系统: 四阶段判定（障碍物射线→地形高度采样→坦克俯仰校正→shellR体积容差）│ 绿/红
├── 弹道预测线: updateTrajectoryLine() — 全模式启用/抛物线+地形截断+敌坦截断+障碍物shellR边缘
├── 游戏循环: gameLoop() / versusGameLoop()
├── 摄像机: 第三人称追尾视角 + 双人分屏 (far=300m)
└── 指向箭头: 透视投影 + behind 检测
```

### 模型工厂编辑器（model_factory.html）⭐ v0.38.1

`model_factory.html` 是通用程序化模型编辑器，~4158行，用于可视化设计坦克/建筑/敌人等游戏实体的程序化模型：

```
├── 几何系统: buildTaperedBox() + 7种Three.js几何 + RoundedBoxGeometry
├── 配置树: TANK_CONFIG/BUILDING_CONFIG/ENEMY_CONFIG 嵌套节点
├── 选择系统: 单选/多选(Ctrl)/全选 → 高亮线框 + 路径面包屑 + 面板聚焦
├── 批量编辑: 位置偏移(累积式)+颜色+材质 滑杆
├── 结构编辑: 重命名/形状切换/添加子部件/删除部件
├── Lathe/Extrude: 轮廓/形状JSON文本编辑
├── 撤销系统: saveUndo()内联快照 + Ctrl+Z (最多50步)
├── 持久化: Ctrl+S → localStorage + 自动加载
├── 视图系统: 7种预设视角 + easeInOutQuad动画
└── 底盘: 双TaperedBox倒扣船形结构
```

**导出流程**: 模型工厂调参 → `📥 导出JSON固化` 按钮下载配置 → 运行 `固化.ps1` → `Ctrl+F5` 验证

**关键全局变量**:

- `scene` — 主场景
- `players[]` — 玩家坦克数组
- `bullets[]` — 炮弹数组
- `explosions[]` — 爆炸效果数组
- `obstacles[]` — 障碍物数组
- `currentMapData` — 当前地图配置

### 粒子系统（fireSmokeParticles.js）

两个核心类，通过 `window` 全局暴露：

- **`DamageEffects`**: 坦克 HP < 50 时持续显示，40 火焰 + 30 烟雾粒子
- **`ExplosionEffects`**: 坦克死亡时触发，120 火焰 + 80 烟雾粒子

使用 `BufferGeometry.attributes.position` 直接修改粒子位置，`needsUpdate = true` 刷新。

### 模型注册系统（models/modelRegistry.js）

通过 `window.ModelRegistry` 全局暴露：

- `register(category, name, createFn, weight)` — 注册模型工厂函数
- `getModel(category, name)` — 获取创建函数
- `getAllModels()` — 获取所有模型列表（用于预览菜单）
- `randomObstacleMaker()` — 按权重随机选择障碍物

各模型文件（`trees.js`、`buildings.js` 等）需调用 `ModelRegistry.register()` 注册。

### 坦克模型方案

1. **主力**: GLB 模型（`models/glb/`），通过 `GLTFLoader` 异步加载
2. **兜底**: `models/t34-85.js` 程序化模型，仅在 GLB 加载失败时启用
3. **双缓存**: 绿色/黄色模型各自独立缓存，首次加载后克隆复用

### 地图系统（maps/\*.map.json）

`.map.json` 文件存储地图配置：

```json
{
  "size": 200,
  "spawnPoints": [...],
  "terrain": {...},
  "obstacles": {...}
}
```

通过 `currentMapData` 全局变量访问地形参数。

#### 校园地图（campus.map.json）特殊字段（v0.72.0）

- `obstacles.footprintBuildings[i]`：真实 footprint 拉伸建筑（ExtrudeGeometry），含 `footprint`/`height`/`floorH`/`name`/`stiltFloor`(架空层数)/`edgeMarks`
- `obstacles.footprintBuildings[i].edgeMarks`：外廊/空调标记数组 `[{ei, type:'corridor'|'ac'}]`，`ei`=footprint 点索引对（i 到 i+1 为一条边）。**纯覆盖语义(v0.69.0)**：数组非空时只画标记边，**空/无字段→不画**（弃 fallback innerScore 自动推断）。工具 `building_edge_marker.html` 标记 → POST `/api/solidify` → 写回此字段
- `obstacles.bridges`：人行天桥（空中连廊）`[{footprint, floorY, thickness, name}]`，渲染端**子段级裁剪(v0.69.0)**：贴天桥的边天桥层只裁连接子段（共线+投影算 segRange），其余段照画外廊
- `obstacles.b7_buildings`：B7 双栋参数化（室内运动场+车棚，vaultH/archRatio 独立）
- `obstacles.b7_buildings[i].edgeMarks`：B7 空调标记数组 `[{ei, type:'ac'}]`（v0.69.0 新增），`ei=0/2` 拱顶长边墙面挂空调。dome 分支读此字段渲染
- 消费者：`js/obstacles.js`（渲染）+ `tools/building_edge_marker.html`（标记/回填）+ `server.py solidify_campus`（写回，正则内联保坐标格式）

### 音频系统

全部使用 Web Audio API 程序化生成，无需外部音频文件：

- 引擎声（随速度变化频率）
- 开炮/爆炸/命中音效

## 关键参数（v0.44.0 — 灵活地图尺寸 + 矩形地图支持）

| 参数                      | 值                                                                                     | 位置                                                                      |
| ------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | -------- | -------------------- |
| 世界大小                  | 可配置（默认300×300, 空气墙200×200）                                                   | `map_editor.html` worldWidth/worldDepth/playWidth/playDepth + `.map.json` |
| 障碍物数量                | 350                                                                                    | `OBSTACLE_COUNT`                                                          |
| 障碍物可见半径            | 55 单位                                                                                | `OBS_RADIUS`                                                              |
| 坦克最高速度              | 4.0 单位/秒                                                                            | `MAX_SPEED`                                                               |
| 炮弹初速                  | 33.0 单位/秒                                                                           | `SHELL_SPEED`                                                             |
| 炮弹重力                  | 1.0 单位/秒²                                                                           | `SHELL_GRAVITY`                                                           |
| 装填时间                  | 2.0 秒                                                                                 | `RELOAD_TIME`                                                             |
| 炮塔旋转速度              | ~30°/s (0.5236 rad/s)                                                                  | `turretAngVel`                                                            |
| 炮管俯仰速度              | ~20°/s (0.3491 rad/s)                                                                  | `barrelAngVel`                                                            |
| 炮管俯仰范围              | -10° ~ +25°                                                                            | `maxUp`/`maxDown`                                                         |
| 准星有效射程              | 150 单位                                                                               | `updateAiming()`                                                          |
| 准星判定                  | 四阶段（障碍物射线→抛物线地形采样→shellR 0.18m体积→目标跳回）                          | —                                                                         |
| 弹道预测线                | 全模式启用 + 抛物线 + 地形截断 + shellR边缘 + 敌人 + 丧尸                              | —                                                                         |
| 手柄模式                  | 粘滞切换（WASD/鼠标才回键鼠）+ 双轴映射(axes[2/4]=X, [3/5]=Y)                          | —                                                                         |
| 伤害值                    | 20 HP                                                                                  | `SHELL_DAMAGE`                                                            |
| 殉爆半径                  | 3.5 米                                                                                 | `CHAIN_RADIUS`                                                            |
| 摄像机远截面              | 300                                                                                    | `camera.far`                                                              |
| 雾色                      | #8899aa (蓝灰)                                                                         | `addLightingTo()`                                                         |
| 雾距                      | near 70 / far 110                                                                      | `Fog`                                                                     |
| 天空                      | 已移除（v0.24.5，陡视角不可见）                                                        | —                                                                         |
| 地面                      | 300×300                                                                                | `createGround()` 地形 + 纹理混合                                          |
| 丧尸模型                  | ZOMBIE_CONFIG 24节点 ~~458 tris                                                        | `models/enemies.js` buildZombieFromConfig                                 |
| 丧尸动画                  | 6动作 (Idle/Hit/Attack/Walk/Run/Die)                                                   | AnimationSystem 手动插值，v0.28.1 支持3层LOD                              |
| 丧尸LOD                   | near<30m全帧/medium30~~70m冻结骨架/far>70m圆柱占位                                     | index.html 5m滞后带                                                       |
| 丧尸身高                  | 1.0m                                                                                   | Box3 包围盒自动缩放                                                       |
| 丧尸AI                    | 8状态机 (IDLE/PATROL/ALERT/PURSUIT/SEARCH/ATTACK/STAGGER/DEAD)                         | `combat/enemyAI.js` ZS 枚举                                               |
| 近防机枪                  | 射速10发/秒 伤害2 射程25m 过热6s                                                       | `index.html` MG\_\* 常量                                                  |
| 修理箱模型                | 程序化倒角红箱 ~2.5K tris                                                              | `models/pickups.js` makeToolboxProcedural                                 |
| 03a地图                   | 装甲突击车 ×2                                                                          | PvE 战斗地图                                                              |
| 04a地图                   | 程序化丧尸 ×30                                                                         | 5×6网格集群，2层仇恨连锁                                                  |
| 地图编辑器                | `map_editor.html` ~2900行                                                              | 7阶段完成：地形+纹理+实体+JSON+水体+桥梁+撤销+主游戏集成+**灵活尺寸**     |
| 编辑器世界                | worldWidth×worldDepth (playWidth×playDepth)                                            | 独立X/Z尺寸，支持任意矩形；`WORLD_SIZE/PLAY_SIZE` 已废弃                  |
| 高度图精度                | 256×256 Float32Array                                                                   | HM_RES                                                                    |
| 纹理预览                  | 2048×2048 Canvas2D                                                                     | TEX_RES                                                                   |
| UndoManager               | 50步快照栈，~~320KB/步                                                                 | `pushSnapshot()`/`undo()`/`redo()`                                        |
| 编辑器限帧                | 30fps                                                                                  | `animate()` FRAME_MS=1000/30                                              |
| 蓝图存储                  | localStorage `tank_map_editor_blueprints`                                              | CRUD + 导入/导出 JSON                                                     |
| 编辑器→主游戏             | `convertBlueprintToMapConfig()`                                                        | 离散高度图双线性插值 + `loadMapConfig()` 动态注入                         |
| 模型工厂光照(v1.6)        | 5灯栈                                                                                  | Ambient(0.8)+Hemisphere(0.3)+Dir主(2.0)+左补(0.3)+后补(0.4)               |
| TaperedBox flatShading    | DoubleSide 兜底                                                                        | flatShading时自动启用，防止侧面黑面                                       |
| emissive自发光            | dark_steel 0.30 / barrel_steel 0.20 / rubber 0.25                                      | 暗部保留轮廓                                                              |
| 水体走廊法                | 河床/湖底走廊法雕刻 + ease-out falloff                                                 | `carveRiverCorridor` / `carvePondBasin` (mouseup中)                       |
| 分段水面剖面              | 每段水面 = min(前段, 本地形-strength×0.3)，单调不增                                    | `segWaterLevels[]` + `waterLevels` 记录                                   |
| 网格单元水面              | 河流+湖泊统一用高度图网格四边形构建平坦水面                                            | `createWaterLayer()` cellSet → 每个单元格独立 surfaceLevel                |
| 端点削波                  | 路径起点/终点 hw 范围内深度线性归零                                                    | `taper = min(startTaper, endTaper)`                                       |
| 炮弹速度                  | SHELL_SPEED=50.0 m/s (v0.59.2: 33→50)                                                  | shells.js                                                                 |
| 斜坡桥面 → 水平桥面       | 改回水平 BoxGeometry，引道用 BufferGeometry 斜坡面板                                   | `createBridgeMesh()`                                                      |
| 加载画面                  | 黑色底+渐变色进度条+状态文字，全地图覆盖                                               | `showLoading()`/`updateLoadingProgress()`/`hideLoading()`                 |
| 编辑器地图对接            | splatMap纹理+waterLevel水位+riverColliders空气墙+巡逻分散                              | `convertBlueprintToMapConfig()` + `createRiverWater()`                    |
| 敌人批量属性编辑          | 多选敌人时属性面板批量写入HP/速度/视野等                                               | `syncEnemyConfigPanel()` (map_editor.html)                                |
| 实体列表分类折叠          | 建筑/树木默认折叠，出生点/敌人展开                                                     | `collapsedCategories` Set                                                 |
| TrackChain 负重轮半径     | wheelR=0.40                                                                            | `model_factory.html` T34_85_V16_CONFIG                                    |
| TrackChain 主动轮/诱导轮Y | cyF=0.58, cyR=0.50                                                                     | `model_factory.html` T34_85_V16_CONFIG                                    |
| 负重轮zR1~~zR5坐标(Z轴)   | 1.40, 0.39, -0.74, -1.64, -2.55                                                        | `model_factory.html` T34_85_V16_CONFIG                                    |
| 模型工厂视图              | 透视视图相机pos [5.0,3.5,6.0]                                                          | `model_factory.html`                                                      |
| 固化脚本                  | `固化.ps1` — 一行命令 JSON→源码 替换                                                   | 项目根目录                                                                |
| 六足腿结构                | 4DOF: legGroup.Y+thigh.X+shin.X+ankle.X，三节腿(大腿L1≈0.7+小腿L2≈0.55)+尖刺足(h=0.28) | `models/hexapod_config.js`                                                |
| 六足尖刺足                | Cylinder(rTop=0.055, rBottom≈0, h=0.28), 锥尖单点接地，内勾11°，踝球r=0.05             | `models/hexapod_config.js`                                                |
| 六足IK测试                | 3模式(Y下蹲/X左右/Z前后)×3腿型(前/中/后)，CCD 3关节+踝锁死，锥尖靶点固定               | `js/hexapod_anim.js`                                                      |
| 六足动画                  | **23个** (21步态+踉跄+死亡), stride/stepH数组驱动, 步态周期                            | ω                                                                         | 钳位公式 | `js/hexapod_anim.js` |
| 六足转弯系统              | direction+turnRate正交, CCD damp=0.8/0.5, \_initFootDist固定脚距防漂移                 | `js/hexapod_anim.js`                                                      |
| 六足武器限位              | 加特林[-17°,+20°], 导弹[-60°,+30°]                                                     | `model_factory.html` `hexapod_anim.js`                                    |
| 六足髋Y限位               | 中腿±0.7rad, 前后腿±0.45rad                                                            | `hexapod_anim.js` `_ccdLeg`                                               |
| 训练场模式                | 敌我T-34坦克对战+配置面板+无限重生                                                     | `index.html` `js/engine.js`                                               |
| 六足城市迷彩              | 亮灰底色+深浅灰斑纹, 观瞄保留纯色                                                      | `enemies.js`                                                              |
| 地形坡度适应              | 装甲突击车俯仰+侧倾, 六足独立管理(hexapod_anim)                                        | `engine.js` `hexapod_anim.js`                                             |
| 转弯验证                  | toggleHexTurnTest: 极慢0.3rad/s旋转, 三角步态, bodyC/plantPos/swingTarget可视化        | `js/hexapod_anim.js`                                                      |
| 受击踉跄                  | triggerHexStagger(dir,force): 4阶段CCD驱动, 反方向腿跺地, 身体倾斜                     | `js/hexapod_anim.js`                                                      |
| 死亡瘫倒                  | triggerHexDeath(): 昂首→瘫软→触地, damp 0.85→0.03, 6腿各异伸展                         | `js/hexapod_anim.js`                                                      |
| 武器校准                  | toggleWeaponCalibrate: 双滑块控制俯仰, 瞄准线OK, 旋转有bug                             | `js/hexapod_anim.js`                                                      |
| 导出JSON固化按钮          | 一键下载完整嵌套配置JSON                                                               | `model_factory.html`                                                      |

## 常见修复模式

**添加新粒子效果**: 在 `fireSmokeParticles.js` 中创建新类，使用 `THREE.Points` + `BufferGeometry`，在 `index.html` 中实例化并调用 `update(dt)`。

**添加新障碍物**: 在对应模型文件中调用 `ModelRegistry.register()`，返回 `THREE.Group`。

**修改地形高度**: 编辑 `.map.json` 的 `terrain.heightMap` 数组，或修改 `getTerrainHeight()` 函数。

**添加新音效**: 在 `index.html` 的音频初始化部分使用 `AudioContext.createOscillator()` 生成。

## 接力开发交接规范

### 交接触发词

当用户说出 **"移交"**、**"交接"** 或类似词语时，AI 必须自动执行以下完整流程，不得跳过任何步骤。

### 交接前检查清单（开发完成时执行）

1. **代码已提交**: `git status` 显示 "nothing to commit, working tree clean"
2. **已推送到 Gitee**: `git push origin master` 成功（Gitee 是主仓库，家里电脑只同步 Gitee）
3. **已推送到 GitHub**: `git push github master`（备用镜像同步）
4. **OneDrive 已同步**: 所有文件已复制到 OneDrive 备份目录
5. **版本号已更新**: 确保所有 8 处版本号同步完成（见下方版本号同步清单）
6. **README.md 已更新** ⚠️ 必须包含：
   - 开头版本号
   - 版本历史追加新条目
   - 关键参数表（如有变更）
   - 代码规模注释（如有变更）
7. **CODEBUDDY.md 已更新** ⚠️ 必须包含：
   - 关键参数表（如有变更）
   - 架构描述（如有变更）
   - 已知问题列表（如有新增或修复）
   - 版本号引用（如有变更）

### 交接执行流程（AI 必须严格按序执行）

```
1. 版本号同步（8处）
2. 更新 README.md（版本号、历史、参数、规模）
3. 更新 CODEBUDDY.md（参数、架构、已知问题）
4. git add -A
5. git commit -m "vX.Y.Z: 描述"
6. git push origin master
7. git push github master
8. OneDrive 文件复制
```

### 接力接续步骤（另一台电脑开始开发时）

1. 从 Gitee 拉取最新代码:
   ```bash
   git pull origin master
   ```
2. 同步 OneDrive 备份到本地（如需要）:
   ```bash
   # 从 OneDrive 复制到工作区
   Copy-Item -Path "C:\Users\hpmax\OneDrive\共享软件\坦克对战demo\*" -Destination "c:\Users\hpmax\CodeBuddy\tank_demo\" -Recurse -Force
   ```
3. 启动本地服务器开始开发

### Git 仓库说明

| 仓库            | 用途                 | 状态    |
| --------------- | -------------------- | ------- |
| Gitee (origin)  | 主仓库，接力开发同步 | ✅ 活跃 |
| GitHub (github) | 备用镜像             | ✅ 同步 |
| OneDrive        | 本地备份 + 测试运行  | ✅ 同步 |

**注意**: 家里电脑只需同步 Gitee（主仓库），GitHub 作为备用。

---

## v0.57.0 变更摘要（2026-06-11）

- **六足CCD IK动画系统**: 新建 `js/hexapod_enemy.js` (~890行)，从模型工厂移植CCD IK+三角步态+踉跄+死亡到训练场/战斗模式
- **homeOffset相对定位**: 脚位基于休息姿态偏移，永远在腿可达范围内，解决反曲/下陷/浮空累积误差
- **髋Z轴修正**: 六足模型hip绕Z轴旋转，修正CCD投影轴(→`_worldZ`)，关键bug修复
- **武器系统独立**: 加特林/导弹发射+枪管红热+观瞄发光从旧动画块提取，不受CCD激活状态影响
- **MG不触发踉跄**: `onEnemyDamaged`增加`skipStagger`参数，高射速不会定身六足
- **动态步幅**: 步态周期/步幅按AI实际速度自适应，支撑相位移不超腿长
- **自动抬升**: `init()`尖刺足贴地→身体抬升至标准站姿，空闲/idle自然回到标准姿态
- **已知新问题**: 动画切换后偶有腿部绷直；卡障碍物时步态仍推进

## v0.56.1 变更摘要（2026-06-10）

- **训练场六足敌人**: 可选敌方类型，模型+AI+死亡重生完整流程
- **加特林枪管簇动画**: 模型工厂23动画中枪管绕中央轴公转(`_hexaCollectRefs`创建`_barrelCluster`→`_updateGatlingSpin`旋转)
- **六足贴地**: `_hexapodTemplateBaseY`存到`userData._baseY`，游戏循环`groundY+_baseY`
- **训练场修复**: 玩家被火焰/丧尸击杀→复活而非结算；丧尸重生→重置AnimationSystem为Idle
- **已知新问题**: 游戏端六足武器俯仰轴不正确(模型工厂正常)；装甲突击车障碍物平移

## 已知问题

| #   | 问题                                           | 影响                                                                                                                                                                                           | 位置                                                                                                                   |
| --- | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| 25  | ~~首次切校园丧尸渲染白模~~ **v0.79.3已修**     | MODEL_CONFIGS.humanoid初始=HUMANOID_BASE白模(无服饰/未缩放)，rebuildModel守卫自动buildHumanoid(无\_params时)+height归一统一                                                                    | `model_factory.html` rebuildModel + `models/humanoid_config.js` buildHumanoid                                          |
| 26  | ~~衣物不随build变粗穿模~~ **v0.79.3已修**      | WRAP_ADDONS表(袖口0.01/短裤裤0.03/裙腰0.02+裙摆0.34~0.41)尺寸=肢体半径×_bF+间隙; pelvis单向联动包裹裤裙; torso不动防挂件被吞                                                                   | `models/humanoid_config.js` WRAP_ADDONS/applyWrapScale + pelvis grow                                                   |
| 27  | ~~男教师裤子像短裤~~ **v0.79.3已修**           | 长裤拆大腿段(挂髋pivot高0.6)+小腿段(trousers_grey_calf挂膝pivot高0.7)盖到脚踝; DUAL_LEG_ADDONS双挂左右腿                                                                                       | `models/humanoid_config.js` trousers_grey + trousers_grey_calf                                                         |
| 28  | ~~步态方向反/前踢后蹬等幅~~ **v0.79.3已修**    | rotation.x>0=后蹬/负=前踢; Walk后蹬+0.6/前踢-0.25, Run后蹬+0.8/前踢-0.35, 膝弯清障-0.6/-0.7, 对侧摆臂                                                                                          | `js/humanoid_factory.js` Walk/Run关键帧                                                                                |
| 29  | ~~展台沉地+Die后变形~~ **v0.79.3已修**         | pelvis.position.y关键帧绝对0→REST_POSES加pelvis:y:0.375+三轨restKey偏移; 展台每帧动态贴地; Die一次性回待机; resetState全关节复位到REST基线                                                     | `models/humanoid_config.js` REST_POSES + `model_factory.html` updateAnimShowcase + `js/humanoid_factory.js` resetState |
| 30  | ~~女生裙长到脚脖子/迈步穿模~~ **v0.79.3已修**  | 裙锥形化(腰口=腿半径+0.02细被上衣盖住→pelvis不grow与torso协调); 裙摆按Run极限(0.8rad)表面位移√(0.13²+(摆长×sin0.8)²)+腿半径(学生摆-0.25→0.46, 教师摆-0.35→0.53); 裙摆上移露小腿(0.62/0.52单位) | `models/humanoid_config.js` pleated_skirt_f/skirt_grey + WRAP gapBottom                                                |
| 10  | **游戏端六足武器俯仰旋转轴错误**               | 加特林/导弹pitch绕错误轴旋转，v0.56.1已禁用俯仰，武器保持默认角度                                                                                                                              | `combat/enemyAI.js:updateHexapodEngage`                                                                                |
| 11  | **装甲突击车遇障平移**                         | 障碍物碰撞仅位移推出不改朝向，车辆侧滑                                                                                                                                                         | `engine.js:checkCollision` → AI通用                                                                                    |
| 12  | **六足动画切换偶有腿部绷直**                   | idle↔walk切换时CCD从未收敛位姿过渡，个别腿暂时翘起                                                                                                                                             | `js/hexapod_enemy.js:_updateGait`                                                                                      |
| 13  | **六足卡障碍物时步态推进**                     | 碰撞阻止位移但AI仍设移动指令，步态继续循环导致原地踏步                                                                                                                                         | `js/hexapod_enemy.js:update`                                                                                           |
| 14  | ~~六足玩家转向腿飞~~ **v0.61.1已修**           | 步进式转向: 身体由stepGait步态驱动(腿蹬地+圆弧预伸), 髋限位玩家×1.35(0.45→0.61)                                                                                                                | `js/hexapod_core.js`:stepGait 玩家分支(STEP_PERIOD=0.32/MAX_STEP=0.5/IDLE_THR=0.02)                                    |
| 15  | ~~长时间WASD步态漂移~~ **v0.61.1已修**         | 摆动闭环homeW+速度前瞻, 每周期重置无累积                                                                                                                                                       | `js/hexapod_core.js`:stepGait 摆动玩家分支                                                                             |
| 16  | ~~六足玩家坡地车身不跟随地形~~ **v0.61.2已修** | 4根因: ①getGroundHeight挂window(原groundHeightFn=null致代码不执行)②sD1.2→2.0+落水过滤(防河岸暴涨)③hRgt方向(hFwd×up,原照搬坦克左右反)④pitch/roll轴(车头-X: rotation.x=侧倾/z=俯仰,原照坦克互换) | `engine.js`+`js/hexapod_core.js`:stepGait 地形段                                                                       |
| 17  | ~~坦克炮弹不让敌六足踉跄~~ **v0.64.0已修**     | 圆柱碰撞直接扣HP绕过onEnemyDamaged调用链                                                                                                                                                       | `engine.js`:2389                                                                                                       |
| 18  | ~~敌六足踉跄时加特林仍在发射~~ **v0.64.0已修** | 踉跄块未切断spinUp/gatlingRequest/heat                                                                                                                                                         | `hexapod_enemy.js`:221 + `enemyAI.js`:767                                                                              |
| 19  | ~~坦克复活在死亡地点~~ **v0.64.0已修**         | tankState未同步→同帧物理覆写位置                                                                                                                                                               | `engine.js`:5325                                                                                                       |
| 20  | ~~敌坦克坡地倾斜方向错~~ **v0.64.0已修**       | 前向公式(-cos,sin)与模型朝向差90°                                                                                                                                                              | `engine.js`:3276+3288                                                                                                  |
| 21  | ~~爆炸火光粒子残留~~ **v0.64.0已修**           | dispose()只释放GPU资源不调scene.remove()                                                                                                                                                       | `fireSmokeParticles.js`:391+561                                                                                        |
| 22  | ~~敌六足不受水体/障碍物碰撞~~ **v0.64.0已修**  | 敌六足只有空气墙钳制无checkCollision                                                                                                                                                           | `engine.js`:3258+3128                                                                                                  |
| 23  | **道路/广场纹理马赛克感重**                    | splatMap整数硬切、2048合成贴图规整重复、主路浮空单色strip。方案已调研：splat shader软混合+拱顶管道标线，一期计划见 `.claude/plans/quirky-hatching-rainbow.md`                                  | `js/mapLoader.js`:generateCompositeGroundTexture; `js/obstacles.js`:buildRoadStrip                                     |
| 24  | ~~玩家六足F2 OFF蓝灰六棱柱残留~~ **已修**      | `_lodCylinder`(LOD远距替身几何,初始visible=false)被 `_setRenderVisible` 在F2 OFF时误设visible=true;玩家六足不进LOD循环→无人修正→残留。修复=`_setRenderVisible`跳过`_lod`前缀mesh               | `js/collisionSystem.js`:\_setRenderVisible + `models/enemies.js`:1247                                                  |
| 1   | 模型工厂撤销一键回到初始状态                   | Ctrl+Z一次性回到初始而非逐步回退                                                                                                                                                               | model_factory.html                                                                                                     |
| 2   | 桥梁两端地形高低差                             | 编辑器addBridge引道雕刻不完善，坦克上桥有阻                                                                                                                                                    | map_editor.html→addBridge                                                                                              |
| 3   | 编辑器虚空拖拽偶发贴边河段/路段                | 鼠标在边界外拖拽时，CatmullRom插值+钳制产生贴边冗余段                                                                                                                                          | map_editor.html→mousemove钳制逻辑                                                                                      |
| 4   | 手柄摇杆换向偶发延迟                           | 摇杆快速穿中+实际速度判定edge case                                                                                                                                                             | input.js + index.html 驱动逻辑                                                                                         |
| 5   | **800×800大地图生成耗时~54s**                  | ✅ v0.51.0 FBM降采样+bilinear插值，实测800m~15s                                                                                                                                                | editor_terrainGen.js                                                                                                   |
| 6   | **密度参数缩放不当**                           | ✅ v0.51.0 sqrt非线性缩放替代线性                                                                                                                                                              | editor_terrainGen.js                                                                                                   |
| 6b  | 山区村落                                       | ✅ v0.51.0 flatScore<0.35硬门槛+权重0.6                                                                                                                                                        | editor_terrainGen.js→_tryPlanVillage                                                                                   |
| 6c  | 村落跨道路                                     | ✅ v0.51.0 plazaR+roadW/2+5m安全距离                                                                                                                                                           | editor_terrainGen.js→_tryPlanVillage                                                                                   |
| 6d  | 纹理92%泥地                                    | ✅ v0.51.0 moistRaw归一化修正                                                                                                                                                                  | editor_terrainGen.js                                                                                                   |
| 6e  | **六足转弯动画拖行**                           | v0.54已修复: 步态周期由turnRate推导+\_initFootDist固定脚距                                                                                                                                     | `js/hexapod_anim.js`                                                                                                   |
| 6f  | **武器俯仰校准旋转bug**                        | ✅ v0.55.1 world→local坐标转换修复，武器不再飞移                                                                                                                                               | `js/hexapod_anim.js`                                                                                                   |
| 6g  | **六足转弯反曲膝**                             | ✅ v0.55.1 shin关节零点夹紧+plantPos同步修复                                                                                                                                                   | `js/hexapod_anim.js`                                                                                                   |
| 6h  | **尖刺足陷入地面**                             | ✅ v0.55.1 updateMatrixWorld修复bbox计算                                                                                                                                                       | `js/engine.js` `enemies.js`                                                                                            |
| 7   | CDP测试标签页回收不可靠                        | ✅ v0.50.1 cdp_verify.py 直接杀 Chrome 进程替代 /json/close，100% 可靠                                                                                                                         | cdp_verify.py                                                                                                          |
| 8   | 编辑器河流弯道处水面透明叠加变暗               | ✅ v0.48.0 alphaMap遮罩平面方案彻底解决                                                                                                                                                        | waters.js→createRiverWater                                                                                             |
| 9   | 池塘碰撞体对敌人不生效                         | ✅ v0.49.0 checkCollision()增加池塘椭圆边界推离                                                                                                                                                | index.html→checkCollision                                                                                              |

## 已修复问题（v0.51.0 — 双管线村落生成系统+CDP自动验证）

| #   | 修复内容                                                                  | 版本    |
| --- | ------------------------------------------------------------------------- | ------- |
| 1   | 村落生成全面重写：双管线+掩码网格+FloodFill+容量预验证+建筑簇+朝向+连接路 | v0.51.0 |
| 2   | 自动平整保峰压谷：管线A内建，确保可建面积≥60%                             | v0.51.0 |
| 3   | 建筑不再全朝北：面朝最近道路段(atan2计算yaw)                              | v0.51.0 |
| 4   | 支路连接主路：截断到主路边距避免覆盖柏油纹理                              | v0.51.0 |
| 5   | 生成状态面板：实时进度+统计+评分+失败原因+30s自动隐藏                     | v0.51.0 |
| 6   | 确定性随机：Mulberry32 PRNG，相同种子→相同地图                            | v0.51.0 |
| 7   | 编辑器模块增至6个：+editor_genStatus.js                                   | v0.51.0 |
| 8   | CDP自动验证：真实Chrome控制台0错误通过                                    | v0.50.0 |

## 已修复问题（v0.51.0 — 性能优化+CDP验证+村落修复）

| #   | 修复内容                                                              | 版本    |
| --- | --------------------------------------------------------------------- | ------- |
| 1   | FBM降采样优化：>400m半分辨率+bilinear插值，800m从54s→~15s             | v0.51.0 |
| 2   | 密度参数sqrt非线性缩放：池塘36→5，村落适配面积                        | v0.51.0 |
| 3   | 多轮选址：3轮递进搜索+自适应间距(40-80m)+回避已有plaza                | v0.51.0 |
| 4   | 平坦度硬门槛：flatScore<0.35排除+权重0.5→0.6，防山区建村              | v0.51.0 |
| 5   | 广场安全距离：plazaR+roadW/2+5m，防穿越主路                           | v0.51.0 |
| 6   | moistRaw纹理修复：归一化*1.5-0.5+moist*0.5，泥地92%→草地70%           | v0.51.0 |
| 7   | CDP自动验证脚本：cdp_verify.py(379行)+进程级清理+误报过滤+全局可用    | v0.51.0 |
| 8   | 状态面板修复：删除硬编码重复panel+setProperty('important')+window暴露 | v0.51.0 |
| 9   | 村落间距放宽：固定80m→自适应min(80,maxDim\*0.1)，大区域多村           | v0.51.0 |

## 已修复问题（v0.49.0 — 编辑器模块拆分+池塘碰撞修复+自动验证）

| #   | 修复内容                                                                       | 版本    |
| --- | ------------------------------------------------------------------------------ | ------- |
| 1   | 池塘碰撞体对敌人失效修复：checkCollision()增加椭圆边界推离，池塘与河流行为一致 | v0.49.0 |
| 2   | map_editor.html 拆分为5模块（5167→1762行，-66%）                               | v0.49.0 |
| 3   | 新规则：模块优先架构（新功能优先独立JS模块）                                   | v0.49.0 |
| 4   | 新规则：Chrome headless CDP自动验证（改代码→抓错误→修复→循环）                 | v0.49.0 |

## 已修复问题（v0.48.0 — 河面AlphaMap+主路A\*寻路+修复）

| #   | 修复内容                                                                 | 版本    |
| --- | ------------------------------------------------------------------------ | ------- |
| 1   | 河面alphaMap遮罩平面替换strip（Canvas绘河→alphaMap裁切，弯道零自交）     | v0.48.0 |
| 2   | 主路A\*寻路（指数坡度惩罚+加权启发×0.7+StringPulling平滑）               | v0.48.0 |
| 3   | 村路/广场切splatMap贴图（移除3D strip）                                  | v0.48.0 |
| 4   | 建筑群半圆约束（分支前进方向±90°，不跨主路）                             | v0.48.0 |
| 5   | 蓝图base64解码修复（demo端补heightmapB64/splatMapB64→terrain.heightmap） | v0.48.0 |
| 6   | 死亡UI隐藏+输入切断，重生恢复；战败画面"重新开始"按钮                    | v0.48.0 |
| 7   | F4上帝视角（关雾+FOV80°+拉远+围挡墙隐藏，退出自动重置）                  | v0.48.0 |
| 8   | F3碰撞可视化默认关闭                                                     | v0.48.0 |
| 9   | P7死代码清理（waters.js~~75行+index.html~~20行+obstacles.js清理）        | v0.48.0 |

## 已修复问题（v0.46.0 — 模块拆分+水面ShapeGeometry+编辑器裁剪+手柄优化）

| #   | 修复内容                                                                      | 版本    |
| --- | ----------------------------------------------------------------------------- | ------- |
| 1   | waters.js+bridges.js+debugcolliders.js 模块拆分完成（index.html 5554→5094行） | v0.46.0 |
| 2   | 编辑器桥梁lx/lz轴互换bug修复（纵向/横向检测颠倒，致桥面碰撞全错）             | v0.46.0 |
| 3   | 老格式桥梁（01a）isOnBridge无限Z轴延伸修复                                    | v0.46.0 |
| 4   | getGroundHeight→getBridgeSurfaceY桥梁实际高度支持（修复编辑器桥坦克穿透）     | v0.46.0 |
| 5   | 参数化河流碰撞体缺失修复（单人模式坦克驶入河中）                              | v0.46.0 |
| 6   | 编辑器河面弯道effHw公式修复（cos(dAng/2)替代无效min(1,1/cos)）                | v0.46.0 |
| 7   | 编辑器河面改用ShapeGeometry三角化（earcut），消除条带自交                     | v0.46.0 |
| 8   | 编辑器虚空拖拽路径裁剪（钳制边界+间距去重+虚空桥过滤）                        | v0.46.0 |
| 9   | 手柄倒车转向反转改用实际速度判定（消除摇杆微小Y值误触发）                     | v0.46.0 |
| 10  | 手柄stickToTarget力度从3段→5段（0.25/0.5/0.75/1.0）                           | v0.46.0 |
| 11  | 摇杆换向dirFlip检测（prevTarget非零时才更新，消除穿中帧误判）                 | v0.46.0 |
| 12  | 履带参数TRACK_ACCEL/COAST随MAX_SPEED翻倍同步调整                              | v0.46.0 |
| 13  | F3碰撞体可视化（从riverColliders[]和currentMapData.bridges实时生成）          | v0.46.0 |

## 已修复问题（v0.45.0 — 水体/桥梁/出生点数据对接修复）

| #   | 修复内容                                                                             | 版本    |
| --- | ------------------------------------------------------------------------------------ | ------- | -------- | ------- |
| 1   | 编辑器-游戏Float32Array序列化对接（saveBlueprints TypedArray replacer）              | v0.45.0 |
| 2   | 编辑器exportMapJson始终含heightmap+河流+桥端点（不再被features吞掉）                 | v0.45.0 |
| 3   | 矩形地图纹理坐标修复（generateSplatMap/CompositeGroundTexture独立halfX/halfZ）       | v0.45.0 |
| 4   | 多河流支持（convertBlueprintToMapConfig→terrainExtra.rivers数组）                    | v0.45.0 |
| 5   | 河流交叉水面统一（取最低水位）+ 河床基准排除已挖水体                                 | v0.45.0 |
| 6   | 游戏端水面弯曲平滑（2-pass移动平均+40°阈值）                                         | v0.45.0 |
| 7   | 水面NaN防护（Float32Array→JSON序列化waterLevels.length丢失）                         | v0.45.0 |
| 8   | 重复河面消除（buildScene去水+创建时机统一+参数化代码穿透修复）                       | v0.45.0 |
| 9   | 桥面渲染重写（编辑器中桥定向+deckY高度+游戏端isOnBridge支持任意朝向）                | v0.45.0 |
| 10  | 桥头空气墙修复（桥面区域跳过riverColliders+护栏方向修正）                            | v0.45.0 |
| 11  | 坦克出生点修复（4处硬编码→读取spawnPoints.p1+编辑器出生点唯一性）                    | v0.45.0 |
| 12  | 出生点避水（原点在水中→螺旋搜索干地）                                                | v0.45.0 |
| 13  | 坦克速度翻倍（MAX_SPEED 4→8 m/s）                                                    | v0.45.0 |
| 14  | 池塘水面数据完整性校验（cx/rx不为null才创建）                                        | v0.45.0 |
| 15  | 弯道缩窄公式修复（effHw = hw\*cos(dAng/2)替代无效的min(1,1/cos)）                    | v0.45.0 |
| 16  | 河岸钳制多距离采样（effHw+2/+4/+6替代effHw+1，避免被河道过渡区污染）                 | v0.45.0 |
| 17  | 村落重复生成桥恢复后立即createGround                                                 | v0.45.0 |
| 18  | isPointInWater河流半宽从硬编码4→(w.width                                             |         | 40)\*0.5 | v0.45.0 |
| 19  | 编辑器桥deckY存储到蓝图                                                              | v0.45.0 |
| 20  | maploader.js模块拆分（~190行，loadMapConfig+convertBlueprint+loadMapsFromDirectory） | v0.45.0 |

## 已修复问题（v0.44.0 — 地图拆分+桥梁修复+编辑器增强）

| #   | 修复内容                                                                  | 版本                                  |
| --- | ------------------------------------------------------------------------- | ------------------------------------- | -------------------------------------------------------------------- | ------- |
| 1   | 地图数据从index.html拆分到maps/目录动态加载（\_index.json manifest）      | v0.44.0                               |
| 2   | 炮弹速度                                                                  | SHELL_SPEED=50.0 m/s (v0.59.2: 33→50) | shells.js重写：平整区+内陆斜坡+\_carvedCells可撤销，修复重复生成凹坑 | v0.44.0 |
| 3   | 蓝色纹理修复：桥梁雕琢不移入editedVerticesPaint，避免vertexColors水体蓝染 | v0.44.0                               |
| 4   | 河流生成重构：水面=河岸最低-3m，河床=地图最低-10m，自动计算               | v0.44.0                               |
| 5   | 编辑器蓝图加载尺寸变量同步（worldHalfW/D, playHalfW/D等）                 | v0.44.0                               |
| 6   | 弹道预测线重建修复（rebuildMapAsync清理trajLine/trajDot）                 | v0.44.0                               |
| 7   | 多段河流穿越detectAndBuildBridges改为进入/退出状态机                      | v0.44.0                               |
| 8   | 小地图村落规模自适应（scaleF缩放+广场位置动态调整）                       | v0.44.0                               |
| 9   | WORLD_SIZE/WORLD_HALF残余清理（~25处改为独立X/Z尺寸）                     | v0.44.0                               |
| 10  | 编辑器3D视口Ctrl多选+Shift框选+Delete删除+实体列表排序分色                | v0.44.0                               |
| 11  | 随机生成面板从弹窗移到右侧面板                                            | v0.44.0                               |
| 12  | 树木InstancedMesh加入obstacleMeshes                                       | v0.39.1                               |

| #   | 修复内容                                                                    | 版本    |
| --- | --------------------------------------------------------------------------- | ------- |
| 1   | 树木InstancedMesh加入obstacleMeshes — 射线/瞄准/遮挡全部检测树木            | v0.39.1 |
| 2   | Poisson采样恢复随机建筑分配（锥形35%/球形30%/橡树20%/建筑15%）              | v0.39.1 |
| 3   | rotation.order = 'YXZ' — 地形俯仰在坦克自身坐标系中生效                     | v0.39.1 |
| 4   | 瞄准逻辑重写：世界方向→坦克本地四元数逆变换（正确处理pitch+roll+yaw）       | v0.39.1 |
| 5   | 准星四阶段判定：障碍物射线→地形高度采样→shellR体积容差→目标跳回             | v0.39.1 |
| 6   | 弹道预测线：全模式启用（键鼠+手柄）+ 地形碰撞 + 障碍物shellR边缘 + 敌人截断 | v0.39.1 |
| 7   | 手柄双轴映射（axes[2,4]=X, axes[3,5]=Y）+ 粘滞切换（不回退鼠标）            | v0.39.1 |
| 8   | 快速点击不放炮修复 — mouseFireRequested锁存                                 | v0.39.1 |
| 9   | updateMatrixWorld() 在rotation设置后立即调用                                | v0.39.1 |

---

## 📋 待完成任务（截至 v0.51.0）

| #   | 任务                                  |                           优先级                            | 计划版本                               | 详情                                              |
| --- | ------------------------------------- | :---------------------------------------------------------: | -------------------------------------- | ------------------------------------------------- | ------------------------------------------------- |
| 1   | **敌人重生稳定性**                    |                          🔴 进行中                          | v0.60.0                                | 上坡/多次复活后偶发失败，根因待定位               | 23动画可用, 踉跄+死亡就绪, 武器校准/反曲/贴地修复 |
| 2   | PvE Phase 5：清空积分UI按钮 + 局内HUD |                           🔴 近期                           | 未分配                                 | 局内显示HP/弹药/分数 + 菜单清空积分按钮           |
| 4   | 编辑器虚空拖拽贴边河段修复            |                           🟡 近期                           | 未分配                                 | CatmullRom插值+钳制偶发贴边段，需更稳健的裁剪方案 |
| 5   | 同轴机枪功能                          |                           🟡 中期                           | 未分配                                 | Space键 + 手柄LT 预留，与近防机枪共用MG\_\*参数   |
| 6   | 状态面板在CDP生成时显示               |   ✅ v0.51.0 删除硬编码重复panel+setProperty('important')   | editor_genStatus.js + map_editor.html  |
| 7   | CDP标签页回收                         | ✅ v0.51.0 cdp_verify.py进程级清理替代/json/close，100%可靠 | cdp_verify.py                          |
| 8   | PvE Phase 6：精英单位 + Boss 炮舰     |                           🔵 远期                           | 未分配                                 | 导弹发射车/重型坦克/Boss多阶段战斗                |
| 9   | 草丛 InstancedMesh 合并 + 材质优化    |                         ✅ v0.60.4                          | draw calls 48~192→3, Lambert+FrontSide |
| 10  | 村落间距检查放宽                      |      ✅ v0.51.0 自适应间距min(80,maxDim\*0.1)+多轮选址      | editor_terrainGen.js                   |

---

## ⚔️ PvE 战斗系统（Phase 1-4 ✅ 完成，Phase 5-6 📋 待开始）

**模块架构**：`combat/scoreSystem.js`（积分持久化）+ `combat/enemyAI.js`（8状态机）+ `models/enemies.js`（程序化敌人）+ `maps/*.map.json`（战斗配置）

**敌人类型**：装甲突击车（近战冲撞+喷火）✅ | 导弹发射车（远程）📋 | 重型坦克（精英）📋 | Boss炮舰（多阶段）📋

**积分接口** `window.ScoreSystem`：

- `getMapHighScore(mapId)` → `{ highScore, createdAt, settledAt }` | `settleScore(mapId, score)` → 结算+累加
- `getTotalScore()` / `clearAllScores()` / `clearMapScore(mapId)` / `clearTotalScore()`
- 持久化：localStorage `tank_demo_map_scores` + `tank_demo_total_score`

**AI 状态机**：IDLE → PATROL → ALERT → PURSUIT → SEARCH → ATTACK → STAGGER → DEAD（视野锥形检测+仇恨连锁25m半径）

**战斗集成**：

```javascript
const enemy = EnemyModels.createAssaultVehicle();
enemy.cfg = mapEnemyConfig;
scene.add(enemy);
EnemyAI.updateEnemyAI(enemy, dt, players, scene); // 每帧
ScoreSystem.settleScore('test_map_03a', finalScore); // 结算
```

**03a地图**：装甲突击车×2 | **04a地图**：程序化丧尸×30（5×6网格集群）

### v0.59.2 新增已知问题

| #   | 问题                                  | 严重度 | 位置                              |
| --- | ------------------------------------- | :----: | --------------------------------- |
| 1   | 敌人大角度上坡后偶发不复活            |   🔴   | engine.js \_checkTrainingRespawns |
| 2   | 敌人复活后偶发不追击，需受击才激活    |   🟡   | enemyAI.js                        |
| 3   | 敌人坡地翘头/陷地（地形俯仰采样不准） |   🟡   | engine.js gameLoop enemy section  |
| 4   | 敌人对我方山顶开炮弹道偏低            |   🟡   | enemyAI.js aimTurretAt            |
| 5   | 敌人上坡悬浮，俯仰侧倾不平滑          |   🟡   | engine.js terrain adaptation      |
| 6   | 山丘遮挡时敌人不主动绕路找角度        |   🟡   | enemyAI.js updateChase            |

---

## ✅ 地图编辑器 `map_editor.html`（7 阶段 ✅ 全部完成）

| 阶段          | 内容                                                                     |
| ------------- | ------------------------------------------------------------------------ |
| **Phase 1-2** | HTML四区布局 + 高度笔刷(5种) + SplatMap纹理(6种) + 2048²地面贴图合成     |
| **Phase 3-4** | 实体放置(出生点/障碍物/敌人/巡逻路径) + 蓝图CRUD + JSON导出/导入         |
| **Phase 5-6** | 水体+桥梁 + 敌人配置面板 + UndoManager 50步 + 主游戏集成                 |
| **Phase 7**   | 树状道路+村落：主路→村路→广场→建筑集群+连接小路，双端(index.html+编辑器) |

**道路+村落生成**：`generateRoadVillageSystem()` → 7步管线（主路8.5m→分支村路→广场圆盘→建筑集群→连接小路→树木填充→绿化带）

**数据流**：编辑器内存 → localStorage蓝图表 → 导出JSON → `convertBlueprintToMapConfig()` → 主游戏离散高度图双线性插值加载

---

## 🔧 固化工作流（v0.38.1 新增）

### 导出 → 固化 → 替换 三步流程

```
1. 模型工厂 GUI 调参 → Ctrl+S 保存
2. 点击「📥 导出JSON固化」按钮 → 下载完整嵌套配置JSON
3. 运行 固化.ps1 → 一键完成 JSON→源码 替换
```

### 固化.ps1 使用方法

```powershell
.\固化.ps1
```

脚本自动完成：

- 读取下载的 JSON 配置
- 替换 `model_factory.html` 中的 `T34_85_V16_CONFIG`
- 替换 `model_factory.html` 中的 `TANK_CONFIG`（如有）

### 注意事项

- 固化前确保模型工厂 GUI 中的配置已调优完毕
- 固化后需 `Ctrl+F5` 强制刷新验证
- 固化.ps1 同时更新 `model_factory.html` 和 `models/tank_procedural.js`（如已建立映射）

---

## ☁️ v0.60.x 新增 (2026-06-15)

### 狙击模式

| 属性       | 值                            | 位置                     |
| ---------- | ----------------------------- | ------------------------ |
| 切换       | 右键 button=2                 | engine.js mousedown      |
| FOV        | 25°                           | SNIPER_FOV               |
| 灵敏度     | 0.0015                        | SNIPER_MOUSE_SENSITIVITY |
| 俯仰       | -45°~+60°                     | \_sniperPitch            |
| 摄像机偏移 | turretPivot + Y 0.45 + 前 0.8 | placeCamera()            |
| 退出同步   | cameraYaw=atan2(bd.z,bd.x)    | mousedown                |

### 动态天空 (js/sky.js)

| 属性             | 值                                                  |
| ---------------- | --------------------------------------------------- |
| 穹顶半径         | maxSide \* 1.7                                      |
| 云球半径         | maxSide \* 1.65                                     |
| fog near         | maxSide \* 0.4 (v0.60.4: 从0.8降低)                 |
| fog far          | maxSide \* 1.6                                      |
| camera far       | maxSide \* 2.2                                      |
| 太阳方位/仰角    | 120° / 35°                                          |
| fog颜色          | #c8d8e0                                             |
| 云噪声           | 2层FBM值噪声, smoothstep软边缘                      |
| 天空球分段       | 96×48 (v0.60.4: 从64×32提升)                        |
| GLSL precision   | highp float (v0.60.4: 新增)                         |
| outputColorSpace | THREE.SRGBColorSpace (v0.60.4: 新增)                |
| sunLight对齐     | getSunDir() API → DirectionalLight位置/阴影方向同步 |

### 性能优化 (v0.60.4)

| 优化                  | 说明                                                                                                 |
| --------------------- | ---------------------------------------------------------------------------------------------------- |
| 草丛InstancedMesh合并 | 按单元格分块→按类型合并, draw call从~48-192降至固定3                                                 |
| 草材质降级            | MeshStandardMaterial(PBR)→MeshLambertMaterial(漫反射), GPU着色器开销降~30%                           |
| 草片面剔除            | DoubleSide→FrontSide, 片段着色器调用减半                                                             |
| 河流碰撞网格化        | 新建\_riverGrid(SpatialGrid, cellSize=10), checkCollision/isInRiver/多轮推离全部queryByDistance O(1) |
| 调试面板              | 新增renderer.info.render.points显示                                                                  |

### 六足AI修复 (v0.60.1~v0.60.3)

| 修复           | 位置                                             |
| -------------- | ------------------------------------------------ |
| 复活腿部冻结   | \_processTrainingRespawn → HexapodEnemy.init(en) |
| 复活后退修复   | retreating: radialW< -0.3 (原>0.3反了)           |
| 复活弹药重置   | \_missileAmmoL/R = 4                             |
| 导弹最短距离   | 15m (太近打不中)                                 |
| 导弹最远距离   | 50m                                              |
| 加特林过热停转 | ai.\_overheated → spinRPS=0                      |

---

## ☁️ v0.65.x 新增 (2026-06-23~30)

### 坦克AI托管完整修复 (v0.65.0)

| 问题               | 修复                                                             |
| ------------------ | ---------------------------------------------------------------- |
| player1无.position | 加Object3D兼容接口(position/rotation/userData引用group)          |
| 朝向约定           | 加enemyForward/enemyTargetYaw/enemyIsTank helper按cfg.type选约定 |
| 玩家不开炮         | 新增firePlayerTrainingShell + 玩家AI块开炮                       |
| 炮塔不转           | AI托管跳过gameLoop的turretPivot覆盖(让aimTurretAt独占)           |
| 视角跟车体         | cameraYaw=atan2(barrelDir.z, barrelDir.x)                        |
| 敌人侧滑           | updateEngage改转向后重算enemyForward(履带式先转再走)             |
| 车头90°/炮击低     | 删敌方模型-90°旋转; CHASE→ENGAGE改全向π                          |
| 玩家不动           | enterTrainingMode设group.position/rotation.y(出生点/朝敌方)      |
| 复活后不动         | kill函数加hp=0; PATROL→CHASE改距离only; 玩家复活朝向=π/2-yaw     |
| 复活远卡住         | 敌方复活设玩家ai.state=chase+target+lastSeenPlayerPos            |

### 坦克AI远距离对峙/出界修复 (v0.65.1)

| 问题             | 修复                                                |
| ---------------- | --------------------------------------------------- |
| 远距离对峙       | updateChase: dist>viewDist直线追近(不再侧向)        |
| 地形遮挡侧推     | 视野内遮挡时侧向目标朝玩家(pp+侧向×10, 既靠近又绕)  |
| 推出地图         | moveEnemyToward加worldHalfW/D硬限制(任何情况推不出) |
| retreating方向反 | radialW>0.3→< -0.3(太近才后退, 太远应前进)          |

### 性能优化 (v0.65.1~v0.65.2)

| 优化                   | 收入                                 |
| ---------------------- | ------------------------------------ |
| P-burst-1 炮弹循环缓冲 | 战斗阶段burst 29.48→13ms, 最坏帧-67% |
| P-burst-2 碎片对象池   | GC停顿37→20ms(-46%), 碎片池复用59个  |
| 地面射线高度图优化     | 131072三角brute-force 14ms→二分1-7ms |

### 建筑IM碎片化合并修复 (v0.65.3)

| 问题             | 修复                                                                                          |
| ---------------- | --------------------------------------------------------------------------------------------- |
| 真实根因         | obstacles.js外层遍历每个子mesh(非唯一材质) + buildings.js每次create都new材质 → 同材质重复建IM |
| 材质全局化       | buildings.js 3个create函数材质提升为18个模块级全局常量                                        |
| 按material去重   | obstacles.js外层循环加seenMat Set, 每个唯一材质只建1个IM                                      |
| 实测(map01a单人) | bld-im 141→18(-87%), 窗户材质IM 56→3, 三角面1.58M→1.23M(-22%), 视觉零损失                     |

### 树冠阴影恢复 (v0.65.4)

| 树种          | 方案                                                |
| ------------- | --------------------------------------------------- |
| spherical/oak | 极简proxy IM(Icosahedron 20面球, 藏树冠内投阴影)    |
| conical       | 扁平三角棱柱(448三角/棵)直接crownIM.castShadow=true |

### 树冠阴影透明proxy (v0.65.5, 推翻v0.65.4)

| 树种          | 方案                                                                                     |
| ------------- | ---------------------------------------------------------------------------------------- |
| spherical/oak | proxy改透明(opacity=0, depthWrite=false) + castShadow=true; 主pass看不见, 阴影pass投阴影 |
| proxy生命周期 | obstacleData加imProxy字段 + disposeTreeInstance同步隐藏proxy实例                         |
| conical       | 保持直接castShadow=true(448三角质量最好, 不适合球proxy)                                  |

### 尺度标定 (v0.65.5)

| 参数            | 值                                 | 说明                                                                    |
| --------------- | ---------------------------------- | ----------------------------------------------------------------------- |
| METERS_PER_UNIT | 1.3 米/单位                        | 真实T-34/85高2.6m ÷ 坦克渲染1.99单位 = 1.306, 取1.3; 旧值4.706偏大3.6倍 |
| 渲染公式        | targetHeightM / METERS_PER_UNIT    | 与ud.height/baseHeight无关(scale抵消)                                   |
| conicular高度   | 2~~4.2米                           | 新值=旧渲染单位×1.3, 保持视觉                                           |
| spherical高度   | 2~~3.9米                           | 同上                                                                    |
| oak高度         | 2.5~~5米                           | 同上                                                                    |
| 建筑高度        | bungalow 2.5~~3.3 / villa 3~~5.5米 | 同上                                                                    |
| 地图编辑器UI    | info-size/overlayInfo/尺寸滑块×1.3 | 显示米, 内部仍存单位                                                    |

### 环境对象开发规范 (v0.65.5)

| 规范          | 说明                                                           |
| ------------- | -------------------------------------------------------------- |
| 3铁律         | IM强制 / 材质全局化 / dispose分级                              |
| 建筑checklist | 程序化生成 / category分类 / 阴影决策树 / 生命周期同步          |
| 树木checklist | 阴影决策树(448三角以上直接投 / 否则proxy透明投) / 生命周期同步 |
| 生命周期同步  | obstacleData加imProxy字段; dispose时同步隐藏所有IM实例         |
| 8条反面清单   | 禁每new材质 / 禁每建IM / 禁共享geometry未dispose / 等          |

### 建筑朝向基础 (v0.65.6)

| 问题             | 修复                                                                        |
| ---------------- | --------------------------------------------------------------------------- |
| mapLoader丢yaw   | mapLoader.js:222补传yaw: e.yaw\|\|0                                         |
| obstacles字段错  | obstacles.js:821用bld.yaw(原读angle字段)                                    |
| 编辑器marker加门 | createBuildingMarker三种建筑+Z面加亮黄门(薄盒外突), 对称低模朝向可辨识      |
| R键旋转UI        | map_editor.html选中建筑R键步进15°(Shift反向), 更新ent.yaw+marker.rotation.y |

### 模型工厂固化一键保存 (v0.65.8)

| 功能         | 说明                                                                     |
| ------------ | ------------------------------------------------------------------------ |
| server.py    | 自定义HTTP服务器 + POST /api/solidify端点(括号匹配定位源文件const并替换) |
| Ctrl+S三合一 | POST固化到源文件 + 存localStorage + 下载JSON备份                         |
| 虎式调试着色 | 扩展getMaterial() hexapod条件到tiger_v16, 新增camo_green/camo_dark/wood  |
| 六足UI清理   | toggleHexTurnTest守卫后移 + rebuildModel清理顺序 + updateAnimButton加固  |
| UI精简       | 移除4个冗余按钮(输出姿态/应用/导出/加载); BoxHelper默认关                |

### 模型工厂框选交互 (v0.65.9)

| 功能            | 说明                                                               |
| --------------- | ------------------------------------------------------------------ |
| Ctrl+左键框选   | setupRaycaster加框选模式(maybeBox→拖拽>4px转boxActive), 青色选择框 |
| Shift+Ctrl增选  | 橙色选择框, 追加不清空、不重置滑块                                 |
| 批量滑块修复    | 模块级batchState + resetBatchSliders(清6值+updateDisplay)          |
| #info操作提示区 | 重组4行(视角/选择/框选/快捷键), 颜色对应交互, max-width:340px      |

### 履带绕紧skill (v0.65.9)

| 功能                    | 说明                                                                   |
| ----------------------- | ---------------------------------------------------------------------- |
| 技能目录                | .claude/skills/tank-track-fit/(SKILL.md + 2脚本)                       |
| compute_track_params.py | 读轮子位置 → node eval解析配置 → 转履带组局部坐标 → 复现6段周长算count |
| verify_track_fit.py     | Playwright截图 + PIL像素验证(<3px=紧贴, 避免肉眼/AI误判)               |
| TrackChain参数化        | buildTrackChain/getTrackPlateTransform加roadWheel\*参数(默认T-34原值)  |

### 新增ProfiledExtrude几何类型 + 虎式炮塔马蹄形建模 (v0.65.10)

| 几何类型        | buildProfiledExtrude(shapeDef, roofProfile, arcSegments)                                                                                                  |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 算法            | XY轮廓 + roofProfile沿Z变高拉伸; THREE.Shape解析 → roofH(y)插值 → 侧面独立quad strip → ShapeGeometry三角化底面 + 翻转索引屋顶 → 合并+computeVertexNormals |
| shape格式       | ['line', x, y] + ['arc', cx, cy, r, startAngle, endAngle]数组, 支持任意凹多边形                                                                           |
| roofProfile格式 | [[y_position, z_height], ...]沿Y轴(前后)定义可变高度, 自动排序+插值                                                                                       |
| GUI面板         | 圆弧分段滑块 + Shape JSON + 屋顶剖面JSON                                                                                                                  |
| 虎式炮塔        | 炮塔主体Box→ProfiledExtrude, 马蹄形俯视轮廓(前脸1.4+后方弧r=0.75) + 两段屋顶(前斜面0.45→转折0.65→后水平0.65), rotation[-π/2,0,0]转Y-up站立                |
| 法线保障4机制   | quad独立顶点(侧面硬边) / cap Z±0.0001偏移(cap/side接缝硬边) / 屋顶翻转索引(法线朝+Z) / winding验证(FrontSide即正常)                                       |

### PE编辑器+左右命名修复+螺栓外侧 (v0.65.11)

| 功能          | 说明                                                                                             |
| ------------- | ------------------------------------------------------------------------------------------------ |
| Shift减速滑块 | Shift+拖滑块=精细1/10, capture劫持lil-gui slider绝对映射改用相对增量                             |
| 多选自动滚动  | 框选≥2部件右侧面板scrollIntoView到📦批量编辑                                                     |
| PE预设+控制点 | shape预设下拉6种(马蹄形/矩形/梯形/半圆/六边形/扇环) + roofProfile增删滑块 + arc命令扩展clockwise |
| PE 2D编辑器   | js/pe_shape_editor.js独立模块, overlay+canvas拖拽控制点(蓝■/绿●/黄●)改shape, rAF节流rebuild      |
| 左右命名调换  | 虎式30个+T-34 32个部件左右name对调(驾驶员视角x>0=左), plateWidth 0.5→0.85                        |
| 螺栓朝外侧    | isLeft改按世界position.x+boltY反号(rotation.z=π/2局部+Y→世界-X)                                  |
| 履带修复      | 最后块浮点累积落原点兜底, getTrackPlateTransform pos→pA                                          |

### 虎式MG34高射机枪+热带沙漠迷彩+材质覆盖+UV修复 (v0.65.12)

| 功能               | 说明                                                                                                      |
| ------------------ | --------------------------------------------------------------------------------------------------------- |
| MG34 9部件         | 环形导轨(Torus)→枢轴支柱(Cylinder)→机匣(Box)→散热套管(Cylinder)→枪管尖→双鼓弹匣(扁Cylinder)→握把→环形瞄具 |
| 热带沙漠迷彩       | Canvas程序纹理, 沙米色系(底色#e0d898+黄棕斑块+深褐点缀), 截图取色                                         |
| 底色乘法修复       | mat.color.set(0x808080)中间灰, 杜绝MATERIAL_DEFS暗色与纹理相乘压暗                                        |
| 动态迷彩下拉       | 虎式显示🔧调试色+🏜热带沙漠迷彩; 其他模型显示丛林/沙漠; 切换模型自动同步默认值                            |
| 材质覆盖 14处      | 炮管总成(炮盾/主炮管/抽烟器/制退器/同轴机枪)+舱盖×2+排气管×2+挡泥板×2+座圈+MG枪托→camo                    |
| 非调试色去轮廓     | 2处EdgesGeometry加currentCamoType=='debug'条件                                                            |
| ProfiledExtrude UV | addQuad U沿周长递增(i/N,(i+1)/N) V底0→顶1, 炮塔主体/尾舱纹理正常环绕                                      |

### 虎式动画展台+展台回归修复 (v0.65.13)

| 功能                 | 说明                                                                                                                         |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| 虎式动画展台 5动画   | 炮塔360°旋转/炮管俯仰-8~+15°(真实KwK36 L/56)/MG34绕枢轴支柱顶端防空旋转(水平360°+俯仰-5~80°)/履带前进/履带后退               |
| \_TANK_PROFILE差异化 | T-34/虎式共用\_tank\*框架(collectRefs/updateFrame/reset/destroy), 按模型差异化(履带名/MG支柱名/MG旋转部件/俯仰角/MG旋转参数) |
| 展台回归修复         | 补回缺失的computeTrackTotalLen/updateTrackPlates两函数(v0.65.9履带绕紧重构遗漏, 致T-34/虎式展台抛ReferenceError→不播放)      |
| MG轴心               | pivot用支柱完整坐标(x,y+H/2,z), 虎式支柱偏离mgGroup原点(0.68,\_,-0.81)枪管不再绕车体中心甩飞; T-34支柱原点零回归             |
| 炮管俯仰轴心         | 炮塔前板前端面(z+厚/2), 虎式实测[0,-0.772,1.907]; T-34无前板fallback炮盾中心(零回归)                                         |
| nodeMap结构          | 叶子mesh的info.group是包装Group直接挂父Group, info.group.position=配置position; MG部件迁移逻辑虎式/T-34通用                  |

### 人形动画 rest 基线架构 (v0.79.11~14)

| 机制                | 说明                                                                                                                             |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| 动画数据层          | `BASE_ANIMS`(REST_POSES+6动作关键帧模板) → `SKELETON_VERSIONS[key].anims` 独立深拷贝 → `MODELS[v].anims` 运行时继承(文件尾 forEach) |
| rest 偏移制         | 轨道带 `restKey`(如 `torso:x`) 时 keyframe v 作偏移量叠加到 rest 基线; 无 restKey 为绝对值                                          |
| 直立基线 (v0.79.14) | REST_POSES + 4 版本 `torso:x/neck:x/head:z` 全 0(直立); 手臂外张 z±0.09 与 pelvis:y(0.375~0.5 每骨架)保留                           |
| 丧尸驼背注入        | MODELS anims 继承版本后 `Object.assign(restPoses, ZOMBIE_HUNCH={torso:x:0.2,neck:x:0.22,head:z:0.08})`; 深拷贝隔离不污染版本        |
| hunch 参数语义      | `deriveNode`: `torso.rotation[0] + hunch`(0=直立,正值=驼背量); 游戏 Idle/Walk/Run 无 torso 轨道→保持树静态驼背=hunch                |
| 游戏侧驼背机制      | 游戏动画系统**无** rest 复位——驼背来自树静态 rotation(torso_pivot); rest 基线只对带 restKey 轨道生效(Attack 髋轨道)                 |
| 工厂侧驼背机制      | humanoid_factory collectRefs 每次把全关节复位到 rest 基线(驼背/直立切换生效); teacher_f torso 是 Group(沙漏)无 pivot                |
| 验证脚本            | `artifacts/inspect_hunch.js`(Node 27 断言) + `verify_upright.js`(工厂 7) + `verify_upright_game.js`(游戏 17)                        |

### 工厂模型菜单更名"人形敌人" (v0.79.15)

| 项                 | 说明                                                                       |
| ------------------ | -------------------------------------------------------------------------- |
| modelOptions 下拉  | `'🧟 校园丧尸'` → `'🧍 人形敌人'`(model_factory.html modelOptions, 唯一UI处) |
| 内部键不变         | `humanoid` 键/骨架版本/烘焙管线/动画注入零改动                              |
| 代码注释保留       | 引擎侧"校园丧尸"注释描述的是校园丧尸系变体数据(spawner/刷新), 不改           |

### 变体名加"校园丧尸"后缀 (v0.79.16)

| 项                  | 说明                                                                                   |
| ------------------- | -------------------------------------------------------------------------------------- |
| HUMANOID_VARIANTS   | 四个 name: `学生(男/女)·校园丧尸`、`教师(男/女)·校园丧尸`(humanoid_config.js, 数据源)     |
| name 唯一消费者     | 工厂体型参数变体下拉 variantOptions(model_factory.html:4058); 游戏侧全用内部键, 零影响   |
| 与菜单层级关系      | 模型菜单"🧍 人形敌人"(总类) → 变体下拉"学生(男)·校园丧尸"(系别); 非丧尸人形后续可并列加变体 |

### 攻击拆分 Swing/Punch + legacy 树镜像修复 (v0.79.17)

| 项                        | 说明                                                                                                                                  |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Attack→Swing 改名         | humanoid_config 5 处 actions 键(codemod 括号匹配) + humanoid_factory 7 动画列表 + enemies.js DUR + engine.js 丧尸 nameMap attack:'Swing' |
| Punch 拳击 13 轨道 ×5 副本 | 右直拳 orthodox: 站架(左腿前-0.3/右腿后+0.25 膝弯) + 双拳护脸(-0.45/-1.75) + 右拳后拉→爆发(-1.35/-0.25 伸直) + 扭腰(torso y -0.18→+0.42) + head y 反向 + torso x 偏移制 + pelvis 微沉 |
| ⚠️ legacy 树左右镜像       | HUMANOID_BASE 系(游戏) l_upper_arm x=-0.3 与新数据层(工厂) +0.171 镜像(均面朝+Z); rotation **y/z 语义相反**, x 轴与位置不受影响          |
| mirrorAnimsForLegacyTree  | enemies.js: 游戏消费时 rotation y/z 轨道值取负 + rest y/z 键取负(pelvis:y 位置排除)——两侧动作协调(左右手互换方向正确)                    |
| Die 隐性 bug 顺带修复      | 游戏 Die 双臂 z 外张自 v0.79.11 起实际向内插身体(镜像未被察觉); 镜像变换后正确外张                                                       |
| 动画编写约定               | 新动画一律按新数据层(解剖学 l=+X)编写; 工厂直接消费, 游戏侧自动镜像——**不要**在游戏侧单独写镜像关键帧                                     |
| 验证脚本                   | `artifacts/verify_punch.js`(Node 155 + 工厂 6 + 游戏 6 + 0 错误)                                                                         |

### 拳击力度感增强 (v0.79.18)

| 项                    | 值/说明                                                                                                    |
| --------------------- | ---------------------------------------------------------------------------------------------------------- |
| 蓄力上臂后摆           | r_upper_arm x **+0.85**(49°, t=0.45) — 肘部拉到**躯干后方 0.21**/肩后 0.15(此前 -0.3 肘在身侧)             |
| 蓄力极限屈肘           | r_forearm x **-2.05**(117°) — 拳收肩侧, 较护卫位收回 0.19                                                   |
| 爆发摆幅              | +0.85→-1.4 = **2.25 rad**(此前 1.05); 拳行程 0.57m/0.1s(工厂 Δz 0.44/游戏 0.63)                            |
| 扭腰                  | -0.32(反向拧)→+0.52(右肩前送) = **0.84 rad**(较旧 +40%)                                                     |
| 下盘联动              | 蓄力躯干后仰-0.06/后膝深弯 0.65 重心后坐 → 爆发前倾 0.2/后腿蹬直 0.08/前腿踩实/重心下沉 -0.06               |
| ⚠️ 展台采样坑          | 连续 sample 必须 collectRefs 重置——updateFrame 的 _t 跨调用**累计**, 会跨过蓄力峰值(verify_punch2 初版 4 败根因) |
| 验证脚本              | `artifacts/verify_punch2.js`(Node 35 + 工厂 5 + 游戏 2 + 0 错误)                                             |

### 跑步摆臂屈肘 90° + 切动画残留修复 (v0.79.19)

| 项                     | 值/说明                                                                                                       |
| ---------------------- | ------------------------------------------------------------------------------------------------------------- |
| Run 前臂轨道           | l/r_forearm x 屈肘基线 -1.52(90°), 前摆甩开 -1.35(77°)/后摆收紧 -1.70(97°), 左右反相(跑步技术: 肘弯~90°)       |
| Walk                   | 保持直臂(用户确认无问题), 无前臂轨道                                                                          |
| 切动画关节残留(根因)    | 游戏 `_updateLayer` 只写当前动画轨道——新轨道(Run 前臂)写入后切无该轨道动画(Walk)即**永久残留**; Die 后 head 歪同类 |
| play 包装复位          | `createHumanoidAnimationSystem` 包装 asys.play: 切动画时非新动画轨道关节(uuid 对比)复位到**创建时树静态**(含 hunch) |
| ⚠️ 新增轨道规则         | 给任一动画新增轨道时, 必须考虑其在其他动画的复位——工厂 resetState 已覆盖, 游戏靠 play 包装; 轨道值是绝对制则切走自动复位 |
| codemod 教训            | 数组插入在 `]` **之前**; compact join(',') 勿漏逗号; 改完立即 eval 自检(`artifacts/fix_run_insert.js` 修复首版事故) |
| 验证脚本               | `artifacts/verify_run_forearm.js`(Node 30 + 工厂 5 + 游戏 2 + 0 错误)                                          |

### 奔跑前臂向前中线内收 (v0.79.20)

| 项                | 值/说明                                                                                     |
| ----------------- | -------------------------------------------------------------------------------------------- |
| Run 前臂 z 轨道    | l: 前摆 -0.20/后摆 -0.06; r 反相(前摆 0.06/后摆 0.20); 与屈肘 x 摆臂同相位                      |
| 符号约定          | 工厂树 l 侧 z 负=内收 / r 侧 z 正=内收; 上臂自然外张 rest ±0.09 不变                           |
| 游戏镜像          | mirrorAnimsForLegacyTree z 取负后方向仍向中线(实测 +0.07/+0.19)——镜像对称自动适配               |
| 验证              | Playwright 13(z 内收 4+屈肘 5+游戏镜像+Walk 回归); verify_punch2 8/8; verify_punch.js 首版断言过时弃用 |

### Walk 步距不均修复 (v0.79.21)

| 项                        | 值/说明                                                                                  |
| ------------------------- | ----------------------------------------------------------------------------------------- |
| 根因                      | `r_upper_leg` 与 l 错相 **0.25**(应 **0.5**)——迈步节拍 0.25/0.75 交替, 一步大一步小        |
| 引入版本                  | v0.79.11 步态数据化; 数值对称检查发现不了相位错(r_lower_leg/Run 均正确, 仅此一处)          |
| 修复                      | r_upper_leg = l 半周期平移(0:0.12, 0.25:0.25, 0.5:-0.45, 0.75:-0.08, 1:0.12)×5; pelvis 双峰 |
| ⚠️ 步态对称验证方法         | 采样全周期找左右踝 z 局部极大值帧号, 断言交错且间隔=半周期(实测 R@42→L@86→R@130 恒44帧); 只比 min/max 范围测不出相位 bug |
| 验证脚本                  | `artifacts/verify_walk_phase.js`(Node 15 + Playwright 3)                                   |

### 跑步前臂上弯 (v0.79.22)

| 项                     | 值/说明                                                                                     |
| ---------------------- | -------------------------------------------------------------------------------------------- |
| 几何公式               | 前臂净前弯 = \|upper.x + forearm.x\| 需全程 ≥1.57(90°)——上臂后摆+0.5 会抵消屈肘, 只看 forearm 值会误判 |
| forearm x 新值         | 后摆 -2.10(净1.60)/过渡 -1.75(净1.60)/前摆 -1.55(净2.05=上仰27° 拳指下巴); r 侧反相             |
| 实测                   | 前臂方向 yDir 最低 +0.025(高于水平)/前摆拳 y0.88 距下巴~0.1/拳高于肘 Δ0.154                     |
| 验证方法               | `artifacts/verify_forearm_up.js`: elbow→hand 归一化 y 分量 ≥ -0.05 即不低于水平(比旋转值断言直接) |

### 奔跑前迈膝弯 (v0.79.23)

| 项                | 值/说明                                                                          |
| ----------------- | --------------------------------------------------------------------------------- |
| 根因              | 旧值前迈极限膝 **-0.3(过伸反张)**——直膝棍腿, 膝负值违反生理(膝不过伸)               |
| lower_leg 新值     | 前迈 -0.3→+0.5(L 形弯折29°)/着地 0.05→0.25 缓冲/摆动折叠期 1.85 保留(脚跟收臀); r 半周期平移 |
| 实测              | 前迈膝 0.46/0.46、膝高于踝 Δ0.128(小腿倾斜弯折可见)、折叠期 1.80 保留                |
| 验证脚本          | `artifacts/verify_run_knee.js`(帧1/26 前迈 + 帧12/37 折叠)                          |

### 四变体新骨架烘焙+丧尸专属动画 (v0.79.24)

| 项                        | 说明                                                                                              |
| ------------------------- | ------------------------------------------------------------------------------------------------- |
| VARIANT_SKELETON 映射      | 学生男/女→v1-儿童 / 教师男→v1-成年男 / 教师女→v2-成年女性；VARIANT_BODY 体型(teacher_f curves0.7)   |
| bakeModel 完整 addon 注入  | 镜像/双挂鞋裤(DUAL_LEG_ADDONS)/WRAP 包裹联动 build/curves 放大/学生下摆 grow；tree 裸21→穿衣28~40 节点 |
| MODELS[v] 双动画           | `anims`(骨架直立 7 动画, 工厂骨架模式用) + `zombieAnims`(丧尸 6 动画, 工厂变体/游戏用)               |
| 丧尸动画集 deriveZombieAnims | 删 Punch + 驼背 rest + Walk 拖行(左腿好/右腿瘸膝僵直0.42~0.58+躯干摇摆+跛动骨盆, 2.2s) + Run 奔袭(双上臂前伸-1.25同相+前臂垂抓-0.5+头前探, 1.0s) + durations 表 |
| 消费端                     | 工厂变体→zombieAnims(动画表**动态生成**: humanoid_factory collectRefs 按配置 actions 键建 6/7 项, 原地更新保持引用); 游戏 createCampusZombie 直连 MODELS 树(新树 l/r=解剖学, **不再 mirrorAnimsForLegacyTree**) |
| ⚠️ 烘焙 NaN 教训           | 下摆 grow 曾把 TaperedBox 9 参数截断为 3→NaN 几何; 教师误 grow(骨架名≠变体名). 修复: `_variantKey` 判定 + `size.slice()` 只放大底面宽/深. **改 size 数组必须保留全部参数位** |
| 动画表动态化注意            | humanoid_factory 的 names/durations/categories 是暴露引用, collectRefs 必须**原地清空重填**(length=0+push), 不能重新赋值 |
| 验证脚本                   | `artifacts/verify_baked_variants.js`(Node 35 + 工厂 8 + 游戏 15)                                    |

### addon 适配新骨架四项修正 (v0.79.25)

| 项                     | 值/说明                                                                                          |
| ---------------------- | -------------------------------------------------------------------------------------------------- |
| 教师女去胸臀           | addons 删 bust/hips（v2 骨架自带曲线，楔形是旧树补形产物）                                          |
| 鞋子(三种)             | 0.2×0.12×0.32 → 0.118×0.055×0.235（脚 0.112×0.045×0.225，宽/长各 +0.006/+0.010 防穿模）              |
| 发型                   | short_hair_m 半球 r0.22 斗笠→**0.118** 贴头 + mesh y=+r/2（geo.center 后半球原点在 bbox 中心, 赤道对头心）+ **side:2 双面渲染**（enemies/model_factory 两侧: `mat.clone()+DoubleSide`）; ponytail r0.06→0.035/fringe/bun 同步缩小 |
| snap 贴胸机制          | ADDON def 加 `snap:{y,x,out}`（badge/stripes/tie/placket/collar）——bakeModel 按 torso_upper(RidgeBox) 前表面公式（脊线分段插值+半宽插值钳制）计算 z 改挂 torso_upper。**配饰跨骨架贴合的唯一正解**，静态 position 无法适配几何差异 |
| ⚠️ 贴附验证方法         | 同高度顶点切片（|v.y-targetY|<0.03 取 max z）——整体 bbox 对斜面/锥度躯干不公平会误报                |
| 验证脚本               | `artifacts/verify_addon_fit.js`(Node 11 + Playwright 12)                                            |

### 发型露眼/衣物收小/裙动画/死亡裙没地 (v0.79.26)

| 项                     | 值/说明                                                                                            |
| ---------------------- | ---------------------------------------------------------------------------------------------------- |
| 发型头盔式后倾         | short_hair_m Group rotation.x **-0.35**（前缘上抬露眼，实测发下缘 y0.944>眼 y0.934）                    |
| 衣物收小               | 裤 WRAP gap 0.03→0.016（短裤烘焙宽 0.182→0.15）/短裤长 0.2 膝上/裙摆 gapBottom 0.34→0.19（裙摆 r 0.46→0.25）/校徽 0.055/肩章 0.09×0.12/领带 0.2/领子 y0.7 |
| 裙摆动轨道             | zombieAnims 按变体裙名（ah_skirt/ah_gskirt）注入 Idle(±0.05)/Walk(前±0.14+z±0.07)/Run(×1.4)/Die——**播放器 P/O 表扩展收集非 JOINT_NAMES 轨道关节**（enemies+humanoid_factory）；切动画复位扩展覆盖裙 rotation+position |
| Die 裙前摆没入地面     | 裙 rotation.x -1.35 + **position.z +0.5**——⚠️ **躺平后局部 y 映射世界 z（无效），z 才是世界下沉轴**（前倒 90° 后局部 +Z→世界 -Y）；实测裙底 -0.229 没入地面、身体贴地 0.007 |
| ⚠️ Cylinder 空几何 bug  | enemies buildHumanoidRig `node.segments||8` 吃数组 [16,1] → NaN 段数 → **空几何（游戏裙一直隐形）**；修 `Array.isArray?[0]:seg`。工厂侧本就取 [0] |
| 验证脚本               | `artifacts/verify_v7926.js`（顶点法 bbox——headless 无渲染帧时 Box3.setFromObject 矩阵合成不可靠，用 matrixWorld+顶点遍历） |

### 骨盆裤裙同色+死亡整体下沉贴地 (v0.79.27)

| 项              | 值/说明                                                                                       |
| --------------- | ----------------------------------------------------------------------------------------------- |
| 骨盆同色        | `PELVIS_CLOTH`（学生 shorts_red 0xb81c28/教师 trousers_grey 0x3a3a42）bakeModel 后处理改 pelvis.materialId |
| 死亡浮空根因    | Die root 高度末帧 0.475 是 legacy 躺地值，**新树整体悬空 ~0.31**（各部位 min.y 0.30~0.35）            |
| 修复（用户方案） | **姿势不变只降高度**：删掉 v0.79.26 裙 position.z 下沉 + scale 花活；Die root 末帧按骨架定制（学生 0.1/教师男 0.04/教师女 0.12，保持 0.78 帧下沉幅度 0.075）——躯干贴地 trunkMin≈0、裙摆圆环自然没入 skirtMin -0.11、四肢微穿 ≤9cm 为散落自然 |
| 验证脚本        | `artifacts/verify_v7927.js`（四变体：无裙轨道/躯干贴地/四肢贴地/裙没入 15 项）                       |

### 饰物降位缩尺寸+教师下躯干裤裙色+刘海分块 (v0.79.28)

| 项               | 值/说明                                                                                            |
| ---------------- | ---------------------------------------------------------------------------------------------------- |
| 饰物过高根因     | snap 贴胸**缺 pivot 补偿**——渲染层子件 position += -pivot（torso_upper pivot[1]=-0.145 → +0.145），snap y 几何坐标直接设置 → 饰物整体抬高半截躯干（到肩线上）。修复 `position.y = yy + pivot[1]` |
| 饰物再缩         | 领带 0.2→0.15/校徽 0.055→0.045/肩章 0.12→0.09/门襟 0.2→0.15/领子 0.06→0.05                            |
| 教师下躯干裤裙色 | bakeModel 对 teacher_* 的 torso_lower → trousers_grey（衬衫扎进裤裙）；学生 polo 外放保持 skin            |
| 刘海分块         | fringe_f 单 Box → Group 左右两块（±0.05/宽 0.035），中间缺口露眼（实测眼 x0.095 ∈ [0.048,0.112]）       |
| ⚠️ 贴附验证方法  | 浏览器 RidgeBox 顶点稀疏（底/脊/顶 3 行）+ headless 矩阵错值 → 切片断言不可靠；**权威验证 = 数据层 snap 公式复算**（间隙与期望值精确一致 0.005/0.006/0.008/0.012） |
| 验证脚本         | `artifacts/verify_v7928.js`(9) + `verify_addon_fit.js`(Node 5 复算 + Playwright 12)                     |

### 裤裙缩短+切动画裙上移修复+领巾缩+刘海加宽 (v0.79.29)

| 项                | 值/说明                                                                                           |
| ----------------- | --------------------------------------------------------------------------------------------------- |
| 教师裤            | 大腿段 0.68→**0.46**（中心髋下 0.115 裤底到膝）+小腿段 0.6→**0.35**（底≈踝）——旧 0.68≈整条腿长（大腿仅 0.3465）致裤比脚低 |
| ⚠️ 裙上移根因     | 工厂 collectRefs 把扩展关节 position.y **清零**（裙挂载位 -0.0375/-0.0875 被清）→ 切动画界面裙上移一截。Die 裙轨道 v0.79.27 已删，复位不再需要 → 删除。**扩展关节复位只应复位动画轨道改过的量** |
| 裙缩短            | 学生 0.425→**0.32**/教师 0.525→**0.38**（提升裙摆露小腿）                                              |
| 红领巾            | 结 0.07→**0.03** + 飘带 0.06×0.22→0.035×0.11（不再像红花）                                             |
| 刘海              | 块宽 0.035→0.045、外移 ±0.05→**±0.115**（内缘 0.0925 缺口覆盖双眼 ±0.083）、上移 y 0.03→**0.055**（与头顶衔接 发底-刘海顶<0.03） |
| 验证脚本          | `artifacts/verify_v7929.js`(9：裤底≥脚底/裙底高于踝/切动画 Δ=0.0000/领巾 0.06/刘海缺口+衔接)             |

### 短裤上移盖骨盆+发髻加大 (v0.79.30)

| 项            | 值/说明                                                                                    |
| ------------- | -------------------------------------------------------------------------------------------- |
| 短裤上移      | shorts_m position.y -0.1→**-0.06**（⚠️ **渲染 y = position.y + 0.2 pivot 补偿，数值减小=下移**——首改 -0.14 方向反了实测间隙变大）；裤顶盖入骨盆 +0.033 |
| 发髻加大      | bun_f 半径 0.055→**0.075** + 后移 z -0.078→**-0.1**（直径 0.147/后凸 0.069 不再扁平）            |

### 四变体穿上衣+平面血迹+刘海圆弧贴头 (v0.79.31)

| 项              | 值/说明                                                                                        |
| --------------- | ------------------------------------------------------------------------------------------------ |
| 上衣系统        | `VARIANT_TOP`（torso_upper：学生 polo_white/教师男 shirt_blue 0x3f6399/教师女 pink_tee 0xe38ba0）+ 学生下躯干 polo 色外放/教师裤裙色扎入；新材质键 pink_tee/shirt_blue/blood_red 两侧（enemies getHumanoidMat + 工厂 MATERIAL_DEFS） |
| 袖子            | `DUAL_LIMB_ADDONS`（bakeModel parents 链）+ WRAP 半径联动；学生白短袖/教师女粉短袖（盖肩头）/教师男蓝长袖双段（实测盖肩 1.191≥1.207、盖腕 0.604≤0.677、不盖手 0.919≥0.689） |
| ⚠️ 平面血迹     | **薄 Box（厚 0.004）交叠成不规则斑块**（用户澄清：非立体血滴球）——胸前 6 块 + 袖子 1-2 块，rotation.z 各异，贴前表面微凸 |
| 刘海悬浮根因    | 块 x=±0.115 **超出头半径 0.112**（悬浮）+ 直线排布。重排：块中心 (0.098, 0.0542, 0.001) 贴球面（y=sqrt(r²-x²)）+ **绕 Y ±1.56 朝向头心**——实测中心距头心 0.092 |
| 教师男 Die      | 长袖袖端下探致四肢更低 → dieRootY 0.04→**0.09**                                                    |
| 验证脚本        | `artifacts/verify_v7931.js`（Node 14 + Playwright 12：上衣色/袖子存在+覆盖几何/血迹/刘海贴球面）        |

### 袖子盖肩+血迹贴图化 (v0.79.32)

| 项                | 值/说明                                                                                            |
| ----------------- | ---------------------------------------------------------------------------------------------------- |
| 袖子盖肩          | 短袖 0.16→**0.22**+上移（学生袖顶 1.050≥肩 1.037/教师女 1.239≥1.209）；教师男长袖上臂段 0.34/上移（1.240≥1.207）——实测全盖肩 |
| 血迹贴图化        | **`makeBloodyCloth(base, speck, blood)` Canvas 皮肤式渲染**——底色+900 斑驳点+6 血斑椭圆（radial gradient 随机旋转压扁）+14 溅点+3 血痕；polo_blood（白）/shirt_blood（蓝）/pink_blood（粉）三张贴图，DEFS/MATERIAL_DEFS 改挂 map（color 白由贴图供色） |
| ⚠️ 自定义几何 UV   | RidgeBox/TaperedBox/TaperedHex/Wedge 无 UV→贴图不显示——enemies 4 个 mk 函数补平面映射 UV（x/bw+0.5, y/h）；工厂 4 个 build 已有固定 0-1 UV |
| 血迹几何删除      | blood_splatter addon 从变体移除+袖子内血块删除（全部立体血迹清除）                                      |
| 验证脚本          | `artifacts/verify_v7931.js`（15：盖肩×3/血衣 map/血迹几何删/长袖三项/刘海）+ 回归 38                     |

### 女裙收窄+圆台化+椭圆顶+膝上5cm (v0.79.34)

| 项                    | 值/说明                                                                                                                              |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| 复核（用户观察验证）  | 裙底腿扫掠仅 x±0.075 两窄带 z∈[-0.08,+0.13]（前偏），后半圆富余；旧裙摆轨道**相位反了**（前踢帧裙后仰帮倒忙，前向需求被自己撑大）           |
| 裙摆轨道跟腿耦合      | `skirtTracks` 重构为 **0.35×左大腿轨道**（`SKIRT_COUPLE_K`，Walk/Run 自动派生；前踢时裙前倾"腿把裙撑开"）                                  |
| 裙摆收窄              | gapBottom 0.19/0.22→**0.13** + 裙轴 z+0.02 前移 → rBottom 0.247/0.277→**0.187**（全宽减 1/3；Run 逐帧余量 0.014/0.009）                    |
| 圆台化（修腿刺穿）    | rTop 0.077→**0.157**（=腿r+0.10，包裹骨盆半宽 0.15）——旧圆锥骨盆下方刺穿带 -0.048；锥面斜率 ~10°→~5°                                        |
| wrapMax 排除裙        | 裙(Cylinder/EllipFrustum)不参与 wrapMax（圆形外层自包裹骨盆；混入会把骨盆撑成 0.354 方板反捅穿裙壁）→ student_f 骨盆恢复原深 0.147          |
| EllipFrustum 新几何   | 顶椭圆 **rx0.157×rz0.105**（zRatio 0.67 贴合躯干厚度）底面保持圆 0.187——正面腰部圆弧凸出 0.084→**0.032**(-62%)，背面藏进衬衫下摆；两侧 mk 同步 |
| 学生裙缩短            | 0.32→**0.295**（裙底 -0.1725 = 膝上 0.0498）；教师不动（膝上 0.068）                                                                        |
| 角刺出钳制            | `SKIRT_PELVIS_TD=0.14`（骨盆顶深，隐形内部件零代价）+ `SKIRT_TLOWER_BD=0.14/BZ=-0.01`（衬衫盒底面，旧后角距轴 0.215 刺出 8cm→0.033）        |
| 验证脚本              | `artifacts/verify_skirt_space.js`（数据层 26：椭圆壁全高扫描/膝上5cm/角刺出量化）+ `verify_skirt_runtime.js`（Playwright 14）+ 回归 30        |

### 红领巾贴颈+袖子稍粗+红袖口归位 (v0.79.33)

| 项             | 值/说明                                                                                              |
| -------------- | ------------------------------------------------------------------------------------------------------ |
| 红领巾悬空根因 | red_scarf Group position z=**0.1 旧树遗留值**（旧颈 r0.12 时代贴颈），新骨架颈仅 r 0.04 → 整体悬在颈前 0.1。改 Group z→0.008/结心 0.043（球 r0.03 与颈相交 0.027）/飘带后缘 0.043——实测结后缘 0.091 < 颈前 0.131 |
| 袖子稍粗       | 4 个袖子 WRAP gap 0.008→**0.004**（数据层袖比臂每侧粗 0.004；实测含手臂 rest 旋转 bbox 噪声）              |
| 红袖口归位     | polo_cuff 旧挂 `l_forearm` position -0.18（旧长袖设计）渲染落手腕 → 改挂**上臂末端** -0.07（渲染 y=0.13=短袖底）——实测 cuff 中心 0.820 ≈ 短袖底 0.807+半高 |
| 验证脚本       | `artifacts/verify_v7933.js`（6：贴颈/袖粗×2/cuff 位置×2）+ 回归 38                                         |
