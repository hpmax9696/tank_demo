# 校园工具：旋转对齐 + 命名功能 + B7 拆分 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 3 个校园 canvas 工具页面地图朝向对齐上帝模式，给建筑/运动场增加可持久化命名能力，并把 B7 双栋从渲染层硬编码提升为数据层两条可命名建筑。

**Architecture:** 旋转 = 照搬 `b7_builder` 已验证的中心式两轴取反投影；命名 = `building_edge_marker` 加命名模式 + 面拾取，经扩展后的 `/api/solidify` 写回 `campus.map.json`；B7 = `obstacles.js` dome 分支改读 `obstacles.b7_buildings`（带 fallback），数据初值落盘。

**Tech Stack:** 原生 JS canvas 2D、Three.js r160、Python `http.server`（server.py）、Playwright（截图验证）、CDP（控制台错误验证）。

## Global Constraints

- 服务必须通过 `http://127.0.0.1:8080` 访问（禁止 localhost）；server.py 已发 no-cache 头。
- `METERS_PER_UNIT = 1.3`；footprint 坐标格式 `[x, z]`（XZ 平面）。
- 上帝模式朝向 = **上北、下南、左东、右西**（即"上北右西"）。canvas 投影需两轴取反对齐。
- **无单元测试框架**：每个任务的"验证"步骤用 CDP 控制台 0 错误（cdp-verify skill）+ Playwright 截图 + python/curl 脚本检查替代。
- **Commit 策略**：Task 1–7 用功能型 commit（`feat(campus): ...`），不 bump 版本；Task 8 统一用 handoff skill 发版 v0.67.4（bump 8 处 + changelog + push）。
- 改数据格式必须同步所有消费者（见 spec 第 4 节消费者清单）。
- `b7_buildings` 数据位置 = `campus.map.json` 的 `obstacles.b7_buildings`（与 footprintBuildings/grounds 同级）。

---

## File Structure

| 文件                              | 责任                       | 本计划改动                                    |
| --------------------------------- | -------------------------- | --------------------------------------------- |
| `server.py`                       | 静态服务 + `/api/solidify` | 加 `type:'campus'` 分支（Task 1）             |
| `maps/campus.map.json`            | 校园数据                   | 加 `obstacles.b7_buildings` + names（Task 2） |
| `js/obstacles.js`                 | 校园实体渲染               | dome 分支数据驱动（Task 3）                   |
| `tools/building_edge_marker.html` | 外廊/空调标记 + 命名       | 旋转（Task 4）+ 命名（Task 6）                |
| `tools/track_zone_marker.html`    | 跑道打点                   | 旋转（Task 5）                                |
| `tools/b7_builder.html`           | B7 双栋参数设计            | 数据加载 + 保存（Task 7）                     |

---

## Task 1: server.py — `/api/solidify` 增加 campus 分支

**Files:**

- Modify: `server.py:59-86`（新增 `solidify_campus`）、`server.py:109-128`（do_POST 加分支）

**Interfaces:**

- Produces: `POST /api/solidify` 接受 `{type:'campus', names:{buildings:{},grounds:{},b7:{}}, b7_buildings?:[...]}`，更新 `maps/campus.map.json` 并返回 `{ok:true, file:...}`。供 Task 6、Task 7 调用。

- [ ] **Step 1: 在 server.py 顶部加 campus 数据路径常量**

在 `server.py:22`（`MODEL_MAP` 字典之后）插入：

```python
CAMPUS_MAP = 'maps/campus.map.json'
```

- [ ] **Step 2: 新增 `solidify_campus` 函数**

在 `server.py:86`（`solidify_config` 函数之后、`overpass_proxy` 之前）插入：

```python
def solidify_campus(payload):
    """更新 campus.map.json 的 name 字段 + 可选 b7_buildings。
    payload: {'names': {'buildings':{idx:name}, 'grounds':{idx:name}, 'b7':{idx:name}},
              'b7_buildings': [...] (可选, 整体替换)}"""
    if not os.path.exists(CAMPUS_MAP):
        raise FileNotFoundError(f'校园地图不存在: {CAMPUS_MAP}')
    with open(CAMPUS_MAP, 'r', encoding='utf-8') as f:
        data = json.load(f)
    obs = data.setdefault('obstacles', {})
    names = payload.get('names') or {}

    # 建筑 name (跳过 roofType==='dome' 的 B7 footprint)
    blds = obs.get('footprintBuildings') or []
    for k, v in (names.get('buildings') or {}).items():
        i = int(k)
        if 0 <= i < len(blds) and blds[i].get('roofType') != 'dome':
            blds[i]['name'] = v

    # 运动场 name
    gnds = obs.get('grounds') or []
    for k, v in (names.get('grounds') or {}).items():
        i = int(k)
        if 0 <= i < len(gnds):
            gnds[i]['name'] = v

    # b7_buildings name
    b7 = obs.get('b7_buildings') or []
    for k, v in (names.get('b7') or {}).items():
        i = int(k)
        if 0 <= i < len(b7):
            b7[i]['name'] = v

    # 整体替换 b7_buildings (b7_builder 保存时)
    if 'b7_buildings' in payload and payload['b7_buildings'] is not None:
        obs['b7_buildings'] = payload['b7_buildings']

    with open(CAMPUS_MAP, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    return CAMPUS_MAP
```

