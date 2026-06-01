// ==================== js/editor_data.js — 数据持久化系统 ====================
// 依赖: mapData, scene, camera, renderer, 各模块全局函数
// 提供: exportMapJson, importMapJson, saveBlueprint, loadBlueprint, init 等

// --- JSON 管理 + 蓝图 CRUD ---
// ==================== Phase 4: JSON管理 ====================

// ----- 参数化地形拟合 -----
function fitParameterizedTerrain() {
    const hm = mapData.heightmap;
    const total = hmResW * hmResD;
    // 计算高度统计
    let sum = 0, minH = Infinity, maxH = -Infinity;
    for (let i = 0; i < total; i++) { const v = hm[i]; sum += v; if (v < minH) minH = v; if (v > maxH) maxH = v; }
    const avgH = sum / total;
    if (maxH - minH < 0.1) return null; // 平坦地图无需拟合

    // 找局部极值点
    const peaks = [], basins = [];
    const step = 8; // 每隔8像素采样
    const minPeakHeight = avgH + (maxH - avgH) * 0.3; // 高出均值30%
    const maxBasinDepth = avgH - (avgH - minH) * 0.3;

    for (let sy = step; sy < hmResD - step; sy += step) {
        for (let sx = step; sx < hmResW - step; sx += step) {
            const cv = hm[sy * hmResW + sx];
            let isPeak = cv > minPeakHeight, isBasin = cv < maxBasinDepth;
            if (!isPeak && !isBasin) continue;
            for (let dy = -step; dy <= step && (isPeak || isBasin); dy += step) {
                for (let dx = -step; dx <= step && (isPeak || isBasin); dx += step) {
                    if (dx === 0 && dy === 0) continue;
                    const nv = hm[(sy + dy) * hmResW + (sx + dx)];
                    if (isPeak && nv > cv) isPeak = false;
                    if (isBasin && nv < cv) isBasin = false;
                }
            }
            if (isPeak) {
                // 估算半径（下降到 avgH 处）
                let rx = 0, rz = 0;
                for (let d = 1; d < Math.max(hmResW, hmResD); d++) {
                    const idxR = sy * hmResW + Math.min(sx + d, hmResW - 1);
                    const idxL = sy * hmResW + Math.max(sx - d, 0);
                    const idxD = Math.min(sy + d, hmResD - 1) * hmResW + sx;
                    const idxU = Math.max(sy - d, 0) * hmResW + sx;
                    if (hm[idxR] < avgH && hm[idxL] < avgH && rx === 0) rx = d;
                    if (hm[idxD] < avgH && hm[idxU] < avgH && rz === 0) rz = d;
                    if (rx && rz) break;
                }
                rx = Math.max(rx || 12, 6); rz = Math.max(rz || 12, 6);
                const wx = (sx / hmResW - 0.5) * worldWidth;
                const wz = (sy / hmResD - 0.5) * worldDepth;
                const rxW = rx / hmResW * worldWidth;
                const rzW = rz / hmResW * worldDepth;
                peaks.push({ type: 'hill', center: [wx, cv, wz], rx: rxW, rz: rzW, height: cv });
            }
            if (isBasin) {
                let rx = 0, rz = 0;
                for (let d = 1; d < Math.max(hmResW, hmResD); d++) {
                    const idxR = sy * hmResW + Math.min(sx + d, hmResW - 1);
                    const idxL = sy * hmResW + Math.max(sx - d, 0);
                    const idxD = Math.min(sy + d, hmResD - 1) * hmResW + sx;
                    const idxU = Math.max(sy - d, 0) * hmResW + sx;
                    if (hm[idxR] > avgH && hm[idxL] > avgH && rx === 0) rx = d;
                    if (hm[idxD] > avgH && hm[idxU] > avgH && rz === 0) rz = d;
                    if (rx && rz) break;
                }
                rx = Math.max(rx || 10, 5); rz = Math.max(rz || 10, 5);
                const wx = (sx / hmResW - 0.5) * worldWidth;
                const wz = (sy / hmResD - 0.5) * worldDepth;
                basins.push({ type: 'basin', center: [wx, cv, wz], rx: rx / hmResW * worldWidth, rz: rz / hmResW * worldDepth, depth: avgH - cv });
            }
        }
    }

    // 合并重叠的山丘/盆地（取最高/最深）
    const merged = [];
    peaks.forEach(p => { if (!merged.some(m => m.type === 'hill' && Math.hypot(m.center[0] - p.center[0], m.center[2] - p.center[2]) < 15)) merged.push(p); });
    basins.forEach(b => { if (!merged.some(m => m.type === 'basin' && Math.hypot(m.center[0] - b.center[0], m.center[2] - b.center[2]) < 15)) merged.push(b); });

    // 限制数量
    return merged.slice(0, 20);
}

