// codemod v0.79.21: Walk 步态相位修复
// ① r_upper_leg 错相 0.25→0.5（l 的半周期平移: 0:0.12, 0.25:0.25, 0.5:-0.45, 0.75:-0.08, 1:0.12）
// ② pelvis.y 单峰→双峰（两步两颠: 0:0, 0.25:0.03, 0.5:0, 0.75:0.03, 1:0）
const fs = require('fs');
const FILE = 'models/humanoid_config.js';
let src = fs.readFileSync(FILE, 'utf8');

const NEW_R = [
  { t: 0, v: 0.12 }, { t: 0.25, v: 0.25 }, { t: 0.5, v: -0.45 }, { t: 0.75, v: -0.08 }, { t: 1, v: 0.12 },
];
const NEW_PELVIS = [
  { t: 0, v: 0 }, { t: 0.25, v: 0.03 }, { t: 0.5, v: 0 }, { t: 0.75, v: 0.03 }, { t: 1, v: 0 },
];

function matchBracket(s, startPos) {
  let depth = 0;
  for (let i = startPos; i < s.length; i++) {
    if (s[i] === '[') depth++;
    else if (s[i] === ']') { depth--; if (depth === 0) return i; }
  }
  return -1;
}

// compact: {"kind":"P","joint":"r_upper_leg","prop":"rotation","axis":"x","restKey":null,"keys":[...]}
let nR = 0, nP = 0;
{
  const tag = '"joint":"r_upper_leg","prop":"rotation","axis":"x","restKey":null,"keys":[';
  let pos = 0;
  while (true) {
    const i = src.indexOf(tag, pos);
    if (i < 0) break;
    const arrStart = i + tag.length - 1;
    const arrEnd = matchBracket(src, arrStart);
    if (arrEnd < 0) { console.error('FAIL compact r_upper_leg'); process.exit(1); }
    // 仅 Walk 内的旧值（-0.45 出现在 t0.25）：检查旧 keys 特征 0.25:-0.45
    const seg = src.slice(arrStart, arrEnd + 1);
    if (seg.includes('{"t":0.25,"v":-0.45}')) {
      const rep = JSON.stringify(NEW_R).slice(1, -1); // 去 [ ]
      src = src.slice(0, arrStart + 1) + rep + src.slice(arrEnd);
      pos = arrStart + 1 + rep.length;
      nR++;
    } else pos = arrEnd + 1;
  }
}
// compact pelvis（Walk 内 0.5:0.04 单峰特征；Idle 是 0.5:0.02, Run 是 0.5:0.08 不动）
{
  const tag = '"restKey":"pelvis:y","keys":[{"t":0,"v":0},{"t":0.5,"v":0.04},{"t":1,"v":0}]';
  while (src.includes(tag)) {
    const rep = '"restKey":"pelvis:y","keys":' + JSON.stringify(NEW_PELVIS);
    src = src.replace(tag, rep);
    nP++;
  }
}
// pretty: "joint": "r_upper_leg" ... keys [ ... ]
{
  const tag = '"joint": "r_upper_leg"';
  let pos = 0;
  while (true) {
    const i = src.indexOf(tag, pos);
    if (i < 0) break;
    // 找该对象的 keys 数组
    const keysIdx = src.indexOf('"keys": [', i);
    // 确认还在同一对象内（下一个 '}' 之前）
    const objEnd = src.indexOf('}', keysIdx > 0 ? keysIdx : i);
    if (keysIdx < 0 || keysIdx > objEnd + 200) { pos = i + tag.length; continue; }
    const arrStart = src.indexOf('[', keysIdx);
    const arrEnd = matchBracket(src, arrStart);
    if (arrEnd < 0) { console.error('FAIL pretty r_upper_leg'); process.exit(1); }
    const seg = src.slice(arrStart, arrEnd + 1);
    if (seg.includes('"v": -0.45') && seg.includes('"t": 0.25')) {
      const indent = '              '; // keys 内部一层
      const rep = '[\r\n' + NEW_R.map((k) => indent + JSON.stringify(k).replace('{', '{ ').replace('}', ' }').replace('":', '": ').replace(',"', ', "')).join(',\r\n') + '\r\n            ]';
      // 直接用标准 pretty: 每行 { "t": x, "v": y }
      const lines = NEW_R.map((k) => '              {\r\n                "t": ' + k.t + ',\r\n                "v": ' + k.v + '\r\n              }');
      const rep2 = '[\r\n' + lines.join(',\r\n') + '\r\n            ]';
      src = src.slice(0, arrStart) + rep2 + src.slice(arrEnd + 1);
      pos = arrStart + rep2.length;
      nR++;
    } else pos = arrEnd + 1;
  }
}
// pretty pelvis（Walk 0.5: 0.04）
{
  const re = /\{\r?\n\s+"t": 0\.5,\r?\n\s+"v": 0\.04\r?\n\s+\}/g;
  // pelvis 双峰需要把 3 键结构换 5 键——定位 pretty pelvis 轨道整体 keys 数组
  const tag = '"restKey": "pelvis:y"';
  let pos = 0;
  while (true) {
    const i = src.indexOf(tag, pos);
    if (i < 0) break;
    const keysIdx = src.indexOf('"keys": [', i);
    const arrStart = src.indexOf('[', keysIdx);
    const arrEnd = matchBracket(src, arrStart);
    if (arrEnd < 0) break;
    const seg = src.slice(arrStart, arrEnd + 1);
    if (seg.includes('"v": 0.04')) {
      const lines = NEW_PELVIS.map((k) => '              {\r\n                "t": ' + k.t + ',\r\n                "v": ' + k.v + '\r\n              }');
      const rep = '[\r\n' + lines.join(',\r\n') + '\r\n            ]';
      src = src.slice(0, arrStart) + rep + src.slice(arrEnd + 1);
      pos = arrStart + rep.length;
      nP++;
    } else pos = arrEnd + 1;
  }
}

fs.writeFileSync(FILE, src);
console.log('r_upper_leg fixed: ' + nR + ', pelvis fixed: ' + nP);
// eval 自检
try {
  global.window = {};
  eval(fs.readFileSync(FILE, 'utf8'));
  const HC = global.window.HumanoidConfig;
  let ok = 0;
  [HC.BASE_ANIMS.actions].concat(Object.keys(HC.SKELETON_VERSIONS).map((k) => HC.SKELETON_VERSIONS[k].anims.actions)).forEach((a) => {
    const r = a.Walk.find((t) => t.joint === 'r_upper_leg');
    const p = a.Walk.find((t) => t.joint === 'pelvis');
    if (r.keys[2].v === -0.45 && r.keys[2].t === 0.5 && p.keys.length === 5) ok++;
  });
  console.log('eval OK; Walk fixed in ' + ok + '/5');
  process.exit(ok === 5 ? 0 : 1);
} catch (e) {
  console.log('BROKEN: ' + e.message);
  process.exit(1);
}
