---
name: map-editor-v0.29-final
overview: 完成地图编辑器 Phase 5 收尾和 Phase 6 全部任务：敌人行为配置面板、撤销重做系统、主游戏集成入口、兼容性验证。
todos:
  - id: enemy-config-panel
    content: Phase 5 收尾：在 map_editor.html 侧边栏新增敌人行为配置面板（HTML+CSS+JS）。选中单个敌人时显示 HP/速度/视野/攻击伤害/冷却/掉落概率/回血量/行为模式/得分 编辑控件，实时写入 mapData.entities[].cfg
    status: completed
  - id: entity-cfg-extension
    content: 扩展实体数据模型：addEntity 中 enemy 类型自动初始化 cfg 默认字段。更新 exportMapJson/importMapJson/loadBlueprint/saveBlueprint 包含 cfg 序列化
    status: completed
    dependencies:
      - enemy-config-panel
  - id: undo-manager
    content: Phase 6：在 map_editor.html 实现 UndoManager（50步快照栈）。工具栏新增撤消/重做按钮。笔刷按下/实体增删/水体桥梁操作前自动 pushSnapshot。支持 Ctrl+Z/Y 快捷键。恢复时重建地面几何体+实体标记+水体桥梁网格
    status: completed
  - id: main-game-integration
    content: Phase 6：修改 index.html 的 showMapSelector() 读取 localStorage 编辑器蓝图并追加到地图列表。新增 convertBlueprintToMapConfig() 转换函数。getTerrainHeight() 增加离散高度图双线性插值分支。loadMapConfig() 支持动态注入
    status: completed
    dependencies:
      - entity-cfg-extension
  - id: perf-optimize
    content: Phase 6：map_editor.html 性能优化。animate() 限帧30fps。笔刷脏矩形批处理延迟到每帧末更新。实体列表防抖刷新
    status: completed
    dependencies:
      - undo-manager
  - id: version-sync
    content: 版本号同步 v0.29.0：更新 index.html 5处（title/menu-version/changelog/debug/console.log）、README.md 3处（开头版本号/版本历史/代码规模）、CODEBUDDY.md 关键参数表。changelog 裁剪到最近5条
    status: completed
    dependencies:
      - main-game-integration
      - perf-optimize
---

## 用户需求

继续未完成的地图编辑器 `map_editor.html` 开发任务（v0.29.0 计划），完成 Phase 5 收尾和全部 Phase 6 任务。

## 核心功能

### Phase 5 收尾：敌人行为配置面板

- 侧边栏新增敌人属性编辑区，选中单个敌人实体时自动显示
- 编辑项：HP、速度、视野距离、攻击伤害、攻击冷却、掉落概率、掉落回血量、行为模式（主动索敌/被动反击/不反击）、击杀得分
- 巡逻点缩略显示（巡逻点数量+坐标列表）和JSON预览
- 属性修改实时写入 `mapData.entities[].cfg`，导出时包含在JSON中

### Phase 6：撤销重做系统 (UndoManager)

- 工具栏新增撤销/重做按钮
- 维护最多50步操作历史快照栈，每步存储 `{heightmap, splatMap, entities, waters, bridges}` 完整深拷贝
- PushSnapshot 在每次地形编辑/实体增删移/水体操作前自动触发
- 支持 Ctrl+Z 撤销、Ctrl+Y 重做快捷键
- 复原时重建3D地面几何体、实体标记、水体/桥梁网格

### Phase 6：主游戏集成

- index.html 地图选择列表动态读取 localStorage `tank_map_editor_blueprints` 中的编辑器草稿
- 编辑器地图标记为「📝编辑器」前缀以区分内置地图
- `loadMapConfig()` 扩展支持从 localStorage 蓝图动态注入 MAP_CONFIGS
- 编辑器地图进入游戏时使用 `terrain.heightmap` 离散高度图模式运行

### Phase 6：兼容性验证

