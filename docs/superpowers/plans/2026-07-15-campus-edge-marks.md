# 校园建筑外廊/空调标记系统 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 `building_edge_marker.html` 工具的外廊/空调标记能写回 `campus.map.json` 并驱动 `obstacles.js` 渲染,游戏里真正生效;同时让自动推断(fallback)与标记边都避让天桥。

**Architecture:** `footprintBuildings[i].edgeMarks=[{ei,type}]` per-edge 字段,覆盖语义(有标记只画标记边);渲染端按楼层裁剪避天桥(跳过中心 Y 落在天桥区间 [6,9] 的层);无标记 → fallback 现有 `innerScore` 自动推断(也避天桥);架空层靠 `wallH=h-_stiltY` + `bldGroup.position.y=_stiltY` 隐式跳过。

**Tech Stack:** 原生浏览器 JS + Three.js r160、Python `http.server`(`/api/solidify` 端点)、CDP + Playwright 验证(项目无 JS 单元测试框架,验证靠 CDP 抓控制台错误 + Playwright 实测)。

## Global Constraints

- **范围**:仅校园地图(`maps/campus.map.json`),不影响其他地图;`roofType==='dome'` 穹顶 + b7 双栋跳过。
- **ei 语义**:边索引 = footprint 点对 `fp[ei] → fp[(ei+1)%n]`,与工具 `building_edge_marker.html:236` 一致。
- **覆盖语义**:`edgeMarks` 数组非空(`length>=1`)才覆盖;空/无字段 → fallback。工具不发空数组(某楼无标记则不进 payload)。
- **零回归**:无 `edgeMarks` 的地图/楼 → 走 fallback(`innerScore` 逻辑不变,新增天桥避让是正向修复)。
- **运行**:`python server.py`,访问 `http://127.0.0.1:8080`(必须 127.0.0.1)。
- **验证标准**:每任务 CDP 0 控制台错误(CLAUDE.md 规则6);关键行为 Playwright 实测。
- **版本号**:功能完成后 Task 5 用 `bump-version` skill 同步 8 处(建议 v0.68.0)。
- **数据格式同步**:本计划新增 `campus.obstacles.footprintBuildings[i].edgeMarks` 字段,消费者 = `js/obstacles.js`(渲染)+ `tools/building_edge_marker.html`(回填/保存)+ `server.py`(写回)。符合"改数据格式需同步消费者"。

**Spec 来源**:`docs/superpowers/specs/2026-07-15-campus-edge-marks-design.md`

---

### Task 1: server.py solidify_campus 支持 edgeMarks 写回

**Files:**

- Modify: `server.py:91-136`(`solidify_campus` 函数)

**Interfaces:**

- Consumes:POST `/api/solidify` body `{type:'campus', edgeMarks:{'<idx>':[{ei,type},...]}}`(与现有 `names`/`b7_buildings` 同级 payload 字段)
- Produces:`maps/campus.map.json` 的 `footprintBuildings[idx].edgeMarks` 字段;空数组 → 删除该字段(回落 fallback)

- [ ] **Step 1: 加 edgeMarks 处理代码**

在 `server.py` `solidify_campus` 函数内,`# 整体替换 b7_buildings` 块(`:123-125`)之后、`# 保持原文件内联坐标数组格式`(`:127`)之前,插入:

```python
    # 外廊/空调边标记 edgeMarks (building_edge_marker.html 保存)
    for k, v in (payload.get('edgeMarks') or {}).items():
        i = int(k)
        if 0 <= i < len(blds) and blds[i].get('roofType') != 'dome':
            if v:  # 非空才写(空=未标记→不写字段→渲染 fallback)
                blds[i]['edgeMarks'] = v
            elif 'edgeMarks' in blds[i]:
                del blds[i]['edgeMarks']  # 显式清除标记回 fallback
```

- [ ] **Step 2: 重启 server**

```bash
# 杀残留 python(避免连到旧进程), 再启动单一服务
python server.py
```

确认输出 `Tank Demo 开发服务器: http://127.0.0.1:8080`。

- [ ] **Step 3: Playwright/curl 验证写回**

用 node 跑(项目用 node playwright):POST 一条 edgeMarks,再读地图确认落盘 + footprint 仍内联。

