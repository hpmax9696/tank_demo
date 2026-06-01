// ==================== js/editor_terrainPaint.js — 地形绘制系统 ====================
// 依赖: mapData, groundPlane, groundTexCanvas, world2sm, w2i, hash (from terrainGen)
// 提供: recompositeFullTexture, renderHeightmapCanvas, setBrushMode, applyBrush 等

// --- 纹理合成 ---
function recompositeFullTexture(){
    if(!groundTexCanvas)return;
    const ctx=groundTexCanvas.getContext('2d'),id=ctx.createImageData(TEX_RES,TEX_RES);
    const tbx=TEX_RES/hmResW, tby=TEX_RES/hmResD;
    for(let ty=0;ty<TEX_RES;ty++)for(let tx=0;tx<TEX_RES;tx++){
        const sx=Math.floor(tx/tbx),sy=Math.floor(ty/tby),tp=mapData.splatMap[sy*hmResW+sx],c=TC[tp];
        const n=((hash(tx+tp*42,ty+tp*42)%100)/100-.5)*28;
        const pi=(ty*TEX_RES+tx)*4;
        id.data[pi]=Math.max(0,Math.min(255,c[0]+n));id.data[pi+1]=Math.max(0,Math.min(255,c[1]+n));
        id.data[pi+2]=Math.max(0,Math.min(255,c[2]+n-5));id.data[pi+3]=255;
    }
    ctx.putImageData(id,0,0);
    if(groundPlane&&groundPlane.material.map)groundPlane.material.map.needsUpdate=true;
}

function patchTexBlock(sx,sy){
    if(!groundTexCanvas)return;
    const ctx=groundTexCanvas.getContext('2d'),tbx=TEX_RES/hmResW,tby=TEX_RES/hmResD,x0=sx*tbx,y0=sy*tby;
    const tp=mapData.splatMap[sy*hmResW+sx],c=TC[tp],id=ctx.createImageData(Math.ceil(tbx),Math.ceil(tby));
    for(let dy=0;dy<tby;dy++)for(let dx=0;dx<tbx;dx++){
        const n=((hash(x0+dx+tp*42,y0+dy+tp*42)%100)/100-.5)*28;
        const pi=(dy*Math.ceil(tbx)+dx)*4;
        id.data[pi]=Math.max(0,Math.min(255,c[0]+n));id.data[pi+1]=Math.max(0,Math.min(255,c[1]+n));
        id.data[pi+2]=Math.max(0,Math.min(255,c[2]+n-5));id.data[pi+3]=255;
    }
    ctx.putImageData(id,x0,y0);
}

function freshTex(){
    groundTexCanvas=document.createElement('canvas');
    groundTexCanvas.width=groundTexCanvas.height=TEX_RES;
    recompositeFullTexture();
    const t=new THREE.CanvasTexture(groundTexCanvas);
    t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(1,1);
    return t;
}

function updateTerrainStats(){
    const cnt=[0,0,0,0,0,0],total=hmResW*hmResD;
    for(let i=0;i<total;i++)cnt[mapData.splatMap[i]]++;
    for(let i=0;i<6;i++)document.getElementById('pct-'+TNAMES[i]).textContent=(cnt[i]/total*100).toFixed(1)+'%';
}

// --- 地形几何更新 ---
function updGeoHeights(geo) {
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), idx = w2i(x, z); p.setY(i, idx >= 0 ? mapData.heightmap[idx] : 0); }
    p.needsUpdate = true; geo.computeVertexNormals();
}

function updGeoHeightsPartial(geo, minSx, minSy, maxSx, maxSy) {
    const p = geo.attributes.position;
    const hasColors = geo.attributes.color;
    for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), z = p.getZ(i);
        const sx = Math.round((x + worldHalfW) / worldWidth * (hmResW - 1)), sy = Math.round((z + worldHalfD) / worldDepth * (hmResD - 1));
        if (sx >= minSx && sx <= maxSx && sy >= minSy && sy <= maxSy) {
            const idx = w2i(x, z); if (idx >= 0) p.setY(i, mapData.heightmap[idx]);
            // 同步水体 vertexColor（平滑过渡带）
            if (hasColors && mapData.editedVerticesPaint && mapData.editedVerticesPaint.has(sx + ',' + sy)) {
                const h = mapData.heightmap[idx >= 0 ? idx : 0];
                const blend = h < -0.12 ? 1.0 : h < -0.04 ? (-0.04 - h) / 0.08 : 0;
                const depth = Math.min(1, Math.max(0, (-h) / (brushStrength * 0.2 + 0.5)));
                hasColors.setXYZ(i,
                    0.10 + (1 - blend) * 0.90,
                    (0.40 + depth * 0.15) * blend + (1 - blend),
                    (0.65 + depth * 0.25) * blend + (1 - blend)
                );
            }
        }
    }
    p.needsUpdate = true; if (hasColors) hasColors.needsUpdate = true;
    geo.computeVertexNormals();
}

