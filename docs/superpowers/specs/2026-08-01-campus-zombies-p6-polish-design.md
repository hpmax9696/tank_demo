# 校园丧尸 · 校服精修设计 (P6)

- **日期**：2026-08-01
- **状态**：已确认
- **关联**：`models/enemies.js`（createHumanoidMaterials/getHumanoidMat/buildHumanoidRig）、`models/humanoid_config.js`（ADDON_LIBRARY/BODY_PARAMS）、`model_factory.html`（getMaterial/createGeometry）、`js/humanoid_factory.js`
- **范围档位**：辨认度精修（工厂 + 游戏两侧），不引入 PBR 法线/写实管线

---

## 1. 背景与动机

P1-P5 完成了校园丧尸的"可跑→可刷→工厂设计→工具页放置"全管线，但视觉是**纯色塑料感**：

- 工厂侧（P4 Task3）`MATERIAL_DEFS` 用纯色近似（polo_white/skin_zombie/school_badge/shoulder_stripes 无贴图），工厂预览看不到校徽/斜纹/珠地/暗斑。
- 游戏侧（P1）`enemies.js:createHumanoidMaterials` 已有 4 张 Canvas 贴图，但工厂未复刻 → 两侧视觉不一致。
- 几何问题：①`short_hair_m` 是 Box（方块头发），非半球；②`hips` 是居中球，curves 放大后**前后两侧同时膨大**（臀部应在后侧+两侧胯，前侧不该凸）；③女生发型 addon（马尾/刘海/发髻）挂在光头上，缺半球头发 base。

## 2. 目标与非目标

### 目标

1. 工厂 `getMaterial` 加 Canvas 贴图（复刻游戏的 polo 珠地/skin 暗斑/badge 绿树+校名/stripes 斜条），两侧视觉统一。
2. 头发几何修复：Sphere 加 `thetaLength` 支持；`short_hair_m` Box → 真半球。
3. hips 几何修复：居中球 → 后侧扁椭球（X 胯宽/Y 臀扁/Z 前后浅 + 后移），curves 放大保持扁椭比例，前侧不凸。
4. 女生发型：学生女/教师女加半球头发 base，现有马尾/刘海/发髻 addon 挂在半球上（非光头）。

### 非目标

- 不做 PBR 法线贴图（织物经纬/皮肤毛孔/发丝）、红领巾褶皱几何、复杂造型（超 spec Y 档，项目无 PBR 管线）。
- 不改游戏 AI/碰撞/动画（仅外观材质+几何）。

## 3. 详细设计

### 3.1 贴图（工厂补 + 两侧统一）

**工厂 `model_factory.html:getMaterial`** 加 Canvas 贴图生成（复刻 `enemies.js:createHumanoidMaterials` L933-1017 的 4 张 Canvas）：

- `polo_white`：白底 `#f4f4f0` + 1200 个珠地网眼点（`rgba(210,210,200,0.15~0.4)`，1.5px）。
- `skin_zombie`：灰绿底 `#c9cfc0` + 400 斑点 + 6 个径向暗斑（轻度丧尸化）。
- `school_badge`：128² 透明底 + 绿树（3 重叠圆 `#3a8a3a` + 树干 `#6b4a2a`）+ 橙色"金福园小学"（`#d88a2a`，YaHei/PingFang fallback）。
- `shoulder_stripes`：128² 透明底 + 红/粉/绿（`#d83232/#e88a9a/#3a8a3a`）4 条 -0.5rad 斜条。

实现：工厂 `MATERIAL_DEFS` 的这 4 个 materialId 从纯色 `{color}` → `{color:0xffffff, map:'polo'|'skin'|'badge'|'stripes', roughness}`；`getMaterial` 加人形贴图生成缓存（仿 enemies.js 的 `_humanoidTexCache`），命中时 `mat.map = tex[key]`。两侧共用相同 Canvas 逻辑（参数一致），保证视觉统一。

### 3.2 头发几何（Sphere thetaLength + 半球）

**`createGeometry` Sphere case 加 thetaLength**（两侧同步）：

- `models/enemies.js:buildHumanoidRig.createGeometry` 的 `case 'Sphere'`：`new THREE.SphereGeometry(r, seg[0]||8, seg[1]||6, 0, Math.PI*2, 0, node.thetaLength != null ? node.thetaLength : Math.PI)`（默认 thetaLength=π 全球，向后兼容）。
- `model_factory.html:createGeometry` 的 `case 'Sphere'`：同上加 thetaLength 参数。

**`short_hair_m` Box → 半球 Sphere**（`humanoid_config.js` ADDON_LIBRARY）：

