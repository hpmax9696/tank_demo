#!/usr/bin/env python3
"""修复：将 leg_XX_stripe 从 leg Group 移到 thigh 下，使其跟随大腿姿态"""
import json, os

BASE = r"c:\Users\hpmax\Documents\tank_demo"

with open(os.path.join(BASE, "models", "hexapod_config.js"), "r", encoding="utf-8") as f:
    text = f.read()

# 提取 JSON
idx = text.find("const HEXAPOD_CONFIG = ")
start = idx + len("const HEXAPOD_CONFIG = ")
end_marker = ";\n\nwindow.HexapodConfig"
end = text.find(end_marker)
if end < 0: end_marker = ";window.HexapodConfig"; end = text.find(end_marker)
config = json.loads(text[start:end])

def find_child(parent, name):
    for c in parent.get("children", []):
        if c.get("name") == name: return c
    return None

def remove_child(parent, name):
    parent["children"] = [c for c in parent.get("children", []) if c.get("name") != name]

# 遍历6条腿
for leg_id in ["FL", "FR", "ML", "MR", "RL", "RR"]:
    leg = find_child(config, "leg_" + leg_id)
    if not leg: continue

    stripe_name = "leg_" + leg_id + "_stripe"
    stripe = find_child(leg, stripe_name)
    if not stripe: continue

    thigh = find_child(leg, "leg_" + leg_id + "_thigh")
    if not thigh: continue

    # 从 leg Group 移除 stripe
    remove_child(leg, stripe_name)

    # stripe 原本在 leg Group 下的位置 [0, -0.15, +/-0.075]
    # leg Group 没有 pivot，所以 childComp=[0,0,0]
    # thigh 的位置是 [0, -0.35, 0] 且 pivot=[0, 0.35, 0]
    # 所以 thigh 的 rotTarget(hip pivot) 在 Group 原点
    # stripe 应该放在 thigh 下，位置相对 hip pivot
    # stripe 原位置相对 Group: [0, -0.15, 0.075]
    # thigh 的 rotTarget 在 Group 原点 = hip joint
    # 直接保持 stripe 位置不变（相对 hip pivot）
    # stripe 位置 = [0, -0.15, 原Z]
    oldZ = stripe["position"][2]
    # 让 stripe 稍微贴在大腿表面
    stripe["position"] = [0, -0.15, oldZ]

    # 添加到 thigh 的 children
    if "children" not in thigh: thigh["children"] = []
    thigh["children"].append(stripe)

    print(f"已修复 {stripe_name}: 移到 {thigh['name']} 下, pos={stripe['position']}")

# 写回
new_json = json.dumps(config, ensure_ascii=False)
shared = '// 六足战车模型配置\n// 通过 window.HexapodConfig 全局暴露\n(function() {\n\'use strict\';\n\nconst HEXAPOD_CONFIG = ' + new_json + ';\n\nwindow.HexapodConfig = { HEXAPOD_CONFIG: HEXAPOD_CONFIG };\n\n})();\n'
with open(os.path.join(BASE, "models", "hexapod_config.js"), "w", encoding="utf-8") as f:
    f.write(shared)
print("\n已更新 hexapod_config.js")
