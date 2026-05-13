---
name: new-zombie-integration
overview: 将 zombie_prototype.html 的新程序化丧尸模型集成到主项目 enemies.js，清理旧坦克模型和 GLB 丧尸缓存系统，在 04a 地图部署 5 只新丧尸（共享几何/材质 + 独立 AnimationSystem 方案替代 InstancedMesh）。
todos:
  - id: cleanup-tank-registry
    content: 注销 models/tank.js 中 green 和 desert 两个原始坦克的 ModelRegistry 注册
    status: pending
  - id: rewrite-enemies-zombie
    content: 重写 models/enemies.js 丧尸部分：移植 ZOMBIE_CONFIG、createZombieMaterials、buildZombieFromConfig、AnimationSystem、createAnimationSystem、预览工厂 makeZombie，替换旧的 ~300 行丧尸代码
    status: pending
  - id: cleanup-glb-system
    content: 清理 index.html 中整个 GLB 丧尸加载系统（_zombieGlbCache、loadZombieGlb、cloneWithSkinnedMesh、spawnZombieFromGlb、zombieFallbackModel、initZombieAnimController、loadOrQueueZombieGlb），删除模型预览菜单 GLB 丧尸条目
    status: pending
    dependencies:
      - rewrite-enemies-zombie
  - id: adapt-game-loop
    content: 适配 index.html 游戏循环：createEnemies 简化丧尸创建分支为直接调用 createZombie + attach AnimationSystem；丧尸动画更新从 zombieMixer 替换为 animSystem.update(dt)；cleanupEnemies 移除 zombieMixer 清理
    status: pending
    dependencies:
      - cleanup-glb-system
  - id: adapt-enemy-ai
    content: 适配 combat/enemyAI.js：将 anim.play(name, crossfade) 接口替换为 animSystem.play(name, loop)，动画名小写转首字母大写，移除 AnimationMixer 依赖
    status: pending
    dependencies:
      - rewrite-enemies-zombie
  - id: update-map-04a
    content: 更新 maps/test_map_04a.map.json：新增 zm-03/zm-04/zm-05 三只丧尸配置（含独立巡逻路径和位置），总计 5 只
    status: pending
    dependencies:
      - rewrite-enemies-zombie
---

## 用户需求

### 一、清理旧模型

- 删除 `models/tank.js` 中注册的两个原始坦克（green/desert），这两个模型的注册条目不再需要
- 删除 `index.html` 模型预览菜单中 GLB 分类下的所有丧尸条目（zombie、zombie-multi）

### 二、清理 GLB 丧尸加载系统

`index.html` 中存在一套围绕 GLB 丧尸模型的加载/缓存/动画系统，约 300 行代码。由于技术路线已切换到程序化丧尸，需全部移除：

- `_zombieGlbCache` 全局缓存变量
- `loadZombieGlb()` 异步加载函数
- `cloneWithSkinnedMesh()` 蒙皮网格克隆函数
- `spawnZombieFromGlb()` GLB 模型实例化函数
- `zombieFallbackModel()` 程序化回退函数（调用旧的 makeZombie）
- `initZombieAnimController()` GLB 动画控制器初始化
- `loadOrQueueZombieGlb()` 按需加载/排队函数

### 三、集成新程序化丧尸模型

将 `zombie_prototype.html` 中的完整工具链移植到 `models/enemies.js`，替换旧的 `makeZombie()`：

- `ZOMBIE_CONFIG`：24 节点层级树配置（含 11 个关节 pivot）
- `createZombieMaterials()`：Canvas 2D 程序化贴图生成
- `buildZombieFromConfig()`：递归构建函数 + pivot 补偿算法
- `AnimationSystem` 类：手动插值动画系统
- `createAnimationSystem(root)`：工厂函数，注册 6 种动画（Idle/Hit/Attack/Walk/Run/Die）
- 预览工厂函数：适配 ModelRegistry 的 1.5x 缩放

### 四、适配动画接口

当前 enemyAI.js 使用 `anim.play(name, crossfadeSec)` 接口（GLB mixer 风格），需适配为新的 `AnimationSystem.play(name, loop)` 接口。同时 index.html 游戏循环中的丧尸动画更新逻辑需从 `zombieMixer.update()` 替换为 `animSystem.update(dt)`。

### 五、04a 地图部署 5 只丧尸

在现有 2 只丧尸（zm-01/zm-02）基础上新增 3 只（zm-03/zm-04/zm-05），分布在地图不同象限，每只配置独立的巡逻路径。

## 技术方案

### 一、整体架构

```
清理前 → 清理后
─────────────────────────────────────────────
tank.js: green + desert → 仅保留文件（不再注册）
index.html: GLB 加载系统(300行) → 全部移除
enemies.js: 旧 makeZombie(300行) → 新程序化丧尸(400行)
index.html: zombieMixer 动画更新 → animSystem.update(dt)
combat/enemyAI.js: anim.play(n, t) → asys.play(n, loop)
```

### 二、丧尸模型集成方案

#### 2.1 代码结构 (models/enemies.js)

