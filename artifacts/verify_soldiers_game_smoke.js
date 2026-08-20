// 游戏主页冒烟：humanoid_config/enemies 改动后 index.html 0 错误
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('http://127.0.0.1:8080/index.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);
  const hasMenu = await page.evaluate(() => !!document.querySelector('#mainMenu, .menu, #menu') || (window.gameState === 'menu'));
  const variantCount = await page.evaluate(() => (window.HumanoidConfig ? Object.keys(window.HumanoidConfig.MODELS).length : -1));
  console.log('menu:', hasMenu, '| MODELS variants:', variantCount, '| errors:', errors.length ? errors.slice(0, 5).join(' || ') : 'none');
  await browser.close();
  process.exit(errors.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
