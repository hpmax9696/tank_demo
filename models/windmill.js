/**
 * 风车磨坊模型
 * 4片叶片围绕轴心旋转，使用 PlaneGeometry 扁平叶片
 */
(function() {
    const windmillBodyMat  = new THREE.MeshStandardMaterial({ color: '#D2B48C', roughness: 0.8 });
    const windmillBladeMat = new THREE.MeshStandardMaterial({ color: '#DEB887', roughness: 0.7, side: THREE.DoubleSide });
    const roofMat          = new THREE.MeshStandardMaterial({ color: '#8B4513', roughness: 0.85 });

    function addShadow(g) {
        g.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });
    }

    function createWindmill() {
        const g = new THREE.Group();
        const h = 1.0 + Math.random() * 0.5;

        // 磨坊主体
        const body = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, h, 8), windmillBodyMat);
        body.position.y = h / 2;
        g.add(body);

        // 锥形屋顶
        const roof = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.35, 8), roofMat);
        roof.position.y = h + 0.15;
        g.add(roof);

        // 风车叶片组（4片扁平叶片，十字形从轴心向外）
        const bladeGroup = new THREE.Group();
        bladeGroup.position.y = h + 0.35;
        const bladeLen = 0.85;
        const bladeWid = 0.18;
        for (let i = 0; i < 4; i++) {
            const bladeGeo = new THREE.PlaneGeometry(bladeWid, bladeLen);
            const blade = new THREE.Mesh(bladeGeo, windmillBladeMat);
            const angle = (i * Math.PI) / 2;
            blade.rotation.z = angle;
            // 沿叶片长度方向偏移半长，使叶片一端在bladeGroup原点（轴心）
            blade.position.x = Math.cos(angle) * (bladeLen / 2);
            blade.position.y = Math.sin(angle) * (bladeLen / 2);
            bladeGroup.add(blade);
        }
        bladeGroup.name = 'blades';
        g.add(bladeGroup);

        g.userData = { height: h + 0.7, radius: 0.5, color: '#D2B48C', blades: bladeGroup };
        addShadow(g);
        return g;
    }

    // 注册
    window.ModelRegistry.register('special', 'windmill', createWindmill, 3);
})();
