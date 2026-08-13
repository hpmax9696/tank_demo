# v1-成年女 胸臀曲线（RidgeBox + TaperedBox 底面偏移）实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 给 v1-成年女骨架加胸（RidgeBox 五边形截面）和臀（TaperedBox 底面偏移）两个凸点，且在模型工厂可调。

**Architecture:** 几何层新增 `RidgeBox` 类型 + 给 `TaperedBox` 加底面偏移 `bx/bz`（两处 `createGeometry` 同步：`model_factory.html` 内联 + `enemies.js`）；数据层用 `_applyFemaleCurves()` 只覆盖 v1-成年女的 `torso_upper/torso_lower/pelvis`；UI 层给调参面板补滑块。

**Tech Stack:** Three.js r160（`js/three.min.js`），原生 JS（无构建步骤），模型工厂用 lil-gui 调参面板。

**Spec:** `docs/superpowers/specs/2026-08-13-humanoid-female-chest-hip-curves-design.md`

## Global Constraints

- 只覆盖 `v1-成年女-20260810`，共享 `WORKING_SKELETON` 和其他骨架（中性/成年男/儿童）**不得改动**。
- 两处 `createGeometry` 必须同步改（`model_factory.html` 与 `models/enemies.js` 是历史遗留的两份独立副本）。
- TaperedBox 新增 `bx/bz` 缺省 0，向后兼容（现有 7 参数 TaperedBox 渲染不变）。
- 默认值：胸 `ridgeY=0.20`/`ridgeZ=0.04`；臀 `torso_lower.bz=-0.04`、`pelvis.oz=-0.04`。
- 验证用 Playwright（`node` + `require('playwright')`，脚本放项目根目录运行）+ `vision.py` 识图 + CDP 0 错误。服务器已跑在 8080（`python server.py`）。

---

### Task 1: 几何层 — TaperedBox 底面偏移 + RidgeBox 类型（两处 createGeometry）

**Files:**

- Modify: `model_factory.html:775-807`（`buildTaperedBox`）、`model_factory.html:1201-1211`（TaperedBox case）、`model_factory.html:807` 后新增 `buildRidgeBox`、`model_factory.html:1247` 后新增 RidgeBox case
- Modify: `models/enemies.js:1061-1072`（`mkTaperedBox`）、`models/enemies.js:1120`（TaperedBox case）、`models/enemies.js:1087` 后新增 `mkRidgeBox`、`models/enemies.js:1122` 后新增 RidgeBox case

**Interfaces:**

- Produces: `buildRidgeBox(bw,h,bd,tw,td,ox,oz,ridgeY,ridgeZ)` 和 `mkRidgeBox(...)`（同逻辑，前者含 uv、后者仅 position+index）；`buildTaperedBox(...)` 与 `mkTaperedBox(...)` 签名各加 `bx,bz` 两参。

**注意风格差异**：`model_factory.html` 的 `buildTaperedBox` 有 `uvs`（`verts/uvs/indices` + `Float32BufferAttribute`），`enemies.js` 的 `mkTaperedBox` 无 uv（`v/idx` + 紧凑箭头函数）。新增 `RidgeBox` 时各自沿用本文件既有风格。

- [ ] **Step 1: 改 `model_factory.html` 的 `buildTaperedBox` 签名并给底面 4 顶点加 bx/bz**

把 `function buildTaperedBox(bw, h, bd, tw, td, ox = 0, oz = 0) {` 改为 `function buildTaperedBox(bw, h, bd, tw, td, ox = 0, oz = 0, bx = 0, bz = 0) {`，并把以下 6 个 quad 里所有 `y=0` 的底面顶点 `±hw/±hd` 加上 `bx/bz`（顶面顶点不动）：

