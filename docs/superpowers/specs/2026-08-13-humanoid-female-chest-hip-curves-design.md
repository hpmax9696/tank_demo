# v1-成年女 胸臀曲线（RidgeBox + TaperedBox 底面偏移）设计

日期：2026-08-13

## 背景与目标

给 `v1-成年女-20260810` 骨架（模型工厂「骨架模式」）加女性 S 曲线的两个凸点：

1. **胸**：`torso_upper` 胸前（+z）从平面改成带一条水平脊线的凸面，侧面截面由四边形变五边形，多出的顶点即胸前最凸处。
2. **臀**：`torso_lower` 下端 + `pelvis` 上端的交界边向后（-z）凸出，塑造臀部隆起。

两个凸点都要在模型工厂「选中部件 → 几何体参数」面板里手动可调。

## 现状

`WORKING_SKELETON` 的躯干（`models/humanoid_config.js:1013-1043`）：

| 部件          | 类型       | size                                   | position            |
| ------------- | ---------- | -------------------------------------- | ------------------- |
| `torso_upper` | TaperedBox | `[0.22, 0.29, 0.16, 0.31, 0.2, 0, 0]`  | `[0, 0.299, -0.04]` |
| `torso_lower` | TaperedBox | `[0.3, 0.154, 0.22, 0.22, 0.16, 0, 0]` | `[0, 0.077, -0.04]` |
| `pelvis`      | Box        | `[0.3, 0.135, 0.22]`                   | `[0, 0.375, 0.04]`  |

TaperedBox 参数语义：`[底宽 bw, 高 h, 底深 bd, 顶宽 tw, 顶深 td, 顶面X偏移 ox, 顶面Z偏移 oz]`。

`_deriveProportion`（`humanoid_config.js:1229`）只派生 head/leg/arm/shoulder，不碰 torso，所以四个骨架版本共享同一份 torso。本次改造**只覆盖 v1-成年女**，其他版本（中性/成年男/儿童）保持 TaperedBox 不变。

## 设计

### 1. 胸：新增几何类型 `RidgeBox`

五边形截面棱台。参数在 TaperedBox 基础上加两个：

```
[底宽, 高, 底深, 顶宽, 顶深, 顶面X偏移, 顶面Z偏移, 脊线高度 ridgeY, 脊线凸出 ridgeZ]
```

- **脊线**：胸前（+z）在 `ridgeY` 高度处的一条水平棱（沿 x 轴）。
- **脊线长度 = 截面宽度插值**：`w_ridge = bw + (ridgeY/h)·(tw − bw)`，自动贴合躯干两侧，不加独立宽度参数。
- **脊线 z 坐标** = 前面在 `ridgeY` 高度的线性插值 + `ridgeZ`。
- 侧面（z-y 截面）五边形顶点（逆时针）：背底 → 背顶 → 胸前顶 → **脊线点** → 胸底。左/右侧面各 3 个三角形，共 10 顶点、7 面（底/顶/背/前上/前下/左/右）。

默认值（只给 v1-成年女 的 `torso_upper`）：

```
[0.22, 0.29, 0.16, 0.31, 0.2, 0, 0, 0.20, 0.04]
```

即 `ridgeY=0.20`（偏上靠近锁骨）、`ridgeZ=0.04`（轻微隆起，可调）。

### 2. 臀：TaperedBox 扩展「底面偏移」bx/bz

TaperedBox 现有「顶面偏移 ox/oz」，对称地加「底面偏移 bx/bz」，参数从 7 个扩展到 9 个：

```
[底宽, 高, 底深, 顶宽, 顶深, 顶面X偏移, 顶面Z偏移, 底面X偏移 bx, 底面Z偏移 bz]
```

向后兼容：现有 TaperedBox 只有 7 个参数，`bx/bz` 缺省按 0。

臀部用法（只给 v1-成年女）：

- `torso_lower`（已是 TaperedBox）：`[0.3, 0.154, 0.22, 0.22, 0.16, 0, 0, 0, -0.04]` —— 底面（臀端）`bz=-0.04` 向后凸。
- `pelvis`：Box → TaperedBox（仍是四边形，不算改多边形类型）：`[0.3, 0.135, 0.22, 0.3, 0.22, 0, -0.04, 0, 0]` —— 顶面 `oz=-0.04` 向后凸（下端 bx/bz=0 不动），与 `torso_lower` 底面在交界处对齐。

两处后凸默认 **0.04**，均可在工厂调。

### 3. v1-成年女 派生覆盖

`SKELETON_VERSIONS['v1-成年女-20260810']` 在 `_deriveProportion(...)` 之后，追加一段 `_applyFemaleCurves(tree)`：定位 `torso_upper` / `torso_lower` / `pelvis`，分别改 type 和 size（如上默认值）。不污染 `_deriveProportion` 和共享的 `WORKING_SKELETON`。

### 4. 模型工厂调参面板

`model_factory.html` 的「几何体参数」面板（`else if (configNode.type === 'TaperedBox')` 分支，约 4356 行）已按类型暴露 size 滑块。需补：

- TaperedBox 分支新增「↙ 底面偏移 X/Z」滑块（对称于现有「↗ 顶面偏移」）。
- 新增 `RidgeBox` 分支：底宽/高/底深/顶宽/顶深/顶面偏移 X·Z/脊线高度/脊线凸出 共 9 个滑块。

### 5. 几何构建函数（两处 createGeometry 同步）

`RidgeBox` 和 TaperedBox 底面偏移要在两处 createGeometry 都实现（历史原因，两份独立副本）：

- `models/enemies.js` `buildHumanoidRig` 的 `createGeometry`（`mkTaperedBox`/`mkTaperedHex`/`mkWedge` 附近）
- `model_factory.html` 内联的 `createGeometry`

## 涉及文件

- `models/humanoid_config.js`：RidgeBox 默认值 + `_applyFemaleCurves` + v1-成年女 派生调用
- `model_factory.html`：`createGeometry` 加 RidgeBox case + `mkTaperedBox` 加 bx/bz + 调参面板两个分支
- `models/enemies.js`：`createGeometry` 加 RidgeBox case + `mkTaperedBox` 加 bx/bz（游戏侧同步，保证后续 enemies 消费一致）
- 文档同步：CLAUDE.md / CODEBUDDY.md / .trae/rules/project_rules.md（若涉及版本号则同步）

## 验证

1. 数据层：Node 脚本加载 `humanoid_config.js`，断言 v1-成年女 的 `torso_upper.type === 'RidgeBox'`、`torso_lower.size[8] === -0.04`、`pelvis.type === 'TaperedBox'`；其他版本仍为 TaperedBox/Box。
2. 渲染层：Playwright 切「校园丧尸 → 骨架(共通) → v1-成年女」，用 inspect 读 `torso_upper` mesh 的脊线顶点 z 与两侧顶点 z 差值 ≈ `ridgeZ`，`pelvis`/`torso_lower` 交界边 z 后移 ≈ 0.04。
3. 视觉层：前视图 + 侧视图截图 → `python vision.py` 识图，确认胸有隆起、臀后凸。
4. 可调性：选中 `torso_upper`（RidgeBox）确认出现「脊线高度/脊线凸出」滑块；选中 `torso_lower`（TaperedBox）确认出现「底面偏移」滑块。
5. 控制台 0 错误（CDP）。
