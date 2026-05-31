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
function _getWaterLevel(type) {
    if (currentMapData && currentMapData.waters && currentMapData.waters[type])
        return currentMapData.waters[type].waterLevel ?? -1;
    return -1;
}

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
    // 快路径：查 riverColliders（所有河统一生成）
    const margin = TANK_HALF_W + 0.3;
    for (const rc of riverColliders) {
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

// smoothstep 工具
function _smoothstep(edge0, edge1, x) {
    const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
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
    console.log('🌊 水面(测试):', JSON.stringify({ waterY: waterY.toFixed(3), edgeMin: edgeMin.toFixed(3), edgeHs: edgeHs.map(h => Number(h.toFixed(3))) }));
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
    console.log('🌊 水面:', JSON.stringify({ waterY: waterY.toFixed(3), edgeMin: edgeMin.toFixed(3), edgeHs: edgeHs.map(h => Number(h.toFixed(3))) }));
}

// ==================== 河流水面 ====================

// Catmull-Rom 样条：穿过所有控制点，C1连续，不会像贝塞尔那样内切弯道
function _catmullRom(p0, p1, p2, p3, t) {
    const t2 = t * t, t3 = t2 * t;
    return {
        x: 0.5 * (2*p1.x + (p2.x - p0.x) * t + (2*p0.x - 5*p1.x + 4*p2.x - p3.x) * t2 + (3*p1.x - p0.x - 3*p2.x + p3.x) * t3),
        z: 0.5 * (2*p1.z + (p2.z - p0.z) * t + (2*p0.z - 5*p1.z + 4*p2.z - p3.z) * t2 + (3*p1.z - p0.z - 3*p2.z + p3.z) * t3)
    };
}

// 对路径点做 Catmull-Rom 平滑采样（每 sampleDist 米一个点）
function _smoothPathCR(pts, sampleDist) {
    if (pts.length < 2) return pts.slice();
    if (pts.length === 2) {
        // 只有两个点：线性插值
        const result = [pts[0]];
        const segLen = Math.hypot(pts[1].x - pts[0].x, pts[1].z - pts[0].z);
        const n = Math.max(1, Math.ceil(segLen / sampleDist));
        for (let j = 1; j < n; j++) {
            const t = j / n;
            result.push({ x: pts[0].x + (pts[1].x - pts[0].x) * t, z: pts[0].z + (pts[1].z - pts[0].z) * t });
        }
        result.push(pts[1]);
        return result;
    }
    const result = [];
    for (let i = 0; i < pts.length - 1; i++) {
        const p0 = pts[Math.max(0, i - 1)];
        const p1 = pts[i];
        const p2 = pts[i + 1];
        const p3 = pts[Math.min(pts.length - 1, i + 2)];
        const segLen = Math.hypot(p2.x - p1.x, p2.z - p1.z);
        const n = Math.max(1, Math.ceil(segLen / sampleDist));
        for (let j = 0; j < n; j++) {
            result.push(_catmullRom(p0, p1, p2, p3, j / n));
        }
    }
    result.push(pts[pts.length - 1]);
    return result;
}

function subdivideSharpCorners(pts, maxAngle) {
    maxAngle = maxAngle || 45;
    if (pts.length < 3) return pts.slice();
    const result = [pts[0]];
    for (let i = 1; i < pts.length - 1; i++) {
        const dxIn = pts[i].x - pts[i-1].x, dzIn = pts[i].z - pts[i-1].z;
        const dxOut = pts[i+1].x - pts[i].x, dzOut = pts[i+1].z - pts[i].z;
        const lenIn = Math.hypot(dxIn, dzIn) || 1;
        const lenOut = Math.hypot(dxOut, dzOut) || 1;
        const dot = (dxIn*dxOut + dzIn*dzOut) / (lenIn*lenOut);
        const angle = Math.acos(Math.max(-1, Math.min(1, dot))) * 180 / Math.PI;
        if (angle > maxAngle) {
            const n = Math.ceil(angle / 20);
            for (let j = 1; j <= n; j++) {
                const t = j / (n + 1);
                const bx = (1-t)*(1-t)*pts[i-1].x + 2*(1-t)*t*pts[i].x + t*t*pts[i+1].x;
                const bz = (1-t)*(1-t)*pts[i-1].z + 2*(1-t)*t*pts[i].z + t*t*pts[i+1].z;
                result.push({ x: bx, z: bz });
            }
        }
        result.push(pts[i]);
    }
    result.push(pts[pts.length - 1]);
    return result;
}


function createRiverWater() {
    riverColliders = [];
    // 清理旧水面
    if (riverWater) { scene.remove(riverWater); if (riverWater.geometry) riverWater.geometry.dispose(); if (riverWater.material) riverWater.material.dispose(); riverWater = null; }

    const rivers = _getRivers();
    if (rivers.length === 0) return;

    const clipX = typeof worldHalfW !== 'undefined' ? worldHalfW : 150;
    const clipZ = typeof worldHalfD !== 'undefined' ? worldHalfD : 150;
    function _clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

    // 合并所有河流到一个 geometry（消除交叉处透明叠加）
    const allVerts = [];
    const allIndices = [];

    for (let ri = 0; ri < rivers.length; ri++) {
        const rv = rivers[ri];
        const rawPts = rv.points;
        if (!rawPts || rawPts.length < 2) continue;
        const hw = (rv.width || 12) / 2;

        // 丢弃界外点
        const clipped = rawPts.filter(p => Math.abs(p.x) <= clipX && Math.abs(p.z) <= clipZ);
        if (clipped.length < 2) continue;

        // 线性插值（2m间距，同 v0.43.0）
        const waterLevel = rv.waterLevel != null ? rv.waterLevel : -1;
        const segWaterLevels = rv.waterLevels || null;
        const hasSegWL = segWaterLevels && segWaterLevels.length === clipped.length - 1;
        const pts = [];
        const ptWaterLevels = [];
        for (let i = 0; i < clipped.length - 1; i++) {
            const a = clipped[i], b = clipped[i+1];
            pts.push(a);
            const segLen = Math.hypot(b.x - a.x, b.z - a.z);
            const step = Math.max(1, Math.ceil(segLen / 2));
            const wl = hasSegWL ? segWaterLevels[i] : null;
            ptWaterLevels.push(wl);
            for (let j = 1; j < step; j++) {
                const t = j / step;
                pts.push({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t });
                ptWaterLevels.push(wl);
            }
        }
        pts.push(clipped[clipped.length - 1]);
        ptWaterLevels.push(hasSegWL ? segWaterLevels[segWaterLevels.length - 1] : null);

        let fallbackWaterY = waterLevel;
        if (rv.waterLevel == null) {
            let sumH = 0, minH = Infinity;
            for (const p of pts) { const th = getTerrainHeight(p.x, p.z); sumH += th; if (th < minH) minH = th; }
            fallbackWaterY = Math.min((sumH / pts.length) - 0.6, minH + 0.3);
        }

        // 构建 strip 顶点
        const vOffset = allVerts.length / 3; // 当前已有顶点数
        for (let i = 0; i < pts.length; i++) {
            const p = pts[i]; let dx, dz;
            if (i === 0) { dx = pts[i+1].x - p.x; dz = pts[i+1].z - p.z; }
            else if (i === pts.length - 1) { dx = p.x - pts[i-1].x; dz = p.z - pts[i-1].z; }
            else {
                const dxIn = p.x - pts[i-1].x, dzIn = p.z - pts[i-1].z;
                const lenIn = Math.hypot(dxIn, dzIn) || 1;
                const dxOut = pts[i+1].x - p.x, dzOut = pts[i+1].z - p.z;
                const lenOut = Math.hypot(dxOut, dzOut) || 1;
                dx = dxIn/lenIn + dxOut/lenOut; dz = dzIn/lenIn + dzOut/lenOut;
            }
            const len = Math.hypot(dx, dz) || 1;
            const nx = -dz/len * hw, nz = dx/len * hw;
            const wy = ptWaterLevels[i] !== null ? ptWaterLevels[i] : fallbackWaterY;
            allVerts.push(p.x + nx, wy, p.z + nz);
            allVerts.push(p.x - nx, wy, p.z - nz);
        }
        for (let i = 0; i < pts.length - 1; i++) {
            const a = vOffset + i * 2, b = a + 1, c = a + 2, d = a + 3;
            allIndices.push(a, c, b, b, c, d);
        }

        // 碰撞体（5m间距）
        const colliderRadius = hw + 0.5;
        const COLLIDER_SPACING = 5;
        let distAccum = 0;
        for (let i = 0; i < pts.length; i++) {
            if (i > 0) distAccum += Math.hypot(pts[i].x - pts[i-1].x, pts[i].z - pts[i-1].z);
            if (i === 0 || distAccum >= COLLIDER_SPACING) {
                distAccum = 0;
                if (!_isUnderAnyBridge(pts[i].x, pts[i].z))
                    riverColliders.push({ x: pts[i].x, z: pts[i].z, radius: colliderRadius });
            }
        }
    }

    // 创建合并后的单一水面
    if (allVerts.length > 0) {
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(allVerts, 3));
        geo.setIndex(allIndices);
        geo.computeVertexNormals();
        const mat = new THREE.MeshStandardMaterial({
            color: '#3388bb', roughness: 0.12, metalness: 0.05,
            transparent: true, opacity: 0.6, depthWrite: false,
        });
        riverWater = new THREE.Mesh(geo, mat);
        riverWater.name = 'riverWater';
        riverWater.receiveShadow = true;
        scene.add(riverWater);
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
    // 河流水面流动波动
    if (riverWater && riverWater.geometry && riverWater.geometry.attributes.position) {
        const rpos = riverWater.geometry.attributes.position;
        const t = Date.now() * 0.002;
        for (let i = 0; i < rpos.count; i++) {
            rpos.setY(i, RIVER_WATER_LEVEL + Math.sin(rpos.getX(i) * 0.35 + t * 1.8) * 0.1);
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
}
