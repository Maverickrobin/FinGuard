/* ══════════════════════════════════════════════════════════════════
   FinGuard Scenarios View — Deterministic What-If Simulator
   Uses the identical forecast model with parameterized overrides.
   ══════════════════════════════════════════════════════════════════ */

let activeScenario = null;

const SCENARIO_ICONS = {
    cut_dining: 'receipt',
    cut_shopping: 'tag',
    rent_increase: 'alertTriangle',
    salary_hike: 'trendingUp',
    austerity: 'shieldCheck',
    increase_sip: 'sliders',
};

async function renderScenarios(container) {
    try {
        const templates = await apiGet('/api/scenario/templates');
        
        let html = `
            <div class="section-header">
                <div>
                    <h2 class="section-title">Deterministic Scenario Simulator</h2>
                    <div class="card-subtitle">
                        Simulate discretionary adjustments, recurring contractual changes, or macroeconomic shocks on identical baseline parameters.
                    </div>
                </div>
            </div>

            <!-- Pre-Built Scenario Templates Grid -->
            <div class="scenario-grid">
                ${templates.templates.map(t => {
                    const iconName = SCENARIO_ICONS[t.id] || 'sliders';
                    const isActive = activeScenario === t.id;
                    return `
                        <div class="scenario-card ${isActive ? 'active' : ''}" 
                             onclick="runScenarioTemplate('${t.id}')">
                            <div class="scenario-icon-box">
                                ${icon(iconName, 18)}
                            </div>
                            <div class="scenario-name">${t.name}</div>
                            <div class="scenario-desc">${t.description}</div>
                        </div>
                    `;
                }).join('')}
            </div>

            <!-- Custom Parameter Simulator -->
            <div class="card mb-3">
                <div class="card-header">
                    <div>
                        <div class="card-title">Custom Parameter Override Matrix</div>
                        <div class="card-subtitle">Define fractional percentage offsets (e.g. -0.30 for -30%) or fixed currency deltas.</div>
                    </div>
                </div>
                <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px;margin-bottom:14px">
                    <div class="form-group" style="margin-bottom:0">
                        <label class="form-label" for="custom-dining">Dining Offset (Fraction)</label>
                        <input class="form-input" type="number" id="custom-dining" placeholder="-0.30 (-30%)" step="0.05">
                    </div>
                    <div class="form-group" style="margin-bottom:0">
                        <label class="form-label" for="custom-shopping">Shopping Offset (Fraction)</label>
                        <input class="form-input" type="number" id="custom-shopping" placeholder="-0.50 (-50%)" step="0.05">
                    </div>
                    <div class="form-group" style="margin-bottom:0">
                        <label class="form-label" for="custom-rent">Rent Delta (₹ / month)</label>
                        <input class="form-input" type="number" id="custom-rent" placeholder="+3000" step="500">
                    </div>
                    <div class="form-group" style="margin-bottom:0">
                        <label class="form-label" for="custom-entertainment">Entertainment Offset</label>
                        <input class="form-input" type="number" id="custom-entertainment" placeholder="-0.40 (-40%)" step="0.05">
                    </div>
                </div>
                <div class="flex items-center gap-1">
                    <button class="btn btn-primary btn-sm" onclick="runCustomScenario()">
                        ${icon('play', 13)}
                        Run Custom Simulation
                    </button>
                </div>
            </div>

            <!-- Simulation Results Output Container -->
            <div id="scenario-results">
                ${activeScenario ? '' : `
                    <div class="card">
                        <div class="empty-state" style="padding:32px 20px">
                            <div class="empty-state-icon">${icon('sliders', 36)}</div>
                            <div class="empty-state-text">Select a Scenario Above to Run Simulation</div>
                            <div class="empty-state-hint">Simulate the impact of discretionary cuts, rent hikes, or SIP adjustments on Priya's 90-day trajectory.</div>
                        </div>
                    </div>
                `}
            </div>
        `;

        container.innerHTML = html;

        // Auto-run first scenario template if none active
        if (!activeScenario && templates.templates.length > 0) {
            runScenarioTemplate('cut_dining');
        }

    } catch (e) {
        showEmpty(container, 'alertTriangle', 'Failed to load scenario simulator', e.message);
    }
}

async function runScenarioTemplate(templateId) {
    activeScenario = templateId;
    const resultsDiv = document.getElementById('scenario-results');
    if (!resultsDiv) return;
    
    resultsDiv.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
    
    try {
        const data = await apiPost(`/api/scenario/template/${templateId}?days=90`);
        renderScenarioResults(resultsDiv, data);
        
        // Update active card indicator
        document.querySelectorAll('.scenario-card').forEach(card => {
            card.classList.toggle('active', card.getAttribute('onclick')?.includes(templateId));
        });
    } catch (e) {
        resultsDiv.innerHTML = `<div class="card"><div class="empty-state"><div class="empty-state-text">Simulation failed: ${e.message}</div></div></div>`;
    }
}

