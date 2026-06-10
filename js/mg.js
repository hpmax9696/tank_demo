var MG_DETECT_RANGE = 35;
var MG_RANGE = 25;
var MG_DAMAGE = 2;
var MG_FIRE_RATE = 10;
var MG_FIRE_INTERVAL = 1 / MG_FIRE_RATE;
var MG_OVERHEAT_TIME = 6.0;
var MG_COOLDOWN_TIME = 2.0;
var MG_BULLET_SPEED = 250;
var MG_BULLET_LIFE = 0.12;
var MG_ANG_VEL = 30;

var mgBullets = [];
var mgTimer = 0;
var mgHeat = 0;
var mgOverheated = false;

function createMGBullet(origin, targetPos, travelDist) {
    const dir = new THREE.Vector3().subVectors(targetPos, origin).normalize();
    const geo = new THREE.CylinderGeometry(0.06, 0.06, 0.30, 6);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffff44, transparent: true, opacity: 1 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(origin);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    mesh.setRotationFromQuaternion(q);
    const trailGeo = new THREE.SphereGeometry(0.08, 6, 3);
    const trailMat = new THREE.MeshBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 0.8 });
    const trail = new THREE.Mesh(trailGeo, trailMat);
    trail.position.set(0, -0.16, 0);
    mesh.add(trail);
    scene.add(mesh);
    return { mesh, vel: dir.clone().multiplyScalar(MG_BULLET_SPEED), origin: origin.clone(),
        life: MG_BULLET_LIFE, maxLife: MG_BULLET_LIFE, travelDist: travelDist, travelled: 0 };
}

