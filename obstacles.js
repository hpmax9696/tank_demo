function poissonDiskSampling(cx, cz, totalRadius, minDist, safeRadius, maxPoints, excludeFn) {
    const cellSize = minDist / Math.sqrt(2);
    const gridSize = Math.ceil(2 * totalRadius / cellSize) + 1;
    const grid = new Array(gridSize * gridSize).fill(-1);
    const points = [];
    const active = [];

    function worldToGrid(x, z) {
        const gx = Math.floor((x - cx + totalRadius) / cellSize);
        const gz = Math.floor((z - cz + totalRadius) / cellSize);
        return { gx, gz };
    }
    function gridIdx(gx, gz) {
        return gz * gridSize + gx;
    }
    function inSafeZone(x, z) {
        return (x - cx) ** 2 + (z - cz) ** 2 < safeRadius ** 2;
    }
    function inExcluded(x, z) {
        return excludeFn ? excludeFn(x, z) : false;
    }
    function inBounds(x, z) {
        return Math.abs(x - cx) < totalRadius && Math.abs(z - cz) < totalRadius;
    }
    function hasConflict(x, z, gx, gz) {
        for (let dx = -2; dx <= 2; dx++) {
            for (let dz = -2; dz <= 2; dz++) {
                const nx = gx + dx, nz = gz + dz;
                if (nx < 0 || nx >= gridSize || nz < 0 || nz >= gridSize) continue;
                const idx = grid[gridIdx(nx, nz)];
                if (idx === -1) continue;
                const p = points[idx];
                if ((x - p.x) ** 2 + (z - p.z) ** 2 < minDist ** 2) return true;
            }
        }
        return false;
    }

    let first = null;
    for (let a = 0; a < 200; a++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = safeRadius + minDist + Math.random() * (totalRadius - safeRadius - minDist);
        const tx = cx + Math.cos(angle) * dist;
        const tz = cz + Math.sin(angle) * dist;
        if (inBounds(tx, tz) && !inSafeZone(tx, tz) && !inExcluded(tx, tz)) {
            first = { x: tx, z: tz };
            break;
        }
    }
    if (!first) {
        first = { x: cx + safeRadius + minDist, z: cz };
    }

    points.push(first);
    active.push(0);
    const { gx: fgx, gz: fgz } = worldToGrid(first.x, first.z);
    grid[gridIdx(fgx, fgz)] = 0;

    while (active.length > 0 && points.length < maxPoints) {
        const ai = Math.floor(Math.random() * active.length);
        const bi = active[ai];
        const base = points[bi];
        let found = false;

        for (let k = 0; k < 30; k++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = minDist + Math.random() * minDist;
            const nx = base.x + Math.cos(angle) * dist;
            const nz = base.z + Math.sin(angle) * dist;

            if (!inBounds(nx, nz) || inSafeZone(nx, nz) || inExcluded(nx, nz)) continue;
            const { gx, gz } = worldToGrid(nx, nz);
            if (hasConflict(nx, nz, gx, gz)) continue;

            const np = { x: nx, z: nz };
            points.push(np);
            const ni = points.length - 1;
            active.push(ni);
            grid[gridIdx(gx, gz)] = ni;
            found = true;
            break;
        }
        if (!found) active.splice(ai, 1);
    }

    return points;
}

function updateObstacleVisibility(extraPositions) {
    const r2 = OBS_VISIBLE_RADIUS * OBS_VISIBLE_RADIUS;
    let bldIdx = 0;
    for (let i = 0; i < obstacleData.length; i++) {
        const o = obstacleData[i];
        if (o.type !== 'building') continue;
        let visible = false;
        const dx0 = tankState.x - o.x, dz0 = tankState.z - o.z;
        if ((dx0 * dx0 + dz0 * dz0) < r2) visible = true;
        if (!visible && extraPositions) {
            for (const ep of extraPositions) {
                const dx = ep.x - o.x, dz = ep.z - o.z;
                if ((dx * dx + dz * dz) < r2) { visible = true; break; }
            }
        }
        if (o.groupRef && o.groupRef.visible !== visible) {
            o.groupRef.visible = visible;
        }
        bldIdx++;
    }
}

