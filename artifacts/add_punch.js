// codemod: humanoid_config.js — Attack→Swing 改名 + 新增 Punch（拳击）动画 ×5 处（BASE_ANIMS+4版本）
// 右直拳(orthodox): 左脚前右脚后站架/双拳护脸/右拳后拉蓄力→爆发直出/左拳护卫/腰扭转(torso y)带动右肩前送/后腿蹬地
const fs = require('fs');
const FILE = 'models/humanoid_config.js';
let src = fs.readFileSync(FILE, 'utf8');

// ── Punch 轨道（面向 +Z，新数据层解剖学：l=+X，r_upper_arm=-X=解剖右手；torso y 正=右肩前送）──
const PUNCH = [
  { kind: 'O', joint: 'torso', prop: 'rotation', axis: 'y', restKey: null, keys: [ { t: 0, v: 0 }, { t: 0.4, v: -0.18 }, { t: 0.52, v: 0.42 }, { t: 0.62, v: 0.38 }, { t: 1, v: 0 } ] },
  { kind: 'O', joint: 'torso', prop: 'rotation', axis: 'x', restKey: 'torso:x', keys: [ { t: 0, v: 0.04 }, { t: 0.4, v: 0 }, { t: 0.52, v: 0.15 }, { t: 0.62, v: 0.12 }, { t: 1, v: 0.04 } ] },
  { kind: 'P', joint: 'torso_upper', prop: 'rotation', axis: 'y', restKey: null, keys: [ { t: 0, v: 0 }, { t: 0.4, v: -0.08 }, { t: 0.52, v: 0.16 }, { t: 0.62, v: 0.12 }, { t: 1, v: 0 } ] },
  { kind: 'P', joint: 'head', prop: 'rotation', axis: 'y', restKey: null, keys: [ { t: 0, v: 0 }, { t: 0.4, v: 0.06 }, { t: 0.52, v: -0.18 }, { t: 0.62, v: -0.14 }, { t: 1, v: 0 } ] },
  { kind: 'P', joint: 'r_upper_arm', prop: 'rotation', axis: 'x', restKey: null, keys: [ { t: 0, v: -0.45 }, { t: 0.4, v: -0.3 }, { t: 0.52, v: -1.35 }, { t: 0.62, v: -1.4 }, { t: 1, v: -0.45 } ] },
  { kind: 'P', joint: 'r_forearm', prop: 'rotation', axis: 'x', restKey: null, keys: [ { t: 0, v: -1.75 }, { t: 0.4, v: -1.85 }, { t: 0.52, v: -0.25 }, { t: 0.62, v: -0.18 }, { t: 1, v: -1.75 } ] },
  { kind: 'P', joint: 'l_upper_arm', prop: 'rotation', axis: 'x', restKey: null, keys: [ { t: 0, v: -0.5 }, { t: 0.4, v: -0.5 }, { t: 0.52, v: -0.62 }, { t: 0.62, v: -0.58 }, { t: 1, v: -0.5 } ] },
  { kind: 'P', joint: 'l_forearm', prop: 'rotation', axis: 'x', restKey: null, keys: [ { t: 0, v: -1.8 }, { t: 0.4, v: -1.8 }, { t: 0.52, v: -1.98 }, { t: 0.62, v: -1.92 }, { t: 1, v: -1.8 } ] },
  { kind: 'P', joint: 'l_upper_leg', prop: 'rotation', axis: 'x', restKey: null, keys: [ { t: 0, v: -0.3 }, { t: 0.4, v: -0.24 }, { t: 0.52, v: -0.36 }, { t: 0.62, v: -0.33 }, { t: 1, v: -0.3 } ] },
  { kind: 'P', joint: 'r_upper_leg', prop: 'rotation', axis: 'x', restKey: null, keys: [ { t: 0, v: 0.25 }, { t: 0.4, v: 0.28 }, { t: 0.52, v: 0.1 }, { t: 0.62, v: 0.14 }, { t: 1, v: 0.25 } ] },
  { kind: 'P', joint: 'l_lower_leg', prop: 'rotation', axis: 'x', restKey: null, keys: [ { t: 0, v: 0.35 }, { t: 0.4, v: 0.4 }, { t: 0.52, v: 0.3 }, { t: 0.62, v: 0.32 }, { t: 1, v: 0.35 } ] },
  { kind: 'P', joint: 'r_lower_leg', prop: 'rotation', axis: 'x', restKey: null, keys: [ { t: 0, v: 0.45 }, { t: 0.4, v: 0.55 }, { t: 0.52, v: 0.15 }, { t: 0.62, v: 0.22 }, { t: 1, v: 0.45 } ] },
  { kind: 'O', joint: 'pelvis', prop: 'position', axis: 'y', restKey: 'pelvis:y', keys: [ { t: 0, v: 0 }, { t: 0.4, v: 0.02 }, { t: 0.52, v: -0.04 }, { t: 0.62, v: -0.02 }, { t: 1, v: 0 } ] },
];