function updateMGAutoTarget(player, dt) {
    if (!player || player.dead) {
        player.mgLockTarget = null;
        mgHeat = Math.max(0, mgHeat - dt * 2);
        if (mgHeat <= 0) mgOverheated = false;
        return;
    }
    if (gameMode === 'versus') return;

    if (player.mgLockTarget) {
        const en = player.mgLockTarget;
        const alive = en && en.ai && en.ai.state !== 'dead';
        const inRange = alive && player.group.position.distanceTo(en.position) <= MG_RANGE;
        if (!alive || !inRange) {
            player.mgLockTarget = null;
        }
    }

    if (!player.mgLockTarget) {
        let nearest = null, nearestDist = Infinity;
        const pPos = player.group.position;
        for (const enemy of enemies) {
            if (!enemy || !enemy.ai || enemy.ai.state === 'dead') continue;
            const d = pPos.distanceTo(enemy.position);
            if (d < MG_DETECT_RANGE && d < nearestDist) { nearestDist = d; nearest = enemy; }
        }
        if (!nearest || nearestDist > MG_RANGE) {
            mgHeat = Math.max(0, mgHeat - dt * 2);
            if (mgHeat <= 0) mgOverheated = false;
            return;
        }
        player.mgLockTarget = nearest;
    }

    const target = player.mgLockTarget;
    const dist = player.group.position.distanceTo(target.position);
    if (dist > MG_RANGE) { player.mgLockTarget = null; return; }

    if (mgOverheated) { mgHeat = Math.max(0, mgHeat - dt); if (mgHeat <= 0) mgOverheated = false; return; }

    const targetWorld = target.position.clone();
    targetWorld.y += (target.cfg && target.cfg.type === 'zombie') ? 0.8 : 1.0;

    const mgOrigin = new THREE.Vector3(0, 0.295, 0.57);
    if (player.mgGroup) {
        player.mgGroup.localToWorld(mgOrigin);
    } else {
        player.group.localToWorld(mgOrigin);
    }

    const mgParent = player.mgGroup ? player.mgGroup.parent : player.group;
    const mgLocalOrigin = mgParent.worldToLocal(mgOrigin.clone());
    const mgLocalTarget = mgParent.worldToLocal(targetWorld.clone());
    const localDir = new THREE.Vector3().subVectors(mgLocalTarget, mgLocalOrigin).normalize();

    const targetYaw = Math.atan2(localDir.x, localDir.z);
    const horizDist = Math.sqrt(localDir.x * localDir.x + localDir.z * localDir.z);
    const targetElev = Math.atan2(localDir.y, horizDist);

    player.mgYaw = angleMoveToward(player.mgYaw, targetYaw, MG_ANG_VEL * dt);
    player.mgElev = angleMoveToward(player.mgElev, targetElev, MG_ANG_VEL * dt);

    mgTimer -= dt;
    if (mgTimer > 0) return;
    mgTimer = MG_FIRE_INTERVAL;
    mgHeat += MG_FIRE_INTERVAL;
    if (mgHeat >= MG_OVERHEAT_TIME) { mgOverheated = true; mgHeat = MG_OVERHEAT_TIME; return; }

    playMGShotSound();

    const epos = target.position.clone();
    const dir = new THREE.Vector3().subVectors(epos, mgOrigin).normalize();
    const raycaster = new THREE.Raycaster(mgOrigin, dir, 0, MG_RANGE);
    const excludeList = [];
    if (player && player.group) player.group.traverse(c => { if (c.isMesh || c.isGroup) excludeList.push(c); });
    const hitTargets = [...scene.children];
    if (groundPlane && !hitTargets.includes(groundPlane)) hitTargets.push(groundPlane);
    const hits = raycaster.intersectObjects(hitTargets, true).filter(h => !excludeList.includes(h.object));

    let hitDist = Math.min(MG_RANGE, dist);
    let hitEnemyFound = false;
    for (const hit of hits) {
        let obj = hit.object;
        while (obj) {
            let foundEnemy = false;
            for (const en of enemies) {
                if (obj === en || obj === en.userData?.turretPivot || obj === en.userData?.hpBarGroup) {
                    foundEnemy = true;
                    if (en.hp !== undefined && en.ai && en.ai.state !== 'dead') {
                        const killed = window.EnemyAI.onEnemyDamaged(en, MG_DAMAGE, player1);
                        window.EnemyAI.shareAggro(en, player1, enemies, 40);
                        const hitWorldPos = hit.point.clone();
                        spawnSilentHitSparks(hitWorldPos);
                        if (killed) {
                            const isZombie = (en.cfg && en.cfg.type === 'zombie');
                            const isHex = (en.cfg && en.cfg.type === 'hexapod');
                            if (isZombie) {
                                en.ai.state = 'dead';
                            } else if (isHex) {
                                // 训练场六足: 走重生队列, 不移除实体
                                if (window._killEnemyInTraining) { window._killEnemyInTraining(en); }
                                else { en.ai.state = 'dead'; en.visible = false; }
                            } else {
                                en.ai.state = 'dead';
                                en.visible = false;
                                if (en.userData.flameEffect) {
                                    en.userData.flameEffect.active = false;
                                    en.userData.flameEffect.points.visible = false;
                                }
                                const ep = en.position.clone(); ep.y += 0.8;
                                spawnFragments(ep, '#8B7D4A');
                                spawnExplosion(ep);
                                playExplosionSound();
                                if (combatData) combatData.score += (en.cfg.score || 100);
                                spawnPickup(en);
                                const deadEnemy = en;
                                setTimeout(() => {
                                    if (deadEnemy.parent) deadEnemy.parent.remove(deadEnemy);
                                    deadEnemy.traverse(c => { if (c.geometry) c.geometry.dispose(); if (c.material) c.material.dispose(); });
                                    if (deadEnemy.userData.flameEffect) deadEnemy.userData.flameEffect.dispose();
                                    const idx = enemies.indexOf(deadEnemy);
                                    if (idx >= 0) enemies.splice(idx, 1);
                                }, 300);
                                if (enemies.every(e => e.ai && e.ai.state === 'dead')) {
                                    setTimeout(() => {
                                        if (combatData) {
                                            const result = window.ScoreSystem.settleScore(selectedMapId || 'test_map_03a', combatData.score);
                                            hintBar.textContent = '🎉 已清场! 得分:' + combatData.score +
                                                (result.isNewHigh ? ' 🏆新纪录!' : '') + ' | 按ESC返回菜单';
                                        }
                                    }, 1500);
                                }
                            }
                        }
                    }
                    hitEnemyFound = true;
                    break;
                }
            }
            if (hitEnemyFound) { hitDist = hit.distance; break; }
            obj = obj.parent;
        }
        if (hitEnemyFound) break;
        hitDist = Math.min(hitDist, hit.distance);
    }

    const bullet = createMGBullet(mgOrigin, epos, hitDist);
    mgBullets.push(bullet);
}

function updateMGBullets(dt) {
    for (let i = mgBullets.length - 1; i >= 0; i--) {
        const b = mgBullets[i];
        b.life -= dt;
        if (b.life <= 0 || b.travelled >= b.travelDist) {
            scene.remove(b.mesh);
            b.mesh.traverse(c => { if (c !== b.mesh) { if (c.geometry) c.geometry.dispose(); if (c.material) c.material.dispose(); } });
            b.mesh.geometry.dispose(); b.mesh.material.dispose();
            mgBullets.splice(i, 1);
            continue;
        }
        const step = b.vel.clone().multiplyScalar(dt);
        b.mesh.position.add(step);
        b.travelled += step.length();
        const lr = Math.max(0, b.life / b.maxLife);
        b.mesh.material.opacity = lr;
        if (b.mesh.children.length > 0 && b.mesh.children[0].material) b.mesh.children[0].material.opacity = 0.7 * lr;
    }
}
