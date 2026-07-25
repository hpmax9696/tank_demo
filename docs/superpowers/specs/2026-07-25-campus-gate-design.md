# 校门系统 — 铁栅门+警戒线（前后两门，宽度可调）

日期：2026-07-25 | 拟版本：v0.78.4

## 目标

校园围墙 boundary（7 点不规则多边形）开两个口，放置前后校门：

- 铁栅门（双扇对开紧闭）+ 门柱 + 门头横梁（贴校名"金福园小学"）
- 黄黑警戒带（门柱间横拉）+ "禁止出入"立牌
- 坦克阻挡 + 炮弹不可摧毁（永久紧闭，炮弹只留焦痕）
- 门宽每门独立可调（现实前后门宽度不同）

## 设计决策（用户确认）

| 决策         | 选择                                             |
| ------------ | ------------------------------------------------ |
| 位置确定方式 | 工具页打点（snap 到最近 boundary 边）            |
| 门体样式     | 铁栅门（双扇对开紧闭 + 门柱 + 门头横梁）         |
| 警戒线构成   | 黄黑斜纹警戒带（绕门柱间）+ "禁止出入"立牌       |
| 碰撞/摧毁    | 坦克阻挡 + 炮弹不可摧毁（type='wall'，永久紧闭） |
| 门头校名     | 前后门都贴"金福园小学"（CanvasTexture）          |
| 门宽         | 工具页滑块可调（4-15m，默认 8m，每门独立）       |

## 数据格式

`maps/campus.map.json` → `obstacles.gates`:

```json
"gates": [
  { "cx": 12.3, "cz": -45.6, "width": 10.0, "ry": 1.2, "name": "金福园小学" },
  { "cx": -65.0, "cz": 8.0, "width": 6.5, "ry": 0.3, "name": "金福园小学" }
]
```

- `cx/cz`：门中心世界坐标（boundary 边上 snap 点）
- `width`：门宽（m，每门独立，现实前后门不同）
- `ry`：门朝向（boundary 边法向，门面朝外）
- `name`：校名（门头横梁 CanvasTexture 文字）

消费者：`js/obstacles.js`（createGates 渲染 + 碰撞）+ `tools/gate_marker.html`（打点/调宽/保存）+ `server.py`（写回）

## 工具页 `tools/gate_marker.html`

照搬 `planter_marker.html` / `tree_marker.html` 框架（canvas 底图 + w2c/c2w + 点选/拖拽/删除/保存）：

- **底图**：校园 boundary（红色多边形）+ 现有建筑轮廓 + 已保存的 gates
- **点击放置**：点击地图 → `c2w` 转世界坐标 → **snap 到最近 boundary 边**（投影点到每条边，取最近；门中心=投影点，ry=边法向朝外）
- **宽度调节**：选中门后右侧滑块（range 4-15m，step 0.5，默认 8m）实时预览门体宽度（canvas 上画门矩形 + 门柱 + 警戒线示意）
- **拖拽/Delete**：移动/删除门
- **保存**：POST `/api/solidify` {type:'campus', gates} → 写回 campus.map.json

## 模型 `createGates(targetScene)`（obstacles.js 新函数）

每个 gate（gates 数组）生成一个 `gateGroup`（name='campus-gate'），含：

| 部件           | 几何                                        | 尺寸                            | 材质                                        |
| -------------- | ------------------------------------------- | ------------------------------- | ------------------------------------------- |
| 门柱×2         | BoxGeometry                                 | 0.6×0.6×4.5m（方柱）            | 砖红 MeshStandardMaterial（#a04030）        |
| 门头横梁       | BoxGeometry                                 | width×0.8×0.6m（架柱顶）        | CanvasTexture"金福园小学"（深红底金字）     |
| 铁栅门×2扇     | 多 CylinderGeometry 竖杆 + BoxGeometry 横档 | 各 width/2 宽×2.5m 高，紧闭对开 | 深灰金属（#4a4a52，metalness 0.7）          |
| 黄黑警戒带     | PlaneGeometry（门柱间横拉）                 | width×1m，高 1m                 | CanvasTexture 黄黑斜纹（45°）               |
| "禁止出入"立牌 | BoxGeometry（薄板）+ 立杆                   | 0.8×1.2m，门口侧                | CanvasTexture 红圈禁止图标 + "禁止出入"文字 |

