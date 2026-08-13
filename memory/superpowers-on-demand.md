# Superpowers 按需启用约定（2026-08-13 用户明确要求）

> 用户原话：「superpowers 太重了，保留它，但在决定调用它之前，询问我。我只想在进行真正重大的改进时启用它。」

## 约定（所有 AI 会话必须遵守，含 DSH/DeepSeek Harness）

1. **保留** superpowers 插件（`superpowers@claude-plugins-official` 6.3.0，位于 `~/.claude/plugins/`），**不卸载、不修改**其安装与启用配置。
2. **默认不启用** superpowers 工作流：不主动调用 brainstorming / writing-plans / executing-plans / subagent-driven-development 等 superpowers 技能。
3. **触发条件**：仅当用户**明确批准**时才使用——例如用户说"这次用 superpowers 流程"或"这是重大改进，走 superpowers"。每次使用前必须**先询问用户**，不得自行决定。
4. **日常开发**采用轻量流程：直接实现 → Playwright/CDP 验证 0 错误 → 8 处版本号同步 → `vX.Y.Z` 提交。
5. `docs/superpowers/`（14 份 plan + 13 份 spec）与 `.superpowers/sdd/` 是历史工作流产物，**保留不动**，作为 CC 恢复时的设计依据。
6. 本约定不视为修改「4 份 AI 专属文档」，不触发同步义务；但涉及 superpowers 的任何变更都应让用户知情。

## 背景

- superpowers 重的原因：CC 每次会话启动注入约 4K tokens 上下文（`enabledPlugins` 自动启用）。
- 用户 2026-08-13 明确表态后，本约定立即生效；CC 侧 `enabledPlugins` 配置保持原样（用户未要求改动）。
