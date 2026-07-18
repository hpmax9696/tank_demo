#!/usr/bin/env python3
"""
Tank Demo 开发服务器 — 静态文件 + 固化端点
启动: python server.py
"""
import http.server
import json
import os
import re
import sys
import urllib.request
import urllib.parse

PORT = 8080
BIND = '127.0.0.1'

# 模型类型 → (源文件, 常量名)
MODEL_MAP = {
    'tiger_v16': ('models/tiger_v16_builder.js', 'TIGER_I_V16_CONFIG'),
    'tank_v16': ('models/t34_v16_builder.js', 'T34_85_V16_CONFIG'),
    'hexapod': ('models/hexapod_config.js', 'HEXAPOD_CONFIG'),
}

CAMPUS_MAP = 'maps/campus.map.json'


def _find_config_bounds(text, const_name):
    """在 JS 源码中找到 const CONST_NAME = {...}; 的起止位置。"""
    pattern = rf'const\s+{const_name}\s*=\s*'
    m = re.search(pattern, text)
    if not m:
        return None, None

    start = m.start()
    # 找到 opening {
    brace_start = text.find('{', m.end())
    if brace_start == -1:
        return None, None

    # 数括号找 matching }
    depth = 1
    i = brace_start + 1
    while i < len(text) and depth > 0:
        if text[i] == '{':
            depth += 1
        elif text[i] == '}':
            depth -= 1
        i += 1

    if depth != 0:
        return None, None

    # 跳过可选的 ;
    end = i
    if end < len(text) and text[end] == ';':
        end += 1

    return start, end


def solidify_config(model_type, config_json_str):
    """将配置 JSON 写入对应源文件的配置常量。"""
    if model_type not in MODEL_MAP:
        raise ValueError(f'未知模型类型: {model_type}')

    filepath, const_name = MODEL_MAP[model_type]

    if not os.path.exists(filepath):
        raise FileNotFoundError(f'源文件不存在: {filepath}')

    with open(filepath, 'r', encoding='utf-8') as f:
        original = f.read()

    start, end = _find_config_bounds(original, const_name)
    if start is None:
        raise RuntimeError(f'在 {filepath} 中未找到 const {const_name} = {{...}};')

    # 格式化 JSON（2空格缩进）
    config_obj = json.loads(config_json_str)
    formatted = json.dumps(config_obj, indent=2, ensure_ascii=False)

    new_config = f'const {const_name} = {formatted};'
    new_content = original[:start] + new_config + original[end:]

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(new_content)

    return filepath


def solidify_campus(payload):
    """更新 campus.map.json 的 name 字段 + 可选 b7_buildings / edgeMarks。
    payload: {'names': {'buildings':{idx:name}, 'grounds':{idx:name}, 'b7':{idx:name}},
              'b7_buildings': [...] (可选, 整体替换),
              'edgeMarks': {'<idx>':[{ei,type},...]} (可选, 空[]=清除该楼标记)}"""
    if not os.path.exists(CAMPUS_MAP):
        raise FileNotFoundError(f'校园地图不存在: {CAMPUS_MAP}')
    with open(CAMPUS_MAP, 'r', encoding='utf-8') as f:
        data = json.load(f)
    obs = data.setdefault('obstacles', {})
    names = payload.get('names') or {}

    # 建筑 name (跳过 roofType==='dome' 的 B7 footprint)
    blds = obs.get('footprintBuildings') or []
    for k, v in (names.get('buildings') or {}).items():
        i = int(k)
        if 0 <= i < len(blds) and blds[i].get('roofType') != 'dome':
            blds[i]['name'] = v

    # 运动场 name
    gnds = obs.get('grounds') or []
    for k, v in (names.get('grounds') or {}).items():
        i = int(k)
        if 0 <= i < len(gnds):
            gnds[i]['name'] = v

    # b7_buildings name
    b7 = obs.get('b7_buildings') or []
    for k, v in (names.get('b7') or {}).items():
        i = int(k)
        if 0 <= i < len(b7):
            b7[i]['name'] = v

    # 整体替换 b7_buildings (b7_builder 保存时)
    if 'b7_buildings' in payload and payload['b7_buildings'] is not None:
        obs['b7_buildings'] = payload['b7_buildings']

    # 外廊/空调边标记 edgeMarks (building_edge_marker.html 保存)
    for k, v in (payload.get('edgeMarks') or {}).items():
        i = int(k)
        if 0 <= i < len(blds) and blds[i].get('roofType') != 'dome':
            if v:  # 非空才写(空=未标记→不写字段→渲染 fallback)
                blds[i]['edgeMarks'] = v
            elif 'edgeMarks' in blds[i]:
                del blds[i]['edgeMarks']  # 显式清除标记回 fallback

    # 厕所区域 toiletZones (toilet_zone_marker.html 保存)
    if 'zones' in payload and payload['zones'] is not None:
        obs['toiletZones'] = payload['zones']

    # b7_buildings edgeMarks (室内运动场/车棚 空调标记)
    for k, v in (payload.get('b7_edgeMarks') or {}).items():
        i = int(k)
        if 0 <= i < len(b7):
            if v:
                b7[i]['edgeMarks'] = v
            elif 'edgeMarks' in b7[i]:
                del b7[i]['edgeMarks']

    # 保持原文件内联坐标数组格式(避免 json.dump 展开成多行致全文件重排)
    s = json.dumps(data, ensure_ascii=False, indent=2)
    s = re.sub(
        r'\[\s*((?:-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?,\s*)*-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\s*)\]',
        lambda m: '[' + ', '.join(x.strip() for x in m.group(1).split(',')) + ']',
        s,
    )
    with open(CAMPUS_MAP, 'w', encoding='utf-8') as f:
        f.write(s)
    return CAMPUS_MAP