```js
// 底面
quad(
  [-hw + bx, 0, -hd + bz],
  [hw + bx, 0, -hd + bz],
  [hw + bx, 0, hd + bz],
  [-hw + bx, 0, hd + bz]
);
// 后侧（底面两顶点）
quad(
  [-hw + bx, 0, -hd + bz],
  [-thw + ox, h, -thd + oz],
  [thw + ox, h, -thd + oz],
  [hw + bx, 0, -hd + bz]
);
// 前侧（底面两顶点）
quad(
  [hw + bx, 0, hd + bz],
  [thw + ox, h, thd + oz],
  [-thw + ox, h, thd + oz],
  [-hw + bx, 0, hd + bz]
);
// 左侧（底面两顶点）
quad(
  [-hw + bx, 0, hd + bz],
  [-thw + ox, h, thd + oz],
  [-thw + ox, h, -thd + oz],
  [-hw + bx, 0, -hd + bz]
);
// 右侧（底面两顶点）
quad(
  [hw + bx, 0, -hd + bz],
  [thw + ox, h, -thd + oz],
  [thw + ox, h, thd + oz],
  [hw + bx, 0, hd + bz]
);
```

- [ ] **Step 2: 改 `model_factory.html` 的 TaperedBox case 传 bx/bz**

在 `createGeometry` 的 TaperedBox case（约 1201-1211）里，`buildTaperedBox(...)` 调用末尾追加 `, s[7] || 0, s[8] || 0`（原来只传 7 个参数）。

- [ ] **Step 3: `model_factory.html` 新增 `buildRidgeBox`（在 `buildTaperedBox` 之后）**

```js
// 脊线盒：五边形截面棱台（胸前一条水平脊线做隆起）
// size: [底宽, 高, 底深, 顶宽, 顶深, 顶面X偏移, 顶面Z偏移, 脊线高度, 脊线凸出]
// 脊线长度 = 截面宽度在 ridgeY 处的线性插值；脊线 z = 前面插值 + ridgeZ
function buildRidgeBox(bw, h, bd, tw, td, ox = 0, oz = 0, ridgeY = 0.5 * h, ridgeZ = 0) {
  const hw = bw / 2,
    hd = bd / 2,
    thw = tw / 2,
    thd = td / 2;
  const wRidge = bw + (ridgeY / h) * (tw - bw);
  const hwr = wRidge / 2;
  const zFrontAtRidge = hd + (ridgeY / h) * (thd + oz - hd);
  const zRidge = zFrontAtRidge + ridgeZ;
  const verts = [],
    uvs = [],
    indices = [];
  let vi = 0;
  function quad(a, b, c, d) {
    verts.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2], d[0], d[1], d[2]);
    uvs.push(0, 0, 1, 0, 1, 1, 0, 1);
    indices.push(vi, vi + 1, vi + 2, vi, vi + 2, vi + 3);
    vi += 4;
  }
  function tri(a, b, c) {
    verts.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
    uvs.push(0, 0, 1, 0, 1, 1);
    indices.push(vi, vi + 1, vi + 2);
    vi += 3;
  }
  // 底面（法线 -y）
  quad([-hw, 0, -hd], [hw, 0, -hd], [hw, 0, hd], [-hw, 0, hd]);
  // 顶面（法线 +y）
  quad(
    [-thw + ox, h, -thd + oz],
    [-thw + ox, h, thd + oz],
    [thw + ox, h, thd + oz],
    [thw + ox, h, -thd + oz]
  );
  // 背面（法线 -z）
  quad([-hw, 0, -hd], [-thw + ox, h, -thd + oz], [thw + ox, h, -thd + oz], [hw, 0, -hd]);
  // 前面下段：底前 → 脊线（法线 +z）
  quad([hw, 0, hd], [hwr, ridgeY, zRidge], [-hwr, ridgeY, zRidge], [-hw, 0, hd]);
  // 前面上段：脊线 → 顶前（法线 +z）
  quad(
    [hwr, ridgeY, zRidge],
    [thw + ox, h, thd + oz],
    [-thw + ox, h, thd + oz],
    [-hwr, ridgeY, zRidge]
  );
  // 左面（5 顶点，法线 -x）
  tri([-hw, 0, hd], [-hwr, ridgeY, zRidge], [-thw + ox, h, thd + oz]);
  tri([-hw, 0, hd], [-thw + ox, h, thd + oz], [-thw + ox, h, -thd + oz]);
  tri([-hw, 0, hd], [-thw + ox, h, -thd + oz], [-hw, 0, -hd]);
  // 右面（5 顶点，法线 +x）
  tri([hw, 0, -hd], [thw + ox, h, -thd + oz], [thw + ox, h, thd + oz]);
  tri([hw, 0, -hd], [thw + ox, h, thd + oz], [hwr, ridgeY, zRidge]);
  tri([hw, 0, -hd], [hwr, ridgeY, zRidge], [hw, 0, hd]);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(verts), 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uvs), 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}
```

