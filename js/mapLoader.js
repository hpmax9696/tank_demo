// ==================== 地图系统 ====================
// 地图配置：从 maps/ 目录动态加载，启动时自动 fetch
var MAP_CONFIGS = {};
var mapsLoadPromise = null;

async function loadMapsFromDirectory() {
    if (mapsLoadPromise) return mapsLoadPromise;
    mapsLoadPromise = (async () => {
        try {
            const idxResp = await fetch('maps/_index.json');
            if (!idxResp.ok) throw new Error('_index.json not found');
            const fileList = await idxResp.json();
            console.log('🗺️ 地图清单:', fileList.length, '个文件');

            const results = await Promise.allSettled(
                fileList.map(async (filename) => {
                    const resp = await fetch('maps/' + filename);
                    if (!resp.ok) throw new Error(filename + ' load failed');
                    const cfg = await resp.json();
                    const mapId = cfg._mapId || filename.replace('.map.json', '');
                    delete cfg._mapId;
                    MAP_CONFIGS[mapId] = cfg;
                    return mapId;
                })
            );

            const loaded = results.filter(r => r.status === 'fulfilled').map(r => r.value);
            const failed = results.filter(r => r.status === 'rejected');
            console.log('✅ 已加载地图:', loaded.join(', '));
            if (failed.length > 0) console.warn('⚠️ 加载失败:', failed.map(r => r.reason.message).join(', '));
        } catch (e) {
            console.warn('⚠️ 地图动态加载失败，回退到默认地图:', e.message);
            MAP_CONFIGS["test_map_01a"] = { version: "1.0", name: "默认地图(离线)", size: 200, playWidth: 200, playDepth: 200, worldWidth: 300, worldDepth: 300, type: "single", desc: "动态加载失败时的回退地图", spawnPoints: { p1: [0,0,1.57] }, terrain: { pond: { cx:0, cz:50, rx:4.5, rz:6, depth:5 } }, terrainTypes: { default:"grass" }, waters: { pond:{ waterLevel:-1 } }, obstacles: { count:350, minDist:6, safeRadius:10, spawnRadius:98 } };
        }
    })();
    return mapsLoadPromise;
}

// 页面启动时立即加载地图（异步）；同步预置回退默认地图防止 initScene 时 currentMapData 为空
MAP_CONFIGS["test_map_01a"] = { version: "1.0", name: "默认地图(离线)", size: 200, playWidth: 200, playDepth: 200, worldWidth: 300, worldDepth: 300, type: "single", desc: "动态加载失败时的回退地图", spawnPoints: { p1: [0,0,1.57] }, terrain: { pond: { cx:0, cz:50, rx:4.5, rz:6, depth:5 } }, terrainTypes: { default:"grass" }, waters: { pond:{ waterLevel:-1 } }, obstacles: { count:350, minDist:6, safeRadius:10, spawnRadius:98 } };
loadMapsFromDirectory();
var currentMapData = null;
var isSceneInitialized = false;
var TERRAIN_TYPE_NAMES = ['grass', 'mud', 'sand', 'concrete', 'asphalt', 'brick'];
var TERRAIN_TYPE_INDEX = { grass: 0, mud: 1, sand: 2, concrete: 3, asphalt: 4, brick: 5 };

// 将三种旧河流格式统一为 _normalizedRivers[]（路径点格式）
function normalizeRiverData(md) {
    if (!md || !md.terrain) return [];
    const t = md.terrain;
    // Case 1: 已归一化
    if (t._normalizedRivers) return t._normalizedRivers;
    const rivers = [];
    // Case 2: terrain.rivers[]（编辑器多河导出或蓝图转换）
    if (t.rivers && t.rivers.length > 0) {
        for (const rv of t.rivers) {
            rivers.push({
                points: rv.points || [],
                width: rv.width || 12,
                waterLevel: rv.waterLevel != null ? rv.waterLevel : -1,
                waterLevels: rv.waterLevels || null,
                depth: rv.depth || 5
            });
        }
    }
    // Case 3: terrain.riverPoints（编辑器旧单河格式）
    else if (t.riverPoints && t.riverPoints.length >= 2) {
        rivers.push({
            points: t.riverPoints,
            width: t.riverWidth || 12,
            waterLevel: t.riverWaterLevel != null ? t.riverWaterLevel : -1,
            waterLevels: t.riverWaterLevels || null,
            depth: 5
        });
    }
    // Case 4: terrain.river（参数化正弦波）
    else if (t.river) {
        const r = t.river;
        const NUM_SAMPLES = 128;
        const pts = [];
        const worldW = md.worldWidth || md.worldSize || md.size || 200;
        const half = worldW / 2;
        for (let i = 0; i <= NUM_SAMPLES; i++) {
            const x = -half + i * (worldW / NUM_SAMPLES);
            const zc = r.zc + r.amp * Math.sin(x / r.period);
            pts.push({ x, z: zc });
        }
        const avgHw = (r.hwBase || 6.25) + (r.hwVar || 1.25) * 0.5;
        rivers.push({
            points: pts,
            width: avgHw * 2,
            waterLevel: -1.0,
            waterLevels: null,
            depth: r.depth || 5
        });
    }
    t._normalizedRivers = rivers;
    return rivers;
}

