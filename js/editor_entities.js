// ==================== js/editor_entities.js — 实体管理系统 ====================
// 依赖: mapData, scene, entityMarkers, patrolLines, bridgeMeshes, highlightRings, selectedEntityIds
// 提供: addEntity, deleteEntity, refreshEntityList, syncEnemyConfigPanel 等

// --- 敌人默认配置 ---
function defaultEnemyCfg(etype) {
    if (etype === 'zombie') return { hp:40, speed:2.5, viewDist:35, attackDamage:10, attackCooldown:1.5, dropRate:0.3, dropHeal:20, reactive:true, aggressive:false, score:50 };
    return { hp:60, speed:5.0, viewDist:50, attackDamage:15, attackCooldown:3.0, dropRate:0.25, dropHeal:30, reactive:true, aggressive:false, score:100 };
}

// --- 实体标记 + CRUD ---
function createSpawnMarker(x, y, z, yaw) {
    const grp = new THREE.Group();
    // 旗杆
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 4, 8), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 }));
    pole.position.y = 2; grp.add(pole);
    // 旗帜
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.8), new THREE.MeshStandardMaterial({ color: 0xf5494a, side: THREE.DoubleSide, roughness: 0.5 }));
    flag.position.set(0.6, 3.5, 0); flag.rotation.y = yaw; grp.add(flag);
    // 方向箭头
    const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.3, 1, 6), new THREE.MeshStandardMaterial({ color: 0xffaa00, roughness: 0.5 }));
    arrow.position.set(1.2, 3.2, 0); arrow.rotation.z = -Math.PI / 2; arrow.rotation.y = yaw; grp.add(arrow);
    grp.position.set(x, y, z);
    return grp;
}

function createTreeMarker(x, y, z, stype) {
    const grp = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 2.5, 8), new THREE.MeshStandardMaterial({ color: 0x8B5A2B, roughness: 0.7 }));
    trunk.position.y = 1.25; grp.add(trunk);
    if (stype === 'sphere') {
        const crown = new THREE.Mesh(new THREE.SphereGeometry(1.3, 12, 8), new THREE.MeshStandardMaterial({ color: 0x4a8b4a, roughness: 0.7 }));
        crown.position.y = 3.2; grp.add(crown);
    } else if (stype === 'oak') {
        const crown = new THREE.Mesh(new THREE.SphereGeometry(1.5, 10, 7), new THREE.MeshStandardMaterial({ color: 0x3a7a3a, roughness: 0.7 }));
        crown.scale.set(1, 0.7, 1); crown.position.y = 3.5; grp.add(crown);
    } else { // cone (default)
        const crown = new THREE.Mesh(new THREE.ConeGeometry(1.2, 3, 10), new THREE.MeshStandardMaterial({ color: 0x2d6b2d, roughness: 0.7 }));
        crown.position.y = 3.5; grp.add(crown);
    }
    grp.position.set(x, y, z);
    return grp;
}

function createBuildingMarker(x, y, z, stype) {
    const grp = new THREE.Group();
    if (stype === 'villa') {
        const body = new THREE.Mesh(new THREE.BoxGeometry(2.5, 4, 2.5), new THREE.MeshStandardMaterial({ color: 0xe8e8f0, roughness: 0.5 }));
        body.position.y = 2; grp.add(body);
        const roof = new THREE.Mesh(new THREE.ConeGeometry(1.8, 1.2, 4), new THREE.MeshStandardMaterial({ color: 0x6b4a3a, roughness: 0.7 }));
        roof.position.y = 4.6; roof.rotation.y = Math.PI / 4; grp.add(roof);
    } else if (stype === 'apartment') {
        const body = new THREE.Mesh(new THREE.BoxGeometry(2, 5, 2), new THREE.MeshStandardMaterial({ color: 0x707080, roughness: 0.5 }));
        body.position.y = 2.5; grp.add(body);
    } else { // bungalow
        const body = new THREE.Mesh(new THREE.BoxGeometry(2, 3, 2), new THREE.MeshStandardMaterial({ color: 0xa0a0b0, roughness: 0.6 }));
        body.position.y = 1.5; grp.add(body);
        const roof = new THREE.Mesh(new THREE.ConeGeometry(1.5, 1.2, 4), new THREE.MeshStandardMaterial({ color: 0x6b3a3a, roughness: 0.7 }));
        roof.position.y = 3.6; roof.rotation.y = Math.PI / 4; grp.add(roof);
    }
    grp.position.set(x, y, z);
    return grp;
}

