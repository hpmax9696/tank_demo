// verify_zombie_gait.js — 丧尸 Walk/Run 步态"一迈一撑交叉循环"断言（2026-08-16 用户报告双蹬相修复）
// 口径：thigh x 正=后蹬/负=前踢；knee 正=屈膝。
// 旧关键帧问题（量化）：Walk l 正窗(0.17,0.65) ∩ r 正窗(0.11,0.40)∪(0.67,0.80) → (0.17,0.40) 双腿同后摆，
//   且双膝全程 ≥0.15/0.42 屈曲——"双脚同时屈膝向后蹬地"；Run 同类窗口 (0.41,0.64)。
// 新设计断言：①无双蹬 ②一蹬一迈（一腿>+0.15 时另一腿<-0.05）③好腿蹬地时膝伸直 ④摆动膝峰抬脚
//   ⑤瘸腿特征保留（右幅值小+膝恒僵）⑥步幅足够 ⑦裙包络（verify_skirt_space 单独跑）
var fs = require('fs');
var path = require('path');
var vm = require('vm');
var src = fs.readFileSync(path.join(__dirname, '..', 'models', 'humanoid_config.js'), 'utf8');
var sandbox = { window: {}, console: { log: function () {}, warn: function () {} } };
vm.createContext(sandbox);
vm.runInContext(src, sandbox);
var HC = sandbox.window.HumanoidConfig;
var pass = 0, fail = 0;
function ok(c, m) { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m); } }

function getTrack(acts, joint) {
  for (var i = 0; i < acts.length; i++)
    if (acts[i].joint === joint && acts[i].prop === 'rotation' && acts[i].axis === 'x') return acts[i].keys;
  return null;
}
function lerpKeys(keys, t) {
  for (var i = 0; i < keys.length - 1; i++) if (t >= keys[i].t && t <= keys[i + 1].t) {
    var f = (t - keys[i].t) / (keys[i + 1].t - keys[i].t);
    return keys[i].v + (keys[i + 1].v - keys[i].v) * f;
  }
  return keys[keys.length - 1].v;
}

['Walk', 'Run'].forEach(function (an) {
  console.log('═══ ' + an + ' ═══');
  var acts = HC.MODELS.student_f.zombieAnims.actions[an];
  var kl = getTrack(acts, 'l_upper_leg'), kr = getTrack(acts, 'r_upper_leg');
  var kLk = getTrack(acts, 'l_lower_leg'), kRk = getTrack(acts, 'r_lower_leg');

  var doublePush = 0, doublePushT = 0; // min(θL,θR) 最大值（两腿同时后摆深度）
  var badAlt = 0, badAltT = 0; // 一腿>+0.15 时另一腿未 <-0.05
  var badKnee = 0, badKneeT = 0; // 触地推进期（θL 升到后蹬峰值之前）膝 >0.35 = 屈膝蹬地
  var swingKneePeak = 0, strideFront = 0, rMax = 0, rKneeMin = 1e9;
  // 左腿后蹬峰值时刻（=离地瞬间）；峰值后大腿仍为正但膝开始抬（拖趾离地）属正常摆动早期
  var tPeak = 0, vPeak = -1e9;
  for (var f0 = 0; f0 <= 400; f0++) { var t0 = f0 / 400; var v0 = lerpKeys(kl, t0); if (v0 > vPeak) { vPeak = v0; tPeak = t0; } }
  var stanceEnd = Math.max(0, tPeak - 0.02);
  for (var f = 0; f <= 400; f++) {
    var t = f / 400;
    var tl = lerpKeys(kl, t), tr = lerpKeys(kr, t);
    var klv = lerpKeys(kLk, t), krv = lerpKeys(kRk, t);
    if (Math.min(tl, tr) > doublePush) { doublePush = Math.min(tl, tr); doublePushT = t; }
    if ((tl > 0.15 && tr > -0.05) || (tr > 0.15 && tl > -0.05)) { badAlt++; badAltT = t; }
    if (t <= stanceEnd && tl > 0.12 && klv > 0.35) { badKnee = Math.max(badKnee, klv); badKneeT = t; }
    if (klv > swingKneePeak) swingKneePeak = klv;
    if (tl < strideFront) strideFront = tl;
    if (tr > rMax) rMax = tr;
    if (krv < rKneeMin) rKneeMin = krv;
  }
  console.log('  双腿同后摆深度 max(min(θL,θR))=' + doublePush.toFixed(3) + ' @t' + doublePushT.toFixed(2) + ' | 摆动膝峰 ' + swingKneePeak.toFixed(2) + ' | 左前迈 ' + strideFront.toFixed(2) + ' | 右最大后蹬 ' + rMax.toFixed(2) + ' | 右膝最小 ' + rKneeMin.toFixed(2));

  ok(doublePush <= 0.1, an + ' 无双蹬相（min(θL,θR) ≤ 0.1 全周期，实测峰 ' + doublePush.toFixed(3) + '；旧版 ~0.08~0.12 且伴随双膝 0.35+ 屈曲）');
  ok(badAlt === 0, an + ' 一迈一撑交叉（一腿>+0.15 后蹬时另一腿<-0.05 前迈，违例帧 ' + badAlt + '）');
  ok(badKnee <= 0.35, an + ' 好腿触地推进期膝伸直（后蹬峰 t' + tPeak.toFixed(2) + ' 前膝 ≤0.35，实测最大 ' + badKnee.toFixed(3) + '；峰值后抬膝属拖趾离地）');
  ok(swingKneePeak >= (an === 'Run' ? 0.8 : 0.55), an + ' 摆动屈膝抬脚（左膝峰 ' + swingKneePeak.toFixed(2) + ' ≥ ' + (an === 'Run' ? '0.80' : '0.55') + '）');
  ok(strideFront <= (an === 'Run' ? -0.4 : -0.25), an + ' 步幅保留（左前迈 ' + strideFront.toFixed(2) + '）');
  ok(rMax <= 0.16 && rKneeMin >= 0.4, an + ' 瘸腿特征保留（右后蹬 ≤0.16 实测 ' + rMax.toFixed(2) + ' / 右膝恒僵 ≥0.40 实测 ' + rKneeMin.toFixed(2) + '）');
});

// 左右触地交替时序：前迈峰（负极值）应交错 ~半周期
['Walk', 'Run'].forEach(function (an) {
  var acts = HC.MODELS.student_f.zombieAnims.actions[an];
  var kl = getTrack(acts, 'l_upper_leg'), kr = getTrack(acts, 'r_upper_leg');
  function minT(keys) { var m = 1e9, tt = 0; for (var f = 0; f <= 400; f++) { var t = f / 400; var v = lerpKeys(keys, t); if (v < m) { m = v; tt = t; } } return tt; }
  var tlMin = minT(kl), trMin = minT(kr);
  var d = Math.abs(tlMin - trMin);
  console.log('  ' + an + ' 前迈峰: 左@t' + tlMin.toFixed(2) + ' 右@t' + trMin.toFixed(2) + '（间隔 ' + d.toFixed(2) + '）');
  ok(d > 0.35 && d < 0.65, an + ' 左右前迈峰交错约半周期（Δ=' + d.toFixed(2) + '）');
});
console.log('verify_zombie_gait: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
