#!/usr/bin/env python3
"""提取 HEXAPOD_CONFIG 为独立共享文件"""
import re, json

BASE = r"c:\Users\hpmax\Documents\tank_demo\models"

with open(BASE + r"\model_configs.js", "r", encoding="utf-8") as f:
    text = f.read()

# 找到 const HEXAPOD_CONFIG =
idx = text.find("const HEXAPOD_CONFIG = ")
start = idx + len("const HEXAPOD_CONFIG = ")

# 括号匹配找结尾
depth = 0
in_str = False
esc = False
end = start
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
            break

json_str = text[start:end]

# 去掉 JS 单行注释
lines = json_str.split("\n")
clean_lines = []
for line in lines:
    # 找 // 但不在字符串内
    stripped = line.strip()
    if stripped.startswith("//"):
        clean_lines.append("")
    else:
        clean_lines.append(line)
clean = "\n".join(clean_lines)

# 去掉尾部逗号
clean = re.sub(r",\s*([}\]])", r"\1", clean)

# 验证
try:
    config = json.loads(clean)
    print("Valid JSON, top keys:", list(config.keys()))
except json.JSONDecodeError as e:
    print("JSON error:", e)
    # 打印出错位置周围
    pos = e.pos
    print("Context:", clean[max(0,pos-50):pos+50])
    raise

# 写共享文件
shared = """// 六足战车模型配置 — 共享于 model_factory 和 enemies.js
// 通过 window.HexapodConfig 全局暴露
(function() {
'use strict';

const HEXAPOD_CONFIG = """

shared += json.dumps(config, ensure_ascii=False)

shared += """;

window.HexapodConfig = { HEXAPOD_CONFIG: HEXAPOD_CONFIG };

})();
"""

with open(BASE + r"\hexapod_config.js", "w", encoding="utf-8") as f:
    f.write(shared)
print("Created hexapod_config.js:", len(shared), "chars")