function disposeTreeInstance(od) {
    if (!od.type || od.type === 'building' || od.imIndex == null) return;
    const imTrunk = od.imTrunk, imCrown = od.imCrown, idx = od.imIndex;
    const hideMat = new THREE.Matrix4().makeScale(0.001, 0.001, 0.001);
    hideMat.setPosition(0, -999, 0);
    if (imTrunk) imTrunk.setMatrixAt(idx, hideMat);
    if (imCrown) imCrown.setMatrixAt(idx, hideMat);
    if (imTrunk) imTrunk.instanceMatrix.needsUpdate = true;
    if (imCrown) imCrown.instanceMatrix.needsUpdate = true;
    od.destroyed = true;
}

function updateGrassVisibility(extraPositions) {
    if (grassInstances.length === 0) return;
    const r2 = GRASS_VISIBLE_RADIUS * GRASS_VISIBLE_RADIUS;
    for (const im of grassInstances) {
        const cx = im.userData.cx, cz = im.userData.cz;
        let visible = false;
        const dx0 = tankState.x - cx, dz0 = tankState.z - cz;
        if ((dx0 * dx0 + dz0 * dz0) < r2) visible = true;
        if (!visible && extraPositions) {
            for (const ep of extraPositions) {
                const dx = ep.x - cx, dz = ep.z - cz;
                if ((dx * dx + dz * dz) < r2) { visible = true; break; }
            }
        }
        if (im.visible !== visible) im.visible = visible;
    }
}

function createTransparentTreeGhost(od) {
    const tm = window.TreeModels && window.TreeModels[od.type];
    if (!tm) return null;
    const s = od.height / tm.baseHeight;
    const obsY = isVersusMap ? 0 : getTerrainHeight(od.x, od.z);
    const targetScene = scene;
    const group = new THREE.Group();

    const trunkGeo = tm.trunkGeo;
    const trunkMat = new THREE.MeshStandardMaterial({ color: '#8B5E3C', roughness: 0.9, transparent: true, opacity: 0.3, depthWrite: false });
    const trunkMesh = new THREE.Mesh(trunkGeo, trunkMat);
    trunkMesh.position.set(od.x, obsY + tm.trunkOffsetY * s, od.z);
    trunkMesh.scale.setScalar(s);
    trunkMesh.castShadow = false;
    trunkMesh.receiveShadow = false;
    group.add(trunkMesh);

    const crownGeo = tm.crownGeo;
    const crownColor = od.color || tm.color || '#3B7A3B';
    const crownMat = new THREE.MeshStandardMaterial({ color: crownColor, roughness: 0.8, transparent: true, opacity: 0.3, depthWrite: false });
    const crownMesh = new THREE.Mesh(crownGeo, crownMat);
    crownMesh.position.set(od.x, obsY + tm.crownOffsetY * s, od.z);
    crownMesh.scale.setScalar(s);
    crownMesh.castShadow = false;
    crownMesh.receiveShadow = false;
    group.add(crownMesh);

    targetScene.add(group);
    return group;
}

let _roadMat = null, _pathMat = null, _plazaGeo = null;

function isOnRoad(px, pz, roadAreas) {
    if (!roadAreas) return false;
    for (const a of roadAreas) {
        const dx = px - a.cx, dz = pz - a.cz;
        const cosA = Math.cos(-a.angle), sinA = Math.sin(-a.angle);
        const rx = dx * cosA - dz * sinA;
        const rz = dx * sinA + dz * cosA;
        if (Math.abs(rx) < a.rx && Math.abs(rz) < a.rz) return true;
    }
    return false;
}

