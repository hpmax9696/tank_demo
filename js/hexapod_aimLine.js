/**
 * HexapodAimLine — 六足加特林双瞄准线模块 v0.3
 *
 * 为六足玩家两挺加特林各绘制一条连续射线 (直线, 无重力), 从枪口出发沿枪管指向,
 * 一直延伸到被截断为止 (射向虚空时延伸到 MAX_LEN 自然终止)。
 *
 * 着色: 枪口 → 射程(25m) 为绿色; 超出射程(25m → 截断点) 为红色。
 *   - 命中点 < 25m: 仅绿段 (0 → 命中点), 无红段
 *   - 命中点 ≥ 25m 或射向虚空: 绿段 (0 → 25) + 红段 (25 → 截断点/MAX_LEN)
 *   - 过热(overheated): 全线红色
 *   - 冷却中(heat>0): 全线橙色
 * 末端球形标志仅在命中物体时显示。
 *
 * 依赖: THREE.js, getGroundHeight(window), isInRiver, isInPond, getBridgeSurfaceY (全局函数)
 */
var HexapodAimLine = (function () {
'use strict';

  var GATLING_RANGE = 25;          // 绿/红分界 = 加特林子弹最大射程
  var MAX_LEN = 80;                // 瞄准线最大长度 (射向虚空时终止)
  var SEGMENTS = 24;               // 采样段数 (覆盖 MAX_LEN)
  var WATER_LEVEL = -1.0;
  var COLOR_GREEN = 0x00ff88;
  var COLOR_RED = 0xff3333;
  var COLOR_ORANGE = 0xff8800;

  // 每侧: 绿线 + 红线 + 球
  var _greenLines = {};
  var _redLines = {};
  var _dots = {};
  var _active = false;
  var _scene = null;

  var _rc = new THREE.Raycaster();
  _rc.far = MAX_LEN + 5;

  // ── 线段-圆柱碰撞 ──
  function _segmentCylinderHit(x1, z1, y1, x2, z2, y2, cx, cz, cr, cTop, cBot) {
    var dx = x2 - x1, dz = z2 - z1, dy = y2 - y1;
    var lenXZ = Math.sqrt(dx * dx + dz * dz);
    if (lenXZ < 1e-6) {
      var distXZ = Math.sqrt((x1 - cx) * (x1 - cx) + (z1 - cz) * (z1 - cz));
      if (distXZ <= cr && y1 >= cBot && y1 <= cTop) return { hit: true, y: y1 };
      return null;
    }
    var fx = dx / lenXZ, fz = dz / lenXZ;
    var t = Math.max(0, Math.min(lenXZ, fx * (cx - x1) + fz * (cz - z1)));
    var px = x1 + fx * t, pz = z1 + fz * t;
    var distXZ = Math.sqrt((px - cx) * (px - cx) + (pz - cz) * (pz - cz));
    if (distXZ <= cr) {
      var py = y1 + dy * (lenXZ > 0.001 ? t / lenXZ : 0);
      if (py >= cBot && py <= cTop) return { hit: true, y: py };
    }
    return null;
  }

  // ── 碰撞检测 (采样到 MAX_LEN), 返回 { hitPoint:Vector3|null, hitDist:float(Infinity=无命中) } ──
  function _castRay(muzzlePos, muzzleDir, ctx) {
    var hitPoint = null;
    var hitDist = Infinity;
    var segLen = MAX_LEN / SEGMENTS;
    var prev = muzzlePos.clone();

    for (var i = 1; i <= SEGMENTS; i++) {
      var sample = muzzlePos.clone().addScaledVector(muzzleDir, i * segLen);
      var segDir = sample.clone().sub(prev).normalize();
      var segDist = sample.distanceTo(prev);
      var earlyBreak = false;

      // 1. 地面
      var gh = window.getGroundHeight ? window.getGroundHeight(sample.x, sample.z) : sample.y;
      if (sample.y < gh) {
        var prevGH = window.getGroundHeight ? window.getGroundHeight(prev.x, prev.z) : prev.y;
        var frac = Math.max(0, Math.min(1, (prev.y - prevGH) / ((prev.y - prevGH) - (sample.y - gh) + 1e-8)));
        hitPoint = prev.clone().addScaledVector(segDir, segDist * frac);
        hitDist = muzzlePos.distanceTo(hitPoint);
        earlyBreak = true;
      }

      // 2. 水面
      if (!earlyBreak && typeof isInRiver === 'function' && typeof isInPond === 'function') {
        if ((isInRiver(sample.x, sample.z) || isInPond(sample.x, sample.z)) && sample.y < WATER_LEVEL) {
          hitPoint = new THREE.Vector3(sample.x, WATER_LEVEL, sample.z);
          hitDist = muzzlePos.distanceTo(hitPoint);
          earlyBreak = true;
        }
      }

      // 3. 桥面
      if (!earlyBreak && typeof getBridgeSurfaceY === 'function') {
        var bsy = getBridgeSurfaceY(sample.x, sample.z);
        if (bsy !== null && sample.y < bsy + 0.3 && prev.y >= bsy - 0.1) {
          var bFrac = Math.max(0, Math.min(1, (prev.y - bsy) / (prev.y - sample.y + 1e-8)));
          hitPoint = prev.clone().addScaledVector(segDir, segDist * bFrac);
          hitDist = muzzlePos.distanceTo(hitPoint);
          earlyBreak = true;
        }
      }

      // 4. 障碍物 Mesh
      if (!earlyBreak && ctx.obstacleMeshes && ctx.obstacleMeshes.length > 0) {
        _rc.set(prev, segDir);
        _rc.far = segDist + 0.5;
        var hits = _rc.intersectObjects(ctx.obstacleMeshes, true);
        if (hits.length > 0) {
          hitPoint = hits[0].point.clone();
          hitDist = muzzlePos.distanceTo(hitPoint);
          earlyBreak = true;
        }
      }

      // 5. 敌人
      if (!earlyBreak && ctx.enemies && ctx.enemies.length > 0) {
        for (var ei = 0; ei < ctx.enemies.length; ei++) {
          var en = ctx.enemies[ei];
          if (!en || en.dead) continue;
          var ePos = en.group ? en.group.position : (en.position || null);
          if (!ePos) continue;
          var eR, eH;
          if (en.cfg && en.cfg.type === 'hexapod') { eR = 1.0; eH = 2.0; }
          else if (en.cfg && en.cfg.type === 'zombie') { eR = 0.4; eH = 1.8; }
          else { eR = 1.0; eH = 0.8; }
          var ch = _segmentCylinderHit(prev.x, prev.z, prev.y, sample.x, sample.z, sample.y,
                                         ePos.x, ePos.z, eR, ePos.y + eH * 0.5, ePos.y - eH * 0.5);
          if (ch && ch.hit) {
            var toE = new THREE.Vector2(ePos.x - prev.x, ePos.z - prev.z);
            var seg2 = new THREE.Vector2(sample.x - prev.x, sample.z - prev.z);
            var segLen2 = seg2.length();
            if (segLen2 > 1e-6) {
              var tE = Math.max(0, Math.min(1, toE.dot(seg2) / (segLen2 * segLen2)));
              hitPoint = prev.clone().addScaledVector(segDir, segDist * tE);
            }
            hitDist = muzzlePos.distanceTo(hitPoint);
            earlyBreak = true;
            break;
          }
        }
      }

      if (earlyBreak) break;
      prev = sample;
    }

    return { hitPoint: hitPoint, hitDist: hitDist };
  }

  // ── 更新单条线几何体 (两点) ──
  function _updateLineGeo(line, p1, p2) {
    var arr = new Float32Array(6);
    arr[0] = p1.x; arr[1] = p1.y; arr[2] = p1.z;
    arr[3] = p2.x; arr[4] = p2.y; arr[5] = p2.z;
    line.geometry.dispose();
    line.geometry = new THREE.BufferGeometry();
    line.geometry.setAttribute('position', new THREE.BufferAttribute(arr, 3));
  }

  // ════════════════════════════════════════
  //  公开 API
  // ════════════════════════════════════════

  function activate(scene) {
    if (_active) deactivate();
    _scene = scene;
    _active = true;

    ['left', 'right'].forEach(function(side) {
      var gGeo = new THREE.BufferGeometry();
      var gMat = new THREE.LineBasicMaterial({ color: COLOR_GREEN, transparent: true, opacity: 0.5, depthTest: true });
      _greenLines[side] = new THREE.Line(gGeo, gMat);
      scene.add(_greenLines[side]);

      var rGeo = new THREE.BufferGeometry();
      var rMat = new THREE.LineBasicMaterial({ color: COLOR_RED, transparent: true, opacity: 0.5, depthTest: true });
      _redLines[side] = new THREE.Line(rGeo, rMat);
      _redLines[side].visible = false;
      scene.add(_redLines[side]);

      var dotGeo = new THREE.SphereGeometry(0.2, 8, 8);
      var dotMat = new THREE.MeshBasicMaterial({ color: COLOR_GREEN, transparent: true, opacity: 0.7, depthTest: false });
      _dots[side] = new THREE.Mesh(dotGeo, dotMat);
      _dots[side].visible = false;
      scene.add(_dots[side]);
    });
  }

  function deactivate() {
    ['left', 'right'].forEach(function(side) {
      [_greenLines, _redLines].forEach(function(map) {
        if (map[side]) {
          if (map[side].parent) map[side].parent.remove(map[side]);
          map[side].geometry.dispose();
          map[side].material.dispose();
          map[side] = null;
        }
      });
      if (_dots[side]) {
        if (_dots[side].parent) _dots[side].parent.remove(_dots[side]);
        _dots[side].geometry.dispose();
        _dots[side].material.dispose();
        _dots[side] = null;
      }
    });
    _active = false;
    _scene = null;
  }

  function setVisible(v) {
    ['left', 'right'].forEach(function(side) {
      if (_greenLines[side]) _greenLines[side].visible = v;
      if (_redLines[side]) _redLines[side].visible = v;
      if (_dots[side]) _dots[side].visible = v;
    });
  }

  function update(ctx) {
    if (!_active) {
      if (ctx.scene && !_scene) activate(ctx.scene);
      else return;
    }
    if (!ctx.scene) return;

    var aimData = null;
    if (window.PlayerControllerManager && window.PlayerControllerManager.isActive()) {
      var ctrl = window.PlayerControllerManager.getActive();
      if (ctrl && typeof ctrl.getWeaponAimData === 'function') {
        aimData = ctrl.getWeaponAimData();
      }
    }

    if (!aimData || !aimData.left || !aimData.right) {
      setVisible(false);
      return;
    }

    var overheated = aimData.isOverheated;
    var cooling = (!overheated && aimData.heat > 0);
    // 颜色: 过热→红, 冷却→橙, 正常→绿近/红远
    var greenColor = overheated ? COLOR_RED : (cooling ? COLOR_ORANGE : COLOR_GREEN);
    var redColor = overheated ? COLOR_RED : (cooling ? COLOR_ORANGE : COLOR_RED);

    ['left', 'right'].forEach(function(side) {
      var muzzle = aimData[side];
      if (!muzzle || !muzzle.pos || !muzzle.dir) return;

      var cast = _castRay(muzzle.pos, muzzle.dir, ctx);
      var hasHit = !!cast.hitPoint;
      // 实际终点距离: 命中则取命中距离, 否则取 MAX_LEN (射向虚空自然终止)
      var endDist = hasHit ? Math.min(cast.hitDist, MAX_LEN) : MAX_LEN;

      // ── 绿线: 枪口 → min(endDist, 射程) ──
      var greenEndDist = Math.min(endDist, GATLING_RANGE);
      var greenEnd = muzzle.pos.clone().addScaledVector(muzzle.dir, greenEndDist);
      var gLine = _greenLines[side];
      if (gLine) {
        _updateLineGeo(gLine, muzzle.pos, greenEnd);
        gLine.material.color.set(greenColor);
        gLine.visible = true;
      }

      // ── 红线: 射程 → 终点 (仅当终点超出射程时显示) ──
      var rLine = _redLines[side];
      if (rLine) {
        if (endDist > GATLING_RANGE + 0.01) {
          var redStart = muzzle.pos.clone().addScaledVector(muzzle.dir, GATLING_RANGE);
          var redEnd = muzzle.pos.clone().addScaledVector(muzzle.dir, endDist);
          _updateLineGeo(rLine, redStart, redEnd);
          rLine.material.color.set(redColor);
          rLine.visible = true;
        } else {
          rLine.visible = false;
        }
      }

      // ── 球: 仅命中物体时显示 ──
      var dot = _dots[side];
      if (dot) {
        if (hasHit) {
          dot.position.copy(cast.hitPoint);
          dot.visible = true;
          dot.material.color.set(cast.hitDist <= GATLING_RANGE ? greenColor : redColor);
        } else {
          dot.visible = false;
        }
      }
    });
  }

  return {
    activate: activate,
    deactivate: deactivate,
    setVisible: setVisible,
    update: update
  };
})();
window.HexapodAimLine = HexapodAimLine;
