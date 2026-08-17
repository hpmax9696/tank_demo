// verify_shorts_seam_runtime.js — 男学生短裤白色缝线 浏览器验证
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
  const p = await browser.newPage(); collect(p);
  await p.goto('http://127.0.0.1:8080/index.html'); await p.waitForTimeout(3000);
  const r = await p.evaluate(() => {
    const z = window.EnemyModels.createCampusZombie({ variant: 'student_m', seed: 5 });
    z.updateMatrixWorld(true);
    const seams = [];
    z.traverse((c) => { if (c.name === 'ah_sm_seam_mesh') seams.push(c); });
    const legs = [];
    z.traverse((c) => { if (c.name === 'l_upper_leg_pivot' || c.name === 'r_upper_leg_pivot') legs.push({ n: c.name, x: c.getWorldPosition(new THREE.Vector3()).x }); });
    return seams.map((s) => ({
      matColor: s.material && s.material.color ? '#' + s.material.color.getHexString() : null,
      x: s.getWorldPosition(new THREE.Vector3()).x,
      legXL: legs.find((l) => l.n === 'l_upper_leg_pivot').x,
      legXR: legs.find((l) => l.n === 'r_upper_leg_pivot').x,
      vcount: s.geometry.attributes.position.count,
    }));
  });
  ok(r.length === 2, '游戏侧缝线 mesh ×2（实测 ' + r.length + '）');
  r.forEach((s, i) => {
    const side = i === 0 ? '左' : '右';
    ok(s.matColor === '#f8f8f8', side + '缝线白色（#' + s.matColor + '）');
    ok(s.vcount >= 24, side + '缝线几何正常（' + s.vcount + ' 顶点）');
  });
  // 外侧判定：缝线 x 应在对应腿的外侧（远离身体中线）
  const sorted = r.slice().sort((a, b) => b.x - a.x);
  ok(sorted[0].x > sorted[0].legXL + 0.03 * Math.sign(sorted[0].legXL), '+X 侧缝线在 +X 腿外侧（缝 ' + sorted[0].x.toFixed(3) + ' / 腿 ' + sorted[0].legXL.toFixed(3) + '）');
  ok(sorted[1].x < sorted[1].legXR - 0.03 * Math.abs(sorted[1].legXR), '-X 侧缝线在 -X 腿外侧（缝 ' + sorted[1].x.toFixed(3) + ' / 腿 ' + sorted[1].legXR.toFixed(3) + '）');
  // 工厂侧
  const p2 = await browser.newPage(); collect(p2);
  await p2.goto('http://127.0.0.1:8080/model_factory.html');
  await p2.evaluate(() => localStorage.setItem('tank_model_factory_save', JSON.stringify({ modelType: 'humanoid' })));
  await p2.reload(); await p2.waitForTimeout(2500);
  const r2 = await p2.evaluate(() => {
    _humanoidEdit.variant = 'student_m';
    _applyHumanoidEdit();
    let n = 0;
    modelRoot.traverse((c) => { if (c.name === 'ah_sm_seam_mesh') n++; });
    return n;
  });
  ok(r2 === 2, '工厂侧缝线 mesh ×2（实测 ' + r2 + '）');
  await p2.waitForTimeout(300);
  await p2.screenshot({ path: 'artifacts/shorts_seam_student_m.png' });
  console.log('  📸 截图 artifacts/shorts_seam_student_m.png');
  ok(errors.length === 0, '0 控制台错误' + (errors.length ? ': ' + errors.slice(0, 3).join(';') : ''));
  console.log('Playwright: ' + pass + ' passed, ' + fail + ' failed');
  await browser.close();
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