- [ ] **Step 4: `model_factory.html` 的 `createGeometry` 加 RidgeBox case**

在 TaperedBox case 之后新增：

```js
case 'RidgeBox':
  // size: [底宽, 高, 底深, 顶宽, 顶深, 顶面X偏移, 顶面Z偏移, 脊线高度, 脊线凸出]
  return buildRidgeBox(
    s[0],
    s[1] || 1,
    s[2] || s[0],
    s[3] !== undefined ? s[3] : s[0] * 0.6,
    s[4] !== undefined ? s[4] : s[2] * 0.6,
    s[5] || 0,
    s[6] || 0,
    s[7] != null ? s[7] : 0.5 * (s[1] || 1),
    s[8] || 0
  );
```

- [ ] **Step 5: `enemies.js` 的 `mkTaperedBox` 加 bx/bz（紧凑风格，无 uv）**

`function mkTaperedBox(bw, h, bd, tw, td, ox, oz) {` 改为 `function mkTaperedBox(bw, h, bd, tw, td, ox, oz, bx, bz) {`，并把 6 个 `q(...)` 里所有 `y=0` 的底面顶点加 `bx/bz`（逻辑与 Step 1 完全一致，只是用 `bx`/`bz` 可能为 undefined，调用处用 `||0` 兜底，函数内直接 `bx = bx || 0; bz = bz || 0;`）。

- [ ] **Step 6: `enemies.js` 的 TaperedBox case 传 bx/bz**

`case 'TaperedBox': { const s = node.size; return mkTaperedBox(s[0], s[1], s[2], s[3], s[4], s[5]||0, s[6]||0, s[7]||0, s[8]||0); }`

- [ ] **Step 7: `enemies.js` 新增 `mkRidgeBox`（紧凑风格，无 uv）+ RidgeBox case**

`mkRidgeBox` 与 Step 3 的 `buildRidgeBox` 顶点/面逻辑完全一致，但用 `mkTaperedBox` 的紧凑风格（`const v=[],idx=[]; const q=(a,b,c,d)=>...; const t=(a,b,c)=>...;` 无 uv）。RidgeBox case：`case 'RidgeBox': { const s = node.size; return mkRidgeBox(s[0], s[1], s[2], s[3], s[4], s[5]||0, s[6]||0, s[7] != null ? s[7] : 0.5*(s[1]||1), s[8]||0); }`

- [ ] **Step 8: 验证 — CDP 0 错误 + 回归**

Run: `python cdp_verify.py http://127.0.0.1:8080/model_factory.html --timeout 18`
Expected: `✅ 验证通过 — 0 个错误`（现有 TaperedBox 部件渲染不受影响）。

- [ ] **Step 9: Commit**

```bash
git add model_factory.html models/enemies.js
git commit -m "feat(humanoid): TaperedBox底面偏移bx/bz + RidgeBox五边形截面几何(两处createGeometry)"
```

---

### Task 2: 数据层 — `_applyFemaleCurves` 派生 + v1-成年女 覆盖

**Files:**

- Modify: `models/humanoid_config.js:1268-1272`（v1-成年女 派生）、`models/humanoid_config.js:1256` 后新增 `_applyFemaleCurves`

**Interfaces:**

- Consumes: Task 1 的 `RidgeBox` 类型（数据层只改 type/size 字符串与数组，不依赖几何函数）。
- Produces: `_applyFemaleCurves(tree)`（内部函数，无返回值，原地改 tree）；`SKELETON_VERSIONS['v1-成年女-20260810'].tree` 含 RidgeBox/底面偏移。

