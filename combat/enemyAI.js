/**
 * 敌人 AI 系统 — PvE 战斗模式
 * v0.28.0 重写丧尸8状态机（IDLE/PATROL/ALERT/PURSUIT/SEARCH/ATTACK/STAGGER/DEAD）
 *
 * 车辆状态机：PATROL → CHASE → ENGAGE → PATROL/FLEE
 * 丧尸状态机：IDLE → PATROL → ALERT → PURSUIT → SEARCH/ATTACK → STAGGER → DEAD
 * 被动模式(reactive): PATROL 不主动探测玩家，受击后才切换 PURSUIT
 */

(function() {

    // 车辆 AI 状态（保持兼容）
    const AI_STATE = { PATROL:'patrol', CHASE:'chase', ENGAGE:'engage', FLEE:'flee', STUNNED:'stunned', DEAD:'dead' };

    // ─── 丧尸专用 8 状态机 ───
    const ZS = {
        IDLE:    'idle',
        PATROL:  'patrol',
        ALERT:   'alert',     // 发现异常→转向确认
        PURSUIT: 'pursuit',   // 全速追击
        SEARCH:  'search',    // 丢失目标→最后目击点搜索
        ATTACK:  'attack',    // 近战攻击
        STAGGER: 'stagger',   // 受击硬直
        DEAD:    'dead',
    };

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
        // v0.26.4fix: 防止 NaN/零 dt 导致敌人卡住（首帧 clock 未就绪等异常）
        if (!dt || dt <= 0 || isNaN(dt)) return false;
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

        // 4. 边转边前进（v0.26.4fix: 门槛从>0放宽到>-0.8，允许偏差<143°时同
        //    时移动+转向，避免大角度掉头时原地旋转超过0.8秒不前进）
        const facingDot = forwardX * (dx / dist) + forwardZ * (dz / dist);
        if (facingDot > -0.8) {
            // 步长按朝向对齐度缩放：正对时全速，90°偏角时半速，极限143°时微速
            const alignment = Math.max(0.15, (facingDot + 0.8) / 1.8);
            const step = Math.min(speed * dt * alignment, dist);
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
        const beforeX = enemy.position.x, beforeZ = enemy.position.z;
        const arrived = moveEnemyToward(enemy, wp[0], wp[1], cfg.speed || 3.0, dt);
        if (arrived) {
            ai.patrolIndex = (ai.patrolIndex + 1) % cfg.patrolPath.length;
            ai.wpStuckTimer = 0;
        } else {
            // v0.26.5fix: 障碍物卡住检测 — 位移极小说明被障碍物挡住
            const moved = Math.abs(enemy.position.x - beforeX) + Math.abs(enemy.position.z - beforeZ);
            if (moved < 0.02) {
                ai.wpStuckTimer = (ai.wpStuckTimer || 0) + dt;
                if (ai.wpStuckTimer > 3.0) {
                    // 超过3秒无法接近路径点，跳过此点
                    ai.patrolIndex = (ai.patrolIndex + 1) % cfg.patrolPath.length;
                    ai.wpStuckTimer = 0;
                }
            } else {
                ai.wpStuckTimer = 0;
            }
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

    // ── 丧尸专用：移动（步行）──
    // 丧尸模型前端朝向 +Z，rotation.y=0 时面向 +Z
    function moveZombieToward(enemy, targetX, targetZ, speed, dt) {
        if (!dt || dt <= 0 || isNaN(dt)) return false;
        const dx = targetX - enemy.position.x;
        const dz = targetZ - enemy.position.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist < 0.3) return true;

        // 丧尸前端朝 +Z 时：worldForward = (sin(rotY), 0, cos(rotY))
        // 目标方向角：让 sin(rotY)=dx/dist, cos(rotY)=dz/dist → rotY = atan2(dx, dz)
        const targetYaw = Math.atan2(dx, dz);
        const curYaw = enemy.rotation.y;
        const rotSpeed = 4.0;
        let ad = angleDiff(curYaw, targetYaw);
        const rotStep = Math.min(Math.abs(ad), rotSpeed * dt) * Math.sign(ad);
        enemy.rotation.y += rotStep;

        // 前进（沿目标方向移动，不依赖局部坐标）
        const forwardDot = Math.cos(curYaw - targetYaw);
        if (forwardDot > -0.5) {
            const alignment = Math.max(0.3, (forwardDot + 0.5) / 1.5);
            const step = Math.min(speed * dt * alignment, dist);
            enemy.position.x += (dx / dist) * step;
            enemy.position.z += (dz / dist) * step;
        }
        return false;
    }

    // ── 丧尸近战攻击检测 ──
    function canZombieAttack(enemy, player, attackDist) {
        if (!player || player.dead) return false;
        const dist = enemy.position.distanceTo(player.group.position);
        return dist < (attackDist || 2.0);
    }

    // ==================== 主 AI 更新（每帧调用） ====================
    function updateEnemyAI(enemy, dt, players, scene) {
        if (!enemy.ai || enemy.ai.state === AI_STATE.DEAD) return;

        const ai = enemy.ai;
        const cfg = enemy.cfg || {};
        const isZombie = (cfg.type === 'zombie' || (enemy.userData && enemy.userData.enemyType === 'zombie'));

        // 寻找最近的存活玩家
        const { player: nearestPlayer, dist: nearestDist } = findNearestPlayer(enemy, players);

        // 重置请求标志
        ai.flameRequest = false;

        if (isZombie) {
            // ═══════════════════════════════════════════
            //  丧尸专用 8 状态 AI 状态机 (v0.28.0)
            // ═══════════════════════════════════════════

            // STAGGER/DEAD 状态由 gameLoop 管理恢复逻辑
            if (ai.state === ZS.STAGGER) {
                ai.animRequest = 'hit';
                return;
            }
            if (ai.state === ZS.DEAD) {
                ai.animRequest = 'death';
                return;
            }

            switch (ai.state) {

                // ── IDLE: 站立发呆，各自不同时长（1.5~4.5s），避免整齐划一 ──
                case ZS.IDLE:
                    if (!ai.idleDuration) ai.idleDuration = 1.5 + Math.random() * 3.0;
                    ai.idleTimer = (ai.idleTimer || 0) + dt;
                    if (ai.idleTimer > ai.idleDuration) {
                        ai.state = ZS.PATROL;
                        ai.idleTimer = 0;
                        ai.idleDuration = 0;
                        ai.patrolIndex = 0;
                    }
                    ai.animRequest = 'idle';
                    break;

                // ── PATROL: 沿路径点走动，到达节点时随机暂停 ──
                case ZS.PATROL:
                    if (cfg.patrolPath && cfg.patrolPath.length > 0) {
                        const wp = cfg.patrolPath[ai.patrolIndex];
                        moveZombieToward(enemy, wp[0], wp[1], cfg.speed || 1.5, dt);
                        const dx = wp[0] - enemy.position.x;
                        const dz = wp[1] - enemy.position.z;
                        if (dx * dx + dz * dz < 1.0) {
                            // 20% 概率暂停发呆，否则按顺序走向下一节点
                            if (Math.random() < 0.2) {
                                ai.state = ZS.IDLE;
                                ai.idleTimer = 0;
                                ai.idleDuration = 0.8 + Math.random() * 1.8;  // 0.8~2.6s
                            } else {
                                ai.patrolIndex = (ai.patrolIndex + 1) % cfg.patrolPath.length;
                            }
                        }
                    }
                    ai.animRequest = 'walk';

                    // 发现玩家 → ALERT（短暂停顿确认）
                    if (!cfg.reactive && nearestPlayer && nearestDist < (cfg.viewDist || 22)) {
                        ai.state = ZS.ALERT;
                        ai.target = nearestPlayer;
                        ai.alertTimer = 0;
                        ai.lastSeenPlayerPos = nearestPlayer.group.position.clone();
                    }
                    break;

                // ── ALERT: 转向目标方向，短暂停顿确认（0.5s）─
                case ZS.ALERT:
                    ai.alertTimer = (ai.alertTimer || 0) + dt;
                    // 转向发现方向
                    if (ai.lastSeenPlayerPos) {
                        const adx = ai.lastSeenPlayerPos.x - enemy.position.x;
                        const adz = ai.lastSeenPlayerPos.z - enemy.position.z;
                        const atargetYaw = Math.atan2(adx, adz);
                        const acurYaw = enemy.rotation.y;
                        const aad = angleDiff(acurYaw, atargetYaw);
                        const arotStep = Math.min(Math.abs(aad), 3.0 * dt) * Math.sign(aad);
                        enemy.rotation.y += arotStep;
                    }
                    ai.animRequest = 'idle'; // 静止转向（不走路）

                    // 0.5s 后评估
                    if (ai.alertTimer > 0.5) {
                        // 重新检测：玩家是否仍在视野内
                        const { player: rePlayer, dist: reDist } = findNearestPlayer(enemy, players);
                        if (rePlayer && reDist < (cfg.viewDist || 22)) {
                            // 确认 → 全速追击
                            ai.state = ZS.PURSUIT;
                            ai.target = rePlayer;
                            ai.lastSeenPlayerPos = rePlayer.group.position.clone();
                            ai.alertTimer = 0;
                        } else {
                            // 误报 → 回到巡逻
                            ai.state = ZS.PATROL;
                            ai.alertTimer = 0;
                            ai.target = null;
                        }
                    }
                    break;

                // ── PURSUIT: 全速追击（原 CHASE）─
                case ZS.PURSUIT:
                    if (nearestPlayer) {
                        moveZombieToward(enemy,
                            nearestPlayer.group.position.x,
                            nearestPlayer.group.position.z,
                            (cfg.speed || 1.5) * 2.5, dt);
                        ai.lastSeenPlayerPos = nearestPlayer.group.position.clone();
                        // 进入攻击距离
                        if (nearestDist < (cfg.attackDist || 2.0)) {
                            ai.state = ZS.ATTACK;
                            ai.atkReady = true;
                            ai.atkCooldown = 0;
                        }
                    }
                    ai.animRequest = 'run';

                    // 丢失目标 → SEARCH（最后目击位置）
                    if (!nearestPlayer || nearestDist > (cfg.viewDist || 22) * 2.0) {
                        ai.lostTargetTimer = (ai.lostTargetTimer || 0) + dt;
                        if (ai.lostTargetTimer > 5) {
                            ai.state = ZS.SEARCH;
                            ai.searchTimer = 0;
                            ai.lostTargetTimer = 0;
                            ai.target = null;
                        }
                    } else {
                        ai.lostTargetTimer = 0;
                    }
                    break;

                // ── SEARCH: 丢失目标后搜索最后目击位置 ──
                case ZS.SEARCH:
                    ai.searchTimer = (ai.searchTimer || 0) + dt;
                    // 走向最后目击位置
                    if (ai.lastSeenPlayerPos) {
                        moveZombieToward(enemy,
                            ai.lastSeenPlayerPos.x,
                            ai.lastSeenPlayerPos.z,
                            cfg.speed || 2.5, dt);
                        // 到达附近或超时 → 返回巡逻
                        const sdToLast = enemy.position.distanceTo(ai.lastSeenPlayerPos);
                        if (sdToLast < 2.0 || ai.searchTimer > 4.0) {
                            ai.state = ZS.PATROL;
                            ai.searchTimer = 0;
                            ai.lastSeenPlayerPos = null;
                        }
                    } else {
                        ai.state = ZS.PATROL;
                        ai.searchTimer = 0;
                    }
                    ai.animRequest = 'walk';

                    // 搜索途中重新发现玩家 → 追击
                    if (nearestPlayer && nearestDist < (cfg.viewDist || 22)) {
                        ai.state = ZS.PURSUIT;
                        ai.target = nearestPlayer;
                        ai.searchTimer = 0;
                        ai.lostTargetTimer = 0;
                        ai.lastSeenPlayerPos = nearestPlayer.group.position.clone();
                    }
                    break;

                // ── ATTACK: 近战挥击（原 ENGAGE）─
                case ZS.ATTACK:
                    if (nearestPlayer) {
                        const pDist = enemy.position.distanceTo(nearestPlayer.group.position);
                        if (pDist < (cfg.attackDist || 2.0) && ai.atkReady) {
                            // 触发挥击
                            ai.animAtkStart = Date.now() / 1000;
                            ai.animHitApplied = false;
                            ai.atkReady = false;
                            ai.atkCooldown = (cfg.attackCooldown || 2.0);
                        } else if (!ai.atkReady) {
                            // 冷却倒计时
                            ai.atkCooldown = (ai.atkCooldown || 0) - dt;
                            if (ai.atkCooldown <= 0) {
                                ai.atkReady = true;
                                ai.atkCooldown = 0;
                            }
                            // 冷却中仍靠近（缓慢）
                            if (pDist > (cfg.attackDist || 2.0) * 0.6) {
                                moveZombieToward(enemy,
                                    nearestPlayer.group.position.x,
                                    nearestPlayer.group.position.z,
                                    (cfg.speed || 2.5) * 0.6, dt);
                            }
                        } else {
                            // 靠近玩家
                            moveZombieToward(enemy,
                                nearestPlayer.group.position.x,
                                nearestPlayer.group.position.z,
                                cfg.speed || 2.5, dt);
                        }
                    }
                    ai.animRequest = ai.atkReady ? 'walk' : 'attack';

                    // 玩家跑远 → 重新追击
                    if (!nearestPlayer || nearestDist > (cfg.attackDist || 2.0) * 1.5) {
                        ai.state = ZS.PURSUIT;
                        ai.lostTargetTimer = 0;
                    }
                    break;
            }
        } else {
            // ── 原有车辆 AI ──
            switch (ai.state) {
                case AI_STATE.PATROL:
                    updatePatrol(enemy, ai, cfg, dt);
                    if (!cfg.reactive && nearestPlayer && canSeeTarget(enemy, nearestPlayer, Math.PI/4, cfg.viewDist || 60, scene)) {
                        ai.state = AI_STATE.CHASE;
                        ai.target = nearestPlayer;
                        ai.lastSeenPlayerPos = nearestPlayer.group.position.clone();
                        ai.alertTimer = 0;
                    }
                    break;

                case AI_STATE.CHASE:
                    updateChase(enemy, ai, cfg, dt, nearestPlayer);
                    {
                        const wr = cfg.flameRange || 12;
                        if (nearestPlayer && nearestDist < wr * 0.85) {
                            ai.state = AI_STATE.ENGAGE;
                        }
                    }
                    if (!nearestPlayer || nearestDist > (cfg.viewDist || 60) * 1.5) {
                        ai.alertTimer = (ai.alertTimer || 0) + dt;
                        if (ai.alertTimer > 8) {
                            ai.state = AI_STATE.PATROL;
                            ai.alertTimer = 0;
                            ai.target = null;
                        }
                    } else { ai.alertTimer = 0; }
                    break;

                case AI_STATE.ENGAGE:
                    updateEngage(enemy, ai, cfg, dt, nearestPlayer);
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
    }

    // ─── 敌人受击回调（由 index.html 炮弹碰撞检测调用） ───
    function onEnemyDamaged(enemy, damage, attacker) {
        if (!enemy || !enemy.ai) return;
        const ai = enemy.ai;
        const eid = (enemy.userData && enemy.userData.enemyId) || '??';
        const isZombie = (enemy.cfg && enemy.cfg.type === 'zombie') || (enemy.userData && enemy.userData.enemyType === 'zombie');

        enemy.hp = Math.max(0, enemy.hp - damage);

        // 丧尸受击 → STAGGER（定身硬直）
        if (isZombie && enemy.hp > 0 && ai.state !== ZS.STAGGER) {
            const prevState = ai.state;
            ai.prevState = prevState;
            ai.state = ZS.STAGGER;
            ai.lastHitTime = Date.now() / 1000;
            console.log('⚡ ' + eid + ' 受击! ' + prevState + ' → STAGGER (HP:' + enemy.hp + ')');
        } else if (isZombie && enemy.hp > 0 && ai.state === ZS.STAGGER) {
            // 已硬直中再次受击 → 刷新计时器
            ai.lastHitTime = Date.now() / 1000;
        }

        // 非丧尸：受击触发迎击（被动还击模式）
        if (!isZombie) {
            const prevState = ai.state;
            if (ai.state === AI_STATE.PATROL || ai.state === AI_STATE.FLEE) {
                ai.state = AI_STATE.CHASE;
                ai.target = attacker;
                if (attacker && attacker.group) {
                    ai.lastSeenPlayerPos = attacker.group.position.clone();
                }
                ai.alertTimer = 0;
                console.log('⚡ ' + eid + ' 受击! ' + prevState + ' → CHASE (HP:' + enemy.hp + ')');
            }
        }

        // 受击反馈 → 交由 index.html 处理（闪光/粒子）
        ai.hitFlash = 0.2; // 白色高亮 0.2 秒

        return enemy.hp <= 0;
    }

    // v0.28.0: 2层仇恨连锁 + 空间网格加速

    // ─── 空间网格（20m格，200×200m地图 → 10×10）───
    const GRID_CELL = 20;
    const GRID_LEN = 10;
    let _gridDirty = true;
    const _grid = Array(GRID_LEN).fill(null).map(() => Array(GRID_LEN).fill(null).map(() => []));

    function rebuildSpatialGrid(allEnemies) {
        // 清空所有格子
        for (let x = 0; x < GRID_LEN; x++)
            for (let z = 0; z < GRID_LEN; z++)
                _grid[x][z].length = 0;
        // 分配敌人到格子
        for (const e of allEnemies) {
            if (!e || e.ai.state === 'dead' || e.ai.state === ZS.DEAD) continue;
            const cx = Math.min(GRID_LEN - 1, Math.max(0, Math.floor((e.position.x + 100) / GRID_CELL)));
            const cz = Math.min(GRID_LEN - 1, Math.max(0, Math.floor((e.position.z + 100) / GRID_CELL)));
            _grid[cx][cz].push(e);
        }
        _gridDirty = true;
    }

    function getNeighborsInRadius(center, radius, allEnemies) {
        // 小规模（<20个敌人）直接遍历更快
        if (allEnemies.length < 20) return allEnemies;
        // 空间网格查找
        rebuildSpatialGrid(allEnemies);
        const cx = Math.min(GRID_LEN - 1, Math.max(0, Math.floor((center.x + 100) / GRID_CELL)));
        const cz = Math.min(GRID_LEN - 1, Math.max(0, Math.floor((center.z + 100) / GRID_CELL)));
        const cells = Math.ceil(radius / GRID_CELL);  // 需要搜索几层格子
        const result = [];
        for (let dx = -cells; dx <= cells; dx++) {
            for (let dz = -cells; dz <= cells; dz++) {
                const nx = cx + dx, nz = cz + dz;
                if (nx < 0 || nx >= GRID_LEN || nz < 0 || nz >= GRID_LEN) continue;
                for (const e of _grid[nx][nz]) {
                    if (center.distanceTo(e.position) < radius) result.push(e);
                }
            }
        }
        return result;
    }

    // v0.28.0: 2层仇恨连锁 — 受击→L1邻居→L2邻居（止），防止全图无限连锁
    function shareAggro(hitEnemy, attacker, allEnemies, aggroRadius) {
        if (!attacker || !allEnemies || allEnemies.length < 2) return;
        const radius = aggroRadius || 25;
        const hitId = (hitEnemy.userData && hitEnemy.userData.enemyId) || '??';
        const isZombieHit = (hitEnemy.cfg && hitEnemy.cfg.type === 'zombie');
        const pursuitState = isZombieHit ? ZS.PURSUIT : AI_STATE.CHASE;

        function canBeAlerted(ally) {
            if (!ally || !ally.ai) return false;
            if (ally.ai.state === 'dead' || ally.ai.state === ZS.DEAD) return false;
            const isZ = (ally.cfg && ally.cfg.type === 'zombie');
            return isZ
                ? [ZS.IDLE, ZS.PATROL, ZS.ALERT, ZS.SEARCH].includes(ally.ai.state)
                : [AI_STATE.PATROL, AI_STATE.FLEE].includes(ally.ai.state);
        }

        function alertAlly(ally, sourceId, layer) {
            const aid = (ally.userData && ally.userData.enemyId) || '??';
            const prevState = ally.ai.state;
            ally.ai.state = pursuitState;
            ally.ai.target = attacker;
            if (attacker.group) ally.ai.lastSeenPlayerPos = attacker.group.position.clone();
            ally.ai.lostTargetTimer = 0;
            console.log('📢 仇恨L' + layer + ': ' + sourceId + ' → ' + aid + ' ' + prevState + ' → ' + pursuitState);
        }

        const candidates = getNeighborsInRadius(hitEnemy.position, radius, allEnemies);
        const layer1Allies = [];

        // ── Layer 1: hitEnemy 的直接邻居 ──
        for (const ally of candidates) {
            if (!ally || ally === hitEnemy) continue;
            if (canBeAlerted(ally) && hitEnemy.position.distanceTo(ally.position) < radius) {
                alertAlly(ally, hitId, 1);
                if (ally.cfg && ally.cfg.type === 'zombie') layer1Allies.push(ally);
            }
        }

        // ── Layer 2: L1 邻居的邻居（仅此一层，不再传播） ──
        if (layer1Allies.length > 0) {
            const alertedSet = new Set(layer1Allies);
            alertedSet.add(hitEnemy);
            for (const l1 of layer1Allies) {
                const l1Candidates = getNeighborsInRadius(l1.position, radius, allEnemies);
                for (const ally of l1Candidates) {
                    if (!ally || alertedSet.has(ally)) continue;
                    if (canBeAlerted(ally) && l1.position.distanceTo(ally.position) < radius) {
                        alertAlly(ally, (l1.userData && l1.userData.enemyId) || '??', 2);
                        alertedSet.add(ally);  // L2 的不会再触发别人
                    }
                }
            }
        }
    }

    // ─── 暴露到全局 ───
    window.EnemyAI = {
        AI_STATE,
        ZOMBIE_STATE: ZS,
        canSeeTarget,
        updateEnemyAI,
        onEnemyDamaged,
        shareAggro,
        findNearestPlayer,
        moveZombieToward,
        canZombieAttack,
    };

    console.log('🧠 敌人AI系统 v0.28.0 | 车辆: PATROL→CHASE→ENGAGE→FLEE | 丧尸: IDLE→PATROL→ALERT→PURSUIT→SEARCH→ATTACK→STAGGER→DEAD');

})();
