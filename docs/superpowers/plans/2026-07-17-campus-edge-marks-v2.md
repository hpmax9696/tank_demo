# 校园外廊/空调标记系统 v2 调整 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复 v0.68.0 实测 3 问题:工具房被误加外廊/空调(纯覆盖)、天桥避让过粗(子段级裁剪)、B7 无空调(工具标 b7 边 + 拱顶墙面挂)。

**Architecture:** 弃 fallback(无 edgeMarks 不画)+ `edgeBridgeOverlaps` 返回子段区间、`addCorridorToEdge`/`addACToEdge` 子段感知(横杆分段)+ 工具 `findEdge` 支持 b7 4 边、dome 分支读 b7 edgeMarks 挂空调。

**Tech Stack:** 原生浏览器 JS + Three.js r160、Python `http.server`、CDP + Playwright 验证。

## Global Constraints

- **范围**:仅校园 `campus.map.json`;`map01a` 无 `footprintBuildings` 不受影响。
- **纯覆盖语义**:`footprintBuildings[i]` 无 `edgeMarks` → 不画(弃 fallback)。
- **子段裁剪方案 A**:天桥层横杆/挑板分段 `[0,t1]`+`[t2,1]`,不用方案 B。
- **b7 边索引约定**:局部 4 角 `(-hw,-hd),(hw,-hd),(hw,hd),(-hw,hd)`(hw=w/2,hd=d/2),ei=0..3 = 角 i→角 (i+1)%4,**ei=0/2 是长边(沿 w)**,ei=1/3 短边。绕 (cx,cz) 旋转 ry。
- **b7 只空调**(`type:'ac'`),拱顶无外廊。
- **运行**:`python server.py`,127.0.0.1:8080。
- **验证**:每任务 CDP 0 控制台错误 + 关键行为 Playwright。
- **commit** 末尾 `Co-Authored-By: Claude <noreply@anthropic.com>`。
- **Spec**:`docs/superpowers/specs/2026-07-17-campus-edge-marks-v2-design.md`

---

### Task 1: server.py solidify_campus 接收 b7_edgeMarks

**Files:**

- Modify: `server.py` `solidify_campus`(`:91-136`,在现有 `edgeMarks`(footprintBuildings)块后)

**Interfaces:**

- Consumes:POST `/api/solidify` body 增字段 `b7_edgeMarks:{'<idx>':[{ei,type}]}`
- Produces:`campus.map.json` `obstacles.b7_buildings[idx].edgeMarks`

- [ ] **Step 1: 加 b7_edgeMarks 处理**

在 `solidify_campus` 现有 `edgeMarks`(footprintBuildings)处理块之后、正则内联写回之前,插入(参考现有 `edgeMarks` 块的写法,`b7` 变量在该函数前文已定义 `b7 = obs.get('b7_buildings') or []`):

```python
    # b7_buildings edgeMarks (室内运动场/车棚 空调标记)
    for k, v in (payload.get('b7_edgeMarks') or {}).items():
        i = int(k)
        if 0 <= i < len(b7):
            if v:
                b7[i]['edgeMarks'] = v
            elif 'edgeMarks' in b7[i]:
                del b7[i]['edgeMarks']
```

- [ ] **Step 2: 重启 + 验证写回**

```bash
powershell -Command "Get-Process python -ErrorAction SilentlyContinue | Stop-Process -Force" 2>/dev/null
cd "D:/我的文档/tank_demo" && python server.py & SRV=$!
sleep 4
node -e "
const body = JSON.stringify({type:'campus', b7_edgeMarks:{'0':[{ei:0,type:'ac'}]}});
fetch('http://127.0.0.1:8080/api/solidify',{method:'POST',headers:{'Content-Type':'application/json'},body}).then(r=>r.json()).then(console.log);
"
sleep 1
node -e "const m=require('./maps/campus.map.json');console.log('b7[0].edgeMarks:',JSON.stringify(m.obstacles.b7_buildings[0].edgeMarks))"
kill $SRV 2>/dev/null
```

