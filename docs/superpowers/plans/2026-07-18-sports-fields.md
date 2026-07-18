# 球场标线+球门+篮球架 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** campus 地图 5 块命名场地获得球场标线纹理，足球场 4 球门、篮球场 8 篮球架，全部可碎碰撞体。

**Architecture:** 新模块 `js/sportsFields.js` 负责标线纹理（CanvasTexture+UV 重映射）与设备构建；`obstacles.js createGrounds` 按场地名转交；`engine.js` 摧毁分支加同 groupRef 兄弟碰撞体清理。

**Tech Stack:** Three.js r160（全局脚本非 ESM）、Canvas 2D、Playwright 1.61（验证）、CDP（回归）。

**Spec:** `docs/superpowers/specs/2026-07-18-sports-field-markings-design.md`

## Global Constraints

- 1 单位 = 1.3 米（METERS_PER_UNIT）；线宽 0.12u；纹理 1024px 基准
- 所有材质模块级共享常量（docs/obstacle_conventions.md 铁律）；共享材质/共享几何绝不 dispose
- 纹理缓存 window key 带版本后缀 `_courtTexV1<kind>`（防 ESC 重进地图旧缓存）
- 顶层脚本共享全局词法作用域：`obstacleData`/`obstacleMeshes`/`currentMapData` **直接裸引用**（不能用 `window.` 前缀读，engine.js 顶层 let 不挂 window）
- `insertObstacle` 不存在——登记用 `obstacleData.push()`（时序：createGrounds 于 obstacles.js:2484 调用，早于 :2500 `_obstacleGrid.insertAll(obstacleData)` ✓）
- **commit 策略（偏离 frequent-commits）**：项目惯例全部提交为 `vX.Y.Z:` 发版 commit，任务间不做中间 commit，T6 统一发版 v0.73.0
- 验证方式：本项目无测试框架，用 Playwright 断言脚本 `pw_sports_test.js`（逐任务扩展，发版前删除）+ `python cdp_verify.py`
- 服务器：`python server.py`（127.0.0.1:8080，先杀残留 Python 进程）

## 场地数据（campus.map.json obstacles.grounds，只读不改）

| name                    | 尺寸(u)   | 处理                                 |
| ----------------------- | --------- | ------------------------------------ |
| `足球场`                | 32.1×23.7 | 沿长轴分 2 子场，各 1 套标线+2 球门  |
| `大篮球场1` `大篮球场2` | 16.8×23.7 | 5 人制标线+2 篮球架（筐高 2.35u）    |
| `小篮球场1` `小篮球场2` | 11.2×15.3 | 3 人制缩小全场+2 篮球架（筐高 2.0u） |

---

### Task 1: 模块骨架 + 三处接线（外观零变化）

**Files:**

- Create: `js/sportsFields.js`
- Modify: `index.html:1004`（obstacles.js script 之前插一行）
- Modify: `js/obstacles.js:1815-1826`（createGrounds 循环）
- Create: `pw_sports_test.js`（验证脚本，最终任务删除）

**Interfaces:**

- Produces: `window.SportsFields = { hasCourt(name)->bool, buildCourt(g, targetScene), buildEquipment(g, targetScene) }`；`g` 为 grounds 条目 `{footprint:[[x,z]...5点闭合], name, kind}`
- Produces（内部复用）: `SportsFields._basis(g)` 返回 `{p0:[x,z], u:[ux,uz], v:[vx,vz], len0, len1}`（u=P0→P1 单位向量，v=P1→P2 单位向量）
- Consumes: 全局 `obstacleMeshes`、`THREE`、`window.TerrainTextures`

- [ ] **Step 1: 写失败断言（pw_sports_test.js）**

```js
// pw_sports_test.js — 球场功能验证（发版前删除）
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.goto('http://127.0.0.1:8080/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.MAP_CONFIGS && MAP_CONFIGS['campus'], null, {
    timeout: 15000,
  });
  await page.evaluate(() => {
    selectedMapId = 'campus';
    return enterGame();
  });
  await page.waitForFunction(() => window._reflectors && window._reflectors.length > 0, null, {
    timeout: 30000,
  });
  await page.waitForTimeout(800);

  const t1 = await page.evaluate(() => {
    const courts = [];
    scene.traverse((o) => {
      if (o.name === 'campus-court') courts.push(o);
    });
    return {
      courtCount: courts.length,
      hasApi: !!(
        window.SportsFields &&
        SportsFields.hasCourt &&
        SportsFields.buildCourt &&
        SportsFields.buildEquipment
      ),
    };
  });
  console.log('T1', JSON.stringify(t1));
  const t1ok = t1.courtCount === 5 && t1.hasApi;
  console.log('T1 ' + (t1ok ? 'PASS' : 'FAIL'));

  if (errors.length) console.log('console errors:\n' + errors.join('\n'));
  else console.log('console 0 errors');
  await browser.close();
  process.exit(t1ok && !errors.length ? 0 : 1);
})();
```

- [ ] **Step 2: 跑断言确认 FAIL**

```bash
cd "D:\我的文档\tank_demo" && node pw_sports_test.js
```

