// ==================== waters.js — 池塘 + 河流水面模块 ====================
// 依赖全局变量: scene, currentMapData, worldHalfW, worldHalfD, getTerrainHeight, _t

const WATER_LEVEL = -1.0;
const RIVER_WATER_LEVEL = -1.0;

let waterPlane = null;
let riverWater = null;
let riverColliders = [];

// ── 地形访问器 ──
function _getPond() { return _t('pond', null); }
function _getRiver() { return _t('river', null); }

function riverCenterZ(x) {
    const r = _getRiver(); if (!r) return -60;
    return r.zc + r.amp * Math.sin(x / r.period);
}
function riverHalfWidth(x) {
    const r = _getRiver(); if (!r) return 6.25;
    return r.hwBase + r.hwVar * Math.sin(x / r.hwPeriod + r.hwPhase);
}

function isInPond(x, z) {
    const pond = _getPond(); if (!pond) return false;
    const px = x - pond.cx, pz = z - pond.cz;
    const margin = TANK_HALF_W + 0.3;
    const erx = pond.rx + margin, erz = pond.rz + margin;
    return Math.sqrt((px*px)/(erx*erx) + (pz*pz)/(erz*erz)) < 1.0;
}

function isInRiver(x, z) {
    // 快路径：通过空间网格查 riverColliders
    const margin = TANK_HALF_W + 0.3, maxRcR = 8;
    const nearby = window._riverGrid
        ? window._riverGrid.queryByDistance(x, z, maxRcR + margin)
        : riverColliders;
    for (const rc of nearby) {
        if (Math.hypot(x - rc.x, z - rc.z) < rc.radius + margin) return true;
    }
    // 兜底：对所有归一化河流做路径距离判定
    return isInAnyRiver(x, z);
}

// ── 归一化河流访问器（统一路径点格式）──
function _getRivers() {
    if (currentMapData && currentMapData.terrain && currentMapData.terrain._normalizedRivers)
        return currentMapData.terrain._normalizedRivers;
    return [];
}

// 点到线段最短距离（2D，XZ平面）
function _pointToSegDist2D(px, pz, ax, az, bx, bz) {
    const dx = bx - ax, dz = bz - az;
    const lenSq = dx * dx + dz * dz;
    if (lenSq === 0) return Math.hypot(px - ax, pz - az);
    let t = ((px - ax) * dx + (pz - az) * dz) / lenSq;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (ax + t * dx), pz - (az + t * dz));
}

// 判断点是否在任何一条河中（对所有归一化河流做路径距离判定）
function isInAnyRiver(x, z) {
    const margin = TANK_HALF_W + 0.3;
    const rivers = _getRivers();
    for (const rv of rivers) {
        const pts = rv.points; if (!pts || pts.length < 2) continue;
        const hw = rv.width / 2 + margin;
        let minDist = Infinity;
        for (let i = 0; i < pts.length - 1; i++) {
            const d = _pointToSegDist2D(x, z, pts[i].x, pts[i].z, pts[i+1].x, pts[i+1].z);
            if (d < minDist) minDist = d;
        }
        if (minDist < hw) return true;
    }
    return false;
}

// ── 判断某点是否在任意桥面覆盖范围内（跳过此处河水碰撞体）──
function _isUnderAnyBridge(x, z) {
    const bridges = currentMapData && currentMapData.bridges;
    if (!bridges || bridges.length === 0) return false;
    for (const b of bridges) {
        // 编辑器格式（有cz/fromX）：用旋转包围盒检测
        if (b.cz !== undefined || b.fromX !== undefined) {
            const bHW = b.halfW || 6;
            const dx = (b.toX||b.cx+5) - (b.fromX||b.cx-5);
            const dz = (b.toZ||b.cz) - (b.fromZ||b.cz);
            const spanLen = Math.hypot(dx, dz) + 3;
            const spanZ = Math.max(spanLen, bHW * 1.5);
            const ang = Math.atan2(dz, dx);
            const lx = (x - b.cx) * Math.cos(-ang) - (z - b.cz) * Math.sin(-ang);
            const lz = (x - b.cx) * Math.sin(-ang) + (z - b.cz) * Math.cos(-ang);
            if (Math.abs(lx) <= spanZ / 2 + 2 && Math.abs(lz) <= bHW + 2) return true;
        } else {
            // 老参数化格式：用X范围和Z范围检测
            const bHW = b.halfW || 4;
            if (Math.abs(x - b.cx) > bHW + 2) continue;
            const bz = riverCenterZ(b.cx);
            const bhwZ = riverHalfWidth(b.cx) + 2;
            if (Math.abs(z - bz) <= bhwZ) return true;
        }
    }
    return false;
}

