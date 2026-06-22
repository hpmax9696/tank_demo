# 坦克炮塔世界空间重构 — 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将炮塔偏航从局部空间搬到世界空间存储，删除瞬时稳定器，消除车体+鼠标同向时的互搏迟钝

**Architecture:** `worldTurretYaw` 作为持久状态（世界 XZ 平面角度），鼠标/摇杆直接驱动；每帧末尾通过 `turretYaw = worldTurretYaw - (π/2 - hullYaw)` 反算局部值渲染。惰性初始化避免触碰所有 spawn/respawn 代码。

**Tech Stack:** Three.js r160, 纯 JavaScript, 无测试框架（CDP 验证）

## Global Constraints

- 仅修改 `js/engine.js`（约 40 行）
- 不修改 `combat/enemyAI.js`、`models/t34_v16_builder.js`、`js/playerControllers/hexapodPlayer.js`、`index.html`
- 炮管俯仰（barrelElevation）逻辑不变
- 摄像机（cameraYaw）逻辑不变
- 敌方坦克行为不变
- 六足等 PCM 角色行为不变
- 版本号同步 8 处（发版时）

---

## 文件结构

| 文件 | 操作 | 职责 |
|------|------|------|
| `js/engine.js` | 修改 7 处 | 炮塔状态+瞄准+渲染 全链 |

---

### Task 1: 新增 worldTurretYaw 状态字段

**Files:**
- Modify: `js/engine.js` — `createPlayer()` 函数

**Interfaces:**
- Produces: `player.worldTurretYaw` (number | undefined)，初始值 `undefined`
- Consumed by: Task 2, Task 3, Task 4

- [ ] **Step 1: 修改 createPlayer() 状态初始化**

将 `js/engine.js` 中 `createPlayer()` 函数的第 161 行：

```js
// 修改前
turretYaw: 0, barrelElevation: 0.05,

// 修改后
turretYaw: 0, worldTurretYaw: undefined, barrelElevation: 0.05,
```

- [ ] **Step 2: 确认无语法错误**

```bash
node -e "require('./js/engine.js')" 2>&1 || true
# engine.js 不是 CommonJS 模块，用语法检查替代：
node --check js/engine.js 2>&1
```

Expected: 无输出（语法正确）

- [ ] **Step 3: Commit**

```bash
git add js/engine.js
git commit -m "feat: 新增 worldTurretYaw 状态字段 (惰性初始化 undefined)"

Co-Authored-By: Claude <noreply@anthropic.com>
```

---

### Task 2: 改造 updateAiming() — 玩家单人/训练/战斗模式

**Files:**
- Modify: `js/engine.js` — `updateAiming()` 函数（第 1100-1275 行）

**Interfaces:**
- Consumes: `player.worldTurretYaw` (from Task 1)
- Produces: `player.worldTurretYaw`（修改），`player.turretYaw`（派生）
- 外部不变: `turretPivot.rotation.y = player.turretYaw`（第 1726 行，不修改）

- [ ] **Step 1: 删除稳定器，替换为惰性初始化**

将第 1103-1108 行：

```js
    // ── 车体转向即时补偿 (WoT式稳定器): 车体转多少, 炮塔反向补偿 ──
    const hullYaw = player.state.yaw;
    const hullDyaw = (player._prevHullYaw !== undefined) ? (hullYaw - player._prevHullYaw) : 0;
    player._prevHullYaw = hullYaw;
    // 稳定器先统一应用, 手柄右摇杆在下方叠加
    player.turretYaw += hullDyaw;
```

替换为：

```js
    // ── 世界空间炮塔: 首帧从局部 turretYaw 惰性初始化 ──
    const hullYaw = player.state.yaw;
    if (player.worldTurretYaw === undefined) {
        player.worldTurretYaw = player.turretYaw + (Math.PI / 2 - hullYaw);
    }
```

- [ ] **Step 2: 游戏手柄路径 — 改为世界空间**

将第 1135 行：

```js
        player.turretYaw += stickToTarget(-gpx) * turretAngVel * dt;
```

替换为：

```js
        player.worldTurretYaw += stickToTarget(-gpx) * turretAngVel * dt;
```

