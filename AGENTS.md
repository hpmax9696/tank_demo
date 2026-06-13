# AGENTS.md — 坦克对战 Demo (Codex 专属)

> 3D 坦克对战游戏 | Three.js r160 | v0.59.2 | Codex 协作指引

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

## 当前版本关键参数 (v0.59.2)

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

1. **敌人重生修复** - 训练场敌人死亡后走 _killEnemyInTraining 队列，HP=0 判定死亡
2. **AI 地形遮挡检测** - canSeeTarget 采样路径地形，遮挡时判定为不可见
3. **AI 迂回包抄** - updateChase 视线受阻时侧向迂回，交替左右找射击角度
4. **AI 倒车逻辑** - moveEnemyToward 目标后方不甩头直接倒车
5. **炮塔重力补偿** - aimTurretAt 垂直俯仰含弹道下坠补偿
6. **炮弹速度提升** - SHELL_SPEED 33→50
7. **敌人复活无敌** - _invincibleUntil 保护，防止复活瞬间被击杀
8. **建筑 InstancedMesh 摧毁** - disposeBuildingInstance 缩放至零
9. **遮挡系统移除** - occluderRaycaster/透明树替身/每0.3s检测已删除
10. **地形适应改进** - 采样距离加大 + 平滑过渡 + rotation.order='YXZ'

## 已知问题（待下个会话处理）

| # | 问题 | 严重度 |
|---|------|:------:|
| 1 | 敌人上坡后偶尔不复活（间歇性，根因未定位） | 🔴 |
| 2 | 敌人复活后偶发不追击，原地不动 | 🟡 |
| 3 | 敌人坡地一头翘起一头陷地 | 🟡 |
| 4 | 敌人在山脚对我方山顶坐标开炮，弹道偏低 | 🟡 |
| 5 | 敌人上坡悬浮/俯仰侧倾不平滑 | 🟡 |
| 6 | 敌人只会对山丘开炮，不会主动绕路找角度 | 🟡 |

## 提交与推送

```bash
git add -A
git commit -m "vX.Y.Z: 描述"
git push origin master      # Gitee
git push github master      # GitHub (失败可跳过)
```

同步后更新所有 4 个 AI 专属文档和 README.md。
