#!/usr/bin/env python3
"""
履带贴合验证 — Playwright 切模型 + 侧视截图 + PIL 像素级测间隙。

用法:
  python verify_track_fit.py --model "🐅 虎式坦克 (v1.0)"
  python verify_track_fit.py --model "🐅 虎式坦克 (v1.0)" --out screenshots/tiger_fit.png

前提: server.py 已在 127.0.0.1:8080 运行。
依赖: playwright, PIL (项目已装)。
颜色假设 (模型工厂调试着色): 负重轮 steel=紫, 履带 dark_steel=蓝。
"""
import argparse
import sys
from PIL import Image

# Windows 控制台默认 GBK, 强制 UTF-8 输出中文
try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass

URL = 'http://127.0.0.1:8080/model_factory.html'


def screenshot_side(model_text, out_path):
    """用 node playwright 截侧视图 (项目用 node playwright, 非 python)."""
    import subprocess, os, json
    params = json.dumps({'url': URL, 'model': model_text, 'out': out_path})
    script = (
        "const { chromium } = require('playwright');\n"
        "const P = " + params + ";\n"
        "(async () => {\n"
        "  const b = await chromium.launch();\n"
        "  const p = await b.newPage({ viewport: { width: 1280, height: 800 } });\n"
        "  await p.goto(P.url, { waitUntil: 'networkidle' });\n"
        "  await p.waitForTimeout(1000);\n"
        "  await p.evaluate(t => {\n"
        "    const sel = [...document.querySelectorAll('select')].find(s => [...s.options].some(o => o.text.includes(t)));\n"
        "    if (!sel) throw new Error('no select for ' + t);\n"
        "    sel.value = [...sel.options].find(o => o.text.includes(t)).text;\n"
        "    sel.dispatchEvent(new Event('change', { bubbles: true }));\n"
        "  }, P.model);\n"
        "  await p.waitForTimeout(1000);\n"
        "  await p.click('button[data-view=\"right\"]');\n"
        "  await p.waitForTimeout(700);\n"
        "  const c = p.locator('canvas').first();\n"
        "  await c.hover();\n"
        "  for (let i = 0; i < 4; i++) { await p.mouse.wheel(0, -120); await p.waitForTimeout(60); }\n"
        "  await p.waitForTimeout(300);\n"
        "  await p.screenshot({ path: P.out });\n"
        "  await b.close();\n"
        "})();\n"
    )
    # 临时 js 放项目根 (node_modules 解析), 跑完删
    tmp = '_verify_shot_tmp.js'
    with open(tmp, 'w', encoding='utf-8') as f:
        f.write(script)
    try:
        r = subprocess.run(['node', tmp], capture_output=True, encoding='utf-8', errors='replace')
        if r.returncode != 0:
            raise RuntimeError((r.stderr or r.stdout).strip() or 'node 失败')
    finally:
        if os.path.exists(tmp):
            os.unlink(tmp)


def measure_gap(img_path):
    """测履带下沿与负重轮底的像素间隙。返回 (间隙/半径, 半径px)。"""
    img = Image.open(img_path).convert('RGB')
    W, H = img.size
    px = img.load()
    def is_wheel(r, g, b): return b > 120 and r > 80 and g < 120 and (b - g) > 30 and (r - g) > 15
    def is_track(r, g, b): return b > 120 and 70 < g < 170 and r < 130 and (b - r) > 35
    # 找轮子中心列(最厚)
    thick = {}
    for x in range(W):
        c = sum(1 for y in range(H) if is_wheel(*px[x, y]))
        if c: thick[x] = c
    if not thick: return None, None
    peaks = sorted(thick, key=lambda c: -thick[c])[:8]
    radii = []
    for c in peaks:
        ys = [y for y in range(H) if is_wheel(*px[c, y])]
        if ys: radii.append((max(ys) - min(ys)) / 2)
    radius = sum(radii) / len(radii) if radii else 0
    gaps = []
    for c in peaks:
        wys = [y for y in range(H) if is_wheel(*px[c, y])]
        if not wys: continue
        wb = max(wys)
        tb = -1
        for cc in range(max(0, c - 8), min(W, c + 9)):
            for y in range(H):
                r, g, b = px[cc, y]
                if is_track(r, g, b) and y > tb: tb = y
        if tb > 0: gaps.append(abs(tb - wb))
    if not gaps or not radius: return None, radius
    gaps.sort()
    return gaps[len(gaps) // 2] / radius, radius


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--model', required=True, help='模型工厂下拉显示名(可只给关键词)')
    ap.add_argument('--out', default='screenshots/track_fit_check.png')
    args = ap.parse_args()
    try:
        screenshot_side(args.model, args.out)
    except Exception as e:
        sys.exit(f'截图失败: {e}\n确认 server.py 在 8080 运行')
    ratio, radius = measure_gap(args.out)
    print(f'截图: {args.out}  负重轮半径 {radius:.1f}px' if radius else f'截图: {args.out}  未识别负重轮')
    if ratio is not None:
        gap_px = ratio * radius if radius else 0
        # <3px 是抗锯齿/板厚噪声=紧贴; ratio<0.08 贴合; 0.08~0.15 轻微脱空; 0.15+ 明显脱空
        verdict = '[紧贴 OK]' if (gap_px < 3 or ratio < 0.08) else ('[轻微脱空]' if ratio < 0.15 else '[明显脱空 BAD]')
        print(f'间隙 = {ratio:.3f} 半径 ≈ {gap_px:.1f}px  → {verdict}')
    else:
        print('间隙未测到(可能颜色不符或无侧视负重轮)')


if __name__ == '__main__':
    main()
