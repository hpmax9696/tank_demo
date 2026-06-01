// ==================== js/editor_waterBridge.js — 水体桥梁系统 ====================
// 依赖: mapData, scene, world2sm, w2i, hmResW/D, hmStepW/D, worldHalfW/D

// --- 水体记录管理 ---
function addWaterRecord(type, center, radius, points, waterLevel, width, waterLevels) {
    const id = 'w' + Date.now();
    const w = { id, type, center, radius: type === 'pond' ? radius : null, points: type === 'river' ? points : null, waterLevel: waterLevel || 0, width: type === 'river' ? (width || brushRadius || 10) : null, waterLevels: waterLevels || null };
    mapData.waters.push(w);
    refreshWaterList();
    return w;
}

function deleteWater(id) {
    if (!undoManager._inUndoRedo) pushSnapshot();
    mapData.waters = mapData.waters.filter(w => w.id !== id);
    // 注意：删除水体记录不会恢复高度图或 editedVerticesPaint
    refreshWaterList();
}

function refreshWaterList() {
    const el = document.getElementById('water-list');
    if (mapData.waters.length === 0) { el.innerHTML = '<div class="empty-msg">暂无水体</div>'; return; }
    el.innerHTML = mapData.waters.map((w, i) =>
        `<div class="entity-row" style="font-size:11px;">
            ${w.type==='pond'?'🟦池塘':'🏞️河流'} #${i+1} (r:${(w.radius||0).toFixed(0)}m)
            <button class="btn-del" data-wdel="${w.id}">×</button>
        </div>`
    ).join('');
    el.querySelectorAll('[data-wdel]').forEach(btn => {
        btn.addEventListener('click', (ev) => { ev.stopPropagation(); deleteWater(btn.dataset.wdel); });
    });
}


// --- 桥梁 ---
function createBridgeMesh(b) {
    const grp = new THREE.Group();
    const dx = b.to.x - b.from.x, dz = b.to.z - b.from.z;
    const len = Math.hypot(dx, dz) || 1;
    const angle = Math.atan2(dz, dx);
    const cx = (b.from.x + b.to.x) / 2, cz = (b.from.z + b.to.z) / 2;
    const cwidth = b.width || 4;
    // 桥面水平：取两岸较低值 + 0.3（不倾斜），高度差由引道处理
    const hFrom = smpHeight(b.from.x, b.from.z);
    const hTo = smpHeight(b.to.x, b.to.z);
    const deckY = Math.min(hFrom, hTo);
    const dY = hTo - hFrom; // 用于引道高度

    // 法线方向（垂直于桥走向）
    const nx = -Math.sin(angle), nz = Math.cos(angle);

    // ------ 水平桥面 ------
    const hw = cwidth * 0.5;
    const deckGeo = new THREE.BoxGeometry(len, 0.25, cwidth);
    const deckMat = new THREE.MeshStandardMaterial({ color: 0x8B7355, roughness: 0.6 });
    const deck = new THREE.Mesh(deckGeo, deckMat);
    deck.position.set(cx, deckY, cz);
    deck.rotation.y = -angle;
    grp.add(deck);

    // ------ 引道路堤：桥两端各延伸 3m，从地形高度渐变到桥面高度 ------
    const rampLen = 3;
    const rampMat = new THREE.MeshStandardMaterial({ color: 0x8B7355, roughness: 0.7, side: THREE.DoubleSide });
    const dIdx = [0, 1, 2, 1, 3, 2];
    // 低岸端引道（从端 → 向桥外延伸）
    const rDir = -1;
    const rEnd = { x: b.from.x + rDir * (dx / len) * rampLen, z: b.from.z + rDir * (dz / len) * rampLen };
    const rHEnd = smpHeight(rEnd.x, rEnd.z);
    const rPos = [
        b.from.x + nx * hw, deckY,     b.from.z + nz * hw,
        b.from.x - nx * hw, deckY,     b.from.z - nz * hw,
        rEnd.x   + nx * hw, rHEnd,     rEnd.z   + nz * hw,
        rEnd.x   - nx * hw, rHEnd,     rEnd.z   - nz * hw
    ];
    const rGeo = new THREE.BufferGeometry();
    rGeo.setAttribute('position', new THREE.Float32BufferAttribute(rPos, 3));
    rGeo.setIndex(dIdx);
    rGeo.computeVertexNormals();
    grp.add(new THREE.Mesh(rGeo, rampMat));
    // 高岸端引道（到端 → 向桥外延伸，如果高岸低于桥面则略过）
    const r2Dir = 1;
    const r2End = { x: b.to.x + r2Dir * (dx / len) * rampLen, z: b.to.z + r2Dir * (dz / len) * rampLen };
    const r2HEnd = smpHeight(r2End.x, r2End.z);
    const r2Pos = [
        b.to.x   + nx * hw, deckY,     b.to.z   + nz * hw,
        b.to.x   - nx * hw, deckY,     b.to.z   - nz * hw,
        r2End.x  + nx * hw, r2HEnd,    r2End.z  + nz * hw,
        r2End.x  - nx * hw, r2HEnd,    r2End.z  - nz * hw
    ];
    const r2Geo = new THREE.BufferGeometry();
    r2Geo.setAttribute('position', new THREE.Float32BufferAttribute(r2Pos, 3));
    r2Geo.setIndex(dIdx);
    r2Geo.computeVertexNormals();
    grp.add(new THREE.Mesh(r2Geo, rampMat));

    // ------ 支柱（到实际地形）------
    for (let t = 0.25; t <= 0.75; t += 0.25) {
        const px = b.from.x + dx * t, pz = b.from.z + dz * t;
        const gh = smpHeight(px, pz);
        const pillarH = Math.max(0.5, deckY - gh);
        const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, pillarH, 6), new THREE.MeshStandardMaterial({ color: 0x666666, roughness: 0.5 }));
        pillar.position.set(px, gh + pillarH / 2, pz);
        grp.add(pillar);
    }

    // ------ 栏杆（水平，在桥面高度 +0.5）------
    for (let side = -1; side <= 1; side += 2) {
        const r1 = { x: b.from.x + nx * (hw + 0.15) * side, y: deckY + 0.5, z: b.from.z + nz * (hw + 0.15) * side };
        const r2 = { x: b.to.x   + nx * (hw + 0.15) * side, y: deckY + 0.5, z: b.to.z   + nz * (hw + 0.15) * side };
        const pts = [r1.x, r1.y, r1.z, r2.x, r2.y, r2.z];
        const rGeo = new THREE.BufferGeometry();
        rGeo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
        grp.add(new THREE.Line(rGeo, new THREE.LineBasicMaterial({ color: 0x555555 })));
    }
    return grp;
}

