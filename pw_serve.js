// 常驻有头 chromium 调试服务（暴露 CDP 9333，导航到人形调试页，挂起保持）
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({
    headless: false,
    args: ['--remote-debugging-port=9333'],
  });
  const ctx = await b.newContext({ viewport: { width: 1100, height: 850 } });
  const p = await ctx.newPage();
  await p.goto('http://127.0.0.1:8080/debug_humanoid.html', { waitUntil: 'networkidle' });
  console.log('CHROMIUM_READY 9333');
  await new Promise(() => {}); // 常驻
})();
