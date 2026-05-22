# CODEBUDDY.md

This file provides guidance to CodeBuddy when working with code in this repository.

## ⚠️ 每轮任务简报必须报告上下文用量（AI 必读）

完成每轮开发任务后，必须在最终回复末尾（预览/结果之后）报告当前对话的上下文使用情况，格式：

```
📊 上下文用量: ~XX.XK/500K tokens（约 XX%）| 余量: ~YY.YK
```

当余量 < 50K tokens 时主动提示用户："上下文即将耗尽，建议开启新对话继续开发。"

**目的**：让用户知晓何时需要切换新对话，避免长对话导致 token 耗尽丢失上下文。

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

## 核心架构

### 游戏引擎（index.html）

`index.html` 是核心游戏引擎，约 3700+ 行，采用以下模块化结构：

```
├── 状态机: gameMode = 'menu' | 'single' | 'versus'
├── 玩家工厂: createPlayer() — 创建坦克实例
├── 场景初始化: initScene() — 渲染器/光照/雾/地面/坦克/障碍物
├── 天空系统: 已移除（v0.24.5，陡视角不可见，节省性能）
├── 地面系统: createGround() — 分段地形 + 地貌纹理
├── 障碍物系统: createObstacles() — 泊松盘采样 + LOD 可见性
├── 物理系统: updatePlayerPhysics() — 差速驱动/碰撞/俯仰
├── 火炮系统: 炮弹(圆柱+锥体Group)/曳光弹/炮口焰/碎片/disposeShellMesh()
├── 游戏循环: gameLoop() / versusGameLoop()
├── 摄像机: 第三人称追尾视角 + 双人分屏 (far=300m)
└── 指向箭头: 透视投影 + behind 检测
```

### 模型工厂编辑器（model_factory.html）⭐ v0.36.1 新增

`model_factory.html` 是通用程序化模型编辑器，~1580行，用于可视化设计坦克/建筑/敌人等游戏实体的程序化模型：

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

**导出流程**: 模型工厂调参 → Ctrl+S保存 → 📋输出姿态JSON → 固化到 `models/tank_procedural.js` → index.html 集成

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

### 地图系统（maps/*.map.json）

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

### 音频系统

全部使用 Web Audio API 程序化生成，无需外部音频文件：
- 引擎声（随速度变化频率）
- 开炮/爆炸/命中音效

## 关键参数（v0.36.1 — 模型工厂通用程序化编辑器+台型车体+撤销+视图）

