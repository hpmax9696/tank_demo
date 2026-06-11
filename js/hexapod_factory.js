/**
 * 六足战车模型工厂适配器 v0.58.0
 *
 * 薄封装 HexapodCore，处理 nodeMap 引用收集 + bodyWriter=true + 工厂独有工具。
 * 替代原 hexapod_anim.js，保留 IK测试/转弯验证/武器校准。
 *
 * 与 model_factory.html 的接口:
 *   window.HexapodAnims = { names, durations, collectRefs, updateFrame, resetState, destroyPivots }
 */
import * as THREE from 'three';

var M = window;
var S;
function getScene() { if (!S) S = M._scene; return S; }

var CORE = window.HexapodCore;
var CFG = window.HexapodConfig;

// ── 动画名称 (模型工厂用中文标签) ──
var _hexaAnimNames = [
  '1/23 待机 (Idle)', '2/23 步行 (Walk)', '3/23 奔跑 (Run)',
  '4/23 步行后退 (Walk Back)', '5/23 奔跑后退 (Run Back)',
  '6/23 左平移 (Strafe Left)', '7/23 右平移 (Strafe Right)',
  '8/23 静态左转 (Static Turn L)', '9/23 静态右转 (Static Turn R)',
  '10/23 步行左转 (Walk Turn L)', '11/23 步行右转 (Walk Turn R)',
  '12/23 平移左转 (Strafe Turn L)', '13/23 平移右转 (Strafe Turn R)',
  '14/23 后退左转 (Walk Back Turn L)', '15/23 后退右转 (Walk Back Turn R)',
  '16/23 奔跑左转 (Run Turn L)', '17/23 奔跑右转 (Run Turn R)',
  '18/23 奔退左转 (Run Back Turn L)', '19/23 奔退右转 (Run Back Turn R)',
  '20/23 奔跑左平移 (Strafe Run L)', '21/23 奔跑右平移 (Strafe Run R)',
  '22/23 受击踉跄 (Stagger)', '23/23 死亡 (Death)'
];
var _hexaAnimDurations = [3500, 1500, 800, 1600, 900, 1700, 1700, 2000, 2000, 2000, 2000, 2000, 2000, 2000, 2000, 1200, 1200, 1300, 1300, 1000, 1000, 1100, 2500];

// ── 当前上下文 ──
var ctx = null;
var _animRefs = null; // 向后兼容

// ═══════════════════════════════════════════
//  引用收集 (nodeMap → legRefs)
// ═══════════════════════════════════════════
function collectRefs() {
  var hexRoot = null;
  M.modelRoot.children.forEach(function(c) { if (c.name === '六足战车') hexRoot = c; });
  if (!hexRoot) return;
  var legCfg = CFG.LEG_CONFIG;
  var prefixes = legCfg.prefixes;
  var tripodA = legCfg.tripodA;

  var legRefs = [];
  for (var li = 0; li < prefixes.length; li++) {
    var prefix = prefixes[li];
    var thighInfo = M.nodeMap.get(prefix + '大腿');
    var shinInfo  = M.nodeMap.get(prefix + '小腿');
    var ankleInfo = M.nodeMap.get(prefix + '脚踝');
    var spikeInfo = M.nodeMap.get(prefix + '尖刺足');
    if (!thighInfo || !shinInfo || !ankleInfo || !spikeInfo) continue;

    var hipJoint = thighInfo.group.parent; // legGroup
    var thighPv = thighInfo.rotTarget;
    var shinPv = shinInfo.rotTarget;
    var anklePv = ankleInfo.rotTarget;

    legRefs.push({
      prefix: prefix,
      tripodA: !!tripodA[prefix],
      hipJoint: hipJoint,
      thighPivot: thighPv,
      shinPivot: shinPv,
      anklePivot: anklePv,
      spikeMesh: spikeInfo.mesh,
      restHip: hipJoint.rotation.y,
      restThigh: thighPv.rotation.x,
      restShin: shinPv.rotation.x,
      restAnkle: anklePv.rotation.x,
      _shinSign: shinPv.rotation.x > 0 ? 1 : -1,
      _yLimit: (prefix.indexOf('中') >= 0) ? legCfg.yLimitMiddle : legCfg.yLimitFront
    });
  }

  // 武器引用收集
  var weaponNames = ['左加特林', '右加特林', '左导弹巢', '右导弹巢'];
  var weaponRefs = [];
  for (var wi = 0; wi < weaponNames.length; wi++) {
    var wg = null, mount = null;
    hexRoot.traverse(function(n) {
      if (n.name === weaponNames[wi]) wg = n;
      if (n.name === weaponNames[wi].replace('加特林', '加特林支架').replace('导弹巢', '导弹支架')) mount = n;
    });
    if (wg && mount) {
      weaponRefs.push({
        name: weaponNames[wi],
        weaponGroup: wg,
        mount: mount,
        isGatling: weaponNames[wi].indexOf('加特林') >= 0
      });
    }
  }

  // 枪管簇创建
  var oldClusters = _animRefs ? _animRefs.barrelClusters : null;
  if (oldClusters) {
    for (var ci = 0; ci < oldClusters.length; ci++) {
      var oc = oldClusters[ci];
      if (oc && oc.parent) {
        while (oc.children.length > 0) oc.parent.add(oc.children[0]);
        oc.parent.remove(oc);
      }
    }
  }
  var barrelClusters = [];
  for (var wi2 = 0; wi2 < weaponRefs.length; wi2++) {
    var wp = weaponRefs[wi2];
    if (!wp.isGatling) continue;
    var pivotGroup = wp.weaponGroup.userData.pivot;
    if (!pivotGroup) continue;
    var barrelGroups = [];
    for (var bi = pivotGroup.children.length - 1; bi >= 0; bi--) {
      var child = pivotGroup.children[bi];
      if (child.name && child.name.indexOf('枪管') >= 0) barrelGroups.push(child);
    }
    if (barrelGroups.length === 0) continue;
    var cluster = new THREE.Group();
    cluster.name = wp.name + '_barrelCluster';
    pivotGroup.add(cluster);
    for (var bi2 = 0; bi2 < barrelGroups.length; bi2++) {
      cluster.add(barrelGroups[bi2]);
    }
    barrelClusters.push(cluster);
  }

  // 初始化 core context
  ctx = CORE.initContext(legRefs, hexRoot, {
    hipAxis: 'y',
    groundHeightFn: null, // 模型工厂无地形
    bodyWriter: true
  });
  // 存储武器引用和枪管簇
  ctx._weaponRefs = weaponRefs;
  ctx._barrelClusters = barrelClusters;

  // 向后兼容
  _animRefs = M._animRefs = {
    legs: ctx.legs.map(function(l) { return {
      thighPivot: l.thighPivot, shinPivot: l.shinPivot,
      anklePivot: l.anklePivot, thighGroup: l.thighPivot.parent.parent,
      restThighX: l.restThigh, restShinX: l.restShin,
      restAnkleX: l.restAnkle, restLegY: l.restHip,
      tipLocal: l.tipLocal,
      tipWorld: l.tipLocal.clone().applyMatrix4(l.anklePivot.matrixWorld),
      _initFootDist: l._initFootDist, _shinSign: l._shinSign, _yLimit: l._yLimit,
      plantPos: l.plantPos, swingFrom: l.swingFrom, swingTo: l.swingTo
    }; }),
    hexRoot: hexRoot,
    restHexRootY: ctx.restPosY,
    restHexRootX: hexRoot.position.x,
    restHexRootZ: hexRoot.position.z,
    restHexRootRotY: hexRoot.rotation.y,
    weapons: weaponRefs,
    barrelClusters: barrelClusters,
    _gaitActive: false, _gaitInit: false,
    _totalTime: 0, _prevTotalDist: 0,
    _staggerActive: false, _staggerDone: false,
    _deathActive: false, _deathDone: false,
    _curAnimIndex: 0, _frameDt: 0.016,
    _lastDuration: undefined, _lastAnimIndex: -1,
    _animDuration: 0
  };
}