- [ ] **Step 3: do_POST 加 campus 分支**

把 `server.py:114-126` 的 try 块改为（在 `data = json.loads(body)` 之后、`model_type = ...` 之前插入 campus 分支）：

```python
                data = json.loads(body)

                # campus 命名/B7 保存分支
                if data.get('type') == 'campus':
                    saved_path = solidify_campus(data)
                    self._json_ok({'file': saved_path})
                    return

                model_type = data.get('modelType', '')
                config = data.get('config', {})

                if not model_type or not config:
                    self._json_error(400, '缺少 modelType 或 config')
                    return

                config_json = json.dumps(config, ensure_ascii=False)
                saved_path = solidify_config(model_type, config_json)

                self._json_ok({'file': saved_path})
```

- [ ] **Step 4: 重启 server 并用临时副本验证（不污染真实数据）**

Run:

```bash
cd "D:/我的文档/tank_demo"
# 杀残留 python 8080
powershell -Command "Get-NetTCPConnection -LocalPort 8080 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id \$_.OwningProcess -Force }" 2>/dev/null
python server.py &
sleep 2
# 用临时副本测试 solidify_campus(改 CAMPUS_MAP 指向副本)
python -c "
import json,shutil,importlib.util
shutil.copy('maps/campus.map.json','/tmp/campus_test.json')
spec=importlib.util.spec_from_file_location('srv','server.py'); srv=importlib.util.module_from_spec(spec); spec.loader.exec_module(srv)
srv.CAMPUS_MAP='/tmp/campus_test.json'
srv.solidify_campus({'names':{'buildings':{'0':'测试教学楼'},'grounds':{'0':'测试篮球场'},'b7':{'0':'室内运动场'}},'b7_buildings':[{'name':'室内运动场','cx':1,'cz':2,'w':3,'d':4,'ry':0,'vaultH':5,'archRatio':0.5}]})
d=json.load(open('/tmp/campus_test.json',encoding='utf-8'))
print('B1 name:',d['obstacles']['footprintBuildings'][0]['name'])
print('ground0 name:',d['obstacles']['grounds'][0]['name'])
print('b7[0]:',d['obstacles']['b7_buildings'][0]['name'],d['obstacles']['b7_buildings'][0]['cx'])
"
```

Expected: `B1 name: 测试教学楼` / `ground0 name: 测试篮球场` / `b7[0]: 室内运动场 1`。临时副本用后删除。

- [ ] **Step 5: Commit**

```bash
git add server.py
git commit -m "feat(campus): /api/solidify 增加 campus 命名/B7 保存分支"
```

---

## Task 2: campus.map.json — 落盘 `obstacles.b7_buildings` + 清理 names

**Files:**

- Modify: `maps/campus.map.json`

**Interfaces:**

- Produces: `obstacles.b7_buildings`（两条，参数取自当前 `obstacles.js:671` 硬编码，确保零视觉回归）；B7 footprint 的 `name` 清空；grounds 各项具备 `name` 字段（空串，待命名）。

- [ ] **Step 1: 用 python 脚本写入数据（保证 JSON 合法 + 缩进一致）**

Run:

```bash
cd "D:/我的文档/tank_demo"
python -c "
import json,io
p='maps/campus.map.json'
d=json.load(io.open(p,encoding='utf-8'))
obs=d['obstacles']
# B7 两栋参数(取自 obstacles.js:671 硬编码, 零回归)
obs['b7_buildings']=[
  {'name':'室内运动场','cx':32.5,'cz':31.3,'w':38.3,'d':22.6,'ry':-1.326,'vaultH':10,'archRatio':0.45},
  {'name':'车棚','cx':47.7,'cz':46.0,'w':14.0,'d':16.8,'ry':0.244,'vaultH':5,'archRatio':0.6}
]
# B7 footprint name 清空(命名落到 b7_buildings)
for b in obs['footprintBuildings']:
    if b.get('roofType')=='dome': b['name']=''
# grounds 加 name 字段(空, 待命名)
for g in obs.get('grounds',[]):
    g.setdefault('name','')
json.dump(d,io.open(p,'w',encoding='utf-8'),ensure_ascii=False,indent=2)
print('done; b7_buildings=',len(obs['b7_buildings']),'grounds=',len(obs['grounds']))
"
```

