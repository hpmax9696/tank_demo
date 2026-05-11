/**
 * 战斗积分系统 — PvE 战斗模式
 * v0.26.0 架构搭建
 *
 * 功能：
 * 1. 地图绑定最高分（含产生时间、结算时间）
 * 2. 多次游玩累计总分（后期用于兑换道具）
 * 3. localStorage 持久化（demo 关闭后保留）
 * 4. 清空积分/记录按钮
 */
(function() {

    const STORAGE_KEY_MAP  = 'tank_demo_map_scores';   // 各地图最高分
    const STORAGE_KEY_TOTAL = 'tank_demo_total_score'; // 累计总分

    // ─── 数据结构 ───
    // mapScores: { "test_map_03a": { highScore:12500, createdAt:"ISO", settledAt:"ISO" }, ... }
    // totalScore: number

    // ─── 读取 ───
    function loadMapScores() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY_MAP);
            return raw ? JSON.parse(raw) : {};
        } catch (e) {
            console.warn('ScoreSystem: 地图积分数据损坏，已重置');
            return {};
        }
    }

    function loadTotalScore() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY_TOTAL);
            return raw ? parseInt(raw, 10) : 0;
        } catch (e) {
            return 0;
        }
    }

    // ─── 保存 ───
    function saveMapScores(data) {
        try {
            localStorage.setItem(STORAGE_KEY_MAP, JSON.stringify(data));
        } catch (e) {
            console.warn('ScoreSystem: 无法保存地图积分（localStorage 可能已满）');
        }
    }

    function saveTotalScore(val) {
        try {
            localStorage.setItem(STORAGE_KEY_TOTAL, val.toString());
        } catch (e) {
            console.warn('ScoreSystem: 无法保存累计总分');
        }
    }

    // ─── 获取地图最高分 ───
    function getMapHighScore(mapId) {
        const scores = loadMapScores();
        return scores[mapId] || null;
    }

    // ─── 结算（战斗结束时调用） ───
    // 返回 { isNewHigh: bool, highScore: number }
    function settleScore(mapId, score) {
        const now = new Date().toISOString();
        const scores = loadMapScores();
        const old = scores[mapId];
        let isNewHigh = false;

        if (!old || score > old.highScore) {
            scores[mapId] = {
                highScore: score,
                createdAt: old ? old.createdAt : now,   // 首次产生时间不变
                settledAt: now                           // 本次结算时间
            };
            isNewHigh = true;
        }
        saveMapScores(scores);

        // 累加到总分
        const total = loadTotalScore();
        saveTotalScore(total + score);

        return {
            isNewHigh,
            highScore: scores[mapId].highScore,
            totalScore: total + score
        };
    }

    // ─── 获取累计总分 ───
    function getTotalScore() {
        return loadTotalScore();
    }

    // ─── 清空所有积分记录 ───
    function clearAllScores() {
        localStorage.removeItem(STORAGE_KEY_MAP);
        localStorage.removeItem(STORAGE_KEY_TOTAL);
    }

    // ─── 清空指定地图的积分记录 ───
    function clearMapScore(mapId) {
        const scores = loadMapScores();
        delete scores[mapId];
        saveMapScores(scores);
    }

    // ─── 清空累计总分 ───
    function clearTotalScore() {
        localStorage.removeItem(STORAGE_KEY_TOTAL);
    }

    // ─── 暴露到全局 ───
    window.ScoreSystem = {
        getMapHighScore,
        settleScore,
        getTotalScore,
        clearAllScores,
        clearMapScore,
        clearTotalScore,
    };

    console.log('📊 积分系统已就绪 | 地图高分 + 累计总分 | localStorage 持久化');

})();
