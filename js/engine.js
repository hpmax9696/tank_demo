// ==================== DOM 引用 ====================
const menuOverlay = document.getElementById('menu-overlay');
const gameContainer = document.getElementById('game-container');
const btnEnter = document.getElementById('btn-enter');
const btnVersus = document.getElementById('btn-versus');
const btnTraining = document.getElementById('btn-training');
const btnBack = document.getElementById('btn-back');
const hintBar = document.getElementById('controls-hint');
const splitLine = document.getElementById('split-line');
const arrowP1 = document.getElementById('arrow-p1');
const arrowP2 = document.getElementById('arrow-p2');
const crosshairEl = document.getElementById('crosshair');
const versusResult = document.getElementById('versus-result');
const resultP1 = document.getElementById('result-p1');
const resultP2 = document.getElementById('result-p2');
// 加载画面
const loadingOverlay = document.getElementById('loading-overlay');
const loadingBar = document.getElementById('loading-bar');
const loadingText = document.getElementById('loading-text');
const loadingTitle = document.getElementById('loading-title');

// ── 地图选择器 DOM ──
const mapSelector = document.getElementById('map-selector');
const mapList = document.getElementById('map-list');
const btnStartGame = document.getElementById('btn-start-game');
const btnCancelMap = document.getElementById('btn-cancel-map');

// ==================== 地图系统 ====================
// 地图配置：从 maps/ 目录动态加载，启动时自动 fetch
const MAP_CONFIGS = {};
let mapsLoadPromise = null;

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
let currentMapData = null;
let isSceneInitialized = false;
const TERRAIN_TYPE_NAMES = ['grass', 'mud', 'sand', 'concrete', 'asphalt', 'brick'];
const TERRAIN_TYPE_INDEX = { grass: 0, mud: 1, sand: 2, concrete: 3, asphalt: 4, brick: 5 };

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

// ==================== 状态机 ====================
let gameMode = 'menu'; // 'menu' | 'single' | 'versus' | 'training'
let isTrainingMode = false;
let trainingPlayerSpawn = { x: -20, z: 0 };
let trainingEnemySpawn = { x: 20, z: 0 };
let trainingRespawnQueued = null; // { player: bool, delay: float } or null
let animationId = null;

// ==================== 键盘输入（事件监听） ====================
window.addEventListener('keydown', (e) => {
    keys[e.code] = true;
    // H键：切换阴影开/关（对照实验，测量阴影对渲染耗时的影响）
    if (e.code === 'F3') { e.preventDefault(); debugToggleColliders(); return; }
    if (e.code === 'F6') { e.preventDefault(); window._showHexColliders = !window._showHexColliders; return; }
    if (e.code === 'KeyH' && !e.ctrlKey && !e.altKey && !e.metaKey) {
        shadowEnabled = !shadowEnabled;
        if (sunLight) sunLight.castShadow = shadowEnabled;
        renderer.shadowMap.enabled = shadowEnabled;
        console.log('🔦 阴影已' + (shadowEnabled ? '开启' : '关闭') + '（H键切换）| 对比渲染耗时变化');
    }
    if (e.code === 'KeyQ' && gameMode !== 'menu') {
        currentShellType = (currentShellType === 'ap') ? 'he' : 'ap';
        playSwitchSound();
        if (player1 && !player1.dead) player1.reloadTimer = RELOAD_TIME;
        console.log('🔫 切换弹种: ' + (currentShellType === 'ap' ? '穿甲弹 AP' : '高爆弹 HE'));
    }
    if (e.code === 'Escape') {
        if (previewContainer.classList.contains('active')) {
            exitPreviewMode();
        } else if (document.getElementById('game-over-overlay').classList.contains('active')) {
            hideGameOverScreen();
            returnToMenu();
        } else if (gameMode !== 'menu') {
            returnToMenu();
        }
    }
    if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)) {
        e.preventDefault();
    }
});

window.addEventListener('mousedown', (e) => {
    if (e.button === 0 && gameMode !== 'menu') { mouseDown = true; mouseFireRequested = true; }
});
window.addEventListener('mouseup', (e) => {
    if (e.button === 0) mouseDown = false;
});
window.addEventListener('blur', () => { mouseDown = false; mouseFireRequested = false; });

// ── Pointer Lock: 鼠标锁定, X→视角旋转, Y→虚拟准星位置(射线投射瞄准) ──
let _pointerLocked = false;
let _virtualMouseY = window.innerHeight / 2; // 虚拟Y, 由movementY累积
document.addEventListener('pointerlockchange', () => {
    _pointerLocked = (document.pointerLockElement === gameContainer);
    if (_pointerLocked) _virtualMouseY = window.innerHeight / 2; // 锁定瞬间重置到中心
});
window.addEventListener('mousemove', (e) => {
    if (_pointerLocked) {
        // X: 转视角, Y: 累积虚拟准星位置
        cameraYaw += e.movementX * CAMERA_MOUSE_SENSITIVITY;
        _virtualMouseY += e.movementY;
        _virtualMouseY = Math.max(60, Math.min(window.innerHeight - 60, _virtualMouseY));
        useGamepad = false;
    } else {
        mouseX = e.clientX; mouseY = e.clientY;
        if (gameMode !== 'menu') {
            crosshairEl.style.left = mouseX + 'px';
            crosshairEl.style.top = mouseY + 'px';
            const dmx = Math.abs(mouseX - prevMouseX), dmy = Math.abs(mouseY - prevMouseY);
            if (dmx > 3 || dmy > 3) useGamepad = false;
        }
        prevMouseX = mouseX; prevMouseY = mouseY;
    }
});
// 点击游戏画布重新锁定鼠标
gameContainer.addEventListener('click', () => {
    if (gameMode !== 'menu' && !_pointerLocked && !useGamepad) {
        gameContainer.requestPointerLock();
    }
});

// ==================== 玩家工厂 ====================
function createPlayer(camoColor, startX, startZ, startYaw, isP1) {
    return {
        group: null, hull: null,
        turretPivot: null, barrelPivot: null, mgGroup: null,
        leftWheels: [], rightWheels: [],
        state: { x: startX, z: startZ, yaw: startYaw },
        leftWheelAngle: 0, rightWheelAngle: 0,
        currentLeftSpeed: 0, currentRightSpeed: 0,
        prevForwardSpeed: 0, pitch: 0, recoilPitch: 0,
        turretYaw: 0, barrelElevation: 0.05,
        mgYaw: 0, mgElev: 0, mgLockTarget: null,
        hp: 100, maxHp: 100, dead: false,
        reloadTimer: 0,
        hpBarGroup: null, hpBarFill: null,
        reloadBarGroup: null, reloadBarFill: null,
        shellLabel: null,
        camoColor, isP1,
        fireReady: true
    };
}

// ==================== 场景变量 ====================
let scene, scene1, camera, renderer;
// 单人模式引用（向后兼容）
let tankGroup, leftWheels = [], rightWheels = [];
let reloadTimer = 0, reloadBarGroup = null, reloadBarFill = null;
// 通用
let player1 = null, player2 = null; // 双人模式玩家
const TANK_HALF_W = 1.2;
const ENEMY_HALF_W = 0.85; // 装甲突击车含履带/铲斗实际半宽
// 坦克模型车体长 1.70 单位 = 8 米 → 1 单位 = 8/1.70 米
const METERS_PER_UNIT = 8 / 1.70;
let obstacleMeshes = [], obstacleData = [];
let _roadMeshes = [];  // 道路可视化网格
let _villageSystem = null;  // 当前地图的道路+村落生成数据
let occluderRaycaster = new THREE.Raycaster();  // 障碍物遮挡检测射线
let occludedObstacles = [];  // 当前被半透明的障碍物列表
let hiddenTreeInstances = [];  // 树木遮挡隐藏列表：[{imTrunk,imCrown,index,matrixTrunk,matrixCrown}]
let transparentTreeGroups = [];  // 树木遮挡半透明替身 Group 列表
let transparentMatPool = new Map();  // 透明材质池：原始材质→半透明clone（避免每帧clone/dispose）
let sunLight = null;  // 主方向光引用（用于H键切换阴影）
let shadowEnabled = true;  // 阴影开关状态
let groundPlane;
let shells = [], fragments = [], muzzleLights = [], ringFX = [];
let explosions = [];  // 爆炸效果数组（坦克死亡时触发的大型火焰烟雾）
let _tmpQuat = new THREE.Quaternion(); // 训练场 enemy shell 复用
let scorchMarks = [];  // 地面焦痕（炮弹击中地面时产生，3秒渐消）
let groundDebris = [];  // 地面命中碎片（土块飞溅，~1秒消失）
let enemies = [];  // PvE 战斗模式敌人数组
let hexapodBullets = [];  // 六足战车加特林弹丸
let hexapodMissiles = []; // 六足战车导弹
let hexapodExplosions = []; // 导弹爆炸效果(独立数组防splice丢失)
let pickups = [];  // 战利品掉落物数组
const PICKUP_RADIUS = 3.0;  // 拾取判定距离（宽松，坦克半宽~1.7m）
let combatData = null;  // 战斗模式运行时数据 { score, lives, phase }
let combatShakeTimer = 0;  // 受击屏幕震动计时器
// mgBullets, mgTimer, mgHeat, mgOverheated → mg.js
let totalDistance = 0;   // 坦克行驶总里程（单位）

// 游戏参数
const TRACK_SPACING = 3.2;
const MAX_SPEED = 8.0;
const TRACK_ACCEL = 10.0, TRACK_DECEL = 16.0, TRACK_COAST = 20.0;
let prevTargetLeft = 0, prevTargetRight = 0; // 上一帧目标：检测摇杆穿中换向
const PITCH_GAIN = 0.015, PITCH_MAX = 0.09, PITCH_SMOOTH = 8.0;
// RECOIL_PITCH 等火炮物理常量 → shells.js
const MAX_SLOPE = 0.52; // 最大爬坡度 ~30°，超过此坡度时自动降速
const OBSTACLE_COUNT = 350;
const POISSON_MIN_DIST = 6.0, SAFE_ZONE_RADIUS = 10.0;
const GRASS_CELL_SIZE = 40;     // 草丛空间分块大小（米）

// ── 地图尺寸动态变量（在 loadMapConfig 中更新，菜单阶段使用默认值）──
let playHalfW = 100, playHalfD = 100;       // 空气墙半宽/半深
let worldHalfW = 150, worldHalfD = 150;     // 世界地形半宽/半深
let spawnHalfW = 98, spawnHalfD = 98;       // Poisson采样半宽/半深
let obsVisibleRadius = 90;                  // 障碍物可见半径
let grassVisibleRadius = 95;                // 草丛可见半径
const POINT_A_X = 0, POINT_A_Z = 0;  // 单人模式出生点（地图原点）
// 炮弹/高爆弹常量 → shells.js

// MG 常量/变量/函数 → mg.js

// ==================== 地形系统（从 currentMapData 读取配置） ====================
let isVersusMap = false;

// 地形参数访问器（优先从 currentMapData 读取，回退到默认值）
// _getPond/_getRiver → waters.js | _getBridge → bridges.js
function _t(key, fallback) {
    if (!currentMapData || !currentMapData.terrain) return fallback;
    return currentMapData.terrain[key] || fallback;
}
function _getHill() { return _t('hill', null); }
function _getBasin() { return _t('basin', null); }

function getGroundHeight(x, z) {
    if (isVersusMap) return 0;
    const bridgeY = getBridgeSurfaceY(x, z);
    if (bridgeY !== null) return bridgeY;
    const roadY = window.getRoadSurfaceY && window.getRoadSurfaceY(x, z);
    if (roadY !== null) return roadY;
    return getTerrainHeight(x, z);
}

function getTerrainHeight(x, z) {
    if (isVersusMap) return 0;
    let y = 0;
    // 离散高度图模式（编辑器地图，支持矩形分辨率）
    const hasHM = currentMapData && currentMapData.terrain && currentMapData.terrain.heightmap;
    if (hasHM) {
        const hm = currentMapData.terrain.heightmap;
        const _hmResW = currentMapData.terrain.hmResW || currentMapData.terrain.width || 256;
        const _hmResD = currentMapData.terrain.hmResD || currentMapData.terrain.depth || currentMapData.terrain.width || 256;
        const u = (x + worldHalfW) / (worldHalfW * 2);
        const v = (z + worldHalfD) / (worldHalfD * 2);
        if (u < 0 || u > 1 || v < 0 || v > 1) return 0;
        const fx = u * (_hmResW - 1), fz = v * (_hmResD - 1);
        const ix = Math.floor(fx), iz = Math.floor(fz);
        const tx = fx - ix, tz = fz - iz;
        const ix1 = Math.min(ix + 1, _hmResW - 1), iz1 = Math.min(iz + 1, _hmResD - 1);
        const a = hm[iz * _hmResW + ix], b = hm[iz * _hmResW + ix1];
        const c = hm[iz1 * _hmResW + ix], d = hm[iz1 * _hmResW + ix1];
        y = (a * (1 - tx) + b * tx) * (1 - tz) + (c * (1 - tx) + d * tx) * tz;
    }
    // ── 池塘 ──
    const pond = _getPond();
    if (pond) {
        const px = x - pond.cx, pz = z - pond.cz;
        const eggDist = Math.sqrt((px*px)/(pond.rx*pond.rx) + (pz*pz)/(pond.rz*pond.rz));
        if (eggDist < 1.0) {
            const tt = 1.0 - eggDist;
            y -= pond.depth * tt * tt * (3.0 - 2.0 * tt);
        }
    }
    // ── 河流（参数化正弦波）──
    const river = _getRiver();
    if (river) {
        const rzc = riverCenterZ(x), rhw = riverHalfWidth(x);
        const rnd = Math.abs(z - rzc) / Math.max(rhw, 0.1);
        if (rnd < 1.0) {
            const tt = 1.0 - rnd;
            y -= river.depth * tt * tt * (3.0 - 2.0 * tt);
        }
    }
    // ── 河流（路径点格式，动态雕刻覆盖，对编辑器/参数化均生效）──
    if (!river) {
        const normRivers = (typeof _getRivers === 'function') ? _getRivers() : [];
        for (const rv of normRivers) {
            const pts = rv.points; if (!pts || pts.length < 2) continue;
            const hw = rv.width / 2;
            const depth = rv.depth || 5;
            let minDist = Infinity;
            for (let i = 0; i < pts.length - 1; i++) {
                const d = _pointToSegDist2D(x, z, pts[i].x, pts[i].z, pts[i+1].x, pts[i+1].z);
                if (d < minDist) minDist = d;
            }
            if (minDist < hw) {
                const t = minDist / hw;
                const carve = depth * (1 - t * t * (3 - 2 * t)); // 全长 smoothstep U 形剖面
                y -= carve;
            }
        }
    }
    // ── 高地 ──
    const hill = _getHill();
    if (hill) {
        const hx = x - hill.cx, hz = z - hill.cz;
        const hd2 = hx*hx + hz*hz;
        const r2 = hill.radius * hill.radius;
        if (hd2 < r2 * 4) y += hill.height * Math.exp(-hd2 / r2);
    }
    // ── 盆地 ──
    const basin = _getBasin();
    if (basin) {
        const bx = x - basin.cx, bz = z - basin.cz;
        const bd2 = bx*bx + bz*bz;
        const r2 = basin.radius * basin.radius;
        if (bd2 < r2 * 4) y -= basin.depth * Math.exp(-bd2 / r2);
    }
    return y;
}

// isInPond / isInRiver → waters.js

// 天空系统已移除（v0.24.5：陡视角看不到天空，节省性能开销）



function initScene() {
    // --- 渲染器 ---
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.domElement.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;display:block;';
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;  // v0.24.10: 降级软阴影→硬阴影，省~10ms
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    gameContainer.appendChild(renderer.domElement);

    // --- 共享光照添加到场景 ---
    function addLightingTo(trg) {
        trg.background = new THREE.Color('#8899aa');  // 匹配雾色，无天空球时远景连贯
        const _minSide = Math.min(worldHalfW, worldHalfD) * 2;
        trg.fog = new THREE.Fog('#8899aa', _minSide * 0.35, _minSide * 0.55);  // 配合陡视角，远处自然消失在雾中
        trg.add(new THREE.AmbientLight('#ffffff', 0.6));
        trg.add(new THREE.HemisphereLight('#ffeeb1', '#446633', 0.5));
        const sun = new THREE.DirectionalLight('#fffef0', 2.5);
        sun.position.set(30, 40, 20);
        sun.castShadow = true;
        sun.shadow.mapSize.width = 1024;  // v0.25.5: 512→1024，配合72m范围保持密度
        sun.shadow.mapSize.height = 1024;
        sun.shadow.camera.near = 0.5;
        sun.shadow.camera.far = 120;
        sun.shadow.camera.left = -36;     // v0.25.5: ±18→±36(72m范围)，覆盖更远距离
        sun.shadow.camera.right = 36;
        sun.shadow.camera.top = 36;
        sun.shadow.camera.bottom = -36;
        sun.shadow.bias = -0.0002;
        trg.add(sun);
        sunLight = sun;  // 保存全局引用供H键切换阴影
        sunLight.target.position.set(0, 0, 0);  // 初始注视原点
        trg.add(sunLight.target);
    }

    // --- 主场景（统一使用 scene1，不再预建 scene2） ---
    // 双人模式通过 rebuildMap() 动态重建为平地地图
    scene1 = new THREE.Scene();
    addLightingTo(scene1);
    createGround(scene1);
    createObstacles(scene1);

    // --- 默认活跃场景 ---
    scene = scene1;

    // --- 草丛覆盖（仅maps带grassCover的地图）---
    placeGrass();

    // --- 水面（池塘）—仅单人模式 ---
    if (!isVersusMap) createWaterSurface();

    // --- 河流（蛇形水面+桥梁）—仅单人模式 ---
    if (!isVersusMap) { createRiverWater(); createBridge(); }

    // --- 坦克 ---
    createTank();
    if (player1) {
        reloadBarGroup = player1.reloadBarGroup;
        reloadBarFill = player1.reloadBarFill;
    }

    // --- 摄像机 ---
    camera = new THREE.PerspectiveCamera(45, renderer.domElement.width / renderer.domElement.height, 0.5, 300);
    placeCamera();
    handleObstacleOcclusion();
    debugRefreshColliders();
}

// ==================== 地图重建（切换单人/双人场景） ====================
function rebuildMap() {
    // 移除地面
    if (groundPlane) { scene.remove(groundPlane); groundPlane.geometry.dispose(); groundPlane.material.dispose(); }
    // groundEdgeLine / fogRing 已移除（v0.24.5）
    // 移除水体/桥梁
    cleanupWater(); cleanupBridge();
    // 清除树木 InstancedMesh
    if (window._treeIMs) {
        for (const im of window._treeIMs) {
            if (im.parent) im.parent.remove(im);
            im.geometry.dispose();
            im.material.dispose();
        }
        window._treeIMs = [];
    }
    // 清除建筑 Group
    obstacleMeshes.forEach(g => {
        if (g.parent) g.parent.remove(g);
        g.traverse(c => { if (c.geometry) c.geometry.dispose(); if (c.material) c.material.dispose(); });
    });
    obstacleMeshes = []; obstacleData = [];
    transparentTreeGroups.forEach(g => {
        if (g.parent) g.parent.remove(g);
        g.traverse(c => { if (c.geometry) c.geometry.dispose(); if (c.material) c.material.dispose(); });
    });
    transparentTreeGroups = [];
    // 清除草丛
    clearGrass();
    // 重建地面
    createGround();
    // 重建草丛（仅带grassCover的地图）
    placeGrass();
    // 重建水景（仅单人模式）
    if (!isVersusMap) { createWaterSurface(); createRiverWater(); createBridge(); }
    // 重建障碍物
    createObstacles();
    debugRefreshColliders();
}

// ==================== 地面（地形+纹理混合，矩形尺寸） ====================
function createGround(targetScene = scene) {
    const ww = currentMapData ? currentMapData.worldWidth : 300;
    const wd = currentMapData ? currentMapData.worldDepth : 300;
    const SEGS_W = ww <= 200 ? 200 : (isVersusMap ? Math.max(32, Math.floor(ww / 10)) : 256);
    const SEGS_D = wd <= 200 ? 200 : (isVersusMap ? Math.max(32, Math.floor(wd / 10)) : 256);
    const groundHalf = Math.max(ww, wd) / 2;  // 纹理覆盖最大范围

    // ── 生成复合地貌纹理（splat map + 程序化纹理混合） ──
    let texture;
    try {
        const compCanvas = generateCompositeGroundTexture(groundHalf);
        texture = new THREE.CanvasTexture(compCanvas);
        texture.wrapS = THREE.ClampToEdgeWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
        texture.repeat.set(1, 1);
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.magFilter = THREE.LinearFilter;
        texture.minFilter = THREE.LinearMipmapLinearFilter;
        texture.generateMipmaps = true;
    } catch (e) {
        console.warn('地貌纹理生成失败，回退纯色:', e);
        const fbCanvas = document.createElement('canvas');
        fbCanvas.width = fbCanvas.height = 256;
        const fbCtx = fbCanvas.getContext('2d');
        fbCtx.fillStyle = '#62994a';
        fbCtx.fillRect(0, 0, 256, 256);
        texture = new THREE.CanvasTexture(fbCanvas);
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(groundHalf * 2 / 5, groundHalf * 2 / 5);
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.magFilter = THREE.LinearFilter;
        texture.minFilter = THREE.LinearMipmapLinearFilter;
        texture.generateMipmaps = true;
    }

    // ── 地形几何（矩形，保持平整不下陷，天际线由环形雾盖负责渐隐）──
    let groundGeo;
    groundGeo = new THREE.PlaneGeometry(ww, wd, SEGS_W, SEGS_D);
    const pos = groundGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
        const gx = pos.getX(i);
        const gy = pos.getY(i);
        const wz = -gy;
        const h = isVersusMap ? 0 : getTerrainHeight(gx, wz);
        pos.setZ(i, h);
    }
    // ── 池塘堤岸修整：强制将池塘边缘地形过渡到水面高度，消除"悬空" ──
    const pond = currentMapData && currentMapData.waters && currentMapData.waters.pond;
    if (pond && pond.rx && pond.rz) {
        const sAngles = [0, Math.PI * 0.5, Math.PI, Math.PI * 1.5];
        const edgeHs = sAngles.map(a => getTerrainHeight(pond.cx + Math.cos(a) * pond.rx, pond.cz + Math.sin(a) * pond.rz));
        const edgeMax = Math.max(...edgeHs);
        const targetH = edgeMax + 0.03; // 与 createWaterSurface 中水面高度一致
        const shoreMargin = 1.25; // 堤岸外扩系数
        for (let i = 0; i < pos.count; i++) {
            const gx = pos.getX(i);
            const gy = pos.getY(i);
            const wz = -gy;
            const dx = gx - pond.cx, dz = wz - pond.cz;
            const ed = Math.sqrt((dx * dx) / (pond.rx * pond.rx) + (dz * dz) / (pond.rz * pond.rz));
            if (ed > shoreMargin) continue;
            const curH = pos.getZ(i);
            // ed<=1.0 处完全修整到 targetH；1.0~shoreMargin 间平滑过渡
            const t = Math.max(0, (ed - 1.0) / (shoreMargin - 1.0));
            const falloff = 1.0 - t * t * (3.0 - 2.0 * t); // smoothstep
            // 强制修整（无论当前高低）到 targetH，确保边缘完全平齐
            pos.setZ(i, curH + (targetH - curH) * falloff);
        }
    }
    groundGeo.computeVertexNormals();

    const groundMat = new THREE.MeshStandardMaterial({
        map: texture,
        roughness: 0.9,
        metalness: 0.0,
    });

    groundPlane = new THREE.Mesh(groundGeo, groundMat);
    groundPlane.rotation.x = -Math.PI / 2;
    groundPlane.position.y = isVersusMap ? -0.01 : 0;
    groundPlane.receiveShadow = true;
    groundPlane.name = 'ground';
    targetScene.add(groundPlane);
    groundMesh = groundPlane;

    // 四面围挡墙（天空色，截断地图边缘溢出的河面/路面）
    if (window._boundaryWalls) {
        window._boundaryWalls.forEach(w => { targetScene.remove(w); if(w.geometry)w.geometry.dispose(); if(w.material)w.material.dispose(); });
    }
    window._boundaryWalls = [];
    const wallMat = new THREE.MeshBasicMaterial({ color: '#8899aa', side: THREE.DoubleSide });
    const wallV = 80, wallBase = -60; // 墙高80m，底部-60m
    const hw = worldHalfW, hd = worldHalfD;
    const wallDefs = [
        { gw: 2*hd, gh: wallV, px: -hw, pz: 0, ry: Math.PI/2 },
        { gw: 2*hd, gh: wallV, px: hw, pz: 0, ry: Math.PI/2 },
        { gw: 2*hw, gh: wallV, px: 0, pz: -hd, ry: 0 },
        { gw: 2*hw, gh: wallV, px: 0, pz: hd, ry: 0 },
    ];
    for (const d of wallDefs) {
        const g = new THREE.PlaneGeometry(d.gw, d.gh);
        const m = new THREE.Mesh(g, wallMat);
        m.position.set(d.px, wallBase + d.gh/2, d.pz);
        m.rotation.y = d.ry;
        m.receiveShadow = false; m.castShadow = false;
        m.renderOrder = 999; m.material.depthTest = true; m.material.depthWrite = true;
        m.name = 'boundaryWall';
        targetScene.add(m);
        window._boundaryWalls.push(m);
    }

    // 环形雾盖已移除（v0.24.4：摄像机陡视角+Camera near/far限制，天然看不到边缘）
}

// ==================== 程序化草丛覆盖系统（InstancedMesh 性能优化） ====================
let grassInstances = [];  // { low, mid, high } → THREE.InstancedMesh

// 合并多个几何体为单个 BufferGeometry
function mergeGeometries(geos) {
    if (geos.length === 1) return geos[0].clone();
    let totalVerts = 0, totalIdx = 0;
    geos.forEach(g => { totalVerts += g.attributes.position.count; totalIdx += (g.index ? g.index.count : g.attributes.position.count); });
    const posArr = new Float32Array(totalVerts * 3);
    const normArr = new Float32Array(totalVerts * 3);
    const idxArr = new Uint32Array(totalIdx);
    let vo = 0, io = 0, bv = 0;
    geos.forEach(g => {
        const gp = g.attributes.position.array;
        const gn = g.attributes.normal ? g.attributes.normal.array : new Float32Array(g.attributes.position.count * 3);
        const gi = g.index ? g.index.array : null;
        posArr.set(gp, vo * 3);
        normArr.set(gn, vo * 3);
        if (gi) {
            for (let i = 0; i < gi.length; i++) idxArr[io + i] = gi[i] + bv;
            io += gi.length;
        } else {
            for (let i = 0; i < gp.length / 3; i++) idxArr[io + i] = bv + i;
            io += gp.length / 3;
        }
        bv += g.attributes.position.count;
        vo += g.attributes.position.count;
    });
    const merged = new THREE.BufferGeometry();
    merged.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
    merged.setAttribute('normal', new THREE.BufferAttribute(normArr, 3));
    merged.setIndex(new THREE.BufferAttribute(idxArr, 1));
    return merged;
}

// 创建弯曲草叶几何体（与 grass.js 相同算法，返回单个几何体）
function createBladeGeo(startX, startZ, tipX, tipH, tipZ, baseR, tipR, curveSegs, radialSegs) {
    const curve = new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(startX, 0, startZ),
        new THREE.Vector3(tipX, tipH, tipZ),
        new THREE.Vector3(startX + (tipX - startX) * 0.7, tipH * 0.5, startZ + (tipZ - startZ) * 0.7)
    );
    const verts = [];
    for (let i = 0; i <= curveSegs; i++) {
        const t = i / curveSegs;
        const pt = curve.getPoint(t);
        const r = baseR + (tipR - baseR) * t;
        const tan = curve.getTangent(t).normalize();
        const up = new THREE.Vector3(0, 1, 0);
        const ax = new THREE.Vector3().crossVectors(up, tan).normalize();
        if (ax.length() < 0.01) ax.set(1, 0, 0);
        const ay = new THREE.Vector3().crossVectors(tan, ax).normalize();
        for (let j = 0; j < radialSegs; j++) {
            const a = (j / radialSegs) * Math.PI * 2;
            verts.push(pt.x + (Math.cos(a) * ax.x + Math.sin(a) * ay.x) * r,
                      pt.y + (Math.cos(a) * ax.y + Math.sin(a) * ay.y) * r,
                      pt.z + (Math.cos(a) * ax.z + Math.sin(a) * ay.z) * r);
        }
    }
    const idxs = [];
    for (let i = 0; i < curveSegs; i++) {
        for (let j = 0; j < radialSegs; j++) {
            const a = i * radialSegs + j, b = i * radialSegs + (j+1) % radialSegs;
            const c = (i+1) * radialSegs + j, d = (i+1) * radialSegs + (j+1) % radialSegs;
            idxs.push(a,b,d, a,d,c);
        }
    }
    const tipV = curveSegs * radialSegs;
    const tp = curve.getPoint(1);
    verts.push(tp.x, tp.y, tp.z);
    for (let j = 0; j < radialSegs; j++) {
        idxs.push(tipV, ((curveSegs) * radialSegs + (j+1) % radialSegs), (curveSegs) * radialSegs + j);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    geo.setIndex(idxs);
    geo.computeVertexNormals();
    return geo;
}

// 创建合并后的草丛几何体（所有叶片合并为一个 Geometry）
function createMergedBushGeo(config) {
    const { bladeCount, minH, maxH, clusterR, spreadA, baseR, tipR, curveSegs, radialSegs, seed } = config;
    const geos = [];
    function srand(s) { let x = Math.sin(s*127.1+311.7)*43758.5453; return x-Math.floor(x); }
    for (let i = 0; i < bladeCount; i++) {
        const s = seed + i * 0.618;
        const angle = srand(s) * Math.PI * 2;
        const dist = clusterR * Math.pow(srand(s+0.1), 0.55);
        const bx = Math.cos(angle) * dist, bz = Math.sin(angle) * dist;
        const h = minH + srand(s+0.2) * (maxH - minH);
        const ta = srand(s+0.3) * spreadA;
        const td = srand(s+0.4) * Math.PI * 2;
        const tx = bx + Math.cos(td) * Math.sin(ta) * h * 0.7;
        const tz = bz + Math.sin(td) * Math.sin(ta) * h * 0.7;
        const br = baseR * (0.8 + srand(s+0.5) * 0.4);
        const tr = tipR * (0.6 + srand(s+0.6) * 0.8);
        const g = createBladeGeo(bx, bz, tx, h, tz, br, tr, curveSegs, radialSegs);
        geos.push(g);
    }
    return mergeGeometries(geos);
}

// 判断某点应放置的草丛类型（基于上下文：距离水/泥/沙等非草地区域的距离）
function determineGrassType(wx, wz, md, splat, half, splatSize) {
    const sx = Math.floor((wx + half) / (md.size / splatSize));
    const sy = Math.floor((wz + half) / (md.size / splatSize));
    if (sx < 0 || sx >= splatSize || sy < 0 || sy >= splatSize) return null;
    const idx = sy * splatSize + sx;
    const terrainIdx = splat[idx];
    // 只覆盖草地（index 0）
    if (terrainIdx !== 0) return null;

    // 检查周围是否有非草地地形（水域、泥地、沙地等）
    let minNonGrassDist = Infinity;

    // 检查附近是否有池塘（水面空气墙）
    if (md.terrain && md.terrain.pond) {
        const p = md.terrain.pond;
        const prx = p.rx + 3, prz = p.rz + 3;
        const dx = (wx - p.cx) / prx, dz = (wz - p.cz) / prz;
        const d = Math.sqrt(dx*dx + dz*dz);
        if (d < 1.0) return 'low'; // 池塘边缘只放低草
        minNonGrassDist = Math.min(minNonGrassDist, (d - 1) * Math.max(prx, prz));
    }

    // 检查附近是否有河流
    if (md.terrain && md.terrain.river) {
        const r = md.terrain.river;
        const rzc = r.zc + r.amp * Math.sin(wx / r.period);
        const rhw = r.hwBase + r.hwVar * Math.sin(wx / r.hwPeriod + r.hwPhase);
        const rDist = Math.abs(wz - rzc) - rhw;
        if (rDist < 2) return 'low'; // 河岸边只放低草
        minNonGrassDist = Math.min(minNonGrassDist, rDist);
    }

    // 扫描周围 splat 像素有无非草地
    const scanR = Math.ceil(4 / (md.size / splatSize)); // 扫描约4m范围
    let hasNonGrass = false;
    for (let dy = -scanR; dy <= scanR && !hasNonGrass; dy++) {
        for (let dx = -scanR; dx <= scanR; dx++) {
            const nsx = sx + dx, nsy = sy + dy;
            if (nsx >= 0 && nsx < splatSize && nsy >= 0 && nsy < splatSize) {
                if (splat[nsy * splatSize + nsx] !== 0) {
                    hasNonGrass = true;
                    const d = Math.sqrt(dx*dx + dy*dy) * (md.size / splatSize);
                    minNonGrassDist = Math.min(minNonGrassDist, d);
                }
            }
        }
    }

    // 基于距离和其他因素决定草丛类型
    // 噪声值用于添加自然变化
    const noiseVal = Math.sin(wx * 0.73 + wz * 0.37) * 0.5 + Math.sin(wx * 0.19 - wz * 0.53) * 0.3 +
                     Math.sin((wx + wz) * 0.41) * 0.2;

    if (minNonGrassDist < 5) {
        // 靠近非草地：低草为主
        const t = minNonGrassDist / 5;
        return noiseVal + t > 0.3 ? 'low' : 'mid';
    } else if (minNonGrassDist < 12) {
        // 过渡带：混合低中高
        const t = (minNonGrassDist - 5) / 7;
        if (noiseVal < -0.3 + t * 0.3) return 'low';
        if (noiseVal > 0.4 - t * 0.2) return 'high';
        return 'mid';
    } else {
        // 开阔草地：中草为主，混高低
        if (noiseVal < -0.4) return 'low';
        if (noiseVal > 0.5) return 'high';
        return 'mid';
    }
}

