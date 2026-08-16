// 微调 Die 髋屈曲：-0.12/-0.18 → -0.06/-0.10（胸脚同平面）
const fs = require('fs');
const FILE = 'models/humanoid_config.js';
let src = fs.readFileSync(FILE, 'utf8');
const J = (s) => s.join('\r\n');

function fix(name, oldStr, newStr, expect) {
  const parts = src.split(oldStr);
  const n = parts.length - 1;
  if (n !== expect) { console.error(`FAIL ${name}: ${n} != ${expect}`); process.exit(1); }
  src = parts.join(newStr);
  console.log(`fixed ${name}: ${n}`);
}

// 紧凑版（BASE_ANIMS 各 1 处）
fix('BASE l_hip',
  '{"kind":"P","joint":"l_upper_leg","prop":"rotation","axis":"x","restKey":null,"keys":[{"t":0,"v":0},{"t":0.25,"v":-0.15},{"t":0.7,"v":0.05},{"t":1,"v":-0.12}]}',
  '{"kind":"P","joint":"l_upper_leg","prop":"rotation","axis":"x","restKey":null,"keys":[{"t":0,"v":0},{"t":0.25,"v":-0.15},{"t":0.7,"v":0.05},{"t":1,"v":-0.06}]}', 1);
fix('BASE r_hip',
  '{"kind":"P","joint":"r_upper_leg","prop":"rotation","axis":"x","restKey":null,"keys":[{"t":0,"v":0},{"t":0.25,"v":-0.15},{"t":0.7,"v":0.08},{"t":1,"v":-0.18}]}',
  '{"kind":"P","joint":"r_upper_leg","prop":"rotation","axis":"x","restKey":null,"keys":[{"t":0,"v":0},{"t":0.25,"v":-0.15},{"t":0.7,"v":0.08},{"t":1,"v":-0.1}]}', 1);

// pretty 版（各 4 处）
fix('VER l_hip',
  J(['              {', '                "t": 0.7,', '                "v": 0.05', '              },', '              {', '                "t": 1,', '                "v": -0.12', '              }']),
  J(['              {', '                "t": 0.7,', '                "v": 0.05', '              },', '              {', '                "t": 1,', '                "v": -0.06', '              }']), 4);
fix('VER r_hip',
  J(['              {', '                "t": 0.7,', '                "v": 0.08', '              },', '              {', '                "t": 1,', '                "v": -0.18', '              }']),
  J(['              {', '                "t": 0.7,', '                "v": 0.08', '              },', '              {', '                "t": 1,', '                "v": -0.1', '              }']), 4);

fs.writeFileSync(FILE, src, 'utf8');
console.log('written', FILE);
