#!/usr/bin/env python3
"""六足战车固化脚本 — 将导出的JSON更新到共享配置文件"""
import json, os, sys

BASE = r"c:\Users\hpmax\Documents\tank_demo"
SHARED_FILE = os.path.join(BASE, "models", "hexapod_config.js")
JSON_FILE = os.path.join(BASE, "refs", "hexapod", "固化配置.json")

if not os.path.exists(JSON_FILE):
    print(f"请将模型工厂导出的JSON放到: {JSON_FILE}")
    sys.exit(1)

with open(JSON_FILE, "r", encoding="utf-8") as f:
    config = json.load(f)

# 确保是有效的六足战车配置
if not isinstance(config, dict) or "name" not in config:
    print("JSON格式无效，请确认是模型工厂导出的固化配置")
    sys.exit(1)

print(f"配置名称: {config.get('name', '?')}")
print(f"子节点数: {len(config.get('children', []))}")

new_json = json.dumps(config, ensure_ascii=False)

# 写共享文件
shared = '// 六足战车模型配置\n// 通过 window.HexapodConfig 全局暴露\n(function() {\n\'use strict\';\n\nconst HEXAPOD_CONFIG = ' + new_json + ';\n\nwindow.HexapodConfig = { HEXAPOD_CONFIG: HEXAPOD_CONFIG };\n\n})();\n'

with open(SHARED_FILE, "w", encoding="utf-8") as f:
    f.write(shared)

print(f"✅ 已固化到: {SHARED_FILE}")
print("请 Ctrl+F5 刷新模型工厂查看效果")
