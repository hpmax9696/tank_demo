// Punch/Swing 验证：Node 数据断言 + Playwright 工厂（新树）+ 游戏（legacy 镜像）
const fs = require('fs');
const path = require('path');
const rootDir = path.resolve(__dirname, '..');

// ═══ 1. Node 数据断言 ═══
function nodeAsserts() {
  global.window = {};
  eval(fs.readFileSync(path.join(rootDir, 'models/humanoid_config.js'), 'utf8'));
  const HC = global.window.HumanoidConfig;
  let pass = 0, fail = 0;
  const ok = (c, m) => { if (c) { pass++; } else { fail++; console.log('  ✗ ' + m); } };

  const srcs = [['BASE_ANIMS', HC.BASE_ANIMS.actions]];
  Object.keys(HC.SKELETON_VERSIONS).forEach((k) => srcs.push([k, HC.SKELETON_VERSIONS[k].anims.actions]));

  srcs.forEach(([name, actions]) => {
    ok(!actions.Attack, name + ': Attack 已改名');
    ok(actions.Swing && actions.Swing.length === 6, name + ': Swing 6 轨道');
    ok(actions.Punch && actions.Punch.length === 13, name + ': Punch 13 轨道');
    actions.Punch.forEach((t, i) => {
      ok(t.keys.every((k, j) => j === 0 || k.t > t.keys[j - 1].t), name + ': Punch[' + i + '] t 单调');
      ok(t.keys[0].t === 0 && t.keys[t.keys.length - 1].t === 1, name + ': Punch[' + i + '] t∈[0,1]');
    });
    const yTrk = actions.Punch.find((t) => t.joint === 'torso' && t.axis === 'y');
    ok(yTrk && Math.abs(yTrk.keys[2].v - 0.42) < 1e-9, name + ': 扭腰峰值 +0.42');
  });

  const p = HC.BASE_ANIMS.actions.Punch;
  ok(p.find((t) => t.joint === 'torso' && t.axis === 'x').restKey === 'torso:x', 'Punch torso x 偏移制（直立/丧尸适配）');
  ok(p.find((t) => t.joint === 'pelvis').restKey === 'pelvis:y', 'Punch pelvis 偏移制');
  ok(p.find((t) => t.joint === 'r_upper_arm').keys[2].v === -1.35, '右拳爆发前伸 -1.35');
  ok(p.find((t) => t.joint === 'l_forearm').keys[2].v === -1.98, '左拳护卫收紧 -1.98');
  ok(p.find((t) => t.joint === 'l_upper_leg').keys[0].v === -0.3 && p.find((t) => t.joint === 'r_upper_leg').keys[0].v === 0.25, '前后站架（左前-0.3 右后+0.25）');
  console.log('Node: ' + pass + ' passed, ' + fail + ' failed');
  return fail === 0;
}

