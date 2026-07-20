// 法国梧桐 (Platanus × acerifolia) — 精细程序化模型
// 树高 9-12m，宽穹顶树冠 + 枝条 + 悬挂种子球
// 几何体在 Y=0 构建（原点=树干顶部），由 IM 的 offsetY 放置到正确位置
(function () {
  var H = 1.0;

  // ═══ 材质 ═══
  var trunkMat = new THREE.MeshStandardMaterial({
    color: 0x8b7355,
    roughness: 0.85,
  });
  var crownMat = new THREE.MeshStandardMaterial({
    color: 0x3d6b3d,
    roughness: 0.75,
  });
  var seedMat = new THREE.MeshStandardMaterial({
    color: 0x5a3a1e,
    roughness: 0.9,
  });
  var branchMat = new THREE.MeshStandardMaterial({
    color: 0x6b5a45,
    roughness: 0.8,
  });

  var TRUNK_H = H * 0.52; // 树干高度

  // ═══ 树干几何（带树皮纹理噪声）═══
  function createTrunkGeo() {
    var geo = new THREE.CylinderGeometry(0.04, 0.07, TRUNK_H, 14, 4);
    var pos = geo.attributes.position;
    for (var i = 0; i < pos.count; i++) {
      var x = pos.getX(i),
        y = pos.getY(i),
        z = pos.getZ(i);
      if (y > -TRUNK_H / 2 + 0.05) {
        var angle = Math.atan2(z, x);
        var noise = Math.sin(angle * 6 + y * 12) * 0.008 + Math.sin(angle * 11 - y * 7) * 0.005;
        var dist = Math.sqrt(x * x + z * z);
        if (dist > 0.001) {
          pos.setXYZ(i, x + (x / dist) * noise, y, z + (z / dist) * noise);
        }
      }
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
    return geo;
  }

  // ═══ 枝条组件（辐射排列的主枝 + 二级枝，Y=0=树干顶部）═══
  function createBranchAssembly() {
    var geos = [];
    var numMain = 5;
    var branchLen = 0.35;
    var baseR = 0.03,
      tipR = 0.01;
    var tiltAngle = 0.35;

    for (var i = 0; i < numMain; i++) {
      var azimuth = (i / numMain) * Math.PI * 2 + 0.25;
      var bGeo = new THREE.CylinderGeometry(tipR, baseR, branchLen, 8, 2);
      var dummy = new THREE.Object3D();
      dummy.rotation.set(0, azimuth, tiltAngle);
      // 起点在 Y=0（树干顶部），向外上方辐射
      dummy.position.set(0, 0, 0);
      dummy.updateMatrix();
      bGeo.applyMatrix4(dummy.matrix);
      geos.push(bGeo);

      // 二级枝
      var subLen = branchLen * 0.5;
      var subGeo = new THREE.CylinderGeometry(0.005, 0.015, subLen, 6);
      var subDummy = new THREE.Object3D();
      var midDist = branchLen * 0.5;
      var midX = Math.cos(azimuth) * Math.cos(tiltAngle) * midDist;
      var midY = Math.sin(tiltAngle) * midDist;
      var midZ = Math.sin(azimuth) * Math.cos(tiltAngle) * midDist;
      subDummy.position.set(midX, midY, midZ);
      subDummy.rotation.set(0, azimuth + 0.4, tiltAngle + 0.5);
      subDummy.updateMatrix();
      subGeo.applyMatrix4(subDummy.matrix);
      geos.push(subGeo);
    }
    return THREE.BufferGeometryUtils.mergeBufferGeometries(geos);
  }

  // ═══ 树冠几何（60+ 椭球，宽穹顶分布，Y=0=树干顶部）═══
  function createCrownGeo() {
    var geos = [];
    // 树冠 Y 范围: -0.2~+0.25（相对于树干顶部）
    var crownR = 0.42;

    var layers = [
      { yOff: 0.2, r: 0.08, n: 5, erMin: 0.06, erMax: 0.1, flat: 0.8 }, // 顶部
      { yOff: 0.12, r: 0.18, n: 10, erMin: 0.07, erMax: 0.12, flat: 0.72 }, // 上穹
      { yOff: 0.02, r: 0.3, n: 16, erMin: 0.08, erMax: 0.13, flat: 0.65 }, // 中层
      { yOff: -0.07, r: 0.36, n: 16, erMin: 0.07, erMax: 0.11, flat: 0.6 }, // 中下
      { yOff: -0.15, r: 0.4, n: 14, erMin: 0.05, erMax: 0.09, flat: 0.55 }, // 边缘
    ];

    for (var li = 0; li < layers.length; li++) {
      var lyr = layers[li];
      for (var i = 0; i < lyr.n; i++) {
        var angle = (i / lyr.n) * Math.PI * 2 + li * 0.25;
        var dist = lyr.r * (0.7 + Math.random() * 0.3);
        var x = Math.cos(angle) * dist;
        var z = Math.sin(angle) * dist;
        var y = lyr.yOff + (Math.random() - 0.5) * 0.05;
        var er = lyr.erMin + Math.random() * (lyr.erMax - lyr.erMin);
        var sGeo = new THREE.SphereGeometry(er, 8, 5);
        var sPos = sGeo.attributes.position;
        for (var vi = 0; vi < sPos.count; vi++) sPos.array[vi * 3 + 1] *= lyr.flat;
        sPos.needsUpdate = true;
        sGeo.computeVertexNormals();
        sGeo.translate(x, y, z);
        geos.push(sGeo);
      }
    }

    // 随机填充
    for (var fi = 0; fi < 12; fi++) {
      var a2 = Math.random() * Math.PI * 2;
      var d2 = crownR * (0.1 + Math.random() * 0.85);
      var y2 = (Math.random() - 0.45) * 0.38;
      var er2 = 0.05 + Math.random() * 0.07;
      var g2 = new THREE.SphereGeometry(er2, 8, 5);
      var p2 = g2.attributes.position;
      var ff = 0.55 + Math.random() * 0.25;
      for (var vj = 0; vj < p2.count; vj++) p2.array[vj * 3 + 1] *= ff;
      p2.needsUpdate = true;
      g2.computeVertexNormals();
      g2.translate(Math.cos(a2) * d2, y2, Math.sin(a2) * d2);
      geos.push(g2);
    }

    return THREE.BufferGeometryUtils.mergeBufferGeometries(geos);
  }

  // ═══ 种子球（3-5对悬挂小球，Y=0=树干顶部）═══
  function createSeedGeo() {
    var geos = [];
    var numPairs = 3 + Math.floor(Math.random() * 3);
    var crownR = 0.35;

    for (var i = 0; i < numPairs; i++) {
      var angle = (i / numPairs) * Math.PI * 2 + Math.random() * 0.5;
      var dist = crownR * (0.3 + Math.random() * 0.6);
      var x = Math.cos(angle) * dist;
      var z = Math.sin(angle) * dist;
      var stalkTop = -0.06 - Math.random() * 0.14; // 悬挂起始（树冠下方）

      // 细柄
      var stalkLen = 0.18 + Math.random() * 0.2;
      var stalkGeo = new THREE.CylinderGeometry(0.004, 0.004, stalkLen, 6);
      stalkGeo.translate(x, stalkTop - stalkLen / 2, z);
      geos.push(stalkGeo);

      // 横叉
      var forkY = stalkTop - stalkLen;
      var forkGeo = new THREE.CylinderGeometry(0.005, 0.005, 0.07, 6);
      forkGeo.rotateZ(Math.PI / 2);
      forkGeo.translate(x, forkY, z);
      geos.push(forkGeo);

      // 两粒种子球
      var seedOff = 0.04;
      for (var si = 0; si < 2; si++) {
        var sx = x + (si === 0 ? -seedOff : seedOff);
        var sGeo = new THREE.SphereGeometry(0.04, 6, 5);
        var sp = sGeo.attributes.position;
        for (var vj = 0; vj < sp.count; vj++) sp.array[vj * 3 + 1] *= 0.8;
        sp.needsUpdate = true;
        sGeo.computeVertexNormals();
        sGeo.translate(sx, forkY - 0.01, z);
        geos.push(sGeo);
      }
    }
    return THREE.BufferGeometryUtils.mergeBufferGeometries(geos);
  }

  // ═══ 构建 + 注册 ═══
  var trunkGeo = createTrunkGeo();
  var branchGeo = createBranchAssembly();
  var crownGeo = createCrownGeo();
  var seedGeo = createSeedGeo();
  var detailGeo = THREE.BufferGeometryUtils.mergeBufferGeometries([branchGeo, seedGeo]);

  window.TreeModels = window.TreeModels || {};
  window.TreeModels.plane = {
    trunkGeo: trunkGeo,
    crownGeo: crownGeo,
    detailGeo: detailGeo,
    trunkMat: trunkMat,
    crownMat: crownMat,
    detailMat: branchMat,
    trunkOffsetY: TRUNK_H * 0.5, // 树干中心 = 树干半高（底部贴地）
    crownOffsetY: TRUNK_H, // 树冠原点 = 树干顶部
    detailOffsetY: TRUNK_H, // 细节原点 = 树干顶部
    baseHeight: H,
    targetHeightMinM: 9,
    targetHeightMaxM: 12,
    radius: 0.42,
    color: '#3d6b3d',
    weight: 0,
  };

  // ModelRegistry 注册
  if (window.ModelRegistry && window.ModelRegistry.register) {
    window.ModelRegistry.register(
      'trees',
      'plane',
      function makePlane() {
        var tm = window.TreeModels.plane;
        var g = new THREE.Group();
        var trunk = new THREE.Mesh(tm.trunkGeo, tm.trunkMat);
        trunk.position.y = tm.trunkOffsetY;
        trunk.castShadow = true;
        trunk.receiveShadow = true;
        var crown = new THREE.Mesh(tm.crownGeo, tm.crownMat);
        crown.position.y = tm.crownOffsetY;
        crown.castShadow = true;
        crown.receiveShadow = true;
        var detail = new THREE.Mesh(tm.detailGeo, tm.detailMat);
        detail.position.y = tm.detailOffsetY;
        detail.castShadow = true;
        detail.receiveShadow = true;
        g.add(trunk);
        g.add(crown);
        g.add(detail);
        g.scale.setScalar(2.0);
        return g;
      },
      0
    );
  }
})();
