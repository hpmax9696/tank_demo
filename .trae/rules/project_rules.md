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

| 页面 | 地址 |
|------|------|
| 主游戏 | `http://127.0.0.1:8080` |
| 模型工厂 | `http://127.0.0.1:8080/model_factory.html` |
| 地图编辑器 | `http://127.0.0.1:8080/map_editor.html` |

**规则**：用 `127.0.0.1` 不用 `localhost`，端口固定 8080，只允许一个 Python 进程。

---

## 关键文件

| 文件 | 行数 | 核心内容 |
|------|:----:|----------|
| `index.html` | ~5365 | 主游戏引擎 |
| `maploader.js` | ~190 | 地图加载模块（蓝图转换+动态加载） |
| `model_factory.html` | ~2640 | 程序化模型编辑器（含 13 动画展台 + 部件树默认折叠 + 转弯验证） |
| `map_editor.html` | ~1800 | 地图编辑器（v0.51.0 拆分为6模块：terrainGen/genStatus/entities/waterBridge/data/terrainPaint） |
| `js/editor_terrainGen.js` | ~750 | 地形+村落生成（双管线+掩码网格+FloodFill+容量预验证+建筑簇） |
| `js/editor_genStatus.js` | ~120 | 生成状态面板（实时进度+统计+质量评分+自动隐藏） |
| `js/editor_entities.js` | ~638 | 实体管理（标记+CRUD+配置面板+列表） |
| `js/editor_waterBridge.js` | ~659 | 水体桥梁（水面+河床+桥梁检测） |
| `js/editor_data.js` | ~503 | 数据持久化（蓝图+JSON+init） |
| `js/editor_terrainPaint.js` | ~335 | 地形绘制（笔刷+高度图画布） |
| `models/t34_v16_builder.js` | ~353 | T-34/85 v1.6 动画坦克构建器（index.html 引用，含 turretPivot/barrelPivot） |
| `models/enemies.js` | ~920 | 装甲突击车 + 程序化丧尸 |
| `models/hexapod_config.js` | ~100 | 六足战车模型配置（3节腿+尖刺足+4DOF） |
| `js/hexapod_anim.js` | ~1630 | 六足动画模块（模型工厂用，23动画+CCD IK+步态+踉跄+死亡） |
| `js/hexapod_enemy.js` | ~890 | 六足敌人动画模块（训练场/战斗模式用，CCD IK+homeOffset定位+三角步态+踉跄+死亡） |
| `combat/enemyAI.js` | ~560 | AI 状态机 + 六足ENGAGE武器平衡 |
| `fireSmokeParticles.js` | ~390 | 粒子系统 |

| AGENTS.md | ~110 | Codex 专属协作文档（v0.61.0） |

### model_factory.html 关键行

| 行号 | 内容 |
|:----:|------|
| 121 | `buildTaperedBox()` — 独立顶点梯形盒子（7参数含顶面偏移） |
| 145 | `buildTaperedHex()` — 独立顶点六棱台（7参数含顶面偏移） |
| 174 | `buildBentBox()` — 弯曲盒（翼子板用） |
| 260 | `buildTrackChain()` — 履带链8段路径 |
| 599 | `T34_85_V16_CONFIG` 坦克完整配置（单行JSON，约40KB） |
| 601 | `BUILDING_CONFIG` 建筑配置占位 |
| 612 | `ENEMY_CONFIG` 敌人配置占位 |
| 622 | `MODEL_CONFIGS` 模型配置字典 |
| 857 | `collectAnimRefs()` — 收集动画引用，创建炮塔/炮管/MG/轮子pivot |
| 1123 | `toggleAnimShowcase()` — 动画展台开关 |
| 1170 | `destroyAnimPivots()` — 停止动画时清理pivot还原场景层级 |

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
| 类型 | 参数 | 说明 |
|------|------|------|
| Box | `size:[w,h,d]` | 标准立方体 |
| Cylinder | `size:[rTop,h,rBottom]`, `segments:[n]` | 圆柱/锥形 |
| Sphere | `size:[r]`, `segments:[w,h]` | 球体 |
| Torus | `size:[R,r]`, `segments:[rSeg,tSeg]` | 圆环 |
| TaperedBox | `size:[bw,h,bd,tw,td,ox,oz]` | 梯形盒（独立顶点） |
| TaperedHex | `size:[bw,h,bd,tw,td,ox,oz]` | 六棱台（独立顶点） |
| BentBox | `size:[w,h,d,bendAngle]`, `segments:[n]` | 弯曲盒（翼子板） |
| TrackChain | `trackParams:{...}` | 履带链8段路径 |

