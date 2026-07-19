// ==================== 球场模块 (标线纹理 + 球门/篮球架) ====================
// campus 地图专用: 按 grounds 名匹配, 场地面接管渲染(草底+白线), 设备可碎碰撞
// 依赖全局: THREE / obstacleData / obstacleMeshes / window.TerrainTextures
(function () {
  var COURT_RE = { football: /^足球场$/, bb5: /^大篮球场/, bb3: /^小篮球场/ };

  function courtKind(name) {
    if (!name) return null;
    if (COURT_RE.football.test(name)) return 'football';
    if (COURT_RE.bb5.test(name)) return 'bb5';
    if (COURT_RE.bb3.test(name)) return 'bb3';
    return null;
  }

  // footprint 局部基: u=P0→P1 单位向量, v=P1→P2 单位向量 (旋转矩形)
  function _basis(g) {
    var fp = g.footprint;
    var p0 = fp[0],
      p1 = fp[1],
      p2 = fp[2];
    var ux = p1[0] - p0[0],
      uz = p1[1] - p0[1];
    var len0 = Math.sqrt(ux * ux + uz * uz);
    var vx = p2[0] - p1[0],
      vz = p2[1] - p1[1];
    var len1 = Math.sqrt(vx * vx + vz * vz);
    return { p0: p0, u: [ux / len0, uz / len0], v: [vx / len1, vz / len1], len0: len0, len1: len1 };
  }

  // ── 标线布局参数(单位 u) ──
  var LINE_W = 0.12,
    INSET = 0.5;
  // hoopD = 篮筐圆心距端线(标线三分弧圆心与 3D 筐心共用): 板面距端线 + 板筐间隙 0.05 + 筐半径
  var BB5 = { three: 5.2, ftW: 3.8, ftD: 4.4, circle: 1.4, hoopD: 1.425 };
  var BB3 = { three: 3.4, ftW: 2.5, ftD: 2.9, circle: 0.95, hoopD: 1.025 };
  var FB = { circle: 2.3, boxW: 7, boxD: 3, penalty: 4.6 };
  var HOOP = { boardW: 1.38, boardH: 0.81, rimR: 0.175, poleR: 0.08, setback: 0.6 };

  // (long,short) 场地坐标 → canvas px 映射(两向同 scale, 圆不变形)
  function makeMapper(W, len0, len1) {
    var longIsU = len0 >= len1;
    var scale = W / Math.max(len0, len1); // W 对应长轴(brief 原码 W/len0 在 len0<len1 时溢出画布, 标线被裁)
    return {
      L: longIsU ? len0 : len1,
      S: longIsU ? len1 : len0,
      scale: scale,
      xy: function (l, s) {
        return longIsU ? [l * scale, s * scale] : [s * scale, l * scale];
      },
    };
  }
  function _line(ctx, m, l1, s1, l2, s2) {
    var a = m.xy(l1, s1),
      b = m.xy(l2, s2);
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.stroke();
  }
  function _rect(ctx, m, l1, s1, l2, s2) {
    _line(ctx, m, l1, s1, l2, s1);
    _line(ctx, m, l2, s1, l2, s2);
    _line(ctx, m, l2, s2, l1, s2);
    _line(ctx, m, l1, s2, l1, s1);
  }
  function _circle(ctx, m, lc, sc, r, fill) {
    var c = m.xy(lc, sc);
    ctx.beginPath();
    ctx.arc(c[0], c[1], r * m.scale, 0, Math.PI * 2);
    if (fill) ctx.fill();
    else ctx.stroke();
  }

  // 足球场: 沿长轴分 2 子场, 各画边线/中线/中圈/两端禁区/点球点
  function _drawFootball(ctx, m) {
    for (var i = 0; i < 2; i++) {
      var l0 = (i * m.L) / 2 + INSET,
        l1 = ((i + 1) * m.L) / 2 - INSET;
      var lc = (l0 + l1) / 2;
      _rect(ctx, m, l0, INSET, l1, m.S - INSET);
      _line(ctx, m, l0, m.S / 2, l1, m.S / 2);
      _circle(ctx, m, lc, m.S / 2, FB.circle);
      for (var e = 0; e < 2; e++) {
        var sEnd = e === 0 ? INSET : m.S - INSET;
        var dir = e === 0 ? 1 : -1;
        _rect(ctx, m, lc - FB.boxW / 2, sEnd, lc + FB.boxW / 2, sEnd + dir * FB.boxD);
        _circle(ctx, m, lc, sEnd + dir * FB.penalty, 0.1, true);
      }
    }
  }

  // 篮球场: 边线/中线/中圈/两端三分弧+罚球区+罚球圈
  function _drawBasketball(ctx, m, P) {
    _rect(ctx, m, INSET, INSET, m.L - INSET, m.S - INSET);
    _line(ctx, m, m.L / 2, INSET, m.L / 2, m.S - INSET);
    _circle(ctx, m, m.L / 2, m.S / 2, P.circle);
    for (var e = 0; e < 2; e++) {
      var lEnd = e === 0 ? INSET : m.L - INSET;
      var dir = e === 0 ? 1 : -1;
      var hoopL = lEnd + dir * P.hoopD;
      // 罚球区 + 罚球圈
      _rect(ctx, m, lEnd, m.S / 2 - P.ftW / 2, lEnd + dir * P.ftD, m.S / 2 + P.ftW / 2);
      _circle(ctx, m, lEnd + dir * P.ftD, m.S / 2, P.circle);
      // 三分: 弧(圆心=筐点, ±70°) + 两侧直线段连端线
      var TH = (70 * Math.PI) / 180;
      var c = m.xy(hoopL, m.S / 2);
      ctx.beginPath();
      // canvas 角度: 需按 xy 映射方向; 用参数化采样画弧(与映射解耦, 最稳)
      for (var k = 0; k <= 24; k++) {
        var a = -TH + (2 * TH * k) / 24;
        var pl = hoopL + dir * Math.cos(a) * P.three;
        var ps = m.S / 2 + Math.sin(a) * P.three;
        var pt = m.xy(pl, ps);
        if (k === 0) ctx.moveTo(pt[0], pt[1]);
        else ctx.lineTo(pt[0], pt[1]);
      }
      ctx.stroke();
      var endS1 = m.S / 2 - Math.sin(TH) * P.three,
        endS2 = m.S / 2 + Math.sin(TH) * P.three;
      var arcL = hoopL + dir * Math.cos(TH) * P.three;
      _line(ctx, m, lEnd, endS1, arcL, endS1);
      _line(ctx, m, lEnd, endS2, arcL, endS2);
    }
  }

  // 纹理: 草底平铺 + 白线 (按 kind 缓存, key 带版本)
  function _courtTex(kind, len0, len1) {
    var key = '_courtTexV1' + kind;
    if (window[key]) return window[key];
    var W = 1024,
      H = Math.max(64, Math.round((1024 * Math.min(len0, len1)) / Math.max(len0, len1)));
    // makeMapper 用 W 对应长轴: canvas 宽=长轴向(len0>=len1 时 u=x); len0<len1 时 x=short → W/H 互换
    var cW = len0 >= len1 ? W : H,
      cH = len0 >= len1 ? H : W;
    var c = document.createElement('canvas');
    c.width = cW;
    c.height = cH;
    var ctx = c.getContext('2d');
    // 草底: TerrainTextures.grass() 以 1u≈tile 平铺, 与四周草地密度一致
    var tt = window.TerrainTextures,
      grass = tt ? tt.grass() : null;
    var m = makeMapper(W, len0, len1);
    if (grass) {
      var tile = Math.max(8, Math.round(m.scale)); // 1u → px
      for (var y = 0; y < cH; y += tile)
        for (var x = 0; x < cW; x += tile) ctx.drawImage(grass, x, y, tile, tile);
    } else {
      ctx.fillStyle = '#4A8C3F';
      ctx.fillRect(0, 0, cW, cH);
    }
    ctx.strokeStyle = '#f6f6f6';
    ctx.fillStyle = '#f6f6f6';
    ctx.lineWidth = LINE_W * m.scale;
    if (kind === 'football') _drawFootball(ctx, m);
    else _drawBasketball(ctx, m, kind === 'bb5' ? BB5 : BB3);
    var tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    window[key] = tex;
    return tex;
  }

  // 共享材质缓存(kind → material)
  var _courtMats = {};
  function _courtMat(kind, len0, len1) {
    if (_courtMats[kind]) return _courtMats[kind];
    _courtMats[kind] = new THREE.MeshStandardMaterial({
      map: _courtTex(kind, len0, len1),
      roughness: 0.95,
      polygonOffset: true,
      polygonOffsetFactor: -3, // 需盖过 campus-ground 草地(-2/-4): 球场 footprint 嵌在大草坪 polygon 内, 同 offset 会 z-fight
      polygonOffsetUnits: -6,
    });
    return _courtMats[kind];
  }

  // buildCourt 完整版: 标线纹理 + UV 重映射
  function buildCourt(g, targetScene) {
    var b = _basis(g);
    var kind = courtKind(g.name);
    var shape = _footprintToShape(g.footprint, true);
    var geo = new THREE.ShapeGeometry(shape);
    // UV 重映射: shape 空间点(x,-z) → footprint 局部 (u,v)/(len0,len1)
    var pos = geo.attributes.position;
    var uvArr = new Float32Array(pos.count * 2);
    for (var i = 0; i < pos.count; i++) {
      var wx = pos.getX(i),
        wz = -pos.getY(i); // shape y = -世界z
      var dx = wx - b.p0[0],
        dz = wz - b.p0[1];
      uvArr[i * 2] = (dx * b.u[0] + dz * b.u[1]) / b.len0;
      uvArr[i * 2 + 1] = (dx * b.v[0] + dz * b.v[1]) / b.len1;
    }
    geo.setAttribute('uv', new THREE.BufferAttribute(uvArr, 2));
    var mesh = new THREE.Mesh(geo, _courtMat(kind, b.len0, b.len1));
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = 0;
    mesh.receiveShadow = true;
    mesh.name = 'campus-court';
    targetScene.add(mesh);
    obstacleMeshes.push(mesh);
  }

  // ── 共享材质(模块级, 绝不 dispose) ──
  var _whiteM = new THREE.MeshStandardMaterial({ color: '#f8f8f8', roughness: 0.5 });
  var _netM = new THREE.MeshBasicMaterial({
    color: '#ffffff',
    transparent: true,
    opacity: 0.25,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  var _poleM = new THREE.MeshStandardMaterial({ color: '#5a6068', roughness: 0.4, metalness: 0.5 });
  var _boardM = null; // 篮板材质懒建(带纹理, T4)
  var _rimM = new THREE.MeshStandardMaterial({ color: '#e8641e', roughness: 0.35, metalness: 0.4 });

  // 篮板材质: 128px 白底红框纹理(懒建)
  function _getBoardMat() {
    if (_boardM) return _boardM;
    var c = document.createElement('canvas');
    c.width = 128;
    c.height = 96;
    var ctx = c.getContext('2d');
    ctx.fillStyle = '#f4f4f4';
    ctx.fillRect(0, 0, 128, 96);
    ctx.strokeStyle = '#d03028';
    ctx.lineWidth = 6;
    ctx.strokeRect(4, 4, 120, 88); // 外框
    ctx.strokeRect(48, 52, 32, 26); // 瞄准框(下沿贴筐)
    var tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    _boardM = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.4 });
    return _boardM;
  }

  // 场地局部(l,s) → 世界(x,z); (l,s) 与 makeMapper 同约定(l 沿长轴)
  function _localToWorld(b, l, s) {
    var longIsU = b.len0 >= b.len1;
    var u = longIsU ? l : s,
      v = longIsU ? s : l;
    return [b.p0[0] + b.u[0] * u + b.v[0] * v, b.p0[1] + b.u[1] * u + b.v[1] * v];
  }
  // 场地局部方向(dl,ds) → 世界 yaw(用于 rotation.y; 世界方向 dir=(dx,dz), yaw=-atan2(dz,dx) 使 Group 本地+X 指向 dir)
  function _yawOfDir(b, dl, ds) {
    var longIsU = b.len0 >= b.len1;
    var du = longIsU ? dl : ds,
      dv = longIsU ? ds : dl;
    var dx = b.u[0] * du + b.v[0] * dv,
      dz = b.u[1] * du + b.v[1] * dv;
    return -Math.atan2(dz, dx);
  }

  // 球门: 本地 +X=朝场内, 门柱沿 Z 各±1.155, 高1.54, 柱r0.05
  var GOAL = { w: 2.31, h: 1.54, r: 0.05, depth: 0.8 };
  function _createGoal() {
    var g = new THREE.Group();
    g.name = 'sf-goal';
    var poleGeo = new THREE.CylinderGeometry(GOAL.r, GOAL.r, GOAL.h, 8);
    var barGeo = new THREE.CylinderGeometry(GOAL.r, GOAL.r, GOAL.w, 8);
    var backGeo = new THREE.CylinderGeometry(GOAL.r * 0.7, GOAL.r * 0.7, GOAL.depth, 6);
    for (var side = -1; side <= 1; side += 2) {
      var pole = new THREE.Mesh(poleGeo, _whiteM);
      pole.name = 'campus-goal'; // campus- 前缀: engine 摧毁/清理循环凭此跳过共享材质 dispose
      pole.position.set(0, GOAL.h / 2, (side * GOAL.w) / 2);
      pole.castShadow = true;
      g.add(pole);
      var back = new THREE.Mesh(backGeo, _whiteM); // 后斜撑
      back.name = 'campus-goal';
      back.rotation.z = Math.PI / 2 - 0.5;
      back.position.set(-GOAL.depth / 2, GOAL.h / 3, (side * GOAL.w) / 2);
      g.add(back);
    }
    var bar = new THREE.Mesh(barGeo, _whiteM);
    bar.name = 'campus-goal';
    bar.rotation.x = Math.PI / 2;
    bar.position.set(0, GOAL.h, 0);
    bar.castShadow = true;
    g.add(bar);
    // 网: 背+两侧 3 片半透明
    var backNet = new THREE.Mesh(new THREE.PlaneGeometry(GOAL.w, GOAL.h), _netM);
    backNet.name = 'campus-goal';
    backNet.rotation.y = Math.PI / 2;
    backNet.position.set(-GOAL.depth, GOAL.h / 2, 0);
    g.add(backNet);
    for (var s2 = -1; s2 <= 1; s2 += 2) {
      var sideNet = new THREE.Mesh(new THREE.PlaneGeometry(GOAL.depth, GOAL.h), _netM);
      sideNet.name = 'campus-goal';
      sideNet.position.set(-GOAL.depth / 2, GOAL.h / 2, (s2 * GOAL.w) / 2);
      g.add(sideNet);
    }
    return g;
  }

  // 足球设备: 2 子场 × 2 端线球门
  function _buildFootballEquip(g, targetScene, b) {
    var m = makeMapper(1024, b.len0, b.len1);
    for (var i = 0; i < 2; i++) {
      var lc = (i * m.L) / 2 + m.L / 4; // 子场中心(长轴向)
      for (var e = 0; e < 2; e++) {
        var sEnd = e === 0 ? INSET : m.S - INSET;
        var inwardS = e === 0 ? 1 : -1; // 朝场内(s 方向)
        var w = _localToWorld(b, lc, sEnd);
        var goal = _createGoal();
        var gy = typeof getTerrainHeight === 'function' ? getTerrainHeight(w[0], w[1]) : 0;
        goal.position.set(w[0], gy, w[1]);
        goal.rotation.y = _yawOfDir(b, 0, inwardS); // 本地+X → 场内
        targetScene.add(goal);
        obstacleMeshes.push(goal);
        // 双柱碰撞: 柱世界位置 = 端线中点 ± 门半宽(沿端线方向 = l 方向)
        for (var side = -1; side <= 1; side += 2) {
          var pw = _localToWorld(b, lc + (side * GOAL.w) / 2, sEnd);
          obstacleData.push({
            x: pw[0],
            z: pw[1],
            radius: 0.15,
            height: GOAL.h,
            type: 'building',
            groupRef: goal,
            color: '#f8f8f8',
          });
        }
      }
    }
  }

  // 篮球架: 本地 +X=朝场内; 立柱在原点, 悬臂前探至筐点
  // rimH: 筐面高(大2.35/小2.0); hoopD: 筐点距端线; 柱距端线外 0.6 → 悬臂 = hoopD+0.6
  function _createHoop(rimH) {
    var g = new THREE.Group();
    g.name = 'sf-hoop';
    var poleH = rimH + HOOP.boardH * 0.6;
    var base = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.15, 0.6), _poleM);
    base.name = 'campus-hoop'; // campus- 前缀: engine 摧毁/清理循环凭此跳过共享材质 dispose
    base.position.y = 0.075;
    g.add(base);
    var pole = new THREE.Mesh(new THREE.CylinderGeometry(HOOP.poleR, HOOP.poleR, poleH, 8), _poleM);
    pole.name = 'campus-hoop';
    pole.position.y = poleH / 2;
    pole.castShadow = true;
    g.add(pole);
    return g; // 悬臂/板/筐由 _finishHoop 按 armLen 加(依赖场地 hoopD)
  }
  function _finishHoop(g, rimH, armLen) {
    var armY = rimH + HOOP.boardH * 0.45;
    var arm = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, armLen, 6), _poleM);
    arm.name = 'campus-hoop';
    arm.rotation.z = Math.PI / 2;
    arm.position.set(armLen / 2, armY, 0);
    g.add(arm);
    var board = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, HOOP.boardH, HOOP.boardW),
      _getBoardMat()
    );
    board.name = 'campus-hoop';
    board.position.set(armLen, rimH + HOOP.boardH / 2, 0);
    board.castShadow = true;
    g.add(board);
    var rim = new THREE.Mesh(new THREE.TorusGeometry(HOOP.rimR, 0.02, 8, 20), _rimM);
    rim.name = 'campus-hoop';
    rim.rotation.x = Math.PI / 2;
    rim.position.set(armLen + 0.05 + HOOP.rimR, rimH, 0);
    g.add(rim);
  }

  function _buildBasketballEquip(g, targetScene, b, P, rimH) {
    var m = makeMapper(1024, b.len0, b.len1);
    // 悬臂长: 使筐圆心(柱 + armLen + 0.05 + rimR)恰落在端线内 hoopD 处, 与标线三分弧圆心对齐
    var armLen = P.hoopD + HOOP.setback - (0.05 + HOOP.rimR);
    for (var e = 0; e < 2; e++) {
      var lEnd = e === 0 ? INSET : m.L - INSET;
      var inwardL = e === 0 ? 1 : -1;
      var w = _localToWorld(b, lEnd - inwardL * HOOP.setback, m.S / 2); // 柱: 端线外 0.6
      var hoop = _createHoop(rimH);
      _finishHoop(hoop, rimH, armLen);
      var gy = typeof getTerrainHeight === 'function' ? getTerrainHeight(w[0], w[1]) : 0;
      hoop.position.set(w[0], gy, w[1]);
      hoop.rotation.y = _yawOfDir(b, inwardL, 0); // 本地+X → 场内(l 方向)
      targetScene.add(hoop);
      obstacleMeshes.push(hoop);
      obstacleData.push({
        x: w[0],
        z: w[1],
        radius: 0.2,
        height: rimH + 0.5,
        type: 'building',
        groupRef: hoop,
        color: '#5a6068',
      });
    }
  }

  function buildEquipment(g, targetScene) {
    var kind = courtKind(g.name);
    var b = _basis(g);
    if (kind === 'football') _buildFootballEquip(g, targetScene, b);
    else if (kind === 'bb5') _buildBasketballEquip(g, targetScene, b, BB5, 2.35);
    else if (kind === 'bb3') _buildBasketballEquip(g, targetScene, b, BB3, 2.0);
  }

  // ── 从 soccerFields 标记数据生成足球子场 ──
  // 使用与标记工具逐字相同的 zoneCorners 旋转公式, 绕过 rotation.y 右手定则差异
  function _zoneCorners(sf) {
    var cr = Math.cos(sf.ry),
      sr = Math.sin(sf.ry);
    var hw = sf.w / 2,
      hd = sf.d / 2;
    return [
      [sf.cx + -hw * cr - -hd * sr, sf.cz + -hw * sr + -hd * cr],
      [sf.cx + -hw * cr - +hd * sr, sf.cz + -hw * sr + +hd * cr],
      [sf.cx + +hw * cr - +hd * sr, sf.cz + +hw * sr + +hd * cr],
      [sf.cx + +hw * cr - -hd * sr, sf.cz + +hw * sr + -hd * cr],
    ];
  }

  function _drawSoccerSub(ctx, m) {
    // 单子场: 球门在L端(短边中点=l=0或L处s=S/2) / 中线横穿L / 中圈中心 / 禁区L端
    _rect(ctx, m, INSET, INSET, m.L - INSET, m.S - INSET);
    _line(ctx, m, m.L / 2, INSET, m.L / 2, m.S - INSET);
    _circle(ctx, m, m.L / 2, m.S / 2, FB.circle);
    for (var e = 0; e < 2; e++) {
      var lEnd = e === 0 ? INSET : m.L - INSET;
      var dir = e === 0 ? 1 : -1;
      _rect(ctx, m, lEnd, m.S / 2 - FB.boxW / 2, lEnd + dir * FB.boxD, m.S / 2 + FB.boxW / 2);
      _circle(ctx, m, lEnd + dir * FB.penalty, m.S / 2, 0.1, true);
    }
  }

  function _texSoccerSub(len0, len1) {
    var W = 1024,
      H = Math.max(64, Math.round((1024 * Math.min(len0, len1)) / Math.max(len0, len1)));
    var cW = len0 >= len1 ? W : H,
      cH = len0 >= len1 ? H : W;
    var c = document.createElement('canvas');
    c.width = cW;
    c.height = cH;
    var ctx = c.getContext('2d');
    var tt = window.TerrainTextures,
      grass = tt ? tt.grass() : null;
    var m = makeMapper(W, len0, len1);
    if (grass) {
      var tile = Math.max(8, Math.round(m.scale));
      for (var y = 0; y < cH; y += tile)
        for (var x = 0; x < cW; x += tile) ctx.drawImage(grass, x, y, tile, tile);
    } else {
      ctx.fillStyle = '#4A8C3F';
      ctx.fillRect(0, 0, cW, cH);
    }
    ctx.strokeStyle = '#f6f6f6';
    ctx.fillStyle = '#f6f6f6';
    ctx.lineWidth = LINE_W * m.scale;
    _drawSoccerSub(ctx, m);
    var tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  }

  function createSoccerFields(targetScene) {
    var sfCfg = currentMapData && currentMapData.obstacles && currentMapData.obstacles.soccerFields;
    if (!sfCfg || !sfCfg.length) return;
    for (var si = 0; si < sfCfg.length; si++) {
      var sf = sfCfg[si];
      var fp = _zoneCorners(sf);
      var g = {
        footprint: [fp[0], fp[1], fp[2], fp[3], [fp[0][0], fp[0][1]]],
        name: 'soccer',
        kind: 'pitch',
      };
      var b = _basis(g);
      var shape = _footprintToShape(g.footprint, true);
      var geo = new THREE.ShapeGeometry(shape);
      var pos = geo.attributes.position;
      var uvArr = new Float32Array(pos.count * 2);
      for (var i = 0; i < pos.count; i++) {
        var wx = pos.getX(i),
          wz = -pos.getY(i);
        var dx = wx - b.p0[0],
          dz = wz - b.p0[1];
        uvArr[i * 2] = (dx * b.u[0] + dz * b.u[1]) / b.len0;
        uvArr[i * 2 + 1] = (dx * b.v[0] + dz * b.v[1]) / b.len1;
      }
      geo.setAttribute('uv', new THREE.BufferAttribute(uvArr, 2));
      var mat = new THREE.MeshStandardMaterial({
        map: _texSoccerSub(b.len0, b.len1),
        roughness: 0.95,
        polygonOffset: true,
        polygonOffsetFactor: -3,
        polygonOffsetUnits: -6,
      });
      var mesh = new THREE.Mesh(geo, mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.y = 0;
      mesh.receiveShadow = true;
      mesh.name = 'campus-court';
      targetScene.add(mesh);
      obstacleMeshes.push(mesh);

      // 2球门在短轴(S)两端中点, 面朝S方向(场中心)
      // _localToWorld(l,s): l沿L=长轴=w方向, s沿S=短轴=d方向
      // 短边中点=(l=0或L, s=S/2)即w端+d中心=d边中点 ✓
      // (L/2, sEnd)是w中点+d端=w边中点=长边中点 ✗
      var m2 = makeMapper(1024, b.len0, b.len1);
      for (var e = 0; e < 2; e++) {
        var lEnd = e === 0 ? 0 : m2.L; // L方向两端: 0或L
        var inwardS = e === 0 ? -1 : 1;
        var w = _localToWorld(b, lEnd, m2.S / 2); // 短边中点!
        var goal = _createGoal();
        var gy = typeof getTerrainHeight === 'function' ? getTerrainHeight(w[0], w[1]) : 0;
        goal.position.set(w[0], gy, w[1]);
        goal.rotation.y = _yawOfDir(b, 0, inwardS) - Math.PI / 2; // 绕自身中点顺时针转90°
        targetScene.add(goal);
        obstacleMeshes.push(goal);
        for (var side = -1; side <= 1; side += 2) {
          var pw = _localToWorld(b, lEnd, m2.S / 2 + (side * GOAL.w) / 2); // 柱沿S排列
          obstacleData.push({
            x: pw[0],
            z: pw[1],
            radius: 0.15,
            height: GOAL.h,
            type: 'building',
            groupRef: goal,
            color: '#f8f8f8',
          });
        }
      }
    }
  }

  window.SportsFields = {
    hasCourt: function (name) {
      return courtKind(name) !== null;
    },
    buildCourt: buildCourt,
    buildEquipment: buildEquipment,
    createSoccerFields: createSoccerFields,
    _basis: _basis,
    _courtKind: courtKind,
  };
})();
