# 校园 4 种丧尸 · 核心可跑实现计划 (P1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让金福园校园地图里出现 4 种丧尸（学生男/女、教师男/女），穿真实校服/白领装、体型随机、轻度丧尸化、师生两层强度，能走动能攻击能被击杀——纯代码接入，不依赖未实现的工厂/工具页。

**Architecture:** 新增 `models/humanoid_config.js`（纯数据：基骨架树 + 体型参数 + 4 变体 + 装饰库 + rest pose + `buildHumanoid` 装配函数）。在 `models/enemies.js` 内新增人形专属的材质生成 / `buildHumanoidRig` 递归构建 / `createHumanoidAnimationSystem`（rest-pose 偏移动画，复用现有 `AnimationSystem` 类）/ `createCampusZombie` 工厂。`js/engine.js` 的 `createEnemies` 加 4 个新 type 分支并修正 `enemyType`/`_noTerrainPitch`。`campus.map.json` 手写最小测试数据。

**Tech Stack:** Three.js r160、原生 JS（IIFE + window 暴露）、Canvas 2D 程序化贴图、CDP + Playwright 验证。

## Global Constraints

- **尺度**：`METERS_PER_UNIT = 1.3`（`engine.js:248`）。学生身高 1.1–1.5m、教师 1.55–1.75m；渲染缩放 = `heightM / 1.3 / baseHeight`。
- **变体名约定**：`student_m / student_f / teacher_m / teacher_f`——同时是 `HUMANOID_VARIANTS` key、`createEnemies` 的 `type`、`createCampusZombie` 的 `variant` 入参。
- **轻度丧尸化**：皮肤轻微灰绿（不溃烂）、发光眼、少量血污、衣物基本完好。不做缺肢/大面积溃烂。
- **零回归**：**不动**现有丧尸 `createAnimationSystem`/`buildZombieFromConfig`/`createZombie`（`enemies.js:472-917`），不动六足。人形走全新独立函数。
- **节点名对齐**：人形骨架节点名与现有丧尸一字不差（`torso/head/neck/l_upper_arm/...`），pivot 命名 `{name}_pivot`，保证动画系统兼容。
- **女教师体态**：`curves` 参数（0.6–0.9）驱动 `bust`/`hips` 装饰 + 腰部收细；学生男女与男教师不启用 curves。
- **验证基线**：每个 task 完成后 CDP 加载页面控制台 0 错误；最终 task 用 Playwright 进图端到端验证。
- **几何尺寸为起始估值**：本 plan 给出的所有 Box/Sphere/Cylinder 尺寸是可运行的起始值，视觉精修留待后续 P6（工厂接入后可视化调整）。

## File Structure

| 文件                        | 责任                                                                | 本 plan 改动 |
| --------------------------- | ------------------------------------------------------------------- | ------------ |
| `models/humanoid_config.js` | 人形纯数据 + `buildHumanoid` 装配 + 暴露 `window.HumanoidConfig`    | 新建         |
| `models/enemies.js`         | 人形材质/构建/动画/工厂（复用 `AnimationSystem` 类）                | 追加 ~280 行 |
| `js/engine.js`              | `createEnemies` 加 4 type 分支 + `enemyType`/`_noTerrainPitch` 修正 | 改 ~15 行    |
| `index.html`                | 加载 `humanoid_config.js`                                           | +1 行 script |
| `maps/campus.map.json`      | 最小测试 enemies 数据（每种 1 只）                                  | +1 段        |

**本 plan 不含（后续 plan）**：P2 `server.py` enemies 固化端点、P3 `campus_spawner.js` 定时门刷新、P4 模型工厂接入 + `humanoid_factory.js` 展台桥接、P5 `tools/enemy_marker.html` 放置工具页、P6 校服贴图视觉精修。

---

## Task 1: `models/humanoid_config.js` — 人形数据 + 装配 + 暴露

**Files:**

- Create: `models/humanoid_config.js`

**Interfaces:**

- Produces: `window.HumanoidConfig = { HUMANOID_BASE, BODY_PARAMS, HUMANOID_VARIANTS, ADDON_LIBRARY, JOINT_NAMES, REST_POSES, buildHumanoid }`
- `buildHumanoid(variantKey, params)` → 返回 config 树（与现有 `ZOMBIE_CONFIG` 同格式：`{name,type,size,position,rotation,pivot,materialId,children,segments}`），节点名对齐现有丧尸

- [ ] **Step 1: 创建 `models/humanoid_config.js`**

