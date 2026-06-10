// 六足战车动画模块 — ES module
import * as THREE from 'three';

var M = window;
var S; // scene, 从 M 延迟获取
function getScene() { if (!S) S = M._scene; return S; }
var animPhase = function() { return M._animPhase ? M._animPhase() : 0; };
var animRefs;

// ── 常量 ──
var _hexaAnimNames = ['1/23 待机 (Idle)', '2/23 步行 (Walk)', '3/23 奔跑 (Run)', '4/23 步行后退 (Walk Back)', '5/23 奔跑后退 (Run Back)', '6/23 左平移 (Strafe Left)', '7/23 右平移 (Strafe Right)', '8/23 静态左转 (Static Turn L)', '9/23 静态右转 (Static Turn R)', '10/23 步行左转 (Walk Turn L)', '11/23 步行右转 (Walk Turn R)', '12/23 平移左转 (Strafe Turn L)', '13/23 平移右转 (Strafe Turn R)', '14/23 后退左转 (Walk Back Turn L)', '15/23 后退右转 (Walk Back Turn R)', '16/23 奔跑左转 (Run Turn L)', '17/23 奔跑右转 (Run Turn R)', '18/23 奔退左转 (Run Back Turn L)', '19/23 奔退右转 (Run Back Turn R)', '20/23 奔跑左平移 (Strafe Run L)', '21/23 奔跑右平移 (Strafe Run R)', '22/23 受击踉跄 (Stagger)', '23/23 死亡 (Death)'];
var _hexaAnimDurations = [3500, 1500, 800, 1600, 900, 1700, 1700, 2000, 2000, 2000, 2000, 2000, 2000, 2000, 2000, 1200, 1200, 1300, 1300, 1000, 1000, 1100, 2500];
// 移动方向: 0=原地, ±1=X轴(前/后), ±2=Z轴(左/右平移)
var _hexaAnimDirections = [0, 1, 1, -1, -1, 2, -2, 1, 1, 1, 1, 2, -2, -1, -1, 1, 1, -1, -1, 2, -2, 0, 0];
// 转弯速率: rad/s, 0=直行, >1=静态转, <1=移动转弯
var _hexaAnimTurnRates = [0, 0, 0, 0, 0, 0, 0, 1.2, -1.2, 0.5, -0.5, -0.45, 0.45, 0.5, -0.5, 0.7, -0.7, 0.7, -0.7, 0, 0, 0, 0];
// 每动画步幅/步高 (与上面一一对应)
var _hexaStrides     = [0,   0.22, 0.38, 0.18, 0.28, 0.14, 0.14, 0.135,0.135,0.22, 0.22, 0.14, 0.14, 0.18, 0.18, 0.38, 0.38, 0.28, 0.28, 0.19, 0.19, 0, 0];
var _hexaStepHeights = [0,   0.15, 0.24, 0.12, 0.18, 0.10, 0.10, 0.10, 0.10, 0.15, 0.15, 0.10, 0.10, 0.12, 0.12, 0.24, 0.24, 0.18, 0.18, 0.18, 0.18, 0, 0];
var _hexaLegPrefixes = ['左前','右前','左中','右中','左后','右后'];
// 三角步态分组: A组(相位0) vs B组(相位0.5)
var _TRIPOD_A = { '左前':true, '右中':true, '左后':true };
// Walk params: 步幅, 步高
var _WALK_STRIDE = 0.22, _WALK_STEP_H = 0.15;
// Run params
var _RUN_STRIDE = 0.38, _RUN_STEP_H = 0.24;
// Walk Back params: 步幅略小, 步高略低 (后退自然减速)
var _WALK_BACK_STRIDE = 0.18, _WALK_BACK_STEP_H = 0.12;
// Run Back params
var _RUN_BACK_STRIDE = 0.28, _RUN_BACK_STEP_H = 0.18;
// Strafe params: 横向移动步幅更小 (侧向运动效率低)
var _STRAFE_STRIDE = 0.14, _STRAFE_STEP_H = 0.10;
// Turn params: 转弯步幅决定腿部绕圈步距+前进量(步态周期已由turnRate推导)
var _TURN_STRIDE = 0.18, _TURN_STEP_H = 0.10;

// ── 动画引用收集 ──
function _hexaCollectRefs() {
  var oldAnimRefs = M._animRefs; // 保留旧refs用于清理枪管簇
  animRefs = M._animRefs = { legs: [], hexRoot: null, restHexRootY: 0, restHexRootX: 0, restHexRootZ: 0 };
  M.modelRoot.children.forEach(function(c) { if (c.name === '六足战车') animRefs.hexRoot = c; });
  var hexRoot = animRefs.hexRoot;
  if (!hexRoot) return;
  animRefs.restHexRootY = hexRoot.position.y;
  animRefs.restHexRootX = hexRoot.position.x;
  animRefs.restHexRootZ = hexRoot.position.z;
  animRefs.restHexRootRotY = hexRoot.rotation.y;
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

    var hw2 = new THREE.Vector3(); hexRoot.getWorldPosition(hw2);
    var hipW = new THREE.Vector3(); thighPivot.getWorldPosition(hipW);
    var hipDX = hipW.x - hw2.x, hipDZ = hipW.z - hw2.z;
    // 脚到身体中心的XZ距离 — 在初始化时固定，防止CCD误差导致距离漂移
    var initFootDist = Math.sqrt(
      (tipWorld.x - hw2.x) * (tipWorld.x - hw2.x) +
      (tipWorld.z - hw2.z) * (tipWorld.z - hw2.z)
    );
    animRefs.legs.push({
      prefix: prefix,
      tripodA: !!_TRIPOD_A[prefix],
      thighPivot: thighPivot, shinPivot: shinPivot, anklePivot: anklePivot,
      thighGroup: thighGroup,
      restThighX: thighPivot.rotation.x, restShinX: shinPivot.rotation.x,
      restAnkleX: anklePivot.rotation.x, restLegY: thighInfo.group.parent.rotation.y,
      tipWorld: tipWorld.clone(), tipLocal: tipLocal,
      _hipDist: Math.sqrt(hipDX*hipDX + hipDZ*hipDZ), // 髋距(不变)
      _initFootDist: initFootDist, // 固定脚距, swingTo用(防漂移)
      _shinSign: shinPivot.rotation.x > 0 ? 1 : -1, // 正常膝弯方向: +1=正值, -1=负值(防反曲)
      _yLimit: (prefix.indexOf('M') >= 0) ? 0.7 : 0.45, // 中腿±40°, 前后腿±25°防越界缠绕
      plantPos: null, swingFrom: null, swingTo: null
    });
  }

  // ── 收集武器引用(用于死亡垂下) ──
  var _weaponNames = ['左加特林','右加特林','左导弹巢','右导弹巢'];
  animRefs.weapons = [];
  for (var wi = 0; wi < _weaponNames.length; wi++) {
    var wg = null, mount = null;
    hexRoot.traverse(function(n) {
      if (n.name === _weaponNames[wi]) wg = n;
      if (n.name === _weaponNames[wi].replace('加特林','加特林支架').replace('导弹巢','导弹支架')) mount = n;
    });
    if (wg && mount) {
      animRefs.weapons.push({
        name: _weaponNames[wi],
        weaponGroup: wg,
        mount: mount,
        isGatling: _weaponNames[wi].indexOf('加特林') >= 0
      });
    }
  }
  // ── 加特林枪管簇: 将4根枪管放入子Group, 绕中央轴公转(而非自转) ──
  // 先清理旧簇 (防止重复collectRefs时嵌套; 用旧refs检查)
  if (oldAnimRefs && oldAnimRefs.barrelClusters) {
    for (var ci = 0; ci < oldAnimRefs.barrelClusters.length; ci++) {
      var oc = oldAnimRefs.barrelClusters[ci];
      if (oc && oc.parent) {
        while (oc.children.length > 0) oc.parent.add(oc.children[0]);
        oc.parent.remove(oc);
      }
    }
  }
  animRefs.barrelClusters = [];
  for (var wi = 0; wi < animRefs.weapons.length; wi++) {
    var wp = animRefs.weapons[wi];
    if (!wp.isGatling) continue;
    var pivotGroup = wp.weaponGroup.userData.pivot;
    if (!pivotGroup) continue;
    // 收集pivot下所有枪管子Group (只收集pivot直接子节点)
    var barrelGroups = [];
    for (var ci = pivotGroup.children.length - 1; ci >= 0; ci--) {
      var child = pivotGroup.children[ci];
      if (child.name && child.name.indexOf('枪管') >= 0) barrelGroups.push(child);
    }
    if (barrelGroups.length === 0) continue;
    // 创建枪管簇Group, 挂在pivot下
    var cluster = new THREE.Group();
    cluster.name = wp.name + '_barrelCluster';
    pivotGroup.add(cluster);
    // 把枪管移入簇 (簇在pivot原点, add()自动保持世界变换)
    for (var bi = 0; bi < barrelGroups.length; bi++) {
      cluster.add(barrelGroups[bi]);
    }
    animRefs.barrelClusters.push(cluster);
  }

  // ── 自动抬升: 让最低尖刺足恰好触地(Y=0) ──
  hexRoot.updateMatrixWorld(true);
  var lowestTipY = Infinity;
  for (var li2 = 0; li2 < animRefs.legs.length; li2++) {
    var l2 = animRefs.legs[li2];
    var tw2 = l2.tipLocal.clone().applyMatrix4(l2.anklePivot.matrixWorld);
    if (tw2.y < lowestTipY) lowestTipY = tw2.y;
  }
  if (lowestTipY < 0) {
    hexRoot.position.y += (-lowestTipY);
    animRefs.restHexRootY = hexRoot.position.y;
    // 抬升后更新所有腿的tipWorld引用
    hexRoot.updateMatrixWorld(true);
    for (var li3 = 0; li3 < animRefs.legs.length; li3++) {
      var l3 = animRefs.legs[li3];
      l3.tipWorld = l3.tipLocal.clone().applyMatrix4(l3.anklePivot.matrixWorld);
    }
  }
}