function placeGrass() {
    const md = currentMapData;
    if (!md || !md.grassCover || !md.grassCover.enabled || isVersusMap) return;

    const gc = md.grassCover;
    const spacing = gc.spacing || 2.8;
    const half = md.size / 2;
    const splatSize = 256;
    const splat = generateSplatMap();

    // --- 预生成三种合并后的草丛几何体 ---
    const bushGeos = {
        low: createMergedBushGeo({
            bladeCount: 10, minH: 0.2, maxH: 0.4,
            clusterR: 0.30, spreadA: 0.35,
            baseR: 0.012, tipR: 0.002,
            curveSegs: 5, radialSegs: 5, seed: 100
        }),
        mid: createMergedBushGeo({
            bladeCount: 15, minH: 0.4, maxH: 0.7,
            clusterR: 0.45, spreadA: 0.45,
            baseR: 0.016, tipR: 0.003,
            curveSegs: 6, radialSegs: 5, seed: 200
        }),
        high: createMergedBushGeo({
            bladeCount: 22, minH: 0.7, maxH: 1.0,
            clusterR: 0.60, spreadA: 0.55,
            baseR: 0.020, tipR: 0.004,
            curveSegs: 7, radialSegs: 5, seed: 300
        })
    };

    // --- 材质 ---
    const mats = {
        low: new THREE.MeshStandardMaterial({
            color: new THREE.Color('#5a8a3c'),
            roughness: 0.75, metalness: 0.02,
            flatShading: true, side: THREE.DoubleSide
        }),
        mid: new THREE.MeshStandardMaterial({
            color: new THREE.Color('#6b9b4a'),
            roughness: 0.75, metalness: 0.02,
            flatShading: true, side: THREE.DoubleSide
        }),
        high: new THREE.MeshStandardMaterial({
            color: new THREE.Color('#4a7a2e'),
            roughness: 0.75, metalness: 0.02,
            flatShading: true, side: THREE.DoubleSide
        })
    };

    // --- 收集实例变换 ---
    const instances = { low: [], mid: [], high: [] };
    const matrix = new THREE.Matrix4();
    const pos = new THREE.Vector3();
    const quat = new THREE.Quaternion();

    // 使用伪随机决定哪些位置放置草丛
    const density = gc.density || 0.65;
    let totalSampled = 0, totalPlaced = 0;

    for (let x = -half + spacing * 0.5; x < half; x += spacing) {
        for (let z = -half + spacing * 0.5; z < half; z += spacing) {
            totalSampled++;
            // 密度随机：不是所有格点都放草
            const rnd = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
            if ((rnd - Math.floor(rnd)) > density) continue;

            const type = determineGrassType(x, z, md, splat, half, splatSize);
            if (!type) continue;

            totalPlaced++;

            // 微调位置（±30cm随机偏移，避免网格感）
            const jitterX = (Math.sin(x * 89.7 + z * 43.1) * 43758.5453 % 1 - 0.5) * spacing * 0.4;
            const jitterZ = (Math.sin(x * 73.3 - z * 97.7) * 43758.5453 % 1 - 0.5) * spacing * 0.4;

            // 获取地形高度
            const h = getTerrainHeight(x + jitterX, z + jitterZ);

            pos.set(x + jitterX, h, z + jitterZ);
            // 随机 Y 旋转
            const rotY = Math.sin(x * 53.7 + z * 37.1) * Math.PI; // 伪随机 0~2π
            quat.setFromEuler(new THREE.Euler(0, rotY, 0));
            matrix.compose(pos, quat, new THREE.Vector3(1, 1, 1));

            instances[type].push(matrix.clone());
        }
    }

    // --- 按空间分块创建 InstancedMesh（支持距离剔除） ---
    const cellInstances = {}; // { 'cx_cz': {low:[], mid:[], high:[]} }
    const cellCenters = {};   // { 'cx_cz': {cx, cz} }
    const cellsX = Math.ceil(currentMapData.size / GRASS_CELL_SIZE);
    const cellsZ = Math.ceil(currentMapData.size / GRASS_CELL_SIZE);

    for (const [type, arr] of Object.entries(instances)) {
        for (const m of arr) {
            const x = m.elements[12], z = m.elements[14];
            const cx = Math.floor((x + half) / GRASS_CELL_SIZE);
            const cz = Math.floor((z + half) / GRASS_CELL_SIZE);
            const key = cx + '_' + cz;
            if (!cellInstances[key]) {
                cellInstances[key] = { low: [], mid: [], high: [] };
                cellCenters[key] = { cx: (cx + 0.5) * GRASS_CELL_SIZE - half, cz: (cz + 0.5) * GRASS_CELL_SIZE - half };
            }
            cellInstances[key][type].push(m);
        }
    }

    for (const [key, cell] of Object.entries(cellInstances)) {
        for (const [type, arr] of Object.entries(cell)) {
            if (arr.length === 0) continue;
            const im = new THREE.InstancedMesh(bushGeos[type], mats[type], arr.length);
            im.castShadow = false;  // 陡视角草丛阴影不可见，节省阴影通道开销
            im.receiveShadow = true;
            im.name = 'grass_' + type + '_' + key;
            im.userData.cx = cellCenters[key].cx;
            im.userData.cz = cellCenters[key].cz;
            arr.forEach((m, i) => { im.setMatrixAt(i, m); });
            im.instanceMatrix.needsUpdate = true;

            // 随机颜色变化（每实例）
            const color = new THREE.Color();
            const baseColors = {
                low: [[0.35, 0.54, 0.24], [0.30, 0.48, 0.20], [0.40, 0.58, 0.28]],
                mid: [[0.42, 0.61, 0.29], [0.36, 0.54, 0.24], [0.34, 0.50, 0.22]],
                high: [[0.29, 0.44, 0.18], [0.24, 0.38, 0.15], [0.32, 0.48, 0.20]]
            };
            const bc = baseColors[type];
            for (let i = 0; i < arr.length; i++) {
                const pick = bc[i % bc.length];
                const r = pick[0] + (Math.sin(i * 0.73) * 0.5 + 0.5) * 0.06;
                const g = pick[1] + (Math.sin(i * 0.97) * 0.5 + 0.5) * 0.06;
                const b = pick[2] + (Math.sin(i * 0.53) * 0.5 + 0.5) * 0.04;
                color.setRGB(r, g, b);
                im.setColorAt(i, color);
            }
            im.instanceColor.needsUpdate = true;

            scene.add(im);
            grassInstances.push(im);
        }
    }

    // 清理不再需要的原始几何体（已拷贝到 InstancedMesh 中）
    Object.values(bushGeos).forEach(g => g.dispose());

    console.log('🌿 草丛覆盖完成: 采样' + totalSampled + '格点, 放置' + totalPlaced +
        '簇 (低' + (instances.low.length) + ' 中' + (instances.mid.length) +
        ' 高' + (instances.high.length) + '), 共' + grassInstances.length + ' draw calls ('
        + Object.keys(cellInstances).length + '个分块)');
}

// 清理草丛
function clearGrass() {
    grassInstances.forEach(im => {
        if (im.parent) im.parent.remove(im);
        im.geometry.dispose();
        im.material.dispose();
    });
    grassInstances = [];
    grassTriCount = 0;
}

// ==================== 水面/河流/桥梁 → waters.js + bridges.js ====================

// ==================== 坦克模型（程序化 v1.6 构建器） ====================

function createPlayerTank(player) {
    const result = T34V16Builder.buildAnimatedT34_85({
        camoColor: player.camoColor || 'green',
        position: { x: player.state.x, y: 0, z: player.state.z },
        yaw: player.state.yaw
    });

    player.group = result.group;
    player.hull = player.group;
    player.turretPivot = result.turretPivot;
    player.barrelPivot = result.barrelPivot;
    player.mgGroup = result.mgGroup;
    player.leftWheels = result.leftWheels;
    player.rightWheels = result.rightWheels;
    player._barrelTipLocal = result.barrelTipLocal;

    scene.add(player.group);

    if (player === player1) {
        tankGroup = player1.group;
        leftWheels = player1.leftWheels;
        rightWheels = player1.rightWheels;
    }
    console.log('🏭 T-34/85 v1.6 程序化模型已构建');
}

// createBarsForPlayer → bars.js

// 创建单人模式坦克（T-34/85 模型）
function createTank() {
    const p = createPlayer('green', 0, 0, Math.PI/2, true);
    createPlayerTank(p);  // 创建 3D 模型（设置 p.group）
    // 把 player 的属性映射到全局变量
    tankGroup = p.group;
    leftWheels = p.leftWheels; rightWheels = p.rightWheels;
    player1 = p;
    createBarsForPlayer(p);
    // 玩家受击叠加层
    createPlayerHitFlashOverlay(tankGroup);
}

// poissonDiskSampling, updateObstacleVisibility, updateGrassVisibility,
// createTransparentTreeGhost, isOnRoad, createRoadMeshes,
// cleanupRoadMeshes, createObstacles → obstacles.js

// ==================== 运动状态 ====================
const tankState = {
    x: 0,
    z: 0,
    yaw: Math.PI / 2,  // 朝向 +Z，与 player1 初始方向一致
};
let leftWheelAngle = 0;    // 左履带轮累积转动角
let rightWheelAngle = 0;   // 右履带轮累积转动角

// 缓动状态（平滑履带速度 + 俯仰）
let currentLeftSpeed  = 0;
let currentRightSpeed = 0;
let prevForwardSpeed  = 0;
let tankPitch         = 0;

function moveToward(current, target, maxDelta) {
    if (Math.abs(target - current) <= maxDelta) return target;
    return current + Math.sign(target - current) * maxDelta;
}

function angleMoveToward(current, target, maxDelta) {
    let diff = target - current;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    if (Math.abs(diff) <= maxDelta) return target;
    return current + Math.sign(diff) * maxDelta;
}

function resetTank() {
    tankState.x = POINT_A_X;
    tankState.z = POINT_A_Z;
    tankState.yaw = Math.PI / 4; // 面向东北（朝桥梁/地图中心方向）
    leftWheelAngle = 0;
    rightWheelAngle = 0;
    currentLeftSpeed = 0;
    currentRightSpeed = 0;
    prevForwardSpeed = 0;
    tankPitch = 0;
    reloadTimer = 0;
    if (player1) player1.reloadTimer = 0;  // 同步玩家对象
    // 清除所有炮弹
    shells.forEach(s => { scene.remove(s.mesh); disposeShellMesh(s.mesh); if(s.tracerLight)scene.remove(s.tracerLight); if(s.glowTail){scene.remove(s.glowTail);s.glowTail.geometry.dispose();s.glowTail.material.dispose();} });
    shells = [];
    // 清除所有碎块
    fragments.forEach(f => { scene.remove(f.mesh); f.mesh.geometry.dispose(); f.mesh.material.dispose(); });
    fragments = [];
    // 清除炮口焰
    muzzleLights.forEach(ml => { scene.remove(ml.light); if (ml.light.geometry) ml.light.geometry.dispose(); if (ml.light.material) ml.light.material.dispose(); });
    muzzleLights = [];
    ringFX.forEach(rf => { scene.remove(rf.mesh); rf.mesh.geometry.dispose(); rf.mesh.material.dispose(); });
    ringFX = [];
    // 清除所有爆炸效果
    explosions.forEach(e => { e.dispose(); });
    explosions = [];
    // 清除焦痕
    scorchMarks.forEach(sc => { scene.remove(sc.mesh); sc.mesh.geometry.dispose(); sc.mesh.material.dispose(); });
    scorchMarks = [];
    // 清除地面碎片
    groundDebris.forEach(gd => { scene.remove(gd.mesh); gd.mesh.geometry.dispose(); gd.mesh.material.dispose(); });
    groundDebris = [];
    // 重置装填条（PlaneGeometry: scale.y=1, 底部对齐）
    if (reloadBarFill) {
        reloadBarFill.scale.y = 1;
        reloadBarFill.position.y = -0.36 + 0.33; // = -0.03, 满条中心偏下
        reloadBarFill.material.color.setRGB(1, 1, 0);
    }
    if (reloadBarGroup) reloadBarGroup.visible = false;
    if (tankGroup) {
        tankGroup.position.set(0, 0, 0);
        tankGroup.rotation.order = 'YXZ';
        tankGroup.rotation.set(0, 0, 0);
    }
    // 隐藏损毁效果（血量重置）
    if (player1 && player1.damageEffects) player1.damageEffects.hide();
}

// ==================== 碰撞检测 ====================
function checkCollision(x, z, halfW) {
    const hw = halfW !== undefined ? halfW : TANK_HALF_W;
    // 障碍物碰撞 - 使用空间网格优化
    const checkObs = window._obstacleGrid ? 
        window._obstacleGrid.queryByDistance(x, z, hw + 2) : 
        obstacleData;
    for (const obs of checkObs) {
        if (obs.destroyed) continue;
        const dx = x - obs.x;
        const dz = z - obs.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        const minDist = hw + obs.radius;
        if (dist < minDist) {
            const nx = dx / (dist || 0.001);
            const nz = dz / (dist || 0.001);
            const pushX = nx * (minDist - dist);
            const pushZ = nz * (minDist - dist);
            return { hit: true, pushX, pushZ };
        }
    }
    // 河流碰撞（桥面及桥头引道不阻挡，允许坦克驶上桥梁）
    if (!isOnBridgeSurface(x, z) && !isOnBridge(x)) {
        let bestRc = null, bestOverlap = 0;
        for (const rc of riverColliders) {
            const rdx = x - rc.x, rdz = z - rc.z;
            const rDist = Math.sqrt(rdx * rdx + rdz * rdz);
            const rMinDist = hw + rc.radius;
            const overlap = rMinDist - rDist;
            if (overlap > bestOverlap) { bestOverlap = overlap; bestRc = rc; }
        }
        if (bestRc) {
            const rdx = x - bestRc.x, rdz = z - bestRc.z;
            const rDist = Math.sqrt(rdx * rdx + rdz * rdz);
            const rnx = rdx / (rDist || 0.001);
            const rnz = rdz / (rDist || 0.001);
            const pushX = rnx * bestOverlap;
            const pushZ = rnz * bestOverlap;
            return { hit: true, pushX, pushZ };
        }
    }
    // 池塘碰撞（椭圆边界推离，与河流行为一致）
    const pond = _getPond();
    if (pond && !isOnBridgeSurface(x, z) && !isOnBridge(x)) {
        const ppx = x - pond.cx, ppz = z - pond.cz;
        const margin = hw + 0.3, erx = pond.rx + margin, erz = pond.rz + margin;
        if (Math.sqrt((ppx*ppx)/(erx*erx) + (ppz*ppz)/(erz*erz)) < 1.0) {
            const angle = Math.atan2(ppz / erz, ppx / erx);
            const tx = pond.cx + erx * Math.cos(angle);
            const tz = pond.cz + erz * Math.sin(angle);
            return { hit: true, pushX: tx - x, pushZ: tz - z };
        }
    }
    return { hit: false, pushX: 0, pushZ: 0 };
}

// ==================== 火炮系统 → shells.js ====================
// disposeShellMesh, fireShell, spawnFragments, spawnExplosion,
// spawnHeExplosion, checkChainExplosion 已提取

// ==================== 游戏循环 ====================
const clock = new THREE.Clock();
// FPS 计数器
let fpsFrames = 0, fpsTime = 0, fpsCurrent = 0;
let grassTriCount = 0; // 草丛三角面统计
let visibilityTimer = 0;
let occlusionTimer = 0;  // 障碍物遮挡检测降频计时器

// ==================== 性能探针 ====================
// 四阶段累加：physics(物理), combat(战斗), updates(杂项更新), render(渲染)
let perfAcc = { physics:0, combat:0, updates:0, render:0, frames:0 };
let perfDisplay = { physics:0, combat:0, updates:0, render:0, total:0 };

let currentShellType = 'ap';
let aimPoint = new THREE.Vector3();
let aimValid = true;
let aimRaycaster = new THREE.Raycaster();
let groundMesh = null;
let trajLine = null;
let trajDot = null;
let turretAngVel = 0.5236;
let barrelAngVel = 0.3491;

function getBarrelWorldPos(player) {
    const tipLocal = player._barrelTipLocal || new THREE.Vector3(0, 0, 3.72);
    return tipLocal.clone().applyMatrix4(player.barrelPivot ? player.barrelPivot.matrixWorld : player.group.matrixWorld);
}

function getBarrelWorldDir(player) {
    const worldQ = new THREE.Quaternion();
    if (player.barrelPivot) {
        player.barrelPivot.getWorldQuaternion(worldQ);
    } else {
        player.group.getWorldQuaternion(worldQ);
    }
    return new THREE.Vector3(0, 0, 1).applyQuaternion(worldQ);
}

function updateAiming(player, dt) {
    if (!player || player.dead || !player.turretPivot || !player.barrelPivot) return;

    // ── 车体转向即时补偿 (WoT式稳定器): 车体转多少, 炮塔反向转多少, 维持世界朝向 ──
    const hullYaw = player.state.yaw;
    if (player._prevHullYaw !== undefined) {
        const hullDyaw = hullYaw - player._prevHullYaw;
        // 处理 ±π 跳变
        player.turretYaw += hullDyaw;
    }
    player._prevHullYaw = hullYaw;

    const maxDown = 25 * Math.PI / 180;
    const maxUp = -10 * Math.PI / 180;

    const gp = getGamepad();
    const now = performance.now();
    if (gp && (Math.abs(gp.axes[0]) > 0.08 || Math.abs(gp.axes[1]) > 0.08 ||
               Math.abs(gp.axes[2] || 0) > 0.08 || Math.abs(gp.axes[4] || 0) > 0.08 ||
               Math.abs(gp.axes[3] || 0) > 0.08 || Math.abs(gp.axes[5] || 0) > 0.08)) {
        useGamepad = true;
        lastGamepadTime = now;
    }
    if (keys['KeyW'] || keys['KeyA'] || keys['KeyS'] || keys['KeyD']) {
        useGamepad = false;
    }

    const barrelPos = getBarrelWorldPos(player);

    if (useGamepad && gp) {
        const gpxA = gp.axes[2] || 0;
        const gpxB = gp.axes[4] || 0;
        const gpx = Math.abs(gpxA) > Math.abs(gpxB) ? gpxA : gpxB;
        const gpyA = gp.axes[3] || 0;
        const gpyB = gp.axes[5] || 0;
        const gpy = Math.abs(gpyA) > Math.abs(gpyB) ? gpyA : gpyB;
        const turretSpeed = stickToTarget(-gpx) * turretAngVel;
        player.turretYaw += turretSpeed * dt;
        if (player.turretYaw > Math.PI) player.turretYaw -= Math.PI * 2;
        if (player.turretYaw < -Math.PI) player.turretYaw += Math.PI * 2;
        const barrelSpeed = stickToTarget(-gpy) * barrelAngVel;
        const newElev = player.barrelElevation + barrelSpeed * dt;
        player.barrelElevation = Math.max(maxUp, Math.min(maxDown, newElev));
    } else if (groundMesh) {
        const ndcX = (mouseX / window.innerWidth) * 2 - 1;
        const ndcY = -(mouseY / window.innerHeight) * 2 + 1;
        const screenPos = new THREE.Vector2(ndcX, ndcY);
        aimRaycaster.setFromCamera(screenPos, camera);
        const groundHits = aimRaycaster.intersectObject(groundMesh);
        const aimTargets = obstacleMeshes.slice();
        for (let ei = 0; ei < enemies.length; ei++) {
            const en = enemies[ei]; if (!en || !en.visible) continue;
            if (en.cfg && en.cfg.type === 'hexapod') {
                en.traverse(function(c) { if (c.isMesh) { const pn = (c.parent && c.parent.name) || ''; if (pn.indexOf('腿') < 0 && pn.indexOf('脚踝') < 0) aimTargets.push(c); } });
            } else { aimTargets.push(en); }
        }
        const obsHits = aimRaycaster.intersectObjects(aimTargets, true);

        let targetAim = null;
        let hitObs = false;
        if (groundHits.length > 0) targetAim = groundHits[0].point.clone();
        if (obsHits.length > 0 && (!targetAim || obsHits[0].distance < targetAim.distanceTo(camera.position))) {
            targetAim = obsHits[0].point.clone();
            hitObs = true;
        }

        aimValid = false;
        if (targetAim) {
            if (!hitObs) targetAim.y = getGroundHeight(targetAim.x, targetAim.z);
            aimPoint.copy(targetAim);

            const diff = targetAim.clone().sub(barrelPos);
            const horizDist = Math.sqrt(diff.x * diff.x + diff.z * diff.z);
            const flightTime = horizDist / SHELL_SPEED;
            const gravityDrop = 0.5 * SHELL_GRAVITY * flightTime * flightTime;
            const worldTarget = new THREE.Vector3(targetAim.x, targetAim.y + gravityDrop, targetAim.z);
            const worldDir = worldTarget.clone().sub(barrelPos).normalize();

            const invQ = player.group.quaternion.clone().invert();
            const localDir = worldDir.clone().applyQuaternion(invQ);
            const targetYaw = Math.atan2(localDir.x, localDir.z);
            const targetElev = -Math.atan2(localDir.y, Math.sqrt(localDir.x * localDir.x + localDir.z * localDir.z));
            const clampedElev = Math.max(maxUp, Math.min(maxDown, targetElev));

            player.turretYaw = angleMoveToward(player.turretYaw, targetYaw, turretAngVel * dt);
            if (player.turretYaw > Math.PI) player.turretYaw -= Math.PI * 2;
            if (player.turretYaw < -Math.PI) player.turretYaw += Math.PI * 2;
            player.barrelElevation = angleMoveToward(player.barrelElevation, clampedElev, barrelAngVel * dt);

            const dist = diff.length();
            const turretDiff = Math.abs(player.turretYaw - targetYaw);
            const elevDiff = Math.abs(player.barrelElevation - clampedElev);

            if (dist <= 150 && turretDiff < 0.05 && elevDiff < 0.04) {
                const obsDir = diff.clone().normalize();
                const obsRc = new THREE.Raycaster();
                obsRc.set(barrelPos, obsDir);
                obsRc.far = dist + 1.0;
                const obsInt = obsRc.intersectObjects(aimTargets, true);

                if (obsInt.length === 0) {
                    aimValid = true;
                } else if (hitObs) {
                    const blockers = obsInt.filter(h => h.distance < dist - 1.5);
                    if (blockers.length === 0) aimValid = true;
                }

                if (aimValid && !hitObs) {
                    const barrelDir = getBarrelWorldDir(player);
                    const horizSpeed = SHELL_SPEED * Math.sqrt(barrelDir.x * barrelDir.x + barrelDir.z * barrelDir.z);
                    const totalTime = horizDist / Math.max(horizSpeed, 1);
                    const steps = 12;
                    const dt = totalTime / steps;
                    for (let si = 1; si < steps - 1; si++) {
                        const t = si * dt;
                        const x = barrelPos.x + barrelDir.x * SHELL_SPEED * t;
                        const y = barrelPos.y + barrelDir.y * SHELL_SPEED * t - 0.5 * SHELL_GRAVITY * t * t;
                        const z = barrelPos.z + barrelDir.z * SHELL_SPEED * t;
                        if (y < getGroundHeight(x, z) - 0.5) {
                            aimValid = false;
                            break;
                        }
                    }
                }

                if (aimValid) {
                    const shellR = 0.18;
                    const checkObs = window._obstacleGrid ? 
                        window._obstacleGrid.queryByDistance(player1.state.x, player1.state.z, 100) : 
                        obstacleData;
                    for (let ji = checkObs.length - 1; ji >= 0; ji--) {
                        const od = checkObs[ji];
                        if (od.destroyed) continue;
                        const oX = (od.type === 'building' && od.groupRef) ? od.groupRef.position.x : od.x;
                        const oZ = (od.type === 'building' && od.groupRef) ? od.groupRef.position.z : od.z;
                        const oR = (od.radius || 0.55) + shellR;
                        const oY = (od.type === 'building' && od.groupRef) ? od.groupRef.position.y : getGroundHeight(od.x, od.z);
                        const oH = od.height || 1.5;

                        const dx = oX - barrelPos.x;
                        const dz = oZ - barrelPos.z;
                        const along = dx * obsDir.x + dz * obsDir.z;
                        if (along < -oR || along > dist + oR) continue;
                        const perp = Math.sqrt(Math.max(0, dx * dx + dz * dz - along * along));
                        if (perp > oR) continue;
                        const yAt = barrelPos.y + obsDir.y * along;
                        if (yAt < oY - 0.3 || yAt > oY + oH + 0.3) continue;
                        if (hitObs && Math.abs(along - dist) < 3.0) continue;
                        aimValid = false;
                        break;
                    }
                }
            }
        }
    }

    player.barrelElevation = Math.max(maxUp, Math.min(maxDown, player.barrelElevation));
    if (useGamepad) {
        crosshairEl.style.display='none';var rr=document.getElementById('reload-ring');if(rr)rr.style.display='none';
        document.body.style.cursor = '';
    } else {
        crosshairEl.style.display = 'block';
        document.body.style.cursor = 'none';
        crosshairEl.style.color = aimValid ? '#00ff00' : '#ff3333';
    }
}

function updateTrajectoryLine(player) {
    if (!trajLine || !trajLine.parent) {
        if (trajLine) { trajLine.geometry.dispose(); trajLine = null; }
        const lineGeo = new THREE.BufferGeometry();
        const lineMat = new THREE.LineBasicMaterial({ color: 0x00ff88, transparent: true, opacity: 0.5, depthTest: true });
        trajLine = new THREE.Line(lineGeo, lineMat);
        trajLine.visible = false;
        scene.add(trajLine);
    }
    if (!trajDot || !trajDot.parent) {
        if (trajDot) { trajDot.geometry.dispose(); trajDot.material.dispose(); trajDot = null; }
        trajDot = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 8), new THREE.MeshBasicMaterial({ color: 0x00ff88, transparent: true, opacity: 0.7, depthTest: false }));
        trajDot.visible = false;
        scene.add(trajDot);
    }

    if (!player || player.dead) {
        trajLine.visible = false;
        trajDot.visible = false;
        return;
    }

    trajLine.visible = true;
    trajDot.visible = true;

    const barrelPos = getBarrelWorldPos(player);
    const barrelDir = getBarrelWorldDir(player);
    const SPEED = 33.0;
    const GRAVITY = 1.0;
    const MAX_DIST = 150;
    const samples = 70;
    const totalTime = MAX_DIST / (SPEED * Math.cos(Math.max(Math.abs(player.barrelElevation), 0.01)));
    const dt = totalTime / samples;

    const points = [];
    const rc = new THREE.Raycaster();
    let hitPoint = null;
    let hitGround = false;

    const hitTargets = [...obstacleMeshes];
    const enemyDefs = [];
    if (gameMode === 'combat' || isTrainingMode) {
        for (const en of enemies) {
            if (!en || !en.visible) continue;
            if (en.ai && en.ai.state === 'dead') continue;
            // 六足用包围柱检测(避免腿mesh截断射线), 其他敌人用完整mesh
            const isHex = (en.cfg && en.cfg.type === 'hexapod');
            if (!isHex) hitTargets.push(en);
            const isZombie = (en.cfg && en.cfg.type === 'zombie');
            const eR = isZombie ? 0.4 : (isHex ? 1.0 : 1.0);
            const eH = isZombie ? 1.8 : (isHex ? 2.0 : 0.8);
            enemyDefs.push({ x: en.position.x, z: en.position.z, y: en.position.y, radius: eR, height: eH, groupRef: en });
        }
    }
    if (gameMode === 'versus') {
        const foe = player === player1 ? player2 : player1;
        if (foe && !foe.dead && foe.group) {
            hitTargets.push(foe.group);
            enemyDefs.push({ x: foe.state.x, z: foe.state.z, y: foe.group.position.y, radius: TANK_HALF_W, height: 0.8, groupRef: foe.group });
        }
    }

    for (let i = 0; i <= samples; i++) {
        const t = i * dt;
        const x = barrelPos.x + barrelDir.x * SPEED * t;
        const y = barrelPos.y + barrelDir.y * SPEED * t - 0.5 * GRAVITY * t * t;
        const z = barrelPos.z + barrelDir.z * SPEED * t;

        const p = new THREE.Vector3(x, y, z);

        const groundH = getGroundHeight(x, z);
        if (y < groundH && i > 0) {
            const prev = points[points.length - 1];
            const prevGH = getGroundHeight(prev.x, prev.z);
            if (prev.y > prevGH) {
                const frac = (prev.y - prevGH) / ((prev.y - prevGH) + (groundH - y));
                hitPoint = prev.clone().lerp(p, frac);
                hitGround = true;
                points.push(hitPoint);
                break;
            }
        }

        if (i > 0 && !hitGround) {
            const prev = points[points.length - 1];
            // 细线射线检测（Mesh表面命中）
            rc.set(prev.clone(), p.clone().sub(prev).normalize());
            rc.far = p.distanceTo(prev);
            const hits = rc.intersectObjects(hitTargets, true);
            if (hits.length > 0) {
                hitPoint = hits[0].point.clone();
                points.push(hitPoint);
                break;
            }
            // 炮弹体积检测（边缘擦过）
            const shellR = 0.18;
            const segLen = p.distanceTo(prev);
            const segDir = new THREE.Vector3().subVectors(p, prev).normalize();
            const checkObs = window._obstacleGrid ? 
                window._obstacleGrid.queryByDistance(p.x, p.z, 50) : 
                obstacleData;
            for (let ji = checkObs.length - 1; ji >= 0; ji--) {
                const od = checkObs[ji];
                const oX = (od.type === 'building' && od.groupRef) ? od.groupRef.position.x : od.x;
                const oZ = (od.type === 'building' && od.groupRef) ? od.groupRef.position.z : od.z;
                const oR = (od.radius || 0.55) + shellR;
                const oY = (od.type === 'building' && od.groupRef) ? od.groupRef.position.y : getGroundHeight(od.x, od.z);
                const oH = od.height || 1.5;
                const dx = oX - prev.x;
                const dz = oZ - prev.z;
                const proj = dx * segDir.x + dz * segDir.z;
                if (proj < -oR || proj > segLen + oR) continue;
                const perp = Math.sqrt(Math.max(0, dx * dx + dz * dz - proj * proj));
                if (perp > oR) continue;
                const fracT = Math.max(0, Math.min(1, proj / Math.max(segLen, 0.001)));
                const projY = prev.y + (p.y - prev.y) * fracT;
                if (projY < oY - 0.3 || projY > oY + oH + 0.3) continue;
                hitPoint = prev.clone().addScaledVector(segDir, Math.max(0, Math.min(segLen, proj)));
                points.push(hitPoint);
                break;
            }
            if (hitPoint) break;
            for (let ei = enemyDefs.length - 1; ei >= 0; ei--) {
                const ed = enemyDefs[ei];
                const eR = ed.radius + shellR;
                const ex = ed.x - prev.x;
                const ez = ed.z - prev.z;
                const eproj = ex * segDir.x + ez * segDir.z;
                if (eproj < -eR || eproj > segLen + eR) continue;
                const eperp = Math.sqrt(Math.max(0, ex * ex + ez * ez - eproj * eproj));
                if (eperp > eR) continue;
                const efrac = Math.max(0, Math.min(1, eproj / Math.max(segLen, 0.001)));
                const ey = prev.y + (p.y - prev.y) * efrac;
                if (ey < ed.y - 0.3 || ey > ed.y + ed.height + 0.3) continue;
                hitPoint = prev.clone().addScaledVector(segDir, Math.max(0, Math.min(segLen, eproj)));
                points.push(hitPoint);
                break;
            }
            if (hitPoint) break;
        }
        points.push(p);
    }

    trajLine.geometry.dispose();
    const arr = new Float32Array(points.length * 3);
    for (let i = 0; i < points.length; i++) {
        arr[i * 3] = points[i].x;
        arr[i * 3 + 1] = points[i].y;
        arr[i * 3 + 2] = points[i].z;
    }
    trajLine.geometry = new THREE.BufferGeometry();
    trajLine.geometry.setAttribute('position', new THREE.BufferAttribute(arr, 3));

    if (hitPoint) {
        trajDot.position.copy(hitPoint);
        trajDot.visible = true;
    } else {
        trajDot.visible = false;
    }
}

