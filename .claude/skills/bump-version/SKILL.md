---
name: bump-version
description: >
  版本号同步。触发词："发版" "bump version" "升级版本" "更新版本号"。
  自动同步 8 处版本号 + 裁剪 changelog 到 5 条 + 可选 git commit。
---

# Bump Version — 版本号同步

## 触发

用户说 "发版 v0.61.0"、"bump to v0.61.0"、"升级版本" 等。

## 8 处同步清单

### index.html（5 处）

1. `<title>坦克运动demo vX.Y.Z</title>`
2. `.menu-version` 菜单版本显示文本
3. `.changelog` 追加新版本记录（格式：`<div class="cl-title">图标 vX.Y.Z 类型 — 简短描述</div>`）
4. 调试信息中的版本号字符串
5. `console.log('🎮 坦克运动demo vX.Y.Z | ...')`

### README.md（3 处）

6. 开头 `> **当前版本：vX.Y.Z**`
7. 版本历史追加新条目
8. 代码规模注释中的版本号

## 步骤

### Step 1: 确定版本号
- 如果用户提供了版本号（如 `v0.61.0`），直接使用
- 否则从 `index.html` `<title>` 中读取当前版本，询问用户新版本号

### Step 2: 收集 changelog 描述
- 如果用户提供了变更描述，使用它
- 否则询问用户简短的 changelog 文本（如 "修复六足复活 + 导弹平衡"）

### Step 3: 同步 8 处

对每处位置使用 `Edit` 工具精确替换：
- 搜索旧版本号字符串，替换为新版本号
- 注意 README.md 中可能有多处旧版本号（如参数表中的版本引用），那些不需要更新——只更新清单中的 8 处

### Step 4: 裁剪 changelog

在 `index.html` 中：
- 统计 `.changelog` 区域内的 `cl-title` 条目数
- 如果超过 5 条，删除最旧的多余条目（保留最新的 5 条）

### Step 5: 可选提交

- 如果用户要求提交：`git add -A && git commit -m "vX.Y.Z: 描述"`
- 如果用户未提及，询问是否需要提交

### Step 6: 文档同步提醒

提醒用户同步更新：
- `CLAUDE.md` 版本号
- `CODEBUDDY.md` 版本号 + 参数表
- `.trae/rules/project_rules.md` 版本号
