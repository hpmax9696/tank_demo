// codemod v0.79.22: Run 前臂屈肘加深——拳指下巴前方, 最低点前臂不低于水平
// 几何: 前臂净前弯 = |upper.x + forearm.x| 需全程 ≥ 1.57(90°)
//   旧 l: [-1.70,-1.52,-1.35,...] → t=0: 1.70-0.50=1.20 ✗; t=0.25: 1.52-0.15=1.37 ✗
//   新 l: [-2.10,-1.75,-1.55,...] → t=0: 1.60 ✓; t=0.25: 1.60 ✓; t=0.5: 2.05(上仰27°,拳指下巴) ✓
const fs = require('fs');
const FILE = 'models/humanoid_config.js';
let src = fs.readFileSync(FILE, 'utf8');

const NEW_L = [{ t: 0, v: -2.1 }, { t: 0.25, v: -1.75 }, { t: 0.5, v: -1.55 }, { t: 0.75, v: -1.75 }, { t: 1, v: -2.1 }];
const NEW_R = [{ t: 0, v: -1.55 }, { t: 0.25, v: -1.75 }, { t: 0.5, v: -2.1 }, { t: 0.75, v: -1.75 }, { t: 1, v: -1.55 }];

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
// compact（Run 内 forearm.x，特征 keys[0]=-1.7 或 -1.35 且含 -1.52；Punch forearm 起始 -1.75/-1.8 不冲突）
{
  const tag = '"prop":"rotation","axis":"x","restKey":null,"keys":[';
  let pos = 0;
  while (true) {
    const i = src.indexOf(tag, pos);
    if (i < 0) break;
    // 前文应为 forearm joint
    const pre = src.slice(Math.max(0, i - 90), i);
    const arrStart = i + tag.length - 1;
    const arrEnd = matchBracket(src, arrStart);
    if (arrEnd < 0) { pos = i + tag.length; continue; }
    const seg = src.slice(arrStart, arrEnd + 1);
    if (pre.includes('"joint":"l_forearm"') && seg.includes('"v":-1.7}') && seg.includes('"v":-1.35}')) {
      src = src.slice(0, arrStart + 1) + JSON.stringify(NEW_L).slice(1, -1) + src.slice(arrEnd);
      pos = arrStart + 120; n++;
    } else if (pre.includes('"joint":"r_forearm"') && seg.includes('"v":-1.35}') && seg.includes('"v":-1.7}')) {
      src = src.slice(0, arrStart + 1) + JSON.stringify(NEW_R).slice(1, -1) + src.slice(arrEnd);
      pos = arrStart + 120; n++;
    } else pos = arrEnd + 1;
  }
}
// pretty
{
  const tag = '"joint": "l_forearm"';
  let pos = 0;
  while (true) {
    const i = src.indexOf(tag, pos);
    if (i < 0) break;
    const keysIdx = src.indexOf('"keys": [', i);
    const arrStart = src.indexOf('[', keysIdx);
    const arrEnd = matchBracket(src, arrStart);
    if (arrEnd < 0) { pos = i + tag.length; continue; }
    const seg = src.slice(arrStart, arrEnd + 1);
    if (seg.includes('"v": -1.7') && seg.includes('"v": -1.35') && seg.includes('"v": -1.52')) {
      // indent 从 keys 行推导（keys 数组行内缩进 = keysIdx 行首缩进 + 2 层）
      const lineStart = src.lastIndexOf('\n', keysIdx) + 1;
      const baseIndent = src.slice(lineStart, keysIdx).replace('"keys": [', '').trimEnd();
      // 实际结构: <12空格>"keys": [ / <14空格>{...——用固定 12/14（与生成格式一致）
      const rep = prettyKeys(NEW_L, '            ');
      src = src.slice(0, arrStart) + rep + src.slice(arrEnd + 1);
      pos = arrStart + rep.length; n++;
    } else pos = arrEnd + 1;
  }
}
{
  const tag = '"joint": "r_forearm"';
  let pos = 0;
  while (true) {
    const i = src.indexOf(tag, pos);
    if (i < 0) break;
    const keysIdx = src.indexOf('"keys": [', i);
    const arrStart = src.indexOf('[', keysIdx);
    const arrEnd = matchBracket(src, arrStart);
    if (arrEnd < 0) { pos = i + tag.length; continue; }
    const seg = src.slice(arrStart, arrEnd + 1);
    if (seg.includes('"v": -1.7') && seg.includes('"v": -1.35') && seg.includes('"v": -1.52')) {
      const rep = prettyKeys(NEW_R, '            ');
      src = src.slice(0, arrStart) + rep + src.slice(arrEnd + 1);
      pos = arrStart + rep.length; n++;
    } else pos = arrEnd + 1;
  }
}

fs.writeFileSync(FILE, src);
console.log('replaced forearm keys: ' + n);
try {
  global.window = {};
  eval(fs.readFileSync(FILE, 'utf8'));
  const HC = global.window.HumanoidConfig;
  let ok = 0;
  [HC.BASE_ANIMS.actions].concat(Object.keys(HC.SKELETON_VERSIONS).map((k) => HC.SKELETON_VERSIONS[k].anims.actions)).forEach((a) => {
    const lf = a.Run.find((t) => t.joint === 'l_forearm' && t.axis === 'x');
    const lu = a.Run.find((t) => t.joint === 'l_upper_arm');
    if (lf.keys[0].v === -2.1) {
      // 全程净前弯 ≥ 90° 检查
      const sample = (tr, t) => { const ks = tr.keys; for (let i2 = 1; i2 < ks.length; i2++) { if (t <= ks[i2].t) { const f = (t - ks[i2 - 1].t) / (ks[i2].t - ks[i2 - 1].t); return ks[i2 - 1].v + (ks[i2].v - ks[i2 - 1].v) * f; } } return ks[ks.length - 1].v; };
      let minBend = 9;
      for (let t = 0; t <= 1.0001; t += 0.02) minBend = Math.min(minBend, Math.abs(sample(lf, t) + sample(lu, t)));
      if (minBend >= 1.57) ok++;
      else console.log('  bend fail: ' + minBend.toFixed(3));
    }
  });
  console.log('eval OK; forearm ≥90° in ' + ok + '/5');
  process.exit(ok === 5 ? 0 : 1);
} catch (e) { console.log('BROKEN: ' + e.message); process.exit(1); }
