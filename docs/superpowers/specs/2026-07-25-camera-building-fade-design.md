# 相机视线遮挡 — 建筑整体半透明

日期：2026-07-25 | 方案：B（建筑整体半透明）

## 问题现象

坦克贴近大建筑（教学楼等）旋转视角时，相机穿入建筑内部，出现：

1. 墙体**消失**（用户感知"变透明"）
2. 附件（外廊/门窗/空调外机）独立 mesh 仍渲染 → **浮在空中**
3. 当前前移避障存在"边缘角度范围"未切换遮挡视角

## 根因

1. **材质 FrontSide**：`campusWallM`/`campusRoofM`/`_twM` 全局共享材质均默认 FrontSide（只渲染外表面）
2. **相机穿入建筑内**：`CAMERA_BEHIND=14.625` + `ABOVE=10`，相机距坦克很远，坦克贴大 footprint 建筑（几十米）时，相机随 cameraYaw 旋转落入建筑内部 → 从内看 FrontSide 墙 → **背面剔除**（墙不渲染）→ 附件失去墙背景 → 浮空
3. **前移避障振荡**（engine.js:4502-4520）：原位射线命中→前移→新射线 `distance < _rl-1` 卡边界不命中→回原位→再命中→**几何反馈循环**。这就是"边缘角度"现象的根源
4. **无透明化机制**：v0.24.9 的"遮挡透明材质池"早已移除（engine.js:4527 仅剩注释），当前对遮挡无任何处理
5. **避障射线非递归**：`intersectObjects(_cb, false)`（4514）不命中厕所 Group（无 geometry）

## 设计

### 决策：移除前移避障，纯半透明

前移避障与半透明同源（都基于 cam→tank 射线），保留会**抢触发导致闪烁**（前移振荡过程中建筑在挡/不挡间反复）。移除前移 → 相机不动 → 无反馈循环 → 零闪烁。

### 触发检测

- `placeCamera` 末尾，降频 ~0.15s（累加 dt 触发，非每帧）
- 射线 `camPos → tankPos`，`intersectObjects(_campusBuildingGroups, true)` **递归**
- 命中集 = 挡视线的建筑

### 半透明对象

- 命中 mesh → 沿 parent 链找 `userData._isCampusBuilding` 的建筑 Group
- **整组**（墙+外廊+门窗+空调所有 mesh）半透明

### 材质处理（解决全局共享，关键）

直接改 `campusWallM.opacity` 会让全图同材质建筑一起透明。解决：

- **首次 fade**：遍历 Group，按 `material` 引用去重 clone（每栋建筑通常 5-10 种材质）
- clone 副本设 `transparent:true` + `side:THREE.DoubleSide`（DoubleSide 仅 fade 副本，解决相机在内时背面剔除）
- 缓存：`group.userData._fadeMats`（去重后的 clone 数组）+ per-mesh `userData._origMat`/`_fadeMat`
- 切换：`mesh.material = _fadeMat` 或 `_origMat`（后续切换零 clone）
- 设 opacity：遍历 `_fadeMats` 设 0.35（fade）或 1（恢复）

### 状态机

每检测周期：

- 算命中集（射线命中的建筑 Group）
- 命中且当前未 fade → `setBuildingFade(group, 0.35)`
- 之前 fade 现未命中 → `setBuildingFade(group, 1)`（切回 `_origMat`）
- 相机位置不变 → 命中集稳定 → **无闪烁**

### 小地图（保留）

- `window._hullOccluded = (命中集非空)`
- 射线命中即触发 sniper-minimap（车体线框+车首三角），展示车体姿势

### 移除前移避障

删除 engine.js:4516-4520 的前移逻辑：

```js
window._hullOccluded = true;
camera.position.copy(_tankPos).addScaledVector(_rd, -3);
camera.position.y = _tankPos.y + 1.2;
```

保留射线检测本身（改 recursive=true，供半透明+小地图用）。

### 建筑标记与收集

- `createFootprintBuildings`（obstacles.js:440）：Group 创建后 `group.userData._isCampusBuilding=true` + `window._campusBuildingGroups.push(group)`
- `createToiletZones`（obstacles.js:1761）：`inst.userData._isCampusBuilding=true` + push
- `window._campusBuildingGroups = []` 初始化（obstacles.js:443 `_campusBuildings=[]` 旁）
- 返回菜单/换图时清空

## 权衡

| 项                              | 取舍                                                             |
| ------------------------------- | ---------------------------------------------------------------- |
| opacity 0.35                    | 看穿找坦克，但保留墙轮廓（不至于完全消失）                       |
| DoubleSide（仅 fade 副本）      | 相机在内时墙背面也半透明渲染；非挡视线建筑仍 FrontSide，性能不损 |
| 首次 clone 材质                 | 每栋几种材质，极轻；后续切换零 clone                             |
| `depthWrite=false`（fade 副本） | 避免透明排序穿模                                                 |
| 远处大建筑全挡                  | 半透明面积大，但 0.35 保留轮廓可接受                             |

## 验证

1. **Playwright 端到端**：加载校园地图，构造 cam→tank 射线命中教学楼/厕所 → dump 命中建筑 `_fadeMats` opacity=0.35 + side=DoubleSide；未命中建筑 material===\_origMat
2. **振荡测试**：连续 N 帧同一姿态，命中集稳定无跳变（证明无闪烁）
3. **CDP 0 错误**
4. **实地**：坦克绕教学楼/厕所旋转视角，相机不入内，挡视线时整栋半透明（墙+附件一起）+ 小地图显示车体姿势

## 改动文件

- `js/engine.js`：placeCamera 移除前移逻辑 + 加半透明检测/状态机（降频）；`_hullOccluded` 改为命中集非空
- `js/obstacles.js`：`_campusBuildingGroups` 初始化 + 建筑标记（createFootprintBuildings/createToiletZones）+ `setBuildingFade` 函数
- `js/engine.js:2015`：`_hullOccluded` 小地图触发（语义不变，无需改）

## 非目标（YAGNI）

- 不做相机抬高俯视（前移避障的替代方案）——半透明已覆盖
- 不改 \_campusBuildings 结构（炮弹检测独立，不受影响）
- 不对树/随机建筑做半透明（仅校园 \_campusBuildingGroups）
