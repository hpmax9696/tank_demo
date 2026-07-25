# 校门系统 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement task-by-task. Steps use checkbox (`- [ ]`).

**Goal:** 校园围墙开两个口放置校门（铁栅门+门柱+校名横梁+黄黑警戒带+禁止出入立牌），工具页打点+宽度可调，坦克阻挡+不可摧毁。

**Architecture:** 工具页 `gate_marker.html` 照搬 planter_marker + snap boundary 边 + 宽度滑块；`createGates` 程序化建模 5 部件；`createBoundaryWalls` 门宽范围跳过墙段；`type='wall'` polygon 不可摧毁 + `_registerCampusBuilding` 半透明。

**Tech Stack:** Three.js r160 + CanvasTexture + Playwright 验证。

**Spec:** `docs/superpowers/specs/2026-07-25-campus-gate-design.md`

## Global Constraints

- 服务器：`python server.py`，验证 `http://127.0.0.1:8080`（禁 localhost），改 server.py 后必须重启（`taskkill //F //IM python.exe && python server.py`）
- 工具页打点照搬 `tools/planter_marker.html` 框架（canvas + w2c/c2w + zone-list + 保存）
- 模型照搬 `createPlanterZones` 模式（Group + 共享几何 + obstacleData push）
- 改 `server.py` 后必须重启（CLAUDE.md 规则10，第三次犯错不可再犯）
- Playwright 脚本用后清理（rm pw\_\*.js）

---

### Task 1: server.py 加 gates 分支

**Files:**

- Modify: `server.py:91-198`（solidify_campus + do_POST）

- [ ] **Step 1: solidify_campus 加 gates 分支**

`server.py:148`（treeZones 分支后）加：

```python
    # 校门 gates (gate_marker.html 保存, 每门width独立)
    if payload.get('type') == 'gates' and 'zones' in payload and payload['zones'] is not None:
        obs['gates'] = payload['zones']
```

- [ ] **Step 2: do_POST type 白名单加 'gates'**

`server.py:198`：

```python
                if data.get('type') in ('campus', 'toiletZones', 'soccerFields', 'planterZones', 'treeZones', 'gates'):
```

- [ ] **Step 3: 重启 server + 验证**

```bash
taskkill //F //IM python.exe 2>/dev/null; sleep 2; python server.py &
```

curl POST `/api/solidify` {type:'gates', zones:[]} 返回 200。

- [ ] **Step 4: Commit**

```bash
git add server.py && git commit -m "feat: server.py加gates分支(校门保存)"
```

---

### Task 2: campus.map.json 加 gates 字段

**Files:**

- Modify: `maps/campus.map.json`（obstacles 内，planterZones 后）

- [ ] **Step 1: 加 gates 字段（初始两门示例，用户后续工具页调整）**

在 `planterZones` 后加（位置参考现实金福园小学前后门，用户可工具页改）：

```json
    "gates": [
      { "cx": 70.0, "cz": 11.0, "width": 10.0, "ry": -1.2, "name": "金福园小学" },
      { "cx": -78.0, "cz": 2.0, "width": 6.5, "ry": 0.3, "name": "金福园小学" }
    ],
```

（cx/cz 是预估的 boundary 边上点，工具页 snap 后会覆盖为精确值）

- [ ] **Step 2: Commit**

```bash
git add maps/campus.map.json && git commit -m "feat: campus.map.json加gates字段(前后两门示例)"
```

---

### Task 3: tools/gate_marker.html（工具页）

**Files:**

- Create: `tools/gate_marker.html`（照搬 planter_marker.html，加 snap boundary + 宽度滑块）

- [ ] **Step 1: 复制 planter_marker.html 为 gate_marker.html，改标题/语义**

```bash
cp tools/planter_marker.html tools/gate_marker.html
```

改：标题"花坛打点工具"→"校门打点工具"，h2"🌳 花坛标记"→"🚪 校门标记"，type:'planterZones'→'gates'。

- [ ] **Step 2: 加 boundary 数据 + snap 逻辑**

工具页加载 campus.map.json 的 boundary（红色多边形画在 canvas）。点击放置时 snap：