function gameLoop() {
    try {
    const _t0 = performance.now();
    // 强制全屏渲染（防止之前双人模式残留 viewport/scissor 状态）
    renderer.setScissorTest(false);
    const cssW = window.innerWidth, cssH = window.innerHeight;
    renderer.setViewport(0, 0, cssW, cssH);
    camera.aspect = cssW / cssH;
    camera.updateProjectionMatrix();

    const dt = Math.min(clock.getDelta(), 0.1); // 防止大帧间隔
    // ── 首次进入游戏时请求指针锁定 ──
    if (!_pointerLocked && gameMode !== 'menu' && !useGamepad) {
        gameContainer.requestPointerLock();
    }
    // 锁定模式: X固定正中, Y由movementY累积驱动(虚拟准星)
    if (_pointerLocked) {
        mouseX = window.innerWidth / 2;
        mouseY = _virtualMouseY;
        crosshairEl.style.left = mouseX + 'px';
        crosshairEl.style.top = mouseY + 'px';
    }
    updateReloadRing(reloadTimer, RELOAD_TIME);
    visibilityTimer += dt;
    // ── 训练场重生处理 ──
    if (isTrainingMode) _processTrainingRespawn(dt);

    const isGameOver = gameMode === 'combat' && combatData && combatData.lives <= 0;
    const playerDead = player1 && player1.dead;
    let { left: targetLeft, right: targetRight, forward: driveFwd, strafe: driveStr } = (isGameOver || playerDead) ? { left: 0, right: 0, forward: 0, strafe: 0 } : getDriveInput();
    if (playerDead) { currentLeftSpeed = 0; currentRightSpeed = 0; }


    // ── 倒车转向反转（基于实际速度而非摇杆输入）──
    const actualFwd = (currentLeftSpeed + currentRightSpeed) / 2;
    if (actualFwd < -0.3) { const t = targetLeft; targetLeft = targetRight; targetRight = t; }
    // ── 方向切换+转向 → 紧急刹车: 转向反向, 2倍制动力 ──
    var targetAvg = (targetLeft + targetRight) / 2;
    var speedAvg = (currentLeftSpeed + currentRightSpeed) / 2;
    var dirFlips = (Math.abs(targetAvg) > 0.05 && Math.abs(speedAvg) > 0.1 && Math.sign(targetAvg) !== Math.sign(speedAvg));
    var isTurning = Math.abs(targetLeft - targetRight) > 0.1;
    if (dirFlips && isTurning) {
        // 刹车中: 转向指令反向(形成反向扭力辅助减速), 速度降到0后自动退出
        if (!window._brakeActive) { window._brakeActive = true; }
        var turnDiff = targetLeft - targetRight;
        targetLeft = targetAvg - turnDiff * 0.5;
        targetRight = targetAvg + turnDiff * 0.5;
    }
    if (window._brakeActive) {
        if (Math.abs(currentLeftSpeed) < 0.05 && Math.abs(currentRightSpeed) < 0.05) {
            window._brakeActive = false; // 已停止, 恢复正常
        }
    }
    var brakeMul = window._brakeActive ? 2.0 : 1.0;
    // ── 履带速度缓动（加速 / 制动 / 惯性滑行）──
    // 左履带
    if (targetLeft !== 0) {
        const tgt = targetLeft * MAX_SPEED;
        const dirFlip = Math.sign(targetLeft) !== Math.sign(prevTargetLeft) && prevTargetLeft !== 0;
        const sameDir = !dirFlip && (Math.sign(tgt) === Math.sign(currentLeftSpeed) || currentLeftSpeed === 0);
        const rate = sameDir ? TRACK_ACCEL * dt : TRACK_DECEL * brakeMul * dt;
        currentLeftSpeed = moveToward(currentLeftSpeed, tgt, rate);
    } else {
        currentLeftSpeed = moveToward(currentLeftSpeed, 0, TRACK_COAST * brakeMul * dt);
    }
    // 右履带
    if (targetRight !== 0) {
        const tgt = targetRight * MAX_SPEED;
        const dirFlip = Math.sign(targetRight) !== Math.sign(prevTargetRight) && prevTargetRight !== 0;
        const sameDir = !dirFlip && (Math.sign(tgt) === Math.sign(currentRightSpeed) || currentRightSpeed === 0);
        const rate = sameDir ? TRACK_ACCEL * dt : TRACK_DECEL * brakeMul * dt;
        currentRightSpeed = moveToward(currentRightSpeed, tgt, rate);
    } else {
        currentRightSpeed = moveToward(currentRightSpeed, 0, TRACK_COAST * brakeMul * dt);
    }
    if (targetLeft !== 0) prevTargetLeft = targetLeft;
    if (targetRight !== 0) prevTargetRight = targetRight;

    // ── 差速驱动 ──
    const v     = (currentLeftSpeed + currentRightSpeed) / 2;
    const omega = (currentLeftSpeed - currentRightSpeed) / TRACK_SPACING;

    // 引擎/履带音效（用最快履带速度，确保原地旋转也有音效）
    updateEngineSound(Math.max(Math.abs(currentLeftSpeed), Math.abs(currentRightSpeed)));

    tankState.yaw += omega * dt;

    const forwardX = Math.cos(tankState.yaw);
    const forwardZ = Math.sin(tankState.yaw);

    // ── 坡度速度限制：超过最大爬坡度时按比例降速 ──
    const slopeFront = getGroundHeight(tankState.x + forwardX * 1.0, tankState.z + forwardZ * 1.0);
    const slopeBack  = getGroundHeight(tankState.x - forwardX * 1.0, tankState.z - forwardZ * 1.0);
    const slopeAngle = Math.atan2(slopeFront - slopeBack, 2.0);
    let slopeFactor = 1.0;
    if (Math.abs(slopeAngle) > MAX_SLOPE) {
        slopeFactor = MAX_SLOPE / Math.abs(slopeAngle);
    }
    const limitedV = v * slopeFactor;
    let newX = tankState.x + forwardX * limitedV * dt;
    let newZ = tankState.z + forwardZ * limitedV * dt;

    for (let iter = 0; iter < 3; iter++) {
        const result = checkCollision(newX, newZ);
        if (result.hit) { newX += result.pushX; newZ += result.pushZ; } else break;
    }
    // ── 与敌人碰撞 ──
    const pRad = TANK_HALF_W;
    for (let ei = 0; ei < enemies.length; ei++) {
        const en = enemies[ei];
        if (!en || !en.visible || en.dead) continue;
        const eRad = (en.cfg && en.cfg.type === 'zombie') ? 0.4 : (en.cfg && en.cfg.type === 'hexapod') ? 0.6 : ENEMY_HALF_W;
        const dx = newX - en.position.x, dz = newZ - en.position.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        const minDist = pRad + eRad;
        if (dist < minDist && dist > 0.001) {
            const overlap = minDist - dist;
            newX += (dx / dist) * overlap;
            newZ += (dz / dist) * overlap;
        }
    }
    // 空气墙（矩形世界边界，X/Z分别钳制）
    const wallMargin = TANK_HALF_W;
    newX = Math.max(-playHalfW + wallMargin, Math.min(playHalfW - wallMargin, newX));
    newZ = Math.max(-playHalfD + wallMargin, Math.min(playHalfD - wallMargin, newZ));
    // 池塘空气墙（阻止坦克驶入池塘，使用动态池塘数据）
    if (isInPond(newX, newZ)) {
        const pond = _getPond();
        if (pond) {
            const px = newX - pond.cx, pz = newZ - pond.cz;
            const margin = TANK_HALF_W + 0.3;
            const erx = pond.rx + margin, erz = pond.rz + margin;
            const angle = Math.atan2(pz / erz, px / erx);
            newX = pond.cx + erx * Math.cos(angle);
            newZ = pond.cz + erz * Math.sin(angle);
        }
    }
    const _bridges = currentMapData && currentMapData.bridges;
    const _isEditorBridges = _bridges && _bridges.length > 0 && (_bridges[0].cz !== undefined || _bridges[0].fromX !== undefined);
    if (_isEditorBridges) {
        for (const _b of _bridges) {
            const bHW = _b.halfW || 6;
            const _dx = (_b.toX||_b.cx+5) - (_b.fromX||_b.cx-5);
            const _dz = (_b.toZ||_b.cz) - (_b.fromZ||_b.cz);
            const spanLen = Math.hypot(_dx, _dz) + 3;
            const spanZ = Math.max(spanLen, bHW * 1.5);
            const _ang = Math.atan2(_dz, _dx);
            const lx = (newX - _b.cx) * Math.cos(-_ang) - (newZ - _b.cz) * Math.sin(-_ang);
            const lz = (newX - _b.cx) * Math.sin(-_ang) + (newZ - _b.cz) * Math.cos(-_ang);
            if (Math.abs(lx) <= spanZ / 2 && Math.abs(lz) <= bHW) {
                const railLimit = bHW - 0.25;
                const clampedLZ = Math.max(-railLimit + TANK_HALF_W, Math.min(railLimit - TANK_HALF_W, lz));
                newX = _b.cx + lx * Math.cos(_ang) - clampedLZ * Math.sin(_ang);
                newZ = _b.cz + lx * Math.sin(_ang) + clampedLZ * Math.cos(_ang);
            }
        }
    } else {
        if (isOnBridgeSurface(newX, newZ)) {
            const b = _getBridge();
            if (b) {
                const railLimit = b.halfW - 0.25;
                newX = Math.max(-railLimit + TANK_HALF_W, Math.min(railLimit - TANK_HALF_W, newX));
            }
        }
    }
    if (!isOnBridge(newX, newZ)) {
        // 多轮迭代推离：避免弯道重叠碰撞体导致的坦克粘连
        for (let rIter = 0; rIter < 8; rIter++) {
            let pushed = false;
            for (const rc of riverColliders) {
                const dx = newX - rc.x, dz = newZ - rc.z;
                const dist = Math.hypot(dx, dz);
                if (dist < rc.radius + TANK_HALF_W) {
                    const nx = dx / Math.max(dist, 0.001), nz = dz / Math.max(dist, 0.001);
                    newX = rc.x + nx * (rc.radius + TANK_HALF_W);
                    newZ = rc.z + nz * (rc.radius + TANK_HALF_W);
                    pushed = true;
                }
            }
            if (!pushed) break;
        }
    }
    tankState.x = newX;
    tankState.z = newZ;

    // ── 俯仰效果（加减速时车体前倾/后仰） ──
    const forwardAccel = (v - prevForwardSpeed) / Math.max(dt, 0.001);
    const accelPitchTarget = Math.max(-PITCH_MAX, Math.min(PITCH_MAX, forwardAccel * PITCH_GAIN));
    tankPitch += (accelPitchTarget - tankPitch) * Math.min(PITCH_SMOOTH * dt, 1);
    // 后坐力衰减（开炮时车体后仰，逐渐回正）
    let recoilP = 0;
    if (player1 && player1.recoilPitch !== 0) {
        player1.recoilPitch += (0 - player1.recoilPitch) * Math.min(RECOIL_DECAY * dt, 1);
        if (Math.abs(player1.recoilPitch) < 0.0005) player1.recoilPitch = 0;
        recoilP = player1.recoilPitch;
    }
    // 地形坡度俯仰（采样前后1m高度差）
    const sampleDist = 1.0;
    const frontH = getGroundHeight(newX + forwardX * sampleDist, newZ + forwardZ * sampleDist);
    const backH  = getGroundHeight(newX - forwardX * sampleDist, newZ - forwardZ * sampleDist);
    const terrainPitch = Math.atan2(frontH - backH, sampleDist * 2);
    // 地形坡度侧倾（采样左右1.5m高度差）
    const rxDir = Math.cos(tankState.yaw + Math.PI / 2);
    const rzDir = Math.sin(tankState.yaw + Math.PI / 2);
    const sideDist = 1.5;
    const leftH  = getGroundHeight(newX - rxDir * sideDist, newZ - rzDir * sideDist);
    const rightH = getGroundHeight(newX + rxDir * sideDist, newZ + rzDir * sideDist);
    const terrainRoll = Math.atan2(rightH - leftH, sideDist * 2);
    prevForwardSpeed = v;

    // ── 坦克3D更新（垂直稳定器：低通滤波消除高频颠簸）──
    const groundY = getGroundHeight(tankState.x, tankState.z);
    const Y_SMOOTH = 12.0; // 高度平滑系数（越大越平滑但越延迟）
    if (typeof _smoothGroundY === 'undefined') _smoothGroundY = groundY;
    _smoothGroundY += (groundY - _smoothGroundY) * Math.min(1, Y_SMOOTH * dt);
    tankGroup.position.set(tankState.x, _smoothGroundY, tankState.z);
    if (!tankGroup.rotation.order || tankGroup.rotation.order !== 'YXZ') tankGroup.rotation.order = 'YXZ';
    const P_SMOOTH = 15.0; // 俯仰平滑系数
    if (typeof _smoothTerrainPitch === 'undefined') _smoothTerrainPitch = terrainPitch;
    _smoothTerrainPitch += (terrainPitch - _smoothTerrainPitch) * Math.min(1, P_SMOOTH * dt);
    const R_SMOOTH = 15.0; // 侧倾平滑系数
    if (typeof _smoothTerrainRoll === 'undefined') _smoothTerrainRoll = terrainRoll;
    _smoothTerrainRoll += (terrainRoll - _smoothTerrainRoll) * Math.min(1, R_SMOOTH * dt);
    tankGroup.rotation.set(tankPitch + recoilP - _smoothTerrainPitch, Math.PI / 2 - tankState.yaw, -_smoothTerrainRoll);
    tankGroup.updateMatrixWorld();
    // 同步 player1.state，fireShell 依赖它
    if (player1) {
        player1.state.x = tankState.x;
        player1.state.z = tankState.z;
        player1.state.yaw = tankState.yaw;
        if (!isGameOver) {
            updateAiming(player1, dt);
            if (player1.turretPivot) {
                player1.turretPivot.rotation.y = player1.turretYaw;
            }
            if (player1.barrelPivot) {
                player1.barrelPivot.rotation.x = player1.barrelElevation;
            }
            if (player1.mgGroup) {
                player1.mgGroup.rotation.y = player1.mgYaw;
                player1.mgGroup.rotation.x = player1.mgElev;
            }
            tankGroup.updateMatrixWorld(); // 刷新炮塔/炮管子节点世界矩阵
        }
    }

    // ── 履带轮动画（使用当前实际速度驱动） ──
    const WHEEL_R = 0.40;
    leftWheelAngle  += currentLeftSpeed  * dt / WHEEL_R;
    rightWheelAngle += currentRightSpeed * dt / WHEEL_R;
    leftWheels.forEach(w => { w.rotation.x = leftWheelAngle; });
    rightWheels.forEach(w => { w.rotation.x = rightWheelAngle; });
    const _t1 = performance.now();  // perf: 物理阶段结束
    perfAcc.physics += _t1 - _t0;

    // ── 开炮（鼠标左键 / 手柄RT扳机） ──
    if ((gameMode === 'single' || gameMode === 'combat' || isTrainingMode) && !isGameOver) {
        if (mouseFireRequested && mouseFireReady) {
            fireShell();
            mouseFireReady = false;
            mouseFireRequested = false;
        }
        const fireNow = isFirePressed();
        if (fireNow && gamepadFireReady) {
            fireShell();
            gamepadFireReady = false;
        }
        if (!fireNow) gamepadFireReady = true;
    }
    if (!mouseDown) mouseFireReady = true;

    const gp = getGamepad();
    if (gp && gp.buttons[5] && gp.buttons[5].value > 0.3 && gameMode !== 'menu') {
        if (!_gpRbPressed) {
            _gpRbPressed = true;
            currentShellType = (currentShellType === 'ap') ? 'he' : 'ap';
            playSwitchSound();
            if (player1 && !player1.dead) player1.reloadTimer = RELOAD_TIME;
            console.log('🔫 切换弹种: ' + (currentShellType === 'ap' ? '穿甲弹 AP' : '高爆弹 HE'));
        }
    } else {
        _gpRbPressed = false;
    }

    updateTrajectoryLine(player1);

    // ── 炮弹更新 ──
    for (let i = shells.length - 1; i >= 0; i--) {
        const s = shells[i];
        // 保存上一帧位置用于扫掠碰撞检测
        const prevPos = s.prevPos || s.mesh.position.clone();
        s.vel.y -= SHELL_GRAVITY * dt;
        s.mesh.position.x += s.vel.x * dt;
        s.mesh.position.y += s.vel.y * dt;
        s.mesh.position.z += s.vel.z * dt;
        s.prevPos = s.mesh.position.clone();
        if (s.vel.lengthSq() > 0.01) {
            s.mesh.lookAt(s.mesh.position.clone().add(s.vel));
        }
        // 曳光弹：光源跟随炮弹，拖尾光球略落后方
        if (s.tracerLight) s.tracerLight.position.copy(s.mesh.position);
        if (s.glowTail) {
            const velDir = s.vel.clone().normalize();
            s.glowTail.position.copy(s.mesh.position).addScaledVector(velDir, -0.18);
        }

        // 碰撞检测：炮弹 vs 障碍物（扫掠检测防穿越）
        let hit = false;
        const shellR = 0.18;
        const moveVec = new THREE.Vector3().subVectors(s.mesh.position, prevPos);
        const moveLen = moveVec.length();
        const checkObs = window._obstacleGrid ? 
            window._obstacleGrid.queryByDistance(s.mesh.position.x, s.mesh.position.z, moveLen + 2) : 
            obstacleData;
        for (let j = checkObs.length - 1; j >= 0; j--) {
            const od = checkObs[j];
            if (od.destroyed) continue;
            if (od.type === 'building' && od.groupRef && !od.groupRef.visible) continue;
            const obsRadius = od.radius || 0.55;
            const combinedR = shellR + obsRadius;
            const obsX = (od.type === 'building' && od.groupRef) ? od.groupRef.position.x : od.x;
            const obsZ = (od.type === 'building' && od.groupRef) ? od.groupRef.position.z : od.z;
            const obsY = (od.type === 'building' && od.groupRef) ? od.groupRef.position.y : (isVersusMap ? 0 : getTerrainHeight(od.x, od.z));
            const obsTop = od.height || 1.5;

            // 垂直方向：炮弹必须经过障碍物高度范围
            const prevY = prevPos.y, currY = s.mesh.position.y;
            const obsTopLimit = obsY + obsTop + 0.3;
            if (currY > obsTopLimit && prevY > obsTopLimit) continue;

            // 水平扫掠检测：炮弹移动路径 vs 障碍物圆柱
            let horizHit = false;
            if (moveLen < 0.0001) {
                const dx = s.mesh.position.x - obsX;
                const dz = s.mesh.position.z - obsZ;
                horizHit = (dx * dx + dz * dz) < combinedR * combinedR;
            } else {
                const ox = obsX, oz = obsZ;
                const px = prevPos.x, pz = prevPos.z;
                const vx = s.mesh.position.x - px, vz = s.mesh.position.z - pz;

                const dx0 = px - ox, dz0 = pz - oz;
                const a = vx * vx + vz * vz;
                const b = 2 * (dx0 * vx + dz0 * vz);
                const c = dx0 * dx0 + dz0 * dz0 - combinedR * combinedR;

                const disc = b * b - 4 * a * c;
                if (disc >= 0) {
                    const sqrtDisc = Math.sqrt(disc);
                    const t1 = (-b - sqrtDisc) / (2 * a);
                    const t2 = (-b + sqrtDisc) / (2 * a);
                    if ((t1 >= 0 && t1 <= 1) || (t2 >= 0 && t2 <= 1) || (t1 < 0 && t2 > 1)) {
                        horizHit = true;
                    }
                }
            }

            if (horizHit) {
                const obsWorldPos = new THREE.Vector3(obsX, obsY + obsTop/2, obsZ);
                spawnFragments(obsWorldPos, od.color);
                playExplosionSound();
                if (od.type === 'building' && od.groupRef) {
                    const obs = od.groupRef;
                    obs.parent.remove(obs);
                    obs.traverse(c => { if(c.geometry)c.geometry.dispose(); if(c.material)c.material.dispose(); });
                    const meshIdx = obstacleMeshes.indexOf(obs);
                    if (meshIdx >= 0) obstacleMeshes.splice(meshIdx, 1);
                } else if (od.type && od.type !== 'building') {
                    disposeTreeInstance(od);
                }
                // 找到 od 在 obstacleData 中的真实索引并移除
                const realIdx = obstacleData.indexOf(od);
                if (realIdx >= 0) {
                    obstacleData.splice(realIdx, 1);
                }
                // 从空间网格中移除
                if (window._obstacleGrid) {
                    window._obstacleGrid.remove(od);
                }
                hit = true; break;
            }
        }

        // ── 炮弹 vs 敌人碰撞 (扫掠球-圆柱) ──
        if (!hit) {
            const prevY2 = prevPos.y, currY2 = s.mesh.position.y;
            for (let ei = enemies.length - 1; ei >= 0; ei--) {
                const en = enemies[ei];
                if (!en || !en.visible || en.dead) continue;
                const eR = (en.cfg && en.cfg.type === 'zombie') ? 0.4 : (en.cfg && en.cfg.type === 'hexapod') ? 1.0 : ENEMY_HALF_W;
                const eH = (en.cfg && en.cfg.type === 'zombie') ? 1.8 : (en.cfg && en.cfg.type === 'hexapod') ? 2.0 : 0.8;
                const ey = en.position.y, cr = shellR + eR;
                if (currY2 > ey + eH + 0.3 && prevY2 > ey + eH + 0.3) continue;
                if (currY2 < ey - 0.3 && prevY2 < ey - 0.3) continue;
                const ox = en.position.x, oz = en.position.z;
                const px = prevPos.x, pz = prevPos.z;
                const vx = s.mesh.position.x - px, vz = s.mesh.position.z - pz;
                if (vx * vx + vz * vz < 0.0001) continue;
                const dx0 = px - ox, dz0 = pz - oz;
                const a2 = vx * vx + vz * vz, b2 = 2 * (dx0 * vx + dz0 * vz), c2 = dx0 * dx0 + dz0 * dz0 - cr * cr;
                const d2 = b2 * b2 - 4 * a2 * c2;
                if (d2 >= 0) {
                    const sq2 = Math.sqrt(d2), t1 = (-b2 - sq2) / (2 * a2), t2 = (-b2 + sq2) / (2 * a2);
                    if ((t1 >= 0 && t1 <= 1) || (t2 >= 0 && t2 <= 1) || (t1 < 0 && t2 > 1)) {
                        const tHit = Math.max(0, Math.min(1, t1 >= 0 && t1 <= 1 ? t1 : t2));
                        const hitY = prevY2 + (currY2 - prevY2) * tHit;
                        if (hitY > ey - 0.3 && hitY < ey + eH + 0.3) {
                            en.hp -= s.damage || SHELL_DAMAGE; if (en.hp < 0) en.hp = 0; hit = true;
                            spawnHitSparks(new THREE.Vector3(ox + (px + vx * tHit - ox) * 0.5, hitY, oz + (pz + vz * tHit - oz) * 0.5)); playHitSound();
                            if (en.hp <= 0) { en.dead = true; spawnFragments(new THREE.Vector3(en.position.x, en.position.y + 1, en.position.z), '#4a5c2e'); playExplosionSound(); en.visible = false; }
                        }
                    }
                }
            }
        }

        // 双人模式：炮弹 vs 敌方坦克
        if (!hit && gameMode === 'versus' && s.owner) {
            const enemy = s.owner === player1 ? player2 : player1;
            if (enemy && !enemy.dead) {
                const edx = s.mesh.position.x - enemy.state.x;
                const edz = s.mesh.position.z - enemy.state.z;
                const eDist = Math.sqrt(edx*edx + edz*edz);
                if (eDist < TANK_HALF_W + 0.2 && s.mesh.position.y < 1.8) {
                    enemy.hp -= SHELL_DAMAGE;
                    if (enemy.hp < 0) enemy.hp = 0;
                    hit = true;
                    if (enemy.hp <= 0) {
                        enemy.dead = true;
                        const ep = enemy.group.position.clone(); ep.y += 0.5;
                        spawnFragments(ep, enemy.camoColor==='desert'?'#8b7d4a':'#4a5c2e');
                        playExplosionSound();
                        enemy.group.visible = false;
                        setTimeout(() => showVersusResult(s.owner), 2000);
                    } else {
                        // 受伤但不致命：火花 + 命中音效
                        const hitPos = s.mesh.position.clone();
                        spawnHitSparks(hitPos);
                    }
                }
            }
        }

        // 战斗/训练模式：炮弹 vs 敌人
        if (!hit && (gameMode === 'combat' || isTrainingMode) && s.owner === player1) {
            for (let ei = enemies.length - 1; ei >= 0; ei--) {
                const enemy = enemies[ei];
                if (!enemy || enemy.ai.state === 'dead') continue;
                const ep = enemy.position;
                const edx = s.mesh.position.x - ep.x;
                const edz = s.mesh.position.z - ep.z;
                const eDist = Math.sqrt(edx*edx + edz*edz);
                // 简易碰撞：半径 1.0（装甲车半宽~1m）+ 炮弹 0.18
                if (eDist < 1.2 && s.mesh.position.y < 1.5) {
                    const dmg = (combatData && combatData.playerCannonDamage) || 40;
                    if (combatData) combatData.damageDealt += dmg;
                    const killed = window.EnemyAI.onEnemyDamaged(enemy, dmg, player1);
                    window.EnemyAI.shareAggro(enemy, player1, enemies, 40);
                    const hitPos = s.mesh.position.clone();
                    spawnHitSparks(hitPos);
                    hit = true;
                    if (killed) {
                        const isZombie = (enemy.cfg && enemy.cfg.type === 'zombie');
                        const isHex = (enemy.cfg && enemy.cfg.type === 'hexapod');
                        if (isZombie || isHex) {
                            // 丧尸/六足：不立即隐藏/爆炸，走死亡动画流程
                            enemy.ai.state = 'dead';
                            enemy.ai.animRequest = 'death';
                            // 加分和掉落由 gameLoop 死亡动画处理，此处不重复执行
                        } else {
                            // 敌人死亡：立即播放爆炸 + 隐藏模型 + 清理
                            enemy.ai.state = 'dead';
                            enemy.visible = false;
                            if (enemy.userData.flameEffect) {
                                enemy.userData.flameEffect.active = false;
                                enemy.userData.flameEffect.points.visible = false;
                            }
                            const ep2 = enemy.position.clone(); ep2.y += 0.8;
                            spawnFragments(ep2, '#8B7D4A');
                            spawnExplosion(ep2);
                            playExplosionSound();
                            if (combatData) {
                                combatData.score += (enemy.cfg.score || 100);
                                combatData.kills++;
                            }
                            spawnPickup(enemy);
                            const deadEnemy = enemy;
                            if (isTrainingMode) {
                                _killEnemyInTraining(deadEnemy);
                            } else {
                                setTimeout(() => {
                                    if (deadEnemy.parent) deadEnemy.parent.remove(deadEnemy);
                                    deadEnemy.traverse(c => { if (c.geometry) c.geometry.dispose(); if (c.material) c.material.dispose(); });
                                    if (deadEnemy.userData.flameEffect) deadEnemy.userData.flameEffect.dispose();
                                    const idx = enemies.indexOf(deadEnemy);
                                    if (idx >= 0) enemies.splice(idx, 1);
                                }, 300);
                            }
                            if (!isTrainingMode && enemies.every(e => e.ai.state === 'dead')) {
                                setTimeout(() => {
                                    if (combatData) {
                                        const result = window.ScoreSystem.settleScore(selectedMapId || 'test_map_03a', combatData.score);
                                        hintBar.textContent = '🎉 已清场! 得分:' + combatData.score +
                                            (result.isNewHigh ? ' 🏆新纪录!' : '') + ' | 按ESC返回菜单';
                                    }
                                }, 1500);
                            }
                        }
                    }
                    break; // 一发炮弹最多命中一个敌人
                }
            }
        }

        // 训练场: 敌人AP炮弹直接命中判定(无溅射)
        if(!hit&&isTrainingMode&&s.isEnemyShell&&player1&&!player1.dead&&player1.group){
            var edx2 = s.mesh.position.x - player1.group.position.x;
            var edz2 = s.mesh.position.z - player1.group.position.z;
            var edy2 = s.mesh.position.y - (player1.group.position.y + 1.0);
            var ed2 = Math.sqrt(edx2*edx2 + edz2*edz2 + edy2*edy2);
            if(ed2 < 2.5){
                player1.hp -= 20; if(player1.hp < 0) player1.hp = 0; hit = true;
                player1.ai = player1.ai || {}; player1.ai.hitFlash = 0.2;
                if(player1.hp <= 0){ _killPlayerInTraining(); }
                else { spawnHitSparks(s.mesh.position.clone()); playHitSound(); }
            }
        }

        const heDetonated = (s.type === 'he' && (hit || s.mesh.position.y < getGroundHeight(s.mesh.position.x, s.mesh.position.z)));
        if (heDetonated) {
            const hPos = s.mesh.position.clone();
            hPos.y = Math.max(hPos.y, getGroundHeight(hPos.x, hPos.z));
            spawnHeExplosion(hPos);
            playHeExplosionSound();
            const checkObs = window._obstacleGrid ? 
                window._obstacleGrid.queryByDistance(hPos.x, hPos.z, HE_SPLASH + 2) : 
                obstacleData;
            for (let j = checkObs.length - 1; j >= 0; j--) {
                const od = checkObs[j];
                if (od.destroyed) continue;
                const ox = (od.type === 'building' && od.groupRef) ? od.groupRef.position.x : od.x;
                const oz = (od.type === 'building' && od.groupRef) ? od.groupRef.position.z : od.z;
                const dx = hPos.x - ox, dz = hPos.z - oz;
                const dy = hPos.y - ((od.type === 'building' && od.groupRef) ? od.groupRef.position.y : (isVersusMap ? 0 : getTerrainHeight(od.x, od.z)));
                const combinedR = HE_SPLASH + (od.radius || 0.55);
                if (dx * dx + dz * dz < combinedR * combinedR && Math.abs(dy) < (od.height || 1.5) + 1.0) {
                    const op = new THREE.Vector3(ox, ((od.type === 'building' && od.groupRef) ? od.groupRef.position.y : (isVersusMap ? 0 : getTerrainHeight(od.x, od.z))) + (od.height || 1.5) / 2, oz);
                    spawnFragments(op, od.color);
                    if (od.type === 'building' && od.groupRef) {
                        const obs = od.groupRef;
                        obs.parent.remove(obs);
                        obs.traverse(c => { if (c.geometry) c.geometry.dispose(); if (c.material) c.material.dispose(); });
                        const mi = obstacleMeshes.indexOf(obs);
                        if (mi >= 0) obstacleMeshes.splice(mi, 1);
                    } else if (od.type === 'building') {
                        disposeBuildingInstance(od);
                    } else if (od.type) {
                        disposeTreeInstance(od);
                    }
                    // 找到 od 在 obstacleData 中的真实索引并移除
                    const realIdx = obstacleData.indexOf(od);
                    if (realIdx >= 0) {
                        obstacleData.splice(realIdx, 1);
                    }
                    // 从空间网格中移除
                    if (window._obstacleGrid) {
                        window._obstacleGrid.remove(od);
                    }
                }
            }
            if (gameMode === 'combat' || isTrainingMode) {
                for (let ei = enemies.length - 1; ei >= 0; ei--) {
                    const en = enemies[ei]; if (!en || en.ai.state === 'dead') continue;
                    const ep2 = en.position, edx = hPos.x - ep2.x, edz = hPos.z - ep2.z, edy = hPos.y - ep2.y;
                    const eDist = Math.sqrt(edx * edx + edz * edz + edy * edy);
                    if (eDist < HE_SPLASH + 1.0) {
                        const isArmored = (en.cfg && (en.cfg.type === 'assault-vehicle' || en.cfg.type === 'tank'));
                        if (isArmored && eDist > 0.3) continue;
                        const dmg = isArmored ? HE_DAMAGE : Math.round(HE_DAMAGE * Math.max(0.3, 1 - eDist / HE_SPLASH));
                        const killed = window.EnemyAI.onEnemyDamaged(en, Math.max(1, dmg), player1);
                        window.EnemyAI.shareAggro(en, player1, enemies, 20);
                        if (killed) {
                            en.ai.state = 'dead';
                            const isHexKilled = (en.cfg && en.cfg.type === 'hexapod');
                            if (en.cfg && en.cfg.type !== 'zombie' && !isHexKilled) {
                                en.visible = false;
                                const ep3 = en.position.clone(); ep3.y += 0.8;
                                spawnFragments(ep3, '#8B7D4A');
                                spawnExplosion(ep3, true);
                                if (combatData) {
                                    combatData.score += (en.cfg.score || 100);
                                    combatData.kills++;
                                }
                                spawnPickup(en);
                                const dead = en;
                                if (isTrainingMode) {
                                    _killEnemyInTraining(dead);
                                } else {
                                    setTimeout(() => {
                                        if (dead.parent) dead.parent.remove(dead);
                                        dead.traverse(c => { if (c.geometry) c.geometry.dispose(); if (c.material) c.material.dispose(); });
                                        const idx2 = enemies.indexOf(dead);
                                        if (idx2 >= 0) enemies.splice(idx2, 1);
                                    }, 300);
                                }
                            }
                            if (isHexKilled) {
                                en.ai.animRequest = 'death';
                            }
                        }
                    }
                }
            }
            if (gameMode === 'versus' && s.owner) {
                const opp = s.owner === player1 ? player2 : player1;
                if (opp && !opp.dead) {
                    const odx = hPos.x - opp.state.x, odz = hPos.z - opp.state.z;
                    if (Math.sqrt(odx * odx + odz * odz) < HE_SPLASH + TANK_HALF_W) {
                        opp.hp -= HE_DAMAGE;
                        if (opp.hp <= 0) { opp.dead = true; opp.hp = 0; }
                    }
                }
            }
        }

        // 删除条件
        const distRef = gameMode === 'versus' && s.owner ? s.owner : { state: tankState };
        const refX = distRef.state ? distRef.state.x : tankState.x;
        const refZ = distRef.state ? distRef.state.z : tankState.z;
        const distToTank = Math.sqrt((s.mesh.position.x-refX)**2 + (s.mesh.position.z-refZ)**2);
        const shellGroundY = getGroundHeight(s.mesh.position.x, s.mesh.position.z);
        if (hit || s.mesh.position.y < shellGroundY || distToTank > SHELL_MAX_DIST ||
            Math.abs(s.mesh.position.x) > worldHalfW+50 || Math.abs(s.mesh.position.z) > worldHalfD+50) {

            // 🆕 地面命中效果（非障碍物/坦克碰撞，且炮弹低于地形）
            if (!hit && s.mesh.position.y < shellGroundY) {
                const impactPos = s.mesh.position.clone();
                impactPos.y = shellGroundY;
                if (s.type !== 'he') playGroundHitSound();
                spawnGroundDebris(impactPos);
                spawnScorchMark(impactPos);
            }
            scene.remove(s.mesh); disposeShellMesh(s.mesh);
            if (s.tracerLight) { scene.remove(s.tracerLight); }
            if (s.glowTail) { scene.remove(s.glowTail); s.glowTail.geometry.dispose(); s.glowTail.material.dispose(); }
            shells.splice(i, 1);
        }
    }

    // ── 碎块更新 ──
    for (let i = fragments.length - 1; i >= 0; i--) {
        const f = fragments[i];
        f.life -= dt;
        f.vel.y -= SHELL_GRAVITY * dt;
        f.mesh.position.x += f.vel.x * dt;
        f.mesh.position.y += f.vel.y * dt;
        f.mesh.position.z += f.vel.z * dt;
        f.mesh.rotation.x += f.rotSpeed.x * dt;
        f.mesh.rotation.y += f.rotSpeed.y * dt;
        f.mesh.rotation.z += f.rotSpeed.z * dt;

        // 落地后停在地面
        const fragGroundY = getGroundHeight(f.mesh.position.x, f.mesh.position.z) + 0.05;
        if (f.mesh.position.y < fragGroundY) {
            f.mesh.position.y = fragGroundY;
            f.vel.set(0, 0, 0);
        }

        // 渐隐
        const alpha = Math.max(0, f.life / FRAG_LIFE);
        f.mesh.material.opacity = alpha;
        f.mesh.material.transparent = alpha < 1;

        if (f.life <= 0) {
            scene.remove(f.mesh);
            f.mesh.geometry.dispose();
            f.mesh.material.dispose();
            fragments.splice(i, 1);
        }
    }

    // ── 炮口焰更新 ──
    for (let i = muzzleLights.length - 1; i >= 0; i--) {
        const ml = muzzleLights[i];
        ml.life -= dt;
        if (ml.light.isPointLight) {
            ml.light.intensity = Math.max(0, ml.light.intensity * (1 - dt * 10));
        } else if (ml.light.isMesh) {
            ml.light.scale.multiplyScalar(1 + dt * 8);
            ml.light.material.opacity = Math.max(0, ml.life / 0.35);
        }
        if (ml.life <= 0) {
            scene.remove(ml.light);
            if (ml.light.geometry) ml.light.geometry.dispose();
            if (ml.light.material) ml.light.material.dispose();
            muzzleLights.splice(i, 1);
        }
    }
    for (let i = ringFX.length - 1; i >= 0; i--) {
        const rf = ringFX[i];
        rf.life -= dt;
        rf.mesh.material.opacity = Math.max(0, rf.life / rf.maxLife);
        if (rf.isShockwave) {
            const t = 1 - rf.life / rf.maxLife;
            const s = 0.06 + (rf.targetScale - 0.06) * t;
            rf.mesh.scale.set(s, s, s);
            rf.mesh.material.opacity = Math.max(0, 0.7 * (1 - t * t));
        }
        if (rf.isFrag) {
            if (rf.mesh.userData && rf.mesh.userData.vel) {
                rf.mesh.userData.vel.y -= 9.8 * dt;
                rf.mesh.position.x += rf.mesh.userData.vel.x * dt;
                rf.mesh.position.y += rf.mesh.userData.vel.y * dt;
                rf.mesh.position.z += rf.mesh.userData.vel.z * dt;
                rf.mesh.rotation.x += rf.mesh.userData.rot.x * dt;
                rf.mesh.rotation.y += rf.mesh.userData.rot.y * dt;
            }
            const gy = getGroundHeight(rf.mesh.position.x, rf.mesh.position.z) + 0.05;
            if (rf.mesh.position.y < gy) { rf.mesh.position.y = gy; if (rf.mesh.userData) rf.mesh.userData.vel = new THREE.Vector3(0,0,0); }
        }
        if (rf.life <= 0) {
            scene.remove(rf.mesh);
            rf.mesh.geometry.dispose();
            rf.mesh.material.dispose();
            ringFX.splice(i, 1);
        }
    }
    const _t2 = performance.now();  // perf: 炮弹/碎片/炮口焰阶段结束
    perfAcc.combat += _t2 - _t1;

    // ── 装填计时器 + 进度条 ──
    if (player1 && player1.reloadTimer > 0) {
        player1.reloadTimer -= dt;
        if (player1.reloadTimer <= 0) {
            player1.reloadTimer = 0;
            // 手柄装填完成短震
            if (useGamepad) {
                const gp = getGamepad();
                if (gp && gp.vibrationActuator) {
                    try { gp.vibrationActuator.playEffect('dual-rumble', { duration: 150, strongMagnitude: 0.6, weakMagnitude: 0.3 }); } catch(e) {}
                }
            }
        }
    }
    // 同步全局引用（向后兼容）
    reloadTimer = player1 ? player1.reloadTimer : 0;
    if (player1) {
        updateBarsForCamera(player1, camera);
    }

    // 障碍物动态可见性 + 草丛距离剔除 + 风车叶片旋转
    if (visibilityTimer > 0.3) {
        updateObstacleVisibility();
        updateGrassVisibility();
        visibilityTimer = 0;
    }
    // 风车叶片持续旋转
    for (const od of obstacleData) {
        if (od.blades) {
            od.blades.rotation.x += 1.5 * dt;
        }
    }
    // 水面波动动画 → waters.js
    updateWaterAnimation(dt);

    // 摄像机
    placeCamera();
    occlusionTimer += dt;
    if (occlusionTimer > 0.3) {
        handleObstacleOcclusion();
        occlusionTimer = 0;
    }

    // 影子
    const shadow = tankGroup.getObjectByName('shadow');
    if (shadow) { shadow.position.y = 0.02; }

    // ── 坦克损毁效果（血量 < 50 时显示火焰和烟雾） ──
    if (player1 && player1.damageEffects) {
        if (!player1.dead && player1.hp < 50) {
            if (!player1.damageEffects.active) player1.damageEffects.show();
            player1.damageEffects.update(dt, { x: player1.state.x, y: getGroundHeight(player1.state.x, player1.state.z), z: player1.state.z });
        } else if (player1.damageEffects.active) {
            player1.damageEffects.hide();
        }
    }

    // ── 玩家受击闪光（半透明红色叠加层） ──
    if (player1 && player1.ai && player1.ai.hitFlash > 0) {
        player1.ai.hitFlash = Math.max(0, player1.ai.hitFlash - dt);
        const overlay = tankGroup.userData.hitFlashOverlay;
        if (overlay) {
            overlay.visible = true;
            overlay.material.opacity = Math.min(0.5, player1.ai.hitFlash * 4);
        }
    } else if (player1 && player1.ai) {
        const overlay = tankGroup.userData.hitFlashOverlay;
        if (overlay && overlay.material.opacity > 0) {
            overlay.material.opacity = 0;
            overlay.visible = false;
        }
        if (player1.ai) player1.ai.hitFlash = 0;
    }
    // ── 屏幕震动衰减 ──
    if (combatShakeTimer > 0) combatShakeTimer = Math.max(0, combatShakeTimer - dt);

    // ── MG 子弹更新 ──
    updateMGBullets(dt);

    // ── 六足战车加特林弹丸更新 ──
    for (let hi = hexapodBullets.length - 1; hi >= 0; hi--) {
        const hb = hexapodBullets[hi];
        hb.dist += hb.speed * dt;
        hb.pos.addScaledVector(hb.dir, hb.speed * dt);
        hb.mesh.position.copy(hb.pos);
        // 圆柱体沿Y轴, 用quaternion使Y对齐飞行方向(不用lookAt, 那会使+Z对齐)
        var _hbq = new THREE.Quaternion();
        _hbq.setFromUnitVectors(new THREE.Vector3(0, 1, 0), hb.dir);
        hb.mesh.setRotationFromQuaternion(_hbq);
        if (hb.dist > hb.maxDist) { scene.remove(hb.mesh); hb.mesh.geometry.dispose(); hb.mesh.material.dispose(); hexapodBullets.splice(hi, 1); continue; }
        // 检测击中玩家
        if (player1 && !player1.dead && player1.group) {
            const pp = player1.group.position.clone(); pp.y += 0.8;
            const d = hb.pos.distanceTo(pp);
            if (d < 1.0) {
                player1.hp -= hb.damage || 3;
                if (player1.hp < 0) player1.hp = 0;
                player1.ai = player1.ai || {}; player1.ai.hitFlash = 0.1;
                if (typeof playHitSound === 'function') playHitSound();
                if (player1.hp <= 0) {
                    if (isTrainingMode) { _killPlayerInTraining(); }
                    else { player1.dead = true; player1.group.visible = false; togglePlayerBars(player1, false); }
                }
                scene.remove(hb.mesh); hb.mesh.geometry.dispose(); hb.mesh.material.dispose(); hexapodBullets.splice(hi, 1);
            }
        }
    }

    // ── 六足战车导弹更新 (追踪型) ──
    for (let mi = hexapodMissiles.length - 1; mi >= 0; mi--) {
        var hm = hexapodMissiles[mi];
        hm.age += dt;
        // boost阶段(0~0.25s): 沿发射方向直飞; 之后: 有限转向率追踪玩家
        if (hm.age > 0.25) hm.tracking = true;
        if (hm.tracking && player1 && !player1.dead && player1.group) {
            var toTarget = new THREE.Vector3().subVectors(player1.group.position, hm.pos).normalize();
            // 计算当前方向与目标方向的夹角, 限制最大转向
            var curDir = hm.dir.clone();
            var angle = Math.acos(Math.min(1, Math.max(-1, curDir.dot(toTarget))));
            var maxTurn = hm.maxTurnRate * dt;
            if (angle > 0.01) {
                var turnAmount = Math.min(angle, maxTurn);
                // 旋转轴 = curDir × toTarget
                var rotAxis = new THREE.Vector3().crossVectors(curDir, toTarget).normalize();
                if (rotAxis.length() > 0.001) {
                    var rotQ = new THREE.Quaternion().setFromAxisAngle(rotAxis, turnAmount);
                    hm.dir.applyQuaternion(rotQ).normalize();
                } else {
                    hm.dir.copy(toTarget);
                }
            }
        }
        hm.pos.addScaledVector(hm.dir, hm.speed * dt);
        hm.mesh.position.copy(hm.pos);
        // 弹体朝向跟随飞行方向
        var mq = new THREE.Quaternion();
        mq.setFromUnitVectors(new THREE.Vector3(0, 0, 1), hm.dir);
        hm.mesh.setRotationFromQuaternion(mq);
        // 尾焰光跟随
        if (hm.mesh.userData._flameLight) hm.mesh.userData._flameLight.intensity = 2 + Math.random();
        // 命中检测
        var hitPlayer = false;
        if (player1 && !player1.dead && player1.group) {
            var pp = player1.group.position.clone(); pp.y += 0.8;
            if (hm.pos.distanceTo(pp) < hm.blastRadius) {
                hitPlayer = true;
                player1.hp -= hm.damage;
                if (player1.hp < 0) player1.hp = 0;
                player1.ai = player1.ai || {}; player1.ai.hitFlash = 0.15;
                if (player1.hp <= 0) {
                    if (isTrainingMode) { _killPlayerInTraining(); }
                    else { player1.dead = true; player1.group.visible = false; togglePlayerBars(player1, false); }
                }
            }
        }
        // 爆炸条件: 命中/超时3.5s/撞地
        if (hitPlayer || hm.age > 3.5 || hm.pos.y < getGroundHeight(hm.pos.x, hm.pos.z) + 0.3) {
            if (hitPlayer && typeof playHeExplosionSound === 'function') playHeExplosionSound();
            else if (typeof playExplosionSound === 'function') playExplosionSound();
            // 爆炸光
            var expLight = new THREE.PointLight('#ff8822', 15, hm.blastRadius * 3, 2);
            expLight.position.copy(hm.pos); expLight.position.y += 0.5; scene.add(expLight);
            muzzleLights.push({ light: expLight, life: 0.3 });
            // 爆炸球 (存入独立数组)
            var expGeo = new THREE.SphereGeometry(hm.blastRadius * 0.5, 8, 6);
            var expMat = new THREE.MeshBasicMaterial({ color: '#ff6622', transparent: true, opacity: 0.8 });
            var expMesh = new THREE.Mesh(expGeo, expMat);
            expMesh.position.copy(hm.pos); expMesh.position.y += 1.0; scene.add(expMesh);
            hexapodExplosions.push({ mesh: expMesh, life: 0.5, light: expLight });
            // 移除导弹
            scene.remove(hm.mesh);
            hm.mesh.traverse(function(c) { if (c.geometry) c.geometry.dispose(); if (c.material) c.material.dispose(); });
            hexapodMissiles.splice(mi, 1);
        }
    }
    // ── 导弹爆炸衰减 (独立数组) ──
    for (var ei = hexapodExplosions.length - 1; ei >= 0; ei--) {
        var he = hexapodExplosions[ei];
        he.life -= dt;
        he.mesh.scale.multiplyScalar(1 + dt * 5);
        he.mesh.material.opacity = Math.max(0, he.life / 0.5);
        if (he.life <= 0) {
            scene.remove(he.mesh); he.mesh.geometry.dispose(); he.mesh.material.dispose();
            hexapodExplosions.splice(ei, 1);
        }
    }

    // ── 训练场坦克敌人炮击（带随机偏离, 使用shells系统）──
    if (isTrainingMode) {
        for (const enemy of enemies) {
            if (enemy.cfg && (enemy.cfg.type === 'assault-vehicle' || enemy.cfg.type === 'tank') && enemy.ai && !enemy.dead && player1 && !player1.dead) {
                var ed = enemy.position.distanceTo(player1.group.position);
                // 主炮: engage状态+距离>10m 开火
                var et = enemy.ai._tankFireTimer || 0;
                et -= dt;
                if (et <= 0 && enemy.ai.state === 'engage' && ed > 10 && enemy.ai._turretAimed) {
                    et = 2.5 + Math.random() * 1.0;
                    fireEnemyTrainingShell(enemy);
                }
                enemy.ai._tankFireTimer = et;
                // MG: 参数对齐玩家(MG_RANGE=25, 10rps, 过热6s)
                if (enemy.ai.state === 'engage' && ed < MG_RANGE) {
                    var mgt = enemy.ai._mgFireTimer || 0;
                    var mgHeatE = enemy.ai._mgHeat || 0;
                    var mgOverheatedE = enemy.ai._mgOverheated || false;
                    if (mgOverheatedE) {
                        mgHeatE = Math.max(0, mgHeatE - dt);
                        if (mgHeatE <= 0) mgOverheatedE = false;
                    } else {
                        mgt -= dt;
                        if (mgt <= 0) {
                            mgt = MG_FIRE_INTERVAL;
                            mgHeatE += MG_FIRE_INTERVAL;
                            if (mgHeatE >= MG_OVERHEAT_TIME) { mgOverheatedE = true; mgHeatE = MG_OVERHEAT_TIME; }
                            else { _spawnEnemyMGTracer(enemy); }
                        }
                    }
                    enemy.ai._mgFireTimer = mgt;
                    enemy.ai._mgHeat = mgHeatE;
                    enemy.ai._mgOverheated = mgOverheatedE;
                } else {
                    var mgHeatC = enemy.ai._mgHeat || 0;
                    mgHeatC = Math.max(0, mgHeatC - dt * 2);
                    if (mgHeatC <= 0) enemy.ai._mgOverheated = false;
                    enemy.ai._mgHeat = mgHeatC;
                }
            }
        }
    }

    // ── 爆炸效果更新（坦克死亡时触发的大型火焰烟雾） ──
    for (let i = explosions.length - 1; i >= 0; i--) {
        explosions[i].update(dt);
        if (!explosions[i].active) {
            explosions[i].dispose();
            explosions.splice(i, 1);
        }
    }

    // ── 战斗模式：敌人 AI + HP条 + 受击反馈 ──
    if ((gameMode === 'combat' || isTrainingMode) && enemies.length > 0) {
        for (let ei = enemies.length - 1; ei >= 0; ei--) {
            const enemy = enemies[ei];
            if (!enemy) continue;
            const isDead = (enemy.ai.state === 'dead');
            const isZombie = (enemy.cfg && enemy.cfg.type === 'zombie');
            const isHexapod = (enemy.cfg && enemy.cfg.type === 'hexapod');
            // 已死亡的非丧尸/非六足跳过全部处理
            if (isDead && !isZombie && !isHexapod) continue;
            // 已死亡的六足: HexapodEnemy 死亡动画接管，动画播完后 continue
            if (isDead && isHexapod) {
                var hst = enemy.userData._hexAnimState;
                if (hst) {
                    HexapodEnemy.update(enemy, dt);
                    // 死亡动画完成后标记完成 → 训练场重生
                    if (hst._deathDone && !enemy.ai.deathAnimDone) {
                        enemy.ai.deathAnimDone = true;
                        enemy.dead = true; // 标记为死亡，供训练场重生检测
                        enemy.visible = false; // 隐藏死亡模型
                        if (enemy.userData && enemy.userData.hpBarGroup) enemy.userData.hpBarGroup.visible = false;
                        if (isTrainingMode) _killEnemyInTraining(enemy);
                    }
                }
                continue;
            }
            // 已死亡的丧尸只做动画处理（不执行AI/物理/伤害）
            if (isDead && isZombie) {
                // 实时归零HP条（避免停在最后一击之前的值）
                if (enemy.userData.hpBarGroup && enemy.userData.hpBarFill) {
                    enemy.userData.hpBarFill.scale.x = 0;
                    enemy.userData.hpBarFill.position.x = -0.75;
                    enemy.userData.hpBarFill.material.color.setRGB(1, 0, 0);
                    enemy.userData.hpBarGroup.lookAt(camera.position);
                }
                const asys = enemy.userData._animSystem;
                if (asys) {
                    asys.update(dt);
                    if (!enemy.ai.deathAnimStarted) {
                        enemy.ai.deathAnimStarted = true;
                        asys.play('Die', false);
                        enemy.ai.deathDoneTimer = 0;
                    }
                    if (enemy.ai.deathAnimStarted) {
                        enemy.ai.deathDoneTimer = (enemy.ai.deathDoneTimer || 0) + dt;
                        if (enemy.ai.deathDoneTimer >= 1.5 && !enemy.ai.deathAnimDone) {
                            // 倒地动画结束 → 直接移除实例，无爆炸（v0.26.13fix: +deathAnimDone防重复）
                            enemy.ai.deathAnimDone = true;
                            enemy.visible = false;
                            if (combatData) {
                                combatData.score += (enemy.cfg.score || 50);
                                combatData.kills++;
                            }
                            spawnPickup(enemy);
                            const deadEnemy = enemy;
                            if (isTrainingMode) {
                                _killEnemyInTraining(deadEnemy);
                            } else {
                                setTimeout(() => {
                                    if (deadEnemy.parent) deadEnemy.parent.remove(deadEnemy);
                                    deadEnemy.traverse(c => { if (c.geometry) c.geometry.dispose(); if (c.material) c.material.dispose(); });
                                    const idx = enemies.indexOf(deadEnemy);
                                    if (idx >= 0) enemies.splice(idx, 1);
                                }, 300);
                            }
                            if (!isTrainingMode && enemies.every(e => e.ai && (e.ai.state === 'dead' || e.visible === false))) {
                                setTimeout(() => {
                                    if (combatData) {
                                        const result = window.ScoreSystem.settleScore(selectedMapId || 'test_map_03a', combatData.score);
                                        hintBar.textContent = '🎉 已清场! 得分:' + combatData.score + (result.isNewHigh ? ' 🏆新纪录!' : '') + ' | 按ESC返回菜单';
                                    }
                                }, 1500);
                            }
                        }
                    }
                } else {
                        enemy.visible = false;
                    if (combatData) combatData.score += (enemy.cfg.score || 50);
                    spawnPickup(enemy);
                    const deadEnemy = enemy;
                    if (isTrainingMode) {
                        _killEnemyInTraining(deadEnemy);
                    } else {
                        setTimeout(() => {
                            if (deadEnemy.parent) deadEnemy.parent.remove(deadEnemy);
                            deadEnemy.traverse(c => { if (c.geometry) c.geometry.dispose(); if (c.material) c.material.dispose(); });
                            const idx = enemies.indexOf(deadEnemy);
                            if (idx >= 0) enemies.splice(idx, 1);
                        }, 300);
                    }
                    if (!isTrainingMode && enemies.every(e => e.ai && (e.ai.state === 'dead' || e.visible === false))) {
                        setTimeout(() => {
                            if (combatData) {
                                const result = window.ScoreSystem.settleScore(selectedMapId || 'test_map_03a', combatData.score);
                                hintBar.textContent = '🎉 已清场! 得分:' + combatData.score + (result.isNewHigh ? ' 🏆新纪录!' : '') + ' | 按ESC返回菜单';
                            }
                        }, 1500);
                    }
                }
                continue;
            }
            // AI 状态机更新
            window.EnemyAI.updateEnemyAI(enemy, dt, [player1], scene);
            // 六足动画更新 (CCD IK + 步态, 内部处理地形适应)
            if (isHexapod && enemy.userData._hexAnimState) {
                HexapodEnemy.update(enemy, dt);
            }
            // 贴地 + 地形俯仰/侧倾 (六足由 HexapodEnemy 内部处理, 跳过)
            if (!isHexapod) {
                enemy.position.y = getGroundHeight(enemy.position.x, enemy.position.z);
            }
            if (!enemy.userData._noTerrainPitch && !isHexapod) {
                if (!enemy.rotation.order || enemy.rotation.order !== 'YXZ') enemy.rotation.order = 'YXZ';
                const sampleDist = 1.0;
                const eFwdX = -Math.cos(enemy.rotation.y);
                const eFwdZ = Math.sin(enemy.rotation.y);
                // 俯仰: 前后采样
                const fh = getGroundHeight(enemy.position.x + eFwdX * sampleDist, enemy.position.z + eFwdZ * sampleDist);
                const bh = getGroundHeight(enemy.position.x - eFwdX * sampleDist, enemy.position.z - eFwdZ * sampleDist);
                const eTerrainPitch = Math.atan2(fh - bh, sampleDist * 2);
                enemy.rotation.x = -eTerrainPitch;
                // 侧倾: 左右采样
                const sideDist = 1.0;
                const eRightX = -Math.cos(enemy.rotation.y + Math.PI / 2);
                const eRightZ = Math.sin(enemy.rotation.y + Math.PI / 2);
                const lh = getGroundHeight(enemy.position.x - eRightX * sideDist, enemy.position.z - eRightZ * sideDist);
                const rh = getGroundHeight(enemy.position.x + eRightX * sideDist, enemy.position.z + eRightZ * sideDist);
                const eTerrainRoll = Math.atan2(rh - lh, sideDist * 2);
                enemy.rotation.z = -eTerrainRoll;
            }
            // 🚜 坦克 vs 丧尸碰撞（碾压 或 推开）
            if (isZombie && player1 && !player1.dead) {
                const crushDist = enemy.position.distanceTo(player1.group.position);
                if (crushDist < 1.3 && crushDist > 0.01) {
                    const tankForward = new THREE.Vector3(Math.cos(player1.state.yaw), 0, Math.sin(player1.state.yaw));
                    const tankToZombie = new THREE.Vector3().subVectors(enemy.position, player1.group.position).normalize();
                    const frontAlignment = tankForward.dot(tankToZombie);
                    const tankTowardZombie = frontAlignment > 0;       // 大方向朝丧尸（用于速度计算）
                    const inFrontCone = frontAlignment > 0.87;        // 仅在正前方窄锥内碾压（±~30°）

                    // 坦克地面速度
                    const tankSpeed = Math.abs(currentLeftSpeed) + Math.abs(currentRightSpeed);

                    // 丧尸趋近速度（面向坦克 + 追击/攻击状态才计入）
                    let zombieApproach = 0;
                    if (tankTowardZombie) {
                        const zState = enemy.ai.state;
                        if (zState === 'pursuit') {
                            zombieApproach = (enemy.cfg.speed || 1.5) * 2.5;
                        } else if (zState === 'attack') {
                            zombieApproach = enemy.cfg.speed || 1.5;
                        }
                        // 丧尸是否面向坦克（丧尸前端 +Z：forward = (sin(rotY), 0, cos(rotY))）
                        const zForward = new THREE.Vector3(Math.sin(enemy.rotation.y), 0, Math.cos(enemy.rotation.y));
                        const zombieToTank = new THREE.Vector3().subVectors(player1.group.position, enemy.position).normalize();
                        if (zForward.dot(zombieToTank) < 0) zombieApproach = 0; // 背对=无趋近
                    }
                    const combinedSpeed = tankSpeed + zombieApproach;

                    if (tankSpeed > 3.0 && combinedSpeed > 4.5 && inFrontCone) {
                        // ⚡ 碾压击杀
                        enemy.hp = 0;
                        enemy.ai.state = 'dead';
                        enemy.ai.animRequest = 'death';
                        enemy.ai.prevState = enemy.ai.prevState || 'idle';
                        enemy.ai.deathAnimStarted = false;
                        if (enemy.userData.hpBarGroup && enemy.userData.hpBarFill) {
                            enemy.userData.hpBarFill.scale.x = 0;
                            enemy.userData.hpBarFill.position.x = -0.75;
                            enemy.userData.hpBarFill.material.color.setRGB(1, 0, 0);
                        }
                    }
                    // 不满足碾压条件 → 丧尸可正常近战攻击（保留碰撞体积）
                }
            }
            // HP 条更新
            if (enemy.userData.hpBarGroup && enemy.userData.hpBarFill) {
                const hpPct = Math.max(0, enemy.hp / (enemy.userData.maxHp || 60));
                enemy.userData.hpBarFill.scale.x = hpPct;
                enemy.userData.hpBarFill.position.x = -(1 - hpPct) * 0.75;
                enemy.userData.hpBarFill.material.color.setRGB(1 - hpPct, hpPct, 0);
                enemy.userData.hpBarGroup.lookAt(camera.position);
            }
            // 受击闪烁（白色半透明叠加层，不与材质 emissive 交互）
            if (enemy.ai.hitFlash > 0) {
                enemy.ai.hitFlash = Math.max(0, enemy.ai.hitFlash - dt);
                const overlay = enemy.userData.hitFlashOverlay;
                if (overlay) {
                    overlay.visible = true;
                    overlay.material.opacity = Math.min(0.55, enemy.ai.hitFlash * 3.5);
                }
            } else {
                const overlay = enemy.userData.hitFlashOverlay;
                if (overlay && overlay.material.opacity > 0) {
                    overlay.material.opacity = 0;
                    overlay.visible = false;
                }
                enemy.ai.hitFlash = 0;
            }
            // 火焰视觉特效
            updateEnemyFlameVFX(enemy, player1, dt);
            // 喷火伤害玩家 (v0.26.3: 跳距模型 — 火焰每跳前进4.2u，前沿触达才开始扣血)
            if (enemy.ai.flameRequest && player1 && !player1.dead) {
                // 方向安全校验：炮管必须指向玩家方向（60°锥内），避免背后火球
                const tp = enemy.userData.turretPivot;
                let turretFacingPlayer = true;
                if (tp) {
                    const nozzleWorld = tp.localToWorld(new THREE.Vector3(-1.05, 1.27, 0));
                    const turretDir = new THREE.Vector3(-1, 0, 0)
                        .applyQuaternion(tp.getWorldQuaternion(new THREE.Quaternion())).normalize();
                    const enToPlayer = new THREE.Vector3().subVectors(player1.group.position, nozzleWorld).normalize();
                    turretFacingPlayer = turretDir.dot(enToPlayer) > 0.5;
                }
                if (turretFacingPlayer) {
                    const ed = enemy.position.distanceTo(player1.group.position);
                    const flameRange = enemy.cfg.flameRange || 12;
                    if (ed < flameRange) {
                        // 跳距模型：每跳0.15s×28u/s=4.2u，火焰前沿位置 = 已消耗跳数 × 4.2
                        const totalTicks = enemy.cfg.flameTicks || 5;
                        const ticksConsumed = totalTicks - (enemy.ai.flameTicksLeft || 0);
                        const flameDistance = ticksConsumed * 0.15 * 28;
                        if (flameDistance >= ed) {
                            player1.hp -= (enemy.cfg.flameDamage || 8);
                            if (player1.hp < 0) player1.hp = 0;
                            playHitSound();
                            player1.ai = player1.ai || {};
                            player1.ai.hitFlash = 0.15;
                            combatShakeTimer = 0.12;
                            if (player1.damageEffects && !player1.damageEffects.active && player1.hp < 50) {
                                player1.damageEffects.show();
                            }
                            if (player1.hp <= 0) {
                                player1.dead = true;
                                const pep = player1.group.position.clone(); pep.y += 0.5;
                                spawnFragments(pep, '#4a5c2e');
                                playExplosionSound();
                                player1.group.visible = false;
                                togglePlayerBars(player1, false);
                                if (combatData) {
                                    combatData.lives--;
                                    combatData.deaths.push({ type: 'flame', enemy: enemy.cfg.type === 'assault-vehicle' ? '装甲突击车' : '未知敌人' });
                                }
                                if (combatData && combatData.lives > 0) {
                                    hintBar.textContent = '💀 你被击毁了! 剩余命数:' + combatData.lives + ' | 3秒后重生...';
                                    setTimeout(() => respawnPlayer(), 3000);
                                } else if (isTrainingMode) {
                                    _killPlayerInTraining();
                                } else {
                                    showGameOverScreen();
                                }
                            }
                        }
                    }
                }
                // 最后一跳后关闭火焰状态（AI 已不再主动关闭 isFlaming）
                if (enemy.ai.flameTicksLeft <= 0) {
                    enemy.ai.isFlaming = false;
                    enemy.ai.flameRequest = false;
                }
            }

            // ── 丧尸专用更新：动画 + STAGGER + 攻击命中 + 死亡动画 ──
            if (enemy.cfg && enemy.cfg.type === 'zombie') {
                const asys = enemy.userData._animSystem;
                const ai = enemy.ai;

                // 1. 3层LOD + 5m滞后带（防边界抖动）
                //    near(<30m): 骨架可见+全帧动画 | medium(30~70m): 骨架可见+冻结动画 | far(>70m): 圆柱占位+冻结动画
                if (asys) {
                    const pDist = player1 ? enemy.position.distanceTo(player1.group.position) : 999;
                    const prevLayer = enemy.userData._lodLayer || 'near';
                    let layer;
                    if (prevLayer === 'near') {
                        layer = pDist > 35 ? (pDist > 75 ? 'far' : 'medium') : 'near';
                    } else if (prevLayer === 'medium') {
                        layer = pDist < 30 ? 'near' : (pDist > 75 ? 'far' : 'medium');
                    } else {
                        layer = pDist < 70 ? (pDist < 30 ? 'near' : 'medium') : 'far';
                    }
                    enemy.userData._lodLayer = layer;
                    // 切换可见性
                    const isFar = (layer === 'far');
                    const skel = enemy.userData._skeletonGroup;
                    const cyl = enemy.userData._lodCylinder;
                    if (skel) skel.visible = !isFar;
                    if (cyl) cyl.visible = isFar;
                    // 动画分帧
                    asys.skipInterval = (layer === 'near') ? 0 : 999;
                    asys.update(dt);
                }

                // 1.5. 全局安全网：不论状态，hp≤0 立即转 dead
                if (enemy.hp <= 0 && ai.state !== 'dead') {
                    console.log('💀 丧尸安全网: hp=' + enemy.hp + ' state=' + ai.state + ' → dead');
                    ai.state = 'dead';
                    ai.animRequest = 'death';
                    ai.deathAnimStarted = false;
                    if (asys) asys.skipInterval = 0;  // 倒地动画必须全帧
                }

                // 2. 处理 STAGGER 退出（硬直恢复）
                if (ai.state === 'stagger') {
                    const now = Date.now() / 1000;
                    if (enemy.hp <= 0) {
                        ai.state = 'dead';
                        ai.animRequest = 'death';
                        ai.deathAnimStarted = false;
                    } else if (now - ai.lastHitTime > (enemy.cfg.staggerRecoverTime || 0.6)) {
                        ai.state = ai.prevState || 'patrol';
                        ai.animRequest = 'walk';
                    }
                }

                // 3. 攻击命中检测（挥击播放到 ~60% 时扣血）
                if (ai.animRequest === 'attack' && ai.animAtkStart > 0 && !ai.animHitApplied) {
                    const t = asys ? asys.currentTime : 0;
                    if (t >= 0.30 && t <= 0.45) {
                        ai.animHitApplied = true;
                        if (player1 && !player1.dead) {
                            const pDist = enemy.position.distanceTo(player1.group.position);
                            if (pDist < (enemy.cfg.attackDist || 2.5)) {
                                const dmg = enemy.cfg.attackDamage || 10;
                                player1.hp -= dmg;
                                if (player1.hp < 0) player1.hp = 0;
                                playHitSound();
                                player1.ai = player1.ai || {};
                                player1.ai.hitFlash = 0.15;
                                combatShakeTimer = 0.12;
                                if (player1.damageEffects && !player1.damageEffects.active && player1.hp < 50) {
                                    player1.damageEffects.show();
                                }
                                if (player1.hp <= 0) {
                                    player1.dead = true;
                                    const pep = player1.group.position.clone(); pep.y += 0.5;
                                    spawnFragments(pep, '#4a5c2e');
                                    playExplosionSound();
                                    player1.group.visible = false;
                                    togglePlayerBars(player1, false);
                                    if (combatData) {
                                        combatData.lives--;
                                        combatData.deaths.push({ type: 'melee', enemy: '丧尸' });
                                    }
                                    if (combatData && combatData.lives > 0) {
                                        hintBar.textContent = '💀 你被丧尸击倒了! 剩余命数:' + combatData.lives + ' | 3秒后重生...';
                                        setTimeout(() => respawnPlayer(), 3000);
                                    } else if (isTrainingMode) {
                                        _killPlayerInTraining();
                                    } else {
                                        showGameOverScreen();
                                    }
                                }
                            }
                        }
                    }
                }

                // 4. 攻击动画播完→进入冷却
                if (ai.animRequest === 'attack' && ai.animAtkStart > 0) {
                    if (asys && !asys.playing) {
                        ai.atkReady = true;
                        ai.animRequest = 'walk';
                    }
                }

                // 5. 播放 AI 状态请求的动画（AnimationSystem）
                if (ai.animRequest && asys) {
                    const nameMap = { idle:'Idle', walk:'Walk', run:'Run', attack:'Attack', hit:'Hit', death:'Die' };
                    const mapped = nameMap[ai.animRequest] || ai.animRequest;
                    const needLoop = ai.state === 'stagger' ? false : !['Hit','Die'].includes(mapped);
                    if (asys.current !== mapped || !asys.playing) {
                        asys.play(mapped, needLoop);
                        if (mapped === 'Attack') { ai.animHitApplied = false; }
                    }
                }

                // 6. 死亡动画启动（播完/清理由顶部跳过逻辑处理）
                if (enemy.hp <= 0 && ai.state === 'dead' && !ai.deathAnimStarted) {
                    ai.deathAnimStarted = true;
                    ai.animRequest = 'death';
                    if (asys) asys.play('Die', false);
                }
            }

            // ── 六足战车动画: 统一由 HexapodEnemy (hexapod_core) 处理 ──
            // (旧版 keyframe 动画已移除，v0.58.0)

            // ── 六足战车武器与视觉系统（独立于动画引擎，始终运行）──
            if (enemy.cfg && enemy.cfg.type === 'hexapod') {
                const hai = enemy.ai;
                const skel = enemy.userData._skeletonGroup;
                const cyl = enemy.userData._lodCylinder;
                // LOD
                var isFar = false;
                if (!isTrainingMode) {
                    const hpDist = player1 ? enemy.position.distanceTo(player1.group.position) : 999;
                    const hprevLayer = enemy.userData._lodLayer || 'near';
                    let hlayer;
                    if (hprevLayer === 'near') hlayer = hpDist > 35 ? (hpDist > 75 ? 'far' : 'medium') : 'near';
                    else if (hprevLayer === 'medium') hlayer = hpDist < 30 ? 'near' : (hpDist > 75 ? 'far' : 'medium');
                    else hlayer = hpDist < 70 ? (hpDist < 30 ? 'near' : 'medium') : 'far';
                    enemy.userData._lodLayer = hlayer;
                    isFar = (hlayer === 'far');
                }
                if (skel) skel.visible = !isFar;
                if (cyl) cyl.visible = isFar;
                // 观瞄设备发光
                var obsMesh = enemy.userData._obsMesh;
                if (obsMesh && obsMesh.material) {
                    var glowColor;
                    if (enemy.dead || hai.state === 'dead') glowColor = new THREE.Color(0x111111);
                    else if (hai.state === 'engage' && (hai.spinUp || 0) > 0.5) glowColor = new THREE.Color(0xff2200);
                    else if (hai.state === 'chase') glowColor = new THREE.Color(0xff8800);
                    else if (hai.state === 'patrol') glowColor = new THREE.Color(0x44aaff);
                    else glowColor = new THREE.Color(0x33cc33);
                    obsMesh.material.emissive = glowColor;
                    obsMesh.material.emissiveIntensity = (enemy.dead || hai.state === 'dead') ? 0.1 : 1.5;
                }
                // 加特林枪管红热
                var barrelMats = enemy.userData._barrelMats;
                if (barrelMats && barrelMats.length > 0) {
                    var heatNorm = Math.min(1, (hai.heat || 0) / 100);
                    var hotColor = new THREE.Color().lerpColors(new THREE.Color(0x5a5a64), new THREE.Color(0xff4400), heatNorm);
                    for (var bmi = 0; bmi < barrelMats.length; bmi++) {
                        if (barrelMats[bmi]) { barrelMats[bmi].emissive = hotColor; barrelMats[bmi].emissiveIntensity = heatNorm * 2.0; }
                    }
                }
                // 加特林发射
                if (hai.gatlingRequest && player1 && !player1.dead) { hai.gatlingRequest = false; spawnHexapodGatlingBullet(enemy, player1, hai); }
                // 导弹发射
                var _useSide = (hai._lastMissileSide === 'L') ? 'R' : 'L';
                var _sideAmmo = (_useSide === 'L') ? (hai._missileAmmoL || 0) : (hai._missileAmmoR || 0);
                if (hai.missileRequest && player1 && !player1.dead && hexapodMissiles.length === 0 && _sideAmmo > 0) {
                    hai.missileRequest = false;
                    if (_useSide === 'L') hai._missileAmmoL = _sideAmmo - 1;
                    else hai._missileAmmoR = _sideAmmo - 1;
                    spawnHexapodMissile(enemy, player1, hai);
                }
                // ── 碰撞包围柱可视化 (F4切换) ──
                if (window._showHexColliders) {
                    var dc = enemy.userData._dbgCollider;
                    if (!dc) {
                        var dGeo = new THREE.CylinderGeometry(1.0, 1.0, 2.0, 16, 1, true);
                        var dMat = new THREE.MeshBasicMaterial({ color: 0x00ff00, wireframe: true, depthTest: false });
                        dc = new THREE.Mesh(dGeo, dMat);
                        dc.renderOrder = 9999;
                        scene.add(dc);
                        enemy.userData._dbgCollider = dc;
                    }
                    dc.position.copy(enemy.position); dc.position.y += 1.0;
                    dc.visible = true;
                } else if (enemy.userData._dbgCollider) {
                    enemy.userData._dbgCollider.visible = false;
                }
            }
        }

        // 敌人障碍物碰撞检测（防止穿透建筑/树木/河流）
        for (const enemy of enemies) {
            if (!enemy || enemy.ai.state === 'dead') continue;
            const eRad = (enemy.cfg && enemy.cfg.type === 'zombie') ? 0.4 : (enemy.cfg && enemy.cfg.type === 'hexapod') ? 0.6 : ENEMY_HALF_W;
            const cr = checkCollision(enemy.position.x, enemy.position.z, eRad);
            if (cr.hit) {
                enemy.position.x += cr.pushX;
                enemy.position.z += cr.pushZ;
            }
        }
        // v0.26.4fix3: 敌人间碰撞（防止移动中互相穿透融合）
        for (let i = 0; i < enemies.length; i++) {
            const ea = enemies[i];
            if (!ea || ea.ai.state === 'dead') continue;
            for (let j = i + 1; j < enemies.length; j++) {
                const eb = enemies[j];
                if (!eb || eb.ai.state === 'dead') continue;
                const dx = ea.position.x - eb.position.x;
                const dz = ea.position.z - eb.position.z;
                const dist = Math.sqrt(dx * dx + dz * dz);
                // 按类型区分碰撞半径：丧尸 0.4m，车辆半宽 0.85m
                const ra = (ea.cfg && ea.cfg.type === 'zombie') ? 0.4 : (ea.cfg && ea.cfg.type === 'hexapod') ? 0.6 : ENEMY_HALF_W;
                const rb = (eb.cfg && eb.cfg.type === 'zombie') ? 0.4 : (eb.cfg && eb.cfg.type === 'hexapod') ? 0.6 : ENEMY_HALF_W;
                const minDist = (ra + rb) * 1.5; // 留 50% 余量
                if (dist < minDist && dist > 0.001) {
                    const push = (minDist - dist) / 2;
                    const nx = dx / dist;
                    const nz = dz / dist;
                    ea.position.x += nx * push;
                    ea.position.z += nz * push;
                    eb.position.x -= nx * push;
                    eb.position.z -= nz * push;
                }
            }
        }
        // v0.26.4fix: 玩家近防机枪 — 移到敌人循环外部，每帧只调用一次（修复双循环声音翻倍）
        updateMGAutoTarget(player1, dt);
    }

    // v0.26.5: 战利品拾取检测 — 独立于敌人存活状态运行（悬停发光+触碰回血）
    updatePickups(dt);

    // ── 焦痕渐消更新（地面命中产生的黑色痕迹，3秒淡出） ──
    for (let i = scorchMarks.length - 1; i >= 0; i--) {
        const sc = scorchMarks[i];
        sc.life -= dt;
        if (sc.life <= 0) {
            scene.remove(sc.mesh);
            sc.mesh.geometry.dispose();
            sc.mesh.material.dispose();
            scorchMarks.splice(i, 1);
        } else {
            sc.mesh.material.opacity = 0.65 * (sc.life / sc.maxLife);
        }
    }

    // ── 地面碎片更新（土块飞溅，~1秒消失） ──
    for (let i = groundDebris.length - 1; i >= 0; i--) {
        const gd = groundDebris[i];
        gd.life -= dt;
        if (gd.life <= 0) {
            scene.remove(gd.mesh);
            gd.mesh.geometry.dispose();
            gd.mesh.material.dispose();
            groundDebris.splice(i, 1);
        } else {
            gd.vel.y -= 9.8 * dt;
            gd.mesh.position.x += gd.vel.x * dt;
            gd.mesh.position.y += gd.vel.y * dt;
            gd.mesh.position.z += gd.vel.z * dt;
            const gdGY = getGroundHeight(gd.mesh.position.x, gd.mesh.position.z) + 0.05;
            if (gd.mesh.position.y < gdGY) gd.mesh.position.y = gdGY;
            gd.mesh.material.opacity = gd.life / gd.maxLife;
        }
    }

    // FPS 统计 + 性能探针报告（每0.5s一次）
    const _t3 = performance.now();  // perf: 杂项更新阶段结束
    perfAcc.updates += _t3 - _t2;
    fpsFrames++;
    fpsTime += dt;
    if (fpsTime >= 0.5) {
        fpsCurrent = Math.round(fpsFrames / fpsTime);
        // 计算各阶段平均耗时（ms），并存入快照供 updateDebugInfo 使用
        if (perfAcc.frames > 0) {
            perfDisplay.physics = (perfAcc.physics / perfAcc.frames).toFixed(2);
            perfDisplay.combat = (perfAcc.combat / perfAcc.frames).toFixed(2);
            perfDisplay.updates = (perfAcc.updates / perfAcc.frames).toFixed(2);
            perfDisplay.render = (perfAcc.render / perfAcc.frames).toFixed(2);
            perfDisplay.total = (perfAcc.physics + perfAcc.combat + perfAcc.updates + perfAcc.render) / perfAcc.frames;
            perfDisplay.total = perfDisplay.total.toFixed(2);
        }
        // 重置累加器
        perfAcc = { physics:0, combat:0, updates:0, render:0, frames:0 };
        fpsFrames = 0; fpsTime = 0;
        updateDebugInfo();
    }

    // ⚡ v0.24.10: 阴影相机跟随坦克（36m范围，512分辨率→像素密度提升5.5倍）
    if (sunLight && sunLight.castShadow && shadowEnabled) {
        const tx = tankGroup.position.x, tz = tankGroup.position.z;
        sunLight.position.set(tx + 30, 40, tz + 20);
        sunLight.target.position.set(tx, 0, tz);
        sunLight.shadow.camera.updateProjectionMatrix();
    }

    renderer.render(scene, camera);
    const _t4 = performance.now();  // perf: 渲染阶段结束
    perfAcc.render += _t4 - _t3;
    perfAcc.frames++;
    } catch(e) { console.warn('gameLoop error:', e.message, e.stack); }
    animationId = requestAnimationFrame(gameLoop);
}