function loadMapConfig(mapId) {
    // 编辑器地图：从 localStorage 读取
    if (mapId.startsWith('editor_')) {
        const bpName = mapId.slice(7); // 去掉 'editor_' 前缀
        try {
            const bps = JSON.parse(localStorage.getItem('tank_map_editor_blueprints') || '[]');
            const bp = bps.find(b => b.name === bpName);
            if (bp) {
                currentMapData = convertBlueprintToMapConfig(bp);
                normalizeRiverData(currentMapData);
                isVersusMap = false;
                // 更新全局尺寸变量（编辑器地图也需要）
                const _epw = currentMapData.playWidth || 200;
                const _epd = currentMapData.playDepth || 200;
                const _eww = currentMapData.worldWidth || Math.max(300, _epw + 100);
                const _ewd = currentMapData.worldDepth || Math.max(300, _epd + 100);
                playHalfW = _epw / 2; playHalfD = _epd / 2;
                worldHalfW = _eww / 2; worldHalfD = _ewd / 2;
                spawnHalfW = playHalfW - 2; spawnHalfD = playHalfD - 2;
                const _eminSide = Math.min(playHalfW, playHalfD);
                obsVisibleRadius = _eminSide * 0.9;
                grassVisibleRadius = _eminSide * 0.95;
                return true;
            }
        } catch(e) { console.warn('编辑器地图读取失败:', e); }
        return false;
    }
    currentMapData = MAP_CONFIGS[mapId];
    if (!currentMapData) return false;
    normalizeRiverData(currentMapData);
    // 矩形尺寸兜底（优先读取新字段，回退到旧字段，再回退到默认值）
    const _pw = currentMapData.playWidth || currentMapData.size || 200;
    const _pd = currentMapData.playDepth || currentMapData.size || 200;
    const _ww = currentMapData.worldWidth || currentMapData.worldSize || Math.max(300, _pw + 100);
    const _wd = currentMapData.worldDepth || currentMapData.worldSize || Math.max(300, _pd + 100);
    currentMapData.playWidth = _pw;
    currentMapData.playDepth = _pd;
    currentMapData.worldWidth = Math.max(_ww, _pw);
    currentMapData.worldDepth = Math.max(_wd, _pd);
    // 更新全局尺寸变量
    playHalfW = _pw / 2; playHalfD = _pd / 2;
    worldHalfW = currentMapData.worldWidth / 2; worldHalfD = currentMapData.worldDepth / 2;
    spawnHalfW = playHalfW - 2; spawnHalfD = playHalfD - 2;
    const _minSide = Math.min(playHalfW, playHalfD);
    obsVisibleRadius = _minSide * 0.9;
    grassVisibleRadius = _minSide * 0.95;
    // 根据地图类型设置全局标志
    isVersusMap = (currentMapData.type === 'versus' || currentMapData.flat);
    return true;
}

