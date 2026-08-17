// skirt_tree_dump.js — dump 烘焙树 pelvis 子树结构（找裙腰高度处的实心部件）
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
['student_f', 'teacher_f'].forEach(function (vk) {
  var tree = HC.MODELS[vk].tree;
  var pelvis = findNode(tree, 'pelvis');
  console.log('════════ ' + vk + ' pelvis 子树（pelvis 局部坐标）════════');
  function walk(n, depth, yOff, xOff) {
    var y = (n.position ? n.position[1] : 0) + yOff;
    var x = (n.position ? n.position[0] : 0) + xOff;
    var sz = n.size ? n.size.map(function (v) { return +(+v).toFixed(3); }) : null;
    console.log(
      new Array(depth + 1).join('  ') + n.name + ' [' + n.type + ']' +
      (sz ? ' size=' + JSON.stringify(sz) : '') +
      ' pos=' + (n.position ? '[' + n.position.map(function (v) { return +v.toFixed(3); }).join(',') + ']' : '[-]') +
      ' → 局部y=' + (+y).toFixed(3) +
      (n.pivot ? ' pivot=' + JSON.stringify(n.pivot.map(function (v) { return +v.toFixed(3); })) : '') +
      (n.materialId ? ' mat=' + n.materialId : '')
    );
    (n.children || []).forEach(function (c) { walk(c, depth + 1, y, x); });
  }
  walk(pelvis, 0, 0, 0);
  console.log('');
});