function createEnemyMarker(x, y, z, etype) {
    const grp = new THREE.Group();
    if (etype === 'zombie') {
        const body = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 1.5, 8), new THREE.MeshStandardMaterial({ color: 0x557744, roughness: 0.6 }));
        body.position.y = 0.75; grp.add(body);
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), new THREE.MeshStandardMaterial({ color: 0x889966, roughness: 0.6 }));
        head.position.y = 1.7; grp.add(head);
    } else { // assault vehicle
        const body = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1, 2.5), new THREE.MeshStandardMaterial({ color: 0xcc4444, roughness: 0.5 }));
        body.position.y = 0.5; grp.add(body);
        const turret = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.6, 8), new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.5 }));
        turret.position.y = 1.3; grp.add(turret);
    }
    grp.position.set(x, y, z);
    return grp;
}

function createWaypointMarker(x, y, z, idx) {
    const grp = new THREE.Group();
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 6), new THREE.MeshStandardMaterial({ color: 0xf5954a, emissive: 0xf5954a, emissiveIntensity: 0.5 }));
    dot.position.y = 0.5; grp.add(dot);
    grp.position.set(x, y + 0.5, z);
    grp.userData.wpIndex = idx;
    return grp;
}

function refreshPatrolLines(enemyId) {
    const ent = mapData.entities.find(e => e.id === enemyId);
    if (!ent || !ent.patrol || ent.patrol.length < 2) {
        if (patrolLines[enemyId]) { scene.remove(patrolLines[enemyId]); patrolLines[enemyId].geometry.dispose(); patrolLines[enemyId].material.dispose(); delete patrolLines[enemyId]; }
        return;
    }
    const pts = ent.patrol.map(wp => new THREE.Vector3(wp.x, wp.y + 0.3, wp.z));
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    if (patrolLines[enemyId]) { scene.remove(patrolLines[enemyId]); patrolLines[enemyId].geometry.dispose(); patrolLines[enemyId].material.dispose(); }
    patrolLines[enemyId] = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xf5954a, linewidth: 1, transparent: true, opacity: 0.7 }));
    scene.add(patrolLines[enemyId]);
}

function addEntity(type, x, y, z, etype) {
    const id = 'e' + (entityIdCounter++);
    const ent = { id, type, position: { x, y, z }, yaw: 0, createdAt: Date.now() };
    if (type === 'tree') ent.subType = etype || treeType;
    if (type === 'building') ent.subType = etype || bldgType;
    if (type === 'enemy') { ent.enemyType = etype || entityType; ent.patrol = []; ent.cfg = defaultEnemyCfg(ent.enemyType); }
    mapData.entities.push(ent);

    let marker;
    switch (type) {
        case 'spawn': marker = createSpawnMarker(x, y, z, 0); break;
        case 'tree': marker = createTreeMarker(x, y, z, ent.subType); break;
        case 'building': marker = createBuildingMarker(x, y, z, ent.subType); break;
        case 'enemy': marker = createEnemyMarker(x, y, z, ent.enemyType); break;
    }
    if (marker) { scene.add(marker); entityMarkers[id] = marker; }
    refreshEntityList();
    return ent;
}

function changeEntityType(eid, newSubType) {
    const ent = mapData.entities.find(e => e.id === eid);
    if (!ent) return;
    if (ent.type === 'tree') ent.subType = newSubType;
    if (ent.type === 'building') ent.subType = newSubType;
    if (ent.type === 'enemy') ent.enemyType = newSubType;
    // 重建标记
    if (entityMarkers[eid]) { scene.remove(entityMarkers[eid]); disposeGroup(entityMarkers[eid]); delete entityMarkers[eid]; }
    let marker;
    switch (ent.type) {
        case 'tree': marker = createTreeMarker(ent.position.x, ent.position.y, ent.position.z, ent.subType); break;
        case 'building': marker = createBuildingMarker(ent.position.x, ent.position.y, ent.position.z, ent.subType); break;
        case 'enemy': marker = createEnemyMarker(ent.position.x, ent.position.y, ent.position.z, ent.enemyType); break;
    }
    if (marker) { scene.add(marker); entityMarkers[eid] = marker; }
    refreshEntityList();
}

function deleteEntity(id) {
    if (!undoManager._inUndoRedo) pushSnapshot();
    const idx = mapData.entities.findIndex(e => e.id === id);
    if (idx < 0) return;
    mapData.entities.splice(idx, 1);
    if (entityMarkers[id]) { scene.remove(entityMarkers[id]); disposeGroup(entityMarkers[id]); delete entityMarkers[id]; }
    // 清理子标记（巡逻点）
    Object.keys(entityMarkers).forEach(k => { if (k.startsWith(id + '_wp')) { scene.remove(entityMarkers[k]); disposeGroup(entityMarkers[k]); delete entityMarkers[k]; } });
    if (patrolLines[id]) { scene.remove(patrolLines[id]); patrolLines[id].geometry.dispose(); patrolLines[id].material.dispose(); delete patrolLines[id]; }
    if (highlightRings[id]) { scene.remove(highlightRings[id]); highlightRings[id].geometry.dispose(); highlightRings[id].material.dispose(); delete highlightRings[id]; }
    selectedEntityIds.delete(id);
    refreshEntityList();
}

