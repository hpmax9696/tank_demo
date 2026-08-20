// RPG 肩扛握把对齐迭代3：全前举手臂 + 管位微调
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
    const tubes = [
      { label: 'y0.18 z0.02', pos: [-0.13, 0.18, 0.02] },
      { label: 'y0.15 z0', pos: [-0.13, 0.15, 0] },
    ];
    const arms = [
      { label: '全前举', rU: [-1.2, 0, -0.3], rF: [-0.3, 0, 0], lU: [-1.35, 0, -0.5], lF: [-0.45, 0, 0.4] },
      { label: '全前举2', rU: [-1.35, 0, -0.35], rF: [-0.25, 0, 0], lU: [-1.5, 0, -0.55], lF: [-0.35, 0, 0.35] },
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
        // 手到管轴线（过管心沿 +Z）距离
        const tubeC = w.localToWorld(new THREE.Vector3(0, 0, 0));
        const dAxisR = +Math.hypot(rh.x - tubeC.x, rh.y - tubeC.y).toFixed(3);
        const dAxisL = +Math.hypot(lh.x - tubeC.x, lh.y - tubeC.y).toFixed(3);
        out.push({
          tube: tb.label, arm: c.label,
          dR: +Math.hypot(rh.x - gR.x, rh.y - gR.y, rh.z - gR.z).toFixed(3),
          dL: +Math.hypot(lh.x - gF.x, lh.y - gF.y, lh.z - gF.z).toFixed(3),
          dAxisR, dAxisL,
          rHand: [rh.x.toFixed(2), rh.y.toFixed(2), rh.z.toFixed(2)].join(','),
          lHand: [lh.x.toFixed(2), lh.y.toFixed(2), lh.z.toFixed(2)].join(','),
          tubeC: [tubeC.x.toFixed(2), tubeC.y.toFixed(2)].join(','),
        });
      }
    }
    return out;
  });
  console.log(JSON.stringify(r, null, 1));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
