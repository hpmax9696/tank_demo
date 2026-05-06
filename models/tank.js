/**
 * 坦克模型
 * 支持绿色(Green)和沙漠色(Desert)两种涂装
 */
(function() {
    const CAMO_GREEN  = { hull: '#4a5c2e', turret: '#3d4f25' };
    const CAMO_DESERT = { hull: '#8b7d4a', turret: '#6d6038' };

    function createTank(options) {
        const { camoColor = 'green', position = { x: 0, y: 0, z: 0 }, yaw = Math.PI / 2 } = options || {};
        const c = camoColor === 'desert' ? CAMO_DESERT : CAMO_GREEN;
        
        const group = new THREE.Group();

        const hullMat   = new THREE.MeshStandardMaterial({ color: c.hull, roughness: 0.6, metalness: 0.15 });
        const beltMat   = new THREE.MeshStandardMaterial({ color: '#2a2a2a', roughness: 0.9, metalness: 0.25 });
        const turretMat = new THREE.MeshStandardMaterial({ color: c.turret, roughness: 0.6, metalness: 0.2 });
        const barrelMat = new THREE.MeshStandardMaterial({ color: '#444444', roughness: 0.45, metalness: 0.55 });

        // 车体
        const hullGeo = new THREE.BoxGeometry(1.05, 0.45, 1.6);
        const hull = new THREE.Mesh(hullGeo, hullMat);
        hull.position.y = 0.225;
        hull.castShadow = true; hull.receiveShadow = true;
        group.add(hull);
        group.userData.hull = hull;

        // 履带
        const beltGeo = new THREE.BoxGeometry(0.12, 0.06, 1.55);
        const lb = new THREE.Mesh(beltGeo, beltMat); lb.position.set(-0.52, 0.04, 0); lb.castShadow = true; group.add(lb);
        const rb = new THREE.Mesh(beltGeo, beltMat); rb.position.set(0.52, 0.04, 0); rb.castShadow = true; group.add(rb);

        // 轮子（6对）
        const hubMat = new THREE.MeshStandardMaterial({ color: '#999999', roughness: 0.5, metalness: 0.5 });
        const spokeMat = new THREE.MeshStandardMaterial({ color: '#333333', roughness: 0.7, metalness: 0.2 });
        const rimMat = new THREE.MeshStandardMaterial({ color: '#555555', roughness: 0.6, metalness: 0.4 });
        const wheelZ = [-0.55, -0.35, -0.15, 0.15, 0.35, 0.55];
        const leftWheels = [], rightWheels = [];

        for (let i = 0; i < 6; i++) {
            const lwg = new THREE.Group(); lwg.position.set(-0.52, -0.08, wheelZ[i]);
            const lHub = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.07, 16), hubMat); lHub.rotation.z = Math.PI/2; lwg.add(lHub);
            for (let s = 0; s < 4; s++) { const sp = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.025, 0.04), spokeMat); sp.rotation.z = (s*Math.PI)/4; lwg.add(sp); }
            const lRim = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.018, 8, 16), rimMat); lRim.rotation.y = Math.PI/2; lwg.add(lRim);
            group.add(lwg); leftWheels.push(lwg);

            const rwg = new THREE.Group(); rwg.position.set(0.52, -0.08, wheelZ[i]);
            const rHub = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.07, 16), hubMat); rHub.rotation.z = Math.PI/2; rwg.add(rHub);
            for (let s = 0; s < 4; s++) { const sp = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.025, 0.04), spokeMat); sp.rotation.z = (s*Math.PI)/4; rwg.add(sp); }
            const rRim = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.018, 8, 16), rimMat); rRim.rotation.y = Math.PI/2; rwg.add(rRim);
            group.add(rwg); rightWheels.push(rwg);
        }

        group.userData.leftWheels = leftWheels;
        group.userData.rightWheels = rightWheels;

        // 炮塔
        const turretGeo = new THREE.CylinderGeometry(0.32, 0.36, 0.26, 24);
        const turret = new THREE.Mesh(turretGeo, turretMat); turret.position.y = 0.58; turret.castShadow = true; turret.receiveShadow = true;
        group.add(turret);

        // 炮管
        const barrelGeo = new THREE.CylinderGeometry(0.05, 0.07, 1.1, 12);
        const barrel = new THREE.Mesh(barrelGeo, barrelMat); barrel.rotation.x = -Math.PI/2; barrel.position.set(0, 0.58, 0.55); barrel.castShadow = true;
        group.add(barrel);

        // 圆形阴影
        const shGeo = new THREE.CircleGeometry(0.6, 32);
        const sh = new THREE.Mesh(shGeo, new THREE.MeshBasicMaterial({ color:'#000', transparent:true, opacity:0.3, depthWrite:false }));
        sh.rotation.x = -Math.PI/2; sh.position.y = 0.02; sh.renderOrder = 1; sh.name = 'shadow';
        group.add(sh);

        // 设置位置和朝向
        group.position.set(position.x, position.y, position.z);
        group.rotation.set(0, Math.PI / 2 - yaw, 0);

        // 添加阴影（递归遍历）
        group.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });

        return group;
    }

    // 注册到模型注册表
    window.ModelRegistry.register('tanks', 'green', (opts) => createTank({ ...opts, camoColor: 'green' }));
    window.ModelRegistry.register('tanks', 'desert', (opts) => createTank({ ...opts, camoColor: 'desert' }));
})();
