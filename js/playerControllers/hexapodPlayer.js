/**
 * HexapodPlayerController — 六足玩家控制器 v0.2
 *
 * 第一个基于 PlayerControllerManager 的可插拔玩家角色。用 WASD+鼠标操控六足,
 * 用于训练场精确测量 bodyWriter=false 模式的步态姿态。
 *
 * 复用 HexapodEnemy.init/update 的全部 CCD IK 步态管线 — 与游戏敌人同路径,
 * 保证步态可对比。仅 ai 字段改由玩家输入填充 (而非 EnemyAI)。
 *
 * 操控:
 *   W/S 前进/后退 (animIndex 1/3, 走步态; 满力度→跑)
 *   A/D 左右平移 (animIndex 5/6)
 *   鼠标左右 → 六足朝向 (cameraYaw步进转向, 身体慢追)
 *   鼠标上下 → 加特林俯仰 (engine真实raycast命中点→反算俯仰, 下俯/上仰, -40°俯~+60°仰)
 *   鼠标左键 → 左加特林射击
 *   鼠标右键 → 右加特林射击
 *   加特林双瞄准线 (绿色射程内/红色射程外/过热全红)
 *   过热警报 (按键时头顶闪现"过热"字样+卡壳音)
 */
var HexapodPlayerController = (function () {
  'use strict';

  var WALK_SPEED = 2.5; // 走速 (手柄低力度 <0.7)
  var RUN_SPEED = 5.0; // 跑速 (键盘满力度 / 手柄高力度 ≥0.7)

  function create(spawnCtx) {
    // spawnCtx: { scene, getGroundHeight, position:{x,z}, yaw }

    var _root = null; // 六足根 Object3D
    var _ai = null; // 喂给 HexapodEnemy.update 的 ai 对象
    var _ctx = null; // CCD IK context (HexapodEnemy.init 返回)
    var _aiDriven = false; // AI托管标志 (经 spawnCtx 传入)
    var _enemyCfg = null; // AI托管时的敌人cfg (复用 updateHexapodEngage)

    var _pos = { x: spawnCtx.position.x, z: spawnCtx.position.z };
    var _yaw = spawnCtx.yaw;
    var _gh = spawnCtx.getGroundHeight;
    var _scene = spawnCtx.scene;
    var _p1 = spawnCtx.player1 || null; // player1 引用 (engine.js 经 spawnCtx 传入, 非 window)
    // 加特林俯仰 (追踪光标指向的世界目标, engine.js 真实 raycast 提供 aimTarget)
    var GATLING_PITCH_MIN = -0.7; // -40° 俯角
    var GATLING_PITCH_MAX = 1.05; // +60° 仰角
    var GATLING_RANGE = 35; // 加特林子弹最大射程
    var _gatlingPitchTarget = 0; // 目标俯仰 (从世界目标反算)
    var _gatlingPitch = 0; // 当前俯仰 (平滑跟随)
    var _tmpQuat = new THREE.Quaternion();
    var _tmpVec3 = new THREE.Vector3();
    var _Z_AXIS = new THREE.Vector3(0, 0, 1); // pivot 俯仰轴 (枪管沿-X, 绕Z=上下俯仰)
    // 加特林射击状态
    var _playerBullets = [];
    var _playerMuzzleLights = [];
    var _playerMuzzleFlashes = []; // 枪口焰粒子
    var _barrelMatsL = [];
    var _barrelMatsR = [];
    var _tmpColor = new THREE.Color();
    var _overheatSprite = null;
    var _spriteTimer = 0;
    var _jamLockL = false;
    var _jamLockR = false;
    var COOL_COLOR = new THREE.Color(0x5a5a64);
    var HOT_COLOR = new THREE.Color(0xff4400);
    var _rc = new THREE.Raycaster(); // 子弹障碍物碰撞 (与瞄准线同方式)
    // 导弹系统
    var _missileAmmoL = 4,
      _missileAmmoR = 4;
    var _nextMissileSide = 'L';
    var _reloadTimerL = 0,
      _reloadTimerR = 0;
    var _lockState = 'idle'; // 'idle' | 'locking' | 'locked'
    var _lockTarget = null;
    var _lockProgress = 0;
    var _lockCircle = null;
    var _playerMissiles = [];
    var _playerMissileExplosions = [];
    var _reloadBarL = null,
      _reloadBarR = null; // 3D装填条
    var _alertSprite = null; // 警报文字 (超出距离/装填中)
    var _obsMesh = null; // 观瞄球体 (HP发光)
    var LOCK_TIME = 1.0;
    var LOCK_CIRCLE_START = 5.0;
    var RELOAD_TIME = 10.0;
    var LOCK_BOX_W = 300,
      LOCK_BOX_H = 200;
    var LOCK_MAX_RANGE = 50; // 最大锁定距离(m), 超出无法锁定
    // 加特林状态机常量 (对齐 enemyAI)
    var FIRE_RATE = 10;
    var SPIN_UP_TIME = 0.8;
    var HEAT_PER_SEC = 25;
    var COOL_PER_SEC = 18;
    var FORCED_COOL_PER_SEC = 28;
    var OVERHEAT_THRESHOLD = 80;
    var OVERHEAT_MAX = 100;
    var SPIN_DECAY = 2;
    var FORCED_DECAY = 3;

    function _clampToWorld(x, z) {
      var p1 = window.player1;
      var HW = typeof window.playHalfW !== 'undefined' ? window.playHalfW : 100;
      var HD = typeof window.playHalfD !== 'undefined' ? window.playHalfD : 100;
      var margin = 2.0; // 留腿空间
      x = Math.max(-HW + margin, Math.min(HW - margin, x));
      z = Math.max(-HD + margin, Math.min(HD - margin, z));
      return { x: x, z: z };
    }

    function _removeBullet(idx) {
      var pb = _playerBullets[idx];
      if (pb && pb.mesh) {
        _scene.remove(pb.mesh);
        pb.mesh.geometry.dispose();
        pb.mesh.material.dispose();
      }
      _playerBullets.splice(idx, 1);
    }

    // 找锁定框内最近的敌人 (屏幕投影)
    function _findBestLockTarget(camera, mx, my) {
      if (!window.enemies || !camera) return null;
      var best = null,
        bestDist = Infinity;
      var cw = window.innerWidth,
        ch = window.innerHeight;
      var bx = mx - LOCK_BOX_W / 2,
        by = my - LOCK_BOX_H / 2;
      for (var ei = 0; ei < window.enemies.length; ei++) {
        var en = window.enemies[ei];
        if (!en || en.dead || (en.ai && en.ai.state === 'dead')) continue;
        var ePos = en.position;
        if (!ePos) continue;
        var ndc = new THREE.Vector3(ePos.x, ePos.y + 1.0, ePos.z).project(camera);
        var sx = (ndc.x * 0.5 + 0.5) * cw;
        var sy = (-ndc.y * 0.5 + 0.5) * ch;
        if (sx >= bx && sx <= bx + LOCK_BOX_W && sy >= by && sy <= by + LOCK_BOX_H) {
          var d = Math.abs(sx - mx) + Math.abs(sy - my);
          if (d < bestDist) {
            bestDist = d;
            best = en;
          }
        }
      }
      return best;
    }

    // 获取/创建锁定圈 (3D LineLoop)
    function _getLockCircle() {
      if (!_lockCircle) {
        var pts = [];
        for (var i = 0; i <= 64; i++) {
          var a = (i / 64) * Math.PI * 2;
          pts.push(new THREE.Vector3(Math.cos(a), 0, Math.sin(a)));
        }
        _lockCircle = new THREE.LineLoop(
          new THREE.BufferGeometry().setFromPoints(pts),
          new THREE.LineBasicMaterial({ color: 0x00ff00, depthTest: false, transparent: true })
        );
        _lockCircle.visible = false;
        _scene.add(_lockCircle);
      }
      return _lockCircle;
    }

    function _spawnPlayerMissile(target) {
      // 决定从哪侧发射, 跳过装填中的巢
      var side = _nextMissileSide;
      if (side === 'L' && _missileAmmoL <= 0) side = 'R';
      if (side === 'R' && _missileAmmoR <= 0) side = 'L';
      if ((side === 'L' && _missileAmmoL <= 0) || (side === 'R' && _missileAmmoR <= 0)) return; // 双空
      // 扣除弹药
      if (side === 'L') _missileAmmoL--;
      else _missileAmmoR--;
      _nextMissileSide = side === 'L' ? 'R' : 'L';
      // 弹药归零 → 启动装填
      if (_missileAmmoL <= 0 && _reloadTimerL <= 0) _reloadTimerL = RELOAD_TIME;
      if (_missileAmmoR <= 0 && _reloadTimerR <= 0) _reloadTimerR = RELOAD_TIME;
      // 获取导弹巢 pivot
      var pvName = side === 'L' ? '左导弹巢_pivot' : '右导弹巢_pivot';
      var pv = _root.getObjectByName(pvName);
      if (!pv) return;
      var pivWorld = new THREE.Vector3();
      pv.getWorldPosition(pivWorld);
      var pivFwd = new THREE.Vector3(-1, 0.6, 0);
      pv.localToWorld(pivFwd);
      var launchDir = pivFwd.clone().sub(pivWorld).normalize();
      var muzzlePos = pivWorld.clone().addScaledVector(launchDir, 0.5);
      // 导弹模型 (复用 enemy 导弹样式)
      var grp = new THREE.Group();
      var bm = new THREE.MeshStandardMaterial({
        color: '#889999',
        roughness: 0.3,
        metalness: 0.7,
        emissive: '#111111',
      });
      var body = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.4, 6), bm);
      body.rotation.x = Math.PI / 2;
      grp.add(body);
      var tip = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.12, 6), bm);
      tip.rotation.x = -Math.PI / 2;
      tip.position.z = 0.26;
      grp.add(tip);
      var flame = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.07, 0.3, 6),
        new THREE.MeshBasicMaterial({ color: '#ff6600' })
      );
      flame.rotation.x = Math.PI / 2;
      flame.position.z = -0.35;
      grp.add(flame);
      var fl = new THREE.PointLight('#ff4400', 3, 2, 2);
      fl.position.z = -0.4;
      grp.add(fl);
      grp.position.copy(muzzlePos);
      _scene.add(grp);
      _playerMissiles.push({
        mesh: grp,
        pos: muzzlePos.clone(),
        dir: launchDir.clone(),
        speed: 20,
        damage: 25,
        blastRadius: 1.5,
        age: 0,
        tracking: false,
        maxTurnRate: 1.2,
        target: target,
        lastTargetPos: target.position.clone(),
      });
      if (typeof playMissileLaunchSound === 'function') playMissileLaunchSound();
    }

    function _updatePlayerMissiles(dt) {
      for (var mi = _playerMissiles.length - 1; mi >= 0; mi--) {
        var m = _playerMissiles[mi];
        m.age += dt;
        if (m.age > 0.25) m.tracking = true;
        // 追踪目标: 活着→追目标; 死了→追最后已知位置(撞地)
        if (m.target && m.target.position) {
          if (!m.target.dead) m.lastTargetPos.copy(m.target.position);
        }
        if (m.tracking && m.lastTargetPos) {
          var toTarget = new THREE.Vector3().subVectors(m.lastTargetPos, m.pos).normalize();
          var angle = Math.acos(Math.min(1, Math.max(-1, m.dir.dot(toTarget))));
          var maxTurn = m.maxTurnRate * dt;
          if (angle > 0.01) {
            var turnAmount = Math.min(angle, maxTurn);
            var rotAxis = new THREE.Vector3().crossVectors(m.dir, toTarget).normalize();
            if (rotAxis.length() > 0.001) {
              m.dir
                .applyQuaternion(new THREE.Quaternion().setFromAxisAngle(rotAxis, turnAmount))
                .normalize();
            } else {
              m.dir.copy(toTarget);
            }
          }
        }
        m.pos.addScaledVector(m.dir, m.speed * dt);
        m.mesh.position.copy(m.pos);
        var mq = new THREE.Quaternion();
        mq.setFromUnitVectors(new THREE.Vector3(0, 0, 1), m.dir);
        m.mesh.setRotationFromQuaternion(mq);
        if (m.mesh.userData._flameLight) m.mesh.userData._flameLight.intensity = 2 + Math.random();
        // 命中目标
        var hit = false;
        if (m.target && !m.target.dead && m.target.position) {
          if (m.pos.distanceTo(m.target.position) < m.blastRadius) {
            hit = true;
            if (window.EnemyAI && window.EnemyAI.onEnemyDamaged) {
              var killed = window.EnemyAI.onEnemyDamaged(m.target, m.damage, _p1, false);
              if (killed) {
                m.target.dead = true;
                if (m.target.group) m.target.group.visible = false;
                else m.target.visible = false;
                var ep = m.target.position.clone();
                ep.y += 0.5;
                if (typeof spawnExplosion === 'function') spawnExplosion(ep);
                if (typeof spawnFragments === 'function') spawnFragments(ep, '#8b7d4a');
              }
            }
          }
        }
        var gh = _gh(m.pos.x, m.pos.z);
        if (hit || m.age > 8.0 || m.pos.y < gh + 0.3) {
          // 爆炸效果
          if (typeof playHeExplosionSound === 'function') playHeExplosionSound();
          var el = new THREE.PointLight('#ff8822', 15, m.blastRadius * 3, 2);
          el.position.copy(m.pos);
          el.position.y += 0.5;
          _scene.add(el);
          _playerMuzzleLights.push({ light: el, life: 0.3 });
          var es = new THREE.Mesh(
            new THREE.SphereGeometry(m.blastRadius * 0.5, 8, 6),
            new THREE.MeshBasicMaterial({ color: '#ff6622', transparent: true, opacity: 0.8 })
          );
          es.position.copy(m.pos);
          es.position.y += 1.0;
          _scene.add(es);
          _playerMissileExplosions.push({ mesh: es, life: 0.5 });
          _scene.remove(m.mesh);
          m.mesh.traverse(function (c) {
            if (c.geometry) c.geometry.dispose();
            if (c.material) c.material.dispose();
          });
          _playerMissiles.splice(mi, 1);
        }
      }
      // 爆炸球衰减
      for (var ei = _playerMissileExplosions.length - 1; ei >= 0; ei--) {
        var he = _playerMissileExplosions[ei];
        he.life -= dt;
        he.mesh.scale.multiplyScalar(1 + dt * 5);
        he.mesh.material.opacity = Math.max(0, he.life / 0.5);
        if (he.life <= 0) {
          _scene.remove(he.mesh);
          he.mesh.geometry.dispose();
          he.mesh.material.dispose();
          _playerMissileExplosions.splice(ei, 1);
        }
      }
    }

    // 创建 3D 装填条 (仿 bars.js 坦克装填条)
    // 创建/更新警报文字 Sprite
    function _showAlert(text) {
      if (!_alertSprite) {
        var cv = document.createElement('canvas');
        cv.width = 256;
        cv.height = 64;
        _alertSprite = new THREE.Sprite(
          new THREE.SpriteMaterial({
            map: new THREE.CanvasTexture(cv),
            transparent: true,
            depthTest: false,
          })
        );
        _alertSprite.scale.set(2.5, 0.625, 1);
        _alertSprite.visible = false;
        _scene.add(_alertSprite);
      }
      var cv = _alertSprite.material.map.image;
      var ctx = cv.getContext('2d');
      ctx.clearRect(0, 0, cv.width, cv.height);
      ctx.fillStyle = '#ff3333';
      ctx.font = 'bold 28px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(text, 128, 42);
      _alertSprite.material.map.needsUpdate = true;
      _alertSprite.visible = true;
      _alertSprite.position.set(_root.position.x, _root.position.y + 3.0, _root.position.z);
    }

    function _create3DReloadBars() {
      var bo = 1.5; // 偏移距离
      var bgGeo = new THREE.PlaneGeometry(0.14, 0.55);
      var bgMat = new THREE.MeshBasicMaterial({
        color: '#333',
        side: THREE.DoubleSide,
        depthTest: false,
        depthWrite: false,
        transparent: true,
        opacity: 0.8,
      });
      // 左装填条
      _reloadBarL = new THREE.Group();
      var lbBg = new THREE.Mesh(bgGeo, bgMat);
      lbBg.renderOrder = 999;
      _reloadBarL.add(lbBg);
      var lFillGeo = new THREE.PlaneGeometry(0.1, 0.49);
      var lFill = new THREE.Mesh(
        lFillGeo,
        new THREE.MeshBasicMaterial({
          color: '#44ff44',
          side: THREE.DoubleSide,
          depthTest: false,
          depthWrite: false,
          transparent: true,
          opacity: 1,
        })
      );
      lFill.renderOrder = 1000;
      lFill.position.z = 0.001;
      _reloadBarL.add(lFill);
      _reloadBarL.userData = { fill: lFill };
      _reloadBarL.visible = false;
      _scene.add(_reloadBarL);
      // 右装填条
      _reloadBarR = new THREE.Group();
      var rbBg = new THREE.Mesh(bgGeo, bgMat);
      rbBg.renderOrder = 999;
      _reloadBarR.add(rbBg);
      var rFill = new THREE.Mesh(
        lFillGeo.clone(),
        new THREE.MeshBasicMaterial({
          color: '#44ff44',
          side: THREE.DoubleSide,
          depthTest: false,
          depthWrite: false,
          transparent: true,
          opacity: 1,
        })
      );
      rFill.renderOrder = 1000;
      rFill.position.z = 0.001;
      _reloadBarR.add(rFill);
      _reloadBarR.userData = { fill: rFill };
      _reloadBarR.visible = false;
      _scene.add(_reloadBarR);
    }

    function _spawnPlayerGatlingBullet(side) {
      var pvName = side === 'left' ? '左加特林_pivot' : '右加特林_pivot';
      var pv = _root.getObjectByName(pvName);
      if (!pv) return;
      var pivWorld = new THREE.Vector3();
      pv.getWorldPosition(pivWorld);
      var pivFwd = new THREE.Vector3(-1, 0, 0);
      pv.localToWorld(pivFwd);
      var dir = pivFwd.sub(pivWorld).normalize();
      var muzzlePos = pivWorld.clone().addScaledVector(dir, 0.75);
      // 散布
      var spread = 0.03;
      dir.x += (Math.random() - 0.5) * spread;
      dir.y += (Math.random() - 0.5) * spread;
      dir.z += (Math.random() - 0.5) * spread;
      dir.normalize();
      // 示踪弹
      var tracerGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.5, 4);
      var tracerMat = new THREE.MeshBasicMaterial({ color: 0xffdd44 });
      var tracer = new THREE.Mesh(tracerGeo, tracerMat);
      tracer.position.copy(muzzlePos);
      var tq = new THREE.Quaternion();
      tq.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      tracer.setRotationFromQuaternion(tq);
      _scene.add(tracer);
      // 枪口闪光
      var flash = new THREE.PointLight('#ffcc44', 8, 4, 2);
      flash.position.copy(muzzlePos);
      _scene.add(flash);
      _playerMuzzleLights.push({ light: flash, life: 0.08 });
      // 枪口焰粒子 (3~5个亮黄小球沿枪管方向飞出)
      for (var fi = 0; fi < 3 + Math.floor(Math.random() * 3); fi++) {
        var fGeo = new THREE.SphereGeometry(0.02 + Math.random() * 0.03, 4, 4);
        var fMat = new THREE.MeshBasicMaterial({
          color: fi < 2 ? '#ffcc44' : '#ff8800',
          transparent: true,
          opacity: 1,
        });
        var fMesh = new THREE.Mesh(fGeo, fMat);
        fMesh.position.copy(muzzlePos);
        fMesh.position.x += (Math.random() - 0.5) * 0.08;
        fMesh.position.y += (Math.random() - 0.5) * 0.08;
        fMesh.position.z += (Math.random() - 0.5) * 0.08;
        _scene.add(fMesh);
        var fVel = dir.clone().multiplyScalar(4 + Math.random() * 6);
        fVel.x += (Math.random() - 0.5) * 3;
        fVel.y += (Math.random() - 0.5) * 2;
        fVel.z += (Math.random() - 0.5) * 3;
        _playerMuzzleFlashes.push({ mesh: fMesh, vel: fVel, life: 0.12 + Math.random() * 0.1 });
      }
      // 子弹数据
      _playerBullets.push({
        mesh: tracer,
        pos: muzzlePos.clone(),
        dir: dir,
        speed: 80,
        dist: 0,
        maxDist: 55,
        damage: 3,
      });
      // 枪声
      if (typeof window.playMGShotSound === 'function') window.playMGShotSound();
    }

    var ctrl = {
      type: 'hexapod',

      // ════════════════════════════════════════
      //  核心 4 方法
      // ════════════════════════════════════════
      onSpawn: function (ctx) {
        // 0. AI托管标志 (经 engine.js spawnCtx 传入)
        _aiDriven = ctx.aiDriven || false;
        if (_aiDriven) {
          // 构建敌人cfg (复用 updateHexapodEngage 的六足参数结构)
          _enemyCfg = {
            type: 'hexapod',
            engageDist: 30,
            speed: 4.5,
            turnRate: 2.0,
            spinUpTime: 0.8,
            overheatMax: 100,
            heatPerSec: 25,
            coolPerSec: 18,
            spreadCone: 3,
            gatlingRange: 50,
            missileRange: 60,
            missileCooldown: 3.0,
            fireRate: 10,
            attackDamage: 15,
            flameRange: 55,
            viewDist: 80,
            attackCooldown: 0.1,
          };
        }
        // 1. 创建六足模型 (程序化, 复用敌人模型工厂, 含 _baseY/_barrelClusters/_legJoints)
        _root = window.EnemyModels.createHexapod();
        if (!_root) {
          console.error('[HexPlayer] createHexapod 失败');
          return;
        }
        _root.rotation.order = 'YXZ';

        // 2. 先定位到地面 + 朝向 (对齐敌人 enterTrainingMode: position.set(x,gy,z) 然后 init)
        //    注意: 不能加 userData._baseY (那是模板负偏移), init 内部会自动抬升并算 ctx._baseY
        var gy = _gh(_pos.x, _pos.z);
        _root.position.set(_pos.x, gy, _pos.z);
        _root.rotation.y = Math.PI - _yaw; // 车头朝 _yaw; rotation.y=Math.PI - _yaw → fwd=(cos(_yaw),0,sin(_yaw))

        // 3. 建 CCD context (init 内部自动抬升 root.position.y + 算 ctx._baseY, bodyWriter=false)
        _ctx = window.HexapodEnemy.init(_root);
        _ctx._isPlayer = true; // 玩家模式: 支撑相钉脚实际落地位置(对齐工厂), 而非敌人式的 home 相对定位

        // 收集枪管材质 (红热发光, 左右独立)
        _barrelMatsL = [];
        _barrelMatsR = [];
        for (var bi = 1; bi <= 4; bi++) {
          var bgL = _root.getObjectByName('左加特林枪管' + bi);
          var bgR = _root.getObjectByName('右加特林枪管' + bi);
          if (bgL && bgL.children[0] && bgL.children[0].material)
            _barrelMatsL.push(bgL.children[0].material);
          if (bgR && bgR.children[0] && bgR.children[0].material)
            _barrelMatsR.push(bgR.children[0].material);
        }
        _obsMesh = _root.getObjectByName('观瞄球体_mesh'); // HP发光指示
        if (_obsMesh && _obsMesh.material) {
          // 克隆材质: 防止共享材质导致敌人六足的发光逻辑劫持玩家观瞄球体
          _obsMesh.material = _obsMesh.material.clone();
        }

        // 4. ai 对象 (HexapodEnemy.update 读取的字段)
        _ai = {
          state: 'engage', // 非 'dead'/'stagger' 即可
          animRequest: 'idle',
          _desiredVelX: 0,
          _desiredVelZ: 0,
          bodyYaw: _root.rotation.y, // AI需要初始朝向 (非null, updateHexapodEngage用)
          spinUp: 0,
          heat: 0, // AI枪管热量
          _overheated: false,
          _missileAmmoL: 4, // 初始装弹
          _missileAmmoR: 4,
          strafeDir: 1, // AI绕圈方向
          strafeTimer: 0, // AI绕圈计时
          isPlayer: true, // 跳过卡住检测(玩家明确按WASD就是要走)
          // 每侧独立加特林状态
          _leftSpinUp: 0,
          _rightSpinUp: 0,
          _leftHeat: 0,
          _rightHeat: 0,
          _leftOverheated: false,
          _rightOverheated: false,
          _leftFireTimer: 0,
          _rightFireTimer: 0,
        };
        _root.ai = _ai; // HexapodEnemy.update 通过 enemy.ai 访问

        // 5. 绑血条壳: 六足 root → player1.group, 清坦克专属引用 (用 _p1, 非 window.player1)
        var p1 = _p1;
        if (p1) {
          p1.group = _root;
          p1.state = p1.state || {};
          p1.state.x = _pos.x;
          p1.state.z = _pos.z;
          p1.state.yaw = _yaw;
          p1.turretPivot = null;
          p1.barrelPivot = null;
          p1.mgGroup = null;
          p1.leftWheels = [];
          p1.rightWheels = [];
          // 把全局 tankGroup 也指向六足 root (坦克模式退出后恢复, 见 enterTrainingMode 重建)
          if (typeof window.tankGroup !== 'undefined') window.tankGroup = _root;
        }

        _scene.add(_root);

        // 头顶过热警报 Sprite (按键触发, 短暂闪现, 初始隐藏)
        var _ohCanvas = document.createElement('canvas');
        _ohCanvas.width = 256;
        _ohCanvas.height = 64;
        var _ohCtx = _ohCanvas.getContext('2d');
        _ohCtx.fillStyle = '#ff3333';
        _ohCtx.font = 'bold 32px sans-serif';
        _ohCtx.textAlign = 'center';
        _ohCtx.fillText('过热', 128, 42);
        var _ohTex = new THREE.CanvasTexture(_ohCanvas);
        _ohTex.minFilter = THREE.LinearFilter;
        var _ohMat = new THREE.SpriteMaterial({ map: _ohTex, transparent: true, depthTest: false });
        _overheatSprite = new THREE.Sprite(_ohMat);
        _overheatSprite.scale.set(2.5, 0.625, 1);
        _overheatSprite.visible = false;
        _root.add(_overheatSprite);
        // 导弹 UI: 显示锁定框 + 创建3D装填条(仿坦克bars.js)
        var lb = document.getElementById('missile-lock-box');
        if (lb) lb.style.display = 'block';
        _create3DReloadBars();
        _missileAmmoL = 4;
        _missileAmmoR = 4;
        _reloadTimerL = 0;
        _reloadTimerR = 0;
        _nextMissileSide = 'L';
        _lockState = 'idle';
        _lockTarget = null;
        _lockProgress = 0;
      },

      update: function (dt, input) {
        if (!_root || !_ai) return;
        var frozen = _p1 && _p1.dead;

        // ── 0. AI托管: 自动攻击敌方单位 ──
        if (_aiDriven && !frozen) {
          var enemies = window.enemies || [];
          var nearestEnemy = null,
            minDist = 1e9;
          for (var ei = 0; ei < enemies.length; ei++) {
            var te = enemies[ei];
            if (!te || te.dead || !te.position) continue;
            var d = _root.position.distanceTo(te.position);
            if (d < minDist) {
              minDist = d;
              nearestEnemy = te;
            }
          }
          if (nearestEnemy) {
            var fakePlayer = { group: { position: nearestEnemy.position }, hp: 100, dead: false };
            window.EnemyAI.updateHexapodEngage(
              _root,
              _ai,
              _enemyCfg,
              dt,
              fakePlayer,
              [fakePlayer],
              _scene
            );
            _ai.animRequest = _ai.animRequest || 'idle';
            // ── AI武器: 直接同步到玩家射击系统 ──
            // 加特林: 桥接AI spinUp+gatingRequest → 玩家左右侧状态
            _ai._leftSpinUp = _ai.spinUp || 0;
            _ai._rightSpinUp = _ai.spinUp || 0;
            _ai._leftHeat = _ai.heat || 0;
            _ai._rightHeat = _ai.heat || 0;
            _ai._leftOverheated = !!_ai._overheated;
            _ai._rightOverheated = !!_ai._overheated;
            // 导弹: missileRequest 由 updateHexapodEngage 冷却到时设 true, 直接发射
            // (_spawnPlayerMissile 内部自动扣弹+交替巢+装填), 同步弹药回 ai 供 canMissile 判定
            if (_ai.missileRequest) {
              _spawnPlayerMissile(nearestEnemy);
              _ai._missileAmmoL = _missileAmmoL;
              _ai._missileAmmoR = _missileAmmoR;
            }
            // AI加特林俯仰: 对准敌人(AI无鼠标aimTarget, 手动反算枪口俯仰)
            var _aiPitches = [];
            ['左加特林_pivot', '右加特林_pivot'].forEach(function (apvn) {
              var apv = _root.getObjectByName(apvn);
              if (!apv || !apv.parent) return;
              var apvWorld = new THREE.Vector3();
              apv.getWorldPosition(apvWorld);
              var toE = new THREE.Vector3().copy(nearestEnemy.position).sub(apvWorld);
              if (toE.length() < 0.01) return;
              toE.normalize();
              var apq = new THREE.Quaternion();
              apv.parent.getWorldQuaternion(apq);
              var localDir = toE.applyQuaternion(apq.invert());
              _aiPitches.push(Math.atan2(localDir.y, -localDir.x));
            });
            if (_aiPitches.length > 0) {
              _gatlingPitchTarget =
                _aiPitches.reduce(function (a, b) {
                  return a + b;
                }, 0) / _aiPitches.length;
              _gatlingPitchTarget = Math.max(
                GATLING_PITCH_MIN,
                Math.min(GATLING_PITCH_MAX, _gatlingPitchTarget)
              );
            }
          }
          // 跳过输入读取段
          // 更新身体朝向 (AI用 _ai.bodyYaw), 同步 _targetYaw 让 stepGait 追 bodyYaw
          // (与 updateHexapodEngage 设的 rotation.y 一致, 否则 stepGait 把身体拉偏)
          if (_ai.bodyYaw !== undefined && !isNaN(_ai.bodyYaw)) {
            _yaw = Math.PI - _ai.bodyYaw;
            _ai._targetYaw = _ai.bodyYaw;
          }
          // 加特林俯仰平滑跟随 (手动模式在else内, AI单独做)
          _gatlingPitch += (_gatlingPitchTarget - _gatlingPitch) * Math.min(1, 15 * dt);
        } else {
          // ── 1. WASD/摇杆 → animRequest (主轴法, 前/后优先) ──
          //    键盘满力度(=1)或手柄高力度(≥0.7)→ 跑(run步态); 手柄低力度(<0.7)→ 走(walk步态)
          var fwdKey = frozen ? 0 : input.forward || 0;
          var strKey = frozen ? 0 : input.strafe || 0;
          var _maxAbs = Math.max(Math.abs(fwdKey), Math.abs(strKey));
          var _isRun = _maxAbs >= 0.7;
          var req = 'idle';
          if (fwdKey > 0.1) req = _isRun ? 'move_forward_run' : 'move_forward';
          else if (fwdKey < -0.1) req = _isRun ? 'move_backward_run' : 'move_backward';
          else if (strKey > 0.1) req = _isRun ? 'strafe_run_right' : 'strafe_right';
          else if (strKey < -0.1) req = _isRun ? 'strafe_run_left' : 'strafe_left';
          _ai.animRequest = req;

          // ── 2. 转向 + 期望速度 (步进式转向, 视角自由跟鼠标) ──
          //    视角=鼠标(cameraYaw)即时自由; 身体朝向由 stepGait 步进慢追(笨重, 腿蹬地转)。
          //    移动按视角(W=鼠标看的方向); 转向中身体朝向滞后视角, 腿先迈向新方向引导转身。
          var _prevYaw = _yaw;
          if (input.cameraYaw !== undefined && !isNaN(input.cameraYaw)) _yaw = input.cameraYaw;
          var _dyaw = window.HexapodCore.angleDiff(_prevYaw, _yaw);
          var _turnSign = _dyaw > 0.0005 ? 1 : _dyaw < -0.0005 ? -1 : 0;
          _ai._targetYaw = Math.PI - _yaw; // 身体步进追此目标(腿蹬地转向, 模型前向+Z)
          // ── 加特林俯仰: 追踪光标指向的世界目标 ──
          //   aimTarget 由 engine.js 真实 raycast 提供 (平地下拉鼠标→射线打地面→aimTarget→俯仰变化)
          //   望天时 aimTarget=null → 不更新目标, 加特林保持当前俯仰
          if (input.aimTarget) {
            var pitches = [];
            ['左加特林_pivot', '右加特林_pivot'].forEach(function (pvn) {
              var pv = _root.getObjectByName(pvn);
              if (!pv || !pv.parent) return;
              var pivWorld = _tmpVec3.set(0, 0, 0);
              pv.getWorldPosition(pivWorld);
              var toTarget = input.aimTarget.clone().sub(pivWorld);
              if (toTarget.length() < 0.01) return;
              toTarget.normalize();
              // 转到 pivot 父节点局部空间 → 提取俯仰角
              pv.parent.getWorldQuaternion(_tmpQuat);
              var localDir = toTarget.applyQuaternion(_tmpQuat.clone().invert());
              // pivot 局部: 枪管 -X, 俯仰绕 Z; pitch = atan2(localY, -localX)
              var pitch = Math.atan2(localDir.y, -localDir.x);
              pitches.push(pitch);
            });
            if (pitches.length > 0) {
              _gatlingPitchTarget =
                pitches.reduce(function (a, b) {
                  return a + b;
                }, 0) / pitches.length;
              _gatlingPitchTarget = Math.max(
                GATLING_PITCH_MIN,
                Math.min(GATLING_PITCH_MAX, _gatlingPitchTarget)
              );
            }
          }
          _gatlingPitch += (_gatlingPitchTarget - _gatlingPitch) * Math.min(1, 15 * dt);
          // 移动按视角(鼠标看的方向): W=视线前, D=视线右
          var fX = Math.cos(_yaw),
            fZ = Math.sin(_yaw);
          var rX = -Math.sin(_yaw),
            rZ = Math.cos(_yaw);
          var _spd = _isRun ? RUN_SPEED : WALK_SPEED;
          _ai._desiredVelX = (fX * fwdKey + rX * strKey) * _spd;
          _ai._desiredVelZ = (fZ * fwdKey + rZ * strKey) * _spd;
          // 静止转向: 无WASD但鼠标在转 → turn步态(腿蹬地原地转)
          if (Math.abs(fwdKey) < 0.1 && Math.abs(strKey) < 0.1 && _turnSign !== 0) {
            _ai.animRequest = _turnSign > 0 ? 'turn_right' : 'turn_left';
          }
        } // end else: 非AI托管

        // ── 4. 复用 HexapodEnemy.update: 步态/CCD/地形/加特林spin ──
        //    内部 stepGait 的 desiredMove 会驱动 _root.position
        window.HexapodEnemy.update(_root, dt);

        // ── 4.5 加特林俯仰: 绕 pivot 局部Z轴旋转 ──
        //   pitch 约定: 负=俯(aimTarget低), 正=仰(aimTarget高); 绕Z物理: 正=俯/负=仰 → 应用取反
        ['左加特林_pivot', '右加特林_pivot'].forEach(function (pvn) {
          var pv = _root.getObjectByName(pvn);
          if (!pv) return;
          pv.quaternion.setFromAxisAngle(_Z_AXIS, -_gatlingPitch);
          pv.updateMatrixWorld(); // 立即更新, 供 getWeaponAimData 读取最新枪口方向
        });

        // ── 4.6 加特林射击状态机 (左/右独立) ──
        // 注意: 模型命名"左加特林"=玩家视角右侧武器、"右加特林"=玩家视角左侧
        // 左键→右加特林(clusterIdx=1), 右键→左加特林(clusterIdx=0)
        var clusters = _root.userData._barrelClusters;
        [
          { side: 'right', key: '_right', fireField: 'fireLeft', clusterIdx: 1 },
          { side: 'left', key: '_left', fireField: 'fireRight', clusterIdx: 0 },
        ].forEach(function (cfg) {
          var spinKey = cfg.key + 'SpinUp';
          var heatKey = cfg.key + 'Heat';
          var ohKey = cfg.key + 'Overheated';
          var timerKey = cfg.key + 'FireTimer';
          var fireHeld = !!(
            (input[cfg.fireField] && !frozen) ||
            (_aiDriven && !frozen && (_ai.spinUp || 0) > 0.7)
          );
          var overheated = _ai[ohKey];
          var firing = fireHeld && !overheated;

          // 卡壳音效: 过热中按键 → 播一次, 松手重置锁
          var isLeftBtn = cfg.fireField === 'fireLeft';
          if (fireHeld && overheated) {
            if (isLeftBtn && !_jamLockL) {
              _jamLockL = true;
              if (typeof playGatlingJamSound === 'function') playGatlingJamSound();
            }
            if (!isLeftBtn && !_jamLockR) {
              _jamLockR = true;
              if (typeof playGatlingJamSound === 'function') playGatlingJamSound();
            }
          }
          if (isLeftBtn && !fireHeld) _jamLockL = false;
          if (!isLeftBtn && !fireHeld) _jamLockR = false;

          // spinUp
          if (overheated) {
            _ai[spinKey] = Math.max(0, (_ai[spinKey] || 0) - dt * FORCED_DECAY);
          } else if (firing) {
            _ai[spinKey] = Math.min(1.0, (_ai[spinKey] || 0) + dt / SPIN_UP_TIME);
          } else {
            _ai[spinKey] = Math.max(0, (_ai[spinKey] || 0) - dt * SPIN_DECAY);
          }

          // heat
          if (firing && _ai[spinKey] > 0.7) {
            _ai[heatKey] = (_ai[heatKey] || 0) + HEAT_PER_SEC * dt;
          } else if (overheated) {
            _ai[heatKey] = Math.max(0, (_ai[heatKey] || 0) - FORCED_COOL_PER_SEC * dt);
          } else {
            _ai[heatKey] = Math.max(0, (_ai[heatKey] || 0) - COOL_PER_SEC * dt);
          }
          if (_ai[heatKey] >= OVERHEAT_MAX) _ai[heatKey] = OVERHEAT_MAX;

          // overheat 触发/解除
          if (_ai[heatKey] >= OVERHEAT_THRESHOLD) _ai[ohKey] = true;
          if (_ai[ohKey] && _ai[heatKey] <= 0) _ai[ohKey] = false;

          // 射击
          if (firing && _ai[spinKey] > 0.7) {
            _ai[timerKey] = (_ai[timerKey] || 0) - dt;
            if (_ai[timerKey] <= 0) {
              _ai[timerKey] = 1.0 / FIRE_RATE;
              _spawnPlayerGatlingBullet(cfg.side);
            }
          } else {
            _ai[timerKey] = Math.min(0, _ai[timerKey] || 0);
          }

          // 枪管旋转 (每侧独立 cluster, 覆盖 HexapodEnemy.update 设的 0 RPS)
          if (clusters && clusters[cfg.clusterIdx]) {
            var spinRPS = overheated ? 0 : (_ai[spinKey] || 0) * 30;
            window.HexapodCore.updateGatlingSpin([clusters[cfg.clusterIdx]], dt, spinRPS);
          }

          // 过热警报: 本侧过热 + 对应按键 → 触发闪现
          if (fireHeld && overheated) {
            _spriteTimer = 1.5;
          }
        });

        // ── 4.7 头顶过热警报显隐 ──
        if (_spriteTimer > 0) {
          _spriteTimer -= dt;
          if (_overheatSprite) {
            _overheatSprite.visible = true;
            _overheatSprite.position.set(0, 2.5, 0);
            if (_overheatSprite.material) {
              _overheatSprite.material.opacity = Math.min(1, _spriteTimer / 0.3);
            }
          }
        } else {
          if (_overheatSprite) _overheatSprite.visible = false;
        }

        // ── 4.8 枪管红热发光 (左/右独立, 热量与红热成正比) ──
        [
          { mats: _barrelMatsL, heat: _ai._leftHeat },
          { mats: _barrelMatsR, heat: _ai._rightHeat },
        ].forEach(function (cfg) {
          var hn = Math.min(1, (cfg.heat || 0) / 100);
          _tmpColor.lerpColors(COOL_COLOR, HOT_COLOR, hn);
          for (var mi = 0; mi < cfg.mats.length; mi++) {
            if (cfg.mats[mi]) {
              cfg.mats[mi].emissive = _tmpColor;
              cfg.mats[mi].emissiveIntensity = hn * 2;
            }
          }
        });

        // ── 4.8b 观瞄球体 HP 发光 (绿满→红空) ──
        if (_obsMesh && _obsMesh.material && _p1 && _p1.maxHp) {
          var hpRatio = Math.max(0, Math.min(1, _p1.hp / _p1.maxHp));
          _obsMesh.material.emissive = new THREE.Color().setRGB(1 - hpRatio, hpRatio, 0);
          _obsMesh.material.emissiveIntensity = 1.5;
        }

        // ── 4.9 玩家加特林子弹更新 ──
        for (var bi = _playerBullets.length - 1; bi >= 0; bi--) {
          var pb = _playerBullets[bi];
          // 保存旧位置用于射线检测
          var oldPos = pb.pos.clone();
          pb.dist += pb.speed * dt;
          pb.pos.addScaledVector(pb.dir, pb.speed * dt);
          pb.mesh.position.copy(pb.pos);
          var q = new THREE.Quaternion();
          q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), pb.dir);
          pb.mesh.setRotationFromQuaternion(q);

          var hitPoint = null;
          var hitType = '';

          // 距离淘汰
          if (pb.dist > pb.maxDist) {
            _removeBullet(bi);
            continue;
          }

          // ── 碰撞检测 ──
          var stepVec = new THREE.Vector3().subVectors(pb.pos, oldPos);
          var stepDist = stepVec.length();
          if (stepDist < 0.001) continue;
          var stepDir = pb.dir.clone();

          // 1. 障碍物 — 用 checkCollision(空间网格O(1)) 替代 Raycaster(遍历mesh慢), 大幅省CPU
          if (!hitPoint && typeof window.checkCollision === 'function') {
            var bcol = window.checkCollision(pb.pos.x, pb.pos.z, 0.15);
            if (bcol && bcol.hit) {
              hitPoint = pb.pos.clone();
              hitType = 'obstacle';
            }
          }

          // 2. 地面 — 终点低于地形则命中
          if (!hitPoint) {
            var gh = _gh(pb.pos.x, pb.pos.z);
            if (pb.pos.y < gh) {
              var oldGH = _gh(oldPos.x, oldPos.z);
              var frac = Math.max(
                0,
                Math.min(1, (oldPos.y - oldGH) / (oldPos.y - oldGH - (pb.pos.y - gh) + 1e-8))
              );
              hitPoint = oldPos.clone().addScaledVector(stepDir, stepDist * frac);
              hitPoint.y = Math.max(hitPoint.y, gh);
              hitType = 'ground';
            }
          }

          // 3. 水面
          if (!hitPoint && typeof isInRiver === 'function' && typeof isInPond === 'function') {
            if ((isInRiver(pb.pos.x, pb.pos.z) || isInPond(pb.pos.x, pb.pos.z)) && pb.pos.y < 0.5) {
              hitPoint = new THREE.Vector3(pb.pos.x, 0.5, pb.pos.z);
              hitType = 'water';
            }
          }

          // 4. 敌人 — XZ平面距离
          if (!hitPoint && window.enemies && window.enemies.length > 0) {
            for (var ei = 0; ei < window.enemies.length; ei++) {
              var en = window.enemies[ei];
              if (!en || en.dead || (en.ai && en.ai.state === 'dead')) continue;
              var ePos = en.position;
              if (!ePos) continue;
              var dx2 = pb.pos.x - ePos.x;
              var dz2 = pb.pos.z - ePos.z;
              var ed = Math.sqrt(dx2 * dx2 + dz2 * dz2);
              var eHitR = en.cfg && en.cfg.type === 'hexapod' ? 1.5 : 2.0;
              if (ed < eHitR && Math.abs(pb.pos.y - ePos.y) < 2.5) {
                hitPoint = pb.pos.clone();
                hitType = 'enemy';
                if (window.EnemyAI && window.EnemyAI.onEnemyDamaged) {
                  var killed = window.EnemyAI.onEnemyDamaged(en, pb.damage, _p1, true);
                  if (killed) {
                    en.dead = true;
                    if (en.group) en.group.visible = false;
                    else en.visible = false;
                    var ep = ePos.clone();
                    ep.y += 0.5;
                    if (typeof spawnExplosion === 'function') spawnExplosion(ep);
                    if (typeof spawnFragments === 'function') spawnFragments(ep, '#8b7d4a');
                    if (typeof playExplosionSound === 'function') playExplosionSound();
                  }
                }
                break;
              }
            }
          }

          // 命中处理
          if (hitPoint) {
            if (typeof spawnSilentHitSparks === 'function') spawnSilentHitSparks(hitPoint);
            _removeBullet(bi);
          }
        }

        // ── 4.10 枪口闪光灯衰减 ──
        for (var fli = _playerMuzzleLights.length - 1; fli >= 0; fli--) {
          var fl = _playerMuzzleLights[fli];
          fl.life -= dt;
          if (fl.life <= 0) {
            _scene.remove(fl.light);
            _playerMuzzleLights.splice(fli, 1);
          }
        }

        // ── 4.11 枪口焰粒子更新 ──
        for (var mfi = _playerMuzzleFlashes.length - 1; mfi >= 0; mfi--) {
          var mf = _playerMuzzleFlashes[mfi];
          mf.life -= dt;
          if (mf.life <= 0) {
            _scene.remove(mf.mesh);
            mf.mesh.geometry.dispose();
            mf.mesh.material.dispose();
            _playerMuzzleFlashes.splice(mfi, 1);
          } else {
            mf.mesh.position.addScaledVector(mf.vel, dt);
            mf.mesh.material.opacity = Math.max(0, mf.life / 0.2);
            mf.mesh.scale.multiplyScalar(1 - dt * 3);
          }
        }

        // ── 4.12 装填计时器更新 ──
        if (_reloadTimerL > 0) _reloadTimerL = Math.max(0, _reloadTimerL - dt);
        if (_reloadTimerR > 0) _reloadTimerR = Math.max(0, _reloadTimerR - dt);
        if (_reloadTimerL <= 0 && _missileAmmoL <= 0) _missileAmmoL = 4; // 装填完成
        if (_reloadTimerR <= 0 && _missileAmmoR <= 0) _missileAmmoR = 4;

        // ── 4.13 导弹锁定状态机 ──
        var bothReloading =
          (_missileAmmoL <= 0 && _reloadTimerL > 0) || (_reloadTimerL <= 0 && _missileAmmoL < 4);
        // 简化: 双巢都无弹可用
        var noAmmo = _missileAmmoL <= 0 && _missileAmmoR <= 0;

        if (!frozen) {
          // 尝试找锁定目标 (每帧更新, 用于锁定框显示)
          var mx =
            input.mouseX !== undefined
              ? input.mouseX
              : typeof mouseX !== 'undefined'
                ? mouseX
                : window.innerWidth / 2;
          var my =
            input.mouseY !== undefined
              ? input.mouseY
              : typeof mouseY !== 'undefined'
                ? mouseY
                : window.innerHeight / 2;
          var bestTarget = input.camera ? _findBestLockTarget(input.camera, mx, my) : null;

          // 锁定圈目标跟踪 (非idle时跟随锁定目标)
          if (_lockTarget && (_lockState === 'locking' || _lockState === 'locked')) {
            var lc = _getLockCircle();
            var ep = _lockTarget.position;
            lc.position.set(ep.x, ep.y + 0.2, ep.z);
            lc.visible = true;
            if (_lockState === 'locking') {
              var tgtR = _lockTarget.cfg && _lockTarget.cfg.type === 'hexapod' ? 1.5 : 2.0;
              var currentR = LOCK_CIRCLE_START + (tgtR - LOCK_CIRCLE_START) * _lockProgress;
              lc.scale.setScalar(currentR);
              lc.material.color.set(0x00ff00);
            } else {
              lc.material.color.set(0xff3333);
            }
          } else if (_lockCircle) {
            _lockCircle.visible = false;
          }

          // 目标距离检查 (对于已有锁定目标)
          var targetInRange =
            _lockTarget &&
            _lockTarget.position &&
            _root.position.distanceTo(_lockTarget.position) <= LOCK_MAX_RANGE;

          if (_lockState === 'idle') {
            var cantLock =
              noAmmo ||
              !bestTarget ||
              (bestTarget && _root.position.distanceTo(bestTarget.position) > LOCK_MAX_RANGE);
            if (input.spaceDown && cantLock) {
              // 空格按住但不能锁定 → 持续显示警报; 按下瞬间播一次失败音
              if (input.spaceJustPressed && typeof playGatlingJamSound === 'function')
                playGatlingJamSound();
              if (noAmmo) _showAlert('装填中');
              else _showAlert('超出距离');
            } else if (!input.spaceDown) {
              // 松空格 → 隐藏警报
              if (_alertSprite) _alertSprite.visible = false;
            }
            // 空格按下 + 条件满足 → 开始锁定 (只在首次按下时触发)
            if (input.spaceJustPressed && !cantLock) {
              _lockState = 'locking';
              _lockTarget = bestTarget;
              _lockProgress = 0;
              if (_alertSprite) _alertSprite.visible = false;
            }
          } else if (_lockState === 'locking') {
            // 锁定中: 敌死→取消; 敌出框→取消; 超出距离→取消; 空格松→取消
            if (_lockTarget && _lockTarget.dead) {
              _lockState = 'idle';
              _lockTarget = null;
              _lockProgress = 0;
            } else if (!bestTarget || bestTarget !== _lockTarget || !targetInRange) {
              _lockState = 'idle';
              _lockTarget = null;
              _lockProgress = 0;
            } else if (!input.spaceDown) {
              _lockState = 'idle';
              _lockTarget = null;
              _lockProgress = 0;
            } else {
              _lockProgress += dt / LOCK_TIME;
              if (_lockProgress >= 1.0) {
                _lockState = 'locked';
                _lockProgress = 1.0;
                if (typeof playLockOnSound === 'function') playLockOnSound();
              }
            }
          } else if (_lockState === 'locked') {
            // 锁定成功: 目标死亡→取消; 松空格→发射
            if (_lockTarget && _lockTarget.dead) {
              _lockState = 'idle';
              _lockTarget = null;
              _lockProgress = 0;
            } else if (!input.spaceDown) {
              _spawnPlayerMissile(_lockTarget);
              _lockState = 'idle';
              _lockTarget = null;
              _lockProgress = 0;
            }
          }
        } else {
          // 死亡 → 取消所有锁定
          _lockState = 'idle';
          _lockTarget = null;
          _lockProgress = 0;
          if (_lockCircle) _lockCircle.visible = false;
        }

        // ── 4.14 导弹更新 ──
        _updatePlayerMissiles(dt);

        // ── 4.15 锁定框跟随光标 ──
        var lb = document.getElementById('missile-lock-box');
        if (lb) {
          lb.style.display = 'block';
          lb.style.left = (input.mouseX || mouseX || 0) + 'px';
          lb.style.top = (input.mouseY || mouseY || 0) + 'px';
          lb.className = '';
          if (_lockState === 'locking') lb.className = 'locking';
          else if (_lockState === 'locked') lb.className = 'locked';
          else if (noAmmo) lb.className = 'reloading';
        }
        // 3D 装填条: 定位到六足两侧, 面朝摄像机 (对齐坦克bars.js公式)
        if (_reloadBarL && _reloadBarR) {
          var bx = _root.position.x,
            bz = _root.position.z;
          var by = _gh(bx, bz) + 1.6; // 地面高度+偏移(六足比坦克高)
          if (input.camera) {
            var cam = input.camera;
            var toCamX = cam.position.x - bx,
              toCamZ = cam.position.z - bz;
            var tl = Math.sqrt(toCamX * toCamX + toCamZ * toCamZ) || 1;
            var cfx = toCamX / tl,
              cfz = toCamZ / tl;
            _reloadBarL.position.set(bx + cfz * 1.0, by, bz - cfx * 1.0);
            _reloadBarL.lookAt(cam.position);
            _reloadBarR.position.set(bx - cfz * 1.0, by, bz + cfx * 1.0);
            _reloadBarR.lookAt(cam.position);
            var lpct =
              _reloadTimerL > 0 ? (RELOAD_TIME - _reloadTimerL) / RELOAD_TIME : _missileAmmoL / 4;
            var rpct =
              _reloadTimerR > 0 ? (RELOAD_TIME - _reloadTimerR) / RELOAD_TIME : _missileAmmoR / 4;
            if (_reloadBarL.userData.fill) {
              _reloadBarL.userData.fill.scale.y = Math.max(0.01, lpct);
              _reloadBarL.userData.fill.position.y = -0.28 + 0.25 * lpct;
              _reloadBarL.userData.fill.material.color.set(lpct >= 1 ? '#44ff44' : '#ff8800');
              _reloadBarL.visible = lpct < 1;
            }
            if (_reloadBarR.userData.fill) {
              _reloadBarR.userData.fill.scale.y = Math.max(0.01, rpct);
              _reloadBarR.userData.fill.position.y = -0.28 + 0.25 * rpct;
              _reloadBarR.userData.fill.material.color.set(rpct >= 1 ? '#44ff44' : '#ff8800');
              _reloadBarR.visible = rpct < 1;
            }
          }
        }

        // ── 5. 碰撞 + 空气墙 (复用全局 checkCollision) ──
        var nx = _root.position.x,
          nz = _root.position.z;
        if (typeof window.checkCollision === 'function') {
          var col = window.checkCollision(nx, nz, 0.6);
          if (col && col.hit) {
            nx += col.pushX;
            nz += col.pushZ;
          }
        }
        var cl = _clampToWorld(nx, nz);
        nx = cl.x;
        nz = cl.z;

        // ── 6. 应用碰撞钳制后的 x/z (Y 由 stepGait 内部用 ctx._baseY 维持, 不在此覆盖) ──
        _root.position.x = nx;
        _root.position.z = nz;
        _pos.x = nx;
        _pos.z = nz;

        // ── 7. 同步血条壳 (yaw = 身体实际车头, 非视角目标) ──
        if (_p1) {
          _p1.state.x = nx;
          _p1.state.z = nz;
          _p1.state.yaw = _root ? Math.PI - _root.rotation.y : _yaw;
        }
      },

      getPose: function () {
        // yaw = 身体实际车头朝向(stepGait 步态步进式驱动, 慢追 _yaw 视角目标)
        return { x: _pos.x, z: _pos.z, yaw: _root ? Math.PI - _root.rotation.y : _yaw };
      },

      isAiDriven: function () {
        return _aiDriven;
      },

      getGroup: function () {
        return _root;
      },

      // ════════════════════════════════════════
      //  可选能力钩子
      // ════════════════════════════════════════
      canSniper: function () {
        return false;
      }, // 无炮塔, 不支持狙击

      // 返回加特林瞄准数据: 枪口位置/方向/状态, 供瞄准线模块消费
      getWeaponAimData: function () {
        if (!_root || (_p1 && _p1.dead)) return null;
        var result = {
          isOverheated: !!(_ai && (_ai._leftOverheated || _ai._rightOverheated)),
          heat: _ai ? Math.max(_ai._leftHeat || 0, _ai._rightHeat || 0) : 0,
          maxRange: GATLING_RANGE,
        };
        ['左', '右'].forEach(function (side) {
          var pv = _root.getObjectByName(side + '加特林_pivot');
          if (!pv) return;
          var pivWorld = new THREE.Vector3();
          pv.getWorldPosition(pivWorld);
          // 枪口方向: pivot 局部 -X (与子弹生成一致)
          var pivFwd = new THREE.Vector3(-1, 0, 0);
          pv.localToWorld(pivFwd);
          var dir = pivFwd.sub(pivWorld).normalize();
          // 枪口位置 = pivot位置 + 前向 * 0.75
          var muzzle = pivWorld.clone().addScaledVector(dir, 0.75);
          var key = side === '左' ? 'left' : 'right';
          var sideKey = side === '左' ? '_left' : '_right';
          result[key] = {
            pos: muzzle,
            dir: dir,
            isOverheated: !!(_ai && _ai[sideKey + 'Overheated']),
            heat: _ai ? _ai[sideKey + 'Heat'] || 0 : 0,
          };
        });
        return result;
      },

      onRespawn: function () {
        // 重建 CCD IK context (与 _processTrainingRespawn 对六足敌人一致)
        if (_root && window.HexapodEnemy) {
          _ctx = window.HexapodEnemy.init(_root);
          _ctx._isPlayer = true; // 修复: init 返回新 ctx, 必须重设, 否则玩家步态分支失效
          _root.ai = _ai;
          // 引擎 _processTrainingRespawn 按坦克公式设 rotation.y=π, 六足公式不同需覆盖
          // cameraYaw 已重置为 π, _yaw 同步, rotation.y = π - π = 0 (六足前向 -X = 相机朝向)
          _yaw = Math.PI;
          _root.rotation.y = 0;
          _ai._targetYaw = 0;
          _ai.bodyYaw = 0; // 复活重置bodyYaw(否则保持死前值, 与rotation.y不同步致转向偏)
        }
        _ai.animRequest = 'idle';
        _ai._desiredVelX = 0;
        _ai._desiredVelZ = 0;
        // 重置加特林每侧状态
        _ai._leftSpinUp = _ai._rightSpinUp = 0;
        _ai._leftHeat = _ai._rightHeat = 0;
        _ai._leftOverheated = _ai._rightOverheated = false;
        _ai._leftFireTimer = _ai._rightFireTimer = 0;
        _jamLockL = _jamLockR = false;
        _spriteTimer = 0;
        if (_overheatSprite) _overheatSprite.visible = false;
        // 重置导弹
        _missileAmmoL = 4;
        _missileAmmoR = 4;
        _reloadTimerL = 0;
        _reloadTimerR = 0;
        _nextMissileSide = 'L';
        _lockState = 'idle';
        _lockTarget = null;
        _lockProgress = 0;
        if (_lockCircle) {
          _lockCircle.visible = false;
        }
      },

      onHit: function (dmg, hitDir) {
        if (_ctx && hitDir && window.HexapodEnemy) {
          window.HexapodEnemy.triggerStagger(_ctx, hitDir, Math.min(1, (dmg || 10) / 40));
        }
      },

      dispose: function () {
        // 清玩家子弹
        for (var i = _playerBullets.length - 1; i >= 0; i--) {
          var b = _playerBullets[i];
          if (b.mesh) {
            _scene.remove(b.mesh);
            b.mesh.geometry.dispose();
            b.mesh.material.dispose();
          }
        }
        _playerBullets = [];
        // 清枪口闪光
        for (var j = _playerMuzzleLights.length - 1; j >= 0; j--) {
          _scene.remove(_playerMuzzleLights[j].light);
        }
        _playerMuzzleLights = [];
        for (var k = _playerMuzzleFlashes.length - 1; k >= 0; k--) {
          _scene.remove(_playerMuzzleFlashes[k].mesh);
          _playerMuzzleFlashes[k].mesh.geometry.dispose();
          _playerMuzzleFlashes[k].mesh.material.dispose();
        }
        _playerMuzzleFlashes = [];
        // 清过热警报 Sprite
        if (_overheatSprite) {
          if (_overheatSprite.material && _overheatSprite.material.map)
            _overheatSprite.material.map.dispose();
          if (_overheatSprite.material) _overheatSprite.material.dispose();
          _overheatSprite = null;
        }
        _spriteTimer = 0;
        _jamLockL = _jamLockR = false;
        // 清导弹
        for (var mi = _playerMissiles.length - 1; mi >= 0; mi--) {
          var pm = _playerMissiles[mi];
          _scene.remove(pm.mesh);
          pm.mesh.traverse(function (c) {
            if (c.geometry) c.geometry.dispose();
            if (c.material) c.material.dispose();
          });
        }
        _playerMissiles = [];
        for (var ei = _playerMissileExplosions.length - 1; ei >= 0; ei--) {
          var ex = _playerMissileExplosions[ei];
          _scene.remove(ex.mesh);
          ex.mesh.geometry.dispose();
          ex.mesh.material.dispose();
        }
        _playerMissileExplosions = [];
        if (_lockCircle) {
          _scene.remove(_lockCircle);
          _lockCircle.geometry.dispose();
          _lockCircle.material.dispose();
          _lockCircle = null;
        }
        _lockState = 'idle';
        _lockTarget = null;
        // 隐藏导弹 UI + 清理 3D 装填条
        var lb = document.getElementById('missile-lock-box');
        if (lb) lb.style.display = 'none';
        if (_reloadBarL) {
          _reloadBarL.traverse(function (c) {
            if (c.geometry) c.geometry.dispose();
            if (c.material) c.material.dispose();
          });
          _scene.remove(_reloadBarL);
          _reloadBarL = null;
        }
        if (_reloadBarR) {
          _reloadBarR.traverse(function (c) {
            if (c.geometry) c.geometry.dispose();
            if (c.material) c.material.dispose();
          });
          _scene.remove(_reloadBarR);
          _reloadBarR = null;
        }
        if (_alertSprite) {
          if (_alertSprite.material && _alertSprite.material.map)
            _alertSprite.material.map.dispose();
          if (_alertSprite.material) _alertSprite.material.dispose();
          _scene.remove(_alertSprite);
          _alertSprite = null;
        }
        if (_obsMesh && _obsMesh.material) {
          _obsMesh.material.dispose();
          _obsMesh = null;
        }
        if (window.HexapodAimLine) window.HexapodAimLine.deactivate();
        if (_root && _root.parent) _root.parent.remove(_root);
        _root = null;
        _ctx = null;
        _ai = null;
      },
    };

    return ctrl;
  }

  // 文件加载即注册
  if (window.PlayerControllerManager) {
    window.PlayerControllerManager.register('hexapod', create);
  } else {
    console.error('[HexPlayer] PlayerControllerManager 未加载, 无法注册');
  }

  return { create: create };
})();
window.HexapodPlayerController = HexapodPlayerController;
