# 校园丧尸 P3 刷新系统 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现校园丧尸定时门刷新系统——进图按 spawnConfig 生成初始游荡丧尸 + 每 interval 秒从随机门补充 batch 只到 cap 上限，让校园有源源不断的丧尸。

**Architecture:** 新增 `js/campus_spawner.js`（IIFE + `window.CampusSpawner`，无状态对外：init/initialPopulate/update/isActive）。从 `footprintBuildings.edgeMarks`(type=corridor) 提取门位置（边中点），可达点采样避开建筑 footprint/boundary。engine.js 的 createEnemies 末尾调 init+initialPopulate，gameLoop 调 update。

**Tech Stack:** 原生 JS（IIFE + window 暴露）、Three.js、Playwright 验证。

## Global Constraints

- 变体名 `student_m/student_f/teacher_m/teacher_f`，工厂 `window.EnemyModels.createCampusZombie({variant,heightM,seed})`（P1 已就绪）
- `type='zombie' + userData.variant=<变体名> + userData.enemyType='zombie'`（P1 的 enemyAI 对接约定）
- `METERS_PER_UNIT=1.3`，学生身高 1.1–1.5m、教师 1.55–1.75m
- 师生两层强度：学生 hp40/speed2.0/viewDist25/attackDamage8/score50，教师 hp120/speed1.0/viewDist40/attackDamage20/score200
- 零回归：不动 createCampusZombie / createEnemies 既有逻辑 / 现有丧尸 AI；spawner 只在 spawnConfig.enabled 时激活，其他地图零影响
- spawnConfig 字段：`{enabled, initialCount, interval, batch, cap, ratio, doors?}`（doors 可选，缺省自动从 edgeMarks 提取）
- 用 Edit 局部改，**不跑 prettier**（engine.js 4 空格手格式，与 enemies.js 同需保护）

## File Structure

| 文件                   | 责任                                              | 改动      |
| ---------------------- | ------------------------------------------------- | --------- |
| `js/campus_spawner.js` | 刷新系统模块 + 暴露 `window.CampusSpawner`        | 新建      |
| `js/engine.js`         | createEnemies 末尾启 spawner + gameLoop 调 update | 改 ~6 行  |
| `index.html`           | 加载 campus_spawner.js                            | +1 script |

---

## Task 1: `js/campus_spawner.js` — 刷新系统模块

**Files:**

- Create: `js/campus_spawner.js`

**Interfaces:**

- Consumes: `window.EnemyModels.createCampusZombie`（P1）、`window.getGroundHeight`（engine 暴露，terrain 高度；campus flat 为 0）
- Produces: `window.CampusSpawner = { init(currentMapData):Boolean, initialPopulate(currentMapData, enemies, scene, getGroundHeight, halfW, halfD), update(dt, currentMapData, enemies, scene, getGroundHeight), isActive():Boolean }`

- [ ] **Step 1: 创建 `js/campus_spawner.js`**

