# 校园丧尸 · 校服精修实现计划 (P6)

> **For agentic workers:** REQUIRED SUB-SKILL: Use Superpowers:subagent-driven-development (recommended) or Superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 工厂 + 游戏两侧的校园丧尸视觉从"纯色塑料感"提升到"辨认度精修"——工厂补 Canvas 贴图（珠地/暗斑/校徽/斜条）、头发改真半球、hips 改后侧扁椭球（curves 放大不前凸）、女生加半球头发 base。

**Architecture:** 改 3 文件：`models/humanoid_config.js`（ADDON_LIBRARY 几何：short_hair_m 半球 + hips 扁椭球 + student_f/teacher_f 加 short_hair_m）、`models/enemies.js`（buildHumanoidRig Sphere case 加 thetaLength）、`model_factory.html`（createGeometry Sphere 加 thetaLength + getMaterial 加 Canvas 贴图生成 + MATERIAL_DEFS 改 map）。两侧 createGeometry 同步 thetaLength；贴图逻辑两侧统一（共用 enemies.js 的 Canvas 参数）。

**Tech Stack:** Three.js r160、Canvas 2D 程序化贴图、原生 JS、CDP + Playwright 验证。

## Global Constraints

- **辨认度精修**（spec 6.4）：不做 PBR 法线/写实（超 Y 档，项目无 PBR 管线）。仅 Canvas 贴图 + 几何形状修复。
- **零回归**：`thetaLength` 默认 `Math.PI`（全球），现有 Sphere 节点（头/眼/球/纽扣/胸/臀）无 `thetaLength` 字段 → 走默认全球，视觉不变。**只改** buildHumanoidRig（enemies.js:1069）+ 工厂 createGeometry 的 Sphere case；**不碰** enemies.js:515（createZombie 旧丧尸）+ enemies.js:1669（别的模型）。
- **两侧同步**：人形 Sphere 几何在两处 createGeometry（enemies.js buildHumanoidRig 游戏 + model_factory 工厂），thetaLength 支持要两侧都加。贴图参数两侧一致（polo/skin/badge/stripes 的 Canvas 逻辑共用 enemies.js 的设计）。
- **hips scale 复用现有支持**：buildHumanoidRig 已支持 `node.scale`（enemies.js buildNode 内 `if (node.scale) group.scale.set(...)`）；工厂 buildFromConfig 也支持 `node.scale`。无需改 createGeometry，只改 hips 节点字段。
- **女生发型**：student_f/teacher_f 的 addons 列表在 `short_hair_m`（base 半球头发）之后追加 ponytail_f/fringe_f（学生）/bun_f（教师）。
- **验证基线**：每个 task 后 CDP 加载 `model_factory.html` 控制台 0 错误；最终 task 用 Playwright 工厂 + 游戏两侧截图对比。
- **行号基准**：enemies.js 行号基于当前文件；执行时用 Grep 按 `case 'Sphere'` 锚点定位（buildHumanoidRig 的是含 `const s = node.segments || [8, 6]` 的那个）。

## File Structure

| 文件                        | 责任                                                  | 本 plan 改动                                                                                                                               |
| --------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `models/humanoid_config.js` | ADDON_LIBRARY 几何 + HUMANOID_VARIANTS addons         | short_hair_m 加 thetaLength；hips 加 scale+后移；student_f/teacher_f 加 short_hair_m                                                       |
| `models/enemies.js`         | buildHumanoidRig createGeometry（人形游戏侧）         | Sphere case 加 thetaLength 参数                                                                                                            |
| `model_factory.html`        | createGeometry（工厂侧）+ getMaterial + MATERIAL_DEFS | Sphere case 加 thetaLength；getMaterial 加 4 Canvas 贴图生成；MATERIAL_DEFS 的 polo_white/skin_zombie/school_badge/shoulder_stripes 加 map |

---

## Task 1: Sphere `thetaLength` 支持（两侧 createGeometry）

**Files:**

- Modify: `models/enemies.js`（buildHumanoidRig createGeometry 的 `case 'Sphere'`，约 L1069-1073）
- Modify: `model_factory.html`（createGeometry 的 `case 'Sphere'`，约 L1071-1072）