// 编辑器蓝图→地图配置转换
function convertBlueprintToMapConfig(bp) {
    const spawnEnt = (bp.entities||[]).find(e => e.type === 'spawn');
    const spawn = spawnEnt ? [spawnEnt.position.x, spawnEnt.position.z, spawnEnt.yaw || 0] : [0, 0, 0];
    const enemies = (bp.entities||[]).filter(e => e.type === 'enemy').map(e => ({
        id: e.id,
        type: e.enemyType === 'zombie' ? 'zombie' : 'assault-vehicle',
        position: [e.position.x, e.position.y, e.position.z],
        patrolPath: (e.patrol||[]).map(wp => [wp.x, wp.z]),
        hp: (e.cfg||{}).hp || 60,
        speed: (e.cfg||{}).speed || 5,
        viewDist: (e.cfg||{}).viewDist || 50,
        attackDamage: (e.cfg||{}).attackDamage || 15,
        attackCooldown: (e.cfg||{}).attackCooldown || 3,
        dropRate: (e.cfg||{}).dropRate || 0.25,
        dropHeal: (e.cfg||{}).dropHeal || 30,
        reactive: (e.cfg||{}).reactive !== false,
        aggressive: !!(e.cfg||{}).aggressive,
        score: (e.cfg||{}).score || 100,
    }));
    // 编辑器水体 → 主游戏 waters 格式
    const editorWaters = bp.waters || [];
    const pondW = editorWaters.find(w => w.type === 'pond');
    const allRivers = editorWaters.filter(w => w.type === 'river');
    const watersCfg = {};
    const terrainExtra = {};
    if (pondW || allRivers.length > 0) {
        watersCfg.pond = { waterLevel: pondW ? (pondW.waterLevel ?? -1) : -1 };
        watersCfg.river = { waterLevel: -1 };
    }
    if (pondW && pondW.center) {
        terrainExtra.pond = {
            cx: pondW.center.x || 0, cz: pondW.center.z || 0,
            rx: (pondW.radius || 8), rz: (pondW.radius || 8), depth: 5
        };
    }
    // 多河流支持：遍历所有河
    const validRivers = allRivers.filter(rw => rw.points && rw.points.length >= 2);
    if (validRivers.length > 0) {
        terrainExtra.rivers = validRivers.map(rw => ({
            points: rw.points.map(p => ({ x: p.x, z: p.z })),
            width: rw.width || 12,
            waterLevel: rw.waterLevel,
            waterLevels: rw.waterLevels ? Array.from(rw.waterLevels) : null,
            depth: 5
        }));
        // 向后兼容单河字段
        const r0 = validRivers[0];
        terrainExtra.riverPoints = r0.points.map(p => ({ x: p.x, z: p.z }));
        terrainExtra.riverWidth = r0.width || 12;
        if (r0.waterLevels && r0.waterLevels.length > 0) {
            terrainExtra.riverWaterLevels = Array.from(r0.waterLevels);
            terrainExtra.riverWaterLevel = r0.waterLevel != null ? r0.waterLevel : r0.waterLevels[r0.waterLevels.length - 1];
        } else if (r0.waterLevel != null) {
            terrainExtra.riverWaterLevel = r0.waterLevel;
        }
    }
    // 桥梁
    const editorBridges = bp.bridges || [];
    const bridgesCfg = editorBridges.map(b => ({
        cx: (b.from.x + b.to.x) / 2,
        cz: (b.from.z + b.to.z) / 2,
        fromX: b.from.x, fromZ: b.from.z,
        toX: b.to.x, toZ: b.to.z,
        halfW: 6,
        deckH: 0.35,
        deckY: b.deckY != null ? b.deckY : null,
    }));
    // 编辑器放置的建筑/树木实体（用于游戏端直接放置）
    const editorBuildings = (bp.entities || []).filter(e => e.type === 'building').map(e => ({
        x: e.position.x, z: e.position.z, type: e.subType || 'bungalow'
    }));
    const editorTrees = (bp.entities || []).filter(e => e.type === 'tree').map(e => ({
        x: e.position.x, z: e.position.z, type: e.subType || 'cone'
    }));
    // 编辑器地图障碍物：仅使用用户手动放置的，不自动生成
    const obstacleCount = 0;
    // 从蓝图读取矩形尺寸（回退到默认值）
    const _pw = bp.playWidth || 200;
    const _pd = bp.playDepth || 200;
    const _ww = bp.worldWidth || Math.max(300, _pw + 100);
    const _wd = bp.worldDepth || Math.max(300, _pd + 100);
    const _spawnHalfW = _pw / 2 - 2;
    const _spawnHalfD = _pd / 2 - 2;
    // 解码 base64 高度图/splatMap（编辑器存 heightmapB64/splatMapB64，旧格式回退）
    let _hm = bp.heightmap, _sm = bp.splatMap;
    if (!_hm && bp.heightmapB64) {
        const bin = atob(bp.heightmapB64); const b = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i);
        _hm = Array.from(new Float32Array(b.buffer));
    }
    if (!_sm && bp.splatMapB64) {
        const bin = atob(bp.splatMapB64); _sm = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) _sm[i] = bin.charCodeAt(i);
    }
    return {
        version: '1.0',
        name: '📝编辑器:' + bp.name,
        size: _pw,  // 向后兼容
        playWidth: _pw,
        playDepth: _pd,
        worldWidth: _ww,
        worldDepth: _wd,
        type: 'single',
        mode: 'combat',
        desc: '地图编辑器创建 (' + enemies.length + '个敌人)',
        spawnPoints: { p1: spawn },
        terrain: { heightmap: _hm, width: bp.hmResW || 256, depth: bp.hmResD || 256, rangeMin: -5, rangeMax: 5, splatMap: _sm, ...terrainExtra },
        waters: Object.keys(watersCfg).length > 0 ? watersCfg : undefined,
        bridges: bridgesCfg.length > 0 ? bridgesCfg : undefined,
        terrainTypes: { default: 'grass' },
        enemies,
        players: { lives: 3, hp: 100, cannonDamage: 40, cannonReload: 2.5, mgDamage: 2, mgFireRate: 10 },
        obstacles: { count: obstacleCount, minDist: 6, safeRadius: 10, spawnRadius: Math.min(_spawnHalfW, _spawnHalfD), buildings: editorBuildings, editorTrees, spawnHalfW: _spawnHalfW, spawnHalfD: _spawnHalfD },
        roadSystem: bp.roadSystem || null,
    };
}

