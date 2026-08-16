// root position.y 轨道重写为游戏树坐标系：t0=0.75(自然高度,消瞬移) → t1=0.475(躺地补偿)
// （工厂展台每帧 bbox 贴地覆盖此轨道，不受影响）
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

fix('BASE rootY',
  '{"kind":"O","joint":"root","prop":"position","axis":"y","restKey":null,"keys":[{"t":0,"v":0},{"t":0.55,"v":0.1},{"t":0.78,"v":0.26},{"t":1,"v":0.24}]}',
  '{"kind":"O","joint":"root","prop":"position","axis":"y","restKey":null,"keys":[{"t":0,"v":0.75},{"t":0.55,"v":0.7},{"t":0.78,"v":0.55},{"t":1,"v":0.475}]}', 1);

fix('VER rootY',
  J(['              {', '                "t": 0,', '                "v": 0', '              },', '              {', '                "t": 0.55,', '                "v": 0.1', '              },', '              {', '                "t": 0.78,', '                "v": 0.26', '              },', '              {', '                "t": 1,', '                "v": 0.24', '              }']),
  J(['              {', '                "t": 0,', '                "v": 0.75', '              },', '              {', '                "t": 0.55,', '                "v": 0.7', '              },', '              {', '                "t": 0.78,', '                "v": 0.55', '              },', '              {', '                "t": 1,', '                "v": 0.475', '              }']), 4);

fs.writeFileSync(FILE, src, 'utf8');
console.log('written', FILE);
