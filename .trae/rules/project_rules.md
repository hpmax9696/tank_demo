# 坦克对战 Demo — 项目规则（Trae 跨会话自动加载）

## 交流语言 🇨🇳

- **所有思考过程使用中文**
- **所有对话反馈使用中文**
- **代码注释不写**（除非明确要求）

---

## 启动与预览

```powershell
# 每次启动前先杀残留进程
Get-Process python -ErrorAction SilentlyContinue | Stop-Process -Force
# 启动 HTTP 服务（必须 HTTP 才能加载 GLB 模型）
python -m http.server 8080 --bind 127.0.0.1
```

| 页面       | 地址                                       |
| ---------- | ------------------------------------------ |
| 主游戏     | `http://127.0.0.1:8080`                    |
| 模型工厂   | `http://127.0.0.1:8080/model_factory.html` |
| 地图编辑器 | `http://127.0.0.1:8080/map_editor.html`    |

**规则**：用 `127.0.0.1` 不用 `localhost`，端口固定 8080，只允许一个 Python 进程。

---

## 尺度标定（v0.65.5）

- **`METERS_PER_UNIT = 1.3` 米/单位**（`js/engine.js:248`）。标定：真实 T-34/85 高 2.6m ÷ 坦克渲染 1.99 单位 = 1.306，取 1.3。
- 障碍物渲染高度 = `targetHeightM / 1.3`（仅 `js/obstacles.js` 4 处用此系数）。
- 树 2~~5m、平房 2.5~~3.3、别墅 3~~5.5、公寓 4.2~~9.7、风车 2.8~5.5。
- 地图/AI/fog/阴影/速度等裸单位参数**数值不变**，米含义基于 1 单位=1.3m。
- 地图编辑器尺寸 UI 显示米（×1.3），内部存单位。

---

## 关键文件

