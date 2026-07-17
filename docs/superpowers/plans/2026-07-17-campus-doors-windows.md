# 校园建筑门窗系统 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为金福园小学 5 栋教学楼（综合楼1-3号+教学楼+高年级教学楼）的外廊面和空调面添加门窗户贴面几何体。

**Architecture:** 新增 `addDoorsAndWindows` 函数沿边按教室单元排列门和窗户（薄 Box 贴面），新增 `computeWindowRanges` 辅助函数计算窗户沿边 t 范围供空调避让。修改 `addACToEdge` 接收窗户范围参数实现避让。全部在 `js/obstacles.js` 内完成。

**Tech Stack:** Three.js r160 BoxGeometry + MeshStandardMaterial，复用 bldGroup 坐标系（rotation.x=-PI/2）。

## Global Constraints

- 仅 `js/obstacles.js` 修改，无数据格式变更
- 排除：工具房（无 edgeMarks）、B7 dome（拱顶）
- 门窗贴面在墙表面，不挖洞
- 用 skipSegs 裁剪天桥连接子段
- 教室宽度 ≈ 8u，自动整除边长
- 门 0.7×2.0u 木棕色，窗台高 0.8u 窗高 1.2u 淡蓝，3-4 扇细框
- CDP 验证 0 错误
- 空调外机避让窗户

---

## File Map

| 文件              | 职责                                                                                                          |
| ----------------- | ------------------------------------------------------------------------------------------------------------- |
| `js/obstacles.js` | 新增 `computeWindowRanges` + `addDoorsAndWindows`；修改 `addACToEdge` 加 `winRanges` 参数；修改建筑循环调用点 |

---

### Task 1: 新增 `computeWindowRanges` 辅助函数

**Files:**

- Modify: `js/obstacles.js` — 在 `addACToEdge` 闭包（第 741 行 `};`）后插入

**Interfaces:**

- Produces: `computeWindowRanges(edgeLen)` → `[{t0, t1}, ...]` — 每间教室窗户的边参数 t 范围

- [ ] **Step 1: 在 `addACToEdge` 结束后插入函数**

```javascript
// 计算一条边上所有教室窗户的 t 范围(供 addDoorsAndWindows 和 addACToEdge 避让共用)
var computeWindowRanges = function (edgeLen) {
  var cw = 8; // 标准教室宽度
  var nClassrooms = Math.max(1, Math.round(edgeLen / cw));
  var crw = edgeLen / nClassrooms; // 实际教室宽度
  var ranges = [];
  for (var ci = 0; ci < nClassrooms; ci++) {
    var c0 = ci * crw,
      c1 = (ci + 1) * crw;
    // 窗: 教室两端各留 1.5u (0.4墙 + 0.7门 + 0.4墙)
    var w0 = (c0 + 1.5) / edgeLen;
    var w1 = (c1 - 1.5) / edgeLen;
    if (w1 - w0 > 0.05) ranges.push({ t0: w0, t1: w1 });
  }
  return ranges;
};
```

- [ ] **Step 2: Commit**

```bash
git add js/obstacles.js && git commit -m "feat(campus): add computeWindowRanges helper"
```

---

### Task 2: 新增 `addDoorsAndWindows` 函数

**Files:**

- Modify: `js/obstacles.js` — 在 `computeWindowRanges` 之后插入

**Interfaces:**

- Consumes: `computeWindowRanges(edgeLen)` — 获取窗户 t 范围
- Produces: `addDoorsAndWindows(parent, ax, az, bx, bz, wallH, type, skipSegs, _stiltY)` — 无返回值，直接往 parent 添加 mesh

- [ ] **Step 1: 插入函数主体**

