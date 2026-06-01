// ==================== js/editor_terrainGen.js — 地形生成系统 ====================
// 依赖: mapData, hmResW/D, hmStepW/D, worldHalfW/D, worldWidth/Depth, scene, pushSnapshot
// 提供: randomGenerateTerrain, randomGenerateVillage, flattenTerrain, isPointInWater, drawRoadLine

// --- 噪声基础 ---
function hash(x,y){let h=x*374761393+y*668265263+1274126177;h=((h>>13)^h)*0x5bd1e995;return(h^(h>>15))&0xffff;}
function noise2D(x,z,s){const n=Math.sin(x*12.9898+z*78.233+s)*43758.5453;return n-Math.floor(n);}
function smoothNoise(x,z,s){const ix=Math.floor(x),iz=Math.floor(z);const fx=x-ix,fz=z-iz;const sx=fx*fx*(3-2*fx),sz=fz*fz*(3-2*fz);const a=noise2D(ix,iz,s)+(noise2D(ix+1,iz,s)-noise2D(ix,iz,s))*sx;const b=noise2D(ix,iz+1,s)+(noise2D(ix+1,iz+1,s)-noise2D(ix,iz+1,s))*sx;return a+(b-a)*sz;}


// --- 坐标转换 ---
function w2i(wx,wz){const u=(wx+worldHalfW)/worldWidth,v=(wz+worldHalfD)/worldDepth;if(u<0||u>1||v<0||v>1)return-1;const sx=Math.round(u*(hmResW-1)),sy=Math.round(v*(hmResD-1));return sy*hmResW+sx;}
function smpHeight(wx,wz){const i=w2i(wx,wz);return i>=0?mapData.heightmap[i]:0;}


// --- 世界坐标→高度图像素 + CatmullRom插值 ---
function world2sm(wx, wz) {
    const sx = Math.round((wx + worldHalfW) / worldWidth * (hmResW - 1));
    const sy = Math.round((wz + worldHalfD) / worldDepth * (hmResD - 1));
    return { sx: Math.max(0, Math.min(hmResW - 1, sx)), sy: Math.max(0, Math.min(hmResD - 1, sy)) };
}

// ----- CatmullRom 曲线插值（河流轨迹平滑）-----
function catmullRomInterpolate(p0, p1, p2, p3, t) {
    const t2 = t * t, t3 = t2 * t;
    return {
        x: 0.5 * ((2*p1.x) + (-p0.x+p2.x)*t + (2*p0.x-5*p1.x+4*p2.x-p3.x)*t2 + (-p0.x+3*p1.x-3*p2.x+p3.x)*t3),
        z: 0.5 * ((2*p1.z) + (-p0.z+p2.z)*t + (2*p0.z-5*p1.z+4*p2.z-p3.z)*t2 + (-p0.z+3*p1.z-3*p2.z+p3.z)*t3)
    };
}

// 沿轨迹做 CatmullRom 平滑采样，间距 ~2 世界单位
function samplePathSmooth(points) {
    if (points.length < 2) return points;
    const samples = [points[0]];
    for (let i = 0; i < points.length - 1; i++) {
        const p0 = points[Math.max(0, i - 1)];
        const p1 = points[i];
        const p2 = points[i + 1];
        const p3 = points[Math.min(points.length - 1, i + 2)];
        const segLen = Math.hypot(p2.x - p1.x, p2.z - p1.z);
        const steps = Math.max(1, Math.round(segLen / 2)); // 每 ~2m 一个采样点
        for (let j = 1; j < steps; j++) {
            samples.push(catmullRomInterpolate(p0, p1, p2, p3, j / steps));
        }
        samples.push(p2);
    }
    return samples;
}

// 高密度 CatmullRom 采样（道路平滑，间距可调）
function samplePathSmoothDense(points, spacing) {
    if (points.length < 2) return points;
    const sp = spacing || 1.0;
    const samples = [points[0]];
    for (let i = 0; i < points.length - 1; i++) {
        const p0 = points[Math.max(0, i - 1)];
        const p1 = points[i];
        const p2 = points[i + 1];
        const p3 = points[Math.min(points.length - 1, i + 2)];
        const segLen = Math.hypot(p2.x - p1.x, p2.z - p1.z);
        const steps = Math.max(1, Math.round(segLen / sp));
        for (let j = 1; j < steps; j++) {
            samples.push(catmullRomInterpolate(p0, p1, p2, p3, j / steps));
        }
        samples.push(p2);
    }
    return samples;
}