// ==================== 摄像机 ====================
// 摄像机跟随鼠标横轴（独立于车身/炮塔），避免车身转向导致视角剧烈变化
// 摄像机参数（单人模式×0.5，双人模式×0.7）
const CAMERA_BEHIND = 14.625;  // 后方距离（距坦克够远）
const CAMERA_ABOVE = 10.0;    // 上方高度（俯角~31°，平衡视野开阔与不看到天空）
const CAMERA_BEHIND_VS = 14.4; // 双人模式后方距离
const CAMERA_ABOVE_VS = 9.5;  // 双人模式上方高度
const CAMERA_LOOK_Y = 2.5;     // lookAt 高度-单人模式（抬高视线，坦克下移到下1/3处）
const CAMERA_LOOK_Y_VS = 2.8;   // lookAt 高度-双人模式
const CAMERA_MOUSE_SENSITIVITY = 0.004; // 鼠标灵敏度 (rad/px)
let cameraYaw = 0; // 摄像机偏航角，由鼠标横轴累积驱动

// ── 装填环: 准星周围小圆点顺时针走满一圈 ──
function updateReloadRing(timer, total) {
    const ring = document.getElementById('reload-ring');
    if (!ring) return;
    if (timer <= 0 || total <= 0) { ring.style.display = 'none'; return; }
    ring.style.display = 'block';
    ring.style.left = mouseX + 'px';
    ring.style.top = mouseY + 'px';
    const ctx = ring.getContext('2d');
    const cx = 24, cy = 24, r = 18, dotR = 2.5;
    ctx.clearRect(0, 0, 48, 48);
    const progress = 1 - timer / total;
    const totalDots = 12;
    for (let i = 0; i < totalDots; i++) {
        // 12点方向开始, 顺时针
        const angle = -Math.PI / 2 + (i / totalDots) * Math.PI * 2;
        const x = cx + Math.cos(angle) * r;
        const y = cy + Math.sin(angle) * r;
        const dotProgress = i / totalDots;
        ctx.beginPath();
        ctx.arc(x, y, dotR, 0, Math.PI * 2);
        if (dotProgress < progress) {
            ctx.fillStyle = 'rgba(255,255,255,0.9)';
        } else {
            ctx.fillStyle = 'rgba(255,255,255,0.15)';
        }
        ctx.fill();
    }
}

