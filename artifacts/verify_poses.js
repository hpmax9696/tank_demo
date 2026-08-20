// 姿势正确性数值验证（v0.79.37c）：世界朝向/双手贴枪/背负不穿身
const { chromium } = require('playwright');
const URL = process.env.FACTORY_URL || 'http://127.0.0.1:8080/model_factory.html';
let pass = 0, fail = 0;
const check = (n, ok, d) => { console.log((ok ? 'PASS' : 'FAIL') + ' | ' + n + (d ? ' | ' + d : '')); ok ? pass++ : fail++; };

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.setItem('tank_model_factory_save', JSON.stringify({ modelType: 'humanoid' })));
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  async function loadVariant(vk) {
    await page.evaluate((k) => {
      window._humanoidEdit.variant = k;
      window._humanoidEdit.params.height = window.HumanoidConfig.HUMANOID_VARIANTS[k].bodyRange.height[0];
      window._applyHumanoidEdit();
    }, vk);
    await page.waitForTimeout(600);
    await page.evaluate(() => {
      const btn = document.getElementById('toggle-anim');
      if (btn.classList.contains('active')) btn.click();
    });
    await page.waitForTimeout(200);
    await page.click('#toggle-anim');
    await page.waitForTimeout(700);
  }
  async function jumpAnim(label) {
    await page.evaluate((lb) => {
      var hit = Array.from(document.querySelectorAll('#anim-list .anim-item')).find((it) => it.textContent.includes(lb));
      if (hit) hit.click();
    }, label);
    await page.waitForTimeout(150);
  }
  // 采样：节点世界位置 + 线段两点（轴向）
  const probe = (names) => page.evaluate((ns) => {
    const root = window.modelRoot;
    root.updateMatrixWorld(true);
    const out = {};
    ns.forEach((spec) => {
      const [name, p1, p2] = spec;
      const o = root.getObjectByName(name);
      if (!o) { out[name] = null; return; }
      const wp = new THREE.Vector3();
      o.getWorldPosition(wp);
      out[name] = { x: +wp.x.toFixed(3), y: +wp.y.toFixed(3), z: +wp.z.toFixed(3) };
      if (p1 && p2) {
        const a = o.localToWorld(new THREE.Vector3(...p1));
        const b = o.localToWorld(new THREE.Vector3(...p2));
        const d = new THREE.Vector3().subVectors(b, a).normalize();
        out[name + '_dir'] = { x: +d.x.toFixed(3), y: +d.y.toFixed(3), z: +d.z.toFixed(3) };
        out[name + '_a'] = { x: +a.x.toFixed(3), y: +a.y.toFixed(3), z: +a.z.toFixed(3) };
        out[name + '_b'] = { x: +b.x.toFixed(3), y: +b.y.toFixed(3), z: +b.z.toFixed(3) };
      }
    });
    return out;
  }, names);

  // ══ 枪兵 Idle：low ready——枪口朝前下 + 左手贴枪 ══
  await loadVariant('rifleman');
  await jumpAnim('待机');
  await page.waitForTimeout(350);
  let s = await probe([
    ['ah_wp_rifle', [0, 0, -0.25], [0, 0, 0.42]], // 枪管方向（局部 Z=枪轴向两点）
    ['l_hand'],
    ['r_hand'],
  ]);
  const dir = s.ah_wp_rifle_dir;
  // low ready（用户方案）：枪口朝【左】前方地面（第一人称 +X=左；dir.x 应为正）+ 俯角
  const horiz = Math.atan2(dir.x, dir.z);
  check('rifle-idle-muzzle-down-forward', dir.z > 0.6 && dir.y < -0.25 && horiz > 0.15 && horiz < 0.85, 'dir=' + JSON.stringify(dir) + ' horiz=' + horiz.toFixed(2));
  // 左手到枪身护木后段（托枪位 z=0.12）距离——前臂长度物理极限 ~0.2（手 Box 前缘+护木半宽接触）
  const hguard = await page.evaluate(() => {
    const root = window.modelRoot;
    root.updateWorldMatrix(true, true);
    const w = root.getObjectByName('ah_wp_rifle');
    return w.localToWorld(new THREE.Vector3(0, -0.002, 0.12));
  });
  const distL = Math.hypot(s.l_hand.x - hguard.x, s.l_hand.y - hguard.y, s.l_hand.z - hguard.z);
  check('rifle-idle-left-hand-on-gun', distL < 0.24, 'dist=' + distL.toFixed(3) + ' hand=' + JSON.stringify(s.l_hand) + ' hguard=' + hguard.x.toFixed(2) + ',' + hguard.y.toFixed(2) + ',' + hguard.z.toFixed(2));
  const distR = Math.hypot(s.r_hand.x - hguard.x, s.r_hand.y - hguard.y, s.r_hand.z - hguard.z);
  check('rifle-idle-right-hand-near', distR < 0.35, 'dist=' + distR.toFixed(3));

  // ══ 枪兵 Swing 据枪：枪口水平正前 + 双手贴枪 ══
  await jumpAnim('挥击');
  await page.waitForTimeout(400); // t≈0.33 据枪段
  s = await probe([['ah_wp_rifle', [0, 0, -0.25], [0, 0, 0.42]], ['l_hand'], ['r_hand']]);
  const aimDir = s.ah_wp_rifle_dir;
  check('rifle-aim-muzzle-level-forward', aimDir && aimDir.z > 0.85 && Math.abs(aimDir.y) < 0.25, 'dir=' + JSON.stringify(aimDir));
  // 贴腮据枪（用户方案）：枪口抬到腮高（muzzleY ≈ head 下方 0.04 内）——非腰射
  const muzzleAimY = await page.evaluate(() => {
    const root = window.modelRoot;
    root.updateWorldMatrix(true, true);
    return root.getObjectByName('ah_wp_rifle').localToWorld(new THREE.Vector3(0, 0.008, 0.45)).y;
  });
  const headY = await page.evaluate(() => {
    const root = window.modelRoot;
    root.updateWorldMatrix(true, true);
    return root.getObjectByName('head').getWorldPosition(new THREE.Vector3()).y;
  });
  check('rifle-aim-cheek-height', muzzleAimY > headY - 0.12, 'muzzleY=' + muzzleAimY.toFixed(3) + ' headY=' + headY.toFixed(3) + '（差<' + (headY - muzzleAimY).toFixed(3) + '）');
  const hguardAim = await page.evaluate(() => {
    const root = window.modelRoot;
    root.updateWorldMatrix(true, true);
    return root.getObjectByName('ah_wp_rifle').localToWorld(new THREE.Vector3(0, -0.002, 0.12));
  });
  const distLA = Math.hypot(s.l_hand.x - hguardAim.x, s.l_hand.y - hguardAim.y, s.l_hand.z - hguardAim.z);
  check('rifle-aim-left-hand-on-gun', distLA < 0.24, 'dist=' + distLA.toFixed(3));
  await page.screenshot({ path: 'artifacts/shots_soldiers/rifleman_aim.png' });

  // ══ 火箭筒兵 Idle：横背不穿身 ══
  await loadVariant('rocketeer');
  await jumpAnim('待机');
  await page.waitForTimeout(350);
  s = await probe([['ah_wp_rpg', [0, 0, -0.26], [0, 0, 0.36]], ['pelvis']]);
  const rpgDir = s.ah_wp_rpg_dir;
  // 斜背（用户方案·镜像修正）：管轴左下→右上（x 负=第一人称右侧），战斗部端指向右肩上方
  check('rpg-idle-tube-slant-back', rpgDir.x < -0.7 && rpgDir.y > 0.4, 'dir=' + JSON.stringify(rpgDir));
  // 战斗部尖应在右肩上方（x<0 第一人称右）且过肩高
  const whTip = await page.evaluate(() => {
    const root = window.modelRoot;
    root.updateWorldMatrix(true, true);
    return root.getObjectByName('ah_wp_rpg').localToWorld(new THREE.Vector3(0, 0, 0.66));
  });
  check('rpg-idle-warhead-over-shoulder', whTip.y > 0.9 && whTip.x < 0 && whTip.x > -0.6, 'tip=' + whTip.x.toFixed(2) + ',' + whTip.y.toFixed(2) + ',' + whTip.z.toFixed(2));
  await page.screenshot({ path: 'artifacts/shots_soldiers/rocketeer_idle.png' });

  // ══ 火箭筒兵 Swing：右肩扛管口朝前 + 双手握把 ══
  await jumpAnim('挥击');
  await page.waitForTimeout(450); // t≈0.28 肩扛段
  s = await probe([['ah_wp_rpg', [0, 0, -0.31], [0, 0, 0.31]], ['l_hand'], ['r_hand']]);
  const shDir = s.ah_wp_rpg_dir;
  check('rpg-aim-tube-forward', shDir && shDir.z > 0.9 && Math.abs(shDir.y) < 0.2, 'dir=' + JSON.stringify(shDir));
  // 双手到两握把距离（右=后握把 / 左=前握把，网格搜索基准 dR≈0.14 dL≈0.01）
  const grips = await page.evaluate(() => {
    const root = window.modelRoot;
    root.updateWorldMatrix(true, true);
    const w = root.getObjectByName('ah_wp_rpg');
    const gR = w.localToWorld(new THREE.Vector3(0, -0.075, -0.1));
    const gF = w.localToWorld(new THREE.Vector3(0, -0.075, 0.1));
    const lh = root.getObjectByName('l_hand').getWorldPosition(new THREE.Vector3());
    const rh = root.getObjectByName('r_hand').getWorldPosition(new THREE.Vector3());
    return {
      dR: +Math.hypot(rh.x - gR.x, rh.y - gR.y, rh.z - gR.z).toFixed(3),
      dL: +Math.hypot(lh.x - gF.x, lh.y - gF.y, lh.z - gF.z).toFixed(3),
    };
  });
  check('rpg-aim-hands-on-grips', grips.dR < 0.25 && grips.dL < 0.15, '右手→后把=' + grips.dR + ' 左手→前把=' + grips.dL);
  // 管在右肩（管心 x<0 第一人称右）
  const tubeC = await page.evaluate(() => {
    const root = window.modelRoot;
    root.updateWorldMatrix(true, true);
    const w = root.getObjectByName('ah_wp_rpg');
    return w.localToWorld(new THREE.Vector3(0, 0, 0));
  });
  check('rpg-aim-tube-right-shoulder', tubeC.x < 0, 'tubeC.x=' + tubeC.x.toFixed(3));
  check('rpg-aim-tube-shoulder-height', tubeC.y > 0.65 && tubeC.y < 1.0, 'y=' + tubeC.y.toFixed(3));
  await page.screenshot({ path: 'artifacts/shots_soldiers/rocketeer_aim.png' });

  // ══ 保安 Swing：棍顺臂（近水平横扫，非横握）══
  await loadVariant('guard');
  await jumpAnim('待机');
  await page.waitForTimeout(300);
  await jumpAnim('挥击');
  await page.waitForTimeout(130); // t=0.28 蓄力峰值（曲臂屈肘）
  s = await probe([['ah_wp_baton', [0, -0.485, 0], [0, 0.004, 0]]]);
  let windupDir = s.ah_wp_baton_dir;
  let windupSpanY = Math.abs(s.ah_wp_baton_a.y - s.ah_wp_baton_b.y);
  // 曲臂蓄力（用户方案）：前臂屈肘 -1.2 → 手肘弯拢（肘尖到肩距缩短可代验证；此处验证爆发段伸直）
  await page.waitForTimeout(220); // t=0.5 爆发横扫（前臂已伸直 -0.1）
  s = await probe([['ah_wp_baton', [0, -0.485, 0], [0, 0.004, 0]]]);
  let strikeDir = s.ah_wp_baton_dir;
  let strikeSpanY = Math.abs(s.ah_wp_baton_a.y - s.ah_wp_baton_b.y);
  // 棍近水平（两端 y 差 < 0.35×棍长比例），且挥击中棍大致水平指向（|dir.y| 小）
  check('guard-swing-baton-inline-arm', windupSpanY < 0.35 && strikeSpanY < 0.35, 'windupY=' + windupSpanY.toFixed(3) + ' strikeY=' + strikeSpanY.toFixed(3));
  // 蓄力=举棍后引（自然上扬 ≤80°）；爆发=水平横扫（|y|<0.4 近水平）
  check('guard-swing-baton-sweep-horizontal', Math.abs(windupDir.y) < 0.8 && Math.abs(strikeDir.y) < 0.4, 'windup=' + JSON.stringify(windupDir) + ' strike=' + JSON.stringify(strikeDir));
  // 蓄力→爆发棍尖水平角变化大（真横扫；probe 方向=柄顶向，取反即棍尖向）
  const wind = Math.atan2(-windupDir.x, -windupDir.z);
  const strike = Math.atan2(-strikeDir.x, -strikeDir.z);
  let sweep = Math.abs(strike - wind);
  if (sweep > Math.PI) sweep = 2 * Math.PI - sweep;
  check('guard-swing-sweep-arc', sweep > 0.7, 'sweep=' + sweep.toFixed(2) + 'rad');
  await page.screenshot({ path: 'artifacts/shots_soldiers/guard_swing2.png' });

  check('console-errors', errors.length === 0, errors.slice(0, 4).join(' || '));
  await browser.close();
  console.log(fail === 0 ? 'ALL PASS (' + pass + ')' : fail + ' FAILURES');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
