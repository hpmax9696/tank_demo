// 修复 spawnZombieFromGlb 函数
const fs = require('fs');
const f = 'c:/Users/hpmax/CodeBuddy/tank_demo/index.html';
let t = fs.readFileSync(f, 'utf8');

const startMarker = '        function spawnZombieFromGlb(group) {';
const endMarker = '        function zombieFallbackModel';

const i = t.indexOf(startMarker);
if (i < 0) { console.log('未找到函数开头'); process.exit(1); }
const j = t.indexOf(endMarker, i);
if (j < 0) { console.log('未找到函数结尾'); process.exit(1); }

console.log('旧函数长度:', j - i);

const newFunc = `        function spawnZombieFromGlb(group) {
            if (!_zombieGlbCache.baseScene) return null;
            const model = cloneWithSkinnedMesh(_zombieGlbCache.baseScene);

            // v0.26.15fix: 不修改 Armature 缩放，用缓存baseScale
            const baseScale = _zombieGlbCache.baseScale || 94.76;
            model.scale.setScalar(baseScale);
            const rawMinY = _zombieGlbCache.bboxMinY || -0.012;
            // 先设 position，再 updateMatrixWorld，确保骨骼 matrixWorld 正确
            model.position.set(0, -rawMinY * baseScale, 0);
            model.updateMatrixWorld(true);
            console.log('>> GLB克隆方案 | baseScale:', baseScale.toFixed(3), '| posY:', model.position.y.toFixed(4));

            const skinnedMeshes = [];
            model.traverse(c => {
                if (c.isMesh) {
                    c.castShadow = true;
                    c.receiveShadow = true;
                    c.frustumCulled = false;
                    c.visible = true;
                    if (c.isSkinnedMesh) {
                        skinnedMeshes.push(c);
                        if (c.skeleton && typeof c.skeleton.update === 'function') c.skeleton.update();
                        // 强制开启 skinning
                        if (Array.isArray(c.material)) {
                            c.material.forEach(m => { m.skinning = true; m.needsUpdate = true; });
                        } else if (c.material) {
                            c.material.skinning = true;
                            c.material.needsUpdate = true;
                        }
                    }
                    if (c.material && !c.isSkinnedMesh) {
                        const mats = Array.isArray(c.material) ? c.material : [c.material];
                        mats.forEach(mat => {
                            mat.visible = true;
                            if (typeof mat.opacity === 'number' && mat.opacity <= 0) mat.opacity = 1;
                            mat.needsUpdate = true;
                        });
                    }
                    if (c.geometry) {
                        c.geometry.computeBoundingBox();
                        c.geometry.computeBoundingSphere();
                    }
                }
            });
            group.add(model);
            group.userData.zombieGlbRoot = model;

            // 创建动画控制器
            if (_zombieGlbCache.clips.length > 0) {
                const mixer = new THREE.AnimationMixer(model);
                const clipMap = {};
                const KNOWN_MAP = { idle: ['20aff4d1'], walk: ['97951ef0'], run: ['adfdbf68'],
                    attack: ['31d8bc8b'], hit: ['38bab115'], death: ['6981c077'] };
                for (const [key, names] of Object.entries(KNOWN_MAP)) {
                    const clip = _zombieGlbCache.clips.find(c => names.some(n => c.name.toLowerCase().includes(n)));
                    if (clip) {
                        const action = mixer.clipAction(clip);
                        clipMap[key] = action;
                    }
                }
                console.log('>> 丧尸动画匹配:', Object.keys(clipMap).join(', '), '| 未匹配:',
                    Object.keys(KNOWN_MAP).filter(k => !clipMap[k]).join(', ') || '无');
                group.userData.zombieMixer = mixer;
                group.userData.zombieClips = clipMap;
                group.userData.zombieCurrent = null;
                if (clipMap.idle) { clipMap.idle.reset().play(); group.userData.zombieCurrent = 'idle'; }
                return true;
            }
            return false;
        }`;

t = t.substring(0, i) + newFunc + t.substring(j);
fs.writeFileSync(f, t, 'utf8');
console.log('>> spawnZombieFromGlb 已重新实现');
