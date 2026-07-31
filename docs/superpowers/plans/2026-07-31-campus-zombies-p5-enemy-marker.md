# 校园丧尸 · 敌人放置工具页实现计划 (P5)

> **For agentic workers:** REQUIRED SUB-SKILL: Use Superpowers:subagent-driven-development (recommended) or Superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新建 `tools/enemy_marker.html`（fork `toilet_zone_marker.html`），在校园顶视图上放置 7 种敌人（4 校园丧尸 + assault/zombie/hexapod）、编辑 8 字段行为面板 + 3 模式、画巡逻点、配置刷新参数 + 门，保存到 `campus.map.json` 的 `enemies` + `spawnConfig` 段——建立"放置→行为→刷新"的校园敌人内容编辑闭环。

**Architecture:** 单文件 `tools/enemy_marker.html`（Canvas 2D 顶视图 + 内联 JS，无外部依赖）。fork `toilet_zone_marker.html` 的底图渲染 / `w2c`·`c2w` 坐标变换 / mousedown-move-up 状态机 / Delete / saveZones 框架；把"区域矩形 + 角柄 + 旋转柄"换成"敌人圆点 + 视野圈 + 巡逻折线"；右侧面板加行为面板（剥自 `map_editor.html:1064-1102`）+ 刷新配置面板。门位置默认值复制 `campus_spawner._extractDoors`（边中点近似，spawner 实际只用 ±1.25m 随机扰动，中点足够）。

**Tech Stack:** 原生 HTML/CSS/Canvas 2D、`fetch` + `POST /api/solidify`、CDP + Playwright 验证。

## Global Constraints

- **fork 样板**：`tools/toilet_zone_marker.html`（619 行）。可直接复用：head/style（L1-114）、`loadCampus`/`fitView`/`w2c`/`c2w`/`drawPoly`/`pointInPoly`/`setStatus`（L159-210, 362-410）、`draw()` 底图段（L214-227）、mousedown/move/up 状态机骨架（L413-457）、Delete+clearAll（L559-590）、saveZones 结构（L593-606）。
- **坐标变换 X 轴翻转**：`w2c(wx,wz) = { x: ccx - (wx-mcx)*scale, y: ccy - (wz-mcz)*scale }`（西在右、东在左，OSM 蓝图朝向）。`c2w` 对称。复制时保持原样。
- **落盘字段格式（最易踩坑）**：enemy **扁平字段**（hp/speed/viewDist/attackDamage/attackCooldown/dropRate/dropHeal/score/reactive/aggressive 直接挂 enemy 根，**不套 cfg**）；`position` 是 **3 元数组 `[x, y, z]`**（y 固定 0）；`patrolPath` 是 **`[[x,z],...]` 二元组数组**（不是 `{x,z}` 对象）；`spawnConfig.doors` 是 **`[[x,z],...]`**。
- **整体替换语义**：server.py（L195-199）对 `enemies` 和 `spawnConfig` 都是**整体替换**。保存时必须 POST 完整数组/对象。
- **变体名约定**：`student_m / student_f / teacher_m / teacher_f`（校园丧尸，`type:'zombie'` + `variant` 字段）；`assault / zombie / hexapod`（原有敌人，`type` 即变体名）。
- **不改游戏代码**：`createEnemies`（P1）和 `campus_spawner`（P3）已消费 `enemies` + `spawnConfig`，本 plan 零改动 `js/engine.js` / `js/campus_spawner.js` / `models/`。
- **验证基线**：每个 task 后 CDP 加载 `tools/enemy_marker.html` 控制台 0 错误；最终 task 用 Playwright 端到端（放置→编辑→保存→重载→进游戏确认敌人出现）。
- **行号基准**：toilet_zone_marker 行号是 fork 时的源行号；新建 enemy_marker 时按本 plan 给的代码组织，不依赖源行号。

## File Structure

| 文件                      | 责任                                                             | 本 plan 改动          |
| ------------------------- | ---------------------------------------------------------------- | --------------------- |
| `tools/enemy_marker.html` | 校园敌人放置工具页（Canvas 顶视图 + 行为面板 + 巡逻 + 刷新配置） | 新建 ~700 行          |
| `maps/campus.map.json`    | 无代码改动（运行时由工具页 POST 写入 `enemies`/`spawnConfig`）   | 0（数据由 server 写） |

**本 plan 不含**：P6 校服 Canvas 贴图精修、精确门位置（每间教室一扇，obstacles.js:912-944 公式，当前中点近似已满足 spawner ±1.25m 随机需求）。

---

## Task 1: 工具页框架 + 敌人圆点 CRUD（fork toilet_zone_marker）

**Files:**

- Create: `tools/enemy_marker.html`

**Interfaces:**

- Consumes: `maps/campus.map.json`（`obstacles.boundary/footprintBuildings/grounds` 底图 + 顶层 `enemies[]` 回填）、`POST /api/solidify`
- Produces: 工具页能加载校园底图、放置/选中/拖拽/删除 7 种敌人圆点、加载现有 enemies 回填、基础保存（POST enemies）

- [ ] **Step 1: 创建 `tools/enemy_marker.html`（fork toilet_zone_marker + 敌人圆点改造）**

复制 `tools/toilet_zone_marker.html` 全文为 `tools/enemy_marker.html`，然后做以下改造（用搜索定位替换）：

**1a. 标题 + 顶部类型选择器**。把 toilet 的标题改成敌人工具，body 顶部加 7 类型选择按钮。找到原 `<body>` 下的标题/按钮区（约 L115-138），替换为：

