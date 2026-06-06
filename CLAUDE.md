# CLAUDE.md

3D 坦克对战游戏 — Three.js r160 浏览器游戏 + 地图编辑器 + PvE 战斗

## 运行

```bash
python -m http.server 8080 --bind 127.0.0.1
```
访问 `http://127.0.0.1:8080`（必须 127.0.0.1，禁止 localhost）

提供 `preview_url` 前：先杀残留 Python 进程，再启动单一服务，确认就绪后才调用。

## 文件结构

```
├── index.html         # 核心游戏引擎 (~5365行)：状态机/场景/物理/瞄准/摄像机
├── js/                # 游戏模块（13个）
│   ├── waters.js      # 水体模块 (~317行)：池塘水面+河流alphaMap遮罩平面+碰撞体+动画
│   ├── bridges.js     # 桥梁模块 (~165行)：编辑器桥+参数化桥+碰撞检测+可视化
│   ├── debugcolliders.js  # 碰撞可视化 (~122行)：F3切换(默认关)，从运行时数据反向生成
│   ├── obstacles.js   # 环境对象 (~794行)：树木/建筑/InstancedMesh管理
│   ├── shells.js      # 炮弹系统 (~309行)
│   ├── audio.js       # 音频系统 (~240行)
│   ├── fireSmokeParticles.js  # 粒子系统 (~536行)
│   ├── mg.js          # 机枪系统 (~198行)
│   ├── bars.js        # UI 血条/装填条 (~80行)
│   ├── input.js       # 输入处理 (~70行)：WASD+手柄5段力度
│   ├── spatialGrid.js # 空间网格 (~110行)
│   ├── three.min.js   # Three.js r160 压缩库
│   └── BufferGeometryUtils.js  # Three.js 工具函数
├── models/hexapod_config.js # 六足战车共享模型配置：3节腿(大腿+小腿+尖刺足)，4DOF(髋摆+髋抬+膝+踝)，锥尖单点接地
├── js/hexapod_anim.js       # 六足动画模块 (~540行)：待机+步行+奔跑+三角步态+单腿IK测试(3模式×3腿型)
├── map_editor.html    # 地图编辑器 (~1800行)：v0.53.0
├── js/editor_*.js     # 编辑器模块（6个）
│   ├── editor_terrainGen.js  # 地形+村落生成 (~750行)：双管线(地形/村落)+掩码网格+FloodFill+A*+容量预验证
│   ├── editor_genStatus.js   # 生成状态面板 (~120行)：实时进度+统计+质量评分+自动隐藏
│   ├── editor_entities.js    # 实体管理 (~645行)：标记+CRUD+配置面板+列表+建筑朝向(yaw)
│   ├── editor_waterBridge.js # 水体桥梁 (~659行)：水面+河床+桥梁检测
│   ├── editor_data.js        # 数据持久化 (~503行)：蓝图+JSON+init
│   └── editor_terrainPaint.js # 地形绘制 (~335行)：笔刷+高度图画布
├── model_factory.html # 程序化模型编辑器 (~2428行)
├── models/            # 模型文件 (GLB主力 + 程序化兜底)
├── maps/              # .map.json 地图配置
├── combat/            # AI状态机 + 积分系统
├── docs/              # 协作文档
└── CODEBUDDY.md       # 详细架构/参数/已知问题/待办 → 查阅细节时读它
```

## 核心全局变量

`scene`, `players[]`, `bullets[]`, `explosions[]`, `obstacles[]`, `currentMapData`

## 生成管线（v0.51.0 新增）

三个按钮驱动两条独立管线：

| 按钮 | 函数 | 说明 |
|------|------|------|
| 🎲 一键全部 | `generateAll()` | 管线A→管线B，完整地图 |
| 🌍 仅生成地形 | `generateTerrainOnly()` | 管线A：FBM→自动平整→生态区→池塘。结束后可手画河流 |
| 🏘️ 生成道路与村落 | `generateRoadsAndVillages()` | 管线B：读当前terrain+water→掩码→主干道→FloodFill→选址预验证→落地→树木→桥梁 |

### 管线A（仅地形）
FBM高程 → 自动平整（保峰压谷） → 生态区分区 → 池塘

### 管线B（道路+村落+障碍物）
构建掩码（MG_BUILDABLE/FORBIDDEN/WATER/ROAD）→ A*主干道 → Flood Fill区域分割 → 村落选址+容量预验证 → 落地（广场整平+村路+建筑+连接路）→ 分层采样树木 → 桥梁检测 → roadSystem存储

### 新增数据结构
- `MaskGrid` (Uint8Array位掩码)：`MG_BUILDABLE|MG_FORBIDDEN|MG_WATER|MG_ROAD|MG_PLAZA|MG_BUILDING|MG_BUFFER`
- `BuildableRegion`：FloodFill连通区（面积/质心/平坦度/包围半径）
- `VillagePlan`：预验证选址（广场+支路+建筑槽位+容量）
- `GenerationReport`：诊断报告（统计+失败原因+质量评分+种子+耗时）

### 关键函数
- `_autoFlatten(cfg)`: 保峰压谷 — 保留N个山峰，谷削至 keepRatio%
- `buildMaskGrid(cfg)`: 从当前地形+水体构建全图禁建掩码
- `_findBuildableRegions()`: BFS连通域分析
- `_simulateBuildingSlots()`: 建筑簇模拟（2-4个角度簇，每簇独立撒点）
- `_growBranchRoad()`: 贪心支路生长（沿最低粗糙度梯度）
- `_clusterByAngle()`: 建筑按角度分群（生成连接路用）
- `createRng(seed)`: Mulberry32确定性随机

