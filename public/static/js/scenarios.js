/* ══════════════════════════════════════════════════════════════════
   FinGuard Scenarios View — Deterministic What-If Simulator
   Uses the identical forecast model with parameterized overrides.
   ══════════════════════════════════════════════════════════════════ */

let activeScenario = null;
let currentTemplates = [];

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
        const templatesData = await apiGet('/api/scenario/templates');
        currentTemplates = templatesData.templates || [];
        
        let html = `
            <div class="section-header">
                <div>
                    <h2 class="section-title">Deterministic Scenario Simulator</h2>
                    <div class="card-subtitle">
                        Simulate discretionary cuts, contractual changes, or income hikes using the exact same cashflow engine.
                    </div>
                </div>
            </div>

            <!-- Pre-Built Scenario Templates Grid -->
            <div class="scenario-grid">
                ${currentTemplates.map(t => {
                    const iconName = SCENARIO_ICONS[t.id] || 'sliders';
                    const isActive = activeScenario === t.id;
                    return `
                        <div class="scenario-card ${isActive ? 'active' : ''}" 
                             id="preset-card-${t.id}"
                             onclick="selectAndRunPreset('${t.id}')">
                            <div class="scenario-icon-box">
                                ${icon(iconName, 18)}
                            </div>
                            <div class="scenario-name">${t.name}</div>
                            <div class="scenario-desc">${t.description}</div>
                        </div>
                    `;
                }).join('')}
            </div>

            <!-- Custom Parameter Matrix (Superset of all levers) -->
            <div class="card mb-3">
                <div class="card-header">
                    <div>
                        <div class="card-title">Custom Parameter Override Matrix</div>
                        <div class="card-subtitle">
                            Combine multiple levers below. Entering values will simulate their combined compound impact.
                        </div>
                    </div>
                    <div class="flex items-center gap-1">
                        <button class="btn btn-ghost btn-sm" onclick="resetCustomMatrix()">
                            ${icon('refresh', 12)} Reset Levers
                        </button>
                    </div>
                </div>

                <!-- Input Levers Grid -->
                <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:14px;margin-bottom:18px">
                    <!-- Income & Wealth Levers -->
                    <div class="form-group" style="margin-bottom:0">
                        <label class="form-label" for="custom-salary">
                            Salary Hike (Fraction or ₹)
                        </label>
                        <input class="form-input" type="number" id="custom-salary" placeholder="e.g. 0.10 (+10%) or 8500" step="0.05">
                        <div style="font-size:11px;color:var(--text-tertiary);margin-top:3px">e.g. 0.10 for +10%</div>
                    </div>

                    <div class="form-group" style="margin-bottom:0">
                        <label class="form-label" for="custom-investments">
                            SIP / Investment Delta (₹ / mo)
                        </label>
                        <input class="form-input" type="number" id="custom-investments" placeholder="e.g. +3000" step="500">
                        <div style="font-size:11px;color:var(--text-tertiary);margin-top:3px">+3000 increases SIP</div>
                    </div>

                    <div class="form-group" style="margin-bottom:0">
                        <label class="form-label" for="custom-rent">
                            Rent Delta (₹ / mo)
                        </label>
                        <input class="form-input" type="number" id="custom-rent" placeholder="e.g. +3000" step="500">
                        <div style="font-size:11px;color:var(--text-tertiary);margin-top:3px">+3000 increases rent</div>
                    </div>

                    <!-- Discretionary Spending Levers -->
                    <div class="form-group" style="margin-bottom:0">
                        <label class="form-label" for="custom-dining">
                            Dining Offset (Fraction)
                        </label>
                        <input class="form-input" type="number" id="custom-dining" placeholder="e.g. -0.30 (-30%)" step="0.05">
                        <div style="font-size:11px;color:var(--text-tertiary);margin-top:3px">-0.30 cuts dining by 30%</div>
                    </div>

                    <div class="form-group" style="margin-bottom:0">
                        <label class="form-label" for="custom-shopping">
                            Shopping Offset (Fraction)
                        </label>
                        <input class="form-input" type="number" id="custom-shopping" placeholder="e.g. -0.50 (-50%)" step="0.05">
                        <div style="font-size:11px;color:var(--text-tertiary);margin-top:3px">-0.50 cuts shopping by 50%</div>
                    </div>

                    <div class="form-group" style="margin-bottom:0">
                        <label class="form-label" for="custom-entertainment">
                            Entertainment Offset
                        </label>
                        <input class="form-input" type="number" id="custom-entertainment" placeholder="e.g. -0.40 (-40%)" step="0.05">
                        <div style="font-size:11px;color:var(--text-tertiary);margin-top:3px">-0.40 cuts entertainment</div>
                    </div>

                    <div class="form-group" style="margin-bottom:0">
                        <label class="form-label" for="custom-transport">
                            Transport Offset
                        </label>
                        <input class="form-input" type="number" id="custom-transport" placeholder="e.g. -0.20 (-20%)" step="0.05">
                        <div style="font-size:11px;color:var(--text-tertiary);margin-top:3px">-0.20 cuts transit/cabs</div>
                    </div>

                    <div class="form-group" style="margin-bottom:0">
                        <label class="form-label" for="custom-groceries">
                            Groceries Offset
                        </label>
                        <input class="form-input" type="number" id="custom-groceries" placeholder="e.g. -0.15 (-15%)" step="0.05">
                        <div style="font-size:11px;color:var(--text-tertiary);margin-top:3px">-0.15 cuts grocery spend</div>
                    </div>
                </div>

                <div class="flex items-center justify-between" style="border-top:1px solid var(--border-subtle);padding-top:14px">
                    <div style="font-size:12px;color:var(--text-tertiary)">
                        💡 Tip: Clicking any preset card above syncs its exact values into this matrix. You can add more levers and re-simulate!
                    </div>
                    <button class="btn btn-primary btn-sm" onclick="runCustomScenario()">
                        ${icon('play', 13)}
                        Run Multi-Lever Simulation
                    </button>
                </div>
            </div>

            <!-- Simulation Results Output Container -->
            <div id="scenario-results">
                <div class="card">
                    <div class="empty-state" style="padding:32px 20px">
                        <div class="empty-state-icon">${icon('sliders', 36)}</div>
                        <div class="empty-state-text">Loading Scenario Simulation...</div>
                    </div>
                </div>
            </div>
        `;

        container.innerHTML = html;

        // Auto-run first scenario template if none active
        if (currentTemplates.length > 0) {
            selectAndRunPreset(activeScenario || 'cut_dining');
        }

    } catch (e) {
        showEmpty(container, 'alertTriangle', 'Failed to load scenario simulator', e.message);
    }
}

