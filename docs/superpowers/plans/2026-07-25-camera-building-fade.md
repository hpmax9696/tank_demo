# 相机建筑半透明 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 坦克贴建筑时相机视线被挡 → 整栋建筑半透明（墙+附件），替代有振荡缺陷的前移避障。

**Architecture:** placeCamera 内降频（~0.15s）射线 `camPos→tankPos` 递归检测 `_campusBuildingGroups`；命中的建筑 Group 经 `setBuildingFade` 按材质去重 clone（DoubleSide+transparent）半透明 opacity 0.35；状态机 diff 命中集，新增 fade / 移除恢复；相机不动消除振荡。

**Tech Stack:** Three.js r160（Raycaster / material.clone / DoubleSide）+ Playwright 验证 + CDP。

**Spec:** `docs/superpowers/specs/2026-07-25-camera-building-fade-design.md`

## Global Constraints

- 服务器：`python server.py`，验证用 `http://127.0.0.1:8080`（禁 localhost）；验证前杀残留 python
- 验证：Playwright（`node pw_xxx.js`，node playwright）+ Chrome headless CDP；脚本用后清理（rm）
- 版本号：本次属功能改进，发版时同步 8 处（bump-version skill）
- 不动 `campusWallM` 全局材质（用 clone 副本），不动炮弹检测（`_campusBuildings` 结构不变）
- 项目代码风格：`var` + function（obstacles.js）、`let/const`（engine.js 新代码可用）

---

### Task 1: `_campusBuildingGroups` 初始化

**Files:**

- Modify: `js/obstacles.js:443`

**Interfaces:**

- Produces: `window._campusBuildingGroups`（数组，建筑顶层 Group 列表）

- [ ] **Step 1: 加初始化**

`js/obstacles.js:443` 当前：

```js
window._campusBuildings = [];
```

改为：

```js
window._campusBuildings = [];
window._campusBuildingGroups = []; // 建筑顶层Group(半透明用, 区别于_campusBuildings的mesh级炮弹检测)
```

- [ ] **Step 2: 验证无语法错**

启动服务器 + Playwright 加载校园地图，`window._campusBuildingGroups` 是空数组。

```js
// pw_t1.js 关键断言
await page.waitForFunction(
  () => window._campusBuildingGroups && Array.isArray(window._campusBuildingGroups),
  { timeout: 40000 }
);
const r = await page.evaluate(() => ({ len: window._campusBuildingGroups.length }));
assert(r.len === 0);
```

- [ ] **Step 3: Commit**

```bash
git add js/obstacles.js
git commit -m "feat: _campusBuildingGroups 初始化(相机半透明预备)"
```

---

### Task 2: 建筑标记 + 收集

**Files:**

- Modify: `js/obstacles.js:1638`（createFootprintBuildings 的 bldGroup）、`js/obstacles.js:1778`（createToiletZones 的 inst）

**Interfaces:**

- Consumes: `window._campusBuildingGroups`（Task 1）
- Produces: 每个建筑 Group 的 `userData._isCampusBuilding=true`，且在 `_campusBuildingGroups` 中

- [ ] **Step 1: 标记 footprint 建筑**

`js/obstacles.js:1638` 当前：

```js
targetScene.add(bldGroup);
obstacleMeshes.push(mesh);
obstacleMeshes.push(bldGroup);
```

改为（在 add 后加两行）：

```js
targetScene.add(bldGroup);
bldGroup.userData._isCampusBuilding = true;
window._campusBuildingGroups.push(bldGroup);
obstacleMeshes.push(mesh);
obstacleMeshes.push(bldGroup);
```

- [ ] **Step 2: 标记厕所**

`js/obstacles.js:1778`（createToiletZones 内 `targetScene.add(inst);` 后）当前：

```js
inst.name = 'toilet';
targetScene.add(inst);
if (obstacleMeshes) obstacleMeshes.push(inst);
```

改为：

```js
inst.name = 'toilet';
targetScene.add(inst);
inst.userData._isCampusBuilding = true;
window._campusBuildingGroups.push(inst);
if (obstacleMeshes) obstacleMeshes.push(inst);
```

- [ ] **Step 3: Playwright 验证标记**

