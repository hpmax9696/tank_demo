// verify_trouser_runtime.js — 男教师裤管修正 浏览器验证
// 游戏侧：站姿大腿段裤底在膝下 ~0.05（按大腿 mesh 长度反推 scale 归一）；工厂 Run 采样 0 错误
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

  // ── 游戏侧（enemies.js 管线，含 height 归一）──
  const p = await browser.newPage(); collect(p);
  await p.goto('http://127.0.0.1:8080/index.html'); await p.waitForTimeout(3000);
  const r = await p.evaluate(() => {
    const z = window.EnemyModels.createCampusZombie({ variant: 'teacher_m', seed: 5 });
    z.updateMatrixWorld(true);
    const yOf = (name) => {
      let o = null;
      z.traverse((c) => { if (!o && c.name === name) o = c; });
      return o ? o.getWorldPosition(new THREE.Vector3()).y : null;
    };
    const meshYRange = (name) => {
      let o = null;
      z.traverse((c) => { if (!o && c.name === name + '_mesh') o = c; });
      if (!o) return null;
      const pos = o.geometry.attributes.position;
      const v = new THREE.Vector3();
      let mn = Infinity, mx = -Infinity;
      for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld); if (v.y < mn) mn = v.y; if (v.y > mx) mx = v.y; }
      return { mn, mx };
    };
    const thigh = meshYRange('l_upper_leg'); // 大腿 mesh（长度×scale 反推）
    const trSeg = meshYRange('ah_tr_l'); // 大腿段裤管
    const tcSeg = meshYRange('ah_tc_l'); // 小腿段裤管
    const knee = yOf('l_lower_leg_pivot'); // 膝关节
    return {
      thighLen: thigh ? thigh.mx - thigh.mn : null,
      trBot: trSeg ? trSeg.mn : null,
      trTop: trSeg ? trSeg.mx : null,
      tcBot: tcSeg ? tcSeg.mn : null,
      knee,
      foot: yOf('l_foot_pivot'),
    };
  });
  const scale = r.thighLen / 0.3465; // height 归一缩放
  const belowKnee = (r.knee - r.trBot) / scale; // 膝下伸出（模型尺度）
  ok(r.trBot !== null && r.knee !== null, '大腿段/膝部节点找到（裤底 ' + r.trBot.toFixed(3) + ' / 膝 ' + r.knee.toFixed(3) + ' world）');
  ok(Math.abs(belowKnee - 0.051) < 0.012, '站姿大腿段裤底 = 膝下 ' + belowKnee.toFixed(3) + '（模型尺度，修正前 0.172；scale=' + scale.toFixed(3) + '）');
  ok(r.trTop > r.knee + 0.25 * scale, '大腿段顶沿仍在髋区（顶 ' + r.trTop.toFixed(3) + ' > 膝+' + (0.25 * scale).toFixed(3) + '）');
  ok(r.tcBot < r.foot + 0.03 * scale, '小腿段裤底仍近踝（' + ((r.foot - r.tcBot) / scale).toFixed(3) + ' 模型尺度内）');
  await p.close();

  // ── 工厂侧（Run 展台采样，确认双段动画正常 + 0 错误）──
  const p2 = await browser.newPage(); collect(p2);
  await p2.goto('http://127.0.0.1:8080/model_factory.html');
  await p2.evaluate(() => localStorage.setItem('tank_model_factory_save', JSON.stringify({ modelType: 'humanoid' })));
  await p2.reload(); await p2.waitForTimeout(2500);
  const r2 = await p2.evaluate(() => {
    const out = { hasBoth: false };
    _humanoidEdit.variant = 'teacher_m';
    _applyHumanoidEdit();
    let tr = null, tc = null;
    modelRoot.traverse((c) => { if (!tr && c.name === 'ah_tr_l') tr = c; if (!tc && c.name === 'ah_tc_l') tc = c; });
    out.hasBoth = !!(tr && tc);
    const HA = window.HumanoidAnims;
    HA.collectRefs();
    const runIdx = HA.names.findIndex((n) => /\(Run\)$/.test(n));
    out.runIdx = runIdx;
    // 采样屈膝最大帧附近的裤段世界间距（胫段顶 vs 大腿段底在腿轴向投影——退化为 world y 对比即可见性检查）
    HA.updateFrame(0.9, 0, 0, 1000, runIdx); // Run t=0.9 折角大
    modelRoot.updateMatrixWorld(true);
    const bb = (name) => { let o = null; modelRoot.traverse((c) => { if (!o && c.name === name + '_mesh') o = c; }); return o ? new THREE.Box3().setFromObject(o) : null; };
    const b1 = bb('ah_tr_l'), b2 = bb('ah_tc_l');
    out.trMinZ = b1 ? b1.min.z : null; // 屈膝时戳出方向为前(+z)
    out.tcMinZ = b2 ? b2.min.z : null;
    out.tcMaxZ = b2 ? b2.max.z : null;
    out.trMaxZ = b1 ? b1.max.z : null;
    return out;
  });
  ok(r2.hasBoth && r2.runIdx >= 0, '工厂 teacher_m 双裤段 + Run 动画（idx=' + r2.runIdx + '）');
  const frontOverhang = r2.trMaxZ - r2.tcMaxZ;
  ok(frontOverhang < 0.03 * 0.6 + 0.01, 'Run 屈膝帧大腿段前缘超出小腿段 ' + frontOverhang.toFixed(3) + ' world（粗盖细落差，修正前穿透 ~0.07）');
  await p2.waitForTimeout(300);
  await p2.screenshot({ path: 'artifacts/trouser_run_teacher_m.png' });
  console.log('  📸 截图 artifacts/trouser_run_teacher_m.png');
  ok(errors.length === 0, '0 控制台错误' + (errors.length ? ': ' + errors.slice(0, 3).join(';') : ''));
  console.log('Playwright: ' + pass + ' passed, ' + fail + ' failed');
  await browser.close();
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
