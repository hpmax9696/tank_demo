/**
 * T-34-85 后期型 (Model 1944) — v3 终极重制版
 *
 * 基于 T-34/85 真实技术图纸重建，改进：
 *   1. 车体：精确 60° 首上倾角、侧面下斜、发动机舱细节
 *   2. 炮塔：真实的铸造六角形蘑菇状轮廓 (LatheGeometry)
 *   3. 防盾：大型包裹式铸造防盾
 *   4. 翼子板：覆盖行走系统的侧裙板
 *   5. 外部附件：圆筒形油箱、缆绳、工具箱、前灯、备用履带
 *   6. 行走系统：精确负重轮间距（第1、2轮距更大）+ 橡胶轮缘
 *   7. 指挥塔：带3个潜望镜的圆形指挥塔
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

    // ─── 比例常量 ───
    const HULL_W = 0.94;          // 车体宽度
    const HULL_L = 1.72;          // 车体长度 (z方向)
    const HULL_HI = 0.55;         // 车体顶面 Y
    const HULL_LO = 0.22;         // 车体底面 Y
    const HULL_H = HULL_HI - HULL_LO; // 0.33

    // 60° 首上装甲 (从水平面30°)
    const GLACIS_DZ = 0.52;
    const FRONT_Z = HULL_L / 2;   // 0.86
    const GLACIS_TOP_Z = FRONT_Z - GLACIS_DZ; // 0.34

    const WL_R = 0.14;            // 负重轮半径
    const WL_W = 0.055;           // 负重轮宽度
    const IDLER_R = 0.10;         // 诱导轮半径
    const SPROCKET_R = 0.19;      // 主动轮半径 (稍大)
    const SPROCKET_Y = 0.24;      // 主动轮中心 Y (高于负重轮)
    const WHEEL_X = 0.54;         // 车轮 X 偏移

    const TURRET_BASE_Y = HULL_HI; // 炮塔座圈 Y

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
        const metalMat   = new THREE.MeshStandardMaterial({ color: '#555555', roughness: 0.30, metalness: 0.70 });

        // ═══════════════════════════════════════════
        //  车体 — 60° 首上，两段式侧面
        // ═══════════════════════════════════════════

        // 侧面轮廓 (XY平面: X=前后Z, Y=上下)
        const hullProfile = new THREE.Shape();
        // 前下 → 首上顶端 (60°斜线)
        hullProfile.moveTo(FRONT_Z, HULL_LO);
        hullProfile.lineTo(GLACIS_TOP_Z, HULL_HI);
        // 发动机舱后部 (水平)
        hullProfile.lineTo(-FRONT_Z, HULL_HI);
        hullProfile.lineTo(-FRONT_Z, HULL_LO);
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

        // ── 车体侧面装甲（微微外斜以增强真实感）─
        for (let side = -1; side <= 1; side += 2) {
            const sideShape2 = new THREE.Shape();
            sideShape2.moveTo(GLACIS_TOP_Z, HULL_LO);
            sideShape2.lineTo(GLACIS_TOP_Z, HULL_HI);
            sideShape2.lineTo(-FRONT_Z, HULL_HI);
            sideShape2.lineTo(-FRONT_Z, HULL_LO);
            sideShape2.closePath();

            const sideGeo2 = new THREE.ShapeGeometry(sideShape2);
            const sideMesh2 = new THREE.Mesh(sideGeo2, hullMat);
            sideMesh2.position.set(side * (HULL_W / 2), 0, 0);
            sideMesh2.castShadow = true;
            sideMesh2.receiveShadow = true;
            group.add(sideMesh2);
        }

        // ═══════════════════════════════════════
        //  发动机舱顶板 + 散热格栅
        // ═══════════════════════════════════════

        const engDeckLen = 0.58;
        const engDeckZ = -FRONT_Z + engDeckLen / 2 + 0.03;

        // 发动机舱盖板
        const engDeckGeo = new THREE.BoxGeometry(HULL_W - 0.08, 0.04, engDeckLen);
        const engDeck = new THREE.Mesh(engDeckGeo, hullMat);
        engDeck.position.set(0, HULL_HI + 0.02, engDeckZ);
        engDeck.castShadow = true;
        group.add(engDeck);

        // 散热格栅 — 6条平行条
        for (let g = 0; g < 6; g++) {
            const barW = HULL_W - 0.18;
            const barGeo = new THREE.BoxGeometry(barW, 0.008, 0.025);
            const bar = new THREE.Mesh(barGeo, detailMat);
            bar.position.set(0, HULL_HI + 0.045,
                engDeckZ - engDeckLen / 2 + 0.06 + g * 0.09);
            group.add(bar);
        }

        // 两条纵向分隔条
        for (let lx = -1; lx <= 1; lx += 2) {
            const stripGeo = new THREE.BoxGeometry(0.008, 0.010, engDeckLen - 0.08);
            const strip = new THREE.Mesh(stripGeo, detailMat);
            strip.position.set(lx * 0.18, HULL_HI + 0.045, engDeckZ);
            group.add(strip);
        }

        // ═══════════════════════════════════════
        //  首上装甲细节
        // ═══════════════════════════════════════

        // 驾驶员舱盖（首上顶端偏中，略微凸起）
        const driverHatchGeo = new THREE.BoxGeometry(0.28, 0.035, 0.22);
        const driverHatch = new THREE.Mesh(driverHatchGeo, hullMat);
        driverHatch.position.set(0, HULL_HI + 0.025, GLACIS_TOP_Z + 0.12);
        driverHatch.rotation.x = -Math.PI / 14;
        driverHatch.castShadow = true;
        group.add(driverHatch);

        // 驾驶员潜望镜
        const periscopeGeo = new THREE.BoxGeometry(0.04, 0.04, 0.04);
        const periscopeMat = new THREE.MeshStandardMaterial({ color: '#1a3a1a', roughness: 0.5, metalness: 0.3 });
        const periscope = new THREE.Mesh(periscopeGeo, periscopeMat);
        periscope.position.set(0, HULL_HI + 0.055, GLACIS_TOP_Z + 0.08);
        group.add(periscope);

        // 备用履带挂载点（首上右侧）
        for (let i = 0; i < 3; i++) {
            const trackLinkGeo = new THREE.BoxGeometry(0.010, 0.08, 0.06);
            const trackLink = new THREE.Mesh(trackLinkGeo, detailMat);
            trackLink.position.set(0.22, HULL_LO + 0.08 + i * 0.07, FRONT_Z - 0.08 - i * 0.05);
            trackLink.rotation.y = 0.15;
            group.add(trackLink);
        }

        // ═══════════════════════════════════════
        //  翼子板（侧裙板）
        // ═══════════════════════════════════════

        for (let side = -1; side <= 1; side += 2) {
            const sx = side * (HULL_W / 2 + 0.08);

            // 主翼子板
            const fenderGeo = new THREE.BoxGeometry(0.06, 0.015, HULL_L - 0.15);
            const fender = new THREE.Mesh(fenderGeo, fenderMat);
            fender.position.set(sx, HULL_LO + 0.015, 0);
            fender.castShadow = true;
            group.add(fender);

            // 翼子板支撑（前/后）
            for (const fz of [FRONT_Z - 0.12, -FRONT_Z + 0.12]) {
                const supGeo = new THREE.BoxGeometry(0.04, 0.06, 0.03);
                const sup = new THREE.Mesh(supGeo, detailMat);
                sup.position.set(side * (HULL_W / 2 - 0.01), HULL_LO - 0.03, fz);
                group.add(sup);
            }

            // 翼子板前端倾斜（小挡板）
            const lipGeo = new THREE.BoxGeometry(0.04, 0.05, 0.015);
            const lip = new THREE.Mesh(lipGeo, fenderMat);
            lip.position.set(sx, HULL_LO + 0.035, FRONT_Z - 0.06);
            lip.rotation.x = 0.3;
            group.add(lip);
        }

        // ═══════════════════════════════════════
        //  行走系统 — 负重轮 / 诱导轮 / 主动轮
        // ═══════════════════════════════════════

        const leftWheels = [], rightWheels = [];

        // T-34/85 负重轮间距：1-2轮间距较大 > 2-3=3-4=4-5
        const roadWheelZ = [-0.40, -0.14, 0.07, 0.27, 0.45];
        const idlerZ     = 0.74;
        const sprocketZ  = -0.65;

        function makeRoadWheel(radius, width, hasSpokes) {
            const wg = new THREE.Group();

            // 轮毂主体
            const hubGeo = new THREE.CylinderGeometry(radius, radius, width, 24);
            const hub = new THREE.Mesh(hubGeo, hubMat);
            hub.rotation.z = Math.PI / 2;
            wg.add(hub);

            // 橡胶轮缘（外圈浅色环）
            const rimGeo = new THREE.TorusGeometry(radius, 0.018, 8, 24);
            const rim = new THREE.Mesh(rimGeo, rimMat);
            rim.rotation.y = Math.PI / 2;
            wg.add(rim);

            // 橡胶缘外侧沟槽
            const grooveGeo = new THREE.TorusGeometry(radius - 0.02, 0.008, 8, 24);
            const groove = new THREE.Mesh(grooveGeo, rubberMat);
            groove.rotation.y = Math.PI / 2;
            wg.add(groove);

            if (hasSpokes) {
                // 6根辐条
                for (let s = 0; s < 6; s++) {
                    const spokeGeo = new THREE.BoxGeometry(radius * 1.6, 0.015, 0.025);
                    const spoke = new THREE.Mesh(spokeGeo, detailMat);
                    spoke.rotation.z = (s * Math.PI) / 3;
                    wg.add(spoke);
                }

                // 中心小圆盘
                const discGeo = new THREE.CylinderGeometry(radius * 0.30, radius * 0.30, width + 0.005, 16);
                const disc = new THREE.Mesh(discGeo, detailMat);
                disc.rotation.z = Math.PI / 2;
                wg.add(disc);
            }

            return wg;
        }

        // 主动轮（后上方，更大更高，带齿缘）
        function makeSprocket(radius, width) {
            const sg = new THREE.Group();

            // 内轮毂
            const hubGeo = new THREE.CylinderGeometry(radius * 0.50, radius * 0.50, width, 20);
            const hub = new THREE.Mesh(hubGeo, hubMat);
            hub.rotation.z = Math.PI / 2;
            sg.add(hub);

            // 外齿缘环
            const ringGeo = new THREE.TorusGeometry(radius, 0.03, 8, 24);
            const ring = new THREE.Mesh(ringGeo, rimMat);
            ring.rotation.y = Math.PI / 2;
            sg.add(ring);

            // 14个齿轮齿
            for (let i = 0; i < 14; i++) {
                const toothGeo = new THREE.BoxGeometry(0.035, 0.055, 0.04);
                const tooth = new THREE.Mesh(toothGeo, wheelMat);
                const angle = (i / 14) * Math.PI * 2;
                tooth.position.set(
                    Math.cos(angle) * radius,
                    Math.sin(angle) * radius, 0);
                tooth.rotation.z = angle;
                sg.add(tooth);
            }
            return sg;
        }

        // 5对负重轮（T-34/85标准）
        for (let i = 0; i < 5; i++) {
            const lw = makeRoadWheel(WL_R, WL_W, true);
            lw.position.set(-WHEEL_X, WL_R, roadWheelZ[i]);
            group.add(lw); leftWheels.push(lw);

            const rw = makeRoadWheel(WL_R, WL_W, true);
            rw.position.set(WHEEL_X, WL_R, roadWheelZ[i]);
            group.add(rw); rightWheels.push(rw);
        }

        // 诱导轮（前下方，较小，无辐条）
        const lIdler = makeRoadWheel(IDLER_R, 0.045, false);
        lIdler.position.set(-WHEEL_X, IDLER_R + 0.02, idlerZ);
        group.add(lIdler); leftWheels.push(lIdler);
        const rIdler = makeRoadWheel(IDLER_R, 0.045, false);
        rIdler.position.set(WHEEL_X, IDLER_R + 0.02, idlerZ);
        group.add(rIdler); rightWheels.push(rIdler);

        // 主动轮（后上方，更大更高）
        const lSprocket = makeSprocket(SPROCKET_R, 0.06);
        lSprocket.position.set(-WHEEL_X, SPROCKET_Y, sprocketZ);
        group.add(lSprocket); leftWheels.push(lSprocket);
        const rSprocket = makeSprocket(SPROCKET_R, 0.06);
        rSprocket.position.set(WHEEL_X, SPROCKET_Y, sprocketZ);
        group.add(rSprocket); rightWheels.push(rSprocket);

        group.userData.leftWheels  = leftWheels;
        group.userData.rightWheels = rightWheels;

        // ═══════════════════════════════════════
        //  履带环路 — 详细分段
        // ═══════════════════════════════════════

        function buildTrack(sideX) {
            const tg = new THREE.Group();
            const segGeo = new THREE.BoxGeometry(0.07, 0.03, 0.18);

            // 底部触地段（7片）
            const btmZ = [-0.52, -0.34, -0.16, 0.02, 0.20, 0.38, 0.56];
            for (const z of btmZ) {
                const seg = new THREE.Mesh(segGeo, trackMat);
                seg.position.set(sideX, 0.01, z);
                seg.castShadow = true;
                tg.add(seg);
            }

            // 顶部水平段（6片）
            const topZ = [-0.46, -0.28, -0.10, 0.08, 0.26, 0.44];
            for (const z of topZ) {
                const seg = new THREE.Mesh(segGeo, trackMat);
                seg.position.set(sideX, WL_R * 2 + 0.01, z);
                seg.castShadow = true;
                tg.add(seg);
            }

            // 前部弧形（诱导轮）
            const faR = IDLER_R + 0.03;
            const faCY = IDLER_R + 0.02;
            const faCZ = idlerZ;
            for (let i = 0; i < 5; i++) {
                const seg = new THREE.Mesh(segGeo, trackMat);
                const angle = Math.PI + (i / 4) * Math.PI;
                seg.position.set(sideX,
                    faCY + Math.sin(angle) * faR,
                    faCZ + Math.cos(angle) * faR);
                seg.rotation.x = -angle;
                seg.castShadow = true;
                tg.add(seg);
            }

            // 后部弧形（主动轮）
            const raR = SPROCKET_R + 0.03;
            const raCY = SPROCKET_Y;
            const raCZ = sprocketZ;
            for (let i = 0; i < 5; i++) {
                const seg = new THREE.Mesh(segGeo, trackMat);
                const angle = (i / 4) * Math.PI;
                seg.position.set(sideX,
                    raCY - Math.sin(angle) * raR,
                    raCZ + Math.cos(angle + Math.PI) * raR);
                seg.rotation.x = -(angle + Math.PI);
                seg.castShadow = true;
                tg.add(seg);
            }

            // 履带导齿（沿底部加细小齿）
            for (let i = 0; i < 8; i++) {
                const guideGeo = new THREE.BoxGeometry(0.04, 0.025, 0.02);
                const guide = new THREE.Mesh(guideGeo, detailMat);
                const gz = -0.58 + i * 0.16;
                guide.position.set(sideX, 0.03, gz);
                tg.add(guide);
            }

            return tg;
        }

        group.add(buildTrack(-WHEEL_X));
        group.add(buildTrack(WHEEL_X));

        // ═══════════════════════════════════════
        //  炮塔 — 真实铸造六角形蘑菇状轮廓
        // ═══════════════════════════════════════

        const turretGroup = new THREE.Group();
        const TURRET_RADIUS = 0.50; // 底部半径

        // 使用 LatheGeometry 绘制精确的 T-34/85 炮塔剖面
        // 剖面点集 (x=半径, y=高度, 相对炮塔座圈)
        const turretPoints = [
            // 座圈底部 — 略宽于车体
            { x: TURRET_RADIUS, y: 0 },
            // 下部垂直段
            { x: TURRET_RADIUS, y: 0.03 },
            // 向外微张（铸造炮塔底部厚壁）
            { x: TURRET_RADIUS + 0.03, y: 0.08 },
            // 中部 — 最宽处
            { x: TURRET_RADIUS + 0.05, y: 0.16 },
            // 肩部 — 开始上收
            { x: TURRET_RADIUS - 0.02, y: 0.24 },
            // 上肩 — 急收
            { x: TURRET_RADIUS - 0.15, y: 0.30 },
            // 炮塔顶 — 平面
            { x: TURRET_RADIUS - 0.20, y: 0.34 },
            // 顶中央
            { x: 0, y: 0.34 }
        ];

        const turretVec2 = turretPoints.map(p =>
            new THREE.Vector2(p.x, p.y));
        const turretLatheGeo = new THREE.LatheGeometry(turretVec2, 36);
        const turretLathe = new THREE.Mesh(turretLatheGeo, turretMat);
        turretLathe.position.y = TURRET_BASE_Y;
        turretLathe.castShadow = true;
        turretLathe.receiveShadow = true;
        turretGroup.add(turretLathe);

        // 炮塔环（座圈加强环）
        const ringGeo2 = new THREE.TorusGeometry(TURRET_RADIUS + 0.02, 0.02, 8, 36);
        const ring2 = new THREE.Mesh(ringGeo2, detailMat);
        ring2.position.y = TURRET_BASE_Y;
        ring2.rotation.x = Math.PI / 2;
        turretGroup.add(ring2);

        // ── 大型包裹式铸造防盾 ──
        const mantletGroup = new THREE.Group();

        // 主防盾体（圆弧形）
        const mantletShape = new THREE.Shape();
        mantletShape.moveTo(-0.22, -0.12);
        mantletShape.quadraticCurveTo(-0.24, 0, -0.18, 0.10);
        mantletShape.lineTo(0.18, 0.10);
        mantletShape.quadraticCurveTo(0.24, 0, 0.22, -0.12);
        mantletShape.closePath();

        const mantletGeo2 = new THREE.ExtrudeGeometry(mantletShape, {
            depth: 0.10, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02
        });
        const mantlet2 = new THREE.Mesh(mantletGeo2, mantletMat);
        mantlet2.position.set(0, TURRET_BASE_Y + 0.17, TURRET_RADIUS + 0.04);
        mantlet2.rotation.y = 0;
        mantlet2.castShadow = true;
        mantletGroup.add(mantlet2);

        // 防盾上平面（加强）
        const mantletTopGeo = new THREE.BoxGeometry(0.34, 0.015, 0.08);
        const mantletTop = new THREE.Mesh(mantletTopGeo, mantletMat);
        mantletTop.position.set(0, TURRET_BASE_Y + 0.29, TURRET_RADIUS + 0.06);
        turretGroup.add(mantletTop);

        turretGroup.add(mantletGroup);

        // ── 指挥塔（后部偏右，带3个潜望镜）─
        const CUPOLA_Y = TURRET_BASE_Y + 0.34;

        // 指挥塔底座
        const cupolaBaseGeo = new THREE.CylinderGeometry(0.09, 0.11, 0.06, 16);
        const cupolaBase = new THREE.Mesh(cupolaBaseGeo, turretMat);
        cupolaBase.position.set(0.02, CUPOLA_Y - 0.03, -0.15);
        cupolaBase.castShadow = true;
        turretGroup.add(cupolaBase);

        // 指挥塔顶盖
        const cupolaHatchGeo = new THREE.CylinderGeometry(0.095, 0.10, 0.03, 16);
        const cupolaHatch = new THREE.Mesh(cupolaHatchGeo, detailMat);
        cupolaHatch.position.set(0.02, CUPOLA_Y + 0.01, -0.15);
        turretGroup.add(cupolaHatch);

        // 3个潜望镜（指挥塔周边）
        for (let i = 0; i < 3; i++) {
            const prismGeo = new THREE.BoxGeometry(0.015, 0.025, 0.035);
            const prism = new THREE.Mesh(prismGeo, periscopeMat);
            const angle = (i / 3) * Math.PI * 2 + Math.PI / 2;
            prism.position.set(
                0.02 + Math.cos(angle) * 0.12,
                CUPOLA_Y + 0.02,
                -0.15 + Math.sin(angle) * 0.10
            );
            turretGroup.add(prism);
        }

        // 炮塔顶部观察口（半球小凸起 × 2）
        for (let i = 0; i < 2; i++) {
            const bumpGeo = new THREE.SphereGeometry(0.018, 8, 6);
            const bump = new THREE.Mesh(bumpGeo, detailMat);
            bump.position.set(
                (i === 0 ? -0.08 : 0.18),
                CUPOLA_Y + 0.02,
                -0.05 + i * 0.06
            );
            turretGroup.add(bump);
        }

        group.add(turretGroup);

        // ═══════════════════════════════════════
        //  主炮 — 85mm ZiS-S-53
        // ═══════════════════════════════════════

        const barrelGroup = new THREE.Group();
        const BARREL_BASE_Z = TURRET_RADIUS + 0.10;

        // 炮管根部（锥段，防盾内部不可见但用于过渡）
        const barrelRootGeo = new THREE.CylinderGeometry(0.050, 0.036, 0.15, 12);
        const barrelRoot = new THREE.Mesh(barrelRootGeo, barrelMat);
        barrelRoot.rotation.x = -Math.PI / 2;
        barrelRoot.position.set(0, TURRET_BASE_Y + 0.17, BARREL_BASE_Z + 0.08);
        barrelRoot.castShadow = true;
        barrelGroup.add(barrelRoot);

        // 主炮管 — 长约1.15，细长
        const mainBarrelLen = 1.15;
        const barrelGeo = new THREE.CylinderGeometry(0.030, 0.033, mainBarrelLen, 12);
        const barrel = new THREE.Mesh(barrelGeo, barrelMat);
        barrel.rotation.x = -Math.PI / 2;
        barrel.position.set(0, TURRET_BASE_Y + 0.17, BARREL_BASE_Z + 0.15 + mainBarrelLen / 2);
        barrel.castShadow = true;
        barrelGroup.add(barrel);

        // 抽烟器环（中后段约1/3处）
        const boreEvacRadius = 0.050;
        const boreEvacGeo = new THREE.CylinderGeometry(boreEvacRadius, boreEvacRadius, 0.08, 16);
        const boreEvac = new THREE.Mesh(boreEvacGeo, new THREE.MeshStandardMaterial({
            color: '#555555', roughness: 0.35, metalness: 0.65
        }));
        boreEvac.rotation.x = -Math.PI / 2;
        boreEvac.position.set(0, TURRET_BASE_Y + 0.17,
            BARREL_BASE_Z + 0.15 + mainBarrelLen * 0.35);
        barrelGroup.add(boreEvac);

        // 抽烟器加强肋（上下两端）
        for (const offset of [-0.005, 0.005]) {
            const ribGeo = new THREE.TorusGeometry(boreEvacRadius + 0.005, 0.006, 8, 16);
            const rib = new THREE.Mesh(ribGeo, barrelMat);
            rib.rotation.x = -Math.PI / 2;
            rib.position.set(0, TURRET_BASE_Y + 0.17,
                BARREL_BASE_Z + 0.15 + mainBarrelLen * 0.35 + offset);
            barrelGroup.add(rib);
        }

        // 炮口制退器
        const muzzleGeo = new THREE.CylinderGeometry(0.042, 0.045, 0.10, 16);
        const muzzle = new THREE.Mesh(muzzleGeo, barrelMat);
        muzzle.rotation.x = -Math.PI / 2;
        muzzle.position.set(0, TURRET_BASE_Y + 0.17,
            BARREL_BASE_Z + 0.15 + mainBarrelLen + 0.05);
        barrelGroup.add(muzzle);

        // 炮口斜面
        const muzzleFaceGeo = new THREE.RingGeometry(0.022, 0.042, 16);
        const muzzleFace = new THREE.Mesh(muzzleFaceGeo, detailMat);
        muzzleFace.rotation.x = Math.PI / 2;
        muzzleFace.position.set(0, TURRET_BASE_Y + 0.17,
            BARREL_BASE_Z + 0.15 + mainBarrelLen + 0.10);
        barrelGroup.add(muzzleFace);

        group.add(barrelGroup);

        // ═══════════════════════════════════════
        //  外部附件
        // ═══════════════════════════════════════

        // ── 后部圆筒形燃油箱（T-34/85标志性附件）─
        const fuelTankGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.40, 16);
        const fuelTankMat2 = new THREE.MeshStandardMaterial({
            color: c.fuelTank, roughness: 0.70, metalness: 0.10
        });

        for (let side = -1; side <= 1; side += 2) {
            const fuelTank = new THREE.Mesh(fuelTankGeo, fuelTankMat2);
            fuelTank.rotation.z = Math.PI / 2;
            fuelTank.position.set(
                side * (HULL_W / 2 + 0.15),
                HULL_LO + 0.08,
                -FRONT_Z + 0.10
            );
            fuelTank.castShadow = true;
            group.add(fuelTank);

            // 油箱绑带
            for (let b = -1; b <= 1; b += 2) {
                const strapGeo = new THREE.BoxGeometry(0.005, 0.005, 0.44);
                const strap = new THREE.Mesh(strapGeo, detailMat);
                strap.position.set(
                    side * (HULL_W / 2 + 0.15 + b * 0.05),
                    HULL_LO + 0.08,
                    -FRONT_Z + 0.10
                );
                group.add(strap);
            }
        }

        // ── 后部工具箱 ──
        const toolBoxGeo = new THREE.BoxGeometry(0.18, 0.06, 0.10);
        const toolBox = new THREE.Mesh(toolBoxGeo, toolBoxMat);
        toolBox.position.set(0, HULL_LO + 0.04, -FRONT_Z + 0.35);
        toolBox.castShadow = true;
        group.add(toolBox);

        // ── 右侧缆绳 ──
        const cableMat = new THREE.MeshStandardMaterial({
            color: '#444444', roughness: 0.80, metalness: 0.40
        });
        for (let ci = 0; ci < 2; ci++) {
            const cableGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.60, 6);
            const cable = new THREE.Mesh(cableGeo, cableMat);
            cable.rotation.x = Math.PI / 2 + 0.1;
            cable.position.set(HULL_W / 2 + 0.12, HULL_LO + 0.10, -0.10 + ci * 0.35);
            cable.rotation.z = 0.1;
            group.add(cable);
        }

        // ── 前灯（左翼子板前方）─
        const headlightGroup = new THREE.Group();
        const hlBaseGeo = new THREE.CylinderGeometry(0.04, 0.045, 0.04, 12);
        const hlBase = new THREE.Mesh(hlBaseGeo, detailMat);
        hlBase.rotation.x = Math.PI / 2;
        headlightGroup.add(hlBase);

        const hlLensGeo = new THREE.SphereGeometry(0.035, 12, 12, 0, Math.PI * 2, 0, Math.PI / 2);
        const hlLensMat = new THREE.MeshStandardMaterial({
            color: '#ffffee', roughness: 0.10, metalness: 0.05, emissive: '#ffffcc', emissiveIntensity: 0.1
        });
        const hlLens = new THREE.Mesh(hlLensGeo, hlLensMat);
        hlLens.rotation.x = -Math.PI / 2;
        hlLens.position.z = 0.04;
        headlightGroup.add(hlLens);

        headlightGroup.position.set(
            HULL_W / 2 + 0.10,
            HULL_LO + 0.07,
            FRONT_Z - 0.22
        );
        group.add(headlightGroup);

        // 前灯右侧的备用小灯
        const smLampGeo = new THREE.SphereGeometry(0.018, 8, 8);
        const smLampMat = new THREE.MeshStandardMaterial({
            color: '#ddddaa', roughness: 0.2, metalness: 0.1
        });
        const smLamp = new THREE.Mesh(smLampGeo, smLampMat);
        smLamp.position.set(HULL_W / 2 + 0.14, HULL_LO + 0.07, FRONT_Z - 0.12);
        group.add(smLamp);

        // ── 尾部排气管 ──
        for (let side = -1; side <= 1; side += 2) {
            const exhaustGeo = new THREE.CylinderGeometry(0.025, 0.030, 0.08, 8);
            const exhaust = new THREE.Mesh(exhaustGeo, detailMat);
            exhaust.rotation.x = Math.PI / 2;
            exhaust.position.set(
                side * 0.20,
                HULL_LO + 0.02,
                -FRONT_Z - 0.04
            );
            group.add(exhaust);

            // 排气管罩
            const exCoverGeo = new THREE.TorusGeometry(0.033, 0.008, 8, 12);
            const exCover = new THREE.Mesh(exCoverGeo, detailMat);
            exCover.rotation.y = Math.PI / 2;
            exCover.position.set(
                side * 0.20,
                HULL_LO + 0.02,
                -FRONT_Z - 0.04
            );
            group.add(exCover);
        }

        // ═══════════════════════════════════════
        //  圆形投影阴影
        // ═══════════════════════════════════════

        const shGeo = new THREE.CircleGeometry(0.70, 32);
        const sh = new THREE.Mesh(shGeo, new THREE.MeshBasicMaterial({
            color: '#000', transparent: true, opacity: 0.25, depthWrite: false
        }));
        sh.rotation.x = -Math.PI / 2;
        sh.position.y = 0.015;
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