```javascript
// 沿建筑边添加门窗户(贴面薄Box)
// type='corridor': 前门+窗户(多扇)+后门; type='ac': 仅窗户(与走廊面对称)
var addDoorsAndWindows = function (parent, ax, az, bx, bz, wallH, type, skipSegs, _stiltY) {
  var dx = bx - ax,
    dz = bz - az;
  var edgeLen = Math.sqrt(dx * dx + dz * dz);
  if (edgeLen < 4) return;
  var ux = dx / edgeLen,
    uz = dz / edgeLen;
  var nx = -uz,
    nz = ux; // 外法线
  var ldx = dx,
    ldz = -dz;
  var edgeAngle = Math.atan2(ldz, ldx);
  var floorH = 3.0,
    sillH = 0.8,
    winH = 1.2,
    doorH = 2.0,
    doorW = 0.7;
  var wallOff = 0.02; // 门窗略突出墙面
  var nClassrooms = Math.max(1, Math.round(edgeLen / 8));
  var crw = edgeLen / nClassrooms;
  var winRanges = computeWindowRanges(edgeLen);

  // 共享材质(全局复用)
  if (!addDoorsAndWindows._doorMat) {
    addDoorsAndWindows._doorMat = new THREE.MeshStandardMaterial({
      color: '#8B6914',
      roughness: 0.7,
    });
    addDoorsAndWindows._glassMat = new THREE.MeshStandardMaterial({
      color: '#c8ddf0',
      roughness: 0.15,
      metalness: 0.3,
    });
    addDoorsAndWindows._frameMat = new THREE.MeshStandardMaterial({
      color: '#666666',
      roughness: 0.5,
    });
  }
  var doorMat = addDoorsAndWindows._doorMat;
  var glassMat = addDoorsAndWindows._glassMat;
  var frameMat = addDoorsAndWindows._frameMat;

  var nFloors = Math.floor(wallH / floorH);
  for (var fl = 0; fl < nFloors; fl++) {
    var floorY = fl * floorH;
    // 跳过架空层(柱子支撑, 首层无墙)
    if (_stiltY > 0 && floorY < _stiltY) continue;
    var yCenter = floorY + floorH / 2;
    // 天桥裁剪
    var seg = null;
    for (var si = 0; si < (skipSegs || []).length; si++) {
      var ss = skipSegs[si];
      if (yCenter >= ss.yRange[0] && yCenter < ss.yRange[1]) {
        seg = ss.segRange;
        break;
      }
    }
    // 按教室遍历
    for (var ci = 0; ci < nClassrooms; ci++) {
      var c0 = ci * crw,
        c1 = (ci + 1) * crw; // 教室在边的起止(单位)
      var c0t = c0 / edgeLen,
        c1t = c1 / edgeLen;

      // 窗户 t 范围
      var wr = winRanges[ci];
      var w0t = wr.t0,
        w1t = wr.t1;

      // -- 窗户 --
      // 裁剪: 窗与 seg 重叠则整扇跳过
      var winBlocked = seg && w0t < seg[1] && w1t > seg[0];
      if (!winBlocked && w1t - w0t > 0.05) {
        var wLen = edgeLen * (w1t - w0t);
        var wMidT = (w0t + w1t) / 2;
        var wMidX = ax + dx * wMidT + nx * wallOff;
        var wMidY = -(az + dz * wMidT + nz * wallOff);
        var winZ = floorY + sillH + winH / 2;
        // 窗户扇数: 每扇约1.2u宽
        var nPanes = Math.max(2, Math.round(wLen / 1.2));
        var paneW = wLen / nPanes;
        for (var pi = 0; pi < nPanes; pi++) {
          var pMidT = w0t + ((pi + 0.5) * (w1t - w0t)) / nPanes;
          var pMidX = ax + dx * pMidT + nx * wallOff;
          var pMidY = -(az + dz * pMidT + nz * wallOff);
          // 玻璃
          var glass = new THREE.Mesh(new THREE.BoxGeometry(paneW - 0.04, 0.03, winH), glassMat);
          glass.position.set(pMidX, pMidY, winZ);
          glass.rotation.z = edgeAngle;
          glass.name = 'campus-detail';
          parent.add(glass);
        }
        // 窗竖框(扇间)
        for (var pi2 = 1; pi2 < nPanes; pi2++) {
          var mT = w0t + (pi2 * (w1t - w0t)) / nPanes;
          var mX = ax + dx * mT + nx * wallOff;
          var mY = -(az + dz * mT + nz * wallOff);
          var mull = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.05, winH), frameMat);
          mull.position.set(mX, mY, winZ);
          mull.rotation.z = edgeAngle;
          mull.name = 'campus-detail';
          parent.add(mull);
        }
        // 窗横框(上下)
        for (var hi = 0; hi < 2; hi++) {
          var hZ = floorY + sillH + (hi === 0 ? 0 : winH);
          var hRail = new THREE.Mesh(new THREE.BoxGeometry(wLen, 0.05, 0.04), frameMat);
          hRail.position.set(wMidX, wMidY, hZ);
          hRail.rotation.z = edgeAngle;
          hRail.name = 'campus-detail';
          parent.add(hRail);
        }
      }

      // -- 门 (仅 corridor) --
      if (type !== 'corridor') continue;
      var doorT0 = c0t + 0.4 / edgeLen;
      var doorT1 = doorT0 + doorW / edgeLen; // 前门
      var door2T1 = c1t - 0.4 / edgeLen;
      var door2T0 = door2T1 - doorW / edgeLen; // 后门
      var doorBlocked1 = seg && doorT0 < seg[1] && doorT1 > seg[0];
      var doorBlocked2 = seg && door2T0 < seg[1] && door2T1 > seg[0];
      var doorMidZ = floorY + doorH / 2;
      // 前门
      if (!doorBlocked1 && doorT1 - doorT0 > 0.02) {
        var d1MidT = (doorT0 + doorT1) / 2;
        var d1X = ax + dx * d1MidT + nx * wallOff;
        var d1Y = -(az + dz * d1MidT + nz * wallOff);
        var door1 = new THREE.Mesh(new THREE.BoxGeometry(doorW, 0.04, doorH), doorMat);
        door1.position.set(d1X, d1Y, doorMidZ);
        door1.rotation.z = edgeAngle;
        door1.name = 'campus-detail';
        parent.add(door1);
      }
      // 后门
      if (!doorBlocked2 && door2T1 - door2T0 > 0.02) {
        var d2MidT = (door2T0 + door2T1) / 2;
        var d2X = ax + dx * d2MidT + nx * wallOff;
        var d2Y = -(az + dz * d2MidT + nz * wallOff);
        var door2 = new THREE.Mesh(new THREE.BoxGeometry(doorW, 0.04, doorH), doorMat);
        door2.position.set(d2X, d2Y, doorMidZ);
        door2.rotation.z = edgeAngle;
        door2.name = 'campus-detail';
        parent.add(door2);
      }
    }
  }
};
```