```js
// verify_server.mjs — 临时验证脚本, 用后删
import fs from 'fs';
const body = JSON.stringify({ type: 'campus', edgeMarks: { 4: [{ ei: 0, type: 'corridor' }] } });
const r = await fetch('http://127.0.0.1:8080/api/solidify', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body,
});
console.log('resp:', await r.json());
const m = JSON.parse(fs.readFileSync('maps/campus.map.json', 'utf8'));
const b4 = m.obstacles.footprintBuildings[4];
console.log('B5 edgeMarks:', JSON.stringify(b4.edgeMarks)); // 应为 [{"ei":0,"type":"corridor"}]
console.log('B5 footprint[0]:', JSON.stringify(b4.footprint[0])); // 应内联如 [12.77,20.73] (非多行)
```

Run: `node verify_server.mjs`
Expected:`B5 edgeMarks: [{"ei":0,"type":"corridor"}]`;`B5 footprint[0]: [12.77,20.73]`(内联,非展开多行)。

- [ ] **Step 4: 验证空数组清除**

改 body 为 `edgeMarks: { '4': [] }` 重跑,确认 `B5 edgeMarks: undefined`(字段被删,回落 fallback)。

- [ ] **Step 5: 清理测试数据 + commit**

手动把 `campus.map.json` 的 B5 `edgeMarks` 测试字段删掉(还原),或 POST 空数组清除。然后:

```bash
rm verify_server.mjs
git add server.py
git commit -m "feat(campus): solidify_campus 支持 edgeMarks 写回

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 2: building_edge_marker.html 数据闭环 + 天桥可视化

**Files:**

- Modify: `tools/building_edge_marker.html`(`load()` ~`:147`、按钮区 ~`:123`、`draw()` ~`:322`)

**Interfaces:**

- Consumes:`campus.map.json` 的 `footprintBuildings[i].edgeMarks`、`obstacles.bridges`;`POST /api/solidify`
- Produces:POST `{type:'campus', edgeMarks:{<bi>:[{ei,type}]}}`

- [ ] **Step 1: load() 回填已有 edgeMarks**

在 `load()` 函数(`:147`)内,`fitView();` 之前插入回填逻辑(读 campusData 并填充内存 `marks`):

```js
// 回填已有 edgeMarks
const _blds = campusData.obstacles.footprintBuildings || [];
for (let _bi = 0; _bi < _blds.length; _bi++) {
  const _em = _blds[_bi].edgeMarks || [];
  for (const _m of _em) {
    if (typeof _m.ei === 'number' && (_m.type === 'corridor' || _m.type === 'ac')) {
      marks[bldEdgeKey(_bi, _m.ei)] = _m.type;
    }
  }
}
```

- [ ] **Step 2: 加"保存标记到地图"按钮**

在按钮区(`:123` `导出JSON` 按钮所在区),`<button class="btn btn-green" onclick="exportJSON()">` 之前插入:

```html
<button class="btn btn-green" onclick="saveEdgeMarks()" style="background: #0d7a3a">
  💾 保存标记到地图