```js
// models/humanoid_config.js
// 可复用人形敌人配置 —— 基骨架 + 体型参数 + 变体 + 装饰库 + rest pose + 装配函数
// 节点名与 models/enemies.js 现有丧尸一字对齐，保证 AnimationSystem 复用
(function () {
  // ① 基础骨架树（尺寸为起始估值，起始值取自现有 ZOMBIE_CONFIG）
  const HUMANOID_BASE = {
    name: 'root',
    type: 'Group',
    position: [-0.08, 0.75, 0],
    rotation: [0, 0, 0],
    children: [
      {
        name: 'pelvis',
        type: 'Box',
        size: [0.5, 0.35, 0.4],
        position: [0, 0.375, 0],
        materialId: '__cloth__',
        children: [
          {
            name: 'torso',
            type: 'Box',
            size: [0.6, 0.75, 0.38],
            position: [0, 0.54, 0.04],
            rotation: [0.2, 0, 0],
            pivot: [0, -0.375, 0],
            materialId: '__cloth__',
            _slot: 'torso',
            children: [
              {
                name: 'neck',
                type: 'Cylinder',
                size: [0.12, 0.15, 0.12],
                position: [0, 0.46, 0.02],
                rotation: [0.22, 0, 0],
                pivot: [0, -0.075, 0],
                materialId: '__skin__',
                children: [
                  {
                    name: 'head',
                    type: 'Sphere',
                    size: [0.2],
                    position: [0, 0.215, 0.02],
                    rotation: [0.02, 0, 0.08],
                    pivot: [0, -0.2, 0],
                    materialId: '__skin__',
                    segments: [6, 5],
                    children: [
                      {
                        name: 'l_eye_glow',
                        type: 'Sphere',
                        size: [0.035],
                        position: [-0.06, 0.03, 0.16],
                        materialId: 'eye_glow',
                        segments: [5, 4],
                      },
                      {
                        name: 'r_eye_glow',
                        type: 'Sphere',
                        size: [0.035],
                        position: [0.06, 0.03, 0.16],
                        materialId: 'eye_glow',
                        segments: [5, 4],
                      },
                    ],
                  },
                ],
              },
              {
                name: 'l_upper_arm',
                type: 'Cylinder',
                size: [0.1, 0.45, 0.1],
                position: [-0.35, 0.4, 0],
                rotation: [0, 0, -0.1],
                pivot: [0, 0.2, 0],
                materialId: '__skin__',
                children: [
                  {
                    name: 'l_forearm',
                    type: 'Cylinder',
                    size: [0.08, 0.42, 0.08],
                    position: [0, -0.42, 0],
                    pivot: [0, 0.2, 0],
                    materialId: '__skin__',
                  },
                ],
              },
              {
                name: 'r_upper_arm',
                type: 'Cylinder',
                size: [0.1, 0.45, 0.1],
                position: [0.35, 0.4, 0],
                rotation: [0, 0, 0.1],
                pivot: [0, 0.2, 0],
                materialId: '__skin__',
                children: [
                  {
                    name: 'r_forearm',
                    type: 'Cylinder',
                    size: [0.08, 0.42, 0.08],
                    position: [0, -0.42, 0],
                    pivot: [0, 0.2, 0],
                    materialId: '__skin__',
                  },
                ],
              },
            ],
          },
          {
            name: 'l_upper_leg',
            type: 'Cylinder',
            size: [0.12, 0.45, 0.12],
            position: [-0.13, -0.05, 0],
            pivot: [0, 0.2, 0],
            materialId: '__skin__',
            children: [
              {
                name: 'l_lower_leg',
                type: 'Cylinder',
                size: [0.1, 0.42, 0.1],
                position: [0, -0.42, 0],
                pivot: [0, 0.2, 0],
                materialId: '__skin__',
                children: [
                  {
                    name: 'l_foot',
                    type: 'Box',
                    size: [0.18, 0.1, 0.28],
                    position: [0, -0.2, 0.06],
                    pivot: [0, 0.05, -0.1],
                    materialId: '__skin__',
                  },
                ],
              },
            ],
          },
          {
            name: 'r_upper_leg',
            type: 'Cylinder',
            size: [0.12, 0.45, 0.12],
            position: [0.13, -0.05, 0],
            pivot: [0, 0.2, 0],
            materialId: '__skin__',
            children: [
              {
                name: 'r_lower_leg',
                type: 'Cylinder',
                size: [0.1, 0.42, 0.1],
                position: [0, -0.42, 0],
                pivot: [0, 0.2, 0],
                materialId: '__skin__',
                children: [
                  {
                    name: 'r_foot',
                    type: 'Box',
                    size: [0.18, 0.1, 0.28],
                    position: [0, -0.2, 0.06],
                    pivot: [0, 0.05, -0.1],
                    materialId: '__skin__',
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  };

  // ② 体型参数（工厂体型滑块读它；本 plan 用 buildHumanoid 内部派生）
  const BODY_PARAMS = {
    height: { default: 1.4, range: [1.0, 1.8] },
    build: { default: 0.5, range: [0, 1] },
    hunch: { default: 0.2, range: [0, 0.4] },
    curves: { default: 0, range: [0, 1] },
  };

  // ③ 变体定义
  const HUMANOID_VARIANTS = {
    student_m: {
      name: '学生(男)',
      materials: { cloth: 'polo_white', skin: 'skin_zombie' },
      addons: [
        'short_hair_m',
        'red_scarf',
        'polo_collar',
        'polo_placket',
        'polo_cuff_l',
        'polo_cuff_r',
        'school_badge',
        'shoulder_stripes',
        'shorts_m',
        'shoes_blue',
      ],
      bodyRange: { height: [1.1, 1.5], hunch: [0.1, 0.25] },
    },
    student_f: {
      name: '学生(女)',
      materials: { cloth: 'polo_white', skin: 'skin_zombie' },
      addons: [
        'ponytail_f',
        'fringe_f',
        'red_scarf',
        'polo_collar',
        'polo_placket',
        'polo_cuff_l',
        'polo_cuff_r',
        'school_badge',
        'shoulder_stripes',
        'pleated_skirt_f',
        'shoes_white',
      ],
      bodyRange: { height: [1.1, 1.5], hunch: [0.1, 0.25] },
    },
    teacher_m: {
      name: '教师(男)',
      materials: { cloth: 'teacher_shirt', skin: 'skin_zombie' },
      addons: [
        'short_hair_m',
        'tie_opt',
        'glasses_opt',
        'trousers_grey',
        'leather_shoes',
        'briefcase_opt',
      ],
      bodyRange: { height: [1.55, 1.75], hunch: [0, 0.05] },
    },
    teacher_f: {
      name: '教师(女)',
      materials: { cloth: 'blouse_white', skin: 'skin_zombie' },
      addons: ['bun_f', 'bust', 'hips', 'skirt_grey', 'leather_shoes', 'necklace_opt'],
      bodyRange: { height: [1.55, 1.75], hunch: [0, 0.05], build: [0.3, 0.45], curves: [0.6, 0.9] },
    },
  };

  // ④ 装饰节点库（起始几何估值；_materialKey 标记用变体材质还是自带）
  const ADDON_LIBRARY = {
    short_hair_m: {
      parent: 'head',
      node: {
        type: 'Group',
        position: [0, 0.16, -0.02],
        children: [
          {
            name: 'ah_m',
            type: 'Box',
            size: [0.26, 0.16, 0.26],
            position: [0, 0, 0],
            materialId: 'hair_black',
          },
        ],
      },
    },
    ponytail_f: {
      parent: 'head',
      node: {
        type: 'Group',
        position: [0, 0.05, -0.16],
        children: [
          {
            name: 'ah_pt',
            type: 'Cylinder',
            size: [0.06, 0.4, 0.06],
            position: [0, -0.2, -0.04],
            rotation: [0.2, 0, 0],
            materialId: 'hair_black',
          },
          {
            name: 'ah_pt_tip',
            type: 'Sphere',
            size: [0.07],
            position: [0, -0.42, -0.1],
            materialId: 'hair_black',
            segments: [6, 5],
          },
          {
            name: 'ah_pt_band',
            type: 'Torus',
            size: [0.06, 0.012],
            position: [0, 0, 0],
            materialId: 'scarf_red',
          },
        ],
      },
    }, // Torus size=[r, tube]
    fringe_f: {
      parent: 'head',
      node: {
        name: 'ah_fr',
        type: 'Box',
        size: [0.22, 0.07, 0.08],
        position: [0, 0.12, 0.14],
        materialId: 'hair_black',
      },
    },
    bun_f: {
      parent: 'head',
      node: {
        name: 'ah_bun',
        type: 'Sphere',
        size: [0.1],
        position: [0, 0.2, -0.08],
        materialId: 'hair_black',
        segments: [6, 5],
      },
    },
    red_scarf: {
      parent: 'neck',
      node: {
        type: 'Group',
        position: [0, -0.05, 0.1],
        children: [
          {
            name: 'ah_sc_knot',
            type: 'Sphere',
            size: [0.07],
            position: [0, 0, 0.04],
            materialId: 'scarf_red',
            segments: [6, 5],
          },
          {
            name: 'ah_sc_l',
            type: 'Box',
            size: [0.06, 0.22, 0.02],
            position: [-0.05, -0.16, 0.06],
            rotation: [0, 0, 0.15],
            materialId: 'scarf_red',
          },
          {
            name: 'ah_sc_r',
            type: 'Box',
            size: [0.06, 0.2, 0.02],
            position: [0.05, -0.15, 0.06],
            rotation: [0, 0, -0.15],
            materialId: 'scarf_red',
          },
        ],
      },
    },
    polo_collar: {
      parent: 'torso',
      node: {
        type: 'Group',
        position: [0, 0.34, 0.18],
        children: [
          {
            name: 'ah_col_l',
            type: 'Box',
            size: [0.08, 0.06, 0.02],
            position: [-0.05, 0, 0],
            rotation: [0.3, 0, 0.2],
            materialId: 'collar_red',
          },
          {
            name: 'ah_col_r',
            type: 'Box',
            size: [0.08, 0.06, 0.02],
            position: [0.05, 0, 0],
            rotation: [0.3, 0, -0.2],
            materialId: 'collar_red',
          },
        ],
      },
    },
    polo_placket: {
      parent: 'torso',
      node: {
        type: 'Group',
        position: [0, 0.2, 0.19],
        children: [
          {
            name: 'ah_pl',
            type: 'Box',
            size: [0.05, 0.2, 0.02],
            position: [0, 0, 0],
            materialId: '__cloth__',
          },
          {
            name: 'ah_btn1',
            type: 'Sphere',
            size: [0.018],
            position: [0, 0.06, 0.02],
            materialId: 'button_white',
            segments: [5, 4],
          },
          {
            name: 'ah_btn2',
            type: 'Sphere',
            size: [0.018],
            position: [0, -0.04, 0.02],
            materialId: 'button_white',
            segments: [5, 4],
          },
        ],
      },
    },
    polo_cuff_l: {
      parent: 'l_forearm',
      node: {
        name: 'ah_cuf_l',
        type: 'Cylinder',
        size: [0.09, 0.06, 0.09],
        position: [0, -0.18, 0],
        materialId: 'collar_red',
      },
    },
    polo_cuff_r: {
      parent: 'r_forearm',
      node: {
        name: 'ah_cuf_r',
        type: 'Cylinder',
        size: [0.09, 0.06, 0.09],
        position: [0, -0.18, 0],
        materialId: 'collar_red',
      },
    },
    school_badge: {
      parent: 'torso',
      node: {
        name: 'ah_badge',
        type: 'Plane',
        size: [0.07, 0.07],
        position: [-0.14, 0.14, 0.2],
        materialId: 'school_badge',
      },
    }, // Plane size=[w,h]
    shoulder_stripes: {
      parent: 'torso',
      node: {
        name: 'ah_str',
        type: 'Plane',
        size: [0.18, 0.22],
        position: [0.16, 0.18, 0.19],
        rotation: [0, 0, -0.4],
        materialId: 'shoulder_stripes',
      },
    },
    shorts_m: {
      parent: 'pelvis',
      node: {
        type: 'Group',
        position: [0, -0.1, 0],
        children: [
          {
            name: 'ah_sh_l',
            type: 'Box',
            size: [0.18, 0.26, 0.22],
            position: [-0.12, 0, 0],
            materialId: 'shorts_red',
          },
          {
            name: 'ah_sh_r',
            type: 'Box',
            size: [0.18, 0.26, 0.22],
            position: [0.12, 0, 0],
            materialId: 'shorts_red',
          },
        ],
      },
    },
    pleated_skirt_f: {
      parent: 'pelvis',
      node: {
        name: 'ah_skirt',
        type: 'Cylinder',
        size: [0.26, 0.3, 0.26],
        position: [0, -0.18, 0],
        materialId: 'shorts_red',
        segments: [16, 1],
      },
    }, // 扁圆柱模拟裙
    trousers_grey: {
      parent: 'pelvis',
      node: {
        type: 'Group',
        position: [0, -0.1, 0],
        children: [
          {
            name: 'ah_tr_l',
            type: 'Box',
            size: [0.18, 0.5, 0.22],
            position: [-0.12, 0, 0],
            materialId: 'trousers_grey',
          },
          {
            name: 'ah_tr_r',
            type: 'Box',
            size: [0.18, 0.5, 0.22],
            position: [0.12, 0, 0],
            materialId: 'trousers_grey',
          },
        ],
      },
    },
    skirt_grey: {
      parent: 'pelvis',
      node: {
        name: 'ah_gskirt',
        type: 'Cylinder',
        size: [0.26, 0.42, 0.26],
        position: [0, -0.24, 0],
        materialId: 'trousers_grey',
        segments: [16, 1],
      },
    },
    shoes_blue: {
      parent: 'l_foot',
      node: {
        name: 'ah_sh_l',
        type: 'Box',
        size: [0.2, 0.12, 0.32],
        position: [0, -0.02, 0.02],
        materialId: 'shoes_blue',
      },
    }, // 注：l_foot/r_foot 各挂一只，见 buildHumanoid
    shoes_white: {
      parent: 'l_foot',
      node: {
        name: 'ah_sh_l',
        type: 'Box',
        size: [0.2, 0.12, 0.32],
        position: [0, -0.02, 0.02],
        materialId: 'shoes_white',
      },
    },
    leather_shoes: {
      parent: 'l_foot',
      node: {
        name: 'ah_sh_l',
        type: 'Box',
        size: [0.2, 0.12, 0.32],
        position: [0, -0.02, 0.02],
        materialId: 'leather_black',
      },
    },
    bust: {
      parent: 'torso',
      node: {
        type: 'Group',
        position: [0, 0.12, 0.16],
        children: [
          {
            name: 'ah_bust_l',
            type: 'Sphere',
            size: [0.11],
            position: [-0.1, 0, 0.02],
            materialId: '__cloth__',
            segments: [7, 6],
          },
          {
            name: 'ah_bust_r',
            type: 'Sphere',
            size: [0.11],
            position: [0.1, 0, 0.02],
            materialId: '__cloth__',
            segments: [7, 6],
          },
        ],
      },
    },
    hips: {
      parent: 'pelvis',
      node: {
        type: 'Group',
        position: [0, -0.05, 0],
        children: [
          {
            name: 'ah_hips',
            type: 'Sphere',
            size: [0.3],
            position: [0, 0, -0.02],
            materialId: '__cloth__',
            segments: [8, 6],
          },
        ],
      },
    }, // 沿 Y 压扁由 buildHumanoid scale 处理
    tie_opt: {
      parent: 'torso',
      node: {
        name: 'ah_tie',
        type: 'Box',
        size: [0.04, 0.26, 0.02],
        position: [0, 0.16, 0.2],
        materialId: 'tie_blue',
      },
    },
    glasses_opt: {
      parent: 'head',
      node: {
        type: 'Group',
        position: [0, 0.03, 0.16],
        children: [
          {
            name: 'ah_gl_l',
            type: 'Torus',
            size: [0.05, 0.008],
            position: [-0.06, 0, 0],
            materialId: 'frame_dark',
          },
          {
            name: 'ah_gl_r',
            type: 'Torus',
            size: [0.05, 0.008],
            position: [0.06, 0, 0],
            materialId: 'frame_dark',
          },
        ],
      },
    },
    briefcase_opt: {
      parent: 'r_forearm',
      node: {
        name: 'ah_bc',
        type: 'Box',
        size: [0.22, 0.28, 0.08],
        position: [0, -0.3, 0.1],
        materialId: 'briefcase_brown',
      },
    },
    necklace_opt: {
      parent: 'neck',
      node: {
        name: 'ah_nk',
        type: 'Torus',
        size: [0.11, 0.008],
        position: [0, -0.02, 0.02],
        materialId: 'metal_gold',
      },
    },
  };

  // ⑤ 关节名 + rest pose（rest pose 用绝对角度基线，动画关键帧作偏移叠加）
  const JOINT_NAMES = [
    'torso',
    'head',
    'neck',
    'l_upper_arm',
    'l_forearm',
    'r_upper_arm',
    'r_forearm',
    'l_upper_leg',
    'l_lower_leg',
    'r_upper_leg',
    'r_lower_leg',
    'pelvis',
  ];
  const REST_POSES = {
    'torso:x': 0.2,
    'neck:x': 0.22,
    'head:z': 0.08,
    'l_upper_arm:z': -0.1,
    'r_upper_arm:z': 0.1,
  };

  // ── 节点材质槽位映射（__cloth__/__skin__ 占位 → 变体材质覆写）
  function resolveMaterialId(slot, variantMaterials) {
    if (slot === '__cloth__') return variantMaterials.cloth;
    if (slot === '__skin__') return variantMaterials.skin;
    return slot; // 自带固定材质（eye_glow/hair_black/...）
  }

  // ── 深拷贝配置树 + 应用体型派生 + 材质覆写
  function deriveNode(node, params, variant, addons) {
    const out = Object.assign({}, node);
    // 材质覆写
    if (node.materialId) out.materialId = resolveMaterialId(node.materialId, variant.materials);
    // 体型派生：hunch → torso.rotation.x（叠加到基线）
    if (node.name === 'torso' && node.rotation) {
      out.rotation = [node.rotation[0] + (params.hunch - 0.2), node.rotation[1], node.rotation[2]];
    }
    // curves → 腰部 torso 收细（窄 X）
    if (node.name === 'torso' && node.size && params.curves > 0) {
      out.size = [node.size[0] * (1 - params.curves * 0.15), node.size[1], node.size[2]];
    }
    // build → 四肢粗细（非教师女时按 build 调）
    // 递归
    if (node.children)
      out.children = node.children.map((c) => deriveNode(c, params, variant, addons));
    return out;
  }

  // ── 主装配：buildHumanoid(variantKey, params) → config 树
  function buildHumanoid(variantKey, params) {
    const variant = HUMANOID_VARIANTS[variantKey];
    if (!variant) {
      console.warn('buildHumanoid: 未知变体', variantKey);
      return null;
    }
    params = params || {};
    const p = {
      height: params.height != null ? params.height : variant.bodyRange.height[0],
      build:
        params.build != null ? params.build : variant.bodyRange.build || BODY_PARAMS.build.default,
      hunch: params.hunch != null ? params.hunch : variant.bodyRange.hunch[0],
      curves: params.curves != null ? params.curves : variant.bodyRange.curves || 0,
    };
    // 1) 深拷贝 BASE + 派生
    const tree = deriveNode(HUMANOID_BASE, p, variant, variant.addons);
    // 2) 追加装饰节点
    variant.addons.forEach((key) => {
      const def = ADDON_LIBRARY[key];
      if (!def) {
        console.warn('buildHumanoid: 未知 addon', key);
        return;
      }
      // shoes_* / leather_shoes 等单脚 addon：同时挂 l_foot 与 r_foot
      const parents =
        key === 'shoes_blue' || key === 'shoes_white' || key === 'leather_shoes'
          ? ['l_foot', 'r_foot']
          : [def.parent];
      parents.forEach((par, idx) => {
        const parentNode = findNode(tree, par);
        if (!parentNode) {
          console.warn('buildHumanoid: addon 父节点缺失', par);
          return;
        }
        parentNode.children = parentNode.children || [];
        const clone = JSON.parse(JSON.stringify(def.node));
        // 右侧镜像（r_foot / r_* 父节点上的 addon X 取反）
        if (par === 'r_foot' || par === 'r_forearm') mirrorX(clone);
        // curves 放大 bust/hips
        if (key === 'bust' || key === 'hips') scaleGroup(clone, 0.6 + p.curves * 0.8);
        clone._addonKey = key + (idx > 0 ? '_r' : '');
        parentNode.children.push(clone);
      });
    });
    // 3) 整体 height 缩放到目标身高（单位 = height/1.3，BASE 默认高约 1.5 单位 → 1.95m，需缩放）
    //    最终缩放在 createCampusZombie 用包围盒归一到 height/1.3 单位；这里只存 params.height
    tree._params = p;
    return tree;
  }

  // 工具：按 name 查节点
  function findNode(node, name) {
    if (node.name === name) return node;
    if (node.children)
      for (const c of node.children) {
        const r = findNode(c, name);
        if (r) return r;
      }
    return null;
  }
  function mirrorX(node) {
    if (node.position) node.position = [-node.position[0], node.position[1], node.position[2]];
    if (node.rotation) node.rotation = [node.rotation[0], node.rotation[1], -node.rotation[2]];
    if (node.children) node.children.forEach(mirrorX);
  }
  function scaleGroup(node, s) {
    if (node.size) node.size = node.size.map((v) => v * s);
    if (node.children) node.children.forEach((c) => scaleGroup(c, s));
  }

  window.HumanoidConfig = {
    HUMANOID_BASE,
    BODY_PARAMS,
    HUMANOID_VARIANTS,
    ADDON_LIBRARY,
    JOINT_NAMES,
    REST_POSES,
    buildHumanoid,
  };
  console.log('🧑 人形配置已就绪 | 变体:', Object.keys(HUMANOID_VARIANTS).join('/'));
})();
```

