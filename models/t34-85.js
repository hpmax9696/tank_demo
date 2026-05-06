/**
 * T-34-85 后期型 (Model 1944/1945) 坦克模型
 * 参照详细外形描述进行高精度三维几何建模
 *
 * 结构特征：
 *   - 楔形车体 + 60°首上倾斜装甲
 *   - 铸造半球形炮塔（整体曲面，无明显棱角）
 *   - 85mm细长主炮 + 抽烟装置 + 矩形防盾
 *   - 5对等径大负重轮 + 诱导轮 + 主动轮
 *   - 闭合椭圆履带环路
 *   - 小型圆柱指挥塔（偏后中线）
 */
(function() {
    // 涂装配色
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

    // ─── 比例常量（基准：车宽=1.0 ≈ 3m） ───
    const WL_R = 0.14;          // 负重轮半径 (0.85m)
    const WL_W = 0.06;          // 负重轮宽度
    const IDLER_R = 0.10;       // 诱导轮半径
    const SPROCKET_R = 0.16;    // 主动轮半径
    const WHEEL_X = 0.52;       // 车轮X偏移
    const TRACK_TOP_Y = WL_R * 2;  // 履带顶部Y
    const TRACK_BTM_Y = 0.01;      // 履带底部Y（贴地）
    const HULL_BTM_Y = 0.25;       // 车体底部Y
    const HULL_TOP_Y = 0.55;       // 车体顶部Y
    const TURRET_BASE_Y = 0.55;    // 炮塔底座Y

    function createT34_85(options) {
        const { camoColor = 'green' } = options || {};
        const c = CAMO[camoColor] || CAMO.green;

        const group = new THREE.Group();

        // 材质
        const hullMat   = new THREE.MeshStandardMaterial({ color: c.hull, roughness: 0.65, metalness: 0.12 });
        const trackMat  = new THREE.MeshStandardMaterial({ color: c.track, roughness: 0.9, metalness: 0.30 });
        const turretMat = new THREE.MeshStandardMaterial({ color: c.turret, roughness: 0.55, metalness: 0.18 });
        const barrelMat = new THREE.MeshStandardMaterial({ color: c.barrel, roughness: 0.40, metalness: 0.60 });
        const wheelMat  = new THREE.MeshStandardMaterial({ color: c.wheel, roughness: 0.50, metalness: 0.50 });
        const hubMat    = new THREE.MeshStandardMaterial({ color: c.hub, roughness: 0.40, metalness: 0.55 });
        const mantletMat= new THREE.MeshStandardMaterial({ color: c.mantlet, roughness: 0.45, metalness: 0.55 });
        const rimMat    = new THREE.MeshStandardMaterial({ color: c.rim, roughness: 0.55, metalness: 0.45 });
        const detailMat = new THREE.MeshStandardMaterial({ color: '#333333', roughness: 0.7, metalness: 0.20 });

        // ════════════════════════════════════════
        //  车体 (Hull) — 楔形轮廓 + 60°首上装甲
        // ════════════════════════════════════════

        // 1) 车体下部侧板（履带上方的垂直装甲）
        const lowerSideGeo = new THREE.BoxGeometry(0.92, 0.08, 1.70);
        const lowerSide = new THREE.Mesh(lowerSideGeo, hullMat);
        lowerSide.position.set(0, HULL_BTM_Y + 0.04, 0);
        lowerSide.castShadow = true; lowerSide.receiveShadow = true;
        group.add(lowerSide);

        // 2) 车体主装甲（垂直略内倾，梯形侧面）
        const mainBodyGeo = new THREE.BoxGeometry(0.88, 0.28, 1.15);
        const mainBody = new THREE.Mesh(mainBodyGeo, hullMat);
        mainBody.position.set(0, HULL_BTM_Y + 0.14, -0.28);
        mainBody.castShadow = true; mainBody.receiveShadow = true;
        group.add(mainBody);

        // 3) 首上倾斜装甲板 — 60°从垂直面（30°从水平面）
        const glacisGeo = new THREE.BoxGeometry(0.88, 0.52, 0.06);
        const glacis = new THREE.Mesh(glacisGeo, hullMat);
        glacis.position.set(0, HULL_BTM_Y + 0.05, 0.64);
        glacis.rotation.x = -Math.PI / 6;  // -30° → 60° from vertical
        glacis.castShadow = true; glacis.receiveShadow = true;
        group.add(glacis);

        // 4) 车体前下部（从首下到车底前缘）
        const lowerNoseGeo = new THREE.BoxGeometry(0.88, 0.10, 0.22);
        const lowerNose = new THREE.Mesh(lowerNoseGeo, hullMat);
        lowerNose.position.set(0, HULL_BTM_Y - 0.03, 0.74);
        lowerNose.castShadow = true; lowerNose.receiveShadow = true;
        group.add(lowerNose);

        // 5) 发动机舱盖（平坦矩形 + 后缘格栅）
        const engineDeckGeo = new THREE.BoxGeometry(0.88, 0.06, 0.55);
        const engineDeck = new THREE.Mesh(engineDeckGeo, hullMat);
        engineDeck.position.set(0, HULL_TOP_Y + 0.03, -0.55);
        engineDeck.castShadow = true; engineDeck.receiveShadow = true;
        group.add(engineDeck);

        // 发动机舱格栅（后缘横向镂空带 — 简化为深色薄板）
        const grillGeo = new THREE.BoxGeometry(0.78, 0.02, 0.10);
        const grill = new THREE.Mesh(grillGeo, detailMat);
        grill.position.set(0, HULL_TOP_Y + 0.05, -0.82);
        group.add(grill);

        // 格栅上的横条
        for (let g = 0; g < 5; g++) {
            const barGeo = new THREE.BoxGeometry(0.72, 0.012, 0.012);
            const bar = new THREE.Mesh(barGeo, new THREE.MeshStandardMaterial({ color: '#222', roughness: 0.5, metalness: 0.6 }));
            bar.position.set(0, HULL_TOP_Y + 0.06, -0.82 + (g - 2) * 0.03);
            group.add(bar);
        }

        // 6) 驾驶员舱盖（首上顶端中线的矩形凸起）
        const driverHatchGeo = new THREE.BoxGeometry(0.28, 0.04, 0.22);
        const driverHatch = new THREE.Mesh(driverHatchGeo, hullMat);
        driverHatch.position.set(0, HULL_TOP_Y + 0.04, 0.35);
        driverHatch.castShadow = true;
        group.add(driverHatch);

        // 车体保存引用
        group.userData.hull = mainBody;

        // ═══════════════════════════════
        //  行走系统 — 5对负重轮 + 诱导轮 + 主动轮
        // ═══════════════════════════════

        const leftWheels = [], rightWheels = [];

        // 5个负重轮Z轴等间距分布
        const roadWheelZ = [-0.40, -0.20, 0.00, 0.20, 0.40];
        const idlerZ = 0.72;       // 诱导轮（前下方）
        const sprocketZ = -0.65;   // 主动轮（后上方）

        /**
         * 创建负重轮/诱导轮组
         * 每个轮组是一个 Group，游戏代码通过 w.rotation.x 驱动旋转
         */
        function makeRoadWheel(radius, width, hasSpokes) {
            const wg = new THREE.Group();

            // 轮毂（圆柱体，轴线沿 X）
            const hubGeo = new THREE.CylinderGeometry(radius, radius, width, 20);
            const hub = new THREE.Mesh(hubGeo, hubMat);
            hub.rotation.z = Math.PI / 2;
            wg.add(hub);

            // 轮缘
            const rimGeo = new THREE.TorusGeometry(radius, 0.015, 8, 20);
            const rim = new THREE.Mesh(rimGeo, rimMat);
            rim.rotation.y = Math.PI / 2;
            wg.add(rim);

            if (hasSpokes) {
                // 辐条（6根等角度分布）
                for (let s = 0; s < 6; s++) {
                    const spokeGeo = new THREE.BoxGeometry(radius * 1.7, 0.02, 0.03);
                    const spoke = new THREE.Mesh(spokeGeo, detailMat);
                    spoke.rotation.z = (s * Math.PI) / 3;
                    wg.add(spoke);
                }
            }
            return wg;
        }

        /**
         * 创建主动轮组（带齿缘）
         */
        function makeSprocket(radius, width) {
            const sg = new THREE.Group();

            // 轮毂
            const hubGeo = new THREE.CylinderGeometry(radius * 0.7, radius * 0.7, width, 20);
            const hub = new THREE.Mesh(hubGeo, hubMat);
            hub.rotation.z = Math.PI / 2;
            sg.add(hub);

            // 齿缘环
            const ringGeo = new THREE.TorusGeometry(radius, 0.025, 8, 24);
            const ring = new THREE.Mesh(ringGeo, rimMat);
            ring.rotation.y = Math.PI / 2;
            sg.add(ring);

            // 齿轮齿（12个）
            for (let i = 0; i < 12; i++) {
                const toothGeo = new THREE.BoxGeometry(0.03, 0.04, 0.04);
                const tooth = new THREE.Mesh(toothGeo, wheelMat);
                const angle = (i / 12) * Math.PI * 2;
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

        // 创建5对负重轮
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

        // 主动轮（后上方，带齿）
        const lSprocket = makeSprocket(SPROCKET_R, 0.06);
        lSprocket.position.set(-WHEEL_X, SPROCKET_R + 0.04, sprocketZ);
        group.add(lSprocket); leftWheels.push(lSprocket);

        const rSprocket = makeSprocket(SPROCKET_R, 0.06);
        rSprocket.position.set(WHEEL_X, SPROCKET_R + 0.04, sprocketZ);
        group.add(rSprocket); rightWheels.push(rSprocket);

        group.userData.leftWheels = leftWheels;
        group.userData.rightWheels = rightWheels;

        // ═══════════════════════════════
        //  履带环路 — 闭合椭圆包裹行走系统
        // ═══════════════════════════════

        function buildTrack(sideX) {
            const tg = new THREE.Group();
            const segGeo = new THREE.BoxGeometry(0.06, 0.025, 0.22);
            const segLen = 0.22;

            // ── 底部履带段（触地，水平） ──
            const btmSegs = 8;
            const btmStart = -0.59, btmEnd = 0.65;
            const btmStep = (btmEnd - btmStart) / (btmSegs - 1);
            for (let i = 0; i < btmSegs; i++) {
                const seg = new THREE.Mesh(segGeo, trackMat);
                seg.position.set(sideX, TRACK_BTM_Y, btmStart + i * btmStep);
                seg.castShadow = true;
                tg.add(seg);
            }

            // ── 顶部履带段（水平，在负重轮上方） ──
            const topSegs = 7;
            const topStart = -0.52, topEnd = 0.56;
            const topStep = (topEnd - topStart) / (topSegs - 1);
            for (let i = 0; i < topSegs; i++) {
                const seg = new THREE.Mesh(segGeo, trackMat);
                seg.position.set(sideX, TRACK_TOP_Y - 0.01, topStart + i * topStep);
                seg.castShadow = true;
                tg.add(seg);
            }

            // ── 前部弧形段（环绕诱导轮） ──
            const frontArcSegs = 5;
            const frontR = IDLER_R + 0.03;
            const frontCY = IDLER_R + 0.02;
            const frontCZ = idlerZ;
            for (let i = 0; i < frontArcSegs; i++) {
                const seg = new THREE.Mesh(segGeo, trackMat);
                const angle = Math.PI + (i / (frontArcSegs - 1)) * Math.PI;
                seg.position.set(
                    sideX,
                    frontCY + Math.sin(angle) * frontR,
                    frontCZ + Math.cos(angle) * frontR
                );
                seg.rotation.x = -angle;
                seg.castShadow = true;
                tg.add(seg);
            }

            // ── 后部弧形段（环绕主动轮） ──
            const rearArcSegs = 5;
            const rearR = SPROCKET_R + 0.03;
            const rearCY = SPROCKET_R + 0.04;
            const rearCZ = sprocketZ;
            for (let i = 0; i < rearArcSegs; i++) {
                const seg = new THREE.Mesh(segGeo, trackMat);
                const angle = (i / (rearArcSegs - 1)) * Math.PI;
                seg.position.set(
                    sideX,
                    rearCY - Math.sin(angle) * rearR,
                    rearCZ + Math.cos(angle + Math.PI) * rearR
                );
                seg.rotation.x = -(angle + Math.PI);
                seg.castShadow = true;
                tg.add(seg);
            }

            return tg;
        }

        group.add(buildTrack(-WHEEL_X));  // 左履带
        group.add(buildTrack(WHEEL_X));   // 右履带

        // ═══════════════════════════════════════
        //  炮塔 (Turret) — 铸造半球壳体
        // ═══════════════════════════════════════

        const turretGroup = new THREE.Group();

        // 炮塔下半部（近圆柱形，略大于车体宽）
        const turretLowerGeo = new THREE.CylinderGeometry(0.48, 0.51, 0.18, 36);
        const turretLower = new THREE.Mesh(turretLowerGeo, turretMat);
        turretLower.position.y = TURRET_BASE_Y + 0.09;
        turretLower.castShadow = true; turretLower.receiveShadow = true;
        turretGroup.add(turretLower);

        // 炮塔上半部（半球穹顶 — 截顶圆锥 + 倒扣碗）
        const turretDomeGeo = new THREE.SphereGeometry(0.50, 36, 20, 0, Math.PI * 2, 0, Math.PI * 0.46);
        const turretDome = new THREE.Mesh(turretDomeGeo, turretMat);
        turretDome.position.y = TURRET_BASE_Y + 0.18;
        turretDome.castShadow = true;
        turretGroup.add(turretDome);

        // 炮塔前部过渡（让炮塔正面更饱满）
        const turretFrontGeo = new THREE.SphereGeometry(0.49, 24, 16, -0.25, 0.5, 0.15, Math.PI * 0.4);
        const turretFront = new THREE.Mesh(turretFrontGeo, turretMat);
        turretFront.position.set(0, TURRET_BASE_Y + 0.15, 0.02);
        turretFront.castShadow = true;
        turretGroup.add(turretFront);

        // ── 火炮防盾（矩形凸起块） ──
        const mantletGeo = new THREE.BoxGeometry(0.30, 0.22, 0.10);
        const mantlet = new THREE.Mesh(mantletGeo, mantletMat);
        mantlet.position.set(0, TURRET_BASE_Y + 0.18, 0.44);
        mantlet.castShadow = true;
        turretGroup.add(mantlet);

        // ── 指挥塔（偏后中线，小型圆柱凸起） ──
        const cupolaGeo = new THREE.CylinderGeometry(0.08, 0.09, 0.12, 16);
        const cupola = new THREE.Mesh(cupolaGeo, turretMat);
        cupola.position.set(0, TURRET_BASE_Y + 0.39, -0.14);
        cupola.castShadow = true;
        turretGroup.add(cupola);

        // 指挥塔顶盖（圆形舱盖平面）
        const cupolaHatchGeo = new THREE.CylinderGeometry(0.07, 0.07, 0.02, 16);
        const cupolaHatch = new THREE.Mesh(cupolaHatchGeo, detailMat);
        cupolaHatch.position.set(0, TURRET_BASE_Y + 0.46, -0.14);
        turretGroup.add(cupolaHatch);

        // 指挥塔周围小型半球凸起（3个观察口）
        for (let i = 0; i < 3; i++) {
            const bumpGeo = new THREE.SphereGeometry(0.022, 8, 8);
            const bump = new THREE.Mesh(bumpGeo, detailMat);
            const angle = (i / 3) * Math.PI * 2 + 0.3;
            bump.position.set(
                Math.cos(angle) * 0.12,
                TURRET_BASE_Y + 0.41,
                -0.14 + Math.sin(angle) * 0.08
            );
            turretGroup.add(bump);
        }

        group.add(turretGroup);

        // ═══════════════════════════════════════
        //  主炮 (85mm ZIS-S-53) — 细长圆柱体
        // ═══════════════════════════════════════

        const barrelGroup = new THREE.Group();

        // 炮管根部（防盾前方加粗段）
        const barrelBaseGeo = new THREE.CylinderGeometry(0.055, 0.045, 0.18, 12);
        const barrelBase = new THREE.Mesh(barrelBaseGeo, barrelMat);
        barrelBase.rotation.x = -Math.PI / 2;
        barrelBase.position.set(0, TURRET_BASE_Y + 0.18, 0.50 + 0.09);
        barrelBase.castShadow = true;
        barrelGroup.add(barrelBase);

        // 主炮管（4.65m → 1.55 单位长度）
        const barrelGeo = new THREE.CylinderGeometry(0.039, 0.042, 1.48, 12);
        const barrel = new THREE.Mesh(barrelGeo, barrelMat);
        barrel.rotation.x = -Math.PI / 2;
        barrel.position.set(0, TURRET_BASE_Y + 0.18, 0.58 + 0.74);
        barrel.castShadow = true;
        barrelGroup.add(barrel);

        // 抽烟装置（炮管中段1/3处的环状凸起）
        const boreEvacGeo = new THREE.CylinderGeometry(0.058, 0.058, 0.09, 16);
        const boreEvac = new THREE.Mesh(boreEvacGeo, new THREE.MeshStandardMaterial({
            color: '#555555', roughness: 0.35, metalness: 0.65
        }));
        boreEvac.rotation.x = -Math.PI / 2;
        boreEvac.position.set(0, TURRET_BASE_Y + 0.18, 0.58 + 0.55);
        barrelGroup.add(boreEvac);

        // 炮口（略微加粗的末端）
        const muzzleGeo = new THREE.CylinderGeometry(0.043, 0.043, 0.05, 16);
        const muzzle = new THREE.Mesh(muzzleGeo, barrelMat);
        muzzle.rotation.x = -Math.PI / 2;
        muzzle.position.set(0, TURRET_BASE_Y + 0.18, 0.58 + 1.50);
        barrelGroup.add(muzzle);

        group.add(barrelGroup);

        // ═════════════════════
        //  圆形投影阴影
        // ═════════════════════
        const shGeo = new THREE.CircleGeometry(0.6, 32);
        const sh = new THREE.Mesh(shGeo, new THREE.MeshBasicMaterial({
            color: '#000', transparent: true, opacity: 0.3, depthWrite: false
        }));
        sh.rotation.x = -Math.PI / 2;
        sh.position.y = 0.02;
        sh.renderOrder = 1;
        sh.name = 'shadow';
        group.add(sh);

        // 递归启用阴影投射/接收
        group.traverse(c => {
            if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; }
        });

        return group;
    }

    // ─── 注册到模型注册表 ───
    window.ModelRegistry.register('tanks', 't34-85-green',  (opts) => createT34_85({ ...opts, camoColor: 'green' }));
    window.ModelRegistry.register('tanks', 't34-85-desert', (opts) => createT34_85({ ...opts, camoColor: 'desert' }));
})();