| 文件                                    | 行数  | 核心内容                                                                    |
| --------------------------------------- | :---: | --------------------------------------------------------------------------- |
| `index.html`                            | ~1082 | 主游戏框架（UI+菜单+脚本加载+训练配置）                                     |
| `js/engine.js`                          | ~8131 | 游戏引擎（状态机/场景/物理/瞄准/摄像机/AI/训练场/狙击）                     |
| `maploader.js`                          | ~191  | 地图加载模块（蓝图转换+动态加载）                                           |
| `model_factory.html`                    | ~5570 | 程序化模型编辑器（含 23 动画展台 + 部件树 + 转弯验证 + IK测试 + RidgeBox + EllipFrustum + 坐标轴开关 + 骨架版本删除+保存分流）  |
| `js/humanoid_factory.js`                | ~246  | 人形工厂展台桥接（6动作数据驱动+_rotRestY修复+REST偏移+全关节复位）         |
| `models/humanoid_config.js`             | ~9953 | 人形配置（BASE骨架+SKELETON_VERSIONS+BASE_ANIMS+版本anims+buildHumanoid+ZOMBIE_HUNCH烘焙注入+EllipFrustum裙+_deco缝线）   |
| `map_editor.html`                       | ~1790 | 地图编辑器核心框架（拆分为6模块）                                           |
| `js/editor_terrainGen.js`               | ~914  | 地形+村落生成（双管线+掩码网格+FloodFill+容量预验证+建筑簇）                |
| `js/editor_genStatus.js`                | ~181  | 生成状态面板（实时进度+统计+质量评分+自动隐藏）                             |
| `js/editor_entities.js`                 | ~653  | 实体管理（标记+CRUD+配置面板+列表+建筑朝向）                                |
| `js/editor_waterBridge.js`              | ~659  | 水体桥梁（水面+河床+桥梁检测）                                              |
| `js/editor_data.js`                     | ~504  | 数据持久化（蓝图+JSON+init）                                                |
| `js/editor_terrainPaint.js`             | ~335  | 地形绘制（笔刷+高度图画布）                                                 |
| `models/t34_v16_builder.js`             | ~1441 | T-34/85 v1.6 动画坦克构建器（含 \_TANK_PROFILE 共享框架）                   |
| `models/tiger_v16_builder.js`           | ~904  | 虎式 I 坦克构建器（MG34+马蹄形炮塔+沙漠迷彩）                               |
| `models/enemies.js`                     | ~1854 | 装甲突击车 + 程序化丧尸（buildHumanoidRig 消费 humanoid_config + RidgeBox + EllipFrustum） |
| `models/buildings.js`                   | ~385  | 建筑模型（3种+category分类+18材质全局化+阴影）                              |
| `models/hexapod_config.js`              |  ~70  | 六足战车模型配置（ANIM_TABLE 23项）                                         |
| `js/hexapod_core.js`                    | ~1188 | 六足CCD IK核心（纯计算层，步态+踉跄+死亡+步进式转向）                       |
| `js/hexapod_factory.js`                 | ~884  | 六足工厂适配器（nodeMap→legRefs+IK测试+转弯验证）                           |
| `js/hexapod_enemy.js`                   | ~328  | 六足游戏适配器（训练场/战斗模式CCD IK+卡住检测）                            |
| `js/hexapod_probe.js`                   | ~208  | 六足步态探针（F7/F8采样+Stats/Compare+localStorage）                        |
| `js/hexapod_aimLine.js`                 | ~295  | 加特林双瞄准线（双段着色+5层碰撞+颜色状态机）                               |
| `js/playerControllers/manager.js`       | ~122  | 玩家控制器管理器（可插拔注册+update分发+能力探测）                          |
| `js/playerControllers/hexapodPlayer.js` | ~1408 | 六足玩家控制器（WASD+加特林+导弹+锁定+AI托管）                              |
| `combat/enemyAI.js`                     | ~1280 | AI 状态机（巡逻→追击→绕圈+六足ENGAGE+武器优先级）                           |
| `combat/scoreSystem.js`                 | ~127  | 积分系统                                                                    |
| `js/fireSmokeParticles.js`              | ~572  | 粒子系统（DamageEffects+ExplosionEffects）                                  |

### model_factory.html 关键行

| 行号 | 内容                                                           |
| :--: | -------------------------------------------------------------- |
| 121  | `buildTaperedBox()` — 独立顶点梯形盒子（7参数含顶面偏移）      |
| 145  | `buildTaperedHex()` — 独立顶点六棱台（7参数含顶面偏移）        |
| 174  | `buildBentBox()` — 弯曲盒（翼子板用）                          |
| 260  | `buildTrackChain()` — 履带链8段路径                            |
| 599  | `T34_85_V16_CONFIG` 坦克完整配置（单行JSON，约40KB）           |
| 601  | `BUILDING_CONFIG` 建筑配置占位                                 |
| 612  | `ENEMY_CONFIG` 敌人配置占位                                    |
| 622  | `MODEL_CONFIGS` 模型配置字典                                   |
| 857  | `collectAnimRefs()` — 收集动画引用，创建炮塔/炮管/MG/轮子pivot |
| 1123 | `toggleAnimShowcase()` — 动画展台开关                          |
| 1170 | `destroyAnimPivots()` — 停止动画时清理pivot还原场景层级        |

---

## T-34/85 v1.6 坦克配置

### 坐标系

Y=上，Z=前（炮管方向）。根节点 `position: [0, -0.15, 0]`，`scale: [0.5, 0.5, 0.5]`。

### 层级结构（4大Group）