### 材质字典（8种）
`steel` / `dark_steel` / `barrel_steel` / `rubber` / `camo_green` / `camo_dark` / `camo_desert` / `wood`

### 视觉效果规则
- **所有几何体使用独立顶点**（每面4个顶点独立计算法线，不共享）— 消除菱形纹路
- **不使用 flatShading**（默认为 smooth shading）
- **DoubleSide** 仅当材质 emissiveIntensity > 0 时启用（暗钢/炮钢/橡胶有微自发光）

---

## 玩家操作方式（v0.39.0+ WASD + 鼠标瞄准）

### 键盘/鼠标（单人/1P）

| 按键 | 功能 |
|------|------|
| W / S | 前进 / 后退 |
| A / D | 左转 / 右转 |
| W+A/W+D | 前进中转向 |
| 鼠标移动 | 瞄准（十字准星跟随指针） |
| 鼠标左键 | 主炮射击 |
| Space | 预留（同轴机枪，暂未绑定） |
| ESC | 返回菜单 |

### 手柄（单人/2P）

| 按键 | 功能 |
|------|------|
| 左摇杆 Y/X | 前进后退 / 左右转向 |
| 右摇杆 X | 炮塔旋转（摇杆幅度→速度） |
| 右摇杆 Y | 炮管俯仰（-10°/+25°硬限制） |
| RT | 主炮射击 |
| LT | 预留（同轴机枪，暂未绑定） |

### 瞄准系统
- **键鼠**: 十字准星跟随鼠标，绿=可命中（射程内+无遮挡+角度可达），红=不可命中
- **手柄**: 弹道预测线（抛物线弧线，遇障碍截断），右摇杆直接控制炮塔/炮管旋转速度
- **重力补偿**: 瞄准角自动计算重力下坠，抬高炮管补偿
- **炮塔延迟**: 旋转~30°/s，俯仰~20°/s，有真实机械延迟感

---

## 动画展台系统 🎬

### 5种动画动作
| 动作 | 描述 | 驱动参数 |
|------|------|----------|
| 1. 炮塔旋转 | 360° 持续旋转 | turretPivot.rotation.z（左炮塔总成）<br>turretPivotR.rotation.z（右炮塔总成） |
| 2. 炮管俯仰 | +25°(上仰) ~ -10°(下垂) 正弦摆动 | barrelPivot.rotation.x（取反） |
| 3. 高射机枪 | 水平旋转 + 垂直俯仰（仅上部可动件） | mgPivot.rotation.y + mgPivot.children[0].rotation.x |
| 4. 前进 | 所有轮子正转 + 履带滚动 | wheelPivots[i].rotation.y（rotateY） |
| 5. 后退 | 所有轮子反转 + 履带反向 | 同上前进，方向取反 |

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

## 当前版本（v0.61.4 — 六足加特林双瞄准线）