- [ ] **Step 2: Commit**

```bash
git add js/obstacles.js && git commit -m "feat(campus): add addDoorsAndWindows for door/window decals"
```

---

### Task 3: 修改 `addACToEdge` 支持窗户避让

**Files:**

- Modify: `js/obstacles.js:689` — `addACToEdge` 函数签名和内部跳过逻辑

**Interfaces:**

- Consumes: `computeWindowRanges(edgeLen)` 的返回值
- Modifies: `addACToEdge(parent, ax, az, bx, bz, wallH, skipSegs, forceY, winRanges)` — 新增 `winRanges` 参数

- [ ] **Step 1: 修改函数签名，新增 `winRanges` 参数**

```javascript
// 修改前:
  var addACToEdge = function (parent, ax, az, bx, bz, wallH, skipSegs, forceY) {
// 修改后:
  var addACToEdge = function (parent, ax, az, bx, bz, wallH, skipSegs, forceY, winRanges) {
```

- [ ] **Step 2: 在 AC 放置循环中加入窗户范围跳过**

在 `var t = (ai + 0.5) / nUnits;` 行之后（约第 724 行），`if (seg && ...)` 之前，新增窗户重叠检测：

```javascript
        // 空调不能装在窗户上: 如果 t 落在任何窗户范围内则跳过
        var _onWin = false;
        if (winRanges) {
          for (var _wi2 = 0; _wi2 < winRanges.length; _wi2++) {
            var _wr = winRanges[_wi2];
            if (t >= _wr.t0 - 0.1 / edgeLen && t <= _wr.t1 + 0.1 / edgeLen) { _onWin = true; break; }
          }
        }
        if (_onWin) continue;
```