function disposeGroup(grp) {
    grp.traverse(child => { if (child.geometry) child.geometry.dispose(); if (child.material) { if (child.material.map) child.material.map.dispose(); child.material.dispose(); } });
}

// ----- 水体系统（v0.33.1: 分段水面剖面 + 桥梁引道） -----
// 水体笔刷的核心：修改 applyBrush() 中的 'water' 分支
// 视觉通过 vertexColors（蓝色）呈现在地形模型上


// --- 高亮环 + 敌人配置面板 + 实体列表 + 分组 ---
function syncHighlightRings() {
    // 移除不再选中的高亮环
    Object.keys(highlightRings).forEach(id => {
        if (!selectedEntityIds.has(id)) {
            scene.remove(highlightRings[id]);
            if (highlightRings[id].geometry) highlightRings[id].geometry.dispose();
            if (highlightRings[id].material) highlightRings[id].material.dispose();
            delete highlightRings[id];
        }
    });
    // 为选中实体添加高亮环
    [...selectedEntityIds].forEach(id => {
        if (highlightRings[id]) return; // 已存在
        const ent = mapData.entities.find(e => e.id === id);
        const marker = entityMarkers[id];
        if (!ent || !marker) return;
        const ring = new THREE.Mesh(
            new THREE.TorusGeometry(1.2, 0.15, 8, 16),
            new THREE.MeshBasicMaterial({ color: 0xf5c842, transparent: true, opacity: 0.7, depthTest: false })
        );
        ring.rotation.x = -Math.PI / 2; // 平放在地面
        ring.position.set(ent.position.x, ent.position.y + 0.15, ent.position.z);
        ring.renderOrder = 999; // 始终在最上层
        ring.material.depthTest = false;
        highlightRings[id] = ring;
        scene.add(ring);
    });
    // 更新已有高亮环位置
    [...selectedEntityIds].forEach(id => {
        const ring = highlightRings[id];
        const ent = mapData.entities.find(e => e.id === id);
        if (ring && ent) {
            ring.position.set(ent.position.x, ent.position.y + 0.15, ent.position.z);
        }
    });
}

// ========== 敌人行为配置面板 ==========
// 获取当前选中的所有敌人实体
function getSelectedEnemies() {
    return [...selectedEntityIds]
        .map(id => mapData.entities.find(e => e.id === id))
        .filter(e => e && e.type === 'enemy');
}

// 是否处于批量编辑模式（选中超过1个敌人）
function isBatchEnemyEdit() {
    return selectedEntityIds.size >= 2 && getSelectedEnemies().length >= 2;
}

