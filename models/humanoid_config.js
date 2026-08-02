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
                position: [-0.3, 0.18, 0],
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
                position: [0.3, 0.18, 0],
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
        'short_hair_m',
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
        'trousers_grey_calf',
        'leather_shoes',
        'briefcase_opt',
      ],
      bodyRange: { height: [1.55, 1.75], hunch: [0, 0.05] },
    },
    teacher_f: {
      name: '教师(女)',
      materials: { cloth: 'blouse_white', skin: 'skin_zombie' },
      addons: [
        'short_hair_m',
        'bun_f',
        'bust',
        'hips',
        'skirt_grey',
        'leather_shoes',
        'necklace_opt',
      ],
      bodyRange: { height: [1.55, 1.75], hunch: [0, 0.05], build: [0.3, 0.45], curves: [0.6, 0.9] },
    },
  };

  // ④ 装饰节点库（起始几何估值；_materialKey 标记用变体材质还是自带）
  const ADDON_LIBRARY = {
    short_hair_m: {
      parent: 'head',
      node: {
        type: 'Group',
        position: [0, 0.2, -0.02],
        children: [
          {
            name: 'ah_m',
            type: 'Sphere',
            size: [0.22],
            position: [0, 0, 0],
            thetaLength: Math.PI / 2,
            materialId: 'hair_black',
            segments: [12, 10],
          },
        ],
      },
    },
    ponytail_f: {
      parent: 'head',
      node: {
        type: 'Group',
        position: [0, 0.08, -0.22],
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
        size: [0.22, 0.07, 0.06],
        position: [0, 0.1, 0.21],
        materialId: 'hair_black',
      },
    },
    bun_f: {
      parent: 'head',
      node: {
        name: 'ah_bun',
        type: 'Sphere',
        size: [0.1],
        position: [0, 0.22, -0.16],
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
        position: [0, 0.36, 0.19],
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
        position: [0, 0.25, 0.2],
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
      // 裤腿挂腿关节（l_upper_leg_pivot 下，随腿旋转防迈步穿模）；buildHumanoid 双挂 r 侧
      parent: 'l_upper_leg',
      node: {
        name: 'ah_sh_l',
        type: 'Box',
        size: [0.18, 0.26, 0.22],
        position: [0, -0.13, 0], // 髋下 0.13，腰口盖住大腿根（髋）
        materialId: 'shorts_red',
      },
    },
    pleated_skirt_f: {
      parent: 'pelvis',
      node: {
        name: 'ah_skirt',
        type: 'Cylinder',
        size: [0.14, 0.425, 0.46],
        position: [0, -0.0375, 0],
        materialId: 'shorts_red',
        segments: [16, 1],
      },
    }, // 学生短裙：腰口贴 pelvis 底(0.2)，裙摆膝上露小腿；大腿段摆动在裙内（半径0.3 覆盖后蹬位移），膝以下裙外自由
    trousers_grey: {
      // 长裤大腿段：挂腿关节（随髋转）；buildHumanoid 双挂 r 侧。膝以下由 trousers_grey_calf 覆盖
      parent: 'l_upper_leg',
      node: {
        name: 'ah_tr_l',
        type: 'Box',
        size: [0.18, 0.6, 0.22],
        position: [0, -0.3, 0], // 髋下 0.3，覆盖髋到膝上
        materialId: 'trousers_grey',
      },
    },
    trousers_grey_calf: {
      // 长裤小腿段：挂小腿关节（随膝弯，防膝弯穿模）；buildHumanoid 双挂 r 侧
      parent: 'l_lower_leg',
      node: {
        name: 'ah_tc_l',
        type: 'Box',
        size: [0.18, 0.7, 0.22],
        position: [0, -0.35, 0], // 膝下 0.35，覆盖膝到脚踝
        materialId: 'trousers_grey',
      },
    },
    skirt_grey: {
      parent: 'pelvis',
      node: {
        name: 'ah_gskirt',
        type: 'Cylinder',
        size: [0.14, 0.525, 0.53],
        position: [0, -0.0875, 0],
        materialId: 'trousers_grey',
        segments: [16, 1],
      },
    }, // 教师中长裙：腰口贴 pelvis 底(0.2)，裙摆膝下一点露小腿（悬垂静态）
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
        position: [0, 0.2, 0.17],
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
        position: [0, -0.1, 0],
        children: [
          {
            name: 'ah_hips',
            type: 'Sphere',
            size: [0.3],
            position: [0, -0.02, -0.1],
            scale: [1, 0.85, 0.55],
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
        position: [0, 0.03, 0.21],
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
    'pelvis:y': 0.375, // HUMANOID_BASE pelvis.position[1]；动画 keyframe v 为距此基线的偏移
  };

  // ── 节点材质槽位映射（__cloth__/__skin__ 占位 → 变体材质覆写）
  function resolveMaterialId(slot, variantMaterials) {
    if (slot === '__cloth__') return variantMaterials.cloth;
    if (slot === '__skin__') return variantMaterials.skin;
    return slot; // 自带固定材质（eye_glow/hair_black/...）
  }

  // ── addon 子树材质占位递归解析（clone 后、push 前调用）
  // addon 来自 ADDON_LIBRARY，不走 deriveNode，其子树里的 __cloth__/__skin__
  // 需在此解析为变体材质，否则 Task2 getMat 查不到 → 灰球
  function resolveAddonMaterials(node, variantMaterials) {
    if (node.materialId) {
      node.materialId = resolveMaterialId(node.materialId, variantMaterials);
    }
    if (node.children) node.children.forEach((c) => resolveAddonMaterials(c, variantMaterials));
  }

  // ── 深拷贝配置树 + 应用体型派生 + 材质覆写
  function deriveNode(node, params, variant) {
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
    // build → 肢体粗细（四肢半径/宽深放大，长度 Y 不变）
    if (node.size) {
      var _isLimb =
        node.name === 'l_upper_arm' ||
        node.name === 'r_upper_arm' ||
        node.name === 'l_forearm' ||
        node.name === 'r_forearm' ||
        node.name === 'l_upper_leg' ||
        node.name === 'r_upper_leg' ||
        node.name === 'l_lower_leg' ||
        node.name === 'r_lower_leg';
      if (_isLimb) {
        var _bF = 0.7 + params.build * 0.6; // 0→0.7瘦 / 0.5→1.0 / 1→1.3壮
        out.size = node.size.map(function (v, i) {
          return i === 1 ? v : v * _bF;
        });
      }
    }
    // 递归
    if (node.children) out.children = node.children.map((c) => deriveNode(c, params, variant));
    return out;
  }

  // ── 包裹肢体的衣物 addon（袖口/短裤/长裤/裙）：尺寸随 build 派生保持包裹间隙，防肢体变粗穿模
  // limb: 被包裹的肢体节点（deriveNode 已按 build 派生其 size）；gap: 每侧间隙（单位）
  const WRAP_ADDONS = {
    polo_cuff_l: { limb: 'l_forearm', gap: 0.01 },
    polo_cuff_r: { limb: 'r_forearm', gap: 0.01 },
    shorts_m: { limb: 'l_upper_leg', gap: 0.03 },
    trousers_grey: { limb: 'l_upper_leg', gap: 0.03 },
    trousers_grey_calf: { limb: 'l_lower_leg', gap: 0.03 },
    // 裙 = 锥形 Cylinder：腰口(rTop) = 腿半径+0.02（细，被上衣下摆盖住，pelvis 无需加大）
    // 裙摆(rBottom) 按 Run 极限(0.8rad)大腿表面位移 = sqrt(髋X偏移0.13² + (摆长×sin0.8)²) + 腿半径
    //   学生裙摆 -0.25（摆长0.4）→ 0.435 → 0.46；教师裙摆 -0.35（摆长0.5）→ 0.502 → 0.53
    pleated_skirt_f: { limb: 'l_upper_leg', gap: 0.02, gapBottom: 0.34 },
    skirt_grey: { limb: 'l_upper_leg', gap: 0.02, gapBottom: 0.41 },
  };
  // 双侧裤腿部件：addon 双挂到左右腿关节（裤腿随腿旋转防穿模；Box 中心 x=0 无需镜像）
  const DUAL_LEG_ADDONS = {
    shorts_m: ['l_upper_leg', 'r_upper_leg'],
    trousers_grey: ['l_upper_leg', 'r_upper_leg'],
    trousers_grey_calf: ['l_lower_leg', 'r_lower_leg'],
  };
  // addon 子树递归重算包裹尺寸：Cylinder 半径 / Box 全宽深 = 肢体半径 + gap（gapBottom 用于锥形裙摆）
  function applyWrapScale(node, rLimb, gap, gapBottom) {
    if (node.size) {
      if (node.type === 'Cylinder') {
        node.size = [rLimb + gap, node.size[1], rLimb + (gapBottom != null ? gapBottom : gap)];
      } else if (node.type === 'Box') {
        node.size = [(rLimb + gap) * 2, node.size[1], (rLimb + gap) * 2];
      }
    }
    if (node.children) node.children.forEach((c) => applyWrapScale(c, rLimb, gap, gapBottom));
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
    const tree = deriveNode(HUMANOID_BASE, p, variant);
    // 2) 追加装饰节点
    var wrapMax = 0; // 裤/裙最终半宽（半径）最大值，供下摆包裹保证
    variant.addons.forEach((key) => {
      const def = ADDON_LIBRARY[key];
      if (!def) {
        console.warn('buildHumanoid: 未知 addon', key);
        return;
      }
      // shoes_* / leather_shoes 等单脚 addon：同时挂 l_foot 与 r_foot
      // 裤腿（short/long/calf）：双挂到左右腿关节（随腿旋转防迈步穿模）
      const parents =
        DUAL_LEG_ADDONS[key] ||
        (key === 'shoes_blue' || key === 'shoes_white' || key === 'leather_shoes'
          ? ['l_foot', 'r_foot']
          : [def.parent]);
      parents.forEach((par, idx) => {
        const parentNode = findNode(tree, par);
        if (!parentNode) {
          console.warn('buildHumanoid: addon 父节点缺失', par);
          return;
        }
        parentNode.children = parentNode.children || [];
        const clone = JSON.parse(JSON.stringify(def.node));
        // addon 子树占位材质解析（I-1: __cloth__/__skin__ → 变体材质）
        resolveAddonMaterials(clone, variant.materials);
        // 右侧镜像（r_foot / r_* 父节点上的 addon X 取反）
        if (
          par === 'r_foot' ||
          par === 'r_forearm' ||
          par === 'r_upper_leg' ||
          par === 'r_lower_leg'
        )
          mirrorX(clone);
        // curves 放大 bust/hips
        if (key === 'bust' || key === 'hips') scaleGroup(clone, 0.6 + p.curves * 0.8);
        // 包裹肢体的衣物：尺寸跟随派生后肢体粗细（limb 已在 deriveNode 按 build 派生）
        const wrap = WRAP_ADDONS[key];
        if (wrap) {
          const limbNode = findNode(tree, wrap.limb);
          if (limbNode && limbNode.size) {
            applyWrapScale(clone, limbNode.size[0], wrap.gap, wrap.gapBottom);
            // 收集包裹宽度（下摆包裹保证用）：Box 半宽 / Cylinder 半径
            const wrapFirst = clone.children ? clone.children[0] : clone;
            if (wrapFirst && wrapFirst.size) {
              const w = wrapFirst.type === 'Box' ? wrapFirst.size[0] / 2 : wrapFirst.size[0];
              if (w > wrapMax) wrapMax = w;
            }
          }
        }
        clone._addonKey = key + (idx > 0 ? '_r' : '');
        parentNode.children.push(clone);
      });
    });
    // 3) 上衣下摆（pelvis，polo/衬衫下摆延伸到骨盆）随 build 单向联动 + 包裹保证：
    //    半宽/半深 ≥ max(原值×_bF, 裤裙半宽 + 0.02)，build 小不回缩（防收窄破怀）
    //    不动 torso：徽章/条纹/领带等挂件贴其前表面，增厚会被吞
    if (wrapMax > 0) {
      const pelvisNode = findNode(tree, 'pelvis');
      if (pelvisNode && pelvisNode.size) {
        const _bF = 0.7 + p.build * 0.6;
        const needFull = (wrapMax + 0.02) * 2;
        const grow = (v) => Math.max(v, v * _bF, needFull);
        pelvisNode.size = [grow(pelvisNode.size[0]), pelvisNode.size[1], grow(pelvisNode.size[2])];
      }
    }
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
