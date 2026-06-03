#!/usr/bin/env python3
"""旋转六足战车对齐模型工厂前视图 + 全部中文命名"""
import json, os, math

BASE = r"c:\Users\hpmax\Documents\tank_demo"

with open(os.path.join(BASE, "models", "hexapod_config.js"), "r", encoding="utf-8") as f:
    text = f.read()

idx = text.find("const HEXAPOD_CONFIG = ")
start = idx + len("const HEXAPOD_CONFIG = ")
end_marker = ";\n\nwindow.HexapodConfig"
end = text.find(end_marker)
config = json.loads(text[start:end])

# ── 1. 旋转 root 90° 绕 Y，使前(-X)对齐工厂前视图(+Z) ──
# 当前 root rotation = [0,0,0]. 加 π/2 使 -X → +Z
old_rot = config.get("rotation", [0,0,0])
config["rotation"] = [0, math.pi/2, 0]
print(f"Root rotation: {old_rot} → {config['rotation']}")

# ── 2. 全部中文命名 ──
name_map = {
    "HexapodRoot": "六足战车",
    "chassis": "车体",
    "lowerHull": "下车体",
    "upperHull": "上车体",
    "frontArmor": "前装甲",
    "rearPlate": "后装甲板",
    "sideSkirtL": "左侧裙板",
    "sideSkirtR": "右侧裙板",
    "obsDome": "观瞄球体",
    "domeNeck": "观瞄底座",
    "visionSlit": "观察缝",
    "topPanel": "顶部面板",
    "ventL": "左散热口",
    "ventR": "右散热口",
    "stripeFL": "左前警示条",
    "stripeFR": "右前警示条",
    "stripeRL": "左后警示条",
    "stripeRR": "右后警示条",
    "weapon_L_shoulder": "左武器平台",
    "weapon_L_gatling": "左加特林",
    "gatlingL_shroud": "左加特林护套",
    "gatlingL_barrel1": "左加特林枪管1",
    "gatlingL_barrel2": "左加特林枪管2",
    "gatlingL_barrel3": "左加特林枪管3",
    "gatlingL_barrel4": "左加特林枪管4",
    "gatlingL_feed": "左加特林弹链",
    "weapon_L_missile": "左导弹巢",
    "missileL_housing": "左导弹外壳",
    "missileL_tube1": "左导弹管1",
    "missileL_tube2": "左导弹管2",
    "missileL_tube3": "左导弹管3",
    "missileL_tube4": "左导弹管4",
    "weapon_R_shoulder": "右武器平台",
    "weapon_R_gatling": "右加特林",
    "gatlingR_shroud": "右加特林护套",
    "gatlingR_barrel1": "右加特林枪管1",
    "gatlingR_barrel2": "右加特林枪管2",
    "gatlingR_barrel3": "右加特林枪管3",
    "gatlingR_barrel4": "右加特林枪管4",
    "gatlingR_feed": "右加特林弹链",
    "weapon_R_missile": "右导弹巢",
    "missileR_housing": "右导弹外壳",
    "missileR_tube1": "右导弹管1",
    "missileR_tube2": "右导弹管2",
    "missileR_tube3": "右导弹管3",
    "missileR_tube4": "右导弹管4",
    "leg_FL": "左前腿",
    "leg_FL_thigh": "左前大腿",
    "leg_FL_shin": "左前小腿",
    "leg_FL_ankle": "左前脚踝",
    "leg_FL_foot": "左前脚掌",
    "leg_FL_kneeCap": "左前膝球",
    "leg_FL_hipDeco": "左前髋球",
    "leg_FL_stripe": "左前腿警示条",
    "leg_FR": "右前腿",
    "leg_FR_thigh": "右前大腿",
    "leg_FR_shin": "右前小腿",
    "leg_FR_ankle": "右前脚踝",
    "leg_FR_foot": "右前脚掌",
    "leg_FR_kneeCap": "右前膝球",
    "leg_FR_hipDeco": "右前髋球",
    "leg_FR_stripe": "右前腿警示条",
    "leg_ML": "左中腿",
    "leg_ML_thigh": "左中大腿",
    "leg_ML_shin": "左中小腿",
    "leg_ML_ankle": "左中脚踝",
    "leg_ML_foot": "左中脚掌",
    "leg_ML_kneeCap": "左中膝球",
    "leg_ML_hipDeco": "左中髋球",
    "leg_ML_stripe": "左中腿警示条",
    "leg_MR": "右中腿",
    "leg_MR_thigh": "右中大腿",
    "leg_MR_shin": "右中小腿",
    "leg_MR_ankle": "右中脚踝",
    "leg_MR_foot": "右中脚掌",
    "leg_MR_kneeCap": "右中膝球",
    "leg_MR_hipDeco": "右中髋球",
    "leg_MR_stripe": "右中腿警示条",
    "leg_RL": "左后腿",
    "leg_RL_thigh": "左后大腿",
    "leg_RL_shin": "左后小腿",
    "leg_RL_ankle": "左后脚踝",
    "leg_RL_foot": "左后脚掌",
    "leg_RL_kneeCap": "左后膝球",
    "leg_RL_hipDeco": "左后髋球",
    "leg_RL_stripe": "左后腿警示条",
    "leg_RR": "右后腿",
    "leg_RR_thigh": "右后大腿",
    "leg_RR_shin": "右后小腿",
    "leg_RR_ankle": "右后脚踝",
    "leg_RR_foot": "右后脚掌",
    "leg_RR_kneeCap": "右后膝球",
    "leg_RR_hipDeco": "右后髋球",
    "leg_RR_stripe": "右后腿警示条",
}

def rename_node(node):
    old = node.get("name", "")
    if old in name_map:
        node["name"] = name_map[old]
    # Also rename children references in the node
    if "children" in node:
        for c in node["children"]:
            rename_node(c)

rename_node(config)

# 验证几个关键改名
def find_by_name(node, name):
    if node.get("name") == name: return node
    for c in node.get("children", []):
        r = find_by_name(c, name)
        if r: return r
    return None

print("左前腿:", find_by_name(config, "左前腿")["name"] if find_by_name(config, "左前腿") else "NOT FOUND")
print("右前大腿:", find_by_name(config, "右前大腿")["name"] if find_by_name(config, "右前大腿") else "NOT FOUND")

# 写回
new_json = json.dumps(config, ensure_ascii=False)
shared = '// 六足战车模型配置\n// 通过 window.HexapodConfig 全局暴露\n(function() {\n\'use strict\';\n\nconst HEXAPOD_CONFIG = ' + new_json + ';\n\nwindow.HexapodConfig = { HEXAPOD_CONFIG: HEXAPOD_CONFIG };\n\n})();\n'
with open(os.path.join(BASE, "models", "hexapod_config.js"), "w", encoding="utf-8") as f:
    f.write(shared)
print("\n已更新 hexapod_config.js")
