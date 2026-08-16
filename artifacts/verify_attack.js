// Attack 动画验证：髋(torso)+腰(torso_upper)双弯 + 手部不插地 + 0错误
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });

  await page.addInitScript(() =>
    localStorage.setItem('tank_model_factory_save', JSON.stringify({ modelType: 'humanoid' }))
  );
  await page.goto('http://127.0.0.1:8080/model_factory.html');
  await page.waitForTimeout(1500);
  await page.evaluate(() => {
    const sel = Array.from(document.querySelectorAll('select')).find((s) =>
      Array.from(s.options).some((o) => o.value === '🦴 骨架(共通)')
    );
    sel.value = '🦴 骨架(共通)';
    sel.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await page.waitForTimeout(700);
  await page.click('#toggle-anim');
  await page.waitForTimeout(250);

  const sample = () =>
    page.evaluate(() => {
      const root = window.modelRoot.getObjectByName('root');
      root.updateMatrixWorld(true);
      const torso = root.getObjectByName('torso');
      const tu = root.getObjectByName('torso_upper');
      const g = (n) => {
        const o = root.getObjectByName(n);
        const v = new THREE.Vector3();
        o.getWorldPosition(v);
        return [+v.x.toFixed(3), +v.y.toFixed(3), +v.z.toFixed(3)];
      };
      return {
        hipRotX: +torso.rotation.x.toFixed(3),
        waistRotX: +tu.rotation.x.toFixed(3),
        r_hand: g('r_hand'), l_hand: g('l_hand'),
        r_foot: g('r_foot'),
        rootY: +root.position.y.toFixed(3),
      };
    });

  // 跳到 Attack(index 3, 时长1000ms)，在关键时刻采样
  const t0 = Date.now();
  await page.evaluate(() => document.querySelectorAll('#anim-list .anim-item')[3].click());
  const waitTo = async (ms) => {
    const d = ms - (Date.now() - t0);
    if (d > 0) await page.waitForTimeout(d);
  };
  await waitTo(200); const s1 = await sample();          // 蓄力段
  await waitTo(460); const s2 = await sample();          // 举臂顶点(髋后仰)
  await page.screenshot({ path: 'artifacts/attack_loadup.png' });
  await waitTo(560); const s3 = await sample();          // 下挥峰值(髋+腰双弯)
  await page.screenshot({ path: 'artifacts/attack_peak.png' });
  await waitTo(790); const s4 = await sample();          // 回收
  await waitTo(1050); const s5 = await sample();         // 结束回基线

  console.log('loadup  (t≈0.46):', JSON.stringify(s2));
  console.log('peak    (t≈0.56):', JSON.stringify(s3));
  console.log('recover (t≈0.79):', JSON.stringify(s4));
  console.log('end     (t≈1.05):', JSON.stringify(s5));
  console.log('early   (t≈0.20):', JSON.stringify(s1));
  console.log('pageerrors:', errs.length ? errs.join(' | ') : 'none');
  await browser.close();
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
