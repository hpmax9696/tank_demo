const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  p.on('pageerror', (e) => console.log('PAGEERR:', e.message.slice(0, 150)));
  await p.goto('http://127.0.0.1:8080/model_factory.html');
  await p.evaluate(() => localStorage.setItem('tank_model_factory_save', JSON.stringify({ modelType: 'humanoid' })));
  await p.reload(); await p.waitForTimeout(2500);
  const r = await p.evaluate(() => {
    const out = {};
    let footM = null, shoeM = null, headM = null, hairM = null;
    modelRoot.traverse((c) => {
      if (!footM && c.name === 'l_foot_mesh') footM = c;
      if (!shoeM && c.name === 'ah_sh_l_mesh') shoeM = c;
      if (!headM && c.name === 'head_mesh') headM = c;
      if (!hairM && c.name === 'ah_m_mesh') hairM = c;
    });
    out.found = { foot: !!footM, shoe: !!shoeM, head: !!headM, hair: !!hairM };
    const probe = (m) => {
      if (!m) return null;
      m.updateWorldMatrix(true, false);
      const g = m.geometry;
      const bb = g.boundingBox || (g.computeBoundingBox(), g.boundingBox);
      return { localBB: [bb.min.x.toFixed(3), bb.min.y.toFixed(3), bb.min.z.toFixed(3), bb.max.x.toFixed(3), bb.max.y.toFixed(3), bb.max.z.toFixed(3)], pos: [m.position.x.toFixed(3), m.position.y.toFixed(3), m.position.z.toFixed(3)] };
    };
    out.foot = probe(footM);
    out.shoe = probe(shoeM);
    out.head = probe(headM);
    out.hair = probe(hairM);
    // 父链位置
    if (shoeM) {
      const chain = [];
      let n = shoeM.parent;
      while (n && n !== modelRoot) { chain.push(n.name + '@' + n.position.x.toFixed(2) + ',' + n.position.y.toFixed(2) + ',' + n.position.z.toFixed(2)); n = n.parent; }
      out.shoeChain = chain;
    }
    return out;
  });
  console.log(JSON.stringify(r, null, 1));
  await b.close();
})();
