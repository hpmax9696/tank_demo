// 六足战车动画模块 — ES module
import * as THREE from 'three';

var M = window;
var S; // scene, 从 M 延迟获取
function getScene() { if (!S) S = M._scene; return S; }
var animPhase = function() { return M._animPhase ? M._animPhase() : 0; };
var animRefs;

// ── 常量 ──
var _hexaAnimNames = ['1/3 待机 (Idle)', '2/3 步行 (Walk)', '3/3 奔跑 (Run)'];
var _hexaAnimDurations = [3500, 1500, 800];
var _hexaLegPrefixes = ['左前','右前','左中','右中','左后','右后'];
// 三角步态分组: A组(相位0) vs B组(相位0.5)
var _TRIPOD_A = { '左前':true, '右中':true, '左后':true };
// Walk params: 步幅, 步高
var _WALK_STRIDE = 0.22, _WALK_STEP_H = 0.15;
// Run params
var _RUN_STRIDE = 0.38, _RUN_STEP_H = 0.24;

// ── 动画引用收集 ──
function _hexaCollectRefs() {
  animRefs = M._animRefs = { legs: [], hexRoot: null, restHexRootY: 0, restHexRootX: 0, restHexRootZ: 0 };
  M.modelRoot.children.forEach(function(c) { if (c.name === '六足战车') animRefs.hexRoot = c; });
  var hexRoot = animRefs.hexRoot;
  if (!hexRoot) return;
  animRefs.restHexRootY = hexRoot.position.y;
  animRefs.restHexRootX = hexRoot.position.x;
  animRefs.restHexRootZ = hexRoot.position.z;
  hexRoot.updateMatrixWorld(true);

  for (var li = 0; li < _hexaLegPrefixes.length; li++) {
    var prefix = _hexaLegPrefixes[li];
    var thighInfo = M.nodeMap.get(prefix + '大腿');
    var shinInfo  = M.nodeMap.get(prefix + '小腿');
    var ankleInfo = M.nodeMap.get(prefix + '脚踝');
    var spikeInfo = M.nodeMap.get(prefix + '尖刺足');
    if (!thighInfo || !shinInfo || !ankleInfo || !spikeInfo) continue;

    var thighPivot = thighInfo.rotTarget;
    var shinPivot  = shinInfo.rotTarget;
    var anklePivot = ankleInfo.rotTarget;
    var thighGroup = thighInfo.group;
    var spikeMesh  = spikeInfo.mesh;

    var sb = new THREE.Box3().setFromObject(spikeMesh);
    var tipWorld = new THREE.Vector3((sb.min.x+sb.max.x)/2, sb.min.y, (sb.min.z+sb.max.z)/2);
    var tipLocal = anklePivot.worldToLocal(tipWorld.clone());

    animRefs.legs.push({
      prefix: prefix,
      tripodA: !!_TRIPOD_A[prefix],
      thighPivot: thighPivot, shinPivot: shinPivot, anklePivot: anklePivot,
      thighGroup: thighGroup,
      restThighX: thighPivot.rotation.x, restShinX: shinPivot.rotation.x,
      restAnkleX: anklePivot.rotation.x, restLegY: thighInfo.group.parent.rotation.y,
      tipWorld: tipWorld.clone(), tipLocal: tipLocal,
      plantPos: null, swingFrom: null, swingTo: null
    });
  }
}

function _worldX(j) { var q=new THREE.Quaternion(); j.getWorldQuaternion(q); return new THREE.Vector3(1,0,0).applyQuaternion(q).normalize(); }
function _worldY(j) { var q=new THREE.Quaternion(); j.getWorldQuaternion(q); return new THREE.Vector3(0,1,0).applyQuaternion(q).normalize(); }

