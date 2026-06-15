---
name: cdp-verify
description: >
  CDP 自动验证工作流。触发词："验证" "检查错误" "CDP 验证" "测试一下"。
  杀残留 Python → 启动 HTTP 服务 → 运行 cdp_verify.py → 有错则修复后重试。
---

# CDP Verify — 自动验证工作流

## 触发

用户说 "验证"、"检查错误"、"CDP 验证"、"测试一下"、"确认没有 bug"。

## 前置条件

项目根目录需要 `cdp_verify.py` 脚本。

## 步骤

### Step 1: 清理残留进程

```powershell
Get-Process python -ErrorAction SilentlyContinue | Stop-Process -Force
```

### Step 2: 启动服务

```bash
cd <项目根目录>
python -m http.server 8080 --bind 127.0.0.1
```
后台运行（`run_in_background: true`）。

### Step 3: 验证服务就绪

```bash
netstat -ano | grep ":8080.*LISTENING"
```
确认只有一行 `127.0.0.1:8080`。

### Step 4: 运行 CDP 验证

```bash
python cdp_verify.py
```

### Step 5: 检查结果

- **`error_count: 0`** → ✅ 验证通过，通知用户
- **有错误** → 分析错误信息，定位源码位置，修复后回到 Step 2 重试

### Step 6: 循环限制

- 最多 3 轮修复重试
- 3 轮后仍有错误 → 报告用户，不再自动循环

## 注意事项

- 必须用 `127.0.0.1:8080`，不要用 `localhost`
- 每次重试前必须杀进程重启（端口可能未释放）
- CDP 验证超时 15s，复杂页面可能需要更长时间
