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

        // 前端朝 -X，rotation.y=θ 时前向量 = (-cosθ, 0, sinθ)
        const forward = new THREE.Vector3(-Math.cos(enemy.rotation.y), 0, Math.sin(enemy.rotation.y));
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

    // ─── 移动敌人（车辆式：先转向再前进，不侧滑） ───
    // 模型前端朝向 -X（V型铲斗在 x=-1.08），rotation.y=0 时车头指向世界 -X
    function moveEnemyToward(enemy, targetX, targetZ, speed, dt) {
        const dx = targetX - enemy.position.x;
        const dz = targetZ - enemy.position.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist < 0.5) { enemy.position.set(targetX, enemy.position.y, targetZ); return true; } // 到达

        // 1. 计算敌人当前朝向（前端朝 -X，rotation.y=θ 时前向量 = (-cosθ, 0, sinθ)）
        const curYaw = enemy.rotation.y;
        const forwardX = -Math.cos(curYaw);
        const forwardZ =  Math.sin(curYaw);

        // 2. 计算目标方向角（使 -X 指向目标）
        const targetYaw = Math.atan2(dz, -dx);

        // 3. 先转向（差速驱动：原地转向目标）
        const rotSpeed = 3.0; // rad/s
        let ad = angleDiff(curYaw, targetYaw);
        const rotStep = Math.min(Math.abs(ad), rotSpeed * dt) * Math.sign(ad);
        enemy.rotation.y += rotStep;

        // 4. 只有朝向与目标方向偏差 < 90° 时才前进（否则只转向）
        const facingDot = forwardX * (dx / dist) + forwardZ * (dz / dist);
        if (facingDot > 0) {
            const step = Math.min(speed * dt, dist);
            // 沿车身前方移动（转向后的新朝向）
            const newFwdX = -Math.cos(enemy.rotation.y);
            const newFwdZ =  Math.sin(enemy.rotation.y);
            enemy.position.x += newFwdX * step;
            enemy.position.z += newFwdZ * step;
        }

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
        // 世界空间中，使 -X 对准目标所需的角度
        const worldTargetAngle = Math.atan2(dz, -dx);
        // 炮塔是 enemy 的子节点，其世界旋转 = enemy.rotation.y + tp.rotation.y
        // 所以 tp.rotation.y = worldTargetAngle - enemy.rotation.y
        const localTargetAngle = worldTargetAngle - enemy.rotation.y;

        const curAngle = tp.rotation.y;
        const ad = angleDiff(curAngle, localTargetAngle);
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

    // ── CHASE: 追击玩家（全速直追） ──
    function updateChase(enemy, ai, cfg, dt, nearestPlayer) {
        if (!nearestPlayer) { ai.state = AI_STATE.PATROL; return; }
        const pp = nearestPlayer.group.position;
        // 追击用全速（速度×1.3，比巡逻/绕圈更快）
        moveEnemyToward(enemy, pp.x, pp.z, (cfg.speed || 5.0) * 1.3, dt);
        ai.lastSeenPlayerPos = pp.clone();
    }

    // ── ENGAGE: 弧线绕圈 + 瞄准 + 开火循环（车体沿切线驱动，炮塔独立瞄准） ──
    function updateEngage(enemy, ai, cfg, dt, nearestPlayer) {
        if (!nearestPlayer) { ai.state = AI_STATE.CHASE; return; }
        const pp = nearestPlayer.group.position;
        const dist = enemy.position.distanceTo(pp);
        // 绕圈理想距离 = 取地图配置 engageDist 和 武器射程×75% 的较小值
        // 确保敌人在可攻击范围内绕圈（不会在射程外空转）
        const weaponRange = cfg.flameRange || 12;
        const idealDist = Math.min(cfg.engageDist || 15, weaponRange * 0.75);
        const speed = cfg.speed || 5.0;

        // 切线方向（垂直于玩家连线，沿圆环绕行）和径向方向
        const dx = pp.x - enemy.position.x;
        const dz = pp.z - enemy.position.z;
        const nd = Math.sqrt(dx * dx + dz * dz) || 1;
        const strafeDir = ai.strafeDir || 1;
        const tanX = -dz / nd * strafeDir;
        const tanZ =  dx / nd * strafeDir;
        const radX = -dx / nd; // 径向远离玩家
        const radZ = -dz / nd;

        // 混合径向（距控）和切向（绕圈）
        let radialW = 0, tangentW = 0.55;
        if (dist < idealDist * 0.6) {
            // 太近：后退优先
            radialW = 1.0; tangentW = 0.0;
        } else if (dist > idealDist * 1.3) {
            // 偏远：优先逼近（径向权重负=靠近，切向削弱）
            radialW = -1.0; tangentW = 0.15;
        }
        // 理想距离内：主绕圈

        const moveX = tanX * tangentW + radX * radialW;
        const moveZ = tanZ * tangentW + radZ * radialW;
        const mn = Math.sqrt(moveX * moveX + moveZ * moveZ) || 1;

        // 1. 车体转向：朝向移动方向（履带车辆物理约束）
        const targetYaw = Math.atan2(moveZ / mn, -(moveX / mn));
        const rotSpeed = 3.0;
        const ad = angleDiff(enemy.rotation.y, targetYaw);
        const rotStep = Math.min(Math.abs(ad), rotSpeed * dt) * Math.sign(ad);
        enemy.rotation.y += rotStep;

        // 2. 沿车体前方驱动（不侧滑）
        const facingDot = -Math.cos(enemy.rotation.y) * (moveX / mn) + Math.sin(enemy.rotation.y) * (moveZ / mn);
        if (facingDot > 0.2) {
            const step = speed * dt * Math.min(1.0, Math.abs(facingDot));
            enemy.position.x += -Math.cos(enemy.rotation.y) * step;
            enemy.position.z +=  Math.sin(enemy.rotation.y) * step;
        }

        // 周期性换向（~2.5秒变换绕圈方向）
        ai.strafeTimer = (ai.strafeTimer || 0) + dt;
        if (ai.strafeTimer > 2.5) { ai.strafeDir *= -1; ai.strafeTimer = 0; }

        // 3. 炮塔独立瞄准玩家
        const aimed = aimTurretAt(enemy, pp, dt, 4.0);

        // 喷火器开火
        ai.flameTimer = (ai.flameTimer || 0) - dt;
        if (aimed && dist < (cfg.flameRange || 12) && ai.flameTimer <= 0) {
            ai.isFlaming = true;
            ai.flameTimer = cfg.ramCooldown || 1.2;
            ai.flameTicksLeft = cfg.flameTicks || 5;
        }

        // 喷火持续伤害
        // v0.26.3fix: isFlaming 由 damage 代码在 index.html 中关闭，确保最后一个 tick 不丢失
        if (ai.flameTicksLeft > 0 && ai.isFlaming) {
            ai.flameTickTimer = (ai.flameTickTimer || 0) - dt;
            if (ai.flameTickTimer <= 0) {
                ai.flameTickTimer = 0.15;
                ai.flameTicksLeft--;
                ai.flameRequest = true;
            }
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
                // 逼近到武器射程内 → 进入绕圈战斗
                // 阈值 = 0.85×武器射程，保证进入 ENGAGE 时已在攻击距离内
                {
                    const wr = cfg.flameRange || 12;
                    if (nearestPlayer && nearestDist < wr * 0.85) {
                        ai.state = AI_STATE.ENGAGE;
                    }
                }
                // 丢失目标 > 8 秒 → 返回巡逻
                if (!nearestPlayer || nearestDist > (cfg.viewDist || 60) * 1.5) {
                    ai.alertTimer = (ai.alertTimer || 0) + dt;
                    if (ai.alertTimer > 8) {
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
                // 玩家跑远超出武器射程1.3倍 → 追击
                {
                    const wr = cfg.flameRange || 12;
                    if (!nearestPlayer || nearestDist > wr * 1.3) {
                        ai.state = AI_STATE.CHASE;
                    }
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