/**
 * Select a preset, populate the matrix fields with its exact values,
 * and immediately trigger the simulation.
 */
async function selectAndRunPreset(templateId) {
    activeScenario = templateId;
    
    // Find template definition
    const template = currentTemplates.find(t => t.id === templateId);
    
    // Clear and populate custom matrix inputs
    clearMatrixInputs();
    
    if (template && template.overrides) {
        populateMatrixFromOverrides(template.overrides);
    }
    
    // Highlight active card
    document.querySelectorAll('.scenario-card').forEach(card => {
        const isThis = card.id === `preset-card-${templateId}`;
        card.classList.toggle('active', isThis);
    });

    // Run simulation
    const resultsDiv = document.getElementById('scenario-results');
    if (!resultsDiv) return;
    
    resultsDiv.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
    
    try {
        const data = await apiPost(`/api/scenario/template/${templateId}?days=90`);
        renderScenarioResults(resultsDiv, data);
    } catch (e) {
        resultsDiv.innerHTML = `<div class="card"><div class="empty-state"><div class="empty-state-text">Simulation failed: ${e.message}</div></div></div>`;
    }
}

/**
 * Populates custom matrix input fields from an overrides dictionary.
 */
function populateMatrixFromOverrides(overrides) {
    const fieldMap = {
        'Dining': 'custom-dining',
        'Shopping': 'custom-shopping',
        'Rent': 'custom-rent',
        'Salary': 'custom-salary',
        'Investments': 'custom-investments',
        'SIP': 'custom-investments',
        'Entertainment': 'custom-entertainment',
        'Transport': 'custom-transport',
        'Groceries': 'custom-groceries',
    };

    Object.keys(overrides).forEach(cat => {
        const inputId = fieldMap[cat];
        if (inputId) {
            const input = document.getElementById(inputId);
            if (input) {
                input.value = overrides[cat];
                input.style.borderColor = 'var(--brand)';
                setTimeout(() => { input.style.borderColor = ''; }, 1200);
            }
        }
    });
}

