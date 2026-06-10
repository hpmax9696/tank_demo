# CODEBUDDY.md

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

### 游戏引擎（模块化拆分后）

项目已从单一 `index.html` 拆分为多个独立模块：

| 文件 | 行数 | 功能 |
|------|:----:|------|
| `index.html` | ~5094 | 核心游戏引擎（状态机/场景/物理/瞄准/摄像机/训练场UI） |
| `waters.js` | ~317 | 水体系统（池塘水面+河流alphaMap遮罩平面+碰撞体+动画） |
| `bridges.js` | ~177 | 桥梁系统（编辑器桥+参数化桥+碰撞检测+虚空过滤） |
| `debugcolliders.js` | ~120 | 碰撞体可视化（F3切换，从运行时数据反向生成红环/蓝板/红条） |
| `audio.js` | ~223 | 音频系统（引擎声/开火/爆炸/命中/换弹音效） |
| `input.js` | ~71 | 输入处理（WASD驾驶+手柄5段力度+倒车转向修正） |
| `shells.js` | ~267 | 炮弹系统（发射/爆炸/溅射伤害/HE冲击波） |
| `mg.js` | ~180 | 机枪系统（自动锁敌/弹道/过热） |
| `bars.js` | ~75 | UI元素（血条/装填条/HUD） |
| `obstacles.js` | ~794 | 环境对象（树木/建筑/InstancedMesh管理） |

### 地图编辑器（v0.49.0 模块拆分后）

`map_editor.html` 已从 ~5167 行拆分为 1 主文件 + 5 模块：

| 文件 | 行数 | 功能 |
|------|:----:|------|
| `map_editor.html` | ~1762 | 核心框架（尺寸/撤销/事件绑定/3D场景/地面） |
| `js/editor_terrainGen.js` | ~1376 | 地形生成（FBM噪声+A*寻路+主干道+村路+村落建筑集群+树木填充+平整） |
| `js/editor_entities.js` | ~638 | 实体管理（出生点/树/建筑/敌人标记+CRUD+配置面板+实体列表+分组+巡逻线） |
| `js/editor_waterBridge.js` | ~659 | 水体桥梁（水体记录+水面3D+河床雕刻+桥梁创建+桥梁检测+道路清理） |
| `js/editor_data.js` | ~503 | 数据持久化（蓝图CRUD+JSON导入导出+base64编解码+init/animate） |
| `js/editor_terrainPaint.js` | ~335 | 地形绘制（纹理合成+高度图画布+5种笔刷+相机控制） |

### 游戏引擎（index.html）

`index.html` 是核心游戏引擎，约 5365 行，采用以下模块化结构：

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
`model_factory.html` 是通用程序化模型编辑器，~1922行，用于可视化设计坦克/建筑/敌人等游戏实体的程序化模型：

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

## 关键参数（v0.44.0 — 灵活地图尺寸 + 矩形地图支持）

