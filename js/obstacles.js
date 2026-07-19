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
    imProxy = od.imProxy,
    idx = od.imIndex;
  const hideMat = new THREE.Matrix4().makeScale(0.001, 0.001, 0.001);
  hideMat.setPosition(0, -999, 0);
  if (imTrunk) imTrunk.setMatrixAt(idx, hideMat);
  if (imCrown) imCrown.setMatrixAt(idx, hideMat);
  if (imProxy) imProxy.setMatrixAt(idx, hideMat);
  if (imTrunk) imTrunk.instanceMatrix.needsUpdate = true;
  if (imCrown) imCrown.instanceMatrix.needsUpdate = true;
  if (imProxy) imProxy.instanceMatrix.needsUpdate = true;
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

// ── 校园 footprint 建筑(真实多边形拉伸) + 操场着色 — v0.67 ──
// footprint [[x,z]...] 是地面多边形; Shape 用 (x, -z) 因为 ExtrudeGeometry 沿+Z拉伸后
// rotation.x=-π/2 会使 shape.y → world.−z, 取反才能让 world.z == footprint.z(与碰撞坐标同步)
function _footprintToShape(fp, flipZ) {
  const s = new THREE.Shape();
  s.moveTo(fp[0][0], flipZ ? -fp[0][1] : fp[0][1]);
  for (let i = 1; i < fp.length; i++) s.lineTo(fp[i][0], flipZ ? -fp[i][1] : fp[i][1]);
  s.closePath();
  return s;
}