// ==================== 池塘水面 ====================
function createWaterSurface() {
    if (waterPlane) {
        scene.remove(waterPlane);
        if (waterPlane.geometry) waterPlane.geometry.dispose();
        if (waterPlane.material) waterPlane.material.dispose();
        waterPlane = null;
    }
    const pond = _getPond(); if (!pond) return;
    const SHORE_MARGIN = 1.25;
    const a = pond.rx * SHORE_MARGIN;
    const b = pond.rz * SHORE_MARGIN;
    if (a <= 0 || b <= 0) return;
    const sAngles = [0, Math.PI * 0.5, Math.PI, Math.PI * 1.5];
    const edgeHs = sAngles.map(ang => getTerrainHeight(pond.cx + Math.cos(ang) * pond.rx, pond.cz + Math.sin(ang) * pond.rz));
    const edgeMin = Math.min(...edgeHs);
    const waterY = edgeMin - 0.3;
    const seg = 32;
    const ePos = [0, 0, 0];
    const eUV = [0.5, 0.5];
    const eIdx = [];
    for (let i = 0; i <= seg; i++) {
        const theta = (i / seg) * Math.PI * 2;
        ePos.push(Math.cos(theta) * a, 0, Math.sin(theta) * b);
        eUV.push(0.5 + Math.cos(theta) * 0.5, 0.5 + Math.sin(theta) * 0.5);
    }
    for (let i = 0; i < seg; i++) eIdx.push(0, i + 2, i + 1);
    const eGeo = new THREE.BufferGeometry();
    eGeo.setAttribute('position', new THREE.Float32BufferAttribute(ePos, 3));
    eGeo.setAttribute('uv', new THREE.Float32BufferAttribute(eUV, 2));
    eGeo.setIndex(eIdx);
    eGeo.computeVertexNormals();
    const wMat = new THREE.MeshStandardMaterial({
        color: '#3388bb', roughness: 0.15, metalness: 0.1,
        transparent: true, opacity: 0.55, depthWrite: false,
        side: THREE.DoubleSide,
    });
    waterPlane = new THREE.Mesh(eGeo, wMat);
    waterPlane.position.set(pond.cx, waterY, pond.cz);
    waterPlane.name = 'water';
    waterPlane.receiveShadow = true;
    waterPlane.userData.baseY = waterY;
    scene.add(waterPlane);
}

function _buildRiverAlphaMap(rivers, worldW, worldD) {
    const TARGET = 2048;
    const maxDim = Math.max(worldW, worldD);
    const cw = Math.round(worldW / maxDim * TARGET);
    const cd = Math.round(worldD / maxDim * TARGET);
    const canvas = document.createElement('canvas');
    canvas.width = cw; canvas.height = cd;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, cw, cd);

    const cw1 = cw - 1, cd1 = cd - 1;
    const hw = worldW / 2, hd = worldD / 2;

    ctx.strokeStyle = '#ffffff';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const rv of rivers) {
        if (!rv.points || rv.points.length < 2) continue;
        ctx.lineWidth = Math.max(2, (rv.width || 12) / worldW * cw1);
        ctx.beginPath();
        for (let i = 0; i < rv.points.length; i++) {
            const px = (rv.points[i].x + hw) / worldW * cw1;
            const py = cd1 - (hd - rv.points[i].z) / worldD * cd1;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.stroke();
    }
    return canvas;
}

