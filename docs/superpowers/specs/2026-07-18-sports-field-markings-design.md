# 球场标线+球门+篮球架 设计文档

日期：2026-07-18 ｜ 目标版本：v0.73.0 ｜ 地图：campus（金福园小学）

## 1. 需求（已与用户确认）

| 场地                                    | 数据源（grounds） | 处理                                                                           |
| --------------------------------------- | ----------------- | ------------------------------------------------------------------------------ |
| 足球场（名`足球场`，32.1×23.7u≈42×31m） | #8                | **两个子场长边相贴并排**（沿长轴对半分，各≈16×23.7u）：2 套标线 + **4 个球门** |
| 大篮球场1/2（16.8×23.7u）               | #6/#3             | 5 人制全场标线 + 每场 2 篮筐（筐高 3.05m）                                     |
| 小篮球场1/2（11.2×15.3u）               | #5/#4             | 3 人制**缩小全场**标线 + 每场 2 篮筐（筐高 2.6m）                              |
| 未命名场地（#0/1/2/7/9）                | —                 | 不动                                                                           |

- 底色：**全部保持草地底**+白色标线（篮球场不改塑胶）
- 碰撞：**可碎碰撞体**——炮弹命中即整组碎（爆炸音+碎片），坦克撞停
- 球门碰撞粒度：**双柱小圆柱**（r≈0.15），命中任一柱整门碎。（勘误 2026-07-19：原文"坦克可从门洞穿过"不成立——门宽 2.31u < 坦克碰撞直径 2.4u，实际坦克撞门框停，用户已确认接受，物理合理）
- 零数据格式变更：场地名已存在于 campus.map.json，仅按名匹配

## 2. 方案（已选定 A）

**A·CanvasTexture 整场纹理**：3 种规格各生成一张 1024px 程序化纹理（草地底图平铺+白线），重写场地 ShapeGeometry 的 UV（世界坐标→footprint 局部归一化），单场单 mesh 零额外 DC、零 z-fighting、线条随场地旋转自动对齐。同规格场地共享纹理缓存（window key，含版本号后缀便于失效）。

否决：B 几何面片标线（弧线三角化代码量大、polygonOffset 层叠 z-fighting 风险、每场+1DC）；C Shape 贴花（同 B）。

## 3. 模块与接线

**新模块 `js/sportsFields.js`**（~450 行）：

```
window.SportsFields = {
  hasCourt(name),            // '足球场' | /^大篮球场/ | /^小篮球场/
  buildCourt(g, scene),      // 场地面: ShapeGeometry + 标线纹理 + UV重映射
  buildEquipment(g, scene),  // 球门/篮球架 Group + insertObstacle 登记
}
```

接线（全部极小改动）：

| 文件              | 改动                                                                                                         |
| ----------------- | ------------------------------------------------------------------------------------------------------------ |
| `js/obstacles.js` | `createGrounds` 循环开头 +3 行：命名场地转交 `buildCourt` 后 `continue`；场地循环后 +1 行调 `buildEquipment` |
| `js/engine.js`    | 摧毁分支（~2609 行 `obstacleData.indexOf(od)` 处）+5 行：按 `groupRef` 清理兄弟碰撞体（双门柱联动碎）        |
| `index.html`      | +1 `<script src="js/sportsFields.js">`（obstacles.js 之前加载）                                              |

## 4. 详细规格（单位 u，1u=1.3m）

### 4.1 UV 重映射与纹理坐标系

- footprint 为 5 点闭合旋转矩形。局部轴：`u=P0→P1`、`v=P1→P2`，实测边长决定长短轴，绘制按物理尺寸(u)→像素换算，不假设方向
- 顶点 UV = 顶点在局部轴上的投影 ÷ 边长（0..1）；纹理底图用 `TerrainTextures.grass()` 按 ~1u/tile 平铺绘制，与周边草地密度一致
- 线宽 0.12u（≈16cm，1024px÷32u≈32px/u → 线≈4px）

### 4.2 足球场纹理（整块 32.1×23.7，长轴分半为两子场）

每子场（16×23.7，球场长轴=23.7 方向）：

- 外边线内缩 0.5；中线横穿长轴中点；中圈 r=2.3（3m）
- 两端矩形禁区：宽 7 × 深 3（≈9×4m，小学画法）；点球点 r=0.1、距端线 4.6（6m）
- 两子场各自画完整边线（相贴处两线并行，间距=2×0.5 内缩）

### 4.3 篮球场纹理

大场（16.8×23.7，5 人制）：

