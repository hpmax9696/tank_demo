// 连接常驻 chromium(9333)，reload 加载最新代码，切换变体并截图
const { chromium } = require('playwright');
const variant = process.argv[2] || 'student_m';
(async () => {
  const b = await chromium.connectOverCDP('http://localhost:9333');
  const ctx = b.contexts()[0];
  const p = ctx.pages()[ctx.pages().length - 1];
  await p.reload({ waitUntil: 'networkidle' });
  await p.evaluate((v) => {
    if (window._showVariant) window._showVariant(v);
  }, variant);
  await p.waitForTimeout(1500);
  const path = 'pw_shot_' + variant + '.png';
  await p.screenshot({ path });
  console.log('SHOT ' + path);
  await b.close();
})();
