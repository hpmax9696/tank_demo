// 微调 Die 屈肘角度：手落到与胸/脚同一平面（不再深挖撑地）
const fs = require('fs');
const FILE = 'models/humanoid_config.js';
let src = fs.readFileSync(FILE, 'utf8');

// 紧凑版（BASE_ANIMS 1 处）
const oldCompact =
  '{"kind":"P","joint":"l_forearm","prop":"rotation","axis":"x","restKey":null,"keys":[{"t":0,"v":0},{"t":0.5,"v":-0.3},{"t":1,"v":-0.75}]},{"kind":"P","joint":"r_forearm","prop":"rotation","axis":"x","restKey":null,"keys":[{"t":0,"v":0},{"t":0.5,"v":-0.5},{"t":1,"v":-1.15}]}';
const newCompact =
  '{"kind":"P","joint":"l_forearm","prop":"rotation","axis":"x","restKey":null,"keys":[{"t":0,"v":0},{"t":0.5,"v":-0.25},{"t":1,"v":-0.4}]},{"kind":"P","joint":"r_forearm","prop":"rotation","axis":"x","restKey":null,"keys":[{"t":0,"v":0},{"t":0.5,"v":-0.35},{"t":1,"v":-0.55}]}';

const c1 = src.split(oldCompact).length - 1;
src = src.split(oldCompact).join(newCompact);
console.log('compact forearm blocks replaced:', c1, '(expect 1)');

// pretty 版（4 处）：v": -0.75 → -0.4（l），v": -1.15 → -0.55（r），中段 -0.3→-0.25 / -0.5→-0.35
// pretty 的 l_forearm/r_forearm 块：精确定位 joint 名 + axis x + keys 中替换
function replacePrettyVal(src, joint, midOld, midNew, endOld, endNew) {
  const pat = new RegExp(
    '("joint": "' + joint + '",[\\s\\S]*?"axis": "x",[\\s\\S]*?"v": )' + midOld + '([\\s\\S]*?"v": )' + endOld + '(\\n[\\s]*})',
    'g'
  );
  let n = 0;
  src = src.replace(pat, (m, a, b, c) => { n++; return a + midNew + b + endNew + c; });
  return { src, n };
}
let res1 = replacePrettyVal(src, 'l_forearm', '-0.3', '-0.25', '-0.75', '-0.4');
let res2 = replacePrettyVal(res1.src, 'r_forearm', '-0.5', '-0.35', '-1.15', '-0.55');
console.log('pretty l_forearm:', res1.n, '(expect 4), r_forearm:', res2.n, '(expect 4)');
src = res2.src;

fs.writeFileSync(FILE, src, 'utf8');
console.log('written', FILE);