function addBridge(from, to) {
    // 过滤虚空中的桥（两端都超出世界边界至少5m则跳过）
    const cx = (from.x + to.x) / 2, cz = (from.z + to.z) / 2;
    if (Math.abs(cx) > worldHalfW + 5 || Math.abs(cz) > worldHalfD + 5) return;
    if (!undoManager._inUndoRedo) pushSnapshot();
    const id = 'b' + Date.now();
    const width = 4;
    const b = { id, from, to, width, deckY: 0 };
    mapData.bridges.push(b);

    // 地形修整：平整区 + 两端斜坡（记录修改，清理时恢复）
    const dx = to.x - from.x, dz = to.z - from.z;
    const segLen = Math.hypot(dx, dz) || 1;
    const ux = dx / segLen, uz = dz / segLen; // 桥轴线方向（from→to）
    const hFrom = smpHeight(from.x, from.z);
    const hTo = smpHeight(to.x, to.z);
    const deckY = Math.min(hFrom, hTo); // 桥面高度 = 较低岸
    b.deckY = deckY;
    const halfW = width * 0.5 + 2;     // 平整宽度
    b._carvedCells = [];

    // 扫描一端内陆方向的最大高差，确定斜坡长度
    function scanMaxDrop(anchor, dirInland) {
        const scanR = 15; let md = 0;
        for (let d = 0; d <= scanR; d++) {
            const sx = anchor.x + dirInland * ux * d;
            const sz = anchor.z + dirInland * uz * d;
            if (Math.abs(sx) > worldHalfW || Math.abs(sz) > worldHalfD) break;
            const h = smpHeight(sx, sz);
            md = Math.max(md, Math.abs(h - deckY));
        }
        return md;
    }
    const rampFrom = Math.max(5, scanMaxDrop(from, -1) * 4); // from端向内陆
    const rampTo   = Math.max(5, scanMaxDrop(to,   1) * 4); // to端向内陆

    // 计算覆盖整个平整区+斜坡的像素范围
    const totalMin = -rampFrom, totalMax = segLen + rampTo;
    const x1 = from.x + totalMin*ux - halfW + worldHalfW;
    const x2 = from.x + totalMax*ux + halfW + worldHalfW;
    const z1 = from.z + totalMin*uz - halfW + worldHalfD;
    const z2 = from.z + totalMax*uz + halfW + worldHalfD;
    const minSx = Math.max(0, Math.floor(Math.min(x1, x2) / hmStepW));
    const maxSx = Math.min(hmResW - 1, Math.ceil(Math.max(x1, x2) / hmStepW));
    const minSy = Math.max(0, Math.floor(Math.min(z1, z2) / hmStepD));
    const maxSy = Math.min(hmResD - 1, Math.ceil(Math.max(z1, z2) / hmStepD));
    console.log('🌉 桥梁 '+b.id+' 雕琢范围: rampFrom='+rampFrom.toFixed(1)+' rampTo='+rampTo.toFixed(1)+' segLen='+segLen.toFixed(1)+' deckY='+deckY.toFixed(2)+' hFrom='+hFrom.toFixed(2)+' hTo='+hTo.toFixed(2)+' pixels ['+minSx+'-'+maxSx+']×['+minSy+'-'+maxSy+']');

    let carveCount = 0, waterSkip = 0;
    for (let sy = minSy; sy <= maxSy; sy++) {
        for (let sx = minSx; sx <= maxSx; sx++) {
            const wx = (sx + 0.5) * hmStepW - worldHalfW;
            const wz = (sy + 0.5) * hmStepD - worldHalfD;
            // 投影到桥轴线上（from=0, to=segLen）
            const proj = (wx - from.x) * ux + (wz - from.z) * uz;
            // 垂直距离
            const perp = Math.abs((wx - from.x) * (-uz) + (wz - from.z) * ux);
            if (perp > halfW) continue;

            const idx = sy * hmResW + sx;
            const origH = mapData.heightmap[idx];
            // 跳过水域中心区（河床保持原样），用河流实际半宽检测
            // 注意：isPointInWater 硬编码检测半径 4m，河流可能更宽
            if (isPointInWater(wx, wz, 1)) { waterSkip++; continue; }
            let targetH;

            if (proj >= 0 && proj <= segLen) {
                // 平整区：桥覆盖范围，统一高度 deckY
                targetH = deckY;
            } else if (proj < 0) {
                // from端斜坡：proj ∈ [-rampFrom, 0]，t 从 1 渐变到 0
                if (proj < -rampFrom) continue;
                const t = -proj / rampFrom; // 0=桥端, 1=远内陆
                targetH = deckY + (origH - deckY) * t;
            } else {
                // to端斜坡：proj ∈ [segLen, segLen+rampTo]
                if (proj > segLen + rampTo) continue;
                const t = (proj - segLen) / rampTo;
                targetH = deckY + (origH - deckY) * t;
            }

            if (Math.abs(targetH - origH) < 0.02) continue;
            carveCount++;
            b._carvedCells.push({ idx, origH, origSplat: mapData.splatMap[idx] });
            mapData.heightmap[idx] = targetH;
            // 保持原始纹理，不强制修改 splatMap
            // 不加入 editedVerticesPaint，避免触发 vertexColors 水体蓝染
        }
    }
    console.log('🌉 桥梁 '+b.id+' 雕琢完成: '+carveCount+' 单元格修改, '+waterSkip+' 水域跳过, _carvedCells='+b._carvedCells.length);

    const mesh = createBridgeMesh(b);
    scene.add(mesh); bridgeMeshes[id] = mesh;
    return b;
}


