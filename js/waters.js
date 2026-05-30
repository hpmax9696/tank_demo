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

// 全局水面 mesh 列表（替代旧单 mesh 变量）
let riverWaterMeshes = [];

function createRiverWater() {
    riverColliders = [];
    // 清理旧水面
    for (const m of riverWaterMeshes) { scene.remove(m); if (m.geometry) m.geometry.dispose(); if (m.material) m.material.dispose(); }
    riverWaterMeshes = [];
    if (riverWater) { scene.remove(riverWater); riverWater = null; }

    const rivers = _getRivers();
    if (rivers.length === 0) return;

    const clipX = typeof worldHalfW !== 'undefined' ? worldHalfW : 150;
    const clipZ = typeof worldHalfD !== 'undefined' ? worldHalfD : 150;
    // 矩形区域裁剪路径（Cohen-Sutherland），保留边界内的部分
    function _clipPathToRect(pts, left, right, bottom, top) {
        if (pts.length < 2) return pts;
        function _inside(x, z) { return x >= left && x <= right && z >= bottom && z <= top; }
        function _intersect(ax, az, bx, bz, edge) {
            let t = 0;
            switch (edge) {
                case 0: t = (left - ax) / (bx - ax); break;   // 左
                case 1: t = (right - ax) / (bx - ax); break;  // 右
                case 2: t = (bottom - az) / (bz - az); break; // 下
                case 3: t = (top - az) / (bz - az); break;    // 上
            }
            t = Math.max(0, Math.min(1, t));
            return { x: ax + (bx - ax) * t, z: az + (bz - az) * t };
        }
        const result = [];
        for (let i = 0; i < pts.length - 1; i++) {
            const a = pts[i], b = pts[i+1];
            const aIn = _inside(a.x, a.z), bIn = _inside(b.x, b.z);
            if (aIn && bIn) { result.push(a); }
            else if (aIn || bIn) {
                if (aIn) result.push(a);
                // 找交点：逐边检测
                for (let e = 0; e < 4; e++) {
                    const ip = _intersect(a.x, a.z, b.x, b.z, e);
                    if (_inside(ip.x, ip.z)) { result.push(ip); break; }
                }
            }
        }
        // 最后一个点如果在内部，加入
        if (pts.length > 0 && _inside(pts[pts.length-1].x, pts[pts.length-1].z))
            result.push(pts[pts.length-1]);
        return result;
    }

    for (let ri = 0; ri < rivers.length; ri++) {
        const rv = rivers[ri];
        const rawPts = rv.points;
        if (!rawPts || rawPts.length < 2) continue;
        const hw = (rv.width || 12) / 2;
        const waterLevel = rv.waterLevel != null ? rv.waterLevel : -1;
        const segWaterLevels = rv.waterLevels || null;
        const depth = rv.depth || 5;

        // 1. 裁剪到地图边界内（保留入口/出口交点，废掉界外部分）
        const inBounds = _clipPathToRect(rawPts, -clipX, clipX, -clipZ, clipZ);
        if (inBounds.length < 2) continue;
        const subdivided = subdivideSharpCorners(inBounds, 20);
        let pts = _smoothPathCR(subdivided, 0.5);
        // 再次去重（CR 插值可能在边界产生密集重合点）
        pts = pts.filter((p, i) => i === 0 || Math.hypot(p.x - pts[i-1].x, p.z - pts[i-1].z) > 0.05);
        if (pts.length < 2) continue;

        // 2. 计算切线 + effHw 弯道缩窄（cos(θ/2)，防止内侧 bank 交叉重叠）
        const tangents = [];
        const hwScales = []; // 每顶点的有效半宽缩放因子
        for (let i = 0; i < pts.length; i++) {
            const p = pts[i]; let dx, dz, hwScale = 1;
            if (i === 0) { dx = pts[i+1].x - p.x; dz = pts[i+1].z - p.z; }
            else if (i === pts.length - 1) { dx = p.x - pts[i-1].x; dz = p.z - pts[i-1].z; }
            else {
                const di = { x: p.x - pts[i-1].x, z: p.z - pts[i-1].z }, lnI = Math.hypot(di.x, di.z) || 1;
                const dO = { x: pts[i+1].x - p.x, z: pts[i+1].z - p.z }, lnO = Math.hypot(dO.x, dO.z) || 1;
                const uix = di.x / lnI, uiz = di.z / lnI, uox = dO.x / lnO, uoz = dO.z / lnO;
                dx = uix + uox; dz = uiz + uoz;
                // effHw = hw * cos(θ/2) = hw * sqrt((1+dot)/2)
                const dotEdges = uix * uox + uiz * uoz;
                hwScale = Math.sqrt(Math.max(0.01, (1 + dotEdges) / 2));
            }
            const len = Math.hypot(dx, dz) || 1;
            tangents.push({ dx: dx / len, dz: dz / len });
            hwScales.push(hwScale);
        }

        // 3. 构建 per-vertex water level（支持分段水位）
        const ptWaterLevels = [];
        const totalSegs = inBounds.length - 1;
        for (let i = 0; i < pts.length; i++) {
            // 查找 pts[i] 在 inBounds 中的最近段
            let minD = Infinity, bestWL = waterLevel;
            for (let si = 0; si < totalSegs; si++) {
                const d = _pointToSegDist2D(pts[i].x, pts[i].z, inBounds[si].x, inBounds[si].z, inBounds[si+1].x, inBounds[si+1].z);
                if (d < minD) {
                    minD = d;
                    if (segWaterLevels) { const wi = Math.min(si, segWaterLevels.length - 1); if (segWaterLevels[wi] != null) bestWL = segWaterLevels[wi]; }
                }
            }
            ptWaterLevels.push(bestWL);
        }

        // 4. 逐段 quad（每段用自身垂线，0.5m 密集采样使段间间隙肉眼不可见）
        const verts = [];
        const indices = [];
        for (let i = 0; i < pts.length - 1; i++) {
            const dx = pts[i+1].x - pts[i].x, dz = pts[i+1].z - pts[i].z;
            const segLen = Math.hypot(dx, dz) || 1;
            const snx = -dz / segLen, snz = dx / segLen;
            // effHw 弯道缩窄：取两端缩放因子的较小值
            const s0 = hwScales[i], s1 = hwScales[i+1];
            const hw0 = hw * Math.min(s0, s1), hw1 = hw * Math.min(s0, s1);
            const wl0 = ptWaterLevels[i], wl1 = ptWaterLevels[i+1];
            const r0x = pts[i].x + snx * hw0, r0z = pts[i].z + snz * hw0;
            const l0x = pts[i].x - snx * hw0, l0z = pts[i].z - snz * hw0;
            const r1x = pts[i+1].x + snx * hw1, r1z = pts[i+1].z + snz * hw1;
            const l1x = pts[i+1].x - snx * hw1, l1z = pts[i+1].z - snz * hw1;
            verts.push(r0x, wl0, r0z, l0x, wl0, l0z, r1x, wl1, r1z, l1x, wl1, l1z);
            const a = i * 4;
            indices.push(a, a+2, a+1, a+1, a+2, a+3);
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
        geo.setIndex(indices);
        geo.computeVertexNormals();

        const mat = new THREE.MeshStandardMaterial({
            color: '#3388bb', roughness: 0.12, metalness: 0.05,
            transparent: true, opacity: 0.6, depthWrite: false,
            side: THREE.DoubleSide,
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.name = 'riverWater';
        mesh.receiveShadow = true;
        scene.add(mesh);
        riverWaterMeshes.push(mesh);

        // 5. 碰撞体（半径=河半宽，间距保证不粘连）
        const colliderRadius = hw;
        const TANK_HALF = typeof TANK_HALF_W !== 'undefined' ? TANK_HALF_W : 2;
        const COLLIDER_SPACING = Math.max(10, colliderRadius + TANK_HALF + 2);
        let distAccum = 0;
        for (let i = 0; i < pts.length; i++) {
            if (i > 0) distAccum += Math.hypot(pts[i].x - pts[i-1].x, pts[i].z - pts[i-1].z);
            if (i === 0 || distAccum >= COLLIDER_SPACING) {
                distAccum = 0;
                if (!_isUnderAnyBridge(pts[i].x, pts[i].z)) {
                    riverColliders.push({ x: pts[i].x, z: pts[i].z, radius: colliderRadius });
                }
            }
        }
        // 确保最后一个点也有碰撞体
        const lastP = pts[pts.length - 1];
        if (!_isUnderAnyBridge(lastP.x, lastP.z)) {
            riverColliders.push({ x: lastP.x, z: lastP.z, radius: colliderRadius });
        }
    }
    // 向后兼容：保留第一个 mesh 引用到 riverWater
    if (riverWaterMeshes.length > 0) riverWater = riverWaterMeshes[0];
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
    // 河流水面流动波动（所有河流）
    const allRiverMeshes = scene.children.filter(c => c.name === 'riverWater' && c.geometry && c.geometry.attributes.position);
    const t = Date.now() * 0.002;
    for (const mesh of allRiverMeshes) {
        const rpos = mesh.geometry.attributes.position;
        if (!rpos || rpos.count === 0) continue;
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
    // 清理所有河流水面
    const allRiverMeshes = scene.children.filter(c => c.name === 'riverWater');
    for (const m of allRiverMeshes) {
        scene.remove(m);
        if (m.geometry) m.geometry.dispose();
        if (m.material) m.material.dispose();
    }
    riverWater = null;
    riverWaterMeshes = [];
    riverColliders = [];
}