// ═══════════════════════════════════════════
//  每帧更新 (被 model_factory.html 调用)
// ═══════════════════════════════════════════
function updateFrame(dt, t, elapsed, duration, animIndex) {
  if (!ctx || !ctx.legs.length) return;

  // 踉跄/死亡进行中
  if (ctx._staggerActive) {
    CORE._staggerUpdate(ctx, dt);
    CORE.updateGatlingSpin(ctx._barrelClusters, dt, 3);
    return;
  }
  if (ctx._deathActive) {
    CORE._deathUpdate(ctx, dt);
    CORE.updateGatlingSpin(ctx._barrelClusters, dt, 3);
    return;
  }

  // 踉跄动画 (index 21): 一次性触发
  if (animIndex === 21 && !ctx._staggerDone) {
    var staggerDirs = [
      new THREE.Vector3(0,0,1), new THREE.Vector3(1,0,0),
      new THREE.Vector3(-1,0,0), new THREE.Vector3(0,0,-1),
      new THREE.Vector3(1,0,1).normalize(), new THREE.Vector3(-1,0,1).normalize()
    ];
    var sidx = (ctx._staggerDirIdx || 0) % staggerDirs.length;
    ctx._staggerDirIdx = sidx + 1;
    CORE.triggerStagger(ctx, staggerDirs[sidx], 0.7);
    return;
  }
  // 死亡动画 (index 22): 一次性触发
  if (animIndex === 22 && !ctx._deathDone) {
    CORE.triggerDeath(ctx, ctx._weaponRefs);
    return;
  }
  // 死亡已完成: 冻结姿态
  if (animIndex === 22 && ctx._deathDone) return;

  ctx._curAnimIndex = animIndex;

  // 动画切换检测
  var switched = (_animRefs._lastDuration !== undefined && _animRefs._lastDuration !== duration)
              || (_animRefs._lastAnimIndex !== undefined && _animRefs._lastAnimIndex !== animIndex);
  if (switched) {
    CORE.resetPose(ctx);
    if (ctx.root) {
      ctx.root.position.set(ctx.restPosX, ctx.restPosY, ctx.restPosZ);
      ctx.root.rotation.set(0, ctx.restRotY, 0);
    }
  }
  _animRefs._lastDuration = duration;
  _animRefs._lastAnimIndex = animIndex;
  _animRefs._frameDt = dt;

  var dir = CFG.animField(animIndex, 2);
  var cfgTurnRate = CFG.animField(animIndex, 3);
  var isIdle = (dir === 0 && cfgTurnRate === 0);

  if (!isIdle) {
    if (!ctx._gaitInit) CORE._initGait(ctx);
    CORE.stepGait(ctx, dt, { animIndex: animIndex, spinRPS: 3 });
  } else {
    CORE.stepIdle(ctx, dt, t);
  }

  CORE.updateGatlingSpin(ctx._barrelClusters, dt, 3);

  // 同步 _animRefs 状态
  _animRefs._gaitActive = ctx._gaitInit;
  _animRefs._gaitInit = ctx._gaitInit;
  _animRefs._totalTime = ctx._totalTime;
  _animRefs._staggerActive = ctx._staggerActive;
  _animRefs._staggerDone = ctx._staggerDone;
  _animRefs._deathActive = ctx._deathActive;
  _animRefs._deathDone = ctx._deathDone;
  _animRefs._curAnimIndex = animIndex;
}