// ----- 导出 JSON（含参数化地形 + 完整水体/桥梁/道路数据）-----
function exportMapJson() {
    const features = fitParameterizedTerrain();
    const spawnEnt = mapData.entities.find(e => e.type === 'spawn');
    const spawnPt = spawnEnt ? [spawnEnt.position.x, spawnEnt.position.y, spawnEnt.position.z] : [0, 0, 0];

    // 完整水体数据（所有河流/湖泊，不止第一个）
    const allPonds = mapData.waters.filter(w => w.type === 'pond');
    const allRivers = mapData.waters.filter(w => w.type === 'river');
    const terrainExtra = {};

    if (allPonds.length > 0 && allPonds[0].center) {
        const pw0 = allPonds[0];
        terrainExtra.pond = {
            cx: pw0.center.x || 0, cz: pw0.center.z || 0,
            rx: pw0.radius || 8, rz: pw0.radius || 8, depth: 5
        };
    }
    // 所有河流 → rivers 数组（游戏端 createRiverWater 优先读取）
    const validRivers = allRivers.filter(rw => rw.points && rw.points.length >= 2);
    if (validRivers.length > 0) {
        terrainExtra.rivers = validRivers.map(rw => ({
            points: rw.points.map(p => ({ x: p.x, z: p.z })),
            width: rw.width || 20,
            waterLevel: rw.waterLevel,
            waterLevels: rw.waterLevels ? Array.from(rw.waterLevels) : null
        }));
        // 向后兼容单河字段
        const r0 = validRivers[0];
        terrainExtra.riverPoints = r0.points.map(p => ({ x: p.x, z: p.z }));
        terrainExtra.riverWidth = r0.width || 20;
        if (r0.waterLevels && r0.waterLevels.length > 0) {
            terrainExtra.riverWaterLevels = Array.from(r0.waterLevels);
            terrainExtra.riverWaterLevel = r0.waterLevel != null ? r0.waterLevel : r0.waterLevels[r0.waterLevels.length - 1];
        } else if (r0.waterLevel != null) {
            terrainExtra.riverWaterLevel = r0.waterLevel;
        }
    }
    // 桥梁完整数据（含端点，供游戏端精确定位）
    const bridgesCfg = (mapData.bridges || []).map(b => ({
        cx: (b.from.x + b.to.x) / 2,
        cz: (b.from.z + b.to.z) / 2,
        fromX: b.from.x, fromZ: b.from.z,
        toX: b.to.x, toZ: b.to.z,
        halfW: 6, deckH: 0.35
    }));

    const json = {
        version: '1.0',
        name: mapData.name,
        worldSize: worldWidth, playSize: playWidth,
        worldWidth: worldWidth, worldDepth: worldDepth,
        playWidth: playWidth, playDepth: playDepth,
        type: 'single',
        desc: '地图编辑器创建',
        spawnPoints: { p1: [spawnPt[0], spawnPt[1], spawnPt[2]] },
        // terrain 始终包含完整 heightmap（游戏端只认 heightmap）+ 河流/湖泊数据
        terrain: {
            heightmap: Array.from(mapData.heightmap),
            splatMap: Array.from(mapData.splatMap),
            editedVerticesPaint: [...mapData.editedVerticesPaint],
            hmResW, hmResD,  // 游戏端双线性插值所需
            ...(features ? { features } : {}),
            ...terrainExtra
        },
        terrainTypes: {
            default: 'grass', riverBank: { bankWidth: 5, type: 'mud' },
            pondEdge: { bankWidth: 3, type: 'mud' }, hillTop: { radius: 4, type: 'sand' },
            basin: { radius: 3, type: 'sand' }, bridgeSurface: { type: 'asphalt' }
        },
        waters: {
            pond: { waterLevel: allPonds.length > 0 ? (allPonds[0].waterLevel != null ? allPonds[0].waterLevel : -1) : -1 },
            river: { waterLevel: -1 }
        },
        bridges: bridgesCfg,
        roadSystem: mapData.roadSystem || null,
        obstacles: { count: 350, minDist: 6, safeRadius: 10, spawnRadius: 98 },
        entities: mapData.entities.filter(e => e.type !== 'bridge').map(e => {
            const ent = { id: e.id, type: e.type, position: [e.position.x, e.position.y, e.position.z] };
            if (e.subType) ent.subType = e.subType;
            if (e.enemyType) ent.enemyType = e.enemyType;
            if (e.patrol && e.patrol.length > 0) ent.patrolPath = e.patrol.map(wp => [wp.x, wp.z]);
            if (e.yaw) ent.yaw = e.yaw;
            if (e.cfg) ent.cfg = e.cfg;
            return ent;
        }),
    };

    const blob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = (mapData.name || 'untitled') + '.map.json'; a.click();
    URL.revokeObjectURL(url);
    overlayInfo.textContent = '📤 已导出 ' + a.download + (features ? ' (' + features.length + '个地形特征)' : '');
}

