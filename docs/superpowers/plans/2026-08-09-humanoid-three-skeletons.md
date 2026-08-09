# 校园丧尸三副骨架 + 比例重定 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把校园丧尸单一 `HUMANOID_BASE` 拆成学生/男教师/女教师三副独立骨架，按游戏风格化比例重定尺寸（学生保留儿童特征、教师成人化、女教师 S 曲线），全部加长手臂；游戏侧教师固定体型、学生保留随机。

**Architecture:** `humanoid_config.js` 新增三副骨架常量（关节名一字对齐以复用 addon/动画），`buildHumanoid(variant)` 按 variant 选骨架；`enemies.js`/`campus_spawner.js` 教师传固定 params、学生传随机 params。

**Tech Stack:** Three.js r160（浏览器）、Playwright（bbox 比例验证）、Chrome CDP（console 0 错误验证）。

**Spec:** `docs/superpowers/specs/2026-08-09-humanoid-three-skeletons-design.md`

## Global Constraints

- **关节名一字对齐**：三副骨架的节点名必须与现 `HUMANOID_BASE` 完全一致（root/pelvis/torso/neck/head/l_upper_arm/l_forearm/r_upper_arm/r_forearm/l_upper_leg/l_lower_leg/l_foot/r_upper_leg/r_lower_leg/r_foot/l_eye_glow/r_eye_glow）——这是 addon（ADDON_LIBRARY）与动画（REST_POSES/JOINT_NAMES）复用的前提，**不得改名或增删节点**。
- **只改 size + 肩宽 x**：各段 `position`（相对父）与 `pivot` 保持现值不动；仅改 `size` 与上臂/右上臂 `position[0]`（肩宽 x）。如迭代测出堆叠偏差（脚离地/穿模），再局部调对应段 position。
- **CDP 验证**：每个改代码任务结束后，启动服务 + Chrome CDP 抓 console，必须 0 error（CLAUDE.md 规则 6）。
- **文档同步**：涉及功能变更需同步 CLAUDE.md / CODEBUDDY.md / .trae/rules/project_rules.md（CLAUDE.md 规则 8）。本计划在 Task 6 统一做。
- **commit 格式**：`vX.Y.Z: 描述`（CLAUDE.md 规则 3）。版本号同步 8 处（规则 1）——若本次发版，Task 6 用 bump-version skill。
- **不动**：ADDON_LIBRARY、REST_POSES、JOINT_NAMES、deriveNode、WRAP_ADDONS、DUAL_LEG_ADDONS、动画系统、模型工厂 GUI 框架。

## File Structure

| 文件                             | 责任                                     | 本计划改动                          |
| -------------------------------- | ---------------------------------------- | ----------------------------------- |
| `models/humanoid_config.js`      | 骨架常量 + 变体 + buildHumanoid          | 拆三副骨架 + 选骨架映射（Task 1-4） |
| `models/enemies.js`              | 游戏丧尸构建 createCampusZombie          | 教师固定/学生随机 params（Task 5）  |
| `js/campus_spawner.js`           | 校园丧尸门刷新                           | 教师分支不随机体型（Task 5）        |
| `docs/superpowers/plans/pw_*.js` | Playwright bbox 验证脚本（临时，不入库） | 各 Task 创建/删除                   |

三副骨架在同一文件 `humanoid_config.js` 内（跟随现有 HUMANOID_BASE 位置），不拆文件——它们结构同构、改在一起便于对比，且 buildHumanoid/deriveNode 共用。

---

### Task 1: 拆三副骨架常量 + buildHumanoid 选骨架映射

**Files:**

- Modify: `models/humanoid_config.js`（HUMANOID_BASE 定义处 ~6-167；buildHumanoid ~742-757）

**Interfaces:**

- Produces: `STUDENT_BASE` / `TEACHER_M_BASE` / `TEACHER_F_BASE` 三个骨架常量；`SKELETON_BY_VARIANT` 映射表；`buildHumanoid(variantKey, params)` 用映射选骨架（签名不变，外部无感）

- [ ] **Step 1: 复制 HUMANOID_BASE 为三副，建立映射**

在 `humanoid_config.js` 现有 `HUMANOID_BASE` 定义**之后**（~167 行后），把 `HUMANOID_BASE` 深拷贝三份命名为 `STUDENT_BASE` / `TEACHER_M_BASE` / `TEACHER_F_BASE`（结构完全相同——节点名、position、pivot、rotation 一字不改，仅 size 数值后续 Task 改）。三份用 `JSON.parse(JSON.stringify(HUMANOID_BASE))` 派生，确保结构一致：

