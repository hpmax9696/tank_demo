# 环境对象（建筑 / 树木）开发规范

> 新增建筑或树木种类时**必须遵循**。源自 v0.65.3（建筑 IM 合并 141→18）与 v0.65.4→v0.65.5（树冠阴影 proxy）的实测经验。
> 违反规范会重蹈覆辙：IM 碎片化（draw call 爆炸）、材质泄漏（黑块/丢材质）、proxy 露出或阴影失真。

**生效版本**: v0.65.5 | **涉及文件**: `models/buildings.js` / `models/trees.js` / `js/obstacles.js`

---

## 一、三条铁律（建筑 + 树木通用）

### 铁律 1：所有重复对象必须 InstancedMesh

散建 `Mesh` = 每个对象 1 draw call。上百棵树/上百栋建筑就是上百 DC，性能灾难。

- 建筑 → `js/obstacles.js` 按**材质**分组合并为 bld-im
- 树木 → `js/obstacles.js` 每类型一个 trunk IM + crown IM（+ 可选 proxy IM）

### 铁律 2：几何与材质在模型模块定义、全局共享，create 函数绝不内部 `new`

| 类型 | 定义位置                                                                       | 共享方式                                            |
| ---- | ------------------------------------------------------------------------------ | --------------------------------------------------- |
| 建筑 | `models/buildings.js` 模块级 `const`（`bunWallM` / `vilStoneM` / `aptWinM` …） | create 函数内只引用 `const wallM = bunWallM`        |
| 树木 | `models/trees.js` 模块级 `const`（`crownMat1/2/3`）+ 注册 `window.TreeModels`  | trunk/crown IM 直接用 `tm.crownGeo` / `tm.crownMat` |

> **反例（v0.65.3 根因）**: `createXXX()` 内部 `new THREE.MeshStandardMaterial(...)` → 每栋建筑都新材质 → 同材质无法按引用合并 → 141 个 bld-im 碎片（窗户材质被建 56 次）。

### 铁律 3：全局共享材质永不 dispose，geometry 才 dispose

清理旧对象时**只 `geometry.dispose()`，不 `material.dispose()`**。全局材质跨地图重建长期存活，dispose 后下次重建会黑块/丢材质（v0.65.3 实测）。

| 对象              | geometry.dispose | material.dispose | 现状                                                                |
| ----------------- | :--------------: | :--------------: | ------------------------------------------------------------------- |
| 建筑 bld-im       |        ✅        |        ❌        | 已正确（v0.65.3）                                                   |
| 树 trunk/crown IM |        ✅        | ⚠️ 当前 dispose  | 建议改为不 dispose（同建筑），目前因 Three.js 自动重编译未显黑块    |
| 树 proxy IM       |        ✅        |  共享 proxyMat   | proxyMat 被 spherical/oak 共享，双重 dispose 无害（重建时整体替换） |

---

## 二、新增建筑 checklist（`models/buildings.js`）

1. **材质全局化**：新建筑的材质提升为模块级 `const`（如 `const myWallM = new THREE.MeshStandardMaterial(...)`），create 函数内只引用
2. **复用通用材质**：窗户/门/屋顶等尽量复用已有全局材质（同色共用一个），最大化 IM 合并
3. **category 分类**：给建筑分 category（`house`/`villa`/`apt`/...），同 category 共享材质组
4. **castShadow/receiveShadow**：建筑 IM `castShadow=true`（v0.65.3 后 IM 已合并，阴影 caster 少，直接投影即可）
5. **拓扑自由**：v0.65.3 已证明建筑拓扑（随机参数化）不影响合并——只要材质全局化，不同参数的同材质建筑自动进同一 IM，**无需限定固定原型**

**验证（进地图后 MCP run_js）**:

```js
let n = 0;
scene.traverse((o) => {
  if (o.isInstancedMesh && o.name === 'bld-im') n++;
});
return n; // 期望: ≈ buildings.js 全局材质数，而非建筑总数
```

---