- [ ] **Step 2: CDP 验证配置加载与装配**

启动服务（`python server.py`）后用 CDP 打开 `http://127.0.0.1:8080/index.html`，在主菜单控制台执行：

```js
const t = window.HumanoidConfig.buildHumanoid('student_m', { height: 1.3, hunch: 0.2 });
console.log(
  'tree root:',
  t.name,
  'torso:',
  !!t.children[0].children.find((c) => c.name === 'torso'),
  'addons:',
  t.children[0].children.flatMap((c) => c.children || []).length > 0
);
window.HumanoidConfig.HUMANOID_VARIANTS.teacher_f.bodyRange.curves; // 应输出 [0.6, 0.9]
```

Expected: `tree root: root torso: true addons: true` 且 curves 为 `[0.6, 0.9]`；控制台 0 错误。

- [ ] **Step 3: Commit**

```bash
git add models/humanoid_config.js
git commit -m "feat: 新增 humanoid_config.js 人形基骨架/变体/装饰库/buildHumanoid 装配"
```

---

## Task 2: `models/enemies.js` — 人形材质 + `buildHumanoidRig` 构建

**Files:**

- Modify: `models/enemies.js`（在 `createZombie` 之后、`window.EnemyModels` 暴露之前插入；行号参考 `:917-927`）

