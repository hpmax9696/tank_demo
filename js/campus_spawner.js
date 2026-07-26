// js/campus_spawner.js
// 校园丧尸定时门刷新系统 —— 读 currentMapData.spawnConfig，进图初始生成 + 定时从门补充
// IIFE + window.CampusSpawner，无状态对外：init / initialPopulate / update / isActive
(function () {
  let _cfg = null; // spawnConfig
  let _doors = []; // [[x,z], ...] 门位置（建筑边中点）
  let _timer = 0; // 刷新计时器(秒)
  let _seedCnt = 2000; // seed 计数(保证每只唯一)
  let _active = false;

  // ── 几何工具 ──
  // 射线法点在多边形内
  function _pointInPolygon(pt, poly) {
    if (!poly || poly.length < 3) return false;
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i][0],
        yi = poly[i][1],
        xj = poly[j][0],
        yj = poly[j][1];
      if (yi > pt[1] !== yj > pt[1] && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi)
        inside = !inside;
    }
    return inside;
  }

  // 点是否可达(避开建筑 footprint 内; 若有 boundary 须在 boundary 内)
  function _isReachable(x, z, currentMapData) {
    const obs = currentMapData.obstacles || {};
    const blds = obs.footprintBuildings || [];
    for (const b of blds) {
      if (b.footprint && _pointInPolygon([x, z], b.footprint)) return false;
    }
    const boundary = obs.boundary;
    if (boundary && boundary.length >= 3 && !_pointInPolygon([x, z], boundary)) return false;
    return true;
  }

  // 随机可达点(最多尝试 40 次)
  function _reachablePoint(currentMapData, halfW, halfD) {
    for (let i = 0; i < 40; i++) {
      const x = (Math.random() * 2 - 1) * halfW * 0.85;
      const z = (Math.random() * 2 - 1) * halfD * 0.85;
      if (_isReachable(x, z, currentMapData)) return [x, z];
    }
    return [0, 0]; // 兜底中心
  }

  // 从 footprintBuildings.edgeMarks(type=corridor) 提取门位置(边中点)
  // edgeMarks: [{ei, type}]，ei = footprint 点索引，边 ei = fp[ei]→fp[ei+1]
  function _extractDoors(currentMapData) {
    const doors = [];
    const blds = (currentMapData.obstacles && currentMapData.obstacles.footprintBuildings) || [];
    for (const b of blds) {
      const fp = b.footprint;
      const marks = b.edgeMarks || [];
      for (const m of marks) {
        if (m.type !== 'corridor') continue;
        const ei = m.ei;
        if (ei == null || !fp || !fp[ei]) continue;
        const a = fp[ei];
        const c = fp[(ei + 1) % fp.length];
        doors.push([(a[0] + c[0]) / 2, (a[1] + c[1]) / 2]);
      }
    }
    return doors;
  }

  // 按 ratio 权重抽变体
  function _pickVariant(ratio) {
    const entries = Object.entries(ratio || {});
    if (!entries.length) return 'student_m';
    const total = entries.reduce((s, [, v]) => s + v, 0);
    let r = Math.random() * total;
    for (const [k, v] of entries) {
      r -= v;
      if (r <= 0) return k;
    }
    return entries[entries.length - 1][0];
  }

  // 变体默认 cfg(师生两层强度)
  const VARIANT_CFG = {
    student_m: {
      hp: 40,
      speed: 2.0,
      viewDist: 25,
      attackDamage: 8,
      attackCooldown: 1.5,
      dropRate: 0.25,
      dropHeal: 30,
      score: 50,
    },
    student_f: {
      hp: 40,
      speed: 2.0,
      viewDist: 25,
      attackDamage: 8,
      attackCooldown: 1.5,
      dropRate: 0.25,
      dropHeal: 30,
      score: 50,
    },
    teacher_m: {
      hp: 120,
      speed: 1.0,
      viewDist: 40,
      attackDamage: 20,
      attackCooldown: 2.5,
      dropRate: 0.25,
      dropHeal: 30,
      score: 200,
    },
    teacher_f: {
      hp: 120,
      speed: 1.0,
      viewDist: 40,
      attackDamage: 20,
      attackCooldown: 2.5,
      dropRate: 0.25,
      dropHeal: 30,
      score: 200,
    },
  };

  // 生成一只丧尸并注册到 enemies + scene
  function _spawnEnemy(variant, x, z, enemies, scene, getGroundHeight) {
    const isTeacher = variant.indexOf('teacher') === 0;
    const hRange = isTeacher ? [1.55, 1.75] : [1.1, 1.5];
    const heightM = hRange[0] + Math.random() * (hRange[1] - hRange[0]);
    const model = window.EnemyModels.createCampusZombie({ variant, heightM, seed: _seedCnt++ });
    const gy = typeof getGroundHeight === 'function' ? getGroundHeight(x, z) : 0;
    model.position.set(x, gy, z);
    model.rotation.set(0, Math.random() * Math.PI * 2, 0);
    // cfg + hp + userData + ai(对齐 createEnemies 的丧尸初始化)
    const baseCfg = VARIANT_CFG[variant] || VARIANT_CFG.student_m;
    model.cfg = Object.assign({ reactive: true, aggressive: false }, baseCfg);
    model.hp = baseCfg.hp;
    model.userData = model.userData || {};
    model.userData.maxHp = model.hp;
    model.userData.enemyType = 'zombie'; // 走丧尸 8 状态机
    model.userData.variant = variant;
    model.userData._noTerrainPitch = true; // 人形直立
    model.ai = {
      state: 'idle',
      target: null,
      patrolIndex: 0,
      lastSeenPlayerPos: null,
      animRequest: 'idle',
      attackCooldown: 0,
    };
    enemies.push(model);
    if (scene) scene.add(model);
    return model;
  }

  // ── 对外 API ──

  // 初始化(读 spawnConfig + 提取门)。返回是否激活。
  function init(currentMapData) {
    const cfg = currentMapData && currentMapData.spawnConfig;
    if (!cfg || !cfg.enabled) {
      _active = false;
      return false;
    }
    _cfg = cfg;
    _doors = cfg.doors && cfg.doors.length ? cfg.doors : _extractDoors(currentMapData);
    _timer = 0;
    _active = true;
    console.log(
      '🧟 campus_spawner 启用 | 初始',
      cfg.initialCount,
      '每',
      cfg.interval + 's刷',
      cfg.batch,
      '上限',
      cfg.cap,
      '门',
      _doors.length
    );
    return true;
  }

  // 进图初始游荡(initialCount 只, 按比例随机可达点)
  function initialPopulate(currentMapData, enemies, scene, getGroundHeight, halfW, halfD) {
    if (!_active || !_cfg) return;
    const halfWv = halfW != null ? halfW : 80;
    const halfDv = halfD != null ? halfD : 60;
    for (let i = 0; i < (_cfg.initialCount || 0); i++) {
      const v = _pickVariant(_cfg.ratio);
      const p = _reachablePoint(currentMapData, halfWv, halfDv);
      _spawnEnemy(v, p[0], p[1], enemies, scene, getGroundHeight);
    }
  }

  // 每帧调用: 计时到 interval 且低于 cap 时从随机门刷 batch 只
  function update(dt, currentMapData, enemies, scene, getGroundHeight) {
    if (!_active || !_cfg) return;
    _timer += dt;
    if (_timer < (_cfg.interval || 20)) return;
    _timer = 0;
    const alive = enemies.filter(function (e) {
      return e && !(e.userData && e.userData._dead);
    });
    if (alive.length >= (_cfg.cap || 30)) return;
    if (!_doors.length) return;
    const batch = Math.max(0, Math.min(_cfg.batch || 6, (_cfg.cap || 30) - alive.length));
    for (let i = 0; i < batch; i++) {
      const v = _pickVariant(_cfg.ratio);
      const door = _doors[Math.floor(Math.random() * _doors.length)];
      const x = door[0] + (Math.random() - 0.5) * 2.5;
      const z = door[1] + (Math.random() - 0.5) * 2.5;
      _spawnEnemy(v, x, z, enemies, scene, getGroundHeight);
    }
    console.log('🧟 campus_spawner 刷新', batch, '| 当前总数', enemies.length);
  }

  function isActive() {
    return _active;
  }

  window.CampusSpawner = { init, initialPopulate, update, isActive };
  console.log('🧟 campus_spawner 模块就绪');
})();
