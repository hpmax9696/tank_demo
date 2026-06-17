---
name: model-switching-setup
description: Claude Code 多模型(DeepSeek/GLM)切换脚本位置、用法、以及系统环境变量优先级陷阱
metadata:
  type: project
---

在 DeepSeek v4 Pro 和智谱 GLM 5.2 之间切换，用脚本 `~/.claude/switch-model.sh`：

```bash
bash ~/.claude/switch-model.sh glm        # 切到智谱 GLM 5.2 (open.bigmodel.cn)
bash ~/.claude/switch-model.sh deepseek   # 切到 DeepSeek v4 Pro
bash ~/.claude/switch-model.sh status     # 查看当前配置
```

- 两个 provider 的配置分别存于 `~/.claude/model-profiles/glm.json` 和 `deepseek.json`（含各自的 API Key），API Key 在这两个文件里手填。
- 脚本把选中 profile 的内容整体写入 `~/.claude/settings.json` 的 `env` 字段，并备份到 `settings.json.bak`。
- **必须重启 Claude Code 才生效**（当前会话的进程环境变量不会变）。

**关键陷阱**：Windows 系统环境变量（`ANTHROPIC_BASE_URL` / `ANTHROPIC_AUTH_TOKEN` / `ANTHROPIC_MODEL` 等）的优先级**高于** `settings.json` 的 `env` 字段。若系统里残留旧模型的环境变量，脚本写入 settings.json 后仍连旧地址、导致切换"无效/报错"。

**Why:** 用户最初按 DeepSeek 官网指引改了系统环境变量来接入，后切到 GLM 时 settings.json 已正确写入但连不上，根因就是系统环境变量压过了 settings.json。

**How to apply:** 切换模型前，确保已删除 Windows 系统环境变量里的 `ANTHROPIC_*` 一组变量（让 settings.json 独占配置）；切换后看 `/status` 确认模型名。排障先 `bash switch-model.sh status` 对比 settings.json 与环境变量两栏是否一致。

参考智谱官方接入说明：https://docs.bigmodel.cn/cn/coding-plan/tool/claude
