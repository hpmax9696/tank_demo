// 实验2：贴腮手高（ux -1.4/-1.5）+ RPG 斜背 rx/ry 组合
const { chromium } = require('playwright');
const URL = process.env.FACTORY_URL || 'http://127.0.0.1:8080/model_factory.html';
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.setItem('tank_model_factory_save', JSON.stringify({ modelType: 'humanoid' })));
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.evaluate(() => { window._humanoidEdit.variant = 'rifleman'; window._humanoidEdit.params.height = 1.68; window._applyHumanoidEdit(); });
  await page.waitForTimeout(700);
  // 贴腮：臂全水平变体
  const aim = (ux, fx, wx, hz) => page.evaluate((cfg) => {
    const root = window.modelRoot;
    const ru = root.getObjectByName('r_upper_arm_pivot');
    const rf = root.getObjectByName('r_forearm_pivot');
    const lu = root.getObjectByName('l_upper_arm_pivot');
    const lf = root.getObjectByName('l_forearm_pivot');
    const w = root.getObjectByName('ah_wp_rifle');
    const head = root.getObjectByName('head');
    ru.rotation.set(cfg.ux, 0, -0.12);
    rf.rotation.set(cfg.fx, 0, 0);
    lu.rotation.set(cfg.ux, 0, -0.5);
    lf.rotation.set(cfg.fx, 0, -0.3);
    w.rotation.set(cfg.wx, 0, 0);
    if (cfg.hz) head.rotation.set(0, 0, cfg.hz);
    root.updateWorldMatrix(true, true);
    const muzzle = w.localToWorld(new THREE.Vector3(0, 0.008, 0.45));
    const stock = w.localToWorld(new THREE.Vector3(0, -0.018, -0.27));
    const dir = new THREE.Vector3().subVectors(muzzle, stock).normalize();
    const hand = root.getObjectByName('r_hand').getWorldPosition(new THREE.Vector3());
    const headP = root.getObjectByName('head').getWorldPosition(new THREE.Vector3());
    const cheekP = head.localToWorld(new THREE.Vector3(0.05, -0.02, 0.04)); // 右脸颊点
    return { dirY: dir.y.toFixed(3), handY: hand.y.toFixed(3), muzzleY: muzzle.y.toFixed(3), headY: headP.y.toFixed(3), cheekY: cheekP.y.toFixed(3), cheekX: cheekP.x.toFixed(3), muzzleX: muzzle.x.toFixed(3) };
  }, { ux, fx, wx, hz });
  for (const [ux, fx, wx, hz] of [
    [-1.4, -0.1, 1.5, -0.3], [-1.5, -0.05, 1.55, -0.3], [-1.5, -0.15, 1.65, -0.35], [-1.45, -0.1, 1.6, -0.35],
  ]) {
    const r = await aim(ux, fx, wx, hz);
    console.log(`ux=${ux} fx=${fx} wx=${wx} hz=${hz}`.padEnd(34), 'dirY=' + r.dirY.padEnd(7), 'handY=' + r.handY.padEnd(7), 'muzzleY=' + r.muzzleY.padEnd(7), 'headY=' + r.headY.padEnd(7), 'cheekY=' + r.cheekY.padEnd(7), 'cheekX=' + r.cheekX + ' muzzleX=' + r.muzzleX);
  }
  // RPG 斜背 rx/ry
  await page.evaluate(() => { window._humanoidEdit.variant = 'rocketeer'; window._applyHumanoidEdit(); });
  await page.waitForTimeout(700);
  const slant = (rx, ry, py, pz) => page.evaluate((cfg) => {
    const root = window.modelRoot;
    const w = root.getObjectByName('ah_wp_rpg');
    w.rotation.set(cfg.rx, cfg.ry, 0);
    w.position.set(0.02, cfg.py, cfg.pz);
    root.updateWorldMatrix(true, true);
    const tip = w.localToWorld(new THREE.Vector3(0, 0, 0.66));
    const vent = w.localToWorld(new THREE.Vector3(0, 0, -0.37));
    const dir = new THREE.Vector3().subVectors(tip, vent).normalize();
    return { tip: [tip.x.toFixed(2), tip.y.toFixed(2), tip.z.toFixed(2)].join(','), vent: [vent.x.toFixed(2), vent.y.toFixed(2), vent.z.toFixed(2)].join(','), dir: [dir.x.toFixed(2), dir.y.toFixed(2), dir.z.toFixed(2)].join(',') };
  }, { rx, ry, py, pz });
  for (const [rx, ry, py, pz] of [
    [-0.7, 1.2, -0.1, -0.17], [-0.75, 1.25, -0.12, -0.16], [-0.6, 1.15, -0.1, -0.18], [-0.8, 1.3, -0.13, -0.15],
  ]) {
    const r = await slant(rx, ry, py, pz);
    console.log(`rx=${rx} ry=${ry}`.padEnd(20), 'tip=' + r.tip.padEnd(22), 'vent=' + r.vent.padEnd(22), 'dir=' + r.dir);
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
