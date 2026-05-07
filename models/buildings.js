/**
 * 建筑模型 — 平房、别墅、公寓
 */
(function() {
    const wallMat = new THREE.MeshStandardMaterial({ color: '#D4C5A9', roughness: 0.9 });
    const roofMat = new THREE.MeshStandardMaterial({ color: '#8B4513', roughness: 0.85 });
    const aptMat  = new THREE.MeshStandardMaterial({ color: '#C0C0C0', roughness: 0.7 });

    function addShadow(g) {
        g.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });
    }

    // 平房（精细化：山墙屋顶+窗户+门+烟囱）
    function createBungalow() {
        const g = new THREE.Group();
        const h = 0.6 + Math.random() * 0.2;
        const w = 0.8 + Math.random() * 0.2;
        const d = 0.65 + Math.random() * 0.15;
        const wallColors = ['#E8D5B7','#D4C5A9','#F0DCC0','#C9B896'];
        const wallM = new THREE.MeshStandardMaterial({ color: wallColors[Math.floor(Math.random()*4)], roughness:0.85 });
        const roofM = new THREE.MeshStandardMaterial({ color: '#A0522D', roughness: 0.8 });
        const trimM = new THREE.MeshStandardMaterial({ color: '#C4956A', roughness: 0.7 });
        const winM  = new THREE.MeshStandardMaterial({ color:'#AACCFF', emissive:'#224466', emissiveIntensity:0.1 });
        const doorM = new THREE.MeshStandardMaterial({ color:'#5C3317', roughness:0.6 });

        // 主体
        const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallM);
        body.position.y = h / 2;
        g.add(body);

        // 山墙屋顶（三角形沿Z拉伸）
        const rH = 0.32, oH = 0.04; // 屋顶高度、屋檐出挑
        const shp = new THREE.Shape();
        const hw = w / 2 + oH;
        shp.moveTo(-hw, 0); shp.lineTo(0, rH); shp.lineTo(hw, 0); shp.closePath();
        const roofMsh = new THREE.Mesh(
            new THREE.ExtrudeGeometry(shp, { depth: d + oH*2, bevelEnabled: false }),
            roofM
        );
        roofMsh.position.set(0, h, -(d + oH*2) / 2);
        g.add(roofMsh);

        // 窗户（正面+背面2排）
        for (let side = -1; side <= 1; side += 2) {
            for (let wi = -1; wi <= 1; wi += 2) {
                const win = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 0.1), winM);
                win.position.set(wi * w * 0.25, h * 0.55, side * (d / 2 + 0.001));
                g.add(win);
                // 窗框
                const frm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, 0.005), trimM);
                frm.position.set(wi * w * 0.25, h * 0.55, side * (d / 2 + 0.002));
                g.add(frm);
            }
        }

        // 门（正面中心）
        const door = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.28, 0.01), doorM);
        door.position.set(0, 0.14, d / 2 + 0.003);
        g.add(door);
        // 门框
        const drFrm = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.32, 0.008), trimM);
        drFrm.position.set(0, 0.16, d / 2 + 0.002);
        g.add(drFrm);

        // 烟囱
        const chm = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.18, 0.06), trimM);
        chm.position.set(w * 0.28, h + rH * 0.55, d * 0.15);
        g.add(chm);
        const chmTop = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.03, 0.09), trimM);
        chmTop.position.set(w * 0.28, h + rH * 0.55 + 0.09, d * 0.15);
        g.add(chmTop);

        g.userData = { height: h + rH, radius: Math.max(w, d) / 2 * 1.15, color: '#' + wallM.color.getHexString() };
        addShadow(g);
        return g;
    }

    // 别墅（精细化：二层退台+石墙/木墙+山墙屋顶+阳台+楼梯+烟囱）
    function createVilla() {
        const g = new THREE.Group();
        const h1 = 0.45 + Math.random() * 0.1;   // 一楼高
        const h2 = 0.4 + Math.random() * 0.08;   // 二楼高
        const w  = 0.7 + Math.random() * 0.15;
        const d  = 0.6 + Math.random() * 0.12;
        const w2 = w * 0.78, d2 = d * 0.78;      // 二楼退台

        const stoneM = new THREE.MeshStandardMaterial({ color: '#8B7D6B', roughness: 0.95 });
        const woodM  = new THREE.MeshStandardMaterial({ color: '#A0825A', roughness: 0.85 });
        const darkM  = new THREE.MeshStandardMaterial({ color: '#5C3A1E', roughness: 0.8 });
        const roofM  = new THREE.MeshStandardMaterial({ color: '#8B4513', roughness: 0.85 });
        const trimM  = new THREE.MeshStandardMaterial({ color: '#C4956A', roughness: 0.7 });
        const winM   = new THREE.MeshStandardMaterial({ color:'#AACCFF', emissive:'#224466', emissiveIntensity:0.1 });
        const doorM  = new THREE.MeshStandardMaterial({ color:'#4A2810', roughness:0.6 });

        // 一楼（石墙，带墙角石装饰条）
        const f1 = new THREE.Mesh(new THREE.BoxGeometry(w, h1, d), stoneM);
        f1.position.y = h1 / 2;
        g.add(f1);
        // 一楼墙基（踢脚装饰线）
        const base = new THREE.Mesh(new THREE.BoxGeometry(w + 0.06, 0.04, d + 0.06), stoneM);
        base.position.y = 0.02;
        g.add(base);

        // 二楼（木墙，比一楼窄形成退台）
        const f2 = new THREE.Mesh(new THREE.BoxGeometry(w2, h2, d2), woodM);
        f2.position.set(0, h1 + h2 / 2, 0);
        g.add(f2);

        // 二楼阳台（平台+栏杆）
        const balcH = h1 - 0.04;
        const plat = new THREE.Mesh(new THREE.BoxGeometry(w2 + 0.06, 0.03, 0.12), woodM);
        plat.position.set(0, balcH, d * 0.38);
        g.add(plat);
        // 阳台栏杆 4根立柱
        for (let bx = -w2/2 + 0.04; bx <= w2/2 - 0.04; bx += (w2 - 0.08) / 3) {
            const post = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.12, 0.02), darkM);
            post.position.set(bx, balcH + 0.06, d * 0.38);
            g.add(post);
        }
        // 栏杆横梁
        const rail = new THREE.Mesh(new THREE.BoxGeometry(w2 + 0.02, 0.02, 0.02), darkM);
        rail.position.set(0, balcH + 0.12, d * 0.38);
        g.add(rail);

        // 山墙屋顶（三角形沿Z拉伸，二楼顶部）
        const rH = 0.3, oH = 0.05;
        const shp = new THREE.Shape();
        const hw = w2 / 2 + oH;
        shp.moveTo(-hw, 0); shp.lineTo(0, rH); shp.lineTo(hw, 0); shp.closePath();
        const roof = new THREE.Mesh(
            new THREE.ExtrudeGeometry(shp, { depth: d2 + oH*2, bevelEnabled: false }),
            roofM
        );
        roof.position.set(0, h1 + h2, -(d2 + oH*2) / 2);
        g.add(roof);

        // 烟囱（屋顶侧面）
        const chim = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.2, 0.06), stoneM);
        chim.position.set(w2 * 0.3, h1 + h2 + rH * 0.5, d2 * 0.25);
        g.add(chim);
        const chimTop = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.03, 0.09), stoneM);
        chimTop.position.set(w2 * 0.3, h1 + h2 + rH * 0.5 + 0.1, d2 * 0.25);
        g.add(chimTop);

        // 窗户（一楼正面，二楼四面）
        for (let side = -1; side <= 1; side += 2) {
            for (let wi = -1; wi <= 1; wi += 2) {
                // 一楼窗户（设在正面/背面）
                const win = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 0.1), winM);
                win.position.set(wi * w * 0.28, h1 * 0.55, side * (d / 2 + 0.001));
                g.add(win);
                // 二楼窗户（四面）
                const zFac = side * (d2 / 2 + 0.001);
                const win2 = new THREE.Mesh(new THREE.PlaneGeometry(0.07, 0.09), winM);
                win2.position.set(wi * w2 * 0.28, h1 + h2 * 0.5, side * (d2 / 2 + 0.001));
                g.add(win2);
                // 二楼的侧面窗户（X方向）
                const winS = new THREE.Mesh(new THREE.PlaneGeometry(0.07, 0.09), winM);
                winS.rotation.y = Math.PI / 2;
                winS.position.set(side * (w2 / 2 + 0.001), h1 + h2 * 0.5, wi * d2 * 0.28);
                g.add(winS);
            }
        }

        // 门（正面一楼中心）
        const door = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.2, 0.008), doorM);
        door.position.set(0, 0.1, d / 2 + 0.002);
        g.add(door);
        const drFrm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.24, 0.006), trimM);
        drFrm.position.set(0, 0.12, d / 2 + 0.001);
        g.add(drFrm);

        // 楼梯（门口台阶）
        for (let si = 0; si < 2; si++) {
            const step = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.03, 0.06), stoneM);
            step.position.set(0, 0.015 + si * 0.03, d / 2 + 0.025 + si * 0.04);
            g.add(step);
        }

        g.userData = { height: h1 + h2 + rH, radius: Math.max(w, d) / 2 * 1.2, color: '#8B7D6B' };
        addShadow(g);
        return g;
    }

    // 公寓（精细化：底商石材层+白色瓷砖住宅层+灰色退台顶层）
    function createApartment() {
        const g = new THREE.Group();

        // 坦克全高约 0.76（车体 0.48 + 炮塔 0.28），目标高度 5~10 倍 = 3.8~7.6
        const totalH = 3.8 + Math.random() * 3.8;   // 3.8 ~ 7.6
        const w  = 0.7 + Math.random() * 0.2;       // 宽度 0.7~0.9
        const d  = 0.7 + Math.random() * 0.2;       // 深度 0.7~0.9

        // 分层比例
        const shopH  = totalH * 0.18;   // 底层商铺/车库（深色石材）
        const resH   = totalH * 0.65;   // 中层住宅（白色瓷砖）
        const topH   = totalH * 0.17;   // 顶层退台（灰色设备层）

        // 材质
        const stoneM  = new THREE.MeshStandardMaterial({ color: '#5A5A5A', roughness: 0.95 }); // 底层石材
        const tileM   = new THREE.MeshStandardMaterial({ color: '#F5F5F5', roughness: 0.55 }); // 白色瓷砖
        const topM    = new THREE.MeshStandardMaterial({ color: '#999999', roughness: 0.75 }); // 顶层灰色
        const winM    = new THREE.MeshStandardMaterial({ color:'#AACCFF', emissive:'#224466', emissiveIntensity:0.1 });
        const frameM  = new THREE.MeshStandardMaterial({ color: '#888888', roughness: 0.6 });
        const shutterM= new THREE.MeshStandardMaterial({ color: '#C0C0C0', roughness: 0.4, metalness: 0.3 });

        // ── 底层：深色石材（商铺/车库） ──
        const shopBody = new THREE.Mesh(new THREE.BoxGeometry(w, shopH, d), stoneM);
        shopBody.position.y = shopH / 2;
        g.add(shopBody);
        // 底层墙基装饰线
        const shopBase = new THREE.Mesh(new THREE.BoxGeometry(w + 0.04, 0.03, d + 0.04), stoneM);
        shopBase.position.y = 0.015;
        g.add(shopBase);
        // 卷帘门（正面3个）
        for (let di = -1; di <= 1; di++) {
            const door = new THREE.Mesh(new THREE.BoxGeometry(w * 0.22, shopH * 0.65, 0.015), shutterM);
            door.position.set(di * w * 0.28, shopH * 0.35, d / 2 + 0.003);
            g.add(door);
            // 门框
            const dFrm = new THREE.Mesh(new THREE.BoxGeometry(w * 0.26, shopH * 0.70, 0.008), frameM);
            dFrm.position.set(di * w * 0.28, shopH * 0.37, d / 2 + 0.001);
            g.add(dFrm);
        }

        // ── 中层：白色瓷砖住宅层 ──
        const resBody = new THREE.Mesh(new THREE.BoxGeometry(w, resH, d), tileM);
        resBody.position.y = shopH + resH / 2;
        g.add(resBody);
        // 住宅层腰线（分隔底层与住宅）
        const belt = new THREE.Mesh(new THREE.BoxGeometry(w + 0.03, 0.04, d + 0.03), frameM);
        belt.position.y = shopH;
        g.add(belt);

        // 住宅窗户（4面，每层2列，按高度均匀分布）
        const floors = Math.max(3, Math.floor(resH / 0.55));
        const floorH = resH / floors;
        for (let fi = 0; fi < floors; fi++) {
            const wy = shopH + floorH * (fi + 0.5);
            for (let side = -1; side <= 1; side += 2) {
                // 正面/背面窗户（Z方向）
                for (let wi = -1; wi <= 1; wi += 2) {
                    const win = new THREE.Mesh(new THREE.PlaneGeometry(0.10, 0.14), winM);
                    win.position.set(wi * w * 0.22, wy, side * (d / 2 + 0.002));
                    g.add(win);
                    // 窗框
                    const frm = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.18, 0.006), frameM);
                    frm.position.set(wi * w * 0.22, wy, side * (d / 2 + 0.003));
                    g.add(frm);
                }
                // 侧面窗户（X方向）
                for (let wi = -1; wi <= 1; wi += 2) {
                    const winS = new THREE.Mesh(new THREE.PlaneGeometry(0.10, 0.14), winM);
                    winS.rotation.y = Math.PI / 2;
                    winS.position.set(side * (w / 2 + 0.002), wy, wi * d * 0.22);
                    g.add(winS);
                    const frmS = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.18, 0.14), frameM);
                    frmS.position.set(side * (w / 2 + 0.003), wy, wi * d * 0.22);
                    g.add(frmS);
                }
            }
        }

        // ── 顶层：灰色退台结构（设备层/天台） ──
        const topW = w * 0.82, topD = d * 0.82;  // 退台收窄
        const topBody = new THREE.Mesh(new THREE.BoxGeometry(topW, topH, topD), topM);
        topBody.position.y = shopH + resH + topH / 2;
        g.add(topBody);
        // 顶层围栏（天台护栏）
        const railH = 0.06;
        const railThick = 0.015;
        for (let side = -1; side <= 1; side += 2) {
            // Z方向围栏
            const railZ = new THREE.Mesh(new THREE.BoxGeometry(topW + railThick * 2, railThick, railThick), frameM);
            railZ.position.set(0, shopH + resH + topH + railThick / 2, side * (topD / 2 + railThick / 2));
            g.add(railZ);
            // X方向围栏
            const railX = new THREE.Mesh(new THREE.BoxGeometry(railThick, railThick, topD + railThick * 2), frameM);
            railX.position.set(side * (topW / 2 + railThick / 2), shopH + resH + topH + railThick / 2, 0);
            g.add(railX);
        }
        // 顶层立柱（4角）
        for (let cx = -1; cx <= 1; cx += 2) {
            for (let cz = -1; cz <= 1; cz += 2) {
                const post = new THREE.Mesh(new THREE.BoxGeometry(0.03, topH + railH, 0.03), frameM);
                post.position.set(cx * topW / 2, shopH + resH + topH / 2 + railH / 2, cz * topD / 2);
                g.add(post);
            }
        }
        // 顶层设备箱（空调/水箱）
        const equip = new THREE.Mesh(new THREE.BoxGeometry(topW * 0.35, topH * 0.5, topD * 0.35), topM);
        equip.position.set(topW * 0.15, shopH + resH + topH * 0.75, -topD * 0.15);
        g.add(equip);

        g.userData = { height: totalH + railH, radius: Math.max(w, d) / 2 * 1.15, color: '#F5F5F5' };
        addShadow(g);
        return g;
    }

    // 注册
    window.ModelRegistry.register('buildings', 'bungalow', createBungalow, 10);
    window.ModelRegistry.register('buildings', 'villa', createVilla, 10);
    window.ModelRegistry.register('buildings', 'apartment', createApartment, 7);
})();
