// T-34/85 v1.6 动画坦克构建器
// 与 model_factory.html 共用同一套几何体逻辑
// 额外输出：turretPivot(炮塔旋转) + barrelPivot(炮管俯仰) + 负重轮引用
(function() {
'use strict';

const MATERIAL_DEFS = {
  steel:       { color:0x6b6b7b, roughness:0.5,  metalness:0.8 },
  dark_steel:  { color:0x4a4a5a, roughness:0.45, metalness:0.85, emissive:0x111111, emissiveIntensity:0.30 },
  barrel_steel:{ color:0x3a3a44, roughness:0.35, metalness:0.9,  emissive:0x0a0a0a, emissiveIntensity:0.20 },
  rubber:      { color:0x2a2a2e, roughness:0.9,  metalness:0.05, emissive:0x080808, emissiveIntensity:0.25 },
  camo_green:  { color:0x4a5c2e, roughness:0.75, metalness:0.1 },
  camo_dark:   { color:0x3d4f25, roughness:0.7,  metalness:0.1 },
  camo_desert: { color:0x8b7d4a, roughness:0.75, metalness:0.1 },
  wood:        { color:0x6b4e3d, roughness:0.85, metalness:0.0 },
  default:     { color:0x888888, roughness:0.6,  metalness:0.2 }
};

function getMaterial(matId) {
  const def = MATERIAL_DEFS[matId] || MATERIAL_DEFS.default;
  return new THREE.MeshStandardMaterial(Object.assign({}, def));
}

function buildTaperedBox(bw, h, bd, tw, td, ox, oz) {
  ox = ox || 0; oz = oz || 0;
  const hw = bw/2, hd = bd/2, thw = tw/2, thd = td/2;
  const verts = [], indices = [];
  let vi = 0;
  function quad(a, b, c, d) {
    verts.push(a[0],a[1],a[2], b[0],b[1],b[2], c[0],c[1],c[2], d[0],d[1],d[2]);
    indices.push(vi, vi+1, vi+2, vi, vi+2, vi+3);
    vi += 4;
  }
  quad([-hw,0,-hd], [hw,0,-hd], [hw,0,hd], [-hw,0,hd]);
  quad([-thw+ox,h,-thd+oz], [-thw+ox,h,thd+oz], [thw+ox,h,thd+oz], [thw+ox,h,-thd+oz]);
  quad([-hw,0,-hd], [-thw+ox,h,-thd+oz], [thw+ox,h,-thd+oz], [hw,0,-hd]);
  quad([hw,0,hd], [thw+ox,h,thd+oz], [-thw+ox,h,thd+oz], [-hw,0,hd]);
  quad([-hw,0,hd], [-thw+ox,h,thd+oz], [-thw+ox,h,-thd+oz], [-hw,0,-hd]);
  quad([hw,0,-hd], [thw+ox,h,-thd+oz], [thw+ox,h,thd+oz], [hw,0,hd]);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(verts), 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function buildTaperedHex(bw, h, bd, tw, td, ox, oz) {
  ox = ox || 0; oz = oz || 0;
  const hw = bw/2, hd = bd/2, thw = tw/2, thd = td/2;
  const S3 = Math.sqrt(3)/2;
  const verts = [], indices = [];
  let vi = 0;
  function quad(a, b, c, d) {
    verts.push(a[0],a[1],a[2], b[0],b[1],b[2], c[0],c[1],c[2], d[0],d[1],d[2]);
    indices.push(vi, vi+1, vi+2, vi, vi+2, vi+3);
    vi += 4;
  }
  function hexFan(p0,p1,p2,p3,p4,p5) {
    verts.push(p0[0],p0[1],p0[2],p1[0],p1[1],p1[2],p2[0],p2[1],p2[2],p3[0],p3[1],p3[2],p4[0],p4[1],p4[2],p5[0],p5[1],p5[2]);
    indices.push(vi,vi+1,vi+2, vi,vi+2,vi+3, vi,vi+3,vi+4, vi,vi+4,vi+5);
    vi += 6;
  }
  hexFan([hw,0,0],[hw/2,0,hd*S3],[-hw/2,0,hd*S3],[-hw,0,0],[-hw/2,0,-hd*S3],[hw/2,0,-hd*S3]);
  hexFan([thw+ox,h,0+oz],[thw/2+ox,h,-thd*S3+oz],[-thw/2+ox,h,-thd*S3+oz],[-thw+ox,h,0+oz],[-thw/2+ox,h,thd*S3+oz],[thw/2+ox,h,thd*S3+oz]);
  quad([hw,0,0],        [thw+ox,h,0+oz],        [thw/2+ox,h,thd*S3+oz],   [hw/2,0,hd*S3]);
  quad([hw/2,0,hd*S3],  [thw/2+ox,h,thd*S3+oz],  [-thw/2+ox,h,thd*S3+oz], [-hw/2,0,hd*S3]);
  quad([-hw/2,0,hd*S3], [-thw/2+ox,h,thd*S3+oz], [-thw+ox,h,0+oz],        [-hw,0,0]);
  quad([-hw,0,0],       [-thw+ox,h,0+oz],        [-thw/2+ox,h,-thd*S3+oz], [-hw/2,0,-hd*S3]);
  quad([-hw/2,0,-hd*S3],[-thw/2+ox,h,-thd*S3+oz],[thw/2+ox,h,-thd*S3+oz],  [hw/2,0,-hd*S3]);
  quad([hw/2,0,-hd*S3], [thw/2+ox,h,-thd*S3+oz], [thw+ox,h,0+oz],          [hw,0,0]);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(verts), 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function buildBentBox(w, h, d, bendAngle, segments) {
  const r = d / bendAngle;
  const hw = w / 2;
  const n = segments;
  const bY = [], bZ = [], tY = [], tZ = [];
  for (let i = 0; i <= n; i++) {
    const z = (i / n - 0.5) * d;
    const th = z / r;
    const s = Math.sin(th), c = Math.cos(th);
    bY.push(r * (1 - c)); bZ.push(r * s);
    const rh = r - h;
    tY.push(r - rh * c); tZ.push(rh * s);
  }
  const verts = [], indices = [];
  let vi = 0;
  function quad(a, b, c, d) {
    verts.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2], d[0], d[1], d[2]);
    indices.push(vi, vi+1, vi+2, vi, vi+2, vi+3);
    vi += 4;
  }
  for (let i = 0; i < n; i++) {
    quad([-hw, bY[i], bZ[i]], [hw, bY[i], bZ[i]], [hw, bY[i+1], bZ[i+1]], [-hw, bY[i+1], bZ[i+1]]);
    quad([-hw, tY[i+1], tZ[i+1]], [hw, tY[i+1], tZ[i+1]], [hw, tY[i], tZ[i]], [-hw, tY[i], tZ[i]]);
    quad([-hw, bY[i], bZ[i]], [-hw, tY[i], tZ[i]], [-hw, tY[i+1], tZ[i+1]], [-hw, bY[i+1], bZ[i+1]]);
    quad([hw, bY[i+1], bZ[i+1]], [hw, tY[i+1], tZ[i+1]], [hw, tY[i], tZ[i]], [hw, bY[i], bZ[i]]);
  }
  quad([-hw, bY[0], bZ[0]], [hw, bY[0], bZ[0]], [hw, tY[0], tZ[0]], [-hw, tY[0], tZ[0]]);
  quad([hw, bY[n], bZ[n]], [-hw, bY[n], bZ[n]], [-hw, tY[n], tZ[n]], [hw, tY[n], tZ[n]]);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(verts), 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function createGeometry(node) {
  const s = node.size || [1, 1, 1];
  const seg = node.segments || [8, 1];
  switch (node.type) {
    case 'Box': return new THREE.BoxGeometry(s[0], s[1]||s[0], s[2]||s[0]);
    case 'BentBox': return buildBentBox(s[0], s[1]||0.3, s[2]||s[0], s[3]!=null?s[3]:Math.PI/6, seg[0]||16);
    case 'TaperedBox': return buildTaperedBox(s[0], s[1]||1, s[2]||s[0], s[3]!==undefined?s[3]:s[0]*0.6, s[4]!==undefined?s[4]:s[2]*0.6, s[5]||0, s[6]||0);
    case 'TaperedHex': return buildTaperedHex(s[0], s[1]||1, s[2]||s[0], s[3]!==undefined?s[3]:s[0]*0.6, s[4]!==undefined?s[4]:s[2]*0.6, s[5]||0, s[6]||0);
    case 'RoundedBox': return new RoundedBoxGeometry(s[0], s[1]||s[0], s[2]||s[0], seg[0]||3, s[3]||0.08);
    case 'Cylinder': return new THREE.CylinderGeometry(s[0], s[2]!==undefined ? s[2] : s[0], s[1], seg[0]||6);
    case 'Sphere': return new THREE.SphereGeometry(s[0], seg[0]||8, seg[1]||6);
    case 'Torus': return new THREE.TorusGeometry(s[0], s[1]||0.05, seg[0]||8, seg[1]||12);
    case 'Lathe': {
      const profile = node.profile || [[0.5,0],[0.5,0.3],[0.6,0.3],[0.6,0.35],[0.55,0.4],[0.3,0.45],[0.1,0.4]];
      const sR = node.scaleR!=null ? node.scaleR : 1;
      const sH = node.scaleH!=null ? node.scaleH : 1;
      const pts = profile.map(p => new THREE.Vector2(p[0] * sR, p[1] * sH));
      return new THREE.LatheGeometry(pts, seg[0]||24);
    }
    case 'Extrude': {
      const shape = node.shape || [[-0.5,-0.2],[0.5,-0.2],[0.5,0.2],[-0.5,0.2]];
      const shape2D = new THREE.Shape(shape.map(p => new THREE.Vector2(p[0], p[1])));
      const depth = node.extrudeDepth !== undefined ? node.extrudeDepth : 0.5;
      const bevel = node.bevelThickness || 0.02;
      return new THREE.ExtrudeGeometry(shape2D, { depth, bevelThickness:bevel, bevelSize:bevel, bevelSegments:2 });
    }
    default: return null;
  }
}

function getTrackPlateTransform(dist, tp) {
  const cyF = tp.wheelCenterYFront, cyR = tp.wheelCenterYRear;
  const rF = tp.wheelRadiusFront, rR = tp.wheelRadiusRear;
  const zF = tp.wheelCenterZFront, zR = tp.wheelCenterZRear;
  const zR1 = 1.4, zR5 = -2.55, wheelR = 0.40;
  const pA = { z: zR - rR * Math.cos(Math.PI/2), y: cyR + rR * Math.sin(Math.PI/2) };
  const pB = { z: zF - rF * Math.cos(Math.PI/2), y: cyF + rF * Math.sin(Math.PI/2) };
  const angleC = -120 * Math.PI / 180;
  const pC = { z: zF - rF * Math.cos(angleC), y: cyF + rF * Math.sin(angleC) };
  const angleD = -105 * Math.PI / 180;
  const pD = { z: zR1 - wheelR * Math.cos(angleD), y: 0.40 + wheelR * Math.sin(angleD) };
  const angleE = -75 * Math.PI / 180;
  const pE = { z: zR5 - wheelR * Math.cos(angleE), y: 0.40 + wheelR * Math.sin(angleE) };
  const angleF = -75 * Math.PI / 180;
  const pF = { z: zR - rR * Math.cos(angleF), y: cyR + rR * Math.sin(angleF) };
  const lenAB = Math.sqrt((pB.z-pA.z)**2 + (pB.y-pA.y)**2);
  const lenBC = (angleC + 2*Math.PI - Math.PI/2) * rF;
  const lenCD = Math.sqrt((pD.z-pC.z)**2 + (pD.y-pC.y)**2);
  const lenDE = Math.abs(pE.z - pD.z);
  const lenEF = Math.sqrt((pF.z-pE.z)**2 + (pF.y-pE.y)**2);
  const lenFA = (Math.PI/2 - angleF) * rR;
  const totalLen = lenAB + lenBC + lenCD + lenDE + lenEF + lenFA;
  let d = dist;
  const pos = { x:0, y:0, z:0 }, rot = { x:0, y:0, z:0 };
  if (d <= lenAB) { const t = d/lenAB; pos.z=pA.z+t*(pB.z-pA.z); pos.y=pA.y+t*(pB.y-pA.y); return {pos,rot}; }
  d -= lenAB;
  if (d <= lenBC) { const a = Math.PI/2 + (d/lenBC)*(angleC+2*Math.PI-Math.PI/2); pos.z=zF-rF*Math.cos(a); pos.y=cyF+rF*Math.sin(a); rot.x=a-Math.PI/2; return {pos,rot}; }
  d -= lenBC;
  if (d <= lenCD) { const t = d/lenCD; pos.z=pC.z+t*(pD.z-pC.z); pos.y=pC.y+t*(pD.y-pC.y); return {pos,rot}; }
  d -= lenCD;
  if (d <= lenDE) { pos.z=pD.z+(d/lenDE)*(pE.z-pD.z); pos.y=pD.y; return {pos,rot}; }
  d -= lenDE;
  if (d <= lenEF) { const t = d/lenEF; pos.z=pE.z+t*(pF.z-pE.z); pos.y=pE.y+t*(pF.y-pE.y); return {pos,rot}; }
  d -= lenEF;
  if (d <= lenFA) { const a = angleF+(d/lenFA)*(Math.PI/2-angleF); pos.z=zR-rR*Math.cos(a); pos.y=cyR+rR*Math.sin(a); rot.x=a-Math.PI/2; }
  return {pos,rot};
}

function buildTrackChain(node, parentGroup, wheelGroups) {
  const tp = node.trackParams;
  const g = new THREE.Group();
  g.name = node.name;
  if (node.position) g.position.set(...node.position);
  if (node.scale) g.scale.set(...node.scale);
  g.visible = node.visible !== false;
  parentGroup.add(g);
  const cyF = tp.wheelCenterYFront, cyR = tp.wheelCenterYRear;
  const rF = tp.wheelRadiusFront, rR = tp.wheelRadiusRear;
  const zF = tp.wheelCenterZFront, zR = tp.wheelCenterZRear;
  const lenAB = Math.sqrt((tp.wheelCenterZFront - tp.wheelCenterZRear)**2 + (tp.wheelCenterYFront - tp.wheelCenterYRear)**2);
  const totalLen = lenAB + (Math.PI*rF + Math.PI*rR) + 3.0;
  const spacing = totalLen / (tp.count - 1);
  const mat = (node.color) ? new THREE.MeshStandardMaterial({ color:node.color, roughness:0.65, metalness:0.15 }) : getMaterial(node.materialId || 'dark_steel');
  for (let i = 0; i < tp.count; i++) {
    const dist = i * spacing;
    const { pos: pp, rot } = getTrackPlateTransform(dist, tp);
    const plate = new THREE.Mesh(new THREE.BoxGeometry(tp.plateWidth, tp.plateHeight, tp.plateDepth), mat);
    plate.position.set(pp.x, pp.y, pp.z);
    plate.rotation.set(rot.x, rot.y, rot.z);
    plate.castShadow = true; plate.receiveShadow = true;
    if (wheelGroups) wheelGroups.push(plate);
    g.add(plate);
  }
}

function buildFromConfig(node, parentObj, wheelList, isDesert) {
  if (node.type === 'Group') {
    const g = new THREE.Group();
    g.name = node.name;
    if (node.position) g.position.set(...node.position);
    if (node.rotation) g.rotation.set(...node.rotation);
    if (node.scale) g.scale.set(...node.scale);
    g.visible = node.visible !== false;
    parentObj.add(g);
    if (node.children) {
      for (const c of node.children) {
        buildFromConfig(c, g, wheelList, isDesert);
      }
    }
    return g;
  }
  if (node.type === 'TrackChain') {
    buildTrackChain(node, parentObj, wheelList);
    return null;
  }
  const geo = createGeometry(node);
  if (!geo) return null;
  geo.computeBoundingBox();
  const box = geo.boundingBox;
  if (box && isFinite(box.min.x) && isFinite(box.max.x)) {
    const cx = (box.min.x + box.max.x) / 2, cy = (box.min.y + box.max.y) / 2, cz = (box.min.z + box.max.z) / 2;
    geo.translate(-cx, -cy, -cz);
  }
  const mat = (node.color) ? new THREE.MeshStandardMaterial({ color:node.color, roughness:0.65, metalness:0.15 }) : getMaterial(node.materialId || 'default');
  if (node.flatShading) {
    mat.flatShading = true;
  }
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = node.name;
  mesh.castShadow = true; mesh.receiveShadow = true;
  const pos = node.position || [0,0,0];
  mesh.position.set(pos[0], pos[1], pos[2]);
  if (node.rotation) mesh.rotation.set(...node.rotation);
  if (node.scale) mesh.scale.set(...node.scale);
  parentObj.add(mesh);
  if (node.name && (node.name.includes('负重轮') || node.name.includes('主动轮') || node.name.includes('诱导轮'))) {
    if (node.rotation && Math.abs(node.rotation[2] - 1.5708) < 0.01) {
      mesh.rotation.order = 'YXZ';
    }
    wheelList.push(mesh);
  }
  return mesh;
}

function findGroupByName(root, name) {
  let found = null;
  root.traverse(function(child) {
    if (child.name === name && child.isGroup) found = child;
  });
  return found;
}

function buildAnimatedT34_85(options) {
  const camoColor = (options && options.camoColor) || 'green';
  const isDesert = camoColor === 'desert';

  const config = JSON.parse(JSON.stringify(T34_85_V16_CONFIG));

  const tankRoot = new THREE.Group();
  tankRoot.name = 'T-34/85 v1.6';
  const wheelList = [];

  buildFromConfig(config, tankRoot, wheelList, isDesert);

  // 确保矩阵更新（tankRoot 尚未加入场景）
  tankRoot.updateMatrixWorld();

  const turretGroup = findGroupByName(tankRoot, '炮塔总成');
  let turretPivot = null, barrelPivot = null;
  const leftWheels = [], rightWheels = [];
  let mgGroup = null;

  if (turretGroup && turretGroup.parent) {
    // 找到炮塔座圈并获取其本地坐标（相对父节点）
    let ringGroup = null;
    turretGroup.traverse(c => {
      if ((c.name === '炮塔座圈' || c.name === '炮塔座圈_mesh') && !ringGroup) ringGroup = c;
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
      barrelGroup.traverse(c => {
        if ((c.name === '炮盾' || c.name === '炮盾_mesh') && !mantletGroup) mantletGroup = c;
      });
      const mantletWorld = new THREE.Vector3();
      if (mantletGroup) mantletGroup.getWorldPosition(mantletWorld);
      const barrelWorld = new THREE.Vector3();
      barrelGroup.getWorldPosition(barrelWorld);
      const bp = barrelGroup.parent;
      const mantletLocal = bp.worldToLocal(mantletWorld);
      const barrelLocal = bp.worldToLocal(barrelWorld);

      barrelPivot = new THREE.Group();
      barrelPivot.name = 'barrelPivot';
      barrelPivot.position.copy(mantletLocal);
      bp.add(barrelPivot);
      bp.remove(barrelGroup);
      barrelGroup.position.copy(barrelLocal).sub(mantletLocal);
      barrelGroup.rotation.set(0, 0, 0);
      barrelPivot.add(barrelGroup);
    }

    mgGroup = findGroupByName(turretPivot, '高射机枪');
  }

  for (const w of wheelList) {
    if (!w.position) continue;
    if (w.position.x < 0) leftWheels.push(w);
    else rightWheels.push(w);
  }

  tankRoot.traverse(function(child) {
    if (child.isMesh) { child.castShadow = true; child.receiveShadow = true; }
  });

  const barrelTipLocal = new THREE.Vector3(0, 0, 3.72);

  return { group: tankRoot, turretPivot, barrelPivot, leftWheels, rightWheels, mgGroup, barrelTipLocal };
}

const T34_85_V16_CONFIG = {"name": "T-34/85 v1.6","type": "Group","position": [0,-0.15,0],"rotation": [0,0,0],"scale": [0.5,0.5,0.5],"children": [{"name": "车体","type": "Group","position": [0,0,0],"children": [{"name": "下车体","type": "TaperedBox","size": [2,0.4,4.04,2,6,0,-0.05],"position": [0,0.85,-0.1],"materialId": "camo_green","rotation": [0,0,0],"visible": true},{"name": "上车体","type": "TaperedBox","size": [2.6,0.7,6,1.935,3.465,0,-0.45],"position": [0,1.4,-0.1],"materialId": "camo_green","rotation": [0,0,0],"visible": true},{"name": "发动机舱","type": "Box","size": [1.8,0.12,0.6],"position": [0,1.8,-1.3],"materialId": "camo_dark","rotation": [0,0,0],"visible": true},{"name": "左前翼子板","type": "BentBox","size": [0.6,0.06,0.96,1.06],"position": [-1.2,1.08,2.7],"materialId": "camo_green","rotation": [0.4887,0,3.1416],"visible": true,"segments": [32]},{"name": "右前翼子板","type": "BentBox","size": [0.6,0.06,0.96,1.06],"position": [1.2,1.08,2.7],"materialId": "camo_green","rotation": [0.4887,0,3.1416],"visible": true,"segments": [32]},{"name": "左侧翼子板","type": "Box","size": [0.3,0.06,4.8],"position": [-1.35,1.23,-0.1],"materialId": "camo_green","rotation": [0,0,0],"visible": true},{"name": "右侧翼子板","type": "Box","size": [0.3,0.06,4.8],"position": [1.35,1.23,-0.1],"materialId": "camo_green","rotation": [0,0,0],"visible": true},{"name": "左外挂油箱","type": "Cylinder","size": [0.18,1.1,0.18],"segments": [12],"position": [-1.25,1.505,-1.5],"materialId": "camo_green","rotation": [1.5708,0,0],"visible": true},{"name": "右外挂油箱","type": "Cylinder","size": [0.18,1.1,0.18],"segments": [12],"position": [1.25,1.505,-1.5],"materialId": "camo_green","rotation": [1.5708,0,0],"visible": true},{"name": "左排气管","type": "Cylinder","size": [0.06,0.35,0.06],"segments": [8],"position": [-0.8,1.5,-2.7],"materialId": "dark_steel","rotation": [0,0,0],"visible": true},{"name": "右排气管","type": "Cylinder","size": [0.06,0.35,0.06],"segments": [8],"position": [0.8,1.5,-2.7],"materialId": "dark_steel","rotation": [0,0,0],"visible": true},{"name": "前大灯","type": "Cylinder","size": [0.08,0.1,0.08],"segments": [12],"position": [-1.35,1.34,2.3],"materialId": "steel","rotation": [1.5708,0,0],"visible": true},{"name": "前牵引缆绳","type": "Torus","size": [0.25,0.02],"segments": [8,16],"position": [0,1.15,2.6],"materialId": "dark_steel","rotation": [1.5708,0,0],"visible": true},{"name": "后散热格栅","type": "Box","size": [1.8,0.12,0.5],"position": [0,1.8,-1.9],"materialId": "dark_steel","rotation": [0,0,0],"visible": true},{"name": "右后翼子板","type": "BentBox","size": [0.6,0.06,0.96,1.06],"position": [1.2,1.08,-2.9],"materialId": "default","rotation": [-0.4712,0,3.1416],"visible": true,"segments": [32],"color": "#4a5c2e"},{"name": "左后翼子板","type": "BentBox","size": [0.6,0.06,0.96,1.06],"position": [-1.2,1.08,-2.9],"materialId": "default","rotation": [-0.4887,0,3.1416],"visible": true,"segments": [32],"color": "#4a5c2e"}],"rotation": [0,0,0],"visible": true},{"name": "左履带总成","type": "Group","position": [-1.2,0.3,0.5],"children": [{"name": "左负重轮1","type": "Cylinder","size": [0.4,0.12,0.4],"segments": [16],"position": [0,0.4,1.4],"materialId": "rubber","color": "#707070","rotation": [0,0,1.5708],"visible": true},{"name": "左负重轮2","type": "Cylinder","size": [0.4,0.12,0.4],"segments": [16],"position": [0,0.4,0.39],"materialId": "rubber","color": "#707070","rotation": [0,0,1.5708],"visible": true},{"name": "左负重轮3","type": "Cylinder","size": [0.4,0.12,0.4],"segments": [16],"position": [0,0.4,-0.74],"materialId": "rubber","color": "#707070","rotation": [0,0,1.5708],"visible": true},{"name": "左负重轮4","type": "Cylinder","size": [0.4,0.12,0.4],"segments": [16],"position": [0,0.4,-1.64],"materialId": "rubber","color": "#707070","rotation": [0,0,1.5708],"visible": true},{"name": "左负重轮5","type": "Cylinder","size": [0.4,0.12,0.4],"segments": [16],"position": [0,0.4,-2.55],"materialId": "rubber","color": "#707070","rotation": [0,0,1.5708],"visible": true},{"name": "左主动轮","type": "Cylinder","size": [0.3,0.15,0.3],"segments": [16],"position": [0,0.5,-3.3],"materialId": "dark_steel","color": "#707070","rotation": [0,0,1.5708],"visible": true},{"name": "左诱导轮","type": "Cylinder","size": [0.22,0.15,0.22],"segments": [16],"position": [0,0.58,2.1],"materialId": "dark_steel","color": "#707070","rotation": [0,0,1.5708],"visible": true},{"name": "左履带链","type": "TrackChain","position": [0,0,0],"materialId": "dark_steel","color": "#2a2a2a","trackParams": {"plateWidth": 0.55,"plateHeight": 0.06,"plateDepth": 0.08,"count": 110,"wheelRadiusFront": 0.22,"wheelRadiusRear": 0.3,"wheelCenterZFront": 2.1,"wheelCenterZRear": -3.3,"wheelCenterYFront": 0.58,"wheelCenterYRear": 0.5,"upperY": 0.8,"showPath": true},"rotation": [0,0,0],"visible": true}],"rotation": [0,0,0],"visible": true},{"name": "右履带总成","type": "Group","position": [1.2,0.3,0.5],"children": [{"name": "右负重轮1","type": "Cylinder","size": [0.4,0.12,0.4],"segments": [16],"position": [0,0.4,1.4],"materialId": "rubber","color": "#707070","rotation": [0,0,1.5708],"visible": true},{"name": "右负重轮2","type": "Cylinder","size": [0.4,0.12,0.4],"segments": [16],"position": [0,0.4,0.39],"materialId": "rubber","color": "#707070","rotation": [0,0,1.5708],"visible": true},{"name": "右负重轮3","type": "Cylinder","size": [0.4,0.12,0.4],"segments": [16],"position": [0,0.4,-0.74],"materialId": "rubber","color": "#707070","rotation": [0,0,1.5708],"visible": true},{"name": "右负重轮4","type": "Cylinder","size": [0.4,0.12,0.4],"segments": [16],"position": [0,0.4,-1.64],"materialId": "rubber","color": "#707070","rotation": [0,0,1.5708],"visible": true},{"name": "右负重轮5","type": "Cylinder","size": [0.4,0.12,0.4],"segments": [16],"position": [0,0.4,-2.55],"materialId": "rubber","color": "#707070","rotation": [0,0,1.5708],"visible": true},{"name": "右主动轮","type": "Cylinder","size": [0.3,0.15,0.3],"segments": [16],"position": [0,0.5,-3.3],"materialId": "dark_steel","color": "#707070","rotation": [0,0,1.5708],"visible": true},{"name": "右诱导轮","type": "Cylinder","size": [0.22,0.15,0.22],"segments": [16],"position": [0,0.58,2.1],"materialId": "rubber","color": "#707070","rotation": [0,0,1.5708],"visible": true},{"name": "右履带链","type": "TrackChain","position": [0,0,0],"materialId": "dark_steel","color": "#2a2a2a","trackParams": {"plateWidth": 0.55,"plateHeight": 0.06,"plateDepth": 0.08,"count": 110,"wheelRadiusFront": 0.22,"wheelRadiusRear": 0.3,"wheelCenterZFront": 2.1,"wheelCenterZRear": -3.3,"wheelCenterYFront": 0.58,"wheelCenterYRear": 0.5,"upperY": 0.8,"showPath": true},"rotation": [0,0,0],"visible": true}],"rotation": [0,0,0],"visible": true},{"name": "炮塔总成","type": "Group","position": [0,-0.15,-0.5],"children": [{"name": "炮塔座圈","type": "Cylinder","size": [0.9,0.08,0.9],"segments": [32],"position": [0,1.94,0.8],"materialId": "dark_steel","rotation": [0,0,0],"visible": true},{"name": "炮塔主体","type": "TaperedHex","size": [1.85,0.78,2.77,1.45,2.2],"segments": [24],"position": [0,2.37,0.8],"materialId": "camo_dark","rotation": [0,0,0],"visible": true},{"name": "指挥塔","type": "Cylinder","size": [0.25,0.2,0.25],"segments": [12],"position": [0.4,2.86,0.8],"materialId": "camo_dark","rotation": [0,0,0],"visible": true},{"name": "装填手舱盖","type": "Box","size": [0.4,0.05,0.5],"position": [-0.2,2.755,0.55],"materialId": "dark_steel","rotation": [0,0,0],"visible": true},{"name": "炮管总成","type": "Group","position": [0,0,0],"children": [{"name": "炮盾","type": "Sphere","size": [0.22],"segments": [12,8],"position": [0,2.3,2],"scale": [1,0.7,0.6],"materialId": "barrel_steel","rotation": [0,0,0],"visible": true},{"name": "炮管根部","type": "Cylinder","size": [0.11,0.25,0.11],"segments": [12],"position": [0,2.3,2.13],"materialId": "barrel_steel","rotation": [1.5708,0,0],"visible": true},{"name": "主炮管","type": "Cylinder","size": [0.06,3.2,0.06],"segments": [12],"position": [0,2.3,3.85],"materialId": "barrel_steel","rotation": [1.5708,0,0],"visible": true},{"name": "炮口加强段","type": "Cylinder","size": [0.07,0.12,0.07],"segments": [12],"position": [0,2.3,5.51],"materialId": "barrel_steel","rotation": [1.5708,0,0],"visible": true},{"name": "同轴机枪","type": "Cylinder","size": [0.03,0.15,0.03],"segments": [8],"position": [-0.12,2.25,2.05],"materialId": "dark_steel","rotation": [1.5708,0,0],"visible": true}],"rotation": [0,0,0],"visible": true},{"name": "高射机枪","type": "Group","position": [-0.2,2.77,0.9],"rotation": [0,0,0],"children": [{"name": "MG枪座底板","type": "Box","size": [0.18,0.02,0.16],"position": [0,0,0],"materialId": "dark_steel","rotation": [0,0,0],"visible": true},{"name": "MG枪座支柱","type": "Cylinder","size": [0.04,0.25,0.04],"segments": [8],"position": [0,0.1,0],"materialId": "dark_steel","rotation": [0,0,0],"visible": true},{"name": "MG枪身","type": "Box","size": [0.07,0.09,0.18],"position": [0,0.27,0.01],"materialId": "dark_steel","rotation": [0,0,0],"visible": true},{"name": "MG枪管","type": "Cylinder","size": [0.012,0.5,0.012],"segments": [8],"position": [0,0.295,0.28],"materialId": "barrel_steel","rotation": [1.5708,0,0],"visible": true},{"name": "MG枪口制退器","type": "Cylinder","size": [0.022,0.04,0.022],"segments": [8],"position": [0,0.295,0.55],"materialId": "barrel_steel","rotation": [1.5708,0,0],"visible": true},{"name": "MG弹链箱","type": "Box","size": [0.09,0.07,0.13],"position": [-0.07,0.26,-0.01],"materialId": "camo_dark","rotation": [0,0,0],"visible": true},{"name": "MG准星座","type": "Box","size": [0.03,0.025,0.05],"position": [0,0.305,0.14],"materialId": "steel","rotation": [0,0,0],"visible": true},{"name": "MG盾牌","type": "BentBox","size": [0.2,0.02,0.815,3.141592653589793],"position": [0,0.09,0],"materialId": "default","rotation": [0,-1.5708,1.5708],"visible": true,"segments": [32],"color": "#2c361b"}],"visible": true},{"name": "左扶手","type": "Cylinder","size": [0.02,1.2,0.02],"segments": [8],"position": [-0.75,2.68,0.8],"materialId": "dark_steel","rotation": [1.5708,0,0],"visible": true},{"name": "右扶手","type": "Cylinder","size": [0.02,1.2,0.02],"segments": [8],"position": [0.75,2.68,0.8],"materialId": "dark_steel","rotation": [1.5708,0,0],"visible": true},{"name": "左烟雾弹架","type": "Cylinder","size": [0.06,0.4,0.06],"segments": [8],"position": [-0.57,2.6,1.34],"materialId": "dark_steel","rotation": [0.5411,0.15,0.2967],"color": "#4a5c2e","visible": true},{"name": "右烟雾弹架","type": "Cylinder","size": [0.06,0.4,0.06],"segments": [8],"position": [0.57,2.6,1.34],"materialId": "dark_steel","rotation": [0.5411,-0.1571,-0.2967],"color": "#4a5c2e","visible": true},{"name": "天线基座","type": "Cylinder","size": [0.015,1,0.015],"segments": [4],"position": [-0.4,3.23,0.2],"materialId": "dark_steel","rotation": [0,0,0],"visible": true}],"rotation": [0,0,0],"visible": true}],"visible": true};

window.T34V16Builder = { buildAnimatedT34_85, T34_85_V16_CONFIG };
})();
