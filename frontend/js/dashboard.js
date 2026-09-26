/* Dashboard View */
async function renderDashboard(container) {
    try {
        const data = await apiGet('/api/dashboard');
        
        const monthlySummary = data.monthly_summary || [];
        const categoryBreakdown = data.category_breakdown || [];
        const goals = data.goals || [];

        // Calculate income/expense for latest month
        const latest = monthlySummary[monthlySummary.length - 1] || {};
        const prevMonth = monthlySummary[monthlySummary.length - 2] || {};
        
        const incomeChange = prevMonth.income > 0 
            ? ((latest.income - prevMonth.income) / prevMonth.income * 100).toFixed(1) 
            : 0;
        const expenseChange = prevMonth.expense > 0 
            ? ((latest.expense - prevMonth.expense) / prevMonth.expense * 100).toFixed(1)
            : 0;

        let html = `
            <!-- Stats -->
            <div class="stats-grid">
                <div class="stat-card accent-primary">
                    <div class="stat-label">Current Balance</div>
                    <div class="stat-value">${formatCurrency(data.balance)}</div>
                </div>
                <div class="stat-card accent-success">
                    <div class="stat-label">Monthly Income</div>
                    <div class="stat-value">${formatCurrency(latest.income || 0)}</div>
                    ${incomeChange != 0 ? `<div class="stat-change ${incomeChange >= 0 ? 'positive' : 'negative'}">${incomeChange > 0 ? '↑' : '↓'} ${Math.abs(incomeChange)}% vs last month</div>` : ''}
                </div>
                <div class="stat-card accent-danger">
                    <div class="stat-label">Monthly Expense</div>
                    <div class="stat-value">${formatCurrency(latest.expense || 0)}</div>
                    ${expenseChange != 0 ? `<div class="stat-change ${expenseChange <= 0 ? 'positive' : 'negative'}">${expenseChange > 0 ? '↑' : '↓'} ${Math.abs(expenseChange)}% vs last month</div>` : ''}
                </div>
                <div class="stat-card accent-warning">
                    <div class="stat-label">Anomalies</div>
                    <div class="stat-value">${data.anomaly_count || 0}</div>
                    <div class="stat-change">${data.pending_actions_count || 0} pending approvals</div>
                </div>
            </div>

            <!-- Charts -->
            <div class="charts-grid">
                <div class="card">
                    <div class="card-header">
                        <div>
                            <div class="card-title">Income vs Expenses</div>
                            <div class="card-subtitle">6-month trend</div>
                        </div>
                    </div>
                    <div class="chart-container">
                        <canvas id="chart-income-expense"></canvas>
                    </div>
                </div>
                <div class="card">
                    <div class="card-header">
                        <div>
                            <div class="card-title">Spending by Category</div>
                            <div class="card-subtitle">${data.current_month || 'Current month'}</div>
                        </div>
                    </div>
                    <div class="chart-container">
                        <canvas id="chart-categories"></canvas>
                    </div>
                </div>
            </div>

            <!-- Budget vs Actual -->
            <div class="card mb-3">
                <div class="card-header">
                    <div class="card-title">Budget vs Actual Spending</div>
                </div>
                ${categoryBreakdown
                    .filter(c => c.budget != null)
                    .map(c => {
                        const pct = c.percentage || 0;
                        const barClass = pct >= 120 ? 'danger' : pct >= 90 ? 'warning' : 'good';
                        return `
                            <div style="margin-bottom: 14px">
                                <div class="flex justify-between items-center">
                                    <span style="font-size:13px;font-weight:500">${c.category}</span>
                                    <span style="font-size:12px;color:var(--text-tertiary)">
                                        ${formatCurrency(c.spent)} / ${formatCurrency(c.budget)}
                                        <span class="badge badge-${pct >= 100 ? 'high' : pct >= 80 ? 'medium' : 'low'}" style="margin-left:6px">${pct.toFixed(0)}%</span>
                                    </span>
                                </div>
                                <div class="progress-bar">
                                    <div class="progress-fill ${barClass}" style="width:${Math.min(100, pct)}%"></div>
                                </div>
                            </div>
                        `;
                    }).join('')}
            </div>

            <!-- Goals -->
            <div class="card">
                <div class="card-header">
                    <div class="card-title">Financial Goals</div>
                </div>
                ${goals.map(g => {
                    const pct = g.target_amount > 0 ? (g.current_amount / g.target_amount * 100) : 0;
                    return `
                        <div style="margin-bottom:16px">
                            <div class="flex justify-between items-center">
                                <div>
                                    <div style="font-weight:600;font-size:14px">${g.name}</div>
                                    <div style="font-size:12px;color:var(--text-tertiary)">
                                        Deadline: ${formatDate(g.deadline)} · ₹${(g.monthly_contribution || 0).toLocaleString()}/month
                                    </div>
                                </div>
                                <div style="text-align:right">
                                    <div style="font-size:14px;font-weight:600">${formatCurrency(g.current_amount)}</div>
                                    <div style="font-size:12px;color:var(--text-tertiary)">of ${formatCurrency(g.target_amount)}</div>
                                </div>
                            </div>
                            <div class="progress-bar">
                                <div class="progress-fill ${pct >= 80 ? 'good' : pct >= 40 ? 'warning' : 'danger'}" 
                                     style="width:${Math.min(100, pct)}%"></div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;

        container.innerHTML = html;

        // Render charts safely
        try {
            renderIncomeExpenseChart(monthlySummary);
        } catch (chartErr) {
            console.warn('Income/Expense chart error:', chartErr);
        }

        try {
            renderCategoryChart(categoryBreakdown);
        } catch (chartErr) {
            console.warn('Category chart error:', chartErr);
        }

    } catch (e) {
        showEmpty(container, '❌', 'Failed to load dashboard', e.message);
    }
}