| 参数 | 值 | 位置 |
|------|-----|------|
| 世界大小 | 可配置（默认300×300, 空气墙200×200） | `map_editor.html` worldWidth/worldDepth/playWidth/playDepth + `.map.json` |
| 障碍物数量 | 350 | `OBSTACLE_COUNT` |
| 障碍物可见半径 | 55 单位 | `OBS_RADIUS` |
| 坦克最高速度 | 4.0 单位/秒 | `MAX_SPEED` |
| 炮弹初速 | 33.0 单位/秒 | `SHELL_SPEED` |
| 炮弹重力 | 1.0 单位/秒² | `SHELL_GRAVITY` |
| 装填时间 | 2.0 秒 | `RELOAD_TIME` |
| 炮塔旋转速度 | ~30°/s (0.5236 rad/s) | `turretAngVel` |
| 炮管俯仰速度 | ~20°/s (0.3491 rad/s) | `barrelAngVel` |
| 炮管俯仰范围 | -10° ~ +25° | `maxUp`/`maxDown` |
| 准星有效射程 | 150 单位 | `updateAiming()` |
| 准星判定 | 四阶段（障碍物射线→抛物线地形采样→shellR 0.18m体积→目标跳回） | — |
| 弹道预测线 | 全模式启用 + 抛物线 + 地形截断 + shellR边缘 + 敌人 + 丧尸 | — |
| 手柄模式 | 粘滞切换（WASD/鼠标才回键鼠）+ 双轴映射(axes[2/4]=X, [3/5]=Y) | — |
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
| 地图编辑器 | `map_editor.html` ~2900行 | 7阶段完成：地形+纹理+实体+JSON+水体+桥梁+撤销+主游戏集成+**灵活尺寸** |
| 编辑器世界 | worldWidth×worldDepth (playWidth×playDepth) | 独立X/Z尺寸，支持任意矩形；`WORLD_SIZE/PLAY_SIZE` 已废弃 |
| 高度图精度 | 256×256 Float32Array | HM_RES |
| 纹理预览 | 2048×2048 Canvas2D | TEX_RES |
| UndoManager | 50步快照栈，~320KB/步 | `pushSnapshot()`/`undo()`/`redo()` |
| 编辑器限帧 | 30fps | `animate()` FRAME_MS=1000/30 |
| 蓝图存储 | localStorage `tank_map_editor_blueprints` | CRUD + 导入/导出 JSON |
| 编辑器→主游戏 | `convertBlueprintToMapConfig()` | 离散高度图双线性插值 + `loadMapConfig()` 动态注入 |
| 模型工厂光照(v1.6) | 5灯栈 | Ambient(0.8)+Hemisphere(0.3)+Dir主(2.0)+左补(0.3)+后补(0.4) |
| TaperedBox flatShading | DoubleSide 兜底 | flatShading时自动启用，防止侧面黑面 |
| emissive自发光 | dark_steel 0.30 / barrel_steel 0.20 / rubber 0.25 | 暗部保留轮廓 |
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
| TrackChain 负重轮半径 | wheelR=0.40 | `model_factory.html` T34_85_V16_CONFIG |
| TrackChain 主动轮/诱导轮Y | cyF=0.58, cyR=0.50 | `model_factory.html` T34_85_V16_CONFIG |
| 负重轮zR1~zR5坐标(Z轴) | 1.40, 0.39, -0.74, -1.64, -2.55 | `model_factory.html` T34_85_V16_CONFIG |
| 模型工厂视图 | 透视视图相机pos [5.0,3.5,6.0] | `model_factory.html` |
| 固化脚本 | `固化.ps1` — 一行命令 JSON→源码 替换 | 项目根目录 |
| 六足腿结构 | 4DOF: legGroup.Y+thigh.X+shin.X+ankle.X，三节腿(大腿L1≈0.7+小腿L2≈0.55)+尖刺足(h=0.28) | `models/hexapod_config.js` |
| 六足尖刺足 | Cylinder(rTop=0.055, rBottom≈0, h=0.28), 锥尖单点接地，内勾11°，踝球r=0.05 | `models/hexapod_config.js` |
| 六足IK测试 | 3模式(Y下蹲/X左右/Z前后)×3腿型(前/中/后)，CCD 3关节+踝锁死，锥尖靶点固定 | `js/hexapod_anim.js` |
| 六足动画 | **23个** (21步态+踉跄+死亡), stride/stepH数组驱动, 步态周期|ω|钳位公式 | `js/hexapod_anim.js` |
| 六足转弯系统 | direction+turnRate正交, CCD damp=0.8/0.5, _initFootDist固定脚距防漂移 | `js/hexapod_anim.js` |
| 六足武器限位 | 加特林[-17°,+20°], 导弹[-60°,+30°] | `model_factory.html` `hexapod_anim.js` |
| 六足髋Y限位 | 中腿±0.7rad, 前后腿±0.45rad | `hexapod_anim.js` `_ccdLeg` |
| 训练场模式 | 敌我T-34坦克对战+配置面板+无限重生 | `index.html` `js/engine.js` |
| 六足城市迷彩 | 亮灰底色+深浅灰斑纹, 观瞄保留纯色 | `enemies.js` |
| 地形坡度适应 | 装甲突击车俯仰+侧倾, 六足独立管理(hexapod_anim) | `engine.js` `hexapod_anim.js` |
| 转弯验证 | toggleHexTurnTest: 极慢0.3rad/s旋转, 三角步态, bodyC/plantPos/swingTarget可视化 | `js/hexapod_anim.js` |
| 受击踉跄 | triggerHexStagger(dir,force): 4阶段CCD驱动, 反方向腿跺地, 身体倾斜 | `js/hexapod_anim.js` |
| 死亡瘫倒 | triggerHexDeath(): 昂首→瘫软→触地, damp 0.85→0.03, 6腿各异伸展 | `js/hexapod_anim.js` |
| 武器校准 | toggleWeaponCalibrate: 双滑块控制俯仰, 瞄准线OK, 旋转有bug | `js/hexapod_anim.js` |
| 导出JSON固化按钮 | 一键下载完整嵌套配置JSON | `model_factory.html` |

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

