// 发射特效定帧摆拍 v2：改轨道 keys 恒亮（_animDefs 与 animsCfg.actions 共享 keys 引用，
// 下一帧 updateFrame 即用新值；运动行为已由 verify_soldier_anims 数值证明，此处只拍视觉外观）
const { chromium } = require('playwright');
const URL = process.env.FACTORY_URL || 'http://127.0.0.1:8080/model_factory.html';
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
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
  const setKeys = (pageFn) => page.evaluate(pageFn);

  // rifleman：据枪段 flash 恒亮（⚠️ keys 必须 splice 原地改——属性赋值会断开 _animDefs 的数组引用）
  await loadVariant('rifleman');
  await jumpAnim('挥击');
  await page.waitForTimeout(320); // t≈0.27 据枪瞄准段
  await setKeys(() => {
    var acts = window._currentHumanoidAnims.actions.Swing;
    acts.filter(function (t) { return t.joint === 'ah_wp_rf_flash'; }).forEach(function (t) {
      t.keys.splice(0, t.keys.length, { t: 0, v: 1.4 }, { t: 1, v: 1.4 });
    });
    if (window.modelRoot) window.modelRoot.rotation.y = Math.PI / 2 - 0.55;
  });
  await page.waitForTimeout(200);
  await page.screenshot({ path: 'artifacts/shots_soldiers/rifleman_fire_peak.png' });
  console.log('shot rifleman');

  // rocketeer：肩扛段双焰恒亮 + 战斗部离筒
  await loadVariant('rocketeer');
  await jumpAnim('挥击');
  await page.waitForTimeout(450); // t≈0.28 肩扛段
  await setKeys(() => {
    var acts = window._currentHumanoidAnims.actions.Swing;
    acts.filter(function (t) { return t.joint === 'ah_wp_rpg_flash_f'; }).forEach(function (t) { t.keys.splice(0, t.keys.length, { t: 0, v: 1.6 }, { t: 1, v: 1.6 }); });
    acts.filter(function (t) { return t.joint === 'ah_wp_rpg_flash_b'; }).forEach(function (t) { t.keys.splice(0, t.keys.length, { t: 0, v: 1.4 }, { t: 1, v: 1.4 }); });
    acts.filter(function (t) { return t.joint === 'ah_wp_rpg_warhead'; }).forEach(function (t) { t.keys.splice(0, t.keys.length, { t: 0, v: 0.35 }, { t: 1, v: 0.35 }); });
    if (window.modelRoot) window.modelRoot.rotation.y = Math.PI / 2 - 0.55;
  });
  await page.waitForTimeout(200);
  await page.screenshot({ path: 'artifacts/shots_soldiers/rocketeer_fire_peak.png' });
  console.log('shot rocketeer');
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
