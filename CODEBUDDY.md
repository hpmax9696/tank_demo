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

## 关键参数

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

## 常见修复模式

**添加新粒子效果**: 在 `fireSmokeParticles.js` 中创建新类，使用 `THREE.Points` + `BufferGeometry`，在 `index.html` 中实例化并调用 `update(dt)`。

**添加新障碍物**: 在对应模型文件中调用 `ModelRegistry.register()`，返回 `THREE.Group`。

**修改地形高度**: 编辑 `.map.json` 的 `terrain.heightMap` 数组，或修改 `getTerrainHeight()` 函数。

**添加新音效**: 在 `index.html` 的音频初始化部分使用 `AudioContext.createOscillator()` 生成。

## Git 操作

```bash
# 推送到两个远程仓库
git add -A
git commit -m "vX.Y.Z: 描述"
git push origin master    # Gitee
git push github master    # GitHub

# OneDrive 同步（含 CODEBUDDY.md 和 sky-panorama.png）
Copy-Item -Path "index.html","README.md","CODEBUDDY.md","three.min.js","GLTFLoader.js","fireSmokeParticles.js","zombie_prototype.html" -Destination "C:\Users\hpmax\OneDrive\共享软件\坦克对战demo\" -Force
Copy-Item -Path "maps\*" -Destination "C:\Users\hpmax\OneDrive\共享软件\坦克对战demo\maps\" -Recurse -Force
Copy-Item -Path "models\*" -Destination "C:\Users\hpmax\OneDrive\共享软件\坦克对战demo\models\" -Recurse -Force
Copy-Item -Path "combat\*" -Destination "C:\Users\hpmax\OneDrive\共享软件\坦克对战demo\combat\" -Recurse -Force
```

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
| 9 | 建筑/树木生成到河流中，道路横跨河流无桥梁 | ✅ v0.31.0 | isPointInWater()统一池塘+河流碰撞，detectAndBuildBridges()支持河流折线 |

---

## 📋 待完成任务（截至 v0.31.0 移交时）

| # | 任务 | 优先级 | 计划版本 | 详情 |
|---|------|:------:|----------|------|
| 1 | PvE Phase 5：清空积分UI按钮 + 局内HUD | 🔴 近期 | 未分配 | 局内显示HP/弹药/分数 + 菜单清空积分按钮 |
| 2 | 水体生成修复（硬编码参数→笔刷参数） | 🟡 中期 | v0.31.1 | map_editor.html 4处硬编码参数→brushRadius/brushStrength（河流碰撞部分已修复） |
| 3 | PvE Phase 6：精英单位 + Boss 炮舰 | 🔵 远期 | 未分配 | 导弹发射车/重型坦克/Boss多阶段战斗 |
| 4 | 树木 InstancedMesh 重构 | 🔵 远期 | 未分配 | draw calls 预计减少 60% |
| 5 | 战利品掉落扩展：弹药箱/经验值 | 🔵 远期 | 未分配 | 丰富战利品种类 |

---

## ⚔️ PvE 战斗系统方案（v0.26.5 战利品掉落+丧尸）

> **记录日期**: 2026-05-10 | **版本**: v0.26.5 | **状态**: Phase 1-4 基本完成，战利品掉落+丧尸模型就绪

### 一、需求总览

1. **地图绑定积分记录**：每张战斗地图维护单次最高分，含产生时间（首次刷纪录时间）和结算时间（最近一次刷新纪录时间）。
2. **清空积分功能**：Demo 内提供「清空积分记录」按钮；也可手动删除 localStorage 条目。
3. **累计总分**：多次游玩积分累加，独立文件存储，后期用于兑换升级道具。同样提供清空按钮和手动删除方式。
4. **渐进式实现**：先搭架构 → 创一种杂兵 → 模型预览通过 → 放入 03a 地图 → 战斗测试。

### 二、模块架构

```
combat/
├── scoreSystem.js     ← 积分系统（地图高分 + 累计总分 + localStorage 持久化）
└── enemyAI.js         ← AI 状态机（PATROL→CHASE→ENGAGE→FLEE→DEAD）

models/
└── enemies.js         ← 敌方单位 3D 模型（程序化生成，注册到 ModelRegistry）

maps/
└── test_map_03a.map.json  ← PvE 战斗地图（含 enemies 配置段）

index.html             ← 战斗主引擎（加载上述模块，gameMode 新增 'combat'）
```

**加载顺序**（已在 index.html 中添加）：
```html
<script src="models/enemies.js"></script>
<!-- PvE 战斗系统模块 -->
<script src="combat/scoreSystem.js"></script>
<script src="combat/enemyAI.js"></script>
```

