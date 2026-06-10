# 训练场六足战车集成 — 实现计划

> 基于 v0.56.0 训练场框架，在训练场中实装六足战车作为玩家可操控单位和敌方单位

## 现有基础

| 组件 | 状态 | 说明 |
|------|------|------|
| 训练场 UI | ✅ | `index.html:578-604`，六足按钮已存在但 `disabled` |
| 六足模型 | ✅ | `models/enemies.js:createHexapod()`，模板克隆+动画系统 |
| 六足动画 | ✅ | `js/hexapod_anim.js`，23动画+CCD IK+步态驱动 |
| 六足 AI | ✅ | `combat/enemyAI.js:updateHexapodEngage()`，敌方六足行为 |
| 坦克玩家 | ✅ | `enterTrainingMode()` 复用 player1 T-34 |
| 敌方创建 | ✅ | 支持 tank / assault-vehicle / zombie |

## 实施顺序

### Phase 1：训练场敌方六足 — 1-2小时

最小可行增量，验证六足在训练场中正常工作。

**1a: 启用 UI 按钮**
```
index.html:589 → 移除 disabled class
```
`setupToggle` 已自动跳过 `.disabled` 按钮，移除后六足按钮自动可点击。

**1b: 敌方六足创建** — `engine.js:enterTrainingMode()`
```javascript
// 在现有 if-else 链中添加:
} else if (realEnemyType === 'hexapod') {
    enemyModel = window.EnemyModels.createHexapod();
    enemyModel.userData = enemyModel.userData || {};
    enemyModel.userData._noTerrainPitch = true;
    // AI 初始化: hexapod 特殊字段
    enemyModel.ai = {
        ...baseAi,
        state: 'patrol',
        animRequest: 'idle',
        spinUp: 0,
        heat: 0,
        strafeTimer: 0,
        strafeDir: 1
    };
}
```

**1c: HP 条位置适配**
```javascript
// createEnemyHpBar 内已有 hexapod → y:2.8 的判断
const hpBarY = (type === 'hexapod') ? 2.8 : (type === 'zombie') ? 2.0 : 1.8;
```

**1d: 敌方六足动画更新** — 游戏循环中已有 `hexapod` 分支（`engine.js:3014-3046`），确认正常触发。

**Phase 1 验证**:
- 训练场选择敌方=六足，行为=不反击 → 六足正确显示+Idle动画
- 行为=反击 → 被攻击后追击玩家+武器射击
- 击杀六足 → 死亡动画 → 1s 后重生

---

### Phase 2：玩家六足 — 移动+转向 — 3-4小时

核心挑战：将 WASD 输入映射到六足步态，鼠标控制车身转向。

**2a: 启用玩家六足 UI**
```
index.html:583 → 移除 disabled class
```

**2b: 创建玩家六足** — `engine.js:enterTrainingMode()`
```javascript
if (trainingPlayerType === 'hexapod') {
    // 隐藏/移除 player1 坦克
    if (player1 && player1.group) {
        player1.group.visible = false;
        player1.group.position.set(0, -999, 0); // 移到地下隐藏
    }
    
    // 创建六足玩家模型
    const hexPlayer = window.EnemyModels.createHexapod();
    // ... 设置位置、朝向等
    player1.hexapodGroup = hexPlayer; // 挂载到 player1
}
```

> **注意**: 不建议替换 `player1` 本身，因为大量代码依赖 `player1.group`、`player1.hp`、`player1.state` 等。方案是保留 player1 结构，新增 `player1.hexapodGroup` 字段。

**2c: 输入映射** — `engine.js` 游戏循环中（约 `gameLoop()` 开始处）
```javascript
if (isTrainingMode && player1.hexapodGroup) {
    const hexRoot = player1.hexapodGroup;
    const hexInput = {
        direction: 0,   // 0=none, 1=forward, -1=back, 2=strafeL, -2=strafeR
        turnRate: 0     // rad/s
    };
    
    // WASD → direction (复用现有 input 模块)
    if (keys['KeyW']) hexInput.direction = 1;
    if (keys['KeyS']) hexInput.direction = -1;
    if (keys['KeyA']) hexInput.direction = (keys['KeyW'] ? 1 : keys['KeyS'] ? -1 : 0) ? 0 : 2;  // 纯平移
    if (keys['KeyD']) hexInput.direction = -2;
    
    // 鼠标 X → turnRate
    const mouseScreenCenterOffset = (mouseX - window.innerWidth/2) / (window.innerWidth/2);
    hexInput.turnRate = mouseScreenCenterOffset * BODY_TURN_RATE; // 1.5 rad/s max
    
    // 调用步态驱动
    window.HexapodAnims.updatePlayer(dt, hexInput);
}
```