### 关键参数
| 参数 | 值 |
|------|----|
| 世界尺寸 | worldWidth×worldDepth（可配置，默认300×300） |
| 游玩尺寸 | playWidth×playDepth（空气墙，默认200×200） |
| 地图编辑器行数 | ~1762 行（v0.49.0 拆分为5模块，-66%） |
| index.html 行数 | ~767 行 |
| engine.js 行数 | ~5446 行（v0.61.4 PCM传aimTarget+HexapodAimLine.update调用+望天fallback） |
| sky.js 行数 | ~271 行 |
| hexapod_core.js 行数 | ~1055 行（v0.61.1 步进式转向：离散turnRate+身体步态驱动+圆弧预伸+玩家始终分支） |
| hexapod_enemy.js 行数 | ~289 行（v0.61.1 透传targetYaw+玩家跳过resetPose+玩家始终stepGait） |
| hexapod_probe.js 行数 | ~208 行（v0.61.0 新增：步态采样+Stats/Compare+F7F8快捷键+localStorage） |
| hexapod_aimLine.js 行数 | ~260 行（v0.61.4 新增：连续射线双段着色+5层碰撞+颜色状态机） |
| playerControllers/manager.js | ~112 行（v0.61.4 新增hasAimLine探测） |
| playerControllers/hexapodPlayer.js | ~255 行（v0.61.4 加特林俯仰追踪aimTarget+getWeaponAimData+方向取反+matrixWorld时序） |
| 编辑器模块 | 6个：terrainGen(750)+genStatus(120)+entities(645)+waterBridge(659)+data(503)+terrainPaint(335) |
| 地图加载 | maps/_index.json manifest + maps/*.map.json 动态fetch + maploader.js |
| 坦克速度 | MAX_SPEED=8.0 m/s（v0.45.0翻倍） |
| 桥梁引道 | 平整区(deckY) + 内陆斜坡，_carvedCells可撤销，deckY存入蓝图 |
| 河流深度 | 水面=河岸最低-3m，河床=地图最低-10m（排除已挖水体） |
| 水体模块 | waters.js(317行)已拆分，alphaMap遮罩方案替换strip |

### 模块优先架构
- 新功能优先以独立 JS 模块加载
- 三个主文件（index/map_editor/model_factory）不宜再增大
- 主文件仅作框架和加载器

### 自动验证
- 代码修改后自动用 Chrome headless CDP 抓取控制台错误
- 无误后才通知用户；有错则自行修复再验证，直到通过

### 已知问题 (v0.61.4)

| # | 问题 | 位置 |
|---|------|------|
| 1 | 敌人上坡后偶发不复活（间歇性） | engine.js |
| 2 | 敌人复活后偶发不追击 | enemyAI.js |
| 3 | 敌人坡地一头翘起一头陷地 | engine.js 地形适配 |
| 4 | 敌人对山丘目标弹道偏低 | enemyAI.js aimTurretAt |
| 5 | 敌人上坡悬浮/俯仰侧倾不平滑 | engine.js |
| 6 | 山丘遮挡时敌人不主动绕路找角度 | enemyAI.js updateChase |
| 7 | ~~六足玩家转向腿飞~~ **v0.61.1已修** | stepGait 步进式转向(STEP_PERIOD=0.32/MAX_STEP=0.5/IDLE_THR=0.02) |
| 8 | ~~长时间WASD步态漂移~~ **v0.61.1已修** | stepGait 摆动闭环homeW+前瞻 |
| 9 | ~~六足玩家坡地车身不跟随地形~~ **v0.61.2已修** | 4根因: getGroundHeight挂window接通+sD2.0落水过滤+hRgt方向(hFwd×up)+pitch/roll轴(车头-X: rotation.x=侧倾/z=俯仰) |

### 待完成任务 (v0.61.0)

| # | 任务 | 优先级 |
|---|------|:------:|
| 1 | 修复敌人重生间歇性失败 | 🔴 紧急 |
| 2 | 修复敌人复活后不追击 | 🔴 紧急 |
| 3 | 完善地形适配（翘头/陷地） | 🟡 |
| 4 | 敌人绕路找射击角度 | 🟡 |
| 5 | PvE Phase 5：清空积分UI按钮 + 局内HUD | 🟡 近期 |
| 6 | 炮弹/碎片/爆炸对象池（减少GC） | 🟡 中期 |
| 7 | 同轴机枪功能 | 🟡 中期 |
| 8 | PvE Phase 6：精英单位 + Boss 炮舰 | 🔵 远期 |
| 9 | 树木/建筑LOD系统 | 🔵 远期 |

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