```
T-34/85 v1.6 (Root)
├── 车体 (Group) — 下车体/上车体/发动机舱/翼子板/油箱/排气管/大灯等
├── 左履带总成 (Group) — 5负重轮 + 主动轮 + 诱导轮 + 履带链
├── 右履带总成 (Group) — 同上（对称）
└── 炮塔总成 (Group)  [position: 0,-0.15,-0.5]
    ├── 炮塔座圈
    ├── 炮塔主体 (TaperedHex)
    ├── 指挥塔 / 装填手舱盖
    ├── 炮管总成 (Group) — 炮盾/炮管根部/主炮管/炮口加强段/同轴机枪
    ├── 高射机枪 (Group)  [position: -0.2,2.77,0.9]
    │   ├── MG枪座底板 / MG枪座支柱 / MG枪身 （固定基座）
    │   ├── MG枪管 Y=0.295 / MG枪口制退器 Y=0.295 / MG准星座 Y=0.305
    │   └── MG弹链箱 / MG盾牌
    ├── 左扶手 / 右扶手
    ├── 左烟雾弹架 / 右烟雾弹架
    └── 天线基座
```

### 几何体类型

| 类型       | 参数                                     | 说明               |
| ---------- | ---------------------------------------- | ------------------ |
| Box        | `size:[w,h,d]`                           | 标准立方体         |
| Cylinder   | `size:[rTop,h,rBottom]`, `segments:[n]`  | 圆柱/锥形          |
| Sphere     | `size:[r]`, `segments:[w,h]`             | 球体               |
| Torus      | `size:[R,r]`, `segments:[rSeg,tSeg]`     | 圆环               |
| TaperedBox | `size:[bw,h,bd,tw,td,ox,oz]`             | 梯形盒（独立顶点） |
| TaperedHex | `size:[bw,h,bd,tw,td,ox,oz]`             | 六棱台（独立顶点） |
| BentBox    | `size:[w,h,d,bendAngle]`, `segments:[n]` | 弯曲盒（翼子板）   |
| TrackChain | `trackParams:{...}`                      | 履带链8段路径      |

### 材质字典（8种）

`steel` / `dark_steel` / `barrel_steel` / `rubber` / `camo_green` / `camo_dark` / `camo_desert` / `wood`

### 视觉效果规则

- **所有几何体使用独立顶点**（每面4个顶点独立计算法线，不共享）— 消除菱形纹路
- **不使用 flatShading**（默认为 smooth shading）
- **DoubleSide** 仅当材质 emissiveIntensity > 0 时启用（暗钢/炮钢/橡胶有微自发光）

---

## 玩家操作方式（v0.39.0+ WASD + 鼠标瞄准）

### 键盘/鼠标（单人/1P）

| 按键     | 功能                       |
| -------- | -------------------------- |
| W / S    | 前进 / 后退                |
| A / D    | 左转 / 右转                |
| W+A/W+D  | 前进中转向                 |
| 鼠标移动 | 瞄准（十字准星跟随指针）   |
| 鼠标左键 | 主炮射击                   |
| Space    | 预留（同轴机枪，暂未绑定） |
| ESC      | 返回菜单                   |

### 手柄（单人/2P）

| 按键       | 功能                        |
| ---------- | --------------------------- |
| 左摇杆 Y/X | 前进后退 / 左右转向         |
| 右摇杆 X   | 炮塔旋转（摇杆幅度→速度）   |
| 右摇杆 Y   | 炮管俯仰（-10°/+25°硬限制） |
| RT         | 主炮射击                    |
| LT         | 预留（同轴机枪，暂未绑定）  |

### 瞄准系统

- **键鼠**: 十字准星跟随鼠标，绿=可命中（射程内+无遮挡+角度可达），红=不可命中
- **手柄**: 弹道预测线（抛物线弧线，遇障碍截断），右摇杆直接控制炮塔/炮管旋转速度
- **重力补偿**: 瞄准角自动计算重力下坠，抬高炮管补偿
- **炮塔延迟**: 旋转~~30°/s，俯仰~~20°/s，有真实机械延迟感

---

## 动画展台系统 🎬

### 5种动画动作