## 三、新增树木 checklist（`models/trees.js` + `js/obstacles.js`）

### 步骤 1：树冠几何 + 注册 TreeModels

```js
function createMyTreeCrownGeo() {
  /* 返回 mergeBufferGeometries 后的 BufferGeometry */
}
const myTreeCrownGeo = createMyTreeCrownGeo();
window.TreeModels.mytree = {
  trunkGeo,
  crownGeo: myTreeCrownGeo,
  trunkMat,
  crownMat,
  trunkOffsetY,
  crownOffsetY,
  baseHeight,
  targetHeightMinM,
  targetHeightMaxM,
  radius,
  color,
  weight,
};
```

### 步骤 2：按树冠三角面数选阴影策略（决策树）

```
树冠三角面数？
├─ > ~1000（高面数：多椭球簇/蓬松球，如 spherical ~8000、oak ~2800）
│     → 用透明 proxy（步骤 3），crownIM.castShadow = false
├─ < ~500（低面数：简单锥/柱，如 conical 448）
│     → 直接 crownIM.castShadow = true（质量最好，开销本就小）
└─ 500~1000 → 视情况，倾向直接投影
```

**原理**：阴影 pass 会渲染所有 castShadow 对象的全部三角。高面数树冠直接投影拖慢阴影 pass；低面数直接投影质量最佳且便宜。

### 步骤 3：透明 proxy（仅高面数树冠需要）

在 `js/obstacles.js` 仿照 spherical/oak 分支：

```js
const crownIM = new THREE.InstancedMesh(tm.crownGeo, tm.crownMat, pts.length);
crownIM.castShadow = false; // 树冠本身不投影（面数高），交给 proxy
crownIM.receiveShadow = true;
const crownProxyIM = makeCrownProxy(pts.length, radius, flattenY);
// 循环内：crownProxyIM.setMatrixAt(i, dummy.matrix);  // 与 crownIM 同矩阵
// 收尾：crownProxyIM.instanceMatrix.needsUpdate = true;
//       targetScene.add(trunkIM, crownIM, crownProxyIM);
//       window._treeIMs.push(trunkIM, crownIM, crownProxyIM);  // 进清理路径
```

**proxy 参数取值**：

- `radius`：覆盖树冠主体（proxy 透明看不见，**不必藏入**，取树冠外接球半径即可）
- `flattenY`：扁平树冠要 y 压扁匹配形态（阴影形状贴合），正圆树冠用 1
- **形状匹配**：球形/簇状树冠 → 球 proxy；锥形树冠**不能用球 proxy**（投圆形失真），要么直接投影（步骤 2 的低面数分支），要么用锥形 `ConeGeometry` proxy

### 步骤 4：proxy 透明方案（`makeCrownProxy` 已内置，勿改）

```js
const proxyMat = new THREE.MeshBasicMaterial({
  transparent: true,
  opacity: 0,
  depthWrite: false, // 主通道透明看不见
});
im.castShadow = true; // 阴影 pass 照常投影
```

**原理**：Three.js 两遍渲染——主 pass 看材质（opacity=0 不可见），阴影 pass 用独立 `DepthMaterial`（**只看几何，不看材质透明度**）→ 透明对象仍投阴影。两层互不干扰。

> **⚠️ 踩坑（v0.65.4）**: 不要用 `layers`（阴影相机也看不见 layer1 → 不投阴影）或 `colorWrite=false`（连带跳过阴影 pass）。**唯一可行的是 `transparent + opacity=0`**，因为它只影响主 pass。

### 步骤 5：obstacleData 登记 + 生命周期同步（关键）

proxy IM **必须**登记到 obstacleData（`imProxy` 字段），否则树被摧毁时 `disposeTreeInstance` 找不到 proxy 去隐藏 → **阴影残留在地面**（v0.65.5 踩坑）。

```js
obstacleData.push({
  x,
  z,
  radius,
  height,
  color,
  type: 'mytree',
  imTrunk,
  imCrown,
  imProxy: crownProxyIM,
  imIndex,
});
```

