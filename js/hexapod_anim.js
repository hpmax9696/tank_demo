// 六足战车动画模块 — ES module
import * as THREE from 'three';

var M = window;
var S; // scene, 从 M 延迟获取
function getScene() { if (!S) S = M._scene; return S; }
var animPhase = function() { return M._animPhase ? M._animPhase() : 0; };
var animRefs;

// ── 常量 ──
var _hexaAnimNames = ['1/2 待机 (Idle)', '2/2 前进 (Walk)'];
var _hexaAnimDurations = [3500, 2400];
var _hexaLegPrefixes = ['左前','右前','左中','右中','左后','右后'];
var _HEXA_GAIT_SEC = 1.2;
var _HEXA_TRIPOD = { '左前':0, '右中':0, '左后':0, '右前':0.5, '左中':0.5, '右后':0.5 };

// ── 动画引用收集 ──
function _hexaCollectRefs() {
  animRefs = M._animRefs = { legs: [], hexRoot: null, restHexRootY: 0 };
  M.modelRoot.children.forEach(function(c) { if (c.name === '六足战车') animRefs.hexRoot = c; });
  var hexRoot = animRefs.hexRoot;
  if (!hexRoot) return;
  animRefs.restHexRootY = hexRoot.position.y;
  hexRoot.updateMatrixWorld(true);

  for (var li = 0; li < _hexaLegPrefixes.length; li++) {
    var prefix = _hexaLegPrefixes[li];
    var thighInfo = M.nodeMap.get(prefix + '大腿');
    var shinInfo  = M.nodeMap.get(prefix + '小腿');
    var ankleInfo = M.nodeMap.get(prefix + '脚踝');
    if (!thighInfo || !shinInfo || !ankleInfo) continue;

    var thighPivot = thighInfo.rotTarget;
    var shinPivot  = shinInfo.rotTarget;
    var anklePivot = ankleInfo.rotTarget;
    var thighGroup = thighInfo.group;

    var ankleWorld = new THREE.Vector3();
    anklePivot.getWorldPosition(ankleWorld);
    var ankleLocal = thighGroup.worldToLocal(ankleWorld);
    var hipLocalY = 0.35;

    var isMiddle = prefix.indexOf('中') >= 0;

    // 全部6条腿：动态插入脚跟pivot，提供第4DOF（前后蹬地）
    var heelPivot = null, footGroupForHeel = null;
    var footInfo2 = M.nodeMap.get(prefix + '脚掌');
    if (footInfo2 && anklePivot) {
      footGroupForHeel = footInfo2.group;
      heelPivot = new THREE.Group();
      heelPivot.name = prefix + '脚跟_pivot';
      heelPivot.position.copy(footGroupForHeel.position);
      footGroupForHeel.position.set(0, 0, 0);
      anklePivot.remove(footGroupForHeel);
      heelPivot.add(footGroupForHeel);
      anklePivot.add(heelPivot);
    }

    animRefs.legs.push({
      prefix: prefix,
      tripodOffset: _HEXA_TRIPOD[prefix] || 0,
      thighPivot: thighPivot, shinPivot: shinPivot, anklePivot: anklePivot,
      thighGroup: thighGroup,
      targetY0: ankleLocal.y - hipLocalY,
      targetZ: ankleLocal.z,
      footOrient0: thighPivot.rotation.x + shinPivot.rotation.x + anklePivot.rotation.x,
      restAnkleWorld: ankleWorld.clone(),
      restThighX: thighPivot.rotation.x,
      restShinX: shinPivot.rotation.x,
      restAnkleX: anklePivot.rotation.x,
      isMiddle: isMiddle,
      heelPivot: heelPivot,
      footGroupForHeel: footGroupForHeel
    });
  }

  animRefs._restAnkleWorlds = [];
  for (var li2 = 0; li2 < animRefs.legs.length; li2++) {
    animRefs._restAnkleWorlds.push(animRefs.legs[li2].restAnkleWorld.clone());
  }
}