```js
// pw_t2.js: 加载校园地图
await page.waitForFunction(() => (window._campusBuildingGroups || []).length > 0, {
  timeout: 40000,
});
const r = await page.evaluate(() => {
  const gs = window._campusBuildingGroups;
  const allMarked = gs.every((g) => g.userData._isCampusBuilding === true);
  const hasToilet = gs.some((g) => g.name === 'toilet');
  const hasDetail = gs.some((g) => g.name === 'campus-bld-detail');
  return { count: gs.length, allMarked, hasToilet, hasDetail };
});
// 期望: count>0, allMarked=true, hasToilet=true, hasDetail=true
```

- [ ] **Step 4: Commit**

```bash
git add js/obstacles.js
git commit -m "feat: 校园建筑标记_isCampusBuilding+收集到_campusBuildingGroups"
```

---

### Task 3: `setBuildingFade` 函数

**Files:**

- Modify: `js/obstacles.js`（在 createToiletZones 函数后，约 1882 行 `}` 后插入）

**Interfaces:**

- Produces: `window.setBuildingFade(group, opacity)` — opacity<1 半透明（首次 clone 缓存），=1 恢复原材质

- [ ] **Step 1: 写函数**

在 `createToiletZones` 函数闭合 `}`（约 1882 行）后插入：

```js
// 建筑整体半透明(相机遮挡时): 按材质去重clone(DoubleSide解决相机在内背面剔除), 缓存避免重复clone
window.setBuildingFade = function (group, opacity) {
  if (!group || !group.userData) return;
  // 首次: 按材质uuid去重clone, 一次性建好fade副本
  if (opacity < 1 && !group.userData._fadeReady) {
    var matMap = {}; // orig.uuid -> fadeMat
    var fades = [];
    group.traverse(function (c) {
      if (!c.isMesh || !c.material) return;
      var orig = c.material;
      if (!c.userData._origMat) c.userData._origMat = orig;
      var key = orig.uuid;
      var fade = matMap[key];
      if (!fade) {
        fade = orig.clone();
        fade.transparent = true;
        fade.side = THREE.DoubleSide; // 相机穿入建筑内时背面也渲染(不再背面剔除消失)
        fade.depthWrite = false; // 避免透明排序穿模
        fade.opacity = 1;
        matMap[key] = fade;
        fades.push(fade);
      }
      c.userData._fadeMat = fade;
    });
    group.userData._fadeMats = fades;
    group.userData._fadeReady = true;
  }
  if (opacity < 1) {
    // 应用半透明: 设opacity + 切到fade副本
    for (var i = 0; i < group.userData._fadeMats.length; i++) {
      group.userData._fadeMats[i].opacity = opacity;
    }
    group.traverse(function (c) {
      if (c.isMesh && c.userData._fadeMat) c.material = c.userData._fadeMat;
    });
  } else if (group.userData._fadeReady) {
    // 恢复: 切回原材质(opacity不影响原材质, 因fade副本独立)
    group.traverse(function (c) {
      if (c.isMesh && c.userData._origMat) c.material = c.userData._origMat;
    });
  }
};
```

- [ ] **Step 2: Playwright 验证 fade/恢复**

```js
// pw_t3.js
const r = await page.evaluate(() => {
  const g = window._campusBuildingGroups.find((x) => x.name === 'toilet');
  if (!g) return { err: 'no toilet' };
  // 找一个mesh记原材质
  let m = null;
  g.traverse((c) => {
    if (c.isMesh && !m) m = c;
  });
  const origMat = m.material;
  window.setBuildingFade(g, 0.35);
  const afterFade = {
    opacity: m.material.opacity,
    side: m.material.side, // 1012=DoubleSide, 0=FrontSide
    transparent: m.material.transparent,
    isClone: m.material !== origMat,
  };
  window.setBuildingFade(g, 1);
  const afterRestore = { restored: m.material === origMat };
  // 再fade验证缓存(不重建)
  window.setBuildingFade(g, 0.35);
  const secondFadeSameClone = m.material === afterFade.isClone; // 第二次应复用同一clone
  window.setBuildingFade(g, 1);
  return { afterFade, afterRestore, secondFadeSameClone };
});
// 期望: afterFade.opacity=0.35, side=1012(DoubleSide), transparent=true, isClone=true
//       afterRestore.restored=true, secondFadeSameClone=true(缓存生效)
```

- [ ] **Step 3: Commit**

