// codemod: ① Run 追加前臂屈肘轨道(跑步摆臂肘弯~90°) ×5 处 ② 4 个 Punch pretty 块缩进修正
const fs = require('fs');
const FILE = 'models/humanoid_config.js';
let src = fs.readFileSync(FILE, 'utf8');

const FOREARM_TRACKS = [
  { kind: 'P', joint: 'l_forearm', prop: 'rotation', axis: 'x', restKey: null, keys: [ { t: 0, v: -1.7 }, { t: 0.25, v: -1.52 }, { t: 0.5, v: -1.35 }, { t: 0.75, v: -1.52 }, { t: 1, v: -1.7 } ] },
  { kind: 'P', joint: 'r_forearm', prop: 'rotation', axis: 'x', restKey: null, keys: [ { t: 0, v: -1.35 }, { t: 0.25, v: -1.52 }, { t: 0.5, v: -1.7 }, { t: 0.75, v: -1.52 }, { t: 1, v: -1.35 } ] },
];

function matchBracket(s, startPos) {
  let depth = 0;
  for (let i = startPos; i < s.length; i++) {
    if (s[i] === '[') depth++;
    else if (s[i] === ']') { depth--; if (depth === 0) return i; }
  }
  return -1;
}
// 以 indent 渲染 track 数组为 pretty 文本（track 行 indent+2，内部由 stringify 自带缩进叠加）
function prettyTracks(tracks, indent) {
  return tracks
    .map((t) => JSON.stringify(t, null, 2).split('\n').map((l) => indent + '  ' + l).join('\r\n'))
    .join(',\r\n');
}

// ── ① Run 插入前臂轨道 ──
let nRun = 0;
{
  const tag = '"Run":[';
  let pos = 0;
  while (true) {
    const i = src.indexOf(tag, pos);
    if (i < 0) break;
    const arrStart = i + tag.length - 1;
    const arrEnd = matchBracket(src, arrStart);
    if (arrEnd < 0) { console.error('FAIL compact Run'); process.exit(1); }
    if (src.slice(arrStart, arrEnd + 1).includes('"l_forearm"')) { pos = arrEnd + 1; continue; }
    const ins = ',' + FOREARM_TRACKS.map((t) => JSON.stringify(t)).join('');
    src = src.slice(0, arrEnd + 1) + ins + src.slice(arrEnd + 1);
    pos = arrEnd + 1 + ins.length;
    nRun++;
  }
  const tag2 = '"Run": [';
  pos = 0;
  while (true) {
    const i = src.indexOf(tag2, pos);
    if (i < 0) break;
    const lineStart = src.lastIndexOf('\n', i) + 1;
    const indent = src.slice(lineStart, i);
    const arrStart = src.indexOf('[', i + tag2.length - 1);
    const arrEnd = matchBracket(src, arrStart);
    if (arrEnd < 0 || indent !== '        ') { console.error('FAIL pretty Run', JSON.stringify(indent)); process.exit(1); }
    if (src.slice(arrStart, arrEnd + 1).includes('"l_forearm"')) { pos = arrEnd + 1; continue; }
    const ins = ',\r\n' + prettyTracks(FOREARM_TRACKS, indent);
    src = src.slice(0, arrEnd + 1) + ins + src.slice(arrEnd + 1);
    pos = arrEnd + 1 + ins.length;
    nRun++;
  }
}

// ── ② Punch pretty 块缩进修正（重渲染）──
let nFix = 0;
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
    if (arrEnd < 0 || indent !== '        ') { console.error('FAIL pretty Punch', JSON.stringify(indent)); process.exit(1); }
    let tracks;
    try { tracks = JSON.parse(src.slice(arrStart, arrEnd + 1)); } catch (e) { console.error('Punch parse fail'); process.exit(1); }
    const rep = indent + '"Punch": [\r\n' + prettyTracks(tracks, indent) + '\r\n' + indent + ']';
    src = src.slice(0, lineStart) + rep + src.slice(arrEnd + 1);
    pos = lineStart + rep.length;
    nFix++;
  }
}

fs.writeFileSync(FILE, src);
console.log('Run forearm inserted: ' + nRun + ', Punch pretty fixed: ' + nFix);
