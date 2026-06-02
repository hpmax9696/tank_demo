#!/usr/bin/env python3
"""
CDP 自动验证工具 — Chrome DevTools Protocol 控制台错误抓取
用法: python cdp_verify.py [URL] [--timeout 15]

核心改进（Task 7）：
  - 不再使用 /json/close 关标签页（不可靠）
  - 直接终止 Chrome 进程，100% 可靠清理
  - 专用临时 user-data-dir，不影响正常 Chrome
"""
import json
import sys
import os
import time
import signal
import subprocess
import tempfile
import urllib.request
import urllib.error
from pathlib import Path

# 修复 Windows 终端 GBK 编码问题
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

import websocket  # pip install websocket-client

# === 配置 ===
CHROME_PATH = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
DEBUG_PORT = 9222
DEFAULT_URL = "http://127.0.0.1:8080"
DEFAULT_TIMEOUT = 15  # 秒：等待页面加载 + 错误捕获


def log(msg: str):
    """输出到 stderr，不污染 stdout 的 JSON 结果"""
    print(f"  {msg}", file=sys.stderr)


def http_get_json(url: str) -> dict | list:
    """HTTP GET 并解析 JSON"""
    req = urllib.request.Request(url, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=10) as resp:
        return json.loads(resp.read().decode("utf-8"))


def get_chrome_tabs() -> list[dict]:
    """获取所有 CDP 标签页"""
    try:
        return http_get_json(f"http://127.0.0.1:{DEBUG_PORT}/json")
    except Exception:
        return []


def find_or_create_tab(target_url: str) -> str | None:
    """找到目标 URL 的标签页，或创建新的，返回 WebSocket URL"""
    tabs = get_chrome_tabs()
    for tab in tabs:
        if tab.get("url", "").startswith(target_url) or target_url in tab.get("url", ""):
            return tab["webSocketDebuggerUrl"]

    # 创建新标签页 — CDP /json/new 需要 PUT 方法
    try:
        url = f"http://127.0.0.1:{DEBUG_PORT}/json/new?{urllib.request.quote(target_url, safe='')}"
        req = urllib.request.Request(url, method="PUT")
        with urllib.request.urlopen(req, timeout=10) as resp:
            result = json.loads(resp.read().decode("utf-8"))
        return result.get("webSocketDebuggerUrl")
    except Exception as e:
        log(f"创建标签页失败: {e}")
        return None


def kill_chrome_process():
    """强制终止所有监听 DEBUG_PORT 的 Chrome 进程"""
    if sys.platform == "win32":
        try:
            # 根据命令行参数找到 debug port 对应的进程
            result = subprocess.run(
                ['wmic', 'process', 'where', 'name="chrome.exe"', 'get', 'processid,commandline'],
                capture_output=True, text=True, timeout=10
            )
            for line in result.stdout.splitlines():
                if f"remote-debugging-port={DEBUG_PORT}" in line:
                    # 提取 PID（行末的数字）
                    parts = line.strip().split()
                    if parts and parts[-1].isdigit():
                        pid = int(parts[-1])
                        log(f"终止 Chrome 进程 PID={pid}")
                        os.kill(pid, signal.SIGTERM if hasattr(signal, 'SIGTERM') else 15)
                        time.sleep(0.5)
        except Exception as e:
            log(f"WMIC 清理失败，尝试 taskkill: {e}")
            subprocess.run(['taskkill', '/F', '/IM', 'chrome.exe'], capture_output=True, timeout=10)
    else:
        subprocess.run(['pkill', '-f', f'remote-debugging-port={DEBUG_PORT}'], capture_output=True)