function createFootprintBuildings(targetScene, fps) {
  var M = window.CampusMaterials;
  if (!M || !THREE.ExtrudeGeometry) return;
  window._campusBuildings = [];
  // B7 双栋参数(数据驱动, fallback 硬编码) — 来自 obstacles.b7_buildings
  var _campusB7Buildings =
    currentMapData && currentMapData.obstacles && currentMapData.obstacles.b7_buildings
      ? currentMapData.obstacles.b7_buildings
      : null;
  // 共享几何体(所有建筑共用, 通过scale差异化)
  var balusterGeo = null,
    railGeo = null,
    acGeo = null;
  var getBalusterGeo = function () {
    if (balusterGeo) return balusterGeo;
    balusterGeo = new THREE.CylinderGeometry(0.06, 0.06, 1.0, 6);
    return balusterGeo;
  };
  var getRailGeo = function () {
    if (railGeo) return railGeo;
    railGeo = new THREE.BoxGeometry(1.0, 0.06, 0.08);
    return railGeo;
  };
  // 按 footprint 点索引取边(端点+长度+中点), 不依赖 edges 数组下标(防中间退化边偏移)
  var edgeByFootprintIdx = function (footprint, ei) {
    var n = footprint.length;
    if (ei < 0 || ei >= n) return null;
    var ax = footprint[ei][0],
      az = footprint[ei][1];
    var bx = footprint[(ei + 1) % n][0],
      bz = footprint[(ei + 1) % n][1];
    var dx = bx - ax,
      dz = bz - az;
    var len = Math.sqrt(dx * dx + dz * dz);
    if (len < 1) return null;
    return { ax: ax, az: az, bx: bx, bz: bz, len: len, mx: (ax + bx) / 2, mz: (az + bz) / 2 };
  };
  // 点到线段 2D 距离
  var _pointSegDist2D = function (px, pz, ax, az, bx, bz) {
    var dx = bx - ax,
      dz = bz - az;
    var l2 = dx * dx + dz * dz;
    var t = l2 > 0 ? ((px - ax) * dx + (pz - az) * dz) / l2 : 0;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (ax + dx * t), pz - (az + dz * t));
  };
  // 该边贴上的天桥: {yRange(局部Y), segRange(连接子段参数[t1,t2])}
  var edgeBridgeOverlaps = function (edge, bridges, stiltY) {
    var out = [];
    if (!bridges || !bridges.length) return out;
    var ux = (edge.bx - edge.ax) / edge.len;
    var uz = (edge.bz - edge.az) / edge.len;
    for (var bi = 0; bi < bridges.length; bi++) {
      var br = bridges[bi];
      var fp = br.footprint;
      if (!fp || fp.length < 2) continue;
      var fy = br.floorY || 6,
        th = br.thickness || 3;
      var yRange = [fy - stiltY, fy + th - stiltY];
      var minDist = Infinity;
      var segLo = 1,
        segHi = 0; // 连接子段(参数区间)
      for (var i = 0; i < fp.length; i++) {
        var ca = fp[i],
          cb = fp[(i + 1) % fp.length];
        var cdx = cb[0] - ca[0],
          cdz = cb[1] - ca[1];
        var cLen = Math.hypot(cdx, cdz);
        if (cLen < 0.1) continue;
        var cux = cdx / cLen,
          cuz = cdz / cLen;
        var dot = cux * ux + cuz * uz;
        // 共线: 方向平行(|dot|≈1) + 距离<0.3
        if (Math.abs(Math.abs(dot) - 1) < 0.005) {
          var d1 = Math.abs((ca[0] - edge.ax) * uz - (ca[1] - edge.az) * ux);
          if (d1 < 0.3) {
            var ta = ((ca[0] - edge.ax) * ux + (ca[1] - edge.az) * uz) / edge.len;
            var tb = ((cb[0] - edge.ax) * ux + (cb[1] - edge.az) * uz) / edge.len;
            if (dot < 0) {
              var tmp = ta;
              ta = tb;
              tb = tmp;
            }
            var lo = Math.max(0, Math.min(ta, tb));
            var hi = Math.min(1, Math.max(ta, tb));
            if (hi > lo) {
              segLo = Math.min(segLo, lo);
              segHi = Math.max(segHi, hi);
            }
          }
        }
        for (var t = 0; t <= 1.0001; t += 0.25) {
          var px = edge.ax + (edge.bx - edge.ax) * t;
          var pz = edge.az + (edge.bz - edge.az) * t;
          var dd = _pointSegDist2D(px, pz, ca[0], ca[1], cb[0], cb[1]);
          if (dd < minDist) minDist = dd;
        }
      }
      // 只有真共线连接段才裁(天桥沿该边占子段); 贴但不沿(如天桥连短边, 长边只是端点近)不裁
      if (minDist < 0.8 && segHi > segLo) {
        out.push({ yRange: yRange, segRange: [segLo, segHi] });
      }
    }
    return out;
  };
  var getACGeo = function () {
    if (acGeo) return acGeo;
    acGeo = new THREE.BoxGeometry(1.0, 0.7, 0.4);
    return acGeo;
  };
  // bldGroup坐标系: rotation.x=-PI/2 → localX=worldX, localY=-worldZ, localZ=worldY(高度)
  // 沿建筑某条边添加外廊栏杆+楼层挑板(多楼层)
  var addCorridorToEdge = function (parent, ax, az, bx, bz, wallH, skipSegs) {
    var dx = bx - ax,
      dz = bz - az;
    var edgeLen = Math.sqrt(dx * dx + dz * dz);
    if (edgeLen < 2) return;
    var ux = dx / edgeLen,
      uz = dz / edgeLen;
    var nx = -uz,
      nz = ux;
    var ldx = dx,
      ldz = -dz;
    var edgeAngle = Math.atan2(ldz, ldx);
    var floorH = 3.0,
      railH = 1.05,
      spacer = 0.55;
    var nBalusters = Math.max(2, Math.floor(edgeLen / spacer));
    var geoB = getBalusterGeo(),
      geoR = getRailGeo(),
      railMat = M.railing;
    for (var fl = 1; fl < Math.floor(wallH / floorH); fl++) {
      var floorY = fl * floorH;
      var yCenter = floorY + floorH / 2;
      // 该层是否在天桥层 + 连接子段
      var seg = null;
      for (var si = 0; si < (skipSegs || []).length; si++) {
        var ss = skipSegs[si];
        if (yCenter >= ss.yRange[0] && yCenter < ss.yRange[1]) {
          seg = ss.segRange;
          break;
        }
      }
      // 栏杆柱
      var railOff = 0.78;
      for (var bi = 0; bi <= nBalusters; bi++) {
        var t = bi / nBalusters;
        if (seg && t >= seg[0] && t <= seg[1]) continue; // 连接段跳过柱子
        var lx = ax + dx * t + nx * railOff;
        var ly = -(az + dz * t + nz * railOff);
        var col = new THREE.Mesh(geoB, railMat);
        col.position.set(lx, ly, floorY + railH / 2);
        col.scale.set(1, railH, 1);
        col.rotation.x = -Math.PI / 2;
        col.castShadow = true;
        col.name = 'campus-detail';
        parent.add(col);
      }
      // 横杆/挑板分段: seg 时画 [0,t1]+[t2,1], 否则 [0,1]
      var segs = seg
        ? [
            [0, seg[0]],
            [seg[1], 1],
          ]
        : [[0, 1]];
      for (var sgi = 0; sgi < segs.length; sgi++) {
        var s0 = segs[sgi][0],
          s1 = segs[sgi][1];
        if (s1 - s0 < 0.02) continue;
        var segLen = edgeLen * (s1 - s0);
        var segMid = (s0 + s1) / 2;
        var tlx = ax + dx * segMid + nx * railOff;
        var tly = -(az + dz * segMid + nz * railOff);
        var topRail = new THREE.Mesh(geoR, railMat);
        topRail.position.set(tlx, tly, floorY + railH);
        topRail.scale.set(segLen, 1, 1);
        topRail.rotation.z = edgeAngle;
        topRail.castShadow = true;
        topRail.name = 'campus-detail';
        parent.add(topRail);
        var midRail = new THREE.Mesh(geoR, railMat);
        midRail.position.set(tlx, tly, floorY + railH * 0.55);
        midRail.scale.set(segLen, 1, 1);
        midRail.rotation.z = edgeAngle;
        midRail.castShadow = true;
        midRail.name = 'campus-detail';
        parent.add(midRail);
        var slab = new THREE.Mesh(
          new THREE.BoxGeometry(segLen, 0.85, 0.1),
          new THREE.MeshStandardMaterial({ color: '#c8c4bc', roughness: 0.7 })
        );
        slab.position.set(
          ax + dx * segMid + nx * 0.4,
          -(az + dz * segMid + nz * 0.4),
          floorY + 0.05
        );
        slab.rotation.z = edgeAngle;
        slab.castShadow = true;
        slab.receiveShadow = true;
        slab.name = 'campus-detail';
        parent.add(slab);

        // 侧墙(两端封闭): 非顶层 floor→railH高, 顶层 floor→wallH(天花板)
        var nFloors = Math.floor(wallH / floorH);
        var isTopFloor = fl === nFloors - 1;
        var sideH = isTopFloor ? wallH - floorY : railH;
        if (sideH > 0.05) {
          var sideGeo = new THREE.BoxGeometry(0.06, railOff, sideH);
          var sideMat = new THREE.MeshStandardMaterial({ color: '#c8c4bc', roughness: 0.7 });
          // 段起点侧墙
          var sw0 = new THREE.Mesh(sideGeo, sideMat);
          sw0.position.set(
            ax + dx * s0 + nx * (railOff / 2),
            -(az + dz * s0 + nz * (railOff / 2)),
            floorY + sideH / 2
          );
          sw0.rotation.z = edgeAngle;
          sw0.castShadow = true;
          sw0.name = 'campus-detail';
          parent.add(sw0);
          // 段终点侧墙
          var sw1 = new THREE.Mesh(sideGeo, sideMat);
          sw1.position.set(
            ax + dx * s1 + nx * (railOff / 2),
            -(az + dz * s1 + nz * (railOff / 2)),
            floorY + sideH / 2
          );
          sw1.rotation.z = edgeAngle;
          sw1.castShadow = true;
          sw1.name = 'campus-detail';
          parent.add(sw1);
        }

        // 顶层天花板(与建筑屋顶齐平)
        if (isTopFloor) {
          var ceilMat = new THREE.MeshStandardMaterial({ color: '#e8e4dc', roughness: 0.65 });
          var ceilGeo = new THREE.BoxGeometry(segLen, railOff, 0.06);
          var ceilPanel = new THREE.Mesh(ceilGeo, ceilMat);
          ceilPanel.position.set(
            ax + dx * segMid + nx * (railOff / 2),
            -(az + dz * segMid + nz * (railOff / 2)),
            wallH - 0.03
          );
          ceilPanel.rotation.z = edgeAngle;
          ceilPanel.castShadow = true;
          ceilPanel.name = 'campus-detail';
          parent.add(ceilPanel);
        }
      }
    }
  };
  // 沿北面墙添加空调外机
  var addACToEdge = function (parent, ax, az, bx, bz, wallH, skipSegs, forceY, winRanges) {
    var dx = bx - ax,
      dz = bz - az;
    var edgeLen = Math.sqrt(dx * dx + dz * dz);
    if (edgeLen < 4) return;
    var nx = -(dz / edgeLen),
      nz = dx / edgeLen;
    var ldx = dx,
      ldz = -dz;
    var edgeAngle = Math.atan2(ldz, ldx);
    var floorH = 3.0,
      spacing = 5.0;
    var nUnits = Math.max(1, Math.floor(edgeLen / spacing));
    var acGeoG = getACGeo();
    var acMat = new THREE.MeshStandardMaterial({
      color: '#c8c4be',
      roughness: 0.55,
      metalness: 0.35,
    });
    var _flr = forceY != null ? [forceY] : null;
    var _nFl = _flr ? _flr.length : Math.floor(wallH / floorH);
    // 空调位: 有窗时放教室交界(窗间墙), 无窗时均布
    var _acPositions = [];
    if (winRanges && winRanges.length) {
      // 第一间教室之前的墙
      if (winRanges[0].t0 > 0.05) _acPositions.push(winRanges[0].t0 / 2);
      // 教室之间的墙
      for (var _gi = 0; _gi < winRanges.length - 1; _gi++) {
        _acPositions.push((winRanges[_gi].t1 + winRanges[_gi + 1].t0) / 2);
      }
      // 最后一间教室之后的墙
      var _lastWr = winRanges[winRanges.length - 1];
      if (_lastWr.t1 < 0.95) _acPositions.push((_lastWr.t1 + 1) / 2);
    } else {
      var _nUnits = Math.max(1, Math.floor(edgeLen / spacing));
      for (var _ai2 = 0; _ai2 < _nUnits; _ai2++) _acPositions.push((_ai2 + 0.5) / _nUnits);
    }
    for (var fl = 0; fl < _nFl; fl++) {
      var floorY = _flr ? _flr[fl] : fl * floorH + 1.0;
      var seg = null;
      if (!_flr) {
        var yCenter = fl * floorH + floorH / 2;
        for (var si = 0; si < (skipSegs || []).length; si++) {
          var ss = skipSegs[si];
          if (yCenter >= ss.yRange[0] && yCenter < ss.yRange[1]) {
            seg = ss.segRange;
            break;
          }
        }
      }
      for (var ai = 0; ai < _acPositions.length; ai++) {
        var t = _acPositions[ai];
        if (seg && t >= seg[0] && t <= seg[1]) continue; // 连接段跳过空调
        var lx = ax + dx * t + nx * 0.45;
        var ly = -(az + dz * t + nz * 0.45);
        var ac = new THREE.Mesh(acGeoG, acMat);
        ac.position.set(lx, ly, floorY + 0.35);
        ac.rotation.z = edgeAngle;
        ac.castShadow = true;
        ac.name = 'campus-detail';
        parent.add(ac);
        var br = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.3, 0.5), acMat);
        br.position.set(ax + dx * t + nx * 0.2, -(az + dz * t + nz * 0.2), floorY - 0.05);
        br.castShadow = true;
        br.name = 'campus-detail';
        parent.add(br);
      }
    }
  };

  // 计算一条边上所有教室窗户的 t 范围(供 addDoorsAndWindows 和 addACToEdge 避让共用)
  var computeWindowRanges = function (edgeLen, _nr) {
    var cw = 8; // 标准教室宽度
    var nClassrooms = _nr || Math.max(1, Math.round(edgeLen / cw));
    var crw = edgeLen / nClassrooms; // 实际教室宽度
    var ranges = [];
    for (var ci = 0; ci < nClassrooms; ci++) {
      var c0 = ci * crw,
        c1 = (ci + 1) * crw;
      // 窗: 教室两端各留 1.5u (0.4墙 + 0.7门 + 0.4墙)
      var w0 = (c0 + 1.5) / edgeLen;
      var w1 = (c1 - 1.5) / edgeLen;
      if (w1 - w0 > 0.05) ranges.push({ t0: w0, t1: w1 });
    }
    return ranges;
  };

  // 沿建筑边添加门窗户(贴面薄Box)
  // type='corridor': 前门+窗户(多扇)+后门; type='ac': 仅窗户(与走廊面对称)
  var addDoorsAndWindows = function (
    parent,
    ax,
    az,
    bx,
    bz,
    wallH,
    type,
    skipSegs,
    _stiltY,
    _nRooms,
    _singleDoor
  ) {
    var dx = bx - ax,
      dz = bz - az;
    var edgeLen = Math.sqrt(dx * dx + dz * dz);
    if (edgeLen < 4) return;
    var ux = dx / edgeLen,
      uz = dz / edgeLen;
    var nx = -uz,
      nz = ux; // 外法线
    var ldx = dx,
      ldz = -dz;
    var edgeAngle = Math.atan2(ldz, ldx);
    var floorH = 3.0,
      sillH = 0.8,
      winH = 1.2,
      doorH = 2.0,
      doorW = 0.7;
    var wallOff = 0.02; // 门窗略突出墙面
    var nClassrooms = _nRooms || Math.max(1, Math.round(edgeLen / 8));
    var crw = edgeLen / nClassrooms;
    var winRanges = computeWindowRanges(edgeLen, _nRooms);

    // 共享材质(全局复用)
    if (!addDoorsAndWindows._doorMat) {
      addDoorsAndWindows._doorMat = new THREE.MeshStandardMaterial({
        color: '#8B6914',
        roughness: 0.7,
      });
      addDoorsAndWindows._glassMat = new THREE.MeshStandardMaterial({
        color: '#c8ddf0',
        roughness: 0.15,
        metalness: 0.3,
      });
      addDoorsAndWindows._frameMat = new THREE.MeshStandardMaterial({
        color: '#666666',
        roughness: 0.5,
      });
    }
    var doorMat = addDoorsAndWindows._doorMat;
    var glassMat = addDoorsAndWindows._glassMat;
    var frameMat = addDoorsAndWindows._frameMat;

    var nFloors = Math.floor(wallH / floorH);
    for (var fl = 0; fl < nFloors; fl++) {
      var floorY = fl * floorH;
      var yCenter = floorY + floorH / 2;
      // 天桥裁剪
      var seg = null;
      for (var si = 0; si < (skipSegs || []).length; si++) {
        var ss = skipSegs[si];
        if (yCenter >= ss.yRange[0] && yCenter < ss.yRange[1]) {
          seg = ss.segRange;
          break;
        }
      }
      // 按教室遍历
      for (var ci = 0; ci < nClassrooms; ci++) {
        var c0 = ci * crw,
          c1 = (ci + 1) * crw; // 教室在边的起止(单位)
        var c0t = c0 / edgeLen,
          c1t = c1 / edgeLen;

        // 窗户 t 范围
        var wr = winRanges[ci];
        var w0t = wr ? wr.t0 : 0,
          w1t = wr ? wr.t1 : 0;

        // -- 窗户 --
        // 裁剪: 窗与 seg 重叠则整扇跳过
        var winBlocked = seg && w0t < seg[1] && w1t > seg[0];
        if (!winBlocked && w1t - w0t > 0.05) {
          var wLen = edgeLen * (w1t - w0t);
          var wMidT = (w0t + w1t) / 2;
          var wMidX = ax + dx * wMidT + nx * wallOff;
          var wMidY = -(az + dz * wMidT + nz * wallOff);
          var winZ = floorY + sillH + winH / 2;
          // 窗户扇数: 每扇约1.2u宽
          var nPanes = Math.max(2, Math.round(wLen / 1.2));
          var paneW = wLen / nPanes;
          for (var pi = 0; pi < nPanes; pi++) {
            var pMidT = w0t + ((pi + 0.5) * (w1t - w0t)) / nPanes;
            var pMidX = ax + dx * pMidT + nx * wallOff;
            var pMidY = -(az + dz * pMidT + nz * wallOff);
            // 玻璃
            var glass = new THREE.Mesh(new THREE.BoxGeometry(paneW - 0.04, 0.03, winH), glassMat);
            glass.position.set(pMidX, pMidY, winZ);
            glass.rotation.z = edgeAngle;
            glass.name = 'campus-detail';
            parent.add(glass);
          }
          // 窗竖框(扇间)
          for (var pi2 = 1; pi2 < nPanes; pi2++) {
            var mT = w0t + (pi2 * (w1t - w0t)) / nPanes;
            var mX = ax + dx * mT + nx * wallOff;
            var mY = -(az + dz * mT + nz * wallOff);
            var mull = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.05, winH), frameMat);
            mull.position.set(mX, mY, winZ);
            mull.rotation.z = edgeAngle;
            mull.name = 'campus-detail';
            parent.add(mull);
          }
          // 窗横框(上下)
          for (var hi = 0; hi < 2; hi++) {
            var hZ = floorY + sillH + (hi === 0 ? 0 : winH);
            var hRail = new THREE.Mesh(new THREE.BoxGeometry(wLen, 0.05, 0.04), frameMat);
            hRail.position.set(wMidX, wMidY, hZ);
            hRail.rotation.z = edgeAngle;
            hRail.name = 'campus-detail';
            parent.add(hRail);
          }
        }

        // -- 门 (仅 corridor) --
        if (type !== 'corridor') continue;
        var doorT0 = c0t + 0.4 / edgeLen;
        var doorT1 = doorT0 + doorW / edgeLen; // 前门
        var doorBlocked1 = seg && doorT0 < seg[1] && doorT1 > seg[0];
        var doorMidZ = floorY + doorH / 2;
        // 前门
        if (!doorBlocked1 && doorT1 - doorT0 > 0.005) {
          var d1MidT = (doorT0 + doorT1) / 2;
          var d1X = ax + dx * d1MidT + nx * wallOff;
          var d1Y = -(az + dz * d1MidT + nz * wallOff);
          var door1 = new THREE.Mesh(new THREE.BoxGeometry(doorW, 0.04, doorH), doorMat);
          door1.position.set(d1X, d1Y, doorMidZ);
          door1.rotation.z = edgeAngle;
          door1.name = 'campus-detail';
          parent.add(door1);
        }
        // 后门(单门模式跳过)
        if (!_singleDoor) {
          var door2T1 = c1t - 0.4 / edgeLen;
          var door2T0 = door2T1 - doorW / edgeLen; // 后门
          var doorBlocked2 = seg && door2T0 < seg[1] && door2T1 > seg[0];
          if (!doorBlocked2 && door2T1 - door2T0 > 0.005) {
            var d2MidT = (door2T0 + door2T1) / 2;
            var d2X = ax + dx * d2MidT + nx * wallOff;
            var d2Y = -(az + dz * d2MidT + nz * wallOff);
            var door2 = new THREE.Mesh(new THREE.BoxGeometry(doorW, 0.04, doorH), doorMat);
            door2.position.set(d2X, d2Y, doorMidZ);
            door2.rotation.z = edgeAngle;
            door2.name = 'campus-detail';
            parent.add(door2);
          }
        }
      }
    }
  };

  // 天桥数据(前置读取, 供建筑循环内外廊/空调分支算 skipSegs 避天桥连接子段)
  var _bridges =
    (currentMapData && currentMapData.obstacles && currentMapData.obstacles.bridges) || [];

  for (var _fi = 0; _fi < fps.length; _fi++) {
    var fp = fps[_fi];
    if (!fp.footprint || fp.footprint.length < 3) continue;
    var shape = _footprintToShape(fp.footprint, true);
    var h = fp.height || 8;
    var _stiltY = (fp.stiltFloor || 0) * 3; // 架空层高度(一楼, 柱子支撑)
    var perim = 0;
    var fpPts = fp.footprint;
    for (var i = 0; i < fpPts.length; i++) {
      var _pa = fpPts[i],
        _pb = fpPts[(i + 1) % fpPts.length];
      var _plen = Math.hypot(_pb[0] - _pa[0], _pb[1] - _pa[1]);
      if (_plen >= 1) perim += _plen;
    }
    // 每建筑clone墙纹理: U沿周长每6单位1tile, V每3单位(1层)1tile
    var wallTex = window._campusWallTex ? window._campusWallTex.clone() : null;
    if (wallTex) {
      wallTex.repeat.set(
        Math.max(1, Math.round(perim / 6)),
        Math.max(1, Math.round((h - _stiltY) / 3))
      );
      wallTex.needsUpdate = true;
    }
    var wallMat = wallTex
      ? new THREE.MeshStandardMaterial({ map: wallTex, color: '#ffffff', roughness: 0.8 })
      : M.wall;
    var roofTex = window._campusRoofTex ? window._campusRoofTex.clone() : null;
    var roofMat = roofTex
      ? new THREE.MeshStandardMaterial({ map: roofTex, color: '#ffffff', roughness: 0.85 })
      : M.roof;
    // 穹顶建筑跳过方形ExtrudeGeometry, 由下方dome代码单独生成拱顶mesh
    if (fp.roofType !== 'dome') {
      var _bDepth = Math.max(1, h - _stiltY); // 楼体墙高(架空层以上)
      var geo = new THREE.ExtrudeGeometry(shape, { depth: _bDepth, bevelEnabled: false });
      var mesh = new THREE.Mesh(geo, [wallMat, roofMat]);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.y = _stiltY; // 架空: 楼体从 stiltY 起
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.name = 'campus-bld';
      targetScene.add(mesh);
      // 架空层柱子(沿 footprint 边每5单位一根, 内移避开墙外露)
      if (_stiltY > 0) {
        // 计算 footprint 质心, 用于判断边的内侧方向
        var _cx = 0,
          _cz = 0;
        for (var _pi2 = 0; _pi2 < fpPts.length; _pi2++) {
          _cx += fpPts[_pi2][0];
          _cz += fpPts[_pi2][1];
        }
        _cx /= fpPts.length;
        _cz /= fpPts.length;
        var _pGeo = new THREE.CylinderGeometry(0.3, 0.35, 1, 8);
        var _pMat = new THREE.MeshStandardMaterial({ color: '#d8d4cc', roughness: 0.9 });
        var _pInset = 0.55; // 柱子内移量(>顶部半径0.35, 确保不露头)
        for (var _pei = 0; _pei < fpPts.length; _pei++) {
          var _pa = fpPts[_pei],
            _pb = fpPts[(_pei + 1) % fpPts.length];
          var _pdx = _pb[0] - _pa[0],
            _pdz = _pb[1] - _pa[1];
          var _plen = Math.hypot(_pdx, _pdz);
          if (_plen < 0.5) continue;
          // 边法线: (-pdz, pdx), 取指向质心侧为内侧
          var _nx = -_pdz / _plen,
            _nz = _pdx / _plen;
          var _midX = (_pa[0] + _pb[0]) / 2,
            _midZ = (_pa[1] + _pb[1]) / 2;
          if ((_cx - _midX) * _nx + (_cz - _midZ) * _nz < 0) {
            _nx = -_nx;
            _nz = -_nz;
          }
          var _pn = Math.max(1, Math.round(_plen / 5));
          // 四角不设柱(两端 t=0/t=1 跳过)
          for (var _ppi = 1; _ppi < _pn; _ppi++) {
            var _pt = _ppi / _pn;
            var _pillar = new THREE.Mesh(_pGeo, _pMat);
            _pillar.position.set(
              _pa[0] + _pdx * _pt + _nx * _pInset,
              _stiltY / 2,
              _pa[1] + _pdz * _pt + _nz * _pInset
            );
            _pillar.scale.set(1, _stiltY, 1);
            _pillar.castShadow = true;
            _pillar.name = 'campus-pillar';
            targetScene.add(_pillar);
            obstacleMeshes.push(_pillar);
          }
        }
      }
    }

    // ── 穹顶(体育馆) ──
    var bldGroup = new THREE.Group();
    bldGroup.name = 'campus-bld-detail';
    if (fp.roofType === 'dome') {
      // B7 参数化拱顶(与b7_builder工具一致): 每栋独立 vaultH/archRatio
      var _b7blds =
        _campusB7Buildings && _campusB7Buildings.length
          ? _campusB7Buildings
          : [
              { cx: 32.5, cz: 31.3, w: 38.3, d: 22.6, ry: -1.326, vaultH: 10, archRatio: 0.45 },
              { cx: 47.7, cz: 46, w: 14, d: 16.8, ry: 0.244, vaultH: 5, archRatio: 0.6 },
            ];
      var _vaultMat = new THREE.MeshStandardMaterial({
        color: '#c8d8e0',
        roughness: 0.4,
        metalness: 0.5,
        side: THREE.DoubleSide,
      });
      for (var _wi = 0; _wi < _b7blds.length; _wi++) {
        var _w = _b7blds[_wi];
        var _vH = _w.vaultH,
          _ratio = _w.archRatio;
        var _wallH = _vH * (1 - _ratio),
          _archH = _vH * _ratio;
        var _halfW = Math.min(_w.w, _w.d) * 0.48;
        var _extLen = _w.w;
        var _ry = _w.ry;
        var _isCarport = _w.name === '车棚';
        if (_isCarport) {
          // 车棚: 单片拱面屋顶(敞开, 无墙) — BufferGeometry 沿拱曲线扫掠
          var _archPts = new THREE.EllipseCurve(
            0,
            _wallH,
            _halfW,
            _archH,
            Math.PI,
            0,
            true
          ).getPoints(32);
          var _nPts = _archPts.length;
          var _verts = new Float32Array(_nPts * 2 * 3); // 每点2份(z=0/z=_extLen)
          for (var _pi = 0; _pi < _nPts; _pi++) {
            var _px = _archPts[_pi].x,
              _py = _archPts[_pi].y;
            var _vi = _pi * 6;
            _verts[_vi] = _px;
            _verts[_vi + 1] = _py;
            _verts[_vi + 2] = 0;
            _verts[_vi + 3] = _px;
            _verts[_vi + 4] = _py;
            _verts[_vi + 5] = _extLen;
          }
          var _indices = [];
          for (var _pi2 = 0; _pi2 < _nPts - 1; _pi2++) {
            var _a = _pi2 * 2,
              _b = _a + 1,
              _c = _a + 2,
              _d = _a + 3;
            _indices.push(_a, _c, _b, _c, _d, _b);
          }
          var _shellGeo = new THREE.BufferGeometry();
          _shellGeo.setAttribute('position', new THREE.BufferAttribute(_verts, 3));
          _shellGeo.setIndex(_indices);
          _shellGeo.computeVertexNormals();
          var _shellMesh = new THREE.Mesh(_shellGeo, _vaultMat);
          _shellMesh.rotation.y = Math.PI / 2 - _ry;
          _shellMesh.position.set(
            _w.cx - (_extLen / 2) * Math.cos(_ry),
            0,
            _w.cz - (_extLen / 2) * Math.sin(_ry)
          );
          _shellMesh.castShadow = true;
          _shellMesh.receiveShadow = true;
          _shellMesh.name = 'campus-dome';
          targetScene.add(_shellMesh);
          obstacleMeshes.push(_shellMesh);
        } else {
          // 室内运动场: 拱顶壳(米白)+墙面板(米黄)+蓝色腰线
          var _sportsArchPts = new THREE.EllipseCurve(
            0,
            _wallH,
            _halfW,
            _archH,
            Math.PI,
            0,
            true
          ).getPoints(32);
          var _sportsNPts = _sportsArchPts.length;
          var _sportsVerts = new Float32Array(_sportsNPts * 2 * 3);
          for (var _spi = 0; _spi < _sportsNPts; _spi++) {
            var _spx = _sportsArchPts[_spi].x,
              _spy = _sportsArchPts[_spi].y;
            var _svi = _spi * 6;
            _sportsVerts[_svi] = _spx;
            _sportsVerts[_svi + 1] = _spy;
            _sportsVerts[_svi + 2] = 0;
            _sportsVerts[_svi + 3] = _spx;
            _sportsVerts[_svi + 4] = _spy;
            _sportsVerts[_svi + 5] = _extLen;
          }
          var _sportsIndices = [];
          for (var _spi2 = 0; _spi2 < _sportsNPts - 1; _spi2++) {
            var _sa = _spi2 * 2,
              _sb = _sa + 1,
              _sc = _sa + 2,
              _sd = _sa + 3;
            _sportsIndices.push(_sa, _sc, _sb, _sc, _sd, _sb);
          }
          var _sportsArchGeo = new THREE.BufferGeometry();
          _sportsArchGeo.setAttribute('position', new THREE.BufferAttribute(_sportsVerts, 3));
          _sportsArchGeo.setIndex(_sportsIndices);
          _sportsArchGeo.computeVertexNormals();

          // 材质定义
          var _archWhiteM = new THREE.MeshStandardMaterial({
            color: '#f5f0e0',
            roughness: 0.35,
            metalness: 0.2,
            side: THREE.DoubleSide,
          });
          var _wallCreamM = new THREE.MeshStandardMaterial({
            color: '#f5e8c0',
            roughness: 0.6,
            metalness: 0.1,
            side: THREE.DoubleSide,
          });
          var _beltBlueM = new THREE.MeshStandardMaterial({
            color: '#4477aa',
            roughness: 0.3,
            polygonOffset: true,
            polygonOffsetFactor: -1,
            polygonOffsetUnits: -1,
          });

          // 建筑组(与原始 ExtrudeGeometry 同样变换)
          var _domeGrp = new THREE.Group();
          _domeGrp.rotation.y = Math.PI / 2 - _ry;
          _domeGrp.position.set(
            _w.cx - (_extLen / 2) * Math.cos(_ry),
            0,
            _w.cz - (_extLen / 2) * Math.sin(_ry)
          );
          targetScene.add(_domeGrp);
          obstacleMeshes.push(_domeGrp);

          // 拱顶壳
          var _archShell = new THREE.Mesh(_sportsArchGeo, _archWhiteM);
          _archShell.castShadow = true;
          _archShell.receiveShadow = true;
          _archShell.name = 'campus-dome';
          _domeGrp.add(_archShell);

          // 拱顶端盖(封住侧面透明: ShapeGeometry覆盖拱面三角区, Z=0和Z=_extLen)
          var _endCapShape = new THREE.Shape();
          _endCapShape.moveTo(-_halfW, _wallH);
          var _ecArchPts = new THREE.EllipseCurve(
            0,
            _wallH,
            _halfW,
            _archH,
            Math.PI,
            0,
            true
          ).getPoints(24);
          for (var _eci = 0; _eci < _ecArchPts.length; _eci++)
            _endCapShape.lineTo(_ecArchPts[_eci].x, _ecArchPts[_eci].y);
          _endCapShape.lineTo(+_halfW, _wallH);
          var _endCapGeo = new THREE.ShapeGeometry(_endCapShape);
          var _endCap0 = new THREE.Mesh(_endCapGeo, _wallCreamM);
          _endCap0.position.set(0, 0, 0);
          _endCap0.name = 'campus-dome';
          _domeGrp.add(_endCap0);
          var _endCap1 = new THREE.Mesh(_endCapGeo, _wallCreamM);
          _endCap1.position.set(0, 0, _extLen);
          _endCap1.rotation.y = Math.PI;
          _endCap1.name = 'campus-dome';
          _domeGrp.add(_endCap1);

          // 墙面分两段: 腰线(Y=3.0)以下绿色漆, 以上米黄
          var _wallGreenM = new THREE.MeshStandardMaterial({
            color: '#6b8e5a',
            roughness: 0.6,
            metalness: 0.1,
          });
          var _beltY = _wallH * 0.384; // 黄金分割: 上部61.6% 下部38.4%
          var _lowerH = _beltY,
            _upperH = _wallH - _beltY;
          // 长墙下段(绿色)
          var _longLowerGeo = new THREE.BoxGeometry(0.25, _lowerH, _extLen);
          var _wlNXlo = new THREE.Mesh(_longLowerGeo, _wallGreenM);
          _wlNXlo.position.set(-_halfW + 0.125, _lowerH / 2, _extLen / 2);
          _wlNXlo.castShadow = true;
          _wlNXlo.name = 'campus-wall';
          _domeGrp.add(_wlNXlo);
          var _wlPXlo = new THREE.Mesh(_longLowerGeo, _wallGreenM);
          _wlPXlo.position.set(+_halfW - 0.125, _lowerH / 2, _extLen / 2);
          _wlPXlo.castShadow = true;
          _wlPXlo.name = 'campus-wall';
          _domeGrp.add(_wlPXlo);
          // 长墙上段(米黄)
          var _longUpperGeo = new THREE.BoxGeometry(0.25, _upperH, _extLen);
          var _wlNXup = new THREE.Mesh(_longUpperGeo, _wallCreamM);
          _wlNXup.position.set(-_halfW + 0.125, _beltY + _upperH / 2, _extLen / 2);
          _wlNXup.castShadow = true;
          _wlNXup.name = 'campus-wall';
          _domeGrp.add(_wlNXup);
          var _wlPXup = new THREE.Mesh(_longUpperGeo, _wallCreamM);
          _wlPXup.position.set(+_halfW - 0.125, _beltY + _upperH / 2, _extLen / 2);
          _wlPXup.castShadow = true;
          _wlPXup.name = 'campus-wall';
          _domeGrp.add(_wlPXup);
          // 短墙下段(绿色)
          var _endLowerGeo = new THREE.BoxGeometry(2 * _halfW, _lowerH, 0.25);
          var _ew0lo = new THREE.Mesh(_endLowerGeo, _wallGreenM);
          _ew0lo.position.set(0, _lowerH / 2, 0.125);
          _ew0lo.castShadow = true;
          _ew0lo.name = 'campus-wall';
          _domeGrp.add(_ew0lo);
          var _ew1lo = new THREE.Mesh(_endLowerGeo, _wallGreenM);
          _ew1lo.position.set(0, _lowerH / 2, _extLen - 0.125);
          _ew1lo.castShadow = true;
          _ew1lo.name = 'campus-wall';
          _domeGrp.add(_ew1lo);
          // 短墙上段(米黄)
          var _endUpperGeo = new THREE.BoxGeometry(2 * _halfW, _upperH, 0.25);
          var _ew0up = new THREE.Mesh(_endUpperGeo, _wallCreamM);
          _ew0up.position.set(0, _beltY + _upperH / 2, 0.125);
          _ew0up.castShadow = true;
          _ew0up.name = 'campus-wall';
          _domeGrp.add(_ew0up);
          var _ew1up = new THREE.Mesh(_endUpperGeo, _wallCreamM);
          _ew1up.position.set(0, _beltY + _upperH / 2, _extLen - 0.125);
          _ew1up.castShadow = true;
          _ew1up.name = 'campus-wall';
          _domeGrp.add(_ew1up);

          // 蓝色腰线(漆面极薄, 贴墙外表面, Y=3.0m)
          var _beltThin = 0.02,
            _beltH = 0.25;
          var _beltLongGeo = new THREE.BoxGeometry(_beltThin, _beltH, _extLen);
          var _beltNX = new THREE.Mesh(_beltLongGeo, _beltBlueM);
          _beltNX.position.set(-_halfW + _beltThin / 2, _beltY, _extLen / 2); // -X墙外表面=-_halfW
          _beltNX.name = 'campus-detail';
          _domeGrp.add(_beltNX);
          var _beltPX = new THREE.Mesh(_beltLongGeo, _beltBlueM);
          _beltPX.position.set(+_halfW - _beltThin / 2, _beltY, _extLen / 2); // +X墙外表面=+_halfW
          _beltPX.name = 'campus-detail';
          _domeGrp.add(_beltPX);
          var _beltShortGeo = new THREE.BoxGeometry(2 * _halfW, _beltH, _beltThin);
          var _beltZ0 = new THREE.Mesh(_beltShortGeo, _beltBlueM);
          _beltZ0.position.set(0, _beltY, -_beltThin / 2); // Z=0端墙外表面=0
          _beltZ0.name = 'campus-detail';
          _domeGrp.add(_beltZ0);
          var _beltZ1 = new THREE.Mesh(_beltShortGeo, _beltBlueM);
          _beltZ1.position.set(0, _beltY, _extLen + _beltThin / 2); // Z=_extLen端墙外表面=_extLen
          _beltZ1.name = 'campus-detail';
          _domeGrp.add(_beltZ1);

          // ---- 运动场门窗贴面函数(本地坐标系: X=拱跨, Y=高度, Z=挤出方向) ----
          var _endW = 2.0; // 墙端留白(函数作用域, 两分支共用)
          var _addSportsDoorsWindows = function (wallX, outDX, hasDoor) {
            var _sillH = 2.5,
              _winH = 1.2,
              _winW = 2.5;
            var _doorW = 4.5,
              _doorH = 3.5;
            var _glassM = new THREE.MeshStandardMaterial({
              color: '#c8ddf0',
              roughness: 0.15,
              metalness: 0.3,
            });
            var _doorM = new THREE.MeshStandardMaterial({ color: '#8B6914', roughness: 0.7 });
            var _frameM = new THREE.MeshStandardMaterial({ color: '#666666', roughness: 0.5 });
            var _winZ = _sillH + _winH / 2;
            var _x = wallX + outDX * 0.03; // wallX已是墙外表面, +0.03贴面

            if (hasDoor) {
              // 朝向天桥面: 6窗 + 1大门居中
              var _nWinLeft = 3,
                _nWinRight = 3;
              var _doorGap = 2.5;
              var _doorZ = _extLen / 2;
              var _doorZ0 = _doorZ - _doorW / 2,
                _doorZ1 = _doorZ + _doorW / 2;

              // 左侧窗户(门左侧, 3扇)
              var _leftEnd = _doorZ0 - _doorGap;
              var _leftSpan = _leftEnd - _endW;
              var _leftGap = (_leftSpan - _nWinLeft * _winW) / (_nWinLeft + 1);
              for (var _wi = 0; _wi < _nWinLeft; _wi++) {
                var _wz = _endW + _leftGap * (_wi + 1) + _winW * (_wi + 0.5);
                // 玻璃
                // BoxGeometry(X=墙法线薄向, Y=高, Z=沿墙宽向)
                var _gl = new THREE.Mesh(new THREE.BoxGeometry(0.03, _winH, _winW), _glassM);
                _gl.position.set(_x, _winZ, _wz);
                _gl.name = 'campus-detail';
                _domeGrp.add(_gl);
                for (var _hi = 0; _hi < 2; _hi++) {
                  var _hr = new THREE.Mesh(
                    new THREE.BoxGeometry(0.05, 0.04, _winW + 0.04),
                    _frameM
                  );
                  _hr.position.set(_x, _sillH + (_hi === 0 ? 0 : _winH), _wz);
                  _hr.name = 'campus-detail';
                  _domeGrp.add(_hr);
                }
                for (var _vi = 0; _vi < 2; _vi++) {
                  var _vr = new THREE.Mesh(new THREE.BoxGeometry(0.05, _winH, 0.04), _frameM);
                  _vr.position.set(_x, _winZ, _wz + (_vi === 0 ? -_winW / 2 : _winW / 2));
                  _vr.name = 'campus-detail';
                  _domeGrp.add(_vr);
                }
              }

              // 右侧窗户(门右侧, 3扇)
              var _rightStart = _doorZ1 + _doorGap;
              var _rightSpan = _extLen - _rightStart - _endW;
              var _rightGap = (_rightSpan - _nWinRight * _winW) / (_nWinRight + 1);
              for (var _wi2 = 0; _wi2 < _nWinRight; _wi2++) {
                var _wz2 = _rightStart + _rightGap * (_wi2 + 1) + _winW * (_wi2 + 0.5);
                var _gl2 = new THREE.Mesh(new THREE.BoxGeometry(0.03, _winH, _winW), _glassM);
                _gl2.position.set(_x, _winZ, _wz2);
                _gl2.name = 'campus-detail';
                _domeGrp.add(_gl2);
                for (var _hi2 = 0; _hi2 < 2; _hi2++) {
                  var _hr2 = new THREE.Mesh(
                    new THREE.BoxGeometry(0.05, 0.04, _winW + 0.04),
                    _frameM
                  );
                  _hr2.position.set(_x, _sillH + (_hi2 === 0 ? 0 : _winH), _wz2);
                  _hr2.name = 'campus-detail';
                  _domeGrp.add(_hr2);
                }
                for (var _vi2 = 0; _vi2 < 2; _vi2++) {
                  var _vr2 = new THREE.Mesh(new THREE.BoxGeometry(0.05, _winH, 0.04), _frameM);
                  _vr2.position.set(_x, _winZ, _wz2 + (_vi2 === 0 ? -_winW / 2 : _winW / 2));
                  _vr2.name = 'campus-detail';
                  _domeGrp.add(_vr2);
                }
              }

              // 对开大门(居中, 中缝黑色线条, 竖向把手)
              var _doorHalfW = _doorW / 2 - 0.02;
              var _doorL = new THREE.Mesh(new THREE.BoxGeometry(0.04, _doorH, _doorHalfW), _doorM);
              _doorL.position.set(_x, _doorH / 2, _doorZ - _doorW / 4 - 0.01);
              _doorL.name = 'campus-detail';
              _domeGrp.add(_doorL);
              var _doorR = new THREE.Mesh(new THREE.BoxGeometry(0.04, _doorH, _doorHalfW), _doorM);
              _doorR.position.set(_x, _doorH / 2, _doorZ + _doorW / 4 + 0.01);
              _doorR.name = 'campus-detail';
              _domeGrp.add(_doorR);
              // 中缝黑色线条(覆盖腰线/墙面)
              var _gapStrip = new THREE.Mesh(
                new THREE.BoxGeometry(0.045, _doorH, 0.04),
                new THREE.MeshStandardMaterial({ color: '#1a1a1a', roughness: 0.9 })
              );
              _gapStrip.position.set(_x + 0.005, _doorH / 2, _doorZ);
              _gapStrip.name = 'campus-detail';
              _domeGrp.add(_gapStrip);
              // 竖向门把手(圆柱, 离中缝约0.15)
              var _handleGeo = new THREE.CylinderGeometry(0.03, 0.03, 1.2, 8);
              var _handleM = new THREE.MeshStandardMaterial({
                color: '#cccccc',
                roughness: 0.2,
                metalness: 0.9,
              });
              var _hL = new THREE.Mesh(_handleGeo, _handleM);
              _hL.position.set(_x + 0.03, 1.2, _doorZ - 0.15);
              _hL.name = 'campus-detail';
              _domeGrp.add(_hL);
              var _hR = new THREE.Mesh(_handleGeo, _handleM);
              _hR.position.set(_x + 0.03, 1.2, _doorZ + 0.15);
              _hR.name = 'campus-detail';
              _domeGrp.add(_hR);
              _hR.name = 'campus-detail';
              _domeGrp.add(_hR);

              // 返回窗t范围供AC避让
              var _winRanges = [];
              for (var _wi3 = 0; _wi3 < _nWinLeft; _wi3++) {
                var _z0 = _endW + _leftGap * (_wi3 + 1) + _winW * _wi3;
                _winRanges.push({ t0: _z0 / _extLen, t1: (_z0 + _winW) / _extLen });
              }
              for (var _wi4 = 0; _wi4 < _nWinRight; _wi4++) {
                var _z0r = _rightStart + _rightGap * (_wi4 + 1) + _winW * _wi4;
                _winRanges.push({ t0: _z0r / _extLen, t1: (_z0r + _winW) / _extLen });
              }
              return _winRanges;
            } else {
              // 背对天桥面: 7窗均匀分布
              var _nWin = 7;
              var _span2 = _extLen - 2 * _endW;
              var _gap2 = (_span2 - _nWin * _winW) / (_nWin + 1);
              for (var _wi5 = 0; _wi5 < _nWin; _wi5++) {
                var _wz3 = _endW + _gap2 * (_wi5 + 1) + _winW * (_wi5 + 0.5);
                var _gl3 = new THREE.Mesh(new THREE.BoxGeometry(0.03, _winH, _winW), _glassM);
                _gl3.position.set(_x, _winZ, _wz3);
                _gl3.name = 'campus-detail';
                _domeGrp.add(_gl3);
                for (var _hi3 = 0; _hi3 < 2; _hi3++) {
                  var _hr3 = new THREE.Mesh(
                    new THREE.BoxGeometry(0.05, 0.04, _winW + 0.04),
                    _frameM
                  );
                  _hr3.position.set(_x, _sillH + (_hi3 === 0 ? 0 : _winH), _wz3);
                  _hr3.name = 'campus-detail';
                  _domeGrp.add(_hr3);
                }
                for (var _vi5 = 0; _vi5 < 2; _vi5++) {
                  var _vr3 = new THREE.Mesh(new THREE.BoxGeometry(0.05, _winH, 0.04), _frameM);
                  _vr3.position.set(_x, _winZ, _wz3 + (_vi5 === 0 ? -_winW / 2 : _winW / 2));
                  _vr3.name = 'campus-detail';
                  _domeGrp.add(_vr3);
                }
              }
              var _wrs = [];
              for (var _wri = 0; _wri < _nWin; _wri++) {
                var _z0 = _endW + _gap2 * (_wri + 1) + _winW * _wri;
                _wrs.push({ t0: _z0 / _extLen, t1: (_z0 + _winW) / _extLen });
              }
              return _wrs;
            }
          };

          // 贴门窗: +X墙(朝向天桥, 大门+6窗), -X墙(背对天桥, 仅7窗)
          var _winRangesFront = _addSportsDoorsWindows(+_halfW, +1, true); // +X墙: 朝向天桥, 大门+窗
          var _winRangesBack = _addSportsDoorsWindows(-_halfW, -1, false); // -X墙: 背对天桥, 仅窗
        }

        // b7 空调(读 edgeMarks, 只 ac, 长边 ei=0/2)
        var _b7mks = _w.edgeMarks || [];
        var _extLen2 = _w.w;
        var _halfW2 = Math.min(_w.w, _w.d) * 0.48;
        var _cry = Math.cos(_ry),
          _sry = Math.sin(_ry);
        var _b7wallH = _vH * (1 - _ratio);
        // 世界坐标转换: 局部 (lx, lz) → 世界 (wx, wz)
        var _b7w = function (lx, lz) {
          return [
            _w.cx - (_extLen2 / 2) * _cry + lx * _sry + lz * _cry,
            _w.cz - (_extLen2 / 2) * _sry - lx * _cry + lz * _sry,
          ];
        };
        var _b7grp = new THREE.Group();
        _b7grp.rotation.x = -Math.PI / 2;
        targetScene.add(_b7grp);
        obstacleMeshes.push(_b7grp);
        // 车棚四角柱(敞开式, 无墙, 内收至拱面正下方)
        if (_isCarport) {
          var _pGeo = new THREE.CylinderGeometry(0.25, 0.28, 1, 8);
          var _pMat = new THREE.MeshStandardMaterial({ color: '#d8d4cc', roughness: 0.75 });
          var _pInset = _halfW2 * 0.88; // 柱在拱跨方向内收至半宽88%处 (~6%/94%全宽)
          var _zInset = _extLen2 * 0.05; // 柱在脊线方向(长度)内收至全长5%处 (~5%/95%全宽)
          var _pRadius = 0.28; // 柱顶半径
          var _corners = [
            [-_pInset, _zInset],
            [-_pInset, _extLen2 - _zInset],
            [_pInset, _zInset],
            [_pInset, _extLen2 - _zInset],
          ];
          for (var _ci = 0; _ci < _corners.length; _ci++) {
            var _lx = _corners[_ci][0];
            // 拱面在柱子外侧边缘处的高度: _wallH + _archH * sqrt(1-((abs(lx)+pRadius)/_halfW)^2)
            // 以柱子最外侧(朝车棚边缘方向)为基准，确保整个圆顶面都在拱面下方
            var _tEdge = (Math.abs(_lx) + _pRadius) / _halfW2;
            var _archY = _wallH + _archH * Math.sqrt(Math.max(0, 1 - _tEdge * _tEdge));
            var _cw = _b7w(_lx, _corners[_ci][1]);
            var _pillar = new THREE.Mesh(_pGeo, _pMat);
            _pillar.position.set(_cw[0], _archY / 2, _cw[1]);
            _pillar.scale.set(1, _archY, 1);
            _pillar.castShadow = true;
            _pillar.name = 'campus-pillar';
            targetScene.add(_pillar);
            obstacleMeshes.push(_pillar);
          }
        }
        for (var _bmi = 0; _bmi < _b7mks.length; _bmi++) {
          var _bm = _b7mks[_bmi];
          if (_bm.type !== 'ac') continue;
          var _sgn = _bm.ei === 0 ? 1 : _bm.ei === 2 ? -1 : null;
          if (_sgn === null) continue; // 只支持长边 ei=0/2
          var _wa = _b7w(_sgn * _halfW2, 0);
          var _wb = _b7w(_sgn * _halfW2, _extLen2);
          // AC 避让窗户: ei=2(-X墙/朝桥)传窗范围, ei=0(+X墙/背桥)传null(均布)
          var _acWR = _sgn < 0 ? _winRangesBack : _winRangesFront; // -X墙(ei=2)用背桥面窗, +X墙(ei=0)用朝桥面窗
          addACToEdge(_b7grp, _wa[0], _wa[1], _wb[0], _wb[1], _b7wallH, [], _b7wallH - 1.5, _acWR);
        }
      }
    }

    // ── 外廊栏杆 + 空调外机 (穹顶建筑跳过) ──
    if (fp.roofType !== 'dome') {
      var _marks = fp.edgeMarks;
      if (_marks && _marks.length) {
        // 覆盖模式: 只画标记的边, 逐层生成跳过天桥层
        for (var _mi = 0; _mi < _marks.length; _mi++) {
          var _mk = _marks[_mi];
          var _ed = edgeByFootprintIdx(fp.footprint, _mk.ei);
          if (!_ed || _ed.len < 2) continue;
          var _mskip = edgeBridgeOverlaps(_ed, _bridges, _stiltY);
          if (_mk.type === 'corridor') {
            addCorridorToEdge(bldGroup, _ed.ax, _ed.az, _ed.bx, _ed.bz, h - _stiltY, _mskip);
            var _isTool = fp.name === '工具房';
            addDoorsAndWindows(
              bldGroup,
              _ed.ax,
              _ed.az,
              _ed.bx,
              _ed.bz,
              h - _stiltY,
              'corridor',
              _mskip,
              _stiltY,
              _isTool ? 5 : undefined, // _nRooms: 工具房强制5间
              _isTool || undefined // _singleDoor: 工具房单门
            );
          } else if (_mk.type === 'ac') {
            var _acWinRanges = computeWindowRanges(_ed.len);
            addDoorsAndWindows(
              bldGroup,
              _ed.ax,
              _ed.az,
              _ed.bx,
              _ed.bz,
              h - _stiltY,
              'ac',
              _mskip,
              _stiltY
            );
            addACToEdge(
              bldGroup,
              _ed.ax,
              _ed.az,
              _ed.bx,
              _ed.bz,
              h - _stiltY,
              _mskip,
              null,
              _acWinRanges
            );
          }
        }
      }
      // 无 edgeMarks → 不画(原 fallback 已删)
      bldGroup.position.y = _stiltY;
      bldGroup.rotation.x = -Math.PI / 2;
      targetScene.add(bldGroup);
      obstacleMeshes.push(mesh);
      obstacleMeshes.push(bldGroup);
    }

    // 碰撞数据
    var minX = Infinity,
      maxX = -Infinity,
      minZ = Infinity,
      maxZ = -Infinity;
    for (var _pi = 0; _pi < fpPts.length; _pi++) {
      var _x = fpPts[_pi][0],
        _z = fpPts[_pi][1];
      if (_x < minX) minX = _x;
      if (_x > maxX) maxX = _x;
      if (_z < minZ) minZ = _z;
      if (_z > maxZ) maxZ = _z;
    }
    if (fp.roofType !== 'dome') {
      mesh.userData._polygon = fp.footprint;
      mesh.userData._wallH = h;
      window._campusBuildings.push(mesh);
    }
    obstacleData.push({
      x: (minX + maxX) / 2,
      z: (minZ + maxZ) / 2,
      radius: (Math.max(maxX - minX, maxZ - minZ) / 2) * 1.05,
      box: { minX: minX, maxX: maxX, minZ: minZ, maxZ: maxZ },
      polygon: fp.footprint,
      height: h,
      type: 'building',
      groupRef: null,
    });
  }

  // ── 人行天桥(空中封闭连廊, 白瓷砖, 三层位置一层高) ──
  for (var _bi = 0; _bi < _bridges.length; _bi++) {
    var _br = _bridges[_bi];
    var _bshape = _footprintToShape(_br.footprint, true);
    var _bperim = 0;
    for (var _bj = 0; _bj < _br.footprint.length - 1; _bj++)
      _bperim += Math.hypot(
        _br.footprint[_bj + 1][0] - _br.footprint[_bj][0],
        _br.footprint[_bj + 1][1] - _br.footprint[_bj][1]
      );
    var _btex = window._campusWallTex ? window._campusWallTex.clone() : null;
    if (_btex) {
      _btex.repeat.set(
        Math.max(1, Math.round(_bperim / 6)),
        Math.max(1, Math.round((_br.thickness || 3) / 3))
      );
      _btex.needsUpdate = true;
    }
    var _bmat = _btex
      ? new THREE.MeshStandardMaterial({ map: _btex, color: '#ffffff', roughness: 0.8 })
      : M.wall;
    var _brTex = window._campusRoofTex ? window._campusRoofTex.clone() : null;
    var _bRoofMat = _brTex
      ? new THREE.MeshStandardMaterial({ map: _brTex, color: '#ffffff', roughness: 0.85 })
      : M.roof;
    var _bth = _br.thickness || 3;
    var _bgeo = new THREE.ExtrudeGeometry(_bshape, { depth: _bth, bevelEnabled: false });
    var _bmesh = new THREE.Mesh(_bgeo, [_bmat, _bRoofMat]);
    _bmesh.rotation.x = -Math.PI / 2;
    _bmesh.position.y = _br.floorY || 6; // 三层地板(连三栋三层空间 y=6~9)
    _bmesh.castShadow = true;
    _bmesh.receiveShadow = true;
    _bmesh.name = 'campus-bridge';
    targetScene.add(_bmesh);
    obstacleMeshes.push(_bmesh); // 炮弹Raycaster命中(空中); 不push obstacleData→坦克可从桥下穿行
  }
}

