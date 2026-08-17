# AGENTS.md — 坦克对战 Demo (Codex 专属)

> 3D 坦克对战游戏 | Three.js r160 | v0.79.35 | Codex 协作指引

## 启动

```powershell
Get-Process python -ErrorAction SilentlyContinue | Stop-Process -Force
python -m http.server 8080 --bind 127.0.0.1
```
访问 `http://127.0.0.1:8080`（必须 127.0.0.1，禁止 localhost）

## 交流语言

- **思考过程用中文**
- **反馈对话用中文**
- 代码注释不写（除非明确要求）

## 协作工具

本仓库同时由 4 个 AI 工具协作开发，各有专属文档：

| AI 工具 | 专属文档 | 职责偏重 |
|---------|---------|---------|
| **Codex** (当前) | `AGENTS.md` | 即时修复、调试排查 |
| Claude Code | `CLAUDE.md` | 架构级重构、复杂新功能 |
| CodeBuddy | `CODEBUDDY.md` | 详细参数表、已知问题清单 |
| Trae | `.trae/rules/project_rules.md` | 跨会话规则、文件行数 |

⚠️ 修改任意一个专属文档后，应同步更新其他 3 个的相关部分。

## 关键文件

| 文件 | 核心功能 |
|------|---------|
| `index.html` | 主入口，加载所有 JS 模块 |
| `js/engine.js` | 游戏引擎（状态机/场景/物理/训练场/重生） |
| `combat/enemyAI.js` | 敌人 AI 状态机 + 视线检测 + 迂回逻辑 |
| `js/shells.js` | 炮弹参数（SHELL_SPEED/SHELL_GRAVITY） |
| `js/mg.js` | 机枪系统 |
| `js/obstacles.js` | 障碍物生成/可见性/销毁 |
| `model_factory.html` | 程序化模型编辑器 |

## 版本号同步（每次更新必须 8 处）

1. `index.html` `<title>`
2. `index.html` `.menu-version`
3. `index.html` `.changelog`（只保留最近 5 条 cl-title）
4. `index.html` 调试信息版本号
5. `index.html` console.log 版本号
6. `README.md` 开头版本号
7. `README.md` 版本历史追加
8. `README.md` 代码规模注释

Git 提交格式: `vX.Y.Z: 描述`

### ⚠️ 不逐轮发版（强制执行，用户 2026-08-16 规定）

每完成一轮修改**不要**自动增加版本号、不要同步 8 处版本号、不要更新 changelog/版本历史/4 份 AI 文档的版本段——这些操作很费 token 和版本号资源。**只有用户明确说出"发版、移交、推送"等命令时才做**完整版本流程（版本号 8 处同步 + changelog 裁剪 + README 版本历史 + 4 文档版本段）。日常修改只需实现 + 验证（Playwright/CDP 0 错误），改动文件说明放在最终汇报里。

## 当前版本关键参数 (v0.79.35)

| 参数 | 值 | 位置 |
|------|----|------|
| 坦克最大速度 | 8.0 m/s | engine.js MAX_SPEED |
| 敌人训练场速度 | 6.0 | engine.js enterTrainingMode |
| 炮弹初速 | 50.0 m/s | shells.js SHELL_SPEED |
| 炮弹重力 | 1.0 m/s² | shells.js SHELL_GRAVITY |
| 敌人炮塔转速 | 1.0 rad/s | enemyAI.js aimTurretAt |
| 装填时间 | 2.0s | shells.js RELOAD_TIME |
| 训练场敌方 HP | 100 (坦克) | engine.js enterTrainingMode |
| 阴影贴图 | 512×512 | engine.js initScene |

## 本次会话已完成的工作

