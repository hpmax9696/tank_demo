// v0.79.25 验证：鞋贴脚/发型贴头且双面/配饰贴胸(数据层 snap 复算) + 渲染回归
// Node 段：贴胸 z 间隙权威验证（与 bakeModel snap 公式同源复算）
const fs = require('fs');
{
  global.window = {};
  eval(fs.readFileSync('models/humanoid_config.js', 'utf8'));
  const HC = global.window.HumanoidConfig;
  const findN = (n, name) => { if (!n) return null; if (n.name === name) return n; if (n.children) for (const c of n.children) { const r = findN(c, name); if (r) return r; } return null; };
  [['student_m', 'school_badge'], ['student_m', 'shoulder_stripes'], ['teacher_m', 'tie_opt'], ['student_m', 'polo_placket'], ['student_m', 'polo_collar']].forEach(([v, key]) => {
    const def = HC.ADDON_LIBRARY[key];
    const m = HC.MODELS[v];
    const tu = findN(m.tree, 'torso_upper');
    const sh = tu.size[1], sbd = tu.size[2], std = tu.size[4], soz = tu.size[6] || 0;
    const sRidgeY = tu.size[7] != null ? Math.min(Math.max(tu.size[7], 0), sh) : sh * 0.5;
    const sRidgeZ = tu.size[8] || 0;
    const yy = def.snap.y * sh;
    const zBot = sbd / 2, zTop = std / 2 + soz;
    const zRidgeBase = zBot + (sRidgeY / sh) * (zTop - zBot);
    const zRidge = zRidgeBase + sRidgeZ;
    const zF = yy < sRidgeY ? zBot + (yy / Math.max(0.01, sRidgeY)) * (zRidgeBase - zBot) : zRidge + ((yy - sRidgeY) / Math.max(0.01, sh - sRidgeY)) * (zTop - zRidge);
    // snap 节点：按 _addonKey 找（Group 无 name，如 polo_placket/polo_collar）
    let node = null;
    (function walk(n) { if (n._addonKey === key) { node = n; return; } (n.children || []).forEach(walk); })(m.tree);
    if (!node) { console.log('FAIL: ' + v + ' ' + key + ' 未找到 snap 节点'); process.exit(1); }
    const gap = node.position[2] - zF;
    const out = def.snap.out != null ? def.snap.out : 0.006;
    if (gap < out - 0.03 || gap > out + 0.03) { console.log('FAIL: ' + v + ' ' + key + ' 贴胸间隙 ' + gap.toFixed(4) + '（期望 ~' + out + '）'); process.exit(1); }
    console.log('  ✓ ' + v + ' ' + key + ' 贴胸间隙 ' + gap.toFixed(4) + '（期望 ~' + out + '）');
  });
}
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

  // 工厂变体（世界坐标几何贴合）
  const p = await browser.newPage(); collect(p);
  await p.goto('http://127.0.0.1:8080/model_factory.html');
  await p.evaluate(() => localStorage.setItem('tank_model_factory_save', JSON.stringify({ modelType: 'humanoid' })));
  await p.reload(); await p.waitForTimeout(2500);
  const r = await p.evaluate(() => {
    const HA = window.HumanoidAnims;
    HA.collectRefs();
    modelRoot.updateMatrixWorld(true);
    const box = (name) => {
      let o = null;
      modelRoot.traverse((c) => { if (!o && c.name === name + '_mesh') o = c; });
      if (!o) return null;
      o.updateWorldMatrix(true, false);
      const b = new THREE.Box3().setFromObject(o);
      return { minx: b.min.x, miny: b.min.y, minz: b.min.z, maxx: b.max.x, maxy: b.max.y, maxz: b.max.z, obj: o };
    };
    const foot = box('l_foot'), shoe = box('ah_sh_l');
    const head = box('head'), hair = box('ah_m');
    const tu = box('torso_upper'), badge = box('ah_badge');
    return {
      shoeOverX: shoe && foot ? shoe.maxx - shoe.minx - (foot.maxx - foot.minx) : null,
      shoeOverZ: shoe && foot ? shoe.maxz - shoe.minz - (foot.maxz - foot.minz) : null,
      shoeUnder: shoe && foot ? foot.miny - shoe.miny : null,
      hairOverHead: hair && head ? hair.maxy - head.maxy : null,
      hairR: hair ? hair.maxx - hair.minx : null,
      headR: head ? head.maxx - head.minx : null,
      hairSide: hair ? hair.obj.material.side : null,
      badgeFrontZ: badge ? badge.minz : null,
      badgeY: badge ? badge.miny : null,
      badgeExists: !!badge,
      tuExists: !!tu,
      badgeFrontZ: badge ? badge.minz : null,
      badgeY: badge ? badge.miny : null,
      badgeExists: !!badge,
      tuExists: !!tu,
    };
  });
  ok(r.shoeOverX !== null && r.shoeOverX > 0 && r.shoeOverX < 0.012, '鞋比脚宽一丝 Δx=' + r.shoeOverX);
  ok(r.shoeOverZ !== null && r.shoeOverZ > 0 && r.shoeOverZ < 0.012, '鞋比脚长一丝 Δz=' + r.shoeOverZ);
  ok(r.shoeUnder !== null && r.shoeUnder > -0.002 && r.shoeUnder < 0.012, '鞋底贴合脚底 Δy=' + r.shoeUnder);
  ok(r.hairOverHead !== null && r.hairOverHead > 0 && r.hairOverHead < 0.03, '发型罩头顶略高出 Δ=' + r.hairOverHead);
  ok(r.hairR !== null && r.hairR < r.headR * 1.3 && r.hairR > r.headR, '发型直径贴近头径 hair=' + r.hairR + ' head=' + r.headR);
  ok(r.hairSide === 2, '发型材质 DoubleSide (side=' + r.hairSide + ')');
  ok(r.badgeExists && r.badgeFrontZ > 0, '校徽存在且在前侧（z=' + r.badgeFrontZ + '；贴胸间隙见 Node 段复算）');
  await p.close();

  // 游戏侧：teacher_m 领带存在 / teacher_f 无胸臀 / 渲染回归
  // ⚠️ 贴胸 z 间隙的权威验证在 Node 段（bakeModel snap 公式复算）；浏览器段只验存在性与位置（v7928 已验胸口 y）
  const p2 = await browser.newPage(); collect(p2);
  await p2.goto('http://127.0.0.1:8080/index.html'); await p2.waitForTimeout(3000);
  const r2 = await p2.evaluate(() => {
    const out = {};
    const box = (root, name) => { let o = null; root.traverse((c) => { if (c.name === name + '_mesh') o = c; }); if (!o) return null; root.updateMatrixWorld(true); const b = new THREE.Box3().setFromObject(o); return { minz: b.min.z, maxz: b.max.z, obj: o }; };
    // teacher_m tie 存在性
    const zm = window.EnemyModels.createCampusZombie({ variant: 'teacher_m', seed: 3 });
    const tie = box(zm, 'ah_tie'), tum = box(zm, 'torso_upper');
    out.tieExists = !!tie; out.tuExists = !!tum;
    if (tie) out.tieMinZ = tie.minz;
    // teacher_f 无胸臀
    const zf = window.EnemyModels.createCampusZombie({ variant: 'teacher_f', seed: 3 });
    let hasBust = false, hasHips = false;
    zf.traverse((c) => { if (c.name === 'ah_bust_l' || c.name === 'ah_bust_l_mesh') hasBust = true; if (c.name === 'ah_hips' || c.name === 'ah_hips_mesh') hasHips = true; });
    out.noBust = !hasBust; out.noHips = !hasHips;
    // 鞋渲染
    const zs = window.EnemyModels.createCampusZombie({ variant: 'student_m', seed: 3 });
    const foot = box(zs, 'l_foot'), shoe = box(zs, 'ah_sh_l');
    out.shoeFootDX = shoe ? (shoe.maxz - shoe.minz) / (foot.maxz - foot.minz) : null;
    // 发型双面
    let hairSide = null;
    zs.traverse((c) => { if (c.isMesh && c.name === 'ah_m_mesh' && c.material) hairSide = c.material.side; });
    out.hairSide = hairSide;
    return out;
  });
  ok(r2.tieExists && r2.tuExists, '教师男领带存在（贴胸间隙见 Node 段复算）');
  ok(r2.noBust && r2.noHips, '教师女无楔形胸/臀');
  ok(r2.shoeFootDX && r2.shoeFootDX < 1.15, '游戏鞋长/脚长=' + r2.shoeFootDX + '（<1.15 贴合）');
  ok(r2.hairSide === 2, '游戏发型 DoubleSide');

  ok(errors.length === 0, '0 控制台错误' + (errors.length ? ': ' + errors.slice(0, 3).join(';') : ''));
  console.log('Playwright: ' + pass + ' passed, ' + fail + ' failed');
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