Expected: `done; b7_buildings= 2 grounds= 10`

- [ ] **Step 2: 校验 JSON 合法 + 字段正确**

Run:

```bash
cd "D:/我的文档/tank_demo"
python -c "import json,io; d=json.load(io.open('maps/campus.map.json',encoding='utf-8')); b7=d['obstacles']['b7_buildings']; print('b7 names:',[x['name'] for x in b7]); print('B7 fp name:',[b for b in d['obstacles']['footprintBuildings'] if b.get('roofType')=='dome'][0]['name'])"
```

Expected: `b7 names: ['室内运动场', '车棚']` / `B7 fp name: `（空）

- [ ] **Step 3: Commit**

```bash
git add maps/campus.map.json
git commit -m "feat(campus): 落盘 obstacles.b7_buildings 双栋 + B7 footprint name 清空"
```

---

## Task 3: obstacles.js — B7 dome 分支数据驱动

**Files:**

- Modify: `js/obstacles.js:437-440`（入口存 `_campusB7Buildings`）、`js/obstacles.js:671-674`（dome 分支读数据）

**Interfaces:**

- Consumes: `currentMapData.obstacles.b7_buildings`（Task 2 已落盘）
- Produces: B7 两栋 mesh 来源 = 数据，缺失时 fallback 硬编码（渲染不崩）

- [ ] **Step 1: createFootprintBuildings 入口存 b7 数据**

`js/obstacles.js:440` 现有 `window._campusBuildings = [];`，在其**下一行**插入：

```js
// B7 双栋参数(数据驱动, fallback 硬编码) — 来自 obstacles.b7_buildings
var _campusB7Buildings =
  currentMapData && currentMapData.obstacles && currentMapData.obstacles.b7_buildings
    ? currentMapData.obstacles.b7_buildings
    : null;
```

- [ ] **Step 2: dome 分支 `_b7blds` 改读数据**

把 `js/obstacles.js:671-674`：

```js
var _b7blds = [
  { cx: 32.5, cz: 31.3, w: 38.3, d: 22.6, ry: -1.326, vaultH: 10, archRatio: 0.45 },
  { cx: 47.7, cz: 46, w: 14, d: 16.8, ry: 0.244, vaultH: 5, archRatio: 0.6 },
];
```

替换为：

```js
var _b7blds =
  _campusB7Buildings && _campusB7Buildings.length
    ? _campusB7Buildings
    : [
        { cx: 32.5, cz: 31.3, w: 38.3, d: 22.6, ry: -1.326, vaultH: 10, archRatio: 0.45 },
        { cx: 47.7, cz: 46, w: 14, d: 16.8, ry: 0.244, vaultH: 5, archRatio: 0.6 },
      ];
```

- [ ] **Step 3: CDP 验证游戏加载校园地图 0 错误 + B7 两栋正常**

用 cdp-verify skill 加载校园地图（单人模式选金福园小学）。Expected: 控制台 0 错误，B7 位置两栋拱顶可见（运动场大高拱 + 车棚小矮拱）。

- [ ] **Step 4: 验证数据驱动生效（临时改数据 → 渲染跟随）**

临时把 `maps/campus.map.json` 里 `b7_buildings[0].vaultH` 改为 `15`，Ctrl+F5 重载，确认运动场拱顶变高；**改回 `10`**。Expected: 改 15 时拱顶明显变高，确认数据驱动。

- [ ] **Step 5: Commit**

```bash
git add js/obstacles.js
git commit -m "feat(campus): obstacles.js B7 dome 分支改读 obstacles.b7_buildings(数据驱动+fallback)"
```

---

## Task 4: building_edge_marker.html — 旋转对齐上帝模式

**Files:**

- Modify: `tools/building_edge_marker.html:128-181`（投影函数）

**Interfaces:**

- Produces: `w2c`/`c2w` 两轴取反，地图上北右西。后续 Task 6 命名功能在此投影上构建。

- [ ] **Step 1: 改投影变量声明**

`tools/building_edge_marker.html:128-131` 现有：

```js
let campusData = null,
  viewX = 0,
  viewZ = 0,
  scale = 1;
```

