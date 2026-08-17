// v0.79.24 验证：工厂变体（穿衣烘焙+丧尸动画）+ 游戏（新树渲染+拖行+前伸臂）
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

  // ── 工厂变体模式 ──
  {
    const p = await browser.newPage(); collect(p);
    await p.goto('http://127.0.0.1:8080/model_factory.html');
    await p.evaluate(() => localStorage.setItem('tank_model_factory_save', JSON.stringify({ modelType: 'humanoid' })));
    await p.reload(); await p.waitForTimeout(2500);
    const r = await p.evaluate(() => {
      const HC = window.HumanoidConfig, HA = window.HumanoidAnims;
      const out = {};
      out.hasZombieAnims = !!(window._currentHumanoidAnims && window._currentHumanoidAnims.durations);
      out.restTorso = window._currentHumanoidAnims && window._currentHumanoidAnims.restPoses['torso:x'];
      // 动画表动态生成
      HA.collectRefs();
      out.names = HA.names.map((s) => s.trim());
      out.durs = HA.durations;
      // 衣服渲染：统计 modelRoot mesh 数与 material
      let meshCount = 0; const mats = new Set();
      window.modelRoot.traverse((c) => { if (c.isMesh) { meshCount++; if (c.material && c.material.name) mats.add(c.material.name); } });
      out.meshCount = meshCount;
      // Walk 拖行采样：右膝僵直
      const rot = (n) => { const o = window.modelRoot.getObjectByName(n + '_pivot') || window.modelRoot.getObjectByName(n); return o.rotation.x; };
      const rKnees = [];
      for (let f = 0; f < 55; f++) { HA.updateFrame(0.016, 0, 0, 0, 1); if (f % 10 === 0) rKnees.push(+rot('r_lower_leg').toFixed(2)); }
      out.rKnees = rKnees;
      // Run 双臂前伸
      HA.collectRefs();
      let lArm = null, rArm = null;
      for (let f = 0; f < 20; f++) { HA.updateFrame(0.016, 0, 0, 0, 2); }
      lArm = +rot('l_upper_arm').toFixed(2); rArm = +rot('r_upper_arm').toFixed(2);
      out.runArms = [lArm, rArm];
      // 双手世界位置（前伸应在身前）
      const wp = (n) => { const o = window.modelRoot.getObjectByName(n); const v = new THREE.Vector3(); o.getWorldPosition(v); return [+v.x.toFixed(2), +v.y.toFixed(2), +v.z.toFixed(2)]; };
      out.lHand = wp('l_hand'); out.rHand = wp('r_hand');
      return out;
    });
    ok(r.hasZombieAnims, '工厂变体注入丧尸动画集（含 durations）');
    ok(r.restTorso === 0.2, '驼背 rest torso:x=0.2');
    ok(r.names.length === 6 && !r.names.some((n) => n.includes('拳击')), '动画表 6 项无拳击: ' + JSON.stringify(r.names));
    ok(r.durs[1] === 2200, 'Walk 2200ms 拖行慢速');
    ok(r.meshCount > 25, '穿衣渲染 mesh=' + r.meshCount + '（裸骨架 ~16）');
    ok(r.rKnees.every((k) => k > 0.4 && k < 0.6), 'Walk 右膝僵直拖行 (' + r.rKnees.join(',') + ')');
    ok(r.runArms[0] < -1.0 && r.runArms[1] < -1.0, 'Run 双臂前伸 (' + r.runArms.join(',') + ' ≈-1.25)');
    ok(r.lHand && r.lHand[2] > 0.15, 'Run 左手在身前 z=' + (r.lHand && r.lHand[2]));
    await p.close();
  }

  // ── 游戏侧 ──
  {
    const p = await browser.newPage(); collect(p);
    await p.goto('http://127.0.0.1:8080/index.html'); await p.waitForTimeout(3000);
    const r = await p.evaluate(() => {
      const out = {};
      ['student_m', 'student_f', 'teacher_m', 'teacher_f'].forEach((v) => {
        const z = window.EnemyModels.createCampusZombie({ variant: v, seed: 7 });
        let meshCount = 0;
        z.traverse((c) => { if (c.isMesh) meshCount++; });
        const asys = z.userData._animSystem;
        out[v] = { meshCount, hasPunch: !!(asys && asys.anims && asys.anims.Punch), restTorso: asys && asys._restPoses['torso:x'] };
        // Run 双臂前伸采样
        if (v === 'student_m') {
          asys.play('Run', true);
          for (let i = 0; i < 20; i++) asys.update(0.016);
          let lArm = null;
          z.traverse((c) => { if (c.name === 'l_upper_arm_pivot') lArm = c; });
          out.runArmX = lArm ? +lArm.rotation.x.toFixed(2) : null;
        }
        // Walk 右膝拖行
        if (v === 'teacher_f') {
          asys.play('Walk', true);
          for (let i = 0; i < 30; i++) asys.update(0.016);
          let rKnee = null;
          z.traverse((c) => { if (c.name === 'r_lower_leg_pivot') rKnee = c; });
          out.walkRKnee = rKnee ? +rKnee.rotation.x.toFixed(2) : null;
        }
      });
      return out;
    });
    ['student_m', 'student_f', 'teacher_m', 'teacher_f'].forEach((v) => {
      ok(r[v].meshCount > 25, '游戏 ' + v + ' 穿衣渲染 mesh=' + r[v].meshCount);
      ok(!r[v].hasPunch, '游戏 ' + v + ' 动画无 Punch');
      ok(r[v].restTorso === 0.2, '游戏 ' + v + ' 驼背 rest');
    });
    ok(r.runArmX < -1.0, '游戏 Run 左臂前伸 ' + r.runArmX);
    ok(r.walkRKnee > 0.4 && r.walkRKnee < 0.6, '游戏 Walk 右膝拖行 ' + r.walkRKnee);
    await p.close();
  }

  ok(errors.length === 0, '0 控制台错误' + (errors.length ? ': ' + errors.slice(0, 3).join(';') : ''));
  console.log('Playwright: ' + pass + ' passed, ' + fail + ' failed');
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
