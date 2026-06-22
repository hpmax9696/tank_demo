# 坦克炮塔世界空间重构 — 设计文档

**日期:** 2026-06-21
**版本:** v0.63.0
**状态:** 待审阅

---

## 一、概述

### 要解决的问题

当前炮塔系统在**车体和鼠标同向转动**时感觉迟钝。

**根因:** 三条控制路径在同一个局部空间变量 `turretYaw` 上互搏：
- **稳定器** (`turretYaw += hullDyaw`) — 瞬时（无限速度），车体转多少炮塔补偿多少
- **鼠标瞄准** (`angleMoveToward(turretYaw, localTarget, 30°/s)`) — 限速 0.5236 rad/s
- **手柄摇杆** (`turretYaw += stick * speed * dt`) — 限速 0.5236 rad/s

当车体和鼠标同向右转时：稳定器瞬时把 `turretYaw` 往上冲，鼠标瞄准计算的 `localTargetYaw` 反而变小（车体迎向目标），`angleMoveToward` 只能以 30°/s 慢速纠偏 → 两条路径打架 → 炮塔几乎不动。

### 解决方案

将炮塔方向从**局部空间**搬到**世界空间**存储。核心思想：

> 炮塔像一个陀螺仪平台：车体在它下面自由转动而不影响它；鼠标和摇杆直接在世界空间驱动它。

### 预期效果

- 车体+鼠标同向转 → 炮塔以满 30°/s 灵敏追光标
- 车体转但鼠标不动 → 炮塔在世界空间纹丝不动
- 代码更简单：删掉瞬时稳定器 + 局部空间转换，替换为一条世界→局部反算公式

---

## 二、当前架构

### 数据模型

```
player.turretYaw: number        ← 局部空间（相对车体），持久状态
player._prevHullYaw: number     ← 仅用于稳定器差分
hullYaw = player.state.yaw      ← 车体世界朝向
```

### 三条控制路径（updateAiming, 约第 1100-1275 行）

| 路径 | 行 | 操作 | 速度 |
|------|-----|------|------|
| 稳定器 | 1103-1108 | `turretYaw += hullDyaw` | 瞬时 |
| 手柄右摇杆 | 1127-1146 | `turretYaw += stick * turretAngVel * dt` | 0.5236 rad/s |
| 鼠标瞄准 | 1147-1263 | 世界→局部转换 → `angleMoveToward(turretYaw, localTarget, turretAngVel*dt)` | 0.5236 rad/s |

### 渲染

```js
// line 1716: 车身
tankGroup.rotation.set(pitch, π/2 - hullYaw, roll);

// line 1726: 炮塔（tankGroup 的子节点）
turretPivot.rotation.y = player.turretYaw;  // 局部空间

// 世界炮塔朝向 = (π/2 - hullYaw) + turretYaw
```

### 对战模式

`updateAimingForVs()` (约第 3280-3368 行) 对 P1 和 P2 使用完全相同的模式。

---

## 三、新设计

### 核心状态

```
player.worldTurretYaw: number | undefined   ← 世界空间，持久状态（首帧惰性初始化）
player.turretYaw: number                     ← 局部空间，每帧派生的渲染值（不再是持久状态）
```

### 控制路径（改造后）

| 路径 | 操作 |
|------|------|
| ~~稳定器~~ | **删除** — 公式已隐含稳定效果 |
| 手柄右摇杆 | `worldTurretYaw += stick * turretAngVel * dt` |
| 鼠标瞄准 | `worldTargetYaw = atan2(worldDir.x, worldDir.z)` → `worldTurretYaw = angleMoveToward(worldTurretYaw, worldTargetYaw, 30°/s)` |

### 派生公式（替代稳定器的唯一一行）

```js
player.turretYaw = worldTurretYaw - (π/2 - hullYaw);
```

**为什么这一行就够了：** 车体右转 → `hullYaw` 增大 → `(π/2 - hullYaw)` 减小 → `turretYaw` 增大 → 炮塔相对车体多转了一份 → 世界指向不变。稳定效果从"显式补偿代码"变成了"公式的自然结果"。

