function poissonDiskSampling(cx, cz, halfW, halfD, minDist, safeRadius, maxPoints, excludeFn) {
  if (maxPoints <= 0) return [];
  const cellSize = minDist / Math.sqrt(2);
  const gridSizeW = Math.ceil((2 * halfW) / cellSize) + 1;
  const gridSizeD = Math.ceil((2 * halfD) / cellSize) + 1;
  const grid = new Array(gridSizeW * gridSizeD).fill(-1);
  const points = [];
  const active = [];

  function worldToGrid(x, z) {
    const gx = Math.floor((x - cx + halfW) / cellSize);
    const gz = Math.floor((z - cz + halfD) / cellSize);
    return { gx, gz };
  }
  function gridIdx(gx, gz) {
    return gz * gridSizeW + gx;
  }
  function inSafeZone(x, z) {
    return (x - cx) ** 2 + (z - cz) ** 2 < safeRadius ** 2;
  }
  function inExcluded(x, z) {
    return excludeFn ? excludeFn(x, z) : false;
  }
  function inBounds(x, z) {
    return Math.abs(x - cx) < halfW && Math.abs(z - cz) < halfD;
  }
  function isOnGrid(gx, gz) {
    return gx >= 0 && gx < gridSizeW && gz >= 0 && gz < gridSizeD;
  }
  function hasConflict(x, z, gx, gz) {
    for (let dx = -2; dx <= 2; dx++) {
      for (let dz = -2; dz <= 2; dz++) {
        const nx = gx + dx,
          nz = gz + dz;
        if (!isOnGrid(nx, nz)) continue;
        const idx = grid[gridIdx(nx, nz)];
        if (idx === -1) continue;
        const p = points[idx];
        if ((x - p.x) ** 2 + (z - p.z) ** 2 < minDist ** 2) return true;
      }
    }
    return false;
  }

  // 在矩形内随机选择一个起始点
  let first = null;
  for (let a = 0; a < 200; a++) {
    const tx = cx + (Math.random() - 0.5) * halfW * 2 * 0.8;
    const tz = cz + (Math.random() - 0.5) * halfD * 2 * 0.8;
    if (inBounds(tx, tz) && !inSafeZone(tx, tz) && !inExcluded(tx, tz)) {
      first = { x: tx, z: tz };
      break;
    }
  }
  if (!first) {
    first = { x: cx + safeRadius + minDist, z: cz };
  }

  points.push(first);
  active.push(0);
  const { gx: fgx, gz: fgz } = worldToGrid(first.x, first.z);
  grid[gridIdx(fgx, fgz)] = 0;

  while (active.length > 0 && points.length < maxPoints) {
    const ai = Math.floor(Math.random() * active.length);
    const bi = active[ai];
    const base = points[bi];
    let found = false;

    for (let k = 0; k < 30; k++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = minDist + Math.random() * minDist;
      const nx = base.x + Math.cos(angle) * dist;
      const nz = base.z + Math.sin(angle) * dist;

      if (!inBounds(nx, nz) || inSafeZone(nx, nz) || inExcluded(nx, nz)) continue;
      const { gx, gz } = worldToGrid(nx, nz);
      if (!isOnGrid(gx, gz)) continue;
      if (hasConflict(nx, nz, gx, gz)) continue;

      const np = { x: nx, z: nz };
      points.push(np);
      const ni = points.length - 1;
      active.push(ni);
      grid[gridIdx(gx, gz)] = ni;
      found = true;
      break;
    }
    if (!found) active.splice(ai, 1);
  }

  return points;
}

function updateObstacleVisibility(extraPositions) {
  const r2 = obsVisibleRadius * obsVisibleRadius;
  let bldIdx = 0;
  for (let i = 0; i < obstacleData.length; i++) {
    const o = obstacleData[i];
    if (o.type !== 'building') continue;
    let visible = false;
    const dx0 = tankState.x - o.x,
      dz0 = tankState.z - o.z;
    if (dx0 * dx0 + dz0 * dz0 < r2) visible = true;
    if (!visible && extraPositions) {
      for (const ep of extraPositions) {
        const dx = ep.x - o.x,
          dz = ep.z - o.z;
        if (dx * dx + dz * dz < r2) {
          visible = true;
          break;
        }
      }
    }
    if (o.groupRef && o.groupRef.visible !== visible) {
      o.groupRef.visible = visible;
    }
    bldIdx++;
  }
}