Expected:`b7[0].edgeMarks: [{"ei":0,"type":"ac"}]`;`campus.map.json` 坐标仍内联。

- [ ] **Step 3: 清除测试数据 + commit**

POST `b7_edgeMarks:{'0':[]}` 清除,确认 `b7[0]` 无 edgeMarks 字段。

```bash
cd "D:/我的文档/tank_demo" && git add server.py && git commit -m "feat(campus): solidify_campus 支持 b7_edgeMarks 写回

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 2: building_edge_marker.html 支持 b7 标记

**Files:**

- Modify: `tools/building_edge_marker.html`(`findEdge` ~`:350`、`saveEdgeMarks`、`load` ~`:147`、`draw` b7 块 ~`:303`)

**Interfaces:**

- Consumes:`campus.map.json` `b7_buildings`(回填)、Task 1 的 `b7_edgeMarks` 端点
- Produces:POST `{type:'campus', edgeMarks:{...}, b7_edgeMarks:{<bi>:[{ei,type}]}}`;内存 `marks` key `b7-<bi>-<ei>`

- [ ] **Step 1: findEdge 支持 b7 4 边**

在 `findEdge` 函数(`:350`,现有遍历 footprintBuildings)的循环之后、`return best` 之前,追加 b7 检测:

```js
// b7_buildings 4 边(俯视矩形 cx,cz,w,d,ry)
const b7lds = campusData.obstacles.b7_buildings || [];
for (let bi = 0; bi < b7lds.length; bi++) {
  const w = b7lds[bi];
  const cs = Math.cos(w.ry),
    sn = Math.sin(w.ry);
  const hw = w.w / 2,
    hd = w.d / 2;
  const corners = [];
  for (let c = 0; c < 4; c++) {
    const sx = c === 0 || c === 3 ? -1 : 1,
      sz = c < 2 ? -1 : 1;
    corners.push([w.cx + sx * hw * cs - sz * hd * sn, w.cz + sx * hw * sn + sz * hd * cs]);
  }
  for (let ei = 0; ei < 4; ei++) {
    const a = corners[ei],
      b2 = corners[(ei + 1) % 4];
    const dx = b2[0] - a[0],
      dz = b2[1] - a[1];
    const len2 = dx * dx + dz * dz;
    if (len2 < 1) continue;
    let t = ((w.x - a[0]) * dx + (w.z - a[1]) * dz) / len2;
    t = Math.max(0, Math.min(1, t));
    const px = a[0] + t * dx,
      pz = a[1] + t * dz;
    const dist = Math.hypot(w.x - px, w.z - pz);
    if (dist * scale < 15 && dist < bestDist) {
      bestDist = dist;
      best = { kind: 'b7', bi: bi, ei: ei };
    }
  }
}
```

(注意:`best` 现有结构是 `{bi, ei}`(footprintBuildings)。b7 用 `kind:'b7'` 区分。`bldEdgeKey` 现有是 `bi + '-' + ei` —— b7 改用 `'b7-' + bi + '-' + ei`。修改 `bldEdgeKey` 调用点:在 click 处理 + marks 操作处,根据 `best.kind` 生成 key。)

- [ ] **Step 2: key 生成支持 b7**

把 `bldEdgeKey(fe.bi, fe.ei)` 的调用改为按 kind 分:

```js
function markKey(fe) {
  if (fe.kind === 'b7') return 'b7-' + fe.bi + '-' + fe.ei;
  return fe.bi + '-' + fe.ei;
}
```

click 处理(`:450` `const key = bldEdgeKey(fe.bi, fe.ei)`)改 `const key = markKey(fe)`;hover 同理(`:418`)。

- [ ] **Step 3: saveEdgeMarks 发 b7_edgeMarks**

`saveEdgeMarks` 函数内,现有收集 footprintBuildings 的 edgeMarks 后,追加 b7 收集,并加入 POST body:

```js
// 收集 b7 标记
const b7lds2 = campusData.obstacles.b7_buildings || [];
const b7_edgeMarks = {};
for (let bi = 0; bi < b7lds2.length; bi++) b7_edgeMarks[bi] = [];
for (const key in marks) {
  if (key.indexOf('b7-') !== 0) continue;
  const parts = key.split('-'); // ['b7', bi, ei]
  const bi = parseInt(parts[1], 10),
    ei = parseInt(parts[2], 10);
  if (b7_edgeMarks[bi]) b7_edgeMarks[bi].push({ ei: ei, type: marks[key] });
}
```

POST body 改:`JSON.stringify({ type: 'campus', edgeMarks: edgeMarks, b7_edgeMarks: b7_edgeMarks })`。alert 计数加 b7。

- [ ] **Step 4: load 回填 b7**

`load()` 内现有回填 footprintBuildings edgeMarks 之后,追加:

```js
const _b7lds = campusData.obstacles.b7_buildings || [];
for (let bi = 0; bi < _b7lds.length; bi++) {
  const _em = _b7lds[bi].edgeMarks || [];
  for (const _m of _em) {
    if (typeof _m.ei === 'number' && _m.type === 'ac') {
      marks['b7-' + bi + '-' + _m.ei] = _m.type;
    }
  }
}
```

- [ ] **Step 5: draw 渲染 b7 边标记**

`draw()` 现有 b7 矩形块(`:303-322`)画完轮廓后,追加边标记渲染(参考 footprintBuildings 边标记 `:236-291` 的逻辑):对 b7 每条边,查 `marks['b7-'+bi+'-'+ei]`,有标记则画外侧偏移线(红/蓝)+ 圆点("空"字)。

```js
// b7 边标记
for (let bei = 0; bei < 4; bei++) {
  const mk = marks['b7-' + bi + '-' + bei];
  if (!mk) continue;
  const a = corners[bei],
    b2 = corners[(bei + 1) % 4];
  const ca = w2c(a[0], a[1]),
    cb = w2c(b2[0], b2[1]);
  ctx.beginPath();
  ctx.moveTo(ca.x, ca.y);
  ctx.lineTo(cb.x, cb.y);
  ctx.strokeStyle = mk === 'corridor' ? '#e94560' : '#1565c0';
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.stroke();
  const mx = (ca.x + cb.x) / 2,
    my = (ca.y + cb.y) / 2;
  ctx.beginPath();
  ctx.arc(mx, my, 5, 0, Math.PI * 2);
  ctx.fillStyle = ctx.strokeStyle;
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 8px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('空', mx, my + 3);
}
```

(注意 `corners` 变量需在 b7 循环内可用 —— 现有 draw b7 块已算 corners,把上面这段放进那个循环内。)

- [ ] **Step 6: Playwright 验证 + commit**

杀残留 python → 起 server → node playwright 打开工具 → 点 b7(室内运动场)某长边(ei=0)标空调 → saveEdgeMarks → 读 `campus.map.json` 确认 `b7_buildings[0].edgeMarks=[{ei:0,type:'ac'}]` → 重载确认回填 → 截图确认 b7 边蓝线。**清除测试数据(POST b7_edgeMarks:{'0':[]})**。

CDP 工具页 0 错误。

```bash
git add tools/building_edge_marker.html && git commit -m "feat(campus): 工具支持 b7 边标记(空调)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 3: obstacles.js 纯覆盖清理(删 fallback)

