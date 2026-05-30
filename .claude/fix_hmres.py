import re

filepath = r"D:\我的文档\tank_demo\map_editor.html"
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix all remaining HM_RES references and incorrect replacements
fixes = [
    # Line 1842: total=HM_RES*HM_RES (no spaces)
    ('const cnt=[0,0,0,0,0,0],total=HM_RES*HM_RES;', 'const cnt=[0,0,0,0,0,0],total=hmResW*hmResD;'),

    # Line 2124: sx uses X -> hmResW-1, sy uses Z -> hmResD-1
    ("const sx = Math.round((x + worldHalfW) / worldWidth * (hmResD - 1)), sy = Math.round((z + worldHalfD) / worldDepth * (HM_RES - 1));",
     "const sx = Math.round((x + worldHalfW) / worldWidth * (hmResW - 1)), sy = Math.round((z + worldHalfD) / worldDepth * (hmResD - 1));"),

    # Line 2204: y * HM_RES + x -> y * hmResW + x
    ("const idx = y * HM_RES + x;", "const idx = y * hmResW + x;"),

    # Line 2342-2344: world2sm function - sx uses X, sy uses Z
    ("const sx = Math.round((wx + worldHalfW) / worldWidth * (hmResD - 1));\n    const sy = Math.round((wz + worldHalfD) / worldDepth * (hmResD - 1));\n    return { sx: Math.max(0, Math.min(hmResD - 1, sx)), sy: Math.max(0, Math.min(HM_RES - 1, sy)) };",
     "const sx = Math.round((wx + worldHalfW) / worldWidth * (hmResW - 1));\n    const sy = Math.round((wz + worldHalfD) / worldDepth * (hmResD - 1));\n    return { sx: Math.max(0, Math.min(hmResW - 1, sx)), sy: Math.max(0, Math.min(hmResD - 1, sy)) };"),

    # Line 2456: (sy + ny) * HM_RES + (sx + nx)
    ('const nidx = (sy + ny) * HM_RES + (sx + nx);', 'const nidx = (sy + ny) * hmResW + (sx + nx);'),

    # Line 2457: bounds checks
    ("if (sx + nx >= 0 && sx + nx < HM_RES && sy + ny >= 0 && sy + ny < HM_RES)",
     "if (sx + nx >= 0 && sx + nx < hmResW && sy + ny >= 0 && sy + ny < hmResD)"),

    # Lines 3161: (sy + dy) * HM_RES + (sx + dx)
    ("const nv = hm[(sy + dy) * HM_RES + (sx + dx)];", "const nv = hm[(sy + dy) * hmResW + (sx + dx)];"),

    # Lines 3169-3173: peak radius scanning
    ("for (let d = 1; d < HM_RES; d++) {\n                    const idxR = sy * hmResW + Math.min(sx + d, hmResD - 1);",
     "for (let d = 1; d < Math.max(hmResW, hmResD); d++) {\n                    const idxR = sy * hmResW + Math.min(sx + d, hmResW - 1);"),

    ("const idxD = Math.min(sy + d, hmResD - 1) * HM_RES + sx;\n                    const idxU = Math.max(sy - d, 0) * HM_RES + sx;",
     "const idxD = Math.min(sy + d, hmResD - 1) * hmResW + sx;\n                    const idxU = Math.max(sy - d, 0) * hmResW + sx;"),

    # Lines 3187-3191: basin radius scanning (similar pattern)
    ("for (let d = 1; d < HM_RES; d++) {\n                    const idxR = sy",
     "for (let d = 1; d < Math.max(hmResW, hmResD); d++) {\n                    const idxR = sy"),

    # Lines 3984: pixel radius conversion
    ("const rPxW = Math.max(rx, rz) / Math.max(worldWidth, worldDepth) * HM_RES;",
     "const rPxW = Math.max(rx, rz) / Math.max(worldWidth, worldDepth) * Math.max(hmResW, hmResD);"),
]

for old, new in fixes:
    if old in content:
        content = content.replace(old, new)
        print(f"Fixed: {old[:60]}...")
    else:
        print(f"NOT FOUND: {old[:60]}...")

# After the loop, check: there might be a second basin section after line 3187
# The two basin blocks are the same pattern, we already fixed one with the idxD/idxU fix
# Let's check for any remaining HM_RES
remaining = [m.start() for m in re.finditer(r'\bHM_RES\b', content)]
if remaining:
    for pos in remaining:
        start = max(0, pos - 20)
        end = min(len(content), pos + 80)
        print(f"\nRemaining at pos {pos}: ...{content[start:end]}...")
else:
    print("\nAll HM_RES references fixed!")

# Also fix: hmResW wrongly used where hmResD should be
# Check for: (sx / hmResW - 0.5) * worldWidth is correct (sx maps to worldWidth)
# Check for: (sy / hmResW - 0.5) * worldDepth should be (sy / hmResD - 0.5)
content = re.sub(r'\(sy\s*/\s*hmResW\s*-\s*0\.5\)\s*\*\s*worldDepth', '(sy / hmResD - 0.5) * worldDepth', content)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("\nFinal verification:")
# Also verify the index patterns are correct: all sy * hmResW + sx
issues = re.findall(r'\bsy\b[^;]*\*[^;]*\+[^;]*\bsx\b', content)
for iss in issues:
    if 'hmResD' in iss and 'hmResW' not in iss:
        print(f"POTENTIAL BUG: {iss}")
    elif 'HM_RES' in iss:
        print(f"REMAINING HM_RES: {iss}")

print("Done!")
