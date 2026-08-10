# 校园丧尸部件「工厂选中调参 + 保存」待办

> **状态**：待 brainstorm（下次新对话启动）
> **来源**：v0.79.5 校园丧尸精修会话末尾用户提出
> **关联**：`docs/superpowers/specs/2026-08-09-humanoid-three-skeletons-design.md`（三副骨架）

## 背景

v0.79.5 精修女教师 S 曲线（沙漏躯干/椭圆 pelvis/胸臀楔形）时，频繁靠我改 `humanoid_config.js` 数值 → Playwright/用户视觉确认 → 再改的循环。用户希望像**六足战车**那样：在模型工厂**点选丧尸某个部件 → 面板调参数（size/position 等）实时预览 → 满意后保存写回源文件**，自己精细调整，而不必每次让我改代码。

当前校园丧尸部件**不支持**单独选中调参（工厂切到 humanoid 后，部件点选高亮能命中 mesh，但没有「参数面板 + 保存」回路；只能整体 buildHumanoid 重建）。

## 目标

校园丧尸四变体（student_m/f、teacher_m/f）在工厂：

1. 点击选中部件（骨架节点：头/颈/躯干/四肢/骨盆；addon：裤/裙/鞋/bust/hips/领带 等）
2. 面板显示该部件的可调参数（size / position / rotation / materialId 等）
3. 拖动滑块/输入实时预览（改 mesh 或 rebuild）
4. 保存 → 写回 `humanoid_config.js` 源文件（经 server.py solidify）

## 参考机制（六足战车）

下次先读 model_factory.html 里六足战车的「选中 → 参数面板 → 保存」实现，复用/镜像到校园丧尸：

- 选中：工厂已有 `setupRaycaster`（model_factory.html）+ `selectedParts` + `focusPanel`，校园丧尸 mesh 已能选中（v0.79.5 调试时验证过点膝盖命中 ah_sh）
- 参数面板：六足战车选中后展示的 GUI（读其实现）
- 保存：`server.py` `/api/solidify` 已有 humanoid variant 固化（v0.79.0 `_find_variant_bounds`），可能需扩展到 addon/骨架节点级

## 待 brainstorm（下次对话先确认）

1. **选中范围**：骨架节点（HUMANOID_BASE/三副 BASE 的 size/position）+ addon（ADDON_LIBRARY）都要可调？还是先 addon（衣物/发型）后骨架？
2. **参数粒度**：每部件哪些参数进面板（size 三轴？position 三轴？rotation？materialId 下拉？）
3. **保存目标**：
   - addon → ADDON_LIBRARY[key].node.size/position
   - 骨架节点 → STUDENT_BASE/TEACHER_M_BASE/TEACHER_F_BASE（setBone 之外的直接 size？或新增可调层）
   - bodyRange（height/build/hunch/curves 范围）
4. **与 buildHumanoid 关系**：调参后 rebuild（走 deriveNode/setBone）还是直接改 mesh 绕过 config？保存时如何反映 setBone 的同步逻辑（pivot/子pos）
5. **三副骨架**：选中部件需知道属于哪副骨架（student/teacher_m/teacher_f），保存到对应 BASE

## 关键文件

- `model_factory.html`：选中 GUI + 参数面板 + 保存触发（仿六足战车）
- `models/humanoid_config.js`：配置树（三副 BASE + ADDON_LIBRARY + buildHumanoid + setBone）
- `server.py`：`/api/solidify` humanoid 分支（可能扩展 addon/骨架节点级写入）

## 起点（下次新对话）

1. 读本 plan + v0.79.5 spec
2. 读 model_factory.html 六足战车「选中调参+保存」实现（Grep hexapod 选中/GUI/solidify）
3. brainstorm 上述 5 点 → spec → plan → 执行
