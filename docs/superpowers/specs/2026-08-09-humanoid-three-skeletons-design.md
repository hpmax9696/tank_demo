# 校园丧尸三副骨架 + 比例重定 设计

**日期**：2026-08-09
**关联**：v0.79.4 鞋修复后续；humanoid_config.js / enemies.js / campus_spawner.js
**状态**：设计中（待用户审 → writing-plans）

## 背景

校园丧尸四个变体（student_m / student_f / teacher_m / teacher_f）当前共享单一 `HUMANOID_BASE` 骨架，仅靠 height/build/hunch/curves 参数缩放，**肢体比例完全相同**。核查发现：

- 上身 : 下身 = 1.28（实测世界坐标，骨盆以上 0.59 / 以下 0.46）
- 臂展 / 身高 ≈ 0.67（现实应 ≈ 1.0）→ **手臂普遍过短**
- 腿 / 躯干链 = 0.67（成人应 ≈ 1.0）
- 头 / 身高 = 1/6.5

对照现实：儿童 SH/LL≈1.3（上身长腿短是正常儿童特征）、成人≈1.05（腿约占身高一半）、臂展≈身高。因此：

- **学生（儿童）**比例基本合理，仅需加长过短的手臂；
- **教师（成人）**却保留了儿童式上身长/腿短比例，明显失真；
- 四变体一致的手臂过短加剧了「侏儒感」。

此外用户要求：男女教师各自独立一套模型；女教师需更精细的曲线调教以展示女性身材；游戏场景中**教师体型固定**（不再随机化），学生保留随机。

## 目标

1. `HUMANOID_BASE` 拆为三副独立骨架：`STUDENT_BASE`（男女学生共享）/ `TEACHER_M_BASE` / `TEACHER_F_BASE`
2. 按游戏风格化比例重定各段尺寸（学生保留儿童特征，教师成人化，女教师 S 曲线）
3. 全部加长手臂（臂展/身高 → ~0.95–1.0）
4. 女教师骨架女性化（窄肩/收腰/长腿/小头）+ 复用 bust/hips/curves
5. 游戏侧：教师 buildHumanoid 用固定默认 params，学生保留随机
6. 工厂体型滑块保留（调试/预览）

## 非目标（YAGNI）

- 不改动画系统（REST_POSES / JOINT_NAMES / 关键帧）——关节名不变即可复用
- 不新增 addon（bust/hips/skirt/trousers 等全部复用）
- 不改血量/AI/碰撞等游戏逻辑
- 不改模型工厂的模型切换/GUI 框架（仅体型参数针对新骨架生效）

## 架构

### 三副骨架

`humanoid_config.js` 中：

```
STUDENT_BASE   ← student_m / student_f 共享（儿童比例）
TEACHER_M_BASE ← teacher_m（成人男性）
TEACHER_F_BASE ← teacher_f（成人女性，S 曲线）
```

三副骨架**关节名保持一字对齐**：root / pelvis / torso / neck / head / l_upper_arm / l_forearm / r_upper_arm / r_forearm / l_upper_leg / l_lower_leg / l_foot / r_upper_leg / r_lower_leg / r_foot（+ eye_glow 等）。这是 addon 复用与动画复用的前提。

### 共享层（不动）

- `ADDON_LIBRARY`：裤/裙/鞋/领带/校徽/bust/hips 等，跨骨架直接复用（关节名一致）
- `buildHumanoid(variant, params)` 装配逻辑：仅改开头「按 variant 选骨架」映射
- `REST_POSES` / `JOINT_NAMES` / `deriveNode` / `WRAP_ADDONS` / `DUAL_LEG_ADDONS` / 动画系统：全部复用

### 各骨架独立

各段 size（头/颈/躯干/骨盆/四肢）、肩宽（上臂 position x）、腰线、腿长——按下方比例目标分别写死在各自骨架常量里。

## 比例目标（游戏风格化）

| 指标        | 学生（儿童） | 男教师 | 女教师       | 现实参考              |
| ----------- | ------------ | ------ | ------------ | --------------------- |
| 上身 : 下身 | 1.25         | 1.05   | 1.0          | 儿童 1.3 / 成人 1.05  |
| 腿长 / 身高 | 0.42         | 0.48   | 0.50         | 儿童 0.40 / 成人 0.48 |
| 臂展 / 身高 | 0.95         | 1.0    | 1.0          | ≈1.0（当前 0.67）     |
| 头 / 身高   | 1/6          | 1/7    | 1/7.5        | 儿童 1/6 / 成人 1/7   |
| 肩宽        | 中           | 宽     | 窄           | 性二态                |
| 腰          | 直           | 直     | 细（S 曲线） | 女性                  |

## 各段 size 起始值（单位）

