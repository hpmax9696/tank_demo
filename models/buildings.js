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

  // ── 厕所(校园地图专用) ──
  const _twM = new THREE.MeshStandardMaterial({ color: '#f0ece0', roughness: 0.6 }); // 外墙米白
  const _trM = new THREE.MeshStandardMaterial({ color: '#7a7a7a', roughness: 0.7 }); // 单坡屋顶灰
  const _tdM = new THREE.MeshStandardMaterial({ color: '#8B6914', roughness: 0.7 }); // 木门
  const _tgM = new THREE.MeshStandardMaterial({
    color: '#c8ddf0',
    roughness: 0.15,
    metalness: 0.3,
  }); // 玻璃窗
  const _tsM = new THREE.MeshStandardMaterial({ color: '#e8e0d0', roughness: 0.5 }); // 洗手台
  const _tmM = new THREE.MeshStandardMaterial({ color: '#d8e8f8', roughness: 0.1, metalness: 0.5 }); // 镜子

  // 厕所标志纹理(Canvas生成, 缓存)
  function _toiletSignTex(gender) {
    var key = '_signTexV11' + gender;
    if (window[key]) return window[key];
    var c = document.createElement('canvas');
    c.width = 128;
    c.height = 128;
    var ctx = c.getContext('2d');
    ctx.clearRect(0, 0, 128, 128); // 全透明底
    ctx.fillStyle = '#1a3a5c'; // 深蓝圆底
    ctx.beginPath();
    ctx.arc(64, 64, 60, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    if (gender === 'male') {
      // 男: 圆头 + 矩形身 + 双腿
      ctx.beginPath();
      ctx.arc(64, 36, 10, 0, Math.PI * 2);
      ctx.fill(); // 头
      ctx.fillRect(50, 52, 28, 30); // 身体(加长)
      ctx.fillRect(50, 82, 11, 28); // 左腿(加长)
      ctx.fillRect(67, 82, 11, 28); // 右腿(加长)
    } else {
      // 女: 圆头 + 沙漏型(上小三角+下大三角) + 双腿
      ctx.beginPath();
      ctx.arc(64, 29, 10, 0, Math.PI * 2);
      ctx.fill(); // 头
      // 上三角(小): 肩宽→腰窄 (上宽下窄)
      ctx.beginPath();
      ctx.moveTo(44, 42);
      ctx.lineTo(84, 42);
      ctx.lineTo(76, 56);
      ctx.lineTo(52, 56);
      ctx.closePath();
      ctx.fill();
      // 下三角(大): 腰窄→裙宽 (上窄下宽)
      ctx.beginPath();
      ctx.moveTo(52, 56);
      ctx.lineTo(76, 56);
      ctx.lineTo(94, 88);
      ctx.lineTo(34, 88);
      ctx.closePath();
      ctx.fill();
      ctx.fillRect(51, 88, 10, 22); // 左腿(内边61, 与男标志腿距一致)
      ctx.fillRect(67, 88, 10, 22); // 右腿(内边67)
    }
    var tex = new THREE.CanvasTexture(c);
    tex.minFilter = THREE.LinearFilter;
    tex.premultiplyAlpha = false;
    tex.colorSpace = THREE.SRGBColorSpace; // 画布颜色是sRGB, 不标记会被当linear→显示偏亮
    window[key] = tex;
    return tex;
  }

  window.createToilet = function (rowLen) {
    // 二层厕所楼 — 移植自独立建模(v8加宽), 双跑楼梯+洗手区+男女厕
    // 内部坐标系: 前=+Z, 后=-Z; 左=-X(楼梯), 右=+X(厕所)
    // 外层旋转PI使前=-Z对齐游戏约定
    if (!rowLen || rowLen < 8) rowLen = 8;

    // ── 尺寸参数(沿X=长边=rowLen, 沿Z=进深) ──
    var BLD_D = 5.5; // 建筑进深(Z向)
    var FLOOR_H = 3.0; // 层高
    var WALL_T = 0.24; // 墙厚
    var STAIR_W = Math.max(3.5, rowLen * 0.16); // 楼梯间宽
    var WASH_W = Math.max(3.0, rowLen * 0.14); // 洗手区宽
    var TOILET_W = rowLen - STAIR_W - WASH_W; // 厕所宽
    var WASH_D = BLD_D * 0.45; // 洗手区进深(从前墙向后)

    var hD = BLD_D / 2;
    var hW = rowLen / 2;
    var X_LEFT = -hW;
    var X_RIGHT = hW;
    var X_STAIR_R = X_LEFT + STAIR_W;
    var X_WASH_R = X_STAIR_R + WASH_W;
    var Z_FRONT = hD;
    var Z_BACK = -hD;
    var Z_WASH_BACK = Z_FRONT - WASH_D;

    var innerG = new THREE.Group(); // 内部组(前=+Z), 最后旋转PI使前=-Z
    innerG.position.z = 0.75; // 前墙保持原位, 后墙缩进1.5m(7→5.5)

    // ── 材质 ──
    var wMat = _twM; // 外墙
    var wiMat = new THREE.MeshStandardMaterial({
      color: 0xf0ebe0,
      roughness: 0.8,
      side: THREE.DoubleSide,
    });
    var flMat = new THREE.MeshStandardMaterial({ color: 0xbbbbbb, roughness: 0.7 });
    var rfMat = _trM; // 屋顶
    var stMat = new THREE.MeshStandardMaterial({ color: 0xc8c8c8, roughness: 0.6 });
    var rlMat = new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.3, metalness: 0.7 });
    var drMat = _tdM; // 门
    var tlMat = new THREE.MeshStandardMaterial({ color: 0xd8f0f0, roughness: 0.3 });
    var skMat = _tsM; // 洗手台
    var mtMat = new THREE.MeshStandardMaterial({ color: 0xc0c0c0, roughness: 0.2, metalness: 0.8 });
    var bmMat = new THREE.MeshStandardMaterial({ color: 0x999999, roughness: 0.7 });
    var frMat = new THREE.MeshStandardMaterial({ color: 0x8b7355, roughness: 0.5 });

    // ── 辅助函数 ──
    function addBox(w, h, d, x, y, z, mat, castS, recvS) {
      if (castS === undefined) castS = true;
      if (recvS === undefined) recvS = true;
      var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(x, y, z);
      m.castShadow = castS;
      m.receiveShadow = recvS;
      innerG.add(m);
      return m;
    }

    function wallX(x1, x2, y, z, h, t, mat) {
      var w = Math.abs(x2 - x1);
      if (w < 0.01) return;
      addBox(w, h, t, (x1 + x2) / 2, y + h / 2, z, mat);
    }

    function wallZ(z1, z2, y, x, h, t, mat) {
      var d = Math.abs(z2 - z1);
      if (d < 0.01) return;
      addBox(t, h, d, x, y + h / 2, (z1 + z2) / 2, mat);
    }

    // 带门洞的Z向隔墙
    function wallZWithDoor(z1, z2, y, x, h, t, doorZ, doorW, doorH, mat) {
      var minZ = Math.min(z1, z2);
      var maxZ = Math.max(z1, z2);
      var doorLeft = doorZ - doorW / 2;
      var doorRight = doorZ + doorW / 2;
      if (doorLeft > minZ + 0.01) wallZ(minZ, doorLeft, y, x, h, t, mat);
      if (doorRight < maxZ - 0.01) wallZ(doorRight, maxZ, y, x, h, t, mat);
      var lintelH = h - doorH;
      if (lintelH > 0.01) addBox(t, lintelH, doorW, x, y + doorH + lintelH / 2, doorZ, mat);
      // 门扇
      addBox(0.06, doorH - 0.05, doorW - 0.06, x, y + doorH / 2, doorZ, drMat);
      // 门框
      addBox(0.08, 0.08, doorW + 0.12, x, y + doorH + 0.04, doorZ, frMat);
      addBox(0.08, doorH + 0.08, 0.08, x, y + doorH / 2, doorZ - doorW / 2 - 0.04, frMat);
      addBox(0.08, doorH + 0.08, 0.08, x, y + doorH / 2, doorZ + doorW / 2 + 0.04, frMat);
    }

    // Z向栏杆(沿Z走向)
    function railingZ(z1, z2, y, x, h) {
      var len = Math.abs(z2 - z1);
      if (len < 0.1) return;
      var cz = (z1 + z2) / 2;
      addBox(0.06, 0.06, len, x, y + h, cz, rlMat);
      addBox(0.04, 0.04, len, x, y + h * 0.5, cz, rlMat);
      addBox(0.05, 0.05, len, x, y + 0.08, cz, rlMat);
      var numBars = Math.max(2, Math.floor(len / 0.12));
      for (var bi = 0; bi <= numBars; bi++) {
        var bar = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, h - 0.08, 6), rlMat);
        bar.position.set(x, y + h / 2 + 0.04, z1 + (len / numBars) * bi);
        innerG.add(bar);
      }
      var numPosts = Math.max(2, Math.ceil(len / 1.5));
      for (var pi = 0; pi <= numPosts; pi++) {
        var post = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, h + 0.05, 8), rlMat);
        post.position.set(x, y + h / 2, z1 + (len / numPosts) * pi);
        innerG.add(post);
      }
    }

    // X向栏杆(沿X走向)
    function railingX(x1, x2, y, z, h) {
      var len = Math.abs(x2 - x1);
      if (len < 0.1) return;
      var cx = (x1 + x2) / 2;
      addBox(len, 0.06, 0.06, cx, y + h, z, rlMat);
      addBox(len, 0.04, 0.04, cx, y + h * 0.5, z, rlMat);
      addBox(len, 0.05, 0.05, cx, y + 0.08, z, rlMat);
      var numBars = Math.max(2, Math.floor(len / 0.12));
      for (var bi = 0; bi <= numBars; bi++) {
        var bar2 = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, h - 0.08, 6), rlMat);
        bar2.position.set(x1 + (len / numBars) * bi, y + h / 2 + 0.04, z);
        innerG.add(bar2);
      }
      var numPosts = Math.max(2, Math.ceil(len / 1.5));
      for (var pi = 0; pi <= numPosts; pi++) {
        var post2 = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, h + 0.05, 8), rlMat);
        post2.position.set(x1 + (len / numPosts) * pi, y + h / 2, z);
        innerG.add(post2);
      }
    }

    // ═══════════════════════════
    // 楼板与屋顶
    // ═══════════════════════════
    function createFloorsAndRoof() {
      // 一层地面
      addBox(rowLen, 0.2, BLD_D, 0, -0.1, 0, flMat, false, true);

      // 二层楼板: 厕所+洗手区整块
      var mainW = X_RIGHT - X_STAIR_R;
      addBox(mainW, 0.2, BLD_D, (X_STAIR_R + X_RIGHT) / 2, FLOOR_H, 0, flMat, false, true);

      // 楼梯间F2楼板: 围出矩形洞口
      var stairCX = (X_LEFT + X_STAIR_R) / 2;
      var holeX1 = X_LEFT + 0.3;
      var holeX2 = X_STAIR_R - 0.3;
      var holeZ1 = -1.5;
      var holeZ2 = 2.0;
      var holeD = holeZ2 - holeZ1;

      // 洞口后方板
      var backD = holeZ1 - Z_BACK;
      if (backD > 0.03)
        addBox(STAIR_W, 0.2, backD, stairCX, FLOOR_H, (Z_BACK + holeZ1) / 2, flMat, false, true);
      // 洞口前方板
      var frontD = Z_FRONT - holeZ2;
      if (frontD > 0.03)
        addBox(STAIR_W, 0.2, frontD, stairCX, FLOOR_H, (holeZ2 + Z_FRONT) / 2, flMat, false, true);
      // 洞口左侧板
      var leftW = holeX1 - X_LEFT;
      if (leftW > 0.03)
        addBox(
          leftW,
          0.2,
          holeD,
          (X_LEFT + holeX1) / 2,
          FLOOR_H,
          (holeZ1 + holeZ2) / 2,
          flMat,
          false,
          true
        );
      // 洞口右侧板
      var rightW = X_STAIR_R - holeX2;
      if (rightW > 0.03)
        addBox(
          rightW,
          0.2,
          holeD,
          (holeX2 + X_STAIR_R) / 2,
          FLOOR_H,
          (holeZ1 + holeZ2) / 2,
          flMat,
          false,
          true
        );

      // 屋顶
      addBox(rowLen + 0.5, 0.25, BLD_D + 0.5, 0, FLOOR_H * 2 + 0.125, 0, rfMat);

      // 女儿墙
      var parH = 0.5,
        parT = 0.12;
      addBox(rowLen + 0.5, parH, parT, 0, FLOOR_H * 2 + 0.25 + parH / 2, Z_FRONT + 0.15, wMat);
      addBox(rowLen + 0.5, parH, parT, 0, FLOOR_H * 2 + 0.25 + parH / 2, Z_BACK - 0.15, wMat);
      addBox(parT, parH, BLD_D + 0.5, X_LEFT - 0.15, FLOOR_H * 2 + 0.25 + parH / 2, 0, wMat);
      addBox(parT, parH, BLD_D + 0.5, X_RIGHT + 0.15, FLOOR_H * 2 + 0.25 + parH / 2, 0, wMat);
    }

    // ═══════════════════════════
    // 墙体
    // ═══════════════════════════
    function createWalls() {
      for (var floor = 0; floor < 2; floor++) {
        var y = floor * FLOOR_H;
        // 后墙(全长)
        wallX(X_LEFT, X_RIGHT, y, Z_BACK, FLOOR_H, WALL_T, wMat);
        // 左侧外墙
        wallZ(Z_BACK, Z_FRONT, y, X_LEFT, FLOOR_H, WALL_T, wMat);
        // 右侧外墙
        wallZ(Z_BACK, Z_FRONT, y, X_RIGHT, FLOOR_H, WALL_T, wMat);
        // 厕所前墙(+Z面, 厕所段)
        wallX(X_WASH_R, X_RIGHT, y, Z_FRONT, FLOOR_H, WALL_T, wMat);
        // 洗手区-厕所隔墙(Z_BACK→Z_WASH_BACK之间+Z段, 带门)
        wallZWithDoor(Z_WASH_BACK, Z_FRONT, y, X_WASH_R, FLOOR_H, WALL_T, 2.0, 0.9, 2.2, wiMat);
        // 楼梯-洗手隔墙(Z_BACK→Z_WASH_BACK, X_STAIR_R处)
        wallZ(Z_BACK, Z_WASH_BACK, y, X_STAIR_R, FLOOR_H, WALL_T, wiMat);
        // 楼梯-洗手隔墙前段(续接至Z_FRONT, X_STAIR_R处)
        wallX(X_STAIR_R, X_WASH_R, y, Z_WASH_BACK, FLOOR_H, WALL_T, wiMat);
      }
    }

    // ═══════════════════════════
    // 双跑楼梯
    // ═══════════════════════════
    function createStairs() {
      var stepsPerFlight = 9;
      var stepH = FLOOR_H / 20;
      var stepD = 0.26;
      var stairW = 1.1;
      var gapW = 0.2;

      var stairCX = (X_LEFT + X_STAIR_R) / 2;
      var flight1X = stairCX - (stairW + gapW) / 2;
      var flight2X = stairCX + (stairW + gapW) / 2;

      var f1StartZ = Z_FRONT - 0.6;
      var f1EndZ = f1StartZ - stepsPerFlight * stepD;

      // 第一跑(F1→平台)
      for (var i = 0; i < stepsPerFlight; i++) {
        addBox(stairW, stepH, stepD, flight1X, i * stepH + stepH / 2, f1StartZ - i * stepD, stMat);
      }

      // 休息平台
      var landingY = FLOOR_H / 2;
      var landingD = stairW * 2 + gapW + 0.2;
      var landingZ_front = f1EndZ;
      var landingZ_back = f1EndZ - landingD;
      addBox(
        stairW * 2 + gapW + 0.4,
        0.15,
        landingD,
        stairCX,
        landingY - 0.075,
        (landingZ_front + landingZ_back) / 2,
        stMat
      );

      // 平台梁
      addBox(
        0.2,
        0.3,
        landingD + 1.0,
        flight1X,
        landingY - 0.3,
        (landingZ_front + landingZ_back) / 2 - 0.5,
        bmMat
      );
      addBox(
        0.2,
        0.3,
        landingD + 1.0,
        flight2X,
        landingY - 0.3,
        (landingZ_front + landingZ_back) / 2 - 0.5,
        bmMat
      );

      // 平台柱
      var colPositions = [
        [flight1X, landingZ_back + 0.3],
        [flight2X, landingZ_back + 0.3],
        [flight1X, landingZ_front - 0.3],
        [flight2X, landingZ_front - 0.3],
      ];
      for (var ci = 0; ci < colPositions.length; ci++) {
        var col = new THREE.Mesh(
          new THREE.CylinderGeometry(0.12, 0.12, landingY - 0.15, 12),
          bmMat
        );
        col.position.set(colPositions[ci][0], (landingY - 0.15) / 2, colPositions[ci][1]);
        col.castShadow = true;
        innerG.add(col);
      }

      // 第二跑(平台→F2)
      var f2StartZ = f1EndZ;
      var f2EndZ = f2StartZ + stepsPerFlight * stepD;
      for (var i2 = 0; i2 < stepsPerFlight; i2++) {
        addBox(
          stairW,
          stepH,
          stepD,
          flight2X,
          landingY + i2 * stepH + stepH / 2,
          f2StartZ + i2 * stepD,
          stMat
        );
      }

      // F2出口处平台
      addBox(stairW + 0.5, 0.15, 1.0, flight2X, FLOOR_H - 0.075, f2EndZ + 0.5, stMat);

      // 楼梯扶手
      createStairHandrail(flight1X - stairW / 2, 0, f1StartZ, stepsPerFlight, stepH, stepD, -1);
      createStairHandrail(flight1X + stairW / 2, 0, f1StartZ, stepsPerFlight, stepH, stepD, -1);
      createStairHandrail(
        flight2X - stairW / 2,
        landingY,
        f2StartZ,
        stepsPerFlight,
        stepH,
        stepD,
        1
      );
      createStairHandrail(
        flight2X + stairW / 2,
        landingY,
        f2StartZ,
        stepsPerFlight,
        stepH,
        stepD,
        1
      );

      // 平台栏杆
      railingX(flight1X - stairW / 2, flight2X + stairW / 2, landingY, landingZ_back, 1.0);
      railingZ(landingZ_back, landingZ_front, landingY, flight1X - stairW / 2, 1.0);
      railingZ(landingZ_back, landingZ_front, landingY, flight2X + stairW / 2, 1.0);

      // F2楼梯洞口栏杆
      var holeX1 = X_LEFT + 0.3,
        holeX2 = X_STAIR_R - 0.3;
      var holeZ1 = -1.5,
        holeZ2 = 2.0;
      railingX(holeX1, holeX2, FLOOR_H, holeZ1, 1.1);
      railingZ(holeZ1, holeZ2, FLOOR_H, holeX1, 1.1);
      railingZ(holeZ1, holeZ2, FLOOR_H, holeX2, 1.1);
      var stairOpenL = flight2X - stairW / 2 - 0.25;
      var stairOpenR = flight2X + stairW / 2 + 0.25;
      railingX(holeX1, stairOpenL, FLOOR_H, holeZ2, 1.1);
      railingX(stairOpenR, holeX2, FLOOR_H, holeZ2, 1.1);
    }

    function createStairHandrail(x, startY, startZ, steps, stepH, stepD, dir) {
      var railH = 0.9;
      var totalH = steps * stepH;
      var totalD = steps * stepD;
      var angle = Math.atan2(totalH, totalD);
      var railLen = Math.sqrt(totalH * totalH + totalD * totalD) + 0.3;
      var cy = startY + totalH / 2 + railH;
      var cz = startZ + (dir * totalD) / 2;

      var handrail = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, railLen, 8), rlMat);
      if (dir < 0) {
        handrail.rotation.x = angle - Math.PI / 2;
      } else {
        handrail.rotation.x = Math.PI / 2 - angle;
      }
      handrail.position.set(x, cy, cz);
      innerG.add(handrail);

      for (var i = 0; i <= steps; i += 2) {
        var post = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, railH, 6), rlMat);
        post.position.set(x, startY + i * stepH + railH / 2, startZ + dir * i * stepD);
        innerG.add(post);
      }
    }

    // ═══════════════════════════
    // F2 前脸栏杆
    // ═══════════════════════════
    function createSecondFloorRailings() {
      var y = FLOOR_H,
        railH = 1.1;
      // 楼梯间前脸
      railingX(X_LEFT + WALL_T, X_STAIR_R - WALL_T / 2, y, Z_FRONT - 0.15, railH);
      // 洗手区前脸
      railingX(X_STAIR_R + WALL_T / 2, X_WASH_R - WALL_T, y, Z_FRONT - 0.15, railH);
    }

    // ═══════════════════════════
    // 洗手区
    // ═══════════════════════════
    function createWashArea(floor) {
      var y = floor * FLOOR_H;
      var washCX = (X_STAIR_R + X_WASH_R) / 2;
      var sinkZ = Z_WASH_BACK + WALL_T / 2 + 0.4; // 靠后墙

      // 洗手台底座
      addBox(2.4, 0.8, 0.5, washCX, y + 0.4, sinkZ, tlMat);
      // 台面
      addBox(2.5, 0.05, 0.58, washCX, y + 0.825, sinkZ, skMat);
      // 水龙头
      for (var fi = -1; fi <= 1; fi++) {
        var faucet = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, 0.22, 8), mtMat);
        faucet.position.set(washCX + fi * 0.7, y + 0.94, sinkZ - 0.1);
        innerG.add(faucet);
      }
      // 镜子
      var mirror = new THREE.Mesh(
        new THREE.BoxGeometry(2.4, 0.9, 0.03),
        new THREE.MeshStandardMaterial({ color: 0xaaddff, roughness: 0.05, metalness: 0.9 })
      );
      mirror.position.set(washCX, y + 1.45, Z_WASH_BACK + WALL_T / 2 + 0.02);
      innerG.add(mirror);
    }

    // ═══════════════════════════
    // 厕所洁具
    // ═══════════════════════════
    function createToiletFixtures(floor) {
      var y = floor * FLOOR_H;
      var stallW = 1.0,
        stallD = 1.3,
        stallH = 2.0;
      var stallSpacing = 1.3;

      // 后墙侧蹲位(靠Z_BACK)
      var backStartX = X_WASH_R + WALL_T + 0.5;
      var backEndX = X_RIGHT - WALL_T - 0.3;
      var numBackStalls = Math.floor((backEndX - backStartX) / stallSpacing);
      for (var i = 0; i < numBackStalls; i++) {
        var sx = backStartX + i * stallSpacing + stallW / 2;
        var sz = Z_BACK + WALL_T + stallD / 2 + 0.1;
        if (i > 0) addBox(0.05, stallH, stallD, sx - stallSpacing / 2, y + stallH / 2, sz, tlMat);
        addBox(0.38, 0.38, 0.5, sx, y + 0.19, sz + 0.15, skMat);
        addBox(0.32, 0.3, 0.12, sx, y + 0.5, sz + 0.42, skMat);
      }

      // 前墙侧蹲位(靠Z_FRONT)
      var frontStartX = X_WASH_R + WALL_T + 0.5;
      var frontEndX = X_RIGHT - WALL_T - 0.3;
      var numFrontStalls = Math.floor((frontEndX - frontStartX) / stallSpacing) - 2;
      for (var i2 = 0; i2 < numFrontStalls; i2++) {
        var sx2 = frontStartX + i2 * stallSpacing + stallW / 2;
        var sz2 = Z_FRONT - WALL_T - stallD / 2 - 0.1;
        if (i2 > 0)
          addBox(0.05, stallH, stallD, sx2 - stallSpacing / 2, y + stallH / 2, sz2, tlMat);
        addBox(0.38, 0.38, 0.5, sx2, y + 0.19, sz2 - 0.15, skMat);
        addBox(0.32, 0.3, 0.12, sx2, y + 0.5, sz2 - 0.42, skMat);
      }

      // 小便池(仅一楼男厕, 后墙)
      if (floor === 0) {
        for (var ui = 0; ui < 5; ui++) {
          addBox(
            0.3,
            0.45,
            0.2,
            X_STAIR_R + WALL_T + 0.5 + ui * 0.7,
            y + 0.55,
            Z_BACK + WALL_T + 0.15,
            skMat
          );
        }
        // 拐角小便池
        for (var uj = 0; uj < 2; uj++) {
          addBox(
            0.2,
            0.45,
            0.3,
            X_STAIR_R + WALL_T + 0.15,
            y + 0.55,
            Z_BACK + WALL_T + 1.5 + uj * 0.8,
            skMat
          );
        }
      }
    }

    // ═══════════════════════════
    // 厕所标志
    // ═══════════════════════════
    // 厕所标志纹理(Canvas生成, SVG→Canvas2D)
    function _makeSignTex(gender) {
      var c = document.createElement('canvas');
      c.width = 128;
      c.height = 256;
      var ctx = c.getContext('2d');
      var W = 128,
        H = 256;
      // 背景圆角矩形
      var bgColor = gender === 'male' ? '#1A5276' : '#C0392B';
      var rx = 16,
        ry = 16;
      ctx.fillStyle = bgColor;
      ctx.beginPath();
      ctx.moveTo(rx, 0);
      ctx.lineTo(W - rx, 0);
      ctx.quadraticCurveTo(W, 0, W, ry);
      ctx.lineTo(W, H - ry);
      ctx.quadraticCurveTo(W, H, W - rx, H);
      ctx.lineTo(rx, H);
      ctx.quadraticCurveTo(0, H, 0, H - ry);
      ctx.lineTo(0, ry);
      ctx.quadraticCurveTo(0, 0, rx, 0);
      ctx.fill();
      // 人物(白色)
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#ffffff';
      ctx.lineCap = 'round';
      if (gender === 'male') {
        // 头
        ctx.beginPath();
        ctx.arc(64, 48, 20, 0, Math.PI * 2);
        ctx.fill();
        // 身体
        ctx.beginPath();
        roundRect(ctx, 40, 77, 48, 70, 8);
        ctx.fill();
        // 左臂
        ctx.beginPath();
        roundRect(ctx, 20, 80, 17, 58, 8);
        ctx.fill();
        // 右臂
        ctx.beginPath();
        roundRect(ctx, 91, 80, 17, 58, 8);
        ctx.fill();
        // 左腿
        ctx.beginPath();
        roundRect(ctx, 40, 154, 20, 70, 6);
        ctx.fill();
        // 右腿
        ctx.beginPath();
        roundRect(ctx, 68, 154, 20, 70, 6);
        ctx.fill();
      } else {
        // 头
        ctx.beginPath();
        ctx.arc(64, 48, 19, 0, Math.PI * 2);
        ctx.fill();
        // 上半身(V字形)
        ctx.beginPath();
        ctx.moveTo(46, 77);
        ctx.lineTo(82, 77);
        ctx.quadraticCurveTo(84, 77, 84, 79);
        ctx.lineTo(84, 88);
        ctx.lineTo(75, 112);
        ctx.lineTo(53, 112);
        ctx.lineTo(44, 88);
        ctx.lineTo(44, 79);
        ctx.quadraticCurveTo(44, 77, 46, 77);
        ctx.fill();
        // 左臂(八字形)
        ctx.lineWidth = 13;
        ctx.beginPath();
        ctx.moveTo(46, 80);
        ctx.lineTo(24, 134);
        ctx.stroke();
        // 右臂(八字形)
        ctx.beginPath();
        ctx.moveTo(82, 80);
        ctx.lineTo(104, 134);
        ctx.stroke();
        ctx.lineWidth = 1;
        // 裙子
        ctx.beginPath();
        ctx.moveTo(51, 114);
        ctx.lineTo(77, 114);
        ctx.lineTo(101, 186);
        ctx.lineTo(27, 186);
        ctx.closePath();
        ctx.fill();
        // 左腿
        ctx.beginPath();
        roundRect(ctx, 44, 188, 18, 42, 6);
        ctx.fill();
        // 右腿
        ctx.beginPath();
        roundRect(ctx, 67, 188, 18, 42, 6);
        ctx.fill();
      }
      var tex = new THREE.CanvasTexture(c);
      tex.minFilter = THREE.LinearFilter;
      tex.colorSpace = THREE.SRGBColorSpace;
      return tex;
    }
    function roundRect(ctx, x, y, w, h, r) {
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + h - r);
      ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      ctx.lineTo(x + r, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
    }

    function createSigns() {
      // 标志贴洗手-厕所隔墙(X_WASH_R), 朝向洗手区(-X面), 门旁
      var signW = 0.36,
        signH = 0.72; // 宽高比1:2, 放大两倍
      var signX = X_WASH_R - WALL_T / 2 - 0.02;
      var signZ = 1.2; // 门(doorZ≈2.0)旁边

      var signGeo = new THREE.PlaneGeometry(signW, signH);
      // 一楼男厕标志
      var signM = new THREE.Mesh(
        signGeo,
        new THREE.MeshBasicMaterial({
          map: _makeSignTex('male'),
          side: THREE.DoubleSide,
          transparent: true,
          depthWrite: false,
        })
      );
      signM.position.set(signX, 1.7, signZ);
      signM.rotation.y = -Math.PI / 2; // 面朝-X(洗手区)
      innerG.add(signM);
      // 二楼女厕标志
      var signF = new THREE.Mesh(
        signGeo,
        new THREE.MeshBasicMaterial({
          map: _makeSignTex('female'),
          side: THREE.DoubleSide,
          transparent: true,
          depthWrite: false,
        })
      );
      signF.position.set(signX, FLOOR_H + 1.7, signZ);
      signF.rotation.y = -Math.PI / 2;
      innerG.add(signF);
    }

    // ═══════════════════════════
    // 厕所前墙窗户(贴面,不挖洞)
    // ═══════════════════════════
    function createToiletWindows() {
      var winW = 0.7,
        winH = 0.9,
        winD = 0.04;
      var winY = 2.1; // 窗中心距地板高度(高于2m隔断, 低于3m层高)
      var marginX = 0.6;
      var availW = TOILET_W - marginX * 2;
      var spacing = 1.6;
      var numWin = Math.max(1, Math.floor(availW / spacing));
      var actualSpacing = availW / numWin;
      var zWall = Z_FRONT + WALL_T / 2; // 外墙外表面
      var zFrame = zWall + 0.08; // 窗框外移8cm, 远离墙面防闪烁
      var zGlass = zWall + 0.1; // 玻璃再外移2cm

      // 窗框+玻璃材质 (polygonOffset 防与墙面 z-fighting)
      var gMat = new THREE.MeshStandardMaterial({
        color: 0xbcd4e6,
        roughness: 0.15,
        metalness: 0.05,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -2,
      });
      var fMat = new THREE.MeshStandardMaterial({
        color: 0x555555,
        roughness: 0.4,
        metalness: 0.3,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -2,
      });

      for (var floor = 0; floor < 2; floor++) {
        var y = floor * FLOOR_H + winY;
        for (var wi = 0; wi < numWin; wi++) {
          var wx = X_WASH_R + marginX + actualSpacing * (wi + 0.5);
          // 窗框(稍大, 暗色, 贴于墙面)
          addBox(winW + 0.06, winH + 0.06, winD, wx, y, zFrame, fMat);
          // 玻璃(稍小, 浅蓝, 窗框前)
          addBox(winW, winH, winD, wx, y, zGlass, gMat);
        }
      }
    }

    // ═══════════════════════════
    // 组装
    // ═══════════════════════════
    createFloorsAndRoof();
    createWalls();
    createToiletWindows();
    createStairs();
    createSecondFloorRailings();
    createWashArea(0);
    createWashArea(1);
    createToiletFixtures(0);
    createToiletFixtures(1);
    createSigns();

    // 内部坐标系前=+Z, 旋转PI使前=-Z对齐游戏约定
    innerG.rotation.y = Math.PI;

    var g = new THREE.Group();
    g.add(innerG);
    g.userData = { category: 'toilet', height: FLOOR_H * 2 + 0.75, radius: rowLen / 2 };
    return g;
  };

  // 校园地图材质暴露(footprint 拉伸建筑 + 操场草地/塑胶跑道用)
  window.CampusMaterials = {
    wall: campusWallM,
    roof: campusRoofM,
    pitch: campusPitchM,
    grass: campusGrassM,
    railing: campusRailingM,
  };
})();