// CCD核心: 对一条腿做N次迭代
function _ccdLeg(leg, targetWorld, iters) {
  var lp = leg.thighGroup.parent, tp = leg.thighPivot;
  var sp = leg.shinPivot, ap = leg.anklePivot;
  ap.rotation.x = leg.restAnkleX;
  for (var iter = 0; iter < iters; iter++) {
    animRefs.hexRoot.updateMatrixWorld(true);
    var tipW = leg.tipLocal.clone().applyMatrix4(ap.matrixWorld);
    var d; var l;
    // Thigh X
    var tW = new THREE.Vector3(); tp.getWorldPosition(tW);
    d = tipW.clone().sub(tW).normalize(); var dt = targetWorld.clone().sub(tW).normalize();
    var ax = new THREE.Vector3().crossVectors(d, dt); l = ax.length();
    if (l > 0.0003) { ax.normalize(); tp.rotation.x += Math.atan2(l, d.dot(dt)) * ax.dot(_worldX(tp)) * 0.5; }
    // Shin X
    var sW = new THREE.Vector3(); sp.getWorldPosition(sW);
    d = tipW.clone().sub(sW).normalize(); dt = targetWorld.clone().sub(sW).normalize();
    ax = new THREE.Vector3().crossVectors(d, dt); l = ax.length();
    if (l > 0.0003) { ax.normalize(); sp.rotation.x += Math.atan2(l, d.dot(dt)) * ax.dot(_worldX(sp)) * 0.5; }
    // LegGroup Y
    var hW = new THREE.Vector3(); tp.getWorldPosition(hW);
    d = tipW.clone().sub(hW).normalize(); dt = targetWorld.clone().sub(hW).normalize();
    ax = new THREE.Vector3().crossVectors(d, dt); l = ax.length();
    if (l > 0.0003) { ax.normalize(); lp.rotation.y += Math.atan2(l, d.dot(dt)) * ax.dot(_worldY(lp)) * 0.5; }
    animRefs.hexRoot.updateMatrixWorld(true);
  }
}

// ── 每帧更新 ──
function _hexaUpdateFrame(dt, t, elapsed, duration) {
  animRefs = M._animRefs;
  if (!animRefs || !animRefs.legs || !animRefs.hexRoot) return;
  animRefs._animDuration = duration;

  // 自累积时间，不受动画循环重置影响
  if (animRefs._totalTime === undefined) animRefs._totalTime = 0;
  animRefs._totalTime += dt;
  var totalT = animRefs._totalTime;

  // 检测动画切换: duration变化 → 复位
  if (animRefs._lastDuration !== undefined && animRefs._lastDuration !== duration) {
    animRefs._gaitInit = false; animRefs._prevTotalDist = 0; animRefs._totalTime = 0;
    for (var li = 0; li < animRefs.legs.length; li++) {
      var lg = animRefs.legs[li];
      lg.plantPos = null; lg.swingFrom = null; lg.swingTo = null; lg._wasStance = undefined;
    }
    animRefs.hexRoot.position.set(animRefs.restHexRootX, animRefs.restHexRootY, animRefs.restHexRootZ);
  }
  animRefs._lastDuration = duration;

  // 用duration区分: 3500=Idle, 1500=Walk, 800=Run
  var isWalk = (duration === 1500), isRun = (duration === 800);
  animRefs._gaitActive = (isWalk || isRun);
  if (isWalk || isRun) {
    var stride = isWalk ? _WALK_STRIDE : _RUN_STRIDE;
    var stepH  = isWalk ? _WALK_STEP_H : _RUN_STEP_H;
    var ccdIters = isWalk ? 15 : 30; // 奔跑更多迭代防拖行
    if (!animRefs._gaitInit) _initGait(stride, stepH);
    _updateGait(totalT, stride, stepH, ccdIters);
  } else {
    // Idle: body bob + all tips fixed
    animRefs._gaitInit = false; animRefs._totalTime = 0;
    var bodyBob = (1 - Math.cos(t * Math.PI * 2)) / 2 * 0.08;
    animRefs.hexRoot.position.set(animRefs.restHexRootX, animRefs.restHexRootY - bodyBob, animRefs.restHexRootZ);
    animRefs.hexRoot.updateMatrixWorld(true);
    for (var li = 0; li < animRefs.legs.length; li++) {
      _ccdLeg(animRefs.legs[li], animRefs.legs[li].tipWorld, 15);
    }
  }
}