function disposeTreeInstance(od, isOcclusion = false) {
  if (!od.type || od.type === 'building' || od.imIndex == null) return;
  const imTrunk = od.imTrunk,
    imCrown = od.imCrown,
    idx = od.imIndex;
  const hideMat = new THREE.Matrix4().makeScale(0.001, 0.001, 0.001);
  hideMat.setPosition(0, -999, 0);
  if (imTrunk) imTrunk.setMatrixAt(idx, hideMat);
  if (imCrown) imCrown.setMatrixAt(idx, hideMat);
  if (imTrunk) imTrunk.instanceMatrix.needsUpdate = true;
  if (imCrown) imCrown.instanceMatrix.needsUpdate = true;
  if (!isOcclusion) {
    od.destroyed = true;
  } else {
    od.occluded = true;
  }
}

function updateGrassVisibility(extraPositions) {
  if (grassInstances.length === 0) return;
  const r2 = grassVisibleRadius * grassVisibleRadius;
  for (const im of grassInstances) {
    const cx = im.userData.cx,
      cz = im.userData.cz;
    let visible = false;
    const dx0 = tankState.x - cx,
      dz0 = tankState.z - cz;
    if (dx0 * dx0 + dz0 * dz0 < r2) visible = true;
    if (!visible && extraPositions) {
      for (const ep of extraPositions) {
        const dx = ep.x - cx,
          dz = ep.z - cz;
        if (dx * dx + dz * dz < r2) {
          visible = true;
          break;
        }
      }
    }
    if (im.visible !== visible) im.visible = visible;
  }
}

let _roadMat = null;

function isOnRoad(px, pz, roadAreas) {
  if (!roadAreas) return false;
  for (const a of roadAreas) {
    const dx = px - a.cx,
      dz = pz - a.cz;
    const cosA = Math.cos(-a.angle),
      sinA = Math.sin(-a.angle);
    const rx = dx * cosA - dz * sinA;
    const rz = dx * sinA + dz * cosA;
    if (Math.abs(rx) < a.rx && Math.abs(rz) < a.rz) return true;
  }
  return false;
}

