# 性能优化路线图

**生成日期**: 2026-06-22 | **工具**: Three.js DevTools MCP | **测试地图**: map 01a 单人模式  
**目标**: 单位低性能电脑稳定 60 FPS | **基准**: 当前 vsync 60 FPS（高配开发机已接近瓶颈）

---

## 测试环境与方法

1. 启动游戏进入单人模式 map 01a
2. 通过 Three.js DevTools MCP 采集：`performance_snapshot` / `memory_stats` / `shadow_details` / `scene_tree` / `material_list` / `dispose_check`
3. 本机测得 canvas=2550×1275 (pixelRatio=1.25)，约 3.25M 像素/帧
4. 单位电脑估计 1080p (1920×1080, DPR=1.0) = 2.07M 像素/帧，但 GPU 更弱 → 仍需优化

---

## 当前性能快照

| 指标                     | 值                      | 问题等级 |
| ------------------------ | ----------------------- | -------- |
| 主通道 Draw Calls        | ~153                    | 🟠       |
| Shadow Casters           | 154                     | 🔴       |
| 有效 Draw Calls (含阴影) | ~307                    | 🔴       |
| 三角面                   | 1.87M                   | 🟡       |
| Shader Programs          | 47                      | 🟠       |
| 建筑 InstancedMesh       | ~130 个 (每 12-17 实例) | 🔴       |
| 僵尸 Geometry            | 336 个 (已泄漏未释放)   | 🟡       |
| VRAM                     | 50 MB                   | 🟢       |

---

## P0 — 零画质损失，必须修

### 1. 建筑 InstancedMesh 碎片化合并 ✅ v0.65.3 已修复

**文件**: `js/obstacles.js` + `models/buildings.js`

**原诊断（v0.65.2，有误）**: 归因为 `randomBuildingMaker()` 返回不同拓扑 → 推荐"限定 5-8 种固定原型"。

**真实根因（v0.65.3 经 MCP 实测确认）**: 141 个 bld-im 但仅 15 种唯一材质颜色——窗户 `#aaccff` 被建 **56 个 IM**。根因是 `obstacles.js` 外层 `for (const mt of matTemplates)` 遍历**每个子 mesh**（一栋建筑多扇窗/栏杆）而非**唯一材质**，同材质被重复建 IM；叠加 `buildings.js` 每次 create 都 `new` 新材质实例。与建筑拓扑/分组(targetHeight)无关。

**实际修复**: ①`buildings.js` 18 材质全局化（同 category 共享 material 对象）②`obstacles.js` 外层加 `seenMat` 按 material 去重（核心）③dispose 路径保护全局材质（只 dispose geometry）。

**实测结果（map01a 单人，MCP run_js）**: bld-im 141→**18**(-87%) | 窗户材质 IM 56→3 | 三角面 1.58M→1.23M(-22%) | 建筑 shadow caster 141→18 | 控制台 0 错误 | 零画质损失。

**注**: 主通道 DC 因 frustum culling 基本持平（311→308，之前 141 个小 IM 多被视野剔除），真实收益在三角面（-22%，GPU 填充率）+ 阴影 caster（-87%，阴影 pass 减负）+ IM 对象数（-87%，CPU 遍历/矩阵更新）。跨 category 共享通用材质（18→~15 IM）留作后续可选优化。

### 2. 阴影 Caster 数量暴降

阴影优化的关键是——**建筑合并后 caster 自动减少**。当前阴影 pass 画 154 个物体，合并后降至 ~25。

**补充方案 — Shadow Proxy Geometry** ✅ v0.65.4 已实现（方案调整）:

- 树冠用极简 proxy IM 投影（20面 IcosahedronGeometry 球），阴影 pass 三角大降
- ⚠️ 实测 r160 下 `customDepthMaterial`/layers/colorWrite 方案均不可行，最终用"proxy 球缩小藏入树冠内部，靠不透明树冠物理遮挡"（主通道看不见，castShadow 投影）
- spherical/oak（圆形树冠）用 proxy（藏得住）；conical（尖锥扁平棱柱）藏不住球 → 直接 crownIM.castShadow=true（448三角/棵，开销小）

