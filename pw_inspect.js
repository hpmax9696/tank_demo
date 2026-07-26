// 连接常驻 chromium(9333)，诊断 addon 装配状态（存在性/world坐标/可见性）
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.connectOverCDP('http://localhost:9333');
  const p = b.contexts()[0].pages().pop();
  const r = await p.evaluate(() => {
    const z = window._zombie;
    const find = (name) => z.getObjectByName(name);
    const info = (name) => {
      const o = find(name);
      if (!o) return { name, MISSING: true };
      const wp = new THREE.Vector3();
      o.getWorldPosition(wp);
      // 数 mesh 子孙
      let meshCount = 0;
      o.traverse((c) => {
        if (c.isMesh) meshCount++;
      });
      return {
        name,
        vis: o.visible,
        world: [+wp.x.toFixed(2), +wp.y.toFixed(2), +wp.z.toFixed(2)],
        meshes: meshCount,
        parent: o.parent && o.parent.name,
      };
    };
    return {
      head: info('head'),
      torso: info('torso'),
      pelvis: info('pelvis'),
      neck: info('neck'),
      hair_m: info('ah_m'),
      hair_pt: info('ah_pt'),
      fringe: info('ah_fr'),
      collar_l: info('ah_col_l'),
      placket: info('ah_pl'),
      badge: info('ah_badge'),
      stripes: info('ah_str'),
      scarf_knot: info('ah_sc_knot'),
      shorts_l: info('ah_sh_l'),
      shoe_l: info('ah_sh_l'),
      totalMeshes: (function () {
        let n = 0;
        z.traverse((c) => {
          if (c.isMesh) n++;
        });
        return n;
      })(),
    };
  });
  console.log(JSON.stringify(r, null, 2));
  await b.close();
})();
