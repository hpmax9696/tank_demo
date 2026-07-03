function createBarsForPlayer(player) {
  const barRenderOrder = 999;
  player.reloadBarGroup = new THREE.Group();
  const bgGeo = new THREE.PlaneGeometry(0.18, 0.72);
  const bgMat = new THREE.MeshBasicMaterial({
    color: '#444',
    side: THREE.DoubleSide,
    depthTest: false,
    depthWrite: false,
    transparent: true,
    opacity: 1,
  });
  const rbBg = new THREE.Mesh(bgGeo, bgMat);
  rbBg.renderOrder = barRenderOrder;
  player.reloadBarGroup.add(rbBg);
  const fillGeo = new THREE.PlaneGeometry(0.14, 0.66);
  player.reloadBarFill = new THREE.Mesh(
    fillGeo,
    new THREE.MeshBasicMaterial({
      color: '#ffff00',
      side: THREE.DoubleSide,
      depthTest: false,
      depthWrite: false,
      transparent: true,
      opacity: 1,
    })
  );
  player.reloadBarFill.renderOrder = barRenderOrder + 1;
  player.reloadBarFill.position.z = 0.001;
  player.reloadBarGroup.add(player.reloadBarFill);
  player.reloadBarGroup.visible = false;
  scene.add(player.reloadBarGroup);

  const SLABEL_W = 0.22,
    SLABEL_H = 0.1;
  const sCv = document.createElement('canvas');
  sCv.width = 128;
  sCv.height = 64;
  const sTex = new THREE.CanvasTexture(sCv);
  sTex.minFilter = THREE.LinearFilter;
  sTex.colorSpace = THREE.SRGBColorSpace;
  const sGeo = new THREE.PlaneGeometry(SLABEL_W, SLABEL_H);
  const sMat = new THREE.MeshBasicMaterial({
    map: sTex,
    side: THREE.DoubleSide,
    depthTest: false,
    depthWrite: false,
    transparent: true,
  });
  player.shellLabel = new THREE.Mesh(sGeo, sMat);
  player.shellLabel.renderOrder = 999;
  player.shellLabel.userData = { canvas: sCv, tex: sTex, w: SLABEL_W, h: SLABEL_H };
  player.shellLabel.visible = false;
  scene.add(player.shellLabel);

  player.hpBarGroup = new THREE.Group();
  const hpBgGeo = new THREE.PlaneGeometry(0.18, 0.72);
  const hpBgMat = new THREE.MeshBasicMaterial({
    color: '#444',
    side: THREE.DoubleSide,
    depthTest: false,
    depthWrite: false,
    transparent: true,
    opacity: 1,
  });
  const hpBg = new THREE.Mesh(hpBgGeo, hpBgMat);
  hpBg.renderOrder = barRenderOrder;
  player.hpBarGroup.add(hpBg);
  const hpFillGeo = new THREE.PlaneGeometry(0.14, 0.66);
  player.hpBarFill = new THREE.Mesh(
    hpFillGeo,
    new THREE.MeshBasicMaterial({
      color: '#00ff00',
      side: THREE.DoubleSide,
      depthTest: false,
      depthWrite: false,
      transparent: true,
      opacity: 1,
    })
  );
  player.hpBarFill.renderOrder = barRenderOrder + 1;
  player.hpBarFill.position.z = 0.001;
  player.hpBarGroup.add(player.hpBarFill);
  player.hpBarGroup.visible = false;
  scene.add(player.hpBarGroup);

  player.damageEffects = new window.DamageEffects(player.group);
  scene.add(player.damageEffects.firePoints);
  scene.add(player.damageEffects.smokePoints);
}

function togglePlayerBars(p, visible) {
  if (p.reloadBarGroup) p.reloadBarGroup.visible = visible;
  if (p.hpBarGroup) p.hpBarGroup.visible = visible;
  if (p.shellLabel) p.shellLabel.visible = visible;
}

function updateBarsForCamera(p, cam) {
  const bo = 0.8;
  const by = getGroundHeight(p.state.x, p.state.z) + 0.7;
  // 根据摄像机方向计算左右向量（而非车身朝向），确保UI条始终在视野两侧
  const toCamX = cam.position.x - p.state.x,
    toCamZ = cam.position.z - p.state.z;
  const toCamLen = Math.sqrt(toCamX * toCamX + toCamZ * toCamZ) || 1;
  const cfx = toCamX / toCamLen,
    cfz = toCamZ / toCamLen;
  const rx = -cfz,
    rz = cfx; // 摄像机右侧 (= 车体左侧, 因为toCam是从坦克指向摄像机)
  const lx = cfz,
    lz = -cfx; // 摄像机左侧 (= 车体右侧)
  if (p.reloadBarGroup) {
    p.reloadBarGroup.position.set(p.state.x + lx * bo, by, p.state.z + lz * bo);
    p.reloadBarGroup.lookAt(cam.position);
    var _rt = (p.spec && p.spec.reloadTime) || RELOAD_TIME;
    const pg = Math.max(0.01, 1 - p.reloadTimer / _rt);
    p.reloadBarFill.scale.y = pg;
    p.reloadBarFill.position.y = -0.36 + 0.33 * pg;
    p.reloadBarFill.material.color.setRGB(1, pg >= 1 ? 1 : 0, 0);
  }
  if (p.hpBarGroup) {
    p.hpBarGroup.position.set(p.state.x + rx * bo, by, p.state.z + rz * bo);
    p.hpBarGroup.lookAt(cam.position);
    const hr = Math.max(0.01, p.hp / p.maxHp);
    p.hpBarFill.scale.y = hr;
    p.hpBarFill.position.y = -0.36 + 0.33 * hr;
    p.hpBarFill.material.color.setRGB(hr < 0.5 ? 1 : 2 - hr * 2, hr < 0.5 ? hr * 2 : 1, 0);
  }
  if (p.shellLabel) {
    p.shellLabel.position.set(p.state.x + lx * bo, by - 0.48, p.state.z + lz * bo);
    p.shellLabel.lookAt(cam.position);
    const ud = p.shellLabel.userData,
      cv = ud.canvas,
      ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, cv.width, cv.height);
    const label = currentShellType === 'ap' ? 'AP' : 'HE';
    ctx.fillStyle = currentShellType === 'ap' ? '#ffcc00' : '#ff6600';
    ctx.beginPath();
    ctx.arc(cv.width / 2, cv.height / 2, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#000';
    ctx.font = 'bold 22px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, cv.width / 2, cv.height / 2);
    ud.tex.needsUpdate = true;
  }
}
