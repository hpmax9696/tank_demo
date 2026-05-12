/**
 * 战利品拾取物模型 — 医疗工具箱（加血道具）
 * v0.26.9: GLB模型优先（红色维修工具箱减面.glb），程序化回退
 * v0.26.5: 程序化生成，带白十字标志+扳手装饰
 */

(function() {

    // ── GLB 工具箱模型缓存 ──
    let glbCache = null;
    let glbBaseScale = 1.0;
    let glbBBox = null;
    let glbLoading = false;

    // 预加载 GLB 工具箱模型
    function preloadGLB() {
        if (glbCache || glbLoading) return;
        glbLoading = true;

        if (typeof THREE === 'undefined' || !THREE.GLTFLoader) {
            console.warn('🧰 GLTFLoader 不可用，使用程序化工具箱');
            glbLoading = false;
            return;
        }

        const loader = new THREE.GLTFLoader();
        loader.load('models/glb/红色维修工具箱减面.glb', (gltf) => {
            glbCache = gltf.scene;
            glbBBox = new THREE.Box3().setFromObject(gltf.scene);
            const sz = new THREE.Vector3();
            glbBBox.getSize(sz);

            // 目标高度与原程序化工具箱一致（~0.40m）
            const targetH = 0.40;
            const refDim = Math.max(sz.x, sz.y, sz.z);
            glbBaseScale = (refDim > 0.001) ? (targetH / refDim) : 1.0;

            console.log('🧰 GLB红色维修工具箱已加载 | 原始:',
                sz.x.toFixed(2), '×', sz.y.toFixed(2), '×', sz.z.toFixed(2),
                '| 缩放: ×' + glbBaseScale.toFixed(4),
                '| 场景高度≈' + (sz.y * glbBaseScale).toFixed(2) + 'm');

            // 启用阴影（遍历所有网格）
            gltf.scene.traverse(c => {
                if (c.isMesh) {
                    c.castShadow = true;
                    c.receiveShadow = true;
                }
            });
        }, undefined, (err) => {
            console.warn('🧰 GLB工具箱加载失败，使用程序化回退:', err.message);
            glbCache = null;
            glbLoading = false;
        });
    }

    // 脚本加载时立即启动预加载
    preloadGLB();

    function makeToolbox() {
        // ── GLB 模型优先 ──
        if (glbCache) {
            // 外层 Group（position 由 spawnPickup 设置，内层子模型负责居中偏移）
            const group = new THREE.Group();
            const model = glbCache.clone(true);
            const s = glbBaseScale;
            model.scale.setScalar(s);

            // 底部贴地居中（偏移放在子模型上，外层Group保持原点）
            if (glbBBox) {
                const center = new THREE.Vector3();
                glbBBox.getCenter(center);
                model.position.set(-center.x * s, -glbBBox.min.y * s, -center.z * s);
            }

            // 启用阴影
            model.traverse(c => {
                if (c.isMesh) {
                    c.castShadow = true;
                    c.receiveShadow = true;
                }
            });

            group.add(model);

            // 存储元数据（与原程序化模型一致）
            group.userData = {
                modelType: 'pickup',
                pickupType: 'heal',
                healAmount: 30,
                tooltip: '医疗工具箱 (+30 HP)'
            };

            return group;
        }

        // ── 回退：程序化工具箱（GLB未就绪时） ──
        return makeToolboxProcedural();
    }

    function makeToolboxProcedural() {
        const group = new THREE.Group();

        // ===== 1. 箱体主体 =====
        const bodyGeo = new THREE.BoxGeometry(0.50, 0.30, 0.35);
        const bodyMat = new THREE.MeshStandardMaterial({
            color: 0xcc3322,
            roughness: 0.5,
            metalness: 0.15
        });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.y = 0.15;
        body.castShadow = true;
        group.add(body);

        // ===== 2. 箱盖 =====
        const lidGeo = new THREE.BoxGeometry(0.54, 0.06, 0.38);
        const lidMat = new THREE.MeshStandardMaterial({
            color: 0xdd4433,
            roughness: 0.45,
            metalness: 0.2
        });
        const lid = new THREE.Mesh(lidGeo, lidMat);
        lid.position.y = 0.33;
        lid.castShadow = true;
        group.add(lid);

        // ===== 3. 金属边角护条（4角圆柱） =====
        const cornerGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.30, 8);
        const cornerMat = new THREE.MeshStandardMaterial({
            color: 0xaaaaaa,
            roughness: 0.3,
            metalness: 0.8
        });
        const corners = [
            [ 0.25, 0.15,  0.175],
            [-0.25, 0.15,  0.175],
            [ 0.25, 0.15, -0.175],
            [-0.25, 0.15, -0.175]
        ];
        corners.forEach(([cx, cy, cz]) => {
            const c = new THREE.Mesh(cornerGeo, cornerMat);
            c.position.set(cx, cy, cz);
            c.castShadow = true;
            group.add(c);
        });

        // ===== 4. 提手（半环形金属管） =====
        const handleGeo = new THREE.TorusGeometry(0.12, 0.025, 8, 8, Math.PI);
        const handleMat = new THREE.MeshStandardMaterial({
            color: 0xcccccc,
            roughness: 0.25,
            metalness: 0.9
        });
        const handle = new THREE.Mesh(handleGeo, handleMat);
        handle.position.y = 0.39;
        handle.rotation.x = Math.PI / 2;
        handle.rotation.z = Math.PI / 2;
        handle.castShadow = true;
        group.add(handle);

        // ===== 5. 顶部白色十字标志 =====
        const crossMat = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            roughness: 0.3,
            metalness: 0.1,
            emissive: 0x222222,
            emissiveIntensity: 0.3
        });
        const vBarGeo = new THREE.BoxGeometry(0.04, 0.015, 0.16);
        const vBar = new THREE.Mesh(vBarGeo, crossMat);
        vBar.position.y = 0.38;
        group.add(vBar);
        const hBarGeo = new THREE.BoxGeometry(0.16, 0.015, 0.04);
        const hBar = new THREE.Mesh(hBarGeo, crossMat);
        hBar.position.y = 0.38;
        group.add(hBar);

        // ===== 6. 正面扳手装饰 =====
        const wrenchGroup = new THREE.Group();
        const wrenchMat = new THREE.MeshStandardMaterial({
            color: 0xdddddd,
            roughness: 0.35,
            metalness: 0.85
        });
        const wrHandleGeo = new THREE.BoxGeometry(0.018, 0.15, 0.035);
        const wrHandle = new THREE.Mesh(wrHandleGeo, wrenchMat);
        wrHandle.position.y = -0.06;
        wrenchGroup.add(wrHandle);
        const holeGeo = new THREE.TorusGeometry(0.012, 0.004, 4, 8);
        const hole = new THREE.Mesh(holeGeo, wrenchMat);
        hole.position.set(0, -0.135, 0);
        hole.rotation.x = Math.PI / 2;
        wrenchGroup.add(hole);
        const headOuterGeo = new THREE.TorusGeometry(0.045, 0.012, 6, 12, Math.PI * 1.3);
        const headOuter = new THREE.Mesh(headOuterGeo, wrenchMat);
        headOuter.rotation.z = Math.PI * 0.65;
        headOuter.position.y = 0.075;
        wrenchGroup.add(headOuter);
        const jawGeo = new THREE.BoxGeometry(0.008, 0.025, 0.012);
        const jaw1 = new THREE.Mesh(jawGeo, wrenchMat);
        jaw1.position.set(-0.022, 0.088, 0);
        jaw1.rotation.z = 0.3;
        wrenchGroup.add(jaw1);
        const jaw2 = new THREE.Mesh(jawGeo, wrenchMat);
        jaw2.position.set(0.022, 0.088, 0);
        jaw2.rotation.z = -0.3;
        wrenchGroup.add(jaw2);
        wrenchGroup.position.set(0, 0.18, 0.20);
        wrenchGroup.rotation.z = Math.PI / 4;
        group.add(wrenchGroup);

        // ===== 7. 底部发光环 =====
        const ringGeo = new THREE.TorusGeometry(0.22, 0.03, 8, 16);
        const ringMat = new THREE.MeshStandardMaterial({
            color: 0xff4444,
            roughness: 0.4,
            metalness: 0.3,
            emissive: 0xff2222,
            emissiveIntensity: 0.6
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = Math.PI / 2;
        ring.position.y = 0.02;
        group.add(ring);

        // 存储元数据
        group.userData = {
            modelType: 'pickup',
            pickupType: 'heal',
            healAmount: 30,
            tooltip: '医疗工具箱 (+30 HP)'
        };

        return group;
    }

    // 注册到模型系统（GLB优先，程序化回退）
    window.ModelRegistry.register('pickups', '医疗工具箱', makeToolbox);

    console.log('🧰 拾取物模型已就绪 | 医疗工具箱 (GLB优先 + 程序化回退)');
})();
