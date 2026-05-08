# CODEBUDDY.md

This file provides guidance to CodeBuddy when working with code in this repository.

## 开发环境

**启动本地服务器**（必须，GLB 模型需要 HTTP 协议）:
```bash
python -m http.server 8081 --bind 127.0.0.1
# 或
python -m http.server 8080
```

**访问地址**: `http://127.0.0.1:8081`

**强制刷新**: `Ctrl+F5`（清除浏览器缓存）

**代码同步位置**: Gitee (origin) + GitHub (github) + OneDrive (`C:\Users\hpmax\OneDrive\共享软件\坦克对战demo\`)

## 版本号同步清单

每次更新必须同步以下 8 处版本号，否则调试信息与实际版本不一致：
1. `index.html` `<title>` 标签
2. `index.html` `.menu-version` 菜单显示
3. `index.html` `.changelog` 追加记录
4. `index.html` 调试信息版本号
5. `index.html` `console.log` 版本号
6. `README.md` 开头版本号
7. `README.md` 版本历史追加
8. `README.md` 代码规模注释

**Git 提交格式**: `git commit -m "vX.Y.Z: 描述"`

## 核心架构

### 游戏引擎（index.html）

`index.html` 是核心游戏引擎，约 3200 行，采用以下模块化结构：

```
├── 状态机: gameMode = 'menu' | 'single' | 'versus'
├── 玩家工厂: createPlayer() — 创建坦克实例
├── 场景初始化: initScene() — 渲染器/光照/地面/坦克/障碍物
├── 地面系统: createGround() — 分段地形 + 地貌纹理
├── 障碍物系统: createObstacles() — 泊松盘采样 + LOD 可见性
├── 物理系统: updatePlayerPhysics() — 差速驱动/碰撞/俯仰
├── 火炮系统: 炮弹/曳光弹/炮口焰/碎片
├── 游戏循环: gameLoop() / versusGameLoop()
├── 摄像机: 第三人称追尾视角 + 双人分屏
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
| 炮弹初速 | 22.0 单位/秒 | `BULLET_SPEED` |
| 炮弹上扬角 | 0.3 rad | 发射代码 |
| 装填时间 | 2.0 秒 | `RELOAD_TIME` |
| 伤害值 | 20 HP | `DAMAGE` |
| 殉爆半径 | 3.5 米 | `CHAIN_RADIUS` |

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

| # | 问题 | 优先级 |
|---|------|--------|
| 1 | 里程恒为 0 | 🔴 需修复 |
| 2 | 坦克驶上桥梁不提升 | 🔴 需修复 |
| 3 | 河水效果不真实 | 🟡 改进项 |
| 4 | `.encoding` 废弃警告 | 🟢 可忽略 |