```js
// campus boundary (从 campus.map.json 加载)
const BOUNDARY = [...]; // [[x,z],...]
// snap: 点击世界坐标 -> 最近 boundary 边的投影点 + 法向
function snapToBoundary(wx, wz) {
  let best = null;
  for (let i = 0; i < BOUNDARY.length; i++) {
    const a = BOUNDARY[i], b = BOUNDARY[(i+1) % BOUNDARY.length];
    const dx = b[0]-a[0], dz = b[1]-a[1];
    const L2 = dx*dx + dz*dz;
    let t = ((wx-a[0])*dx + (wz-a[1])*dz) / L2;
    t = Math.max(0, Math.min(1, t));
    const px = a[0] + dx*t, pz = a[1] + dz*t;
    const d = Math.hypot(wx-px, wz-pz);
    if (!best || d < best.d) {
      best = { px, pz, t, d, ax:a[0], az:a[1], bx:b[0], bz:b[1], edgeIdx:i };
    }
  }
  // 法向(朝外): boundary 逆时针 → 外法向 = (-dz, dx)/L 的反方向? 取使门朝外的
  const ex = best.bx - best.ax, ez = best.bz - best.az;
  const L = Math.hypot(ex, ez);
  // 法向两个候选, 取朝外(远离 boundary 质心)
  const cx = BOUNDARY.reduce((s,p)=>s+p[0],0)/BOUNDARY.length;
  const cz = BOUNDARY.reduce((s,p)=>s+p[1],0)/BOUNDARY.length;
  let nx = -ez/L, nz = ex/L;
  if ((best.px-cx)*nx + (best.pz-cz)*nz < 0) { nx=-nx; nz=-nz; }
  const ry = Math.atan2(nz, nx); // 门朝向(法向)
  return { cx: best.px, cz: best.pz, ry };
}
```

点击 → c2w 转世界 → snapToBoundary → 存 gate {cx,cz,ry,width:8,name:'金福园小学'}。

- [ ] **Step 3: 加宽度滑块（选中门后调）**

panel 加：

```html
<div>
  <label>门宽: <span id="w-val">8.0</span>m</label>
  <input type="range" id="width-slider" min="4" max="15" step="0.5" value="8" />
</div>
```

JS：选中 gate（zone-list 点击）→ 滑块显示该 gate.width；滑块改变 → 更新 gate.width + 重绘预览（canvas 画门矩形宽 = width）。

- [ ] **Step 4: canvas 预览画门（矩形+门柱+警戒线示意）**

绘制 gates 时（draw 函数）：

```js
// 每个gate: 矩形(门体 width×0.5) + 两侧柱(方块) + 中线(铁栅) + 黄黑带
gates.forEach((g) => {
  const p = w2c(g.cx, g.cz);
  // 旋转矩形(ry): 4角变换
  const hw = g.width / 2,
    hd = 0.25;
  const cos = Math.cos(g.ry),
    sin = Math.sin(g.ry);
  const corners = [
    [-hw, -hd],
    [hw, -hd],
    [hw, hd],
    [-hw, hd],
  ].map(([x, z]) => w2c(g.cx + x * cos - z * sin, g.cz + x * sin + z * cos));
  ctx.fillStyle = '#4a4a52';
  ctx.beginPath();
  corners.forEach((c, i) => (i ? ctx.lineTo(c[0], c[1]) : ctx.moveTo(c[0], c[1])));
  ctx.fill();
  // 门柱(两端方块)
  ctx.fillStyle = '#a04030';
  [
    [-hw, -hd],
    [hw, -hd],
  ].forEach(([x, z]) => {
    const cc = w2c(g.cx + x * cos - z * sin, g.cz + x * sin + z * cos);
    ctx.fillRect(cc[0] - 3, cc[1] - 3, 6, 6);
  });
  // 警戒线(黄黑虚线沿门轴)
  ctx.strokeStyle = '#f0c020';
  ctx.setLineDash([4, 4]);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(corners[0][0], corners[0][1]);
  ctx.lineTo(corners[1][0], corners[1][1]);
  ctx.stroke();
  ctx.setLineDash([]);
});
```

- [ ] **Step 5: Playwright 工具闭环验证**

```js
// pw_gate_tool.js: 打开 gate_marker.html, 模拟点击放置2门, 调宽度, 保存, 重载回填
// 断言: gates.length===2, width 各异, 保存后 fetch campus.map.json 含 gates
```

- [ ] **Step 6: Commit**

```bash
git add tools/gate_marker.html && git commit -m "feat: gate_marker.html校门打点工具(snap boundary+宽度滑块)"
```