// --- 水面 + 网格 ---
function createWaterLayer() {
    // 清理旧水面
    waterLayerMeshes.forEach(m => { scene.remove(m); if(m.geometry)m.geometry.dispose(); if(m.material)m.material.dispose(); });
    waterLayerMeshes = [];

    if (mapData.waters.length === 0) return;

    const waterMat = new THREE.MeshStandardMaterial({
        color: '#3388cc', roughness: 0.1, metalness: 0.3,
        transparent: true, opacity: 0.6, depthWrite: true, depthTest: true,
        side: THREE.DoubleSide,
        polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2
    });

    // 1x 全局去重 + 边缘2x超采样：边缘半格精度平滑锯齿，内部保持1格性能
    const globalCells = new Map();  // key "sx,sy" → waterLevel
    const SS = 2;
    const subHmStepW = hmStepW / SS, subHmStepD = hmStepD / SS;

    for (const w of mapData.waters) {
        const waterLevel = w.waterLevel || 0;

        if (w.type === 'pond' && w.center && w.radius) {
            const r2 = w.radius * w.radius;
            const minSx = Math.max(0, Math.floor((w.center.x - w.radius - hmStepW + worldHalfW) / hmStepW));
            const maxSx = Math.min(hmResW - 1, Math.ceil((w.center.x + w.radius + hmStepW + worldHalfW) / hmStepW));
            const minSy = Math.max(0, Math.floor((w.center.z - w.radius - hmStepD + worldHalfD) / hmStepD));
            const maxSy = Math.min(hmResD - 1, Math.ceil((w.center.z + w.radius + hmStepD + worldHalfD) / hmStepD));
            for (let sy = minSy; sy <= maxSy; sy++) {
                for (let sx = minSx; sx <= maxSx; sx++) {
                    const cx = (sx + 0.5) * hmStepW - worldHalfW;
                    const cz = (sy + 0.5) * hmStepD - worldHalfD;
                    const dx = cx - w.center.x, dz = cz - w.center.z;
                    if (dx * dx + dz * dz <= r2) {
                        const key = sx + ',' + sy;
                        const existing = globalCells.get(key);
                        globalCells.set(key, existing != null ? Math.min(existing, waterLevel) : waterLevel);
                    }
                }
            }

        } else if (w.type === 'river' && w.points && w.points.length >= 2) {
            const riverWidth = w.width || brushRadius || 10;
            const hw = riverWidth * 0.5;
            const smoothPts = samplePathSmoothDense(w.points, 2.0);
            const hasProfile = w.waterLevels && w.waterLevels.length === smoothPts.length - 1;

            let minWx = Infinity, maxWx = -Infinity, minWz = Infinity, maxWz = -Infinity;
            for (const p of smoothPts) {
                if (p.x < minWx) minWx = p.x; if (p.x > maxWx) maxWx = p.x;
                if (p.z < minWz) minWz = p.z; if (p.z > maxWz) maxWz = p.z;
            }
            const padW = hw + hmStepW, padD = hw + hmStepD;
            const minSx = Math.max(0, Math.floor((minWx - padW + worldHalfW) / hmStepW));
            const maxSx = Math.min(hmResW - 1, Math.ceil((maxWx + padW + worldHalfW) / hmStepW));
            const minSy = Math.max(0, Math.floor((minWz - padD + worldHalfD) / hmStepD));
            const maxSy = Math.min(hmResD - 1, Math.ceil((maxWz + padD + worldHalfD) / hmStepD));

            for (let sy = minSy; sy <= maxSy; sy++) {
                for (let sx = minSx; sx <= maxSx; sx++) {
                    const cx = (sx + 0.5) * hmStepW - worldHalfW;
                    const cz = (sy + 0.5) * hmStepD - worldHalfD;
                    let minDist = Infinity, ns = -1;
                    for (let i = 0; i < smoothPts.length - 1; i++) {
                        const d = pointToSegmentDist(cx, cz, smoothPts[i].x, smoothPts[i].z, smoothPts[i+1].x, smoothPts[i+1].z);
                        if (d < minDist) { minDist = d; ns = i; }
                        if (minDist <= hw) break;
                    }
                    if (minDist <= hw) {
                        const cellSL = hasProfile ? w.waterLevels[ns] : waterLevel;
                        const key = sx + ',' + sy;
                        const existing = globalCells.get(key);
                        globalCells.set(key, existing != null ? Math.min(existing, cellSL) : cellSL);
                    }
                }
            }
        }
    }

    if (globalCells.size > 0) {
        // 预计算边缘检测用的 cellKeySet 和各水体的平滑路径
        const cellKeySet = new Set(globalCells.keys());

        // 为每个水体预计算平滑路径（用于边缘子格检测）
        const waterBodies = [];
        for (const w of mapData.waters) {
            if (w.type === 'pond' && w.center && w.radius) {
                waterBodies.push({ type: 'pond', cx: w.center.x, cz: w.center.z, r2: w.radius * w.radius, wl: w.waterLevel || 0 });
            } else if (w.type === 'river' && w.points && w.points.length >= 2) {
                const hw = (w.width || 40) * 0.5;
                const pts = samplePathSmoothDense(w.points, 2.0);
                waterBodies.push({ type: 'river', pts, hw, wl: w.waterLevel || 0 });
            }
        }

        const isSubInWater = (subCx, subCz) => {
            for (const wb of waterBodies) {
                if (wb.type === 'pond') {
                    const dx = subCx - wb.cx, dz = subCz - wb.cz;
                    if (dx * dx + dz * dz <= wb.r2) return true;
                } else if (wb.type === 'river') {
                    let minD = Infinity;
                    for (let i = 0; i < wb.pts.length - 1; i++) {
                        const d = pointToSegmentDist(subCx, subCz, wb.pts[i].x, wb.pts[i].z, wb.pts[i+1].x, wb.pts[i+1].z);
                        if (d < minD) { minD = d; if (minD <= wb.hw) break; }
                    }
                    if (minD <= wb.hw) return true;
                }
            }
            return false;
        };

        const verts = [], indices = [];
        const cellArr = [];
        globalCells.forEach((cellSL, key) => {
            const [sx, sy] = key.split(',').map(Number);
            cellArr.push({ sx, sy, sl: cellSL });
        });
        cellArr.sort((a, b) => a.sy - b.sy || a.sx - b.sx);

        for (const cell of cellArr) {
            const wx = cell.sx * hmStepW - worldHalfW;
            const wz = cell.sy * hmStepD - worldHalfD;
            const sl = cell.sl;

            // 判断是否为边缘单元格（任一4邻域不在水体内）
            const isEdge = !cellKeySet.has((cell.sx - 1) + ',' + cell.sy) ||
                           !cellKeySet.has((cell.sx + 1) + ',' + cell.sy) ||
                           !cellKeySet.has(cell.sx + ',' + (cell.sy - 1)) ||
                           !cellKeySet.has(cell.sx + ',' + (cell.sy + 1));

            if (!isEdge) {
                // 内部单元格：1个整格 quad
                const vi = verts.length / 3;
                verts.push(wx,           sl, wz);
                verts.push(wx + hmStepW, sl, wz);
                verts.push(wx,           sl, wz + hmStepD);
                verts.push(wx + hmStepW, sl, wz + hmStepD);
                indices.push(vi, vi + 1, vi + 2);
                indices.push(vi + 1, vi + 3, vi + 2);
            } else {
                // 边缘单元格：2x2 子格，每个独立检测水体包含
                const hw2 = subHmStepW, hd2 = subHmStepD;
                for (const [ox, oz] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
                    const subCx = wx + ox * hw2 + hw2 * 0.5;
                    const subCz = wz + oz * hd2 + hd2 * 0.5;
                    if (isSubInWater(subCx, subCz)) {
                        const swx = wx + ox * hw2;
                        const swz = wz + oz * hd2;
                        const vi = verts.length / 3;
                        verts.push(swx,       sl, swz);
                        verts.push(swx + hw2, sl, swz);
                        verts.push(swx,       sl, swz + hd2);
                        verts.push(swx + hw2, sl, swz + hd2);
                        indices.push(vi, vi + 1, vi + 2);
                        indices.push(vi + 1, vi + 3, vi + 2);
                    }
                }
            }
        }

        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
        geo.setIndex(indices);
        geo.computeVertexNormals();
        geo.computeBoundingSphere();
        const mesh = new THREE.Mesh(geo, waterMat);
        mesh.name = 'water-all';
        mesh.renderOrder = 1;
        mesh.receiveShadow = true;
        scene.add(mesh);
        waterLayerMeshes.push(mesh);
    }
}