`disposeTreeInstance`（`js/obstacles.js`）会遍历 imTrunk/imCrown/**imProxy**，把对应实例 scale→0 移到地下（隐藏 + 阴影消失）。

> **通用原则**：新增任何**附属 IM**（proxy、装饰、挂件…）都要 ①登记到 obstacleData ②在 `disposeTreeInstance` 加同步隐藏。否则主对象消失后附属物残留。

**验证（MCP）**:

- 截图看地面：树荫完整覆盖树冠正下方（非细树干影）+ 树冠无透明球轮廓 → 透明方案生效
- 若用非透明 proxy（旧方案），run_js 把 proxy 染红 + 截图，确认无红色露出

---

## 四、反面清单（不要做的事）

| #   | 反例                                                   | 后果                                 |
| --- | ------------------------------------------------------ | ------------------------------------ |
| 1   | create 函数内部 `new` 材质                             | IM 碎片化（v0.65.3 的 141 bld-im）   |
| 2   | proxy 用 `layers` 或 `colorWrite=false` 藏             | 不投阴影（v0.65.4 踩坑）             |
| 3   | 锥形树冠用球 proxy                                     | 阴影变圆形，形状失真                 |
| 4   | dispose 全局共享材质                                   | 下次重建黑块/丢材质                  |
| 5   | 高面数树冠直接 `castShadow=true`                       | 阴影 pass 卡顿                       |
| 6   | 散建 Mesh 不用 IM                                      | draw call 爆炸                       |
| 7   | 扁平树冠的 proxy 不 y 压扁                             | 阴影正圆，不贴树冠扁平形态           |
| 8   | proxy 缩太小"藏入"树冠（非透明方案）                   | 阴影只剩树干大小（v0.65.4 初版）     |
| 9   | proxy 未登记 obstacleData / 未纳入 disposeTreeInstance | 树摧毁后阴影残留地面（v0.65.5 踩坑） |

---

## 五、历史背景

- **v0.65.3**：建筑 IM 141→18。根因 = buildings.js create 内 new 材质 + obstacles.js 按子 mesh 而非材质去重。修复 = 材质全局化 + `seenMat` 去重 + dispose 安全
- **v0.65.4**：树冠阴影恢复。初版用 `layers`/`colorWrite` 失败 → 退而用"物理遮挡藏小 proxy"（proxy 必须缩到核心球簇 r≈0.13，阴影只剩树冠一半，像树干影）
- **v0.65.5**：发现 `transparent+opacity=0` 透明方案可行 → proxy 放大覆盖树冠（r=0.22），投完整阴影。**推翻 v0.65.4 "必须物理遮挡"的结论**——诊断不彻底导致的次优解
- **v0.65.5（续）**：proxy 未登记 obstacleData → 树被摧毁后阴影残留地面。修复 = obstacleData 加 `imProxy` 字段 + `disposeTreeInstance` 同步隐藏 proxy 实例。**教训：任何附属 IM 都必须纳入主对象的生命周期管理**
- **v0.65.5（续2 — 尺度标定）**：`METERS_PER_UNIT` 从 `8/1.7≈4.706` 改为 `1.3`（标定：真实 T-34/85 高 2.6m ÷ 坦克渲染 1.99 单位 = 1.306，取 1.3）。旧系数偏大 3.6 倍，导致障碍物"米"配置被压缩（3m 树渲染 0.64 单位 = 坦克 32%，像草）。修复策略：**保持当前视觉不变**（新 targetHeightM = 旧渲染单位 × 1.3），仅把"像草"的下限调高（树/平房 min → 坦克 75%+）。各障碍物新 min/max：conical 2~4.2 / spherical 2~3.9 / oak 2.5~5 / bungalow 2.5~3.3 / villa 3~5.5 / apartment 4.2~9.7 / windmill 2.8~5.5。裸单位参数（地图/AI/fog/阴影）数值不变，米含义基于 1 单位=1.3m 自动正确。地图编辑器 UI 显示米（×1.3）。
