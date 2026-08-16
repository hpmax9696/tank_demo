// Attack 精确采样：读 pivot 旋转 + 独立截图轮（无截图干扰时序）
const { chromium } = require('playwright');

async function run(withShots) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
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

  if (withShots) {
    await page.evaluate(() => document.querySelectorAll('#anim-list .anim-item')[3].click());
    await page.waitForTimeout(460);
    await page.screenshot({ path: 'artifacts/attack_loadup.png' });
    await page.waitForTimeout(120);
    await page.screenshot({ path: 'artifacts/attack_peak.png' });
    await browser.close();
    return;
  }

  const sample = () =>
    page.evaluate(() => {
      const root = window.modelRoot.getObjectByName('root');
      root.updateMatrixWorld(true);
      const tuPivot = root.getObjectByName('torso_upper_pivot');
      const torso = root.getObjectByName('torso');
      const g = (n) => {
        const o = root.getObjectByName(n);
        const v = new THREE.Vector3();
        o.getWorldPosition(v);
        return [+v.x.toFixed(3), +v.y.toFixed(3), +v.z.toFixed(3)];
      };
      return {
        hip: +torso.rotation.x.toFixed(3),
        waist: +tuPivot ? +tuPivot.rotation.x.toFixed(3) : null,
        r_hand: g('r_hand')[1],
        head: g('head')[1],
        status: (document.getElementById('anim-status') || {}).textContent,
      };
    });

  const out = {};
  await page.evaluate(() => document.querySelectorAll('#anim-list .anim-item')[3].click());
  const marks = [200, 450, 555, 700, 800, 1000];
  for (const ms of marks) {
    await page.waitForTimeout(ms === 200 ? 200 : ms - prev);
    prev = ms;
    out[ms] = await sample();
  }
  console.log(JSON.stringify(out, null, 1));
  console.log('pageerrors:', errs.length ? errs.join(' | ') : 'none');
  await browser.close();
}
let prev = 200;
(async () => {
  await run(false);
  await run(true);
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