function createRoadMeshes(roadSegments, targetScene) {
  cleanupRoadMeshes();
  if (!_roadMat)
    _roadMat = new THREE.MeshStandardMaterial({
      color: '#4a4a4a',
      roughness: 0.85,
      metalness: 0.05,
    });

  // 道路路面高度数据（供坦克行驶 + 桥梁/拾取物高度查询）
  window._roadSurfaceData = [];
  const ROAD_THICKNESS = 0.4;

  // 从路径点构建道路 strip（有厚度 + 重叠延伸 + 贴地 + 平滑）
  function buildRoadStrip(pts, width, material, offsetY) {
    if (!pts || pts.length < 2) return;
    const n = pts.length,
      hw = width / 2;
    // 第一遍：截面5点采样取最大值 + 偏移（防沉地）
    const rawH = [];
    for (let i = 0; i < n; i++) {
      const dx = i < n - 1 ? pts[i + 1].x - pts[i].x : pts[i].x - pts[i - 1].x;
      const dz = i < n - 1 ? pts[i + 1].z - pts[i].z : pts[i].z - pts[i - 1].z;
      const segLen = Math.hypot(dx, dz) || 1;
      const snx = -dz / segLen,
        snz = dx / segLen;
      const x = pts[i].x,
        z = pts[i].z;
      const h =
        Math.max(
          getTerrainHeight(x, z),
          getTerrainHeight(x + snx * hw, z + snz * hw),
          getTerrainHeight(x - snx * hw, z - snz * hw),
          getTerrainHeight(x + snx * hw * 0.5, z + snz * hw * 0.5),
          getTerrainHeight(x - snx * hw * 0.5, z - snz * hw * 0.5)
        ) + offsetY;
      rawH.push(h);
    }
    // 第二遍：5点移动平均平滑
    const smoothH = rawH.map((h, i) => {
      const j2 = Math.max(0, i - 2),
        j1 = Math.max(0, i - 1),
        k1 = Math.min(n - 1, i + 1),
        k2 = Math.min(n - 1, i + 2);
      return (rawH[j2] + rawH[j1] + h + rawH[k1] + rawH[k2]) / 5;
    });
    // 第三遍：构建几何体
    const topV = [],
      botV = [];
    for (let i = 0; i < n - 1; i++) {
      const dx = pts[i + 1].x - pts[i].x,
        dz = pts[i + 1].z - pts[i].z;
      const segLen = Math.hypot(dx, dz) || 1;
      const ux = dx / segLen,
        uz = dz / segLen;
      const snx = -uz,
        snz = ux;
      const ext = Math.min(1.5, segLen * 0.4);
      const x0 = pts[i].x - ux * ext,
        z0 = pts[i].z - uz * ext;
      const x1 = pts[i + 1].x + ux * ext,
        z1 = pts[i + 1].z + uz * ext;
      const th0 = smoothH[i],
        th1 = smoothH[i + 1];
      topV.push(
        x0 + snx * hw,
        th0,
        z0 + snz * hw,
        x0 - snx * hw,
        th0,
        z0 - snz * hw,
        x1 + snx * hw,
        th1,
        z1 + snz * hw,
        x1 - snx * hw,
        th1,
        z1 - snz * hw
      );
      botV.push(
        x0 + snx * hw,
        th0 - ROAD_THICKNESS,
        z0 + snz * hw,
        x0 - snx * hw,
        th0 - ROAD_THICKNESS,
        z0 - snz * hw,
        x1 + snx * hw,
        th1 - ROAD_THICKNESS,
        z1 + snz * hw,
        x1 - snx * hw,
        th1 - ROAD_THICKNESS,
        z1 - snz * hw
      );
    }
    const topIdx = [],
      botIdx = [];
    for (let i = 0; i < n - 1; i++) {
      const a = i * 4;
      topIdx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
      botIdx.push(a + 1, a + 2, a, a + 3, a + 2, a + 1);
    }
    for (let i = 0; i < n - 1; i++) {
      const a = i * 4;
      topIdx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
      botIdx.push(a + 1, a + 2, a, a + 3, a + 2, a + 1); // 底面反转
    }
    function _makeGeo(v, idx) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
      g.setIndex(idx);
      g.computeVertexNormals();
      return g;
    }
    const topGeo = _makeGeo(topV, topIdx);
    const botGeo = _makeGeo(botV, botIdx);
    const topMesh = new THREE.Mesh(topGeo, material);
    topMesh.receiveShadow = true;
    topMesh.userData.isRoad = true;
    targetScene.add(topMesh);
    _roadMeshes.push(topMesh);
    const botMesh = new THREE.Mesh(botGeo, material);
    botMesh.receiveShadow = true;
    botMesh.userData.isRoad = true;
    targetScene.add(botMesh);
    _roadMeshes.push(botMesh);
    // 存储路面高度数据（供坦克行驶查询）
    for (let i = 0; i < n; i++) {
      window._roadSurfaceData.push({ x: pts[i].x, z: pts[i].z, h: smoothH[i] });
    }
    // 存储路段数据（供 getRoadSurfaceY 点-段距离查询）
    for (let i = 0; i < n - 1; i++) {
      window._roadPathSegs.push({
        x1: pts[i].x,
        z1: pts[i].z,
        x2: pts[i + 1].x,
        z2: pts[i + 1].z,
        h1: smoothH[i],
        h2: smoothH[i + 1],
        hw: hw,
      });
    }
  }

  // 新模式：平滑路径 strip — 仅主路（村路/广场已通过 splatMap 贴图呈现）
  const roadSystem = currentMapData && currentMapData.roadSystem;
  if (roadSystem && roadSystem.mainRoad && roadSystem.mainRoad.points) {
    const mainRough = roadSystem.mainRoad.roughness || 0;
    const mainOff = Math.max(0.08, mainRough + 0.08);
    buildRoadStrip(roadSystem.mainRoad.points, roadSystem.mainRoad.width || 8.5, _roadMat, mainOff);
  }

  // 旧模式：折线段（向后兼容）
  function makeRoadMesh(x1, z1, x2, z2, width, offset, material) {
    const dx = x2 - x1,
      dz = z2 - z1;
    const len = Math.sqrt(dx * dx + dz * dz);
    if (len < 0.01) return null;
    const ux = dx / len,
      uz = dz / len;
    const px = -uz,
      pz = ux;
    const halfW = width / 2;

    const positions = new Float32Array(6 * 3);
    const tVals = [0, 0.5, 1];
    let idx = 0;
    for (let i = 0; i < 3; i++) {
      const wx = x1 + dx * tVals[i];
      const wz = z1 + dz * tVals[i];
      const h = getTerrainHeight(wx, wz) + offset;
      positions[idx++] = wx - px * halfW;
      positions[idx++] = h;
      positions[idx++] = wz - pz * halfW;
      positions[idx++] = wx + px * halfW;
      positions[idx++] = h;
      positions[idx++] = wz + pz * halfW;
    }
    const indices = [0, 2, 1, 1, 2, 3, 2, 4, 3, 3, 4, 5];
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, material);
    mesh.receiveShadow = true;
    mesh.userData.isRoad = true;
    return mesh;
  }

  // 旧模式：折线段 — 仅主路（type==='main'），村路/连接路通过 splatMap 呈现
  const _isNewMode = roadSystem && roadSystem.mainRoad && roadSystem.mainRoad.points;
  if (!_isNewMode) {
    for (const seg of roadSegments) {
      if (seg.type && seg.type !== 'main') continue;
      const mesh = makeRoadMesh(seg.x1, seg.z1, seg.x2, seg.z2, seg.width, 0.04, _roadMat);
      if (mesh) {
        targetScene.add(mesh);
        _roadMeshes.push(mesh);
      }
    }
  }

  // 广场+连接路不再生成 3D strip，由编辑器 splatMap 贴图呈现
}

