---
name: new-zombie-integration
overview: 集成新程序化丧尸模型、清理 GLB 调试日志、实现完整丧尸群体行为系统（松散编队+巡逻/待机交替+扇形索敌+追击上限+近战攻击帧判定+受击定身+仇恨连携+死亡渐隐+掉落+碰撞+地形适应），04a 地图部署 5 只丧尸。
todos:
  - id: cleanup-tank-registry
    content: 注销 models/tank.js 中 green 和 desert 两个原始坦克的 ModelRegistry 注册
    status: pending
  - id: rewrite-enemies-zombie
    content: 重写 models/enemies.js 丧尸部分：移植 ZOMBIE_CONFIG、createZombieMaterials、buildZombieFromConfig、AnimationSystem、createAnimationSystem、预览工厂 makeZombie，替换旧的约300行丧尸代码
    status: pending
  - id: cleanup-glb-system
    content: 清理 index.html：移除 GLB 丧尸加载系统（_zombieGlbCache/loadZombieGlb/cloneWithSkinnedMesh/spawnZombieFromGlb/zombieFallbackModel/initZombieAnimController/loadOrQueueZombieGlb，约300行）、删除模型预览菜单 GLB 丧尸条目、清除所有 ZOMBIE_GLB_DEBUG 调试日志
    status: pending
    dependencies:
      - rewrite-enemies-zombie
  - id: adapt-game-loop
    content: 适配 index.html 游戏循环：简化 createEnemies 丧尸创建分支为直接调用 createZombie+绑定 AnimationSystem；丧尸动画更新从 zombieMixer 替换为 animSystem.update(dt)；cleanupEnemies 移除 zombieMixer 清理；实现死亡渐隐逻辑和战利品掉落
    status: pending
    dependencies:
      - cleanup-glb-system
  - id: rewrite-enemy-ai
    content: 重写 combat/enemyAI.js 丧尸行为系统：实现松散群体巡逻/待机交替、扇形索敌、追击上限、攻击帧判定（t=0.35 单帧扣血）、攻击冷却（1秒）、受击定身恢复（2秒）、仇恨连携、碰撞体积、地形适应
    status: pending
    dependencies:
      - rewrite-enemies-zombie
  - id: update-map-04a
    content: 更新 maps/test_map_04a.map.json：新增 zm-03/zm-04/zm-05 三只丧尸配置（含独立巡逻路径、位置和全部行为参数），总计 5 只
    status: pending
    dependencies:
      - rewrite-enemies-zombie
---

## 用户需求

### 第一阶段：清理冗余代码

1. 注销 `models/tank.js` 中 `green`/`desert` 两个原始坦克的 ModelRegistry 注册条目
2. 删除 `index.html` 模型预览菜单中 GLB 分类下的两个丧尸条目（`zombie`、`zombie-multi`）
3. 移除 `index.html` 中约 300 行 GLB 丧尸加载系统代码（`_zombieGlbCache`、`loadZombieGlb`、`cloneWithSkinnedMesh`、`spawnZombieFromGlb`、`zombieFallbackModel`、`initZombieAnimController`、`loadOrQueueZombieGlb`）
4. 清理 `index.html` 中为调试 GLB 丧尸添加的大量 `console.log` 输出和 `ZOMBIE_GLB_DEBUG` 相关代码

### 第二阶段：替换丧尸模型

5. 将 `zombie_prototype.html` 中的完整新程序化丧尸工具链移植到 `models/enemies.js`，替换旧的 `makeZombie()`（约300行）：

- `ZOMBIE_CONFIG`：24 节点层级树配置，含 11 个关节 pivot
- `createZombieMaterials()`：Canvas 2D 程序化贴图生成，返回 `{diffuse, roughness}` 纹理
- `buildZombieFromConfig()`：递归构建函数，含 pivot 补偿算法和自动插入部件（发光眼睛、血迹滴落）
- `AnimationSystem` 类：手动插值动画引擎，支持 `play(name, loop)`、`stop()`、`update(dt)`
- `createAnimationSystem(root)`：工厂函数，注册 Idle/Hit/Attack/Walk/Run/Die 六种动画
- `makeZombie()`：预览工厂函数，1.5x 缩放适配 ModelRegistry