// ── 每帧更新 ──
function _hexaUpdateFrame(dt, t, elapsed, duration) {
  animRefs = M._animRefs;
  if (!animRefs || !animRefs.legs || !animRefs.hexRoot) return;
  var L1 = 0.7, L2 = 0.55;
  var dMin = Math.abs(L1 - L2) + 0.01;
  var dMax = L1 + L2 - 0.001;
  var isWalk = (animPhase() === 2);

  var bodyBob = isWalk ? 0 : (1 - Math.cos(t * Math.PI * 2)) / 2 * 0.10;
  animRefs.hexRoot.position.y = animRefs.restHexRootY - bodyBob;

  var gaitCycles = duration / 1000 / _HEXA_GAIT_SEC;
  var stride = 0.14;
  var stepH = 0.18;

  if (isWalk) {
    if (!animRefs._walkTime) animRefs._walkTime = 0;
    animRefs._walkTime += dt;
    var avgSpeed = 2 * stride / _HEXA_GAIT_SEC;
    var speedVar = 1 + 0.12 * Math.sin(animRefs._walkTime * Math.PI / (_HEXA_GAIT_SEC / 2));
    var bodyFwdNow = (animRefs._prevBodyFwd || 0) + avgSpeed * speedVar * dt;
    var bodyFwdDelta = bodyFwdNow - (animRefs._prevBodyFwd || 0);
    animRefs._prevBodyFwd = bodyFwdNow;
    animRefs.hexRoot.translateX(-bodyFwdDelta);
  } else {
    animRefs._walkTime = 0; animRefs._prevBodyFwd = 0;
  }
  animRefs.hexRoot.updateMatrixWorld(true);

  var fwdWorld = new THREE.Vector3(-1, 0, 0);
  animRefs.hexRoot.localToWorld(fwdWorld);
  var hw = new THREE.Vector3(); animRefs.hexRoot.getWorldPosition(hw);
  fwdWorld.sub(hw).normalize();

  for (var li = 0; li < animRefs.legs.length; li++) {
    var leg = animRefs.legs[li];

    if (!isWalk) {
      var targetY = leg.targetY0 + bodyBob;
      var targetZ = leg.targetZ;
      var d0 = Math.sqrt(targetY*targetY + targetZ*targetZ);
      var dc0 = Math.max(dMin, Math.min(d0, dMax));
      var ck = (dc0*dc0 - L1*L1 - L2*L2) / (2*L1*L2);
      var km = Math.acos(Math.max(-1, Math.min(1, ck)));
      var ta = Math.atan2(-targetZ, -targetY);
      var ca = (L1*L1 + dc0*dc0 - L2*L2) / (2*L1*dc0);
      var al = Math.acos(Math.max(-1, Math.min(1, ca)));
      var ir0 = leg.prefix.indexOf('右') === 0;
      leg.thighPivot.rotation.x = ta + (ir0 ? al : -al);
      leg.shinPivot.rotation.x = ir0 ? -km : km;
      leg.anklePivot.rotation.x = leg.footOrient0 - (leg.thighPivot.rotation.x + leg.shinPivot.rotation.x);
      continue;
    }

    var gaitT = ((t * gaitCycles) + leg.tripodOffset) % 1;
    var inStance = (gaitT < 0.5);

    // 全部6腿：脚跟pivot绕Z提供第4DOF（前后蹬地）
    if (leg.heelPivot) {
      var heelA = 0.55;
      var ir2 = leg.prefix.indexOf('右') === 0;
      var hSign = ir2 ? 1 : -1;
      if (inStance) {
        leg.heelPivot.rotation.z = hSign * heelA * (1 - gaitT * 2);
      } else {
        leg.heelPivot.rotation.z = hSign * heelA * ((gaitT - 0.5) * 2);
      }
      leg._heelTheta = leg.heelPivot.rotation.z;
    } else {
      leg._heelTheta = 0;
    }

    if (leg._wasStance === undefined) {
      leg._wasStance = inStance;
      leg._plantWorld = new THREE.Vector3();
      leg.anklePivot.getWorldPosition(leg._plantWorld);
      leg._swingStart = leg._plantWorld.clone();
      leg._swingEnd = leg._plantWorld.clone();
      if (!inStance) {
        leg._swingEnd.x += fwdWorld.x * 2 * stride;
        leg._swingEnd.y += fwdWorld.y * 2 * stride;
        leg._swingEnd.z += fwdWorld.z * 2 * stride;
      }
    }

    if (inStance && !leg._wasStance) {
      leg._plantWorld = new THREE.Vector3();
      leg.anklePivot.getWorldPosition(leg._plantWorld);
    }
    if (!inStance && leg._wasStance) {
      leg._swingStart = leg._plantWorld.clone();
      leg._swingEnd = leg._plantWorld.clone();
      leg._swingEnd.x += fwdWorld.x * 2 * stride;
      leg._swingEnd.y += fwdWorld.y * 2 * stride;
      leg._swingEnd.z += fwdWorld.z * 2 * stride;
    }
    leg._wasStance = inStance;

    var ankleWorld, lift = 0;
    if (inStance) {
      ankleWorld = leg._plantWorld.clone();
    } else {
      var swingP = (gaitT - 0.5) * 2;
      ankleWorld = new THREE.Vector3().lerpVectors(leg._swingStart, leg._swingEnd, swingP);
      lift = Math.sin(swingP * Math.PI) * stepH;
    }
    ankleWorld.y += lift;
    if (leg.heelPivot && leg._heelTheta !== 0) {
      var footLen = 0.30;
      var ht = leg._heelTheta;
      var sinH = Math.sin(ht), cosH = Math.cos(ht);
      ankleWorld.z -= footLen * sinH;
      ankleWorld.y -= footLen * (1 - cosH);
    }

    var localTgt = leg.thighGroup.worldToLocal(ankleWorld);
    var targetY = localTgt.y - 0.35;
    var targetZ = localTgt.z;
    var d = Math.sqrt(targetY*targetY + targetZ*targetZ);
    var dc = Math.max(dMin, Math.min(d, dMax));

    var ck2 = (dc*dc - L1*L1 - L2*L2) / (2*L1*L2);
    var km2 = Math.acos(Math.max(-1, Math.min(1, ck2)));
    var ta2 = Math.atan2(-targetZ, -targetY);
    var ca2 = (L1*L1 + dc*dc - L2*L2) / (2*L1*dc);
    var al2 = Math.acos(Math.max(-1, Math.min(1, ca2)));
    var ir = leg.prefix.indexOf('右') === 0;
    leg.thighPivot.rotation.x = ta2 + (ir ? al2 : -al2);
    leg.shinPivot.rotation.x = ir ? -km2 : km2;
    leg.anklePivot.rotation.x = leg.footOrient0 - (leg.thighPivot.rotation.x + leg.shinPivot.rotation.x);
  }
}