- [ ] **Step 1: 新增 `_applyFemaleCurves`（放在 `_deriveProportion` 之后、`SKELETON_VERSIONS` 之前）**

```js
// 只给 v1-成年女：胸 RidgeBox 五边形脊线 + 臀 TaperedBox 底面偏移（不污染共享 WORKING_SKELETON）
function _applyFemaleCurves(tree) {
  var find = function (n, nm) {
    if (n.name === nm) return n;
    if (n.children)
      for (var i = 0; i < n.children.length; i++) {
        var r = find(n.children[i], nm);
        if (r) return r;
      }
    return null;
  };
  var tu = find(tree, 'torso_upper');
  if (tu) {
    tu.type = 'RidgeBox';
    tu.size = [0.22, 0.29, 0.16, 0.31, 0.2, 0, 0, 0.2, 0.04];
  }
  var tl = find(tree, 'torso_lower');
  if (tl) {
    tl.size = [0.3, 0.154, 0.22, 0.22, 0.16, 0, 0, 0, -0.04];
  }
  var pv = find(tree, 'pelvis');
  if (pv) {
    pv.type = 'TaperedBox';
    pv.size = [0.3, 0.135, 0.22, 0.3, 0.22, 0, -0.04, 0, 0];
  }
}
```

- [ ] **Step 2: v1-成年女 派生调用 `_applyFemaleCurves`**

把 `SKELETON_VERSIONS['v1-成年女-20260810']` 的 `tree:` 从直接 `_deriveProportion(...)` 改成先派生再覆盖：

```js
SKELETON_VERSIONS['v1-成年女-20260810'] = {
  date: '2026-08-10',
  note: '成年女(窄肩0.9/长腿1.05/小头0.95 + 胸脊线/臀后凸)',
  tree: (function () {
    var t = _deriveProportion(WORKING_SKELETON, { shoulder: 0.9, leg: 1.05, head: 0.95 });
    _applyFemaleCurves(t);
    return t;
  })(),
};
```

- [ ] **Step 3: 验证 — Node 数据断言**

写临时脚本 `_verify_female.js`（项目根目录，`require('fs') + require('vm')` 加载 humanoid_config.js），断言后删除：

```js
const fs = require('fs'),
  vm = require('vm');
const sandbox = { window: {}, console: console };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync('models/humanoid_config.js', 'utf8'), sandbox);
const HC = sandbox.window.HumanoidConfig;
function find(n, nm) {
  if (n.name === nm) return n;
  if (n.children)
    for (const c of n.children) {
      const r = find(c, nm);
      if (r) return r;
    }
  return null;
}
const f = HC.SKELETON_VERSIONS['v1-成年女-20260810'].tree;
const m = HC.SKELETON_VERSIONS['v1-成年男-20260810'].tree;
const assert = (c, msg) => {
  if (!c) throw new Error('FAIL: ' + msg);
};
assert(find(f, 'torso_upper').type === 'RidgeBox', 'torso_upper 应为 RidgeBox');
assert(
  JSON.stringify(find(f, 'torso_upper').size) ===
    JSON.stringify([0.22, 0.29, 0.16, 0.31, 0.2, 0, 0, 0.2, 0.04]),
  'torso_upper size'
);
assert(find(f, 'torso_lower').size[8] === -0.04, 'torso_lower bz=-0.04');
assert(find(f, 'pelvis').type === 'TaperedBox', 'pelvis 应为 TaperedBox');
assert(find(f, 'pelvis').size[6] === -0.04, 'pelvis oz=-0.04');
assert(find(m, 'torso_upper').type === 'TaperedBox', '成年男 torso_upper 仍 TaperedBox（未污染）');
assert(find(HC.WORKING_SKELETON, 'torso_upper').type === 'TaperedBox', 'WORKING_SKELETON 未污染');
console.log('✅ 数据断言全部通过');
```

Run: `node _verify_female.js` → Expected 全绿。

- [ ] **Step 4: 删除临时脚本并 Commit**