替换为：

```js
let campusData = null,
  mcx = 0,
  mcz = 0,
  ccx = 0,
  ccy = 0,
  scale = 1;
```

- [ ] **Step 2: 改 fitView（中心式）**

把 `tools/building_edge_marker.html:162-174`（`const pad = 10,` 到 `ctx.setTransform(...)`）替换为：

```js
const pad = 10,
  w = Mx - mx + pad * 2,
  h = Mz - mz + pad * 2;
const cw = canvas.parentElement.clientWidth,
  ch = canvas.parentElement.clientHeight;
scale = Math.min(cw / w, ch / h);
mcx = (mx + Mx) / 2;
mcz = (mz + Mz) / 2;
ccx = cw / 2;
ccy = ch / 2;
canvas.width = cw * devicePixelRatio;
canvas.height = ch * devicePixelRatio;
canvas.style.width = cw + 'px';
canvas.style.height = ch + 'px';
ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
```

- [ ] **Step 3: 改 w2c / c2w（两轴取反）**

把 `tools/building_edge_marker.html:176-181`：

```js
function w2c(wx, wz) {
  return { x: viewX + wx * scale, y: viewZ + wz * scale };
}
function c2w(cx, cy) {
  return { x: (cx - viewX) / scale, z: (cy - viewZ) / scale };
}
```

替换为：

```js
function w2c(wx, wz) {
  return { x: ccx - (wx - mcx) * scale, y: ccy - (wz - mcz) * scale };
}
function c2w(cx, cy) {
  return { x: mcx - (cx - ccx) / scale, z: mcz - (cy - ccy) / scale };
}
```

- [ ] **Step 4: 截图验证朝向（上北右西）**

Run:

```bash
cd "D:/我的文档/tank_demo"
cat > _shot.js <<'EOF'
const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ headless: true });
  const pg = await b.newPage({ viewport: { width: 1500, height: 920 } });
  pg.on('pageerror', e => console.log('[ERR]', e.message));
  await pg.goto('http://127.0.0.1:8080/tools/building_edge_marker.html', { waitUntil: 'networkidle' });
  await pg.waitForTimeout(1000);
  await pg.screenshot({ path: 'campus_edge_rotated.png' });
  await b.close(); console.log('done');
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
EOF
node _shot.js && rm _shot.js
```

Expected: `done`，无 `[ERR]`。截图 `campus_edge_rotated.png` 中建筑布局与上帝模式（F4）一致：原位于数据 +x/+z（东南角）的 B7 现显示在**左上**（北=上、东=左）。

- [ ] **Step 5: Commit**

```bash
git add tools/building_edge_marker.html
git commit -m "feat(campus): building_edge_marker 旋转对齐上帝模式(上北右西)"
```

---

## Task 5: track_zone_marker.html — 旋转对齐上帝模式

**Files:**

- Modify: `tools/track_zone_marker.html:169-223`（投影函数）

**Interfaces:**

- Produces: 同 Task 4 的投影改法，应用于打点工具。

- [ ] **Step 1: 改投影变量声明**

`tools/track_zone_marker.html:169-171` 现有：

```js
let viewX = 0,
  viewZ = 0,
  scale = 1;
```

替换为：

```js
let mcx = 0,
  mcz = 0,
  ccx = 0,
  ccy = 0,
  scale = 1;
```

- [ ] **Step 2: 改 fitView（中心式）**

把 `tools/track_zone_marker.html:203-210`（`const pad = 10,` 到 `viewZ = -(minZ - pad) * scale;`）替换为：

```js
const pad = 10,
  w = maxX - minX + pad * 2,
  h = maxZ - minZ + pad * 2;
const cw = canvas.parentElement.clientWidth,
  ch = canvas.parentElement.clientHeight;
scale = Math.min(cw / w, ch / h);
mcx = (minX + maxX) / 2;
mcz = (minZ + maxZ) / 2;
ccx = cw / 2;
ccy = ch / 2;
```

- [ ] **Step 3: 改 w2c / c2w（两轴取反）**

把 `tools/track_zone_marker.html:218-223`：

```js
function w2c(wx, wz) {
  return { x: viewX + wx * scale, y: viewZ + wz * scale };
}
function c2w(cx, cy) {
  return { x: (cx - viewX) / scale, z: (cy - viewZ) / scale };
}
```

替换为：

```js
function w2c(wx, wz) {
  return { x: ccx - (wx - mcx) * scale, y: ccy - (wz - mcz) * scale };
}
function c2w(cx, cy) {
  return { x: mcx - (cx - ccx) / scale, z: mcz - (cy - ccy) / scale };
}
```

