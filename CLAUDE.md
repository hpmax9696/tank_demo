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
├── index.html         # 核心游戏引擎 (~5094行)：状态机/场景/物理/瞄准/摄像机
├── waters.js          # 水体模块 (~405行)：池塘/河流水面ShapeGeometry+碰撞体+动画
├── bridges.js         # 桥梁模块 (~177行)：编辑器桥+参数化桥+碰撞检测+可视化
├── debugcolliders.js  # 碰撞可视化 (~120行)：F3切换，从运行时数据反向生成
├── audio.js           # 音频系统
├── input.js           # 输入处理 (WASD+手柄，5段力度)
├── shells.js          # 炮弹系统
├── mg.js              # 机枪系统
├── bars.js            # UI 血条/装填条
├── obstacles.js       # 环境对象 (树木/建筑/InstancedMesh)
├── model_factory.html # 程序化模型编辑器 (~1922行)
├── map_editor.html    # 地图编辑器 (~2900行)
├── fireSmokeParticles.js  # 粒子系统
├── models/            # 模型文件 (GLB主力 + 程序化兜底)
├── maps/              # .map.json 地图配置
├── combat/            # AI状态机 + 积分系统
├── docs/              # 协作文档 (空，T-34/85 v1.6 文档已清理)
└── CODEBUDDY.md       # 详细架构/参数/已知问题/待办 → 查阅细节时读它
```

## 核心全局变量

`scene`, `players[]`, `bullets[]`, `explosions[]`, `obstacles[]`, `currentMapData`

## 必须遵守的规则

1. **版本号同步 8 处**：`index.html`（title + menu-version + changelog + 调试信息 + console.log）+ `README.md`（开头版本号 + 版本历史 + 代码规模）
2. **Changelog 裁剪**：`.changelog` 只保留最近 5 条，多了删最旧的
3. **Commit 格式**：`git commit -m "vX.Y.Z: 描述"`
4. **Git 推送**：`git push origin master` (Gitee 主仓库)
5. **修改后 Ctrl+F5** 强制刷新验证

## 游戏模式

- `menu` | `single` | `versus` | `combat`
- WASD驾驶 + 鼠标瞄准 + 左键开炮 / ESC返回

## 详细文档

查看 **CODEBUDDY.md** — 关键参数表、架构详解、已知问题、待完成任务、交接流程
