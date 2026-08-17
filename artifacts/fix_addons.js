// codemod v0.79.25: 鞋子缩小(贴脚)+tie_opt snap
const fs = require('fs');
const FILE = 'models/humanoid_config.js';
let src = fs.readFileSync(FILE, 'utf8');

// 鞋子三种（compact 单行格式）
const oldShoe = /"size":\[0\.2,0\.12,0\.32\],"position":\[0,-0\.02,0\.02\]/g;
const n1 = (src.match(oldShoe) || []).length;
src = src.replace(oldShoe, '"size":[0.118,0.055,0.235],"position":[0,-0.004,0.004]');

// tie_opt snap
const tieOld = "tie_opt: {\n      parent: 'torso',\n      node: {";
const tieNew = "tie_opt: {\n      parent: 'torso',\n      snap: { y: 0.5, x: 0, out: 0.006 },\n      node: {";
const n2 = src.includes(tieOld) ? 1 : 0;
src = src.split(tieOld).join(tieNew);

fs.writeFileSync(FILE, src);
console.log('shoes replaced: ' + n1 + ', tie snap: ' + n2);