function syncEnemyConfigPanel() {
    const selEnemies = getSelectedEnemies();
    const nEnemy = selEnemies.length;
    
    // 无敌人选中 → 隐藏面板
    if (nEnemy === 0) { hideEnemyConfigPanel(); return; }
    
    // 选中了非敌人实体（混合选择）→ 隐藏面板
    const selIds = [...selectedEntityIds];
    const nonEnemy = selIds.some(id => {
        const e = mapData.entities.find(e => e.id === id);
        return e && e.type !== 'enemy';
    });
    if (nonEnemy) { hideEnemyConfigPanel(); return; }
    
    // 取第一个敌人作为显示参考
    const refEnt = selEnemies[0];
    if (!refEnt.cfg) refEnt.cfg = defaultEnemyCfg(refEnt.enemyType || 'assault');
    
    const batch = nEnemy >= 2;
    // 更新标题
    const title = cfgPanel.querySelector('.section-title');
    if (title) {
        title.innerHTML = batch ? `⚙️ 敌人属性 <span style="color:#f5954a;font-size:10px;">(批量编辑 ${nEnemy}个)</span>` : '⚙️ 敌人属性';
    }
    
    cfgPanel.classList.add('visible');
    cfgHp.value = refEnt.cfg.hp || 60;
    cfgSpeed.value = refEnt.cfg.speed || 5;
    cfgView.value = refEnt.cfg.viewDist || 50;
    cfgAtkDmg.value = refEnt.cfg.attackDamage || 15;
    cfgAtkCd.value = refEnt.cfg.attackCooldown || 3;
    cfgDrop.value = refEnt.cfg.dropRate || 0.25;
    cfgHeal.value = refEnt.cfg.dropHeal || 30;
    cfgScore.value = refEnt.cfg.score || 100;
    
    // 行为模式按钮高亮（以第一个敌人为准）
    cfgModeBar.querySelectorAll('.cfg-mode-btn').forEach(b => {
        const mode = b.dataset.mode;
        if (mode === 'reactive') b.classList.toggle('active', refEnt.cfg.reactive === true && refEnt.cfg.aggressive !== true);
        else if (mode === 'aggressive') b.classList.toggle('active', refEnt.cfg.aggressive === true);
        else if (mode === 'none') b.classList.toggle('active', refEnt.cfg.reactive === false && refEnt.cfg.aggressive !== true);
    });
    
    // 巡逻点预览（仅单选时显示，批量模式无意义）
    if (!batch) {
        const wpCount = (refEnt.patrol||[]).length;
        if (wpCount > 0) {
            cfgPatrolPrev.innerHTML = '<div style="color:#f5954a;margin-top:2px;">📍 巡逻点 ('+wpCount+'):</div>' +
                refEnt.patrol.map((wp,i) => `<div class="wp-line">${i+1}. X:${wp.x.toFixed(1)} Z:${wp.z.toFixed(1)}</div>`).join('');
        } else {
            cfgPatrolPrev.innerHTML = '<div style="color:#555;">暂无巡逻点</div>';
        }
    } else {
        cfgPatrolPrev.innerHTML = '<div style="color:#888;">(批量编辑不显示巡逻点)</div>';
    }
}

function hideEnemyConfigPanel() {
    cfgPanel.classList.remove('visible');
    const title = cfgPanel.querySelector('.section-title');
    if (title) title.innerHTML = '⚙️ 敌人属性';
}

// 配置字段 change 事件绑定（支持批量模式）
[cfgHp,cfgSpeed,cfgView,cfgAtkDmg,cfgAtkCd,cfgDrop,cfgHeal,cfgScore].forEach(el => {
    el.addEventListener('input', () => {
        const enemies = getSelectedEnemies();
        if (enemies.length === 0) return;
        // 读取面板当前值
        const hp = parseFloat(cfgHp.value) || 60;
        const speed = parseFloat(cfgSpeed.value) || 5;
        const view = parseInt(cfgView.value) || 50;
        const atkDmg = parseInt(cfgAtkDmg.value) || 15;
        const atkCd = parseFloat(cfgAtkCd.value) || 3;
        const drop = parseFloat(cfgDrop.value);
        const heal = parseInt(cfgHeal.value) || 30;
        const score = parseInt(cfgScore.value) || 100;
        // 批量写入所有选中的敌人
        enemies.forEach(ent => {
            if (!ent.cfg) ent.cfg = defaultEnemyCfg(ent.enemyType || 'assault');
            ent.cfg.hp = hp;
            ent.cfg.speed = speed;
            ent.cfg.viewDist = view;
            ent.cfg.attackDamage = atkDmg;
            ent.cfg.attackCooldown = atkCd;
            ent.cfg.dropRate = drop;
            ent.cfg.dropHeal = heal;
            ent.cfg.score = score;
        });
    });
});

cfgModeBar.addEventListener('click', (ev) => {
    const btn = ev.target.closest('.cfg-mode-btn');
    if (!btn) return;
    const enemies = getSelectedEnemies();
    if (enemies.length === 0) return;
    const mode = btn.dataset.mode;
    // 批量写入所有选中的敌人
    enemies.forEach(ent => {
        if (!ent.cfg) ent.cfg = defaultEnemyCfg(ent.enemyType || 'assault');
        if (mode === 'reactive') { ent.cfg.reactive = true; ent.cfg.aggressive = false; }
        else if (mode === 'aggressive') { ent.cfg.reactive = false; ent.cfg.aggressive = true; }
        else { ent.cfg.reactive = false; ent.cfg.aggressive = false; }
    });
    syncEnemyConfigPanel();
});

