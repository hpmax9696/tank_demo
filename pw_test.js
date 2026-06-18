const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 800 });
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://127.0.0.1:8080', { waitUntil: 'networkidle' });

  // 进入训练场配置
  await page.click('#btn-training');
  await page.waitForTimeout(400);
  await page.click('#tc-player-opts button[data-val="hexapod"]');
  await page.waitForTimeout(150);
  await page.click('#btn-training-start');
  await page.waitForTimeout(4500);

  const active = await page.evaluate(() => !!(window.PlayerControllerManager && window.PlayerControllerManager.isActive()));
  console.log('PCM active(hexapod):', active);

  // 请求 pointer lock (触发 _pointerLocked=true → mousemove 累加 _virtualMouseY)
  await page.evaluate(() => {
    const gc = document.getElementById('game-container') || document.body;
    try { const p = gc.requestPointerLock && gc.requestPointerLock(); if (p && p.catch) p.catch(()=>{}); } catch(e){}
  });
  await page.waitForTimeout(600);
  const locked = await page.evaluate(() => document.pointerLockElement !== null);
  console.log('pointer locked:', locked);

  function getPitch() {
    return page.evaluate(() => {
      const ctrl = window.PlayerControllerManager.getActive();
      if (!ctrl) return null;
      const root = ctrl.getGroup();
      const pv = root.getObjectByName('左加特林_pivot');
      // 枪口世界方向 (反映俯仰)
      const pivWorld = new THREE.Vector3(); pv.getWorldPosition(pivWorld);
      const fwd = new THREE.Vector3(-1,0,0); pv.localToWorld(fwd);
      const dir = fwd.sub(pivWorld).normalize();
      return { rotZ: pv.rotation.z, dirY: dir.y, aimLineDirY: dir.y };
    });
  }

  function sendMouse(dy, count) {
    return page.evaluate(({dy, count}) => {
      for (let i=0;i<count;i++){
        const e = new MouseEvent('mousemove', { movementX:0, movementY:dy, bubbles:true });
        window.dispatchEvent(e);
      }
    }, { dy, count });
  }

  const p0 = await getPitch();
  console.log('初始:', p0);

  // 鼠标下拉 (movementY=+) → _virtualMouseY 增大 → ndcY 减小 → 射线向下 → aimTarget 低 → 俯角(负)
  await sendMouse(40, 25);
  await page.waitForTimeout(500);
  const pDown = await getPitch();
  console.log('下拉后:', pDown);

  // 鼠标上推 (movementY=-)
  await sendMouse(-40, 50);
  await page.waitForTimeout(500);
  const pUp = await getPitch();
  console.log('上推后:', pUp);

  console.log('--- 判定 ---');
  if (p0 && pDown && pUp) {
    const movedDown = Math.abs((pDown.rotZ||0) - (p0.rotZ||0)) > 0.02;
    const movedUp = Math.abs((pUp.rotZ||0) - (pDown.rotZ||0)) > 0.02;
    const dirYChanged = Math.abs((pUp.dirY||0) - (pDown.dirY||0)) > 0.02;
    console.log('下拉俯仰变化:', movedDown, '| 上推俯仰变化:', movedUp, '| 枪口方向Y变化:', dirYChanged);
    console.log(movedDown && movedUp ? '✅ 俯仰响应鼠标' : '❌ 俯仰未响应鼠标');
  }
  console.log('console errors:', errors.length, errors.slice(0,5));
  await browser.close();
})();