Expected: `T1 {"courtCount":0,"hasApi":false}` → `T1 FAIL`（服务器须已运行 `python server.py`）

- [ ] **Step 3: 创建 js/sportsFields.js 骨架**

```js
// ==================== 球场模块 (标线纹理 + 球门/篮球架) ====================
// campus 地图专用: 按 grounds 名匹配, 场地面接管渲染(草底+白线), 设备可碎碰撞
// 依赖全局: THREE / obstacleData / obstacleMeshes / window.TerrainTextures
(function () {
  var COURT_RE = { football: /^足球场$/, bb5: /^大篮球场/, bb3: /^小篮球场/ };

  function courtKind(name) {
    if (!name) return null;
    if (COURT_RE.football.test(name)) return 'football';
    if (COURT_RE.bb5.test(name)) return 'bb5';
    if (COURT_RE.bb3.test(name)) return 'bb3';
    return null;
  }

  // footprint 局部基: u=P0→P1 单位向量, v=P1→P2 单位向量 (旋转矩形)
  function _basis(g) {
    var fp = g.footprint;
    var p0 = fp[0],
      p1 = fp[1],
      p2 = fp[2];
    var ux = p1[0] - p0[0],
      uz = p1[1] - p0[1];
    var len0 = Math.sqrt(ux * ux + uz * uz);
    var vx = p2[0] - p1[0],
      vz = p2[1] - p1[1];
    var len1 = Math.sqrt(vx * vx + vz * vz);
    return { p0: p0, u: [ux / len0, uz / len0], v: [vx / len1, vz / len1], len0: len0, len1: len1 };
  }

  // 骨架版 buildCourt: 复刻 createGrounds 草地渲染(T2 换标线纹理)
  function buildCourt(g, targetScene) {
    var shape = _footprintToShape(g.footprint, true);
    var geo = new THREE.ShapeGeometry(shape);
    var mat = window.CampusMaterials ? window.CampusMaterials.grass : null;
    var mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = 0;
    mesh.receiveShadow = true;
    mesh.name = 'campus-court';
    targetScene.add(mesh);
    obstacleMeshes.push(mesh);
  }

  function buildEquipment(g, targetScene) {
    // T3(球门)/T4(篮球架) 实装
  }

  window.SportsFields = {
    hasCourt: function (name) {
      return courtKind(name) !== null;
    },
    buildCourt: buildCourt,
    buildEquipment: buildEquipment,
    _basis: _basis,
    _courtKind: courtKind,
  };
})();
```

- [ ] **Step 4: index.html 加载（obstacles.js 前一行，index.html:1004 前插入）**

```html
<script src="js/sportsFields.js"></script>
```

- [ ] **Step 5: obstacles.js createGrounds 接线（1815 行 `for (const g of grounds) {` 循环体开头，`if (!g.footprint...) continue;` 之后插入）**

```js
    // 命名球场 → SportsFields 接管(标线纹理面 + 球门/篮球架)
    if (window.SportsFields && SportsFields.hasCourt(g.name)) {
      SportsFields.buildCourt(g, targetScene);
      SportsFields.buildEquipment(g, targetScene);
      continue;
    }
```

- [ ] **Step 6: 跑断言确认 PASS**

```bash
node pw_sports_test.js
```

Expected: `T1 {"courtCount":5,"hasApi":true}` → `T1 PASS`，`console 0 errors`

---

### Task 2: 标线纹理 + UV 重映射（buildCourt 完整版）

**Files:**

- Modify: `js/sportsFields.js`（替换骨架 buildCourt，新增纹理生成）
- Modify: `pw_sports_test.js`（追加 T2 断言）

**Interfaces:**

- Produces: `window['_courtTexV1' + kind]` = THREE.CanvasTexture（kind∈football/bb5/bb3，含标线）；`SportsFields._courtMat(kind)` 共享 MeshStandardMaterial
- Produces: buildCourt 后场地 mesh `geometry.attributes.uv` ∈ [0,1]，材质 map=对应纹理
- Consumes: Task1 的 `_basis`

- [ ] **Step 1: 追加 T2 断言（pw_sports_test.js，T1 块之后）**

```js
const t2 = await page.evaluate(() => {
  const courts = [];
  scene.traverse((o) => {
    if (o.name === 'campus-court') courts.push(o);
  });
  const uvOK = courts.every((c) => {
    const uv = c.geometry.attributes.uv;
    if (!uv) return false;
    for (let i = 0; i < uv.count; i++) {
      const u = uv.getX(i),
        v = uv.getY(i);
      if (u < -0.01 || u > 1.01 || v < -0.01 || v > 1.01) return false;
    }
    return true;
  });
  const mapOK = courts.every((c) => c.material && c.material.map && c.material.map.image);
  // 纹理白线像素扫描(足球场)
  let whitePx = 0;
  const tex = window['_courtTexV1football'];
  if (tex) {
    const cv = tex.image,
      cx = cv.getContext('2d');
    const d = cx.getImageData(0, 0, cv.width, cv.height).data;
    for (let i = 0; i < d.length; i += 40) {
      if (d[i] > 230 && d[i + 1] > 230 && d[i + 2] > 230) whitePx++;
    }
  }
  return { uvOK, mapOK, whitePx };
});
console.log('T2', JSON.stringify(t2));
const t2ok = t2.uvOK && t2.mapOK && t2.whitePx > 200;
console.log('T2 ' + (t2ok ? 'PASS' : 'FAIL'));
```

