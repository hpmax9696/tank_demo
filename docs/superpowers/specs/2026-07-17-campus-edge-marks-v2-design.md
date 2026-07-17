# 校园外廊/空调标记系统 v2 调整设计

- 日期: 2026-07-17
- 状态: 待审阅
- 基于: v0.68.0(commit 5eedb95)+ spec `docs/superpowers/specs/2026-07-15-campus-edge-marks-design.md`
- 相关: `js/obstacles.js`、`tools/building_edge_marker.html`、`server.py`、`maps/campus.map.json`

## 1. 背景

v0.68.0 实装校园外廊/空调标记系统(edgeMarks + 覆盖语义 + 渲染端天桥楼层裁剪 + fallback 自动推断)。用户实测后发现 3 个问题:

1. **工具房(B1,平房)被加了外廊/空调**:它无 `edgeMarks` → 走 fallback 自动推断(`innerScore` 几何),被加了不合理的外廊/空调
2. **天桥避让过粗**:贴天桥的边(B3/B5/B6)第三层(天桥层)**整层跳过**栏杆,但天桥只占该边的**连接子段**,其余部分应仍有外廊
3. **室内运动场(B7 拱顶)无空调**:B7 dome 跳过 `edgeMarks`,但真实校园它有一面墙挂空调外机

## 2. 决策(已与用户确认)

| 需求       | 决策                                                                                        |
| ---------- | ------------------------------------------------------------------------------------------- |
| 工具房禁用 | **纯覆盖模式**:弃 fallback,无 `edgeMarks` 的楼不画(删 fallback 分支 + dead code)            |
| 天桥子段   | **子段级裁剪**:天桥层只裁连接子段,其余段画外廊(方案 A:横杆分段,避免穿天桥 box)              |
| B7 空调    | **工具标 b7 边**:`b7_buildings` 加 `edgeMarks`,工具支持标,渲染拱顶墙面挂空调(只空调,无外廊) |

## 3. 需求 1:纯覆盖模式

### 改动 `obstacles.js` 外廊/空调分支

```js
if (fp.roofType !== 'dome') {
  var _marks = fp.edgeMarks;
  if (_marks && _marks.length) {
    // 覆盖模式:画标记边(含天桥子段裁剪, 见 §4)
    for (var _mi = 0; _mi < _marks.length; _mi++) { ... }
  }
  // 无 edgeMarks → 不画(弃 fallback)
}
```

### 清理 dead code(纯覆盖下无用)

- 删 `courtyardX/courtyardZ` 内院中心计算(现 `:579-603`)
- 删 `edges` 数组构建 + `innerScore`(现 `:612-712` 的 for 循环 push)
- 删 fallback 分支(`innerEdges`/`outerEdges` filter + 调用,现 `:815-873` 的 else 块)
- **保留**:`edgeByFootprintIdx`(标记边重算)、`edgeBridgeOverlaps`(§4 升级)、`addCorridorToEdge`/`addACToEdge`(§4 子段裁剪)、`_pointSegDist2D`、`_inSkipRanges`

### 影响

- 工具房(无 `edgeMarks`)→ 不画 ✓
- 已标记 5 栋(B2-B6)→ 照常画标记边(覆盖)
- map01a(无 `footprintBuildings`)→ 不受影响 ✓

## 4. 需求 2:天桥子段级裁剪

### `edgeBridgeOverlaps` 升级

返回 `[{yRange:[y0,y1], segRange:[t1,t2]}]`:

- `yRange`:天桥局部 Y 区间(世界 `[floorY, floorY+thickness]` 减 `stiltY`)
- `segRange`:建筑边上天桥连接子段的参数区间 `[t1,t2]`(t∈[0,1] 沿建筑边 a→b)

### 连接子段算法

对建筑边 a→b,遍历天桥 footprint 每条边 c→d:

1. 建筑边方向 `u=(b-a)/|b-a|`
2. **共线判定**:天桥边方向与 u 平行(`|dot|>0.995`)+ 两边距离 `<0.3`
3. 共线则:算 c、d 在建筑边上的投影参数 `tc=((c-a)·u)/|b-a|`、`td=((d-a)·u)/|b-a|`
4. 重叠区间 `[max(0, min(tc,td)), min(1, max(tc,td))]`,有效(起<止)→ 收集为 segRange
5. 配 yRange = `[floorY-stiltY, floorY+thickness-stiltY]`

### 几何示例(B5 教学楼 ei=3 边)

- 建筑边:P3=`[-24.95,11.71]` → P0=`[12.77,20.73]`,方向 `(37.72,9.02)`,长 38.8
- 天桥边 `[-24.95,11.71]`→`[-10,15.28]`:方向 `(14.95,3.57)`,与建筑边平行(分量比 2.52≈2.53)
- 投影 t = 14.95/37.72 ≈ **0.40**
- `segRange=[0, 0.40]`(天桥连接段占建筑边前 40%)
- 天桥层(局部 Y∈[3,6],stiltY=3):栏杆 t∈[0,0.4] 跳过,t∈[0.4,1] 画

