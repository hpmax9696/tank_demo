/**
 * 战利品拾取物模型 — 医疗工具箱（加血道具）
 * v0.26.9: GLB模型优先（红色维修工具箱减面.glb），程序化回退
 * v0.26.5: 程序化生成，带白十字标志+扳手装饰
 */

(function() {

    function makeToolbox() {
        return makeToolboxProcedural();
    }

    function makeToolboxProcedural() {
        const group = new THREE.Group();

        // ===== 1. 倒角主体 (ExtrudeGeometry) =====
        const bw = 0.30, bh = 0.25, bd = 0.10, cornerR = 0.025;
        const shape = new THREE.Shape();
        shape.moveTo(-bw/2 + cornerR, -bh/2);
        shape.lineTo(bw/2 - cornerR, -bh/2);
        shape.quadraticCurveTo(bw/2, -bh/2, bw/2, -bh/2 + cornerR);
        shape.lineTo(bw/2, bh/2 - cornerR);
        shape.quadraticCurveTo(bw/2, bh/2, bw/2 - cornerR, bh/2);
        shape.lineTo(-bw/2 + cornerR, bh/2);
        shape.quadraticCurveTo(-bw/2, bh/2, -bw/2, bh/2 - cornerR);
        shape.lineTo(-bw/2, -bh/2 + cornerR);
        shape.quadraticCurveTo(-bw/2, -bh/2, -bw/2 + cornerR, -bh/2);

        const extrudeOpts = {
            steps: 1,
            depth: bd,
            bevelEnabled: true,
            bevelThickness: 0.006,
            bevelSize: 0.006,
            bevelSegments: 3
        };
        const bodyGeo = new THREE.ExtrudeGeometry(shape, extrudeOpts);
        bodyGeo.translate(0, 0, -bd / 2);
        const bodyMat = new THREE.MeshStandardMaterial({
            color: 0xcc2222,
            roughness: 0.45,
            metalness: 0.10
        });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.castShadow = true;
        body.receiveShadow = true;
        group.add(body);

        // ===== 2. 黑色提手（顶部，跨度沿X=0.3m方向）=====
        const handleGeo = new THREE.TorusGeometry(0.07, 0.012, 8, 16, Math.PI);
        const handleMat = new THREE.MeshStandardMaterial({
            color: 0x111111,
            roughness: 0.4,
            metalness: 0.7
        });
        const handle = new THREE.Mesh(handleGeo, handleMat);
        // 默认Torus在XY平面，弧端在X=±0.07，拱顶在Y=+0.07 → 开口朝下正好扣在箱顶
        handle.position.y = bh / 2;
        handle.castShadow = true;
        group.add(handle);

        // 提手支柱 ×2（连接箱体）
        const postGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.025, 8);
        const postMat = new THREE.MeshStandardMaterial({
            color: 0x222222,
            roughness: 0.35,
            metalness: 0.75
        });
        [-0.065, 0.065].forEach(x => {
            const post = new THREE.Mesh(postGeo, postMat);
            post.position.set(x, bh / 2 + 0.012, 0);
            post.castShadow = true;
            group.add(post);
        });

        // ===== 3. 正面扳手螺丝刀图标（居中贴于侧面）=====
        const iconTex = new THREE.TextureLoader().load('models/toolbox_icon.png');
        iconTex.minFilter = THREE.LinearFilter;
        iconTex.magFilter = THREE.LinearFilter;
        const decalMat = new THREE.MeshBasicMaterial({
            map: iconTex,
            transparent: true,
            side: THREE.DoubleSide,
        });
        // 平面尺寸适应侧面 0.30×0.25，居中贴放
        const decalGeo = new THREE.PlaneGeometry(0.16, 0.16);
        const decal = new THREE.Mesh(decalGeo, decalMat);
        decal.position.z = bd / 2 + 0.008; // 紧贴表面（bevelThickness=0.006）
        group.add(decal);
        group.userData._wrenchDecal = decal;

        // ===== 4. 底部金属边框条 =====
        const railGeo = new THREE.BoxGeometry(bw - 0.04, 0.012, bd - 0.04);
        const railMat = new THREE.MeshStandardMaterial({
            color: 0x333333,
            roughness: 0.3,
            metalness: 0.85
        });
        const rail = new THREE.Mesh(railGeo, railMat);
        rail.position.y = -bh / 2 + 0.006;
        rail.castShadow = true;
        group.add(rail);

        // ===== 5. 底部发光环（悬浮提示）=====
        const ringGeo = new THREE.TorusGeometry(0.12, 0.02, 8, 16);
        const ringMat = new THREE.MeshStandardMaterial({
            color: 0xff4444,
            roughness: 0.4,
            metalness: 0.3,
            emissive: 0xff2222,
            emissiveIntensity: 0.6
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = Math.PI / 2;
        ring.position.y = -bh / 2 - 0.02;
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