| 参数 | 值 | 位置 |
|------|-----|------|
| 世界大小 | 200×200 | `index.html` 常量 |
| 障碍物数量 | 350 | `OBSTACLE_COUNT` |
| 障碍物可见半径 | 55 单位 | `OBS_RADIUS` |
| 坦克最高速度 | 4.0 单位/秒 | `MAX_SPEED` |
| 炮弹初速 | 33.0 单位/秒 | `SHELL_SPEED` |
| 炮弹仰角 | `terrainPitch + player.pitch + recoilPitch + 0.10` rad | 发射代码（v0.25.3） |
| 炮弹重力 | 1.0 单位/秒² | `SHELL_GRAVITY` |
| 装填时间 | 2.0 秒 | `RELOAD_TIME` |
| 伤害值 | 20 HP | `SHELL_DAMAGE` |
| 殉爆半径 | 3.5 米 | `CHAIN_RADIUS` |
| 摄像机远截面 | 300 | `camera.far` |
| 雾色 | #8899aa (蓝灰) | `addLightingTo()` |
| 雾距 | near 70 / far 110 | `Fog` |
| 天空 | 已移除（v0.24.5，陡视角不可见） | — |
| 地面 | 300×300 | `createGround()` 地形 + 纹理混合 |
| 丧尸模型 | ZOMBIE_CONFIG 24节点 ~458 tris | `models/enemies.js` buildZombieFromConfig |
| 丧尸动画 | 6动作 (Idle/Hit/Attack/Walk/Run/Die) | AnimationSystem 手动插值，v0.28.1 支持3层LOD |
| 丧尸LOD | near<30m全帧/medium30~70m冻结骨架/far>70m圆柱占位 | index.html 5m滞后带 |
| 丧尸身高 | 1.0m | Box3 包围盒自动缩放 |
| 丧尸AI | 8状态机 (IDLE/PATROL/ALERT/PURSUIT/SEARCH/ATTACK/STAGGER/DEAD) | `combat/enemyAI.js` ZS 枚举 |
| 近防机枪 | 射速10发/秒 伤害2 射程25m 过热6s | `index.html` MG_* 常量 |
| 修理箱模型 | 程序化倒角红箱 ~2.5K tris | `models/pickups.js` makeToolboxProcedural |
| 03a地图 | 装甲突击车 ×2 | PvE 战斗地图 |
| 04a地图 | 程序化丧尸 ×30 | 5×6网格集群，2层仇恨连锁 |
| 地图编辑器 | `map_editor.html` ~2750行 | 6阶段完成：地形+纹理+实体+JSON+水体+桥梁+撤销+主游戏集成 |
| 编辑器世界 | 300×300 (空气墙200×200) | `map_editor.html` WORLD_SIZE/PLAY_SIZE |
| 高度图精度 | 256×256 Float32Array | HM_RES |
| 纹理预览 | 2048×2048 Canvas2D | TEX_RES |
| UndoManager | 50步快照栈，~320KB/步 | `pushSnapshot()`/`undo()`/`redo()` |
| 编辑器限帧 | 30fps | `animate()` FRAME_MS=1000/30 |
| 蓝图存储 | localStorage `tank_map_editor_blueprints` | CRUD + 导入/导出 JSON |
| 编辑器→主游戏 | `convertBlueprintToMapConfig()` | 离散高度图双线性插值 + `loadMapConfig()` 动态注入 |
| 水体走廊法 | 河床/湖底走廊法雕刻 + ease-out falloff | `carveRiverCorridor` / `carvePondBasin` (mouseup中) |
| 分段水面剖面 | 每段水面 = min(前段, 本地形-strength×0.3)，单调不增 | `segWaterLevels[]` + `waterLevels` 记录 |
| 网格单元水面 | 河流+湖泊统一用高度图网格四边形构建平坦水面 | `createWaterLayer()` cellSet → 每个单元格独立 surfaceLevel |
| 端点削波 | 路径起点/终点 hw 范围内深度线性归零 | `taper = min(startTaper, endTaper)` |
| 桥梁引道 | 桥两端 5m 范围地形渐变到桥面高度（挖方/填方） | `carveApproach()` 在 `addBridge()` 中 |
| 斜坡桥面 → 水平桥面 | 改回水平 BoxGeometry，引道用 BufferGeometry 斜坡面板 | `createBridgeMesh()` |
| 加载画面 | 黑色底+渐变色进度条+状态文字，全地图覆盖 | `showLoading()`/`updateLoadingProgress()`/`hideLoading()` |
| 编辑器地图对接 | splatMap纹理+waterLevel水位+riverColliders空气墙+巡逻分散 | `convertBlueprintToMapConfig()` + `createRiverWater()` |
| 敌人批量属性编辑 | 多选敌人时属性面板批量写入HP/速度/视野等 | `syncEnemyConfigPanel()` (map_editor.html) |
| 实体列表分类折叠 | 建筑/树木默认折叠，出生点/敌人展开 | `collapsedCategories` Set |

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

| 仓库 | 用途 | 状态 |
|------|------|------|
| Gitee (origin) | 主仓库，接力开发同步 | ✅ 活跃 |
| GitHub (github) | 备用镜像 | ✅ 同步 |
| OneDrive | 本地备份 + 测试运行 | ✅ 同步 |

**注意**: 家里电脑只需同步 Gitee（主仓库），GitHub 作为备用。

---

## 已知问题