// ----- 导入 JSON -----
function importMapJson(file) {
    const reader = new FileReader();
    reader.onload = (ev) => {
        try {
            const json = JSON.parse(ev.target.result);
            // 重置地图
            mapData.name = json.name || 'imported';
            mapData.heightmap.fill(0); mapData.splatMap.fill(0);
            Object.values(entityMarkers).forEach(m => { scene.remove(m); disposeGroup(m); });
            Object.keys(entityMarkers).forEach(k => delete entityMarkers[k]);
            Object.values(patrolLines).forEach(l => { scene.remove(l); l.geometry.dispose(); l.material.dispose(); });
            Object.keys(patrolLines).forEach(k => delete patrolLines[k]);
            Object.values(highlightRings).forEach(r => { scene.remove(r); r.geometry.dispose(); r.material.dispose(); });
            Object.keys(highlightRings).forEach(k => delete highlightRings[k]);
            mapData.entities = []; mapData.groups = []; selectedEntityIds.clear(); entityIdCounter = 1;
            mapData.waters = []; mapData.bridges = [];

            // 加载尺寸（优先新字段，回退到旧字段）
            mapData.worldWidth = json.worldWidth || json.worldSize || 300;
            mapData.worldDepth = json.worldDepth || json.worldSize || 300;
            mapData.playWidth = json.playWidth || json.playSize || 200;
            mapData.playDepth = json.playDepth || json.playSize || 200;
            applyMapDimensions();

            // 加载高度图
            if (json.terrain && json.terrain.heightmap) {
                const arr = json.terrain.heightmap;
                for (let i = 0; i < Math.min(arr.length, hmResW * hmResD); i++) mapData.heightmap[i] = arr[i];
            }
            // 加载已编辑水体顶点
            mapData.editedVerticesPaint = new Set(json.terrain && json.terrain.editedVerticesPaint || []);

            // 加载实体
            if (json.entities) {
                json.entities.forEach(e => {
                    const pos = e.position || (Array.isArray(e.position) ? { x: e.position[0], y: e.position[1] || 0, z: e.position[2] } : { x: 0, y: 0, z: 0 });
                    if (Array.isArray(pos)) { const arr = pos; pos.x = arr[0]; pos.y = arr[1] || 0; pos.z = arr[2]; }
                    const ent = { id: 'e' + (entityIdCounter++), type: e.type, position: { x: pos.x || 0, y: pos.y || 0, z: pos.z || 0 }, yaw: e.yaw || 0 };
                    if (e.subType) ent.subType = e.subType;
                    if (e.enemyType) ent.enemyType = e.enemyType;
                    if (e.patrolPath) ent.patrol = e.patrolPath.map(wp => ({ x: wp[0], y: smpHeight(wp[0], wp[1]), z: wp[1] }));
                    if (e.patrol && !e.patrolPath) ent.patrol = e.patrol;
                    if (e.cfg) ent.cfg = e.cfg; else if (e.type === 'enemy') ent.cfg = defaultEnemyCfg(ent.enemyType || 'assault');
                    mapData.entities.push(ent);
                    // 创建3D标记
                    let marker;
                    switch (ent.type) {
                        case 'spawn': marker = createSpawnMarker(ent.position.x, ent.position.y, ent.position.z, ent.yaw); break;
                        case 'tree': marker = createTreeMarker(ent.position.x, ent.position.y, ent.position.z, ent.subType || 'cone'); break;
                        case 'building': marker = createBuildingMarker(ent.position.x, ent.position.y, ent.position.z, ent.subType || 'bungalow'); break;
                        case 'enemy': {
                            marker = createEnemyMarker(ent.position.x, ent.position.y, ent.position.z, ent.enemyType || 'assault');
                            // 巡逻点
                            if (ent.patrol) ent.patrol.forEach((wp, j) => {
                                const mk = createWaypointMarker(wp.x, wp.y, wp.z, j);
                                entityMarkers[ent.id + '_wp' + j] = mk; scene.add(mk);
                            });
                            refreshPatrolLines(ent.id);
                            break;
                        }
                    }
                    if (marker) { scene.add(marker); entityMarkers[ent.id] = marker; }
                });
            }

            groundPlane.geometry.dispose();
            createGround(); renderHeightmapCanvas();
            mapNameLabel.textContent = (json.name || 'imported') + '.map.json';
            setBrushMode('cursor'); entityMode = null;
            refreshEntityList();
            clearUndoStack(); pushSnapshot();  // 重置撤销栈
            overlayInfo.textContent = '📥 已导入: ' + json.name + ' (' + json.entities.length + '个实体)';
        } catch (err) {
            alert('导入失败: ' + err.message);
            console.error(err);
        }
    };
    reader.readAsText(file);
}

