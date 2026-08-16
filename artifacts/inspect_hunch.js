// 断言：基础骨架/版本动画直立 + MODELS 烘焙丧尸驼背注入 + deriveNode hunch 语义
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const code = fs.readFileSync(path.join(root, 'models/humanoid_config.js'), 'utf8');
global.window = {};
eval(code);
const HC = global.window.HumanoidConfig;

let pass = 0, fail = 0;
function ok(cond, msg) {
  if (cond) { pass++; console.log('  ✓ ' + msg); }
  else { fail++; console.log('  ✗ FAIL: ' + msg); }
}

console.log('== 1. REST_POSES 直立 ==');
ok(HC.REST_POSES['torso:x'] === 0, 'REST_POSES torso:x = 0');
ok(HC.REST_POSES['neck:x'] === 0, 'REST_POSES neck:x = 0');
ok(HC.REST_POSES['head:z'] === 0, 'REST_POSES head:z = 0');
ok(HC.REST_POSES['l_upper_arm:z'] === 0.09, '手臂外张保留 0.09');
ok(HC.REST_POSES['pelvis:y'] === 0.375, 'pelvis:y 保持 0.375');

console.log('== 2. 4 骨架版本 restPoses 直立（pelvis:y 各自保留）==');
const pelvisExpect = { 'v1-成年中性-20260810': 0.5, 'v1-成年男-20260810': 0.5, 'v1-儿童-20260810': 0.4, 'v2-成年女性-2026-08-14': 0.5 };
Object.keys(HC.SKELETON_VERSIONS).forEach((k) => {
  const rp = HC.SKELETON_VERSIONS[k].anims.restPoses;
  ok(rp['torso:x'] === 0 && rp['neck:x'] === 0 && rp['head:z'] === 0, k + ' 三键=0');
  ok(rp['pelvis:y'] === pelvisExpect[k], k + ' pelvis:y=' + pelvisExpect[k] + ' 保留');
});

console.log('== 3. BASE_ANIMS 引用跟随（restPoses === REST_POSES）==');
ok(HC.BASE_ANIMS.restPoses === HC.REST_POSES, 'BASE_ANIMS.restPoses 引用同一对象');

console.log('== 4. MODELS 烘焙丧尸驼背注入 ==');
Object.keys(HC.MODELS).forEach((k) => {
  const rp = HC.MODELS[k].anims.restPoses;
  ok(rp['torso:x'] === 0.2 && rp['neck:x'] === 0.22 && rp['head:z'] === 0.08, k + ' 驼背 0.2/0.22/0.08');
  ok(rp['l_upper_arm:z'] === 0.09 && rp['r_upper_arm:z'] === -0.09, k + ' 手臂外张保留');
});

console.log('== 5. MODELS anims 与版本独立（注入不污染版本）==');
const v1 = HC.SKELETON_VERSIONS['v1-成年中性-20260810'];
ok(v1.anims.restPoses['torso:x'] === 0, '注入后版本仍直立（深拷贝隔离）');

console.log('== 6. deriveNode hunch 语义（0=直立，正值=驼背）==');
function torsoRot(tree) {
  const pelvis = tree.children.find((c) => c.name === 'pelvis');
  const torso = pelvis.children.find((c) => c.name === 'torso');
  return torso.rotation[0];
}
const t0 = HC.buildHumanoid('student_m', { hunch: 0 });
ok(Math.abs(torsoRot(t0)) < 1e-9, 'hunch=0 → torso.rotation.x=0 直立');
const t15 = HC.buildHumanoid('student_m', { hunch: 0.15 });
ok(Math.abs(torsoRot(t15) - 0.15) < 1e-9, 'hunch=0.15 → torso.rotation.x=0.15');
const tD = HC.buildHumanoid('student_m', {}); // 默认 bodyRange.hunch[0]=0.1
ok(Math.abs(torsoRot(tD) - 0.1) < 1e-9, '默认 student hunch[0]=0.1 → 0.1');

console.log('== 7. Attack restKey 偏移轨道数据完好（直立人/丧尸各自适配）==');
const atk = HC.BASE_ANIMS.actions.Attack;
const torsoTrk = atk.find((t) => t.joint === 'torso' && t.axis === 'x');
ok(torsoTrk && torsoTrk.restKey === 'torso:x', 'Attack torso 轨道 restKey=torso:x（偏移制）');

console.log('\n结果: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
