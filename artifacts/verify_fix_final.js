// 终验：弹匣弯曲方向（底端应朝枪口 +Z）+ 帽子真实间隙（head 几何半径口径）+ 全量回归
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

  // 弹匣方向：局部底端/顶端中心变换到武器系比 z
  await page.evaluate(() => {
    window._humanoidEdit.variant = 'rifleman';
    window._humanoidEdit.params.height = 1.68;
    window._applyHumanoidEdit();
  });
  await page.waitForTimeout(600);
  const magDir = await page.evaluate(() => {
    const root = window.modelRoot;
    root.updateMatrixWorld(true);
    const mag = root.getObjectByName('ah_wp_rf_mag');
    const bottom = new THREE.Vector3(0, -0.08, 0).applyMatrix4(mag.matrixWorld);
    const top = new THREE.Vector3(0, 0.08, 0).applyMatrix4(mag.matrixWorld);
    return { bottomZ: +bottom.z.toFixed(4), topZ: +top.z.toFixed(4), forwardBend: bottom.z > top.z };
  });
  console.log(JSON.stringify(magDir));

  // 帽子真实间隙：head mesh 世界球心 + 几何半径（排除子树污染），对盔 dome 视觉顶
  for (const vk of ['rifleman', 'guard']) {
    await page.evaluate((k) => {
      window._humanoidEdit.variant = k;
      window._humanoidEdit.params.height = 1.68;
      window._applyHumanoidEdit();
    }, vk);
    await page.waitForTimeout(600);
    const r = await page.evaluate(() => {
      const root = window.modelRoot;
      root.updateMatrixWorld(true);
      const head = root.getObjectByName('head');
      const eye = root.getObjectByName('l_eye_glow');
      const helm = root.getObjectByName('ah_hlm') || root.getObjectByName('ah_gc_dome');
      const hp = new THREE.Vector3();
      head.getWorldPosition(hp);
      const ep = new THREE.Vector3();
      eye.getWorldPosition(ep);
      // 局部眼位 y=0.019 → 世界缩放 = (ep.y - hp.y) / 0.019
      const scale = (ep.y - hp.y) / 0.019;
      const rHead = 0.0893 * scale;
      const bb = new THREE.Box3().setFromObject(helm);
      const crownY = hp.y + rHead;
      return { scale: +scale.toFixed(4), headCenterY: +hp.y.toFixed(4), rHead: +rHead.toFixed(4), crownY: +crownY.toFixed(4), helmTopY: +bb.max.y.toFixed(4), clearance: +(bb.max.y - crownY).toFixed(4) };
    });
    console.log(JSON.stringify({ vk, ...r }));
  }
  console.log('errors:', errors.length ? errors.join('||') : 'none');
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
