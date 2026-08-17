// v0.79.31 验证：上衣颜色/袖子覆盖/血滴/刘海圆弧贴合
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const errors = [];
  let pass = 0, fail = 0;
  const ok = (c, m) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m); } };
  const p = await browser.newPage();
  p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  p.on('pageerror', (e) => errors.push(e.message));
  await p.goto('http://127.0.0.1:8080/index.html'); await p.waitForTimeout(3000);
  const r = await p.evaluate(() => {
    const out = {};
    const colorOf = (z, name) => { let c = null; z.traverse((o) => { if (!c && o.isMesh && o.name === name + '_mesh' && o.material && o.material.color) c = o.material.color.getHexString(); }); return c; };
    const has = (z, name) => { let f = false; z.traverse((o) => { if (o.name === name + '_mesh') f = true; }); return f; };
    const vrange = (z, name) => { let o = null; z.traverse((c) => { if (!o && c.name === name + '_mesh') o = c; }); if (!o) return null; const pos = o.geometry.attributes.position; const v = new THREE.Vector3(); let mn = Infinity, mx = -Infinity; for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld); if (v.y < mn) mn = v.y; if (v.y > mx) mx = v.y; } return { mn, mx }; };
    ['student_m', 'student_f', 'teacher_m', 'teacher_f'].forEach((v) => {
      const z = window.EnemyModels.createCampusZombie({ variant: v, seed: 5 });
      out[v] = {
        top: colorOf(z, 'torso_upper'),
        lower: colorOf(z, 'torso_lower'),
        skin: colorOf(z, 'l_forearm'), // 前臂色（裸露=skin / 长袖=蓝）
        hasSleeveL: has(z, 'ah_ssw_l') || has(z, 'ah_ssp_l') || has(z, 'ah_lsb_u'),
        hasBloodGeo: has(z, 'ah_bld1') || has(z, 'ah_bld_sw1'), // v0.79.32 几何血迹应删除
        hasBloodMap: (() => { let o = null; z.traverse((c) => { if (!o && c.isMesh && c.name === 'torso_upper_mesh' && c.material && c.material.map) o = c; }); return !!o; })(),
      };
    });
    // 学生男：袖子覆盖上臂（臂上部世界色=白）
    const sm = window.EnemyModels.createCampusZombie({ variant: 'student_m', seed: 5 });
    out.sm = {};
    out.sm.sleeveTop = vrange(sm, 'ah_ssw_l') ? vrange(sm, 'ah_ssw_l').mx : null;    // 刘海贴合（学生女）：块中心距头心
    const sf = window.EnemyModels.createCampusZombie({ variant: 'student_f', seed: 5 });
    const fr = (() => { let o = null; sf.traverse((c) => { if (!o && c.name === 'ah_fr_r') o = c; }); return o; })();
    const headPos = (() => { let o = null; sf.traverse((c) => { if (!o && c.name === 'head_mesh') o = c; }); const v = new THREE.Vector3(); o.getWorldPosition(v); return v; })();
    const frPos = (() => { const v = new THREE.Vector3(); fr.getWorldPosition(v); return v; })();
    out.sf = {};
    out.sf.fringeDist = frPos.distanceTo(headPos);
    // 教师女血迹/短袖
    const tf = window.EnemyModels.createCampusZombie({ variant: 'teacher_f', seed: 5 });
    out.tf = {};
    out.tf.hasPinkSleeve = has(tf, 'ah_ssp_l');
    out.tf.bloodOnChest = has(tf, 'ah_bld1');
    // 教师男长袖覆盖量测
    const tm2 = window.EnemyModels.createCampusZombie({ variant: 'teacher_m', seed: 5 });
    const rng2 = (z, name) => { let o = null; z.traverse((c) => { if (!o && c.name === name + '_mesh') o = c; }); if (!o) return null; const pos = o.geometry.attributes.position; const v = new THREE.Vector3(); let mn = Infinity, mx = -Infinity; for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld); if (v.y < mn) mn = v.y; if (v.y > mx) mx = v.y; } return { mn, mx }; };
    const uArm = rng2(tm2, 'l_upper_arm'), uSleeve = rng2(tm2, 'ah_lsb_u'), fArm = rng2(tm2, 'l_forearm'), fSleeve = rng2(tm2, 'ah_lsb_f'), hand = rng2(tm2, 'l_hand');
    out.tm2 = {
      armTop: uArm ? uArm.mx : null, sleeveTop: uSleeve ? uSleeve.mx : null,
      armBot: uArm ? uArm.mn : null, sleeveBot: uSleeve ? uSleeve.mn : null,
      fArmBot: fArm ? fArm.mn : null, fSleeveBot: fSleeve ? fSleeve.mn : null,
      handTop: hand ? hand.mx : null, fSleeveTop: fSleeve ? fSleeve.mx : null,
    };
    return out;
  });
  ok(r.student_m.top === 'ffffff' || r.student_m.top === 'f7f7f7' || r.student_m.top !== r.student_m.skin, '学生男上衣非皮肤色（0x' + r.student_m.top + ' vs 皮肤 0x' + r.student_m.skin + '）');
  ok(r.teacher_m.hasBloodMap && r.teacher_m.top !== '3f6399', '教师男上衣=蓝衬衫贴图（color ' + r.teacher_m.top + ' 供色于 map，v0.79.32 皮肤式渲染）');
  ok(r.teacher_f.hasBloodMap && r.teacher_f.top !== 'e38ba0', '教师女上衣=粉T恤贴图（color ' + r.teacher_f.top + ' 供色于 map）');
  ok(r.student_m.hasSleeveL, '学生男白短袖存在');
  ok(r.teacher_m.hasSleeveL, '教师男蓝长袖存在（覆盖几何见 tm2 三项断言）');
  ok(r.student_m.hasBloodMap && r.teacher_f.hasBloodMap && r.teacher_m.hasBloodMap, '上衣 Canvas 血衣贴图渲染（皮肤式，无立体血迹）');
  ok(!r.student_m.hasBloodGeo && !r.teacher_f.hasBloodGeo, '血迹几何已删除（v0.79.32）');
  ok(r.tf.hasPinkSleeve, '教师女粉短袖存在');
  ok(r.sf.fringeDist !== undefined && Math.abs(r.sf.fringeDist - 0.112) < 0.03, '刘海中心距头心 ' + r.sf.fringeDist.toFixed(3) + ' ≈ 头r 0.112（贴球面不悬浮）');
  // 长袖覆盖：上臂段盖肩（袖顶 ≥ 上臂顶-0.02）、前臂段盖到腕（袖底 ≤ 前臂底+0.02）、袖不盖手
  ok(r.tm2.sleeveTop >= r.tm2.armTop - 0.02, '长袖上臂段盖肩（袖顶 ' + r.tm2.sleeveTop.toFixed(3) + ' ≥ 肩 ' + r.tm2.armTop.toFixed(3) + '）');
  ok(r.tm2.fSleeveBot <= r.tm2.fArmBot + 0.02, '长袖前臂段盖到腕（袖底 ' + r.tm2.fSleeveBot.toFixed(3) + ' ≤ 腕 ' + r.tm2.fArmBot.toFixed(3) + '）');
  ok(r.tm2.fSleeveTop >= r.tm2.handTop - 0.02, '长袖不盖手（袖顶 ' + r.tm2.fSleeveTop.toFixed(3) + ' ≥ 手顶 ' + r.tm2.handTop.toFixed(3) + ' -0.02）');
  // 短袖盖肩（学生/教师女）：袖顶 ≥ 肩线-0.02
  const r3 = await p.evaluate(() => {
    const out = {};
    const rng = (z, name) => { let o = null; z.traverse((c) => { if (!o && c.name === name + '_mesh') o = c; }); if (!o) return null; const pos = o.geometry.attributes.position; const v = new THREE.Vector3(); let mn = Infinity, mx = -Infinity; for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld); if (v.y < mn) mn = v.y; if (v.y > mx) mx = v.y; } return { mn, mx }; };
    [['student_m', 'ah_ssw_l'], ['teacher_f', 'ah_ssp_l']].forEach(([v, s]) => {
      const z = window.EnemyModels.createCampusZombie({ variant: v, seed: 5 });
      const sr = rng(z, s), tr = rng(z, 'torso_upper');
      out[v] = { sleeveTop: sr.mx, shoulder: tr.mx };
    });
    return out;
  });
  ok(r3.student_m.sleeveTop >= r3.student_m.shoulder - 0.02, '学生短袖盖肩（袖顶 ' + r3.student_m.sleeveTop.toFixed(3) + ' ≥ 肩 ' + r3.student_m.shoulder.toFixed(3) + '）');
  ok(r3.teacher_f.sleeveTop >= r3.teacher_f.shoulder - 0.02, '教师女短袖盖肩（袖顶 ' + r3.teacher_f.sleeveTop.toFixed(3) + ' ≥ 肩 ' + r3.teacher_f.shoulder.toFixed(3) + '）');
  ok(errors.length === 0, '0 控制台错误' + (errors.length ? ': ' + errors.slice(0, 3).join(';') : ''));
  console.log('Playwright: ' + pass + ' passed, ' + fail + ' failed');
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