- `gateGroup.position.set(cx, groundY, cz)`，`gateGroup.rotation.y = ry`
- 门柱在 gateGroup 局部 ±width/2（沿门轴向）
- 警戒带在门柱间（门轴向），高 1m（柱底+1m）
- 立牌在门口外侧（局部 +z 方向）
- 全部 castShadow=true

## 围墙开口（createBoundaryWalls 改造）

当前 `createBoundaryWalls`（obstacles.js:2280）沿 boundary 闭环画墙段（每 12m 拆段）。校门位置要开口：

- 对每条 boundary 边，检测该边上的 gates（gates snap 到该边的）
- 该边在门宽范围（门中心 ± width/2，沿边方向）内的墙段**跳过**（不画）
- 用边参数 t（0-1 沿边）判断：gate 在边上的 t 范围 [tGate - width/2/edgeLen, tGate + width/2/edgeLen]，该范围的 addWallSeg 调用跳过

实现：`createBoundaryWalls(targetScene, boundary, gates)` 加 gates 参数；addWallSeg 内或外层循环检测 t 范围跳过。

## 碰撞 + 半透明

- **坦克碰撞**：obstacleData push `type:'wall'`，polygon=门体矩形 footprint（gateGroup 局部 ±width/2 × 厚 0.5），height=4.5m（柱高）。`type:'wall'` → `_indestructible`（炮弹/HE 不可摧毁）
- **门柱圆柱**：obstacleData push r=0.4 圆柱（两根柱），height=4.5m
- **炮弹命中**：gateGroup 子 mesh 入 `_campusBuildings`（Raycaster 命中焦痕，type='wall' 不摧毁只留痕）
- **半透明**：`_registerCampusBuilding(gateGroup)`（纳入相机遮挡半透明，同围墙/天桥/B7）

## 验证

1. **Playwright 工具闭环**：gate_marker.html 放置 2 门（不同宽度）→ 保存 → 重载回填 → 删除 → 宽度滑块调节生效
2. **加载校园**：2 门渲染（门柱/横梁校名/铁栅/警戒带/立牌），围墙在门位置开口（无穿模）
3. **碰撞**：坦克贴门阻挡（type='wall' polygon）；炮弹命中留焦痕不摧毁
4. **半透明**：坦克贴门，门整组半透明
5. **CDP 0 错误**

## 改动文件

- `tools/gate_marker.html`（新建，照搬 planter_marker + 宽度滑块 + snap boundary）
- `js/obstacles.js`（createGates 新函数 + createBoundaryWalls 开口 + createObstacles 调用 + \_registerCampusBuilding）
- `server.py`（solidify_campus + do_POST 加 gates 分支）
- `maps/campus.map.json`（新增 gates 字段，初始空或两门示例）
- `index.html`（+1 script gate_marker 如需嵌入？工具页独立，不嵌入）
- 文档：CLAUDE.md / CODEBUDDY.md / project_rules.md（发版时同步）

## 非目标（YAGNI）

- 不做开门/关门动画（紧闭静态）
- 不做电动伸缩门（选了铁栅门）
- 不做校门灯光/夜间
- 不做坦克可穿过（type='wall' 阻挡）
- 不做炮弹可摧毁（永久紧闭）
- 不做前/后门不同校名（都贴"金福园小学"）

## 已知风险

- **围墙开口边界**：门宽接近边长时，开口可能占整条边（无墙）—— 宽度滑块上限 15m，boundary 边长通常 >20m，OK
- **snap 歧义**：点击靠近 boundary 顶点时，snap 到两条边之一 —— 取最近边（距离最小），用户拖拽可调
- **门朝向反**：ry 法向可能朝内 —— snap 时法向取朝外（boundary 顶点顺序决定外向，逆时针为外）
