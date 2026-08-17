// 游戏侧验证：index.html 菜单态下 createCampusZombie 姿态链路（树静态驼背 + 动画 rest 驼背）
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto('http://127.0.0.1:8080/index.html');
  await page.waitForTimeout(3000);

  const r = await page.evaluate(() => {
    const out = {};
    if (!window.EnemyModels || !window.HumanoidConfig) {
      out.loadFail = true;
      return out;
    }
    const HC = window.HumanoidConfig;
    const variants = ['student_m', 'student_f', 'teacher_m', 'teacher_f'];
    out.zombies = variants.map((v) => {
      const z = window.EnemyModels.createCampusZombie({ variant: v, seed: 42 });
      let torsoPivot = null;
      z.traverse((o) => {
        if (o.name === 'torso_pivot') torsoPivot = o;
      });
      // teacher_f torso 为 Group（沙漏躯干）无 pivot，rotation 在原对象（与播放器 _O 兜底同构）
      if (!torsoPivot) z.traverse((o) => { if (o.name === 'torso') torsoPivot = o; });
      const asys = z.userData._animSystem;
      const rest = asys._restPoses;
      const hunch0 = HC.HUMANOID_VARIANTS[v].bodyRange.hunch[0];
      const staticX = torsoPivot ? torsoPivot.rotation.x : null;
      asys.play('Idle', true);
      for (let i = 0; i < 30; i++) asys.update(0.016);
      return {
        variant: v,
        hunchMin: hunch0,
        staticTorsoPivotX: staticX == null ? null : +staticX.toFixed(3),
        restTorso: rest['torso:x'],
        restNeck: rest['neck:x'],
        restHead: rest['head:z'],
        animTorsoPivotX: torsoPivot ? +torsoPivot.rotation.x.toFixed(3) : null,
      };
    });
    return out;
  });

  console.log(JSON.stringify(r, null, 1));
  console.log('console errors:', errors.length ? errors : 'NONE');
  await browser.close();

  let fail = 0;
  const ok = (c, m) => { if (!c) { fail++; console.log('✗ ' + m); } else console.log('✓ ' + m); };
  if (r.loadFail) {
    console.log('✗ EnemyModels/HumanoidConfig 未加载');
    process.exit(1);
  }
  r.zombies.forEach((z) => {
    const isStudent = z.variant.startsWith('student');
    ok(z.animTorsoPivotX != null, z.variant + ' torso_pivot 存在');
    // v0.79.24: 丧尸全系统一驼背（烘焙 hunch 0.2 静态 + 动画 rest）
    ok(Math.abs(z.animTorsoPivotX - 0.2) < 0.02, z.variant + ' 丧尸统一驼背 pivotX=' + z.animTorsoPivotX + '（≈0.2, v0.79.24 烘焙静态）');
    ok(Math.abs(z.staticTorsoPivotX - z.animTorsoPivotX) < 1e-6, z.variant + ' Idle 不触碰 torso（静态=动画后）');
    ok(z.restTorso === 0.2 && z.restNeck === 0.22 && z.restHead === 0.08, z.variant + ' asys rest 丧尸基线 0.2/0.22/+0.08（v0.79.24 新树不镜像）');
  });
  ok(errors.filter((e) => !e.includes('favicon')).length === 0, '0 控制台错误');
  process.exit(fail ? 1 : 0);
})();
