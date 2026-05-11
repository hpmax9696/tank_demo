# CODEBUDDY.md

This file provides guidance to CodeBuddy when working with code in this repository.

## ⚠️ 每轮任务简报必须报告上下文用量（AI 必读）

完成每轮开发任务后，必须在最终回复末尾（预览/结果之后）报告当前对话的上下文使用情况，格式：

```
📊 上下文用量: ~XX.XK/500K tokens（约 XX%）| 余量: ~YY.YK
```

当余量 < 30K tokens 时主动提示用户："上下文即将耗尽，建议开启新对话继续开发。"

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

# OneDrive 同步
Copy-Item -Path "index.html","README.md","three.min.js","GLTFLoader.js","fireSmokeParticles.js" -Destination "C:\Users\hpmax\OneDrive\共享软件\坦克对战demo\" -Force
Copy-Item -Path "maps\*" -Destination "C:\Users\hpmax\OneDrive\共享软件\坦克对战demo\maps\" -Recurse -Force
Copy-Item -Path "models\*" -Destination "C:\Users\hpmax\OneDrive\共享软件\坦克对战demo\models\" -Recurse -Force
```

## 接力开发交接规范

### 交接前检查清单（开发完成时执行）

1. **代码已提交**: `git status` 显示 "nothing to commit, working tree clean"
2. **已推送到 Gitee**: `git push origin master` 成功（Gitee 是主仓库，家里电脑只同步 Gitee）
3. **OneDrive 已同步**: 所有文件已复制到 OneDrive 备份目录
4. **版本号已更新**: 确保所有 8 处版本号同步完成

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
| 1 | 里程恒为 0 | 🔴 需修复 | — |
| 2 | 坦克驶上桥梁不提升 | 🔴 需修复 | — |
| 3 | 河水效果不真实 | 🟡 改进项 | — |
| 4 | 草丛不显示（InstancedMesh 初始化时序） | 🟡 间歇性 | — |
| 5 | `.encoding` 废弃警告 | 🟢 可忽略 | — |

---

## 🔄 下一对话起手任务（v0.25.4 → v0.25.5）

当前版本 **v0.25.4**。

### 🟢 P0 计划任务: 树木 InstancedMesh 重构 + 精度提升

**目标**：将 ~245 棵树木从独立 Mesh（490 draw calls）迁移到 InstancedMesh（4 draw calls），释放性能后提高几何精度并新增橡树品种。

**方案概要**：
1. `trees.js` 重构：锥形树/球形树/橡树各输出共享 Geometry+Material，不再每棵 new Group/Mesh
2. `createObstacles()` 改为两阶段：采样时分类收集（coneList/sphereList/oakList/buildingPoints），采样后批量创建 InstancedMesh
3. 几何精度提升：树干 6→16段、锥形树冠 8→24段、球形树冠 8×6→20×14段
4. 新增橡树品种（椭球形树冠，注册权重≈20），总树种从2→3
5. 地图重建 `rebuildMap()` 中一行 `.dispose()` 清理

**预期收益**：draw calls 810→~322（-60%），树木精度提升5-10倍，性能余量 3ms→5-6ms

### 🔴 P1: 里程恒为 0

`totalDistance` 始终为 0，需要排查履带速度累加逻辑。

### 🔴 P2: 坦克驶上桥梁不提升

桥梁地形高度未正确返回，坦克穿过桥面。

### 🟡 P3: 河水效果不真实

河流渲染效果提升。

### 📊 当前性能基线

| 指标 | 值 |
|------|-----|
| FPS | 60 |
| 渲染耗时 | ~13.45ms |
| 帧预算余量 | ~3.2ms |
| 阴影 | PCFShadowMap, 512px, 36×36（双人动态扩展到两玩家中点） |

### ✅ v0.25.4 已修复

- **双人阴影缺失**：versusGameLoop添加阴影相机更新，跟随两玩家中点，按间距动态扩展
- **炮弹轨迹**（v0.25.3）：计入地形俯仰+5.7°基础仰角，平地射程~200u
- **坡面焦痕**（v0.25.2）：法线采样 d=0.5, polygonOffset -4/-4, 法线偏移 0.06