```js
// 三副骨架：关节名/结构一字对齐 HUMANOID_BASE，仅 size 与肩宽按变体分化（Task 2-4 调）
const STUDENT_BASE = JSON.parse(JSON.stringify(HUMANOID_BASE));
const TEACHER_M_BASE = JSON.parse(JSON.stringify(HUMANOID_BASE));
const TEACHER_F_BASE = JSON.parse(JSON.stringify(HUMANOID_BASE));
const SKELETON_BY_VARIANT = {
  student_m: STUDENT_BASE,
  student_f: STUDENT_BASE,
  teacher_m: TEACHER_M_BASE,
  teacher_f: TEACHER_F_BASE,
};
```

- [ ] **Step 2: buildHumanoid 按 variant 选骨架**

`buildHumanoid`（~757 行）当前 `const tree = deriveNode(HUMANOID_BASE, p, variant);`，改为：

```js
var base = SKELETON_BY_VARIANT[variantKey] || HUMANOID_BASE;
const tree = deriveNode(base, p, variant);
```

- [ ] **Step 3: Playwright 验证四变体仍可构建（无报错 + mesh 数不变）**

写临时脚本 `docs/superpowers/plans/pw_t1.js`：启动工厂、切每个变体、reload、`window.modelRoot` 遍历统计 isMesh 数。预期：四变体 mesh 数与改前一致（student_m/f、teacher_m/f 各自相同；结构未变只是 size 暂时同）。

```js
// pw_t1.js 核心片段（切变体用 selectOption label，参考已验证的 __m/__v 标记法）
// 切 humanoid 后，遍历 select 找含 '丧尸' 的 option 标 id='__m'，selectOption({label:'🧟 校园丧尸'})
// 再遍历 select 找变体（含 '学生'/'教师'）标 id='__v'，selectOption 对应变体
// evaluate: root.traverse 统计 isMesh，打印 mesh 数 + ah_tc_l 是否存在（确认结构）
```

Run: `node docs/superpowers/plans/pw_t1.js`
Expected: 四变体 mesh 数稳定，无 console error，ah_tc_l/ah_sh_l 等关键 addon 仍在。

- [ ] **Step 4: CDP 验证工厂 0 错误**

工厂页 reload，CDP 抓 console。Expected: 0 error。

- [ ] **Step 5: 删除临时脚本 + commit**

```bash
rm docs/superpowers/plans/pw_t1.js
git add models/humanoid_config.js
git commit -m "refactor: 拆三副人形骨架(STUDENT/TEACHER_M/TEACHER_F_BASE) + buildHumanoid 选骨架映射"
```

---

### Task 2: STUDENT_BASE 比例（儿童特征保留 + 手臂加长）

**Files:**

- Modify: `models/humanoid_config.js`（STUDENT_BASE 各 size）
- Test: `docs/superpowers/plans/pw_t2.js`（临时）

**Interfaces:**

- Consumes: Task 1 的 STUDENT_BASE
- Produces: STUDENT_BASE 各段 size 定稿

**比例目标**（spec 第 2 段）：上身:下身 1.25，臂展/身高 0.95，腿/身高 0.42，头 1/6。

- [ ] **Step 1: 改 STUDENT_BASE 各 size（学生起始值）**

按 spec size 表改 STUDENT_BASE（`JSON.parse` 派生后，直接改对应节点的 size）。逐节点定位（用 getObjectByName 思路在源码里找）：

| 节点                                                              | size 改为（学生）  | （当前值）                       |
| ----------------------------------------------------------------- | ------------------ | -------------------------------- |
| head                                                              | [0.20]             | [0.20]（不变）                   |
| neck                                                              | [0.13, 0.13, 0.13] | [0.12,0.15,0.12]（高 0.15→0.13） |
| torso                                                             | [0.6, 0.70, 0.38]  | [0.6,0.75,0.38]（高 0.75→0.70）  |
| pelvis                                                            | [0.5, 0.30, 0.4]   | [0.5,0.35,0.4]（高 0.35→0.30）   |
| l_upper_arm / r_upper_arm                                         | [0.1, 0.52, 0.1]   | [0.1,0.45,0.1]（高 0.45→0.52）   |
| l_forearm / r_forearm                                             | [0.08, 0.48, 0.08] | [0.08,0.42,0.08]（高 0.42→0.48） |
| l_upper_leg / r_upper_leg                                         | [0.12, 0.48, 0.12] | [0.12,0.45,0.12]（高→0.48）      |
| l_lower_leg / r_lower_leg                                         | [0.1, 0.45, 0.1]   | [0.1,0.42,0.1]（高→0.45）        |
| 肩宽：l_upper_arm.position[0]=−0.30，r_upper_arm.position[0]=0.30 | 不变               |

