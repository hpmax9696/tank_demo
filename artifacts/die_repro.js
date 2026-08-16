// 死亡动画复现脚本：加载模型工厂 → 切校园丧尸 → 展台播 Die → 截图 + 关节坐标
// 用法: node artifacts/die_repro.js <输出前缀> [等待ms]
const { chromium } = require('playwright');

const OUT = process.argv[2] || 'artifacts/die';
const WAIT = Number(process.argv[3] || 1900);
const MODE = process.argv[4] || 'variant'; // variant | skeleton

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--disable-renderer-backgrounding', '--disable-background-timer-throttling'],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(String(e)));

  await page.addInitScript(() => {
    localStorage.setItem('tank_model_factory_save', JSON.stringify({ modelType: 'humanoid' }));
  });
  await page.goto('http://127.0.0.1:8080/model_factory.html');
  await page.waitForTimeout(1500);

  // 切换到骨架(共通)模式
  if (MODE === 'skeleton') {
    const ok = await page.evaluate(() => {
      const sels = Array.from(document.querySelectorAll('select'));
      const sel = sels.find((s) =>
        Array.from(s.options).some((o) => o.value === '🦴 骨架(共通)' || o.textContent === '🦴 骨架(共通)')
      );
      if (!sel) return false;
      sel.value = '🦴 骨架(共通)';
      sel.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    });
    console.log('switch to skeleton mode:', ok);
    await page.waitForTimeout(800);
  }

  // 启动动画展台
  await page.click('#toggle-anim');
  await page.waitForTimeout(300);

  // 跳到 Die (index 5)
  const clicked = await page.evaluate(() => {
    const items = document.querySelectorAll('#anim-list .anim-item');
    if (items.length >= 6) {
      items[5].click();
      return items.length;
    }
    return 0;
  });
  console.log('anim items:', clicked);

  await page.waitForTimeout(WAIT);
  await page.screenshot({ path: OUT + '.png' });

  // 关节世界坐标 + 最低点分析
  const data = await page.evaluate(() => {
    const root = window.modelRoot && window.modelRoot.getObjectByName('root');
    if (!root) return { err: 'no root' };
    root.updateMatrixWorld(true);
    const joints = {};
    const names = [
      'root', 'pelvis', 'torso', 'torso_upper', 'neck', 'head',
      'l_upper_arm', 'l_forearm', 'l_hand', 'r_upper_arm', 'r_forearm', 'r_hand',
      'l_upper_leg', 'l_lower_leg', 'l_foot', 'r_upper_leg', 'r_lower_leg', 'r_foot',
    ];
    const v = new THREE.Vector3();
    for (const n of names) {
      const o = root.getObjectByName(n);
      if (o) {
        o.getWorldPosition(v);
        joints[n] = [+v.x.toFixed(3), +v.y.toFixed(3), +v.z.toFixed(3)];
      }
    }
    // 全网格顶点最低采样（每个 mesh 取 bbox 中心+8角太粗，改为遍历顶点）
    let minInfo = { y: Infinity };
    root.traverse((c) => {
      if (c.isMesh && c.geometry && c.geometry.attributes && c.geometry.attributes.position) {
        const pos = c.geometry.attributes.position;
        const p = new THREE.Vector3();
        for (let i = 0; i < pos.count; i++) {
          p.fromBufferAttribute(pos, i).applyMatrix4(c.matrixWorld);
          if (p.y < minInfo.y) minInfo = { y: p.y, mesh: c.name || c.parent.name, x: +p.x.toFixed(2), z: +p.z.toFixed(2) };
        }
      }
    });
    const bbox = new THREE.Box3().setFromObject(root);
    return {
      joints,
      lowest: { y: +minInfo.y.toFixed(3), mesh: minInfo.mesh, x: minInfo.x, z: minInfo.z },
      bbox: {
        min: [+bbox.min.x.toFixed(2), +bbox.min.y.toFixed(2), +bbox.min.z.toFixed(2)],
        max: [+bbox.max.x.toFixed(2), +bbox.max.y.toFixed(2), +bbox.max.z.toFixed(2)],
      },
      rootRot: [+root.rotation.x.toFixed(3), +root.rotation.y.toFixed(3), +root.rotation.z.toFixed(3)],
      rootPos: [+root.position.x.toFixed(3), +root.position.y.toFixed(3), +root.position.z.toFixed(3)],
      rootScale: +root.scale.x.toFixed(3),
      animStatus: (document.getElementById('anim-status') || {}).textContent || '',
      animsSource: window._currentHumanoidAnims ? window._currentHumanoidAnims.restPoses['pelvis:y'] : null,
    };
  });
  console.log(JSON.stringify(data, null, 1));
  console.log('console errors:', errors.length ? errors.join(' | ') : 'none');
  await browser.close();
})().catch((e) => {
  console.error('FAIL', e);
  process.exit(1);
});