function updGeoHeights(geo) {
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), idx = w2i(x, z); p.setY(i, idx >= 0 ? mapData.heightmap[idx] : 0); }
    p.needsUpdate = true; geo.computeVertexNormals();
}

function updGeoHeightsPartial(geo, minSx, minSy, maxSx, maxSy) {
    const p = geo.attributes.position;
    const hasColors = geo.attributes.color;
    for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), z = p.getZ(i);
        const sx = Math.round((x + worldHalfW) / worldWidth * (hmResW - 1)), sy = Math.round((z + worldHalfD) / worldDepth * (hmResD - 1));
        if (sx >= minSx && sx <= maxSx && sy >= minSy && sy <= maxSy) {
            const idx = w2i(x, z); if (idx >= 0) p.setY(i, mapData.heightmap[idx]);
            // 同步水体 vertexColor（平滑过渡带）
            if (hasColors && mapData.editedVerticesPaint && mapData.editedVerticesPaint.has(sx + ',' + sy)) {
                const h = mapData.heightmap[idx >= 0 ? idx : 0];
                const blend = h < -0.12 ? 1.0 : h < -0.04 ? (-0.04 - h) / 0.08 : 0;
                const depth = Math.min(1, Math.max(0, (-h) / (brushStrength * 0.2 + 0.5)));
                hasColors.setXYZ(i,
                    0.10 + (1 - blend) * 0.90,
                    (0.40 + depth * 0.15) * blend + (1 - blend),
                    (0.65 + depth * 0.25) * blend + (1 - blend)
                );
            }
        }
    }
    p.needsUpdate = true; if (hasColors) hasColors.needsUpdate = true;
    geo.computeVertexNormals();
}