学生 size 改动小（主要是臂加长 + 躯干/骨盆略缩），保留儿童上身长。

- [ ] **Step 2: Playwright 测学生 bbox，验证比例**

`pw_t2.js`：切 student_m，测 bbox（脚底、膝、骨盆、头顶、肩、指尖），算 上身:下身、臂展/身高。

```js
// 测 worldPosition（原点，不递归）：
// 下身 = pelvis.worldY - foot底；上身 = head顶 - pelvis.worldY
// 臂展 ≈ |l_forearm指尖.x - r_forearm指尖.x|（或 2×|upper_arm.x|+臂长近似）
// 目标：上身:下身≈1.25，臂展/身高≈0.95
```

Run: `node pw_t2.js`。若比例偏差>10%，回调 size（腿/臂±0.03）重测，迭代。

- [ ] **Step 3: CDP 0 错误 + 视觉确认学生仍是儿童感**

工厂切 student_m，CDP 0 error；视觉（截图 C:/temp/student_m.png）：上身长腿短、头大，仍像儿童，但手臂不再过短。

- [ ] **Step 4: 同样改 student_f（共享 STUDENT_BASE，已覆盖）+ commit**

student_m/f 共享 STUDENT_BASE，Step 1 已覆盖两者。验证 student_f 同样比例。

```bash
rm docs/superpowers/plans/pw_t2.js
git add models/humanoid_config.js
git commit -m "feat: STUDENT_BASE 比例重定(儿童特征保留+手臂加长,臂展/身高0.95)"
```

---

### Task 3: TEACHER_M_BASE 比例（成人男性挺拔）

**Files:**

- Modify: `models/humanoid_config.js`（TEACHER_M_BASE 各 size）
- Test: `pw_t3.js`（临时）

**Interfaces:**

- Consumes: Task 1 的 TEACHER_M_BASE
- Produces: TEACHER_M_BASE 定稿

**比例目标**：上身:下身 1.05，腿/身高 0.48，臂展/身高 1.0，头 1/7，肩宽（宽）。

- [ ] **Step 1: 改 TEACHER_M_BASE size（成人男起始值）**

| 节点                                                         | size 改为（男教师） | （当前）             |
| ------------------------------------------------------------ | ------------------- | -------------------- |
| head                                                         | [0.17]              | [0.20]（缩，1/7）    |
| neck                                                         | [0.13, 0.13, 0.13]  | 高 0.15→0.13         |
| torso                                                        | [0.6, 0.65, 0.38]   | 高 0.75→0.65（缩短） |
| pelvis                                                       | [0.5, 0.32, 0.4]    | 高 0.35→0.32         |
| l/r_upper_arm                                                | [0.1, 0.55, 0.1]    | 高 0.45→0.55         |
| l/r_forearm                                                  | [0.08, 0.50, 0.08]  | 高 0.42→0.50         |
| l/r_upper_leg                                                | [0.12, 0.60, 0.12]  | 高 0.45→0.60（长腿） |
| l/r_lower_leg                                                | [0.1, 0.55, 0.1]    | 高 0.42→0.55（长腿） |
| 肩宽：upper_arm.position[0] = ±0.36（l 为 −0.36，r 为 0.36） | ±0.30→±0.36         |

- [ ] **Step 2: Playwright 测男教师 bbox + 迭代**

`pw_t3.js`：切 teacher_m，测比例。目标 上身:下身≈1.05，腿/身高≈0.48，臂展/身高≈1.0。偏差>10% 调 size 重测。

- [ ] **Step 3: 裤段回归（重点）**

男教师腿大幅加长，v0.79.4 刚修的 ah_tc_l（小腿裤段 size[0.18,0.42,0.22] position[0,0,0]）可能不再贴合。测 ah_tc_l bbox：底端应 > 鞋底（不贴地），盖小腿。若贴地或悬空，调 ah_tc_l/ah_tr_l 的 size[1]（按新小腿/大腿长 0.55/0.60 同步，如 calf size[1] 0.42→0.55，trousers 0.48→0.60）——但注意 ADDON_LIBRARY 是共享的，改了影响所有变体；**若裤段需分化**，在 buildHumanoid 装 addon 时按 variant 覆盖 size（或接受裤段按最长腿设计、学生裤段略长可接受）。