- 导出JSON字段对齐：entities→enemies 数组转换、spawnPoints格式统一
- 实体cfg字段补全默认值确保主游戏 enemyAI 可正常读取
- 地形参数化拟合增强：flatten平坦地图跳过拟合直接输出 heightmap

### Phase 6：性能优化

- 3D视口 requestAnimationFrame 限帧到30fps（用时间戳门控）
- 笔刷拖拽连续编辑时启用脏矩形批处理，每帧末统一更新纹理patch
- 实体列表刷新防抖：批量操作时延迟到操作完成后一次性刷新DOM

## 技术栈

- 编辑器：纯 HTML/CSS/JS 单文件 (`map_editor.html`)
- 3D 渲染：Three.js r160 (与主游戏共用 `three.min.js`)
- 数据持久化：localStorage (`tank_map_editor_blueprints`)
- 主游戏：纯 HTML/CSS/JS 单文件 (`index.html` ~5300行)
- 无外部UI框架，纯原生DOM操作

## 实现方案

### 1. 敌人行为配置面板 (map_editor.html)

**侧边栏DOM扩展**：在实体列表 `<div class="section">` 下方新增 `<div class="section" id="enemy-config-panel">`，默认 `display:none`，仅当 `selectedEntityIds.size === 1` 且选中实体 `type === 'enemy'` 时显示。

**属性字段映射**：

| 编辑器字段 | 存储键 | 默认值 | 说明 |
| --- | --- | --- | --- |
| HP | cfg.hp | 60 (突击车) / 40 (丧尸) | 生命值 |
| 速度 | cfg.speed | 5.0 / 2.5 | 移动速度 |
| 视野 | cfg.viewDist | 50 / 35 | 视野距离 |
| 攻击伤害 | cfg.attackDamage | 15 / 10 | 单次攻击伤害 |
| 攻击冷却 | cfg.attackCooldown | 3.0 / 1.5 | 攻击间隔 |
| 掉落概率 | cfg.dropRate | 0.25 | 0~1 |
| 掉落回血 | cfg.dropHeal | 30 | 回复量 |
| 行为模式 | cfg.reactive | true / false / 'none' | 被动反击/主动/不反击 |
| 击杀得分 | cfg.score | 100 / 50 | 积分 |


**交互设计**：每个字段用 `<input type="number">` 或 `<select>` 控件，`onchange` 实时更新 `mapData.entities[].cfg`。行为模式使用三个按钮切换（主动/被动/不反击），用 `.active` class 高亮。

### 2. UndoManager (map_editor.html)

**数据结构**：

```javascript
const undoManager = {
    stack: [],       // 快照数组
    index: -1,       // 当前位置（-1=无历史）
    maxSteps: 50,
};
```

**快照结构**：

```javascript
{ heightmap: Float32Array(65536), splatMap: Uint8Array(65536), entities: deepClone, waters: deepClone, bridges: deepClone }
```

**触发点**（在操作执行前调用 `pushSnapshot()`）：

- `applyBrush()` 首次按下时
- `addEntity()` 创建实体前
- `deleteEntity()` 删除前
- 实体拖拽移动首次位移前
- `addWater()` / `deleteWater()` 前
- `addBridge()` 前
- 新建地图/导入/加载蓝图前清空栈

**恢复逻辑**：`undo()` 将 index-1 快照恢复到 mapData → 重建地面几何体 → 清空并重建所有实体标记/水体/桥梁网格 → 刷新高度图画布和纹理。

**快照内存估算**：65536×4 + 65536 + 序列化实体 ≈ 320KB/步 × 50 = 16MB，在现代浏览器中可接受。

### 3. 主游戏集成 (index.html)

**修改 `showMapSelector()`**：在地图列表填充末尾追加编辑器地图：