| # | 问题 | 影响 | 位置 |
|---|------|------|------|
| 1 | 模型工厂撤销一键回到初始状态 | Ctrl+Z一次性回到初始而非逐步回退 | model_factory.html |
| 2 | 桥梁两端地形高低差 | 编辑器addBridge引道雕刻不完善，坦克上桥有阻 | map_editor.html→addBridge |
| 3 | 编辑器虚空拖拽偶发贴边河段/路段 | 鼠标在边界外拖拽时，CatmullRom插值+钳制产生贴边冗余段 | map_editor.html→mousemove钳制逻辑 |
| 4 | 手柄摇杆换向偶发延迟 | 摇杆快速穿中+实际速度判定edge case | input.js + index.html 驱动逻辑 |
| 5 | **800×800大地图生成耗时~54s** | ✅ v0.51.0 FBM降采样+bilinear插值，实测800m~15s | editor_terrainGen.js |
| 6 | **密度参数缩放不当** | ✅ v0.51.0 sqrt非线性缩放替代线性 | editor_terrainGen.js |
| 6b | 山区村落 | ✅ v0.51.0 flatScore<0.35硬门槛+权重0.6 | editor_terrainGen.js→_tryPlanVillage |
| 6c | 村落跨道路 | ✅ v0.51.0 plazaR+roadW/2+5m安全距离 | editor_terrainGen.js→_tryPlanVillage |
| 6d | 纹理92%泥地 | ✅ v0.51.0 moistRaw归一化修正 | editor_terrainGen.js |
| 6e | **六足转弯动画拖行** | v0.54已修复: 步态周期由turnRate推导+_initFootDist固定脚距 | `js/hexapod_anim.js` |
| 6f | **武器俯仰校准旋转bug** | ✅ v0.55.1 world→local坐标转换修复，武器不再飞移 | `js/hexapod_anim.js` |
| 6g | **六足转弯反曲膝** | ✅ v0.55.1 shin关节零点夹紧+plantPos同步修复 | `js/hexapod_anim.js` |
| 6h | **尖刺足陷入地面** | ✅ v0.55.1 updateMatrixWorld修复bbox计算 | `js/engine.js` `enemies.js` |
| 7 | CDP测试标签页回收不可靠 | ✅ v0.50.1 cdp_verify.py 直接杀 Chrome 进程替代 /json/close，100% 可靠 | cdp_verify.py |
| 8 | 编辑器河流弯道处水面透明叠加变暗 | ✅ v0.48.0 alphaMap遮罩平面方案彻底解决 | waters.js→createRiverWater |
| 9 | 池塘碰撞体对敌人不生效 | ✅ v0.49.0 checkCollision()增加池塘椭圆边界推离 | index.html→checkCollision |

## 已修复问题（v0.51.0 — 双管线村落生成系统+CDP自动验证）

| # | 修复内容 | 版本 |
|---|------|------|
| 1 | 村落生成全面重写：双管线+掩码网格+FloodFill+容量预验证+建筑簇+朝向+连接路 | v0.51.0 |
| 2 | 自动平整保峰压谷：管线A内建，确保可建面积≥60% | v0.51.0 |
| 3 | 建筑不再全朝北：面朝最近道路段(atan2计算yaw) | v0.51.0 |
| 4 | 支路连接主路：截断到主路边距避免覆盖柏油纹理 | v0.51.0 |
| 5 | 生成状态面板：实时进度+统计+评分+失败原因+30s自动隐藏 | v0.51.0 |
| 6 | 确定性随机：Mulberry32 PRNG，相同种子→相同地图 | v0.51.0 |
| 7 | 编辑器模块增至6个：+editor_genStatus.js | v0.51.0 |
| 8 | CDP自动验证：真实Chrome控制台0错误通过 | v0.50.0 |

