# 六足战车动画 — AI 状态机用途规划

> 状态: 基础动画已实现(7个), 转弯动画待修复(6个), AI 集成待 v0.55+  
> 最后更新: v0.54.x (2026-06-05)

## 动画列表

| # | 动画名 | Duration | 方向 | turnRate | 参数 |
|---|--------|----------|------|----------|------|
| 0 | 待机 Idle | 3500ms | 原地 | 0 | body bob ±0.08, 6腿CCD锁锥尖 |
| 1 | 步行 Walk | 1500ms | 前进 -X | 0 | stride=0.22, stepH=0.15, ccdIters=15 |
| 2 | 奔跑 Run | 800ms | 前进 -X | 0 | stride=0.38, stepH=0.24, ccdIters=30 |
| 3 | 步行后退 Walk Back | 1600ms | 后退 +X | 0 | stride=0.18, stepH=0.12, ccdIters=15 |
| 4 | 奔跑后退 Run Back | 900ms | 后退 +X | 0 | stride=0.28, stepH=0.18, ccdIters=30 |
| 5 | 左平移 Strafe Left | 1700ms | 左移 +Z | 0 | stride=0.14, stepH=0.10, ccdIters=15 |
| 6 | 右平移 Strafe Right | 1700ms | 右移 -Z | 0 | stride=0.14, stepH=0.10, ccdIters=15 |
| 7 | **静态左转 Turn Left** | 2000ms | 前进 -X | **+1.5** | stride=0.10, stepH=0.08, 原地旋转 |
| 8 | **静态右转 Turn Right** | 2000ms | 前进 -X | **-1.5** | stride=0.10, stepH=0.08, 原地旋转 |
| 9 | **步行左转 Walk Turn L** | 2000ms | 前进 -X | **+1.2** | stride=0.10, 前进+左转弧线 |
| 10 | **步行右转 Walk Turn R** | 2000ms | 前进 -X | **-1.2** | stride=0.10, 前进+右转弧线 |
| 11 | **左移右转 Strafe L Turn R** | 2000ms | 左移 +Z | **-1.0** | stride=0.14, 侧移+右转绕圈 |
| 12 | **右移左转 Strafe R Turn L** | 2000ms | 右移 -Z | **+1.0** | stride=0.14, 侧移+左转绕圈 |

### 方向编码 (_hexaAnimDirections + _hexaAnimTurnRates)

```
direction:  0=原地  ±1=X轴(前/后)  ±2=Z轴(左/右平移)
turnRate:   0=直行  ±1.5=静态转  ±1.2=步行转  ±1.0=平移转  (rad/s)
```
任意 direction + turnRate 可正交组合，引擎层面无需遍历排列。

## AI 状态机集成方案

### 敌人 AI（hexapod_enemy）

| AI 状态 | 推荐动画 | 触发条件 | 说明 |
|---------|----------|----------|------|
| PATROL | Walk | 沿巡逻路径移动 | 慢速巡逻 |
| CHASE | Run | 发现玩家，距离 > engageDist | 全速追击 |
| **ENGAGE** | **Strafe + Turn 组合** | 进入攻击距离 | **核心：侧移绕圈+旋转保持炮口朝向** |
| ENGAGE (距离过近) | Walk Back | dist < ideal×0.6 | 后退拉开 |
| ENGAGE (距离偏远) | Run + Turn | dist > ideal×1.3 | 弧线逼近 |
| FLEE | Run Back | 血量过低 | 全速后退 |
| SEARCH | Walk + 静态Turn | 丢失目标 | 慢速移动+转向搜索 |
| AIM (新状态) | **静态左/右转** | 调整炮口朝向 | 原地旋转瞄准，无需移动 |
| STAGGER | Idle | 受击硬直 | 腿锁定 |

### ENGAGE 状态详细设计（预期 v0.55+）

当前 `enemyAI.js` 的 ENGAGE 状态使用履带车辆物理（先转向再前进），不适用于六足战车。六足版应在 ENGAGE 中利用平移动画实现真侧移：

```
┌─────────────────────────────────────────────┐
│ 六足 ENGAGE 行为循环                          │
│                                              │
│  攻击距离内 → 选择绕圈方向(左/右)              │
│  使用 Strafe Left/Right 横移绕圈             │
│  + 炮塔/武器独立瞄准玩家                       │
│                                              │
│  距离 < 理想×0.6 (太近):                      │
│    → Walk Back 后退拉开距离                   │
│                                              │
│  距离 > 理想×1.3 (偏远):                      │
│    → Run 前追拉近距离                         │
│                                              │
│  ~2.5s 随机切换绕圈方向                       │
│  每切换方向时 ~30% 概率混合 Walk Back          │
│   制造不规则的 Z 字形规避弹道                   │
└─────────────────────────────────────────────┘
```

### 倒退用途（已实现，待集成）

| 动画 | AI 场景 | 战术价值 |
|------|---------|----------|
| Walk Back | ENGAGE 距离过近时后退 | 保持攻击距离，面朝玩家边退边打 |
| Run Back | FLEE 逃跑 / ENGAGE 规避 | 快速脱离危险区域 |
| Walk Back | 被我方六足追击时周旋 | 我方获取六足后，PvE 怪物也可周旋 |

### 平移用途（已实现，待集成）

| 动画 | AI 场景 | 战术价值 |
|------|---------|----------|
| Strafe Left | ENGAGE 绕圈攻击 | 绕玩家逆时针转，侧向火力持续输出 |
| Strafe Right | ENGAGE 绕圈攻击 | 绕玩家顺时针转，~30%概率躲避炮弹 |
| 左右交替 | ENGAGE 规避模式 | 不规则Z字形侧移，扰乱玩家预判 |

## 玩家使用场景（未来）

当玩家收集足够六足碎片、制作出六足战车后：

| 操作 | 动画 | 说明 |
|------|------|------|
| W | Walk | 前进 |
| S | Walk Back | 后退（边退边打） |
| A | Strafe Left | 左平移 |
| D | Strafe Right | 右平移 |
| Shift+W | Run | 奔跑前进 |
| Shift+S | Run Back | 奔跑后退 |

## 实现状态

- [x] **7 基础动画已实现** (Idle/Walk/Run/WalkBack/RunBack/StrafeL/StrafeR)
- [~] **6 转弯动画骨架已就位** (StaticTurn/WalkTurn/StrafeTurn × L/R)
  - CCD 改造: 支持 `damp` 参数 (转弯用 0.8)
  - 髋距 `_hipDist` 替代脚距防止径向漂移
  - 转弯测试 `toggleHexTurnTest` 可独立验证
  - **已知问题**: 静态转弯右前腿拖行，疑似腿铰链伸展极限
  - http://127.0.0.1:8080/model_factory.html → 🔁 转弯验证 可调试
- [x] turnRate 系统: direction + turnRate 正交组合
- [x] 动画列表 UI 改版 (右侧→左侧垂直滚动面板, 分类分隔)
- [x] 部件树默认折叠 + 选中时自动展开路径
- [x] CDP 验证按文件区分 DOM 检查
- [ ] 敌人 AI 六足状态机 (enemyAI.js hexapod 分支)
- [ ] 玩家六足驾驶映射
