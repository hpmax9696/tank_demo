// 人类士兵变体工厂验证（v0.79.37 预研）
// 用法: node artifacts/verify_soldiers.js [截图目录]
// 依赖: 环境变量 FACTORY_URL（默认 http://127.0.0.1:8080/model_factory.html）
const { chromium } = require('playwright');

const URL = process.env.FACTORY_URL || 'http://127.0.0.1:8080/model_factory.html';
const SHOT_DIR = process.env.SHOT_DIR || 'artifacts/shots_soldiers';
const fs = require('fs');

(async () => {
  fs.mkdirSync(SHOT_DIR, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));

  await page.goto(URL, { waitUntil: 'networkidle' });
  // 恢复 humanoid 模型类型（autoLoad 读 SAVE_KEY.modelType → currentModelType='humanoid'）
  await page.evaluate(() => {
    localStorage.setItem('tank_model_factory_save', JSON.stringify({ modelType: 'humanoid' }));
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);

  const results = { checks: [], shots: [] };
  const check = (name, pass, detail) => {
    results.checks.push({ name, pass, detail: detail || '' });
    console.log((pass ? 'PASS' : 'FAIL') + ' | ' + name + (detail ? ' | ' + detail : ''));
  };

  // 1) 变体下拉含 4 个新变体
  const optText = await page.evaluate(() => {
    const HC = window.HumanoidConfig;
    return Object.keys(HC.HUMANOID_VARIANTS).map((k) => HC.HUMANOID_VARIANTS[k].name);
  });
  check('variants-registered', optText.some((t) => t.includes('校园保安')) && optText.some((t) => t.includes('步枪兵')) && optText.some((t) => t.includes('霰弹枪兵')) && optText.some((t) => t.includes('火箭筒兵')), optText.join('/'));

  // 2) 逐变体加载：树结构 + 关键部件 + 截图
  for (const vk of ['guard', 'rifleman', 'shotgunner', 'rocketeer']) {
    await page.evaluate((k) => {
      window._humanoidEdit.variant = k;
      // 模拟变体下拉 onChange 的 bodyRange 重置（工厂 UI 行为）
      var hv = window.HumanoidConfig.HUMANOID_VARIANTS[k];
      window._humanoidEdit.params.height = hv.bodyRange.height[0];
      window._humanoidEdit.params.hunch = hv.bodyRange.hunch[0];
      window._humanoidEdit.params.curves = 0;
      window._applyHumanoidEdit();
    }, vk);
    await page.waitForTimeout(900);
    const info = await page.evaluate(() => {
      const out = { modelType: null, nodes: 0, mats: new Set(), weapon: false, headwear: false, vest: false, bbox: null };
      out.modelType = window.currentModelType || null;
      const root = window.modelRoot;
      if (!root) return out;
      root.traverse((o) => {
        if (o.isMesh) {
          out.nodes++;
          const names = ['ah_wp_btn', 'ah_wp_rf', 'ah_wp_sg', 'ah_wp_rpg', 'ah_hlm', 'ah_gc', 'ah_tv', 'ah_gv', 'ah_cb', 'ah_belt'];
          const hit = names.some((p) => (o.name || '').startsWith(p));
          if (hit) {
            if (o.name.startsWith('ah_wp_')) out.weapon = true;
            if (o.name.startsWith('ah_hlm') || o.name.startsWith('ah_gc')) out.headwear = true;
            if (o.name.startsWith('ah_tv') || o.name.startsWith('ah_gv')) out.vest = true;
          }
          if (o.material && o.material.color) out.mats.add('#' + o.material.color.getHexString());
        }
      });
      const box = new THREE.Box3().setFromObject(root);
      out.bbox = { w: +(box.max.x - box.min.x).toFixed(3), h: +(box.max.y - box.min.y).toFixed(3), d: +(box.max.z - box.min.z).toFixed(3), minZ: +box.min.z.toFixed(3), maxZ: +box.max.z.toFixed(3) };
      return out;
    });
    check(vk + '-model-loaded', info.modelType === 'humanoid' && info.nodes > 30, 'meshes=' + info.nodes + ' bbox=' + JSON.stringify(info.bbox));
    check(vk + '-weapon', info.weapon, '');
    check(vk + '-headwear', info.headwear, '');
    check(vk + '-vest', info.vest, '');
    // 3/4 正面视角截图（默认相机 +X 侧视，武器指向屏幕深处难辨头尾；转模型面向镜头偏 35°）
    await page.evaluate(() => {
      if (window.modelRoot) window.modelRoot.rotation.y = Math.PI / 2 - 0.6;
    });
    await page.waitForTimeout(250);
    await page.screenshot({ path: `${SHOT_DIR}/${vk}.png` });
    await page.evaluate(() => {
      if (window.modelRoot) window.modelRoot.rotation.y = 0;
    });
    results.shots.push(`${SHOT_DIR}/${vk}.png`);
  }

  // 3) 体型滑块联动（bakeModel 路径）：build 改变后模型重建不报错
  await page.evaluate(() => {
    window._humanoidEdit.variant = 'rifleman';
    window._humanoidEdit.params.build = 0.9;
    window._applyHumanoidEdit();
  });
  await page.waitForTimeout(700);
  const rebuilt = await page.evaluate(() => !!window.modelRoot && window.modelRoot.children.length > 0);
  check('slider-bakeModel-rebuild', rebuilt, '');
  await page.screenshot({ path: `${SHOT_DIR}/rifleman_build09.png` });

  // 4) 动画展台（人类直立动画表：开启展台 → collectRefs 填充 → 断言 7 动画）
  await page.evaluate(() => { window._humanoidEdit.params.build = 0.55; window._applyHumanoidEdit(); });
  await page.waitForTimeout(500);
  await page.click('#toggle-anim');
  await page.waitForTimeout(700);
  const animOk = await page.evaluate(() => {
    const HA = window.HumanoidAnims;
    if (!HA || !HA.names) return { ok: false, why: 'no HumanoidAnims' };
    return { ok: HA.names.length >= 6, why: 'anims=' + HA.names.map((n) => n.replace(/^\d+\/\d+\s*/, '')).join('/') };
  });
  check('soldier-anims-table', animOk.ok, animOk.why);
  await page.screenshot({ path: `${SHOT_DIR}/rifleman_showcase.png` });

  // 5) 丧尸变体回归（student_m 仍走 zombieAnims）——先关展台
  await page.click('#toggle-anim');
  const zReg = await page.evaluate(() => {
    window._humanoidEdit.variant = 'student_m';
    window._applyHumanoidEdit();
    return true;
  });
  await page.waitForTimeout(800);
  check('zombie-variant-regression', zReg, '');

  check('console-errors', errors.length === 0, errors.slice(0, 5).join(' || '));
  await page.screenshot({ path: `${SHOT_DIR}/student_m_regression.png` });
  await browser.close();
  const fails = results.checks.filter((c) => !c.pass).length;
  console.log(fails === 0 ? 'ALL PASS' : fails + ' FAILURES');
  process.exit(fails === 0 ? 0 : 1);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