```bash
rm _verify_female.js
git add models/humanoid_config.js
git commit -m "feat(humanoid): v1-成年女 _applyFemaleCurves 覆盖胸RidgeBox/臀底面偏移"
```

---

### Task 3: UI 层 — 调参面板滑块 + 端到端验证

**Files:**

- Modify: `model_factory.html:4356-4424`（TaperedBox 分支加底面偏移）、`model_factory.html:4424` 后新增 RidgeBox 分支

**Interfaces:**

- Consumes: Task 1 的 `RidgeBox` 几何 + Task 2 的派生数据。
- Produces: 选中 `torso_upper`（RidgeBox）出现「脊线高度/脊线凸出」滑块；选中 `torso_lower`（TaperedBox）出现「底面偏移 X/Z」滑块。

- [ ] **Step 1: TaperedBox 分支加「↙ 底面偏移」滑块**

在 `model_factory.html` 的 TaperedBox 分支（约 4408-4424，现有「↗ 顶面偏移」文件夹之后）追加，`t` 对象需补 `bx: sz[7] || 0, bz: sz[8] || 0`（加在 `oz` 之后）：

```js
const offF2 = geoF.addFolder('↙ 底面偏移');
offF2
  .add(t, 'bx', -5, 5, 0.005)
  .name('X偏移')
  .onChange((v) => {
    saveUndo('TBBXoff');
    configNode.size[7] = v;
    rebuild();
  });
offF2
  .add(t, 'bz', -5, 5, 0.005)
  .name('Z偏移')
  .onChange((v) => {
    saveUndo('TBBZoff');
    configNode.size[8] = v;
    rebuild();
  });
```

- [ ] **Step 2: 新增 RidgeBox 分支（在 TaperedBox 分支之后）**

```js
} else if (configNode.type === 'RidgeBox') {
  // size: [底宽, 高, 底深, 顶宽, 顶深, 顶面X偏移, 顶面Z偏移, 脊线高度, 脊线凸出]
  const sz = configNode.size || [0.5, 0.3, 0.5, 0.35, 0.35, 0, 0, 0.15, 0.04];
  const r = {
    bw: sz[0], h: sz[1], bd: sz[2],
    tw: sz[3] || sz[0] * 0.6, td: sz[4] || sz[2] * 0.6,
    ox: sz[5] || 0, oz: sz[6] || 0,
    ridgeY: sz[7] != null ? sz[7] : 0.5 * (sz[1] || 1), ridgeZ: sz[8] || 0,
  };
  const _mk = (prop, idx, name, undo) => geoF.add(r, prop, 0.01, 10.0, 0.005).name(name).onChange((v) => { saveUndo(undo); configNode.size[idx] = v; rebuild(); });
  _mk('bw', 0, '底宽', 'RBbw');
  _mk('h', 1, '高度', 'RBh');
  _mk('bd', 2, '底深', 'RBbd');
  _mk('tw', 3, '顶宽', 'RBtw');
  _mk('td', 4, '顶深', 'RBtd');
  const offF = geoF.addFolder('↗ 顶面偏移');
  offF.add(r, 'ox', -5, 5, 0.005).name('X偏移').onChange((v) => { saveUndo('RBoxoff'); configNode.size[5] = v; rebuild(); });
  offF.add(r, 'oz', -5, 5, 0.005).name('Z偏移').onChange((v) => { saveUndo('RBozoff'); configNode.size[6] = v; rebuild(); });
  const ridgeF = geoF.addFolder('🐻 胸前脊线');
  ridgeF.add(r, 'ridgeY', 0, 10.0, 0.005).name('脊线高度').onChange((v) => { saveUndo('RBridgeY'); configNode.size[7] = v; rebuild(); });
  ridgeF.add(r, 'ridgeZ', -1, 1, 0.005).name('脊线凸出').onChange((v) => { saveUndo('RBridgeZ'); configNode.size[8] = v; rebuild(); });
```

- [ ] **Step 3: 端到端渲染验证 — Playwright inspect 几何顶点**