function placeCamera() {
    if (window._godMode) return;
    // 摄像机方向由 cameraYaw 决定（鼠标横轴驱动，与车身/炮塔解耦）
    const cfx = Math.cos(cameraYaw);
    const cfz = Math.sin(cameraYaw);

    const groundY = getGroundHeight(tankGroup.position.x, tankGroup.position.z);
    let shakeX = 0, shakeY = 0, shakeZ = 0;
    if (combatShakeTimer > 0) {
        const shakeMag = combatShakeTimer * 0.5;
        shakeX = (Math.random() - 0.5) * shakeMag * 2;
        shakeY = (Math.random() - 0.5) * shakeMag * 2;
        shakeZ = (Math.random() - 0.5) * shakeMag * 2;
    }
    camera.position.set(
        tankGroup.position.x - cfx * CAMERA_BEHIND + shakeX,
        groundY + CAMERA_ABOVE + shakeY,
        tankGroup.position.z - cfz * CAMERA_BEHIND + shakeZ
    );
    camera.lookAt(
        tankGroup.position.x + cfx * 8,
        groundY + CAMERA_LOOK_Y,
        tankGroup.position.z + cfz * 8
    );
}

// 障碍物遮挡视线检测（降频+距离预过滤，每0.3s执行一次）
// ⚡ v0.24.9 优化：用透明材质池替代每帧 clone/dispose，消除 GPU 材质编译开销
// handleObstacleOcclusion → obstacles.js

// ==================== 菜单与状态切换 ====================
// ==================== 双人对战系统 ====================
let camera2 = null;

function getInputForPlayer(pNum) {
    let l=0,r=0;
    if (pNum===1) {
        const di = getDriveInput(false);
        return {left:di.left, right:di.right};
    } else {
        const gp=getGamepad();
        if (gp) {
            const fwd = stickToTarget(-gp.axes[1]);
            const str = stickToTarget(gp.axes[0]);
            l = fwd + str;
            r = fwd - str;
            l = Math.max(-1, Math.min(1, l));
            r = Math.max(-1, Math.min(1, r));
        }
    }
    return {left:l, right:r};
}

function updateAimingForVs(p, dt) {
    if (!p || p.dead || !p.turretPivot || !p.barrelPivot) return;

    // ── 车体转向即时补偿 ──
    const hullYaw = p.state.yaw;
    if (p._prevHullYaw !== undefined) {
        const hullDyaw = hullYaw - p._prevHullYaw;
        p.turretYaw += hullDyaw;
    }
    p._prevHullYaw = hullYaw;

    const maxDown = 25 * Math.PI / 180;
    const maxUp = -10 * Math.PI / 180;

    if (p === player2) {
        const gp = getGamepad();
        if (gp) {
            const gpxA = gp.axes[2] || 0;
            const gpxB = gp.axes[4] || 0;
            const gpx = Math.abs(gpxA) > Math.abs(gpxB) ? gpxA : gpxB;
            const gpyA = gp.axes[3] || 0;
            const gpyB = gp.axes[5] || 0;
            const gpy = Math.abs(gpyA) > Math.abs(gpyB) ? gpyA : gpyB;
            const turretSpeed = stickToTarget(-gpx) * turretAngVel;
            p.turretYaw += turretSpeed * dt;
            if (p.turretYaw > Math.PI) p.turretYaw -= Math.PI * 2;
            if (p.turretYaw < -Math.PI) p.turretYaw += Math.PI * 2;
            const barrelSpeed = stickToTarget(-gpy) * barrelAngVel;
            const newElev = p.barrelElevation + barrelSpeed * dt;
            p.barrelElevation = Math.max(maxUp, Math.min(maxDown, newElev));
        }
    } else if (groundMesh && gameMode === 'versus') {
        // 只在鼠标在1P区域时更新P1的瞄准
        const halfCssW = Math.floor(window.innerWidth / 2);
        const isMouseInP1Area = mouseX < halfCssW;
        if (!isMouseInP1Area) {
            p.barrelElevation = Math.max(maxUp, Math.min(maxDown, p.barrelElevation));
            return;
        }
        
        const barrelPos = getBarrelWorldPos(p);
        const cam = camera;
        // 使用1P分屏区域的尺寸计算NDC坐标
        const p1MouseX = mouseX;
        const p1MouseY = mouseY;
        const mouseNDC = new THREE.Vector2(
            (p1MouseX / halfCssW) * 2 - 1,
            -(p1MouseY / window.innerHeight) * 2 + 1
        );
        aimRaycaster.setFromCamera(mouseNDC, cam);
        const groundHits = aimRaycaster.intersectObject(groundMesh);
        const aimTgts = obstacleMeshes.slice(); for(let ei=0;ei<enemies.length;ei++){const en=enemies[ei];if(!en||!en.visible)continue;if(en.cfg&&en.cfg.type==='hexapod'){en.traverse(function(c){if(c.isMesh){const pn=(c.parent&&c.parent.name)||'';if(pn.indexOf('腿')<0&&pn.indexOf('脚踝')<0)aimTgts.push(c);}})}else{aimTgts.push(en);}}const obsHits=aimRaycaster.intersectObjects(aimTgts,true);

        let targetAim = null;
        let hitObsVs = false;
        if (groundHits.length > 0) targetAim = groundHits[0].point.clone();
        if (obsHits.length > 0 && (!targetAim || obsHits[0].distance < targetAim.distanceTo(cam.position))) {
            targetAim = obsHits[0].point.clone();
            hitObsVs = true;
        }

        if (targetAim) {
            if (!hitObsVs) targetAim.y = getGroundHeight(targetAim.x, targetAim.z);
            const diff = targetAim.clone().sub(barrelPos);
            const horizDist = Math.sqrt(diff.x * diff.x + diff.z * diff.z);
            const flightTime = horizDist / SHELL_SPEED;
            const gravityDrop = 0.5 * SHELL_GRAVITY * flightTime * flightTime;
            const worldTarget = new THREE.Vector3(targetAim.x, targetAim.y + gravityDrop, targetAim.z);
            const worldDir = worldTarget.clone().sub(barrelPos).normalize();

            const invQ = p.group.quaternion.clone().invert();
            const localDir = worldDir.clone().applyQuaternion(invQ);
            const targetYaw = Math.atan2(localDir.x, localDir.z);
            const targetElev = -Math.atan2(localDir.y, Math.sqrt(localDir.x * localDir.x + localDir.z * localDir.z));
            const clampedElev = Math.max(maxUp, Math.min(maxDown, targetElev));

            p.turretYaw = angleMoveToward(p.turretYaw, targetYaw, turretAngVel * dt);
            if (p.turretYaw > Math.PI) p.turretYaw -= Math.PI * 2;
            if (p.turretYaw < -Math.PI) p.turretYaw += Math.PI * 2;
            p.barrelElevation = angleMoveToward(p.barrelElevation, clampedElev, barrelAngVel * dt);
        }
    }

    p.barrelElevation = Math.max(maxUp, Math.min(maxDown, p.barrelElevation));
}

function updatePlayerPhysics(p, dt, tL, tR) {
    if (p.dead) return;
    const mt=moveToward;
    const af=(p.currentLeftSpeed+p.currentRightSpeed)/2;
    if(af<-0.3){const tt=tL;tL=tR;tR=tt;}
    p._prevTL = p._prevTL || 0; p._prevTR = p._prevTR || 0;
    if (tL!==0){const tg=tL*MAX_SPEED;const df=Math.sign(tL)!==Math.sign(p._prevTL)&&p._prevTL!==0;
        const sd=!df&&(Math.sign(tg)===Math.sign(p.currentLeftSpeed)||p.currentLeftSpeed===0);
        p.currentLeftSpeed=mt(p.currentLeftSpeed,tg,(sd?TRACK_ACCEL:TRACK_DECEL)*dt);}
    else p.currentLeftSpeed=mt(p.currentLeftSpeed,0,TRACK_COAST*dt);
    if (tR!==0){const tg=tR*MAX_SPEED;const df=Math.sign(tR)!==Math.sign(p._prevTR)&&p._prevTR!==0;
        const sd=!df&&(Math.sign(tg)===Math.sign(p.currentRightSpeed)||p.currentRightSpeed===0);
        p.currentRightSpeed=mt(p.currentRightSpeed,tg,(sd?TRACK_ACCEL:TRACK_DECEL)*dt);}
    else p.currentRightSpeed=mt(p.currentRightSpeed,0,TRACK_COAST*dt);
    if(tL!==0)p._prevTL=tL; if(tR!==0)p._prevTR=tR;
    const v=(p.currentLeftSpeed+p.currentRightSpeed)/2;
    const om=(p.currentLeftSpeed-p.currentRightSpeed)/TRACK_SPACING;
    p.state.yaw+=om*dt;
    const fx=Math.cos(p.state.yaw),fz=Math.sin(p.state.yaw);
    // 坡度速度限制（同单人模式）
    const sf=getGroundHeight(p.state.x+fx*1.0,p.state.z+fz*1.0);
    const sb=getGroundHeight(p.state.x-fx*1.0,p.state.z-fz*1.0);
    const sa=Math.atan2(sf-sb,2.0);
    const sv=Math.abs(sa)>MAX_SLOPE?MAX_SLOPE/Math.abs(sa):1.0;
    let nx=p.state.x+fx*v*sv*dt,nz=p.state.z+fz*v*sv*dt;
    for(let it=0;it<3;it++){const cr=checkCollision(nx,nz);if(cr.hit){nx+=cr.pushX;nz+=cr.pushZ;}else break;}
    if(gameMode==='versus'){const o=p===player1?player2:player1;
        if(o&&!o.dead){const tdx=nx-o.state.x,tdz=nz-o.state.z,td=Math.sqrt(tdx*tdx+tdz*tdz);
            if(td<TANK_HALF_W*2){const pu=(TANK_HALF_W*2-td)/Math.max(td,.001);nx+=tdx*pu*.5;nz+=tdz*pu*.5;}}}
    const wm=TANK_HALF_W;
    p.state.x=Math.max(-playHalfW+wm,Math.min(playHalfW-wm,nx));
    p.state.z=Math.max(-playHalfD+wm,Math.min(playHalfD-wm,nz));
    // 池塘/河流空气墙 + 桥梁护栏（仅单人地图）
    if(!isVersusMap){
        if(isInPond(p.state.x,p.state.z)){
            const pond=_getPond();
            if(pond){
                const ppx=p.state.x-pond.cx,ppz=p.state.z-pond.cz;
                const margin=TANK_HALF_W+0.3,erx=pond.rx+margin,erz=pond.rz+margin;
                const angle=Math.atan2(ppz/erz,ppx/erx);
                p.state.x=pond.cx+erx*Math.cos(angle);
                p.state.z=pond.cz+erz*Math.sin(angle);
            }
        }
        if(isInRiver(p.state.x,p.state.z)&&!isOnBridge(p.state.x)&&!_isUnderAnyBridge(p.state.x,p.state.z)){
            // 用 collider 圆心推离（对所有河流类型生效）
            let bestRc = null, bestDist = Infinity;
            for (const rc of riverColliders) {
                const d = Math.hypot(p.state.x - rc.x, p.state.z - rc.z);
                if (d < bestDist) { bestDist = d; bestRc = rc; }
            }
            if (bestRc && bestDist < bestRc.radius + TANK_HALF_W + 1) {
                const pushDist = bestRc.radius + TANK_HALF_W;
                const nx = (p.state.x - bestRc.x) / Math.max(bestDist, 0.01);
                const nz = (p.state.z - bestRc.z) / Math.max(bestDist, 0.01);
                p.state.x = bestRc.x + nx * pushDist;
                p.state.z = bestRc.z + nz * pushDist;
            }
        }
        if(!isVersusMap && isOnBridgeSurface(p.state.x,p.state.z)){
            const b=_getBridge();if(b){
                const railLimit=b.halfW-0.25;
                p.state.x=Math.max(-railLimit+TANK_HALF_W,Math.min(railLimit-TANK_HALF_W,p.state.x));
            }
        }
    }
    const acc=(v-p.prevForwardSpeed)/Math.max(dt,.001);
    const pt=Math.max(-PITCH_MAX,Math.min(PITCH_MAX,acc*PITCH_GAIN));
    p.pitch+=(pt-p.pitch)*Math.min(PITCH_SMOOTH*dt,1);
    // 后坐力衰减
    if(p.recoilPitch!==0){p.recoilPitch+=(0-p.recoilPitch)*Math.min(RECOIL_DECAY*dt,1);if(Math.abs(p.recoilPitch)<.0005)p.recoilPitch=0;}
    const recoilP=p.recoilPitch||0;
    // 地形坡度俯仰
    const sd=1.0;
    const fh=getGroundHeight(p.state.x+fx*sd,p.state.z+fz*sd);
    const bh=getGroundHeight(p.state.x-fx*sd,p.state.z-fz*sd);
    const tPitch=Math.atan2(fh-bh,sd*2);
    // 地形坡度侧倾
    const trxDir=Math.cos(p.state.yaw+Math.PI/2);
    const trzDir=Math.sin(p.state.yaw+Math.PI/2);
    const tsd=1.5;
    const tlh=getGroundHeight(p.state.x-trxDir*tsd,p.state.z-trzDir*tsd);
    const trh=getGroundHeight(p.state.x+trxDir*tsd,p.state.z+trzDir*tsd);
    const tRoll=Math.atan2(trh-tlh,tsd*2);
    p.prevForwardSpeed=v;
    const pgY=getGroundHeight(p.state.x,p.state.z);
    p.group.position.set(p.state.x,pgY,p.state.z);
    if (!p.group.rotation.order || p.group.rotation.order !== 'YXZ') p.group.rotation.order = 'YXZ';
    p.group.rotation.set(p.pitch + recoilP - tPitch, Math.PI/2-p.state.yaw, -tRoll);
    p.group.updateMatrixWorld();
    updateAimingForVs(p, dt);
    if (p.turretPivot) p.turretPivot.rotation.y = p.turretYaw;
    if (p.barrelPivot) {
        p.barrelPivot.rotation.x = p.barrelElevation;
    }
    const WR=.40;
    p.leftWheelAngle+=p.currentLeftSpeed*dt/WR;p.rightWheelAngle+=p.currentRightSpeed*dt/WR;
    p.leftWheels.forEach(w=>w.rotation.x=p.leftWheelAngle);
    p.rightWheels.forEach(w=>w.rotation.x=p.rightWheelAngle);
    if(p.reloadTimer>0){p.reloadTimer-=dt;if(p.reloadTimer<=0){p.reloadTimer=0;const gp2=getGamepad();if(gp2&&gp2.vibrationActuator)try{gp2.vibrationActuator.playEffect('dual-rumble',{duration:150,strongMagnitude:0.6,weakMagnitude:0.3})}catch(e){}}}
}

// togglePlayerBars / updateBarsForCamera → bars.js

function showVersusResult(winner) {
    versusResult.style.display='block';
    if(winner===player1){resultP1.textContent='🏆 你赢了！';resultP2.textContent='💀 你输了';resultP1.style.color='#44ff44';resultP2.style.color='#ff4444';}
    else{resultP1.textContent='💀 你输了';resultP2.textContent='🏆 你赢了！';resultP1.style.color='#ff4444';resultP2.style.color='#44ff44';}
    setTimeout(returnToMenu,3000);
}

// ==================== 指向箭头系统 ====================
const ARROW_SHOW_DIST = 25; // 超过此距离显示箭头
const ARROW_HIDE_DIST = 20; // 进入此距离隐藏箭头（滞后避免闪烁）

function projectToScreen(worldPos, cam, vpW, vpH) {
    const v = worldPos.clone().project(cam);
    return {
        x: (v.x * 0.5 + 0.5) * vpW,
        y: (-v.y * 0.5 + 0.5) * vpH,
        behind: v.z > 1
    };
}

function updateArrows(dpr, halfW, rightW, fbH) {
    if (!player1 || !player2 || player1.dead || player2.dead) {
        arrowP1.style.display = 'none';
        arrowP2.style.display = 'none';
        return;
    }
    const dx = player1.state.x - player2.state.x;
    const dz = player1.state.z - player2.state.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist > ARROW_SHOW_DIST) {
        const p1wp = new THREE.Vector3(player1.state.x, 0.4, player1.state.z);
        const p2wp = new THREE.Vector3(player2.state.x, 0.4, player2.state.z);

        // === P1 箭头（投影到左半屏） ===
        const p1s = projectToScreen(p1wp, camera, halfW, fbH);
        let p2s = projectToScreen(p2wp, camera, halfW, fbH);
        let dsx = p2s.x - p1s.x, dsy = p2s.y - p1s.y;
        if (p2s.behind) {
            // 目标在摄像机后方时投影坐标反转，需翻转方向并钳制位置
            dsx = -(p2s.x - p1s.x);
            dsy = -(p2s.y - p1s.y);
            // 把箭头位置钳制到屏幕边缘
            const cssW = halfW / dpr, cssH = fbH / dpr;
            const arrowCssX = THREE.MathUtils.clamp(p1s.x / dpr, 20, cssW - 20);
            const arrowCssY = THREE.MathUtils.clamp(p1s.y / dpr + 38, 60, cssH - 20);
            arrowP1.style.left = arrowCssX + 'px';
            arrowP1.style.top = arrowCssY + 'px';
        } else {
            arrowP1.style.left = (p1s.x / dpr) + 'px';
            arrowP1.style.top = (p1s.y / dpr + 38) + 'px';
        }
        const angle1 = Math.atan2(dsy, dsx);
        arrowP1.style.display = 'block';
        arrowP1.style.transform = `rotate(${angle1 * 180 / Math.PI - 90}deg)`;

        // === P2 箭头（投影到右半屏） ===
        let p1s2 = projectToScreen(p1wp, camera2, rightW, fbH);
        const p2s2 = projectToScreen(p2wp, camera2, rightW, fbH);
        let dsx2 = p1s2.x - p2s2.x, dsy2 = p1s2.y - p2s2.y;
        if (p1s2.behind) {
            dsx2 = -(p1s2.x - p2s2.x);
            dsy2 = -(p1s2.y - p2s2.y);
            const cssW = rightW / dpr, cssH = fbH / dpr;
            const arrowCssX = THREE.MathUtils.clamp((halfW + p2s2.x) / dpr, halfW/dpr + 20, halfW/dpr + cssW - 20);
            const arrowCssY = THREE.MathUtils.clamp(p2s2.y / dpr + 38, 60, cssH - 20);
            arrowP2.style.left = arrowCssX + 'px';
            arrowP2.style.top = arrowCssY + 'px';
        } else {
            arrowP2.style.left = ((halfW + p2s2.x) / dpr) + 'px';
            arrowP2.style.top = (p2s2.y / dpr + 38) + 'px';
        }
        const angle2 = Math.atan2(dsy2, dsx2);
        arrowP2.style.display = 'block';
        arrowP2.style.transform = `rotate(${angle2 * 180 / Math.PI - 90}deg)`;
    } else if (dist < ARROW_HIDE_DIST) {
        arrowP1.style.display = 'none';
        arrowP2.style.display = 'none';
    }
}

function enterVersusMode() {
    loadMapConfig('test_map_01b');
    gameMode='versus';isVersusMap=true;currentShellType='ap';
    menuOverlay.classList.add('hidden');gameContainer.classList.add('active');
    splitLine.style.display='block';versusResult.style.display='none';
    arrowP1.style.display='none';arrowP2.style.display='none';
    crosshairEl.style.display = 'block';
    crosshairEl.style.left = mouseX + 'px';
    crosshairEl.style.top = mouseY + 'px';
    document.body.style.cursor = 'none';
    hintBar.textContent='1P WASD+鼠标/左键  |  2P 手柄 左摇杆/右摇杆瞄准/RT  |  相距远时显示指向箭头';
    renderer.setSize(window.innerWidth, window.innerHeight);

    // 移除旧 player1（来自 initScene 或上次游戏的残留）
    if(player1&&player1.group)scene.remove(player1.group);
    if(player1&&player1.reloadBarGroup)scene.remove(player1.reloadBarGroup);
    if(player1&&player1.hpBarGroup)scene.remove(player1.hpBarGroup);
    if(player1&&player1.damageEffects){player1.damageEffects.hide();scene.remove(player1.damageEffects.firePoints);scene.remove(player1.damageEffects.smokePoints);}
    // 移除旧 player2（来自上次对战的残留）
    if(player2&&player2.group)scene.remove(player2.group);
    if(player2&&player2.reloadBarGroup)scene.remove(player2.reloadBarGroup);
    if(player2&&player2.hpBarGroup)scene.remove(player2.hpBarGroup);
    if(player2&&player2.damageEffects){player2.damageEffects.hide();scene.remove(player2.damageEffects.firePoints);scene.remove(player2.damageEffects.smokePoints);}
    shells.forEach(s=>{scene.remove(s.mesh);disposeShellMesh(s.mesh);if(s.tracerLight)scene.remove(s.tracerLight);if(s.glowTail){scene.remove(s.glowTail);s.glowTail.geometry.dispose();s.glowTail.material.dispose();}});shells=[];
    fragments.forEach(f=>{scene.remove(f.mesh);f.mesh.geometry.dispose();f.mesh.material.dispose();});fragments=[];
    muzzleLights.forEach(ml=>{scene.remove(ml.light);if(ml.light.geometry)ml.light.geometry.dispose();if(ml.light.material)ml.light.material.dispose();});muzzleLights=[];
    explosions.forEach(exp=>exp.dispose());explosions=[];
    scorchMarks.forEach(sc=>{scene.remove(sc.mesh);sc.mesh.geometry.dispose();sc.mesh.material.dispose();});scorchMarks=[];
    groundDebris.forEach(gd=>{scene.remove(gd.mesh);gd.mesh.geometry.dispose();gd.mesh.material.dispose();});groundDebris=[];
    // 重建大平原地图
    rebuildMap();
    player1=createPlayer('green',-15,0,Math.PI/2,true);player2=createPlayer('desert',15,0,-Math.PI/2,false);
    createPlayerTank(player1);createPlayerTank(player2);
    createBarsForPlayer(player1);createBarsForPlayer(player2);
    player1.reloadBarGroup.visible=player1.hpBarGroup.visible=true;
    player2.reloadBarGroup.visible=player2.hpBarGroup.visible=true;
    camera2=new THREE.PerspectiveCamera(48,renderer.domElement.width/renderer.domElement.height,.5,300);
    // 同步 P1 摄像机参数（与 P2 一致）
    camera.fov=48; camera.far=Math.max(300, Math.max(worldHalfW, worldHalfD) * 2.0); camera.updateProjectionMatrix();
    tankGroup=player1.group;
    leftWheels=player1.leftWheels;rightWheels=player1.rightWheels;
    reloadBarGroup=player1.reloadBarGroup;reloadBarFill=player1.reloadBarFill;reloadTimer=0;
    initAudio();startEngineSound();
    // 强制取消旧循环，启动双人对战循环
    if(animationId){cancelAnimationFrame(animationId);}
    clock.getDelta();animationId=requestAnimationFrame(versusGameLoop);
}

