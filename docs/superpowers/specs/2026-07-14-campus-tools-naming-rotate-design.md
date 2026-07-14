# 校园工具：地图旋转对齐 + 命名功能 + B7 拆分 设计

**日期**: 2026-07-14
**状态**: 设计已确认（B7 方案 A），待写实现计划
**涉及地图**: 金福园小学 `maps/campus.map.json`

## 1. 背景与现状

金福园小学地图（v0.67.0 引入）有一组 2D canvas 工具页面服务于它，均 `fetch('../maps/campus.map.json')` 渲染俯视图：

| 工具                              | 用途                           | 当前朝向                        |
| --------------------------------- | ------------------------------ | ------------------------------- |
| `tools/building_edge_marker.html` | 标记建筑墙面 外廊(红)/空调(蓝) | ❌ 上南左西（未对齐）           |
| `tools/track_zone_marker.html`    | 跑道/区域打点                  | ❌ 上南左西（未对齐）           |
| `tools/b7_builder.html`           | 设计 B7 双栋拱顶参数           | ✅ 上北右西（已对齐，参考实现） |
| `map_bounds_tool.html`            | OSM 卫星图采集（Leaflet）      | 北朝上（本就正确，不动）        |

**上帝模式朝向**（`engine.js:7939`）：相机 `(0, 1.3·maxExt, -0.5·maxExt)`，`lookAt(0,0,0)`，`up=(0,1,0)`。推算屏幕方位 = **上北、下南、左东、右西**（即"上北右西"，CLAUDE.md 所述"x 取反"）。

**B7 现状**：`campus.map.json` 数据层只有单条 footprint（6 顶点多边形，`type:gym, roofType:dome, height:8, name:"双栋拱顶"`）。但渲染层 `obstacles.js:671-674` 硬编码 `_b7blds` 两栋参数（运动场 `vaultH=10/archRatio=0.45`、车棚 `vaultH=5/archRatio=0.6`），渲染成两个不同形状高度的拱顶 mesh。参数**未落盘**，是上次从 `b7_builder` 手动复制的硬编码。`b7_builder` 导出格式为 `{b7_buildings:[{name,cx,cz,w,d,ry,vaultH,archRatio}, ...]}`。

## 2. 需求

1. **旋转**：所有服务于校园地图的工具页面，地图朝向对齐上帝模式（上北/下南/左东/右西）。
2. **命名**：在 `building_edge_marker` 中实现对建筑和运动场的命名功能。
3. **B7 拆分**：原 B7 拆分为两栋建筑（室内运动场 / 车棚），分别命名。

## 3. 设计

### 3.1 旋转对齐（需求一）

把 `building_edge_marker` 与 `track_zone_marker` 的投影改为 `b7_builder` 同款（已验证的参考实现）：

```js
// 中心式投影（两轴取反 = 180°旋转 = 对齐上帝模式）
function fitView() {
  // 算世界包围盒中心 mcx/mcz、canvas 中心 ccx/ccy、scale sc
  mcx = (mx + Mx) / 2;
  mcz = (mz + Mz) / 2;
  ccx = cw / 2;
  ccy = ch / 2;
  sc = Math.min(cw / w, ch / h);
}
function w2c(wx, wz) {
  return { x: ccx - (wx - mcx) * sc, y: ccy - (wz - mcz) * sc };
}
function c2w(sx, sy) {
  return { x: mcx - (sx - ccx) / sc, z: mcz - (sy - ccy) / sc };
}
```

- 替换原 `viewX/viewZ` 偏移式投影；`drawPoly`/`findEdge` 等所有用 `w2c`/`c2w` 处自动跟随。
- `b7_builder` 不动（已对齐）。`map_bounds_tool` 不动（Leaflet）。

### 3.2 命名功能（需求二，`building_edge_marker`）

**可命名实体**：

- `footprintBuildings` 中 `roofType!=='dome'` 的（B1~B6，6 栋）—— 点建筑面命名
- `b7_buildings`（2 栋：室内运动场 / 车棚）—— 点矩形面命名（见 3.3）
- `grounds`（10 个运动场，`kind:pitch`）—— 点场地命名

**B7 原 footprint（`roofType==='dome'`）**：在命名工具中**跳过命名**（它是两栋的占地合集底面），其 `name` 字段清空（不再显示"双栋拱顶"）。命名落到 `b7_buildings` 两栋。

**交互**：新增"命名模式"（N 键切换），与现有外廊(R)/空调(B)标记模式并列。命名模式下点实体面（而非边缘）→ 弹出输入框 → 回显已有 name → 确认保存。已有 name 实时显示在图上各实体中心。

**模式切换**：外廊/空调/命名三模式互斥，顶部 mode-indicator 显示当前模式；标记模式的边缘点击逻辑仅在标记模式生效，命名模式点击走"面拾取"。

### 3.3 B7 拆分（需求三，方案 A）

**数据结构**：`campus.map.json` 新增顶层 `b7_buildings` 数组，两条各含 `{name, cx, cz, w, d, ry, vaultH, archRatio}`：