function cleanupRoadMeshes() {
  for (const m of _roadMeshes) {
    if (m.parent) m.parent.remove(m);
    if (m.geometry && !m.geometry._sharedCloned) m.geometry.dispose();
  }
  _roadMeshes = [];
  window._roadSurfaceData = [];
  window._roadPathSegs = [];
}

// 查询某点是否在道路上，返回路面高度（供 getGroundHeight 调用）
// 查询某点是否在道路上，返回路面高度（供 getGroundHeight 调用）
window.getRoadSurfaceY = function (px, pz) {
  const segs = window._roadPathSegs;
  if (!segs || segs.length === 0) return null;
  let bestH = null;
  for (const seg of segs) {
    const dx = seg.x2 - seg.x1,
      dz = seg.z2 - seg.z1;
    const lenSq = dx * dx + dz * dz;
    let t, cx, cz;
    if (lenSq < 0.001) {
      t = 0;
      cx = seg.x1;
      cz = seg.z1;
    } else {
      t = ((px - seg.x1) * dx + (pz - seg.z1) * dz) / lenSq;
      t = Math.max(0, Math.min(1, t));
      cx = seg.x1 + dx * t;
      cz = seg.z1 + dz * t;
    }
    const d = Math.hypot(px - cx, pz - cz);
    if (d <= seg.hw + 0.5) {
      const h = seg.h1 + (seg.h2 - seg.h1) * t;
      if (bestH === null || h > bestH) bestH = h;
    }
  }
  return bestH;
};