- [ ] **Step 4: 截图验证朝向 + 交互**

Run（同 Task 4 的截图脚本，URL 换成 track_zone_marker）：

```bash
cd "D:/我的文档/tank_demo"
cat > _shot.js <<'EOF'
const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ headless: true });
  const pg = await b.newPage({ viewport: { width: 1500, height: 920 } });
  pg.on('pageerror', e => console.log('[ERR]', e.message));
  await pg.goto('http://127.0.0.1:8080/tools/track_zone_marker.html', { waitUntil: 'networkidle' });
  await pg.waitForTimeout(800);
  // 模拟点击地图添加一个点, 验证 c2w 反投影正确(不报错)
  await pg.mouse.click(400, 400);
  await pg.waitForTimeout(200);
  await pg.screenshot({ path: 'campus_track_rotated.png' });
  await b.close(); console.log('done');
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
EOF
node _shot.js && rm _shot.js
```

Expected: `done`，无 `[ERR]`；截图朝向与 Task 4 一致（上北右西）；点击后出现一个边界点（c2w 反投影正确）。

- [ ] **Step 5: Commit**

```bash
git add tools/track_zone_marker.html
git commit -m "feat(campus): track_zone_marker 旋转对齐上帝模式(上北右西)"
```

---

## Task 6: building_edge_marker.html — 命名功能

**Files:**

- Modify: `tools/building_edge_marker.html`（加载 b7_buildings + 命名模式 + 面拾取 + 保存按钮）

**Interfaces:**

- Consumes: `POST /api/solidify {type:'campus', names:{...}}`（Task 1）、`obstacles.b7_buildings`（Task 2）
- Produces: 用户可命名 B1~B6 + B7 两栋 + 10 个运动场，保存写回 campus.map.json。

- [ ] **Step 1: 加载 b7_buildings 并在 draw 中绘制两栋 + 显示所有 name**

在 `tools/building_edge_marker.html` 的 `draw()` 函数内，画完普通建筑循环（约第 292 行 `ctx.fillText('B' + (bi + 1)...)` 之后、函数结束前）插入绘制 b7_buildings + name 回显：

```js
// B7 双栋(b7_buildings) 矩形 + name
const b7 = campusData.obstacles.b7_buildings || [];
for (let bi = 0; bi < b7.length; bi++) {
  const w = b7[bi];
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
  drawPoly(corners, 'rgba(200,180,160,0.5)', '#c8a060', 2);
  const cc = w2c(w.cx, w.cz);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 12px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(w.name || 'B7-' + (bi + 1), cc.x, cc.y);
}
// 运动场 name 回显
for (let gi = 0; gi < (campusData.obstacles.grounds || []).length; gi++) {
  const g = campusData.obstacles.grounds[gi];
  if (!g.name) continue;
  const fp = g.footprint;
  const cx = fp.reduce((s, p) => s + p[0], 0) / fp.length;
  const cz = fp.reduce((s, p) => s + p[1], 0) / fp.length;
  const cc = w2c(cx, cz);
  ctx.fillStyle = '#ffe08a';
  ctx.font = 'bold 10px monospace';
  ctx.fillText(g.name, cc.x, cc.y);
}
// 普通建筑 name 回显(替代纯 B 编号)
for (let bi = 0; bi < blds.length; bi++) {
  const b = blds[bi];
  if (b.roofType === 'dome') continue; // B7 跳过
  if (!b.name) continue;
  const fp = b.footprint;
  const cx = fp.reduce((s, p) => s + p[0], 0) / fp.length;
  const cz = fp.reduce((s, p) => s + p[1], 0) / fp.length;
  const cc = w2c(cx, cz);
  ctx.fillStyle = '#9ff';
  ctx.font = 'bold 11px monospace';
  ctx.fillText(b.name, cc.x, cc.y + 18);
}
```

- [ ] **Step 2: 加命名模式状态 + pointInPoly + 面拾取**

在 `let mode = 'corridor';`（第132行）下一行加：

```js
let nameMode = false; // 命名模式开关
```

在 `findEdge` 函数（第295行）之后加面拾取辅助：