**Interfaces:**

- Produces: Sphere 节点支持可选字段 `thetaLength`（弧度，默认 π 全球）；为 Task 2 的 short_hair_m 半球铺路

- [ ] **Step 1: `models/enemies.js` buildHumanoidRig Sphere case 加 thetaLength**

定位 buildHumanoidRig 内的 `case 'Sphere'`（Grep 锚点：`const s = node.segments || [8, 6]; return new THREE.SphereGeometry(r, s[0], s[1]);`，**不是** L515 的 `createZombie` 那个）。当前代码：

```js
                case 'Sphere': {
                    const [r] = node.size;
                    const s = node.segments || [8, 6];
                    return new THREE.SphereGeometry(r, s[0], s[1]);
                }
```

替换为（加 thetaLength，默认 π 向后兼容）：

```js
                case 'Sphere': {
                    const [r] = node.size;
                    const s = node.segments || [8, 6];
                    const tl = node.thetaLength != null ? node.thetaLength : Math.PI;
                    return new THREE.SphereGeometry(r, s[0], s[1], 0, Math.PI * 2, 0, tl);
                }
```

> 注意：enemies.js 还有两处 `case 'Sphere'`（L515 createZombie 旧丧尸 / L1669 别的模型），**不要改**——它们没有 node.thetaLength 上下文，改了会引入未定义变量。只改 buildHumanoidRig 的（含 `const s = node.segments || [8, 6]` 那个）。

- [ ] **Step 2: `model_factory.html` createGeometry Sphere case 加 thetaLength**

定位工厂 createGeometry 的 `case 'Sphere'`（约 L1071-1072，锚点 `return new THREE.SphereGeometry(s[0], seg[0] || 8, seg[1] || 6);`）。当前：

```js
          case 'Sphere':
            return new THREE.SphereGeometry(s[0], seg[0] || 8, seg[1] || 6);
```

替换为：

```js
          case 'Sphere': {
            const tl = node.thetaLength != null ? node.thetaLength : Math.PI;
            return new THREE.SphereGeometry(s[0], seg[0] || 8, seg[1] || 6, 0, Math.PI * 2, 0, tl);
          }
```

- [ ] **Step 3: CDP 验证零回归**

`python server.py`，CDP 打开 `model_factory.html` 切人形 student_m，控制台执行：

```js
currentModelType = 'humanoid';
rebuildModel();
console.log(
  'root ok:',
  !!modelRoot.getObjectByName('root'),
  'eye:',
  !!modelRoot.getObjectByName('l_eye_glow')
);
```

Expected：`root ok: true eye: true`（现有 Sphere 节点无 thetaLength → 默认全球，视觉不变）；0 错误。

- [ ] **Step 4: Commit**

```bash
git add models/enemies.js model_factory.html
git commit -m "feat(P6): Sphere createGeometry 加 thetaLength 支持(两侧,默认π向后兼容)"
```

---

## Task 2: 头发半球 + 女生发型 base

**Files:**

- Modify: `models/humanoid_config.js`（ADDON_LIBRARY `short_hair_m` 的 ah_m 节点 + HUMANOID_VARIANTS `student_f`/`teacher_f`）

**Interfaces:**

- Consumes: Task 1 的 thetaLength 支持
- Produces: short_hair_m 是真半球（不再全球没入头）；女生有半球头发 base（不再光头）

- [ ] **Step 1: `short_hair_m` 的 ah_m Sphere 加 `thetaLength: Math.PI/2`**

定位 `short_hair_m:`（约 L237-253）。当前 ah_m 节点：

```js
          {
            name: 'ah_m',
            type: 'Sphere',
            size: [0.22],
            position: [0, 0, 0],
            materialId: 'hair_black',
            segments: [12, 10],
          },
```

替换为（加 `thetaLength: Math.PI / 2`——上半球，扣头顶不再没入头）：

```js
          {
            name: 'ah_m',
            type: 'Sphere',
            size: [0.22],
            position: [0, 0, 0],
            thetaLength: Math.PI / 2,
            materialId: 'hair_black',
            segments: [12, 10],
          },
```