```html
<h2>🧟 校园敌人放置工具</h2>
<div id="toolbar">
  <span class="hint">类型:</span>
  <button class="type-btn" data-type="student_m" style="background:#556633">学生男</button>
  <button class="type-btn" data-type="student_f" style="background:#6a7a44">学生女</button>
  <button class="type-btn" data-type="teacher_m" style="background:#3a3a42">教师男</button>
  <button class="type-btn" data-type="teacher_f" style="background:#4a4a52">教师女</button>
  <button class="type-btn" data-type="assault" style="background:#4a5c2e">突击车</button>
  <button class="type-btn" data-type="zombie" style="background:#7a3a3a">丧尸</button>
  <button class="type-btn" data-type="hexapod" style="background:#2a4a6a">六足</button>
  <button class="btn" id="patrol-mode-btn">🚶 巡逻模式(关)</button>
</div>
```

并在 `<style>` 里加 `.type-btn` 样式（找到原 `.btn` 样式块追加）：

```css
.type-btn {
  padding: 4px 8px;
  margin: 2px;
  border: 1px solid #555;
  border-radius: 3px;
  color: #fff;
  font-size: 12px;
  cursor: pointer;
}
.type-btn.active {
  outline: 2px solid #ffd34d;
  outline-offset: 1px;
}
```

**1b. 数据模型替换**。toilet 用 `zones`（矩形），enemy_marker 用 `enemies`（圆点）。找到 `let zones = []`（约 L141），替换为：

```js
let enemies = []; // {id, type, variant?, _seed, x, z, hp, speed, viewDist, attackDamage, attackCooldown, dropRate, dropHeal, score, reactive, aggressive, patrolPath:[]}
let selIdx = -1; // 选中敌人索引
let curType = 'student_m'; // 当前放置类型
let patrolMode = false; // 巡逻点添加模式
let campusData = null;
```

**1c. `loadCampus()` 回填 enemies**。找到 `loadCampus()`（约 L159-170），把 `zones = campusData.obstacles.toiletZones || []` 改为：

```js
campusData = cd;
enemies = (cd.enemies || []).map(function (e) {
  return {
    id: e.id || 'e' + Math.random().toString(36).slice(2, 7),
    type: e.type || 'zombie',
    variant: e.variant || null,
    _seed: e._seed != null ? e._seed : Math.floor(Math.random() * 1e6),
    x: e.position ? e.position[0] : 0,
    z: e.position ? e.position[2] : 0,
    hp: e.hp != null ? e.hp : 40,
    speed: e.speed != null ? e.speed : 2.0,
    viewDist: e.viewDist != null ? e.viewDist : 25,
    attackDamage: e.attackDamage != null ? e.attackDamage : 8,
    attackCooldown: e.attackCooldown != null ? e.attackCooldown : 1.5,
    dropRate: e.dropRate != null ? e.dropRate : 0.25,
    dropHeal: e.dropHeal != null ? e.dropHeal : 30,
    score: e.score != null ? e.score : 50,
    reactive: e.reactive !== undefined ? e.reactive : true,
    aggressive: e.aggressive !== undefined ? e.aggressive : false,
    patrolPath: (e.patrolPath || []).map(function (p) {
      return [p[0], p[1]];
    }),
  };
});
spawnConfig = Object.assign(
  {
    enabled: true,
    initialCount: 15,
    interval: 20,
    batch: 6,
    cap: 30,
    ratio: { student_m: 0.4, student_f: 0.35, teacher_m: 0.15, teacher_f: 0.1 },
    doors: null,
  },
  cd.spawnConfig || {}
);
```

（`spawnConfig` 在顶部 `let` 声明，Task 4 用。此处先加 `let spawnConfig = null;` 到数据模型区。）

**1d. 敌人圆点渲染**。找到 `draw()` 内 zones 渲染段（约 L229-273，从 `// 绘制区域` 到角柄/旋转柄绘制结束），整段替换为：

```js
// 绘制敌人圆点
var TYPE_COLORS = {
  student_m: '#556633',
  student_f: '#6a7a44',
  teacher_m: '#3a3a42',
  teacher_f: '#4a4a52',
  assault: '#4a5c2e',
  zombie: '#7a3a3a',
  hexapod: '#2a4a6a',
};
for (var i = 0; i < enemies.length; i++) {
  var en = enemies[i];
  var c = w2c(en.x, en.z);
  var col = TYPE_COLORS[en.type] || '#888';
  // 视野圈（viewDist 半径，虚线）
  if (en.viewDist) {
    ctx.beginPath();
    ctx.arc(c.x, c.y, en.viewDist * scale, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,200,80,0.25)';
    ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  // 巡逻折线
  if (en.patrolPath && en.patrolPath.length) {
    ctx.beginPath();
    ctx.moveTo(c.x, c.y);
    for (var pi = 0; pi < en.patrolPath.length; pi++) {
      var pp = w2c(en.patrolPath[pi][0], en.patrolPath[pi][1]);
      ctx.lineTo(pp.x, pp.y);
    }
    ctx.strokeStyle = 'rgba(255,140,40,0.7)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    for (pi = 0; pi < en.patrolPath.length; pi++) {
      pp = w2c(en.patrolPath[pi][0], en.patrolPath[pi][1]);
      ctx.beginPath();
      ctx.arc(pp.x, pp.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#ff8c28';
      ctx.fill();
    }
  }
  // 圆点本体
  ctx.beginPath();
  ctx.arc(c.x, c.y, 7, 0, Math.PI * 2);
  ctx.fillStyle = col;
  ctx.fill();
  ctx.strokeStyle = i === selIdx ? '#ffd34d' : '#fff';
  ctx.lineWidth = i === selIdx ? 3 : 1.5;
  ctx.stroke();
}
```

