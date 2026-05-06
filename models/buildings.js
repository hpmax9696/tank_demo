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

    // 平房（精细化：山墙屋顶+窗户+门+烟囱）
    function createBungalow() {
        const g = new THREE.Group();
        const h = 0.6 + Math.random() * 0.2;
        const w = 0.8 + Math.random() * 0.2;
        const d = 0.65 + Math.random() * 0.15;
        const wallColors = ['#E8D5B7','#D4C5A9','#F0DCC0','#C9B896'];
        const wallM = new THREE.MeshStandardMaterial({ color: wallColors[Math.floor(Math.random()*4)], roughness:0.85 });
        const roofM = new THREE.MeshStandardMaterial({ color: '#A0522D', roughness: 0.8 });
        const trimM = new THREE.MeshStandardMaterial({ color: '#C4956A', roughness: 0.7 });
        const winM  = new THREE.MeshStandardMaterial({ color:'#AACCFF', emissive:'#224466', emissiveIntensity:0.1 });
        const doorM = new THREE.MeshStandardMaterial({ color:'#5C3317', roughness:0.6 });

        // 主体
        const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallM);
        body.position.y = h / 2;
        g.add(body);

        // 山墙屋顶（三角形沿Z拉伸）
        const rH = 0.32, oH = 0.04; // 屋顶高度、屋檐出挑
        const shp = new THREE.Shape();
        const hw = w / 2 + oH;
        shp.moveTo(-hw, 0); shp.lineTo(0, rH); shp.lineTo(hw, 0); shp.closePath();
        const roofMsh = new THREE.Mesh(
            new THREE.ExtrudeGeometry(shp, { depth: d + oH*2, bevelEnabled: false }),
            roofM
        );
        roofMsh.position.set(0, h, -(d + oH*2) / 2 + d / 2);
        g.add(roofMsh);

        // 窗户（正面+背面2排）
        for (let side = -1; side <= 1; side += 2) {
            for (let wi = -1; wi <= 1; wi += 2) {
                const win = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 0.1), winM);
                win.position.set(wi * w * 0.25, h * 0.55, side * (d / 2 + 0.001));
                g.add(win);
                // 窗框
                const frm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, 0.005), trimM);
                frm.position.set(wi * w * 0.25, h * 0.55, side * (d / 2 + 0.002));
                g.add(frm);
            }
        }

        // 门（正面中心）
        const door = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.28, 0.01), doorM);
        door.position.set(0, 0.14, d / 2 + 0.003);
        g.add(door);
        // 门框
        const drFrm = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.32, 0.008), trimM);
        drFrm.position.set(0, 0.16, d / 2 + 0.002);
        g.add(drFrm);

        // 烟囱
        const chm = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.18, 0.06), trimM);
        chm.position.set(w * 0.28, h + rH * 0.55, d * 0.15);
        g.add(chm);
        const chmTop = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.03, 0.09), trimM);
        chmTop.position.set(w * 0.28, h + rH * 0.55 + 0.09, d * 0.15);
        g.add(chmTop);

        g.userData = { height: h + rH, radius: Math.max(w, d) / 2 * 1.15, color: '#' + wallM.color.getHexString() };
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
