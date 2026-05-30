// ==================== bridges.js — 桥梁模块 ====================
// 依赖全局变量: scene, currentMapData, getTerrainHeight, riverColliders

const BRIDGE_DECK_H = 0.35, BRIDGE_SURFACE_Y = 0.175;

let bridgeGroup = null;

// ── 点到线段最短距离（2D，XZ 平面）──
function pointToSegmentDist2D(px, pz, x1, z1, x2, z2) {
    const dx = x2 - x1, dz = z2 - z1;
    const lenSq = dx * dx + dz * dz;
    if (lenSq === 0) return Math.hypot(px - x1, pz - z1);
    let t = ((px - x1) * dx + (pz - z1) * dz) / lenSq;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (x1 + dx * t), pz - (z1 + dz * t));
}

// ── 桥梁查询 ──
function _getBridge() {
    if (currentMapData && currentMapData.bridges) return currentMapData.bridges[0];
    return null;
}

function isOnBridge(x, z) {
    return getBridgeSurfaceY(x, z) !== null;
}

function isOnBridgeSurface(x, z) {
    return isOnBridge(x, z);
}

// 返回 (x,z) 处桥面的实际世界Y坐标；不在桥上则返回 null
function getBridgeSurfaceY(x, z) {
    const bridges = currentMapData && currentMapData.bridges;
    if (!bridges || bridges.length === 0) return null;
    for (const b of bridges) {
        const isEditorFormat = b.cz !== undefined || b.fromX !== undefined;
        if (isEditorFormat) {
            const bHW = b.halfW || 6;
            const dx = (b.toX||b.cx+5) - (b.fromX||b.cx-5);
            const dz = (b.toZ||b.cz) - (b.fromZ||b.cz);
            const spanLen = Math.hypot(dx, dz) + 3;
            const spanZ = Math.max(spanLen, bHW * 1.5);
            const ang = Math.atan2(dz, dx);
            const lx = (x - b.cx) * Math.cos(-ang) - (z - b.cz) * Math.sin(-ang);
            const lz = (x - b.cx) * Math.sin(-ang) + (z - b.cz) * Math.cos(-ang);
            if (Math.abs(lx) <= spanZ / 2 && Math.abs(lz) <= bHW) {
                return (b.deckY != null ? b.deckY : 0) + BRIDGE_SURFACE_Y;
            }
        } else {
            if (b.halfW == null) continue;
            if (Math.abs(x - b.cx) > b.halfW) continue;
            if (z === undefined) return BRIDGE_SURFACE_Y;
            const bz = riverCenterZ(b.cx);
            const bhwZ = riverHalfWidth(b.cx) + 0.8;
            if (Math.abs(z - bz) <= bhwZ) return BRIDGE_SURFACE_Y;
        }
    }
    return null;
}

