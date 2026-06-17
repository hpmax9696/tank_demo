/**
 * 六足步态测量探针 v0.1 (诊断工具, 非侵入式)
 *
 * 用途: 量化对比"模型工厂(bodyWriter=true)"与"训练场(bodyWriter=false)"两端的
 *       步态姿态差异。在 stepGait 末尾采样一条参考腿(左前)的完整关节状态,
 *       记录到 window.__hexProbeData, 供导出对比。
 *
 * 激活: 浏览器控制台执行 window.__hexProbeStart(label)
 * 停止: window.__hexProbeStop()
 * 导出: window.__hexProbeDump() → 打印 JSON + 返回数据
 *
 * 采样维度:
 *   - 关节角: hipJoint / thighPivot / shinPivot / anklePivot (rad)
 *   - 脚尖相对身体: footLocalX/Z (身体本地系下脚的 XZ 偏移, 归一化到 _initFootDist)
 *   - 脚尖世界Y - 身体Y (相对高度, 判断浮空/下陷)
 *   - 步态相位: gaitT / inStance / gaitPeriod / dynamicStride / bodySpeedNow / turnRate
 */
(function () {
'use strict';
// NOTE: 不在顶层缓存 THREE (加载顺序不同页面有差异), 在采样函数内运行时动态读 window.THREE

// 采样缓冲
var _buf = null;       // { label, rows: [] }
var _legPrefix = '左前';

window.__hexProbeStart = function (label) {
  _buf = { label: label || 'unnamed', rows: [] };
  console.log('[probe] 开始采样: ' + _buf.label);
};

window.__hexProbeStop = function () {
  if (!_buf) { console.warn('[probe] 未在采样'); return; }
  // 持久化到 localStorage (同源页面共享, 便于工厂/游戏两端汇总对比)
  try { localStorage.setItem('hexProbe_' + _buf.label, JSON.stringify(_buf)); } catch (e) {}
  console.log('[probe] 停止采样: ' + _buf.label + ' 共 ' + _buf.rows.length + ' 帧 (已存localStorage)');
  return _buf;
};

window.__hexProbeDump = function () {
  if (!_buf || !_buf.rows.length) { console.warn('[probe] 无数据'); return null; }
  var json = JSON.stringify(_buf);
  console.log('[probe] === ' + _buf.label + ' (' + _buf.rows.length + '帧) ===');
  console.log(json);
  return _buf;
};

// 精简统计 (避免贴巨量原始数据): 关节角范围/周期/周期切换跳变
// 优先用当前 _buf, 否则从 localStorage 读
window.__hexProbeStats = function (label) {
  label = label || (_buf && _buf.label);
  var data = null;
  if (_buf && _buf.label === label) data = _buf;
  else {
    try { data = JSON.parse(localStorage.getItem('hexProbe_' + label)); } catch (e) {}
  }
  if (!data || !data.rows || !data.rows.length) { console.warn('[probe] 无数据: ' + label); return null; }
  var rows = data.rows;
  var s = { label: label, frames: rows.length, duration: +(rows[rows.length - 1].t - rows[0].t).toFixed(2) };
  ['hip', 'thigh', 'shin', 'fx', 'fz', 'fyRel', 'period', 'spd'].forEach(function (k) {
    var mn = Infinity, mx = -Infinity, sum = 0;
    rows.forEach(function (r) { if (r[k] < mn) mn = r[k]; if (r[k] > mx) mx = r[k]; sum += r[k]; });
    s[k] = { min: +mn.toFixed(3), max: +mx.toFixed(3), range: +(mx - mn).toFixed(3), mean: +(sum / rows.length).toFixed(3) };
  });
  // 周期切换 (gaitT ~1→~0) 时 hip 的最大跳变 — 衡量步态连续性
  var maxJump = 0, jumpCount = 0;
  for (var i = 1; i < rows.length; i++) {
    if (rows[i].gaitT < 0.15 && rows[i - 1].gaitT > 0.85) {
      jumpCount++;
      var j = Math.abs(rows[i].hip - rows[i - 1].hip);
      if (j > maxJump) maxJump = j;
    }
  }
  s.hipPeriodJump = +maxJump.toFixed(3);
  s.periodCycles = jumpCount;
  var out = JSON.stringify(s);
  console.log('[probe] STATS ' + label + ': ' + out);
  return s;
};

// 对比 localStorage 所有组的统计表
window.__hexProbeCompare = function () {
  var labels = [];
  try {
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (k && k.indexOf('hexProbe_') === 0) labels.push(k.slice(9));
    }
  } catch (e) {}
  var all = labels.map(function (l) { return window.__hexProbeStats(l); }).filter(Boolean);
  console.log('[probe] 对比 ' + all.length + ' 组');
  return all;
};

// 导出 localStorage 所有 hexProbe_* 组 (工厂+游戏两端汇总), 返回 {label: data}
window.__hexProbeExport = function () {
  var all = {};
  try {
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (k && k.indexOf('hexProbe_') === 0) {
        try { all[k.slice(9)] = JSON.parse(localStorage.getItem(k)); } catch (e) {}
      }
    }
  } catch (e) {}
  var json = JSON.stringify(all);
  console.log('[probe] 导出 ' + Object.keys(all).length + ' 组: ' + Object.keys(all).join(', '));
  console.log(json);
  return all;
};