**Interfaces:**

- Consumes: `window.HumanoidConfig`（Task 1）
- Produces: `createHumanoidMaterials()`（缓存返回 `{diffuse, badge, stripes}`）、`buildHumanoidRig(config, parent)`（递归构建，pivot 命名 `{name}_pivot`，材质查人形 DEFS）

- [ ] **Step 1: 在 `models/enemies.js` 的 `// ─── 暴露到全局 ───` 之前插入人形材质 + 构建代码**

```js
// ═══════════════════════════════════════════════════════
// ─── ④ 校园人形丧尸（基骨架变体 + 校服/正装贴图）───
// ═══════════════════════════════════════════════════════
let _humanoidTexCache = null;
let _humanoidMatCache = {};

// 4.1 createHumanoidMaterials() — 校服/皮肤/校徽/斜纹 Canvas 程序化贴图
function createHumanoidMaterials() {
  if (_humanoidTexCache) return _humanoidTexCache;
  // polo_white：白底 + 极细珠地网眼（微光泽）
  const polo = document.createElement('canvas');
  polo.width = polo.height = 128;
  const pctx = polo.getContext('2d');
  pctx.fillStyle = '#f4f4f0';
  pctx.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 1200; i++) {
    pctx.fillStyle = `rgba(210,210,200,${0.15 + Math.random() * 0.25})`;
    pctx.fillRect(Math.random() * 128, Math.random() * 128, 1.5, 1.5);
  }
  // skin_zombie：白皙 → 轻微灰绿偏色 + 少量暗斑（轻度丧尸化）
  const skin = document.createElement('canvas');
  skin.width = skin.height = 128;
  const sctx = skin.getContext('2d');
  sctx.fillStyle = '#c9cfc0';
  sctx.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 400; i++) {
    sctx.fillStyle = `rgba(150,165,140,${0.1 + Math.random() * 0.2})`;
    sctx.fillRect(Math.random() * 128, Math.random() * 128, 2, 2);
  }
  for (let i = 0; i < 6; i++) {
    // 少量暗斑
    const cx = Math.random() * 128,
      cy = Math.random() * 128,
      r = 4 + Math.random() * 8;
    const g = sctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, 'rgba(110,120,95,0.4)');
    g.addColorStop(1, 'rgba(110,120,95,0)');
    sctx.fillStyle = g;
    sctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  }
  // school_badge：绿树 + 橙色"金福园小学"
  const badge = document.createElement('canvas');
  badge.width = 128;
  badge.height = 128;
  const bctx = badge.getContext('2d');
  bctx.fillStyle = 'rgba(0,0,0,0)';
  bctx.clearRect(0, 0, 128, 128);
  bctx.fillStyle = '#3a8a3a'; // 树冠（三重叠圆）
  [
    [64, 48, 22],
    [52, 55, 16],
    [76, 55, 16],
  ].forEach(([x, y, r]) => {
    bctx.beginPath();
    bctx.arc(x, y, r, 0, Math.PI * 2);
    bctx.fill();
  });
  bctx.fillStyle = '#6b4a2a';
  bctx.fillRect(60, 60, 8, 22); // 树干
  bctx.fillStyle = '#d88a2a';
  bctx.font = 'bold 13px sans-serif';
  bctx.textAlign = 'center';
  bctx.fillText('金福园小学', 64, 104); // 橙色校名（中文，风险见 plan 末）
  // shoulder_stripes：红/粉/绿斜条（单侧不对称）
  const strp = document.createElement('canvas');
  strp.width = strp.height = 128;
  const tctx = strp.getContext('2d');
  tctx.clearRect(0, 0, 128, 128);
  const cols = ['#d83232', '#e88a9a', '#3a8a3a'];
  for (let i = 0; i < 4; i++) {
    tctx.fillStyle = cols[i % 3];
    tctx.save();
    tctx.translate(64, 64);
    tctx.rotate(-0.5);
    tctx.fillRect(-12 + i * 8, -80, 5, 160);
    tctx.restore();
  }
  const make = (cv) => {
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  _humanoidTexCache = {
    polo: make(polo),
    skin: make(skin),
    badge: make(badge),
    stripes: make(strp),
  };
  return _humanoidTexCache;
}

// 4.2 人形材质字典（按 materialId 查/建，缓存）
function getHumanoidMat(id) {
  if (_humanoidMatCache[id]) return _humanoidMatCache[id];
  const tex = _humanoidTexCache || createHumanoidMaterials();
  const DEFS = {
    polo_white: { map: 'polo', color: 0xffffff, roughness: 0.7 },
    teacher_shirt: { color: 0xf2f2ee, roughness: 0.65 },
    blouse_white: { color: 0xf6f6f2, roughness: 0.65 },
    skin_zombie: { map: 'skin', color: 0xffffff, roughness: 0.85 },
    eye_glow: { color: 0x000000, emissive: 0xff3300, emissiveIntensity: 3 },
    hair_black: { color: 0x1a1a1a, roughness: 0.8 },
    scarf_red: { color: 0xc8202a, roughness: 0.7 },
    collar_red: { color: 0xc8202a, roughness: 0.65 },
    button_white: { color: 0xf8f8f8, roughness: 0.5 },
    shorts_red: { color: 0xb81c28, roughness: 0.7 },
    trousers_grey: { color: 0x3a3a42, roughness: 0.7 },
    shoes_blue: { color: 0x22335a, roughness: 0.55 },
    shoes_white: { color: 0xf0f0ec, roughness: 0.55 },
    leather_black: { color: 0x18181c, roughness: 0.4, metalness: 0.1 },
    tie_blue: { color: 0x1f3a6a, roughness: 0.6 },
    frame_dark: { color: 0x222222, roughness: 0.5 },
    briefcase_brown: { color: 0x5a3a22, roughness: 0.55 },
    metal_gold: { color: 0xc8a040, roughness: 0.3, metalness: 0.7 },
    school_badge: { map: 'badge', color: 0xffffff, roughness: 0.7, transparent: true },
    shoulder_stripes: { map: 'stripes', color: 0xffffff, roughness: 0.7, transparent: true },
  };
  const d = DEFS[id] || { color: 0x888888, roughness: 0.75 };
  const cfg = { color: d.color, roughness: d.roughness, metalness: d.metalness || 0.0 };
  if (d.map) cfg.map = tex[d.map];
  if (d.emissive !== undefined) {
    cfg.emissive = d.emissive;
    cfg.emissiveIntensity = d.emissiveIntensity;
  }
  if (d.transparent) cfg.transparent = true;
  _humanoidMatCache[id] = new THREE.MeshStandardMaterial(cfg);
  return _humanoidMatCache[id];
}

// 4.3 buildHumanoidRig(config, parent) — 递归构建（仿 buildZombieFromConfig，独立材质/不注入 blood_drip）
function buildHumanoidRig(config, parent) {
  function createGeometry(node) {
    switch (node.type) {
      case 'Box': {
        const [w, h, d] = node.size;
        return new THREE.BoxGeometry(w, h, d);
      }
      case 'Cylinder': {
        const [rT, h, rB] = node.size;
        return new THREE.CylinderGeometry(rT, rB, h, node.segments || 8);
      }
      case 'Sphere': {
        const [r] = node.size;
        const s = node.segments || [8, 6];
        return new THREE.SphereGeometry(r, s[0], s[1]);
      }
      case 'Plane': {
        const [w, h] = node.size;
        return new THREE.PlaneGeometry(w, h);
      }
      case 'Torus': {
        const [r, tube] = node.size;
        return new THREE.TorusGeometry(r, tube, 6, 12);
      }
      default:
        return null;
    }
  }
  function buildNode(node, parentObj, pivotComp) {
    pivotComp = pivotComp || [0, 0, 0];
    if (node.type === 'Group') {
      const g = new THREE.Group();
      g.name = node.name;
      if (node.position) g.position.set(...node.position);
      if (node.rotation) g.rotation.set(...node.rotation);
      if (node.scale) g.scale.set(...node.scale);
      parentObj.add(g);
      if (node.children) node.children.forEach((c) => buildNode(c, g, [0, 0, 0]));
      return;
    }
    const geo = createGeometry(node);
    if (!geo) return;
    geo.center();
    const mat = node.materialId
      ? getHumanoidMat(node.materialId)
      : new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.75 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = node.name + '_mesh';
    const pos = node.position
      ? [
          node.position[0] + pivotComp[0],
          node.position[1] + pivotComp[1],
          node.position[2] + pivotComp[2],
        ]
      : pivotComp;
    const group = new THREE.Group();
    group.name = node.name;
    group.position.set(pos[0], pos[1], pos[2]);
    if (node.scale) group.scale.set(...node.scale);
    parentObj.add(group);
    let rotTarget = group;
    if (node.pivot) {
      const pivot = new THREE.Group();
      pivot.name = node.name + '_pivot';
      pivot.position.set(node.pivot[0], node.pivot[1], node.pivot[2]);
      group.add(pivot);
      mesh.position.set(-node.pivot[0], -node.pivot[1], -node.pivot[2]);
      pivot.add(mesh);
      rotTarget = pivot;
      group.userData.pivot = pivot;
    } else {
      group.add(mesh);
    }
    if (node.rotation) rotTarget.rotation.set(...node.rotation);
    const childComp = node.pivot ? [-node.pivot[0], -node.pivot[1], -node.pivot[2]] : [0, 0, 0];
    if (node.children) node.children.forEach((c) => buildNode(c, rotTarget, childComp));
  }
  buildNode(config, parent);
  parent.traverse((c) => {
    if (c.isMesh) {
      c.castShadow = true;
      c.receiveShadow = true;
    }
  });
  return parent;
}
```