**2d: 暴露 `updatePlayerHexapod` 到 `HexapodAnims`** — `hexapod_anim.js`
```javascript
// 新增函数: _updatePlayerGait(dt, input)
//   - 根据 direction + turnRate 选择动画索引
//   - 调用 _updateGait() 驱动腿部
//   - 更新 bodyYaw (转向积分)
//   导出为 M.HexapodAnims.updatePlayer

// 动画选择逻辑:
function _selectPlayerAnim(direction, turnRate) {
    if (turnRate > 0.8) return 'static_turn';          // 静态转向
    if (direction === 1 && turnRate !== 0) return 'walk_turn';  // 前进转弯
    if (direction === 1) return 'run';                  // 前进
    if (direction === -1) return 'walk_back';           // 后退
    if (direction === 2) return 'strafe_run';           // 左平移
    if (direction === -2) return 'strafe_run';          // 右平移
    // ...
    return 'idle';
}
```

**2e: 摄像机跟随**
```
六足摄像机跟随 hexRoot (车身) 而非 player1.group，偏移(0, 3, 8)
```

**Phase 2 验证**:
- 训练场选择我方=六足+敌方=不反击坦克 → 六足出现+可移动
- W前进→身体前移+腿步态动画正确
- A/D平移→螃蟹步
- 鼠标左右移动→车身转向+腿部转弯动画
- 停止按键→Idle 动画
- 摄像机正确跟随六足

---

### Phase 3：玩家武器 — 瞄准+开火 — 2-3小时

**3a: 武器瞄准线**
- 复用 `hexapod_anim.js` 中 `_WC_MOUNT_NAMES` 武器支架引用
- 从武器支架世界位置+朝向画抛物线
- 鼠标 Y → 武器俯仰角（加特林 +20°~-17°，导弹 +30°~-60°）

**3b: 武器发射**
- 左键 → 左侧武器开火（默认加特林）
- 右键 → 右侧武器开火
- Q → 切换武器类型（加特林 ↔ 导弹）

**3c: 加特林状态**
- spinUp 累积 1.5s → 可射击
- heat 管理（+25/s 射击, -15/s 冷却, >80 强制停火）
- 枪管旋转动画（已有 AnimationSystem WeaponIdle/Attack_Weapon 层）

**3d: 导弹状态**
- 弹舱 4发 → 5s 装填
- 高弧线弹道

**Phase 3 验证**:
- 瞄准线可见，随鼠标移动调整俯仰
- 左键射击加特林→spinUp延迟→连射→过热停火
- Q切换导弹→右键发射→高弧线→弹舱清空后装填
- 命中敌方坦克→伤害正确

---

### Phase 4：六足敌方行为完善 — 1-2小时

**4a: 训练场敌方六足 AI**
- 复用 `updateHexapodEngage()`（现有 `enemyAI.js:626`）
- 主动攻击行为：追击+横移绕圈+加特林射击+导弹间歇发射
- 反击行为：受击后才追击

**4b: 六足 vs 六足 对战**
- 玩家六足 + 敌方六足 同时在场
- 敌方武器命中判定

**Phase 4 验证**:
- 训练场 玩家六足 vs 敌方主动六足 → 敌方追击+射击
- 敌方六足过热→停火冷却
- 双方六足同场帧率 ≥30

---

## 输入映射速查

| 按键 | 动作 | 六足动画 |
|------|------|---------|
| W | 前进 | Run (全速) |
| S | 后退 | Walk Back |
| A | 左平移 | Strafe Run L |
| D | 右平移 | Strafe Run R |
| W+A | 前进左转 | Run Turn L |
| W+D | 前进右转 | Run Turn R |
| 鼠标 X | 车身转向 | static_turn (原地) 或 walk_turn (移动) |
| 鼠标 Y | 武器俯仰 | 加特林+20°~-17° / 导弹+30°~-60° |
| 左键 | 左侧武器开火 | Attack_Weapon |
| 右键 | 右侧武器开火 | Attack_Weapon |
| Q | 切换武器 | — |
| ESC | 返回菜单 | — |

## 关键文件

| 文件 | 变更 | 工作量 |
|------|------|--------|
| `index.html` | 移除两个 disabled class (2行) | 极少 |
| `js/engine.js` | 玩家六足创建+输入映射+主循环 (~150行) | 中 |
| `js/hexapod_anim.js` | 新增 `updatePlayer` 导出 (~80行) | 中 |
| `combat/enemyAI.js` | 确认训练场六足 AI 可用 (~10行) | 极少 |

## 不使用新模块

训练场六足集成范围较小，直接在 `engine.js` 和 `hexapod_anim.js` 中修改，暂不创建 `js/hexapod_player.js`。后续若扩展到完整游戏模式（单人/双人/combat），再提取为独立模块。