// ── 2D凸包 (Andrew's Monotone Chain) ──
function _convexHull(points) {
  points = points.slice().sort(function (a, b) {
    return a[0] - b[0] || a[1] - b[1];
  });
  var cross = function (o, a, b) {
    return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  };
  var lower = [],
    upper = [];
  for (var i = 0; i < points.length; i++) {
    while (
      lower.length >= 2 &&
      cross(lower[lower.length - 2], lower[lower.length - 1], points[i]) <= 0
    )
      lower.pop();
    lower.push(points[i]);
  }
  for (var j = points.length - 1; j >= 0; j--) {
    while (
      upper.length >= 2 &&
      cross(upper[upper.length - 2], upper[upper.length - 1], points[j]) <= 0
    )
      upper.pop();
    upper.push(points[j]);
  }
  upper.pop();
  lower.pop();
  return lower.concat(upper);
}
// 多边形外扩(dist>0=外扩, dist<0=内缩)
function _expandPolygon(poly, dist) {
  var expanded = [];
  for (var i = 0; i < poly.length; i++) {
    var a = poly[i],
      b = poly[(i + 1) % poly.length];
    var dx = b[0] - a[0],
      dz = b[1] - a[1];
    var len = Math.sqrt(dx * dx + dz * dz) || 1;
    var nx = -dz / len,
      nz = dx / len; // 边法线 (CCW多边形)
    expanded.push([a[0] + nx * dist, a[1] + nz * dist]);
  }
  return expanded;
}

