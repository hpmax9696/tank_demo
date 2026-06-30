---
name: tank-track-fit
description: >
  坦克履带绕紧向导。触发词："绕紧履带" "调整履带" "履带没贴合轮子" "履带脱空"
  "重新生成履带" "track fit" "新建坦克履带"。
  根据诱导轮/主动轮/负重轮位置自动算 trackParams → 写回源文件 → Playwright+PIL 像素级验证贴合。
  适用于任意"诱导轮前+主动轮后+多个等高负重轮"拓扑的坦克 (T-34/虎式/未来新坦克)。
---

# Tank Track Fit — 坦克履带绕紧向导

## 触发

- 用户调整了坦克轮子位置后："履带没绕紧/脱空/穿模，重新调整"
- 新建坦克模型需要生成履带
- 用户说 "绕紧履带" "fit track" "track fit"

## 前提 (已满足, v0.65.9)

`model_factory.html` 的 `buildTrackChain` + `getTrackPlateTransform` 已参数化负重轮坐标
(默认值 = T-34 原值, 零回归)。`trackParams` 支持以下字段:

| 字段                                   | 含义                    | T-34 默认         |
| -------------------------------------- | ----------------------- | ----------------- |
| `wheelCenterZFront/YFront/RadiusFront` | 诱导轮(前)局部坐标+半径 | 2.1/0.74/0.22     |
| `wheelCenterZRear/YRear/RadiusRear`    | 主动轮(后)局部坐标+半径 | -3.30/0.80/0.30   |
| `roadWheelFrontZ/RearZ`                | 首/尾负重轮 Z           | 1.4/-2.55         |
| `roadWheelY/roadWheelRadius`           | 负重轮中心Y+半径        | 0.4/0.4           |
| `count/plateWidth/Height/Depth`        | 板数+板尺寸             | 110/0.5/0.06/0.08 |

## 路径模型 (6 段封闭环路)

```
     B ─────────────── A          ← AB 上支路 (主动轮顶→诱导轮顶, 直线)
    / └─ 前弧(BC) ╮     \
   /              ╰─ C  \
  诱导轮              ╲   \
  (前,rF)             ╲   \
                       D───E   ← DE 下主干 (贴所有负重轮底, 水平直线)
        负重轮(等高)   ╱   ╲
                      ╱     ╲
                     ╱       ╲ F
                    ╱   后弧(FA)╮
                   主动轮        ╰─ A
                  (后,rR)
```

- **AB**: 主动轮12点 → 诱导轮12点 (上水平)
- **BC**: 绕诱导轮 -120° 弧 (前下方)
- **CD**: 诱导轮7点 → 首负重轮 -105° (下前斜线)
- **DE**: 首负重轮 → 尾负重轮 (下水平, 贴所有负重轮底)
- **EF**: 尾负重轮 -75° → 主动轮 -75° (下后斜线)
- **FA**: 绕主动轮 → 12点 (后弧)

> 设计间隙: DE 段 Y = roadWheelY + roadWheelRadius·sin(-105°) ≈ 轮底+2.5%半径。
> 这是让 CD/EF 平滑过渡的必然间隙 (T-34 同款), 像素验证 <3px = 紧贴。

## 步骤

### Step 1: 算参数 (自动)

```bash
# 找到坦克 builder.js 和配置常量名
python .claude/skills/tank-track-fit/scripts/compute_track_params.py \
  --file models/tiger_v16_builder.js --config TIGER_I_V16_CONFIG
```

脚本自动:

- node eval 解析配置 (兼容 JSON 和 JS 字面量 — 格式化器会把双引号JSON转成单引号字面量)
- 按 name 识别轮子: "诱导轮"/"主动轮"/"负重轮"(排除"内轮"/"拖带轮"/"托带轮")
- 按 X 分左右 (X<0 左, X>0 右)
- 转履带组局部坐标 (轮子pos - 履带节点position)
- 复现 6 段周长 → 算 count (spacing = plateDepth×1.4)

输出每条履带的完整 trackParams JSON。

### Step 2: 写回源文件