- 当前：`{name:'ah_m', type:'Box', size:[0.26,0.16,0.26], position:[0,0.16,-0.02], materialId:'hair_black'}`
- 改为：`{name:'ah_m', type:'Sphere', size:[0.18], position:[0,0.14,-0.01], thetaLength: Math.PI/2, segments:[8,6], materialId:'hair_black'}`（真半球扣头顶，r=0.18 覆盖头 r=0.2 上半）。

### 3.3 hips 几何（居中球 → 后侧扁椭球）

**`humanoid_config.js` ADDON_LIBRARY 的 `hips` 节点**：

- 当前：`ah_hips Sphere size:[0.3] position:[0,0,-0.02]`（居中球，z=0）。
- 改为：`ah_hips Sphere size:[0.3] position:[0,-0.02,-0.1] scale:[1,0.85,0.55] segments:[8,6]`。
  - `position z:-0.1`：后移（臀部在后侧）。
  - `scale [1,0.85,0.55]`：X 胯宽 / Y 臀扁 / Z 前后浅（椭球，不向前凸）。
- `buildHumanoidRig.createGeometry` 需支持节点 `scale` 字段（Sphere/Box/Cylinder 等，`group.scale.set(...node.scale)`）——确认现有支持（P1 buildHumanoidRig L1045 已有 `if (node.scale) group.scale.set(...node.scale)`）。

**效果**：curves 放大（`scaleGroup(clone, 0.6+curves*0.8)`）时，hips 椭球 uniform 放大但比例保持（X>Y>Z），后侧凸、前侧基本不凸。

### 3.4 女生发型（半球 base + addon）

**`humanoid_config.js` HUMANOID_VARIANTS**：

- `student_f.addons`：在 `'ponytail_f','fringe_f'` 前加 `'short_hair_m'`（半球头发 base）。
- `teacher_f.addons`：在 `'bun_f'` 前加 `'short_hair_m'`（半球头发 base）。
- 当前女生 addons 只有马尾/刘海/发髻（挂光头），加 short_hair_m 半球 base 后，发型在头发上（非光头）。

注：`short_hair_m` 男女共用（男生短发 + 女生 base），女生额外挂 ponytail_f/fringe_f（学生）/bun_f（教师）。

### 3.5 验证

- 工厂：选 4 类型（student_m/f + teacher_m/f）截图，确认校徽/斜纹/暗斑/珠地可辨识 + 头发半球 + 女生马尾/发髻在头发上 + 教师女 hips 后侧凸（curves 高时前侧不凸）。
- 游戏：进校园地图截图，确认两侧视觉一致。
- 0 控制台错误（两侧）。

## 4. 任务分解（供 writing-plans）

1. **Sphere thetaLength 支持**：enemies.js buildHumanoidRig + 工厂 createGeometry 的 Sphere case 加 thetaLength 参数。
2. **头发几何 + 女生发型 base**：humanoid_config short_hair_m Box→半球；student_f/teacher_f addons 加 short_hair_m。
3. **hips 几何**：humanoid_config hips 节点加 scale+后移。
4. **工厂 Canvas 贴图**：getMaterial 加 4 贴图生成 + MATERIAL_DEFS 改 map。
5. **游戏贴图同步**：enemies.js createHumanoidMaterials 与工厂参数对齐（如校名字体/条纹颜色两侧一致）——P1 已有，确认+微调。
6. **验证**：工厂+游戏两侧截图对比 + 0 错误。

## 5. 风险与对策

1. **校徽中文 headless 方块**：工厂/游戏 headless chromium 无中文字体，"金福园小学"渲染方块。生产（用户浏览器）有 YaHei/PingFang 正常。fallback 链已设（`"Microsoft YaHei","PingFang SC","Heiti SC",sans-serif`）。验证时用 analyze_image 看截图（方块可接受，生产正常）。
2. **thetaLength 向后兼容**：默认 π（全球），现有 Sphere 节点（头/眼/球/纽扣）无 thetaLength 字段 → 走默认全球，零回归。
3. **hips scale 在 buildHumanoidRig 支持**：P1 buildHumanoidRig L1045 已支持 `node.scale`，无需改 createGeometry（scale 是 group 级，不是几何级）。确认即可。
4. **女生 short_hair_m base 与马尾/发髻 z-fighting**：半球 base r=0.18 + 马尾/发髻 addon 位置已设计（ponytail_f position z=-0.16 后侧），不冲突。
5. **工厂 createGeometry 与 buildHumanoidRig createGeometry 两份**：thetaLength 支持要两侧同步（工厂 buildFromConfig + 游戏 buildHumanoidRig）。
