// verify_skirt_runtime.js — v0.79.34c 椭圆顶圆台裙 浏览器验证
// 游戏侧：裙几何顶环椭圆(rx 0.157/rz 0.105)/底环圆(0.187)、学生裙长膝上5cm；工厂侧：Run 展台裙摆跟腿耦合
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const errors = [];
  let pass = 0, fail = 0;
  const ok = (c, m) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m); } };
  const collect = (p) => {
    p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    p.on('pageerror', (e) => errors.push(e.message));
  };

  // ── 游戏侧（enemies.js buildHumanoidRig 消费新几何类型）──
  const p = await browser.newPage(); collect(p);
  await p.goto('http://127.0.0.1:8080/index.html'); await p.waitForTimeout(3000);
  const r = await p.evaluate(() => {
    const out = {};
    [['student_f', 'ah_skirt'], ['teacher_f', 'ah_gskirt']].forEach(([vk, sn]) => {
      const z = window.EnemyModels.createCampusZombie({ variant: vk, seed: 5 });
      let node = null, mesh = null;
      z.traverse((c) => { if (!node && c.name === sn) node = c; if (!mesh && c.name === sn + '_mesh') mesh = c; });
      if (!node || !mesh) { out[vk] = null; return; }
      const pos = mesh.geometry.attributes.position;
      let maxY = -Infinity, minY = Infinity;
      for (let i = 0; i < pos.count; i++) {
        const y = pos.getY(i);
        if (y > maxY) maxY = y;
        if (y < minY) minY = y;
      }
      const localH = maxY - minY;
      const ext = (band) => {
        let mx = 0, mz = 0;
        for (let i = 0; i < pos.count; i++) {
          const y = pos.getY(i);
          if (band === 'top' ? y > maxY - 1e-3 : y < minY + 1e-3) {
            mx = Math.max(mx, Math.abs(pos.getX(i)));
            mz = Math.max(mz, Math.abs(pos.getZ(i)));
          }
        }
        return { mx, mz };
      };
      // 膝部世界 y（l_lower_leg pivot = 膝关节）
      let knee = null;
      z.updateMatrixWorld(true);
      z.traverse((c) => { if (knee === null && c.name === 'l_lower_leg_pivot') knee = c.getWorldPosition(new THREE.Vector3()).y; });
      const skirtMin = new THREE.Box3().setFromObject(mesh).min.y;
      out[vk] = {
        posZ: node.position.z,
        vcount: pos.count,
        localH: localH,
        top: ext('top'),
        bot: ext('bot'),
        kneeY: knee,
        skirtBottomY: skirtMin,
      };
    });
    return out;
  });
  // 学生
  ok(r.student_f && Math.abs(r.student_f.top.mx - 0.157) < 0.004, '学生裙顶环 X 半轴=' + r.student_f.top.mx.toFixed(3) + '（椭圆长轴）');
  ok(r.student_f && Math.abs(r.student_f.top.mz - 0.105) < 0.004, '学生裙顶环 Z 半轴=' + r.student_f.top.mz.toFixed(3) + '（椭圆短轴，旧圆 0.157——正/背面收窄）');
  ok(r.student_f && Math.abs(r.student_f.bot.mx - 0.187) < 0.004 && Math.abs(r.student_f.bot.mz - 0.187) < 0.004, '学生裙底环为圆 r=' + r.student_f.bot.mx.toFixed(3) + '/' + r.student_f.bot.mz.toFixed(3));
  ok(r.student_f && r.student_f.vcount >= 100, '学生裙几何非空（' + r.student_f.vcount + ' 顶点，16段×侧面+双盖）');
  ok(r.student_f && Math.abs(r.student_f.localH - 0.295) < 0.004, '学生裙长（网格本地高）=' + r.student_f.localH.toFixed(3) + '（0.32→0.295 缩短；世界系经 height 归一缩放~0.5，绝对值在数据层断言）');
  ok(r.student_f && (r.student_f.kneeY - r.student_f.skirtBottomY) < -0.01, '学生裙底在世界系高于膝 ' + (-(r.student_f.kneeY - r.student_f.skirtBottomY)).toFixed(3) + '（缩放后>0 即膝上）');
  // 教师
  ok(r.teacher_f && Math.abs(r.teacher_f.top.mx - 0.157) < 0.004 && Math.abs(r.teacher_f.top.mz - 0.105) < 0.004, '教师裙顶环椭圆 ' + r.teacher_f.top.mx.toFixed(3) + '×' + r.teacher_f.top.mz.toFixed(3));
  ok(r.teacher_f && Math.abs(r.teacher_f.bot.mx - 0.187) < 0.004 && Math.abs(r.teacher_f.bot.mz - 0.187) < 0.004, '教师裙底环为圆 r=' + r.teacher_f.bot.mx.toFixed(3));
  ok(r.teacher_f && Math.abs(r.teacher_f.localH - 0.38) < 0.004, '教师裙长不变（网格本地高=' + r.teacher_f.localH.toFixed(3) + '）');
  ok(Math.abs(r.student_f.posZ - 0.02) < 0.004 && Math.abs(r.teacher_f.posZ - 0.02) < 0.004, '裙轴前移 z=' + r.student_f.posZ.toFixed(3) + '/' + r.teacher_f.posZ.toFixed(3));
  await p.close();

  // ── 工厂侧（展台 Run 播放采样 + 椭圆几何）──
  const p2 = await browser.newPage(); collect(p2);
  await p2.goto('http://127.0.0.1:8080/model_factory.html');
  await p2.evaluate(() => localStorage.setItem('tank_model_factory_save', JSON.stringify({ modelType: 'humanoid' })));
  await p2.reload(); await p2.waitForTimeout(2500);
  const r2 = await p2.evaluate(() => {
    const out = {};
    _humanoidEdit.variant = 'student_f';
    _applyHumanoidEdit();
    let mesh = null;
    modelRoot.traverse((c) => { if (!mesh && c.name === 'ah_skirt_mesh') mesh = c; });
    out.hasMesh = !!mesh;
    if (mesh) {
      const pos = mesh.geometry.attributes.position;
      out.vcount = pos.count;
    }
    const HA = window.HumanoidAnims;
    HA.collectRefs();
    const runIdx = HA.names.findIndex((n) => /\(Run\)$/.test(n));
    const skirtX = () => { let o = null; modelRoot.traverse((c) => { if (!o && c.name === 'ah_skirt') o = c; }); return o ? o.rotation.x : null; };
    HA.updateFrame(0.0001, 0, 0, 1000, runIdx);
    out.skirtX_t0 = skirtX();
    HA.updateFrame(0.5, 0, 0, 1000, runIdx);
    out.skirtX_t05 = skirtX();
    return out;
  });
  ok(r2.hasMesh && r2.vcount >= 100, '工厂变体模式裙几何正常（' + r2.vcount + ' 顶点，factory createGeometry 消费 EllipFrustum）');
  ok(Math.abs(r2.skirtX_t0 - (-0.157)) < 0.02, 'Run t=0 前踢帧裙摆前倾 rotation.x=' + r2.skirtX_t0.toFixed(3) + '（=0.35×(-0.45)，跟腿耦合保持）');
  ok(Math.abs(r2.skirtX_t05 - 0.07) < 0.02, 'Run t=0.5 后摆帧裙摆后仰 rotation.x=' + r2.skirtX_t05.toFixed(3) + '（=0.35×(+0.20)，键 t0.45~0.6 插值）');
  await p2.evaluate(() => {
    const HA = window.HumanoidAnims;
    HA.collectRefs();
    HA.updateFrame(0.08, 0, 0, 1000, HA.names.findIndex((n) => /\(Run\)$/.test(n)));
  });
  await p2.waitForTimeout(400);
  await p2.screenshot({ path: 'artifacts/skirt_run_student_f.png' });
  console.log('  📸 截图 artifacts/skirt_run_student_f.png');
  ok(errors.length === 0, '0 控制台错误' + (errors.length ? ': ' + errors.slice(0, 3).join(';') : ''));
  console.log('Playwright: ' + pass + ' passed, ' + fail + ' failed');
  await browser.close();
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
