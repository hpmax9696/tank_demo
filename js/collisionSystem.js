// 碰撞体系统 — v0.66.0
// 为每个单位创建简化碰撞体（Box/Cylinder），
// 碰撞体是模型旋转节点的子节点 → 自动跟踪炮塔旋转/炮管俯仰
// 炮弹用 Raycaster 对碰撞体做射线检测，替代圆柱近似
// F2 切换：显示渲染模型 / 显示碰撞体
(function () {
  'use strict';

  var SHELL_R = 0.08; // 炮弹半径，碰撞体各方向膨胀此值

  // 所有碰撞 mesh 列表（供 Raycaster 批量检测）
  var _meshes = [];
  // unit → { mesh, parent, visibleMat }[] 映射
  var _unitEntries = new WeakMap();
  // 所有注册单位列表
  var _units = [];

  // 碰撞体颜色映射（可视化用）
  var TAG_COLORS = {
    hull: 0xff4444,
    trackL: 0x44ff44,
    trackR: 0x44ff44,
    turret: 0x4488ff,
    barrel: 0xffff44,
    body: 0xff8844,
  };

  // ── 创建单个碰撞 mesh ──
  function _createMesh(shapeDef, nodeMap) {
    var parent = nodeMap[shapeDef.parent];
    if (!parent) {
      if (typeof console !== 'undefined')
        console.warn('CollisionSystem: parent node not found:', shapeDef.parent);
      return null;
    }
    var size = shapeDef.size;
    var pos = shapeDef.pos || [0, 0, 0];
    var geo;
    if (shapeDef.type === 'box') {
      geo = new THREE.BoxGeometry(
        size[0] + SHELL_R * 2,
        size[1] + SHELL_R * 2,
        size[2] + SHELL_R * 2
      );
    } else if (shapeDef.type === 'cylinder') {
      geo = new THREE.CylinderGeometry(
        size[0] + SHELL_R,
        (size[2] !== undefined ? size[2] : size[0]) + SHELL_R,
        size[1] + SHELL_R * 2,
        8
      );
    } else {
      return null;
    }
    var visColor = TAG_COLORS[shapeDef.tag] || 0xffffff;
    var visibleMat = new THREE.MeshBasicMaterial({
      color: visColor,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    });
    var mesh = new THREE.Mesh(geo, visibleMat);
    mesh.name = '_col_' + (shapeDef.tag || 's');
    mesh.position.set(pos[0], pos[1], pos[2]);
    if (shapeDef.rot) mesh.rotation.set(shapeDef.rot[0], shapeDef.rot[1], shapeDef.rot[2]);
    mesh.layers.set(1);
    mesh.visible = true;
    mesh.raycast = THREE.Mesh.prototype.raycast;
    parent.add(mesh);
    return mesh;
  }

  var _showCollision = false;

  // ── 切换渲染模型可见性（只操作 mesh，不动 group，否则碰撞体父链被切断） ──
  function _setRenderVisible(root, vis) {
    root.traverse(function (c) {
      if (!c.isMesh) return;
      if (c.name && c.name.indexOf('_col_') === 0) return;
      // 不使用材质透明度（会永久污染共享材质），改用 visible 直接隐藏
      // Group 保持可见 → 碰撞体子节点不受影响
      c.visible = vis;
    });
  }

  // ── 公共 API ──
  window.CollisionSystem = {
    /** 从渲染模型减面生成碰撞体（精确匹配轮廓）
     *  @param unit    — 单位对象
     *  @param nodeMap — { group, turretPivot, ... }
     *  @param parts   — [{ parent: 'group', targetTris: 80, color: 0xff4444 }, ...]
     */
    buildFromModel: function (unit, nodeMap, parts) {
      if (!window.SimplifyModifier || !THREE.BufferGeometryUtils) {
        if (unit.spec && unit.spec.collision) {
          this.attach(unit, nodeMap, unit.spec.collision.shapes);
        }
        return;
      }
      this.detach(unit);
      var modifier = new SimplifyModifier();
      var entries = [];

      // 辅助：把一组 mesh 合并+简化+膨胀 → 碰撞 mesh
      var _tmpMat = new THREE.Matrix4();
      var _tmpMat2 = new THREE.Matrix4();
      function _mergeAndSimplify(meshes, parent, part, modifier) {
        if (meshes.length === 0) return null;
        // parent → world 的逆矩阵，用于把世界空间顶点转到 parent 局部空间
        parent.updateMatrixWorld();
        var toParentLocal = new THREE.Matrix4().copy(parent.matrixWorld).invert();
        var geos = [];
        for (var mi = 0; mi < meshes.length; mi++) {
          var c = meshes[mi];
          if (!c.geometry || !c.geometry.attributes || !c.geometry.attributes.position) continue;
          var cloned = c.geometry.clone();
          // mesh 局部 → world → parent 局部
          _tmpMat.multiplyMatrices(toParentLocal, c.matrixWorld);
          cloned.applyMatrix4(_tmpMat);
          geos.push(cloned);
        }
        if (geos.length === 0) return null;

        var merged;
        try {
          merged = THREE.BufferGeometryUtils.mergeBufferGeometries(geos, false);
        } catch (e) {
          geos.forEach(function (g) {
            if (g.dispose) g.dispose();
          });
          return null;
        }
        geos.forEach(function (g) {
          if (g !== merged && g.dispose) g.dispose();
        });
        if (!merged || !merged.attributes.position) return null;

        // 简化为碰撞精度
        var currentVerts = merged.attributes.position.count;
        var removeCount = Math.min(Math.floor(currentVerts * 0.75), 5000);
        if (removeCount > 0) {
          try {
            merged = modifier.modify(merged, removeCount);
          } catch (e) {}
        }
        var countAfter = merged.attributes.position.count / 3;

        // 沿法线膨胀 shellR
        if (SHELL_R > 0 && merged.attributes.position) {
          merged.computeVertexNormals();
          var posArr = merged.attributes.position.array;
          var nrmArr = merged.attributes.normal ? merged.attributes.normal.array : null;
          if (nrmArr) {
            for (var vi = 0; vi < posArr.length; vi += 3) {
              posArr[vi] += nrmArr[vi] * SHELL_R;
              posArr[vi + 1] += nrmArr[vi + 1] * SHELL_R;
              posArr[vi + 2] += nrmArr[vi + 2] * SHELL_R;
            }
            merged.attributes.position.needsUpdate = true;
          }
        }

        var visColor = part.color || 0xffffff;
        var visibleMat = new THREE.MeshBasicMaterial({
          color: visColor,
          transparent: true,
          opacity: 0.45,
          depthWrite: false,
        });
        var mesh = new THREE.Mesh(merged, visibleMat);
        mesh.name = '_col_model_' + (part.tag || part.parent);
        mesh.position.set(0, 0, 0);
        mesh.layers.set(1);
        mesh.visible = true;
        mesh.raycast = THREE.Mesh.prototype.raycast;
        mesh.userData._colUnit = unit;
        mesh.userData._colTris = countAfter;
        parent.add(mesh);
        return mesh;
      }

      function _subPart(part, parent, meshes, suffix, color) {
        var p2 = Object.assign({}, part);
        p2.tag = (part.tag || part.parent) + suffix;
        if (color) p2.color = color;
        var m = _mergeAndSimplify(meshes, parent, p2, modifier);
        if (m) entries.push({ mesh: m, parent: parent });
      }

      for (var p = 0; p < parts.length; p++) {
        var part = parts[p];
        var parent = nodeMap[part.parent];
        if (!parent) continue;

        // 找排除节点 / 排除关键词
        var excludeRoot = null;
        if (part.excludeNode) {
          excludeRoot = nodeMap[part.excludeNode] || parent.getObjectByName(part.excludeNode);
        }
        var nameExclude = part.nameExclude || [];
        var maxY = part.maxY; // 可选：排除世界 Y 超过此值的 mesh

        // 收集该节点子树中的 mesh
        var allMeshes = [];
        parent.traverse(function (c) {
          if (!c.isMesh) return;
          if (!c.geometry || !c.geometry.attributes || !c.geometry.attributes.position) return;
          if (c.name && c.name.indexOf('_col_') === 0) return;
          // 排除节点
          if (excludeRoot) {
            var p2 = c;
            while (p2) {
              if (p2 === excludeRoot) return;
              p2 = p2.parent;
            }
          }
          // 排除关键词（武器/传感器等外伸件）
          if (nameExclude.length > 0) {
            for (var nx = 0; nx < nameExclude.length; nx++) {
              if (c.name && c.name.indexOf(nameExclude[nx]) >= 0) return;
            }
          }
          // 排除过高 mesh（Y 阈值）
          if (maxY !== undefined) {
            var wy = new THREE.Vector3();
            c.getWorldPosition(wy);
            if (wy.y > maxY) return;
          }
          allMeshes.push(c);
        });

        if (allMeshes.length === 0) continue;

        // 是否需要按 X 坐标分离车体/履带
        var splitX = part.splitX;
        if (splitX && splitX > 0) {
          var hullMeshes = [],
            leftTrackMeshes = [],
            rightTrackMeshes = [];
          for (var mi = 0; mi < allMeshes.length; mi++) {
            var m = allMeshes[mi];
            // 用 mesh 的局部位置估算质心 X
            var cx = m.position ? m.position.x : 0;
            if (cx < -splitX) leftTrackMeshes.push(m);
            else if (cx > splitX) rightTrackMeshes.push(m);
            else hullMeshes.push(m);
          }
          _subPart(part, parent, hullMeshes, '_hull', 0xff4444);
          _subPart(part, parent, leftTrackMeshes, '_trackL', 0x44ff44);
          _subPart(part, parent, rightTrackMeshes, '_trackR', 0x44ff44);
        } else {
          _subPart(part, parent, allMeshes, '', 0);
        }
      }

      // 注册
      _unitEntries.set(unit, entries);
      for (var e = 0; e < entries.length; e++) {
        _meshes.push(entries[e].mesh);
      }
      var root = nodeMap.group || unit;
      unit._colRoot = root.isGroup ? root : root.group || root;
      if (_units.indexOf(unit) < 0) _units.push(unit);
      if (_showCollision) this._applyShow();

      var totalTris = 0;
      for (var e = 0; e < entries.length; e++) {
        totalTris += entries[e].mesh.userData._colTris || 0;
      }
      if (typeof console !== 'undefined') {
        console.log('🔍 碰撞体: ' + entries.length + ' 件, ' + Math.round(totalTris) + ' tris');
      }
    },
    /** 为单位附加碰撞体 */
    attach: function (unit, nodeMap, shapes) {
      if (!shapes || !shapes.length || !nodeMap) return;
      this.detach(unit);
      var entries = [];
      for (var i = 0; i < shapes.length; i++) {
        var m = _createMesh(shapes[i], nodeMap);
        if (m) {
          m.userData._colUnit = unit;
          entries.push({ mesh: m, parent: nodeMap[shapes[i].parent] });
          _meshes.push(m);
        }
      }
      _unitEntries.set(unit, entries);
      // 记录 unit 的渲染根节点
      var root = nodeMap.group || unit;
      unit._colRoot = root.isGroup ? root : root.group || root;
      if (_units.indexOf(unit) < 0) _units.push(unit);
      // 如果当前在碰撞体显示模式，立即应用
      if (_showCollision) this._applyShow();
    },

    /** 移除单位的碰撞体 */
    detach: function (unit) {
      var entries = _unitEntries.get(unit);
      if (!entries) return;
      for (var i = 0; i < entries.length; i++) {
        var e = entries[i];
        if (e.mesh.parent) e.mesh.parent.remove(e.mesh);
        if (e.mesh.geometry) e.mesh.geometry.dispose();
        if (e.mesh.userData._colVisMat) e.mesh.userData._colVisMat.dispose();
        var idx = _meshes.indexOf(e.mesh);
        if (idx >= 0) _meshes.splice(idx, 1);
      }
      _unitEntries.delete(unit);
      var uidx = _units.indexOf(unit);
      if (uidx >= 0) _units.splice(uidx, 1);
    },

    /** F2 切换：显示渲染模型 / 显示碰撞体 */
    toggle: function () {
      _showCollision = !_showCollision;
      this._applyShow();
      return _showCollision;
    },

    /** 应用当前显示状态 */
    _applyShow: function () {
      // 渲染模型：F2 ON→隐藏，OFF→显示
      for (var i = 0; i < _units.length; i++) {
        var u = _units[i];
        var root = u._colRoot || u.group || u;
        if (!root) continue;
        _setRenderVisible(root, !_showCollision);
      }
      // 碰撞体：camera layer 1 开关
      if (typeof camera !== 'undefined' && camera) {
        if (_showCollision) camera.layers.enable(1);
        else camera.layers.disable(1);
      }
    },

    get showCollision() {
      return _showCollision;
    },

    /** 射线检测 — 从 prevPos 到 currPos 的炮弹路径 */
    raycastShell: function (prevPos, currPos, ignoreUnit) {
      if (_meshes.length === 0) return null;
      var dir = new THREE.Vector3().subVectors(currPos, prevPos);
      var dist = dir.length();
      if (dist < 0.001) return null;
      dir.normalize();

      var raycaster = new THREE.Raycaster(prevPos, dir, 0, dist);

      var targets = ignoreUnit
        ? _meshes.filter(function (m) {
            return m.userData._colUnit !== ignoreUnit;
          })
        : _meshes;
      if (targets.length === 0) return null;

      var hits = raycaster.intersectObjects(targets, false);
      if (hits.length > 0) {
        var hit = hits[0];
        return {
          unit: hit.object.userData._colUnit,
          point: hit.point.clone(),
          distance: hit.distance,
        };
      }
      return null;
    },

    /** 点检测 — 某世界坐标是否在任何碰撞体内 */
    pointInAny: function (worldPos, ignoreUnit) {
      for (var i = 0; i < _meshes.length; i++) {
        var m = _meshes[i];
        if (ignoreUnit && m.userData._colUnit === ignoreUnit) continue;
        var box = new THREE.Box3().setFromObject(m);
        if (box.containsPoint(worldPos)) return m.userData._colUnit;
      }
      return null;
    },

    get meshes() {
      return _meshes;
    },
    get count() {
      return _meshes.length;
    },

    /** 清空全部 */
    clear: function () {
      for (var i = _meshes.length - 1; i >= 0; i--) {
        var m = _meshes[i];
        if (m.parent) m.parent.remove(m);
        if (m.geometry) m.geometry.dispose();
        if (m.userData._colVisMat) m.userData._colVisMat.dispose();
      }
      _meshes.length = 0;
      _units.length = 0;
      _showCollision = false;
    },

    SHELL_R: SHELL_R,
  };
})();