**1e. 命中检测 + 圆点拖拽**。找到 `hitZone`（约 L367）和 zoneCorners/hitCorner/hitRotate（L319-399），整段替换为简单的圆点命中：

```js
function hitEnemy(cx, cy) {
  for (var i = enemies.length - 1; i >= 0; i--) {
    var en = enemies[i];
    var c = w2c(en.x, en.z);
    var dx = cx - c.x,
      dy = cy - c.y;
    if (dx * dx + dy * dy <= 100) return i; // 半径 10px
  }
  return -1;
}
```

**1f. mousedown/mousemove/mouseup 状态机**。找到原 mousedown（约 L413-457），替换"命中区域→move / 未命中→draw"逻辑为：

```js
canvas.addEventListener('mousedown', function (e) {
  var r = canvas.getBoundingClientRect();
  var cx = e.clientX - r.left,
    cy = e.clientY - r.top;
  if (patrolMode && selIdx >= 0) {
    // 巡逻模式：点击添加巡逻点
    var w = c2w(cx, cy);
    enemies[selIdx].patrolPath.push([w.x, w.z]);
    draw();
    updateEnemyList();
    return;
  }
  var hi = hitEnemy(cx, cy);
  if (hi >= 0) {
    selIdx = hi;
    dragMode = 'move';
    dragOffset = {
      x: cx - w2c(enemies[hi].x, enemies[hi].z).x,
      y: cy - w2c(enemies[hi].x, enemies[hi].z).y,
    };
  } else {
    // 放置新敌人
    var w2 = c2w(cx, cy);
    var newEn = newEnemy(curType, w2.x, w2.z);
    enemies.push(newEn);
    selIdx = enemies.length - 1;
    dragMode = 'move';
    dragOffset = { x: 0, y: 0 };
  }
  syncPanel();
  draw();
  updateEnemyList();
});
```

mousemove（约 L466-522）替换为圆点拖拽（去掉角柄/旋转）：

```js
canvas.addEventListener('mousemove', function (e) {
  var r = canvas.getBoundingClientRect();
  var cx = e.clientX - r.left,
    cy = e.clientY - r.top;
  if (dragMode === 'move' && selIdx >= 0) {
    var w = c2w(cx - dragOffset.x, cy - dragOffset.y);
    enemies[selIdx].x = w.x;
    enemies[selIdx].z = w.z;
    draw();
  }
});
```

mouseup 清 `dragMode = null`（保留原逻辑，去掉角柄写回）。

**1g. `newEnemy(type, x, z)` 工厂 + 类型默认值**。在 `loadCampus` 前加：

```js
var TYPE_DEFAULTS = {
  student_m: {
    type: 'zombie',
    variant: 'student_m',
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
    type: 'zombie',
    variant: 'student_f',
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
    type: 'zombie',
    variant: 'teacher_m',
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
    type: 'zombie',
    variant: 'teacher_f',
    hp: 120,
    speed: 1.0,
    viewDist: 40,
    attackDamage: 20,
    attackCooldown: 2.5,
    dropRate: 0.25,
    dropHeal: 30,
    score: 200,
  },
  assault: {
    type: 'assault',
    variant: null,
    hp: 60,
    speed: 5.0,
    viewDist: 50,
    attackDamage: 15,
    attackCooldown: 3.0,
    dropRate: 0.25,
    dropHeal: 30,
    score: 100,
  },
  zombie: {
    type: 'zombie',
    variant: null,
    hp: 40,
    speed: 2.5,
    viewDist: 35,
    attackDamage: 10,
    attackCooldown: 1.5,
    dropRate: 0.3,
    dropHeal: 20,
    score: 50,
  },
  hexapod: {
    type: 'hexapod',
    variant: null,
    hp: 100,
    speed: 4.5,
    viewDist: 60,
    attackDamage: 15,
    attackCooldown: 0.15,
    dropRate: 0.35,
    dropHeal: 40,
    score: 200,
  },
};
function newEnemy(typeKey, x, z) {
  var d = TYPE_DEFAULTS[typeKey] || TYPE_DEFAULTS.student_m;
  return {
    id: 'e' + Math.random().toString(36).slice(2, 8),
    type: d.type,
    variant: d.variant,
    _seed: Math.floor(Math.random() * 1e6),
    x: x,
    z: z,
    hp: d.hp,
    speed: d.speed,
    viewDist: d.viewDist,
    attackDamage: d.attackDamage,
    attackCooldown: d.attackCooldown,
    dropRate: d.dropRate,
    dropHeal: d.dropHeal,
    score: d.score,
    reactive: true,
    aggressive: false,
    patrolPath: [],
  };
}
```

**1h. 类型按钮 + 巡逻模式绑定**。在 `loadCampus()` 调用前（或 DOM ready）加：