// --- 高度图画布 ---
function renderHeightmapCanvas() {
    const ctx = hmCanvas.getContext('2d');
    const imgData = ctx.createImageData(hmResW, hmResD);

    // 找到高度范围
    let minH = Infinity, maxH = -Infinity;
    for (let i = 0; i < mapData.heightmap.length; i++) {
        const h = mapData.heightmap[i];
        if (h < minH) minH = h;
        if (h > maxH) maxH = h;
    }
    const range = maxH - minH || 1;

    for (let y = 0; y < hmResD; y++) {
        for (let x = 0; x < hmResW; x++) {
            const idx = y * hmResW + x;
            const h = mapData.heightmap[idx];
            const t = (h - minH) / range;  // 归一化 [0,1]

            const pi = idx * 4;
            if (mapData.editedVerticesPaint && mapData.editedVerticesPaint.has(x + ',' + y)) {
                // 水体区域：蓝色调，越深越蓝
                const depth = Math.min(1, Math.max(0, (-h) / (brushStrength * 0.2 + 0.5)));
                imgData.data[pi] = Math.round(20 + depth * 15);       // R
                imgData.data[pi + 1] = Math.round(80 + depth * 40);   // G
                imgData.data[pi + 2] = Math.round(150 + depth * 70);  // B
                imgData.data[pi + 3] = 255;
            } else {
                // 地形着色：低处暗绿 → 中间灰绿 → 高处土黄
                const r = Math.round(30 + t * 180);
                const g = Math.round(60 + t * 100);
                const b = Math.round(20 + t * 40);
                imgData.data[pi] = r;
                imgData.data[pi + 1] = g;
                imgData.data[pi + 2] = b;
                imgData.data[pi + 3] = 255;
            }
        }
    }
    ctx.putImageData(imgData, 0, 0);

    hmMinVal.textContent = minH.toFixed(2);
    hmMaxVal.textContent = maxH.toFixed(2);

    // 更新侧边栏信息
    document.getElementById('info-minh').textContent = minH.toFixed(2);
    document.getElementById('info-maxh').textContent = maxH.toFixed(2);
}

// ----- 相机控制（手动实现，无依赖）-----
let camYaw = 0;          // 水平旋转角度（弧度）
let camPitch = Math.PI / 2;   // 俯角（0=水平, PI/2=垂直俯视）
let camDist = 120;        // 相机距原点距离（init时根据地图尺寸调整）
let camTarget = { x: 0, z: 0 };
let boxSelStart = { x: 0, y: 0 };
let boxSelEnd = { x: 0, y: 0 };
const selBox = document.getElementById('selection-box');

function updCam() { updateCameraPosition(); }
function updateCameraPosition() {
    const cx = camTarget.x + camDist * Math.sin(camPitch) * Math.cos(camYaw);
    const cy = camDist * Math.cos(camPitch);
    const cz = camTarget.z + camDist * Math.sin(camPitch) * Math.sin(camYaw);
    camera.position.set(cx, Math.max(cy, 10), cz);
    camera.lookAt(camTarget.x, 0, camTarget.z);
}

function setViewMode(mode) {
    switch (mode) {
        case 'top':
            camPitch = Math.PI / 2;
            camYaw = 0;
            camDist = Math.max(worldWidth, worldDepth) * 0.8;
            camTarget = { x: 0, z: 0 };
            statusCam.textContent = '顶视图';
            break;
        case '3d':
            camPitch = 1.0;
            camYaw = 0.4;
            camDist = Math.max(280, Math.max(worldWidth, worldDepth) * 0.8);
            camTarget = { x: 0, z: 0 };
            statusCam.textContent = '3D 透视';
            break;
        case 'front':
            camPitch = 0.01;
            camYaw = 0;
            camDist = Math.max(worldWidth, worldDepth) * 0.8;
            camTarget = { x: 0, z: 0 };
            statusCam.textContent = '前视图';
            break;
    }
    updateCameraPosition();
    selView.value = mode;
}

// 滚轮缩放（独立于 mousemove 画笔逻辑）
viewport3D.addEventListener('wheel', (e) => {
    e.preventDefault();
        camDist *= e.deltaY > 0 ? 1.08 : 0.93;
        camDist = Math.max(15, Math.min(Math.max(400, Math.max(worldWidth, worldDepth) * 1.5), camDist));
    updateCameraPosition();
}, { passive: false });