**Files:**

- Modify: `js/obstacles.js`(外廊空调分支 `:815-873` 删 else、`courtyardX/Z` `:579-603`、`edges` 构建 `:612-712` 删)

**Interfaces:**

- Produces:外廊空调分支只剩覆盖模式(无 edgeMarks 不画)

- [ ] **Step 1: 删 fallback 分支**

外廊空调分支(`:815` `if (fp.roofType !== 'dome')`)内,现有 `if (_marks && _marks.length) {...} else {fallback innerEdges/outerEdges...}`。**删除整个 else 块**(从 `} else {` 到对应 `}`,含 innerEdges/outerEdges filter + 循环)。保留 `if (_marks && _marks.length) {...}` 覆盖分支。

改后:

```js
if (fp.roofType !== 'dome') {
  var _marks = fp.edgeMarks;
  if (_marks && _marks.length) {
    for (var _mi = 0; _mi < _marks.length; _mi++) {
      // ... 现有覆盖分支内容不变
    }
  }
  // 无 edgeMarks → 不画(原 else 已删)
  bldGroup.position.y = _stiltY;
  bldGroup.rotation.x = -Math.PI / 2;
  targetScene.add(bldGroup);
  obstacleMeshes.push(mesh);
  obstacleMeshes.push(bldGroup);
}
```

