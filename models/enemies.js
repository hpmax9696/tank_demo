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

    // ─── ② 丧尸（近战杂兵·步行单位）───
    // 参考图：低多边形风格，破旧青绿色夹克，背部/前胸肋骨外露，
    // 灰色长裤带血迹，灰白皮肤，头部低垂，双臂前伸蹒跚行走
    function makeZombie() {
        const group = new THREE.Group();

        // 材质
        const skinMat   = new THREE.MeshStandardMaterial({ color: 0xbcb8a8, roughness: 0.9 });
        const jacketMat = new THREE.MeshStandardMaterial({ color: 0x4a7a6a, roughness: 0.85 }); // 青绿色夹克
        const pantsMat  = new THREE.MeshStandardMaterial({ color: 0x60686e, roughness: 0.95 }); // 灰裤
        const boneMat   = new THREE.MeshStandardMaterial({ color: 0xd0c4b0, roughness: 0.8 });
        const bloodMat  = new THREE.MeshStandardMaterial({ color: 0x7a1a1a, roughness: 0.9 });
        const darkMat   = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9 });
        const eyeMat    = new THREE.MeshStandardMaterial({ color: 0x8a2a2a, roughness: 0.3, emissive: 0x4a0000, emissiveIntensity: 0.3 });
        const toothMat  = new THREE.MeshStandardMaterial({ color: 0xddd8cc, roughness: 0.6 });

        // ── 腿（灰裤+赤脚）──
        // 左腿
        const legL = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.22, 6), pantsMat);
        legL.position.set(-0.07, 0.14, 0);
        legL.castShadow = true;
        group.add(legL);
        // 左膝血迹
        const bloodKneeL = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.03, 0.01), bloodMat);
        bloodKneeL.position.set(-0.05, 0.12, 0.06);
        group.add(bloodKneeL);
        // 左脚
        const footL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.03, 0.10), skinMat);
        footL.position.set(-0.07, 0.015, 0.04);
        footL.castShadow = true;
        group.add(footL);

        // 右腿
        const legR = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.22, 6), pantsMat);
        legR.position.set(0.07, 0.14, 0);
        legR.castShadow = true;
        group.add(legR);
        // 右小腿血迹
        const bloodShinR = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.05, 0.01), bloodMat);
        bloodShinR.position.set(0.09, 0.06, 0.05);
        group.add(bloodShinR);
        // 右脚
        const footR = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.03, 0.10), skinMat);
        footR.position.set(0.07, 0.015, 0.04);
        footR.castShadow = true;
        group.add(footR);

        // ── 臀部/骨盆（过渡躯干与腿）──
        const hip = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.10, 6), pantsMat);
        hip.position.set(0, 0.28, 0);
        hip.castShadow = true;
        group.add(hip);

        // ── 腹部（裸露皮肤，低多边形）──
        const belly = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.14, 0.09), skinMat);
        belly.position.set(0, 0.42, 0.02);
        belly.castShadow = true;
        group.add(belly);

        // ── 夹克衫 ──
        // 设计：敞开式夹克，前胸大面积裂开露出肋骨，背后也有破洞
        //
        // 夹克后片（完整背部，中间有破洞）
        const jacketBack = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.28, 0.05), jacketMat);
        jacketBack.position.set(0, 0.60, -0.08);
        jacketBack.castShadow = true;
        group.add(jacketBack);
        // 背部破洞内衬（露出肋骨区域）
        const backHole = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.14, 0.01), skinMat);
        backHole.position.set(0, 0.60, -0.055);
        group.add(backHole);

        // 夹克左前片（敞开，露出左侧肋骨）
        const jacketLeft = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.28, 0.05), jacketMat);
        jacketLeft.position.set(-0.14, 0.60, 0.02);
        jacketLeft.rotation.z = 0.06;
        jacketLeft.castShadow = true;
        group.add(jacketLeft);

        // 夹克右前片（敞开）
        const jacketRight = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.28, 0.05), jacketMat);
        jacketRight.position.set(0.14, 0.60, 0.02);
        jacketRight.rotation.z = -0.06;
        jacketRight.castShadow = true;
        group.add(jacketRight);

        // 夹克前片破边（下摆撕裂状，左）
        const tearL = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.08, 0.04), jacketMat);
        tearL.position.set(-0.08, 0.44, 0.08);
        tearL.rotation.x = -0.4;
        group.add(tearL);

        // 夹克前片破边（右）
        const tearR = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.06, 0.04), jacketMat);
        tearR.position.set(0.06, 0.46, 0.08);
        tearR.rotation.x = 0.3;
        group.add(tearR);

        // 夹克左袖（残破）
        const sleeveL = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.14, 6), jacketMat);
        sleeveL.position.set(-0.18, 0.68, 0.06);
        sleeveL.rotation.z = 0.3;
        sleeveL.rotation.x = -0.2;
        sleeveL.castShadow = true;
        group.add(sleeveL);

        // 夹克右袖
        const sleeveR = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.14, 6), jacketMat);
        sleeveR.position.set(0.18, 0.68, 0.06);
        sleeveR.rotation.z = -0.3;
        sleeveR.rotation.x = -0.2;
        sleeveR.castShadow = true;
        group.add(sleeveR);

        // 夹克上血迹（前胸）
        const bloodJacket1 = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.06, 0.01), bloodMat);
        bloodJacket1.position.set(-0.10, 0.66, 0.07);
        group.add(bloodJacket1);
        const bloodJacket2 = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.04, 0.01), bloodMat);
        bloodJacket2.position.set(0.12, 0.64, 0.07);
        group.add(bloodJacket2);

        // ── 肋骨（从夹克破洞中露出）──
        // 正面左侧肋骨
        const ribGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.10, 5);
        for (let i = 0; i < 3; i++) {
            const rib = new THREE.Mesh(ribGeo, boneMat);
            rib.position.set(-0.09, 0.64 - i * 0.06, 0.07);
            rib.rotation.z = 0.2;
            group.add(rib);
        }
        // 正面右侧肋骨
        for (let i = 0; i < 3; i++) {
            const rib = new THREE.Mesh(ribGeo, boneMat);
            rib.position.set(0.09, 0.64 - i * 0.06, 0.07);
            rib.rotation.z = -0.2;
            group.add(rib);
        }

        // ── 脊椎/锁骨（从背部破洞露出）──
        // 脊柱凸起（背部中间一排）
        const spineGeo = new THREE.CylinderGeometry(0.01, 0.01, 0.06, 4);
        for (let i = 0; i < 4; i++) {
            const spine = new THREE.Mesh(spineGeo, boneMat);
            spine.position.set(0, 0.70 - i * 0.05, -0.055);
            spine.rotation.x = 0.1;
            group.add(spine);
        }

        // ── 肩部（锁骨凸起）──
        const shoulderL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.025, 0.03), boneMat);
        shoulderL.position.set(-0.14, 0.78, 0);
        shoulderL.rotation.z = -0.25;
        group.add(shoulderL);
        const shoulderR = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.025, 0.03), boneMat);
        shoulderR.position.set(0.14, 0.78, 0);
        shoulderR.rotation.z = 0.25;
        group.add(shoulderR);

        // ── 脖子（短粗）──
        const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.06, 0.04, 6), skinMat);
        neck.position.set(0, 0.84, 0);
        neck.castShadow = true;
        group.add(neck);

        // ── 头部（低垂，前倾）──
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.10, 10, 9), skinMat);
        head.position.set(0, 0.91, -0.01);
        head.scale.set(0.95, 1.05, 0.95);
        head.rotation.x = 0.25; // 低垂
        head.castShadow = true;
        group.add(head);

        // 下颌（突出，嘴张开）
        const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.03, 0.05), skinMat);
        jaw.position.set(0, 0.87, -0.08);
        jaw.rotation.x = 0.15;
        jaw.castShadow = true;
        group.add(jaw);

        // 上牙
        const teethUpper = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.008, 0.02), toothMat);
        teethUpper.position.set(0, 0.88, -0.09);
        group.add(teethUpper);
        // 下牙
        const teethLower = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.008, 0.02), toothMat);
        teethLower.position.set(0, 0.86, -0.09);
        group.add(teethLower);

        // 太阳穴凹陷（用深色圆片）
        const templeGeo = new THREE.RingGeometry(0.015, 0.025, 6);
        const templeL = new THREE.Mesh(templeGeo, darkMat);
        templeL.position.set(-0.09, 0.93, -0.03);
        templeL.rotation.y = Math.PI / 2;
        group.add(templeL);
        const templeR = new THREE.Mesh(templeGeo, darkMat);
        templeR.position.set(0.09, 0.93, -0.03);
        templeR.rotation.y = Math.PI / 2;
        group.add(templeR);

        // 眼眶（深陷）
        const socketGeo = new THREE.RingGeometry(0.01, 0.03, 6);
        const socketL = new THREE.Mesh(socketGeo, darkMat);
        socketL.position.set(-0.04, 0.93, -0.08);
        socketL.rotation.y = Math.PI;
        group.add(socketL);
        const socketR = new THREE.Mesh(socketGeo, darkMat);
        socketR.position.set(0.04, 0.93, -0.08);
        socketR.rotation.y = Math.PI;
        group.add(socketR);

        // 眼球（发红微光）
        const eyeGeo = new THREE.SphereGeometry(0.018, 6, 5);
        const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
        eyeL.position.set(-0.04, 0.925, -0.06);
        group.add(eyeL);
        const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
        eyeR.position.set(0.04, 0.925, -0.06);
        group.add(eyeR);

        // 头部血迹（从嘴巴延伸）
        const mouthBlood = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.03, 0.01), bloodMat);
        mouthBlood.position.set(0.03, 0.865, -0.08);
        mouthBlood.rotation.z = 0.2;
        group.add(mouthBlood);
        const mouthBlood2 = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.01), bloodMat);
        mouthBlood2.position.set(-0.025, 0.87, -0.08);
        mouthBlood2.rotation.z = -0.15;
        group.add(mouthBlood2);

        // ── 手臂（前伸，蹒跚姿态）──
        const armGeo = new THREE.CylinderGeometry(0.022, 0.028, 0.32, 6);
        // 左上臂（袖子遮盖部分）
        const upperArmL = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.032, 0.10, 6), jacketMat);
        upperArmL.position.set(-0.20, 0.72, 0.08);
        upperArmL.rotation.z = 0.35;
        upperArmL.rotation.x = -0.3;
        upperArmL.castShadow = true;
        group.add(upperArmL);
        // 左前臂（裸露）
        const forearmL = new THREE.Mesh(armGeo, skinMat);
        forearmL.position.set(-0.30, 0.56, 0.20);
        forearmL.rotation.z = 0.25;
        forearmL.rotation.x = -0.8;
        forearmL.castShadow = true;
        group.add(forearmL);
        // 左手
        const handL = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.035, 0.06), skinMat);
        handL.position.set(-0.38, 0.44, 0.32);
        handL.rotation.x = -0.2;
        group.add(handL);
        // 左手指（3爪）
        for (let fi = 0; fi < 3; fi++) {
            const finger = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.015, 0.04), skinMat);
            finger.position.set(-0.38 + (fi - 1) * 0.018, 0.43, 0.37);
            group.add(finger);
        }

        // 右上臂（袖子遮盖）
        const upperArmR = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.032, 0.10, 6), jacketMat);
        upperArmR.position.set(0.20, 0.72, 0.08);
        upperArmR.rotation.z = -0.35;
        upperArmR.rotation.x = -0.3;
        upperArmR.castShadow = true;
        group.add(upperArmR);
        // 右前臂
        const forearmR = new THREE.Mesh(armGeo, skinMat);
        forearmR.position.set(0.30, 0.56, 0.20);
        forearmR.rotation.z = -0.25;
        forearmR.rotation.x = -0.8;
        forearmR.castShadow = true;
        group.add(forearmR);
        // 右手
        const handR = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.035, 0.06), skinMat);
        handR.position.set(0.38, 0.44, 0.32);
        handR.rotation.x = -0.2;
        group.add(handR);
        // 右手指（3爪）
        for (let fi = 0; fi < 3; fi++) {
            const finger = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.015, 0.04), skinMat);
            finger.position.set(0.38 + (fi - 1) * 0.018, 0.43, 0.37);
            group.add(finger);
        }

        // 手臂血迹（从袖子延伸）
        const armBloodL = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.03, 0.015), bloodMat);
        armBloodL.position.set(-0.26, 0.62, 0.22);
        group.add(armBloodL);
        const armBloodR = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.025, 0.015), bloodMat);
        armBloodR.position.set(0.26, 0.63, 0.22);
        group.add(armBloodR);

        // 元数据
        group.userData = {
            enemyType: 'zombie',
            hp: 40,
            speed: 2.5,
            damage: 10,
            score: 50
        };

        return group;
    }

    // ─── 暴露到全局 ───
    window.EnemyModels = {
        createAssaultVehicle,
        createZombie: makeZombie,
    };

    // ─── 注册到 ModelRegistry（模型预览） ───
    window.ModelRegistry.register('enemies', '装甲突击车', makeAssaultVehicle);
    window.ModelRegistry.register('enemies', '丧尸', makeZombie);

    console.log('🧟 敌方单位模型已就绪 | 装甲突击车 + 丧尸');

})();
