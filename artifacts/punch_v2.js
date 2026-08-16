// codemod v2: Punch 力度感增强——蓄力极限(肘拉到躯干后方) + 爆发摆幅/扭腰加大
// 蓄力(t=0.45): r_upper_arm x +0.85(上臂后摆49°,肘出躯干后) + r_forearm x -2.05(极限屈肘,拳收肩侧)
// 爆发(t=0.55): r_upper_arm x -1.4(摆幅2.25rad) + 扭腰 -0.32→+0.52 + 后膝蹬直0.08
const fs = require('fs');
const FILE = 'models/humanoid_config.js';
let src = fs.readFileSync(FILE, 'utf8');

const PUNCH = [
  { kind: 'O', joint: 'torso', prop: 'rotation', axis: 'y', restKey: null, keys: [ { t: 0, v: 0 }, { t: 0.45, v: -0.32 }, { t: 0.55, v: 0.52 }, { t: 0.65, v: 0.45 }, { t: 1, v: 0 } ] },
  { kind: 'O', joint: 'torso', prop: 'rotation', axis: 'x', restKey: 'torso:x', keys: [ { t: 0, v: 0.04 }, { t: 0.45, v: -0.06 }, { t: 0.55, v: 0.2 }, { t: 0.65, v: 0.16 }, { t: 1, v: 0.04 } ] },
  { kind: 'P', joint: 'torso_upper', prop: 'rotation', axis: 'y', restKey: null, keys: [ { t: 0, v: 0 }, { t: 0.45, v: -0.14 }, { t: 0.55, v: 0.22 }, { t: 0.65, v: 0.18 }, { t: 1, v: 0 } ] },
  { kind: 'P', joint: 'head', prop: 'rotation', axis: 'y', restKey: null, keys: [ { t: 0, v: 0 }, { t: 0.45, v: 0.12 }, { t: 0.55, v: -0.2 }, { t: 0.65, v: -0.16 }, { t: 1, v: 0 } ] },
  { kind: 'P', joint: 'r_upper_arm', prop: 'rotation', axis: 'x', restKey: null, keys: [ { t: 0, v: -0.45 }, { t: 0.45, v: 0.85 }, { t: 0.55, v: -1.4 }, { t: 0.65, v: -1.32 }, { t: 1, v: -0.45 } ] },
  { kind: 'P', joint: 'r_forearm', prop: 'rotation', axis: 'x', restKey: null, keys: [ { t: 0, v: -1.75 }, { t: 0.45, v: -2.05 }, { t: 0.55, v: -0.18 }, { t: 0.65, v: -0.35 }, { t: 1, v: -1.75 } ] },
  { kind: 'P', joint: 'l_upper_arm', prop: 'rotation', axis: 'x', restKey: null, keys: [ { t: 0, v: -0.5 }, { t: 0.45, v: -0.35 }, { t: 0.55, v: -0.62 }, { t: 0.65, v: -0.58 }, { t: 1, v: -0.5 } ] },
  { kind: 'P', joint: 'l_forearm', prop: 'rotation', axis: 'x', restKey: null, keys: [ { t: 0, v: -1.8 }, { t: 0.45, v: -1.95 }, { t: 0.55, v: -1.98 }, { t: 0.65, v: -1.92 }, { t: 1, v: -1.8 } ] },
  { kind: 'P', joint: 'l_upper_leg', prop: 'rotation', axis: 'x', restKey: null, keys: [ { t: 0, v: -0.3 }, { t: 0.45, v: -0.2 }, { t: 0.55, v: -0.38 }, { t: 0.65, v: -0.35 }, { t: 1, v: -0.3 } ] },
  { kind: 'P', joint: 'r_upper_leg', prop: 'rotation', axis: 'x', restKey: null, keys: [ { t: 0, v: 0.25 }, { t: 0.45, v: 0.35 }, { t: 0.55, v: 0.08 }, { t: 0.65, v: 0.12 }, { t: 1, v: 0.25 } ] },
  { kind: 'P', joint: 'l_lower_leg', prop: 'rotation', axis: 'x', restKey: null, keys: [ { t: 0, v: 0.35 }, { t: 0.45, v: 0.28 }, { t: 0.55, v: 0.32 }, { t: 0.65, v: 0.33 }, { t: 1, v: 0.35 } ] },
  { kind: 'P', joint: 'r_lower_leg', prop: 'rotation', axis: 'x', restKey: null, keys: [ { t: 0, v: 0.45 }, { t: 0.45, v: 0.65 }, { t: 0.55, v: 0.08 }, { t: 0.65, v: 0.15 }, { t: 1, v: 0.45 } ] },
  { kind: 'O', joint: 'pelvis', prop: 'position', axis: 'y', restKey: 'pelvis:y', keys: [ { t: 0, v: 0 }, { t: 0.45, v: -0.02 }, { t: 0.55, v: -0.06 }, { t: 0.65, v: -0.04 }, { t: 1, v: 0 } ] },
];

function matchBracket(s, startPos) {
  let depth = 0;
  for (let i = startPos; i < s.length; i++) {
    if (s[i] === '[') depth++;
    else if (s[i] === ']') { depth--; if (depth === 0) return i; }
  }
  return -1;
}

let n = 0;
// compact
{
  const tag = '"Punch":[';
  let pos = 0;
  while (true) {
    const i = src.indexOf(tag, pos);
    if (i < 0) break;
    const arrStart = i + tag.length - 1;
    const arrEnd = matchBracket(src, arrStart);
    if (arrEnd < 0) { console.error('FAIL compact'); process.exit(1); }
    const rep = '"Punch":[' + PUNCH.map((t) => JSON.stringify(t)).join(',') + ']';
    src = src.slice(0, i) + rep + src.slice(arrEnd + 1);
    pos = i + rep.length;
    n++;
  }
}
// pretty
{
  const tag = '"Punch": [';
  let pos = 0;
  while (true) {
    const i = src.indexOf(tag, pos);
    if (i < 0) break;
    const lineStart = src.lastIndexOf('\n', i) + 1;
    const indent = src.slice(lineStart, i);
    const arrStart = src.indexOf('[', i + tag.length - 1);
    const arrEnd = matchBracket(src, arrStart);
    if (arrEnd < 0 || indent !== '        ') { console.error('FAIL pretty', JSON.stringify(indent)); process.exit(1); }
    const rep =
      indent + '"Punch": [\r\n' +
      PUNCH.map((t) => JSON.stringify(t, null, 2).split('\n').map((l, li) => (li ? '  ' : '') + l).join('\r\n')).join(',\r\n') +
      '\r\n' + indent + ']';
    src = src.slice(0, lineStart) + rep + src.slice(arrEnd + 1);
    pos = lineStart + rep.length;
    n++;
  }
}
fs.writeFileSync(FILE, src);
console.log('replaced Punch blocks: ' + n);
const after = fs.readFileSync(FILE, 'utf8');
console.log('Punch count:', (after.match(/"Punch": ?\[/g) || []).length);
console.log('has 0.85 key:', after.includes('"v": 0.85') || after.includes('"v":0.85'));
console.log('has -2.05 key:', after.includes('"v": -2.05') || after.includes('"v":-2.05'));
