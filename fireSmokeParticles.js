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

            let allDead = true;

            // 火焰更新
            for (let i = 0; i < this.fireCount; i++) {
                const p = this.fireData[i];
                if (p.life > 0) {
                    p.life -= dt;
                    this.firePositions[i*3]   += p.vel.x * dt;
                    this.firePositions[i*3+1] += p.vel.y * dt;
                    this.firePositions[i*3+2] += p.vel.z * dt;
                    // 火焰向上加速并扩散，重力减缓上升
                    p.vel.y -= 3.0 * dt;
                    p.vel.x += (Math.random() - 0.5) * 4.0 * dt;
                    p.vel.z += (Math.random() - 0.5) * 4.0 * dt;
                    allDead = false;
                }
            }
            this.fireGeo.attributes.position.needsUpdate = true;
            this.fireMat.opacity = 1.0;

            // 烟雾更新
            for (let i = 0; i < this.smokeCount; i++) {
                const p = this.smokeData[i];
                if (p.life > 0) {
                    p.life -= dt;
                    this.smokePositions[i*3]   += p.vel.x * dt;
                    this.smokePositions[i*3+1] += p.vel.y * dt;
                    this.smokePositions[i*3+2] += p.vel.z * dt;
                    p.vel.y -= 0.3 * dt;
                    p.vel.x += (Math.random() - 0.5) * 1.0 * dt;
                    p.vel.z += (Math.random() - 0.5) * 1.0 * dt;
                    allDead = false;
                }
            }
            this.smokeGeo.attributes.position.needsUpdate = true;

            // 烟雾逐渐消失
            this.smokeMat.opacity = Math.max(0, this.smokeMat.opacity - dt * 0.15);

            // 所有粒子死亡后隐藏
            if (allDead) {
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

    // 暴露到全局
    window.DamageEffects = DamageEffects;
    window.ExplosionEffects = ExplosionEffects;
})();