> `thetaLength=π/2` = 上半球（thetaStart=0 顶部 → 赤道）。SphereGeometry 第 7 参数。Group position `[0,0.2,-0.02]`（头顶上方），上半球向上凸覆盖头顶。

- [ ] **Step 2: `student_f` addons 加 `short_hair_m`（半球头发 base）**

定位 `student_f:`（约 L196-213）。当前 addons 数组首项是 `'ponytail_f'`。在 `'ponytail_f'` **前**插入 `'short_hair_m'`：

```js
      addons: [
        'short_hair_m',
        'ponytail_f',
        'fringe_f',
        'red_scarf',
        'polo_collar',
        'polo_placket',
        'polo_cuff_l',
        'polo_cuff_r',
        'school_badge',
        'shoulder_stripes',
        'pleated_skirt_f',
        'shoes_white',
      ],
```

- [ ] **Step 3: `teacher_f` addons 加 `short_hair_m`**

定位 `teacher_f:`（约 L227-232）。当前 `addons: ['bun_f', 'bust', 'hips', 'skirt_grey', 'leather_shoes', 'necklace_opt']`。在 `'bun_f'` **前**插入 `'short_hair_m'`：

```js
      addons: ['short_hair_m', 'bun_f', 'bust', 'hips', 'skirt_grey', 'leather_shoes', 'necklace_opt'],
```

- [ ] **Step 4: CDP 验证头发半球 + 女生 base**

CDP 加载 `model_factory.html`，切 student_f（用 GUI 变体下拉或 `_humanoidEdit.variant='student_f'; _applyHumanoidEdit();`），控制台：

```js
_humanoidEdit.variant = 'student_f';
_applyHumanoidEdit();
const hair = modelRoot.getObjectByName('ah_m');
console.log(
  'hair geo params:',
  hair && hair.geometry && hair.geometry.parameters && hair.geometry.parameters.thetaLength
);
```

Expected：`thetaLength: 1.5707...`（π/2）；女生头有 ah_m（半球头发 base）+ ah_pt（马尾）；0 错误。

- [ ] **Step 5: Commit**

```bash
git add models/humanoid_config.js
git commit -m "feat(P6): short_hair_m 半球(thetaLength π/2)+student_f/teacher_f 加头发base"
```

---

## Task 3: hips 后侧扁椭球（curves 放大不前凸）

**Files:**

- Modify: `models/humanoid_config.js`（ADDON_LIBRARY `hips` 的 ah_hips 节点）

**Interfaces:**

- Produces: hips 从居中球 → 后侧扁椭球，curves 放大保持 X>Y>Z 比例（前侧不凸）

- [ ] **Step 1: `hips` 的 ah_hips 加 scale + 后移**

定位 `hips:`（约 L561-575）。当前 ah_hips 节点：

```js
          {
            name: 'ah_hips',
            type: 'Sphere',
            size: [0.3],
            position: [0, 0, -0.02],
            materialId: '__cloth__',
            segments: [8, 6],
          },
```

替换为（`position z:-0.1` 后移到臀位；`scale [1,0.85,0.55]` X 胯宽/Y 臀扁/Z 前后浅）：

```js
          {
            name: 'ah_hips',
            type: 'Sphere',
            size: [0.3],
            position: [0, -0.02, -0.1],
            scale: [1, 0.85, 0.55],
            materialId: '__cloth__',
            segments: [8, 6],
          },
```

> `scale` 字段两侧 createGeometry（buildHumanoidRig + 工厂 buildFromConfig）都已支持（group.scale.set）。curves 放大（`scaleGroup(clone, 0.6+curves*0.8)`）是 uniform 放大 Group，椭球比例 X>Y>Z 保持 → 后侧凸、前侧（z 正）因 scale 0.55 压扁基本不凸。

- [ ] **Step 2: CDP 验证 hips 后侧扁椭球**

CDP 加载 `model_factory.html`，切 teacher_f + curves 调高，控制台：