// ═══════════════════════════════════════════
//  重置 / 销毁
// ═══════════════════════════════════════════
function resetState() {
  if (ctx) {
    CORE._cleanupWeaponPivots(ctx);
    if (ctx._deathActive) { ctx._deathActive = false; ctx._deathDone = true; ctx.deathState = null; }
    var wasGait = ctx._gaitInit; // 在 resetPose 清除之前保存
    CORE.resetPose(ctx);
    // 步态动画循环时不复位身体位置/朝向（无缝衔接）；Idle/初始时复位
    if (!wasGait && ctx.root) {
      ctx.root.position.set(ctx.restPosX, ctx.restPosY, ctx.restPosZ);
      ctx.root.rotation.set(0, ctx.restRotY, 0);
    }
  }
}

function destroyPivots() {
  if (ctx) {
    CORE._cleanupWeaponPivots(ctx);
    if (ctx.deathState) ctx.deathState = null;
  }
  ctx = null;
  _animRefs = M._animRefs = {};
}

// ── 导出 —— 模型工厂接口 ──
M.HexapodAnims = {
  names: _hexaAnimNames,
  durations: _hexaAnimDurations,
  directions: [], turnRates: [],
  collectRefs: collectRefs,
  updateFrame: updateFrame,
  resetState: resetState,
  destroyPivots: destroyPivots,
  restorePlates: function() {}
};

// ── 踉跄/死亡全局触发 (向后兼容) ──
M.triggerHexStagger = function(hitDir, force) {
  if (!ctx) { collectRefs(); }
  if (ctx) CORE.triggerStagger(ctx, hitDir, force);
};
M.triggerHexDeath = function() {
  if (!ctx) { collectRefs(); }
  if (ctx) CORE.triggerDeath(ctx, ctx._weaponRefs);
};

// ── 启用动画按钮 ──
setTimeout(function() {
  var btn = document.getElementById('toggle-anim');
  if (btn && window.HexapodAnims) { btn.disabled = false; btn.title = ''; }
  var ikb = document.getElementById('toggle-iktest');
  if (ikb) ikb.disabled = false;
  var ttb = document.getElementById('toggle-turntest');
  if (ttb) ttb.disabled = false;
}, 100);

// ═══════════════════════════════════════════
//  单腿IK测试 (工厂独有工具)
// ═══════════════════════════════════════════
var ikTestActive = false;
var ikTestAnimId = null;
var ikTestStartTime = 0;
var ikTestRestPoses = {};
var IK_TEST_LEG = '左前腿';
var IK_CYCLE_SEC = 4.0;
var IK_AMP = 0.20;
var IK_MODE = 1;

function _restartIKTest() {
  if (!ikTestActive) return;
  var wasActive = ikTestActive;
  ikTestActive = false;
  if (ikTestAnimId) { cancelAnimationFrame(ikTestAnimId); ikTestAnimId = null; }
  var sc = getScene();
  for (var i = sc.children.length - 1; i >= 0; i--) {
    var c = sc.children[i];
    if (c.name && c.name.indexOf('_ik') === 0) { sc.remove(c); if(c.geometry)c.geometry.dispose(); if(c.material)c.material.dispose(); }
  }
  var rp = ikTestRestPoses;
  if (rp.hexRoot) {
    rp.hexRoot.position.set(rp.hexRootX, rp.hexRootY, rp.hexRootZ);
    rp.hexRoot.children.forEach(function(child) {
      child.visible = true;
      child.traverse(function(n) {
        if (n.userData._ikWasVisible !== undefined) { n.visible = n.userData._ikWasVisible; delete n.userData._ikWasVisible; }
      });
    });
  }
  if (rp.legGroup && rp.legGroupY !== undefined) rp.legGroup.rotation.y = rp.legGroupY;
  if (rp.thighPivot && rp.thighX !== undefined) rp.thighPivot.rotation.x = rp.thighX;
  if (rp.shinPivot && rp.shinX !== undefined) rp.shinPivot.rotation.x = rp.shinX;
  if (rp.anklePivot && rp.ankleX !== undefined) rp.anklePivot.rotation.x = rp.ankleX;
  if (rp.hexRoot) rp.hexRoot.updateMatrixWorld(true);
  ikTestActive = wasActive;
  ikTestStartTime = performance.now();
}

function _ensureIKSelectors() {
  if (document.getElementById('ik-mode-select')) return;
  var btn = document.getElementById('toggle-iktest');
  if (!btn) return;
  var css = 'margin-left:4px;padding:2px 4px;font-size:11px;background:#222;color:#ccc;border:1px solid #555;border-radius:3px;';
  var legSel = document.createElement('select');
  legSel.id = 'ik-leg-select';
  legSel.style.cssText = css;
  legSel.innerHTML = '<option value="左前腿">左前腿</option><option value="左中腿">左中腿</option><option value="左后腿">左后腿</option>';
  legSel.value = IK_TEST_LEG;
  legSel.addEventListener('change', function() { IK_TEST_LEG = legSel.value; _restartIKTest(); });
  var modeSel = document.createElement('select');
  modeSel.id = 'ik-mode-select';
  modeSel.style.cssText = css;
  modeSel.innerHTML = '<option value="1">Y轴下蹲</option><option value="2">X轴左右</option><option value="3">Z轴前后</option>';
  modeSel.value = IK_MODE;
  modeSel.addEventListener('change', function() { IK_MODE = parseInt(modeSel.value); _restartIKTest(); });
  btn.parentNode.insertBefore(legSel, btn.nextSibling);
  btn.parentNode.insertBefore(modeSel, legSel.nextSibling);
}