// ── 厕所区域(toiletZones: 每个区域生成一整座大厕所, 宽度自适应) ──
function createToiletZones(targetScene) {
  var tzCfg = currentMapData && currentMapData.obstacles && currentMapData.obstacles.toiletZones;
  if (!tzCfg || !tzCfg.length) return;
  if (typeof createToilet !== 'function') return;

  for (var ti = 0; ti < tzCfg.length; ti++) {
    var tz = tzCfg[ti];
    var rowOnZ = tz.d > tz.w;
    var rowLen = rowOnZ ? tz.d : tz.w;
    if (rowLen < 4) rowLen = 4;

    // 建一整座大厕所(宽度=区域长边)
    var inst = createToilet(rowLen);
    inst.position.set(tz.cx, getTerrainHeight ? getTerrainHeight(tz.cx, tz.cz) : 0, tz.cz);
    var baseRot = rowOnZ ? Math.PI / 2 : 0;
    inst.rotation.y = tz.ry + baseRot + (Math.PI * 148) / 180;
    inst.name = 'toilet';
    targetScene.add(inst);
    if (obstacleMeshes) obstacleMeshes.push(inst);

    var ud = inst.userData;
    if (typeof insertObstacle === 'function') {
      insertObstacle({
        x: tz.cx,
        z: tz.cz,
        radius: rowLen / 2,
        height: ud.height,
        type: 'building',
      });
    }
  }
}