并把末行 exit 条件改为 `t1ok && t2ok && !errors.length`。

- [ ] **Step 2: 跑断言确认 T2 FAIL**（骨架无 map/uv/纹理）

- [ ] **Step 3: sportsFields.js 实装纹理与 buildCourt（替换骨架 buildCourt，并在 IIFE 内、buildCourt 之前加入以下代码）**

```js
// ── 标线布局参数(单位 u) ──
var LINE_W = 0.12,
  INSET = 0.5;
var BB5 = { three: 5.2, ftW: 3.8, ftD: 4.4, circle: 1.4, hoopD: 1.2 };
var BB3 = { three: 3.4, ftW: 2.5, ftD: 2.9, circle: 0.95, hoopD: 0.8 };
var FB = { circle: 2.3, boxW: 7, boxD: 3, penalty: 4.6 };

// (long,short) 场地坐标 → canvas px 映射(两向同 scale, 圆不变形)
function makeMapper(W, len0, len1) {
  var longIsU = len0 >= len1;
  var scale = W / len0;
  return {
    L: longIsU ? len0 : len1,
    S: longIsU ? len1 : len0,
    scale: scale,
    xy: function (l, s) {
      return longIsU ? [l * scale, s * scale] : [s * scale, l * scale];
    },
  };
}
function _line(ctx, m, l1, s1, l2, s2) {
  var a = m.xy(l1, s1),
    b = m.xy(l2, s2);
  ctx.beginPath();
  ctx.moveTo(a[0], a[1]);
  ctx.lineTo(b[0], b[1]);
  ctx.stroke();
}
function _rect(ctx, m, l1, s1, l2, s2) {
  _line(ctx, m, l1, s1, l2, s1);
  _line(ctx, m, l2, s1, l2, s2);
  _line(ctx, m, l2, s2, l1, s2);
  _line(ctx, m, l1, s2, l1, s1);
}
function _circle(ctx, m, lc, sc, r, fill) {
  var c = m.xy(lc, sc);
  ctx.beginPath();
  ctx.arc(c[0], c[1], r * m.scale, 0, Math.PI * 2);
  if (fill) ctx.fill();
  else ctx.stroke();
}

// 足球场: 沿长轴分 2 子场, 各画边线/中线/中圈/两端禁区/点球点
function _drawFootball(ctx, m) {
  for (var i = 0; i < 2; i++) {
    var l0 = (i * m.L) / 2 + INSET,
      l1 = ((i + 1) * m.L) / 2 - INSET;
    var lc = (l0 + l1) / 2;
    _rect(ctx, m, l0, INSET, l1, m.S - INSET);
    _line(ctx, m, l0, m.S / 2, l1, m.S / 2);
    _circle(ctx, m, lc, m.S / 2, FB.circle);
    for (var e = 0; e < 2; e++) {
      var sEnd = e === 0 ? INSET : m.S - INSET;
      var dir = e === 0 ? 1 : -1;
      _rect(ctx, m, lc - FB.boxW / 2, sEnd, lc + FB.boxW / 2, sEnd + dir * FB.boxD);
      _circle(ctx, m, lc, sEnd + dir * FB.penalty, 0.1, true);
    }
  }
}

// 篮球场: 边线/中线/中圈/两端三分弧+罚球区+罚球圈
function _drawBasketball(ctx, m, P) {
  _rect(ctx, m, INSET, INSET, m.L - INSET, m.S - INSET);
  _line(ctx, m, m.L / 2, INSET, m.L / 2, m.S - INSET);
  _circle(ctx, m, m.L / 2, m.S / 2, P.circle);
  for (var e = 0; e < 2; e++) {
    var lEnd = e === 0 ? INSET : m.L - INSET;
    var dir = e === 0 ? 1 : -1;
    var hoopL = lEnd + dir * P.hoopD;
    // 罚球区 + 罚球圈
    _rect(ctx, m, lEnd, m.S / 2 - P.ftW / 2, lEnd + dir * P.ftD, m.S / 2 + P.ftW / 2);
    _circle(ctx, m, lEnd + dir * P.ftD, m.S / 2, P.circle);
    // 三分: 弧(圆心=筐点, ±70°) + 两侧直线段连端线
    var TH = (70 * Math.PI) / 180;
    var c = m.xy(hoopL, m.S / 2);
    ctx.beginPath();
    // canvas 角度: 需按 xy 映射方向; 用参数化采样画弧(与映射解耦, 最稳)
    for (var k = 0; k <= 24; k++) {
      var a = -TH + (2 * TH * k) / 24;
      var pl = hoopL + dir * Math.cos(a) * P.three;
      var ps = m.S / 2 + Math.sin(a) * P.three;
      var pt = m.xy(pl, ps);
      if (k === 0) ctx.moveTo(pt[0], pt[1]);
      else ctx.lineTo(pt[0], pt[1]);
    }
    ctx.stroke();
    var endS1 = m.S / 2 - Math.sin(TH) * P.three,
      endS2 = m.S / 2 + Math.sin(TH) * P.three;
    var arcL = hoopL + dir * Math.cos(TH) * P.three;
    _line(ctx, m, lEnd, endS1, arcL, endS1);
    _line(ctx, m, lEnd, endS2, arcL, endS2);
  }
}

// 纹理: 草底平铺 + 白线 (按 kind 缓存, key 带版本)
function _courtTex(kind, len0, len1) {
  var key = '_courtTexV1' + kind;
  if (window[key]) return window[key];
  var W = 1024,
    H = Math.max(64, Math.round((1024 * Math.min(len0, len1)) / Math.max(len0, len1)));
  // makeMapper 用 W 对应长轴: canvas 宽=长轴向(len0>=len1 时 u=x); len0<len1 时 x=short → W/H 互换
  var cW = len0 >= len1 ? W : H,
    cH = len0 >= len1 ? H : W;
  var c = document.createElement('canvas');
  c.width = cW;
  c.height = cH;
  var ctx = c.getContext('2d');
  // 草底: TerrainTextures.grass() 以 1u≈tile 平铺, 与四周草地密度一致
  var tt = window.TerrainTextures,
    grass = tt ? tt.grass() : null;
  var m = makeMapper(W, len0, len1);
  if (grass) {
    var tile = Math.max(8, Math.round(m.scale)); // 1u → px
    for (var y = 0; y < cH; y += tile)
      for (var x = 0; x < cW; x += tile) ctx.drawImage(grass, x, y, tile, tile);
  } else {
    ctx.fillStyle = '#4A8C3F';
    ctx.fillRect(0, 0, cW, cH);
  }
  ctx.strokeStyle = '#f6f6f6';
  ctx.fillStyle = '#f6f6f6';
  ctx.lineWidth = LINE_W * m.scale;
  if (kind === 'football') _drawFootball(ctx, m);
  else _drawBasketball(ctx, m, kind === 'bb5' ? BB5 : BB3);
  var tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  window[key] = tex;
  return tex;
}

// 共享材质缓存(kind → material)
var _courtMats = {};
function _courtMat(kind, len0, len1) {
  if (_courtMats[kind]) return _courtMats[kind];
  _courtMats[kind] = new THREE.MeshStandardMaterial({
    map: _courtTex(kind, len0, len1),
    roughness: 0.95,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -4,
  });
  return _courtMats[kind];
}
```

