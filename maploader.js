// ==================== 地图加载模块 ====================
// 从 maps/ 目录动态加载 .map.json，从 localStorage 加载编辑器蓝图

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

// 页面启动时立即加载地图
loadMapsFromDirectory();

function loadMapConfig(mapId) {
    // 编辑器地图：从 localStorage 读取
    if (mapId.startsWith('editor_')) {
        const bpName = mapId.slice(7);
        try {
            const bps = JSON.parse(localStorage.getItem('tank_map_editor_blueprints') || '[]');
            const bp = bps.find(b => b.name === bpName);
            if (bp) {
                currentMapData = convertBlueprintToMapConfig(bp);
                isVersusMap = false;
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
    const _pw = currentMapData.playWidth || currentMapData.size || 200;
    const _pd = currentMapData.playDepth || currentMapData.size || 200;
    const _ww = currentMapData.worldWidth || currentMapData.worldSize || Math.max(300, _pw + 100);
    const _wd = currentMapData.worldDepth || currentMapData.worldSize || Math.max(300, _pd + 100);
    currentMapData.playWidth = _pw;
    currentMapData.playDepth = _pd;
    currentMapData.worldWidth = Math.max(_ww, _pw);
    currentMapData.worldDepth = Math.max(_wd, _pd);
    playHalfW = _pw / 2; playHalfD = _pd / 2;
    worldHalfW = currentMapData.worldWidth / 2; worldHalfD = currentMapData.worldDepth / 2;
    spawnHalfW = playHalfW - 2; spawnHalfD = playHalfD - 2;
    const _minSide = Math.min(playHalfW, playHalfD);
    obsVisibleRadius = _minSide * 0.9;
    grassVisibleRadius = _minSide * 0.95;
    isVersusMap = (currentMapData.type === 'versus' || currentMapData.flat);
    return true;
}

// 编辑器蓝图→地图配置转换
function convertBlueprintToMapConfig(bp) {
    const spawnEnts = (bp.entities||[]).filter(e => e.type === 'spawn');
    const spawnEnt = spawnEnts.length > 0 ? spawnEnts[spawnEnts.length - 1] : null;
    const spawn = spawnEnt ? [spawnEnt.position.x, spawnEnt.position.y, spawnEnt.position.z] : [0, 0, 0];
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
    const editorWaters = bp.waters || [];
    const pondWaters = editorWaters.filter(w => w.type === 'pond');
    const riverWaters = editorWaters.filter(w => w.type === 'river');
    const watersCfg = {};
    const terrainExtra = {};
    if (pondWaters.length > 0 || riverWaters.length > 0) {
        const firstPond = pondWaters[0];
        watersCfg.pond = { waterLevel: firstPond ? (firstPond.waterLevel ?? -1) : -1 };
        watersCfg.river = { waterLevel: -1 };
    }
    if (pondWaters.length > 0 && pondWaters[0].center) {
        const pw0 = pondWaters[0];
        terrainExtra.pond = {
            cx: pw0.center.x || 0, cz: pw0.center.z || 0,
            rx: (pw0.radius || 8), rz: (pw0.radius || 8), depth: 5
        };
    }
    const validRivers = riverWaters.filter(rw => rw.points && rw.points.length >= 2);
    if (validRivers.length > 0) {
        terrainExtra.rivers = validRivers.map(rw => {
            let wls = rw.waterLevels || null;
            if (wls && typeof wls.length !== 'number') {
                wls = Object.values(wls).map(Number);
            }
            return {
                points: rw.points.map(p => ({ x: p.x, z: p.z })),
                width: rw.width || 20,
                waterLevel: rw.waterLevel,
                waterLevels: wls
            };
        });
        const r0 = validRivers[0];
        terrainExtra.riverPoints = r0.points.map(p => ({ x: p.x, z: p.z }));
        terrainExtra.riverWidth = r0.width || 20;
        if (r0.waterLevels && r0.waterLevels.length > 0) {
            terrainExtra.riverWaterLevels = Array.from(r0.waterLevels);
            terrainExtra.riverWaterLevel = r0.waterLevel || r0.waterLevels[r0.waterLevels.length - 1];
        } else if (r0.waterLevel !== undefined) {
            terrainExtra.riverWaterLevel = r0.waterLevel;
        }
    }
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
    const editorBuildings = (bp.entities || []).filter(e => e.type === 'building').map(e => ({
        x: e.position.x, z: e.position.z, type: e.subType || 'bungalow'
    }));
    const editorTrees = (bp.entities || []).filter(e => e.type === 'tree').map(e => ({
        x: e.position.x, z: e.position.z, type: e.subType || 'cone'
    }));
    const hasEditorEntities = (editorBuildings.length > 0 || editorTrees.length > 0);
    const obstacleCount = hasEditorEntities ? 0 : 350;
    const _pw = bp.playWidth || 200;
    const _pd = bp.playDepth || 200;
    const _ww = bp.worldWidth || Math.max(300, _pw + 100);
    const _wd = bp.worldDepth || Math.max(300, _pd + 100);
    const _spawnHalfW = _pw / 2 - 2;
    const _spawnHalfD = _pd / 2 - 2;
    return {
        version: '1.0',
        name: '📝编辑器:' + bp.name,
        size: _pw,
        playWidth: _pw, playDepth: _pd,
        worldWidth: _ww, worldDepth: _wd,
        type: 'single', mode: 'combat',
        desc: '地图编辑器创建 (' + enemies.length + '个敌人)',
        spawnPoints: { p1: spawn },
        terrain: { heightmap: bp.heightmap, width: 256, rangeMin: -5, rangeMax: 5, splatMap: bp.splatMap, ...terrainExtra },
        waters: Object.keys(watersCfg).length > 0 ? watersCfg : undefined,
        bridges: bridgesCfg.length > 0 ? bridgesCfg : undefined,
        terrainTypes: { default: 'grass' },
        enemies,
        players: { lives: 3, hp: 100, cannonDamage: 40, cannonReload: 2.5, mgDamage: 2, mgFireRate: 10 },
        obstacles: { count: obstacleCount, minDist: 6, safeRadius: 10, spawnRadius: Math.min(_spawnHalfW, _spawnHalfD), buildings: editorBuildings, editorTrees, spawnHalfW: _spawnHalfW, spawnHalfD: _spawnHalfD },
        roadSystem: bp.roadSystem || null,
    };
}
