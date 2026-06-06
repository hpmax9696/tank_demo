# 六足战车（Hexapod）实现计划

## 上下文

在现有坦克对战游戏中新增精英级敌人类型——六足战车。用户已提供AI场景概念图、腾讯混元3D白模(GL B)和多角度截图。
目标是创建程序化模型（可在模型工厂中微调）+ AnimationSystem动画 + AI集成。

### 用户确认的设计参数

- **武器**：仅两挺加特林机炮 + 两个导弹/火箭巢，左右侧各一套
- **武器旋转**：仅俯仰（pitch），不能左右旋转；水平瞄准靠车体转向
- **顶部**：球形观瞄设备，不是炮塔/炮管
- **腿部**：每条腿髋2轴(水平摆动+上下抬腿)+膝1+踝1，共4自由度
- **步态**：三角步态（3腿支撑3腿摆动交替）
- **尺寸**：中型 总高~2.5m（车身~1m + 腿~1.5m）
- **配色**：深灰装甲 + 关节处黄色警示条纹

### 素材分析结论（来自GLB白模+9张多角度截图）

- GLB：单mesh ~24,836顶点，包围盒 0.76×0.70×0.69m，对称结构
- 六足分三对：前(FL/FR Z≈±0.28)、中(ML/MR Z≈0)、后(RL/RR Z≈-0.31)
- 车身中央区宽~0.36m，顶部隆起结构（观瞄）在 Y>0.5m 区域
- 需放大~3.3倍达到目标尺寸

---

## 实施计划

### Phase 1：模型配置 `models/model_configs.js`

添加 `HEXAPOD_CONFIG` 到 IIFE 并导出。

```
HexapodRoot (Group, scale按需)
├── chassis (Group) - 车身装甲
│   ├── lowerHull (TaperedBox) - 船形底盘 前窄后宽
│   ├── upperHull (TaperedBox) - 上层装甲
│   ├── frontArmor (Box倾斜) - 前部楔形装甲
│   ├── rearPlate (Box) - 后装甲板
│   ├── obsDome (Sphere) - 顶部观瞄球体
│   ├── domeNeck (Cylinder) - 观瞄底座
│   └── visionSlit (Box) - 前部观察缝
│
├── weapon_L_shoulder (Group) - 左侧武器平台
│   ├── weapon_L_gatling (Group, pivot俯仰) - 加特林机炮
│   │   ├── shroud (Cylinder)
│   │   └── barrels (Cylinder×4)
│   └── weapon_L_missile (Group, pivot俯仰) - 导弹巢
│       ├── podHousing (Box)
│       └── tubes (Cylinder×4)
│
├── weapon_R_shoulder (Group) - 右侧武器平台(镜像)
│   ├── weapon_R_gatling (Group, pivot俯仰)
│   └── weapon_R_missile (Group, pivot俯仰)
│
├── leg_FL (Group, pivot Z=髋水平摆动) - 左前腿
│   ├── thigh (TaperedBox, pivot=髋上下抬腿)
│   │   ├── shin (TaperedBox, pivot=膝)
│   │   │   ├── ankle (pivot=踝)
│   │   │   │   └── foot (Box - 宽大脚掌)
│   │   │   └── kneeCap (Sphere - 装饰)
│   │   └── hipDeco (Sphere)
│   └── warningStripe (Box - 黄色警示条)
│
├── leg_FR (Group) - 右前腿(镜像Z)
├── leg_ML (Group) - 左中腿(镜像Z, 位置不同)
├── leg_MR (Group) - 右中腿
├── leg_RL (Group) - 左后腿
└── leg_RR (Group) - 右后腿
```