- [ ] **Step 2: CDP 验证材质 + 构建无错**

控制台执行：

```js
const m = window.EnemyModels.createHumanoidMaterials(); // 注：此时还未暴露，见 Task 3；本步先验证无语法错
```

若 `createHumanoidMaterials` 未暴露，本步可与 Task 3 合并验证。重点：CDP 加载 `index.html`（需先完成 Task 5 的 script 加载）控制台 0 错误，`getHumanoidMat('polo_white')` 返回 `MeshStandardMaterial`（在 Task 3 暴露后验证）。

- [ ] **Step 3: Commit**

```bash
git add models/enemies.js
git commit -m "feat: enemies.js 新增人形材质(createHumanoidMaterials)与构建(buildHumanoidRig)"
```

---

## Task 3: `models/enemies.js` — `createHumanoidAnimationSystem` + `createCampusZombie` + 暴露

**Files:**

- Modify: `models/enemies.js`（接 Task 2 插入段之后；改 `window.EnemyModels` 暴露块）

**Interfaces:**

- Consumes: `AnimationSystem` 类（`enemies.js:670`，本文件内）、`buildHumanoidRig`（Task 2）、`window.HumanoidConfig`（Task 1）
- Produces: `window.EnemyModels.createCampusZombie({variant, heightM, seed})` → THREE.Group（`userData._animSystem`、`userData.enemyType='zombie'`、`userData.variant`）

- [ ] **Step 1: 在 Task 2 代码段之后插入动画系统 + 工厂**