```js
_humanoidEdit.variant = 'teacher_f';
_humanoidEdit.params.curves = 0.9;
_applyHumanoidEdit();
const hips = modelRoot.getObjectByName('ah_hips');
console.log(
  'hips scale:',
  hips && hips.scale && [hips.scale.x, hips.scale.y, hips.scale.z].join(','),
  'pos z:',
  hips && hips.position.z
);
```

Expected：`hips scale: 1,0.85,0.55`（scale 字段读到，注意 buildHumanoidRig 把 node.scale 应用到 group，这里 mesh 的 parent group scale）；`pos z: -0.1`（后移）；0 错误。

> 视觉确认（截图）：curves 高时 teacher_f 后侧（z 负）凸（臀部），前侧（z 正）不凸。

- [ ] **Step 3: Commit**

```bash
git add models/humanoid_config.js
git commit -m "fix(P6): hips 居中球→后侧扁椭球(scale[1,0.85,0.55]+后移z-0.1,curves放大不前凸)"
```

---

## Task 4: 工厂 Canvas 贴图（getMaterial + MATERIAL_DEFS）

**Files:**

- Modify: `model_factory.html`（MATERIAL_DEFS 的 4 个人形 materialId + getMaterial 加贴图生成）

**Interfaces:**

- Consumes: `enemies.js:createHumanoidMaterials`（L933-1017）的 Canvas 逻辑作模板
- Produces: 工厂人形预览显示珠地/暗斑/校徽/斜条（与游戏侧统一）

- [ ] **Step 1: 加贴图生成缓存 + 函数（仿 enemies.js）**

定位 `model_factory.html` 的 `MATERIAL_DEFS` 定义之后、`getMaterial` 之前（约 L530 `_camoJungleTex` 声明附近）。插入人形贴图生成：

```js
// ── 人形 Canvas 贴图（复刻 enemies.js:createHumanoidMaterials，两侧统一）──
let _humanoidTexCache = null;
function createHumanoidTextures() {
  if (_humanoidTexCache) return _humanoidTexCache;
  // polo_white：白底 + 珠地网眼
  const polo = document.createElement('canvas');
  polo.width = polo.height = 128;
  const pctx = polo.getContext('2d');
  pctx.fillStyle = '#f4f4f0';
  pctx.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 1200; i++) {
    pctx.fillStyle = `rgba(210,210,200,${0.15 + Math.random() * 0.25})`;
    pctx.fillRect(Math.random() * 128, Math.random() * 128, 1.5, 1.5);
  }
  // skin_zombie：灰绿 + 斑点 + 暗斑
  const skin = document.createElement('canvas');
  skin.width = skin.height = 128;
  const sctx = skin.getContext('2d');
  sctx.fillStyle = '#c9cfc0';
  sctx.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 400; i++) {
    sctx.fillStyle = `rgba(150,165,140,${0.1 + Math.random() * 0.2})`;
    sctx.fillRect(Math.random() * 128, Math.random() * 128, 2, 2);
  }
  for (let i = 0; i < 6; i++) {
    const cx = Math.random() * 128,
      cy = Math.random() * 128,
      r = 4 + Math.random() * 8;
    const g = sctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, 'rgba(110,120,95,0.4)');
    g.addColorStop(1, 'rgba(110,120,95,0)');
    sctx.fillStyle = g;
    sctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  }
  // school_badge：绿树 + 橙色校名
  const badge = document.createElement('canvas');
  badge.width = badge.height = 128;
  const bctx = badge.getContext('2d');
  bctx.clearRect(0, 0, 128, 128);
  bctx.fillStyle = '#3a8a3a';
  [
    [64, 48, 22],
    [52, 55, 16],
    [76, 55, 16],
  ].forEach(([x, y, r]) => {
    bctx.beginPath();
    bctx.arc(x, y, r, 0, Math.PI * 2);
    bctx.fill();
  });
  bctx.fillStyle = '#6b4a2a';
  bctx.fillRect(60, 60, 8, 22);
  bctx.fillStyle = '#d88a2a';
  bctx.font = 'bold 13px "Microsoft YaHei","PingFang SC","Heiti SC",sans-serif';
  bctx.textAlign = 'center';
  bctx.fillText('金福园小学', 64, 104);
  // shoulder_stripes：红/粉/绿斜条
  const strp = document.createElement('canvas');
  strp.width = strp.height = 128;
  const tctx = strp.getContext('2d');
  tctx.clearRect(0, 0, 128, 128);
  const cols = ['#d83232', '#e88a9a', '#3a8a3a'];
  for (let i = 0; i < 4; i++) {
    tctx.fillStyle = cols[i % 3];
    tctx.save();
    tctx.translate(64, 64);
    tctx.rotate(-0.5);
    tctx.fillRect(-12 + i * 8, -80, 5, 160);
    tctx.restore();
  }
  const make = (cv) => {
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  _humanoidTexCache = {
    polo: make(polo),
    skin: make(skin),
    badge: make(badge),
    stripes: make(strp),
  };
  return _humanoidTexCache;
}
```