function clearMatrixInputs() {
    [
        'custom-salary', 'custom-investments', 'custom-rent',
        'custom-dining', 'custom-shopping', 'custom-entertainment',
        'custom-transport', 'custom-groceries'
    ].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
}

function resetCustomMatrix() {
    clearMatrixInputs();
    document.querySelectorAll('.scenario-card').forEach(c => c.classList.remove('active'));
    activeScenario = null;
    showToast('Matrix levers cleared. Enter custom offsets or pick a preset above.', 'info');
}

/**
 * Run a multi-lever custom scenario reading all filled fields.
 */
async function runCustomScenario() {
    const overrides = {};
    
    const salary = parseFloat(document.getElementById('custom-salary')?.value);
    const investments = parseFloat(document.getElementById('custom-investments')?.value);
    const rent = parseFloat(document.getElementById('custom-rent')?.value);
    const dining = parseFloat(document.getElementById('custom-dining')?.value);
    const shopping = parseFloat(document.getElementById('custom-shopping')?.value);
    const entertainment = parseFloat(document.getElementById('custom-entertainment')?.value);
    const transport = parseFloat(document.getElementById('custom-transport')?.value);
    const groceries = parseFloat(document.getElementById('custom-groceries')?.value);
    
    if (!isNaN(salary)) overrides.Salary = salary;
    if (!isNaN(investments)) overrides.Investments = investments;
    if (!isNaN(rent)) overrides.Rent = rent;
    if (!isNaN(dining)) overrides.Dining = dining;
    if (!isNaN(shopping)) overrides.Shopping = shopping;
    if (!isNaN(entertainment)) overrides.Entertainment = entertainment;
    if (!isNaN(transport)) overrides.Transport = transport;
    if (!isNaN(groceries)) overrides.Groceries = groceries;
    
    if (Object.keys(overrides).length === 0) {
        showToast('Specify at least one override parameter to simulate.', 'warning');
        return;
    }

    activeScenario = 'custom';
    document.querySelectorAll('.scenario-card').forEach(c => c.classList.remove('active'));

    const resultsDiv = document.getElementById('scenario-results');
    if (!resultsDiv) return;

    resultsDiv.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

    try {
        const leverCount = Object.keys(overrides).length;
        const name = leverCount > 1 
            ? `Multi-Lever Simulation (${leverCount} adjustments)`
            : `Custom ${Object.keys(overrides)[0]} Adjustment`;

        const data = await apiPost('/api/scenario?days=90', {
            name: name,
            overrides: overrides,
        });
        renderScenarioResults(resultsDiv, data);
    } catch (e) {
        resultsDiv.innerHTML = `<div class="card"><div class="empty-state"><div class="empty-state-text">Simulation failed: ${e.message}</div></div></div>`;
    }
}

/**
 * Render the full before-vs-after comparison output, headline delta, and dual-series chart.
 */
