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
    if (!_getRiver()) return false;
    const margin = TANK_HALF_W + 0.3;
    const rzc = riverCenterZ(x), rhw = riverHalfWidth(x) + margin;
    return Math.abs(z - rzc) < rhw;
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
    const river = _getRiver();
    const rvPts = currentMapData && currentMapData.terrain ? currentMapData.terrain.riverPoints : null;

    if (!river && !rvPts) return;

    if (rvPts && rvPts.length >= 2) {
        // 编辑器河流：裁剪路径到世界边界内
        const clipX = typeof worldHalfW !== 'undefined' ? worldHalfW : 150;
        const clipZ = typeof worldHalfD !== 'undefined' ? worldHalfD : 150;
        function _clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
        // 裁剪每个路径点
        const clipped = [];
        for (let k = 0; k < rvPts.length; k++) {
            const cx = _clamp(rvPts[k].x, -clipX, clipX);
            const cz = _clamp(rvPts[k].z, -clipZ, clipZ);
            // 跳过与前一点重合的点
            if (clipped.length > 0) {
                const prev = clipped[clipped.length - 1];
                if (Math.hypot(cx - prev.x, cz - prev.z) < 0.01) continue;
            }
            clipped.push({ x: cx, z: cz });
        }
        if (clipped.length < 2) return; // 裁剪后不足2点，无河流
        // 线性插值路径（每 0.5m 一个采样点）
        const md = currentMapData;
        const segWaterLevels = md.terrain.riverWaterLevels || null;
        const totalSegs = clipped.length - 1;
        const pts = [];
        const ptWaterLevels = [];
        const DENSE = 0.5;
        for (let i = 0; i < totalSegs; i++) {
            const a = clipped[i], b = clipped[i+1];
            const segLen = Math.hypot(b.x - a.x, b.z - a.z);
            const step = Math.max(1, Math.ceil(segLen / DENSE));
            const wlIdx = segWaterLevels ? Math.min(i, segWaterLevels.length - 1) : -1;
            const wl = wlIdx >= 0 ? segWaterLevels[wlIdx] : null;
            for (let j = (i === 0 ? 0 : 1); j < step; j++) {
                const t = j / step;
                pts.push({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t });
                ptWaterLevels.push(wl);
            }
        }
        pts.push(clipped[clipped.length - 1]);
        ptWaterLevels.push(segWaterLevels ? segWaterLevels[segWaterLevels.length - 1] : null);

        const riverWidth = md.terrain.riverWidth || 10;
        const hw = riverWidth * 0.5;

        let fallbackWaterY;
        if (md.terrain.riverWaterLevel !== undefined) {
            fallbackWaterY = md.terrain.riverWaterLevel;
            console.log('🌊 编辑器河流水面: 蓝图全局水位=' + fallbackWaterY.toFixed(2));
        } else {
            let sumH = 0, minH = Infinity;
            for (const p of pts) {
                const th = getTerrainHeight(p.x, p.z);
                sumH += th;
                if (th < minH) minH = th;
            }
            const waterBase = (sumH / pts.length) - 0.6;
            fallbackWaterY = Math.min(waterBase, minH + 0.3);
            console.log('🌊 编辑器河流水面: 平均地形=' + (sumH/pts.length).toFixed(2) + ' 最低=' + minH.toFixed(2) + ' → waterY=' + fallbackWaterY.toFixed(2));
        }

        if (segWaterLevels && segWaterLevels.length > 0) {
            console.log('🌊 编辑河流: ' + segWaterLevels.length + '段 水位' +
                segWaterLevels[0].toFixed(2) + '~' + segWaterLevels[segWaterLevels.length-1].toFixed(2) +
                ' 宽' + riverWidth.toFixed(0) + 'm');
        }

        // ── 闭合多边形三角化：右岸+左岸 → ShapeGeometry ──
        // 1. 计算切向
        const tangents = [];
        for (let i = 0; i < pts.length; i++) {
            const p = pts[i]; let dx, dz;
            if (i === 0) { dx = pts[i+1].x - p.x; dz = pts[i+1].z - p.z; }
            else if (i === pts.length-1) { dx = p.x - pts[i-1].x; dz = p.z - pts[i-1].z; }
            else {
                const di = {x: p.x-pts[i-1].x, z: p.z-pts[i-1].z}, lnI = Math.hypot(di.x,di.z)||1;
                const dO = {x: pts[i+1].x-p.x, z: pts[i+1].z-p.z}, lnO = Math.hypot(dO.x,dO.z)||1;
                dx = di.x/lnI + dO.x/lnO; dz = di.z/lnI + dO.z/lnO;
            }
            const len = Math.hypot(dx, dz) || 1;
            tangents.push({ dx: dx/len, dz: dz/len });
        }
        // 2. 构建 Shape（右岸→左岸围成闭合多边形），裁剪到世界边界
        const shape = new THREE.Shape();
        let prevRX = null, prevRZ = null;
        for (let i = 0; i < pts.length; i++) {
            const t = tangents[i];
            const nx = -t.dz * hw, nz = t.dx * hw;
            const rx = _clamp(pts[i].x + nx, -clipX, clipX);
            const rz = _clamp(pts[i].z + nz, -clipZ, clipZ);
            if (prevRX === null || Math.hypot(rx - prevRX, rz - prevRZ) > 0.01) {
                if (prevRX === null) shape.moveTo(rx, rz);
                else shape.lineTo(rx, rz);
                prevRX = rx; prevRZ = rz;
            }
        }
        for (let i = pts.length - 1; i >= 0; i--) {
            const t = tangents[i];
            const nx = -t.dz * hw, nz = t.dx * hw;
            const lx = _clamp(pts[i].x - nx, -clipX, clipX);
            const lz = _clamp(pts[i].z - nz, -clipZ, clipZ);
            if (Math.hypot(lx - prevRX, lz - prevRZ) > 0.01) {
                shape.lineTo(lx, lz);
                prevRX = lx; prevRZ = lz;
            }
        }
        shape.closePath();
        // 3. ShapeGeometry 自动三角化
        const shapeGeo = new THREE.ShapeGeometry(shape, 32);
        // 4. 位移动顶点 Y 到水位高度（ShapeGeometry 在 XY 平面）
        const spos = shapeGeo.attributes.position;
        const v3Temp = new THREE.Vector3();
        for (let vi = 0; vi < spos.count; vi++) {
            v3Temp.fromBufferAttribute(spos, vi);
            const sx = v3Temp.x, sy = v3Temp.y;
            let minD = Infinity, bestWL = fallbackWaterY;
            for (let pi = 0; pi < pts.length; pi++) {
                const d = (sx - pts[pi].x) ** 2 + (sy - pts[pi].z) ** 2;
                if (d < minD) { minD = d; bestWL = ptWaterLevels[pi] !== null ? ptWaterLevels[pi] : fallbackWaterY; }
            }
            spos.setXYZ(vi, sx, bestWL, sy);
        }
        shapeGeo.computeVertexNormals();
        console.log('🌊 编辑器河流: ShapeGeometry ' + (spos.count) + ' 顶点, 宽' + riverWidth.toFixed(0) + 'm');
        const mat = new THREE.MeshStandardMaterial({
            color: '#3388bb', roughness: 0.12, metalness: 0.05,
            transparent: true, opacity: 0.6, depthWrite: false,
            side: THREE.DoubleSide,
        });
        riverWater = new THREE.Mesh(shapeGeo, mat);
        riverWater.name = 'riverWater';
        riverWater.receiveShadow = true;
        scene.add(riverWater);
        // 沿河流路径生成碰撞体
        const colliderRadius = hw + 0.5;
        const colliderStep = Math.max(1, Math.floor(pts.length / 35));
        for (let i = 0; i < pts.length; i += colliderStep) {
            if (_isUnderAnyBridge(pts[i].x, pts[i].z)) continue;
            riverColliders.push({ x: pts[i].x, z: pts[i].z, radius: colliderRadius });
        }
        return;
    }

    if (!river) return;

    // 参数化河流（01a 等地图）
    const segs = 200;
    const is02a = (typeof selectedMapId !== 'undefined' && selectedMapId === 'test_map_02a');
    const len = is02a ? (currentMapData ? currentMapData.playWidth : 200) : Math.max(worldHalfW, worldHalfD) * 2;
    const half = len / 2;
    const verts = [];
    const indices = [];
    for (let i = 0; i <= segs; i++) {
        const x = -half + i * len / segs;
        const zc = riverCenterZ(x), hw = riverHalfWidth(x) - 0.5;
        verts.push(x, RIVER_WATER_LEVEL, zc + hw);
        verts.push(x, RIVER_WATER_LEVEL, zc - hw);
    }
    for (let i = 0; i < segs; i++) {
        const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
        indices.push(a, c, b, b, c, d);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({
        color: '#3388bb', roughness: 0.12, metalness: 0.05,
        transparent: true, opacity: 0.6, depthWrite: true,
    });
    riverWater = new THREE.Mesh(geo, mat);
    riverWater.name = 'riverWater';
    riverWater.receiveShadow = true;
    scene.add(riverWater);

    // 参数化河流碰撞体（防止坦克驶入）
    const avgHw = (river.hwBase + river.hwVar * 0.5) || 6.25;
    const pColliderRadius = avgHw + 0.5;
    const pColliderStep = Math.max(1, Math.floor(segs / 20));
    for (let i = 0; i <= segs; i += pColliderStep) {
        const px = -half + i * len / segs;
        const pz = riverCenterZ(px);
        if (_isUnderAnyBridge(px, pz)) continue;
        riverColliders.push({ x: px, z: pz, radius: pColliderRadius });
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
    if (riverWater) {
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
        riverWater.geometry.dispose();
        riverWater.material.dispose();
        riverWater = null;
    }
    riverColliders = [];
}