```js
// js/campus_spawner.js
// 校园丧尸定时门刷新系统 —— 读 currentMapData.spawnConfig，进图初始生成 + 定时从门补充
// IIFE + window.CampusSpawner，无状态对外：init / initialPopulate / update / isActive
(function () {
  let _cfg = null; // spawnConfig
  let _doors = []; // [[x,z], ...] 门位置（建筑边中点）
  let _timer = 0; // 刷新计时器(秒)
  let _seedCnt = 2000; // seed 计数(保证每只唯一)
  let _active = false;

  // ── 几何工具 ──
  // 射线法点在多边形内
  function _pointInPolygon(pt, poly) {
    if (!poly || poly.length < 3) return false;
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i][0],
        yi = poly[i][1],
        xj = poly[j][0],
        yj = poly[j][1];
      if (yi > pt[1] !== yj > pt[1] && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi)
        inside = !inside;
    }
    return inside;
  }

  // 点是否可达(避开建筑 footprint 内; 若有 boundary 须在 boundary 内)
  function _isReachable(x, z, currentMapData) {
    const obs = currentMapData.obstacles || {};
    const blds = obs.footprintBuildings || [];
    for (const b of blds) {
      if (b.footprint && _pointInPolygon([x, z], b.footprint)) return false;
    }
    const boundary = obs.boundary;
    if (boundary && boundary.length >= 3 && !_pointInPolygon([x, z], boundary)) return false;
    return true;
  }

  // 随机可达点(最多尝试 40 次)
  function _reachablePoint(currentMapData, halfW, halfD) {
    for (let i = 0; i < 40; i++) {
      const x = (Math.random() * 2 - 1) * halfW * 0.85;
      const z = (Math.random() * 2 - 1) * halfD * 0.85;
      if (_isReachable(x, z, currentMapData)) return [x, z];
    }
    return [0, 0]; // 兜底中心
  }

  // 从 footprintBuildings.edgeMarks(type=corridor) 提取门位置(边中点)
  // edgeMarks: [{ei, type}]，ei = footprint 点索引，边 ei = fp[ei]→fp[ei+1]
  function _extractDoors(currentMapData) {
    const doors = [];
    const blds = (currentMapData.obstacles && currentMapData.obstacles.footprintBuildings) || [];
    for (const b of blds) {
      const fp = b.footprint;
      const marks = b.edgeMarks || [];
      for (const m of marks) {
        if (m.type !== 'corridor') continue;
        const ei = m.ei;
        if (ei == null || !fp || !fp[ei]) continue;
        const a = fp[ei];
        const c = fp[(ei + 1) % fp.length];
        doors.push([(a[0] + c[0]) / 2, (a[1] + c[1]) / 2]);
      }
    }
    return doors;
  }

  // 按 ratio 权重抽变体
  function _pickVariant(ratio) {
    const entries = Object.entries(ratio || {});
    if (!entries.length) return 'student_m';
    const total = entries.reduce((s, [, v]) => s + v, 0);
    let r = Math.random() * total;
    for (const [k, v] of entries) {
      r -= v;
      if (r <= 0) return k;
    }
    return entries[entries.length - 1][0];
  }

  // 变体默认 cfg(师生两层强度)
  const VARIANT_CFG = {
    student_m: {
      hp: 40,
      speed: 2.0,
      viewDist: 25,
      attackDamage: 8,
      attackCooldown: 1.5,
      dropRate: 0.25,
      dropHeal: 30,
      score: 50,
    },
    student_f: {
      hp: 40,
      speed: 2.0,
      viewDist: 25,
      attackDamage: 8,
      attackCooldown: 1.5,
      dropRate: 0.25,
      dropHeal: 30,
      score: 50,
    },
    teacher_m: {
      hp: 120,
      speed: 1.0,
      viewDist: 40,
      attackDamage: 20,
      attackCooldown: 2.5,
      dropRate: 0.25,
      dropHeal: 30,
      score: 200,
    },
    teacher_f: {
      hp: 120,
      speed: 1.0,
      viewDist: 40,
      attackDamage: 20,
      attackCooldown: 2.5,
      dropRate: 0.25,
      dropHeal: 30,
      score: 200,
    },
  };

  // 生成一只丧尸并注册到 enemies + scene
  function _spawnEnemy(variant, x, z, enemies, scene, getGroundHeight) {
    const isTeacher = variant.indexOf('teacher') === 0;
    const hRange = isTeacher ? [1.55, 1.75] : [1.1, 1.5];
    const heightM = hRange[0] + Math.random() * (hRange[1] - hRange[0]);
    const model = window.EnemyModels.createCampusZombie({ variant, heightM, seed: _seedCnt++ });
    const gy = typeof getGroundHeight === 'function' ? getGroundHeight(x, z) : 0;
    model.position.set(x, gy, z);
    model.rotation.set(0, Math.random() * Math.PI * 2, 0);
    // cfg + hp + userData + ai(对齐 createEnemies 的丧尸初始化)
    const baseCfg = VARIANT_CFG[variant] || VARIANT_CFG.student_m;
    model.cfg = Object.assign({ reactive: true, aggressive: false }, baseCfg);
    model.hp = baseCfg.hp;
    model.userData = model.userData || {};
    model.userData.maxHp = model.hp;
    model.userData.enemyType = 'zombie'; // 走丧尸 8 状态机
    model.userData.variant = variant;
    model.userData._noTerrainPitch = true; // 人形直立
    model.ai = {
      state: 'idle',
      target: null,
      patrolIndex: 0,
      lastSeenPlayerPos: null,
      animRequest: 'idle',
      attackCooldown: 0,
    };
    enemies.push(model);
    if (scene) scene.add(model);
    return model;
  }

  // ── 对外 API ──

  // 初始化(读 spawnConfig + 提取门)。返回是否激活。
  function init(currentMapData) {
    const cfg = currentMapData && currentMapData.spawnConfig;
    if (!cfg || !cfg.enabled) {
      _active = false;
      return false;
    }
    _cfg = cfg;
    _doors = cfg.doors && cfg.doors.length ? cfg.doors : _extractDoors(currentMapData);
    _timer = 0;
    _active = true;
    console.log(
      '🧟 campus_spawner 启用 | 初始',
      cfg.initialCount,
      '每',
      cfg.interval + 's刷',
      cfg.batch,
      '上限',
      cfg.cap,
      '门',
      _doors.length
    );
    return true;
  }

  // 进图初始游荡(initialCount 只, 按比例随机可达点)
  function initialPopulate(currentMapData, enemies, scene, getGroundHeight, halfW, halfD) {
    if (!_active || !_cfg) return;
    const halfWv = halfW != null ? halfW : 80;
    const halfDv = halfD != null ? halfD : 60;
    for (let i = 0; i < (_cfg.initialCount || 0); i++) {
      const v = _pickVariant(_cfg.ratio);
      const p = _reachablePoint(currentMapData, halfWv, halfDv);
      _spawnEnemy(v, p[0], p[1], enemies, scene, getGroundHeight);
    }
  }

  // 每帧调用: 计时到 interval 且低于 cap 时从随机门刷 batch 只
  function update(dt, currentMapData, enemies, scene, getGroundHeight) {
    if (!_active || !_cfg) return;
    _timer += dt;
    if (_timer < (_cfg.interval || 20)) return;
    _timer = 0;
    const alive = enemies.filter(function (e) {
      return e && !(e.userData && e.userData._dead);
    });
    if (alive.length >= (_cfg.cap || 30)) return;
    if (!_doors.length) return;
    const batch = _cfg.batch || 6;
    for (let i = 0; i < batch; i++) {
      const v = _pickVariant(_cfg.ratio);
      const door = _doors[Math.floor(Math.random() * _doors.length)];
      const x = door[0] + (Math.random() - 0.5) * 2.5;
      const z = door[1] + (Math.random() - 0.5) * 2.5;
      _spawnEnemy(v, x, z, enemies, scene, getGroundHeight);
    }
    console.log('🧟 campus_spawner 刷新', batch, '| 当前总数', enemies.length);
  }

  function isActive() {
    return _active;
  }

  window.CampusSpawner = { init, initialPopulate, update, isActive };
  console.log('🧟 campus_spawner 模块就绪');
})();
```

