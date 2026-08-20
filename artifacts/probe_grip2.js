// RPG 肩扛双手握把对齐迭代2：降筒位（肩窝高度）
const { chromium } = require('playwright');
const URL = process.env.FACTORY_URL || 'http://127.0.0.1:8080/model_factory.html';
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.setItem('tank_model_factory_save', JSON.stringify({ modelType: 'humanoid' })));
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.evaluate(() => { window._humanoidEdit.variant = 'rocketeer'; window._humanoidEdit.params.height = 1.68; window._applyHumanoidEdit(); });
  await page.waitForTimeout(700);
  const r = await page.evaluate(() => {
    const root = window.modelRoot;
    const w = root.getObjectByName('ah_wp_rpg');
    const lu = root.getObjectByName('l_upper_arm_pivot');
    const lf = root.getObjectByName('l_forearm_pivot');
    const ru = root.getObjectByName('r_upper_arm_pivot');
    const rf = root.getObjectByName('r_forearm_pivot');
    const out = [];
    // 筒位：(x, y, z) 挂 torso_upper 局部；视觉 y = +0.145 补偿
    const tubes = [
      { label: '肩窝 y0.12', pos: [-0.13, 0.12, 0.05] },
      { label: '肩窝 y0.18', pos: [-0.13, 0.18, 0.05] },
      { label: '肩窝 y0.22', pos: [-0.13, 0.22, 0.05] },
    ];
    const arms = [
      { label: '低握', rU: [-0.6, 0, -0.25], rF: [-0.55, 0, 0], lU: [-0.85, 0, -0.4], lF: [-0.55, 0, 0.45] },
      { label: '中握', rU: [-0.75, 0, -0.3], rF: [-0.45, 0, 0], lU: [-1.05, 0, -0.5], lF: [-0.7, 0, 0.35] },
    ];
    for (const tb of tubes) {
      for (const c of arms) {
        w.rotation.set(0.05, 0, 0);
        w.position.set(...tb.pos);
        ru.rotation.set(...c.rU); rf.rotation.set(...c.rF);
        lu.rotation.set(...c.lU); lf.rotation.set(...c.lF);
        root.updateWorldMatrix(true, true);
        const rh = root.getObjectByName('r_hand').getWorldPosition(new THREE.Vector3());
        const lh = root.getObjectByName('l_hand').getWorldPosition(new THREE.Vector3());
        const gR = w.localToWorld(new THREE.Vector3(0, -0.075, -0.1));
        const gF = w.localToWorld(new THREE.Vector3(0, -0.075, 0.1));
        const dR = +Math.hypot(rh.x - gR.x, rh.y - gR.y, rh.z - gR.z).toFixed(3);
        const dL = +Math.hypot(lh.x - gF.x, lh.y - gF.y, lh.z - gF.z).toFixed(3);
        out.push({
          tube: tb.label, arm: c.label, dR, dL,
          rHand: [rh.x.toFixed(2), rh.y.toFixed(2), rh.z.toFixed(2)].join(','),
          gR: [gR.x.toFixed(2), gR.y.toFixed(2), gR.z.toFixed(2)].join(','),
          lHand: [lh.x.toFixed(2), lh.y.toFixed(2), lh.z.toFixed(2)].join(','),
          gF: [gF.x.toFixed(2), gF.y.toFixed(2), gF.z.toFixed(2)].join(','),
        });
      }
    }
    return out;
  });
  console.log(JSON.stringify(r, null, 1));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