### 惰性初始化

```js
// updateAiming / updateAimingForVs 开头
if (player.worldTurretYaw === undefined) {
    player.worldTurretYaw = player.turretYaw + (π/2 - hullYaw);
}
```

`createPlayer()` 中 `worldTurretYaw: undefined`，首帧自动对齐当前车体方向。所有模式/spawn/respawn 无需改动初始化代码。

### 归一化策略

- `worldTurretYaw` — 允许无界增长（摇杆持续累加），无需归一化
- `turretYaw`（派生值）— 每帧归一化到 `[-π, π]`，在推导点统一处理

---

## 四、改动范围

### 修改文件

**仅 `js/engine.js`**（约 40 行）

### 不改文件

| 文件 | 原因 |
|------|------|
| `combat/enemyAI.js` | 敌人用 `aimTurretAt()` 直接操作 `tp.rotation.y`，不碰 `turretYaw` |
| `models/t34_v16_builder.js` | 模型层级（tankGroup → turretPivot → barrelPivot）保持不变 |
| `js/playerControllers/hexapodPlayer.js` | 六足走 PCM 分支，`updateAiming` 被跳过 |
| `index.html` | 无新脚本加载 |

### 六处具体改动

1. **`createPlayer()`** — 新增 `worldTurretYaw: undefined`
2. **`updateAiming()` 稳定器块** — 删除，替换为惰性初始化
3. **`updateAiming()` 手柄路径** — `turretYaw` → `worldTurretYaw`，删归一化
4. **`updateAiming()` 鼠标路径** — 去掉 `invQ` 局部转换，直接用 `atan2(worldDir)` 得到 `worldTargetYaw`；`turretDiff` 加环绕处理
5. **`updateAiming()` 末尾** — 插入 `turretYaw = worldTurretYaw - (π/2 - hullYaw)` 推导 + 归一化
6. **`updateAimingForVs()`** — 对 P1/P2 重复改动 2-5（含 P1 提前返回路径的推导）
7. **`_processTrainingRespawn()`** — 坦克重生加 `worldTurretYaw = undefined` 触发重新对齐

### 完全不变

- `turretPivot.rotation.y = player.turretYaw` 渲染行（第 1726/3465 行）
- 炮管俯仰（`barrelElevation`）全程
- 摄像机（`cameraYaw`、狙击模式、摇杆对齐炮管）
- 开火/弹道线（`getBarrelWorldDir()` 读 Three.js 场景图）
- 敌人 AI 全部

---

## 五、边界情况

### 惰性初始化覆盖

| 场景 | worldTurretYaw 状态 | 结果 |
|------|---------------------|------|
| 新进单人模式 | `undefined` → 自动对齐 | ✅ |
| 新进对战模式 | `undefined` → 自动对齐 | ✅ |
| 新进训练模式 | `undefined` → 自动对齐 | ✅ |
| 训练坦克死亡重生 | 显式设 `undefined` → 自动对齐 | ✅ |
| 六足→坦克切换 | `createPlayer()` 重建 → `undefined` | ✅ |

### 对战 P1 提前返回

P1 鼠标在 P2 半屏时跳过瞄准但**仍需渲染**——在 `return` 前插入推导，避免 `turretPivot.rotation.y` 读到过时值。

### cross-PI 环绕

`angleMoveToward` 内部处理 diff 归一化。`turretDiff` 比较增加 `if (diff > PI) diff = 2*PI - diff` 环绕处理。

---

## 六、验证清单

1. 出生时炮塔指前方，无视觉跳动
2. WASD 转车体 + 鼠标不动 → 炮塔世界静止
3. A/D 转车体 + 鼠标同向 → 灵敏追光标
4. 摇杆右推 → 匀速旋转，不卡不跳
5. 对战 P1+P2 → 各自正确
6. 训练死亡重生 → 炮塔重新指前方
7. 狙击模式 → 无异常
8. CDP 验证 0 错误