- [ ] **Step 2: CDP 验证模块加载**

`taskkill //F //IM python.exe`（残留）→ `python server.py` → CDP/Playwright `http://127.0.0.1:8080/index.html` 控制台：

```js
(typeof window.CampusSpawner, window.CampusSpawner && Object.keys(window.CampusSpawner));
```

Expected: `'object', ['init','initialPopulate','update','isActive']`；控制台 0 错误。

- [ ] **Step 3: Commit**

```bash
git add js/campus_spawner.js
git commit -m "feat(P3): campus_spawner.js 刷新系统模块(门提取/可达点/定时刷新/比例抽变体)"
```

---

## Task 2: engine.js 接线 + index.html 加载

**Files:**

- Modify: `js/engine.js`（createEnemies 末尾 + gameLoop）
- Modify: `index.html`（+1 script）

**Interfaces:**

- Consumes: `window.CampusSpawner`（Task 1）、engine 的 `enemies`/`scene`/`getGroundHeight`/`worldHalfW`/`worldHalfD`/`currentMapData`

- [ ] **Step 1: `index.html` 加载 campus_spawner.js**

Grep 定位 `<script src="models/enemies.js">`（约 index.html:1041）所在 script 块，在 enemies.js 之后、其他游戏模块附近加：

```html
<script src="js/campus_spawner.js"></script>
```

（放在 `js/` 模块加载区，如 `<script src="js/spatialGrid.js">` 旁边。）

- [ ] **Step 2: `js/engine.js` createEnemies 末尾启 spawner + 初始生成**

Grep 定位 `function createEnemies()`（约 engine.js:5328）。在 createEnemies 函数体的**末尾**（for 循环创建完所有 enemies 之后、`}` 闭合前）加：

```js
// P3: 校园刷新系统(仅 spawnConfig.enabled 激活, 其他地图零影响)
if (window.CampusSpawner && CampusSpawner.init(currentMapData)) {
  CampusSpawner.initialPopulate(
    currentMapData,
    enemies,
    scene,
    getGroundHeight,
    worldHalfW,
    worldHalfD
  );
}
```

（用 Edit 锚定 createEnemies 末尾的某行，如最后的 console.log 或闭合 `}`。注意 createEnemies 可能以 `console.log('🗺️ 地图敌人...')` 开头——那是开头，不要锚那；锚函数末尾。）

- [ ] **Step 3: `js/engine.js` gameLoop 调 spawner.update**

Grep 定位 gameLoop 内敌人 AI 更新处（如 `updateEnemyAI` 调用 或 `enemies.forEach` 遍历附近，约 engine.js:2200-2400 区间）。在敌人 update 之后、渲染之前加：

```js
if (window.CampusSpawner && CampusSpawner.isActive()) {
  CampusSpawner.update(dt, currentMapData, enemies, scene, getGroundHeight);
}
```

