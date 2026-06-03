#!/usr/bin/env python3
"""CDP 截图工具 — 正确使用 send+recv_until 消息配对模式"""
import json, sys, os, time, subprocess, tempfile, urllib.request, base64
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
sys.stderr.reconfigure(encoding="utf-8", errors="replace")
import websocket

CHROME_PATH = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
DEBUG_PORT = 9246
URL = "http://127.0.0.1:8080/refs/hexapod/hexapod_debug.html"
OUT_DIR = r"c:\Users\hpmax\Documents\tank_demo\refs\hexapod"

def log(msg):
    print("  " + msg, file=sys.stderr)

# ── 启动 Chrome ──
user_dir = tempfile.mkdtemp(prefix="cdp_hex_")
log("启动 Chrome")
proc = subprocess.Popen(
    [CHROME_PATH, "--remote-debugging-port=%d" % DEBUG_PORT,
     "--user-data-dir=%s" % user_dir,
     "--headless=new", "--window-size=1400,1050",
     "--no-first-run", "--no-default-browser-check",
     "--remote-allow-origins=*"],
    stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(3)

# ── 创建标签页 ──
req = urllib.request.Request(
    "http://127.0.0.1:%d/json/new?%s" % (DEBUG_PORT, urllib.request.quote(URL, safe='')),
    method="PUT")
with urllib.request.urlopen(req, timeout=10) as resp:
    tab = json.loads(resp.read().decode())
ws_url = tab["webSocketDebuggerUrl"]
log("标签页已创建")

# ── WebSocket ──
ws = websocket.create_connection(ws_url, timeout=30)
ws.settimeout(5)
cmd_id = [0]
errors = []
pending = {}  # 等待响应的命令 id -> callback

def send(method, params=None):
    """发送CDP命令，返回命令id"""
    cmd_id[0] += 1
    msg = {"id": cmd_id[0], "method": method}
    if params is not None:
        msg["params"] = params
    ws.send(json.dumps(msg))
    return cmd_id[0]

def recv_until(deadline):
    """接收消息直到deadline，返回有id的响应消息"""
    while time.time() < deadline:
        try:
            raw = ws.recv()
            msg = json.loads(raw)
            # 收集异常
            if msg.get("method") == "Runtime.exceptionThrown":
                err = msg.get("params", {}).get("exceptionDetails", {})
                text = err.get("text", "")
                if text and "Uncaught" not in errors:
                    errors.append(text[:200])
            # 有id = 命令响应
            if "id" in msg:
                return msg
        except websocket.WebSocketTimeoutException:
            continue
        except Exception as e:
            s = str(e)
            if "closed" not in s.lower() and "timeout" not in s.lower():
                log("recv异常: " + s[:80])
            break
    return None

def evaluate(js):
    """发送Runtime.evaluate并等待响应"""
    send("Runtime.evaluate", {"expression": js, "returnByValue": True})
    r = recv_until(time.time() + 5)
    if r and "result" in r:
        val = r["result"].get("result", {}).get("value")
        err = r["result"].get("exceptionDetails")
        if err:
            log("JS err: " + str(err.get("text", ""))[:100])
        return val
    return None

# ── 初始化 ──
# 先发送所有enable命令
send("Page.enable")
recv_until(time.time() + 3)
send("Runtime.enable")
recv_until(time.time() + 3)

# ── 等待页面就绪 ──
log("等待页面加载...")
deadline = time.time() + 25
while time.time() < deadline:
    val = evaluate("!!document.querySelector('canvas')")
    if val:
        log("页面就绪")
        break
    time.sleep(0.5)

# 检查状态
title = evaluate("document.title")
log("Title: " + str(title))
err_list = evaluate("JSON.stringify(window.__errors||[])")
if err_list and err_list != "[]":
    log("页面错误: " + str(err_list)[:300])

# ── 6角度截图 ──
# 模型朝向：车头=-X，车尾=+X，左侧=+Z，右侧=-Z
# 距离拉远，相机放低看腿，lookAt模型中心（脚贴地后center≈1.5m）
angles = [
    ("前",     "c.position.set(-17, 2.0, 0); c.lookAt(0, 1.3, 0)"),
    ("前右侧", "c.position.set(-12, 2.2, -12); c.lookAt(0, 1.0, 0)"),
    ("右",     "c.position.set(0, 2.0, -17); c.lookAt(0, 1.0, 0)"),
    ("后",     "c.position.set(17, 2.0, 0); c.lookAt(0, 1.3, 0)"),
    ("后左侧", "c.position.set(12, 2.2, 12); c.lookAt(0, 1.0, 0)"),
    ("左",     "c.position.set(0, 2.0, 17); c.lookAt(0, 1.0, 0)"),
    ("顶",     "c.position.set(0, 18, 0.01); c.lookAt(0, 1.3, 0)"),
    ("底",     "c.position.set(0, -13, 0.01); c.lookAt(0, 1.3, 0)"),
]

for name, cam_js in angles:
    # 设置相机
    evaluate("(function(){var c=window._cam;if(!c)return;" + cam_js + ";c.updateProjectionMatrix()})()")
    time.sleep(0.2)
    # 渲染
    evaluate("(function(){var r=window._ren,s=window._scene,c=window._cam;if(r&&s&&c){r.render(s,c);r.render(s,c)}})()")
    time.sleep(0.2)
    # 截图
    send("Page.captureScreenshot", {"format": "png"})
    r = recv_until(time.time() + 5)
    data = r.get("result", {}).get("data") if r else None
    if data:
        path = os.path.join(OUT_DIR, "hexapod_debug_%s.png" % name)
        with open(path, "wb") as f:
            f.write(base64.b64decode(data))
        log("OK %s (%dKB)" % (name, len(data) // 1024))
    else:
        log("FAIL %s" % name)

# ── 清理 ──
ws.close()
proc.terminate()
try:
    proc.wait(timeout=3)
except:
    proc.kill()

log("JS错误: %d" % len(errors))
for e in errors[:5]:
    log("  " + e[:150])
