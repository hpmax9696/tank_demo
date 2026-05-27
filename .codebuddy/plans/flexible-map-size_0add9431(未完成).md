---
name: flexible-map-size
overview: 将地图尺寸从硬编码常量改为 .map.json 中的 size 字段驱动，实现灵活可配置的地图和空气墙尺寸，同时确保地图编辑器的随机生成功能正常适配。
todos:
  - id: map-config-extend
    content: 扩展地图配置数据模型：在 MAP_CONFIGS 和 loadMapConfig() 中增加 worldSize/playSize 字段及默认值兜底，同时更新 maps/ 下 5 个 .map.json 文件
    status: pending
  - id: index-dynamic-constants
    content: 将 index.html 中硬编码尺寸常量（WORLD_HALF/SPAWN_RADIUS/OBS_VISIBLE_RADIUS/GRASS_*）改为从 currentMapData 动态计算，更新 createGround() 地面尺寸和物理空气墙钳制逻辑
    status: pending
    dependencies:
      - map-config-extend
  - id: index-proportional-scaling
    content: 同步更新 index.html 中依赖尺寸的比例参数：雾距（fog near/far）、摄像机 far 平面、convertBlueprintToMapConfig() 的 spawnRadius 等
    status: pending
    dependencies:
      - index-dynamic-constants
  - id: enemy-ai-grid-dynamic
    content: 适配 combat/enemyAI.js 空间网格为动态计算：GRID_CELL 和 GRID_LEN 基于 playSize 推导，修正格子映射公式中的硬编码偏移量
    status: pending
    dependencies:
      - map-config-extend
  - id: obstacles-tree-boundary
    content: 将 obstacles.js 中的 treeBoundary 硬编码改为参数传入，使树木边界检查跟随 worldHalf 动态变化
    status: pending
    dependencies:
      - map-config-extend
  - id: editor-dynamic-sizing
    content: 重构 map_editor.html：将 WORLD_SIZE 和 PLAY_SIZE 硬编码常量改为全局变量，在编辑器 UI 右侧面板顶部新增地图尺寸设置区域（滑块控件，含约束校验），更新地面几何体、边界线可视化、实体放置限制、导出 JSON 等所有引用点
    status: pending
    dependencies:
      - map-config-extend
  - id: editor-random-generate-adapt
    content: 确保编辑器随机生成功能适配动态尺寸：随机地形生成和道路村落生成中所有 WORLD_SIZE/WORLD_HALF 引用改为动态变量，验证比例计算公式不受尺寸变化影响
    status: pending
    dependencies:
      - editor-dynamic-sizing
  - id: backward-compat-test
    content: 向后兼容性验证：测试现有 5 个默认地图正常加载，编辑器蓝图存储/读取新字段，创建新尺寸地图的完整工作流
    status: pending
    dependencies:
      - editor-random-generate-adapt
---

## 用户需求

将坦克Demo中当前硬编码的地图尺寸改为灵活可配置方案，支持设计不同大小的关卡地图。核心要求：

1. **动态地图尺寸**：地图的空气墙（可游玩区域）和世界尺寸（含缓冲区）不再硬编码，改为从地图配置中动态读取
2. **编辑器支持**：地图编辑器新增尺寸设置功能，允许创建不同大小的新地图
3. **向后兼容**：现有5个地图（size:200）保持正常工作，按默认值处理
4. **不影响随机生成**：编辑器的随机地形生成和道路村落生成功能，参数和效果保持不变
5. **统一数据流**：地图尺寸信息从配置文件 → 编辑器 → 主游戏引擎 → 各子系统 全链路贯通

## 核心功能

- 地图配置新增 `worldSize`（世界地形尺寸）和 `playSize`（空气墙/可游玩尺寸）字段
- 主游戏引擎所有尺寸相关常量和计算全部动态化
- 编辑器新增地图尺寸设置面板，支持创建自定义尺寸地图
- 随机生成系统自适应新尺寸（范围参数按比例缩放）
- ENEMY AI 空间网格自适应地图尺寸
- 地面几何体、可见半径、草丛等参数按比例自动缩放

## 技术方案

### 1. 整体策略

采用「**配置驱动 + 默认兜底 + 比例缩放**」三层策略：

- **配置驱动**：地图尺寸由 `.map.json` 或 `MAP_CONFIGS` 中的 `worldSize`/`playSize` 字段决定
- **默认兜底**：未指定尺寸的旧地图，默认 `worldSize=300, playSize=200`（与当前行为一致）
- **比例缩放**：障碍物可见半径、草丛等派生参数以 `playSize` 为基准按比例计算，而非硬编码

### 2. 数据模型设计

地图配置扩展两个字段：

```javascript
{
  "worldSize": 300,   // 世界地形总尺寸（含外围视觉缓冲区），方形
  "playSize": 200,    // 空气墙/可游玩区域尺寸，方形
  "size": 200,        // 保留兼容，等同于 playSize
}
```

**尺寸关系**：`worldSize >= playSize`，地面几何体 = worldSize，空气墙 = playSize。

**默认值策略**：

- 无 `worldSize` 字段 → 默认 300
- 无 `playSize` 字段 → 取 `size` 字段值（默认 200）
- 地面几何体尺寸 = worldSize

### 3. 修改范围清单

#### 3.1 index.html（主游戏引擎）