// ----- 网格 / 边界线 -----
function createGrid() {
    if (gridHelper) scene.remove(gridHelper);

    const group = new THREE.Group();

    // 方格网 (300×300)
    const gridStep = 20;
    const mat = new THREE.LineBasicMaterial({ color: 0x3a3a55, transparent: true, opacity: 0.4 });
    // 矩形网格：X方向适配 worldHalfW，Z方向适配 worldHalfD
    for (let i = -worldHalfW; i <= worldHalfW; i += gridStep) {
        const ptsX = [new THREE.Vector3(i, 0.05, -worldHalfD), new THREE.Vector3(i, 0.05, worldHalfD)];
        group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(ptsX), mat));
    }
    for (let i = -worldHalfD; i <= worldHalfD; i += gridStep) {
        const ptsZ = [new THREE.Vector3(-worldHalfW, 0.05, i), new THREE.Vector3(worldHalfW, 0.05, i)];
        group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(ptsZ), mat));
    }

    // 空气墙边界（橙色高亮，矩形playWidth×playDepth）
    const playMat = new THREE.LineBasicMaterial({ color: 0xf5954a, transparent: true, opacity: 0.7 });
    const playPts = [
        new THREE.Vector3(-playHalfW, 0.06, -playHalfD), new THREE.Vector3(playHalfW, 0.06, -playHalfD),
        new THREE.Vector3(playHalfW, 0.06, playHalfD), new THREE.Vector3(-playHalfW, 0.06, playHalfD),
        new THREE.Vector3(-playHalfW, 0.06, -playHalfD)
    ];
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(playPts), playMat));

    // 世界边界（暗红虚线，矩形worldWidth×worldDepth）
    const worldMat = new THREE.LineDashedMaterial({ color: 0x664444, transparent: true, opacity: 0.5, dashSize: 8, gapSize: 4 });
    const worldPts = [
        new THREE.Vector3(-worldHalfW, 0.04, -worldHalfD), new THREE.Vector3(worldHalfW, 0.04, -worldHalfD),
        new THREE.Vector3(worldHalfW, 0.04, worldHalfD), new THREE.Vector3(-worldHalfW, 0.04, worldHalfD),
        new THREE.Vector3(-worldHalfW, 0.04, -worldHalfD)
    ];
    const worldLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints(worldPts), worldMat);
    worldLine.computeLineDistances();
    group.add(worldLine);

    gridHelper = group;
    gridHelper.visible = chkGrid.checked;
    scene.add(gridHelper);
}