（dt 用 gameLoop 当帧的 delta 变量名——确认 gameLoop 里 delta 变量是 `dt` 还是 `delta`，用实际的。）

- [ ] **Step 4: CDP 验证接线无错**

CDP 加载 index.html 控制台 0 错误。Read/grep 确认三处接线存在。

- [ ] **Step 5: Commit**

```bash
git add index.html js/engine.js
git commit -m "feat(P3): engine/gameLoop 接 campus_spawner + index.html 加载"
```

---

## Task 3: 端到端验证（Playwright 定时刷新）

**Files:**

- Test: 临时 `pw_test_spawner.js`（用后清理）

**Interfaces:**

- Consumes: Task 1-2

- [ ] **Step 1: 写 `pw_test_spawner.js`**

```js
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push('console.error: ' + m.text());
  });
  await page.goto('http://127.0.0.1:8080/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.MAP_CONFIGS, null, { timeout: 15000 });
  await page.evaluate(() => document.getElementById('btn-enter').click());
  await page.waitForSelector('#map-list .map-item', { timeout: 8000 });
  await page.evaluate(() => {
    const items = [...document.querySelectorAll('#map-list .map-item')];
    const f = items.find((m) => /金福园|校园|campus/i.test(m.textContent));
    if (f) f.click();
  });
  await page.evaluate(() => document.getElementById('btn-start-game').click());
  // 等进图 + createEnemies + spawner 初始生成
  await page.waitForFunction(() => window.enemies && window.enemies.length >= 10, null, {
    timeout: 30000,
  });
  const init = await page.evaluate(() => ({
    count: window.enemies.length,
    spawnerActive: window.CampusSpawner && window.CampusSpawner.isActive(),
    variants: window.enemies
      .filter((e) => e.userData && e.userData.variant)
      .map((e) => e.userData.variant)
      .slice(0, 20),
  }));
  console.log('初始:', JSON.stringify(init));
  // 等一次刷新(interval 20s → 等 23s)
  await page.waitForTimeout(23000);
  const after = await page.evaluate(() => ({
    count: window.enemies.length,
    cap:
      window.currentMapData &&
      window.currentMapData.spawnConfig &&
      window.currentMapData.spawnConfig.cap,
  }));
  console.log('23s后:', JSON.stringify(after));
  console.log('errors:', errors.length, errors.slice(0, 3));
  await browser.close();
  // 初始应含 initialCount(15)+campus.map.json.enemies(4)=~19; 23s 后应增长(刷新)且<=cap(30)
  if (
    init.count < 15 ||
    !init.spawnerActive ||
    after.count <= init.count ||
    after.count > (after.cap || 30) + 6
  )
    process.exit(1);
})();
```

- [ ] **Step 2: 运行验证**

```bash
node pw_test_spawner.js
```

Expected: 初始 count≈19（15+4）、spawnerActive true；23s 后 count 增长（刷新了 6 只）且 ≤ cap+6；errors 0；退出码 0。

- [ ] **Step 3: 清理 + 提交**

```bash
rm pw_test_spawner.js
git add -A
git commit -m "test(P3): 验证校园丧尸定时门刷新端到端"
```

---

## Self-Review 结论

**Spec 覆盖**：本 plan 覆盖 spec 7.5（刷新系统：init/initialPopulate/update/门提取/可达点/比例/cap）。spawnConfig 已在 campus.map.json（P2 测试写入）。未覆盖：P4 工厂/P5 工具页/P6 精修（各自 plan）。

**类型一致性**：`CampusSpawner.{init,initialPopulate,update,isActive}` 签名在 Task 1 定义、Task 2 调用一致。`_spawnEnemy` 设的 userData/cfg/ai 与 createEnemies（P1）对齐（enemyType='zombie'/variant/\_noTerrainPitch/ai.state='idle'）。变体名 + VARIANT_CFG 师生两层与 P1/spec 6.7 一致。

**已知风险**：

1. gameLoop 的 delta 变量名（dt/delta）——Task 2 Step 3 提示 implementer 确认。
2. createEnemies 末尾锚点——Task 2 Step 2 提示别锚开头的 console.log。
3. 门位置（边中点）若在建筑墙内，丧尸可能卡墙——initialPopulate 用可达点（不卡），门刷新在门附近（门在墙边，可能略卡，Task 3 观察；必要时门刷新点向外偏移）。
4. cap 检查用 enemies.length（含死亡未移除的）——\_spawnEnemy 后 enemies 可能被引擎清理死亡者；update 用 alive 过滤（\_dead 标记）。

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-26-campus-zombies-p3-spawner.md`. 执行方式同 P1（Subagent-Driven 推荐 / Inline）。P3 完成后校园有定时门刷新，游戏体验完整。
