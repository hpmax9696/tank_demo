#!/usr/bin/env python3
"""
坦克履带参数自动计算 — 根据诱导轮/主动轮/负重轮位置，生成紧密围绕的 trackParams。

用法:
  python compute_track_params.py --file models/tiger_v16_builder.js --config TIGER_I_V16_CONFIG
  python compute_track_params.py --file models/tiger_v16_builder.js --config TIGER_I_V16_CONFIG --apply

模型:
  - 读取 builder.js 中的 `const XXX_CONFIG = {...}` (合法 JSON)
  - 按 name 识别轮子: 诱导轮 / 主动轮 / 负重轮(排除"内轮"/"拖带轮")
  - 按 X 坐标分左右履带 (X<0 左, X>0 右)
  - 转换到履带组局部坐标 (轮子pos - 履带pos)
  - 输出/写回 trackParams

路径模型 (6 段封闭环路, model_factory.html buildTrackChain):
  AB 上支路(主动轮顶→诱导轮顶) → BC 前弧(绕诱导轮) → CD 下前斜(诱导轮→首负重轮)
  → DE 下主干(贴所有负重轮底) → EF 下后斜(尾负重轮→主动轮) → FA 后弧(绕主动轮)
"""
import argparse
import json
import re
import sys

# Windows 控制台默认 GBK, 强制 UTF-8 输出中文
try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass

# 周长估算 — 复现 buildTrackChain 的 6 段几何 (角度固定: C=-120°, D=-105°, E=-75°, F=-75°)
ANGLE_C = -120 * 3.141592653589793 / 180
ANGLE_D = -105 * 3.141592653589793 / 180
ANGLE_E = -75 * 3.141592653589793 / 180
ANGLE_F = -75 * 3.141592653589793 / 180


def load_config(filepath, config_name):
    """用 node eval 解析配置 (兼容合法 JSON 和 JS 对象字面量, 因格式化器可能转单引号无引号)."""
    import subprocess
    script = (
        "const fs=require('fs');const t=fs.readFileSync("
        + json.dumps(filepath)
        + ",'utf8');const s=t.indexOf('const " + config_name + "');let b=t.indexOf('{',s);"
        "let d=0,i=b;for(;i<t.length;i++){if(t[i]==='{')d++;else if(t[i]==='}'){d--;if(d===0)break;}}"
        "console.log(JSON.stringify(eval('('+t.slice(b,i+1)+')')));"
    )
    r = subprocess.run(['node', '-e', script], capture_output=True, encoding='utf-8', errors='replace')
    if r.returncode != 0 or not r.stdout.strip():
        sys.exit(f'node 解析失败:\n{r.stderr}')
    return json.loads(r.stdout), r.stdout


def classify_wheels(cfg):
    """从配置树收集所有轮子 + 履带节点 (递归)."""
    wheels, tracks = [], []
    def walk(node):
        if not isinstance(node, dict): return
        name = node.get('name', '')
        ntype = node.get('type', '')
        if ntype == 'TrackChain':
            tracks.append(node)
        elif ntype == 'Cylinder' and node.get('position'):
            if '内轮' in name or '拖带' in name or '托带' in name:
                pass  # 跳过内轮/拖带轮
            elif '诱导轮' in name:
                wheels.append(('iduce', name, node))
            elif '主动轮' in name:
                wheels.append(('drive', name, node))
            elif '负重轮' in name:
                wheels.append(('road', name, node))
        for c in node.get('children', []):
            walk(c)
    walk(cfg)
    return wheels, tracks


def side_of(pos):
    return 'L' if pos[0] < 0 else 'R'


def compute_track_for_side(track, wheels, side):
    """计算单侧履带的 trackParams. wheels = [(kind,name,node),...] 全量, side='L'/'R'."""
    tx, ty, tz = track['position']
    def local(node):
        x, y, z = node['position']
        return (x - tx, y - ty, z - tz)
    def radius(node):
        return node['size'][0]  # Cylinder size[0]=半径

    side_w = [(k, n, nd) for k, n, nd in wheels if side_of(nd['position']) == side]
    iduce = [w for w in side_w if w[0] == 'iduce']
    drive = [w for w in side_w if w[0] == 'drive']
    roads = [w for w in side_w if w[0] == 'road']

    if not iduce or not drive or not roads:
        return None, f'侧 {side}: 轮子不全 (诱导{len(iduce)} 主动{len(drive)} 负重{len(roads)})'

    # 容错: 若按 name 未识别, 用 Z 极端兜底 (诱导=Z最大, 主动=Z最小)
    ind = iduce[0][2]
    drv = drive[0][2]
    # 负重轮按 Z 排序, 首(前/Z最大)尾(后/Z最小)
    roads_sorted = sorted(roads, key=lambda w: -w[2]['position'][2])
    first_road = roads_sorted[0][2]
    last_road = roads_sorted[-1][2]

    li = local(ind)
    ld = local(drv)
    lf, rf = first_road['position'][2] - tz, first_road['position'][1] - ty
    lrl, rrl = last_road['position'][2] - tz, last_road['position'][1] - ty
    road_y = (first_road['position'][1] + last_road['position'][1]) / 2 - ty
    road_r = radius(first_road)

    tp = {
        'wheelCenterZFront': round(li[2], 4),
        'wheelCenterYFront': round(li[1], 4),
        'wheelRadiusFront': round(radius(ind), 4),
        'wheelCenterZRear': round(ld[2], 4),
        'wheelCenterYRear': round(ld[1], 4),
        'wheelRadiusRear': round(radius(drv), 4),
        'roadWheelFrontZ': round(lf, 4),
        'roadWheelRearZ': round(lrl, 4),
        'roadWheelY': round(road_y, 4),
        'roadWheelRadius': round(road_r, 4),
    }

    # 周长 → count (保留原 plate 尺寸 + 间距基准)
    orig = track.get('trackParams', {})
    pw = orig.get('plateWidth', 0.5)
    ph = orig.get('plateHeight', 0.06)
    pd = orig.get('plateDepth', 0.08)
    total = total_length(tp)
    spacing = pd * 1.4  # T-34 基准: plateDepth 0.08 → spacing 0.112
    count = max(40, round(total / spacing) + 1)
    tp['count'] = count
    tp['plateWidth'] = pw
    tp['plateHeight'] = ph
    tp['plateDepth'] = pd
    return tp, f'周长={total:.3f} spacing={spacing:.3f} count={count}'


