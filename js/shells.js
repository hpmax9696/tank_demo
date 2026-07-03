var RECOIL_PITCH = -0.08,
  RECOIL_DECAY = 5.0;
var SHELL_SPEED = 50.0,
  SHELL_GRAVITY = 1.0;
var RELOAD_TIME = 2.0,
  SHELL_MAX_DIST = 300.0;
var FRAG_COUNT = 8,
  FRAG_LIFE = 1.5,
  FRAG_SPEED = 3.0;
var SHELL_DAMAGE = 20;
var HE_DAMAGE = 12,
  HE_SPLASH = 2.0;
var EXPLOSION_RADIUS = 3.5;
var EXPLOSION_COLOR_TANK = '#ff6600';

// P-burst-2: 碎片对象池 —— 复用 mesh/geometry/material/Vector3，消除 spawn 批量 new，减 GC
// 单位 Box geometry 共享，碎片大小用 mesh.scale；每 mesh 独立 material（复用时改 color/emissive/opacity）
var _fragGeo = new THREE.BoxGeometry(1, 1, 1);
var _fragPool = [];
function _acquireFrag() {
  var f = _fragPool.pop();
  if (!f) {
    var mat = new THREE.MeshStandardMaterial({ roughness: 0.6, metalness: 0.1, transparent: true });
    var mesh = new THREE.Mesh(_fragGeo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    f = { mesh: mesh, vel: new THREE.Vector3(), rotSpeed: new THREE.Vector3() };
  }
  f.mesh.visible = true;
  scene.add(f.mesh);
  return f;
}
function _releaseFrag(f) {
  f.mesh.visible = false;
  scene.remove(f.mesh);
  _fragPool.push(f);
}

function spawnHitSparks(pos) {
  playHitSound();
  _spawnSparkParticles(pos);
}

function spawnSilentHitSparks(pos) {
  _spawnSparkParticles(pos);
}

function _spawnSparkParticles(pos) {
  for (let i = 0; i < 10; i++) {
    const f = _acquireFrag();
    const size = 0.03 + Math.random() * 0.06;
    f.mesh.scale.set(size, size, size);
    f.mesh.material.color.set('#ffcc44');
    f.mesh.material.emissive.set('#ffcc44');
    f.mesh.material.emissiveIntensity = 2.0;
    f.mesh.material.opacity = 1;
    f.mesh.position.copy(pos);
    f.vel.set((Math.random() - 0.5) * 3, Math.random() * 2, (Math.random() - 0.5) * 3);
    f.rotSpeed.set(0, 0, 0);
    f.life = 0.4 + Math.random() * 0.3;
    fragments.push(f);
  }
}

function spawnGroundDebris(pos) {
  const gy = getGroundHeight(pos.x, pos.z) + 0.05;
  for (let i = 0; i < 15; i++) {
    const f = _acquireFrag();
    const s = 0.02 + Math.random() * 0.05;
    f.mesh.scale.set(s, s, s);
    f.mesh.material.color.setHSL(0.1, 0.25, 0.2 + Math.random() * 0.3);
    f.mesh.material.emissive.set('#000000');
    f.mesh.material.emissiveIntensity = 0;
    f.mesh.material.opacity = 1;
    f.mesh.position.set(pos.x, gy + 0.05, pos.z);
    f.vel.set((Math.random() - 0.5) * 4, 1 + Math.random() * 3, (Math.random() - 0.5) * 4);
    f.rotSpeed.set(0, 0, 0);
    f.life = 0.6 + Math.random() * 0.5;
    f.maxLife = 0.6 + Math.random() * 0.5;
    groundDebris.push(f);
  }
}

function spawnScorchMark(pos) {
  const gy = getGroundHeight(pos.x, pos.z);
  const d = 0.5;
  const hx = getGroundHeight(pos.x + d, pos.z);
  const hz = getGroundHeight(pos.x, pos.z + d);
  const terrainNormal = new THREE.Vector3(-(hx - gy) / d, 1.0, -(hz - gy) / d).normalize();
  const geo = new THREE.CircleGeometry(0.45 + Math.random() * 0.25, 16);
  const mat = new THREE.MeshBasicMaterial({
    color: '#1a1a1a',
    transparent: true,
    opacity: 0.65,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const mark = new THREE.Mesh(geo, mat);
  const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), terrainNormal);
  mark.setRotationFromQuaternion(quat);
  mark.position.copy(pos).addScaledVector(terrainNormal, 0.06);
  scene.add(mark);
  scorchMarks.push({ mesh: mark, life: 2.5 + Math.random() * 0.5, maxLife: 3.0 });
}

function disposeShellMesh(mesh) {
  mesh.traverse((child) => {
    if (child.geometry) child.geometry.dispose();
    if (child.material) child.material.dispose();
  });
}

function fireShell(player) {
  if (!player && player1) player = player1;
  if (player.reloadTimer > 0 || player.dead) return;
  const sp = player.spec || TANK_SPECS.t34;
  player.reloadTimer = sp.reloadTime;
  player.recoilPitch = sp.recoil;
  playFireSound();

  const barrelTipLocal = player._barrelTipLocal || new THREE.Vector3(0, 0, 3.72);
  const barrelTipWorld = barrelTipLocal
    .clone()
    .applyMatrix4(player.barrelPivot ? player.barrelPivot.matrixWorld : player.group.matrixWorld);
  const worldQ = new THREE.Quaternion();
  if (player.barrelPivot) {
    player.barrelPivot.getWorldQuaternion(worldQ);
  } else {
    player.group.getWorldQuaternion(worldQ);
  }
  const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(worldQ);

  const flashLight = new THREE.PointLight('#ffcc44', 15, 8, 2);
  flashLight.position.copy(barrelTipWorld);
  scene.add(flashLight);
  muzzleLights.push({ light: flashLight, life: 0.15 });

  const f1 = new THREE.Mesh(
    new THREE.SphereGeometry(0.15, 8, 8),
    new THREE.MeshBasicMaterial({ color: '#ffaa00', transparent: true, opacity: 0.9 })
  );
  f1.position.copy(barrelTipWorld);
  scene.add(f1);
  muzzleLights.push({ light: f1, life: 0.25 });

  const f2 = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 6, 6),
    new THREE.MeshBasicMaterial({ color: '#ff6600', transparent: true, opacity: 0.7 })
  );
  f2.position.copy(barrelTipWorld);
  scene.add(f2);
  muzzleLights.push({ light: f2, life: 0.35 });

  const shellGroup = new THREE.Group();
  const isHe = currentShellType === 'he';
  const shellMat = new THREE.MeshStandardMaterial({
    color: isHe ? '#ff6600' : '#ffcc00',
    roughness: 0.05,
    metalness: 0.3,
    emissive: isHe ? '#ff4400' : '#ff9900',
    emissiveIntensity: 2.5,
  });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.18, 8), shellMat);
  body.rotation.x = Math.PI / 2;
  body.castShadow = true;
  shellGroup.add(body);
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.08, 8), shellMat);
  tip.rotation.x = Math.PI / 2;
  tip.position.z = 0.13;
  tip.castShadow = true;
  shellGroup.add(tip);
  shellGroup.position.copy(barrelTipWorld);
  scene.add(shellGroup);

  const glowTail = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 8, 8),
    new THREE.MeshBasicMaterial({
      color: isHe ? '#ff4400' : '#ff8800',
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
    })
  );
  glowTail.position.copy(barrelTipWorld);
  glowTail.renderOrder = 999;
  glowTail.material.depthTest = true;
  scene.add(glowTail);

  const shellSpeed = sp.shellSpeed;
  const vel = new THREE.Vector3(
    forward.x * shellSpeed,
    forward.y * shellSpeed,
    forward.z * shellSpeed
  );
  shells.push({
    mesh: shellGroup,
    vel,
    owner: player,
    glowTail,
    type: currentShellType,
    damage: sp.shellDamage,
    heDamage: sp.heDamage,
    heSplash: sp.heSplash,
    explosionRadius: sp.explosionRadius,
  });
}

