// 最终综合验证：死亡终态/中间帧/复位 + Walk 回归（骨盆扭转修复验证）
const { chromium } = require('playwright');

async function runScene(mode, out) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.addInitScript(() =>
    localStorage.setItem('tank_model_factory_save', JSON.stringify({ modelType: 'humanoid' }))
  );
  await page.goto('http://127.0.0.1:8080/model_factory.html');
  await page.waitForTimeout(1500);
  if (mode === 'skeleton') {
    await page.evaluate(() => {
      const sel = Array.from(document.querySelectorAll('select')).find((s) =>
        Array.from(s.options).some((o) => o.value === '🦴 骨架(共通)')
      );
      sel.value = '🦴 骨架(共通)';
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await page.waitForTimeout(700);
  }
  await page.click('#toggle-anim');
  await page.waitForTimeout(250);

  const measure = () =>
    page.evaluate(() => {
      const root = window.modelRoot.getObjectByName('root');
      root.updateMatrixWorld(true);
      const g = (n) => {
        const o = root.getObjectByName(n);
        if (!o) return null;
        const v = new THREE.Vector3();
        o.getWorldPosition(v);
        return [+v.x.toFixed(3), +v.y.toFixed(3), +v.z.toFixed(3)];
      };
      const pelvis = root.getObjectByName('pelvis');
      return {
        pelvis: g('pelvis'), torso_upper: g('torso_upper'), head: g('head'),
        l_hand: g('l_hand'), r_hand: g('r_hand'), l_foot: g('l_foot'), r_foot: g('r_foot'),
        pelvisRotY: +pelvis.rotation.y.toFixed(4),
      };
    });

  // 1) 死亡中间帧（倒地中）
  await page.evaluate(() => document.querySelectorAll('#anim-list .anim-item')[5].click());
  await page.waitForTimeout(880);
  await page.screenshot({ path: `${out}_mid.png` });
  const mid = await measure();

  // 2) 死亡终态
  await page.waitForTimeout(1050);
  await page.screenshot({ path: `${out}_end.png` });
  const end = await measure();

  // 3) 死亡后自动回 Idle（再等 1.8s: 停留1.5s + 复位）→ 站姿复位检查
  await page.waitForTimeout(1800);
  const backIdle = await measure();
  await page.screenshot({ path: `${out}_idle.png` });

  // 4) Walk 回归：左右脚 x 对称性（骨盆扭转会破坏对称）
  await page.evaluate(() => document.querySelectorAll('#anim-list .anim-item')[1].click());
  await page.waitForTimeout(700);
  const walk = await measure();

  console.log(`[${mode}] mid:   ${JSON.stringify(mid)}`);
  console.log(`[${mode}] end:   ${JSON.stringify(end)}`);
  console.log(`[${mode}] idle:  ${JSON.stringify(backIdle)}`);
  console.log(`[${mode}] walk:  ${JSON.stringify(walk)}`);
  console.log(`[${mode}] pageerrors: ${errs.length ? errs.join(' | ') : 'none'}`);
  await browser.close();
}

(async () => {
  await runScene('skeleton', 'artifacts/final_skel');
  await runScene('variant', 'artifacts/final_var');
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