## 已修复问题（v0.51.0 — 性能优化+CDP验证+村落修复）

| # | 修复内容 | 版本 |
|---|------|------|
| 1 | FBM降采样优化：>400m半分辨率+bilinear插值，800m从54s→~15s | v0.51.0 |
| 2 | 密度参数sqrt非线性缩放：池塘36→5，村落适配面积 | v0.51.0 |
| 3 | 多轮选址：3轮递进搜索+自适应间距(40-80m)+回避已有plaza | v0.51.0 |
| 4 | 平坦度硬门槛：flatScore<0.35排除+权重0.5→0.6，防山区建村 | v0.51.0 |
| 5 | 广场安全距离：plazaR+roadW/2+5m，防穿越主路 | v0.51.0 |
| 6 | moistRaw纹理修复：归一化*1.5-0.5+moist*0.5，泥地92%→草地70% | v0.51.0 |
| 7 | CDP自动验证脚本：cdp_verify.py(379行)+进程级清理+误报过滤+全局可用 | v0.51.0 |
| 8 | 状态面板修复：删除硬编码重复panel+setProperty('important')+window暴露 | v0.51.0 |
| 9 | 村落间距放宽：固定80m→自适应min(80,maxDim*0.1)，大区域多村 | v0.51.0 |

## 已修复问题（v0.49.0 — 编辑器模块拆分+池塘碰撞修复+自动验证）

| # | 修复内容 | 版本 |
|---|------|------|
| 1 | 池塘碰撞体对敌人失效修复：checkCollision()增加椭圆边界推离，池塘与河流行为一致 | v0.49.0 |
| 2 | map_editor.html 拆分为5模块（5167→1762行，-66%） | v0.49.0 |
| 3 | 新规则：模块优先架构（新功能优先独立JS模块） | v0.49.0 |
| 4 | 新规则：Chrome headless CDP自动验证（改代码→抓错误→修复→循环） | v0.49.0 |

## 已修复问题（v0.48.0 — 河面AlphaMap+主路A*寻路+修复）

| # | 修复内容 | 版本 |
|---|------|------|
| 1 | 河面alphaMap遮罩平面替换strip（Canvas绘河→alphaMap裁切，弯道零自交） | v0.48.0 |
| 2 | 主路A*寻路（指数坡度惩罚+加权启发×0.7+StringPulling平滑） | v0.48.0 |
| 3 | 村路/广场切splatMap贴图（移除3D strip） | v0.48.0 |
| 4 | 建筑群半圆约束（分支前进方向±90°，不跨主路） | v0.48.0 |
| 5 | 蓝图base64解码修复（demo端补heightmapB64/splatMapB64→terrain.heightmap） | v0.48.0 |
| 6 | 死亡UI隐藏+输入切断，重生恢复；战败画面"重新开始"按钮 | v0.48.0 |
| 7 | F4上帝视角（关雾+FOV80°+拉远+围挡墙隐藏，退出自动重置） | v0.48.0 |
| 8 | F3碰撞可视化默认关闭 | v0.48.0 |
| 9 | P7死代码清理（waters.js~75行+index.html~20行+obstacles.js清理） | v0.48.0 |

## 已修复问题（v0.46.0 — 模块拆分+水面ShapeGeometry+编辑器裁剪+手柄优化）

