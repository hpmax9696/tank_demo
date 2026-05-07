/**
 * 树木模型 — 锥形树、球形树
 */
(function() {
    const trunkMat = new THREE.MeshStandardMaterial({ color: '#8B5E3C', roughness: 0.9 });
    const crownMat1 = new THREE.MeshStandardMaterial({ color: '#3B7A3B', roughness: 0.8 });
    const crownMat2 = new THREE.MeshStandardMaterial({ color: '#4A8B3F', roughness: 0.8 });

    function addShadow(g) {
        g.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });
    }

    // 锥形树（固定单位高度，底面积和高度同步缩放）
    function createConicalTree() {
        const g = new THREE.Group();
        const h = 1.0;  // 基准高度，createObstacles 中统一缩放
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, h * 0.5, 6), trunkMat);
        trunk.position.y = h * 0.25;
        g.add(trunk);
        const crown = new THREE.Mesh(new THREE.ConeGeometry(0.30, h * 0.6, 8), crownMat1);
        crown.position.y = h * 0.5 + h * 0.3;
        g.add(crown);
        g.userData = { height: h, radius: 0.45, color: '#3B7A3B' };
        addShadow(g);
        return g;
    }

    // 球形树（固定单位高度，底面积和高度同步缩放）
    function createSphericalTree() {
        const g = new THREE.Group();
        const h = 1.0;  // 基准高度，createObstacles 中统一缩放
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, h * 0.45, 6), trunkMat);
        trunk.position.y = h * 0.225;
        g.add(trunk);
        const r = 0.28; // 固定半径比例
        const crown = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 6), crownMat2);
        crown.position.y = h * 0.45 + r * 0.7;
        g.add(crown);
        g.userData = { height: h, radius: 0.45, color: '#4A8B3F' };
        addShadow(g);
        return g;
    }

    // 注册
    window.ModelRegistry.register('trees', 'cone', createConicalTree, 35);
    window.ModelRegistry.register('trees', 'sphere', createSphericalTree, 35);
})();