function createRiverWater() {
    riverColliders = [];
    if (riverWater) {
        scene.remove(riverWater);
        if (riverWater.geometry) riverWater.geometry.dispose();
        if (riverWater.material) {
            if (riverWater.material.alphaMap) riverWater.material.alphaMap.dispose();
            riverWater.material.dispose();
        }
        riverWater = null;
    }

    const rivers = _getRivers();
    if (rivers.length === 0) return;

    // 裁剪到世界边界
    const clipX = typeof worldHalfW !== 'undefined' ? worldHalfW : 150;
    const clipZ = typeof worldHalfD !== 'undefined' ? worldHalfD : 150;
    const clipped = [];
    for (const rv of rivers) {
        const pts = rv.points.filter(p => Math.abs(p.x) <= clipX && Math.abs(p.z) <= clipZ);
        if (pts.length >= 2) clipped.push({ ...rv, points: pts });
    }
    if (clipped.length === 0) return;

    // 计算水面高度（取所有河流中最低的水位）
    let waterY = RIVER_WATER_LEVEL;
    const allH = [];
    for (const rv of clipped) {
        if (rv.waterLevel != null) {
            waterY = Math.min(waterY, rv.waterLevel);
        } else {
            for (const p of rv.points) allH.push(getTerrainHeight(p.x, p.z));
        }
    }
    if (allH.length > 0) {
        allH.sort((a, b) => a - b);
        const p10 = allH[Math.floor(allH.length * 0.1)];
        waterY = Math.min(waterY, p10 - 0.3);
    }

    // === 世界尺寸（alphaMap 和平面共用，确保对齐）===
    const worldW = (currentMapData && currentMapData.worldWidth) || worldHalfW * 2 || 300;
    const worldD = (currentMapData && currentMapData.worldDepth) || worldHalfD * 2 || 300;

    // === alphaMap Canvas ===
    const alphaCanvas = _buildRiverAlphaMap(clipped, worldW, worldD);
    const tex = new THREE.CanvasTexture(alphaCanvas);
    tex.needsUpdate = true;
    tex.minFilter = THREE.NearestFilter;
    tex.magFilter = THREE.NearestFilter;
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.colorSpace = THREE.NoColorSpace;

    // === 覆盖整个地图的平面 ===
    const segs = Math.max(32, Math.ceil(Math.max(worldW, worldD) / 3));
    const planeGeo = new THREE.PlaneGeometry(worldW, worldD, segs, segs);

    const mat = new THREE.MeshStandardMaterial({ color: '#3388bb', roughness: 0.12, metalness: 0.05, transparent: true, opacity: 0.6, depthWrite: false, alphaMap: tex });

    riverWater = new THREE.Mesh(planeGeo, mat);
    riverWater.rotation.x = -Math.PI / 2;
    riverWater.position.y = waterY;
    riverWater.name = 'riverWater';
    riverWater.receiveShadow = true;
    scene.add(riverWater);

    // === 碰撞体（逻辑不变）===
    for (const rv of clipped) {
        const hw = (rv.width || 12) / 2;
        const colliderRadius = hw + 0.5;
        // 密集采样路径点
        const pts = [];
        for (let i = 0; i < rv.points.length - 1; i++) {
            const a = rv.points[i], b = rv.points[i + 1];
            const segLen = Math.hypot(b.x - a.x, b.z - a.z);
            const step = Math.max(1, Math.ceil(segLen / 2));
            for (let j = 0; j <= step; j++) {
                const t = j / step;
                pts.push({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t });
            }
        }
        let distAccum = 0;
        for (let i = 0; i < pts.length; i++) {
            if (i > 0) distAccum += Math.hypot(pts[i].x - pts[i-1].x, pts[i].z - pts[i-1].z);
            if (i === 0 || distAccum >= 5) {
                distAccum = 0;
                if (!_isUnderAnyBridge(pts[i].x, pts[i].z))
                    riverColliders.push({ x: pts[i].x, z: pts[i].z, radius: colliderRadius });
            }
        }
    }
    // 构建河流空间网格（加速碰撞查询）
    if (typeof SpatialGrid !== 'undefined' && riverColliders.length > 0) {
        window._riverGrid = new SpatialGrid(10);
        window._riverGrid.insertAll(riverColliders);
    }
}

// ==================== 动画 ====================
function updateWaterAnimation(dt) {
    // 河水流动 UV 动画
    if (typeof scene1 !== 'undefined' && scene === scene1) {
        const waterMesh = scene1.getObjectByName('riverWater');
        if (waterMesh && waterMesh.userData.waterMat && waterMesh.userData.waterMat.map) {
            waterMesh.userData.waterMat.map.offset.y += 0.3 * dt;
        }
    }
    // 池塘水面波动
    if (waterPlane) {
        const baseY = waterPlane.userData.baseY !== undefined ? waterPlane.userData.baseY : WATER_LEVEL;
        waterPlane.position.y = baseY + Math.sin(Date.now() * 0.002) * 0.08;
    }
    // 河流水面波动（alphaMap 平面，局部Z=世界高度）
    if (riverWater && riverWater.geometry && riverWater.geometry.attributes.position) {
        const rpos = riverWater.geometry.attributes.position;
        const t = Date.now() * 0.002;
        for (let i = 0; i < rpos.count; i++) {
            const wx = rpos.getX(i), wz = -rpos.getY(i); // 局部Y→世界Z（符号翻转）
            rpos.setZ(i, Math.sin(wx * 0.35 + t * 1.8) * 0.08 + Math.cos(wz * 0.3 + t * 1.5) * 0.06);
        }
        rpos.needsUpdate = true;
    }
}

// ==================== 清理 ====================
function cleanupWater() {
    if (waterPlane) {
        scene.remove(waterPlane);
        waterPlane.geometry.dispose();
        waterPlane.material.dispose();
        waterPlane = null;
    }
    if (riverWater) {
        scene.remove(riverWater);
        if (riverWater.geometry) riverWater.geometry.dispose();
        if (riverWater.material) riverWater.material.dispose();
        riverWater = null;
    }
    riverColliders = [];
    if (window._riverGrid) { window._riverGrid.clear(); window._riverGrid = null; }
}