buildCourt 替换为：

```js
function buildCourt(g, targetScene) {
  var b = _basis(g);
  var kind = courtKind(g.name);
  var shape = _footprintToShape(g.footprint, true);
  var geo = new THREE.ShapeGeometry(shape);
  // UV 重映射: shape 空间点(x,-z) → footprint 局部 (u,v)/(len0,len1)
  var pos = geo.attributes.position;
  var uvArr = new Float32Array(pos.count * 2);
  for (var i = 0; i < pos.count; i++) {
    var wx = pos.getX(i),
      wz = -pos.getY(i); // shape y = -世界z
    var dx = wx - b.p0[0],
      dz = wz - b.p0[1];
    uvArr[i * 2] = (dx * b.u[0] + dz * b.u[1]) / b.len0;
    uvArr[i * 2 + 1] = (dx * b.v[0] + dz * b.v[1]) / b.len1;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uvArr, 2));
  var mesh = new THREE.Mesh(geo, _courtMat(kind, b.len0, b.len1));
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0;
  mesh.receiveShadow = true;
  mesh.name = 'campus-court';
  targetScene.add(mesh);
  obstacleMeshes.push(mesh);
}
```

注意：`makeMapper` 的 (long,short) 与 UV 的 (u,v) 映射关系——`m.xy` 在 `len0>=len1` 时 `x=l*scale`（canvas x=u 向），否则 `x=s*scale`（canvas x 仍为 u 向？此时 long=v 向，`xy(l,s)` 返回 `[s*scale, l*scale]`，即 canvas x=short=u 向 ✓）。两种情况 canvas x 都对应 u、canvas y 对应 v，与 UV (u,v)→(x/cW, y/cH) 一致；THREE 纹理 v 向翻转由 CanvasTexture 默认 `flipY=true` 处理，标线布局上下对称故翻转无视觉影响。

- [ ] **Step 4: 跑断言确认 T2 PASS**

```bash
node pw_sports_test.js
```

Expected: `T2 {"uvOK":true,"mapOK":true,"whitePx":>200}` → `T2 PASS`

- [ ] **Step 5: 人工截图抽查（临时代码或复用之前相机对准手法）**——把相机拉高俯视足球场截图，PIL 确认两套标线/白线带存在；确认草底密度与四周草地无明显突兀。

---

### Task 3: 球门 ×4（构建+可碎登记）

**Files:**

- Modify: `js/sportsFields.js`（buildEquipment 足球分支 + 球门构建）
- Modify: `pw_sports_test.js`（追加 T3 断言）

**Interfaces:**