// ----- 蓝图 CRUD (localStorage) -----
const BP_KEY = 'tank_map_editor_blueprints';

function getBlueprints() {
    try { return JSON.parse(localStorage.getItem(BP_KEY) || '[]'); } catch (e) { return []; }
}

function saveBlueprints(bps) {
    localStorage.setItem(BP_KEY, JSON.stringify(bps, (key, value) => {
        // 自动转换所有 TypedArray / Set 等非 JSON 类型
        if (value && typeof value === 'object' && ArrayBuffer.isView(value)) {
            return Array.from(value);
        }
        if (value instanceof Set) return [...value];
        return value;
    }));
}

function saveBlueprint() {
    const name = prompt('草稿名称:', mapData.name || '草稿');
    if (!name) return;
    // base64 压缩（避免 JSON 数组撑爆 localStorage 5MB 限制）
    function _arrToB64(arr) { const b = new Uint8Array(arr.buffer||arr); let s=''; for(let i=0;i<b.length;i++)s+=String.fromCharCode(b[i]); return btoa(s); }

    const data = {
        name, savedAt: new Date().toISOString(),
        worldWidth: worldWidth, worldDepth: worldDepth,
        playWidth: playWidth, playDepth: playDepth,
        hmResW, hmResD,
        heightmapB64: _arrToB64(mapData.heightmap),
        splatMapB64: _arrToB64(mapData.splatMap),
        waters: mapData.waters,
        bridges: mapData.bridges,
        entities: mapData.entities,
        groups: mapData.groups,
        editedVerticesPaint: mapData.editedVerticesPaint,
        roadSystem: mapData.roadSystem || null,
    };
    const bps = getBlueprints();
    const idx = bps.findIndex(b => b.name === name);
    if (idx >= 0) bps[idx] = data; else bps.push(data);
    saveBlueprints(bps);
    overlayInfo.textContent = '💾 草稿已暂存: ' + name + ' (刷新浏览器不丢失)';
}

function showBlueprintModal() {
    const bps = getBlueprints();
    // 诊断日志
    const allKeys = [];
    for (let i = 0; i < localStorage.length; i++) allKeys.push(localStorage.key(i));
    console.log('🔍 [编辑器] localStorage 全部键:', allKeys);
    console.log('📝 [编辑器] 蓝图数量:', bps.length, bps.length > 0 ? '名称: ' + bps.map(b => b.name).join(', ') : '⚠️ 无蓝图');
    const list = document.getElementById('bp-list');
    if (bps.length === 0) { list.innerHTML = '<div style="color:#888;font-size:12px;">暂无草稿。使用"💾暂存草稿"创建，刷新/关闭浏览器不丢失。</div>'; }
    else {
        list.innerHTML = bps.map(b => {
            const ts = new Date(b.savedAt).toLocaleString('zh-CN');
            const ecount = b.entities ? b.entities.length : 0;
            return `<div class="bp-row">
                <span class="bp-name">📄 ${b.name}</span>
                <span class="bp-info">${ecount}实体 ${ts}</span>
                <button class="bp-btn" data-bpload="${b.name}">加载</button>
                <button class="bp-btn danger" data-bpdel="${b.name}">×</button>
            </div>`;
        }).join('');
    }
    document.getElementById('blueprint-modal').classList.add('show');

    // 事件绑定
    list.querySelectorAll('[data-bpload]').forEach(btn => {
        btn.addEventListener('click', () => { loadBlueprint(btn.dataset.bpload); closeBlueprintModal(); });
    });
    list.querySelectorAll('[data-bpdel]').forEach(btn => {
        btn.addEventListener('click', () => {
            if (!confirm('删除草稿"' + btn.dataset.bpdel + '"？\n（此操作不可恢复）')) return;
            let bps = getBlueprints().filter(b => b.name !== btn.dataset.bpdel);
            saveBlueprints(bps);
            document.getElementById('blueprint-modal').classList.remove('show');
            if (bps.length > 0) showBlueprintModal();
            else closeBlueprintModal();
        });
    });
}

