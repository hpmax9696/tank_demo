// 修复 tune_forearm.js 正则跨块污染的 4 处版本副本数据 + 全量校验（CRLF 行尾）
const fs = require('fs');
const FILE = 'models/humanoid_config.js';
let src = fs.readFileSync(FILE, 'utf8');

// 文件为 CRLF：统一把 LF-only 行归一为 CRLF（replace_die 插入的块是 LF）
src = src.replace(/\r?\n/g, '\r\n');

const J = (s) => s.join('\r\n');

function fix(name, oldStr, newStr, expect) {
  const parts = src.split(oldStr);
  const n = parts.length - 1;
  if (n !== expect) {
    console.error(`FAIL ${name}: found ${n}, expect ${expect}`);
    process.exit(1);
  }
  src = parts.join(newStr);
  console.log(`fixed ${name}: ${n}`);
}

const K = (t, v) => J(['              {', `                "t": ${t},`, `                 "v": ${v}`, '              },']);

// 1) Attack r_forearm 第三键 -0.35 → -0.5（上下文：前键 t0.45/-0.2）
fix(
  'Attack r_forearm',
  J(['              {', '                "t": 0.45,', '                "v": -0.2', '              },', '              {', '                "t": 0.55,', '                "v": -0.35', '              },']),
  J(['              {', '                "t": 0.45,', '                "v": -0.2', '              },', '              {', '                "t": 0.55,', '                "v": -0.5', '              },']),
  4
);

// 2) Die r_forearm 中键 -0.5 → -0.35（上下文：后键 t1/-0.55）
fix(
  'Die r_forearm mid',
  J(['              {', '                "t": 0.5,', '                "v": -0.5', '              },', '              {', '                "t": 1,', '                "v": -0.55', '              }']),
  J(['              {', '                "t": 0.5,', '                "v": -0.35', '              },', '              {', '                "t": 1,', '                "v": -0.55', '              }']),
  4
);

// 3) Die r_upper_arm t0.75: -0.4 → -0.75（上下文：后键 t1/-0.6）
fix(
  'Die r_upper_arm',
  J(['              {', '                "t": 0.75,', '                "v": -0.4', '              },', '              {', '                "t": 1,', '                "v": -0.6', '              }']),
  J(['              {', '                "t": 0.75,', '                "v": -0.75', '              },', '              {', '                "t": 1,', '                "v": -0.6', '              }']),
  4
);

// 4) Stagger torso 中键 -0.25 → -0.3（上下文：t 0.2）
fix(
  'Stagger torso',
  J(['              {', '                "t": 0.2,', '                "v": -0.25', '              },']),
  J(['              {', '                "t": 0.2,', '                "v": -0.3', '              },']),
  4
);

fs.writeFileSync(FILE, src, 'utf8');
console.log('written', FILE);