- Produces: 每球门 THREE.Group `name='sf-goal'`，进 scene+obstacleMeshes；2 条 obstacleData 条目 `{x,z,radius:0.15,height:1.54,type:'building',groupRef:该Group,color:'#f8f8f8'}`
- Produces（T4 复用）: `_localToWorld(b, l, s)` → `[wx, wz]`；`_yawOfDir(b, dl, ds)` → 世界 yaw（局部场地方向→世界朝向）
- Consumes: Task1 `_basis`；makeMapper 同款 (long,short) 约定

- [ ] **Step 1: 追加 T3 断言**

```js
const t3 = await page.evaluate(() => {
  const goals = [];
  scene.traverse((o) => {
    if (o.name === 'sf-goal') goals.push(o);
  });
  const ods = obstacleData.filter((od) => od.groupRef && od.groupRef.name === 'sf-goal');
  // 每门应有 2 条碰撞, 门柱世界间距≈2.31
  let pairOK = goals.length > 0;
  for (const gl of goals) {
    const mine = ods.filter((od) => od.groupRef === gl);
    if (mine.length !== 2) {
      pairOK = false;
      break;
    }
    const dx = mine[0].x - mine[1].x,
      dz = mine[0].z - mine[1].z;
    if (Math.abs(Math.sqrt(dx * dx + dz * dz) - 2.31) > 0.1) {
      pairOK = false;
      break;
    }
  }
  return { goalCount: goals.length, odCount: ods.length, pairOK };
});
console.log('T3', JSON.stringify(t3));
const t3ok = t3.goalCount === 4 && t3.odCount === 8 && t3.pairOK;
console.log('T3 ' + (t3ok ? 'PASS' : 'FAIL'));
```

exit 条件追加 `&& t3ok`。

- [ ] **Step 2: 跑断言确认 T3 FAIL**（goalCount 0）

- [ ] **Step 3: sportsFields.js 实装球门（IIFE 内新增；buildEquipment 换成路由）**

```js
// ── 共享材质(模块级, 绝不 dispose) ──
var _whiteM = new THREE.MeshStandardMaterial({ color: '#f8f8f8', roughness: 0.5 });
var _netM = new THREE.MeshBasicMaterial({
  color: '#ffffff',
  transparent: true,
  opacity: 0.25,
  side: THREE.DoubleSide,
  depthWrite: false,
});
var _poleM = new THREE.MeshStandardMaterial({ color: '#5a6068', roughness: 0.4, metalness: 0.5 });
var _boardM = null; // 篮板材质懒建(带纹理, T4)
var _rimM = new THREE.MeshStandardMaterial({ color: '#e8641e', roughness: 0.35, metalness: 0.4 });

// 场地局部(l,s) → 世界(x,z); (l,s) 与 makeMapper 同约定(l 沿长轴)
function _localToWorld(b, l, s) {
  var longIsU = b.len0 >= b.len1;
  var u = longIsU ? l : s,
    v = longIsU ? s : l;
  return [b.p0[0] + b.u[0] * u + b.v[0] * v, b.p0[1] + b.u[1] * u + b.v[1] * v];
}
// 场地局部方向(dl,ds) → 世界 yaw(用于 rotation.y; 世界方向 dir=(dx,dz), yaw=-atan2(dz,dx) 使 Group 本地+X 指向 dir)
function _yawOfDir(b, dl, ds) {
  var longIsU = b.len0 >= b.len1;
  var du = longIsU ? dl : ds,
    dv = longIsU ? ds : dl;
  var dx = b.u[0] * du + b.v[0] * dv,
    dz = b.u[1] * du + b.v[1] * dv;
  return -Math.atan2(dz, dx);
}

// 球门: 本地 +X=朝场内, 门柱沿 Z 各±1.155, 高1.54, 柱r0.05
var GOAL = { w: 2.31, h: 1.54, r: 0.05, depth: 0.8 };
function _createGoal() {
  var g = new THREE.Group();
  g.name = 'sf-goal';
  var poleGeo = new THREE.CylinderGeometry(GOAL.r, GOAL.r, GOAL.h, 8);
  var barGeo = new THREE.CylinderGeometry(GOAL.r, GOAL.r, GOAL.w, 8);
  var backGeo = new THREE.CylinderGeometry(GOAL.r * 0.7, GOAL.r * 0.7, GOAL.depth, 6);
  for (var side = -1; side <= 1; side += 2) {
    var pole = new THREE.Mesh(poleGeo, _whiteM);
    pole.position.set(0, GOAL.h / 2, (side * GOAL.w) / 2);
    pole.castShadow = true;
    g.add(pole);
    var back = new THREE.Mesh(backGeo, _whiteM); // 后斜撑
    back.rotation.z = Math.PI / 2 - 0.5;
    back.position.set(-GOAL.depth / 2, GOAL.h / 3, (side * GOAL.w) / 2);
    g.add(back);
  }
  var bar = new THREE.Mesh(barGeo, _whiteM);
  bar.rotation.x = Math.PI / 2;
  bar.position.set(0, GOAL.h, 0);
  bar.castShadow = true;
  g.add(bar);
  // 网: 背+两侧 3 片半透明
  var backNet = new THREE.Mesh(new THREE.PlaneGeometry(GOAL.w, GOAL.h), _netM);
  backNet.rotation.y = Math.PI / 2;
  backNet.position.set(-GOAL.depth, GOAL.h / 2, 0);
  g.add(backNet);
  for (var s2 = -1; s2 <= 1; s2 += 2) {
    var sideNet = new THREE.Mesh(new THREE.PlaneGeometry(GOAL.depth, GOAL.h), _netM);
    sideNet.position.set(-GOAL.depth / 2, GOAL.h / 2, (s2 * GOAL.w) / 2);
    g.add(sideNet);
  }
  return g;
}

// 足球设备: 2 子场 × 2 端线球门
function _buildFootballEquip(g, targetScene, b) {
  var m = makeMapper(1024, b.len0, b.len1);
  for (var i = 0; i < 2; i++) {
    var lc = (i * m.L) / 2 + m.L / 4; // 子场中心(长轴向)
    for (var e = 0; e < 2; e++) {
      var sEnd = e === 0 ? INSET : m.S - INSET;
      var inwardS = e === 0 ? 1 : -1; // 朝场内(s 方向)
      var w = _localToWorld(b, lc, sEnd);
      var goal = _createGoal();
      var gy = typeof getTerrainHeight === 'function' ? getTerrainHeight(w[0], w[1]) : 0;
      goal.position.set(w[0], gy, w[1]);
      goal.rotation.y = _yawOfDir(b, 0, inwardS); // 本地+X → 场内
      targetScene.add(goal);
      obstacleMeshes.push(goal);
      // 双柱碰撞: 柱世界位置 = 端线中点 ± 门半宽(沿端线方向 = l 方向)
      for (var side = -1; side <= 1; side += 2) {
        var pw = _localToWorld(b, lc + (side * GOAL.w) / 2, sEnd);
        obstacleData.push({
          x: pw[0],
          z: pw[1],
          radius: 0.15,
          height: GOAL.h,
          type: 'building',
          groupRef: goal,
          color: '#f8f8f8',
        });
      }
    }
  }
}
```

