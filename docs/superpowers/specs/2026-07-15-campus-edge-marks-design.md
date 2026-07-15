# 校园建筑外廊/空调标记系统设计

- 日期: 2026-07-15
- 状态: 待审阅(spec 写完,等用户确认后转 writing-plans)
- 相关: `tools/building_edge_marker.html`、`js/obstacles.js`、`server.py`、`maps/campus.map.json`

## 1. 背景与现状

`building_edge_marker.html` 工具能标记建筑某条边为外廊(红线)或空调(蓝线),但目前是**半成品**:

- 标记只存在内存(`marks`),刷新即丢;"导出 JSON"只输出到剪贴板,"保存命名到地图"只写 `name`,**不写外廊/空调标记**。
- `js/obstacles.js` 的外廊/空调渲染**不读任何标记数据**,而是按几何自动推断:
  - `:579-603` 算"内院中心"= 所有建筑包围盒中心均值
  - `:634` 每条边算 `innerScore` = 边外法线 · (边中心→内院中心方向),`>0` 朝内、`<0` 朝外
  - `:752-769` `innerScore>0.2` 的边按长度取最长 3 条 → 自动加外廊
  - `:770-782` `innerScore<-0.2` 的边 → 自动加空调

`campus.map.json` 的 `footprintBuildings` 也**没有**外廊/空调字段。因此用户在工具里标记的红/蓝线,游戏里看不出任何变化。

## 2. 目标

让工具标记能**写回 `campus.map.json` 并驱动 `obstacles.js` 渲染**,游戏里真正生效。仅限校园地图,不影响其他地图。

## 3. 范围

- 仅校园地图(campus)的 `footprintBuildings` 普通建筑(非 dome)。
- 不涉及:dome 穹顶(B7 体育馆)、b7 双栋(室内运动场/车棚)——拱顶结构,保持现有 `roofType!=='dome'` 跳过。
- 不涉及:其他地图(`map01a` 等)的外廊/空调——它们无此机制,走零回归路径。

## 4. 关键决策(已与用户确认)

| 决策点   | 选择                                             | 理由                                                                                             |
| -------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| 天桥避让 | **渲染端按楼层裁剪**                             | 标记的边照常按层生成,自动跳过天桥 Y 区间(6~9),那段由天桥 box 取代。视觉自然。                    |
| 数据结构 | **方案 A:per-edge 标记** `edgeMarks=[{ei,type}]` | 匹配当前工具 UI(点边即标),改动最小、最直观。                                                     |
| 标记语义 | **覆盖模式**                                     | 有 `edgeMarks` 的楼只画标记的边,其余不画。所见即所得,用户对该楼全权控制。                        |
| 架空层   | 已隐式跳过,无需额外改                            | 渲染已 `wallH=h-_stiltY` + `bldGroup.position.y=_stiltY`,栏杆第 0 层落在 y=`_stiltY`(架空层顶)。 |

## 5. 数据结构

`footprintBuildings[i]` 新增可选字段 `edgeMarks`:

```json
{
  "footprint": [
    [12.77, 20.73],
    [14.96, 11.62],
    [-22.76, 2.6],
    [-24.95, 11.71],
    [12.77, 20.73]
  ],
  "height": 15,
  "name": "教学楼",
  "type": "school",
  "stiltFloor": 1,
  "edgeMarks": [
    { "ei": 0, "type": "corridor" },
    { "ei": 2, "type": "ac" }
  ]
}
```

- `ei`:边索引,语义 = footprint 点对 `fp[ei] → fp[(ei+1) % n]`,与工具 `building_edge_marker.html:236` 完全一致。
- `type`:`'corridor'`(外廊) | `'ac'`(空调),字符串,与工具内部 `marks` 值一致。
- **无 `edgeMarks` 字段 = 走现有 `innerScore` 自动推断**(零回归)。
- **序列化格式**:`edgeMarks` 是对象数组,`json.dumps` 多行输出(正则只压纯数字数组,对象数组保持多行),与现有 `b7_buildings` 一致;`footprint` 等纯数字数组仍被正则压成内联 `[a, b, c]`,文件其余部分不重排。

## 6. 数据流

```
工具标记 marks
  → POST /api/solidify {type:'campus', edgeMarks:{0:[{ei,type},...], 2:[...]}}
  → server.py solidify_campus 写回 footprintBuildings[idx].edgeMarks(正则内联保持坐标格式)
  → 游戏加载 campus.map.json
  → obstacles.js createFootprintBuildings 读 fp.edgeMarks 渲染(扣架空层+天桥层)
```