- [ ] **Step 4: CDP 0 错误 + 视觉（C:/temp/teacher_m.png）+ commit**

```bash
rm docs/superpowers/plans/pw_t3.js
git add models/humanoid_config.js
git commit -m "feat: TEACHER_M_BASE 比例重定(成人男性,腿加长挺拔,臂展=身高,肩宽)"
```

---

### Task 4: TEACHER_F_BASE 比例 + S 曲线（成人女性）

**Files:**

- Modify: `models/humanoid_config.js`（TEACHER_F_BASE 各 size）
- Test: `pw_t4.js`（临时）

**Interfaces:**

- Consumes: Task 1 的 TEACHER_F_BASE；现有 bust/hips addon + curves
- Produces: TEACHER_F_BASE 定稿（女性化骨架）

**比例目标**：上身:下身 1.0，腿/身高 0.50（最长腿），臂展/身高 1.0，头 1/7.5，肩窄、腰细（S 曲线由骨架 + curves + bust/hips 共同实现）。

- [ ] **Step 1: 改 TEACHER_F_BASE size（成人女起始值）**

| 节点                                | size 改为（女教师）  | （当前）                          |
| ----------------------------------- | -------------------- | --------------------------------- |
| head                                | [0.16]               | [0.20]（最小，1/7.5）             |
| neck                                | [0.12, 0.12, 0.12]   | 高 0.15→0.12                      |
| torso                               | [0.6, 0.60, 0.38]    | 高 0.75→0.60（最短，腰位上移）    |
| pelvis                              | [0.5, 0.30, 0.4]     | 高 0.35→0.30                      |
| l/r_upper_arm                       | [0.09, 0.52, 0.09]   | 高 0.45→0.52（细，半径 0.1→0.09） |
| l/r_forearm                         | [0.075, 0.47, 0.075] | 高 0.42→0.47（细，0.08→0.075）    |
| l/r_upper_leg                       | [0.11, 0.62, 0.11]   | 高 0.45→0.62（最长腿）            |
| l/r_lower_leg                       | [0.095, 0.57, 0.095] | 高 0.42→0.57（最长腿）            |
| 肩宽：upper_arm.position[0] = ±0.28 | ±0.30→±0.28（窄肩）  |

- [ ] **Step 2: Playwright 测女教师 bbox + 迭代**

`pw_t4.js`：切 teacher_f，测比例。目标 上身:下身≈1.0，腿/身高≈0.50。迭代调 size。

- [ ] **Step 3: S 曲线视觉验证（curves 默认取 bodyRange [0.6,0.9] 中值 0.75）**

工厂 teacher_f，设 curves=0.75（\_humanoidEdit.params.curves），截图 C:/temp/teacher_f.png。确认：

- bust（胸 Sphere）饱满、hips（后侧扁椭球）翘，curves 放大生效
- torso 收腰（size[0]×(1−0.75×0.15)）
- 窄肩（±0.28）+ 长腿（ skirt_grey 膝下中长裙露出长腿）
- Run 极限姿态（动画展台 Run）下裙摆与大腿无穿模（余量检查）

- [ ] **Step 4: CDP 0 错误 + commit**

```bash
rm docs/superpowers/plans/pw_t4.js
git add models/humanoid_config.js
git commit -m "feat: TEACHER_F_BASE 比例重定(成人女性S曲线,长腿窄肩收腰,小头)"
```

---

### Task 5: 游戏侧接入（教师固定 / 学生随机）

**Files:**

- Modify: `models/enemies.js`（createCampusZombie ~1500-1530）
- Modify: `js/campus_spawner.js`（待查随机化逻辑）

**Interfaces:**

- Consumes: Task 1-4 的三副骨架（buildHumanoid 接口不变）
- Produces: 游戏丧尸教师固定体型、学生随机

- [ ] **Step 1: 查 enemies.js createCampusZombie 当前如何传 params**

读 `enemies.js:1500-1530`，定位 `HC.buildHumanoid(variant, params)` 的 params 来源（是否随机 height/build/curves）。

- [ ] **Step 2: 查 campus_spawner.js 是否额外随机化体型**

Grep `campus_spawner.js` 的 buildHumanoid / height / build / 随机逻辑，确认体型参数在 spawner 还是 enemies.js 注入。

- [ ] **Step 3: 改教师固定、学生随机**

在 createCampusZombie（或 params 组装处）：