function renderIncomeExpenseChart(monthly) {
    const labels = monthly.map(m => {
        const [y, mo] = m.month.split('-');
        return new Date(y, mo - 1).toLocaleDateString('en-IN', { month: 'short' });
    });

    getOrCreateChart('chart-income-expense', {
        type: 'bar',
        data: {
            labels,
            datasets: [
                {
                    label: 'Income',
                    data: monthly.map(m => m.income),
                    backgroundColor: 'rgba(52, 211, 153, 0.6)',
                    borderColor: CHART_COLORS.success,
                    borderWidth: 1,
                    borderRadius: 4,
                    barPercentage: 0.7,
                },
                {
                    label: 'Expense',
                    data: monthly.map(m => m.expense),
                    backgroundColor: 'rgba(248, 113, 113, 0.6)',
                    borderColor: CHART_COLORS.danger,
                    borderWidth: 1,
                    borderRadius: 4,
                    barPercentage: 0.7,
                },
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'top' },
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: v => formatCurrency(v),
                    },
                    grid: { color: CHART_COLORS.grid },
                },
                x: { grid: { display: false } },
            },
        },
    });
}

function renderCategoryChart(categories) {
    const catColors = [
        '#6366f1', '#22d3ee', '#34d399', '#fbbf24', '#f87171',
        '#60a5fa', '#a78bfa', '#fb923c', '#f472b6', '#2dd4bf',
    ];

    const filtered = categories.filter(c => c.category && c.spent > 0);

    getOrCreateChart('chart-categories', {
        type: 'doughnut',
        data: {
            labels: filtered.map(c => c.category),
            datasets: [{
                data: filtered.map(c => c.spent),
                backgroundColor: catColors.slice(0, filtered.length),
                borderWidth: 0,
                hoverOffset: 8,
            }],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '65%',
            plugins: {
                legend: {
                    position: 'right',
                    labels: { padding: 12, font: { size: 11 } },
                },
                tooltip: {
                    callbacks: {
                        label: ctx => `${ctx.label}: ${formatCurrency(ctx.raw)}`,
                    },
                },
            },
        },
    });
}

// Export to window for global access
window.renderDashboard = renderDashboard;