- [ ] **Step 2: `MATERIAL_DEFS` 的 4 个人形 materialId 加 `map` 字段**

定位 `MATERIAL_DEFS` 里的人形段（P4 Task3 加的，锚点 `polo_white: { color: 0xf4f4f0`）。把 4 个 materialId 改为带 `map`：

```js
        // ── 校园人形丧尸（Canvas 贴图，P6 精修）──
        polo_white: { color: 0xffffff, roughness: 0.7, metalness: 0.0, map: 'polo' },
        teacher_shirt: { color: 0xf2f2ee, roughness: 0.65, metalness: 0.0 },
        blouse_white: { color: 0xf6f6f2, roughness: 0.65, metalness: 0.0 },
        skin_zombie: { color: 0xffffff, roughness: 0.85, metalness: 0.0, map: 'skin' },
        eye_glow: { color: 0x110000, roughness: 0.4, metalness: 0.0, emissive: 0xff3300, emissiveIntensity: 3 },
        hair_black: { color: 0x1a1a1a, roughness: 0.8, metalness: 0.0 },
        scarf_red: { color: 0xc8202a, roughness: 0.7, metalness: 0.0 },
        collar_red: { color: 0xc8202a, roughness: 0.65, metalness: 0.0 },
        button_white: { color: 0xf8f8f8, roughness: 0.5, metalness: 0.0 },
        shorts_red: { color: 0xb81c28, roughness: 0.7, metalness: 0.0 },
        trousers_grey: { color: 0x3a3a42, roughness: 0.7, metalness: 0.0 },
        shoes_blue: { color: 0x22335a, roughness: 0.55, metalness: 0.1 },
        shoes_white: { color: 0xf0f0ec, roughness: 0.55, metalness: 0.1 },
        leather_black: { color: 0x18181c, roughness: 0.4, metalness: 0.1 },
        tie_blue: { color: 0x1f3a6a, roughness: 0.6, metalness: 0.0 },
        frame_dark: { color: 0x222222, roughness: 0.5, metalness: 0.1 },
        briefcase_brown: { color: 0x5a3a22, roughness: 0.55, metalness: 0.0 },
        metal_gold: { color: 0xc8a040, roughness: 0.3, metalness: 0.7 },
        school_badge: { color: 0xffffff, roughness: 0.7, metalness: 0.0, map: 'badge', transparent: true },
        shoulder_stripes: { color: 0xffffff, roughness: 0.7, metalness: 0.0, map: 'stripes', transparent: true },
```

> `map` 字段是贴图 key（polo/skin/badge/stripes），getMaterial 命中时转 CanvasTexture。`color:0xffffff` 让贴图原色显示（不乘色）。badge/stripes 透明（贴片背景透明）。

- [ ] **Step 3: `getMaterial` 命中 `map` 字段时挂 CanvasTexture**

定位 `getMaterial`（约 L603-640）。在 `const def = MATERIAL_DEFS[matId] || MATERIAL_DEFS.default;` 之后、`const mat = new THREE.MeshStandardMaterial({ ...def });` 之前，加 map 处理。当前：

```js
const def = MATERIAL_DEFS[matId] || MATERIAL_DEFS.default;
const mat = new THREE.MeshStandardMaterial({ ...def });
```

替换为（`map` 字段是字符串 key，要转 CanvasTexture；不能直接展开进 constructor）：

