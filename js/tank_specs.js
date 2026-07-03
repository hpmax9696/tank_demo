// 坦克性能参数表 TANK_SPECS — v0.65.14
// 玩家/敌方共用，按坦克型号索引（t34 / tiger）
//   玩家：createPlayerTank 时 player.spec = TANK_SPECS[tankModel]
//   敌方：生成时 cfg.spec = TANK_SPECS[tankVariant]，cfg.type='tank' 复用坦克 AI/开火/装甲逻辑
// 数值依据：真实 T-34-85 vs Tiger I 历史比例，压缩到可玩区间
//   虎式 = 重甲/慢速/大火力/慢炮塔/远视；T-34 = 轻甲/快速/中火力/快炮塔
(function () {
  'use strict';
  window.TANK_SPECS = {
    // ── T-34-85（基准）──
    t34: {
      // 玩家车体
      maxSpeed: 8.0, // 前进（单位/s，1单位=1.3m）
      reverseSpeed: 8.0, // 前进倒车同速
      trackAccel: 40,
      trackDecel: 40,
      trackCoast: 40,
      trackSpacing: 3.2, // 履带间距（转向 omega=(L-R)/spacing）
      // 炮塔/炮管
      turretAngVel: 0.7854, // 45°/s
      barrelAngVel: 0.3491, // 20°/s
      gunElevation: 10, // 仰角度（使用处 maxUp = -elevation·π/180）
      gunDepression: 25, // 俯角度（使用处 maxDown = +depression·π/180）
      // 装填/炮弹
      reloadTime: 2.0,
      shellDamage: 20,
      heDamage: 12,
      heSplash: 2.0,
      shellSpeed: 50,
      shellGravity: 1.0,
      shellMaxDist: 300,
      explosionRadius: 3.5,
      recoil: -0.08,
      spread: 0, // 玩家精准
      // 血量/视野
      hp: 100,
      viewDist: 80,
      // 敌方专用
      enemyHp: 100,
      enemySpeed: 6.0, // cfg.speed（追击×1.3 复用）
      enemyTurretTurnSpeed: 1.0, // aimTurretAt turnSpeed
      enemyReloadMin: 2.5,
      enemyReloadMax: 3.5,
      enemySpread: 0.07, // ≈4°
      enemyShellDamage: 20,
      enemySplashDamage: 7,
      engageDist: 50,
      flameRange: 55,
      // 标记
      hasAAMG: false, // 无防空高射机枪
    },

    // ── 虎式 I（Tiger I）──
    tiger: {
      // 玩家车体（重：慢速、慢加速、独立慢倒车）
      maxSpeed: 6.0, // 公路 38-45 vs T-34 55 km/h → 0.75×
      reverseSpeed: 3.5, // 重坦倒车慢（新增独立项）
      trackAccel: 28,
      trackDecel: 28,
      trackCoast: 28, // 57t 重惯量大
      trackSpacing: 3.6, // 宽履带
      // 炮塔/炮管（历史 4:1 慢，压到 2.25:1 可玩）
      turretAngVel: 0.35, // 20°/s（历史液压 6°/s）
      barrelAngVel: 0.22, // 12.6°/s
      gunElevation: 15, // 真实虎式 88mm KwK 36 L/56 仰角
      gunDepression: 8, // 真实虎式俯角（hull-down 优势）
      // 装填/炮弹（88mm 重炮：慢装填 + 大威力）
      reloadTime: 3.0,
      shellDamage: 30, // 穿甲 1.5×（1000m 150 vs 100mm）
      heDamage: 18,
      heSplash: 2.5,
      shellSpeed: 52,
      shellGravity: 1.0,
      shellMaxDist: 300, // 88mm 略高
      explosionRadius: 4.0, // 88mm 装药多
      recoil: -0.12, // 88mm 后坐大
      spread: 0, // 光学优（TZF 9b 双筒），精准
      // 血量/视野（装甲 1.6×压缩；光学优）
      hp: 160,
      viewDist: 110,
      // 敌方专用
      enemyHp: 160,
      enemySpeed: 4.5,
      enemyTurretTurnSpeed: 0.5, // 慢炮塔身份，AI 略补偿
      enemyReloadMin: 3.5,
      enemyReloadMax: 4.5,
      enemySpread: 0.05, // ≈2.9°（光学好，比 T-34 敌方精准）
      enemyShellDamage: 30,
      enemySplashDamage: 10,
      engageDist: 60, // 远距对狙
      flameRange: 65, // 88mm 射程远
      // 标记
      hasAAMG: true, // 顶置 MG34 高射（后续实装武器系统）
    },
  };
})();