// 简单 FBM 噪声（用于生成自然地形斑块）
function noise2D(x, z, seed) {
    const n = Math.sin(x * 12.9898 + z * 78.233 + seed) * 43758.5453;
    return n - Math.floor(n);
}
function smoothNoise(x, z, seed) {
    const ix = Math.floor(x), iz = Math.floor(z);
    const fx = x - ix, fz = z - iz;
    const sx = fx * fx * (3 - 2 * fx); // smoothstep
    const sz = fz * fz * (3 - 2 * fz);
    const v00 = noise2D(ix, iz, seed), v10 = noise2D(ix + 1, iz, seed);
    const v01 = noise2D(ix, iz + 1, seed), v11 = noise2D(ix + 1, iz + 1, seed);
    const a = v00 + (v10 - v00) * sx;
    const b = v01 + (v11 - v01) * sx;
    return a + (b - a) * sz;
}
function fbmNoise(x, z, seed) {
    let v = 0, amp = 0.6, freq = 1, total = 0;
    for (let o = 0; o < 4; o++) {
        v += smoothNoise(x * freq, z * freq, seed + o * 17) * amp;
        total += amp;
        amp *= 0.5;
        freq *= 2.3;
    }
    return v / total;
}

// splat map：256x256，每像素编码地貌类型(0~5)
function generateSplatMap(worldHalf) {
    const md = currentMapData;
    if (!md || !md.terrain) { const d = new Uint8Array(65536); d.fill(0); return d; }
    // 使用地图的实际 splatMap 分辨率（动态尺寸）
    const _hmW = (md.terrain.hmResW || md.terrain.width) || 256;
    const _hmD = (md.terrain.hmResD || md.terrain.depth || md.terrain.width) || 256;
    const sizeW = _hmW, sizeD = _hmD;
    const total = sizeW * sizeD;
    const data = new Uint8Array(total);
    const defaultType = TERRAIN_TYPE_INDEX[md.terrainTypes ? md.terrainTypes.default : 'grass'] || 0;
    for (let i = 0; i < total; i++) data[i] = defaultType;

    // 编辑器地图：加载蓝图的 splatMap
    const hasSplatMap = md.terrain && md.terrain.splatMap;
    if (hasSplatMap) {
        const sm = md.terrain.splatMap;
        for (let sy = 0; sy < Math.min(sizeD, _hmD); sy++)
            for (let sx = 0; sx < Math.min(sizeW, _hmW); sx++)
                data[sy * sizeW + sx] = Math.min(5, Math.max(0, sm[sy * _hmW + sx] | 0));
    }
    // 沿归一化河流路径绘制泥地纹理（编辑器不写，Demo 统一生成）
    if (md.terrain && md.terrain._normalizedRivers) {
        const halfW2 = (typeof worldHalfW !== 'undefined' ? worldHalfW : 150);
        const halfD2 = (typeof worldHalfD !== 'undefined' ? worldHalfD : 150);
        const scaleW2 = (halfW2 * 2) / sizeW;
        const scaleD2 = (halfD2 * 2) / sizeD;
        const normRivers = md.terrain._normalizedRivers;
        for (const rv of normRivers) {
            const pts = rv.points; if (!pts || pts.length < 2) continue;
            const mudHw = rv.width / 2 + 4; // 河半宽 + 岸外4m
            // 包围盒 + 2格余量
            let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
            for (const p of pts) { if(p.x<minX)minX=p.x; if(p.x>maxX)maxX=p.x; if(p.z<minZ)minZ=p.z; if(p.z>maxZ)maxZ=p.z; }
            minX = Math.max(-halfW2, minX - mudHw - 2*scaleW2);
            maxX = Math.min( halfW2, maxX + mudHw + 2*scaleW2);
            minZ = Math.max(-halfD2, minZ - mudHw - 2*scaleD2);
            maxZ = Math.min( halfD2, maxZ + mudHw + 2*scaleD2);
            const sMinX = Math.floor((minX + halfW2) / scaleW2);
            const sMaxX = Math.ceil((maxX + halfW2) / scaleW2);
            const sMinZ = Math.floor((minZ + halfD2) / scaleD2);
            const sMaxZ = Math.ceil((maxZ + halfD2) / scaleD2);
            for (let sy = Math.max(0,sMinZ); sy < Math.min(sizeD,sMaxZ); sy++) {
                const wz = -halfD2 + sy * scaleD2;
                for (let sx = Math.max(0,sMinX); sx < Math.min(sizeW,sMaxX); sx++) {
                    const wx = -halfW2 + sx * scaleW2;
                    let minD = Infinity;
                    for (let i = 0; i < pts.length - 1; i++) {
                        const d = _pointToSegDist2D(wx, wz, pts[i].x, pts[i].z, pts[i+1].x, pts[i+1].z);
                        if (d < minD) { minD = d; if (minD < mudHw) break; }
                    }
                    if (minD < mudHw) data[sy * sizeW + sx] = 1;
                }
            }
        }
    }
    if (hasSplatMap) return data;

    if (!md.terrainTypes || isVersusMap) return data;

    const tt = md.terrainTypes, t = md.terrain;
    const half = worldHalf || md.size / 2;  // 支持扩展地图
    const scaleW = (half * 2) / sizeW; // world units per pixel (X)
    const scaleD = (half * 2) / sizeD; // world units per pixel (Z)

    for (let sy = 0; sy < sizeD; sy++) {
        const wz = -half + sy * scaleD; // world Z
        for (let sx = 0; sx < sizeW; sx++) {
            const wx = -half + sx * scaleW; // world X
            const idx = sy * sizeW + sx;

            // 河流岸边+河床→泥地（河床覆盖泥地，避免草地透过河水）
            if (t && t.river && tt.riverBank) {
                const rzc = t.river.zc + t.river.amp * Math.sin(wx / t.river.period);
                const rhw = t.river.hwBase + t.river.hwVar * Math.sin(wx / t.river.hwPeriod + t.river.hwPhase);
                const dist = Math.abs(wz - rzc);
                if (dist <= rhw + tt.riverBank.bankWidth) {
                    data[idx] = TERRAIN_TYPE_INDEX[tt.riverBank.type] || 1; // mud
                }
            }

            // 池塘边缘→泥地
            if (t && t.pond && tt.pondEdge) {
                const px = wx - t.pond.cx, pz = wz - t.pond.cz;
                const ed = Math.sqrt((px*px)/(t.pond.rx*t.pond.rx) + (pz*pz)/(t.pond.rz*t.pond.rz));
                if (ed > 1.0 && ed <= 1.0 + tt.pondEdge.bankWidth / Math.max(t.pond.rx, t.pond.rz)) {
                    data[idx] = TERRAIN_TYPE_INDEX[tt.pondEdge.type] || 1;
                }
            }

            // 桥梁表面→柏油路
            if (tt.bridgeSurface && t && t.river) {
                const rzc2 = t.river.zc + t.river.amp * Math.sin(wx / t.river.period);
                const rhw2 = t.river.hwBase + t.river.hwVar * Math.sin(wx / t.river.hwPeriod + t.river.hwPhase);
                if (Math.abs(wx) <= 4 && Math.abs(wz - rzc2) <= rhw2 + 0.8) {
                    data[idx] = TERRAIN_TYPE_INDEX[tt.bridgeSurface.type] || 4;
                }
            }

            // 山丘顶部→沙地
            if (t && t.hill && tt.hillTop) {
                const hx = wx - t.hill.cx, hz2 = wz - t.hill.cz;
                const d2 = hx*hx + hz2*hz2;
                if (d2 <= tt.hillTop.radius * tt.hillTop.radius) {
                    data[idx] = TERRAIN_TYPE_INDEX[tt.hillTop.type] || 2;
                }
            }

            // 盆地→沙地
            if (t && t.basin && tt.basin) {
                const bx2 = wx - t.basin.cx, bz2 = wz - t.basin.cz;
                const bd2 = bx2*bx2 + bz2*bz2;
                if (bd2 <= tt.basin.radius * tt.basin.radius) {
                    data[idx] = TERRAIN_TYPE_INDEX[tt.basin.type] || 2;
                }
            }

            // ── 噪声地形斑块：将部分草地替换为泥地/沙地（草地占比≈50%）──
            if (data[idx] === defaultType) { // 仅转换未被特殊地形覆盖的草地像素
                const n = fbmNoise(wx * 0.06, wz * 0.06, 42);
                if (n > 0.78) {
                    data[idx] = TERRAIN_TYPE_INDEX['sand'];    // ~22% 沙地斑块
                } else if (n > 0.50) {
                    data[idx] = TERRAIN_TYPE_INDEX['mud'];    // ~28% 泥地斑块
                }
                // n <= 0.50 → 保持草地 (~50%)
            }
        }
    }
    return data;
}

