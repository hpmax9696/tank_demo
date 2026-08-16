// codemod v0.79.23: Run 前迈膝弯明显化——前迈极限膝从过伸-0.3→弯0.5, 着地缓冲0.25
// l: [0:-0.3, 0.25:0.05, 0.5:0.75, 0.75:1.85, 1:-0.3] → [0:0.5, 0.25:0.25, 0.5:0.75, 0.75:1.85, 1:0.5]
// r = l 半周期平移: [0:0.75, 0.25:1.85, 0.5:0.5, 0.75:0.25, 1:0.75]
// 特征: keys 同含 v:-0.3 与 v:1.85（Walk 是 -0.3+1.35, Die 是 0/0.35, Punch 是 0.35/0.65——不冲突）
const fs = require('fs');
const FILE = 'models/humanoid_config.js';
let src = fs.readFileSync(FILE, 'utf8');

const NEW_L = [{ t: 0, v: 0.5 }, { t: 0.25, v: 0.25 }, { t: 0.5, v: 0.75 }, { t: 0.75, v: 1.85 }, { t: 1, v: 0.5 }];
const NEW_R = [{ t: 0, v: 0.75 }, { t: 0.25, v: 1.85 }, { t: 0.5, v: 0.5 }, { t: 0.75, v: 0.25 }, { t: 1, v: 0.75 }];

function matchBracket(s, startPos) {
  let depth = 0;
  for (let i = startPos; i < s.length; i++) {
    if (s[i] === '[') depth++;
    else if (s[i] === ']') { depth--; if (depth === 0) return i; }
  }
  return -1;
}
function prettyKeys(keys, indent) {
  return '[\r\n' + keys.map((k) => indent + '  {\r\n' + indent + '    "t": ' + k.t + ',\r\n' + indent + '    "v": ' + k.v + '\r\n' + indent + '  }').join(',\r\n') + '\r\n' + indent + ']';
}

let n = 0;
// compact
{
  const tag = '"prop":"rotation","axis":"x","restKey":null,"keys":[';
  let pos = 0;
  while (true) {
    const i = src.indexOf(tag, pos);
    if (i < 0) break;
    const pre = src.slice(Math.max(0, i - 90), i);
    const arrStart = i + tag.length - 1;
    const arrEnd = matchBracket(src, arrStart);
    if (arrEnd < 0) { pos = i + tag.length; continue; }
    const seg = src.slice(arrStart, arrEnd + 1);
    if (seg.includes('"v":-0.3}') && seg.includes('"v":1.85}')) {
      const NEW = pre.includes('"joint":"l_lower_leg"') ? NEW_L : (pre.includes('"joint":"r_lower_leg"') ? NEW_R : null);
      if (!NEW) { pos = arrEnd + 1; continue; }
      src = src.slice(0, arrStart + 1) + JSON.stringify(NEW).slice(1, -1) + src.slice(arrEnd);
      pos = arrStart + 100; n++;
    } else pos = arrEnd + 1;
  }
}
// pretty
['l_lower_leg', 'r_lower_leg'].forEach((joint) => {
  const tag = '"joint": "' + joint + '"';
  let pos = 0;
  while (true) {
    const i = src.indexOf(tag, pos);
    if (i < 0) break;
    const keysIdx = src.indexOf('"keys": [', i);
    const arrStart = src.indexOf('[', keysIdx);
    const arrEnd = matchBracket(src, arrStart);
    if (arrEnd < 0) { pos = i + tag.length; continue; }
    const seg = src.slice(arrStart, arrEnd + 1);
    if (seg.includes('"v": -0.3') && seg.includes('"v": 1.85')) {
      const rep = prettyKeys(joint === 'l_lower_leg' ? NEW_L : NEW_R, '            ');
      src = src.slice(0, arrStart) + rep + src.slice(arrEnd + 1);
      pos = arrStart + rep.length; n++;
    } else pos = arrEnd + 1;
  }
});

fs.writeFileSync(FILE, src);
console.log('replaced knee keys: ' + n);
try {
  global.window = {};
  eval(fs.readFileSync(FILE, 'utf8'));
  const HC = global.window.HumanoidConfig;
  let ok = 0;
  [HC.BASE_ANIMS.actions].concat(Object.keys(HC.SKELETON_VERSIONS).map((k) => HC.SKELETON_VERSIONS[k].anims.actions)).forEach((a) => {
    const l = a.Run.find((t) => t.joint === 'l_lower_leg' && t.axis === 'x');
    const r = a.Run.find((t) => t.joint === 'r_lower_leg' && t.axis === 'x');
    const w = a.Walk.find((t) => t.joint === 'l_lower_leg');
    if (l.keys[0].v === 0.5 && r.keys[2].v === 0.5 && r.keys[0].v === 0.75 && w.keys[0].v === -0.3) ok++;
  });
  console.log('eval OK; Run knee in ' + ok + '/5 (Walk 未动)');
  process.exit(ok === 5 ? 0 : 1);
} catch (e) { console.log('BROKEN: ' + e.message); process.exit(1); }