function toggleHexIKTest() {
  if (M.currentModelType !== 'hexapod') return;
  _ensureIKSelectors();
  ikTestActive = !ikTestActive;
  var btn = document.getElementById('toggle-iktest');
  if (!btn) return;

  if (ikTestActive) {
    btn.classList.add('active');
    btn.textContent = '⏹ 停止IK测试';

    var hexRoot = null;
    M.modelRoot.children.forEach(function(c) { if (c.name === '六足战车') hexRoot = c; });
    if (!hexRoot) { ikTestActive = false; return; }

    hexRoot.children.forEach(function(child) {
      if (child.name !== IK_TEST_LEG) {
        child.traverse(function(n) { if (n !== child && n.visible !== undefined) n.userData._ikWasVisible = n.visible; });
        child.visible = false;
      }
    });

    ikTestRestPoses = {};
    var ikPrefix = IK_TEST_LEG.slice(0, -1);
    var thighInfo = M.nodeMap.get(ikPrefix + '大腿');
    var shinInfo  = M.nodeMap.get(ikPrefix + '小腿');
    var ankleInfo = M.nodeMap.get(ikPrefix + '脚踝');
    var spikeInfo = M.nodeMap.get(ikPrefix + '尖刺足');
    if (!thighInfo || !shinInfo || !ankleInfo || !spikeInfo) { ikTestActive = false; return; }

    var legGroup = thighInfo.group.parent;
    var thighPivot = thighInfo.rotTarget;
    var shinPivot = shinInfo.rotTarget;
    var anklePivot = ankleInfo.rotTarget;
    var spikeMesh = spikeInfo.mesh;

    ikTestRestPoses.legGroupY = legGroup.rotation.y;
    ikTestRestPoses.thighX = thighPivot.rotation.x;
    ikTestRestPoses.shinX = shinPivot.rotation.x;
    ikTestRestPoses.ankleX = anklePivot.rotation.x;
    ikTestRestPoses.hexRootX = hexRoot.position.x;
    ikTestRestPoses.hexRootY = hexRoot.position.y;
    ikTestRestPoses.hexRootZ = hexRoot.position.z;
    ikTestRestPoses.legGroup = legGroup;
    ikTestRestPoses.thighPivot = thighPivot;
    ikTestRestPoses.shinPivot = shinPivot;
    ikTestRestPoses.anklePivot = anklePivot;
    ikTestRestPoses.spikeMesh = spikeMesh;
    ikTestRestPoses.hexRoot = hexRoot;

    hexRoot.updateMatrixWorld(true);
    var spikeBox = new THREE.Box3().setFromObject(spikeMesh);
    var tipWorld = new THREE.Vector3((spikeBox.min.x+spikeBox.max.x)/2, spikeBox.min.y, (spikeBox.min.z+spikeBox.max.z)/2);
    var hipW = new THREE.Vector3(); thighPivot.getWorldPosition(hipW);
    var ankleW = new THREE.Vector3(); anklePivot.getWorldPosition(ankleW);
    ikTestRestPoses.tipWorld = tipWorld.clone();

    function _ikDot(pos, color, name) {
      var g = new THREE.SphereGeometry(0.06, 8, 6);
      var m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: color }));
      m.position.copy(pos); m.name = name; getScene().add(m);
    }
    _ikDot(tipWorld, 0xff3333, '_ikTip');
    _ikDot(hipW, 0x3388ff, '_ikHip');
    _ikDot(ankleW, 0xffaa00, '_ikAnkle');

    ikTestStartTime = performance.now();
    var tipLocal = anklePivot.worldToLocal(tipWorld.clone());

    function _tipW() { return tipLocal.clone().applyMatrix4(anklePivot.matrixWorld); }
    function _worldX(j) { var q=new THREE.Quaternion(); j.getWorldQuaternion(q); return new THREE.Vector3(1,0,0).applyQuaternion(q).normalize(); }
    function _worldY(j) { var q=new THREE.Quaternion(); j.getWorldQuaternion(q); return new THREE.Vector3(0,1,0).applyQuaternion(q).normalize(); }

    function ikLoop(now) {
      if (!ikTestActive) return;
      ikTestAnimId = requestAnimationFrame(ikLoop);
      var elapsed = (now - ikTestStartTime) / 1000;
      var t = (elapsed % IK_CYCLE_SEC) / IK_CYCLE_SEC;
      var wave = Math.sin(t * Math.PI * 2) * IK_AMP;
      var mode = IK_MODE;
      if (mode === 1) hexRoot.position.set(ikTestRestPoses.hexRootX, ikTestRestPoses.hexRootY + wave, ikTestRestPoses.hexRootZ);
      else if (mode === 2) hexRoot.position.set(ikTestRestPoses.hexRootX + wave, ikTestRestPoses.hexRootY, ikTestRestPoses.hexRootZ);
      else hexRoot.position.set(ikTestRestPoses.hexRootX, ikTestRestPoses.hexRootY, ikTestRestPoses.hexRootZ + wave);
      hexRoot.updateMatrixWorld(true);

      var lp = legGroup, tp = thighPivot, sp = shinPivot, ap = anklePivot;
      var tipTarget = ikTestRestPoses.tipWorld;
      ap.rotation.x = ikTestRestPoses.ankleX;
      var kneeBias = (mode === 1) ? Math.abs(wave) * 0.8 : 0;
      sp.rotation.x += kneeBias * 0.10;

      for (var iter = 0; iter < 40; iter++) {
        hexRoot.updateMatrixWorld(true);
        var tW = new THREE.Vector3(); tp.getWorldPosition(tW);
        var eWt = _tipW();
        var dEt = eWt.clone().sub(tW).normalize();
        var dTt = tipTarget.clone().sub(tW).normalize();
        var axt = new THREE.Vector3().crossVectors(dEt, dTt);
        var lt = axt.length();
        if (lt > 0.0003) { axt.normalize(); tp.rotation.x += Math.atan2(lt, dEt.dot(dTt)) * axt.dot(_worldX(tp)) * 0.5; }
        hexRoot.updateMatrixWorld(true);
        var sW = new THREE.Vector3(); sp.getWorldPosition(sW);
        var eWs = _tipW();
        var dEs = eWs.clone().sub(sW).normalize();
        var dTs = tipTarget.clone().sub(sW).normalize();
        var axs = new THREE.Vector3().crossVectors(dEs, dTs);
        var ls = axs.length();
        if (ls > 0.0003) { axs.normalize(); sp.rotation.x += Math.atan2(ls, dEs.dot(dTs)) * axs.dot(_worldX(sp)) * 0.5; }
        hexRoot.updateMatrixWorld(true);
        var hW = new THREE.Vector3(); tp.getWorldPosition(hW);
        var eWh = _tipW();
        var dEh = eWh.clone().sub(hW).normalize();
        var dTh = tipTarget.clone().sub(hW).normalize();
        var axh = new THREE.Vector3().crossVectors(dEh, dTh);
        var lh = axh.length();
        if (lh > 0.0003) { axh.normalize(); lp.rotation.y += Math.atan2(lh, dEh.dot(dTh)) * axh.dot(_worldY(lp)) * 0.5; }
      }

      hexRoot.updateMatrixWorld(true);
      var hwD = new THREE.Vector3(); tp.getWorldPosition(hwD);
      var twD = _tipW();
      var awD = new THREE.Vector3(); ap.getWorldPosition(awD);
      getScene().children.forEach(function(c) {
        if (c.name === '_ikHip') c.position.copy(hwD);
        if (c.name === '_ikTip') c.position.copy(twD);
        if (c.name === '_ikAnkle') c.position.copy(awD);
      });
    }
    ikTestAnimId = requestAnimationFrame(ikLoop);
  } else {
    btn.classList.remove('active');
    btn.textContent = '🧟 单腿IK测试';
    if (ikTestAnimId) { cancelAnimationFrame(ikTestAnimId); ikTestAnimId = null; }
    var sc = getScene();
    for (var i = sc.children.length - 1; i >= 0; i--) {
      var c = sc.children[i];
      if (c.name && c.name.indexOf('_ik') === 0) { sc.remove(c); if(c.geometry)c.geometry.dispose(); if(c.material)c.material.dispose(); }
    }
    var rp = ikTestRestPoses;
    if (rp.hexRoot) {
      rp.hexRoot.position.set(rp.hexRootX, rp.hexRootY, rp.hexRootZ);
      rp.hexRoot.children.forEach(function(child) {
        child.visible = true;
        child.traverse(function(n) { if (n.userData._ikWasVisible !== undefined) { n.visible = n.userData._ikWasVisible; delete n.userData._ikWasVisible; } });
      });
    }
    if (rp.legGroup && rp.legGroupY !== undefined) rp.legGroup.rotation.y = rp.legGroupY;
    if (rp.thighPivot && rp.thighX !== undefined) rp.thighPivot.rotation.x = rp.thighX;
    if (rp.shinPivot && rp.shinX !== undefined) rp.shinPivot.rotation.x = rp.shinX;
    if (rp.anklePivot && rp.ankleX !== undefined) rp.anklePivot.rotation.x = rp.ankleX;
    if (rp.hexRoot) rp.hexRoot.updateMatrixWorld(true);
  }
}