buildEquipment 路由：

```js
function buildEquipment(g, targetScene) {
  var kind = courtKind(g.name);
  var b = _basis(g);
  if (kind === 'football') _buildFootballEquip(g, targetScene, b);
  // bb5/bb3 → T4
}
```

**朝向核对（实现者必读）**：门 Group 本地 +X 朝场内、门柱沿本地 Z。`rotation.y = _yawOfDir(b, 0, inwardS)` 后本地 +X 指向场内 s 方向；此时本地 Z 轴对应场地 l 方向（水平旋转保正交），故柱世界位置=端线上 `lc ± w/2` ✓ 与碰撞条目一致。

- [ ] **Step 4: 跑断言确认 T3 PASS**；顺带人工核查：`goalCount 4 / odCount 8 / pairOK true`

---

### Task 4: 篮球架 ×8（构建+可碎登记）

**Files:**

- Modify: `js/sportsFields.js`（篮球分支）
- Modify: `pw_sports_test.js`（追加 T4 断言）

**Interfaces:**

- Produces: 每架 Group `name='sf-hoop'`，1 条 obstacleData `{x,z,radius:0.2,height:柱高,type:'building',groupRef,color:'#5a6068'}`
- Consumes: T3 的 `_localToWorld`/`_yawOfDir`/材质

- [ ] **Step 1: 追加 T4 断言**

```js
const t4 = await page.evaluate(() => {
  const hoops = [];
  scene.traverse((o) => {
    if (o.name === 'sf-hoop') hoops.push(o);
  });
  const ods = obstacleData.filter((od) => od.groupRef && od.groupRef.name === 'sf-hoop');
  // 大小场筐高抽查: 每架 Group 内 Torus 世界 y
  const rimYs = hoops.map((h) => {
    let y = -1;
    h.traverse((c) => {
      if (c.geometry && c.geometry.type === 'TorusGeometry') {
        const p = new THREE.Vector3();
        c.getWorldPosition(p);
        y = p.y - h.position.y;
      }
    });
    return +y.toFixed(2);
  });
  return { hoopCount: hoops.length, odCount: ods.length, rimYs };
});
console.log('T4', JSON.stringify(t4));
const t4ok =
  t4.hoopCount === 8 &&
  t4.odCount === 8 &&
  t4.rimYs.filter((y) => Math.abs(y - 2.35) < 0.05).length === 4 &&
  t4.rimYs.filter((y) => Math.abs(y - 2.0) < 0.05).length === 4;
console.log('T4 ' + (t4ok ? 'PASS' : 'FAIL'));
```

exit 条件追加 `&& t4ok`。

- [ ] **Step 2: 跑断言确认 T4 FAIL**

- [ ] **Step 3: 实装篮球架（IIFE 内新增；buildEquipment 路由补 bb 分支）**