// 清除 localStorage 所有探针数据
window.__hexProbeClearStore = function () {
  var keys = [];
  try {
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (k && k.indexOf('hexProbe_') === 0) keys.push(k);
    }
    keys.forEach(function (k) { localStorage.removeItem(k); });
  } catch (e) {}
  console.log('[probe] 清除 localStorage ' + keys.length + ' 组');
};

window.__hexProbeClear = function () { _buf = null; };

window.__hexProbeGetBuf = function () { return _buf; };

/**
 * 在 stepGait 末尾调用。采样第一条匹配 prefix 的腿。
 * @param ctx      core context (含 legs, root, bodyWriter, hipAxis)
 * @param gaitInfo { gaitT, inStance, gaitPeriod, dynamicStride, bodySpeedNow, turnRate, animIndex }
 */
window.__hexProbeSample = function (ctx, gaitInfo) {
  if (!_buf) return;
  var THREE = window.THREE;          // 运行时动态读 (不同页面加载顺序不同)
  if (!THREE) return;                // THREE 未就绪则跳过采样, 不崩溃
  var root = ctx.root;
  // 找参考腿
  var leg = null;
  for (var i = 0; i < ctx.legs.length; i++) {
    if (ctx.legs[i].prefix === _legPrefix) { leg = ctx.legs[i]; break; }
  }
  if (!leg) return;

  root.updateMatrixWorld(true);

  // 关节角
  var hipRot;
  if (ctx.hipAxis === 'z') hipRot = leg.hipJoint.rotation.z;
  else hipRot = leg.hipJoint.rotation.y;

  // 脚尖世界位置
  var tipW = leg.tipLocal.clone().applyMatrix4(leg.anklePivot.matrixWorld);
  // 身体世界位置
  var bodyW = new THREE.Vector3(); root.getWorldPosition(bodyW);

  // 脚相对身体 (转到身体本地系, 去掉yaw)
  var footLocal = root.worldToLocal(tipW.clone());
  // 归一化 XZ 到 _initFootDist (使两端可比, 不受模型缩放影响)
  var reach = leg._initFootDist || 1;
  var footNrmX = footLocal.x / reach;
  var footNrmZ = footLocal.z / reach;

  _buf.rows.push({
    t: +(gaitInfo.totalTime || 0).toFixed(4),
    ai: gaitInfo.animIndex,
    bw: ctx.bodyWriter ? 1 : 0,
    // 关节角 (rad, 相对 rest 归零便于对比)
    hip: +(hipRot - (leg.restHip || 0)).toFixed(4),
    thigh: +(leg.thighPivot.rotation.x - (leg.restThigh || 0)).toFixed(4),
    shin: +(leg.shinPivot.rotation.x - (leg.restShin || 0)).toFixed(4),
    // 脚相对身体 (归一化)
    fx: +footNrmX.toFixed(4),
    fz: +footNrmZ.toFixed(4),
    fyRel: +(tipW.y - bodyW.y).toFixed(4),   // 正=脚低于身体(接地), 负=浮空
    // 步态参数
    gaitT: +(gaitInfo.gaitT || 0).toFixed(4),
    stance: gaitInfo.inStance ? 1 : 0,
    period: +(gaitInfo.gaitPeriod || 0).toFixed(4),
    stride: +(gaitInfo.dynamicStride || 0).toFixed(4),
    spd: +(gaitInfo.bodySpeedNow || 0).toFixed(4),
    tr: +(gaitInfo.turnRate || 0).toFixed(4)
  });
};

// ═══ 快捷键绑定 (浏览器端, 与 Claude Code keybindings 隔离) ═══
// F7=开始采样, F8=停止+存localStorage (仅当 DevTools 未打开时正常; F8在DevTools暂停脚本)
// 游戏用 WASD/ESC/F3, 不冲突
var _shortcutCounter = 0;
document.addEventListener('keydown', function (e) {
  if (e.code === 'F7' && !e.ctrlKey && !e.altKey && !e.metaKey) {
    e.preventDefault(); e.stopPropagation();
    _shortcutCounter++;
    var label = 'quick_' + _shortcutCounter + '_' + Date.now().toString(36);
    window.__hexProbeStart(label);
    console.log('[probe] 🔴 F7 开始采样: ' + label);
  } else if (e.code === 'F8' && !e.ctrlKey && !e.altKey && !e.metaKey) {
    e.preventDefault(); e.stopPropagation();
    if (_buf) {
      window.__hexProbeStop();
      console.log('[probe] ⏹ F8 停止采样 (帧数:' + _buf.rows.length + ' 已存localStorage)');
    } else {
      console.log('[probe] ⚠ F8 但无活跃采样');
    }
  }
});

})();
