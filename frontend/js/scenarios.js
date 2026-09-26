/* Scenarios View — What-If Simulator */
let activeScenario = null;

async function renderScenarios(container) {
    try {
        const templates = await apiGet('/api/scenario/templates');
        
        let html = `
            <div class="section-header">
                <h2 class="section-title">What-If Scenarios</h2>
                <div class="card-subtitle">Same forecast model, different parameters. Not a separate model.</div>
            </div>

            <!-- Scenario Templates -->
            <div class="scenario-grid">
                ${templates.templates.map(t => `
                    <div class="scenario-card ${activeScenario === t.id ? 'active' : ''}" 
                         onclick="runScenarioTemplate('${t.id}')">
                        <div class="scenario-icon">${t.icon}</div>
                        <div class="scenario-name">${t.name}</div>
                        <div class="scenario-desc">${t.description}</div>
                    </div>
                `).join('')}
            </div>

            <!-- Custom Scenario -->
            <div class="card mb-3">
                <div class="card-header">
                    <div class="card-title">Custom Scenario</div>
                </div>
                <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;">
                    <div class="form-group">
                        <label class="form-label">Dining</label>
                        <input class="form-input" type="number" id="custom-dining" placeholder="e.g. -0.30 for -30%" step="0.1">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Shopping</label>
                        <input class="form-input" type="number" id="custom-shopping" placeholder="e.g. -0.50 for -50%" step="0.1">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Rent (₹ change)</label>
                        <input class="form-input" type="number" id="custom-rent" placeholder="e.g. 3000" step="500">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Entertainment</label>
                        <input class="form-input" type="number" id="custom-entertainment" placeholder="e.g. -0.40" step="0.1">
                    </div>
                </div>
                <button class="btn btn-primary mt-1" onclick="runCustomScenario()">🔮 Run Custom Scenario</button>
            </div>

            <!-- Results -->
            <div id="scenario-results"></div>
        `;

        container.innerHTML = html;

    } catch (e) {
        showEmpty(container, '❌', 'Failed to load scenarios', e.message);
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
        
        // Highlight active card
        document.querySelectorAll('.scenario-card').forEach(card => {
            card.classList.remove('active');
        });
        event.target.closest('.scenario-card')?.classList.add('active');
    } catch (e) {
        resultsDiv.innerHTML = `<div class="card"><div class="empty-state"><div class="empty-state-text">Error: ${e.message}</div></div></div>`;
    }
}

async function runCustomScenario() {
    const overrides = {};
    
    const dining = parseFloat(document.getElementById('custom-dining').value);
    const shopping = parseFloat(document.getElementById('custom-shopping').value);
    const rent = parseFloat(document.getElementById('custom-rent').value);
    const entertainment = parseFloat(document.getElementById('custom-entertainment').value);
    
    if (!isNaN(dining)) overrides.Dining = dining;
    if (!isNaN(shopping)) overrides.Shopping = shopping;
    if (!isNaN(rent)) overrides.Rent = rent;
    if (!isNaN(entertainment)) overrides.Entertainment = entertainment;
    
    if (Object.keys(overrides).length === 0) {
        showToast('Enter at least one override value', 'warning');
        return;
    }
    
    const resultsDiv = document.getElementById('scenario-results');
    resultsDiv.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
    
    try {
        const data = await apiPost('/api/scenario', {
            overrides,
            days: 90,
            name: 'Custom Scenario',
        });
        renderScenarioResults(resultsDiv, data);
    } catch (e) {
        resultsDiv.innerHTML = `<div class="card"><div class="empty-state"><div class="empty-state-text">Error: ${e.message}</div></div></div>`;
    }
}