// ==================== 桥梁创建 ====================
function createBridge() {
    const editorBridges = currentMapData && currentMapData.bridges && currentMapData.bridges.length > 0 ? currentMapData.bridges : null;
    const paramRiver = _getRiver();

    if (!paramRiver && !editorBridges) return;

    bridgeGroup = new THREE.Group();

    // 区分编辑器格式，并过滤虚空中的桥
    const clipBX = typeof worldHalfW !== 'undefined' ? worldHalfW : 150;
    const clipBZ = typeof worldHalfD !== 'undefined' ? worldHalfD : 150;
    const editorStyle = editorBridges ? editorBridges.filter(b => {
        if (b.cz === undefined && b.fromX === undefined) return false;
        // 滤除完全在地图外的桥
        const bx = b.cx || 0, bz = b.cz || 0;
        return Math.abs(bx) <= clipBX + 5 && Math.abs(bz) <= clipBZ + 5;
    }) : [];
    const hasEditorStyle = editorStyle.length > 0;

    if (hasEditorStyle) {
        editorStyle.forEach(b => {
            const bCX = b.cx, bCZ = b.cz, bHW = b.halfW || 6;
            const spanLen = Math.hypot((b.toX||bCX+5) - (b.fromX||bCX-5), (b.toZ||bCZ) - (b.fromZ||bCZ)) + 3;
            const spanZ = Math.max(spanLen, bHW * 1.5);
            const dx = (b.toX||bCX+5) - (b.fromX||bCX-5);
            const dz = (b.toZ||bCZ) - (b.fromZ||bCZ);
            const ang = Math.atan2(dz, dx);
            const matDeck = new THREE.MeshStandardMaterial({ color: '#8B7355', roughness: 0.7, metalness: 0.1 });
            const matRail = new THREE.MeshStandardMaterial({ color: '#6B5340', roughness: 0.6, metalness: 0.2 });
            const bridgeSub = new THREE.Group();
            const deck = new THREE.Mesh(new THREE.BoxGeometry(bHW * 2, BRIDGE_DECK_H, spanZ), matDeck);
            deck.position.set(0, 0, 0); deck.receiveShadow = true; deck.castShadow = true;
            bridgeSub.add(deck);
            for (const side of [-1, 1]) {
                const rx = side * (bHW - 0.25);
                const railTop = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, spanZ - 0.6), matRail);
                railTop.position.set(rx, BRIDGE_SURFACE_Y + 0.525, 0);
                railTop.receiveShadow = true; railTop.castShadow = true;
                bridgeSub.add(railTop);
            }
            const hFrom = getTerrainHeight(b.fromX || bCX-5, b.fromZ || bCZ);
            const hTo = getTerrainHeight(b.toX || bCX+5, b.toZ || bCZ);
            const bridgeY = (b.deckY != null ? b.deckY : (hFrom + hTo) / 2) + BRIDGE_SURFACE_Y;
            bridgeSub.rotation.y = Math.PI / 2 - ang;
            bridgeSub.position.set(bCX, bridgeY, bCZ);
            bridgeGroup.add(bridgeSub);
        });
        scene.add(bridgeGroup);
    }

    if (paramRiver && !hasEditorStyle) {
        // 参数化桥梁（01a 等地图）
        const b = _getBridge();
        const r = paramRiver;
        const bCX = b.cx, bHW = b.halfW;
        const bz = riverCenterZ(bCX);
        const bhw = riverHalfWidth(bCX);
        const spanZ = (bhw + 0.8) * 2;
        const matDeck = new THREE.MeshStandardMaterial({ color: '#8B7355', roughness: 0.7, metalness: 0.1 });
        const matRail = new THREE.MeshStandardMaterial({ color: '#6B5340', roughness: 0.6, metalness: 0.2 });
        const deck = new THREE.Mesh(new THREE.BoxGeometry(bHW * 2, BRIDGE_DECK_H, spanZ), matDeck);
        deck.position.set(bCX, 0, bz);
        deck.receiveShadow = true; deck.castShadow = true;
        bridgeGroup.add(deck);
        for (const side of [-1, 1]) {
            const rx = bCX + side * (bHW - 0.25);
            const railTop = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, spanZ - 0.6), matRail);
            railTop.position.set(rx, BRIDGE_SURFACE_Y + 0.525, bz);
            railTop.receiveShadow = true; railTop.castShadow = true;
            bridgeGroup.add(railTop);
            const railMid = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, spanZ - 0.6), matRail);
            railMid.position.set(rx, BRIDGE_SURFACE_Y + 0.175, bz);
            bridgeGroup.add(railMid);
            for (let pz = bz - spanZ / 2 + 0.8; pz <= bz + spanZ / 2 - 0.8; pz += 2) {
                const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.8, 0.1), matRail);
                post.position.set(rx, BRIDGE_SURFACE_Y + 0.225, pz);
                bridgeGroup.add(post);
            }
        }
        const matPier = new THREE.MeshStandardMaterial({ color: '#9B9B9B', roughness: 0.5, metalness: 0.1 });
        const rDepth = r.depth || 5;
        const pierH = rDepth + Math.abs(RIVER_WATER_LEVEL) - BRIDGE_DECK_H / 2;
        for (const pz of [bz - bhw * 0.5, bz + bhw * 0.5]) {
            for (const px of [bCX - bHW + 2, bCX + bHW - 2]) {
                const pier = new THREE.Mesh(new THREE.BoxGeometry(0.5, pierH, 0.5), matPier);
                pier.position.set(px, RIVER_WATER_LEVEL - rDepth + pierH / 2, pz);
                pier.castShadow = true; pier.receiveShadow = true;
                bridgeGroup.add(pier);
            }
        }
        bridgeGroup.name = 'bridge';
        scene.add(bridgeGroup);
    }
}

// ==================== 清理 ====================
function cleanupBridge() {
    if (bridgeGroup) {
        bridgeGroup.traverse(c => { if (c.geometry) c.geometry.dispose(); if (c.material) c.material.dispose(); });
        scene.remove(bridgeGroup);
        bridgeGroup = null;
    }
}
