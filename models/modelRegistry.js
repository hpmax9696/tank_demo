/**
 * 模型注册表 — 统一管理所有3D模型
 * 每个模型注册一个 create() 函数，接收参数对象
 */
(function() {
    const registry = {
        // 坦克
        tanks: {},
        // 树木
        trees: {},
        // 建筑
        buildings: {},
        // 特殊物件
        special: {},
        // 障碍物生成器（含权重）
        obstacleMakers: [],
        obstacleWeights: []
    };

    function register(category, name, createFn, weight) {
        if (!registry[category]) registry[category] = {};
        registry[category][name] = createFn;
        // 如果提供了 weight，加入障碍物生成列表
        if (weight !== undefined && weight > 0) {
            registry.obstacleMakers.push({ category, name, createFn });
            registry.obstacleWeights.push(weight);
        }
    }

    // 获取模型创建函数
    function getModel(category, name) {
        return registry[category] && registry[category][name] || null;
    }

    // 获取所有模型列表（供预览下拉菜单使用）
    function getAllModels() {
        const list = [];
        const catNames = {
            tanks: '坦克',
            trees: '树木',
            buildings: '建筑',
            special: '特殊物件'
        };
        for (const [cat, catLabel] of Object.entries(catNames)) {
            for (const [name, fn] of Object.entries(registry[cat] || {})) {
                list.push({ category: cat, categoryLabel: catLabel, name, fn });
            }
        }
        return list;
    }

    // 按权重随机选择一个障碍物生成器
    function randomObstacleMaker() {
        const totalW = registry.obstacleWeights.reduce((a, b) => a + b, 0);
        let r = Math.random() * totalW;
        for (let i = 0; i < registry.obstacleMakers.length; i++) {
            r -= registry.obstacleWeights[i];
            if (r <= 0) return registry.obstacleMakers[i].createFn;
        }
        return registry.obstacleMakers[0].createFn;
    }

    // 暴露到全局
    window.ModelRegistry = { register, getModel, getAllModels, randomObstacleMaker };
})();