```js
// 4.4 createHumanoidAnimationSystem(root) — rest-pose 偏移动画（复用 AnimationSystem 类）
function createHumanoidAnimationSystem(root) {
  const HC = window.HumanoidConfig;
  const P = {},
    O = {};
  HC.JOINT_NAMES.forEach((n) => {
    P[n] = root.getObjectByName(n + '_pivot');
    O[n] = root.getObjectByName(n);
  });
  O.root = root.getObjectByName('root');
  P.root = O.root;
  if (!P.torso) console.warn('HumanoidAnim: pivots not found');
  const asys = new AnimationSystem(root); // 复用现有类
  asys._restPoses = HC.REST_POSES; // 启用 rest-pose 偏移
  // 动作：关键帧值作偏移量，叠加到 REST_POSES（_restKey: '节点:轴'）
  // Idle 2.0s
  asys.define('Idle', 2.0, [
    {
      target: P.torso,
      prop: 'rotation',
      axis: 'z',
      _restKey: null,
      keys: [
        { t: 0, v: 0 },
        { t: 0.5, v: 0.03 },
        { t: 1, v: 0 },
      ],
    },
    {
      target: O.pelvis,
      prop: 'position',
      axis: 'y',
      _restKey: null,
      keys: [
        { t: 0, v: 0 },
        { t: 0.5, v: 0.02 },
        { t: 1, v: 0 },
      ],
    },
    {
      target: P.head,
      prop: 'rotation',
      axis: 'z',
      _restKey: 'head:z',
      keys: [
        { t: 0, v: 0 },
        { t: 0.5, v: -0.04 },
        { t: 1, v: 0 },
      ],
    },
  ]);
  // Walk 1.4s
  asys.define('Walk', 1.4, [
    {
      target: O.pelvis,
      prop: 'position',
      axis: 'y',
      _restKey: null,
      keys: [
        { t: 0, v: 0 },
        { t: 0.5, v: 0.04 },
        { t: 1, v: 0 },
      ],
    },
    {
      target: P.l_upper_leg,
      prop: 'rotation',
      axis: 'x',
      _restKey: null,
      keys: [
        { t: 0, v: -0.1 },
        { t: 0.25, v: -0.5 },
        { t: 0.5, v: 0.1 },
        { t: 0.75, v: 0.5 },
        { t: 1, v: -0.1 },
      ],
    },
    {
      target: P.r_upper_leg,
      prop: 'rotation',
      axis: 'x',
      _restKey: null,
      keys: [
        { t: 0, v: 0.5 },
        { t: 0.25, v: 0.1 },
        { t: 0.5, v: -0.1 },
        { t: 0.75, v: -0.5 },
        { t: 1, v: 0.5 },
      ],
    },
    {
      target: P.l_lower_leg,
      prop: 'rotation',
      axis: 'x',
      _restKey: null,
      keys: [
        { t: 0, v: 0 },
        { t: 0.5, v: -0.4 },
        { t: 1, v: 0 },
      ],
    },
    {
      target: P.r_lower_leg,
      prop: 'rotation',
      axis: 'x',
      _restKey: null,
      keys: [
        { t: 0, v: -0.4 },
        { t: 0.5, v: 0 },
        { t: 1, v: -0.4 },
      ],
    },
    {
      target: P.l_upper_arm,
      prop: 'rotation',
      axis: 'x',
      _restKey: null,
      keys: [
        { t: 0, v: 0 },
        { t: 0.5, v: -0.3 },
        { t: 1, v: 0 },
      ],
    },
    {
      target: P.r_upper_arm,
      prop: 'rotation',
      axis: 'x',
      _restKey: null,
      keys: [
        { t: 0, v: -0.3 },
        { t: 0.5, v: 0 },
        { t: 1, v: -0.3 },
      ],
    },
  ]);
  // Run 0.8s（学生快）
  asys.define('Run', 0.8, [
    {
      target: P.torso,
      prop: 'rotation',
      axis: 'x',
      _restKey: null,
      keys: [
        { t: 0, v: 0 },
        { t: 1, v: 0.2 },
      ],
    },
    {
      target: O.pelvis,
      prop: 'position',
      axis: 'y',
      _restKey: null,
      keys: [
        { t: 0, v: 0 },
        { t: 0.5, v: 0.07 },
        { t: 1, v: 0 },
      ],
    },
    {
      target: P.l_upper_leg,
      prop: 'rotation',
      axis: 'x',
      _restKey: null,
      keys: [
        { t: 0, v: -0.1 },
        { t: 0.25, v: -0.7 },
        { t: 0.5, v: 0.1 },
        { t: 0.75, v: 0.8 },
        { t: 1, v: -0.1 },
      ],
    },
    {
      target: P.r_upper_leg,
      prop: 'rotation',
      axis: 'x',
      _restKey: null,
      keys: [
        { t: 0, v: 0.8 },
        { t: 0.25, v: 0.1 },
        { t: 0.5, v: -0.1 },
        { t: 0.75, v: -0.7 },
        { t: 1, v: 0.8 },
      ],
    },
    {
      target: P.l_lower_leg,
      prop: 'rotation',
      axis: 'x',
      _restKey: null,
      keys: [
        { t: 0, v: 0 },
        { t: 0.5, v: -0.6 },
        { t: 1, v: 0 },
      ],
    },
    {
      target: P.r_lower_leg,
      prop: 'rotation',
      axis: 'x',
      _restKey: null,
      keys: [
        { t: 0, v: -0.6 },
        { t: 0.5, v: 0 },
        { t: 1, v: -0.6 },
      ],
    },
    {
      target: P.l_upper_arm,
      prop: 'rotation',
      axis: 'x',
      _restKey: null,
      keys: [
        { t: 0, v: 0 },
        { t: 0.5, v: -0.6 },
        { t: 1, v: 0 },
      ],
    },
    {
      target: P.r_upper_arm,
      prop: 'rotation',
      axis: 'x',
      _restKey: null,
      keys: [
        { t: 0, v: -0.6 },
        { t: 0.5, v: 0 },
        { t: 1, v: -0.6 },
      ],
    },
  ]);
  // Attack 1.0s（右爪击）
  asys.define('Attack', 1.0, [
    {
      target: P.r_upper_arm,
      prop: 'rotation',
      axis: 'x',
      _restKey: null,
      keys: [
        { t: 0, v: -0.4 },
        { t: 0.35, v: -1.8 },
        { t: 1, v: -0.4 },
      ],
    },
    {
      target: P.r_forearm,
      prop: 'rotation',
      axis: 'x',
      _restKey: null,
      keys: [
        { t: 0, v: -1.6 },
        { t: 0.35, v: -0.1 },
        { t: 1, v: -1.6 },
      ],
    },
    {
      target: P.torso,
      prop: 'rotation',
      axis: 'x',
      _restKey: null,
      keys: [
        { t: 0, v: 0 },
        { t: 0.3, v: 0.25 },
        { t: 1, v: 0 },
      ],
    },
  ]);
  // Stagger 0.5s（受击硬直）
  asys.define('Stagger', 0.5, [
    {
      target: P.torso,
      prop: 'rotation',
      axis: 'x',
      _restKey: null,
      keys: [
        { t: 0, v: 0 },
        { t: 0.2, v: -0.3 },
        { t: 1, v: 0 },
      ],
    },
    {
      target: P.head,
      prop: 'rotation',
      axis: 'x',
      _restKey: null,
      keys: [
        { t: 0, v: 0 },
        { t: 0.15, v: -0.4 },
        { t: 1, v: 0 },
      ],
    },
  ]);
  // Die 1.5s（前扑瘫软）
  asys.define('Die', 1.5, [
    {
      target: P.root,
      prop: 'rotation',
      axis: 'x',
      _restKey: null,
      keys: [
        { t: 0, v: 0 },
        { t: 0.333, v: Math.PI * 0.48 },
        { t: 1, v: Math.PI * 0.5 },
      ],
    },
    {
      target: O.root,
      prop: 'position',
      axis: 'y',
      _restKey: null,
      keys: [
        { t: 0, v: 0 },
        { t: 0.333, v: -0.15 },
        { t: 0.667, v: -0.45 },
        { t: 1, v: -0.45 },
      ],
    },
    {
      target: P.torso,
      prop: 'rotation',
      axis: 'x',
      _restKey: null,
      keys: [
        { t: 0, v: 0 },
        { t: 0.333, v: -0.15 },
        { t: 1, v: -0.35 },
      ],
    },
    {
      target: P.l_upper_arm,
      prop: 'rotation',
      axis: 'z',
      _restKey: 'l_upper_arm:z',
      keys: [
        { t: 0, v: 0 },
        { t: 0.667, v: -0.6 },
        { t: 1, v: -0.8 },
      ],
    },
    {
      target: P.r_upper_arm,
      prop: 'rotation',
      axis: 'z',
      _restKey: 'r_upper_arm:z',
      keys: [
        { t: 0, v: 0 },
        { t: 0.667, v: 0.6 },
        { t: 1, v: 0.8 },
      ],
    },
  ]);
  return asys;
}

// 4.5 createCampusZombie({variant, heightM, seed}) — 游戏实例工厂
function createCampusZombie(opts) {
  opts = opts || {};
  const HC = window.HumanoidConfig;
  const variant = opts.variant || 'student_m';
  const heightM = opts.heightM != null ? opts.heightM : 1.4;
  // seed → 随机体貌（简单 Mulberry32）
  let s = (opts.seed != null ? opts.seed : Math.floor(Math.random() * 1e9)) >>> 0;
  const rng = () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const vr = HC.HUMANOID_VARIANTS[variant].bodyRange;
  const rand = (a, b) => a + rng() * (b - a);
  const params = {
    height: heightM,
    build: vr.build ? rand(vr.build[0], vr.build[1]) : HC.BODY_PARAMS.build.default,
    hunch: vr.hunch ? rand(vr.hunch[0], vr.hunch[1]) : HC.BODY_PARAMS.hunch.default,
    curves: vr.curves ? rand(vr.curves[0], vr.curves[1]) : 0,
  };
  const config = HC.buildHumanoid(variant, params);
  const root = new THREE.Group();
  root.name = 'campusZombie_root';
  buildHumanoidRig(config, root);
  // 包围盒缩放到目标身高（单位 = heightM / 1.3）
  const bbox = new THREE.Box3().setFromObject(root);
  const curH = bbox.max.y - bbox.min.y;
  const targetUnits = heightM / 1.3; // METERS_PER_UNIT
  const scale = curH > 0 ? targetUnits / curH : 1;
  root.scale.setScalar(scale);
  root.position.y = -bbox.min.y * scale;
  // 头身比：矮→头大（额外头部放大，已含在 BASE；此处不再调）
  // LOD 远距圆柱
  const skeletonGroup = new THREE.Group();
  skeletonGroup.name = '_skeleton';
  while (root.children.length > 0) skeletonGroup.add(root.children[0]);
  root.add(skeletonGroup);
  const isTeacher = variant.startsWith('teacher');
  const cylGeo = new THREE.CylinderGeometry(0.25, 0.35, targetUnits, 6);
  const cylMat = new THREE.MeshBasicMaterial({ color: isTeacher ? 0x3a3a42 : 0x556633 });
  const cylMesh = new THREE.Mesh(cylGeo, cylMat);
  cylMesh.position.y = targetUnits / 2;
  cylMesh.visible = false;
  cylMesh.name = '_lodCylinder';
  root.add(cylMesh);
  root.userData._skeletonGroup = skeletonGroup;
  root.userData._lodCylinder = cylMesh;
  // 动画系统
  const asys = createHumanoidAnimationSystem(root);
  root.userData._animSystem = asys;
  root.userData.enemyType = 'zombie'; // 关键：让 enemyAI isZombie 判定为真，走丧尸状态机
  root.userData.variant = variant; // 变体名（外观/工厂用）
  root.userData._seed = s;
  asys.play('Idle', true);
  return root;
}
```

