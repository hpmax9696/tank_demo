// Playwright 验证：工厂骨架模式(共通)直立 + 变体(丧尸)驼背
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));

  // 预设 localStorage：上次模型 = humanoid（变体模式默认）
  await page.goto('http://127.0.0.1:8080/model_factory.html');
  await page.evaluate(() => {
    localStorage.setItem('tank_model_factory_save', JSON.stringify({ modelType: 'humanoid' }));
  });
  await page.reload();
  await page.waitForTimeout(2500);

  const r = await page.evaluate(() => {
    const HC = window.HumanoidConfig;
    const HA = window.HumanoidAnims;
    const out = { steps: [] };
    function torso() {
      const t = window.modelRoot.getObjectByName('torso');
      const n = window.modelRoot.getObjectByName('neck_pivot') || window.modelRoot.getObjectByName('neck');
      const h = window.modelRoot.getObjectByName('head_pivot') || window.modelRoot.getObjectByName('head');
      return {
        torsoX: +t.rotation.x.toFixed(3),
        neckX: n ? +n.rotation.x.toFixed(3) : null,
        headZ: h ? +h.rotation.z.toFixed(3) : null,
      };
    }
    function play(idx, frames) {
      HA.updateFrame(0.016, 0, 0, 0, idx);
      for (let i = 0; i < (frames || 40); i++) HA.updateFrame(0.016, 0, 0, 0, idx);
    }

    // ── A. 变体模式（默认加载 student_m）＝ 丧尸烘焙 → 应驼背 ──
    out.steps.push({ step: 'A0 变体加载', anims: !!window._currentHumanoidAnims, rest: window._currentHumanoidAnims && window._currentHumanoidAnims.restPoses['torso:x'] });
    HA.collectRefs();
    play(0);
    out.variantIdle = torso(); // 期望 torsoX ≈ 0.2

    // ── B. 注入骨架版本 anims（骨架共通模式的数据源）→ 直立 ──
    const ver = HC.getSkeletonList()[0];
    window._currentHumanoidAnims = HC.SKELETON_VERSIONS[ver].anims;
    HA.collectRefs();
    play(0);
    out.skelIdle = torso(); // 期望 torsoX ≈ 0
    play(1);
    out.skelWalk = torso(); // 期望 torsoX ≈ 0（Walk 无 torso 轨道 → rest）
    play(2, 10);
    out.skelRunEarly = torso(); // Run torso 绝对 0.3→0.15 → 前 10 帧接近 0.3
    // Walk/Run neck 也应 0
    out.skelNeck = { neckX: out.skelWalk.neckX };
    return out;
  });

  console.log(JSON.stringify(r, null, 1));

  // ── C. 截图（变体恢复 + 展台 Idle）视觉留档 ──
  await page.evaluate(() => {
    const HC = window.HumanoidConfig;
    window._currentHumanoidAnims = HC.MODELS[HC.getVariantList()[0]].anims;
    window.HumanoidAnims.collectRefs();
    window.HumanoidAnims.updateFrame(0.016, 0, 0, 0, 0);
  });
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'artifacts/verify_upright_variant_idle.png' });

  console.log('console errors:', errors.length ? errors : 'NONE');
  await browser.close();

  // 断言
  let fail = 0;
  const ok = (c, m) => { if (!c) { fail++; console.log('✗ ' + m); } else console.log('✓ ' + m); };
  ok(Math.abs(r.variantIdle.torsoX - 0.2) < 0.03, '变体(丧尸) Idle 驼背 torsoX=' + r.variantIdle.torsoX + ' (≈0.2)');
  ok(Math.abs(r.variantIdle.neckX - 0.22) < 0.03, '变体(丧尸) Idle 探头 neckX=' + r.variantIdle.neckX + ' (≈0.22)');
  ok(Math.abs(r.skelIdle.torsoX) < 0.03, '骨架(共通) Idle 直立 torsoX=' + r.skelIdle.torsoX + ' (≈0)');
  ok(Math.abs(r.skelWalk.torsoX) < 0.03, '骨架(共通) Walk 直立 torsoX=' + r.skelWalk.torsoX + ' (≈0)');
  ok(r.skelRunEarly.torsoX > 0.1 && r.skelRunEarly.torsoX < 0.35, '骨架(共通) Run 前倾 torsoX=' + r.skelRunEarly.torsoX + ' (0.15~0.3)');
  ok(Math.abs(r.skelIdle.neckX) < 0.03 && Math.abs(r.skelWalk.neckX) < 0.03, '骨架(共通) Idle/Walk neckX=' + r.skelIdle.neckX + '/' + r.skelWalk.neckX + ' (≈0)');
  ok(errors.length === 0, '0 控制台错误');
  process.exit(fail ? 1 : 0);
})();
