// ==================== debugcolliders.js — 碰撞体可视化（从运行时数据反向生成） ====================
// 依赖: riverColliders[], currentMapData.bridges, scene
// F3 切换可视化（在 index.html 主键盘事件中调用 debugToggleColliders）

var _debugMeshes = [];
var _debugVisible = true;

function _debugDisposeAll() {
    for (var i = 0; i < _debugMeshes.length; i++) {
        var m = _debugMeshes[i];
        if (m.parent) m.parent.remove(m);
        if (m.geometry) m.geometry.dispose();
        if (m.material) m.material.dispose();
    }
    _debugMeshes.length = 0;
}

function debugRefreshColliders() {
    _debugDisposeAll();
    if (!_debugVisible) return;

    var ringMat = new THREE.MeshBasicMaterial({ color: 0xff3333, transparent: true, opacity: 0.5, depthTest: false, depthWrite: false });
    var railMat = new THREE.MeshBasicMaterial({ color: 0xff4444, transparent: true, opacity: 0.45, depthTest: false, depthWrite: false });
    var deckMat = new THREE.MeshBasicMaterial({ color: 0x4488ff, transparent: true, opacity: 0.15, side: THREE.DoubleSide, depthTest: false, depthWrite: false });

    var riverCount = 0, bridgeCount = 0;

    // ── 河流碰撞体 ──
    if (typeof riverColliders !== 'undefined' && riverColliders.length > 0) {
        for (var ri = 0; ri < riverColliders.length; ri++) {
            var rc = riverColliders[ri];
            var ring = new THREE.Mesh(new THREE.TorusGeometry(rc.radius, 0.3, 8, 20), ringMat);
            ring.rotation.x = -Math.PI / 2;
            ring.position.set(rc.x, 1.5, rc.z);
            ring.renderOrder = 999;
            ring.material.depthTest = false;
            ring.material.depthWrite = false;
            if (typeof scene !== 'undefined' && scene) scene.add(ring);
            _debugMeshes.push(ring);
            riverCount++;
        }
    }

    // ── 桥梁碰撞 ──
    var bridges = typeof currentMapData !== 'undefined' && currentMapData ? currentMapData.bridges : null;
    if (bridges && bridges.length > 0) {
        for (var bi = 0; bi < bridges.length; bi++) {
            var b = bridges[bi];
            var isEditor = b.cz !== undefined || b.fromX !== undefined;
            if (isEditor) {
                var bHW = b.halfW || 6;
                var ddx = (b.toX||b.cx+5) - (b.fromX||b.cx-5);
                var ddz = (b.toZ||b.cz) - (b.fromZ||b.cz);
                var spanLen = Math.hypot(ddx, ddz) + 3;
                var spanZ = Math.max(spanLen, bHW * 1.5);
                var ang = Math.atan2(ddz, ddx);
                var bSurfY = typeof BRIDGE_SURFACE_Y !== 'undefined' ? BRIDGE_SURFACE_Y : 0.175;
                var bridgeY = (b.deckY != null ? b.deckY : 0) + bSurfY;
                // 桥面半透明板
                var deckVis = new THREE.Mesh(new THREE.PlaneGeometry(bHW * 2, spanZ), deckMat);
                deckVis.rotation.x = -Math.PI / 2;
                deckVis.rotation.y = Math.PI / 2 - ang;
                deckVis.position.set(b.cx, bridgeY + 0.2, b.cz);
                deckVis.renderOrder = 998;
                deckVis.material.depthTest = false;
                if (typeof scene !== 'undefined' && scene) scene.add(deckVis);
                _debugMeshes.push(deckVis);
                // 栏杆碰撞边界
                for (var side = 0; side < 2; side++) {
                    var rlx = (side === 0 ? -1 : 1) * (bHW - 0.25);
                    var bar = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.6, spanZ * 0.95), railMat);
                    bar.position.set(
                        b.cx + rlx * Math.sin(ang),
                        bridgeY + 0.7,
                        b.cz - rlx * Math.cos(ang)
                    );
                    bar.rotation.y = Math.PI / 2 - ang;
                    bar.renderOrder = 999;
                    bar.material.depthTest = false;
                    if (typeof scene !== 'undefined' && scene) scene.add(bar);
                    _debugMeshes.push(bar);
                }
                bridgeCount++;
            } else {
                var bHW2 = b.halfW || 4;
                if (typeof riverCenterZ === 'undefined' || typeof riverHalfWidth === 'undefined') continue;
                var bz = riverCenterZ(b.cx);
                var bhw = riverHalfWidth(b.cx);
                var spanZ2 = (bhw + 0.8) * 2;
                var bSurfY2 = typeof BRIDGE_SURFACE_Y !== 'undefined' ? BRIDGE_SURFACE_Y : 0.175;
                var deckVis2 = new THREE.Mesh(new THREE.PlaneGeometry(bHW2 * 2, spanZ2), deckMat);
                deckVis2.rotation.x = -Math.PI / 2;
                deckVis2.position.set(b.cx, bSurfY2 + 0.2, bz);
                deckVis2.renderOrder = 998;
                deckVis2.material.depthTest = false;
                if (typeof scene !== 'undefined' && scene) scene.add(deckVis2);
                _debugMeshes.push(deckVis2);
                for (var side2 = 0; side2 < 2; side2++) {
                    var rx2 = b.cx + (side2 === 0 ? -1 : 1) * (bHW2 - 0.25);
                    var bar2 = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.6, spanZ2 * 0.95), railMat);
                    bar2.position.set(rx2, bSurfY2 + 0.7, bz);
                    bar2.renderOrder = 999;
                    bar2.material.depthTest = false;
                    if (typeof scene !== 'undefined' && scene) scene.add(bar2);
                    _debugMeshes.push(bar2);
                }
                bridgeCount++;
            }
        }
    }

    console.log('🔍 碰撞体可视化已刷新: ' + riverCount + ' 河流环 + ' + bridgeCount + ' 桥梁 (共' + _debugMeshes.length + '个mesh)');
}

function debugToggleColliders() {
    _debugVisible = !_debugVisible;
    for (var i = 0; i < _debugMeshes.length; i++) {
        _debugMeshes[i].visible = _debugVisible;
    }
    console.log('🔍 碰撞体可视化:', _debugVisible ? '开启' : '关闭');
    if (_debugVisible && _debugMeshes.length === 0) debugRefreshColliders();
}
