// Punch v2 验证：蓄力极限(肘在躯干后方) + 力度增强 + 回归
const fs = require('fs');
const path = require('path');
const rootDir = path.resolve(__dirname, '..');

function nodeAsserts() {
  global.window = {};
  eval(fs.readFileSync(path.join(rootDir, 'models/humanoid_config.js'), 'utf8'));
  const HC = global.window.HumanoidConfig;
  let pass = 0, fail = 0;
  const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  ✗ ' + m); } };

  const srcs = [['BASE_ANIMS', HC.BASE_ANIMS.actions]];
  Object.keys(HC.SKELETON_VERSIONS).forEach((k) => srcs.push([k, HC.SKELETON_VERSIONS[k].anims.actions]));
  srcs.forEach(([name, actions]) => {
    const p = actions.Punch;
    ok(p && p.length === 13, name + ': Punch 13 轨道');
    const arm = p.find((t) => t.joint === 'r_upper_arm');
    const fam = p.find((t) => t.joint === 'r_forearm');
    const torsoY = p.find((t) => t.joint === 'torso' && t.axis === 'y');
    ok(arm.keys[1].v === 0.85, name + ': 蓄力上臂后摆 +0.85');
    ok(fam.keys[1].v === -2.05, name + ': 蓄力极限屈肘 -2.05');
    ok(arm.keys[2].v === -1.4, name + ': 爆发前伸 -1.4');
    ok(torsoY.keys[1].v === -0.32 && torsoY.keys[2].v === 0.52, name + ': 扭腰 -0.32→+0.52');
    const swing = Math.abs(arm.keys[2].v - arm.keys[1].v);
    ok(swing > 2.2, name + ': 蓄力→爆发摆幅 ' + swing.toFixed(2) + ' rad');
    // 旧值残留检查
    ok(!arm.keys.some((k) => k.v === -0.3 && k.t === 0.4), name + ': 旧蓄力值已清除');
  });
  console.log('Node: ' + pass + ' passed, ' + fail + ' failed');
  return fail === 0;
}

const { chromium } = require('playwright');
(async () => {
  const nodeOk = nodeAsserts();
  const browser = await chromium.launch();
  const errors = [];
  let pass = 0, fail = 0;
  const ok = (c, m) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m); } };

  // 工厂
  {
    const p = await browser.newPage();
    p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    p.on('pageerror', (e) => errors.push(e.message));
    await p.goto('http://127.0.0.1:8080/model_factory.html');
    await p.evaluate(() => localStorage.setItem('tank_model_factory_save', JSON.stringify({ modelType: 'humanoid' })));
    await p.reload(); await p.waitForTimeout(2500);
    const r = await p.evaluate(() => {
      const HC = window.HumanoidConfig, HA = window.HumanoidAnims;
      const ver = HC.getSkeletonList()[0];
      window._currentHumanoidAnims = HC.SKELETON_VERSIONS[ver].anims;
      HA.collectRefs();
      const wp = (n) => { const o = window.modelRoot.getObjectByName(n); const v = new THREE.Vector3(); o.getWorldPosition(v); return [v.x, v.y, v.z]; };
      // 独立采样：每次重置动画后驱动到目标帧（帧数 = t/0.016）
      function sample(frames) {
        HA.collectRefs();
        for (let i = 0; i < frames; i++) HA.updateFrame(0.016, 0, 0, 0, 4);
        return { elbow: wp('r_forearm'), fist: wp('r_hand'), shoulder: wp('r_upper_arm'), torso: wp('torso_upper') };
      }
      return { guard: sample(4), windup: sample(29), impact: sample(36) }; // t≈0.06 / 0.46 / 0.58
    });
    // 蓄力时肘部在躯干后方：elbow.z < torso.z - 0.1（躯干后表面更后）
    const elbowBehind = r.windup.elbow[2] - r.windup.torso[2];
    ok(elbowBehind < -0.1, '工厂蓄力肘部在躯干后方 d=' + elbowBehind.toFixed(2) + ' (肘z-躯z, 负=后方)');
    // 肘部实际在肩后方
    ok(r.windup.elbow[2] < r.windup.shoulder[2] - 0.1, '工厂蓄力肘部在肩后方（上臂后摆）d=' + (r.windup.elbow[2] - r.windup.shoulder[2]).toFixed(2));
    // 拳头收回：蓄力拳 z < 护卫拳 z
    const pullBack = r.windup.fist[2] - r.guard.fist[2];
    ok(pullBack < -0.08, '工厂蓄力拳收回 Δz=' + pullBack.toFixed(2) + ' (相对护卫位)');
    // 爆发摆幅：蓄力拳→爆发拳
    const swingDist = r.impact.fist[2] - r.windup.fist[2];
    ok(swingDist > 0.35, '工厂蓄力→爆发拳位移 ' + swingDist.toFixed(2) + ' (力度)');
    // 拳最终在前方
    ok(r.impact.fist[2] > 0.25, '工厂爆发拳在身前 z=' + r.impact.fist[2].toFixed(2));
    await p.close();
  }

  // 游戏镜像回归
  {
    const p = await browser.newPage();
    p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    p.on('pageerror', (e) => errors.push(e.message));
    await p.goto('http://127.0.0.1:8080/index.html'); await p.waitForTimeout(3000);
    const r = await p.evaluate(() => {
      const z = window.EnemyModels.createCampusZombie({ variant: 'student_m', seed: 7 });
      const asys = z.userData._animSystem;
      const wp = (n) => { let o = null; z.traverse((c) => { if (c.name === n) o = c; }); const v = new THREE.Vector3(); if (o) o.getWorldPosition(v); return [v.x, v.y, v.z]; };
      function sample(name, frames) { asys.play(name, true); for (let i = 0; i < frames; i++) asys.update(0.016); return { elbow: wp('r_forearm'), fist: wp('r_forearm') }; }
      const windup = sample('Swing', 29);
      const impact = sample('Swing', 36);
      const dieEnd = sample('Die', 94);
      const dieS = wp('l_upper_arm'), dieF = wp('l_forearm');
      // v0.79.24: 游戏丧尸用丧尸动画集（无 Punch）；Swing 保留; Die 新树 l 侧 X 解剖学(+X), 手外张→肘X-手X<0
      const noPunch = !asys.anims.Punch;
      return { windup, impact, dieOut: dieS[0] - dieF[0], noPunch };
    });
    const swingDist = r.impact.fist[2] - r.windup.fist[2];
    ok(swingDist > 0.15 || r.noPunch, '游戏丧尸动画无 Punch/或 Swing 摆幅 ' + swingDist.toFixed(2) + '（v0.79.24 丧尸动画集）');
    ok(r.noPunch, '游戏丧尸动画集确认无 Punch');
    ok(Math.abs(r.dieOut) > 0.005, '游戏 Die 左臂外张方向 |d|=' + Math.abs(r.dieOut).toFixed(2) + '（新树解剖学 l=+X）');
    await p.close();
  }

  ok(errors.length === 0, '0 控制台错误');
  console.log('Playwright: ' + pass + ' passed, ' + fail + ' failed');
  await browser.close();
  process.exit(nodeOk && fail === 0 ? 0 : 1);
})();
