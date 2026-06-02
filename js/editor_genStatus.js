// ========== 生成状态面板 ==========
// 用于管线 A/B 的实时进度展示和最终摘要

function createGenStatusPanel(parentEl) {
    // --- DOM 构建 ---
    const panel = document.createElement('div');
    panel.className = 'gen-status-panel';
    panel.style.display = 'none';
    Object.assign(panel.style, {
        position: 'absolute', bottom: '50px', right: '12px',
        background: 'rgba(10,10,25,0.88)', border: '1px solid #4a4a65',
        borderRadius: '8px', padding: '10px 14px', minWidth: '220px',
        fontSize: '11px', color: '#ccc', zIndex: '20',
        backdropFilter: 'blur(4px)', fontFamily: 'monospace',
        maxWidth: '300px'
    });

    panel.innerHTML = `
        <div class="gs-header" style="display:flex;justify-content:space-between;margin-bottom:4px;">
            <span class="gs-phase-label" style="font-weight:bold;color:#f5954a;">初始化...</span>
            <span class="gs-phase-count" style="color:#888;">阶段 0/0</span>
        </div>
        <div class="gs-progress-bar" style="height:4px;background:#333;border-radius:2px;margin-bottom:6px;">
            <div class="gs-progress-fill" style="height:100%;background:#f5954a;border-radius:2px;width:0%;transition:width 0.3s;"></div>
        </div>
        <div class="gs-stats" style="display:grid;grid-template-columns:1fr 1fr;gap:2px 8px;margin-bottom:4px;font-size:10px;">
            <div class="gs-stat-row"><span style="color:#888;">区域</span> <span class="gs-stat-regions" style="float:right;">-</span></div>
            <div class="gs-stat-row"><span style="color:#888;">村落</span> <span class="gs-stat-villages" style="float:right;">-</span></div>
            <div class="gs-stat-row"><span style="color:#888;">建筑</span> <span class="gs-stat-buildings" style="float:right;">-</span></div>
            <div class="gs-stat-row"><span style="color:#888;">树木</span> <span class="gs-stat-trees" style="float:right;">-</span></div>
        </div>
        <div class="gs-details" style="margin-top:4px;font-size:10px;color:#888;max-height:80px;overflow-y:auto;line-height:1.4;"></div>
    `;

    parentEl.appendChild(panel);

    // --- 元素引用 ---
    const phaseLabel = panel.querySelector('.gs-phase-label');
    const phaseCount = panel.querySelector('.gs-phase-count');
    const progressFill = panel.querySelector('.gs-progress-fill');
    const statRegions = panel.querySelector('.gs-stat-regions');
    const statVillages = panel.querySelector('.gs-stat-villages');
    const statBuildings = panel.querySelector('.gs-stat-buildings');
    const statTrees = panel.querySelector('.gs-stat-trees');
    const detailsEl = panel.querySelector('.gs-details');
    const headerRow = panel.querySelector('.gs-header');

    // --- 自动隐藏计时器 ---
    let hideTimer = null;
    let summaryMode = false;

    function cancelHide() {
        if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
    }

    function startHideTimer(seconds) {
        cancelHide();
        if (summaryMode) {
            hideTimer = setTimeout(() => { panel.style.setProperty('display', 'none', 'important'); }, seconds * 1000);
        }
    }

    panel.addEventListener('mouseenter', cancelHide);
    panel.addEventListener('mouseleave', () => startHideTimer(30));
    panel.addEventListener('click', () => { panel.style.setProperty('display', 'none', 'important'); cancelHide(); });

    // --- 公开 API ---
    const api = {
        /** 获取面板 DOM */
        get el() { return panel; },
        /** 显示面板并初始化 */
        show(totalPhases) {
            panel.style.setProperty('display', 'block', 'important');
            summaryMode = false;
            cancelHide();
            phaseCount.textContent = `阶段 0/${totalPhases}`;
            phaseLabel.textContent = '准备中...';
            phaseLabel.style.color = '#f5954a';
            progressFill.style.width = '0%';
            statRegions.textContent = '-';
            statVillages.textContent = '-';
            statBuildings.textContent = '-';
            statTrees.textContent = '-';
            detailsEl.innerHTML = '';
            headerRow.style.borderBottom = '';
            // 恢复进度模式布局
            panel.querySelector('.gs-stats').style.display = 'grid';
            progressFill.parentElement.style.display = 'block';
        },

        /** 每阶段更新 */
        update(status) {
            if (panel.style.display === 'none') panel.style.setProperty('display', 'block', 'important');
            const { phase, totalPhases, label, progress, stats, details } = status;
            phaseCount.textContent = `阶段 ${phase}/${totalPhases}`;
            phaseLabel.textContent = label || '';
            progressFill.style.width = Math.round((progress || 0) * 100) + '%';

            if (stats) {
                if (stats.regions !== undefined) statRegions.textContent = stats.regions;
                if (stats.villages !== undefined) statVillages.textContent = stats.villages;
                if (stats.buildings !== undefined) statBuildings.textContent = stats.buildings;
                if (stats.trees !== undefined) statTrees.textContent = stats.trees;
            }

            if (details && details.length > 0) {
                detailsEl.innerHTML = details.slice(-8).map(d => {
                    const icon = d.type === 'fail' ? '✗' : d.type === 'warn' ? '⚠️' : '✓';
                    const color = d.type === 'fail' ? '#e05555' : d.type === 'warn' ? '#e0b055' : '#5a5';
                    return `<div style="color:${color};">${icon} ${d.text}</div>`;
                }).join('');
                detailsEl.scrollTop = detailsEl.scrollHeight;
            }
        },

        /** 最终摘要（替换进度模式） */
        showSummary(report) {
            summaryMode = true;
            cancelHide();
            panel.style.setProperty('display', 'block', 'important');

            // 切换为摘要模式
            phaseLabel.textContent = '✅ 生成完成';
            phaseLabel.style.color = '#5a5';
            phaseCount.textContent = `(${(report.durationMs / 1000).toFixed(1)}秒)`;
            progressFill.style.width = '100%';
            progressFill.style.background = '#5a5';

            // 隐藏进度条
            progressFill.parentElement.style.display = 'none';

            // 摘要统计
            const statsGrid = panel.querySelector('.gs-stats');
            statsGrid.style.gridTemplateColumns = '1fr 1fr';
            statsGrid.innerHTML = `
                <div class="gs-stat-row"><span style="color:#888;">主干道</span> <span style="float:right;">${report.roadsBuilt?.main || 0}m</span></div>
                <div class="gs-stat-row"><span style="color:#888;">村路</span> <span style="float:right;">${report.roadsBuilt?.branch || 0}m</span></div>
                <div class="gs-stat-row"><span style="color:#888;">建筑</span> <span style="float:right;">${report.buildingsPlaced || 0}</span></div>
                <div class="gs-stat-row"><span style="color:#888;">树木</span> <span style="float:right;">${report.treesPlaced || 0}</span></div>
                <div class="gs-stat-row"><span style="color:#888;">桥梁</span> <span style="float:right;">${report.bridgesBuilt || 0}</span></div>
                <div class="gs-stat-row"><span style="color:#888;">种子</span> <span style="float:right;">${report.seed || '?'}</span></div>
            `;

            // 质量评分
            const q = report.quality || {};
            const avgQ = ((q.flatness || 0) + (q.distribution || 0) + (q.road || 0)) / 3;
            const stars = avgQ >= 0.9 ? '⭐⭐⭐' : avgQ >= 0.7 ? '⭐⭐☆' : avgQ >= 0.5 ? '⭐☆☆' : '☆☆☆';

            // 失败摘要
            let failHtml = '';
            if (report.failures && report.failures.length > 0) {
                failHtml = report.failures.slice(0, 5).map(f =>
                    `<div style="color:#e05555;">⚠️ ${f.phase}: ${f.reason} (${f.detail || ''})</div>`
                ).join('');
            }

            const buildablePct = report.buildablePct !== undefined ? ` 可建${report.buildablePct}%` : '';

            detailsEl.innerHTML = `
                <div style="margin-bottom:4px;font-size:11px;color:#ddd;">
                    质量: ${stars} (平坦${(q.flatness||0).toFixed(2)} 分布${(q.distribution||0).toFixed(2)} 道路${(q.road||0).toFixed(2)})${buildablePct}
                </div>
                ${failHtml}
            `;

            startHideTimer(30);
        },

        /** 隐藏面板 */
        hide() {
            panel.style.setProperty('display', 'none', 'important');
            cancelHide();
        },

        /** 获取面板 DOM（调试用） */
        get el() { return panel; }
    };
    // 暴露到 window 供 CDP 调试
    window.__genStatusPanel = api;
    return api;
}