// 根据 splat map 生成复合地面纹理（2048x2048，覆盖全地面尺寸）
function generateCompositeGroundTexture(groundHalf) {
    const splat = generateSplatMap(groundHalf);
    // splatMap 动态尺寸（匹配编辑器高度图分辨率）
    const _sw = (currentMapData.terrain && (currentMapData.terrain.hmResW || currentMapData.terrain.width)) || 256;
    const _sd = (currentMapData.terrain && (currentMapData.terrain.hmResD || currentMapData.terrain.depth || currentMapData.terrain.width)) || 256;
    const splatSizeW = _sw, splatSizeD = _sd;
    const outSize = 2048;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = outSize;
    const ctx = canvas.getContext('2d');

    // 预生成6种纹理
    const texCanvases = TERRAIN_TYPE_NAMES.map((name, idx) => {
        try { return TerrainTextures[name](); } catch(e) {
            // 回退纯色
            const fc = document.createElement('canvas'); fc.width=fc.height=256;
            const fcx=fc.getContext('2d'); fcx.fillStyle=['#4a8c3f','#6b4a2e','#c4a860','#b0b0b0','#4a4a4a','#a05a3c'][idx];
            fcx.fillRect(0,0,256,256); return fc;
        }
    });

    const half = groundHalf || currentMapData.size / 2;
    const worldSize = half * 2;
    const sw = worldSize / outSize; // world units per output pixel

    // 分块绘制，每个输出像素采样对应纹理
    const blockSize = 8;
    for (let by = 0; by < outSize; by += blockSize) {
        for (let bx = 0; bx < outSize; bx += blockSize) {
            const wx = -half + bx * sw;
            const wz = -half + by * sw;
            // 查找 splat map 中的地形类型
            const sx = Math.floor((wx + half) / (worldSize / splatSizeW));
            const sy = Math.floor((wz + half) / (worldSize / splatSizeD));
            const typeIdx = (sx >= 0 && sx < splatSizeW && sy >= 0 && sy < splatSizeD)
                ? splat[sy * splatSizeW + sx] : 0;
            const texCanvas = texCanvases[Math.min(typeIdx, 5)];

            // 从纹理中采样对应区域绘制到输出
            const texTile = worldSize / 8;  // 纹理平铺单元大小（200→25, 300→37.5）
            const texX = ((wx % texTile) / texTile * 256 + 256) % 256;
            const texY = ((wz % texTile) / texTile * 256 + 256) % 256;
            ctx.drawImage(texCanvas,
                texX, texY, blockSize * sw / texTile * 256, blockSize * sw / texTile * 256,
                bx, by, blockSize, blockSize
            );
        }
    }

    return canvas;
}

// spawnHitSparks 等 → shells.js


// spawnGroundDebris/spawnScorchMark → shells.js