```
enemies.js (修改后)
├── 装甲突击车（保留不变）
│   ├── createAssaultVehicle()
│   └── makeAssaultVehicle() 预览工厂
├── 新程序化丧尸
│   ├── ZOMBIE_CONFIG         层级树配置（24节点）
│   ├── createZombieMaterials()  Canvas 2D 贴图
│   ├── buildZombieFromConfig()  递归构建
│   ├── countTriangles()         面数统计
│   ├── class AnimationSystem    动画引擎
│   ├── createAnimationSystem()  6种动画工厂
│   └── makeZombie()            预览+游戏工厂
└── 全局导出 + 注册
    ├── window.EnemyModels = { createAssaultVehicle, createZombie, AnimationSystem }
    └── ModelRegistry.register('enemies', '丧尸', makeZombie)
```

#### 2.2 实例化策略

InstancedMesh 不适合丧尸的原因：

- 每只丧尸有独立的 AnimationSystem，直接操作骨骼节点的 position/rotation
- 动画状态（当前动作、进度、循环模式）各实例独立
- 丧尸模型是层级 Group 结构（非单一 Mesh），InstancedMesh 无法表达层级

采用方案：**共享几何体/材质 + 独立 Group 实例**。

- `createZombieMaterials()` 全局调用一次，缓存 CanvasTexture
- `buildZombieFromConfig()` 每次克隆新丧尸的完整 Group 层级
- 每只丧尸 ≈ 458 tris，5 只 ≈ 2290 tris，性能无压力
- 每只丧尸内部已通过 `materialId` 字典共享同类型材质（skin_rot/cloth_torn 全局只各创建一个实例）

#### 2.3 AnimationSystem 接口设计

```javascript
// 创建
const asys = createAnimationSystem(zombieGroup);  // 缓存所有 pivot/outer 引用
asys.play('Idle', true);  // 循环播放

// 游戏循环
asys.update(dt);  // 按归一化时间 0~1 驱动动画

// AI 状态机调用
asys.play('Walk', true);   // PATROL → Walk 循环
asys.play('Run', true);    // CHASE → Run 循环
asys.play('Attack', true); // ENGAGE → Attack 循环
asys.play('Hit', false);   // 受击 → Hit 单次
asys.play('Die', false);   // 死亡 → Die 单次（播完自动停止）
asys.play('Idle', true);   // STUNNED → Idle 循环
```

#### 2.4 动画与 AI 状态映射

| AI 状态 | 动画名 | 循环 |
| --- | --- | --- |
| PATROL | Walk | true |
| CHASE | Run | true |
| ENGAGE | Attack | true |
| STUNNED | Idle | true |
| FLEE | Run | true |
| DEAD | Die | false（单次，播完停留） |
| HIT | Hit | false（由 index.html 受击时触发） |


### 三、index.html 适配要点

#### 3.1 需移除的代码块（按行号范围）

| 行号 | 内容 |
| --- | --- |
| ~1948-2156 | `_zombieGlbCache` + `loadZombieGlb()` + `cloneWithSkinnedMesh()` |
| ~2184-2253 | `spawnZombieFromGlb()` + `zombieFallbackModel()` + `initZombieAnimController()` |
| ~4571-4580 | `loadOrQueueZombieGlb()` |
| ~4460-4568 | `createEnemies()` 中丧尸分支简化为直接调用 `createZombie()` |
| ~3568-3744 | 游戏循环中 `zombieMixer` 相关代码替换为 `animSystem` |
| ~4879-4895 | `cleanupEnemies()` 中 `zombieMixer` 清理 |
| ~5395-5396 | 模型预览 GLB 丧尸条目 |


#### 3.2 createEnemies() 简化

```javascript
// 之前（GLB + 回退双路径）
if (ecfg.type === 'zombie') {
    model = new THREE.Group();
    const useGlb = loadOrQueueZombieGlb(model);
    if (!useGlb) {
        if (!zombieFallbackModel(model)) { continue; }
    }
}
// 之后（单一程序化路径）
if (ecfg.type === 'zombie') {
    model = window.EnemyModels.createZombie();
    model.userData.animSystem = model.userData._animSystemReady;
}
```

#### 3.3 游戏循环动画更新

```javascript
// 替换: if (anim.mixer) anim.update(dt);
// 为:   if (enemy.userData.animSystem) enemy.userData.animSystem.update(dt);
```

### 四、enemyAI.js 适配

当前 AI 使用 `enemy.userData.anim.play('death', 0.3)` 接口（第二个参数是 crossfadeSec），需改为 `enemy.userData.animSystem.play('Die', false)`。主要变更点：

- `anim.play(name, crossfade)` → `animSystem.play(name, loop)`
- 动画名从小写（idle/walk/run/attack/hit/death）→ 首字母大写（Idle/Walk/Run/Attack/Hit/Die）
- 不再需要 AnimationMixer，移除相关引用

### 五、文件变更清单

| 文件 | 操作 | 预计变更量 |
| --- | --- | --- |
| `models/enemies.js` | 重写丧尸部分 | +400/-300 行 |
| `models/tank.js` | 注销注册 | -2 行 |
| `index.html` | 清理 GLB 系统 + 适配动画 | -300/+30 行 |
| `combat/enemyAI.js` | 适配 AnimationSystem 接口 | -10/+10 行 |
| `maps/test_map_04a.map.json` | 新增 3 只丧尸 | +45 行 |