1. **基础骨架动画直立化** - REST_POSES + 4 骨架版本驼背基线(torso:x/neck:x/head:z)归零，骨架(共通)Idle/Walk/Run 直立
2. **丧尸驼背烘焙注入** - MODELS anims 从版本深拷贝后注入 ZOMBIE_HUNCH(0.2/0.22/0.08)，游戏丧尸视觉不变
3. **legacy 树静态驼背归零** - HUMANOID_BASE 三节点固化 rotation 归零，消除双重驼背
4. **hunch 参数语义** - deriveNode 改 `+hunch` 直接叠加（0=直立，正值=驼背量）
5. **模型菜单更名** - 工厂选择模型菜单"🧟 校园丧尸"→"🧍 人形敌人"（内部键 humanoid 不变，管线零改动）
6. **变体名加后缀** - 工厂变体下拉四变体加"·校园丧尸"后缀（改 HUMANOID_VARIANTS.name，仅工厂消费）
7. **攻击拆分挥击+拳击** - Attack→Swing 改名 + 新增 Punch 右直拳动画（13 轨道：扭腰/前后站架/护脸/爆发直拳）
8. **拳击力度增强** - 蓄力极限肘拉到躯干后方（上臂后摆0.85+屈肘-2.05），爆发摆幅2.25rad+扭腰0.84rad
9. **跑步摆臂屈肘90°** - Run 新增 l/r_forearm 轨道（前摆甩开77°/后摆收紧97°），Walk 直臂不变；顺带修切动画关节残留
10. **奔跑前臂中线内收** - Run 前臂 z 轴轨道（前摆收 0.20/后摆微收 0.06，左右反相）
11. **Walk 步距不均修复** - r_upper_leg 相位错 0.25（应半周期）→ 左右踝极值严格交替等距 44 帧；pelvis 单峰改双峰
12. **跑步前臂上弯** - forearm 加深（后摆-2.10/前摆-1.55），净前弯全程≥90°，最低点不低于水平，拳指下巴前方
13. **奔跑前迈膝弯** - 前迈极限膝 -0.3 过伸→+0.5 弯折（L 形），着地缓冲 0.25，折叠期 1.85 保留
14. **四变体新骨架烘焙** - 学生(儿童)/教师男(成年男)/教师女(成年女性)骨架+衣服发型 addon；丧尸专属动画（无拳击/佝偻/拖行/奔袭前伸臂）；游戏直连新树去镜像
15. **addon 适配新骨架** - 教师女去楔形胸臀；鞋 0.118 贴脚；发型 r0.118+双面渲染；配饰 snap 机制按躯干前表面自动贴胸
16. **发型露眼/裙动画/死亡裙没地** - 发型后倾 -0.35 露眼；裤裙配饰收小；裙摆动轨道（P/O 表扩展）；Die 裙 position.z 下沉没地；修 Cylinder segments 数组空几何 bug
17. **骨盆裤裙同色+死亡整体下沉** - pelvis 材质=PELVIS_CLOTH；Die 姿势不变仅降高度（root 按骨架 0.1/0.04/0.12），躯干贴地+裙摆自然没入
18. **饰物降位缩尺寸+教师下躯干裤裙色+刘海露眼** - snap pivot 补偿（-0.145）饰物落胸口；领带 0.15/校徽 0.045；torso_lower 裤裙色；刘海分两块缺口
19. **裤裙缩短+切动画裙上移修复+领巾缩+刘海加宽** - 教师裤 0.46/0.35；裙 0.32/0.38；collectRefs 裙 position.y 清零删；领巾结 0.03；刘海 ±0.115/宽 0.045/y0.055
20. **短裤上移盖骨盆+发髻加大** - shorts_m position -0.06（渲染含 +0.2 补偿方向注意）；bun_f 0.075/后凸 0.069
21. **四变体穿上衣+平面血迹+刘海圆弧** - VARIANT_TOP（白polo/蓝衬衫/粉T恤）；DUAL_LIMB_ADDONS 袖子双挂；血迹=薄Box交叠；刘海贴球面点+绕Y朝向头心
22. **袖子盖肩+血迹贴图化** - 短袖 0.22 上移盖肩；血迹改 Canvas 贴图（makeBloodyCloth 三张）；自定义几何补 UV；删血迹几何
23. **红领巾贴颈+袖粗+袖口归位** - red_scarf Group z 0.1 旧树遗留值致悬空→0.008；袖 gap 0.004；polo_cuff 改挂上臂末端
24. **女裙收窄（v0.79.34）** - 裙摆轨道 0.35×大腿跟腿耦合（旧反相后仰帮倒忙）+锥心 z+0.02+gapBottom 0.13 → rBottom 0.247/0.277→0.187（全宽减 1/3）
25. **裙圆台化+椭圆顶（v0.79.34）** - 圆锥→圆台 rTop 0.157 包裹骨盆（修骨盆下 -0.048 腿刺穿带+裙排除 wrapMax）；顶面椭圆 rx0.157×rz0.105（新 EllipFrustum 几何两侧同步）腰部圆弧凸出-62%；学生裙 0.295 膝上5cm；骨盆顶深/衬衫底面钳制防角刺出
26. **丧尸步态交叉循环（v0.79.35）** - Walk/Run 腿×4 轨道重设计：后蹬窗严格错开（旧重叠~1/4周期双蹬相）、支撑膝伸直蹬地、摆动膝抬脚 0.62/0.85、瘸拖特征保留（右幅值减半+膝恒僵）；幅值在裙包络内余量 0.020/0.011
27. **教师裤管修正（v0.79.35）** - v0.79.29 漏算 childComp=−pivot 补偿：大腿段 0.46→0.32/position −0.115→−0.042，膝下 0.172 超长→0.052；真实膝=ll.pos−ulPivot+llPivot
28. **男学生短裤白缝线（v0.79.35）** - shorts_m 加 ah_sm_seam 装饰子节点；applyWrapScale 支持 _deco（尺寸不改写+x吸附wrap半宽）；firstWrapNode 修 wrapMax 收集
29. **legacy 树镜像修复** - 游戏树 l_/r_ 与工厂树镜像，enemies.js 消费时 rotation y/z 取负（Die 双臂外张隐性 bug 顺带修复）
30. **Gitee 拉取修复** - git schannel 后端 SEC_E_NO_CREDENTIALS，仓库级配置改 openssl 后端

## 已知问题（待下个会话处理）

| # | 问题 | 严重度 |
|---|------|:------:|
| 1 | 坡地一头翘起一头陷地（地形适应不平滑） | 🟡 |
| 2 | 对山丘目标弹道偏低 | 🟡 |
| 3 | 六足武器俯仰旋转轴不正确（待校准） | 🟡 |

## 提交与推送

```bash
git add -A
git commit -m "vX.Y.Z: 描述"
git push origin master      # Gitee
git push github master      # GitHub (失败可跳过)
```

同步后更新所有 4 个 AI 专属文档和 README.md。
