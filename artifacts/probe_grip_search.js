// RPG 肩扛握把对齐：暴力网格搜索最优臂角
const { chromium } = require('playwright');
const URL = process.env.FACTORY_URL || 'http://127.0.0.1:8080/model_factory.html';
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.setItem('tank_model_factory_save', JSON.stringify({ modelType: 'humanoid' })));
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.evaluate(() => { window._humanoidEdit.variant = 'rocketeer'; window._humanoidEdit.params.height = 1.68; window._applyHumanoidEdit(); });
  await page.waitForTimeout(700);
  const r = await page.evaluate(() => {
    const root = window.modelRoot;
    const w = root.getObjectByName('ah_wp_rpg');
    // 固定肩扛管位
    w.rotation.set(0.05, 0, 0);
    w.position.set(-0.13, 0.18, 0.02);
    const gR = w.localToWorld(new THREE.Vector3(0, -0.075, -0.1));
    const gF = w.localToWorld(new THREE.Vector3(0, -0.075, 0.1));
    // 手部前向运动学（纯几何，避免 3D 对象开销）：肩位 + 上臂/前臂角
    const scale = 0.72, L1 = 0.275 * scale, L2 = 0.255 * scale;
    // r_hand 局部在 forearm 下 (0,-0.18+0.052 pivot...) 手心近似前臂末端再延伸 0.07
    const L2h = 0.255 * scale * 0.85;
    const shoulderR = { x: -0.19, y: 0.86, z: 0.02 };
    const shoulderL = { x: 0.19, y: 0.86, z: 0.02 };
    function handPos(sh, ux, uz, fx, fz) {
      // 上臂方向：rest 下垂 (0,-1,0)，x 旋转 -θ 前举，z 旋转侧展
      let ux_ = Math.sin(ux), uy_ = -Math.cos(ux);
      let dirx = ux_ * Math.cos(uz), diry = uy_, dirz = ux_ * Math.sin(-uz);
      const ex = sh.x + dirx * L1, ey = sh.y + diry * L1, ez = sh.z + dirz * L1;
      // 前臂在上臂基础上再转 fx（相对）
      const a = ux + fx;
      let fx_ = Math.sin(a), fy_ = -Math.cos(a);
      let fzx = fx_ * Math.cos(uz + fz), fzy = fy_, fzz = fx_ * Math.sin(-(uz + fz));
      return { x: ex + fzx * L2h, y: ey + fzy * L2h, z: ez + fzz * L2h };
    }
    function search(sh, target) {
      let best = null;
      for (let ux = -1.8; ux <= 0; ux += 0.1) {
        for (let fx = -1.8; fx <= 0; fx += 0.1) {
          for (let uz = -0.8; uz <= 0.2; uz += 0.1) {
            for (let fz = -0.5; fz <= 0.8; fz += 0.1) {
              const h = handPos(sh, ux, uz, fx, fz);
              const d = Math.hypot(h.x - target.x, h.y - target.y, h.z - target.z);
              if (!best || d < best.d) best = { d: +d.toFixed(3), ux: +ux.toFixed(2), fx: +fx.toFixed(2), uz: +uz.toFixed(2), fz: +fz.toFixed(2), hand: [h.x.toFixed(2), h.y.toFixed(2), h.z.toFixed(2)].join(',') };
            }
          }
        }
      }
      return best;
    }
    const bestR = search(shoulderR, gR);
    const bestL = search(shoulderL, gF);
    return { gR: [gR.x.toFixed(2), gR.y.toFixed(2), gR.z.toFixed(2)].join(','), gF: [gF.x.toFixed(2), gF.y.toFixed(2), gF.z.toFixed(2)].join(','), bestR, bestL };
  });
  console.log(JSON.stringify(r, null, 1));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
