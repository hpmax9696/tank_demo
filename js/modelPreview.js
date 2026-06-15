// ==================== 模型预览系统 ====================
var previewContainer = document.getElementById('preview-container');
var previewCatTabs = document.getElementById('preview-cat-tabs');
var previewModelList = document.getElementById('preview-model-list');
var previewLabel = document.getElementById('preview-label');
var btnPreview = document.getElementById('btn-preview');
var btnPreviewBack = document.getElementById('btn-preview-back');

var previewScene = null, previewCamera = null, previewRenderer = null;
var previewModel = null;
var previewAnimId = null;
// 轨道旋转状态
var previewTheta = 0, previewPhi = Math.PI / 4, previewRadius = 5;
var previewIsDragging = false, previewPrevMouse = { x: 0, y: 0 };
const PREVIEW_ROTATE_SPEED = 0.005;
const PREVIEW_ZOOM_SPEED = 0.1;
const PREVIEW_MIN_RADIUS = 0.8;
const PREVIEW_MAX_RADIUS = 15;

// 当前激活的分类与模型
var previewActiveCat = null;
var previewActiveModel = null;

// 分类数据（在 buildPreviewTabs 中填充）
var previewCatData = [];

function enterPreviewMode() {
    menuOverlay.classList.add('hidden');
    previewContainer.classList.add('active');

    // 清理残留的旧 canvas（防止上次退出时 DOM 未清理干净）
    const staleCanvases = previewContainer.querySelectorAll('canvas');
    staleCanvases.forEach(c => c.remove());

    // 创建预览渲染器
    previewRenderer = new THREE.WebGLRenderer({ antialias: true });
    previewRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    previewRenderer.setSize(window.innerWidth, window.innerHeight);
    previewRenderer.shadowMap.enabled = true;
    previewRenderer.shadowMap.type = THREE.PCFSoftShadowMap;
    previewRenderer.toneMapping = THREE.ACESFilmicToneMapping;
    previewRenderer.toneMappingExposure = 1.2;
    previewContainer.appendChild(previewRenderer.domElement);

    // 预览场景
    previewScene = new THREE.Scene();
    previewScene.background = new THREE.Color('#1a1a2e');

    // 光照
    previewScene.add(new THREE.AmbientLight('#ffffff', 0.6));
    previewScene.add(new THREE.HemisphereLight('#ffeeb1', '#446633', 0.5));
    const sun = new THREE.DirectionalLight('#fffef0', 2.5);
    sun.position.set(5, 8, 5);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 512;
    sun.shadow.mapSize.height = 512;
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 50;
    sun.shadow.camera.left = -10;
    sun.shadow.camera.right = 10;
    sun.shadow.camera.top = 10;
    sun.shadow.camera.bottom = -10;
    previewScene.add(sun);

    // 地面
    const groundGeo = new THREE.PlaneGeometry(20, 20);
    const groundMat = new THREE.MeshStandardMaterial({ color: '#62994a', roughness: 0.9 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.01;
    ground.receiveShadow = true;
    previewScene.add(ground);

    // 摄像机
    previewCamera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100);
    updatePreviewCamera();

    // 构建分类导航
    buildPreviewTabs();

    // 鼠标事件
    previewRenderer.domElement.addEventListener('mousedown', onPreviewMouseDown);
    window.addEventListener('mousemove', onPreviewMouseMove);
    window.addEventListener('mouseup', onPreviewMouseUp);
    previewRenderer.domElement.addEventListener('wheel', onPreviewWheel, { passive: false });

    // 动画循环
    function previewLoop() {
        updatePreviewCamera();
        previewRenderer.render(previewScene, previewCamera);
        previewAnimId = requestAnimationFrame(previewLoop);
    }
    previewAnimId = requestAnimationFrame(previewLoop);
}

function buildPreviewTabs() {
    previewCatTabs.innerHTML = '';
    previewModelList.innerHTML = '';

    // 收集分类
    const catMap = {
        tanks: { id: 'tanks', label: '坦克', models: [] },
        trees: { id: 'trees', label: '树木', models: [] },
        buildings: { id: 'buildings', label: '建筑', models: [] },
        grass: { id: 'grass', label: '草丛', models: [] },
        enemies: { id: 'enemies', label: '敌方单位', models: [] },
        pickups: { id: 'pickups', label: '战利品', models: [] },
        special: { id: 'special', label: '特殊物件', models: [] }
    };

    // 程序化模型
    const regModels = window.ModelRegistry.getAllModels();
    for (const m of regModels) {
        if (catMap[m.category]) {
            catMap[m.category].models.push({ cat: m.category, name: m.name, label: m.name, catLabel: m.categoryLabel });
        }
    }

    // 过滤空分类，构建分类数据
    previewCatData = Object.values(catMap).filter(c => c.models.length > 0);

    // 渲染分类标签
    previewCatData.forEach((cat, idx) => {
        const tab = document.createElement('div');
        tab.className = 'preview-cat-tab';
        tab.textContent = cat.label;
        tab.addEventListener('click', () => selectPreviewCat(idx, tab));
        previewCatTabs.appendChild(tab);
    });

    // 默认选中第一个分类
    if (previewCatData.length > 0) {
        const firstTab = previewCatTabs.children[0];
        selectPreviewCat(0, firstTab);
    }
}

function selectPreviewCat(idx, tabEl) {
    // 更新标签激活状态
    previewCatTabs.querySelectorAll('.preview-cat-tab').forEach(t => t.classList.remove('active'));
    tabEl.classList.add('active');
    previewActiveCat = idx;

    // 渲染该分类下的模型列表
    previewModelList.innerHTML = '';
    const cat = previewCatData[idx];
    cat.models.forEach((m, mi) => {
        const btn = document.createElement('div');
        btn.className = 'preview-model-btn';
        btn.textContent = m.label;
        btn.addEventListener('click', () => {
            previewModelList.querySelectorAll('.preview-model-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            previewActiveModel = m;
            loadPreviewModel(m);
        });
        previewModelList.appendChild(btn);
    });

    // 默认选中第一个模型
    if (cat.models.length > 0) {
        const firstBtn = previewModelList.children[0];
        firstBtn.classList.add('active');
        previewActiveModel = cat.models[0];
        loadPreviewModel(cat.models[0]);
    }
}

function loadPreviewModel(m) {
    if (previewModel && previewModel.parent) {
        previewModel.parent.remove(previewModel);
        previewModel.traverse(c => {
            if (c.geometry) c.geometry.dispose();
            if (c.material) c.material.dispose();
        });
    }
    previewModel = null;

    // 程序化模型分支
    const fn = window.ModelRegistry.getModel(m.cat, m.name);
    if (!fn) return;

    const detectedCamo = m.name.includes('黄色') ? 'desert' : 'green';
    previewModel = fn({ camoColor: detectedCamo });
    if (m.cat === 'tanks' && window.T34V16Builder && window.T34V16Builder.addTankWheelBolts) {
        window.T34V16Builder.addTankWheelBolts(previewModel);
    }
    // 统一按高度(Y)缩放到 1.5 米，底面贴地
    // 先归零模型的scale/position, 用原始包围盒算出正确缩放和偏移
    var oldScale2 = previewModel.scale.x;
    var oldPosY2 = previewModel.position.y;
    previewModel.scale.setScalar(1);
    previewModel.position.y = 0;
    previewModel.updateMatrixWorld(true);
    const bbox = new THREE.Box3().setFromObject(previewModel);
    const sz = new THREE.Vector3(); bbox.getSize(sz);
    if (sz.y > 0.001) {
        const s = 1.5 / sz.y;
        previewModel.scale.setScalar(s);
        const center = new THREE.Vector3(); bbox.getCenter(center);
        previewModel.position.set(-center.x * s, -bbox.min.y * s, -center.z * s);
    } else {
        // 复原
        previewModel.scale.setScalar(oldScale2);
        previewModel.position.y = oldPosY2;
    }
    previewScene.add(previewModel);
    previewLabel.textContent = '拖拽鼠标旋转模型 | 滚轮缩放 | 当前: ' + m.cat + '/' + m.name;
}

function updatePreviewCamera() {
    const x = previewRadius * Math.sin(previewPhi) * Math.cos(previewTheta);
    const y = previewRadius * Math.cos(previewPhi);
    const z = previewRadius * Math.sin(previewPhi) * Math.sin(previewTheta);
    previewCamera.position.set(x, y, z);
    previewCamera.lookAt(0, 1, 0);
}

function onPreviewMouseDown(e) {
    previewIsDragging = true;
    previewPrevMouse.x = e.clientX;
    previewPrevMouse.y = e.clientY;
}

function onPreviewMouseMove(e) {
    if (!previewIsDragging) return;
    const dx = e.clientX - previewPrevMouse.x;
    const dy = e.clientY - previewPrevMouse.y;
    previewTheta -= dx * PREVIEW_ROTATE_SPEED;
    previewPhi -= dy * PREVIEW_ROTATE_SPEED;
    previewPhi = Math.max(0.1, Math.min(Math.PI - 0.1, previewPhi));
    previewPrevMouse.x = e.clientX;
    previewPrevMouse.y = e.clientY;
}

function onPreviewMouseUp(e) {
    previewIsDragging = false;
}

function onPreviewWheel(e) {
    e.preventDefault();
    previewRadius += e.deltaY * PREVIEW_ZOOM_SPEED * 0.01;
    previewRadius = Math.max(PREVIEW_MIN_RADIUS, Math.min(PREVIEW_MAX_RADIUS, previewRadius));
}

function exitPreviewMode() {
    if (previewAnimId) { cancelAnimationFrame(previewAnimId); previewAnimId = null; }
    if (previewRenderer && previewRenderer.domElement) {
        previewRenderer.domElement.removeEventListener('mousedown', onPreviewMouseDown);
        previewRenderer.domElement.removeEventListener('wheel', onPreviewWheel);
    }
    window.removeEventListener('mousemove', onPreviewMouseMove);
    window.removeEventListener('mouseup', onPreviewMouseUp);
    if (previewModel && previewModel.parent) {
        previewModel.parent.remove(previewModel);
        previewModel.traverse(c => {
            if (c.geometry) c.geometry.dispose();
            if (c.material) c.material.dispose();
        });
        previewModel = null;
    }
    if (previewRenderer) {
        if (previewRenderer.domElement && previewRenderer.domElement.parentNode) {
            previewRenderer.domElement.parentNode.removeChild(previewRenderer.domElement);
        }
        previewRenderer.dispose(); previewRenderer = null;
    }
    previewContainer.classList.remove('active');
    menuOverlay.classList.remove('hidden');
}
