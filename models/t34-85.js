/**
 * T-34-85 后期型 (Model 1944) — v6.1 修正版
 *
 * 基于 T-34/85 实车照片全面重构：
 *   1. 炮塔：LatheGeometry 铸造轮廓，圆润"胖蘑菇"形
 *   2. 防盾：大型铸造包裹式防盾，与炮塔正面融合
 *   3. 指挥塔：小型圆柱体+舱门
 *   4. 车体：带倾斜尾板的船形剖面，发动机舱斜顶
 *   5. 履带：TorusGeometry连续圆弧+密集小段，真正包覆负重轮
 *   6. 负重轮加大，履带加宽
 */
(function() {
    const CAMO = {
        green: {
            hull: '#4a5c2e', turret: '#3d4f25', track: '#2a2a2a',
            wheel: '#444444', hub: '#777777', barrel: '#333333',
            mantlet: '#353535', rim: '#3a3a3a', fender: '#3d4f25',
            fuelTank: '#4a5c2e', toolBox: '#3d4f25'
        },
        desert: {
            hull: '#8b7d4a', turret: '#6d6038', track: '#3a3525',
            wheel: '#5a5a45', hub: '#999980', barrel: '#444433',
            mantlet: '#48483a', rim: '#5a5a45', fender: '#6d6038',
            fuelTank: '#8b7d4a', toolBox: '#6d6038'
        }
    };

    // ─── 尺寸常量（基于真实 T-34/85 比例） ───
    const HULL_W     = 0.96;     // 车体全宽
    const HULL_L     = 1.70;     // 车体长度 (z)
    const HULL_TOP   = 0.48;     // 车体顶面 Y（降低！）
    const HULL_BOT   = 0.22;     // 车体底面 Y
    const HULL_H     = HULL_TOP - HULL_BOT;

    // 首上装甲
    const GLACIS_LEN = 0.52;
    const FRONT_Z    = HULL_L / 2;
    const GLACIS_TOP_Z = FRONT_Z - GLACIS_LEN;

    // 行走系统
    const WL_R       = 0.155;    // 负重轮半径（加大）
    const WL_W       = 0.058;    // 负重轮宽度
    const IDLER_R    = 0.10;     // 诱导轮
    const SPROCKET_R = 0.17;     // 主动轮
    const SPROCKET_Y = 0.24;     // 主动轮中心Y
    const TRACK_X    = 0.54;     // 履带X位置（车轮中心）
    const TRACK_W    = 0.065;    // 履带宽度（加宽）

    function createT34_85(options) {
        const { camoColor = 'green' } = options || {};
        const c = CAMO[camoColor] || CAMO.green;
        const group = new THREE.Group();

        // ═══ 材质 ═══
        const hullMat      = new THREE.MeshStandardMaterial({ color: c.hull, roughness: 0.62, metalness: 0.12 });
        const trackMat     = new THREE.MeshStandardMaterial({ color: c.track, roughness: 0.90, metalness: 0.28 });
        const turretMat    = new THREE.MeshStandardMaterial({ color: c.turret, roughness: 0.50, metalness: 0.20 });
        const barrelMat    = new THREE.MeshStandardMaterial({ color: c.barrel, roughness: 0.38, metalness: 0.65 });
        const wheelMat     = new THREE.MeshStandardMaterial({ color: c.wheel, roughness: 0.52, metalness: 0.52 });
        const hubMat       = new THREE.MeshStandardMaterial({ color: c.hub, roughness: 0.40, metalness: 0.56 });
        const mantletMat   = new THREE.MeshStandardMaterial({ color: c.mantlet, roughness: 0.42, metalness: 0.58 });
        const rimMat       = new THREE.MeshStandardMaterial({ color: c.rim, roughness: 0.55, metalness: 0.45 });
        const fenderMat    = new THREE.MeshStandardMaterial({ color: c.fender, roughness: 0.70, metalness: 0.08 });
        const fuelTankMat  = new THREE.MeshStandardMaterial({ color: c.fuelTank, roughness: 0.65, metalness: 0.14 });
        const toolBoxMat   = new THREE.MeshStandardMaterial({ color: c.toolBox, roughness: 0.72, metalness: 0.09 });
        const detailMat    = new THREE.MeshStandardMaterial({ color: '#2d2d2d', roughness: 0.70, metalness: 0.22 });
        const rubberMat    = new THREE.MeshStandardMaterial({ color: '#1a1a1a', roughness: 0.95, metalness: 0.04 });

        // ========================================
        //  车体 — 带倾斜尾板的船形剖面
        // ========================================

        const REAR_BOT_Y = HULL_BOT;  // 尾板底部高度
        const REAR_Z = -FRONT_Z;      // 尾板Z位

        let hullGeo;
        try {
            const hullShape = new THREE.Shape();
            hullShape.moveTo(FRONT_Z, HULL_BOT);
            hullShape.lineTo(GLACIS_TOP_Z, HULL_TOP);
            hullShape.lineTo(REAR_Z + 0.10, HULL_TOP);
            hullShape.lineTo(REAR_Z, HULL_BOT);
            hullShape.closePath();
            hullGeo = new THREE.ExtrudeGeometry(hullShape, { depth: HULL_W, bevelEnabled: false });
        } catch(e) {
            // ExtrudeGeometry兜底：用BoxGeometry近似
            console.warn('ExtrudeGeometry fallback:', e);
            hullGeo = new THREE.BoxGeometry(HULL_W, HULL_H, HULL_L);
        }
        const hullMesh = new THREE.Mesh(hullGeo, hullMat);
        hullMesh.rotation.y = Math.PI / 2;
        hullMesh.position.set(-HULL_W / 2, 0, 0);
        hullMesh.castShadow = true;
        hullMesh.receiveShadow = true;
        group.add(hullMesh);
        group.userData.hull = hullMesh;

        // ── 发动机舱顶盖 + 散热格栅 ──
        // T-34/85 发动机舱是略微倾斜的斜面，不是平铺大盒子
        {
            const deckL = 0.42;
            const deckZ = (-FRONT_Z + REAR_Z) / 2;  // 居中于尾部区域
            const deckFrontZ = -FRONT_Z + 0.06;
            const deckBackZ  = REAR_Z - 0.02;

            // 斜顶发动机舱盖（前高后低）
            const deckGeo = new THREE.BoxGeometry(HULL_W - 0.10, 0.020, deckL);
            const deck = new THREE.Mesh(deckGeo, hullMat);
            deck.position.set(0, HULL_TOP + 0.008, deckZ);
            deck.rotation.x = 0.04;  // 微微前倾
            deck.castShadow = true;
            group.add(deck);

            // 散热格栅（单排，更细）
            for (let g = 0; g < 9; g++) {
                const bar = new THREE.Mesh(
                    new THREE.BoxGeometry(HULL_W - 0.22, 0.004, 0.014),
                    detailMat);
                bar.position.set(0, HULL_TOP + 0.020,
                    deckFrontZ - 0.02 + g * 0.048);
                group.add(bar);
            }

            // 尾板装甲（倾斜的后装甲板）
            const tailPlateGeo = new THREE.BoxGeometry(HULL_W - 0.02, HULL_TOP - REAR_BOT_Y + 0.01, 0.018);
            const tailPlate = new THREE.Mesh(tailPlateGeo, hullMat);
            tailPlate.position.set((REAR_Z + REAR_Z + REAR_OVERHANG) / 2,
                (HULL_TOP - 0.05 + REAR_BOT_Y) / 2,
                REAR_Z + REAR_OVERHANG / 2);
            tailPlate.rotation.y = Math.PI / 2;
            tailPlate.rotation.x = -0.35;  // 向后下方倾斜
            tailPlate.castShadow = true;
            group.add(tailPlate);
        }

        // ── 驾驶员/机枪手舱盖区（车体前部凸起）─
        {
            const coaming = new THREE.Mesh(
                new THREE.BoxGeometry(0.42, 0.022, 0.32), hullMat);
            coaming.position.set(0, HULL_TOP + 0.011, GLACIS_TOP_Z + 0.12);
            coaming.rotation.x = -Math.PI / 16;
            coaming.castShadow = true;
            group.add(coaming);

            // 驾驶员舱盖（左侧）
            const drvHatch = new THREE.Mesh(
                new THREE.BoxGeometry(0.14, 0.015, 0.11), detailMat);
            drvHatch.position.set(-0.11, HULL_TOP + 0.028, GLACIS_TOP_Z + 0.10);
            drvHatch.rotation.x = -Math.PI / 16;
            group.add(drvHatch);

            // 机枪手/装填手舱盖（右侧）
            const mgHatch = new THREE.Mesh(
                new THREE.BoxGeometry(0.13, 0.015, 0.10), detailMat);
            mgHatch.position.set(0.12, HULL_TOP + 0.026, GLACIS_TOP_Z + 0.14);
            mgHatch.rotation.x = -Math.PI / 16;
            group.add(mgHatch);
        }

        // ── 备用履带段（首上右侧）─
        for (let i = 0; i < 3; i++) {
            const link = new THREE.Mesh(
                new THREE.BoxGeometry(0.010, 0.055, 0.048), detailMat);
            link.position.set(HULL_W/2 - 0.02, HULL_BOT + 0.06 + i*0.06,
                FRONT_Z - 0.07 - i*0.035);
            link.rotation.y = 0.12;
            link.castShadow = true;
            group.add(link);
        }

        // ========================================
        //  翼子板 — 宽厚覆盖行走系统
        // ========================================
        for (let side = -1; side <= 1; side += 2) {
            const sx = side * (HULL_W / 2 + 0.055);
            const fy = HULL_BOT + 0.10;

            // 主翼子板（从前到后）
            const fender = new THREE.Mesh(
                new THREE.BoxGeometry(0.048, 0.010, HULL_L - 0.08), fenderMat);
            fender.position.set(sx, fy, 0);
            fender.castShadow = true;
            group.add(fender);

            // 前挡泥板（向下弯曲）
            const lip = new THREE.Mesh(
                new THREE.BoxGeometry(0.040, 0.035, 0.010), fenderMat);
            lip.position.set(sx, fy + 0.015, FRONT_Z - 0.04);
            lip.rotation.x = 0.38;
            lip.castShadow = true;
            group.add(lip);

            // 后挡泥板
            const lipR = new THREE.Mesh(
                new THREE.BoxGeometry(0.035, 0.028, 0.009), fenderMat);
            lipR.position.set(sx, fy + 0.012, -FRONT_Z + 0.02);
            lipR.rotation.x = -0.25;
            group.add(lipR);
        }

        // ========================================
        //  行走系统
        // ========================================
        const leftWheels = [], rightWheels = [];
        const roadZ = [-0.38, -0.13, 0.05, 0.23, 0.41];  // 5个负重轮Z位
        const idlerZ  = 0.70;
        const sprocketZ = -0.62;

        function makeWheel(r, w) {
            const wg = new THREE.Group();
            // 轮毂
            const hub = new THREE.Mesh(
                new THREE.CylinderGeometry(r * 0.45, r * 0.45, w, 20), hubMat);
            hub.rotation.z = Math.PI / 2;
            wg.add(hub);
            // 橡胶轮缘
            const tire = new THREE.Mesh(
                new THREE.CylinderGeometry(r, r, w + 0.004, 26), rubberMat);
            tire.rotation.z = Math.PI / 2;
            wg.add(tire);
            // 辐条/螺栓圈
            const boltRing = new THREE.Mesh(
                new THREE.TorusGeometry(r * 0.68, 0.006, 6, 20), rimMat);
            boltRing.rotation.y = Math.PI / 2;
            wg.add(boltRing);
            // 中心盘
            const disc = new THREE.Mesh(
                new THREE.CylinderGeometry(r * 0.22, r * 0.22, w + 0.006, 14), detailMat);
            disc.rotation.z = Math.PI / 2;
            wg.add(disc);
            return wg;
        }

        function makeSprocket(r, w) {
            const sg = new THREE.Group();
            const hub = new THREE.Mesh(
                new THREE.CylinderGeometry(r * 0.42, r * 0.42, w, 18), hubMat);
            hub.rotation.z = Math.PI / 2;
            sg.add(hub);
            const ring = new THREE.Mesh(
                new THREE.TorusGeometry(r, 0.022, 8, 22), rimMat);
            ring.rotation.y = Math.PI / 2;
            sg.add(ring);
            // 齿
            for (let i = 0; i < 14; i++) {
                const tooth = new THREE.Mesh(
                    new THREE.BoxGeometry(0.028, 0.044, 0.032), wheelMat);
                const ang = (i / 14) * Math.PI * 2;
                tooth.position.set(Math.cos(ang)*r, Math.sin(ang)*r, 0);
                tooth.rotation.z = ang;
                sg.add(tooth);
            }
            return sg;
        }

        // 5对负重轮
        for (let i = 0; i < 5; i++) {
            for (let side = -1; side <= 1; side += 2) {
                const w = makeWheel(WL_R, WL_W);
                w.position.set(side * TRACK_X, WL_R, roadZ[i]);
                group.add(w);
                (side < 0 ? leftWheels : rightWheels).push(w);

                // 悬挂臂可见部分
                const arm = new THREE.Mesh(
                    new THREE.BoxGeometry(0.022, 0.016, 0.030), detailMat);
                arm.position.set(side * (TRACK_X + 0.04), WL_R - 0.01, roadZ[i]);
                group.add(arm);
            }
        }

        // 诱导轮 + 主动轮
        for (let side = -1; side <= 1; side += 2) {
            const idler = makeWheel(IDLER_R, 0.034);
            idler.position.set(side * TRACK_X, IDLER_R + 0.018, idlerZ);
            group.add(idler);
            (side < 0 ? leftWheels : rightWheels).push(idler);

            const sprocket = makeSprocket(SPROCKET_R, 0.052);
            sprocket.position.set(side * TRACK_X, SPROCKET_Y, sprocketZ);
            group.add(sprocket);
            (side < 0 ? leftWheels : rightWheels).push(sprocket);
        }
        group.userData.leftWheels = leftWheels;
        group.userData.rightWheels = rightWheels;

        // ========================================
        //  履带 — 连续包覆式
        //  底部/顶部用密集小段 + 前后圆弧用 Torus
        // ========================================
        function buildTrack(sx) {
            const tg = new THREE.Group();

            // 履带段尺寸（小且密集）
            const segW = TRACK_W;
            const segH = 0.022;
            const segL = 0.095;   // 每段长度（略重叠消除间隙）
            const segGeo = new THREE.BoxGeometry(segW, segH, segL);

            // 计算履带环参数
            const botY = 0.006;                          // 底部Y
            const topY = WL_R * 2 - 0.004;               // 顶部Y（紧贴轮顶）
            const wheelBaseZ = roadZ[0] - 0.06;          // 后端轮起始Z
            const wheelEndZ = roadZ[roadZ.length-1] + 0.06; // 前端轮结束Z

            // ── 底部：密集水平段 ──
            const botStart = sprocketZ + SPROCKET_R * 0.7;
            const botEnd = idlerZ - IDLER_R * 0.7;
            const botCount = Math.ceil((botEnd - botStart) / (segL * 0.82));
            for (let i = 0; i < botCount; i++) {
                const z = botStart + (i / (botCount - 1)) * (botEnd - botStart);
                const s = new THREE.Mesh(segGeo, trackMat);
                s.position.set(sx, botY, z);
                s.castShadow = true;
                tg.add(s);
            }

            // ── 顶部：密集水平段 ──
            const topStart = sprocketZ + SPROCKET_R * 0.65;
            const topEnd = idlerZ - IDLER_R * 0.65;
            const topCount = Math.ceil((topEnd - topStart) / (segL * 0.82));
            for (let i = 0; i < topCount; i++) {
                const z = topStart + (i / (topCount - 1)) * (topEnd - topStart);
                const s = new THREE.Mesh(segGeo, trackMat);
                s.position.set(sx, topY, z);
                s.castShadow = true;
                tg.add(s);
            }

            // ── 前弧：TorusGeometry 半圆绕诱导轮（连续！）─
            {
                const arcR = IDLER_R + 0.018;
                const arcGeo = new THREE.TorusGeometry(arcR, segH / 2, 8, 20, Math.PI);
                const arc = new THREE.Mesh(arcGeo, trackMat);
                arc.rotation.y = Math.PI / 2;
                arc.rotation.x = Math.PI;  // 翻转到前侧
                arc.position.set(sx, IDLER_R + 0.018, idlerZ);
                arc.castShadow = true;
                tg.add(arc);
            }

            // ── 后弧：TorusGeometry 绕主动轮（连续！）─
            {
                const arcR2 = SPROCKET_R + 0.020;
                const arcGeo2 = new THREE.TorusGeometry(arcR2, segH / 2, 8, 20, Math.PI);
                const arc2 = new THREE.Mesh(arcGeo2, trackMat);
                arc2.rotation.y = Math.PI / 2;
                arc2.rotation.x = 0;  // 正向朝后
                arc2.position.set(sx, SPROCKET_Y, sprocketZ);
                arc2.castShadow = true;
                tg.add(arc2);
            }

            return tg;
        }
        group.add(buildTrack(-TRACK_X));
        group.add(buildTrack(TRACK_X));

        // ========================================
        //  炮塔 — 核心改进：LatheGeometry 铸造轮廓
        // ========================================
        const turretGroup = new THREE.Group();
        const T_BASE_Y = HULL_TOP;              // 炮塔底面Y
        const TBOT_R   = 0.46;                  // 炮塔底面半径
        const TTOP_R   = 0.39;                  // 炮塔顶部半径（收窄不多）
        const T_H      = 0.29;                  // 炮塔总高度（比v5高）

        // ── 主体：使用 LatheGeometry 创建铸造轮廓 ──
        // 定义炮塔侧视轮廓曲线（从底部中心到顶部中心）
        const turretPoints = [
            new THREE.Vector2(0, 0),             // 底面中心
            new THREE.Vector2(TBOT_R * 0.92, 0),         // 底面前缘
            new THREE.Vector2(TBOT_R, T_H * 0.08),       // 底面前缘起弧
            new THREE.Vector2(TBOT_R * 1.02, T_H * 0.22), // 最大宽度处（防盾区）
            new THREE.Vector2(TBOT_R * 0.98, T_H * 0.45), // 开始收窄
            new THREE.Vector2(TTOP_R * 1.02, T_H * 0.65), // 肩部
            new THREE.Vector2(TTOP_R * 0.94, T_H * 0.82),// 上肩
            new THREE.Vector2(TTOP_R * 0.78, T_H * 0.93),// 顶部过渡
            new THREE.Vector2(TTOP_R * 0.55, T_H * 0.98),// 近顶部
            new THREE.Vector2(0, T_H)                   // 顶中
        ];
        const turretLathe = new THREE.LatheGeometry(turretPoints, 36);
        const turretMesh = new THREE.Mesh(turretLathe, turretMat);
        turretMesh.position.y = T_BASE_Y;
        turretMesh.castShadow = true;
        turretMesh.receiveShadow = true;
        turretGroup.add(turretMesh);

        // 炮塔座圈环
        const ringGeo = new THREE.TorusGeometry(TBOT_R + 0.015, 0.016, 8, 40);
        const ring = new THREE.Mesh(ringGeo, detailMat);
        ring.position.y = T_BASE_Y + 0.002;
        ring.rotation.x = Math.PI / 2;
        turretGroup.add(ring);

        // ── 防盾（大型铸造包裹式）─
        // 使用变形球体模拟铸造防盾的有机形状
        const mGroup = new THREE.Group();
        const MY = T_BASE_Y + T_H * 0.22;  // 防盾中心Y
        const MZ = TBOT_R * 0.95;          // 防盾前伸Z

        // 防盾主体（扁球体）
        const mantletCore = new THREE.Mesh(
            new THREE.SphereGeometry(0.14, 18, 14), mantletMat);
        mantletCore.scale.set(1.1, 0.75, 0.75);
        mantletCore.position.set(0, MY, MZ);
        mantletCore.castShadow = true;
        mGroup.add(mantletCore);

        // 防盾左右延伸（铸造耳）
        for (let side = -1; side <= 1; side += 2) {
            const ear = new THREE.Mesh(
                new THREE.SphereGeometry(0.07, 12, 10), mantletMat);
            ear.scale.set(0.7, 1.0, 0.8);
            ear.position.set(side * 0.19, MY, MZ - 0.02);
            ear.castShadow = true;
            mGroup.add(ear);
        }

        // 防盾顶部盖
        const mTop = new THREE.Mesh(
            new THREE.BoxGeometry(0.24, 0.025, 0.10), mantletMat);
        mTop.position.set(0, MY + 0.11, MZ - 0.01);
        mGroup.add(mTop);

        turretGroup.add(mGroup);

        // ── 指挥塔（小型！后部偏左）─
        const CUP_Y = T_BASE_Y + T_H - 0.01;
        const cupZ = -0.13;  // 略偏后

        // 指挥塔基座
        const cupBase = new THREE.Mesh(
            new THREE.CylinderGeometry(0.085, 0.095, 0.042, 14), turretMat);
        cupBase.position.set(0, CUP_Y - 0.021, cupZ);
        cupBase.castShadow = true;
        turretGroup.add(cupBase);

        // 指挥塔舱门
        const cupHatch = new THREE.Mesh(
            new THREE.CylinderGeometry(0.082, 0.082, 0.015, 14), detailMat);
        cupHatch.position.set(0, CUP_Y + 0.007, cupZ);
        turretGroup.add(cupHatch);

        // 潜望镜 × 3（围绕指挥塔）
        for (let i = 0; i < 3; i++) {
            const ang = (i / 3) * Math.PI * 2 - Math.PI / 2;
            const peri = new THREE.Mesh(
                new THREE.BoxGeometry(0.010, 0.018, 0.026), detailMat);
            peri.position.set(
                Math.cos(ang) * 0.082,
                CUP_Y + 0.016,
                cupZ + Math.sin(ang) * 0.065);
            turretGroup.add(peri);
        }

        // ── 装填手舱盖（炮塔右前方）─
        const loaderHatch = new THREE.Mesh(
            new THREE.CylinderGeometry(0.055, 0.055, 0.012, 12), detailMat);
        loaderHatch.position.set(0.14, T_BASE_Y + T_H - 0.008, 0.10);
        turretGroup.add(loaderHatch);

        group.add(turretGroup);

        // ========================================
        //  主炮 — 85mm ZiS-S-53
        // ========================================
        const bGroup = new THREE.Group();
        const BROOT_Z = TBOT_R * 0.88;   // 炮根Z
        const B_Y     = T_BASE_Y + T_H * 0.22;  // 炮管轴心Y

        // 炮管根部（退壳器区域）
        const root = new THREE.Mesh(
            new THREE.CylinderGeometry(0.042, 0.034, 0.14, 14), barrelMat);
        root.rotation.x = -Math.PI / 2;
        root.position.set(0, B_Y, BROOT_Z + 0.07);
        root.castShadow = true;
        bGroup.add(root);

        // 主炮管
        const BLEN = 1.20;
        const barrel = new THREE.Mesh(
            new THREE.CylinderGeometry(0.026, 0.030, BLEN, 16), barrelMat);
        barrel.rotation.x = -Math.PI / 2;
        barrel.position.set(0, B_Y, BROOT_Z + 0.14 + BLEN / 2);
        barrel.castShadow = true;
        bGroup.add(barrel);

        // 抽烟器（特征性粗段）
        const evacMat = new THREE.MeshStandardMaterial({
            color: '#4a4a4a', roughness: 0.35, metalness: 0.64 });
        const evac = new THREE.Mesh(
            new THREE.CylinderGeometry(0.043, 0.043, 0.065, 18), evacMat);
        evac.rotation.x = -Math.PI / 2;
        evac.position.set(0, B_Y, BROOT_Z + 0.14 + BLEN * 0.34);
        bGroup.add(evac);

        // 抽烟器肋环
        for (const off of [-0.004, 0.004]) {
            const rib = new THREE.Mesh(
                new THREE.TorusGeometry(0.048, 0.0045, 8, 18), barrelMat);
            rib.rotation.x = -Math.PI / 2;
            rib.position.set(0, B_Y, BROOT_Z + 0.14 + BLEN * 0.34 + off);
            bGroup.add(rib);
        }

        // 炮口制退器
        const muzzle = new THREE.Mesh(
            new THREE.CylinderGeometry(0.036, 0.040, 0.075, 18), barrelMat);
        muzzle.rotation.x = -Math.PI / 2;
        muzzle.position.set(0, B_Y, BROOT_Z + 0.14 + BLEN + 0.038);
        bGroup.add(muzzle);

        // 同轴机枪（简化的DT同轴机枪）
        const coax = new THREE.Mesh(
            new THREE.CylinderGeometry(0.008, 0.008, 0.18, 8), detailMat);
        coax.rotation.x = -Math.PI / 2;
        coax.position.set(0.050, B_Y - 0.025, BROOT_Z + 0.20);
        bGroup.add(coax);

        group.add(bGroup);

        // ========================================
        //  外部附件
        // ========================================

        // 圆筒形外挂油箱 × 2（后部侧面）
        const ftGeo = new THREE.CylinderGeometry(0.068, 0.068, 0.34, 14);
        for (let side = -1; side <= 1; side += 2) {
            const ft = new THREE.Mesh(ftGeo, fuelTankMat);
            ft.rotation.z = Math.PI / 2;
            ft.position.set(side * (HULL_W / 2 + 0.125), HULL_BOT + 0.068,
                -FRONT_Z + 0.10);
            ft.castShadow = true;
            group.add(ft);
            // 油箱固定架
            for (let b = 0; b < 2; b++) {
                const band = new THREE.Mesh(
                    new THREE.TorusGeometry(0.070, 0.005, 6, 14), detailMat);
                band.rotation.y = Math.PI / 2;
                band.position.set(side * (HULL_W / 2 + 0.125),
                    HULL_BOT + 0.068, -FRONT_Z + 0.10 - 0.10 + b * 0.20);
                band.position.y = HULL_BOT + 0.068;
                band.position.z = -FRONT_Z + (-0.02) + b * 0.18;
                group.add(band);
            }
        }

        // 工具箱（尾部中央）
        const toolbox = new THREE.Mesh(
            new THREE.BoxGeometry(0.15, 0.048, 0.085), toolBoxMat);
        toolbox.position.set(-0.02, HULL_BOT + 0.03, -FRONT_Z + 0.34);
        toolbox.castShadow = true;
        group.add(toolbox);

        // 牵引缆绳（右侧）
        const cableMat = new THREE.MeshStandardMaterial({
            color: '#3a3a3a', roughness: 0.82, metalness: 0.38 });
        for (let ci = 0; ci < 2; ci++) {
            const cable = new THREE.Mesh(
                new THREE.CylinderGeometry(0.006, 0.006, 0.48, 6), cableMat);
            cable.rotation.x = Math.PI / 2 + 0.12;
            cable.rotation.z = 0.08;
            cable.position.set(HULL_W / 2 + 0.095, HULL_BOT + 0.085,
                -0.01 + ci * 0.30);
            group.add(cable);
        }

        // 圆头斧/工具（尾板）
        const axe = new THREE.Mesh(
            new THREE.BoxGeometry(0.018, 0.008, 0.065), detailMat);
        axe.position.set(HULL_W / 2 + 0.02, HULL_BOT + 0.035, -FRONT_Z + 0.28);
        axe.rotation.y = 0.2;
        group.add(axe);

        // 前灯（左翼子板前部）
        const hlG = new THREE.Group();
        const hlBase = new THREE.Mesh(
            new THREE.CylinderGeometry(0.032, 0.036, 0.032, 12), detailMat);
        hlBase.rotation.x = Math.PI / 2;
        hlG.add(hlBase);
        const hlLens = new THREE.Mesh(
            new THREE.SphereGeometry(0.027, 12, 12, 0, Math.PI*2, 0, Math.PI/2),
            new THREE.MeshStandardMaterial({
                color: '#ffffee', roughness: 0.08, metalness: 0.04,
                emissive: '#ffeecc', emissiveIntensity: 0.12 }));
        hlLens.rotation.x = -Math.PI / 2;
        hlLens.position.z = 0.032;
        hlG.add(hlLens);
        hlG.position.set(HULL_W / 2 + 0.075, HULL_BOT + 0.055, FRONT_Z - 0.16);
        group.add(hlG);

        // 排气管 × 2（尾部）
        for (let side = -1; side <= 1; side += 2) {
            const pipe = new THREE.Mesh(
                new THREE.CylinderGeometry(0.021, 0.025, 0.065, 10), detailMat);
            pipe.rotation.x = Math.PI / 2;
            pipe.position.set(side * 0.17, HULL_BOT + 0.018, -FRONT_Z - 0.025);
            group.add(pipe);
            // 排气管保护罩
            const cap = new THREE.Mesh(
                new THREE.TorusGeometry(0.028, 0.005, 8, 12), detailMat);
            cap.rotation.y = Math.PI / 2;
            cap.position.set(side * 0.17, HULL_BOT + 0.018, -FRONT_Z - 0.025);
            group.add(cap);
        }

        // 天线基座（炮塔右后方）
        const antBase = new THREE.Mesh(
            new THREE.CylinderGeometry(0.012, 0.014, 0.025, 8), detailMat);
        antBase.position.set(0.18, T_BASE_Y + T_H - 0.005, -0.08);
        turretGroup.add(antBase);

        // 天线杆
        const antenna = new THREE.Mesh(
            new THREE.CylinderGeometry(0.003, 0.003, 0.35, 6),
            new THREE.MeshStandardMaterial({color:'#222',roughness:0.5,metalness:0.6}));
        antenna.position.set(0.18, T_BASE_Y + T_H + 0.17, -0.08);
        antenna.rotation.z = 0.15;
        turretGroup.add(antenna);

        // ========================================
        //  地面阴影
        // ========================================
        const shadow = new THREE.Mesh(
            new THREE.CircleGeometry(0.66, 32),
            new THREE.MeshBasicMaterial({
                color: '#000000', transparent: true, opacity: 0.22,
                depthWrite: false }));
        shadow.rotation.x = -Math.PI / 2;
        shadow.position.y = 0.010;
        shadow.renderOrder = 1;
        shadow.name = 'shadow';
        group.add(shadow);

        group.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });
        return group;
    }

    window.ModelRegistry.register('tanks', 't34-85-green',  (opts) =>
        createT34_85({ ...opts, camoColor: 'green' }));
    window.ModelRegistry.register('tanks', 't34-85-desert', (opts) =>
        createT34_85({ ...opts, camoColor: 'desert' }));
})();
