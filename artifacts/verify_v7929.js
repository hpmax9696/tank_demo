// v0.79.29 验证：裤不超脚/裙缩短+切动画无位移/领巾缩小/刘海缺口加宽上移
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

  // 游戏：裤长/裙长/领巾
  const p = await browser.newPage(); collect(p);
  await p.goto('http://127.0.0.1:8080/index.html'); await p.waitForTimeout(3000);
  const r = await p.evaluate(() => {
    const out = {};
    const worldMinMax = (z, name) => {
      let o = null; z.traverse((c) => { if (!o && c.name === name + '_mesh') o = c; });
      if (!o) return null;
      const pos = o.geometry.attributes.position;
      const v = new THREE.Vector3();
      let minY = Infinity, maxY = -Infinity;
      for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld); if (v.y < minY) minY = v.y; if (v.y > maxY) maxY = v.y; }
      return { minY, maxY };
    };
    // 教师男：裤底 vs 脚底
    const tm = window.EnemyModels.createCampusZombie({ variant: 'teacher_m', seed: 5 });
    const leg = worldMinMax(tm, 'ah_tr_l'); // 大腿段
    const calf = worldMinMax(tm, 'ah_tc_l'); // 小腿段
    const foot = worldMinMax(tm, 'l_foot');
    out.tm = { legBottom: leg ? leg.minY : null, calfBottom: calf ? calf.minY : null, footBottom: foot ? foot.minY : null };
    // 学生女：裙长（裙底 vs 膝/踝）
    const sf = window.EnemyModels.createCampusZombie({ variant: 'student_f', seed: 5 });
    const skirt = worldMinMax(sf, 'ah_skirt');
    const knee = worldMinMax(sf, 'l_lower_leg');
    out.sf = { skirtBottom: skirt ? skirt.minY : null, calfTop: knee ? knee.maxY : null, calfBottom: knee ? knee.minY : null };
    // 教师女：裙长
    const tf = window.EnemyModels.createCampusZombie({ variant: 'teacher_f', seed: 5 });
    const gskirt = worldMinMax(tf, 'ah_gskirt');
    const tknee = worldMinMax(tf, 'l_lower_leg');
    out.tf = { skirtBottom: gskirt ? gskirt.minY : null, calfBottom: tknee ? tknee.minY : null };
    // 领巾结尺寸
    const sm = window.EnemyModels.createCampusZombie({ variant: 'student_m', seed: 5 });
    const knot = worldMinMax(sm, 'ah_sc_knot');
    out.knotH = knot ? knot.maxY - knot.minY : null;
    return out;
  });
  ok(r.tm.legBottom > r.tm.footBottom - 0.02, '教师男大腿段裤底 ' + r.tm.legBottom.toFixed(3) + ' ≥ 脚底 ' + r.tm.footBottom.toFixed(3) + '（不再超脚）');
  ok(r.tm.calfBottom > r.tm.footBottom - 0.02, '教师男小腿段裤底 ' + r.tm.calfBottom.toFixed(3) + ' ≥ 脚底（不拖地）');
  ok(r.sf.skirtBottom > r.sf.calfBottom + 0.05, '学生女裙底 ' + r.sf.skirtBottom.toFixed(3) + ' 高于踝 ' + r.sf.calfBottom.toFixed(3) + '（露小腿 0.05+）');
  ok(r.tf.skirtBottom > r.tf.calfBottom + 0.03, '教师女裙底 ' + r.tf.skirtBottom.toFixed(3) + ' 高于踝（露小腿）');
  ok(r.knotH !== null && r.knotH < 0.06, '红领巾结高 ' + r.knotH.toFixed(3) + '（<0.06 不再像红花）');
  await p.close();

  // 工厂：切动画界面裙无上移 + 刘海缺口
  const p2 = await browser.newPage(); collect(p2);
  await p2.goto('http://127.0.0.1:8080/model_factory.html');
  await p2.evaluate(() => localStorage.setItem('tank_model_factory_save', JSON.stringify({ modelType: 'humanoid' })));
  await p2.reload(); await p2.waitForTimeout(2500);
  const r2 = await p2.evaluate(() => {
    const out = {};
    const HA = window.HumanoidAnims;
    const skirtY = () => { let o = null; modelRoot.traverse((c) => { if (!o && c.name === 'ah_skirt') o = c; }); return o ? o.position.y : null; };
    // 切到 student_f
    _humanoidEdit.variant = 'student_f';
    _applyHumanoidEdit();
    out.skirtBefore = skirtY(); // 非动画界面
    HA.collectRefs(); // 模拟进入动画界面
    out.skirtAfter = skirtY();
    // 刘海缺口：眼 vs 刘海块 x 范围（世界）
    modelRoot.updateMatrixWorld(true);
    const xRange = (name) => { let o = null; modelRoot.traverse((c) => { if (!o && c.name === name + '_mesh') o = c; }); if (!o) return null; const b = new THREE.Box3().setFromObject(o); return [b.min.x, b.max.x]; };
    const frL = xRange('ah_fr_l'), frR = xRange('ah_fr_r');
    let eye = null;
    modelRoot.traverse((c) => { if (!eye && c.name === 'l_eye_glow_mesh') { const v = new THREE.Vector3(); c.getWorldPosition(v); eye = v.x; } });
    out.frL = frL; out.frR = frR; out.eye = eye;
    // 刘海与头顶头发间隙：刘海顶 y vs 头发底 y
    const yRange = (name) => { let o = null; modelRoot.traverse((c) => { if (!o && c.name === name + '_mesh') o = c; }); if (!o) return null; const b = new THREE.Box3().setFromObject(o); return [b.min.y, b.max.y]; };
    out.frTop = yRange('ah_fr_l') ? yRange('ah_fr_l')[1] : null;
    out.hairBottom = yRange('ah_m') ? yRange('ah_m')[0] : null;
    return out;
  });
  ok(Math.abs(r2.skirtBefore - r2.skirtAfter) < 0.005, '切动画界面裙无上移（Δ=' + (r2.skirtBefore - r2.skirtAfter).toFixed(4) + '，旧版 -0.0375 被清零）');
  ok(r2.frL !== null && r2.frL[1] < r2.eye - 0.01 && r2.frR[0] > r2.eye + 0.01, '右眼 ' + r2.eye.toFixed(3) + ' 在缺口内（左块到 ' + r2.frL[1].toFixed(3) + ' / 右块从 ' + r2.frR[0].toFixed(3) + '）');
  ok(r2.frTop !== null && r2.hairBottom !== null && r2.hairBottom - r2.frTop < 0.03, '刘海与头顶头发衔接（发底 ' + r2.hairBottom.toFixed(3) + ' - 刘海顶 ' + r2.frTop.toFixed(3) + ' < 0.03 无缝隙）');
  ok(errors.length === 0, '0 控制台错误' + (errors.length ? ': ' + errors.slice(0, 3).join(';') : ''));
  console.log('Playwright: ' + pass + ' passed, ' + fail + ' failed');
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
