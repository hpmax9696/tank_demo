/**
 * 敌方单位模型 — PvE战斗系统
 * v0.26.0: 装甲突击车（近战杂兵）
 */
(function() {

    // ─── ① 装甲突击车（杂兵·近战）───
    // 外观：低矮六轮装甲车，车头V形铲斗撞角，浅棕迷彩
    // 装备：冲撞铲斗 + 炮塔顶部喷火器
    // 行为：发现玩家后直线猛冲 → 近距减速喷火 → 撞到绕圈再冲

    function createAssaultVehicle() {
        const group = new THREE.Group();

        // 材质
        const bodyMat   = new THREE.MeshStandardMaterial({ color: '#BFA470', roughness: 0.65, metalness: 0.25 });
        const darkMat   = new THREE.MeshStandardMaterial({ color: '#5C4A3A', roughness: 0.75, metalness: 0.15 });
        const wheelMat  = new THREE.MeshStandardMaterial({ color: '#252525', roughness: 0.9,  metalness: 0.05 });
        const bladeMat  = new THREE.MeshStandardMaterial({ color: '#8B8378', roughness: 0.45, metalness: 0.55 });
        const tubeMat   = new THREE.MeshStandardMaterial({ color: '#505050', roughness: 0.35, metalness: 0.75 });

        // ── 车体底盘 ──
        const chassis = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.35, 1.1), bodyMat);
        chassis.position.y = 0.435;
        chassis.castShadow = true; chassis.receiveShadow = true;
        group.add(chassis);

        // ── 车体上部装甲 ──
        const upperHull = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.3, 1.0), bodyMat);
        upperHull.position.y = 0.72;
        upperHull.castShadow = true; upperHull.receiveShadow = true;
        group.add(upperHull);

        // ── 后部上层结构（驾驶舱+引擎，移出炮塔前方避免穿模） ──
        const cabin = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.28, 0.8), darkMat);
        cabin.position.set(0.55, 0.94, 0);
        cabin.castShadow = true;
        group.add(cabin);

        const engine = new THREE.Mesh(new THREE.BoxGeometry(0.50, 0.20, 0.7), darkMat);
        engine.position.set(0.80, 0.82, 0);
        engine.castShadow = true;
        group.add(engine);

        // ── 车头观察缝（替代前方驾驶舱凸起） ──
        const visor = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.35), tubeMat);
        visor.position.set(-0.65, 0.82, 0);
        visor.castShadow = true;
        group.add(visor);

        // ── V形铲斗（车头） ──
        // 左叶片
        const bladeL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.4, 0.52), bladeMat);
        bladeL.position.set(-1.08, 0.38, 0.06);
        bladeL.rotation.z = 0.25;
        bladeL.rotation.y = 0.15;
        bladeL.castShadow = true;
        group.add(bladeL);

        // 右叶片
        const bladeR = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.4, 0.52), bladeMat);
        bladeR.position.set(-1.08, 0.38, -0.06);
        bladeR.rotation.z = 0.25;
        bladeR.rotation.y = -0.15;
        bladeR.castShadow = true;
        group.add(bladeR);

        // 铲斗底部横梁
        const crossBeam = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 1.05), bladeMat);
        crossBeam.position.set(-1.12, 0.18, 0);
        crossBeam.castShadow = true;
        group.add(crossBeam);

        // ── 轮子 ×6（两侧各3） ──
        const wheelGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.16, 14);
        const wheelPositions = [
            [-0.45, 0.2, -0.58], [ 0.30, 0.2, -0.58], [ 0.90, 0.2, -0.58],
            [-0.45, 0.2,  0.58], [ 0.30, 0.2,  0.58], [ 0.90, 0.2,  0.58]
        ];
        wheelPositions.forEach(([x, y, z]) => {
            const wheel = new THREE.Mesh(wheelGeo, wheelMat);
            wheel.rotation.x = Math.PI / 2;
            wheel.position.set(x, y, z);
            wheel.castShadow = true; wheel.receiveShadow = true;
            group.add(wheel);
            // 轮毂
            const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.18, 8), tubeMat);
            hub.rotation.x = Math.PI / 2;
            hub.position.set(x, y, z);
            group.add(hub);
        });

        // ── 炮塔旋转轴（独立于车体，AI 可旋转瞄准） ──
        const turretPivot = new THREE.Group();
        turretPivot.name = 'turretPivot';
        turretPivot.position.set(0.18, 0, 0);  // 炮塔中心偏离车体中心 0.18
        group.add(turretPivot);

        // ── 过渡基座（车体→炮塔，抬升炮塔使喷火管高出后部上层） ──
        const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.35, 0.22, 16), darkMat);
        pedestal.position.set(0, 0.98, 0);  // 底部 0.87=车体顶，顶部 1.09
        pedestal.castShadow = true;
        turretPivot.add(pedestal);

        // ── 炮塔底座（在基座之上，底面 y=1.09 = 基座顶部） ──
        const turretBase = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.35, 0.25, 16), darkMat);
        turretBase.position.set(0, 1.215, 0);  // 底部 1.09，顶部 1.34
        turretBase.castShadow = true;
        turretPivot.add(turretBase);

        // ── 炮塔顶部（半球，底部紧贴底座顶部 1.34） ──
        // 半球截断处距球心: 0.32×cos(π/3)=0.16，球心在 1.34-0.16=1.18
        const turretTop = new THREE.Mesh(
            new THREE.SphereGeometry(0.32, 16, 8, 0, Math.PI * 2, 0, Math.PI / 3),
            darkMat
        );
        turretTop.position.set(0, 1.18, 0);
        turretTop.castShadow = true;
        turretPivot.add(turretTop);

        // ── 喷火器总成（管身+喇叭口+红环，抬高到 y=1.27 高出后部上层，360°旋转无穿模） ──

        // 喷火器材质
        const flameMetal = new THREE.MeshStandardMaterial({ color: '#707C85', roughness: 0.35, metalness: 0.7 });
        const hotRingMat = new THREE.MeshStandardMaterial({ color: '#DC4530', roughness: 0.45, metalness: 0.5, emissive: '#DC4530', emissiveIntensity: 0.15 });
        const darkMouth  = new THREE.MeshStandardMaterial({ color: '#1A1A1A', roughness: 0.9, metalness: 0.0 });

        const ftY = 1.27;  // 喷火器统一高度（高出驾驶舱顶 1.08）

        // 管身
        const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.045, 1.4, 16), flameMetal);
        tube.rotation.z = Math.PI / 2;
        tube.position.set(-0.58, ftY, 0);  // 相对于 turretPivot (0.18) → 世界坐标 x=-0.4
        tube.castShadow = true;
        turretPivot.add(tube);

        // 抱箍×2
        for (const hx of [-0.30, -0.78]) {
            const hanger = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.012, 6, 16), flameMetal);
            hanger.position.set(hx, ftY, 0);
            hanger.castShadow = true;
            turretPivot.add(hanger);
        }

        // 喇叭喷嘴
        const flare = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.085, 0.12, 16), flameMetal);
        flare.rotation.z = Math.PI / 2;
        flare.position.set(-1.14, ftY, 0);  // 相对 turretPivot → 世界坐标 x=-0.96
        flare.castShadow = true;
        turretPivot.add(flare);

        // 红色加热环
        const hotRing = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.018, 8, 20), hotRingMat);
        hotRing.position.set(-1.21, ftY, 0);  // 相对 turretPivot → 世界坐标 x=-1.03
        hotRing.castShadow = true;
        turretPivot.add(hotRing);

        // 喷口黑洞
        const mouth = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.06, 12), darkMouth);
        mouth.rotation.z = Math.PI / 2;
        mouth.position.set(-1.17, ftY, 0);  // 相对 turretPivot → 世界坐标 x=-0.99
        mouth.castShadow = true;
        turretPivot.add(mouth);

        // 存储炮塔引用供 AI 使用
        group.userData.turretPivot = turretPivot;
        group.userData.flameNozzleWorld = new THREE.Vector3(-1.03, ftY, 0);  // 世界坐标喷口（相对 turretPivot → 世界需乘旋转）

        return group;
    }

    // ─── 预览工厂函数（比例适配预览场景） ───
    const ENEMY_PREVIEW_SCALE = 1.5;

    function makeAssaultVehicle() {
        const g = createAssaultVehicle();
        g.scale.setScalar(ENEMY_PREVIEW_SCALE);
        return g;
    }


    // ═══════════════════════════════════════════════════════
    // ─── ② 新程序化丧尸（骨架层级 + 手动插值动画）───
    // v0.26.15: 移植自 zombie_prototype.html，替代GLB丧尸
    // ═══════════════════════════════════════════════════════

    // 2.0 全局贴图/材质缓存（所有丧尸实例共享）
    let _zombieTexCache = null;
    let _zombieMatCache = {};
    let _zombieBloodMat = null;

    // 2.1 createZombieMaterials() — 程序化贴图生成（Canvas 2D，首次调用后缓存）
    function createZombieMaterials() {
        if (_zombieTexCache) return _zombieTexCache;
  const SZ = 256;

  // ---- Diffuse Map ----
  const dc = document.createElement('canvas');
  dc.width = dc.height = SZ;
  const dctx = dc.getContext('2d');

  // ① 灰绿基底（提亮，匹配圆柱占位 #556633）
  dctx.fillStyle = '#A9B89E';
  dctx.fillRect(0, 0, SZ, SZ);

  // ② 纹理噪点（提亮范围）
  for (let i = 0; i < 300; i++) {
    const r = 0xA5 + Math.floor(Math.random() * 0x25);  // 165-201
    const g_ = 0x9D + Math.floor(Math.random() * 0x25);  // 157-193
    const b = 0x8E + Math.floor(Math.random() * 0x25);   // 142-178
    dctx.fillStyle = `rgb(${r},${g_},${b})`;
    dctx.fillRect(Math.random() * SZ, Math.random() * SZ, 1 + Math.random() * 3, 1 + Math.random() * 3);
  }

  // ③ 暗红血渍（径向渐变，提亮化）
  for (let i = 0; i < 8; i++) {
    const cx = Math.random() * SZ, cy = Math.random() * SZ, r = 10 + Math.random() * 25;
    const g = dctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, '#8a3030');
    g.addColorStop(0.4, '#aa4545');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    dctx.fillStyle = g;
    dctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  }

  // ④ 黄绿溃烂斑（提亮化）
  for (let i = 0; i < 5; i++) {
    const cx = Math.random() * SZ, cy = Math.random() * SZ, r = 6 + Math.random() * 18;
    const g = dctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, '#c8c868');
    g.addColorStop(0.6, '#b8b858');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    dctx.fillStyle = g;
    dctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  }

  // ⑤ 污垢线条（提亮化）
  dctx.strokeStyle = '#8a8a78';
  dctx.lineWidth = 2;
  for (let i = 0; i < 15; i++) {
    dctx.globalAlpha = 0.3 + Math.random() * 0.4;
    dctx.beginPath();
    dctx.moveTo(Math.random() * SZ, Math.random() * SZ);
    dctx.lineTo(Math.random() * SZ, Math.random() * SZ);
    dctx.stroke();
  }
  dctx.globalAlpha = 1;

  // ---- Roughness Map ----
  const rc = document.createElement('canvas');
  rc.width = rc.height = SZ;
  const rctx = rc.getContext('2d');

  // 基底 0.5 灰
  rctx.fillStyle = '#808080';
  rctx.fillRect(0, 0, SZ, SZ);

  // 溃烂区 → 白（粗糙）
  for (let i = 0; i < 5; i++) {
    const cx = Math.random() * SZ, cy = Math.random() * SZ, r = 6 + Math.random() * 18;
    const g = rctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.6, '#c0c0c0');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    rctx.fillStyle = g;
    rctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  }

  // 血渍区 → 暗（光滑/湿润）
  for (let i = 0; i < 8; i++) {
    const cx = Math.random() * SZ, cy = Math.random() * SZ, r = 10 + Math.random() * 25;
    const g = rctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, '#222222');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    rctx.fillStyle = g;
    rctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  }

  // 包装为 CanvasTexture
  const diffuse = new THREE.CanvasTexture(dc);
  diffuse.wrapS = diffuse.wrapT = THREE.RepeatWrapping;
  diffuse.repeat.set(2, 2);
  diffuse.anisotropy = 4;

  const roughness = new THREE.CanvasTexture(rc);
  roughness.wrapS = roughness.wrapT = THREE.RepeatWrapping;
  roughness.repeat.set(2, 2);

  return { diffuse, roughness };
}


    // 2.2 ZOMBIE_CONFIG — 24节点层级树配置（11个关节pivot）
    const ZOMBIE_CONFIG = {
  name: 'root',
  type: 'Group',
  position: [-0.08, 0.75, 0],  // 抬高使脚底贴地
  rotation: [0, 0, 0],
  scale: [1, 1, 1],
  children: [{
    name: 'pelvis',
    type: 'Box',
    size: [0.50, 0.35, 0.40],
    position: [0, 0.375, 0],
    rotation: [0, 0, 0],
    materialId: 'cloth_torn',
    children: [
      // ============ 躯干 ============
      {
        name: 'torso',
        type: 'Box',
        size: [0.60, 0.75, 0.38],
        position: [0, 0.54, 0.04],
        rotation: [0.25, 0, 0],     // 驼背前倾 +0.25 rad
        pivot: [0, -0.375, 0],      // 腰关节在盒体底
        materialId: 'cloth_torn',
        children: [
          // --- 脖子（头部父节点：带动头部运动）---
          {
            name: 'neck',
            type: 'Cylinder',
            size: [0.12, 0.15, 0.12],
            position: [0, 0.46, 0.02],
            rotation: [0.27, 0, 0],     // 脖子前倾 +0.27 rad
            pivot: [0, -0.075, 0],      // 底部连接躯干
            materialId: 'skin_rot',
            children: [
              // --- 头部 ---
              {
                name: 'head',
                type: 'Sphere',
                size: [0.20],
                position: [0, 0.215, 0.02],
                rotation: [0.02, 0, 0.20],  // 几乎平视 +0.02 · 右歪 +0.15
                pivot: [0, -0.20, 0],       // 颈关节在球底
                materialId: 'skin_rot',
                segments: [5, 4],
                children: [
                  {
                    name: 'l_eye_glow',
                    type: 'Sphere',
                    size: [0.04],
                    position: [-0.03, 0.02, 0.16],
                    materialId: 'eye_glow',
                    segments: [4, 3]
                  },
                  {
                    name: 'r_eye_glow',
                    type: 'Sphere',
                    size: [0.04],
                    position: [0.12, 0, 0.13],
                    materialId: 'eye_glow',
                    segments: [4, 3]
                  }
                ]
              }
            ]
          },
          // --- 左上臂 + 左前臂 ---
          {
            name: 'l_upper_arm',
            type: 'Cylinder',
            size: [0.10, 0.45, 0.10],
            position: [-0.38, 0.20, -0.08],
            rotation: [-0.40, 0, 0],     // 左臂下垂 -0.9 rad
            pivot: [0, 0.225, 0],        // 肩关节在柱体顶
            materialId: 'skin_rot',
            children: [{
              name: 'l_forearm',
              type: 'Cylinder',
              size: [0.08, 0.42, 0.08],
              position: [0, -0.435, 0],
              rotation: [-1.67, 0, 0],    // 左前臂前伸
              pivot: [0, 0.21, 0],        // 肘关节在柱体顶
              materialId: 'skin_rot'
            }]
          },
          // --- 右上臂 + 右前臂 ---
          {
            name: 'r_upper_arm',
            type: 'Cylinder',
            size: [0.10, 0.45, 0.10],
            position: [0.38, 0.115, -0.13],
            rotation: [-1.10, -0.71, 0],      // 右臂前探抓取
            pivot: [0, 0.225, 0],             // 肩关节在柱体顶
            materialId: 'skin_rot',
            children: [{
              name: 'r_forearm',
              type: 'Cylinder',
              size: [0.08, 0.42, 0.08],
              position: [0, -0.435, 0],
              rotation: [-1.29, 0, 0],
              pivot: [0, 0.21, 0],        // 肘关节在柱体顶
              materialId: 'skin_rot'
            }]
          },
          // --- 胸部伤口（子弹孔/撕裂）---
          {
            name: 'chest_wound',
            type: 'Cylinder',
            size: [0.06, 0.02, 0.06],
            position: [0.12, 0.05, 0.20],
            materialId: 'cloth_torn'
          },
          // --- 破损衣片 ---
          {
            name: 'torn_shirt',
            type: 'Box',
            size: [0.18, 0.10, 0.02],
            position: [-0.10, -0.28, 0.20],
            rotation: [0.20, 0.10, 0],
            materialId: 'cloth_torn'
          }
        ]
      },
      // ============ 左腿 ============
      {
        name: 'l_upper_leg',
        type: 'Cylinder',
        size: [0.12, 0.45, 0.12],
        position: [-0.15, -0.40, 0],
        rotation: [0.05, 0, 0],
        pivot: [0, 0.225, 0],
        materialId: 'cloth_torn',
        children: [{
          name: 'l_lower_leg',
          type: 'Cylinder',
          size: [0.10, 0.42, 0.10],
          position: [0.01, -0.435, 0],
          pivot: [0, 0.21, 0],
          materialId: 'cloth_torn',
          children: [{
            name: 'l_foot',
            type: 'Box',
            size: [0.18, 0.10, 0.28],
            position: [0.02, -0.26, 0.07],
            pivot: [0, 0.05, 0],
            materialId: 'cloth_torn'
          }]
        }]
      },
      // ============ 右腿 ============
      {
        name: 'r_upper_leg',
        type: 'Cylinder',
        size: [0.12, 0.45, 0.12],
        position: [0.15, -0.40, 0],
        rotation: [0.35, 0, 0],
        pivot: [0, 0.225, 0],
        materialId: 'cloth_torn',
        children: [{
          name: 'r_lower_leg',
          type: 'Cylinder',
          size: [0.10, 0.42, 0.10],
          position: [-0.01, -0.435, 0],
          pivot: [0, 0.21, 0],
          materialId: 'cloth_torn',
          children: [{
            name: 'r_foot',
            type: 'Box',
            size: [0.18, 0.10, 0.28],
            position: [-0.02, -0.26, 0.07],
            pivot: [0, 0.05, 0],
            materialId: 'cloth_torn'
          }]
        }]
      }
    ]
  }]
};

    // 2.3 buildZombieFromConfig() — 递归构建函数 + pivot补偿算法
    function buildZombieFromConfig(config, parent, showHelpers = false) {
  const helpers = [];

  // === ① 生成程序化贴图 ===
  const tex = _zombieTexCache || createZombieMaterials();

  // === ② 材质字典 ===
  
  function getMat(id) {
    if (_zombieMatCache[id]) return _zombieMatCache[id];
    const DEFS = {
      skin_rot:   { color: 0x8b7d6f, roughness: 0.85, metalness: 0.0 },
      cloth_torn: { color: 0x6a5a4a, roughness: 0.85, metalness: 0.0 },
      eye_glow:   { color: 0x000000, roughness: 0.0, metalness: 0.0, emissive: 0xff2200, emissiveIntensity: 3 },
    };
    const d = DEFS[id] || { color: 0x888888, roughness: 0.75, metalness: 0.05 };
    const cfg = {
      color: d.color,
      roughness: d.roughness,
      metalness: d.metalness,
    };
    // 非发光材质使用程序化贴图
    if (id !== 'eye_glow') {
      cfg.map = tex.diffuse;
      cfg.roughnessMap = tex.roughness;
    }
    if (d.emissive !== undefined) {
      cfg.emissive = d.emissive;
      cfg.emissiveIntensity = d.emissiveIntensity;
    }
    _zombieMatCache[id] = new THREE.MeshStandardMaterial(cfg);
    return _zombieMatCache[id];
  }
  // 血迹材质
  if (!_zombieBloodMat) _zombieBloodMat = new THREE.MeshStandardMaterial({ color: '#9a2a2a', roughness: 0.2, metalness: 0.1 });
  const bloodMat = _zombieBloodMat;

  // === ③ 几何工厂 ===
  function createGeometry(node) {
    switch (node.type) {
      case 'Box': { const [w, h, d] = node.size; return new THREE.BoxGeometry(w, h, d); }
      case 'Cylinder': { const [rT, h, rB] = node.size; return new THREE.CylinderGeometry(rT, rB, h, 6); }
      case 'Sphere': { const [r] = node.size; const s = node.segments || [6, 4]; return new THREE.SphereGeometry(r, s[0], s[1]); }
      default: return null;
    }
  }

  // === ④ 递归构建 ===
  function buildNode(node, parentObj, pivotComp = [0, 0, 0]) {
    if (node.type === 'Group') {
      const g = new THREE.Group();
      g.name = node.name;
      if (node.position) g.position.set(...node.position);
      if (node.rotation) g.rotation.set(...node.rotation);
      if (node.scale) g.scale.set(...node.scale);
      parentObj.add(g);
      if (node.children) for (const c of node.children) buildNode(c, g);
      return;
    }

    const geo = createGeometry(node);
    geo.center();
    const mat = node.materialId ? getMat(node.materialId) : new THREE.MeshStandardMaterial({ color: node.color || '#888888', roughness: 0.75, metalness: 0.05 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = node.name + '_mesh';

    const pos = node.position
      ? [node.position[0] + pivotComp[0], node.position[1] + pivotComp[1], node.position[2] + pivotComp[2]]
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

    if (showHelpers) {
      const helper = new THREE.BoxHelper(mesh, getHelperColor(node.name));
      helper.update();
      helpers.push(helper);
    }

    const childComp = node.pivot
      ? [-node.pivot[0], -node.pivot[1], -node.pivot[2]]
      : [0, 0, 0];
    group.userData.appliedComp = pivotComp;
    group.userData.childComp = childComp;

    if (node.children) {
      for (const child of node.children) {
        buildNode(child, rotTarget, childComp);
      }
    }
  }

  // === ⑤ 构建主骨架 ===
  buildNode(config, parent);
  // 开启阴影
  parent.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });

  // === ⑥ 自动插入部件（发光眼睛 + 血迹）===
  function findPivot(name) {
    const g = parent.getObjectByName(name);
    return g ? (g.userData.pivot || g) : null;
  }

  // 6a. 血迹滴落（torso × 3, head × 1）
  const torsoPivot = findPivot('torso');
  if (torsoPivot) {
    const positions = [
      [0.15, 0.275, 0.22], [-0.12, 0.525, 0.22], [0.08, 0.125, 0.20]
    ];  // 已加 childComp [0,0.375,0]
    positions.forEach((p, i) => {
      const r = 0.03 + (i * 0.01);
      const geo = new THREE.CylinderGeometry(r, r, 0.02, 6);
      geo.center();
      const drip = new THREE.Mesh(geo, bloodMat);
      drip.position.set(p[0], p[1], p[2]);
      drip.name = 'blood_drip_' + i;
      torsoPivot.add(drip);
    });
  }

  const headPivot2 = findPivot('head');
  if (headPivot2) {
    const geo2 = new THREE.CylinderGeometry(0.04, 0.04, 0.02, 6);
    geo2.center();
    const drip = new THREE.Mesh(geo2, bloodMat);
    drip.position.set(-0.08, 0.25, 0.22);  // 已加 pivot 补偿 [0,0.20,0]
    drip.name = 'blood_drip_head';
    headPivot2.add(drip);
  }

  // === ⑦ 收尾 ===
  for (const h of helpers) parent.add(h);
  parent.userData.helpers = helpers;
  return parent;
}


    // 2.4 统计面数
    function countTriangles(obj) {
  let count = 0;
  obj.traverse(child => {
    if (child.isMesh && child.geometry) {
      const geo = child.geometry;
      if (geo.index) {
        count += geo.index.count / 3;
      } else {
        count += geo.attributes.position.count / 3;
      }
    }
  });
  return Math.round(count);
}


    // 2.5 AnimationSystem — 手动插值动画引擎（v0.28.0 支持分帧LOD）
    class AnimationSystem {
  constructor(root) {
    this.root = root;
    this.anims = {};
    this.current = null;     // 当前动画名
    this.currentTime = 0;    // 归一化时间 0~1
    this.playing = false;
    this.loop = true;
    this.clampWhenFinished = false;
    // LOD 分帧：skipInterval=0 每帧更新，值越大跳帧越多
    this.skipInterval = 0;   // 秒（0=每帧，0.064=15fps，999=冻结）
    this.skipAccum = 0;
  }

  // 注册动画定义
  define(name, duration, trackDefs) {
    // trackDefs = [{ target:obj, prop:'rotation', axis:'x', keys:[{t,v}] }, ...]
    this.anims[name] = { duration, trackDefs };
  }

  // 查找 pivot (用于旋转) / outer (用于位移)
  findPivot(nodeName) {
    const g = this.root.getObjectByName(nodeName);
    return g ? (g.userData.pivot || g) : null;
  }
  find(nodeName) {
    return this.root.getObjectByName(nodeName);
  }

  play(name, loop = true) {
    this.current = name;
    this.currentTime = 0;
    this.playing = true;
    this.loop = loop;
    this.clampWhenFinished = !loop;
  }

  stop() {
    this.playing = false;
    this.current = null;
    this.currentTime = 0;
  }

  update(dt) {
    if (!this.playing || !this.current) return;
    // LOD 分帧：累积时间，不够间隔则跳过
    this.skipAccum += dt;
    if (this.skipInterval > 0) {
      if (this.skipAccum < this.skipInterval) return;
      dt = this.skipAccum;  // 一次性消耗累积的时间
      this.skipAccum = 0;
    }
    const anim = this.anims[this.current];
    if (!anim) return;

    this.currentTime += dt / anim.duration;

    if (this.loop) {
      // 循环
      this.currentTime = this.currentTime % 1.0;
    } else if (this.currentTime >= 1.0) {
      this.currentTime = 1.0;
      if (this.clampWhenFinished) {
        this.playing = false; // 播完停止（停留在最后一帧）
      }
    }

    const t = this.currentTime;
    for (const td of anim.trackDefs) {
      const { target, prop, axis, keys } = td;
      if (!target) continue;

      // 线性插值查 key
      let val;
      if (t <= keys[0].t) {
        val = keys[0].v;
      } else if (t >= keys[keys.length - 1].t) {
        val = keys[keys.length - 1].v;
      } else {
        for (let i = 1; i < keys.length; i++) {
          if (t <= keys[i].t) {
            const k0 = keys[i - 1], k1 = keys[i];
            const frac = (t - k0.t) / (k1.t - k0.t);
            val = k0.v + (k1.v - k0.v) * frac;
            break;
          }
        }
      }
      if (val !== undefined) {
        if (axis) {
          target[prop][axis] = val;
        } else {
          target[prop] = val;
        }
      }
    }
  }
}


    // 2.6 createAnimationSystem() — 注册6种动画（Idle/Hit/Attack/Walk/Run/Die）
    function createAnimationSystem(root) {
  const P = {}; // rotation targets (pivots)
  const O = {}; // position targets (outer)
  const names = ['torso', 'head', 'neck', 'l_upper_arm', 'l_forearm',
    'r_upper_arm', 'r_forearm', 'l_upper_leg', 'l_lower_leg',
    'r_upper_leg', 'r_lower_leg', 'pelvis'];
  names.forEach(n => {
    P[n] = root.getObjectByName(n + '_pivot');
    O[n] = root.getObjectByName(n);
  });
  // root Group 和 feet
  O.root = root.getObjectByName('root');   // config root Group
  P.root = O.root;                         // root 无 pivot，直接旋转
  O.l_foot = root.getObjectByName('l_foot');
  O.r_foot = root.getObjectByName('r_foot');
  // 调试
  if (!P.torso) console.warn('Animation: pivots not found - ensure buildZombieFromConfig completed');

  const asys = new AnimationSystem(root);

  // -------- A. Idle  2.0s --------
  asys.define('Idle', 2.0, [
    { target: P.torso, prop: 'rotation', axis: 'z', keys: [{ t: 0, v: 0 }, { t: 0.25, v: 0.03 }, { t: 0.75, v: -0.03 }, { t: 1, v: 0 }] },
    { target: O.pelvis, prop: 'position', axis: 'y', keys: [{ t: 0, v: 0 }, { t: 0.5, v: 0.02 }, { t: 1, v: 0 }] },
    { target: P.head, prop: 'rotation', axis: 'z', keys: [{ t: 0, v: 0.2 }, { t: 0.3, v: 0.25 }, { t: 0.7, v: 0.15 }, { t: 1, v: 0.2 }] },
  ]);

  // -------- B. Hit  0.5s --------
  asys.define('Hit', 0.5, [
    { target: P.torso, prop: 'rotation', axis: 'x', keys: [{ t: 0, v: 0.25 }, { t: 0.2, v: -0.2 }, { t: 1, v: 0.25 }] },
    { target: P.head, prop: 'rotation', axis: 'x', keys: [{ t: 0, v: 0.02 }, { t: 0.15, v: -0.4 }, { t: 1, v: 0.02 }] },
  ]);

  // -------- C. Attack (收臂→前伸→复位)  1.0s --------
  asys.define('Attack', 1.0, [
    // 上臂：回收(-0.5)→前刺(-1.8)→复位(-1.1)
    { target: P.r_upper_arm, prop: 'rotation', axis: 'x', keys: [{ t: 0, v: -0.5 }, { t: 0.35, v: -1.8 }, { t: 1, v: -1.1 }] },
    // 前臂：收拢(-1.8)→伸直(-0.2)→复位(-1.29)
    { target: P.r_forearm, prop: 'rotation', axis: 'x', keys: [{ t: 0, v: -1.8 }, { t: 0.35, v: -0.2 }, { t: 1, v: -1.29 }] },
    { target: P.torso, prop: 'rotation', axis: 'x', keys: [{ t: 0, v: 0.25 }, { t: 0.3, v: 0.5 }, { t: 1, v: 0.25 }] },
    { target: P.head, prop: 'rotation', axis: 'x', keys: [{ t: 0, v: 0.02 }, { t: 0.3, v: 0.22 }, { t: 1, v: 0.02 }] },
  ]);

  // -------- D. Walk  1.5s --------
  asys.define('Walk', 1.5, [
    { target: O.pelvis, prop: 'position', axis: 'y', keys: [{ t: 0, v: 0 }, { t: 0.5, v: 0.05 }, { t: 1, v: 0 }] },
    { target: P.l_upper_leg, prop: 'rotation', axis: 'x', keys: [{ t: 0, v: -0.1 }, { t: 0.25, v: -0.4 }, { t: 0.5, v: 0.1 }, { t: 0.75, v: 0.5 }, { t: 1, v: -0.1 }] },
    { target: P.r_upper_leg, prop: 'rotation', axis: 'x', keys: [{ t: 0, v: 0.35 }, { t: 0.25, v: 0.7 }, { t: 0.5, v: 0.35 }, { t: 0.75, v: -0.1 }, { t: 1, v: 0.35 }] },
    { target: P.l_lower_leg, prop: 'rotation', axis: 'x', keys: [{ t: 0, v: 0 }, { t: 0.5, v: -0.3 }, { t: 1, v: 0 }] },
    { target: P.r_lower_leg, prop: 'rotation', axis: 'x', keys: [{ t: 0, v: 0 }, { t: 0.5, v: -0.3 }, { t: 1, v: 0 }] },
    { target: P.l_upper_arm, prop: 'rotation', axis: 'x', keys: [{ t: 0, v: -0.4 }, { t: 0.5, v: -0.6 }, { t: 1, v: -0.4 }] },
    { target: P.r_upper_arm, prop: 'rotation', axis: 'x', keys: [{ t: 0, v: -1.1 }, { t: 0.5, v: -0.9 }, { t: 1, v: -1.1 }] },
  ]);

  // -------- E. Run  0.8s --------
  asys.define('Run', 0.8, [
    { target: P.torso, prop: 'rotation', axis: 'x', keys: [{ t: 0, v: 0.25 }, { t: 1, v: 0.55 }] },
    { target: O.pelvis, prop: 'position', axis: 'y', keys: [{ t: 0, v: 0 }, { t: 0.5, v: 0.08 }, { t: 1, v: 0 }] },
    { target: P.l_upper_leg, prop: 'rotation', axis: 'x', keys: [{ t: 0, v: -0.1 }, { t: 0.25, v: -0.6 }, { t: 0.5, v: 0.1 }, { t: 0.75, v: 0.7 }, { t: 1, v: -0.1 }] },
    { target: P.r_upper_leg, prop: 'rotation', axis: 'x', keys: [{ t: 0, v: 0.35 }, { t: 0.25, v: 0.85 }, { t: 0.5, v: 0.35 }, { t: 0.75, v: -0.25 }, { t: 1, v: 0.35 }] },
    { target: P.l_lower_leg, prop: 'rotation', axis: 'x', keys: [{ t: 0, v: 0 }, { t: 0.5, v: -0.4 }, { t: 1, v: 0 }] },
    { target: P.r_lower_leg, prop: 'rotation', axis: 'x', keys: [{ t: 0, v: 0 }, { t: 0.5, v: -0.4 }, { t: 1, v: 0 }] },
    { target: P.l_upper_arm, prop: 'rotation', axis: 'x', keys: [{ t: 0, v: -0.4 }, { t: 0.5, v: -0.9 }, { t: 1, v: -0.4 }] },
    { target: P.r_upper_arm, prop: 'rotation', axis: 'x', keys: [{ t: 0, v: -1.1 }, { t: 0.5, v: -0.7 }, { t: 1, v: -1.1 }] },
  ]);

  // -------- F. Die (分阶段瘫软倒地)  1.5s --------
  // Phase 1 (0~0.333): 前扑触地 Impact
  // Phase 2 (0.333~1.0): 触地松弛 + 四肢外展 Splay
  // 时间归一化: user 的 0.5s/1.5=0.333, 1.0s/1.5=0.667, 1.5s/1.5=1.0
  // 路径校验: l_upper_arm / r_upper_arm 均已通过 pivot 系统正确引用

  asys.define('Die', 1.5, [
    // root 前旋 + 下沉
    { target: P.root, prop: 'rotation', axis: 'x', keys: [{t:0, v:0}, {t:0.333, v:Math.PI*0.48}, {t:1, v:Math.PI*0.5}] },
    { target: O.root, prop: 'position', axis: 'y', keys: [{t:0, v:0.75}, {t:0.333, v:0.60}, {t:0.667, v:0.30}, {t:1, v:0.30}] },
    // 躯干：驼背(0.25)→触地缓冲(0.05)→瘫软反弓(-0.15)
    { target: P.torso, prop: 'rotation', axis: 'x', keys: [{t:0, v:0.25}, {t:0.333, v:0.05}, {t:0.6, v:-0.1}, {t:1, v:-0.15}] },
    // 双臂：强制向外摊开（正=左臂外展, 负=右臂外展）
    { target: P.l_upper_arm, prop: 'rotation', axis: 'z', keys: [{t:0, v:-0.15}, {t:0.333, v:-0.05}, {t:0.667, v:-0.7}, {t:1, v:-0.9}] },
    { target: P.r_upper_arm, prop: 'rotation', axis: 'z', keys: [{t:0, v:0.15}, {t:0.333, v:0.05}, {t:0.667, v:0.7}, {t:1, v:0.9}] },
    // 骨盆：微歪瘫软
    { target: O.pelvis, prop: 'rotation', axis: 'z', keys: [{t:0, v:0}, {t:0.4, v:0.12}, {t:1, v:0.18}] },
  ]);

  return asys;
}


    // 2.7 createZombie() — 游戏实例工厂（含动画系统，目标高度1.0m）
    // v0.28.0 模板克隆：首次构建骨架→深拷贝复用，几何体共享
    let _zombieTemplate = null;
    let _zombieTemplateScale = 1.0;
    let _zombieTemplateBaseY = 0;
    function createZombie() {
        // 预热贴图缓存
        if (!_zombieTexCache) createZombieMaterials();
        if (!_zombieTemplate) {
            _zombieTemplate = new THREE.Group();
            buildZombieFromConfig(ZOMBIE_CONFIG, _zombieTemplate, false);
            const bbox = new THREE.Box3().setFromObject(_zombieTemplate);
            const currentH = bbox.max.y - bbox.min.y;
            if (currentH > 0) {
                _zombieTemplateScale = 1.0 / currentH;
                _zombieTemplateBaseY = -bbox.min.y * _zombieTemplateScale;
            }
        }
        const root = _zombieTemplate.clone(true);
        root.scale.setScalar(_zombieTemplateScale);
        root.position.y = _zombieTemplateBaseY;
        // LOD: 将骨架节点打包到子Group，便于远距离整体隐藏
        const skeletonGroup = new THREE.Group();
        skeletonGroup.name = '_skeleton';
        while (root.children.length > 0) skeletonGroup.add(root.children[0]);
        root.add(skeletonGroup);
        // LOD远距离占位圆柱（灰绿，高1m，半径0.25m）
        const cylGeo = new THREE.CylinderGeometry(0.25, 0.35, 1.0, 6);
        const cylMat = new THREE.MeshBasicMaterial({ color: 0x556633 });
        const cylMesh = new THREE.Mesh(cylGeo, cylMat);
        cylMesh.position.y = 0.5;
        cylMesh.visible = false;
        cylMesh.name = '_lodCylinder';
        root.add(cylMesh);
        root.userData._skeletonGroup = skeletonGroup;
        root.userData._lodCylinder = cylMesh;
        const asys = createAnimationSystem(root);
        root.userData._animSystem = asys;
        root.userData.enemyType = 'zombie';
        asys.play('Idle', true);
        return root;
    }

    // 2.8 makeZombie() — 预览工厂（createZombie已缩至1m，预览保持原尺寸）
    function makeZombie() {
        const g = createZombie();
        // createZombie 已通过包围盒缩放到1.0m，预览直接返回
        return g;
    }

    // ─── 暴露到全局 ───
    window.EnemyModels = {
        createAssaultVehicle,
        createZombie,
        createZombieMaterials,
        createHexapod,
        AnimationSystem,
    };

    // ─── 注册到 ModelRegistry（模型预览） ───
    window.ModelRegistry.register('enemies', '装甲突击车', makeAssaultVehicle);
    window.ModelRegistry.register('enemies', '丧尸', makeZombie);
    window.ModelRegistry.register('enemies', '六足战车', makeHexapod);

    console.log('🧟 敌方单位模型已就绪 | 装甲突击车 + 程序化丧尸(骨架动画) + 六足战车');


    // ═══════════════════════════════════════════════════════
    // ─── ③ 六足战车（精英敌人·三角步态·加特林+导弹巢）───
    // ═══════════════════════════════════════════════════════
    // 模型配置已提取到 models/hexapod_config.js，通过 window.HexapodConfig 引用
    function getHexapodConfig() {
        return (window.HexapodConfig && window.HexapodConfig.HEXAPOD_CONFIG) || {};
    }

    var _hexapodMatCache = {};
    function _getHexapodMat(id) {
        if (_hexapodMatCache[id]) return _hexapodMatCache[id];
        var DEFS = {
            armor_dark:  { color: 0x3A3A44, roughness: 0.40, metalness: 0.85 },
            armor_light: { color: 0x5A5A6A, roughness: 0.35, metalness: 0.80 },
            dark_steel:  { color: 0x4a4a5a, roughness: 0.45, metalness: 0.85 },
            barrel_steel:{ color: 0x3a3a44, roughness: 0.35, metalness: 0.9 },
            steel:       { color: 0x6b6b7b, roughness: 0.5,  metalness: 0.8 },
            warning_yellow: { color: 0xE8A820, roughness: 0.50, metalness: 0.40, emissive: 0xC08010, emissiveIntensity: 0.15 },
        };
        var d = DEFS[id] || { color: 0x888888, roughness: 0.6, metalness: 0.2 };
        _hexapodMatCache[id] = new THREE.MeshStandardMaterial(d);
        return _hexapodMatCache[id];
    }

    function _createHexapodGeo(node) {
        var s = node.size || [1,1,1];
        switch (node.type) {
        case 'Box': return new THREE.BoxGeometry(s[0], s[1], s[2]);
        case 'Cylinder': return new THREE.CylinderGeometry(s[0], s[2], s[1], (node.segments||[12])[0]);
        case 'Sphere': return new THREE.SphereGeometry(s[0], (node.segments||[12])[0], (node.segments||[8])[1]||6);
        case 'TaperedBox': {
            var hw=s[0]/2, hd=s[2]/2, thw=s[3]/2, thd=s[4]/2, ox=s[5]||0, oz=s[6]||0;
            var v=[], uv=[], idx=[]; var vi=0;
            function q(a,b,c,d){v.push(a[0],a[1],a[2],b[0],b[1],b[2],c[0],c[1],c[2],d[0],d[1],d[2]);uv.push(0,0,1,0,1,1,0,1);idx.push(vi,vi+1,vi+2,vi,vi+2,vi+3);vi+=4;}
            q([-hw,0,-hd],[hw,0,-hd],[hw,0,hd],[-hw,0,hd]);
            q([-thw+ox,s[1],-thd+oz],[-thw+ox,s[1],thd+oz],[thw+ox,s[1],thd+oz],[thw+ox,s[1],-thd+oz]);
            q([-hw,0,-hd],[-thw+ox,s[1],-thd+oz],[thw+ox,s[1],-thd+oz],[hw,0,-hd]);
            q([hw,0,hd],[thw+ox,s[1],thd+oz],[-thw+ox,s[1],thd+oz],[-hw,0,hd]);
            q([-hw,0,hd],[-thw+ox,s[1],thd+oz],[-thw+ox,s[1],-thd+oz],[-hw,0,-hd]);
            q([hw,0,-hd],[thw+ox,s[1],-thd+oz],[thw+ox,s[1],thd+oz],[hw,0,hd]);
            var g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(v),3));g.setAttribute('uv',new THREE.BufferAttribute(new Float32Array(uv),2));g.setIndex(idx);g.computeVertexNormals();
            return g;
        }
        default: return new THREE.BoxGeometry(s[0], s[1], s[2]);
        }
    }

    function buildHexapodFromConfig(config, parent, showHelpers) {
        function adjustPos(rawPos, comp) { return [rawPos[0]+comp[0], rawPos[1]+comp[1], rawPos[2]+comp[2]]; }
        function buildNode(node, parentObj, pivotComp) {
            pivotComp = pivotComp || [0,0,0];
            if (node.type === 'Group') {
                var g = new THREE.Group(); g.name = node.name;
                if (node.position) { var ap = adjustPos(node.position, pivotComp); g.position.set(ap[0], ap[1], ap[2]); }
                if (node.rotation) g.rotation.set(node.rotation[0], node.rotation[1], node.rotation[2]);
                g.visible = node.visible !== false; parentObj.add(g);
                if (node.pivot) { var pv = new THREE.Group(); pv.name = node.name + '_pivot'; pv.position.set(node.pivot[0], node.pivot[1], node.pivot[2]); g.add(pv); g.userData.pivot = pv; }
                if (node.children) { var cc = node.pivot ? [-node.pivot[0],-node.pivot[1],-node.pivot[2]] : [0,0,0]; for (var ci = 0; ci < node.children.length; ci++) buildNode(node.children[ci], node.pivot ? g.userData.pivot : g, cc); }
                return;
            }
            var geo = _createHexapodGeo(node); geo.computeBoundingBox(); var box = geo.boundingBox;
            if (box && isFinite(box.min.x)) { var cx=(box.min.x+box.max.x)/2, cy=(box.min.y+box.max.y)/2, cz=(box.min.z+box.max.z)/2; geo.translate(-cx,-cy,-cz); }
            var mat = _getHexapodMat(node.materialId || 'armor_dark');
            var mesh = new THREE.Mesh(geo, mat); mesh.name = node.name + '_mesh'; mesh.castShadow = true; mesh.receiveShadow = true;
            var grp = new THREE.Group(); grp.name = node.name;
            var pos = adjustPos(node.position || [0,0,0], pivotComp); grp.position.set(pos[0], pos[1], pos[2]);
            grp.visible = node.visible !== false; parentObj.add(grp);
            var rotTarget = grp;
            if (node.pivot) { var pv = new THREE.Group(); pv.name = node.name + '_pivot'; pv.position.set(node.pivot[0], node.pivot[1], node.pivot[2]); grp.add(pv); mesh.position.set(-node.pivot[0], -node.pivot[1], -node.pivot[2]); pv.add(mesh); rotTarget = pv; grp.userData.pivot = pv; }
            else { grp.add(mesh); }
            if (node.rotation) rotTarget.rotation.set(node.rotation[0], node.rotation[1], node.rotation[2]);
            var childComp = node.pivot ? [-node.pivot[0],-node.pivot[1],-node.pivot[2]] : [0,0,0];
            if (node.children) { for (var ci2 = 0; ci2 < node.children.length; ci2++) buildNode(node.children[ci2], rotTarget, childComp); }
        }
        buildNode(config, parent, [0,0,0]);
    }

    function createHexapodAnimationSystem(root) {
        var P = {}; var legNames = ['左前腿','右前腿','左中腿','右中腿','左后腿','右后腿'];
        legNames.forEach(function(name) {
            P[name] = root.getObjectByName(name);
            P[name + '_hipX'] = root.getObjectByName(name.replace('腿', '大腿') + '_pivot');
            P[name + '_knee'] = root.getObjectByName(name.replace('腿', '小腿') + '_pivot');
            P[name + '_ankle'] = root.getObjectByName(name.replace('腿', '脚踝') + '_pivot');
        });
        ['左加特林','右加特林','左导弹巢','右导弹巢'].forEach(function(name) { P[name] = root.getObjectByName(name + '_pivot'); });
        P.root = root;
        var asys = new AnimationSystem(root);
        var GA = ['左前腿','右中腿','左后腿'], GB = ['右前腿','左中腿','右后腿'];

        function gaitTrack(off) {
            function k(t, v) { return { t: ((t+off)%1.0+1.0)%1.0, v: v }; }
            return {
                hipZ: [k(0,0.08),k(0.15,0.18),k(0.4,-0.05),k(0.6,-0.12),k(0.75,0.05),k(0.9,0.12),k(1,0.08)],
                hipX: [k(0,-0.05),k(0.2,-0.1),k(0.4,0.25),k(0.55,0.35),k(0.7,0.2),k(0.85,-0.05),k(1,-0.05)],
                knee: [k(0,0.08),k(0.3,0.1),k(0.5,0.5),k(0.65,0.3),k(0.8,0.1),k(1,0.08)],
                ankle: [k(0,0.05),k(0.3,0.0),k(0.5,-0.12),k(0.7,-0.05),k(1,0.05)]
            };
        }

        function addGait(name, dur, gaOff, gbOff, bodyKeys, hzSign) {
            var tracks = []; if (bodyKeys) tracks.push({ target: P.root, prop: 'position', axis: 'y', keys: bodyKeys });
            var hs = hzSign || 1;
            GA.forEach(function(n) { var g = gaitTrack(gaOff);
                tracks.push({ target: P[n], prop: 'rotation', axis: 'z', keys: g.hipZ.map(function(k){return {t:k.t,v:k.v*hs};}) });
                tracks.push({ target: P[n+'_hipX'], prop: 'rotation', axis: 'x', keys: g.hipX });
                tracks.push({ target: P[n+'_knee'], prop: 'rotation', axis: 'x', keys: g.knee });
                tracks.push({ target: P[n+'_ankle'], prop: 'rotation', axis: 'x', keys: g.ankle });
            });
            GB.forEach(function(n) { var g = gaitTrack(gbOff);
                tracks.push({ target: P[n], prop: 'rotation', axis: 'z', keys: g.hipZ.map(function(k){return {t:k.t,v:k.v*hs};}) });
                tracks.push({ target: P[n+'_hipX'], prop: 'rotation', axis: 'x', keys: g.hipX });
                tracks.push({ target: P[n+'_knee'], prop: 'rotation', axis: 'x', keys: g.knee });
                tracks.push({ target: P[n+'_ankle'], prop: 'rotation', axis: 'x', keys: g.ankle });
            });
            asys.define(name, dur, tracks);
        }

        asys.define('Idle', 2.0, [{ target: P.root, prop: 'position', axis: 'y', keys: [{t:0,v:0},{t:0.25,v:0.02},{t:0.5,v:0},{t:0.75,v:-0.01},{t:1,v:0}] }].concat(legNames.flatMap(function(n) { return [
            { target: P[n], prop: 'rotation', axis: 'z', keys: [{t:0,v:n.indexOf('右')>=0?-0.04:0.04},{t:0.5,v:n.indexOf('右')>=0?0.04:-0.04},{t:1,v:n.indexOf('右')>=0?-0.04:0.04}] },
            { target: P[n+'_hipX'], prop: 'rotation', axis: 'x', keys: [{t:0,v:-0.02},{t:0.5,v:0.02},{t:1,v:-0.02}] },
        ]; })));
        addGait('MoveForward', 1.2, 0, 0.5, [{t:0,v:0},{t:0.125,v:0.04},{t:0.25,v:0.01},{t:0.5,v:0},{t:0.625,v:0.03},{t:0.75,v:0.01},{t:1,v:0}], 1);
        addGait('MoveBackward', 1.2, 0, 0.5, [{t:0,v:0},{t:0.125,v:0.03},{t:0.375,v:0},{t:0.625,v:0.03},{t:0.875,v:0},{t:1,v:0}], -1);
        addGait('StrafeLeft', 1.0, 0, 0.5, [{t:0,v:0},{t:0.5,v:0.02},{t:1,v:0}], 1);
        addGait('StrafeRight', 1.0, 0, 0.5, [{t:0,v:0},{t:0.5,v:0.02},{t:1,v:0}], -1);

        asys.define('TurnLeft', 1.5, [{ target: P.root, prop: 'position', axis: 'y', keys: [{t:0,v:0},{t:0.5,v:0.02},{t:1,v:0}] }].concat(['左前腿','左中腿','左后腿'].flatMap(function(n) { return [
            { target: P[n], prop: 'rotation', axis: 'z', keys: [{t:0,v:0.08},{t:0.25,v:0.35},{t:0.5,v:0.15},{t:0.75,v:0.25},{t:1,v:0.08}] },
            { target: P[n+'_hipX'], prop: 'rotation', axis: 'x', keys: [{t:0,v:-0.05},{t:0.3,v:0.25},{t:0.7,v:0.05},{t:1,v:-0.05}] },
            { target: P[n+'_knee'], prop: 'rotation', axis: 'x', keys: [{t:0,v:0.1},{t:0.4,v:0.35},{t:0.8,v:0.1},{t:1,v:0.1}] },
        ]; })).concat(['右前腿','右中腿','右后腿'].flatMap(function(n) { return [
            { target: P[n], prop: 'rotation', axis: 'z', keys: [{t:0,v:-0.08},{t:0.25,v:-0.15},{t:0.5,v:-0.05},{t:0.75,v:-0.12},{t:1,v:-0.08}] },
            { target: P[n+'_hipX'], prop: 'rotation', axis: 'x', keys: [{t:0,v:-0.05},{t:0.3,v:0.15},{t:0.7,v:0},{t:1,v:-0.05}] },
            { target: P[n+'_knee'], prop: 'rotation', axis: 'x', keys: [{t:0,v:0.1},{t:0.4,v:0.2},{t:0.8,v:0.1},{t:1,v:0.1}] },
        ]; })));

        asys.define('TurnRight', 1.5, [{ target: P.root, prop: 'position', axis: 'y', keys: [{t:0,v:0},{t:0.5,v:0.02},{t:1,v:0}] }].concat(['左前腿','左中腿','左后腿'].flatMap(function(n) { return [
            { target: P[n], prop: 'rotation', axis: 'z', keys: [{t:0,v:0.08},{t:0.25,v:0.12},{t:0.5,v:0.05},{t:0.75,v:0.15},{t:1,v:0.08}] },
            { target: P[n+'_hipX'], prop: 'rotation', axis: 'x', keys: [{t:0,v:-0.05},{t:0.3,v:0.15},{t:0.7,v:0},{t:1,v:-0.05}] },
            { target: P[n+'_knee'], prop: 'rotation', axis: 'x', keys: [{t:0,v:0.1},{t:0.4,v:0.2},{t:0.8,v:0.1},{t:1,v:0.1}] },
        ]; })).concat(['右前腿','右中腿','右后腿'].flatMap(function(n) { return [
            { target: P[n], prop: 'rotation', axis: 'z', keys: [{t:0,v:-0.08},{t:0.25,v:-0.35},{t:0.5,v:-0.15},{t:0.75,v:-0.25},{t:1,v:-0.08}] },
            { target: P[n+'_hipX'], prop: 'rotation', axis: 'x', keys: [{t:0,v:-0.05},{t:0.3,v:0.25},{t:0.7,v:0.05},{t:1,v:-0.05}] },
            { target: P[n+'_knee'], prop: 'rotation', axis: 'x', keys: [{t:0,v:0.1},{t:0.4,v:0.35},{t:0.8,v:0.1},{t:1,v:0.1}] },
        ]; })));

        asys.define('Attack', 0.8, [
            { target: P.左加特林, prop: 'rotation', axis: 'x', keys: [{t:0,v:-0.05},{t:0.1,v:0.1},{t:0.2,v:-0.05},{t:0.3,v:0.1},{t:0.4,v:-0.05},{t:0.5,v:0.1},{t:0.6,v:-0.05},{t:0.7,v:0.1},{t:1,v:-0.05}] },
            { target: P.右加特林, prop: 'rotation', axis: 'x', keys: [{t:0,v:-0.05},{t:0.1,v:0.1},{t:0.2,v:-0.05},{t:0.3,v:0.1},{t:0.4,v:-0.05},{t:0.5,v:0.1},{t:0.6,v:-0.05},{t:0.7,v:0.1},{t:1,v:-0.05}] },
            { target: P.root, prop: 'rotation', axis: 'x', keys: [{t:0,v:0},{t:0.05,v:0.02},{t:0.1,v:0},{t:0.2,v:0.02},{t:0.25,v:0},{t:0.4,v:0.02},{t:0.45,v:0},{t:0.6,v:0.02},{t:0.65,v:0},{t:1,v:0}] },
        ]);

        asys.define('Death', 2.0, [
            { target: P.root, prop: 'rotation', axis: 'x', keys: [{t:0,v:0},{t:0.2,v:0.3},{t:0.5,v:0.8},{t:0.8,v:1.0},{t:1,v:1.1}] },
            { target: P.root, prop: 'rotation', axis: 'z', keys: [{t:0,v:0},{t:0.3,v:0.05},{t:0.6,v:0.12},{t:1,v:0.18}] },
            { target: P.root, prop: 'position', axis: 'y', keys: [{t:0,v:0},{t:0.3,v:-0.3},{t:0.6,v:-0.7},{t:1,v:-1.0}] },
        ].concat(legNames.flatMap(function(n,i) {
            var sign = n.indexOf('右')>=0 ? -1 : 1;
            return [
                { target: P[n], prop: 'rotation', axis: 'z', keys: [{t:0,v:sign*0.05},{t:0.3,v:sign*0.4},{t:0.6,v:sign*0.7},{t:1,v:sign*0.9}] },
                { target: P[n+'_hipX'], prop: 'rotation', axis: 'x', keys: [{t:0,v:-0.05},{t:0.3,v:0.15},{t:0.6,v:0.5},{t:1,v:0.8}] },
                { target: P[n+'_knee'], prop: 'rotation', axis: 'x', keys: [{t:0,v:0.1},{t:0.3,v:0.3},{t:0.6,v:0.6},{t:1,v:0.9}] },
            ];
        })));
        return asys;
    }

    var _hexapodTemplate = null;
    var _hexapodTemplateScale = 1.0;
    var _hexapodTemplateBaseY = 0;
    function createHexapod() {
        if (!_hexapodTemplate) {
            _hexapodTemplate = new THREE.Group();
            var cfg = getHexapodConfig();
            if (!cfg.name) { console.error('Hexapod config not loaded!'); return new THREE.Group(); }
            buildHexapodFromConfig(cfg, _hexapodTemplate, false);
            var bbox = new THREE.Box3().setFromObject(_hexapodTemplate);
            var currentH = bbox.max.y - bbox.min.y;
            if (currentH > 0) { _hexapodTemplateScale = 2.5 / currentH; _hexapodTemplateBaseY = -bbox.min.y * _hexapodTemplateScale; }
        }
        var root = _hexapodTemplate.clone(true);
        root.scale.setScalar(_hexapodTemplateScale);
        root.position.y = _hexapodTemplateBaseY;
        var skel = new THREE.Group(); skel.name = '_skeleton';
        while (root.children.length > 0) skel.add(root.children[0]);
        root.add(skel);
        var cylGeo = new THREE.CylinderGeometry(0.5, 0.7, 2.5, 6);
        var cylMesh = new THREE.Mesh(cylGeo, new THREE.MeshBasicMaterial({ color: 0x4a4a5a }));
        cylMesh.position.y = 1.25; cylMesh.visible = false; cylMesh.name = '_lodCylinder'; root.add(cylMesh);
        root.userData._skeletonGroup = skel; root.userData._lodCylinder = cylMesh;
        var asys = createHexapodAnimationSystem(root);
        root.userData._animSystem = asys; root.userData.enemyType = 'hexapod';
        asys.play('Idle', true);
        return root;
    }

    function makeHexapod() { return createHexapod(); }

})();
