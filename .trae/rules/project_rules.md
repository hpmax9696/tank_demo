# 坦克对战 Demo — 项目规则（Trae 跨会话自动加载）

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
| `index.html` | ~6680 | 主游戏引擎 |
| `model_factory.html` | ~2122 | 程序化模型编辑器（含 T-34/85 v1.6） |
| `map_editor.html` | ~2850 | 地图编辑器 |
| `model_factory.html:766-874` | — | `T34_85_V16_CONFIG` 配置定义 |
| `models/enemies.js` | ~920 | 装甲突击车 + 程序化丧尸 |
| `combat/enemyAI.js` | ~535 | AI 状态机 |
| `fireSmokeParticles.js` | ~390 | 粒子系统 |
| `docs/t34-85-v1.6-for-glm.md` | — | T-34/85 v1.6 给 GLM 的完整开发包 |

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

## T-34/85 v1.6 开发（GLM 当前主任务）

### 完整开发包
先读 `docs/t34-85-v1.6-for-glm.md`（约345行），包含：
- 坐标系约定（Y=上，Z=前=炮管方向）
- 6种几何体格式（TaperedBox/TaperedHex 支持 7元素 size 含顶面偏移）
- 材质字典（8种 materialId）
- 44部件完整配置 + 8段TrackChain履带路径
- r18 当前参数表 + r19 待解决问题

### 标准迭代
```
1. 杀残留进程 → 启动 python http 服务
2. 打开 model_factory.html → 下拉菜单选「T-34/85 (v1.6 AI版)」
3. 切换正交视图 📐，查看左/前/右/后/顶五视图
4. F12 Console 查看 TrackChain 8段诊断（闭合误差应 < 0.01）
5. 发现偏差 → SearchReplace 修改 model_factory.html:766-874 行
6. Ctrl+F5 刷新验证 → 继续迭代
```

### 调试配色（保留，确认结构无误后删除 color 字段）
- 负重轮/主动轮/诱导轮：🔴 `color:'#ff3333'`
- 履带链：🔵 `color:'#0066ff'`
- 发烟筒：🟣 `color:'#ff00ff'`

---

## 开发交接规范

当工作完成需要推送时：
```bash
git add -A
git commit -m "vX.Y.Z: 描述"
git push origin master        # Gitee 主仓库
git push github master        # GitHub 备用（失败可跳过）
```

同步后更新 `CODEBUDDY.md`（参数表、架构、已知问题）。
