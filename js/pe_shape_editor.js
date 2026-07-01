// ProfiledExtrude shape 2D 可视化编辑器（拖拽控制点改 shape）
// 暴露 window.PEShapeEditor.open(configNode, rebuild) / close()
// 编辑原始轮廓坐标；整体缩放由 model_factory 的 shapeScale 滑块独立控制
(function () {
  let overlay = null,
    canvas = null,
    ctx = null;
  let target = null,
    rebuildFn = null;
  let handles = [];
  let dragging = null;
  let viewScale = 100,
    offX = 210,
    offY = 210;
  let dirty = false;
  const SIZE = 440;
  const PICK = 12; // 屏幕拾取半径 px

  const DEFAULT_SHAPE = [
    ['line', -0.55, 0.85],
    ['line', -0.75, -0.35],
    ['arc', 0, -0.35, 0.75, Math.PI, 0],
    ['line', 0.75, -0.35],
    ['line', 0.55, 0.85],
  ];

  function ensureDOM() {
    if (overlay) return;
    overlay = document.createElement('div');
    overlay.style.cssText =
      'position:fixed;inset:0;background:rgba(0,0,0,0.55);display:none;align-items:center;justify-content:center;z-index:99999;font-family:sans-serif;';
    const panel = document.createElement('div');
    panel.style.cssText =
      'background:#1a1a2e;padding:14px 16px;border-radius:8px;border:1px solid #4ecdc4;box-shadow:0 8px 32px rgba(0,0,0,0.6);';
    const title = document.createElement('div');
    title.textContent = '✏️ 轮廓编辑 — 拖拽控制点';
    title.style.cssText = 'color:#4ecdc4;font-weight:bold;margin-bottom:8px;font-size:14px;';
    canvas = document.createElement('canvas');
    canvas.width = SIZE;
    canvas.height = SIZE;
    canvas.style.cssText =
      'background:#0d0d1a;border:1px solid #2a2a3e;cursor:crosshair;display:block;border-radius:4px;touch-action:none;';
    ctx = canvas.getContext('2d');
    const hint = document.createElement('div');
    hint.innerHTML =
      '<span style="color:#5dade2">■</span> line 端点 &nbsp; <span style="color:#58d68d">●</span> arc 圆心 &nbsp; <span style="color:#f4d03f">●</span> 半径/角度手柄<br/><span style="color:#888;font-size:11px;">编辑原始轮廓（整体缩放另用📏滑块）· Esc 或点背景关闭</span>';
    hint.style.cssText = 'color:#bbb;font-size:12px;margin-top:8px;line-height:1.6;';
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '关闭 (Esc)';
    closeBtn.style.cssText =
      'margin-top:10px;padding:5px 16px;cursor:pointer;background:#4ecdc4;color:#0d0d1a;border:none;border-radius:4px;font-weight:bold;';
    closeBtn.onclick = close;
    panel.appendChild(title);
    panel.appendChild(canvas);
    panel.appendChild(hint);
    panel.appendChild(closeBtn);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);

    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      close();
    });
    overlay.addEventListener('pointerdown', (e) => {
      if (e.target === overlay) close();
    });
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && overlay.style.display === 'flex') close();
    });
  }

  function open(configNode, rebuild) {
    target = configNode;
    rebuildFn = rebuild;
    ensureDOM();
    if (!target.shape) target.shape = JSON.parse(JSON.stringify(DEFAULT_SHAPE));
    fitView();
    render();
    overlay.style.display = 'flex';
  }
  function close() {
    if (overlay) overlay.style.display = 'none';
    dragging = null;
  }

  function computeBBox(shape) {
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    const pt = (x, y) => {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    };
    for (const s of shape) {
      if (s[0] === 'line') pt(s[1], s[2]);
      else if (s[0] === 'arc') {
        // 采样弧上多点（含扫过区域），否则 bbox 会漏掉弧底部
        const cx = s[1],
          cy = s[2],
          r = s[3],
          a1 = s[4],
          a2 = s[5],
          cw = s[6] === true;
        let da = cw ? a1 - a2 : a2 - a1;
        if (da < 0) da += Math.PI * 2;
        for (let k = 0; k <= 12; k++) {
          const a = cw ? a1 - (da * k) / 12 : a1 + (da * k) / 12;
          pt(cx + r * Math.cos(a), cy + r * Math.sin(a));
        }
        pt(cx, cy);
      }
    }
    if (!isFinite(minX)) return { minX: -1, minY: -1, maxX: 1, maxY: 1 };
    return { minX, minY, maxX, maxY };
  }
  function fitView() {
    const b = computeBBox(target.shape);
    const w = Math.max(b.maxX - b.minX, 0.001),
      h = Math.max(b.maxY - b.minY, 0.001);
    const pad = 55;
    viewScale = Math.min((SIZE - pad * 2) / w, (SIZE - pad * 2) / h);
    offX = SIZE / 2 - (b.minX + w / 2) * viewScale;
    offY = SIZE / 2 - (b.minY + h / 2) * viewScale;
  }
  const w2s = (x, y) => [x * viewScale + offX, y * viewScale + offY];
  const s2w = (sx, sy) => [(sx - offX) / viewScale, (sy - offY) / viewScale];

  function buildHandles() {
    handles = [];
    target.shape.forEach((s, i) => {
      if (s[0] === 'line') {
        handles.push({ kind: 'vertex', seg: i, wx: s[1], wy: s[2] });
      } else if (s[0] === 'arc') {
        const cx = s[1],
          cy = s[2],
          r = s[3],
          a1 = s[4],
          a2 = s[5];
        handles.push({ kind: 'arccenter', seg: i, wx: cx, wy: cy });
        handles.push({
          kind: 'arcangle',
          seg: i,
          sub: 'a1',
          wx: cx + r * Math.cos(a1),
          wy: cy + r * Math.sin(a1),
        });
        handles.push({
          kind: 'arcangle',
          seg: i,
          sub: 'a2',
          wx: cx + r * Math.cos(a2),
          wy: cy + r * Math.sin(a2),
        });
        const am = (a1 + a2) / 2;
        handles.push({
          kind: 'arcradius',
          seg: i,
          wx: cx + r * Math.cos(am),
          wy: cy + r * Math.sin(am),
        });
      }
    });
  }

  function render() {
    buildHandles();
    ctx.clearRect(0, 0, SIZE, SIZE);
    // 坐标轴（原点参考线）
    ctx.strokeStyle = '#1f1f33';
    ctx.lineWidth = 1;
    const [zx, zy] = w2s(0, 0);
    ctx.beginPath();
    ctx.moveTo(0, zy);
    ctx.lineTo(SIZE, zy);
    ctx.moveTo(zx, 0);
    ctx.lineTo(zx, SIZE);
    ctx.stroke();
    // shape 路径（采样画弧，方向与 THREE.Shape.absarc 一致）
    ctx.strokeStyle = '#4ecdc4';
    ctx.fillStyle = 'rgba(78,205,196,0.12)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    let first = true;
    for (const s of target.shape) {
      if (s[0] === 'line') {
        const [sx, sy] = w2s(s[1], s[2]);
        if (first) {
          ctx.moveTo(sx, sy);
          first = false;
        } else ctx.lineTo(sx, sy);
      } else if (s[0] === 'arc') {
        const cx = s[1],
          cy = s[2],
          r = s[3],
          a1 = s[4],
          a2 = s[5],
          cw = s[6] === true;
        let da = cw ? a1 - a2 : a2 - a1;
        if (da < 0) da += Math.PI * 2;
        const N = 32;
        for (let k = 1; k <= N; k++) {
          const a = cw ? a1 - (da * k) / N : a1 + (da * k) / N;
          const [px, py] = w2s(cx + r * Math.cos(a), cy + r * Math.sin(a));
          ctx.lineTo(px, py);
        }
      }
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // 控制点
    for (const h of handles) {
      const [sx, sy] = w2s(h.wx, h.wy);
      ctx.beginPath();
      if (h.kind === 'vertex') {
        ctx.fillStyle = '#5dade2';
        ctx.fillRect(sx - 5, sy - 5, 10, 10);
      } else if (h.kind === 'arccenter') {
        ctx.fillStyle = '#58d68d';
        ctx.arc(sx, sy, 6, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = '#f4d03f';
        ctx.arc(sx, sy, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // rAF 节流 rebuild：拖拽时每帧最多重建一次，保持流畅
  function scheduleRebuild() {
    if (dirty) return;
    dirty = true;
    requestAnimationFrame(() => {
      dirty = false;
      try {
        rebuildFn();
      } catch (e) {}
    });
  }

  function onDown(e) {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left,
      my = e.clientY - rect.top;
    let best = null,
      bestD = PICK;
    for (const h of handles) {
      const [sx, sy] = w2s(h.wx, h.wy);
      const d = Math.hypot(sx - mx, sy - my);
      if (d < bestD) {
        bestD = d;
        best = h;
      }
    }
    if (best) {
      dragging = best;
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch (_) {}
    }
  }
  function onMove(e) {
    if (!dragging) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left,
      my = e.clientY - rect.top;
    const [wx, wy] = s2w(mx, my);
    const seg = target.shape[dragging.seg];
    if (dragging.kind === 'vertex' || dragging.kind === 'arccenter') {
      seg[1] = +wx.toFixed(3);
      seg[2] = +wy.toFixed(3);
    } else if (dragging.kind === 'arcangle') {
      const ang = Math.atan2(wy - seg[2], wx - seg[1]);
      if (dragging.sub === 'a1') seg[4] = +ang.toFixed(3);
      else seg[5] = +ang.toFixed(3);
    } else if (dragging.kind === 'arcradius') {
      seg[3] = +Math.max(0.01, Math.hypot(wx - seg[1], wy - seg[2])).toFixed(3);
    }
    render();
    scheduleRebuild();
  }
  function onUp() {
    dragging = null;
  }

  window.PEShapeEditor = { open, close };
})();