```js
// 篮板材质: 128px 白底红框纹理(懒建)
function _getBoardMat() {
  if (_boardM) return _boardM;
  var c = document.createElement('canvas');
  c.width = 128;
  c.height = 96;
  var ctx = c.getContext('2d');
  ctx.fillStyle = '#f4f4f4';
  ctx.fillRect(0, 0, 128, 96);
  ctx.strokeStyle = '#d03028';
  ctx.lineWidth = 6;
  ctx.strokeRect(4, 4, 120, 88); // 外框
  ctx.strokeRect(48, 52, 32, 26); // 瞄准框(下沿贴筐)
  var tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  _boardM = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.4 });
  return _boardM;
}

// 篮球架: 本地 +X=朝场内; 立柱在原点, 悬臂前探至筐点
// rimH: 筐面高(大2.35/小2.0); hoopD: 筐点距端线; 柱距端线外 0.6 → 悬臂 = hoopD+0.6
var HOOP = { boardW: 1.38, boardH: 0.81, rimR: 0.175, poleR: 0.08, setback: 0.6 };
function _createHoop(rimH) {
  var g = new THREE.Group();
  g.name = 'sf-hoop';
  var poleH = rimH + HOOP.boardH * 0.6;
  var base = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.15, 0.6), _poleM);
  base.position.y = 0.075;
  g.add(base);
  var pole = new THREE.Mesh(new THREE.CylinderGeometry(HOOP.poleR, HOOP.poleR, poleH, 8), _poleM);
  pole.position.y = poleH / 2;
  pole.castShadow = true;
  g.add(pole);
  return g; // 悬臂/板/筐由 _finishHoop 按 armLen 加(依赖场地 hoopD)
}
function _finishHoop(g, rimH, armLen) {
  var armY = rimH + HOOP.boardH * 0.45;
  var arm = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, armLen, 6), _poleM);
  arm.rotation.z = Math.PI / 2;
  arm.position.set(armLen / 2, armY, 0);
  g.add(arm);
  var board = new THREE.Mesh(new THREE.BoxGeometry(0.05, HOOP.boardH, HOOP.boardW), _getBoardMat());
  board.position.set(armLen, rimH + 0.15 + HOOP.boardH / 2 - 0.15, 0);
  board.castShadow = true;
  g.add(board);
  var rim = new THREE.Mesh(new THREE.TorusGeometry(HOOP.rimR, 0.02, 8, 20), _rimM);
  rim.rotation.x = Math.PI / 2;
  rim.position.set(armLen + 0.05 + HOOP.rimR, rimH, 0);
  g.add(rim);
}

function _buildBasketballEquip(g, targetScene, b, P, rimH) {
  var m = makeMapper(1024, b.len0, b.len1);
  var armLen = P.hoopD + HOOP.setback;
  for (var e = 0; e < 2; e++) {
    var lEnd = e === 0 ? INSET : m.L - INSET;
    var inwardL = e === 0 ? 1 : -1;
    var w = _localToWorld(b, lEnd - inwardL * HOOP.setback, m.S / 2); // 柱: 端线外 0.6
    var hoop = _createHoop(rimH);
    _finishHoop(hoop, rimH, armLen);
    var gy = typeof getTerrainHeight === 'function' ? getTerrainHeight(w[0], w[1]) : 0;
    hoop.position.set(w[0], gy, w[1]);
    hoop.rotation.y = _yawOfDir(b, inwardL, 0); // 本地+X → 场内(l 方向)
    targetScene.add(hoop);
    obstacleMeshes.push(hoop);
    obstacleData.push({
      x: w[0],
      z: w[1],
      radius: 0.2,
      height: rimH + 0.5,
      type: 'building',
      groupRef: hoop,
      color: '#5a6068',
    });
  }
}
```

buildEquipment 路由补：

```js
    else if (kind === 'bb5') _buildBasketballEquip(g, targetScene, b, BB5, 2.35);
    else if (kind === 'bb3') _buildBasketballEquip(g, targetScene, b, BB3, 2.0);
```

- [ ] **Step 4: 跑断言确认 T4 PASS**（hoopCount 8 / odCount 8 / rimYs 4×2.35 + 4×2.0）

- [ ] **Step 5: 人工俯瞰+近景截图**：篮球场端线架子朝向场内、筐悬在三分弧内、无穿模。

---

### Task 5: engine.js 摧毁兄弟清理 + 端到端炮击验证

**Files:**

- Modify: `js/engine.js:2609-2615`（主循环炮弹摧毁分支）
- Modify: `js/engine.js:~2896`（HE 溅射摧毁分支，同款追加）
- Modify: `pw_sports_test.js`（追加 T5 断言）

**Interfaces:**

- Consumes: T3 的双柱 obstacleData（同 groupRef 2 条）
- 不改 vs 模式两处摧毁点（engine.js:6465/6646）：campus 仅单人模式加载，YAGNI

- [ ] **Step 1: 追加 T5 断言（真实炮弹端到端）**