function closeBlueprintModal() {
    document.getElementById('blueprint-modal').classList.remove('show');
}

function loadBlueprint(name) {
    const bps = getBlueprints();
    const bp = bps.find(b => b.name === name);
    if (!bp) return;

    // 清理当前状态
    Object.values(entityMarkers).forEach(m => { scene.remove(m); disposeGroup(m); });
    Object.keys(entityMarkers).forEach(k => delete entityMarkers[k]);
    Object.values(patrolLines).forEach(l => { scene.remove(l); l.geometry.dispose(); l.material.dispose(); });
    Object.keys(patrolLines).forEach(k => delete patrolLines[k]);
    Object.values(highlightRings).forEach(r => { scene.remove(r); r.geometry.dispose(); r.material.dispose(); });
    Object.keys(highlightRings).forEach(k => delete highlightRings[k]);

    // 恢复地图尺寸（大尺寸地图的关键数据）
    worldWidth = mapData.worldWidth = bp.worldWidth || 300;
    worldDepth = mapData.worldDepth = bp.worldDepth || 300;
    playWidth = mapData.playWidth = bp.playWidth || 200;
    playDepth = mapData.playDepth = bp.playDepth || 200;
    applyMapDimensions();  // 同步派生变量 hmStepW/D, worldHalfW/D 等
    // 若蓝图保存了分辨率则优先使用
    if (bp.hmResW) { hmResW = bp.hmResW; hmStepW = worldWidth / (hmResW - 1); }
    if (bp.hmResD) { hmResD = bp.hmResD; hmStepD = worldDepth / (hmResD - 1); }

    mapData.name = bp.name;
    mapData.roadSystem = bp.roadSystem || null;
    // base64 解码
    function _b64ToArr(b64, TypedArr) {
        const bin = atob(b64); const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        return new TypedArr(bytes.buffer);
    }
    const hmArr = bp.heightmapB64 ? _b64ToArr(bp.heightmapB64, Float32Array) : (bp.heightmap || new Float32Array(hmResW*hmResD));
    const smArr = bp.splatMapB64 ? _b64ToArr(bp.splatMapB64, Uint8Array) : (bp.splatMap || new Uint8Array(hmResW*hmResD));
    for (let i = 0; i < Math.min(hmArr.length, hmResW * hmResD); i++) mapData.heightmap[i] = hmArr[i];
    for (let i = 0; i < Math.min(smArr.length, hmResW * hmResD); i++) mapData.splatMap[i] = smArr[i];
    mapData.entities = []; mapData.groups = bp.groups || []; selectedEntityIds.clear(); entityIdCounter = 1;
    mapData.waters = bp.waters || []; mapData.bridges = bp.bridges || [];
    mapData.editedVerticesPaint = new Set(bp.editedVerticesPaint || []);
    if (bp.entities) {
        bp.entities.forEach(e => {
            ent = { ...e, id: 'e' + (entityIdCounter++) };
            mapData.entities.push(ent);
            let marker;
            switch (ent.type) {
                case 'spawn': marker = createSpawnMarker(ent.position.x, ent.position.y, ent.position.z, ent.yaw || 0); break;
                case 'tree': marker = createTreeMarker(ent.position.x, ent.position.y, ent.position.z, ent.subType || 'cone'); break;
                case 'building': marker = createBuildingMarker(ent.position.x, ent.position.y, ent.position.z, ent.subType || 'bungalow'); break;
                case 'enemy':
                    marker = createEnemyMarker(ent.position.x, ent.position.y, ent.position.z, ent.enemyType || 'assault');
                    if (ent.patrol) ent.patrol.forEach((wp, j) => { const mk = createWaypointMarker(wp.x, wp.y, wp.z, j); entityMarkers[ent.id + '_wp' + j] = mk; scene.add(mk); });
                    refreshPatrolLines(ent.id);
                    break;
            }
            if (marker) { scene.add(marker); entityMarkers[ent.id] = marker; }
        });
    }
    groundPlane.geometry.dispose();
    createGround(); createGrid(); renderHeightmapCanvas();
    // 重建桥梁网格
    mapData.bridges.forEach(b => { const m = createBridgeMesh(b); scene.add(m); bridgeMeshes[b.id] = m; });
    mapNameLabel.textContent = bp.name + '.map.json';
    setBrushMode('cursor'); entityMode = null;
    refreshEntityList();
    refreshWaterList();
    clearUndoStack(); pushSnapshot();  // 重置撤销栈
    overlayInfo.textContent = '📂 已恢复草稿: ' + bp.name;
}

