// 武器朝向/握持数值诊断：世界坐标对比（脸=+Z 前方参照）
const { chromium } = require('playwright');
const URL = process.env.FACTORY_URL || 'http://127.0.0.1:8080/model_factory.html';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.setItem('tank_model_factory_save', JSON.stringify({ modelType: 'humanoid' })));
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  for (const vk of ['rifleman', 'shotgunner', 'rocketeer', 'guard']) {
    await page.evaluate((k) => {
      window._humanoidEdit.variant = k;
      window._humanoidEdit.params.height = 1.75;
      window._applyHumanoidEdit();
    }, vk);
    await page.waitForTimeout(700);
    const r = await page.evaluate(() => {
      const root = window.modelRoot;
      root.updateMatrixWorld(true);
      const V = (name) => {
        const o = root.getObjectByName(name);
        if (!o) return null;
        const p = new THREE.Vector3();
        o.getWorldPosition(p);
        return { x: +p.x.toFixed(3), y: +p.y.toFixed(3), z: +p.z.toFixed(3) };
      };
      const muzzle = V('ah_wp_rf_muzzle') || V('ah_wp_sg_bead') || V('ah_wp_rpg_wh_tip') || V('ah_wp_btn_tip');
      const rear = V('ah_wp_rf_stock') || V('ah_wp_sg_stock') || V('ah_wp_rpg_venturi') || V('ah_wp_btn_grip');
      const gripR = V('ah_wp_rpg_grip_r');
      const hand = V('r_hand');
      const eyeL = V('l_eye_glow');
      return { vk: window._humanoidEdit.variant, eyeL, hand, muzzle, rear, gripR };
    });
    const frontSign = Math.sign(r.eyeL.z) || 1;
    const muzzleForward = r.muzzle ? Math.sign(r.muzzle.z) === frontSign : null;
    const rearBackward = r.rear ? Math.sign(r.rear.z) !== frontSign : null;
    const gripDist = r.gripR && r.hand ? Math.hypot(r.gripR.x - r.hand.x, r.gripR.y - r.hand.y, r.gripR.z - r.hand.z) : null;
    console.log(JSON.stringify({ ...r, frontSign, muzzleForward, rearBackward, gripDist }));
  }
  console.log('errors:', errors.length ? errors.join('||') : 'none');
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
