/**
 * 建筑模型 — 平房、别墅、公寓
 */
(function () {
  // ── 全局共享材质：同 category 建筑复用同一组材质对象，
  //    这是 obstacles.js 把同类建筑合并进同一个 InstancedMesh 的前提（按 material 引用去重）。
  //    ⚠️ 这些材质跨地图重建长期存活，任何 dispose 路径都不得释放它们（否则下次重建黑块/丢材质）。
  // 平房
  const bunWallM = new THREE.MeshStandardMaterial({ color: '#D4C5A9', roughness: 0.85 });
  const bunRoofM = new THREE.MeshStandardMaterial({ color: '#A0522D', roughness: 0.8 });
  const bunTrimM = new THREE.MeshStandardMaterial({ color: '#C4956A', roughness: 0.7 });
  const bunWinM = new THREE.MeshStandardMaterial({
    color: '#AACCFF',
    emissive: '#224466',
    emissiveIntensity: 0.1,
  });
  const bunDoorM = new THREE.MeshStandardMaterial({ color: '#5C3317', roughness: 0.6 });
  // 别墅
  const vilStoneM = new THREE.MeshStandardMaterial({ color: '#8B7D6B', roughness: 0.95 });
  const vilWoodM = new THREE.MeshStandardMaterial({ color: '#A0825A', roughness: 0.85 });
  const vilDarkM = new THREE.MeshStandardMaterial({ color: '#5C3A1E', roughness: 0.8 });
  const vilRoofM = new THREE.MeshStandardMaterial({ color: '#8B4513', roughness: 0.85 });
  const vilTrimM = new THREE.MeshStandardMaterial({ color: '#C4956A', roughness: 0.7 });
  const vilWinM = new THREE.MeshStandardMaterial({
    color: '#AACCFF',
    emissive: '#224466',
    emissiveIntensity: 0.1,
  });
  const vilDoorM = new THREE.MeshStandardMaterial({ color: '#4A2810', roughness: 0.6 });
  // 公寓
  const aptStoneM = new THREE.MeshStandardMaterial({ color: '#5A5A5A', roughness: 0.95 });
  const aptTileM = new THREE.MeshStandardMaterial({ color: '#F5F5F5', roughness: 0.55 });
  const aptTopM = new THREE.MeshStandardMaterial({ color: '#999999', roughness: 0.75 });
  const aptWinM = new THREE.MeshStandardMaterial({
    color: '#AACCFF',
    emissive: '#224466',
    emissiveIntensity: 0.1,
  });
  const aptFrameM = new THREE.MeshStandardMaterial({ color: '#888888', roughness: 0.6 });
  const aptShutterM = new THREE.MeshStandardMaterial({
    color: '#C0C0C0',
    roughness: 0.4,
    metalness: 0.3,
  });
  // ── 校园建筑墙面纹理(Canvas程序化: 白瓷砖+窗户+楼层线, tileable) ──
  function _makeCampusWallTex() {
    if (window._campusWallTex) return window._campusWallTex;
    var W = 512,
      H = 256;
    var c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    var ctx = c.getContext('2d');
    // 底色: 暖白瓷砖(中国学校外墙标准色)
    ctx.fillStyle = '#e8e4dc';
    ctx.fillRect(0, 0, W, H);
    // 瓷砖水平线(浅灰, 每32px=~38cm)
    ctx.strokeStyle = 'rgba(180,175,168,0.4)';
    ctx.lineWidth = 1;
    for (var y = 32; y < H; y += 32) {
      ctx.beginPath();
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(W, y + 0.5);
      ctx.stroke();
    }
    // 竖线(每64px, 模拟瓷砖接缝)
    for (var x = 64; x < W; x += 64) {
      ctx.beginPath();
      ctx.moveTo(x + 0.5, 0);
      ctx.lineTo(x + 0.5, H);
      ctx.stroke();
    }
    // 窗户区域: 4窗等距, 窗宽72px, 间距32px
    var winY1 = 48,
      winY2 = 208,
      nWin = 4;
    var totalW = nWin * 80 + (nWin - 1) * 24; // 4×80+3×24=392
    var startX = (W - totalW) / 2; // 60
    for (var wi = 0; wi < nWin; wi++) {
      var wx = startX + wi * (80 + 24);
      // 窗框(白)
      ctx.fillStyle = '#f5f0e8';
      ctx.fillRect(wx - 3, winY1 - 3, 86, winY2 - winY1 + 6);
      // 玻璃(深蓝灰, 微反光)
      var glassGrad = ctx.createLinearGradient(wx, winY1, wx, winY2);
      glassGrad.addColorStop(0, '#5a6d80');
      glassGrad.addColorStop(0.3, '#6e8296');
      glassGrad.addColorStop(0.7, '#4a5c6e');
      glassGrad.addColorStop(1, '#3d4e5e');
      ctx.fillStyle = glassGrad;
      ctx.fillRect(wx, winY1, 80, winY2 - winY1);
      // 窗格竖框
      ctx.fillStyle = '#f0ece4';
      ctx.fillRect(wx + 39, winY1, 2, winY2 - winY1); // 中竖框
      // 窗格横框
      ctx.fillRect(wx, winY1 + 78, 80, 2); // 中横框
      // 窗台线
      ctx.fillStyle = '#d0cbc4';
      ctx.fillRect(wx - 3, winY2, 86, 3);
      ctx.fillRect(wx - 3, winY1 - 3, 86, 3);
    }
    // 楼层分界梁(钢筋混凝土色, 顶部)
    ctx.fillStyle = '#d8d4cc';
    ctx.fillRect(0, 242, W, 14);
    ctx.fillStyle = 'rgba(160,155,148,0.5)';
    ctx.fillRect(0, 242, W, 1); // 上边线
    ctx.fillRect(0, 255, W, 1); // 下边线
    // 腰线(窗下)
    ctx.fillStyle = 'rgba(190,185,178,0.6)';
    ctx.fillRect(0, winY1 - 3, W, 1);
    // 随机微污渍(真实感)
    for (var d = 0; d < 60; d++) {
      var dx = Math.random() * W,
        dy = Math.random() * H;
      ctx.fillStyle = 'rgba(160,155,148,' + (0.03 + Math.random() * 0.05) + ')';
      ctx.fillRect(dx, dy, 3 + Math.random() * 5, 2 + Math.random() * 3);
    }
    var tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.generateMipmaps = true;
    window._campusWallTex = tex;
    return tex;
  }
  // ── 校园建筑屋顶纹理 ──
  function _makeCampusRoofTex() {
    if (window._campusRoofTex) return window._campusRoofTex;
    var c = document.createElement('canvas');
    c.width = c.height = 256;
    var ctx = c.getContext('2d');
    ctx.fillStyle = '#7a7a78';
    ctx.fillRect(0, 0, 256, 256);
    // 混凝土屋面微纹理
    for (var i = 0; i < 400; i++) {
      var rx = Math.random() * 256,
        ry = Math.random() * 256;
      ctx.fillStyle =
        'rgba(' +
        (110 + Math.random() * 30) +
        ',' +
        (110 + Math.random() * 30) +
        ',' +
        (108 + Math.random() * 20) +
        ',0.25)';
      ctx.fillRect(rx, ry, 2 + Math.random() * 3, 2 + Math.random() * 3);
    }
    // 屋面分隔缝(混凝土屋面分格)
    ctx.strokeStyle = 'rgba(90,90,88,0.3)';
    ctx.lineWidth = 1;
    for (var g = 0; g < 256; g += 64) {
      ctx.beginPath();
      ctx.moveTo(g, 0);
      ctx.lineTo(g, 256);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, g);
      ctx.lineTo(256, g);
      ctx.stroke();
    }
    var tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.generateMipmaps = true;
    window._campusRoofTex = tex;
    return tex;
  }
  // 校园(真实 footprint 拉伸建筑 + 操场草地/塑胶跑道/地砖) — v0.67 校园地图用
  var _wallTex = _makeCampusWallTex();
  var _roofTex = _makeCampusRoofTex();
  const campusWallM = new THREE.MeshStandardMaterial({
    map: _wallTex,
    color: '#ffffff',
    roughness: 0.8,
  });
  const campusRoofM = new THREE.MeshStandardMaterial({
    map: _roofTex,
    color: '#ffffff',
    roughness: 0.85,
  });
  // 外廊栏杆材质(深灰, 微金属)
  const campusRailingM = new THREE.MeshStandardMaterial({
    color: '#9a9a98',
    roughness: 0.5,
    metalness: 0.3,
  });
  // 运动场内部: 草地纯色fallback(真正纹理由 createGrounds 懒初始化用 TerrainTextures.grass())
  const campusGrassM = new THREE.MeshStandardMaterial({
    color: '#4A8C3F', // 游戏标准草绿(对齐 generateCompositeGroundTexture #4a8c3f)
    roughness: 0.95,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -4,
  });
  // 塑胶跑道底色(砖红) — createSportsTrackZone 程序化纹理兜底色
  const campusPitchM = new THREE.MeshStandardMaterial({
    color: '#C23D32',
    roughness: 0.9,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });

  function addShadow(g) {
    g.traverse((c) => {
      if (c.isMesh) {
        c.castShadow = true;
        c.receiveShadow = true;
      }
    });
  }

  // 平房（精细化：山墙屋顶+窗户+门+烟囱，固定单位底面积）
  function createBungalow() {
    const g = new THREE.Group();
    // 固定单位尺寸（缩放基准 = 1.0）
    const w = 1.0,
      d = 0.85;
    const h = 0.72; // 主体高度
    const rH = 0.32; // 屋顶高度

    const wallM = bunWallM,
      roofM = bunRoofM,
      trimM = bunTrimM,
      winM = bunWinM,
      doorM = bunDoorM;

    // 主体
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallM);
    body.position.y = h / 2;
    g.add(body);

    // 山墙屋顶（三角形沿Z拉伸）
    const oH = 0.04; // 屋檐出挑
    const shp = new THREE.Shape();
    const hw = w / 2 + oH;
    shp.moveTo(-hw, 0);
    shp.lineTo(0, rH);
    shp.lineTo(hw, 0);
    shp.closePath();
    const roofMsh = new THREE.Mesh(
      new THREE.ExtrudeGeometry(shp, { depth: d + oH * 2, bevelEnabled: false }),
      roofM
    );
    roofMsh.position.set(0, h, -(d + oH * 2) / 2);
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

    g.userData = {
      category: 'bungalow',
      height: h + rH,
      radius: (Math.max(w, d) / 2) * 1.15,
      color: '#' + wallM.color.getHexString(),
      targetHeightMinM: 2.5,
      targetHeightMaxM: 3.3,
    };
    addShadow(g);
    return g;
  }

  // 别墅（精细化：二层退台+石墙/木墙+山墙屋顶+阳台+楼梯+烟囱，固定单位底面积）
  function createVilla() {
    const g = new THREE.Group();
    // 固定单位尺寸（缩放基准 = 1.0）
    const w = 1.0,
      d = 0.86;
    const h1 = 0.5; // 一楼高
    const h2 = 0.45; // 二楼高
    const w2 = w * 0.78,
      d2 = d * 0.78; // 二楼退台

    const stoneM = vilStoneM,
      woodM = vilWoodM,
      darkM = vilDarkM,
      roofM = vilRoofM,
      trimM = vilTrimM,
      winM = vilWinM,
      doorM = vilDoorM;

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
    for (let bx = -w2 / 2 + 0.04; bx <= w2 / 2 - 0.04; bx += (w2 - 0.08) / 3) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.12, 0.02), darkM);
      post.position.set(bx, balcH + 0.06, d * 0.38);
      g.add(post);
    }
    // 栏杆横梁
    const rail = new THREE.Mesh(new THREE.BoxGeometry(w2 + 0.02, 0.02, 0.02), darkM);
    rail.position.set(0, balcH + 0.12, d * 0.38);
    g.add(rail);

    // 山墙屋顶（三角形沿Z拉伸，二楼顶部）
    const rH = 0.3,
      oH = 0.05;
    const shp = new THREE.Shape();
    const hw = w2 / 2 + oH;
    shp.moveTo(-hw, 0);
    shp.lineTo(0, rH);
    shp.lineTo(hw, 0);
    shp.closePath();
    const roof = new THREE.Mesh(
      new THREE.ExtrudeGeometry(shp, { depth: d2 + oH * 2, bevelEnabled: false }),
      roofM
    );
    roof.position.set(0, h1 + h2, -(d2 + oH * 2) / 2);
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

    g.userData = {
      category: 'villa',
      height: h1 + h2 + rH,
      radius: (Math.max(w, d) / 2) * 1.15,
      color: '#8B7D6B',
      targetHeightMinM: 3,
      targetHeightMaxM: 5.5,
    };
    addShadow(g);
    return g;
  }

  // 公寓（精细化：底商石材层+白色瓷砖住宅层+灰色退台顶层，固定单位底面积）
  function createApartment() {
    const g = new THREE.Group();

    // 固定单位尺寸：totalH=5.0 代表 5x 坦克高度（最低要求）
    // createObstacles 中会应用 scale=1.0~2.0，得到 5x~10x 坦克高度
    const w = 1.0,
      d = 1.0; // 固定正方形底面积
    const totalH = 5.0; // 基准高度 = 5x 坦克高度

    // 分层比例（与 totalH 相乘得到各层高度）
    const shopH = totalH * 0.18; // 底层商铺/车库（深色石材）
    const resH = totalH * 0.65; // 中层住宅（白色瓷砖）
    const topH = totalH * 0.17; // 顶层退台（灰色设备层）
    const railH = 0.06; // 顶层围栏高度

    // 材质
    const stoneM = aptStoneM,
      tileM = aptTileM,
      topM = aptTopM,
      winM = aptWinM,
      frameM = aptFrameM,
      shutterM = aptShutterM;

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
      const dFrm = new THREE.Mesh(new THREE.BoxGeometry(w * 0.26, shopH * 0.7, 0.008), frameM);
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
          const win = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.14), winM);
          win.position.set(wi * w * 0.22, wy, side * (d / 2 + 0.002));
          g.add(win);
          // 窗框
          const frm = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.18, 0.006), frameM);
          frm.position.set(wi * w * 0.22, wy, side * (d / 2 + 0.003));
          g.add(frm);
        }
        // 侧面窗户（X方向）
        for (let wi = -1; wi <= 1; wi += 2) {
          const winS = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.14), winM);
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
    const topW = w * 0.82,
      topD = d * 0.82; // 退台收窄
    const topBody = new THREE.Mesh(new THREE.BoxGeometry(topW, topH, topD), topM);
    topBody.position.y = shopH + resH + topH / 2;
    g.add(topBody);
    // 顶层围栏（天台护栏）
    const railThick = 0.015;
    for (let side = -1; side <= 1; side += 2) {
      // Z方向围栏
      const railZ = new THREE.Mesh(
        new THREE.BoxGeometry(topW + railThick * 2, railThick, railThick),
        frameM
      );
      railZ.position.set(0, shopH + resH + topH + railThick / 2, side * (topD / 2 + railThick / 2));
      g.add(railZ);
      // X方向围栏
      const railX = new THREE.Mesh(
        new THREE.BoxGeometry(railThick, railThick, topD + railThick * 2),
        frameM
      );
      railX.position.set(side * (topW / 2 + railThick / 2), shopH + resH + topH + railThick / 2, 0);
      g.add(railX);
    }
    // 顶层立柱（4角）
    for (let cx = -1; cx <= 1; cx += 2) {
      for (let cz = -1; cz <= 1; cz += 2) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.03, topH + railH, 0.03), frameM);
        post.position.set((cx * topW) / 2, shopH + resH + topH / 2 + railH / 2, (cz * topD) / 2);
        g.add(post);
      }
    }
    // 顶层设备箱（空调/水箱）
    const equip = new THREE.Mesh(new THREE.BoxGeometry(topW * 0.35, topH * 0.5, topD * 0.35), topM);
    equip.position.set(topW * 0.15, shopH + resH + topH * 0.75, -topD * 0.15);
    g.add(equip);

    g.userData = {
      category: 'apartment',
      height: totalH + railH,
      radius: (Math.max(w, d) / 2) * 1.15,
      color: '#F5F5F5',
      targetHeightMinM: 4.2,
      targetHeightMaxM: 9.7,
    };
    addShadow(g);
    return g;
  }

  // 注册
  window.ModelRegistry.register('buildings', 'bungalow', createBungalow, 10);
  window.ModelRegistry.register('buildings', 'villa', createVilla, 10);
  window.ModelRegistry.register('buildings', 'apartment', createApartment, 7);
  // 校园地图材质暴露(footprint 拉伸建筑 + 操场草地/塑胶跑道用)
  window.CampusMaterials = {
    wall: campusWallM,
    roof: campusRoofM,
    pitch: campusPitchM,
    grass: campusGrassM,
    railing: campusRailingM,
  };
})();