// ----- 导入文件选择 -----
document.getElementById('file-import').addEventListener('change', (ev) => {
    if (ev.target.files[0]) { importMapJson(ev.target.files[0]); ev.target.value = ''; }
});

// ----- 事件绑定 -----
btnExportJson.addEventListener('click', exportMapJson);
document.getElementById('btn-save-bp').addEventListener('click', saveBlueprint);
document.getElementById('btn-load-bp').addEventListener('click', showBlueprintModal);
document.getElementById('btn-import-json').addEventListener('click', () => document.getElementById('file-import').click());
document.getElementById('bp-modal-close').addEventListener('click', closeBlueprintModal);
document.getElementById('blueprint-modal').addEventListener('click', (ev) => { if (ev.target === ev.currentTarget) closeBlueprintModal(); });
btnResetView.addEventListener('click', () => setViewMode('top'));
selView.addEventListener('change', () => setViewMode(selView.value));

// 笔刷模式按钮
document.getElementById('btn-cursor').addEventListener('click', () => setBrushMode('cursor'));
document.getElementById('btn-raise').addEventListener('click', () => setBrushMode('raise'));
document.getElementById('btn-lower').addEventListener('click', () => setBrushMode('lower'));
document.getElementById('btn-smooth').addEventListener('click', () => setBrushMode('smooth'));
document.getElementById('btn-paint').addEventListener('click', () => setBrushMode('paint'));

// 笔刷参数
sldR.addEventListener('input', () => { brushRadius = parseInt(sldR.value); });
sldS.addEventListener('input', () => { brushStrength = parseInt(sldS.value); });

// 纹理色块
document.querySelectorAll('.terrain-swatch').forEach(sw => {
    sw.addEventListener('click', () => {
        document.querySelectorAll('.terrain-swatch').forEach(s => s.classList.remove('active'));
        sw.classList.add('active');
        paintType = parseInt(sw.dataset.type);
    });
});

// 实体放置模式

// --- 场景管理 ---
function resize() {
    const w = vp.clientWidth, h = Math.max(vp.clientHeight, 1);
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);

// 渲染循环（30fps限帧 + 脏矩形批处理）
let lastFrameTime = 0;
const FRAME_MS = 1000 / 30;  // 30fps
// needsHmRender 在主文件中定义
function animate(now) {
    requestAnimationFrame(animate);
    if (now - lastFrameTime < FRAME_MS) return;
    lastFrameTime = now;

    // 批量纹理patch（笔刷编辑延迟到帧末）
    if (dirtyTex) {
        for (const k of affectedBlocks) {
            const [sx, sy] = k.split(',').map(Number);
            patchTexBlock(sx, sy);
        }
        if (groundPlane && groundPlane.material.map) groundPlane.material.map.needsUpdate = true;
        updateTerrainStats();
        dirtyTex = false;
        affectedBlocks.clear();
    }

    // 延迟高度图刷新
    if (needsHmRender) {
        renderHeightmapCanvas();
        needsHmRender = false;
    }

    renderer.render(scene, camera);
}

// 初始化
function init() {
    applyMapDimensions();
    resize(); createGround(); createGrid(); renderHeightmapCanvas();
    setViewMode('top'); setBrushMode('cursor');
    mapNameLabel.textContent = '未命名地图';
    document.getElementById('info-segments').textContent = hmResW + '×' + hmResD;
    document.getElementById('status-tool').textContent = '选择';
    refreshWaterList();
    console.log('✅ 地图编辑器 v0.33.1 桥梁引道修整 初始化完成');
}

