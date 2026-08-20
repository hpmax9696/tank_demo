// 三参数实验：①保安曲臂蓄力 ②枪口左偏+贴腮据枪高度 ③RPG斜背战斗部露肩
const { chromium } = require('playwright');
const URL = process.env.FACTORY_URL || 'http://127.0.0.1:8080/model_factory.html';
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.setItem('tank_model_factory_save', JSON.stringify({ modelType: 'humanoid' })));
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  async function loadVariant(vk) {
    await page.evaluate((k) => {
      window._humanoidEdit.variant = k;
      window._humanoidEdit.params.height = 1.68;
      window._applyHumanoidEdit();
    }, vk);
    await page.waitForTimeout(700);
  }

  // ── 实验2：贴腮据枪（步枪）——臂抬高+枪口水平+枪在腮高 ──
  await loadVariant('rifleman');
  const aim = (ux, uz, fx, wx, hy) => page.evaluate((cfg) => {
    const root = window.modelRoot;
    const ru = root.getObjectByName('r_upper_arm_pivot');
    const rf = root.getObjectByName('r_forearm_pivot');
    const lu = root.getObjectByName('l_upper_arm_pivot');
    const lf = root.getObjectByName('l_forearm_pivot');
    const w = root.getObjectByName('ah_wp_rifle');
    const head = root.getObjectByName('head_pivot') || root.getObjectByName('head');
    ru.rotation.set(cfg.ux, 0, -0.12);
    rf.rotation.set(cfg.fx, 0, 0);
    lu.rotation.set(cfg.ux, 0, -0.5);
    lf.rotation.set(cfg.fx, 0, -0.3);
    w.rotation.set(cfg.wx, 0, 0);
    if (head) head.rotation.set(0, 0, cfg.hy);
    root.updateWorldMatrix(true, true);
    const muzzle = w.localToWorld(new THREE.Vector3(0, 0.008, 0.45));
    const stock = w.localToWorld(new THREE.Vector3(0, -0.018, -0.27));
    const dir = new THREE.Vector3().subVectors(muzzle, stock).normalize();
    const hand = root.getObjectByName('r_hand').getWorldPosition(new THREE.Vector3());
    const cheek = root.getObjectByName('head').getWorldPosition(new THREE.Vector3());
    return {
      muzzleY: muzzle.y.toFixed(3), muzzleDirY: dir.y.toFixed(3), handY: hand.y.toFixed(3),
      headY: cheek.y.toFixed(3), stockY: stock.y.toFixed(3), stockX: stock.x.toFixed(3), handX: hand.x.toFixed(3),
    };
  }, { ux, uz, fx, wx, hy });
  // 目标：枪口水平(dirY≈0)、枪托/机匣在腮高(手 y≈0.95-1.02，头部 y≈1.03)
  for (const [ux, fx, wx] of [
    [-0.9, -0.35, 1.25], [-1.0, -0.3, 1.3], [-1.1, -0.25, 1.35], [-1.2, -0.2, 1.4],
  ]) {
    const r = await aim(ux, -0.12, fx, wx, 0);
    console.log(`aim ux=${ux} fx=${fx} wx=${wx}`.padEnd(30), 'dirY=' + r.muzzleDirY.padEnd(7), 'handY=' + r.handY.padEnd(7), 'muzzleY=' + r.muzzleY.padEnd(7), 'stockY=' + r.stockY.padEnd(7), 'headY=' + r.headY);
  }

  // ── 实验2b：待机枪口左偏——武器 rotation.y 方向确认 ──
  const idleAzi = (wy) => page.evaluate((y) => {
    const root = window.modelRoot;
    const w = root.getObjectByName('ah_wp_rifle');
    const ru = root.getObjectByName('r_upper_arm_pivot');
    const rf = root.getObjectByName('r_forearm_pivot');
    ru.rotation.set(-0.45, 0, -0.12);
    rf.rotation.set(-1.05, 0, 0);
    w.rotation.set(2.0, y, 0);
    root.updateWorldMatrix(true, true);
    const a = w.localToWorld(new THREE.Vector3(0, 0, 0));
    const b = w.localToWorld(new THREE.Vector3(0, 0, 0.45));
    const d = new THREE.Vector3().subVectors(b, a).normalize();
    return { dirX: d.x.toFixed(3), dirY: d.y.toFixed(3), dirZ: d.z.toFixed(3), horiz: Math.atan2(d.x, d.z).toFixed(3) };
  }, wy);
  for (const wy of [0, -0.4, 0.4]) {
    const r = await idleAzi(wy);
    console.log('idle wy=' + wy, JSON.stringify(r));
  }

  // ── 实验3：RPG 斜背——rotation.z 抬 +X 端（战斗部），从正面看露肩 ──
  await loadVariant('rocketeer');
  const slant = (rx, ry, rz, py, pz) => page.evaluate((cfg) => {
    const root = window.modelRoot;
    const w = root.getObjectByName('ah_wp_rpg');
    w.rotation.set(cfg.rx, cfg.ry, cfg.rz);
    w.position.set(0.02, cfg.py, cfg.pz);
    root.updateWorldMatrix(true, true);
    const tip = w.localToWorld(new THREE.Vector3(0, 0, 0.66)); // 战斗部尖
    const vent = w.localToWorld(new THREE.Vector3(0, 0, -0.37)); // 尾喷口
    return {
      tip: [tip.x.toFixed(2), tip.y.toFixed(2), tip.z.toFixed(2)].join(','),
      vent: [vent.x.toFixed(2), vent.y.toFixed(2), vent.z.toFixed(2)].join(','),
    };
  }, { rx, ry, rz, py, pz });
  // 肩高≈0.95（scale 0.72×）；战斗部尖目标 y>0.95 且 z 不进身体(>-0.1 即在背后范围外或肩上)
  for (const [rz, py, pz] of [
    [0.55, -0.1, -0.17], [0.6, -0.12, -0.16], [0.5, -0.08, -0.17],
  ]) {
    const r = await slant(0, Math.PI / 2, rz, py, pz);
    console.log('slant rz=' + rz + ' py=' + py, 'tip=' + r.tip.padEnd(20), 'vent=' + r.vent);
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
