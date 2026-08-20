// 横扫弧实验：躯干 y 驱动 vs 臂 z 驱动 + 左手迭代
const { chromium } = require('playwright');
const URL = process.env.FACTORY_URL || 'http://127.0.0.1:8080/model_factory.html';
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.setItem('tank_model_factory_save', JSON.stringify({ modelType: 'humanoid' })));
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  // ── 实验1：保安横扫（躯干 y 大幅 + 臂前举外展固定）──
  await page.evaluate(() => {
    window._humanoidEdit.variant = 'guard';
    window._humanoidEdit.params.height = 1.68;
    window._applyHumanoidEdit();
  });
  await page.waitForTimeout(800);
  const baton = (torsoY, armX, armZ) => page.evaluate((cfg) => {
    const root = window.modelRoot;
    const torso = root.getObjectByName('torso');
    const ru = root.getObjectByName('r_upper_arm_pivot');
    const rf = root.getObjectByName('r_forearm_pivot');
    const b = root.getObjectByName('ah_wp_baton');
    torso.rotation.set(0, cfg.torsoY, 0);
    ru.rotation.set(cfg.armX, 0, cfg.armZ);
    rf.rotation.set(-0.15, 0, 0);
    b.rotation.set(-0.2, 0, 0);
    root.updateWorldMatrix(true, true);
    const tip = b.localToWorld(new THREE.Vector3(0, -0.485, 0));
    const grip = b.localToWorld(new THREE.Vector3(0, 0.004, 0));
    const d = new THREE.Vector3().subVectors(tip, grip).normalize();
    return { tipDir: [d.x.toFixed(2), d.y.toFixed(2), d.z.toFixed(2)].join(','), tip: [tip.x.toFixed(2), tip.y.toFixed(2), tip.z.toFixed(2)].join(',') };
  }, { torsoY, armX, armZ });
  for (const [label, ty, ax, az] of [
    ['蓄力 躯干+0.8 z-0.5', 0.8, -1.5, -0.5],
    ['爆发 躯干-0.8 z+0.3', -0.8, -1.5, 0.3],
    ['蓄力 躯干+1.0 z-0.6', 1.0, -1.5, -0.6],
    ['爆发 躯干-0.9 z+0.4', -0.9, -1.5, 0.4],
  ]) {
    const r = await baton(ty, ax, az);
    console.log(label.padEnd(24), 'tipDir:', r.tipDir.padEnd(20), 'tip@', r.tip);
  }
  // ── 实验2：左手（降臂+前伸迭代）──
  await page.evaluate(() => {
    window._humanoidEdit.variant = 'rifleman';
    window._applyHumanoidEdit();
  });
  await page.waitForTimeout(800);
  const lhand = (ux, uz, fx, fz) => page.evaluate((cfg) => {
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
    return { d: Math.hypot(h.x - g.x, h.y - g.y, h.z - g.z).toFixed(3), h: [h.x.toFixed(2), h.y.toFixed(2), h.z.toFixed(2)].join(','), g: [g.x.toFixed(2), g.y.toFixed(2), g.z.toFixed(2)].join(',') };
  }, { ux, uz, fx, fz });
  for (const c of [[-0.35, -0.5, -1.1, -0.3], [-0.3, -0.5, -1.2, -0.35], [-0.35, -0.55, -1.15, -0.35], [-0.4, -0.5, -1.15, -0.3]]) {
    const r = await lhand(...c);
    console.log('arm=' + c.join(','), 'dist=' + r.d, 'hand=' + r.h, 'guard=' + r.g);
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