function refreshEntityList() {
    const el = document.getElementById('entity-list');
    const batchBar = document.getElementById('batch-bar');
    const sortBar = document.getElementById('sort-bar');
    if (mapData.entities.length === 0) { el.innerHTML = '<div class="empty-msg">暂无实体</div>'; batchBar.classList.add('hidden'); if (sortBar) sortBar.style.display = 'none'; refreshGroupList(); return; }
    if (sortBar) sortBar.style.display = 'flex';
    const treeNames = {cone:'锥形树', sphere:'球形树', oak:'橡树'};
    const bldgNames = {bungalow:'平房', villa:'别墅', apartment:'公寓'};
    const enemyNames = {assault:'突击车', zombie:'丧尸'};
    const icons = { spawn: '🚩', tree: '🌲', building: '🏠', enemy: '👾' };
    const labels = { spawn: '出生点', tree: '树木', building: '建筑', enemy: '敌人' };
    const catNames = { spawn: '🚩 出生点', enemy: '👾 敌人', building: '🏠 建筑', tree: '🌲 树木' };
    const catOrder = ['spawn', 'enemy', 'building', 'tree'];

    // 排序
    let sorted = [...mapData.entities];
    if (entitySortMode === 'type') {
        const typeRank = { spawn: 0, enemy: 1, building: 2, tree: 3 };
        sorted.sort((a, b) => {
            if (typeRank[a.type] !== typeRank[b.type]) return typeRank[a.type] - typeRank[b.type];
            return a.createdAt - b.createdAt;
        });
    } else {
        sorted.sort((a, b) => a.createdAt - b.createdAt);
    }
    sorted.forEach((e, i) => { e._seq = i + 1; });

    const nSel = selectedEntityIds.size;
    batchBar.classList.toggle('hidden', nSel < 2);
    // 批量属性按钮：仅全部选中为敌人时显示
    const batchCfgBtn = document.getElementById('batch-cfg-btn');
    if (batchCfgBtn) {
        const allEnemy = nSel >= 2 && [...selectedEntityIds].every(id => {
            const e = mapData.entities.find(e => e.id === id);
            return e && e.type === 'enemy';
        });
        batchCfgBtn.style.display = allEnemy ? '' : 'none';
    }

    // 按类型分组（保留排序后序号）
    const groups = {};
    catOrder.forEach(t => groups[t] = []);
    sorted.forEach(e => { if (groups[e.type]) groups[e.type].push(e); });

    let html = '';
    catOrder.forEach(type => {
        const ents = groups[type];
        if (!ents || ents.length === 0) return;
        const collapsed = collapsedCategories.has(type);
        html += `<div class="cat-header${collapsed?' collapsed':''}" data-cat="${type}">` +
            `<span class="cat-arrow">▼</span>${catNames[type]}` +
            `<span class="cat-count">${ents.length}个</span></div>`;
        html += `<div class="cat-body${collapsed?' collapsed':''}" data-cat-body="${type}">`;
        ents.forEach(e => {
            const sel = selectedEntityIds.has(e.id) ? ' selected' : '';
            let sub = '';
            if (e.type === 'tree') sub = ` (${treeNames[e.subType]||e.subType})`;
            if (e.type === 'building') sub = ` (${bldgNames[e.subType]||e.subType})`;
            if (e.type === 'enemy') sub = ` (${enemyNames[e.enemyType]||e.enemyType} | 巡逻:${(e.patrol||[]).length})`;
            html += `<div class="entity-row type-${e.type}${sel}" data-eid="${e.id}" title="X:${e.position.x.toFixed(1)} Z:${e.position.z.toFixed(1)}">${icons[e.type]||'●'} ${labels[e.type]||e.type} #${e._seq}${sub}<button class="btn-del" data-del="${e.id}">×</button></div>`;
        });
        html += '</div>';
    });

    // 选中实体类型修改区（仅单选时显示，多选用批量栏）
    if (nSel === 1) {
        const selId = [...selectedEntityIds][0];
        const selEnt = mapData.entities.find(e => e.id === selId);
        if (selEnt && selEnt.type === 'tree') {
            html += '<div style="margin-top:6px;font-size:10px;color:#888;">修改树种类:</div><div style="display:flex;gap:4px;margin:4px 0;">' +
                ['cone','sphere','oak'].map(t => `<button class="chtype-btn${selEnt.subType===t?' active':''}" data-cht="${t}" style="background:#333350;color:#ccc;border:1px solid #4a4a65;border-radius:3px;padding:3px 6px;font-size:10px;cursor:pointer;">${treeNames[t]}</button>`).join('') + '</div>';
        }
        if (selEnt && selEnt.type === 'building') {
            html += '<div style="margin-top:6px;font-size:10px;color:#888;">修改建筑种类:</div><div style="display:flex;gap:4px;margin:4px 0;">' +
                ['bungalow','villa','apartment'].map(t => `<button class="chtype-btn${selEnt.subType===t?' active':''}" data-cht="${t}" style="background:#333350;color:#ccc;border:1px solid #4a4a65;border-radius:3px;padding:3px 6px;font-size:10px;cursor:pointer;">${bldgNames[t]}</button>`).join('') + '</div>';
        }
        if (selEnt && selEnt.type === 'enemy') {
            html += '<div style="margin-top:6px;font-size:10px;color:#888;">修改敌人种类:</div><div style="display:flex;gap:4px;margin:4px 0;">' +
                ['assault','zombie'].map(t => `<button class="chtype-btn${selEnt.enemyType===t?' active':''}" data-cht="${t}" style="background:#333350;color:#ccc;border:1px solid #4a4a65;border-radius:3px;padding:3px 6px;font-size:10px;cursor:pointer;">${enemyNames[t]}</button>`).join('') + '</div>';
        }
    }
    if (nSel >= 2) {
        const selTypes = new Set([...selectedEntityIds].map(id => (mapData.entities.find(e=>e.id===id)||{}).type));
        const selEnemies = [...selectedEntityIds].filter(id => (mapData.entities.find(e=>e.id===id)||{}).type==='enemy');
        html += '<div style="margin-top:4px;font-size:10px;color:#f5954a;">已选 '+nSel+' 个实体 (类型:'+[...selTypes].join(',')+')</div>';
        if (selEnemies.length > 0) {
            html += '<div style="margin-top:4px;font-size:10px;color:#888;">批量修改敌人种类:</div><div style="display:flex;gap:4px;margin:4px 0;">' +
                ['assault','zombie'].map(t => `<button class="chtype-btn" data-cht="${t}" style="background:#333350;color:#ccc;border:1px solid #4a4a65;border-radius:3px;padding:3px 6px;font-size:10px;cursor:pointer;">${enemyNames[t]}</button>`).join('') + '</div>';
            html += '<div style="display:flex;gap:4px;margin:4px 0;"><button class="batch-btn" data-batch="copy-patrol">📋巡逻点复制到选中敌人</button><button class="batch-btn danger" data-batch="clear-patrol">🗑️清空选中巡逻点</button></div>';
        }
    }

    el.innerHTML = html;

    // 分类折叠/展开
    el.querySelectorAll('.cat-header').forEach(hdr => {
        hdr.addEventListener('click', () => {
            const cat = hdr.dataset.cat;
            if (collapsedCategories.has(cat)) collapsedCategories.delete(cat);
            else collapsedCategories.add(cat);
            const body = el.querySelector(`[data-cat-body="${cat}"]`);
            if (body) body.classList.toggle('collapsed', collapsedCategories.has(cat));
            hdr.classList.toggle('collapsed', collapsedCategories.has(cat));
        });
    });

    // 点击选中（支持 Ctrl/Shift 多选 + 双击选同类）
    el.querySelectorAll('.entity-row').forEach(row => {
        let clickTimer = null;
        row.addEventListener('click', (ev) => {
            if (ev.target.classList.contains('btn-del') || ev.target.classList.contains('chtype-btn') || ev.target.classList.contains('batch-btn')) return;
            const eid = row.dataset.eid;
            if (clickTimer) {
                // 双击：选同小类(双击) 或 同大类(Alt+双击)
                clearTimeout(clickTimer); clickTimer = null;
                const ent = mapData.entities.find(e => e.id === eid);
                if (!ent) return;
                selectedEntityIds.clear();
                if (ev.altKey) {
                    mapData.entities.forEach(e => { if (e.type === ent.type) selectedEntityIds.add(e.id); });
                    overlayInfo.textContent = '✅ 已选中全部 ' + labels[ent.type] + ' (' + selectedEntityIds.size + '个)';
                } else {
                    const subKey = ent.type === 'tree' ? 'subType' : ent.type === 'building' ? 'subType' : ent.type === 'enemy' ? 'enemyType' : null;
                    if (subKey) {
                        mapData.entities.forEach(e => { if (e[subKey] === ent[subKey]) selectedEntityIds.add(e.id); });
                    } else {
                        mapData.entities.forEach(e => { if (e.type === ent.type) selectedEntityIds.add(e.id); });
                    }
                    overlayInfo.textContent = '✅ 已选中同类 (' + selectedEntityIds.size + '个)';
                }
                refreshEntityList();
                return;
            }
            // 单击
            clickTimer = setTimeout(() => { clickTimer = null;
                if (ev.ctrlKey || ev.metaKey) {
                    if (selectedEntityIds.has(eid)) selectedEntityIds.delete(eid); else selectedEntityIds.add(eid);
                } else if (ev.shiftKey && selectedEntityIds.size > 0) {
                    const lastId = [...selectedEntityIds].pop();
                    const idx1 = sorted.findIndex(e => e.id === lastId);
                    const idx2 = sorted.findIndex(e => e.id === eid);
                    if (idx1 >= 0 && idx2 >= 0) {
                        const [lo, hi] = [Math.min(idx1, idx2), Math.max(idx1, idx2)];
                        for (let i = lo; i <= hi; i++) selectedEntityIds.add(sorted[i].id);
                    }
                } else {
                    selectedEntityIds.clear();
                    selectedEntityIds.add(eid);
                }
                refreshEntityList();
                refreshGroupList();
            }, 280);
        });
    });
    // 删除按钮
    el.querySelectorAll('.btn-del').forEach(btn => {
        btn.addEventListener('click', (ev) => {
            ev.stopPropagation();
            deleteEntity(btn.dataset.del);
        });
    });
    // 修改类型按钮
    el.querySelectorAll('.chtype-btn').forEach(btn => {
        btn.addEventListener('click', (ev) => {
            ev.stopPropagation();
            const targets = [...selectedEntityIds];
            targets.forEach(id => changeEntityType(id, btn.dataset.cht));
            refreshEntityList();
        });
    });
    // 批量操作按钮
    el.querySelectorAll('[data-batch]').forEach(btn => {
        btn.addEventListener('click', (ev) => {
            ev.stopPropagation();
            const op = btn.dataset.batch;
            if (op === 'copy-patrol') batchCopyPatrol();
            if (op === 'clear-patrol') batchClearPatrol();
        });
    });

    // 排序按钮
    if (sortBar) {
        sortBar.querySelectorAll('.sort-btn').forEach(btn => {
            btn.addEventListener('click', (ev) => {
                ev.stopPropagation();
                entitySortMode = btn.dataset.sort;
                sortBar.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                refreshEntityList();
            });
        });
    }

    // 编组 + 高亮 + 配置面板
    refreshGroupList();
    syncHighlightRings();
    syncEnemyConfigPanel();
}

