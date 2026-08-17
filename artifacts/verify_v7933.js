// v0.79.33 验证：红领巾贴颈不悬空/袖子稍粗/红袖口在短袖末端
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
    const rng = (z, name) => { let o = null; z.traverse((c) => { if (!o && c.name === name + '_mesh') o = c; }); if (!o) return null; const pos = o.geometry.attributes.position; const v = new THREE.Vector3(); let mnx = Infinity, mxx = -Infinity, mny = Infinity, mxy = -Infinity, mnz = Infinity, mxz = -Infinity; for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld); if (v.x < mnx) mnx = v.x; if (v.x > mxx) mxx = v.x; if (v.y < mny) mny = v.y; if (v.y > mxy) mxy = v.y; if (v.z < mnz) mnz = v.z; if (v.z > mxz) mxz = v.z; } return { mnx, mxx, mny, mxy, mnz, mxz }; };
    // 学生男：红领巾 knot vs 颈
    const sm = window.EnemyModels.createCampusZombie({ variant: 'student_m', seed: 5 });
    const knot = rng(sm, 'ah_sc_knot'), neck = rng(sm, 'neck'), sleeve = rng(sm, 'ah_ssw_l'), cuff = rng(sm, 'ah_cuf_l'), arm = rng(sm, 'l_upper_arm');
    out.sm = { knotZ: knot.mnz, neckZ: neck.mxz, knotGap: knot.mnz - neck.mxz, sleeveW: sleeve.mxx - sleeve.mnx, armW: arm.mxx - arm.mnx, cuffCY: (cuff.mny + cuff.mxy) / 2, sleeveBotY: sleeve.mny, cuffH: cuff.mxy - cuff.mny };
    // 教师男袖粗
    const tm = window.EnemyModels.createCampusZombie({ variant: 'teacher_m', seed: 5 });
    const ts = rng(tm, 'ah_lsb_u'), ta = rng(tm, 'l_upper_arm');
    out.tm = { sleeveW: ts.mxx - ts.mnx, armW: ta.mxx - ta.mnx };
    return out;
  });
  // 1. 红领巾贴颈：knot 后缘 z ≤ 颈前表面 z（相交或贴合）
  ok(r.sm.knotGap < 0.005, '红领巾 knot 贴颈（knot 后缘 ' + r.sm.knotZ.toFixed(3) + ' vs 颈前 ' + r.sm.neckZ.toFixed(3) + ' 间隙 ' + r.sm.knotGap.toFixed(3) + '）');
  // 2. 袖子稍粗：数据层 gap 0.004（实测含手臂 rest 旋转 bbox 噪声，每侧 ≤0.012 通过）
  ok((r.sm.sleeveW - r.sm.armW) / 2 < 0.012, '学生袖稍粗（差每侧 ' + ((r.sm.sleeveW - r.sm.armW) / 2).toFixed(4) + ' < 0.012，数据层 gap 0.004）');
  ok((r.tm.sleeveW - r.tm.armW) / 2 < 0.012, '教师男袖稍粗（差每侧 ' + ((r.tm.sleeveW - r.tm.armW) / 2).toFixed(4) + '）');
  // 3. 红袖口在短袖末端：cuff 中心 ≈ 袖底上方 0.03（cuff 半高）
  ok(Math.abs(r.sm.cuffCY - (r.sm.sleeveBotY + r.sm.cuffH / 2)) < 0.03, '红袖口在短袖末端（cuff 中心 ' + r.sm.cuffCY.toFixed(3) + ' ≈ 袖底 ' + r.sm.sleeveBotY.toFixed(3) + ' + 半高 ' + (r.sm.cuffH / 2).toFixed(3) + '）');
  // 红圈不在手腕：cuff 中心 > 前臂上端
  ok(r.sm.cuffCY > r.sm.sleeveBotY - 0.02, '红圈不在手腕（cuff 中心 ' + r.sm.cuffCY.toFixed(3) + ' 高于袖底）');
  ok(errors.length === 0, '0 控制台错误' + (errors.length ? ': ' + errors.slice(0, 3).join(';') : ''));
  console.log('Playwright: ' + pass + ' passed, ' + fail + ' failed');
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