```js
document.querySelectorAll('.type-btn').forEach(function (b) {
  b.addEventListener('click', function () {
    curType = b.dataset.type;
    document.querySelectorAll('.type-btn').forEach(function (x) {
      x.classList.remove('active');
    });
    b.classList.add('active');
  });
});
document.querySelector('.type-btn[data-type="student_m"]').classList.add('active');
document.getElementById('patrol-mode-btn').addEventListener('click', function () {
  patrolMode = !patrolMode;
  this.textContent = '🚶 巡逻模式(' + (patrolMode ? '开' : '关') + ')';
  this.classList.toggle('active', patrolMode);
});
```

**1i. `saveEnemies()` 替换 `saveZones()`**。找到 `saveZones()`（约 L593-606），替换为：

```js
function saveEnemies() {
  var payload = {
    type: 'enemies',
    enemies: enemies.map(function (e) {
      var o = {
        id: e.id,
        type: e.type,
        _seed: e._seed,
        position: [e.x, 0, e.z],
        patrolPath: e.patrolPath.map(function (p) {
          return [p[0], p[1]];
        }),
        hp: e.hp,
        speed: e.speed,
        viewDist: e.viewDist,
        attackDamage: e.attackDamage,
        attackCooldown: e.attackCooldown,
        dropRate: e.dropRate,
        dropHeal: e.dropHeal,
        score: e.score,
        reactive: e.reactive,
        aggressive: e.aggressive,
      };
      if (e.variant) o.variant = e.variant;
      return o;
    }),
    spawnConfig: spawnConfig,
  };
  setStatus('⏳ 保存中...');
  fetch('/api/solidify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
    .then(function (r) {
      if (r.ok) return r.json();
      throw new Error('HTTP ' + r.status);
    })
    .then(function (res) {
      setStatus('✅ 已保存 ' + payload.enemies.length + ' 个敌人到 campus.map.json');
    })
    .catch(function (err) {
      setStatus('❌ 保存失败: ' + err.message);
    });
}
```

保存按钮 onclick 改 `saveEnemies()`（找到 `onclick="saveZones()"` 替换）。

**1j. 敌人列表 `updateEnemyList()`**。找到 `updateZoneList()`（约 L336-360），替换为：

```js
function updateEnemyList() {
  var list = document.getElementById('zone-list') || document.getElementById('enemy-list');
  if (!list) return;
  list.innerHTML = '';
  for (var i = 0; i < enemies.length; i++) {
    (function (idx) {
      var en = enemies[idx];
      var div = document.createElement('div');
      div.className = 'list-item' + (idx === selIdx ? ' selected' : '');
      var label = (en.variant || en.type) + ' (' + Math.round(en.x) + ',' + Math.round(en.z) + ')';
      div.innerHTML = '<span>' + label + '</span>';
      div.onclick = function () {
        selIdx = idx;
        syncPanel();
        draw();
        updateEnemyList();
      };
      list.appendChild(div);
    })(i);
  }
}
```

（HTML 里把 `#zone-list` 改成 `#enemy-list`，或保留 id 复用——本 plan 用复用，不改 id。）

- [ ] **Step 2: CDP 验证基础闭环**

启动 `python server.py`，CDP 打开 `http://127.0.0.1:8080/tools/enemy_marker.html`，控制台执行：

```js
console.log('loaded enemies:', enemies.length);
// 模拟放置一个敌人
enemies.push(newEnemy('teacher_f', 5, 5));
console.log('after add:', enemies.length, 'last variant:', enemies[enemies.length - 1].variant);
```

Expected：`loaded enemies: 4`（P1 的测试数据）；放置后 `last variant: teacher_f`；控制台 0 错误；画布显示校园底图 + 4 个敌人圆点。

- [ ] **Step 3: Commit**

```bash
git add tools/enemy_marker.html
git commit -m "feat(P5): enemy_marker 工具页框架(fork toilet_zone_marker)+敌人圆点CRUD+基础保存"
```

---

## Task 2: 行为面板（8 字段 + 3 模式按钮）

**Files:**

- Modify: `tools/enemy_marker.html`（右侧面板 + `syncPanel()`）

**Interfaces:**

- Consumes: Task 1 的 `enemies[]` / `selIdx`
- Produces: 选中敌人时 8 字段 + 3 模式可编辑，写入扁平字段

- [ ] **Step 1: 右侧面板加行为面板 HTML**

找到原右侧面板的"区域字段"区（toilet 的宽度/旋转/数量等 input，约 L120-135 之间的 `#panel` 内容），在敌人列表下方加行为面板（字段 id/min/max/step 取自 `map_editor.html:1067-1099`）：

```html
<div id="behavior-panel" style="display:none">
  <h3>⚙ 行为参数 <span id="batch-tag"></span></h3>
  <div class="cfg-row">
    <label>HP</label><input type="number" id="cfg-hp" min="1" max="999" step="1" />
  </div>
  <div class="cfg-row">
    <label>速度</label><input type="number" id="cfg-speed" min="0.1" max="20" step="0.1" />
  </div>
  <div class="cfg-row">
    <label>视野(m)</label><input type="number" id="cfg-view" min="5" max="200" step="1" />
  </div>
  <div class="cfg-row">
    <label>攻击伤害</label><input type="number" id="cfg-atkdmg" min="1" max="100" step="1" />
  </div>
  <div class="cfg-row">
    <label>攻击冷却(s)</label><input type="number" id="cfg-atkcd" min="0.5" max="30" step="0.1" />
  </div>
  <div class="cfg-row">
    <label>掉落概率</label><input type="number" id="cfg-drop" min="0" max="1" step="0.05" />
  </div>
  <div class="cfg-row">
    <label>回血量</label><input type="number" id="cfg-heal" min="0" max="100" step="1" />
  </div>
  <div class="cfg-row">
    <label>击杀得分</label><input type="number" id="cfg-score" min="0" max="9999" step="1" />
  </div>
  <div class="cfg-modes">
    <button class="cfg-mode-btn" data-mode="reactive">被动(反击)</button>
    <button class="cfg-mode-btn" data-mode="aggressive">主动(追击)</button>
    <button class="cfg-mode-btn" data-mode="none">不反击</button>
  </div>
  <div id="cfg-patrol-preview"></div>
</div>
```