// Update _updateGait to use total time in seconds
function _initGait(stride, stepH) {
  animRefs.hexRoot.updateMatrixWorld(true);
  for (var li = 0; li < animRefs.legs.length; li++) {
    var leg = animRefs.legs[li];
    var tipW = leg.tipLocal.clone().applyMatrix4(leg.anklePivot.matrixWorld);
    leg.plantPos = tipW.clone();
    leg.swingFrom = null; leg.swingTo = null;
  }
  animRefs._prevTotalDist = 0;
  animRefs._gaitInit = true;
}

function _updateGait(totalTime, stride, stepH, ccdIters) {
  ccdIters = ccdIters || 15;
  // totalTime: 秒, 自累积不受循环重置影响
  // 步行: 周期1.2s/步态, 奔跑: 0.7s/步态 (A+B各半步)
  var gaitPeriod = stride > 0.30 ? 0.38 : 0.7;
  var gaitCycles = totalTime / gaitPeriod;
  var bodyBob = Math.sin(gaitCycles * Math.PI * 2) * 0.03;

  var fwdBody = new THREE.Vector3(-1, 0, 0);
  animRefs.hexRoot.localToWorld(fwdBody);
  var hw = new THREE.Vector3(); animRefs.hexRoot.getWorldPosition(hw);
  fwdBody.sub(hw).normalize();

  // 身体匀速前进
  var totalDist = gaitCycles * stride * 2;
  var deltaDist = totalDist - (animRefs._prevTotalDist || 0);
  animRefs._prevTotalDist = totalDist;
  animRefs.hexRoot.position.x += fwdBody.x * deltaDist;
  animRefs.hexRoot.position.z += fwdBody.z * deltaDist;
  animRefs.hexRoot.position.y = animRefs.restHexRootY - bodyBob;
  animRefs.hexRoot.updateMatrixWorld(true);

  for (var li = 0; li < animRefs.legs.length; li++) {
    var leg = animRefs.legs[li];
    var phaseOffset = leg.tripodA ? 0 : 0.5;
    var gaitT = (gaitCycles + phaseOffset) % 1;
    var inStance = (gaitT < 0.5);
    var stanceFrac = inStance ? gaitT * 2 : (gaitT - 0.5) * 2; // 0->1 within phase

    if (inStance) {
      // 支撑相: 锥尖锁定在plantPos
      if (!leg._wasStance) {
        // 刚进入支撑相，记录plant
        animRefs.hexRoot.updateMatrixWorld(true);
        leg.plantPos = leg.tipLocal.clone().applyMatrix4(leg.anklePivot.matrixWorld);
      }
      _ccdLeg(leg, leg.plantPos, ccdIters);
    } else {
      // 摆动相: 锥尖从plantPos移动到下一个plantPos
      if (leg._wasStance) {
        // 刚进入摆动相，计算目标
        leg.swingFrom = leg.plantPos.clone();
        leg.swingTo = leg.plantPos.clone();
        leg.swingTo.x += fwdBody.x * stride * 2;
        leg.swingTo.z += fwdBody.z * stride * 2;
      }
      // Lerp
      var target = new THREE.Vector3().lerpVectors(leg.swingFrom, leg.swingTo, stanceFrac);
      target.y += Math.sin(stanceFrac * Math.PI) * stepH; // 抬腿弧线
      _ccdLeg(leg, target, ccdIters);
    }
    leg._wasStance = inStance;
  }
}

function _hexaResetState() {
  animRefs = M._animRefs;
  if (!animRefs) return;
  var isGait = animRefs._gaitActive;
  if (animRefs.hexRoot && !isGait) {
    animRefs.hexRoot.position.set(animRefs.restHexRootX, animRefs.restHexRootY, animRefs.restHexRootZ);
  }
  if (!isGait) {
    animRefs._gaitInit = false;
    animRefs._prevTotalDist = 0;
    animRefs._totalTime = 0;
  }
  if (animRefs.legs) {
    for (var li = 0; li < animRefs.legs.length; li++) {
      var leg = animRefs.legs[li];
      leg.thighPivot.rotation.x = leg.restThighX;
      leg.shinPivot.rotation.x = leg.restShinX;
      leg.anklePivot.rotation.x = leg.restAnkleX;
      leg.thighGroup.parent.rotation.y = leg.restLegY;
      if (!isGait) {
        leg.plantPos = null; leg.swingFrom = null; leg.swingTo = null;
        leg._wasStance = undefined;
      }
    }
    animRefs.hexRoot.updateMatrixWorld(true);
  }
}