| 动作        | 描述                                | 驱动参数                                                                      |
| ----------- | ----------------------------------- | ----------------------------------------------------------------------------- |
| 1. 炮塔旋转 | 360° 持续旋转                       | turretPivot.rotation.z（左炮塔总成）<br>turretPivotR.rotation.z（右炮塔总成） |
| 2. 炮管俯仰 | +25°(上仰) ~ -10°(下垂) 正弦摆动    | barrelPivot.rotation.x（取反）                                                |
| 3. 高射机枪 | 水平旋转 + 垂直俯仰（仅上部可动件） | mgPivot.rotation.y + mgPivot.children[0].rotation.x                           |
| 4. 前进     | 所有轮子正转 + 履带滚动             | wheelPivots[i].rotation.y（rotateY）                                          |
| 5. 后退     | 所有轮子反转 + 履带反向             | 同上前进，方向取反                                                            |

### 动画Pivot生命周期

```
collectAnimRefs()  → 创建pivot，重新挂载节点（修改场景层级）
toggleAnimShowcase() 开启 → 启动动画循环
toggleAnimShowcase() 关闭 → destroyAnimPivots() 还原层级
rebuildModel() → 不自动调用 collectAnimRefs()（避免污染配置）
```

### 炮管俯仰极限

- **上仰**: +25° (0.436 rad)
- **下垂**: -10° (-0.175 rad)
- 在 index.html 和模型工厂中均需保持一致

### 轮子螺栓标记

- 诱导轮：5个红点螺栓
- 负重轮 / 主动轮：7个红点螺栓
- 通过 `addWheelBolts()` 在动画模式下添加到轮子表面

---

## 配置固化流程

**即："在GUI编辑 → 固化到源码" 的标准操作**

```
1. 在 model_factory.html 的 GUI 面板中调整参数
2. Ctrl+S 将当前状态保存到 localStorage（自动触发 JSON 导出下载）
3. 从下载的 JSON 文件中提取 T34_85_V16_CONFIG
4. 替换 model_factory.html 第599行的配置
5. 同步更新 models/t34_v16_builder.js 中的配置数据（如有变化）
```

**注意**：动画Pivot相关的 `userData.animTurretPivot` 等字段会污染导出的JSON配置，导入后需要清理这些字段，只保留 `name/type/size/position/rotation/scale/materialId/segments/color/visible/trackParams` 等核心字段。

---

## 版本号同步清单（每次更新必须 8 处同步）

1. `index.html` `<title>` 标签
2. `index.html` `.menu-version` 菜单显示
3. `index.html` `.changelog` 追加记录（⚠️ 只保留最近5条，多余删除）
4. `index.html` 调试信息版本号
5. `index.html` `console.log` 版本号
6. `README.md` 开头版本号
7. `README.md` 版本历史追加
8. `README.md` 代码规模注释

**Git 提交格式**: `vX.Y.Z: 描述`

**菜单 changelog 裁剪**：只保留最近 5 条 `cl-title`，多余的必须删除，否则撑破菜单。

---

## 当前版本（v0.79.36 — 校园丧尸实装(刷怪补cfg/血条/动画/死亡+清旧测试怪)/碾压修复(碰撞推离前判定+尸体不挡车)/瞄准设置(世界指向/车体指向)/地图切换碰撞清理(清campus全局引用)/Torus修复(眼镜项链可见+中梁贴脸+死亡平滑下沉)/树冠关视锥剔除/换弹防Q重复/旧丧尸Attack修复；v0.79.35 丧尸步态交叉循环+教师裤管修正+短裤白缝线）

### 关键参数

| 参数            | 值                                                                                             |
| --------------- | ---------------------------------------------------------------------------------------------- |
| 世界尺寸        | worldWidth×worldDepth（可配置，默认300×300）                                                   |
| 游玩尺寸        | playWidth×playDepth（空气墙，默认200×200）                                                     |
| index.html 行数 | ~1178 行                                                                                       |
| engine.js 行数  | ~8255 行                                                                                       |
| 总源码行数      | ~50,300 行（51 个源文件）                                                                      |
| 编辑器模块      | 6个：terrainGen(914)+genStatus(181)+entities(653)+waterBridge(659)+data(504)+terrainPaint(335) |
| 六足系统        | core(1188)+factory(884)+enemy(328)+probe(208)+aimLine(295)+config(70)                          |
| 坦克速度        | MAX_SPEED=8.0 m/s                                                                              |

