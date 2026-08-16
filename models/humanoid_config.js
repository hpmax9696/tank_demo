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

  // ①b 三副骨架：关节名/结构一字对齐 HUMANOID_BASE（深拷贝派生），仅 size 与肩宽按变体分化（见 buildHumanoid 选骨架 + 各 base 尺寸）
  const STUDENT_BASE = JSON.parse(JSON.stringify(HUMANOID_BASE));
  const TEACHER_M_BASE = JSON.parse(JSON.stringify(HUMANOID_BASE));
  const TEACHER_F_BASE = JSON.parse(JSON.stringify(HUMANOID_BASE));
  const SKELETON_BY_VARIANT = {
    student_m: STUDENT_BASE,
    student_f: STUDENT_BASE,
    teacher_m: TEACHER_M_BASE,
    teacher_f: TEACHER_F_BASE,
  };

  // ①c 骨架尺寸差异化：setBone 同步 size + pivot(=size/2) + 直接子 position（防 size 改后 pivot 硬编码错位 → 空隙/手臂超肩）
  // pivotAt: 'top'(关节在顶=四肢肩/髋/膝) | 'bottom'(关节在底=躯干腰/颈/头颈接)
  function setBone(root, name, newH, pivotAt, newR) {
    var find = function (n, nm) {
      if (n.name === nm) return n;
      if (n.children)
        for (var i = 0; i < n.children.length; i++) {
          var r = find(n.children[i], nm);
          if (r) return r;
        }
      return null;
    };
    var node = find(root, name);
    if (!node || !node.size) return;
    var isSphere = node.type === 'Sphere';
    var idx = isSphere ? 0 : 1;
    if (newR != null && !isSphere) {
      node.size[0] = newR;
      node.size[2] = newR;
    }
    var oldH = node.size[idx];
    if (oldH === newH) return;
    var ratio = newH / oldH;
    node.size[idx] = newH;
    if (node.pivot) {
      var half = isSphere ? newH : newH / 2;
      node.pivot[1] = pivotAt === 'top' ? half : -half;
    }
    // 直接子 position 按比例缩（子挂此节点，size 缩则子位置同比例缩保持衔接）
    // Sphere（如头）各向同性：子（眼睛）position 全轴 + size 等比缩放，保持球面相对位置；Cylinder 仅 y 轴
    if (node.children)
      node.children.forEach(function (c) {
        if (c.position) {
          if (isSphere) {
            c.position[0] = +(c.position[0] * ratio).toFixed(4);
            c.position[2] = +(c.position[2] * ratio).toFixed(4);
          }
          c.position[1] = +(c.position[1] * ratio).toFixed(4);
        }
        if (isSphere && c.size) {
          for (var k = 0; k < c.size.length; k++) c.size[k] = +(c.size[k] * ratio).toFixed(4);
        }
      });
  }
  function setShoulder(root, x) {
    var walk = function (node) {
      if (node.name === 'l_upper_arm') node.position[0] = -x;
      if (node.name === 'r_upper_arm') node.position[0] = x;
      if (node.children) node.children.forEach(walk);
    };
    walk(root);
  }
  function setNeckRadius(root, r) {
    // neck Cylinder size[rTop, h, rBot]；头缩小后脖子显粗，按变体收细
    var find = function (n, nm) {
      if (n.name === nm) return n;
      if (n.children)
        for (var i = 0; i < n.children.length; i++) {
          var x = find(n.children[i], nm);
          if (x) return x;
        }
      return null;
    };
    var n = find(root, 'neck');
    if (n && n.size) {
      n.size[0] = r;
      n.size[2] = r;
    }
  }
  // 学生（儿童）：原比例已近儿童，仅加长过短手臂（pivot 同步=臂半，防上端超肩）
  setBone(STUDENT_BASE, 'l_upper_arm', 0.52, 'top');
  setBone(STUDENT_BASE, 'r_upper_arm', 0.52, 'top');
  setBone(STUDENT_BASE, 'l_forearm', 0.48, 'top');
  setBone(STUDENT_BASE, 'r_forearm', 0.48, 'top');
  setShoulder(STUDENT_BASE, 0.3);
  // 教师（成人男性）：加长腿 + 加长臂 + 缩头（躯干/颈/骨盆保持原 size，避免头颈躯干衔接空隙）；靠腿长+头缩达成人比例
  setBone(TEACHER_M_BASE, 'l_upper_leg', 0.65, 'top');
  setBone(TEACHER_M_BASE, 'r_upper_leg', 0.65, 'top');
  setBone(TEACHER_M_BASE, 'l_lower_leg', 0.6, 'top');
  setBone(TEACHER_M_BASE, 'r_lower_leg', 0.6, 'top');
  setBone(TEACHER_M_BASE, 'l_upper_arm', 0.55, 'top');
  setBone(TEACHER_M_BASE, 'r_upper_arm', 0.55, 'top');
  setBone(TEACHER_M_BASE, 'l_forearm', 0.5, 'top');
  setBone(TEACHER_M_BASE, 'r_forearm', 0.5, 'top');
  setBone(TEACHER_M_BASE, 'head', 0.17, 'bottom');
  setShoulder(TEACHER_M_BASE, 0.36);
  setNeckRadius(TEACHER_M_BASE, 0.09);
  // 教师（成人女性）：最长腿 + 细臂 + 最小头 + 窄肩（S 曲线：骨架长腿窄肩 + curves 收腰放大 bust/hips）
  setBone(TEACHER_F_BASE, 'l_upper_leg', 0.7, 'top', 0.1);
  setBone(TEACHER_F_BASE, 'r_upper_leg', 0.7, 'top', 0.1);
  setBone(TEACHER_F_BASE, 'l_lower_leg', 0.65, 'top', 0.085);
  setBone(TEACHER_F_BASE, 'r_lower_leg', 0.65, 'top', 0.085);
  setBone(TEACHER_F_BASE, 'l_upper_arm', 0.52, 'top', 0.08);
  setBone(TEACHER_F_BASE, 'r_upper_arm', 0.52, 'top', 0.08);
  setBone(TEACHER_F_BASE, 'l_forearm', 0.47, 'top', 0.065);
  setBone(TEACHER_F_BASE, 'r_forearm', 0.47, 'top', 0.065);
  setBone(TEACHER_F_BASE, 'head', 0.16, 'bottom');
  setShoulder(TEACHER_F_BASE, 0.28);
  setNeckRadius(TEACHER_F_BASE, 0.085);
  // 女教师躯干沙漏化：torso(Box) → Group(两 TaperedBox 沙漏：肩0.52→腰0.30→臀0.48)，腰在中心衔接
  // 配合 curves(bust/hips) + skirt 形成女性 S 曲线；颈/臂原子保留挂 torso
  (function () {
    var f = function (n, nm) {
      if (n.name === nm) return n;
      if (n.children)
        for (var i = 0; i < n.children.length; i++) {
          var r = f(n.children[i], nm);
          if (r) return r;
        }
      return null;
    };
    var torso = f(TEACHER_F_BASE, 'torso');
    if (torso) {
      var orig = torso.children || [];
      delete torso.size;
      delete torso._slot;
      torso.type = 'Group';
      // TaperedBox size[底宽,高,底深,顶宽,顶深,offX,offZ]；torso 原 size[0.6,0.75,0.38]，半高0.375
      torso.children = [
        {
          name: 'torso_upper',
          type: 'TaperedBox',
          size: [0.3, 0.375, 0.22, 0.52, 0.3, 0, 0],
          position: [0, 0.1875, 0],
          materialId: '__cloth__',
        },
        {
          name: 'torso_lower',
          type: 'TaperedBox',
          size: [0.56, 0.375, 0.32, 0.3, 0.22, 0, 0], // 臀端膨大0.48→0.56 盖腿根
          position: [0, -0.1875, 0],
          materialId: '__cloth__',
        },
      ].concat(orig);
    }
  })();

  // 教师取消上衣下摆：pelvis 显裤/裙色（男裤腰 / 女裙腰，skirt_grey 同 trousers_grey 材质）
  // 替代原衣服延伸（避免立方体衣服包裹裤/裙上半的视觉），衬衫/上衣扎进裤裙
  (function () {
    var f = function (n, nm) {
      if (n.name === nm) return n;
      if (n.children)
        for (var i = 0; i < n.children.length; i++) {
          var r = f(n.children[i], nm);
          if (r) return r;
        }
      return null;
    };
    var pm = f(TEACHER_M_BASE, 'pelvis');
    if (pm) pm.materialId = 'trousers_grey';
    var pf = f(TEACHER_F_BASE, 'pelvis');
    if (pf) {
      pf.materialId = 'trousers_grey';
      pf.type = 'TaperedHex'; // 椭圆台替代立方体（臀端宽、腰端窄，衔接沙漏躯干+裙）
      pf.size = [0.62, 0.36, 0.5, 0.54, 0.44]; // 放大[臀宽, 高, 臀深, 腰宽, 腰深]
    }
  })();

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
      // size[1]=大腿长(0.45)略余；position=0 中心对齐大腿mesh中心（childComp -0.2 已含髋下偏移）
      parent: 'l_upper_leg',
      node: {
        name: 'ah_tr_l',
        type: 'Box',
        size: [0.18, 0.68, 0.22],
        position: [0, 0, 0],
        materialId: 'trousers_grey',
      },
    },
    trousers_grey_calf: {
      // 长裤小腿段：挂小腿关节（随膝弯，防膝弯穿模）；buildHumanoid 双挂 r 侧
      // size[1]=小腿长(0.42)；position=0 中心对齐小腿mesh中心（旧 -0.35 叠 childComp -0.2 致底端贴地，腿视觉长一倍）
      parent: 'l_lower_leg',
      node: {
        name: 'ah_tc_l',
        type: 'Box',
        size: [0.18, 0.6, 0.22],
        position: [0, 0, 0],
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
      // 女性胸部：楔形（底面贴上躯干前面、顶线为胸最突出处），替代原两球
      parent: 'torso',
      node: {
        name: 'ah_bust',
        type: 'Wedge',
        size: [0.28, 0.4, 0.16, 0.14], // 底面梯形[靠腰窄bwBottom, 靠肩宽bwTop, 胸高, 突出]
        position: [0, 0.16, 0.2], // 胸位(躯干上部) + 前(z+)
        materialId: '__cloth__',
      },
    },
    hips: {
      // 臀部：楔形贴下躯干(torso_lower 沙漏下段)后面，顶线为臀最突出处
      parent: 'torso',
      node: {
        name: 'ah_hips',
        type: 'Wedge',
        size: [0.48, 0.3, 0.18, 0.12], // 底面梯形[靠腿宽bwBottom, 靠腰窄bwTop, 臀高, 突出]
        position: [0, -0.28, -0.18], // 臀位(底边与 torso_lower 底重合) + 后(z-)
        rotation: [0, Math.PI, 0], // 朝后突出
        materialId: '__cloth__',
      },
    },
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
    'torso_upper',
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
    'l_upper_arm:z': 0.09,
    'r_upper_arm:z': -0.09,
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
      curves: params.curves != null ? params.curves : variantKey === 'teacher_f' ? 0.7 : 0,
    };
    // 1) 深拷贝 BASE + 派生（按变体选骨架：学生共享 STUDENT_BASE / 教师男女各一套）
    var base = SKELETON_BY_VARIANT[variantKey] || HUMANOID_BASE;
    const tree = deriveNode(base, p, variant);
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
    // 教师取消上衣下摆（扎裤/裙）：不 grow pelvis（pelvis 显裤/裙色而非衣服延伸）
    if (wrapMax > 0 && variantKey !== 'teacher_m' && variantKey !== 'teacher_f') {
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

  // ═══ 新数据层（Phase 1）：版本化骨架 + 字面值变体 + 烘焙工具 ═══
  // WORKING_SKELETON：工厂骨架模式的编辑对象 —— 写实 7.5 头身通用拓扑白模
  // setBone 同步 size+pivot+子position（衔接保证）；手是新增关节（通用拓扑含手）
  var WORKING_SKELETON = {"name":"root","type":"Group","position":[0.08,0.1859,0],"rotation":[0,0,0],"children":[{"name":"pelvis","type":"TaperedBox","size":[0.3,0.135,0.1468801484276677,0.3,0.22,0,-0.001745367603108186,0,0],"position":[0,0.5,0],"materialId":"__cloth__","children":[{"name":"torso","type":"Group","position":[0,0.0675,0.04],"rotation":[0,0,0],"materialId":"__cloth__","children":[{"name":"torso_upper","type":"RidgeBox","size":[0.18,0.29,0.16,0.3,0.12,0,-0.05888512803143086,0.2,0.07869616132342962],"position":[0,0.299,-0.0079],"materialId":"__skin__","rotation":[0,0,0],"visible":true,"pivot":[0,-0.145,0],"children":[{"name":"neck","type":"Cylinder","size":[0.04,0.061,0.04],"position":[0,0.1755,-0.0421],"rotation":[0,0,0],"pivot":[0,-0.0305,0],"materialId":"__skin__","children":[{"name":"head","type":"Sphere","size":[0.08929999999999999],"position":[0,0.0874,0.0032],"rotation":[0,0,0],"pivot":[0,-0.08929999999999999,0],"materialId":"__skin__","segments":[6,5],"children":[{"name":"l_eye_glow","type":"Sphere","size":[0.019],"position":[0.0285,0.019,0.0665],"materialId":"eye_glow","segments":[5,4],"rotation":[0,0,0],"visible":true},{"name":"r_eye_glow","type":"Sphere","size":[0.019],"position":[-0.0285,0.019,0.0665],"materialId":"eye_glow","segments":[5,4],"rotation":[0,0,0],"visible":true}],"visible":true}],"visible":true},{"name":"l_upper_arm","type":"Cylinder","size":[0.052,0.275,0.03],"position":[0.1966,0.0075,-0.0321],"rotation":[0,0,0],"pivot":[0,0.1375,0],"materialId":"__skin__","children":[{"name":"l_forearm","type":"Cylinder","size":[0.03,0.255,0.035],"position":[0,-0.2567,0],"pivot":[0,0.1275,0],"materialId":"__skin__","children":[{"name":"l_hand","type":"Box","size":[0.052,0.104,0.045],"position":[0,-0.18,0],"pivot":[0,0.052,0],"materialId":"__skin__","rotation":[0,0,0],"visible":true}],"rotation":[0,0,0],"visible":true}],"visible":true},{"name":"r_upper_arm","type":"Cylinder","size":[0.052,0.275,0.03],"position":[-0.1966,0.0075,-0.0321],"rotation":[0,0,0],"pivot":[0,0.1375,0],"materialId":"__skin__","children":[{"name":"r_forearm","type":"Cylinder","size":[0.03,0.255,0.035],"position":[0,-0.2567,0],"pivot":[0,0.1275,0],"materialId":"__skin__","children":[{"name":"r_hand","type":"Box","size":[0.052,0.104,0.045],"position":[0,-0.18,0],"pivot":[0,0.052,0],"materialId":"__skin__","rotation":[0,0,0],"visible":true}],"rotation":[0,0,0],"visible":true}],"visible":true}]},{"name":"torso_lower","type":"TaperedBox","size":[0.3,0.154,0.22,0.18,0.16,0,0,0,-0.04],"position":[0,0.077,-0.04],"materialId":"__skin__","rotation":[0,0,0],"visible":true}],"visible":true},{"name":"l_upper_leg","type":"Cylinder","size":[0.061,0.34650000000000003,0.061],"position":[0.075,-0.175,0],"pivot":[0,0.17325000000000002,0],"materialId":"__skin__","children":[{"name":"l_lower_leg","type":"Cylinder","size":[0.052,0.34650000000000003,0.052],"position":[0,-0.3234,0],"pivot":[0,0.17325000000000002,0],"materialId":"__skin__","children":[{"name":"l_foot","type":"Box","size":[0.112,0.045,0.225],"position":[0,-0.165,0.06],"pivot":[0,0.05,-0.1],"materialId":"__skin__","rotation":[0,0,0],"visible":true}],"rotation":[0,0,0],"visible":true}],"rotation":[0,0,0],"visible":true},{"name":"r_upper_leg","type":"Cylinder","size":[0.061,0.34650000000000003,0.061],"position":[-0.075,-0.175,0],"pivot":[0,0.17325000000000002,0],"materialId":"__skin__","children":[{"name":"r_lower_leg","type":"Cylinder","size":[0.052,0.34650000000000003,0.052],"position":[0,-0.3234,0],"pivot":[0,0.17325000000000002,0],"materialId":"__skin__","children":[{"name":"r_foot","type":"Box","size":[0.112,0.045,0.225],"position":[0,-0.165,0.06],"pivot":[0,0.05,-0.1],"materialId":"__skin__","rotation":[0,0,0],"visible":true}],"rotation":[0,0,0],"visible":true}],"rotation":[0,0,0],"visible":true}],"rotation":[0,0,0],"visible":true}],"visible":true};

  

  

  

    // ── BASE_ANIMS：基本动画模板（每骨架版本复制出自己的 anims，互不共享；新骨架从此派生）──
  // target 用 {kind, joint} 表示：kind=P → 关节 pivot；kind=O → 关节原对象（position 轨道）
  const BASE_ANIMS = {
    restPoses: REST_POSES,
    actions: {"Idle":[{"kind":"O","joint":"torso","prop":"rotation","axis":"z","restKey":null,"keys":[{"t":0,"v":0},{"t":0.5,"v":0.03},{"t":1,"v":0}]},{"kind":"O","joint":"pelvis","prop":"position","axis":"y","restKey":"pelvis:y","keys":[{"t":0,"v":0},{"t":0.5,"v":0.02},{"t":1,"v":0}]},{"kind":"P","joint":"head","prop":"rotation","axis":"z","restKey":"head:z","keys":[{"t":0,"v":0},{"t":0.5,"v":-0.04},{"t":1,"v":0}]}],"Walk":[{"kind":"O","joint":"pelvis","prop":"position","axis":"y","restKey":"pelvis:y","keys":[{"t":0,"v":0},{"t":0.5,"v":0.04},{"t":1,"v":0}]},{"kind":"P","joint":"l_upper_leg","prop":"rotation","axis":"x","restKey":null,"keys":[{"t":0,"v":-0.45},{"t":0.25,"v":-0.08},{"t":0.5,"v":0.12},{"t":0.75,"v":0.25},{"t":1,"v":-0.45}]},{"kind":"P","joint":"r_upper_leg","prop":"rotation","axis":"x","restKey":null,"keys":[{"t":0,"v":0.25},{"t":0.25,"v":-0.45},{"t":0.5,"v":-0.08},{"t":0.75,"v":0.12},{"t":1,"v":0.25}]},{"kind":"P","joint":"l_lower_leg","prop":"rotation","axis":"x","restKey":null,"keys":[{"t":0,"v":-0.3},{"t":0.25,"v":0.12},{"t":0.5,"v":0.37},{"t":0.75,"v":1.35},{"t":1,"v":-0.3}]},{"kind":"P","joint":"r_lower_leg","prop":"rotation","axis":"x","restKey":null,"keys":[{"t":0,"v":0.37},{"t":0.25,"v":1.35},{"t":0.5,"v":-0.3},{"t":0.75,"v":0.12},{"t":1,"v":0.37}]},{"kind":"P","joint":"l_upper_arm","prop":"rotation","axis":"x","restKey":null,"keys":[{"t":0,"v":0.35},{"t":0.25,"v":0.1},{"t":0.5,"v":-0.35},{"t":0.75,"v":0.1},{"t":1,"v":0.35}]},{"kind":"P","joint":"r_upper_arm","prop":"rotation","axis":"x","restKey":null,"keys":[{"t":0,"v":-0.35},{"t":0.25,"v":-0.1},{"t":0.5,"v":0.35},{"t":0.75,"v":-0.1},{"t":1,"v":-0.35}]}],"Run":[{"kind":"O","joint":"torso","prop":"rotation","axis":"x","restKey":null,"keys":[{"t":0,"v":0.3},{"t":0.5,"v":0.15},{"t":1,"v":0.3}]},{"kind":"O","joint":"pelvis","prop":"position","axis":"y","restKey":"pelvis:y","keys":[{"t":0,"v":0},{"t":0.5,"v":0.08},{"t":1,"v":0}]},{"kind":"P","joint":"l_upper_leg","prop":"rotation","axis":"x","restKey":null,"keys":[{"t":0,"v":-0.85},{"t":0.25,"v":-0.2},{"t":0.5,"v":0.15},{"t":0.75,"v":0.35},{"t":1,"v":-0.85}]},{"kind":"P","joint":"r_upper_leg","prop":"rotation","axis":"x","restKey":null,"keys":[{"t":0,"v":0.15},{"t":0.25,"v":0.35},{"t":0.5,"v":-0.85},{"t":0.75,"v":-0.2},{"t":1,"v":0.15}]},{"kind":"P","joint":"l_lower_leg","prop":"rotation","axis":"x","restKey":null,"keys":[{"t":0,"v":-0.3},{"t":0.25,"v":0.05},{"t":0.5,"v":0.75},{"t":0.75,"v":1.85},{"t":1,"v":-0.3}]},{"kind":"P","joint":"r_lower_leg","prop":"rotation","axis":"x","restKey":null,"keys":[{"t":0,"v":0.75},{"t":0.25,"v":1.85},{"t":0.5,"v":-0.3},{"t":0.75,"v":0.05},{"t":1,"v":0.75}]},{"kind":"P","joint":"l_upper_arm","prop":"rotation","axis":"x","restKey":null,"keys":[{"t":0,"v":0.5},{"t":0.25,"v":0.15},{"t":0.5,"v":-0.5},{"t":0.75,"v":0.15},{"t":1,"v":0.5}]},{"kind":"P","joint":"r_upper_arm","prop":"rotation","axis":"x","restKey":null,"keys":[{"t":0,"v":-0.5},{"t":0.25,"v":-0.15},{"t":0.5,"v":0.5},{"t":0.75,"v":-0.15},{"t":1,"v":-0.5}]}],"Attack":[{"kind":"O","joint":"torso","prop":"rotation","axis":"x","restKey":"torso:x","keys":[{"t":0,"v":0},{"t":0.45,"v":-0.12},{"t":0.55,"v":0.3},{"t":0.78,"v":0.08},{"t":1,"v":0}]},{"kind":"P","joint":"torso_upper","prop":"rotation","axis":"x","restKey":null,"keys":[{"t":0,"v":0},{"t":0.45,"v":0.02},{"t":0.55,"v":0.42},{"t":0.78,"v":0.12},{"t":1,"v":0}]},{"kind":"P","joint":"l_upper_arm","prop":"rotation","axis":"x","restKey":null,"keys":[{"t":0,"v":-0.1},{"t":0.45,"v":-1.8},{"t":0.55,"v":-0.4},{"t":1,"v":-0.1}]},{"kind":"P","joint":"r_upper_arm","prop":"rotation","axis":"x","restKey":null,"keys":[{"t":0,"v":-0.1},{"t":0.45,"v":-1.8},{"t":0.55,"v":-0.4},{"t":1,"v":-0.1}]},{"kind":"P","joint":"l_forearm","prop":"rotation","axis":"x","restKey":null,"keys":[{"t":0,"v":-1.6},{"t":0.45,"v":-0.2},{"t":0.55,"v":-0.5},{"t":1,"v":-1.6}]},{"kind":"P","joint":"r_forearm","prop":"rotation","axis":"x","restKey":null,"keys":[{"t":0,"v":-1.6},{"t":0.45,"v":-0.2},{"t":0.55,"v":-0.5},{"t":1,"v":-1.6}]}],"Stagger":[{"kind":"O","joint":"torso","prop":"rotation","axis":"x","restKey":null,"keys":[{"t":0,"v":0},{"t":0.2,"v":-0.3},{"t":1,"v":0}]},{"kind":"P","joint":"head","prop":"rotation","axis":"x","restKey":null,"keys":[{"t":0,"v":0},{"t":0.15,"v":-0.4},{"t":1,"v":0}]}],"Die":[{"kind":"P","joint":"root","prop":"rotation","axis":"x","restKey":null,"keys":[{"t":0,"v":0},{"t":0.3,"v":0.3},{"t":0.55,"v":1.15},{"t":0.78,"v":1.6},{"t":0.9,"v":1.55},{"t":1,"v":1.5707963267948966}]},{"kind":"O","joint":"root","prop":"position","axis":"y","restKey":null,"keys":[{"t":0,"v":0.75},{"t":0.55,"v":0.7},{"t":0.78,"v":0.55},{"t":1,"v":0.475}]},{"kind":"O","joint":"torso","prop":"rotation","axis":"x","restKey":null,"keys":[{"t":0,"v":0.2},{"t":0.35,"v":0.4},{"t":0.7,"v":0.05},{"t":1,"v":0}]},{"kind":"P","joint":"neck","prop":"rotation","axis":"x","restKey":null,"keys":[{"t":0,"v":0.22},{"t":0.4,"v":0.35},{"t":1,"v":0.05}]},{"kind":"P","joint":"head","prop":"rotation","axis":"z","restKey":null,"keys":[{"t":0,"v":0.08},{"t":0.5,"v":0.1},{"t":1,"v":0.7}]},{"kind":"P","joint":"l_upper_arm","prop":"rotation","axis":"z","restKey":null,"keys":[{"t":0,"v":0.09},{"t":0.4,"v":0.15},{"t":0.75,"v":1.1},{"t":1,"v":0.95}]},{"kind":"P","joint":"r_upper_arm","prop":"rotation","axis":"z","restKey":null,"keys":[{"t":0,"v":-0.09},{"t":0.4,"v":-0.15},{"t":0.75,"v":-0.75},{"t":1,"v":-0.6}]},{"kind":"P","joint":"l_forearm","prop":"rotation","axis":"x","restKey":null,"keys":[{"t":0,"v":0},{"t":0.5,"v":-0.25},{"t":1,"v":-0.4}]},{"kind":"P","joint":"r_forearm","prop":"rotation","axis":"x","restKey":null,"keys":[{"t":0,"v":0},{"t":0.5,"v":-0.35},{"t":1,"v":-0.55}]},{"kind":"P","joint":"l_upper_leg","prop":"rotation","axis":"x","restKey":null,"keys":[{"t":0,"v":0},{"t":0.25,"v":-0.15},{"t":0.7,"v":0.05},{"t":1,"v":-0.06}]},{"kind":"P","joint":"r_upper_leg","prop":"rotation","axis":"x","restKey":null,"keys":[{"t":0,"v":0},{"t":0.25,"v":-0.15},{"t":0.7,"v":0.08},{"t":1,"v":-0.1}]},{"kind":"P","joint":"l_upper_leg","prop":"rotation","axis":"z","restKey":null,"keys":[{"t":0,"v":0},{"t":0.6,"v":0.05},{"t":1,"v":0.1}]},{"kind":"P","joint":"r_upper_leg","prop":"rotation","axis":"z","restKey":null,"keys":[{"t":0,"v":0},{"t":0.6,"v":-0.08},{"t":1,"v":-0.16}]},{"kind":"P","joint":"l_lower_leg","prop":"rotation","axis":"x","restKey":null,"keys":[{"t":0,"v":0},{"t":0.25,"v":0.35},{"t":0.8,"v":0.06},{"t":1,"v":0.04}]},{"kind":"P","joint":"r_lower_leg","prop":"rotation","axis":"x","restKey":null,"keys":[{"t":0,"v":0},{"t":0.25,"v":0.35},{"t":0.8,"v":0.22},{"t":1,"v":0.15}]}]},
  };

var SKELETON_VERSIONS = {
  "v1-成年中性-20260810": {
    "date": "2026-08-10",
    "note": "微调定稿中性基底",
    "tree": {
      "name": "root",
      "type": "Group",
      "position": [
        0.08,
        0.1859,
        0
      ],
      "rotation": [
        0,
        0,
        0
      ],
      "children": [
        {
          "name": "pelvis",
          "type": "TaperedBox",
          "size": [
            0.3,
            0.135,
            0.1468801484276677,
            0.3,
            0.22,
            0,
            -0.001745367603108186,
            0,
            0
          ],
          "position": [
            0,
            0.5,
            0
          ],
          "materialId": "__cloth__",
          "children": [
            {
              "name": "torso",
              "type": "Group",
              "position": [
                0,
                0.0675,
                0.04
              ],
              "rotation": [
                0,
                0,
                0
              ],
              "materialId": "__cloth__",
              "children": [
                {
                  "name": "torso_upper",
                  "type": "RidgeBox",
                  "size": [
                    0.18,
                    0.29,
                    0.16,
                    0.3,
                    0.12,
                    0,
                    -0.05888512803143086,
                    0.2,
                    0.07869616132342962
                  ],
                  "position": [
                    0,
                    0.299,
                    -0.0079
                  ],
                  "materialId": "__skin__",
                  "rotation": [
                    0,
                    0,
                    0
                  ],
                  "visible": true,
                  "pivot": [
                    0,
                    -0.145,
                    0
                  ],
                  "children": [
                    {
                      "name": "neck",
                      "type": "Cylinder",
                      "size": [
                        0.04,
                        0.061,
                        0.04
                      ],
                      "position": [
                        0,
                        0.1755,
                        -0.0421
                      ],
                      "rotation": [
                        0,
                        0,
                        0
                      ],
                      "pivot": [
                        0,
                        -0.0305,
                        0
                      ],
                      "materialId": "__skin__",
                      "children": [
                        {
                          "name": "head",
                          "type": "Sphere",
                          "size": [
                            0.08929999999999999
                          ],
                          "position": [
                            0,
                            0.0874,
                            0.0032
                          ],
                          "rotation": [
                            0,
                            0,
                            0
                          ],
                          "pivot": [
                            0,
                            -0.08929999999999999,
                            0
                          ],
                          "materialId": "__skin__",
                          "segments": [
                            6,
                            5
                          ],
                          "children": [
                            {
                              "name": "l_eye_glow",
                              "type": "Sphere",
                              "size": [
                                0.019
                              ],
                              "position": [
                                0.0285,
                                0.019,
                                0.0665
                              ],
                              "materialId": "eye_glow",
                              "segments": [
                                5,
                                4
                              ],
                              "rotation": [
                                0,
                                0,
                                0
                              ],
                              "visible": true
                            },
                            {
                              "name": "r_eye_glow",
                              "type": "Sphere",
                              "size": [
                                0.019
                              ],
                              "position": [
                                -0.0285,
                                0.019,
                                0.0665
                              ],
                              "materialId": "eye_glow",
                              "segments": [
                                5,
                                4
                              ],
                              "rotation": [
                                0,
                                0,
                                0
                              ],
                              "visible": true
                            }
                          ],
                          "visible": true
                        }
                      ],
                      "visible": true
                    },
                    {
                      "name": "l_upper_arm",
                      "type": "Cylinder",
                      "size": [
                        0.052,
                        0.275,
                        0.03
                      ],
                      "position": [
                        0.171,
                        0.0075,
                        -0.0321
                      ],
                      "rotation": [
                        0,
                        0,
                        0
                      ],
                      "pivot": [
                        0,
                        0.1375,
                        0
                      ],
                      "materialId": "__skin__",
                      "children": [
                        {
                          "name": "l_forearm",
                          "type": "Cylinder",
                          "size": [
                            0.03,
                            0.255,
                            0.035
                          ],
                          "position": [
                            0,
                            -0.2567,
                            0
                          ],
                          "pivot": [
                            0,
                            0.1275,
                            0
                          ],
                          "materialId": "__skin__",
                          "children": [
                            {
                              "name": "l_hand",
                              "type": "Box",
                              "size": [
                                0.052,
                                0.104,
                                0.045
                              ],
                              "position": [
                                0,
                                -0.18,
                                0
                              ],
                              "pivot": [
                                0,
                                0.052,
                                0
                              ],
                              "materialId": "__skin__",
                              "rotation": [
                                0,
                                0,
                                0
                              ],
                              "visible": true
                            }
                          ],
                          "rotation": [
                            0,
                            0,
                            0
                          ],
                          "visible": true
                        }
                      ],
                      "visible": true
                    },
                    {
                      "name": "r_upper_arm",
                      "type": "Cylinder",
                      "size": [
                        0.052,
                        0.275,
                        0.03
                      ],
                      "position": [
                        -0.171,
                        0.0075,
                        -0.0321
                      ],
                      "rotation": [
                        0,
                        0,
                        0
                      ],
                      "pivot": [
                        0,
                        0.1375,
                        0
                      ],
                      "materialId": "__skin__",
                      "children": [
                        {
                          "name": "r_forearm",
                          "type": "Cylinder",
                          "size": [
                            0.03,
                            0.255,
                            0.035
                          ],
                          "position": [
                            0,
                            -0.2567,
                            0
                          ],
                          "pivot": [
                            0,
                            0.1275,
                            0
                          ],
                          "materialId": "__skin__",
                          "children": [
                            {
                              "name": "r_hand",
                              "type": "Box",
                              "size": [
                                0.052,
                                0.104,
                                0.045
                              ],
                              "position": [
                                0,
                                -0.18,
                                0
                              ],
                              "pivot": [
                                0,
                                0.052,
                                0
                              ],
                              "materialId": "__skin__",
                              "rotation": [
                                0,
                                0,
                                0
                              ],
                              "visible": true
                            }
                          ],
                          "rotation": [
                            0,
                            0,
                            0
                          ],
                          "visible": true
                        }
                      ],
                      "visible": true
                    }
                  ]
                },
                {
                  "name": "torso_lower",
                  "type": "TaperedBox",
                  "size": [
                    0.3,
                    0.154,
                    0.22,
                    0.18,
                    0.16,
                    0,
                    0,
                    0,
                    -0.04
                  ],
                  "position": [
                    0,
                    0.077,
                    -0.04
                  ],
                  "materialId": "__skin__",
                  "rotation": [
                    0,
                    0,
                    0
                  ],
                  "visible": true
                }
              ],
              "visible": true
            },
            {
              "name": "l_upper_leg",
              "type": "Cylinder",
              "size": [
                0.061,
                0.34650000000000003,
                0.061
              ],
              "position": [
                0.075,
                -0.175,
                0
              ],
              "pivot": [
                0,
                0.17325000000000002,
                0
              ],
              "materialId": "__skin__",
              "children": [
                {
                  "name": "l_lower_leg",
                  "type": "Cylinder",
                  "size": [
                    0.052,
                    0.34650000000000003,
                    0.052
                  ],
                  "position": [
                    0,
                    -0.3234,
                    0
                  ],
                  "pivot": [
                    0,
                    0.17325000000000002,
                    0
                  ],
                  "materialId": "__skin__",
                  "children": [
                    {
                      "name": "l_foot",
                      "type": "Box",
                      "size": [
                        0.112,
                        0.045,
                        0.225
                      ],
                      "position": [
                        0,
                        -0.165,
                        0.06
                      ],
                      "pivot": [
                        0,
                        0.05,
                        -0.1
                      ],
                      "materialId": "__skin__",
                      "rotation": [
                        0,
                        0,
                        0
                      ],
                      "visible": true
                    }
                  ],
                  "rotation": [
                    0,
                    0,
                    0
                  ],
                  "visible": true
                }
              ],
              "rotation": [
                0,
                0,
                0
              ],
              "visible": true
            },
            {
              "name": "r_upper_leg",
              "type": "Cylinder",
              "size": [
                0.061,
                0.34650000000000003,
                0.061
              ],
              "position": [
                -0.075,
                -0.175,
                0
              ],
              "pivot": [
                0,
                0.17325000000000002,
                0
              ],
              "materialId": "__skin__",
              "children": [
                {
                  "name": "r_lower_leg",
                  "type": "Cylinder",
                  "size": [
                    0.052,
                    0.34650000000000003,
                    0.052
                  ],
                  "position": [
                    0,
                    -0.3234,
                    0
                  ],
                  "pivot": [
                    0,
                    0.17325000000000002,
                    0
                  ],
                  "materialId": "__skin__",
                  "children": [
                    {
                      "name": "r_foot",
                      "type": "Box",
                      "size": [
                        0.112,
                        0.045,
                        0.225
                      ],
                      "position": [
                        0,
                        -0.165,
                        0.06
                      ],
                      "pivot": [
                        0,
                        0.05,
                        -0.1
                      ],
                      "materialId": "__skin__",
                      "rotation": [
                        0,
                        0,
                        0
                      ],
                      "visible": true
                    }
                  ],
                  "rotation": [
                    0,
                    0,
                    0
                  ],
                  "visible": true
                }
              ],
              "rotation": [
                0,
                0,
                0
              ],
              "visible": true
            }
          ],
          "rotation": [
            0,
            0,
            0
          ],
          "visible": true
        }
      ],
      "visible": true
    },
    "anims": {
      "restPoses": {
        "torso:x": 0.2,
        "neck:x": 0.22,
        "head:z": 0.08,
        "l_upper_arm:z": 0.09,
        "r_upper_arm:z": -0.09,
        "pelvis:y": 0.5
      },
      "actions": {
        "Idle": [
          {
            "kind": "O",
            "joint": "torso",
            "prop": "rotation",
            "axis": "z",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": 0
              },
              {
                "t": 0.5,
                "v": 0.03
              },
              {
                "t": 1,
                "v": 0
              }
            ]
          },
          {
            "kind": "O",
            "joint": "pelvis",
            "prop": "position",
            "axis": "y",
            "restKey": "pelvis:y",
            "keys": [
              {
                "t": 0,
                "v": 0
              },
              {
                "t": 0.5,
                "v": 0.02
              },
              {
                "t": 1,
                "v": 0
              }
            ]
          },
          {
            "kind": "P",
            "joint": "head",
            "prop": "rotation",
            "axis": "z",
            "restKey": "head:z",
            "keys": [
              {
                "t": 0,
                "v": 0
              },
              {
                "t": 0.5,
                "v": -0.04
              },
              {
                "t": 1,
                "v": 0
              }
            ]
          }
        ],
        "Walk": [
          {
            "kind": "O",
            "joint": "pelvis",
            "prop": "position",
            "axis": "y",
            "restKey": "pelvis:y",
            "keys": [
              {
                "t": 0,
                "v": 0
              },
              {
                "t": 0.5,
                "v": 0.04
              },
              {
                "t": 1,
                "v": 0
              }
            ]
          },
          {
            "kind": "P",
            "joint": "l_upper_leg",
            "prop": "rotation",
            "axis": "x",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": -0.45
              },
              {
                "t": 0.25,
                "v": -0.08
              },
              {
                "t": 0.5,
                "v": 0.12
              },
              {
                "t": 0.75,
                "v": 0.25
              },
              {
                "t": 1,
                "v": -0.45
              }
            ]
          },
          {
            "kind": "P",
            "joint": "r_upper_leg",
            "prop": "rotation",
            "axis": "x",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": 0.25
              },
              {
                "t": 0.25,
                "v": -0.45
              },
              {
                "t": 0.5,
                "v": -0.08
              },
              {
                "t": 0.75,
                "v": 0.12
              },
              {
                "t": 1,
                "v": 0.25
              }
            ]
          },
          {
            "kind": "P",
            "joint": "l_lower_leg",
            "prop": "rotation",
            "axis": "x",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": -0.3
              },
              {
                "t": 0.25,
                "v": 0.12
              },
              {
                "t": 0.5,
                "v": 0.37
              },
              {
                "t": 0.75,
                "v": 1.35
              },
              {
                "t": 1,
                "v": -0.3
              }
            ]
          },
          {
            "kind": "P",
            "joint": "r_lower_leg",
            "prop": "rotation",
            "axis": "x",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": 0.37
              },
              {
                "t": 0.25,
                "v": 1.35
              },
              {
                "t": 0.5,
                "v": -0.3
              },
              {
                "t": 0.75,
                "v": 0.12
              },
              {
                "t": 1,
                "v": 0.37
              }
            ]
          },
          {
            "kind": "P",
            "joint": "l_upper_arm",
            "prop": "rotation",
            "axis": "x",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": 0.35
              },
              {
                "t": 0.25,
                "v": 0.1
              },
              {
                "t": 0.5,
                "v": -0.35
              },
              {
                "t": 0.75,
                "v": 0.1
              },
              {
                "t": 1,
                "v": 0.35
              }
            ]
          },
          {
            "kind": "P",
            "joint": "r_upper_arm",
            "prop": "rotation",
            "axis": "x",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": -0.35
              },
              {
                "t": 0.25,
                "v": -0.1
              },
              {
                "t": 0.5,
                "v": 0.35
              },
              {
                "t": 0.75,
                "v": -0.1
              },
              {
                "t": 1,
                "v": -0.35
              }
            ]
          }
        ],
        "Run": [
          {
            "kind": "O",
            "joint": "torso",
            "prop": "rotation",
            "axis": "x",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": 0.3
              },
              {
                "t": 0.5,
                "v": 0.15
              },
              {
                "t": 1,
                "v": 0.3
              }
            ]
          },
          {
            "kind": "O",
            "joint": "pelvis",
            "prop": "position",
            "axis": "y",
            "restKey": "pelvis:y",
            "keys": [
              {
                "t": 0,
                "v": 0
              },
              {
                "t": 0.5,
                "v": 0.08
              },
              {
                "t": 1,
                "v": 0
              }
            ]
          },
          {
            "kind": "P",
            "joint": "l_upper_leg",
            "prop": "rotation",
            "axis": "x",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": -0.85
              },
              {
                "t": 0.25,
                "v": -0.2
              },
              {
                "t": 0.5,
                "v": 0.15
              },
              {
                "t": 0.75,
                "v": 0.35
              },
              {
                "t": 1,
                "v": -0.85
              }
            ]
          },
          {
            "kind": "P",
            "joint": "r_upper_leg",
            "prop": "rotation",
            "axis": "x",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": 0.15
              },
              {
                "t": 0.25,
                "v": 0.35
              },
              {
                "t": 0.5,
                "v": -0.85
              },
              {
                "t": 0.75,
                "v": -0.2
              },
              {
                "t": 1,
                "v": 0.15
              }
            ]
          },
          {
            "kind": "P",
            "joint": "l_lower_leg",
            "prop": "rotation",
            "axis": "x",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": -0.3
              },
              {
                "t": 0.25,
                "v": 0.05
              },
              {
                "t": 0.5,
                "v": 0.75
              },
              {
                "t": 0.75,
                "v": 1.85
              },
              {
                "t": 1,
                "v": -0.3
              }
            ]
          },
          {
            "kind": "P",
            "joint": "r_lower_leg",
            "prop": "rotation",
            "axis": "x",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": 0.75
              },
              {
                "t": 0.25,
                "v": 1.85
              },
              {
                "t": 0.5,
                "v": -0.3
              },
              {
                "t": 0.75,
                "v": 0.05
              },
              {
                "t": 1,
                "v": 0.75
              }
            ]
          },
          {
            "kind": "P",
            "joint": "l_upper_arm",
            "prop": "rotation",
            "axis": "x",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": 0.5
              },
              {
                "t": 0.25,
                "v": 0.15
              },
              {
                "t": 0.5,
                "v": -0.5
              },
              {
                "t": 0.75,
                "v": 0.15
              },
              {
                "t": 1,
                "v": 0.5
              }
            ]
          },
          {
            "kind": "P",
            "joint": "r_upper_arm",
            "prop": "rotation",
            "axis": "x",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": -0.5
              },
              {
                "t": 0.25,
                "v": -0.15
              },
              {
                "t": 0.5,
                "v": 0.5
              },
              {
                "t": 0.75,
                "v": -0.15
              },
              {
                "t": 1,
                "v": -0.5
              }
            ]
          }
        ],
        "Attack": [
          {
            "kind": "O",
            "joint": "torso",
            "prop": "rotation",
            "axis": "x",
            "restKey": "torso:x",
            "keys": [
              {
                "t": 0,
                "v": 0
              },
              {
                "t": 0.45,
                "v": -0.12
              },
              {
                "t": 0.55,
                "v": 0.3
              },
              {
                "t": 0.78,
                "v": 0.08
              },
              {
                "t": 1,
                "v": 0
              }
            ]
          },
          {
            "kind": "P",
            "joint": "torso_upper",
            "prop": "rotation",
            "axis": "x",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": 0
              },
              {
                "t": 0.45,
                "v": 0.02
              },
              {
                "t": 0.55,
                "v": 0.42
              },
              {
                "t": 0.78,
                "v": 0.12
              },
              {
                "t": 1,
                "v": 0
              }
            ]
          },
          {
            "kind": "P",
            "joint": "l_upper_arm",
            "prop": "rotation",
            "axis": "x",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": -0.1
              },
              {
                "t": 0.45,
                "v": -1.8
              },
              {
                "t": 0.55,
                "v": -0.4
              },
              {
                "t": 1,
                "v": -0.1
              }
            ]
          },
          {
            "kind": "P",
            "joint": "r_upper_arm",
            "prop": "rotation",
            "axis": "x",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": -0.1
              },
              {
                "t": 0.45,
                "v": -1.8
              },
              {
                "t": 0.55,
                "v": -0.4
              },
              {
                "t": 1,
                "v": -0.1
              }
            ]
          },
          {
            "kind": "P",
            "joint": "l_forearm",
            "prop": "rotation",
            "axis": "x",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": -1.6
              },
              {
                "t": 0.45,
                "v": -0.2
              },
              {
                "t": 0.55,
                "v": -0.5
              },
              {
                "t": 1,
                "v": -1.6
              }
            ]
          },
          {
            "kind": "P",
            "joint": "r_forearm",
            "prop": "rotation",
            "axis": "x",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": -1.6
              },
              {
                "t": 0.45,
                "v": -0.2
              },
              {
                "t": 0.55,
                "v": -0.5
              },
              {
                "t": 1,
                "v": -1.6
              }
            ]
          }
        ],
        "Stagger": [
          {
            "kind": "O",
            "joint": "torso",
            "prop": "rotation",
            "axis": "x",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": 0
              },
              {
                "t": 0.2,
                "v": -0.3
              },
              {
                "t": 1,
                "v": 0
              }
            ]
          },
          {
            "kind": "P",
            "joint": "head",
            "prop": "rotation",
            "axis": "x",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": 0
              },
              {
                "t": 0.15,
                "v": -0.4
              },
              {
                "t": 1,
                "v": 0
              }
            ]
          }
        ],
        "Die": [
          {
            "kind": "P",
            "joint": "root",
            "prop": "rotation",
            "axis": "x",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": 0
              },
              {
                "t": 0.3,
                "v": 0.3
              },
              {
                "t": 0.55,
                "v": 1.15
              },
              {
                "t": 0.78,
                "v": 1.6
              },
              {
                "t": 0.9,
                "v": 1.55
              },
              {
                "t": 1,
                "v": 1.5707963267948966
              }
            ]
          },
          {
            "kind": "O",
            "joint": "root",
            "prop": "position",
            "axis": "y",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": 0.75
              },
              {
                "t": 0.55,
                "v": 0.7
              },
              {
                "t": 0.78,
                "v": 0.55
              },
              {
                "t": 1,
                "v": 0.475
              }
            ]
          },
          {
            "kind": "O",
            "joint": "torso",
            "prop": "rotation",
            "axis": "x",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": 0.2
              },
              {
                "t": 0.35,
                "v": 0.4
              },
              {
                "t": 0.7,
                "v": 0.05
              },
              {
                "t": 1,
                "v": 0
              }
            ]
          },
          {
            "kind": "P",
            "joint": "neck",
            "prop": "rotation",
            "axis": "x",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": 0.22
              },
              {
                "t": 0.4,
                "v": 0.35
              },
              {
                "t": 1,
                "v": 0.05
              }
            ]
          },
          {
            "kind": "P",
            "joint": "head",
            "prop": "rotation",
            "axis": "z",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": 0.08
              },
              {
                "t": 0.5,
                "v": 0.1
              },
              {
                "t": 1,
                "v": 0.7
              }
            ]
          },
          {
            "kind": "P",
            "joint": "l_upper_arm",
            "prop": "rotation",
            "axis": "z",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": 0.09
              },
              {
                "t": 0.4,
                "v": 0.15
              },
              {
                "t": 0.75,
                "v": 1.1
              },
              {
                "t": 1,
                "v": 0.95
              }
            ]
          },
          {
            "kind": "P",
            "joint": "r_upper_arm",
            "prop": "rotation",
            "axis": "z",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": -0.09
              },
              {
                "t": 0.4,
                "v": -0.15
              },
              {
                "t": 0.75,
                "v": -0.75
              },
              {
                "t": 1,
                "v": -0.6
              }
            ]
          },
          {
            "kind": "P",
            "joint": "l_forearm",
            "prop": "rotation",
            "axis": "x",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": 0
              },
              {
                "t": 0.5,
                "v": -0.25
              },
              {
                "t": 1,
                "v": -0.4
              }
            ]
          },
          {
            "kind": "P",
            "joint": "r_forearm",
            "prop": "rotation",
            "axis": "x",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": 0
              },
              {
                "t": 0.5,
                "v": -0.35
              },
              {
                "t": 1,
                "v": -0.55
              }
            ]
          },
          {
            "kind": "P",
            "joint": "l_upper_leg",
            "prop": "rotation",
            "axis": "x",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": 0
              },
              {
                "t": 0.25,
                "v": -0.15
              },
              {
                "t": 0.7,
                "v": 0.05
              },
              {
                "t": 1,
                "v": -0.06
              }
            ]
          },
          {
            "kind": "P",
            "joint": "r_upper_leg",
            "prop": "rotation",
            "axis": "x",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": 0
              },
              {
                "t": 0.25,
                "v": -0.15
              },
              {
                "t": 0.7,
                "v": 0.08
              },
              {
                "t": 1,
                "v": -0.1
              }
            ]
          },
          {
            "kind": "P",
            "joint": "l_upper_leg",
            "prop": "rotation",
            "axis": "z",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": 0
              },
              {
                "t": 0.6,
                "v": 0.05
              },
              {
                "t": 1,
                "v": 0.1
              }
            ]
          },
          {
            "kind": "P",
            "joint": "r_upper_leg",
            "prop": "rotation",
            "axis": "z",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": 0
              },
              {
                "t": 0.6,
                "v": -0.08
              },
              {
                "t": 1,
                "v": -0.16
              }
            ]
          },
          {
            "kind": "P",
            "joint": "l_lower_leg",
            "prop": "rotation",
            "axis": "x",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": 0
              },
              {
                "t": 0.25,
                "v": 0.35
              },
              {
                "t": 0.8,
                "v": 0.06
              },
              {
                "t": 1,
                "v": 0.04
              }
            ]
          },
          {
            "kind": "P",
            "joint": "r_lower_leg",
            "prop": "rotation",
            "axis": "x",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": 0
              },
              {
                "t": 0.25,
                "v": 0.35
              },
              {
                "t": 0.8,
                "v": 0.22
              },
              {
                "t": 1,
                "v": 0.15
              }
            ]
          }
        ]
      }
    }
  },
  "v1-成年男-20260810": {
    "date": "2026-08-10",
    "note": "成年男(肩宽1.15)",
    "tree": {
      "name": "root",
      "type": "Group",
      "position": [
        0.08,
        0.1859,
        0
      ],
      "rotation": [
        0,
        0,
        0
      ],
      "children": [
        {
          "name": "pelvis",
          "type": "TaperedBox",
          "size": [
            0.3,
            0.135,
            0.1468801484276677,
            0.3,
            0.22,
            0,
            -0.001745367603108186,
            0,
            0
          ],
          "position": [
            0,
            0.5,
            0
          ],
          "materialId": "__cloth__",
          "children": [
            {
              "name": "torso",
              "type": "Group",
              "position": [
                0,
                0.0675,
                0.04
              ],
              "rotation": [
                0,
                0,
                0
              ],
              "materialId": "__cloth__",
              "children": [
                {
                  "name": "torso_upper",
                  "type": "RidgeBox",
                  "size": [
                    0.22,
                    0.29,
                    0.2,
                    0.3,
                    0.16,
                    0,
                    -0.026756043567614046,
                    0.2,
                    0.031587802178380704
                  ],
                  "position": [
                    0,
                    0.299,
                    -0.035
                  ],
                  "materialId": "__skin__",
                  "rotation": [
                    0,
                    0,
                    0
                  ],
                  "visible": true,
                  "pivot": [
                    0,
                    -0.145,
                    0
                  ],
                  "children": [
                    {
                      "name": "neck",
                      "type": "Cylinder",
                      "size": [
                        0.05,
                        0.061,
                        0.05
                      ],
                      "position": [
                        0,
                        0.1755,
                        -0.015
                      ],
                      "rotation": [
                        0,
                        0,
                        0
                      ],
                      "pivot": [
                        0,
                        -0.0305,
                        0
                      ],
                      "materialId": "__skin__",
                      "children": [
                        {
                          "name": "head",
                          "type": "Sphere",
                          "size": [
                            0.08929999999999999
                          ],
                          "position": [
                            0,
                            0.0874,
                            0.0032
                          ],
                          "rotation": [
                            0,
                            0,
                            0
                          ],
                          "pivot": [
                            0,
                            -0.08929999999999999,
                            0
                          ],
                          "materialId": "__skin__",
                          "segments": [
                            6,
                            5
                          ],
                          "children": [
                            {
                              "name": "l_eye_glow",
                              "type": "Sphere",
                              "size": [
                                0.019
                              ],
                              "position": [
                                0.0285,
                                0.019,
                                0.0665
                              ],
                              "materialId": "eye_glow",
                              "segments": [
                                5,
                                4
                              ],
                              "rotation": [
                                0,
                                0,
                                0
                              ],
                              "visible": true
                            },
                            {
                              "name": "r_eye_glow",
                              "type": "Sphere",
                              "size": [
                                0.019
                              ],
                              "position": [
                                -0.0285,
                                0.019,
                                0.0665
                              ],
                              "materialId": "eye_glow",
                              "segments": [
                                5,
                                4
                              ],
                              "rotation": [
                                0,
                                0,
                                0
                              ],
                              "visible": true
                            }
                          ],
                          "visible": true
                        }
                      ],
                      "visible": true
                    },
                    {
                      "name": "l_upper_arm",
                      "type": "Cylinder",
                      "size": [
                        0.052,
                        0.275,
                        0.045
                      ],
                      "position": [
                        0.1966,
                        0.0075,
                        -0.005
                      ],
                      "rotation": [
                        0,
                        0,
                        0
                      ],
                      "pivot": [
                        0,
                        0.1375,
                        0
                      ],
                      "materialId": "__skin__",
                      "children": [
                        {
                          "name": "l_forearm",
                          "type": "Cylinder",
                          "size": [
                            0.045,
                            0.255,
                            0.04
                          ],
                          "position": [
                            0,
                            -0.2567,
                            0
                          ],
                          "pivot": [
                            0,
                            0.1275,
                            0
                          ],
                          "materialId": "__skin__",
                          "children": [
                            {
                              "name": "l_hand",
                              "type": "Box",
                              "size": [
                                0.052,
                                0.104,
                                0.045
                              ],
                              "position": [
                                0,
                                -0.18,
                                0
                              ],
                              "pivot": [
                                0,
                                0.052,
                                0
                              ],
                              "materialId": "__skin__",
                              "rotation": [
                                0,
                                0,
                                0
                              ],
                              "visible": true
                            }
                          ],
                          "rotation": [
                            0,
                            0,
                            0
                          ],
                          "visible": true
                        }
                      ],
                      "visible": true
                    },
                    {
                      "name": "r_upper_arm",
                      "type": "Cylinder",
                      "size": [
                        0.052,
                        0.275,
                        0.045
                      ],
                      "position": [
                        -0.1966,
                        0.0075,
                        -0.005
                      ],
                      "rotation": [
                        0,
                        0,
                        0
                      ],
                      "pivot": [
                        0,
                        0.1375,
                        0
                      ],
                      "materialId": "__skin__",
                      "children": [
                        {
                          "name": "r_forearm",
                          "type": "Cylinder",
                          "size": [
                            0.045,
                            0.255,
                            0.04
                          ],
                          "position": [
                            0,
                            -0.2567,
                            0
                          ],
                          "pivot": [
                            0,
                            0.1275,
                            0
                          ],
                          "materialId": "__skin__",
                          "children": [
                            {
                              "name": "r_hand",
                              "type": "Box",
                              "size": [
                                0.052,
                                0.104,
                                0.045
                              ],
                              "position": [
                                0,
                                -0.18,
                                0
                              ],
                              "pivot": [
                                0,
                                0.052,
                                0
                              ],
                              "materialId": "__skin__",
                              "rotation": [
                                0,
                                0,
                                0
                              ],
                              "visible": true
                            }
                          ],
                          "rotation": [
                            0,
                            0,
                            0
                          ],
                          "visible": true
                        }
                      ],
                      "visible": true
                    }
                  ]
                },
                {
                  "name": "torso_lower",
                  "type": "TaperedBox",
                  "size": [
                    0.3,
                    0.154,
                    0.22,
                    0.22,
                    0.2,
                    0,
                    -0.033649561446189864,
                    0,
                    -0.04
                  ],
                  "position": [
                    0,
                    0.077,
                    -0.04
                  ],
                  "materialId": "__skin__",
                  "rotation": [
                    0,
                    0,
                    0
                  ],
                  "visible": true
                }
              ],
              "visible": true
            },
            {
              "name": "l_upper_leg",
              "type": "Cylinder",
              "size": [
                0.061,
                0.34650000000000003,
                0.061
              ],
              "position": [
                0.075,
                -0.175,
                0
              ],
              "pivot": [
                0,
                0.17325000000000002,
                0
              ],
              "materialId": "__skin__",
              "children": [
                {
                  "name": "l_lower_leg",
                  "type": "Cylinder",
                  "size": [
                    0.052,
                    0.34650000000000003,
                    0.052
                  ],
                  "position": [
                    0,
                    -0.3234,
                    0
                  ],
                  "pivot": [
                    0,
                    0.17325000000000002,
                    0
                  ],
                  "materialId": "__skin__",
                  "children": [
                    {
                      "name": "l_foot",
                      "type": "Box",
                      "size": [
                        0.112,
                        0.045,
                        0.225
                      ],
                      "position": [
                        0,
                        -0.165,
                        0.06
                      ],
                      "pivot": [
                        0,
                        0.05,
                        -0.1
                      ],
                      "materialId": "__skin__",
                      "rotation": [
                        0,
                        0,
                        0
                      ],
                      "visible": true
                    }
                  ],
                  "rotation": [
                    0,
                    0,
                    0
                  ],
                  "visible": true
                }
              ],
              "rotation": [
                0,
                0,
                0
              ],
              "visible": true
            },
            {
              "name": "r_upper_leg",
              "type": "Cylinder",
              "size": [
                0.061,
                0.34650000000000003,
                0.061
              ],
              "position": [
                -0.075,
                -0.175,
                0
              ],
              "pivot": [
                0,
                0.17325000000000002,
                0
              ],
              "materialId": "__skin__",
              "children": [
                {
                  "name": "r_lower_leg",
                  "type": "Cylinder",
                  "size": [
                    0.052,
                    0.34650000000000003,
                    0.052
                  ],
                  "position": [
                    0,
                    -0.3234,
                    0
                  ],
                  "pivot": [
                    0,
                    0.17325000000000002,
                    0
                  ],
                  "materialId": "__skin__",
                  "children": [
                    {
                      "name": "r_foot",
                      "type": "Box",
                      "size": [
                        0.112,
                        0.045,
                        0.225
                      ],
                      "position": [
                        0,
                        -0.165,
                        0.06
                      ],
                      "pivot": [
                        0,
                        0.05,
                        -0.1
                      ],
                      "materialId": "__skin__",
                      "rotation": [
                        0,
                        0,
                        0
                      ],
                      "visible": true
                    }
                  ],
                  "rotation": [
                    0,
                    0,
                    0
                  ],
                  "visible": true
                }
              ],
              "rotation": [
                0,
                0,
                0
              ],
              "visible": true
            }
          ],
          "rotation": [
            0,
            0,
            0
          ],
          "visible": true
        }
      ],
      "visible": true
    },
    "anims": {
      "restPoses": {
        "torso:x": 0.2,
        "neck:x": 0.22,
        "head:z": 0.08,
        "l_upper_arm:z": 0.09,
        "r_upper_arm:z": -0.09,
        "pelvis:y": 0.5
      },
      "actions": {
        "Idle": [
          {
            "kind": "O",
            "joint": "torso",
            "prop": "rotation",
            "axis": "z",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": 0
              },
              {
                "t": 0.5,
                "v": 0.03
              },
              {
                "t": 1,
                "v": 0
              }
            ]
          },
          {
            "kind": "O",
            "joint": "pelvis",
            "prop": "position",
            "axis": "y",
            "restKey": "pelvis:y",
            "keys": [
              {
                "t": 0,
                "v": 0
              },
              {
                "t": 0.5,
                "v": 0.02
              },
              {
                "t": 1,
                "v": 0
              }
            ]
          },
          {
            "kind": "P",
            "joint": "head",
            "prop": "rotation",
            "axis": "z",
            "restKey": "head:z",
            "keys": [
              {
                "t": 0,
                "v": 0
              },
              {
                "t": 0.5,
                "v": -0.04
              },
              {
                "t": 1,
                "v": 0
              }
            ]
          }
        ],
        "Walk": [
          {
            "kind": "O",
            "joint": "pelvis",
            "prop": "position",
            "axis": "y",
            "restKey": "pelvis:y",
            "keys": [
              {
                "t": 0,
                "v": 0
              },
              {
                "t": 0.5,
                "v": 0.04
              },
              {
                "t": 1,
                "v": 0
              }
            ]
          },
          {
            "kind": "P",
            "joint": "l_upper_leg",
            "prop": "rotation",
            "axis": "x",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": -0.45
              },
              {
                "t": 0.25,
                "v": -0.08
              },
              {
                "t": 0.5,
                "v": 0.12
              },
              {
                "t": 0.75,
                "v": 0.25
              },
              {
                "t": 1,
                "v": -0.45
              }
            ]
          },
          {
            "kind": "P",
            "joint": "r_upper_leg",
            "prop": "rotation",
            "axis": "x",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": 0.25
              },
              {
                "t": 0.25,
                "v": -0.45
              },
              {
                "t": 0.5,
                "v": -0.08
              },
              {
                "t": 0.75,
                "v": 0.12
              },
              {
                "t": 1,
                "v": 0.25
              }
            ]
          },
          {
            "kind": "P",
            "joint": "l_lower_leg",
            "prop": "rotation",
            "axis": "x",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": -0.3
              },
              {
                "t": 0.25,
                "v": 0.12
              },
              {
                "t": 0.5,
                "v": 0.37
              },
              {
                "t": 0.75,
                "v": 1.35
              },
              {
                "t": 1,
                "v": -0.3
              }
            ]
          },
          {
            "kind": "P",
            "joint": "r_lower_leg",
            "prop": "rotation",
            "axis": "x",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": 0.37
              },
              {
                "t": 0.25,
                "v": 1.35
              },
              {
                "t": 0.5,
                "v": -0.3
              },
              {
                "t": 0.75,
                "v": 0.12
              },
              {
                "t": 1,
                "v": 0.37
              }
            ]
          },
          {
            "kind": "P",
            "joint": "l_upper_arm",
            "prop": "rotation",
            "axis": "x",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": 0.35
              },
              {
                "t": 0.25,
                "v": 0.1
              },
              {
                "t": 0.5,
                "v": -0.35
              },
              {
                "t": 0.75,
                "v": 0.1
              },
              {
                "t": 1,
                "v": 0.35
              }
            ]
          },
          {
            "kind": "P",
            "joint": "r_upper_arm",
            "prop": "rotation",
            "axis": "x",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": -0.35
              },
              {
                "t": 0.25,
                "v": -0.1
              },
              {
                "t": 0.5,
                "v": 0.35
              },
              {
                "t": 0.75,
                "v": -0.1
              },
              {
                "t": 1,
                "v": -0.35
              }
            ]
          }
        ],
        "Run": [
          {
            "kind": "O",
            "joint": "torso",
            "prop": "rotation",
            "axis": "x",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": 0.3
              },
              {
                "t": 0.5,
                "v": 0.15
              },
              {
                "t": 1,
                "v": 0.3
              }
            ]
          },
          {
            "kind": "O",
            "joint": "pelvis",
            "prop": "position",
            "axis": "y",
            "restKey": "pelvis:y",
            "keys": [
              {
                "t": 0,
                "v": 0
              },
              {
                "t": 0.5,
                "v": 0.08
              },
              {
                "t": 1,
                "v": 0
              }
            ]
          },
          {
            "kind": "P",
            "joint": "l_upper_leg",
            "prop": "rotation",
            "axis": "x",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": -0.85
              },
              {
                "t": 0.25,
                "v": -0.2
              },
              {
                "t": 0.5,
                "v": 0.15
              },
              {
                "t": 0.75,
                "v": 0.35
              },
              {
                "t": 1,
                "v": -0.85
              }
            ]
          },
          {
            "kind": "P",
            "joint": "r_upper_leg",
            "prop": "rotation",
            "axis": "x",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": 0.15
              },
              {
                "t": 0.25,
                "v": 0.35
              },
              {
                "t": 0.5,
                "v": -0.85
              },
              {
                "t": 0.75,
                "v": -0.2
              },
              {
                "t": 1,
                "v": 0.15
              }
            ]
          },
          {
            "kind": "P",
            "joint": "l_lower_leg",
            "prop": "rotation",
            "axis": "x",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": -0.3
              },
              {
                "t": 0.25,
                "v": 0.05
              },
              {
                "t": 0.5,
                "v": 0.75
              },
              {
                "t": 0.75,
                "v": 1.85
              },
              {
                "t": 1,
                "v": -0.3
              }
            ]
          },
          {
            "kind": "P",
            "joint": "r_lower_leg",
            "prop": "rotation",
            "axis": "x",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": 0.75
              },
              {
                "t": 0.25,
                "v": 1.85
              },
              {
                "t": 0.5,
                "v": -0.3
              },
              {
                "t": 0.75,
                "v": 0.05
              },
              {
                "t": 1,
                "v": 0.75
              }
            ]
          },
          {
            "kind": "P",
            "joint": "l_upper_arm",
            "prop": "rotation",
            "axis": "x",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": 0.5
              },
              {
                "t": 0.25,
                "v": 0.15
              },
              {
                "t": 0.5,
                "v": -0.5
              },
              {
                "t": 0.75,
                "v": 0.15
              },
              {
                "t": 1,
                "v": 0.5
              }
            ]
          },
          {
            "kind": "P",
            "joint": "r_upper_arm",
            "prop": "rotation",
            "axis": "x",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": -0.5
              },
              {
                "t": 0.25,
                "v": -0.15
              },
              {
                "t": 0.5,
                "v": 0.5
              },
              {
                "t": 0.75,
                "v": -0.15
              },
              {
                "t": 1,
                "v": -0.5
              }
            ]
          }
        ],
        "Attack": [
          {
            "kind": "O",
            "joint": "torso",
            "prop": "rotation",
            "axis": "x",
            "restKey": "torso:x",
            "keys": [
              {
                "t": 0,
                "v": 0
              },
              {
                "t": 0.45,
                "v": -0.12
              },
              {
                "t": 0.55,
                "v": 0.3
              },
              {
                "t": 0.78,
                "v": 0.08
              },
              {
                "t": 1,
                "v": 0
              }
            ]
          },
          {
            "kind": "P",
            "joint": "torso_upper",
            "prop": "rotation",
            "axis": "x",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": 0
              },
              {
                "t": 0.45,
                "v": 0.02
              },
              {
                "t": 0.55,
                "v": 0.42
              },
              {
                "t": 0.78,
                "v": 0.12
              },
              {
                "t": 1,
                "v": 0
              }
            ]
          },
          {
            "kind": "P",
            "joint": "l_upper_arm",
            "prop": "rotation",
            "axis": "x",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": -0.1
              },
              {
                "t": 0.45,
                "v": -1.8
              },
              {
                "t": 0.55,
                "v": -0.4
              },
              {
                "t": 1,
                "v": -0.1
              }
            ]
          },
          {
            "kind": "P",
            "joint": "r_upper_arm",
            "prop": "rotation",
            "axis": "x",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": -0.1
              },
              {
                "t": 0.45,
                "v": -1.8
              },
              {
                "t": 0.55,
                "v": -0.4
              },
              {
                "t": 1,
                "v": -0.1
              }
            ]
          },
          {
            "kind": "P",
            "joint": "l_forearm",
            "prop": "rotation",
            "axis": "x",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": -1.6
              },
              {
                "t": 0.45,
                "v": -0.2
              },
              {
                "t": 0.55,
                "v": -0.5
              },
              {
                "t": 1,
                "v": -1.6
              }
            ]
          },
          {
            "kind": "P",
            "joint": "r_forearm",
            "prop": "rotation",
            "axis": "x",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": -1.6
              },
              {
                "t": 0.45,
                "v": -0.2
              },
              {
                "t": 0.55,
                "v": -0.5
              },
              {
                "t": 1,
                "v": -1.6
              }
            ]
          }
        ],
        "Stagger": [
          {
            "kind": "O",
            "joint": "torso",
            "prop": "rotation",
            "axis": "x",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": 0
              },
              {
                "t": 0.2,
                "v": -0.3
              },
              {
                "t": 1,
                "v": 0
              }
            ]
          },
          {
            "kind": "P",
            "joint": "head",
            "prop": "rotation",
            "axis": "x",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": 0
              },
              {
                "t": 0.15,
                "v": -0.4
              },
              {
                "t": 1,
                "v": 0
              }
            ]
          }
        ],
        "Die": [
          {
            "kind": "P",
            "joint": "root",
            "prop": "rotation",
            "axis": "x",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": 0
              },
              {
                "t": 0.3,
                "v": 0.3
              },
              {
                "t": 0.55,
                "v": 1.15
              },
              {
                "t": 0.78,
                "v": 1.6
              },
              {
                "t": 0.9,
                "v": 1.55
              },
              {
                "t": 1,
                "v": 1.5707963267948966
              }
            ]
          },
          {
            "kind": "O",
            "joint": "root",
            "prop": "position",
            "axis": "y",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": 0.75
              },
              {
                "t": 0.55,
                "v": 0.7
              },
              {
                "t": 0.78,
                "v": 0.55
              },
              {
                "t": 1,
                "v": 0.475
              }
            ]
          },
          {
            "kind": "O",
            "joint": "torso",
            "prop": "rotation",
            "axis": "x",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": 0.2
              },
              {
                "t": 0.35,
                "v": 0.4
              },
              {
                "t": 0.7,
                "v": 0.05
              },
              {
                "t": 1,
                "v": 0
              }
            ]
          },
          {
            "kind": "P",
            "joint": "neck",
            "prop": "rotation",
            "axis": "x",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": 0.22
              },
              {
                "t": 0.4,
                "v": 0.35
              },
              {
                "t": 1,
                "v": 0.05
              }
            ]
          },
          {
            "kind": "P",
            "joint": "head",
            "prop": "rotation",
            "axis": "z",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": 0.08
              },
              {
                "t": 0.5,
                "v": 0.1
              },
              {
                "t": 1,
                "v": 0.7
              }
            ]
          },
          {
            "kind": "P",
            "joint": "l_upper_arm",
            "prop": "rotation",
            "axis": "z",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": 0.09
              },
              {
                "t": 0.4,
                "v": 0.15
              },
              {
                "t": 0.75,
                "v": 1.1
              },
              {
                "t": 1,
                "v": 0.95
              }
            ]
          },
          {
            "kind": "P",
            "joint": "r_upper_arm",
            "prop": "rotation",
            "axis": "z",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": -0.09
              },
              {
                "t": 0.4,
                "v": -0.15
              },
              {
                "t": 0.75,
                "v": -0.75
              },
              {
                "t": 1,
                "v": -0.6
              }
            ]
          },
          {
            "kind": "P",
            "joint": "l_forearm",
            "prop": "rotation",
            "axis": "x",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": 0
              },
              {
                "t": 0.5,
                "v": -0.25
              },
              {
                "t": 1,
                "v": -0.4
              }
            ]
          },
          {
            "kind": "P",
            "joint": "r_forearm",
            "prop": "rotation",
            "axis": "x",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": 0
              },
              {
                "t": 0.5,
                "v": -0.35
              },
              {
                "t": 1,
                "v": -0.55
              }
            ]
          },
          {
            "kind": "P",
            "joint": "l_upper_leg",
            "prop": "rotation",
            "axis": "x",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": 0
              },
              {
                "t": 0.25,
                "v": -0.15
              },
              {
                "t": 0.7,
                "v": 0.05
              },
              {
                "t": 1,
                "v": -0.06
              }
            ]
          },
          {
            "kind": "P",
            "joint": "r_upper_leg",
            "prop": "rotation",
            "axis": "x",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": 0
              },
              {
                "t": 0.25,
                "v": -0.15
              },
              {
                "t": 0.7,
                "v": 0.08
              },
              {
                "t": 1,
                "v": -0.1
              }
            ]
          },
          {
            "kind": "P",
            "joint": "l_upper_leg",
            "prop": "rotation",
            "axis": "z",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": 0
              },
              {
                "t": 0.6,
                "v": 0.05
              },
              {
                "t": 1,
                "v": 0.1
              }
            ]
          },
          {
            "kind": "P",
            "joint": "r_upper_leg",
            "prop": "rotation",
            "axis": "z",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": 0
              },
              {
                "t": 0.6,
                "v": -0.08
              },
              {
                "t": 1,
                "v": -0.16
              }
            ]
          },
          {
            "kind": "P",
            "joint": "l_lower_leg",
            "prop": "rotation",
            "axis": "x",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": 0
              },
              {
                "t": 0.25,
                "v": 0.35
              },
              {
                "t": 0.8,
                "v": 0.06
              },
              {
                "t": 1,
                "v": 0.04
              }
            ]
          },
          {
            "kind": "P",
            "joint": "r_lower_leg",
            "prop": "rotation",
            "axis": "x",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": 0
              },
              {
                "t": 0.25,
                "v": 0.35
              },
              {
                "t": 0.8,
                "v": 0.22
              },
              {
                "t": 1,
                "v": 0.15
              }
            ]
          }
        ]
      }
    }
  },
  "v1-儿童-20260810": {
    "date": "2026-08-10",
    "note": "儿童(头大1.25/腿短0.85/窄肩0.9)",
    "tree": {
      "name": "root",
      "type": "Group",
      "position": [
        0.08,
        0.1127,
        0
      ],
      "rotation": [
        0,
        0,
        0
      ],
      "children": [
        {
          "name": "pelvis",
          "type": "TaperedBox",
          "size": [
            0.3,
            0.135,
            0.1468801484276677,
            0.3,
            0.2,
            0,
            0.005906025851763303,
            0,
            0
          ],
          "position": [
            0,
            0.4,
            0
          ],
          "materialId": "__cloth__",
          "children": [
            {
              "name": "torso",
              "type": "Group",
              "position": [
                0,
                0.0675,
                0.04
              ],
              "rotation": [
                0,
                0,
                0
              ],
              "materialId": "__cloth__",
              "children": [
                {
                  "name": "torso_upper",
                  "type": "RidgeBox",
                  "size": [
                    0.2,
                    0.29,
                    0.16,
                    0.3,
                    0.12,
                    0,
                    -0.03922263768951445,
                    0.2,
                    0.04
                  ],
                  "position": [
                    0,
                    0.299,
                    -0.02
                  ],
                  "materialId": "__skin__",
                  "rotation": [
                    0,
                    0,
                    0
                  ],
                  "visible": true,
                  "pivot": [
                    0,
                    -0.145,
                    0
                  ],
                  "children": [
                    {
                      "name": "neck",
                      "type": "Cylinder",
                      "size": [
                        0.04,
                        0.061,
                        0.04
                      ],
                      "position": [
                        0,
                        0.1755,
                        -0.03
                      ],
                      "rotation": [
                        0,
                        0,
                        0
                      ],
                      "pivot": [
                        0,
                        -0.0305,
                        0
                      ],
                      "materialId": "__skin__",
                      "children": [
                        {
                          "name": "head",
                          "type": "Sphere",
                          "size": [
                            0.11162499999999999
                          ],
                          "position": [
                            0,
                            0.0874,
                            0.0032
                          ],
                          "rotation": [
                            0,
                            0,
                            0
                          ],
                          "pivot": [
                            0,
                            -0.11162499999999999,
                            0
                          ],
                          "materialId": "__skin__",
                          "segments": [
                            6,
                            5
                          ],
                          "children": [
                            {
                              "name": "l_eye_glow",
                              "type": "Sphere",
                              "size": [
                                0.0238
                              ],
                              "position": [
                                0.0356,
                                0.0238,
                                0.0831
                              ],
                              "materialId": "eye_glow",
                              "segments": [
                                5,
                                4
                              ],
                              "rotation": [
                                0,
                                0,
                                0
                              ],
                              "visible": true
                            },
                            {
                              "name": "r_eye_glow",
                              "type": "Sphere",
                              "size": [
                                0.0238
                              ],
                              "position": [
                                -0.0356,
                                0.0238,
                                0.0831
                              ],
                              "materialId": "eye_glow",
                              "segments": [
                                5,
                                4
                              ],
                              "rotation": [
                                0,
                                0,
                                0
                              ],
                              "visible": true
                            }
                          ],
                          "visible": true
                        }
                      ],
                      "visible": true
                    },
                    {
                      "name": "l_upper_arm",
                      "type": "Cylinder",
                      "size": [
                        0.05,
                        0.24750000000000003,
                        0.03
                      ],
                      "position": [
                        0.17,
                        0.0075,
                        -0.02
                      ],
                      "rotation": [
                        0,
                        0,
                        0.0524
                      ],
                      "pivot": [
                        0,
                        0.12375000000000001,
                        0
                      ],
                      "materialId": "__skin__",
                      "children": [
                        {
                          "name": "l_forearm",
                          "type": "Cylinder",
                          "size": [
                            0.03,
                            0.2295,
                            0.035
                          ],
                          "position": [
                            0,
                            -0.231,
                            0
                          ],
                          "pivot": [
                            0,
                            0.11475,
                            0
                          ],
                          "materialId": "__skin__",
                          "children": [
                            {
                              "name": "l_hand",
                              "type": "Box",
                              "size": [
                                0.052,
                                0.104,
                                0.045
                              ],
                              "position": [
                                0,
                                -0.162,
                                0
                              ],
                              "pivot": [
                                0,
                                0.052,
                                0
                              ],
                              "materialId": "__skin__",
                              "rotation": [
                                0,
                                0,
                                0
                              ],
                              "visible": true
                            }
                          ],
                          "rotation": [
                            0,
                            0,
                            0
                          ],
                          "visible": true
                        }
                      ],
                      "visible": true
                    },
                    {
                      "name": "r_upper_arm",
                      "type": "Cylinder",
                      "size": [
                        0.05,
                        0.24750000000000003,
                        0.03
                      ],
                      "position": [
                        -0.165,
                        0.0075,
                        -0.02
                      ],
                      "rotation": [
                        0,
                        0,
                        -0.0524
                      ],
                      "pivot": [
                        0,
                        0.12375000000000001,
                        0
                      ],
                      "materialId": "__skin__",
                      "children": [
                        {
                          "name": "r_forearm",
                          "type": "Cylinder",
                          "size": [
                            0.03,
                            0.2295,
                            0.035
                          ],
                          "position": [
                            0,
                            -0.231,
                            0
                          ],
                          "pivot": [
                            0,
                            0.11475,
                            0
                          ],
                          "materialId": "__skin__",
                          "children": [
                            {
                              "name": "r_hand",
                              "type": "Box",
                              "size": [
                                0.052,
                                0.104,
                                0.045
                              ],
                              "position": [
                                0,
                                -0.162,
                                0
                              ],
                              "pivot": [
                                0,
                                0.052,
                                0
                              ],
                              "materialId": "__skin__",
                              "rotation": [
                                0,
                                0,
                                0
                              ],
                              "visible": true
                            }
                          ],
                          "rotation": [
                            0,
                            0,
                            0
                          ],
                          "visible": true
                        }
                      ],
                      "visible": true
                    }
                  ]
                },
                {
                  "name": "torso_lower",
                  "type": "TaperedBox",
                  "size": [
                    0.3,
                    0.154,
                    0.2,
                    0.2,
                    0.16,
                    0,
                    -0.008412711261427747,
                    0,
                    -0.04
                  ],
                  "position": [
                    0,
                    0.077,
                    -0.035
                  ],
                  "materialId": "__skin__",
                  "rotation": [
                    0,
                    0,
                    0
                  ],
                  "visible": true
                }
              ],
              "visible": true
            },
            {
              "name": "l_upper_leg",
              "type": "Cylinder",
              "size": [
                0.061,
                0.29452500000000004,
                0.05
              ],
              "position": [
                0.075,
                -0.075,
                0
              ],
              "pivot": [
                0,
                0.14726250000000002,
                0
              ],
              "materialId": "__skin__",
              "children": [
                {
                  "name": "l_lower_leg",
                  "type": "Cylinder",
                  "size": [
                    0.052,
                    0.29452500000000004,
                    0.052
                  ],
                  "position": [
                    0,
                    -0.2749,
                    0
                  ],
                  "pivot": [
                    0,
                    0.14726250000000002,
                    0
                  ],
                  "materialId": "__skin__",
                  "children": [
                    {
                      "name": "l_foot",
                      "type": "Box",
                      "size": [
                        0.112,
                        0.045,
                        0.225
                      ],
                      "position": [
                        0,
                        -0.1403,
                        0.06
                      ],
                      "pivot": [
                        0,
                        0.05,
                        -0.1
                      ],
                      "materialId": "__skin__",
                      "rotation": [
                        0,
                        0,
                        0
                      ],
                      "visible": true
                    }
                  ],
                  "rotation": [
                    0,
                    0,
                    0
                  ],
                  "visible": true
                }
              ],
              "rotation": [
                0,
                0,
                0
              ],
              "visible": true
            },
            {
              "name": "r_upper_leg",
              "type": "Cylinder",
              "size": [
                0.061,
                0.29452500000000004,
                0.05
              ],
              "position": [
                -0.075,
                -0.075,
                0
              ],
              "pivot": [
                0,
                0.14726250000000002,
                0
              ],
              "materialId": "__skin__",
              "children": [
                {
                  "name": "r_lower_leg",
                  "type": "Cylinder",
                  "size": [
                    0.052,
                    0.29452500000000004,
                    0.052
                  ],
                  "position": [
                    0,
                    -0.2749,
                    0
                  ],
                  "pivot": [
                    0,
                    0.14726250000000002,
                    0
                  ],
                  "materialId": "__skin__",
                  "children": [
                    {
                      "name": "r_foot",
                      "type": "Box",
                      "size": [
                        0.112,
                        0.045,
                        0.225
                      ],
                      "position": [
                        0,
                        -0.1403,
                        0.06
                      ],
                      "pivot": [
                        0,
                        0.05,
                        -0.1
                      ],
                      "materialId": "__skin__",
                      "rotation": [
                        0,
                        0,
                        0
                      ],
                      "visible": true
                    }
                  ],
                  "rotation": [
                    0,
                    0,
                    0
                  ],
                  "visible": true
                }
              ],
              "rotation": [
                0,
                0,
                0
              ],
              "visible": true
            }
          ],
          "rotation": [
            0,
            0,
            0
          ],
          "visible": true
        }
      ],
      "visible": true
    },
    "anims": {
      "restPoses": {
        "torso:x": 0.2,
        "neck:x": 0.22,
        "head:z": 0.08,
        "l_upper_arm:z": 0.09,
        "r_upper_arm:z": -0.09,
        "pelvis:y": 0.4
      },
      "actions": {
        "Idle": [
          {
            "kind": "O",
            "joint": "torso",
            "prop": "rotation",
            "axis": "z",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": 0
              },
              {
                "t": 0.5,
                "v": 0.03
              },
              {
                "t": 1,
                "v": 0
              }
            ]
          },
          {
            "kind": "O",
            "joint": "pelvis",
            "prop": "position",
            "axis": "y",
            "restKey": "pelvis:y",
            "keys": [
              {
                "t": 0,
                "v": 0
              },
              {
                "t": 0.5,
                "v": 0.02
              },
              {
                "t": 1,
                "v": 0
              }
            ]
          },
          {
            "kind": "P",
            "joint": "head",
            "prop": "rotation",
            "axis": "z",
            "restKey": "head:z",
            "keys": [
              {
                "t": 0,
                "v": 0
              },
              {
                "t": 0.5,
                "v": -0.04
              },
              {
                "t": 1,
                "v": 0
              }
            ]
          }
        ],
        "Walk": [
          {
            "kind": "O",
            "joint": "pelvis",
            "prop": "position",
            "axis": "y",
            "restKey": "pelvis:y",
            "keys": [
              {
                "t": 0,
                "v": 0
              },
              {
                "t": 0.5,
                "v": 0.04
              },
              {
                "t": 1,
                "v": 0
              }
            ]
          },
          {
            "kind": "P",
            "joint": "l_upper_leg",
            "prop": "rotation",
            "axis": "x",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": -0.45
              },
              {
                "t": 0.25,
                "v": -0.08
              },
              {
                "t": 0.5,
                "v": 0.12
              },
              {
                "t": 0.75,
                "v": 0.25
              },
              {
                "t": 1,
                "v": -0.45
              }
            ]
          },
          {
            "kind": "P",
            "joint": "r_upper_leg",
            "prop": "rotation",
            "axis": "x",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": 0.25
              },
              {
                "t": 0.25,
                "v": -0.45
              },
              {
                "t": 0.5,
                "v": -0.08
              },
              {
                "t": 0.75,
                "v": 0.12
              },
              {
                "t": 1,
                "v": 0.25
              }
            ]
          },
          {
            "kind": "P",
            "joint": "l_lower_leg",
            "prop": "rotation",
            "axis": "x",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": -0.3
              },
              {
                "t": 0.25,
                "v": 0.12
              },
              {
                "t": 0.5,
                "v": 0.37
              },
              {
                "t": 0.75,
                "v": 1.35
              },
              {
                "t": 1,
                "v": -0.3
              }
            ]
          },
          {
            "kind": "P",
            "joint": "r_lower_leg",
            "prop": "rotation",
            "axis": "x",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": 0.37
              },
              {
                "t": 0.25,
                "v": 1.35
              },
              {
                "t": 0.5,
                "v": -0.3
              },
              {
                "t": 0.75,
                "v": 0.12
              },
              {
                "t": 1,
                "v": 0.37
              }
            ]
          },
          {
            "kind": "P",
            "joint": "l_upper_arm",
            "prop": "rotation",
            "axis": "x",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": 0.35
              },
              {
                "t": 0.25,
                "v": 0.1
              },
              {
                "t": 0.5,
                "v": -0.35
              },
              {
                "t": 0.75,
                "v": 0.1
              },
              {
                "t": 1,
                "v": 0.35
              }
            ]
          },
          {
            "kind": "P",
            "joint": "r_upper_arm",
            "prop": "rotation",
            "axis": "x",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": -0.35
              },
              {
                "t": 0.25,
                "v": -0.1
              },
              {
                "t": 0.5,
                "v": 0.35
              },
              {
                "t": 0.75,
                "v": -0.1
              },
              {
                "t": 1,
                "v": -0.35
              }
            ]
          }
        ],
        "Run": [
          {
            "kind": "O",
            "joint": "torso",
            "prop": "rotation",
            "axis": "x",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": 0.3
              },
              {
                "t": 0.5,
                "v": 0.15
              },
              {
                "t": 1,
                "v": 0.3
              }
            ]
          },
          {
            "kind": "O",
            "joint": "pelvis",
            "prop": "position",
            "axis": "y",
            "restKey": "pelvis:y",
            "keys": [
              {
                "t": 0,
                "v": 0
              },
              {
                "t": 0.5,
                "v": 0.08
              },
              {
                "t": 1,
                "v": 0
              }
            ]
          },
          {
            "kind": "P",
            "joint": "l_upper_leg",
            "prop": "rotation",
            "axis": "x",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": -0.85
              },
              {
                "t": 0.25,
                "v": -0.2
              },
              {
                "t": 0.5,
                "v": 0.15
              },
              {
                "t": 0.75,
                "v": 0.35
              },
              {
                "t": 1,
                "v": -0.85
              }
            ]
          },
          {
            "kind": "P",
            "joint": "r_upper_leg",
            "prop": "rotation",
            "axis": "x",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": 0.15
              },
              {
                "t": 0.25,
                "v": 0.35
              },
              {
                "t": 0.5,
                "v": -0.85
              },
              {
                "t": 0.75,
                "v": -0.2
              },
              {
                "t": 1,
                "v": 0.15
              }
            ]
          },
          {
            "kind": "P",
            "joint": "l_lower_leg",
            "prop": "rotation",
            "axis": "x",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": -0.3
              },
              {
                "t": 0.25,
                "v": 0.05
              },
              {
                "t": 0.5,
                "v": 0.75
              },
              {
                "t": 0.75,
                "v": 1.85
              },
              {
                "t": 1,
                "v": -0.3
              }
            ]
          },
          {
            "kind": "P",
            "joint": "r_lower_leg",
            "prop": "rotation",
            "axis": "x",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": 0.75
              },
              {
                "t": 0.25,
                "v": 1.85
              },
              {
                "t": 0.5,
                "v": -0.3
              },
              {
                "t": 0.75,
                "v": 0.05
              },
              {
                "t": 1,
                "v": 0.75
              }
            ]
          },
          {
            "kind": "P",
            "joint": "l_upper_arm",
            "prop": "rotation",
            "axis": "x",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": 0.5
              },
              {
                "t": 0.25,
                "v": 0.15
              },
              {
                "t": 0.5,
                "v": -0.5
              },
              {
                "t": 0.75,
                "v": 0.15
              },
              {
                "t": 1,
                "v": 0.5
              }
            ]
          },
          {
            "kind": "P",
            "joint": "r_upper_arm",
            "prop": "rotation",
            "axis": "x",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": -0.5
              },
              {
                "t": 0.25,
                "v": -0.15
              },
              {
                "t": 0.5,
                "v": 0.5
              },
              {
                "t": 0.75,
                "v": -0.15
              },
              {
                "t": 1,
                "v": -0.5
              }
            ]
          }
        ],
        "Attack": [
          {
            "kind": "O",
            "joint": "torso",
            "prop": "rotation",
            "axis": "x",
            "restKey": "torso:x",
            "keys": [
              {
                "t": 0,
                "v": 0
              },
              {
                "t": 0.45,
                "v": -0.12
              },
              {
                "t": 0.55,
                "v": 0.3
              },
              {
                "t": 0.78,
                "v": 0.08
              },
              {
                "t": 1,
                "v": 0
              }
            ]
          },
          {
            "kind": "P",
            "joint": "torso_upper",
            "prop": "rotation",
            "axis": "x",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": 0
              },
              {
                "t": 0.45,
                "v": 0.02
              },
              {
                "t": 0.55,
                "v": 0.42
              },
              {
                "t": 0.78,
                "v": 0.12
              },
              {
                "t": 1,
                "v": 0
              }
            ]
          },
          {
            "kind": "P",
            "joint": "l_upper_arm",
            "prop": "rotation",
            "axis": "x",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": -0.1
              },
              {
                "t": 0.45,
                "v": -1.8
              },
              {
                "t": 0.55,
                "v": -0.4
              },
              {
                "t": 1,
                "v": -0.1
              }
            ]
          },
          {
            "kind": "P",
            "joint": "r_upper_arm",
            "prop": "rotation",
            "axis": "x",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": -0.1
              },
              {
                "t": 0.45,
                "v": -1.8
              },
              {
                "t": 0.55,
                "v": -0.4
              },
              {
                "t": 1,
                "v": -0.1
              }
            ]
          },
          {
            "kind": "P",
            "joint": "l_forearm",
            "prop": "rotation",
            "axis": "x",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": -1.6
              },
              {
                "t": 0.45,
                "v": -0.2
              },
              {
                "t": 0.55,
                "v": -0.5
              },
              {
                "t": 1,
                "v": -1.6
              }
            ]
          },
          {
            "kind": "P",
            "joint": "r_forearm",
            "prop": "rotation",
            "axis": "x",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": -1.6
              },
              {
                "t": 0.45,
                "v": -0.2
              },
              {
                "t": 0.55,
                "v": -0.5
              },
              {
                "t": 1,
                "v": -1.6
              }
            ]
          }
        ],
        "Stagger": [
          {
            "kind": "O",
            "joint": "torso",
            "prop": "rotation",
            "axis": "x",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": 0
              },
              {
                "t": 0.2,
                "v": -0.3
              },
              {
                "t": 1,
                "v": 0
              }
            ]
          },
          {
            "kind": "P",
            "joint": "head",
            "prop": "rotation",
            "axis": "x",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": 0
              },
              {
                "t": 0.15,
                "v": -0.4
              },
              {
                "t": 1,
                "v": 0
              }
            ]
          }
        ],
        "Die": [
          {
            "kind": "P",
            "joint": "root",
            "prop": "rotation",
            "axis": "x",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": 0
              },
              {
                "t": 0.3,
                "v": 0.3
              },
              {
                "t": 0.55,
                "v": 1.15
              },
              {
                "t": 0.78,
                "v": 1.6
              },
              {
                "t": 0.9,
                "v": 1.55
              },
              {
                "t": 1,
                "v": 1.5707963267948966
              }
            ]
          },
          {
            "kind": "O",
            "joint": "root",
            "prop": "position",
            "axis": "y",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": 0.75
              },
              {
                "t": 0.55,
                "v": 0.7
              },
              {
                "t": 0.78,
                "v": 0.55
              },
              {
                "t": 1,
                "v": 0.475
              }
            ]
          },
          {
            "kind": "O",
            "joint": "torso",
            "prop": "rotation",
            "axis": "x",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": 0.2
              },
              {
                "t": 0.35,
                "v": 0.4
              },
              {
                "t": 0.7,
                "v": 0.05
              },
              {
                "t": 1,
                "v": 0
              }
            ]
          },
          {
            "kind": "P",
            "joint": "neck",
            "prop": "rotation",
            "axis": "x",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": 0.22
              },
              {
                "t": 0.4,
                "v": 0.35
              },
              {
                "t": 1,
                "v": 0.05
              }
            ]
          },
          {
            "kind": "P",
            "joint": "head",
            "prop": "rotation",
            "axis": "z",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": 0.08
              },
              {
                "t": 0.5,
                "v": 0.1
              },
              {
                "t": 1,
                "v": 0.7
              }
            ]
          },
          {
            "kind": "P",
            "joint": "l_upper_arm",
            "prop": "rotation",
            "axis": "z",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": 0.09
              },
              {
                "t": 0.4,
                "v": 0.15
              },
              {
                "t": 0.75,
                "v": 1.1
              },
              {
                "t": 1,
                "v": 0.95
              }
            ]
          },
          {
            "kind": "P",
            "joint": "r_upper_arm",
            "prop": "rotation",
            "axis": "z",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": -0.09
              },
              {
                "t": 0.4,
                "v": -0.15
              },
              {
                "t": 0.75,
                "v": -0.75
              },
              {
                "t": 1,
                "v": -0.6
              }
            ]
          },
          {
            "kind": "P",
            "joint": "l_forearm",
            "prop": "rotation",
            "axis": "x",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": 0
              },
              {
                "t": 0.5,
                "v": -0.25
              },
              {
                "t": 1,
                "v": -0.4
              }
            ]
          },
          {
            "kind": "P",
            "joint": "r_forearm",
            "prop": "rotation",
            "axis": "x",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": 0
              },
              {
                "t": 0.5,
                "v": -0.35
              },
              {
                "t": 1,
                "v": -0.55
              }
            ]
          },
          {
            "kind": "P",
            "joint": "l_upper_leg",
            "prop": "rotation",
            "axis": "x",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": 0
              },
              {
                "t": 0.25,
                "v": -0.15
              },
              {
                "t": 0.7,
                "v": 0.05
              },
              {
                "t": 1,
                "v": -0.06
              }
            ]
          },
          {
            "kind": "P",
            "joint": "r_upper_leg",
            "prop": "rotation",
            "axis": "x",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": 0
              },
              {
                "t": 0.25,
                "v": -0.15
              },
              {
                "t": 0.7,
                "v": 0.08
              },
              {
                "t": 1,
                "v": -0.1
              }
            ]
          },
          {
            "kind": "P",
            "joint": "l_upper_leg",
            "prop": "rotation",
            "axis": "z",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": 0
              },
              {
                "t": 0.6,
                "v": 0.05
              },
              {
                "t": 1,
                "v": 0.1
              }
            ]
          },
          {
            "kind": "P",
            "joint": "r_upper_leg",
            "prop": "rotation",
            "axis": "z",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": 0
              },
              {
                "t": 0.6,
                "v": -0.08
              },
              {
                "t": 1,
                "v": -0.16
              }
            ]
          },
          {
            "kind": "P",
            "joint": "l_lower_leg",
            "prop": "rotation",
            "axis": "x",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": 0
              },
              {
                "t": 0.25,
                "v": 0.35
              },
              {
                "t": 0.8,
                "v": 0.06
              },
              {
                "t": 1,
                "v": 0.04
              }
            ]
          },
          {
            "kind": "P",
            "joint": "r_lower_leg",
            "prop": "rotation",
            "axis": "x",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": 0
              },
              {
                "t": 0.25,
                "v": 0.35
              },
              {
                "t": 0.8,
                "v": 0.22
              },
              {
                "t": 1,
                "v": 0.15
              }
            ]
          }
        ]
      }
    }
  },
  "v2-成年女性-2026-08-14": {
    "date": "2026-08-14",
    "note": "",
    "tree": {
      "name": "root",
      "type": "Group",
      "position": [
        0.08,
        0.1833,
        0
      ],
      "rotation": [
        0,
        0,
        0
      ],
      "children": [
        {
          "name": "pelvis",
          "type": "TaperedBox",
          "size": [
            0.28,
            0.135,
            0.12,
            0.3,
            0.2,
            0,
            -0.001745367603108186,
            0,
            0
          ],
          "position": [
            0,
            0.5,
            0
          ],
          "materialId": "__cloth__",
          "children": [
            {
              "name": "torso",
              "type": "Group",
              "position": [
                0,
                0.0675,
                0.04
              ],
              "rotation": [
                0,
                0,
                0
              ],
              "materialId": "__cloth__",
              "children": [
                {
                  "name": "torso_upper",
                  "type": "RidgeBox",
                  "size": [
                    0.16,
                    0.29,
                    0.12,
                    0.25,
                    0.12,
                    0,
                    -0.05888512803143086,
                    0.2,
                    0.07869616132342962
                  ],
                  "position": [
                    0,
                    0.299,
                    -0.0079
                  ],
                  "materialId": "__skin__",
                  "rotation": [
                    0,
                    0,
                    0
                  ],
                  "visible": true,
                  "pivot": [
                    0,
                    -0.145,
                    0
                  ],
                  "children": [
                    {
                      "name": "neck",
                      "type": "Cylinder",
                      "size": [
                        0.04,
                        0.061,
                        0.04
                      ],
                      "position": [
                        0,
                        0.1755,
                        -0.0421
                      ],
                      "rotation": [
                        0,
                        0,
                        0
                      ],
                      "pivot": [
                        0,
                        -0.0305,
                        0
                      ],
                      "materialId": "__skin__",
                      "children": [
                        {
                          "name": "head",
                          "type": "Sphere",
                          "size": [
                            0.08929999999999999
                          ],
                          "position": [
                            0,
                            0.0874,
                            0.0032
                          ],
                          "rotation": [
                            0,
                            0,
                            0
                          ],
                          "pivot": [
                            0,
                            -0.08929999999999999,
                            0
                          ],
                          "materialId": "__skin__",
                          "segments": [
                            6,
                            5
                          ],
                          "children": [
                            {
                              "name": "l_eye_glow",
                              "type": "Sphere",
                              "size": [
                                0.019
                              ],
                              "position": [
                                0.0285,
                                0.019,
                                0.0665
                              ],
                              "materialId": "eye_glow",
                              "segments": [
                                5,
                                4
                              ],
                              "rotation": [
                                0,
                                0,
                                0
                              ],
                              "visible": true
                            },
                            {
                              "name": "r_eye_glow",
                              "type": "Sphere",
                              "size": [
                                0.019
                              ],
                              "position": [
                                -0.0285,
                                0.019,
                                0.0665
                              ],
                              "materialId": "eye_glow",
                              "segments": [
                                5,
                                4
                              ],
                              "rotation": [
                                0,
                                0,
                                0
                              ],
                              "visible": true
                            }
                          ],
                          "visible": true
                        }
                      ],
                      "visible": true
                    },
                    {
                      "name": "l_upper_arm",
                      "type": "Cylinder",
                      "size": [
                        0.045,
                        0.275,
                        0.03
                      ],
                      "position": [
                        0.171,
                        0.0075,
                        -0.0421
                      ],
                      "rotation": [
                        0,
                        0,
                        0.0349
                      ],
                      "pivot": [
                        0,
                        0.1375,
                        0
                      ],
                      "materialId": "__skin__",
                      "children": [
                        {
                          "name": "l_forearm",
                          "type": "Cylinder",
                          "size": [
                            0.03,
                            0.255,
                            0.035
                          ],
                          "position": [
                            0,
                            -0.2567,
                            0
                          ],
                          "pivot": [
                            0,
                            0.1275,
                            0
                          ],
                          "materialId": "__skin__",
                          "children": [
                            {
                              "name": "l_hand",
                              "type": "Box",
                              "size": [
                                0.052,
                                0.104,
                                0.045
                              ],
                              "position": [
                                0,
                                -0.18,
                                0
                              ],
                              "pivot": [
                                0,
                                0.052,
                                0
                              ],
                              "materialId": "__skin__",
                              "rotation": [
                                0,
                                0,
                                0
                              ],
                              "visible": true
                            }
                          ],
                          "rotation": [
                            0,
                            0,
                            0
                          ],
                          "visible": true
                        }
                      ],
                      "visible": true
                    },
                    {
                      "name": "r_upper_arm",
                      "type": "Cylinder",
                      "size": [
                        0.045,
                        0.275,
                        0.03
                      ],
                      "position": [
                        -0.171,
                        0.0075,
                        -0.0421
                      ],
                      "rotation": [
                        0,
                        0,
                        -0.0349
                      ],
                      "pivot": [
                        0,
                        0.1375,
                        0
                      ],
                      "materialId": "__skin__",
                      "children": [
                        {
                          "name": "r_forearm",
                          "type": "Cylinder",
                          "size": [
                            0.03,
                            0.255,
                            0.035
                          ],
                          "position": [
                            0,
                            -0.2567,
                            0
                          ],
                          "pivot": [
                            0,
                            0.1275,
                            0
                          ],
                          "materialId": "__skin__",
                          "children": [
                            {
                              "name": "r_hand",
                              "type": "Box",
                              "size": [
                                0.052,
                                0.104,
                                0.045
                              ],
                              "position": [
                                0,
                                -0.18,
                                0
                              ],
                              "pivot": [
                                0,
                                0.052,
                                0
                              ],
                              "materialId": "__skin__",
                              "rotation": [
                                0,
                                0,
                                0
                              ],
                              "visible": true
                            }
                          ],
                          "rotation": [
                            0,
                            0,
                            0
                          ],
                          "visible": true
                        }
                      ],
                      "visible": true
                    }
                  ]
                },
                {
                  "name": "torso_lower",
                  "type": "TaperedBox",
                  "size": [
                    0.3,
                    0.154,
                    0.2,
                    0.16,
                    0.12,
                    0,
                    0,
                    0,
                    -0.04
                  ],
                  "position": [
                    0,
                    0.077,
                    -0.04
                  ],
                  "materialId": "__skin__",
                  "rotation": [
                    0,
                    0,
                    0
                  ],
                  "visible": true
                }
              ],
              "visible": true
            },
            {
              "name": "l_upper_leg",
              "type": "Cylinder",
              "size": [
                0.061,
                0.34650000000000003,
                0.04
              ],
              "position": [
                0.075,
                -0.1724,
                0
              ],
              "pivot": [
                0,
                0.17325000000000002,
                0
              ],
              "materialId": "__skin__",
              "children": [
                {
                  "name": "l_lower_leg",
                  "type": "Cylinder",
                  "size": [
                    0.04,
                    0.34650000000000003,
                    0.04
                  ],
                  "position": [
                    0,
                    -0.3234,
                    0
                  ],
                  "pivot": [
                    0,
                    0.17325000000000002,
                    0
                  ],
                  "materialId": "__skin__",
                  "children": [
                    {
                      "name": "l_foot",
                      "type": "Box",
                      "size": [
                        0.112,
                        0.045,
                        0.225
                      ],
                      "position": [
                        0,
                        -0.165,
                        0.06
                      ],
                      "pivot": [
                        0,
                        0.05,
                        -0.1
                      ],
                      "materialId": "__skin__",
                      "rotation": [
                        0,
                        0,
                        0
                      ],
                      "visible": true
                    }
                  ],
                  "rotation": [
                    0,
                    0,
                    0
                  ],
                  "visible": true
                }
              ],
              "rotation": [
                0,
                0,
                0
              ],
              "visible": true
            },
            {
              "name": "r_upper_leg",
              "type": "Cylinder",
              "size": [
                0.061,
                0.34650000000000003,
                0.04
              ],
              "position": [
                -0.075,
                -0.17,
                0
              ],
              "pivot": [
                0,
                0.17325000000000002,
                0
              ],
              "materialId": "__skin__",
              "children": [
                {
                  "name": "r_lower_leg",
                  "type": "Cylinder",
                  "size": [
                    0.04,
                    0.34650000000000003,
                    0.04
                  ],
                  "position": [
                    0,
                    -0.3234,
                    0
                  ],
                  "pivot": [
                    0,
                    0.17325000000000002,
                    0
                  ],
                  "materialId": "__skin__",
                  "children": [
                    {
                      "name": "r_foot",
                      "type": "Box",
                      "size": [
                        0.112,
                        0.045,
                        0.225
                      ],
                      "position": [
                        0,
                        -0.165,
                        0.06
                      ],
                      "pivot": [
                        0,
                        0.05,
                        -0.1
                      ],
                      "materialId": "__skin__",
                      "rotation": [
                        0,
                        0,
                        0
                      ],
                      "visible": true
                    }
                  ],
                  "rotation": [
                    0,
                    0,
                    0
                  ],
                  "visible": true
                }
              ],
              "rotation": [
                0,
                0,
                0
              ],
              "visible": true
            }
          ],
          "rotation": [
            0,
            0,
            0
          ],
          "visible": true
        }
      ],
      "visible": true
    },
    "anims": {
      "restPoses": {
        "torso:x": 0.2,
        "neck:x": 0.22,
        "head:z": 0.08,
        "l_upper_arm:z": 0.09,
        "r_upper_arm:z": -0.09,
        "pelvis:y": 0.5
      },
      "actions": {
        "Idle": [
          {
            "kind": "O",
            "joint": "torso",
            "prop": "rotation",
            "axis": "z",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": 0
              },
              {
                "t": 0.5,
                "v": 0.03
              },
              {
                "t": 1,
                "v": 0
              }
            ]
          },
          {
            "kind": "O",
            "joint": "pelvis",
            "prop": "position",
            "axis": "y",
            "restKey": "pelvis:y",
            "keys": [
              {
                "t": 0,
                "v": 0
              },
              {
                "t": 0.5,
                "v": 0.02
              },
              {
                "t": 1,
                "v": 0
              }
            ]
          },
          {
            "kind": "P",
            "joint": "head",
            "prop": "rotation",
            "axis": "z",
            "restKey": "head:z",
            "keys": [
              {
                "t": 0,
                "v": 0
              },
              {
                "t": 0.5,
                "v": -0.04
              },
              {
                "t": 1,
                "v": 0
              }
            ]
          }
        ],
        "Walk": [
          {
            "kind": "O",
            "joint": "pelvis",
            "prop": "position",
            "axis": "y",
            "restKey": "pelvis:y",
            "keys": [
              {
                "t": 0,
                "v": 0
              },
              {
                "t": 0.5,
                "v": 0.04
              },
              {
                "t": 1,
                "v": 0
              }
            ]
          },
          {
            "kind": "P",
            "joint": "l_upper_leg",
            "prop": "rotation",
            "axis": "x",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": -0.45
              },
              {
                "t": 0.25,
                "v": -0.08
              },
              {
                "t": 0.5,
                "v": 0.12
              },
              {
                "t": 0.75,
                "v": 0.25
              },
              {
                "t": 1,
                "v": -0.45
              }
            ]
          },
          {
            "kind": "P",
            "joint": "r_upper_leg",
            "prop": "rotation",
            "axis": "x",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": 0.25
              },
              {
                "t": 0.25,
                "v": -0.45
              },
              {
                "t": 0.5,
                "v": -0.08
              },
              {
                "t": 0.75,
                "v": 0.12
              },
              {
                "t": 1,
                "v": 0.25
              }
            ]
          },
          {
            "kind": "P",
            "joint": "l_lower_leg",
            "prop": "rotation",
            "axis": "x",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": -0.3
              },
              {
                "t": 0.25,
                "v": 0.12
              },
              {
                "t": 0.5,
                "v": 0.37
              },
              {
                "t": 0.75,
                "v": 1.35
              },
              {
                "t": 1,
                "v": -0.3
              }
            ]
          },
          {
            "kind": "P",
            "joint": "r_lower_leg",
            "prop": "rotation",
            "axis": "x",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": 0.37
              },
              {
                "t": 0.25,
                "v": 1.35
              },
              {
                "t": 0.5,
                "v": -0.3
              },
              {
                "t": 0.75,
                "v": 0.12
              },
              {
                "t": 1,
                "v": 0.37
              }
            ]
          },
          {
            "kind": "P",
            "joint": "l_upper_arm",
            "prop": "rotation",
            "axis": "x",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": 0.35
              },
              {
                "t": 0.25,
                "v": 0.1
              },
              {
                "t": 0.5,
                "v": -0.35
              },
              {
                "t": 0.75,
                "v": 0.1
              },
              {
                "t": 1,
                "v": 0.35
              }
            ]
          },
          {
            "kind": "P",
            "joint": "r_upper_arm",
            "prop": "rotation",
            "axis": "x",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": -0.35
              },
              {
                "t": 0.25,
                "v": -0.1
              },
              {
                "t": 0.5,
                "v": 0.35
              },
              {
                "t": 0.75,
                "v": -0.1
              },
              {
                "t": 1,
                "v": -0.35
              }
            ]
          }
        ],
        "Run": [
          {
            "kind": "O",
            "joint": "torso",
            "prop": "rotation",
            "axis": "x",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": 0.3
              },
              {
                "t": 0.5,
                "v": 0.15
              },
              {
                "t": 1,
                "v": 0.3
              }
            ]
          },
          {
            "kind": "O",
            "joint": "pelvis",
            "prop": "position",
            "axis": "y",
            "restKey": "pelvis:y",
            "keys": [
              {
                "t": 0,
                "v": 0
              },
              {
                "t": 0.5,
                "v": 0.08
              },
              {
                "t": 1,
                "v": 0
              }
            ]
          },
          {
            "kind": "P",
            "joint": "l_upper_leg",
            "prop": "rotation",
            "axis": "x",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": -0.85
              },
              {
                "t": 0.25,
                "v": -0.2
              },
              {
                "t": 0.5,
                "v": 0.15
              },
              {
                "t": 0.75,
                "v": 0.35
              },
              {
                "t": 1,
                "v": -0.85
              }
            ]
          },
          {
            "kind": "P",
            "joint": "r_upper_leg",
            "prop": "rotation",
            "axis": "x",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": 0.15
              },
              {
                "t": 0.25,
                "v": 0.35
              },
              {
                "t": 0.5,
                "v": -0.85
              },
              {
                "t": 0.75,
                "v": -0.2
              },
              {
                "t": 1,
                "v": 0.15
              }
            ]
          },
          {
            "kind": "P",
            "joint": "l_lower_leg",
            "prop": "rotation",
            "axis": "x",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": -0.3
              },
              {
                "t": 0.25,
                "v": 0.05
              },
              {
                "t": 0.5,
                "v": 0.75
              },
              {
                "t": 0.75,
                "v": 1.85
              },
              {
                "t": 1,
                "v": -0.3
              }
            ]
          },
          {
            "kind": "P",
            "joint": "r_lower_leg",
            "prop": "rotation",
            "axis": "x",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": 0.75
              },
              {
                "t": 0.25,
                "v": 1.85
              },
              {
                "t": 0.5,
                "v": -0.3
              },
              {
                "t": 0.75,
                "v": 0.05
              },
              {
                "t": 1,
                "v": 0.75
              }
            ]
          },
          {
            "kind": "P",
            "joint": "l_upper_arm",
            "prop": "rotation",
            "axis": "x",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": 0.5
              },
              {
                "t": 0.25,
                "v": 0.15
              },
              {
                "t": 0.5,
                "v": -0.5
              },
              {
                "t": 0.75,
                "v": 0.15
              },
              {
                "t": 1,
                "v": 0.5
              }
            ]
          },
          {
            "kind": "P",
            "joint": "r_upper_arm",
            "prop": "rotation",
            "axis": "x",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": -0.5
              },
              {
                "t": 0.25,
                "v": -0.15
              },
              {
                "t": 0.5,
                "v": 0.5
              },
              {
                "t": 0.75,
                "v": -0.15
              },
              {
                "t": 1,
                "v": -0.5
              }
            ]
          }
        ],
        "Attack": [
          {
            "kind": "O",
            "joint": "torso",
            "prop": "rotation",
            "axis": "x",
            "restKey": "torso:x",
            "keys": [
              {
                "t": 0,
                "v": 0
              },
              {
                "t": 0.45,
                "v": -0.12
              },
              {
                "t": 0.55,
                "v": 0.3
              },
              {
                "t": 0.78,
                "v": 0.08
              },
              {
                "t": 1,
                "v": 0
              }
            ]
          },
          {
            "kind": "P",
            "joint": "torso_upper",
            "prop": "rotation",
            "axis": "x",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": 0
              },
              {
                "t": 0.45,
                "v": 0.02
              },
              {
                "t": 0.55,
                "v": 0.42
              },
              {
                "t": 0.78,
                "v": 0.12
              },
              {
                "t": 1,
                "v": 0
              }
            ]
          },
          {
            "kind": "P",
            "joint": "l_upper_arm",
            "prop": "rotation",
            "axis": "x",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": -0.1
              },
              {
                "t": 0.45,
                "v": -1.8
              },
              {
                "t": 0.55,
                "v": -0.4
              },
              {
                "t": 1,
                "v": -0.1
              }
            ]
          },
          {
            "kind": "P",
            "joint": "r_upper_arm",
            "prop": "rotation",
            "axis": "x",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": -0.1
              },
              {
                "t": 0.45,
                "v": -1.8
              },
              {
                "t": 0.55,
                "v": -0.4
              },
              {
                "t": 1,
                "v": -0.1
              }
            ]
          },
          {
            "kind": "P",
            "joint": "l_forearm",
            "prop": "rotation",
            "axis": "x",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": -1.6
              },
              {
                "t": 0.45,
                "v": -0.2
              },
              {
                "t": 0.55,
                "v": -0.5
              },
              {
                "t": 1,
                "v": -1.6
              }
            ]
          },
          {
            "kind": "P",
            "joint": "r_forearm",
            "prop": "rotation",
            "axis": "x",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": -1.6
              },
              {
                "t": 0.45,
                "v": -0.2
              },
              {
                "t": 0.55,
                "v": -0.5
              },
              {
                "t": 1,
                "v": -1.6
              }
            ]
          }
        ],
        "Stagger": [
          {
            "kind": "O",
            "joint": "torso",
            "prop": "rotation",
            "axis": "x",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": 0
              },
              {
                "t": 0.2,
                "v": -0.3
              },
              {
                "t": 1,
                "v": 0
              }
            ]
          },
          {
            "kind": "P",
            "joint": "head",
            "prop": "rotation",
            "axis": "x",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": 0
              },
              {
                "t": 0.15,
                "v": -0.4
              },
              {
                "t": 1,
                "v": 0
              }
            ]
          }
        ],
        "Die": [
          {
            "kind": "P",
            "joint": "root",
            "prop": "rotation",
            "axis": "x",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": 0
              },
              {
                "t": 0.3,
                "v": 0.3
              },
              {
                "t": 0.55,
                "v": 1.15
              },
              {
                "t": 0.78,
                "v": 1.6
              },
              {
                "t": 0.9,
                "v": 1.55
              },
              {
                "t": 1,
                "v": 1.5707963267948966
              }
            ]
          },
          {
            "kind": "O",
            "joint": "root",
            "prop": "position",
            "axis": "y",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": 0.75
              },
              {
                "t": 0.55,
                "v": 0.7
              },
              {
                "t": 0.78,
                "v": 0.55
              },
              {
                "t": 1,
                "v": 0.475
              }
            ]
          },
          {
            "kind": "O",
            "joint": "torso",
            "prop": "rotation",
            "axis": "x",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": 0.2
              },
              {
                "t": 0.35,
                "v": 0.4
              },
              {
                "t": 0.7,
                "v": 0.05
              },
              {
                "t": 1,
                "v": 0
              }
            ]
          },
          {
            "kind": "P",
            "joint": "neck",
            "prop": "rotation",
            "axis": "x",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": 0.22
              },
              {
                "t": 0.4,
                "v": 0.35
              },
              {
                "t": 1,
                "v": 0.05
              }
            ]
          },
          {
            "kind": "P",
            "joint": "head",
            "prop": "rotation",
            "axis": "z",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": 0.08
              },
              {
                "t": 0.5,
                "v": 0.1
              },
              {
                "t": 1,
                "v": 0.7
              }
            ]
          },
          {
            "kind": "P",
            "joint": "l_upper_arm",
            "prop": "rotation",
            "axis": "z",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": 0.09
              },
              {
                "t": 0.4,
                "v": 0.15
              },
              {
                "t": 0.75,
                "v": 1.1
              },
              {
                "t": 1,
                "v": 0.95
              }
            ]
          },
          {
            "kind": "P",
            "joint": "r_upper_arm",
            "prop": "rotation",
            "axis": "z",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": -0.09
              },
              {
                "t": 0.4,
                "v": -0.15
              },
              {
                "t": 0.75,
                "v": -0.75
              },
              {
                "t": 1,
                "v": -0.6
              }
            ]
          },
          {
            "kind": "P",
            "joint": "l_forearm",
            "prop": "rotation",
            "axis": "x",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": 0
              },
              {
                "t": 0.5,
                "v": -0.25
              },
              {
                "t": 1,
                "v": -0.4
              }
            ]
          },
          {
            "kind": "P",
            "joint": "r_forearm",
            "prop": "rotation",
            "axis": "x",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": 0
              },
              {
                "t": 0.5,
                "v": -0.35
              },
              {
                "t": 1,
                "v": -0.55
              }
            ]
          },
          {
            "kind": "P",
            "joint": "l_upper_leg",
            "prop": "rotation",
            "axis": "x",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": 0
              },
              {
                "t": 0.25,
                "v": -0.15
              },
              {
                "t": 0.7,
                "v": 0.05
              },
              {
                "t": 1,
                "v": -0.06
              }
            ]
          },
          {
            "kind": "P",
            "joint": "r_upper_leg",
            "prop": "rotation",
            "axis": "x",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": 0
              },
              {
                "t": 0.25,
                "v": -0.15
              },
              {
                "t": 0.7,
                "v": 0.08
              },
              {
                "t": 1,
                "v": -0.1
              }
            ]
          },
          {
            "kind": "P",
            "joint": "l_upper_leg",
            "prop": "rotation",
            "axis": "z",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": 0
              },
              {
                "t": 0.6,
                "v": 0.05
              },
              {
                "t": 1,
                "v": 0.1
              }
            ]
          },
          {
            "kind": "P",
            "joint": "r_upper_leg",
            "prop": "rotation",
            "axis": "z",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": 0
              },
              {
                "t": 0.6,
                "v": -0.08
              },
              {
                "t": 1,
                "v": -0.16
              }
            ]
          },
          {
            "kind": "P",
            "joint": "l_lower_leg",
            "prop": "rotation",
            "axis": "x",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": 0
              },
              {
                "t": 0.25,
                "v": 0.35
              },
              {
                "t": 0.8,
                "v": 0.06
              },
              {
                "t": 1,
                "v": 0.04
              }
            ]
          },
          {
            "kind": "P",
            "joint": "r_lower_leg",
            "prop": "rotation",
            "axis": "x",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": 0
              },
              {
                "t": 0.25,
                "v": 0.35
              },
              {
                "t": 0.8,
                "v": 0.22
              },
              {
                "t": 1,
                "v": 0.15
              }
            ]
          }
        ]
      }
    }
  }
};

  // MODELS：四变体裸体（从骨架版本烘焙，Phase 1 裸体无 addon；学生男女同参数分开存）
  var MODELS = {};
  MODELS.student_m = {
    _skeletonVer: 'v1-儿童-20260810',
    tree: bakeModel('v1-儿童-20260810', { addons: [] }),
    anims: null,
  };
  MODELS.student_f = {
    _skeletonVer: 'v1-儿童-20260810',
    tree: bakeModel('v1-儿童-20260810', { addons: [] }),
    anims: null,
  };
  MODELS.teacher_m = {
    _skeletonVer: 'v1-成年男-20260810',
    tree: bakeModel('v1-成年男-20260810', { addons: [] }),
    anims: null,
  };
  MODELS.teacher_f = {
    _skeletonVer: 'v2-成年女性-2026-08-14',
    tree: bakeModel('v2-成年女性-2026-08-14', { addons: [] }),
    anims: null,
  };

  // 变体动画继承：MODELS[v].anims = 所属骨架版本的 anims（每骨架一套基本动画，变体自动继承）
  Object.keys(MODELS).forEach(function (mk) {
    var msv = MODELS[mk]._skeletonVer;
    if (msv && SKELETON_VERSIONS[msv] && SKELETON_VERSIONS[msv].anims) {
      MODELS[mk].anims = JSON.parse(JSON.stringify(SKELETON_VERSIONS[msv].anims));
    }
  });

  // bakeModel：从骨架版本烘焙字面值 tree（复用 deriveNode + addon 注入逻辑）
  //   skeletonVer: SKELETON_VERSIONS 的 key；params: { height, build, hunch, curves, addons }
  function bakeModel(skeletonVer, params) {
    var ver = SKELETON_VERSIONS[skeletonVer];
    if (!ver) {
      console.warn('bakeModel: 未知骨架版本', skeletonVer);
      return null;
    }
    params = params || {};
    // 深拷贝版本骨架 + 派生（复用 deriveNode：build/curves/hunch 缩放）
    var variant = { materials: HUMANOID_VARIANTS.student_m.materials, addons: params.addons || [] };
    var tree = deriveNode(
      JSON.parse(JSON.stringify(ver.tree)),
      {
        height: params.height != null ? params.height : 1.4,
        build: params.build != null ? params.build : BODY_PARAMS.build.default,
        hunch: params.hunch != null ? params.hunch : 0.2,
        curves: params.curves != null ? params.curves : 0,
      },
      variant
    );
    // addon 注入（复用 buildHumanoid 的 L900-953 逻辑：解析材质/镜像/curves 放大/WRAP 包裹）
    (params.addons || []).forEach(function (key) {
      var def = ADDON_LIBRARY[key];
      if (!def) return;
      var parents = def.parent ? [def.parent] : [];
      parents.forEach(function (par) {
        var parentNode = findNode(tree, par);
        if (!parentNode) return;
        parentNode.children = parentNode.children || [];
        var clone = JSON.parse(JSON.stringify(def.node));
        resolveAddonMaterials(clone, variant.materials);
        parentNode.children.push(clone);
      });
    });
    tree._params = { height: params.height != null ? params.height : 1.4 };
    return tree;
  }
  function getSkeletonList() {
    return Object.keys(SKELETON_VERSIONS);
  }
  function getVariantList() {
    return Object.keys(MODELS);
  }

  window.HumanoidConfig = {
    HUMANOID_BASE,
    BODY_PARAMS,
    HUMANOID_VARIANTS,
    ADDON_LIBRARY,
    JOINT_NAMES,
    REST_POSES,
    buildHumanoid, // 旧接口（Phase 1 游戏侧仍用）
    SKELETON_VERSIONS,
    WORKING_SKELETON,
    BASE_ANIMS, // 基本动画模板（每骨架版本 anims 从此派生）
    MODELS, // 新数据层
    bakeModel,
    getSkeletonList,
    getVariantList,
  };
  console.log(
    '🧑 人形配置已就绪 | 变体:',
    Object.keys(HUMANOID_VARIANTS).join('/'),
    '| 骨架版本:',
    Object.keys(SKELETON_VERSIONS).length
  );
})();