function _worldX(j) { var q=new THREE.Quaternion(); j.getWorldQuaternion(q); return new THREE.Vector3(1,0,0).applyQuaternion(q).normalize(); }
function _worldY(j) { var q=new THREE.Quaternion(); j.getWorldQuaternion(q); return new THREE.Vector3(0,1,0).applyQuaternion(q).normalize(); }

// CCD核心: 对一条腿做N次迭代
function _ccdLeg(leg, targetWorld, iters, damp) {
  damp = damp || 0.5;
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
    if (l > 0.0003) { ax.normalize(); tp.rotation.x += Math.atan2(l, d.dot(dt)) * ax.dot(_worldX(tp)) * damp; }
    // Shin X
    var sW = new THREE.Vector3(); sp.getWorldPosition(sW);
    d = tipW.clone().sub(sW).normalize(); dt = targetWorld.clone().sub(sW).normalize();
    ax = new THREE.Vector3().crossVectors(d, dt); l = ax.length();
    if (l > 0.0003) { ax.normalize(); sp.rotation.x += Math.atan2(l, d.dot(dt)) * ax.dot(_worldX(sp)) * damp; }
    // 膝关节目录: 禁止穿越零点(反曲), 留0.05rad安全边界
    if (leg._shinSign > 0) { if (sp.rotation.x < 0.05) sp.rotation.x = 0.05; }
    else                   { if (sp.rotation.x > -0.05) sp.rotation.x = -0.05; }
    // LegGroup Y
    var hW = new THREE.Vector3(); tp.getWorldPosition(hW);
    d = tipW.clone().sub(hW).normalize(); dt = targetWorld.clone().sub(hW).normalize();
    ax = new THREE.Vector3().crossVectors(d, dt); l = ax.length();
    if (l > 0.0003) { ax.normalize(); lp.rotation.y += Math.atan2(l, d.dot(dt)) * ax.dot(_worldY(lp)) * damp; }
    // 髋Y限位: 相对restLegY最多±0.7rad(≈40°), 防360°自由旋转致腿缠绕
    var yLimit = leg._yLimit || 0.7;
    var diff = lp.rotation.y - leg.restLegY;
    while (diff > Math.PI) diff -= 2*Math.PI;
    while (diff < -Math.PI) diff += 2*Math.PI;
    if (diff > yLimit) { lp.rotation.y = leg.restLegY + yLimit; }
    else if (diff < -yLimit) { lp.rotation.y = leg.restLegY - yLimit; }
    animRefs.hexRoot.updateMatrixWorld(true);
  }
}

