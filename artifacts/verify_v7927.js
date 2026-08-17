// v0.79.27 验证：Die 整体下沉躯干贴地 + 裙前摆自然没入 + 姿势无花活（无裙轨道）
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const errors = [];
  let pass = 0, fail = 0;
  const ok = (c, m) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m); } };
  const p = await browser.newPage();
  p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  p.on('pageerror', (e) => errors.push(e.message));
  await p.goto('http://127.0.0.1:8080/index.html'); await p.waitForTimeout(3000);
  const r = await p.evaluate(() => {
    const HC = window.HumanoidConfig;
    const out = {};
    ['student_f', 'student_m', 'teacher_m', 'teacher_f'].forEach((v) => {
      const za = HC.MODELS[v].zombieAnims;
      const hasSkirtTracks = !!za.actions.Die.some((t) => String(t.joint).includes('skirt'));
      const rootY = za.actions.Die.find((t) => t.joint === 'root' && t.axis === 'y').keys[3].v;
      const z = window.EnemyModels.createCampusZombie({ variant: v, seed: 5 });
      const asys = z.userData._animSystem;
      asys.play('Die', false);
      for (let i = 0; i < 100; i++) asys.update(0.016);
      z.updateMatrixWorld(true);
      const worldMinY = (c) => {
        const pos = c.geometry.attributes.position;
        const vv = new THREE.Vector3();
        let my = Infinity;
        for (let i = 0; i < pos.count; i++) { vv.fromBufferAttribute(pos, i).applyMatrix4(c.matrixWorld); if (vv.y < my) my = vv.y; }
        return my;
      };
      let trunkMin = 99, limbMin = 99, skirtMin = 99;
      z.traverse((c) => {
        if (!c.isMesh) return;
        const my = worldMinY(c);
        if (c.name === 'ah_skirt_mesh' || c.name === 'ah_gskirt_mesh') { skirtMin = Math.min(skirtMin, my); return; }
        if (c.name.startsWith('pelvis_mesh') || c.name.startsWith('torso_')) { trunkMin = Math.min(trunkMin, my); return; }
        if (c.name.endsWith('_mesh') && (c.name.includes('leg') || c.name.includes('arm') || c.name.includes('head') || c.name.includes('_foot'))) limbMin = Math.min(limbMin, my);
      });
      out[v] = { hasSkirtTracks, rootY, trunkMin, limbMin, skirtMin };
    });
    return out;
  });
  ['student_f', 'student_m', 'teacher_m', 'teacher_f'].forEach((v) => {
    ok(!r[v].hasSkirtTracks, v + ': Die 无裙轨道（姿势自然）');
    ok(Math.abs(r[v].trunkMin) < 0.04, v + ': 躯干贴地 trunkMin=' + r[v].trunkMin.toFixed(3) + '（root 高度 ' + r[v].rootY + '）');
    ok(r[v].limbMin > -0.09, v + ': 四肢贴地（微穿 ≤9cm 视为贴地防浮空）limbMin=' + r[v].limbMin.toFixed(3));
    if (v === 'student_f' || v === 'teacher_f') {
      ok(r[v].skirtMin < 0.0, v + ': 裙前摆自然没入地面 skirtMin=' + r[v].skirtMin.toFixed(3) + '（<0）');
    }
  });
  ok(errors.length === 0, '0 控制台错误' + (errors.length ? ': ' + errors.slice(0, 3).join(';') : ''));
  console.log('Playwright: ' + pass + ' passed, ' + fail + ' failed');
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
