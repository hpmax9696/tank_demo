/**
 * 敌人 AI 系统 — PvE 战斗模式
 * v0.28.0 重写丧尸8状态机（IDLE/PATROL/ALERT/PURSUIT/SEARCH/ATTACK/STAGGER/DEAD）
 *
 * 车辆状态机：PATROL → CHASE → ENGAGE → PATROL/FLEE
 * 丧尸状态机：IDLE → PATROL → ALERT → PURSUIT → SEARCH/ATTACK → STAGGER → DEAD
 * 被动模式(reactive): PATROL 不主动探测玩家，受击后才切换 PURSUIT
 */

(function () {
  // 车辆 AI 状态（保持兼容）
  const AI_STATE = {
    PATROL: 'patrol',
    CHASE: 'chase',
    ENGAGE: 'engage',
    FLEE: 'flee',
    STUNNED: 'stunned',
    DEAD: 'dead',
  };

  // ─── 丧尸专用 8 状态机 ───
  const ZS = {
    IDLE: 'idle',
    PATROL: 'patrol',
    ALERT: 'alert', // 发现异常→转向确认
    PURSUIT: 'pursuit', // 全速追击
    SEARCH: 'search', // 丢失目标→最后目击点搜索
    ATTACK: 'attack', // 近战攻击
    STAGGER: 'stagger', // 受击硬直
    DEAD: 'dead',
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
    const tPos = (target.group ? target.group.position : target.position).clone();
    const dist = ePos.distanceTo(tPos);
    if (dist > maxDist) return false;

    // 前端朝 -X，rotation.y=θ 时前向量 = (-cosθ, 0, sinθ)
    const forward = new THREE.Vector3(-Math.cos(enemy.rotation.y), 0, Math.sin(enemy.rotation.y));
    const dirX = tPos.x - ePos.x;
    const dirZ = tPos.z - ePos.z;
    const hDist2 = dirX * dirX + dirZ * dirZ;
    if (hDist2 < 0.01) return true;
    const invDist = 1 / Math.sqrt(hDist2);
    const toTargetX = dirX * invDist;
    const toTargetZ = dirZ * invDist;
    const dot = forward.x * toTargetX + forward.z * toTargetZ;
    if (dot < Math.cos(coneAngle)) return false;
    // 地形遮挡检测: 采样路径上最高地形, 若超过两端较低点+2m且高于视线, 判定遮挡
    const steps = 12;
    let maxTerrainH = 0;
    const minEndH = Math.min(ePos.y, tPos.y);
    for (let s = 1; s <= steps; s++) {
      const frac = s / (steps + 1);
      const sx = ePos.x + dirX * frac;
      const sz = ePos.z + dirZ * frac;
      const gh = getTerrainHeight(sx, sz);
      if (gh > maxTerrainH) maxTerrainH = gh;
      const lh = ePos.y + (tPos.y - ePos.y) * frac;
      if (gh > lh + 0.5) return false;
    }
    // 地形显著高于两端: 即使直线视线勉强通过, 弹道也会被挡
    if (maxTerrainH > minEndH + 2.0) return false;
    return true;
  }

  // ─── 获取离敌人最近的存活玩家 ───
  function findNearestPlayer(enemy, players) {
    let best = null,
      bestD = Infinity;
    for (const p of players) {
      if (!p || p.hp <= 0 || p.dead) continue;
      const d = enemy.position.distanceTo(p.group.position);
      if (d < bestD) {
        bestD = d;
        best = p;
      }
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
    if (dist < 0.5) {
      enemy.position.set(targetX, enemy.position.y, targetZ);
      return true;
    } // 到达

    // 1. 计算敌人当前朝向（前端朝 -X，rotation.y=θ 时前向量 = (-cosθ, 0, sinθ)）
    const curYaw = enemy.rotation.y;
    const forwardX = -Math.cos(curYaw);
    const forwardZ = Math.sin(curYaw);

    // 2. 计算目标方向角（使 -X 指向目标）
    const targetYaw = Math.atan2(dz, -dx);

    // 3. 判断前进还是倒车（目标在前方→前进，目标在后方→倒车不甩头）
    const facingDot = forwardX * (dx / dist) + forwardZ * (dz / dist);
    const shouldReverse = facingDot < 0.0; // 目标在后方半平面即倒车（避免掉头失准）
    if (shouldReverse) {
      // 倒车：不转向，直接后退
      let moveStep = speed * 0.6 * dt;
      enemy.position.x -= forwardX * moveStep;
      enemy.position.z -= forwardZ * moveStep;
    } else {
      // 转向目标方向
      const rotSpeed = 1.0; // rad/s (减半)
      let ad = angleDiff(curYaw, targetYaw);
      const rotStep = Math.min(Math.abs(ad), rotSpeed * dt) * Math.sign(ad);
      enemy.rotation.y += rotStep;
      // 前进驱动
      if (facingDot > -0.8) {
        const alignment = Math.max(0.15, (facingDot + 0.8) / 1.8);
        let moveStep = speed * dt * alignment;
        const newFwdX = -Math.cos(enemy.rotation.y);
        const newFwdZ = Math.sin(enemy.rotation.y);
        const slopeFront = getTerrainHeight(
          enemy.position.x + newFwdX * 1.0,
          enemy.position.z + newFwdZ * 1.0
        );
        const slopeBack = getTerrainHeight(
          enemy.position.x - newFwdX * 1.0,
          enemy.position.z - newFwdZ * 1.0
        );
        const slopeAngle = Math.atan2(slopeFront - slopeBack, 2.0);
        if (Math.abs(slopeAngle) > MAX_SLOPE) {
          // 陡坡阻挡: 左右采样寻找可通行方向
          const rightX = -Math.cos(enemy.rotation.y + Math.PI / 2);
          const rightZ = Math.sin(enemy.rotation.y + Math.PI / 2);
          const sampleD = 2.0;
          const rSlope = Math.atan2(
            getTerrainHeight(
              enemy.position.x + rightX * sampleD,
              enemy.position.z + rightZ * sampleD
            ) -
              getTerrainHeight(
                enemy.position.x - rightX * sampleD,
                enemy.position.z - rightZ * sampleD
              ),
            sampleD * 2
          );
          const lSlope = Math.atan2(
            getTerrainHeight(
              enemy.position.x - rightX * sampleD,
              enemy.position.z - rightZ * sampleD
            ) -
              getTerrainHeight(
                enemy.position.x + rightX * sampleD,
                enemy.position.z + rightZ * sampleD
              ),
            sampleD * 2
          );
          // 选择坡度较缓的一侧绕行
          const avoidDir = Math.abs(rSlope) < Math.abs(lSlope) ? 1 : -1;
          enemy.rotation.y += avoidDir * rotSpeed * dt * 1.5;
          moveStep *= 0.3;
        }
        enemy.position.x += newFwdX * Math.min(moveStep, dist);
        enemy.position.z += newFwdZ * Math.min(moveStep, dist);
      }
    }

    return false; // 未到达
  }

  // ─── 炮塔瞄准（旋转 turretPivot 使喷火管对准目标） ───
  function aimTurretAt(enemy, targetWorldPos, dt, turnSpeed) {
    const tp = enemy.userData && enemy.userData.turretPivot;
    if (!tp) return;
    const turretWorldPos = new THREE.Vector3();
    tp.getWorldPosition(turretWorldPos);
    // 水平瞄准 (Y轴旋转)
    const dx = targetWorldPos.x - turretWorldPos.x;
    const dz = targetWorldPos.z - turretWorldPos.z;
    const worldTargetAngle = Math.atan2(dz, -dx);
    const localTargetAngle = worldTargetAngle - enemy.rotation.y;
    const curAngle = tp.rotation.y;
    const ad = angleDiff(curAngle, localTargetAngle);
    const step = Math.min(Math.abs(ad), (turnSpeed || 1.0) * dt) * Math.sign(ad);
    tp.rotation.y += step;
    // 垂直瞄准 (炮管俯仰, 含重力补偿) - 通过 barrelPivot 控制
    const bp = enemy.userData && enemy.userData.barrelPivot;
    if (bp) {
      const barrelWorldPos = new THREE.Vector3();
      bp.getWorldPosition(barrelWorldPos);
      const dy = targetWorldPos.y - barrelWorldPos.y;
      const hDist = Math.sqrt(dx * dx + dz * dz);
      // 直瞄角度 + 重力补偿: 飞行时间 t=hDist/SHELL_SPEED, 下坠补偿 ≈ 0.5*g*t^2/hDist
      const directPitch = Math.atan2(dy, hDist);
      const flightTime = hDist / (typeof SHELL_SPEED !== 'undefined' ? SHELL_SPEED : 50);
      const gravComp =
        (0.5 * (typeof SHELL_GRAVITY !== 'undefined' ? SHELL_GRAVITY : 1.0) * flightTime) /
        (typeof SHELL_SPEED !== 'undefined' ? SHELL_SPEED : 50);
      const targetPitch = -(directPitch + gravComp);
      const curPitch = bp.rotation.x;
      const pitchDiff = targetPitch - curPitch;
      const pitchStep =
        Math.min(Math.abs(pitchDiff), (turnSpeed || 1.0) * dt) * Math.sign(pitchDiff);
      bp.rotation.x += pitchStep;
    }
    return Math.abs(ad) < 0.1;
  }

  // ==================== 状态处理函数 ====================

  // ── PATROL: 沿路径点移动 ──
  function updatePatrol(enemy, ai, cfg, dt) {
    if (!cfg.patrolPath || cfg.patrolPath.length === 0) return;
    const wp = cfg.patrolPath[ai.patrolIndex];
    const distBefore = Math.hypot(enemy.position.x - wp[0], enemy.position.z - wp[1]);
    const arrived = moveEnemyToward(enemy, wp[0], wp[1], cfg.speed || 3.0, dt);
    if (arrived) {
      ai.patrolIndex = (ai.patrolIndex + 1) % cfg.patrolPath.length;
      ai.wpStuckTimer = 0;
      ai._consecutiveStucks = 0;
    } else {
      // 用距巡逻点距离缩小替代绝对位移（防止敌人间碰撞推挤导致 stuck 误复位）
      const distAfter = Math.hypot(enemy.position.x - wp[0], enemy.position.z - wp[1]);
      const distReduction = distBefore - distAfter;
      if (distReduction < 0.01) {
        // 没有实质接近巡逻点
        ai.wpStuckTimer = (ai.wpStuckTimer || 0) + dt;
        if (ai.wpStuckTimer > 1.5) {
          ai.patrolIndex = (ai.patrolIndex + 1) % cfg.patrolPath.length;
          ai.wpStuckTimer = 0;
          ai._consecutiveStucks = (ai._consecutiveStucks || 0) + 1;
          if (ai._consecutiveStucks >= 3) {
            const angle = Math.random() * Math.PI * 2;
            const r = 2 + Math.random() * 4;
            enemy.position.x += Math.cos(angle) * r;
            enemy.position.z += Math.sin(angle) * r;
            ai._consecutiveStucks = 0;
          }
        }
      } else {
        ai.wpStuckTimer = 0;
        ai._consecutiveStucks = 0;
      }
    }
  }

  // ── CHASE: 追击玩家（全速直追） ──
  function updateChase(enemy, ai, cfg, dt, nearestPlayer) {
    if (!nearestPlayer) {
      ai.state = AI_STATE.PATROL;
      return;
    }
    const pp = nearestPlayer.group.position;
    // 检查视线是否被地形遮挡
    if (!canSeeTarget(enemy, nearestPlayer, Math.PI, cfg.viewDist || 100, scene)) {
      // 视线受阻: 侧向迂回, 交替左右包抄
      if (typeof ai._flankDir === 'undefined') ai._flankDir = Math.random() > 0.5 ? 1 : -1;
      if (typeof ai._flankTimer === 'undefined') ai._flankTimer = 0;
      ai._flankTimer += dt;
      if (ai._flankTimer > 4.0) {
        ai._flankTimer = 0;
        ai._flankDir *= -1;
      }
      const dx = pp.x - enemy.position.x;
      const dz = pp.z - enemy.position.z;
      const nd = Math.sqrt(dx * dx + dz * dz) || 1;
      const flankX = (-dz / nd) * ai._flankDir;
      const flankZ = (dx / nd) * ai._flankDir;
      // 沿侧向持续移动直到找到可射击角度
      const targetX = enemy.position.x + flankX * 30;
      const targetZ = enemy.position.z + flankZ * 30;
      moveEnemyToward(enemy, targetX, targetZ, (cfg.speed || 5.0) * 1.2, dt);
    } else {
      // 视线畅通: 直追
      moveEnemyToward(enemy, pp.x, pp.z, (cfg.speed || 5.0) * 1.3, dt);
    }
    ai._turretAimed = aimTurretAt(enemy, pp, dt, 1.0);
    ai.lastSeenPlayerPos = pp.clone();
  }

  // ── ENGAGE: 弧线绕圈 + 瞄准 + 开火循环（车体沿切线驱动，炮塔独立瞄准） ──
  function updateEngage(enemy, ai, cfg, dt, nearestPlayer) {
    if (!nearestPlayer) {
      ai.state = AI_STATE.CHASE;
      return;
    }
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
    const tanX = (-dz / nd) * strafeDir;
    const tanZ = (dx / nd) * strafeDir;
    const radX = -dx / nd; // 径向远离玩家
    const radZ = -dz / nd;

    // 混合径向（距控）和切向（绕圈）
    let radialW = 0,
      tangentW = 0.55;
    if (dist < idealDist * 0.6) {
      // 太近：后退优先
      radialW = 1.0;
      tangentW = 0.0;
    } else if (dist > idealDist * 1.3) {
      // 偏远：优先逼近（径向权重负=靠近，切向削弱）
      radialW = -1.0;
      tangentW = 0.15;
    }
    // 理想距离内：主绕圈

    const moveX = tanX * tangentW + radX * radialW;
    const moveZ = tanZ * tangentW + radZ * radialW;
    const mn = Math.sqrt(moveX * moveX + moveZ * moveZ) || 1;

    // 视线检测: 被地形遮挡时增大绕圈半径寻射击角度
    if (!canSeeTarget(enemy, nearestPlayer, Math.PI, cfg.viewDist || 100, scene)) {
      radialW = -1.0;
      tangentW = 0.0; // 被遮挡: 先逼近拉近距离
    }
    // 1. 车体移动（侧滑约束履带物理）
    const facingX = -Math.cos(enemy.rotation.y);
    const facingZ = Math.sin(enemy.rotation.y);
    const retreating = radialW < -0.3; // 太近时(<optimalDist)远离玩家，倒车而非掉头
    if (retreating) {
      // 倒车：车身不转向，直接后退
      enemy.position.x -= facingX * speed * 0.7 * dt;
      enemy.position.z -= facingZ * speed * 0.7 * dt;
    } else {
      // 转向朝移动方向
      const targetYaw = Math.atan2(moveZ / mn, -(moveX / mn));
      const rotSpeed = 1.0; // (减半)
      const ad = angleDiff(enemy.rotation.y, targetYaw);
      const rotStep = Math.min(Math.abs(ad), rotSpeed * dt) * Math.sign(ad);
      enemy.rotation.y += rotStep;
      // 前进驱动力（只有朝向大致匹配才驱动）
      const facingDot = facingX * (moveX / mn) + facingZ * (moveZ / mn);
      if (facingDot > 0.2) {
        const step = speed * dt * Math.min(1.0, Math.abs(facingDot));
        enemy.position.x += facingX * step;
        enemy.position.z += facingZ * step;
      }
    }

    // 周期性换向（~2.5秒变换绕圈方向）
    ai.strafeTimer = (ai.strafeTimer || 0) + dt;
    if (ai.strafeTimer > 2.5) {
      ai.strafeDir *= -1;
      ai.strafeTimer = 0;
    }

    // 3. 炮塔独立瞄准玩家
    const aimed = aimTurretAt(enemy, pp, dt, 1.0); // 炮塔转速
    ai._turretAimed = aimed; // 训练场用: 炮塔是否已对准

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
    if (!nearestPlayer) {
      ai.state = AI_STATE.PATROL;
      return;
    }
    const pp = nearestPlayer.group.position;
    const dx = enemy.position.x - pp.x;
    const dz = enemy.position.z - pp.z;
    const nd = Math.sqrt(dx * dx + dz * dz) || 1;
    moveEnemyToward(
      enemy,
      enemy.position.x + (dx / nd) * (cfg.speed || 5.0) * dt * 1.2,
      enemy.position.z + (dz / nd) * (cfg.speed || 5.0) * dt * 1.2,
      cfg.speed || 5.0,
      dt
    );
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
      let moveStep = speed * dt * alignment;
      // 坡度速度限制
      const ndx = dx / dist,
        ndz = dz / dist;
      const sf = getTerrainHeight(enemy.position.x + ndx * 1.0, enemy.position.z + ndz * 1.0);
      const sb = getTerrainHeight(enemy.position.x - ndx * 1.0, enemy.position.z - ndz * 1.0);
      const sa = Math.atan2(sf - sb, 2.0);
      if (Math.abs(sa) > MAX_SLOPE) moveStep *= MAX_SLOPE / Math.abs(sa);
      const step = Math.min(moveStep, dist);
      enemy.position.x += ndx * step;
      enemy.position.z += ndz * step;
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
    const isZombie =
      cfg.type === 'zombie' || (enemy.userData && enemy.userData.enemyType === 'zombie');
    const isHexapod =
      cfg.type === 'hexapod' || (enemy.userData && enemy.userData.enemyType === 'hexapod');

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
                ai.idleDuration = 0.8 + Math.random() * 1.8; // 0.8~2.6s
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
            moveZombieToward(
              enemy,
              nearestPlayer.group.position.x,
              nearestPlayer.group.position.z,
              (cfg.speed || 1.5) * 2.5,
              dt
            );
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
            moveZombieToward(
              enemy,
              ai.lastSeenPlayerPos.x,
              ai.lastSeenPlayerPos.z,
              cfg.speed || 2.5,
              dt
            );
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
              ai.atkCooldown = cfg.attackCooldown || 2.0;
            } else if (!ai.atkReady) {
              // 冷却倒计时
              ai.atkCooldown = (ai.atkCooldown || 0) - dt;
              if (ai.atkCooldown <= 0) {
                ai.atkReady = true;
                ai.atkCooldown = 0;
              }
              // 冷却中仍靠近（缓慢）
              if (pDist > (cfg.attackDist || 2.0) * 0.6) {
                moveZombieToward(
                  enemy,
                  nearestPlayer.group.position.x,
                  nearestPlayer.group.position.z,
                  (cfg.speed || 2.5) * 0.6,
                  dt
                );
              }
            } else {
              // 靠近玩家
              moveZombieToward(
                enemy,
                nearestPlayer.group.position.x,
                nearestPlayer.group.position.z,
                cfg.speed || 2.5,
                dt
              );
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
    } else if (isHexapod) {
      // ═══════════════════════════════════════════
      //  六足战车 AI — 车辆状态机 + 武器平衡
      // ═══════════════════════════════════════════
      if (ai.state === AI_STATE.STUNNED) {
        ai.animRequest = 'idle';
        return;
      }
      if (ai.state === AI_STATE.DEAD) {
        ai.animRequest = 'death';
        return;
      }

      if (ai.spinUp === undefined) ai.spinUp = 0;
      if (ai.heat === undefined) ai.heat = 0;
      if (ai.bodyYaw === undefined) ai.bodyYaw = enemy.rotation.y;

      switch (ai.state) {
        case AI_STATE.PATROL:
          updatePatrol(enemy, ai, cfg, dt);
          // 保持 bodyYaw 与 enemy.rotation.y 同步，防止进入 ENGAGE 时突变
          ai.bodyYaw = enemy.rotation.y;
          // aggressive模式: 无巡逻路径时缓慢旋转扫描 (360°全向检测)
          if (!cfg.reactive) {
            if (!cfg.patrolPath || cfg.patrolPath.length === 0) {
              ai.bodyYaw += dt * 1.2; // 慢速旋转扫描
              enemy.rotation.y = ai.bodyYaw;
            }
            if (
              nearestPlayer &&
              canSeeTarget(enemy, nearestPlayer, Math.PI / 2, cfg.viewDist || 60, scene)
            ) {
              ai.state = AI_STATE.CHASE;
              ai.target = nearestPlayer;
              ai.lastSeenPlayerPos = nearestPlayer.group.position.clone();
              ai.alertTimer = 0;
            }
          }
          ai.animRequest = 'move_forward';
          break;
        case AI_STATE.CHASE:
          updateChase(enemy, ai, cfg, dt, nearestPlayer);
          // 保持 bodyYaw 与 enemy.rotation.y 同步
          ai.bodyYaw = enemy.rotation.y;
          if (nearestPlayer && nearestDist < (cfg.engageDist || 20) * 0.85) {
            ai.state = AI_STATE.ENGAGE;
          }
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
          // 远距离追击时发射导弹 (CHASE阶段: 距离>25m且在导弹射程内, 太近打不中)
          ai.gatlingRequest = false;
          ai.missileRequest = false;
          if (nearestPlayer && nearestDist > 25 && nearestDist < (cfg.missileRange || 35)) {
            const _ma = (ai._missileAmmoL || 0) + (ai._missileAmmoR || 0);
            if (_ma > 0) {
              ai.missileTimer = (ai.missileTimer || 0) - dt;
              if (ai.missileTimer <= 0) {
                ai.missileTimer = cfg.missileCooldown || 4.0;
                ai.missileRequest = true;
              }
            }
          }
          ai.animRequest = 'move_forward';
          break;
        case AI_STATE.ENGAGE:
          updateHexapodEngage(enemy, ai, cfg, dt, nearestPlayer, players, scene);
          if (!nearestPlayer || nearestDist > (cfg.engageDist || 20) * 1.5) {
            ai.state = AI_STATE.CHASE;
          }
          if (cfg.canFlee && enemy.hp < cfg.hp * 0.2) {
            ai.state = AI_STATE.FLEE;
          }
          break;
        case AI_STATE.FLEE:
          updateFlee(enemy, ai, cfg, dt, nearestPlayer);
          ai.animRequest = 'move_backward';
          break;
      }
      // 全状态下加特林散热 (非ENGAGE时加速冷却)
      if (ai.state !== AI_STATE.ENGAGE) {
        ai.spinUp = Math.max(0, (ai.spinUp || 0) - dt * 3);
        ai.heat = Math.max(0, (ai.heat || 0) - (cfg.coolPerSec || 15) * dt);
        ai.gatlingSpread = Math.max(0, (ai.gatlingSpread || 0) - dt * 0.5);
      }
    } else {
      // ── 原有车辆 AI ──
      switch (ai.state) {
        case AI_STATE.PATROL:
          updatePatrol(enemy, ai, cfg, dt);
          if (
            !cfg.reactive &&
            nearestPlayer &&
            canSeeTarget(enemy, nearestPlayer, Math.PI / 4, cfg.viewDist || 60, scene)
          ) {
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
            if (
              nearestPlayer &&
              nearestDist < wr * 0.85 &&
              canSeeTarget(enemy, nearestPlayer, Math.PI / 4, cfg.viewDist || 60, scene)
            ) {
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
          } else {
            ai.alertTimer = 0;
          }
          break;

        case AI_STATE.ENGAGE:
          updateEngage(enemy, ai, cfg, dt, nearestPlayer);
          {
            const wr = cfg.flameRange || 12;
            if (!nearestPlayer || nearestDist > wr * 1.3) {
              ai.state = AI_STATE.CHASE;
            }
            // 视线被地形遮挡: 退回CHASE迂回包抄
            if (
              nearestPlayer &&
              !canSeeTarget(enemy, nearestPlayer, Math.PI, cfg.viewDist || 100, scene)
            ) {
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

  // ─── 六足战车 ENGAGE 逻辑 v0.59.0（真绕圈+武器优先级+strafe动画）───
  function updateHexapodEngage(enemy, ai, cfg, dt, nearestPlayer, players, scene) {
    if (!nearestPlayer) return;
    const pp = nearestPlayer.group.position;
    const dist = enemy.position.distanceTo(pp);
    const turnRate = cfg.turnRate || 2.0;
    const spinUpTime = cfg.spinUpTime || 0.8;
    const overheatMax = cfg.overheatMax || 100;
    const heatPerSec = cfg.heatPerSec || 25;
    const coolPerSec = cfg.coolPerSec || 18;
    const spreadCone = ((cfg.spreadCone || 3) * Math.PI) / 180;
    const gatlingRange = cfg.gatlingRange || 25;
    const missileRange = cfg.missileRange || 35;
    const missileCooldown = cfg.missileCooldown || 4.0;
    const idealDist = cfg.engageDist || 22;
    const speed = cfg.speed || 4.5;

    // ── 1. 车身始终面朝玩家 ──
    const dx = pp.x - enemy.position.x;
    const dz = pp.z - enemy.position.z;
    const targetYaw = Math.atan2(dz, -dx);
    const ad = angleDiff(ai.bodyYaw, targetYaw);
    const rotStep = Math.min(Math.abs(ad), turnRate * dt) * Math.sign(ad);
    ai.bodyYaw += rotStep;
    enemy.rotation.y = ai.bodyYaw;
    enemy.updateMatrixWorld();
    // 踉跄中: 仅维持朝向追踪, 跳过武器+移动逻辑 (由 HexapodEnemy 驱动踉跄动画)
    if (enemy.userData._hexAnimState && enemy.userData._hexAnimState._staggerActive) {
      ai.gatlingRequest = false;
      ai.missileRequest = false;
      ai.spinUp = Math.max(0, (ai.spinUp || 0) - dt * 3);
      ai.heat = Math.max(0, (ai.heat || 0) - 18 * dt);
      ai._desiredVelX = 0;
      ai._desiredVelZ = 0;
      return;
    }
    const isAligned = Math.abs(ad) < 0.25;
    const facingPlayer = Math.abs(ad) < 1.2; // 大致面朝玩家即可移动

    // ── 2. 身体轴向量 (Y轴旋转后的局部方向) ──
    const fwdX = -Math.cos(enemy.rotation.y);
    const fwdZ = Math.sin(enemy.rotation.y);
    const rightX = Math.sin(enemy.rotation.y);
    const rightZ = Math.cos(enemy.rotation.y);

    // ── 3. 绕圈方向管理 (每3~5秒随机翻转) ──
    ai.strafeTimer = (ai.strafeTimer || 0) + dt;
    if (ai.strafeTimer > 3.0 + Math.random() * 2) {
      ai.strafeDir = (ai.strafeDir || 1) * -1;
      ai.strafeTimer = 0;
    }
    const sd = ai.strafeDir || 1;

    // ── 4. 武器决策: 加特林(<15m) > 导弹(25~50m) > 过热后退+导弹 > 后退 ──
    const missileAmmo = (ai._missileAmmoL || 0) + (ai._missileAmmoR || 0);
    const canGatling = !ai._overheated && ai.spinUp > 0.7 && isAligned && dist < gatlingRange;
    const canMissile = missileAmmo > 0 && dist > 25 && dist < missileRange && isAligned;
    let weaponAction = 'none';
    if (ai._overheated && canMissile) {
      weaponAction = 'missile_retreat'; // 过热有弹: 后退拉开距离+发射导弹
    } else if (ai._overheated) {
      weaponAction = 'retreat'; // 过热没弹: 纯后退冷却
    } else if (canGatling && dist < 15) {
      weaponAction = 'gatling'; // 极近距: 加特林扫射
    } else if (canMissile) {
      weaponAction = 'missile'; // 中远距: 导弹(15~50m)
    } else if (canGatling) {
      weaponAction = 'gatling'; // 兜底加特林
    }

    // ── 5. 切向绕圈 + 径向距离修正 ──
    // 步频由 hexapod_core 自适应 (gaitPeriod = 2*stride/bodySpeed)
    let tangentW = 0.25,
      radialW = 0;
    if (weaponAction === 'retreat') {
      radialW = -0.8;
      tangentW = 0.1; // 纯后退
    } else if (weaponAction === 'missile_retreat') {
      radialW = -0.5;
      tangentW = 0.15; // 后退+导弹(拉开距离冷却)
    } else if (dist < idealDist * 0.35) {
      radialW = -0.9;
      tangentW = 0.15; // 太近
    } else if (dist < idealDist * 0.6) {
      radialW = -0.3;
      tangentW = 0.25; // 偏近
    } else if (dist > idealDist * 1.4) {
      radialW = 0.5;
      tangentW = 0.2; // 太远
    } else {
      radialW = 0;
      tangentW = 0.25; // 理想区: 纯绕圈
    }
    if (!facingPlayer) {
      tangentW = 0; // 未面朝玩家时不绕圈，但仍可径向移动
      if (radialW < 0) radialW = 0; // 不后退，避免背对玩家越退越远
    }

    // ── 6. 期望速度 (由 hexapod_core stepGait 在步态内应用, 保证腿驱动感) ──
    var moveX = 0,
      moveZ = 0;
    if (facingPlayer) {
      moveX = (fwdX * radialW + rightX * tangentW * sd) * speed;
      moveZ = (fwdZ * radialW + rightZ * tangentW * sd) * speed;
    }
    ai._desiredVelX = moveX;
    ai._desiredVelZ = moveZ;

    // ── 7. 加特林转速+过热管理 ──
    if (ai._overheated) {
      ai.spinUp = Math.max(0, ai.spinUp - dt * 2);
    } else if (ai.heat >= 80 && isAligned && dist < gatlingRange) {
      ai.spinUp = Math.max(0, ai.spinUp - dt * 1.5);
    } else if (isAligned && dist < gatlingRange) {
      ai.spinUp = Math.min(1.0, ai.spinUp + dt / spinUpTime);
    } else {
      ai.spinUp = Math.max(0, ai.spinUp - dt * 2);
    }

    if (ai.heat >= 80) {
      ai._overheated = true;
    }
    if (ai._overheated && ai.heat <= 0) {
      ai._overheated = false;
    } // 强制散热: heat 必须降到 0 才能再旋转→达标→射击

    if (weaponAction === 'gatling' && ai.spinUp > 0.7) {
      ai.heat += heatPerSec * dt;
      ai.gatlingSpread = Math.min(1.0, (ai.gatlingSpread || 0) + dt * 0.5);
    } else {
      ai.heat = Math.max(0, ai.heat - coolPerSec * dt);
      ai.gatlingSpread = Math.max(0, (ai.gatlingSpread || 0) - dt * 0.3);
    }
    if (ai.heat >= overheatMax) {
      ai.heat = overheatMax;
      enemy.hp = Math.max(0, enemy.hp - 5 * dt);
    }

    // ── 8. 武器发射请求 ──
    ai.gatlingRequest = false;
    ai.missileRequest = false;

    if (weaponAction === 'gatling') {
      ai.gatlingTimer = (ai.gatlingTimer || 0) - dt;
      if (ai.gatlingTimer <= 0) {
        ai.gatlingTimer = 1.0 / (cfg.fireRate || 10);
        ai.gatlingRequest = true;
      }
    }

    if (weaponAction === 'missile' || weaponAction === 'missile_retreat') {
      ai.missileTimer = (ai.missileTimer || 0) - dt;
      if (ai.missileTimer <= 0) {
        ai.missileTimer = missileCooldown;
        ai.missileRequest = true;
      }
    }

    // ── 9. 动画请求: 按实际移动方向选择 ──
    const strafeDominant = Math.abs(tangentW) > 0.15;
    const radialDominant = Math.abs(radialW) > 0.2;

    if (strafeDominant) {
      ai.animRequest = sd > 0 ? 'strafe_run_right' : 'strafe_run_left';
    } else if (radialDominant && radialW < 0) {
      ai.animRequest = 'move_backward';
    } else if (radialDominant && radialW > 0) {
      ai.animRequest = 'move_forward';
    } else if (Math.abs(ad) > 0.6) {
      ai.animRequest = ad > 0 ? 'turn_right' : 'turn_left';
    } else {
      ai.animRequest = 'idle';
    }
  }

  /**
   * 计算两个角度之间的最短差值 (-PI ~ PI)
   */
  function angleDiff(a, b) {
    var d = b - a;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return d;
  }

  function onEnemyDamaged(enemy, damage, attacker, skipStagger) {
    if (!enemy || !enemy.ai) return;
    const ai = enemy.ai;
    const eid = (enemy.userData && enemy.userData.enemyId) || '??';
    const isZombie =
      (enemy.cfg && enemy.cfg.type === 'zombie') ||
      (enemy.userData && enemy.userData.enemyType === 'zombie');
    const isHexapodDmg =
      (enemy.cfg && enemy.cfg.type === 'hexapod') ||
      (enemy.userData && enemy.userData.enemyType === 'hexapod');

    enemy.hp = Math.max(0, enemy.hp - damage);

    // 六足受击踉跄: 仅重攻击(炮弹)触发，MG 高射速不触发以免定身
    if (isHexapodDmg && enemy.hp > 0 && attacker && attacker.group && !skipStagger) {
      var hitDir = new THREE.Vector3().subVectors(enemy.position, attacker.group.position);
      hitDir.y = 0;
      hitDir.normalize();
      ai._lastHitDir = hitDir;
      ai._lastHitForce = Math.min(1, damage / 40);
      if (window.HexapodEnemy && enemy.userData._hexAnimState) {
        HexapodEnemy.triggerStagger(enemy.userData._hexAnimState, hitDir, ai._lastHitForce);
      }
    }

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

    // 非丧尸：受击触发迎击（六足也走这条路, 被动还击模式/训练场不反击则跳过）
    if (!isZombie && !(enemy.cfg && enemy.cfg.passive)) {
      const prevState = ai.state;
      if (ai.state === AI_STATE.PATROL || ai.state === AI_STATE.FLEE || ai.state === 'idle') {
        ai.state = AI_STATE.CHASE;
        ai.target = attacker;
        if (attacker && attacker.group) {
          ai.lastSeenPlayerPos = attacker.group.position.clone();
        }
        ai.alertTimer = 0;
        ai._tankFireTimer = 1.5; // 受击冷却: 不秒射, 等炮塔转过来
        console.log('⚡ ' + eid + ' 受击! ' + prevState + ' → CHASE (HP:' + enemy.hp + ')');
      }
    }

    // 受击反馈 → 交由 index.html 处理（闪光/粒子）
    ai.hitFlash = 0.2; // 白色高亮 0.2 秒

    return enemy.hp <= 0;
  }

  // v0.28.0: 2层仇恨连锁 + 空间网格加速

  // ─── 空间网格（20m格，矩形地图支持）───
  const GRID_CELL = 20;
  function _gridDims() {
    const pw = (typeof playHalfW !== 'undefined' ? playHalfW : 100) * 2;
    const pd = (typeof playHalfD !== 'undefined' ? playHalfD : 100) * 2;
    return {
      lenX: Math.max(1, Math.ceil(pw / GRID_CELL)),
      lenZ: Math.max(1, Math.ceil(pd / GRID_CELL)),
      phw: pw / 2,
      phd: pd / 2,
    };
  }
  let _gridDirty = true;
  let _grid = [];

  function rebuildSpatialGrid(allEnemies) {
    const { lenX, lenZ, phw, phd } = _gridDims();
    // 如果网格尺寸变了，重新创建
    if (_grid.length !== lenX || (_grid[0] && _grid[0].length !== lenZ)) {
      _grid = Array(lenX)
        .fill(null)
        .map(() =>
          Array(lenZ)
            .fill(null)
            .map(() => [])
        );
    }
    // 清空所有格子
    for (let x = 0; x < lenX; x++) for (let z = 0; z < lenZ; z++) _grid[x][z].length = 0;
    // 分配敌人到格子
    for (const e of allEnemies) {
      if (!e || e.ai.state === 'dead' || e.ai.state === ZS.DEAD) continue;
      const cx = Math.min(lenX - 1, Math.max(0, Math.floor((e.position.x + phw) / GRID_CELL)));
      const cz = Math.min(lenZ - 1, Math.max(0, Math.floor((e.position.z + phd) / GRID_CELL)));
      _grid[cx][cz].push(e);
    }
    _gridDirty = true;
  }

  function getNeighborsInRadius(center, radius, allEnemies) {
    // 小规模（<20个敌人）直接遍历更快
    if (allEnemies.length < 20) return allEnemies;
    // 空间网格查找
    rebuildSpatialGrid(allEnemies);
    const { lenX, lenZ, phw, phd } = _gridDims();
    const cx = Math.min(lenX - 1, Math.max(0, Math.floor((center.x + phw) / GRID_CELL)));
    const cz = Math.min(lenZ - 1, Math.max(0, Math.floor((center.z + phd) / GRID_CELL)));
    const cells = Math.ceil(radius / GRID_CELL); // 需要搜索几层格子
    const result = [];
    for (let dx = -cells; dx <= cells; dx++) {
      for (let dz = -cells; dz <= cells; dz++) {
        const nx = cx + dx,
          nz = cz + dz;
        if (nx < 0 || nx >= lenX || nz < 0 || nz >= lenZ) continue;
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
    const isZombieHit = hitEnemy.cfg && hitEnemy.cfg.type === 'zombie';
    const isHexapodHit = hitEnemy.cfg && hitEnemy.cfg.type === 'hexapod';
    const pursuitState = isZombieHit ? ZS.PURSUIT : AI_STATE.CHASE;
    const hexRadius = isHexapodHit ? aggroRadius || 40 : 0;

    function canBeAlerted(ally) {
      if (!ally || !ally.ai) return false;
      if (ally.ai.state === 'dead' || ally.ai.state === ZS.DEAD) return false;
      const isZ = ally.cfg && ally.cfg.type === 'zombie';
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
      console.log(
        '📢 仇恨L' + layer + ': ' + sourceId + ' → ' + aid + ' ' + prevState + ' → ' + pursuitState
      );
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
            alertedSet.add(ally); // L2 的不会再触发别人
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
    updateHexapodEngage,
    onEnemyDamaged,
    shareAggro,
    findNearestPlayer,
    moveZombieToward,
    canZombieAttack,
  };

  console.log(
    '🧠 敌人AI系统 v0.28.0 | 车辆: PATROL→CHASE→ENGAGE→FLEE | 丧尸: IDLE→PATROL→ALERT→PURSUIT→SEARCH→ATTACK→STAGGER→DEAD'
  );
})();
