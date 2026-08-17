// verify_skirt_space.js — 裙摆空间利用复核 + v0.79.34/c 回归断言
// v0.79.34: gapBottom→0.13 + 锥心 z+0.02 + 裙摆轨道跟腿耦合（K=0.35×左大腿）
// v0.79.34b: 圆锥→圆台（rTop 0.077→0.157 包裹骨盆）；裙不参与 wrapMax
// v0.79.34c: 圆台顶面→椭圆（rx 0.157 / rz 0.105 贴合躯干厚度，正/背面腰不再凸圆弧）；
//            学生裙缩短 0.32→0.295（膝上5cm）；骨盆顶深钳制 0.14（防角刺出椭圆壁）
// 口径：烘焙树真实几何 + zombieAnims 真实轨道；200帧逐帧仿真（同帧双腿+裙摆联动）
var fs = require('fs');
var path = require('path');
var vm = require('vm');

var src = fs.readFileSync(path.join(__dirname, '..', 'models', 'humanoid_config.js'), 'utf8');
var sandbox = { window: {}, console: { log: function () {}, warn: function () {} } };
vm.createContext(sandbox);
vm.runInContext(src, sandbox);
var HC = sandbox.window.HumanoidConfig;
var log = console.log;
var pass = 0, fail = 0;
function ok(c, m) { if (c) { pass++; log('  ✓ ' + m); } else { fail++; log('  ✗ ' + m); } }

function findNode(n, name) {
  if (n.name === name) return n;
  if (n.children) for (var i = 0; i < n.children.length; i++) { var r = findNode(n.children[i], name); if (r) return r; }
  return null;
}
function lerpKeys(keys, t) {
  for (var i = 0; i < keys.length - 1; i++) {
    if (t >= keys[i].t && t <= keys[i + 1].t) {
      var f = (t - keys[i].t) / (keys[i + 1].t - keys[i].t);
      return keys[i].v + (keys[i + 1].v - keys[i].v) * f;
    }
  }
  return keys[keys.length - 1].v;
}
function getTrack(acts, joint, axis) {
  for (var i = 0; i < acts.length; i++)
    if (acts[i].joint === joint && acts[i].axis === axis && acts[i].prop === 'rotation') return acts[i].keys;
  return null;
}
// 椭圆在方向 φ 上的半径
function ellipR(phi, rx, rz) {
  var c = Math.cos(phi), s = Math.sin(phi);
  return 1 / Math.sqrt((c / rx) * (c / rx) + (s / rz) * (s / rz));
}

// 下躯干盒子参数（dump 实测 + v0.79.34c 裙变体钳制 bd≤0.14/bz≥-0.01，pelvis 局部）
var TLOWER = {
  student_f: { y0: 0.068, h: 0.154, bw: 0.3, tw: 0.2, bd: 0.14, td: 0.16, zBase: -0.035, bz: -0.01, oz: -0.008, zOff: 0.04 },
  teacher_f: { y0: 0.068, h: 0.154, bw: 0.3, tw: 0.16, bd: 0.14, td: 0.12, zBase: -0.04, bz: -0.01, oz: 0, zOff: 0.04 },
};