// ==================== PvE 战斗模式 ====================
async function enterCombatMode() {
    gameMode = 'combat'; isVersusMap = false;
    currentShellType = 'ap';
    updateLoadingProgress(8, '准备战斗场景...');
    await raf();

    // 确保场景已初始化（直接从菜单进入 combat 地图时需要）
    if (!isSceneInitialized) {
        initScene();
        isSceneInitialized = true;
    }

    menuOverlay.classList.add('hidden'); gameContainer.classList.add('active');
    splitLine.style.display = 'none'; arrowP1.style.display = 'none'; arrowP2.style.display = 'none';
    crosshairEl.style.display = 'block';
    crosshairEl.style.left = mouseX + 'px';
    crosshairEl.style.top = mouseY + 'px';
    document.body.style.cursor = 'none';
    hintBar.textContent = 'WASD 移动 | 鼠标瞄准 | 左键/RT 主炮 | ⚔️ PvE战斗模式';
    scene = scene1;
    // 移除 initScene 创建的旧 player1 坦克（避免出生点双车残留）
    if (player1 && player1.group && player1.group.parent) player1.group.parent.remove(player1.group);
    if (player1 && player1.reloadBarGroup && player1.reloadBarGroup.parent) player1.reloadBarGroup.parent.remove(player1.reloadBarGroup);
    if (player1 && player1.hpBarGroup && player1.hpBarGroup.parent) player1.hpBarGroup.parent.remove(player1.hpBarGroup);
    if (player1 && player1.damageEffects) {
        if (player1.damageEffects.firePoints && player1.damageEffects.firePoints.parent) player1.damageEffects.firePoints.parent.remove(player1.damageEffects.firePoints);
        if (player1.damageEffects.smokePoints && player1.damageEffects.smokePoints.parent) player1.damageEffects.smokePoints.parent.remove(player1.damageEffects.smokePoints);
    }
    if (player2 && player2.group && player2.group.parent) player2.group.parent.remove(player2.group);
    if (player2 && player2.reloadBarGroup && player2.reloadBarGroup.parent) player2.reloadBarGroup.parent.remove(player2.reloadBarGroup);
    if (player2 && player2.hpBarGroup && player2.hpBarGroup.parent) player2.hpBarGroup.parent.remove(player2.hpBarGroup);
    if (player2 && player2.damageEffects) {
        if (player2.damageEffects.firePoints && player2.damageEffects.firePoints.parent) player2.damageEffects.firePoints.parent.remove(player2.damageEffects.firePoints);
        if (player2.damageEffects.smokePoints && player2.damageEffects.smokePoints.parent) player2.damageEffects.smokePoints.parent.remove(player2.damageEffects.smokePoints);
    }
    shells.forEach(s => { scene.remove(s.mesh); disposeShellMesh(s.mesh); if (s.tracerLight) scene.remove(s.tracerLight); if (s.glowTail) { scene.remove(s.glowTail); s.glowTail.geometry.dispose(); s.glowTail.material.dispose(); } }); shells = [];
    fragments.forEach(f => { scene.remove(f.mesh); f.mesh.geometry.dispose(); f.mesh.material.dispose(); }); fragments = [];
    muzzleLights.forEach(ml => { scene.remove(ml.light); if (ml.light.geometry) ml.light.geometry.dispose(); if (ml.light.material) ml.light.material.dispose(); }); muzzleLights = [];
    ringFX.forEach(rf => { scene.remove(rf.mesh); rf.mesh.geometry.dispose(); rf.mesh.material.dispose(); }); ringFX = [];
    explosions.forEach(exp => exp.dispose()); explosions = [];
    scorchMarks.forEach(sc => { scene.remove(sc.mesh); sc.mesh.geometry.dispose(); sc.mesh.material.dispose(); }); scorchMarks = [];
    groundDebris.forEach(gd => { scene.remove(gd.mesh); gd.mesh.geometry.dispose(); gd.mesh.material.dispose(); }); groundDebris = [];
    cleanupEnemies();
    cleanupPickups();

    // 重建地图（复用异步版：清理→地形→草丛→水体→障碍物）
    await rebuildMapAsync();

    const enemyCount = (currentMapData && currentMapData.enemies) ? currentMapData.enemies.length : 0;
    await raf(); updateLoadingProgress(82, enemyCount > 0 ? `生成敌人 (${enemyCount}个)...` : '准备玩家...');

    // 玩家配置
    const pcfg = currentMapData.players || {};
    // 读取地图出生点（编辑器地图优先用 spawnPoints）
    const spCfg = currentMapData && currentMapData.spawnPoints && currentMapData.spawnPoints.p1;
    const spX = spCfg ? spCfg[0] : POINT_A_X;
    const spZ = spCfg ? spCfg[1] : POINT_A_Z;
    const spYaw = spCfg ? (spCfg[2] || Math.PI/2) : Math.PI/2;
    player1 = createPlayer('green', spX, spZ, spYaw, true);
    player1.hp = pcfg.hp || 100;
    player1.maxHp = player1.hp;
    player1.dead = false;
    player1.userData = player1.userData || {};
    player1.userData.maxHp = player1.hp;
    createPlayerTank(player1);
    createBarsForPlayer(player1);
    player1.reloadBarGroup.visible = true;
    player1.hpBarGroup.visible = true;
    if (player1.shellLabel) player1.shellLabel.visible = true;
    tankGroup = player1.group;
    leftWheels = player1.leftWheels; rightWheels = player1.rightWheels;
    reloadBarGroup = player1.reloadBarGroup; reloadBarFill = player1.reloadBarFill; reloadTimer = 0;
    tankState.x = spX; tankState.z = spZ; tankState.yaw = spYaw;
    totalDistance = 0;
    combatShakeTimer = 0;
    mgBullets.forEach(b => { scene.remove(b.mesh); b.mesh.traverse(c => { if (c !== b.mesh) { if (c.geometry) c.geometry.dispose(); if (c.material) c.material.dispose(); } }); b.mesh.geometry.dispose(); b.mesh.material.dispose(); });
    hexapodBullets.forEach(hb => { scene.remove(hb.mesh); hb.mesh.geometry.dispose(); hb.mesh.material.dispose(); }); hexapodBullets = [];
    hexapodMissiles.forEach(hm => { scene.remove(hm.mesh); hm.mesh.traverse(c => { if (c.geometry) c.geometry.dispose(); if (c.material) c.material.dispose(); }); }); hexapodMissiles = [];
    hexapodExplosions.forEach(he => { scene.remove(he.mesh); he.mesh.geometry.dispose(); he.mesh.material.dispose(); }); hexapodExplosions = [];
    hexapodExplosions.forEach(he => { scene.remove(he.mesh); he.mesh.geometry.dispose(); he.mesh.material.dispose(); }); hexapodExplosions = [];
    mgBullets = []; mgTimer = 0; mgHeat = 0; mgOverheated = false;
    if (player1) player1.mgLockTarget = null;
    combatData = {
        score: 0,
        lives: pcfg.lives || 3,
        phase: 'combat',
        playerCannonDamage: pcfg.cannonDamage || 40,
        kills: 0,
        damageDealt: 0,
        startTime: Date.now(),
        deaths: [],
    };

    // 创建敌人（04a地图30只丧尸是最重的步骤）
    if (enemyCount > 0) {
        const stepPerEnemy = Math.min(8, 13 / enemyCount); // 82%→95%
        for (let i = 0; i < enemyCount; i++) {
            if (i % Math.max(1, Math.floor(enemyCount / 6)) === 0) {
                updateLoadingProgress(82 + i * stepPerEnemy, `生成敌人 ${i+1}/${enemyCount}...`);
                await raf();
            }
        }
    }
    createEnemies();

    await raf(); updateLoadingProgress(96, '初始化...');
    visibilityTimer = 0;
    updateObstacleVisibility();
    handleObstacleOcclusion();
    placeCamera();
    initAudio(); startEngineSound();
    if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume().then(() => console.log('🔊 AudioContext 已恢复运行'))
            .catch(e => console.warn('⚠️ AudioContext 恢复失败:', e));
    }
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    renderer.setScissorTest(false);
    const cssW = window.innerWidth, cssH = window.innerHeight;
    renderer.setViewport(0, 0, cssW, cssH);
    camera.aspect = cssW / cssH;
    camera.updateProjectionMatrix();

    updateLoadingProgress(100, '完成！');
    await raf();
    hideLoading();
    renderer.render(scene, camera);
    updateDebugInfo();
    if (animationId) { cancelAnimationFrame(animationId); }
    clock.getDelta(); animationId = requestAnimationFrame(gameLoop);
    console.log('⚔️ PvE战斗模式已启动 | 地图:' + (currentMapData && currentMapData.name || '?') + ' | 敌人:' + enemies.length + '只');
}

function createEnemies() {
    if (!currentMapData || !currentMapData.enemies) return;
    const totalCfg = currentMapData.enemies.length;
    const withPatrol = currentMapData.enemies.filter(e => e.patrolPath && e.patrolPath.length > 0).length;
    console.log('🗺️ 地图敌人: 总数='+totalCfg+' 有巡逻='+withPatrol+' | IDs:', currentMapData.enemies.map(e => e.id).join(','));
    for (const ecfg of currentMapData.enemies) {
        let model;
        if (ecfg.type === 'assault-vehicle') {
            if (!window.EnemyModels || !window.EnemyModels.createAssaultVehicle) {
                console.warn('createEnemies: EnemyModels.createAssaultVehicle 不可用');
                continue;
            }
            model = window.EnemyModels.createAssaultVehicle();
        } else if (ecfg.type === 'zombie') {
            model = window.EnemyModels.createZombie();
        } else if (ecfg.type === 'hexapod') {
            model = window.EnemyModels.createHexapod();
        } else {
            console.warn('createEnemies: 未知敌人类型 ' + ecfg.type);
            continue;
        }
        const pos = ecfg.position;
        const gy = getGroundHeight(pos[0], pos[2]);
        model.position.set(pos[0], gy, pos[2]);
        model.cfg = ecfg;
        // 初始朝向：丧尸随机（避免整齐划一），车辆朝第一个巡逻点
        if (ecfg.type === 'zombie' || ecfg.type === 'hexapod') {
            model.rotation.set(0, Math.random() * Math.PI * 2, 0);
        } else if (ecfg.patrolPath && ecfg.patrolPath.length > 0) {
            const wp0 = ecfg.patrolPath[0];
            const wpDx = wp0[0] - pos[0];
            const wpDz = wp0[1] - pos[2];
            const wpDist = Math.sqrt(wpDx * wpDx + wpDz * wpDz);
            if (wpDist > 0.5) {
                model.rotation.set(0, Math.atan2(wpDz, -wpDx), 0);
            } else {
                model.rotation.set(0, 0, 0);
            }
        } else {
            model.rotation.set(0, 0, 0);
        }
        model.hp = ecfg.hp || 60;
        model.userData = model.userData || {};
        model.userData.maxHp = model.hp;
        model.userData.enemyType = ecfg.type;
        model.userData.enemyId = ecfg.id;
        // 丧尸不需要地形俯仰（人形单位应保持直立）；六足由hexapod_anim自己管理
        if (ecfg.type === 'zombie' || ecfg.type === 'hexapod') {
            model.userData._noTerrainPitch = true;
        }
        // AI 运行时数据
        const isZombieAI = (ecfg.type === 'zombie');
        const isHexapodAI = (ecfg.type === 'hexapod');
        model.ai = {
            state: isZombieAI ? 'idle' : 'patrol',  // 丧尸从 IDLE 起步
            target: null,
            patrolIndex: 0,
            lastSeenPlayerPos: null,
            alertTimer: 0,
            flameTimer: 0,
            flameRequest: false,
            flameTicksLeft: 0,
            isFlaming: false,
            flameTickTimer: 0,
            flameStartTime: 0,
            strafeTimer: 0,
            strafeDir: 1,
            wpStuckTimer: 0,  // v0.26.5: 巡逻卡住计时器
            hitFlash: 0,
            // 丧尸专用字段
            animRequest: isZombieAI ? 'idle' : 'walk',
            animAtkStart: 0,
            animHitApplied: false,
            atkReady: true,
            atkCooldown: 0,
            lastHitTime: 0,
            prevState: 'idle',
            deathAnimStarted: false,
            idleTimer: 0,
            lostTargetTimer: 0,
            searchTimer: 0,
        };
        if (isHexapodAI) { model.ai._missileAmmoL = 4; model.ai._missileAmmoR = 4; }
        // 绑定丧尸动画系统
        if ((ecfg.type === 'zombie' || ecfg.type === 'hexapod') && model.userData._animSystem) {
            model.userData.animSystem = model.userData._animSystem;
        }
        // 六足敌人：初始化 CCD IK 动画状态
        if (isHexapodAI && window.HexapodEnemy) {
            HexapodEnemy.init(model);
        }
        // 初始化炮塔朝前（仅突击车辆）
        if (ecfg.type !== 'zombie' && ecfg.type !== 'hexapod' && model.userData.turretPivot) {
            model.userData.turretPivot.rotation.y = 0;
        }
        // 添加受击闪光白膜（半透明叠加层）
        createEnemyHitFlashOverlay(model);
        // 添加HP条
        createEnemyHpBar(model);
        // 火焰喷射视觉（仅车辆）
        if (ecfg.type !== 'zombie' && ecfg.type !== 'hexapod') {
            createEnemyFlameVFX(model);
        }
        scene.add(model);
        enemies.push(model);
        console.log('👾 敌人已部署: ' + ecfg.id + ' (' + ecfg.type + ') at [' + pos[0].toFixed(1) + ',' + gy.toFixed(1) + ',' + pos[2].toFixed(1) + ']');
    }
    // 分散巡逻起点：多个敌人共享同一路线时随机偏移起始路径点索引，避免扎堆堵塞
    if (enemies.length >= 2 && currentMapData.enemies[0].patrolPath) {
        const pathLen = currentMapData.enemies[0].patrolPath.length;
        if (pathLen >= 4) {
            enemies.forEach((enemy, i) => {
                if (enemy.ai && enemy.ai.state === 'patrol') {
                    enemy.ai.patrolIndex = (i * Math.ceil(pathLen / enemies.length)) % pathLen;
                }
            });
            console.log('🔄 分散巡逻起点: ' + enemies.length + '辆车 | 路线长度=' + pathLen + ' | 分布在路径上');
        }
    }
}


// ─── 六足加特林枪管簇初始化 ───
function _initHexBarrelClusters(enemy) {
  var clusters = [];
  ['左加特林_pivot','右加特林_pivot'].forEach(function(pivotName) {
    var pivot = enemy.getObjectByName(pivotName);
    if (!pivot) return;
    // 收集pivot下名字含"枪管"的子Group
    var barrelGroups = [];
    for (var ci = pivot.children.length - 1; ci >= 0; ci--) {
      var c = pivot.children[ci];
      if (c.name && c.name.indexOf('枪管') >= 0) barrelGroups.push(c);
    }
    if (barrelGroups.length === 0) return;
    // 创建簇Group挂在pivot下
    var cluster = new THREE.Group();
    cluster.name = pivotName.replace('_pivot','_barrelCluster');
    pivot.add(cluster);
    // 枪管移入簇 (簇在pivot原点, add()保持世界变换)
    for (var bi = 0; bi < barrelGroups.length; bi++) {
      cluster.add(barrelGroups[bi]);
    }
    clusters.push(cluster);
  });
  enemy.userData._barrelClusters = clusters;
}

// ─── 六足战车加特林子弹 ───
function spawnHexapodGatlingBullet(enemy, player1, ai) {
    const spread = (ai.gatlingSpread || 0) * 0.06;
    const gx = ai.gatlingSpread * (Math.random() - 0.5) * 0.15;
    const gy = ai.gatlingSpread * (Math.random() - 0.5) * 0.15;
    // 交替左右武器, 从武器pivot计算世界坐标枪口位置
    const wpL = enemy.getObjectByName('左加特林_pivot');
    const wpR = enemy.getObjectByName('右加特林_pivot');
    const wp = (ai._lastGatlingSide === 'L') ? wpR : wpL;
    ai._lastGatlingSide = (ai._lastGatlingSide === 'L') ? 'R' : 'L';
    if (!wp) return;
    // 枪口世界位置 = pivot世界位置 + pivot朝向 * 枪管长度
    const pivWorld = new THREE.Vector3();
    wp.getWorldPosition(pivWorld);
    const pivFwd = new THREE.Vector3(-1, 0, 0); // pivot局部-X = 枪口方向
    wp.localToWorld(pivFwd);
    const dirFwd = pivFwd.sub(pivWorld).normalize();
    const muzzlePos = pivWorld.clone().addScaledVector(dirFwd, 0.75);
    const dir = new THREE.Vector3().subVectors(player1.group.position, muzzlePos).normalize();
    dir.x += gx; dir.y += gy; dir.z += (Math.random() - 0.5) * spread;
    dir.normalize();
    const tracerGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.5, 4);
    const tracerMat = new THREE.MeshBasicMaterial({ color: 0xFFDD44 });
    const tracer = new THREE.Mesh(tracerGeo, tracerMat);
    tracer.position.copy(muzzlePos);
    // 圆柱体默认沿Y轴, setFromUnitVectors使Y轴对齐飞行方向(dir)
    var _tq = new THREE.Quaternion();
    _tq.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    tracer.setRotationFromQuaternion(_tq);
    scene.add(tracer);
    // ── 枪口焰 ──
    var flash = new THREE.PointLight('#ffcc44', 8, 4, 2);
    flash.position.copy(muzzlePos); scene.add(flash);
    muzzleLights.push({ light: flash, life: 0.08 });
    const speed = 80;
    const maxDist = 25;
    const startPos = muzzlePos.clone();
    const bulletData = { mesh: tracer, pos: muzzlePos.clone(), dir: dir, speed: speed, dist: 0, maxDist: maxDist,
        startPos: startPos, damage: ai.gatlingDamage || 3, enemy: enemy };
    hexapodBullets = hexapodBullets || [];
    hexapodBullets.push(bulletData);
    // 加特林开火音效
    if (typeof playMGShotSound === 'function') playMGShotSound();
}

// ─── 六足战车导弹发射 (追踪型: 先沿纵轴上仰→有限转向率追踪玩家) ───
function spawnHexapodMissile(enemy, player1, ai) {
    var wpL = enemy.getObjectByName('左导弹巢_pivot');
    var wpR = enemy.getObjectByName('右导弹巢_pivot');
    var wp = (ai._lastMissileSide === 'L') ? wpR : wpL;
    ai._lastMissileSide = (ai._lastMissileSide === 'L') ? 'R' : 'L';
    if (!wp) return;
    // 发射位置 + 初始方向 (沿导弹巢纵轴 -X, 加30°上仰)
    var pivWorld = new THREE.Vector3();
    wp.getWorldPosition(pivWorld);
    var pivFwd = new THREE.Vector3(-1, 0.6, 0); // -X方向 + 上仰分量
    wp.localToWorld(pivFwd);
    var launchDir = pivFwd.clone().sub(pivWorld).normalize();
    var muzzlePos = pivWorld.clone().addScaledVector(launchDir, 0.5);
    // 导弹模型: 弹体+弹头+尾焰
    var missileGrp = new THREE.Group();
    var bodyGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.4, 6);
    var bodyMat = new THREE.MeshStandardMaterial({ color: '#889999', roughness: 0.3, metalness: 0.7, emissive: '#111111' });
    var body = new THREE.Mesh(bodyGeo, bodyMat);
    body.rotation.x = Math.PI / 2;
    missileGrp.add(body);
    var tipGeo = new THREE.ConeGeometry(0.06, 0.12, 6);
    var tip = new THREE.Mesh(tipGeo, bodyMat);
    tip.rotation.x = -Math.PI / 2; tip.position.z = 0.26;
    missileGrp.add(tip);
    var flameGeo = new THREE.CylinderGeometry(0.04, 0.07, 0.3, 6);
    var flameMat = new THREE.MeshBasicMaterial({ color: '#ff6600' });
    var flame = new THREE.Mesh(flameGeo, flameMat);
    flame.rotation.x = Math.PI / 2; flame.position.z = -0.35;
    missileGrp.add(flame);
    var flameLight = new THREE.PointLight('#ff4400', 3, 2, 2);
    flameLight.position.z = -0.4;
    missileGrp.add(flameLight);
    // 初始朝向=发射方向
    var mq0 = new THREE.Quaternion();
    mq0.setFromUnitVectors(new THREE.Vector3(0, 0, 1), launchDir);
    missileGrp.setRotationFromQuaternion(mq0);
    missileGrp.position.copy(muzzlePos);
    scene.add(missileGrp);
    var missileData = {
        mesh: missileGrp,
        pos: muzzlePos.clone(),
        dir: launchDir.clone(),
        speed: 20,
        damage: 25,
        blastRadius: 1.5,
        age: 0,
        tracking: false,    // boost阶段=false, 0.25s后开始追踪
        maxTurnRate: 1.2,   // 最大转向率 rad/s
        enemy: enemy
    };
    hexapodMissiles = hexapodMissiles || [];
    hexapodMissiles.push(missileData);
    // 导弹发射音效 (嗖——)
    if (typeof playMissileLaunchSound === 'function') playMissileLaunchSound();
}

// ─── 训练场坦克敌人炮击（完整视效+音效）───
function fireEnemyTrainingShell(enemy) {
    if (!player1 || player1.dead) return;
    var barrelPivot = enemy.userData && enemy.userData.barrelPivot;
    // 炮口位置+方向: 从炮管实际朝向发射
    var muzzlePos, barrelDir;
    if (barrelPivot) {
        muzzlePos = new THREE.Vector3(0, 0, 1.8);
        barrelPivot.localToWorld(muzzlePos);
        barrelDir = new THREE.Vector3(0, 0, 1);
        barrelPivot.getWorldQuaternion(_tmpQuat);
        barrelDir.applyQuaternion(_tmpQuat);
    } else {
        muzzlePos = enemy.position.clone(); muzzlePos.y += 1.5;
        barrelDir = new THREE.Vector3().subVectors(player1.group.position, muzzlePos).normalize();
    }
    // 微小散布 ±2°
    var spread = 0.035;
    barrelDir.x += (Math.random() - 0.5) * spread;
    barrelDir.z += (Math.random() - 0.5) * spread;
    barrelDir.normalize();
    // 重力补偿
    var dist = muzzlePos.distanceTo(player1.group.position);
    var flightTime = dist / SHELL_SPEED;
    var aimDir = barrelDir.clone();
    aimDir.y += 0.5 * SHELL_GRAVITY * flightTime / SHELL_SPEED;
    aimDir.normalize();
    // 炮口闪光
    var flash = new THREE.PointLight('#ffcc44', 10, 6, 2);
    flash.position.copy(muzzlePos); scene.add(flash);
    muzzleLights.push({ light: flash, life: 0.12 });
    // 炮弹模型
    var shellGroup = new THREE.Group();
    var body = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.18, 8),
        new THREE.MeshStandardMaterial({ color: '#ffcc00', roughness: 0.05, metalness: 0.3, emissive: '#ff9900', emissiveIntensity: 2.5 }));
    body.rotation.x = Math.PI/2; body.castShadow = true;
    shellGroup.add(body);
    var tip = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.08, 8),
        new THREE.MeshStandardMaterial({ color: '#ffcc00', roughness: 0.05, metalness: 0.3, emissive: '#ff9900', emissiveIntensity: 2.5 }));
    tip.rotation.x = Math.PI/2; tip.position.z = 0.13; tip.castShadow = true;
    shellGroup.add(tip);
    shellGroup.position.copy(muzzlePos);
    scene.add(shellGroup);
    var glowTail = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8),
        new THREE.MeshBasicMaterial({ color: '#ff8800', transparent: true, opacity: 0.55, depthWrite: false }));
    glowTail.position.copy(muzzlePos); glowTail.renderOrder = 999;
    scene.add(glowTail);
    var tracerLight = new THREE.PointLight('#ff8800', 3, 5, 2);
    tracerLight.position.copy(muzzlePos); scene.add(tracerLight);
    shells.push({
        mesh: shellGroup, vel: aimDir.clone().multiplyScalar(SHELL_SPEED), type: 'ap',
        tracerLight: tracerLight, glowTail: glowTail,
        owner: enemy, prevPos: null, isEnemyShell: true
    });
    playFireSound();
}

// ─── 训练场敌人MG曳光弹 ──
function _spawnEnemyMGTracer(enemy) {
    if (!player1 || player1.dead) return;
    var mgGroup = enemy.userData && enemy.userData.mgGroup;
    var muzzlePos;
    if (mgGroup) {
        muzzlePos = new THREE.Vector3(0, 0.32, 0.55); // MG枪口相对MG组
        mgGroup.localToWorld(muzzlePos);
    } else {
        muzzlePos = enemy.position.clone(); muzzlePos.y += 2.2;
    }
    var toPlayer = new THREE.Vector3().subVectors(player1.group.position, muzzlePos).normalize();
    // 轻微散布
    toPlayer.x += (Math.random() - 0.5) * 0.06;
    toPlayer.z += (Math.random() - 0.5) * 0.06;
    toPlayer.normalize();
    var tracerGeo = new THREE.CylinderGeometry(0.01, 0.01, 0.2, 4);
    var tracerMat = new THREE.MeshBasicMaterial({ color: 0xFFDD44 });
    var tracer = new THREE.Mesh(tracerGeo, tracerMat);
    tracer.position.copy(muzzlePos);
    tracer.rotation.z = Math.PI / 2;
    tracer.lookAt(muzzlePos.clone().add(toPlayer));
    scene.add(tracer);
    var startPos = muzzlePos.clone();
    var bulletData = { mesh: tracer, pos: startPos.clone(), dir: toPlayer, speed: MG_BULLET_SPEED, dist: 0, maxDist: MG_RANGE,
        startPos: startPos, damage: MG_DAMAGE, enemy: enemy, isEnemyMG: true };
    hexapodBullets = hexapodBullets || [];
    hexapodBullets.push(bulletData);
}

// ─── 训练场玩家死亡（重生队列）───
function _killPlayerInTraining() {
    player1.dead = true;
    var pep = player1.group.position.clone(); pep.y += 0.5;
    spawnFragments(pep, '#4a5c2e');
    playExplosionSound();
    spawnExplosion(pep);
    player1.group.visible = false;
    togglePlayerBars(player1, false);
    hintBar.textContent = '💀 1秒后重生...';
    trainingRespawnQueued = { player: true, delay: 1.0 };
}

// ─── 训练场敌人死亡（重生队列）───
function _killEnemyInTraining(enemy) {
    enemy.dead = true;
    enemy.ai.state = 'dead';
    var ep = enemy.position.clone(); ep.y += 0.5;
    spawnFragments(ep, '#666');
    playExplosionSound();
    // 六足不立即隐藏, 保留尸体姿态1秒再重生
    var isHex = (enemy.cfg && enemy.cfg.type === 'hexapod');
    if (!isHex) enemy.visible = false;
    if (enemy.userData && enemy.userData.hpBarGroup) enemy.userData.hpBarGroup.visible = false;
    if (!trainingRespawnQueued) {
        trainingRespawnQueued = { player: false, delay: 1.0 };
    }
}
window._killEnemyInTraining = _killEnemyInTraining; // mg.js需要

// ─── 训练场重生执行 ──
function _processTrainingRespawn(dt) {
    if (!isTrainingMode) return;
    // 自动检测训练场敌人死亡(兜底, 覆盖所有死亡路径)
    // 六足: 死亡动画由 HexapodEnemy 管理, 不在此自动隐藏
    if (!trainingRespawnQueued) {
        for (var ei = 0; ei < enemies.length; ei++) {
            var en = enemies[ei];
            var isHexAuto = (en.cfg && en.cfg.type === 'hexapod');
            if (en.dead || (en.hp <= 0 && !isHexAuto) || (!en.visible && !isHexAuto)) {
                if (!en.dead) { en.dead = true; en.visible = false; en.ai.state = 'dead'; if (en.userData && en.userData.hpBarGroup) en.userData.hpBarGroup.visible = false; }
                trainingRespawnQueued = { player: false, delay: 1.0 };
                break;
            }
        }
    }
    if (!trainingRespawnQueued) return;
    trainingRespawnQueued.delay -= dt;
    if (trainingRespawnQueued.delay > 0) return;
    var q = trainingRespawnQueued;
    trainingRespawnQueued = null;
    if (q.player) {
        // 重生玩家
        var gy = getGroundHeight(trainingPlayerSpawn.x, trainingPlayerSpawn.z);
        player1.group.position.set(trainingPlayerSpawn.x, gy, trainingPlayerSpawn.z);
        player1.group.visible = true;
        player1.hp = 100; player1.dead = false;
        player1.state.x = trainingPlayerSpawn.x; player1.state.z = trainingPlayerSpawn.z;
        player1.state.yaw = Math.PI;
        player1.currentLeftSpeed = 0; player1.currentRightSpeed = 0;
        player1.reloadTimer = 0;
        player1.group.rotation.set(0, 0, 0); // 游戏循环自动修正
        player1.currentLeftSpeed = 0; player1.currentRightSpeed = 0;
        player1.reloadTimer = 0;
        if (player1.damageEffects && player1.damageEffects.active) player1.damageEffects.hide();
        togglePlayerBars(player1, true);
        hintBar.textContent = 'WASD 移动 | 鼠标瞄准 | 左键 主炮 | ESC 退出训练';
    } else {
        // 重生敌人
        for (var ei = enemies.length - 1; ei >= 0; ei--) {
            var en = enemies[ei];
            if (en.dead) {
                var isHex = (en.cfg && en.cfg.type === 'hexapod');
                var egy = getGroundHeight(trainingEnemySpawn.x, trainingEnemySpawn.z);
                en.position.set(trainingEnemySpawn.x, egy, trainingEnemySpawn.z); // 六足由HexapodEnemy.init()自动抬升
                en.rotation.set(0, 0, 0);
                en.visible = true;
                en.hp = en.userData.maxHp || 60;
                en.dead = false;
                en.ai.state = 'patrol';
                en.ai.target = null;
                en.ai.alertTimer = 0;
                en.ai._tankFireTimer = 0;
                // 重置六足AI字段
                if (isHex) {
                    en.ai.spinUp = 0; en.ai.heat = 0; en.ai.bodyYaw = 0; en.ai.strafeTimer = 0; en.ai.gatlingSpread = 0; en.ai._missileAmmoL = 4; en.ai._missileAmmoR = 4; en.ai._overheated = false;
                    en.ai.animRequest = 'idle';
                    en.ai.deathAnimStarted = false;
                    en.ai.deathAnimDone = false;
                    // 重新初始化 CCD IK 动画状态
                    if (window.HexapodEnemy && en.userData._hexAnimState) {
                        HexapodEnemy.init(en);
                    }
                }
                // 丧尸重生: 需要重置AnimationSystem避免保持死亡卧倒姿势
                var isZomb = (en.cfg && en.cfg.type === 'zombie');
                if (isZomb && en.userData._animSystem) { en.userData._animSystem.play('Idle', true); }
                if (en.userData && en.userData.hpBarGroup) en.userData.hpBarGroup.visible = true;
                break;
            }
        }
    }
}

function createEnemyHpBar(enemy) {
    const barW = 1.5, barH = 0.08, barD = 0.02;
    const bgGeo = new THREE.BoxGeometry(barW, barH, barD);
    const bgMat = new THREE.MeshBasicMaterial({ color: 0x333333, depthTest: false });
    const bg = new THREE.Mesh(bgGeo, bgMat);
    const fillGeo = new THREE.BoxGeometry(barW, barH, barD);
    const fillMat = new THREE.MeshBasicMaterial({ color: 0xff3333, depthTest: false });
    const fill = new THREE.Mesh(fillGeo, fillMat);
    fill.position.z = 0.015;
    const group = new THREE.Group();
    group.add(bg); group.add(fill);
    group.position.y = (enemy.cfg && enemy.cfg.type === 'zombie') ? 2.0 : (enemy.cfg && enemy.cfg.type === 'hexapod') ? 2.8 : 1.8;
    group.renderOrder = 999;
    group.materialDepthTest = false;
    enemy.add(group);
    enemy.userData.hpBarGroup = group;
    enemy.userData.hpBarFill = fill;
}

function createEnemyHitFlashOverlay(enemy) {
    // v0.26.1fix: 球形受击光晕替代立方体盒子，更自然
    const ovGeo = new THREE.SphereGeometry(1.05, 16, 10);
    const ovMat = new THREE.MeshBasicMaterial({
        color: 0xffffff, transparent: true, opacity: 0,
        depthTest: true, depthWrite: false
    });
    const overlay = new THREE.Mesh(ovGeo, ovMat);
    overlay.position.y = 0.68;
    overlay.renderOrder = 996;
    overlay.visible = false;
    enemy.add(overlay);
    enemy.userData.hitFlashOverlay = overlay;
}

function createPlayerHitFlashOverlay(tankGroup) {
    if (!tankGroup || tankGroup.userData.hitFlashOverlay) return;
    const ovGeo = new THREE.SphereGeometry(0.95, 16, 10);
    const ovMat = new THREE.MeshBasicMaterial({
        color: 0xff2222, transparent: true, opacity: 0,
        depthTest: true, depthWrite: false
    });
    const overlay = new THREE.Mesh(ovGeo, ovMat);
    overlay.position.y = 0.6;
    overlay.renderOrder = 996;
    overlay.visible = false;
    tankGroup.add(overlay);
    tankGroup.userData.hitFlashOverlay = overlay;
}

// v0.26.5: 战利品掉落系统
function spawnPickup(enemy) {
    const cfg = enemy.cfg || {};
    const dropRate = cfg.dropRate !== undefined ? cfg.dropRate : 0.25;
    if (Math.random() > dropRate) return;
    if (!window.ModelRegistry || !window.ModelRegistry.getModel) return;
    const fn = window.ModelRegistry.getModel('pickups', '医疗工具箱');
    if (!fn) return;
    const pickup = fn();
    pickup.position.copy(enemy.position);
    pickup.position.y = getGroundHeight(enemy.position.x, enemy.position.z) + 0.25;
    pickup.userData = pickup.userData || {};
    pickup.userData.healAmount = cfg.dropHeal || 30;
    pickup.userData._spawnTime = performance.now();
    scene.add(pickup);
    pickups.push(pickup);
    console.log('💊 医疗箱已掉落 @ [' + pickup.position.x.toFixed(1) + ',' + pickup.position.y.toFixed(1) + ',' + pickup.position.z.toFixed(1) + ']');
}

function updatePickups(dt) {
    if (!player1 || player1.dead) return;
    if (pickups.length === 0) return;
    const pPos = player1.group.position;
    for (let i = pickups.length - 1; i >= 0; i--) {
        const pu = pickups[i];
        if (!pu || !pu.parent) { pickups.splice(i, 1); continue; }
        // 悬停旋转+微浮（转速约180°/s，明显可见）
        const age = (performance.now() - (pu.userData._spawnTime || 0)) / 1000;
        pu.rotation.y += dt * 3.0;
        pu.position.y += Math.sin(age * 3.0) * dt * 0.25;
        // 距离检测拾取（满血时不拾取，直接穿越）
        const dist = pPos.distanceTo(pu.position);
        if (dist < PICKUP_RADIUS) {
            if (player1.hp >= player1.maxHp) continue; // 满血穿越
            const heal = pu.userData.healAmount || 30;
            player1.hp = Math.min(player1.maxHp, player1.hp + heal);
            spawnHitSparks(pu.position.clone());
            playPickupSound();
            hintBar.textContent = '💊 拾取医疗箱 +' + heal + ' HP! (HP:' + player1.hp + '/' + player1.maxHp + ')';
            scene.remove(pu);
            pu.traverse(c => { if (c.geometry) c.geometry.dispose(); if (c.material) c.material.dispose(); });
            pickups.splice(i, 1);
        }
    }
}

function cleanupPickups() {
    for (const pu of pickups) {
        if (pu.parent) pu.parent.remove(pu);
        pu.traverse(c => { if (c.geometry) c.geometry.dispose(); if (c.material) c.material.dispose(); });
    }
    pickups = [];
}

function createEnemyFlameVFX(enemy) {
    // 火焰喷射器粒子效果（基于 DamageEffects 的粒子系统方案）
    const flameEffect = new window.FlameThrowerEffect();
    scene.add(flameEffect.points);
    enemy.userData.flameEffect = flameEffect;
}

function updateEnemyFlameVFX(enemy, player, dt) {
    const fe = enemy.userData.flameEffect;
    if (!fe) return;
    const isFlaming = enemy.ai && enemy.ai.isFlaming;
    const pp = player && !player.dead ? player.group.position : null;

    if (pp && isFlaming) {
        const tp = enemy.userData.turretPivot;
        const nozzleLocal = new THREE.Vector3(-1.05, 1.27, 0);
        if (tp) {
            const nozzleWorld = tp.localToWorld(nozzleLocal.clone());
            // 火焰沿炮塔指向射出（世界空间）
            const turretDir = new THREE.Vector3(-1, 0, 0)
                .applyQuaternion(tp.getWorldQuaternion(new THREE.Quaternion())).normalize();
            // v0.26.2fix: 方向安全校验收紧至60°锥内 (>0.5)，与伤害代码一致
            const enToPlayer = new THREE.Vector3().subVectors(pp, nozzleWorld).normalize();
            const dotCheck = turretDir.dot(enToPlayer);
            if (dotCheck > 0.5) {
                fe.update(dt, nozzleWorld, turretDir, true, enemy.cfg.flameRange || 12);
            } else {
                fe.update(dt, new THREE.Vector3(), new THREE.Vector3(), false, 12);
            }
        } else {
            const nw = enemy.position.clone();
            const td = new THREE.Vector3().subVectors(pp, nw).normalize();
            fe.update(dt, nw, td, true, enemy.cfg.flameRange || 12);
        }
    } else {
        fe.update(dt, new THREE.Vector3(), new THREE.Vector3(), false, 12);
    }
}

// ==================== PvE 近防机枪系统 → mg.js ====================

function cleanupEnemies() {
    for (const enemy of enemies) {
        if (enemy.userData.flameEffect) {
            enemy.userData.flameEffect.dispose();
        }

        // v0.27.0: animSystem 无需手动清理
        if (enemy.parent) enemy.parent.remove(enemy);
        enemy.traverse(c => { if (c.geometry) c.geometry.dispose(); if (c.material) c.material.dispose(); });
    }
    enemies = [];

}