### 三、积分系统设计（`combat/scoreSystem.js`）

| 存储 Key | 数据结构 | 说明 |
|----------|----------|------|
| `tank_demo_map_scores` | `{ "mapId": { highScore, createdAt, settledAt } }` | 每张地图的最高分记录 |
| `tank_demo_total_score` | `number`（字符串存储） | 跨地图累计总分 |

**全局接口** `window.ScoreSystem`：

| 方法 | 参数 | 返回值 | 说明 |
|------|------|--------|------|
| `getMapHighScore(mapId)` | 地图 ID | `{ highScore, createdAt, settledAt }` 或 `null` | 查询地图最高分 |
| `settleScore(mapId, score)` | 地图 ID + 本局得分 | `{ isNewHigh, highScore, totalScore }` | 结算：更新纪录 + 累加总分 |
| `getTotalScore()` | — | `number` | 获取累计总分 |
| `clearAllScores()` | — | — | 清空全部积分（地图分+累计分） |
| `clearMapScore(mapId)` | 地图 ID | — | 清空指定地图记录 |
| `clearTotalScore()` | — | — | 仅清空累计总分 |

**持久化方式**：`localStorage`（浏览器本地存储，关闭 demo 后保留，可手动在 F12 → Application → Local Storage 中删除）。

### 四、敌人类型规划

| 类型 | ID | 角色 | 武器 | 行为 | 状态 |
|------|-----|------|------|------|------|
| **装甲突击车** | `assault-vehicle` | 杂兵（近战） | V形铲斗冲撞 + 炮塔喷火器 | 巡逻→发现猛冲→近距喷火→绕圈再冲 | ✅ 模型已创建 |
| 导弹发射车 | `missile-launcher` | 杂兵（远程） | 导弹发射器 | 巡逻→远程锁定→发射导弹→转移 | 📋 待设计 |
| 重型坦克 | `heavy-tank` | 精英 | 大口径火炮 + 机枪 | 巡逻→正面对决→掩护射击 | 📋 待设计 |
| Boss 炮舰 | `gunship` | Boss | 多联装火炮 + 导弹 | 固定路径巡游→多阶段攻击 | 📋 待设计 |

### 五、AI 状态机（`combat/enemyAI.js`）

```
                    ┌─────────────────────────┐
                    │        PATROL           │  巡逻：沿路径点移动
                    │   (初始状态/丢失目标)    │
                    └─────┬──────────┬────────┘
                 发现玩家  │          │  丢失目标 >5s
                          ▼          ▼
                    ┌─────────┐  ┌─────────┐
                    │  CHASE  │  │  FLEE   │  HP<25% 触发逃跑
                    │ (追击)  │  │ (逃跑)  │
                    └───┬─────┘  └─────────┘
              进入射程 │  脱离射程
                       ▼
                    ┌─────────┐
                    │ ENGAGE  │  瞄准→开火→装填循环
                    │ (交战)  │
                    └────┬────┘
                    HP=0  │
                         ▼
                    ┌─────────┐
                    │  DEAD   │  移除模型 + 掉落 + 加分
                    └─────────┘
```

**视野检测**（`canSeeTarget` 函数）：
- 锥形视野（角度 + 距离上限）
- 前方方向点积检测
- Raycaster 障碍物遮挡（接口已预留，TODO）

**装甲突击车 AI 参数**（来自 `test_map_03a.map.json`）：

| 参数 | 值 | 说明 |
|------|-----|------|
| `hp` | 60 | 生命值 |
| `speed` | 5.0 | 移动速度（单位/秒） |
| `viewDist` | 50 | 视野距离 |
| `engageDist` | 15 | 交战距离 |
| `ramDamage` | 15 | 冲撞伤害 |
| `flameDamage` | 8 | 喷火伤害/跳 |
| `flameTicks` | 3 | 喷火跳数 |
| `flameRange` | 12 | 喷火射程 |
| `ramCooldown` | 3 | 冲撞冷却（秒） |
| `score` | 100 | 击杀得分 |
| `dropRate` | 0.25 | 掉落概率 |
| `dropHeal` | 30 | 掉落回血量 |

### 六、战斗地图配置（`test_map_03a.map.json`）