删除第 1141-1142 行（turretYaw 归一化 — 移到末尾统一处理）：

```js
        // 删除以下两行:
        if (player.turretYaw > Math.PI) player.turretYaw -= Math.PI * 2;
        if (player.turretYaw < -Math.PI) player.turretYaw += Math.PI * 2;
```

- [ ] **Step 3: 鼠标瞄准路径 — 改为世界空间**

将第 1188-1196 行：

```js
            const invQ = player.group.quaternion.clone().invert();
            const localDir = worldDir.clone().applyQuaternion(invQ);
            const targetYaw = Math.atan2(localDir.x, localDir.z);
            const targetElev = -Math.atan2(localDir.y, Math.sqrt(localDir.x * localDir.x + localDir.z * localDir.z));
            const clampedElev = Math.max(maxUp, Math.min(maxDown, targetElev));

            player.turretYaw = angleMoveToward(player.turretYaw, targetYaw, turretAngVel * dt);
            if (player.turretYaw > Math.PI) player.turretYaw -= Math.PI * 2;
            if (player.turretYaw < -Math.PI) player.turretYaw += Math.PI * 2;
```

替换为：

```js
            // 世界空间炮塔目标方向
            const worldTargetYaw = Math.atan2(worldDir.x, worldDir.z);

            // 炮管俯仰仍用局部空间（相对车体，逻辑不变）
            const invQ = player.group.quaternion.clone().invert();
            const localDir = worldDir.clone().applyQuaternion(invQ);
            const targetElev = -Math.atan2(localDir.y, Math.sqrt(localDir.x * localDir.x + localDir.z * localDir.z));
            const clampedElev = Math.max(maxUp, Math.min(maxDown, targetElev));

            // 驱动世界空间炮塔追赶目标
            player.worldTurretYaw = angleMoveToward(player.worldTurretYaw, worldTargetYaw, turretAngVel * dt);
```

- [ ] **Step 4: 修改 turretDiff 计算（环绕处理）**

将第 1200 行：

```js
            const turretDiff = Math.abs(player.turretYaw - targetYaw);
```

替换为：

```js
            let turretDiff = Math.abs(player.worldTurretYaw - worldTargetYaw);
            if (turretDiff > Math.PI) turretDiff = Math.PI * 2 - turretDiff;
```

- [ ] **Step 5: 在函数末尾插入 turretYaw 推导**

在第 1266 行 `player.barrelElevation = Math.max(maxUp, Math.min(maxDown, player.barrelElevation));` 之前插入：

```js
    // ── 从世界空间反算局部 turretYaw（用于渲染，替代稳定器）──
    player.turretYaw = player.worldTurretYaw - (Math.PI / 2 - hullYaw);
    // 归一化到 [-PI, PI]
    while (player.turretYaw > Math.PI) player.turretYaw -= Math.PI * 2;
    while (player.turretYaw < -Math.PI) player.turretYaw += Math.PI * 2;
```

- [ ] **Step 6: 语法检查**

```bash
node --check js/engine.js 2>&1
```

Expected: 无输出

- [ ] **Step 7: Commit**

```bash
git add js/engine.js
git commit -m "feat: updateAiming 改为世界空间炮塔 — 删瞬时稳定器 + 鼠标/摇杆直驱 worldTurretYaw + 派生局部值"

Co-Authored-By: Claude <noreply@anthropic.com>
```

---

### Task 3: 改造 updateAimingForVs() — 对战模式

**Files:**
- Modify: `js/engine.js` — `updateAimingForVs()` 函数（第 3280-3368 行）

**Interfaces:**
- Consumes: `p.worldTurretYaw` (from Task 1)
- Produces: `p.worldTurretYaw`（修改），`p.turretYaw`（派生）
- 外部不变: `p.turretPivot.rotation.y = p.turretYaw`（第 3465 行，不修改）

- [ ] **Step 1: 删除稳定器，替换为惰性初始化（P2 和 P1 共用）**

将第 3287-3293 行：