def overpass_proxy(ql):
    """用 node fetch 转发 Overpass QL (node fetch 对镜像兼容性优于 python urllib)。
    镜像列表在 overpass_fetch.js。返回 JSON 文本。"""
    import subprocess
    try:
        result = subprocess.run(
            ['node', 'overpass_fetch.js', ql],
            capture_output=True, timeout=90, text=True, encoding='utf-8')
    except subprocess.TimeoutExpired:
        raise RuntimeError('node fetch 超时(90s)')
    except FileNotFoundError:
        raise RuntimeError('node 未安装/不在 PATH')
    if result.returncode != 0:
        raise RuntimeError('node fetch 失败: ' + (result.stderr or '').strip()[:200])
    return result.stdout


class TankDemoHandler(http.server.SimpleHTTPRequestHandler):
    """静态文件服务 + POST /api/solidify"""

    def do_POST(self):
        if self.path == '/api/solidify':
            try:
                content_len = int(self.headers.get('Content-Length', 0))
                body = self.rfile.read(content_len)
                data = json.loads(body)

                # campus 命名/B7/厕所区域 保存分支
                if data.get('type') in ('campus', 'toiletZones'):
                    saved_path = solidify_campus(data)
                    self._json_ok({'file': saved_path})
                    return

                model_type = data.get('modelType', '')
                config = data.get('config', {})

                if not model_type or not config:
                    self._json_error(400, '缺少 modelType 或 config')
                    return

                config_json = json.dumps(config, ensure_ascii=False)
                saved_path = solidify_config(model_type, config_json)

                self._json_ok({'file': saved_path})
            except Exception as e:
                self._json_error(500, str(e))
        elif self.path == '/api/overpass':
            try:
                content_len = int(self.headers.get('Content-Length', 0))
                body = self.rfile.read(content_len).decode('utf-8')
                ql = urllib.parse.unquote(body[5:]) if body.startswith('data=') else body
                result = overpass_proxy(ql)
                b = result.encode('utf-8')
                self.send_response(200)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.send_header('Content-Length', str(len(b)))
                self.end_headers()
                self.wfile.write(b)
            except Exception as e:
                self._json_error(502, 'Overpass 代理失败: ' + str(e))
        else:
            super().do_POST()

    def _json_ok(self, data):
        body = json.dumps({'ok': True, **data}, ensure_ascii=False).encode('utf-8')
        self.send_response(200)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _json_error(self, code, msg):
        body = json.dumps({'error': msg}, ensure_ascii=False).encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def end_headers(self):
        # 开发服务器: 禁用缓存, 保证 Ctrl+F5 / 普通刷新都拿到最新文件
        # (SimpleHTTPRequestHandler 默认不发 Cache-Control, 浏览器启发式缓存 .js 导致改了不生效)
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def log_message(self, format, *args):
        # 精简日志：只显示 POST solidify
        if 'POST' in str(args):
            super().log_message(format, *args)


if __name__ == '__main__':
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    server = http.server.HTTPServer((BIND, PORT), TankDemoHandler)
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    print(f'Tank Demo 开发服务器: http://{BIND}:{PORT}')
    print(f'  静态文件 + /api/solidify 固化端点')
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('\n服务器已停止')
        server.server_close()
