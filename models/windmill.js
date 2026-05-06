/**
 * 风车磨坊模型
 * 2根长条形穿过轴心形成 + 字，使用 BoxGeometry(0.02厚度) 保证侧面可见
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

        // 连接轴（从屋顶侧面伸出）
        const axleMat = new THREE.MeshStandardMaterial({ color: '#8B6914', roughness: 0.7 });
        const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.04, 0.22, 6), axleMat);
        axle.rotation.z = Math.PI / 2;
        axle.position.set(0.28, h + 0.22, 0);
        g.add(axle);

        // 风车叶片组（2根长条交叉穿过轴心，在磨坊侧面旋转）
        const bladeGroup = new THREE.Group();
        bladeGroup.position.set(0.41, h + 0.22, 0);
        const bladeLen = 0.85;
        const bladeWid = 0.18;
        for (let i = 0; i < 2; i++) {
            const bladeGeo = new THREE.BoxGeometry(bladeWid, bladeLen * 2, 0.02);
            const blade = new THREE.Mesh(bladeGeo, windmillBladeMat);
            blade.rotation.z = (i * Math.PI) / 2;
            blade.position.set(0, 0, 0);
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