## 7. 各文件改动

### 7.1 `tools/building_edge_marker.html`

**a. `load()` 回填 marks**(~`:147`):读完 `campus.map.json` 后,从 `blds[i].edgeMarks` 回填内存 `marks`:

```js
for (let bi = 0; bi < blds.length; bi++) {
  const em = blds[bi].edgeMarks || [];
  for (const m of em) marks[bldEdgeKey(bi, m.ei)] = m.type;
}
```

→ 重开工具能看到已有标记。

**b. 新增"💾 保存标记到地图"按钮**(独立于现有"保存命名"按钮):收集 `marks` → 按 bi 分组 → POST `{type:'campus', edgeMarks:{bi:[{ei,type}]}}` → 成功反馈。保留"导出 JSON"作备份,不动现有"保存命名"(职责分离)。

**c. `draw()` 画出天桥 footprint**:遍历 `campusData.obstacles.bridges`,紫色虚线多边形 + 标注"天桥 y=6~9",辅助用户判断哪些边贴天桥(渲染端会自动裁剪那层,工具仅作可视化提示)。

### 7.2 `server.py` `solidify_campus`(`:91-136`)

扩展接收 `edgeMarks`(payload 字段,dict `{idx:[{ei,type}]}`):

- 在现有 `names`/`b7_buildings` 处理后,新增:
  ```python
  for k, v in (payload.get('edgeMarks') or {}).items():
      i = int(k)
      if 0 <= i < len(blds) and blds[i].get('roofType') != 'dome':
          blds[i]['edgeMarks'] = v  # 整体替换该楼的标记列表
  ```
- 复用现有正则内联写回(`:128-135`),保持文件坐标格式不重排。
- **统一语义**:`edgeMarks` 数组非空(`length>=1`)才进覆盖模式;空数组或无字段 → fallback(自动推断)。工具侧保证某楼无标记则不进 payload(不产生空数组),server 收到空数组时跳过该楼(不写 `edgeMarks` 字段),二者一致回落到 fallback。

### 7.3 `js/obstacles.js`(核心,`:605-818` createFootprintBuildings 循环内)

**a. 天桥数据前置可用**:天桥渲染在 `:820-857`,但建筑渲染在 `:605-818`(先于天桥)。需把 `_bridges` 的读取(`:821-822`)提到建筑循环之前,供建筑渲染避让判断用。

**b. ei 鲁棒性**:渲染时读 `fp.edgeMarks`,对每个 `{ei,type}` 用新 helper `edgeByFootprintIdx(footprint, ei)` 直接从 footprint 取 `fp[ei]→fp[(ei+1)%n]` 重算边端点 + 外法线,**不依赖 `edges` 数组下标**(防 footprint 中间退化边导致索引偏移)。

**c. 外廊/空调分支重构**(`:751-782`):

```js
if (fp.roofType !== 'dome') {
  var _marks = fp.edgeMarks;
  if (_marks && _marks.length) {
    // 覆盖模式:只画标记的边,逐层生成跳过天桥层
    for (var _mi = 0; _mi < _marks.length; _mi++) {
      var _mk = _marks[_mi];
      var _e = edgeByFootprintIdx(fp.footprint, _mk.ei);
      if (!_e || _e.len < 2) continue;
      var _skipY = edgeBridgeOverlaps(_e, _bridges); // 该边贴的天桥Y区间数组
      if (_mk.type === 'corridor')
        addCorridorToEdge(bldGroup, _e.ax,_e.az,_e.bx,_e.bz, h-_stiltY, _skipY, _stiltY);
      else if (_mk.type === 'ac')
        addACToEdge(bldGroup, _e.ax,_e.az,_e.bx,_e.bz, h-_stiltY, _skipY, _stiltY);
    }
  } else {
    // fallback:现有 innerScore 自动推断(代码原样保留,零回归)
    var innerEdges = edges.filter(e => e.innerScore > 0.2);
    innerEdges.sort((a,b) => b.len - a.len);
    for (var _ie = 0; _ie < Math.min(innerEdges.length, 3); _ie++) { ... }
    var outerEdges = edges.filter(e => e.innerScore < -0.2);
    for (var _oe = 0; _oe < outerEdges.length; _oe++) { ... }
  }
  bldGroup.position.y = _stiltY;
  bldGroup.rotation.x = -Math.PI / 2;
  ...
}
```

