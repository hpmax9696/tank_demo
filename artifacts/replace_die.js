// 替换 humanoid_config.js 的 Die 动画（BASE_ANIMS 紧凑版 1 处 + 版本副本 pretty 版 4 处）
const fs = require('fs');
const FILE = 'models/humanoid_config.js';
let src = fs.readFileSync(FILE, 'utf8');

// ── 新 Die 轨道（绝对值；t 归一化 0..1）──
const tracks = [
  { kind: 'P', joint: 'root', prop: 'rotation', axis: 'x', keys: [[0, 0], [0.3, 0.3], [0.55, 1.15], [0.78, 1.6], [0.9, 1.55], [1, 1.5707963267948966]] },
  { kind: 'O', joint: 'root', prop: 'position', axis: 'y', keys: [[0, 0], [0.55, 0.03], [0.78, 0.09], [1, 0.072]] },
  { kind: 'O', joint: 'torso', prop: 'rotation', axis: 'x', keys: [[0, 0.2], [0.35, 0.4], [0.7, 0.05], [1, 0]] },
  { kind: 'P', joint: 'neck', prop: 'rotation', axis: 'x', keys: [[0, 0.22], [0.4, 0.35], [1, 0.05]] },
  { kind: 'P', joint: 'head', prop: 'rotation', axis: 'z', keys: [[0, 0.08], [0.5, 0.1], [1, 0.7]] },
  { kind: 'P', joint: 'l_upper_arm', prop: 'rotation', axis: 'z', keys: [[0, 0.09], [0.4, 0.15], [0.75, 1.1], [1, 0.95]] },
  { kind: 'P', joint: 'r_upper_arm', prop: 'rotation', axis: 'z', keys: [[0, -0.09], [0.4, -0.15], [0.75, -0.75], [1, -0.6]] },
  { kind: 'P', joint: 'l_forearm', prop: 'rotation', axis: 'x', keys: [[0, 0], [0.5, -0.3], [1, -0.75]] },
  { kind: 'P', joint: 'r_forearm', prop: 'rotation', axis: 'x', keys: [[0, 0], [0.5, -0.5], [1, -1.15]] },
  { kind: 'P', joint: 'l_upper_leg', prop: 'rotation', axis: 'x', keys: [[0, 0], [0.25, -0.15], [0.7, 0.05], [1, -0.12]] },
  { kind: 'P', joint: 'r_upper_leg', prop: 'rotation', axis: 'x', keys: [[0, 0], [0.25, -0.15], [0.7, 0.08], [1, -0.18]] },
  { kind: 'P', joint: 'l_upper_leg', prop: 'rotation', axis: 'z', keys: [[0, 0], [0.6, 0.05], [1, 0.1]] },
  { kind: 'P', joint: 'r_upper_leg', prop: 'rotation', axis: 'z', keys: [[0, 0], [0.6, -0.08], [1, -0.16]] },
  { kind: 'P', joint: 'l_lower_leg', prop: 'rotation', axis: 'x', keys: [[0, 0], [0.25, 0.35], [0.8, 0.06], [1, 0.04]] },
  { kind: 'P', joint: 'r_lower_leg', prop: 'rotation', axis: 'x', keys: [[0, 0], [0.25, 0.35], [0.8, 0.22], [1, 0.15]] },
];

const num = (v) => (Number.isInteger(v) ? String(v) : String(v));
const compactDie =
  '"Die":[' +
  tracks
    .map(
      (t) =>
        `{"kind":"${t.kind}","joint":"${t.joint}","prop":"${t.prop}","axis":"${t.axis}","restKey":null,"keys":[` +
        t.keys.map(([a, b]) => `{"t":${num(a)},"v":${num(b)}}`).join(',') +
        ']}'
    )
    .join(',') +
  ']';

// pretty 版：匹配文件现有缩进风格（entries 10 空格，keys 项 16 空格，收尾 ] 8 空格）
const prettyTrack = (t, idx) => {
  const parts = [
    `${' '.repeat(10)}{`,
    `${' '.repeat(12)}"kind": "${t.kind}",`,
    `${' '.repeat(12)}"joint": "${t.joint}",`,
    `${' '.repeat(12)}"prop": "${t.prop}",`,
    `${' '.repeat(12)}"axis": "${t.axis}",`,
    `${' '.repeat(12)}"restKey": null,`,
    `${' '.repeat(12)}"keys": [`,
    t.keys
      .map(
        ([a, b]) =>
          `${' '.repeat(14)}{\n${' '.repeat(16)}"t": ${num(a)},\n${' '.repeat(16)}"v": ${num(b)}\n${' '.repeat(14)}}`
      )
      .join(',\n'),
    `${' '.repeat(12)}]`,
    `${' '.repeat(10)}}`,
  ];
  return parts.join('\n');
};
const prettyDie = '"Die": [\n' + tracks.map(prettyTrack).join(',\n') + `\n${' '.repeat(8)}]`;

// ── 执行替换 ──
const OLD_COMPACT =
  '"Die":[{"kind":"P","joint":"root","prop":"rotation","axis":"x","restKey":null,"keys":[{"t":0,"v":0},{"t":0.333,"v":1.5079644737231006},{"t":1,"v":1.5707963267948966}]},{"kind":"O","joint":"root","prop":"position","axis":"y","restKey":null,"keys":[{"t":0,"v":0},{"t":0.333,"v":0.03},{"t":0.667,"v":0.072},{"t":1,"v":0.072}]},{"kind":"P","joint":"l_upper_arm","prop":"rotation","axis":"z","restKey":null,"keys":[{"t":0,"v":0},{"t":0.667,"v":-0.3},{"t":1,"v":-0.3}]},{"kind":"P","joint":"r_upper_arm","prop":"rotation","axis":"z","restKey":null,"keys":[{"t":0,"v":0},{"t":0.667,"v":0.3},{"t":1,"v":0.3}]}]';

function extractDieBlock(src, startIdx) {
  let depth = 0,
    inStr = false,
    esc = false,
    began = false;
  for (let k = startIdx; k < src.length; k++) {
    const c = src[k];
    if (esc) { esc = false; continue; }
    if (c === '\\') { esc = true; continue; }
    if (c === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (c === '[' || c === '{') { depth++; began = true; }
    else if (c === ']' || c === '}') { depth--; if (began && depth === 0) return { text: src.slice(startIdx, k + 1), end: k + 1 }; }
  }
  return null;
}

// 1) 紧凑版（唯一）
const ci = src.indexOf(OLD_COMPACT);
if (ci < 0) { console.error('FAIL: compact old Die not found'); process.exit(1); }
src = src.slice(0, ci) + compactDie + src.slice(ci + OLD_COMPACT.length);
console.log('compact replaced at', ci);

// 2) pretty 版（4 处，逐个提取替换）
let pos = 0,
  n = 0;
while (true) {
  const p = src.indexOf('"Die": [', pos);
  if (p < 0) break;
  const bracket = src.indexOf('[', p);
  const blk = extractDieBlock(src, p);
  if (!blk) { console.error('FAIL: unbalanced pretty Die'); process.exit(1); }
  src = src.slice(0, p) + prettyDie + src.slice(blk.end);
  pos = p + prettyDie.length;
  n++;
}
console.log('pretty replaced:', n, '(expect 4)');

fs.writeFileSync(FILE, src, 'utf8');
console.log('written', FILE);