**预期**: 阴影 pass 三角 1.1M → <1000 | 阴影 DC: 154 → ~25 | **零画质损失**（⚠️ v0.65.4 待多角度验证 proxy 不露出）

### 3. pixelRatio 增加防御性上限

**文件**: `js/engine.js:451`

```javascript
// 当前: Math.min(window.devicePixelRatio, 2)
// 建议: Math.min(window.devicePixelRatio, 1.5)
```

在 DPR=2.0 设备（MacBook Pro）上渲染像素直接减半。1.5 在 Retina 屏仍然清晰，肉眼难辨。

**预期**: 高 DPR 设备 +40% GPU 时间 | **极轻微画质影响**（仅高 DPR 设备）

---

## P1 — 几乎零画质损失，建议修

### 4. 桥梁 Mesh 合并

**文件**: `js/bridges.js` | **现状**: bridge Group 下 25+ 独立 Mesh，每个 1 DC

**方案**: `BufferGeometryUtils.mergeGeometries()` 合并为 2 个（路面 + 栏杆），或对重复桥段用 InstancedMesh

**预期**: -20 DC | 零画质损失

### 5. 僵尸 Geometry 清理

**现状**: Renderer 追踪 520 geometry，场景只用 184 → 336 泄漏

**排查点**:

- `obstacles.js:620-626`: `geometry.clone()` + `mergeBufferGeometries` 中间产物未 dispose
- `obstacles.js:662`: 清理临时 Group 只置 null 未调 `dispose()`
- 粒子系统、爆炸效果、编辑器操作等可能泄漏

**预期**: VRAM -5 MB，GC 压力减小

### 6. 草冠三角面精简

**现状**: 中草冠 IM (102 实例) 总三角 842K → 单实例 ~8200 三角（过度精细）

**方案**: 每片草叶从 8 段降到 4 段；远景自动换低模

**预期**: 三角面 1.87M → ~0.8M | 远观看不出区别

---

## P2 — 低优先级，锦上添花

### 7. Shader Program 精简

37 个材质多数仅颜色不同 → 合并同质材质 + 用 instanceColor 区分 → program 47 → ~15

### 8. 非金属表面换 Lambert

将建筑墙壁、桥面、路面等非金属表面从 `MeshStandardMaterial` (PBR) 换为 `MeshLambertMaterial`，GPU ALU 省 ~30%。坦克、水面、金属保留 PBR。

### 9. 水面渲染优化

水面 (opacity 0.55) 和河流 (opacity 0.6) 触发透明 render pass。可设置 `renderOrder = -1` 减少排序开销。

---

## 实施顺序

```
第1步: 建筑 IM 合并 (P0-1) ────── 最大收益，同时解决阴影 caster 问题
第2步: pixelRatio cap 1.5 (P0-3) ─ 一行改动，立竿见影
第3步: 桥梁合并 (P1-4) ───────── 顺手修
第4步: 树冠 shadow proxy (P0-2) ── 补齐阴影优化
第5步: 僵尸 geometry (P1-5) ───── 清理泄漏
第6步: 草冠精简 (P1-6) ───────── 可选
```

**第 1 步完成后即可在单位电脑验证**：建筑 DC 降 87%，阴影 DC 降 84%，大概率已够 60 FPS。

---

## 改动文件清单

| 文件                                 | 改动内容                                    | 行数估计 |
| ------------------------------------ | ------------------------------------------- | -------- |
| `js/obstacles.js`                    | 建筑原型标准化 + IM 合并逻辑                | ~50 行   |
| `js/bridges.js` 或 `js/obstacles.js` | 桥梁几何合并                                | ~20 行   |
| `js/engine.js`                       | pixelRatio cap                              | 1 行     |
| 树冠模型文件                         | shadow proxy geometry / customDepthMaterial | ~15 行   |
| 各模块 dispose 路径                  | geometry.dispose()                          | ~10 行   |

总计约 **100 行改动**，无新文件，无架构变更。