function createRoadMeshes(roadSegments, villages, targetScene) {
    cleanupRoadMeshes();
    if (!_roadMat) _roadMat = new THREE.MeshStandardMaterial({ color: '#7B6B5A', roughness: 0.95, metalness: 0.0 });
    if (!_pathMat) _pathMat = new THREE.MeshStandardMaterial({ color: '#A09080', roughness: 0.9, metalness: 0.0 });

    function makeRoadMesh(x1, z1, x2, z2, width, offset, material) {
        const dx = x2 - x1, dz = z2 - z1;
        const len = Math.sqrt(dx * dx + dz * dz);
        if (len < 0.01) return null;
        const ux = dx / len, uz = dz / len;
        const px = -uz, pz = ux;
        const halfW = width / 2;

        const positions = new Float32Array(6 * 3);
        const tVals = [0, 0.5, 1];
        let idx = 0;
        for (let i = 0; i < 3; i++) {
            const wx = x1 + dx * tVals[i];
            const wz = z1 + dz * tVals[i];
            const h = getTerrainHeight(wx, wz) + offset;
            positions[idx++] = wx - px * halfW;
            positions[idx++] = h;
            positions[idx++] = wz - pz * halfW;
            positions[idx++] = wx + px * halfW;
            positions[idx++] = h;
            positions[idx++] = wz + pz * halfW;
        }
        const indices = [0, 2, 1, 1, 2, 3, 2, 4, 3, 3, 4, 5];
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geo.setIndex(indices);
        geo.computeVertexNormals();
        const mesh = new THREE.Mesh(geo, material);
        mesh.receiveShadow = true;
        mesh.userData.isRoad = true;
        return mesh;
    }

    for (const seg of roadSegments) {
        const mesh = makeRoadMesh(seg.x1, seg.z1, seg.x2, seg.z2, seg.width, 0.04, _roadMat);
        if (mesh) { targetScene.add(mesh); _roadMeshes.push(mesh); }
    }

    if (villages && villages.length > 0) {
        if (!_plazaGeo) { _plazaGeo = new THREE.CircleGeometry(1, 12); _plazaGeo._sharedCloned = true; }
        for (const vil of villages) {
            const py = getTerrainHeight(vil.plazaX, vil.plazaZ) + 0.05;
            const plaza = new THREE.Mesh(_plazaGeo, _roadMat);
            plaza.rotation.x = -Math.PI / 2;
            plaza.scale.setScalar(vil.plazaRadius);
            plaza.position.set(vil.plazaX, py, vil.plazaZ);
            plaza.receiveShadow = true;
            plaza.userData.isRoad = true;
            targetScene.add(plaza);
            _roadMeshes.push(plaza);

            for (const conn of (vil.connectors || [])) {
                const cw = conn.width || 1.2;
                const cMesh = makeRoadMesh(conn.x1, conn.z1, conn.x2, conn.z2, cw, 0.06, _pathMat);
                if (cMesh) { targetScene.add(cMesh); _roadMeshes.push(cMesh); }
            }
        }
    }
}

function cleanupRoadMeshes() {
    for (const m of _roadMeshes) {
        if (m.parent) m.parent.remove(m);
        if (m.geometry && !m.geometry._sharedCloned) m.geometry.dispose();
    }
    _roadMeshes = [];
}

