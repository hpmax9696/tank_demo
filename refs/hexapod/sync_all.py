#!/usr/bin/env python3
"""一键同步：修复oz + 姿态烘焙 + 提取共享文件 + 更新引用"""
import json, re, os

BASE = r"c:\Users\hpmax\Documents\tank_demo"

# ── 步骤1: 从 model_configs.js 提取原始 HEXAPOD_CONFIG ──
def find_config_json(text, var_name):
    """从JS文本中提取 const VAR_NAME = {...}; 的JSON部分"""
    idx = text.find("const " + var_name + " = ")
    if idx < 0:
        return None, -1, -1
    start = idx + len("const " + var_name + " = ")
    # 括号匹配
    depth = 0
    in_str = False
    esc = False
    for i in range(start, len(text)):
        c = text[i]
        if esc:
            esc = False
            continue
        if c == "\\":
            esc = True
            continue
        if c == '"' and not in_str:
            in_str = True
            continue
        if c == '"' and in_str:
            in_str = False
            continue
        if in_str:
            continue
        if c == "{":
            depth += 1
        elif c == "}":
            depth -= 1
            if depth == 0:
                end = i + 1
                json_like = text[start:end]
                return json_like, start, end
    return None, -1, -1

def clean_js_json(js_json):
    """移除JS注释、尾部逗号，转为合法JSON"""
    lines = js_json.split("\n")
    clean_lines = []
    for line in lines:
        s = line.strip()
        if s.startswith("//"):
            clean_lines.append("")
        else:
            clean_lines.append(line)
    result = "\n".join(clean_lines)
    result = re.sub(r",\s*([}\]])", r"\1", result)
    return result

with open(os.path.join(BASE, "models", "model_configs.js"), "r", encoding="utf-8") as f:
    mc_text = f.read()

js_json, mc_start, mc_end = find_config_json(mc_text, "HEXAPOD_CONFIG")
if not js_json:
    print("ERROR: 未找到 HEXAPOD_CONFIG 在 model_configs.js")
    exit(1)

clean = clean_js_json(js_json)
config = json.loads(clean)
print("已提取 HEXAPOD_CONFIG, 顶层键:", list(config.keys()))

# ── 步骤2: 应用所有修复 ──
def apply_fixes(config):
    """oz归零 + 腿部rotation烘焙 + 脚踝加长 + 脚位修正"""
    # 找车体节点修复oz
    def fix_node(node):
        if node.get("name") == "lowerHull" and node.get("type") == "TaperedBox":
            sz = node["size"]
            if len(sz) >= 7:
                sz[5] = 0  # ox
                sz[6] = 0  # oz
                node["size"] = sz
        if node.get("name") == "upperHull" and node.get("type") == "TaperedBox":
            sz = node["size"]
            if len(sz) >= 7:
                sz[5] = 0
                sz[6] = 0
                node["size"] = sz
        for c in node.get("children", []):
            fix_node(c)

    fix_node(config)

    # 腿姿态
    leg_info = {
        "FL": ("L", "front"), "FR": ("R", "front"),
        "ML": ("L", "mid"),   "MR": ("R", "mid"),
        "RL": ("L", "rear"),  "RR": ("R", "rear"),
    }

    def find_child(parent, name):
        for c in parent.get("children", []):
            if c.get("name") == name:
                return c
        return None

    for leg_id, (side, pos) in leg_info.items():
        is_right = (side == "R")

        # 旋转参数
        thigh_angle = 2.09 if is_right else -2.09
        shin_angle = -1.4 if is_right else 1.4
        ankle_angle = -(thigh_angle + shin_angle)

        if pos == "front":
            leg_y = 1.05 if is_right else -1.05
        elif pos == "rear":
            leg_y = -1.05 if is_right else 1.05
        else:
            leg_y = 0

        leg = find_child(config, "leg_" + leg_id)
        if not leg:
            continue
        leg["rotation"] = [0, leg_y, 0]

        thigh = find_child(leg, "leg_" + leg_id + "_thigh")
        if thigh:
            thigh["rotation"] = [thigh_angle, 0, 0]

            shin = find_child(thigh, "leg_" + leg_id + "_shin")
            if shin:
                shin["rotation"] = [shin_angle, 0, 0]

                ankle = find_child(shin, "leg_" + leg_id + "_ankle")
                if ankle:
                    ankle["rotation"] = [ankle_angle, 0, 0]
                    ankle["type"] = "TaperedBox"
                    ankle["size"] = [0.06, 0.25, 0.06, 0.05, 0.05]
                    ankle["position"] = [0, -0.4, 0]
                    ankle["pivot"] = [0, 0.125, 0]
                    if "segments" in ankle:
                        del ankle["segments"]

                    foot = find_child(ankle, "leg_" + leg_id + "_foot")
                    if foot:
                        foot["position"] = [0, -0.155, -0.08 if is_right else 0.08]

    return config

config = apply_fixes(config)
new_json = json.dumps(config, ensure_ascii=False)
print("修复完成, JSON长度:", len(new_json))

# ── 步骤3: 写共享文件 ──
shared = """// 六足战车模型配置 — 共享于 model_factory 和 enemies.js
// 通过 window.HexapodConfig 全局暴露
(function() {
'use strict';

const HEXAPOD_CONFIG = """

shared += new_json

shared += """;

window.HexapodConfig = { HEXAPOD_CONFIG: HEXAPOD_CONFIG };

})();
"""

shared_path = os.path.join(BASE, "models", "hexapod_config.js")
with open(shared_path, "w", encoding="utf-8") as f:
    f.write(shared)
print("已创建:", shared_path, "(", len(shared), "chars )")

# ── 步骤4: 更新 model_configs.js ──
mc_new = mc_text[:mc_start] + "(window.HexapodConfig && window.HexapodConfig.HEXAPOD_CONFIG) || {}" + mc_text[mc_end:]
with open(os.path.join(BASE, "models", "model_configs.js"), "w", encoding="utf-8") as f:
    f.write(mc_new)
print("已更新 model_configs.js")

# ── 步骤5: 更新 enemies.js ──
with open(os.path.join(BASE, "models", "enemies.js"), "r", encoding="utf-8") as f:
    en_text = f.read()

js_json2, en_start, en_end = find_config_json(en_text, "HEXAPOD_MODEL_CONFIG")
if js_json2:
    en_new = en_text[:en_start] + "(window.HexapodConfig && window.HexapodConfig.HEXAPOD_CONFIG) || {}" + en_text[en_end:]
    with open(os.path.join(BASE, "models", "enemies.js"), "w", encoding="utf-8") as f:
        f.write(en_new)
    print("已更新 enemies.js")
else:
    print("WARNING: 未找到 HEXAPOD_MODEL_CONFIG 在 enemies.js")

print("\nDone! 现在需要在 model_factory.html 和 index.html 中加载 models/hexapod_config.js")
