// 替换 Attack 动画：新增髋(torso)前弯轨道 + 腰(torso_upper)微调，表现下挥力量感
const fs = require('fs');
const FILE = 'models/humanoid_config.js';
let src = fs.readFileSync(FILE, 'utf8');

// ── 新 Attack 轨道 ──
// 髋（torso，下躯干-骨盆交界）：restKey 偏移制（0 = 回到驼背基线），举臂时后仰 -0.12 预拉伸，
// 下挥瞬间前弯 +0.30（力量从髋发出），随后回收 —— 与腰(torso_upper) 0.42 叠加成链式弯腰
const tracks = [
  { kind: 'O', joint: 'torso', prop: 'rotation', axis: 'x', restKey: 'torso:x',
    keys: [[0, 0], [0.45, -0.12], [0.55, 0.3], [0.78, 0.08], [1, 0]] },
  { kind: 'P', joint: 'torso_upper', prop: 'rotation', axis: 'x', restKey: null,
    keys: [[0, 0], [0.45, 0.02], [0.55, 0.42], [0.78, 0.12], [1, 0]] },
  { kind: 'P', joint: 'l_upper_arm', prop: 'rotation', axis: 'x', restKey: null,
    keys: [[0, -0.1], [0.45, -1.8], [0.55, -0.4], [1, -0.1]] },
  { kind: 'P', joint: 'r_upper_arm', prop: 'rotation', axis: 'x', restKey: null,
    keys: [[0, -0.1], [0.45, -1.8], [0.55, -0.4], [1, -0.1]] },
  { kind: 'P', joint: 'l_forearm', prop: 'rotation', axis: 'x', restKey: null,
    keys: [[0, -1.6], [0.45, -0.2], [0.55, -0.5], [1, -1.6]] },
  { kind: 'P', joint: 'r_forearm', prop: 'rotation', axis: 'x', restKey: null,
    keys: [[0, -1.6], [0.45, -0.2], [0.55, -0.5], [1, -1.6]] },
];

const num = (v) => String(v);
const rk = (t) => (t.restKey ? `"restKey":"${t.restKey}"` : '"restKey":null');
const compactAttack =
  '"Attack":[' +
  tracks
    .map(
      (t) =>
        `{"kind":"${t.kind}","joint":"${t.joint}","prop":"${t.prop}","axis":"${t.axis}",${rk(t)},"keys":[` +
        t.keys.map(([a, b]) => `{"t":${num(a)},"v":${num(b)}}`).join(',') +
        ']}'
    )
    .join(',') +
  ']';

// pretty 版（CRLF，与版本副本缩进一致：轨道 10sp / 字段 12sp / 键括号 14sp / t:v 16sp）
const prettyTrack = (t) => {
  const parts = [
    `${' '.repeat(10)}{`,
    `${' '.repeat(12)}"kind": "${t.kind}",`,
    `${' '.repeat(12)}"joint": "${t.joint}",`,
    `${' '.repeat(12)}"prop": "${t.prop}",`,
    `${' '.repeat(12)}"axis": "${t.axis}",`,
    t.restKey ? `${' '.repeat(12)}"restKey": "${t.restKey}",` : `${' '.repeat(12)}"restKey": null,`,
    `${' '.repeat(12)}"keys": [`,
    t.keys
      .map(
        ([a, b]) =>
          `${' '.repeat(14)}{\r\n${' '.repeat(16)}"t": ${num(a)},\r\n${' '.repeat(16)}"v": ${num(b)}\r\n${' '.repeat(14)}}`
      )
      .join(',\r\n'),
    `${' '.repeat(12)}]`,
    `${' '.repeat(10)}}`,
  ];
  return parts.join('\r\n');
};
const prettyAttack = '"Attack": [\r\n' + tracks.map(prettyTrack).join(',\r\n') + `\r\n${' '.repeat(8)}]`;

function extractBlock(src, startIdx) {
  let depth = 0, inStr = false, esc = false, began = false;
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
const ci = src.indexOf('"Attack":[');
const cb = extractBlock(src, ci);
if (!cb) { console.error('FAIL: compact Attack not found'); process.exit(1); }
src = src.slice(0, ci) + compactAttack + src.slice(cb.end);
console.log('compact replaced');

// 2) pretty 版（4 处）
let pos = 0, n = 0;
while (true) {
  const p = src.indexOf('"Attack": [', pos);
  if (p < 0) break;
  const blk = extractBlock(src, p);
  if (!blk) { console.error('FAIL: unbalanced pretty Attack'); process.exit(1); }
  src = src.slice(0, p) + prettyAttack + src.slice(blk.end);
  pos = p + prettyAttack.length;
  n++;
}
console.log('pretty replaced:', n, '(expect 4)');

fs.writeFileSync(FILE, src, 'utf8');
console.log('written', FILE);