function createObstacles(targetScene = scene) {
    if (window._treeIMs) {
        for (const im of window._treeIMs) {
            if (im.parent) im.parent.remove(im);
            im.geometry.dispose();
            im.material.dispose();
        }
        window._treeIMs = [];
    }
    obstacleMeshes.forEach(g => {
        if (g.isInstancedMesh) return;
        if (g.parent) g.parent.remove(g);
        g.traverse(c => { if (c.geometry) c.geometry.dispose(); if (c.material) c.material.dispose(); });
    });
    obstacleMeshes = [];
    obstacleData = [];
    occludedObstacles = [];
    hiddenTreeInstances = [];
    transparentTreeGroups.forEach(g => {
        if (g.parent) g.parent.remove(g);
        g.traverse(c => { if (c.geometry) c.geometry.dispose(); if (c.material) c.material.dispose(); });
    });
    transparentTreeGroups = [];
    for (const transpMat of transparentMatPool.values()) {
        transpMat.dispose();
    }
    transparentMatPool.clear();

    cleanupRoadMeshes();
    _villageSystem = null;

    const is02a = (selectedMapId === 'test_map_02a');
    const obsCfg = currentMapData && currentMapData.obstacles ? { ...currentMapData.obstacles } : { count: OBSTACLE_COUNT, minDist: POISSON_MIN_DIST, safeRadius: SAFE_ZONE_RADIUS, spawnRadius: SPAWN_RADIUS };
    const spawnR = obsCfg.spawnRadius || SPAWN_RADIUS;
    const roadSystem = currentMapData && currentMapData.roadSystem;
    let _roadAreas = [];
    if (roadSystem && roadSystem.roadSegments && roadSystem.roadSegments.length > 0) {
        for (const seg of roadSystem.roadSegments) {
            const len = Math.sqrt((seg.x2 - seg.x1) ** 2 + (seg.z2 - seg.z1) ** 2);
            const angle = Math.atan2(seg.z2 - seg.z1, seg.x2 - seg.x1);
            _roadAreas.push({ cx: (seg.x1 + seg.x2) / 2, cz: (seg.z1 + seg.z2) / 2, rx: len / 2 + 1, rz: seg.width / 2 + 1.5, angle });
        }
        createRoadMeshes(roadSystem.roadSegments, roadSystem.villages || [], targetScene);
        _villageSystem = { roadSegments: roadSystem.roadSegments, villages: roadSystem.villages || [], roadAreas: _roadAreas };

    } else {
        _villageSystem = null;
    }

    const roadExcludeFn = _villageSystem
        ? ((px, pz) => isOnRoad(px, pz, _villageSystem.roadAreas))
        : null;

    const points = poissonDiskSampling(0, 0, spawnR,
        obsCfg.minDist != null ? obsCfg.minDist : POISSON_MIN_DIST,
        obsCfg.safeRadius != null ? obsCfg.safeRadius : SAFE_ZONE_RADIUS,
        obsCfg.count != null ? obsCfg.count : OBSTACLE_COUNT, roadExcludeFn);

    const conePts = [], spherePts = [], oakPts = [], bldPts = [];
    for (let i = 0; i < points.length; i++) {
        const p = points[i];
        if (!isVersusMap) {
            const pond = _getPond();
            if (pond) {
                const pxPond = p.x - pond.cx, pzPond = p.z - pond.cz;
                const pondClear = pond.rx + 2.0, pondClearZ = pond.rz + 2.0;
                if (Math.sqrt((pxPond*pxPond)/(pondClear*pondClear) + (pzPond*pzPond)/(pondClearZ*pondClearZ)) < 1.0) continue;
            }
            if (isInRiver(p.x, p.z)) continue;
            const rvPts = currentMapData && currentMapData.terrain ? currentMapData.terrain.riverPoints : null;
            if (rvPts && rvPts.length >= 2) {
                const rvHw = ((currentMapData.terrain.riverWidth || 10) * 0.5) + 2;
                let inEditRiver = false;
                for (let ri = 0; ri < rvPts.length - 1; ri++) {
                    const d = pointToSegmentDist2D(p.x, p.z, rvPts[ri].x, rvPts[ri].z, rvPts[ri+1].x, rvPts[ri+1].z);
                    if (d <= rvHw) { inEditRiver = true; break; }
                }
                if (inEditRiver) continue;
            }
            if (_villageSystem && isOnRoad(p.x, p.z, _villageSystem.roadAreas)) continue;
        }
        const r = Math.random();
        if (r < 0.35) { conePts.push(p); }
        else if (r < 0.65) { spherePts.push(p); }
        else if (r < 0.85) { oakPts.push(p); }
        else { bldPts.push({ x: p.x, z: p.z }); }
    }

    const editorTrees = obsCfg.editorTrees || [];
    if (editorTrees.length > 0) {
        console.log('🌲 编辑器树木: ' + editorTrees.length + ' 棵（随机障碍物已关闭）');
        let skipped = 0;
        const treeBoundary = 150;
        for (const et of editorTrees) {
            if (Math.abs(et.x) > treeBoundary || Math.abs(et.z) > treeBoundary) { skipped++; continue; }
            const tp = { x: et.x, z: et.z };
            if (et.type === 'oak') oakPts.push(tp);
            else if (et.type === 'sphere') spherePts.push(tp);
            else conePts.push(tp);
        }
        if (skipped > 0) console.log('  ⚠️ ' + skipped + '棵超出高度图范围±150被跳过');
    }

    window._treeIMs = [];
    const dummy = new THREE.Object3D();

    if (conePts.length > 0) {
        const tm = window.TreeModels.conical;
        const trunkIM = new THREE.InstancedMesh(tm.trunkGeo, tm.trunkMat, conePts.length);
        trunkIM.castShadow = true; trunkIM.receiveShadow = true;
        const crownIM = new THREE.InstancedMesh(tm.crownGeo, tm.crownMat, conePts.length);
        crownIM.castShadow = true; crownIM.receiveShadow = true;

        for (let i = 0; i < conePts.length; i++) {
            const p = conePts[i];
            const baseHeightM = tm.baseHeight * METERS_PER_UNIT;
            const targetHeightM = tm.targetHeightMinM + Math.random() * (tm.targetHeightMaxM - tm.targetHeightMinM);
            const s = targetHeightM / baseHeightM;
            const obsY = isVersusMap ? 0 : getTerrainHeight(p.x, p.z);
            const rotY = Math.random() * Math.PI * 2;

            dummy.position.set(p.x, obsY + tm.trunkOffsetY * s, p.z);
            dummy.rotation.set(0, rotY, 0);
            dummy.scale.setScalar(s);
            dummy.updateMatrix();
            trunkIM.setMatrixAt(i, dummy.matrix);

            dummy.position.set(p.x, obsY + tm.crownOffsetY * s, p.z);
            dummy.updateMatrix();
            crownIM.setMatrixAt(i, dummy.matrix);

            obstacleData.push({
                x: p.x, z: p.z, radius: tm.radius * s, height: tm.baseHeight * s,
                color: tm.color, type: 'conical',
                imTrunk: trunkIM, imCrown: crownIM, imIndex: i
            });
        }
        trunkIM.instanceMatrix.needsUpdate = true;
        crownIM.instanceMatrix.needsUpdate = true;
        targetScene.add(trunkIM);
        targetScene.add(crownIM);
        obstacleMeshes.push(trunkIM, crownIM);
        window._treeIMs.push(trunkIM, crownIM);
    }

    if (spherePts.length > 0) {
        const tm = window.TreeModels.spherical;
        const trunkIM = new THREE.InstancedMesh(tm.trunkGeo, tm.trunkMat, spherePts.length);
        trunkIM.castShadow = true; trunkIM.receiveShadow = true;
        const crownIM = new THREE.InstancedMesh(tm.crownGeo, tm.crownMat, spherePts.length);
        crownIM.castShadow = true; crownIM.receiveShadow = true;

        for (let i = 0; i < spherePts.length; i++) {
            const p = spherePts[i];
            const baseHeightM = tm.baseHeight * METERS_PER_UNIT;
            const targetHeightM = tm.targetHeightMinM + Math.random() * (tm.targetHeightMaxM - tm.targetHeightMinM);
            const s = targetHeightM / baseHeightM;
            const obsY = isVersusMap ? 0 : getTerrainHeight(p.x, p.z);
            const rotY = Math.random() * Math.PI * 2;

            dummy.position.set(p.x, obsY + tm.trunkOffsetY * s, p.z);
            dummy.rotation.set(0, rotY, 0);
            dummy.scale.setScalar(s);
            dummy.updateMatrix();
            trunkIM.setMatrixAt(i, dummy.matrix);

            dummy.position.set(p.x, obsY + tm.crownOffsetY * s, p.z);
            dummy.updateMatrix();
            crownIM.setMatrixAt(i, dummy.matrix);

            obstacleData.push({
                x: p.x, z: p.z, radius: tm.radius * s, height: tm.baseHeight * s,
                color: tm.color, type: 'spherical',
                imTrunk: trunkIM, imCrown: crownIM, imIndex: i
            });
        }
        trunkIM.instanceMatrix.needsUpdate = true;
        crownIM.instanceMatrix.needsUpdate = true;
        targetScene.add(trunkIM);
        targetScene.add(crownIM);
        obstacleMeshes.push(trunkIM, crownIM);
        window._treeIMs.push(trunkIM, crownIM);
    }

    if (oakPts.length > 0) {
        const tm = window.TreeModels.oak;
        const trunkIM = new THREE.InstancedMesh(tm.trunkGeo, tm.trunkMat, oakPts.length);
        trunkIM.castShadow = true; trunkIM.receiveShadow = true;
        const crownIM = new THREE.InstancedMesh(tm.crownGeo, tm.crownMat, oakPts.length);
        crownIM.castShadow = true; crownIM.receiveShadow = true;

        for (let i = 0; i < oakPts.length; i++) {
            const p = oakPts[i];
            const baseHeightM = tm.baseHeight * METERS_PER_UNIT;
            const targetHeightM = tm.targetHeightMinM + Math.random() * (tm.targetHeightMaxM - tm.targetHeightMinM);
            const s = targetHeightM / baseHeightM;
            const obsY = isVersusMap ? 0 : getTerrainHeight(p.x, p.z);
            const rotY = Math.random() * Math.PI * 2;

            dummy.position.set(p.x, obsY + tm.trunkOffsetY * s, p.z);
            dummy.rotation.set(0, rotY, 0);
            dummy.scale.setScalar(s);
            dummy.updateMatrix();
            trunkIM.setMatrixAt(i, dummy.matrix);

            dummy.position.set(p.x, obsY + tm.crownOffsetY * s, p.z);
            dummy.updateMatrix();
            crownIM.setMatrixAt(i, dummy.matrix);

            obstacleData.push({
                x: p.x, z: p.z, radius: tm.radius * s, height: tm.baseHeight * s,
                color: tm.color, type: 'oak',
                imTrunk: trunkIM, imCrown: crownIM, imIndex: i
            });
        }
        trunkIM.instanceMatrix.needsUpdate = true;
        crownIM.instanceMatrix.needsUpdate = true;
        targetScene.add(trunkIM);
        targetScene.add(crownIM);
        obstacleMeshes.push(trunkIM, crownIM);
        window._treeIMs.push(trunkIM, crownIM);
    }

    let bldIdx = 0;
    const cfgBuildings = obsCfg.buildings || [];
    const villageBlds = (_villageSystem && _villageSystem.villages)
        ? _villageSystem.villages.flatMap(v => (v.buildings || []))
        : [];
    const allBlds = cfgBuildings.length > 0 ? cfgBuildings : villageBlds;

    const randomBlds = (!cfgBuildings || cfgBuildings.length === 0) && (!villageBlds || villageBlds.length === 0) ? bldPts : [];
    const effectiveBlds = allBlds.length > 0 ? allBlds : randomBlds;

    if (effectiveBlds.length > 0) {
        const bldBoundary = (cfgBuildings.length > 0) ? 150 : spawnR * 0.92;
        for (const bld of effectiveBlds) {
            if (Math.abs(bld.x) > bldBoundary || Math.abs(bld.z) > bldBoundary) continue;
            if (!isVersusMap) {
                if (isInRiver(bld.x, bld.z)) continue;
                const pond = _getPond();
                if (pond) {
                    const pxPond = bld.x - pond.cx, pzPond = bld.z - pond.cz;
                    if (Math.sqrt((pxPond * pxPond) / ((pond.rx + 3) ** 2) + (pzPond * pzPond) / ((pond.rz + 3) ** 2)) < 1.0) continue;
                }
            }
            let tooCloseToSpawn = false;
            const spawns = (currentMapData && Array.isArray(currentMapData.spawnPoints)) ? currentMapData.spawnPoints : [];
            for (const sp of spawns) {
                if ((bld.x - sp.x) ** 2 + (bld.z - sp.z) ** 2 < SAFE_ZONE_RADIUS ** 2) { tooCloseToSpawn = true; break; }
            }
            if (!spawns.length && (bld.x * bld.x + bld.z * bld.z < SAFE_ZONE_RADIUS ** 2)) tooCloseToSpawn = true;
            if (tooCloseToSpawn) continue;

            const makeFn = window.ModelRegistry.randomBuildingMaker();
            const group = makeFn();
            const ud = group.userData;
            const baseHeightM = ud.height * METERS_PER_UNIT;
            const targetHeightM = ud.targetHeightMinM + Math.random() * (ud.targetHeightMaxM - ud.targetHeightMinM);
            const s = targetHeightM / baseHeightM;
            group.scale.setScalar(s);
            const obsY = getTerrainHeight(bld.x, bld.z);
            group.position.set(bld.x, obsY, bld.z);
            group.rotation.y = (bld.angle || 0) + (Math.random() - 0.5) * 0.2;
            group.visible = false;
            group.name = `bld-${bldIdx++}`;
            targetScene.add(group);
            obstacleMeshes.push(group);
            obstacleData.push({
                x: bld.x, z: bld.z, radius: ud.radius * s, height: ud.height * s,
                color: ud.color, blades: ud.blades || null,
                type: 'building', groupRef: group
            });
        }
    }

    const totalTrees = conePts.length + spherePts.length + oakPts.length;

    if (window._obstacleGrid) {
        window._obstacleGrid.clear();
    } else {
        window._obstacleGrid = new SpatialGrid(10);
    }
    window._obstacleGrid.insertAll(obstacleData);

    updateObstacleVisibility();
    updateGrassVisibility();
}

