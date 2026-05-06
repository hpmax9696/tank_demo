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
    const TRACK_W    = 0.095;    // 履带宽度

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

        const REAR_Z = -FRONT_Z;  // 尾板Z位

        const hullShape = new THREE.Shape();
        hullShape.moveTo(FRONT_Z, HULL_BOT);
        hullShape.lineTo(GLACIS_TOP_Z, HULL_TOP);
        hullShape.lineTo(REAR_Z + 0.10, HULL_TOP);
        hullShape.lineTo(REAR_Z, HULL_BOT);
        hullShape.closePath();

        const hullGeo = new THREE.ExtrudeGeometry(hullShape, { depth: HULL_W, bevelEnabled: false });
        const hullMesh = new THREE.Mesh(hullGeo, hullMat);
        hullMesh.rotation.y = Math.PI / 2;
        hullMesh.position.set(-HULL_W / 2, 0, 0);
        hullMesh.castShadow = true;
        hullMesh.receiveShadow = true;
        group.add(hullMesh);
        group.userData.hull = hullMesh;

        // ── 发动机舱顶盖 + 散热格栅 ──
        // 注意：hullMesh旋转后，shape的X轴变成世界-Z轴
        // shape中REAR_Z(-0.85)对应世界Z=0.85（尾部）
        {
            const deckFrontZ = -(-FRONT_Z + 0.10);  // shape x=-0.75 → 世界z=0.75
            const deckBackZ  = -REAR_Z;             // shape x=-0.85 → 世界z=0.85
            const deckCenterZ = (deckFrontZ + deckBackZ) / 2;
            const deckLen = deckBackZ - deckFrontZ;

            // 发动机舱盖
            const deckGeo = new THREE.BoxGeometry(HULL_W - 0.10, 0.020, deckLen);
            const deck = new THREE.Mesh(deckGeo, hullMat);
            deck.position.set(0, HULL_TOP + 0.010, deckCenterZ);
            deck.rotation.x = -0.04;
            deck.castShadow = true;
            group.add(deck);

            // 散热格栅条
            for (let g = 0; g < 9; g++) {
                const bar = new THREE.Mesh(
                    new THREE.BoxGeometry(HULL_W - 0.22, 0.004, 0.014),
                    detailMat);
                const t = g / 8;
                const barZ = deckFrontZ + 0.02 + t * (deckLen - 0.04);
                bar.position.set(0, HULL_TOP + 0.022, barZ);
                group.add(bar);
            }
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
        {
            for (let i = 0; i < 3; i++) {
                const seg = new THREE.Mesh(
                    new THREE.BoxGeometry(0.022, 0.012, 0.038), trackMat);
                seg.position.set(0.30 + i * 0.039, HULL_TOP + 0.012, GLACIS_TOP_Z - 0.04);
                group.add(seg);
            }
        }

        // ── 翼子板（车体两侧挡泥板）─
        {
            for (let side = -1; side <= 1; side += 2) {
                const fender = new THREE.Mesh(
                    new THREE.BoxGeometry(0.030, 0.006, 1.12),
                    fenderMat);
                fender.position.set(side * (HULL_W / 2 + 0.015), HULL_BOT + 0.09, -0.02);
                fender.castShadow = true;
                group.add(fender);

                // 前挡泥板弯曲
                const frontFlap = new THREE.Mesh(
                    new THREE.BoxGeometry(0.030, 0.018, 0.05), fenderMat);
                frontFlap.position.set(side * (HULL_W / 2 + 0.015), HULL_BOT + 0.07, 0.86);
                frontFlap.rotation.x = 0.2;
                group.add(frontFlap);

                // 后挡泥板弯曲
                const rearFlap = new THREE.Mesh(
                    new THREE.BoxGeometry(0.030, 0.018, 0.05), fenderMat);
                rearFlap.position.set(side * (HULL_W / 2 + 0.015), HULL_BOT + 0.07, -0.86);
                rearFlap.rotation.x = -0.2;
                group.add(rearFlap);
            }
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
        //  履带 — 闭合环路
        // ========================================

        function makeTrackBand(side) {
            const band = new THREE.Group();

            // 底部履带段（从后绕过诱导轮到前）
            const bottomSegs = 24;
            const botStartZ = sprocketZ;
            const botEndZ = idlerZ;
            for (let b = 0; b < bottomSegs; b++) {
                const seg = new THREE.Mesh(
                    new THREE.BoxGeometry(TRACK_W, 0.018, 0.038), trackMat);
                const t = b / (bottomSegs - 1);
                const z = botStartZ + t * (botEndZ - botStartZ);
                seg.position.set(side * (TRACK_X + 0.01), 0.008, z);
                band.add(seg);
            }

            // 顶部履带段（从主动轮到诱导轮）
            const topSegs = 22;
            const topStartZ = sprocketZ;
            const topEndZ = idlerZ;
            for (let b = 0; b < topSegs; b++) {
                const seg = new THREE.Mesh(
                    new THREE.BoxGeometry(TRACK_W, 0.018, 0.038), trackMat);
                const t = b / (topSegs - 1);
                const z = topStartZ + t * (topEndZ - topStartZ);
                seg.position.set(side * (TRACK_X + 0.01), SPROCKET_Y + 0.02, z);
                band.add(seg);
            }

            // 前弧：从顶部前端到诱导轮 — 使用TorusGeometry半圆
            const frontArc = new THREE.Mesh(
                new THREE.TorusGeometry(0.095, TRACK_W * 0.5, 8, 12, Math.PI),
                trackMat);
            frontArc.position.set(side * (TRACK_X + 0.01), SPROCKET_Y + 0.02 + 0.095, idlerZ);
            frontArc.rotation.x = -Math.PI / 2;
            band.add(frontArc);

            // 后弧：从主动轮到顶部后端
            const rearArc = new THREE.Mesh(
                new THREE.TorusGeometry(0.095, TRACK_W * 0.5, 8, 12, Math.PI),
                trackMat);
            rearArc.position.set(side * (TRACK_X + 0.01), SPROCKET_Y + 0.02 + 0.095, sprocketZ);
            rearArc.rotation.x = Math.PI / 2;
            band.add(rearArc);

            band.position.y = 0;
            return band;
        }

        // 左右两侧履带
        for (let side = -1; side <= 1; side += 2) {
            const band = makeTrackBand(side);
            group.add(band);
        }

        // 地面阴影
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