// ----- 高度图 Canvas 渲染 -----

// --- 桥梁检测 + 道路清理 ---
function detectAndBuildBridges(smoothPts) {
    if (mapData.waters.length === 0) return;
    for (const w of mapData.waters) {
        if (w.type === 'pond') {
            let entryIdx = -1, exitIdx = -1;
            const r = w.radius || 8;
            const cx = w.center.x || 0, cz = w.center.z || 0;
            for (let i = 0; i < smoothPts.length; i++) {
                const dist = Math.hypot(smoothPts[i].x - cx, smoothPts[i].z - cz);
                if (dist < r + 1) {
                    if (entryIdx < 0) entryIdx = i;
                    exitIdx = i;
                }
            }
            if (entryIdx >= 0 && exitIdx > entryIdx) {
                const from = smoothPts[Math.max(0, entryIdx - 1)];
                const to = smoothPts[Math.min(smoothPts.length - 1, exitIdx + 1)];
                addBridge({ x: from.x, z: from.z }, { x: to.x, z: to.z });
            }
        } else if (w.type === 'river' && w.points && w.points.length >= 2) {
            const riverHw = ((w.width || brushRadius || 10) * 0.5) + 1;
            if (!w._smoothed) {
                w._smoothed = samplePathSmoothDense(w.points, 2.0);
            }
            const riverSmooth = w._smoothed;
            // 多段穿越检测：每次进入→退出独立建桥
            let entryIdx = -1;
            let inWater = false;
            for (let i = 0; i < smoothPts.length; i++) {
                const px = smoothPts[i].x, pz = smoothPts[i].z;
                let nearRiver = false;
                for (let j = 0; j < riverSmooth.length - 1; j++) {
                    const d = pointToSegmentDist(px, pz, riverSmooth[j].x, riverSmooth[j].z, riverSmooth[j+1].x, riverSmooth[j+1].z);
                    if (d < riverHw) { nearRiver = true; break; }
                }
                if (nearRiver && !inWater) {
                    // 进入水域
                    inWater = true;
                    entryIdx = i;
                } else if (!nearRiver && inWater) {
                    // 离开水域 → 为这一段建桥
                    inWater = false;
                    if (entryIdx >= 0 && i > entryIdx + 1) {
                        const from = smoothPts[Math.max(0, entryIdx - 1)];
                        const to = smoothPts[Math.min(smoothPts.length - 1, i)];
                        addBridge({ x: from.x, z: from.z }, { x: to.x, z: to.z });
                    }
                    entryIdx = -1;
                }
            }
            // 路径终点仍在水域中（末端穿越）
            if (inWater && entryIdx >= 0 && smoothPts.length > entryIdx + 1) {
                const from = smoothPts[Math.max(0, entryIdx - 1)];
                const to = smoothPts[smoothPts.length - 1];
                addBridge({ x: from.x, z: from.z }, { x: to.x, z: to.z });
            }
        }
    }
}