M.toggleHexIKTest = toggleHexIKTest;
M._hexIKActive = function() { return ikTestActive; };

// 事件绑定
document.addEventListener('DOMContentLoaded', function() {
  var ikb = document.getElementById('toggle-iktest');
  if (ikb) ikb.addEventListener('click', toggleHexIKTest);
});
setTimeout(function() {
  var ikb = document.getElementById('toggle-iktest');
  if (ikb) ikb.addEventListener('click', toggleHexIKTest);
}, 0);

// ═══════════════════════════════════════════
//  转弯验证 (工厂独有工具)
// ═══════════════════════════════════════════
var turnTestActive = false;
var turnTestAnimId = null;
var turnTestRestPoses = {};
var turnTestState = {};
var _TURN_TEST_RATE = 0.3;
var _TURN_TEST_STRIDE = 0.05;
var _TURN_TEST_CYCLE = 3.5;

function _turnTestDot(pos, color, name) {
  var g = new THREE.SphereGeometry(0.06, 8, 6);
  var m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: color }));
  m.position.copy(pos); m.name = name; getScene().add(m); return m;
}
function _turnTestUpdateDot(name, pos) {
  var sc = getScene();
  for (var i = 0; i < sc.children.length; i++) {
    if (sc.children[i].name === name) { sc.children[i].position.copy(pos); return; }
  }
}
function _turnTestCleanupDots() {
  var sc = getScene();
  for (var i = sc.children.length - 1; i >= 0; i--) {
    var c = sc.children[i];
    if (c.name && c.name.indexOf('_tt') === 0) { sc.remove(c); if(c.geometry)c.geometry.dispose(); if(c.material)c.material.dispose(); }
  }
}

