# DSH 接管交接清单 — 保证 Claude Code 可随时恢复

> 目的：本仓库由多个 AI 工具协作开发（Claude Code 为主力）。当 DeepSeek Harness (DSH)
> 或其他 AI 接管开发时，**必须**遵守本清单，保证 Claude Code 随时可以无缝回来。
> 本清单固化于 memory/（会话间持久，跨 AI 可见），任何接管会话必须逐项执行，不依赖会话记忆。

## 一、每次会话收尾（硬性要求，逐项勾选）

### 1. CLAUDE.md（CC 主文档，优先级最高）
- [ ] 按现有格式追加 `## vX.Y.Z 本次会话变更 (日期)` 段：变更点 / 改动文件 / 验证方式 / 已知问题（新增+关闭）
- [ ] 同步头部版本号与关键参数
- [ ] 更新已知问题表、文件行数
- [ ] 超过 40k 字符时归档到 `docs/CLAUDE_history_archive.md`（2026-08-08 瘦身先例）

### 2. 其余三份 AI 文档（强制同步）
- [ ] `CODEBUDDY.md`：参数表 / 架构 / 已知问题 / 待办
- [ ] `.trae/rules/project_rules.md`：规则 / 文件行数
- [ ] `AGENTS.md`：版本号 / 本次会话已完成工作

### 3. 版本号 8 处同步（index.html ×5 + README.md ×3）
- [ ] index.html：`<title>` / `.menu-version` / `.changelog`（追加新条目并裁剪到最近 5 条 `cl-title`）/ 调试信息 / console.log
- [ ] README.md：开头版本号 / 版本历史追加 / 代码规模注释
- [ ] 自检：grep 版本号确认 8 处一致

### 4. 设计文档（沿袭 CC 的 superpowers 工作流）
- [ ] 复杂任务在 `docs/superpowers/plans/` 与 `docs/superpowers/specs/` 各写一份（命名：`日期-主题.md`）

### 5. Git 提交推送（按需发版，禁止每改动一次就发版）
- **用户约定（2026-08-14 明确要求）**：不要每进行一次改动就发版提交。仅当用户明确要求发版时
  （改动足够多/足够大，或本次开发告一段落）才执行以下发版流程。
- **发版流程**：8 处版本号同步 + 4 份 AI 文档同步 + changelog 5 条裁剪 →
  `git add -A` → `git commit -m "vX.Y.Z: 描述"`（代码与文档同一次提交）→ `git push origin master`（Gitee；`github` 远程已不存在）
- **日常改动**：只改代码 + 验证，不动版本号、不提交、不 push。
- **push 约定（2026-08-14 用户确认）**：全权限模式直接推；workspace-write 模式则向用户申请一次全权限批准后执行
  `git -c http.sslBackend=openssl -c credential.helper=manager push origin master`
  （openssl 绕过 schannel `SEC_E_NO_CREDENTIALS`；凭据读自 Windows 凭据管理器缓存，无需交互输入）

## 二、验证闭环（改动代码后必做）

- **首选 Playwright**（近期 CC 会话的实际路径）：项目 `node_modules` 自带 playwright 1.61.1 +
  `chromium-1228`（已装）。用 playwright 打开 `http://127.0.0.1:8080`，抓 console error /
  pageerror，必须 0 错误。
- **`cdp_verify.py` 已过时（2026-08-13 实测）**：新版 Chrome 对 `/json/new` 返回 501；
  且其"验证通过"判定有缺陷（标签页创建失败仍报 pass）。慎用。
- 验证前确认 8080 只监听 127.0.0.1：`netstat -ano | findstr ":8080.*LISTENING"`。
- 修改 `server.py` 后必须重启服务（`taskkill //F //IM python.exe` 后重新启动）。
- 注：DSH 沙箱下 Playwright 启动浏览器会遇 `spawn EPERM`，需用户批准一次全权限。

## 三、Claude Code 恢复入口（保证可回退）

CC 回来时的读取顺序：
1. `CLAUDE.md` 最新 `## vX.Y.Z 本次会话变更` 段 —— 上轮做了什么
2. `git log --oneline` —— 完整提交历史
3. `docs/superpowers/plans/` + `specs/` —— 设计决策
4. `memory/` —— 跨会话记忆

只要以上文件保持完整最新，CC 可无缝继续；即使某轮同步缺失，`git diff` 可补齐。
