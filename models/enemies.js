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


    // 2.5 AnimationSystem — 手动插值动画引擎（v0.52.0 分层支持）
    // 动画层：独立状态，同层内同时只能播一个动画
    class AnimationLayer {
      constructor() {
        this.current = null;
        this.currentTime = 0;
        this.playing = false;
        this.loop = true;
        this.clampWhenFinished = false;
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
    }

    class AnimationSystem {
      constructor(root) {
        this.root = root;
        this.anims = {};
        // layers[0] = body/腿 , layers[1] = weapons/武器（并发播放，互不干扰）
        this.layers = [new AnimationLayer()];
        // LOD 分帧
        this.skipInterval = 0;
        this.skipAccum = 0;
      }

      // 获取或创建第 n 层（0=主体, 1=武器, ...）
      layer(n) {
        while (this.layers.length <= n) {
          this.layers.push(new AnimationLayer());
        }
        return this.layers[n];
      }

      // 注册动画定义（所有层共享）
      define(name, duration, trackDefs) {
        this.anims[name] = { duration, trackDefs };
      }

      findPivot(nodeName) {
        const g = this.root.getObjectByName(nodeName);
        return g ? (g.userData.pivot || g) : null;
      }
      find(nodeName) {
        return this.root.getObjectByName(nodeName);
      }

      // ── 向后兼容：play/stop 操作 layer 0 ──
      play(name, loop = true) {
        this.layers[0].play(name, loop);
      }
      stop() {
        this.layers[0].stop();
      }
      get current() { return this.layers[0].current; }
      get currentTime() { return this.layers[0].currentTime; }
      get playing() { return this.layers[0].playing; }
      get loop() { return this.layers[0].loop; }
      get clampWhenFinished() { return this.layers[0].clampWhenFinished; }
      set current(v) { this.layers[0].current = v; }
      set currentTime(v) { this.layers[0].currentTime = v; }
      set playing(v) { this.layers[0].playing = v; }
      set loop(v) { this.layers[0].loop = v; }
      set clampWhenFinished(v) { this.layers[0].clampWhenFinished = v; }

      update(dt) {
        // LOD 分帧
        this.skipAccum += dt;
        var effectiveDt = dt;
        if (this.skipInterval > 0) {
          if (this.skipAccum < this.skipInterval) return;
          effectiveDt = this.skipAccum;
          this.skipAccum = 0;
        }
        // 更新所有层
        for (var li = 0; li < this.layers.length; li++) {
          this._updateLayer(this.layers[li], effectiveDt);
        }
      }

      _updateLayer(L, dt) {
        if (!L.playing || !L.current) return;
        var anim = this.anims[L.current];
        if (!anim) return;

        L.currentTime += dt / anim.duration;

        if (L.loop) {
          L.currentTime = L.currentTime % 1.0;
        } else if (L.currentTime >= 1.0) {
          L.currentTime = 1.0;
          if (L.clampWhenFinished) {
            L.playing = false;
          }
        }

        var t = L.currentTime;
        var trackDefs = anim.trackDefs;
        var restPoses = this._restPoses;
        for (var ti = 0; ti < trackDefs.length; ti++) {
          var td = trackDefs[ti];
          var target = td.target, prop = td.prop, axis = td.axis, keys = td.keys;
          if (!target) continue;
          var val;
          if (t <= keys[0].t) {
            val = keys[0].v;
          } else if (t >= keys[keys.length - 1].t) {
            val = keys[keys.length - 1].v;
          } else {
            for (var ki = 1; ki < keys.length; ki++) {
              if (t <= keys[ki].t) {
                var k0 = keys[ki - 1], k1 = keys[ki];
                var frac = (t - k0.t) / (k1.t - k0.t);
                val = k0.v + (k1.v - k0.v) * frac;
                break;
              }
            }
          }
          if (val !== undefined) {
            // 如果有休息姿态基准，关键帧值作为偏移量叠加
            if (td._restKey && restPoses && restPoses[td._restKey] !== undefined) {
              val = restPoses[td._restKey] + val;
            }
            if (axis) target[prop][axis] = val;
            else target[prop] = val;
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
        // 字体 fallback：Windows Microsoft YaHei / macOS PingFang SC / 通用 sans-serif
        // （headless chromium 无中文字体会渲染方块，但生产环境正常）
        bctx.font = 'bold 13px "Microsoft YaHei","PingFang SC","Heiti SC",sans-serif';
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
            const S3 = Math.sqrt(3) / 2;
            function mkTaperedBox(bw, h, bd, tw, td, ox, oz, bx, bz) {
                bx = bx || 0; bz = bz || 0;
                const hw = bw / 2, hd = bd / 2, thw = tw / 2, thd = td / 2;
                const v = [], idx = []; let vi = 0;
                const q = (a, b, c, d) => { v.push(a[0],a[1],a[2],b[0],b[1],b[2],c[0],c[1],c[2],d[0],d[1],d[2]); idx.push(vi,vi+1,vi+2,vi,vi+2,vi+3); vi+=4; };
                q([-hw+bx,0,-hd+bz],[hw+bx,0,-hd+bz],[hw+bx,0,hd+bz],[-hw+bx,0,hd+bz]);
                q([-thw+ox,h,-thd+oz],[-thw+ox,h,thd+oz],[thw+ox,h,thd+oz],[thw+ox,h,-thd+oz]);
                q([-hw+bx,0,-hd+bz],[-thw+ox,h,-thd+oz],[thw+ox,h,-thd+oz],[hw+bx,0,-hd+bz]);
                q([hw+bx,0,hd+bz],[thw+ox,h,thd+oz],[-thw+ox,h,thd+oz],[-hw+bx,0,hd+bz]);
                q([-hw+bx,0,hd+bz],[-thw+ox,h,thd+oz],[-thw+ox,h,-thd+oz],[-hw+bx,0,-hd+bz]);
                q([hw+bx,0,-hd+bz],[thw+ox,h,-thd+oz],[thw+ox,h,thd+oz],[hw+bx,0,hd+bz]);
                const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(v,3)); g.setIndex(idx); g.computeVertexNormals(); return g;
            }
            function mkRidgeBox(bw, h, bd, tw, td, ox, oz, ridgeY, ridgeZ) {
                const hw = bw / 2, hd = bd / 2, thw = tw / 2, thd = td / 2;
                ridgeY = Math.min(Math.max(ridgeY, 0), h);
                const wRidge = bw + (ridgeY / h) * (tw - bw);
                const hwr = wRidge / 2;
                const zFrontAtRidge = hd + (ridgeY / h) * (thd + oz - hd);
                const zRidge = zFrontAtRidge + ridgeZ;
                const v = [], idx = []; let vi = 0;
                const q = (a, b, c, d) => { v.push(a[0],a[1],a[2],b[0],b[1],b[2],c[0],c[1],c[2],d[0],d[1],d[2]); idx.push(vi,vi+1,vi+2,vi,vi+2,vi+3); vi+=4; };
                const t = (a, b, c) => { v.push(a[0],a[1],a[2],b[0],b[1],b[2],c[0],c[1],c[2]); idx.push(vi,vi+1,vi+2); vi+=3; };
                q([-hw,0,-hd],[hw,0,-hd],[hw,0,hd],[-hw,0,hd]);
                q([-thw+ox,h,-thd+oz],[-thw+ox,h,thd+oz],[thw+ox,h,thd+oz],[thw+ox,h,-thd+oz]);
                q([-hw,0,-hd],[-thw+ox,h,-thd+oz],[thw+ox,h,-thd+oz],[hw,0,-hd]);
                q([hw,0,hd],[hwr,ridgeY,zRidge],[-hwr,ridgeY,zRidge],[-hw,0,hd]);
                q([hwr,ridgeY,zRidge],[thw+ox,h,thd+oz],[-thw+ox,h,thd+oz],[-hwr,ridgeY,zRidge]);
                t([-hw,0,hd],[-hwr,ridgeY,zRidge],[-thw+ox,h,thd+oz]);
                t([-hw,0,hd],[-thw+ox,h,thd+oz],[-thw+ox,h,-thd+oz]);
                t([-hw,0,hd],[-thw+ox,h,-thd+oz],[-hw,0,-hd]);
                t([hw,0,-hd],[thw+ox,h,-thd+oz],[thw+ox,h,thd+oz]);
                t([hw,0,-hd],[thw+ox,h,thd+oz],[hwr,ridgeY,zRidge]);
                t([hw,0,-hd],[hwr,ridgeY,zRidge],[hw,0,hd]);
                const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(v,3)); g.setIndex(idx); g.computeVertexNormals(); return g;
            }
            function mkTaperedHex(bw, h, bd, tw, td, ox, oz) {
                const hw = bw / 2, hd = bd / 2, thw = tw / 2, thd = td / 2;
                const v = [], idx = []; let vi = 0;
                const q = (a, b, c, d) => { v.push(a[0],a[1],a[2],b[0],b[1],b[2],c[0],c[1],c[2],d[0],d[1],d[2]); idx.push(vi,vi+1,vi+2,vi,vi+2,vi+3); vi+=4; };
                const fan = (p) => { v.push(...p.reduce((a,x)=>a.concat(x),[])); idx.push(vi,vi+1,vi+2,vi,vi+2,vi+3,vi,vi+3,vi+4,vi,vi+4,vi+5); vi+=6; };
                fan([[hw,0,0],[hw/2,0,hd*S3],[-hw/2,0,hd*S3],[-hw,0,0],[-hw/2,0,-hd*S3],[hw/2,0,-hd*S3]]);
                fan([[thw+ox,h,oz],[thw/2+ox,h,-thd*S3+oz],[-thw/2+ox,h,-thd*S3+oz],[-thw+ox,h,oz],[-thw/2+ox,h,thd*S3+oz],[thw/2+ox,h,thd*S3+oz]]);
                q([hw,0,0],[thw+ox,h,oz],[thw/2+ox,h,thd*S3+oz],[hw/2,0,hd*S3]);
                q([hw/2,0,hd*S3],[thw/2+ox,h,thd*S3+oz],[-thw/2+ox,h,thd*S3+oz],[-hw/2,0,hd*S3]);
                q([-hw/2,0,hd*S3],[-thw/2+ox,h,thd*S3+oz],[-thw+ox,h,oz],[-hw,0,0]);
                q([-hw,0,0],[-thw+ox,h,oz],[-thw/2+ox,h,-thd*S3+oz],[-hw/2,0,-hd*S3]);
                q([-hw/2,0,-hd*S3],[-thw/2+ox,h,-thd*S3+oz],[thw/2+ox,h,-thd*S3+oz],[hw/2,0,-hd*S3]);
                q([hw/2,0,-hd*S3],[thw/2+ox,h,-thd*S3+oz],[thw+ox,h,oz],[hw,0,0]);
                const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(v,3)); g.setIndex(idx); g.computeVertexNormals(); return g;
            }
            function mkWedge(bwB, bwT, bh, depth) {
                const hb = bwB / 2, ht = bwT / 2, hm = (hb + ht) / 2, hh = bh / 2;
                const A=[-hb,-hh,0],B=[hb,-hh,0],C=[ht,hh,0],D=[-ht,hh,0],E=[-hm,0,depth],F=[hm,0,depth];
                const v = [], idx = []; let vi = 0;
                const q = (a, b, c, d) => { v.push(...a,...b,...c,...d); idx.push(vi,vi+1,vi+2,vi,vi+2,vi+3); vi+=4; };
                const t = (a, b, c) => { v.push(...a,...b,...c); idx.push(vi,vi+1,vi+2); vi+=3; };
                q(A,B,C,D); q(A,B,F,E); q(D,E,F,C); t(A,E,D); t(B,C,F);
                const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(v,3)); g.setIndex(idx); g.computeVertexNormals(); return g;
            }
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
                    const tl = node.thetaLength != null ? node.thetaLength : Math.PI;
                    return new THREE.SphereGeometry(r, s[0], s[1], 0, Math.PI * 2, 0, tl);
                }
                case 'Plane': {
                    const [w, h] = node.size;
                    return new THREE.PlaneGeometry(w, h);
                }
                case 'Torus': {
                    const [r, tube] = node.size;
                    return new THREE.TorusGeometry(r, tube, 6, 12);
                }
                case 'TaperedBox': { const s = node.size; return mkTaperedBox(s[0], s[1], s[2], s[3], s[4], s[5]||0, s[6]||0, s[7]||0, s[8]||0); }
                case 'RidgeBox': { const s = node.size; return mkRidgeBox(s[0], s[1], s[2], s[3], s[4], s[5]||0, s[6]||0, s[7] != null ? s[7] : 0.5*(s[1]||1), s[8]||0); }
                case 'TaperedHex': { const s = node.size; return mkTaperedHex(s[0], s[1], s[2], s[3], s[4], s[5]||0, s[6]||0); }
                case 'Wedge': { const s = node.size; return mkWedge(s[0], s[1] != null ? s[1] : s[0], s[2] != null ? s[2] : 0.1, s[3] != null ? s[3] : 0.1); }
                default:
                    return null;
            }
        }
        function buildNode(node, parentObj, pivotComp) {
            pivotComp = pivotComp || [0, 0, 0];
            if (node.type === 'Group') {
                const g = new THREE.Group();
                g.name = node.name;
                // Group 也加 pivotComp（addon 包装 Group 挂在 parent pivot 上，需补偿到 mesh 中心基准）
                if (node.position)
                    g.position.set(node.position[0] + pivotComp[0], node.position[1] + pivotComp[1], node.position[2] + pivotComp[2]);
                else g.position.set(pivotComp[0], pivotComp[1], pivotComp[2]);
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

    // legacy 树（HUMANOID_BASE 系）l_/r_ 命名与新数据层镜像（l 在 -X vs +X，均面朝 +Z），
    // rotation y/z 在两树语义相反；动画按新树（解剖学）编写，游戏侧消费时取负保持动作协调
    // （左右手互换但出拳/扭腰/护手/外张方向正确；x 轴与位置轨道不受影响）
    function mirrorAnimsForLegacyTree(animsCfg) {
        if (!animsCfg || !animsCfg.actions) return animsCfg;
        const out = JSON.parse(JSON.stringify(animsCfg));
        Object.keys(out.actions).forEach((name) => {
            out.actions[name] = out.actions[name].map((t) => {
                if (t.prop === 'rotation' && (t.axis === 'y' || t.axis === 'z')) {
                    return Object.assign({}, t, { keys: t.keys.map((k) => ({ t: k.t, v: -k.v })) });
                }
                return t;
            });
        });
        if (out.restPoses) {
            Object.keys(out.restPoses).forEach((k) => {
                if (/:[yz]$/.test(k) && !k.startsWith('pelvis') && !k.startsWith('root')) {
                    out.restPoses[k] = -out.restPoses[k];
                }
            });
        }
        return out;
    }

    // 4.4 createHumanoidAnimationSystem(root) — rest-pose 偏移动画（复用 AnimationSystem 类）
        // 4.4 createHumanoidAnimationSystem(root, animsCfg) — rest-pose 偏移动画（数据驱动：每骨架一套 anims，v0.79.x 重构）
    function createHumanoidAnimationSystem(root, animsCfg) {
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
        const cfg = animsCfg || HC.BASE_ANIMS;
        asys._restPoses = (cfg && cfg.restPoses) || HC.REST_POSES; // rest 基线：每骨架独立
        const DUR = { Idle: 2.0, Walk: 1.4, Run: 0.8, Swing: 1.0, Punch: 1.0, Stagger: 0.5, Die: 1.5 };
        Object.keys(cfg.actions || {}).forEach((name) => {
            const tracks = (cfg.actions[name] || []).map((t) => ({
                target: t.kind === 'P' ? P[t.joint] : O[t.joint],
                prop: t.prop,
                axis: t.axis,
                _restKey: t.restKey || null,
                keys: t.keys,
            }));
            asys.define(name, DUR[name] || 1.0, tracks);
        });
        // 切动画时复位"非新动画轨道"的关节到创建时树静态姿态
        // （_updateLayer 只写当前动画轨道：Run→Walk 前臂残留弯肘 / Die 后 head z 残留歪头的根因）
        const _initPose = {};
        HC.JOINT_NAMES.forEach((n) => {
            const pv = P[n] || O[n];
            if (pv) _initPose[n] = { x: pv.rotation.x, y: pv.rotation.y, z: pv.rotation.z };
        });
        const _origPlay = asys.play.bind(asys);
        asys.play = function (name, loop) {
            const r = _origPlay(name, loop);
            const anim = asys.anims[name];
            if (anim) {
                const touched = {};
                (anim.trackDefs || []).forEach((td) => {
                    if (td.target) touched[td.target.uuid] = true;
                });
                HC.JOINT_NAMES.forEach((n) => {
                    const pv = P[n] || O[n];
                    if (pv && !touched[pv.uuid] && _initPose[n]) {
                        pv.rotation.set(_initPose[n].x, _initPose[n].y, _initPose[n].z);
                    }
                });
            }
            return r;
        };
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
        // 教师(成人)固定一套体型（不再随机），学生(儿童)保留随机高矮胖瘦
        const params = (variant === 'teacher_m' || variant === 'teacher_f')
            ? {
                  height: heightM,
                  build: vr.build ? vr.build[0] : HC.BODY_PARAMS.build.default,
                  hunch: vr.hunch ? vr.hunch[0] : HC.BODY_PARAMS.hunch.default,
                  curves: variant === 'teacher_f' ? 0.7 : 0,
              }
            : {
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
        // 动画系统（legacy 树 l/r 镜像 → rotation y/z 取负适配）
        const rawAnims = (HC.MODELS[variant] && HC.MODELS[variant].anims) || HC.BASE_ANIMS;
        const variantAnims = mirrorAnimsForLegacyTree(rawAnims);
        const asys = createHumanoidAnimationSystem(root, variantAnims);
        root.userData._animSystem = asys;
        root.userData.enemyType = 'zombie'; // 关键：让 enemyAI isZombie 判定为真，走丧尸状态机
        root.userData.variant = variant; // 变体名（外观/工厂用）
        root.userData._seed = s;
        asys.play('Idle', true);
        return root;
    }

    // ─── 暴露到全局 ───
    window.EnemyModels = {
        createAssaultVehicle,
        createZombie,
        createZombieMaterials,
        createCampusZombie,
        createHumanoidMaterials,
        createHexapod,
        AnimationSystem,
    };

    // ─── 注册到 ModelRegistry（模型预览） ───
    window.ModelRegistry.register('enemies', '装甲突击车', makeAssaultVehicle);
    window.ModelRegistry.register('enemies', '丧尸', makeZombie);
    window.ModelRegistry.register('enemies', '六足战车', makeHexapod);
    // 校园人形丧尸预览（固定 seed 与 campus.map.json 测试数据一致，便于在主菜单模型预览看清外观）
    window.ModelRegistry.register('enemies', '学生(男)', () => createCampusZombie({ variant: 'student_m', heightM: 1.3, seed: 1001 }));
    window.ModelRegistry.register('enemies', '学生(女)', () => createCampusZombie({ variant: 'student_f', heightM: 1.3, seed: 1002 }));
    window.ModelRegistry.register('enemies', '教师(男)', () => createCampusZombie({ variant: 'teacher_m', heightM: 1.65, seed: 1003 }));
    window.ModelRegistry.register('enemies', '教师(女)', () => createCampusZombie({ variant: 'teacher_f', heightM: 1.6, seed: 1004 }));

    console.log('🧟 敌方单位模型已就绪 | 装甲突击车 + 程序化丧尸(骨架动画) + 六足战车');


    // ═══════════════════════════════════════════════════════
    // ─── ③ 六足战车（精英敌人·三角步态·加特林+导弹巢）───
    // ═══════════════════════════════════════════════════════
    // 模型配置已提取到 models/hexapod_config.js，通过 window.HexapodConfig 引用
    function getHexapodConfig() {
        return (window.HexapodConfig && window.HexapodConfig.HEXAPOD_CONFIG) || {};
    }

    var _hexapodMatCache = {};
    var _urbanCamoTex = null;
    function _getUrbanCamoTex() {
        if (_urbanCamoTex) return _urbanCamoTex;
        var size = 512;
        var cv = document.createElement('canvas');
        cv.width = size; cv.height = size;
        var ctx = cv.getContext('2d');
        // 城市迷彩: 亮灰色为主调, 浅灰+银灰+蓝灰区块 (提亮30%)
        var bg = '#d0d0db';
        ctx.fillStyle = bg; ctx.fillRect(0, 0, size, size);
        // 大块斑纹
        var blobs = ['#b8b8c5', '#d8d8e0', '#c2c2d0', '#a8a8b5', '#c5c5d2'];
        var count = 35 + Math.floor(Math.random() * 15);
        for (var i = 0; i < count; i++) {
            ctx.fillStyle = blobs[Math.floor(Math.random() * blobs.length)];
            ctx.globalAlpha = 0.65 + Math.random() * 0.35;
            ctx.beginPath();
            var cx = Math.random() * size, cy = Math.random() * size;
            var rx = 25 + Math.random() * 70, ry = 18 + Math.random() * 50;
            var angle = Math.random() * Math.PI * 2;
            ctx.ellipse(cx, cy, rx, ry, angle, 0, Math.PI * 2);
            ctx.fill();
        }
        // 小斑点: 中灰, 增加纹理密度
        ctx.globalAlpha = 1;
        count = 18 + Math.floor(Math.random() * 12);
        for (var i2 = 0; i2 < count; i2++) {
            ctx.fillStyle = '#9a9aa8';
            ctx.globalAlpha = 0.45 + Math.random() * 0.35;
            ctx.beginPath();
            var cx2 = Math.random() * size, cy2 = Math.random() * size;
            var rx2 = 4 + Math.random() * 20, ry2 = 3 + Math.random() * 14;
            ctx.ellipse(cx2, cy2, rx2, ry2, Math.random() * Math.PI * 2, 0, Math.PI * 2);
            ctx.fill();
        }
        // 细锐边线模拟城市建筑的棱角
        ctx.globalAlpha = 0.22;
        ctx.strokeStyle = '#90909c';
        ctx.lineWidth = 1.5;
        for (var i3 = 0; i3 < 12; i3++) {
            ctx.beginPath();
            var sx = Math.random() * size, sy = Math.random() * size;
            ctx.moveTo(sx, sy);
            ctx.lineTo(sx + (Math.random()-0.5)*140, sy + (Math.random()-0.5)*100);
            ctx.stroke();
        }
        ctx.globalAlpha = 1;
        _urbanCamoTex = new THREE.CanvasTexture(cv);
        _urbanCamoTex.wrapS = THREE.RepeatWrapping;
        _urbanCamoTex.wrapT = THREE.RepeatWrapping;
        _urbanCamoTex.colorSpace = THREE.SRGBColorSpace;
        return _urbanCamoTex;
    }
    function _getHexapodMat(id) {
        if (_hexapodMatCache[id]) return _hexapodMatCache[id];
        var DEFS = {
            armor_dark:  { color: 0xc8c8d4, roughness: 0.50, metalness: 0.75 },
            armor_light: { color: 0xd4d4de, roughness: 0.45, metalness: 0.70 },
            dark_steel:  { color: 0x6a6a7a, roughness: 0.45, metalness: 0.85 },
            barrel_steel:{ color: 0x5a5a64, roughness: 0.35, metalness: 0.9 },
            steel:       { color: 0x8b8b98, roughness: 0.5,  metalness: 0.8 },
            warning_yellow: { color: 0xE8A820, roughness: 0.50, metalness: 0.40, emissive: 0xC08010, emissiveIntensity: 0.15 },
        };
        var d = DEFS[id] || { color: 0x888888, roughness: 0.6, metalness: 0.2 };
        // 装甲材质叠加城市迷彩纹理 (观瞄/武器/关节保留纯色)
        if (id === 'armor_dark' || id === 'armor_light') {
            d.map = _getUrbanCamoTex();
        }
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

        // ── 捕获休息姿态: 所有关节的初始旋转值作为动画基准 ──
        var RP = {};
        // 根节点: 位置和旋转也需保留基准 (否则动画会把pos.y重置为0)
        RP['root_y'] = root.position.y;
        RP['root_rx'] = root.rotation.x;
        RP['root_rz'] = root.rotation.z;
        legNames.forEach(function(name) {
            if (P[name + '_hipX']) RP[name + '_hipX_x'] = P[name + '_hipX'].rotation.x;
            if (P[name + '_knee']) RP[name + '_knee_x'] = P[name + '_knee'].rotation.x;
            if (P[name + '_ankle']) RP[name + '_ankle_x'] = P[name + '_ankle'].rotation.x;
            if (P[name]) RP[name + '_z'] = P[name].rotation.z;
        });
        ['左加特林','右加特林','左导弹巢','右导弹巢'].forEach(function(name) {
            if (P[name]) RP[name + '_x'] = P[name].rotation.x;
        });
        asys._restPoses = RP;
        // 辅助: 给track标记_restKey
        function rk(td, key) { td._restKey = key; }
        // 辅助: 创建root track并标记restKey
        function rootTrk(prop, axis, keys) {
            var t = { target: P.root, prop: prop, axis: axis, keys: keys };
            rk(t, 'root_' + (axis || 'y'));
            return t;
        }

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
            var tracks = []; if (bodyKeys) tracks.push(rootTrk('position', 'y', bodyKeys));
            var hs = hzSign || 1;
            GA.forEach(function(n) { var g = gaitTrack(gaOff);
                var tz = { target: P[n], prop: 'rotation', axis: 'z', keys: g.hipZ.map(function(k){return {t:k.t,v:k.v*hs};}) }; rk(tz, n+'_z'); tracks.push(tz);
                var tx = { target: P[n+'_hipX'], prop: 'rotation', axis: 'x', keys: g.hipX }; rk(tx, n+'_hipX_x'); tracks.push(tx);
                var tk = { target: P[n+'_knee'], prop: 'rotation', axis: 'x', keys: g.knee }; rk(tk, n+'_knee_x'); tracks.push(tk);
                var ta = { target: P[n+'_ankle'], prop: 'rotation', axis: 'x', keys: g.ankle }; rk(ta, n+'_ankle_x'); tracks.push(ta);
            });
            GB.forEach(function(n) { var g = gaitTrack(gbOff);
                var tz2 = { target: P[n], prop: 'rotation', axis: 'z', keys: g.hipZ.map(function(k){return {t:k.t,v:k.v*hs};}) }; rk(tz2, n+'_z'); tracks.push(tz2);
                var tx2 = { target: P[n+'_hipX'], prop: 'rotation', axis: 'x', keys: g.hipX }; rk(tx2, n+'_hipX_x'); tracks.push(tx2);
                var tk2 = { target: P[n+'_knee'], prop: 'rotation', axis: 'x', keys: g.knee }; rk(tk2, n+'_knee_x'); tracks.push(tk2);
                var ta2 = { target: P[n+'_ankle'], prop: 'rotation', axis: 'x', keys: g.ankle }; rk(ta2, n+'_ankle_x'); tracks.push(ta2);
            });
            asys.define(name, dur, tracks);
        }

        // Idle: 身体微呼吸 + 六腿微动 (放大振幅使其可见)
        var idleTracks = [rootTrk('position', 'y', [{t:0,v:0},{t:0.25,v:0.02},{t:0.5,v:0},{t:0.75,v:-0.01},{t:1,v:0}])];
        legNames.forEach(function(n) {
            var tz = { target: P[n], prop: 'rotation', axis: 'z', keys: [{t:0,v:n.indexOf('右')>=0?-0.06:0.06},{t:0.5,v:n.indexOf('右')>=0?0.06:-0.06},{t:1,v:n.indexOf('右')>=0?-0.06:0.06}] }; rk(tz, n+'_z'); idleTracks.push(tz);
            var tx = { target: P[n+'_hipX'], prop: 'rotation', axis: 'x', keys: [{t:0,v:-0.04},{t:0.5,v:0.04},{t:1,v:-0.04}] }; rk(tx, n+'_hipX_x'); idleTracks.push(tx);
            var tk = { target: P[n+'_knee'], prop: 'rotation', axis: 'x', keys: [{t:0,v:-0.03},{t:0.5,v:0.03},{t:1,v:-0.03}] }; rk(tk, n+'_knee_x'); idleTracks.push(tk);
        });
        asys.define('Idle', 2.0, idleTracks);
        addGait('MoveForward', 1.2, 0, 0.5, [{t:0,v:0},{t:0.125,v:0.04},{t:0.25,v:0.01},{t:0.5,v:0},{t:0.625,v:0.03},{t:0.75,v:0.01},{t:1,v:0}], 1);
        addGait('MoveBackward', 1.2, 0, 0.5, [{t:0,v:0},{t:0.125,v:0.03},{t:0.375,v:0},{t:0.625,v:0.03},{t:0.875,v:0},{t:1,v:0}], -1);
        addGait('StrafeLeft', 1.0, 0, 0.5, [{t:0,v:0},{t:0.5,v:0.02},{t:1,v:0}], 1);
        addGait('StrafeRight', 1.0, 0, 0.5, [{t:0,v:0},{t:0.5,v:0.02},{t:1,v:0}], -1);

        // TurnLeft
        var tlTracks = [rootTrk('position', 'y', [{t:0,v:0},{t:0.5,v:0.02},{t:1,v:0}])];
        ['左前腿','左中腿','左后腿'].forEach(function(n) {
            var tz = { target: P[n], prop: 'rotation', axis: 'z', keys: [{t:0,v:0.08},{t:0.25,v:0.35},{t:0.5,v:0.15},{t:0.75,v:0.25},{t:1,v:0.08}] }; rk(tz, n+'_z'); tlTracks.push(tz);
            var tx = { target: P[n+'_hipX'], prop: 'rotation', axis: 'x', keys: [{t:0,v:-0.05},{t:0.3,v:0.25},{t:0.7,v:0.05},{t:1,v:-0.05}] }; rk(tx, n+'_hipX_x'); tlTracks.push(tx);
            var tk = { target: P[n+'_knee'], prop: 'rotation', axis: 'x', keys: [{t:0,v:0.1},{t:0.4,v:0.35},{t:0.8,v:0.1},{t:1,v:0.1}] }; rk(tk, n+'_knee_x'); tlTracks.push(tk);
        });
        ['右前腿','右中腿','右后腿'].forEach(function(n) {
            var tz2 = { target: P[n], prop: 'rotation', axis: 'z', keys: [{t:0,v:-0.08},{t:0.25,v:-0.15},{t:0.5,v:-0.05},{t:0.75,v:-0.12},{t:1,v:-0.08}] }; rk(tz2, n+'_z'); tlTracks.push(tz2);
            var tx2 = { target: P[n+'_hipX'], prop: 'rotation', axis: 'x', keys: [{t:0,v:-0.05},{t:0.3,v:0.15},{t:0.7,v:0},{t:1,v:-0.05}] }; rk(tx2, n+'_hipX_x'); tlTracks.push(tx2);
            var tk2 = { target: P[n+'_knee'], prop: 'rotation', axis: 'x', keys: [{t:0,v:0.1},{t:0.4,v:0.2},{t:0.8,v:0.1},{t:1,v:0.1}] }; rk(tk2, n+'_knee_x'); tlTracks.push(tk2);
        });
        asys.define('TurnLeft', 1.5, tlTracks);

        // TurnRight
        var trTracks = [rootTrk('position', 'y', [{t:0,v:0},{t:0.5,v:0.02},{t:1,v:0}])];
        ['左前腿','左中腿','左后腿'].forEach(function(n) {
            var tz = { target: P[n], prop: 'rotation', axis: 'z', keys: [{t:0,v:0.08},{t:0.25,v:0.12},{t:0.5,v:0.05},{t:0.75,v:0.15},{t:1,v:0.08}] }; rk(tz, n+'_z'); trTracks.push(tz);
            var tx = { target: P[n+'_hipX'], prop: 'rotation', axis: 'x', keys: [{t:0,v:-0.05},{t:0.3,v:0.15},{t:0.7,v:0},{t:1,v:-0.05}] }; rk(tx, n+'_hipX_x'); trTracks.push(tx);
            var tk = { target: P[n+'_knee'], prop: 'rotation', axis: 'x', keys: [{t:0,v:0.1},{t:0.4,v:0.2},{t:0.8,v:0.1},{t:1,v:0.1}] }; rk(tk, n+'_knee_x'); trTracks.push(tk);
        });
        ['右前腿','右中腿','右后腿'].forEach(function(n) {
            var tz2 = { target: P[n], prop: 'rotation', axis: 'z', keys: [{t:0,v:-0.08},{t:0.25,v:-0.35},{t:0.5,v:-0.15},{t:0.75,v:-0.25},{t:1,v:-0.08}] }; rk(tz2, n+'_z'); trTracks.push(tz2);
            var tx2 = { target: P[n+'_hipX'], prop: 'rotation', axis: 'x', keys: [{t:0,v:-0.05},{t:0.3,v:0.25},{t:0.7,v:0.05},{t:1,v:-0.05}] }; rk(tx2, n+'_hipX_x'); trTracks.push(tx2);
            var tk2 = { target: P[n+'_knee'], prop: 'rotation', axis: 'x', keys: [{t:0,v:0.1},{t:0.4,v:0.35},{t:0.8,v:0.1},{t:1,v:0.1}] }; rk(tk2, n+'_knee_x'); trTracks.push(tk2);
        });
        asys.define('TurnRight', 1.5, trTracks);

        // Layer 0 — 攻击车身微后座
        asys.define('Attack', 0.8, [
            rootTrk('rotation', 'x', [{t:0,v:0},{t:0.05,v:0.02},{t:0.1,v:0},{t:0.2,v:0.02},{t:0.25,v:0},{t:0.4,v:0.02},{t:0.45,v:0},{t:0.6,v:0.02},{t:0.65,v:0},{t:1,v:0}]),
        ]);

        // Layer 1 (weapon) — 空闲
        var widleTracks = [];
        ['左加特林','右加特林','左导弹巢','右导弹巢'].forEach(function(name) {
            var isGat = name.indexOf('加特林') >= 0;
            var tw = { target: P[name], prop: 'rotation', axis: 'x', keys: [{t:0,v:isGat ? -0.05 : 0},{t:1,v:isGat ? -0.05 : 0}] }; rk(tw, name+'_x'); widleTracks.push(tw);
        });
        asys.define('WeaponIdle', 0.5, widleTracks);
        // Layer 1 (weapon) — 攻击
        var watkTracks = [];
        ['左加特林','右加特林'].forEach(function(name) {
            var tw = { target: P[name], prop: 'rotation', axis: 'x', keys: [{t:0,v:-0.05},{t:0.1,v:0.1},{t:0.2,v:-0.05},{t:0.3,v:0.1},{t:0.4,v:-0.05},{t:0.5,v:0.1},{t:0.6,v:-0.05},{t:0.7,v:0.1},{t:1,v:-0.05}] }; rk(tw, name+'_x'); watkTracks.push(tw);
        });
        ['左导弹巢','右导弹巢'].forEach(function(name) {
            var tw = { target: P[name], prop: 'rotation', axis: 'x', keys: [{t:0,v:0},{t:0.1,v:0.08},{t:0.2,v:0},{t:0.4,v:0.08},{t:0.5,v:0},{t:0.7,v:0.08},{t:0.8,v:0},{t:1,v:0}] }; rk(tw, name+'_x'); watkTracks.push(tw);
        });
        asys.define('Attack_Weapon', 0.8, watkTracks);

        // Death
        var deathTracks = [
            rootTrk('rotation', 'x', [{t:0,v:0},{t:0.2,v:0.3},{t:0.5,v:0.8},{t:0.8,v:1.0},{t:1,v:1.1}]),
            rootTrk('rotation', 'z', [{t:0,v:0},{t:0.3,v:0.05},{t:0.6,v:0.12},{t:1,v:0.18}]),
            rootTrk('position', 'y', [{t:0,v:0},{t:0.3,v:-0.3},{t:0.6,v:-0.7},{t:1,v:-1.0}]),
        ];
        legNames.forEach(function(n,i) {
            var sign = n.indexOf('右')>=0 ? -1 : 1;
            var tz = { target: P[n], prop: 'rotation', axis: 'z', keys: [{t:0,v:sign*0.05},{t:0.3,v:sign*0.4},{t:0.6,v:sign*0.7},{t:1,v:sign*0.9}] }; rk(tz, n+'_z'); deathTracks.push(tz);
            var tx = { target: P[n+'_hipX'], prop: 'rotation', axis: 'x', keys: [{t:0,v:-0.05},{t:0.3,v:0.15},{t:0.6,v:0.5},{t:1,v:0.8}] }; rk(tx, n+'_hipX_x'); deathTracks.push(tx);
            var tk = { target: P[n+'_knee'], prop: 'rotation', axis: 'x', keys: [{t:0,v:0.1},{t:0.3,v:0.3},{t:0.6,v:0.6},{t:1,v:0.9}] }; rk(tk, n+'_knee_x'); deathTracks.push(tk);
        });
        asys.define('Death', 2.0, deathTracks);
        // 武器层默认播放 Idle
        asys.layer(1).play('WeaponIdle', true);
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
            _hexapodTemplate.updateMatrixWorld(true);
            var bbox = new THREE.Box3().setFromObject(_hexapodTemplate);
            var currentH = bbox.max.y - bbox.min.y;
            if (currentH > 0) { _hexapodTemplateScale = 2.5 / currentH; _hexapodTemplateBaseY = -bbox.min.y * _hexapodTemplateScale; }
        }
        var root = _hexapodTemplate.clone(true);
        root.scale.setScalar(_hexapodTemplateScale);
        root.position.y = _hexapodTemplateBaseY;
        var skel = new THREE.Group(); skel.name = '_skeleton';
        while (root.children.length > 0) skel.add(root.children[0]);
        // 抵消六足战车内置的 +90° Y旋转, 使模型前端(-X)对齐世界-X标准约定
        skel.rotation.y = -Math.PI / 2;
        root.add(skel);
        var cylGeo = new THREE.CylinderGeometry(0.5, 0.7, 2.5, 6);
        var cylMesh = new THREE.Mesh(cylGeo, new THREE.MeshBasicMaterial({ color: 0x4a4a5a }));
        cylMesh.position.y = 1.25; cylMesh.visible = false; cylMesh.name = '_lodCylinder'; root.add(cylMesh);
        root.userData._skeletonGroup = skel; root.userData._lodCylinder = cylMesh;
        root.userData._baseY = _hexapodTemplateBaseY; // 模型底部→y=0偏移, 游戏贴地需要
        var asys = createHexapodAnimationSystem(root);
        root.userData._animSystem = asys; root.userData.enemyType = 'hexapod';
        asys.play('Idle', true);
        // ── 加特林枪管簇: 将4根枪管放入子Group, 绕中央轴公转(模仿真实加特林) ──
        var barrelClusters = [];
        ['左加特林','右加特林'].forEach(function(name) {
            var pivot = root.getObjectByName(name + '_pivot');
            if (!pivot) return;
            var barrelGroups = [];
            for (var ci = pivot.children.length - 1; ci >= 0; ci--) {
                var child = pivot.children[ci];
                if (child.name && child.name.indexOf('枪管') >= 0) barrelGroups.push(child);
            }
            if (barrelGroups.length === 0) return;
            var cluster = new THREE.Group();
            cluster.name = name + '_barrelCluster';
            pivot.add(cluster);
            for (var bi = 0; bi < barrelGroups.length; bi++) {
                cluster.add(barrelGroups[bi]);
            }
            barrelClusters.push(cluster);
        });
        root.userData._barrelClusters = barrelClusters;
        // ── 观瞄设备发光引用 ──
        root.userData._obsMesh = root.getObjectByName('观瞄球体_mesh');
        // ── 加特林枪管材质引用（用于红热发光）──
        var barrelMats = [];
        ['左加特林','右加特林'].forEach(function(name) {
            for (var bi = 1; bi <= 4; bi++) {
                var bg = root.getObjectByName(name + '枪管' + bi);
                if (bg && bg.children[0] && bg.children[0].material) {
                    barrelMats.push(bg.children[0].material);
                }
            }
        });
        root.userData._barrelMats = barrelMats;
        // ── 腿关节 pivot 引用（完整6腿×4关节, 用于步态动画直驱）──
        var legJoints = [];
        var tripodA = { '左前':true, '右中':true, '左后':true };
        ['左前','右前','左中','右中','左后','右后'].forEach(function(prefix) {
            var hipGrp = root.getObjectByName(prefix + '腿');           // hipZ: 水平摆角
            var thighPv = root.getObjectByName(prefix + '大腿_pivot');  // hipX: 髋抬腿
            var shinPv = root.getObjectByName(prefix + '小腿_pivot');   // knee: 膝关节
            var anklePv = root.getObjectByName(prefix + '脚踝_pivot');  // ankle: 踝关节
            if (thighPv && shinPv) {
                legJoints.push({
                    prefix: prefix,
                    tripodA: !!tripodA[prefix],
                    hipGrp: hipGrp,
                    thighPv: thighPv, shinPv: shinPv, anklePv: anklePv,
                    restHipZ: hipGrp ? hipGrp.rotation.z : 0,
                    restHipX: thighPv.rotation.x,
                    restKnee: shinPv.rotation.x,
                    restAnkle: anklePv ? anklePv.rotation.x : 0,
                });
            }
        });
        root.userData._legJoints = legJoints;
        // ── 武器原始父引用 (修复多次复活后_death_wp_*累积嵌套) ──
        var weaponParents = {};
        ['左加特林','右加特林','左导弹巢','右导弹巢'].forEach(function(name) {
            var wg = root.getObjectByName(name);
            if (wg && wg.parent) {
                weaponParents[name] = { parent: wg.parent, localPos: wg.position.clone(), localQuat: wg.quaternion.clone(), localScale: wg.scale.clone() };
            }
        });
        root.userData._weaponParents = weaponParents;
        return root;
    }

    function makeHexapod() { return createHexapod(); }

})();
