/**
 * T-34-85 后期型 (Model 1944/1945) 坦克模型 — v2 修订版
 *
 * 修正要点：
 *   1. 车体：ExtrudeGeometry 挤出楔形剖面，通体60°首上斜板，无垂直盒面
 *   2. 炮塔：截顶圆锥厚壁下半部 + 圆顶上收 + 宽于车体 + 突出矩形防盾
 *   3. 主炮：细长炮管(≈车体长2/3) + 环状抽烟器
 *   4. 行走系统：加厚履带环 + 主动轮加大加高带齿缘 + 诱导轮区分
 */
(function() {
    const CAMO = {
        green: {
            hull: '#4a5c2e', turret: '#3d4f25', track: '#2a2a2a',
            wheel: '#555555', hub: '#888888', barrel: '#444444',
            mantlet: '#383838', rim: '#3a3a3a'
        },
        desert: {
            hull: '#8b7d4a', turret: '#6d6038', track: '#3a3525',
            wheel: '#6d6d55', hub: '#999980', barrel: '#555544',
            mantlet: '#4a4a3a', rim: '#5a5a45'
        }
    };

    // ─── 比例常量 ───
    const HULL_W = 0.94;        // 车体宽度
    const HULL_L = 1.70;        // 车体全长 (z范围)
    const HULL_HI = 0.55;       // 车体顶部 Y
    const HULL_LO = 0.25;       // 车体底部 Y
    const HULL_H = HULL_HI - HULL_LO; // 车体高度 0.30

    // 首上装甲：60°从垂直面 = 30°从水平面
    // 高度差0.30，水平跨度 = 0.30 * tan(60°) = 0.30 * 1.732 = 0.52
    const GLACIS_DZ = 0.52;     // 首上水平跨度
    const FRONT_Z = HULL_L / 2; // 车体最前 0.85
    const GLACIS_TOP_Z = FRONT_Z - GLACIS_DZ; // 首上顶部Z ≈ 0.33

    const WL_R = 0.14;          // 负重轮半径
    const WL_W = 0.06;          // 负重轮宽度
    const IDLER_R = 0.10;       // 诱导轮半径(前下方)
    const SPROCKET_R = 0.18;    // 主动轮半径(后上方，大于负重轮)
    const SPROCKET_Y = 0.22;    // 主动轮中心Y(高于负重轮)
    const WHEEL_X = 0.53;       // 车轮X偏移

    const TURRET_BASE_Y = HULL_HI; // 炮塔座圈Y = 0.55

    function createT34_85(options) {
        const { camoColor = 'green' } = options || {};
        const c = CAMO[camoColor] || CAMO.green;

        const group = new THREE.Group();

        // 材质定义
        const hullMat    = new THREE.MeshStandardMaterial({ color: c.hull, roughness: 0.65, metalness: 0.12 });
        const trackMat   = new THREE.MeshStandardMaterial({ color: c.track, roughness: 0.90, metalness: 0.30 });
        const turretMat  = new THREE.MeshStandardMaterial({ color: c.turret, roughness: 0.55, metalness: 0.18 });
        const barrelMat  = new THREE.MeshStandardMaterial({ color: c.barrel, roughness: 0.40, metalness: 0.60 });
        const wheelMat   = new THREE.MeshStandardMaterial({ color: c.wheel, roughness: 0.50, metalness: 0.50 });
        const hubMat     = new THREE.MeshStandardMaterial({ color: c.hub, roughness: 0.40, metalness: 0.55 });
        const mantletMat = new THREE.MeshStandardMaterial({ color: c.mantlet, roughness: 0.45, metalness: 0.55 });
        const rimMat     = new THREE.MeshStandardMaterial({ color: c.rim, roughness: 0.55, metalness: 0.45 });
        const detailMat  = new THREE.MeshStandardMaterial({ color: '#333333', roughness: 0.70, metalness: 0.20 });

        // ═══════════════════════════════════════════
        //  车体 — ShapeGeometry 挤出楔形剖面
        //  (60°首上通体斜板，无垂直盒面)
        // ═══════════════════════════════════════════

        // 侧面轮廓 (XY平面: X=前后, Y=上下)
        const hullProfile = new THREE.Shape();
        hullProfile.moveTo( FRONT_Z,       HULL_LO );   // 前下角
        hullProfile.lineTo( GLACIS_TOP_Z,  HULL_HI );   // 首上顶端 (60°斜线)
        hullProfile.lineTo(-FRONT_Z,       HULL_HI );   // 发动机舱后上角
        hullProfile.lineTo(-FRONT_Z,       HULL_LO );   // 后下角
        hullProfile.closePath();

        // 沿Z轴挤出 → 宽度，然后绕Y旋转使宽度=世界X、前后=世界Z
        const hullGeo = new THREE.ExtrudeGeometry(hullProfile, {
            depth: HULL_W, bevelEnabled: false
        });
        const hullMesh = new THREE.Mesh(hullGeo, hullMat);
        hullMesh.rotation.y = -Math.PI / 2;  // 挤出轴Z → 世界X（宽度）
        hullMesh.position.set(-HULL_W / 2, 0, 0); // X居中
        hullMesh.castShadow = true;
        hullMesh.receiveShadow = true;
        group.add(hullMesh);
        group.userData.hull = hullMesh;

        // 车体下部侧板（履带护板 — 加宽视觉）
        const sidePlateGeo = new THREE.BoxGeometry(0.06, 0.08, HULL_L - 0.10);
        const lp = new THREE.Mesh(sidePlateGeo, hullMat);
        lp.position.set(-HULL_W / 2 - 0.03, HULL_LO + 0.04, 0);
        group.add(lp);
        const rp = new THREE.Mesh(sidePlateGeo, hullMat);
        rp.position.set( HULL_W / 2 + 0.03, HULL_LO + 0.04, 0);
        group.add(rp);

        // 发动机舱盖 — 后部平坦矩形
        const engineDeckGeo = new THREE.BoxGeometry(HULL_W - 0.06, 0.06, 0.55);
        const engineDeck = new THREE.Mesh(engineDeckGeo, hullMat);
        engineDeck.position.set(0, HULL_HI + 0.03, -0.55);
        engineDeck.castShadow = true;
        engineDeck.receiveShadow = true;
        group.add(engineDeck);

        // 格栅（后缘镂空带）
        const grillGeo = new THREE.BoxGeometry(HULL_W - 0.20, 0.015, 0.10);
        const grill = new THREE.Mesh(grillGeo, detailMat);
        grill.position.set(0, HULL_HI + 0.05, -FRONT_Z + 0.03);
        group.add(grill);
        for (let g = 0; g < 5; g++) {
            const barGeo = new THREE.BoxGeometry(HULL_W - 0.26, 0.010, 0.010);
            const bar = new THREE.Mesh(barGeo, new THREE.MeshStandardMaterial({
                color: '#222', roughness: 0.5, metalness: 0.6
            }));
            bar.position.set(0, HULL_HI + 0.055, -FRONT_Z + 0.03 + (g - 2) * 0.03);
            group.add(bar);
        }

        // 驾驶员舱盖（首上顶端中线的矩形凸起）
        const hatchGeo = new THREE.BoxGeometry(0.26, 0.04, 0.20);
        const hatch = new THREE.Mesh(hatchGeo, hullMat);
        hatch.position.set(0, HULL_HI + 0.03, GLACIS_TOP_Z + 0.10);
        hatch.rotation.x = -Math.PI / 12; // 微倾贴合首上
        hatch.castShadow = true;
        group.add(hatch);

        // ═══════════════════════════════
        //  行走系统 — 负重轮 / 诱导轮 / 主动轮
        // ═══════════════════════════════

        const leftWheels = [], rightWheels = [];
        const roadWheelZ = [-0.40, -0.20, 0.00, 0.20, 0.40];
        const idlerZ     = 0.75;       // 诱导轮Z（前下方）
        const sprocketZ  = -0.68;      // 主动轮Z（后上方）

        function makeRoadWheel(radius, width, hasSpokes) {
            const wg = new THREE.Group();
            const hubGeo = new THREE.CylinderGeometry(radius, radius, width, 20);
            const hub = new THREE.Mesh(hubGeo, hubMat);
            hub.rotation.z = Math.PI / 2;
            wg.add(hub);

            const rimGeo = new THREE.TorusGeometry(radius, 0.015, 8, 20);
            const rim = new THREE.Mesh(rimGeo, rimMat);
            rim.rotation.y = Math.PI / 2;
            wg.add(rim);

            if (hasSpokes) {
                for (let s = 0; s < 6; s++) {
                    const spokeGeo = new THREE.BoxGeometry(radius * 1.65, 0.02, 0.03);
                    const spoke = new THREE.Mesh(spokeGeo, detailMat);
                    spoke.rotation.z = (s * Math.PI) / 3;
                    wg.add(spoke);
                }
            }
            return wg;
        }

        // 主动轮：更大、更高、带明显齿缘
        function makeSprocket(radius, width) {
            const sg = new THREE.Group();

            // 内轮毂
            const hubGeo = new THREE.CylinderGeometry(radius * 0.55, radius * 0.55, width, 20);
            const hub = new THREE.Mesh(hubGeo, hubMat);
            hub.rotation.z = Math.PI / 2;
            sg.add(hub);

            // 外齿缘环（加厚）
            const ringGeo = new THREE.TorusGeometry(radius, 0.03, 8, 24);
            const ring = new THREE.Mesh(ringGeo, rimMat);
            ring.rotation.y = Math.PI / 2;
            sg.add(ring);

            // 14个齿轮齿（更密）
            for (let i = 0; i < 14; i++) {
                const toothGeo = new THREE.BoxGeometry(0.04, 0.05, 0.045);
                const tooth = new THREE.Mesh(toothGeo, wheelMat);
                const angle = (i / 14) * Math.PI * 2;
                tooth.position.set(
                    Math.cos(angle) * radius,
                    Math.sin(angle) * radius,
                    0
                );
                tooth.rotation.z = angle;
                sg.add(tooth);
            }
            return sg;
        }

        // 5对负重轮
        for (let i = 0; i < 5; i++) {
            const lw = makeRoadWheel(WL_R, WL_W, true);
            lw.position.set(-WHEEL_X, WL_R, roadWheelZ[i]);
            group.add(lw); leftWheels.push(lw);

            const rw = makeRoadWheel(WL_R, WL_W, true);
            rw.position.set(WHEEL_X, WL_R, roadWheelZ[i]);
            group.add(rw); rightWheels.push(rw);
        }

        // 诱导轮（前下方，直径较小）
        const lIdler = makeRoadWheel(IDLER_R, 0.05, false);
        lIdler.position.set(-WHEEL_X, IDLER_R + 0.02, idlerZ);
        group.add(lIdler); leftWheels.push(lIdler);
        const rIdler = makeRoadWheel(IDLER_R, 0.05, false);
        rIdler.position.set(WHEEL_X, IDLER_R + 0.02, idlerZ);
        group.add(rIdler); rightWheels.push(rIdler);

        // 主动轮（后上方，更大更高，带齿缘）
        const lSprocket = makeSprocket(SPROCKET_R, 0.065);
        lSprocket.position.set(-WHEEL_X, SPROCKET_Y, sprocketZ);
        group.add(lSprocket); leftWheels.push(lSprocket);
        const rSprocket = makeSprocket(SPROCKET_R, 0.065);
        rSprocket.position.set(WHEEL_X, SPROCKET_Y, sprocketZ);
        group.add(rSprocket); rightWheels.push(rSprocket);

        group.userData.leftWheels  = leftWheels;
        group.userData.rightWheels = rightWheels;

        // ═══════════════════════════════
        //  履带环路 — 加厚，包裹行走系统
        // ═══════════════════════════════

        function buildTrack(sideX) {
            const tg = new THREE.Group();
            // 加厚履带片
            const segGeo = new THREE.BoxGeometry(0.07, 0.035, 0.22);

            // 底部（触地，水平）
            const btmZ = [-0.56, -0.36, -0.16, 0.04, 0.24, 0.44, 0.62];
            for (const z of btmZ) {
                const seg = new THREE.Mesh(segGeo, trackMat);
                seg.position.set(sideX, 0.01, z);
                seg.castShadow = true;
                tg.add(seg);
            }

            // 顶部（水平，负重轮上方）
            const topZ = [-0.52, -0.32, -0.12, 0.08, 0.28, 0.48, 0.62];
            for (const z of topZ) {
                const seg = new THREE.Mesh(segGeo, trackMat);
                seg.position.set(sideX, WL_R * 2 - 0.01, z);
                seg.castShadow = true;
                tg.add(seg);
            }

            // 前部弧形（环绕诱导轮）
            const faR = IDLER_R + 0.04;
            const faCY = IDLER_R + 0.02;
            const faCZ = idlerZ;
            const faN = 6;
            for (let i = 0; i < faN; i++) {
                const seg = new THREE.Mesh(segGeo, trackMat);
                const angle = Math.PI + (i / (faN - 1)) * Math.PI;
                seg.position.set(sideX,
                    faCY + Math.sin(angle) * faR,
                    faCZ + Math.cos(angle) * faR);
                seg.rotation.x = -angle;
                seg.castShadow = true;
                tg.add(seg);
            }

            // 后部弧形（环绕主动轮 — 更大更高）
            const raR = SPROCKET_R + 0.04;
            const raCY = SPROCKET_Y;
            const raCZ = sprocketZ;
            const raN = 6;
            for (let i = 0; i < raN; i++) {
                const seg = new THREE.Mesh(segGeo, trackMat);
                const angle = (i / (raN - 1)) * Math.PI;
                seg.position.set(sideX,
                    raCY - Math.sin(angle) * raR,
                    raCZ + Math.cos(angle + Math.PI) * raR);
                seg.rotation.x = -(angle + Math.PI);
                seg.castShadow = true;
                tg.add(seg);
            }

            return tg;
        }

        group.add(buildTrack(-WHEEL_X));
        group.add(buildTrack( WHEEL_X));

        // ═══════════════════════════════════════
        //  炮塔 — 截顶圆锥厚壁 + 圆顶上收 + 宽于车体 + 矩形防盾
        // ═══════════════════════════════════════

        const turretGroup = new THREE.Group();
        const TURRET_OUTER_R = 0.53;     // 炮塔底部外径 ≈1.06 > 车宽0.94

        // 炮塔下半部 — 较厚的垂直圆柱壁（截顶圆锥体）
        const turretLowerGeo = new THREE.CylinderGeometry(
            TURRET_OUTER_R - 0.03, // topRadius (略收)
            TURRET_OUTER_R,        // bottomRadius (略宽于车体)
            0.24,                  // height
            36
        );
        const turretLower = new THREE.Mesh(turretLowerGeo, turretMat);
        turretLower.position.y = TURRET_BASE_Y + 0.12;
        turretLower.castShadow = true;
        turretLower.receiveShadow = true;
        turretGroup.add(turretLower);

        // 炮塔上半部 — 圆顶（从圆柱顶向上缓收）
        const turretDomeGeo = new THREE.SphereGeometry(
            TURRET_OUTER_R, 36, 20,
            0, Math.PI * 2,          // phi
            0, Math.PI * 0.42        // theta (浅穹顶)
        );
        const turretDome = new THREE.Mesh(turretDomeGeo, turretMat);
        turretDome.position.y = TURRET_BASE_Y + 0.22;
        turretDome.castShadow = true;
        turretGroup.add(turretDome);

        // ── 突出矩形火炮防盾（炮管安装于此，而非直接插入炮塔壳体） ──
        const mantletGeo = new THREE.BoxGeometry(0.32, 0.24, 0.12);
        const mantlet = new THREE.Mesh(mantletGeo, mantletMat);
        mantlet.position.set(0, TURRET_BASE_Y + 0.18, TURRET_OUTER_R - 0.04);
        mantlet.castShadow = true;
        turretGroup.add(mantlet);

        // ── 指挥塔（偏后中线，小型圆柱凸起） ──
        const cupolaGeo = new THREE.CylinderGeometry(0.08, 0.09, 0.12, 16);
        const cupola = new THREE.Mesh(cupolaGeo, turretMat);
        cupola.position.set(0, TURRET_BASE_Y + 0.39, -0.16);
        cupola.castShadow = true;
        turretGroup.add(cupola);

        // 指挥塔顶盖
        const cupolaHatchGeo = new THREE.CylinderGeometry(0.07, 0.07, 0.02, 16);
        const cupolaHatch = new THREE.Mesh(cupolaHatchGeo, detailMat);
        cupolaHatch.position.set(0, TURRET_BASE_Y + 0.46, -0.16);
        turretGroup.add(cupolaHatch);

        // 3个观察口半球凸起
        for (let i = 0; i < 3; i++) {
            const bumpGeo = new THREE.SphereGeometry(0.022, 8, 8);
            const bump = new THREE.Mesh(bumpGeo, detailMat);
            const angle = (i / 3) * Math.PI * 2 + 0.3;
            bump.position.set(
                Math.cos(angle) * 0.12,
                TURRET_BASE_Y + 0.41,
                -0.16 + Math.sin(angle) * 0.08
            );
            turretGroup.add(bump);
        }

        group.add(turretGroup);

        // ═══════════════════════════════════════
        //  主炮 — 细长圆柱管 (≈车体长 2/3) + 抽烟器
        // ═══════════════════════════════════════

        const barrelGroup = new THREE.Group();
        const BARREL_BASE_Z = TURRET_OUTER_R + 0.02; // 防盾前面Z

        // 炮管根部锥段（防盾 → 炮管过渡）
        const barrelRootGeo = new THREE.CylinderGeometry(0.052, 0.038, 0.20, 12);
        const barrelRoot = new THREE.Mesh(barrelRootGeo, barrelMat);
        barrelRoot.rotation.x = -Math.PI / 2;
        barrelRoot.position.set(0, TURRET_BASE_Y + 0.18, BARREL_BASE_Z + 0.10);
        barrelRoot.castShadow = true;
        barrelGroup.add(barrelRoot);

        // 主炮管 — 长度 ≈ 1.15（≈ 车体长1.70 的 2/3），半径0.033（细）
        const mainBarrelLen = 1.15;
        const barrelGeo = new THREE.CylinderGeometry(0.033, 0.035, mainBarrelLen, 12);
        const barrel = new THREE.Mesh(barrelGeo, barrelMat);
        barrel.rotation.x = -Math.PI / 2;
        barrel.position.set(0, TURRET_BASE_Y + 0.18, BARREL_BASE_Z + 0.20 + mainBarrelLen / 2);
        barrel.castShadow = true;
        barrelGroup.add(barrel);

        // 抽烟器 — 中后段环状凸起（距根部约1/3处）
        const boreEvacGeo = new THREE.CylinderGeometry(0.051, 0.051, 0.10, 16);
        const boreEvac = new THREE.Mesh(boreEvacGeo, new THREE.MeshStandardMaterial({
            color: '#555555', roughness: 0.35, metalness: 0.65
        }));
        boreEvac.rotation.x = -Math.PI / 2;
        boreEvac.position.set(0, TURRET_BASE_Y + 0.18,
            BARREL_BASE_Z + 0.20 + mainBarrelLen * 0.35);
        barrelGroup.add(boreEvac);

        // 炮口（末端微加粗）
        const muzzleGeo = new THREE.CylinderGeometry(0.036, 0.038, 0.06, 16);
        const muzzle = new THREE.Mesh(muzzleGeo, barrelMat);
        muzzle.rotation.x = -Math.PI / 2;
        muzzle.position.set(0, TURRET_BASE_Y + 0.18,
            BARREL_BASE_Z + 0.20 + mainBarrelLen - 0.03);
        barrelGroup.add(muzzle);

        group.add(barrelGroup);

        // ═════════════════════
        //  圆形投影阴影
        // ═════════════════════
        const shGeo = new THREE.CircleGeometry(0.65, 32);
        const sh = new THREE.Mesh(shGeo, new THREE.MeshBasicMaterial({
            color: '#000', transparent: true, opacity: 0.3, depthWrite: false
        }));
        sh.rotation.x = -Math.PI / 2;
        sh.position.y = 0.02;
        sh.renderOrder = 1;
        sh.name = 'shadow';
        group.add(sh);

        // 递归阴影
        group.traverse(c => {
            if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; }
        });

        return group;
    }

    window.ModelRegistry.register('tanks', 't34-85-green',  (opts) =>
        createT34_85({ ...opts, camoColor: 'green' }));
    window.ModelRegistry.register('tanks', 't34-85-desert', (opts) =>
        createT34_85({ ...opts, camoColor: 'desert' }));
})();