```js
// 教师固定一套（用 bodyRange 默认，不随机）；学生随机（保留儿童高矮胖瘦变化）
var isTeacher = variant === 'teacher_m' || variant === 'teacher_f';
var params = {};
if (!isTeacher) {
  var vr = HC.HUMANOID_VARIANTS[variant].bodyRange;
  // 学生：height/build 在 bodyRange 内随机
  params.height = vr.height ? rand(vr.height[0], vr.height[1]) : undefined;
  if (vr.build) params.build = rand(vr.build[0], vr.build[1]);
  // hunch 等同理
}
// 教师 params={} → buildHumanoid 用 bodyRange[0] 默认（固定）
var config = HC.buildHumanoid(variant, params);
```

`rand(a,b)` 用项目现有随机（或 `a + Math.random()*(b-a)`）。同步 campus_spawner 若有独立随机分支。

- [ ] **Step 4: Playwright/CDP 游戏验证**

启动游戏 → campus 地图。CDP 抓 console 0 error。多次刷新/重生，观察：

- 教师（teacher_m/f）丧尸每次体型一致（固定）
- 学生丧尸高矮胖瘦有变化（随机）

- [ ] **Step 5: commit**

```bash
git add models/enemies.js js/campus_spawner.js
git commit -m "feat: 游戏丧尸体型——教师固定一套,学生保留随机"
```

---

### Task 6: 回归 + 文档同步 + 版本（收尾）

**Files:**

- Modify: `CLAUDE.md` / `CODEBUDDY.md` / `.trae/rules/project_rules.md`
- Modify: `index.html` / `README.md`（若发版，bump-version）
- Verify: 全四变体 + 游戏

- [ ] **Step 1: 全回归 Playwright**

写 `pw_t6.js`：四变体各自测 bbox 比例达标 + ah_tc_l 不贴地（v0.79.4 鞋修复回归）+ 关节 mesh 齐全（动画无残缺）。

- [ ] **Step 2: CDP 三图 0 错误**

工厂 + 游戏（campus）+ 训练场（若涉及丧尸），各抓 console，0 error。

- [ ] **Step 3: 文档同步**

CLAUDE.md / CODEBUDDY.md / .trae/rules/project_rules.md：记录「校园丧尸三副骨架（STUDENT/TEACHER_M/TEACHER_F_BASE）+ 比例重定 + 教师固定/学生随机」。更新文件结构段行数（humanoid_config.js）。

- [ ] **Step 4: 版本号（若用户要发版）**

用 `bump-version` skill 同步 8 处版本号（v0.79.5 或用户指定）。

- [ ] **Step 5: 清理临时脚本 + 最终 commit**

```bash
rm -f docs/superpowers/plans/pw_t*.js
git add CLAUDE.md CODEBUDDY.md .trae/rules/project_rules.md models/humanoid_config.js
git commit -m "v0.79.5: 校园丧尸三副骨架+比例重定(学生儿童/男教师成人/女教师S曲线,臂加长,教师固定)"
```

---

## Self-Review

**1. Spec 覆盖**：

- 三副独立骨架 → Task 1 ✓
- 学生儿童比例 + 臂加长 → Task 2 ✓
- 男教师成人比例 + 肩宽 → Task 3 ✓
- 女教师 S 曲线 + 窄肩长腿 → Task 4 ✓
- 游戏教师固定/学生随机 → Task 5 ✓
- 手臂全部加长 → Task 2/3/4 各自上臂/前臂 size ✓
- 工厂 GUI 保留 → 无需改（buildHumanoid 接口不变，Task 1 Step2 说明）✓
- 测试（工厂 bbox + 游戏 CDP + 回归）→ Task 2-6 ✓

**2. 占位扫描**：无 TBD/TODO；size 都是具体数值；pw 脚本给核心片段 + 参考已验证的 selectOption 标记法（pw_dye\* 系列，已清理但模式记录在 spec/上下文）。

**3. 类型一致**：`SKELETON_BY_VARIANT`、`STUDENT_BASE` 等命名前后一致；buildHumanoid 签名不变；`HC.HUMANOID_VARIANTS[variant].bodyRange` 与现有定义一致（Task 5 用到）。

**风险点（已在 Task 内处理）**：

- 裤段回归（Task 3 Step 3）：腿加长后 ah_tc_l 可能不贴合，给了处理方向。
- ADDON_LIBRARY 共享 vs 裤段分化（Task 3 Step 3）：若需分化，按 variant 覆盖 size。
- 女教师 Run 穿模（Task 4 Step 3）：极限姿态检查。
