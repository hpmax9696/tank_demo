// 符号实验：静态设臂旋转 → 采手 -Y / 武器 +Z 世界方向，建立映射表
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
  const setup = (armX, armZ, foreX, weaponX) => page.evaluate((cfg) => {
    const root = window.modelRoot;
    const rp = root.getObjectByName('r_upper_arm_pivot');
    const rf = root.getObjectByName('r_forearm_pivot');
    const w = root.getObjectByName('ah_wp_rifle');
    rp.rotation.set(cfg.armX, 0, cfg.armZ);
    rf.rotation.set(cfg.foreX, 0, 0);
    w.rotation.set(cfg.weaponX, 0, 0);
    root.updateWorldMatrix(true, true);
    const handDir = root.getObjectByName('r_hand').localToWorld(new THREE.Vector3(0, -0.2, 0))
      .sub(root.getObjectByName('r_hand').localToWorld(new THREE.Vector3(0, 0, 0))).normalize();
    const gunDir = w.localToWorld(new THREE.Vector3(0, 0, 0.4))
      .sub(w.localToWorld(new THREE.Vector3(0, 0, 0))).normalize();
    const handPos = root.getObjectByName('r_hand').getWorldPosition(new THREE.Vector3());
    return {
      handDir: [handDir.x.toFixed(2), handDir.y.toFixed(2), handDir.z.toFixed(2)].join(','),
      gunDir: [gunDir.x.toFixed(2), gunDir.y.toFixed(2), gunDir.z.toFixed(2)].join(','),
      hand: [handPos.x.toFixed(2), handPos.y.toFixed(2), handPos.z.toFixed(2)].join(','),
    };
  }, { armX, armZ, foreX, weaponX });
  // 依次实验：静止 / 前举-1.5 / 前举+屈肘 / 据枪组合
  for (const [label, ax, az, fx, wx] of [
    ['静止(0)', 0, 0, 0, 0],
    ['arm.x=-1.5', -1.5, 0, 0, 0],
    ['arm.x=-1.5 z-0.3', -1.5, -0.3, 0, 0],
    ['arm-0.5 fore-1.15 w0', -0.5, -0.1, -1.15, 0],
    ['arm-0.5 fore-1.15 w1.65', -0.5, -0.1, -1.15, 1.65],
    ['low-ready -0.45/-1.05 w1.0', -0.45, -0.12, -1.05, 1.0],
  ]) {
    const r = await setup(ax, az, fx, wx);
    console.log(label.padEnd(28), 'hand-Y:', r.handDir.padEnd(18), 'gun+Z:', r.gunDir.padEnd(18), 'hand@', r.hand);
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
