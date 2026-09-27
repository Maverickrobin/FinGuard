/* ══════════════════════════════════════════════════════════════════
   FinGuard Analysis View — Anomalies & 90-Day Cash Flow Forecast
   ══════════════════════════════════════════════════════════════════ */

let anomalyFilter = 'all'; // 'all' | 'outlier' | 'recurring'

async function renderAnalysis(container) {
    try {
        const [anomalyData, forecastData] = await Promise.all([
            apiGet('/api/anomalies'),
            apiGet('/api/forecast?days=90'),
        ]);

        const anomalies = anomalyData.anomalies || [];
        const forecast = forecastData;

        const hasZeroCrossing = !!forecast.zero_crossing_date;
        const outliers = anomalies.filter(a => a.anomaly_type === 'category_outlier');
        const recurring = anomalies.filter(a => a.anomaly_type === 'recurring_price_change' || a.anomaly_type === 'recurring_price_drop');

        const displayAnomalies = anomalyFilter === 'outlier' ? outliers 
            : anomalyFilter === 'recurring' ? recurring 
            : anomalies;

        let html = `
            <!-- Top Summary Statistics -->
            <div class="stats-grid">
                <div class="stat-card" style="border-left:3px solid ${hasZeroCrossing ? 'var(--rose)' : 'var(--emerald)'}">
                    <div class="stat-header">
                        <span class="stat-label">90-Day Solvency Outlook</span>
                        <span class="stat-icon">${icon(hasZeroCrossing ? 'alertTriangle' : 'shieldCheck', 15)}</span>
                    </div>
                    <div class="stat-value" style="font-size:20px;color:${hasZeroCrossing ? 'var(--rose)' : 'var(--emerald)'}">
                        ${hasZeroCrossing ? `Deficit on ${formatDate(forecast.zero_crossing_date)}` : 'Solvent & Stable'}
                    </div>
                    <div class="stat-subtext ${hasZeroCrossing ? 'negative' : 'positive'}">
                        ${hasZeroCrossing ? 'Liquidity breach predicted' : 'No zero-crossing risk detected'}
                    </div>
                </div>

                <div class="stat-card">
                    <div class="stat-header">
                        <span class="stat-label">Projected Balance (Day 90)</span>
                        <span class="stat-icon">${icon('trendingUp', 15)}</span>
                    </div>
                    <div class="stat-value">${formatCurrency(forecast.final_balance)}</div>
                    <div class="stat-subtext">Estimated net position</div>
                </div>

                <div class="stat-card">
                    <div class="stat-header">
                        <span class="stat-label">Daily Discretionary Cap</span>
                        <span class="stat-icon">${icon('receipt', 15)}</span>
                    </div>
                    <div class="stat-value">${formatCurrency(forecast.daily_discretionary_estimate)}</div>
                    <div class="stat-subtext">Safe daily spending velocity</div>
                </div>

                <div class="stat-card" style="border-left:3px solid var(--amber)">
                    <div class="stat-header">
                        <span class="stat-label">Detected Anomalies</span>
                        <span class="stat-icon" style="color:var(--amber)">${icon('alertTriangle', 15)}</span>
                    </div>
                    <div class="stat-value" style="color:var(--amber)">${anomalies.length}</div>
                    <div class="stat-subtext warning">${recurring.length} recurring subscription hikes</div>
                </div>
            </div>

            <!-- 90-Day Balance Trajectory Chart -->
            <div class="card mb-3">
                <div class="card-header">
                    <div>
                        <div class="card-title">90-Day Liquidity & Cash Flow Trajectory</div>
                        <div class="card-subtitle">Synthesized from recurring fixed obligations + mean discretionary run-rate</div>
                    </div>
                    <div class="flex items-center gap-1">
                        <span class="badge badge-low">Deterministic Model</span>
                    </div>
                </div>
                <div class="chart-container" style="height:280px">
                    <canvas id="chart-forecast"></canvas>
                </div>
            </div>

            <!-- Detected Anomalies Section -->
            <div class="section-header">
                <div>
                    <h2 class="section-title">Statistical & Contractual Anomalies</h2>
                    <div class="card-subtitle">Filtered by rolling per-category 2.0σ threshold and same-merchant subscription price tracking.</div>
                </div>
                <div class="flex items-center gap-1">
                    <button class="btn btn-secondary btn-sm" onclick="reRunAnomalyScan()">
                        ${icon('refresh', 13)}
                        Re-evaluate Models
                    </button>
                </div>
            </div>

            <!-- Anomaly Filter Pills -->
            <div class="flex items-center gap-1 mb-2">
                <button class="btn btn-sm ${anomalyFilter === 'all' ? 'btn-primary' : 'btn-secondary'}" onclick="setAnomalyFilter('all')">
                    All Detected (${anomalies.length})
                </button>
                <button class="btn btn-sm ${anomalyFilter === 'outlier' ? 'btn-primary' : 'btn-secondary'}" onclick="setAnomalyFilter('outlier')">
                    Spending Outliers (${outliers.length})
                </button>
                <button class="btn btn-sm ${anomalyFilter === 'recurring' ? 'btn-primary' : 'btn-secondary'}" onclick="setAnomalyFilter('recurring')">
                    Recurring Price Hikes (${recurring.length})
                </button>
            </div>

            <!-- Anomaly Cards List -->
            ${displayAnomalies.length === 0 ? `
                <div class="card">
                    <div class="empty-state">
                        <div class="empty-state-icon" style="color:var(--emerald)">${icon('check', 44)}</div>
                        <div class="empty-state-text">No anomalies in this category</div>
                    </div>
                </div>
            ` : displayAnomalies.map(a => {
                const isRecurring = a.anomaly_type === 'recurring_price_change' || a.anomaly_type === 'recurring_price_drop';
                const isDrop = a.anomaly_type === 'recurring_price_drop';
                const isHigh = a.severity === 'high';
                const badgeClass = isDrop ? 'badge-success' : isHigh ? 'badge-high' : 'badge-medium';
                const titleText = isDrop 
                    ? 'Recurring Bill Savings / Price Drop' 
                    : isRecurring 
                    ? 'Recurring Subscription Price Hike' 
                    : 'Per-Category Statistical Outlier';

                return `
                    <div class="anomaly-card">
                        <div class="anomaly-icon ${isDrop ? 'low' : a.severity}">
                            ${icon(isDrop ? 'trendingDown' : isRecurring ? 'refresh' : 'alertTriangle', 18)}
                        </div>
                        <div class="anomaly-details">
                            <div class="anomaly-title">
                                <span>${titleText}</span>
                                <span class="badge ${badgeClass}">
                                    ${isDrop ? 'SAVINGS' : a.severity.toUpperCase()}
                                </span>
                                ${a.category ? `<span class="badge badge-low">${a.category}</span>` : ''}
                            </div>
                            <div class="anomaly-desc">${a.description}</div>
                        </div>
                        <div class="anomaly-stat-pill">
                            <div class="anomaly-stat-label">${isDrop ? 'Savings' : 'Deviation'}</div>
                            <div class="anomaly-stat-value" style="color:${isDrop ? 'var(--emerald-light)' : isHigh ? 'var(--rose-light)' : 'var(--amber-light)'}">
                                ${isDrop ? '-' + a.deviation_score + '%' : isRecurring ? '+' + a.deviation_score + '%' : '+' + a.deviation_score + 'σ'}
                            </div>
                        </div>
                    </div>
                `;
            }).join('')}

            <!-- Monthly Projection Breakdown Table -->
            <div class="card mt-3">
                <div class="card-header">
                    <div>
                        <div class="card-title">Monthly Trajectory Breakdown</div>
                        <div class="card-subtitle">Projected net cash flows over 90-day horizon</div>
                    </div>
                </div>
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Forecast Period</th>
                                <th style="text-align:right">Estimated Inflow</th>
                                <th style="text-align:right">Estimated Outflow</th>
                                <th style="text-align:right">Net Delta</th>
                                <th style="text-align:right">Projected Min Balance</th>
                                <th style="text-align:right">Projected End Balance</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${(forecast.monthly || []).map(m => {
                                const net = m.income - m.expense;
                                return `
                                    <tr>
                                        <td style="font-weight:600;color:var(--text-primary)">${m.month}</td>
                                        <td style="text-align:right" class="amount-credit">+${formatCurrency(m.income)}</td>
                                        <td style="text-align:right" class="amount-debit">-${formatCurrency(m.expense)}</td>
                                        <td style="text-align:right;color:${net >= 0 ? 'var(--emerald-light)' : 'var(--rose-light)'};font-weight:600">
                                            ${net >= 0 ? '+' : ''}${formatCurrency(net)}
                                        </td>
                                        <td style="text-align:right;font-size:12px;color:var(--text-tertiary)">
                                            ${formatCurrency(m.min_balance)}
                                        </td>
                                        <td style="text-align:right;font-weight:600;color:var(--text-primary)">
                                            ${formatCurrency(m.end_balance)}
                                        </td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        container.innerHTML = html;

        // Render forecast chart
        renderForecastChart(forecast.daily || []);

    } catch (e) {
        showEmpty(container, 'alertTriangle', 'Failed to load analysis', e.message);
    }
}

