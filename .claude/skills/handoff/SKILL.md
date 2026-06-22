---
name: handoff
description: >
  开发移交。触发词："移交" "交接" "handoff"。
  先调 bump-version 同步版本号，再 git add/commit/push（Gitee+GitHub）+ OneDrive 备份。
---

# Handoff — 开发移交

## 触发

用户说 **"移交"**、**"交接"**、**"handoff"** 时，必须严格按序执行以下全部步骤，不得跳过。

## 执行流程

### Step 1: 调用 bump-version

先用 `Skill` 工具调用 `bump-version`，完成版本号同步 + changelog 裁剪。

### Step 2: 补全文档

bump-version 只更新 index.html + README.md 的 8 处版本号。检查并补全：

- **CLAUDE.md**: 标题版本号 + 新增 `## vX.Y.Z 本次会话变更` 节（按日期记录本次改动要点）
- **CODEBUDDY.md**: 标题版本号 + 已知问题表（新增/修复项）+ 参数变更
- **README.md**: 版本历史追加新条目（bump-version 可能已做，确认即可）

### Step 3: git status 确认

```bash
git status
```

确认无意外文件。

### Step 4: git add + commit（强制）

```bash
git add -A
git commit -m "vX.Y.Z: 描述"
```

**不可跳过。** 即使用户没说"提交"，移交必须提交。

### Step 5: git push origin master（强制）

```bash
git push origin master
```

origin = Gitee 主仓库。**不可跳过。**

### Step 6: git push github master

```bash
git push github master
```

github = GitHub 备用镜像。如果 github remote 未配置，跳过并告知用户。

### Step 7: OneDrive 备份

```bash
cp -r "D:\我的文档\tank_demo" "C:\Users\hpmax\OneDrive\共享软件\坦克对战demo" --parents 2>/dev/null || \
  echo "⚠ OneDrive 备份失败，请手动复制"
```

## 不可跳过的铁律

| 步骤              | 可跳过？             |
| ----------------- | -------------------- |
| bump-version      | 否                   |
| 补全 CLAUDE.md    | 否                   |
| 补全 CODEBUDDY.md | 否                   |
| git add + commit  | **绝不**             |
| git push origin   | **绝不**             |
| git push github   | 仅当 remote 未配置时 |
| OneDrive 备份     | 仅当目录不存在时     |

## 完成后报告

```
✅ 移交完成 — vX.Y.Z
├── 版本号: 8 处全部同步
├── 文档: CLAUDE.md + CODEBUDDY.md + README.md 已更新
├── 提交: <commit-hash> vX.Y.Z: 描述
├── 推送: origin ✅  github ✅
└── OneDrive: ✅
```
