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
├── map_editor.html    # 地图编辑器 (~1762行)：v0.49.0 拆分为5模块
├── js/editor_*.js     # 编辑器模块（5个）
│   ├── editor_terrainGen.js  # 地形生成 (~1376行)：FBM+A*寻路+道路+村落
│   ├── editor_entities.js   # 实体管理 (~638行)：标记+CRUD+配置面板+列表
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

## 必须遵守的规则

1. **版本号同步 8 处**：`index.html`（title + menu-version + changelog + 调试信息 + console.log）+ `README.md`（开头版本号 + 版本历史 + 代码规模）
2. **Changelog 裁剪**：`.changelog` 只保留最近 5 条，多了删最旧的
3. **Commit 格式**：`git commit -m "vX.Y.Z: 描述"`
4. **Git 推送**：`git push origin master` (Gitee 主仓库)
5. **修改后 Ctrl+F5** 强制刷新验证
6. **自动验证**：修改代码后自动用 Chrome headless CDP 抓取控制台错误，无误后才通知用户；有错则自行修复再验证，直到通过
7. **模块优先**：新功能优先以独立 JS 模块加载，三个主文件（index/map_editor/model_factory）不宜再增大，主文件仅作框架和加载器
8. **文档同步**：更新 CLAUDE.md 时同步更新 CODEBUDDY.md（参数/架构/已知问题）和 `.trae/rules/project_rules.md`（规则/文件行数），三份文档保持一致

## 游戏模式

- `menu` | `single` | `versus` | `combat`
- WASD驾驶 + 鼠标瞄准 + 左键开炮 / ESC返回

## 详细文档

查看 **CODEBUDDY.md** — 关键参数表、架构详解、已知问题、待完成任务、交接流程
