// 三张关键姿态截图：贴腮据枪 / RPG 斜背正面 / 保安曲臂蓄力
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  await p.goto('http://127.0.0.1:8080/model_factory.html', { waitUntil: 'networkidle' });
  await p.evaluate(() => localStorage.setItem('tank_model_factory_save', JSON.stringify({ modelType: 'humanoid' })));
  await p.reload({ waitUntil: 'networkidle' });
  await p.waitForTimeout(1000);
  async function load(vk) {
    await p.evaluate((k) => { window._humanoidEdit.variant = k; window._humanoidEdit.params.height = 1.68; window._applyHumanoidEdit(); }, vk);
    await p.waitForTimeout(600);
    await p.evaluate(() => { const btn = document.getElementById('toggle-anim'); if (btn.classList.contains('active')) btn.click(); });
    await p.waitForTimeout(200);
    await p.click('#toggle-anim');
    await p.waitForTimeout(700);
  }
  async function jump(lb) {
    await p.evaluate((l) => { const h = Array.from(document.querySelectorAll('#anim-list .anim-item')).find((it) => it.textContent.includes(l)); if (h) h.click(); }, lb);
    await p.waitForTimeout(120);
  }
  await load('rifleman');
  await jump('挥击');
  await p.waitForTimeout(400);
  await p.evaluate(() => { window.modelRoot.rotation.y = Math.PI / 2 - 0.5; });
  await p.waitForTimeout(200);
  await p.screenshot({ path: 'artifacts/shots_soldiers/rifleman_cheek.png' });
  await load('rocketeer');
  await jump('待机');
  await p.waitForTimeout(300);
  await p.evaluate(() => { window.modelRoot.rotation.y = Math.PI / 2 - 0.4; });
  await p.waitForTimeout(200);
  await p.screenshot({ path: 'artifacts/shots_soldiers/rocketeer_slant.png' });
  await load('guard');
  await jump('挥击');
  await p.evaluate(() => { window.modelRoot.rotation.y = Math.PI / 2 - 0.5; });
  await p.waitForTimeout(130);
  await p.screenshot({ path: 'artifacts/shots_soldiers/guard_windup.png' });
  await b.close();
  console.log('3 shots done');
})().catch((e) => { console.error(e); process.exit(1); });