- [ ] **Step 2: 删 dead code(courtyardX/Z + edges 构建)**

- 删 `courtyardX/Z` 内院中心计算(Grep `courtyardX` 定位,从 `var allCx = 0` 到 `courtyardZ = allCz / allN;` 整块)
- 删 `edges` 数组构建:Grep `var edges = []` → 该 for 循环(遍历 fpPts 算 ax/bx/len/innerScore push edges)。**注意**:这个循环里同时算了 `perim`(周长,后面 wallTex 用)。把 `perim += len` 保留(移出 edges push,单独循环算 perim),其余(edges push + innerScore + nx/nz/ux/uz 算)删。

替换为仅算 perim 的循环:

```js
var perim = 0;
var fpPts = fp.footprint;
for (var i = 0; i < fpPts.length; i++) {
  var _pa = fpPts[i],
    _pb = fpPts[(i + 1) % fpPts.length];
  var _plen = Math.hypot(_pb[0] - _pa[0], _pb[1] - _pa[1]);
  if (_plen >= 1) perim += _plen;
}
```

- [ ] **Step 3: CDP 验证 + commit**

CDP 加载校园:工具房(B1,无 edgeMarks)→ **无外廊/空调 mesh**;已标记 5 栋(B2-B6)→ 标记边正常;0 错误。

