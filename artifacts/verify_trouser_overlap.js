// verify_trouser_overlap.js — 男教师裤管两段式重叠修正回归
// 渲染语义（enemies.js buildNode childComp=-pivot）：addon 在关节坐标系中心 = position[1] - parentPivot[1]
// 修正：大腿段 0.46/-0.115 → 0.34/-0.054（底沿膝下 0.172 超长 → 膝下 0.051 合理重叠）
var fs = require('fs');
var path = require('path');
var vm = require('vm');
var src = fs.readFileSync(path.join(__dirname, '..', 'models', 'humanoid_config.js'), 'utf8');
var sandbox = { window: {}, console: { log: function () {}, warn: function () {} } };
vm.createContext(sandbox);
vm.runInContext(src, sandbox);
var HC = sandbox.window.HumanoidConfig;
var pass = 0, fail = 0;
function ok(c, m) { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m); } }

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
var tr = findNode(tree, 'ah_tr_l');
var tc = findNode(tree, 'ah_tc_l');
var ulPivot = ul.pivot[1], llPivot = ll.pivot[1];
var thighLen = ul.size[1], calfLen = ll.size[1];
// 真实膝位（髋系）= l_lower_leg group + 其 pivot = ll.position[1] - ulPivot + llPivot
// （≠ 髋-大腿长：骨架衔接中膝 pivot 比大腿 mesh 底端高 ~0.024——浏览器实测校准过）
var kneeHip = ll.position[1] - ulPivot + llPivot;
var trCenter = tr.position[1] - ulPivot, trH = tr.size[1];
var trTop = trCenter + trH / 2, trBot = trCenter - trH / 2;
var tcCenter = tc.position[1] - llPivot, tcH = tc.size[1];
var tcTop = tcCenter + tcH / 2, tcBot = tcCenter - tcH / 2;
var hwTr = tr.size[0] / 2, hwTc = tc.size[0] / 2;
var belowKnee = -(trBot - kneeHip); // 膝下伸出量（正=低于膝）
var overlap = tcTop + belowKnee;

console.log('大腿段: 高=' + trH + ' 髋系范围[' + trBot.toFixed(3) + ',' + trTop.toFixed(3) + '] → 膝(真实' + kneeHip.toFixed(3) + ')下 ' + belowKnee.toFixed(3) + '（修正前 0.172）');
console.log('小腿段: 膝系范围[' + tcBot.toFixed(3) + ',' + tcTop.toFixed(3) + '] 顶过膝 ' + tcTop.toFixed(3) + ' 底距踝 ' + (tcBot + calfLen).toFixed(3));
console.log('静态重叠 = ' + overlap.toFixed(3) + ' | 半宽: 大腿段 ' + hwTr.toFixed(3) + ' / 小腿段 ' + hwTc.toFixed(3));

ok(Math.abs(belowKnee - 0.05) < 0.006, '大腿段底沿 = 膝下 0.05（实测 ' + belowKnee.toFixed(3) + '，修正前 0.172）');
ok(trTop > -0.08 && trTop < -0.03, '大腿段顶沿盖髋区（' + trTop.toFixed(3) + '，髋下不到 0.08）');
ok(overlap > 0.03 && overlap < 0.08, '静态重叠 0.03~0.08（实测 ' + overlap.toFixed(3) + '，修正前 0.174）');
ok(Math.abs(tcTop) < 0.01 && Math.abs(tcBot + calfLen) < 0.01, '小腿段不动（顶过膝 ' + tcTop.toFixed(3) + ' / 底距踝 ' + (tcBot + calfLen).toFixed(3) + '）');

// 动态：大腿段底四角转到小腿系，检查与小腿盒的关系
// 口径（v2 修正）：前角横向超出（y 重叠区内 |z|>hwTc）= 粗盖细悬垂 ≤0.025（层叠落差，可接受）；
// 后角"开缝" = 后角抬离小腿段顶面（yc > tcTop，两段之间露皮肤楔口）——横向超出不算缝
// （新步态支撑期膝伸直 rel≈0，大腿段宽出 0.009 的静态层叠属正常裤型，旧判据误报）
var anims = HC.MODELS.teacher_m.zombieAnims.actions;
['Walk', 'Run'].forEach(function (an) {
  var kU = getTrack(anims[an], 'l_upper_leg', 'x') || [{t:0,v:0},{t:1,v:0}];
  var kL = getTrack(anims[an], 'l_lower_leg', 'x') || [{t:0,v:0},{t:1,v:0}];
  var worstFront = 0, worstBack = 0, wt = 0;
  for (var f = 0; f <= 200; f++) {
    var t = f / 200;
    var rel = lerpKeys(kL, t) - lerpKeys(kU, t);
    if (rel <= 0.01) continue;
    var c = Math.cos(rel), s = Math.sin(rel);
    var dy = trBot - kneeHip; // 底沿相对真实膝（负=膝下）
    [[dy, hwTr, 'front'], [dy, -hwTr, 'back']].forEach(function (pt) {
      var y = pt[0], z = pt[1];
      var yc = y * c + z * s;
      var zc = -y * s + z * c;
      if (pt[2] === 'front') {
        // 前角：与小腿 y 重叠时的横向超出 = 悬垂落差
        if (yc > tcBot - 0.02 && yc < tcTop + 0.02) {
          var poke = Math.abs(zc) - hwTc;
          if (poke > worstFront) { worstFront = poke; wt = t; }
        }
      } else {
        // 后角：抬离小腿顶面 = 开缝（露皮肤楔口）
        if (yc - tcTop > worstBack) worstBack = yc - tcTop;
      }
    });
  }
  console.log(an + ': 前角悬垂 ' + worstFront.toFixed(3) + ' / 后角开缝(抬离顶面) ' + worstBack.toFixed(3) + ' @t=' + wt.toFixed(2));
  ok(worstFront <= 0.025, an + ' 前角悬垂 ≤0.025（粗盖细自然落差，实测 ' + worstFront.toFixed(3) + '，修正前 0.12 穿透）');
  ok(worstBack <= 0.005, an + ' 后角不开缝（后角低于小腿顶面，实测超出 ' + worstBack.toFixed(3) + '）');
});
console.log('verify_trouser_overlap: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