| # | 修复内容 | 版本 |
|---|------|------|
| 1 | waters.js+bridges.js+debugcolliders.js 模块拆分完成（index.html 5554→5094行） | v0.46.0 |
| 2 | 编辑器桥梁lx/lz轴互换bug修复（纵向/横向检测颠倒，致桥面碰撞全错） | v0.46.0 |
| 3 | 老格式桥梁（01a）isOnBridge无限Z轴延伸修复 | v0.46.0 |
| 4 | getGroundHeight→getBridgeSurfaceY桥梁实际高度支持（修复编辑器桥坦克穿透） | v0.46.0 |
| 5 | 参数化河流碰撞体缺失修复（单人模式坦克驶入河中） | v0.46.0 |
| 6 | 编辑器河面弯道effHw公式修复（cos(dAng/2)替代无效min(1,1/cos)） | v0.46.0 |
| 7 | 编辑器河面改用ShapeGeometry三角化（earcut），消除条带自交 | v0.46.0 |
| 8 | 编辑器虚空拖拽路径裁剪（钳制边界+间距去重+虚空桥过滤） | v0.46.0 |
| 9 | 手柄倒车转向反转改用实际速度判定（消除摇杆微小Y值误触发） | v0.46.0 |
| 10 | 手柄stickToTarget力度从3段→5段（0.25/0.5/0.75/1.0） | v0.46.0 |
| 11 | 摇杆换向dirFlip检测（prevTarget非零时才更新，消除穿中帧误判） | v0.46.0 |
| 12 | 履带参数TRACK_ACCEL/COAST随MAX_SPEED翻倍同步调整 | v0.46.0 |
| 13 | F3碰撞体可视化（从riverColliders[]和currentMapData.bridges实时生成） | v0.46.0 |

## 已修复问题（v0.45.0 — 水体/桥梁/出生点数据对接修复）

| # | 修复内容 | 版本 |
|---|------|------|
| 1 | 编辑器-游戏Float32Array序列化对接（saveBlueprints TypedArray replacer） | v0.45.0 |
| 2 | 编辑器exportMapJson始终含heightmap+河流+桥端点（不再被features吞掉） | v0.45.0 |
| 3 | 矩形地图纹理坐标修复（generateSplatMap/CompositeGroundTexture独立halfX/halfZ） | v0.45.0 |
| 4 | 多河流支持（convertBlueprintToMapConfig→terrainExtra.rivers数组） | v0.45.0 |
| 5 | 河流交叉水面统一（取最低水位）+ 河床基准排除已挖水体 | v0.45.0 |
| 6 | 游戏端水面弯曲平滑（2-pass移动平均+40°阈值） | v0.45.0 |
| 7 | 水面NaN防护（Float32Array→JSON序列化waterLevels.length丢失） | v0.45.0 |
| 8 | 重复河面消除（buildScene去水+创建时机统一+参数化代码穿透修复） | v0.45.0 |
| 9 | 桥面渲染重写（编辑器中桥定向+deckY高度+游戏端isOnBridge支持任意朝向） | v0.45.0 |
| 10 | 桥头空气墙修复（桥面区域跳过riverColliders+护栏方向修正） | v0.45.0 |
| 11 | 坦克出生点修复（4处硬编码→读取spawnPoints.p1+编辑器出生点唯一性） | v0.45.0 |
| 12 | 出生点避水（原点在水中→螺旋搜索干地） | v0.45.0 |
| 13 | 坦克速度翻倍（MAX_SPEED 4→8 m/s） | v0.45.0 |
| 14 | 池塘水面数据完整性校验（cx/rx不为null才创建） | v0.45.0 |
| 15 | 弯道缩窄公式修复（effHw = hw*cos(dAng/2)替代无效的min(1,1/cos)） | v0.45.0 |
| 16 | 河岸钳制多距离采样（effHw+2/+4/+6替代effHw+1，避免被河道过渡区污染） | v0.45.0 |
| 17 | 村落重复生成桥恢复后立即createGround | v0.45.0 |
| 18 | isPointInWater河流半宽从硬编码4→(w.width||40)*0.5 | v0.45.0 |
| 19 | 编辑器桥deckY存储到蓝图 | v0.45.0 |
| 20 | maploader.js模块拆分（~190行，loadMapConfig+convertBlueprint+loadMapsFromDirectory） | v0.45.0 |

## 已修复问题（v0.44.0 — 地图拆分+桥梁修复+编辑器增强）

