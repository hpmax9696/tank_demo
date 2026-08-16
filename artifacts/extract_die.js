// 提取 humanoid_config.js 中 Die 动画的精确原文（含紧凑与 pretty）
const fs = require('fs');
const FILE = 'models/humanoid_config.js';
const src = fs.readFileSync(FILE, 'utf8');

// 紧凑版（BASE_ANIMS 单行内）
const needle = '"Die":[{"kind":"P","joint":"root"';
const i = src.indexOf(needle);
if (i >= 0) {
  // 从 "Die":[ 开始做括号配平找到数组结束
  let depth = 0, j = src.indexOf('[', i), k = j, inStr = false, esc = false;
  for (; k < src.length; k++) {
    const c = src[k];
    if (esc) { esc = false; continue; }
    if (c === '\\') { esc = true; continue; }
    if (c === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (c === '[' || c === '{') depth++;
    else if (c === ']' || c === '}') { depth--; if (depth === 0) break; }
  }
  console.log('=== compact Die (BASE_ANIMS) ===');
  console.log(src.slice(i, k + 1));
}

// pretty 版（第一个版本副本）
const p = src.indexOf('"Die": [');
if (p >= 0) {
  let depth = 0, j = src.indexOf('[', p), k = j, inStr = false, esc = false;
  for (; k < src.length; k++) {
    const c = src[k];
    if (esc) { esc = false; continue; }
    if (c === '\\') { esc = true; continue; }
    if (c === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (c === '[' || c === '{') depth++;
    else if (c === ']' || c === '}') { depth--; if (depth === 0) break; }
  }
  console.log('=== pretty Die (version copy, first) ===');
  console.log(src.slice(p, k + 1));
}