```json
{
  "type": "single",
  "mode": "combat",
  "players": {
    "lives": 3,
    "hp": 100,
    "cannonDamage": 40,
    "cannonReload": 2.5,
    "mgDamage": 5,
    "mgRange": 50,
    "mgFireRate": 3
  },
  "enemies": [
    { "id": "av-01", "type": "assault-vehicle", "position": [-25,0,22], ... },
    { "id": "av-02", "type": "assault-vehicle", "position": [30,0,28], ... }
  ]
}
```

**地图布局**：噪声地形 + 池塘 + 河流 + 桥梁 + 山丘 + 盆地 + 350 障碍物。

### 七、实现阶段

| 阶段 | 内容 | 状态 |
|------|------|------|
| **Phase 1** | 架构搭建（`enemies.js` + `scoreSystem.js` + `enemyAI.js` 骨架） | ✅ 完成 |
| **Phase 2** | 装甲突击车外形审批（菜单 → 模型预览 → 敌方单位 → 装甲突击车） | ✅ 通过 (v0.26.0) |
| **Phase 3** | 03a 地图部署1辆突击车 + AI PATROL/CHASE/ENGAGE + 被动反击 + 积分结算 | ✅ 完成 (v0.26.0) |
| **Phase 3.5** | 火焰伤害跳距模型修复 + 近防机枪系统 + 方向安全校验收紧 | ✅ 完成 (v0.26.3) |
| **Phase 3.6** | av-01/02 巡逻+地形俯仰+MG音效+仇恨共享 (4个PvE bug修复) | ✅ 完成 (v0.26.4) |
| **Phase 4** | 敌人HP伤害显示 + 击杀加分 + 掉落物品 + 玩家重生 | ✅ 完成 (v0.28.0) |
| **Phase 5** | 清空积分UI按钮 + 局内HUD（HP/弹药/分数） | 📋 待开始 |
| **Phase 6** | 精英单位 + Boss 炮舰 + 多阶段战斗 | 📋 远期 |

### 八、关键接口（index.html 集成时使用）

```javascript
// 创建敌人实例
const enemyModel = EnemyModels.createAssaultVehicle();
enemyModel.position.set(x, y, z);
enemyModel.cfg = mapEnemyConfig;  // 来自地图 JSON
enemyModel.ai = { state: 'patrol', patrolIndex: 0, ... };
scene.add(enemyModel);

// 游戏循环中更新 AI
EnemyAI.updateEnemyAI(enemy, dt, players, scene);

// 战斗结算
const result = ScoreSystem.settleScore('test_map_03a', finalScore);
if (result.isNewHigh) { /* 显示新纪录提示 */ }

// 获取积分
const highScore = ScoreSystem.getMapHighScore('test_map_03a');
const totalScore = ScoreSystem.getTotalScore();

// 清空积分（绑定 UI 按钮）
ScoreSystem.clearAllScores();
```

### 九、模型预览入口

菜单 → **模型预览** → **敌方单位** → **装甲突击车**

装甲突击车外观：低矮六轮装甲车，浅棕迷彩（#BFA470），车头 V 形铲斗冲撞角，炮塔顶部喷火器管，深色车轮+金属轮毂。

---

## ✅ 地图编辑器 v0.30.0 — 树状村落+水体重制

> **完成日期**: 2026-05-18 | **版本**: v0.30.0 | **状态**: 树状道路+村落系统 ✅ 完成

### 🗺️ 功能清单（6 阶段 — 全部完成）

| 阶段 | 内容 | 状态 |
|------|------|------|
| **Phase 1** | 基础架构：HTML布局(工具栏/侧面板/2D+3D视口)、Three.js地形预览(256段+透视相机)、高度图Canvas灰度显示 | ✅ 完成 |
| **Phase 2** | 高度编辑(提升/下陷/平滑笔刷)+SplatMap涂抹(6种纹理)+实时地面贴图合成(2048×2048 Canvas2D) | ✅ 完成 |
| **Phase 3** | 实体放置：出生点(旗帜+朝向)、障碍物(树/建筑各有3种)、敌人(突击车/丧尸+属性面板)、巡逻路径(连线+拖拽点) | ✅ 完成 |
| **Phase 4** | 地图JSON管理：MapSerializer(内存↔JSON)、CRUD(localStorage蓝图)、导出下载+导入上传、ParameterFitter(高度图→参数化地形拟合) | ✅ 完成 |
| **Phase 5** | 水体+桥梁放置、敌人行为配置面板(HP/速度/视野/攻击/行为模式/巡逻预览)、批量编辑(巡逻复制/清空) | ✅ 完成 |
| **Phase 6** | 撤销重做(UndoManager 50步+Ctrl+Z/Y)、主游戏集成(localStorage→地图列表)、离散高度图双线性插值、性能优化(30fps+笔刷批处理) | ✅ 完成 |
| **Phase 7** | 树状道路+村落系统：主路→村路→广场→建筑集群+连接小路（index.html+map_editor.html双端） | ✅ v0.30.0 |