**方式 A (推荐, AI 审查)**: 用 `Edit` 把脚本输出的 trackParams 替换进 builder.js。
左右履带 trackParams 通常相同, 用 `replace_all: true`。

**方式 B (一键)**: 脚本加 `--apply` 直接括号匹配替换。
注: 格式化器会把写回的双引号 JSON 再转成 JS 字面量, 运行时无影响。

### Step 3: 验证贴合

```bash
# 确保 server.py 在 127.0.0.1:8080 运行
python .claude/skills/tank-track-fit/scripts/verify_track_fit.py \
  --model "虎式" --out screenshots/track_check.png
```

脚本自动: node playwright 打开 model_factory → lil-gui 切模型 → 右侧视图截图 →
PIL 按颜色识别负重轮(紫 steel)/履带(蓝 dark_steel) → 测下沿间隙。

判定:

- 间隙 <3px 或 <0.08半径 → **[紧贴 OK]**
- 0.08~0.15半径 → [轻微脱空] (可接受)
- 0.15+半径 → [明显脱空 BAD] (需重查参数)

> ⚠️ 不要用肉眼/AI视觉判断间隙 — 透视会夸大。**以像素测量为准**。

## 轮子识别规则 (compute_track_params.py)

| name 含            | 分类              | 备注       |
| ------------------ | ----------------- | ---------- |
| 诱导轮             | 前端轮 (iduce)    | Z 最大端   |
| 主动轮             | 后端轮 (drive)    | Z 最小端   |
| 负重轮             | 中间承载轮 (road) | 排除"内轮" |
| 内轮/拖带轮/托带轮 | 跳过              | 不参与路径 |

- 半径 = Cylinder `size[0]` (不是直径)
- 负重轮按 Z 排序, 首(Z最大)/尾(Z最小)定义 DE 段两端
- 中间负重轮只要等高(同 Y)等径, DE 水平线自动贴合底部

## 常见陷阱

| 陷阱                 | 现象                           | 修复                                                  |
| -------------------- | ------------------------------ | ----------------------------------------------------- |
| 格式化器转 JS 字面量 | python json.loads 失败         | 脚本已用 node eval, 兼容两种格式                      |
| Windows GBK 编码     | 中文输出乱码/报错              | 脚本已 reconfigure utf-8; 或 `PYTHONIOENCODING=utf-8` |
| lil-gui select value | Playwright 找不到 option       | option value = 显示文本(非 key), 按文本匹配           |
| python 无 playwright | `No module named 'playwright'` | 项目用 node playwright, 脚本已 subprocess 调 node     |
| 负重轮不等高         | DE 段只贴首尾, 中间脱空        | 确保负重轮 Y 一致; 或扩展几何(见下)                   |
| 履带板数太少/太密    | count 不准                     | spacing=plateDepth×1.4, 可手调 count                  |

## 扩展: 非标准拓扑

当前 6 段模型假设"诱导轮前+主动轮后+负重轮中间等高"。若未来坦克:

- **拖带轮**(支撑上支路): 需在上支路 AB 加支撑点
- **交错悬挂**(负重轮不等高): DE 段需改成多段折线贴各轮底
- **诱导轮下沉/主动轮上置**: 调整 AB 段端点(已参数化, 自动适应)

扩展时改 `buildTrackChain`/`getTrackPlateTransform` (model_factory.html),
脚本 `total_length()` 同步更新周长公式。

## 示例: 虎式坦克 (v0.65.9)

```
轮子 (车体根坐标):
  诱导轮 [-2.15, 1.1, 2.3] r=0.4   主动轮 [-2.15, 0.9, -2.9] r=0.45
  负重轮1~4 [-2.302, 0.85, ±1.7/±0.57] r=0.48
履带组 position: [-2.15, 0.3, 0]  (局部 = 轮坐标 - 履带组)

脚本输出:
  wheelCenterZFront=2.3  wheelCenterZRear=-2.9
  roadWheelFrontZ=1.7    roadWheelRearZ=-1.7   roadWheelY=0.55  roadWheelRadius=0.48
  周长=13.158  count=118

验证: 间隙 2.0px / 半径39.2px = 0.051 → [紧贴 OK]
```