`.cfg-row`/`.cfg-mode-btn` 样式（找到 `<style>` 里现有样式追加，参考 map_editor.html:699-714）：

```css
.cfg-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 3px 0;
}
.cfg-row label {
  width: 70px;
  font-size: 12px;
  color: #bbb;
}
.cfg-row input {
  flex: 1;
  width: 60px;
  padding: 2px 4px;
  background: #222;
  color: #eee;
  border: 1px solid #444;
  border-radius: 2px;
}
.cfg-modes {
  display: flex;
  gap: 4px;
  margin: 6px 0;
}
.cfg-mode-btn {
  flex: 1;
  padding: 3px 4px;
  font-size: 11px;
  background: #333;
  color: #ccc;
  border: 1px solid #555;
  border-radius: 2px;
  cursor: pointer;
}
.cfg-mode-btn.active {
  background: #4a6a2e;
  color: #fff;
}
```

- [ ] **Step 2: `syncPanel()` 回填 + 写入逻辑**

在 `updateEnemyList` 附近加 `syncPanel()`（剥离 editor_entities.js:442-587，去批量，扁平字段）：

```js
var CFG_FIELDS = [
  ['cfg-hp', 'hp'],
  ['cfg-speed', 'speed'],
  ['cfg-view', 'viewDist'],
  ['cfg-atkdmg', 'attackDamage'],
  ['cfg-atkcd', 'attackCooldown'],
  ['cfg-drop', 'dropRate'],
  ['cfg-heal', 'dropHeal'],
  ['cfg-score', 'score'],
];
function syncPanel() {
  var panel = document.getElementById('behavior-panel');
  if (selIdx < 0 || !enemies[selIdx]) {
    panel.style.display = 'none';
    return;
  }
  panel.style.display = 'block';
  var en = enemies[selIdx];
  CFG_FIELDS.forEach(function (pair) {
    var el = document.getElementById(pair[0]);
    if (el) el.value = en[pair[1]];
  });
  // 行为模式高亮
  document.querySelectorAll('.cfg-mode-btn').forEach(function (b) {
    var m = b.dataset.mode;
    var active =
      (m === 'reactive' && en.reactive === true && en.aggressive !== true) ||
      (m === 'aggressive' && en.aggressive === true) ||
      (m === 'none' && en.reactive === false && en.aggressive !== true);
    b.classList.toggle('active', active);
  });
  // 巡逻点预览
  var pv = document.getElementById('cfg-patrol-preview');
  pv.innerHTML = en.patrolPath.length
    ? '<div class="hint">巡逻点(' +
      en.patrolPath.length +
      '): ' +
      en.patrolPath
        .map(function (p) {
          return '(' + Math.round(p[0]) + ',' + Math.round(p[1]) + ')';
        })
        .join('→') +
      '</div>'
    : '<div class="hint">无巡逻点（切巡逻模式点击画布添加）</div>';
}
// 字段写入
CFG_FIELDS.forEach(function (pair) {
  var el = document.getElementById(pair[0]);
  if (el)
    el.addEventListener('input', function () {
      if (selIdx < 0) return;
      var v = parseFloat(el.value);
      if (!isNaN(v)) {
        enemies[selIdx][pair[1]] = v;
        draw();
      }
    });
});
// 行为模式按钮
document.querySelectorAll('.cfg-mode-btn').forEach(function (b) {
  b.addEventListener('click', function () {
    if (selIdx < 0) return;
    var m = b.dataset.mode;
    if (m === 'reactive') {
      enemies[selIdx].reactive = true;
      enemies[selIdx].aggressive = false;
    } else if (m === 'aggressive') {
      enemies[selIdx].reactive = false;
      enemies[selIdx].aggressive = true;
    } else {
      enemies[selIdx].reactive = false;
      enemies[selIdx].aggressive = false;
    }
    syncPanel();
  });
});
```

- [ ] **Step 3: CDP 验证行为面板**

CDP 加载工具页，控制台：

```js
selIdx = 0;
syncPanel();
console.log('panel visible:', document.getElementById('behavior-panel').style.display);
console.log('hp input:', document.getElementById('cfg-hp').value, 'enemy hp:', enemies[0].hp);
// 改 hp
document.getElementById('cfg-hp').value = 99;
document.getElementById('cfg-hp').dispatchEvent(new Event('input'));
console.log('after edit enemy hp:', enemies[0].hp);
```

Expected：`panel visible: block`；hp 回填正确（如 cz_sm_1 的 40）；编辑后 `enemy hp: 99`；0 错误。

- [ ] **Step 4: Commit**

```bash
git add tools/enemy_marker.html
git commit -m "feat(P5): 行为面板(8字段+3模式按钮)选中敌人编辑写入扁平字段"
```

---

## Task 3: 巡逻点编辑（点击添加 + 清除）

**Files:**

- Modify: `tools/enemy_marker.html`（巡逻模式已在 Task 1 绑定；本 task 加清除 + 列表交互）

