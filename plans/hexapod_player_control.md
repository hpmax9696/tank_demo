# 玩家六足战车操控系统 — 实现计划

## 上下文

六足战车目前仅在模型工厂中作为动画展台使用。需要将其变为可操控的玩家单位，集成瞄准线、武器系统、输入映射。

## 新增文件

### `js/hexapod_player.js` — 玩家六足操控模块 (~400行)

**职责**: 玩家输入→六足动作的桥接，管理瞄准线和武器发射

#### 输入映射

```
鼠标 X 偏移(屏幕中心) → 车身转向速率 → hexRoot.rotation.y
鼠标 Y 偏移(屏幕中心) → 武器俯仰角       → 武器枢轴 quaternion
W/左摇杆上  → 前进 (direction=1)
S/左摇杆下  → 后退 (direction=-1)
A/左摇杆左  → 左平移 (direction=2)
D/左摇杆右  → 右平移 (direction=-2)
左键/LT    → 左侧武器开火
右键/RT    → 右侧武器开火
Q/RB       → 切换武器类型(加特林↔导弹)
```

#### 速率限制

```javascript
// 转向速率 (按坦克 turretAngVel 参考)
var BODY_TURN_RATE = 1.5;   // rad/s，鼠标推到边缘时满速
var PITCH_RATE_GAT = 1.2;   // rad/s，加特林俯仰速度
var PITCH_RATE_MIS = 0.8;   // rad/s，导弹俯仰稍慢(更重)
```

鼠标偏移归一化到 [-1,1] 后乘以速率上限，逐帧累积。

#### 瞄准线

- 从两个武器支架的世界位置各射出一条抛物线
- 复用 `SHELL_GRAVITY=1.0`
- 抛物线模拟: 取初速方向(武器支架世界朝向+俯仰角)，步进模拟直到碰地/超射程
- 加特林用高速弹道(初速 50m/s)，导弹用低速弧线(初速 18m/s)
- 超出俯仰限位后瞄准线锁死在限位边缘

#### 武器系统

**加特林状态机**:
```
IDLE → SPINNING_UP(1.5s) → READY → FIRING → OVERHEAT → COOLING_FORCED → IDLE
                                     ↓ 停火
                                  COOLING_NATURAL(慢速) → IDLE
```
- spinUp: 0→1 线性累积(1.5s)，spinUp<1 不能射击
- heat: 0→100，射击+25/s，强制散热-15/s，自然散热-5/s
- 枪管灼红: emissive 从 (0,0,0) → (1.0, 0.3, 0) * (heat/100)，intensity 随 heat 增大

**导弹状态机**:
```
READY(4发) → FIRING(1发, 间隔1s) → ... → EMPTY → RELOADING(5s) → READY
```
- 射空前不可装填
- AI: 发射前1s观瞄闪烁

**观瞄灯光**:
- 直接修改 `观瞄球体` mesh 的 material.emissive
- 待机/巡逻: `0x00ff00` (绿)
- 追击/攻击: `0xff0000` (红)
- 搜索: `0xffff00` (黄)
- 玩家: 基于HP比例从红到绿插值

#### 武器选择(玩家)

- Q/RB 切换: 加特林 ↔ 导弹
- 左键控制左侧武器，右键控制右侧武器
- 可同时按(左右各自独立)
- 同一侧一次只能用一种武器

## 修改文件

### `js/hexapod_anim.js`

1. **暴露武器枢轴引用**: `_hexaCollectRefs` 中存储武器 pivot 节点到 `animRefs`
2. **新增 `updatePlayerHexapod(dt)` 函数**: 
   - 由 engine.js 主循环调用(替代模型工厂的 `_hexaUpdateFrame`)
   - 读取 `hexapodPlayerInput` 全局状态
   - 调用 `_updateGait` 传递 direction/turnRate
   - 调用武器俯仰更新
3. **导出**: `M.HexapodAnims.updatePlayer = updatePlayerHexapod`

### `js/engine.js`

1. **游戏模式**: 新增 `playerType` 选择(坦克/六足)，菜单加按钮
2. **创建玩家六足**: `createPlayerHexapod()` — 用 `createHexapod()` + 玩家专属初始化
3. **主循环**: `gameLoop()` 中检测 `playerType === 'hexapod'`，调用 `HexapodAnims.updatePlayer(dt)`
4. **摄像机**: 六足摄像机跟在 hexRoot 后方上方的世界位置(复用 `getWorldPosition`)
5. **HUD**: 加特林热度条 + 导弹余弹/装填条

### `js/input.js`

新增:
- 鼠标 XY 暴露(相对于屏幕中心的偏移)
- `isRightMousePressed()`
- `getWeaponSwitch()` (Q键)

## 实施顺序

### Phase 1: 武器基础 + 瞄准线
- `hexapod_anim.js`: 暴露武器枢轴引用
- `hexapod_player.js`: 瞄准线绘制(抛物线从武器支架出发)
- `hexapod_player.js`: 武器俯仰驱动(鼠标Y→枢轴旋转, 速率限制)

### Phase 2: 移动 + 转向
- `hexapod_player.js`: 鼠标X→车身转向(速率限制)
- `hexapod_anim.js`: `updatePlayerHexapod` 整合输入→`_updateGait`
- `engine.js`: 玩家六足创建+主循环集成

### Phase 3: 武器发射
- `hexapod_player.js`: 加特林发射(复用mg.js tracer逻辑)
- `hexapod_player.js`: 导弹发射(高弧线, 复用shells.js爆炸)
- `hexapod_player.js`: 加特林过热+枪管灼红
- `hexapod_player.js`: 导弹弹舱+装填

### Phase 4: 观瞄灯光 + 精调
- `hexapod_player.js`: 观瞄球体 emissive 颜色状态机
- 摄像机适配 + HUD
- 手柄支持完善

## 关键复用

| 现有系统 | 复用方式 |
|----------|----------|
| `updateTrajectoryLine()` | 模拟逻辑复用(抛物线步进) |
| `mg.js` tracer | 加特林弹丸视觉 |
| `shells.js` explode | 导弹爆炸效果 |
| `_ccdLeg()` | 腿IK保持 |
| `_updateGait()` | 步态驱动 |
| `_WC_MOUNT_NAMES` | 武器支架位置 |
| 武器校准 pivot 系统 | 武器俯仰枢轴复用 |

## 验证

1. 模型工厂中六足动画展台功能不受影响
2. 游戏菜单中可选"🦗 六足战车"
3. WASD平移+鼠标转向+瞄准线可见
4. 加特林: spinUp延迟→射击→过热→强制散热
5. 导弹: 4连发→装填→高弧线弹道
6. Ctrl+F5 → 控制台 0 错误