```js
function pointInPoly(x, z, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0],
      zi = poly[i][1],
      xj = poly[j][0],
      zj = poly[j][1];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}
function findEntityAt(wx, wz) {
  // 返回 {kind:'bld'|'b7'|'ground', idx} 或 null
  const blds = campusData.obstacles.footprintBuildings || [];
  for (let i = 0; i < blds.length; i++) {
    if (blds[i].roofType === 'dome') continue;
    if (pointInPoly(wx, wz, blds[i].footprint)) return { kind: 'bld', idx: i };
  }
  const b7 = campusData.obstacles.b7_buildings || [];
  for (let i = 0; i < b7.length; i++) {
    const w = b7[i],
      cs = Math.cos(w.ry),
      sn = Math.sin(w.ry),
      hw = w.w / 2,
      hd = w.d / 2;
    const lx = wx - w.cx,
      lz = wz - w.cz;
    const rlx = lx * cs + lz * sn,
      rlz = -lx * sn + lz * cs;
    if (Math.abs(rlx) <= hw && Math.abs(rlz) <= hd) return { kind: 'b7', idx: i };
  }
  const gnds = campusData.obstacles.grounds || [];
  for (let i = 0; i < gnds.length; i++) {
    if (pointInPoly(wx, wz, gnds[i].footprint)) return { kind: 'ground', idx: i };
  }
  return null;
}
```

- [ ] **Step 3: 命名模式下点击触发命名 prompt**

把 `canvas.addEventListener('click', ...)`（第332行）的开头改为：

```js
canvas.addEventListener('click', (e) => {
  const rect = canvas.getBoundingClientRect();
  const fe = findEdge(e.clientX - rect.left, e.clientY - rect.top);
  if (nameMode) {
    // 命名模式: 面拾取
    const w = c2w(e.clientX - rect.left, e.clientY - rect.top);
    const ent = findEntityAt(w.x, w.z);
    if (!ent) return;
    const key = ent.kind + '_' + ent.idx;
    const cur = _currentName(ent);
    const nv = prompt('命名 (' + ent.kind + ' #' + (ent.idx + 1) + '):', cur);
    if (nv === null) return;
    _setName(ent, nv);
    return;
  }
  if (!fe) return;
  const key = bldEdgeKey(fe.bi, fe.ei);
  if (marks[key] === mode) delete marks[key];
  else marks[key] = mode;
  draw();
});
```

并在 click 监听**之前**加 name 读写辅助（直接改内存 campusData，保存时统一上报）：

```js
function _currentName(ent) {
  if (ent.kind === 'bld') return campusData.obstacles.footprintBuildings[ent.idx].name || '';
  if (ent.kind === 'b7') return (campusData.obstacles.b7_buildings[ent.idx] || {}).name || '';
  return campusData.obstacles.grounds[ent.idx].name || '';
}
function _setName(ent, nv) {
  if (ent.kind === 'bld') campusData.obstacles.footprintBuildings[ent.idx].name = nv;
  else if (ent.kind === 'b7') campusData.obstacles.b7_buildings[ent.idx].name = nv;
  else campusData.obstacles.grounds[ent.idx].name = nv;
  draw();
}
```

- [ ] **Step 4: 加 N 键切换命名模式 + UI 按钮 + 模式指示**

把 keydown 监听（第341行）改为：

```js
document.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  if (k === 'r') setMode('corridor');
  else if (k === 'b') setMode('ac');
  else if (k === 'n') toggleNameMode();
  else if (k === 'c') clearMarks();
});
function toggleNameMode() {
  nameMode = !nameMode;
  const el = document.getElementById('mode-ind');
  if (nameMode) {
    el.textContent = '🏷 当前模式: 命名(点建筑/场地输入)';
    el.style.background = '#1a8a4a';
  } else {
    setMode(mode); // 恢复显示当前标记模式
  }
  draw();
}
```

在 `<button class="btn btn-blue" onclick="setMode('ac')">` 之后（第120行附近）加命名按钮：

```html
<button class="btn btn-green" onclick="toggleNameMode()">🏷 命名模式(N)</button>
```

- [ ] **Step 5: 加"保存命名"按钮 + 上报 solidify**

在"导出 JSON"按钮（第122行）之前加：

```html
<button class="btn btn-green" onclick="saveNames()" style="background:#0d7a3a">
  💾 保存命名到地图
</button>
```

并加 saveNames 函数（在 exportJSON 之后）：