- [ ] **Step 2: 把新工厂挂到 `window.EnemyModels` 暴露块**

找到 `window.EnemyModels = {` （约 `:927`），在对象内加 `createCampusZombie, createHumanoidMaterials,` 两项：

```js
window.EnemyModels = {
  createAssaultVehicle,
  createZombie,
  createZombieMaterials,
  createCampusZombie, // ← 新增
  createHumanoidMaterials, // ← 新增
  createHexapod,
  AnimationSystem,
};
```

- [ ] **Step 3: CDP 验证工厂产出**

控制台执行：

```js
const z = window.EnemyModels.createCampusZombie({ variant: 'teacher_f', heightM: 1.6, seed: 42 });
console.log(
  'group:',
  z.type,
  'enemyType:',
  z.userData.enemyType,
  'variant:',
  z.userData.variant,
  'hasAnim:',
  !!z.userData._animSystem,
  'torso_pivot:',
  !!z.getObjectByName('torso_pivot'),
  'bust:',
  !!z.getObjectByName('ah_bust_l')
);
```

Expected: `group: Group enemyType: zombie variant: teacher_f hasAnim: true torso_pivot: true bust: true`；控制台 0 错误。

- [ ] **Step 4: Commit**

```bash
git add models/enemies.js
git commit -m "feat: enemies.js 新增 createHumanoidAnimationSystem(rest-pose偏移)与 createCampusZombie 工厂"
```

---

## Task 4: `js/engine.js` — `createEnemies` 加 4 type 分支 + `enemyType`/`_noTerrainPitch` 修正

**Files:**

- Modify: `js/engine.js:5346-5382`（createEnemies 的 type 分发 + enemyType + \_noTerrainPitch）

**Interfaces:**

- Consumes: `window.EnemyModels.createCampusZombie`（Task 3）、`METERS_PER_UNIT=1.3`
- Produces: `student_m/student_f/teacher_m/teacher_f` 四种 type 能被 createEnemies 正确创建并接入丧尸 AI

- [ ] **Step 1: 在 createEnemies 的 `else if (ecfg.type === 'zombie')` 分支后，加 4 变体分支**

定位 `js/engine.js:5346` 附近：

```js
    } else if (ecfg.type === 'zombie') {
      model = window.EnemyModels.createZombie();
    } else if (ecfg.type === 'hexapod') {
```

在 `zombie` 分支与 `hexapod` 分支之间插入：

```js
    } else if (ecfg.type === 'student_m' || ecfg.type === 'student_f'
            || ecfg.type === 'teacher_m' || ecfg.type === 'teacher_f') {
      // 校园人形丧尸：身高随机（学生 1.1-1.5m / 教师 1.55-1.75m）
      const isTeacher = ecfg.type.startsWith('teacher');
      const hRange = isTeacher ? [1.55, 1.75] : [1.1, 1.5];
      const heightM = hRange[0] + Math.random() * (hRange[1] - hRange[0]);
      model = window.EnemyModels.createCampusZombie({ variant: ecfg.type, heightM, seed: ecfg._seed });
    } else if (ecfg.type === 'hexapod') {
```

- [ ] **Step 2: 修正 `enemyType` 与 `_noTerrainPitch`（关键对接，否则 AI 误走车辆状态机）**

定位 `js/engine.js:5377`（`model.userData.enemyType = ecfg.type;`）改为按是否人形变体决定：

```js
model.userData = model.userData || {};
// 人形变体统一标记 enemyType='zombie' 让 enemyAI 走丧尸 8 状态机；变体名另存
const _isCampusVariant =
  ecfg.type === 'student_m' ||
  ecfg.type === 'student_f' ||
  ecfg.type === 'teacher_m' ||
  ecfg.type === 'teacher_f';
model.userData.enemyType = _isCampusVariant ? 'zombie' : ecfg.type;
if (_isCampusVariant) model.userData.variant = ecfg.type;
model.userData.enemyId = ecfg.id;
model.userData.maxHp = model.hp;
```

（删除原 `model.userData.maxHp = model.hp;` 单独行以免重复——确认原 5376 行 `model.userData.maxHp = model.hp;` 已含在上方，避免双写。）

定位 `js/engine.js:5380`（`if (ecfg.type === 'zombie' || ecfg.type === 'hexapod')` 的 `_noTerrainPitch`）扩展为人形变体也直立：

```js
// 丧尸/六足/校园人形变体保持直立（不随地形俯仰）
if (model.userData.enemyType === 'zombie' || ecfg.type === 'hexapod') {
  model.userData._noTerrainPitch = true;
}
```

- [ ] **Step 3: 验证（需先完成 Task 5 的 script 加载与测试数据，否则 createEnemies 因无 enemies 段提前 return）**

本步先确认 `js/engine.js` 加载无语法错（CDP 加载 index.html 控制台 0 错误）。功能验证合入 Task 6。

- [ ] **Step 4: Commit**

```bash
git add js/engine.js
git commit -m "feat: createEnemies 接入 4 种校园人形丧尸 + enemyType/_noTerrainPitch 修正"
```

---

## Task 5: `index.html` 加载脚本 + `campus.map.json` 最小测试数据

**Files:**

- Modify: `index.html`（script 加载区，参考其它 `models/*.js` 加载位置）
- Modify: `maps/campus.map.json`（新增 `enemies` 段）

**Interfaces:**

- Consumes: Task 1-4 的模块
- Produces: 进入校园地图时 `currentMapData.enemies` 有 4 条，createEnemies 生成 4 只丧尸

- [ ] **Step 1: `index.html` 加载 `humanoid_config.js`**

在 `index.html` 加载 `models/enemies.js` 的 `<script>` 标签**之前**加一行（humanoid_config 须先于 enemies 加载，因 enemies 的 createCampusZombie 调 `window.HumanoidConfig`）：