function toggleHexTurnTest() {
  if (M.currentModelType !== 'hexapod') return;
  if (ikTestActive) toggleHexIKTest();
  turnTestActive = !turnTestActive;
  var btn = document.getElementById('toggle-turntest');
  if (!btn) return;

  if (turnTestActive) {
    btn.classList.add('active');
    btn.textContent = '⏹ 停止转弯验证';

    var hexRoot = null;
    M.modelRoot.children.forEach(function(c) { if (c.name === '六足战车') hexRoot = c; });
    if (!hexRoot) { turnTestActive = false; return; }
    turnTestRestPoses.hexRoot = hexRoot;
    turnTestRestPoses.hexRootX = hexRoot.position.x;
    turnTestRestPoses.hexRootY = hexRoot.position.y;
    turnTestRestPoses.hexRootZ = hexRoot.position.z;
    turnTestRestPoses.hexRootRotY = hexRoot.rotation.y;

    var keepNames = ['车体', '左前腿', '右前腿', '左中腿', '右中腿', '左后腿', '右后腿'];
    turnTestRestPoses.hiddenParts = [];
    hexRoot.children.forEach(function(child) {
      if (keepNames.indexOf(child.name) < 0) { turnTestRestPoses.hiddenParts.push(child); child.visible = false; }
    });
    var bodyGroup = null;
    hexRoot.children.forEach(function(c) { if (c.name === '车体') bodyGroup = c; });
    if (bodyGroup) {
      bodyGroup.children.forEach(function(c) {
        if (c.name !== '下车体') { c.visible = false; turnTestRestPoses.hiddenParts.push(c); }
      });
    }

    var prefixes = CFG.LEG_CONFIG.prefixes;
    turnTestState.legs = [];
    for (var li = 0; li < prefixes.length; li++) {
      var prefix = prefixes[li];
      var thighInfo = M.nodeMap.get(prefix + '大腿');
      var shinInfo = M.nodeMap.get(prefix + '小腿');
      var ankleInfo = M.nodeMap.get(prefix + '脚踝');
      var spikeInfo = M.nodeMap.get(prefix + '尖刺足');
      if (!thighInfo || !shinInfo || !ankleInfo || !spikeInfo) continue;
      var sb = new THREE.Box3().setFromObject(spikeInfo.mesh);
      var tipWorld = new THREE.Vector3((sb.min.x+sb.max.x)/2, sb.min.y, (sb.min.z+sb.max.z)/2);
      var tipLocal = ankleInfo.rotTarget.worldToLocal(tipWorld.clone());
      turnTestState.legs.push({
        prefix: prefix,
        thighPivot: thighInfo.rotTarget, shinPivot: shinInfo.rotTarget,
        anklePivot: ankleInfo.rotTarget, thighGroup: thighInfo.group,
        restThighX: thighInfo.rotTarget.rotation.x, restShinX: shinInfo.rotTarget.rotation.x,
        restAnkleX: ankleInfo.rotTarget.rotation.x, restLegY: thighInfo.group.parent.rotation.y,
        tipWorld: tipWorld.clone(), tipLocal: tipLocal,
        plantPos: null, swingFrom: null, swingTo: null,
        tripodA: (['左前','右中','左后'].indexOf(prefix) >= 0)
      });
    }

    turnTestState.cycleTimer = 0;
    turnTestState.startTime = performance.now();
    turnTestState.totalTime = 0;
    hexRoot.updateMatrixWorld(true);
    for (var li2 = 0; li2 < turnTestState.legs.length; li2++) {
      var lg = turnTestState.legs[li2];
      lg.plantPos = lg.tipLocal.clone().applyMatrix4(lg.anklePivot.matrixWorld);
      lg._groundY = lg.plantPos.y;
    }

    var bc = new THREE.Vector3(); hexRoot.getWorldPosition(bc);
    _turnTestDot(bc, 0x3388ff, '_ttBodyCenter');
    for (var li3 = 0; li3 < turnTestState.legs.length; li3++) {
      _turnTestDot(turnTestState.legs[li3].plantPos, 0xff3333, '_ttPlant_' + li3);
      _turnTestDot(turnTestState.legs[li3].plantPos, 0x33ff33, '_ttSwing_' + li3);
    }

    // 创建临时 core context 用于CCD
    turnTestState._tmpCtx = { root: hexRoot, legs: turnTestState.legs.map(function(l) { return {
      thighPivot: l.thighPivot, shinPivot: l.shinPivot, anklePivot: l.anklePivot,
      hipJoint: l.thighGroup.parent, tipLocal: l.tipLocal,
      restAnkle: l.restAnkleX, restHip: l.restLegY, _shinSign: 1, _yLimit: 0.7
    }; }), hipAxis: 'y', groundHeightFn: null, bodyWriter: true };

    turnTestAnimId = requestAnimationFrame(_turnTestLoop);
  } else {
    btn.classList.remove('active');
    btn.textContent = '🔄 转弯验证';
    if (turnTestAnimId) { cancelAnimationFrame(turnTestAnimId); turnTestAnimId = null; }
    _turnTestCleanupDots();
    var rp = turnTestRestPoses;
    if (rp.hexRoot) {
      rp.hexRoot.position.set(rp.hexRootX, rp.hexRootY, rp.hexRootZ);
      rp.hexRoot.rotation.y = rp.hexRootRotY;
      rp.hexRoot.updateMatrixWorld(true);
    }
    if (rp.hiddenParts) rp.hiddenParts.forEach(function(c) { c.visible = true; });
    if (turnTestState.legs) {
      for (var li4 = 0; li4 < turnTestState.legs.length; li4++) {
        var l4 = turnTestState.legs[li4];
        l4.thighPivot.rotation.x = l4.restThighX;
        l4.shinPivot.rotation.x = l4.restShinX;
        l4.anklePivot.rotation.x = l4.restAnkleX;
        l4.thighGroup.parent.rotation.y = l4.restLegY;
      }
      rp.hexRoot.updateMatrixWorld(true);
    }
    turnTestState = {};
  }
}

