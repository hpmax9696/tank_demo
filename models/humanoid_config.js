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
            rotation: [0, 0, 0],
            pivot: [0, -0.375, 0],
            materialId: '__cloth__',
            _slot: 'torso',
            children: [
              {
                name: 'neck',
                type: 'Cylinder',
                size: [0.12, 0.15, 0.12],
                position: [0, 0.46, 0.02],
                rotation: [0, 0, 0],
                pivot: [0, -0.075, 0],
                materialId: '__skin__',
                children: [
                  {
                    name: 'head',
                    type: 'Sphere',
                    size: [0.2],
                    position: [0, 0.215, 0.02],
                    rotation: [0, 0, 0],
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
      name: '学生(男)·校园丧尸',
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
        'short_sleeve_white',
        
        'shorts_m',
        'shoes_blue',
      ],
      bodyRange: { height: [1.1, 1.5], hunch: [0.1, 0.25] },
    },
    student_f: {
      name: '学生(女)·校园丧尸',
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
        'short_sleeve_white',
        
        'pleated_skirt_f',
        'shoes_white',
      ],
      bodyRange: { height: [1.1, 1.5], hunch: [0.1, 0.25] },
    },
    teacher_m: {
      name: '教师(男)·校园丧尸',
      materials: { cloth: 'teacher_shirt', skin: 'skin_zombie' },
      addons: [
        'short_hair_m',
        'tie_opt',
        'glasses_opt',
        'long_sleeve_upper_blue',
        'long_sleeve_fore_blue',
        
        'trousers_grey',
        'trousers_grey_calf',
        'leather_shoes',
        'briefcase_opt',
      ],
      bodyRange: { height: [1.55, 1.75], hunch: [0, 0.05] },
    },
    teacher_f: {
      name: '教师(女)·校园丧尸',
      materials: { cloth: 'blouse_white', skin: 'skin_zombie' },
      addons: [
        'short_hair_m',
        'bun_f',
        'short_sleeve_pink',

        'skirt_grey',
        'leather_shoes',
        'necklace_opt',
      ],
      bodyRange: { height: [1.55, 1.75], hunch: [0, 0.05], build: [0.3, 0.45], curves: [0.6, 0.9] },
    },
    // ── 人类士兵（v0.79.37 预研：v1-成年男烘焙，敌我双方可用的活人单位）──
    // cloth 占位 = 制服/迷彩外套色（袖子/裤腿/下摆 __cloth__ 联动换装）；skin = 活人肤色
    guard: {
      name: '校园保安·人类士兵',
      materials: { cloth: 'uniform_navy', skin: 'skin_live' },
      addons: [
        'guard_cap',
        'guard_vest',
        'duty_belt',
        'long_sleeve_u',
        'long_sleeve_f',
        'long_trouser_thigh',
        'long_trouser_calf',
        'leather_shoes',
        'weapon_baton',
      ],
      bodyRange: { height: [1.68, 1.78], hunch: [0, 0.05] },
    },
    rifleman: {
      name: '步枪兵·人类士兵',
      materials: { cloth: 'camo_cloth', skin: 'skin_live' },
      addons: [
        'combat_helmet',
        'tac_vest',
        'duty_belt',
        'long_sleeve_u',
        'long_sleeve_f',
        'long_trouser_thigh',
        'long_trouser_calf',
        'combat_boots',
        'weapon_rifle',
      ],
      bodyRange: { height: [1.68, 1.8], hunch: [0, 0.05] },
    },
    shotgunner: {
      name: '霰弹枪兵·人类士兵',
      materials: { cloth: 'camo_cloth', skin: 'skin_live' },
      addons: [
        'combat_helmet',
        'tac_vest',
        'duty_belt',
        'long_sleeve_u',
        'long_sleeve_f',
        'long_trouser_thigh',
        'long_trouser_calf',
        'combat_boots',
        'weapon_shotgun',
      ],
      bodyRange: { height: [1.68, 1.8], hunch: [0, 0.05] },
    },
    rocketeer: {
      name: '火箭筒兵·人类士兵',
      materials: { cloth: 'camo_cloth', skin: 'skin_live' },
      addons: [
        'combat_helmet',
        'tac_vest',
        'duty_belt',
        'long_sleeve_u',
        'long_sleeve_f',
        'long_trouser_thigh',
        'long_trouser_calf',
        'combat_boots',
        'weapon_rpg',
      ],
      bodyRange: { height: [1.68, 1.8], hunch: [0, 0.05] },
    },
  };

  // ④ 装饰节点库（起始几何估值；_materialKey 标记用变体材质还是自带）
  const ADDON_LIBRARY = {
    short_hair_m: {
      parent: 'head',
      node: {
        type: 'Group',
        position: [0, 0.02, -0.005],
        rotation: [-0.35, 0, 0],
        children: [
          {
            name: 'ah_m',
            type: 'Sphere',
            size: [0.118],
            position: [0, 0.059, 0],
            thetaLength: Math.PI / 2,
            materialId: 'hair_black',
            segments: [12, 10],
            side: 2,
          },
        ],
      },
    },
    ponytail_f: {
      parent: 'head',
      node: {
        type: 'Group',
        position: [0, 0.04, -0.105],
        children: [
          {
            name: 'ah_pt',
            type: 'Cylinder',
            size: [0.035, 0.3, 0.035],
            position: [0, -0.15, -0.03],
            rotation: [0.2, 0, 0],
            materialId: 'hair_black',
            side: 2,
          },
          {
            name: 'ah_pt_tip',
            type: 'Sphere',
            size: [0.04],
            position: [0, -0.31, -0.075],
            materialId: 'hair_black',
            segments: [6, 5],
          },
          {
            name: 'ah_pt_band',
            type: 'Torus',
            size: [0.035, 0.008],
            position: [0, 0, 0],
            materialId: 'scarf_red',
          },
        ],
      },
    }, // Torus size=[r, tube]
    fringe_f: {
      parent: 'head',
      node: {
        type: 'Group',
        position: [0, 0.0542, 0],
        children: [
          {
            name: 'ah_fr_l',
            type: 'Box',
            size: [0.025, 0.04, 0.026],
            position: [-0.098, 0, 0.001],
            rotation: [0, 1.56, 0],
            materialId: 'hair_black',
          },
          {
            name: 'ah_fr_r',
            type: 'Box',
            size: [0.025, 0.04, 0.026],
            position: [0.098, 0, 0.001],
            rotation: [0, -1.56, 0],
            materialId: 'hair_black',
          },
        ],
      },
    }, // v0.79.31: 沿球面圆弧排布（x±0.098 贴头 r0.112 球面, y0.0542 球面高, 绕Y朝向头心贴合不悬浮; 缺口±0.0855 露眼±0.083）
    bun_f: {
      parent: 'head',
      node: {
        name: 'ah_bun',
        type: 'Sphere',
        size: [0.075],
        position: [0, 0.085, -0.1],
        materialId: 'hair_black',
        segments: [6, 5],
      },
    },
    red_scarf: {
      parent: 'neck',
      node: {
        type: 'Group',
        position: [0, -0.05, 0.008], // v0.79.33: z 0.1 是旧树值（颈 r0.12）——新颈 r0.04 需贴颈，0.008 微凸
        children: [
          {
            name: 'ah_sc_knot',
            type: 'Sphere',
            size: [0.03],
            position: [0, 0, 0.035], // 球心距颈轴 0.043，球 r0.03 与颈 r0.04 相交 0.027 贴住不悬空
            materialId: 'scarf_red',
            segments: [6, 5],
          },
          {
            name: 'ah_sc_l',
            type: 'Box',
            size: [0.035, 0.11, 0.014],
            position: [-0.03, -0.08, 0.05], // 后缘 0.043 贴颈
            rotation: [0, 0, 0.15],
            materialId: 'scarf_red',
          },
          {
            name: 'ah_sc_r',
            type: 'Box',
            size: [0.035, 0.095, 0.014],
            position: [0.03, -0.07, 0.05],
            rotation: [0, 0, -0.15],
            materialId: 'scarf_red',
          },
        ],
      },
    },
    polo_collar: {
      parent: 'torso',
      snap: { y: 0.7, x: 0, out: 0.012 },
      node: {
        type: 'Group',
        position: [0, 0.36, 0.19],
        children: [
          {
            name: 'ah_col_l',
            type: 'Box',
            size: [0.05, 0.038, 0.014],
            position: [-0.03, 0, 0],
            rotation: [0.3, 0, 0.2],
            materialId: 'collar_red',
          },
          {
            name: 'ah_col_r',
            type: 'Box',
            size: [0.05, 0.038, 0.014],
            position: [0.03, 0, 0],
            rotation: [0.3, 0, -0.2],
            materialId: 'collar_red',
          },
        ],
      },
    },
    polo_placket: {
      parent: 'torso',
      snap: { y: 0.38, x: 0, out: 0.008 },
      node: {
        type: 'Group',
        position: [0, 0.25, 0.2],
        children: [
          {
            name: 'ah_pl',
            type: 'Box',
            size: [0.04, 0.15, 0.016],
            position: [0, 0, 0],
            materialId: '__cloth__',
          },
          {
            name: 'ah_btn1',
            type: 'Sphere',
            size: [0.015],
            position: [0, 0.045, 0.018],
            materialId: 'button_white',
            segments: [5, 4],
          },
          {
            name: 'ah_btn2',
            type: 'Sphere',
            size: [0.015],
            position: [0, -0.03, 0.018],
            materialId: 'button_white',
            segments: [5, 4],
          },
        ],
      },
    },
    polo_cuff_l: {
      // v0.79.33: 红袖口挂上臂末端（短袖口位置）——旧挂 l_forearm -0.18 落手腕
      parent: 'l_upper_arm',
      node: {
        name: 'ah_cuf_l',
        type: 'Cylinder',
        size: [0.09, 0.06, 0.09],
        position: [0, -0.07, 0], // 渲染 y=-0.07+0.2=0.13=短袖底（上臂 0..0.2475）
        materialId: 'collar_red',
      },
    },
    polo_cuff_r: {
      parent: 'r_upper_arm',
      node: {
        name: 'ah_cuf_r',
        type: 'Cylinder',
        size: [0.09, 0.06, 0.09],
        position: [0, -0.07, 0],
        materialId: 'collar_red',
      },
    },
    school_badge: {
      parent: 'torso',
      snap: { y: 0.56, x: -0.04, out: 0.005 },
      node: {
        name: 'ah_badge',
        type: 'Plane',
        size: [0.045, 0.045],
        position: [-0.14, 0.14, 0.2],
        materialId: 'school_badge',
      },
    }, // Plane size=[w,h]
    shoulder_stripes: {
      parent: 'torso',
      snap: { y: 0.6, x: 0.04, out: 0.005 },
      node: {
        name: 'ah_str',
        type: 'Plane',
        size: [0.07, 0.09],
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
        size: [0.18, 0.2, 0.22],
        position: [0, -0.06, 0], // 上移 0.04（渲染 y=position+0.2 补偿）：裤顶盖入骨盆下沿（v0.79.30 消除骨盆间隙）
        materialId: 'shorts_red',
        children: [
          // 白色侧缝线（运动短裤外侧白条）：贴父 Box 外侧面，x 位置由 applyWrapScale 按 wrap 半宽吸附
          // （mirrorX 递归取反 → r 侧白条贴 r 腿外侧面）；_deco 跳过 wrap 尺寸改写
          {
            name: 'ah_sm_seam',
            type: 'Box',
            size: [0.006, 0.18, 0.028],
            position: [0.09, 0, 0],
            materialId: 'button_white',
            _deco: 1,
          },
        ],
      },
    },
    pleated_skirt_f: {
      parent: 'pelvis',
      node: {
        name: 'ah_skirt',
        type: 'EllipFrustum',
        size: [0.157, 0.295, 0.187, 0.105], // [顶X半轴, 高, 底圆半径, 顶Z半轴]；实际由 WRAP 派生
        position: [0, -0.025, 0.02], // v0.79.34c 顶保持 0.1225，裙底 -0.1725 = 膝(-0.223)+0.05（膝上5cm）
        materialId: 'shorts_red',
        segments: [16, 1],
      },
    }, // 学生短裙：椭圆顶圆台（v0.79.34c）；v0.79.34 锥心 z+0.02 前移；本版缩短 0.32→0.295（膝上5cm）
    trousers_grey: {
      // 长裤大腿段：挂腿关节（随髋转）
      // ⚠️ 渲染层位置 = position[1] − 父pivot[1]（childComp=-pivot，enemies.js buildNode）——
      // v0.79.29 调参漏算此补偿（注释算 0.115+0.23=0.345 到膝，实际髋系底沿 0.518=膝下 0.172 超长），
      // 屈膝时大腿段底角戳出小腿段侧面 Run 0.120（用户报告"上半截戳出来一截"）
      // v0.79.29 漏算补偿的修正（2026-08-16）：高 0.46→0.32 + position -0.115→-0.042
      // → 底沿真实膝(髋系-0.323=ll.pos-ulPivot+llPivot，非大腿长)下 0.052，顶沿 -0.055 不变，
      // 与小腿段(顶过膝+0.002)静态重叠 ~0.054；Run 折角底角在小腿盒外悬垂 ≤0.025（粗盖细落差）
      parent: 'l_upper_leg',
      node: {
        name: 'ah_tr_l',
        type: 'Box',
        size: [0.18, 0.32, 0.22],
        position: [0, -0.042, 0],
        materialId: 'trousers_grey',
      },
    },
    trousers_grey_calf: {
      // 长裤小腿段：挂小腿关节（随膝弯）；v0.79.29 缩短——小腿长 0.3465，裤 0.35 底≈踝
      parent: 'l_lower_leg',
      node: {
        name: 'ah_tc_l',
        type: 'Box',
        size: [0.18, 0.35, 0.22],
        position: [0, 0, 0],
        materialId: 'trousers_grey',
      },
    },
    skirt_grey: {
      parent: 'pelvis',
      node: {
        name: 'ah_gskirt',
        type: 'EllipFrustum',
        size: [0.157, 0.38, 0.187, 0.105], // [顶X半轴, 高, 底圆半径, 顶Z半轴]；实际由 WRAP 派生
        position: [0, -0.0875, 0.02], // v0.79.34 z+0.02 锥心前移（同学生裙）
        materialId: 'trousers_grey',
        segments: [16, 1],
      },
    }, // 教师中长裙：椭圆顶圆台（v0.79.34c）；v0.79.29 缩短（0.525→0.38 提升裙摆露小腿）
    shoes_blue: {
      parent: 'l_foot',
      node: {
        name: 'ah_sh_l',
        type: 'Box',
        size: [0.118, 0.055, 0.235],
        position: [0, -0.004, 0.004],
        materialId: 'shoes_blue',
      },
    }, // 注：l_foot/r_foot 各挂一只，见 buildHumanoid
    shoes_white: {
      parent: 'l_foot',
      node: {
        name: 'ah_sh_l',
        type: 'Box',
        size: [0.118, 0.055, 0.235],
        position: [0, -0.004, 0.004],
        materialId: 'shoes_white',
      },
    },
    leather_shoes: {
      parent: 'l_foot',
      node: {
        name: 'ah_sh_l',
        type: 'Box',
        size: [0.118, 0.055, 0.235],
        position: [0, -0.004, 0.004],
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
      snap: { y: 0.5, x: 0, out: 0.006 },
      node: {
        name: 'ah_tie',
        type: 'Box',
        size: [0.028, 0.15, 0.014],
        position: [0, 0.16, 0.2],
        materialId: 'tie_blue',
      },
    },
    glasses_opt: {
      parent: 'head',
      node: {
        type: 'Group',
        position: [0, 0.019, 0.097],
        children: [
          {
            name: 'ah_gl_l',
            type: 'Torus',
            size: [0.022, 0.006],
            position: [-0.03, 0, 0],
            materialId: 'frame_dark',
          },
          {
            name: 'ah_gl_bridge',
            type: 'Box',
            size: [0.034, 0.008, 0.008],
            position: [0, 0, 0],
            materialId: 'frame_dark',
          },
          {
            name: 'ah_gl_r',
            type: 'Torus',
            size: [0.022, 0.006],
            position: [0.03, 0, 0],
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
        size: [0.055, 0.007],
        position: [0, -0.012, 0],
        rotation: [Math.PI / 2, 0, 0],
        materialId: 'metal_gold',
      },
    },
    // ── v0.79.31 上衣袖子 + 血迹（平面不规则斑块：薄 Box 交叠，非立体血滴）──
    // v0.79.32：袖子加长上移盖过肩线（学生露 0.076/教师男 0.025/教师女 0.078）；血迹几何删除（改贴图）
    // 短袖白 polo（学生）：盖肩头（upper_arm 长 0.2475）
    short_sleeve_white: {
      parent: 'l_upper_arm',
      node: {
        type: 'Group',
        position: [0, 0, 0],
        children: [
          { name: 'ah_ssw_l', type: 'Box', size: [0.1, 0.22, 0.1], position: [0, 0.04, 0], materialId: 'polo_white' },
        ],
      },
    },
    // 短袖粉 T（教师女）
    short_sleeve_pink: {
      parent: 'l_upper_arm',
      node: {
        type: 'Group',
        position: [0, 0, 0],
        children: [
          { name: 'ah_ssp_l', type: 'Box', size: [0.1, 0.22, 0.1], position: [0, 0.06, 0], materialId: 'pink_tee' },
        ],
      },
    },
    // 长袖蓝衬衫（教师男）：上臂段 + 前臂段（v0.79.31 位置下移盖全臂——上臂长 0.275/前臂 0.255）
    long_sleeve_upper_blue: {
      parent: 'l_upper_arm',
      node: {
        type: 'Group',
        position: [0, 0, 0],
        children: [
          { name: 'ah_lsb_u', type: 'Box', size: [0.1, 0.34, 0.1], position: [0, 0, 0], materialId: 'shirt_blue' },
        ],
      },
    },
    long_sleeve_fore_blue: {
      parent: 'l_forearm',
      node: {
        type: 'Group',
        position: [0, 0, 0],
        children: [
          { name: 'ah_lsb_f', type: 'Box', size: [0.08, 0.3, 0.08], position: [0, -0.05, 0], materialId: 'shirt_blue' },
        ],
      },
    },

    // ══ 人类士兵 addon（v0.79.37 预研：__cloth__ 占位 = 变体 materials.cloth 联动换装）══
    // 长袖上臂段（通用）：保安藏青 / 士兵迷彩由 variant.materials.cloth 决定
    long_sleeve_u: {
      parent: 'l_upper_arm',
      node: {
        type: 'Group',
        position: [0, 0, 0],
        children: [
          { name: 'ah_lsu', type: 'Box', size: [0.1, 0.34, 0.1], position: [0, 0, 0], materialId: '__cloth__' },
        ],
      },
    },
    // 长袖前臂段（通用）
    long_sleeve_f: {
      parent: 'l_forearm',
      node: {
        type: 'Group',
        position: [0, 0, 0],
        children: [
          { name: 'ah_lsf', type: 'Box', size: [0.08, 0.3, 0.08], position: [0, -0.05, 0], materialId: '__cloth__' },
        ],
      },
    },
    // 长裤大腿段（通用）
    long_trouser_thigh: {
      parent: 'l_upper_leg',
      node: {
        name: 'ah_ltq_l',
        type: 'Box',
        size: [0.18, 0.32, 0.22],
        position: [0, -0.042, 0],
        materialId: '__cloth__',
      },
    },
    // 长裤小腿段（通用）
    long_trouser_calf: {
      parent: 'l_lower_leg',
      node: {
        name: 'ah_ltq_c',
        type: 'Box',
        size: [0.18, 0.35, 0.22],
        position: [0, 0, 0],
        materialId: '__cloth__',
      },
    },
    // 作战靴（士兵）：高帮盖踝 + 鞋底
    combat_boots: {
      parent: 'l_foot',
      node: {
        type: 'Group',
        position: [0, 0, 0],
        children: [
          { name: 'ah_cb', type: 'Box', size: [0.125, 0.11, 0.26], position: [0, 0.02, -0.005], materialId: 'boot_black' },
          { name: 'ah_cb_sole', type: 'Box', size: [0.132, 0.022, 0.272], position: [0, -0.042, -0.005], materialId: 'belt_black' },
        ],
      },
    },
    // 战术腰带（保安/士兵通用）：黑腰带 + 银色皮带扣
    duty_belt: {
      parent: 'pelvis',
      node: {
        type: 'Group',
        position: [0, 0.05, 0],
        children: [
          { name: 'ah_belt', type: 'Box', size: [0.335, 0.05, 0.25], position: [0, 0, 0], materialId: 'belt_black' },
          { name: 'ah_belt_bk', type: 'Box', size: [0.055, 0.038, 0.018], position: [0, 0, 0.126], materialId: 'strap_silver' },
        ],
      },
    },
    // 战术背心（士兵）：绿背心主体 + 3 个卡其弹匣袋
    tac_vest: {
      parent: 'torso_upper',
      node: {
        type: 'Group',
        position: [0, 0.015, 0.005],
        children: [
          { name: 'ah_tv', type: 'Box', size: [0.28, 0.2, 0.24], position: [0, 0, 0], materialId: 'vest_green' },
          { name: 'ah_tv_p1', type: 'Box', size: [0.052, 0.075, 0.032], position: [-0.072, -0.02, 0.128], materialId: 'pouch_khaki' },
          { name: 'ah_tv_p2', type: 'Box', size: [0.052, 0.075, 0.032], position: [0, -0.02, 0.132], materialId: 'pouch_khaki' },
          { name: 'ah_tv_p3', type: 'Box', size: [0.052, 0.075, 0.032], position: [0.072, -0.02, 0.128], materialId: 'pouch_khaki' },
        ],
      },
    },
    // 荧光背心（保安）：黄绿高可视背心 + 两条银色反光带
    guard_vest: {
      parent: 'torso_upper',
      node: {
        type: 'Group',
        position: [0, 0.012, 0.006],
        children: [
          { name: 'ah_gv', type: 'Box', size: [0.29, 0.23, 0.25], position: [0, 0, 0], materialId: 'vest_hiviz' },
          { name: 'ah_gv_s1', type: 'Box', size: [0.296, 0.032, 0.256], position: [0, 0.045, 0], materialId: 'strap_silver' },
          { name: 'ah_gv_s2', type: 'Box', size: [0.296, 0.032, 0.256], position: [0, -0.045, 0], materialId: 'strap_silver' },
        ],
      },
    },
    // 作战头盔（士兵）：半球盔 + 前沿帽檐
    // ⚠️ thetaLength π/2 半球经 geo.center() 后 bbox 中心在原点（视觉底面 = mesh.y − r/2，
    // 与 hair 同口径）——mesh.y 必须 = 期望底沿 + r/2，否则盔整体下沉半半径、头刺破盔顶（v0.79.37 修复）
    // 底沿 0.055 高于眼位 y0.019 约 2.6cm（眉线上方，不压眼）；盔顶 0.155 > 头顶 0.0893 余量 0.066
    combat_helmet: {
      parent: 'head',
      node: {
        type: 'Group',
        position: [0, 0, -0.004],
        children: [
          {
            name: 'ah_hlm',
            type: 'Sphere',
            size: [0.1],
            position: [0, 0.105, 0],
            thetaLength: Math.PI / 2,
            materialId: 'helmet_olive',
            segments: [12, 8],
            side: 2,
          },
          { name: 'ah_hlm_brim', type: 'Box', size: [0.17, 0.014, 0.05], position: [0, 0.052, 0.095], materialId: 'helmet_olive' },
        ],
      },
    },
    // 大檐帽（保安）：圆顶 + 金色帽带 + 全圆宽檐 + 前帽徽（半球 center() 补偿同上）
    // 檐盘 y 0.05 高于眼位 0.019 约 2.3cm；dome 底 0.053 / 顶 0.151 > 头顶 0.0893 余量 0.062
    guard_cap: {
      parent: 'head',
      node: {
        type: 'Group',
        position: [0, 0, 0],
        children: [
          {
            name: 'ah_gc_dome',
            type: 'Sphere',
            size: [0.098],
            position: [0, 0.102, 0],
            thetaLength: Math.PI / 2,
            materialId: 'uniform_navy',
            segments: [12, 8],
            side: 2,
          },
          { name: 'ah_gc_band', type: 'Torus', size: [0.096, 0.007], position: [0, 0.053, 0], rotation: [Math.PI / 2, 0, 0], materialId: 'metal_gold' },
          { name: 'ah_gc_brim', type: 'Cylinder', size: [0.116, 0.013, 0.116], position: [0, 0.05, 0.008], materialId: 'uniform_navy', segments: [14] },
          { name: 'ah_gc_badge', type: 'Sphere', size: [0.016], position: [0, 0.085, 0.09], materialId: 'metal_gold', segments: [6, 5] },
        ],
      },
    },
    // ── 武器（挂 r_hand，不参与 mirrorX；手局部 +Z=体前，臂下垂时呈腰际持械）──
    // v0.79.37b: Group 命名（动画 O 轨道按名收集武器节点）；握把 rotation.x 取正 = 底端向枪托侧弯（-Z）
    // 警棍（26" 伸缩棍展开 0.51 单位）：橡胶柄 + 钢杆 + 挥击时随手动
    weapon_baton: {
      parent: 'r_hand',
      node: {
        type: 'Group',
        name: 'ah_wp_baton',
        position: [0, -0.02, 0.03],
        rotation: [-0.25, 0, 0],
        children: [
          { name: 'ah_wp_btn_grip', type: 'Cylinder', size: [0.021, 0.13, 0.024], position: [0, -0.065, 0], materialId: 'gun_dark' },
          { name: 'ah_wp_btn_knob', type: 'Sphere', size: [0.026], position: [0, 0.004, 0], materialId: 'gun_dark', segments: [8, 6] },
          { name: 'ah_wp_btn_shaft', type: 'Cylinder', size: [0.012, 0.36, 0.012], position: [0, -0.3, 0], materialId: 'gun_metal' },
          { name: 'ah_wp_btn_tip', type: 'Sphere', size: [0.013], position: [0, -0.485, 0], materialId: 'gun_metal', segments: [6, 5] },
        ],
      },
    },
    // 突击步枪（AK 风格 0.67 单位）：机匣 + 枪管 + 木护木 + 弧形弹匣(前弯) + 木枪托 + 枪口火焰(射击轨道点亮)
    weapon_rifle: {
      parent: 'r_hand',
      node: {
        type: 'Group',
        name: 'ah_wp_rifle',
        position: [0.05, -0.02, 0.05], // v0.79.37c x+0.05 枪身向中线（真实据枪护木在中线，左手可及）
        children: [
          { name: 'ah_wp_rf_recv', type: 'Box', size: [0.05, 0.075, 0.2], position: [0, 0, 0], materialId: 'gun_metal' },
          { name: 'ah_wp_rf_barrel', type: 'Cylinder', size: [0.013, 0.24, 0.013], position: [0, 0.008, 0.3], rotation: [Math.PI / 2, 0, 0], materialId: 'gun_dark' },
          { name: 'ah_wp_rf_muzzle', type: 'Cylinder', size: [0.018, 0.05, 0.018], position: [0, 0.008, 0.425], rotation: [Math.PI / 2, 0, 0], materialId: 'gun_metal' },
          { name: 'ah_wp_rf_hguard', type: 'Box', size: [0.05, 0.055, 0.15], position: [0, -0.002, 0.16], materialId: 'wood_stock' },
          { name: 'ah_wp_rf_gastube', type: 'Cylinder', size: [0.008, 0.16, 0.008], position: [0, 0.042, 0.18], rotation: [Math.PI / 2, 0, 0], materialId: 'gun_metal' },
          { name: 'ah_wp_rf_frontsight', type: 'Box', size: [0.014, 0.035, 0.014], position: [0, 0.05, 0.26], materialId: 'gun_metal' },
          { name: 'ah_wp_rf_rearsight', type: 'Box', size: [0.03, 0.02, 0.03], position: [0, 0.05, -0.04], materialId: 'gun_metal' },
          { name: 'ah_wp_rf_mag', type: 'Box', size: [0.036, 0.16, 0.062], position: [0, -0.1, 0.05], rotation: [-0.4, 0, 0], materialId: 'gun_metal' },
          { name: 'ah_wp_rf_grip', type: 'Box', size: [0.032, 0.08, 0.046], position: [0, -0.078, -0.06], rotation: [0.3, 0, 0], materialId: 'gun_dark' },
          { name: 'ah_wp_rf_stock', type: 'Box', size: [0.042, 0.066, 0.17], position: [0, -0.018, -0.185], rotation: [0.06, 0, 0], materialId: 'wood_stock' },
          { name: 'ah_wp_rf_flash', type: 'Sphere', size: [0.075], position: [0, 0.008, 0.475], materialId: 'flash_orange', segments: [6, 5], _fx: 1, scale: [0.001, 0.001, 0.001] },
        ],
      },
    },
    // 泵动霰弹枪（0.77 单位）：机匣 + 枪管 + 下置管状弹仓 + 木泵护木 + 木枪托 + 枪口火焰
    // ⚠️ 部件 z 坐标首尾相接（v0.79.37 修复脱节）；v0.79.37b 握把 +0.38 底端向枪托
    weapon_shotgun: {
      parent: 'r_hand',
      node: {
        type: 'Group',
        name: 'ah_wp_shotgun',
        position: [0.05, -0.02, 0.05], // v0.79.37c x+0.05 同步枪中线偏移
        children: [
          { name: 'ah_wp_sg_recv', type: 'Box', size: [0.05, 0.068, 0.16], position: [0, 0, 0], materialId: 'gun_metal' },
          { name: 'ah_wp_sg_barrel', type: 'Cylinder', size: [0.015, 0.34, 0.015], position: [0, 0.015, 0.25], rotation: [Math.PI / 2, 0, 0], materialId: 'gun_dark' },
          { name: 'ah_wp_sg_magtube', type: 'Cylinder', size: [0.013, 0.28, 0.013], position: [0, -0.038, 0.2], rotation: [Math.PI / 2, 0, 0], materialId: 'gun_metal' },
          { name: 'ah_wp_sg_pump', type: 'Box', size: [0.058, 0.052, 0.11], position: [0, -0.036, 0.16], materialId: 'wood_stock' },
          { name: 'ah_wp_sg_grip', type: 'Box', size: [0.036, 0.075, 0.05], position: [0, -0.072, -0.045], rotation: [0.38, 0, 0], materialId: 'wood_stock' },
          { name: 'ah_wp_sg_stock', type: 'Box', size: [0.042, 0.072, 0.17], position: [0, -0.028, -0.168], rotation: [0.1, 0, 0], materialId: 'wood_stock' },
          { name: 'ah_wp_sg_bead', type: 'Sphere', size: [0.008], position: [0, 0.033, 0.425], materialId: 'gun_metal', segments: [5, 4] },
          { name: 'ah_wp_sg_flash', type: 'Sphere', size: [0.08], position: [0, 0.015, 0.448], materialId: 'flash_orange', segments: [6, 5], _fx: 1, scale: [0.001, 0.001, 0.001] },
        ],
      },
    },
    // 反坦克火箭筒（RPG-7 风格 0.98 单位）：40mm 发射管 + 尾喷喇叭口 + 85mm 超口径锥形战斗部
    // v0.79.37c: 挂 torso_upper 背后横背（视觉 y = 数据 y + 0.145 pivot 补偿）——管轴 Euler XYZ
    // y=π/2 → 纯沿 X 左右向（战斗部 +X 伸右肩外），z=-0.17 贴背外不穿身体；
    // 战斗部三件包 ah_wp_rpg_warhead（发射轨道整组射出）；前后火焰 _fx 默认隐藏
    weapon_rpg: {
      parent: 'torso_upper',
      node: {
        type: 'Group',
        name: 'ah_wp_rpg',
        position: [-0.02, 0, -0.2], // 视觉 y +0.145 pivot 补偿
        rotation: [-1.5, -0.95, 0], // 斜背（右肩露战斗部）：管轴左下→右上 (-0.81,0.58,0.04)，战斗部从右肩上露出
        children: [
          { name: 'ah_wp_rpg_tube', type: 'Cylinder', size: [0.03, 0.62, 0.03], position: [0, 0, 0.05], rotation: [Math.PI / 2, 0, 0], materialId: 'rpg_olive' },
          { name: 'ah_wp_rpg_venturi', type: 'Cylinder', size: [0.028, 0.11, 0.057], position: [0, 0, -0.315], rotation: [Math.PI / 2, 0, 0], materialId: 'gun_metal' },
          { name: 'ah_wp_rpg_heat', type: 'Cylinder', size: [0.04, 0.18, 0.04], position: [0, 0, -0.02], rotation: [Math.PI / 2, 0, 0], materialId: 'rpg_olive' },
          {
            type: 'Group',
            name: 'ah_wp_rpg_warhead',
            position: [0, 0, 0],
            children: [
              { name: 'ah_wp_rpg_wh_body', type: 'Cylinder', size: [0.066, 0.15, 0.066], position: [0, 0, 0.42], rotation: [Math.PI / 2, 0, 0], materialId: 'rpg_olive' },
              { name: 'ah_wp_rpg_wh_cone', type: 'Cylinder', size: [0.02, 0.15, 0.066], position: [0, 0, 0.56], rotation: [Math.PI / 2, 0, 0], materialId: 'rpg_olive' },
              { name: 'ah_wp_rpg_wh_tip', type: 'Cylinder', size: [0.002, 0.07, 0.02], position: [0, 0, 0.66], rotation: [Math.PI / 2, 0, 0], materialId: 'warhead_tip' },
            ],
          },
          { name: 'ah_wp_rpg_grip_f', type: 'Box', size: [0.034, 0.08, 0.05], position: [0, -0.075, 0.1], rotation: [0.15, 0, 0], materialId: 'gun_dark' },
          { name: 'ah_wp_rpg_grip_r', type: 'Box', size: [0.034, 0.08, 0.05], position: [0, -0.075, -0.1], rotation: [0.15, 0, 0], materialId: 'gun_dark' },
          { name: 'ah_wp_rpg_sight', type: 'Box', size: [0.032, 0.055, 0.07], position: [0, 0.062, -0.05], materialId: 'gun_dark' },
          { name: 'ah_wp_rpg_flash_f', type: 'Sphere', size: [0.09], position: [0, 0, 0.5], materialId: 'flash_orange', segments: [6, 5], _fx: 1, scale: [0.001, 0.001, 0.001] },
          { name: 'ah_wp_rpg_flash_b', type: 'Sphere', size: [0.08], position: [0, 0, -0.42], materialId: 'flash_orange', segments: [6, 5], _fx: 1, scale: [0.001, 0.001, 0.001] },
        ],
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
  // 直立基线：人类敌人不一定是丧尸，基础骨架/版本动画一律直立；
  // 丧尸驼背（torso/neck 前弯 + head 歪）在 MODELS 烘焙层注入（见文件尾 ZOMBIE_HUNCH）
  const REST_POSES = {
    'torso:x': 0,
    'neck:x': 0,
    'head:z': 0,
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
    // 体型派生：hunch → torso.rotation.x 直接叠加（0=直立，正值=驼背量；动画启动后由 rest 基线接管）
    if (node.name === 'torso' && node.rotation) {
      out.rotation = [node.rotation[0] + params.hunch, node.rotation[1], node.rotation[2]];
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
  // 裙变体骨盆顶深上限（v0.79.34c）：骨盆顶面 0.3×0.2 的角部(距轴0.18)会刺出椭圆顶裙壁，
  // 收到 0.14 后角部 ~0.16 与壁齐平——骨盆是被裙+下躯干完全遮盖的隐形内部件，收浅零视觉代价
  var SKIRT_PELVIS_TD = 0.14;
  // 裙变体下躯干（衬衫盒）底面钳制（v0.79.34c）：底深 0.2+底偏 -0.04 的后角(距轴0.215)刺出裙壁
  // ~0.08；钳到底深 0.14/底偏 -0.01 后角刺出 ~0.03（与圆台版持平）。衬衫底面只在背后侧收 5cm，
  // 正面不变（底前缘 0.065 保持）；教师 torso_lower 与裙同色且语义"扎进裙"，钳制只会更正确
  var SKIRT_TLOWER_BD = 0.14;
  var SKIRT_TLOWER_BZ = -0.01;
  const WRAP_ADDONS = {
    polo_cuff_l: { limb: 'l_upper_arm', gap: 0.004 }, // v0.79.33: 改挂上臂
    polo_cuff_r: { limb: 'r_upper_arm', gap: 0.004 },
    shorts_m: { limb: 'l_upper_leg', gap: 0.016 },
    trousers_grey: { limb: 'l_upper_leg', gap: 0.016 },
    trousers_grey_calf: { limb: 'l_lower_leg', gap: 0.016 },
    // 裙 = 椭圆顶圆台（v0.79.34c，用户方案）：底面圆 + 顶面椭圆
    //   顶面 rx = 腿r+0.10≈0.157（X 向盖住骨盆半宽 0.15）；rz = rx×0.67≈0.105（贴合躯干深度）
    //   ——旧圆台顶面正/背面各凸出躯干 ~0.084/0.044（圆弧鼓包），椭圆顶正面降到 0.032、背面藏进衬衫下摆内
    //   骨盆顶深同步收到 0.14（隐形内部件，防角部刺出椭圆壁，见装配段 SKIRT_PELVIS_TD）
    //   底面圆 rBottom = 腿r+0.13（v0.79.34 跟腿耦合+锥心前移口径，逐帧仿真需求 0.173/0.174+余量）
    pleated_skirt_f: { limb: 'l_upper_leg', gap: 0.1, gapBottom: 0.13, zRatio: 0.67 },
    skirt_grey: { limb: 'l_upper_leg', gap: 0.1, gapBottom: 0.13, zRatio: 0.67 },
    // v0.79.31 袖子（半径联动；短袖盖肩头 / 长袖盖整臂）v0.79.33: gap 0.008→0.004 稍粗一点即可
    short_sleeve_white: { limb: 'l_upper_arm', gap: 0.004 },
    short_sleeve_pink: { limb: 'l_upper_arm', gap: 0.004 },
    long_sleeve_upper_blue: { limb: 'l_upper_arm', gap: 0.004 },
    long_sleeve_fore_blue: { limb: 'l_forearm', gap: 0.004 },
    // 人类士兵通用长袖/长裤（__cloth__ 占位随变体换装）
    long_sleeve_u: { limb: 'l_upper_arm', gap: 0.004 },
    long_sleeve_f: { limb: 'l_forearm', gap: 0.004 },
    long_trouser_thigh: { limb: 'l_upper_leg', gap: 0.016 },
    long_trouser_calf: { limb: 'l_lower_leg', gap: 0.016 },
  };
  // 双侧裤腿部件：addon 双挂到左右腿关节（裤腿随腿旋转防穿模；Box 中心 x=0 无需镜像）
  const DUAL_LEG_ADDONS = {
    shorts_m: ['l_upper_leg', 'r_upper_leg'],
    trousers_grey: ['l_upper_leg', 'r_upper_leg'],
    trousers_grey_calf: ['l_lower_leg', 'r_lower_leg'],
    long_trouser_thigh: ['l_upper_leg', 'r_upper_leg'],
    long_trouser_calf: ['l_lower_leg', 'r_lower_leg'],
  };
  // v0.79.31 双侧袖部件（手臂双挂；Box 中心 x=0 无需镜像）
  const DUAL_LIMB_ADDONS = {
    short_sleeve_white: ['l_upper_arm', 'r_upper_arm'],
    short_sleeve_pink: ['l_upper_arm', 'r_upper_arm'],
    long_sleeve_upper_blue: ['l_upper_arm', 'r_upper_arm'],
    long_sleeve_fore_blue: ['l_forearm', 'r_forearm'],
    long_sleeve_u: ['l_upper_arm', 'r_upper_arm'],
    long_sleeve_f: ['l_forearm', 'r_forearm'],
  };
  // 双脚鞋类部件（l_foot + r_foot 各挂一只）
  const FOOT_ADDONS = ['shoes_blue', 'shoes_white', 'leather_shoes', 'combat_boots'];
  // addon 子树递归重算包裹尺寸：Cylinder 半径 / EllipFrustum 顶椭圆+底圆 / Box 全宽深 = 肢体半径 + gap
  // gapBottom 用于锥形裙摆；zRatio 用于 EllipFrustum 顶面 Z 半轴 = (腿r+gap)×zRatio
  // _deco 子节点（缝线等装饰）：尺寸不改写，position.x 吸附到父 Box wrap 后外侧面（符号保留，mirror 已定侧）
  function applyWrapScale(node, rLimb, gap, gapBottom, zRatio) {
    if (node._deco) {
      if (node.position) node.position[0] = Math.sign(node.position[0] || 1) * (rLimb + gap - 0.001);
      return;
    }
    if (node.size) {
      if (node.type === 'Cylinder') {
        node.size = [rLimb + gap, node.size[1], rLimb + (gapBottom != null ? gapBottom : gap)];
      } else if (node.type === 'EllipFrustum') {
        var rz = +((rLimb + gap) * (zRatio || 0.67)).toFixed(4);
        node.size = [rLimb + gap, node.size[1], rLimb + (gapBottom != null ? gapBottom : gap), rz];
      } else if (node.type === 'Box') {
        node.size = [(rLimb + gap) * 2, node.size[1], (rLimb + gap) * 2];
      }
    }
    if (node.children) node.children.forEach((c) => applyWrapScale(c, rLimb, gap, gapBottom, zRatio));
  }

  // wrapMax 收集用：子树里第一个非 _deco 的带 size 节点（WRAP addon 可能是 Group 包 Box / 直接 Box / Box 带 deco 缝线子件）
  function firstWrapNode(n) {
    if (n.size && !n._deco) return n;
    if (n.children) for (var i = 0; i < n.children.length; i++) { var r = firstWrapNode(n.children[i]); if (r) return r; }
    return null;
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
      // shoes_* / leather_shoes / combat_boots 等双脚 addon：同时挂 l_foot 与 r_foot
      // 裤腿（short/long/calf）：双挂到左右腿关节（随腿旋转防迈步穿模）
      const parents =
        DUAL_LEG_ADDONS[key] ||
        DUAL_LIMB_ADDONS[key] ||
        (FOOT_ADDONS.indexOf(key) >= 0 ? ['l_foot', 'r_foot'] : [def.parent]);
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
            applyWrapScale(clone, limbNode.size[0], wrap.gap, wrap.gapBottom, wrap.zRatio);
            // 裙变体：骨盆顶深 + 下躯干底面钳制（防方盒角部刺出椭圆裙壁，语义见 WRAP_ADDONS 段常量）
            if (clone.type === 'EllipFrustum') {
              const pn = findNode(tree, 'pelvis');
              if (pn && pn.size && pn.size[4] > SKIRT_PELVIS_TD) pn.size[4] = SKIRT_PELVIS_TD;
              const tl = findNode(tree, 'torso_lower');
              if (tl && tl.size) {
                if (tl.size[2] > SKIRT_TLOWER_BD) tl.size[2] = SKIRT_TLOWER_BD;
                if (tl.size[8] < SKIRT_TLOWER_BZ) tl.size[8] = SKIRT_TLOWER_BZ;
              }
            }
            // 收集包裹宽度（下摆包裹保证用）：Box 半宽
            // v0.79.34b 裙(Cylinder/EllipFrustum)不参与——wrapMax 是"骨盆须容纳的方盒内衣半宽"，
            // 裙是圆形外层（自身包裹骨盆），混入会把骨盆撑成 needFull×needFull 方板反而捅穿裙壁
            const wrapFirst = firstWrapNode(clone);
            if (wrapFirst && wrapFirst.size && wrapFirst.type === 'Box') {
              const w = wrapFirst.size[0] / 2;
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
    actions: {"Idle":[{"kind":"O","joint":"torso","prop":"rotation","axis":"z","restKey":null,"keys":[{"t":0,"v":0},{"t":0.5,"v":0.03},{"t":1,"v":0}]},{"kind":"O","joint":"pelvis","prop":"position","axis":"y","restKey":"pelvis:y","keys":[{"t":0,"v":0},{"t":0.5,"v":0.02},{"t":1,"v":0}]},{"kind":"P","joint":"head","prop":"rotation","axis":"z","restKey":"head:z","keys":[{"t":0,"v":0},{"t":0.5,"v":-0.04},{"t":1,"v":0}]}],"Walk":[{"kind":"O","joint":"pelvis","prop":"position","axis":"y","restKey":"pelvis:y","keys":[{"t":0,"v":0},{"t":0.25,"v":0.03},{"t":0.5,"v":0},{"t":0.75,"v":0.03},{"t":1,"v":0}]},{"kind":"P","joint":"l_upper_leg","prop":"rotation","axis":"x","restKey":null,"keys":[{"t":0,"v":-0.45},{"t":0.25,"v":-0.08},{"t":0.5,"v":0.12},{"t":0.75,"v":0.25},{"t":1,"v":-0.45}]},{"kind":"P","joint":"r_upper_leg","prop":"rotation","axis":"x","restKey":null,"keys":[{"t":0,"v":0.12},{"t":0.25,"v":0.25},{"t":0.5,"v":-0.45},{"t":0.75,"v":-0.08},{"t":1,"v":0.12}]},{"kind":"P","joint":"l_lower_leg","prop":"rotation","axis":"x","restKey":null,"keys":[{"t":0,"v":-0.3},{"t":0.25,"v":0.12},{"t":0.5,"v":0.37},{"t":0.75,"v":1.35},{"t":1,"v":-0.3}]},{"kind":"P","joint":"r_lower_leg","prop":"rotation","axis":"x","restKey":null,"keys":[{"t":0,"v":0.37},{"t":0.25,"v":1.35},{"t":0.5,"v":-0.3},{"t":0.75,"v":0.12},{"t":1,"v":0.37}]},{"kind":"P","joint":"l_upper_arm","prop":"rotation","axis":"x","restKey":null,"keys":[{"t":0,"v":0.35},{"t":0.25,"v":0.1},{"t":0.5,"v":-0.35},{"t":0.75,"v":0.1},{"t":1,"v":0.35}]},{"kind":"P","joint":"r_upper_arm","prop":"rotation","axis":"x","restKey":null,"keys":[{"t":0,"v":-0.35},{"t":0.25,"v":-0.1},{"t":0.5,"v":0.35},{"t":0.75,"v":-0.1},{"t":1,"v":-0.35}]}],"Run":[{"kind":"O","joint":"torso","prop":"rotation","axis":"x","restKey":null,"keys":[{"t":0,"v":0.3},{"t":0.5,"v":0.15},{"t":1,"v":0.3}]},{"kind":"O","joint":"pelvis","prop":"position","axis":"y","restKey":"pelvis:y","keys":[{"t":0,"v":0},{"t":0.5,"v":0.08},{"t":1,"v":0}]},{"kind":"P","joint":"l_upper_leg","prop":"rotation","axis":"x","restKey":null,"keys":[{"t":0,"v":-0.85},{"t":0.25,"v":-0.2},{"t":0.5,"v":0.15},{"t":0.75,"v":0.35},{"t":1,"v":-0.85}]},{"kind":"P","joint":"r_upper_leg","prop":"rotation","axis":"x","restKey":null,"keys":[{"t":0,"v":0.15},{"t":0.25,"v":0.35},{"t":0.5,"v":-0.85},{"t":0.75,"v":-0.2},{"t":1,"v":0.15}]},{"kind":"P","joint":"l_lower_leg","prop":"rotation","axis":"x","restKey":null,"keys":[{"t":0,"v":0.5},{"t":0.25,"v":0.25},{"t":0.5,"v":0.75},{"t":0.75,"v":1.85},{"t":1,"v":0.5}]},{"kind":"P","joint":"r_lower_leg","prop":"rotation","axis":"x","restKey":null,"keys":[{"t":0,"v":0.75},{"t":0.25,"v":1.85},{"t":0.5,"v":0.5},{"t":0.75,"v":0.25},{"t":1,"v":0.75}]},{"kind":"P","joint":"l_upper_arm","prop":"rotation","axis":"x","restKey":null,"keys":[{"t":0,"v":0.5},{"t":0.25,"v":0.15},{"t":0.5,"v":-0.5},{"t":0.75,"v":0.15},{"t":1,"v":0.5}]},{"kind":"P","joint":"r_upper_arm","prop":"rotation","axis":"x","restKey":null,"keys":[{"t":0,"v":-0.5},{"t":0.25,"v":-0.15},{"t":0.5,"v":0.5},{"t":0.75,"v":-0.15},{"t":1,"v":-0.5}]},{"kind":"P","joint":"l_forearm","prop":"rotation","axis":"x","restKey":null,"keys":[{"t":0,"v":-2.1},{"t":0.25,"v":-1.75},{"t":0.5,"v":-1.55},{"t":0.75,"v":-1.75},{"t":1,"v":-2.1}]},{"kind":"P","joint":"r_forearm","prop":"rotation","axis":"x","restKey":null,"keys":[{"t":0,"v":-1.55},{"t":0.25,"v":-1.75},{"t":0.5,"v":-2.1},{"t":0.75,"v":-1.75},{"t":1,"v":-1.55}]},{"kind":"P","joint":"l_forearm","prop":"rotation","axis":"z","restKey":null,"keys":[{"t":0,"v":-0.06},{"t":0.25,"v":-0.13},{"t":0.5,"v":-0.2},{"t":0.75,"v":-0.13},{"t":1,"v":-0.06}]},{"kind":"P","joint":"r_forearm","prop":"rotation","axis":"z","restKey":null,"keys":[{"t":0,"v":0.2},{"t":0.25,"v":0.13},{"t":0.5,"v":0.06},{"t":0.75,"v":0.13},{"t":1,"v":0.2}]}],"Swing":[{"kind":"O","joint":"torso","prop":"rotation","axis":"x","restKey":"torso:x","keys":[{"t":0,"v":0},{"t":0.45,"v":-0.12},{"t":0.55,"v":0.3},{"t":0.78,"v":0.08},{"t":1,"v":0}]},{"kind":"P","joint":"torso_upper","prop":"rotation","axis":"x","restKey":null,"keys":[{"t":0,"v":0},{"t":0.45,"v":0.02},{"t":0.55,"v":0.42},{"t":0.78,"v":0.12},{"t":1,"v":0}]},{"kind":"P","joint":"l_upper_arm","prop":"rotation","axis":"x","restKey":null,"keys":[{"t":0,"v":-0.1},{"t":0.45,"v":-1.8},{"t":0.55,"v":-0.4},{"t":1,"v":-0.1}]},{"kind":"P","joint":"r_upper_arm","prop":"rotation","axis":"x","restKey":null,"keys":[{"t":0,"v":-0.1},{"t":0.45,"v":-1.8},{"t":0.55,"v":-0.4},{"t":1,"v":-0.1}]},{"kind":"P","joint":"l_forearm","prop":"rotation","axis":"x","restKey":null,"keys":[{"t":0,"v":-1.6},{"t":0.45,"v":-0.2},{"t":0.55,"v":-0.5},{"t":1,"v":-1.6}]},{"kind":"P","joint":"r_forearm","prop":"rotation","axis":"x","restKey":null,"keys":[{"t":0,"v":-1.6},{"t":0.45,"v":-0.2},{"t":0.55,"v":-0.5},{"t":1,"v":-1.6}]}],"Punch":[{"kind":"O","joint":"torso","prop":"rotation","axis":"y","restKey":null,"keys":[{"t":0,"v":0},{"t":0.45,"v":-0.32},{"t":0.55,"v":0.52},{"t":0.65,"v":0.45},{"t":1,"v":0}]},{"kind":"O","joint":"torso","prop":"rotation","axis":"x","restKey":"torso:x","keys":[{"t":0,"v":0.04},{"t":0.45,"v":-0.06},{"t":0.55,"v":0.2},{"t":0.65,"v":0.16},{"t":1,"v":0.04}]},{"kind":"P","joint":"torso_upper","prop":"rotation","axis":"y","restKey":null,"keys":[{"t":0,"v":0},{"t":0.45,"v":-0.14},{"t":0.55,"v":0.22},{"t":0.65,"v":0.18},{"t":1,"v":0}]},{"kind":"P","joint":"head","prop":"rotation","axis":"y","restKey":null,"keys":[{"t":0,"v":0},{"t":0.45,"v":0.12},{"t":0.55,"v":-0.2},{"t":0.65,"v":-0.16},{"t":1,"v":0}]},{"kind":"P","joint":"r_upper_arm","prop":"rotation","axis":"x","restKey":null,"keys":[{"t":0,"v":-0.45},{"t":0.45,"v":0.85},{"t":0.55,"v":-1.4},{"t":0.65,"v":-1.32},{"t":1,"v":-0.45}]},{"kind":"P","joint":"r_forearm","prop":"rotation","axis":"x","restKey":null,"keys":[{"t":0,"v":-1.75},{"t":0.45,"v":-2.05},{"t":0.55,"v":-0.18},{"t":0.65,"v":-0.35},{"t":1,"v":-1.75}]},{"kind":"P","joint":"l_upper_arm","prop":"rotation","axis":"x","restKey":null,"keys":[{"t":0,"v":-0.5},{"t":0.45,"v":-0.35},{"t":0.55,"v":-0.62},{"t":0.65,"v":-0.58},{"t":1,"v":-0.5}]},{"kind":"P","joint":"l_forearm","prop":"rotation","axis":"x","restKey":null,"keys":[{"t":0,"v":-1.8},{"t":0.45,"v":-1.95},{"t":0.55,"v":-1.98},{"t":0.65,"v":-1.92},{"t":1,"v":-1.8}]},{"kind":"P","joint":"l_upper_leg","prop":"rotation","axis":"x","restKey":null,"keys":[{"t":0,"v":-0.3},{"t":0.45,"v":-0.2},{"t":0.55,"v":-0.38},{"t":0.65,"v":-0.35},{"t":1,"v":-0.3}]},{"kind":"P","joint":"r_upper_leg","prop":"rotation","axis":"x","restKey":null,"keys":[{"t":0,"v":0.25},{"t":0.45,"v":0.35},{"t":0.55,"v":0.08},{"t":0.65,"v":0.12},{"t":1,"v":0.25}]},{"kind":"P","joint":"l_lower_leg","prop":"rotation","axis":"x","restKey":null,"keys":[{"t":0,"v":0.35},{"t":0.45,"v":0.28},{"t":0.55,"v":0.32},{"t":0.65,"v":0.33},{"t":1,"v":0.35}]},{"kind":"P","joint":"r_lower_leg","prop":"rotation","axis":"x","restKey":null,"keys":[{"t":0,"v":0.45},{"t":0.45,"v":0.65},{"t":0.55,"v":0.08},{"t":0.65,"v":0.15},{"t":1,"v":0.45}]},{"kind":"O","joint":"pelvis","prop":"position","axis":"y","restKey":"pelvis:y","keys":[{"t":0,"v":0},{"t":0.45,"v":-0.02},{"t":0.55,"v":-0.06},{"t":0.65,"v":-0.04},{"t":1,"v":0}]}],"Stagger":[{"kind":"O","joint":"torso","prop":"rotation","axis":"x","restKey":null,"keys":[{"t":0,"v":0},{"t":0.2,"v":-0.3},{"t":1,"v":0}]},{"kind":"P","joint":"head","prop":"rotation","axis":"x","restKey":null,"keys":[{"t":0,"v":0},{"t":0.15,"v":-0.4},{"t":1,"v":0}]}],"Die":[{"kind":"P","joint":"root","prop":"rotation","axis":"x","restKey":null,"keys":[{"t":0,"v":0},{"t":0.3,"v":0.3},{"t":0.55,"v":1.15},{"t":0.78,"v":1.6},{"t":0.9,"v":1.55},{"t":1,"v":1.5707963267948966}]},{"kind":"O","joint":"root","prop":"position","axis":"y","restKey":null,"keys":[{"t":0,"v":0.75},{"t":0.55,"v":0.7},{"t":0.78,"v":0.55},{"t":1,"v":0.475}]},{"kind":"O","joint":"torso","prop":"rotation","axis":"x","restKey":null,"keys":[{"t":0,"v":0.2},{"t":0.35,"v":0.4},{"t":0.7,"v":0.05},{"t":1,"v":0}]},{"kind":"P","joint":"neck","prop":"rotation","axis":"x","restKey":null,"keys":[{"t":0,"v":0.22},{"t":0.4,"v":0.35},{"t":1,"v":0.05}]},{"kind":"P","joint":"head","prop":"rotation","axis":"z","restKey":null,"keys":[{"t":0,"v":0.08},{"t":0.5,"v":0.1},{"t":1,"v":0.7}]},{"kind":"P","joint":"l_upper_arm","prop":"rotation","axis":"z","restKey":null,"keys":[{"t":0,"v":0.09},{"t":0.4,"v":0.15},{"t":0.75,"v":1.1},{"t":1,"v":0.95}]},{"kind":"P","joint":"r_upper_arm","prop":"rotation","axis":"z","restKey":null,"keys":[{"t":0,"v":-0.09},{"t":0.4,"v":-0.15},{"t":0.75,"v":-0.75},{"t":1,"v":-0.6}]},{"kind":"P","joint":"l_forearm","prop":"rotation","axis":"x","restKey":null,"keys":[{"t":0,"v":0},{"t":0.5,"v":-0.25},{"t":1,"v":-0.4}]},{"kind":"P","joint":"r_forearm","prop":"rotation","axis":"x","restKey":null,"keys":[{"t":0,"v":0},{"t":0.5,"v":-0.35},{"t":1,"v":-0.55}]},{"kind":"P","joint":"l_upper_leg","prop":"rotation","axis":"x","restKey":null,"keys":[{"t":0,"v":0},{"t":0.25,"v":-0.15},{"t":0.7,"v":0.05},{"t":1,"v":-0.06}]},{"kind":"P","joint":"r_upper_leg","prop":"rotation","axis":"x","restKey":null,"keys":[{"t":0,"v":0},{"t":0.25,"v":-0.15},{"t":0.7,"v":0.08},{"t":1,"v":-0.1}]},{"kind":"P","joint":"l_upper_leg","prop":"rotation","axis":"z","restKey":null,"keys":[{"t":0,"v":0},{"t":0.6,"v":0.05},{"t":1,"v":0.1}]},{"kind":"P","joint":"r_upper_leg","prop":"rotation","axis":"z","restKey":null,"keys":[{"t":0,"v":0},{"t":0.6,"v":-0.08},{"t":1,"v":-0.16}]},{"kind":"P","joint":"l_lower_leg","prop":"rotation","axis":"x","restKey":null,"keys":[{"t":0,"v":0},{"t":0.25,"v":0.35},{"t":0.8,"v":0.06},{"t":1,"v":0.04}]},{"kind":"P","joint":"r_lower_leg","prop":"rotation","axis":"x","restKey":null,"keys":[{"t":0,"v":0},{"t":0.25,"v":0.35},{"t":0.8,"v":0.22},{"t":1,"v":0.15}]}]},
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
        "torso:x": 0,
        "neck:x": 0,
        "head:z": 0,
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
                "t": 0.25,
                "v": 0.03
              },
              {
                "t": 0.5,
                "v": 0
              },
              {
                "t": 0.75,
                "v": 0.03
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
                "v": 0.12
              },
              {
                "t": 0.25,
                "v": 0.25
              },
              {
                "t": 0.5,
                "v": -0.45
              },
              {
                "t": 0.75,
                "v": -0.08
              },
              {
                "t": 1,
                "v": 0.12
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
                "v": 0.5
              },
              {
                "t": 0.25,
                "v": 0.25
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
                "v": 0.5
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
                "v": 0.5
              },
              {
                "t": 0.75,
                "v": 0.25
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
        ,
{
            "kind": "P",
            "joint": "l_forearm",
            "prop": "rotation",
            "axis": "x",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": -2.1
              },
              {
                "t": 0.25,
                "v": -1.75
              },
              {
                "t": 0.5,
                "v": -1.55
              },
              {
                "t": 0.75,
                "v": -1.75
              },
              {
                "t": 1,
                "v": -2.1
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
                "v": -1.55
              },
              {
                "t": 0.25,
                "v": -1.75
              },
              {
                "t": 0.5,
                "v": -2.1
              },
              {
                "t": 0.75,
                "v": -1.75
              },
              {
                "t": 1,
                "v": -1.55
              }
            ]
          },
          {
            "kind": "P",
            "joint": "l_forearm",
            "prop": "rotation",
            "axis": "z",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": -0.06
              },
              {
                "t": 0.25,
                "v": -0.13
              },
              {
                "t": 0.5,
                "v": -0.2
              },
              {
                "t": 0.75,
                "v": -0.13
              },
              {
                "t": 1,
                "v": -0.06
              }
            ]
          },
          {
            "kind": "P",
            "joint": "r_forearm",
            "prop": "rotation",
            "axis": "z",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": 0.2
              },
              {
                "t": 0.25,
                "v": 0.13
              },
              {
                "t": 0.5,
                "v": 0.06
              },
              {
                "t": 0.75,
                "v": 0.13
              },
              {
                "t": 1,
                "v": 0.2
              }
            ]
          }],
        "Swing": [
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
        "Punch": [
          {
            "kind": "O",
            "joint": "torso",
            "prop": "rotation",
            "axis": "y",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": 0
              },
              {
                "t": 0.45,
                "v": -0.32
              },
              {
                "t": 0.55,
                "v": 0.52
              },
              {
                "t": 0.65,
                "v": 0.45
              },
              {
                "t": 1,
                "v": 0
              }
            ]
          },
          {
            "kind": "O",
            "joint": "torso",
            "prop": "rotation",
            "axis": "x",
            "restKey": "torso:x",
            "keys": [
              {
                "t": 0,
                "v": 0.04
              },
              {
                "t": 0.45,
                "v": -0.06
              },
              {
                "t": 0.55,
                "v": 0.2
              },
              {
                "t": 0.65,
                "v": 0.16
              },
              {
                "t": 1,
                "v": 0.04
              }
            ]
          },
          {
            "kind": "P",
            "joint": "torso_upper",
            "prop": "rotation",
            "axis": "y",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": 0
              },
              {
                "t": 0.45,
                "v": -0.14
              },
              {
                "t": 0.55,
                "v": 0.22
              },
              {
                "t": 0.65,
                "v": 0.18
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
            "axis": "y",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": 0
              },
              {
                "t": 0.45,
                "v": 0.12
              },
              {
                "t": 0.55,
                "v": -0.2
              },
              {
                "t": 0.65,
                "v": -0.16
              },
              {
                "t": 1,
                "v": 0
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
                "v": -0.45
              },
              {
                "t": 0.45,
                "v": 0.85
              },
              {
                "t": 0.55,
                "v": -1.4
              },
              {
                "t": 0.65,
                "v": -1.32
              },
              {
                "t": 1,
                "v": -0.45
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
                "v": -1.75
              },
              {
                "t": 0.45,
                "v": -2.05
              },
              {
                "t": 0.55,
                "v": -0.18
              },
              {
                "t": 0.65,
                "v": -0.35
              },
              {
                "t": 1,
                "v": -1.75
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
                "v": -0.5
              },
              {
                "t": 0.45,
                "v": -0.35
              },
              {
                "t": 0.55,
                "v": -0.62
              },
              {
                "t": 0.65,
                "v": -0.58
              },
              {
                "t": 1,
                "v": -0.5
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
                "v": -1.8
              },
              {
                "t": 0.45,
                "v": -1.95
              },
              {
                "t": 0.55,
                "v": -1.98
              },
              {
                "t": 0.65,
                "v": -1.92
              },
              {
                "t": 1,
                "v": -1.8
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
                "v": -0.3
              },
              {
                "t": 0.45,
                "v": -0.2
              },
              {
                "t": 0.55,
                "v": -0.38
              },
              {
                "t": 0.65,
                "v": -0.35
              },
              {
                "t": 1,
                "v": -0.3
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
                "t": 0.45,
                "v": 0.35
              },
              {
                "t": 0.55,
                "v": 0.08
              },
              {
                "t": 0.65,
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
                "v": 0.35
              },
              {
                "t": 0.45,
                "v": 0.28
              },
              {
                "t": 0.55,
                "v": 0.32
              },
              {
                "t": 0.65,
                "v": 0.33
              },
              {
                "t": 1,
                "v": 0.35
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
                "v": 0.45
              },
              {
                "t": 0.45,
                "v": 0.65
              },
              {
                "t": 0.55,
                "v": 0.08
              },
              {
                "t": 0.65,
                "v": 0.15
              },
              {
                "t": 1,
                "v": 0.45
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
                "t": 0.45,
                "v": -0.02
              },
              {
                "t": 0.55,
                "v": -0.06
              },
              {
                "t": 0.65,
                "v": -0.04
              },
              {
                "t": 1,
                "v": 0
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
        "torso:x": 0,
        "neck:x": 0,
        "head:z": 0,
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
                "t": 0.25,
                "v": 0.03
              },
              {
                "t": 0.5,
                "v": 0
              },
              {
                "t": 0.75,
                "v": 0.03
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
                "v": 0.12
              },
              {
                "t": 0.25,
                "v": 0.25
              },
              {
                "t": 0.5,
                "v": -0.45
              },
              {
                "t": 0.75,
                "v": -0.08
              },
              {
                "t": 1,
                "v": 0.12
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
                "v": 0.5
              },
              {
                "t": 0.25,
                "v": 0.25
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
                "v": 0.5
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
                "v": 0.5
              },
              {
                "t": 0.75,
                "v": 0.25
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
        ,
{
            "kind": "P",
            "joint": "l_forearm",
            "prop": "rotation",
            "axis": "x",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": -2.1
              },
              {
                "t": 0.25,
                "v": -1.75
              },
              {
                "t": 0.5,
                "v": -1.55
              },
              {
                "t": 0.75,
                "v": -1.75
              },
              {
                "t": 1,
                "v": -2.1
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
                "v": -1.55
              },
              {
                "t": 0.25,
                "v": -1.75
              },
              {
                "t": 0.5,
                "v": -2.1
              },
              {
                "t": 0.75,
                "v": -1.75
              },
              {
                "t": 1,
                "v": -1.55
              }
            ]
          },
          {
            "kind": "P",
            "joint": "l_forearm",
            "prop": "rotation",
            "axis": "z",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": -0.06
              },
              {
                "t": 0.25,
                "v": -0.13
              },
              {
                "t": 0.5,
                "v": -0.2
              },
              {
                "t": 0.75,
                "v": -0.13
              },
              {
                "t": 1,
                "v": -0.06
              }
            ]
          },
          {
            "kind": "P",
            "joint": "r_forearm",
            "prop": "rotation",
            "axis": "z",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": 0.2
              },
              {
                "t": 0.25,
                "v": 0.13
              },
              {
                "t": 0.5,
                "v": 0.06
              },
              {
                "t": 0.75,
                "v": 0.13
              },
              {
                "t": 1,
                "v": 0.2
              }
            ]
          }],
        "Swing": [
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
        "Punch": [
          {
            "kind": "O",
            "joint": "torso",
            "prop": "rotation",
            "axis": "y",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": 0
              },
              {
                "t": 0.45,
                "v": -0.32
              },
              {
                "t": 0.55,
                "v": 0.52
              },
              {
                "t": 0.65,
                "v": 0.45
              },
              {
                "t": 1,
                "v": 0
              }
            ]
          },
          {
            "kind": "O",
            "joint": "torso",
            "prop": "rotation",
            "axis": "x",
            "restKey": "torso:x",
            "keys": [
              {
                "t": 0,
                "v": 0.04
              },
              {
                "t": 0.45,
                "v": -0.06
              },
              {
                "t": 0.55,
                "v": 0.2
              },
              {
                "t": 0.65,
                "v": 0.16
              },
              {
                "t": 1,
                "v": 0.04
              }
            ]
          },
          {
            "kind": "P",
            "joint": "torso_upper",
            "prop": "rotation",
            "axis": "y",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": 0
              },
              {
                "t": 0.45,
                "v": -0.14
              },
              {
                "t": 0.55,
                "v": 0.22
              },
              {
                "t": 0.65,
                "v": 0.18
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
            "axis": "y",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": 0
              },
              {
                "t": 0.45,
                "v": 0.12
              },
              {
                "t": 0.55,
                "v": -0.2
              },
              {
                "t": 0.65,
                "v": -0.16
              },
              {
                "t": 1,
                "v": 0
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
                "v": -0.45
              },
              {
                "t": 0.45,
                "v": 0.85
              },
              {
                "t": 0.55,
                "v": -1.4
              },
              {
                "t": 0.65,
                "v": -1.32
              },
              {
                "t": 1,
                "v": -0.45
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
                "v": -1.75
              },
              {
                "t": 0.45,
                "v": -2.05
              },
              {
                "t": 0.55,
                "v": -0.18
              },
              {
                "t": 0.65,
                "v": -0.35
              },
              {
                "t": 1,
                "v": -1.75
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
                "v": -0.5
              },
              {
                "t": 0.45,
                "v": -0.35
              },
              {
                "t": 0.55,
                "v": -0.62
              },
              {
                "t": 0.65,
                "v": -0.58
              },
              {
                "t": 1,
                "v": -0.5
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
                "v": -1.8
              },
              {
                "t": 0.45,
                "v": -1.95
              },
              {
                "t": 0.55,
                "v": -1.98
              },
              {
                "t": 0.65,
                "v": -1.92
              },
              {
                "t": 1,
                "v": -1.8
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
                "v": -0.3
              },
              {
                "t": 0.45,
                "v": -0.2
              },
              {
                "t": 0.55,
                "v": -0.38
              },
              {
                "t": 0.65,
                "v": -0.35
              },
              {
                "t": 1,
                "v": -0.3
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
                "t": 0.45,
                "v": 0.35
              },
              {
                "t": 0.55,
                "v": 0.08
              },
              {
                "t": 0.65,
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
                "v": 0.35
              },
              {
                "t": 0.45,
                "v": 0.28
              },
              {
                "t": 0.55,
                "v": 0.32
              },
              {
                "t": 0.65,
                "v": 0.33
              },
              {
                "t": 1,
                "v": 0.35
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
                "v": 0.45
              },
              {
                "t": 0.45,
                "v": 0.65
              },
              {
                "t": 0.55,
                "v": 0.08
              },
              {
                "t": 0.65,
                "v": 0.15
              },
              {
                "t": 1,
                "v": 0.45
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
                "t": 0.45,
                "v": -0.02
              },
              {
                "t": 0.55,
                "v": -0.06
              },
              {
                "t": 0.65,
                "v": -0.04
              },
              {
                "t": 1,
                "v": 0
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
        "torso:x": 0,
        "neck:x": 0,
        "head:z": 0,
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
                "t": 0.25,
                "v": 0.03
              },
              {
                "t": 0.5,
                "v": 0
              },
              {
                "t": 0.75,
                "v": 0.03
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
                "v": 0.12
              },
              {
                "t": 0.25,
                "v": 0.25
              },
              {
                "t": 0.5,
                "v": -0.45
              },
              {
                "t": 0.75,
                "v": -0.08
              },
              {
                "t": 1,
                "v": 0.12
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
                "v": 0.5
              },
              {
                "t": 0.25,
                "v": 0.25
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
                "v": 0.5
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
                "v": 0.5
              },
              {
                "t": 0.75,
                "v": 0.25
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
        ,
{
            "kind": "P",
            "joint": "l_forearm",
            "prop": "rotation",
            "axis": "x",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": -2.1
              },
              {
                "t": 0.25,
                "v": -1.75
              },
              {
                "t": 0.5,
                "v": -1.55
              },
              {
                "t": 0.75,
                "v": -1.75
              },
              {
                "t": 1,
                "v": -2.1
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
                "v": -1.55
              },
              {
                "t": 0.25,
                "v": -1.75
              },
              {
                "t": 0.5,
                "v": -2.1
              },
              {
                "t": 0.75,
                "v": -1.75
              },
              {
                "t": 1,
                "v": -1.55
              }
            ]
          },
          {
            "kind": "P",
            "joint": "l_forearm",
            "prop": "rotation",
            "axis": "z",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": -0.06
              },
              {
                "t": 0.25,
                "v": -0.13
              },
              {
                "t": 0.5,
                "v": -0.2
              },
              {
                "t": 0.75,
                "v": -0.13
              },
              {
                "t": 1,
                "v": -0.06
              }
            ]
          },
          {
            "kind": "P",
            "joint": "r_forearm",
            "prop": "rotation",
            "axis": "z",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": 0.2
              },
              {
                "t": 0.25,
                "v": 0.13
              },
              {
                "t": 0.5,
                "v": 0.06
              },
              {
                "t": 0.75,
                "v": 0.13
              },
              {
                "t": 1,
                "v": 0.2
              }
            ]
          }],
        "Swing": [
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
        "Punch": [
          {
            "kind": "O",
            "joint": "torso",
            "prop": "rotation",
            "axis": "y",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": 0
              },
              {
                "t": 0.45,
                "v": -0.32
              },
              {
                "t": 0.55,
                "v": 0.52
              },
              {
                "t": 0.65,
                "v": 0.45
              },
              {
                "t": 1,
                "v": 0
              }
            ]
          },
          {
            "kind": "O",
            "joint": "torso",
            "prop": "rotation",
            "axis": "x",
            "restKey": "torso:x",
            "keys": [
              {
                "t": 0,
                "v": 0.04
              },
              {
                "t": 0.45,
                "v": -0.06
              },
              {
                "t": 0.55,
                "v": 0.2
              },
              {
                "t": 0.65,
                "v": 0.16
              },
              {
                "t": 1,
                "v": 0.04
              }
            ]
          },
          {
            "kind": "P",
            "joint": "torso_upper",
            "prop": "rotation",
            "axis": "y",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": 0
              },
              {
                "t": 0.45,
                "v": -0.14
              },
              {
                "t": 0.55,
                "v": 0.22
              },
              {
                "t": 0.65,
                "v": 0.18
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
            "axis": "y",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": 0
              },
              {
                "t": 0.45,
                "v": 0.12
              },
              {
                "t": 0.55,
                "v": -0.2
              },
              {
                "t": 0.65,
                "v": -0.16
              },
              {
                "t": 1,
                "v": 0
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
                "v": -0.45
              },
              {
                "t": 0.45,
                "v": 0.85
              },
              {
                "t": 0.55,
                "v": -1.4
              },
              {
                "t": 0.65,
                "v": -1.32
              },
              {
                "t": 1,
                "v": -0.45
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
                "v": -1.75
              },
              {
                "t": 0.45,
                "v": -2.05
              },
              {
                "t": 0.55,
                "v": -0.18
              },
              {
                "t": 0.65,
                "v": -0.35
              },
              {
                "t": 1,
                "v": -1.75
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
                "v": -0.5
              },
              {
                "t": 0.45,
                "v": -0.35
              },
              {
                "t": 0.55,
                "v": -0.62
              },
              {
                "t": 0.65,
                "v": -0.58
              },
              {
                "t": 1,
                "v": -0.5
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
                "v": -1.8
              },
              {
                "t": 0.45,
                "v": -1.95
              },
              {
                "t": 0.55,
                "v": -1.98
              },
              {
                "t": 0.65,
                "v": -1.92
              },
              {
                "t": 1,
                "v": -1.8
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
                "v": -0.3
              },
              {
                "t": 0.45,
                "v": -0.2
              },
              {
                "t": 0.55,
                "v": -0.38
              },
              {
                "t": 0.65,
                "v": -0.35
              },
              {
                "t": 1,
                "v": -0.3
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
                "t": 0.45,
                "v": 0.35
              },
              {
                "t": 0.55,
                "v": 0.08
              },
              {
                "t": 0.65,
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
                "v": 0.35
              },
              {
                "t": 0.45,
                "v": 0.28
              },
              {
                "t": 0.55,
                "v": 0.32
              },
              {
                "t": 0.65,
                "v": 0.33
              },
              {
                "t": 1,
                "v": 0.35
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
                "v": 0.45
              },
              {
                "t": 0.45,
                "v": 0.65
              },
              {
                "t": 0.55,
                "v": 0.08
              },
              {
                "t": 0.65,
                "v": 0.15
              },
              {
                "t": 1,
                "v": 0.45
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
                "t": 0.45,
                "v": -0.02
              },
              {
                "t": 0.55,
                "v": -0.06
              },
              {
                "t": 0.65,
                "v": -0.04
              },
              {
                "t": 1,
                "v": 0
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
        "torso:x": 0,
        "neck:x": 0,
        "head:z": 0,
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
                "t": 0.25,
                "v": 0.03
              },
              {
                "t": 0.5,
                "v": 0
              },
              {
                "t": 0.75,
                "v": 0.03
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
                "v": 0.12
              },
              {
                "t": 0.25,
                "v": 0.25
              },
              {
                "t": 0.5,
                "v": -0.45
              },
              {
                "t": 0.75,
                "v": -0.08
              },
              {
                "t": 1,
                "v": 0.12
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
                "v": 0.5
              },
              {
                "t": 0.25,
                "v": 0.25
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
                "v": 0.5
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
                "v": 0.5
              },
              {
                "t": 0.75,
                "v": 0.25
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
        ,
{
            "kind": "P",
            "joint": "l_forearm",
            "prop": "rotation",
            "axis": "x",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": -2.1
              },
              {
                "t": 0.25,
                "v": -1.75
              },
              {
                "t": 0.5,
                "v": -1.55
              },
              {
                "t": 0.75,
                "v": -1.75
              },
              {
                "t": 1,
                "v": -2.1
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
                "v": -1.55
              },
              {
                "t": 0.25,
                "v": -1.75
              },
              {
                "t": 0.5,
                "v": -2.1
              },
              {
                "t": 0.75,
                "v": -1.75
              },
              {
                "t": 1,
                "v": -1.55
              }
            ]
          },
          {
            "kind": "P",
            "joint": "l_forearm",
            "prop": "rotation",
            "axis": "z",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": -0.06
              },
              {
                "t": 0.25,
                "v": -0.13
              },
              {
                "t": 0.5,
                "v": -0.2
              },
              {
                "t": 0.75,
                "v": -0.13
              },
              {
                "t": 1,
                "v": -0.06
              }
            ]
          },
          {
            "kind": "P",
            "joint": "r_forearm",
            "prop": "rotation",
            "axis": "z",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": 0.2
              },
              {
                "t": 0.25,
                "v": 0.13
              },
              {
                "t": 0.5,
                "v": 0.06
              },
              {
                "t": 0.75,
                "v": 0.13
              },
              {
                "t": 1,
                "v": 0.2
              }
            ]
          }],
        "Swing": [
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
        "Punch": [
          {
            "kind": "O",
            "joint": "torso",
            "prop": "rotation",
            "axis": "y",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": 0
              },
              {
                "t": 0.45,
                "v": -0.32
              },
              {
                "t": 0.55,
                "v": 0.52
              },
              {
                "t": 0.65,
                "v": 0.45
              },
              {
                "t": 1,
                "v": 0
              }
            ]
          },
          {
            "kind": "O",
            "joint": "torso",
            "prop": "rotation",
            "axis": "x",
            "restKey": "torso:x",
            "keys": [
              {
                "t": 0,
                "v": 0.04
              },
              {
                "t": 0.45,
                "v": -0.06
              },
              {
                "t": 0.55,
                "v": 0.2
              },
              {
                "t": 0.65,
                "v": 0.16
              },
              {
                "t": 1,
                "v": 0.04
              }
            ]
          },
          {
            "kind": "P",
            "joint": "torso_upper",
            "prop": "rotation",
            "axis": "y",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": 0
              },
              {
                "t": 0.45,
                "v": -0.14
              },
              {
                "t": 0.55,
                "v": 0.22
              },
              {
                "t": 0.65,
                "v": 0.18
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
            "axis": "y",
            "restKey": null,
            "keys": [
              {
                "t": 0,
                "v": 0
              },
              {
                "t": 0.45,
                "v": 0.12
              },
              {
                "t": 0.55,
                "v": -0.2
              },
              {
                "t": 0.65,
                "v": -0.16
              },
              {
                "t": 1,
                "v": 0
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
                "v": -0.45
              },
              {
                "t": 0.45,
                "v": 0.85
              },
              {
                "t": 0.55,
                "v": -1.4
              },
              {
                "t": 0.65,
                "v": -1.32
              },
              {
                "t": 1,
                "v": -0.45
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
                "v": -1.75
              },
              {
                "t": 0.45,
                "v": -2.05
              },
              {
                "t": 0.55,
                "v": -0.18
              },
              {
                "t": 0.65,
                "v": -0.35
              },
              {
                "t": 1,
                "v": -1.75
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
                "v": -0.5
              },
              {
                "t": 0.45,
                "v": -0.35
              },
              {
                "t": 0.55,
                "v": -0.62
              },
              {
                "t": 0.65,
                "v": -0.58
              },
              {
                "t": 1,
                "v": -0.5
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
                "v": -1.8
              },
              {
                "t": 0.45,
                "v": -1.95
              },
              {
                "t": 0.55,
                "v": -1.98
              },
              {
                "t": 0.65,
                "v": -1.92
              },
              {
                "t": 1,
                "v": -1.8
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
                "v": -0.3
              },
              {
                "t": 0.45,
                "v": -0.2
              },
              {
                "t": 0.55,
                "v": -0.38
              },
              {
                "t": 0.65,
                "v": -0.35
              },
              {
                "t": 1,
                "v": -0.3
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
                "t": 0.45,
                "v": 0.35
              },
              {
                "t": 0.55,
                "v": 0.08
              },
              {
                "t": 0.65,
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
                "v": 0.35
              },
              {
                "t": 0.45,
                "v": 0.28
              },
              {
                "t": 0.55,
                "v": 0.32
              },
              {
                "t": 0.65,
                "v": 0.33
              },
              {
                "t": 1,
                "v": 0.35
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
                "v": 0.45
              },
              {
                "t": 0.45,
                "v": 0.65
              },
              {
                "t": 0.55,
                "v": 0.08
              },
              {
                "t": 0.65,
                "v": 0.15
              },
              {
                "t": 1,
                "v": 0.45
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
                "t": 0.45,
                "v": -0.02
              },
              {
                "t": 0.55,
                "v": -0.06
              },
              {
                "t": 0.65,
                "v": -0.04
              },
              {
                "t": 1,
                "v": 0
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

  // MODELS：四变体从骨架版本烘焙（v0.79.24 含衣服 addon + 丧尸动画集）
  // 骨架映射：学生(儿童骨架) / 教师男(成年男骨架) / 教师女(成年女性骨架)
  // 人类士兵（v0.79.37 预研）：四变体全部 v1-成年男烘焙
  var VARIANT_SKELETON = {
    student_m: 'v1-儿童-20260810',
    student_f: 'v1-儿童-20260810',
    teacher_m: 'v1-成年男-20260810',
    teacher_f: 'v2-成年女性-2026-08-14',
    guard: 'v1-成年男-20260810',
    rifleman: 'v1-成年男-20260810',
    shotgunner: 'v1-成年男-20260810',
    rocketeer: 'v1-成年男-20260810',
  };
  var VARIANT_BODY = {
    student_m: { build: 0.45, hunch: 0.2, curves: 0 },
    student_f: { build: 0.4, hunch: 0.2, curves: 0 },
    teacher_m: { build: 0.5, hunch: 0.2, curves: 0 },
    teacher_f: { build: 0.38, hunch: 0.2, curves: 0.7 },
    guard: { build: 0.5, hunch: 0, curves: 0 },
    rifleman: { build: 0.55, hunch: 0, curves: 0 },
    shotgunner: { build: 0.55, hunch: 0, curves: 0 },
    rocketeer: { build: 0.55, hunch: 0, curves: 0 },
  };
  // 骨盆外显色 = 裤/裙同色（学生短裤红 / 教师裤裙灰——上衣扎进裤裙，v0.79.5 语义迁移到烘焙层）
  // 人类士兵：骨盆=裤色（保安藏青 / 士兵迷彩同料）
  var PELVIS_CLOTH = {
    student_m: 'shorts_red',
    student_f: 'shorts_red',
    teacher_m: 'trousers_grey',
    teacher_f: 'trousers_grey',
    guard: 'uniform_navy',
    rifleman: 'camo_cloth',
    shotgunner: 'camo_cloth',
    rocketeer: 'camo_cloth',
  };
  // 上衣（torso_upper 材质，v0.79.31：骨架皮肤躯干穿上衣——学生白polo/教师男蓝衬衫/教师女粉T恤）
  // 人类士兵：保安藏青制服 / 士兵迷彩外套
  var VARIANT_TOP = {
    student_m: 'polo_white',
    student_f: 'polo_white',
    teacher_m: 'shirt_blue',
    teacher_f: 'pink_tee',
    guard: 'uniform_navy',
    rifleman: 'camo_cloth',
    shotgunner: 'camo_cloth',
    rocketeer: 'camo_cloth',
  };
  // 下躯干（torso_lower）材质（v0.79.37）：人类士兵=外套下摆色（衣不扎裤）；
  // 丧尸变体沿用旧逻辑（教师扎裤裙色 / 学生 polo 外放）
  var VARIANT_LOWER = {
    guard: 'uniform_navy',
    rifleman: 'camo_cloth',
    shotgunner: 'camo_cloth',
    rocketeer: 'camo_cloth',
  };
  // 人类变体集合（活人单位：直立动画、不派生丧尸动画集）
  var HUMAN_SOLDIER_VARIANTS = { guard: 1, rifleman: 1, shotgunner: 1, rocketeer: 1 };

  // bakeModel：从骨架版本烘焙字面值 tree（deriveNode 派生 + 完整 addon 注入，对齐 buildHumanoid）
  //   skeletonVer: SKELETON_VERSIONS 的 key；params: { height, build, hunch, curves, addons, materials }
  function bakeModel(skeletonVer, params) {
    var ver = SKELETON_VERSIONS[skeletonVer];
    if (!ver) {
      console.warn('bakeModel: 未知骨架版本', skeletonVer);
      return null;
    }
    params = params || {};
    var variant = { materials: params.materials || HUMANOID_VARIANTS.student_m.materials };
    var p = {
      height: params.height != null ? params.height : 1.4,
      build: params.build != null ? params.build : BODY_PARAMS.build.default,
      hunch: params.hunch != null ? params.hunch : 0,
      curves: params.curves != null ? params.curves : 0,
    };
    var tree = deriveNode(JSON.parse(JSON.stringify(ver.tree)), p, variant);
    // addon 完整注入（镜像/双挂/WRAP 包裹/curves 放大，对齐 buildHumanoid 主装配）
    var wrapMax = 0;
    (params.addons || []).forEach(function (key) {
      var def = ADDON_LIBRARY[key];
      if (!def) return;
      var parents =
        DUAL_LEG_ADDONS[key] ||
        DUAL_LIMB_ADDONS[key] ||
        (FOOT_ADDONS.indexOf(key) >= 0 ? ['l_foot', 'r_foot'] : [def.parent]);
      parents.forEach(function (par, idx) {
        var parentNode = findNode(tree, par);
        if (!parentNode) return;
        parentNode.children = parentNode.children || [];
        var clone = JSON.parse(JSON.stringify(def.node));
        resolveAddonMaterials(clone, variant.materials);
        if (par === 'r_foot' || par === 'r_forearm' || par === 'r_upper_leg' || par === 'r_lower_leg')
          mirrorX(clone);
        if (key === 'bust' || key === 'hips') scaleGroup(clone, 0.6 + p.curves * 0.8);
        var wrap = WRAP_ADDONS[key];
        if (wrap) {
          var limbNode = findNode(tree, wrap.limb);
          if (limbNode && limbNode.size) {
            applyWrapScale(clone, limbNode.size[0], wrap.gap, wrap.gapBottom, wrap.zRatio);
            // v0.79.34c 裙变体：骨盆顶深 + 下躯干底面钳制（防角刺出椭圆壁，语义见 WRAP_ADDONS 段常量）
            if (clone.type === 'EllipFrustum') {
              var pn = findNode(tree, 'pelvis');
              if (pn && pn.size && pn.size[4] > SKIRT_PELVIS_TD) pn.size[4] = SKIRT_PELVIS_TD;
              var tl = findNode(tree, 'torso_lower');
              if (tl && tl.size) {
                if (tl.size[2] > SKIRT_TLOWER_BD) tl.size[2] = SKIRT_TLOWER_BD;
                if (tl.size[8] < SKIRT_TLOWER_BZ) tl.size[8] = SKIRT_TLOWER_BZ;
              }
            }
            // v0.79.34b 裙(Cylinder/EllipFrustum)不参与 wrapMax（圆形外层自包裹骨盆；方盒语义见 buildHumanoid 同段注释）
            var wrapFirst = firstWrapNode(clone);
            if (wrapFirst && wrapFirst.size && wrapFirst.type === 'Box') {
              var w = wrapFirst.size[0] / 2;
              if (w > wrapMax) wrapMax = w;
            }
          }
        }
        // snap 贴胸：按骨架 torso_upper(RidgeBox) 前表面计算 z，改挂 torso_upper（配饰随不同骨架贴合不悬空）
        if (def.snap) {
          var tu = findNode(tree, 'torso_upper');
          if (tu && tu.size && tu.size.length >= 6) {
            var sh = tu.size[1];
            var sbw = tu.size[0], sbd = tu.size[2], stw = tu.size[3], std = tu.size[4];
            var sox = tu.size[5] || 0, soz = tu.size[6] || 0;
            var sRidgeY = tu.size[7] != null ? Math.min(Math.max(tu.size[7], 0), sh) : sh * 0.5;
            var sRidgeZ = tu.size[8] || 0;
            var yy = (def.snap.y != null ? def.snap.y : 0.45) * sh;
            var zBot = sbd / 2, zTop = std / 2 + soz;
            var zRidgeBase = zBot + (sRidgeY / sh) * (zTop - zBot);
            var zRidge = zRidgeBase + sRidgeZ;
            var zF = yy < sRidgeY
              ? zBot + (yy / Math.max(0.01, sRidgeY)) * (zRidgeBase - zBot)
              : zRidge + ((yy - sRidgeY) / Math.max(0.01, sh - sRidgeY)) * (zTop - zRidge);
            var hw = sbw / 2 + (yy / sh) * (stw / 2 + sox - sbw / 2);
            var xx = def.snap.x != null ? def.snap.x : (clone.position || [0, 0, 0])[0];
            xx = Math.max(-hw + 0.02, Math.min(hw - 0.02, xx));
            // ⚠️ pivot 补偿：渲染层子件 position += -pivot（torso_upper pivot[1]=-0.145 → +0.145），
            // 不补偿会整体抬高半截躯干（v0.79.27 饰物"比肩高"根因）
            clone.position = [xx, yy + (tu.pivot ? tu.pivot[1] : 0), zF + (def.snap.out != null ? def.snap.out : 0.006)];
            clone._addonKey = key + (idx > 0 ? '_r' : '');
            tu.children = tu.children || [];
            tu.children.push(clone);
            return;
          }
        }
        clone._addonKey = key + (idx > 0 ? '_r' : '');
        parentNode.children.push(clone);
      });
    });
    // 学生上衣下摆包裹保证（教师扎裤裙不 grow）；TaperedBox 9 参数只放大底面宽/深并保留其余参数
    var isTeacherVk = params._variantKey === 'teacher_m' || params._variantKey === 'teacher_f';
    if (wrapMax > 0 && !isTeacherVk) {
      var pelvisNode = findNode(tree, 'pelvis');
      if (pelvisNode && pelvisNode.size) {
        var _bF = 0.7 + p.build * 0.6;
        var needFull = (wrapMax + 0.02) * 2;
        var ps = pelvisNode.size.slice();
        ps[0] = Math.max(ps[0], ps[0] * _bF, needFull);
        ps[2] = Math.max(ps[2], ps[2] * _bF, needFull);
        pelvisNode.size = ps;
      }
    }
    // 骨盆外显色 = 裤/裙同色（上衣扎进裤裙，v0.79.5 语义迁移到烘焙层）
    if (PELVIS_CLOTH && PELVIS_CLOTH[params._variantKey]) {
      var pelvisNode0 = findNode(tree, 'pelvis');
      if (pelvisNode0) pelvisNode0.materialId = PELVIS_CLOTH[params._variantKey];
      // 教师上衣扎进下装：下躯干(torso_lower)同样显裤/裙色
      // 学生 polo 外放：下躯干显 polo 色（v0.79.31 穿上衣——原 skin 裸露）
      var tlower0 = findNode(tree, 'torso_lower');
      if (tlower0) {
        tlower0.materialId =
          VARIANT_LOWER[params._variantKey] ||
          (params._variantKey === 'teacher_m' || params._variantKey === 'teacher_f'
            ? PELVIS_CLOTH[params._variantKey]
            : 'polo_white');
      }
    }
    // 上衣：上躯干(torso_upper)按变体材质（v0.79.31——原 __skin__ 裸露与四肢同色）
    if (VARIANT_TOP && VARIANT_TOP[params._variantKey]) {
      var tupper0 = findNode(tree, 'torso_upper');
      if (tupper0) tupper0.materialId = VARIANT_TOP[params._variantKey];
    }
    tree._params = { height: p.height };
    return tree;
  }

  // ── 丧尸动画集派生：驼背 + 无拳击 + Walk/Run 拖行 + Run 双臂前伸抓猎物 + 裙摆动 ──
  var ZOMBIE_HUNCH = { 'torso:x': 0.2, 'neck:x': 0.22, 'head:z': 0.08 };
  // 裙摆动轨道（kind O 挂 pelvis 的裙节点：学生 ah_skirt / 教师 ah_gskirt）
  // v0.79.34 跟腿耦合：x = K×左大腿角——腿前踢裙前倾"腿把裙撑开"（旧版反相"布料滞后"恰好在前踢帧
  // 把裙底后仰 0.031，前向包络需求被自己撑大）。K=0.35 逐帧仿真最优（0.30~0.40 需求面平坦）
  var SKIRT_COUPLE_K = 0.35;
  function skirtTracks(skirtName, legXKeys, zAmp) {
    if (!skirtName || !legXKeys) return [];
    return [
      { kind: 'O', joint: skirtName, prop: 'rotation', axis: 'x', restKey: null,
        keys: legXKeys.map(function (k) { return { t: k.t, v: +(k.v * SKIRT_COUPLE_K).toFixed(4) }; }) },
      { kind: 'O', joint: skirtName, prop: 'rotation', axis: 'z', restKey: null, keys: [ { t: 0, v: -zAmp }, { t: 0.5, v: zAmp }, { t: 1, v: -zAmp } ] },
    ];
  }
  function deriveZombieAnims(verAnims, skirtName, dieRootY, rootY) {
    var a = JSON.parse(JSON.stringify(verAnims));
    delete a.actions.Punch;
    Object.assign(a.restPoses, ZOMBIE_HUNCH);
    // Die root 高度按骨架定制：从站立 rootY 平滑下沉至躯干贴地 dieRootY，裙摆圆环自然没入地面
    if (dieRootY != null) {
      (a.actions.Die || []).forEach(function (t) {
        if (t.joint === 'root' && t.axis === 'y' && t.keys.length === 4) {
          if (rootY != null) {
            t.keys[0].v = rootY;
            t.keys[1].v = rootY + (dieRootY - rootY) * 0.4;
            t.keys[2].v = rootY + (dieRootY - rootY) * 0.7;
          } else {
            t.keys[2].v = dieRootY + 0.075;
          }
          t.keys[3].v = dieRootY;
        }
      });
    }
    // Walk：拖行一瘸一拐（左腿好/右腿瘸拖，躯干摇摆，2.2s）
    // 步态修正（2026-08-16 用户报告"双脚同时屈膝后蹬"）：旧关键帧双腿后摆窗重叠 ~1/4 周期
    // （l 正窗 0.17~0.65 ∩ r 正窗 0.11~0.40/0.67~0.80）且双膝全程屈着(≥0.15/0.42)——双蹬相。
    // 重设计为一迈一撑交叉循环：后蹬窗错开（l 0.20~0.56 / r 0.77~0.24），一腿后蹬时另一腿必在前迈；
    // 支撑腿膝伸直蹬地(0.08→0.18)、摆动腿屈膝抬脚(峰 0.62)；瘸拖特征=右幅值减半+膝恒僵 0.42~0.55
    a.actions.Walk = [
      { kind: 'O', joint: 'torso', prop: 'rotation', axis: 'z', restKey: null, keys: [ { t: 0, v: 0.05 }, { t: 0.25, v: -0.07 }, { t: 0.5, v: 0.05 }, { t: 0.75, v: -0.07 }, { t: 1, v: 0.05 } ] },
      { kind: 'O', joint: 'pelvis', prop: 'position', axis: 'y', restKey: 'pelvis:y', keys: [ { t: 0, v: -0.015 }, { t: 0.25, v: 0.015 }, { t: 0.5, v: -0.02 }, { t: 0.75, v: 0.01 }, { t: 1, v: -0.015 } ] },
      // 左腿(好腿)：t0 触地(前伸-0.28)→t0.45 后蹬(+0.30)→t0.6~0.9 摆动前迈
      { kind: 'P', joint: 'l_upper_leg', prop: 'rotation', axis: 'x', restKey: null, keys: [ { t: 0, v: -0.28 }, { t: 0.15, v: -0.05 }, { t: 0.3, v: 0.12 }, { t: 0.45, v: 0.3 }, { t: 0.6, v: 0.05 }, { t: 0.75, v: -0.22 }, { t: 0.9, v: -0.3 }, { t: 1, v: -0.28 } ] },
      // 右腿(瘸腿,相位+0.5幅值减半)：t0.45 前伸触地(-0.18)→t0.9 轻蹬(+0.15)→拖行前移
      { kind: 'P', joint: 'r_upper_leg', prop: 'rotation', axis: 'x', restKey: null, keys: [ { t: 0, v: 0.15 }, { t: 0.15, v: 0.05 }, { t: 0.3, v: -0.08 }, { t: 0.45, v: -0.18 }, { t: 0.6, v: -0.1 }, { t: 0.75, v: 0.04 }, { t: 0.9, v: 0.15 }, { t: 1, v: 0.15 } ] },
      // 左膝：触地 0.08 伸直承重→蹬地 0.18→摆动峰 0.62 抬脚清障→前伸落地下探 0.15
      { kind: 'P', joint: 'l_lower_leg', prop: 'rotation', axis: 'x', restKey: null, keys: [ { t: 0, v: 0.08 }, { t: 0.15, v: 0.2 }, { t: 0.3, v: 0.12 }, { t: 0.45, v: 0.18 }, { t: 0.6, v: 0.62 }, { t: 0.75, v: 0.45 }, { t: 0.9, v: 0.15 }, { t: 1, v: 0.08 } ] },
      // 右膝(僵直拖行)：全程 0.42~0.55 恒屈不伸直——拖脚特征
      { kind: 'P', joint: 'r_lower_leg', prop: 'rotation', axis: 'x', restKey: null, keys: [ { t: 0, v: 0.45 }, { t: 0.15, v: 0.42 }, { t: 0.3, v: 0.52 }, { t: 0.45, v: 0.55 }, { t: 0.6, v: 0.5 }, { t: 0.75, v: 0.44 }, { t: 0.9, v: 0.42 }, { t: 1, v: 0.45 } ] },
      { kind: 'P', joint: 'l_upper_arm', prop: 'rotation', axis: 'x', restKey: null, keys: [ { t: 0, v: -0.25 }, { t: 0.25, v: 0.1 }, { t: 0.5, v: -0.25 }, { t: 0.75, v: 0.1 }, { t: 1, v: -0.25 } ] },
      { kind: 'P', joint: 'r_upper_arm', prop: 'rotation', axis: 'x', restKey: null, keys: [ { t: 0, v: 0.1 }, { t: 0.25, v: -0.25 }, { t: 0.5, v: 0.1 }, { t: 0.75, v: -0.25 }, { t: 1, v: 0.1 } ] },
    ];
    // Run：双臂前伸抓猎物 + 拖行快步（1.0s）
    a.actions.Run = [
      { kind: 'O', joint: 'torso', prop: 'rotation', axis: 'x', restKey: 'torso:x', keys: [ { t: 0, v: 0.15 }, { t: 0.5, v: 0.1 }, { t: 1, v: 0.15 } ] },
      { kind: 'O', joint: 'torso', prop: 'rotation', axis: 'z', restKey: null, keys: [ { t: 0, v: 0.06 }, { t: 0.25, v: -0.08 }, { t: 0.5, v: 0.06 }, { t: 0.75, v: -0.08 }, { t: 1, v: 0.06 } ] },
      { kind: 'O', joint: 'pelvis', prop: 'position', axis: 'y', restKey: 'pelvis:y', keys: [ { t: 0, v: -0.02 }, { t: 0.25, v: 0.02 }, { t: 0.5, v: -0.02 }, { t: 0.75, v: 0.02 }, { t: 1, v: -0.02 } ] },
      { kind: 'P', joint: 'l_upper_arm', prop: 'rotation', axis: 'x', restKey: null, keys: [ { t: 0, v: -1.25 }, { t: 0.5, v: -1.15 }, { t: 1, v: -1.25 } ] },
      { kind: 'P', joint: 'r_upper_arm', prop: 'rotation', axis: 'x', restKey: null, keys: [ { t: 0, v: -1.25 }, { t: 0.5, v: -1.15 }, { t: 1, v: -1.25 } ] },
      { kind: 'P', joint: 'l_forearm', prop: 'rotation', axis: 'x', restKey: null, keys: [ { t: 0, v: -0.5 }, { t: 0.5, v: -0.42 }, { t: 1, v: -0.5 } ] },
      { kind: 'P', joint: 'r_forearm', prop: 'rotation', axis: 'x', restKey: null, keys: [ { t: 0, v: -0.5 }, { t: 0.5, v: -0.42 }, { t: 1, v: -0.5 } ] },
      { kind: 'P', joint: 'l_upper_arm', prop: 'rotation', axis: 'z', restKey: null, keys: [ { t: 0, v: -0.12 }, { t: 1, v: -0.12 } ] },
      { kind: 'P', joint: 'r_upper_arm', prop: 'rotation', axis: 'z', restKey: null, keys: [ { t: 0, v: 0.12 }, { t: 1, v: 0.12 } ] },
      { kind: 'P', joint: 'head', prop: 'rotation', axis: 'x', restKey: null, keys: [ { t: 0, v: -0.18 }, { t: 0.5, v: -0.14 }, { t: 1, v: -0.18 } ] },
      // 步态修正（同 Walk）：旧 Run 双腿后摆窗重叠 (0.41, 0.64)+双膝恒屈 0.5~1.1——双蹬相。
      // 交叉循环：左 t0 触地(-0.45)→t0.45 蹬地(+0.30)→t0.6~0.9 摆动(膝峰 0.85 抬脚)；
      // 右腿相位+0.5 幅值减半(触地-0.28/轻蹬+0.15/膝恒 0.40~0.58 僵拖)。后蹬窗无重叠
      { kind: 'P', joint: 'l_upper_leg', prop: 'rotation', axis: 'x', restKey: null, keys: [ { t: 0, v: -0.45 }, { t: 0.15, v: -0.08 }, { t: 0.3, v: 0.18 }, { t: 0.45, v: 0.3 }, { t: 0.6, v: 0 }, { t: 0.75, v: -0.32 }, { t: 0.9, v: -0.42 }, { t: 1, v: -0.45 } ] },
      { kind: 'P', joint: 'r_upper_leg', prop: 'rotation', axis: 'x', restKey: null, keys: [ { t: 0, v: 0.15 }, { t: 0.15, v: 0.02 }, { t: 0.3, v: -0.22 }, { t: 0.5, v: -0.28 }, { t: 0.65, v: -0.14 }, { t: 0.8, v: 0.04 }, { t: 0.9, v: 0.14 }, { t: 1, v: 0.15 } ] },
      { kind: 'P', joint: 'l_lower_leg', prop: 'rotation', axis: 'x', restKey: null, keys: [ { t: 0, v: 0.15 }, { t: 0.15, v: 0.3 }, { t: 0.3, v: 0.22 }, { t: 0.45, v: 0.28 }, { t: 0.6, v: 0.85 }, { t: 0.75, v: 0.55 }, { t: 0.9, v: 0.22 }, { t: 1, v: 0.15 } ] },
      { kind: 'P', joint: 'r_lower_leg', prop: 'rotation', axis: 'x', restKey: null, keys: [ { t: 0, v: 0.42 }, { t: 0.15, v: 0.4 }, { t: 0.3, v: 0.52 }, { t: 0.5, v: 0.58 }, { t: 0.65, v: 0.5 }, { t: 0.8, v: 0.42 }, { t: 0.9, v: 0.4 }, { t: 1, v: 0.42 } ] },
    ];
    // Stagger 受击后仰改偏移制（驼背基线上后仰）
    (a.actions.Stagger || []).forEach(function (t) {
      if (t.joint === 'torso' && t.axis === 'x') t.restKey = 'torso:x';
    });
    // 裙摆动（v0.79.34 跟腿耦合：x 随左大腿同相摆 + 重心左右晃；Die 前摆+下沉穿地，身体贴地）
    if (skirtName) {
      var sk = a.actions;
      sk.Idle = (sk.Idle || []).concat([
        { kind: 'O', joint: skirtName, prop: 'rotation', axis: 'x', restKey: null, keys: [ { t: 0, v: 0.05 }, { t: 0.5, v: 0.02 }, { t: 1, v: 0.05 } ] },
      ]);
      var skirtLegX = function (tracks) {
        var t = tracks.filter(function (x) { return x.joint === 'l_upper_leg' && x.axis === 'x' && x.prop === 'rotation'; })[0];
        return t ? t.keys : null;
      };
      sk.Walk = (sk.Walk || []).concat(skirtTracks(skirtName, skirtLegX(sk.Walk), 0.07));
      sk.Run = (sk.Run || []).concat(skirtTracks(skirtName, skirtLegX(sk.Run), 0.098));
      // Die 不加裙轨道：裙自然挂骨盆随前倒，整体下沉由 Die root 高度轨道负责（v0.79.27 用户方案）
    }
    a.durations = { Idle: 2.2, Walk: 2.2, Run: 1.0, Swing: 1.0, Stagger: 0.5, Die: 1.5 };
    return a;
  }

  // ── 人类士兵动画集派生（v0.79.37b）──
  // 语义约定（烘焙树 = 新数据层，非 legacy 镜像）：upper_arm/upper_leg rotation.x 负=前举/前踢；
  // 躯干 rotation.y=转体（正=右转）；武器/火焰为 O 轨道扩展关节（collectRefs 按名收集）
  // kind: 'guard'（警棍横挥）| 'gun'（双手持枪+据枪射击）| 'rocket'（背负+肩扛发射）
  // Stagger/Die 注入与 Idle 一致的武器姿态恒值轨道（武器位置一致，用户要求）
  function _constTrack(joint, prop, axis, v) {
    return { kind: 'O', joint: joint, prop: prop, axis: axis, restKey: null, keys: [{ t: 0, v: v }, { t: 1, v: v }] };
  }
  function _weaponConstTracks(weapon, rot, pos) {
    var tr = [];
    if (rot) ['x', 'y', 'z'].forEach(function (ax, i) { tr.push(_constTrack(weapon, 'rotation', ax, rot[i] || 0)); });
    if (pos) ['x', 'y', 'z'].forEach(function (ax, i) { tr.push(_constTrack(weapon, 'position', ax, pos[i] || 0)); });
    return tr;
  }
  // 火焰 scale 轨道生成：shots=[t1,t2,...] 发射时刻；peak 亮起倍率
  function _flashTracks(flashNode, shots, peak) {
    var keys = [{ t: 0, v: 0.001 }, { t: 1, v: 0.001 }];
    shots.forEach(function (ts) {
      keys.push({ t: Math.max(0, ts - 0.02), v: 0.001 });
      keys.push({ t: ts, v: peak });
      keys.push({ t: ts + 0.06, v: 0.001 });
    });
    keys.sort(function (a, b) { return a.t - b.t; });
    return ['x', 'y', 'z'].map(function (ax) {
      return { kind: 'O', joint: flashNode, prop: 'scale', axis: ax, restKey: null, keys: keys };
    });
  }
  // 枪兵持枪手臂（low ready：双手都在枪上——右手握把左手托护木，枪口斜向下）
  // ⚠️ 武器世界仰角 y = -sin(upper.x+forearm.x+weapon.x)（实测映射表 probe_axis）
  // 臂组合 -1.5 + 武器 +2.0 → T=+0.5 枪口朝前下 28°（ILEA/SWAT low ready 口径）
  function _gunCarryArmTracks() {
    return [
      { kind: 'P', joint: 'r_upper_arm', prop: 'rotation', axis: 'x', restKey: null, keys: [{ t: 0, v: -0.45 }, { t: 1, v: -0.45 }] },
      { kind: 'P', joint: 'r_upper_arm', prop: 'rotation', axis: 'z', restKey: null, keys: [{ t: 0, v: -0.12 }, { t: 1, v: -0.12 }] },
      { kind: 'P', joint: 'r_forearm', prop: 'rotation', axis: 'x', restKey: null, keys: [{ t: 0, v: -1.05 }, { t: 1, v: -1.05 }] },
      { kind: 'P', joint: 'l_upper_arm', prop: 'rotation', axis: 'x', restKey: null, keys: [{ t: 0, v: -0.5 }, { t: 1, v: -0.5 }] },
      { kind: 'P', joint: 'l_upper_arm', prop: 'rotation', axis: 'z', restKey: null, keys: [{ t: 0, v: -0.5 }, { t: 1, v: -0.5 }] },
      { kind: 'P', joint: 'l_forearm', prop: 'rotation', axis: 'x', restKey: null, keys: [{ t: 0, v: -1.0 }, { t: 1, v: -1.0 }] },
      { kind: 'P', joint: 'l_forearm', prop: 'rotation', axis: 'z', restKey: null, keys: [{ t: 0, v: -0.3 }, { t: 1, v: -0.3 }] },
    ];
  }
  // 武器仰角补偿常量（与臂组合配套，公式见 _gunCarryArmTracks 注释）
  // ⚠️ 左右约定：模型面朝 +Z，第一人称 +X=左 / -X=右（l_eye 在 +X、r_arm 在 -X）
  var GUN_CARRY_COMP = 2.0; // 待机：-1.5 + 2.0 → T=+0.5 枪口朝前下 28°
  var GUN_CARRY_AZI = 0.4; // 待机枪口左偏（rotation.y 正 → 枪口朝 +X 左前方地面，用户方案）
  var GUN_AIM_COMP = 1.65; // 腰射据枪（霰弹枪）：-0.5-1.15 + 1.65 → T=0 水平
  // 贴腮据枪（步枪——用户方案：贴腮用眼通过准星照门瞄准，不腰射）：
  // 臂全水平 -1.5-0.15 + 补偿 1.65 → 枪口水平且枪在腮高（probe 实测 muzzleY 0.928 ≈ cheek 0.941）
  // headZ 正 = 头顶向 -X（右）倾——枪在右手侧，头右倾贴腮（v0.79.37d 镜像修正，原 -0.35 反了）
  var GUN_CHEEK_AIM = {
    rUpperX: -1.5, rUpperZ: -0.12, rForeX: -0.15,
    lUpperX: -1.5, lUpperZ: -0.5, lForeX: -0.15, lForeZ: -0.3,
    weaponX: 1.65, headZ: 0.35,
  };
  // RPG 发射臂组合（真实骨架网格搜索 probe_grip_real：右手到后握把 0.142 / 左手到前握把 0.013）
  var RPG_FIRE_ARMS = {
    rU: { x: 0, z: 0.5 }, rF: { x: -1.9, z: -0.7 },
    lU: { x: -0.4, z: -0.7 }, lF: { x: -0.7, z: -0.5 },
  };
  // 武器挂载静态姿态（collectRefs 复位基准一致）
  var SOLDIER_WEAPON_Mount = {
    baton: { rot: [-0.25, 0, 0], pos: [0, -0.02, 0.03] },
    rifle: { rot: [0, 0, 0], pos: [0.05, -0.02, 0.05] },
    shotgun: { rot: [0, 0, 0], pos: [0.05, -0.02, 0.05] },
    // RPG 斜背（用户方案：右手主手，战斗部从右肩露出——-X 侧）：管轴左下→右上镜像，
    // rx-1.5/ry**-0.95** → 管轴 (-0.81,0.58,0.04)，战斗部尖 (-0.32,0.94,-0.12) 右肩上（v0.79.37d 镜像修正）
    rpg_back: { rot: [-1.5, -0.95, 0], pos: [-0.02, 0, -0.2] },
    // RPG 肩扛据筒（右肩发射）：管沿 +Z 前伸，管位右外侧 x-0.22 肩窝高 y0.18（probe_grip 系列：
    // 此位下双手可握两握把——后握把右手 d0.14 / 前握把左手 d0.01）
    rpg_shoulder: { rot: [0.05, 0, 0], pos: [-0.22, 0.18, 0.15] },
  };
  function deriveSoldierAnims(verAnims, kind, weaponName, flashName) {
    var a = JSON.parse(JSON.stringify(verAnims));
    delete a.actions.Punch; // 人类士兵不用拳击
    var ARM_JOINTS = { l_upper_arm: 1, r_upper_arm: 1, l_forearm: 1, r_forearm: 1 };

    if (kind === 'guard') {
      // 保安：Idle/Walk/Run 骨架原版（单手垂棍）；Attack=横挥警棍（棍顺前臂握持——ILEA 口径：
      // 棍与前臂对齐，力量来自转体+手臂水平摆动；棍补偿轨道全 0，棍随臂横扫不横握）
      a.actions.Swing = [
        // 蓄力：躯干大幅右转后引（横扫主力=腰发力；臂前举水平后 z 轴变滚转，偏摆效率低——probe_sweep 实验）
        { kind: 'O', joint: 'torso', prop: 'rotation', axis: 'y', restKey: null, keys: [{ t: 0, v: 0 }, { t: 0.28, v: 1.0 }, { t: 0.5, v: -0.9 }, { t: 0.75, v: -0.55 }, { t: 1, v: 0 }] },
        { kind: 'O', joint: 'torso', prop: 'rotation', axis: 'x', restKey: null, keys: [{ t: 0, v: 0 }, { t: 0.28, v: -0.08 }, { t: 0.5, v: 0.14 }, { t: 1, v: 0 }] },
        // 右臂举到水平（x=-1.5）；前臂曲臂蓄力→爆发伸直（用户方案：蓄力屈肘缩半径储能，
        // 挥出过程手臂伸直增大末端扫速——鞭/棒发力力学）
        { kind: 'P', joint: 'r_upper_arm', prop: 'rotation', axis: 'x', restKey: null, keys: [{ t: 0, v: 0 }, { t: 0.28, v: -1.5 }, { t: 0.5, v: -1.48 }, { t: 0.75, v: -1.1 }, { t: 1, v: 0 }] },
        { kind: 'P', joint: 'r_upper_arm', prop: 'rotation', axis: 'z', restKey: null, keys: [{ t: 0, v: 0 }, { t: 0.28, v: -0.5 }, { t: 0.5, v: 0.4 }, { t: 0.75, v: 0.35 }, { t: 1, v: 0 }] },
        { kind: 'P', joint: 'r_forearm', prop: 'rotation', axis: 'x', restKey: null, keys: [{ t: 0, v: 0 }, { t: 0.28, v: -1.25 }, { t: 0.4, v: -0.8 }, { t: 0.5, v: -0.1 }, { t: 0.75, v: -0.05 }, { t: 1, v: 0 }] },
        // 左臂配重后展
        { kind: 'P', joint: 'l_upper_arm', prop: 'rotation', axis: 'x', restKey: null, keys: [{ t: 0, v: 0 }, { t: 0.28, v: 0.35 }, { t: 0.5, v: 0.42 }, { t: 1, v: 0 }] },
        { kind: 'P', joint: 'l_upper_arm', prop: 'rotation', axis: 'z', restKey: null, keys: [{ t: 0, v: 0 }, { t: 0.3, v: 0.3 }, { t: 1, v: 0 }] },
        // 弓步：左腿前跨右腿后蹬 + 重心下沉
        { kind: 'P', joint: 'l_upper_leg', prop: 'rotation', axis: 'x', restKey: null, keys: [{ t: 0, v: 0 }, { t: 0.3, v: -0.1 }, { t: 0.5, v: -0.34 }, { t: 0.75, v: -0.28 }, { t: 1, v: 0 }] },
        { kind: 'P', joint: 'l_lower_leg', prop: 'rotation', axis: 'x', restKey: null, keys: [{ t: 0, v: 0 }, { t: 0.5, v: 0.42 }, { t: 0.75, v: 0.35 }, { t: 1, v: 0 }] },
        { kind: 'P', joint: 'r_upper_leg', prop: 'rotation', axis: 'x', restKey: null, keys: [{ t: 0, v: 0 }, { t: 0.5, v: 0.26 }, { t: 0.75, v: 0.2 }, { t: 1, v: 0 }] },
        { kind: 'O', joint: 'pelvis', prop: 'position', axis: 'y', restKey: 'pelvis:y', keys: [{ t: 0, v: 0 }, { t: 0.3, v: -0.015 }, { t: 0.5, v: -0.04 }, { t: 0.75, v: -0.03 }, { t: 1, v: 0 }] },
        // 警棍补偿（probe 实验）：蓄力 -1.9 = 屈肘 -1.25 时棍水平后引过肩（举棍蓄势）；
        // 爆发伸直后 -0.35 棍顺臂近水平横扫
        { kind: 'O', joint: 'ah_wp_baton', prop: 'rotation', axis: 'x', restKey: null, keys: [{ t: 0, v: 0 }, { t: 0.28, v: -1.9 }, { t: 0.4, v: -1.1 }, { t: 0.5, v: -0.35 }, { t: 1, v: 0 }] },
      ];
      a.durations = { Idle: 2.2, Walk: 1.4, Run: 0.8, Swing: 1.0, Stagger: 0.5, Die: 1.5 };
    } else if (kind === 'gun') {
      // 枪兵：Idle/Walk/Run 双手low ready 持枪（手臂替换为持枪恒值，腿/躯干保留步态）
      ['Idle', 'Walk', 'Run'].forEach(function (an) {
        a.actions[an] = (a.actions[an] || []).filter(function (t) { return !ARM_JOINTS[t.joint]; }).concat(_gunCarryArmTracks());
      });
      // 武器仰角补偿：臂组合 -1.5 + 1.0 → 枪口朝前下 29°（low ready）
      ['Idle', 'Walk', 'Run'].forEach(function (an) {
        a.actions[an] = a.actions[an].concat(_weaponConstTracks(weaponName, [GUN_CARRY_COMP, GUN_CARRY_AZI, 0], null));
      });
      // Attack 据枪风格：步枪=贴腮瞄准（枪抬到腮高、头侧倾贴枪、眼过准星照门）；霰弹枪=腰射（保持）
      var isCheek = weaponName === 'ah_wp_rifle';
      var _aX = isCheek ? GUN_CHEEK_AIM : { rUpperX: -0.5, rUpperZ: -0.1, rForeX: -1.15, lUpperX: -0.55, lUpperZ: -0.55, lForeX: -1.05, lForeZ: -0.35, weaponX: GUN_AIM_COMP, headZ: 0 };
      a.actions.Swing = [
        // 双臂据枪（步枪贴腮：臂全水平 -1.5 → 枪在腮高 muzzleY 0.928 ≈ cheek 0.941）
        { kind: 'P', joint: 'r_upper_arm', prop: 'rotation', axis: 'x', restKey: null, keys: [{ t: 0, v: -0.45 }, { t: 0.18, v: _aX.rUpperX }, { t: 0.92, v: _aX.rUpperX }, { t: 1, v: -0.45 }] },
        { kind: 'P', joint: 'r_upper_arm', prop: 'rotation', axis: 'z', restKey: null, keys: [{ t: 0, v: -0.12 }, { t: 0.18, v: _aX.rUpperZ }, { t: 0.92, v: _aX.rUpperZ }, { t: 1, v: -0.12 }] },
        { kind: 'P', joint: 'r_forearm', prop: 'rotation', axis: 'x', restKey: null, keys: [{ t: 0, v: -1.05 }, { t: 0.18, v: _aX.rForeX }, { t: 0.92, v: _aX.rForeX }, { t: 1, v: -1.05 }] },
        { kind: 'P', joint: 'l_upper_arm', prop: 'rotation', axis: 'x', restKey: null, keys: [{ t: 0, v: -0.5 }, { t: 0.18, v: _aX.lUpperX }, { t: 0.92, v: _aX.lUpperX }, { t: 1, v: -0.5 }] },
        { kind: 'P', joint: 'l_upper_arm', prop: 'rotation', axis: 'z', restKey: null, keys: [{ t: 0, v: -0.5 }, { t: 0.18, v: _aX.lUpperZ }, { t: 0.92, v: _aX.lUpperZ }, { t: 1, v: -0.5 }] },
        { kind: 'P', joint: 'l_forearm', prop: 'rotation', axis: 'x', restKey: null, keys: [{ t: 0, v: -1.0 }, { t: 0.18, v: _aX.lForeX }, { t: 0.92, v: _aX.lForeX }, { t: 1, v: -1.0 }] },
        { kind: 'P', joint: 'l_forearm', prop: 'rotation', axis: 'z', restKey: null, keys: [{ t: 0, v: -0.3 }, { t: 0.18, v: _aX.lForeZ }, { t: 0.92, v: _aX.lForeZ }, { t: 1, v: -0.3 }] },
        // 枪身从左下 low ready 转正水平（方位左偏→0，仰角→据枪补偿）
        { kind: 'O', joint: weaponName, prop: 'rotation', axis: 'x', restKey: null, keys: [{ t: 0, v: GUN_CARRY_COMP }, { t: 0.18, v: _aX.weaponX }, { t: 0.92, v: _aX.weaponX }, { t: 1, v: GUN_CARRY_COMP }] },
        { kind: 'O', joint: weaponName, prop: 'rotation', axis: 'y', restKey: null, keys: [{ t: 0, v: GUN_CARRY_AZI }, { t: 0.18, v: 0 }, { t: 0.92, v: 0 }, { t: 1, v: GUN_CARRY_AZI }] },
        // 步枪贴腮：头侧倾贴枪身（霰弹枪腰射头不动）
        { kind: 'P', joint: 'head', prop: 'rotation', axis: 'z', restKey: null, keys: [{ t: 0, v: 0 }, { t: 0.18, v: _aX.headZ }, { t: 0.92, v: _aX.headZ }, { t: 1, v: 0 }] },
        // 后坐抖动：躯干 x 快速震荡（3 连发同步）+ 重心微沉
        { kind: 'O', joint: 'torso', prop: 'rotation', axis: 'x', restKey: null, keys: [{ t: 0, v: 0 }, { t: 0.29, v: 0 }, { t: 0.31, v: 0.045 }, { t: 0.37, v: 0.008 }, { t: 0.54, v: 0 }, { t: 0.56, v: 0.042 }, { t: 0.62, v: 0.006 }, { t: 0.79, v: 0 }, { t: 0.81, v: 0.045 }, { t: 0.87, v: 0.008 }, { t: 1, v: 0 }] },
        { kind: 'O', joint: 'pelvis', prop: 'position', axis: 'y', restKey: 'pelvis:y', keys: [{ t: 0, v: 0 }, { t: 0.3, v: -0.012 }, { t: 0.9, v: -0.012 }, { t: 1, v: 0 }] },
        // 枪口火焰 3 连发
      ].concat(_flashTracks(flashName, [0.3, 0.55, 0.8], 1.6));
      // Stagger/Die：武器与手臂保持 Idle 持枪位（一致要求）
      a.actions.Stagger = (a.actions.Stagger || []).filter(function (t) { return !ARM_JOINTS[t.joint]; }).concat(_gunCarryArmTracks()).concat(_weaponConstTracks(weaponName, [GUN_CARRY_COMP, GUN_CARRY_AZI, 0], null));
      a.actions.Die = (a.actions.Die || []).filter(function (t) { return !ARM_JOINTS[t.joint]; }).concat(_gunCarryArmTracks()).concat(_weaponConstTracks(weaponName, [GUN_CARRY_COMP, GUN_CARRY_AZI, 0], null));
      a.durations = { Idle: 2.2, Walk: 1.4, Run: 0.8, Swing: 1.2, Stagger: 0.5, Die: 1.5 };
    } else {
      // 火箭筒兵：Idle/Walk/Run 背负火箭筒（武器恒值=背负位；摆臂幅值减半防穿背筒）
      ['Idle', 'Walk', 'Run'].forEach(function (an) {
        a.actions[an] = (a.actions[an] || []).map(function (t) {
          if (ARM_JOINTS[t.joint]) {
            t.keys = t.keys.map(function (k) { return { t: k.t, v: k.v * 0.5 }; });
          }
          return t;
        }).concat(_weaponConstTracks(weaponName, SOLDIER_WEAPON_Mount.rpg_back.rot, SOLDIER_WEAPON_Mount.rpg_back.pos));
      });
      // Attack：卸筒上肩 → 瞄准 → 前后火焰 + 战斗部射出 → 回背
      // 肩扛位（SOLDIER_WEAPON_Mount.rpg_shoulder）：管轴沿 +Z 水平朝前、筒在右肩上方
      a.actions.Swing = [
        // 武器斜背→肩扛（右肩发射：起点 rpg_back 斜背镜像 → 终点 rpg_shoulder 右肩窝）
        { kind: 'O', joint: weaponName, prop: 'position', axis: 'x', restKey: null, keys: [{ t: 0, v: -0.02 }, { t: 0.22, v: -0.22 }, { t: 0.88, v: -0.22 }, { t: 1, v: -0.02 }] },
        { kind: 'O', joint: weaponName, prop: 'position', axis: 'y', restKey: null, keys: [{ t: 0, v: 0 }, { t: 0.22, v: 0.18 }, { t: 0.88, v: 0.18 }, { t: 1, v: 0 }] },
        { kind: 'O', joint: weaponName, prop: 'position', axis: 'z', restKey: null, keys: [{ t: 0, v: -0.2 }, { t: 0.22, v: 0.15 }, { t: 0.88, v: 0.15 }, { t: 1, v: -0.2 }] },
        { kind: 'O', joint: weaponName, prop: 'rotation', axis: 'x', restKey: null, keys: [{ t: 0, v: -1.5 }, { t: 0.22, v: 0.05 }, { t: 0.88, v: 0.05 }, { t: 1, v: -1.5 }] },
        { kind: 'O', joint: weaponName, prop: 'rotation', axis: 'y', restKey: null, keys: [{ t: 0, v: -0.95 }, { t: 0.22, v: 0 }, { t: 0.88, v: 0 }, { t: 1, v: -0.95 }] },
        { kind: 'O', joint: weaponName, prop: 'rotation', axis: 'z', restKey: null, keys: [{ t: 0, v: 0 }, { t: 0.22, v: 0 }, { t: 0.88, v: 0 }, { t: 1, v: 0 }] },
        // 双手握把（probe_grip_real 网格搜索）：右手握后握把（扳机位）+ 左手横跨扶前握把
        { kind: 'P', joint: 'r_upper_arm', prop: 'rotation', axis: 'x', restKey: null, keys: [{ t: 0, v: 0 }, { t: 0.25, v: RPG_FIRE_ARMS.rU.x }, { t: 0.85, v: RPG_FIRE_ARMS.rU.x }, { t: 1, v: 0 }] },
        { kind: 'P', joint: 'r_upper_arm', prop: 'rotation', axis: 'z', restKey: null, keys: [{ t: 0, v: 0 }, { t: 0.25, v: RPG_FIRE_ARMS.rU.z }, { t: 0.85, v: RPG_FIRE_ARMS.rU.z }, { t: 1, v: 0 }] },
        { kind: 'P', joint: 'r_forearm', prop: 'rotation', axis: 'x', restKey: null, keys: [{ t: 0, v: 0 }, { t: 0.25, v: RPG_FIRE_ARMS.rF.x }, { t: 0.85, v: RPG_FIRE_ARMS.rF.x }, { t: 1, v: 0 }] },
        { kind: 'P', joint: 'r_forearm', prop: 'rotation', axis: 'z', restKey: null, keys: [{ t: 0, v: 0 }, { t: 0.25, v: RPG_FIRE_ARMS.rF.z }, { t: 0.85, v: RPG_FIRE_ARMS.rF.z }, { t: 1, v: 0 }] },
        { kind: 'P', joint: 'l_upper_arm', prop: 'rotation', axis: 'x', restKey: null, keys: [{ t: 0, v: 0 }, { t: 0.25, v: RPG_FIRE_ARMS.lU.x }, { t: 0.85, v: RPG_FIRE_ARMS.lU.x }, { t: 1, v: 0 }] },
        { kind: 'P', joint: 'l_upper_arm', prop: 'rotation', axis: 'z', restKey: null, keys: [{ t: 0, v: 0 }, { t: 0.25, v: RPG_FIRE_ARMS.lU.z }, { t: 0.85, v: RPG_FIRE_ARMS.lU.z }, { t: 1, v: 0 }] },
        { kind: 'P', joint: 'l_forearm', prop: 'rotation', axis: 'x', restKey: null, keys: [{ t: 0, v: 0 }, { t: 0.25, v: RPG_FIRE_ARMS.lF.x }, { t: 0.85, v: RPG_FIRE_ARMS.lF.x }, { t: 1, v: 0 }] },
        { kind: 'P', joint: 'l_forearm', prop: 'rotation', axis: 'z', restKey: null, keys: [{ t: 0, v: 0 }, { t: 0.25, v: RPG_FIRE_ARMS.lF.z }, { t: 0.85, v: RPG_FIRE_ARMS.lF.z }, { t: 1, v: 0 }] },
        // 头部瞄准微调
        { kind: 'P', joint: 'head', prop: 'rotation', axis: 'x', restKey: null, keys: [{ t: 0, v: 0 }, { t: 0.25, v: 0.1 }, { t: 0.85, v: 0.1 }, { t: 1, v: 0 }] },
        // 发射后坐：躯干后仰回弹 + 重心下沉
        { kind: 'O', joint: 'torso', prop: 'rotation', axis: 'x', restKey: null, keys: [{ t: 0, v: 0 }, { t: 0.43, v: 0 }, { t: 0.47, v: 0.09 }, { t: 0.6, v: 0.02 }, { t: 1, v: 0 }] },
        { kind: 'O', joint: 'pelvis', prop: 'position', axis: 'y', restKey: 'pelvis:y', keys: [{ t: 0, v: 0 }, { t: 0.45, v: -0.015 }, { t: 0.85, v: -0.015 }, { t: 1, v: 0 }] },
        // 前后双向火焰 + 战斗部射出
      ]
        .concat(_flashTracks('ah_wp_rpg_flash_f', [0.45], 1.6))
        .concat(_flashTracks('ah_wp_rpg_flash_b', [0.45], 1.4))
        .concat([
          { kind: 'O', joint: 'ah_wp_rpg_warhead', prop: 'position', axis: 'z', restKey: null, keys: [{ t: 0, v: 0 }, { t: 0.44, v: 0 }, { t: 0.47, v: 0.35 }, { t: 0.62, v: 4.5 }, { t: 1, v: 4.5 }] },
        ]);
      // Stagger/Die：武器恒值=背负位（与 Idle 一致）
      ['Stagger', 'Die'].forEach(function (an) {
        a.actions[an] = (a.actions[an] || []).concat(_weaponConstTracks(weaponName, SOLDIER_WEAPON_Mount.rpg_back.rot, SOLDIER_WEAPON_Mount.rpg_back.pos));
      });
      a.durations = { Idle: 2.2, Walk: 1.4, Run: 0.8, Swing: 1.6, Stagger: 0.5, Die: 1.5 };
    }
    return a;
  }

  var MODELS = {};
  // 士兵变体动画参数（kind/武器名/火焰名）
  var SOLDIER_ANIM_CFG = {
    guard: ['guard', 'ah_wp_baton', null],
    rifleman: ['gun', 'ah_wp_rifle', 'ah_wp_rf_flash'],
    shotgunner: ['gun', 'ah_wp_shotgun', 'ah_wp_sg_flash'],
    rocketeer: ['rocket', 'ah_wp_rpg', null],
  };
  Object.keys(VARIANT_SKELETON).forEach(function (vk) {
    var hv = HUMANOID_VARIANTS[vk];
    var body = VARIANT_BODY[vk];
    MODELS[vk] = {
      _skeletonVer: VARIANT_SKELETON[vk],
      tree: bakeModel(VARIANT_SKELETON[vk], {
        build: body.build,
        hunch: body.hunch,
        curves: body.curves,
        addons: hv.addons,
        materials: hv.materials,
        _variantKey: vk,
      }),
      anims: null,
      // 人类士兵（活人）：不派生丧尸动画集（驼背/拖行/奔袭），
      // anims = deriveSoldierAnims 士兵专属动画集（持枪/背负/横挥/射击特效）
      zombieAnims: HUMAN_SOLDIER_VARIANTS[vk]
        ? null
        : deriveZombieAnims(
            SKELETON_VERSIONS[VARIANT_SKELETON[vk]].anims,
            vk === 'student_f' ? 'ah_skirt' : vk === 'teacher_f' ? 'ah_gskirt' : null,
            vk === 'teacher_m' ? 0.09 : vk === 'teacher_f' ? 0.12 : 0.1,
            SKELETON_VERSIONS[VARIANT_SKELETON[vk]].tree.position[1]
          ),
    };
    var verAnims = SKELETON_VERSIONS[VARIANT_SKELETON[vk]] && SKELETON_VERSIONS[VARIANT_SKELETON[vk]].anims;
    if (HUMAN_SOLDIER_VARIANTS[vk] && verAnims && SOLDIER_ANIM_CFG[vk]) {
      var sc = SOLDIER_ANIM_CFG[vk];
      MODELS[vk].anims = deriveSoldierAnims(verAnims, sc[0], sc[1], sc[2]);
    } else if (verAnims) {
      MODELS[vk].anims = JSON.parse(JSON.stringify(verAnims));
    }
  });
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