// ---------- 编组 ----------
function refreshGroupList() {
    const el = document.getElementById('group-list');
    if (!mapData.groups || mapData.groups.length === 0) { el.innerHTML = '<div class="empty-msg">暂无编组</div>'; return; }
    el.innerHTML = mapData.groups.map(g =>
        `<div class="group-row" data-gid="${g.id}" title="点击选中全部成员">
            <span>📦 ${g.name}</span><span class="gcount">(${g.entityIds.length})</span>
            <button class="btn-gdel" data-gdel="${g.id}">×</button>
        </div>`
    ).join('');
    el.querySelectorAll('.group-row').forEach(row => {
        row.addEventListener('click', (ev) => {
            if (ev.target.classList.contains('btn-gdel')) return;
            const g = mapData.groups.find(g => g.id === row.dataset.gid);
            if (g) { selectedEntityIds.clear(); g.entityIds.forEach(id => selectedEntityIds.add(id)); refreshEntityList(); }
        });
    });
    el.querySelectorAll('.btn-gdel').forEach(btn => {
        btn.addEventListener('click', (ev) => {
            ev.stopPropagation();
            mapData.groups = mapData.groups.filter(g => g.id !== btn.dataset.gdel);
            refreshGroupList();
        });
    });
}

function createGroup() {
    if (selectedEntityIds.size < 2) { alert('请至少选中2个实体'); return; }
    // 仅允许同类编组（全敌人 / 全建筑 / 全树木）
    const types = new Set([...selectedEntityIds].map(id => (mapData.entities.find(e=>e.id===id)||{}).type));
    if (types.size > 1) { alert('编组仅支持同类型实体（如全选敌人或全选建筑），当前选中了 ' + [...types].join('+') + '，请统一后再操作'); return; }
    const name = prompt('编组名称:', '编组' + (mapData.groups.length + 1));
    if (!name) return;
    mapData.groups.push({ id: 'g' + Date.now(), name, entityIds: [...selectedEntityIds] });
    refreshGroupList();
}