6. 构建策略：每只丧尸通过 `buildZombieFromConfig` 创建独立 Group 层级，共享全局缓存的 Canvas 2D 贴图（materialId 字典中同 ID 共享材质实例）

### 第三阶段：完整僵尸群体行为系统

7. **松散群体交替巡逻/待机**：个体随机间隔交替巡逻（4-8s）和待机（2-4s），相互不同步，距离保持在仇恨连携范围（40m）内
8. **扇形索敌**：正前方 45 度锥角，距离不超过 30m（不超过机枪射程），发现玩家或受击后转为追击状态，同时触发仇恨连携通知 40m 内盟友
9. **追击上限**：玩家距离超过 `maxChaseDist`（80m）时放弃追击，恢复巡逻状态
10. **近战攻击帧判定**：距离小於 2m 时触发 Attack 动画；动画播放到手臂伸直帧（t 约等于 0.35，Attack 动画总长 1.0s）时才判定伤害，单帧扣血而非持续扣血
11. **攻击冷却**：攻击动画结束后 1 秒内不得再次攻击，即使玩家仍在攻击范围内
12. **受击定身**：被攻击后 HP 大于 0 则播放 Hit 动画（0.5s），进入 STUNNED 状态定在原位，直到不再被攻击超过 2 秒后恢复之前的行为
13. **死亡渐隐**：HP 小于等于 0 时播放 Die 动画（1.5s），死亡倒地 3 秒后开始渐隐（opacity 在 2 秒内线性降至 0），不产生爆炸效果
14. **战利品掉落**：死亡瞬间在尸体旁边（随机偏移 1-2m）生成修理箱，掉落几率 50%
15. **碰撞体积**：丧尸之间相互碰撞（圆柱体碰撞检测），与障碍物、玩家、地图边界空气墙均有碰撞检测
16. **地形适应**：丧尸受地形高度影响（可登上山丘），但身体不做俯仰（rotation.x 保持为 0）

## 技术方案

### 整体架构变更

```
清理前 → 清理后
═══════════════════════════════════════════════
tank.js:      注册 green + desert → 仅保留文件不注册
index.html:   GLB 加载系统(~300行) → 全部移除
index.html:   GLB 调试日志 → 全部清理
enemies.js:   旧 makeZombie(~300行) → 新程序化丧尸(~400行)
enemyAI.js:   anim.play(n,t) → asys.play(n,loop)
index.html:   zombieMixer 动画更新 → animSystem.update(dt)
04a地图:      2只丧尸 → 5只丧尸 + 新行为参数
```

### 代码结构：enemies.js 修改后

```
enemies.js (修改后)
├── 装甲突击车（保留不变）
│   ├── createAssaultVehicle()
│   └── makeAssaultVehicle()
├── 新程序化丧尸
│   ├── ZOMBIE_CONFIG              // 24节点层级树
│   ├── createZombieMaterials()    // Canvas 2D 贴图（全局缓存）
│   ├── buildZombieFromConfig()    // 递归构建 + pivot补偿
│   ├── countTriangles()           // 面数统计
│   ├── class AnimationSystem      // 动画引擎
│   ├── createAnimationSystem()    // 6种动画工厂
│   ├── createZombie()             // 游戏实例工厂
│   └── makeZombie()               // 预览工厂（1.5x缩放）
└── 全局导出 + 注册
    ├── window.EnemyModels = { createAssaultVehicle, createZombie, createZombieMaterials }
    └── ModelRegistry.register('enemies', '丧尸', makeZombie)
```

### AnimationSystem 接口与状态映射

```
AnimationSystem
├── play(name, loop)     // 播放动画，loop=true 循环
├── stop()               // 停止动画
├── update(dt)           // 每帧更新
└── clamped              // 单次动画是否已播完

状态映射：
PATROL  → play('Walk', true)   循环走路
CHASE   → play('Run', true)    循环奔跑
ENGAGE  → play('Attack', true) 循环攻击（攻击帧判定独立于动画循环）
STUNNED → play('Idle', true)   定身发呆
HIT     → play('Hit', false)   受击单次
DEAD    → play('Die', false)   死亡单次（播完停止）
FLEE    → play('Run', true)    逃跑=奔跑
```

