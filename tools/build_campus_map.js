#!/usr/bin/env node
/**
 * 校园地图转换器 — 把 OSM 导出的 jinfuyuan_school.json 转成游戏标准 mapConfig
 *
 * jinfuyuan_school.json: WGS84 经纬度 + footprint 多边形(非 mapConfig)
 * maps/campus.map.json: 游戏单位坐标 + footprintBuildings/grounds(标准 mapConfig, flat:true)
 *
 * 用法: node tools/build_campus_map.js
 */
const fs = require('fs');
const path = require('path');

const SRC = path.resolve(__dirname, '../maps/jinfuyuan_school.json');
const OUT = path.resolve(__dirname, '../maps/campus.map.json');
const METERS_PER_UNIT = 1.3;

const d = JSON.parse(fs.readFileSync(SRC, 'utf8'));

// 边界质心作投影原点
const b = d.boundary;
const cLat = b.reduce((s, p) => s + p.lat, 0) / b.length;
const cLng = b.reduce((s, p) => s + p.lng, 0) / b.length;
const mPerLat = 111320; // 1° lat ≈ 111.32km
const mPerLng = 111320 * Math.cos((cLat * Math.PI) / 180);

// 经纬度 → 游戏单位(米÷1.3), 以质心为原点
function proj(lng, lat) {
  return [-((lng - cLng) * mPerLng) / METERS_PER_UNIT, ((lat - cLat) * mPerLat) / METERS_PER_UNIT];
}

// footprint [[lng,lat]] → [[x,z]] 单位
function projFootprint(fp) {
  return fp.map((p) => proj(p[0], p[1]));
}

const blds = d.buildings.map((bd) => ({
  footprint: projFootprint(bd.footprint),
  height: +(bd.height / METERS_PER_UNIT).toFixed(3), // 米→单位
  name: bd.name || '',
  type: bd.type || 'school',
}));
const grounds = d.grounds.map((g) => ({
  footprint: projFootprint(g.footprint),
  kind: g.type || 'pitch',
}));
const boundary = d.boundary.map((p) => proj(p.lng, p.lat));

// 全点 bbox 居中
const allPts = [
  ...boundary,
  ...blds.flatMap((b) => b.footprint),
  ...grounds.flatMap((g) => g.footprint),
];
let minX = Infinity,
  maxX = -Infinity,
  minZ = Infinity,
  maxZ = -Infinity;
for (const [x, z] of allPts) {
  if (x < minX) minX = x;
  if (x > maxX) maxX = x;
  if (z < minZ) minZ = z;
  if (z > maxZ) maxZ = z;
}
const cx = (minX + maxX) / 2,
  cz = (minZ + maxZ) / 2;
const shift = (p) => [+(p[0] - cx).toFixed(3), +(p[1] - cz).toFixed(3)];

const blds2 = blds.map((b) => ({ ...b, footprint: b.footprint.map(shift) }));
const grounds2 = grounds.map((g) => ({ ...g, footprint: g.footprint.map(shift) }));
const boundary2 = boundary.map(shift);

const w = +(maxX - minX).toFixed(1),
  dpth = +(maxZ - minZ).toFixed(1);
const MARGIN = 60; // 世界边缘留白(单位)
const centroid = (fp) => {
  const c = [0, 0];
  for (const p of fp) {
    c[0] += p[0];
    c[1] += p[1];
  }
  return [c[0] / fp.length, c[1] / fp.length];
};
const g0 = grounds2[0] ? centroid(grounds2[0].footprint) : [-w / 3, -dpth / 3];
const g1 = grounds2[grounds2.length - 1]
  ? centroid(grounds2[grounds2.length - 1].footprint)
  : [w / 3, dpth / 3];

const out = {
  _mapId: 'campus',
  version: '1.0',
  name: '金福园小学',
  type: 'single',
  flat: true,
  desc: '韶关市武江区金福园小学(真实比例·OSM数据)',
  worldWidth: w + MARGIN,
  worldDepth: dpth + MARGIN,
  playWidth: w,
  playDepth: dpth,
  spawnPoints: {
    p1: [+g0[0].toFixed(1), +g0[1].toFixed(1), 0],
    p2: [+g1[0].toFixed(1), +g1[1].toFixed(1), Math.PI],
  },
  obstacles: {
    footprintBuildings: blds2,
    grounds: grounds2,
    boundary: boundary2,
    count: 0, // 无随机树/障碍(Poisson 关闭)
    minDist: 6,
    safeRadius: 0,
    spawnRadius: 0,
  },
};

fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
console.log(`✅ 生成 ${path.relative(process.cwd(), OUT)}`);
console.log(`   建筑: ${blds2.length} 栋, 操场: ${grounds2.length} 块`);
console.log(
  `   校园尺寸: ${w} × ${dpth} 单位 (≈${(w * 1.3).toFixed(0)}m × ${(dpth * 1.3).toFixed(0)}m)`
);
console.log(`   世界尺寸: ${out.worldWidth} × ${out.worldDepth} 单位`);
console.log(
  `   出生点: p1=(${out.spawnPoints.p1[0]},${out.spawnPoints.p1[1]}) p2=(${out.spawnPoints.p2[0]},${out.spawnPoints.p2[1]})`
);
