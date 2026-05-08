/**
 * 程序化草丛模型 — 弯曲草叶
 * 低草丛(0.2-0.4m) / 中草丛(0.4-0.7m) / 高草丛(0.7-1.0m)
 * 每片草叶使用贝塞尔曲线 + 锥形环管几何体，模拟自然弯曲弧度
 */
(function() {
    // ---- 弯曲锥形草叶几何体 ----
    // 沿 QuadraticBezierCurve3 路径，从底到顶半径线性递减，生成一系列圆环并三角化
    function createBladeGeometry(start, end, control, baseR, tipR, curveSegs, radialSegs) {
        const curve = new THREE.QuadraticBezierCurve3(start, end, control);
        const rings = curveSegs + 1; // 采样点数
        const verts = [];
        const indices = [];

        // 采样环
        for (let i = 0; i < rings; i++) {
            const t = i / curveSegs;
            const pt = curve.getPoint(t);
            const r = baseR + (tipR - baseR) * t; // 半径线性递减
            // 计算环的局部法线（曲线切线方向的垂直平面）
            const tangent = curve.getTangent(t).normalize();
            // 构造两个正交向量作为环平面基底
            const up = new THREE.Vector3(0, 1, 0);
            const axisX = new THREE.Vector3().crossVectors(up, tangent).normalize();
            if (axisX.length() < 0.01) axisX.set(1, 0, 0).crossVectors(new THREE.Vector3(0, 0, 1), tangent).normalize();
            const axisY = new THREE.Vector3().crossVectors(tangent, axisX).normalize();

            for (let j = 0; j < radialSegs; j++) {
                const angle = (j / radialSegs) * Math.PI * 2;
                const vx = pt.x + (Math.cos(angle) * axisX.x + Math.sin(angle) * axisY.x) * r;
                const vy = pt.y + (Math.cos(angle) * axisX.y + Math.sin(angle) * axisY.y) * r;
                const vz = pt.z + (Math.cos(angle) * axisX.z + Math.sin(angle) * axisY.z) * r;
                verts.push(vx, vy, vz);
            }
        }

        // 三角化：连接相邻环
        for (let i = 0; i < curveSegs; i++) {
            for (let j = 0; j < radialSegs; j++) {
                const a = i * radialSegs + j;
                const b = i * radialSegs + (j + 1) % radialSegs;
                const c = (i + 1) * radialSegs + j;
                const d = (i + 1) * radialSegs + (j + 1) % radialSegs;
                indices.push(a, b, d);
                indices.push(a, d, c);
            }
        }

        // 封顶（尖端）
        const tipIdx = rings * radialSegs;
        const tipPt = curve.getPoint(1);
        verts.push(tipPt.x, tipPt.y, tipPt.z);
        for (let j = 0; j < radialSegs; j++) {
            const a = (rings - 1) * radialSegs + j;
            const b = (rings - 1) * radialSegs + (j + 1) % radialSegs;
            indices.push(tipIdx, b, a);
        }

        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
        geo.setIndex(indices);
        geo.computeVertexNormals();
        return geo;
    }

    // ---- 单簇草丛生成 ----
    function createGrassBush(config) {
        const group = new THREE.Group();
        const {
            bladeCount, minHeight, maxHeight, clusterRadius,
            colors, baseRadius, tipRadius,
            curveSegs, radialSegs, spreadAngle, seed
        } = config;

        // 可复现伪随机
        function srand(s) {
            let x = Math.sin(s * 127.1 + 311.7) * 43758.5453;
            return x - Math.floor(x);
        }

        for (let i = 0; i < bladeCount; i++) {
            const s = seed + i * 0.618;

            // 草丛内位置（偏向中心分布）
            const angle = srand(s) * Math.PI * 2;
            const dist = clusterRadius * Math.pow(srand(s + 0.1), 0.55);
            const baseX = Math.cos(angle) * dist;
            const baseZ = Math.sin(angle) * dist;

            // 草叶高度
            const h = minHeight + srand(s + 0.2) * (maxHeight - minHeight);

            // 外倾方向
            const tiltAngle = srand(s + 0.3) * spreadAngle;
            const tiltDir = srand(s + 0.4) * Math.PI * 2;
            const tipX = baseX + Math.cos(tiltDir) * Math.sin(tiltAngle) * h * 0.7;
            const tipZ = baseZ + Math.sin(tiltDir) * Math.sin(tiltAngle) * h * 0.7;

            // 贝塞尔曲线：起点→控制点（弯曲）→终点
            const start = new THREE.Vector3(baseX, 0, baseZ);
            const end = new THREE.Vector3(tipX, h, tipZ);
            // 控制点在 55% 高度处，向外偏移量更大以形成弧线
            const ctrl = new THREE.Vector3(
                baseX + (tipX - baseX) * 0.7,
                h * 0.5,
                baseZ + (tipZ - baseZ) * 0.7
            );

            // 叶片半径微变异
            const br = baseRadius * (0.8 + srand(s + 0.5) * 0.4);
            const tr = tipRadius * (0.6 + srand(s + 0.6) * 0.8);

            const geo = createBladeGeometry(start, end, ctrl, br, tr, curveSegs, radialSegs);

            const colorIdx = Math.floor(srand(s + 0.7) * colors.length);
            const mat = new THREE.MeshStandardMaterial({
                color: colors[colorIdx],
                roughness: 0.7,
                metalness: 0.02,
                flatShading: true,
                side: THREE.DoubleSide
            });

            const blade = new THREE.Mesh(geo, mat);
            blade.castShadow = true;
            blade.receiveShadow = true;
            group.add(blade);
        }

        return group;
    }

    // 颜色方案
    const grassGreens  = ['#5a8a3c','#6b9b4a','#4a7a2e','#7aaa50','#558a38','#3d6b25'];
    const dryGreens    = ['#8a9a4a','#7a8a3c','#9aaa5a','#6a7a30'];
    const darkGreens   = ['#3a5a20','#2e4a18','#406028','#35581e','#4a6a30','#335020'];

    // ---- 低草丛: 0.2~0.4m ----
    function createLowGrass() {
        const g = createGrassBush({
            bladeCount: 12,
            minHeight: 0.2,
            maxHeight: 0.4,
            clusterRadius: 0.30,
            colors: grassGreens,
            baseRadius: 0.012,
            tipRadius: 0.002,
            curveSegs: 6,
            radialSegs: 5,
            spreadAngle: 0.35,
            seed: 100
        });
        g.userData = { label: '低草丛', height: '0.2~0.4m' };
        return g;
    }

    // ---- 中草丛: 0.4~0.7m ----
    function createMidGrass() {
        const g = createGrassBush({
            bladeCount: 18,
            minHeight: 0.4,
            maxHeight: 0.7,
            clusterRadius: 0.45,
            colors: [...grassGreens, ...dryGreens],
            baseRadius: 0.016,
            tipRadius: 0.003,
            curveSegs: 7,
            radialSegs: 5,
            spreadAngle: 0.45,
            seed: 200
        });
        g.userData = { label: '中草丛', height: '0.4~0.7m' };
        return g;
    }

    // ---- 高草丛: 0.7~1.0m ----
    function createHighGrass() {
        const g = createGrassBush({
            bladeCount: 26,
            minHeight: 0.7,
            maxHeight: 1.0,
            clusterRadius: 0.60,
            colors: [...darkGreens, ...grassGreens, ...dryGreens],
            baseRadius: 0.020,
            tipRadius: 0.004,
            curveSegs: 8,
            radialSegs: 5,
            spreadAngle: 0.55,
            seed: 300
        });
        g.userData = { label: '高草丛', height: '0.7~1.0m' };
        return g;
    }

    // 注册到模型预览
    window.ModelRegistry.register('grass', 'low',  createLowGrass);
    window.ModelRegistry.register('grass', 'mid',  createMidGrass);
    window.ModelRegistry.register('grass', 'high', createHighGrass);

    // 暴露生成器供游戏场景使用
    window.GrassFactory = { createLowGrass, createMidGrass, createHighGrass };

    console.log('🌿 程序化草丛已注册: 低(0.2-0.4m) ' +
        createLowGrass().children.length + '叶 | 中(0.4-0.7m) ' +
        createMidGrass().children.length + '叶 | 高(0.7-1.0m) ' +
        createHighGrass().children.length + '叶');
})();