```js
const t5 = await page.evaluate(async () => {
  // 找一根门柱 od, 把玩家传送到其正前方 5u, 炮口对准, 开炮
  const od = obstacleData.find((o) => o.groupRef && o.groupRef.name === 'sf-goal');
  if (!od) return { error: 'no goal od' };
  const goal = od.groupRef;
  const before = obstacleData.filter((o) => o.groupRef === goal).length;
  // 玩家(单人模式 player1.group)移到柱前, 朝向柱
  const px = od.x + 5,
    pz = od.z;
  player1.group.position.set(px, getTerrainHeight(px, pz), pz);
  player1.state.x = px;
  player1.state.z = pz;
  // 直接构造一发炮弹沿 -X 打向柱(绕过瞄准链路, 走真实碰撞/摧毁代码)
  const s = spawnShell ? null : null; // 项目无独立 spawnShell 导出时用 fireShell 路径
  // 兜底: 手动 push 一发与玩家炮弹同构的 shell
  const geo = new THREE.SphereGeometry(0.1, 6, 6);
  const mat = new THREE.MeshBasicMaterial({ color: 0x333333 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(px - 1.2, getTerrainHeight(px, pz) + od.height * 0.5, pz);
  scene.add(mesh);
  bullets.push({ mesh, vx: -22, vy: 0, vz: 0, owner: player1, damage: 34, type: 'ap', life: 3 });
  await new Promise((r) => setTimeout(r, 800)); // 等命中+摧毁
  const after = obstacleData.filter((o) => o.groupRef === goal).length;
  const goneFromScene = !goal.parent;
  return { before, after, goneFromScene };
});
console.log('T5', JSON.stringify(t5));
const t5ok = t5.before === 2 && t5.after === 0 && t5.goneFromScene;
console.log('T5 ' + (t5ok ? 'PASS' : 'FAIL'));
```

**执行者注意**：`bullets` 元素结构必须先核对（Read engine.js 玩家开炮 push 处，字段名 vx/vy/vz/life 等以真实代码为准，上面字段是模板——若结构不符按真实结构改断言，不改引擎）。若手动 shell 走不进碰撞循环（如循环遍历的是别的数组名），退化方案：把玩家开到柱前用 `page.mouse.down()` 真开炮 3 发。

- [ ] **Step 2: 跑断言确认 T5 FAIL**（after 应为 1——命中柱只删被击柱，另一柱残留，goneFromScene true 但 after===1 → FAIL 证明兄弟清理缺失）

- [ ] **Step 3: engine.js 主循环摧毁分支补丁（2609-2615 行，`obstacleData.splice(realIdx, 1);` 与 `_obstacleGrid.remove(od)` 之后追加）**

```js
// 同组兄弟碰撞体联动清理(球门双柱: 命中一柱整门碎)
if (od.groupRef) {
  for (let sk = obstacleData.length - 1; sk >= 0; sk--) {
    if (obstacleData[sk].groupRef === od.groupRef) {
      if (window._obstacleGrid) window._obstacleGrid.remove(obstacleData[sk]);
      obstacleData.splice(sk, 1);
    }
  }
}
```

- [ ] **Step 4: HE 溅射分支同款追加**（engine.js ~2896 groupRef 摧毁块内，找到该分支中 `obstacleData` 移除/`destroyed` 标记处，按当地代码结构等价追加；HE 分支若用 `od.destroyed=true` 软删除，则对兄弟同样置 `destroyed=true` 并从 grid remove——**以现场代码为准，保持与该分支现有清理方式一致**）

- [ ] **Step 5: 跑断言确认 T5 PASS**（before 2 / after 0 / goneFromScene true）

---

### Task 6: 回归验证 + 发版 v0.73.0

**Files:**

- Modify: `index.html`（版本号 5 处）+ `README.md`（3 处）+ `CLAUDE.md`/`CODEBUDDY.md`/`.trae/rules/project_rules.md`（会话变更段）
- Delete: `pw_sports_test.js`

- [ ] **Step 1: 全量跑 pw_sports_test.js**：T1~T5 全 PASS、console 0 errors
- [ ] **Step 2: DC 增量抽查**：进 campus 后 `renderer.info.render.calls` 对比改前基线（改前先记录），增量 ≤ +80
- [ ] **Step 3: map01a 回归**：进 test_map_01a 正常游玩 10s、0 错误（SportsFields 不激活）
- [ ] **Step 4: CDP 验证**：`python cdp_verify.py` → error_count 0
- [ ] **Step 5: 删除 pw_sports_test.js**
- [ ] **Step 6: 调用 bump-version skill**（v0.73.0，8 处版本号+changelog 裁剪+三文档同步；含本会话此前已改的厕所标志/高窗修复一并入 changelog）
- [ ] **Step 7: 等用户文字确认后** `git add -A && git commit -m "v0.73.0: 球场标线+球门+篮球架+厕所标志修复" && git push origin master`

---

## Self-Review 结论

- **Spec 覆盖**：§1 需求→T1-T4；§4.4 双柱碰撞→T3；§5 引擎补丁→T5；§6 验证→各任务 Step + T6 ✓
- **占位符**：T4 `_createHoop`/`_finishHoop` 拆分因 armLen 依赖场地参数，两函数均给全码 ✓；T5 手动 shell 字段标注"以真实代码为准"是执行期核对指令，非占位符
- **类型一致**：`_basis` 返回结构在 T1 定义、T2/T3/T4 消费一致；`_localToWorld(b,l,s)`/`_yawOfDir(b,dl,ds)` 签名 T3 定义 T4 消费一致；`GOAL.h=1.54` 与 od.height 一致 ✓
- **已知偏差**：obstacles.js 接线由 spec 的"+3 行 / +1 调用点"合并为循环内 +5 行一处（更少接触面）；HE 分支清理方式按现场代码适配