### 🏘️ 道路+村落树状生成系统（v0.30.0 新增）

**双端实现**：
- `index.html`：运行时 `generateRoadVillageSystem()` → `createObstacles()` 集成
- `map_editor.html`：编辑器 `randomGenerateVillage()` 全流程重制

**生成顺序**：
1. 主路（横穿地图，柏油路，宽8.5m）
2. 垂直分支村路（2-4条，柏油路，宽4.5m）
3. 村路尽头 → 广场（地砖圆盘，半径可配置）
4. 广场周围 → 建筑集群（预计算位置，紧密聚集）
5. 建筑 → 广场连接小路（水泥路，宽1.5m）
6. 泊松采样填充树木（排除道路区域）
7. 绿化带（广场外圈恢复草地）

**关键函数**（index.html）：
- `generateRoadVillageSystem(spawnRadius)` — 返回 roadSegments + villages + roadAreas
- `isOnRoad(px, pz, roadAreas)` — OBB碰撞检测
- `createRoadMeshes(roadSegments, villages, scene)` — 渲染道路+广场+连接路
- `cleanupRoadMeshes()` — 清理道路网格

**关键函数**（map_editor.html）：
- `randomGenerateVillage()` — 全流程重制，使用 splatMap 绘制道路
- `drawRoadLine(x1,z1,x2,z2,width,texType)` — splatMap 道路绘制
- `drawCircleSplat(x,y,radius,texType)` — splatMap 圆形广场绘制

**新增模型注册函数**：
- `window.ModelRegistry.randomBuildingMaker()` — 仅从 buildings 分类选取（排除树木）

**调试支持**：两端均输出详细 console.log 生成日志（主路数量/村路数量/村庄数量/建筑数量/树木数量）

### 🔑 核心能力

- **map_editor.html**：~2700行独立文件，工具栏+侧面板+3D视口+高度图面板四区布局
- **数据流**：编辑器内存 → localStorage暂存 → 导出JSON → 放入maps/或主游戏直接加载(含离散高度图双线性插值)
- **主游戏入口**：地图选择列表自动显示 📝编辑地图，无需手动复制JSON
- **撤销栈内存**：50步 × ~320KB/步 ≈ 16MB，现代浏览器可接受

### ✅ v0.26.4 已修复

- **av-01巡逻启动**：`createEnemies`中初始朝向面向第一巡逻点 + `moveEnemyToward`添加NaN/dt防护
- **敌人地形俯仰**：游戏循环中 enemies 更新时计算前后1m高度差设置 `rotation.x`
- **MG音效频率**：`updateMGAutoTarget` 移出敌人循环，每帧只调用一次
- **仇恨共享**：`shareAggro` 函数，受击敌人40m半径内盟友同步切换CHASE

### ✅ v0.26.3 已修复

- **火焰伤害跳距模型**：视觉射程12→18u，传播速度14→28u/s，伤害判断统一为火焰前沿触达（已消耗跳数×4.2u≥玩家距离），修复第5跳丢失。
- **近防机枪**：自动检测35u内最近敌，持续射击含命中火花+音效，伤害+击杀判断统一。

### ✅ v0.26.0 已新增

- **PvE战斗系统**：装甲突击车模型(`models/enemies.js`)+AI状态机(`combat/enemyAI.js` PATROL→CHASE→ENGAGE被动反击)+积分系统(`combat/scoreSystem.js` localStorage)+03a战斗地图+index.html combat模式(敌人生成/HP血条/碰撞/火焰伤害/玩家重生/积分结算)
- **炮塔重构**：突击车炮塔独立 turretPivot Group，支持AI独立旋转瞄准

### ✅ v0.25.5 已改进

- **球形树重构**：25→50+椭球体，蓬松伞形树冠，模型预览菜单恢复3树种
- **阴影提升**：单人阴影范围 36m→72m（±18→±36），分辨率 512→1024；双人基础范围同步扩展

### ✅ v0.25.4 已修复

- **双人阴影缺失**：versusGameLoop添加阴影相机更新，跟随两玩家中点，按间距动态扩展
- **炮弹轨迹**（v0.25.3）：计入地形俯仰+5.7°基础仰角，平地射程~200u
- **坡面焦痕**（v0.25.2）：法线采样 d=0.5, polygonOffset -4/-4, 法线偏移 0.06