```bash
git add js/obstacles.js && git commit -m "refactor(campus): 纯覆盖模式, 删 fallback + edges/innerScore dead code

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 4: obstacles.js 天桥子段级裁剪

**Files:**

- Modify: `js/obstacles.js`(`edgeBridgeOverlaps` `:484`、`addCorridorToEdge` `:526`、`addACToEdge` `:598`)

**Interfaces:**

- Consumes/改:`edgeBridgeOverlaps` 返回 `[{yRange:[y0,y1], segRange:[t1,t2]}]`;`addCorridorToEdge`/`addACToEdge` 第 7 参 `skipSegs`(替代 `skipYRanges`)

- [ ] **Step 1: edgeBridgeOverlaps 升级返回子段**

替换整个 `edgeBridgeOverlaps`(`:484`)为:

```js
// 该边贴上的天桥: {yRange(局部Y), segRange(连接子段参数[t1,t2])}
var edgeBridgeOverlaps = function (edge, bridges, stiltY) {
  var out = [];
  if (!bridges || !bridges.length) return out;
  var ux = (edge.bx - edge.ax) / edge.len;
  var uz = (edge.bz - edge.az) / edge.len;
  for (var bi = 0; bi < bridges.length; bi++) {
    var br = bridges[bi];
    var fp = br.footprint;
    if (!fp || fp.length < 2) continue;
    var fy = br.floorY || 6,
      th = br.thickness || 3;
    var yRange = [fy - stiltY, fy + th - stiltY];
    var minDist = Infinity;
    var segLo = 1,
      segHi = 0; // 连接子段(参数区间)
    for (var i = 0; i < fp.length; i++) {
      var ca = fp[i],
        cb = fp[(i + 1) % fp.length];
      var cdx = cb[0] - ca[0],
        cdz = cb[1] - ca[1];
      var cLen = Math.hypot(cdx, cdz);
      if (cLen < 0.1) continue;
      var cux = cdx / cLen,
        cuz = cdz / cLen;
      var dot = cux * ux + cuz * uz;
      // 共线: 方向平行(|dot|≈1) + 距离<0.3
      if (Math.abs(Math.abs(dot) - 1) < 0.005) {
        var d1 = Math.abs((ca[0] - edge.ax) * uz - (ca[1] - edge.az) * ux);
        if (d1 < 0.3) {
          var ta = ((ca[0] - edge.ax) * ux + (ca[1] - edge.az) * uz) / edge.len;
          var tb = ((cb[0] - edge.ax) * ux + (cb[1] - edge.az) * uz) / edge.len;
          if (dot < 0) {
            var tmp = ta;
            ta = tb;
            tb = tmp;
          }
          var lo = Math.max(0, Math.min(ta, tb));
          var hi = Math.min(1, Math.max(ta, tb));
          if (hi > lo) {
            segLo = Math.min(segLo, lo);
            segHi = Math.max(segHi, hi);
          }
        }
      }
      for (var t = 0; t <= 1.0001; t += 0.25) {
        var px = edge.ax + (edge.bx - edge.ax) * t;
        var pz = edge.az + (edge.bz - edge.az) * t;
        var dd = _pointSegDist2D(px, pz, ca[0], ca[1], cb[0], cb[1]);
        if (dd < minDist) minDist = dd;
      }
    }
    if (minDist < 0.8) {
      out.push({ yRange: yRange, segRange: segHi > segLo ? [segLo, segHi] : [0, 1] });
    }
  }
  return out;
};
```

- [ ] **Step 2: addCorridorToEdge 子段感知(横杆分段)**

替换整个 `addCorridorToEdge`(`:526`)为(签名第 7 参改 `skipSegs`,楼层按 segRange 裁剪):

```js
var addCorridorToEdge = function (parent, ax, az, bx, bz, wallH, skipSegs) {
  var dx = bx - ax,
    dz = bz - az;
  var edgeLen = Math.sqrt(dx * dx + dz * dz);
  if (edgeLen < 2) return;
  var ux = dx / edgeLen,
    uz = dz / edgeLen;
  var nx = -uz,
    nz = ux;
  var ldx = dx,
    ldz = -dz;
  var edgeAngle = Math.atan2(ldz, ldx);
  var floorH = 3.0,
    railH = 1.05,
    spacer = 0.55;
  var nBalusters = Math.max(2, Math.floor(edgeLen / spacer));
  var geoB = getBalusterGeo(),
    geoR = getRailGeo(),
    railMat = M.railing;
  for (var fl = 0; fl < Math.floor(wallH / floorH); fl++) {
    var floorY = fl * floorH;
    var yCenter = floorY + floorH / 2;
    // 该层是否在天桥层 + 连接子段
    var seg = null;
    for (var si = 0; si < (skipSegs || []).length; si++) {
      var ss = skipSegs[si];
      if (yCenter >= ss.yRange[0] && yCenter < ss.yRange[1]) {
        seg = ss.segRange;
        break;
      }
    }
    // 栏杆柱
    var railOff = 0.78;
    for (var bi = 0; bi <= nBalusters; bi++) {
      var t = bi / nBalusters;
      if (seg && t >= seg[0] && t <= seg[1]) continue; // 连接段跳过柱子
      var lx = ax + dx * t + nx * railOff;
      var ly = -(az + dz * t + nz * railOff);
      var col = new THREE.Mesh(geoB, railMat);
      col.position.set(lx, ly, floorY + railH / 2);
      col.scale.set(1, railH, 1);
      col.rotation.x = -Math.PI / 2;
      col.castShadow = true;
      col.name = 'campus-detail';
      parent.add(col);
    }
    // 横杆/挑板分段: seg 时画 [0,t1]+[t2,1], 否则 [0,1]
    var segs = seg
      ? [
          [0, seg[0]],
          [seg[1], 1],
        ]
      : [[0, 1]];
    for (var sgi = 0; sgi < segs.length; sgi++) {
      var s0 = segs[sgi][0],
        s1 = segs[sgi][1];
      if (s1 - s0 < 0.02) continue;
      var segLen = edgeLen * (s1 - s0);
      var segMid = (s0 + s1) / 2;
      var tlx = ax + dx * segMid + nx * railOff;
      var tly = -(az + dz * segMid + nz * railOff);
      var topRail = new THREE.Mesh(geoR, railMat);
      topRail.position.set(tlx, tly, floorY + railH);
      topRail.scale.set(segLen, 1, 1);
      topRail.rotation.z = edgeAngle;
      topRail.castShadow = true;
      topRail.name = 'campus-detail';
      parent.add(topRail);
      var midRail = new THREE.Mesh(geoR, railMat);
      midRail.position.set(tlx, tly, floorY + railH * 0.55);
      midRail.scale.set(segLen, 1, 1);
      midRail.rotation.z = edgeAngle;
      midRail.castShadow = true;
      midRail.name = 'campus-detail';
      parent.add(midRail);
      var slab = new THREE.Mesh(
        new THREE.BoxGeometry(segLen, 0.85, 0.1),
        new THREE.MeshStandardMaterial({ color: '#c8c4bc', roughness: 0.7 })
      );
      slab.position.set(ax + dx * segMid + nx * 0.4, -(az + dz * segMid + nz * 0.4), floorY + 0.05);
      slab.rotation.z = edgeAngle;
      slab.castShadow = true;
      slab.receiveShadow = true;
      slab.name = 'campus-detail';
      parent.add(slab);
    }
  }
};
```

- [ ] **Step 3: addACToEdge 子段感知(空调单元跳过)**

替换整个 `addACToEdge`(`:598`)为(签名第 7 参 `skipYRanges`→`skipSegs`,删整层 `continue`,改楼层内算 seg + 空调单元跳过连接段):

```js
var addACToEdge = function (parent, ax, az, bx, bz, wallH, skipSegs) {
  var dx = bx - ax,
    dz = bz - az;
  var edgeLen = Math.sqrt(dx * dx + dz * dz);
  if (edgeLen < 4) return;
  var nx = -(dz / edgeLen),
    nz = dx / edgeLen;
  var ldx = dx,
    ldz = -dz;
  var edgeAngle = Math.atan2(ldz, ldx);
  var floorH = 3.0,
    spacing = 5.0;
  var nUnits = Math.max(1, Math.floor(edgeLen / spacing));
  var acGeoG = getACGeo();
  var acMat = new THREE.MeshStandardMaterial({
    color: '#c8c4be',
    roughness: 0.55,
    metalness: 0.35,
  });
  for (var fl = 0; fl < Math.floor(wallH / floorH); fl++) {
    var floorY = fl * floorH + 1.0;
    var yCenter = fl * floorH + floorH / 2;
    var seg = null;
    for (var si = 0; si < (skipSegs || []).length; si++) {
      var ss = skipSegs[si];
      if (yCenter >= ss.yRange[0] && yCenter < ss.yRange[1]) {
        seg = ss.segRange;
        break;
      }
    }
    for (var ai = 0; ai < nUnits; ai++) {
      var t = (ai + 0.5) / nUnits;
      if (seg && t >= seg[0] && t <= seg[1]) continue; // 连接段跳过空调
      var lx = ax + dx * t + nx * 0.45;
      var ly = -(az + dz * t + nz * 0.45);
      var ac = new THREE.Mesh(acGeoG, acMat);
      ac.position.set(lx, ly, floorY + 0.35);
      ac.rotation.z = edgeAngle;
      ac.castShadow = true;
      ac.name = 'campus-detail';
      parent.add(ac);
      var br = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.3, 0.5), acMat);
      br.position.set(ax + dx * t + nx * 0.2, -(az + dz * t + nz * 0.2), floorY - 0.05);
      br.castShadow = true;
      br.name = 'campus-detail';
      parent.add(br);
    }
  }
};
```

- [ ] **Step 4: 调用点传 skipSegs**

外廊空调覆盖分支(`:824-828`)现有 `var _mskip = edgeBridgeOverlaps(...)`(现返回 `[[y0,y1]]`)→ 现返回 `[{yRange,segRange}]`,直接传给 addCorridorToEdge/addACToEdge(签名已改 skipSegs)。调用不变(`addCorridorToEdge(..., _mskip)`),只是 \_mskip 结构变。

- [ ] **Step 5: CDP + Playwright 验证 + commit**

CDP 校园 0 错误。Playwright:给 B5 教学楼 ei=3(外廊,贴天桥)标记 → 查 campus-detail 栏杆 mesh 世界 Y + 沿边位置:天桥层(世界 Y∈[6,9])连接段(t<0.4,即靠近 [-24.95,11.71] 端)无栏杆、t>0.4 有栏杆;其他层整边栏杆。

```bash
git add js/obstacles.js && git commit -m "feat(campus): 天桥子段级裁剪(连接段跳过, 横杆分段)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 5: obstacles.js b7 dome 挂空调