```js
        // ── 车体转向即时补偿 ──
        const hullYaw = p.state.yaw;
        if (p._prevHullYaw !== undefined) {
            const hullDyaw = hullYaw - p._prevHullYaw;
            p.turretYaw += hullDyaw;
        }
        p._prevHullYaw = hullYaw;
```

替换为：

```js
        // ── 世界空间炮塔: 首帧惰性初始化 ──
        const hullYaw = p.state.yaw;
        if (p.worldTurretYaw === undefined) {
            p.worldTurretYaw = p.turretYaw + (Math.PI / 2 - hullYaw);
        }
```

- [ ] **Step 2: P2 游戏手柄路径 — 改为世界空间**

将第 3308-3310 行：

```js
            p.turretYaw += turretSpeed * dt;
            if (p.turretYaw > Math.PI) p.turretYaw -= Math.PI * 2;
            if (p.turretYaw < -Math.PI) p.turretYaw += Math.PI * 2;
```

替换为：

```js
            p.worldTurretYaw += turretSpeed * dt;
```

- [ ] **Step 3: P1 提前返回路径 — 插入 turretYaw 推导**

将第 3319-3322 行：

```js
        if (!isMouseInP1Area) {
            p.barrelElevation = Math.max(maxUp, Math.min(maxDown, p.barrelElevation));
            return;
        }
```

替换为：

```js
        if (!isMouseInP1Area) {
            // 提前返回前必须推导 turretYaw（否则渲染读到过时值）
            p.turretYaw = p.worldTurretYaw - (Math.PI / 2 - hullYaw);
            while (p.turretYaw > Math.PI) p.turretYaw -= Math.PI * 2;
            while (p.turretYaw < -Math.PI) p.turretYaw += Math.PI * 2;
            p.barrelElevation = Math.max(maxUp, Math.min(maxDown, p.barrelElevation));
            return;
        }
```

- [ ] **Step 4: P1 鼠标瞄准路径 — 改为世界空间**

将第 3354-3362 行：

```js
            const invQ = p.group.quaternion.clone().invert();
            const localDir = worldDir.clone().applyQuaternion(invQ);
            const targetYaw = Math.atan2(localDir.x, localDir.z);
            const targetElev = -Math.atan2(localDir.y, Math.sqrt(localDir.x * localDir.x + localDir.z * localDir.z));
            const clampedElev = Math.max(maxUp, Math.min(maxDown, targetElev));

            p.turretYaw = angleMoveToward(p.turretYaw, targetYaw, turretAngVel * dt);
            if (p.turretYaw > Math.PI) p.turretYaw -= Math.PI * 2;
            if (p.turretYaw < -Math.PI) p.turretYaw += Math.PI * 2;
```

替换为：

```js
            // 世界空间炮塔目标方向
            const worldTargetYaw = Math.atan2(worldDir.x, worldDir.z);

            // 炮管俯仰仍用局部空间
            const invQ = p.group.quaternion.clone().invert();
            const localDir = worldDir.clone().applyQuaternion(invQ);
            const targetElev = -Math.atan2(localDir.y, Math.sqrt(localDir.x * localDir.x + localDir.z * localDir.z));
            const clampedElev = Math.max(maxUp, Math.min(maxDown, targetElev));

            // 驱动世界空间炮塔追赶目标
            p.worldTurretYaw = angleMoveToward(p.worldTurretYaw, worldTargetYaw, turretAngVel * dt);
```

- [ ] **Step 5: 在函数末尾（P1/P2 通用）插入 turretYaw 推导**

在第 3367 行 `p.barrelElevation = Math.max(maxUp, Math.min(maxDown, p.barrelElevation));` 之前插入（注意此处在 for 循环内，对每个 player 都执行）：

```js
        // ── 从世界空间反算局部 turretYaw ──
        p.turretYaw = p.worldTurretYaw - (Math.PI / 2 - hullYaw);
        while (p.turretYaw > Math.PI) p.turretYaw -= Math.PI * 2;
        while (p.turretYaw < -Math.PI) p.turretYaw += Math.PI * 2;
```

- [ ] **Step 6: 语法检查**

```bash
node --check js/engine.js 2>&1
```

Expected: 无输出

