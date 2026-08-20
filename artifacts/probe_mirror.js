// 左右镜像修正实验：①头右倾方向 ②RPG 右肩斜背 ③RPG 肩扛双手握把对齐
const { chromium } = require('playwright');
const URL = process.env.FACTORY_URL || 'http://127.0.0.1:8080/model_factory.html';
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.setItem('tank_model_factory_save', JSON.stringify({ modelType: 'humanoid' })));
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  async function load(vk) {
    await page.evaluate((k) => { window._humanoidEdit.variant = k; window._humanoidEdit.params.height = 1.68; window._applyHumanoidEdit(); }, vk);
    await page.waitForTimeout(700);
  }

  // ── ① 头 z 旋转方向（+Z 朝前，rotation.z 正 = 头顶偏向哪个 X）──
  await load('rifleman');
  const headDir = await page.evaluate(() => {
    const root = window.modelRoot;
    const head = root.getObjectByName('head');
    const out = [];
    for (const z of [0, 0.35, -0.35]) {
      head.rotation.set(0, 0, z);
      root.updateWorldMatrix(true, true);
      const top = head.localToWorld(new THREE.Vector3(0, 0.0893, 0));
      out.push({ z, topX: +top.x.toFixed(3) });
    }
    head.rotation.set(0, 0, 0);
    return out;
  });
  console.log('head z-rot test:', JSON.stringify(headDir), '（+X=模型左侧；枪在右手 -X 侧 → 贴腮头应偏向 -X）');

  // ── ② RPG 斜背镜像：ry 取负 → 战斗部端 x 应为负（右肩）──
  await load('rocketeer');
  const slant = await page.evaluate(() => {
    const root = window.modelRoot;
    const w = root.getObjectByName('ah_wp_rpg');
    const out = [];
    for (const [rx, ry, px] of [[-1.5, -0.95, -0.02], [-1.5, 0.95, 0.02]]) {
      w.rotation.set(rx, ry, 0);
      w.position.set(px, 0, -0.2);
      root.updateWorldMatrix(true, true);
      const tip = w.localToWorld(new THREE.Vector3(0, 0, 0.66));
      const vent = w.localToWorld(new THREE.Vector3(0, 0, -0.37));
      const dir = new THREE.Vector3().subVectors(tip, vent).normalize();
      out.push({ rx, ry, px, tip: [tip.x.toFixed(2), tip.y.toFixed(2), tip.z.toFixed(2)].join(','), dir: [dir.x.toFixed(2), dir.y.toFixed(2), dir.z.toFixed(2)].join(',') });
    }
    return out;
  });
  console.log('rpg slant mirror:', JSON.stringify(slant, null, 1));

  // ── ③ RPG 肩扛位（右肩 x-0.1）双手握把距离迭代 ──
  const grip = await page.evaluate(() => {
    const root = window.modelRoot;
    const w = root.getObjectByName('ah_wp_rpg');
    const lu = root.getObjectByName('l_upper_arm_pivot');
    const lf = root.getObjectByName('l_forearm_pivot');
    const ru = root.getObjectByName('r_upper_arm_pivot');
    const rf = root.getObjectByName('r_forearm_pivot');
    // 肩扛位：右肩上方（x-0.1），管沿 +Z 前伸，高度 y+0.4（视觉 0.545）
    w.rotation.set(0.05, 0, 0);
    w.position.set(-0.1, 0.4, 0.08);
    const combos = [
      { label: 'A 直臂垂', rU: [-0.55, 0, -0.18], rF: [-0.85, 0, 0], lU: [-0.92, 0, -0.22], lF: [-0.42, 0, 0.55] },
      { label: 'B 抬臂握', rU: [-0.75, 0, -0.25], rF: [-0.7, 0, 0], lU: [-1.1, 0, -0.35], lF: [-0.6, 0, 0.4] },
      { label: 'C 高握', rU: [-0.95, 0, -0.3], rF: [-0.55, 0, 0], lU: [-1.3, 0, -0.45], lF: [-0.75, 0, 0.3] },
    ];
    const out = [];
    for (const c of combos) {
      ru.rotation.set(...c.rU); rf.rotation.set(...c.rF);
      lu.rotation.set(...c.lU); lf.rotation.set(...c.lF);
      root.updateWorldMatrix(true, true);
      const rh = root.getObjectByName('r_hand').getWorldPosition(new THREE.Vector3());
      const lh = root.getObjectByName('l_hand').getWorldPosition(new THREE.Vector3());
      const gR = w.localToWorld(new THREE.Vector3(0, -0.075, -0.1)); // 后握把
      const gF = w.localToWorld(new THREE.Vector3(0, -0.075, 0.1)); // 前握把
      out.push({
        label: c.label,
        rHand: [rh.x.toFixed(2), rh.y.toFixed(2), rh.z.toFixed(2)].join(','),
        lHand: [lh.x.toFixed(2), lh.y.toFixed(2), lh.z.toFixed(2)].join(','),
        gRear: [gR.x.toFixed(2), gR.y.toFixed(2), gR.z.toFixed(2)].join(','),
        gFront: [gF.x.toFixed(2), gF.y.toFixed(2), gF.z.toFixed(2)].join(','),
        dR: +Math.hypot(rh.x - gR.x, rh.y - gR.y, rh.z - gR.z).toFixed(3),
        dL: +Math.hypot(lh.x - gF.x, lh.y - gF.y, lh.z - gF.z).toFixed(3),
      });
    }
    return out;
  });
  console.log('rpg shoulder grips:', JSON.stringify(grip, null, 1));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