function renderScenarioResults(container, data) {
    const comp = data.comparison;
    const baseline = data.baseline;
    const scenario = data.scenario;
    
    const diff = comp.balance_difference;
    const diffClass = diff >= 0 ? 'positive' : 'negative';
    
    let html = `
        <!-- Comparison Summary -->
        <div class="stats-grid">
            <div class="stat-card accent-primary">
                <div class="stat-label">Scenario</div>
                <div class="stat-value" style="font-size:18px">${comp.scenario_name}</div>
            </div>
            <div class="stat-card ${diff >= 0 ? 'accent-success' : 'accent-danger'}">
                <div class="stat-label">Balance Impact</div>
                <div class="stat-value">${diff >= 0 ? '+' : ''}${formatCurrency(diff)}</div>
            </div>
            <div class="stat-card ${comp.scenario_zero_crossing ? 'accent-danger' : 'accent-success'}">
                <div class="stat-label">Zero Crossing</div>
                <div class="stat-value" style="font-size:18px">
                    ${comp.scenario_zero_crossing 
                        ? formatDate(comp.scenario_zero_crossing)
                        : '✅ None'}
                </div>
                ${comp.baseline_zero_crossing && !comp.scenario_zero_crossing
                    ? '<div class="stat-change positive">Avoids shortfall!</div>' : ''}
            </div>
            <div class="stat-card accent-info">
                <div class="stat-label">Projected Balance</div>
                <div class="stat-value">${formatCurrency(comp.scenario_final_balance)}</div>
                <div class="stat-change ${diffClass}">
                    vs baseline ${formatCurrency(comp.baseline_final_balance)}
                </div>
            </div>
        </div>

        <!-- Comparison Chart -->
        <div class="card mb-3">
            <div class="card-header">
                <div class="card-title">Baseline vs Scenario</div>
            </div>
            <div class="chart-container" style="height:320px">
                <canvas id="chart-scenario"></canvas>
            </div>
        </div>

        <!-- Overrides Applied -->
        <div class="card">
            <div class="card-header">
                <div class="card-title">Adjustments Applied</div>
            </div>
            ${Object.entries(comp.overrides).map(([cat, val]) => {
                const isPercent = Math.abs(val) <= 1;
                return `
                    <div class="comparison-row">
                        <span class="comparison-label">${cat}</span>
                        <span class="comparison-diff ${val < 0 ? 'negative' : 'positive'}">
                            ${val > 0 ? '+' : ''}${isPercent ? (val * 100).toFixed(0) + '%' : formatCurrency(val)}
                        </span>
                    </div>
                `;
            }).join('')}
        </div>
    `;

    container.innerHTML = html;

    // Render comparison chart
    const baseDaily = baseline.daily || [];
    const scenDaily = scenario.daily || [];
    const sampled = baseDaily.filter((_, i) => i % 3 === 0 || i === baseDaily.length - 1);
    const scenSampled = scenDaily.filter((_, i) => i % 3 === 0 || i === scenDaily.length - 1);

    getOrCreateChart('chart-scenario', {
        type: 'line',
        data: {
            labels: sampled.map(d => {
                const date = new Date(d.date);
                return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
            }),
            datasets: [
                {
                    label: 'Baseline',
                    data: sampled.map(d => d.balance),
                    borderColor: CHART_COLORS.text,
                    borderDash: [6, 4],
                    borderWidth: 1.5,
                    pointRadius: 0,
                    fill: false,
                    tension: 0.3,
                },
                {
                    label: 'Scenario',
                    data: scenSampled.map(d => d.balance),
                    borderColor: CHART_COLORS.primary,
                    backgroundColor: 'rgba(99, 102, 241, 0.08)',
                    fill: true,
                    borderWidth: 2,
                    pointRadius: 2,
                    tension: 0.3,
                },
                {
                    label: 'Zero',
                    data: sampled.map(() => 0),
                    borderColor: CHART_COLORS.danger,
                    borderDash: [4, 4],
                    borderWidth: 1,
                    pointRadius: 0,
                    fill: false,
                },
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { intersect: false, mode: 'index' },
            plugins: { legend: { position: 'top' } },
            scales: {
                y: {
                    ticks: { callback: v => formatCurrency(v) },
                    grid: { color: CHART_COLORS.grid },
                },
                x: { grid: { display: false }, ticks: { maxTicksLimit: 12 } },
            },
        },
    });
}
