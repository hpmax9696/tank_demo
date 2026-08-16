// Run 前迈膝弯验证：大腿前摆极限帧膝角 ≥0.4 rad + 膝世界位置低于髋且高于踝（腿呈弯折 L 形）+ 回归
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const errors = [];
  let pass = 0, fail = 0;
  const ok = (c, m) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m); } };
  const p = await browser.newPage();
  p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  p.on('pageerror', (e) => errors.push(e.message));
  await p.goto('http://127.0.0.1:8080/model_factory.html');
  await p.evaluate(() => localStorage.setItem('tank_model_factory_save', JSON.stringify({ modelType: 'humanoid' })));
  await p.reload(); await p.waitForTimeout(2500);
  const r = await p.evaluate(() => {
    const HC = window.HumanoidConfig, HA = window.HumanoidAnims;
    const ver = HC.getSkeletonList()[0];
    window._currentHumanoidAnims = HC.SKELETON_VERSIONS[ver].anims;
    HA.collectRefs();
    const rot = (n) => { const o = window.modelRoot.getObjectByName(n + '_pivot') || window.modelRoot.getObjectByName(n); return o ? o.rotation.x : null; };
    const wp = (n) => { const o = window.modelRoot.getObjectByName(n); const v = new THREE.Vector3(); o.getWorldPosition(v); return [v.x, v.y, v.z]; };
    // Run idx=2, 0.8s=50帧。左大腿前迈极限在 t=0（帧0）；右腿 t=0.5（帧25）
    const out = [];
    for (let f = 0; f < 51; f++) {
      HA.updateFrame(0.016, 0, 0, 0, 2);
      if (f === 1 || f === 12 || f === 26 || f === 37) { // 前迈帧(1/26) + 折叠帧(12/37)
        out.push({
          f,
          lThigh: rot('l_upper_leg'), lKnee: rot('l_lower_leg'),
          rThigh: rot('r_upper_leg'), rKnee: rot('r_lower_leg'),
          lHip: wp('l_upper_leg'), lKneeP: wp('l_lower_leg'), lAnkle: wp('l_foot') || wp('l_lower_leg'),
        });
      }
    }
    return out;
  });
  const s0 = r[0], s1 = r[1];
  // 左腿前迈帧（大腿 -0.85 附近）
  const frontL = r.find((x) => x.f === 1), frontR = r.find((x) => x.f === 26);
  ok(frontL && frontL.lKnee > 0.4, '左腿前迈膝弯 ' + (frontL ? frontL.lKnee.toFixed(2) : 'N/A') + ' rad（旧 -0.3 过伸→新 ≥0.4）');
  ok(frontR && frontR.rKnee > 0.4, '右腿前迈膝弯 ' + (frontR ? frontR.rKnee.toFixed(2) : 'N/A') + ' rad');
  const lFront = frontL, lAnkleRef = frontL;
  // 世界形态：前迈帧膝（小腿近端）应明显高于踝、且低于髋——腿折叠而非直棍
  if (lFront && lFront.lAnkle) {
    const kneeAboveAnkle = lFront.lKneeP[1] - lFront.lAnkle[1];
    const hipAboveKnee = lFront.lHip[1] - lFront.lKneeP[1];
    ok(kneeAboveAnkle > 0.02, '前迈帧膝高于踝 Δ=' + kneeAboveAnkle.toFixed(3) + '（小腿倾斜=弯折可见）');
    ok(hipAboveKnee > 0.02, '髋高于膝 Δ=' + hipAboveKnee.toFixed(3) + '（大腿抬起）');
  }
  // 折叠期膝弯 1.85 保留（帧12=r 折叠 t0.25，帧37=l 折叠 t0.75）
  const foldR = r.find((x) => x.f === 12), foldL = r.find((x) => x.f === 37);
  ok(foldR && foldR.rKnee > 1.5, '右腿摆动折叠期膝弯保留 ' + (foldR ? foldR.rKnee.toFixed(2) : 'N/A') + '（>1.5）');
  ok(foldL && foldL.lKnee > 1.5, '左腿摆动折叠期膝弯保留 ' + (foldL ? foldL.lKnee.toFixed(2) : 'N/A') + '（>1.5）');
  ok(errors.length === 0, '0 控制台错误');
  console.log('Playwright: ' + pass + ' passed, ' + fail + ' failed');
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