## 必须遵守的规则

1. **版本号同步 8 处**：`index.html`（title + menu-version + changelog + 调试信息 + console.log）+ `README.md`（开头版本号 + 版本历史 + 代码规模）
2. **Changelog 裁剪**：`.changelog` 只保留最近 5 条，多了删最旧的
3. **Commit 格式**：`git commit -m "vX.Y.Z: 描述"`
4. **Git 推送**：`git push origin master` (Gitee 主仓库)
5. **修改后 Ctrl+F5** 强制刷新验证
6. **自动验证**：修改代码后自动用 Chrome headless CDP 抓取控制台错误，无误后才通知用户；有错则自行修复再验证，直到通过
7. **模块优先**：新功能优先以独立 JS 模块加载，三个主文件（index/map_editor/model_factory）不宜再增大，主文件仅作框架和加载器
8. **文档同步**：更新 CLAUDE.md 时同步更新 CODEBUDDY.md（参数/架构/已知问题）和 `.trae/rules/project_rules.md`（规则/文件行数），三份文档保持一致

## 六足战车 IK 系统

### 腿结构（6条腿，每条 4 DOF）

```
legGroup (Y旋转=水平摆角)
  └── thighPivot (X旋转=髋抬腿) [L1≈0.7]
        ├── 大腿 mesh + 髋球 + 警示条
        └── shinPivot (X旋转=膝) [L2≈0.55]
              ├── 小腿 mesh + 膝球
              └── anklePivot (X旋转=踝)
                    ├── 踝球 (Sphere r=0.05, anklePivot原点)
                    └── 尖刺足 (Cone, 锥尖朝下≈0.28)
```

### 单腿 IK 测试（`toggleHexIKTest`）

- **按钮**：模型工厂 `#toggle-iktest`，仅六足战车可用
- **子菜单**：腿选择(左前/左中/左后) + 模式选择(Y轴下蹲/X轴左右/Z轴前后)
- **算法**：CCD (Cyclic Coordinate Descent)，40迭代 + 0.5阻尼，踝关节锁死
- **关节顺序**：thigh.X → shin.X → legGroup.Y（3关节，踝不参与）
- **接地**：尖刺足锥尖单点固定，无需脚掌校平

### 动画展台（`toggleAnimShowcase`）

- **23 动画**：21步态 + 踉跄 + 死亡。列表左侧垂直滚动，7分类分隔
- **步态参数**：stride/stepH 由 `_hexaStrides`/`_hexaStepHeights` 数组驱动 (21项)，direction+turnRate 正交组合
- **步态周期公式**：静态转弯 `gaitPeriod=1.05/|ω|`，移动转弯 0.72s，直行 0.38~0.7s；实装后换连续钳位 `clamp(1.05/|ω|, 0.5, 0.8)`
- **CCD迭代**：高速转 `20+|ω|×13`，低速转 `20+|ω|×8`，奔跑 30，其余 15
- **三角步态**：A组(左前+右中+左后)与B组(右前+左中+右后)交替支撑/摆动
- **循环无缝**：同动画loop不reset腿关节；切动画时自动复位

### 转弯验证（`toggleHexTurnTest`）

- **按钮**：模型工厂 `#toggle-turntest`，仅六足战车可用
- **策略**：隐藏武器+上车体，仅保留下车体+6腿，极慢旋转(0.3rad/s)
- **可视化**：🔵蓝球=bodyCenter, 🔴红球=plantPos, 🟢绿球=swingTarget
- **公式**：swingTo = bodyCenter + rotate(plantPos-bodyCenter, -turnRate×T_cycle)
- **CCD**：damp=0.8, ccdIters=20+|turnRate|×13, T_cycle=3.5s

### 受击踉跄（`triggerHexStagger`）

- **调用**：`triggerHexStagger(worldDir, force)` — AI/玩家命中时触发
- **四阶段**：冲击(0.12s)→踉跄(0.35s)→恢复(0.50s)→回归
- **机制**：身体沿受击方向位移+倾斜，2~3条反方向腿跺地支撑，CCD damp=0.7

### 死亡瘫倒（`triggerHexDeath`）

- **调用**：`triggerHexDeath()` — 血量归零时触发
- **四阶段**：昂首(0.22s)→极点(0.1s)→瘫软(0.7s)→触地(0.5s)
- **机制**：前腿撑地昂起→身体急坠至groundY+0.14→damp 0.85→0.03，6腿伸展外摊，6种各异瘫姿

### 武器俯仰校准（`toggleWeaponCalibrate`）

- **按钮**：模型工厂 `#toggle-weaponcal`，仅六足战车可用
- **状态**：瞄准线可视化OK，武器实体旋转有bug（层级重组导致飞移）
- **待修**：枢轴组创建逻辑

### CCD 系统

- **核心**：`_ccdLeg(leg, target, iters, damp)` — damp 默认 0.5，转弯用 0.8，死亡渐降至0.03
- **固定脚距**：`leg._initFootDist` 初始化时缓存，swingTo用定值防CCD误差漂移
- **落地Y**：`leg._groundY` 初始接地高度，防止代际漂移

## 游戏模式

- `menu` | `single` | `versus` | `combat`
- WASD驾驶 + 鼠标瞄准 + 左键开炮 / ESC返回

## 详细文档

查看 **CODEBUDDY.md** — 关键参数表、架构详解、已知问题、待完成任务、交接流程