function _hexaDestroyPivots() {
  M._animRefs = {};
}

// ── 导出动画接口 ──
M.HexapodAnims = {
  names: _hexaAnimNames,
  durations: _hexaAnimDurations,
  collectRefs: _hexaCollectRefs,
  updateFrame: _hexaUpdateFrame,
  resetState: _hexaResetState,
  destroyPivots: _hexaDestroyPivots,
  restorePlates: function() {}
};
// 主模块先于本模块执行，updateAnimButton()调用时HexapodAnims尚未就绪
// 本模块加载后补调一次，使动画展台按钮正确亮起
setTimeout(function() {
  var btn = document.getElementById('toggle-anim');
  if (btn && window.HexapodAnims) {
    btn.disabled = false; btn.title = '';
    var ikb = document.getElementById('toggle-iktest');
    if (ikb) ikb.disabled = false;
  }
}, 100);
// ═══════════════════════════════════════════
// 单腿IK测试（4关节CCD，锥尖固定，髋Y轴下蹲起）
// ═══════════════════════════════════════════
var ikTestActive = false;
var ikTestAnimId = null;
var ikTestStartTime = 0;
var ikTestRestPoses = {};
var IK_TEST_LEG = '左前腿';
var IK_CYCLE_SEC = 4.0;
var IK_AMP = 0.20;
var IK_MODE = 1; // 1=Y轴下蹲, 2=X轴左右, 3=Z轴前后

// 重启IK测试（模式/腿切换时调用）
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

