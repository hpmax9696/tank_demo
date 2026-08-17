// verify_gait_runtime.js — 丧尸步态修正 浏览器验证
// 工厂展台实际播放 Walk/Run 全周期，采样渲染关节 rotation.x，断言无双蹬相；截图供目视
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const errors = [];
  let pass = 0, fail = 0;
  const ok = (c, m) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m); } };
  const p = await browser.newPage();
  p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  p.on('pageerror', (e) => errors.push(e.message));
  await p.goto('http://127.0.0.1:8080/model_factory.html');
  await p.evaluate(() => localStorage.setItem('tank_model_factory_save', JSON.stringify({ modelType: 'humanoid' })));
  await p.reload(); await p.waitForTimeout(2500);

  const r = await p.evaluate(() => {
    _humanoidEdit.variant = 'student_f';
    _applyHumanoidEdit();
    const HA = window.HumanoidAnims;
    HA.collectRefs();
    const rot = (name) => { let o = null; modelRoot.traverse((c) => { if (!o && c.name === name) o = c; }); return o ? o.rotation.x : null; };
    const out = {};
    [['Walk', /\(Walk\)$/], ['Run', /\(Run\)$/]].forEach(([label, re]) => {
      const idx = HA.names.findIndex((n) => re.test(n));
      const dur = HA.durations[idx] / 1000;
      const frames = [];
      const N = 80;
      for (let i = 0; i <= N; i++) {
        // 逐帧步进：resetState 后从 0 累进到目标相位（collectRefs 重置 _t=0）
        if (i === 0) HA.updateFrame(0.0001, 0, 0, 1000, idx);
        else HA.updateFrame(dur / N, 0, 0, 1000, idx);
        frames.push({
          t: i / N,
          lUp: rot('l_upper_leg_pivot'), rUp: rot('r_upper_leg_pivot'),
          lLo: rot('l_lower_leg_pivot'), rLo: rot('r_lower_leg_pivot'),
        });
      }
      out[label] = frames;
      out[label + 'Idx'] = idx;
    });
    return out;
  });

  ['Walk', 'Run'].forEach((an) => {
    const fr = r[an];
    ok(r[an + 'Idx'] >= 0 && fr.length === 81, an + ' 展台采样 81 帧（idx=' + r[an + 'Idx'] + '）');
    let doublePush = -1e9, badAlt = 0;
    fr.forEach((f) => {
      if (Math.min(f.lUp, f.rUp) > doublePush) doublePush = Math.min(f.lUp, f.rUp);
      if ((f.lUp > 0.15 && f.rUp > -0.05) || (f.rUp > 0.15 && f.lUp > -0.05)) badAlt++;
    });
    ok(doublePush <= 0.1, an + ' 渲染层无双蹬相（min(θL,θR) 峰 ' + doublePush.toFixed(3) + ' ≤ 0.1）');
    ok(badAlt === 0, an + ' 渲染层一迈一撑交叉（违例帧 ' + badAlt + '/81）');
    const kneeMin = Math.min(...fr.map((f) => f.lLo));
    const swingPeak = Math.max(...fr.map((f) => f.lLo));
    ok(kneeMin <= 0.25, an + ' 支撑期左膝伸直（最小 ' + kneeMin.toFixed(3) + '；旧版恒 ≥0.35 屈膝）');
    ok(swingPeak >= (an === 'Run' ? 0.75 : 0.55), an + ' 摆动期抬膝（峰 ' + swingPeak.toFixed(2) + '）');
  });

  // 截图：Walk 中段 + Run 屈膝帧
  await p.evaluate(() => {
    const HA = window.HumanoidAnims;
    HA.collectRefs();
    HA.updateFrame(0.6, 0, 0, 1000, HA.names.findIndex((n) => /\(Walk\)$/.test(n)));
  });
  await p.waitForTimeout(300);
  await p.screenshot({ path: 'artifacts/gait_walk_student_f.png' });
  await p.evaluate(() => {
    const HA = window.HumanoidAnims;
    HA.collectRefs();
    HA.updateFrame(0.6, 0, 0, 1000, HA.names.findIndex((n) => /\(Run\)$/.test(n)));
  });
  await p.waitForTimeout(300);
  await p.screenshot({ path: 'artifacts/gait_run_student_f.png' });
  console.log('  📸 截图 artifacts/gait_walk_student_f.png / gait_run_student_f.png');
  ok(errors.length === 0, '0 控制台错误' + (errors.length ? ': ' + errors.slice(0, 3).join(';') : ''));
  console.log('Playwright: ' + pass + ' passed, ' + fail + ' failed');
  await browser.close();
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