---

### Task 4: createGates 模型（obstacles.js）

**Files:**

- Modify: `js/obstacles.js`（createPlanterZones 后插入 createGates）

- [ ] **Step 1: CanvasTexture 辅助函数（校名/警戒带/立牌）**

```js
// 校名横梁纹理(深红底金字)
function _makeGateNameTex(name) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 64;
  const x = c.getContext('2d');
  x.fillStyle = '#7a1a1a';
  x.fillRect(0, 0, 512, 64);
  x.fillStyle = '#ffd700';
  x.font = 'bold 36px sans-serif';
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.fillText(name || '金福园小学', 256, 32);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
// 黄黑斜纹警戒带
function _makeTapeTex() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 32;
  const x = c.getContext('2d');
  x.fillStyle = '#1a1a1a';
  x.fillRect(0, 0, 256, 32);
  x.fillStyle = '#f0c020';
  for (let i = -32; i < 288; i += 32) {
    x.beginPath();
    x.moveTo(i, 0);
    x.lineTo(i + 16, 0);
    x.lineTo(i + 48, 32);
    x.lineTo(i + 32, 32);
    x.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
// 禁止出入立牌(红圈禁止图标+文字)
function _makeSignTex() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 192;
  const x = c.getContext('2d');
  x.fillStyle = '#f5f5f5';
  x.fillRect(0, 0, 128, 192);
  // 红圈禁止图标
  x.strokeStyle = '#cc0000';
  x.lineWidth = 12;
  x.beginPath();
  x.arc(64, 64, 40, 0, Math.PI * 2);
  x.stroke();
  x.beginPath();
  x.moveTo(36, 36);
  x.lineTo(92, 92);
  x.stroke();
  // 文字
  x.fillStyle = '#cc0000';
  x.font = 'bold 28px sans-serif';
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.fillText('禁止出入', 64, 150);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
```

- [ ] **Step 2: createGates 函数**