def collect_errors(ws_url: str, timeout: int) -> list[dict]:
    """通过 WebSocket CDP 收集页面控制台错误"""
    errors = []
    page_loaded = False
    cmd_id = [0]  # 可变计数器

    ws = websocket.create_connection(ws_url, timeout=timeout)
    ws.settimeout(min(timeout, 10))

    def send(method: str, params: dict | None = None):
        cmd_id[0] += 1
        msg = {"id": cmd_id[0], "method": method}
        if params is not None:
            msg["params"] = params
        ws.send(json.dumps(msg))

    def recv_until_deadline(deadline: float):
        """接收消息直到 deadline，有新消息时重置超时"""
        while time.time() < deadline:
            try:
                remaining = max(0.5, deadline - time.time())
                ws.settimeout(min(remaining, 3.0))
                return ws.recv()
            except websocket.WebSocketTimeoutException:
                continue
        raise websocket.WebSocketTimeoutException("deadline reached")

    # 启用必要的域
    send("Page.enable")
    send("Runtime.enable")
    send("Log.enable")
    send("Network.enable")

    # 注入错误收集器（在页面加载前注入，通过 Page.addScriptToEvaluateOnNewDocument）
    send("Page.addScriptToEvaluateOnNewDocument", {
        "source": """
            window.__cdp_errors = [];
            window.__cdp_warnings = [];
            const _origError = console.error;
            console.error = function(...args) {
                window.__cdp_errors.push(args.map(a => String(a)).join(' '));
                _origError.apply(console, args);
            };
            window.addEventListener('error', function(e) {
                window.__cdp_errors.push(e.message + ' @ ' + e.filename + ':' + e.lineno);
            });
            window.addEventListener('unhandledrejection', function(e) {
                window.__cdp_errors.push('Unhandled: ' + String(e.reason));
            });
        """
    })

    # 重新加载页面以确保注入的脚本生效
    send("Page.reload")

    # 等待并处理事件
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            raw = recv_until_deadline(deadline)
            msg = json.loads(raw)
            method = msg.get("method", "")

            if method == "Runtime.exceptionThrown":
                exc = msg.get("params", {}).get("exceptionDetails", {})
                text = exc.get("text", "") or str(exc.get("exception", {}).get("description", ""))
                url = exc.get("url", "")
                line = exc.get("lineNumber", 0)
                errors.append({"type": "exception", "text": text, "url": url, "line": line})

            elif method == "Log.entryAdded":
                entry = msg.get("params", {}).get("entry", {})
                level = entry.get("level", "")
                if level == "error":
                    errors.append({
                        "type": "console.error",
                        "text": entry.get("text", ""),
                        "url": entry.get("url", ""),
                        "source": entry.get("source", ""),
                    })

            elif method == "Network.loadingFailed":
                params = msg.get("params", {})
                errors.append({
                    "type": "network.error",
                    "text": f"{params.get('type','')}: {params.get('errorText','')}",
                    "url": params.get("requestUrl", ""),
                })

            elif method == "Page.loadEventFired":
                page_loaded = True
                log("页面加载完成，等待额外错误...")
                # 页面加载后再等 2 秒收集延迟错误
                deadline = min(deadline, time.time() + 3)

        except websocket.WebSocketTimeoutException:
            if page_loaded:
                break
            log("等待页面加载超时")
            break
        except Exception as e:
            log(f"WebSocket 错误: {e}")
            break

    # 最后读取注入的错误收集器
    log("收集注入的错误...")
    try:
        send("Runtime.evaluate", {
            "expression": "JSON.stringify({errors: window.__cdp_errors || [], warnings: window.__cdp_warnings || []})"
        })
        raw = recv_until_deadline(time.time() + 3)
        # 可能需要跳过其他事件，找到 evaluate 的响应
        msgs = [raw]
        try:
            while True:
                ws.settimeout(0.3)
                msgs.append(ws.recv())
        except Exception:
            pass
        for raw_msg in msgs:
            try:
                result = json.loads(raw_msg)
                val = result.get("result", {}).get("result", {}).get("value")
                if val:
                    injected = json.loads(val)
                    for err_text in injected.get("errors", []):
                        errors.append({"type": "console.error", "text": err_text})
                    break
            except Exception:
                continue
    except Exception as e:
        log(f"读取注入错误失败: {e}")

    ws.close()
    return errors


def start_http_server(port: int = 8080) -> subprocess.Popen | None:
    """启动 HTTP 服务器（如未运行）"""
    try:
        urllib.request.urlopen(f"http://127.0.0.1:{port}", timeout=2)
        log(f"HTTP:{port} 已运行")
        return None
    except Exception:
        pass

    log(f"启动 python -m http.server {port}")
    proc = subprocess.Popen(
        [sys.executable, "-m", "http.server", str(port), "--bind", "127.0.0.1"],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        cwd=Path(__file__).parent
    )
    time.sleep(1.5)
    return proc