// 贝塞尔预平滑：在折角 > maxAngle 处插入二次贝塞尔插值点，消除尖锐转角
function subdivideSharpCorners(pts, maxAngle = 45) {
    if (pts.length < 3) return [...pts];
    const result = [pts[0]];
    for (let i = 1; i < pts.length - 1; i++) {
        const dxIn = pts[i].x - pts[i-1].x, dzIn = pts[i].z - pts[i-1].z;
        const dxOut = pts[i+1].x - pts[i].x, dzOut = pts[i+1].z - pts[i].z;
        const lenIn = Math.hypot(dxIn, dzIn) || 1;
        const lenOut = Math.hypot(dxOut, dzOut) || 1;
        const dot = (dxIn*dxOut + dzIn*dzOut) / (lenIn*lenOut);
        const angle = Math.acos(Math.max(-1, Math.min(1, dot))) * 180 / Math.PI;
        if (angle > maxAngle) {
            const n = Math.ceil(angle / 20);  // 每20°插入一个点
            for (let j = 1; j <= n; j++) {
                const t = j / (n + 1);
                // 二次贝塞尔：B(t) = (1-t)²p0 + 2(1-t)t·p1 + t²p2
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

// 点到线段的最短距离（2D，仅 xz 平面）
function pointToSegmentDist(px, pz, ax, az, bx, bz) {
    const dx = bx - ax, dz = bz - az;
    const lenSq = dx * dx + dz * dz;
    if (lenSq < 1e-9) return Math.hypot(px - ax, pz - az); // 退化为点
    let t = ((px - ax) * dx + (pz - az) * dz) / lenSq;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (ax + t * dx), pz - (az + t * dz));
}


// --- FBM噪声 + SplatMap道路绘制 ---
// FBM噪声生成器（归一化 0~1）
function fbm(x, z, seed, octaves, scale) {
    let val = 0, amp = 1, freq = 1, maxAmp = 0;
    for (let o = 0; o < octaves; o++) {
        val += smoothNoise(x / scale * freq, z / scale * freq, seed + o * 137) * amp;
        maxAmp += amp;
        amp *= 0.5; freq *= 2.0;
    }
    return val / maxAmp;
}

// ----- 道路/广场 splatMap 绘制工具 -----
// 在 splatMap 上画圆形贴图（用于广场、绿化带等）
function drawCircleSplat(wx, wz, radius, texType) {
    const rPxX = radius / hmStepW, rPxZ = radius / hmStepD;
    const { sx: sxC, sy: syC } = world2sm(wx, wz);
    const rPxWi = Math.ceil(rPxX), rPxZi = Math.ceil(rPxZ);
    for (let dy = -rPxZi; dy <= rPxZi; dy++) {
        for (let dx = -rPxWi; dx <= rPxWi; dx++) {
            const wDist = Math.sqrt(dx*dx*hmStepW*hmStepW + dy*dy*hmStepD*hmStepD);
            if (wDist > radius) continue;
            const sx2 = sxC + dx, sy2 = syC + dy;
            if (sx2 < 0 || sx2 >= hmResW || sy2 < 0 || sy2 >= hmResD) continue;
            if (!mapData.editedVerticesPaint.has(sx2 + ',' + sy2)) {
                mapData.splatMap[sy2 * hmResW + sx2] = texType;
            }
        }
    }
}

// 在 splatMap 上画粗道路线（默认柏油=4），smoothstep 边缘羽化
function drawRoadLine(x1, z1, x2, z2, width, texType) {
    const tt = texType != null ? texType : 4;
    const hw = width / 2;
    const avgStep = Math.sqrt(hmStepW * hmStepD);
    const rPxApprox = hw / avgStep;
    const { sx: sx1, sy: sy1 } = world2sm(x1, z1);
    const { sx: sx2, sy: sy2 } = world2sm(x2, z2);
    const dx = sx2 - sx1, dy = sy2 - sy1;
    const len = Math.hypot(dx, dy);
    if (len < 1) return;
    const ux = dx / len, uy = dy / len;
    const rPxI = Math.ceil(rPxApprox);
    const hw2 = hw * hw;
    const minSx = Math.max(0, Math.floor(Math.min(sx1, sx2) - rPxI - 1));
    const maxSx = Math.min(hmResW - 1, Math.ceil(Math.max(sx1, sx2) + rPxI + 1));
    const minSy = Math.max(0, Math.floor(Math.min(sy1, sy2) - rPxI - 1));
    const maxSy = Math.min(hmResD - 1, Math.ceil(Math.max(sy1, sy2) + rPxI + 1));
    for (let sy = minSy; sy <= maxSy; sy++) {
        for (let sx = minSx; sx <= maxSx; sx++) {
            if (mapData.editedVerticesPaint.has(sx + ',' + sy)) continue;
            const vx = sx - sx1, vy = sy - sy1;
            let proj = vx * ux + vy * uy;
            proj = Math.max(0, Math.min(len, proj));
            const cx = sx1 + ux * proj, cy = sy1 + uy * proj;
            const wdx = (sx - cx) * hmStepW, wdz = (sy - cy) * hmStepD;
            const wDist2 = wdx * wdx + wdz * wdz;
            if (wDist2 < hw2) {
                const dist = Math.sqrt(wDist2) / hw;
                // smoothstep羽化：0~0.65纯色，0.65~1.0渐变过渡（无随机噪声）
                if (dist < 0.65) {
                    mapData.splatMap[sy * hmResW + sx] = tt;
                } else if (dist < 1.0) {
                    const t = (1.0 - dist) / 0.35;
                    mapData.splatMap[sy * hmResW + sx] = tt;
                }
            }
        }
    }
}

// --- 随机地形生成 + A*道路 + 村落 + 平整 ---

// --- 地形生成（清空全部，重建地貌+池塘）---
function randomGenerateTerrain() {
    const cfg = {
        maxH: parseFloat(document.getElementById('rg-maxh').value),
        ptch: parseFloat(document.getElementById('rg-ptch').value),
        hills: parseInt(document.getElementById('rg-hills').value),
        octaves: parseInt(document.getElementById('rg-octaves').value),
        moist: parseInt(document.getElementById('rg-moist').value) / 100,
        sandLvl: parseInt(document.getElementById('rg-sandlvl').value) / 100,
        mudLvl: parseInt(document.getElementById('rg-mudlvl').value) / 100,
        ponds: parseInt(document.getElementById('rg-ponds').value),
        pondMaxR: parseFloat(document.getElementById('rg-pondr').value),
        pondMaxD: parseFloat(document.getElementById('rg-pondd').value),
    };
    
    // 清空全部
    mapData.heightmap.fill(0); mapData.splatMap.fill(0);
    Object.values(entityMarkers).forEach(m => { scene.remove(m); disposeGroup(m); });
    Object.keys(entityMarkers).forEach(k => delete entityMarkers[k]);
    Object.values(patrolLines).forEach(l => { scene.remove(l); l.geometry.dispose(); l.material.dispose(); });
    Object.keys(patrolLines).forEach(k => delete patrolLines[k]);
    Object.values(bridgeMeshes).forEach(m => { scene.remove(m); m.traverse(c => { if(c.geometry)c.geometry.dispose(); if(c.material)c.material.dispose(); }); });
    Object.keys(bridgeMeshes).forEach(k => delete bridgeMeshes[k]);
    mapData.entities = []; mapData.groups = []; selectedEntityIds.clear(); entityIdCounter = 1;
    mapData.waters = []; mapData.bridges = [];
    mapData.editedVerticesPaint = new Set();
    
    const baseSeed = Math.random() * 10000;
    const seedE = baseSeed, seedM = baseSeed + 2718;
    
    // 阶段1-2: FBM高程 + 湿度
    const elevRaw = new Float32Array(hmResW * hmResD);
    const moistRaw = new Float32Array(hmResW * hmResD);
    for (let sy = 0; sy < hmResD; sy++) {
        for (let sx = 0; sx < hmResW; sx++) {
            const wx = (sx / (hmResD - 1) - 0.5) * worldWidth;
            const wz = (sy / (hmResD - 1) - 0.5) * worldDepth;
            elevRaw[sy * hmResW + sx] = fbm(wx, wz, seedE, cfg.octaves, cfg.ptch);
            moistRaw[sy * hmResW + sx] = fbm(wx + 50, wz + 50, seedM, cfg.octaves, cfg.ptch * 1.3);
        }
    }
    for (let i = 0; i < elevRaw.length; i++) {
        elevRaw[i] = Math.pow(Math.max(0, elevRaw[i]), 1.8);
        moistRaw[i] = Math.max(0, Math.min(1, moistRaw[i] * 1.2 - 0.1 + cfg.moist));
    }
    
    // 高程→高度图
    for (let sy = 0; sy < hmResD; sy++) {
        for (let sx = 0; sx < hmResW; sx++) {
            const e = elevRaw[sy * hmResW + sx];
            mapData.heightmap[sy * hmResW + sx] = (e - 0.45) * cfg.maxH;
        }
    }
    
    // 山丘
    for (let i = 0; i < cfg.hills; i++) {
        const cx = (Math.random() - 0.5) * worldWidth * 0.7;
        const cz = (Math.random() - 0.5) * worldDepth * 0.7;
        const rx = 6 + Math.random() * 14, rz = 6 + Math.random() * 14;
        const peak = cfg.maxH * (0.25 + Math.random() * 0.55);
        const rPxW = Math.max(rx, rz) / Math.max(worldWidth, worldDepth) * Math.max(hmResW, hmResD);
        const { sx: sxC, sy: syC } = world2sm(cx, cz);
        const rPx = Math.ceil(rPxW), r2 = rPxW * rPxW;
        for (let dy = -rPx; dy <= rPx; dy++) {
            for (let dx = -rPx; dx <= rPx; dx++) {
                const sx2 = sxC + dx, sy2 = syC + dy;
                if (sx2 < 0 || sx2 >= hmResW || sy2 < 0 || sy2 >= hmResD) continue;
                const wx2 = (sx2 / (hmResD - 1) - 0.5) * worldWidth;
                const wz2 = (sy2 / (hmResD - 1) - 0.5) * worldDepth;
                const d2 = ((wx2 - cx) / rx) ** 2 + ((wz2 - cz) / rz) ** 2;
                if (d2 < 4) mapData.heightmap[sy2 * hmResW + sx2] += peak * Math.exp(-d2);
            }
        }
    }
    
    // Biome分区
    for (let sy = 0; sy < hmResD; sy++) {
        for (let sx = 0; sx < hmResW; sx++) {
            const idx = sy * hmResW + sx;
            const e = elevRaw[idx], m = moistRaw[idx];
            if (m > cfg.mudLvl && e < cfg.sandLvl) mapData.splatMap[idx] = 1;
            else if (m < 0.35 && e > cfg.sandLvl) mapData.splatMap[idx] = 2;
            else mapData.splatMap[idx] = 0;
        }
    }
    
    // 池塘
    const pondCenters = [];
    for (let i = 0; i < cfg.ponds; i++) {
        let px, pz, valid = false;
        for (let attempt = 0; attempt < 25; attempt++) {
            px = (Math.random() - 0.5) * worldWidth * 0.65;
            pz = (Math.random() - 0.5) * worldDepth * 0.65;
            if (Math.abs(px) < 25 && Math.abs(pz) < 25) continue;
            let tooClose = false;
            for (const pc of pondCenters) {
                if (Math.hypot(px - pc.x, pz - pc.z) < cfg.pondMaxR * 2.5) { tooClose = true; break; }
            }
            if (!tooClose) { valid = true; break; }
        }
        if (!valid) continue;
        const r = 4 + Math.random() * (cfg.pondMaxR - 4);
        const depth = 0.5 + Math.random() * (cfg.pondMaxD - 0.5);
        // 池塘水位 = 中心点原始地形高度（平坦水面基准）
        const waterLevel = smpHeight(px, pz);
        pondCenters.push({ x: px, z: pz, r, depth });
        const rPxX = r / hmStepW, rPxZ = r / hmStepD;
        const { sx: cx, sy: cy } = world2sm(px, pz);
        const rPxWin = Math.ceil(rPxX), rPxZin = Math.ceil(rPxZ);
        for (let dy = -rPxZin; dy <= rPxZin; dy++) {
            for (let dx = -rPxWin; dx <= rPxWin; dx++) {
                const wDist = Math.sqrt(dx*dx*hmStepW*hmStepW + dy*dy*hmStepD*hmStepD);
                if (wDist > r) continue;
                const sx2 = cx + dx, sy2 = cy + dy;
                if (sx2 < 0 || sx2 >= hmResW || sy2 < 0 || sy2 >= hmResD) continue;
                const t = 1 - wDist / r;
                const falloff = t * t * (3 - 2 * t);
                const idx = sy2 * hmResW + sx2;
                // 以水位为基准：下陷到 waterLevel - depth*falloff
                // 无条件设置目标高度，确保池塘底部平整（不管原始地形高低）
                const targetH = waterLevel - depth * falloff;
                mapData.heightmap[idx] = targetH;
                if (falloff > 0.08) mapData.splatMap[idx] = 1;
                mapData.editedVerticesPaint.add(sx2 + ',' + sy2);
            }
        }
        mapData.waters.push({ id: 'wr' + i, type: 'pond', center: { x: px, z: pz }, radius: r, waterLevel });
    }
    
    createGround();
    renderHeightmapCanvas();
    refreshWaterList();
    clearUndoStack(); pushSnapshot();
    
    const cnt = [0,0,0,0,0,0];
    for (let i = 0; i < hmResW * hmResD; i++) cnt[mapData.splatMap[i]]++;
    const total = hmResW * hmResD;
    overlayInfo.textContent = '🌍 地形已生成 — 草地'+(cnt[0]/total*100).toFixed(0)+'% 泥地'+(cnt[1]/total*100).toFixed(0)+'% 沙地'+(cnt[2]/total*100).toFixed(0)+'% 池塘'+pondCenters.length;
}

// --- 路径辅助函数（村落生成用）---
function computePathLength(points) {
    let len = 0;
    for (let i = 1; i < points.length; i++) {
        len += Math.hypot(points[i].x - points[i-1].x, points[i].z - points[i-1].z);
    }
    return len;
}

function getPointAtDistance(points, dist) {
    if (points.length < 2) return points[0] || { x: 0, z: 0 };
    if (dist <= 0) return { x: points[0].x, z: points[0].z };
    let remaining = dist;
    for (let i = 1; i < points.length; i++) {
        const segLen = Math.hypot(points[i].x - points[i-1].x, points[i].z - points[i-1].z);
        if (remaining <= segLen) {
            const t = segLen > 0 ? remaining / segLen : 0;
            return { x: points[i-1].x + (points[i].x - points[i-1].x) * t, z: points[i-1].z + (points[i].z - points[i-1].z) * t };
        }
        remaining -= segLen;
    }
    return { x: points[points.length-1].x, z: points[points.length-1].z };
}

function getDirAtDistance(points, dist) {
    let remaining = dist;
    for (let i = 1; i < points.length; i++) {
        const segLen = Math.hypot(points[i].x - points[i-1].x, points[i].z - points[i-1].z);
        if (remaining < segLen || i === points.length - 1) {
            const dx = points[i].x - points[i-1].x, dz = points[i].z - points[i-1].z;
            const len = Math.hypot(dx, dz) || 1;
            return { x: dx / len, z: dz / len };
        }
        remaining -= segLen;
    }
    return { x: 1, z: 0 };
}

function getPerpAtDistance(points, dist) {
    const dir = getDirAtDistance(points, dist);
    return { x: -dir.z, z: dir.x };
}

function isPtInPond(x, z, pondCenters) {
    for (const pc of pondCenters) {
        if (Math.hypot(x - pc.x, z - pc.z) < pc.r + 3) return true;
    }
    // 同时检查河流水体（避免建筑/树木生成到河流中）
    for (const w of mapData.waters) {
        if (w.type !== 'river' || !w.points || w.points.length < 2) continue;
        for (let i = 1; i < w.points.length; i++) {
            const a = w.points[i - 1], b = w.points[i];
            const dx = b.x - a.x, dz = b.z - a.z;
            const len2 = dx * dx + dz * dz;
            if (len2 === 0) continue;
            let t = ((x - a.x) * dx + (z - a.z) * dz) / len2;
            t = Math.max(0, Math.min(1, t));
            const nx = a.x + t * dx, nz = a.z + t * dz;
            if (Math.hypot(x - nx, z - nz) < 7) return true; // 河流半宽~4m + 3m margin
        }
    }
    return false;
}

// 统一水体碰撞检测：同时检查池塘和河流（河流为折线，点到折线最近距离<半宽+margin）
function isPointInWater(x, z, margin = 3) {
    for (const w of mapData.waters) {
        if (w.type === 'pond') {
            const cx = w.center.x, cz = w.center.z, r = w.radius || 8;
            if (Math.hypot(x - cx, z - cz) < r + margin) return true;
        } else if (w.type === 'river' && w.points && w.points.length >= 2) {
            const hw = (w.width || 40) * 0.5 + margin;
            for (let i = 1; i < w.points.length; i++) {
                const a = w.points[i - 1], b = w.points[i];
                const dx = b.x - a.x, dz = b.z - a.z;
                const len2 = dx * dx + dz * dz;
                if (len2 === 0) continue;
                let t = ((x - a.x) * dx + (z - a.z) * dz) / len2;
                t = Math.max(0, Math.min(1, t));
                const nx = a.x + t * dx, nz = a.z + t * dz;
                if (Math.hypot(x - nx, z - nz) < hw) return true;
            }
        }
    }
    return false;
}

// 地形平坦度评分（0=完全平坦，越大越崎岖）
function _roughness(wx, wz, radius) {
    const rPx = Math.ceil(radius / hmStepW), rPz = Math.ceil(radius / hmStepD);
    const { sx: sc, sy: sz } = world2sm(wx, wz);
    let sum = 0, count = 0;
    const cx = sc*hmStepW - worldHalfW, cz = sz*hmStepD - worldHalfD;
    for (let dy = -rPz; dy <= rPz; dy++) {
        for (let dx = -rPx; dx <= rPx; dx++) {
            const sx2 = sc + dx, sy2 = sz + dy;
            if (sx2 < 0 || sx2 >= hmResW || sy2 < 0 || sy2 >= hmResD) continue;
            const h = mapData.heightmap[sy2 * hmResW + sx2];
            sum += h; count++;
        }
    }
    if (count < 4) return 0;
    const avg = sum / count;
    let variance = 0;
    for (let dy = -rPz; dy <= rPz; dy++) {
        for (let dx = -rPx; dx <= rPx; dx++) {
            const sx2 = sc + dx, sy2 = sz + dy;
            if (sx2 < 0 || sx2 >= hmResW || sy2 < 0 || sy2 >= hmResD) continue;
            const diff = mapData.heightmap[sy2 * hmResW + sx2] - avg;
            variance += diff * diff;
        }
    }
    return Math.sqrt(variance / (count - 1));
}

// --- 二叉最小堆（A* 用）---
class MinHeap {
    constructor() { this.data = []; }
    push(key, value) {
        this.data.push({ key, value });
        let i = this.data.length - 1;
        while (i > 0) {
            const p = (i - 1) >> 1;
            if (this.data[p].value <= this.data[i].value) break;
            [this.data[p], this.data[i]] = [this.data[i], this.data[p]];
            i = p;
        }
    }
    pop() {
        if (this.data.length === 0) return null;
        const top = this.data[0];
        const last = this.data.pop();
        if (this.data.length > 0) {
            this.data[0] = last;
            let i = 0;
            const n = this.data.length;
            while (true) {
                let smallest = i;
                const l = i * 2 + 1, r = i * 2 + 2;
                if (l < n && this.data[l].value < this.data[smallest].value) smallest = l;
                if (r < n && this.data[r].value < this.data[smallest].value) smallest = r;
                if (smallest === i) break;
                [this.data[i], this.data[smallest]] = [this.data[smallest], this.data[i]];
                i = smallest;
            }
        }
        return top;
    }
    isEmpty() { return this.data.length === 0; }
}

// --- 伪随机哈希（A* 路径多样性）---
function _hashNoise(x, y, seed) {
    let h = seed ^ (x * 374761393 + y * 668265263);
    h = (h ^ (h >>> 13)) * 1274126177;
    h = h ^ (h >>> 16);
    return (h & 0x7FFFFFFF) / 0x7FFFFFFF * 2 - 1; // [-1, 1]
}

// --- 粗网格预计算 ---
function _buildCoarseGrid() {
    const COARSE = 2;
    const cw = Math.max(3, Math.ceil(hmResW / COARSE));
    const cd = Math.max(3, Math.ceil(hmResD / COARSE));
    const sw = hmStepW * COARSE, sd = hmStepD * COARSE;
    const cells = new Array(cw * cd);
    for (let cy = 0; cy < cd; cy++) {
        for (let cx = 0; cx < cw; cx++) {
            const wx = (cx + 0.5) * sw - worldHalfW;
            const wz = (cy + 0.5) * sd - worldHalfD;
            cells[cy * cw + cx] = {
                h: smpHeight(wx, wz),
                rough: _roughness(wx, wz, sw * 0.7),
                inWater: isPointInWater(wx, wz, 0),
                worldX: wx, worldZ: wz
            };
        }
    }
    return { cw, cd, sw, sd, cells };
}

// --- A* 搜索（粗格上 8 方向）---
function _aStarSearch(sx, sz, gx, gz, grid, noiseSeed) {
    const { cw, cd, sw, sd, cells } = grid;
    const worldToCoarse = (wx, wz) => {
        const cx = Math.max(0, Math.min(cw - 1, Math.floor((wx + worldHalfW) / sw)));
        const cy = Math.max(0, Math.min(cd - 1, Math.floor((wz + worldHalfD) / sd)));
        return cy * cw + cx;
    };
    const start = worldToCoarse(sx, sz);
    const goal = worldToCoarse(gx, gz);
    if (start === goal) return [{ x: sx, z: sz }, { x: gx, z: gz }];

    const total = cw * cd;
    const gScore = new Float32Array(total); gScore.fill(1e9);
    const cameFrom = new Int32Array(total); cameFrom.fill(-1);
    const closed = new Uint8Array(total);

    const heuristic = (idx) => {
        const cx = idx % cw, cy = (idx / cw) | 0;
        const dx = cells[goal].worldX - cells[idx].worldX;
        const dz = cells[goal].worldZ - cells[idx].worldZ;
        return Math.hypot(dx, dz);
    };

    gScore[start] = 0;
    const heap = new MinHeap();
    heap.push(start, heuristic(start));

    const NEIGHBORS = [[1,0,1],[-1,0,1],[0,1,1],[0,-1,1],[1,1,1.414],[1,-1,1.414],[-1,1,1.414],[-1,-1,1.414]];

    while (!heap.isEmpty()) {
        const cur = heap.pop();
        const idx = cur.key;
        if (closed[idx]) continue;
        closed[idx] = 1;
        if (idx === goal) break;

        const cx = idx % cw, cy = (idx / cw) | 0;
        const ca = cells[idx];

        for (const [dx, dy, dMul] of NEIGHBORS) {
            const nx = cx + dx, ny = cy + dy;
            if (nx < 0 || nx >= cw || ny < 0 || ny >= cd) continue;
            const ni = ny * cw + nx;
            if (closed[ni]) continue;

            const cb = cells[ni];
            let terrainCost = 0;

            // 粗糙度
            if (cb.rough > 0.6) terrainCost += (cb.rough - 0.6) * 50;
            else terrainCost += cb.rough * 2;

            // 绝对海拔
            const absH = Math.abs(cb.h);
            if (absH > 4) terrainCost += (absH - 4) * 30;

            // 坡度（指数惩罚：陡坡代价远超绕路）
            const edgeDist = sw * dMul;
            const slope = Math.abs(cb.h - ca.h) / edgeDist;
            if (slope >= 0.35) terrainCost += 99999;           // 不可通行
            else if (slope > 0.2) terrainCost += Math.pow((slope - 0.15) * 10, 3);  // 重罚
            else if (slope > 0.08) terrainCost += (slope - 0.08) * 20;               // 轻罚

            // 水体
            if (cb.inWater) terrainCost += 5000;

            // 边界排斥
            const bDist = Math.min(
                worldHalfW - Math.abs(cb.worldX),
                worldHalfD - Math.abs(cb.worldZ)
            );
            if (bDist < 5) terrainCost += (5 - bDist) * 6;

            // 随机扰动
            const noise = _hashNoise(nx, ny, noiseSeed) * 0.2;

            const moveCost = edgeDist * (1.0 + terrainCost + noise);

            const tg = gScore[idx] + moveCost;
            if (tg < gScore[ni]) {
                gScore[ni] = tg;
                cameFrom[ni] = idx;
                heap.push(ni, tg + heuristic(ni) * 0.7);
            }
        }
    }

    if (gScore[goal] >= 1e8) return null;

    const path = [];
    let cur = goal;
    while (cur !== -1) {
        path.push({ x: cells[cur].worldX, z: cells[cur].worldZ });
        cur = cameFrom[cur];
    }
    path.reverse();
    path[0] = { x: sx, z: sz };
    path[path.length - 1] = { x: gx, z: gz };
    return _stringPull(path);
}

// --- String Pulling（拐角消除：直连验证，删冗余点）---
function _stringPull(pts) {
    if (pts.length <= 3) return pts;

    const sampleStep = 1.5; // 每 1.5m 采样一次验证
    const isValid = (x, z) => {
        if (Math.abs(x) > worldHalfW - 3 || Math.abs(z) > worldHalfD - 3) return false;
        if (isPointInWater(x, z, 1)) return false;
        if (Math.abs(smpHeight(x, z)) > 6) return false;
        if (_roughness(x, z, 5) > 0.8) return false;
        return true;
    };

    const result = [pts[0]];
    let anchor = 0;
    while (anchor < pts.length - 1) {
        let farthest = anchor + 1;
        // 从最远的点往前试，找到能直连的最远点
        for (let j = pts.length - 1; j > anchor; j--) {
            const dx = pts[j].x - pts[anchor].x;
            const dz = pts[j].z - pts[anchor].z;
            const dist = Math.hypot(dx, dz);
            const steps = Math.ceil(dist / sampleStep);
            let clear = true;
            for (let s = 1; s < steps; s++) {
                const t = s / steps;
                const sx = pts[anchor].x + dx * t;
                const sz = pts[anchor].z + dz * t;
                if (!isValid(sx, sz)) { clear = false; break; }
            }
            if (clear) { farthest = j; break; }
        }
        result.push(pts[farthest]);
        anchor = farthest;
    }
    return result;
}

// --- 主干道生成（A* 寻路优先，失败回退贪心）---
function generateMainRoad(cfg) {
    // === 随机选路：对角线 / 南北 / 东西 / 自由穿越 ===
    const routeType = Math.floor(Math.random() * 5);
    let sX, sZ, eX, eZ;
    const margin = 5;
    const rw = worldHalfW - margin, rd = worldHalfD - margin;
    if (routeType === 0) { sX=-rw; sZ=-rd; eX=rw; eZ=rd; }
    else if (routeType === 1) { sX=(Math.random()-0.5)*worldWidth; sZ=-rd; eX=(Math.random()-0.5)*worldWidth; eZ=rd; }
    else if (routeType === 2) { sX=-rw; sZ=(Math.random()-0.5)*worldDepth; eX=rw; eZ=(Math.random()-0.5)*worldDepth; }
    else {
        const allEdges = [
            () => ({ x: (Math.random()-0.5)*worldWidth, z: -rd }),
            () => ({ x: (Math.random()-0.5)*worldWidth, z: rd }),
            () => ({ x: -rw, z: (Math.random()-0.5)*worldDepth }),
            () => ({ x: rw, z: (Math.random()-0.5)*worldDepth })
        ];
        const e1 = Math.floor(Math.random() * 4);
        let e2 = Math.floor(Math.random() * 3);
        if (e2 >= e1) e2++;
        const p1 = allEdges[e1]();
        const p2 = allEdges[e2]();
        sX = p1.x; sZ = p1.z; eX = p2.x; eZ = p2.z;
    }

    // === A* 寻路 ===
    const grid = _buildCoarseGrid();
    const noiseSeed = Math.floor(Math.random() * 2147483647);

    // 起止点若在水边，临时清除该格水体标志
    const worldToCoarse = (wx, wz) => {
        const cx = Math.max(0, Math.min(grid.cw - 1, Math.floor((wx + worldHalfW) / grid.sw)));
        const cy = Math.max(0, Math.min(grid.cd - 1, Math.floor((wz + worldHalfD) / grid.sd)));
        return cy * grid.cw + cx;
    };
    const si = worldToCoarse(sX, sZ), gi = worldToCoarse(eX, eZ);
    const siWater = grid.cells[si].inWater, giWater = grid.cells[gi].inWater;
    if (siWater) grid.cells[si].inWater = false;
    if (giWater) grid.cells[gi].inWater = false;

    const path = _aStarSearch(sX, sZ, eX, eZ, grid, noiseSeed);

    // 恢复水体标志
    if (siWater) grid.cells[si].inWater = true;
    if (giWater) grid.cells[gi].inWater = true;

    if (path) return path;

    // 回退：原贪心等高线算法
    console.warn('A* 寻路失败，回退贪心算法');
    return _generateMainRoadGreedy(cfg);
}

// --- 贪心等高线回退（原算法，A* 失败时兜底）---
function _generateMainRoadGreedy(cfg) {
    const pts = [];
    const routeType = Math.floor(Math.random() * 5);
    let sX, sZ, eX, eZ;
    const margin = 5;
    const rw = worldHalfW - margin, rd = worldHalfD - margin;
    if (routeType === 0) { sX=-rw; sZ=-rd; eX=rw; eZ=rd; }
    else if (routeType === 1) { sX=(Math.random()-0.5)*worldWidth; sZ=-rd; eX=(Math.random()-0.5)*worldWidth; eZ=rd; }
    else if (routeType === 2) { sX=-rw; sZ=(Math.random()-0.5)*worldDepth; eX=rw; eZ=(Math.random()-0.5)*worldDepth; }
    else {
        const allEdges = [
            () => ({ x: (Math.random()-0.5)*worldWidth, z: -rd }),
            () => ({ x: (Math.random()-0.5)*worldWidth, z: rd }),
            () => ({ x: -rw, z: (Math.random()-0.5)*worldDepth }),
            () => ({ x: rw, z: (Math.random()-0.5)*worldDepth })
        ];
        const e1 = Math.floor(Math.random() * 4);
        let e2 = Math.floor(Math.random() * 3);
        if (e2 >= e1) e2++;
        const p1 = allEdges[e1]();
        const p2 = allEdges[e2]();
        sX = p1.x; sZ = p1.z; eX = p2.x; eZ = p2.z;
    }
    pts.push({ x: sX, z: sZ });
    const numMid = 2 + cfg.village;
    const dx = eX - sX, dz = eZ - sZ;
    const totalLen = Math.hypot(dx, dz) || 1;
    const ux = dx / totalLen, uz = dz / totalLen;
    for (let i = 1; i <= numMid; i++) {
        const t = i / (numMid + 1);
        const baseX = sX + dx * t, baseZ = sZ + dz * t;
        const perpX = -uz, perpZ = ux;
        const prevH = smpHeight(pts[pts.length-1].x, pts[pts.length-1].z);
        let bestPt = { x: baseX, z: baseZ }, bestDiff = Infinity;
        const searchRange = Math.min(worldWidth, worldDepth) * 0.25;
        for (let c = 0; c < 12; c++) {
            const off = (c / 11 - 0.5) * 2 * searchRange;
            const cx = baseX + perpX * off, cz = baseZ + perpZ * off;
            if (Math.abs(cx) > worldHalfW - 8 || Math.abs(cz) > worldHalfD - 8) continue;
            const h = smpHeight(cx, cz);
            if (Math.abs(h) > 4 || _roughness(cx, cz, 8) > 0.8) continue;
            const diff = Math.abs(h - prevH);
            if (diff < bestDiff) { bestDiff = diff; bestPt = { x: cx, z: cz }; }
        }
        if (bestDiff === Infinity) {
            for (let c = 0; c < 12; c++) {
                const off = (c / 11 - 0.5) * 2 * searchRange;
                const cx = baseX + perpX * off, cz = baseZ + perpZ * off;
                if (Math.abs(cx) > worldHalfW - 8 || Math.abs(cz) > worldHalfD - 8) continue;
                const h = smpHeight(cx, cz);
                if (Math.abs(h) > 7 || _roughness(cx, cz, 8) > 1.5) continue;
                const diff = Math.abs(h - prevH);
                if (diff < bestDiff) { bestDiff = diff; bestPt = { x: cx, z: cz }; }
            }
        }
        if (bestDiff === Infinity) {
            for (let c = 0; c < 12; c++) {
                const off = (c / 11 - 0.5) * 2 * searchRange;
                const cx = baseX + perpX * off, cz = baseZ + perpZ * off;
                if (Math.abs(cx) > worldHalfW - 8 || Math.abs(cz) > worldHalfD - 8) continue;
                const diff = Math.abs(smpHeight(cx, cz) - prevH);
                if (diff < bestDiff) { bestDiff = diff; bestPt = { x: cx, z: cz }; }
            }
        }
        if (bestDiff === Infinity) bestPt = { x: baseX, z: baseZ };
        pts.push(bestPt);
    }
    pts.push({ x: eX, z: eZ });
    return pts;
}

// --- 村路分支生成（从主干道两侧支出，形成树/羽毛状结构）---
function generateBranchRoads(mainSmooth, cfg, pondCenters) {
    const branches = [];
    const mainLen = computePathLength(mainSmooth);
    if (mainLen < 15) return branches;

    // 在主干道上确定村落密集区（小聚落数居中，大聚落数展开）
    // 主路过短或小地图时减少聚落数
    const maxClusters = Math.max(1, Math.floor(mainLen / 20));
    const numClusters = Math.min(Math.max(1, cfg.village), maxClusters);
    const spreadRange = 0.30 + numClusters * 0.08;  // 2聚落→46%, 5聚落→70%
    const tStart = (1 - spreadRange) / 2;
    const clusterCenters = [];
    for (let i = 0; i < numClusters; i++) {
        const t = numClusters === 1 ? 0.5 : (tStart + i * spreadRange / (numClusters - 1));
        // 在主路附近搜寻与主路同海拔的点（等高线法）
        const roadH = smpHeight(mainSmooth[Math.floor(t * (mainSmooth.length-1))].x, mainSmooth[Math.floor(t * (mainSmooth.length-1))].z);
        let bestPt = null, bestDiff = Infinity;
        for (let tryN = 0; tryN < 8; tryN++) {
            const cd = mainLen * t + (Math.random() - 0.5) * mainLen * 0.08;
            const bp = getPointAtDistance(mainSmooth, Math.max(8, Math.min(mainLen - 8, cd)));
            if (!bp) continue;
            if (Math.abs(bp.x) > worldHalfW - 8 || Math.abs(bp.z) > worldHalfD - 8) continue;
            if (isPointInWater(bp.x, bp.z, 5)) continue;
            const diff = Math.abs(smpHeight(bp.x, bp.z) - roadH);
            if (diff < bestDiff) { bestDiff = diff; bestPt = { ...bp, mainDist: Math.max(8, Math.min(mainLen - 8, cd)) }; }
        }
        if (bestPt) clusterCenters.push(bestPt);
    }
    // 过滤掉超出空气墙或在水体中的聚落中心
    const validClusters = clusterCenters.filter(cc =>
        Math.abs(cc.x) <= worldHalfW - 8 && Math.abs(cc.z) <= worldHalfD - 8 &&
        !isPointInWater(cc.x, cc.z, 4)
    );

    // 后备：如果没有有效聚落，强制在主干中点放置一个
    if (validClusters.length === 0 && clusterCenters.length > 0) {
        const mid = getPointAtDistance(mainSmooth, mainLen * 0.5);
        if (mid && Math.abs(mid.x) <= worldHalfW - 5 && Math.abs(mid.z) <= worldHalfD - 5) {
            validClusters.push({ ...mid, mainDist: mainLen * 0.5 });
        }
    }

    // 一个村落 = 一条村路，分支数 = 有效聚落数
    const totalBranches = validClusters.length;
    
    for (let ci = 0; ci < totalBranches; ci++) {
        const cc = validClusters[ci];
        const dist = cc.mainDist + (Math.random() - 0.5) * 6;

        const bp = getPointAtDistance(mainSmooth, Math.max(8, Math.min(mainLen - 8, dist)));
        if (!bp) continue;

        // 村路长度
        const maxBL = Math.min(worldHalfW, worldHalfD) * 0.85;
        const minBL = Math.max(15, maxBL * 0.4);
        const branchLen = minBL + Math.random() * (maxBL - minBL);

        // 选最平坦方向（8个方向，20m外采样，挑高差最小的，过滤山区）
        const refH = smpHeight(bp.x, bp.z);
        let bestAngle = 0, bestDiff = Infinity;
        for (let a = 0; a < 8; a++) {
            const ang = a * Math.PI / 4;
            const tx = bp.x + Math.cos(ang) * 20;
            const tz = bp.z + Math.sin(ang) * 20;
            if (Math.abs(tx) > worldHalfW - 5 || Math.abs(tz) > worldHalfD - 5) continue;
            const h = smpHeight(tx, tz);
            if (Math.abs(h) > 5 || _roughness(tx, tz, 6) > 1.0) continue;
            const diff = Math.abs(h - refH);
            if (diff < bestDiff) { bestDiff = diff; bestAngle = ang; }
        }
        if (bestDiff === Infinity) {
            for (let a = 0; a < 8; a++) {
                const ang = a * Math.PI / 4;
                const tx = bp.x + Math.cos(ang) * 20;
                const tz = bp.z + Math.sin(ang) * 20;
                if (Math.abs(tx) > worldHalfW - 5 || Math.abs(tz) > worldHalfD - 5) continue;
                const diff = Math.abs(smpHeight(tx, tz) - refH);
                if (diff < bestDiff) { bestDiff = diff; bestAngle = ang; }
            }
        }

        // 生成分支路径（沿最平坦方向）
        const branchPts = [{ x: bp.x, z: bp.z }];
        const numSegs = Math.max(2, Math.floor(branchLen / 8));
        const segLen = branchLen / numSegs;
        let cx = bp.x, cz = bp.z;
        const baseAngle = bestAngle;
        
        for (let i = 1; i <= numSegs; i++) {
            // 在前进方向 ±40°内搜索同海拔点
            const curH = smpHeight(cx, cz);
            let bestStep = null, bestHDiff = Infinity;
            for (let s = -3; s <= 3; s++) {
                const ang = baseAngle + s * 0.23; // -40°~+40°
                const tx = cx + Math.cos(ang) * segLen;
                const tz = cz + Math.sin(ang) * segLen;
                if (Math.abs(tx) > worldHalfW - 3 || Math.abs(tz) > worldHalfD - 3) continue;
                if (isPointInWater(tx, tz, 4)) continue;
                const h = smpHeight(tx, tz);
                if (Math.abs(h) > 5 || _roughness(tx, tz, 6) > 1.0) continue;
                const diff = Math.abs(h - curH);
                if (diff < bestHDiff) { bestHDiff = diff; bestStep = { x: tx, z: tz }; }
            }
            if (!bestStep) {
                for (let s = -3; s <= 3; s++) {
                    const ang = baseAngle + s * 0.23;
                    const tx = cx + Math.cos(ang) * segLen;
                    const tz = cz + Math.sin(ang) * segLen;
                    if (Math.abs(tx) > worldHalfW - 3 || Math.abs(tz) > worldHalfD - 3) continue;
                    if (isPointInWater(tx, tz, 4)) continue;
                    const diff = Math.abs(smpHeight(tx, tz) - curH);
                    if (diff < bestHDiff) { bestHDiff = diff; bestStep = { x: tx, z: tz }; }
                }
            }
            if (!bestStep) break;
            cx = bestStep.x; cz = bestStep.z;
            branchPts.push({ x: cx, z: cz });
        }
        
        if (branchPts.length >= 2) {
            branches.push({ points: branchPts, mainDist: dist, side: 0, clusterDist: 0, densityFactor: 1 });
        }
    }
    
    return branches;
}

// 截断路径到指定距离
function _truncatePath(pts, maxDist) {
    if (maxDist <= 0) return pts.slice(0, 1);
    const result = [pts[0]];
    let acc = 0;
    for (let i = 1; i < pts.length; i++) {
        const seg = Math.hypot(pts[i].x - pts[i-1].x, pts[i].z - pts[i-1].z);
        if (acc + seg >= maxDist) {
            const t = (maxDist - acc) / seg;
            result.push({ x: pts[i-1].x + (pts[i].x - pts[i-1].x) * t, z: pts[i-1].z + (pts[i].z - pts[i-1].z) * t });
            return result;
        }
        acc += seg;
        result.push(pts[i]);
    }
    return result;
}

// --- 村落生成：村路尽头→大广场→建筑集群(每5~10栋一组)→水泥连接路 ---
function placeBuildingsAlongRoads(mainSmooth, branches, cfg, pondCenters) {
    const buildings = [];
    const villages = [];  // 返回给 roadSystem
    let placeFails = { boundary: 0, pond: 0, deep: 0, safe: 0, proximity: 0 };
    
    // 检测线段是否穿越河流（采样间隔2m）
    function segmentCrossesWater(x1, z1, x2, z2) {
        const dist = Math.hypot(x2 - x1, z2 - z1);
        const steps = Math.max(2, Math.ceil(dist / 2));
        for (let s = 0; s <= steps; s++) {
            const t = s / steps;
            const sx = x1 + (x2 - x1) * t;
            const sz = z1 + (z2 - z1) * t;
            if (isPointInWater(sx, sz, 2)) return true;
        }
        return false;
    }

    function tryPlaceBuilding(x, z, allBuildings, minDist) {
        if (Math.abs(x) > worldHalfW - 5 || Math.abs(z) > worldHalfD - 5) { placeFails.boundary++; return false; }
        if (isPointInWater(x, z, 3)) { placeFails.pond++; return false; }
        const h = smpHeight(x, z);
        if (h < -8) { placeFails.deep++; return false; }
        if (Math.hypot(x, z) < (cfg.safeR || 15)) { placeFails.safe++; return false; }
        if (_roughness(x, z, 6) > 0.8 || Math.abs(h) > 3) { return false; } // 绝对海拔<3m且局部平坦
        for (const b of allBuildings) {
            if (Math.hypot(x - b.x, z - b.z) < (minDist || 3.5)) { placeFails.proximity++; return false; }
        }
        return true;
    }
    
    let villageCount = 0;
    for (let bi = 0; bi < branches.length; bi++) {
        const branch = branches[bi];
        // 先算出广场位置，再截短支路
        const fullSmooth = samplePathSmoothDense(branch.points, 1.0);
        const branchLen = computePathLength(fullSmooth);
        if (branchLen < 15) { continue; }

        const scaleF = Math.max(0.25, Math.min(1, Math.min(worldHalfW, worldHalfD) / 150));
        const plazaRadius = Math.max(3, (7 + Math.random() * 5) * scaleF);
        const endMargin = Math.min(35, branchLen * 0.25);
        const plazaDist = Math.max(branchLen * 0.5, branchLen - endMargin);
        const roadEndDist = Math.max(0, plazaDist - plazaRadius - 2); // 广场前截断支路
        const endPt = getPointAtDistance(fullSmooth, plazaDist);

        // 截短支路
        branch.points = _truncatePath(branch.points, roadEndDist);
        const branchSmooth = samplePathSmoothDense(branch.points, 1.0);
        if (!endPt) { continue; }
        if (isPointInWater(endPt.x, endPt.z, 3)) { continue; }

        // 广场需离边缘至少留出村落空间
        const plazaMargin = Math.max(8, plazaRadius + Math.max(4, 27 * scaleF));
        if (Math.abs(endPt.x) > worldHalfW - plazaMargin || Math.abs(endPt.z) > worldHalfD - plazaMargin) {
            continue;
        }

        villageCount++;
        const totalBlds = Math.max(4, Math.floor((15 + Math.floor(Math.random() * 16)) * scaleF));

        // 拆分为建筑群：每群3~8栋（随scale缩小）
        const groups = [];
        let remaining = totalBlds;
        while (remaining > 0) {
            const gs = Math.min(remaining, Math.max(2, Math.floor((3 + Math.floor(Math.random() * 4)) * scaleF)));
            groups.push({ size: gs, buildings: [] });
            remaining -= gs;
        }

        const numGroups = groups.length;
        // 分支前进方向（从主路→广场），建筑群只分布在前方半圆内，避免跨越主路
        const outAngle = Math.atan2(endPt.z - fullSmooth[0].z, endPt.x - fullSmooth[0].x);
        const halfSpread = Math.PI / 2; // ±90° 半圆
        let villageBldTotal = 0;
        const villageConnectors = [];

        for (let gi = 0; gi < numGroups; gi++) {
            const t = numGroups > 1 ? gi / (numGroups - 1) : 0.5;
            const baseAngle = outAngle - halfSpread + t * halfSpread * 2 + (Math.random() - 0.5) * 0.2;
            const groupDist = plazaRadius + Math.max(4, (12 + Math.random() * 15) * scaleF);
            
            const gcx = endPt.x + Math.cos(baseAngle) * groupDist;
            const gcz = endPt.z + Math.sin(baseAngle) * groupDist;
            
            // 群中心边界检查（允许在外围区域）
            if (Math.abs(gcx) > worldHalfW - 5 || Math.abs(gcz) > worldHalfD - 5) continue;
            // 群中心与广场之间被河流隔开 → 跳过此群
            if (segmentCrossesWater(endPt.x, endPt.z, gcx, gcz)) continue;
            
            console.log(`      🔍 群${gi+1}: 中心(${gcx.toFixed(1)},${gcz.toFixed(1)}) 目标${groups[gi].size}栋`);
            
            // 在群中心周围放置建筑（全向分布）
            const groupBuildings = [];
            const maxBldDist = Math.max(2, 8 * scaleF);
            for (let attempt = 0; attempt < groups[gi].size * 20 && groupBuildings.length < groups[gi].size; attempt++) {
                const bAngle = Math.random() * Math.PI * 2;
                const bDist = 0.3 + Math.random() * maxBldDist;
                const bx = gcx + Math.cos(bAngle) * bDist;
                const bz = gcz + Math.sin(bAngle) * bDist;

                if (Math.abs(bx) > worldHalfW - 2 || Math.abs(bz) > worldHalfD - 2) { placeFails.boundary++; continue; }
                if (isPointInWater(bx, bz, 1)) { placeFails.pond++; continue; }
                if (smpHeight(bx, bz) < -8) { placeFails.deep++; continue; }
                if (Math.hypot(bx, bz) < (cfg.safeR || 15)) { placeFails.safe++; continue; }
                const crossGroupMin = Math.max(1.5, 5 * scaleF * 0.7);
                const inGroupMin = Math.max(1.0, 3.5 * scaleF * 0.7);
                let tooClose = false;
                for (const b of buildings) {
                    if (Math.hypot(bx - b.x, bz - b.z) < crossGroupMin) { tooClose = true; break; }
                }
                if (tooClose) { placeFails.proximity++; continue; }
                for (const b of groupBuildings) {
                    if (Math.hypot(bx - b.x, bz - b.z) < inGroupMin) { tooClose = true; break; }
                }
                if (tooClose) { placeFails.proximity++; continue; }

                groupBuildings.push({ x: bx, z: bz });
            }

            const minGroupBld = scaleF >= 0.8 ? 3 : 1;  // 小地图允许更少
            if (groupBuildings.length >= minGroupBld) {
                buildings.push(...groupBuildings);
                villageBldTotal += groupBuildings.length;
                groups[gi].buildings = groupBuildings;
                
                // 连接路（仅存数据供 Demo 渲染，不在编辑器写 splatMap）
                const px = endPt.x + Math.cos(baseAngle) * plazaRadius;
                const pz = endPt.z + Math.sin(baseAngle) * plazaRadius;
                villageConnectors.push({ x1: px, z1: pz, x2: gcx, z2: gcz, width: 1.5 });
            }
        }
        
        // 广场由 Demo 端 CircleGeometry 渲染，不在编辑器写 splatMap

        // 只记录成功放置了建筑的村落（小地图阈值降低）
        const minEffBld = scaleF >= 0.8 ? 3 : 1;
        const effectiveGroups = groups.filter(g => g.buildings.length >= minEffBld);
        if (effectiveGroups.length > 0) {
            villages.push({
                plazaX: endPt.x, plazaZ: endPt.z,
                plazaRadius: plazaRadius,
                buildings: buildings.slice(-villageBldTotal).map(b => ({ x: b.x, z: b.z, angle: 0 })),
                connectors: villageConnectors
            });
        }
    }
    
    return { buildings, villages };
}


// --- 村落生成（树状道路结构：主干道→村路分支→广场→建筑集群→连接路）---
function randomGenerateVillage() {
    const cfg = {
        obstCount: parseInt(document.getElementById('rg-obst').value),
        village: parseInt(document.getElementById('rg-village').value),
        obsDist: parseFloat(document.getElementById('rg-obsdist').value),
        safeR: parseFloat(document.getElementById('rg-safe').value),
        roadW: parseFloat(document.getElementById('rg-roadw').value),
        plazaR: parseFloat(document.getElementById('rg-plazar').value),
        greenB: parseFloat(document.getElementById('rg-greenb').value),
        maxH: parseFloat(document.getElementById('rg-maxh').value),
        ptch: parseFloat(document.getElementById('rg-ptch').value),
        octaves: parseInt(document.getElementById('rg-octaves').value),
    };
    
    // 仅清空障碍物实体，保留地形高度/纹理/水体
    Object.values(entityMarkers).forEach(m => { scene.remove(m); disposeGroup(m); });
    Object.keys(entityMarkers).forEach(k => delete entityMarkers[k]);
    Object.values(patrolLines).forEach(l => { scene.remove(l); l.geometry.dispose(); l.material.dispose(); });
    Object.keys(patrolLines).forEach(k => delete patrolLines[k]);
    // 清理旧桥梁：恢复原始高度和纹理
    for (const oldB of mapData.bridges) {
        if (oldB._carvedCells) {
            for (const cc of oldB._carvedCells) {
                mapData.heightmap[cc.idx] = cc.origH;
                if (cc.origSplat !== undefined) mapData.splatMap[cc.idx] = cc.origSplat;
            }
        }
    }
    Object.values(bridgeMeshes).forEach(m => { scene.remove(m); m.traverse(c => { if(c.geometry)c.geometry.dispose(); if(c.material)c.material.dispose(); }); });
    Object.keys(bridgeMeshes).forEach(k => delete bridgeMeshes[k]);
    mapData.entities = []; mapData.groups = []; selectedEntityIds.clear(); entityIdCounter = 1;
    mapData.bridges = [];
    
    // 恢复人造纹理(≥3) + 异常值(<0或>5) 为草地
    for (let i = 0; i < hmResW * hmResD; i++) {
        const v = mapData.splatMap[i];
        if (v >= 3 || v < 0 || v > 5) mapData.splatMap[i] = 0;
    }
    // 立即重建地面使桥梁恢复可见（后续步骤会再次 createGround）
    createGround();
    renderHeightmapCanvas();
    
    const pondCenters = mapData.waters.filter(w => w.type === 'pond').map(w => ({
        x: w.center.x, z: w.center.z, r: w.radius || 8
    }));
    
    // === 阶段1: 生成村路分支（水泥=3）先画，避免覆盖主干道 ===
    const mainRoadPts = generateMainRoad(cfg);
    const mainSmooth = samplePathSmoothDense(mainRoadPts, 1.0);
    const branches = generateBranchRoads(mainSmooth, cfg, pondCenters);
    const branchWidth = Math.max(3, cfg.roadW * 0.8);
    for (const branch of branches) {
        const branchSmooth = samplePathSmoothDense(branch.points, 1.0);
        for (let i = 1; i < branchSmooth.length; i++) {
            drawRoadLine(branchSmooth[i-1].x, branchSmooth[i-1].z, branchSmooth[i].x, branchSmooth[i].z, branchWidth, 3);
        }
    }
    
    // === 阶段2: 生成主干道（柏油=4）后画，覆盖连接点形成自然T型路口 ===
    const mainWidth = cfg.roadW * 1.5;
    for (let i = 1; i < mainSmooth.length; i++) {
        drawRoadLine(mainSmooth[i-1].x, mainSmooth[i-1].z, mainSmooth[i].x, mainSmooth[i].z, mainWidth, 4);
    }
    
    // === 阶段3: 在村路尽头生成村落（广场+建筑集群+水泥连接路）===
    const result = placeBuildingsAlongRoads(mainSmooth, branches, cfg, pondCenters);
    const buildings = result.buildings;
    const genVillages = result.villages || [];

    // 村路连接器 + 广场写入 splatMap（不再依赖 Demo 端 strip 渲染）
    for (const v of genVillages) {
        // 广场圆形贴图
        const { sx: psx, sy: psy } = world2sm(v.plazaX, v.plazaZ);
        const plazaRPx = Math.ceil(v.plazaRadius / Math.min(hmStepW, hmStepD));
        for (let dy = -plazaRPx; dy <= plazaRPx; dy++) {
            for (let dx = -plazaRPx; dx <= plazaRPx; dx++) {
                if (dx*dx + dy*dy > plazaRPx*plazaRPx) continue;
                const sx = psx + dx, sy = psy + dy;
                if (sx < 0 || sx >= hmResW || sy < 0 || sy >= hmResD) continue;
                if (mapData.editedVerticesPaint.has(sx + ',' + sy)) continue;
                mapData.splatMap[sy * hmResW + sx] = 3;
            }
        }
        // 连接路（水泥=3）
        for (const conn of (v.connectors || [])) {
            drawRoadLine(conn.x1, conn.z1, conn.x2, conn.z2, conn.width || 1.5, 3);
        }
    }
    
    const bldgTypes = ['bungalow', 'villa', 'apartment'];
    let entitiesAdded = 0;
    for (const bp of buildings) {
        const bt = bldgTypes[Math.floor(Math.random() * bldgTypes.length)];
        const h = smpHeight(bp.x, bp.z);
        addEntity('building', bp.x, h, bp.z, bt);
        entitiesAdded++;
    }
    
    // === 阶段4: 空地填充树木（总数 = 障碍物总数 - 已放置建筑）===
    const trees = [];
    const maxTrees = Math.max(0, cfg.obstCount - buildings.length);
    
    function tryPlaceTree(x, z) {
        if (Math.abs(x) > worldHalfW - 5 || Math.abs(z) > worldHalfD - 5) return false;
        if (isPointInWater(x, z, 3)) return false;
        const h = smpHeight(x, z);
        if (h < -cfg.maxH * 0.35) return false;
        if (Math.hypot(x, z) < cfg.safeR + 5) return false;
        for (const b of buildings) {
            if (Math.hypot(x - b.x, z - b.z) < 4.5) return false;
        }
        for (const t of trees) {
            if (Math.hypot(x - t.x, z - t.z) < cfg.obsDist * 0.6) return false;
        }
        return true;
    }
    
    for (let attempt = 0; attempt < maxTrees * 3 && trees.length < maxTrees; attempt++) {
        const tx = (Math.random() - 0.5) * worldWidth * 0.85;
        const tz = (Math.random() - 0.5) * worldDepth * 0.85;
        if (tryPlaceTree(tx, tz)) trees.push({ x: tx, z: tz });
    }
    
    const treeTypes = ['cone', 'sphere', 'oak'];
    for (const tp of trees) {
        const tt = treeTypes[Math.floor(Math.random() * treeTypes.length)];
        addEntity('tree', tp.x, smpHeight(tp.x, tp.z), tp.z, tt);
    }
    
    // === 阶段5: 清理道路上的实体 + 桥梁 ===
    clearEntitiesOnRoadSplat();
    
    detectAndBuildBridges(mainSmooth);
    for (const branch of branches) {
        const branchSmooth = samplePathSmoothDense(branch.points, 1.0);
        detectAndBuildBridges(branchSmooth);
    }
    
    // 出生点：避开水体，优先原点，否则螺旋搜索干地
    let spawnX = 0, spawnZ = 0;
    if (isPointInWater(spawnX, spawnZ, cfg.safeR)) {
        let found = false;
        for (let r = 10; r < worldHalfW && !found; r += 10) {
            for (let a = 0; a < Math.PI * 2 && !found; a += 0.3) {
                const sx = Math.cos(a) * r;
                const sz = Math.sin(a) * r;
                if (Math.abs(sx) > worldHalfW - 10 || Math.abs(sz) > worldHalfD - 10) continue;
                if (!isPointInWater(sx, sz, cfg.safeR)) {
                    spawnX = sx; spawnZ = sz;
                    found = true;
                }
            }
        }
        if (found) {
            console.log('🚩 出生点避水: 原点在水中，移至 (' + spawnX.toFixed(1) + ',' + spawnZ.toFixed(1) + ')');
        }
    }
    addEntity('spawn', spawnX, smpHeight(spawnX, spawnZ), spawnZ, null);
    
    // === 储存道路结构化数据（供 index.html 直接读取，实现所见即所得）===
    const roadSegments = [];
    // 主干道：将平滑路径切分为~10m直段
    for (let i = 0; i < mainSmooth.length - 1; i += 10) {
        const j = Math.min(i + 10, mainSmooth.length - 1);
        roadSegments.push({
            x1: mainSmooth[i].x, z1: mainSmooth[i].z,
            x2: mainSmooth[j].x, z2: mainSmooth[j].z,
            width: mainWidth, type: 'main'
        });
    }
    // 村路分支
    for (const branch of branches) {
        const bs = samplePathSmoothDense(branch.points, 1.0);
        for (let i = 0; i < bs.length - 1; i += 8) {
            const j = Math.min(i + 8, bs.length - 1);
            roadSegments.push({
                x1: bs[i].x, z1: bs[i].z,
                x2: bs[j].x, z2: bs[j].z,
                width: branchWidth, type: 'village'
            });
        }
    }
    // 村落广场+建筑群连接路（来自 placeBuildingsAlongRoads 生成的 village 数据）
    const villages = genVillages.map(v => ({
        plazaX: v.plazaX, plazaZ: v.plazaZ,
        plazaRadius: v.plazaRadius,
        buildings: v.buildings || [],
        connectors: v.connectors || []
    }));
    // 连接路也作为 roadSegments 存入（供游戏端 createRoadMeshes 渲染）
    for (const v of villages) {
        for (const conn of (v.connectors || [])) {
            roadSegments.push({ x1: conn.x1, z1: conn.z1, x2: conn.x2, z2: conn.z2, width: conn.width || 1.5, type: 'village' });
        }
    }
    // 起伏度：采样横截面 max-min 的 P95，供 demo 自适应偏移
    function _measureRoughness(pts, hw) {
        const ranges = [];
        const step = Math.max(1, Math.floor(pts.length / 20));
        for (let i = 0; i < pts.length - 1; i += step) {
            const dx = pts[i+1].x - pts[i].x, dz = pts[i+1].z - pts[i].z;
            const segLen = Math.hypot(dx, dz) || 1;
            const snx = -dz / segLen, snz = dx / segLen;
            const x = pts[i].x, z = pts[i].z;
            const hs = [smpHeight(x,z), smpHeight(x+snx*hw,z+snz*hw), smpHeight(x-snx*hw,z-snz*hw),
                       smpHeight(x+snx*hw*0.5,z+snz*hw*0.5), smpHeight(x-snx*hw*0.5,z-snz*hw*0.5)];
            ranges.push(Math.max(...hs) - Math.min(...hs));
        }
        ranges.sort((a,b)=>a-b);
        return ranges[Math.floor(ranges.length*0.9)] || 0;
    }
    const _roadMainHw = mainWidth / 2, _roadBranchHw = branchWidth / 2;
    // 路径降采样到~5m间距存储（节省 localStorage 空间）
    function _downsamplePts(pts, spacing) {
        const r = [pts[0]];
        let acc = 0;
        for (let i = 1; i < pts.length; i++) {
            acc += Math.hypot(pts[i].x-pts[i-1].x, pts[i].z-pts[i-1].z);
            if (acc >= spacing || i === pts.length-1) { r.push(pts[i]); acc = 0; }
        }
        return r.map(p=>({x:p.x,z:p.z}));
    }
    const mainRoad = { points: _downsamplePts(mainSmooth, 5), width:mainWidth, type:'asphalt', roughness:_measureRoughness(mainSmooth,_roadMainHw) };
    const branchRoads = branches.map(b => {
        const bs = samplePathSmoothDense(b.points, 1.0);
        return { points: _downsamplePts(bs, 5), width:branchWidth, type:'concrete', roughness:_measureRoughness(bs,_roadBranchHw) };
    });
    mapData.roadSystem = { roadSegments, villages, mainRoad, branchRoads };
    
    createGround();
    renderHeightmapCanvas();
    refreshEntityList();
    refreshWaterList();
    clearUndoStack(); pushSnapshot();
    
    const totalBldgs = mapData.entities.filter(e => e.type === 'building').length;
    const totalTrees = mapData.entities.filter(e => e.type === 'tree').length;
    overlayInfo.textContent = '🏘️ 村落已生成 — 主干道+'+branches.length+'村路分支 | '+totalBldgs+'建筑 '+totalTrees+'树木 | 道路数据已储存';
}

// --- 随机生成面板折叠 + 按钮 ---
document.getElementById('btn-random-gen').addEventListener('click', () => {
    // 展开两个面板并滚动到随机地形区
    ['rg-terrain-body','rg-village-body'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'block';
    });
    const header = document.getElementById('rg-terrain-header');
    if (header) header.scrollIntoView({ behavior: 'smooth', block: 'start' });
});
['rg-terrain-header','rg-village-header'].forEach(hid => {
    const hdr = document.getElementById(hid);
    if (!hdr) return;
    hdr.addEventListener('click', () => {
        const bodyId = hid === 'rg-terrain-header' ? 'rg-terrain-body' : 'rg-village-body';
        const body = document.getElementById(bodyId);
        if (body) body.style.display = body.style.display === 'none' ? 'block' : 'none';
    });
});
document.getElementById('btn-rg-terrain').addEventListener('click', randomGenerateTerrain);
document.getElementById('btn-rg-village').addEventListener('click', randomGenerateVillage);
document.getElementById('btn-flatten-terrain').addEventListener('click', flattenTerrain);

// 平整地形：山峰为起点，向外连续递减起伏幅度至15%
function flattenTerrain() {
    if (!undoManager._inUndoRedo) pushSnapshot();
    const _keepPeaks = parseInt(document.getElementById('rg-hills').value) || 4;
    const _falloffDist = Math.max(worldWidth, worldDepth) * 0.25; // 衰减距离

    // 1. 找局部峰值
    const _step = Math.max(3, Math.floor(Math.min(hmResW, hmResD) / 60));
    const peaks = [];
    for (let sy = _step; sy < hmResD - _step; sy += _step) {
        for (let sx = _step; sx < hmResW - _step; sx += _step) {
            const cv = mapData.heightmap[sy * hmResW + sx];
            let isMax = true;
            for (let dy = -_step; dy <= _step && isMax; dy += _step)
                for (let dx = -_step; dx <= _step && isMax; dx += _step)
                    if (mapData.heightmap[(sy+dy)*hmResW + (sx+dx)] > cv) isMax = false;
            if (isMax && cv > 1.5) peaks.push({ sx, sy, h: cv });
        }
    }
    peaks.sort((a,b) => b.h - a.h);
    const kept = peaks.slice(0, _keepPeaks);

    // 2. 每个单元格：距最近山峰越远，幅度压缩越大（smoothstep 连续渐变）
    for (let sy = 0; sy < hmResD; sy++) {
        for (let sx = 0; sx < hmResW; sx++) {
            const idx = sy * hmResW + sx;
            const origH = mapData.heightmap[idx];
            let minDist = Infinity;
            for (const p of kept) {
                const dx2 = (sx-p.sx)*hmStepW, dz2 = (sy-p.sy)*hmStepD;
                const d = Math.sqrt(dx2*dx2 + dz2*dz2);
                if (d < minDist) minDist = d;
            }
            // 连续衰减：峰顶 scale=1.0，_falloffDist 远处 scale=0.15
            const t = Math.max(0, Math.min(1, minDist / _falloffDist));
            const s = t * t * (3 - 2 * t); // smoothstep 0→1
            const scale = 1.0 - s * 0.85; // 1.0 → 0.15
            mapData.heightmap[idx] = origH * scale;
        }
    }
    createGround();
    renderHeightmapCanvas();
    overlayInfo.textContent = '📐 地形已平整 — ' + kept.length + '个高地保留，外围连续衰减至15%';
    console.log('📐 平整地形: ' + peaks.length + '个峰值 → 保留' + kept.length + '个');
}