```javascript
// 读取编辑器草稿
try {
    const bps = JSON.parse(localStorage.getItem('tank_map_editor_blueprints') || '[]');
    bps.forEach(bp => {
        const editorId = 'editor_' + bp.name;
        MAP_CONFIGS[editorId] = convertBlueprintToMapConfig(bp);
        // 追加到 mapList DOM
    });
} catch(e) { /* 忽略 */ }
```

**新增 `convertBlueprintToMapConfig()`**：将编辑器蓝图格式转换为 MAP_CONFIGS 兼容格式，关键转换：

- `terrain: { heightmap: Float32Array }` 直接存入
- `entities[]` → `enemies[]` 数组（筛选 type==='enemy'）
- `spawnPoints` 从 `type==='spawn'` 实体提取

**引入离散高度图模式**：`getTerrainHeight()` 新增分支，当 `currentMapData.terrain.heightmap` 存在时用双线性插值采样离散高度图，替代参数化公式计算。

### 4. 导出JSON兼容性

**当前导出格式已基本兼容**，需微调：

- entities 中 enemy 类型实体追加 `cfg` 字段
- 平坦地图（maxH-minH < 0.1）跳过 `fitParameterizedTerrain()`，直接输出 `terrain.heightmap`
- 补充 `players` 默认战斗参数段（`hp:100, lives:3, cannonDamage:40`）

### 5. 性能优化

**3D视口限帧30fps**：

```javascript
let lastFrameTime = 0;
const FRAME_INTERVAL = 1000 / 30;
function animate(now) {
    requestAnimationFrame(animate);
    if (now - lastFrameTime < FRAME_INTERVAL) return;
    lastFrameTime = now;
    renderer.render(scene, camera);
}
```

**笔刷脏矩形批处理**：`applyBrush()` 拖拽时只记录受影响纹理块到 `affectedBlocks` Set，每帧末统一调用 `patchTexBlock()` 并 `needsUpdate=true`，避免每次 mousemove 都触发纹理GPU上传。

## 目录结构

```
tank_demo/
├── map_editor.html           # [MODIFY] 地图编辑器主文件 (~2167→~2700行)
│   新增：UndoManager (~80行) + 敌人配置面板 (~120行) + 帧限速 (~10行)
│   修改：addEntity/deleteEntity/applyBrush 等操作前 pushSnapshot (~20处)
│
├── index.html                # [MODIFY] 主游戏 (~5300→~5400行)
│   新增：convertBlueprintToMapConfig() (~40行)
│   修改：showMapSelector() 追加编辑器地图 (~15行)
│   修改：getTerrainHeight() 增加离散高度图分支 (~15行)
│   修改：loadMapConfig() 支持动态注入 (~10行)
│
├── CODEBUDDY.md              # [MODIFY] 版本号+参数表更新
└── README.md                 # [MODIFY] 版本号+版本历史+参数表更新
```

## 关键代码结构

### 敌人实体 cfg 扩展

```javascript
// mapData.entities 中 enemy 类型扩展：
ent.cfg = {
    hp: 60, speed: 5.0, viewDist: 50, attackDamage: 15,
    attackCooldown: 3.0, dropRate: 0.25, dropHeal: 30,
    reactive: true, score: 100
};
```

### 蓝图→地图配置转换

```javascript
function convertBlueprintToMapConfig(bp) {
    return {
        version: '1.0', name: bp.name, size: 200, type: 'single',
        mode: 'combat', desc: '编辑器创建',
        spawnPoints: { p1: bp.entities.find(e=>e.type==='spawn')?.position || [0,0,0] },
        terrain: { heightmap: bp.heightmap },
        enemies: bp.entities.filter(e=>e.type==='enemy').map(e => ({
            id: e.id, type: e.enemyType, position: [e.position.x, e.position.y, e.position.z],
            patrol: e.patrol, cfg: e.cfg || {}
        })),
        entities: bp.entities,
        obstacles: { count: 350, minDist: 6, safeRadius: 10, spawnRadius: 98 }
    };
}
```