```js
const def = MATERIAL_DEFS[matId] || MATERIAL_DEFS.default;
const cfg = Object.assign({}, def);
if (def.map) {
  const tex = (createHumanoidTextures() || {})[def.map];
  if (tex) cfg.map = tex;
  else delete cfg.map;
}
const mat = new THREE.MeshStandardMaterial(cfg);
```

> `def.map` 是字符串（'polo' 等），不能直接给 MeshStandardMaterial（要 Texture）。cfg 把 map 字符串替换为 CanvasTexture。badge/stripes 的 `transparent:true` 直接展开进 cfg（MeshStandardMaterial 支持）。

- [ ] **Step 4: CDP 验证工厂贴图生效**

CDP 加载 `model_factory.html`，切 student_m + `_applyHumanoidEdit()`，控制台：

```js
_humanoidEdit.variant = 'student_m';
_applyHumanoidEdit();
const torso = modelRoot.getObjectByName('torso_mesh');
console.log('torso has map:', !!(torso && torso.material && torso.material.map));
const badge = modelRoot.getObjectByName('ah_badge');
console.log('badge has map:', !!(badge && badge.material && badge.material.map));
```

Expected：`torso has map: true`（polo 珠地贴图）；`badge has map: true`（校徽贴图）；0 错误。

- [ ] **Step 5: Commit**

```bash
git add model_factory.html
git commit -m "feat(P6): 工厂 getMaterial 加 Canvas 贴图(polo珠地/skin暗斑/badge校徽/stripes斜条)与游戏统一"
```

---

## Task 5: 两侧截图验证（工厂 + 游戏）

**Files:**

- Test: 临时 `pw_test_p6.js`（用后清理）

**Interfaces:**

- Consumes: Task 1-4 全部

- [ ] **Step 1: 写 Playwright 验证脚本 `pw_test_p6.js`**

```js
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  // 工厂 4 类型截图
  const variants = ['student_m', 'student_f', 'teacher_m', 'teacher_f'];
  const result = { factory: {} };
  for (const v of variants) {
    const p = await browser.newPage({ viewport: { width: 900, height: 700 } });
    const errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    p.on('console', (m) => {
      if (m.type() === 'error') errs.push(m.text());
    });
    await p.goto('http://127.0.0.1:8080/model_factory.html');
    await p.waitForFunction(() => window.HumanoidAnims, null, { timeout: 15000 });
    await p.evaluate((varName) => {
      const sels = document.querySelectorAll('select');
      for (const s of sels) {
        if (s.textContent.includes('校园丧尸')) {
          s.value = [...s.options].find((o) => o.textContent === '🧟 校园丧尸').value;
          s.dispatchEvent(new Event('change'));
          break;
        }
      }
      window._humanoidEdit.variant = varName;
      window._humanoidEdit.params.curves = varName === 'teacher_f' ? 0.9 : 0.5;
      window._applyHumanoidEdit();
    }, v);
    await p.waitForTimeout(800);
    const check = await p.evaluate(() => ({
      root: !!window.modelRoot.getObjectByName('root'),
      hair: !!window.modelRoot.getObjectByName('ah_m'),
      torsoMap: !!(window.modelRoot.getObjectByName('torso_mesh') || {}).material || false,
    }));
    // 取 torso material.map 实际值
    const torsoMap = await p.evaluate(() => {
      const t =
        window.modelRoot.getObjectByName('torso_mesh') || window.modelRoot.getObjectByName('torso');
      return !!(t && t.material && t.material.map);
    });
    await p.screenshot({ path: `pw_p6_${v}.png` });
    result.factory[v] = { hair: check.hair, torsoMap, errors: errs.length };
    await p.close();
  }
  console.log(JSON.stringify(result, null, 2));
  await browser.close();
  const ok = variants.every(
    (v) => result.factory[v].hair && result.factory[v].torsoMap && result.factory[v].errors === 0
  );
  if (!ok) process.exit(1);
})();
```

- [ ] **Step 2: 运行 + 截图视觉检查**

```bash
python server.py &
node pw_test_p6.js
```

