/**
 * 坦克损毁效果 - 火焰 & 烟雾粒子系统
 * 血量低于 50 时触发
 */
(function() {
    const FIRE_COUNT = 40;   // 火焰粒子数
    const SMOKE_COUNT = 30;  // 烟雾粒子数

    // ==================== 粒子组类 ====================
    class DamageEffects {
        constructor(parentGroup) {
            this.parentGroup = parentGroup;
            this.active = false;

            // --- 火焰粒子 ---
            this.firePositions = new Float32Array(FIRE_COUNT * 3);
            this.fireGeo = new THREE.BufferGeometry();
            this.fireGeo.setAttribute('position', new THREE.BufferAttribute(this.firePositions, 3));

            // 火焰颜色：从橙到红到黄
            const fireColors = new Float32Array(FIRE_COUNT * 3);
            for (let i = 0; i < FIRE_COUNT; i++) {
                const t = Math.random();
                if (t < 0.33) { // 橙
                    fireColors[i*3]   = 1.0;
                    fireColors[i*3+1] = 0.3 + Math.random() * 0.3;
                    fireColors[i*3+2] = 0.0;
                } else if (t < 0.66) { // 红
                    fireColors[i*3]   = 0.8 + Math.random() * 0.2;
                    fireColors[i*3+1] = 0.0;
                    fireColors[i*3+2] = 0.0;
                } else { // 黄
                    fireColors[i*3]   = 1.0;
                    fireColors[i*3+1] = 0.8 + Math.random() * 0.2;
                    fireColors[i*3+2] = 0.0;
                }
            }
            this.fireGeo.setAttribute('color', new THREE.BufferAttribute(fireColors, 3));

            this.fireMat = new THREE.PointsMaterial({
                size: 0.6,
                vertexColors: true,
                transparent: true,
                opacity: 1.0,
                depthWrite: false,
                blending: THREE.AdditiveBlending,  // 加法混合让火焰更亮
                sizeAttenuation: true
            });
            this.firePoints = new THREE.Points(this.fireGeo, this.fireMat);
            this.firePoints.visible = false;
            this.firePoints.frustumCulled = false;

            // --- 烟雾粒子 ---
            this.smokePositions = new Float32Array(SMOKE_COUNT * 3);
            this.smokeGeo = new THREE.BufferGeometry();
            this.smokeGeo.setAttribute('position', new THREE.BufferAttribute(this.smokePositions, 3));

            // 烟雾颜色：深灰到浅灰
            const smokeColors = new Float32Array(SMOKE_COUNT * 3);
            for (let i = 0; i < SMOKE_COUNT; i++) {
                const gray = 0.15 + Math.random() * 0.3;
                smokeColors[i*3]   = gray;
                smokeColors[i*3+1] = gray;
                smokeColors[i*3+2] = gray;
            }
            this.smokeGeo.setAttribute('color', new THREE.BufferAttribute(smokeColors, 3));

            this.smokeMat = new THREE.PointsMaterial({
                size: 1.0,
                vertexColors: true,
                transparent: true,
                opacity: 0.6,
                depthWrite: false,
                blending: THREE.NormalBlending
            });
            this.smokePoints = new THREE.Points(this.smokeGeo, this.smokeMat);
            this.smokePoints.visible = false;
            this.smokePoints.frustumCulled = false;

            // 粒子数据
            this.fireData = [];
            this.smokeData = [];
            for (let i = 0; i < FIRE_COUNT; i++) {
                this.fireData.push({ life: 0, maxLife: 0, vel: new THREE.Vector3() });
            }
            for (let i = 0; i < SMOKE_COUNT; i++) {
                this.smokeData.push({ life: 0, maxLife: 0, vel: new THREE.Vector3() });
            }
        }

        show() {
            this.active = true;
            this.firePoints.visible = true;
            this.smokePoints.visible = true;
            // 重置所有粒子
            for (const p of this.fireData) { p.life = 0; }
            for (const p of this.smokeData) { p.life = 0; }
        }

        hide() {
            this.active = false;
            this.firePoints.visible = false;
            this.smokePoints.visible = false;
            for (const p of this.fireData) { p.life = 0; }
            for (const p of this.smokeData) { p.life = 0; }
        }

        update(dt, tankPos) {
            if (!this.active) return;

            // === 火焰 ===
            const fPos = this.fireGeo.attributes.position.array;
            for (let i = 0; i < FIRE_COUNT; i++) {
                const p = this.fireData[i];
                if (p.life <= 0) {
                    // 重生粒子
                    p.life = 0.4 + Math.random() * 0.5;
                    p.maxLife = p.life;
                    p.vel.set(
                        (Math.random() - 0.5) * 1.5,
                        1.5 + Math.random() * 2.0,
                        (Math.random() - 0.5) * 1.5
                    );
                    // 出生位置：在坦克车体上方，随机分布
                    fPos[i*3]   = tankPos.x + (Math.random() - 0.5) * 1.0;
                    fPos[i*3+1] = tankPos.y + 0.5 + Math.random() * 0.5;
                    fPos[i*3+2] = tankPos.z + (Math.random() - 0.5) * 1.0;
                } else {
                    p.life -= dt;
                    fPos[i*3]   += p.vel.x * dt;
                    fPos[i*3+1] += p.vel.y * dt;
                    fPos[i*3+2] += p.vel.z * dt;
                    // 火焰在上升过程中向上加速并扩散
                    p.vel.y += 2.0 * dt;
                    p.vel.x += (Math.random() - 0.5) * 2.0 * dt;
                    p.vel.z += (Math.random() - 0.5) * 2.0 * dt;
                }
            }
            this.fireGeo.attributes.position.needsUpdate = true;
            // 火焰透明度随生命衰减
            this.fireMat.opacity = 1.0;

            // === 烟雾 ===
            const sPos = this.smokeGeo.attributes.position.array;
            for (let i = 0; i < SMOKE_COUNT; i++) {
                const p = this.smokeData[i];
                if (p.life <= 0) {
                    // 烟雾重生（比火焰慢）
                    p.life = 1.0 + Math.random() * 1.5;
                    p.maxLife = p.life;
                    p.vel.set(
                        (Math.random() - 0.5) * 0.8,
                        1.2 + Math.random() * 1.5,
                        (Math.random() - 0.5) * 0.8
                    );
                    sPos[i*3]   = tankPos.x + (Math.random() - 0.5) * 0.8;
                    sPos[i*3+1] = tankPos.y + 0.6 + Math.random() * 0.3;
                    sPos[i*3+2] = tankPos.z + (Math.random() - 0.5) * 0.8;
                } else {
                    p.life -= dt;
                    sPos[i*3]   += p.vel.x * dt;
                    sPos[i*3+1] += p.vel.y * dt;
                    sPos[i*3+2] += p.vel.z * dt;
                    p.vel.y += 0.5 * dt;
                    p.vel.x += (Math.random() - 0.5) * 0.5 * dt;
                    p.vel.z += (Math.random() - 0.5) * 0.5 * dt;
                }
            }
            this.smokeGeo.attributes.position.needsUpdate = true;
            // 烟雾透明度
            this.smokeMat.opacity = 0.55;
        }

        dispose() {
            this.fireGeo.dispose();
            this.fireMat.dispose();
            this.smokeGeo.dispose();
            this.smokeMat.dispose();
        }
    }

    // ==================== 一次性爆炸效果（坦克死亡时触发） ====================
    class ExplosionEffects {
        constructor() {
            this.active = false;

            // --- 大型火焰粒子 ---
            this.fireCount = 120;
            this.firePositions = new Float32Array(this.fireCount * 3);
            this.fireGeo = new THREE.BufferGeometry();
            this.fireGeo.setAttribute('position', new THREE.BufferAttribute(this.firePositions, 3));

            const fireColors = new Float32Array(this.fireCount * 3);
            for (let i = 0; i < this.fireCount; i++) {
                const t = Math.random();
                if (t < 0.25) { // 白色核心
                    fireColors[i*3]   = 1.0;
                    fireColors[i*3+1] = 1.0;
                    fireColors[i*3+2] = 0.8 + Math.random() * 0.2;
                } else if (t < 0.5) { // 黄色
                    fireColors[i*3]   = 1.0;
                    fireColors[i*3+1] = 0.9 + Math.random() * 0.1;
                    fireColors[i*3+2] = 0.0;
                } else if (t < 0.75) { // 橙色
                    fireColors[i*3]   = 1.0;
                    fireColors[i*3+1] = 0.4 + Math.random() * 0.3;
                    fireColors[i*3+2] = 0.0;
                } else { // 红色
                    fireColors[i*3]   = 0.9 + Math.random() * 0.1;
                    fireColors[i*3+1] = 0.0;
                    fireColors[i*3+2] = 0.0;
                }
            }
            this.fireGeo.setAttribute('color', new THREE.BufferAttribute(fireColors, 3));

            this.fireMat = new THREE.PointsMaterial({
                size: 1.2,
                vertexColors: true,
                transparent: true,
                opacity: 1.0,
                depthWrite: false,
                blending: THREE.AdditiveBlending,
                sizeAttenuation: true
            });
            this.firePoints = new THREE.Points(this.fireGeo, this.fireMat);
            this.firePoints.visible = false;

            // --- 爆炸烟雾 ---
            this.smokeCount = 80;
            this.smokePositions = new Float32Array(this.smokeCount * 3);
            this.smokeGeo = new THREE.BufferGeometry();
            this.smokeGeo.setAttribute('position', new THREE.BufferAttribute(this.smokePositions, 3));

            const smokeColors = new Float32Array(this.smokeCount * 3);
            for (let i = 0; i < this.smokeCount; i++) {
                const gray = 0.2 + Math.random() * 0.4;
                smokeColors[i*3]   = gray;
                smokeColors[i*3+1] = gray;
                smokeColors[i*3+2] = gray;
            }
            this.smokeGeo.setAttribute('color', new THREE.BufferAttribute(smokeColors, 3));

            this.smokeMat = new THREE.PointsMaterial({
                size: 2.5,
                vertexColors: true,
                transparent: true,
                opacity: 0.7,
                depthWrite: false,
                blending: THREE.NormalBlending
            });
            this.smokePoints = new THREE.Points(this.smokeGeo, this.smokeMat);
            this.smokePoints.visible = false;

            // 粒子数据
            this.fireData = [];
            this.smokeData = [];
            for (let i = 0; i < this.fireCount; i++) {
                this.fireData.push({ life: 0, maxLife: 0, vel: new THREE.Vector3() });
            }
            for (let i = 0; i < this.smokeCount; i++) {
                this.smokeData.push({ life: 0, maxLife: 0, vel: new THREE.Vector3() });
            }

            this.position = new THREE.Vector3();
        }

        trigger(pos) {
            this.active = true;
            this.position.copy(pos);
            this.firePoints.visible = true;
            this.smokePoints.visible = true;

            // 火焰：从中心爆发（缩短持续时间，更干脆）
            for (let i = 0; i < this.fireCount; i++) {
                const p = this.fireData[i];
                p.life = 0.25 + Math.random() * 0.25;
                p.maxLife = p.life;
                // 初始速度：从中心向四周爆发
                const angle = Math.random() * Math.PI * 2;
                const elev = Math.random() * Math.PI * 0.6;
                const speed = 3.0 + Math.random() * 5.0;
                p.vel.set(
                    Math.cos(angle) * Math.cos(elev) * speed,
                    Math.sin(elev) * speed * 1.5 + 2.0,
                    Math.sin(angle) * Math.cos(elev) * speed
                );
                this.firePositions[i*3]   = pos.x;
                this.firePositions[i*3+1] = pos.y + 0.5;
                this.firePositions[i*3+2] = pos.z;
            }

            // 烟雾：从中心向上升腾
            for (let i = 0; i < this.smokeCount; i++) {
                const p = this.smokeData[i];
                p.life = 1.0 + Math.random() * 0.5;
                p.maxLife = p.life;
                const angle = Math.random() * Math.PI * 2;
                const speed = 0.5 + Math.random() * 2.0;
                p.vel.set(
                    Math.cos(angle) * speed,
                    2.0 + Math.random() * 3.0,
                    Math.sin(angle) * speed
                );
                this.smokePositions[i*3]   = pos.x + (Math.random() - 0.5) * 1.5;
                this.smokePositions[i*3+1] = pos.y + 0.8;
                this.smokePositions[i*3+2] = pos.z + (Math.random() - 0.5) * 1.5;
            }
        }

        update(dt) {
            if (!this.active) return;

            // 用于计算整体透明度（粒子全部死亡后的渐隐）
            let anyAlive = false;
            let minFireLifeRatio = 1.0;
            let minSmokeLifeRatio = 1.0;

            // 火焰更新
            for (let i = 0; i < this.fireCount; i++) {
                const p = this.fireData[i];
                if (p.life > 0) {
                    p.life -= dt;
                    if (p.life < 0) p.life = 0;
                    
                    // 持续更新位置直到生命结束
                    this.firePositions[i*3]   += p.vel.x * dt;
                    this.firePositions[i*3+1] += p.vel.y * dt;
                    this.firePositions[i*3+2] += p.vel.z * dt;
                    // 火焰向上加速并扩散，重力减缓上升
                    p.vel.y -= 3.0 * dt;
                    p.vel.x += (Math.random() - 0.5) * 4.0 * dt;
                    p.vel.z += (Math.random() - 0.5) * 4.0 * dt;
                    
                    anyAlive = true;
                    const lifeRatio = p.life / Math.max(p.maxLife, 0.001);
                    if (lifeRatio < minFireLifeRatio) minFireLifeRatio = lifeRatio;
                } else {
                    // 生命结束但保持最后位置
                    if (minFireLifeRatio < 1.0) minFireLifeRatio = 0;
                }
            }
            this.fireGeo.attributes.position.needsUpdate = true;
            // 火焰透明度基于最小生命周期比例，实现整体渐隐
            this.fireMat.opacity = Math.pow(minFireLifeRatio, 0.5);

            // 烟雾更新
            for (let i = 0; i < this.smokeCount; i++) {
                const p = this.smokeData[i];
                if (p.life > 0) {
                    p.life -= dt;
                    if (p.life < 0) p.life = 0;
                    
                    // 持续更新位置直到生命结束
                    this.smokePositions[i*3]   += p.vel.x * dt;
                    this.smokePositions[i*3+1] += p.vel.y * dt;
                    this.smokePositions[i*3+2] += p.vel.z * dt;
                    p.vel.y -= 0.3 * dt;
                    p.vel.x += (Math.random() - 0.5) * 1.0 * dt;
                    p.vel.z += (Math.random() - 0.5) * 1.0 * dt;
                    
                    anyAlive = true;
                    const lifeRatio = p.life / Math.max(p.maxLife, 0.001);
                    if (lifeRatio < minSmokeLifeRatio) minSmokeLifeRatio = lifeRatio;
                } else {
                    if (minSmokeLifeRatio < 1.0) minSmokeLifeRatio = 0;
                }
            }
            this.smokeGeo.attributes.position.needsUpdate = true;
            // 烟雾透明度基于最小生命周期比例
            this.smokeMat.opacity = Math.pow(minSmokeLifeRatio, 0.3);

            // 所有粒子死亡后隐藏
            if (!anyAlive) {
                this.active = false;
                this.firePoints.visible = false;
                this.smokePoints.visible = false;
            }
        }

        dispose() {
            this.fireGeo.dispose();
            this.fireMat.dispose();
            this.smokeGeo.dispose();
            this.smokeMat.dispose();
        }
    }

    // ==================== 火焰喷射器粒子效果（装甲突击车武器）v0.26.1: 喇叭形+渐进传播 ====================
    const FLAMETHROWER_PARTICLE_COUNT = 80;

    class FlameThrowerEffect {
        constructor() {
            this.active = false;
            this.nozzleWorld = new THREE.Vector3();
            this.fireDir = new THREE.Vector3();
            this.maxRange = 18;  // v0.26.3: 12→18，火焰视觉延伸至18u覆盖交火距离

            const fCount = FLAMETHROWER_PARTICLE_COUNT;
            this.positions = new Float32Array(fCount * 3);
            this.progress = new Float32Array(fCount);  // 每个粒子的传播进度 0~1
            this.geo = new THREE.BufferGeometry();
            this.geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));

            // 火焰颜色：白黄核心→橙黄中段→橙红外层
            const colors = new Float32Array(fCount * 3);
            for (let i = 0; i < fCount; i++) {
                const t = i / fCount;
                if (t < 0.15) {
                    colors[i*3]=1; colors[i*3+1]=1; colors[i*3+2]=0.7;
                } else if (t < 0.4) {
                    colors[i*3]=1; colors[i*3+1]=0.65+Math.random()*0.35; colors[i*3+2]=0;
                } else if (t < 0.7) {
                    colors[i*3]=1; colors[i*3+1]=0.25+Math.random()*0.25; colors[i*3+2]=0;
                } else {
                    colors[i*3]=0.85+Math.random()*0.15; colors[i*3+1]=0; colors[i*3+2]=0;
                }
            }
            this.geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

            this.mat = new THREE.PointsMaterial({
                size: 0.22,
                vertexColors: true,
                transparent: true,
                opacity: 0.85,
                depthWrite: false,
                blending: THREE.AdditiveBlending,
                sizeAttenuation: true
            });
            this.points = new THREE.Points(this.geo, this.mat);
            this.points.visible = false;
            this.points.renderOrder = 997;
            this.points.frustumCulled = false;

            for (let i = 0; i < fCount; i++) {
                this.positions[i*3] = 0; this.positions[i*3+1] = 0; this.positions[i*3+2] = 0;
                this.progress[i] = 0;
            }
            this.geo.attributes.position.needsUpdate = true;
        }

        // v0.26.1: 喇叭形渐进传播 — fireDir 为世界空间方向向量（非目标点）
        update(dt, nozzleWorld, fireDir, isFlaming, maxRange) {
            this.maxRange = maxRange || this.maxRange;
            const wasActive = this.active;
            this.active = isFlaming;
            this.points.visible = isFlaming;

            if (!isFlaming) {
                if (wasActive) {
                    // v0.26.2fix: 立即将所有粒子缩回喷嘴，防止方向切换后残留旧方向火球
                    for (let i = 0; i < FLAMETHROWER_PARTICLE_COUNT; i++) {
                        this.progress[i] = 0;
                        this.positions[i*3]=this.nozzleWorld.x;
                        this.positions[i*3+1]=this.nozzleWorld.y;
                        this.positions[i*3+2]=this.nozzleWorld.z;
                    }
                    this.geo.attributes.position.needsUpdate = true;
                }
                return;
            }

            // v0.26.3fix: 首次激活时立即 snap 粒子到喷嘴，消除从原点飞来的视觉bug
            if (!wasActive) {
                for (let i = 0; i < FLAMETHROWER_PARTICLE_COUNT; i++) {
                    this.progress[i] = Math.random() * 0.12;
                    const rd = this.progress[i] * this.maxRange;
                    this.positions[i*3]   = nozzleWorld.x + fireDir.x * rd;
                    this.positions[i*3+1] = nozzleWorld.y + fireDir.y * rd;
                    this.positions[i*3+2] = nozzleWorld.z + fireDir.z * rd;
                }
            }

            this.nozzleWorld.copy(nozzleWorld);
            this.fireDir.copy(fireDir).normalize();

            const flameSpeed = 28;  // v0.26.3: 14→28，与伤害模型统一（0.15s/跳×28=4.2u/跳）
            const baseSpreadAngle = 0.14;  // 基础锥角 ~8°

            // 垂直于火焰方向的基向量
            const up = new THREE.Vector3(0, 1, 0);
            const perp1 = new THREE.Vector3().crossVectors(this.fireDir, up).normalize();
            if (perp1.length() < 0.1) perp1.set(1, 0, 0);
            const perp2 = new THREE.Vector3().crossVectors(this.fireDir, perp1).normalize();

            for (let i = 0; i < FLAMETHROWER_PARTICLE_COUNT; i++) {
                const idx = i * 3;
                // 推进进度（从喷嘴向前传播）
                this.progress[i] = Math.min(1.0, this.progress[i] + (flameSpeed / this.maxRange) * dt);
                const t = this.progress[i];
                const dist = t * this.maxRange;

                // 喇叭形：远端锥角更大
                const spreadAngle = baseSpreadAngle * (0.3 + t * 0.7);
                const spreadR = dist * Math.tan(spreadAngle);

                // 螺旋分布 + 时间旋转
                const angle = (i / FLAMETHROWER_PARTICLE_COUNT) * Math.PI * 7 + Date.now() * 0.003;
                const jitter = 0.15;

                const targetX = this.nozzleWorld.x + this.fireDir.x * dist
                    + (perp1.x * Math.cos(angle) + perp2.x * Math.sin(angle)) * spreadR * (0.7 + Math.random() * 0.3);
                const targetY = this.nozzleWorld.y + this.fireDir.y * dist
                    + (perp1.y * Math.cos(angle) + perp2.y * Math.sin(angle)) * spreadR * (0.7 + Math.random() * 0.3);
                const targetZ = this.nozzleWorld.z + this.fireDir.z * dist
                    + (perp1.z * Math.cos(angle) + perp2.z * Math.sin(angle)) * spreadR * (0.7 + Math.random() * 0.3);

                // 渐进靠拢（低 lerpSpeed 产生可见传播）
                const lerpSpeed = 3.0 + Math.random() * 4.0;
                this.positions[idx]   += (targetX - this.positions[idx]) * lerpSpeed * dt;
                this.positions[idx+1] += (targetY - this.positions[idx+1]) * lerpSpeed * dt;
                this.positions[idx+2] += (targetZ - this.positions[idx+2]) * lerpSpeed * dt;

                // 粒子生命周期：到达末端或随机重置
                if (this.progress[i] >= 1.0 || Math.random() < 0.015) {
                    this.progress[i] = Math.random() * 0.12;
                    const rd = this.progress[i] * this.maxRange;
                    this.positions[idx]   = this.nozzleWorld.x + this.fireDir.x * rd;
                    this.positions[idx+1] = this.nozzleWorld.y + this.fireDir.y * rd;
                    this.positions[idx+2] = this.nozzleWorld.z + this.fireDir.z * rd;
                }
            }
            this.geo.attributes.position.needsUpdate = true;
            this.mat.opacity = 0.55 + 0.45 * Math.random();
        }

        dispose() {
            this.geo.dispose();
            this.mat.dispose();
        }
    }

    // 暴露到全局
    window.DamageEffects = DamageEffects;
    window.ExplosionEffects = ExplosionEffects;
    window.FlameThrowerEffect = FlameThrowerEffect;
})();