**Files:**

- Modify: `js/obstacles.js` dome 分支(`:767-813`,\_b7blds 循环内)

**Interfaces:**

- Consumes:`b7_buildings[i].edgeMarks`(Task 1/2 数据)、`addACToEdge`(Task 4)

**b7 边世界坐标推导**(vault `rotation.y=π/2-ry`,position `(cx-(extLen/2)cos(ry), 0, cz-(extLen/2)sin(ry))`,extLen=w,halfW=min(w,d)\*0.48):

- 局部角(俯视,x=宽±halfW,z=长∈[0,extLen]):A=(-halfW,0)、B=(halfW,0)、C=(halfW,extLen)、D=(-halfW,extLen)(x,z)
- 世界:`wx = cx - (extLen/2)cos(ry) + lx*sin(ry) + lz*cos(ry)`;`wz = cz - (extLen/2)sin(ry) - lx*cos(ry) + lz*sin(ry)`
- **ei 映射对齐工具**:工具 ei=0/2 = 长边(沿 w=extLen,z 方向);渲染长边 = x=±halfW,z 0→extLen。**ei=0 → x=-halfW 边**(A→D),**ei=2 → x=+halfW 边**(B→C)。

- [ ] **Step 1: dome 分支读 edgeMarks 挂空调**

在 dome 分支 `_b7blds` 循环内(每个 `_w` 画完 vault `_mesh` 后,`:811` `obstacleMeshes.push(_mesh)` 之后),追加:

```js
// b7 空调(读 edgeMarks, 只 ac, 长边 ei=0/2)
var _b7mks = _w.edgeMarks || [];
var _extLen2 = _w.w;
var _halfW2 = Math.min(_w.w, _w.d) * 0.48;
var _cry = Math.cos(_ry),
  _sry = Math.sin(_ry);
var _b7wallH = _vH * (1 - _ratio);
// 世界坐标转换: 局部 (lx, lz) → 世界 (wx, wz)
var _b7w = function (lx, lz) {
  return [
    _w.cx - (_extLen2 / 2) * _cry + lx * _sry + lz * _cry,
    _w.cz - (_extLen2 / 2) * _sry - lx * _cry + lz * _sry,
  ];
};
var _b7grp = new THREE.Group();
_b7grp.rotation.x = -Math.PI / 2;
targetScene.add(_b7grp);
for (var _bmi = 0; _bmi < _b7mks.length; _bmi++) {
  var _bm = _b7mks[_bmi];
  if (_bm.type !== 'ac') continue;
  var _sgn = _bm.ei === 0 ? -1 : _bm.ei === 2 ? 1 : null;
  if (_sgn === null) continue; // 只支持长边 ei=0/2
  var _wa = _b7w(_sgn * _halfW2, 0);
  var _wb = _b7w(_sgn * _halfW2, _extLen2);
  addACToEdge(_b7grp, _wa[0], _wa[1], _wb[0], _wb[1], _b7wallH, []);
}
```

