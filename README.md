# 🎮 坦克运动 Demo — 3D 坦克对战游戏

> **当前版本：v0.19.7** | 基于 Three.js 的单文件 3D 浏览器游戏
> 支持单人探索和本地双人对战（1P 键盘 + 2P 手柄）。

---

## 快速开始

### 运行方式
**双击 `index.html`** 即可运行。支持 `file://` 协议，无需服务器。
建议使用 VS Code Live Server 以获得最佳 GLB 模型加载体验。

### 操作说明

| 模式 | 操作 |
|------|------|
| 单人 | W/S (左履带) ↑/↓ (右履带) 空格 (开炮) ESC (返回) |
| 双人 | 1P键盘 + 2P手柄 (左右摇杆 + RT开炮) |
| 模型预览 | 鼠标拖拽旋转 / 滚轮缩放 / 下拉菜单切换 / ESC返回 |

---

## 技术栈

| 技术 | 说明 |
|------|------|
| Three.js | UMD 构建，本地 `three.min.js` 加载 |
| 粒子系统 | `fireSmokeParticles.js`（火焰/烟雾/爆炸效果） |
| 音频 | Web Audio API 程序化生成 |
| 部署 | 全部文件离线可用，无网络依赖 |

---

## 项目结构

```
坦克对战demo/
├── index.html               # 主入口（HTML + CSS + Three.js 游戏引擎，~2400行）
├── three.min.js             # Three.js UMD 构建
├── GLTFLoader.js            # GLB 模型加载器
├── fireSmokeParticles.js    # 粒子系统
├── README.md                # 本文件
└── models/                  # 程序化模型
    ├── modelRegistry.js     # 模型注册表
    ├── tank.js              # 简化坦克（备选）
    ├── t34-85.js            # T-34/85 高精度模型
    ├── trees.js             # 树木
    ├── buildings.js         # 建筑（平房/别墅/公寓）
    └── windmill.js          # 风车
```

---

## 当前功能状态

| 模块 | 状态 | 说明 |
|------|:----:|------|
| 单人模式 | ✅ | WASD + 空格开炮，第三人称追尾 |
| 双人对战 | ✅ | 1P键盘 + 2P手柄，分屏渲染 |
| 模型预览 | ✅ | 拖拽/缩放/切换模型 |
| T-34/85 程序化模型 | ✅ | 车体/炮塔/履带/格栅 |
| 建筑/树木/风车 | ✅ | 平房/别墅/公寓/树木/风车 |
| 粒子系统 | ✅ | 火焰/烟雾/爆炸/碎片 |
| 音频系统 | ✅ | Web Audio API 原生生成 |
| 殉爆系统 | ✅ | 坦克爆炸引爆附近障碍物 |
| 游戏模式切换 | ✅ | 正确清理 |
| file:// 协议支持 | ✅ | 自动回退程序化模型 |
| 右上角里程表 | ✅ | 显示行驶米数（可能有bug） |
| 游戏循环保护 | ✅ | try/catch 防止单帧错误终止 |

---

## 当前版本关键参数（v0.19.7）

| 参数 | 值 | 说明 |
|------|-----|------|
| 世界大小 | 100×100 单位 | ≈470×470 米 |
| 障碍物数量 | 120 | 泊松盘采样，最小间距 3.0 |
| 出生点 A | (-32, -32) | 面向东北 |
| 河流宽度 | 3.0 单位 | 扁平河底 y=-0.15 + 斜坡岸 + 半透水面 |
| 桥梁 | 长4×宽2.5 | BoxGeometry，桥面 y=0.35 |
| 障碍物可见半径 | 30 单位 | 超出则隐藏 |
| 单人摄像机 | 后方5.5 / 上方4.0 | FOV 55° |
| 双人摄像机 | 后方10 / 上方6 | 分屏拉远 |
| 坦克长度 | 1.70 单位 | ≈8 米 |
| 单位换算 | 1单位 ≈ 4.706米 | METERS_PER_UNIT = 8/1.70 |

---

## == 已知未解决问题（移交重点） ==