function setAnomalyFilter(filter) {
    anomalyFilter = filter;
    renderAnalysis(document.getElementById('view-container'));
}

async function reRunAnomalyScan() {
    try {
        showToast('Running statistical outlier and subscription diff models...', 'info');
        await apiPost('/api/anomalies/detect');
        showToast('Anomaly scan complete. View updated.', 'success');
        renderAnalysis(document.getElementById('view-container'));
        updateBadges();
    } catch (e) {
        showToast('Error scanning: ' + e.message, 'error');
    }
}

function renderForecastChart(dailyData) {
    if (!dailyData || dailyData.length === 0) return;

    // Sample data points to keep chart clean (every 3 days)
    const sampled = dailyData.filter((_, i) => i % 2 === 0 || i === dailyData.length - 1);

    const labels = sampled.map(d => {
        const parts = d.date.split('-');
        return `${parts[2]}/${parts[1]}`;
    });

    const balances = sampled.map(d => d.balance);

    getOrCreateChart('chart-forecast', {
        type: 'line',
        data: {
            labels,
            datasets: [
                {
                    label: 'Projected Net Liquidity',
                    data: balances,
                    borderColor: '#4F6BFF',
                    backgroundColor: 'rgba(79, 107, 255, 0.08)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.3,
                    pointRadius: 0,
                    pointHoverRadius: 5,
                    pointHoverBackgroundColor: '#4F6BFF',
                },
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: ctx => ` Projected Balance: ${formatCurrency(ctx.raw)}`,
                    },
                },
            },
            scales: {
                y: {
                    ticks: {
                        callback: v => formatCurrency(v),
                        maxTicksLimit: 5,
                    },
                    grid: { color: CHART_COLORS.grid },
                },
                x: {
                    grid: { display: false },
                    ticks: { maxTicksLimit: 12 },
                },
            },
        },
    });
}

// Exports
window.renderAnalysis = renderAnalysis;
window.setAnomalyFilter = setAnomalyFilter;
window.reRunAnomalyScan = reRunAnomalyScan;
