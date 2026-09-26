/* ══════════════════════════════════════════════════════════════════
   FinGuard Dashboard View — Institutional Executive Overview
   ══════════════════════════════════════════════════════════════════ */

async function renderDashboard(container) {
    try {
        const data = await apiGet('/api/dashboard');
        
        const monthlySummary = data.monthly_summary || [];
        const categoryBreakdown = data.category_breakdown || [];
        const goals = data.goals || [];

        // Inflow / Outflow for current vs previous month
        const latest = monthlySummary[monthlySummary.length - 1] || {};
        const prevMonth = monthlySummary[monthlySummary.length - 2] || {};
        
        const incomeDelta = prevMonth.income > 0 
            ? ((latest.income - prevMonth.income) / prevMonth.income * 100).toFixed(1) 
            : 0;
        const expenseDelta = prevMonth.expense > 0 
            ? ((latest.expense - prevMonth.expense) / prevMonth.expense * 100).toFixed(1)
            : 0;
            
        const netCashflow = (latest.income || 0) - (latest.expense || 0);

        let html = `
            <!-- Agent Executive Briefing Banner -->
            <div class="agent-banner">
                <div class="agent-banner-left">
                    <div class="agent-badge-icon">
                        ${icon('shieldCheck', 22)}
                    </div>
                    <div>
                        <div class="agent-status-tag">
                            <span class="pulse-dot"></span>
                            Continuous Monitoring Active
                        </div>
                        <div class="agent-banner-title">
                            Monitoring Account Portfolio: Priya Sharma
                        </div>
                        <div class="agent-banner-meta">
                            245 transactions indexed across 3 linked institutions · 6-month historical baseline
                        </div>
                    </div>
                </div>
                <div class="flex items-center gap-1">
                    <button class="btn btn-secondary btn-sm" onclick="navigateTo('scenarios')">
                        ${icon('sliders', 13)}
                        Run What-If Simulator
                    </button>
                </div>
            </div>

            <!-- Core Financial KPIs -->
            <div class="stats-grid">
                <!-- Liquid Balance -->
                <div class="stat-card">
                    <div class="stat-header">
                        <span class="stat-label">Net Liquid Balance</span>
                        <span class="stat-icon">${icon('receipt', 15)}</span>
                    </div>
                    <div class="stat-value">${formatCurrency(data.balance)}</div>
                    <div class="stat-subtext ${netCashflow >= 0 ? 'positive' : 'negative'}">
                        ${icon(netCashflow >= 0 ? 'trendingUp' : 'trendingDown', 13)}
                        ${netCashflow >= 0 ? '+' : ''}${formatCurrency(netCashflow)} net this month
                    </div>
                </div>

                <!-- Monthly Inflow -->
                <div class="stat-card">
                    <div class="stat-header">
                        <span class="stat-label">Monthly Inflow</span>
                        <span class="stat-icon" style="color:var(--emerald)">${icon('arrowDownRight', 15)}</span>
                    </div>
                    <div class="stat-value">${formatCurrency(latest.income || 0)}</div>
                    <div class="stat-subtext positive">
                        Baseline salary confirmed (₹85k/mo)
                    </div>
                </div>

                <!-- Monthly Outflow / Burn -->
                <div class="stat-card">
                    <div class="stat-header">
                        <span class="stat-label">Monthly Outflow</span>
                        <span class="stat-icon" style="color:var(--rose)">${icon('arrowUpRight', 15)}</span>
                    </div>
                    <div class="stat-value">${formatCurrency(latest.expense || 0)}</div>
                    <div class="stat-subtext ${expenseDelta <= 0 ? 'positive' : 'negative'}">
                        ${expenseDelta <= 0 ? '↓ ' + Math.abs(expenseDelta) + '% lower burn vs last mo' : '↑ ' + Math.abs(expenseDelta) + '% increase vs last mo'}
                    </div>
                </div>

                <!-- Approval Gate Status (Core Differentiator) -->
                <div class="stat-card" style="border-left:3px solid var(--amber)">
                    <div class="stat-header">
                        <span class="stat-label">Approval Gate Barrier</span>
                        <span class="stat-icon" style="color:var(--amber)">${icon('lock', 15)}</span>
                    </div>
                    <div class="stat-value" style="color:var(--amber)">${data.pending_actions_count || 0} Blocked</div>
                    <div class="stat-subtext warning" style="cursor:pointer" onclick="navigateTo('approval')">
                        ${icon('alertTriangle', 13)}
                        <span>Requires human sign-off →</span>
                    </div>
                </div>
            </div>

            <!-- High-Impact Approval Banner (When actions are pending) -->
            ${(data.pending_actions_count || 0) > 0 ? `
                <div class="guard-alert-banner">
                    <div class="guard-alert-left">
                        <div class="guard-alert-icon">
                            ${icon('shieldAlert', 22)}
                        </div>
                        <div>
                            <div class="guard-alert-title">
                                Autonomous Execution Barrier: ${data.pending_actions_count} Decisions Held
                            </div>
                            <div class="guard-alert-desc">
                                FinGuard detected recurring price hikes and budget imbalances. The agent is strictly <strong>blocked from moving funds</strong> or altering recurring commitments until you explicitly approve them.
                            </div>
                        </div>
                    </div>
                    <button class="btn btn-warning btn-sm" onclick="navigateTo('approval')">
                        ${icon('lock', 13)}
                        Review Gate Actions
                    </button>
                </div>
            ` : ''}

            <!-- Charts Row -->
            <div class="charts-grid">
                <!-- Inflow vs Outflow -->
                <div class="card">
                    <div class="card-header">
                        <div>
                            <div class="card-title">Cash Inflow vs Outflow</div>
                            <div class="card-subtitle">6-month verified trajectory</div>
                        </div>
                        <span class="badge badge-low">Monthly Aggregate</span>
                    </div>
                    <div class="chart-container">
                        <canvas id="chart-income-expense"></canvas>
                    </div>
                </div>

                <!-- Spending by Category -->
                <div class="card">
                    <div class="card-header">
                        <div>
                            <div class="card-title">Expense Allocation</div>
                            <div class="card-subtitle">${data.current_month || 'Current Cycle'} breakdown</div>
                        </div>
                        <span class="badge badge-low">11 Categories</span>
                    </div>
                    <div class="chart-container">
                        <canvas id="chart-categories"></canvas>
                    </div>
                </div>
            </div>

            <!-- Budget Health & Goals Grid -->
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(380px,1fr));gap:16px;margin-bottom:20px">
                <!-- Budget vs Actual -->
                <div class="card">
                    <div class="card-header">
                        <div>
                            <div class="card-title">Budget Health & Category Limits</div>
                            <div class="card-subtitle">Active consumption against monthly caps</div>
                        </div>
                    </div>
                    <div style="display:flex;flex-direction:column;gap:12px">
                        ${categoryBreakdown
                            .filter(c => c.budget != null)
                            .map(c => {
                                const pct = c.percentage || 0;
                                const barClass = pct >= 115 ? 'danger' : pct >= 85 ? 'warning' : 'good';
                                const badgeClass = pct >= 100 ? 'badge-high' : pct >= 85 ? 'badge-medium' : 'badge-success';
                                return `
                                    <div>
                                        <div class="flex justify-between items-center" style="font-size:12.5px">
                                            <span style="font-weight:600;color:var(--text-primary)">${c.category}</span>
                                            <div class="flex items-center gap-1">
                                                <span style="color:var(--text-tertiary)">${formatCurrency(c.spent)} / ${formatCurrency(c.budget)}</span>
                                                <span class="badge ${badgeClass}">${pct.toFixed(0)}%</span>
                                            </div>
                                        </div>
                                        <div class="progress-bar">
                                            <div class="progress-fill ${barClass}" style="width:${Math.min(100, pct)}%"></div>
                                        </div>
                                    </div>
                                `;
                            }).join('')}
                    </div>
                </div>

                <!-- Financial Goals & Runway -->
                <div class="card">
                    <div class="card-header">
                        <div>
                            <div class="card-title">Target Commitments & Reserves</div>
                            <div class="card-subtitle">Tracked capital allocation targets</div>
                        </div>
                    </div>
                    <div style="display:flex;flex-direction:column;gap:14px">
                        ${goals.map(g => {
                            const pct = g.target_amount > 0 ? (g.current_amount / g.target_amount * 100) : 0;
                            return `
                                <div style="background:var(--bg-table-header);border:1px solid var(--border-subtle);border-radius:var(--radius-sm);padding:14px">
                                    <div class="flex justify-between items-center mb-1">
                                        <div>
                                            <div style="font-weight:600;font-size:13.5px;color:var(--text-primary)">${g.name}</div>
                                            <div style="font-size:11.5px;color:var(--text-tertiary)">
                                                Target Deadline: ${formatDate(g.deadline)} · ₹${(g.monthly_contribution || 0).toLocaleString()}/mo SIP
                                            </div>
                                        </div>
                                        <div style="text-align:right">
                                            <div style="font-size:14px;font-weight:700;color:var(--text-primary)">${formatCurrency(g.current_amount)}</div>
                                            <div style="font-size:11px;color:var(--text-tertiary)">of ${formatCurrency(g.target_amount)}</div>
                                        </div>
                                    </div>
                                    <div class="progress-bar">
                                        <div class="progress-fill good" style="width:${Math.min(100, pct)}%"></div>
                                    </div>
                                </div>
                            `;
                        }).join('')}

                        <!-- Quick Scenario Simulation Action -->
                        <div style="padding:14px;background:var(--brand-subtle);border:1px solid rgba(79,107,255,0.2);border-radius:var(--radius-sm);display:flex;align-items:center;justify-content:space-between;gap:12px">
                            <div>
                                <div style="font-size:12.5px;font-weight:600;color:var(--text-primary)">Emergency Runway Estimate</div>
                                <div style="font-size:11.5px;color:var(--text-secondary)">Current liquid reserves support 1.8 months of baseline fixed costs.</div>
                            </div>
                            <button class="btn btn-primary btn-sm" onclick="navigateTo('scenarios')">
                                Simulate
                            </button>
                        </div>
                    </div>
                </div>
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
        showEmpty(container, 'alertTriangle', 'Failed to load dashboard', e.message);
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
                    label: 'Inflow (Salary & Returns)',
                    data: monthly.map(m => m.income),
                    backgroundColor: 'rgba(16, 185, 129, 0.75)',
                    borderColor: '#10B981',
                    borderWidth: 1,
                    borderRadius: 4,
                    barPercentage: 0.65,
                },
                {
                    label: 'Outflow (Expenses & Burn)',
                    data: monthly.map(m => m.expense),
                    backgroundColor: 'rgba(244, 63, 94, 0.65)',
                    borderColor: '#F43F5E',
                    borderWidth: 1,
                    borderRadius: 4,
                    barPercentage: 0.65,
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
                    labels: { boxWidth: 8, padding: 14 }
                },
                tooltip: {
                    callbacks: {
                        label: ctx => ` ${ctx.dataset.label.split(' ')[0]}: ${formatCurrency(ctx.raw)}`,
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: v => formatCurrency(v),
                        maxTicksLimit: 5,
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
        '#4F6BFF', '#0EA5E9', '#10B981', '#F59E0B', '#F43F5E',
        '#8B5CF6', '#EC4899', '#14B8A6', '#F97316', '#64748B',
    ];

    const filtered = categories.filter(c => c.category && c.spent > 0);

    getOrCreateChart('chart-categories', {
        type: 'doughnut',
        data: {
            labels: filtered.map(c => c.category),
            datasets: [{
                data: filtered.map(c => c.spent),
                backgroundColor: catColors.slice(0, filtered.length),
                borderWidth: 2,
                borderColor: '#121622',
                hoverOffset: 6,
            }],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '68%',
            plugins: {
                legend: {
                    position: 'right',
                    labels: { 
                        padding: 10, 
                        font: { size: 11 },
                        generateLabels: (chart) => {
                            const data = chart.data;
                            return data.labels.map((label, i) => {
                                const val = data.datasets[0].data[i];
                                return {
                                    text: `${label}: ${formatCurrency(val)}`,
                                    fillStyle: data.datasets[0].backgroundColor[i],
                                    hidden: isNaN(val),
                                    index: i
                                };
                            });
                        }
                    },
                },
                tooltip: {
                    callbacks: {
                        label: ctx => ` ${ctx.label}: ${formatCurrency(ctx.raw)}`,
                    },
                },
            },
        },
    });
}

// Export to window
window.renderDashboard = renderDashboard;