```html
<script src="models/humanoid_config.js"></script>
```

（用 Grep 定位 `<script src="models/enemies.js">` 的确切行，在其上一行插入。）

- [ ] **Step 2: `campus.map.json` 新增 `enemies` 测试段（每种 1 只，放在校园广场可达点）**

在 `maps/campus.map.json` 的顶层 `obstacles` 同级（或 `"spawnPoints"` 之后）加：

```json
  "enemies": [
    { "id": "cz_sm_1", "type": "student_m", "_seed": 1001, "position": [10, 0, -10], "patrolPath": [],
      "cfg": { "hp": 40, "speed": 2.0, "viewDist": 25, "attackDamage": 8, "attackCooldown": 1.5, "dropRate": 0.25, "dropHeal": 30, "score": 50, "reactive": true, "aggressive": false } },
    { "id": "cz_sf_1", "type": "student_f", "_seed": 1002, "position": [-10, 0, -10], "patrolPath": [],
      "cfg": { "hp": 40, "speed": 2.0, "viewDist": 25, "attackDamage": 8, "attackCooldown": 1.5, "dropRate": 0.25, "dropHeal": 30, "score": 50, "reactive": true, "aggressive": false } },
    { "id": "cz_tm_1", "type": "teacher_m", "_seed": 1003, "position": [10, 0, 10], "patrolPath": [],
      "cfg": { "hp": 120, "speed": 1.0, "viewDist": 40, "attackDamage": 20, "attackCooldown": 2.5, "dropRate": 0.25, "dropHeal": 30, "score": 200, "reactive": true, "aggressive": false } },
    { "id": "cz_tf_1", "type": "teacher_f", "_seed": 1004, "position": [-10, 0, 10], "patrolPath": [],
      "cfg": { "hp": 120, "speed": 1.0, "viewDist": 40, "attackDamage": 20, "attackCooldown": 2.5, "dropRate": 0.25, "dropHeal": 30, "score": 200, "reactive": true, "aggressive": false } }
  ],
```

（坐标 `[10,0,-10]` 等位于校园广场区域，避开 footprintBuildings；若该点落在建筑内，运行时敌人会卡住——Task 6 验证时据实微调。）

- [ ] **Step 3: CDP 验证地图加载含 enemies 段**

控制台执行（进主菜单后）：

```js
fetch('maps/campus.map.json')
  .then((r) => r.json())
  .then((d) =>
    console.log(
      'enemies:',
      d.enemies.length,
      d.enemies.map((e) => e.type)
    )
  );
```

Expected: `enemies: 4 ['student_m','student_f','teacher_m','teacher_f']`；0 错误。

- [ ] **Step 4: Commit**

```bash
git add index.html maps/campus.map.json
git commit -m "feat: index.html 加载 humanoid_config + campus.map.json 加 4 只测试丧尸"
```

---

## Task 6: 端到端验证（CDP + Playwright）

**Files:**

- Test: 临时 `pw_test_zombies.js`（用后清理，参考项目既有 `pw_test.js` 模式）

**Interfaces:**

- Consumes: Task 1-5 全部

- [ ] **Step 1: 写 Playwright 验证脚本 `pw_test_zombies.js`**

```js
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('http://127.0.0.1:8080/index.html');
  await page.waitForFunction(
    () => window.HumanoidConfig && window.EnemyModels && window.EnemyModels.createCampusZombie,
    null,
    { timeout: 15000 }
  );
  // 进入校园单人地图
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find((b) =>
      /校园|campus|金福园/i.test(b.textContent)
    );
    if (btn) btn.click();
  });
  await page.waitForFunction(() => window.enemies && window.enemies.length >= 4, null, {
    timeout: 30000,
  });
  const result = await page.evaluate(() => {
    const zs = window.enemies.filter((e) => e.userData && e.userData.variant);
    return {
      count: zs.length,
      variants: zs.map((e) => e.userData.variant),
      enemyTypes: zs.map((e) => e.userData.enemyType),
      allZombieAI: zs.every((e) => e.userData.enemyType === 'zombie'),
      hasAnim: zs.every((e) => !!e.userData._animSystem),
    };
  });
  console.log(JSON.stringify(result, null, 2));
  console.log('consoleErrors:', errors.length, errors.slice(0, 5));
  await page.screenshot({ path: 'pw_campus_zombies.png', fullPage: false });
  await browser.close();
  if (result.count < 4 || !result.allZombieAI || errors.length) process.exit(1);
})();
```

- [ ] **Step 2: 启动服务并运行**

```bash
python server.py &   # 或按项目既有方式确保 8080 单一服务
node pw_test_zombies.js
```

Expected: stdout 输出 `count: 4`，`variants` 含 4 种，`allZombieAI: true`，`hasAnim: true`，`consoleErrors: 0`；截图 `pw_campus_zombies.png` 可见 4 只丧尸（校服/白领装、教师女有体态）。退出码 0。

- [ ] **Step 3: 视觉检查 + 行为检查（人工或截图分析）**

打开 `pw_campus_zombies.png` 或手动进图（`http://127.0.0.1:8080`）确认：

- 4 种丧尸外观可辨（学生 Polo+红领巾+校徽、教师衬衫西裤/裙、女教师胸臀曲线、女学生马尾）
- 丧尸会朝玩家走动（Walk/Run 动画）、近身攻击（Attack 动画+扣血）、被炮弹击中硬直（Stagger）、击杀后倒地（Die 动画）
- 皮肤轻微灰绿、眼睛发光、衣物基本完好（轻度丧尸化）

若 versus 分支不调用 createEnemies（`enemies.length < 4`），在 `engine.js` 的 versus/单人进入入口补调用 `createEnemies()`（参考 `engine.js:5187` 的 `currentMapData.enemies` 守卫），并记入风险。

- [ ] **Step 4: 清理临时脚本并提交**

```bash
rm pw_test_zombies.js pw_campus_zombies.png
git add -A
git commit -m "test: 验证校园 4 种丧尸端到端出现/动画/AI（P1 核心可跑完成）"
```

---

## Self-Review 结论

**Spec 覆盖**：本 plan 覆盖 spec 第 5 节（设计层数据+装配）、6.1–6.7（4 丧尸内容：校服贴图/几何装饰/轻度丧尸化/师生强度/AI 复用）、7.4（createEnemies 对接）、7.7（新建 createHumanoidAnimationSystem 零回归）。**未覆盖**（属后续 plan）：5.3–5.5 工厂接入、7.1–7.3 放置工具页+server.py+固化、7.5 刷新系统、第 10 节 P6 精修。

**类型一致性**：变体名 `student_m/student_f/teacher_m/teacher_f` 在 config（HUMANOID_VARIANTS key）、工厂（variant 入参）、createEnemies（type 分支+enemyType 修正）、map.json（type 字段）四处一致。`createCampusZombie({variant,heightM,seed})` 签名在 Task 3 定义、Task 4 调用，参数名一致。`userData.enemyType/variant/_animSystem/_lodCylinder` 在工厂设置、engine/AI 消费处一致。

**主要风险**（已列 Global Constraints + Task 6 Step 3）：

1. `campus.flat:true` 走 versus 分支，createEnemies 是否被调用需 Task 6 实测；若否则补调用。
2. 校徽"金福园小学"中文 `fillText` 字体在 headless 可能渲染为方块——风险清单第 4 条已有 fallback（拼音/纯树形）。Task 2 用 `sans-serif`，实测若方块则改 `bold 13px "Microsoft YaHei",sans-serif` 或去字留树。
3. 几何尺寸为起始估值，视觉精修在 P6。
4. 测试坐标 `[±10,±10]` 若落在建筑内需微调（Task 6 Step 3 处理）。

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-26-campus-zombies-core.md`. Two execution options:

**1. Subagent-Driven (recommended)** — 每个 task 派一个 fresh subagent 实现，task 间两阶段 review，快速迭代。

**2. Inline Execution** — 本会话内按 executing-plans 批量执行，带检查点。

选哪种？另外本 plan 只覆盖 P1 核心可跑；P2-P6（固化端点/刷新系统/工厂接入/放置工具页/精修）在 P1 完成验收后各自单独规划。