// ---------- 批量巡逻操作 ----------
function batchCopyPatrol() {
    pushSnapshot();
    const selEnemies = [...selectedEntityIds].filter(id => (mapData.entities.find(e=>e.id===id)||{}).type==='enemy');
    if (selEnemies.length < 2) { alert('需要至少选中2个敌人'); return; }
    const src = mapData.entities.find(e => e.id === selEnemies[0]);
    if (!src || !src.patrol || src.patrol.length === 0) { alert('第一个选中的敌人没有巡逻点'); return; }
    const patrolCopy = src.patrol.map(wp => ({...wp}));
    for (let i = 1; i < selEnemies.length; i++) {
        const ent = mapData.entities.find(e => e.id === selEnemies[i]);
        if (!ent || ent.type !== 'enemy') continue;
        ent.patrol = patrolCopy.map(wp => ({...wp}));
        // 清除旧巡逻点标记
        Object.keys(entityMarkers).forEach(k => { if (k.startsWith(ent.id + '_wp')) { scene.remove(entityMarkers[k]); disposeGroup(entityMarkers[k]); delete entityMarkers[k]; } });
        // 创建新标记
        ent.patrol.forEach((wp, j) => {
            const mk = createWaypointMarker(wp.x, wp.y, wp.z, j);
            entityMarkers[ent.id + '_wp' + j] = mk; scene.add(mk);
        });
        refreshPatrolLines(ent.id);
    }
    refreshEntityList();
    overlayInfo.textContent = '✅ 巡逻点已复制到 ' + (selEnemies.length - 1) + ' 个敌人';
}