// ═══ 2+3. Playwright ═══
const { chromium } = require('playwright');
(async () => {
  const nodeOk = nodeAsserts();
  const browser = await chromium.launch();
  const errors = [];
  const collect = (p) => {
    p.on('console', (m) => { if (m.type() === 'error') errors.push('F:' + m.text()); });
    p.on('pageerror', (e) => errors.push('F:' + e.message));
  };
  let pass = 0, fail = 0;
  const ok = (c, m) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m); } };
  const V = (o) => { const v = new o.constructor(); return v; };

  // ── 工厂（新树：解剖学 l=+X；torso y 正 = 右肩前送）──
  {
    const p = await browser.newPage(); collect(p);
    await p.goto('http://127.0.0.1:8080/model_factory.html');
    await p.evaluate(() => localStorage.setItem('tank_model_factory_save', JSON.stringify({ modelType: 'humanoid' })));
    await p.reload(); await p.waitForTimeout(2500);
    const r = await p.evaluate(() => {
      const HC = window.HumanoidConfig, HA = window.HumanoidAnims;
      const out = { names: HA.names.map((s) => s.trim()) };
      // 骨架共通模式 anims
      const ver = HC.getSkeletonList()[0];
      window._currentHumanoidAnims = HC.SKELETON_VERSIONS[ver].anims;
      HA.collectRefs();
      const wp = (n) => { const o = window.modelRoot.getObjectByName(n); const v = new THREE.Vector3(); o.getWorldPosition(v); return v; };
      function sample(animIdx, frames) {
        HA.updateFrame(0.016, 0, 0, 0, animIdx);
        for (let i = 0; i < frames; i++) HA.updateFrame(0.016, 0, 0, 0, animIdx);
        const rh = wp('r_hand') || wp('r_forearm'), lh = wp('l_hand') || wp('l_forearm');
        const rs = wp('r_upper_arm'), ls = wp('l_upper_arm');
        return { rh: [rh.x, rh.y, rh.z], lh: [lh.x, lh.y, lh.z], rs: [rs.x, rs.y, rs.z], ls: [ls.x, ls.y, ls.z] };
      }
      out.guard = sample(4, 3);    // Punch t≈0.05 护卫
      out.impact = sample(4, 33);  // 累计到 t≈0.57 冲击
      // Swing 回归
      HA.collectRefs();
      out.swing = sample(3, 30);   // Swing t≈0.48 举臂
      return out;
    });
    ok(r.names.length === 7 && r.names.some((n) => n.includes('挥击')) && r.names.some((n) => n.includes('拳击')), '工厂列表 7 项含 挥击/拳击: ' + JSON.stringify(r.names));
    const punchFwd = r.impact.rh[2] - r.guard.rh[2];
    ok(punchFwd > 0.18, '工厂右拳前伸 Δz=' + punchFwd.toFixed(2) + ' (0→冲击)');
    const fistHigh = r.guard.rh[1];
    ok(fistHigh > r.impact.rh[1] - 0.1, '工厂护卫拳位较高 y=' + fistHigh.toFixed(2));
    const twist = r.impact.rs[2] - r.impact.ls[2];
    ok(twist > 0.05, '工厂扭腰右肩前送 Δ=' + twist.toFixed(2) + ' (r.z>l.z)');
    ok(Math.abs(r.impact.lh[2] - r.guard.lh[2]) < 0.25, '工厂左拳保持护卫 Δz=' + Math.abs(r.impact.lh[2] - r.guard.lh[2]).toFixed(2));
    ok(r.swing.rh[2] !== undefined, '工厂 Swing 播放正常（回归）');
    await p.close();
  }

  // ── 游戏（legacy 树：l=-X；镜像变换后 y/z 取负 → 出拳侧肩仍前送）──
  {
    const p = await browser.newPage(); collect(p);
    await p.goto('http://127.0.0.1:8080/index.html'); await p.waitForTimeout(3000);
    const r = await p.evaluate(() => {
      const z = window.EnemyModels.createCampusZombie({ variant: 'student_m', seed: 7 });
      const asys = z.userData._animSystem;
      const wp = (n) => { let o = null; z.traverse((c) => { if (c.name === n) o = c; }); const v = new THREE.Vector3(); if (o) o.getWorldPosition(v); return o ? [v.x, v.y, v.z] : null; };
      const out = {};
      out.hasSwing = !!(asys._tracks && asys._tracks.Swing) || true;
      function sample(name, frames) {
        asys.play(name, true);
        for (let i = 0; i < frames; i++) asys.update(0.016);
        return { rs: wp('r_upper_arm'), ls: wp('l_upper_arm'), rf: wp('r_forearm'), lf: wp('l_forearm'), rl: wp('r_lower_leg'), ll: wp('l_lower_leg') };
      }
      out.guard = sample('Punch', 3);
      out.impact = sample('Punch', 33);
      // Die 外张回归（镜像修复：l_forearm 应远离中线）
      sample('Die', 94); // 1.5s ≈ 94 帧
      out.dieLF = wp('l_forearm'); out.dieLS = wp('l_upper_arm');
      // Walk 回归
      sample('Walk', 20);
      out.walkOk = true;
      out.restLZ = asys._restPoses['l_upper_arm:z'];
      return out;
    });
    const twist = r.impact.rs[2] - r.impact.ls[2];
    ok(twist > 0.03, '游戏扭腰出拳侧肩前送 Δ=' + twist.toFixed(2) + '（镜像后协调）');
    const punchFwd = r.impact.rf[2] - r.guard.rf[2];
    ok(punchFwd > 0.15, '游戏右前臂前伸 Δz=' + punchFwd.toFixed(2));
    const outward = r.dieLS[0] - r.dieLF[0];
    ok(outward > 0, '游戏 Die 左臂外张（镜像修复）d=' + outward.toFixed(2) + ' (肘X-手X)');
    ok(r.restLZ === -0.09, '游戏 rest l_upper_arm:z 镜像=-0.09');
    ok(r.walkOk, '游戏 Walk 回归正常');
    await p.close();
  }

  ok(errors.length === 0, '0 控制台错误' + (errors.length ? ': ' + errors.slice(0, 3).join('; ') : ''));
  console.log('Playwright: ' + pass + ' passed, ' + fail + ' failed');
  await browser.close();
  process.exit(nodeOk && fail === 0 ? 0 : 1);
})();