function handleObstacleOcclusion() {
    for (const ttg of transparentTreeGroups) {
        if (ttg.parent) ttg.parent.remove(ttg);
        ttg.traverse(c => { if (c.geometry) c.geometry.dispose(); if (c.material) c.material.dispose(); });
    }
    transparentTreeGroups = [];

    for (const hti of hiddenTreeInstances) {
        hti.imTrunk.setMatrixAt(hti.index, hti.matrixTrunk);
        hti.imCrown.setMatrixAt(hti.index, hti.matrixCrown);
        hti.imTrunk.instanceMatrix.needsUpdate = true;
        hti.imCrown.instanceMatrix.needsUpdate = true;
    }
    hiddenTreeInstances = [];

    for (const obs of occludedObstacles) {
        obs.traverse(child => {
            if (child.isMesh && child.userData._origMat) {
                child.material = child.userData._origMat;
                child.userData._origMat = null;
            }
        });
    }
    occludedObstacles = [];

    const camPos = camera.position;
    const tankPos = tankGroup.position;
    const cam2x = camPos.x, cam2z = camPos.z;
    const tank2x = tankPos.x, tank2z = tankPos.z;
    const dx = tank2x - cam2x, dz = tank2z - cam2z;
    const lineLen = Math.sqrt(dx * dx + dz * dz);
    if (lineLen < 0.01) return;
    const lx = dx / lineLen, lz = dz / lineLen;

    const nearObstacles = [];
    for (let i = 0; i < obstacleMeshes.length; i++) {
        const obs = obstacleMeshes[i];
        if (!obs.visible) continue;
        const ox = obs.position.x - cam2x;
        const oz = obs.position.z - cam2z;
        const proj = ox * lx + oz * lz;
        if (proj < -2 || proj > lineLen + 2) continue;
        const perp = Math.abs(ox * lz - oz * lx);
        if (perp > 8) continue;
        nearObstacles.push(obs);
    }

    const treeIMSet = new Set();
    if (window._treeIMs && window._treeIMs.length > 0) {
        for (const od of obstacleData) {
            if (od.type === 'building') continue;
            const ox = od.x - cam2x;
            const oz = od.z - cam2z;
            const proj = ox * lx + oz * lz;
            if (proj < -2 || proj > lineLen + 2) continue;
            const perp = Math.abs(ox * lz - oz * lx);
            if (perp > 3) continue;
            if (od.imTrunk) treeIMSet.add(od.imTrunk);
            if (od.imCrown) treeIMSet.add(od.imCrown);
        }
        for (const im of treeIMSet) {
            nearObstacles.push(im);
        }
    }

    if (nearObstacles.length === 0) return;

    const dir3 = new THREE.Vector3().subVectors(tankPos, camPos).normalize();
    occluderRaycaster.set(camPos, dir3);
    occluderRaycaster.far = lineLen + 2;
    const intersects = occluderRaycaster.intersectObjects(nearObstacles, true);

    const hitRoots = new Set();
    const hitTreeIds = new Set();
    for (const hit of intersects) {
        const hitObj = hit.object;
        if (hitObj.isInstancedMesh) {
            const iid = hit.instanceId;
            hitTreeIds.add(JSON.stringify([iid, hitObj.uuid]));
        } else {
            let obj = hitObj;
            while (obj && !obstacleMeshes.includes(obj)) {
                obj = obj.parent;
            }
            if (obj) hitRoots.add(obj);
        }
    }

    for (const obs of hitRoots) {
        occludedObstacles.push(obs);
        obs.traverse(child => {
            if (child.isMesh && child.material && !child.userData._origMat) {
                child.userData._origMat = child.material;
                const origMat = child.material;
                let transpMat = transparentMatPool.get(origMat);
                if (!transpMat) {
                    transpMat = origMat.clone();
                    transpMat.transparent = true;
                    transpMat.opacity = 0.3;
                    transpMat.needsUpdate = true;
                    transparentMatPool.set(origMat, transpMat);
                }
                child.material = transpMat;
            }
        });
    }

    if (hitTreeIds.size > 0) {
        for (const od of obstacleData) {
            if (od.type === 'building') continue;
            if (!od.imTrunk || !od.imCrown || od.imIndex == null) continue;
            const key = JSON.stringify([od.imIndex, od.imTrunk.uuid]);
            const key2 = JSON.stringify([od.imIndex, od.imCrown.uuid]);
            if (hitTreeIds.has(key) || hitTreeIds.has(key2)) {
                const mT = new THREE.Matrix4();
                const mC = new THREE.Matrix4();
                od.imTrunk.getMatrixAt(od.imIndex, mT);
                od.imCrown.getMatrixAt(od.imIndex, mC);
                hiddenTreeInstances.push({
                    imTrunk: od.imTrunk, imCrown: od.imCrown,
                    index: od.imIndex,
                    matrixTrunk: mT.clone(),
                    matrixCrown: mC.clone()
                });
                disposeTreeInstance(od);
                const ghost = createTransparentTreeGhost(od);
                if (ghost) transparentTreeGroups.push(ghost);
            }
        }
    }
}