**Interfaces:**

- Consumes: Task 1 的 `patrolMode` / Task 2 的 `syncPanel`
- Produces: 巡逻模式点击添加巡逻点、清除巡逻按钮

- [ ] **Step 1: 巡逻点添加已在 Task 1f mousedown 实现（patrolMode 分支 push）。补"清除巡逻"按钮**

在行为面板 `#cfg-patrol-preview` 上方加按钮：

```html
<button class="btn" id="clear-patrol-btn" style="margin-top:4px">🗑 清除当前敌人巡逻点</button>
```

绑定（在 `syncPanel` 定义后）：

```js
document.getElementById('clear-patrol-btn').addEventListener('click', function () {
  if (selIdx >= 0) {
    enemies[selIdx].patrolPath = [];
    syncPanel();
    draw();
    updateEnemyList();
  }
});
```

- [ ] **Step 2: CDP 验证巡逻**

```js
selIdx = 0;
patrolMode = true;
// 模拟点击画布添加巡逻点（直接 push 测试）
enemies[0].patrolPath.push([3, 3], [3, -3], [-3, -3]);
console.log('patrol len:', enemies[0].patrolPath.length);
syncPanel();
document.getElementById('clear-patrol-btn').click();
console.log('after clear:', enemies[0].patrolPath.length);
```

Expected：`patrol len: 3`；清除后 `0`；0 错误。

- [ ] **Step 3: Commit**

```bash
git add tools/enemy_marker.html
git commit -m "feat(P5): 巡逻点编辑(巡逻模式点击添加+清除按钮)"
```

---

## Task 4: 刷新配置面板 + 门提取/编辑

**Files:**

- Modify: `tools/enemy_marker.html`（右侧面板 spawnConfig 区 + `_extractDoors` 复制）

**Interfaces:**

- Consumes: Task 1 的 `spawnConfig`（loadCampus 回填）+ `campusData`
- Produces: spawnConfig 编辑（enabled/initialCount/interval/batch/cap/ratio/doors）+ 门圆点可视化编辑

- [ ] **Step 1: 复制 `_extractDoors`（campus_spawner.js:51-67 边中点近似）**

在 `loadCampus` 前加：

```js
function extractDoors(data) {
  var doors = [];
  var blds = (data && data.obstacles && data.obstacles.footprintBuildings) || [];
  for (var bi = 0; bi < blds.length; bi++) {
    var fp = blds[bi].footprint;
    var marks = blds[bi].edgeMarks || [];
    for (var mi = 0; mi < marks.length; mi++) {
      if (marks[mi].type !== 'corridor') continue;
      var ei = marks[mi].ei;
      if (ei == null || !fp || !fp[ei]) continue;
      var a = fp[ei],
        c = fp[(ei + 1) % fp.length];
      doors.push([(a[0] + c[0]) / 2, (a[1] + c[1]) / 2]);
    }
  }
  return doors;
}
```

`loadCampus` 回填后补：`if (!spawnConfig.doors) spawnConfig.doors = extractDoors(cd);`（加到 Task 1c 的 `spawnConfig = Object.assign(...)` 之后）。

- [ ] **Step 2: 刷新配置面板 HTML**

在行为面板下方加：

```html
<div id="spawn-panel">
  <h3>🔄 刷新配置</h3>
  <div class="cfg-row"><label>启用</label><input type="checkbox" id="sp-enabled" /></div>
  <div class="cfg-row">
    <label>初始数量</label><input type="number" id="sp-initial" min="0" max="100" step="1" />
  </div>
  <div class="cfg-row">
    <label>间隔(s)</label><input type="number" id="sp-interval" min="5" max="120" step="1" />
  </div>
  <div class="cfg-row">
    <label>每批</label><input type="number" id="sp-batch" min="1" max="20" step="1" />
  </div>
  <div class="cfg-row">
    <label>上限</label><input type="number" id="sp-cap" min="1" max="100" step="1" />
  </div>
  <h4 style="margin:8px 0 2px">比例(学生男/女/教师男/女)</h4>
  <div class="cfg-row">
    <label>学生男</label><input type="number" id="sp-r-sm" min="0" max="1" step="0.05" />
  </div>
  <div class="cfg-row">
    <label>学生女</label><input type="number" id="sp-r-sf" min="0" max="1" step="0.05" />
  </div>
  <div class="cfg-row">
    <label>教师男</label><input type="number" id="sp-r-tm" min="0" max="1" step="0.05" />
  </div>
  <div class="cfg-row">
    <label>教师女</label><input type="number" id="sp-r-tf" min="0" max="1" step="0.05" />
  </div>
  <h4 style="margin:8px 0 2px">
    门(刷新点) <button class="btn" id="reextract-doors">↻ 重新提取</button>
  </h4>
  <div class="hint" id="doors-count"></div>
</div>
```

- [ ] **Step 3: spawnConfig 同步逻辑**

加 `syncSpawnPanel()` + 字段绑定：