function _turnTestLoop(now) {
  if (!turnTestActive) return;
  turnTestAnimId = requestAnimationFrame(_turnTestLoop);
  var dt = Math.min((now - turnTestState.startTime) / 1000, 0.1);
  turnTestState.startTime = now;
  turnTestState.totalTime += dt;
  var totalT = turnTestState.totalTime;

  var hexRoot = turnTestRestPoses.hexRoot;
  var turnRate = _TURN_TEST_RATE;
  hexRoot.rotation.y += turnRate * dt;
  hexRoot.updateMatrixWorld(true);

  var bodyC = new THREE.Vector3(); hexRoot.getWorldPosition(bodyC);
  _turnTestUpdateDot('_ttBodyCenter', bodyC);
  var gaitCycles = totalT / _TURN_TEST_CYCLE;

  for (var i = 0; i < turnTestState.legs.length; i++) {
    var leg = turnTestState.legs[i];
    leg.anklePivot.rotation.x = leg.restAnkleX;
    var phaseOffset = leg.tripodA ? 0 : 0.5;
    var gaitT = (gaitCycles + phaseOffset) % 1;
    var inStance = (gaitT < 0.5);
    var stanceFrac = inStance ? gaitT * 2 : (gaitT - 0.5) * 2;

    if (inStance) {
      if (!leg._wasStance) { hexRoot.updateMatrixWorld(true); leg.plantPos = leg.tipLocal.clone().applyMatrix4(leg.anklePivot.matrixWorld); _turnTestUpdateDot('_ttPlant_' + i, leg.plantPos); }
      CORE._ccdLeg(turnTestState._tmpCtx, turnTestState._tmpCtx.legs[i], leg.plantPos, 20 + Math.round(Math.abs(turnRate) * 13), 0.8);
    } else {
      if (leg._wasStance) {
        leg.swingFrom = leg.plantPos.clone();
        var toFoot = leg.plantPos.clone().sub(bodyC); toFoot.y = 0;
        var footDist = toFoot.length() || 1;
        var footAngle = Math.atan2(toFoot.z, toFoot.x);
        var newAngle = footAngle - turnRate * _TURN_TEST_CYCLE;
        leg.swingTo = bodyC.clone();
        leg.swingTo.x += Math.cos(newAngle) * footDist;
        leg.swingTo.z += Math.sin(newAngle) * footDist;
        leg.swingTo.y = leg._groundY;
        _turnTestUpdateDot('_ttSwing_' + i, leg.swingTo);
      }
      if (!leg.swingFrom) { leg.swingFrom = leg.plantPos.clone(); leg.swingTo = leg.plantPos.clone(); }
      var tgt = new THREE.Vector3().lerpVectors(leg.swingFrom, leg.swingTo, stanceFrac);
      tgt.y += Math.sin(stanceFrac * Math.PI) * 0.12;
      CORE._ccdLeg(turnTestState._tmpCtx, turnTestState._tmpCtx.legs[i], tgt, 20 + Math.round(Math.abs(turnRate) * 13), 0.8);
    }
    leg._wasStance = inStance;
  }
}

M.toggleHexTurnTest = toggleHexTurnTest;

document.addEventListener('DOMContentLoaded', function() {
  var ttb = document.getElementById('toggle-turntest');
  if (ttb) ttb.addEventListener('click', toggleHexTurnTest);
});
setTimeout(function() {
  var ttb = document.getElementById('toggle-turntest');
  if (ttb) ttb.addEventListener('click', toggleHexTurnTest);
}, 0);

// ═══════════════════════════════════════════
//  射击校准 (工厂独有工具)
// ═══════════════════════════════════════════
var weaponCalActive = false;
var weaponCalData = null;
var _WC_MOUNT_NAMES = ['右加特林支架', '右导弹支架'];
var _WC_BARREL_NAMES = ['右加特林枪管1', '右导弹管1'];
var _WC_LINE_LEN = 2.5;

function toggleWeaponCalibrate() {
  if (weaponCalActive) {
    var btn2 = document.getElementById('toggle-weaponcal');
    if (btn2) { btn2.classList.remove('active'); btn2.textContent = '🎯 射击校准'; }
    var pnl2 = document.getElementById('weaponcal-panel');
    if (pnl2) pnl2.style.display = 'none';
    var btn3 = document.getElementById('toggle-weaponcal');
    if (btn3) { btn3.classList.remove('active'); btn3.textContent = '🎯 射击校准'; }
    _weaponCalCleanup();
    return;
  }
  if (M.currentModelType !== 'hexapod') return;
  weaponCalActive = true;
  var btn = document.getElementById('toggle-weaponcal');
  if (btn) { btn.classList.add('active'); btn.textContent = '⏹ 停止校准'; }
  var pnl = document.getElementById('weaponcal-panel');
  if (pnl) pnl.style.display = 'flex';
  weaponCalData = { muzzles: [], gatPitch: 0, misPitch: 0 };
  var hexRoot = null;
  M.modelRoot.children.forEach(function(c) { if (c.name === '六足战车') hexRoot = c; });
  if (!hexRoot) { weaponCalActive = false; return; }
  hexRoot.updateMatrixWorld(true);

  var mountNodes = {};
  var barrelDirs = {};
  hexRoot.traverse(function(node) {
    var mi = _WC_MOUNT_NAMES.indexOf(node.name);
    if (mi >= 0) { mountNodes[mi] = node; node.updateMatrixWorld(); }
    var bi = _WC_BARREL_NAMES.indexOf(node.name);
    if (bi >= 0) { node.updateMatrixWorld(); var wq = new THREE.Quaternion(); node.getWorldQuaternion(wq); barrelDirs[bi] = new THREE.Vector3(0, 1, 0).applyQuaternion(wq).normalize(); }
  });

  weaponCalData.pivots = [];
  for (var ni = 0; ni < _WC_MOUNT_NAMES.length; ni++) {
    var mount = mountNodes[ni];
    var dir = barrelDirs[ni];
    if (!mount || !dir) continue;
    var wp = new THREE.Vector3(); mount.getWorldPosition(wp);
    var wq = new THREE.Quaternion(); mount.getWorldQuaternion(wq);
    var lz = new THREE.Vector3(0, 0, 1).applyQuaternion(wq).normalize();
    var isGat = mount.name.indexOf('加特林') >= 0;
    var color = isGat ? 0xffaa00 : 0xff6666;

    var lineGeo = new THREE.BufferGeometry().setFromPoints([wp.clone(), wp.clone().addScaledVector(dir, _WC_LINE_LEN)]);
    var line = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: color }));
    line.name = '_wc_aim_' + ni; getScene().add(line);
    var dot = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 4), new THREE.MeshBasicMaterial({ color: color }));
    dot.position.copy(wp); dot.name = '_wc_dot_' + ni; getScene().add(dot);

    var weaponGroup = mount.parent;
    var grandParent = weaponGroup.parent;
    var mountLocal = mount.position.clone();
    var origMatrix = weaponGroup.matrix.clone();
    var gpWorldPos = new THREE.Vector3(); grandParent.getWorldPosition(gpWorldPos);
    var gpWorldQuat = new THREE.Quaternion(); grandParent.getWorldQuaternion(gpWorldQuat);
    var mountInGP = wp.clone().sub(gpWorldPos).applyQuaternion(gpWorldQuat.clone().invert());
    var lzInGP = lz.clone().applyQuaternion(gpWorldQuat.clone().invert()).normalize();

    var pivot = new THREE.Group();
    pivot.name = '_wc_pivot_' + ni;
    grandParent.remove(weaponGroup);
    grandParent.add(pivot);
    pivot.position.copy(mountInGP);
    pivot.rotation.set(0, 0, 0);
    pivot.add(weaponGroup);
    weaponGroup.position.copy(mountLocal).multiplyScalar(-1);
    grandParent.updateMatrixWorld(true);

    weaponCalData.pivots.push({ pivot: pivot, weaponGroup: weaponGroup, grandParent: grandParent, origMatrix: origMatrix, lz: lzInGP });
    weaponCalData.muzzles.push({ mount: mount, muzzle: wp, dir: dir, lz: lz, line: line, dot: dot, name: mount.name, isGat: isGat });
  }

  if (weaponCalData.muzzles.length === 0) { weaponCalActive = false; if (btn) btn.classList.remove('active'); return; }
  var gatSlider = document.getElementById('weaponcal-gat');
  var misSlider = document.getElementById('weaponcal-mis');
  if (gatSlider) { gatSlider.value = 0; gatSlider.oninput = function() { _onCalSlider('gatling', this.value); }; }
  if (misSlider) { misSlider.value = 0; misSlider.oninput = function() { _onCalSlider('missile', this.value); }; }
}