function spawnFragments(pos, color) {
  playDebrisSound();

  for (let i = 0; i < FRAG_COUNT; i++) {
    const f = _acquireFrag();
    const size = 0.05 + Math.random() * 0.1;
    f.mesh.scale.set(
      size * (0.6 + Math.random() * 0.4),
      size * (0.6 + Math.random() * 0.4),
      size * (0.6 + Math.random() * 0.4)
    );
    f.mesh.material.color.set(color);
    f.mesh.material.emissive.set('#000000');
    f.mesh.material.emissiveIntensity = 0;
    f.mesh.material.opacity = 1;
    f.mesh.position.copy(pos);

    const angle = Math.random() * Math.PI * 2;
    const upBias = 0.2 + Math.random() * 0.4;
    const speed = FRAG_SPEED * (0.5 + Math.random() * 0.5);
    f.vel.set(
      Math.cos(angle) * speed * (1 - upBias),
      speed * upBias * 1.2,
      Math.sin(angle) * speed * (1 - upBias)
    );
    f.rotSpeed.set((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6);
    f.life = FRAG_LIFE * (0.8 + Math.random() * 0.2);
    fragments.push(f);
  }
}

function spawnExplosion(pos, skipChain) {
  const effect = new window.ExplosionEffects();
  scene.add(effect.firePoints);
  scene.add(effect.smokePoints);
  effect.trigger(pos.clone());
  explosions.push(effect);

  if (!skipChain) {
    checkChainExplosion(pos);
  }
}

function spawnHeExplosion(pos) {
  const ep = pos.clone();
  const light = new THREE.PointLight('#ff6600', 6, HE_SPLASH + 3, 2);
  light.position.copy(ep);
  light.position.y += 0.3;
  scene.add(light);
  muzzleLights.push({ light, life: 0.6 });

  const sw1 = new THREE.Mesh(
    new THREE.SphereGeometry(1, 20, 20),
    new THREE.MeshBasicMaterial({ color: '#ffcc44', transparent: true, opacity: 0.7 })
  );
  sw1.position.copy(ep);
  sw1.renderOrder = 998;
  sw1.scale.set(0.06, 0.06, 0.06);
  scene.add(sw1);
  ringFX.push({ mesh: sw1, life: 0.45, maxLife: 0.45, isShockwave: true, targetScale: HE_SPLASH });
  const sw2 = new THREE.Mesh(
    new THREE.SphereGeometry(1, 14, 14),
    new THREE.MeshBasicMaterial({ color: '#ff6600', transparent: true, opacity: 0.45 })
  );
  sw2.position.copy(ep);
  sw2.renderOrder = 998;
  sw2.scale.set(0.04, 0.04, 0.04);
  scene.add(sw2);
  ringFX.push({
    mesh: sw2,
    life: 0.35,
    maxLife: 0.35,
    isShockwave: true,
    targetScale: HE_SPLASH * 0.85,
  });

  for (let k = 0; k < 6; k++) {
    const angle = (k / 6) * Math.PI * 2;
    const dist = 0.3 + Math.random() * HE_SPLASH;
    const spark = new THREE.Mesh(
      new THREE.SphereGeometry(0.06 + Math.random() * 0.1, 4, 4),
      new THREE.MeshBasicMaterial({ color: '#ffaa00', transparent: true, opacity: 0.9 })
    );
    spark.position.set(
      ep.x + Math.cos(angle) * dist,
      ep.y + 0.3 + Math.random() * 1.2,
      ep.z + Math.sin(angle) * dist
    );
    scene.add(spark);
    const spLife = 0.3 + Math.random() * 0.4;
    ringFX.push({ mesh: spark, life: spLife, maxLife: spLife });
  }

  const fragMat = new THREE.MeshStandardMaterial({
    color: '#ff6600',
    roughness: 0.4,
    metalness: 0.2,
    emissive: '#ff4400',
    emissiveIntensity: 1.5,
  });
  for (let i = 0; i < 8; i++) {
    const geo = new THREE.BoxGeometry(
      0.06 + Math.random() * 0.12,
      0.06 + Math.random() * 0.12,
      0.06 + Math.random() * 0.12
    );
    const f = new THREE.Mesh(geo, fragMat);
    f.position.copy(ep);
    f.position.y += 0.3;
    const vx = (Math.random() - 0.5) * 5,
      vy = 2 + Math.random() * 4,
      vz = (Math.random() - 0.5) * 5;
    f.userData = {
      vel: new THREE.Vector3(vx, vy, vz),
      rot: new THREE.Vector3(Math.random() * 8, Math.random() * 8, Math.random() * 8),
    };
    scene.add(f);
    ringFX.push({ mesh: f, life: 0.8 + Math.random() * 0.6, maxLife: 1.4, isFrag: true });
  }
}

function checkChainExplosion(explosionPos) {
  const chainRadius = EXPLOSION_RADIUS;
  const chainRadiusSq = chainRadius * chainRadius;

  const nearbyObstacles = window._obstacleGrid
    ? window._obstacleGrid.queryByDistance(explosionPos.x, explosionPos.z, chainRadius)
    : obstacleData;

  for (let i = nearbyObstacles.length - 1; i >= 0; i--) {
    const od = nearbyObstacles[i];
    if (od.destroyed) continue;
    if (od.type === 'building' && od.groupRef && !od.groupRef.visible) continue;

    const dx = explosionPos.x - od.x;
    const dz = explosionPos.z - od.z;
    const distSq = dx * dx + dz * dz;

    if (distSq < chainRadiusSq) {
      const obsCenter = new THREE.Vector3(od.x, 0, od.z);
      obsCenter.y += (od.height || 1.5) / 2;
      spawnFragments(obsCenter, od.color);
      playExplosionSound();

      if (od.type === 'building' && od.groupRef) {
        const obs = od.groupRef;
        obs.parent.remove(obs);
        obs.traverse((c) => {
          if (c.geometry) c.geometry.dispose();
          if (c.material) c.material.dispose();
        });
        const meshIdx = obstacleMeshes.indexOf(obs);
        if (meshIdx >= 0) obstacleMeshes.splice(meshIdx, 1);
      } else if (od.type && od.type !== 'building') {
        disposeTreeInstance(od);
      }
      // 找到 od 在 obstacleData 中的真实索引并移除
      const realIdx = obstacleData.indexOf(od);
      if (realIdx >= 0) {
        obstacleData.splice(realIdx, 1);
      }
      // 从空间网格中移除
      if (window._obstacleGrid) {
        window._obstacleGrid.remove(od);
      }
    }
  }
}
