---
name: zombie-glb-preview
overview: 将 OneDrive 中的丧尸高精 GLB 模型复制到项目并集成到菜单模型预览系统中，支持旋转/缩放查看，如果包含动画则播放默认动画。
todos:
  - id: copy-glb-file
    content: 将丧尸高精.glb从OneDrive复制到项目models/glb/目录
    status: completed
  - id: add-entry-buildpreviewtabs
    content: 在buildPreviewTabs()中添加丧尸GLB模型条目
    status: completed
    dependencies:
      - copy-glb-file
  - id: refactor-glb-path-map
    content: 重构loadPreviewModel()中GLB路径映射为名称→路径表，加入zombie映射
    status: completed
    dependencies:
      - copy-glb-file
  - id: add-animation-mixer
    content: 新增previewMixer变量，在加载回调和渲染循环中集成动画播放与清理
    status: completed
    dependencies:
      - refactor-glb-path-map
  - id: version-bump
    content: 版本号同步v0.26.6→v0.26.7（8处：title/menu-version/changelog/调试信息/console.log/README版本号/README历史/README规模）
    status: completed
    dependencies:
      - add-entry-buildpreviewtabs
      - refactor-glb-path-map
      - add-animation-mixer
---

## 用户需求

将用户放置在 OneDrive `models/glb/` 目录下的 `丧尸高精.glb`（27.63MB）集成到坦克对战demo的菜单模型预览系统中。

## 核心功能

1. 将 `丧尸高精.glb` 复制到项目 `models/glb/` 目录
2. 在模型预览的「GLB模型」分类下新增「丧尸 (高精)」条目
3. 点击后加载并展示丧尸3D模型（自动缩放/居中/阴影，与现有坦克GLB一致）
4. 若模型包含骨骼动画（gltf.animations），在预览中自动播放默认动画
5. 切换模型或退出预览时正确清理动画混合器

## 技术方案

### 修改范围

仅修改 `index.html` 一个文件，涉及 4 个变更点：

### 变更点 1：GLB 模型条目注册（`buildPreviewTabs()`，第 4834 行后）

```javascript
// 新增一行，与现有 t34-green/t34-yellow 并列
catMap.glb.models.push({ cat: 'glb', name: 'zombie', label: '丧尸 (高精)', value: 'glb/zombie' });
```

### 变更点 2：GLB 路径映射（`loadPreviewModel()`，第 4899-4901 行）

当前路径逻辑为二元表达式（`t34-yellow ? path1 : path2`），无法容纳第三个模型。重构为**名称→路径映射表**：

```javascript
const GLB_PATH_MAP = {
    't34-green': 'models/glb/t34-85_textured.glb',
    't34-yellow': 'models/glb/t34-85_textured_yellow.glb',
    'zombie': 'models/glb/zombie.glb'
};
const glbPath = GLB_PATH_MAP[m.name];
```

### 变更点 3：动画混合器集成

- **新增全局变量** `previewMixer = null`（第 4723 行附近）
- **在加载回调中创建 mixer**：若 `gltf.animations && gltf.animations.length > 0`，创建 `THREE.AnimationMixer(gltf.scene)` 并播放第一个动画
- **在渲染循环中更新 mixer**：`previewLoop()` 中使用 `clock.getDelta()` 驱动 `previewMixer.update(dt)`
- **切换模型时清理 mixer**：`loadPreviewModel()` 开头清理旧 `previewMixer.stopAllAction() / previewMixer = null`
- **退出预览时清理 mixer**：`exitPreviewMode()` 中同步清理

### 变更点 4：版本号同步（8 处，v0.26.6 → v0.26.7）

### 文件复制

将 `C:\Users\hpmax\OneDrive\共享软件\坦克对战demo\models\glb\丧尸高精.glb` 复制到 `models/glb/`（项目中已存在 `models/glb/` 目录，含两个坦克 GLB）

### 关键设计决策

- **不离散化模型名到路径**：使用映射表而非 if-else 链，便于后续添加更多 GLB 模型
- **动画支持可选**：用 `if (gltf.animations?.length)` 判断，无动画的模型不受影响
- **27MB 加载时间**：现有 GLB 加载已有 `onError` 回调提示"GLB 模型加载失败"，无需额外处理