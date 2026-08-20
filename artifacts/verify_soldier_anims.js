// 人类士兵动画集验证（v0.79.37b）：持枪/背负/横挥/射击特效/受击死亡武器一致
const { chromium } = require('playwright');
const URL = process.env.FACTORY_URL || 'http://127.0.0.1:8080/model_factory.html';
const SHOT_DIR = 'artifacts/shots_soldiers';
let pass = 0, fail = 0;
const check = (name, ok, detail) => { console.log((ok ? 'PASS' : 'FAIL') + ' | ' + name + (detail ? ' | ' + detail : '')); ok ? pass++ : fail++; };

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.setItem('tank_model_factory_save', JSON.stringify({ modelType: 'humanoid' })));
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  async function loadVariant(vk) {
    await page.evaluate((k) => {
      window._humanoidEdit.variant = k;
      var hv = window.HumanoidConfig.HUMANOID_VARIANTS[k];
      window._humanoidEdit.params.height = hv.bodyRange.height[0];
      window._applyHumanoidEdit();
    }, vk);
    await page.waitForTimeout(700);
    // 变体切换后重开展台：collectRefs 按新配置重建轨道表（否则沿用上一变体的 _animDefs）
    await page.evaluate(() => {
      const btn = document.getElementById('toggle-anim');
      if (btn.classList.contains('active')) btn.click();
    });
    await page.waitForTimeout(250);
    await page.click('#toggle-anim');
    await page.waitForTimeout(800);
  }
  async function jumpAnim(label) {
    await page.evaluate((lb) => {
      var items = Array.from(document.querySelectorAll('#anim-list .anim-item'));
      var hit = items.find((it) => it.textContent.includes(lb));
      if (hit) hit.click();
    }, label);
    await page.waitForTimeout(120);
  }
  const sample = (names) => page.evaluate((ns) => {
    const root = window.modelRoot;
    root.updateMatrixWorld(true);
    const out = {};
    ns.forEach((n) => {
      const o = root.getObjectByName(n);
      if (!o) { out[n] = null; return; }
      const p = new THREE.Vector3(); o.getWorldPosition(p);
      out[n] = { px: +p.x.toFixed(3), py: +p.y.toFixed(3), pz: +p.z.toFixed(3), rx: +o.rotation.x.toFixed(3), ry: +o.rotation.y.toFixed(3), rz: +o.rotation.z.toFixed(3), sx: +o.scale.x.toFixed(3), lx: +o.position.x.toFixed(3), ly: +o.position.y.toFixed(3), lz: +o.position.z.toFixed(3) };
    });
    return out;
  }, names);

  // ══ rifleman：持枪 + 射击特效 + 受击死亡一致 ══
  await loadVariant('rifleman');
  const animNames = await page.evaluate(() => window.HumanoidAnims.names.join('/'));
  check('rifleman-anims-no-punch', !animNames.includes('Punch') && animNames.includes('Swing'), animNames);

  await jumpAnim('待机');
  await page.waitForTimeout(400);
  let s = await sample(['ah_wp_rifle', 'ah_wp_rf_flash']);
  check('rifleman-idle-weapon-comp', s.ah_wp_rifle && s.ah_wp_rifle.rx > 1.8 && s.ah_wp_rifle.rx < 2.2, 'rot.x=' + (s.ah_wp_rifle ? s.ah_wp_rifle.rx : 'null') + '（low ready 补偿 2.0 → T=+0.5 前下）');
  check('rifleman-idle-flash-hidden', s.ah_wp_rf_flash && s.ah_wp_rf_flash.sx < 0.01, 'scale.x=' + (s.ah_wp_rf_flash ? s.ah_wp_rf_flash.sx : 'null'));
  const idlePos = s.ah_wp_rifle;

  await jumpAnim('挥击');
  await page.waitForTimeout(245); // t≈0.3 首发火焰窗（1.2s 周期，峰值±0.03s 插值容差）
  s = await sample(['ah_wp_rf_flash', 'ah_wp_rifle']);
  check('rifleman-fire-flash-on', s.ah_wp_rf_flash && s.ah_wp_rf_flash.sx > 0.4, 'scale.x=' + (s.ah_wp_rf_flash ? s.ah_wp_rf_flash.sx : 'null'));
  check('rifleman-aim-weapon-level', s.ah_wp_rifle && s.ah_wp_rifle.rx > 1.5 && s.ah_wp_rifle.rx < 1.8, 'rot.x=' + (s.ah_wp_rifle ? s.ah_wp_rifle.rx : 'null') + '（据枪补偿 1.65：-1.65+1.65 → T=0 水平）');
  await page.waitForTimeout(700); // 射击结束回待机窗
  s = await sample(['ah_wp_rf_flash']);
  check('rifleman-flash-off-after', s.ah_wp_rf_flash && s.ah_wp_rf_flash.sx < 0.01, 'scale.x=' + (s.ah_wp_rf_flash.sx));

  await jumpAnim('受击');
  await page.waitForTimeout(300);
  s = await sample(['ah_wp_rifle']);
  check('rifleman-stagger-weapon-consistent', s.ah_wp_rifle && Math.abs(s.ah_wp_rifle.py - idlePos.py) < 0.02 && s.ah_wp_rifle.rx > 1.8, 'rot.x=' + s.ah_wp_rifle.rx + ' pyΔ=' + Math.abs(s.ah_wp_rifle.py - idlePos.py).toFixed(3));

  await jumpAnim('死亡');
  await page.waitForTimeout(2000); // Die 播完定格
  s = await sample(['ah_wp_rifle']);
  check('rifleman-die-weapon-in-hand', s.ah_wp_rifle && s.ah_wp_rifle.rx > 1.8 && s.ah_wp_rifle.py < idlePos.py, 'rot.x=' + s.ah_wp_rifle.rx + ' py=' + s.ah_wp_rifle.py + ' (倒地 py 应低于站立 ' + idlePos.py + ')');
  await page.screenshot({ path: SHOT_DIR + '/rifleman_fire.png' });

  // ══ shotgunner 同枪兵管线（抽检火焰+待机补偿）══
  await loadVariant('shotgunner');
  await page.waitForTimeout(400);
  await jumpAnim('待机'); await page.waitForTimeout(300);
  s = await sample(['ah_wp_shotgun', 'ah_wp_sg_flash']);
  check('shotgun-idle-carry', s.ah_wp_shotgun && s.ah_wp_shotgun.rx > 1.8 && s.ah_wp_sg_flash.sx < 0.01, 'rx=' + s.ah_wp_shotgun.rx);
  await jumpAnim('挥击');
  // 连发火焰为窄脉冲（0.02s 升 0.06s 降），单帧采样易落插值沿——滚动采样取峰值
  let sgFlashMax = 0;
  for (let i = 0; i < 14; i++) {
    await page.waitForTimeout(30);
    const f = await sample(['ah_wp_sg_flash']);
    if (f.ah_wp_sg_flash) sgFlashMax = Math.max(sgFlashMax, f.ah_wp_sg_flash.sx);
  }
  check('shotgun-fire-flash', sgFlashMax > 1.0, 'peak scale.x=' + sgFlashMax);

  // ══ rocketeer：背负 + 肩扛发射 + 战斗部射出 + 死亡一致 ══
  await loadVariant('rocketeer');
  await page.waitForTimeout(400);
  await jumpAnim('待机'); await page.waitForTimeout(300);
  s = await sample(['ah_wp_rpg', 'ah_wp_rpg_flash_f']);
  check('rocket-idle-on-back', s.ah_wp_rpg && Math.abs(s.ah_wp_rpg.ry + 0.95) < 0.15 && s.ah_wp_rpg.pz < -0.05, 'rot.y=' + s.ah_wp_rpg.ry + ' worldZ=' + s.ah_wp_rpg.pz + '（斜背 rx-1.5/ry-0.95 战斗部露右肩）');
  check('rocket-idle-flash-hidden', s.ah_wp_rpg_flash_f && s.ah_wp_rpg_flash_f.sx < 0.01, '');
  const rpgIdle = s.ah_wp_rpg;

  await jumpAnim('挥击');
  await page.waitForTimeout(400); // t≈0.25-0.5 进入肩扛段
  s = await sample(['ah_wp_rpg', 'ah_wp_rpg_flash_f']);
  check('rocket-aim-shoulder', s.ah_wp_rpg && s.ah_wp_rpg.ry < 0.5 && s.ah_wp_rpg.pz > 0, 'rot.y=' + s.ah_wp_rpg.ry + ' worldZ=' + s.ah_wp_rpg.pz);
  // 双向火焰滚动采样取峰（0.45 发射脉冲窄）
  let rFlashF = 0, rFlashB = 0;
  for (let i = 0; i < 14; i++) {
    await page.waitForTimeout(30);
    const f = await sample(['ah_wp_rpg_flash_f', 'ah_wp_rpg_flash_b']);
    if (f.ah_wp_rpg_flash_f) rFlashF = Math.max(rFlashF, f.ah_wp_rpg_flash_f.sx);
    if (f.ah_wp_rpg_flash_b) rFlashB = Math.max(rFlashB, f.ah_wp_rpg_flash_b.sx);
  }
  check('rocket-fire-dual-flash', rFlashF > 0.9 && rFlashB > 0.8, 'front peak=' + rFlashF + ' back peak=' + rFlashB);
  await page.waitForTimeout(300); // 战斗部飞行中
  s = await sample(['ah_wp_rpg_warhead']);
  check('rocket-warhead-launched', s.ah_wp_rpg_warhead && s.ah_wp_rpg_warhead.lz > 2, 'local z=' + s.ah_wp_rpg_warhead.lz);
  await page.screenshot({ path: SHOT_DIR + '/rocketeer_fire.png' });

  await jumpAnim('受击'); await page.waitForTimeout(300);
  s = await sample(['ah_wp_rpg']);
  check('rocket-stagger-weapon-back', s.ah_wp_rpg && Math.abs(s.ah_wp_rpg.py - rpgIdle.py) < 0.02 && Math.abs(s.ah_wp_rpg.ry + 0.95) < 0.15, 'ry=' + s.ah_wp_rpg.ry);
  await jumpAnim('死亡'); await page.waitForTimeout(2000);
  s = await sample(['ah_wp_rpg']);
  check('rocket-die-weapon-on-back', s.ah_wp_rpg && Math.abs(s.ah_wp_rpg.ry + 0.95) < 0.15 && s.ah_wp_rpg.py < rpgIdle.py - 0.05, 'ry=' + s.ah_wp_rpg.ry + ' py=' + s.ah_wp_rpg.py + '<' + rpgIdle.py);
  await page.screenshot({ path: SHOT_DIR + '/rocketeer_die.png' });

  // ══ guard：横挥警棍 ══
  await loadVariant('guard');
  await page.waitForTimeout(400);
  await jumpAnim('待机'); await page.waitForTimeout(300);
  s = await sample(['ah_wp_baton']);
  check('guard-idle-baton-rest', s.ah_wp_baton && Math.abs(s.ah_wp_baton.rz) < 0.05, 'rz=' + s.ah_wp_baton.rz);
  await jumpAnim('挥击'); await page.waitForTimeout(280); // t≈0.28 蓄力峰值（1.0s）
  s = await sample(['ah_wp_baton']);
  const windupRZ = s.ah_wp_baton ? s.ah_wp_baton.rz : 0;
  await page.waitForTimeout(220); // t≈0.5 爆发横扫
  s = await sample(['ah_wp_baton']);
  check('guard-swing-baton-track', Math.abs(windupRZ) < 0.1, 'windup rz=' + windupRZ + '（顺臂握持 z≈0 非横握；扫弧/水平由 verify_poses 验证）');
  await page.screenshot({ path: SHOT_DIR + '/guard_swing.png' });

  check('console-errors', errors.length === 0, errors.slice(0, 4).join(' || '));
  await browser.close();
  console.log(fail === 0 ? 'ALL PASS (' + pass + ')' : fail + ' FAILURES');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
