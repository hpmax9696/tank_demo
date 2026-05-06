/**
 * T-34-85 后期型 (Model 1944) — v4 模型修正版
 *
 * 基于与技术图纸的对比修正：
 *   1. 车体：精准船形剖面 — 下部向外展开容纳悬挂，上部收窄
 *   2. 炮塔：六角形铸造炮塔，非圆形旋转体
 *   3. 防盾：大体积铸造包裹式防盾，更符合 T-34/85 特征
 *   4. 翼子板：加宽加厚，覆盖行走装置上部
 *   5. 行走系统：负重轮+悬挂臂可见
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
    const HULL_W_TOP  = 0.86;    // 车体顶部宽度
    const HULL_W_BOT  = 0.98;    // 车体底部宽度（下部外展船形）
    const HULL_L      = 1.72;    // 车体长度
    const HULL_HI     = 0.55;    // 车体顶部 Y
    const HULL_LO     = 0.20;    // 车体底部 Y
    const HULL_H      = HULL_HI - HULL_LO;

    // 60° 首上
    const GLACIS_DZ   = 0.50;
    const FRONT_Z     = HULL_L / 2;
    const GLACIS_TOP_Z = FRONT_Z - GLACIS_DZ;

    const WL_R        = 0.14;    // 负重轮半径
    const WL_W        = 0.055;   // 负重轮宽度
    const IDLER_R     = 0.10;    // 诱导轮半径
    const SPROCKET_R  = 0.18;    // 主动轮半径
    const SPROCKET_Y  = 0.26;    // 主动轮中心 Y
    const WHEEL_X     = 0.52;    // 车轮 X 偏移

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

        // ═══════════════════════════════════════════
        //  车体 — 船形剖面 (上窄下宽)
        // ═══════════════════════════════════════════

        // 使用 3D 船形车体：上部窄、下部宽
        // 构建方式：用 8 个顶点构成车体形状
        
        // 车体各角坐标 (Y, Z平面视角)
        const hw2T = HULL_W_TOP / 2;
        const hw2B = HULL_W_BOT / 2;

        // 创建车体几何体 - 使用 BoxGeometry 作为主体，但在侧面楔形扩展
        // 主车体 (上部分)
        const mainHullGeo = new THREE.BoxGeometry(HULL_W_TOP, HULL_H, HULL_L);
        const mainHull = new THREE.Mesh(mainHullGeo, hullMat);
        mainHull.position.set(0, HULL_LO + HULL_H / 2, 0);
        mainHull.castShadow = true;
        mainHull.receiveShadow = true;
        // 添加顶部倾斜 — 用斜面Shape挤出去除上部前角
        group.add(mainHull);
        group.userData.hull = mainHull;

        // 首上斜面 — ShapeGeometry 覆盖前部
        const glacisShape = new THREE.Shape();
        glacisShape.moveTo(hw2T, HULL_HI);
        glacisShape.lineTo(hw2B, HULL_LO);
        glacisShape.lineTo(-hw2B, HULL_LO);
        glacisShape.lineTo(-hw2T, HULL_HI);
        glacisShape.closePath();

        const glacisGeo = new THREE.ShapeGeometry(glacisShape);
        const glacisMesh = new THREE.Mesh(glacisGeo, hullMat);
        glacisMesh.position.set(0, 0, GLACIS_TOP_Z + 0.001);
        glacisMesh.castShadow = true;
        glacisMesh.receiveShadow = true;
        group.add(glacisMesh);

        // 去除主车体前方的可见部分 — 用另一个矩形面覆盖前部，
        // 形成60°斜面效果
        const frontFaceShape = new THREE.Shape();
        frontFaceShape.moveTo(-hw2B, HULL_LO);
        frontFaceShape.lineTo(hw2B, HULL_LO);
        frontFaceShape.lineTo(hw2T, HULL_HI);
        frontFaceShape.lineTo(-hw2T, HULL_HI);
        frontFaceShape.closePath();

        const frontFaceGeo = new THREE.ShapeGeometry(frontFaceShape);
        const frontFace = new THREE.Mesh(frontFaceGeo, hullMat);
        frontFace.position.set(0, 0, FRONT_Z);
        frontFace.castShadow = true;
        group.add(frontFace);

        // 侧面倾斜护板 (从顶部窄 → 底部宽) — 每侧一块
        for (let side = -1; side <= 1; side += 2) {
            const sideShape = new THREE.Shape();
            sideShape.moveTo(0, HULL_LO);
            sideShape.lineTo(0, HULL_HI);
            sideShape.lineTo(-FRONT_Z, HULL_HI);
            sideShape.lineTo(-FRONT_Z, HULL_LO);
            sideShape.closePath();

            const sideGeo = new THREE.ShapeGeometry(sideShape);
            const sideMesh = new THREE.Mesh(sideGeo, hullMat);
            sideMesh.position.set(side * hw2T, 0, 0);
            sideMesh.castShadow = true;
            sideMesh.receiveShadow = true;
            group.add(sideMesh);

            // 下部外展楔形（接缝到车体底部宽处）
            const flareShape = new THREE.Shape();
            flareShape.moveTo(0, HULL_LO);
            flareShape.lineTo(side * (hw2B - hw2T), HULL_LO);
            flareShape.lineTo(side * (hw2B - hw2T), HULL_HI);
            flareShape.lineTo(0, HULL_HI);
            flareShape.closePath();

            const flareGeo = new THREE.ShapeGeometry(flareShape);
            const flareMesh = new THREE.Mesh(flareGeo, hullMat);
            flareMesh.position.set(side * hw2T, 0, 0);
            flareMesh.castShadow = true;
            group.add(flareMesh);
        }

        // ── 发动机舱顶部 ──
        {
            const engDeckLen = 0.55;
            const engDeckZ = -FRONT_Z + engDeckLen / 2 + 0.04;
            const engDeckGeo = new THREE.BoxGeometry(HULL_W_TOP - 0.06, 0.035, engDeckLen);
            const engDeck = new THREE.Mesh(engDeckGeo, hullMat);
            engDeck.position.set(0, HULL_HI + 0.015, engDeckZ);
            engDeck.castShadow = true;
            group.add(engDeck);

            // 散热格栅
            for (let g = 0; g < 6; g++) {
                const barGeo = new THREE.BoxGeometry(HULL_W_TOP - 0.16, 0.008, 0.02);
                const bar = new THREE.Mesh(barGeo, detailMat);
                bar.position.set(0, HULL_HI + 0.04, engDeckZ - engDeckLen/2 + 0.055 + g*0.09);
                group.add(bar);
            }

            // 两条纵向分隔条
            for (let lx = -1; lx <= 1; lx += 2) {
                const stripGeo = new THREE.BoxGeometry(0.006, 0.010, engDeckLen - 0.06);
                const strip = new THREE.Mesh(stripGeo, detailMat);
                strip.position.set(lx * 0.16, HULL_HI + 0.04, engDeckZ);
                group.add(strip);
            }
        }

        // ── 驾驶员舱盖 + 潜望镜 ──
        {
            const hatchGeo = new THREE.BoxGeometry(0.26, 0.030, 0.20);
            const hatch = new THREE.Mesh(hatchGeo, hullMat);
            hatch.position.set(0, HULL_HI + 0.02, GLACIS_TOP_Z + 0.14);
            hatch.rotation.x = -Math.PI / 14;
            hatch.castShadow = true;
            group.add(hatch);

            const periscopeMat = new THREE.MeshStandardMaterial({ color: '#1a3a1a', roughness: 0.5, metalness: 0.3 });
            const periscope = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.04), periscopeMat);
            periscope.position.set(0, HULL_HI + 0.05, GLACIS_TOP_Z + 0.10);
            group.add(periscope);
        }

        // ── 备用履带挂载（首上右侧）─
        for (let i = 0; i < 3; i++) {
            const linkGeo = new THREE.BoxGeometry(0.010, 0.07, 0.055);
            const link = new THREE.Mesh(linkGeo, detailMat);
            link.position.set(0.20, HULL_LO + 0.07 + i * 0.07, FRONT_Z - 0.08 - i * 0.04);
            link.rotation.y = 0.15;
            group.add(link);
        }

        // ═══════════════════════════════════════
        //  翼子板 (覆盖履带上部)
        // ═══════════════════════════════════════

        for (let side = -1; side <= 1; side += 2) {
            const sx = side * (hw2B + 0.06);
            // 主翼子板（加宽加厚）
            const fenderGeo = new THREE.BoxGeometry(0.07, 0.02, HULL_L - 0.10);
            const fender = new THREE.Mesh(fenderGeo, fenderMat);
            fender.position.set(sx, HULL_LO + 0.010, 0);
            fender.castShadow = true;
            group.add(fender);

            // 翼子板前端挡泥板（向下斜）
            const mudlipGeo = new THREE.BoxGeometry(0.05, 0.06, 0.015);
            const mudlip = new THREE.Mesh(mudlipGeo, fenderMat);
            mudlip.position.set(sx, HULL_LO + 0.045, FRONT_Z - 0.05);
            mudlip.rotation.x = 0.4;
            group.add(mudlip);
        }

        // ═══════════════════════════════════════
        //  行走系统
        // ═══════════════════════════════════════

        const leftWheels = [], rightWheels = [];
        // T-34/85 负重轮 5个：后4个均匀，前1个间距稍大
        const roadWheelZ = [-0.40, -0.14, 0.06, 0.26, 0.44];
        const idlerZ     = 0.72;
        const sprocketZ  = -0.64;

        function makeRoadWheel(radius, width) {
            const wg = new THREE.Group();

            // 轮毂
            const hubGeo2 = new THREE.CylinderGeometry(radius, radius, width, 24);
            const hub = new THREE.Mesh(hubGeo2, hubMat);
            hub.rotation.z = Math.PI / 2;
            wg.add(hub);

            // 橡胶轮缘
            const rimGeo2 = new THREE.TorusGeometry(radius, 0.018, 8, 24);
            const rim = new THREE.Mesh(rimGeo2, rimMat);
            rim.rotation.y = Math.PI / 2;
            wg.add(rim);

            // 内沟槽
            const grooveGeo = new THREE.TorusGeometry(radius - 0.02, 0.008, 8, 24);
            const groove = new THREE.Mesh(grooveGeo, rubberMat);
            groove.rotation.y = Math.PI / 2;
            wg.add(groove);

            // 6根辐条
            for (let s = 0; s < 6; s++) {
                const spokeGeo = new THREE.BoxGeometry(radius * 1.6, 0.015, 0.022);
                const spoke = new THREE.Mesh(spokeGeo, detailMat);
                spoke.rotation.z = (s * Math.PI) / 3;
                wg.add(spoke);
            }

            // 中心小圆盘
            const discGeo = new THREE.CylinderGeometry(radius * 0.28, radius * 0.28, width + 0.005, 16);
            const disc = new THREE.Mesh(discGeo, detailMat);
            disc.rotation.z = Math.PI / 2;
            wg.add(disc);

            return wg;
        }

        function makeSprocket(radius, width) {
            const sg = new THREE.Group();
            const hubGeo2 = new THREE.CylinderGeometry(radius * 0.50, radius * 0.50, width, 20);
            const hub = new THREE.Mesh(hubGeo2, hubMat);
            hub.rotation.z = Math.PI / 2;
            sg.add(hub);

            const ringGeo2 = new THREE.TorusGeometry(radius, 0.03, 8, 24);
            const ring = new THREE.Mesh(ringGeo2, rimMat);
            ring.rotation.y = Math.PI / 2;
            sg.add(ring);

            for (let i = 0; i < 14; i++) {
                const toothGeo = new THREE.BoxGeometry(0.035, 0.05, 0.04);
                const tooth = new THREE.Mesh(toothGeo, wheelMat);
                const angle = (i / 14) * Math.PI * 2;
                tooth.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius, 0);
                tooth.rotation.z = angle;
                sg.add(tooth);
            }
            return sg;
        }

        // 5对负重轮
        for (let i = 0; i < 5; i++) {
            const lw = makeRoadWheel(WL_R, WL_W);
            lw.position.set(-WHEEL_X, WL_R, roadWheelZ[i]);
            group.add(lw); leftWheels.push(lw);

            const rw = makeRoadWheel(WL_R, WL_W);
            rw.position.set(WHEEL_X, WL_R, roadWheelZ[i]);
            group.add(rw); rightWheels.push(rw);

            // 悬挂臂（连接车体到轮子）
            for (let side = -1; side <= 1; side += 2) {
                const armGeo = new THREE.BoxGeometry(0.03, 0.025, 0.04);
                const arm = new THREE.Mesh(armGeo, detailMat);
                const armLen = hw2B - WHEEL_X + 0.08;
                arm.position.set(
                    side * (WHEEL_X + armLen / 2),
                    WL_R,
                    roadWheelZ[i]
                );
                group.add(arm);
            }
        }

        // 诱导轮
        const lIdler = makeRoadWheel(IDLER_R, 0.04);
        lIdler.position.set(-WHEEL_X, IDLER_R + 0.02, idlerZ);
        group.add(lIdler); leftWheels.push(lIdler);
        const rIdler = makeRoadWheel(IDLER_R, 0.04);
        rIdler.position.set(WHEEL_X, IDLER_R + 0.02, idlerZ);
        group.add(rIdler); rightWheels.push(rIdler);

        // 主动轮
        const lSprocket = makeSprocket(SPROCKET_R, 0.06);
        lSprocket.position.set(-WHEEL_X, SPROCKET_Y, sprocketZ);
        group.add(lSprocket); leftWheels.push(lSprocket);
        const rSprocket = makeSprocket(SPROCKET_R, 0.06);
        rSprocket.position.set(WHEEL_X, SPROCKET_Y, sprocketZ);
        group.add(rSprocket); rightWheels.push(rSprocket);

        group.userData.leftWheels  = leftWheels;
        group.userData.rightWheels = rightWheels;

        // ═══════════════════════════════════════
        //  履带
        // ═══════════════════════════════════════

        function buildTrack(sideX) {
            const tg = new THREE.Group();
            const segGeo = new THREE.BoxGeometry(0.07, 0.030, 0.18);
            const segMat = trackMat;

            // 底部
            const btmZ = [-0.50, -0.32, -0.14, 0.04, 0.22, 0.40, 0.56];
            for (const z of btmZ) {
                const seg = new THREE.Mesh(segGeo, segMat);
                seg.position.set(sideX, 0.01, z); seg.castShadow = true; tg.add(seg);
            }

            // 顶部
            const topZ = [-0.44, -0.26, -0.08, 0.10, 0.28, 0.46];
            for (const z of topZ) {
                const seg = new THREE.Mesh(segGeo, segMat);
                seg.position.set(sideX, WL_R * 2 + 0.01, z); seg.castShadow = true; tg.add(seg);
            }

            // 前弧
            const faR = IDLER_R + 0.03, faCY = IDLER_R + 0.02, faCZ = idlerZ;
            for (let i = 0; i < 5; i++) {
                const seg = new THREE.Mesh(segGeo, segMat);
                const angle = Math.PI + (i / 4) * Math.PI;
                seg.position.set(sideX, faCY + Math.sin(angle) * faR, faCZ + Math.cos(angle) * faR);
                seg.rotation.x = -angle; seg.castShadow = true; tg.add(seg);
            }

            // 后弧
            const raR = SPROCKET_R + 0.03, raCY = SPROCKET_Y, raCZ = sprocketZ;
            for (let i = 0; i < 5; i++) {
                const seg = new THREE.Mesh(segGeo, segMat);
                const angle = (i / 4) * Math.PI;
                seg.position.set(sideX, raCY - Math.sin(angle) * raR, raCZ + Math.cos(angle + Math.PI) * raR);
                seg.rotation.x = -(angle + Math.PI); seg.castShadow = true; tg.add(seg);
            }

            return tg;
        }

        group.add(buildTrack(-WHEEL_X));
        group.add(buildTrack(WHEEL_X));

        // ═══════════════════════════════════════
        //  炮塔 — 六角形铸造炮塔（非圆形）
        // ═══════════════════════════════════════

        const turretGroup = new THREE.Group();
        const TURRET_BOTTOM_R = 0.50;  // 底部半径
        const TURRET_TOP_R    = 0.28;  // 顶部半径
        const TURRET_HEIGHT   = 0.34;  // 总高度

        // 六角形炮塔主体 (使用 6 segments)
        // T-34/85 炮塔是六角形 (hexagonal) 铸造炮塔，并非旋转体
        const turretGeo = new THREE.CylinderGeometry(
            TURRET_TOP_R, TURRET_BOTTOM_R, TURRET_HEIGHT, 6
        );
        const turretMesh = new THREE.Mesh(turretGeo, turretMat);
        turretMesh.position.y = TURRET_BASE_Y + TURRET_HEIGHT / 2;
        turretMesh.castShadow = true;
        turretMesh.receiveShadow = true;
        turretGroup.add(turretMesh);

        // 六角形棱边上加圆角（铸造炮塔的特征）
        for (let corner = 0; corner < 6; corner++) {
            const angle = (corner / 6) * Math.PI * 2;
            const radius = TURRET_BOTTOM_R;
            // 垂直线条—在每条棱边上加小圆柱体模拟圆角
            const edgeGeo = new THREE.CylinderGeometry(0.015, 0.015, TURRET_HEIGHT, 4);
            const edge = new THREE.Mesh(edgeGeo, turretMat);
            // 每条棱的位置位于底部六角形的角上
            const angleOffset = (corner / 6) * Math.PI * 2 + Math.PI / 6;
            // 六角形棱角位置
            const cx = Math.cos(angleOffset) * radius;
            const cz = Math.sin(angleOffset) * radius;
            edge.position.set(cx, TURRET_BASE_Y + TURRET_HEIGHT / 2, cz);
            edge.rotation.y = -angleOffset + Math.PI / 6;
            turretGroup.add(edge);
        }

        // 炮塔顶部圆顶（铸造炮塔的圆顶特征）
        const domeGeo = new THREE.SphereGeometry(
            TURRET_TOP_R - 0.02, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.45
        );
        const dome = new THREE.Mesh(domeGeo, turretMat);
        dome.position.y = TURRET_BASE_Y + TURRET_HEIGHT;
        dome.castShadow = true;
        turretGroup.add(dome);

        // 炮塔座圈环
        const ringGeo = new THREE.TorusGeometry(TURRET_BOTTOM_R + 0.02, 0.020, 8, 36);
        const ring = new THREE.Mesh(ringGeo, detailMat);
        ring.position.y = TURRET_BASE_Y;
        ring.rotation.x = Math.PI / 2;
        turretGroup.add(ring);

        // ── 大型包裹式防盾 (T-34/85 标志性特征) ──
        // T-34/85 的防盾是大型铸造件，覆盖炮塔正面很大区域
        
        // 主防盾体 — 用较大球体的一部分
        const mantletSphereGeo = new THREE.SphereGeometry(0.20, 16, 14, 0, Math.PI, 0, Math.PI * 0.6);
        const mantletMain = new THREE.Mesh(mantletSphereGeo, mantletMat);
        mantletMain.position.set(0, TURRET_BASE_Y + 0.18, TURRET_BOTTOM_R + 0.04);
        mantletMain.scale.set(1.2, 0.9, 0.7);
        mantletMain.castShadow = true;
        turretGroup.add(mantletMain);

        // 防盾上部延伸（盖住炮口下方）
        const mantletTop = new THREE.Mesh(
            new THREE.BoxGeometry(0.30, 0.06, 0.08),
            mantletMat
        );
        mantletTop.position.set(0, TURRET_BASE_Y + 0.30, TURRET_BOTTOM_R + 0.04);
        mantletTop.castShadow = true;
        turretGroup.add(mantletTop);

        // 防盾左右延伸
        for (let side = -1; side <= 1; side += 2) {
            const earGeo = new THREE.BoxGeometry(0.06, 0.14, 0.06);
            const ear = new THREE.Mesh(earGeo, mantletMat);
            ear.position.set(side * 0.20, TURRET_BASE_Y + 0.18, TURRET_BOTTOM_R + 0.04);
            ear.castShadow = true;
            turretGroup.add(ear);
        }

        // ── 指挥塔 (后部偏右，带潜望镜) ──
        const CUPOLA_Y = TURRET_BASE_Y + TURRET_HEIGHT + 0.04;

        const cupolaBaseGeo = new THREE.CylinderGeometry(0.10, 0.12, 0.06, 12);
        const cupolaBase = new THREE.Mesh(cupolaBaseGeo, turretMat);
        cupolaBase.position.set(0.02, CUPOLA_Y - 0.03, -0.16);
        cupolaBase.castShadow = true;
        turretGroup.add(cupolaBase);

        const cupolaHatchGeo = new THREE.CylinderGeometry(0.105, 0.11, 0.03, 12);
        const cupolaHatch = new THREE.Mesh(cupolaHatchGeo, detailMat);
        cupolaHatch.position.set(0.02, CUPOLA_Y + 0.01, -0.16);
        turretGroup.add(cupolaHatch);

        // 3个潜望镜
        const periscopeMat2 = new THREE.MeshStandardMaterial({ color: '#1a3a1a', roughness: 0.5, metalness: 0.3 });
        for (let i = 0; i < 3; i++) {
            const prismGeo = new THREE.BoxGeometry(0.015, 0.025, 0.035);
            const prism = new THREE.Mesh(prismGeo, periscopeMat2);
            const angle = (i / 3) * Math.PI * 2 + Math.PI / 2;
            prism.position.set(0.02 + Math.cos(angle) * 0.12, CUPOLA_Y + 0.02, -0.16 + Math.sin(angle) * 0.10);
            turretGroup.add(prism);
        }

        // 顶部2个观察口
        for (let i = 0; i < 2; i++) {
            const bumpGeo = new THREE.SphereGeometry(0.018, 8, 6);
            const bump = new THREE.Mesh(bumpGeo, detailMat);
            bump.position.set(i === 0 ? -0.08 : 0.18, CUPOLA_Y + 0.02, -0.05 + i * 0.06);
            turretGroup.add(bump);
        }

        group.add(turretGroup);

        // ═══════════════════════════════════════
        //  主炮 — 85mm ZiS-S-53
        // ═══════════════════════════════════════

        const barrelGroup = new THREE.Group();
        const BARREL_BASE_Z = TURRET_BOTTOM_R + 0.10;

        // 炮管根部（锥段）
        const barrelRootGeo = new THREE.CylinderGeometry(0.048, 0.034, 0.15, 12);
        const barrelRoot = new THREE.Mesh(barrelRootGeo, barrelMat);
        barrelRoot.rotation.x = -Math.PI / 2;
        barrelRoot.position.set(0, TURRET_BASE_Y + 0.18, BARREL_BASE_Z + 0.08);
        barrelRoot.castShadow = true;
        barrelGroup.add(barrelRoot);

        // 主炮管
        const mainBarrelLen = 1.15;
        const barrelGeo = new THREE.CylinderGeometry(0.030, 0.033, mainBarrelLen, 12);
        const barrel = new THREE.Mesh(barrelGeo, barrelMat);
        barrel.rotation.x = -Math.PI / 2;
        barrel.position.set(0, TURRET_BASE_Y + 0.18, BARREL_BASE_Z + 0.15 + mainBarrelLen / 2);
        barrel.castShadow = true;
        barrelGroup.add(barrel);

        // 抽烟器
        const boreEvacRadius = 0.048;
        const boreEvacGeo = new THREE.CylinderGeometry(boreEvacRadius, boreEvacRadius, 0.08, 16);
        const boreEvac = new THREE.Mesh(boreEvacGeo, new THREE.MeshStandardMaterial({
            color: '#555555', roughness: 0.35, metalness: 0.65
        }));
        boreEvac.rotation.x = -Math.PI / 2;
        boreEvac.position.set(0, TURRET_BASE_Y + 0.18, BARREL_BASE_Z + 0.15 + mainBarrelLen * 0.35);
        barrelGroup.add(boreEvac);

        // 抽烟器加强肋
        for (const offset of [-0.005, 0.005]) {
            const ribGeo = new THREE.TorusGeometry(boreEvacRadius + 0.005, 0.006, 8, 16);
            const rib = new THREE.Mesh(ribGeo, barrelMat);
            rib.rotation.x = -Math.PI / 2;
            rib.position.set(0, TURRET_BASE_Y + 0.18, BARREL_BASE_Z + 0.15 + mainBarrelLen * 0.35 + offset);
            barrelGroup.add(rib);
        }

        // 炮口制退器
        const muzzleGeo = new THREE.CylinderGeometry(0.040, 0.044, 0.10, 16);
        const muzzle = new THREE.Mesh(muzzleGeo, barrelMat);
        muzzle.rotation.x = -Math.PI / 2;
        muzzle.position.set(0, TURRET_BASE_Y + 0.18, BARREL_BASE_Z + 0.15 + mainBarrelLen + 0.05);
        barrelGroup.add(muzzle);

        group.add(barrelGroup);

        // ═══════════════════════════════════════
        //  外部附件
        // ═══════════════════════════════════════

        // 后部圆筒形油箱
        const fuelTankGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.38, 16);
        for (let side = -1; side <= 1; side += 2) {
            const fuelTank = new THREE.Mesh(fuelTankGeo, fuelTankMat);
            fuelTank.rotation.z = Math.PI / 2;
            fuelTank.position.set(side * (hw2B + 0.14), HULL_LO + 0.08, -FRONT_Z + 0.12);
            fuelTank.castShadow = true;
            group.add(fuelTank);
        }

        // 工具箱
        const toolBoxGeo = new THREE.BoxGeometry(0.18, 0.06, 0.10);
        const toolBox = new THREE.Mesh(toolBoxGeo, toolBoxMat);
        toolBox.position.set(0, HULL_LO + 0.04, -FRONT_Z + 0.36);
        toolBox.castShadow = true;
        group.add(toolBox);

        // 缆绳
        const cableMat = new THREE.MeshStandardMaterial({ color: '#444444', roughness: 0.80, metalness: 0.40 });
        for (let ci = 0; ci < 2; ci++) {
            const cableGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.55, 6);
            const cable = new THREE.Mesh(cableGeo, cableMat);
            cable.rotation.x = Math.PI / 2 + 0.1;
            cable.position.set(hw2B + 0.10, HULL_LO + 0.10, -0.05 + ci * 0.35);
            cable.rotation.z = 0.1;
            group.add(cable);
        }

        // 前灯
        const headlightGroup = new THREE.Group();
        const hlBaseGeo = new THREE.CylinderGeometry(0.04, 0.045, 0.04, 12);
        const hlBase = new THREE.Mesh(hlBaseGeo, detailMat);
        hlBase.rotation.x = Math.PI / 2;
        headlightGroup.add(hlBase);
        const hlLensMat = new THREE.MeshStandardMaterial({
            color: '#ffffee', roughness: 0.10, metalness: 0.05, emissive: '#ffffcc', emissiveIntensity: 0.1
        });
        const hlLensGeo = new THREE.SphereGeometry(0.035, 12, 12, 0, Math.PI * 2, 0, Math.PI / 2);
        const hlLens = new THREE.Mesh(hlLensGeo, hlLensMat);
        hlLens.rotation.x = -Math.PI / 2;
        hlLens.position.z = 0.04;
        headlightGroup.add(hlLens);
        headlightGroup.position.set(hw2B + 0.08, HULL_LO + 0.07, FRONT_Z - 0.20);
        group.add(headlightGroup);

        // 排气管
        for (let side = -1; side <= 1; side += 2) {
            const exhaustGeo = new THREE.CylinderGeometry(0.025, 0.030, 0.08, 8);
            const exhaust = new THREE.Mesh(exhaustGeo, detailMat);
            exhaust.rotation.x = Math.PI / 2;
            exhaust.position.set(side * 0.20, HULL_LO + 0.02, -FRONT_Z - 0.04);
            group.add(exhaust);

            const exCoverGeo = new THREE.TorusGeometry(0.033, 0.008, 8, 12);
            const exCover = new THREE.Mesh(exCoverGeo, detailMat);
            exCover.rotation.y = Math.PI / 2;
            exCover.position.set(side * 0.20, HULL_LO + 0.02, -FRONT_Z - 0.04);
            group.add(exCover);
        }

        // ═══════════════════════════════════════
        //  阴影
        // ═══════════════════════════════════════

        const shGeo = new THREE.CircleGeometry(0.72, 32);
        const sh = new THREE.Mesh(shGeo, new THREE.MeshBasicMaterial({
            color: '#000', transparent: true, opacity: 0.25, depthWrite: false
        }));
        sh.rotation.x = -Math.PI / 2;
        sh.position.y = 0.015;
        sh.renderOrder = 1;
        sh.name = 'shadow';
        group.add(sh);

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
