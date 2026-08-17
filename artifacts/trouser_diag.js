// trouser_diag.js — 男教师裤管两段式重叠/戳出诊断
// 渲染语义（enemies.js buildNode childComp=-pivot）：addon 在关节坐标系中心 = position[1] - parentPivot[1]
var fs = require('fs');
var path = require('path');
var vm = require('vm');
var src = fs.readFileSync(path.join(__dirname, '..', 'models', 'humanoid_config.js'), 'utf8');
var sandbox = { window: {}, console: { log: function () {}, warn: function () {} } };
vm.createContext(sandbox);
vm.runInContext(src, sandbox);
var HC = sandbox.window.HumanoidConfig;

function findNode(n, name) {
  if (n.name === name) return n;
  if (n.children) for (var i = 0; i < n.children.length; i++) { var r = findNode(n.children[i], name); if (r) return r; }
  return null;
}
function getTrack(acts, joint, axis) {
  for (var i = 0; i < acts.length; i++)
    if (acts[i].joint === joint && acts[i].axis === axis && acts[i].prop === 'rotation') return acts[i].keys;
  return null;
}
function lerpKeys(keys, t) {
  for (var i = 0; i < keys.length - 1; i++) if (t >= keys[i].t && t <= keys[i + 1].t) {
    var f = (t - keys[i].t) / (keys[i + 1].t - keys[i].t);
    return keys[i].v + (keys[i + 1].v - keys[i].v) * f;
  }
  return keys[keys.length - 1].v;
}

var tree = HC.MODELS.teacher_m.tree;
var ul = findNode(tree, 'l_upper_leg');
var ll = findNode(tree, 'l_lower_leg');
var tr = findNode(tree, 'ah_tr_l'); // 大腿段
var tc = findNode(tree, 'ah_tc_l'); // 小腿段
var foot = findNode(tree, 'l_foot');

var ulPivot = ul.pivot[1], llPivot = ll.pivot[1];
var thighLen = ul.size[1], calfLen = ll.size[1];
// 髋关节坐标系（原点=髋）
var trCenter = tr.position[1] - ulPivot; // 大腿段中心（髋下为负）
var trH = tr.size[1];
var trTop = trCenter + trH / 2, trBot = trCenter - trH / 2;
// 膝关节坐标系（原点=膝）
var tcCenter = tc.position[1] - llPivot;
var tcH = tc.size[1];
var tcTop = tcCenter + tcH / 2, tcBot = tcCenter - tcH / 2;

console.log('═══ teacher_m 裤管几何（关节坐标系）═══');
console.log('骨架: 髋pivot=' + ulPivot + ' 大腿长=' + thighLen + ' | 膝pivot=' + llPivot + ' 小腿长=' + calfLen);
console.log('大腿段 ah_tr_l: pos=' + tr.position[1] + ' → 髋系中心=' + trCenter.toFixed(3) + ' 高=' + trH + ' → 髋系范围[' + trBot.toFixed(3) + ', ' + trTop.toFixed(3) + ']（膝在 -' + thighLen.toFixed(3) + '）');
console.log('  → 裤底' + (trBot < -thighLen ? '低于膝 ' + (-thighLen - trBot).toFixed(3) + ' ⚠超长' : '在膝上 ' + (trBot + thighLen).toFixed(3)));
console.log('小腿段 ah_tc_l: pos=' + tc.position[1] + ' → 膝系中心=' + tcCenter.toFixed(3) + ' 高=' + tcH + ' → 膝系范围[' + tcBot.toFixed(3) + ', ' + tcTop.toFixed(3) + ']（踝在 -' + calfLen.toFixed(3) + '）');
console.log('  → 裤底距踝 ' + (tcBot + calfLen).toFixed(3) + ' | 裤顶过膝 ' + tcTop.toFixed(3));
console.log('静态重叠（沿腿轴）= ' + (tcTop + (trBot + thighLen)).toFixed(3) + '（膝上 ' + tcTop.toFixed(3) + ' + 膝下 ' + (-thighLen - trBot).toFixed(3) + '）');

// 动态：骨盆坐标系里，大腿旋转 φ（髋）、小腿旋转 ψ（膝，相对大腿 ψ-φ）
// 大腿段底-前角在膝系: (y=-δ, z=+h/2)，转到小腿系判是否戳出小腿盒
var hwTr = tr.size[0] / 2, hwTc = tc.size[0] / 2;
var anims = HC.MODELS.teacher_m.zombieAnims.actions;
['Walk', 'Run'].forEach(function (an) {
  var kU = getTrack(anims[an], 'l_upper_leg', 'x') || [{t:0,v:0},{t:1,v:0}];
  var kL = getTrack(anims[an], 'l_lower_leg', 'x') || [{t:0,v:0},{t:1,v:0}];
  var worst = 0, wt = 0, wRel = 0;
  for (var f = 0; f <= 200; f++) {
    var t = f / 200;
    var phi = lerpKeys(kU, t), psi = lerpKeys(kL, t);
    var rel = psi - phi; // 膝相对大腿折角
    if (rel <= 0.01) continue;
    var c = Math.cos(rel), s = Math.sin(rel);
    // 大腿段底部 4 角（膝系 y=trBot+thighLen（负=膝下）, z=±hwTr）
    var dy = trBot + thighLen;
    [[dy, hwTr], [dy, -hwTr]].forEach(function (pt) {
      var y = pt[0], z = pt[1];
      // 膝系 → 小腿系：rotate by -rel
      var yc = y * c + z * s;
      var zc = -y * s + z * c;
      // 戳出量：超出小腿盒（y∈[tcBot-0.1, tcTop], z∈[-hwTc, hwTc]）
      var poke = Math.max(0, Math.abs(zc) - hwTc, tcBot - 0.1 - yc > 0 ? 0 : 0);
      poke = Math.max(Math.abs(zc) - hwTc, 0);
      if (poke > worst) { worst = poke; wt = t; wRel = rel; }
    });
  }
  console.log(an + ': 最大戳出（大腿段底角穿小腿盒侧面）= ' + worst.toFixed(3) + ' @t=' + wt.toFixed(2) + '（相对折角 ' + wRel.toFixed(2) + 'rad）');
});