function _onCalSlider(type, valDeg) {
  var deg = parseFloat(valDeg);
  var rad = deg * Math.PI / 180;
  if (!weaponCalData) return;
  if (type === 'gatling') { weaponCalData.gatPitch = rad; var el = document.getElementById('weaponcal-val-gat'); if (el) el.textContent = deg + '°'; }
  else { weaponCalData.misPitch = rad; var el2 = document.getElementById('weaponcal-val-mis'); if (el2) el2.textContent = deg + '°'; }
  if (weaponCalData.pivots) {
    for (var p = 0; p < weaponCalData.pivots.length; p++) {
      var pv = weaponCalData.pivots[p];
      var pname = pv.weaponGroup.name || '';
      var isGat = pname.indexOf('加特林') >= 0;
      var pitch = isGat ? (weaponCalData.gatPitch || 0) : (weaponCalData.misPitch || 0);
      pv.pivot.quaternion.setFromAxisAngle(pv.lz, pitch);
    }
  }
  for (var i = 0; i < weaponCalData.muzzles.length; i++) {
    var m = weaponCalData.muzzles[i];
    var pitch2 = m.isGat ? (weaponCalData.gatPitch || 0) : (weaponCalData.misPitch || 0);
    _updateOneMuzzleLine(m, pitch2);
  }
}

function _updateOneMuzzleLine(m, pitchRad) {
  var cosA = Math.cos(pitchRad), sinA = Math.sin(pitchRad);
  var kxv = new THREE.Vector3().crossVectors(m.lz, m.dir);
  var kdv = m.lz.dot(m.dir);
  var newDir = new THREE.Vector3().addScaledVector(m.dir, cosA).addScaledVector(kxv, sinA).addScaledVector(m.lz, kdv * (1 - cosA)).normalize();
  var pts = [m.muzzle.clone(), m.muzzle.clone().addScaledVector(newDir, _WC_LINE_LEN)];
  m.line.geometry.dispose();
  m.line.geometry = new THREE.BufferGeometry().setFromPoints(pts);
}

function _weaponCalCleanup() {
  weaponCalActive = false;
  if (weaponCalData && weaponCalData.pivots) {
    for (var p = 0; p < weaponCalData.pivots.length; p++) {
      var pv = weaponCalData.pivots[p];
      pv.pivot.remove(pv.weaponGroup);
      pv.grandParent.add(pv.weaponGroup);
      pv.weaponGroup.matrix.copy(pv.origMatrix);
      pv.weaponGroup.matrix.decompose(pv.weaponGroup.position, pv.weaponGroup.quaternion, pv.weaponGroup.scale);
      pv.grandParent.remove(pv.pivot);
    }
  }
  var sc = getScene();
  for (var i = sc.children.length - 1; i >= 0; i--) {
    var c = sc.children[i];
    if (c.name && c.name.indexOf('_wc_') === 0) { sc.remove(c); if (c.geometry) c.geometry.dispose(); if (c.material) c.material.dispose(); }
  }
  weaponCalData = null;
}

M.toggleWeaponCalibrate = toggleWeaponCalibrate;

document.addEventListener('DOMContentLoaded', function() {
  var wcb = document.getElementById('toggle-weaponcal');
  if (wcb) wcb.addEventListener('click', toggleWeaponCalibrate);
});
setTimeout(function() {
  var wcb = document.getElementById('toggle-weaponcal');
  if (wcb) wcb.addEventListener('click', toggleWeaponCalibrate);
}, 0);
