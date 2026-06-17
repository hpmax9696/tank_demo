---
name: model-switching-trigger
description: 用户说切换模型关键词时自动执行 switch-model.sh 脚本
metadata:
  type: feedback
---

当用户说以下任何触发词时，自动执行 `bash ~/.claude/switch-model.sh <provider>`：

| 触发词 | provider |
|--------|----------|
| "切换到deepseek"、"切到deepseek"、"用deepseek"、"换deepseek" | `deepseek` |
| "切换到智谱"、"切到智谱"、"用智谱"、"换智谱"、"切换到glm"、"切到glm"、"用glm"、"换glm"、"切换到glm5"、"切到glm5"、"glm5.2" | `glm` |

执行完脚本后提醒用户：**需重启 Claude Code 才能生效**。

**Why:** 用户希望口语化指令触发切换，不需要每次手动敲完整命令。

**How to apply:** 识别到以上触发词时，直接 `bash ~/.claude/switch-model.sh deepseek` 或 `bash ~/.claude/switch-model.sh glm`，然后告知结果。
