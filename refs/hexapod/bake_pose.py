#!/usr/bin/env python3
"""将昆虫腿外伸姿态烘焙进 HEXAPOD_MODEL_CONFIG"""
import json, re, os, copy

BASE = r"c:\Users\hpmax\Documents\tank_demo"
files = [
    os.path.join(BASE, "models", "model_configs.js"),
    os.path.join(BASE, "models", "enemies.js"),
]

def find_hexapod_json(text):
    """从 JS 文件中提取 HEXAPOD 配置 JSON"""
    # 在 model_configs.js 中是: const HEXAPOD_CONFIG = {...};
    # 在 enemies.js 中是: const HEXAPOD_MODEL_CONFIG = {...};
    for prefix in ['const HEXAPOD_CONFIG = ', 'const HEXAPOD_MODEL_CONFIG = ']:
        idx = text.find(prefix)
        if idx >= 0:
            start = idx + len(prefix)
            # 找到匹配的结尾 };（第一个顶层 };）
            depth = 0
            in_str = False
            esc = False
            for i in range(start, len(text)):
                c = text[i]
                if esc:
                    esc = False
                    continue
                if c == '\\':
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
                if c == '{':
                    depth += 1
                elif c == '}':
                    depth -= 1
                    if depth == 0:
                        json_str = text[start:i+1]
                        return json_str, start, i+1, prefix
    return None, -1, -1, None

def bake_leg_rotations(config):
    """给每条腿的关节加旋转 + 脚踝改长"""
    leg_map = {
        'FL': {'side': 'L', 'pos': 'front'},
        'FR': {'side': 'R', 'pos': 'front'},
        'ML': {'side': 'L', 'pos': 'mid'},
        'MR': {'side': 'R', 'pos': 'mid'},
        'RL': {'side': 'L', 'pos': 'rear'},
        'RR': {'side': 'R', 'pos': 'rear'},
    }

    def find_node(nodes, name):
        for n in nodes:
            if n.get('name') == name:
                return n
        return None

    def find_children(parent, name):
        for c in parent.get('children', []):
            if c.get('name') == name:
                return c
        return None

    root_children = config.get('children', [])

    for leg_id, info in leg_map.items():
        is_right = (info['side'] == 'R')
        side_sign = -1 if is_right else 1

        # 大腿外展与Y+成60° (rot X = 2.09)
        thigh_angle = 2.09 * side_sign  # right: -2.09, left: +2.09? No...
        # In our debug code: isRight ? 2.09 : -2.09
        # So right thigh: +2.09, left thigh: -2.09
        thigh_angle = 2.09 if is_right else -2.09

        # 膝部弯回
        shin_angle = -1.4 if is_right else 1.4

        # 脚踝补偿使脚底水平
        ankle_angle = -(thigh_angle + shin_angle)

        # 腿组水平摆动(Y轴)
        if info['pos'] == 'front':
            leg_y_rot = 1.05 if is_right else -1.05
        elif info['pos'] == 'rear':
            leg_y_rot = -1.05 if is_right else 1.05
        else:
            leg_y_rot = 0

        # 找腿 Group
        leg_group = find_children(config, 'leg_' + leg_id)
        if leg_group:
            leg_group['rotation'] = [0, leg_y_rot, 0]

            thigh = find_children(leg_group, 'leg_' + leg_id + '_thigh')
            if thigh:
                thigh['rotation'] = [thigh_angle, 0, 0]

                shin = find_children(thigh, 'leg_' + leg_id + '_shin')
                if shin:
                    shin['rotation'] = [shin_angle, 0, 0]

                    ankle = find_children(shin, 'leg_' + leg_id + '_ankle')
                    if ankle:
                        ankle['rotation'] = [ankle_angle, 0, 0]
                        # 脚踝加长：Cylinder→TaperedBox, 高度0.12→0.25
                        ankle['type'] = 'TaperedBox'
                        ankle['size'] = [0.06, 0.25, 0.06, 0.05, 0.05]
                        ankle['position'] = [0, -0.40, 0]
                        ankle['pivot'] = [0, 0.125, 0]
                        if 'segments' in ankle:
                            del ankle['segments']

                        foot = find_children(ankle, 'leg_' + leg_id + '_foot')
                        if foot:
                            # 脚下移补偿(加长0.13m)
                            foot['position'] = [0, -0.155, 0.08]
                            # 右脚Z翻转向外
                            if is_right:
                                foot['position'][2] = -0.08

    return config

# ── 处理文件 ──
for filepath in files:
    with open(filepath, 'r', encoding='utf-8') as f:
        text = f.read()

    json_str, start, end, prefix = find_hexapod_json(text)
    if not json_str:
        print(f"SKIP {filepath}: 未找到HEXAPOD配置")
        continue

    # 清理 JS 注释 (// ... \n)
    clean = re.sub(r'//[^\n]*\n', '\n', json_str)
    clean = re.sub(r',\s*([}\]])', r'\1', clean)  # 移除尾部逗号
    config = json.loads(clean)
    config = bake_leg_rotations(config)

    new_json = json.dumps(config, ensure_ascii=False, separators=(',', ':'))
    new_text = text[:start] + new_json + text[end:]

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(new_text)
    print(f"OK {filepath}: {len(new_text)} chars")

print("Done")