```json
"b7_buildings": [
  { "name": "室内运动场", "cx": 32.5, "cz": 31.3, "w": 38.3, "d": 22.6, "ry": -1.326, "vaultH": 10, "archRatio": 0.45 },
  { "name": "车棚",       "cx": 47.7, "cz": 46.0, "w": 14.0, "d": 16.8, "ry": 0.244,  "vaultH": 5,  "archRatio": 0.6 }
]
```

（参数取自当前 `obstacles.js:671` 硬编码 + `b7_builder` resetDefault，确保零视觉回归。）

**渲染数据驱动**：`obstacles.js` 加载 campus 数据时，把 `campus.b7_buildings` 存入模块级变量 `_campusB7Buildings`。dome 渲染分支（`obstacles.js:671`）的 `_b7blds` 改为：

```js
var _b7blds =
  _campusB7Buildings && _campusB7Buildings.length
    ? _campusB7Buildings
    : [
        { cx: 32.5, cz: 31.3, w: 38.3, d: 22.6, ry: -1.326, vaultH: 10, archRatio: 0.45 },
        { cx: 47.7, cz: 46, w: 14, d: 16.8, ry: 0.244, vaultH: 5, archRatio: 0.6 },
      ]; // fallback=当前硬编码
```

数据通道：`_campusB7Buildings` 在 campus 加载入口（`createFootprintBuildings` 调用前）从 `campusData.b7_buildings` 赋值；缺失时 fallback 保证渲染不崩。B7 footprint（`roofType==='dome'`）仅作触发 dome 分支的标志，不携带两栋数据。

**碰撞不变**：B7 原多边形 footprint 保留在 `footprintBuildings`（仍作碰撞底面/占地），仅 `name` 清空。`b7_buildings` 两栋的拱顶 mesh 已 `push` 进 `obstacleMeshes`（炮弹 Raycaster 命中），保持现状。

**b7_builder 改造**：启动时从 `campus.b7_buildings` 加载初值（而非固定 resetDefault）；"导出JSON"按钮旁加"💾 保存到地图"，调 `/api/solidify` 写回 `b7_buildings`。

### 3.4 持久化（`server.py` `/api/solidify` 扩展）

新增 `type:'campus'` 分支。请求体：

```json
{
  "type": "campus",
  "names": { "buildings": {"0":"教学楼A", ...}, "grounds": {"0":"篮球场", ...}, "b7": {"0":"室内运动场","1":"车棚"} },
  "b7_buildings": [ ... ]   // 可选，b7_builder 保存时传
}
```

服务端读取 `maps/campus.map.json`，按索引更新 `footprintBuildings[i].name`（跳过 dome 的 B7）、`grounds[i].name`、`b7_buildings[i].name`，整体写回（保持格式缩进）。括号匹配/字段定位策略沿用现有 solidify 实现。

## 4. 数据格式变更与消费者同步

**新增字段**：`campus.b7_buildings`（顶层数组）；`footprintBuildings[].name` 与 `grounds[].name` 已有字段，仅写入值。

**消费者同步清单**（改格式必须同步所有读取端）：

| 文件                              | 同步内容                                                   |
| --------------------------------- | ---------------------------------------------------------- |
| `js/obstacles.js`                 | dome 分支读 `b7_buildings` 渲染两栋（数据驱动 + fallback） |
| `tools/building_edge_marker.html` | 加载并显示/命名 `b7_buildings` 两栋                        |
| `tools/track_zone_marker.html`    | 仅旋转，不读 `b7_buildings`（无需同步）                    |
| `tools/b7_builder.html`           | 从 `campus.b7_buildings` 加载初值 + 一键保存               |
| `tools/build_campus_map.js`       | 生成端：导出时写入 `b7_buildings`（可选，初版可手动填）    |

## 5. 改动文件清单

| 文件                              | 改动                                                       |
| --------------------------------- | ---------------------------------------------------------- |
| `tools/building_edge_marker.html` | 旋转（照搬 b7_builder 投影）+ 命名模式 + 面拾取 + 保存接口 |
| `tools/track_zone_marker.html`    | 旋转（照搬 b7_builder 投影）                               |
| `tools/b7_builder.html`           | 从数据加载初值 + 保存到地图（旋转已 OK）                   |
| `js/obstacles.js`                 | dome 分支 `_b7blds` 数据驱动（方案 A）                     |
| `server.py`                       | `/api/solidify` 加 `type:'campus'` 分支                    |
| `maps/campus.map.json`            | 写入 names + `b7_buildings`（B7 footprint name 清空）      |

## 6. 验证

1. **旋转**：三个 canvas 工具页面与游戏上帝模式（F4）朝向一致（上北右西）。对比建筑相对位置。
2. **命名**：命名各实体 → Ctrl+F5 重载 → names 仍在（落盘成功）；游戏内/工具内显示正确。
3. **B7 零回归**：游戏内 B7 两栋拱顶形状/高度/位置与改动前一致（截图对比）；碰撞正常。
4. **CDP**：各工具页面 + 游戏页 0 控制台错误。

## 7. 风险与回退

- **风险**：`b7_buildings` 字段缺失时渲染崩溃 → fallback 到硬编码默认值兜底。
- **风险**：旋转后历史标记（外廊/空调 marks）坐标系变化 → marks 仅存内存/剪贴板导出，无持久化历史，无影响。
- **回退**：所有改动可按文件 revert；`campus.map.json` 改动前 git 可恢复。
