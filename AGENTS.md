# AGENTS.md — 坦克对战 Demo (Codex 专属)

> 3D 坦克对战游戏 | Three.js r160 | v0.60.3 | Codex 协作指引

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

## 当前版本关键参数 (v0.60.3)

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

1. **狙击模式** - 右键切换第一人称，FOV25°精瞄，自由观察，炮口跟随，退出cameraYaw对齐炮管
2. **俯视小地图** - 左下角线框车体+三角车首，上方=摄像机朝向，HP红→绿
3. **动态天空 sky.js** - 倒置球体渐变穹顶+两层FBM噪声云飘移，太阳光晕，零纹理
4. **围墙移除** - 天空穹顶+雾替代，camera far/fog按地图缩放
5. **六足复活腿部冻结修复** - _processTrainingRespawn补回HexapodEnemy.init()
6. **六足复活后退修复** - retreating条件radialW< -0.3（原>0.3反了）
7. **六足复活导弹弹药重置** - _missileAmmoL/R=4
8. **武器优先级重构** - 过热优先后退+导弹，导弹15~50m窗口，加特林过热停转

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