function respawnPlayer() {
    if (!player1 || !combatData || combatData.lives <= 0) return;
    // 恢复到出生点
    const sp = currentMapData && currentMapData.spawnPoints && currentMapData.spawnPoints.p1;
    const sx = sp ? sp[0] : POINT_A_X;
    const sz = sp ? sp[1] : POINT_A_Z;
    const sy = sp ? sp[2] : Math.PI / 2;
    player1.state.x = sx; player1.state.z = sz; player1.state.yaw = sy;
    player1.hp = player1.maxHp || player1.userData.maxHp || 100;
    player1.dead = false;
    player1.mgLockTarget = null;
    player1.group.visible = true;
    togglePlayerBars(player1, true);
    player1.group.position.set(sx, getGroundHeight(sx, sz), sz);
    player1.group.rotation.set(0, Math.PI / 2 - sy, 0);
    if (player1.damageEffects && player1.damageEffects.active) player1.damageEffects.hide();
    tankState.x = sx; tankState.z = sz; tankState.yaw = sy;
    // 清除敌人锁定 + 重置火焰状态（避免重生后炮口残留火焰）
    for (const enemy of enemies) {
        if (enemy.ai) {
            enemy.ai.target = null;
            enemy.ai.lastSeenPlayerPos = null;
            enemy.ai.isFlaming = false;
            enemy.ai.flameRequest = false;
            enemy.ai.flameTicksLeft = 0;
            enemy.ai.flameStartTime = 0;
        }
    }
    hintBar.textContent = '⚔️ 战斗继续 | 剩余命数:' + combatData.lives + ' | 得分:' + combatData.score;
}

function showGameOverScreen() {
    const finalScore = combatData ? combatData.score : 0;
    if (window.ScoreSystem) {
        window.ScoreSystem.settleScore(selectedMapId || 'test_map_03a', finalScore);
    }
    
    const goOverlay = document.getElementById('game-over-overlay');
    const goScore = document.getElementById('go-score');
    const goKills = document.getElementById('go-kills');
    const goTime = document.getElementById('go-time');
    const goDamage = document.getElementById('go-damage');
    const goDeaths = document.getElementById('go-deaths');
    
    goScore.textContent = finalScore;
    goKills.textContent = combatData ? combatData.kills : 0;
    
    const elapsed = combatData ? Math.floor((Date.now() - combatData.startTime) / 1000) : 0;
    const mins = Math.floor(elapsed / 60);
    const secs = elapsed % 60;
    goTime.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    
    goDamage.textContent = (combatData ? combatData.damageDealt : 0) + ' HP';
    
    goDeaths.innerHTML = '';
    const deaths = combatData ? combatData.deaths : [];
    for (let i = 0; i < deaths.length; i++) {
        const deathItem = document.createElement('div');
        deathItem.className = 'death-item';
        deathItem.innerHTML = `<span class="death-num">${i + 1}.</span><span class="death-cause">${deaths[i].enemy}</span>`;
        goDeaths.appendChild(deathItem);
    }
    if (deaths.length === 0) {
        goDeaths.innerHTML = '<div class="death-item"><span class="death-num">-</span><span class="death-cause">无记录</span></div>';
    }
    
    goOverlay.classList.add('active');
    hintBar.textContent = '';
    // 释放指针锁+显示光标, 允许点击按钮
    if (document.pointerLockElement) document.exitPointerLock();
    document.body.style.cursor = '';
    crosshairEl.style.display = 'none';
    var rr = document.getElementById('reload-ring'); if (rr) rr.style.display = 'none';
}

function hideGameOverScreen() {
    const goOverlay = document.getElementById('game-over-overlay');
    goOverlay.classList.remove('active');
}

function versusGameLoop() {
    // 先复位为全屏（清除上一帧的 scissor/viewport 残留）
    const dpr = renderer.getPixelRatio();
    const cssW = window.innerWidth, cssH = window.innerHeight;
    const fbW = cssW * dpr, fbH = cssH * dpr;
    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, cssW, cssH);

    const dt=Math.min(clock.getDelta(),.1);visibilityTimer+=dt;
    const p1i=getInputForPlayer(1),p2i=getInputForPlayer(2);
    updatePlayerPhysics(player1,dt,p1i.left,p1i.right);updatePlayerPhysics(player2,dt,p2i.left,p2i.right);
    // 同步 tankState 到 player1（供 updateObstacleVisibility 主逻辑使用）
    tankState.x = player1.state.x; tankState.z = player1.state.z;
    updateEngineSound(Math.max(Math.abs(player1.currentLeftSpeed),Math.abs(player1.currentRightSpeed),Math.abs(player2.currentLeftSpeed),Math.abs(player2.currentRightSpeed)));
    if(mouseFireRequested&&player1.fireReady){fireShell(player1);player1.fireReady=false;mouseFireRequested=false;}
    const p1fire=mouseDown;
    if(!p1fire)player1.fireReady=true;
    const gp=getGamepad();const p2fire=gp&&gp.buttons[7]&&gp.buttons[7].value>.3;
    if(p2fire&&player2.fireReady){fireShell(player2);player2.fireReady=false;}
    if(!p2fire)player2.fireReady=true;
    
    // 更新 P1 十字光标（只在左半屏显示）
    const halfCssW = Math.floor(cssW / 2), rightCssW = cssW - halfCssW;
    const halfW = Math.floor(fbW / 2), rightW = fbW - halfW;
    const isMouseInP1Area = mouseX < halfCssW;
    crosshairEl.style.left = mouseX + 'px';
    crosshairEl.style.top = mouseY + 'px';
    crosshairEl.style.display = isMouseInP1Area ? 'block' : 'none';
    document.body.style.cursor = isMouseInP1Area ? 'none' : 'default';
    
    // 计算 P1 瞄准有效性
    let p1AimValid = false;
    if (player1 && !player1.dead && groundMesh && isMouseInP1Area) {
        const barrelPos = getBarrelWorldPos(player1);
        // 将鼠标坐标转换为相对于1P分屏区域的坐标
        const p1MouseX = mouseX; // 1P分屏从左边缘开始
        const p1MouseY = mouseY;
        // 使用1P分屏的尺寸计算NDC坐标
        const mouseNDC = new THREE.Vector2(
            (p1MouseX / halfCssW) * 2 - 1,
            -(p1MouseY / cssH) * 2 + 1
        );
        aimRaycaster.setFromCamera(mouseNDC, camera);
        const groundHits = aimRaycaster.intersectObject(groundMesh);
        const aimTgts = obstacleMeshes.slice(); for(let ei=0;ei<enemies.length;ei++){const en=enemies[ei];if(!en||!en.visible)continue;if(en.cfg&&en.cfg.type==='hexapod'){en.traverse(function(c){if(c.isMesh){const pn=(c.parent&&c.parent.name)||'';if(pn.indexOf('腿')<0&&pn.indexOf('脚踝')<0)aimTgts.push(c);}})}else{aimTgts.push(en);}}const obsHits=aimRaycaster.intersectObjects(aimTgts,true);
        
        let targetAim = null;
        if (groundHits.length > 0) targetAim = groundHits[0].point.clone();
        if (obsHits.length > 0 && (!targetAim || obsHits[0].distance < targetAim.distanceTo(camera.position))) {
            targetAim = obsHits[0].point.clone();
        }
        
        if (targetAim) {
            const diff = targetAim.clone().sub(barrelPos);
            const dist = diff.length();
            if (dist <= 150) {
                const obsDir = diff.clone().normalize();
                const obsRc = new THREE.Raycaster();
                obsRc.set(barrelPos, obsDir);
                const obsInt = obsRc.intersectObjects(aimTgts, true);
                const blockers = obsInt.filter(h => h.distance < dist - 1.5);
                if (blockers.length === 0) p1AimValid = true;
            }
        }
    }
    crosshairEl.style.color = p1AimValid ? '#00ff00' : '#ff3333';
    if (player1) updateReloadRing(player1.reloadTimer || 0, RELOAD_TIME);
    updateTrajectoryLine(player2);
    updateShellsFragsMuzzle(dt);
    if(visibilityTimer>.3){updateObstacleVisibility([player2.state]);updateGrassVisibility([player2.state]);visibilityTimer=0;}
    for(const od of obstacleData){if(od.blades)od.blades.rotation.x+=1.5*dt;}
    // 水面波动动画 → waters.js
    updateWaterAnimation(dt);
    // ── 坦克损毁效果（血量 < 50 时显示火焰和烟雾） ──
    for (const p of [player1, player2]) {
        if (p && p.damageEffects) {
            if (!p.dead && p.hp < 50) {
                if (!p.damageEffects.active) p.damageEffects.show();
                p.damageEffects.update(dt, { x: p.state.x, y: getGroundHeight(p.state.x, p.state.z), z: p.state.z });
            } else if (p.damageEffects.active) {
                p.damageEffects.hide();
            }
        }
    }
    // ── 爆炸效果更新（坦克死亡时触发的大型火焰烟雾） ──
    for (let i = explosions.length - 1; i >= 0; i--) {
        explosions[i].update(dt);
        if (!explosions[i].active) {
            explosions[i].dispose();
            explosions.splice(i, 1);
        }
    }

    // ── 焦痕渐消 ──
    for (let i = scorchMarks.length - 1; i >= 0; i--) {
        const sc = scorchMarks[i]; sc.life -= dt;
        if (sc.life <= 0) { scene.remove(sc.mesh); sc.mesh.geometry.dispose(); sc.mesh.material.dispose(); scorchMarks.splice(i, 1); }
        else { sc.mesh.material.opacity = 0.65 * (sc.life / sc.maxLife); }
    }
    // ── 地面碎片更新 ──
    for (let i = groundDebris.length - 1; i >= 0; i--) {
        const gd = groundDebris[i]; gd.life -= dt;
        if (gd.life <= 0) { scene.remove(gd.mesh); gd.mesh.geometry.dispose(); gd.mesh.material.dispose(); groundDebris.splice(i, 1); }
        else { gd.vel.y -= 9.8 * dt; gd.mesh.position.x += gd.vel.x * dt; gd.mesh.position.y += gd.vel.y * dt; gd.mesh.position.z += gd.vel.z * dt;
            const gdGY = getGroundHeight(gd.mesh.position.x, gd.mesh.position.z) + 0.05; if (gd.mesh.position.y < gdGY) gd.mesh.position.y = gdGY;
            gd.mesh.material.opacity = gd.life / gd.maxLife; }
    }
    // 分屏尺寸
    splitLine.style.left = halfCssW + 'px';
    // ⚡ v0.25.4: 阴影相机跟随两玩家中点（双人模式），按距离动态扩展覆盖范围
    if (sunLight && sunLight.castShadow && shadowEnabled) {
        const mx = (player1.state.x + player2.state.x) / 2;
        const mz = (player1.state.z + player2.state.z) / 2;
        const pDist = Math.sqrt(
            (player1.state.x - player2.state.x) ** 2 +
            (player1.state.z - player2.state.z) ** 2
        );
        const he = Math.max(36, pDist * 0.6 + 5); // v0.25.5: 基础72m（与单人模式一致），按玩家间距动态扩展
        sunLight.position.set(mx + 30, 40, mz + 20);
        sunLight.target.position.set(mx, 0, mz);
        sunLight.shadow.camera.left = -he;
        sunLight.shadow.camera.right = he;
        sunLight.shadow.camera.top = he;
        sunLight.shadow.camera.bottom = -he;
        sunLight.shadow.camera.updateProjectionMatrix();
    }
    // 先全屏清空一次（scissor 关闭），然后两半屏叠加渲染
    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, cssW, cssH);
    renderer.clear();
    renderer.autoClear = false;
    // 左半屏 (P1)
    togglePlayerBars(player1, true); togglePlayerBars(player2, false);
    renderer.setScissorTest(true);
    renderer.setViewport(0, 0, halfCssW, cssH); renderer.setScissor(0, 0, halfCssW, cssH);
    camera.aspect = halfCssW / cssH; camera.updateProjectionMatrix();
    placeCameraFor(player1, camera, true); updateBarsForCamera(player1, camera);
    renderer.render(scene, camera);
    // 右半屏 (P2)
    togglePlayerBars(player1, false); togglePlayerBars(player2, true);
    renderer.setViewport(halfCssW, 0, rightCssW, cssH); renderer.setScissor(halfCssW, 0, rightCssW, cssH);
    camera2.aspect = rightCssW / cssH; camera2.updateProjectionMatrix();
    placeCameraFor(player2, camera2, true); updateBarsForCamera(player2, camera2);
    renderer.render(scene, camera2);
    renderer.setScissorTest(false);
    renderer.autoClear = true;
    togglePlayerBars(player1, true); togglePlayerBars(player2, true);
    // 指向箭头（传入 framebuffer 坐标）
    updateArrows(dpr, halfW, rightW, fbH);
    updateDebugInfo();
    animationId=requestAnimationFrame(versusGameLoop);
}

function placeCameraFor(p, cam) {
    if (window._godMode) return;
    // P1 用鼠标横轴 (cameraYaw), P2 用车身朝向
    let cfx, cfz;
    if (p === player1 && gameMode === 'versus') {
        cfx = Math.cos(cameraYaw); cfz = Math.sin(cameraYaw);
    } else {
        cfx = Math.cos(p.state.yaw); cfz = Math.sin(p.state.yaw);
    }
    const gy = getGroundHeight(p.state.x, p.state.z);
    cam.position.set(p.state.x - cfx * CAMERA_BEHIND_VS, gy + CAMERA_ABOVE_VS, p.state.z - cfz * CAMERA_BEHIND_VS);
    cam.lookAt(p.state.x + cfx * 8, gy + CAMERA_LOOK_Y_VS, p.state.z + cfz * 8);
}

function updateShellsFragsMuzzle(dt) {
    for(let i=shells.length-1;i>=0;i--){const s=shells[i];
        const prevPos=s.prevPos||s.mesh.position.clone();
        s.vel.y-=SHELL_GRAVITY*dt;
        s.mesh.position.x+=s.vel.x*dt;s.mesh.position.y+=s.vel.y*dt;s.mesh.position.z+=s.vel.z*dt;
        s.prevPos=s.mesh.position.clone();
        if(s.vel.lengthSq()>.01)s.mesh.lookAt(s.mesh.position.clone().add(s.vel));
        if(s.tracerLight)s.tracerLight.position.copy(s.mesh.position);
        if(s.glowTail){const vd=s.vel.clone().normalize();s.glowTail.position.copy(s.mesh.position).addScaledVector(vd,-0.18);}
        let hit=false;const sR=.18, mv=new THREE.Vector3().subVectors(s.mesh.position,prevPos), mvL=mv.length();
        const checkObs = window._obstacleGrid ? 
            window._obstacleGrid.queryByDistance(s.mesh.position.x, s.mesh.position.z, mvL + 2) : 
            obstacleData;
        for(let j=checkObs.length-1;j>=0;j--){const od=checkObs[j];
            if(od.destroyed)continue;
            if(od.type==='building'&&od.groupRef&&!od.groupRef.visible)continue;
            const oR=od.radius||.55, cR=sR+oR, oT=od.height||1.5;
            const oX=(od.type==='building'&&od.groupRef)?od.groupRef.position.x:od.x;
            const oZ=(od.type==='building'&&od.groupRef)?od.groupRef.position.z:od.z;
            const oY=(od.type==='building'&&od.groupRef)?od.groupRef.position.y:(isVersusMap?0:getTerrainHeight(od.x,od.z));
            const prevY=prevPos.y,currY=s.mesh.position.y,oTL=oY+oT+.3;
            if(currY>oTL&&prevY>oTL)continue;
            let hh=false;
            if(mvL<.0001){const dx=s.mesh.position.x-oX,dz=s.mesh.position.z-oZ;hh=dx*dx+dz*dz<cR*cR;}
            else{const ox=oX,oz=oZ;const px=prevPos.x,pz=prevPos.z;
                const vx=s.mesh.position.x-px,vz=s.mesh.position.z-pz;
                const dx0=px-ox,dz0=pz-oz;const a=vx*vx+vz*vz,b=2*(dx0*vx+dz0*vz),c=dx0*dx0+dz0*dz0-cR*cR;
                const disc=b*b-4*a*c;if(disc>=0){const sq=Math.sqrt(disc),t1=(-b-sq)/(2*a),t2=(-b+sq)/(2*a);
                    if((t1>=0&&t1<=1)||(t2>=0&&t2<=1)||(t1<0&&t2>1))hh=true;}}
            if(hh){const op=new THREE.Vector3(oX,oY+oT/2,oZ);spawnFragments(op,od.color);playExplosionSound();
                if(od.type==='building'&&od.groupRef){const obs=od.groupRef;
                    obs.parent.remove(obs);obs.traverse(c=>{if(c.geometry)c.geometry.dispose();if(c.material)c.material.dispose();});
                    const mIdx=obstacleMeshes.indexOf(obs);if(mIdx>=0)obstacleMeshes.splice(mIdx,1);}
                else if(od.type&&od.type!=='building'){disposeTreeInstance(od);}
                // 找到 od 在 obstacleData 中的真实索引并移除
                const realIdx = obstacleData.indexOf(od);
                if (realIdx >= 0) {
                    obstacleData.splice(realIdx, 1);
                }
                // 从空间网格中移除
                if (window._obstacleGrid) {
                    window._obstacleGrid.remove(od);
                }
                hit=true;break;}}
        // ── 炮弹 vs 敌人碰撞 (扫掠球-圆柱, 防高速跳过) ──
        if(!hit){for(let ei2=enemies.length-1;ei2>=0;ei2--){const en=enemies[ei2];
            if(!en||!en.visible||en.dead)continue;
            const eR=(en.cfg&&en.cfg.type==='zombie')?.4:(en.cfg&&en.cfg.type==='hexapod')?1.0:ENEMY_HALF_W;
            const eH=(en.cfg&&en.cfg.type==='zombie')?1.8:(en.cfg&&en.cfg.type==='hexapod')?2.0:.8;
            const ey=en.position.y, cR=sR+eR, oTL=ey+eH+.3;
            const prevY=prevPos.y, currY=s.mesh.position.y;
            if(currY>oTL&&prevY>oTL)continue;
            if(currY<ey-.3&&prevY<ey-.3)continue;
            const ox=en.position.x, oz=en.position.z;
            const px=prevPos.x, pz=prevPos.z;
            const vx=s.mesh.position.x-px, vz=s.mesh.position.z-pz; if(vx*vx+vz*vz<.0001)continue;
            const dx0=px-ox, dz0=pz-oz;
            const a=vx*vx+vz*vz, b=2*(dx0*vx+dz0*vz), c=dx0*dx0+dz0*dz0-cR*cR;
            const disc=b*b-4*a*c;
            if(disc>=0){const sq=Math.sqrt(disc), t1=(-b-sq)/(2*a), t2=(-b+sq)/(2*a);
                if((t1>=0&&t1<=1)||(t2>=0&&t2<=1)||(t1<0&&t2>1)){
                    const tHit=Math.max(0,Math.min(1,t1>=0&&t1<=1?t1:t2));
                    const hitY=prevY+(currY-prevY)*tHit;
                    if(hitY>ey-.3&&hitY<ey+eH+.3){
                        en.hp-=s.damage||SHELL_DAMAGE;if(en.hp<0)en.hp=0;hit=true;
                        spawnHitSparks(new THREE.Vector3(ox+(px+vx*tHit-ox)*.5,hitY,oz+(pz+vz*tHit-oz)*.5));playHitSound();
                        if(en.hp<=0){en.dead=true;
                            spawnFragments(new THREE.Vector3(en.position.x,en.position.y+1,en.position.z),'#4a5c2e');
                            playExplosionSound();en.visible=false;}}}}}}
        if(!hit&&gameMode==='versus'&&s.owner){const en=s.owner===player1?player2:player1;
            if(en&&!en.dead){const edx=s.mesh.position.x-en.state.x,edz=s.mesh.position.z-en.state.z;
                if(Math.sqrt(edx*edx+edz*edz)<TANK_HALF_W+.2&&s.mesh.position.y<1.8){en.hp-=SHELL_DAMAGE;if(en.hp<0)en.hp=0;hit=true;
                    if(en.hp<=0){en.dead=true;const ep=en.group.position.clone();ep.y+=.5;
                        spawnFragments(ep,en.camoColor==='desert'?'#8b7d4a':'#4a5c2e');playExplosionSound();en.group.visible=false;
                        if(en.damageEffects)en.damageEffects.hide();
                        // 坦克死亡：触发大型爆炸火焰烟雾效果 + 殉爆检查
                        spawnExplosion(ep);
                        setTimeout(()=>showVersusResult(s.owner),2000);}
                    else{spawnHitSparks(s.mesh.position.clone());}}}}


        const heDet=(s.type==='he'&&(hit||s.mesh.position.y<getGroundHeight(s.mesh.position.x,s.mesh.position.z)));
        if(heDet){const hP=s.mesh.position.clone();hP.y=Math.max(hP.y,getGroundHeight(hP.x,hP.z));spawnHeExplosion(hP);playHeExplosionSound();
            const checkObs = window._obstacleGrid ? 
                window._obstacleGrid.queryByDistance(hP.x, hP.z, HE_SPLASH + 2) : 
                obstacleData;
            for (let j = checkObs.length - 1; j >= 0; j--) {
                const od = checkObs[j];
                if (od.destroyed) continue;
                const ox = (od.type === 'building' && od.groupRef) ? od.groupRef.position.x : od.x;
                const oz = (od.type === 'building' && od.groupRef) ? od.groupRef.position.z : od.z;
                const dx = hP.x - ox, dz = hP.z - oz;
                const cR = HE_SPLASH + (od.radius || 0.55);
                if (dx * dx + dz * dz < cR * cR) {
                    const opy = (od.type === 'building' && od.groupRef) ? od.groupRef.position.y : (isVersusMap ? 0 : getTerrainHeight(od.x, od.z));
                    const op = new THREE.Vector3(ox, opy + (od.height || 1.5) / 2, oz);
                    spawnFragments(op, od.color);
                    if (od.type === 'building' && od.groupRef) {
                        od.groupRef.parent.remove(od.groupRef);
                        od.groupRef.traverse(c => { if (c.geometry) c.geometry.dispose(); if (c.material) c.material.dispose(); });
                        const mi = obstacleMeshes.indexOf(od.groupRef);
                        if (mi >= 0) obstacleMeshes.splice(mi, 1);
                    } else if (od.type === 'building') {
                        disposeBuildingInstance(od);
                    } else if (od.type) {
                        disposeTreeInstance(od);
                    }
                    obstacleData.splice(j, 1);
                }
            }
            if (gameMode === 'versus' && s.owner) {
                const opp = s.owner === player1 ? player2 : player1;
                if (opp && !opp.dead) {
                    const odx = hP.x - opp.state.x, odz = hP.z - opp.state.z;
                    if (Math.sqrt(odx * odx + odz * odz) < HE_SPLASH + TANK_HALF_W) {
                        opp.hp -= HE_DAMAGE;
                        if (opp.hp <= 0) { opp.dead = true; opp.hp = 0; }
                    }
                }
            }
        }
        const ref=s.owner||{state:tankState};const rx=ref.state?ref.state.x:tankState.x,rz=ref.state?ref.state.z:tankState.z;
        const sgy=getGroundHeight(s.mesh.position.x,s.mesh.position.z);
        if(hit||s.mesh.position.y<sgy||Math.sqrt((s.mesh.position.x-rx)**2+(s.mesh.position.z-rz)**2)>SHELL_MAX_DIST||Math.abs(s.mesh.position.x)>worldHalfW+50||Math.abs(s.mesh.position.z)>worldHalfD+50){
            // 训练场: 敌人炮弹落地近炸溅射
            if(!hit&&s.mesh.position.y<sgy&&isTrainingMode&&s.isEnemyShell&&player1&&!player1.dead){
                var edx2 = s.mesh.position.x - player1.group.position.x;
                var edz2 = s.mesh.position.z - player1.group.position.z;
                if(Math.sqrt(edx2*edx2+edz2*edz2) < 5.0){
                    player1.hp -= 7;
                    if(player1.hp < 0) player1.hp = 0;
                    player1.ai = player1.ai || {}; player1.ai.hitFlash = 0.15;
                    if(player1.hp <= 0) _killPlayerInTraining();
                    else playHitSound();
                }
            }
            if(!hit&&s.mesh.position.y<sgy){const ip=s.mesh.position.clone();ip.y=sgy;if(s.type!=='he')playGroundHitSound();spawnGroundDebris(ip);spawnScorchMark(ip);}
            scene.remove(s.mesh);disposeShellMesh(s.mesh);if(s.tracerLight){scene.remove(s.tracerLight);}if(s.glowTail){scene.remove(s.glowTail);s.glowTail.geometry.dispose();s.glowTail.material.dispose();}shells.splice(i,1);}}
    for(let i=fragments.length-1;i>=0;i--){const f=fragments[i];f.life-=dt;f.vel.y-=SHELL_GRAVITY*dt;
        f.mesh.position.x+=f.vel.x*dt;f.mesh.position.y+=f.vel.y*dt;f.mesh.position.z+=f.vel.z*dt;
        f.mesh.rotation.x+=f.rotSpeed.x*dt;f.mesh.rotation.y+=f.rotSpeed.y*dt;f.mesh.rotation.z+=f.rotSpeed.z*dt;
        const fgy=getGroundHeight(f.mesh.position.x,f.mesh.position.z)+.05;
        if(f.mesh.position.y<fgy){f.mesh.position.y=fgy;f.vel.set(0,0,0);}
        f.mesh.material.opacity=Math.max(0,f.life/FRAG_LIFE);f.mesh.material.transparent=f.life/FRAG_LIFE<1;
        if(f.life<=0){scene.remove(f.mesh);f.mesh.geometry.dispose();f.mesh.material.dispose();fragments.splice(i,1);}}
    for(let i=muzzleLights.length-1;i>=0;i--){const ml=muzzleLights[i];ml.life-=dt;
        if(ml.light.isPointLight)ml.light.intensity=Math.max(0,ml.light.intensity*(1-dt*10));
        else if(ml.light.isMesh){ml.light.scale.multiplyScalar(1+dt*8);ml.light.material.opacity=Math.max(0,ml.life/.35);}
        if(ml.life<=0){scene.remove(ml.light);if(ml.light.geometry)ml.light.geometry.dispose();if(ml.light.material)ml.light.material.dispose();muzzleLights.splice(i,1);}}
    for(let i=ringFX.length-1;i>=0;i--){const rf=ringFX[i];rf.life-=dt;rf.mesh.material.opacity=Math.max(0,rf.life/rf.maxLife);
        if(rf.isShockwave){const t=1-rf.life/rf.maxLife;const s=.06+(rf.targetScale-.06)*t;rf.mesh.scale.set(s,s,s);rf.mesh.material.opacity=Math.max(0,.7*(1-t*t));}
        if(rf.isFrag){if(rf.mesh.userData&&rf.mesh.userData.vel){rf.mesh.userData.vel.y-=9.8*dt;rf.mesh.position.x+=rf.mesh.userData.vel.x*dt;rf.mesh.position.y+=rf.mesh.userData.vel.y*dt;rf.mesh.position.z+=rf.mesh.userData.vel.z*dt;rf.mesh.rotation.x+=rf.mesh.userData.rot.x*dt;rf.mesh.rotation.y+=rf.mesh.userData.rot.y*dt;}const gy=getGroundHeight(rf.mesh.position.x,rf.mesh.position.z)+.05;if(rf.mesh.position.y<gy){rf.mesh.position.y=gy;if(rf.mesh.userData)rf.mesh.userData.vel=new THREE.Vector3(0,0,0);}}
        if(rf.life<=0){scene.remove(rf.mesh);rf.mesh.geometry.dispose();rf.mesh.material.dispose();ringFX.splice(i,1);}}
}

// ==================== 菜单与状态切换 ====================
let selectedMapId = 'test_map_01a';

async function showMapSelector() {
    // 隐藏菜单按钮，显示地图选择面板
    document.querySelectorAll('#menu-overlay > .menu-btn').forEach(b => b.style.display = 'none');
    document.querySelectorAll('#menu-overlay > .menu-hint').forEach(h => h.style.display = 'none');
    document.querySelectorAll('#menu-overlay > .changelog').forEach(c => c.style.display = 'none');
    mapSelector.classList.add('active');
    // 等待地图从 maps/ 目录加载完毕
    mapList.innerHTML = '<div class="map-item" style="color:#888;cursor:default;">⏳ 加载地图列表中...</div>';
    if (mapsLoadPromise) await mapsLoadPromise;
    // 填充单人地图列表
    mapList.innerHTML = '';
    Object.entries(MAP_CONFIGS).forEach(([id, cfg]) => {
        if (cfg.type === 'single') {
            const item = document.createElement('div');
            item.className = 'map-item' + (id === selectedMapId ? ' selected' : '');
            item.dataset.mapId = id;
            item.innerHTML = `<div class="map-name">${cfg.name}</div><div class="map-desc">${cfg.desc || ''}</div>`;
            item.addEventListener('click', () => {
                mapList.querySelectorAll('.map-item').forEach(m => m.classList.remove('selected'));
                item.classList.add('selected');
                selectedMapId = id;
            });
            mapList.appendChild(item);
        }
    });
    // 追加编辑器地图
    try {
        // 全量诊断：列出所有 localStorage 键
        const allKeys = [];
        for (let i = 0; i < localStorage.length; i++) allKeys.push(localStorage.key(i));
        console.log('🔍 localStorage 全部键:', allKeys);
        const bpsRaw = localStorage.getItem('tank_map_editor_blueprints');
        console.log('📝 tank_map_editor_blueprints:', bpsRaw ? bpsRaw.substring(0, 300) + (bpsRaw.length > 300 ? '...' : '') : '(空/不存在)');
        const bps = JSON.parse(bpsRaw || '[]');
        console.log('📝 编辑器蓝图数量:', bps.length, bps.length > 0 ? '名称: ' + bps.map(b => b.name).join(', ') : '⚠️ 无蓝图');
        if (bps.length > 0) {
            const sep = document.createElement('div');
            sep.className = 'map-item';
            sep.style.cssText = 'font-size:11px;color:#888;cursor:default;padding:4px 12px;';
            sep.textContent = '── 📝 编辑器地图 ──';
            mapList.appendChild(sep);
            bps.forEach(bp => {
                const editorId = 'editor_' + bp.name;
                // 动态注入 MAP_CONFIGS
                if (!MAP_CONFIGS[editorId]) {
                    MAP_CONFIGS[editorId] = convertBlueprintToMapConfig(bp);
                }
                const item = document.createElement('div');
                item.className = 'map-item' + (editorId === selectedMapId ? ' selected' : '');
                item.dataset.mapId = editorId;
                const ecount = (bp.entities||[]).filter(e => e.type === 'enemy').length;
                item.innerHTML = `<div class="map-name">📝 ${bp.name}</div><div class="map-desc">${ecount}个敌人 | ${new Date(bp.savedAt).toLocaleDateString('zh-CN')}</div>`;
                item.addEventListener('click', () => {
                    mapList.querySelectorAll('.map-item').forEach(m => m.classList.remove('selected'));
                    item.classList.add('selected');
                    selectedMapId = editorId;
                });
                mapList.appendChild(item);
            });
        }
    } catch(e) { /* localStorage 不可用 */ }
    // 如果没有单人地图可选，默认选中第一个
    if (!mapList.querySelector('.selected') && mapList.firstChild) {
        mapList.firstChild.classList.add('selected');
        selectedMapId = mapList.firstChild.dataset.mapId;
    }
}

function hideMapSelector() {
    mapSelector.classList.remove('active');
    document.querySelectorAll('#menu-overlay > .menu-btn').forEach(b => b.style.display = '');
    document.querySelectorAll('#menu-overlay > .menu-hint').forEach(h => h.style.display = '');
    document.querySelectorAll('#menu-overlay > .changelog').forEach(c => c.style.display = '');
}

// ==================== 加载画面 API ====================
function showLoading(title) {
    if (loadingTitle) loadingTitle.textContent = title || '🚀 正在载入地图';
    if (loadingText) loadingText.textContent = '';
    if (loadingBar) loadingBar.style.width = '0%';
    loadingOverlay.classList.add('active');
}
function updateLoadingProgress(pct, text) {
    if (loadingBar) loadingBar.style.width = Math.min(100, Math.max(0, pct)) + '%';
    if (loadingText && text) loadingText.textContent = text;
}
function hideLoading() {
    loadingOverlay.classList.remove('active');
}

async function enterGame() {
    hideMapSelector();
    showLoading('🚀 正在载入地图');
    try {
    await raf(); updateLoadingProgress(5, '加载地图配置...');

    // 加载选中地图配置
    if (!loadMapConfig(selectedMapId)) {
        console.warn('地图加载失败，使用默认配置');
        loadMapConfig('test_map_01a');
    }
    // 战斗地图路由
    if (currentMapData && currentMapData.mode === 'combat') {
        await enterCombatMode();
        return;
    }
    gameMode='single';isVersusMap=false;currentShellType='ap';
    cameraYaw = player1 ? player1.state.yaw : 0;
    menuOverlay.classList.add('hidden');gameContainer.classList.add('active');
    splitLine.style.display='none';arrowP1.style.display='none';arrowP2.style.display='none';
    crosshairEl.style.display = 'block';
    crosshairEl.style.left = mouseX + 'px';
    crosshairEl.style.top = mouseY + 'px';
    document.body.style.cursor = 'none';
    hintBar.textContent='WASD 移动 | 鼠标瞄准 | 左键/RT 主炮 | ESC 返回菜单';
    scene = scene1;

    await raf(); updateLoadingProgress(10, '清理旧场景...');
    // 移除双人模式的 player2 坦克和 UI
    if (player2 && player2.group && player2.group.parent) player2.group.parent.remove(player2.group);
    if (player2 && player2.reloadBarGroup && player2.reloadBarGroup.parent) player2.reloadBarGroup.parent.remove(player2.reloadBarGroup);
    if (player2 && player2.hpBarGroup && player2.hpBarGroup.parent) player2.hpBarGroup.parent.remove(player2.hpBarGroup);
    if (player2 && player2.damageEffects) { if (player2.damageEffects.firePoints.parent) player2.damageEffects.firePoints.parent.remove(player2.damageEffects.firePoints); if (player2.damageEffects.smokePoints.parent) player2.damageEffects.smokePoints.parent.remove(player2.damageEffects.smokePoints); }
    explosions.forEach(exp => exp.dispose()); explosions = [];

    // 重建场景（分步上报进度）
    await rebuildMapAsync();

    await raf(); updateLoadingProgress(85, '初始化玩家...');
    // 重置 player1 state
    if (player1) {
        player1.state.x = POINT_A_X; player1.state.z = POINT_A_Z; player1.state.yaw = Math.PI / 4;
        player1.currentLeftSpeed = 0; player1.currentRightSpeed = 0;
        player1.prevForwardSpeed = 0; player1.pitch = 0; player1.recoilPitch = 0;
        player1.reloadTimer = 0;
        player1.hp = 100; player1.dead = false;
        if (player1.group) {
            player1.group.visible = true;
            player1.group.position.set(POINT_A_X, 0, POINT_A_Z);
            player1.group.rotation.set(0, Math.PI / 2 - Math.PI / 4, 0);
        }
        if (player1.damageEffects && player1.damageEffects.active) player1.damageEffects.hide();
    }
    resetTank();
    totalDistance = 0;
    visibilityTimer = 0;
    updateObstacleVisibility();
    if(reloadBarGroup)reloadBarGroup.visible=true;
    if(player1&&player1.hpBarGroup)player1.hpBarGroup.visible=false;
    if(player1&&player1.shellLabel)player1.shellLabel.visible=true;
    placeCamera();
    handleObstacleOcclusion();
    initAudio();startEngineSound();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    renderer.setScissorTest(false);
    const cssW = window.innerWidth, cssH = window.innerHeight;
    renderer.setViewport(0, 0, cssW, cssH);
    camera.aspect = cssW / cssH;
    camera.updateProjectionMatrix();
    updateLoadingProgress(100, '完成！');
    await raf();
    hideLoading();
    renderer.render(scene, camera);
    updateDebugInfo();
    if(animationId){cancelAnimationFrame(animationId);}
    clock.getDelta();animationId=requestAnimationFrame(gameLoop);
    } catch(e) {
        console.error('进入游戏失败:', e);
        hideLoading();
        returnToMenu();
        return;
    }
}