| # | 修复内容 | 版本 |
|---|------|------|
| 1 | 地图数据从index.html拆分到maps/目录动态加载（_index.json manifest） | v0.44.0 |
| 2 | 桥梁引道重写：平整区+内陆斜坡+_carvedCells可撤销，修复重复生成凹坑 | v0.44.0 |
| 3 | 蓝色纹理修复：桥梁雕琢不移入editedVerticesPaint，避免vertexColors水体蓝染 | v0.44.0 |
| 4 | 河流生成重构：水面=河岸最低-3m，河床=地图最低-10m，自动计算 | v0.44.0 |
| 5 | 编辑器蓝图加载尺寸变量同步（worldHalfW/D, playHalfW/D等） | v0.44.0 |
| 6 | 弹道预测线重建修复（rebuildMapAsync清理trajLine/trajDot） | v0.44.0 |
| 7 | 多段河流穿越detectAndBuildBridges改为进入/退出状态机 | v0.44.0 |
| 8 | 小地图村落规模自适应（scaleF缩放+广场位置动态调整） | v0.44.0 |
| 9 | WORLD_SIZE/WORLD_HALF残余清理（~25处改为独立X/Z尺寸） | v0.44.0 |
| 10 | 编辑器3D视口Ctrl多选+Shift框选+Delete删除+实体列表排序分色 | v0.44.0 |
| 11 | 随机生成面板从弹窗移到右侧面板 | v0.44.0 |
| 12 | 树木InstancedMesh加入obstacleMeshes | v0.39.1 |

| # | 修复内容 | 版本 |
|---|------|------|
| 1 | 树木InstancedMesh加入obstacleMeshes — 射线/瞄准/遮挡全部检测树木 | v0.39.1 |
| 2 | Poisson采样恢复随机建筑分配（锥形35%/球形30%/橡树20%/建筑15%） | v0.39.1 |
| 3 | rotation.order = 'YXZ' — 地形俯仰在坦克自身坐标系中生效 | v0.39.1 |
| 4 | 瞄准逻辑重写：世界方向→坦克本地四元数逆变换（正确处理pitch+roll+yaw） | v0.39.1 |
| 5 | 准星四阶段判定：障碍物射线→地形高度采样→shellR体积容差→目标跳回 | v0.39.1 |
| 6 | 弹道预测线：全模式启用（键鼠+手柄）+ 地形碰撞 + 障碍物shellR边缘 + 敌人截断 | v0.39.1 |
| 7 | 手柄双轴映射（axes[2,4]=X, axes[3,5]=Y）+ 粘滞切换（不回退鼠标） | v0.39.1 |
| 8 | 快速点击不放炮修复 — mouseFireRequested锁存 | v0.39.1 |
| 9 | updateMatrixWorld() 在rotation设置后立即调用 | v0.39.1 |


---

## 📋 待完成任务（截至 v0.51.0）

| # | 任务 | 优先级 | 计划版本 | 详情 |
|---|------|:------:|----------|------|
| 1 | **六足战车动画系统** | 🟢 基本完成 | v0.55.1 | 23动画可用, 踉跄+死亡就绪, 武器校准/反曲/贴地修复 |
| 2 | PvE Phase 5：清空积分UI按钮 + 局内HUD | 🔴 近期 | 未分配 | 局内显示HP/弹药/分数 + 菜单清空积分按钮 |
| 4 | 编辑器虚空拖拽贴边河段修复 | 🟡 近期 | 未分配 | CatmullRom插值+钳制偶发贴边段，需更稳健的裁剪方案 |
| 5 | 同轴机枪功能 | 🟡 中期 | 未分配 | Space键 + 手柄LT 预留，与近防机枪共用MG_*参数 |
| 6 | 状态面板在CDP生成时显示 | ✅ v0.51.0 删除硬编码重复panel+setProperty('important') | editor_genStatus.js + map_editor.html |
| 7 | CDP标签页回收 | ✅ v0.51.0 cdp_verify.py进程级清理替代/json/close，100%可靠 | cdp_verify.py |
| 8 | PvE Phase 6：精英单位 + Boss 炮舰 | 🔵 远期 | 未分配 | 导弹发射车/重型坦克/Boss多阶段战斗 |
| 9 | 树木 InstancedMesh 重构 | 🔵 远期 | 未分配 | draw calls 预计减少 60% |
| 10 | 村落间距检查放宽 | ✅ v0.51.0 自适应间距min(80,maxDim*0.1)+多轮选址 | editor_terrainGen.js |

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