| # | 问题 | 优先级 | 详情 |
|---|------|--------|------|
| 1 | GLB丧尸模型系统 | ✅ v0.27.0 | 已完成清理（~300行GLB代码已移除） |
| 2 | 丧尸程序化模型集成 | ✅ v0.27.0 | ZOMBIE_CONFIG+AnimationSystem已集成到enemies.js |
| 3 | ZombieAIController 8状态机实现 | ✅ v0.28.0 | IDLE/PATROL/ALERT/PURSUIT/SEARCH/ATTACK/STAGGER/DEAD 完成 |
| 4 | 04a地图部署5只新程序化丧尸 | ✅ v0.27.0 | zm-01~zm-05 已部署，v0.28.0 扩展至30只 |
| 5 | GLB修理箱172K tris过重 | ✅ v0.28.1 | 程序化倒角箱取代（~2.5K tris），pickups.js GLB代码已移除 |
| 6 | 丧尸贴图颜色过深 | ✅ v0.28.1 | 基底#8B9B7E→#A9B89E，全部层提亮 |
| 7 | 玩家机枪DPS太低（2×5=10） | ✅ v0.28.1 | 射速5→10发/秒，DPS 10→20，过热4→6s |
| 8 | 大量丧尸draw call压力 | ✅ v0.28.1 | 3层LOD: near全骨架/medium冻结/far圆柱占位，远区-62% draw calls |
| 9 | 河流生成功能性能灾难+河床不下陷+水面扭曲 | ✅ v0.32.0 | 性能优化(跳过几何体更新)+河床下切逻辑修复(targetH=原始地形-下切深度)+水面扭曲消除(矩形条带法) |
| 10 | 河流水面不可见/浮在河床上方/锐角折叠 | ✅ v0.32.1 | 法线绕序修正+水面水位公式(地表-下切×60%)+贝塞尔预平滑(subdivideSharpCorners)+5项编辑器bug修复 |
| 11 | 编辑器水体弯道重叠+河岸悬崖+端点深坑 | ✅ v0.32.2~v0.32.6 | 统一网格单元水面(无重叠)→走廊法(一致性)→ease-out falloff(宽缓河岸)→端点削波(渐变归零) |
| 12 | 起伏地形河流水面溢出河岸 | ✅ v0.33.0 | 分段水面剖面(单调不增, 每段≤本地形) |
| 13 | 桥梁倾斜/悬浮/撞悬崖 | ✅ v0.33.1 | 水平桥面+引道地形修整(挖方/填方) |
| 14 | 编辑器地图纹理全绿+splatMap丢失 | ✅ v0.34.0 | convertBlueprintToMapConfig传递splatMap+generateSplatMap优先使用 |
| 15 | 编辑器河流水面对齐河床 | ✅ v0.34.0 | 蓝图层传递waterLevel字段+createRiverWater优先使用 |
| 16 | 编辑器地图河流空气墙缺失 | ✅ v0.35.0 | 碰撞半径hw+1.5→hw+4+密度↑35+bridge不覆盖 |
| 17 | 多敌人同路线巡逻堵塞(17辆仅5辆移动) | ✅ v0.35.0 | 分散起始patrolIndex+距离缩小替代绝对位移卡住检测 |
| 18 | 编辑器河床/纹理/水面三线坐标偏移~19m | ✅ v0.35.0 | getTerrainHeight half 100→150与纹理300统一 |
| 19 | 编辑器树木不加载/聚集/位置错误 | ✅ v0.35.0 | editorTrees消费+InstancedMesh顺序修正+spawnR→150+falsy陷阱 |
| 20 | 池塘水面悬空（WATER_LEVEL常量覆盖） | ✅ v0.36.0 | 游戏循环每帧`waterPlane.position.y=WATER_LEVEL`硬编码覆盖，修复：userData.baseY存储实际水面高度 |
| 21 | 模型工厂撤销一键回到初始状态 | 🔴 v0.36.1 | saveUndo()内联快照虽能拍照，但Ctrl+Z一次性回到初始而非逐步回退，需排查deepRestore或snapshot含相同状态 |


---

## 📋 待完成任务（截至 v0.36.1 移交时）

| # | 任务 | 优先级 | 计划版本 | 详情 |
|---|------|:------:|----------|------|
| 1 | 模型工厂撤销修复：Ctrl+Z逐步回退 | 🔴 紧急 | v0.37.0 | saveUndo快照相同状态问题，需排查deepRestore引用或config写入路径 |
| 2 | PvE Phase 5：清空积分UI按钮 + 局内HUD | 🔴 近期 | 未分配 | 局内显示HP/弹药/分数 + 菜单清空积分按钮 |
| 3 | 坦克程序化模型固化 | 🟡 中期 | v0.37.0 | 模型工厂调优完成→导出JSON→固化到models/tank_procedural.js→集成index.html |
| 4 | PvE Phase 6：精英单位 + Boss 炮舰 | 🔵 远期 | 未分配 | 导弹发射车/重型坦克/Boss多阶段战斗 |
| 5 | 树木 InstancedMesh 重构 | 🔵 远期 | 未分配 | draw calls 预计减少 60% |

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
enemy.cfg = mapEnemyConfig; scene.add(enemy);
EnemyAI.updateEnemyAI(enemy, dt, players, scene);  // 每帧
ScoreSystem.settleScore('test_map_03a', finalScore); // 结算
```

**03a地图**：装甲突击车×2 | **04a地图**：程序化丧尸×30（5×6网格集群）

---

## ✅ 地图编辑器 `map_editor.html`（7 阶段 ✅ 全部完成）

| 阶段 | 内容 |
|------|------|
| **Phase 1-2** | HTML四区布局 + 高度笔刷(5种) + SplatMap纹理(6种) + 2048²地面贴图合成 |
| **Phase 3-4** | 实体放置(出生点/障碍物/敌人/巡逻路径) + 蓝图CRUD + JSON导出/导入 |
| **Phase 5-6** | 水体+桥梁 + 敌人配置面板 + UndoManager 50步 + 主游戏集成 |
| **Phase 7** | 树状道路+村落：主路→村路→广场→建筑集群+连接小路，双端(index.html+编辑器) |

**道路+村落生成**：`generateRoadVillageSystem()` → 7步管线（主路8.5m→分支村路→广场圆盘→建筑集群→连接小路→树木填充→绿化带）

**数据流**：编辑器内存 → localStorage蓝图表 → 导出JSON → `convertBlueprintToMapConfig()` → 主游戏离散高度图双线性插值加载