### 模块优先架构

- 新功能优先以独立 JS 模块加载
- 三个主文件（index/map_editor/model_factory）不宜再增大
- 主文件仅作框架和加载器

### 自动验证

- 代码修改后自动用 Chrome headless CDP 抓取控制台错误
- 无误后才通知用户；有错则自行修复再验证，直到通过

### ⚠️ 不逐轮发版（强制执行，用户 2026-08-16 规定）

每完成一轮修改**不要**自动增加版本号、不要同步 8 处版本号、不要更新 changelog/版本历史/4 份 AI 文档的版本段——这些操作很费 token 和版本号资源。**只有用户明确说出"发版、移交、推送"等命令时才做**完整版本流程（版本号 8 处同步 + changelog 裁剪 + README 版本历史 + 4 文档版本段）。日常修改只需实现 + 验证（Playwright/CDP 0 错误），改动文件说明放在最终汇报里。

### 已知问题 (v0.79.3)

| #   | 问题                                                    | 状态                          |
| --- | ------------------------------------------------------- | ----------------------------- |
| 1   | ~~首次切校园丧尸白模~~                                  | v0.79.3 已修复                |
| 2   | ~~衣物不随 build 变粗穿模~~                             | v0.79.3 已修复                |
| 3   | ~~男教师裤子像短裤~~                                    | v0.79.3 已修复                |
| 4   | ~~步态方向反/前踢后蹬等幅~~                             | v0.79.3 已修复                |
| 5   | ~~展台沉地 + Die 后变形~~                               | v0.79.3 已修复                |
| 6   | ~~女生裙长到脚脖子/迈步穿模~~                           | v0.79.3 已修复                |
| 7   | 裙摆边缘 Run 极限余量 0.025~0.028（已数学覆盖）         | 动态中不可辨                  |
| 8   | `ah_sh_l` 命名冲突（短裤裤腿 vs 鞋，findNode 取第一个） | 渲染无影响，测试用 \_addonKey |
| 9   | avg fps 41.5 仍非稳定 60（剩余 GC 20ms）                | 待 P-burst-3                  |
| 10  | 坡地一头翘起一头陷地（坦克/敌人偶发）                   | 待修复                        |
| 11  | 对山丘目标弹道偏低                                      | 待修复                        |
| 12  | 六足武器俯仰旋转轴不正确                                | 待校准                        |

### 待完成任务

| #   | 任务                                                | 优先级  |
| --- | --------------------------------------------------- | :-----: |
| 1   | P-burst-3：炮弹 mesh/ringFX/ExplosionEffects 对象池 | 🟡 近期 |
| 2   | 建筑 IM 跨 category 共享材质（18→~15，可选）        | 🔵 远期 |
| 3   | 完善地形适配（翘头/陷地）                           |   🟡    |
| 4   | 六足武器俯仰校准                                    |   🟡    |
| 5   | PvE Phase 5：清空积分UI按钮 + 局内HUD               | 🟡 中期 |
| 6   | 同轴机枪功能                                        | 🟡 中期 |
| 7   | PvE Phase 6：精英单位 + Boss 炮舰                   | 🔵 远期 |
| 8   | 树木/建筑LOD系统                                    | 🔵 远期 |

---

## 开发交接规范

当工作完成需要推送时：

```bash
git add -A
git commit -m "vX.Y.Z: 描述"
git push origin master        # Gitee 主仓库
git push github master        # GitHub 备用（失败可跳过）
```

同步后更新 `CODEBUDDY.md`（参数表、架构、已知问题）和 `.trae/rules/project_rules.md`（规则、文件行数）。
