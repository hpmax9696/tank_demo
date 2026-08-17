// skirt_wall_diag.js — 圆台改造诊断：大腿包络 env(y) vs 裙壁 r(y) 沿全高扫描
// 找刺穿带（env>r 的 y 区间）+ 是否被骨盆遮挡（骨盆底沿以上不可见）+ 所需 rTop
var fs = require('fs');
var path = require('path');
var vm = require('vm');
var src = fs.readFileSync(path.join(__dirname, '..', 'models', 'humanoid_config.js'), 'utf8');
var sandbox = { window: {}, console: { log: function () {}, warn: function () {} } };
vm.createContext(sandbox);
vm.runInContext(src, sandbox);
var HC = sandbox.window.HumanoidConfig;
var log = console.log;

function findNode(n, name) {
  if (n.name === name) return n;
  if (n.children) for (var i = 0; i < n.children.length; i++) { var r = findNode(n.children[i], name); if (r) return r; }
  return null;
}
function lerpKeys(keys, t) {
  for (var i = 0; i < keys.length - 1; i++) if (t >= keys[i].t && t <= keys[i + 1].t) {
    var f = (t - keys[i].t) / (keys[i + 1].t - keys[i].t);
    return keys[i].v + (keys[i + 1].v - keys[i].v) * f;
  }
  return keys[keys.length - 1].v;
}
function getTrack(acts, joint, axis) {
  for (var i = 0; i < acts.length; i++)
    if (acts[i].joint === joint && acts[i].axis === axis && acts[i].prop === 'rotation') return acts[i].keys;
  return null;
}