- [ ] **Step 7: Commit**

```bash
git add js/engine.js
git commit -m "feat: updateAimingForVs 改为世界空间炮塔 — P1/P2 均用 worldTurretYaw + 提前返回路径推导"

Co-Authored-By: Claude <noreply@anthropic.com>
```

---

### Task 4: 训练重生重置 worldTurretYaw

**Files:**
- Modify: `js/engine.js` — `_processTrainingRespawn()` 函数（第 4128-4138 行）

**Interfaces:**
- Consumes: `player1.worldTurretYaw` (from Task 1)

- [ ] **Step 1: 坦克重生路径加 worldTurretYaw 重置**

在第 4135 行 `player1.currentLeftSpeed = 0; player1.currentRightSpeed = 0;` 之后插入：

```js
                player1.worldTurretYaw = undefined; // 惰性初始化将对齐重生朝向
```

完整上下文（展示插入位置）：

```js
            } else {
                // ── 坦克复活 ──
                player1.group.position.set(trainingPlayerSpawn.x, gy, trainingPlayerSpawn.z);
                player1.group.visible = true; player1.hp = 100; player1.dead = false;
                player1.state.x = trainingPlayerSpawn.x; player1.state.z = trainingPlayerSpawn.z;
                player1.state.yaw = Math.PI;
                player1.currentLeftSpeed = 0; player1.currentRightSpeed = 0;
                player1.worldTurretYaw = undefined; // ★ 新增
                player1.reloadTimer = 0; player1.group.rotation.set(0, 0, 0);
                if (player1.damageEffects && player1.damageEffects.active) player1.damageEffects.hide();
                togglePlayerBars(player1, true);
                hintBar.textContent = 'WASD 移动 | 鼠标瞄准 | 左键 主炮 | ESC 退出训练';
            }
```

- [ ] **Step 2: 语法检查**

```bash
node --check js/engine.js 2>&1
```

Expected: 无输出

- [ ] **Step 3: Commit**

```bash
git add js/engine.js
git commit -m "fix: 训练重生重置 worldTurretYaw 使炮塔重新对齐车体朝向"

Co-Authored-By: Claude <noreply@anthropic.com>
```

---

### Task 5: CDP 验证 + 版本号同步

**Files:**
- Verify: `js/engine.js`（已修改）
- Modify: `index.html`（版本号 ×5）、`README.md`（版本号 ×2 + 版本历史）

- [ ] **Step 1: 启动 HTTP 服务 + CDP 验证**

```bash
python -m http.server 8080 --bind 127.0.0.1 &
sleep 2
# CDP 验证（需 cdp_verify.py 脚本或等效工具）
```

Expected: 0 控制台错误

- [ ] **Step 2: 手动验证关键场景**

在浏览器中：
1. 单人模式 → 炮塔指前方无跳动
2. WASD 转车体 + 鼠标不动 → 炮塔世界静止
3. A/D 转车体 + 鼠标同向 → 灵敏追光标无迟钝
4. 对战模式 → P1 鼠标 + P2 摇杆各自正常
5. 训练模式 → 死亡重生后炮塔重新指前方

- [ ] **Step 3: 版本号同步**

参考 `.claude/skills/bump-version.md` 流程，同步 `index.html`（5 处）+ `README.md`（2 处）+ changelog 裁剪

- [ ] **Step 4: 最终 Commit**

```bash
git add js/engine.js index.html README.md
git commit -m "v0.63.0: 坦克炮塔世界空间重构 — 删瞬时稳定器 + worldTurretYaw 直驱 + 同向不再迟钝"

Co-Authored-By: Claude <noreply@anthropic.com>
```

---

## 自审

- ✅ 设计文档 7 处改动全覆盖（Task 1-4）
- ✅ 无 TBD/TODO/占位符
- ✅ 所有代码步骤包含完整替换文本（修改前→修改后）
- ✅ 接口一致：Task 1 生产 `worldTurretYaw: undefined`，Task 2-4 消费
- ✅ 验证覆盖：语法检查 + CDP + 手动场景
- ✅ 敌方/六足/摄像机/俯仰 均未触碰