// 清除道路路径上的建筑和树木（保留敌人、出生点、巡逻点）
function clearObstaclesOnPath(smoothPts, width) {
    const hw = width / 2;
    const toRemove = [];
    mapData.entities.forEach(ent => {
        if (ent.type !== 'tree' && ent.type !== 'building') return;
        for (let i = 1; i < smoothPts.length; i++) {
            const a = smoothPts[i-1], b = smoothPts[i];
            const dx = b.x - a.x, dz = b.z - a.z;
            const len2 = dx*dx + dz*dz;
            if (len2 === 0) continue;
            let t = ((ent.position.x - a.x)*dx + (ent.position.z - a.z)*dz) / len2;
            t = Math.max(0, Math.min(1, t));
            const px = a.x + t*dx, pz = a.z + t*dz;
            const dist = Math.hypot(ent.position.x - px, ent.position.z - pz);
            if (dist < hw + 2) { toRemove.push(ent.id); break; }
        }
    });
    toRemove.forEach(id => {
        if (entityMarkers[id]) { scene.remove(entityMarkers[id]); disposeGroup(entityMarkers[id]); delete entityMarkers[id]; }
        if (patrolLines[id]) { scene.remove(patrolLines[id]); patrolLines[id].geometry.dispose(); patrolLines[id].material.dispose(); delete patrolLines[id]; }
    });
    mapData.entities = mapData.entities.filter(e => !toRemove.includes(e.id));
    mapData.groups.forEach(g => { g.entityIds = g.entityIds.filter(eid => !toRemove.includes(eid)); });
    selectedEntityIds.forEach(id => { if (toRemove.includes(id)) selectedEntityIds.delete(id); });
    return toRemove.length;
}

// 清除道路 splatMap 上的建筑和树木（用于随机生成后）
function clearEntitiesOnRoadSplat() {
    const toRemove = [];
    mapData.entities.forEach(ent => {
        if (ent.type !== 'tree' && ent.type !== 'building') return;
        const idx = w2i(ent.position.x, ent.position.z);
        if (idx >= 0) {
            const tp = mapData.splatMap[idx];
            if (tp === 3 || tp === 4 || tp === 5) toRemove.push(ent.id); // 在水泥/柏油/地砖上
        }
    });
    toRemove.forEach(id => {
        if (entityMarkers[id]) { scene.remove(entityMarkers[id]); disposeGroup(entityMarkers[id]); delete entityMarkers[id]; }
    });
    mapData.entities = mapData.entities.filter(e => !toRemove.includes(e.id));
    mapData.groups.forEach(g => { g.entityIds = g.entityIds.filter(eid => !toRemove.includes(eid)); });
    selectedEntityIds.forEach(id => { if (toRemove.includes(id)) selectedEntityIds.delete(id); });
    return toRemove.length;
}