['student_f', 'teacher_f'].forEach(function (vk) {
  var skirtName = vk === 'student_f' ? 'ah_skirt' : 'ah_gskirt';
  var tree = HC.MODELS[vk].tree;
  var legL = findNode(tree, 'l_upper_leg');
  var skirt = findNode(tree, skirtName);
  var pelvis = findNode(tree, 'pelvis');
  var dx = Math.abs(legL.position[0]);
  var hipY = legL.position[1] + (legL.pivot ? legL.pivot[1] : 0);
  var rT = legL.size[0];
  var h = skirt.size[1];
  var rTop = skirt.size[0], rBot = skirt.size[2];
  var zc = skirt.position[2], yC = skirt.position[1];
  var yTop = yC + h / 2, hemY = yC - h / 2;
  var anims = HC.MODELS[vk].zombieAnims.actions;
  var kl = getTrack(anims.Run, 'l_upper_leg', 'x') || [{t:0,v:0},{t:1,v:0}];
  var kr = getTrack(anims.Run, 'r_upper_leg', 'x') || [{t:0,v:0},{t:1,v:0}];
  var ks = getTrack(anims.Run, skirtName, 'x') || [{t:0,v:0},{t:1,v:0}];

  log('════════ ' + vk + ' ════════');
  log('骨盆: type=' + pelvis.type + ' size=' + JSON.stringify(pelvis.size) + ' (pelvis局部)');
  // 骨盆底沿（pelvis局部 y）：Box/TaperedHex 高度 size[1]，中心在节点原点（无 pivot 补偿时）
  var pelvisBottom = pelvis.size ? -(pelvis.size[1] / 2) : null;
  log('裙: yTop=' + yTop.toFixed(3) + ' hemY=' + hemY.toFixed(3) + ' rTop=' + rTop.toFixed(3) + ' rBot=' + rBot.toFixed(3) + ' | 髋Y=' + hipY.toFixed(3) + ' dx=' + dx.toFixed(3) + ' 大腿r=' + rT.toFixed(3));
  log('骨盆底沿 y=' + (pelvisBottom != null ? pelvisBottom.toFixed(3) : '?') + '（以下裙壁露出可见）');

  // env(y): Run 全周期大腿表面到裙轴最大距离（含裙摆耦合倾角）；r(y): 当前锥壁
  var pokeTop = null, worst = { e: 0 };
  var rows = [];
  for (var yy = hemY; yy <= Math.min(yTop, hipY + 0.02); yy += 0.01) {
    var env = 0;
    for (var f = 0; f <= 100; f++) {
      var t = f / 100;
      var phi = lerpKeys(ks, t);
      var zWall = zc - (yC - yy) * Math.sin(phi); // 该高度裙轴 z
      [lerpKeys(kl, t), lerpKeys(kr, t)].forEach(function (th) {
        var zLeg = -(hipY - yy) * Math.sin(th);
        var m = rT / Math.cos(Math.abs(th));
        var d = Math.sqrt(dx * dx + Math.pow(zLeg - zWall, 2)) + (rT + m) / 2;
        if (d > env) env = d;
      });
    }
    var t_ = (yTop - yy) / h;
    var r = rTop + t_ * (rBot - rTop);
    rows.push({ y: yy, env: env, r: r });
    if (env > r && (pokeTop == null || yy > pokeTop)) pokeTop = yy;
    if (yy >= (pelvisBottom != null ? pelvisBottom : -9) - 0.001 && env - r > worst.e) worst = { e: env - r, y: yy, env: env, r: r };
  }
  // 打印刺穿带（连续区间概括）
  var bands = [], cur = null;
  rows.forEach(function (rw) {
    if (rw.env > rw.r) { if (!cur) cur = { from: rw.y, to: rw.y, max: rw.env - rw.r }; else { cur.to = rw.y; cur.max = Math.max(cur.max, rw.env - rw.r); } }
    else if (cur) { bands.push(cur); cur = null; }
  });
  if (cur) bands.push(cur);
  bands.forEach(function (b) { log('  刺穿带: y∈[' + b.from.toFixed(3) + ', ' + b.to.toFixed(3) + '] 最大超出 ' + b.max.toFixed(3) + (pelvisBottom != null && b.from >= pelvisBottom ? ' ⚠露出骨盆外(可见!)' : ' (骨盆内,不可见)')); });
  // 可见段最坏点与所需 rTop（线性壁 hemY→rBot 保持, 求壁在可见顶点所需值）
  if (pelvisBottom != null && pelvisBottom > hemY) {
    var visTop = Math.min(pelvisBottom, yTop);
    var envVisTop = null;
    rows.forEach(function (rw) { if (Math.abs(rw.y - visTop) < 0.006) envVisTop = rw.env; });
    // 线性壁从 (hemY, rBot+margin) 到 (visTop, rTopNeed)：斜率恒定 → rTopNeed = env(visTop)+margin 若 env 近似线性
    log('  可见顶 y=' + visTop.toFixed(3) + ' env=' + (envVisTop != null ? envVisTop.toFixed(3) : '?') + ' 现壁 r=' + (rTop + (yTop - visTop) / h * (rBot - rTop)).toFixed(3));
    if (envVisTop != null) log('  → 圆台 rTop 需 ≈ ' + (envVisTop + 0.008).toFixed(3) + '（env+0.008 余量，rBottom 不变）');
  }

  // ── 骨盆/下躯干径向需求（圆台包裹验证）：裙高度范围内所有"实心部件"在各高度的径向半宽 ──
  // 收集 pelvis 及其非腿子节点（torso_lower 等）的盒子，按高度采样径向半宽（TaperedBox 上下线性插值）
  function boxHalfExtentsAt(n, yy) {
    // 返回该节点盒子在 pelvis 局部高度 yy 处的 {hx, hz}（假设盒子中心在节点 position、Y 范围 position±h/2）
    if (!n || !n.size) return null;
    var s = n.size;
    var cy = n.position ? n.position[1] : 0;
    var hh, bw, bd, tw, td;
    if (n.type === 'TaperedBox') { hh = s[1]; bw = s[0]; bd = s[2]; tw = s[3]; td = s[4]; }
    else if (n.type === 'Box') { hh = s[1]; bw = bd = tw = td = null; }
    else return null;
    if (yy < cy - hh / 2 || yy > cy + hh / 2) return null;
    var f = (yy - (cy - hh / 2)) / hh; // 0=底 1=顶
    if (n.type === 'Box') return { hx: s[0] / 2, hz: s[2] / 2 };
    return { hx: (bw + (tw - bw) * f) / 2, hz: (bd + (td - bd) * f) / 2 };
  }
  var solidNodes = [];
  (pelvis.children || []).forEach(function (c) {
    if (c.name === 'l_upper_leg' || c.name === 'r_upper_leg') return;
    if (c.size && (c.type === 'Box' || c.type === 'TaperedBox')) solidNodes.push(c);
  });
  solidNodes.push(pelvis);
  log('  ── 裙高度范围内实心部件（pelvis 局部）──');
  solidNodes.forEach(function (n) {
    var cy = n.position ? n.position[1] : 0;
    var s = n.size;
    var y0 = n === pelvis ? -s[1] / 2 : cy - s[1] / 2;
    var y1 = n === pelvis ? s[1] / 2 : cy + s[1] / 2;
    log('    ' + n.name + ' (' + n.type + ') y∈[' + y0.toFixed(3) + ',' + y1.toFixed(3) + '] size=' + JSON.stringify(s.map(function (v) { return +v.toFixed(3); })) + (n.materialId ? ' mat=' + n.materialId : ''));
  });
  // need(y) = max(腿env, 各盒子半对角/半宽) —— 半宽=同色可容忍角落穿出，半对角=完全包裹
  log('  ── need(y) 剖面（圆台壁需 ≥ need）──');
  log('  y      腿env   盒子hx/hz(部件)                 半宽max  半对角max');
  var rTopNeed = 0, rTopNeedSoft = 0;
  for (var yy2 = hemY; yy2 <= yTop + 0.001; yy2 += 0.02) {
    var env2 = 0;
    for (var f2 = 0; f2 <= 60; f2++) {
      var t2 = f2 / 60;
      var phi2 = lerpKeys(ks, t2);
      var zWall2 = zc - (yC - yy2) * Math.sin(phi2);
      [lerpKeys(kl, t2), lerpKeys(kr, t2)].forEach(function (th2) {
        var zLeg2 = -(hipY - yy2) * Math.sin(th2);
        var m2 = rT / Math.cos(Math.abs(th2));
        var d2 = Math.sqrt(dx * dx + Math.pow(zLeg2 - zWall2, 2)) + (rT + m2) / 2;
        if (d2 > env2) env2 = d2;
      });
    }
    var hxMax = 0, hzMax = 0, diagMax = 0, who = '';
    solidNodes.forEach(function (n) {
      var e = boxHalfExtentsAt(n, yy2);
      if (e) {
        if (e.hx > hxMax) { hxMax = e.hx; who = n.name; }
        if (e.hz > hzMax) hzMax = e.hz;
        var dg = Math.sqrt(e.hx * e.hx + e.hz * e.hz);
        if (dg > diagMax) diagMax = dg;
      }
    });
    var soft = Math.max(hxMax, hzMax); // 半宽：侧面/前后不穿（同色角落可容忍）
    var hard = Math.sqrt(hxMax * hxMax + hzMax * hzMax); // 完全包裹（角落也不出）
    var line = '  ' + yy2.toFixed(3) + '  ' + env2.toFixed(3) + '  ' + who + ' hx=' + hxMax.toFixed(3) + ' hz=' + hzMax.toFixed(3) + (hxMax || hzMax ? '' : ' (无盒子)') + '  soft=' + soft.toFixed(3) + '  hard=' + hard.toFixed(3);
    // 圆台壁（rTop 待定）至少在裙顶处 ≥ 顶部 need
    if (yy2 >= yTop - 0.021) {
      rTopNeed = Math.max(rTopNeed, env2, hard);
      rTopNeedSoft = Math.max(rTopNeedSoft, env2, soft);
      line += '  ← 裙顶带';
    }
    log(line);
  }
  log('  → rTop 完全包裹需 ≥ ' + rTopNeed.toFixed(3) + ' / 半宽口径(同色角落容忍) ≥ ' + rTopNeedSoft.toFixed(3) + '（现行 0.077，rBottom=' + rBot.toFixed(3) + '）');
  log('');
});
