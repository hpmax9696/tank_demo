// 虎式坦克 (Tiger I) v1.0 — 程序化模型
// 参照混元3D高精模型提取比例，复用 t34_v16_builder 的构建函数
(function () {
  'use strict';

  const TIGER_I_V16_CONFIG = {
    name: '虎式坦克 v1.0',
    type: 'Group',
    position: [0, -0.15, 0],
    rotation: [0, 0, 0],
    scale: [0.5, 0.5, 0.5],
    children: [
      {
        name: '车体',
        type: 'Group',
        position: [0, 0, 0],
        children: [
          {
            name: '下车体',
            type: 'TaperedBox',
            size: [2.8, 0.8, 5.6, 2.8, 6.2, 0, 0],
            position: [0, 1.145, -0.1],
            materialId: 'camo_green',
            visible: true,
            rotation: [0, 0, 0],
          },
          {
            name: '上车体',
            type: 'TaperedBox',
            size: [3.9, 0.6, 5.8, 3.9, 6.3, null, -0.255],
            position: [0, 1.848, -0.7],
            materialId: 'camo_green',
            visible: true,
            rotation: [0, 0, 0],
          },
          {
            name: '首上装甲',
            type: 'Box',
            size: [2.6, 0.7, 0.1],
            position: [0, 1.61, 2.854],
            materialId: 'camo_green',
            visible: true,
            rotation: [-1.3963, 0, 0],
          },
          {
            name: '首下装甲',
            type: 'Box',
            size: [2.7, 1, 0.1],
            position: [0, 1.1, 2.89],
            materialId: 'camo_green',
            visible: true,
            rotation: [0.5236, 0, 0],
          },
          {
            name: '发动机舱盖',
            type: 'Box',
            size: [3.8, 0.06, 2.4],
            position: [0, 2.168, -2.6],
            materialId: 'camo_dark',
            visible: true,
            rotation: [0, 0, 0],
          },
          {
            name: '格栅1',
            type: 'Box',
            size: [3.7, 0.01, 0.02],
            position: [0, 2.208, -3.05],
            materialId: 'dark_steel',
            visible: true,
            rotation: [0, 0, 0],
          },
          {
            name: '格栅2',
            type: 'Box',
            size: [3.7, 0.01, 0.02],
            position: [0, 2.208, -2.9],
            materialId: 'dark_steel',
            visible: true,
            rotation: [0, 0, 0],
          },
          {
            name: '格栅3',
            type: 'Box',
            size: [3.7, 0.01, 0.02],
            position: [0, 2.208, -2.75],
            materialId: 'dark_steel',
            visible: true,
            rotation: [0, 0, 0],
          },
          {
            name: '格栅4',
            type: 'Box',
            size: [3.7, 0.01, 0.02],
            position: [0, 2.208, -2.6],
            materialId: 'dark_steel',
            visible: true,
            rotation: [0, 0, 0],
          },
          {
            name: '右翼子板',
            type: 'Box',
            size: [0.3, 0.05, 5.9],
            position: [-2.1, 1.64, -0.5],
            materialId: 'camo_green',
            visible: true,
            rotation: [-0.0349, 0, 0.1745],
          },
          {
            name: '左翼子板',
            type: 'Box',
            size: [0.3, 0.05, 5.9],
            position: [2.1, 1.644, -0.5],
            materialId: 'camo_green',
            visible: true,
            rotation: [-0.0349, 0, -0.1745],
          },
          {
            name: '右前挡泥板',
            type: 'Box',
            size: [0.95, 0.04, 0.8],
            position: [-1.78, 1.65, 2.8],
            rotation: [0.1745, 0, 0],
            materialId: 'camo_green',
            visible: true,
          },
          {
            name: '左前挡泥板',
            type: 'Box',
            size: [0.95, 0.04, 0.8],
            position: [1.78, 1.65, 2.8],
            rotation: [0.1745, 0, 0],
            materialId: 'camo_green',
            visible: true,
          },
          {
            name: '航向机枪口',
            type: 'Cylinder',
            size: [0.03, 0.3, 0.03],
            position: [-0.6, 1.921, 2.58],
            materialId: 'dark_steel',
            visible: true,
            rotation: [1.5708, 0, 0],
            segments: [12],
          },
          {
            name: '驾驶员观察口',
            type: 'Box',
            size: [0.4, 0.06, 0.16],
            position: [0.6, 1.921, 2.4],
            materialId: 'dark_steel',
            visible: true,
            rotation: [0, 0, 0],
          },
          {
            name: '右排气管',
            type: 'Cylinder',
            size: [0.15, 0.35, 0.15],
            segments: [12],
            position: [-0.7, 1.76, -3.662],
            materialId: 'camo_dark',
            visible: true,
            rotation: [-0.6807, 0, 0],
          },
          {
            name: '左排气管',
            type: 'Cylinder',
            size: [0.15, 0.35, 0.15],
            segments: [12],
            position: [0.7, 1.76, -3.662],
            materialId: 'camo_dark',
            visible: true,
            rotation: [-0.6807, 0, 0],
          },
          {
            name: '右工具1',
            type: 'Box',
            size: [0.012, 0.03, 0.35],
            position: [-1.95, 1.956, -0.2],
            rotation: [0, 0, 0.1],
            materialId: 'wood',
            visible: true,
          },
          {
            name: '左工具1',
            type: 'Box',
            size: [0.012, 0.028, 0.4],
            position: [1.95, 1.956, 0.4],
            rotation: [0, 0, -0.05],
            materialId: 'wood',
            visible: true,
          },
          {
            name: '前牵引缆绳',
            type: 'Torus',
            size: [0.2, 0.018],
            segments: [6, 14],
            position: [0, 1.256, 3.004],
            rotation: [1.5708, 0, 0],
            materialId: 'dark_steel',
            visible: true,
          },
          {
            name: '左后挡泥板',
            type: 'Box',
            size: [0.95, 0.04, 0.7],
            position: [1.78, 1.22, -3.6],
            materialId: 'camo_dark',
            rotation: [-1.1187, 0, 0],
            visible: true,
          },
          {
            name: '右后挡泥板',
            type: 'Box',
            size: [0.95, 0.04, 0.7],
            position: [-1.78, 1.25, -3.6],
            materialId: 'camo_dark',
            rotation: [-1.1187, 0, 0],
            visible: true,
          },
        ],
        rotation: [0, 0, 0],
        visible: true,
      },
      {
        name: '右负重轮1',
        type: 'Cylinder',
        size: [0.48, 0.09, 0.48],
        segments: [16],
        position: [-1.953, 0.85, 1.7],
        rotation: [0, 0, 1.5708],
        materialId: 'steel',
        visible: true,
      },
      {
        name: '右内轮1',
        type: 'Cylinder',
        size: [0.48, 0.09, 0.48],
        segments: [16],
        position: [-1.653, 0.85, 1.25],
        rotation: [0, 0, 1.5708],
        materialId: 'steel',
        visible: true,
      },
      {
        name: '右负重轮2',
        type: 'Cylinder',
        size: [0.48, 0.09, 0.48],
        segments: [16],
        position: [-1.953, 0.85, 0.57],
        rotation: [0, 0, 1.5708],
        materialId: 'steel',
        visible: true,
      },
      {
        name: '右内轮2',
        type: 'Cylinder',
        size: [0.48, 0.09, 0.48],
        segments: [16],
        position: [-1.653, 0.85, 0.12],
        rotation: [0, 0, 1.5708],
        materialId: 'steel',
        visible: true,
      },
      {
        name: '右负重轮3',
        type: 'Cylinder',
        size: [0.48, 0.09, 0.48],
        segments: [16],
        position: [-1.953, 0.85, -0.57],
        rotation: [0, 0, 1.5708],
        materialId: 'steel',
        visible: true,
      },
      {
        name: '右内轮3',
        type: 'Cylinder',
        size: [0.48, 0.09, 0.48],
        segments: [16],
        position: [-1.653, 0.85, -1.02],
        rotation: [0, 0, 1.5708],
        materialId: 'steel',
        visible: true,
      },
      {
        name: '右负重轮4',
        type: 'Cylinder',
        size: [0.48, 0.09, 0.48],
        segments: [16],
        position: [-1.953, 0.85, -1.7],
        rotation: [0, 0, 1.5708],
        materialId: 'steel',
        visible: true,
      },
      {
        name: '右内轮4',
        type: 'Cylinder',
        size: [0.48, 0.09, 0.48],
        segments: [16],
        position: [-1.653, 0.85, -2.15],
        rotation: [0, 0, 1.5708],
        materialId: 'steel',
        visible: true,
      },
      {
        name: '左负重轮1',
        type: 'Cylinder',
        size: [0.48, 0.09, 0.48],
        segments: [16],
        position: [1.949, 0.85, 1.7],
        rotation: [0, 0, 1.5708],
        materialId: 'steel',
        visible: true,
      },
      {
        name: '左内轮1',
        type: 'Cylinder',
        size: [0.48, 0.09, 0.48],
        segments: [16],
        position: [1.649, 0.85, 1.25],
        rotation: [0, 0, 1.5708],
        materialId: 'steel',
        visible: true,
      },
      {
        name: '左负重轮2',
        type: 'Cylinder',
        size: [0.48, 0.09, 0.48],
        segments: [16],
        position: [1.949, 0.85, 0.57],
        rotation: [0, 0, 1.5708],
        materialId: 'steel',
        visible: true,
      },
      {
        name: '左内轮2',
        type: 'Cylinder',
        size: [0.48, 0.09, 0.48],
        segments: [16],
        position: [1.649, 0.85, 0.12],
        rotation: [0, 0, 1.5708],
        materialId: 'steel',
        visible: true,
      },
      {
        name: '左负重轮3',
        type: 'Cylinder',
        size: [0.48, 0.09, 0.48],
        segments: [16],
        position: [1.949, 0.85, -0.57],
        rotation: [0, 0, 1.5708],
        materialId: 'steel',
        visible: true,
      },
      {
        name: '左内轮3',
        type: 'Cylinder',
        size: [0.48, 0.09, 0.48],
        segments: [16],
        position: [1.649, 0.85, -1.02],
        rotation: [0, 0, 1.5708],
        materialId: 'steel',
        visible: true,
      },
      {
        name: '左负重轮4',
        type: 'Cylinder',
        size: [0.48, 0.09, 0.48],
        segments: [16],
        position: [1.949, 0.85, -1.7],
        rotation: [0, 0, 1.5708],
        materialId: 'steel',
        visible: true,
      },
      {
        name: '左内轮4',
        type: 'Cylinder',
        size: [0.48, 0.09, 0.48],
        segments: [16],
        position: [1.649, 0.85, -2.15],
        rotation: [0, 0, 1.5708],
        materialId: 'steel',
        visible: true,
      },
      {
        name: '右诱导轮',
        type: 'Cylinder',
        size: [0.48, 0.08, 0.48],
        segments: [16],
        position: [-1.801, 1.05, 2.4],
        rotation: [0, 0, 1.5708],
        materialId: 'dark_steel',
        visible: true,
      },
      {
        name: '左诱导轮',
        type: 'Cylinder',
        size: [0.48, 0.08, 0.48],
        segments: [16],
        position: [1.8, 1.05, 2.4],
        rotation: [0, 0, 1.5708],
        materialId: 'dark_steel',
        visible: true,
      },
      {
        name: '右主动轮',
        type: 'Cylinder',
        size: [0.45, 0.1, 0.45],
        segments: [16],
        position: [-1.801, 0.9, -2.9],
        rotation: [0, 0, 1.5708],
        materialId: 'dark_steel',
        visible: true,
      },
      {
        name: '左主动轮',
        type: 'Cylinder',
        size: [0.45, 0.1, 0.45],
        segments: [16],
        position: [1.8, 0.9, -2.9],
        rotation: [0, 0, 1.5708],
        materialId: 'dark_steel',
        visible: true,
      },
      {
        name: '右履带',
        type: 'TrackChain',
        position: [-1.801, 0.3, 0],
        trackParams: {
          wheelCenterZFront: 2.4,
          wheelCenterYFront: 0.75,
          wheelRadiusFront: 0.48,
          wheelCenterZRear: -2.9,
          wheelCenterYRear: 0.6,
          wheelRadiusRear: 0.45,
          roadWheelFrontZ: 1.7,
          roadWheelRearZ: -1.7,
          roadWheelY: 0.55,
          roadWheelRadius: 0.48,
          count: 122,
          plateWidth: 0.85,
          plateHeight: 0.06,
          plateDepth: 0.08,
        },
        materialId: 'dark_steel',
        visible: true,
        rotation: [0, 0, 0],
      },
      {
        name: '左履带',
        type: 'TrackChain',
        position: [1.8, 0.3, 0],
        trackParams: {
          wheelCenterZFront: 2.4,
          wheelCenterYFront: 0.75,
          wheelRadiusFront: 0.48,
          wheelCenterZRear: -2.9,
          wheelCenterYRear: 0.6,
          wheelRadiusRear: 0.45,
          roadWheelFrontZ: 1.7,
          roadWheelRearZ: -1.7,
          roadWheelY: 0.55,
          roadWheelRadius: 0.48,
          count: 122,
          plateWidth: 0.85,
          plateHeight: 0.06,
          plateDepth: 0.08,
        },
        materialId: 'dark_steel',
        visible: true,
        rotation: [0, 0, 0],
      },
      {
        name: '炮塔总成',
        type: 'Group',
        position: [0, 3.3557, 0.083],
        children: [
          {
            name: '炮塔主体',
            type: 'ProfiledExtrude',
            shape: [
              ['line', 0.387, 0.527],
              ['line', -0.369, 0.528],
              ['line', -0.747, -0.191],
              ['arc', 0.009, -0.412, 0.786, 2.85, 0.295],
              ['line', 0.76, -0.186],
            ],
            roofProfile: [
              [0.1, 0.73],
              [0.02, 1.92],
              [-0.22, 0.98],
            ],
            segments: [24],
            position: [0, -0.6345, 0.13],
            rotation: [-1.5708, 0, 3.1416],
            materialId: 'camo_dark',
            visible: true,
            shapeScale: [2, 2],
          },
          {
            name: '炮塔前板',
            type: 'Box',
            size: [1.4, 0.6, 0.06],
            position: [0, -0.7716, 1.8769],
            materialId: 'camo_dark',
            visible: true,
            rotation: [0, 0, 0],
          },
          {
            name: '炮塔尾舱',
            type: 'ProfiledExtrude',
            size: [1],
            position: [0, -0.653, -1.8001],
            materialId: 'camo_dark',
            visible: true,
            rotation: [-1.5708, 0, 0],
            shape: [
              ['arc', 0.006, 0.154, 0.822, 0.7853981633974483, 2.356194490192345],
              ['arc', 0.009, -0.183, 0.808, 2.115, 1.046, true],
            ],
            extrudeDepth: 0.3,
            bevelThickness: 0.02,
            segments: [24],
            roofProfile: [
              [0.4, 0.55],
              [-0.4, 0.55],
            ],
            shapeScale: [2, 2],
          },
          {
            name: '指挥塔基座',
            type: 'Cylinder',
            size: [0.5, 0.06, 0.5],
            segments: [12],
            position: [0.5809, -0.1214, -0.5198],
            materialId: 'camo_dark',
            visible: true,
            rotation: [0, 0, 0],
          },
          {
            name: '指挥塔舱盖',
            type: 'Cylinder',
            size: [0.45, 0.02, 0.45],
            segments: [12],
            position: [0.5809, -0.0867, -0.5198],
            materialId: 'camo_green',
            visible: true,
            rotation: [0, 0, 0],
          },
          {
            name: '装填手舱盖',
            type: 'RoundedBox',
            size: [0.8, 0.05, 0.5, 0.01],
            segments: [3],
            position: [-0.5273, -0.139, -0.5095],
            materialId: 'camo_green',
            visible: true,
            rotation: [0, 0, 0],
          },
          {
            name: '防空机枪架',
            type: 'Torus',
            size: [0.5, 0.015],
            segments: [8, 20],
            position: [0.5809, -0.0046, -0.5198],
            rotation: [1.5708, 0, 0],
            materialId: 'dark_steel',
            visible: true,
          },
          {
            name: '天线基座',
            type: 'Cylinder',
            size: [0.01, 1.5, 0.01],
            segments: [8],
            position: [-0.405, 0.5851, -1.0979],
            materialId: 'dark_steel',
            visible: true,
            rotation: [0, 0, 0],
          },
          {
            name: '炮管总成',
            type: 'Group',
            position: [0, 0.7, 0.65],
            children: [
              {
                name: '炮盾',
                type: 'Cylinder',
                size: [0.1, 0.5, 0.15],
                segments: [18],
                position: [0, -1.4716, 1.5069],
                rotation: [1.5708, 0, 0],
                materialId: 'camo_green',
                visible: true,
              },
              {
                name: '主炮管',
                type: 'Cylinder',
                size: [0.08, 4.8, 0.09],
                segments: [16],
                position: [0, -1.4716, 2.1969],
                rotation: [1.5708, 0, 0],
                materialId: 'camo_green',
                visible: true,
              },
              {
                name: '抽烟器',
                type: 'Cylinder',
                size: [0.095, 1, 0.095],
                segments: [18],
                position: [0, -1.4716, 1.6969],
                rotation: [1.5708, 0, 0],
                materialId: 'camo_dark',
                visible: true,
              },
              {
                name: '炮口制退器',
                type: 'Cylinder',
                size: [0.095, 0.3, 0.105],
                segments: [16],
                position: [0, -1.4716, 4.5969],
                rotation: [1.5708, 0, 0],
                materialId: 'camo_dark',
                visible: true,
              },
              {
                name: '同轴机枪',
                type: 'Cylinder',
                size: [0.02, 0.25, 0.02],
                segments: [6],
                position: [0.1811, -1.4833, 1.3544],
                rotation: [1.5708, 0, 0],
                materialId: 'camo_dark',
                visible: true,
              },
            ],
            rotation: [0, 0, 0],
            visible: true,
          },
          {
            name: '高射机枪',
            type: 'Group',
            position: [-0.5851, 1.2894, 0.3576],
            children: [
              {
                name: 'MG枢轴支柱',
                type: 'Cylinder',
                size: [0.025, 0.12, 0.025],
                segments: [8],
                position: [0.68, -1.2416, -0.81],
                rotation: [0, 0, 0],
                materialId: 'dark_steel',
                visible: true,
              },
              {
                name: 'MG机匣',
                type: 'Box',
                size: [0.06, 0.08, 0.26],
                position: [0.68, -1.1428, -0.84],
                rotation: [0, 0, 0],
                materialId: 'dark_steel',
                visible: true,
              },
              {
                name: 'MG散热套管',
                type: 'Cylinder',
                size: [0.03, 0.38, 0.03],
                segments: [12],
                position: [0.68, -1.1403, -0.5247],
                rotation: [1.5708, 0, 0],
                materialId: 'barrel_steel',
                visible: true,
              },
              {
                name: 'MG枪管尖',
                type: 'Cylinder',
                size: [0.008, 0.07, 0.008],
                segments: [8],
                position: [0.68, -1.1403, -0.3326],
                rotation: [1.5708, 0, 0],
                materialId: 'steel',
                visible: true,
              },
              {
                name: 'MG左弹鼓',
                type: 'Cylinder',
                size: [0.055, 0.06, 0.055],
                segments: [16],
                position: [0.65, -1.2244, -0.8877],
                rotation: [1.5708, 0, 0],
                materialId: 'camo_dark',
                visible: true,
              },
              {
                name: 'MG右弹鼓',
                type: 'Cylinder',
                size: [0.055, 0.06, 0.055],
                segments: [16],
                position: [0.71, -1.2244, -0.8877],
                rotation: [1.5708, 0, 0],
                materialId: 'camo_dark',
                visible: true,
              },
              {
                name: 'MG握把',
                type: 'Box',
                size: [0.02, 0.08, 0.02],
                position: [0.68, -1.1916, -0.9482],
                rotation: [0.2769, 0, 0],
                materialId: 'wood',
                visible: true,
              },
              {
                name: 'MG环形瞄具',
                type: 'Torus',
                size: [0.01, 0.005],
                segments: [6, 16],
                position: [0.68, -1.0966, -0.35],
                rotation: [0, 0, 0],
                materialId: 'steel',
                visible: true,
              },
              {
                name: 'MG枪托',
                type: 'TaperedBox',
                size: [0.02, 0.3, 0.1, 0.02, 0.03, null, -0.025236850184762117],
                position: [0.68, -1.1616, -1.0477],
                materialId: 'camo_dark',
                rotation: [1.5708, 0, 0],
                visible: true,
              },
            ],
            rotation: [0, 0, 0],
            visible: true,
          },
          {
            name: '炮塔座圈',
            type: 'Cylinder',
            size: [1.5, 0.1, 1.5],
            position: [0, -1.1732, 0.13],
            materialId: 'camo_dark',
            rotation: [0, 0, 0],
            visible: true,
            segments: [20],
          },
        ],
        rotation: [0, 0, 0],
        visible: true,
      },
    ],
    visible: true,
  };

  // ─── 暴露 ───
  window.TigerIBuilder = {
    buildAnimatedTigerI: function (options) {
      const camoColor = (options && options.camoColor) || 'green';
      const isDesert = camoColor === 'desert';
      const config = JSON.parse(JSON.stringify(TIGER_I_V16_CONFIG));

      const tankRoot = new THREE.Group();
      tankRoot.name = '虎式坦克 v1.0';
      const wheelList = [];

      if (window.T34V16Builder && T34V16Builder.buildFromConfig) {
        T34V16Builder.buildFromConfig(config, tankRoot, wheelList, isDesert);
      }

      tankRoot.updateMatrixWorld();

      const turretGroup = findGroupByName(tankRoot, '炮塔总成');
      let turretPivot = null,
        barrelPivot = null;
      const leftWheels = [],
        rightWheels = [];
      let mgGroup = null;

      if (turretGroup && turretGroup.parent) {
        let ringGroup = null;
        turretGroup.traverse((c) => {
          if ((c.name === '炮塔主体' || c.name === '炮塔主体_mesh') && !ringGroup) ringGroup = c;
        });
        const ringWorld = new THREE.Vector3();
        if (ringGroup) ringGroup.getWorldPosition(ringWorld);
        const turretWorld = new THREE.Vector3();
        turretGroup.getWorldPosition(turretWorld);
        const parent = turretGroup.parent;
        const ringLocal = parent.worldToLocal(ringWorld);
        const turretLocal = parent.worldToLocal(turretWorld);

        turretPivot = new THREE.Group();
        turretPivot.name = 'turretPivot';
        turretPivot.position.copy(ringLocal);
        parent.add(turretPivot);
        parent.remove(turretGroup);
        turretGroup.position.copy(turretLocal).sub(ringLocal);
        turretGroup.rotation.set(0, 0, 0);
        turretPivot.add(turretGroup);

        const barrelGroup = findGroupByName(turretPivot, '炮管总成');
        if (barrelGroup && barrelGroup.parent) {
          let mantletGroup = null;
          barrelGroup.traverse((c) => {
            if ((c.name === '炮盾' || c.name === '炮盾_mesh') && !mantletGroup) mantletGroup = c;
          });
          if (mantletGroup) {
            const mw = new THREE.Vector3();
            mantletGroup.getWorldPosition(mw);
            const bw = new THREE.Vector3();
            barrelGroup.getWorldPosition(bw);
            const bp = barrelGroup.parent;
            const mLocal = bp.worldToLocal(mw);
            const bLocal = bp.worldToLocal(bw);
            barrelPivot = new THREE.Group();
            barrelPivot.name = 'barrelPivot';
            barrelPivot.position.copy(mLocal);
            bp.add(barrelPivot);
            bp.remove(barrelGroup);
            barrelGroup.position.copy(bLocal).sub(mLocal);
            barrelGroup.rotation.set(0, 0, 0);
            barrelPivot.add(barrelGroup);
          }
        }

        mgGroup = findGroupByName(turretPivot, '高射机枪');
      }

      // 收集轮子（只收负重轮/主动轮/诱导轮，不收履带板）
      for (const w of wheelList) {
        if (!w.position) continue;
        if (w.position.x < 0) leftWheels.push(w);
        else rightWheels.push(w);
      }

      tankRoot.traverse((c) => {
        if (c.isMesh) {
          c.castShadow = true;
          c.receiveShadow = true;
        }
      });

      // ── 后处理：为4个外轮站添加橡胶环（方向沿X轴匹配轮子） ──
      const rubberMat = new THREE.MeshStandardMaterial({
        color: 0x1a1a1a,
        roughness: 0.95,
        metalness: 0.04,
      });
      const hubMat = new THREE.MeshStandardMaterial({
        color: 0x777777,
        roughness: 0.35,
        metalness: 0.6,
      });
      // 每站一个橡胶轮缘环 + 轮毂环
      for (const w of [...leftWheels, ...rightWheels]) {
        if (!w.position || !w.name || !w.name.includes('负重轮') || w.name.includes('内轮'))
          continue;
        // 橡胶轮缘 — 用Torus匹配轮面方向（绕Y轴90°使面朝X）
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.025, 8, 20), rubberMat);
        ring.position.copy(w.position);
        ring.position.x += w.position.x > 0 ? 0.055 : -0.055;
        ring.rotation.set(0, Math.PI / 2, 0);
        w.parent.add(ring);
        // 轮毂小环
        const hubRing = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.012, 6, 14), hubMat);
        hubRing.position.copy(w.position);
        hubRing.position.x += w.position.x > 0 ? 0.055 : -0.055;
        hubRing.rotation.set(0, Math.PI / 2, 0);
        w.parent.add(hubRing);
      }

      return {
        group: tankRoot,
        turretPivot,
        barrelPivot,
        leftWheels,
        rightWheels,
        mgGroup,
        barrelTipLocal: new THREE.Vector3(0, 0, 3.5),
      };
    },
    TIGER_I_V16_CONFIG,
    findGroupByName,
  };

  function findGroupByName(root, name) {
    let found = null;
    root.traverse((c) => {
      if (c.name === name && c.isGroup) found = c;
    });
    return found;
  }

  // 注册到模型注册表（仅游戏运行时可用）
  if (window.ModelRegistry) {
    window.ModelRegistry.register(
      'tanks',
      '虎式坦克 v1.0 绿色',
      (opts) => TigerIBuilder.buildAnimatedTigerI({ ...opts, camoColor: 'green' }).group
    );
    window.ModelRegistry.register(
      'tanks',
      '虎式坦克 v1.0 黄色',
      (opts) => TigerIBuilder.buildAnimatedTigerI({ ...opts, camoColor: 'desert' }).group
    );
  }
})();
