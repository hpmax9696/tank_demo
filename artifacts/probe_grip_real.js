// 真实骨架暴力搜索：右手到后握把 / 左手到前握把
const { chromium } = require('playwright');
const URL = process.env.FACTORY_URL || 'http://127.0.0.1:8080/model_factory.html';
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.setItem('tank_model_factory_save', JSON.stringify({ modelType: 'humanoid' })));
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.evaluate(() => { window._humanoidEdit.variant = 'rocketeer'; window._humanoidEdit.params.height = 1.68; window._applyHumanoidEdit(); });
  await page.waitForTimeout(700);
  const r = await page.evaluate(() => {
    const root = window.modelRoot;
    const w = root.getObjectByName('ah_wp_rpg');
    const ru = root.getObjectByName('r_upper_arm_pivot');
    const rf = root.getObjectByName('r_forearm_pivot');
    const lu = root.getObjectByName('l_upper_arm_pivot');
    const lf = root.getObjectByName('l_forearm_pivot');
    const rh = root.getObjectByName('r_hand');
    const lh = root.getObjectByName('l_hand');
    w.rotation.set(0.05, 0, 0);
    w.position.set(-0.22, 0.18, 0.15);
    const gR = w.localToWorld(new THREE.Vector3(0, -0.075, -0.1));
    const gF = w.localToWorld(new THREE.Vector3(0, -0.075, 0.1));
    function search(up, fp, hand, target) { /* 直接双层实现见 run */ }
    // 直接双层实现
    function run(up, fp, hand, target) {
      let best = null;
      const t = target;
      for (let ux = -1.6; ux <= 0.001; ux += 0.2) {
        for (let fx = -1.9; fx <= 0.001; fx += 0.2) {
          for (let uz = -0.7; uz <= 0.7; uz += 0.2) {
            for (let fz = -0.7; fz <= 0.7; fz += 0.2) {
              up.rotation.set(ux, 0, uz);
              fp.rotation.set(fx, 0, fz);
              root.updateWorldMatrix(true, true);
              const p = hand.getWorldPosition(new THREE.Vector3());
              const d = Math.hypot(p.x - t.x, p.y - t.y, p.z - t.z);
              if (!best || d < best.d) best = { d: +d.toFixed(3), ux: +ux.toFixed(2), fx: +fx.toFixed(2), uz: +uz.toFixed(2), fz: +fz.toFixed(2), hand: [p.x.toFixed(2), p.y.toFixed(2), p.z.toFixed(2)].join(',') };
            }
          }
        }
      }
      return best;
    }
    const bestR = run(ru, rf, rh, gR);
    const bestL = run(lu, lf, lh, gF);
    return {
      gR: [gR.x.toFixed(2), gR.y.toFixed(2), gR.z.toFixed(2)].join(','),
      gF: [gF.x.toFixed(2), gF.y.toFixed(2), gF.z.toFixed(2)].join(','),
      bestR, bestL,
    };
  });
  console.log(JSON.stringify(r, null, 1));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