// ── 西南运动区塑胶跑道(人工打点精确边界, 覆盖 grounds+通道+边缘, 坐落地砖之上/草地之下) ──
function createSportsTrackZone(targetScene, grounds, boundary) {
  if (!THREE.ShapeGeometry) return;
  // 1. 精确边界多边形 (打点工具数据 × Z取反: ShapeY→World-Z 补偿 rotation.x=-PI/2)
  //    世界路径: F→E(曲线)→D→C→B→A→闭合; Shape坐标=世界(X,-Z)
  var shape = new THREE.Shape();
  shape.moveTo(14.81, -11.46); // F world(14.81,11.46)
  // F→E 贝塞尔曲线(控制点Z取反, 方向反转)
  shape.quadraticCurveTo(26.55, -13.01, 35.75, -2.97); // CP(26.55,13.01)→E(35.75,2.97)
  shape.lineTo(69.84, -13.58); // D world(69.84,13.58)
  shape.lineTo(83.84, 37.77); // C world(83.84,-37.77) 东南角贴边界
  shape.lineTo(-3.43, 62.1); // B world(-3.43,-62.10) 西南角贴边界
  shape.lineTo(-22.11, -2.55); // A world(-22.11,2.55) 西北角
  shape.closePath(); // A→F 闭合
  // 2. 跑道纹理(砖红+颗粒, 缓存)
  if (!window._campusTrackTex) {
    var _tc = document.createElement('canvas');
    _tc.width = _tc.height = 256;
    var _tx = _tc.getContext('2d');
    _tx.fillStyle = '#CC4035';
    _tx.fillRect(0, 0, 256, 256);
    for (var _k = 0; _k < 1200; _k++) {
      var _px = Math.random() * 256,
        _py = Math.random() * 256;
      _tx.fillStyle = Math.random() > 0.5 ? 'rgba(225,95,68,0.38)' : 'rgba(145,42,32,0.35)';
      _tx.fillRect(_px, _py, 1.5, 1.5);
    }
    var _ttex = new THREE.CanvasTexture(_tc);
    _ttex.wrapS = _ttex.wrapT = THREE.RepeatWrapping;
    window._campusTrackTex = _ttex;
  }
  var trackTex = window._campusTrackTex.clone();
  trackTex.needsUpdate = true;
  // 3. 精确边界 Shape → ShapeGeometry
  var geo = new THREE.ShapeGeometry(shape);
  var mat = new THREE.MeshStandardMaterial({
    map: trackTex,
    color: '#ffffff',
    roughness: 0.9,
    polygonOffset: true,
    polygonOffsetFactor: -1.5,
    polygonOffsetUnits: -2,
  });
  var mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0;
  mesh.receiveShadow = true;
  mesh.name = 'sports-track';
  targetScene.add(mesh);
  obstacleMeshes.push(mesh);
}

