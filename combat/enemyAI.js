/**
 * 敌人 AI 系统 — PvE 战斗模式
 * v0.26.0 完整实现
 *
 * 状态机：PATROL → CHASE → ENGAGE → PATROL/FLEE
 * 被动模式(reactive): PATROL 不主动探测玩家，受击后才切换 CHASE
 */

(function() {

    const AI_STATE = { PATROL:'patrol', CHASE:'chase', ENGAGE:'engage', FLEE:'flee', DEAD:'dead' };

    // ─── 通用工具 ───
    function moveToward(cur, target, step) {
        if (Math.abs(target - cur) < step) return target;
        return cur + Math.sign(target - cur) * step;
    }

    function angleDiff(a, b) {
        let d = b - a;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        return d;
    }

    // ─── 视野检测 ───
    function canSeeTarget(enemy, target, coneAngle, maxDist, scene) {
        if (!target || target.hp <= 0) return false;
        const ePos = enemy.position.clone();
        const tPos = target.position.clone();
        const dist = ePos.distanceTo(tPos);
        if (dist > maxDist) return false;

        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(enemy.quaternion);
        const toTarget = tPos.sub(ePos).normalize();
        const dot = forward.dot(toTarget);
        return dot >= Math.cos(coneAngle);
        // Raycaster 遮挡检测留空，后期可接入 obstacles 数组
    }

    // ─── 获取离敌人最近的存活玩家 ───
    function findNearestPlayer(enemy, players) {
        let best = null, bestD = Infinity;
        for (const p of players) {
            if (!p || p.hp <= 0 || p.dead) continue;
            const d = enemy.position.distanceTo(p.group.position);
            if (d < bestD) { bestD = d; best = p; }
        }
        return { player: best, dist: bestD };
    }

    // ─── 移动敌人（世界坐标导航 + 障碍物简易避让） ───
    function moveEnemyToward(enemy, targetX, targetZ, speed, dt) {
        const dx = targetX - enemy.position.x;
        const dz = targetZ - enemy.position.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist < 0.5) { enemy.position.set(targetX, enemy.position.y, targetZ); return true; } // 到达

        const nx = dx / dist, nz = dz / dist;
        const step = Math.min(speed * dt, dist);
        enemy.position.x += nx * step;
        enemy.position.z += nz * step;

        // 旋转面向移动方向
        const targetYaw = Math.atan2(nz, nx) + Math.PI / 2;
        const curYaw = Math.atan2(
            2 * enemy.quaternion.y * enemy.quaternion.w + 2 * enemy.quaternion.x * enemy.quaternion.z,
            1 - 2 * enemy.quaternion.y * enemy.quaternion.y - 2 * enemy.quaternion.z * enemy.quaternion.z
        ); // 简化取 yaw（假设 X/Z 平面旋转）
        // 更简单的方法：直接算 group 的旋转
        const ad = angleDiff(curYaw, targetYaw);
        const rotSpeed = 3.0; // rad/s
        const rotStep = Math.min(Math.abs(ad), rotSpeed * dt) * Math.sign(ad);
        enemy.rotation.y += rotStep;

        return false; // 未到达
    }

    // ─── 炮塔瞄准（旋转 turretPivot 使喷火管对准目标） ───
    function aimTurretAt(enemy, targetWorldPos, dt, turnSpeed) {
        const tp = enemy.userData && enemy.userData.turretPivot;
        if (!tp) return;
        // 计算从炮塔中心指向目标的方向（世界坐标系）
        const turretWorldPos = new THREE.Vector3();
        tp.getWorldPosition(turretWorldPos);
        const dx = targetWorldPos.x - turretWorldPos.x;
        const dz = targetWorldPos.z - turretWorldPos.z;
        const targetAngle = Math.atan2(dx, -dz); // 初始朝前(0,0,-1)为基准

        const curAngle = tp.rotation.y;
        const ad = angleDiff(curAngle, targetAngle);
        const step = Math.min(Math.abs(ad), (turnSpeed || 3.0) * dt) * Math.sign(ad);
        tp.rotation.y += step;
        return Math.abs(ad) < 0.1; // 是否已瞄准
    }

    // ==================== 状态处理函数 ====================

    // ── PATROL: 沿路径点移动 ──
    function updatePatrol(enemy, ai, cfg, dt) {
        if (!cfg.patrolPath || cfg.patrolPath.length === 0) return;
        const wp = cfg.patrolPath[ai.patrolIndex];
        const arrived = moveEnemyToward(enemy, wp[0], wp[1], cfg.speed || 3.0, dt);
        if (arrived) {
            ai.patrolIndex = (ai.patrolIndex + 1) % cfg.patrolPath.length;
        }
    }

    // ── CHASE: 向玩家移动 ──
    function updateChase(enemy, ai, cfg, dt, nearestPlayer) {
        if (!nearestPlayer) { ai.state = AI_STATE.PATROL; return; }
        const pp = nearestPlayer.group.position;
        moveEnemyToward(enemy, pp.x, pp.z, cfg.speed || 5.0, dt);
        // 更新上次可见位置
        ai.lastSeenPlayerPos = pp.clone();
    }

    // ── ENGAGE: 瞄准 + 开火循环 ──
    function updateEngage(enemy, ai, cfg, dt, nearestPlayer) {
        if (!nearestPlayer) { ai.state = AI_STATE.CHASE; return; }
        const pp = nearestPlayer.group.position;
        const dist = enemy.position.distanceTo(pp);

        // 保持交战距离（太近后退，太远前进）
        const idealDist = cfg.engageDist || 15;
        if (dist < idealDist * 0.5) {
            // 后退
            const dx = enemy.position.x - pp.x;
            const dz = enemy.position.z - pp.z;
            const nd = Math.sqrt(dx * dx + dz * dz) || 1;
            moveEnemyToward(enemy,
                enemy.position.x + (dx / nd) * (cfg.speed || 5.0) * dt,
                enemy.position.z + (dz / nd) * (cfg.speed || 5.0) * dt,
                cfg.speed || 5.0, dt);
        } else if (dist > idealDist * 1.3) {
            // 逼近
            moveEnemyToward(enemy, pp.x, pp.z, cfg.speed || 5.0, dt);
        } else {
            // 侧移（横移绕圈）
            const dx = pp.x - enemy.position.x;
            const dz = pp.z - enemy.position.z;
            const nd = Math.sqrt(dx * dx + dz * dz) || 1;
            const perpX = -dz / nd, perpZ = dx / nd;
            const strafeDir = ai.strafeDir || 1;
            moveEnemyToward(enemy,
                enemy.position.x + perpX * strafeDir * (cfg.speed || 3.0) * dt * 0.5,
                enemy.position.z + perpZ * strafeDir * (cfg.speed || 3.0) * dt * 0.5,
                cfg.speed || 3.0, dt);
            // 周期性换向
            ai.strafeTimer = (ai.strafeTimer || 0) + dt;
            if (ai.strafeTimer > 2.5) { ai.strafeDir *= -1; ai.strafeTimer = 0; }
        }

        // 瞄准炮塔
        const aimed = aimTurretAt(enemy, pp, dt, 3.0);

        // 喷火器开火（瞄准后 + 距离足够）
        ai.flameTimer = (ai.flameTimer || 0) - dt;
        if (aimed && dist < (cfg.flameRange || 12) && ai.flameTimer <= 0) {
            ai.isFlaming = true;
            ai.flameTimer = cfg.ramCooldown || 0.8; // 喷火冷却
            ai.flameTicksLeft = cfg.flameTicks || 3;
        }

        // 喷火持续伤害
        if (ai.flameTicksLeft > 0 && ai.isFlaming) {
            ai.flameTickTimer = (ai.flameTickTimer || 0) - dt;
            if (ai.flameTickTimer <= 0) {
                ai.flameTickTimer = 0.15;
                ai.flameTicksLeft--;
                // 伤害由主循环在 index.html 中处理
                ai.flameRequest = true;
            }
            if (ai.flameTicksLeft <= 0) ai.isFlaming = false;
        }

        ai.lastSeenPlayerPos = pp.clone();
    }

    // ── FLEE: 逃离玩家 ──
    function updateFlee(enemy, ai, cfg, dt, nearestPlayer) {
        if (!nearestPlayer) { ai.state = AI_STATE.PATROL; return; }
        const pp = nearestPlayer.group.position;
        const dx = enemy.position.x - pp.x;
        const dz = enemy.position.z - pp.z;
        const nd = Math.sqrt(dx * dx + dz * dz) || 1;
        moveEnemyToward(enemy,
            enemy.position.x + (dx / nd) * (cfg.speed || 5.0) * dt * 1.2,
            enemy.position.z + (dz / nd) * (cfg.speed || 5.0) * dt * 1.2,
            cfg.speed || 5.0, dt);
    }

    // ==================== 主 AI 更新（每帧调用） ====================
    function updateEnemyAI(enemy, dt, players, scene) {
        if (!enemy.ai || enemy.ai.state === AI_STATE.DEAD) return;

        const ai = enemy.ai;
        const cfg = enemy.cfg || {};

        // 寻找最近的存活玩家
        const { player: nearestPlayer, dist: nearestDist } = findNearestPlayer(enemy, players);

        // 重置火焰请求标志
        ai.flameRequest = false;

        switch (ai.state) {
            case AI_STATE.PATROL:
                updatePatrol(enemy, ai, cfg, dt);
                // 非被动模式下自动检测玩家
                if (!cfg.reactive && nearestPlayer && canSeeTarget(enemy, nearestPlayer, Math.PI/4, cfg.viewDist || 60, scene)) {
                    ai.state = AI_STATE.CHASE;
                    ai.target = nearestPlayer;
                    ai.lastSeenPlayerPos = nearestPlayer.group.position.clone();
                    ai.alertTimer = 0;
                }
                break;

            case AI_STATE.CHASE:
                updateChase(enemy, ai, cfg, dt, nearestPlayer);
                if (nearestPlayer && nearestDist < (cfg.engageDist || 15)) {
                    ai.state = AI_STATE.ENGAGE;
                }
                // 丢失目标 > 5 秒 → 巡逻
                if (!nearestPlayer || nearestDist > cfg.viewDist * 1.5) {
                    ai.alertTimer = (ai.alertTimer || 0) + dt;
                    if (ai.alertTimer > 5) {
                        ai.state = AI_STATE.PATROL;
                        ai.alertTimer = 0;
                        ai.target = null;
                    }
                } else {
                    ai.alertTimer = 0;
                }
                break;

            case AI_STATE.ENGAGE:
                updateEngage(enemy, ai, cfg, dt, nearestPlayer);
                if (!nearestPlayer || nearestDist > cfg.engageDist * 2) {
                    ai.state = AI_STATE.CHASE;
                }
                if (cfg.canFlee && enemy.hp < cfg.hp * 0.25) {
                    ai.state = AI_STATE.FLEE;
                }
                break;

            case AI_STATE.FLEE:
                updateFlee(enemy, ai, cfg, dt, nearestPlayer);
                break;
        }
    }

    // ─── 敌人受击回调（由 index.html 炮弹碰撞检测调用） ───
    function onEnemyDamaged(enemy, damage, attacker) {
        if (!enemy || !enemy.ai) return;
        const ai = enemy.ai;

        enemy.hp = Math.max(0, enemy.hp - damage);

        // 受击触发迎击（被动还击模式）
        if (ai.state === AI_STATE.PATROL || ai.state === AI_STATE.FLEE) {
            ai.state = AI_STATE.CHASE;
            ai.target = attacker;
            if (attacker && attacker.group) {
                ai.lastSeenPlayerPos = attacker.group.position.clone();
            }
            ai.alertTimer = 0;
        }

        // 受击反馈 → 交由 index.html 处理（闪光/粒子）
        ai.hitFlash = 0.2; // 白色高亮 0.2 秒

        return enemy.hp <= 0;
    }

    // ─── 暴露到全局 ───
    window.EnemyAI = {
        AI_STATE,
        canSeeTarget,
        updateEnemyAI,
        onEnemyDamaged,
        findNearestPlayer,
    };

    console.log('🧠 敌人AI系统已就绪 | 状态机: PATROL→CHASE→ENGAGE→FLEE | 被动还击模式已支持');

})();