</button>
```

- [ ] **Step 3: 加 saveEdgeMarks 函数**

在 `exportJSON()` 函数(`:488`)之前插入:

```js
async function saveEdgeMarks() {
  const blds = campusData.obstacles.footprintBuildings || [];
  const edgeMarks = {};
  for (const key in marks) {
    const parts = key.split('-');
    const bi = parseInt(parts[0], 10);
    const ei = parseInt(parts[1], 10);
    if (blds[bi] && blds[bi].roofType !== 'dome') {
      if (!edgeMarks[bi]) edgeMarks[bi] = [];
      edgeMarks[bi].push({ ei: ei, type: marks[key] });
    }
  }
  try {
    const r = await fetch('/api/solidify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'campus', edgeMarks: edgeMarks }),
    });
    const j = await r.json();
    if (j.ok)
      alert(
        '✅ 标记已保存 (' +
          Object.keys(edgeMarks).length +
          ' 栋楼, ' +
          Object.values(edgeMarks).reduce((s, a) => s + a.length, 0) +
          ' 条边)'
      );
    else alert('保存失败: ' + j.error);
  } catch (e) {
    alert('保存失败: ' + e.message);
  }
}
```

- [ ] **Step 4: draw() 画出天桥 footprint(紫色虚线提示)**

在 `draw()` 函数内,B7 双栋绘制块(`:302-322`)之后、运动场 name 回显(`:323`)之前,插入:

```js
// 天桥 footprint(紫色虚线提示, 辅助判断避让)
const bridges = campusData.obstacles.bridges || [];
for (let bri = 0; bri < bridges.length; bri++) {
  const br = bridges[bri];
  if (!br.footprint || br.footprint.length < 2) continue;
  ctx.save();
  ctx.setLineDash([6, 4]);
  ctx.strokeStyle = '#b266ff';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  const p0 = w2c(br.footprint[0][0], br.footprint[0][1]);
  ctx.moveTo(p0.x, p0.y);
  for (let pi = 1; pi < br.footprint.length; pi++) {
    const pp = w2c(br.footprint[pi][0], br.footprint[pi][1]);
    ctx.lineTo(pp.x, pp.y);
  }
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
  const fp = br.footprint;
  const bcx = fp.reduce((s, p) => s + p[0], 0) / fp.length;
  const bcz = fp.reduce((s, p) => s + p[1], 0) / fp.length;
  const bc = w2c(bcx, bcz);
  ctx.fillStyle = '#b266ff';
  ctx.font = 'bold 10px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(
    (br.name || '天桥') + ' y=' + (br.floorY || 6) + '~' + ((br.floorY || 6) + (br.thickness || 3)),
    bc.x,
    bc.y
  );
}
```

- [ ] **Step 5: Playwright 验证闭环**

`python server.py` 后,node playwright 脚本:

1. 打开 `http://127.0.0.1:8080/tools/building_edge_marker.html`,等 canvas 渲染
2. `page.evaluate(() => marks)` → 应含已回填的标记(若地图有);截图确认紫色虚线天桥画出
3. 模拟点教学楼某边:`canvas.dispatchEvent(new MouseEvent('click',{clientX,clientY}))` 设 marks,再调 `await page.evaluate(() => saveEdgeMarks())` → alert 成功
4. 重新 load 页面,`page.evaluate(() => JSON.stringify(marks))` → 标记回填仍在
5. 读 `maps/campus.map.json` 确认 `footprintBuildings[4].edgeMarks` 落盘
   Expected:alert 显示栋数+边数;重载后 marks 回填;落盘字段正确。

- [ ] **Step 6: CDP 0 错误 + commit**

CDP 加载工具页,确认 console 0 error。清掉测试标记(POST 空或手动删 campus.map.json 测试字段)。