```js
async function saveNames() {
  const names = { buildings: {}, grounds: {}, b7: {} };
  const blds = campusData.obstacles.footprintBuildings || [];
  for (let i = 0; i < blds.length; i++) {
    if (blds[i].roofType === 'dome') continue;
    if (blds[i].name) names.buildings[i] = blds[i].name;
  }
  for (let i = 0; i < (campusData.obstacles.grounds || []).length; i++) {
    if (campusData.obstacles.grounds[i].name)
      names.grounds[i] = campusData.obstacles.grounds[i].name;
  }
  for (let i = 0; i < (campusData.obstacles.b7_buildings || []).length; i++) {
    if (campusData.obstacles.b7_buildings[i].name)
      names.b7[i] = campusData.obstacles.b7_buildings[i].name;
  }
  try {
    const r = await fetch('/api/solidify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'campus', names }),
    });
    const j = await r.json();
    if (j.ok) alert('命名已保存到地图');
    else alert('保存失败: ' + j.error);
  } catch (e) {
    alert('保存失败: ' + e.message);
  }
}
```

- [ ] **Step 6: Playwright 验证命名 → 落盘 → 重载仍在**

Run:

```bash
cd "D:/我的文档/tank_demo"
cat > _t.js <<'EOF'
const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ headless: true });
  const pg = await b.newPage();
  pg.on('pageerror', e => console.log('[ERR]', e.message));
  await pg.goto('http://127.0.0.1:8080/tools/building_edge_marker.html', { waitUntil: 'networkidle' });
  await pg.waitForTimeout(800);
  // 拦截 prompt 返回名字 + dialog
  pg.on('dialog', async d => { await d.accept('测试教学楼A'); });
  // 切命名模式 + 点击 B1 中心(数据见 campus.map.json B1 footprint 质心约 70,50 世界坐标 → 旋转后左上区)
  await pg.keyboard.press('n');
  await pg.mouse.click(300, 300);
  await pg.waitForTimeout(300);
  // 点保存
  pg.removeAllListeners('dialog');
  pg.on('dialog', async d => { await d.accept(); });
  await pg.click('text=保存命名到地图');
  await pg.waitForTimeout(1000);
  console.log('done');
  await b.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
EOF
node _t.js && rm _t.js
# 验证落盘(查 B1 name)
python -c "import json,io; d=json.load(io.open('maps/campus.map.json',encoding='utf-8')); print('B1:',d['obstacles']['footprintBuildings'][0].get('name'))"
```

Expected: `done` 无 `[ERR]`；若点击命中 B1 则 `B1: 测试教学楼A`（点击坐标未必精确命中，主要验证流程不报错 + 0 错误）。**若落盘了测试名，手动改回空或让用户正式命名。**

- [ ] **Step 7: Commit**

```bash
git add tools/building_edge_marker.html
git commit -m "feat(campus): building_edge_marker 命名模式(建筑/运动场/B7双栋) + 保存到地图"
```

---

## Task 7: b7_builder.html — 从数据加载 + 保存到地图

**Files:**

- Modify: `tools/b7_builder.html:661-667`（IIFE 加载逻辑）、按钮区（第146-150行）

**Interfaces:**

- Consumes: `obstacles.b7_buildings`（Task 2）、`POST /api/solidify {type:'campus', b7_buildings}`（Task 1）
- Produces: 工具从数据加载两栋初值；"保存到地图"写回 b7_buildings（含 name）。

- [ ] **Step 1: loadMap 后从 b7_buildings 加载 wings**

把 `tools/b7_builder.html:661-667` 的 IIFE：

```js
(async () => {
  await loadMap();
  resize3D();
  animate();
  await loadMapRef();
  resetDefault();
})();
```

替换为：

```js
(async () => {
  await loadMap();
  resize3D();
  animate();
  await loadMapRef();
  // 优先从数据加载, 无数据才 resetDefault
  const src = (campus.obstacles && campus.obstacles.b7_buildings) || [];
  if (src.length) {
    wings = src.map((w, i) => ({
      name: w.name || WN[i] || 'W' + i,
      cx: w.cx,
      cz: w.cz,
      w: w.w,
      d: w.d,
      ry: w.ry,
      vaultH: w.vaultH,
      archRatio: w.archRatio,
    }));
    sel = 0;
    updateUI();
    draw2D();
    update3D();
  } else {
    resetDefault();
  }
})();
```

- [ ] **Step 2: 加"保存到地图"按钮 + saveB7 函数**

在 `tools/b7_builder.html:148`（`<button class="btn-g" onclick="exportCFG()">导出JSON</button>`）之后加：

```html
<button class="btn-g" onclick="saveB7()" style="background:#0d7a3a">💾 保存到地图</button>
```

并在 `exportCFG` 函数（第636行）之后加：