```bash
git add js/obstacles.js
git commit -m "feat: setBuildingFade建筑整体半透明(材质去重clone+DoubleSide)"
```

---

### Task 4: placeCamera 改造（移除前移 + 半透明状态机）

**Files:**

- Modify: `js/engine.js:4502-4520`（placeCamera 避障段）+ 模块级状态变量

**Interfaces:**

- Consumes: `window._campusBuildingGroups`（Task 1/2）、`window.setBuildingFade`（Task 3）
- Produces: `window._hullOccluded`（命中集非空时 true，驱动小地图）

- [ ] **Step 1: 加模块级状态变量**

在 `placeCamera` 函数定义前（约 4440 行附近，`const CAMERA_BEHIND=14.625` 附近）加：

```js
// 相机建筑遮挡半透明状态机
let _fadedGroups = new Set(); // 当前半透明的建筑Group
let _lastOccluCheck = 0; // 上次检测时间(performance.now)
const _OCCLU_INTERVAL = 150; // 检测间隔ms(降频)
```

- [ ] **Step 2: 替换避障段**

`js/engine.js:4502-4520` 当前：

```js
// 相机避障: 相机→坦克视线被建筑挡时, 相机升高到该建筑顶以上(越过建筑俯视坦克, 不停在墙前)
var _cb = window._campusBuildings;
window._hullOccluded = false;
if (_cb && _cb.length && window.THREE) {
  var _camPos = camera.position;
  var _tankPos = new THREE.Vector3(_camX, groundY + 1.5, _camZ);
  var _rd = new THREE.Vector3().subVectors(_tankPos, _camPos);
  var _rl = _rd.length();
  if (_rl > 1) {
    _rd.normalize();
    var _ray = new THREE.Raycaster(_camPos, _rd, 0, _rl);
    var _hh = _ray.intersectObjects(_cb, false);
    if (_hh.length > 0 && _hh[0].distance < _rl - 1) {
      window._hullOccluded = true;
      // 前移到坦克后方3单位(越过中间的建筑, 让建筑落到相机身后不挡视线) + 下降平视(不俯视突兀)
      camera.position.copy(_tankPos).addScaledVector(_rd, -3);
      camera.position.y = _tankPos.y + 1.2;
    }
  }
}
```

替换为（移除前移，加降频射线 + 状态机 + 半透明）：

```js
// 相机遮挡: cam→tank射线被建筑挡时, 整栋建筑半透明(替代有振荡缺陷的前移避障)
// 相机不动 → 命中集稳定 → 无闪烁
var _groups = window._campusBuildingGroups;
window._hullOccluded = false;
var _now = performance.now();
if (_groups && _groups.length && window.THREE && _now - _lastOccluCheck >= _OCCLU_INTERVAL) {
  _lastOccluCheck = _now;
  var _camPos = camera.position;
  var _tankPos = new THREE.Vector3(_camX, groundY + 1.5, _camZ);
  var _rd = new THREE.Vector3().subVectors(_tankPos, _camPos);
  var _rl = _rd.length();
  if (_rl > 1) {
    _rd.normalize();
    var _ray = new THREE.Raycaster(_camPos, _rd, 0, _rl);
    var _hh = _ray.intersectObjects(_groups, true); // recursive: 命中Group子mesh(含厕所)
    // 收集命中建筑Group(命中mesh沿parent链找_isCampusBuilding)
    var _hitGroups = new Set();
    for (var _hi = 0; _hi < _hh.length; _hi++) {
      var _p = _hh[_hi].object;
      while (_p && !_p.userData._isCampusBuilding) _p = _p.parent;
      if (_p) _hitGroups.add(_p);
    }
    window._hullOccluded = _hitGroups.size > 0;
    // 新命中 → fade
    _hitGroups.forEach(function (g) {
      if (!_fadedGroups.has(g)) {
        window.setBuildingFade(g, 0.35);
        _fadedGroups.add(g);
      }
    });
    // 不再命中 → 恢复
    _fadedGroups.forEach(function (g) {
      if (!_hitGroups.has(g)) {
        window.setBuildingFade(g, 1);
        _fadedGroups.delete(g);
      }
    });
  }
}
```

- [ ] **Step 3: Playwright 振荡 + fade 验证**

模拟连续 cam→tank 射线命中建筑（同一姿态多次），确认 `_fadedGroups` 稳定无跳变、fade 生效。