// 动态创建IK模式+腿选择下拉菜单
function _ensureIKSelectors() {
  if (document.getElementById('ik-mode-select')) return;
  var btn = document.getElementById('toggle-iktest');
  if (!btn) return;

  var css = 'margin-left:4px;padding:2px 4px;font-size:11px;background:#222;color:#ccc;border:1px solid #555;border-radius:3px;';

  // 腿选择器
  var legSel = document.createElement('select');
  legSel.id = 'ik-leg-select';
  legSel.style.cssText = css;
  legSel.innerHTML = '<option value="左前腿">左前腿</option><option value="左中腿">左中腿</option><option value="左后腿">左后腿</option>';
  legSel.value = IK_TEST_LEG;
  legSel.addEventListener('change', function() {
    IK_TEST_LEG = legSel.value;
    _restartIKTest();
  });

  // 模式选择器
  var modeSel = document.createElement('select');
  modeSel.id = 'ik-mode-select';
  modeSel.style.cssText = css;
  modeSel.innerHTML = '<option value="1">Y轴下蹲</option><option value="2">X轴左右</option><option value="3">Z轴前后</option>';
  modeSel.value = IK_MODE;
  modeSel.addEventListener('change', function() {
    IK_MODE = parseInt(modeSel.value);
    _restartIKTest();
  });

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

    // 隐藏其他腿
    hexRoot.children.forEach(function(child) {
      if (child.name !== IK_TEST_LEG) {
        child.traverse(function(n) { if (n !== child && n.visible !== undefined) n.userData._ikWasVisible = n.visible; });
        child.visible = false;
      }
    });

    // ── 收集引用 ──
    ikTestRestPoses = {};
    var ikPrefix = IK_TEST_LEG.slice(0, -1);
    var thighInfo = M.nodeMap.get(ikPrefix + '大腿');
    var shinInfo  = M.nodeMap.get(ikPrefix + '小腿');
    var ankleInfo = M.nodeMap.get(ikPrefix + '脚踝');
    var spikeInfo = M.nodeMap.get(ikPrefix + '尖刺足');

    if (!thighInfo || !shinInfo || !ankleInfo || !spikeInfo) {
      console.warn('IK test: missing nodeMap entries for', ikPrefix);
      ikTestActive = false; return;
    }

    var legGroup    = thighInfo.group.parent;
    var thighPivot  = thighInfo.rotTarget;
    var shinPivot   = shinInfo.rotTarget;
    var anklePivot  = ankleInfo.rotTarget;
    var spikeMesh   = spikeInfo.mesh;
    var thighGroup  = thighInfo.group;

    // 保存静止姿态
    ikTestRestPoses.legGroupY = legGroup.rotation.y;
    ikTestRestPoses.thighX    = thighPivot.rotation.x;
    ikTestRestPoses.shinX     = shinPivot.rotation.x;
    ikTestRestPoses.ankleX    = anklePivot.rotation.x;
    ikTestRestPoses.hexRootX  = hexRoot.position.x;
    ikTestRestPoses.hexRootY  = hexRoot.position.y;
    ikTestRestPoses.hexRootZ  = hexRoot.position.z;

    // 计算骨长和锥尖世界位置
    hexRoot.updateMatrixWorld(true);
    var hipW = new THREE.Vector3(); thighPivot.getWorldPosition(hipW);
    var kneeW = new THREE.Vector3(); shinPivot.getWorldPosition(kneeW);
    var ankleW = new THREE.Vector3(); anklePivot.getWorldPosition(ankleW);

    // 锥尖世界位置（spike bounding box 最低点）
    var spikeBox = new THREE.Box3().setFromObject(spikeMesh);
    var tipWorld = new THREE.Vector3(
      (spikeBox.min.x + spikeBox.max.x) / 2,
      spikeBox.min.y,
      (spikeBox.min.z + spikeBox.max.z) / 2
    );

    var L1 = hipW.distanceTo(kneeW);
    var L2 = kneeW.distanceTo(ankleW);
    var L3 = ankleW.distanceTo(tipWorld);

    ikTestRestPoses.tipWorld   = tipWorld.clone();
    ikTestRestPoses.ankleWorld = ankleW.clone();
    ikTestRestPoses.hipWorld   = hipW.clone();
    ikTestRestPoses.L1 = L1;
    ikTestRestPoses.L2 = L2;
    ikTestRestPoses.L3 = L3;
    ikTestRestPoses.legGroup   = legGroup;
    ikTestRestPoses.thighPivot = thighPivot;
    ikTestRestPoses.shinPivot  = shinPivot;
    ikTestRestPoses.anklePivot = anklePivot;
    ikTestRestPoses.spikeMesh  = spikeMesh;
    ikTestRestPoses.thighGroup = thighGroup;
    ikTestRestPoses.hexRoot    = hexRoot;

    // 可视化标记
    function _ikDot(pos, color, name) {
      var g = new THREE.SphereGeometry(0.06, 8, 6);
      var m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: color }));
      m.position.copy(pos); m.name = name; getScene().add(m);
    }
    _ikDot(tipWorld, 0xff3333, '_ikTip');    // red: spike tip (fixed)
    _ikDot(hipW,    0x3388ff, '_ikHip');     // blue: hip
    _ikDot(ankleW,  0xffaa00, '_ikAnkle');   // orange: ankle

    console.log('IK squat: L1=' + L1.toFixed(3) + ' L2=' + L2.toFixed(3) + ' L3=' + L3.toFixed(3));

    ikTestStartTime = performance.now();

    // Pre-compute tip offset in anklePivot local space
    hexRoot.updateMatrixWorld(true);
    var tipInitW = new THREE.Vector3();
    var sbInit = new THREE.Box3().setFromObject(spikeMesh);
    tipInitW.set((sbInit.min.x+sbInit.max.x)/2, sbInit.min.y, (sbInit.min.z+sbInit.max.z)/2);
    var tipLocal = anklePivot.worldToLocal(tipInitW.clone());

    function _tipW() {
      return tipLocal.clone().applyMatrix4(anklePivot.matrixWorld);
    }
    function _worldX(j) {
      var q = new THREE.Quaternion(); j.getWorldQuaternion(q);
      return new THREE.Vector3(1,0,0).applyQuaternion(q).normalize();
    }
    function _worldY(j) {
      var q = new THREE.Quaternion(); j.getWorldQuaternion(q);
      return new THREE.Vector3(0,1,0).applyQuaternion(q).normalize();
    }

    function ikLoop(now) {
      if (!ikTestActive) return;
      ikTestAnimId = requestAnimationFrame(ikLoop);
      var elapsed = (now - ikTestStartTime) / 1000;
      var t = (elapsed % IK_CYCLE_SEC) / IK_CYCLE_SEC;
      var wave = Math.sin(t * Math.PI * 2) * IK_AMP;
      var mode = IK_MODE;
      if (mode === 1) {
        hexRoot.position.set(ikTestRestPoses.hexRootX, ikTestRestPoses.hexRootY + wave, ikTestRestPoses.hexRootZ);
      } else if (mode === 2) {
        hexRoot.position.set(ikTestRestPoses.hexRootX + wave, ikTestRestPoses.hexRootY, ikTestRestPoses.hexRootZ);
      } else {
        hexRoot.position.set(ikTestRestPoses.hexRootX, ikTestRestPoses.hexRootY, ikTestRestPoses.hexRootZ + wave);
      }
      hexRoot.updateMatrixWorld(true);

      var lp = ikTestRestPoses.legGroup;
      var tp = ikTestRestPoses.thighPivot;
      var sp = ikTestRestPoses.shinPivot;
      var ap = ikTestRestPoses.anklePivot;
      var tipTarget = ikTestRestPoses.tipWorld;

      // 踝关节锁死，只由膝+髋+摆角完成下蹲
      ap.rotation.x = ikTestRestPoses.ankleX;

      // 膝预驱动：下蹲越深膝越弯
      var kneeBias = (mode === 1) ? Math.abs(wave) * 0.8 : 0;
      sp.rotation.x += kneeBias * 0.10;

      // === CCD: thigh.X -> shin.X -> legGroup.Y (3 joints, 踝锁死) ===
      for (var iter = 0; iter < 40; iter++) {
        // Thigh X
        hexRoot.updateMatrixWorld(true);
        var tW = new THREE.Vector3(); tp.getWorldPosition(tW);
        var eWt = _tipW();
        var dEt = eWt.clone().sub(tW).normalize();
        var dTt = tipTarget.clone().sub(tW).normalize();
        var axt = new THREE.Vector3().crossVectors(dEt, dTt);
        var lt = axt.length();
        if (lt > 0.0003) { axt.normalize(); tp.rotation.x += Math.atan2(lt, dEt.dot(dTt)) * axt.dot(_worldX(tp)) * 0.5; }
        // Shin X
        hexRoot.updateMatrixWorld(true);
        var sW = new THREE.Vector3(); sp.getWorldPosition(sW);
        var eWs = _tipW();
        var dEs = eWs.clone().sub(sW).normalize();
        var dTs = tipTarget.clone().sub(sW).normalize();
        var axs = new THREE.Vector3().crossVectors(dEs, dTs);
        var ls = axs.length();
        if (ls > 0.0003) { axs.normalize(); sp.rotation.x += Math.atan2(ls, dEs.dot(dTs)) * axs.dot(_worldX(sp)) * 0.5; }
        // LegGroup Y
        hexRoot.updateMatrixWorld(true);
        var hW = new THREE.Vector3(); tp.getWorldPosition(hW);
        var eWh = _tipW();
        var dEh = eWh.clone().sub(hW).normalize();
        var dTh = tipTarget.clone().sub(hW).normalize();
        var axh = new THREE.Vector3().crossVectors(dEh, dTh);
        var lh = axh.length();
        if (lh > 0.0003) { axh.normalize(); lp.rotation.y += Math.atan2(lh, dEh.dot(dTh)) * axh.dot(_worldY(lp)) * 0.5; }
        // 踝锁死，不参与CCD
      }

      // Update debug dots
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
    // ── 停止 ──
    btn.classList.remove('active');
    btn.textContent = '\u{1f9bf} 单腿IK测试';
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