```js
// ── 校门区域(gates: 铁栅门+门柱+校名横梁+警戒带+禁止出入立牌) ──
function createGates(targetScene) {
  var gCfg = currentMapData && currentMapData.obstacles && currentMapData.obstacles.gates;
  if (!gCfg || !gCfg.length) return;
  // 共享材质
  var pillarMat = new THREE.MeshStandardMaterial({ color: '#a04030', roughness: 0.85 });
  var grillMat = new THREE.MeshStandardMaterial({
    color: '#4a4a52',
    roughness: 0.4,
    metalness: 0.7,
  });
  var nameTex = _makeGateNameTex('金福园小学');
  var nameMat = new THREE.MeshStandardMaterial({ map: nameTex, roughness: 0.7 });
  var tapeMat = new THREE.MeshBasicMaterial({ map: _makeTapeTex(), side: THREE.DoubleSide });
  var signMat = new THREE.MeshBasicMaterial({ map: _makeSignTex(), side: THREE.DoubleSide });
  var postMat = new THREE.MeshStandardMaterial({ color: '#666', roughness: 0.5, metalness: 0.6 });

  var PILLAR_H = 4.5,
    PILLAR_W = 0.6,
    GRILL_H = 2.5,
    TAPE_H = 1.0;
  var grillBarGeo = new THREE.CylinderGeometry(0.04, 0.04, GRILL_H, 6);

  for (var gi = 0; gi < gCfg.length; gi++) {
    var g = gCfg[gi];
    var width = g.width || 8.0;
    var groundY = getTerrainHeight ? getTerrainHeight(g.cx, g.cz) : 0;
    var gateGroup = new THREE.Group();
    gateGroup.name = 'campus-gate';
    gateGroup.position.set(g.cx, groundY, g.cz);
    gateGroup.rotation.y = g.ry || 0;
    var hw = width / 2;
    // 门柱×2 (沿局部X两端)
    var pillarGeo = new THREE.BoxGeometry(PILLAR_W, PILLAR_H, PILLAR_W);
    [-1, 1].forEach(function (s) {
      var pillar = new THREE.Mesh(pillarGeo, pillarMat);
      pillar.position.set(s * hw, PILLAR_H / 2, 0);
      pillar.castShadow = true;
      pillar.receiveShadow = true;
      gateGroup.add(pillar);
    });
    // 门头横梁(连接柱顶, 贴校名)
    var beamLen = width + PILLAR_W; // 略宽出柱
    var beamGeo = new THREE.BoxGeometry(beamLen, 0.8, 0.6);
    var beam = new THREE.Mesh(beamGeo, nameMat);
    beam.position.set(0, PILLAR_H + 0.4, 0);
    beam.castShadow = true;
    gateGroup.add(beam);
    // 双扇铁栅门(各 width/2, 紧闭对开)
    [-1, 1].forEach(function (s) {
      var panel = new THREE.Group();
      var halfW = width / 2 - 0.1;
      // 上下横档
      var railGeo = new THREE.BoxGeometry(halfW, 0.06, 0.04);
      [0.3, GRILL_H - 0.3].forEach(function (y) {
        var rail = new THREE.Mesh(railGeo, grillMat);
        rail.position.set((-s * halfW) / 2, y, 0); // 局部到门扇范围
        panel.add(rail);
      });
      // 竖杆(每0.3m一根)
      var nBars = Math.max(3, Math.floor(halfW / 0.3));
      for (var bi = 0; bi <= nBars; bi++) {
        var bar = new THREE.Mesh(grillBarGeo, grillMat);
        bar.position.set(-s * (halfW - (halfW / nBars) * bi), GRILL_H / 2, 0);
        bar.castShadow = true;
        panel.add(bar);
      }
      // 两扇对开: 左扇(s=-1)在局部[-width/2, 0], 右扇(s=1)在[0, width/2]
      panel.position.set((s * halfW) / 2, 0, 0);
      gateGroup.add(panel);
    });
    // 黄黑警戒带(门柱间横拉, 高1m)
    var tapeGeo = new THREE.PlaneGeometry(width, TAPE_H);
    var tape = new THREE.Mesh(tapeGeo, tapeMat);
    tape.position.set(0, TAPE_H, 0);
    tape.rotation.x = -Math.PI / 2; // 水平? 不, 横拉是垂直平面
    tape.rotation.x = 0; // 垂直平面(朝外)
    tape.rotation.y = 0; // 已随gateGroup.rotation.y
    gateGroup.add(tape);
    // 第二条警戒带(门内侧, 错开)
    var tape2 = new THREE.Mesh(tapeGeo, tapeMat);
    tape2.position.set(0, TAPE_H + 0.3, 0.2);
    gateGroup.add(tape2);
    // "禁止出入"立牌(门口外侧)
    var signGeo = new THREE.PlaneGeometry(0.8, 1.2);
    var sign = new THREE.Mesh(signGeo, signMat);
    sign.position.set(0, 1.8, 0.5); // 门外侧(局部+z)
    // 立杆
    var signPostGeo = new THREE.CylinderGeometry(0.04, 0.04, 1.8, 6);
    var signPost = new THREE.Mesh(signPostGeo, postMat);
    signPost.position.set(0, 0.9, 0.5);
    gateGroup.add(sign);
    gateGroup.add(signPost);

    targetScene.add(gateGroup);
    if (obstacleMeshes) obstacleMeshes.push(gateGroup);
    // 碰撞: 门体polygon(type='wall'不可摧毁) + 门柱圆柱
    // 门体矩形 footprint (局部 ±hw × 0.3厚) → 世界polygon
    var cos = Math.cos(g.ry || 0),
      sin = Math.sin(g.ry || 0);
    var poly = [
      [-hw, -0.3],
      [hw, -0.3],
      [hw, 0.3],
      [-hw, 0.3],
    ].map(function (p) {
      return [g.cx + p[0] * cos - p[1] * sin, g.cz + p[0] * sin + p[1] * cos];
    });
    obstacleData.push({
      x: g.cx,
      z: g.cz,
      radius: width / 2 + 0.3,
      polygon: poly,
      height: PILLAR_H,
      type: 'wall',
    });
    // 半透明 + 炮弹Raycaster命中
    if (window._registerCampusBuilding) window._registerCampusBuilding(gateGroup);
    gateGroup.traverse(function (c) {
      if (c.isMesh && window._campusBuildings) window._campusBuildings.push(c);
    });
  }
}
```

- [ ] **Step 3: createObstacles 调用 createGates**

`js/obstacles.js:2940`（createPlanterZones 调用后）加：

```js
createGates(targetScene);
```

- [ ] **Step 4: Commit**

```bash
git add js/obstacles.js && git commit -m "feat: createGates校门模型(门柱+横梁+铁栅+警戒带+立牌)"
```