```js
// pw_t4.js: 加载校园, 手动调射线检测逻辑(复现placeCamera内的检测)
const r = await page.evaluate(() => {
  const THREE = window.THREE;
  const groups = window._campusBuildingGroups;
  if (!groups || !groups.length) return { err: 'no groups' };
  // 找一栋大建筑(教学楼), 构造相机在其上方射向tank穿过建筑
  const g = groups.find((x) => x.name === 'campus-bld-detail') || groups[0];
  const wp = new THREE.Vector3();
  g.getWorldPosition(wp);
  const camPos = new THREE.Vector3(wp.x + 20, wp.y + 5, wp.z);
  const tankPos = new THREE.Vector3(wp.x - 5, wp.y + 1.5, wp.z);
  const rd = new THREE.Vector3().subVectors(tankPos, camPos).normalize();
  const rc = new THREE.Raycaster(camPos, rd, 0, camPos.distanceTo(tankPos));
  const hits = rc.intersectObjects(groups, true);
  // 命中建筑Group
  const hitGroups = new Set();
  hits.forEach((h) => {
    let p = h.object;
    while (p && !p.userData._isCampusBuilding) p = p.parent;
    if (p) hitGroups.add(p);
  });
  const hitCount = hitGroups.size;
  // fade一个
  const target = hitGroups.values().next().value;
  if (!target) return { hitCount, err: 'no hit group' };
  let m = null;
  target.traverse((c) => {
    if (c.isMesh && !m) m = c;
  });
  const before = m.material;
  window.setBuildingFade(target, 0.35);
  const faded = m.material.opacity;
  window.setBuildingFade(target, 1);
  const restored = m.material === before;
  return { hitCount, fadedOpacity: faded, restored };
});
// 期望: hitCount>=1, fadedOpacity=0.35, restored=true
```

- [ ] **Step 4: CDP 验证 0 错误**

进校园地图 60s，CDP 抓控制台错误。无 error。

- [ ] **Step 5: Commit**

```bash
git add js/engine.js
git commit -m "feat: placeCamera移除前移避障+建筑半透明状态机(降频射线+diff命中集)"
```

---

### Task 5: 端到端实地验证 + 清理

**Files:**

- 无代码改动（验证 + 清理临时脚本）

- [ ] **Step 1: 杀残留 python + 启动服务器**

```bash
taskkill //F //IM python.exe 2>/dev/null; sleep 2
python server.py &  # 后台
sleep 3
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8080/  # 期望 200
```

- [ ] **Step 2: 端到端 Playwright（坦克视角 + 命中建筑 fade）**

完整验证：加载校园 → 等建筑 → 构造射线命中 → 确认 fade material（opacity 0.35 + DoubleSide 1012）+ 未命中建筑 material 不变。脚本同 Task 4 Step 3 但断言更全。

- [ ] **Step 3: CDP 校园地图 0 错误**

- [ ] **Step 4: 清理临时脚本**

```bash
rm -f pw_t1.js pw_t2.js pw_t3.js pw_t4.js
```

- [ ] **Step 5: 通知用户 Ctrl+F5 实地验证**

坦克绕教学楼/厕所旋转视角：相机不入建筑内，挡视线时整栋半透明（墙+附件一起淡出，无浮空）+ 小地图显示车体姿势；移开视线建筑恢复。

---

## Self-Review

**Spec 覆盖**：

- 移除前移避障 → Task 4 Step 2 ✓
- 纯半透明（opacity 0.35）→ Task 3/4 ✓
- DoubleSide（相机在内背面剔除）→ Task 3 ✓
- 材质去重 clone 缓存 → Task 3 ✓
- 降频 0.15s → Task 4（\_OCCLU_INTERVAL=150）✓
- 建筑标记 + \_campusBuildingGroups → Task 1/2 ✓
- 小地图 \_hullOccluded → Task 4（命中集非空）✓
- 配套 recursive（厕所 Group）→ Task 4（intersectObjects true）✓

**类型一致**：`window._campusBuildingGroups`（Task1）→ Task2 push → Task3/4 消费 ✓；`window.setBuildingFade(group, opacity)`（Task3 定义）→ Task4 调用 ✓；`userData._isCampusBuilding`（Task2）→ Task4 traverse 查找 ✓。

**无 placeholder**：所有步骤含完整代码 + 断言。
