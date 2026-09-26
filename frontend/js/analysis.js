/* Analysis View — Anomalies + Cash Flow Forecast */
async function renderAnalysis(container) {
    try {
        const [anomalyData, forecastData] = await Promise.all([
            apiGet('/api/anomalies'),
            apiGet('/api/forecast?days=90'),
        ]);

        const anomalies = anomalyData.anomalies || [];
        const forecast = forecastData;

        let html = `
            <!-- Forecast Summary Stats -->
            <div class="stats-grid">
                <div class="stat-card ${forecast.zero_crossing_date ? 'accent-danger' : 'accent-success'}">
                    <div class="stat-label">Cash Flow Status</div>
                    <div class="stat-value" style="font-size:20px">
                        ${forecast.zero_crossing_date 
                            ? `⚠️ Shortfall on ${formatDate(forecast.zero_crossing_date)}`
                            : '✅ Healthy'}
                    </div>
                </div>
                <div class="stat-card accent-primary">
                    <div class="stat-label">Projected Balance (90 days)</div>
                    <div class="stat-value">${formatCurrency(forecast.final_balance)}</div>
                </div>
                <div class="stat-card accent-info">
                    <div class="stat-label">Daily Discretionary</div>
                    <div class="stat-value">${formatCurrency(forecast.daily_discretionary_estimate)}</div>
                    <div class="stat-change">estimated average/day</div>
                </div>
                <div class="stat-card accent-warning">
                    <div class="stat-label">Anomalies Detected</div>
                    <div class="stat-value">${anomalies.length}</div>
                </div>
            </div>

            <!-- Forecast Chart -->
            <div class="card mb-3">
                <div class="card-header">
                    <div>
                        <div class="card-title">90-Day Balance Forecast</div>
                        <div class="card-subtitle">Based on recurring patterns + discretionary trends</div>
                    </div>
                </div>
                <div class="chart-container" style="height:320px">
                    <canvas id="chart-forecast"></canvas>
                </div>
            </div>

            <!-- Anomalies -->
            <div class="section-header">
                <h2 class="section-title">Detected Anomalies</h2>
                <button class="btn btn-secondary btn-sm" onclick="detectAnomalies()">🔍 Re-detect</button>
            </div>
            
            ${anomalies.length === 0 
                ? '<div class="card"><div class="empty-state"><div class="empty-state-icon">✅</div><div class="empty-state-text">No anomalies detected</div><div class="empty-state-hint">Run the analysis pipeline to detect anomalies.</div></div></div>'
                : anomalies.map(a => `
                    <div class="anomaly-card">
                        <div class="anomaly-icon ${a.severity}">
                            ${a.anomaly_type === 'recurring_price_change' ? '💰' : '📊'}
                        </div>
                        <div class="anomaly-details">
                            <div class="anomaly-title">
                                ${a.anomaly_type === 'recurring_price_change' ? 'Price Change' : 'Spending Outlier'}
                                <span class="badge badge-${a.severity}" style="margin-left:8px">${a.severity}</span>
                            </div>
                            <div class="anomaly-desc">${a.description}</div>
                        </div>
                        <div style="text-align:right;flex-shrink:0">
                            <div style="font-size:11px;color:var(--text-tertiary)">Deviation</div>
                            <div style="font-size:18px;font-weight:700;color:${a.severity === 'high' ? 'var(--accent-danger)' : 'var(--accent-warning)'}">
                                ${a.deviation_score}${a.anomaly_type === 'category_outlier' ? 'σ' : '%'}
                            </div>
                        </div>
                    </div>
                `).join('')
            }
            
            <!-- Monthly Forecast Table -->
            <div class="card mt-3">
                <div class="card-header">
                    <div class="card-title">Monthly Projection</div>
                </div>
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Month</th>
                                <th>Income</th>
                                <th>Expense</th>
                                <th>Net</th>
                                <th>Min Balance</th>
                                <th>End Balance</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${(forecast.monthly || []).map(m => `
                                <tr>
                                    <td>${m.month}</td>
                                    <td class="amount-credit">${formatCurrency(m.income)}</td>
                                    <td class="amount-debit">${formatCurrency(m.expense)}</td>
                                    <td class="${m.net >= 0 ? 'amount-credit' : 'amount-debit'}">${formatCurrency(m.net)}</td>
                                    <td class="${m.min_balance < 0 ? 'amount-debit' : ''}">${formatCurrency(m.min_balance)}</td>
                                    <td class="${m.end_balance < 0 ? 'amount-debit' : ''}">${formatCurrency(m.end_balance)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        container.innerHTML = html;

        // Render forecast chart
        renderForecastChart(forecast);

    } catch (e) {
        showEmpty(container, '❌', 'Failed to load analysis', e.message);
    }
}

function renderForecastChart(forecast) {
    const daily = forecast.daily || [];
    
    // Sample every 3rd day for readability
    const sampled = daily.filter((_, i) => i % 3 === 0 || i === daily.length - 1);
    
    const labels = sampled.map(d => {
        const date = new Date(d.date);
        return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    });

    getOrCreateChart('chart-forecast', {
        type: 'line',
        data: {
            labels,
            datasets: [
                {
                    label: 'Projected Balance',
                    data: sampled.map(d => d.balance),
                    borderColor: CHART_COLORS.primary,
                    backgroundColor: 'rgba(99, 102, 241, 0.08)',
                    fill: true,
                    tension: 0.3,
                    pointRadius: 2,
                    pointHoverRadius: 6,
                    borderWidth: 2,
                },
                {
                    label: 'Zero Line',
                    data: sampled.map(() => 0),
                    borderColor: CHART_COLORS.danger,
                    borderDash: [6, 4],
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
            plugins: {
                legend: { position: 'top' },
                tooltip: {
                    callbacks: {
                        label: ctx => `${ctx.dataset.label}: ${formatCurrency(ctx.raw)}`,
                    },
                },
            },
            scales: {
                y: {
                    ticks: { callback: v => formatCurrency(v) },
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

async function detectAnomalies() {
    try {
        showToast('Detecting anomalies...', 'info');
        await apiPost('/api/anomalies/detect');
        showToast('Anomaly detection complete!', 'success');
        renderAnalysis(document.getElementById('view-container'));
    } catch (e) {
        showToast('Error: ' + e.message, 'error');
    }
}

// Export to window
window.renderAnalysis = renderAnalysis;
window.detectAnomalies = detectAnomalies;
