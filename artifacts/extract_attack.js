// 提取 Attack 动画当前原文（compact + pretty 各一处样本）
const fs = require('fs');
const FILE = 'models/humanoid_config.js';
const src = fs.readFileSync(FILE, 'utf8');
console.log('CRLF count:', (src.match(/\r\n/g) || []).length, '| lone LF:', (src.match(/(?<!\r)\n/g) || []).length);

function extractBlock(src, startIdx) {
  let depth = 0, inStr = false, esc = false, began = false;
  for (let k = startIdx; k < src.length; k++) {
    const c = src[k];
    if (esc) { esc = false; continue; }
    if (c === '\\') { esc = true; continue; }
    if (c === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (c === '[' || c === '{') { depth++; began = true; }
    else if (c === ']' || c === '}') { depth--; if (began && depth === 0) return src.slice(startIdx, k + 1); }
  }
  return null;
}

const ci = src.indexOf('"Attack":[');
console.log('=== compact Attack ===');
console.log(extractBlock(src, ci));

const pi = src.indexOf('"Attack": [');
console.log('=== pretty Attack (first) ===');
console.log(JSON.stringify(extractBlock(src, pi).slice(0, 400)));
console.log('pretty Attack count:', (src.match(/"Attack": \[/g) || []).length);
