// 投影定位：世界坐标 → 屏幕像素 → 读色验证（正交相机）
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  await p.goto('http://127.0.0.1:8080/model_factory.html', { waitUntil: 'networkidle' });
  await p.evaluate(() => localStorage.setItem('tank_model_factory_save', JSON.stringify({ modelType: 'humanoid' })));
  await p.reload({ waitUntil: 'networkidle' });
  await p.waitForTimeout(1000);
  async function load(vk) {
    await p.evaluate((k) => { window._humanoidEdit.variant = k; window._humanoidEdit.params.height = 1.68; window._applyHumanoidEdit(); }, vk);
    await p.waitForTimeout(600);
    await p.evaluate(() => { const btn = document.getElementById('toggle-anim'); if (btn.classList.contains('active')) btn.click(); });
    await p.waitForTimeout(200);
    await p.click('#toggle-anim');
    await p.waitForTimeout(700);
  }
  await load('rifleman');
  await p.evaluate(() => { window.modelRoot.rotation.y = Math.PI / 2 - 0.5; });
  await p.evaluate(() => { const h = Array.from(document.querySelectorAll('#anim-list .anim-item')).find((it) => it.textContent.includes('挥击')); h.click(); });
  await p.waitForTimeout(330);
  const proj = await p.evaluate(() => {
    const root = window.modelRoot;
    root.updateWorldMatrix(true, true);
    const c = document.querySelector('canvas');
    const rect = c.getBoundingClientRect();
    // 正交相机 activeCamera() 在 (6,0.8,0) 看 (0,0.8,0)；用真实相机对象投影
    // 从渲染循环里借相机：scene 遍历不到——直接用工厂暴露的方式？没有。
    // 改用 canvas 像素读回：绘制到 2D 读色。这里先返回世界坐标，稍后手动投影。
    const muzzle = root.getObjectByName('ah_wp_rifle').localToWorld(new THREE.Vector3(0, 0.008, 0.45));
    const recv = root.getObjectByName('ah_wp_rifle').localToWorld(new THREE.Vector3(0, 0, 0));
    const head = root.getObjectByName('head').getWorldPosition(new THREE.Vector3());
    const helm = root.getObjectByName('ah_hlm').getWorldPosition(new THREE.Vector3());
    return {
      canvas: { x: rect.x, y: rect.y, w: rect.width, h: rect.height },
      muzzle: [muzzle.x, muzzle.y, muzzle.z].map((v) => +v.toFixed(3)),
      recv: [recv.x, recv.y, recv.z].map((v) => +v.toFixed(3)),
      head: [head.x, head.y, head.z].map((v) => +v.toFixed(3)),
      helm: [helm.x, helm.y, helm.z].map((v) => +v.toFixed(3)),
    };
  });
  // 正交投影（相机 +X 看原点，up=+Y，屏幕右=world -Z）
  const cvc = proj.canvas;
  const cyPx = cvc.y + cvc.h / 2;
  const cxPx = cvc.x + cvc.w / 2;
  const unitPx = cvc.h / 6; // ORTHO_FRUSTUM 3.0 半高 → 全高 6 单位
  const projTo = (wpt) => [Math.round(cxPx - wpt[2] * unitPx), Math.round(cyPx - (wpt[1] - 0.8) * unitPx)];
  const pm = projTo(proj.muzzle), pr = projTo(proj.recv), ph = projTo(proj.helm);
  console.log('muzzle world', proj.muzzle, '-> px', pm);
  console.log('receiver world', proj.recv, '-> px', pr);
  console.log('helmet world', proj.helm, '-> px', ph);
  console.log('枪口与头盔屏幕高差(px):', ph[1] - pm[1]);
  await p.screenshot({ path: 'artifacts/shots_soldiers/_proj_cheek.png' });
  // 采样截图上投影点颜色
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
