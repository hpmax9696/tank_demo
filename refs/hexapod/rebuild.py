#!/usr/bin/env python3
"""从 debug HTML 提取配置，应用 oz 修复，写共享文件，更新引用"""
import json, os

BASE = r"c:\Users\hpmax\Documents\tank_demo"

# 1. 从 debug HTML 提取配置
with open(os.path.join(BASE, "refs", "hexapod", "hexapod_debug.html"), "r", encoding="utf-8") as f:
    html = f.read()

idx = html.find("const HEXAPOD = ")
start = idx + len("const HEXAPOD = ")

depth = 0
in_str = False
esc = False
end = start
for i in range(start, len(html)):
    c = html[i]
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
            break

config = json.loads(html[start:end])
print("提取成功, 顶层键:", list(config.keys()))

# 2. 应用 oz 修复 (debug HTML 已手动修过，但也检查一下)
def find_nodes(node, name, results):
    if node.get("name") == name:
        results.append(node)
    for c in node.get("children", []):
        find_nodes(c, name, results)

def apply_oz_fix(node):
    if node.get("name") in ("lowerHull", "upperHull") and node.get("type") == "TaperedBox":
        sz = node["size"]
        if len(sz) >= 7:
            sz[5] = 0  # ox
            sz[6] = 0  # oz
            node["size"] = sz
    for c in node.get("children", []):
        apply_oz_fix(c)

apply_oz_fix(config)

# 检查
hulls = []
find_nodes(config, "lowerHull", hulls)
if hulls:
    print("lowerHull size:", hulls[0]["size"])

# 3. 写共享文件
new_json = json.dumps(config, ensure_ascii=False)
shared = '// 六足战车模型配置\n// 通过 window.HexapodConfig 全局暴露\n(function() {\n\'use strict\';\n\nconst HEXAPOD_CONFIG = ' + new_json + ';\n\nwindow.HexapodConfig = { HEXAPOD_CONFIG: HEXAPOD_CONFIG };\n\n})();\n'

shared_path = os.path.join(BASE, "models", "hexapod_config.js")
with open(shared_path, "w", encoding="utf-8") as f:
    f.write(shared)
print("已创建 hexapod_config.js:", len(shared), "chars")

# 4. 更新 model_configs.js — 在 MODEL_CONFIGS 中加 hexapod
mc_path = os.path.join(BASE, "models", "model_configs.js")
with open(mc_path, "r", encoding="utf-8") as f:
    mc = f.read()

# 在 MODEL_CONFIGS 对象中加 hexapod
mc = mc.replace(
    "building:BUILDING_CONFIG, enemy:ENEMY_CONFIG",
    "building:BUILDING_CONFIG, enemy:ENEMY_CONFIG, hexapod:(window.HexapodConfig && window.HexapodConfig.HEXAPOD_CONFIG) || {}"
)
# 在导出中也加 HEXAPOD_CONFIG
mc = mc.replace(
    "window.ModelConfigs = { T34_85_V16_CONFIG, BUILDING_CONFIG, ENEMY_CONFIG, MODEL_CONFIGS };",
    "window.ModelConfigs = { T34_85_V16_CONFIG, BUILDING_CONFIG, ENEMY_CONFIG, get HEXAPOD_CONFIG() { return (window.HexapodConfig && window.HexapodConfig.HEXAPOD_CONFIG) || {}; }, MODEL_CONFIGS };"
)
with open(mc_path, "w", encoding="utf-8") as f:
    f.write(mc)
print("已更新 model_configs.js")

# 5. 更新 enemies.js — 替换 HEXAPOD_MODEL_CONFIG
en_path = os.path.join(BASE, "models", "enemies.js")
with open(en_path, "r", encoding="utf-8") as f:
    en = f.read()

# 找 HEXAPOD_MODEL_CONFIG 定义并替换
en_idx = en.find("const HEXAPOD_MODEL_CONFIG = ")
if en_idx >= 0:
    en_start = en_idx + len("const HEXAPOD_MODEL_CONFIG = ")
    # 找匹配的 ]};
    depth = 0
    in_str = False
    esc = False
    for i in range(en_start, len(en)):
        c = en[i]
        if esc: esc = False; continue
        if c == "\\": esc = True; continue
        if c == '"' and not in_str: in_str = True; continue
        if c == '"' and in_str: in_str = False; continue
        if in_str: continue
        if c == "{": depth += 1
        elif c == "}":
            depth -= 1
            if depth == 0:
                en_end = i + 1
                break
    en = en[:en_idx] + "const HEXAPOD_MODEL_CONFIG = (window.HexapodConfig && window.HexapodConfig.HEXAPOD_CONFIG) || {};" + en[en_end:]
    with open(en_path, "w", encoding="utf-8") as f:
        f.write(en)
    print("已更新 enemies.js")
else:
    print("WARNING: 未找到 HEXAPOD_MODEL_CONFIG")

# 6. 更新 model_factory.html 加载 hexapod_config.js
mf_path = os.path.join(BASE, "model_factory.html")
with open(mf_path, "r", encoding="utf-8") as f:
    mf = f.read()

# 在 model_configs.js 之前加载
old = '<script src="models/model_configs.js"></script>'
new = '<script src="models/hexapod_config.js"></script>\n<script src="models/model_configs.js"></script>'
if old in mf:
    mf = mf.replace(old, new)
    with open(mf_path, "w", encoding="utf-8") as f:
        f.write(mf)
    print("已更新 model_factory.html (加载 hexapod_config.js)")
else:
    print("WARNING: 未找到 model_configs.js 的 script 标签")

# 7. 更新 index.html 加载 hexapod_config.js
idx_path = os.path.join(BASE, "index.html")
with open(idx_path, "r", encoding="utf-8") as f:
    idx_text = f.read()

# 在 enemies.js 之前或附近加载
old2 = '<script src="models/enemies.js"></script>'
new2 = '<script src="models/hexapod_config.js"></script>\n<script src="models/enemies.js"></script>'
if old2 in idx_text:
    idx_text = idx_text.replace(old2, new2)
    with open(idx_path, "w", encoding="utf-8") as f:
        f.write(idx_text)
    print("已更新 index.html (加载 hexapod_config.js)")
else:
    print("WARNING: 未找到 enemies.js 的 script 标签")

print("\n全部完成!")