```js
var SP_FIELDS = [
  ['sp-enabled', 'enabled', 'checked'],
  ['sp-initial', 'initialCount', 'value'],
  ['sp-interval', 'interval', 'value'],
  ['sp-batch', 'batch', 'value'],
  ['sp-cap', 'cap', 'value'],
  ['sp-r-sm', 'student_m', 'ratio'],
  ['sp-r-sf', 'student_f', 'ratio'],
  ['sp-r-tm', 'teacher_m', 'ratio'],
  ['sp-r-tf', 'teacher_f', 'ratio'],
];
function syncSpawnPanel() {
  document.getElementById('sp-enabled').checked = !!spawnConfig.enabled;
  document.getElementById('sp-initial').value = spawnConfig.initialCount;
  document.getElementById('sp-interval').value = spawnConfig.interval;
  document.getElementById('sp-batch').value = spawnConfig.batch;
  document.getElementById('sp-cap').value = spawnConfig.cap;
  var r = spawnConfig.ratio || {};
  document.getElementById('sp-r-sm').value = r.student_m != null ? r.student_m : 0.4;
  document.getElementById('sp-r-sf').value = r.student_f != null ? r.student_f : 0.35;
  document.getElementById('sp-r-tm').value = r.teacher_m != null ? r.teacher_m : 0.15;
  document.getElementById('sp-r-tf').value = r.teacher_f != null ? r.teacher_f : 0.1;
  document.getElementById('doors-count').textContent =
    '门数: ' + (spawnConfig.doors || []).length + ' (蓝色圆点, 可在画布拖动)';
}
SP_FIELDS.forEach(function (pair) {
  var el = document.getElementById(pair[0]);
  if (!el) return;
  el.addEventListener('input', function () {
    if (pair[2] === 'checked') spawnConfig.enabled = el.checked;
    else if (pair[2] === 'ratio') {
      spawnConfig.ratio = spawnConfig.ratio || {};
      spawnConfig.ratio[pair[1]] = parseFloat(el.value) || 0;
    } else spawnConfig[pair[1]] = parseFloat(el.value) || 0;
  });
});
document.getElementById('reextract-doors').addEventListener('click', function () {
  spawnConfig.doors = extractDoors(campusData);
  syncSpawnPanel();
  draw();
});
// loadCampus 末尾调 syncSpawnPanel()
```

在 `loadCampus` 的 `.then` 末尾加 `syncSpawnPanel(); draw(); updateEnemyList();`（如果 Task 1 没加）。

- [ ] **Step 4: 门圆点渲染 + 拖动（draw 末尾 + mousedown/move）**

`draw()` 末尾（敌人圆点画完后）加：

```js
// 门点（蓝色方块）
var doors = (spawnConfig && spawnConfig.doors) || [];
for (var di = 0; di < doors.length; di++) {
  var dc = w2c(doors[di][0], doors[di][1]);
  ctx.fillStyle = '#3a7adf';
  ctx.fillRect(dc.x - 4, dc.y - 4, 8, 8);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1;
  ctx.strokeRect(dc.x - 4, dc.y - 4, 8, 8);
}
```

门拖动：在 mousedown 命中检测前加门命中（按住 Shift 拖门，或专门门拖动模式——简化为：门命中优先于敌人，拖动门）：

```js
var dragDoor = -1;
// mousedown 开头加：
for (var di = 0; di < (spawnConfig.doors || []).length; di++) {
  var dc = w2c(spawnConfig.doors[di][0], spawnConfig.doors[di][1]);
  if (Math.abs(cx - dc.x) <= 5 && Math.abs(cy - dc.y) <= 5) {
    dragDoor = di;
    return;
  }
}
// mousemove 开头加：
if (dragDoor >= 0) {
  var wd = c2w(cx, cy);
  spawnConfig.doors[dragDoor] = [wd.x, wd.z];
  draw();
  return;
}
// mouseup 开头加：dragDoor = -1;
```

- [ ] **Step 5: CDP 验证刷新配置 + 门**

```js
syncSpawnPanel();
console.log('doors:', (spawnConfig.doors || []).length, 'enabled:', spawnConfig.enabled);
document.getElementById('sp-cap').value = 50;
document.getElementById('sp-cap').dispatchEvent(new Event('input'));
console.log('cap now:', spawnConfig.cap);
```

Expected：`doors: 6`（6 条 corridor 边中点）；`enabled: true`；改 cap 后 `cap now: 50`；画布显示 6 个蓝色门方块；0 错误。

- [ ] **Step 6: Commit**

```bash
git add tools/enemy_marker.html
git commit -m "feat(P5): 刷新配置面板+门提取(extractDoors边中点)+门圆点可视化编辑"
```

---

## Task 5: 端到端验证（Playwright）

**Files:**

- Test: 临时 `pw_test_p5.js`（用后清理）

**Interfaces:**

- Consumes: Task 1-4 全部

- [ ] **Step 1: 写 Playwright 验证脚本 `pw_test_p5.js`**

