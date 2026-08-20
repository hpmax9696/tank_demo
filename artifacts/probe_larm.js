// 左臂内收迭代实验：找 l_hand 贴护木的臂组合
const { chromium } = require('playwright');
const URL = process.env.FACTORY_URL || 'http://127.0.0.1:8080/model_factory.html';
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.setItem('tank_model_factory_save', JSON.stringify({ modelType: 'humanoid' })));
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.evaluate(() => {
    window._humanoidEdit.variant = 'rifleman';
    window._humanoidEdit.params.height = 1.68;
    window._applyHumanoidEdit();
  });
  await page.waitForTimeout(800);
  const tryArms = (ux, uz, fx, fz) => page.evaluate((cfg) => {
    const root = window.modelRoot;
    const lu = root.getObjectByName('l_upper_arm_pivot');
    const lf = root.getObjectByName('l_forearm_pivot');
    const ru = root.getObjectByName('r_upper_arm_pivot');
    const rf = root.getObjectByName('r_forearm_pivot');
    const w = root.getObjectByName('ah_wp_rifle');
    ru.rotation.set(-0.45, 0, -0.12);
    rf.rotation.set(-1.05, 0, 0);
    lu.rotation.set(cfg.ux, 0, cfg.uz);
    lf.rotation.set(cfg.fx, 0, cfg.fz);
    w.rotation.set(2.0, 0, 0);
    root.updateWorldMatrix(true, true);
    const h = root.getObjectByName('l_hand').getWorldPosition(new THREE.Vector3());
    const g = root.getObjectByName('ah_wp_rifle').localToWorld(new THREE.Vector3(0, -0.002, 0.18));
    const d = Math.hypot(h.x - g.x, h.y - g.y, h.z - g.z);
    return { d: d.toFixed(3), h: [h.x.toFixed(2), h.y.toFixed(2), h.z.toFixed(2)].join(','), g: [g.x.toFixed(2), g.y.toFixed(2), g.z.toFixed(2)].join(',') };
  }, { ux, uz, fx, fz });
  // 迭代：增大上臂内收(uz 负)与前臂内收(fz 负?)
  for (const [ux, uz, fx, fz] of [
    [-0.5, -0.3, -1.0, 0.75],
    [-0.5, -0.45, -1.0, 0.75],
    [-0.5, -0.45, -1.0, 0.4],
    [-0.5, -0.45, -1.0, 0.2],
    [-0.55, -0.5, -1.0, 0.3],
    [-0.6, -0.55, -0.95, 0.25],
  ]) {
    const r = await tryArms(ux, uz, fx, fz);
    console.log(`ux=${ux} uz=${uz} fx=${fx} fz=${fz}`.padEnd(34), 'dist=' + r.d, 'hand=' + r.h, 'guard=' + r.g);
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