function createGrounds(targetScene, grounds) {
  const M = window.CampusMaterials;
  if (!M || !THREE.ShapeGeometry || !grounds || !grounds.length) return;
  // 懒初始化共享草地材质(游戏自带 TerrainTextures.grass() 真实噪声+草叶纹理)
  var grassMat = null;
  var getGrassMat = function () {
    if (grassMat) return grassMat;
    var tt = window.TerrainTextures;
    var grassCanvas = tt ? tt.grass() : null;
    if (grassCanvas) {
      // TerrainTextures.grass() 返回 raw canvas，需包装为 CanvasTexture
      var canvasTex = new THREE.CanvasTexture(grassCanvas);
      canvasTex.wrapS = canvasTex.wrapT = THREE.RepeatWrapping;
      canvasTex.colorSpace = THREE.SRGBColorSpace;
      canvasTex.magFilter = THREE.LinearFilter;
      canvasTex.minFilter = THREE.LinearMipmapLinearFilter;
      canvasTex.generateMipmaps = true;
      grassMat = new THREE.MeshStandardMaterial({
        map: canvasTex,
        color: '#ffffff',
        roughness: 0.95,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -4,
      });
    } else {
      grassMat = M.grass; // fallback: buildings.js 纯色草地 #4A8C3F
    }
    return grassMat;
  };
  for (const g of grounds) {
    if (!g.footprint || g.footprint.length < 3) continue;
    // 若有 soccerFields 标记数据则跳过旧"足球场"ground(由 createSoccerFields 替代)
    if (
      g.name === '足球场' &&
      currentMapData &&
      currentMapData.obstacles &&
      currentMapData.obstacles.soccerFields &&
      currentMapData.obstacles.soccerFields.length
    )
      continue;
    // 命名球场 → SportsFields 接管(标线纹理面 + 球门/篮球架)
    if (window.SportsFields && SportsFields.hasCourt(g.name)) {
      SportsFields.buildCourt(g, targetScene);
      SportsFields.buildEquipment(g, targetScene);
      continue;
    }
    const shape = _footprintToShape(g.footprint, true);
    const geo = new THREE.ShapeGeometry(shape);
    const mesh = new THREE.Mesh(geo, getGrassMat());
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = 0; // =坦克底盘, 用 polygonOffset 盖跑道(不盖坦克)
    mesh.receiveShadow = true;
    mesh.name = 'campus-ground';
    targetScene.add(mesh);
    obstacleMeshes.push(mesh); // 操场不进 obstacleData(可驶入), 只登记 mesh 供清理
  }
}

