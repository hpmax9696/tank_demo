// 修复 pretty Run：误插段(格式正确)从数组 ']' 后移到 ']' 前
const fs = require('fs');
const FILE = 'models/humanoid_config.js';
let src = fs.readFileSync(FILE, 'utf8');

function matchBracket(s, startPos, open, close) {
  let depth = 0;
  for (let i = startPos; i < s.length; i++) {
    if (s[i] === open) depth++;
    else if (s[i] === close) { depth--; if (depth === 0) return i; }
  }
  return -1;
}

const tag = '"Run": [';
let pos = 0, fixed = 0;
while (true) {
  const i = src.indexOf(tag, pos);
  if (i < 0) break;
  const arrStart = src.indexOf('[', i + tag.length - 1);
  const arrEnd = matchBracket(src, arrStart, '[', ']');
  const inArr = src.slice(arrStart, arrEnd + 1).includes('l_forearm');
  const after = arrEnd + 1;
  const misplaced = src.startsWith(',\r\n', after) && src.slice(after, after + 200).includes('"joint": "l_forearm');
  if (!inArr && misplaced) {
    // 误插段: ,\r\n {lf...},\r\n{rf...} —— 两个对象依次括号匹配
    const firstBrace = src.indexOf('{', after);
    const lfEnd = matchBracket(src, firstBrace, '{', '}');
    let p = lfEnd + 1;
    while (src[p] === ',' || src[p] === '\r' || src[p] === '\n' || src[p] === ' ') p++;
    if (src[p] !== '{') { console.error('rf start fail @', i); process.exit(1); }
    const rfEnd = matchBracket(src, p, '{', '}');
    const seg = src.slice(firstBrace, rfEnd + 1); // {lf},{rf} 两对象段
    // 删除误插段
    src = src.slice(0, after) + src.slice(rfEnd + 1);
    // 插入数组内末尾（']' 前）
    src = src.slice(0, arrEnd) + ',\r\n' + seg + src.slice(arrEnd);
    pos = arrEnd + seg.length + 3;
    fixed++;
  } else {
    pos = arrEnd + 1;
  }
}
fs.writeFileSync(FILE, src);
console.log('pretty fixed: ' + fixed);
try {
  global.window = {};
  eval(fs.readFileSync(FILE, 'utf8'));
  const HC = global.window.HumanoidConfig;
  let ok = 0;
  [HC.BASE_ANIMS.actions].concat(Object.keys(HC.SKELETON_VERSIONS).map((k) => HC.SKELETON_VERSIONS[k].anims.actions)).forEach((a) => {
    const f = a.Run.filter((t) => t.joint.includes('forearm')).length;
    if (f === 2) ok++;
  });
  console.log('eval OK; Run forearm 2/2 in ' + ok + '/5 sources');
  process.exit(ok === 5 ? 0 : 1);
} catch (e) {
  console.log('STILL BROKEN: ' + e.message);
  process.exit(1);
}