写临时脚本 `_verify_render.js`（项目根目录，用 `require('playwright')`），切到 v1-成年女 后读 `window.modelRoot` 的 mesh world 坐标，断言胸脊线凸出 ≈ ridgeZ、臀交界边后移 ≈ 0.04，跑完删除。核心 evaluate：

```js
// 切「校园丧尸 → 骨架(共通) → v1-成年女」后：
const r = await p.evaluate(() => {
  function meshes(key) {
    const out = [];
    window.modelRoot.traverse((o) => {
      if (o.isMesh && o.name && o.name.indexOf(key) >= 0) out.push(o);
    });
    return out;
  }
  const tu = meshes('torso_upper')[0]; // RidgeBox
  const tl = meshes('torso_lower')[0];
  const pv = meshes('pelvis')[0];
  // 胸：torso_upper 几何的 bbox（含脊线）在 z 方向的范围，与去掉 ridgeZ 的平顶应有差
  const tuBB = new THREE.Box3().setFromObject(tu);
  return {
    tuType: tu.geometry.type, // 'BufferGeometry'
    tuBBoxZ: [tuBB.min.z, tuBB.max.z],
    tlBBoxZ: [new THREE.Box3().setFromObject(tl).min.z, new THREE.Box3().setFromObject(tl).max.z],
    pvBBoxZ: [new THREE.Box3().setFromObject(pv).min.z, new THREE.Box3().setFromObject(pv).max.z],
  };
});
// 断言：tuBBoxZ.max 相对 torso_upper 中心前凸 ≈ 0.04 以上；tlBBoxZ.min 与 pvBBoxZ 在交界处后凸（z 更小）
```

（具体断言在实现时按渲染实际坐标微调；关键是要 `torso_upper` 的前面 z 明显大于平顶插值，且 `torso_lower`/`pelvis` 交界 z 比改前更靠 -z。）

- [ ] **Step 4: 可调性验证 — 选中部件出现新滑块**

同一 Playwright 脚本里，通过 lil-gui 选中 `torso_upper`，断言出现「🐻 胸前脊线」文件夹和「脊线高度/脊线凸出」；选中 `torso_lower` 断言出现「↙ 底面偏移」。

- [ ] **Step 5: 视觉验证 — 截图 + vision.py 识图**

```bash
# 前视图 + 侧视图各截一张
node _verify_render.js   # 脚本内已截图 _pw_female_front.png / _pw_female_side.png
python vision.py _pw_female_side.png "侧视图：这个3D人形白模的胸部是否向前隆起、臀部是否向后凸出？有没有破面/黑面？"
python vision.py _pw_female_front.png "正视图：胸前是否有一条水平脊线隆起？"
```

- [ ] **Step 6: 控制台 0 错误 + 清理**

Run: `python cdp_verify.py http://127.0.0.1:8080/model_factory.html --timeout 18` → 0 错误。
删除临时脚本与截图：`rm _verify_render.js _pw_female_*.png`

- [ ] **Step 7: Commit + 文档同步**

```bash
git add model_factory.html
git commit -m "feat(humanoid): 调参面板补RidgeBox脊线/底面偏移滑块"
```

文档同步（若本次不 bump 版本号，则更新 CLAUDE.md 会话变更段 + CODEBUDDY.md + .trae/rules/project_rules.md 三处保持一致）。

---

## Self-Review 备注

- **Spec 覆盖**：RidgeBox（Task 1）+ TaperedBox 底面偏移（Task 1）+ v1-成年女 覆盖（Task 2）+ 调参面板（Task 3）+ 可调/视觉/0 错误（Task 3）。
- **脊线长度插值**：已在 `buildRidgeBox` 里用 `wRidge = bw + (ridgeY/h)*(tw-bw)` 实现，无独立宽度参数。
- **向后兼容**：TaperedBox 的 `bx/bz` 在调用处 `||0` 兜底，旧 7 参数数据渲染不变。
- **风险点**：RidgeBox 法线方向（Step 3 已按 buildTaperedBox 的 quad 绕序核对），若视觉验证出现黑面，检查 `tri` 绕序。