```js
async function saveB7() {
  const payload = wings.map((w) => ({
    name: w.name || '',
    cx: +w.cx.toFixed(1),
    cz: +w.cz.toFixed(1),
    w: +w.w.toFixed(1),
    d: +w.d.toFixed(1),
    ry: +w.ry.toFixed(3),
    vaultH: +w.vaultH.toFixed(1),
    archRatio: +w.archRatio.toFixed(2),
  }));
  try {
    const r = await fetch('/api/solidify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'campus', b7_buildings: payload }),
    });
    const j = await r.json();
    const btn = document.querySelector('.btn-g:last-of-type');
    if (j.ok) {
      btn.textContent = '✅已保存';
      setTimeout(() => (btn.textContent = '💾 保存到地图'), 1500);
    } else alert('保存失败: ' + j.error);
  } catch (e) {
    alert('保存失败: ' + e.message);
  }
}
```

- [ ] **Step 3: 验证加载 + 保存 + 0 错误**

Run:

```bash
cd "D:/我的文档/tank_demo"
cat > _t.js <<'EOF'
const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ headless: true });
  const pg = await b.newPage();
  pg.on('console', m => { if (m.text().includes('wings') || m.text().includes('done')) console.log(m.text()); });
  pg.on('pageerror', e => console.log('[ERR]', e.message));
  await pg.goto('http://127.0.0.1:8080/tools/b7_builder.html', { waitUntil: 'networkidle' });
  await pg.waitForTimeout(1200);
  const cnt = await pg.evaluate(() => wings.length);
  const n0 = await pg.evaluate(() => wings[0] && wings[0].name);
  console.log('wings loaded:', cnt, 'name0:', n0);
  await b.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
EOF
node _t.js && rm _t.js
```

Expected: `wings loaded: 2` / `name0: 室内运动场`；无 `[ERR]`（证明从数据加载成功，而非 resetDefault 的 'A'）。

- [ ] **Step 4: Commit**

```bash
git add tools/b7_builder.html
git commit -m "feat(campus): b7_builder 从 obstacles.b7_buildings 加载 + 保存到地图"
```

---

## Task 8: 文档同步 + 发版 handoff

**Files:**

- Modify: `CLAUDE.md`、`CODEBUDDY.md`、`.trae/rules/project_rules.md`

- [ ] **Step 1: 同步三份文档**

在 `CLAUDE.md` 文件结构表的工具说明、v0.67.x 变更段补充：

- `tools/building_edge_marker.html` 增加命名功能（建筑/运动场/B7 双栋，经 /api/solidify 写回）
- `tools/track_zone_marker.html`、`building_edge_marker.html` 旋转对齐上帝模式（上北右西）
- `obstacles.b7_buildings` 新数据字段（B7 双栋参数化，dome 分支数据驱动）
- `server.py` /api/solidify 加 type:'campus' 分支
- 消费者同步：obstacles.js / building_edge_marker / b7_builder 读 obstacles.b7_buildings

`CODEBUDDY.md` 同步参数/架构；`.trae/rules/project_rules.md` 同步文件行数与规则。

- [ ] **Step 2: CDP 全量验证（cdp-verify skill）**

加载校园地图 + 打开 3 个工具页面，确认 0 控制台错误。

- [ ] **Step 3: 用 handoff skill 发版 v0.67.4**

调用 handoff skill（内部 bump-version 同步 8 处版本号 + 裁剪 changelog → git add/commit `v0.67.4: 校园工具旋转对齐+建筑/运动场命名+B7双栋数据化` → push Gitee+GitHub + OneDrive 备份）。

---

## Self-Review

**1. Spec coverage:**

- 旋转（spec 3.1）→ Task 4 + 5 ✓
- 命名（spec 3.2）→ Task 6 ✓
- B7 拆分方案A（spec 3.3）→ Task 2（数据）+ Task 3（渲染）+ Task 7（工具） ✓
- 持久化 server.py（spec 3.4）→ Task 1 ✓
- 消费者同步（spec 第4节）→ obstacles.js(T3) / building_edge_marker(T4+6) / b7_builder(T7) / build_campus_map.js(本次不动，b7_buildings 已手工落盘 T2，后续可选) ✓
- 验证（spec 第6节）→ 各 Task 的 CDP/Playwright 步骤 ✓

**2. Placeholder scan:** 无 TBD/TODO；所有代码块完整（投影、solidify_campus、命名交互、saveB7 均给出可运行代码）。fallback 默认值为真实数值。

**3. Type consistency:** `w2c`/`c2w`/`findEntityAt`/`_setName`/`saveNames`/`saveB7` 命名跨任务一致；`obstacles.b7_buildings` 字段名在 Task 1/2/3/6/7 统一；wing 字段 `{name,cx,cz,w,d,ry,vaultH,archRatio}` 与 b7_builder 现有 defWing 一致。