```js
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('http://127.0.0.1:8080/tools/enemy_marker.html');
  await page.waitForFunction(() => window.enemies && window.campusData, null, { timeout: 15000 });
  const r = await page.evaluate(() => {
    // 放一个教师女 + 改 hp + 加巡逻 + 设 cap
    const before = enemies.length;
    const e = newEnemy('teacher_f', 8, 8);
    enemies.push(e);
    selIdx = enemies.length - 1;
    enemies[selIdx].hp = 150;
    enemies[selIdx].patrolPath = [
      [8, 12],
      [12, 12],
    ];
    spawnConfig.cap = 40;
    spawnConfig.enabled = true;
    return {
      loaded: before,
      addedVariant: enemies[selIdx].variant,
      hpSet: enemies[selIdx].hp,
      patrolLen: enemies[selIdx].patrolPath.length,
      doors: (spawnConfig.doors || []).length,
      cap: spawnConfig.cap,
    };
  });
  // 保存
  await page.evaluate(() => saveEnemies());
  await page.waitForTimeout(1500);
  // 重载确认落盘
  const check = await page.evaluate(async () => {
    const d = await fetch('../maps/campus.map.json').then((r) => r.json());
    const found = (d.enemies || []).find((e) => e.variant === 'teacher_f' && e.hp === 150);
    return {
      enemyCount: (d.enemies || []).length,
      savedHp: found && found.hp,
      savedPatrol: found && found.patrolPath && found.patrolPath.length,
      savedPos: found && found.position,
      scCap: d.spawnConfig && d.spawnConfig.cap,
      scDoors: d.spawnConfig && d.spawnConfig.doors && d.spawnConfig.doors.length,
    };
  });
  console.log('edit:', JSON.stringify(r));
  console.log('persist:', JSON.stringify(check));
  console.log('errors:', errors.length, errors.slice(0, 5));
  await page.screenshot({ path: 'pw_p5_marker.png' });
  await browser.close();
  if (!check.savedHp || check.savedPatrol !== 2 || !check.scDoors || errors.length) process.exit(1);
})();
```

- [ ] **Step 2: 启动服务并运行**

```bash
python server.py &
node pw_test_p5.js
```

Expected：`loaded: 4`；`doors: 6`；`persist.savedHp: 150`；`persist.savedPatrol: 2`；`persist.savedPos: [8,0,8]`；`persist.scDoors: 6`；`errors: 0`；截图可见敌人圆点 + 巡逻折线 + 门方块。

- [ ] **Step 3: 进游戏确认敌人出现（可选人工）**

打开 `http://127.0.0.1:8080/index.html` 选校园地图进入，确认保存的敌人出现在对应位置（数量 = 固定 enemies + spawner 刷新）。

- [ ] **Step 4: 清理 + Commit**

```bash
rm pw_test_p5.js pw_p5_marker.png
git add -A
git commit -m "test(P5): enemy_marker 端到端验证(放置/行为/巡逻/刷新配置/保存重载)"
```

---

## Self-Review 结论

**Spec 覆盖**：本 plan 覆盖 spec 7.1（敌人放置工具页全部功能：7 种敌人选择器 / 圆点放置-选中-移动-删除 / 行为面板 8 字段+3 模式 / 巡逻点 / 刷新配置面板+门勾选 / 保存加载）、7.2（campus.map.json enemies+spawnConfig 数据，由工具页 POST 写入）、7.3（server.py enemies 端点 P2 已做，零改动）。**未覆盖**（属 P6/后续）：精确门位置（每间教室一扇）、工具页批量编辑（spec 提及但 YAGNI——工具页单选编辑已够用，可后续加）。

**数据格式一致性**（最关键）：

- enemy 扁平字段（hp/speed/.../reactive/aggressive 直接挂根，**不套 cfg**）——与 `campus.map.json` 现有 4 只 enemies（P1）+ `campus_spawner` 消费一致。
- `position: [x, y, z]` 3 元数组（y=0）——与 P1 一致。
- `patrolPath: [[x,z],...]` 二元组数组——与 `campus_spawner.js:145-151` 消费一致（注意 editor 运行期用 `{x,z}` 对象，但**落盘是 `[x,z]` 数组**，本 plan 按数组）。
- `spawnConfig.doors: [[x,z],...]`——与 `campus_spawner._extractDoors` 返回格式一致。
- `variant` 字段：仅 4 校园丧尸有（student_m/f/teacher_m/f），assault/zombie/hexapod 无 variant（type 即变体）——与 P1 约定一致。

**类型一致性**：`newEnemy(typeKey, x, z)` / `TYPE_DEFAULTS` / `TYPE_COLORS` 三处 type 键一致（student_m/student_f/teacher_m/teacher_f/assault/zombie/hexapod）。`CFG_FIELDS` 的 input id 与 HTML `cfg-*` 一致。`SP_FIELDS` 的 input id 与 HTML `sp-*` 一致。

**主要风险**：

1. **fork 漏改残留**：toilet_zone_marker 的 zoneCorners/hitCorner/hitRotate/角柄缩放/旋转柄代码必须**整段删除**（Task 1d/1e 替换），否则引用未定义 `zones`。Task 1 step 明确"整段替换"。
2. **`patrolPath` 格式**：落盘必须 `[x,z]` 数组（不要 `{x,z}`）。Task 1c 回填 + Task 1i 保存都按数组。
3. **server.py 整体替换**：保存时 enemies + spawnConfig 必须完整 POST（不能增量）。Task 1i saveEnemies 已整体发。
4. **门拖动命中优先级**：门命中在敌人前（Task 4d mousedown 先检测门），避免门被敌人圆点遮挡无法选中。
5. **`campus.map.json` 现有 4 只测试丧尸**：工具页加载会回填它们，用户编辑后保存会覆盖（含 P1 测试数据）。这是预期（工具页是 campus enemies 的权威编辑器）。

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-31-campus-zombies-p5-enemy-marker.md`. Two execution options:

**1. Subagent-Driven (recommended)** — 每个 task 派 fresh subagent 实现 + task 间 review。注意 Claude API 限额（P4 时 Task 2 起 429，限额 2026-07-28 10:51 已重置，应可用；若再 429 改内联）。

**2. Inline Execution** — 本会话内按 executing-plans 批量执行 + 检查点。

选哪种？本 plan 覆盖 P5 放置工具页全流程；P6（校服 Canvas 贴图精修）在 P5 完成后单独规划。
