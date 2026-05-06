/**
 * T-34-85 后期型 (Model 1944) — v5 精确修正版
 *
 * 基于截图对比技术图纸，修正比例与形状：
 *   1. 炮塔：扁宽六角形，侧面陡直不内斜太多，顶盖扁平
 *   2. 防盾：扁平梯形铸造件（非球体）
 *   3. 车体：ExtrudeGeometry 挤出真正60°首上倾斜剖面
 *   4. 翼子板：薄板
 *   5. 指挥塔：后部居中的小型圆柱
 */
(function() {
    const CAMO = {
        green: {
            hull: '#4a5c2e', turret: '#3d4f25', track: '#2a2a2a',
            wheel: '#555555', hub: '#888888', barrel: '#444444',
            mantlet: '#383838', rim: '#3a3a3a', fender: '#3d4f25',
            fuelTank: '#4a5c2e', toolBox: '#3d4f25'
        },
        desert: {
            hull: '#8b7d4a', turret: '#6d6038', track: '#3a3525',
            wheel: '#6d6d55', hub: '#999980', barrel: '#555544',
            mantlet: '#4a4a3a', rim: '#5a5a45', fender: '#6d6038',
            fuelTank: '#8b7d4a', toolBox: '#6d6038'
        }
    };

    // ─── 常量 ───
    const HULL_W     = 0.94;     // 车体宽度
    const HULL_L     = 1.72;     // 车体长度 (z)
    const HULL_HI    = 0.55;     // 车体顶部 Y
    const HULL_LO    = 0.22;     // 车体底部 Y
    const HULL_H     = HULL_HI - HULL_LO;

    // 60° 首上装甲
    const GLACIS_DZ  = 0.50;
    const FRONT_Z    = HULL_L / 2;
    const GLACIS_TOP_Z = FRONT_Z - GLACIS_DZ;

    const WL_R       = 0.14;     // 负重轮半径
    const WL_W       = 0.055;    // 负重轮宽度
    const IDLER_R    = 0.10;     // 诱导轮半径
    const SPROCKET_R = 0.18;     // 主动轮半径
    const SPROCKET_Y = 0.26;     // 主动轮 Y
    const WHEEL_X    = 0.52;     // 车轮 X

    const TURRET_BASE_Y = HULL_HI;

    function createT34_85(options) {
        const { camoColor = 'green' } = options || {};
        const c = CAMO[camoColor] || CAMO.green;

        const group = new THREE.Group();

        // ─── 材质 ───
        const hullMat    = new THREE.MeshStandardMaterial({ color: c.hull, roughness: 0.60, metalness: 0.12 });
        const trackMat   = new THREE.MeshStandardMaterial({ color: c.track, roughness: 0.90, metalness: 0.30 });
        const turretMat  = new THREE.MeshStandardMaterial({ color: c.turret, roughness: 0.50, metalness: 0.20 });
        const barrelMat  = new THREE.MeshStandardMaterial({ color: c.barrel, roughness: 0.40, metalness: 0.60 });
        const wheelMat   = new THREE.MeshStandardMaterial({ color: c.wheel, roughness: 0.50, metalness: 0.50 });
        const hubMat     = new THREE.MeshStandardMaterial({ color: c.hub, roughness: 0.40, metalness: 0.55 });
        const mantletMat = new THREE.MeshStandardMaterial({ color: c.mantlet, roughness: 0.45, metalness: 0.55 });
        const rimMat     = new THREE.MeshStandardMaterial({ color: c.rim, roughness: 0.55, metalness: 0.45 });
        const fenderMat  = new THREE.MeshStandardMaterial({ color: c.fender, roughness: 0.70, metalness: 0.08 });
        const fuelTankMat = new THREE.MeshStandardMaterial({ color: c.fuelTank, roughness: 0.65, metalness: 0.15 });
        const toolBoxMat = new THREE.MeshStandardMaterial({ color: c.toolBox, roughness: 0.70, metalness: 0.10 });
        const detailMat  = new THREE.MeshStandardMaterial({ color: '#333333', roughness: 0.70, metalness: 0.20 });
        const rubberMat  = new THREE.MeshStandardMaterial({ color: '#1a1a1a', roughness: 0.95, metalness: 0.05 });
        const periscopeMat = new THREE.MeshStandardMaterial({ color: '#1a3a1a', roughness: 0.5, metalness: 0.3 });

        // ═══════════════════════════════════════════
        //  车体 — ExtrudeGeometry 剖面，真正60°首上倾斜
        // ═══════════════════════════════════════════

        // 侧面轮廓 (XY平面: X=前后(Z方向), Y=上下)
        const hullProfile = new THREE.Shape();
        hullProfile.moveTo(FRONT_Z,     HULL_LO);    // 前下
        hullProfile.lineTo(GLACIS_TOP_Z, HULL_HI);   // 60° 首上
        hullProfile.lineTo(-FRONT_Z,    HULL_HI);    // 发动机舱顶后
        hullProfile.lineTo(-FRONT_Z,    HULL_LO);    // 后下
        hullProfile.closePath();

        const hullGeo = new THREE.ExtrudeGeometry(hullProfile, {
            depth: HULL_W, bevelEnabled: false
        });
        const hullMesh = new THREE.Mesh(hullGeo, hullMat);
        hullMesh.rotation.y = -Math.PI / 2;
        hullMesh.position.set(-HULL_W / 2, 0, 0);
        hullMesh.castShadow = true;
        hullMesh.receiveShadow = true;
        group.add(hullMesh);
        group.userData.hull = hullMesh;

        // ── 发动机舱顶盖 ──
        {
            const engDeckLen = 0.55;
            const engDeckZ = -FRONT_Z + engDeckLen / 2 + 0.04;
            const engDeckGeo = new THREE.BoxGeometry(HULL_W - 0.06, 0.030, engDeckLen);
            const engDeck = new THREE.Mesh(engDeckGeo, hullMat);
            engDeck.position.set(0, HULL_HI + 0.015, engDeckZ);
            engDeck.castShadow = true;
            group.add(engDeck);

            // 散热格栅条
            for (let g = 0; g < 6; g++) {
                const barGeo = new THREE.BoxGeometry(HULL_W - 0.16, 0.006, 0.020);
                const bar = new THREE.Mesh(barGeo, detailMat);
                bar.position.set(0, HULL_HI + 0.035,
                    engDeckZ - engDeckLen/2 + 0.055 + g*0.09);
                group.add(bar);
            }
        }

        // ── 驾驶员舱盖 ──
        {
            const hatchGeo = new THREE.BoxGeometry(0.26, 0.025, 0.18);
            const hatch = new THREE.Mesh(hatchGeo, hullMat);
            hatch.position.set(0, HULL_HI + 0.015, GLACIS_TOP_Z + 0.15);
            hatch.rotation.x = -Math.PI / 14;
            hatch.castShadow = true;
            group.add(hatch);

            const periscope = new THREE.Mesh(
                new THREE.BoxGeometry(0.035, 0.035, 0.035),
                periscopeMat
            );
            periscope.position.set(0, HULL_HI + 0.045, GLACIS_TOP_Z + 0.10);
            group.add(periscope);
        }

        // ── 备用履带（首上右侧）─
        for (let i = 0; i < 3; i++) {
            const linkGeo = new THREE.BoxGeometry(0.010, 0.06, 0.05);
            const link = new THREE.Mesh(linkGeo, detailMat);
            link.position.set(0.20, HULL_LO + 0.07 + i * 0.065, FRONT_Z - 0.08 - i * 0.04);
            link.rotation.y = 0.15;
            group.add(link);
        }

        // ═══════════════════════════════════════
        //  翼子板 — 薄板
        // ═══════════════════════════════════════

        for (let side = -1; side <= 1; side += 2) {
            const sx = side * (HULL_W / 2 + 0.07);
            const fenderGeo = new THREE.BoxGeometry(0.05, 0.012, HULL_L - 0.12);
            const fender = new THREE.Mesh(fenderGeo, fenderMat);
            fender.position.set(sx, HULL_LO + 0.008, 0);
            fender.castShadow = true;
            group.add(fender);

            // 前挡泥板（微斜）
            const lipGeo = new THREE.BoxGeometry(0.04, 0.04, 0.012);
            const lip = new THREE.Mesh(lipGeo, fenderMat);
            lip.position.set(sx, HULL_LO + 0.03, FRONT_Z - 0.05);
            lip.rotation.x = 0.35;
            group.add(lip);
        }

        // ═══════════════════════════════════════
        //  行走系统
        // ═══════════════════════════════════════

        const leftWheels = [], rightWheels = [];
        const roadWheelZ = [-0.40, -0.14, 0.06, 0.26, 0.44];
        const idlerZ     = 0.72;
        const sprocketZ  = -0.64;

        function makeWheel(radius, width) {
            const wg = new THREE.Group();
            const hub = new THREE.Mesh(
                new THREE.CylinderGeometry(radius, radius, width, 24), hubMat);
            hub.rotation.z = Math.PI / 2;
            wg.add(hub);

            const rim = new THREE.Mesh(
                new THREE.TorusGeometry(radius, 0.015, 8, 24), rimMat);
            rim.rotation.y = Math.PI / 2;
            wg.add(rim);

            // 辐条
            for (let s = 0; s < 6; s++) {
                const spoke = new THREE.Mesh(
                    new THREE.BoxGeometry(radius * 1.5, 0.012, 0.020), detailMat);
                spoke.rotation.z = (s * Math.PI) / 3;
                wg.add(spoke);
            }

            const disc = new THREE.Mesh(
                new THREE.CylinderGeometry(radius * 0.25, radius * 0.25, width + 0.005, 12), detailMat);
            disc.rotation.z = Math.PI / 2;
            wg.add(disc);

            return wg;
        }

        function makeSprocket(radius, width) {
            const sg = new THREE.Group();
            const hub = new THREE.Mesh(
                new THREE.CylinderGeometry(radius * 0.45, radius * 0.45, width, 20), hubMat);
            hub.rotation.z = Math.PI / 2;
            sg.add(hub);

            const ring = new THREE.Mesh(
                new THREE.TorusGeometry(radius, 0.025, 8, 24), rimMat);
            ring.rotation.y = Math.PI / 2;
            sg.add(ring);

            for (let i = 0; i < 14; i++) {
                const tooth = new THREE.Mesh(
                    new THREE.BoxGeometry(0.03, 0.045, 0.035), wheelMat);
                const angle = (i / 14) * Math.PI * 2;
                tooth.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius, 0);
                tooth.rotation.z = angle;
                sg.add(tooth);
            }
            return sg;
        }

        // 5 对负重轮
        for (let i = 0; i < 5; i++) {
            for (let side = -1; side <= 1; side += 2) {
                const w = makeWheel(WL_R, WL_W);
                w.position.set(side * WHEEL_X, WL_R, roadWheelZ[i]);
                group.add(w);
                (side < 0 ? leftWheels : rightWheels).push(w);

                // 悬挂臂
                const arm = new THREE.Mesh(
                    new THREE.BoxGeometry(0.025, 0.02, 0.035), detailMat);
                const armLen = 0.08;
                arm.position.set(side * (WHEEL_X + armLen / 2), WL_R, roadWheelZ[i]);
                group.add(arm);
            }
        }

        // 诱导轮 + 主动轮
        for (let side = -1; side <= 1; side += 2) {
            const idler = makeWheel(IDLER_R, 0.035);
            idler.position.set(side * WHEEL_X, IDLER_R + 0.02, idlerZ);
            group.add(idler);
            (side < 0 ? leftWheels : rightWheels).push(idler);

            const sprocket = makeSprocket(SPROCKET_R, 0.055);
            sprocket.position.set(side * WHEEL_X, SPROCKET_Y, sprocketZ);
            group.add(sprocket);
            (side < 0 ? leftWheels : rightWheels).push(sprocket);
        }

        group.userData.leftWheels  = leftWheels;
        group.userData.rightWheels = rightWheels;

        // ═══════════════════════════════════════
        //  履带
        // ═══════════════════════════════════════

        function buildTrack(sideX) {
            const tg = new THREE.Group();
            const segGeo = new THREE.BoxGeometry(0.06, 0.028, 0.18);

            // 底部
            for (const z of [-0.50, -0.32, -0.14, 0.04, 0.22, 0.40, 0.56]) {
                const seg = new THREE.Mesh(segGeo, trackMat);
                seg.position.set(sideX, 0.008, z); seg.castShadow = true; tg.add(seg);
            }
            // 顶部
            for (const z of [-0.44, -0.26, -0.08, 0.10, 0.28, 0.46]) {
                const seg = new THREE.Mesh(segGeo, trackMat);
                seg.position.set(sideX, WL_R * 2 + 0.01, z); seg.castShadow = true; tg.add(seg);
            }
            // 前弧
            for (let i = 0; i < 5; i++) {
                const seg = new THREE.Mesh(segGeo, trackMat);
                const a = Math.PI + (i / 4) * Math.PI;
                seg.position.set(sideX, IDLER_R + 0.02 + Math.sin(a) * (IDLER_R + 0.03), idlerZ + Math.cos(a) * (IDLER_R + 0.03));
                seg.rotation.x = -a; seg.castShadow = true; tg.add(seg);
            }
            // 后弧
            for (let i = 0; i < 5; i++) {
                const seg = new THREE.Mesh(segGeo, trackMat);
                const a = (i / 4) * Math.PI;
                seg.position.set(sideX, SPROCKET_Y - Math.sin(a) * (SPROCKET_R + 0.03), sprocketZ + Math.cos(a + Math.PI) * (SPROCKET_R + 0.03));
                seg.rotation.x = -(a + Math.PI); seg.castShadow = true; tg.add(seg);
            }
            return tg;
        }

        group.add(buildTrack(-WHEEL_X));
        group.add(buildTrack(WHEEL_X));

        // ═══════════════════════════════════════
        //  炮塔 — 扁宽六角形，侧面陡直
        // ═══════════════════════════════════════

        const turretGroup = new THREE.Group();
        const TR_BOTTOM = 0.48;
        const TR_TOP    = 0.38;
        const TR_HEIGHT = 0.24;  // 扁

        // 六角形主体（侧面陡直，上下半径差小）
        const turretGeo = new THREE.CylinderGeometry(TR_TOP, TR_BOTTOM, TR_HEIGHT, 6);
        const turretMesh = new THREE.Mesh(turretGeo, turretMat);
        turretMesh.position.y = TURRET_BASE_Y + TR_HEIGHT / 2;
        turretMesh.castShadow = true;
        turretMesh.receiveShadow = true;
        turretGroup.add(turretMesh);

        // 棱边圆角（细圆柱）
        for (let corner = 0; corner < 6; corner++) {
            const a = (corner / 6) * Math.PI * 2 + Math.PI / 6;
            const r = TR_BOTTOM;
            const edge = new THREE.Mesh(
                new THREE.CylinderGeometry(0.012, 0.012, TR_HEIGHT, 4), turretMat);
            edge.position.set(Math.cos(a) * r, TURRET_BASE_Y + TR_HEIGHT / 2, Math.sin(a) * r);
            edge.rotation.y = -a + Math.PI / 6;
            turretGroup.add(edge);
        }

        // 顶部扁穹顶
        const domeGeo = new THREE.SphereGeometry(
            TR_TOP - 0.01, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.35);
        const dome = new THREE.Mesh(domeGeo, turretMat);
        dome.position.y = TURRET_BASE_Y + TR_HEIGHT;
        dome.castShadow = true;
        turretGroup.add(dome);

        // 座圈环
        const ringGeo = new THREE.TorusGeometry(TR_BOTTOM + 0.02, 0.018, 8, 36);
        const ring = new THREE.Mesh(ringGeo, detailMat);
        ring.position.y = TURRET_BASE_Y;
        ring.rotation.x = Math.PI / 2;
        turretGroup.add(ring);

        // ── 防盾 — 扁平梯形铸造块 ──
        // 前视矩形
        const mantletBox = new THREE.Mesh(
            new THREE.BoxGeometry(0.28, 0.18, 0.18), mantletMat);
        mantletBox.position.set(0, TURRET_BASE_Y + 0.16, TR_BOTTOM + 0.06);
        mantletBox.castShadow = true;
        turretGroup.add(mantletBox);

        // 左右侧铸造耳
        for (let side = -1; side <= 1; side += 2) {
            const ear = new THREE.Mesh(
                new THREE.BoxGeometry(0.04, 0.12, 0.06), mantletMat);
            ear.position.set(side * 0.18, TURRET_BASE_Y + 0.16, TR_BOTTOM + 0.08);
            ear.castShadow = true;
            turretGroup.add(ear);
        }

        // 防盾上斜面（加盖顶部）
        const mantletTop = new THREE.Mesh(
            new THREE.BoxGeometry(0.26, 0.03, 0.06), mantletMat);
        mantletTop.position.set(0, TURRET_BASE_Y + 0.27, TR_BOTTOM + 0.06);
        turretGroup.add(mantletTop);

        // ── 指挥塔（后部居中）─
        const CUP_Y = TURRET_BASE_Y + TR_HEIGHT + 0.02;
        const cupolaBase = new THREE.Mesh(
            new THREE.CylinderGeometry(0.10, 0.11, 0.05, 12), turretMat);
        cupolaBase.position.set(0, CUP_Y - 0.025, -0.16);
        cupolaBase.castShadow = true;
        turretGroup.add(cupolaBase);

        const cupolaHatch = new THREE.Mesh(
            new THREE.CylinderGeometry(0.10, 0.10, 0.02, 12), detailMat);
        cupolaHatch.position.set(0, CUP_Y + 0.01, -0.16);
        turretGroup.add(cupolaHatch);

        // 3 个潜望镜
        for (let i = 0; i < 3; i++) {
            const prism = new THREE.Mesh(
                new THREE.BoxGeometry(0.012, 0.020, 0.030), periscopeMat);
            const a = (i / 3) * Math.PI * 2 + Math.PI / 2;
            prism.position.set(
                Math.cos(a) * 0.10, CUP_Y + 0.015, -0.16 + Math.sin(a) * 0.08);
            turretGroup.add(prism);
        }

        group.add(turretGroup);

        // ═══════════════════════════════════════
        //  主炮 — 85mm
        // ═══════════════════════════════════════

        const barrelGroup = new THREE.Group();
        const BARREL_BASE = TR_BOTTOM + 0.12;
        const BARREL_Y = TURRET_BASE_Y + 0.16;

        // 炮管根部
        const root = new THREE.Mesh(
            new THREE.CylinderGeometry(0.045, 0.032, 0.15, 12), barrelMat);
        root.rotation.x = -Math.PI / 2;
        root.position.set(0, BARREL_Y, BARREL_BASE + 0.08);
        root.castShadow = true;
        barrelGroup.add(root);

        // 主炮管
        const BARREL_LEN = 1.15;
        const barrel = new THREE.Mesh(
            new THREE.CylinderGeometry(0.028, 0.032, BARREL_LEN, 12), barrelMat);
        barrel.rotation.x = -Math.PI / 2;
        barrel.position.set(0, BARREL_Y, BARREL_BASE + 0.15 + BARREL_LEN / 2);
        barrel.castShadow = true;
        barrelGroup.add(barrel);

        // 抽烟器
        const evac = new THREE.Mesh(
            new THREE.CylinderGeometry(0.045, 0.045, 0.07, 16),
            new THREE.MeshStandardMaterial({ color: '#555555', roughness: 0.35, metalness: 0.65 }));
        evac.rotation.x = -Math.PI / 2;
        evac.position.set(0, BARREL_Y, BARREL_BASE + 0.15 + BARREL_LEN * 0.35);
        barrelGroup.add(evac);

        // 抽烟器肋环
        for (const off of [-0.005, 0.005]) {
            const rib = new THREE.Mesh(
                new THREE.TorusGeometry(0.050, 0.005, 8, 16), barrelMat);
            rib.rotation.x = -Math.PI / 2;
            rib.position.set(0, BARREL_Y, BARREL_BASE + 0.15 + BARREL_LEN * 0.35 + off);
            barrelGroup.add(rib);
        }

        // 炮口
        const muzzle = new THREE.Mesh(
            new THREE.CylinderGeometry(0.038, 0.042, 0.08, 16), barrelMat);
        muzzle.rotation.x = -Math.PI / 2;
        muzzle.position.set(0, BARREL_Y, BARREL_BASE + 0.15 + BARREL_LEN + 0.04);
        barrelGroup.add(muzzle);

        group.add(barrelGroup);

        // ═══════════════════════════════════════
        //  外部附件
        // ═══════════════════════════════════════

        // 圆筒油箱 × 2
        const tankGeo = new THREE.CylinderGeometry(0.07, 0.07, 0.35, 12);
        for (let side = -1; side <= 1; side += 2) {
            const ft = new THREE.Mesh(tankGeo, fuelTankMat);
            ft.rotation.z = Math.PI / 2;
            ft.position.set(side * (HULL_W / 2 + 0.13), HULL_LO + 0.07, -FRONT_Z + 0.12);
            ft.castShadow = true;
            group.add(ft);
        }

        // 工具箱
        const toolbox = new THREE.Mesh(
            new THREE.BoxGeometry(0.16, 0.05, 0.09), toolBoxMat);
        toolbox.position.set(0, HULL_LO + 0.03, -FRONT_Z + 0.35);
        toolbox.castShadow = true;
        group.add(toolbox);

        // 牵引缆绳
        const cableMat = new THREE.MeshStandardMaterial({ color: '#444', roughness: 0.8, metalness: 0.4 });
        for (let ci = 0; ci < 2; ci++) {
            const cable = new THREE.Mesh(
                new THREE.CylinderGeometry(0.007, 0.007, 0.50, 6), cableMat);
            cable.rotation.x = Math.PI / 2 + 0.1;
            cable.position.set(HULL_W / 2 + 0.10, HULL_LO + 0.09, -0.02 + ci * 0.32);
            cable.rotation.z = 0.1;
            group.add(cable);
        }

        // 前灯
        const hlGroup = new THREE.Group();
        const hlBase = new THREE.Mesh(
            new THREE.CylinderGeometry(0.035, 0.040, 0.035, 12), detailMat);
        hlBase.rotation.x = Math.PI / 2;
        hlGroup.add(hlBase);
        const hlLens = new THREE.Mesh(
            new THREE.SphereGeometry(0.030, 12, 12, 0, Math.PI * 2, 0, Math.PI / 2),
            new THREE.MeshStandardMaterial({ color: '#ffffee', roughness: 0.1, metalness: 0.05, emissive: '#ffffcc', emissiveIntensity: 0.1 }));
        hlLens.rotation.x = -Math.PI / 2;
        hlLens.position.z = 0.035;
        hlGroup.add(hlLens);
        hlGroup.position.set(HULL_W / 2 + 0.08, HULL_LO + 0.06, FRONT_Z - 0.18);
        group.add(hlGroup);

        // 排气管
        for (let side = -1; side <= 1; side += 2) {
            const ex = new THREE.Mesh(
                new THREE.CylinderGeometry(0.022, 0.026, 0.07, 8), detailMat);
            ex.rotation.x = Math.PI / 2;
            ex.position.set(side * 0.18, HULL_LO + 0.02, -FRONT_Z - 0.03);
            group.add(ex);

            const exCap = new THREE.Mesh(
                new THREE.TorusGeometry(0.030, 0.006, 8, 12), detailMat);
            exCap.rotation.y = Math.PI / 2;
            exCap.position.set(side * 0.18, HULL_LO + 0.02, -FRONT_Z - 0.03);
            group.add(exCap);
        }

        // ═══════════════════════════════════════
        //  阴影
        // ═══════════════════════════════════════

        const sh = new THREE.Mesh(
            new THREE.CircleGeometry(0.68, 32),
            new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.25, depthWrite: false }));
        sh.rotation.x = -Math.PI / 2;
        sh.position.y = 0.012;
        sh.renderOrder = 1;
        sh.name = 'shadow';
        group.add(sh);

        group.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });
        return group;
    }

    window.ModelRegistry.register('tanks', 't34-85-green',  (opts) =>
        createT34_85({ ...opts, camoColor: 'green' }));
    window.ModelRegistry.register('tanks', 't34-85-desert', (opts) =>
        createT34_85({ ...opts, camoColor: 'desert' }));
})();