function renderScenarioResults(container, data) {
    const baseline = data.baseline || {};
    const scenario = data.scenario || {};
    const comparison = data.comparison || {};
    const headline = comparison.headline_delta || {};

    const balDiff = comparison.balance_difference ?? comparison.final_balance_diff ?? 0;
    const isPositive = balDiff >= 0;

    // Headline styling
    const isEliminated = headline.status === 'shortfall_eliminated' || headline.status === 'solvent_gain';
    const isDelayed = headline.status === 'shortfall_delayed';
    const isDanger = headline.status === 'shortfall_advanced' || headline.status === 'shortfall_created';
    
    const bannerBorder = isEliminated 
        ? 'var(--emerald)' 
        : isDelayed 
        ? 'var(--amber)' 
        : isDanger 
        ? 'var(--rose)' 
        : 'var(--brand)';
    
    const bannerBg = isEliminated 
        ? 'rgba(16, 185, 129, 0.08)' 
        : isDelayed 
        ? 'rgba(245, 158, 11, 0.08)' 
        : isDanger 
        ? 'rgba(244, 63, 94, 0.08)' 
        : 'rgba(99, 102, 241, 0.08)';

    const bannerIcon = isEliminated 
        ? 'shieldCheck' 
        : isDelayed 
        ? 'clock' 
        : isDanger 
        ? 'alertTriangle' 
        : 'trendingUp';

    const bannerTitle = headline.headline || (isPositive 
        ? `No shortfall projected (+${formatCurrency(balDiff)} net position)` 
        : `Simulated trajectory (${formatCurrency(balDiff)} delta)`);

    const bannerSubtext = headline.subtext || (
        baseline.zero_crossing_date 
            ? `Baseline projected shortfall on ${formatDate(baseline.zero_crossing_date)}. Scenario ending position: ${formatCurrency(scenario.final_balance)}.`
            : `Both baseline and simulated run-rate remain solvent over 90 days.`
    );

    // Active overrides summary tags
    const activeOverrides = comparison.overrides || {};
    const overrideTags = Object.entries(activeOverrides).map(([k, v]) => {
        const isFraction = Math.abs(v) <= 1;
        const formattedVal = isFraction ? `${(v * 100).toFixed(0)}%` : `${v > 0 ? '+' : ''}${formatCurrency(v)}`;
        return `<span class="badge badge-low" style="font-weight:600">${k}: ${formattedVal}</span>`;
    }).join(' ');

    let html = `
        <div class="card mb-3" style="border-top: 3px solid ${bannerBorder}">
            <!-- Headline Delta Callout -->
            <div style="background:${bannerBg};border-radius:var(--radius-sm);padding:16px;margin-bottom:20px;display:flex;align-items:flex-start;gap:14px;border:1px solid ${bannerBorder}33">
                <div style="color:${bannerBorder};margin-top:2px">
                    ${icon(bannerIcon, 26)}
                </div>
                <div style="flex:1">
                    <div class="flex items-center gap-1 mb-1">
                        <span style="font-size:16px;font-weight:700;color:var(--text-primary)">
                            ${bannerTitle}
                        </span>
                        <span class="badge ${isPositive ? 'badge-success' : isDelayed ? 'badge-medium' : 'badge-high'}">
                            ${headline.badge || (isPositive ? '+' : '') + formatCurrency(balDiff)}
                        </span>
                    </div>
                    <div style="font-size:13px;color:var(--text-secondary);line-height:1.5">
                        ${bannerSubtext}
                    </div>
                </div>
            </div>

            <!-- Header with Active Scenario Info -->
            <div class="card-header" style="padding-top:0">
                <div>
                    <div class="card-title">Before vs After: ${comparison.scenario_name || data.scenario_name || 'Active Simulation'}</div>
                    <div class="card-subtitle">90-Day Comparative Impact vs Verified Baseline</div>
                </div>
                <div class="flex items-center gap-1">
                    ${overrideTags}
                </div>
            </div>

            <!-- Comparative Metrics Grid -->
            <div class="stats-grid mb-3">
                <!-- Ending Balance Metric -->
                <div class="stat-card" style="border-left:3px solid ${isPositive ? 'var(--emerald)' : 'var(--rose)'}">
                    <div class="stat-header">
                        <span class="stat-label">90-Day Ending Liquid Position</span>
                        <span class="stat-icon">${icon('wallet', 15)}</span>
                    </div>
                    <div class="stat-value" style="color:${isPositive ? 'var(--emerald-light)' : 'var(--rose-light)'}">
                        ${formatCurrency(scenario.final_balance)}
                    </div>
                    <div class="stat-subtext">
                        Baseline: <span style="text-decoration:line-through;color:var(--text-tertiary)">${formatCurrency(baseline.final_balance)}</span>
                        · <strong style="color:${isPositive ? 'var(--emerald-light)' : 'var(--rose-light)'}">${isPositive ? '+' : ''}${formatCurrency(balDiff)}</strong>
                    </div>
                </div>

                <!-- Solvency / Zero-Crossing Metric -->
                <div class="stat-card" style="border-left:3px solid ${scenario.zero_crossing_date ? 'var(--rose)' : 'var(--emerald)'}">
                    <div class="stat-header">
                        <span class="stat-label">Solvency & Zero-Crossing</span>
                        <span class="stat-icon">${icon(scenario.zero_crossing_date ? 'alertTriangle' : 'shieldCheck', 15)}</span>
                    </div>
                    <div class="stat-value" style="font-size:18px;color:${scenario.zero_crossing_date ? 'var(--rose-light)' : 'var(--emerald-light)'}">
                        ${scenario.zero_crossing_date ? 'Breach on ' + formatDate(scenario.zero_crossing_date) : 'No shortfall projected'}
                    </div>
                    <div class="stat-subtext">
                        ${baseline.zero_crossing_date 
                            ? `Baseline breached: ${formatDate(baseline.zero_crossing_date)}`
                            : `Baseline was also solvent`}
                    </div>
                </div>

                <!-- Daily Discretionary Cap -->
                <div class="stat-card">
                    <div class="stat-header">
                        <span class="stat-label">Estimated Discretionary Cap</span>
                        <span class="stat-icon">${icon('receipt', 15)}</span>
                    </div>
                    <div class="stat-value">${formatCurrency(scenario.daily_discretionary_estimate)}/day</div>
                    <div class="stat-subtext">
                        Baseline: ${formatCurrency(baseline.daily_discretionary_estimate)}/day
                    </div>
                </div>
            </div>

            <!-- Dual-Series Trajectory Comparison Chart -->
            <div style="margin-top:10px">
                <div class="flex justify-between items-center mb-1">
                    <span style="font-size:12px;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.04em">
                        Projected Balance Trajectory (90 Days)
                    </span>
                    <span style="font-size:11px;color:var(--text-tertiary)">
                        Green = Simulated Scenario · Dashed Slate = Verified Baseline
                    </span>
                </div>
                <div class="chart-container" style="height:290px">
                    <canvas id="chart-scenario-compare"></canvas>
                </div>
            </div>
        </div>
    `;

    container.innerHTML = html;

    // Render comparison chart with dual series
    renderComparisonChart(baseline.daily || [], scenario.daily || []);
}

