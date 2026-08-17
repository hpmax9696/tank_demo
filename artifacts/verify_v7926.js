// v0.79.26 验证：发型露眼/裙摆动/Die 身体贴地裙穿地/配饰缩小
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const errors = [];
  let pass = 0, fail = 0;
  const ok = (c, m) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m); } };
  const collect = (p) => {
    p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    p.on('pageerror', (e) => errors.push(e.message));
  };

  // 工厂 student_f：发型露眼 + 裙摆动
  const p = await browser.newPage(); collect(p);
  await p.goto('http://127.0.0.1:8080/model_factory.html');
  await p.evaluate(() => localStorage.setItem('tank_model_factory_save', JSON.stringify({ modelType: 'humanoid' })));
  await p.reload(); await p.waitForTimeout(2500);
  const r = await p.evaluate(() => {
    const out = {};
    // 切到 student_f 变体
    if (typeof _applyHumanoidEdit === 'function') {
      _humanoidEdit.variant = 'student_f';
      _applyHumanoidEdit();
    }
    const HA = window.HumanoidAnims;
    HA.collectRefs();
    modelRoot.updateMatrixWorld(true);
    const wp = (name) => { let o = null; modelRoot.traverse((c) => { if (!o && c.name === name + '_mesh') o = c; }); if (!o) return null; const v = new THREE.Vector3(); o.getWorldPosition(v); return v; };
    const wpA = (name) => { let o = null; modelRoot.traverse((c) => { if (!o && c.name === name) o = c; }); if (!o) return null; const v = new THREE.Vector3(); o.getWorldPosition(v); return v; };
    // 眼睛 vs 发型前缘：眼 z 与发最低前缘 z 比较（后倾后发前缘应高于眼 y）
    const eye = wp('l_eye_glow');
    // 发半球 mesh 世界 bbox
    const hair = wpA('ah_m');
    let hairBox = null;
    modelRoot.traverse((c) => { if (c.name === 'ah_m_mesh') { c.updateWorldMatrix(true, false); hairBox = new THREE.Box3().setFromObject(c); } });
    out.eyeY = eye ? eye.y : null;
    out.hairFrontTopY = hairBox ? hairBox.max.y : null; // 发最高点
    out.hairFrontMinZ = hairBox ? hairBox.min.z : null;
    out.hairFrontY = hairBox ? hairBox.max.y - (hairBox.max.y - hairBox.min.y) : null;
    // 发前缘(z 最大处)最低 y：取 bbox 前侧 z>maxZ-0.01 的 y 范围——简化：整体 min/max
    out.hairMinY = hairBox ? hairBox.min.y : null;
    // 裙摆动：Walk 播 20 帧 看裙 rotation.x 变化
    const skirtRot = () => { let o = null; modelRoot.traverse((c) => { if (!o && c.name === 'ah_skirt') o = c; }); return o ? o.rotation.x : null; };
    HA.updateFrame(0.016, 0, 0, 0, 1);
    out.skirt0 = skirtRot();
    for (let i = 0; i < 40; i++) HA.updateFrame(0.016, 0, 0, 0, 1);
    out.skirt1 = skirtRot();
    return out;
  });
  ok(r.eyeY !== null && r.hairMinY !== null && r.eyeY - r.hairMinY < 0.05, '发型下缘不遮眼（眼 y=' + r.eyeY + ' 发下缘 y=' + r.hairMinY + '，旧版发下缘≈头心下）');
  ok(r.skirt0 !== null && r.skirt1 !== null && Math.abs(r.skirt1 - r.skirt0) > 0.05, 'Walk 裙摆动幅度 ' + Math.abs(r.skirt1 - r.skirt0).toFixed(2) + ' rad');
  await p.close();

  // 游戏：Die 身体贴地 + 裙前摆穿地
  const p2 = await browser.newPage(); collect(p2);
  await p2.goto('http://127.0.0.1:8080/index.html'); await p2.waitForTimeout(3000);
  const r2 = await p2.evaluate(() => {
    const z = window.EnemyModels.createCampusZombie({ variant: 'student_f', seed: 5 });
    const asys = z.userData._animSystem;
    asys.play('Die', false);
    for (let i = 0; i < 100; i++) asys.update(0.016);
    z.updateMatrixWorld(true);
    // 顶点法世界 bbox（headless 无渲染帧，Box3.setFromObject 内部矩阵合成时机不可靠）
    const worldMinY = (c) => {
      const pos = c.geometry.attributes.position;
      const v = new THREE.Vector3();
      let my = Infinity;
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(c.matrixWorld);
        if (v.y < my) my = v.y;
      }
      return my;
    };
    let bodyMin = 99, skirtMin = 99;
    z.traverse((c) => {
      if (!c.isMesh) return;
      const my = worldMinY(c);
      if (c.name === 'ah_skirt_mesh') { skirtMin = Math.min(skirtMin, my); return; }
      if (my < bodyMin) bodyMin = my;
    });
    // 裙口世界位置 vs 骨盆世界位置（脱离检测：裙口应≈骨盆口）
    const wp = (name) => { let o = null; z.traverse((c) => { if (c.name === name) o = c; }); if (!o) return null; const v = new THREE.Vector3(); o.getWorldPosition(v); return [v.x, v.y, v.z]; };
    const skirt = wp('ah_skirt'), pelvis = wp('pelvis');
    const skirtGap = skirt && pelvis ? Math.hypot(skirt[0] - pelvis[0], skirt[1] - pelvis[1], skirt[2] - pelvis[2]) : null;
    const rot = () => { let o = null; z.traverse((c) => { if (c.name === 'ah_skirt') o = c; }); return o ? o.rotation.x : null; };
    // 骨盆颜色（material color）
    let pelvisColor = null;
    z.traverse((c) => { if (!pelvisColor && c.isMesh && c.name === 'pelvis_mesh' && c.material && c.material.color) pelvisColor = c.material.color.getHexString(); });
    return { bodyMin, skirtMin, skirtRot: rot(), rootY: z.position.y, skirtGap, pelvisColor };
  });
  ok(r2.bodyMin > -0.09, 'Die 身体贴地（bodyMin=' + r2.bodyMin.toFixed(3) + '，微穿 ≤9cm 防浮空）');
  ok(r2.skirtMin < r2.bodyMin + 0.05, '裙前摆没入地面（skirtMin=' + r2.skirtMin.toFixed(3) + ' ≤ 身体底）');
  ok(r2.skirtRot === null || Math.abs(r2.skirtRot) < 0.1, '裙自然姿态无旋转花活（rot=' + r2.skirtRot + '，v0.79.27 无裙轨道）');
  ok(r2.skirtGap !== null && r2.skirtGap < 0.06, '裙口连接骨盆（间距 ' + r2.skirtGap.toFixed(3) + ' < 0.06 不脱离）');
  ok(r2.skirtMin < 0.05, '裙身自然没入地面（skirtMin=' + r2.skirtMin.toFixed(3) + ' ≤ 0.05，v0.79.27 整体下沉语义）');
  ok(r2.pelvisColor === 'b81c28' || r2.pelvisColor === '3a3a42', '骨盆裤/裙同色（0x' + r2.pelvisColor + '）');

  ok(errors.length === 0, '0 控制台错误' + (errors.length ? ': ' + errors.slice(0, 3).join(';') : ''));
  console.log('Playwright: ' + pass + ' passed, ' + fail + ' failed');
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