function batchClearPatrol() {
    pushSnapshot();
    const selEnemies = [...selectedEntityIds].filter(id => (mapData.entities.find(e=>e.id===id)||{}).type==='enemy');
    selEnemies.forEach(eid => {
        const ent = mapData.entities.find(e => e.id === eid);
        if (!ent) return;
        ent.patrol = [];
        Object.keys(entityMarkers).forEach(k => { if (k.startsWith(eid + '_wp')) { scene.remove(entityMarkers[k]); disposeGroup(entityMarkers[k]); delete entityMarkers[k]; } });
        if (patrolLines[eid]) { scene.remove(patrolLines[eid]); patrolLines[eid].geometry.dispose(); patrolLines[eid].material.dispose(); delete patrolLines[eid]; }
    });
    refreshEntityList();
    overlayInfo.textContent = '✅ 已清空 ' + selEnemies.length + ' 个敌人的巡逻点';
}

// --- 实体模式切换 ---
function setEntityMode(mode) {
    if (entityMode === mode) { 
        entityMode = null; 
        // 离开交互模式时清除选中实体，恢复左键旋转/右键平移
        selectedEntityIds.clear();
        Object.values(highlightRings).forEach(r => { scene.remove(r); r.geometry.dispose(); r.material.dispose(); });
        Object.keys(highlightRings).forEach(k => delete highlightRings[k]);
        refreshEntityList();
    } else { entityMode = mode; }
    // 取消笔刷模式（直接改状态，不触发 setBrushMode 的 entityMode 清理）
    brushMode = 'cursor';
    ['cursor','raise','lower','smooth','paint'].forEach(k => { const b = document.getElementById('btn-'+k); if(b) b.classList.toggle('active', k==='cursor'); });
    document.getElementById('terrain-sel').classList.remove('visible');
    brushInd.style.display = 'none';
    vp.classList.remove('painting');
    if (entityMode) { vp.classList.add('placing'); } else { vp.classList.remove('placing'); }
    document.getElementById('status-tool').textContent = entityMode ?
        {select:'选择实体',spawn:'放置出生点',tree:'放置树木',building:'放置建筑',enemy:'放置敌人',waypoint:'巡逻点'}[entityMode] : '选择';
    ['select','spawn','tree','building','enemy','waypoint','bridge'].forEach(k => {
        const b = document.getElementById('btn-entity-' + k); if (b) b.classList.toggle('active', entityMode === k);
    });
    document.getElementById('entity-sel-enemy').classList.toggle('visible', entityMode === 'enemy');
    document.getElementById('entity-sel-tree').classList.toggle('visible', entityMode === 'tree');
    document.getElementById('entity-sel-building').classList.toggle('visible', entityMode === 'building');
    if (entityMode) {
        const names = {select:'选择实体', spawn:'放置出生点', tree:'放置树木', building:'放置建筑', enemy:'放置敌人', waypoint:'添加巡逻点'};
        overlayInfo.textContent = entityMode === 'select' ? '👆 点击地图上实体选中，拖拽移动 | 右键平移' : '📍 ' + names[entityMode] + ' — 点击地图放置';
    }
}

document.getElementById('btn-entity-select').addEventListener('click', () => setEntityMode('select'));
document.getElementById('btn-entity-spawn').addEventListener('click', () => setEntityMode('spawn'));
document.getElementById('btn-entity-tree').addEventListener('click', () => setEntityMode('tree'));
document.getElementById('btn-entity-building').addEventListener('click', () => setEntityMode('building'));
document.getElementById('btn-entity-enemy').addEventListener('click', () => setEntityMode('enemy'));
document.getElementById('btn-entity-waypoint').addEventListener('click', () => setEntityMode('waypoint'));
document.getElementById('btn-entity-bridge').addEventListener('click', () => { setEntityMode('bridge'); bridgePt1 = null; });