```bash
git add tools/building_edge_marker.html
git commit -m "feat(campus): 工具 edgeMarks 回填/保存 + 天桥可视化

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 3: obstacles.js 加 helper + addCorridorToEdge/addACToEdge 增 skipYRanges 参数

**Files:**

- Modify: `js/obstacles.js`(helper 加在 `:459` getACGeo 之前;`addCorridorToEdge` `:467`;`addACToEdge` `:538`)

**Interfaces:**

- Produces(供 Task 4 用):
  - `edgeByFootprintIdx(footprint, ei)` → `{ax,az,bx,bz,len,mx,mz}` 或 `null`(ei 越界/退化边)
  - `edgeBridgeOverlaps(edge, bridges, stiltY)` → `[[y0,y1],...]` **局部 Y 区间**(已减 stiltY),edge 贴上的天桥
  - `addCorridorToEdge(parent, ax,az,bx,bz, wallH, skipYRanges)`(新增第 7 参,默认不传=`undefined`→不跳过)
  - `addACToEdge(parent, ax,az,bx,bz, wallH, skipYRanges)`(同上)

**说明**:本任务只加能力,**不改任何调用点**(现有 `:760/:774` 仍传 5 参,`skipYRanges=undefined`→不跳过),行为零变化。Task 4 才接入调用。

- [ ] **Step 1: 加 4 个 helper 函数**

在 `js/obstacles.js` 的 `var getACGeo = function () {...}`(`:460-464`)之前插入:

```js
// 按 footprint 点索引取边(端点+长度+中点), 不依赖 edges 数组下标(防中间退化边偏移)
var edgeByFootprintIdx = function (footprint, ei) {
  var n = footprint.length;
  if (ei < 0 || ei >= n) return null;
  var ax = footprint[ei][0],
    az = footprint[ei][1];
  var bx = footprint[(ei + 1) % n][0],
    bz = footprint[(ei + 1) % n][1];
  var dx = bx - ax,
    dz = bz - az;
  var len = Math.sqrt(dx * dx + dz * dz);
  if (len < 1) return null;
  return { ax: ax, az: az, bx: bx, bz: bz, len: len, mx: (ax + bx) / 2, mz: (az + bz) / 2 };
};
// 点到线段 2D 距离
var _pointSegDist2D = function (px, pz, ax, az, bx, bz) {
  var dx = bx - ax,
    dz = bz - az;
  var l2 = dx * dx + dz * dz;
  var t = l2 > 0 ? ((px - ax) * dx + (pz - az) * dz) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + dx * t), pz - (az + dz * t));
};
// 该边贴上的天桥的【局部 Y 区间】(世界 [floorY,floorY+thickness] 减 stiltY), 供楼层跳过
var edgeBridgeOverlaps = function (edge, bridges, stiltY) {
  var ranges = [];
  if (!bridges || !bridges.length) return ranges;
  for (var bi = 0; bi < bridges.length; bi++) {
    var br = bridges[bi];
    var fp = br.footprint;
    if (!fp || fp.length < 2) continue;
    var minDist = Infinity;
    for (var i = 0; i < fp.length; i++) {
      var ca = fp[i],
        cb = fp[(i + 1) % fp.length];
      for (var t = 0; t <= 1.0001; t += 0.25) {
        // 采样建筑边 5 点
        var px = edge.ax + (edge.bx - edge.ax) * t;
        var pz = edge.az + (edge.bz - edge.az) * t;
        var d = _pointSegDist2D(px, pz, ca[0], ca[1], cb[0], cb[1]);
        if (d < minDist) minDist = d;
      }
    }
    if (minDist < 0.8) {
      var fy = br.floorY || 6,
        th = br.thickness || 3;
      ranges.push([fy - stiltY, fy + th - stiltY]);
    }
  }
  return ranges;
};
// 局部 Y 是否落在任一跳过区间
var _inSkipRanges = function (y, ranges) {
  if (!ranges || !ranges.length) return false;
  for (var i = 0; i < ranges.length; i++) {
    if (y >= ranges[i][0] && y < ranges[i][1]) return true;
  }
  return false;
};
```

- [ ] **Step 2: addCorridorToEdge 加 skipYRanges 参数 + 楼层跳过**

改 `addCorridorToEdge` 签名(`:467`):

```js
  var addCorridorToEdge = function (parent, ax, az, bx, bz, wallH, skipYRanges) {
```

在其楼层循环 `for (var fl = 0; fl < Math.floor(wallH / floorH); fl++) {`(`:489`)的循环体最开头插入:

```js
      if (_inSkipRanges(fl * floorH + floorH / 2, skipYRanges)) continue; // 天桥层跳过
```

- [ ] **Step 3: addACToEdge 加 skipYRanges 参数 + 楼层跳过**

改 `addACToEdge` 签名(`:538`):

```js
  var addACToEdge = function (parent, ax, az, bx, bz, wallH, skipYRanges) {
```

在其楼层循环 `for (var fl = 0; fl < Math.floor(wallH / floorH); fl++) {`(`:557`)的循环体最开头插入:

```js
      if (_inSkipRanges(fl * floorH + floorH / 2, skipYRanges)) continue; // 天桥层跳过
```

- [ ] **Step 4: CDP 验证零行为变化**

`python server.py`,CDP 加载校园单人地图。Expected:0 控制台错误;外廊/空调渲染与改动前完全一致(现有调用未传 `skipYRanges`→不跳过)。可用 run_js 对比改动前后 `scene` 里 `campus-detail` mesh 数量一致。

- [ ] **Step 5: commit**

```bash
git add js/obstacles.js
git commit -m "refactor(campus): obstacles 加 edgeMarks/天桥避让 helper + 函数签名

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 4: obstacles.js 接入 edgeMarks 渲染 + 天桥楼层裁剪

**Files:**

- Modify: `js/obstacles.js`(`_bridges` 前置、外廊/空调分支重构 `:751-788`)

**Interfaces:**

- Consumes:Task 3 的 `edgeByFootprintIdx`/`edgeBridgeOverlaps`/`addCorridorToEdge`(+`skipYRanges`)/`addACToEdge`(+`skipYRanges`);`fp.edgeMarks`(地图);`_bridges`
- Produces:校园建筑按 `edgeMarks` 渲染外廊/空调(覆盖模式),fallback 也避天桥

- [ ] **Step 1: \_bridges 读取前置到建筑循环之前**

现有 `var _bridges = (currentMapData && currentMapData.obstacles && currentMapData.obstacles.bridges) || [];` 在 `:821`(天桥渲染段,建筑循环之后)。把它**移到**建筑循环 `for (var _fi = 0; _fi < fps.length; _fi++) {`(`:605`)之前(例如紧接 `:602` courtyardX/Z 计算之后)。**删除 `:821` 原声明**,天桥渲染段(`:823` for 循环)改用上方已定义的 `_bridges`(无需重复声明)。

插入位置(`:603` 之后、`:605` for 之前):

```js
var _bridges =
  (currentMapData && currentMapData.obstacles && currentMapData.obstacles.bridges) || [];
```

- [ ] **Step 2: 外廊/空调分支重构(读 edgeMarks,覆盖/fallback,都避天桥)**

替换 `:751-782` 现有外廊/空调代码块(从 `// ── 外廊栏杆 + 空调外机 (穹顶建筑跳过) ──` 到两个 for 循环结束,**不含** `bldGroup.position.y = _stiltY;`)为:

```js
    // ── 外廊栏杆 + 空调外机 (穹顶建筑跳过) ──
    if (fp.roofType !== 'dome') {
      var _marks = fp.edgeMarks;
      if (_marks && _marks.length) {
        // 覆盖模式: 只画标记的边, 逐层生成跳过天桥层
        for (var _mi = 0; _mi < _marks.length; _mi++) {
          var _mk = _marks[_mi];
          var _ed = edgeByFootprintIdx(fp.footprint, _mk.ei);
          if (!_ed || _ed.len < 2) continue;
          var _mskip = edgeBridgeOverlaps(_ed, _bridges, _stiltY);
          if (_mk.type === 'corridor')
            addCorridorToEdge(bldGroup, _ed.ax, _ed.az, _ed.bx, _ed.bz, h - _stiltY, _mskip);
          else if (_mk.type === 'ac')
            addACToEdge(bldGroup, _ed.ax, _ed.az, _ed.bx, _ed.bz, h - _stiltY, _mskip);
        }
      } else {
        // fallback: innerScore 自动推断, 同样算天桥避让
        var innerEdges = edges.filter(function (e) { return e.innerScore > 0.2; });
        innerEdges.sort(function (a, b) { return b.len - a.len; });
        for (var _ie = 0; _ie < Math.min(innerEdges.length, 3); _ie++) {
          if (innerEdges[_ie].len > 4) {
            var _iskip = edgeBridgeOverlaps(innerEdges[_ie], _bridges, _stiltY);
            addCorridorToEdge(
              bldGroup, innerEdges[_ie].ax, innerEdges[_ie].az,
              innerEdges[_ie].bx, innerEdges[_ie].bz, h - _stiltY, _iskip
            );
          }
        }
        var outerEdges = edges.filter(function (e) { return e.innerScore < -0.2; });
        for (var _oe = 0; _oe < outerEdges.length; _oe++) {
          var _oskip = edgeBridgeOverlaps(outerEdges[_oe], _bridges, _stiltY);
          addACToEdge(
            bldGroup, outerEdges[_oe].ax, outerEdges[_oe].az,
            outerEdges[_oe].bx, outerEdges[_oe].bz, h - _stiltY, _oskip
          );
        }
      }
```

- [ ] **Step 3: CDP 验证 0 错误**

`python server.py`,CDP 加载校园单人地图。Expected:0 控制台错误(此时 campus.map.json 还没 edgeMarks,走 fallback;fallback 现在算天桥避让)。

- [ ] **Step 4: Playwright 端到端验证(标记→渲染→避让)**

用 Task 2 的工具给教学楼(B5,idx4)贴天桥的那条边标记外廊 → 保存 → 加载游戏。node playwright + threejs MCP / run_js 验证:

```js
// run_js 或 page.evaluate: 查教学楼 campus-detail 栏杆 mesh 的世界 Y 分布
const details = [];
scene.traverse((o) => {
  if (o.name === 'campus-detail' && o.geometry && o.geometry.type === 'CylinderGeometry') {
    const wp = new THREE.Vector3();
    o.getWorldPosition(wp);
    // 教学楼 footprint 中心约 [-5, 7], 取附近的栏杆
    if (Math.abs(wp.x + 5) < 20 && Math.abs(wp.z - 7) < 15) details.push(+wp.y.toFixed(2));
  }
});
console.log(JSON.stringify(details.sort()));
```

Expected:

- 有栏杆 mesh(标记生效)
- 无 Y < 3 的栏杆(架空层跳过)
- 无 Y ∈ [6,9] 的栏杆(天桥层裁剪)
- 其他层(Y≈3,9,12)有栏杆

**fallback 天桥避让**(无标记楼):同理查 B3/B6 自动推断栏杆,确认无 Y∈[6,9]。

- [ ] **Step 5: 零回归验证(map01a)**

CDP/Playwright 加载 `map01a` 单人地图。Expected:0 错误;外廊/空调渲染正常(走 fallback,无 edgeMarks,无 bridges→skipYRanges 空→不跳过,与改动前一致)。

- [ ] **Step 6: commit**

```bash
git add js/obstacles.js
git commit -m "feat(campus): obstacles 接入 edgeMarks 渲染 + 天桥楼层裁剪

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 5: 版本号同步 + 文档更新 + 全量验证

**Files:**

- Modify: `index.html`(title/menu-version/changelog/调试/console)、`README.md`、`CLAUDE.md`、`CODEBUDDY.md`、`.trae/rules/project_rules.md`
- 可选:`maps/campus.map.json`(若保留示例 edgeMarks 标记)

- [ ] **Step 1: 实际标记一批真实外廊/空调(可选,让校园有数据)**

打开工具 `building_edge_marker.html`,按真实校园给各楼标记外廊/空调边(参考紫色天桥提示避开贴天桥的层),保存到地图。这一步产出真实的 `edgeMarks` 数据。

- [ ] **Step 2: bump 版本号**

用 `bump-version` skill(触发词"发版"/"升级版本")同步 8 处版本号到 **v0.68.0**(新功能),裁剪 changelog 到最近 5 条。

- [ ] **Step 3: 更新 CLAUDE.md / CODEBUDDY.md / project_rules.md**

在 CLAUDE.md 加 v0.68.0 变更段:

- 校园建筑外廊/空调标记系统:工具标记→`edgeMarks` 字段→`obstacles.js` 渲染(覆盖语义)+ 渲染端天桥楼层裁剪(标记边+fallback 都避天桥)+ 架空层隐式跳过 + 零回归 fallback
- 数据格式变更:`campus.obstacles.footprintBuildings[i].edgeMarks=[{ei,type}]`;消费者 `js/obstacles.js` + `tools/building_edge_marker.html` + `server.py`
- 文件行数:`js/obstacles.js` 增量、`tools/building_edge_marker.html` 增量

CODEBUDDY.md 同步参数/架构;`.trae/rules/project_rules.md` 同步行数。

- [ ] **Step 4: 全量 CDP 验证**

CDP 加载校园单人 + map01a 单人,均 0 控制台错误。Playwright 抽查工具闭环 + 游戏渲染。

- [ ] **Step 5: commit + 等用户确认推送**

```bash
git add -A
git commit -m "v0.68.0: 校园外廊/空调标记系统(工具→地图→渲染+天桥避让)"
```

**推送前等用户确认**(CLAUDE.md 规则:Git 推送 `git push origin master` + memory: 明确批准才推进)。确认后用 `handoff` skill 或手动 `git push origin master`(+ GitHub mirror + OneDrive 备份)。

---

## Self-Review 记录

- **Spec 覆盖**:数据结构(T1/T2/T4)、数据流(T1-4)、工具回填/保存/画天桥(T2)、server 扩展(T1)、obstacles helper+签名(T3)、分支重构+ei鲁棒+天桥前置(T4)、架空层(隐式,T3/T4 不破坏)、天桥避让(T3 helper+T4 接入)、覆盖语义(T4)、零回归(T4验证+T5)。✓
- **占位**:无 TBD;所有 `addCorridorToEdge`/`addACToEdge` 调用参数顺序统一为 `ax,az,bx,bz`(端点a(ax,az) + 端点b(bx,bz))。✓
- **类型一致**:`edgeByFootprintIdx`/`edgeBridgeOverlaps`/`addCorridorToEdge(skipYRanges)`/`addACToEdge(skipYRanges)` 在 T3 定义、T4 调用,签名一致。✓
