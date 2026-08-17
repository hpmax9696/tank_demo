// verify_shorts_seam.js — 男学生短裤白色侧缝线验证（数据层）
// 缝线 = shorts_m Box 的 _deco 子节点：尺寸不被 WRAP 改写、x 吸附 wrap 后外侧面、mirror 取反贴 r 腿外侧
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
function findChildren(n, name, out) {
  if (n.name === name) out.push(n);
  if (n.children) n.children.forEach(function (c) { findChildren(c, name, out); });
  return out;
}
function findNode(n, name) {
  if (n.name === name) return n;
  if (n.children) for (var i = 0; i < n.children.length; i++) { var r = findNode(n.children[i], name); if (r) return r; }
  return null;
}

var tree = HC.MODELS.student_m.tree;
var seams = findChildren(tree, 'ah_sm_seam', []);
var legL = findNode(tree, 'l_upper_leg');
var rLimb = legL.size[0]; // 派生后大腿半径
var halfShorts = rLimb + 0.016; // WRAP gap 0.016

console.log('student_m: 缝线节点 ' + seams.length + ' 个 | 大腿r=' + rLimb.toFixed(4) + ' 短裤半宽=' + halfShorts.toFixed(4));
ok(seams.length === 2, '双腿各一条缝线（实测 ' + seams.length + '）');
var shortsNodes = findChildren(tree, 'ah_sh_l', []).filter(function (n) { return n.size && n.type === 'Box' && n.materialId === 'shorts_red'; });
console.log('短裤本体: ' + shortsNodes.length + ' 个 size=' + (shortsNodes[0] ? JSON.stringify(shortsNodes[0].size.map(function (v) { return +v.toFixed(3); })) : '?'));
ok(shortsNodes.length === 2 && Math.abs(shortsNodes[0].size[0] - halfShorts * 2) < 0.001, '短裤本体 wrap 正常（宽 ' + shortsNodes[0].size[0].toFixed(3) + ' = (腿r+0.016)×2）');
seams.forEach(function (s, i) {
  var side = i === 0 ? '左' : '右';
  var expect = (i === 0 ? 1 : -1) * (halfShorts - 0.001);
  ok(Math.abs(s.size[0] - 0.006) < 1e-6 && Math.abs(s.size[1] - 0.18) < 1e-6 && Math.abs(s.size[2] - 0.028) < 1e-6,
    side + '缝线尺寸未被动（0.006×0.18×0.028，实测 ' + s.size.map(function (v) { return +v.toFixed(3); }).join('×') + '）');
  ok(Math.abs(s.position[0] - expect) < 0.001, side + '缝线贴外侧面（x=' + s.position[0].toFixed(3) + ' ≈ ±(' + halfShorts.toFixed(3) + '-0.001)）');
  ok(s.materialId === 'button_white', side + '缝线白色（button_white）');
});
// 缝线在短裤体内不悬空：|x| < 短裤半宽（嵌 0.001）且凸出 0.002
seams.forEach(function (s, i) {
  var outer = Math.abs(s.position[0]) + s.size[0] / 2;
  ok(Math.abs(outer - (halfShorts + 0.002)) < 0.0015, (i === 0 ? '左' : '右') + '缝线凸出裤面 0.002（外沿 ' + outer.toFixed(3) + ' vs 裤面 ' + halfShorts.toFixed(3) + '，防 z-fighting）');
});
// student_f 无短裤缝线（穿裙）；pelvis 不受影响
var treeF = HC.MODELS.student_f.tree;
var seamsF = findChildren(treeF, 'ah_sm_seam', []);
ok(seamsF.length === 0, 'student_f（裙）无短裤缝线（实测 ' + seamsF.length + '）');
var pelvis = findNode(tree, 'pelvis');
ok(Math.abs(pelvis.size[0] - 0.3) < 0.001, 'wrapMax 收集仍取短裤本体（pelvis 0.3 未被缝线 0.003 影响）');
console.log('verify_shorts_seam: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
