var RECOIL_PITCH = -0.08, RECOIL_DECAY = 5.0;
var SHELL_SPEED = 33.0, SHELL_GRAVITY = 1.0;
var RELOAD_TIME = 2.0, SHELL_MAX_DIST = 300.0;
var FRAG_COUNT = 12, FRAG_LIFE = 3.0, FRAG_SPEED = 6.0;
var SHELL_DAMAGE = 20;
var HE_DAMAGE = 12, HE_SPLASH = 2.0;
var EXPLOSION_RADIUS = 3.5;
var EXPLOSION_COLOR_TANK = '#ff6600';

function spawnHitSparks(pos) {
    playHitSound();
    _spawnSparkParticles(pos);
}

function spawnSilentHitSparks(pos) {
    _spawnSparkParticles(pos);
}

function _spawnSparkParticles(pos) {
    for (let i = 0; i < 10; i++) {
        const size = 0.03 + Math.random() * 0.06;
        const geo = new THREE.SphereGeometry(size, 4, 4);
        const mat = new THREE.MeshBasicMaterial({ color: '#ffcc44', transparent: true, opacity: 1 });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.copy(pos);
        scene.add(mesh);
        const vel = new THREE.Vector3(
            (Math.random() - 0.5) * 3,
            Math.random() * 2,
            (Math.random() - 0.5) * 3
        );
        fragments.push({
            mesh, vel,
            life: 0.4 + Math.random() * 0.3,
            rotSpeed: new THREE.Vector3(0, 0, 0)
        });
    }
}

function spawnGroundDebris(pos) {
    const gy = getGroundHeight(pos.x, pos.z) + 0.05;
    for (let i = 0; i < 15; i++) {
        const geo = new THREE.SphereGeometry(0.02 + Math.random() * 0.05, 3, 3);
        const mat = new THREE.MeshBasicMaterial({
            color: new THREE.Color().setHSL(0.1, 0.25, 0.2 + Math.random() * 0.3),
            transparent: true, opacity: 1
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.copy(pos); mesh.position.y = gy + 0.05;
        scene.add(mesh);
        const vel = new THREE.Vector3(
            (Math.random() - 0.5) * 4,
            1 + Math.random() * 3,
            (Math.random() - 0.5) * 4
        );
        groundDebris.push({
            mesh, vel,
            life: 0.6 + Math.random() * 0.5,
            maxLife: 0.6 + Math.random() * 0.5
        });
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
        polygonOffset: true,
        polygonOffsetFactor: -4,
        polygonOffsetUnit: -4
    });
    const mark = new THREE.Mesh(geo, mat);
    const quat = new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 0, 1),
        terrainNormal
    );
    mark.setRotationFromQuaternion(quat);
    mark.position.copy(pos).addScaledVector(terrainNormal, 0.06);
    scene.add(mark);
    scorchMarks.push({ mesh: mark, life: 2.5 + Math.random() * 0.5, maxLife: 3.0 });
}

function disposeShellMesh(mesh) {
    mesh.traverse(child => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
    });
}

function fireShell(player) {
    if (!player && player1) player = player1;
    if (player.reloadTimer > 0 || player.dead) return;
    player.reloadTimer = RELOAD_TIME;
    player.recoilPitch = RECOIL_PITCH;
    playFireSound();

    const barrelTipLocal = player._barrelTipLocal || new THREE.Vector3(0, 0, 3.72);
    const barrelTipWorld = barrelTipLocal.clone().applyMatrix4(player.barrelPivot ? player.barrelPivot.matrixWorld : player.group.matrixWorld);
    const worldQ = new THREE.Quaternion();
    if (player.barrelPivot) {
        player.barrelPivot.getWorldQuaternion(worldQ);
    } else {
        player.group.getWorldQuaternion(worldQ);
    }
    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(worldQ);

    const flashLight = new THREE.PointLight('#ffcc44', 15, 8, 2);
    flashLight.position.copy(barrelTipWorld); scene.add(flashLight);
    muzzleLights.push({ light: flashLight, life: 0.15 });

    const f1 = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 8), new THREE.MeshBasicMaterial({ color:'#ffaa00', transparent:true, opacity:0.9 }));
    f1.position.copy(barrelTipWorld); scene.add(f1); muzzleLights.push({ light: f1, life: 0.25 });

    const f2 = new THREE.Mesh(new THREE.SphereGeometry(0.22, 6, 6), new THREE.MeshBasicMaterial({ color:'#ff6600', transparent:true, opacity:0.7 }));
    f2.position.copy(barrelTipWorld); scene.add(f2); muzzleLights.push({ light: f2, life: 0.35 });

    const shellGroup = new THREE.Group();
    const isHe = (currentShellType === 'he');
    const shellMat = new THREE.MeshStandardMaterial({
        color: isHe ? '#ff6600' : '#ffcc00',
        roughness: 0.05, metalness: 0.3,
        emissive: isHe ? '#ff4400' : '#ff9900',
        emissiveIntensity: 2.5
    });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.18, 8), shellMat);
    body.rotation.x = Math.PI/2; body.castShadow = true;
    shellGroup.add(body);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.08, 8), shellMat);
    tip.rotation.x = Math.PI/2; tip.position.z = 0.13; tip.castShadow = true;
    shellGroup.add(tip);
    shellGroup.position.copy(barrelTipWorld);
    scene.add(shellGroup);

    const glowTail = new THREE.Mesh(
        new THREE.SphereGeometry(0.12, 8, 8),
        new THREE.MeshBasicMaterial({ color: isHe ? '#ff4400' : '#ff8800', transparent: true, opacity: 0.60, depthWrite: false })
    );
    glowTail.position.copy(barrelTipWorld);
    glowTail.renderOrder = 999;
    glowTail.material.depthTest = true;
    scene.add(glowTail);

    const vel = new THREE.Vector3(
        forward.x * SHELL_SPEED,
        forward.y * SHELL_SPEED,
        forward.z * SHELL_SPEED
    );
    shells.push({ mesh: shellGroup, vel, owner: player, glowTail, type: currentShellType });
}