// 沿校园 boundary 建围墙(4m 高, 不可摧毁静态障碍), 坦克被挡在校园内
function createBoundaryWalls(targetScene, boundary) {
  const M = window.CampusMaterials;
  if (!M || !THREE.BoxGeometry || !boundary || boundary.length < 2) return;
  const WALL_H = 4 / 1.3; // 4米→单位
  const WALL_T = 0.5; // 墙厚(单位)
  const SEG = 12; // 每段墙最大长度(单位), 拆短段保证中心密集→checkCollision queryByDistance 覆盖, 防长墙漏检穿墙
  function addWallSeg(ax, az, bx, bz) {
    const dx = bx - ax,
      dz = bz - az;
    const L = Math.sqrt(dx * dx + dz * dz);
    if (L < 0.3) return;
    const mx = (ax + bx) / 2,
      mz = (az + bz) / 2;
    const yaw = Math.atan2(dz, dx);
    const geo = new THREE.BoxGeometry(L, WALL_H, WALL_T);
    const mesh = new THREE.Mesh(geo, M.roof);
    mesh.position.set(mx, WALL_H / 2, mz);
    mesh.rotation.y = -yaw;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.name = 'campus-wall';
    targetScene.add(mesh);
    obstacleMeshes.push(mesh);
    if (window._campusBuildings) window._campusBuildings.push(mesh);
    const nx = -dz / L,
      nz = dx / L;
    const t = WALL_T / 2 + 0.3;
    const poly = [
      [ax + nx * t, az + nz * t],
      [bx + nx * t, bz + nz * t],
      [bx - nx * t, bz - nz * t],
      [ax - nx * t, az - nz * t],
    ];
    // 预存碰撞数据: 墙段多边形(2D射线-多边形求交)
    mesh.userData._polygon = poly; // [[x,z],...] 世界坐标
    mesh.userData._wallH = WALL_H;
    if (window._campusBuildings) window._campusBuildings.push(mesh);
    obstacleData.push({
      x: mx,
      z: mz,
      radius: L / 2 + t,
      polygon: poly,
      height: WALL_H,
      type: 'wall',
      groupRef: null,
    });
  }
  for (let i = 0; i < boundary.length; i++) {
    const a = boundary[i],
      b = boundary[(i + 1) % boundary.length];
    const dx = b[0] - a[0],
      dz = b[1] - a[1];
    const L = Math.sqrt(dx * dx + dz * dz);
    if (L < 0.5) continue;
    const nSeg = Math.max(1, Math.ceil(L / SEG));
    for (let s = 0; s < nSeg; s++) {
      const t0 = s / nSeg,
        t1 = (s + 1) / nSeg;
      addWallSeg(a[0] + dx * t0, a[1] + dz * t0, a[0] + dx * t1, a[1] + dz * t1);
    }
  }
}