实现时用 Playwright 测 bbox（上身/下身/腿长/臂展）迭代微调到上表目标，起始值如下：

| 部位       | 学生 | 男教师 | 女教师 | 当前共享 |
| ---------- | ---- | ------ | ------ | -------- |
| 头（球 r） | 0.20 | 0.17   | 0.16   | 0.20     |
| 颈（高）   | 0.13 | 0.13   | 0.12   | 0.15     |
| 躯干（高） | 0.70 | 0.65   | 0.60   | 0.75     |
| 骨盆（高） | 0.30 | 0.32   | 0.30   | 0.35     |
| 上臂（高） | 0.52 | 0.55   | 0.52   | 0.45     |
| 前臂（高） | 0.48 | 0.50   | 0.47   | 0.42     |
| 大腿（高） | 0.48 | 0.60   | 0.62   | 0.45     |
| 小腿（高） | 0.45 | 0.55   | 0.57   | 0.42     |
| 脚（高）   | 0.10 | 0.10   | 0.09   | 0.10     |

肩宽（上臂 position[0]，x 偏移）：男教师 0.36、学生 0.30、女教师 0.28（当前 0.30）。

各段 `position`（相对父关节）与 `pivot` 保持当前 HUMANOID_BASE 的值不变，仅改 size 与肩宽 x；如迭代测出堆叠偏差（如脚离地/穿模），再局部调对应段 position。

## 女教师精细化（S 曲线）

- **骨架层**（TEACHER_F_BASE）：窄肩（上臂 x=0.28）、最短躯干（0.60，腰位上移）、最长腿（大腿 0.62 / 小腿 0.57）、最小头（r=0.16）
- **曲线层**（复用现有）：`curves` 0.6–0.9 → torso 收腰（`size[0]×(1-curves×0.15)`）+ bust 放大（`0.6+curves×0.8`）+ hips 放大；bodyRange 已设 `curves:[0.6,0.9]`
- **addon**：bust（胸 Sphere）+ hips（后侧扁椭球）+ skirt_grey（膝下中长裙，露长腿）+ leather_shoes，全部复用
- 结果：窄肩 → 收腰 → 饱满胸/翘臀 → 长腿，明显女性化但仍端庄

## 游戏侧（教师固定 / 学生随机）

- `enemies.js` `createCampusZombie` → `HC.buildHumanoid(variant, params)`：
  - **教师**（teacher_m / teacher_f）：`params = {}`（用 bodyRange 默认值，固定一套，不再随机 height/build/curves）
  - **学生**（student_m / student_f）：`params` 传随机值（height/build 在 bodyRange 内随机，保留儿童高矮胖瘦变化）
- `campus_spawner.js`：门刷新丧尸时，教师分支不随机体型（需先查当前随机化逻辑定位改动点）
- bodyRange 保留作工厂滑块范围 + 学生随机范围 + 教师默认值来源

## 工厂 GUI

- 体型滑块（height/build/hunch/curves）保留，四变体仍可拖动预览/调试
- `_applyHumanoidEdit` → `buildHumanoid(variant, params)` 自动选对应新骨架
- 变体切换无需改（MODEL_CONFIGS.humanoid entry 不变）

## 影响范围

| 文件                        | 改动                                                          |
| --------------------------- | ------------------------------------------------------------- |
| `models/humanoid_config.js` | 拆三副骨架常量；buildHumanoid 选骨架；size/肩宽按上表（核心） |
| `models/enemies.js`         | createCampusZombie 教师固定 params、学生随机                  |
| `js/campus_spawner.js`      | 教师分支不随机体型（待查现状）                                |
| 工厂 `model_factory.html`   | 无需改（buildHumanoid 接口不变）                              |

## 测试

1. **工厂比例**：Playwright 切四变体，测 bbox 验证 上身:下身 / 腿长比 / 臂展 达第 2 段目标；迭代调 size 起始值
2. **女教师**：视觉确认 S 曲线（胸/腰/臀、窄肩长腿）
3. **游戏**：campus 地图，教师丧尸比例固定、学生随机；CDP 抓 0 console 错误
4. **回归**：v0.79.4 鞋修复（ah_tc_l 不贴地）仍有效；裤段/裙段不穿模
5. **动画**：四变体 Idle/Walk/Run 等动画无残缺（关节名未变，应无影响）

## 风险

- size 改动可能使 addon（裤/裙/袖口）穿模——WRAP_ADDONS 按派生后肢体半径包裹应自适应，但需视觉验证
- 教师腿加长后裤段（trousers_grey/calf）size 是否需联动调（当前刚修过 calf 不贴地）——迭代测时一并检查
- 女教师 curves 高值下 bust/hips 与躯干/裙的临界重叠——测 Run 极限姿态