async function runCustomScenario() {
    const overrides = {};
    
    const dining = parseFloat(document.getElementById('custom-dining')?.value);
    const shopping = parseFloat(document.getElementById('custom-shopping')?.value);
    const rent = parseFloat(document.getElementById('custom-rent')?.value);
    const entertainment = parseFloat(document.getElementById('custom-entertainment')?.value);
    
    if (!isNaN(dining)) overrides.Dining = dining;
    if (!isNaN(shopping)) overrides.Shopping = shopping;
    if (!isNaN(rent)) overrides.Rent = rent;
    if (!isNaN(entertainment)) overrides.Entertainment = entertainment;
    
    if (Object.keys(overrides).length === 0) {
        showToast('Specify at least one override parameter to simulate.', 'warning');
        return;
    }

    activeScenario = 'custom';
    const resultsDiv = document.getElementById('scenario-results');
    if (!resultsDiv) return;

    resultsDiv.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

    try {
        const data = await apiPost('/api/scenario?days=90', {
            name: 'Custom Parameter Simulation',
            overrides: overrides,
        });
        renderScenarioResults(resultsDiv, data);
    } catch (e) {
        resultsDiv.innerHTML = `<div class="card"><div class="empty-state"><div class="empty-state-text">Simulation failed: ${e.message}</div></div></div>`;
    }
}

function renderScenarioResults(container, data) {
    const baseline = data.baseline || {};
    const scenario = data.scenario || {};
    const comparison = data.comparison || {};

    const balDiff = comparison.final_balance_diff || 0;
    const isPositive = balDiff >= 0;

    let html = `
        <div class="card mb-3">
            <div class="card-header">
                <div>
                    <div class="card-title">Comparative Impact Analysis: ${data.scenario_name || 'Active Simulation'}</div>
                    <div class="card-subtitle">90-Day Delta vs Verified Baseline Run-Rate</div>
                </div>
                <span class="badge ${isPositive ? 'badge-success' : 'badge-high'}">
                    ${isPositive ? '+' : ''}${formatCurrency(balDiff)} Net Delta
                </span>
            </div>

            <!-- Comparison Metric Rows -->
            <div style="margin-bottom:20px">
                <div class="comparison-row">
                    <span class="comparison-label">90-Day Ending Liquid Position</span>
                    <div class="comparison-values">
                        <span class="comparison-baseline">${formatCurrency(baseline.final_balance)}</span>
                        <span class="comparison-scenario">${formatCurrency(scenario.final_balance)}</span>
                        <span class="comparison-diff ${isPositive ? 'positive' : 'negative'}">
                            ${isPositive ? '↑' : '↓'} ${formatCurrency(Math.abs(balDiff))}
                        </span>
                    </div>
                </div>

                <div class="comparison-row">
                    <span class="comparison-label">Estimated Daily Discretionary Cap</span>
                    <div class="comparison-values">
                        <span class="comparison-baseline">${formatCurrency(baseline.daily_discretionary_estimate)}/day</span>
                        <span class="comparison-scenario">${formatCurrency(scenario.daily_discretionary_estimate)}/day</span>
                        <span class="comparison-diff ${scenario.daily_discretionary_estimate >= baseline.daily_discretionary_estimate ? 'positive' : 'negative'}">
                            ${formatCurrency(scenario.daily_discretionary_estimate - baseline.daily_discretionary_estimate)}/day
                        </span>
                    </div>
                </div>

                <div class="comparison-row">
                    <span class="comparison-label">Solvency Risk / Zero-Crossing Event</span>
                    <div class="comparison-values">
                        <span style="font-size:13px;color:${scenario.zero_crossing_date ? 'var(--rose-light)' : 'var(--emerald-light)'};font-weight:600">
                            ${scenario.zero_crossing_date ? 'Risk on ' + formatDate(scenario.zero_crossing_date) : 'No shortfall projected'}
                        </span>
                    </div>
                </div>
            </div>

            <!-- Trajectory Comparison Chart -->
            <div class="chart-container" style="height:280px">
                <canvas id="chart-scenario-compare"></canvas>
            </div>
        </div>
    `;

    container.innerHTML = html;

    // Render comparison chart
    renderComparisonChart(baseline.daily || [], scenario.daily || []);
}

function renderComparisonChart(baseDaily, scenDaily) {
    if (!baseDaily.length || !scenDaily.length) return;

    const sampledBase = baseDaily.filter((_, i) => i % 2 === 0 || i === baseDaily.length - 1);
    const sampledScen = scenDaily.filter((_, i) => i % 2 === 0 || i === scenDaily.length - 1);

    const labels = sampledBase.map(d => {
        const parts = d.date.split('-');
        return `${parts[2]}/${parts[1]}`;
    });

    getOrCreateChart('chart-scenario-compare', {
        type: 'line',
        data: {
            labels,
            datasets: [
                {
                    label: 'Simulated Scenario',
                    data: sampledScen.map(d => d.balance),
                    borderColor: '#10B981',
                    backgroundColor: 'rgba(16, 185, 129, 0.08)',
                    borderWidth: 2,
                    fill: false,
                    tension: 0.3,
                    pointRadius: 0,
                },
                {
                    label: 'Verified Baseline',
                    data: sampledBase.map(d => d.balance),
                    borderColor: '#64748B',
                    borderWidth: 1.5,
                    borderDash: [5, 5],
                    fill: false,
                    tension: 0.3,
                    pointRadius: 0,
                },
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { position: 'top', labels: { boxWidth: 10, padding: 12 } },
                tooltip: {
                    callbacks: {
                        label: ctx => ` ${ctx.dataset.label}: ${formatCurrency(ctx.raw)}`,
                    },
                },
            },
            scales: {
                y: {
                    ticks: { callback: v => formatCurrency(v), maxTicksLimit: 5 },
                    grid: { color: CHART_COLORS.grid },
                },
                x: { grid: { display: false }, ticks: { maxTicksLimit: 12 } },
            },
        },
    });
}

// Exports
window.renderScenarios = renderScenarios;
window.runScenarioTemplate = runScenarioTemplate;
window.runCustomScenario = runCustomScenario;
