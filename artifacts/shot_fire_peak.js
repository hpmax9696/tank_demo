// 拍摄射击/发射瞬间截图（火焰峰值窗）
const { chromium } = require('playwright');
const URL = process.env.FACTORY_URL || 'http://127.0.0.1:8080/model_factory.html';
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on('pageerror', (e) => console.error('PAGEERR', String(e)));
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.setItem('tank_model_factory_save', JSON.stringify({ modelType: 'humanoid' })));
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  async function loadVariant(vk) {
    await page.evaluate((k) => {
      window._humanoidEdit.variant = k;
      window._humanoidEdit.params.height = window.HumanoidConfig.HUMANOID_VARIANTS[k].bodyRange.height[0];
      window._applyHumanoidEdit();
    }, vk);
    await page.waitForTimeout(600);
    await page.evaluate(() => {
      const btn = document.getElementById('toggle-anim');
      if (btn.classList.contains('active')) btn.click();
    });
    await page.waitForTimeout(200);
    await page.click('#toggle-anim');
    await page.waitForTimeout(700);
  }
  async function jumpAnim(label) {
    await page.evaluate((lb) => {
      var hit = Array.from(document.querySelectorAll('#anim-list .anim-item')).find((it) => it.textContent.includes(lb));
      if (hit) hit.click();
    }, label);
  }
  // rifleman 首发 t=0.30/1.2s
  await loadVariant('rifleman');
  await jumpAnim('挥击');
  await page.waitForTimeout(240);
  await page.screenshot({ path: 'artifacts/shots_soldiers/rifleman_fire_peak.png' });
  console.log('shot rifleman_fire_peak');
  // rocketeer 发射 t=0.45/1.6s
  await loadVariant('rocketeer');
  await jumpAnim('挥击');
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'artifacts/shots_soldiers/rocketeer_fire_peak.png' });
  console.log('shot rocketeer_fire_peak');
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