新增材质：`armor_dark`(#3A3A44), `armor_light`(#5A5A6A), `warning_yellow`(#E8A820+emissive)

### Phase 2：模型工厂集成 `model_factory.html`

- `MATERIAL_DEFS` 新增 3 种材质
- 模型下拉菜单新增 `'🦗 六足战车':'hexapod'`
- 导入 `window.ModelConfigs.HEXAPOD_CONFIG`

### Phase 3：敌人模型+动画 `models/enemies.js`（核心文件）

#### 3a: 私有配置副本
在 enemies.js 内嵌入 `HEXAPOD_MODEL_CONFIG`（避免依赖 model_configs.js）

#### 3b: `buildHexapodFromConfig(config, parent)`
递归构建函数，复用 pivot 补偿算法，与 buildZombieFromConfig 同模式。

#### 3c: `createHexapodAnimationSystem(root)`
AnimationSystem 实例注册 9 种动画。

**三角步态分组：**
| 组A（支撑 0~0.5，摆动 0.5~1.0） | 组B（摆动 0~0.5，支撑 0.5~1.0） |
| FL, MR, RL | FR, ML, RR |

**动画列表：**

| 动画 | 时长 | 说明 |
|------|------|------|
| Idle | 2.0s | 车身微呼吸+腿部微动 |
| MoveForward | 1.2s | 三角步态前进，车身上下弹跳 |
| MoveBackward | 1.2s | 三角步态后退（X旋转反向） |
| TurnLeft | 1.5s | 左侧腿加大外摆+右侧腿缩小，差速转向 |
| TurnRight | 1.5s | 镜像 TurnLeft |
| StrafeLeft | 1.0s | 所有腿Z轴偏向同侧，螃蟹步横移 |
| StrafeRight | 1.0s | 镜像 |
| Attack | 0.8s | 加特林俯仰震动+枪管旋转+车身后坐力 |
| Death | 2.0s | 前倾→瘫软→沉底，四肢外展 |

每条腿控制4个目标：
- `leg_XX` (Group) → rotation.z = 髋水平摆动
- `leg_XX_thigh_pivot` → rotation.x = 髋上下抬腿
- `leg_XX_shin_pivot` → rotation.x = 膝弯折
- `leg_XX_ankle_pivot` → rotation.x = 踝俯仰

武器控制：
- `weapon_L_gatling_pivot` → rotation.x = 加特林俯仰
- `weapon_R_gatling_pivot` → rotation.x
- `weapon_L_missile_pivot` → rotation.x = 导弹巢俯仰
- `weapon_R_missile_pivot` → rotation.x

#### 3d: `createHexapod()` 工厂函数
模板克隆模式：首次构建→测包围盒→缩放至2.5m总高→深克隆复用。
设置 LOD 骨架组+圆柱占位、AnimationSystem、userData.enemyType。

#### 3e: 全局导出
```javascript
window.EnemyModels.createHexapod = createHexapod;
window.ModelRegistry.register('enemies', '六足战车', makeHexapod);
```

### Phase 4：AI集成 `combat/enemyAI.js`

- 类型检测：`isHexapod` 判断
- 复用载具AI状态机（PATROL/CHASE/ENGAGE/FLEE/STUNNED/DEAD）
- 新增 `updateHexapodEngage()`：
  - **车身转向延迟**：`bodyYaw` 带惯性平滑逼近目标角度（`turnRate` ~1.5 rad/s），不瞬间对准。转向未完成时只允许导弹射击（导弹可离轴发射），加特林必须等车体大致对准
  - **加特林旋转提速**：`spinUp` 0→1 线性累积（~0.8s满速），只有 spinUp>0.9 才能射击；停火后 spinUp 自然衰减
  - **过热设定**：`heat` 0→100，射击时每秒+25，停火每秒-15。heat>80 强制停火冷却，heat=100 时额外承受散热部件损伤（自伤5HP）
  - **子弹散布**：每发子弹在瞄准方向上叠加随机偏移（±3°锥角），距离越远散布越大；burst 首发散布最小，连射越久散布越大（后坐力累积）
  - 武器俯仰追踪（加特林-20~+45°，导弹-10~+60°）
  - 环形走位（circle-strafe）
  - 加特林连射逻辑（射速10发/秒，每发伤害2-4，散步影响实际命中）
  - 导弹间歇发射（4s冷却，伤害25+半径3m爆炸）
- `onEnemyDamaged()` 增加hexapod分支

### Phase 5：游戏引擎集成 `index.html`

- `createEnemies()` 增加 hexapod 分支
- 游戏循环增加 hexapod 动画更新（含LOD三档）
- 死亡动画流程
- 碰撞半径：hexapod=0.6m
- HP条位置：y=2.8m
- 加特林弹丸：高速低伤（复用mg.js tracer）
- 导弹弹丸：低速高伤+小范围爆炸

### Phase 6：地图编辑器集成

**`js/editor_entities.js`**:
- `defaultEnemyCfg('hexapod')` 返回 hexapod 专属配置：
  - HP:100, speed:4.0, viewDist:60, score:200
  - 加特林：spinUpTime:0.8s, overheatMax:100, heatPerSec:25, coolPerSec:15, spreadCone:±3°, damage:3/发, fireRate:10/s
  - 导弹：cooldown:4s, damage:25, blastRadius:3m, minRange:8m
  - 转向：turnRate:1.5 rad/s（~86°/s），完整调头~2秒
- `createEnemyMarker('hexapod')` 宽体+6腿标记
- `enemyNames` 加入 `hexapod:'六足战车'`
- 类型按钮加入 hexapod

**`map_editor.html`**:
- 实体色板加入六足战车选项

---

## 关键文件清单

| 文件 | 变更类型 | 工作量估计 |
|------|----------|-----------|
| `models/model_configs.js` | 新增HEXAPOD_CONFIG (~250行) | 中 |
| `models/enemies.js` | 新增~500行（构建器+动画+工厂） | 大 |
| `model_factory.html` | 修改~15行（材质+下拉） | 小 |
| `combat/enemyAI.js` | 新增~120行（hexapod AI分支） | 中 |
| `index.html` | 修改~80行（生成+动画+弹丸） | 中 |
| `js/editor_entities.js` | 修改~40行 | 小 |
| `map_editor.html` | 修改~5行 | 小 |

---

## 逐阶段自检机制

每个 Phase 完成后强制执行以下检测，有错即修，通过才进入下一阶段。

### Phase 1-2 自检（模型配置+工厂）
1. 打开 `model_factory.html`，切换到六足战车
2. **CDP控制台检查**：`python cdp_verify.py`，0错误才通过
3. **结构完整性**：部件树面板应显示完整的车身→武器→6腿层级，所有 pivot 节点存在
4. **视觉初检**：旋转视角确认车身/腿/武器比例合理，无部件位移异常、无黑面/法线翻转

### Phase 3 自检（动画系统）
1. 模型工厂点"动画展台"→ 手动切换 Idle/MoveForward/Death 等动画
2. **CDP控制台检查**
3. **步态截图**：截取 MoveForward 动画的4个关键帧（t=0, 0.25, 0.5, 0.75）
4. **截图交叉对比**：`python vision.py refs/hexapod/前右侧.png "这张参考图的六足战车腿的姿态和关节弯曲角度如何？"` → 将AI描述与自截图对比，确认：
   - 腿节比例（大腿 vs 小腿长度比）与白模一致
   - 关节弯曲范围合理（不穿透车身、不反向弯曲）
   - 脚掌着地面积合理
5. **武器俯仰范围验证**：加特林-20~+45°，导弹-10~+60°，无穿透车身

### Phase 4 自检（AI）
1. 游戏中接近六足战车，观察 AI 状态切换
2. **CDP控制台检查**
3. **转向延迟验证**：站在侧面，确认车体不是瞬间对准，有明显转动过程
4. **加特林提速验证**：听音效/看枪管旋转，确认有 0.8s 延迟才开火
5. **过热验证**：持续射击~4秒应该停火冷却
6. **子弹散布验证**：远距离观察弹着点是否分散

### Phase 5-6 自检（游戏集成+编辑器）
1. 编辑器中放置六足战车 → 保存蓝图 → 游戏中加载
2. **CDP控制台检查**
3. 多台同屏（3台）FPS ≥ 30
4. LOD切换：远离70m+ 应切换为圆柱占位
5. 击杀→死亡动画→掉落物→消失
6. 与丧尸/突击车混编同场无冲突

### 最终全链路验证
1. `python cdp_verify.py` 全量通过
2. F12 控制台 0 错误 0 警告（忽略 Three.js 自身的 WebGL 提示）
3. 随机地图生成含六足战车 → 完整游玩5分钟无崩溃