Expected：4 类型 factory 截图（`pw_p6_student_m.png` 等）+ `hair:true`（半球头发）+ `torsoMap:true`（贴图）+ 0 错误。

用 analyze_image 看截图确认：student_m 白 Polo 珠地纹理 + 校徽绿树+橙字 + 单侧斜纹 + 灰绿皮肤暗斑 + 半球短发；student_f 马尾+刘海在半球头发上；teacher_f 发髻 + hips 后侧凸（curves 0.9）前侧不凸 + 胸部前凸。

- [ ] **Step 3: 游戏侧截图（校园地图，确认两侧统一）**

CDP/Playwright 打开 `index.html` 进校园地图，截图确认游戏中 4 类型丧尸视觉与工厂一致（贴图 + 半球头发 + hips）。若游戏侧贴图已就位（P1 enemies.js），仅几何（头发半球/hips）随 humanoid_config 改动自动生效。

- [ ] **Step 4: 清理 + Commit**

```bash
rm pw_test_p6.js pw_p6_*.png pw_p6shot.js pw_p6_factory.png
git add -A
git commit -m "test(P6): 校服精修两侧验证(工厂4类型贴图+半球头发+hips+女生发型,0错误)"
```

---

## Self-Review 结论

**Spec 覆盖**：本 plan 覆盖 spec 第 3 节全部——3.1 贴图（Task 4 工厂补 Canvas + MATERIAL_DEFS map + getMaterial）/ 3.2 头发几何（Task 1 thetaLength + Task 2 short_hair_m 半球）/ 3.3 hips 几何（Task 3 扁椭球后移）/ 3.4 女生发型（Task 2 student_f/teacher_f 加 short_hair_m base）/ 3.5 验证（Task 5 两侧截图）。

**修正 spec 假设**（基于读码）：spec 3.2 说"short_hair_m 当前是 Box"——实际 humanoid_config.js 中 short_hair_m 已是 Sphere(r=0.22)（非 Box）。本 plan Task 2 只加 `thetaLength: π/2`（不改 type/size）。spec 5.2 风险"thetaLength 向后兼容"已落实（默认 π）。

**类型一致性**：`thetaLength` 字段（节点可选，弧度，默认 π）在 Task 1（createGeometry 读取 `node.thetaLength`）+ Task 2（short_hair_m 节点写入 `thetaLength: Math.PI/2`）一致。`map` 字段（materialId 的字符串 key）在 Task 4 Step 2（MATERIAL_DEFS）+ Step 3（getMaterial 读 `def.map` 转 CanvasTexture）一致。hips `scale` 字段两侧 createGeometry 已支持（无需改）。

**主要风险**：

1. **thetaLength 误改其他 Sphere case**：enemies.js 有 3 处 `case 'Sphere'`（L515/L1069/L1669），只改 buildHumanoidRig（L1069，含 `const s = node.segments || [8, 6]`）。Task 1 Step 1 已明确锚点 + 警告。
2. **半球头发覆盖度**：thetaLength=π/2 是上半球（头顶以上），可能不覆盖头侧。Task 5 截图验证，必要时微调 thetaLength（如 π/2+0.3）或 Group position y。
3. **校徽中文 headless 方块**：YaHei fallback 已设，生产浏览器正常。Task 5 analyze_image 看截图（方块可接受）。
4. **工厂 getMaterial `map` 字段与 MeshStandardMaterial 构造**：`map` 字符串不能直接展开进 constructor（要 Texture）。Task 4 Step 3 已处理（cfg 替换 map 字符串为 CanvasTexture）。
5. **hips scale 在 buildHumanoidRig**：P1 buildNode 已支持 `node.scale`（`if (node.scale) group.scale.set(...)`），无需改 createGeometry。Task 3 直接用 scale 字段。

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-01-campus-zombies-p6-polish.md`. Two execution options:

**1. Subagent-Driven (recommended)** — 每 task 派 fresh subagent + review（Claude API 限额已重置，应可用；若 429 改内联）。

**2. Inline Execution** — 本会话内联执行（P4/P5 内联已验证顺畅）。

选哪种？本 plan 覆盖 P6 校服精修全流程（spec 实施顺序最后一块）。