**d. `addCorridorToEdge` / `addACToEdge` 加参数**(`:467` / `:538`):签名改为
`(parent, ax, az, bx, bz, wallH, skipYRanges, stiltY)`,其中 `skipYRanges` = `[[6,9], ...]`、`stiltY` = 架空层高。
楼层循环内,计算该层中心世界 Y `= stiltY + fl*3 + 1.5`,若落在任一 `skipY` 区间 `[y0, y1]` 内(`y0 <= center && center < y1`)→ `continue` 跳过该层。其余逻辑不变。

## 8. 架空层处理(已解决,无需改)

`addCorridorToEdge`/`addACToEdge` 的 `wallH = h - _stiltY`,楼层循环 `fl = 0..floor(wallH/3)-1`,栏杆/空调第 fl 层局部 `floorY = fl*3`;经 `bldGroup.position.y = _stiltY` 后,第 0 层世界 Y = `_stiltY`(架空层顶)。架空层(0~`_stiltY`)那圈本就没有栏杆/空调。架空层柱子(`:676-696`)独立绘制,不冲突。✓

## 9. 天桥避让算法

**输入**:标记边 `e`(端点 ax,az,bx,bz + 外法线 nx,nz + 中心 mx,mz),所有 `bridges`。
**步骤**:

1. 对每个 bridge,遍历其 footprint 的每条边,算建筑边与桥边的**线段-线段 2D 最近距离**。
2. 最近距离 `< 0.8` → 该建筑边"贴"该桥(天桥 footprint 贴建筑边,近似共线)。
3. 收集所有贴上的桥的 Y 区间 `[floorY, floorY+thickness]`(校园 = `[6,9]`),返回 `skipYRanges`。
4. `addCorridorToEdge`/`addACToEdge` 据此跳过对应楼层。

**验证裁剪正确性**:

- 教学楼(stiltY=3):fl 层中心 Y = 4.5 / 7.5 / 10.5 / 13.5 → 7.5 ∈ [6,9] → **fl=1(第 3 层)跳过** ✓
- B3/B6(stiltY=0):fl 层中心 Y = 1.5 / 4.5 / 7.5 / 10.5 / 13.5 → 7.5 ∈ [6,9] → **fl=2 跳过** ✓

效果:贴天桥的边,其他层栏杆照常,只有第 3 层(被天桥 box 占据)不画——视觉上天桥取代那层栏杆,不穿插。

## 10. 标记语义与 fallback

- **覆盖模式**:有 `edgeMarks`(`length>=1`)的楼,只渲染标记的边;没标的边不画外廊/空调。
- **fallback(零回归)**:无 `edgeMarks` 字段或为空 → 现有 `innerScore` 自动推断逻辑完全不变。
- **空数组 `edgeMarks: []`**:等同未标记 → fallback(自动推断兜底)。与渲染端 `if (_marks && _marks.length)` 判断一致;工具不发空数组(某楼无标记则不进 payload)。

## 11. 零回归与验证

**零回归保证**:

- 其他地图(无 `edgeMarks`)→ `obstacles.js` 走 fallback 分支,渲染与改动前逐字节一致。
- 校园未标记的楼 → 同样 fallback。
- `server.py` 新增 `edgeMarks` 处理是增量,不影响现有 `names`/`b7_buildings` 逻辑。

**验证步骤**:

1. **CDP**:加载校园地图,0 控制台错误(用 `cdp-verify` skill 或现有 CDP 流程)。
2. **Playwright 工具闭环**:打开 `building_edge_marker.html` → 给教学楼某边标记外廊 → "保存标记到地图" → 重新加载工具 → 确认标记回填(读 `marks`);读 `campus.map.json` 确认 `edgeMarks` 落盘且 footprint 仍内联格式。
3. **Playwright 游戏渲染**:加载校园 → 查询教学楼 `campus-detail` mesh:标记的边有栏杆 mesh,架空层高度(Y<3)无栏杆,天桥层(中心 Y≈7.5)无栏杆(被裁剪)。
4. **天桥不穿插**:对贴天桥的标记边,确认 y∈[6,9] 区间无栏杆/空调 mesh(不与 bridge box 重叠)。
5. **零回归**:切到 `map01a` 单人地图,确认外廊/空调渲染与改动前一致(走 fallback)。

## 12. 不在本次范围

- 工具楼层级标记 UI(方案 B,校园不需要)。
- 天桥避让的"子段精确裁剪"(天桥只贴边的部分子段时)——本次按"贴则该层整段跳过",天桥 footprint 实际贴建筑整条边,够用。
- 其他地图的外廊/空调机制推广。
