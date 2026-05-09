/**
 * 敌方单位模型 — PvE战斗系统
 * v0.26.0: 装甲突击车（近战杂兵）
 */
(function() {

    // ─── ① 装甲突击车（杂兵·近战）───
    // 外观：低矮六轮装甲车，车头V形铲斗撞角，浅棕迷彩
    // 装备：冲撞铲斗 + 炮塔顶部喷火器
    // 行为：发现玩家后直线猛冲 → 近距减速喷火 → 撞到绕圈再冲

    function createAssaultVehicle() {
        const group = new THREE.Group();

        // 材质
        const bodyMat   = new THREE.MeshStandardMaterial({ color: '#BFA470', roughness: 0.65, metalness: 0.25 });
        const darkMat   = new THREE.MeshStandardMaterial({ color: '#5C4A3A', roughness: 0.75, metalness: 0.15 });
        const wheelMat  = new THREE.MeshStandardMaterial({ color: '#252525', roughness: 0.9,  metalness: 0.05 });
        const bladeMat  = new THREE.MeshStandardMaterial({ color: '#8B8378', roughness: 0.45, metalness: 0.55 });
        const tubeMat   = new THREE.MeshStandardMaterial({ color: '#505050', roughness: 0.35, metalness: 0.75 });

        // ── 车体底盘 ──
        const chassis = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.35, 1.1), bodyMat);
        chassis.position.y = 0.435;
        chassis.castShadow = true; chassis.receiveShadow = true;
        group.add(chassis);

        // ── 车体上部装甲 ──
        const upperHull = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.3, 1.0), bodyMat);
        upperHull.position.y = 0.72;
        upperHull.castShadow = true; upperHull.receiveShadow = true;
        group.add(upperHull);

        // ── 后部上层结构（驾驶舱+引擎，移出炮塔前方避免穿模） ──
        const cabin = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.28, 0.8), darkMat);
        cabin.position.set(0.55, 0.94, 0);
        cabin.castShadow = true;
        group.add(cabin);

        const engine = new THREE.Mesh(new THREE.BoxGeometry(0.50, 0.20, 0.7), darkMat);
        engine.position.set(0.80, 0.82, 0);
        engine.castShadow = true;
        group.add(engine);

        // ── 车头观察缝（替代前方驾驶舱凸起） ──
        const visor = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.35), tubeMat);
        visor.position.set(-0.65, 0.82, 0);
        visor.castShadow = true;
        group.add(visor);

        // ── V形铲斗（车头） ──
        // 左叶片
        const bladeL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.4, 0.52), bladeMat);
        bladeL.position.set(-1.08, 0.38, 0.06);
        bladeL.rotation.z = 0.25;
        bladeL.rotation.y = 0.15;
        bladeL.castShadow = true;
        group.add(bladeL);

        // 右叶片
        const bladeR = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.4, 0.52), bladeMat);
        bladeR.position.set(-1.08, 0.38, -0.06);
        bladeR.rotation.z = 0.25;
        bladeR.rotation.y = -0.15;
        bladeR.castShadow = true;
        group.add(bladeR);

        // 铲斗底部横梁
        const crossBeam = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 1.05), bladeMat);
        crossBeam.position.set(-1.12, 0.18, 0);
        crossBeam.castShadow = true;
        group.add(crossBeam);

        // ── 轮子 ×6（两侧各3） ──
        const wheelGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.16, 14);
        const wheelPositions = [
            [-0.45, 0.2, -0.58], [ 0.30, 0.2, -0.58], [ 0.90, 0.2, -0.58],
            [-0.45, 0.2,  0.58], [ 0.30, 0.2,  0.58], [ 0.90, 0.2,  0.58]
        ];
        wheelPositions.forEach(([x, y, z]) => {
            const wheel = new THREE.Mesh(wheelGeo, wheelMat);
            wheel.rotation.x = Math.PI / 2;
            wheel.position.set(x, y, z);
            wheel.castShadow = true; wheel.receiveShadow = true;
            group.add(wheel);
            // 轮毂
            const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.18, 8), tubeMat);
            hub.rotation.x = Math.PI / 2;
            hub.position.set(x, y, z);
            group.add(hub);
        });

        // ── 炮塔旋转轴（独立于车体，AI 可旋转瞄准） ──
        const turretPivot = new THREE.Group();
        turretPivot.name = 'turretPivot';
        turretPivot.position.set(0.18, 0, 0);  // 炮塔中心偏离车体中心 0.18
        group.add(turretPivot);

        // ── 过渡基座（车体→炮塔，抬升炮塔使喷火管高出后部上层） ──
        const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.35, 0.22, 16), darkMat);
        pedestal.position.set(0, 0.98, 0);  // 底部 0.87=车体顶，顶部 1.09
        pedestal.castShadow = true;
        turretPivot.add(pedestal);

        // ── 炮塔底座（在基座之上，底面 y=1.09 = 基座顶部） ──
        const turretBase = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.35, 0.25, 16), darkMat);
        turretBase.position.set(0, 1.215, 0);  // 底部 1.09，顶部 1.34
        turretBase.castShadow = true;
        turretPivot.add(turretBase);

        // ── 炮塔顶部（半球，底部紧贴底座顶部 1.34） ──
        // 半球截断处距球心: 0.32×cos(π/3)=0.16，球心在 1.34-0.16=1.18
        const turretTop = new THREE.Mesh(
            new THREE.SphereGeometry(0.32, 16, 8, 0, Math.PI * 2, 0, Math.PI / 3),
            darkMat
        );
        turretTop.position.set(0, 1.18, 0);
        turretTop.castShadow = true;
        turretPivot.add(turretTop);

        // ── 喷火器总成（管身+喇叭口+红环，抬高到 y=1.27 高出后部上层，360°旋转无穿模） ──

        // 喷火器材质
        const flameMetal = new THREE.MeshStandardMaterial({ color: '#707C85', roughness: 0.35, metalness: 0.7 });
        const hotRingMat = new THREE.MeshStandardMaterial({ color: '#DC4530', roughness: 0.45, metalness: 0.5, emissive: '#DC4530', emissiveIntensity: 0.15 });
        const darkMouth  = new THREE.MeshStandardMaterial({ color: '#1A1A1A', roughness: 0.9, metalness: 0.0 });

        const ftY = 1.27;  // 喷火器统一高度（高出驾驶舱顶 1.08）

        // 管身
        const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.045, 1.4, 16), flameMetal);
        tube.rotation.z = Math.PI / 2;
        tube.position.set(-0.58, ftY, 0);  // 相对于 turretPivot (0.18) → 世界坐标 x=-0.4
        tube.castShadow = true;
        turretPivot.add(tube);

        // 抱箍×2
        for (const hx of [-0.30, -0.78]) {
            const hanger = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.012, 6, 16), flameMetal);
            hanger.position.set(hx, ftY, 0);
            hanger.castShadow = true;
            turretPivot.add(hanger);
        }

        // 喇叭喷嘴
        const flare = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.085, 0.12, 16), flameMetal);
        flare.rotation.z = Math.PI / 2;
        flare.position.set(-1.14, ftY, 0);  // 相对 turretPivot → 世界坐标 x=-0.96
        flare.castShadow = true;
        turretPivot.add(flare);

        // 红色加热环
        const hotRing = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.018, 8, 20), hotRingMat);
        hotRing.position.set(-1.21, ftY, 0);  // 相对 turretPivot → 世界坐标 x=-1.03
        hotRing.castShadow = true;
        turretPivot.add(hotRing);

        // 喷口黑洞
        const mouth = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.06, 12), darkMouth);
        mouth.rotation.z = Math.PI / 2;
        mouth.position.set(-1.17, ftY, 0);  // 相对 turretPivot → 世界坐标 x=-0.99
        mouth.castShadow = true;
        turretPivot.add(mouth);

        // 存储炮塔引用供 AI 使用
        group.userData.turretPivot = turretPivot;
        group.userData.flameNozzleWorld = new THREE.Vector3(-1.03, ftY, 0);  // 世界坐标喷口（相对 turretPivot → 世界需乘旋转）

        return group;
    }

    // ─── 预览工厂函数（比例适配预览场景） ───
    const ENEMY_PREVIEW_SCALE = 1.5;

    function makeAssaultVehicle() {
        const g = createAssaultVehicle();
        g.scale.setScalar(ENEMY_PREVIEW_SCALE);
        return g;
    }

    // ─── 暴露到全局 ───
    window.EnemyModels = {
        createAssaultVehicle,
    };

    // ─── 注册到 ModelRegistry（模型预览） ───
    window.ModelRegistry.register('enemies', '装甲突击车', makeAssaultVehicle);

})();
