function createBarsForPlayer(player) {
    const barRenderOrder = 999;
    player.reloadBarGroup = new THREE.Group();
    const bgGeo = new THREE.PlaneGeometry(0.18, 0.72);
    const bgMat = new THREE.MeshBasicMaterial({ color: '#444', side: THREE.DoubleSide, depthTest: false, depthWrite: false, transparent: true, opacity: 1 });
    const rbBg = new THREE.Mesh(bgGeo, bgMat);
    rbBg.renderOrder = barRenderOrder;
    player.reloadBarGroup.add(rbBg);
    const fillGeo = new THREE.PlaneGeometry(0.14, 0.66);
    player.reloadBarFill = new THREE.Mesh(fillGeo, new THREE.MeshBasicMaterial({ color: '#ffff00', side: THREE.DoubleSide, depthTest: false, depthWrite: false, transparent: true, opacity: 1 }));
    player.reloadBarFill.renderOrder = barRenderOrder + 1; player.reloadBarFill.position.z = 0.001;
    player.reloadBarGroup.add(player.reloadBarFill);
    player.reloadBarGroup.visible = false;
    scene.add(player.reloadBarGroup);

    const SLABEL_W = 0.22, SLABEL_H = 0.10;
    const sCv = document.createElement('canvas');
    sCv.width = 128; sCv.height = 64;
    const sTex = new THREE.CanvasTexture(sCv);
    sTex.minFilter = THREE.LinearFilter;
    sTex.colorSpace = THREE.SRGBColorSpace;
    const sGeo = new THREE.PlaneGeometry(SLABEL_W, SLABEL_H);
    const sMat = new THREE.MeshBasicMaterial({ map: sTex, side: THREE.DoubleSide, depthTest: false, depthWrite: false, transparent: true });
    player.shellLabel = new THREE.Mesh(sGeo, sMat);
    player.shellLabel.renderOrder = 999;
    player.shellLabel.userData = { canvas: sCv, tex: sTex, w: SLABEL_W, h: SLABEL_H };
    player.shellLabel.visible = false;
    scene.add(player.shellLabel);

    player.hpBarGroup = new THREE.Group();
    const hpBgGeo = new THREE.PlaneGeometry(0.18, 0.72);
    const hpBgMat = new THREE.MeshBasicMaterial({ color: '#444', side: THREE.DoubleSide, depthTest: false, depthWrite: false, transparent: true, opacity: 1 });
    const hpBg = new THREE.Mesh(hpBgGeo, hpBgMat);
    hpBg.renderOrder = barRenderOrder;
    player.hpBarGroup.add(hpBg);
    const hpFillGeo = new THREE.PlaneGeometry(0.14, 0.66);
    player.hpBarFill = new THREE.Mesh(hpFillGeo, new THREE.MeshBasicMaterial({ color: '#00ff00', side: THREE.DoubleSide, depthTest: false, depthWrite: false, transparent: true, opacity: 1 }));
    player.hpBarFill.renderOrder = barRenderOrder + 1; player.hpBarFill.position.z = 0.001;
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
    const bo=0.8;
    const by=getGroundHeight(p.state.x,p.state.z)+0.7;
    if(p.reloadBarGroup){const rx=Math.cos(p.state.yaw+Math.PI/2),rz=Math.sin(p.state.yaw+Math.PI/2);
        p.reloadBarGroup.position.set(p.state.x+rx*bo,by,p.state.z+rz*bo);p.reloadBarGroup.lookAt(cam.position);
        const pg=Math.max(.01,1-p.reloadTimer/RELOAD_TIME);
        p.reloadBarFill.scale.y=pg;p.reloadBarFill.position.y=-.36+.33*pg;
        p.reloadBarFill.material.color.setRGB(1,pg>=1?1:0,0);}
    if(p.hpBarGroup){const lx=Math.cos(p.state.yaw-Math.PI/2),lz=Math.sin(p.state.yaw-Math.PI/2);
        p.hpBarGroup.position.set(p.state.x+lx*bo,by,p.state.z+lz*bo);p.hpBarGroup.lookAt(cam.position);
        const hr=Math.max(.01,p.hp/p.maxHp);
        p.hpBarFill.scale.y=hr;p.hpBarFill.position.y=-.36+.33*hr;
        p.hpBarFill.material.color.setRGB(hr<.5?1:2-hr*2, hr<.5?hr*2:1, 0);}
    if(p.shellLabel){
        const rx=Math.cos(p.state.yaw+Math.PI/2),rz=Math.sin(p.state.yaw+Math.PI/2);
        p.shellLabel.position.set(p.state.x+rx*bo, by-0.48, p.state.z+rz*bo);
        p.shellLabel.lookAt(cam.position);
        const ud=p.shellLabel.userData, cv=ud.canvas, ctx=cv.getContext('2d');
        ctx.clearRect(0,0,cv.width,cv.height);
        const label=currentShellType==='ap'?'AP':'HE';
        ctx.fillStyle=currentShellType==='ap'?'#ffcc00':'#ff6600';
        ctx.beginPath();ctx.arc(cv.width/2,cv.height/2,20,0,Math.PI*2);ctx.fill();
        ctx.fillStyle='#000';ctx.font='bold 22px monospace';ctx.textAlign='center';ctx.textBaseline='middle';
        ctx.fillText(label,cv.width/2,cv.height/2);
        ud.tex.needsUpdate=true;
    }
}
