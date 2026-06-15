---
name: new-module
description: >
  模块提取向导。触发词："把 XX 功能拆出来" "提取成独立模块" "拆分 XX 到新文件"。
  分析依赖边界 → 处理跨文件变量（let→var） → 创建模块文件 → 更新 index.html 加载顺序 → CDP 验证。
---

# New Module — 模块提取向导

## 触发

用户说 "把 XX 功能提取成独立模块"、"拆分 engine.js"、"新建 js/xxx.js 模块"。

## 核心原则

1. **纯函数优先**：无副作用、不读写全局状态的函数最容易提取
2. **最小变量暴露**：只把必须跨文件共享的变量改为 `var`
3. **保持加载顺序**：新模块插入 index.html 中的正确位置
4. **CDP 验证**：提取后必须验证 0 错误

## 步骤

### Step 1: 确定提取范围

- 用 `Grep` 搜索目标功能的函数声明和变量定义
- 确定精确的起止行号
- 估算提取行数

### Step 2: 依赖分析（关键步骤）

逐行检查目标代码：

**A. 内部依赖（仅目标代码内使用）**
- 直接移走，保持 `let`/`const`

**B. 外部输入（被 engine.js 其他部分调用）**
- `function` 声明 → 自动全局，无需处理
- `let`/`const` 变量 → 需要改为 `var`（顶层）或挂到 `window.xxx`

**C. 外部依赖（目标代码引用了 engine.js 的变量）**
- 如果变量在 engine.js 中是 `let`/`const`，需要改为 `var`
- 在 engine.js 中用 `Grep` 查找该变量的所有引用，评估改动影响

### Step 3: 创建模块文件

- 用 `Write` 工具创建 `js/xxx.js`
- 顶部注释说明模块功能
- `let`/`const` → `var` 用于跨文件共享的顶层声明
- 纯函数保持 `const`/`let` 不变

### Step 4: 更新 index.html

在 `index.html` 中为新模块添加 `<script>` 标签：
- **加载顺序**：确保所有依赖已加载（如 waters.js → mapLoader.js → engine.js）
- 插入位置在 `js/engine.js` 之前

### Step 5: 从原文件删除

- 用 `Edit` 工具删除原文件中的目标代码段
- 删除原文件中已经移走的 `let`/`const` 声明（避免重复声明）
- 对于已在模块文件中改为 `var` 的变量，原文件中移除声明

### Step 6: CDP 验证

调用 cdp-verify 流程：
1. 杀 Python 进程
2. 启动 HTTP 服务
3. 运行 `python cdp_verify.py`
4. 确认 0 错误

## 常见陷阱

| 陷阱 | 现象 | 修复 |
|------|------|------|
| `let` 变量跨文件不可见 | `ReferenceError: xxx is not defined` | 改为 `var` |
| 加载顺序错误 | 函数未定义 | 新模块放在依赖模块之后 |
| 重复声明 | 无错误但值被覆盖 | 删除原文件中的声明 |
| DOM 元素 `const` 跨文件 | 预览函数找不到 DOM | 改为 `var` 并放在事件绑定之前 |

## 示例：地图系统提取

```
目标: js/engine.js L28-513 (486行) → js/mapLoader.js
共享变量: MAP_CONFIGS, currentMapData, TERRAIN_TYPE_INDEX → var
加载位置: waters.js 之后, engine.js 之前
验证: CDP 0 错误
```