// 水体/道路笔刷按钮
document.getElementById('btn-water').addEventListener('click', () => setBrushMode('water'));
document.getElementById('btn-road').addEventListener('click', () => setBrushMode('road'));

// 道路类型选择
document.querySelectorAll('#road-sel .road-swatch').forEach(sw => {
    sw.addEventListener('click', () => {
        roadType = parseInt(sw.dataset.rtype);
        document.querySelectorAll('#road-sel .road-swatch').forEach(s => s.classList.remove('active'));
        sw.classList.add('active');
        overlayInfo.textContent = '🛣️ 道路模式 — '+roadTypeNames[roadType]+' '+roadWidth+'m';
    });
});
// 道路宽度预设
document.querySelectorAll('#road-sel .road-width-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        roadWidth = parseInt(btn.dataset.rw);
        document.querySelectorAll('#road-sel .road-width-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        overlayInfo.textContent = '🛣️ 道路模式 — '+roadTypeNames[roadType]+' '+roadWidth+'m';
    });
});

// 敌人类型选择
document.querySelectorAll('#entity-sel-enemy .entity-swatch').forEach(sw => {
    sw.addEventListener('click', () => {
        document.querySelectorAll('#entity-sel-enemy .entity-swatch').forEach(s => s.classList.remove('active'));
        sw.classList.add('active');
        entityType = sw.dataset.etype;
    });
});

// 树木类型选择
document.querySelectorAll('#entity-sel-tree .entity-swatch').forEach(sw => {
    sw.addEventListener('click', () => {
        document.querySelectorAll('#entity-sel-tree .entity-swatch').forEach(s => s.classList.remove('active'));
        sw.classList.add('active');
        treeType = sw.dataset.ttype;
    });
});

// 建筑类型选择
document.querySelectorAll('#entity-sel-building .entity-swatch').forEach(sw => {
    sw.addEventListener('click', () => {
        document.querySelectorAll('#entity-sel-building .entity-swatch').forEach(s => s.classList.remove('active'));
        sw.classList.add('active');
        bldgType = sw.dataset.btype;
    });
});



chkGrid.addEventListener('change', () => { gridHelper.visible = chkGrid.checked; });
chkWireframe.addEventListener('change', () => {
    groundWireframe.visible = chkWireframe.checked;
    if (groundPlane) groundPlane.material.wireframe = chkWireframe.checked;
});

// 新建地图
btnNewMap.addEventListener('click', () => {
    const name = prompt('地图名称:', 'test_map_editor'); if (!name) return;
    mapData.name = name;
    mapData.heightmap.fill(0); mapData.splatMap.fill(0);
    // 清理所有实体
    Object.values(entityMarkers).forEach(m => { scene.remove(m); disposeGroup(m); });
    Object.keys(entityMarkers).forEach(k => delete entityMarkers[k]);
    Object.values(patrolLines).forEach(l => { scene.remove(l); l.geometry.dispose(); l.material.dispose(); });
    Object.keys(patrolLines).forEach(k => delete patrolLines[k]);
    Object.values(bridgeMeshes).forEach(m => { scene.remove(m); m.traverse(c => { if(c.geometry)c.geometry.dispose(); if(c.material)c.material.dispose(); }); });
    Object.keys(bridgeMeshes).forEach(k => delete bridgeMeshes[k]);
    mapData.entities = []; selectedEntityIds.clear(); mapData.groups = []; entityIdCounter = 1;
    mapData.waters = []; mapData.bridges = [];
    mapData.editedVerticesPaint = new Set();
    if (groundPlane) { groundPlane.geometry.dispose(); createGround(); renderHeightmapCanvas(); }
    mapNameLabel.textContent = name + '.map.json';
    setBrushMode('cursor'); entityMode = null;
    refreshEntityList();
    clearUndoStack();  // 新地图清空历史，推初始快照
    pushSnapshot();
    overlayInfo.textContent = '地图已重置';
});

// 窗口大小调整