- 边线内缩 0.5；中线+中圈 r=1.4（1.8m）
- 三分线：弧 r=5.2（6.75m）圆心=筐投影点（距端线 1.2）+ 两侧直线段
- 罚球区：宽 3.8 × 深 4.4 矩形 + 罚球圈 r=1.4

小场（11.2×15.3，3 人制缩小全场）：大场布局等比 ~0.66（三分弧 r=3.4、罚球区 2.5×2.9、中圈 r=0.95、筐点距端线 0.8）

### 4.4 球门 ×4（白色，5 人制 3×2m）

- 门宽 2.31（柱心距）× 高 1.54；柱/梁 Cylinder r=0.05；2 后斜撑；网=3 片半透明白面（`MeshBasicMaterial opacity:0.25 DoubleSide depthWrite:false`）
- 位置：各子场端线中点、开口朝场内；共 4 个（整块场地 z 向两端每端 2 个）
- 碰撞：每柱 `insertObstacle({x,z, radius:0.15, height:1.54, type:'building', groupRef:门Group, color:'#ffffff'})` — 2 条/门
- 摧毁：命中任一柱 → 现有 groupRef 路径整门 remove+dispose；engine.js 新增兄弟清理把另一柱碰撞体一并删除

### 4.5 篮球架 ×8（大场 4 + 小场 4）

- 结构：底座 Box(0.6×0.15×0.5) + 立柱 Cylinder r=0.08 + 前探悬臂 0.6 + 篮板 Box 1.38×0.81×0.05（白底红框 CanvasTexture 128px）+ 篮筐 Torus r=0.175 管径 0.02 橙 `#e8641e`
- 筐面高：大场 2.35（3.05m）/ 小场 2.0（2.6m）；篮板下沿=筐上 0.15；板面在筐点正上方（悬臂由端线后 0.6 的立柱前探）
- 位置：端线中点外 0.6 立柱，板朝场内
- 碰撞：立柱 1 条 `{radius:0.2, height:柱高, type:'building', groupRef:架Group}`

### 4.6 材质与性能

- 所有材质模块级共享常量（obstacle_conventions 铁律）：白框架/网/柱灰/篮板/筐橙 共 5 个
- 首版 Group 多 mesh（12 组共约 +50~60 DC，主通道现 ~308）；实测增量 >+80 DC 再做 BufferGeometry 合并优化（YAGNI）
- 场地面 mesh `name='campus-court'` 进 obstacleMeshes（沿用 campus-ground 清理路径）；球门/篮架 Group 进 obstacleMeshes + obstacleData(groupRef)

## 5. engine.js 摧毁联动（唯一引擎改动）

`groupRef` 摧毁块内、`obstacleData.splice(realIdx,1)` 后追加：

```js
// 清理同组兄弟碰撞体(如球门双柱)
for (let k = obstacleData.length - 1; k >= 0; k--) {
  if (obstacleData[k].groupRef && obstacleData[k].groupRef === od.groupRef) {
    if (window._obstacleGrid) window._obstacleGrid.remove(obstacleData[k]);
    obstacleData.splice(k, 1);
  }
}
```

（注：此循环在 od 自身已被 splice 之后执行，故无需排除自身。）

## 6. 验证方案

1. **Playwright 结构断言**：进 campus → 5 块命名场地 mesh(`campus-court`)材质 map 为球场纹理且 UV∈[0,1]；球门 4/篮球架 8 存在且位于对应端线中点（世界坐标误差 <0.5）；obstacleData 含 4×2+8=16 条 groupRef 条目
2. **可见性**：门柱/篮板 raycast 自命中；截图像素分析场地区域存在白线像素带
3. **摧毁联动**：脚本直接调用摧毁路径（或模拟炮弹命中门柱）→ 整门 Group 从场景消失 + 该门 2 条碰撞体均被清理
4. **回归**：CDP 0 错误；map01a 进出正常（模块不激活）；DC 增量实测 ≤+80
5. 完成后走 bump-version（v0.73.0）+ 文档三同步

## 7. 风险与备注

- ShapeGeometry 顶点序 = footprint 点序，UV 按顶点位置计算与三角化无关，无对齐风险
- 纹理缓存 key 带版本后缀（如 `_courtTexV1football`），改图案时 bump 防 ESC 重进地图用旧缓存（厕所标志 V10 教训）
- 球门网半透明面 `depthWrite:false`，与炮弹 Raycaster 无关（不进 \_campusBuildings，炮弹只碰双柱圆柱数据）
- 小场按 3 人制缩小**全场**（用户确认双筐，非 FIBA 半场式）