### `addCorridorToEdge`/`addACToEdge` 子段感知(方案 A)

签名加 `skipSegs`(仅天桥层非空,默认 `[]`)。楼层循环内,若该层中心 Y 落在某 `yRange`,用对应 `segRange=[t1,t2]` 裁剪:

- **柱子循环**:`bi` 的 `t=bi/nBalusters`,若 `t∈[t1,t2]` → 跳过该柱子
- **横杆/挑板分段**:画 `[0,t1]` 一根(长 `edgeLen×t1`,位置 `a + 方向×edgeLen×t1` 的端点)+ `[t2,1]` 一根(长 `edgeLen×(1-t2)`,位置 `a + 方向×edgeLen×t2`)
- 非天桥层:`skipSegs` 空 → 整边画(不变)

> 方案 B(只跳柱子,横杆整边)更简单但横杆穿天桥 box 有视觉瑕疵。选 **A**。

## 5. 需求 3:b7 空调

### 工具 `building_edge_marker.html`

- `findEdge` 扩展:除 `footprintBuildings`,也检测 `b7_buildings` 4 边。b7 矩形 `{cx,cz,w,d,ry}` → 世界 4 角(绕 cx,cz 旋转 ry)→ 4 边。命中返回 `{kind:'b7', bi, ei}`
- `marks` key:`b7-<bi>-<ei>`(与建筑 `bi-ei` 区分)
- `saveEdgeMarks`:收集 b7 的 marks,POST `{type:'campus', edgeMarks:{...}, b7_edgeMarks:{<bi>:[{ei,type}]}}`
- `load`:回填 `b7_buildings[i].edgeMarks` 到 marks
- `draw`:b7 矩形(现 `:303-322` 已画)加边标记渲染(红/蓝线 + 圆点,同建筑)

### 渲染 `obstacles.js` dome 分支(现 `:766+`)

- 读 `b7_buildings[i].edgeMarks`(只 `type:'ac'`,b7 拱顶无外廊)
- 对每个标记 `{ei, type:'ac'}`:
  - 算 b7 局部 ei 边的世界坐标(矩形 4 角 + ry 旋转)
  - 调 `addACToEdge(parent, ax,az,bx,bz, vaultH×(1-archRatio), [], ...)`(墙面高,skipSegs 空)
  - 空调多层(墙面高 / 3),挂墙面外侧

### b7 边索引约定

局部矩形(旋转前)4 角:`(-w/2,-d/2)`、`(w/2,-d/2)`、`(w/2,d/2)`、`(-w/2,d/2)`。`ei=0..3` = 角 i → 角 (i+1)%4 的边。绕 `(cx,cz)` 旋转 ry → 世界坐标。**工具与渲染用同一约定**。

## 6. 数据结构变更

- `campus.obstacles.b7_buildings[i].edgeMarks`:`[{ei, type:'ac'}]`(新增;只空调)
- `campus.obstacles.footprintBuildings[i]`:语义变(**无 `edgeMarks` → 不画**,弃 fallback)。消费者仅 `obstacles.js`
- `server.py solidify_campus`:扩展接收 `b7_edgeMarks` 写回 `b7_buildings[i].edgeMarks`(复用正则内联)

## 7. 改动文件

| 文件                              | 改动                                                                                                                                      |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `js/obstacles.js`                 | 纯覆盖清理(删 fallback + edges/innerScore/courtyard)+ edgeBridgeOverlaps 子段升级 + addCorridorToEdge/addACToEdge 子段裁剪 + b7 dome 空调 |
| `tools/building_edge_marker.html` | findEdge 支持 b7 + saveEdgeMarks 发 b7 + load 回填 b7 + draw b7 边标记                                                                    |
| `server.py`                       | solidify_campus 接收 b7_edgeMarks                                                                                                         |
| `maps/campus.map.json`            | b7 标空调(用户用工具标)                                                                                                                   |

## 8. 验证

- **CDP**:校园 0 控制台错误
- **Playwright**:
  1. 工具房(B1)无外廊/空调 mesh
  2. B5 教学楼 ei=3(外廊,贴天桥):天桥层(局部 Y∈[3,6])t<0.4 **无栏杆**、t>0.4 **有栏杆**;其他层整边栏杆
  3. b7 室内运动场标记边出现空调外机 mesh(多层)
  4. 已标记 5 栋(B2-B6)外廊/空调正常

## 9. 不在范围

- b7 外廊(拱顶无外廊概念,只空调)
- 其他地图的 edgeMarks 推广
- fallback 的其他用途(已确认校园外仅 map01a 普通建筑,不走此路径)
