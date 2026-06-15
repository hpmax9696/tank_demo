// sky.js — 动态天空系统 v0.1
// 倒置球体着色器天空穹顶 + 两层FBM噪声云层
// 上午10点 晴朗有云 蓝天白云

var SkySystem = (function() {
    'use strict';

    var _scene = null;
    var _camera = null;
    var _skyDome = null;
    var _cloudDome = null;
    var _cloudMat = null;
    var _inited = false;
    var _sunDir = new THREE.Vector3(0.5, 0.6, 0.4); // 太阳方向缓存，供外部对齐光照

    // ── 天空穹顶着色器 ──
    var skyVertSrc = [
        'varying vec3 vWorldPos;',
        'varying float vHeight;',
        'void main() {',
        '  vec4 worldPos = modelMatrix * vec4(position, 1.0);',
        '  vWorldPos = worldPos.xyz;',
        '  vHeight = worldPos.y / ', // will be filled in
        '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
        '}'
    ];

    var skyFragSrc = [
        'varying vec3 vWorldPos;',
        'varying float vHeight;',
        'uniform vec3 uSunDir;',
        'precision highp float;',
        'void main() {',
        '  float h = clamp(vHeight, 0.0, 1.0);',
        '  // 天顶深蓝 → 地平线淡蓝白',
        '  vec3 zenith  = vec3(0.15, 0.38, 0.72);   // #2266bb-ish',
        '  vec3 midSky = vec3(0.38, 0.58, 0.80);    // #6699cc-ish',
        '  vec3 horizon = vec3(0.78, 0.85, 0.91);    // #c8d8e8-ish',
        '  float t1 = smoothstep(0.0, 0.25, h);',
        '  float t2 = smoothstep(0.25, 0.55, h);',
        '  vec3 sky = mix(horizon, midSky, t1);',
        '  sky = mix(sky, zenith, t2);',
        '  // 太阳光晕',
        '  vec3 wNorm = normalize(vWorldPos);',
        '  float sunDot = dot(wNorm, uSunDir);',
        '  float sunGlow = smoothstep(0.0, 0.25, sunDot) * 0.45;',
        '  float sunDisc = smoothstep(0.995, 0.998, sunDot) * 2.5;',
        '  sky += vec3(1.0, 0.95, 0.7) * (sunGlow + sunDisc);',
        '  // 地平线暖色散射',
        '  float horizGlow = (1.0 - abs(h - 0.08)) * smoothstep(0.12, 0.0, abs(h - 0.08));',
        '  sky += vec3(0.12, 0.08, 0.02) * horizGlow * 0.3;',
        '  gl_FragColor = vec4(sky, 1.0);',
        '}'
    ];

    // ── 云层着色器 ──
    var cloudVertSrc = [
        'varying vec3 vWorldPos;',
        'varying float vHeight;',
        'void main() {',
        '  vec4 worldPos = modelMatrix * vec4(position, 1.0);',
        '  vWorldPos = worldPos.xyz;',
        '  vHeight = worldPos.y / ', // will be filled in
        '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
        '}'
    ];

    var cloudFragSrc = [
        'varying vec3 vWorldPos;',
        'varying float vHeight;',
        'uniform float uTime;',
        'uniform vec3 uSunDir;',
        '',
        'precision highp float;',
        '',
        'float hash(vec2 p) {',
        '  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);',
        '}',
        '',
        'float noise(vec2 p) {',
        '  vec2 i = floor(p);',
        '  vec2 f = fract(p);',
        '  f = f * f * (3.0 - 2.0 * f);',
        '  return mix(',
        '    mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),',
        '    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),',
        '    f.y',
        '  );',
        '}',
        '',
        'float fbm(vec2 p) {',
        '  float v = 0.0, a = 0.5;',
        '  vec2 shift = vec2(100.0);',
        '  for (int i = 0; i < 3; i++) {',
        '    v += a * noise(p);',
        '    p = p * 2.0 + shift;',
        '    a *= 0.5;',
        '  }',
        '  return v;',
        '}',
        '',
        'void main() {',
        '  // 低于地平面的丢弃',
        '  if (vHeight < 0.01) discard;',
        '',
        '  // 世界坐标投影到水平面',
        '  vec3 wNorm = normalize(vWorldPos);',
        '  float upDot = wNorm.y;',
        '  vec2 domeXZ = vWorldPos.xz / (abs(wNorm.y) + 0.15);',
        '',
        '  // ── 高层云：大尺度、快速、稀疏 ──',
        '  float t1 = uTime * 0.06;',
        '  float n1 = fbm(domeXZ * 0.012 + vec2(t1, t1 * 0.7));',
        '  float cld1 = smoothstep(0.42, 0.62, n1);',
        '  // 高层云集中在天空上部',
        '  float hMask1 = smoothstep(0.15, 0.50, upDot);',
        '  cld1 *= hMask1;',
        '',
        '  // ── 低层云：小尺度、慢速、浓密 ──',
        '  float t2 = uTime * 0.03;',
        '  float n2 = fbm(domeXZ * 0.018 + vec2(-t2 * 0.8, t2 * 0.5));',
        '  float cld2 = smoothstep(0.35, 0.58, n2);',
        '  // 低层云全域分布，地平线处渐隐',
        '  float hMask2 = smoothstep(0.01, 0.30, upDot);',
        '  cld2 *= hMask2;',
        '',
        '  // ── 合并 + 太阳照亮 ──',
        '  float cld = cld1 * 0.55 + cld2 * 0.8;',
        '  cld = clamp(cld, 0.0, 1.0);',
        '  float sunFac = dot(wNorm, uSunDir) * 0.5 + 0.5;',
        '  vec3 cldCol = mix(vec3(0.85, 0.85, 0.85), vec3(1.0, 0.98, 0.9), sunFac * 0.4);',
        '  // 地平线附近云染淡蓝',
        '  cldCol = mix(cldCol, vec3(0.7, 0.78, 0.85), smoothstep(0.01, 0.12, upDot) * (1.0 - upDot) * 2.0);',
        '',
        '  gl_FragColor = vec4(cldCol, cld * 0.9);',
        '}'
    ];

    // ── 构建球体 + ShaderMaterial ──
    function _buildDome(radius, vertSrc, fragSrc, uniforms, transparent) {
        var geo = new THREE.SphereGeometry(radius, 96, 48);
        var mat = new THREE.ShaderMaterial({
            vertexShader: vertSrc,
            fragmentShader: fragSrc,
            uniforms: uniforms,
            side: THREE.BackSide,
            depthWrite: false,
            transparent: !!transparent,
            blending: transparent ? THREE.NormalBlending : THREE.NoBlending,
        });
        var mesh = new THREE.Mesh(geo, mat);
        mesh.renderOrder = transparent ? 1 : 0;
        mesh.frustumCulled = false; // 球体包围盒可能被截锥体裁掉，禁用
        return mesh;
    }

    // ── 公开API ──
    function init(scene, camera) {
        _scene = scene;
        _camera = camera;
        _resize();

        // 接管背景和雾
        scene.background = null;

        _inited = true;
    }

    function _resize() {
        var maxSide = 150;
        if (typeof worldHalfW !== 'undefined' && typeof worldHalfD !== 'undefined') {
            maxSide = Math.max(worldHalfW, worldHalfD);
        }

        var domeR = maxSide * 1.7;
        var cloudR = maxSide * 1.65;
        var fogNear = maxSide * 0.4;
        var fogFar = maxSide * 1.6;
        var camFar = maxSide * 2.2;

        // 清理旧穹顶
        if (_skyDome && _skyDome.parent) {
            _skyDome.parent.remove(_skyDome);
            _skyDome.geometry.dispose();
            _skyDome.material.dispose();
        }
        if (_cloudDome && _cloudDome.parent) {
            _cloudDome.parent.remove(_cloudDome);
            _cloudDome.geometry.dispose();
            _cloudDome.material.dispose();
        }

        // 太阳方向：上午10点 → 东偏南，仰角~35°
        var sunElev = 35 * Math.PI / 180;
        var sunAzim = 120 * Math.PI / 180; // 东偏南(120°=从北顺时针)
        var sunDir = new THREE.Vector3(
            Math.sin(sunAzim) * Math.cos(sunElev),
            Math.sin(sunElev),
            -Math.cos(sunAzim) * Math.cos(sunElev)
        ).normalize();
        _sunDir.copy(sunDir);

        // 注入穹顶半径到着色器
        var sVert = skyVertSrc.join('\n').replace('vHeight = worldPos.y / ', 'vHeight = worldPos.y / ' + domeR.toFixed(1) + ';');
        var cVert = cloudVertSrc.join('\n').replace('vHeight = worldPos.y / ', 'vHeight = worldPos.y / ' + cloudR.toFixed(1) + ';');

        // 天空穹顶
        _skyDome = _buildDome(domeR, sVert, skyFragSrc.join('\n'), {
            uSunDir: { value: sunDir }
        }, false);
        _scene.add(_skyDome);

        // 云层穹顶
        _cloudDome = _buildDome(cloudR, cVert, cloudFragSrc.join('\n'), {
            uTime: { value: 0 },
            uSunDir: { value: sunDir }
        }, true);
        _cloudMat = _cloudDome.material;
        _scene.add(_cloudDome);

        // 雾
        _scene.fog = new THREE.Fog('#c8d8e0', fogNear, fogFar);

        // 摄像机远平面
        if (_camera && _camera.far < camFar) {
            _camera.far = camFar;
            _camera.updateProjectionMatrix();
        }

        // 围墙颜色已在 engine.js createGround 中处理
    }

    function update(dt) {
        if (!_inited || !_camera) return;

        // 穹顶跟随摄像机
        var cp = _camera.position;
        if (_skyDome) _skyDome.position.copy(cp);
        if (_cloudDome) _cloudDome.position.copy(cp);

        // 云层时间推进
        if (_cloudMat) {
            _cloudMat.uniforms.uTime.value += dt;
        }
    }

    function dispose() {
        if (_skyDome && _skyDome.parent) {
            _skyDome.parent.remove(_skyDome);
            _skyDome.geometry.dispose();
            _skyDome.material.dispose();
        }
        if (_cloudDome && _cloudDome.parent) {
            _cloudDome.parent.remove(_cloudDome);
            _cloudDome.geometry.dispose();
            _cloudDome.material.dispose();
        }
        _skyDome = null;
        _cloudDome = null;
        _cloudMat = null;
        _inited = false;
    }

    return {
        init: init,
        update: update,
        resize: _resize,
        dispose: dispose,
        getSunDir: function() { return _sunDir; }
    };
})();
