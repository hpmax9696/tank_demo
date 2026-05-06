/**
 * 建筑模型 — 平房、别墅、公寓
 */
(function() {
    const wallMat = new THREE.MeshStandardMaterial({ color: '#D4C5A9', roughness: 0.9 });
    const roofMat = new THREE.MeshStandardMaterial({ color: '#8B4513', roughness: 0.85 });
    const aptMat  = new THREE.MeshStandardMaterial({ color: '#C0C0C0', roughness: 0.7 });

    function addShadow(g) {
        g.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });
    }

    // 平房
    function createBungalow() {
        const g = new THREE.Group();
        const h = 0.8 + Math.random() * 0.3;
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.9 + Math.random()*0.3, h, 0.7 + Math.random()*0.3), wallMat);
        body.position.y = h / 2;
        g.add(body);
        const roof = new THREE.Mesh(new THREE.ConeGeometry(0.65, 0.35, 4), roofMat);
        roof.position.y = h + 0.15;
        roof.rotation.y = Math.PI / 4;
        g.add(roof);
        g.userData = { height: h + 0.35, radius: 0.55, color: '#D4C5A9' };
        addShadow(g);
        return g;
    }

    // 别墅
    function createVilla() {
        const g = new THREE.Group();
        const h = 1.2 + Math.random() * 0.4;
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.85, h, 0.75), wallMat);
        body.position.y = h / 2;
        g.add(body);
        const roof = new THREE.Mesh(new THREE.ConeGeometry(0.55, 0.45, 4), roofMat);
        roof.position.y = h + 0.2;
        roof.rotation.y = Math.PI / 4;
        g.add(roof);
        // 窗户
        for (let wy = 0.35; wy < h; wy += 0.4) {
            const win = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.16), new THREE.MeshBasicMaterial({ color: '#8899cc' }));
            win.position.set(0.43, wy, 0);
            g.add(win);
        }
        g.userData = { height: h + 0.45, radius: 0.55, color: '#D4C5A9' };
        addShadow(g);
        return g;
    }

    // 公寓
    function createApartment() {
        const g = new THREE.Group();
        const h = 1.6 + Math.random() * 0.5;
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.75, h, 0.75), aptMat);
        body.position.y = h / 2;
        g.add(body);
        const winMat = new THREE.MeshBasicMaterial({ color: '#aaccff' });
        for (let wy = 0.3; wy < h; wy += 0.3) {
            for (let wx = -0.2; wx <= 0.2; wx += 0.2) {
                const win = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 0.12), winMat);
                win.position.set(wx, wy, 0.38);
                g.add(win);
            }
        }
        g.userData = { height: h, radius: 0.55, color: '#C0C0C0' };
        addShadow(g);
        return g;
    }

    // 注册
    window.ModelRegistry.register('buildings', 'bungalow', createBungalow, 10);
    window.ModelRegistry.register('buildings', 'villa', createVilla, 10);
    window.ModelRegistry.register('buildings', 'apartment', createApartment, 7);
})();