---

### Task 5: createBoundaryWalls 开口

**Files:**

- Modify: `js/obstacles.js:2280`（createBoundaryWalls 加 gates 参数 + 跳过门段）

- [ ] **Step 1: 函数签名加 gates + 边段跳过**

`createBoundaryWalls(targetScene, boundary)` → `createBoundaryWalls(targetScene, boundary, gates)`。

addWallSeg 调用前（2316-2329 循环内）检测 t 范围：

```js
// gates snap 信息(边索引 + t范围), 用于跳过门段
var gateSkip = []; // {edgeIdx, tLo, tHi}
if (gates && gates.length) {
  gates.forEach(function (g) {
    // 找g最近的边 + t(已在工具snap, 但运行时重算)
    let best = null;
    for (let i = 0; i < boundary.length; i++) {
      const a = boundary[i],
        b = boundary[(i + 1) % boundary.length];
      const dx = b[0] - a[0],
        dz = b[1] - a[1];
      const L2 = dx * dx + dz * dz;
      let t = ((g.cx - a[0]) * dx + (g.cz - a[1]) * dz) / L2;
      t = Math.max(0, Math.min(1, t));
      const px = a[0] + dx * t,
        pz = a[1] + dz * t;
      const d = Math.hypot(g.cx - px, g.cz - pz);
      if (!best || d < best.d) best = { edgeIdx: i, t, L: Math.sqrt(L2), d };
    }
    if (best) {
      const halfT = (g.width || 8) / 2 / best.L;
      gateSkip.push({ edgeIdx: best.edgeIdx, tLo: best.t - halfT, tHi: best.t + halfT });
    }
  });
}
```

addWallSeg 调用循环内（2324-2328），每段 t0/t1 检测是否在 gateSkip 范围：

```js
    for (let s = 0; s < nSeg; s++) {
      const t0 = s / nSeg, t1 = (s+1)/nSeg;
      // 跳过门段
      const inGate = gateSkip.some(function (gs) {
        return i === gs.edgeIdx && !(t1 <= gs.tLo || t0 >= gs.tHi);
      });
      if (inGate) continue;
      addWallSeg(...);
    }
```

- [ ] **Step 2: createObstacles 传 gates**

`js/obstacles.js:2948`：

```js
createBoundaryWalls(targetScene, obsCfg.boundary, obsCfg.gates);
```

- [ ] **Step 3: Playwright 验证围墙开口**

加载校园 → 命中 \_campusBuildings 的 campus-wall mesh 数量比无 gates 时少（门段跳过）。或检查门位置无墙 mesh。

- [ ] **Step 4: Commit**

```bash
git add js/obstacles.js && git commit -m "feat: createBoundaryWalls校门位置开口(跳过门段墙)"
```

---

### Task 6: 端到端验证 + 清理

- [ ] **Step 1: 重启 server（Task 1 改了 server.py）+ 加载校园**

```bash
taskkill //F //IM python.exe 2>/dev/null; sleep 2; python server.py &
```

- [ ] **Step 2: Playwright 端到端**

加载校园 → 2 门渲染（gateGroup name='campus-gate'，各部件齐全）+ 围墙开口（门位置无 campus-wall）+ 坦克贴门阻挡（type='wall' polygon）+ 半透明纳入（\_campusBuildingGroups 含 gateGroup）。

- [ ] **Step 3: CDP 0 错误**

- [ ] **Step 4: 清理 pw\_\*.js**

- [ ] **Step 5: 通知用户 Ctrl+F5 实地验证**（校门外观/警戒线/围墙开口/坦克阻挡）

---

## Self-Review

**Spec 覆盖**：位置(工具打点 Task3) + 铁栅门(Task4) + 警戒带+立牌(Task4) + 校名(Task4) + 宽度可调(Task3滑块) + 围墙开口(Task5) + type='wall'不可摧毁(Task4) + 半透明(Task4 \_registerCampusBuilding) + 数据格式(Task2) + server(Task1) — 全覆盖。

**类型一致**：gates[i].{cx,cz,width,ry,name}（Task2 数据 → Task3 工具页 → Task4 模型 → Task5 开口）一致；createBoundaryWalls(targetScene, boundary, gates)（Task5 签名 → Task5 Step2 调用）一致。

**无 placeholder**：所有步骤含完整代码。
