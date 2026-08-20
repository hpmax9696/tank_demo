// 截图瞬间同步数值采样——彻底对齐"截图里是什么"
const { chromium } = require('playwright');
const URL = process.env.FACTORY_URL || 'http://127.0.0.1:8080/model_factory.html';
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.setItem('tank_model_factory_save', JSON.stringify({ modelType: 'humanoid' })));
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  async function load(vk) {
    await page.evaluate((k) => { window._humanoidEdit.variant = k; window._humanoidEdit.params.height = 1.68; window._applyHumanoidEdit(); }, vk);
    await page.waitForTimeout(600);
    await page.evaluate(() => { const btn = document.getElementById('toggle-anim'); if (btn.classList.contains('active')) btn.click(); });
    await page.waitForTimeout(200);
    await page.click('#toggle-anim');
    await page.waitForTimeout(700);
  }
  async function jump(lb, waitMs) {
    await page.evaluate((l) => { const h = Array.from(document.querySelectorAll('#anim-list .anim-item')).find((it) => it.textContent.includes(l)); if (h) h.click(); }, lb);
    await page.waitForTimeout(waitMs);
  }
  const snap = (names) => page.evaluate((ns) => {
    const root = window.modelRoot;
    root.updateWorldMatrix(true, true);
    const out = {};
    ns.forEach((spec) => {
      const [name, p1, p2] = spec;
      const o = root.getObjectByName(name);
      if (!o) { out[name] = null; return; }
      if (p1 && p2) {
        const a = o.localToWorld(new THREE.Vector3(...p1));
        const b = o.localToWorld(new THREE.Vector3(...p2));
        const d = new THREE.Vector3().subVectors(b, a).normalize();
        out[name + '_dir'] = [d.x.toFixed(2), d.y.toFixed(2), d.z.toFixed(2)].join(',');
        out[name + '_a'] = [a.x.toFixed(2), a.y.toFixed(2), a.z.toFixed(2)].join(',');
      } else {
        const p = o.getWorldPosition(new THREE.Vector3());
        out[name] = [p.x.toFixed(2), p.y.toFixed(2), p.z.toFixed(2)].join(',');
      }
    });
    return out;
  }, names);

  // ① 步枪贴腮据枪
  await load('rifleman');
  await jump('挥击', 400);
  await page.evaluate(() => { window.modelRoot.rotation.y = Math.PI / 2 - 0.5; });
  await page.waitForTimeout(150);
  const r1 = await snap([['ah_wp_rifle', [0, 0.008, -0.25], [0, 0.008, 0.45]], ['head'], ['r_hand']]);
  await page.screenshot({ path: 'artifacts/shots_soldiers/_sync_cheek.png' });
  console.log('CHEEK:', JSON.stringify(r1));

  // ② RPG 斜背待机
  await load('rocketeer');
  await jump('待机', 300);
  await page.evaluate(() => { window.modelRoot.rotation.y = Math.PI / 2 - 0.4; });
  await page.waitForTimeout(150);
  const r2 = await snap([['ah_wp_rpg', [0, 0, -0.37], [0, 0, 0.66]], ['head']]);
  await page.screenshot({ path: 'artifacts/shots_soldiers/_sync_slant.png' });
  console.log('SLANT:', JSON.stringify(r2));

  // ③ 保安蓄力
  await load('guard');
  await jump('挥击', 290);
  await page.evaluate(() => { window.modelRoot.rotation.y = Math.PI / 2 - 0.5; });
  await page.waitForTimeout(100);
  const r3 = await snap([['ah_wp_baton', [0, 0.004, 0], [0, -0.485, 0]], ['r_hand']]);
  await page.screenshot({ path: 'artifacts/shots_soldiers/_sync_windup.png' });
  console.log('WINDUP:', JSON.stringify(r3));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
