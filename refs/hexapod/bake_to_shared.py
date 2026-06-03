#!/usr/bin/env python3
"""从 debug HTML 提取配置 + 烘焙 applyInsectPose() 姿态 → 写共享文件"""
import json, os

BASE = r"c:\Users\hpmax\Documents\tank_demo"

# 1. 提取
with open(os.path.join(BASE, "refs", "hexapod", "hexapod_debug.html"), "r", encoding="utf-8") as f:
    html = f.read()

idx = html.find("const HEXAPOD = ")
start = idx + len("const HEXAPOD = ")

depth = 0; in_str = False; esc = False; end = start
for i in range(start, len(html)):
    c = html[i]
    if esc: esc = False; continue
    if c == "\\": esc = True; continue
    if c == '"' and not in_str: in_str = True; continue
    if c == '"' and in_str: in_str = False; continue
    if in_str: continue
    if c == "{": depth += 1
    elif c == "}":
        depth -= 1
        if depth == 0: end = i + 1; break

config = json.loads(html[start:end])
print("提取成功")

# 2. 应用 oz 修复
def fix_oz(node):
    if node.get("name") in ("lowerHull", "upperHull") and node.get("type") == "TaperedBox":
        sz = node["size"]
        if len(sz) >= 7: sz[5] = 0; sz[6] = 0; node["size"] = sz
    for c in node.get("children", []): fix_oz(c)
fix_oz(config)

# 3. 烘焙昆虫腿姿态 (applyInsectPose 的逻辑)
def find_child(parent, name):
    for c in parent.get("children", []):
        if c.get("name") == name: return c
    return None

leg_info = {
    "FL": ("L", "front"), "FR": ("R", "front"),
    "ML": ("L", "mid"),   "MR": ("R", "mid"),
    "RL": ("L", "rear"),  "RR": ("R", "rear"),
}

for leg_id, (side, pos) in leg_info.items():
    is_right = (side == "R")

    # 与 debug HTML 中 applyInsectPose() 完全一致
    thigh_angle = 2.09 if is_right else -2.09
    shin_angle = -1.4 if is_right else 1.4

    if pos == "front":
        leg_y = 1.05 if is_right else -1.05
    elif pos == "rear":
        leg_y = -1.05 if is_right else 1.05
    else:
        leg_y = 0

    leg = find_child(config, "leg_" + leg_id)
    if leg:
        leg["rotation"] = [0, leg_y, 0]
        thigh = find_child(leg, "leg_" + leg_id + "_thigh")
        if thigh:
            thigh["rotation"] = [thigh_angle, 0, 0]
            shin = find_child(thigh, "leg_" + leg_id + "_shin")
            if shin:
                shin["rotation"] = [shin_angle, 0, 0]
                ankle = find_child(shin, "leg_" + leg_id + "_ankle")
                if ankle:
                    ankle_angle = -(thigh_angle + shin_angle)
                    ankle["rotation"] = [ankle_angle, 0, 0]
                    ankle["type"] = "TaperedBox"
                    ankle["size"] = [0.06, 0.25, 0.06, 0.05, 0.05]
                    ankle["position"] = [0, -0.4, 0]
                    ankle["pivot"] = [0, 0.125, 0]
                    if "segments" in ankle: del ankle["segments"]
                    foot = find_child(ankle, "leg_" + leg_id + "_foot")
                    if foot:
                        foot["position"] = [0, -0.155, -0.08 if is_right else 0.08]

# 4. 写共享文件
new_json = json.dumps(config, ensure_ascii=False)
shared = '// 六足战车模型配置\n// 通过 window.HexapodConfig 全局暴露\n(function() {\n\'use strict\';\n\nconst HEXAPOD_CONFIG = ' + new_json + ';\n\nwindow.HexapodConfig = { HEXAPOD_CONFIG: HEXAPOD_CONFIG };\n\n})();\n'

shared_path = os.path.join(BASE, "models", "hexapod_config.js")
with open(shared_path, "w", encoding="utf-8") as f:
    f.write(shared)
print("已写共享文件:", len(shared), "chars")

# 5. 验证
fl = find_child(config, "leg_FL")
if fl: print("leg_FL rotation:", fl.get("rotation"))
flt = find_child(config, "leg_FL_thigh")
if flt: print("leg_FL_thigh rotation:", flt.get("rotation"))
ankle = find_child(config, "leg_FL_ankle")
if ankle: print("leg_FL_ankle type:", ankle.get("type"), "size:", ankle.get("size"))
frf = find_child(config, "leg_FR_foot")
if frf: print("leg_FR_foot pos:", frf.get("position"))

print("Done")