function createObstacles(targetScene = scene) {
  if (window._treeIMs) {
    for (const im of window._treeIMs) {
      if (im.parent) im.parent.remove(im);
      im.geometry.dispose();
      im.material.dispose();
    }
    window._treeIMs = [];
  }
  obstacleMeshes.forEach((g) => {
    if (g.isInstancedMesh) {
      // 建筑 bld-im：移除并释放 geometry，但【不释放 material】——
      // 建筑材质是 buildings.js 的全局共享对象，释放会导致下次重建地图时材质失效（黑块/丢材质）。
      // 树 IM 由 window._treeIMs 单独清理（含 material.dispose），这里只处理 bld-im。
      if (g.name === 'bld-im') {
        if (g.parent) g.parent.remove(g);
        if (g.geometry) g.geometry.dispose();
      }
      return;
    }
    if (g.parent) g.parent.remove(g);
    g.traverse((c) => {
      if (c.geometry) c.geometry.dispose();
      if (c.material) c.material.dispose();
    });
  });
  obstacleMeshes = [];
  obstacleData = [];

  cleanupRoadMeshes();
  _villageSystem = null;

  const is02a = selectedMapId === 'test_map_02a';
  const obsCfg =
    currentMapData && currentMapData.obstacles
      ? { ...currentMapData.obstacles }
      : { count: OBSTACLE_COUNT, minDist: POISSON_MIN_DIST, safeRadius: SAFE_ZONE_RADIUS };
  const _shW = obsCfg.spawnHalfW != null ? obsCfg.spawnHalfW : spawnHalfW;
  const _shD = obsCfg.spawnHalfD != null ? obsCfg.spawnHalfD : spawnHalfD;
  const roadSystem = currentMapData && currentMapData.roadSystem;
  let _roadAreas = [];
  if (roadSystem && roadSystem.roadSegments && roadSystem.roadSegments.length > 0) {
    for (const seg of roadSystem.roadSegments) {
      const len = Math.sqrt((seg.x2 - seg.x1) ** 2 + (seg.z2 - seg.z1) ** 2);
      const angle = Math.atan2(seg.z2 - seg.z1, seg.x2 - seg.x1);
      _roadAreas.push({
        cx: (seg.x1 + seg.x2) / 2,
        cz: (seg.z1 + seg.z2) / 2,
        rx: len / 2 + 1,
        rz: seg.width / 2 + 1.5,
        angle,
      });
    }
    createRoadMeshes(roadSystem.roadSegments, targetScene);
    _villageSystem = {
      roadSegments: roadSystem.roadSegments,
      villages: roadSystem.villages || [],
      roadAreas: _roadAreas,
    };
  } else {
    _villageSystem = null;
  }

  const roadExcludeFn = _villageSystem
    ? (px, pz) => isOnRoad(px, pz, _villageSystem.roadAreas)
    : null;

  const points = poissonDiskSampling(
    0,
    0,
    _shW,
    _shD,
    obsCfg.minDist != null ? obsCfg.minDist : POISSON_MIN_DIST,
    obsCfg.safeRadius != null ? obsCfg.safeRadius : SAFE_ZONE_RADIUS,
    obsCfg.count != null ? obsCfg.count : OBSTACLE_COUNT,
    roadExcludeFn
  );

  const conePts = [],
    spherePts = [],
    oakPts = [],
    bldPts = [];
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    if (!isVersusMap) {
      const pond = _getPond();
      if (pond) {
        const pxPond = p.x - pond.cx,
          pzPond = p.z - pond.cz;
        const pondClear = pond.rx + 2.0,
          pondClearZ = pond.rz + 2.0;
        if (
          Math.sqrt(
            (pxPond * pxPond) / (pondClear * pondClear) +
              (pzPond * pzPond) / (pondClearZ * pondClearZ)
          ) < 1.0
        )
          continue;
      }
      if (isInRiver(p.x, p.z)) continue;
      const rvPts =
        currentMapData && currentMapData.terrain ? currentMapData.terrain.riverPoints : null;
      if (rvPts && rvPts.length >= 2) {
        const rvHw = (currentMapData.terrain.riverWidth || 10) * 0.5 + 2;
        let inEditRiver = false;
        for (let ri = 0; ri < rvPts.length - 1; ri++) {
          const d = pointToSegmentDist2D(
            p.x,
            p.z,
            rvPts[ri].x,
            rvPts[ri].z,
            rvPts[ri + 1].x,
            rvPts[ri + 1].z
          );
          if (d <= rvHw) {
            inEditRiver = true;
            break;
          }
        }
        if (inEditRiver) continue;
      }
      if (_villageSystem && isOnRoad(p.x, p.z, _villageSystem.roadAreas)) continue;
    }
    const r = Math.random();
    if (r < 0.35) {
      conePts.push(p);
    } else if (r < 0.65) {
      spherePts.push(p);
    } else if (r < 0.85) {
      oakPts.push(p);
    } else {
      bldPts.push({ x: p.x, z: p.z });
    }
  }

  const editorTrees = obsCfg.editorTrees || [];
  if (editorTrees.length > 0) {
    console.log('🌲 编辑器树木: ' + editorTrees.length + ' 棵（随机障碍物已关闭）');
    let skipped = 0;
    const treeBoundary = Math.max(worldHalfW, worldHalfD);
    for (const et of editorTrees) {
      if (Math.abs(et.x) > treeBoundary || Math.abs(et.z) > treeBoundary) {
        skipped++;
        continue;
      }
      const tp = { x: et.x, z: et.z };
      if (et.type === 'oak') oakPts.push(tp);
      else if (et.type === 'sphere') spherePts.push(tp);
      else conePts.push(tp);
    }
    if (skipped > 0) console.log('  ⚠️ ' + skipped + '棵超出高度图范围±150被跳过');
  }

  window._treeIMs = [];
  const dummy = new THREE.Object3D();
  // 树冠阴影 proxy：极简低面数球(20面)，castShadow 投影出树冠影子。
  // proxy 球缩小到 0.8 藏入树冠内部，靠不透明的精细树冠遮挡（主通道看不见），但阴影仍投影。
  // 不用 layers（实测 r160 下阴影相机看不到 layer1 物体），也不用 colorWrite=false（会连带跳过阴影 pass）。
  const proxyMat = new THREE.MeshBasicMaterial({ color: 0x1a3d0a }); // 深绿(树冠色)，藏树冠内被遮挡
  function makeCrownProxy(tm, count) {
    tm.crownGeo.computeBoundingSphere();
    const im = new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(tm.crownGeo.boundingSphere.radius * 0.8, 0),
      proxyMat,
      count
    );
    im.castShadow = true;
    im.receiveShadow = false;
    return im;
  }

  if (conePts.length > 0) {
    const tm = window.TreeModels.conical;
    const trunkIM = new THREE.InstancedMesh(tm.trunkGeo, tm.trunkMat, conePts.length);
    trunkIM.castShadow = true;
    trunkIM.receiveShadow = true;
    const crownIM = new THREE.InstancedMesh(tm.crownGeo, tm.crownMat, conePts.length);
    // conical 树冠是扁平三角棱柱(仅448三角/棵)，藏不住球 proxy → 直接 castShadow 投影(开销小，448×100≈4.5万阴影三角)
    crownIM.castShadow = true;
    crownIM.receiveShadow = true;

    for (let i = 0; i < conePts.length; i++) {
      const p = conePts[i];
      const baseHeightM = tm.baseHeight * METERS_PER_UNIT;
      const targetHeightM =
        tm.targetHeightMinM + Math.random() * (tm.targetHeightMaxM - tm.targetHeightMinM);
      const s = targetHeightM / baseHeightM;
      const obsY = isVersusMap ? 0 : getTerrainHeight(p.x, p.z);
      const rotY = Math.random() * Math.PI * 2;

      dummy.position.set(p.x, obsY + tm.trunkOffsetY * s, p.z);
      dummy.rotation.set(0, rotY, 0);
      dummy.scale.setScalar(s);
      dummy.updateMatrix();
      trunkIM.setMatrixAt(i, dummy.matrix);

      dummy.position.set(p.x, obsY + tm.crownOffsetY * s, p.z);
      dummy.updateMatrix();
      crownIM.setMatrixAt(i, dummy.matrix);

      obstacleData.push({
        x: p.x,
        z: p.z,
        radius: tm.radius * s,
        height: tm.baseHeight * s,
        color: tm.color,
        type: 'conical',
        imTrunk: trunkIM,
        imCrown: crownIM,
        imIndex: i,
      });
    }
    trunkIM.instanceMatrix.needsUpdate = true;
    crownIM.instanceMatrix.needsUpdate = true;
    targetScene.add(trunkIM, crownIM);
    obstacleMeshes.push(trunkIM, crownIM);
    window._treeIMs.push(trunkIM, crownIM);
  }

  if (spherePts.length > 0) {
    const tm = window.TreeModels.spherical;
    const trunkIM = new THREE.InstancedMesh(tm.trunkGeo, tm.trunkMat, spherePts.length);
    trunkIM.castShadow = true;
    trunkIM.receiveShadow = true;
    const crownIM = new THREE.InstancedMesh(tm.crownGeo, tm.crownMat, spherePts.length);
    crownIM.castShadow = false;
    crownIM.receiveShadow = true;
    const crownProxyIM = makeCrownProxy(tm, spherePts.length);

    for (let i = 0; i < spherePts.length; i++) {
      const p = spherePts[i];
      const baseHeightM = tm.baseHeight * METERS_PER_UNIT;
      const targetHeightM =
        tm.targetHeightMinM + Math.random() * (tm.targetHeightMaxM - tm.targetHeightMinM);
      const s = targetHeightM / baseHeightM;
      const obsY = isVersusMap ? 0 : getTerrainHeight(p.x, p.z);
      const rotY = Math.random() * Math.PI * 2;

      dummy.position.set(p.x, obsY + tm.trunkOffsetY * s, p.z);
      dummy.rotation.set(0, rotY, 0);
      dummy.scale.setScalar(s);
      dummy.updateMatrix();
      trunkIM.setMatrixAt(i, dummy.matrix);

      dummy.position.set(p.x, obsY + tm.crownOffsetY * s, p.z);
      dummy.updateMatrix();
      crownIM.setMatrixAt(i, dummy.matrix);
      crownProxyIM.setMatrixAt(i, dummy.matrix);

      obstacleData.push({
        x: p.x,
        z: p.z,
        radius: tm.radius * s,
        height: tm.baseHeight * s,
        color: tm.color,
        type: 'spherical',
        imTrunk: trunkIM,
        imCrown: crownIM,
        imIndex: i,
      });
    }
    trunkIM.instanceMatrix.needsUpdate = true;
    crownIM.instanceMatrix.needsUpdate = true;
    crownProxyIM.instanceMatrix.needsUpdate = true;
    targetScene.add(trunkIM, crownIM, crownProxyIM);
    obstacleMeshes.push(trunkIM, crownIM);
    window._treeIMs.push(trunkIM, crownIM, crownProxyIM);
  }

  if (oakPts.length > 0) {
    const tm = window.TreeModels.oak;
    const trunkIM = new THREE.InstancedMesh(tm.trunkGeo, tm.trunkMat, oakPts.length);
    trunkIM.castShadow = true;
    trunkIM.receiveShadow = true;
    const crownIM = new THREE.InstancedMesh(tm.crownGeo, tm.crownMat, oakPts.length);
    crownIM.castShadow = false;
    crownIM.receiveShadow = true;
    const crownProxyIM = makeCrownProxy(tm, oakPts.length);

    for (let i = 0; i < oakPts.length; i++) {
      const p = oakPts[i];
      const baseHeightM = tm.baseHeight * METERS_PER_UNIT;
      const targetHeightM =
        tm.targetHeightMinM + Math.random() * (tm.targetHeightMaxM - tm.targetHeightMinM);
      const s = targetHeightM / baseHeightM;
      const obsY = isVersusMap ? 0 : getTerrainHeight(p.x, p.z);
      const rotY = Math.random() * Math.PI * 2;

      dummy.position.set(p.x, obsY + tm.trunkOffsetY * s, p.z);
      dummy.rotation.set(0, rotY, 0);
      dummy.scale.setScalar(s);
      dummy.updateMatrix();
      trunkIM.setMatrixAt(i, dummy.matrix);

      dummy.position.set(p.x, obsY + tm.crownOffsetY * s, p.z);
      dummy.updateMatrix();
      crownIM.setMatrixAt(i, dummy.matrix);
      crownProxyIM.setMatrixAt(i, dummy.matrix);

      obstacleData.push({
        x: p.x,
        z: p.z,
        radius: tm.radius * s,
        height: tm.baseHeight * s,
        color: tm.color,
        type: 'oak',
        imTrunk: trunkIM,
        imCrown: crownIM,
        imIndex: i,
      });
    }
    trunkIM.instanceMatrix.needsUpdate = true;
    crownIM.instanceMatrix.needsUpdate = true;
    crownProxyIM.instanceMatrix.needsUpdate = true;
    targetScene.add(trunkIM, crownIM, crownProxyIM);
    obstacleMeshes.push(trunkIM, crownIM);
    window._treeIMs.push(trunkIM, crownIM, crownProxyIM);
  }

  let bldIdx = 0;
  const cfgBuildings = obsCfg.buildings || [];
  const villageBlds =
    _villageSystem && _villageSystem.villages
      ? _villageSystem.villages.flatMap((v) => v.buildings || [])
      : [];
  const allBlds = cfgBuildings.length > 0 ? cfgBuildings : villageBlds;

  const randomBlds =
    (!cfgBuildings || cfgBuildings.length === 0) && (!villageBlds || villageBlds.length === 0)
      ? bldPts
      : [];
  const effectiveBlds = allBlds.length > 0 ? allBlds : randomBlds;

  if (effectiveBlds.length > 0) {
    const bldBoundary =
      cfgBuildings.length > 0 ? Math.max(worldHalfW, worldHalfD) : Math.min(_shW, _shD) * 0.92;
    const tempBldGroups = [];
    for (const bld of effectiveBlds) {
      if (Math.abs(bld.x) > bldBoundary || Math.abs(bld.z) > bldBoundary) continue;
      if (!isVersusMap) {
        if (isInRiver(bld.x, bld.z)) continue;
        const pond = _getPond();
        if (pond) {
          const pxPond = bld.x - pond.cx,
            pzPond = bld.z - pond.cz;
          if (
            Math.sqrt(
              (pxPond * pxPond) / (pond.rx + 3) ** 2 + (pzPond * pzPond) / (pond.rz + 3) ** 2
            ) < 1.0
          )
            continue;
        }
      }
      let tooCloseToSpawn = false;
      const spawns =
        currentMapData && Array.isArray(currentMapData.spawnPoints)
          ? currentMapData.spawnPoints
          : [];
      for (const sp of spawns) {
        if ((bld.x - sp.x) ** 2 + (bld.z - sp.z) ** 2 < SAFE_ZONE_RADIUS ** 2) {
          tooCloseToSpawn = true;
          break;
        }
      }
      if (!spawns.length && bld.x * bld.x + bld.z * bld.z < SAFE_ZONE_RADIUS ** 2)
        tooCloseToSpawn = true;
      if (tooCloseToSpawn) continue;

      const makeFn = window.ModelRegistry.randomBuildingMaker();
      const group = makeFn();
      const ud = group.userData;
      const baseHeightM = ud.height * METERS_PER_UNIT;
      const targetHeightM =
        ud.targetHeightMinM + Math.random() * (ud.targetHeightMaxM - ud.targetHeightMinM);
      const s = targetHeightM / baseHeightM;
      group.scale.setScalar(s);
      const obsY = getTerrainHeight(bld.x, bld.z);
      group.position.set(bld.x, obsY, bld.z);
      group.rotation.y = (bld.angle || 0) + (Math.random() - 0.5) * 0.2;
      group.visible = false;
      group.name = `bld-${bldIdx++}`;
      tempBldGroups.push({ group, bld, ud, s, obsY });
    }
    // ── 按建筑类型分组，InstancedMesh 批量渲染 ──
    if (tempBldGroups.length > 0) {
      const typeKey = (g) => g.ud.targetHeightMinM + '|' + g.ud.targetHeightMaxM;
      const typeMap = new Map();
      for (const item of tempBldGroups) {
        const key = typeKey(item);
        if (!typeMap.has(key)) typeMap.set(key, []);
        typeMap.get(key).push(item);
      }
      for (const [_, items] of typeMap) {
        const template = items[0].group;
        const matTemplates = [];
        template.traverse((c) => {
          if (!c.isMesh || !c.geometry) return;
          c.updateMatrix();
          matTemplates.push({
            material: c.material,
            localMatrix: c.matrix.clone(),
            geometry: c.geometry,
          });
        });
        // 每种材质：合并模板几何 → InstancedMesh
        // ⚠️ 按 material 对象去重：matTemplates 含同材质的多个子 mesh（一栋建筑有多扇窗/多根栏杆），
        //    不去重会为同一材质重复建 IM（修复前实测 141 个 bld-im，窗户材质被建 56 次）。
        //    前提：buildings.js 的材质已全局化，同 category 建筑共享同一组 material 对象。
        const ims = [];
        const seenMat = new Set();
        for (const mt of matTemplates) {
          if (seenMat.has(mt.material)) continue;
          seenMat.add(mt.material);
          const templateGeosMerged = [];
          // 合并该材质在模板中的所有子mesh几何体（应用局部矩阵）
          for (const mt2 of matTemplates) {
            if (mt2.material !== mt.material) continue;
            const g = mt2.geometry.clone();
            g.applyMatrix4(mt2.localMatrix);
            templateGeosMerged.push(g);
          }
          if (templateGeosMerged.length === 0) continue;
          const mergedTemplateGeo = THREE.BufferGeometryUtils.mergeBufferGeometries(
            templateGeosMerged,
            false
          );
          if (!mergedTemplateGeo) continue;
          const im = new THREE.InstancedMesh(mergedTemplateGeo, mt.material, items.length);
          im.castShadow = true;
          im.receiveShadow = true;
          im.name = 'bld-im';
          targetScene.add(im);
          obstacleMeshes.push(im);
          ims.push(im);
        }
        // 填充实例矩阵
        const dummy = new THREE.Object3D();
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          const g = item.group;
          g.updateMatrix();
          // 复合矩阵：buildingWorld × templateLocal（已在合并几何体中烘焙）
          dummy.position.set(0, 0, 0);
          dummy.rotation.set(0, 0, 0);
          dummy.scale.set(1, 1, 1);
          dummy.applyMatrix4(g.matrix);
          for (const im of ims) {
            im.setMatrixAt(i, dummy.matrix);
          }
          obstacleData.push({
            x: item.bld.x,
            z: item.bld.z,
            radius: item.ud.radius * item.s,
            height: item.ud.height * item.s,
            color: item.ud.color,
            blades: item.ud.blades || null,
            type: 'building',
            groupRef: null,
            imBuilding: ims,
            imIndex: i,
          });
        }
        for (const im of ims) {
          im.instanceMatrix.needsUpdate = true;
        }
        // 清理临时 Group
        for (const item of items) {
          item.group.traverse((c) => {
            if (c.isMesh) {
              c.geometry = null;
              c.material = null;
            }
          });
        }
      }
    }
  }

  const totalTrees = conePts.length + spherePts.length + oakPts.length;

  if (window._obstacleGrid) {
    window._obstacleGrid.clear();
  } else {
    window._obstacleGrid = new SpatialGrid(10);
  }
  window._obstacleGrid.insertAll(obstacleData);

  updateObstacleVisibility();
  updateGrassVisibility();
}