| # | 严重度 | 问题 | 期望行为 | 当前行为 | 可能原因 / 修复方向 |
|---|--------|------|----------|----------|-------------------|
| 1 | 🔴 | **坦克驶上桥梁时不提升** | 坦克底盘 y 应抬高到桥面 y=0.35，模拟爬坡 | 坦克 y=0 固定，桥面 y=0.35 在坦克上方 | 需在 `checkCollision` 中检测桥梁区域，返回 `bridgeY` 偏移量，`tankGroup.position.y` 设为桥面高度 |
| 2 | 🔴 | **障碍物始终不可见** | 坦克周围 30 单位内应有障碍物可见 | 障碍物不被渲染，`obs可见: 0` | ① `initScene` 中 `createObstacles` 调用时 `tankState=(0,0)`，障碍物在错误位置标记可见 ② `enterGame` 中 `updateObstacleVisibility()` 可能未生效 ③ 排查 `poissonDiskSampling` 是否真的生成了障碍物 |
| 3 | 🔴 | **里程数字恒定为 0** | 坦克移动时里程累加 | 始终显示 `0.0 米` | `totalDistance` 累加在 `gameLoop` 中但可能：① `gameLoop` 未执行到此行 ② `v` 始终为 0（输入检测问题）③ 检查 `try/catch` 是否捕获了错误 |
| 4 | 🔴 | **河水效果太假（无下陷/无流动）** | 下陷河床 + 流动河水 | 扁平色块 | ① 当前 `makeStrip` 创建的扁平条纹材质无纹理偏移 ② 需要恢复 V 形河床+程序化水纹+UV 流动 ③ 参考 v0.19.3 的河流方案 |
| 5 | 🟡 | **双人模式摄像机距离** | 分屏视野更合理 | 当前 DUAL_CAMERA_BEHIND=10 可能仍偏近 | 可调整为 12-15 |
| 6 | 🟡 | **GLB 模型 CORS 问题** | 从 file:// 协议加载 GLB 模型 | CORS 阻止，已回退程序化模型 | 建议用 Live Server 或 http-server |
| 7 | 🟢 | **控制台 `.encoding` 废弃警告** | 无警告 | `THREE.Texture: Property .encoding has been replaced by .colorSpace` | three.min.js 版本旧，仅警告不崩溃，可忽略 |

---

## 移交清单

### 文件交付

| 文件 | 行数 | 说明 |
|------|:----:|------|
| `index.html` | ~2400 | 主入口（HTML+CSS+JS） |
| `three.min.js` | — | Three.js 库 |
| `GLTFLoader.js` | — | GLB 加载器 |
| `fireSmokeParticles.js` | ~390 | 粒子系统 |
| `models/modelRegistry.js` | ~66 | 模型注册表 |
| `models/tank.js` | ~85 | 简化坦克（备选） |
| `models/t34-85.js` | ~640 | T-34/85 v6.1 |
| `models/trees.js` | ~60 | 树木 |
| `models/buildings.js` | ~220 | 建筑 |
| `models/windmill.js` | ~59 | 风车 |
| **总计** | **~4000 行** | |

### 运行方式
1. 复制整个文件夹到目标电脑
2. **双击 `index.html`** 立即运行
3. 修改代码后关闭标签页重开（`Ctrl+F5` 在 `file://` 下可能无效）
4. Chrome / Edge / Firefox 均可

### Git 仓库
- **Gitee**（主）：`https://gitee.com/hpmax9696/tank_demo.git`
- **GitHub**（备用）：`git@github.com:hpmax9696/tank_demo.git`
- **远端**：`origin` → Gitee，`github` → GitHub

### 更新 SOP
```bash
git add -A
git commit -m "vX.Y.Z: 描述"
git push origin master        # Gitee
git push github master        # GitHub

# OneDrive 同步
Copy-Item index.html, GLTFLoader.js, fireSmokeParticles.js, README.md "C:\Users\hpmax\OneDrive\共享软件\坦克对战demo\" -Force
```

### 版本号同步清单
1. `<title>` 标签
2. `.menu-version` 菜单显示
3. `.changelog` 追加记录
4. 调试信息版本号
5. `console.log` 版本号
6. `README.md` 开头版本号

### 调试建议
1. 右上角调试区显示：版本号、里程(米)、坦克坐标、可见障碍物数量
2. F12 → Console 查看日志
3. 关标签页重开清缓存

---

## 版本历史

### v0.19.7 — 移交版本（2026-05-07）
**当前版本**。河床扁平化+斜坡岸+桥面抬升+障碍物可见半径30+调试信息增强。
**未解决**：坦克上桥不抬升、障碍物不可见、里程为0、河水无下陷流动。

### v0.19.6 — sRGB颜色修复+桥梁旋转+河床加大+gameLoop保护（2026-05-07）
颜色修复（`texture.encoding = THREE.sRGBEncoding`）；桥梁 `atan2(-perp.z, perp.x)`；河床宽3.0深1.0；gameLoop try/catch。

### v0.19.5 — 地图缩小到1/4 + 双人摄像机 + file://回退（2026-05-07）
WORLD_HALF 100→50；DUAL_CAMERA_BEHIND=10；file://自动回退程序化模型；里程表上线。

### v0.18.0~v0.19.4（详见 README 早期版本历史）
（早期版本略）

---

## 版权

坦克 3D 模型和游戏逻辑为原创。
Three.js MIT 许可证。
音频 Web Audio API 程序化生成，无版权问题。
