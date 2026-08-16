// Walk 步态相位验证：左右踝前摆极值时间等距（半周期 ±3帧）+ pelvis 双峰 + 回归
const fs = require('fs');
const path = require('path');
const rootDir = path.resolve(__dirname, '..');

function nodeAsserts() {
  global.window = {};
  eval(fs.readFileSync(path.join(rootDir, 'models/humanoid_config.js'), 'utf8'));
  const HC = global.window.HumanoidConfig;
  let pass = 0, fail = 0;
  const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  ✗ ' + m); } };
  const srcs = [['BASE', HC.BASE_ANIMS.actions]];
  Object.keys(HC.SKELETON_VERSIONS).forEach((k) => srcs.push([k, HC.SKELETON_VERSIONS[k].anims.actions]));
  srcs.forEach(([n, a]) => {
    const r = a.Walk.find((t) => t.joint === 'r_upper_leg');
    const l = a.Walk.find((t) => t.joint === 'l_upper_leg');
    const p = a.Walk.find((t) => t.joint === 'pelvis');
    ok(r.keys[2].t === 0.5 && r.keys[2].v === -0.45, n + ': r_upper_leg 前摆极值在 t=0.5（与 l 的 t=0 错相 0.5）');
    // 等价性: r(t) 应等于 l(t-0.5)（半周期平移）
    const sampleAt = (tr, t) => { const ks = tr.keys; for (let i = 1; i < ks.length; i++) { if (t <= ks[i].t) { const f = (t - ks[i - 1].t) / (ks[i].t - ks[i - 1].t); return ks[i - 1].v + (ks[i].v - ks[i - 1].v) * f; } } return ks[ks.length - 1].v; };
    let maxErr = 0;
    for (let t = 0.02; t < 1; t += 0.02) {
      const shifted = t - 0.5 < 0 ? t + 0.5 : t - 0.5;
      const err = Math.abs(sampleAt(r, t) - sampleAt(l, shifted));
      if (err > maxErr) maxErr = err;
    }
    ok(maxErr < 1e-9, n + ': r(t) ≡ l(t±0.5) 半周期平移（maxErr=' + maxErr + '）');
    ok(p.keys.length === 5 && p.keys[1].v === 0.03 && p.keys[3].v === 0.03, n + ': pelvis 双峰（两步两颠）');
  });
  console.log('Node: ' + pass + ' passed, ' + fail + ' failed');
  return fail === 0;
}

const { chromium } = require('playwright');
(async () => {
  const nodeOk = nodeAsserts();
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
    const HC = window.HumanoidConfig, HA = window.HumanoidAnims;
    const ver = HC.getSkeletonList()[0];
    window._currentHumanoidAnims = HC.SKELETON_VERSIONS[ver].anims;
    HA.collectRefs();
    const wp = (n) => { const o = window.modelRoot.getObjectByName(n + '_pivot') || window.modelRoot.getObjectByName(n); const v = new THREE.Vector3(); o.getWorldPosition(v); return [v.x, v.y, v.z]; };
    // Walk idx=1, dur 1.4s → 87.5 帧/周期; 采 176 帧（2 周期）
    const LZ = [], RZ = [];
    for (let f = 0; f < 176; f++) {
      HA.updateFrame(0.016, 0, 0, 0, 1);
      LZ.push(wp('l_lower_leg')[2]); RZ.push(wp('r_lower_leg')[2]);
    }
    // 找局部极大值（前摆最远点，窗口±4帧）
    const peaks = (arr) => { const out = []; for (let i = 5; i < arr.length - 5; i++) { if (arr[i] >= arr[i - 3] && arr[i] >= arr[i + 3] && arr[i] > 0.02) { if (out.length === 0 || i - out[out.length - 1] > 10) out.push(i); } } return out; };
    return { lp: peaks(LZ), rp: peaks(RZ) };
  });
  // 等距性: 左右极值交错，间隔 ≈ 43.75 帧（87.5/2）
  const all = r.lp.map((f) => ({ s: 'L', f })).concat(r.rp.map((f) => ({ s: 'R', f }))).sort((a, b) => a.f - b.f);
  const gaps = [];
  for (let i = 1; i < all.length; i++) gaps.push({ pair: all[i - 1].s + '→' + all[i].s, d: all[i].f - all[i - 1].f });
  const alternating = all.every((x, i) => (i % 2 === 0 ? x.s === 'L' : x.s === 'R')) || all.every((x, i) => (i % 2 === 0 ? x.s === 'R' : x.s === 'L'));
  const gapOk = gaps.length >= 2 && gaps.every((g) => g.d > 36 && g.d < 52);
  console.log('  极值序列: ' + all.map((x) => x.s + '@' + x.f).join(' '));
  console.log('  间隔: ' + gaps.map((g) => g.pair + ' ' + g.d + '帧').join(' | '));
  ok(alternating, '左右脚极值严格交替');
  ok(gapOk, '步距等距（各间隔 36~52 帧，理想 43.75）');
  ok(errors.length === 0, '0 控制台错误');
  console.log('Playwright: ' + pass + ' passed, ' + fail + ' failed');
  await browser.close();
  process.exit(nodeOk && fail === 0 ? 0 : 1);
})();
