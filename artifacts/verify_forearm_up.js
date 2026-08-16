// Run 前臂上弯验证：最低点前臂不低于水平（elbow→hand 向量 y ≥ -0.05）+ 前摆拳接近下巴
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
    const HC = window.HumanoidConfig, HA = window.HumanoidAnims;
    const ver = HC.getSkeletonList()[0];
    window._currentHumanoidAnims = HC.SKELETON_VERSIONS[ver].anims;
    HA.collectRefs();
    const wp = (n) => { const o = window.modelRoot.getObjectByName(n); const v = new THREE.Vector3(); o.getWorldPosition(v); return [v.x, v.y, v.z]; };
    const samples = [];
    for (let f = 0; f < 52; f++) { // Run 0.8s=50帧
      HA.updateFrame(0.016, 0, 0, 0, 2);
      if (f % 5 === 0) {
        const e = wp('l_forearm'), h = wp('l_hand'), head = wp('head');
        samples.push({ f, elbow: e, hand: h, head });
      }
    }
    return samples;
  });
  // 前臂方向 = hand - elbow, 归一 y 分量; ≥ -0.05 即不低于水平(容差)
  let minYDir = 1, worstF = -1;
  let frontBest = null; // 前摆最远帧（hand.z 最大）
  r.forEach((s) => {
    const dx = s.hand[0] - s.elbow[0], dy = s.hand[1] - s.elbow[1], dz = s.hand[2] - s.elbow[2];
    const len = Math.hypot(dx, dy, dz);
    const yDir = dy / len;
    if (yDir < minYDir) { minYDir = yDir; worstF = s.f; }
    if (!frontBest || s.hand[2] > frontBest.hand[2]) frontBest = s;
  });
  ok(minYDir > -0.05, '前臂最低点不低于水平（yDir=' + minYDir.toFixed(3) + '@f' + worstF + ', 水平=0）');
  // 前摆拳高于肘（前臂上仰）且接近下巴高度
  const frontDy = frontBest.hand[1] - frontBest.elbow[1];
  ok(frontDy > 0.05, '前摆拳高于肘 Δy=' + frontDy.toFixed(3) + '（前臂上仰）');
  const chinGap = frontBest.head[1] - 0.15 - frontBest.hand[1]; // 头中心-0.15 近似下巴
  ok(chinGap < 0.45 && frontBest.hand[1] > 0, '前摆拳接近下巴高度（拳y=' + frontBest.hand[1].toFixed(2) + ' 头y=' + frontBest.head[1].toFixed(2) + '）');
  ok(errors.length === 0, '0 控制台错误');
  console.log('Playwright: ' + pass + ' passed, ' + fail + ' failed');
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
