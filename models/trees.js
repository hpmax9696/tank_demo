/**
 * 树木模型 — 为 InstancedMesh 提供共享几何体 + 材质
 * v0.25.6 精度提升：橡树多层叶片簇、锥形树多层锥盘堆叠，新增模型预览注册
 */
(function () {
  const trunkMat = new THREE.MeshStandardMaterial({ color: '#8B5E3C', roughness: 0.9 });
  const crownMat1 = new THREE.MeshStandardMaterial({ color: '#4A8A6A', roughness: 0.85 }); // 锥形树蓝绿
  const crownMat2 = new THREE.MeshStandardMaterial({ color: '#4A8B3F', roughness: 0.8 });
  const crownMat3 = new THREE.MeshStandardMaterial({ color: '#2D6A2D', roughness: 0.85 }); // 橡树深绿

  const H = 1.0;

  // ─── 锥形树（松树风格）：多层锥盘 + 尖锥 ───
  // 5层扁平锥体（底部宽顶部窄）逐层堆叠，每层微幅旋转，模拟松树节状树冠
  function createConicalCrownGeo() {
    const geos = [];
    const layers = [
      // [bottomRadius, height, yOffset, segments]
      [0.34, 0.07, 0.0, 24],
      [0.29, 0.08, 0.1, 24],
      [0.23, 0.09, 0.2, 22],
      [0.17, 0.1, 0.3, 20],
      [0.11, 0.11, 0.4, 16],
    ];
    for (let i = 0; i < layers.length; i++) {
      const [r, h, y, segs] = layers[i];
      const g = new THREE.CylinderGeometry(r * 0.06, r, h, segs);
      g.rotateY((i * Math.PI) / 6); // 每层旋转30°，错开层叠感
      g.translate(0, y, 0);
      geos.push(g);
    }
    // 顶端尖锥
    const tip = new THREE.ConeGeometry(0.05, 0.14, 8);
    tip.translate(0, 0.52, 0);
    geos.push(tip);

    const merged = THREE.BufferGeometryUtils.mergeBufferGeometries(geos);
    geos.forEach((g) => g.dispose());
    return merged;
  }

  // ─── 球形树（伞形阔叶树）蓬松叶片簇 ───
  // 参考图特征：扁平半球形树冠，叶片密集蓬松，枝条向四周自然展开下垂
  // 由大量小椭球体（50+）在半球壳上均匀分布，模拟茂密蓬松的阔叶树冠
  function createSphericalCrownGeo() {
    const cluster = [];
    const R = 0.24; // 树冠半径基准

    // 1. 核心内部填充 (4个大球)
    cluster.push([0.0, 0.0, 0.0, 0.2]);
    cluster.push([0.0, -0.06, 0.0, 0.17]);
    cluster.push([0.08, 0.02, 0.06, 0.14]);
    cluster.push([-0.06, 0.02, -0.08, 0.14]);
    cluster.push([0.0, 0.08, 0.0, 0.16]);

    // 2. 中纬度环 (y = 0 ~ 0.1) — 圆顶核心区域
    const midAngles = [0, 45, 90, 135, 180, 225, 270, 315];
    for (const deg of midAngles) {
      const rad = (deg * Math.PI) / 180;
      const r = R * (0.55 + Math.random() * 0.15);
      const x = r * Math.cos(rad);
      const z = r * Math.sin(rad);
      const y = 0.02 + Math.random() * 0.08;
      const sz = 0.07 + Math.random() * 0.06;
      cluster.push([x, y, z, sz]);
    }

    // 3. 中低纬度环 (y = -0.04 ~ 0.04) — 树冠最饱满区域
    const midLow = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330];
    for (const deg of midLow) {
      const rad = (deg * Math.PI) / 180;
      const r = R * (0.65 + Math.random() * 0.2);
      const x = r * Math.cos(rad);
      const z = r * Math.sin(rad);
      const y = -0.02 + Math.random() * 0.06;
      const sz = 0.06 + Math.random() * 0.07;
      cluster.push([x, y, z, sz]);
    }

    // 4. 低纬度环 (y = -0.10 ~ -0.06) — 边缘下垂层
    const lowAngles = [0, 36, 72, 108, 144, 180, 216, 252, 288, 324];
    for (const deg of lowAngles) {
      const rad = (deg * Math.PI) / 180;
      const r = R * (0.75 + Math.random() * 0.2);
      const x = r * Math.cos(rad);
      const z = r * Math.sin(rad);
      const y = -0.08 + Math.random() * 0.04;
      const sz = 0.06 + Math.random() * 0.06;
      cluster.push([x, y, z, sz]);
    }

    // 5. 最外层下垂 (y = -0.16 ~ -0.10) — 模拟枝条下垂
    const dropAngles = [0, 60, 120, 180, 240, 300];
    for (const deg of dropAngles) {
      const rad = (deg * Math.PI) / 180;
      const r = R * (0.85 + Math.random() * 0.15);
      const x = r * Math.cos(rad);
      const z = r * Math.sin(rad);
      const y = -0.13 + Math.random() * 0.04;
      const sz = 0.04 + Math.random() * 0.04;
      cluster.push([x, y, z, sz]);
    }

    // 6. 顶面填充 (y = 0.12 ~ 0.18) — 圆润顶部
    const topAngles = [0, 60, 120, 180, 240, 300];
    for (const deg of topAngles) {
      const rad = (deg * Math.PI) / 180;
      const r = R * (0.25 + Math.random() * 0.2);
      const x = r * Math.cos(rad);
      const z = r * Math.sin(rad);
      const y = 0.12 + Math.random() * 0.06;
      const sz = 0.05 + Math.random() * 0.04;
      cluster.push([x, y, z, sz]);
    }

    // 7. 缝隙填充 — 随机散布填充空隙
    for (let i = 0; i < 12; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = R * (0.2 + Math.random() * 0.6);
      const x = dist * Math.cos(angle);
      const z = dist * Math.sin(angle);
      const y = -0.06 + Math.random() * 0.14;
      const sz = 0.04 + Math.random() * 0.05;
      cluster.push([x, y, z, sz]);
    }

    const geos = cluster.map((c) => {
      // 使用压扁的球体（scale-y = 0.7）使椭球体更扁平
      const g = new THREE.SphereGeometry(c[3], 10, 8);
      g.translate(c[0], c[1], c[2]);
      // 压扁效果：通过顶点变换
      const pos = g.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        pos.array[i * 3 + 1] *= 0.75; // y轴压扁
      }
      pos.needsUpdate = true;
      return g;
    });
    const merged = THREE.BufferGeometryUtils.mergeBufferGeometries(geos);
    geos.forEach((g) => g.dispose());
    return merged;
  }

  // ─── 橡树多层叶片簇树冠 ───
  // 由 11 个小椭球体层叠排列，模拟橡树蓬松层叠的叶片簇效果
  function createOakCrownGeo() {
    const cluster = [
      // [x, y, z, radius] — 底层 (y ~ -0.18)
      [0.0, -0.18, 0.0, 0.14],
      [0.14, -0.14, 0.08, 0.11],
      [-0.12, -0.16, -0.1, 0.11],
      [0.1, -0.12, -0.14, 0.1],
      [-0.14, -0.1, 0.12, 0.1],
      // 中层 (y ~ 0.0)
      [0.0, 0.0, 0.0, 0.14],
      [0.12, 0.04, -0.08, 0.1],
      [-0.1, 0.06, 0.08, 0.1],
      [0.08, -0.02, 0.12, 0.09],
      // 顶层 (y ~ 0.14)
      [0.04, 0.14, -0.04, 0.1],
      [-0.06, 0.16, 0.06, 0.09],
    ];
    const geos = cluster.map((c) => {
      const g = new THREE.SphereGeometry(c[3], 14, 10);
      g.translate(c[0], c[1], c[2]);
      return g;
    });
    const merged = THREE.BufferGeometryUtils.mergeBufferGeometries(geos);
    geos.forEach((g) => g.dispose());
    return merged;
  }

  const conicalCrownGeo = createConicalCrownGeo();
  const sphericalCrownGeo = createSphericalCrownGeo();
  const oakCrownGeo = createOakCrownGeo();

  window.TreeModels = {
    conical: {
      trunkGeo: new THREE.CylinderGeometry(0.04, 0.07, H * 0.5, 16),
      crownGeo: conicalCrownGeo,
      trunkMat,
      crownMat: crownMat1,
      trunkOffsetY: H * 0.25,
      crownOffsetY: H * 0.5, // 树干顶部 = 树冠底部
      baseHeight: H,
      targetHeightMinM: 2,
      targetHeightMaxM: 4.2,
      radius: 0.34,
      color: '#4A8A6A',
      weight: 30,
    },
    spherical: {
      trunkGeo: new THREE.CylinderGeometry(0.04, 0.07, H * 0.45, 16),
      crownGeo: sphericalCrownGeo,
      trunkMat,
      crownMat: crownMat2,
      trunkOffsetY: H * 0.225,
      crownOffsetY: H * 0.45, // 树干顶部 = 叶片簇中心
      baseHeight: H,
      targetHeightMinM: 2,
      targetHeightMaxM: 3.9,
      radius: 0.38,
      color: '#4A8B3F',
      weight: 25,
    },
    oak: {
      trunkGeo: new THREE.CylinderGeometry(0.06, 0.1, H * 0.55, 16),
      crownGeo: oakCrownGeo,
      trunkMat,
      crownMat: crownMat3,
      trunkOffsetY: H * 0.275,
      crownOffsetY: H * 0.55, // 树干顶部 = 叶片簇中心
      baseHeight: H,
      targetHeightMinM: 2.5,
      targetHeightMaxM: 5,
      radius: 0.38,
      color: '#2D6A2D',
      weight: 20,
    },
  };

  // ─── 模型预览工厂函数（注册到 ModelRegistry） ───
  const PREVIEW_SCALE = 2.0;

  function makeConical() {
    const tm = window.TreeModels.conical;
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(tm.trunkGeo, tm.trunkMat);
    trunk.position.y = tm.trunkOffsetY;
    trunk.castShadow = true;
    trunk.receiveShadow = true;
    const crown = new THREE.Mesh(tm.crownGeo, tm.crownMat);
    crown.position.y = tm.crownOffsetY;
    crown.castShadow = true;
    crown.receiveShadow = true;
    g.add(trunk);
    g.add(crown);
    g.scale.setScalar(PREVIEW_SCALE);
    return g;
  }
  function makeSpherical() {
    const tm = window.TreeModels.spherical;
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(tm.trunkGeo, tm.trunkMat);
    trunk.position.y = tm.trunkOffsetY;
    trunk.castShadow = true;
    trunk.receiveShadow = true;
    const crown = new THREE.Mesh(tm.crownGeo, tm.crownMat);
    crown.position.y = tm.crownOffsetY;
    crown.castShadow = true;
    crown.receiveShadow = true;
    g.add(trunk);
    g.add(crown);
    g.scale.setScalar(PREVIEW_SCALE);
    return g;
  }
  function makeOak() {
    const tm = window.TreeModels.oak;
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(tm.trunkGeo, tm.trunkMat);
    trunk.position.y = tm.trunkOffsetY;
    trunk.castShadow = true;
    trunk.receiveShadow = true;
    const crown = new THREE.Mesh(tm.crownGeo, tm.crownMat);
    crown.position.y = tm.crownOffsetY;
    crown.castShadow = true;
    crown.receiveShadow = true;
    g.add(trunk);
    g.add(crown);
    g.scale.setScalar(PREVIEW_SCALE);
    return g;
  }

  window.ModelRegistry.register('trees', 'conical', makeConical);
  window.ModelRegistry.register('trees', 'spherical', makeSpherical);
  window.ModelRegistry.register('trees', 'oak', makeOak);
})();
