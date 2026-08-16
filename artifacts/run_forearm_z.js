// codemod: Run 前臂 z 轴内收轨道（前摆手向前中线, 后摆微收）×5 处
// 符号: 工厂树 l 侧 z 负=内收 / r 侧 z 正=内收; 与 x 屈肘同相位(前摆 t0.5 收紧, 后摆 t0 微收)
const fs = require('fs');
const FILE = 'models/humanoid_config.js';
let src = fs.readFileSync(FILE, 'utf8');

const TRACKS = [
  { kind: 'P', joint: 'l_forearm', prop: 'rotation', axis: 'z', restKey: null, keys: [ { t: 0, v: -0.06 }, { t: 0.25, v: -0.13 }, { t: 0.5, v: -0.2 }, { t: 0.75, v: -0.13 }, { t: 1, v: -0.06 } ] },
  { kind: 'P', joint: 'r_forearm', prop: 'rotation', axis: 'z', restKey: null, keys: [ { t: 0, v: 0.2 }, { t: 0.25, v: 0.13 }, { t: 0.5, v: 0.06 }, { t: 0.75, v: 0.13 }, { t: 1, v: 0.2 } ] },
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
  const tag = '"Run":[';
  let pos = 0;
  while (true) {
    const i = src.indexOf(tag, pos);
    if (i < 0) break;
    const arrStart = i + tag.length - 1;
    const arrEnd = matchBracket(src, arrStart);
    if (arrEnd < 0) { console.error('FAIL compact'); process.exit(1); }
    if (src.slice(arrStart, arrEnd + 1).includes('"axis":"z","restKey":null,"keys":[{"t":0,"v":-0.06}')) { pos = arrEnd + 1; continue; }
    const ins = ',' + TRACKS.map((t) => JSON.stringify(t)).join(',');
    src = src.slice(0, arrEnd) + ins + src.slice(arrEnd); // 插到 ']' 之前
    pos = arrEnd + ins.length;
    n++;
  }
}
// pretty
{
  const tag = '"Run": [';
  let pos = 0;
  while (true) {
    const i = src.indexOf(tag, pos);
    if (i < 0) break;
    const lineStart = src.lastIndexOf('\n', i) + 1;
    const indent = src.slice(lineStart, i);
    const arrStart = src.indexOf('[', i + tag.length - 1);
    const arrEnd = matchBracket(src, arrStart);
    if (arrEnd < 0 || indent !== '        ') { console.error('FAIL pretty', JSON.stringify(indent)); process.exit(1); }
    if (src.slice(arrStart, arrEnd + 1).includes('"v": -0.06')) { pos = arrEnd + 1; continue; }
    const ins = ',\r\n' + TRACKS.map((t) =>
      JSON.stringify(t, null, 2).split('\n').map((l) => indent + '  ' + l).join('\r\n')
    ).join(',\r\n');
    src = src.slice(0, arrEnd) + ins + src.slice(arrEnd);
    pos = arrEnd + ins.length;
    n++;
  }
}
fs.writeFileSync(FILE, src);
console.log('inserted z tracks: ' + n);
// eval 自检
try {
  global.window = {};
  eval(fs.readFileSync(FILE, 'utf8'));
  const HC = global.window.HumanoidConfig;
  let ok = 0;
  [HC.BASE_ANIMS.actions].concat(Object.keys(HC.SKELETON_VERSIONS).map((k) => HC.SKELETON_VERSIONS[k].anims.actions)).forEach((a) => {
    const z = a.Run.filter((t) => t.joint === 'l_forearm' && t.axis === 'z').length + a.Run.filter((t) => t.joint === 'r_forearm' && t.axis === 'z').length;
    if (z === 2) ok++;
  });
  console.log('eval OK; Run forearm z tracks in ' + ok + '/5');
  process.exit(ok === 5 ? 0 : 1);
} catch (e) {
  console.log('BROKEN: ' + e.message);
  process.exit(1);
}