viewport3D.addEventListener('contextmenu', e => e.preventDefault());

function setBrushMode(mode) {
    brushMode = mode;
    // 切换到任何笔刷模式均取消实体模式
    entityMode = null;
    // 同时清除实体选中状态，恢复左右键摄像机控制
    selectedEntityIds.clear();
    Object.values(highlightRings).forEach(r => { scene.remove(r); r.geometry.dispose(); r.material.dispose(); });
    Object.keys(highlightRings).forEach(k => delete highlightRings[k]);
    refreshEntityList();
    vp.classList.remove('placing');
    ['select','spawn','tree','building','enemy','waypoint','bridge'].forEach(k => { const b = document.getElementById('btn-entity-'+k); if(b) b.classList.remove('active'); });
    document.getElementById('entity-sel-enemy').classList.remove('visible');
    document.getElementById('entity-sel-tree').classList.remove('visible');
    document.getElementById('entity-sel-building').classList.remove('visible');
    ['cursor','raise','lower','smooth','paint','water','road'].forEach(k => { const b = document.getElementById('btn-'+k); if(b) b.classList.toggle('active', k===mode); });
    document.getElementById('terrain-sel').classList.toggle('visible', mode==='paint');
    document.getElementById('road-sel').classList.toggle('visible', mode==='road');
    document.getElementById('status-tool').textContent = {cursor:'选择',raise:'提升',lower:'下陷',smooth:'平滑',paint:'纹理',water:'水体',road:'道路'}[mode]||mode;
    vp.classList.toggle('painting', mode!=='cursor');
    if (mode==='cursor') { brushInd.style.display='none'; overlayInfo.textContent='🖱️选择模式 — 拖拽旋转 | Shift平移 | 滚轮缩放'; }
    else if (mode==='water') { overlayInfo.textContent='🟦 水体模式 — 单击生成池塘 | 拖拽画河流 | 宽度='+brushRadius+'m 深度='+brushStrength; }
    else if (mode==='road') { overlayInfo.textContent='🛣️ 道路模式 — 拖拽画路 | CatmullRom平滑 | '+roadTypeNames[roadType]+' '+roadWidth+'m'; }
    else { overlayInfo.textContent='🖌️笔刷模式 — 单击/拖拽编辑 | 右键平移 | 滚轮缩放'; }
    const lblR = document.getElementById('lbl-radius'), lblS = document.getElementById('lbl-strength');
    if (lblR) {
        lblR.childNodes[0].textContent = mode==='water' ? '宽度 ' : '半径 ';
        lblR.title = mode==='water' ? '水体宽度(米)' : '笔刷半径(米)';
        lblR.style.display = mode==='road' ? 'none' : '';  // 道路模式隐藏整个半径滑块
    }
    if (lblS) { lblS.style.display = mode==='road' ? 'none' : ''; }
}

function updBrushIndicator(e) {
    if (brushMode==='cursor') { brushInd.style.display='none'; return; }
    brushInd.style.display='block';
    const rect = vp.getBoundingClientRect();
    brushInd.style.left = (e.clientX - rect.left) + 'px';
    brushInd.style.top = (e.clientY - rect.top) + 'px';
    const scrRad = Math.max(10, brushRadius / camDist * rect.height * 0.5);
    brushInd.style.width = brushInd.style.height = (scrRad * 2) + 'px';
}

// 笔刷应用