- [ ] **Step 2: CDP + Playwright 验证 + commit**

先给 b7 标空调(POST `b7_edgeMarks:{'0':[{ei:0,type:'ac'}]}`)。CDP 加载校园 0 错误。Playwright:查 b7(室内运动场,cx≈32.5)附近 `campus-detail` 空调 mesh(BoxGeometry 1.0×0.7×0.4)出现(多层,沿长边)。**清除测试数据**。

```bash
git add js/obstacles.js && git commit -m "feat(campus): b7 dome 拱顶墙面挂空调(读 edgeMarks)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 6: 用户标 b7 + 版本号 + 文档 + 验证 + 推送

**Files:**

- Modify: `index.html`、`README.md`、`CLAUDE.md`、`CODEBUDDY.md`、`.trae/rules/project_rules.md`、`maps/campus.map.json`(用户标 b7)

- [ ] **Step 1: 用户用工具标 b7 空调**

打开 `http://127.0.0.1:8080/tools/building_edge_marker.html` → B(空调模式)→ 点室内运动场(b7)某长边 → 保存。确认 `campus.map.json` `b7_buildings[0].edgeMarks` 落盘。

- [ ] **Step 2: 版本号 v0.68.0 → v0.69.0**

按 CLAUDE.md 规则 1 同步 8 处(index.html title/menu-version/changelog/调试/console + README 开头/版本历史/代码规模)+ engine.js console.log。changelog 裁剪 5 条。

- [ ] **Step 3: 文档同步**

CLAUDE.md 加 `## v0.69.0 本次会话变更` 段(纯覆盖 + 子段裁剪 + b7 空调 + 数据格式 b7_edgeMarks)。CODEBUDDY.md + .trae/rules/project_rules.md 同步。

- [ ] **Step 4: CDP 全量 + commit**

CDP 校园 0 错误,Playwright 抽查(工具房无外廊/天桥子段/b7 空调)。

```bash
git add -A && git commit -m "v0.69.0: 校园标记 v2(纯覆盖+天桥子段裁剪+b7空调)"
```

- [ ] **Step 5: 推送(等用户确认)**

`git push origin master`(Gitee)+ OneDrive 备份。**push 前等用户确认**。

---

## Self-Review 记录

- **Spec 覆盖**:需求1纯覆盖(T3)、需求2子段(T4)、需求3 b7 空调(T1 server + T2 工具 + T5 渲染)、数据结构(T1/T2)、验证(各任务 + T6)。✓
- **占位**:无 TBD;addACToEdge Step 3 说"参考 addCorridorToEdge Step 2 的 seg 查找"——给出具体参考点(同文件同任务),可接受(非跨任务"similar to")。
- **类型一致**:`edgeBridgeOverlaps` 返回 `[{yRange,segRange}]`、`addCorridorToEdge`/`addACToEdge` 第 7 参 `skipSegs`、b7 key `b7-bi-ei`、b7 ei=0/2 长边 —— 各任务一致。✓
- **b7 坐标**:T5 Step 1 给完整 `_b7w` 转换公式(基于 vault rotation/position 推导,中心 z=extLen/2 对齐 cx/cz 已验证);Playwright 会核实空调在长边外侧。