def total_length(tp):
    """复现 buildTrackChain 6 段周长."""
    zF, cyF, rF = tp['wheelCenterZFront'], tp['wheelCenterYFront'], tp['wheelRadiusFront']
    zR, cyR, rR = tp['wheelCenterZRear'], tp['wheelCenterYRear'], tp['wheelRadiusRear']
    zR1, zR5 = tp['roadWheelFrontZ'], tp['roadWheelRearZ']
    wR, wY = tp['roadWheelRadius'], tp['roadWheelY']
    import math
    pA = (zR - rR * math.cos(math.pi/2), cyR + rR * math.sin(math.pi/2))
    pB = (zF - rF * math.cos(math.pi/2), cyF + rF * math.sin(math.pi/2))
    pC = (zF - rF * math.cos(ANGLE_C), cyF + rF * math.sin(ANGLE_C))
    pD = (zR1 - wR * math.cos(ANGLE_D), wY + wR * math.sin(ANGLE_D))
    pE = (zR5 - wR * math.cos(ANGLE_E), wY + wR * math.sin(ANGLE_E))
    pF = (zR - rR * math.cos(ANGLE_F), cyR + rR * math.sin(ANGLE_F))
    def dist(a, b): return math.hypot(a[0]-b[0], a[1]-b[1])
    lenAB = dist(pB, pA)
    lenBC = (ANGLE_C + 2*math.pi - math.pi/2) * rF
    lenCD = dist(pD, pC)
    lenDE = abs(pE[0] - pD[0])
    lenEF = dist(pF, pE)
    lenFA = (math.pi/2 - ANGLE_F) * rR
    return lenAB + lenBC + lenCD + lenDE + lenEF + lenFA


def apply_to_file(filepath, track_name, new_tp):
    """括号匹配替换指定 TrackChain 节点的 trackParams 块 (兼容 JSON 和 JS 字面量格式)."""
    with open(filepath, 'r', encoding='utf-8') as f:
        text = f.read()
    # 定位 track 节点 (兼容 "name":"X" 和 name:'X')
    m = re.search(rf"name['\"]?\s*:\s*['\"]?{re.escape(track_name)}['\"]?", text)
    if not m:
        sys.exit(f'未找到履带节点 {track_name}')
    idx = m.start()
    # 定位该节点后的 trackParams 块
    m2 = re.search(r"trackParams['\"]?\s*:", text[idx:])
    if not m2:
        sys.exit(f'{track_name} 无 trackParams')
    brace_start = text.find('{', idx + m2.end())
    depth, i = 0, brace_start
    while i < len(text):
        if text[i] == '{': depth += 1
        elif text[i] == '}':
            depth -= 1
            if depth == 0: break
        i += 1
    new_block = '{\n' + ',\n'.join(
        '        ' + json.dumps(k, ensure_ascii=False) + ': ' + json.dumps(v, ensure_ascii=False)
        for k, v in new_tp.items()
    ) + '\n      }'
    new_text = text[:brace_start] + new_block + text[i+1:]
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(new_text)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--file', required=True)
    ap.add_argument('--config', required=True)
    ap.add_argument('--apply', action='store_true', help='直接写回源文件')
    args = ap.parse_args()

    cfg, _ = load_config(args.file, args.config)
    wheels, tracks = classify_wheels(cfg)
    if not tracks:
        sys.exit('未找到 TrackChain 节点')

    print(f'识别: 诱导{sum(1 for w in wheels if w[0]=="iduce")} '
          f'主动{sum(1 for w in wheels if w[0]=="drive")} '
          f'负重{sum(1 for w in wheels if w[0]=="road")} 履带{len(tracks)}')
    print()
    for tr in tracks:
        tname = tr.get('name', '?')
        side = 'L' if tr['position'][0] < 0 else 'R'
        tp, note = compute_track_for_side(tr, wheels, side)
        if tp is None:
            print(f'[{tname}] 失败: {note}')
            continue
        print(f'[{tname}] ({side})  {note}')
        print(json.dumps(tp, ensure_ascii=False, indent=2))
        if args.apply:
            apply_to_file(args.file, tname, tp)
            print(f'  → 已写回 {args.file}')
        print()


if __name__ == '__main__':
    main()