function renderComparisonChart(baseDaily, scenDaily) {
    if (!baseDaily.length || !scenDaily.length) return;

    // Sample points for clean visual rendering (every 2 days + endpoints)
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
                    borderWidth: 2.5,
                    fill: false,
                    tension: 0.25,
                    pointRadius: 0,
                    pointHoverRadius: 4,
                },
                {
                    label: 'Verified Baseline',
                    data: sampledBase.map(d => d.balance),
                    borderColor: '#94A3B8',
                    borderWidth: 1.5,
                    borderDash: [5, 4],
                    fill: false,
                    tension: 0.25,
                    pointRadius: 0,
                    pointHoverRadius: 3,
                },
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { 
                    position: 'top', 
                    labels: { 
                        boxWidth: 12, 
                        padding: 14,
                        color: '#94A3B8',
                        font: { size: 12 }
                    } 
                },
                tooltip: {
                    callbacks: {
                        label: ctx => ` ${ctx.dataset.label}: ${formatCurrency(ctx.raw)}`,
                    },
                },
            },
            scales: {
                y: {
                    ticks: { callback: v => formatCurrency(v), maxTicksLimit: 6 },
                    grid: { color: 'rgba(148, 163, 184, 0.1)' },
                },
                x: { 
                    grid: { display: false }, 
                    ticks: { maxTicksLimit: 14 } 
                },
            },
        },
    });
}

// Exports
window.renderScenarios = renderScenarios;
window.selectAndRunPreset = selectAndRunPreset;
window.runScenarioTemplate = selectAndRunPreset;
window.runCustomScenario = runCustomScenario;
window.resetCustomMatrix = resetCustomMatrix;
