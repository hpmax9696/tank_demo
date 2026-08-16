// Run 前臂屈肘验证：工厂（骨架/变体）+ 游戏（镜像回归）+ 屈肘角度实测
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const errors = [];
  let pass = 0, fail = 0;
  const ok = (c, m) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m); } };
  const collect = (p) => {
    p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    p.on('pageerror', (e) => errors.push(e.message));
  };

  // 工厂骨架模式：Run 循环中前臂屈肘 90°±摆动
  {
    const p = await browser.newPage(); collect(p);
    await p.goto('http://127.0.0.1:8080/model_factory.html');
    await p.evaluate(() => localStorage.setItem('tank_model_factory_save', JSON.stringify({ modelType: 'humanoid' })));
    await p.reload(); await p.waitForTimeout(2500);
    const r = await p.evaluate(() => {
      const HC = window.HumanoidConfig, HA = window.HumanoidAnims;
      const ver = HC.getSkeletonList()[0];
      window._currentHumanoidAnims = HC.SKELETON_VERSIONS[ver].anims;
      HA.collectRefs();
      const rot = (n) => { const o = window.modelRoot.getObjectByName(n + '_pivot') || window.modelRoot.getObjectByName(n); return o.rotation.x; };
      const rotZ = (n) => { const o = window.modelRoot.getObjectByName(n + '_pivot') || window.modelRoot.getObjectByName(n); return o.rotation.z; };
      const samples = [];
      for (let f = 0; f < 63; f++) { // 0.8s = 50帧/周期, 采样 62 帧≈1.25 周期
        HA.updateFrame(0.016, 0, 0, 0, 2); // Run = index 2
        if ([0, 12, 25, 37, 50].includes(f)) samples.push({ f, lf: +rot('l_forearm').toFixed(3), rf: +rot('r_forearm').toFixed(3), lfZ: +rotZ('l_forearm').toFixed(3), rfZ: +rotZ('r_forearm').toFixed(3) });
      }
      return samples;
    });
    const lf0 = r[0].lf, lfMid = r.find((s) => s.f === 25).lf;
    const rf0 = r[0].rf, rfMid = r.find((s) => s.f === 25).rf;
    ok(lf0 < -1.95 && lf0 > -2.25, '左前臂后摆位屈肘 ' + lf0 + ' (≈120°, v0.79.22 上弯)');
    ok(lfMid > -1.65 && lfMid < -1.45, '左前臂前摆位 ' + lfMid + '（拳指下巴前方）');
    ok(rf0 > -1.65 && rf0 < -1.45, '右前臂前摆位 ' + rf0 + '（与左反相）');
    ok(rfMid < -1.95 && rfMid > -2.25, '右前臂后摆位 ' + rfMid);
    const avg = (lf0 + lfMid + rf0 + rfMid) / 4;
    ok(avg > -2.0 && avg < -1.6, '平均屈肘 ' + avg.toFixed(2) + ' rad ≈ ' + (avg * 57.3).toFixed(0) + '°（≥90° 上弯）');
    // z 内收: l 负/r 正=向中线; 前摆(l t0.5)收得多
    const lfZmid = r.find((s) => s.f === 25).lfZ, rfZmid = r.find((s) => s.f === 25).rfZ;
    ok(lf0 !== undefined && r[0].lfZ <= -0.04 && r[0].lfZ >= -0.09, '左前臂后摆微内收 z=' + r[0].lfZ);
    ok(lfZmid <= -0.17 && lfZmid >= -0.23, '左前臂前摆内收 z=' + lfZmid + '（向前中线）');
    ok(rfZmid >= 0.04 && rfZmid <= 0.09, '右前臂前摆微收 z=' + rfZmid);
    ok(r[0].rfZ >= 0.17 && r[0].rfZ <= 0.23, '右前臂后摆内收 z=' + r[0].rfZ + '（前摆位 t0）');
    await p.close();
  }

  // 游戏：丧尸 Run 前臂屈肘 + 回归
  {
    const p = await browser.newPage(); collect(p);
    await p.goto('http://127.0.0.1:8080/index.html'); await p.waitForTimeout(3000);
    const r = await p.evaluate(() => {
      const z = window.EnemyModels.createCampusZombie({ variant: 'student_m', seed: 7 });
      const asys = z.userData._animSystem;
      const get = (n) => { let o = null; z.traverse((c) => { if (c.name === n + '_pivot') o = c; }); return o ? o.rotation.x : null; };
      const getZ = (n) => { let o = null; z.traverse((c) => { if (c.name === n + '_pivot') o = c; }); return o ? o.rotation.z : null; };
      asys.play('Run', true);
      const s = [];
      for (let f = 0; f < 26; f++) { asys.update(0.016); if (f === 0 || f === 25) s.push({ lf: get('l_forearm'), rf: get('r_forearm'), lfZ: getZ('l_forearm') }); }
      // Walk 回归（应无前臂轨道影响 = 0）
      asys.play('Walk', true); asys.update(0.016);
      for (let f = 0; f < 30; f++) asys.update(0.016);
      const walkLf = get('l_forearm');
      return { s, walkLf };
    });
    ok(r.s[0].lf < -1.2 || r.s[1].lf < -1.2, '游戏 Run 左前臂屈肘 (' + r.s[0].lf.toFixed(2) + '/' + r.s[1].lf.toFixed(2) + ')');
    // 游戏镜像: l 侧 z 取负后应为正=内收(游戏树 l 在 -X, z 正向中线)
    const zin = r.s.map((x) => x.lfZ).filter((v) => v > 0.04).length;
    ok(zin > 0, '游戏 Run 左前臂 z 内收生效 (' + r.s.map((x) => x.lfZ.toFixed(2)).join('/') + ' 镜像后正向中线)');
    ok(r.walkLf !== null && Math.abs(r.walkLf) < 0.05, '游戏 Walk 前臂保持直臂 ' + (r.walkLf || 0).toFixed(2) + '（回归）');
    await p.close();
  }

  ok(errors.length === 0, '0 控制台错误' + (errors.length ? ': ' + errors.slice(0, 2).join(';') : ''));
  console.log('Playwright: ' + pass + ' passed, ' + fail + ' failed');
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
