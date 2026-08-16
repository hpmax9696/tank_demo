// 变体模式 + 中间帧截图 + 游戏侧 createCampusZombie Die 管线验证
const { chromium } = require('playwright');

(async () => {
  // ── 1. 工厂变体模式（student_m 儿童骨架）──
  let browser = await chromium.launch({ headless: true });
  let page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.addInitScript(() =>
    localStorage.setItem('tank_model_factory_save', JSON.stringify({ modelType: 'humanoid' }))
  );
  await page.goto('http://127.0.0.1:8080/model_factory.html');
  await page.waitForTimeout(1500);
  await page.click('#toggle-anim');
  await page.waitForTimeout(200);
  await page.evaluate(() => document.querySelectorAll('#anim-list .anim-item')[5].click());
  // 中间帧（t≈0.6·1.5s≈0.9s 后截图 = 倒地中）
  await page.waitForTimeout(880);
  await page.screenshot({ path: 'artifacts/die_mid_variant.png' });
  await page.waitForTimeout(1050);
  await page.screenshot({ path: 'artifacts/die_end_variant.png' });
  const data = await page.evaluate(() => {
    const root = window.modelRoot.getObjectByName('root');
    root.updateMatrixWorld(true);
    const g = (n) => {
      const o = root.getObjectByName(n);
      if (!o) return null;
      const v = new THREE.Vector3();
      o.getWorldPosition(v);
      return [+v.x.toFixed(3), +v.y.toFixed(3), +v.z.toFixed(3)];
    };
    return { pelvis: g('pelvis'), head: g('head'), l_hand: g('l_hand'), r_hand: g('r_hand'), l_foot: g('l_foot'), r_foot: g('r_foot') };
  });
  console.log('factory variant(student_m) end:', JSON.stringify(data));
  console.log('factory pageerrors:', errs.length ? errs.join(' | ') : 'none');
  await browser.close();

  // ── 2. 游戏侧：index.html 加载 enemies.js → createCampusZombie → 播 Die ──
  browser = await chromium.launch({ headless: true });
  page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errs2 = [];
  page.on('pageerror', (e) => errs2.push(String(e)));
  await page.goto('http://127.0.0.1:8080/index.html');
  await page.waitForTimeout(2500);
  const gz = await page.evaluate(async () => {
    if (!window.EnemyModels || !window.HumanoidConfig) return { err: 'no EnemyModels/HumanoidConfig' };
    const z = window.EnemyModels.createCampusZombie({ variant: 'student_m', heightM: 1.4, seed: 7 });
    if (!z) return { err: 'createCampusZombie null' };
    const scene = window.scene;
    if (scene) scene.add(z);
    const asys = z.userData._animSystem;
    if (!asys) return { err: 'no _animSystem' };
    asys.play('Die', false);
    for (let i = 0; i < 160; i++) asys.update(1 / 60);
    z.updateMatrixWorld(true);
    const g = (n) => {
      const o = z.getObjectByName(n);
      if (!o) return null;
      const v = new THREE.Vector3();
      o.getWorldPosition(v);
      return [+v.x.toFixed(3), +v.y.toFixed(3), +v.z.toFixed(3)];
    };
    let minInfo = { y: Infinity };
    z.traverse((c) => {
      if (c.isMesh && c.geometry && c.geometry.attributes && c.geometry.attributes.position) {
        const pos = c.geometry.attributes.position;
        const p = new THREE.Vector3();
        for (let i = 0; i < pos.count; i++) {
          p.fromBufferAttribute(pos, i).applyMatrix4(c.matrixWorld);
          if (p.y < minInfo.y) minInfo = { y: p.y, mesh: c.name };
        }
      }
    });
    return {
      pelvis: g('pelvis'), torso_upper: g('torso_upper'), head: g('head'),
      l_hand: g('l_hand'), r_hand: g('r_hand'), l_foot: g('l_foot'), r_foot: g('r_foot'),
      lowest: { y: +minInfo.y.toFixed(3), mesh: minInfo.mesh },
    };
  });
  console.log('game zombie Die end:', JSON.stringify(gz));
  console.log('game pageerrors:', errs2.length ? errs2.join(' | ') : 'none');
  await browser.close();
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
