// 姿态复核：精准时机截图 + 头/枪/棍同框局部放大（给 Qwen 明确参照）
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
  // ① 步枪贴腮：t=0.33 据枪段，先转模型再 jump（消除截图延迟干扰）
  await load('rifleman');
  await p.evaluate(() => { window.modelRoot.rotation.y = Math.PI / 2 - 0.5; });
  await p.evaluate(() => { const h = Array.from(document.querySelectorAll('#anim-list .anim-item')).find((it) => it.textContent.includes('挥击')); h.click(); });
  await p.waitForTimeout(330);
  await p.screenshot({ path: 'artifacts/shots_soldiers/final_cheek.png' });
  // ② RPG 斜背
  await load('rocketeer');
  await p.evaluate(() => { window.modelRoot.rotation.y = Math.PI / 2 - 0.4; });
  await p.waitForTimeout(100);
  await p.screenshot({ path: 'artifacts/shots_soldiers/final_slant.png' });
  // ③ 保安蓄力 t=0.28（1.0s 周期）
  await load('guard');
  await p.evaluate(() => { window.modelRoot.rotation.y = Math.PI / 2 - 0.5; });
  await p.evaluate(() => { const h = Array.from(document.querySelectorAll('#anim-list .anim-item')).find((it) => it.textContent.includes('挥击')); h.click(); });
  await p.waitForTimeout(280);
  await p.screenshot({ path: 'artifacts/shots_soldiers/final_windup.png' });
  await b.close();
  console.log('done');
})().catch((e) => { console.error(e); process.exit(1); });