['student_f', 'teacher_f'].forEach(function (vk) {
  var skirtName = vk === 'student_f' ? 'ah_skirt' : 'ah_gskirt';
  var tree = HC.MODELS[vk].tree;
  var legL = findNode(tree, 'l_upper_leg');
  var skirt = findNode(tree, skirtName);
  var pelvis = findNode(tree, 'pelvis');
  var dx = Math.abs(legL.position[0]);
  var hipY = legL.position[1] + (legL.pivot ? legL.pivot[1] : 0);
  var thighLen = legL.size[1];
  var kneeY = hipY - thighLen;
  var rT = legL.size[0];
  var hSkirt = skirt.size[1];
  var rxTop = skirt.size[0];
  var rBot = skirt.size[2];
  var rzTop = skirt.size[3];
  var zc = skirt.position[2];
  var yC = skirt.position[1];
  var yTop = yC + hSkirt / 2;
  var hemY = yC - hSkirt / 2;
  var pelvisBot = -pelvis.size[1] / 2;
  var pelvisTop = pelvis.size[1] / 2;

  var anims = HC.MODELS[vk].zombieAnims.actions;
  var kl = getTrack(anims.Run, 'l_upper_leg', 'x') || [{t:0,v:0},{t:1,v:0}];
  var kr = getTrack(anims.Run, 'r_upper_leg', 'x') || [{t:0,v:0},{t:1,v:0}];
  var ks = getTrack(anims.Run, skirtName, 'x') || [{t:0,v:0},{t:1,v:0}];

  // 裙底（圆）逐帧需求
  function frameReq() {
    var worst = 0;
    for (var f = 0; f <= 200; f++) {
      var t = f / 200;
      var phi = lerpKeys(ks, t);
      var zHem = zc - (hSkirt / 2) * Math.sin(phi);
      [lerpKeys(kl, t), lerpKeys(kr, t)].forEach(function (th) {
        var zLeg = -(hipY - hemY) * Math.sin(th);
        var mz = rT / Math.cos(Math.abs(th));
        var d = Math.sqrt(dx * dx + Math.pow(zLeg - zHem, 2)) + (rT + mz) / 2;
        if (d > worst) worst = d;
      });
    }
    return worst;
  }
  // 全高椭圆壁 vs 腿包络（含裙倾角）
  function wallScan() {
    var minMargin = 1e9, minAt = null;
    for (var yy = hemY; yy <= Math.min(yTop, pelvisBot) + 0.0001; yy += 0.005) {
      var u = (yTop - yy) / hSkirt;
      var rx = rxTop + (rBot - rxTop) * u;
      var rz = rzTop + (rBot - rzTop) * u;
      for (var f = 0; f <= 100; f++) {
        var t = f / 100;
        var phi = lerpKeys(ks, t);
        var zWall = zc - (yC - yy) * Math.sin(phi);
        var ths = [lerpKeys(kl, t), lerpKeys(kr, t)];
        for (var li = 0; li < 2; li++) {
          var th = ths[li];
          var zLeg = -(hipY - yy) * Math.sin(th);
          var m = (rT + rT / Math.cos(Math.abs(th))) / 2;
          var x = dx, zz = zLeg - zWall;
          var dist = Math.sqrt(x * x + zz * zz);
          var rDir = ellipR(Math.atan2(zz, x), rx, rz);
          if (rDir - dist - m < minMargin) { minMargin = rDir - dist - m; minAt = yy; }
        }
      }
    }
    return { margin: minMargin, y: minAt };
  }
  // 方盒角 vs 椭圆壁（骨盆=同色可容忍 / 下躯干=衣色）：返回各最坏刺出量
  function cornerPokes() {
    var out = { pelvis: 0, tlower: 0 };
    function test(y, hx, hzc, tag) {
      var u = (yTop - y) / hSkirt;
      var rx = rxTop + (rBot - rxTop) * u;
      var rz = rzTop + (rBot - rzTop) * u;
      [[hx, hzc], [hx, -hzc], [-hx, hzc], [-hx, -hzc]].forEach(function (c) {
        var zz = c[1] - zc;
        var dist = Math.sqrt(c[0] * c[0] + zz * zz);
        var poke = dist - ellipR(Math.atan2(zz, c[0]), rx, rz);
        if (poke > out[tag]) out[tag] = poke;
      });
    }
    // 骨盆（TaperedBox，中心 z=oz 插值；顶深已钳 0.14）
    var pb = pelvis.size;
    for (var yy = pelvisBot; yy <= pelvisTop + 1e-4; yy += 0.01) {
      var f = (yy - pelvisBot) / (pelvisTop - pelvisBot);
      var hx = (pb[0] + (pb[3] - pb[0]) * f) / 2;
      var hz = (pb[2] + (pb[4] - pb[2]) * f) / 2;
      var cz = (pb[8] || 0) + ((pb[6] || 0) - (pb[8] || 0)) * f;
      test(yy, hx, cz + hz > 0 ? cz : cz, 'pelvis'); // 近似：角 z = cz ± hz 取两侧
      [[cz + hz], [cz - hz]].forEach(function (zz) {
        var u2 = (yTop - yy) / hSkirt;
        var rx2 = rxTop + (rBot - rxTop) * u2;
        var rz2 = rzTop + (rBot - rzTop) * u2;
        var z2 = zz[0] - zc;
        var dist = Math.sqrt(hx * hx + z2 * z2);
        var poke = dist - ellipR(Math.atan2(z2, hx), rx2, rz2);
        if (poke > out.pelvis) out.pelvis = poke;
      });
    }
    // 下躯干（TaperedBox，净中心 z = zOff+zBase + bz→oz 插值）
    var tl = TLOWER[vk];
    for (var y2 = tl.y0; y2 <= Math.min(tl.y0 + tl.h, yTop) + 1e-4; y2 += 0.01) {
      var f2 = (y2 - tl.y0) / tl.h;
      var hx2 = (tl.bw + (tl.tw - tl.bw) * f2) / 2;
      var hz2 = (tl.bd + (tl.td - tl.bd) * f2) / 2;
      var cz2 = tl.zOff + tl.zBase + tl.bz + (tl.oz - tl.bz) * f2;
      [cz2 + hz2, cz2 - hz2].forEach(function (zz2) {
        var u3 = (yTop - y2) / hSkirt;
        var rx3 = rxTop + (rBot - rxTop) * u3;
        var rz3 = rzTop + (rBot - rzTop) * u3;
        var z3 = zz2 - zc;
        var dist = Math.sqrt(hx2 * hx2 + z3 * z3);
        var poke = dist - ellipR(Math.atan2(z3, hx2), rx3, rz3);
        if (poke > out.tlower) out.tlower = poke;
      });
    }
    return out;
  }

  var reqRun = frameReq();
  var scan = wallScan();
  var pokes = cornerPokes();

  log('════════ ' + vk + ' ════════');
  log('  几何: 顶椭圆 rx=' + rxTop.toFixed(3) + ' rz=' + rzTop.toFixed(3) + '（旧圆 0.157）底圆 r=' + rBot.toFixed(3) + ' 轴z=' + zc.toFixed(3));
  log('  裙长: 高=' + hSkirt.toFixed(3) + ' 裙底=' + hemY.toFixed(3) + ' 膝=' + kneeY.toFixed(3) + ' → 膝上 ' + (hemY - kneeY).toFixed(3));
  log('  裙底需求=' + reqRun.toFixed(3) + '（余量 ' + (rBot - reqRun).toFixed(3) + '）| 骨盆下壁最薄 ' + scan.margin.toFixed(3) + ' | 角刺出: 骨盆(同色) ' + pokes.pelvis.toFixed(3) + ' / 下躯干(衣色) ' + pokes.tlower.toFixed(3) + '（v0.79.34b 圆台时 ~0.032）');

  ok(skirt.type === 'EllipFrustum', '裙类型 EllipFrustum（椭圆顶圆台）');
  ok(Math.abs(rxTop - (rT + 0.10)) < 0.002, '顶X半轴 = 大腿r+0.10 = ' + (rT + 0.10).toFixed(3) + '（盖骨盆宽，实测 ' + rxTop.toFixed(3) + '）');
  ok(Math.abs(rzTop - rxTop * 0.67) < 0.002, '顶Z半轴 = rx×0.67 = ' + (rxTop * 0.67).toFixed(3) + '（贴合躯干厚度，实测 ' + rzTop.toFixed(3) + '）');
  ok(Math.abs(rBot - (rT + 0.13)) < 0.002, '底圆半径 = 大腿r+0.13 = ' + (rT + 0.13).toFixed(3) + '（实测 ' + rBot.toFixed(3) + '）');
  ok(Math.abs(zc - 0.02) < 0.003, '裙轴前移 z=+0.02（实测 ' + zc.toFixed(3) + '）');
  var isStudent = vk === 'student_f';
  var hemAbove = hemY - kneeY;
  ok(isStudent ? Math.abs(hemAbove - 0.05) < 0.004 : hemAbove > 0.05, isStudent
    ? '学生裙底 = 膝上 0.05（实测 ' + hemAbove.toFixed(4) + '）'
    : '教师裙底在膝上（实测 ' + hemAbove.toFixed(3) + '，未动）');
  var skirtKeys = getTrack(anims.Run, skirtName, 'x');
  var coupled = skirtKeys && kl.every(function (k, i) { return Math.abs(skirtKeys[i].v - k.v * 0.35) < 0.001; });
  ok(coupled, 'Run 裙摆轨道 = 0.35×左大腿（跟腿耦合）');
  ok(rBot - reqRun >= 0.008, '裙底 Run 极限不穿模（余量 ' + (rBot - reqRun).toFixed(3) + ' ≥ 0.008）');
  ok(scan.margin >= 0.008, '骨盆下全高壁 ≥ 腿包络+0.008（最薄 ' + scan.margin.toFixed(3) + '）');
  ok(pelvis.size[4] <= 0.14 + 1e-6, '骨盆顶深钳制 ≤0.14（实测 ' + pelvis.size[4].toFixed(3) + '，防角刺出椭圆壁）');
  var tlNode = findNode(tree, 'torso_lower');
  ok(tlNode.size[2] <= 0.14 + 1e-6 && tlNode.size[8] >= -0.01 - 1e-6, '下躯干底面钳制 bd≤0.14/bz≥-0.01（实测 ' + tlNode.size[2].toFixed(3) + '/' + tlNode.size[8].toFixed(3) + '）');
  ok(pokes.pelvis <= 0.035, '骨盆角刺出 ≤0.035（同色不可见，实测 ' + pokes.pelvis.toFixed(3) + '）');
  var tlThresh = vk === 'teacher_f' ? 0.05 : 0.035; // 教师 torso_lower 与裙同色(灰/灰)无对比，宽限；学生白对红严判
  ok(pokes.tlower <= tlThresh, '下躯干角刺出 ≤' + tlThresh + (vk === 'teacher_f' ? '（同色宽限）' : '（白对红严判）') + '，实测 ' + pokes.tlower.toFixed(3) + '）');
  log('');
});

log('verify_skirt_space: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