### 攻击帧判定机制

不使用距离持续判定，改为动画进度判定：

```javascript
// 在游戏循环中检查
if (ai.state === 'engage' && ai.animRequest === 'attack') {
    const asys = enemy.userData.animSystem;
    const anim = asys.anims['Attack'];
    if (anim) {
        const t = asys.currentTime;  // 归一化时间 0~1
        if (t >= 0.30 && t <= 0.40 && !ai.atkHitApplied) {
            ai.atkHitApplied = true;
            // 触发单次伤害
        }
        if (t >= 1.0) {
            ai.atkHitApplied = false;
            ai.attackCooldownTimer = 1.0;  // 1秒冷却
        }
    }
}
```

### 碰撞检测方案

丧尸使用圆柱体碰撞检测（半径 0.35m，忽略高度差）：

- 丧尸之间：遍历敌人数组的双重循环判断距离
- 丧尸与障碍物：遍历 obstacles 数组
- 丧尸与玩家：遍历 players 数组
- 丧尸与边界：调用地图边界检查

碰撞响应：推开到最小距离外（position 修正，非物理模拟）。

### Index.html 清理范围

| 行号范围 | 代码块 |
| --- | --- |
| ~1948-2156 | `_zombieGlbCache` + `loadZombieGlb()` + `cloneWithSkinnedMesh()` |
| ~2184-2253 | `spawnZombieFromGlb()` + `zombieFallbackModel()` + `initZombieAnimController()` |
| ~2267-2269 | `zombieFallbackModel` 尾部分 |
| ~4571-4580 | `loadOrQueueZombieGlb()` |
| ~5395-5396 | 模型预览 GLB 丧尸条目 |
| 多处 | ZOMBIE_GLB_DEBUG 相关 console.log |


### index.html 适配点

**createEnemies() 简化**：

```javascript
// 之前（GLB + 回退双路径 ~20行）
if (ecfg.type === 'zombie') {
    model = new THREE.Group();
    const useGlb = loadOrQueueZombieGlb(model);
    if (!useGlb) {
        if (!zombieFallbackModel(model)) continue;
    }
}

// 之后（单一程序化路径 ~5行）
if (ecfg.type === 'zombie') {
    model = window.EnemyModels.createZombie();
    model.userData.animSystem = model.userData._animSystem;
}
```

**游戏循环动画更新**：

```javascript
// 替换: if (anim.mixer) anim.update(dt);
// 为:   if (enemy.userData.animSystem) enemy.userData.animSystem.update(dt);
```

**清理 cleanupEnemies()**：

```javascript
// 删除: if (enemy.userData.zombieMixer) { enemy.userData.zombieMixer.stopAllAction(); }
```

### 04a 地图 5 只丧尸分布

```
zm-01: [60, 0, -70]   ← 原有，保持不变
zm-02: [-55, 0, -65]  ← 原有，保持不变
zm-03: [70, 0, 60]    ← 新增，地图东北象限
zm-04: [-70, 0, 55]   ← 新增，地图西北象限
zm-05: [0, 0, 80]     ← 新增，地图正北中央
```

每只新增以下行为参数：

- `maxChaseDist: 80`
- `coneAngle: 0.39`（约 22.5 度半锥角，全锥 45 度）
- `coneRange: 30`
- `groupRadius: 40`
- `patrolDuration: [4, 8]`（随机范围）
- `idleDuration: [2, 4]`（随机范围）
- `fadeOutDelay: 3`
- `fadeOutDuration: 2`
- `attackHitFrame: 0.35`
- `attackCooldown: 1`
- `stunRecover: 2`

### 文件变更清单

| 文件 | 操作 | 预计变更 |
| --- | --- | --- |
| `models/tank.js` | 注销注册 | -2 行 |
| `models/enemies.js` | 重写丧尸部分 | +400/-300 行 |
| `combat/enemyAI.js` | 重写丧尸行为逻辑 | +200/-50 行 |
| `index.html` | 清理 GLB + 日志 + 适配动画/死亡/渐隐/掉落/碰撞 | -350/+80 行 |
| `maps/test_map_04a.map.json` | 新增 3 只丧尸 + 行为参数 | +70 行 |