def start_chrome() -> subprocess.Popen | None:
    """启动 Chrome 调试模式，返回进程对象"""
    # 检查是否已运行
    if get_chrome_tabs():
        log("Chrome CDP 已连接")
        return None

    user_data = tempfile.mkdtemp(prefix="cdp_chrome_")
    log(f"启动 Chrome (user-data={user_data})")

    # 先杀旧进程
    kill_chrome_process()
    time.sleep(0.5)

    proc = subprocess.Popen(
        [CHROME_PATH,
         f"--remote-debugging-port={DEBUG_PORT}",
         f"--user-data-dir={user_data}",
         "--remote-allow-origins=*",
         "--no-first-run", "--no-default-browser-check",
         "--disable-sync", "--disable-extensions",
         "about:blank"],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    # 等待 CDP 端口就绪
    for _ in range(15):
        time.sleep(0.5)
        if get_chrome_tabs():
            log("Chrome CDP 就绪")
            return proc
    log("⚠ Chrome 启动超时")
    return proc


def verify(url: str, timeout: int, keep_chrome: bool = False) -> dict:
    """主验证流程"""
    start = time.time()

    # 1. 确保 HTTP 服务运行
    http_proc = start_http_server()

    # 2. 启动 Chrome
    chrome_proc = start_chrome()

    # 3. 打开页面并收集错误
    log(f"打开 {url}")
    ws_url = find_or_create_tab(url)
    if not ws_url:
        return {"status": "error", "message": "无法创建标签页", "errors": []}

    errors = collect_errors(ws_url, timeout)

    # 4. 清理 — 杀 Chrome 进程 + HTTP 服务器（不再用 /json/close！）
    if not keep_chrome:
        log("清理进程...")
        if chrome_proc:
            kill_chrome_process()
            try:
                chrome_proc.wait(timeout=3)
            except subprocess.TimeoutExpired:
                chrome_proc.kill()
        if http_proc:
            http_proc.terminate()
            try:
                http_proc.wait(timeout=3)
            except subprocess.TimeoutExpired:
                http_proc.kill()
    else:
        log("保留 Chrome (--keep-chrome)")

    elapsed = time.time() - start

    return {
        "status": "pass" if not errors else "fail",
        "errors": errors,
        "error_count": len(errors),
        "elapsed_ms": int(elapsed * 1000),
        "url": url,
    }


def main():
    import argparse
    parser = argparse.ArgumentParser(description="CDP 自动验证")
    parser.add_argument("url", nargs="?", default=DEFAULT_URL, help=f"验证 URL (默认: {DEFAULT_URL})")
    parser.add_argument("--timeout", type=int, default=DEFAULT_TIMEOUT, help=f"超时秒数 (默认: {DEFAULT_TIMEOUT})")
    parser.add_argument("--keep-chrome", action="store_true", help="保留 Chrome（手动调试用）")
    args = parser.parse_args()

    print("=" * 50, file=sys.stderr)
    print(f"🔍 CDP 验证: {args.url}", file=sys.stderr)
    print(f"⏱ 超时: {args.timeout}s", file=sys.stderr)
    print("=" * 50, file=sys.stderr)

    result = verify(args.url, args.timeout, keep_chrome=args.keep_chrome)

    # 过滤误报：favicon 404 和 about:blank 导航中止
    all_errors = result.get("errors", [])
    real_errors = [
        e for e in all_errors
        if not (e.get("url", "").endswith("/favicon.ico"))
        and not (e.get("type") == "network.error" and "ERR_ABORTED" in e.get("text", ""))
    ]
    real_count = len(real_errors)
    filtered = len(all_errors) - real_count

    print(file=sys.stderr)
    status_icon = "✅" if real_count == 0 else "❌"
    filter_msg = f" (过滤 {filtered} 条误报)" if filtered > 0 else ""
    print(f"{status_icon} 验证{'通过' if real_count == 0 else '失败'} — "
          f"{real_count} 个错误{filter_msg} — {result.get('elapsed_ms', 0)}ms", file=sys.stderr)

    for i, err in enumerate(real_errors, 1):
        url_info = f" ({err.get('url', '')})" if err.get('url') else ""
        print(f"  [{i}] {err['type']}: {err['text'][:200]}{url_info}", file=sys.stderr)

    # stdout 输出 JSON（程序化读取）
    print(json.dumps({**result, "status": "pass" if real_count == 0 else "fail",
                      "error_count": real_count, "errors": real_errors, "filtered": filtered},
                     ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