// 从 startPos（指向 '['）做括号匹配，返回匹配 ']' 的下标（end，含）
function matchBracket(s, startPos) {
  let depth = 0;
  for (let i = startPos; i < s.length; i++) {
    if (s[i] === '[') depth++;
    else if (s[i] === ']') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

// 1) compact：BASE_ANIMS 单行 actions
let nCompact = 0;
{
  const tag = '"Attack":[';
  let pos = 0;
  while (true) {
    const i = src.indexOf(tag, pos);
    if (i < 0) break;
    const arrStart = i + tag.length - 1; // 指向 '['
    const arrEnd = matchBracket(src, arrStart);
    if (arrEnd < 0) { console.error('FAIL: compact bracket'); process.exit(1); }
    const compactPunch = '"Punch":[' + PUNCH.map((t) => JSON.stringify(t)).join(',') + ']';
    src = src.slice(0, i) + '"Swing":[' + src.slice(i + tag.length, arrEnd + 1) + ',' + compactPunch + src.slice(arrEnd + 1);
    pos = i + '"Swing":['.length + (arrEnd - arrStart) + compactPunch.length;
    nCompact++;
  }
}

// 2) pretty：4 个版本块
let nPretty = 0;
{
  const tag = '"Attack": [';
  let pos = 0;
  while (true) {
    const i = src.indexOf(tag, pos);
    if (i < 0) break;
    const lineStart = src.lastIndexOf('\n', i) + 1;
    const indent = src.slice(lineStart, i); // 应为 8 空格
    const arrStart = src.indexOf('[', i + tag.length - 1);
    const arrEnd = matchBracket(src, arrStart);
    if (arrEnd < 0 || indent !== '        ') { console.error('FAIL: pretty bracket/indent', JSON.stringify(indent)); process.exit(1); }
    const punchPretty =
      indent + '"Punch": [\r\n' +
      PUNCH.map((t) => JSON.stringify(t, null, 2).split('\n').map((l, li) => (li ? '  ' : '') + l).join('\r\n')).join(',\r\n') +
      '\r\n' + indent + ']';
    src = src.slice(0, i) + '"Swing": [' + src.slice(i + tag.length, arrEnd + 1) + ',\r\n' + punchPretty + src.slice(arrEnd + 1);
    pos = arrEnd + punchPretty.length + 8;
    nPretty++;
  }
}

fs.writeFileSync(FILE, src);
console.log('renamed+inserted: compact=' + nCompact + ' pretty=' + nPretty);
// 快速自检
const after = fs.readFileSync(FILE, 'utf8');
console.log('Swing count:', (after.match(/"Swing": ?\[/g) || []).length);
console.log('Punch count:', (after.match(/"Punch": ?\[/g) || []).length);
console.log('Attack remaining:', (after.match(/"Attack": ?\[/g) || []).length);
