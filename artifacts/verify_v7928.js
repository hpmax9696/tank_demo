// v0.79.28 验证：饰物位置在胸口(低于肩)/尺寸/教师下躯干裤裙色/刘海缺口露眼
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
    const boxY = (z, name) => {
      let o = null; z.traverse((c) => { if (!o && c.name === name + '_mesh') o = c; });
      if (!o) return null;
      const pos = o.geometry.attributes.position;
      const v = new THREE.Vector3();
      let minY = Infinity, maxY = -Infinity, minZ = Infinity;
      for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld); if (v.y < minY) minY = v.y; if (v.y > maxY) maxY = v.y; if (v.z < minZ) minZ = v.z; }
      return { minY, maxY, minZ, centerY: (minY + maxY) / 2 };
    };
    // 学生男：badge/stripes 低于肩（torso_upper 顶）
    const sm = window.EnemyModels.createCampusZombie({ variant: 'student_m', seed: 5 });
    const tu = boxY(sm, 'torso_upper');
    const badge = boxY(sm, 'ah_badge');
    const stripes = boxY(sm, 'ah_str');
    out.sm = { shoulderY: tu.maxY, badgeCenter: badge.centerY, stripesCenter: stripes.centerY, badgeH: badge.maxY - badge.minY, stripesH: stripes.maxY - stripes.minY };
    // 教师男：tie 位置 + torso_lower 颜色
    const tm = window.EnemyModels.createCampusZombie({ variant: 'teacher_m', seed: 5 });
    const tu2 = boxY(tm, 'torso_upper');
    const tie = boxY(tm, 'ah_tie');
    let tLowerColor = null;
    tm.traverse((c) => { if (!tLowerColor && c.isMesh && c.name === 'torso_lower_mesh' && c.material && c.material.color) tLowerColor = c.material.color.getHexString(); });
    let pelvisColor = null;
    tm.traverse((c) => { if (!pelvisColor && c.isMesh && c.name === 'pelvis_mesh' && c.material && c.material.color) pelvisColor = c.material.color.getHexString(); });
    out.tm = { shoulderY: tu2.maxY, tieCenter: tie.centerY, tieH: tie.maxY - tie.minY, tLowerColor, pelvisColor };
    // 学生女：刘海缺口（眼正前方 z 方向无遮挡）
    const sf = window.EnemyModels.createCampusZombie({ variant: 'student_f', seed: 5 });
    const eye = (() => { let o = null; sf.traverse((c) => { if (!o && c.name === 'l_eye_glow_mesh') o = c; }); if (!o) return null; const v = new THREE.Vector3(); o.getWorldPosition(v); return [v.x, v.y, v.z]; })();
    const fringeL = boxY(sf, 'ah_fr_l'), fringeR = boxY(sf, 'ah_fr_r');
    out.sf = { eye, fringeLX: fringeL.minZ, fringeRX: fringeR.minZ, fringeLGap: fringeL.maxY, eyeY: eye ? eye[1] : null, fringeBottomY: Math.max(fringeL.minY, fringeR.minY) };
    // 眼正前方（同 y 同 z>眼z）是否有刘海覆盖：两刘海块 x 范围
    const fl = (() => { let o = null; sf.traverse((c) => { if (!o && c.name === 'ah_fr_l_mesh') o = c; }); if (!o) return null; const b = new THREE.Box3().setFromObject(o); return [b.min.x, b.max.x]; })();
    const fr2 = (() => { let o = null; sf.traverse((c) => { if (!o && c.name === 'ah_fr_r_mesh') o = c; }); if (!o) return null; const b = new THREE.Box3().setFromObject(o); return [b.min.x, b.max.x]; })();
    out.sf.fringeLXRange = fl; out.sf.fringeRXRange = fr2;
    return out;
  });
  // 1. 饰物低于肩
  ok(r.sm.badgeCenter < r.sm.shoulderY - 0.02, '学生男校徽在胸口（centerY=' + r.sm.badgeCenter.toFixed(3) + ' < 肩 ' + r.sm.shoulderY.toFixed(3) + '）');
  ok(r.sm.stripesCenter < r.sm.shoulderY - 0.02, '学生男肩章在胸口（centerY=' + r.sm.stripesCenter.toFixed(3) + ' < 肩）');
  ok(r.sm.badgeH < 0.06 && r.sm.stripesH < 0.11, '饰物缩小（badge 高 ' + r.sm.badgeH.toFixed(3) + ' / 肩章高 ' + r.sm.stripesH.toFixed(3) + '）');
  ok(r.tm.tieCenter < r.tm.shoulderY - 0.02, '教师男领带在胸口（centerY=' + r.tm.tieCenter.toFixed(3) + ' < 肩 ' + r.tm.shoulderY.toFixed(3) + '）');
  ok(r.tm.tieH < 0.18, '领带缩小（高 ' + r.tm.tieH.toFixed(3) + '）');
  // 2. 教师下躯干裤裙色
  ok(r.tm.tLowerColor === '3a3a42', '教师男 torso_lower 裤色 0x' + r.tm.tLowerColor);
  ok(r.tm.pelvisColor === '3a3a42', '教师男 pelvis 裤色 0x' + r.tm.pelvisColor);
  // 3. 刘海缺口：眼 x=0 附近两刘海块间有缺口（眼 x 落在缺口内）
  const eyeX = r.sf.eye[0];
  const gapOk = r.sf.fringeLXRange[1] < eyeX - 0.005 && r.sf.fringeRXRange[0] > eyeX + 0.005;
  ok(gapOk, '刘海分两块中间缺口露眼（眼 x=' + eyeX.toFixed(3) + ' 左块到 ' + r.sf.fringeLXRange[1].toFixed(3) + ' 右块从 ' + r.sf.fringeRXRange[0].toFixed(3) + '）');
  ok(errors.length === 0, '0 控制台错误' + (errors.length ? ': ' + errors.slice(0, 3).join(';') : ''));
  console.log('Playwright: ' + pass + ' passed, ' + fail + ' failed');
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
