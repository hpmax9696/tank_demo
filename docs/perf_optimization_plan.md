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

### 1. 建筑 InstancedMesh 碎片化合并

**文件**: `js/obstacles.js:598-664`

**现状**: 建筑按 `targetHeightMinM|targetHeightMaxM` 分组 → `ModelRegistry.randomBuildingMaker()` 每次可能返回不同拓扑（不同屋顶/墙壁组合）→ 同一高度范围产生多个 IM → 130+ 个仅含 12-17 实例的 IM，完全违背 instancing 初衷。

**方案**:

1. 限定建筑原型为 5-8 种固定造型（屋顶×墙壁 确定性组合）
2. 每种原型 2 个 IM（墙壁 + 屋顶），共 ~15 个 IM
3. 视觉多样性由 `instanceColor`（每栋不同颜色）+ scale 微调 + rotation 提供

**预期**: 建筑 DC: 130 → 15 | 阴影 caster: 130 → 15 | **零画质损失**

### 2. 阴影 Caster 数量暴降

阴影优化的关键是——**建筑合并后 caster 自动减少**。当前阴影 pass 画 154 个物体，合并后降至 ~25。

**补充方案 — Shadow Proxy Geometry**:

- 树冠（当前阴影 pass 画 1.1M 三角）→ 用 3-4 个交叉平面替代，阴影 pass 三角 <1000
- 通过 `Object3D.customDepthMaterial` 实现，主通道渲染不受影响
- 512×512 阴影贴图根本分辨不出树冠是 8000 三角还是 12 三角投射的

**预期**: 阴影 pass 三角 1.1M → <1000 | 阴影 DC: 154 → ~25 | **零画质损失**

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