// ── 每帧更新 ──
function _hexaUpdateFrame(dt, t, elapsed, duration, animIndex) {
  animRefs = M._animRefs;
  if (!animRefs || !animRefs.legs || !animRefs.hexRoot) return;
  // 受击踉跄/死亡进行中: 交各自系统接管, 但先更新动画追踪
  if (animRefs._staggerActive) {
    animRefs._lastDuration = duration;
    animRefs._lastAnimIndex = animIndex;
    _hexaStaggerUpdate(dt);
    return;
  }
  if (animRefs._deathActive) {
    animRefs._lastDuration = duration;
    animRefs._lastAnimIndex = animIndex;
    _hexaDeathUpdate(dt);
    return;
  }
  // 受击踉跄动画 (index 21): 一次性触发, 每次轮换方向
  if (animIndex === 21 && !animRefs._staggerDone) {
    var staggerDirs = [
      new THREE.Vector3(0,0,1),   // 前方
      new THREE.Vector3(1,0,0),   // 左侧
      new THREE.Vector3(-1,0,0),  // 右侧
      new THREE.Vector3(0,0,-1),  // 后方
      new THREE.Vector3(1,0,1).normalize(),  // 左前
      new THREE.Vector3(-1,0,1).normalize(), // 右前
    ];
    var idx = (animRefs._staggerDirIdx || 0) % staggerDirs.length;
    animRefs._staggerDirIdx = idx + 1;
    triggerHexStagger(staggerDirs[idx], 0.7);
    return;
  }
  // 死亡动画 (index 22): 一次性触发
  if (animIndex === 22 && !animRefs._deathDone) {
    triggerHexDeath();
    return;
  }
  // 死亡已完成(等待t>=1跳回): 冻结姿态, 防止idle逻辑接管
  if (animIndex === 22 && animRefs._deathDone) return;
  animRefs._animDuration = duration;
  animRefs._frameDt = dt; // 供 _updateGait 计算旋转增量
  animRefs._curAnimIndex = animIndex; // 供 _updateGait 区分静态/组合转弯

  // 自累积时间，不受动画循环重置影响
  if (animRefs._totalTime === undefined) animRefs._totalTime = 0;
  animRefs._totalTime += dt;

  // 检测动画切换: duration或animIndex变化 → 复位
  // (同duration不同index: 如左右平移都是1700ms, 必须也检测index)
  var switched = (animRefs._lastDuration !== undefined && animRefs._lastDuration !== duration)
              || (animRefs._lastAnimIndex !== undefined && animRefs._lastAnimIndex !== animIndex);
  if (switched) {
    animRefs._gaitInit = false; animRefs._prevTotalDist = 0; animRefs._totalTime = 0;
    // 切换动画: 腿关节+步态状态+车身全复位
    for (var li = 0; li < animRefs.legs.length; li++) {
      var lg = animRefs.legs[li];
      lg.thighPivot.rotation.x = lg.restThighX;
      lg.shinPivot.rotation.x = lg.restShinX;
      lg.anklePivot.rotation.x = lg.restAnkleX;
      lg.thighGroup.parent.rotation.y = lg.restLegY;
      lg.plantPos = null; lg.swingFrom = null; lg.swingTo = null; lg._wasStance = undefined;
    }
    animRefs.hexRoot.position.set(animRefs.restHexRootX, animRefs.restHexRootY, animRefs.restHexRootZ);
    animRefs.hexRoot.rotation.set(0, animRefs.restHexRootRotY, 0); // 含倾斜恢复
    animRefs._staggerDone = false;
    animRefs._deathDone = false;
  }
  animRefs._lastDuration = duration;
  animRefs._lastAnimIndex = animIndex;
  // 在 duration 切换检查之后再读取 totalT，确保复位后从 0 开始
  var totalT = animRefs._totalTime;

  // 用 animIndex 查方向数组: 0=Idle, ±1=X轴, ±2=Z轴平移
  var dir = (animIndex !== undefined && animIndex >= 0 && animIndex < _hexaAnimDirections.length)
    ? _hexaAnimDirections[animIndex] : 0;
  // 查转弯速率: rad/s, 0=直行
  var turnRate = (animIndex !== undefined && animIndex >= 0 && animIndex < _hexaAnimTurnRates.length)
    ? _hexaAnimTurnRates[animIndex] : 0;

  var isIdle = (dir === 0 && turnRate === 0);
  animRefs._gaitActive = !isIdle;

  if (!isIdle) {
    // ── 步态参数选择 ──
    var stride = (animIndex >= 0 && animIndex < _hexaStrides.length) ? _hexaStrides[animIndex] : 0;
    var stepH  = (animIndex >= 0 && animIndex < _hexaStepHeights.length) ? _hexaStepHeights[animIndex] : 0.1;
    // CCD迭代: 高速转弯多迭代补偿, 奔跑多迭代, 其余默认
    var ccdIters;
    if (Math.abs(turnRate) > 1.0) {
      ccdIters = 20 + Math.round(Math.abs(turnRate) * 13);
    } else if (Math.abs(turnRate) > 0) {
      ccdIters = 20 + Math.round(Math.abs(turnRate) * 8);
    } else if (stride > 0.30) {
      ccdIters = 30; // 奔跑
    } else {
      ccdIters = 15;
    }
    if (!animRefs._gaitInit) _initGait(stride, stepH);
    _updateGait(totalT, stride, stepH, ccdIters, dir, turnRate);
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
function _initGait(stride, stepH, direction) {
  animRefs.hexRoot.updateMatrixWorld(true);
  for (var li = 0; li < animRefs.legs.length; li++) {
    var leg = animRefs.legs[li];
    var tipW = leg.tipLocal.clone().applyMatrix4(leg.anklePivot.matrixWorld);
    leg.plantPos = tipW.clone();
    leg._groundY = tipW.y; // 初始接地高度，作为不变参考
    leg.swingFrom = null; leg.swingTo = null;
  }
  animRefs._prevTotalDist = 0;
  animRefs._gaitInit = true;
}

function _updateGait(totalTime, stride, stepH, ccdIters, direction, turnRate) {
  direction = direction || 1; // ±1=X轴(前/后), ±2=Z轴(左/右平移)
  turnRate = turnRate || 0;   // rad/s, 0=直行
  var damp = (turnRate !== 0) ? 0.8 : 0.5; // 转弯用高阻尼加速收敛
  ccdIters = ccdIters || 15;
  // totalTime: 秒, 自累积不受循环重置影响
  // 步行: 周期1.2s/步态, 奔跑: 0.7s/步态 (A+B各半步)
  var gaitPeriod;
  if (Math.abs(turnRate) > 1.0) {
    // 静态转弯(高速): 周期由转速推导, 保证每步角位移~0.525rad
    gaitPeriod = 1.05 / Math.abs(turnRate);
  } else if (Math.abs(turnRate) > 0) {
    // 移动转弯(低速): 固定周期, 以移动步频为主
    gaitPeriod = 0.72;
  } else {
    gaitPeriod = stride > 0.30 ? 0.38 : 0.7;
  }
  var gaitCycles = totalTime / gaitPeriod;
  var bodyBob = Math.sin(gaitCycles * Math.PI * 2) * 0.03;

  // ── 身体旋转 ──
  var dt = animRefs._frameDt || 0.016;
  animRefs.hexRoot.rotation.y += turnRate * dt;

  // 移动方向: ±1→X轴(前/后), ±2→Z轴(左/右平移)
  var fwdBody;
  if (direction === 2 || direction === -2) {
    fwdBody = new THREE.Vector3(0, 0, direction / 2); // 2→+Z(左), -2→-Z(右)
  } else {
    fwdBody = new THREE.Vector3(-1 * direction, 0, 0); // 1→-X(前), -1→+X(后)
  }
  animRefs.hexRoot.localToWorld(fwdBody);
  var hw = new THREE.Vector3(); animRefs.hexRoot.getWorldPosition(hw);
  fwdBody.sub(hw).normalize();

  // 身体平移 — 静态转弯(animIndex 7/8)仅旋转不位移
  var isStaticTurn = (animRefs._curAnimIndex === 7 || animRefs._curAnimIndex === 8);
  var totalDist = gaitCycles * stride * 2;
  var deltaDist = totalDist - (animRefs._prevTotalDist || 0);
  animRefs._prevTotalDist = totalDist;
  if (!isStaticTurn) {
    animRefs.hexRoot.position.x += fwdBody.x * deltaDist;
    animRefs.hexRoot.position.z += fwdBody.z * deltaDist;
  }
  // ── 地形适应: 若window.getGroundHeight存在(游戏中), 贴合地形 ──
  if (typeof window.getGroundHeight === 'function') {
    var gh = window.getGroundHeight;
    var hwPos = new THREE.Vector3(); animRefs.hexRoot.getWorldPosition(hwPos);
    // 身体Y: 取地形高度(不叠加bodyBob, CCD处理起伏)
    animRefs.hexRoot.position.y = gh(hwPos.x, hwPos.z);
    // 确保旋转顺序YXZ: Y(转向)→X(俯仰)→Z(侧倾)
    if (!animRefs.hexRoot.rotation.order || animRefs.hexRoot.rotation.order !== 'YXZ') {
      animRefs.hexRoot.rotation.order = 'YXZ';
    }
    // 采样方向: 用身体当前朝向
    var hYaw = animRefs.hexRoot.rotation.y;
    var hFwdX = -Math.cos(hYaw), hFwdZ = Math.sin(hYaw);
    var hRgtX = -Math.cos(hYaw + Math.PI/2), hRgtZ = Math.sin(hYaw + Math.PI/2);
    var sD = 1.2; // 六足车身宽, 采样距离稍远
    // 俯仰: 前后采样
    var fhT = gh(hwPos.x + hFwdX * sD, hwPos.z + hFwdZ * sD);
    var bhT = gh(hwPos.x - hFwdX * sD, hwPos.z - hFwdZ * sD);
    animRefs.hexRoot.rotation.x = -Math.atan2(fhT - bhT, sD * 2);
    // 侧倾: 左右采样
    var lhT = gh(hwPos.x - hRgtX * sD, hwPos.z - hRgtZ * sD);
    var rhT = gh(hwPos.x + hRgtX * sD, hwPos.z + hRgtZ * sD);
    animRefs.hexRoot.rotation.z = -Math.atan2(rhT - lhT, sD * 2);
  } else {
    // 模型工厂: 固定高度 + bodyBob
    animRefs.hexRoot.position.y = animRefs.restHexRootY - (isStaticTurn ? 0 : bodyBob);
  }
  animRefs.hexRoot.updateMatrixWorld(true);

  for (var li = 0; li < animRefs.legs.length; li++) {
    var leg = animRefs.legs[li];
    var phaseOffset = leg.tripodA ? 0 : 0.5;
    var gaitT = (gaitCycles + phaseOffset) % 1;
    var inStance = (gaitT < 0.5);
    var stanceFrac = inStance ? gaitT * 2 : (gaitT - 0.5) * 2; // 0->1 within phase

    if (inStance) {
      // 支撑相: 锥尖锁定在plantPos (CCD自动补偿身体旋转+平移)
      if (!leg._wasStance) {
        animRefs.hexRoot.updateMatrixWorld(true);
        leg.plantPos = leg.tipLocal.clone().applyMatrix4(leg.anklePivot.matrixWorld);
      }
      _ccdLeg(leg, leg.plantPos, ccdIters, damp);
    } else {
      // 摆动相: 计算脚步从 plantPos 到落地点的插值
      if (leg._wasStance) {
        leg.swingFrom = leg.plantPos.clone();
        if (turnRate !== 0) {
          // 转弯: 落地位置 = 身体中心 + 旋转(跖骨向量, 预计转量) [+ 前进偏移]
          var bodyC = new THREE.Vector3();
          animRefs.hexRoot.getWorldPosition(bodyC);
          var toFoot = leg.plantPos.clone().sub(bodyC);
          toFoot.y = 0;
          var footAngle = Math.atan2(toFoot.z, toFoot.x);
          var newAngle = footAngle - turnRate * gaitPeriod; // 反向全周期位移
          var footDist = leg._initFootDist || (toFoot.length() || 1); // 固定脚距, 防止CCD误差累积漂移
          leg.swingTo = bodyC.clone();
          leg.swingTo.x += Math.cos(newAngle) * footDist;
          leg.swingTo.z += Math.sin(newAngle) * footDist;
          leg.swingTo.y = leg._groundY; // 不变参考, 防漂移
          // 静态转弯不加前进偏移(身体不位移), 组合转弯才加
          if (!isStaticTurn) {
            leg.swingTo.x += fwdBody.x * stride * 2;
            leg.swingTo.z += fwdBody.z * stride * 2;
          }
        } else {
          // 直行: 简单前移
          leg.swingTo = leg.plantPos.clone();
          leg.swingTo.x += fwdBody.x * stride * 2;
          leg.swingTo.z += fwdBody.z * stride * 2;
        }
      }
      // 防护: 首次即入摆动相 (TripodB at gaitT=0.5)
      if (!leg.swingFrom || !leg.swingTo) {
        // 用当前真实足位更新plantPos/swingFrom, 补偿身体已发生的旋转+平移
        // (否则plantPos是_initGait在身体移动前捕获的旧值, 与swingTo不一致, CCD会收敛到反曲)
        animRefs.hexRoot.updateMatrixWorld(true);
        leg.plantPos = leg.tipLocal.clone().applyMatrix4(leg.anklePivot.matrixWorld);
        leg.swingFrom = leg.plantPos.clone();
        if (turnRate !== 0) {
          // 转弯首次: 用旋转逻辑放置落地位置
          var bodyC2 = new THREE.Vector3();
          animRefs.hexRoot.getWorldPosition(bodyC2);
          var tf2 = leg.plantPos.clone().sub(bodyC2); tf2.y = 0;
          var fa2 = Math.atan2(tf2.z, tf2.x);
          var fd2 = leg._initFootDist || (tf2.length() || 1);
          leg.swingTo = bodyC2.clone();
          leg.swingTo.x += Math.cos(fa2 - turnRate * gaitPeriod) * fd2;
          leg.swingTo.z += Math.sin(fa2 - turnRate * gaitPeriod) * fd2;
          leg.swingTo.y = leg._groundY;
        } else {
          leg.swingTo = leg.plantPos.clone();
          leg.swingTo.x += fwdBody.x * stride * 2;
          leg.swingTo.z += fwdBody.z * stride * 2;
        }
      }
      // Lerp
      var target = new THREE.Vector3().lerpVectors(leg.swingFrom, leg.swingTo, stanceFrac);
      target.y += Math.sin(stanceFrac * Math.PI) * stepH; // 抬腿弧线
      _ccdLeg(leg, target, ccdIters, damp);
    }
    leg._wasStance = inStance;
  }

  // ── 加特林枪管旋转 ──
  _updateGatlingSpin(dt);
}

// 加特林枪管簇绕中央轴公转 (模仿真实加特林机枪枪管旋转)
var _barrelSpinAccum = 0;
function _updateGatlingSpin(dt) {
  if (!animRefs || !animRefs.barrelClusters || animRefs.barrelClusters.length === 0) return;
  var spinRPS = 3; // 转/秒
  var delta = spinRPS * Math.PI * 2 * dt;
  _barrelSpinAccum += delta;
  for (var ci = 0; ci < animRefs.barrelClusters.length; ci++) {
    var cluster = animRefs.barrelClusters[ci];
    if (!cluster) continue;
    cluster.rotation.x += delta; // 绕簇组局部X轴旋转
  }
}

function _hexaResetState() {
  animRefs = M._animRefs;
  if (!animRefs) return;
  // 清理死亡武器垂下枢轴(如果死亡被中断)
  _cleanupWeaponDroopPivots();
  if (animRefs._deathActive) { animRefs._deathActive = false; animRefs._deathDone = true; deathState = null; }
  var isGait = animRefs._gaitActive;
  if (animRefs.hexRoot && !isGait) {
    animRefs.hexRoot.position.set(animRefs.restHexRootX, animRefs.restHexRootY, animRefs.restHexRootZ);
    animRefs.hexRoot.rotation.y = animRefs.restHexRootRotY;
  }
  if (!isGait) {
    animRefs._gaitInit = false;
    animRefs._prevTotalDist = 0;
    animRefs._totalTime = 0;
  }
  if (animRefs.legs) {
    for (var li = 0; li < animRefs.legs.length; li++) {
      var leg = animRefs.legs[li];
      if (!isGait) {
        // 非步态(停止): 完全复位关节+步态状态
        leg.thighPivot.rotation.x = leg.restThighX;
        leg.shinPivot.rotation.x = leg.restShinX;
        leg.anklePivot.rotation.x = leg.restAnkleX;
        leg.thighGroup.parent.rotation.y = leg.restLegY;
        leg.plantPos = null; leg.swingFrom = null; leg.swingTo = null;
        leg._wasStance = undefined;
      }
      // 步态中(含动画循环): 关节由CCD持续控制, 不清plantPos/swing — 实现无缝衔接
    }
    animRefs.hexRoot.updateMatrixWorld(true);
  }
}

function _hexaDestroyPivots() {
  _cleanupWeaponDroopPivots();
  if (deathState) deathState = null;
  M._animRefs = {};
}

// ── 导出动画接口 ──
// ═══════════════════════════════════════════
// 受击踉跄系统 (v0.55)
// 四阶段: 冲击→踉跄→恢复→回归
// ═══════════════════════════════════════════
var staggerState = null;

function _easeOut(t) { return 1 - Math.pow(1 - t, 3); }
function _easeInOut(t) { return t < 0.5 ? 2*t*t : 1 - Math.pow(-2*t+2, 2)/2; }

function triggerHexStagger(hitWorldDir, force) {
  if (!animRefs || !animRefs.hexRoot || !animRefs.legs || !animRefs.legs.length) {
    _hexaCollectRefs();
    if (!animRefs || !animRefs.hexRoot) return;
  }
  force = Math.max(0.15, Math.min(1, force || 0.5));
  var dirWorld = new THREE.Vector3(hitWorldDir.x, 0, hitWorldDir.z);
  if (dirWorld.length() < 0.01) dirWorld.set(0, 0, 1);
  dirWorld.normalize();

  // 转本地方向, 判断哪些腿在受击对面(用于支撑)
  animRefs.hexRoot.updateMatrixWorld(true);
  var hp = new THREE.Vector3(); animRefs.hexRoot.getWorldPosition(hp);
  var localEnd = animRefs.hexRoot.worldToLocal(hp.clone().add(dirWorld));
  var lx = localEnd.x, lz = localEnd.z;

  // 保存所有脚当前位置
  var plants = [];
  for (var li = 0; li < animRefs.legs.length; li++) {
    var l = animRefs.legs[li];
    plants.push(l.tipLocal.clone().applyMatrix4(l.anklePivot.matrixWorld));
  }

  // 按腿位置打分, 选出受击反向侧2~3条腿跺地
  var scores = [];
  for (var li2 = 0; li2 < animRefs.legs.length; li2++) {
    var pf = animRefs.legs[li2].prefix;
    var sc = 0;
    if (pf.indexOf('前')>=0) sc -= lx; if (pf.indexOf('后')>=0) sc += lx;
    if (pf.indexOf('左')>=0) sc -= lz; if (pf.indexOf('右')>=0) sc += lz;
    scores.push({i:li2, s:sc});
  }
  scores.sort(function(a,b){return b.s-a.s;});
  var stompIdx = [scores[0].i, scores[1].i];
  if (Math.random()<0.4) stompIdx.push(scores[2].i);

  var push = 0.22*force;
  staggerState = {
    t0: performance.now()/1000,
    force: force, dir: dirWorld,
    tImp: 0.12, tStag: 0.35, tRec: 0.50,
    pushX: dirWorld.x*push, pushZ: dirWorld.z*push,
    tiltX: dirWorld.z*0.10*force, tiltZ: -dirWorld.x*0.10*force,
    plants: plants,
    stompIdx: stompIdx, stompTargets: {}, stompFired: false,
    bodyStart: hp.clone()
  };
  animRefs._gaitActive = false;
  animRefs._staggerActive = true;
}

function _hexaStaggerUpdate(dt) {
  if (!staggerState || !animRefs) return;
  var s = staggerState;
  var elapsed = performance.now()/1000 - s.t0;
  var total = s.tImp + s.tStag + s.tRec;
  if (elapsed >= total) { _hexaStaggerEnd(); return; }

  var hr = animRefs.hexRoot;
  var inImp = elapsed < s.tImp;
  var inStag = elapsed >= s.tImp && elapsed < s.tImp+s.tStag;
  var inRec = elapsed >= s.tImp+s.tStag;

  // ── 身体位移 ──
  var bFrac;
  if (inImp) bFrac = _easeOut(elapsed/s.tImp);
  else if (inStag) bFrac = 1 + 0.08*Math.sin((elapsed-s.tImp)/s.tStag*Math.PI*3);
  else bFrac = 1 - _easeInOut((elapsed-s.tImp-s.tStag)/s.tRec);
  hr.position.x = s.bodyStart.x + s.pushX*bFrac;
  hr.position.z = s.bodyStart.z + s.pushZ*bFrac;

  // ── 身体倾斜 ──
  var tFrac = inImp ? _easeOut(elapsed/s.tImp) : inStag ? 1 : 1-_easeInOut((elapsed-s.tImp-s.tStag)/s.tRec);
  hr.rotation.x = s.tiltX*tFrac;
  hr.rotation.z = s.tiltZ*tFrac;
  hr.updateMatrixWorld(true);

  // ── 跺脚触发 ──
  if (inStag && !s.stompFired) {
    for (var si=0; si<s.stompIdx.length; si++) {
      var li = s.stompIdx[si];
      s.stompTargets[li] = {
        from: s.plants[li].clone(),
        to: s.plants[li].clone().add(new THREE.Vector3(-s.dir.x*0.1*s.force, 0.04, -s.dir.z*0.1*s.force))
      };
    }
    s.stompFired = true;
  }

  // ── 逐腿CCD ──
  for (var li3=0; li3<animRefs.legs.length; li3++) {
    var leg = animRefs.legs[li3];
    var tgt;
    if (s.stompTargets[li3]) {
      var st = s.stompTargets[li3];
      var frac = Math.min(1, (elapsed-s.tImp)/(s.tStag*0.35));
      tgt = new THREE.Vector3().lerpVectors(st.from, st.to, _easeOut(frac));
      tgt.y += Math.sin(Math.min(frac,1)*Math.PI)*0.07;
    } else {
      tgt = s.plants[li3];
    }
    _ccdLeg(leg, tgt, 25, 0.7);
  }
}

function _hexaStaggerEnd() {
  staggerState = null;
  if (!animRefs) return;
  animRefs._staggerActive = false;
  animRefs._staggerDone = true; // 防止动画循环重触发
  if (animRefs.hexRoot) {
    animRefs.hexRoot.position.set(animRefs.restHexRootX, animRefs.restHexRootY, animRefs.restHexRootZ);
    animRefs.hexRoot.rotation.set(0, animRefs.restHexRootRotY || 0, 0);
  }
  _hexaResetState();
}

M.triggerHexStagger = triggerHexStagger;

// ═══════════════════════════════════════════
// 死亡瘫倒系统 (v0.55)
// 三阶段: 僵直→瘫软→触地, damp渐降模拟关节失力
// ═══════════════════════════════════════════
var deathState = null;

function triggerHexDeath() {
  if (!animRefs || !animRefs.hexRoot || !animRefs.legs) return;

  animRefs.hexRoot.updateMatrixWorld(true);
  var restY = animRefs.restHexRootY;
  var bodyC = new THREE.Vector3(); animRefs.hexRoot.getWorldPosition(bodyC);
  var restX = animRefs.hexRoot.position.x;
  var restZ = animRefs.hexRoot.position.z;

  // 地面高度
  var groundY = restY;
  var startPlants = [];
  for (var li = 0; li < animRefs.legs.length; li++) {
    var l = animRefs.legs[li];
    var tw = l.tipLocal.clone().applyMatrix4(l.anklePivot.matrixWorld);
    startPlants.push(tw.clone());
    if (tw.y < groundY) groundY = tw.y;
  }
  var bellyY = groundY + 0.14; // 倾斜触地, 压低高度

  // ── 每腿各异的死亡瘫姿 (全伸展, 角度不对称) ──
  var splayPresets = [
    { mul:1.18, ao: 0.55 },  // 左前: 偏前左
    { mul:1.25, ao:-0.15 },  // 右前: 几乎正前
    { mul:1.22, ao: 0.08 },  // 左中: 几乎正左
    { mul:1.30, ao:-0.45 },  // 右中: 偏前右
    { mul:1.15, ao:-0.50 },  // 左后: 偏右后(交叉)
    { mul:1.20, ao: 0.60 },  // 右后: 偏右后
  ];
  var deathTargets = [];
  for (var li2 = 0; li2 < animRefs.legs.length; li2++) {
    var fromB = startPlants[li2].clone().sub(bodyC); fromB.y = 0;
    var baseAngle = Math.atan2(fromB.z, fromB.x);
    var baseDist = fromB.length() || 0.5;
    var sp = splayPresets[li2];
    var dd = baseDist * sp.mul;
    var da = sp.ao + (Math.random() - 0.5) * 0.12; // 微随机
    var dAngle = baseAngle + da;
    var dt = bodyC.clone();
    dt.x += Math.cos(dAngle) * dd;
    dt.z += Math.sin(dAngle) * dd;
    dt.y = groundY;
    deathTargets.push(dt);
  }

  // ── 昂首阶段: 前腿撑地, 身体抬起 ──
  var rearTargets = [];
  for (var li3 = 0; li3 < animRefs.legs.length; li3++) {
    var pf2 = animRefs.legs[li3].prefix;
    var p = startPlants[li3].clone();
    if (pf2.indexOf('前') >= 0) {
      // 前腿: 向内微收撑地, 把身体推起来
      var toBody = bodyC.clone().sub(p); toBody.y = 0;
      toBody.normalize().multiplyScalar(0.06);
      p.add(toBody);
    }
    // 中后腿: 保持原位
    p.y = groundY;
    rearTargets.push(p);
  }

  deathState = {
    t0: performance.now()/1000,
    tRearUp: 0.22, tApex: 0.10, tCollapse: 0.7, tSettle: 0.5,
    restY: restY, restX: restX, restZ: restZ,
    bellyY: bellyY, groundY: groundY,
    peakY: restY + 0.12, // 昂首时身体高度
    startPlants: startPlants,
    rearTargets: rearTargets,
    deathTargets: deathTargets
  };

  // ── 武器垂下枢轴: 让武器绕支架旋转, 瘫倒阶段逐渐垂下 ──
  // 先清理武器校准(如果有)避免层级冲突
  if (weaponCalActive) { _weaponCalCleanup(); }
  deathState.weaponPivots = [];
  var wrefs = animRefs.weapons;
  if (wrefs && wrefs.length) {
    for (var wi = 0; wi < wrefs.length; wi++) {
      var wr = wrefs[wi];
      var wg = wr.weaponGroup, mount = wr.mount;
      var gp = wg.parent; // grandParent (武器平台)
      var mountLocal = mount.position.clone();
      // 保存原始矩阵用于cleanup
      var origMatrix = wg.matrix.clone();

      // mount世界位置 → grandParent本地坐标
      var mwp = new THREE.Vector3(); mount.getWorldPosition(mwp);
      var gpWorldPos = new THREE.Vector3(); gp.getWorldPosition(gpWorldPos);
      var gpWorldQuat = new THREE.Quaternion(); gp.getWorldQuaternion(gpWorldQuat);
      var mountInGP = mwp.clone().sub(gpWorldPos).applyQuaternion(gpWorldQuat.clone().invert());

      // 旋转轴: weaponGroup本地Z轴 → grandParent本地空间
      var wq = new THREE.Quaternion(); wg.getWorldQuaternion(wq);
      var lzWorld = new THREE.Vector3(0,0,1).applyQuaternion(wq).normalize();
      var lzInGP = lzWorld.clone().applyQuaternion(gpWorldQuat.clone().invert()).normalize();

      var pivot = new THREE.Group();
      pivot.name = '_death_wp_' + wi;
      gp.remove(wg);
      gp.add(pivot);
      pivot.position.copy(mountInGP);
      pivot.rotation.set(0,0,0);
      pivot.add(wg);
      wg.position.copy(mountLocal).multiplyScalar(-1);
      gp.updateMatrixWorld(true);

      deathState.weaponPivots.push({
        pivot: pivot, weaponGroup: wg, grandParent: gp,
        origMatrix: origMatrix, lz: lzInGP,
        isGatling: wr.isGatling
      });
    }
  }

  animRefs._gaitActive = false;
  animRefs._deathActive = true;
}

function _hexaDeathUpdate(dt) {
  if (!deathState || !animRefs) return;
  var ds = deathState;
  var elapsed = performance.now()/1000 - ds.t0;
  var tRear = ds.tRearUp, tApex = ds.tApex;
  var tPhase2 = tRear + tApex;
  var tPhase3 = tPhase2 + ds.tCollapse;
  var total = tPhase3 + ds.tSettle;
  if (elapsed >= total) { _hexaDeathEnd(); return; }

  var hr = animRefs.hexRoot;

  // ── 阶段判定 ──
  var phase = elapsed < tRear ? 0          // 昂首
            : elapsed < tPhase2 ? 1         // 极点停顿
            : elapsed < tPhase3 ? 2         // 瘫倒
            : 3;                            // 触地静止

  // ── 身体Y ──
  if (phase === 0) {
    var rf = _easeOut(elapsed / tRear);
    hr.position.y = ds.restY + (ds.peakY - ds.restY) * rf;
  } else if (phase === 1) {
    hr.position.y = ds.peakY;
  } else if (phase === 2) {
    var cf = _easeInOut((elapsed - tPhase2) / ds.tCollapse);
    hr.position.y = ds.peakY + (ds.bellyY - ds.peakY) * cf;
  } else {
    hr.position.y = ds.bellyY;
  }
  hr.position.x = ds.restX; hr.position.z = ds.restZ;

  // ── 身体倾斜: 昂首后仰 → 瘫倒前倾+侧倾 ──
  if (phase === 0) {
    hr.rotation.x = -0.10 * _easeOut(elapsed / tRear);
    hr.rotation.z = 0;
  } else if (phase === 1) {
    hr.rotation.x = -0.10;
    hr.rotation.z = 0;
  } else if (phase === 2) {
    var cf2 = _easeInOut((elapsed - tPhase2) / ds.tCollapse);
    hr.rotation.x = -0.10 + 0.22 * cf2; // 后仰→前倾(+0.12)
    hr.rotation.z = 0.07 * cf2;          // 右倾
  } else {
    hr.rotation.x = 0.12;
    hr.rotation.z = 0.07;
  }
  hr.updateMatrixWorld(true);

  // ── CCD damp ──
  var damp;
  if (phase <= 1) damp = 0.85;
  else if (phase === 2) damp = 0.85 - 0.82 * Math.min(1, (elapsed - tPhase2) / ds.tCollapse);
  else damp = 0.03;

  // ── 腿靶点 ──
  var legTargets = phase <= 1 ? ds.rearTargets
                 : phase === 2 ? null // lerped below
                 : ds.deathTargets;

  for (var li = 0; li < animRefs.legs.length; li++) {
    var leg = animRefs.legs[li];
    var tgt;
    if (phase <= 1) {
      tgt = ds.rearTargets[li];
    } else if (phase === 2) {
      var cf3 = _easeInOut((elapsed - tPhase2) / ds.tCollapse);
      tgt = new THREE.Vector3().lerpVectors(ds.rearTargets[li], ds.deathTargets[li], cf3);
    } else {
      tgt = ds.deathTargets[li];
    }
    _ccdLeg(leg, tgt, phase >= 3 ? 10 : 20, damp);
  }

  // ── 武器垂下: 瘫倒阶段武器绕支架逐渐下垂 ──
  if (ds.weaponPivots && ds.weaponPivots.length) {
    var droopFrac; // 0=中立, 1=完全垂下至机械限位
    if (phase <= 1) {
      // 昂首/极点: 武器微抬(惯性效应)
      droopFrac = -0.25;
    } else if (phase === 2) {
      var cf4 = _easeInOut((elapsed - tPhase2) / ds.tCollapse);
      droopFrac = -0.25 + 1.25 * cf4; // -0.25→1.0
    } else {
      droopFrac = 1.0;
    }
    for (var pi = 0; pi < ds.weaponPivots.length; pi++) {
      var wpv = ds.weaponPivots[pi];
      var maxDroopRad = (wpv.isGatling ? 20 : 30) * Math.PI / 180;
      var angle = droopFrac * maxDroopRad;
      if (angle > maxDroopRad) angle = maxDroopRad;
      if (angle < -5 * Math.PI / 180) angle = -5 * Math.PI / 180; // 最多微抬5°
      wpv.pivot.quaternion.setFromAxisAngle(wpv.lz, angle);
    }
  }
}

function _cleanupWeaponDroopPivots() {
  if (!deathState || !deathState.weaponPivots) return;
  for (var pi = 0; pi < deathState.weaponPivots.length; pi++) {
    var pv = deathState.weaponPivots[pi];
    pv.pivot.remove(pv.weaponGroup);
    pv.grandParent.add(pv.weaponGroup);
    pv.weaponGroup.matrix.copy(pv.origMatrix);
    pv.weaponGroup.matrix.decompose(pv.weaponGroup.position, pv.weaponGroup.quaternion, pv.weaponGroup.scale);
    pv.grandParent.remove(pv.pivot);
  }
  deathState.weaponPivots = null;
}

function _hexaDeathEnd() {
  _cleanupWeaponDroopPivots();
  deathState = null;
  if (!animRefs) return;
  animRefs._deathActive = false;
  animRefs._deathDone = true;
}

M.triggerHexDeath = triggerHexDeath;

// ═══════════════════════════════════════════

M.HexapodAnims = {
  names: _hexaAnimNames,
  durations: _hexaAnimDurations,
  directions: _hexaAnimDirections,
  turnRates: _hexaAnimTurnRates,
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
    var ttb = document.getElementById('toggle-turntest');
    if (ttb) ttb.disabled = false;
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

// ═══════════════════════════════════════════
// 转弯基础验证 — 极慢旋转 + 所有腿可见 + 可视化标记
// ═══════════════════════════════════════════
var turnTestActive = false;
var turnTestAnimId = null;
var turnTestRestPoses = {};
var turnTestState = {};
var _TURN_TEST_RATE = 0.3; // rad/s — 极慢 (~17°/s)
var _TURN_TEST_STRIDE = 0.05; // 极小步幅
var _TURN_TEST_CYCLE = 3.5; // 完整周期 3.5s (A+B各半)

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
  // 停掉其他测试
  if (ikTestActive) toggleHexIKTest();
  turnTestActive = !turnTestActive;
  var btn = document.getElementById('toggle-turntest');
  if (!btn) return;

  if (turnTestActive) {
    btn.classList.add('active');
    btn.textContent = '⏹ 停止转弯验证';

    // ── 隐藏非必要部件，只保留车体+腿 ──
    var hexRoot = null;
    M.modelRoot.children.forEach(function(c) { if (c.name === '六足战车') hexRoot = c; });
    if (!hexRoot) { turnTestActive = false; return; }
    turnTestRestPoses.hexRoot = hexRoot;
    turnTestRestPoses.hexRootX = hexRoot.position.x;
    turnTestRestPoses.hexRootY = hexRoot.position.y;
    turnTestRestPoses.hexRootZ = hexRoot.position.z;
    turnTestRestPoses.hexRootRotY = hexRoot.rotation.y;

    // 收集所有顶层子节点，只显示车体+腿
    var keepNames = ['车体', '左前腿', '右前腿', '左中腿', '右中腿', '左后腿', '右后腿'];
    turnTestRestPoses.hiddenParts = [];
    hexRoot.children.forEach(function(child) {
      var shouldKeep = keepNames.indexOf(child.name) >= 0;
      if (!shouldKeep) {
        turnTestRestPoses.hiddenParts.push(child);
        child.visible = false;
      }
    });
    // 在车体内部: 显示下车体, 隐藏上车体/装甲/武器等
    var bodyGroup = null;
    hexRoot.children.forEach(function(c) { if (c.name === '车体') bodyGroup = c; });
    if (bodyGroup) {
      bodyGroup.children.forEach(function(c) {
        if (c.name !== '下车体') { c.visible = false; turnTestRestPoses.hiddenParts.push(c); }
      });
    }

    // ── 收集6腿引用 ──
    turnTestState.legs = [];
    for (var li = 0; li < _hexaLegPrefixes.length; li++) {
      var prefix = _hexaLegPrefixes[li];
      var thighInfo = M.nodeMap.get(prefix + '大腿');
      var shinInfo  = M.nodeMap.get(prefix + '小腿');
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
        restThighX: thighInfo.rotTarget.rotation.x,
        restShinX: shinInfo.rotTarget.rotation.x,
        restAnkleX: ankleInfo.rotTarget.rotation.x,
        restLegY: thighInfo.group.parent.rotation.y,
        tipWorld: tipWorld.clone(), tipLocal: tipLocal,
        plantPos: null, swingFrom: null, swingTo: null
      });
    }

    // ── 初始化三角步态 ──
    // A组(左前+右中+左后) 起始支撑, B组(右前+左中+右后) 起始摆动
    turnTestState.cycleTimer = 0;
    turnTestState.startTime = performance.now();
    turnTestState.totalTime = 0;
    hexRoot.updateMatrixWorld(true);
    for (var li2 = 0; li2 < turnTestState.legs.length; li2++) {
      var lg = turnTestState.legs[li2];
      var tipW = lg.tipLocal.clone().applyMatrix4(lg.anklePivot.matrixWorld);
      lg.plantPos = tipW.clone();
      lg._groundY = tipW.y; // 固定参考
      lg.swingFrom = null; lg.swingTo = null;
      lg.tripodA = (['左前','右中','左后'].indexOf(lg.prefix) >= 0);
    }

    // ── 可视化标记 ──
    // 身体中心: 蓝色大球
    var bc = new THREE.Vector3(); hexRoot.getWorldPosition(bc);
    _turnTestDot(bc, 0x3388ff, '_ttBodyCenter');
    // 每腿: 红色 plantPos + 绿色 swingTarget
    for (var li3 = 0; li3 < turnTestState.legs.length; li3++) {
      _turnTestDot(turnTestState.legs[li3].plantPos, 0xff3333, '_ttPlant_' + li3);
      _turnTestDot(turnTestState.legs[li3].plantPos, 0x33ff33, '_ttSwing_' + li3);
    }

    turnTestAnimId = requestAnimationFrame(_turnTestLoop);
  } else {
    // ── 停止 ──
    btn.classList.remove('active');
    btn.textContent = '\u{1f504} 转弯验证';
    if (turnTestAnimId) { cancelAnimationFrame(turnTestAnimId); turnTestAnimId = null; }
    _turnTestCleanupDots();
    // 恢复隐藏的部件
    var rp = turnTestRestPoses;
    if (rp.hexRoot) {
      rp.hexRoot.position.set(rp.hexRootX, rp.hexRootY, rp.hexRootZ);
      rp.hexRoot.rotation.y = rp.hexRootRotY;
      rp.hexRoot.updateMatrixWorld(true);
    }
    if (rp.hiddenParts) {
      rp.hiddenParts.forEach(function(c) { c.visible = true; });
    }
    // 恢复腿关节
    if (turnTestState.legs) {
      for (var li4 = 0; li4 < turnTestState.legs.length; li4++) {
        var l = turnTestState.legs[li4];
        l.thighPivot.rotation.x = l.restThighX;
        l.shinPivot.rotation.x = l.restShinX;
        l.anklePivot.rotation.x = l.restAnkleX;
        l.thighGroup.parent.rotation.y = l.restLegY;
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
  // 身体仅旋转，不平移
  hexRoot.rotation.y += turnRate * dt;
  hexRoot.updateMatrixWorld(true);

  var bodyC = new THREE.Vector3(); hexRoot.getWorldPosition(bodyC);
  _turnTestUpdateDot('_ttBodyCenter', bodyC);

  // ── 三角步态: A/B 组交替 ──
  var halfCycle = _TURN_TEST_CYCLE / 2;
  var gaitCycles = totalT / _TURN_TEST_CYCLE;
  // A组: phaseOffset=0 (stance first), B组: phaseOffset=0.5 (swing first)
  for (var i = 0; i < turnTestState.legs.length; i++) {
    var leg = turnTestState.legs[i];
    leg.anklePivot.rotation.x = leg.restAnkleX;
    var phaseOffset = leg.tripodA ? 0 : 0.5;
    var gaitT = (gaitCycles + phaseOffset) % 1;
    var inStance = (gaitT < 0.5);
    var stanceFrac = inStance ? gaitT * 2 : (gaitT - 0.5) * 2;

    if (inStance) {
      // 支撑相: 锁脚尖到 plantPos
      if (!leg._wasStance) {
        hexRoot.updateMatrixWorld(true);
        leg.plantPos = leg.tipLocal.clone().applyMatrix4(leg.anklePivot.matrixWorld);
        _turnTestUpdateDot('_ttPlant_' + i, leg.plantPos);
      }
      _turnTestCcdLeg(leg, leg.plantPos, 20 + Math.round(Math.abs(turnRate) * 13), hexRoot);
    } else {
      // 摆动相: 旋转 plantPos 绕身体中心作为落地目标
      if (leg._wasStance) {
        leg.swingFrom = leg.plantPos.clone();
        var toFoot = leg.plantPos.clone().sub(bodyC); toFoot.y = 0;
        var footDist = toFoot.length() || 1;
        var footAngle = Math.atan2(toFoot.z, toFoot.x);
        // 腿反向踏步: body转CCW→腿落点CW, 使下次支撑可推动body
        // 反向全周期位移: 方向与身体相反, 幅度=全周期
        var newAngle = footAngle - turnRate * _TURN_TEST_CYCLE;
        leg.swingTo = bodyC.clone();
        leg.swingTo.x += Math.cos(newAngle) * footDist;
        leg.swingTo.z += Math.sin(newAngle) * footDist;
        leg.swingTo.y = leg._groundY;
        _turnTestUpdateDot('_ttSwing_' + i, leg.swingTo);
      }
      if (!leg.swingFrom) {
        leg.swingFrom = leg.plantPos.clone();
        var tf2 = leg.plantPos.clone().sub(bodyC); tf2.y = 0;
        var fd2 = tf2.length() || 1;
        var fa2 = Math.atan2(tf2.z, tf2.x);
        leg.swingTo = bodyC.clone();
        leg.swingTo.x += Math.cos(fa2 - turnRate * _TURN_TEST_CYCLE) * fd2;
        leg.swingTo.z += Math.sin(fa2 - turnRate * _TURN_TEST_CYCLE) * fd2;
        leg.swingTo.y = leg._groundY;
        _turnTestUpdateDot('_ttSwing_' + i, leg.swingTo);
      }
      var tgt = new THREE.Vector3().lerpVectors(leg.swingFrom, leg.swingTo, stanceFrac);
      tgt.y += Math.sin(stanceFrac * Math.PI) * 0.12; // 明显抬腿
      _turnTestCcdLeg(leg, tgt, 20 + Math.round(Math.abs(turnRate) * 13), hexRoot);
    }
    leg._wasStance = inStance;
  }
}

function _turnTestCcdLeg(leg, targetWorld, iters, hexRoot) {
  var damp = 0.8;
  var lp = leg.thighGroup.parent, tp = leg.thighPivot;
  var sp = leg.shinPivot, ap = leg.anklePivot;
  for (var iter = 0; iter < iters; iter++) {
    hexRoot.updateMatrixWorld(true);
    var tipW = leg.tipLocal.clone().applyMatrix4(ap.matrixWorld);
    var d, l;
    var tW = new THREE.Vector3(); tp.getWorldPosition(tW);
    d = tipW.clone().sub(tW).normalize(); var dt = targetWorld.clone().sub(tW).normalize();
    var ax = new THREE.Vector3().crossVectors(d, dt); l = ax.length();
    if (l > 0.0003) { ax.normalize(); tp.rotation.x += Math.atan2(l, d.dot(dt)) * ax.dot(_worldX(tp)) * damp; }
    var sW = new THREE.Vector3(); sp.getWorldPosition(sW);
    d = tipW.clone().sub(sW).normalize(); dt = targetWorld.clone().sub(sW).normalize();
    ax = new THREE.Vector3().crossVectors(d, dt); l = ax.length();
    if (l > 0.0003) { ax.normalize(); sp.rotation.x += Math.atan2(l, d.dot(dt)) * ax.dot(_worldX(sp)) * damp; }
    var hW = new THREE.Vector3(); tp.getWorldPosition(hW);
    d = tipW.clone().sub(hW).normalize(); dt = targetWorld.clone().sub(hW).normalize();
    ax = new THREE.Vector3().crossVectors(d, dt); l = ax.length();
    if (l > 0.0003) { ax.normalize(); lp.rotation.y += Math.atan2(l, d.dot(dt)) * ax.dot(_worldY(lp)) * damp; }
    // 髋Y限位: 相对restLegY最多±0.7rad(≈40°)
    var yLimit2 = leg._yLimit || 0.7;
    var diff2 = lp.rotation.y - leg.restLegY;
    while (diff2 > Math.PI) diff2 -= 2*Math.PI;
    while (diff2 < -Math.PI) diff2 += 2*Math.PI;
    if (diff2 > yLimit2) { lp.rotation.y = leg.restLegY + yLimit2; }
    else if (diff2 < -yLimit2) { lp.rotation.y = leg.restLegY - yLimit2; }
  }
}

M.toggleHexTurnTest = toggleHexTurnTest;

// 事件绑定
document.addEventListener('DOMContentLoaded', function() {
  var ttb = document.getElementById('toggle-turntest');
  if (ttb) ttb.addEventListener('click', toggleHexTurnTest);
});
setTimeout(function() {
  var ttb = document.getElementById('toggle-turntest');
  if (ttb) ttb.addEventListener('click', toggleHexTurnTest);
}, 0);

// ═══════════════════════════════════════════
// 射击校准 — 武器支架俯仰可视化
// ═══════════════════════════════════════════
var weaponCalActive = false;
var weaponCalData = null;
// 瞄准线从支架射出: 右=身体左侧(命名反了)
var _WC_MOUNT_NAMES = ['右加特林支架','右导弹支架'];
var _WC_BARREL_NAMES = ['右加特林枪管1','右导弹管1']; // 仅用于取枪管方向
var _WC_LINE_LEN = 2.5;

function toggleWeaponCalibrate() {
  // 已在运行→先清理
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
  weaponCalData = { muzzles:[], gatPitch:0, misPitch:0 };
  var hexRoot = null;
  M.modelRoot.children.forEach(function(c) { if (c.name === '六足战车') hexRoot = c; });
  if (!hexRoot) { weaponCalActive = false; return; }
  hexRoot.updateMatrixWorld(true);

  // 收集支架和枪管节点, 创建枢轴组让武器绕支架旋转
  var mountNodes = {};
  var barrelDirs = {};
  hexRoot.traverse(function(node) {
    var mi = _WC_MOUNT_NAMES.indexOf(node.name);
    if (mi >= 0) { mountNodes[mi] = node; node.updateMatrixWorld(); }
    var bi = _WC_BARREL_NAMES.indexOf(node.name);
    if (bi >= 0) { node.updateMatrixWorld(); var wq=new THREE.Quaternion(); node.getWorldQuaternion(wq); barrelDirs[bi]=new THREE.Vector3(0,1,0).applyQuaternion(wq).normalize(); }
  });

  weaponCalData.pivots = [];
  for (var ni = 0; ni < _WC_MOUNT_NAMES.length; ni++) {
    var mount = mountNodes[ni];
    var dir = barrelDirs[ni];
    if (!mount || !dir) continue;
    var wp = new THREE.Vector3(); mount.getWorldPosition(wp);
    var wq = new THREE.Quaternion(); mount.getWorldQuaternion(wq);
    var lz = new THREE.Vector3(0,0,1).applyQuaternion(wq).normalize(); // 世界空间Z轴(瞄准线用)
    var isGat = mount.name.indexOf('加特林')>=0;
    var color = isGat ? 0xffaa00 : 0xff6666;

    // 瞄准线+球 (场景直接子节点, 世界坐标)
    var lineGeo = new THREE.BufferGeometry().setFromPoints([wp.clone(), wp.clone().addScaledVector(dir, _WC_LINE_LEN)]);
    var line = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({color:color}));
    line.name = '_wc_aim_'+ni; getScene().add(line);
    var dot = new THREE.Mesh(new THREE.SphereGeometry(0.05,6,4), new THREE.MeshBasicMaterial({color:color}));
    dot.position.copy(wp); dot.name = '_wc_dot_'+ni; getScene().add(dot);

    // ── 创建枢轴组: 让武器绕支架旋转 ──
    var weaponGroup = mount.parent; // 支架所在武器组 (左/右加特林 或 左/右导弹巢)
    var grandParent = weaponGroup.parent;
    var mountLocal = mount.position.clone(); // 支架在武器组中的本地位置

    // 保存武器组原始矩阵(在grandParent空间)用于cleanup恢复
    var origMatrix = weaponGroup.matrix.clone();

    // 获取grandParent的世界变换, 用于世界→本地坐标转换
    var gpWorldPos = new THREE.Vector3(); grandParent.getWorldPosition(gpWorldPos);
    var gpWorldQuat = new THREE.Quaternion(); grandParent.getWorldQuaternion(gpWorldQuat);

    // 支架世界位置→grandParent本地空间
    var mountInGP = wp.clone().sub(gpWorldPos).applyQuaternion(gpWorldQuat.clone().invert());
    // 旋转轴世界方向→grandParent本地空间
    var lzInGP = lz.clone().applyQuaternion(gpWorldQuat.clone().invert()).normalize();

    var pivot = new THREE.Group();
    pivot.name = '_wc_pivot_'+ni;
    // 插入枢轴: grandParent → pivot → weaponGroup
    grandParent.remove(weaponGroup);
    grandParent.add(pivot);
    pivot.position.copy(mountInGP);   // 枢轴在grandParent本地空间置于支架位置
    pivot.rotation.set(0,0,0);
    pivot.add(weaponGroup);
    // 武器组偏移: 让支架恰好落在枢轴原点(旋转中心)
    weaponGroup.position.copy(mountLocal).multiplyScalar(-1);
    grandParent.updateMatrixWorld(true);

    weaponCalData.pivots.push({pivot:pivot, weaponGroup:weaponGroup, grandParent:grandParent, origMatrix:origMatrix, lz:lzInGP});
    weaponCalData.muzzles.push({mount:mount, muzzle:wp, dir:dir, lz:lz, line:line, dot:dot, name:mount.name, isGat:isGat});
  }

  if (weaponCalData.muzzles.length === 0) { weaponCalActive = false; if(btn)btn.classList.remove('active'); return; }
  // 双滑块
  var gatSlider = document.getElementById('weaponcal-gat');
  var misSlider = document.getElementById('weaponcal-mis');
  if (gatSlider) { gatSlider.value = 0; gatSlider.oninput = function() { _onCalSlider('gatling', this.value); }; }
  if (misSlider) { misSlider.value = 0; misSlider.oninput = function() { _onCalSlider('missile', this.value); }; }
}

function _onCalSlider(type, valDeg) {
  var deg = parseFloat(valDeg);
  var rad = deg * Math.PI / 180;
  if (!weaponCalData) return;
  if (type === 'gatling') {
    weaponCalData.gatPitch = rad;
    document.getElementById('weaponcal-val-gat').textContent = deg + '°';
  } else {
    weaponCalData.misPitch = rad;
    document.getElementById('weaponcal-val-mis').textContent = deg + '°';
  }
  // 旋转武器枢轴
  if (weaponCalData.pivots) {
    for (var p = 0; p < weaponCalData.pivots.length; p++) {
      var pv = weaponCalData.pivots[p];
      // 找到对应的支架名判断武器类型
      var pname = pv.weaponGroup.name || '';
      var isGat = pname.indexOf('加特林')>=0;
      var pitch = isGat ? (weaponCalData.gatPitch || 0) : (weaponCalData.misPitch || 0);
      pv.pivot.quaternion.setFromAxisAngle(pv.lz, pitch);
    }
  }
  // 更新瞄准线
  for (var i = 0; i < weaponCalData.muzzles.length; i++) {
    var m = weaponCalData.muzzles[i];
    var pitch = m.isGat ? (weaponCalData.gatPitch || 0) : (weaponCalData.misPitch || 0);
    _updateOneMuzzleLine(m, pitch);
  }
}

function _updateOneMuzzleLine(m, pitchRad) {
  var cosA = Math.cos(pitchRad), sinA = Math.sin(pitchRad);
  var kxv = new THREE.Vector3().crossVectors(m.lz, m.dir);
  var kdv = m.lz.dot(m.dir);
  var newDir = new THREE.Vector3()
    .addScaledVector(m.dir, cosA)
    .addScaledVector(kxv, sinA)
    .addScaledVector(m.lz, kdv * (1 - cosA))
    .normalize();
  var pts = [m.muzzle.clone(), m.muzzle.clone().addScaledVector(newDir, _WC_LINE_LEN)];
  m.line.geometry.dispose();
  m.line.geometry = new THREE.BufferGeometry().setFromPoints(pts);
}

function _weaponCalCleanup() {
  weaponCalActive = false;
  // 恢复武器层级: 还原原始矩阵, 移除枢轴
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
  // 清除瞄准线和球
  var sc = getScene();
  for (var i = sc.children.length-1; i >= 0; i--) {
    var c = sc.children[i];
    if (c.name && c.name.indexOf('_wc_') === 0) { sc.remove(c); if(c.geometry)c.geometry.dispose(); if(c.material)c.material.dispose(); }
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
