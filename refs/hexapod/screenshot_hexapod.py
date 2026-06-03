#!/usr/bin/env python3
"""通过 CDP 截取模型工厂六足战车各角度截图"""
import json, sys, os, time, subprocess, tempfile, urllib.request, base64
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
sys.stderr.reconfigure(encoding="utf-8", errors="replace")
import websocket

CHROME_PATH = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
DEBUG_PORT = 9225
URL = "http://127.0.0.1:8080/model_factory.html"
OUT_DIR = r"c:\Users\hpmax\Documents\tank_demo\refs\hexapod"

def log(msg): print("  " + msg, file=sys.stderr)

# Kill any chrome already on our debug port
os.system("taskkill /f /im chrome.exe 2>nul")
time.sleep(1)

user_dir = tempfile.mkdtemp(prefix="cdp_hex_")
proc = subprocess.Popen([CHROME_PATH, "--remote-debugging-port=%d" % DEBUG_PORT,
    "--user-data-dir=%s" % user_dir,
    "--headless=new", "--window-size=1400,900", "--no-first-run",
    "--no-default-browser-check", "--remote-allow-origins=*"],
    stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(3)

resp = urllib.request.urlopen("http://127.0.0.1:%d/json" % DEBUG_PORT)
ws = websocket.create_connection(json.loads(resp.read().decode())[0]['webSocketDebuggerUrl'])
log("CDP ready")

def cmd(method, params=None, mid=1):
    ws.send(json.dumps({"id":mid,"method":method,"params":params or {}}))
    return json.loads(ws.recv())

def ev(js):
    r = cmd("Runtime.evaluate", {"expression": "(function(){" + js + "})()", "returnByValue": True})
    return r.get("result",{}).get("result",{}).get("value")

cmd("Page.enable"); cmd("Runtime.enable")
cmd("Page.navigate", {"url": URL})
time.sleep(5)
tri_text = ev("var e=document.querySelector('#triCount'); return e?e.textContent:'?'")
log("Loaded. Tris: " + str(tri_text))

# Disable damping
ev("var c=window._ctrl; if(c){c.enableDamping=false;c.update()}")

# 6 angles
angles = [
    ("前",     "c.target.set(0,1.0,0);c.update();cam.position.set(0,2,6);cam.lookAt(0,1,0)"),
    ("前右侧", "c.target.set(0,1.0,0);c.update();cam.position.set(4,2.5,5);cam.lookAt(0,1,0)"),
    ("右",     "c.target.set(0,1.0,0);c.update();cam.position.set(6,2,0);cam.lookAt(0,1,0)"),
    ("后",     "c.target.set(0,1.0,0);c.update();cam.position.set(0,2,-6);cam.lookAt(0,1,0)"),
    ("顶",     "c.target.set(0,1.0,0);c.update();cam.position.set(0,7,0.1);cam.lookAt(0,1,0)"),
    ("左",     "c.target.set(0,1.0,0);c.update();cam.position.set(-6,2,0);cam.lookAt(0,1,0)"),
]

for name, cam_js in angles:
    ev("var c=window._ctrl,cam=window._cam; if(c&&cam){" + cam_js + ";cam.updateProjectionMatrix()}")
    time.sleep(0.8)
    ev("var s=window._scene,r=window._ren,c=window._cam; if(s&&r&&c)r.render(s,c)")
    time.sleep(0.5)
    r = cmd("Page.captureScreenshot", {"format":"png"})
    data = r.get("result",{}).get("data")
    if data:
        path = os.path.join(OUT_DIR, "hexapod_debug_" + name + ".png")
        with open(path, "wb") as f: f.write(base64.b64decode(data))
        log("OK " + name)
    else:
        log("FAIL " + name + ": " + str(r.get("error","?")))

ws.close(); proc.terminate()
try: proc.wait(timeout=2)
except: proc.kill()
log("Done")