function _hexaResetState() {
  animRefs = M._animRefs;
  if (!animRefs) return;
  if (animRefs.hexRoot) {
    animRefs.hexRoot.position.set(0, animRefs.restHexRootY, 0);
  }
  animRefs._walkTime = 0;
  animRefs._prevBodyFwd = 0;
  if (animRefs.legs) {
    for (var li = 0; li < animRefs.legs.length; li++) {
      var leg = animRefs.legs[li];
      leg.thighPivot.rotation.x = leg.restThighX;
      leg.shinPivot.rotation.x = leg.restShinX;
      leg.anklePivot.rotation.x = leg.restAnkleX;
      if (leg.heelPivot) leg.heelPivot.rotation.set(0, 0, 0);
    }
    animRefs.hexRoot.updateMatrixWorld(true);
    for (var li = 0; li < animRefs.legs.length; li++) {
      delete animRefs.legs[li]._wasStance;
      delete animRefs.legs[li]._plantWorld;
      delete animRefs.legs[li]._swingStart;
      delete animRefs.legs[li]._swingEnd;
    }
  }
}

function _hexaDestroyPivots() {
  animRefs = M._animRefs;
  if (!animRefs || !animRefs.legs) { M._animRefs = {}; return; }
  for (var li = 0; li < animRefs.legs.length; li++) {
    var leg = animRefs.legs[li];
    if (leg.heelPivot && leg.footGroupForHeel) {
      var hp = leg.heelPivot;
      var fg = leg.footGroupForHeel;
      var ap = leg.anklePivot;
      if (hp.parent) {
        hp.remove(fg);
        ap.add(fg);
        fg.position.copy(hp.position);
        hp.parent.remove(hp);
      }
    }
  }
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

// ═══════════════════════════════════════════
// 单腿IK测试（四关节万向跟，髋沿身体前进，脚掌XYZ全固定）
// ═══════════════════════════════════════════
var ikTestActive = false;
var ikTestAnimId = null;
var ikTestStartTime = 0;
var ikTestRestPoses = {};
var IK_TEST_LEG = '左前腿';
var IK_CYCLE_SEC = 4.0;
var IK_FWD_AMP = 0.25; // 身体前进振幅

function toggleHexIKTest() {
  if (M.currentModelType !== 'hexapod') return;
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
    var footInfo  = M.nodeMap.get(ikPrefix + '脚掌');
    var heelInfo  = M.nodeMap.get(ikPrefix + '脚踝_heelPivot');

    if (!thighInfo || !shinInfo || !ankleInfo || !footInfo) {
      console.warn('IK test: missing nodeMap entries for', ikPrefix);
      ikTestActive = false; return;
    }

    var legGroup      = thighInfo.group.parent; // leg root group
    var thighPivot    = thighInfo.rotTarget;
    var shinPivot     = shinInfo.rotTarget;
    var anklePivot    = ankleInfo.rotTarget;
    var heelPivot     = heelInfo ? heelInfo.rotTarget : null;
    var footMesh      = footInfo.mesh;
    var thighGroup    = thighInfo.group;

    // 保存静止姿态
    ikTestRestPoses.legGroupY = legGroup.rotation.y;
    ikTestRestPoses.thighX    = thighPivot.rotation.x;
    ikTestRestPoses.shinX     = shinPivot.rotation.x;
    ikTestRestPoses.ankleX    = anklePivot.rotation.x;
    ikTestRestPoses.heelX     = heelPivot ? heelPivot.rotation.x : 0;
    ikTestRestPoses.heelZ     = heelPivot ? heelPivot.rotation.z : 0;
    ikTestRestPoses.hexRootX  = hexRoot.position.x;
    ikTestRestPoses.hexRootY  = hexRoot.position.y;
    ikTestRestPoses.hexRootZ  = hexRoot.position.z;

    // 计算骨长（从实际模型读取）
    hexRoot.updateMatrixWorld(true);
    var hipW = new THREE.Vector3(); thighPivot.getWorldPosition(hipW);
    var kneeW = new THREE.Vector3(); shinPivot.getWorldPosition(kneeW);
    var ankleW = new THREE.Vector3(); anklePivot.getWorldPosition(ankleW);

    // 脚底世界位置
    var soleWorld = new THREE.Vector3();
    var fb = new THREE.Box3().setFromObject(footMesh);
    soleWorld.set((fb.min.x+fb.max.x)/2, fb.min.y, (fb.min.z+fb.max.z)/2);

    var L1 = hipW.distanceTo(kneeW);   // 大腿
    var L2 = kneeW.distanceTo(ankleW); // 小腿
    var L3 = ankleW.distanceTo(soleWorld); // 踝到脚底

    ikTestRestPoses.soleWorld  = soleWorld.clone();
    ikTestRestPoses.ankleWorld = ankleW.clone();
    ikTestRestPoses.hipWorld   = hipW.clone();
    ikTestRestPoses.L1 = L1;
    ikTestRestPoses.L2 = L2;
    ikTestRestPoses.L3 = L3;
    ikTestRestPoses.legGroup = legGroup;
    ikTestRestPoses.thighPivot = thighPivot;
    ikTestRestPoses.shinPivot  = shinPivot;
    ikTestRestPoses.anklePivot = anklePivot;
    ikTestRestPoses.heelPivot  = heelPivot;
    ikTestRestPoses.footMesh   = footMesh;
    ikTestRestPoses.thighGroup = thighGroup;
    ikTestRestPoses.hexRoot    = hexRoot;

    // 可视化标记
    function _ikDot(pos, color, name) {
      var g = new THREE.SphereGeometry(0.06,8,6);
      var m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({color:color}));
      m.position.copy(pos); m.name = name; getScene().add(m);
    }
    _ikDot(soleWorld, 0xff3333, '_ikSole');  // 🔴脚底目标（固定）
    _ikDot(hipW,    0x3388ff, '_ikHip');     // 🔵髋关节
    _ikDot(soleWorld, 0x33ff33, '_ikFoot');  // 🟢脚掌实时位置
    _ikDot(ankleW,  0xffaa00, '_ikAnkle');   // 🟠踝关节

    console.log('IK test: L1=' + L1.toFixed(3) + ' L2=' + L2.toFixed(3) + ' L3=' + L3.toFixed(3));

    // ── 身体前进方向向量（body -X = world -Z）──
    var fwdBody = new THREE.Vector3(-1, 0, 0);
    var rootW = new THREE.Vector3(); hexRoot.getWorldPosition(rootW);
    var fwdWorldPt = fwdBody.clone().applyMatrix4(hexRoot.matrixWorld);
    ikTestRestPoses.fwdWorld = fwdWorldPt.sub(rootW).normalize();

    ikTestStartTime = performance.now();
    var lastFwdDist = 0;

    // Pre-compute sole offset in heelPivot local space
    hexRoot.updateMatrixWorld(true);
    var soleInitW = new THREE.Vector3();
    var fbInit = new THREE.Box3().setFromObject(footMesh);
    soleInitW.set((fbInit.min.x+fbInit.max.x)/2, fbInit.min.y, (fbInit.min.z+fbInit.max.z)/2);
    var soleLocal = heelPivot ? heelPivot.worldToLocal(soleInitW.clone()) : new THREE.Vector3(0, -0.03, 0);

    function _soleW() {
      if (heelPivot && soleLocal) {
        return soleLocal.clone().applyMatrix4(heelPivot.matrixWorld);
      }
      var fb = new THREE.Box3().setFromObject(footMesh);
      return new THREE.Vector3((fb.min.x+fb.max.x)/2, fb.min.y, (fb.min.z+fb.max.z)/2);
    }
    function _worldX(j) {
      var q = new THREE.Quaternion(); j.getWorldQuaternion(q);
      return new THREE.Vector3(1,0,0).applyQuaternion(q).normalize();
    }
    function _worldY(j) {
      var q = new THREE.Quaternion(); j.getWorldQuaternion(q);
      return new THREE.Vector3(0,1,0).applyQuaternion(q).normalize();
    }
    function _worldZ(j) {
      var q = new THREE.Quaternion(); j.getWorldQuaternion(q);
      return new THREE.Vector3(0,0,1).applyQuaternion(q).normalize();
    }

    function ikLoop(now) {
      if (!ikTestActive) return;
      ikTestAnimId = requestAnimationFrame(ikLoop);
      var elapsed = (now - ikTestStartTime) / 1000;
      var t = (elapsed % IK_CYCLE_SEC) / IK_CYCLE_SEC;
      var fwdDist = Math.sin(t * Math.PI * 2) * IK_FWD_AMP;
      lastFwdDist = fwdDist;

      var fwd = ikTestRestPoses.fwdWorld;
      hexRoot.position.set(
        ikTestRestPoses.hexRootX + fwdDist * fwd.x,
        ikTestRestPoses.hexRootY,
        ikTestRestPoses.hexRootZ + fwdDist * fwd.z
      );
      hexRoot.updateMatrixWorld(true);

      var lp = ikTestRestPoses.legGroup;
      var tp = ikTestRestPoses.thighPivot;
      var sp = ikTestRestPoses.shinPivot;
      var ap = ikTestRestPoses.anklePivot;
      var hp = ikTestRestPoses.heelPivot;
      var footTarget = ikTestRestPoses.soleWorld;

      // === Position CCD: 40 iterations ===
      for (var iter = 0; iter < 40; iter++) {
        // Heel Z
        if (hp) {
          hexRoot.updateMatrixWorld(true);
          var hWz = new THREE.Vector3(); hp.getWorldPosition(hWz);
          var eWz = _soleW();
          var dEz = eWz.clone().sub(hWz).normalize();
          var dTz = footTarget.clone().sub(hWz).normalize();
          var axz = new THREE.Vector3().crossVectors(dEz, dTz);
          var lz = axz.length();
          if (lz > 0.0003) { axz.normalize(); hp.rotation.z += Math.atan2(lz, dEz.dot(dTz)) * axz.dot(_worldZ(hp)) * 0.5; }
        }
        // Heel X
        if (hp) {
          hexRoot.updateMatrixWorld(true);
          var hWx = new THREE.Vector3(); hp.getWorldPosition(hWx);
          var eWx = _soleW();
          var dEx = eWx.clone().sub(hWx).normalize();
          var dTx = footTarget.clone().sub(hWx).normalize();
          var axx = new THREE.Vector3().crossVectors(dEx, dTx);
          var lx = axx.length();
          if (lx > 0.0003) { axx.normalize(); hp.rotation.x += Math.atan2(lx, dEx.dot(dTx)) * axx.dot(_worldX(hp)) * 0.5; }
        }
        // Ankle X
        hexRoot.updateMatrixWorld(true);
        var aW = new THREE.Vector3(); ap.getWorldPosition(aW);
        var eWa = _soleW();
        var dEa = eWa.clone().sub(aW).normalize();
        var dTa = footTarget.clone().sub(aW).normalize();
        var axa = new THREE.Vector3().crossVectors(dEa, dTa);
        var la = axa.length();
        if (la > 0.0003) { axa.normalize(); ap.rotation.x += Math.atan2(la, dEa.dot(dTa)) * axa.dot(_worldX(ap)) * 0.5; }
        // Shin X
        hexRoot.updateMatrixWorld(true);
        var sW = new THREE.Vector3(); sp.getWorldPosition(sW);
        var eWs = _soleW();
        var dEs = eWs.clone().sub(sW).normalize();
        var dTs = footTarget.clone().sub(sW).normalize();
        var axs = new THREE.Vector3().crossVectors(dEs, dTs);
        var ls = axs.length();
        if (ls > 0.0003) { axs.normalize(); sp.rotation.x += Math.atan2(ls, dEs.dot(dTs)) * axs.dot(_worldX(sp)) * 0.5; }
        // Thigh X
        hexRoot.updateMatrixWorld(true);
        var tW = new THREE.Vector3(); tp.getWorldPosition(tW);
        var eWt = _soleW();
        var dEt = eWt.clone().sub(tW).normalize();
        var dTt = footTarget.clone().sub(tW).normalize();
        var axt = new THREE.Vector3().crossVectors(dEt, dTt);
        var lt = axt.length();
        if (lt > 0.0003) { axt.normalize(); tp.rotation.x += Math.atan2(lt, dEt.dot(dTt)) * axt.dot(_worldX(tp)) * 0.5; }
        // LegGroup Y (hip swing)
        hexRoot.updateMatrixWorld(true);
        var hW = new THREE.Vector3(); tp.getWorldPosition(hW);
        var eWh = _soleW();
        var dEh = eWh.clone().sub(hW).normalize();
        var dTh = footTarget.clone().sub(hW).normalize();
        var axh = new THREE.Vector3().crossVectors(dEh, dTh);
        var lh = axh.length();
        if (lh > 0.0003) { axh.normalize(); lp.rotation.y += Math.atan2(lh, dEh.dot(dTh)) * axh.dot(_worldY(lp)) * 0.5; }
      }

      // === Heel leveling: 10 iterations ===
      if (hp) {
        for (var li = 0; li < 10; li++) {
          hexRoot.updateMatrixWorld(true);
          var nLoc = new THREE.Vector3(0, -1, 0);
          var mw = footMesh.matrixWorld;
          var nW = new THREE.Vector3().copy(nLoc).applyMatrix4(mw)
            .sub(new THREE.Vector3().setFromMatrixPosition(mw)).normalize();
          var tgtN = new THREE.Vector3(0, 1, 0);
          var ndot = nW.dot(tgtN);
          if (ndot > 0.9999) break;
          var cAxis = new THREE.Vector3().crossVectors(nW, tgtN).normalize();
          var cAng = Math.acos(Math.max(-1, Math.min(1, ndot)));
          hp.rotation.x += cAng * cAxis.dot(_worldX(hp)) * 0.5;
          hp.rotation.z += cAng * cAxis.dot(_worldZ(hp)) * 0.5;
        }
      }

      // Update debug dots
      hexRoot.updateMatrixWorld(true);
      var hwD = new THREE.Vector3(); tp.getWorldPosition(hwD);
      var fwD = _soleW();
      var awD = new THREE.Vector3(); ap.getWorldPosition(awD);
      getScene().children.forEach(function(c) {
        if (c.name === '_ikHip') c.position.copy(hwD);
        if (c.name === '_ikFoot') c.position.copy(fwD);
        if (c.name === '_ikAnkle') c.position.copy(awD);
      });
    }
    ikTestAnimId = requestAnimationFrame(ikLoop);
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
    if (rp.heelPivot) { rp.heelPivot.rotation.x = rp.heelX || 0; rp.heelPivot.rotation.z = rp.heelZ || 0; }
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