| 修改点 | 当前硬编码 | 改为动态 |
| --- | --- | --- |
| `WORLD_HALF` 常量 (行1385) | `100` | `getPlayHalf()` 从 currentMapData.playSize 计算 |
| `SPAWN_RADIUS` 常量 (行1387) | `98` | `getSpawnRadius()` = playHalf - 2 |
| `POISSON_MIN_DIST` 常量 (行1387) | `6.0` | 保留不变（障碍物间距无需随地图缩放） |
| `OBS_VISIBLE_RADIUS` (行1388) | `90` | `playHalf * 0.9` 动态计算 |
| `GRASS_CELL_SIZE` (行1389) | `40` | `playSize * 0.2` 动态计算 |
| `GRASS_VISIBLE_RADIUS` (行1390) | `95` | `playHalf * 0.95` 动态计算 |
| `createGround()` SIZE (行1649) | `300` 或 `200` | `worldSize` |
| 物理空气墙钳制 (行2958-2961) | `WORLD_HALF` | `getPlayHalf()` |
| MAP_CONFIGS 全部地图 (行652-970) | `size:200` | 新增 `worldSize:300, playSize:200` |
| `convertBlueprintToMapConfig()` (行999) | 固定 `spawnRadius:98` | 动态 `playSize/2 - 2` |
| `loadMapConfig()` (行976) | — | 增加 worldSize/playSize 默认值兜底 |
| 雾距参数 | `near 70 / far 110` | `playSize * 0.35 / playSize * 0.55` |
| 摄像机 far | `300` | `max(300, worldSize * 1.0)` |


#### 3.2 map_editor.html（地图编辑器）

| 修改点 | 当前硬编码 | 改为动态 |
| --- | --- | --- |
| `WORLD_SIZE` 常量 (行632) | `300` | 全局变量，支持修改 |
| `PLAY_SIZE` 常量 (行634) | `200` | 全局变量，支持修改 |
| UI 信息显示 (行3337) | 固定字符串 | 动态读取变量 |
| 地面几何体 (行1681) | `WORLD_SIZE` | 动态变量 |
| 边界线可视化 (行1900-1920) | `PLAY_HALF=100` | 动态变量 |
| 实体放置限制 (行2356) | `PLAY_HALF` | 动态变量 |
| 导出 JSON (行2823) | 固定 `worldSize/playSize` | 动态变量 |
| 随机生成地形 (行3420) | `WORLD_SIZE * 0.7/0.55` | `WORLD_SIZE * ratio` 保持比例 |
| 道路村落生成 (行3877) | 多处 `WORLD_HALF` | 动态变量 |
| 蓝图存储/读取 | — | 新增 worldSize/playSize 字段 |
| **新增尺寸设置面板** | 无 | 提供滑块/输入框设置 worldSize 和 playSize |


#### 3.3 combat/enemyAI.js

| 修改点 | 当前硬编码 | 改为动态 |
| --- | --- | --- |
| `GRID_CELL` (行626) | `20` | `playSize / 10`（保持10格/边） |
| `GRID_LEN` (行627) | `10` | `ceil(playSize / GRID_CELL)` |
| 格子映射公式 | `(pos + 100) / 20` | `(pos + playHalf) / GRID_CELL` |


**注意**：`GRID_CELL` 保持 20m 可适应大多数尺寸，但极端小图（如100×100）会变成 5×5 网格，仍可工作。或者改为 `max(20, playSize / 10)` 保证最小单元格 20m。

#### 3.4 obstacles.js

| 修改点 | 当前硬编码 | 改为动态 |
| --- | --- | --- |
| `treeBoundary` (行355) | `150` | 函数参数传入 worldHalf |


将 `treeBoundary` 作为参数传入相关函数，或通过 `window` 全局暴露 worldHalf。

#### 3.5 maps/*.map.json（5个文件）

每个文件新增两个字段（向后兼容，旧游戏引擎通过默认值兜底）：

```
{
  "worldSize": 300,
  "playSize": 200,
  "size": 200
}
```

### 4. 编辑器尺寸设置面板设计

在编辑器右侧面板顶部新增「地图尺寸」折叠区块：

- **世界尺寸** (worldSize)：滑块 200-600m，步长 50m，默认 300
- **可游玩尺寸** (playSize)：滑块 100-500m，步长 50m，默认 200
- **约束**：playSize ≤ worldSize，且 playSize ≥ 100
- 修改后提示「需要重新生成地形或手动调整」
- 蓝图层（localStorage）自动保存这两个值

### 5. 向下兼容性保障

```javascript
// index.html loadMapConfig() 中增加兜底
mapData.worldSize = mapData.worldSize || 300;
mapData.playSize = mapData.playSize || mapData.size || 200;
if (mapData.worldSize < mapData.playSize) mapData.worldSize = mapData.playSize;
```

旧地图和编辑器蓝图中没有这两个字段的情况下，自动按默认值 300/200 处理。

### 6. 关键参数比例关系

| 派生参数 | 比例公式 | 200×200 时值 | 400×400 时值 |
| --- | --- | --- | --- |
| spawnRadius | playHalf - 2 | 98 | 198 |
| obsVisibleRadius | playHalf × 0.9 | 90 | 180 |
| grassCellSize | playSize × 0.2 | 40 | 80 |
| grassVisibleRadius | playHalf × 0.95 | 95 | 190 |
| fog near | playSize × 0.35 | 70 | 140 |
| fog far | playSize × 0.55 | 110 | 220 |
| camera far | max(300, worldSize) | 300 | 400 |
| enemyAI gridCell | 固定 20m | 20 | 20 |


### 7. 执行顺序

```
Phase 1: index.html 常量化 → 地图配置扩展 → loadMapConfig 兜底
Phase 2: 物理/可见性/地面等派生参数动态化
Phase 3: map_editor.html 常量化 + 尺寸设置面板
Phase 4: combat/enemyAI.js + obstacles.js 适配
Phase 5: maps/*.map.json 补充字段
Phase 6: 测试：旧地图兼容 + 新尺寸地图工作流
```