function spawnFragments(pos, color) {
    playDebrisSound();
    const fragMat = new THREE.MeshStandardMaterial({
        color, roughness: 0.6, metalness: 0.1
    });

    for (let i = 0; i < FRAG_COUNT; i++) {
        const size = 0.08 + Math.random() * 0.2;
        const geo = new THREE.BoxGeometry(
            size * (0.5 + Math.random()),
            size * (0.5 + Math.random()),
            size * (0.5 + Math.random())
        );
        const mesh = new THREE.Mesh(geo, fragMat);
        mesh.position.copy(pos);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        scene.add(mesh);

        const angle = Math.random() * Math.PI * 2;
        const upBias = 0.3 + Math.random() * 0.7;
        const speed = FRAG_SPEED * (0.4 + Math.random() * 0.6);
        const vel = new THREE.Vector3(
            Math.cos(angle) * speed * (1 - upBias),
            speed * upBias * 1.5,
            Math.sin(angle) * speed * (1 - upBias)
        );

        fragments.push({
            mesh,
            vel,
            life: FRAG_LIFE * (0.7 + Math.random() * 0.3),
            rotSpeed: new THREE.Vector3(
                (Math.random() - 0.5) * 10,
                (Math.random() - 0.5) * 10,
                (Math.random() - 0.5) * 10
            )
        });
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
    ringFX.push({ mesh: sw2, life: 0.35, maxLife: 0.35, isShockwave: true, targetScale: HE_SPLASH * 0.85 });

    for (let k = 0; k < 6; k++) {
        const angle = (k / 6) * Math.PI * 2;
        const dist = 0.3 + Math.random() * HE_SPLASH;
        const spark = new THREE.Mesh(
            new THREE.SphereGeometry(0.06 + Math.random() * 0.1, 4, 4),
            new THREE.MeshBasicMaterial({ color: '#ffaa00', transparent: true, opacity: 0.9 })
        );
        spark.position.set(ep.x + Math.cos(angle) * dist, ep.y + 0.3 + Math.random() * 1.2, ep.z + Math.sin(angle) * dist);
        scene.add(spark);
        const spLife = 0.3 + Math.random() * 0.4;
        ringFX.push({ mesh: spark, life: spLife, maxLife: spLife });
    }

    const fragMat = new THREE.MeshStandardMaterial({ color: '#ff6600', roughness: 0.4, metalness: 0.2, emissive: '#ff4400', emissiveIntensity: 1.5 });
    for (let i = 0; i < 8; i++) {
        const geo = new THREE.BoxGeometry(0.06 + Math.random() * 0.12, 0.06 + Math.random() * 0.12, 0.06 + Math.random() * 0.12);
        const f = new THREE.Mesh(geo, fragMat);
        f.position.copy(ep);
        f.position.y += 0.3;
        const vx = (Math.random() - 0.5) * 5, vy = 2 + Math.random() * 4, vz = (Math.random() - 0.5) * 5;
        f.userData = { vel: new THREE.Vector3(vx, vy, vz), rot: new THREE.Vector3(Math.random()*8, Math.random()*8, Math.random()*8) };
        scene.add(f);
        ringFX.push({ mesh: f, life: 0.8 + Math.random() * 0.6, maxLife: 1.4, isFrag: true });
    }
}

function checkChainExplosion(explosionPos) {
    const chainRadius = EXPLOSION_RADIUS;
    const chainRadiusSq = chainRadius * chainRadius;

    for (let i = obstacleData.length - 1; i >= 0; i--) {
        const od = obstacleData[i];
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
                obs.traverse(c => { if (c.geometry) c.geometry.dispose(); if (c.material) c.material.dispose(); });
                const meshIdx = obstacleMeshes.indexOf(obs);
                if (meshIdx >= 0) obstacleMeshes.splice(meshIdx, 1);
            } else if (od.type && od.type !== 'building') {
                disposeTreeInstance(od);
            }
            obstacleData.splice(i, 1);
        }
    }
}
