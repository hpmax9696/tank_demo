// ProfiledExtrude 几何构建 — v0.65.14 从 model_factory.html 抽出共享
// 游戏运行时(t34_v16_builder.createGeometry) 用; 模型工厂保留自己的内联副本
// XY 轮廓(shape: line/arc 数组) + roofProfile 沿 Z 变高拉伸 → 马蹄形炮塔等
(function () {
  'use strict';

  function buildProfiledExtrude(shapeDef, roofProfile, arcSegments) {
    // 1. 构建 THREE.Shape
    const shape = new THREE.Shape();
    let first = true;
    for (const seg of shapeDef) {
      if (seg[0] === 'arc') {
        const [, cx, cy, radius, startAngle, endAngle, clockwise] = seg;
        if (first) {
          shape.moveTo(cx + radius * Math.cos(startAngle), cy + radius * Math.sin(startAngle));
          first = false;
        }
        shape.absarc(cx, cy, radius, startAngle, endAngle, clockwise === true);
      } else if (seg[0] === 'line') {
        const [, x, y] = seg;
        if (first) {
          shape.moveTo(x, y);
          first = false;
        } else shape.lineTo(x, y);
      }
    }
    shape.closePath();

    // 2. roof 高度插值
    function roofH(y) {
      if (!roofProfile || roofProfile.length === 0) return 1.0;
      if (roofProfile.length === 1) return roofProfile[0][1];
      const sorted = [...roofProfile].sort((a, b) => b[0] - a[0]);
      if (y >= sorted[0][0]) return sorted[0][1];
      if (y <= sorted[sorted.length - 1][0]) return sorted[sorted.length - 1][1];
      for (let i = 0; i < sorted.length - 1; i++) {
        const [y0, h0] = sorted[i];
        const [y1, h1] = sorted[i + 1];
        if ((y <= y0 && y >= y1) || (y >= y0 && y <= y1)) {
          if (Math.abs(y1 - y0) < 1e-9) return h0;
          return h0 + ((y - y0) / (y1 - y0)) * (h1 - h0);
        }
      }
      return sorted[0][1];
    }

    // 3. 边界采样
    const bpts = shape.getPoints(arcSegments);
    const N = bpts.length - 1;

    const verts = [],
      uvs = [],
      idxArr = [];
    let vi = 0;

    function addQuad(a, b, c, d, u0, u1) {
      verts.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2], d[0], d[1], d[2]);
      uvs.push(u0, 0, u1, 0, u1, 1, u0, 1);
      idxArr.push(vi, vi + 1, vi + 2, vi, vi + 2, vi + 3);
      vi += 4;
    }

    // 4. 侧面 quad strip
    for (let i = 0; i < N; i++) {
      const j = (i + 1) % N;
      const pi = bpts[i],
        pj = bpts[j];
      const hi = roofH(pi.y),
        hj = roofH(pj.y);
      const u0 = i / N,
        u1 = (i + 1) / N;
      addQuad([pi.x, pi.y, 0], [pj.x, pj.y, 0], [pj.x, pj.y, hj], [pi.x, pi.y, hi], u0, u1);
    }

    // 5. 底面 cap (法线 -Z)
    const capGeo = new THREE.ShapeGeometry(shape, arcSegments);
    const capPos = capGeo.getAttribute('position');
    const capIdx = capGeo.getIndex();
    const EPS = 0.0001;

    const floorBase = vi;
    for (let i = 0; i < capPos.count; i++) {
      verts.push(capPos.getX(i), capPos.getY(i), -EPS);
      uvs.push(capPos.getX(i), capPos.getY(i));
    }
    for (let i = 0; i < capIdx.count; i += 3) {
      idxArr.push(
        capIdx.getX(i) + floorBase,
        capIdx.getX(i + 2) + floorBase,
        capIdx.getX(i + 1) + floorBase
      );
    }
    vi += capPos.count;

    // 6. 屋顶 cap (法线 +Z)
    const roofBase = vi;
    for (let i = 0; i < capPos.count; i++) {
      const y = capPos.getY(i);
      verts.push(capPos.getX(i), y, roofH(y) + EPS);
      uvs.push(capPos.getX(i), y);
    }
    for (let i = 0; i < capIdx.count; i++) idxArr.push(capIdx.getX(i) + roofBase);
    vi += capPos.count;
    capGeo.dispose();

    // 7. 组装
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(verts), 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uvs), 2));
    geo.setIndex(idxArr);
    geo.computeVertexNormals();
    return geo;
  }

  window.buildProfiledExtrude = buildProfiledExtrude;
})();