function applyBrush(wx, wz, skipGeoUpdate = false) {
    if (Math.abs(wx) > worldHalfW || Math.abs(wz) > worldHalfD) return;
    const rPxW = brushRadius / hmStepW, rPxZ = brushRadius / hmStepD;
    const { sx: cx, sy: cy } = world2sm(wx, wz);
    const rPxWin = Math.ceil(rPxW), rPxZin = Math.ceil(rPxZ);
    let minSx = hmResW, minSy = hmResD, maxSx = 0, maxSy = 0;

    for (let dy = -rPxZin; dy <= rPxZin; dy++) {
        for (let dx = -rPxWin; dx <= rPxWin; dx++) {
            const wDist = Math.sqrt(dx*dx*hmStepW*hmStepW + dy*dy*hmStepD*hmStepD);
            if (wDist > brushRadius) continue;
            const sx = cx + dx, sy = cy + dy;
            if (sx < 0 || sx >= hmResW || sy < 0 || sy >= hmResD) continue;
            const t = 1 - wDist / brushRadius, falloff = t * t * (3 - 2 * t);
            const idx = sy * hmResW + sx;
            if (sx < minSx) minSx = sx; if (sx > maxSx) maxSx = sx;
            if (sy < minSy) minSy = sy; if (sy > maxSy) maxSy = sy;

            switch (brushMode) {
                case 'raise': mapData.heightmap[idx] += brushStrength * 0.1 * falloff; break;
                case 'lower': mapData.heightmap[idx] -= brushStrength * 0.1 * falloff; break;
                case 'smooth': {
                    let sum = 0, cnt = 0;
                    for (let ny = -1; ny <= 1; ny++) for (let nx = -1; nx <= 1; nx++) {
                        const nidx = (sy + ny) * hmResW + (sx + nx);
                        if (sx + nx >= 0 && sx + nx < hmResW && sy + ny >= 0 && sy + ny < hmResD) { sum += mapData.heightmap[nidx]; cnt++; }
                    }
                    if (cnt > 0) { const avg = sum / cnt, blend = brushStrength / 30; mapData.heightmap[idx] += (avg - mapData.heightmap[idx]) * blend * falloff; }
                    break;
                }
                case 'paint':
                    if (falloff > 0.3) { mapData.splatMap[idx] = paintType; affectedBlocks.add(sx + ',' + sy); dirtyTex = true; }
                    break;
                case 'water':
                    // v0.32.6: applyBrush water 仅用于初始点击反馈，实际河床由走廊法雕刻
                    if (!mapData.editedVerticesPaint) mapData.editedVerticesPaint = new Set();
                    const isEdited_w = mapData.editedVerticesPaint.has(sx + ',' + sy);
                    const soften_w = isEdited_w ? 0.2 : 1.0;
                    const origH_w = mapData.heightmap[idx];
                    const waterFalloff = t;
                    const bedDepth_w = brushStrength * waterFalloff * soften_w;
                    const targetH_w = origH_w - bedDepth_w;
                    const finalH_w = Math.min(targetH_w, waterBaseLevel - 0.5);
                    mapData.heightmap[idx] = finalH_w;
                    if (falloff > 0.08) {
                        mapData.splatMap[idx] = 1;
                        affectedBlocks.add(sx + ',' + sy);
                        dirtyTex = true;
                    }
                    if (!isEdited_w) mapData.editedVerticesPaint.add(sx + ',' + sy);
                    break;
            }
        }
    }

    // 更新 3D 几何（水体拖拽/批量雕刻期间跳过，mouseup 一次性重建）
    if (!skipGeoUpdate && brushMode !== 'paint' && !isWaterPainting) {
        updGeoHeightsPartial(groundPlane.geometry, Math.max(minSx-1,0), Math.max(minSy-1,0), Math.min(maxSx+1,hmResW - 1), Math.min(maxSy+1,hmResW - 1));
        groundWireframe.geometry.dispose();
        groundWireframe.geometry = new THREE.WireframeGeometry(groundPlane.geometry, 1);

        // 同步笔刷范围内实体高度
        const brWorld2 = brushRadius * brushRadius;
        mapData.entities.forEach(ent => {
            const d2 = (ent.position.x - wx) ** 2 + (ent.position.z - wz) ** 2;
            if (d2 < brWorld2) {
                const newH = smpHeight(ent.position.x, ent.position.z);
                ent.position.y = newH;
                if (entityMarkers[ent.id]) entityMarkers[ent.id].position.y = newH;
                // 同步巡逻点高度
                if (ent.patrol) {
                    ent.patrol.forEach((wp, i) => {
                        const mk = entityMarkers[ent.id + '_wp' + i];
                        if (mk) { wp.y = smpHeight(wp.x, wp.z); mk.position.y = wp.y + 0.5; }
                    });
                    refreshPatrolLines(ent.id);
                }
            }
        });
        // 更新高亮环位置（实体高度变化后）
        [...selectedEntityIds].forEach(id => {
            const ring = highlightRings[id];
            const ent = mapData.entities.find(e => e.id === id);
            if (ring && ent) ring.position.set(ent.position.x, ent.position.y + 0.15, ent.position.z);
        });
    }
}

// 射线投射
// raycaster, mNDC, gPlane3 在主文件中定义

function getWorldPos(e) {
    const rect = vp.getBoundingClientRect();
    mNDC.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mNDC.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mNDC, camera);
    if (groundPlane) {
        const hits = raycaster.intersectObject(groundPlane);
        if (hits.length > 0) return hits[0].point;
    }
    // 兜底：与 y=0 平面相交（初始化早期无地面时）
    const pt = new THREE.Vector3();
    raycaster.ray.intersectPlane(gPlane3, pt);
    return pt;
}