// requestAnimationFrame 的 Promise 封装（用于加载画面渲染间隔）
function raf() { return new Promise(r => requestAnimationFrame(r)); }

// 异步版 rebuildMap（分步上报加载进度）
async function rebuildMapAsync() {
    // 清理
    await raf(); updateLoadingProgress(15, '移除旧地面...');
    if (groundPlane) { scene.remove(groundPlane); groundPlane.geometry.dispose(); groundPlane.material.dispose(); }
    cleanupWater(); cleanupBridge();
    if (trajLine) { if (trajLine.parent) trajLine.parent.remove(trajLine); trajLine.geometry.dispose(); trajLine = null; }
    if (trajDot) { if (trajDot.parent) trajDot.parent.remove(trajDot); trajDot.geometry.dispose(); trajDot.material.dispose(); trajDot = null; }
    if (window._treeIMs) {
        for (const im of window._treeIMs) {
            if (im.parent) im.parent.remove(im);
            im.geometry.dispose(); im.material.dispose();
        }
        window._treeIMs = [];
    }
    obstacleMeshes.forEach(g => {
        if (g.parent) g.parent.remove(g);
        g.traverse(c => { if (c.geometry) c.geometry.dispose(); if (c.material) c.material.dispose(); });
    });
    obstacleMeshes = []; obstacleData = [];
    transparentTreeGroups.forEach(g => {
        if (g.parent) g.parent.remove(g);
        g.traverse(c => { if (c.geometry) c.geometry.dispose(); if (c.material) c.material.dispose(); });
    });
    transparentTreeGroups = [];
    clearGrass();

    // 地基
    await raf(); updateLoadingProgress(25, '生成地形...');
    createGround();

    // 草丛
    await raf(); updateLoadingProgress(45, '生成草丛...');
    placeGrass();

    // 水体
    if (!isVersusMap) {
        await raf(); updateLoadingProgress(55, '生成水体...');
        createWaterSurface(); createRiverWater(); createBridge();
    }

    // 障碍物（最重的步骤）
    await raf(); updateLoadingProgress(65, '生成障碍物...');
    createObstacles();
    debugRefreshColliders();

    await raf(); updateLoadingProgress(80, '完成场景构建');
}

function updateDebugInfo() {
    const el = document.getElementById('debug-info');
    if (!el) return;

    // 统计草丛三角面
    if (grassInstances.length > 0 && grassTriCount === 0) {
        grassTriCount = grassInstances.reduce((sum, im) => {
            const geo = im.geometry;
            if (geo.index) return sum + geo.index.count / 3 * im.count;
            return sum + (geo.attributes.position.count / 3) * im.count;
        }, 0);
    }

    const mapName = currentMapData ? currentMapData.name : '-';
    const grassInfo = grassInstances.length > 0
        ? ' | 草丛:' + grassInstances.length + 'DC/' + (grassTriCount/1000).toFixed(0) + 'kΔ'
        : '';

    // 性能探针：显示四阶段耗时（ms），帮助定位瓶颈
    const pd = perfDisplay || {};
    const perfLine = (pd.physics > 0)
        ? '\n⏱ 物理:' + pd.physics + 'ms | 战斗:' + pd.combat +
          'ms | 杂项:' + pd.updates + 'ms | 渲染:' + pd.render +
          'ms | 帧总:' + pd.total + 'ms'
        : '\n⏱ 探针采集中...';

    // renderer.info 统计：DrawCall数 + 三角面数
    let renderStats = '';
    if (renderer && renderer.info && renderer.info.render) {
        const ri = renderer.info.render;
        renderStats = '\n🎨 DC:' + ri.calls + ' | Δ:' + (ri.triangles/1000).toFixed(1) + 'k';
    }
    const shadowHint = '\n🔦 阴影:' + (shadowEnabled ? '开(H键关)' : '关(H键开)');

    let combatLine = '';
    if (gameMode === 'combat' && combatData) {
        combatLine = '\n⚔️ 得分:' + combatData.score + ' | 命数:' + combatData.lives + ' | 敌:' + enemies.filter(e => e.ai && e.ai.state !== 'dead').length + '只';
    }

    el.textContent =
        'v0.55.1  ' + mapName + '  FPS:' + fpsCurrent +
        (gameMode === 'combat' ? combatLine : '\n草丛实例:' + grassInstances.reduce((s, im) => s + im.count, 0) + '簇' + grassInfo) +
        perfLine + renderStats + shadowHint;
}

function returnToMenu() {
    if (document.pointerLockElement) document.exitPointerLock();
    if (window._godMode) {
        window._godMode = false;
        scene.fog = window._godSavedFog;
        camera.fov = window._godSavedFov; camera.far = window._godSavedFar; camera.updateProjectionMatrix();
        scene.traverse(function(obj) {
            if (obj.isMesh && obj.material && obj.material.color &&
                obj.material.color.getHex() === 0x8899aa) obj.visible = true;
        });
    }
    hideMapSelector(); hideGameOverScreen();
    isTrainingMode = false; trainingRespawnQueued = null;
    gameMode='menu';menuOverlay.classList.remove('hidden');gameContainer.classList.remove('active');
    splitLine.style.display='none';versusResult.style.display='none';
    arrowP1.style.display='none';arrowP2.style.display='none';
    crosshairEl.style.display='none';var rr=document.getElementById('reload-ring');if(rr)rr.style.display='none';
    document.body.style.cursor = '';
    mouseDown = false;
    useGamepad = false;
    lastGamepadTime = 0;
    mouseDown = false;
    mouseFireReady = true;
    mouseFireRequested = false;
    gamepadFireReady = true;
    if (trajLine) { trajLine.visible = false; }
    if (trajDot) { trajDot.visible = false; }
    if(reloadBarGroup)reloadBarGroup.visible=false;
    if(player1&&player1.hpBarGroup)player1.hpBarGroup.visible=false;
    if(player2&&player2.hpBarGroup)player2.hpBarGroup.visible=false;
    if(player2&&player2.reloadBarGroup)player2.reloadBarGroup.visible=false;
    cleanupEnemies();
    cleanupPickups();
    combatData = null;
    stopEngineSound();if(animationId){cancelAnimationFrame(animationId);animationId=null;}
}

// ==================== 训练场系统 ====================
const trainingConfig = document.getElementById('training-config');
const tcPlayerOpts = document.getElementById('tc-player-opts');
const tcEnemyOpts = document.getElementById('tc-enemy-opts');
const tcBehaviorOpts = document.getElementById('tc-behavior-opts');
const btnTrainingStart = document.getElementById('btn-training-start');
const btnTrainingCancel = document.getElementById('btn-training-cancel');

let trainingPlayerType = 'tank';
let trainingEnemyType = 'tank';
let trainingBehavior = 'reactive'; // 'active' | 'reactive' | 'passive'

// 初始化训练场配置面板的选择按钮交互
(function initTrainingConfigUI() {
    function setupToggle(container, onChange) {
        container.querySelectorAll('.tc-btn:not(.disabled)').forEach(btn => {
            btn.addEventListener('click', () => {
                container.querySelectorAll('.tc-btn').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
                if (onChange) onChange(btn.dataset.val);
            });
        });
    }
    setupToggle(tcPlayerOpts, v => { trainingPlayerType = v; });
    setupToggle(tcEnemyOpts, v => { trainingEnemyType = v; });
    setupToggle(tcBehaviorOpts, v => { trainingBehavior = v; });
    btnTrainingStart.addEventListener('click', enterTrainingMode);
    btnTrainingCancel.addEventListener('click', hideTrainingConfig);
})();

function showTrainingConfig() {
    document.querySelectorAll('#menu-overlay > .menu-btn').forEach(b => b.style.display = 'none');
    document.querySelectorAll('#menu-overlay > .menu-hint').forEach(h => h.style.display = 'none');
    document.querySelectorAll('#menu-overlay > .changelog').forEach(c => c.style.display = 'none');
    trainingConfig.classList.add('active');
}

function hideTrainingConfig() {
    trainingConfig.classList.remove('active');
    document.querySelectorAll('#menu-overlay > .menu-btn').forEach(b => b.style.display = '');
    document.querySelectorAll('#menu-overlay > .menu-hint').forEach(h => h.style.display = '');
    document.querySelectorAll('#menu-overlay > .changelog').forEach(c => c.style.display = '');
}

async function enterTrainingMode() {
    hideTrainingConfig();
    showLoading('🎯 正在载入训练场');
    try {
    await raf(); updateLoadingProgress(5, '加载地图 01a...');
    selectedMapId = 'test_map_01a';
    if (!loadMapConfig(selectedMapId)) {
        console.warn('地图 01a 加载失败');
        hideLoading();
        return;
    }
    gameMode = 'training'; isTrainingMode = true; isVersusMap = false; currentShellType = 'ap';
    cameraYaw = player1 ? player1.state.yaw : 0;
    const playerSpawnX = -50, playerSpawnZ = 0;
    const enemySpawnX = 50, enemySpawnZ = 0;
    trainingPlayerSpawn = { x: playerSpawnX, z: playerSpawnZ };
    trainingEnemySpawn = { x: enemySpawnX, z: enemySpawnZ };
    trainingRespawnQueued = null;
    menuOverlay.classList.add('hidden'); gameContainer.classList.add('active');
    splitLine.style.display = 'none'; arrowP1.style.display = 'none'; arrowP2.style.display = 'none';
    crosshairEl.style.display = 'block';
    crosshairEl.style.left = mouseX + 'px';
    crosshairEl.style.top = mouseY + 'px';
    document.body.style.cursor = 'none';
    hintBar.textContent = 'WASD 移动 | 鼠标瞄准 | 左键/RT 主炮 | ESC 返回菜单';
    scene = scene1;

    await raf(); updateLoadingProgress(10, '清理旧场景...');
    if (player2 && player2.group && player2.group.parent) player2.group.parent.remove(player2.group);
    if (player2 && player2.reloadBarGroup && player2.reloadBarGroup.parent) player2.reloadBarGroup.parent.remove(player2.reloadBarGroup);
    if (player2 && player2.hpBarGroup && player2.hpBarGroup.parent) player2.hpBarGroup.parent.remove(player2.hpBarGroup);
    if (player2 && player2.damageEffects) { if (player2.damageEffects.firePoints.parent) player2.damageEffects.firePoints.parent.remove(player2.damageEffects.firePoints); if (player2.damageEffects.smokePoints.parent) player2.damageEffects.smokePoints.parent.remove(player2.damageEffects.smokePoints); }
    explosions.forEach(exp => exp.dispose()); explosions = [];

    await rebuildMapAsync();

    await raf(); updateLoadingProgress(85, '初始化训练场...');
    // 玩家出生点: playerSpawnX/Z 已在函数顶部定义
    if (player1) {
        player1.state.x = playerSpawnX; player1.state.z = playerSpawnZ; player1.state.yaw = Math.PI;
        player1.currentLeftSpeed = 0; player1.currentRightSpeed = 0;
        player1.prevForwardSpeed = 0; player1.pitch = 0; player1.recoilPitch = 0;
        player1.reloadTimer = 0;
        player1.hp = 100; player1.dead = false;
        if (player1.group) {
            player1.group.visible = true;
            player1.group.position.set(playerSpawnX, getGroundHeight(playerSpawnX, playerSpawnZ), playerSpawnZ);
            player1.group.rotation.set(0, 0, 0); // 游戏循环会用 π/2-yaw 自动修正
        }
        if (player1.damageEffects && player1.damageEffects.active) player1.damageEffects.hide();
    }
    resetTank();
    totalDistance = 0;
    visibilityTimer = 0;

    // 清除地图自带的敌人, 用训练场配置替换
    enemies.forEach(e => { if (e.parent) e.parent.remove(e); });
    enemies = [];
    shells.forEach(s => { scene.remove(s.mesh); if (s.tracerLight) scene.remove(s.tracerLight); if (s.glowTail) { scene.remove(s.glowTail); s.glowTail.geometry.dispose(); s.glowTail.material.dispose(); } s.mesh.traverse(c => { if (c.geometry) c.geometry.dispose(); if (c.material) c.material.dispose(); }); });
    shells = [];
    hexapodBullets.forEach(hb => { scene.remove(hb.mesh); hb.mesh.geometry.dispose(); hb.mesh.material.dispose(); });
    hexapodBullets = [];
    hexapodMissiles.forEach(hm => { scene.remove(hm.mesh); hm.mesh.traverse(c => { if (c.geometry) c.geometry.dispose(); if (c.material) c.material.dispose(); }); }); hexapodMissiles = [];
    hexapodExplosions.forEach(he => { scene.remove(he.mesh); he.mesh.geometry.dispose(); he.mesh.material.dispose(); }); hexapodExplosions = [];

    // 创建训练场敌人: enemySpawnX/Z 已在函数顶部定义
    const enemyGy = getGroundHeight(enemySpawnX, enemySpawnZ);
    const realEnemyType = trainingEnemyType;
    const enemyHP = realEnemyType === 'tank' ? 100 : realEnemyType === 'assault-vehicle' ? 60 : realEnemyType === 'zombie' ? 40 : realEnemyType === 'hexapod' ? 250 : 60;
    const enemySpeed = realEnemyType === 'tank' ? MAX_SPEED : realEnemyType === 'assault-vehicle' ? 5.0 : realEnemyType === 'zombie' ? 2.5 : realEnemyType === 'hexapod' ? 2.5 : 5.0;

    let enemyModel;
    if (realEnemyType === 'tank') {
        var t34result = T34V16Builder.buildAnimatedT34_85({
            camoColor: 'desert',
            position: { x: 0, y: 0, z: 0 },
            yaw: 0
        });
        t34result.group.position.set(0, 0, 0);
        t34result.group.rotation.set(0, 0, 0);
        var children = t34result.group.children.slice();
        for (var ci = 0; ci < children.length; ci++) {
            var child = children[ci];
            var cx = child.position.x, cz = child.position.z;
            child.position.x = cz;
            child.position.z = -cx;
            child.rotation.y -= Math.PI / 2;
        }
        t34result.group.updateMatrixWorld(true);
        enemyModel = t34result.group;
        enemyModel.group = enemyModel;
        enemyModel.userData = {
            turretPivot: t34result.turretPivot,
            barrelPivot: t34result.barrelPivot,
            mgGroup: t34result.mgGroup
        };
    } else if (realEnemyType === 'assault-vehicle') {

        enemyModel = window.EnemyModels.createAssaultVehicle();
    } else if (realEnemyType === 'hexapod') {

        enemyModel = window.EnemyModels.createHexapod();
    } else if (realEnemyType === 'zombie') {
        enemyModel = window.EnemyModels.createZombie();
    } else {
        console.error('未知训练敌人类型: ' + trainingEnemyType);
        hideLoading(); returnToMenu(); return;
    }
    if (!enemyModel) {
        console.error('无法创建训练场敌人模型');
        hideLoading();
        returnToMenu();
        return;
    }
    enemyModel.position.set(enemySpawnX, enemyGy, enemySpawnZ); // 六足由HexapodEnemy.init()自动抬升
    enemyModel.rotation.set(0, 0, 0); // rotation.y=0 → fwd=-X → 面朝玩家
    var isTankEnemy = (realEnemyType === 'tank');
    var isHexEnemy = (realEnemyType === 'hexapod');
    enemyModel.cfg = {
        type: realEnemyType,
        id: 'training_enemy',
        hp: enemyHP || 60,
        speed: isTankEnemy ? 3.5 : (isHexEnemy ? 4.5 : (enemySpeed || 5.0)),
        viewDist: 80,
        attackDamage: 15,
        attackCooldown: realEnemyType === 'zombie' ? 1.5 : isHexEnemy ? 0.1 : 3.0,
        dropRate: 0,
        dropHeal: 0,
        reactive: trainingBehavior !== 'active',
        aggressive: trainingBehavior === 'active',
        passive: trainingBehavior === 'passive',
        engageDist: isTankEnemy ? 50 : (isHexEnemy ? 30 : 20),
        flameRange: (isTankEnemy || isHexEnemy) ? 55 : 12,
        canFlee: false,
        // 六足专属参数（非六足敌人忽略）
        turnRate: isHexEnemy ? 2.0 : undefined,
        spinUpTime: isHexEnemy ? 0.8 : undefined,
        overheatMax: isHexEnemy ? 100 : undefined,
        heatPerSec: isHexEnemy ? 25 : undefined,
        coolPerSec: isHexEnemy ? 18 : undefined,
        spreadCone: isHexEnemy ? 3 : undefined,
        gatlingRange: isHexEnemy ? 30 : undefined,
        missileRange: isHexEnemy ? 40 : undefined,
        missileCooldown: isHexEnemy ? 4.0 : undefined,
        fireRate: isHexEnemy ? 10 : undefined,
    };
    enemyModel.hp = enemyHP || 60;
    enemyModel.userData = enemyModel.userData || {};
    enemyModel.userData.maxHp = enemyModel.hp;
    enemyModel.userData.enemyType = realEnemyType;
    enemyModel.userData.enemyId = 'training_enemy';
    if (realEnemyType === 'zombie' || realEnemyType === 'hexapod') {
        enemyModel.userData._noTerrainPitch = true;
    }
    // AI 初始化: 全部从patrol起步; reactive=true阻止主动追击, passive=true阻止受击反击
    const startState = 'patrol';
    enemyModel.ai = {
        state: startState,
        target: null,
        patrolIndex: 0,
        lastSeenPlayerPos: null,
        alertTimer: 0,
        flameTimer: 0,
        flameRequest: false,
        flameTicksLeft: 0,
        isFlaming: false,
        flameTickTimer: 0,
        flameStartTime: 0,
        strafeTimer: 0,
        strafeDir: 1,
        wpStuckTimer: 0,
        hitFlash: 0,
        animRequest: (realEnemyType === 'zombie' || realEnemyType === 'hexapod') ? 'idle' : 'walk',
        animAtkStart: 0,
        animHitApplied: false,
        atkReady: true,
        atkCooldown: 0,
        lastHitTime: 0,
        prevState: startState,
        deathAnimStarted: false,
        idleTimer: 0,
        spinUp: 0,
        heat: 0,
        // 六足专属AI字段
        bodyYaw: isHexEnemy ? 0 : undefined,
        gatlingRequest: false,
        missileRequest: false,
        gatlingTimer: 0,
        missileTimer: 0,
        gatlingSpread: 0,
        _missileAmmoL: isHexEnemy ? 4 : 0,
        _missileAmmoR: isHexEnemy ? 4 : 0
    };
    // 六足敌人：初始化 CCD IK 动画状态
    if (isHexEnemy && window.HexapodEnemy) {
        HexapodEnemy.init(enemyModel);
    }
    // 非主动攻击模式: 即使看到玩家也不主动追击 (overwrite update functions later, or use cfg)
    scene.add(enemyModel);
    enemies.push(enemyModel);
    createEnemyHpBar(enemyModel);
    if (realEnemyType === 'zombie' || isHexEnemy) createEnemyHitFlashOverlay(enemyModel);
    updateObstacleVisibility();

    if (reloadBarGroup) reloadBarGroup.visible = true;
    if (player1 && player1.hpBarGroup) player1.hpBarGroup.visible = true;
    if (player1 && player1.shellLabel) player1.shellLabel.visible = true;
    placeCamera();
    handleObstacleOcclusion();
    initAudio(); startEngineSound();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    renderer.setScissorTest(false);
    const cssW = window.innerWidth, cssH = window.innerHeight;
    renderer.setViewport(0, 0, cssW, cssH);
    camera.aspect = cssW / cssH;
    camera.updateProjectionMatrix();
    updateLoadingProgress(100, '完成！');
    await raf();
    hideLoading();
    renderer.render(scene, camera);
    updateDebugInfo();
    if (animationId) { cancelAnimationFrame(animationId); }
    clock.getDelta(); animationId = requestAnimationFrame(gameLoop);
    } catch(e) {
        console.error('进入训练场失败:', e);
        hideLoading();
        returnToMenu();
    }
}

// ==================== 模型预览系统 ====================
const previewContainer = document.getElementById('preview-container');
const previewCatTabs = document.getElementById('preview-cat-tabs');
const previewModelList = document.getElementById('preview-model-list');
const previewLabel = document.getElementById('preview-label');
const btnPreview = document.getElementById('btn-preview');
const btnPreviewBack = document.getElementById('btn-preview-back');

let previewScene = null, previewCamera = null, previewRenderer = null;
let previewModel = null;
let previewAnimId = null;
// 轨道旋转状态
let previewTheta = 0, previewPhi = Math.PI / 4, previewRadius = 5;
let previewIsDragging = false, previewPrevMouse = { x: 0, y: 0 };
const PREVIEW_ROTATE_SPEED = 0.005;
const PREVIEW_ZOOM_SPEED = 0.1;
const PREVIEW_MIN_RADIUS = 0.8;
const PREVIEW_MAX_RADIUS = 15;

// 当前激活的分类与模型
let previewActiveCat = null;
let previewActiveModel = null;

// 分类数据（在 buildPreviewTabs 中填充）
let previewCatData = [];

function enterPreviewMode() {
    menuOverlay.classList.add('hidden');
    previewContainer.classList.add('active');

    // 清理残留的旧 canvas（防止上次退出时 DOM 未清理干净）
    const staleCanvases = previewContainer.querySelectorAll('canvas');
    staleCanvases.forEach(c => c.remove());

    // 创建预览渲染器
    previewRenderer = new THREE.WebGLRenderer({ antialias: true });
    previewRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    previewRenderer.setSize(window.innerWidth, window.innerHeight);
    previewRenderer.shadowMap.enabled = true;
    previewRenderer.shadowMap.type = THREE.PCFSoftShadowMap;
    previewRenderer.toneMapping = THREE.ACESFilmicToneMapping;
    previewRenderer.toneMappingExposure = 1.2;
    previewContainer.appendChild(previewRenderer.domElement);

    // 预览场景
    previewScene = new THREE.Scene();
    previewScene.background = new THREE.Color('#1a1a2e');

    // 光照
    previewScene.add(new THREE.AmbientLight('#ffffff', 0.6));
    previewScene.add(new THREE.HemisphereLight('#ffeeb1', '#446633', 0.5));
    const sun = new THREE.DirectionalLight('#fffef0', 2.5);
    sun.position.set(5, 8, 5);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 1024;
    sun.shadow.mapSize.height = 1024;
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 50;
    sun.shadow.camera.left = -10;
    sun.shadow.camera.right = 10;
    sun.shadow.camera.top = 10;
    sun.shadow.camera.bottom = -10;
    previewScene.add(sun);

    // 地面
    const groundGeo = new THREE.PlaneGeometry(20, 20);
    const groundMat = new THREE.MeshStandardMaterial({ color: '#62994a', roughness: 0.9 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.01;
    ground.receiveShadow = true;
    previewScene.add(ground);

    // 摄像机
    previewCamera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100);
    updatePreviewCamera();

    // 构建分类导航
    buildPreviewTabs();

    // 鼠标事件
    previewRenderer.domElement.addEventListener('mousedown', onPreviewMouseDown);
    window.addEventListener('mousemove', onPreviewMouseMove);
    window.addEventListener('mouseup', onPreviewMouseUp);
    previewRenderer.domElement.addEventListener('wheel', onPreviewWheel, { passive: false });

    // 动画循环
    function previewLoop() {
        updatePreviewCamera();
        previewRenderer.render(previewScene, previewCamera);
        previewAnimId = requestAnimationFrame(previewLoop);
    }
    previewAnimId = requestAnimationFrame(previewLoop);
}

function buildPreviewTabs() {
    previewCatTabs.innerHTML = '';
    previewModelList.innerHTML = '';

    // 收集分类
    const catMap = {
        tanks: { id: 'tanks', label: '坦克', models: [] },
        trees: { id: 'trees', label: '树木', models: [] },
        buildings: { id: 'buildings', label: '建筑', models: [] },
        grass: { id: 'grass', label: '草丛', models: [] },
        enemies: { id: 'enemies', label: '敌方单位', models: [] },
        pickups: { id: 'pickups', label: '战利品', models: [] },
        special: { id: 'special', label: '特殊物件', models: [] }
    };

    // 程序化模型
    const regModels = window.ModelRegistry.getAllModels();
    for (const m of regModels) {
        if (catMap[m.category]) {
            catMap[m.category].models.push({ cat: m.category, name: m.name, label: m.name, catLabel: m.categoryLabel });
        }
    }

    // 过滤空分类，构建分类数据
    previewCatData = Object.values(catMap).filter(c => c.models.length > 0);

    // 渲染分类标签
    previewCatData.forEach((cat, idx) => {
        const tab = document.createElement('div');
        tab.className = 'preview-cat-tab';
        tab.textContent = cat.label;
        tab.addEventListener('click', () => selectPreviewCat(idx, tab));
        previewCatTabs.appendChild(tab);
    });

    // 默认选中第一个分类
    if (previewCatData.length > 0) {
        const firstTab = previewCatTabs.children[0];
        selectPreviewCat(0, firstTab);
    }
}

function selectPreviewCat(idx, tabEl) {
    // 更新标签激活状态
    previewCatTabs.querySelectorAll('.preview-cat-tab').forEach(t => t.classList.remove('active'));
    tabEl.classList.add('active');
    previewActiveCat = idx;

    // 渲染该分类下的模型列表
    previewModelList.innerHTML = '';
    const cat = previewCatData[idx];
    cat.models.forEach((m, mi) => {
        const btn = document.createElement('div');
        btn.className = 'preview-model-btn';
        btn.textContent = m.label;
        btn.addEventListener('click', () => {
            previewModelList.querySelectorAll('.preview-model-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            previewActiveModel = m;
            loadPreviewModel(m);
        });
        previewModelList.appendChild(btn);
    });

    // 默认选中第一个模型
    if (cat.models.length > 0) {
        const firstBtn = previewModelList.children[0];
        firstBtn.classList.add('active');
        previewActiveModel = cat.models[0];
        loadPreviewModel(cat.models[0]);
    }
}

function loadPreviewModel(m) {
    if (previewModel && previewModel.parent) {
        previewModel.parent.remove(previewModel);
        previewModel.traverse(c => {
            if (c.geometry) c.geometry.dispose();
            if (c.material) c.material.dispose();
        });
    }
    previewModel = null;

    // 程序化模型分支
    const fn = window.ModelRegistry.getModel(m.cat, m.name);
    if (!fn) return;

    const detectedCamo = m.name.includes('黄色') ? 'desert' : 'green';
    previewModel = fn({ camoColor: detectedCamo });
    if (m.cat === 'tanks' && window.T34V16Builder && window.T34V16Builder.addTankWheelBolts) {
        window.T34V16Builder.addTankWheelBolts(previewModel);
    }
    // 统一按高度(Y)缩放到 1.5 米，底面贴地
    // 先归零模型的scale/position, 用原始包围盒算出正确缩放和偏移
    var oldScale2 = previewModel.scale.x;
    var oldPosY2 = previewModel.position.y;
    previewModel.scale.setScalar(1);
    previewModel.position.y = 0;
    previewModel.updateMatrixWorld(true);
    const bbox = new THREE.Box3().setFromObject(previewModel);
    const sz = new THREE.Vector3(); bbox.getSize(sz);
    if (sz.y > 0.001) {
        const s = 1.5 / sz.y;
        previewModel.scale.setScalar(s);
        const center = new THREE.Vector3(); bbox.getCenter(center);
        previewModel.position.set(-center.x * s, -bbox.min.y * s, -center.z * s);
    } else {
        // 复原
        previewModel.scale.setScalar(oldScale2);
        previewModel.position.y = oldPosY2;
    }
    previewScene.add(previewModel);
    previewLabel.textContent = '拖拽鼠标旋转模型 | 滚轮缩放 | 当前: ' + m.cat + '/' + m.name;
}

function updatePreviewCamera() {
    const x = previewRadius * Math.sin(previewPhi) * Math.cos(previewTheta);
    const y = previewRadius * Math.cos(previewPhi);
    const z = previewRadius * Math.sin(previewPhi) * Math.sin(previewTheta);
    previewCamera.position.set(x, y, z);
    previewCamera.lookAt(0, 1, 0);
}

function onPreviewMouseDown(e) {
    previewIsDragging = true;
    previewPrevMouse.x = e.clientX;
    previewPrevMouse.y = e.clientY;
}

function onPreviewMouseMove(e) {
    if (!previewIsDragging) return;
    const dx = e.clientX - previewPrevMouse.x;
    const dy = e.clientY - previewPrevMouse.y;
    previewTheta -= dx * PREVIEW_ROTATE_SPEED;
    previewPhi -= dy * PREVIEW_ROTATE_SPEED;
    previewPhi = Math.max(0.1, Math.min(Math.PI - 0.1, previewPhi));
    previewPrevMouse.x = e.clientX;
    previewPrevMouse.y = e.clientY;
}

function onPreviewMouseUp(e) {
    previewIsDragging = false;
}

function onPreviewWheel(e) {
    e.preventDefault();
    previewRadius += e.deltaY * PREVIEW_ZOOM_SPEED * 0.01;
    previewRadius = Math.max(PREVIEW_MIN_RADIUS, Math.min(PREVIEW_MAX_RADIUS, previewRadius));
}

function exitPreviewMode() {
    if (previewAnimId) { cancelAnimationFrame(previewAnimId); previewAnimId = null; }
    if (previewRenderer && previewRenderer.domElement) {
        previewRenderer.domElement.removeEventListener('mousedown', onPreviewMouseDown);
        previewRenderer.domElement.removeEventListener('wheel', onPreviewWheel);
    }
    window.removeEventListener('mousemove', onPreviewMouseMove);
    window.removeEventListener('mouseup', onPreviewMouseUp);
    if (previewModel && previewModel.parent) {
        previewModel.parent.remove(previewModel);
        previewModel.traverse(c => {
            if (c.geometry) c.geometry.dispose();
            if (c.material) c.material.dispose();
        });
        previewModel = null;
    }
    if (previewRenderer) {
        if (previewRenderer.domElement && previewRenderer.domElement.parentNode) {
            previewRenderer.domElement.parentNode.removeChild(previewRenderer.domElement);
        }
        previewRenderer.dispose(); previewRenderer = null;
    }
    previewContainer.classList.remove('active');
    menuOverlay.classList.remove('hidden');
}

// ==================== 事件绑定 ====================
btnEnter.addEventListener('click',showMapSelector);btnVersus.addEventListener('click',enterVersusMode);
btnPreview.addEventListener('click', enterPreviewMode);
btnTraining.addEventListener('click',showTrainingConfig);btnBack.addEventListener('click',returnToMenu);
btnPreviewBack.addEventListener('click', exitPreviewMode);
btnStartGame.addEventListener('click', enterGame);
document.getElementById('go-retry-btn').addEventListener('click', () => {
    hideGameOverScreen();
    enterGame();
});
btnCancelMap.addEventListener('click', hideMapSelector);
window.addEventListener('resize',()=>{
    // 游戏渲染器
    if(camera&&renderer){
        const cssW=window.innerWidth, cssH=window.innerHeight;
        renderer.setSize(cssW, cssH);
        if(gameMode==='versus'){
            camera.aspect=0.5*cssW/cssH; camera.updateProjectionMatrix();
            if(camera2){camera2.aspect=0.5*cssW/cssH; camera2.updateProjectionMatrix();}}
        else{camera.aspect=cssW/cssH; camera.updateProjectionMatrix();}
    }
    // 预览渲染器
    if (previewRenderer && previewCamera) {
        previewRenderer.setSize(window.innerWidth, window.innerHeight);
        previewCamera.aspect = window.innerWidth / window.innerHeight;
        previewCamera.updateProjectionMatrix();
    }
});

// ==================== 初始化 ====================
loadMapConfig('test_map_01a'); // 默认加载单人地图
// 程序化丧尸模型已在 enemies.js 中注册（无需预加载）
initScene();placeCamera();renderer.render(scene,camera);
console.log('⚡ 坦克运动demo v0.59.0 | 摄像机鼠标驱动+WoT稳定器+六足绕圈AI+敌我碰撞+装填环');

// 上帝视角：按 F4 切换俯瞰全图（关雾+隐墙）
window._godMode = false;
window._godSavedFog = null; window._godSavedFov = 45; window._godSavedFar = 300;
window.addEventListener('keydown', function(e) {
    if (e.key !== 'F4') return;
    e.preventDefault();
    window._godMode = !window._godMode;
    if (window._godMode) {
        window._godSavedFog = scene.fog; scene.fog = null;
        window._godSavedFov = camera.fov; window._godSavedFar = camera.far;
        camera.fov = 80; camera.far = 800; camera.updateProjectionMatrix();
        const hw = worldHalfW || 150, hd = worldHalfD || 150;
        const maxExt = Math.max(hw, hd);
        camera.position.set(maxExt * 0.1, maxExt * 2.2, maxExt * 0.1);
        camera.up.set(0, 1, 0);
        camera.lookAt(0, 0, 0);
        if (typeof controls !== 'undefined' && controls && controls.target) controls.target.set(0, 0, 0);
        scene.traverse(function(obj) {
            if (obj.isMesh && obj.material && obj.material.color &&
                obj.material.color.getHex() === 0x8899aa) obj.visible = false;
        });
    } else {
        scene.fog = window._godSavedFog;
        camera.fov = window._godSavedFov; camera.far = window._godSavedFar; camera.updateProjectionMatrix();
        scene.traverse(function(obj) {
            if (obj.isMesh && obj.material && obj.material.color &&
                obj.material.color.getHex() === 0x8899aa) obj.visible = true;
        });
    }
    console.log('🔭 上帝视角:', window._godMode ? '开' : '关');
});

