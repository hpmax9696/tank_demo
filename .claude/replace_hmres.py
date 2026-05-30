import re
import sys

filepath = r"D:\我的文档\tank_demo\map_editor.html"
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

lines = content.split('\n')
new_lines = []

for i, line in enumerate(lines):
    if 'HM_RES' not in line:
        new_lines.append(line)
        continue

    # Special case: const definition
    if 'const HM_RES = 256' in line:
        line = 'const TARGET_CELL_SIZE = 1.0;     // 高度图目标精度 米/格\nlet hmResW, hmResD;        // 高度图动态分辨率（X/Z独立）'
        new_lines.append(line)
        continue

    # Special case: TEX_RES definition
    if 'const TEX_RES = 2048;' in line:
        line = 'let TEX_RES = 2048;               // 地面纹理分辨率（预览用，动态适配）'
        new_lines.append(line)
        continue

    # hmStepW/D definitions
    if 'hmStepW = worldWidth / (HM_RES - 1)' in line:
        line = line.replace('HM_RES', 'hmResW')
        new_lines.append(line)
        continue
    if 'hmStepD = worldDepth / (HM_RES - 1)' in line:
        line = line.replace('HM_RES', 'hmResD')
        new_lines.append(line)
        continue

    # The same lines inside applyMapDimensions
    line = line.replace('hmStepW = worldWidth / (HM_RES - 1)', 'hmStepW = worldWidth / (hmResW - 1)')
    line = line.replace('hmStepD = worldDepth / (HM_RES - 1)', 'hmStepD = worldDepth / (hmResD - 1)')

    # HM_RES * HM_RES -> hmResW * hmResD
    line = line.replace('HM_RES * HM_RES', 'hmResW * hmResD')

    # sy * HM_RES + sx -> sy * hmResW + sx
    line = re.sub(r'(\[?)\s*sy\d*\s*\*\s*HM_RES\s*\+', lambda m: m.group().replace('HM_RES', 'hmResW'), line)

    # Math.floor(i / HM_RES) -> hmResW
    line = re.sub(r'/\s*HM_RES\b', '/ hmResW', line)

    # sx % HM_RES -> sx % hmResW
    line = re.sub(r'(\w+)\s*%\s*HM_RES\b', lambda m: m.group().replace('HM_RES', 'hmResW'), line)

    # minSx = HM_RES / minSy = HM_RES
    line = re.sub(r'(minSx\s*=\s*)HM_RES\b', r'\1hmResW', line)
    line = re.sub(r'(minSy\s*=\s*)HM_RES\b', r'\1hmResD', line)

    # maxSx = Math.min(HM_RES-1
    line = re.sub(r'(maxSx\s*=\s*Math\.min\()HM_RES\s*-\s*1', r'\1hmResW - 1', line)
    line = re.sub(r'(maxSy\s*=\s*Math\.min\()HM_RES\s*-\s*1', r'\1hmResD - 1', line)

    # Math.min(HM_RES - 1, ...) for maxSx/maxSy context
    if re.search(r'\bmaxSx\b', line):
        line = re.sub(r'HM_RES\s*-\s*1\b', 'hmResW - 1', line)
    if re.search(r'\bmaxSy\b', line):
        line = re.sub(r'HM_RES\s*-\s*1\b', 'hmResD - 1', line)

    # PlaneGeometry: (HM_RES - 1, HM_RES - 1)
    line = re.sub(r'PlaneGeometry\(.*?HM_RES\s*-\s*1\b', lambda m: m.group().replace('HM_RES', 'hmResW'), line)
    # If there's a second HM_RES - 1 in the same line, it should be hmResD
    if 'HM_RES - 1' in line:
        line = re.sub(r'HM_RES\s*-\s*1\b', 'hmResD - 1', line, count=1)  # remaining one is depth

    # createImageData(HM_RES, HM_RES)
    line = line.replace('createImageData(HM_RES, HM_RES)', 'createImageData(hmResW, hmResD)')

    # info text
    line = line.replace("HM_RES + '×' + HM_RES", "hmResW + '×' + hmResD")

    # (sx / HM_RES - 0.5) -> hmResW
    line = re.sub(r'(sx\d*\s*/\s*)HM_RES\b', r'\1hmResW', line)
    # (sy / HM_RES - 0.5) -> hmResD
    line = re.sub(r'(sy\d*\s*/\s*)HM_RES\b', r'\1hmResD', line)

    # rx / HM_RES * worldWidth
    line = re.sub(r'(\brx\b\s*/)\s*HM_RES', r'\1 hmResW', line)
    # rz / HM_RES * worldDepth
    line = re.sub(r'(\brz\b\s*/)\s*HM_RES', r'\1 hmResD', line)

    # TEX_RES/HM_RES -> separate for now, fix later
    if re.search(r'TEX_RES\s*/\s*HM_RES', line):
        # Keep as is, fix manually later
        pass

    # For loop bounds: sy < HM_RES or sy2 < HM_RES
    line = re.sub(r'(\bsy\d*\s*<\s*)HM_RES\b', r'\1hmResD', line)
    # For loop bounds: sx < HM_RES or sx2 < HM_RES
    line = re.sub(r'(\bsx\d*\s*<\s*)HM_RES\b', r'\1hmResW', line)

    # sx >= 0 && sx < HM_RES -> sx < hmResW
    line = re.sub(r'(sx\d*\s*<\s*)HM_RES\b', r'\1hmResW', line)
    line = re.sub(r'(sy\d*\s*<\s*)HM_RES\b', r'\1hmResD', line)

    # sx >= HM_RES -> sx >= hmResW
    line = re.sub(r'(sx\d*\s*>=\s*)HM_RES\b', r'\1hmResW', line)
    line = re.sub(r'(sy\d*\s*>=\s*)HM_RES\b', r'\1hmResD', line)

    # Math.round(u * (HM_RES - 1)) for w2i
    line = re.sub(r'\(u\s*\*.*?HM_RES\s*-\s*1\)', lambda m: m.group().replace('HM_RES', 'hmResW'), line)
    line = re.sub(r'\(v\s*\*.*?HM_RES\s*-\s*1\)', lambda m: m.group().replace('HM_RES', 'hmResD'), line)

    # For loop with sy: for (let sy = 0; sy < HM_RES; sy++)
    # Already handled by the sy < HM_RES pattern above, but some might be formatted differently
    # for (let y = 0; y < HM_RES; y++) — y is used as Z coordinate in renderHeightmapCanvas
    if re.search(r'let\s+y\s*=.*y\s*<\s*HM_RES', line):
        line = re.sub(r'(y\s*<\s*)HM_RES\b', r'\1hmResD', line)
    if re.search(r'let\s+x\s*=.*x\s*<\s*HM_RES', line):
        line = re.sub(r'(x\s*<\s*)HM_RES\b', r'\1hmResW', line)

    # Remaining HM_RES references: check for sx/sy context
    if 'HM_RES' in line:
        has_sx = bool(re.search(r'\bsx\b', line))
        has_sy = bool(re.search(r'\bsy\b', line))
        has_u = bool(re.search(r'\bu\b[\s*/(]', line))
        has_v = bool(re.search(r'\bv\b[\s*/(]', line))
        has_x = bool(re.search(r'\b[xX]\b', line))
        has_y = bool(re.search(r'\b[yY]\b', line))

        if has_sx and not has_sy:
            line = re.sub(r'\bHM_RES\b', 'hmResW', line)
        elif has_sy and not has_sx:
            line = re.sub(r'\bHM_RES\b', 'hmResD', line)
        elif has_u and not has_v:
            line = re.sub(r'\bHM_RES\b', 'hmResW', line)
        elif has_v and not has_u:
            line = re.sub(r'\bHM_RES\b', 'hmResD', line)
        else:
            # Mark for manual review
            pass

    new_lines.append(line)

result = '\n'.join(new_lines)

# Check for remaining HM_RES
remaining = []
for i, line in enumerate(new_lines):
    if 'HM_RES' in line:
        remaining.append((i+1, line.strip()[:150]))

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(result)

print(f"Done. {len(remaining)} HM_RES references remain for manual fix:")
for ln, txt in remaining:
    print(f"  Line {ln}: {txt}")