// 围墙内地面(室内教学区·地砖): 大平面 + 程序化地砖纹理
function createCampusGround(targetScene, boundary) {
  if (!boundary || boundary.length < 3 || !THREE.PlaneGeometry) return;
  let minX = Infinity,
    maxX = -Infinity,
    minZ = Infinity,
    maxZ = -Infinity;
  for (const p of boundary) {
    const x = p[0],
      z = p[1];
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }
  const w = maxX - minX,
    d = maxZ - minZ;
  if (w <= 0 || d <= 0) return;
  if (!window._campusTileTex) {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const ctx = c.getContext('2d');
    // 室内教学区地砖底色(浅灰)
    ctx.fillStyle = '#d8d4cc';
    ctx.fillRect(0, 0, 256, 256);
    // 地砖网格线
    ctx.strokeStyle = '#9c988e';
    ctx.lineWidth = 5;
    for (let i = 0; i <= 256; i += 64) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, 256);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(256, i);
      ctx.stroke();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    window._campusTileTex = tex;
  }
  const tex = window._campusTileTex.clone();
  tex.needsUpdate = true;
  tex.repeat.set(Math.max(1, Math.round(w / 3)), Math.max(1, Math.round(d / 3)));
  const mat = new THREE.MeshStandardMaterial({
    map: tex,
    roughness: 0.9,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const geo = new THREE.PlaneGeometry(w, d);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set((minX + maxX) / 2, 0, (minZ + maxZ) / 2);
  mesh.receiveShadow = true;
  mesh.name = 'tile-ground';
  targetScene.add(mesh);
  obstacleMeshes.push(mesh);
}

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
      // campus 面材质全局共享(同 bld-im, buildings.js 模块级 const), 不 dispose;
      // 其他普通 mesh 材质可能是数组, 逐个释放
      if (c.material && !String(c.name).startsWith('campus-')) {
        const mats = Array.isArray(c.material) ? c.material : [c.material];
        for (const m of mats) {
          if (m.map) m.map.dispose();
          if (m.dispose) m.dispose();
        }
      }
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
  // 树冠阴影 proxy：低面数球(80面) 覆盖整个树冠，castShadow 投出完整树荫。
  // ✅ 核心技巧：proxy 材质 transparent+opacity=0+depthWrite=false → 主通道完全透明看不见，
  //    但阴影 pass 用独立的 DepthMaterial(只看几何不看材质透明度)，仍正常投阴影。
  //    （Three.js 两遍渲染：主pass看材质，阴影pass看几何，互不干扰。r160 MCP 实测确认。）
  // ⚠️ v0.65.4 踩坑：曾试 layers(阴影相机也看不见→不投阴影) 和 colorWrite=false(连带跳过阴影pass)，
  //    都失败；唯独 transparent+opacity=0 方案可行——它只影响主pass不影响阴影pass。
  // 半径取覆盖树冠主体(r≈0.22)，y压扁匹配扁平树冠形态(阴影形状更贴树冠)。
  // 不用 layers/colorWrite=false（见上）。透明 proxy 不需藏入树冠，可放大覆盖，阴影完整。
  const proxyMat = new THREE.MeshBasicMaterial({
    color: 0x1a3d0a,
    transparent: true, // 主pass透明
    opacity: 0, // 完全不可见
    depthWrite: false, // 不写深度，避免遮挡树冠/地面(Z-fighting)
  });
  function makeCrownProxy(count, radius, flattenY) {
    const geo = new THREE.IcosahedronGeometry(radius, 1); // detail=1(80面)，阴影轮廓圆滑
    if (flattenY !== 1) {
      // y 方向压扁，匹配扁平树冠形态，让阴影形状贴合树冠(而非正圆)
      const pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) pos.array[i * 3 + 1] *= flattenY;
      pos.needsUpdate = true;
    }
    const im = new THREE.InstancedMesh(geo, proxyMat, count);
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
    // conical 树冠仅448三角/棵(5层锥盘+尖锥)，面数少 → 直接 castShadow 投真实锥形多层阴影(质量最佳)。
    // 不用 proxy：锥形树冠用球 proxy 阴影会变圆形(形状失真)，且直接投影开销本就小(spherical 树冠5000+三角才需 proxy)。
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
    // spherical 树冠扁平(y压扁0.75)，proxy 大球 r=0.22 覆盖树冠主体 + y压扁0.72 匹配扁平形态
    const crownProxyIM = makeCrownProxy(spherePts.length, 0.22, 0.72);

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
        imProxy: crownProxyIM,
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
    // oak 树冠较高瘦(y跨-0.18~0.16)，proxy 大球 r=0.22 覆盖树冠主体 + 轻压扁0.85
    const crownProxyIM = makeCrownProxy(oakPts.length, 0.22, 0.85);

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
        imProxy: crownProxyIM,
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
      // 建筑朝向：地图数据(编辑器/村落生成器设的 yaw，朝道路)则用，否则随机(0~2π)
      group.rotation.y = typeof bld.yaw === 'number' ? bld.yaw : Math.random() * Math.PI * 2;
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
        // 填充实例矩阵 + 基于实际渲染boundingBox算碰撞半径
        const dummy = new THREE.Object3D();
        const _instBB = new THREE.Box3();
        for (const im of ims) im.geometry.computeBoundingBox();
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
          // 碰撞半径基于实例实际渲染boundingBox(覆盖完整建筑含屋顶/栏杆突起),
          // 原 ud.radius=max(w,d)/2*1.15 仅基于主体w/d, 渲染几何更宽→radius<半宽, 坦克能侵入墙体/穿过
          let maxHalfW = 0;
          let maxH = 0;
          for (const im of ims) {
            _instBB.copy(im.geometry.boundingBox).applyMatrix4(dummy.matrix);
            const hw = Math.max(_instBB.max.x - _instBB.min.x, _instBB.max.z - _instBB.min.z) / 2;
            if (hw > maxHalfW) maxHalfW = hw;
            const hh = _instBB.max.y - _instBB.min.y;
            if (hh > maxH) maxH = hh;
          }
          obstacleData.push({
            x: item.bld.x,
            z: item.bld.z,
            radius: maxHalfW * 1.05,
            height: maxH,
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

  // ── 校园 footprint 建筑 + 操场(须在 _obstacleGrid.insertAll 前注册碰撞) ──
  // 层叠顺序: 地砖(-1) < 跑道(-1.5) < 草地(-2), polygonOffset 逐层靠前
  if (obsCfg && obsCfg.boundary && obsCfg.boundary.length) {
    createCampusGround(targetScene, obsCfg.boundary); // 地砖(全校园)
  }
  if (obsCfg && obsCfg.grounds && obsCfg.grounds.length) {
    createSportsTrackZone(targetScene, obsCfg.grounds, obsCfg.boundary); // 塑胶跑道(西南运动区, 外扩+边界裁剪)
  }
  if (obsCfg && obsCfg.footprintBuildings && obsCfg.footprintBuildings.length) {
    createFootprintBuildings(targetScene, obsCfg.footprintBuildings);
  }
  if (obsCfg && obsCfg.grounds && obsCfg.grounds.length) {
    createGrounds(targetScene, obsCfg.grounds); // 草地(运动场内部, 盖跑道之上)
  }
  // 厕所区域(独立模型, 放在建筑之后/草地之上)
  createToiletZones(targetScene);
  // 足球子场(从 soccer_zone_marker.html 工具标记数据生成)
  if (window.SportsFields && SportsFields.createSoccerFields)
    SportsFields.createSoccerFields(targetScene);

  if (obsCfg && obsCfg.boundary && obsCfg.boundary.length) {
    createBoundaryWalls(targetScene, obsCfg.boundary);
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
  window.obstacleMeshes = obstacleMeshes; // 同步重赋值后的数组引用到window(供六足加特林碰撞等跨模块)
}