注意：此插入需在 `if (seg && t >= seg[0] && t <= seg[1]) continue;` **之前**，确保窗户和天桥双重跳过独立生效。

- [ ] **Step 3: Commit**

---

### Task 4: 在建筑循环中集成调用

**Files:**

- Modify: `js/obstacles.js:918-931` — `_marks` 循环体

**Interfaces:**

- Consumes: `addDoorsAndWindows`, `addACToEdge` (修改后), `computeWindowRanges`

- [ ] **Step 1: 修改 \_marks 循环**

```javascript
// 修改前 (第 922-931 行):
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
// 修改后:
var _winRangesForAC = null; // 暂存走廊面窗户范围, 供 AC 面避让
for (var _mi = 0; _mi < _marks.length; _mi++) {
  var _mk = _marks[_mi];
  var _ed = edgeByFootprintIdx(fp.footprint, _mk.ei);
  if (!_ed || _ed.len < 2) continue;
  var _mskip = edgeBridgeOverlaps(_ed, _bridges, _stiltY);
  if (_mk.type === 'corridor') {
    addCorridorToEdge(bldGroup, _ed.ax, _ed.az, _ed.bx, _ed.bz, h - _stiltY, _mskip);
    addDoorsAndWindows(
      bldGroup,
      _ed.ax,
      _ed.az,
      _ed.bx,
      _ed.bz,
      h - _stiltY,
      'corridor',
      _mskip,
      _stiltY
    );
  } else if (_mk.type === 'ac') {
    var _acWinRanges = computeWindowRanges(_ed.len);
    addDoorsAndWindows(
      bldGroup,
      _ed.ax,
      _ed.az,
      _ed.bx,
      _ed.bz,
      h - _stiltY,
      'ac',
      _mskip,
      _stiltY
    );
    addACToEdge(bldGroup, _ed.ax, _ed.az, _ed.bx, _ed.bz, h - _stiltY, _mskip, null, _acWinRanges);
  }
}
```

- [ ] **Step 2: Commit**

---

### Task 5: CDP 验证 + Playwright 校园地图回归

**Files:**

- 无代码变更

- [ ] **Step 1: 杀残留进程**

```powershell
Get-Process python -ErrorAction SilentlyContinue | Stop-Process -Force
```

- [ ] **Step 2: 启动服务**

```bash
cd D:\我的文档\tank_demo && python server.py &
```

- [ ] **Step 3: CDP 验证**

```bash
python cdp_verify.py
```

Expected: `error_count: 0`

- [ ] **Step 4: Playwright 校园地图验证**

```bash
node -e "
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://127.0.0.1:8080', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(3000);
  await page.click('#btn-enter');
  await page.waitForTimeout(1000);
  const items = await page.\$\$('#map-list .map-item');
  for (let i = 0; i < items.length; i++) {
    const text = await items[i].textContent();
    if (text.includes('金福园')) { await items[i].click(); break; }
  }
  await page.waitForTimeout(500);
  await page.click('#btn-start-game');
  await page.waitForTimeout(5000);
  const stats = await page.evaluate(() => {
    var obs = window.obstacleMeshes || [];
    var doors = 0, windows = 0;
    obs.forEach(function(m) {
      if (m.name === 'campus-detail' && m.geometry && m.geometry.parameters) {
        var p = m.geometry.parameters;
        // Door: thin along edge (w~0.7), deep (d~0.04), tall (h~2.0)
        if (p.width > 0.6 && p.width < 0.8 && p.depth < 0.05 && p.height > 1.8) doors++;
        // Window glass: wide (w~1.16), very thin (d~0.03), medium tall (h~1.2)
        if (p.width > 0.5 && p.depth < 0.04 && p.height > 1.0 && p.height < 1.5) windows++;
      }
    });
    return { obsMeshes: obs.length, doors, windows };
  });
  console.log(JSON.stringify(stats));
  console.log('Errors:', errors.length);
  errors.forEach(e => console.log('ERR:', e));
  await browser.close();
})();
```

Expected: `errors=0, doors>0, windows>0`

- [ ] **Step 5: Commit**

```bash
git add js/obstacles.js && git commit -m "feat(campus): integrate doors/windows into building loop"
```
