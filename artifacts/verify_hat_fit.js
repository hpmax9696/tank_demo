// 帽子/头盔刺穿量 + 武器部件衔接数值诊断
const { chromium } = require('playwright');
const URL = process.env.FACTORY_URL || 'http://127.0.0.1:8080/model_factory.html';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.setItem('tank_model_factory_save', JSON.stringify({ modelType: 'humanoid' })));
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // ── 帽子诊断（rifleman 头盔 + guard 大檐帽）──
  for (const vk of ['rifleman', 'guard']) {
    await page.evaluate((k) => {
      window._humanoidEdit.variant = k;
      var hv = window.HumanoidConfig.HUMANOID_VARIANTS[k];
      window._humanoidEdit.params.height = hv.bodyRange.height[0];
      window._applyHumanoidEdit();
    }, vk);
    await page.waitForTimeout(600);
    const r = await page.evaluate(() => {
      const root = window.modelRoot;
      root.updateMatrixWorld(true);
      const info = (name) => {
        const o = root.getObjectByName(name);
        if (!o) return null;
        const p = new THREE.Vector3();
        o.getWorldPosition(p);
        // 几何 bbox（世界系）
        const bb = new THREE.Box3().setFromObject(o);
        return {
          pos: { x: +p.x.toFixed(4), y: +p.y.toFixed(4), z: +p.z.toFixed(4) },
          bbMinY: +bb.min.y.toFixed(4),
          bbMaxY: +bb.max.y.toFixed(4),
          bbMinZ: +bb.min.z.toFixed(4),
          bbMaxZ: +bb.max.z.toFixed(4),
        };
      };
      return {
        vk: window._humanoidEdit.variant,
        head: info('head'),
        hair: info('ah_m'),
        helmet: info('ah_hlm') || info('ah_gc_dome'),
        brim: info('ah_hlm_brim') || info('ah_gc_brim'),
        badge: info('ah_gc_badge'),
        band: info('ah_gc_band'),
      };
    });
    // 头顶 = head bbMax.y；帽顶 = helmet bbMax.y；刺穿量 = 头顶 - 帽顶（>0 即刺穿）
    const pierce = r.head && r.helmet ? +(r.head.bbMaxY - r.helmet.bbMaxY).toFixed(4) : null;
    console.log(JSON.stringify({ ...r, pierce }));
  }

  // ── 霰弹枪衔接诊断（相邻部件 z 间隙）──
  await page.evaluate(() => {
    window._humanoidEdit.variant = 'shotgunner';
    window._humanoidEdit.params.height = 1.68;
    window._applyHumanoidEdit();
  });
  await page.waitForTimeout(600);
  const sg = await page.evaluate(() => {
    const root = window.modelRoot;
    root.updateMatrixWorld(true);
    const info = (name) => {
      const o = root.getObjectByName(name);
      if (!o) return null;
      const bb = new THREE.Box3().setFromObject(o);
      return { minZ: +bb.min.z.toFixed(4), maxZ: +bb.max.z.toFixed(4), minY: +bb.min.y.toFixed(4), maxY: +bb.max.y.toFixed(4) };
    };
    const parts = {};
    ['ah_wp_sg_recv', 'ah_wp_sg_barrel', 'ah_wp_sg_magtube', 'ah_wp_sg_pump', 'ah_wp_sg_grip', 'ah_wp_sg_stock', 'ah_wp_sg_bead'].forEach((n) => (parts[n] = info(n)));
    return parts;
  });
  const gap = (a, b) => (a && b ? +(b.minZ - a.maxZ).toFixed(4) : null);
  console.log(JSON.stringify({
    recv: sg.ah_wp_sg_recv, barrel: sg.ah_wp_sg_barrel, tube: sg.ah_wp_sg_magtube,
    pump: sg.ah_wp_sg_pump, stock: sg.ah_wp_sg_stock,
    gap_recv_barrel: gap(sg.ah_wp_sg_recv, sg.ah_wp_sg_barrel),
    gap_recv_tube: gap(sg.ah_wp_sg_recv, sg.ah_wp_sg_magtube),
    gap_recv_stock: sg.ah_wp_sg_stock && sg.ah_wp_sg_recv ? +(sg.ah_wp_sg_recv.minZ - sg.ah_wp_sg_stock.maxZ).toFixed(4) : null,
  }));

  // ── 步枪弹匣朝向（底端 z vs 顶端 z：AK 底端应更靠枪口 +Z）──
  await page.evaluate(() => {
    window._humanoidEdit.variant = 'rifleman';
    window._applyHumanoidEdit();
  });
  await page.waitForTimeout(600);
  const mag = await page.evaluate(() => {
    const root = window.modelRoot;
    root.updateMatrixWorld(true);
    const o = root.getObjectByName('ah_wp_rf_mag');
    if (!o) return null;
    const bb = new THREE.Box3().setFromObject(o);
    return { minZ: +bb.min.z.toFixed(4), maxZ: +bb.max.z.toFixed(4), minY: +bb.min.y.toFixed(4), maxY: +bb.max.y.toFixed(4) };
  });
  console.log(JSON.stringify({ mag, errors: errors.join('|') || 'none' }));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
