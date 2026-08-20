from PIL import Image

img = Image.open('artifacts/shots_soldiers/final_cheek.png').convert('RGB')
px = img.load(); w, h = img.size
# 模型视口区域：左上动画列表面板在左侧 x<230；右侧 GUI x>820；模型中心 ~410
# 限定 x∈[240,800] y∈[80,720]
helm_pts = []; gun_pts = []
for y in range(80, 720):
    for x in range(240, 800):
        r, g, b = px[x, y]
        if abs(r - 89) < 22 and abs(g - 97) < 22 and abs(b - 74) < 22:
            helm_pts.append((x, y))
        if 18 < r < 70 and 18 < g < 70 and 18 < b < 75:
            gun_pts.append((x, y))

def stats(pts, label):
    if not pts:
        print(label, 'NONE')
        return None
    ys = sorted(p[1] for p in pts); xs = sorted(p[0] for p in pts)
    print('%s n=%d y med=%d range=%d-%d x med=%d range=%d-%d' % (label, len(pts), ys[len(ys) // 2], ys[0], ys[-1], xs[len(xs) // 2], xs[0], xs[-1]))
    return ys[len(ys) // 2], xs[len(xs) // 2]

hy = stats(helm_pts, 'HELMET(olive)')
gy = stats(gun_pts, 'GUN(dark)')
if hy and gy:
    d = gy[0] - hy[0]
    print('gun y=%d vs helmet y=%d diff=%dpx -> %s' % (gy[0], hy[0], d, 'HEAD-LEVEL cheek weld' if abs(d) < 70 else 'LOW hip'))
