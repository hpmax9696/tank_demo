// root position.y 轨道 0.072 → 0.24（游戏侧躺地高度补偿；工厂被逐帧贴地覆盖不受影响）
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

// 紧凑版（BASE 1 处）
fix('BASE rootY',
  '{"kind":"O","joint":"root","prop":"position","axis":"y","restKey":null,"keys":[{"t":0,"v":0},{"t":0.55,"v":0.03},{"t":0.78,"v":0.09},{"t":1,"v":0.072}]}',
  '{"kind":"O","joint":"root","prop":"position","axis":"y","restKey":null,"keys":[{"t":0,"v":0},{"t":0.55,"v":0.1},{"t":0.78,"v":0.26},{"t":1,"v":0.24}]}', 1);

// pretty 版（4 处）：上下文 = 前一轨 neck 的尾键（t1 v 0.05）之后
fix('VER rootY',
  J(['              {', '                "t": 0.55,', '                "v": 0.03', '              },', '              {', '                "t": 0.78,', '                "v": 0.09', '              },', '              {', '                "t": 1,', '                "v": 0.072', '              }']),
  J(['              {', '                "t": 0.55,', '                "v": 0.1', '              },', '              {', '                "t": 0.78,', '                "v": 0.26', '              },', '              {', '                "t": 1,', '                "v": 0.24', '              }']), 4);

fs.writeFileSync(FILE, src, 'utf8');
console.log('written', FILE);
