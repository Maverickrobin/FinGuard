/* ══════════════════════════════════════════════════════════════════
   FinGuard App — Main Controller, Router, Utilities & Icon System
   ══════════════════════════════════════════════════════════════════ */

const API = '';  // Same origin

// ─── Precision Vector Icon Library (Zero network dependency) ─────
const ICONS = {
    shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
    shieldCheck: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>',
    shieldAlert: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>',
    lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
    dashboard: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/></svg>',
    receipt: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>',
    activity: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m22 7-8.5 8.5-5-5L2 17"/><path d="M16 7h6v6"/></svg>',
    sliders: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="4" x2="20" y1="21" y2="21"/><line x1="4" x2="20" y1="3" y2="3"/><line x1="4" x2="20" y1="12" y2="12"/><circle cx="8" cy="12" r="2"/><circle cx="16" cy="3" r="2"/><circle cx="12" cy="21" r="2"/></svg>',
    sparkles: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></svg>',
    audit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M15 2H9a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1Z"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/></svg>',
    zap: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
    x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" x2="6" y1="6" y2="18"/><line x1="6" x2="18" y1="6" y2="18"/></svg>',
    edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
    alertTriangle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/></svg>',
    refresh: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 21h5v-5"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" x2="16.65" y1="21" y2="16.65"/></svg>',
    arrowUpRight: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="7" x2="17" y1="17" y2="7"/><polyline points="7 7 17 7 17 17"/></svg>',
    arrowDownRight: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="7" x2="17" y1="7" y2="17"/><polyline points="17 7 17 17 7 17"/></svg>',
    chevronRight: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="16" y2="12"/><line x1="12" x2="12.01" y1="8" y2="8"/></svg>',
    flask: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10 2v7.31L4.2 18.06A2 2 0 0 0 5.86 21h12.28a2 2 0 0 0 1.66-2.94L14 9.31V2Z"/><path d="M8.5 2h7"/><path d="M7 16h10"/></svg>',
    tag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z"/><circle cx="7" cy="7" r=".5" fill="currentColor"/></svg>',
    trendingUp: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>',
    trendingDown: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 17 13.5 8.5 8.5 13.5 2 7"/><polyline points="16 17 22 17 22 11"/></svg>',
};

function icon(name, size = 16, className = '') {
    const raw = ICONS[name] || ICONS.info;
    const styleAttr = `width="${size}" height="${size}"`;
    const classAttr = className ? `class="${className}"` : '';
    return raw.replace('<svg ', `<svg ${styleAttr} ${classAttr} `);
}

// ─── Formatters ─────────────────────────────────────────────
function formatCurrency(amount) {
    if (amount == null || isNaN(amount)) return '₹0';
    const abs = Math.abs(amount);
    if (abs >= 10000000) return '₹' + (amount / 10000000).toFixed(2) + ' Cr';
    if (abs >= 100000) return '₹' + (amount / 100000).toFixed(2) + ' L';
    return '₹' + Math.round(amount).toLocaleString('en-IN');
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDateTime(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function cleanTitle(str) {
    return str ? str.replace(/^[\p{Extended_Pictographic}\u200d\uFE0F\s]+/u, '').trim() : '';
}

function getApiBase() {
    if (typeof window !== 'undefined' && window.API) return window.API;
    return '';
}

// ─── API Fetch Helpers ──────────────────────────────────────
async function apiGet(path) {
    const res = await fetch(getApiBase() + path);
    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(typeof err.detail === 'string' ? err.detail : `HTTP ${res.status}`);
    }
    return res.json();
}

async function apiPost(path, body = {}) {
    const res = await fetch(getApiBase() + path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(typeof err.detail === 'string' ? err.detail : `HTTP ${res.status}`);
    }
    return res.json();
}

// ─── Feedback & Notifications ───────────────────────────────
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const iconName = type === 'success' ? 'check' : type === 'error' ? 'alertTriangle' : type === 'warning' ? 'alertTriangle' : 'info';
    toast.innerHTML = `
        <span style="flex-shrink:0">${icon(iconName, 15)}</span>
        <span style="flex:1">${message}</span>
    `;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(12px) scale(0.96)';
        toast.style.transition = 'all 0.2s ease';
        setTimeout(() => {
            if (typeof toast.remove === 'function') toast.remove();
            else if (toast.parentNode) toast.parentNode.removeChild(toast);
        }, 220);
    }, 4000);
}

function showLoading(container) {
    container.innerHTML = `
        <div class="loading">
            <div class="spinner"></div>
        </div>
    `;
}

function showSkeleton(container) {
    container.innerHTML = `
        <div class="stats-grid">
            <div class="stat-card"><div class="skeleton" style="height:14px;width:40%;margin-bottom:12px"></div><div class="skeleton" style="height:32px;width:70%"></div></div>
            <div class="stat-card"><div class="skeleton" style="height:14px;width:40%;margin-bottom:12px"></div><div class="skeleton" style="height:32px;width:70%"></div></div>
            <div class="stat-card"><div class="skeleton" style="height:14px;width:40%;margin-bottom:12px"></div><div class="skeleton" style="height:32px;width:70%"></div></div>
            <div class="stat-card"><div class="skeleton" style="height:14px;width:40%;margin-bottom:12px"></div><div class="skeleton" style="height:32px;width:70%"></div></div>
        </div>
        <div class="charts-grid">
            <div class="card"><div class="skeleton" style="height:240px"></div></div>
            <div class="card"><div class="skeleton" style="height:240px"></div></div>
        </div>
    `;
}

function showEmpty(container, iconName, text, hint = '') {
    container.innerHTML = `
        <div class="empty-state">
            <div class="empty-state-icon">${icon(iconName, 44)}</div>
            <div class="empty-state-text">${text}</div>
            ${hint ? `<div class="empty-state-hint">${hint}</div>` : ''}
        </div>
    `;
}

// ─── Chart Theme (Institutional Precision) ─────────────────
const CHART_COLORS = {
    brand: '#4F6BFF',
    brandLight: '#7086FF',
    brandSubtle: 'rgba(79, 107, 255, 0.15)',
    success: '#10B981',
    successSubtle: 'rgba(16, 185, 129, 0.15)',
    danger: '#F43F5E',
    dangerSubtle: 'rgba(244, 63, 94, 0.15)',
    warning: '#F59E0B',
    info: '#0EA5E9',
    grid: 'rgba(255, 255, 255, 0.05)',
    text: '#94A3B8',
};

if (typeof Chart !== 'undefined' && Chart.defaults) {
    Chart.defaults.color = CHART_COLORS.text;
    Chart.defaults.borderColor = CHART_COLORS.grid;
    Chart.defaults.font = Chart.defaults.font || {};
    Chart.defaults.font.family = "'Inter', -apple-system, sans-serif";
    Chart.defaults.font.size = 11;
    if (Chart.defaults.plugins && Chart.defaults.plugins.legend && Chart.defaults.plugins.legend.labels) {
        Chart.defaults.plugins.legend.labels.usePointStyle = true;
        Chart.defaults.plugins.legend.labels.pointStyleWidth = 7;
        Chart.defaults.plugins.legend.labels.boxHeight = 7;
    }
    if (Chart.defaults.animation) {
        Chart.defaults.animation.duration = 400;
    }
}

const chartInstances = {};
function getOrCreateChart(canvasId, config) {
    if (typeof Chart === 'undefined') {
        console.warn('Chart.js is not loaded, skipping chart for ' + canvasId);
        return null;
    }
    if (chartInstances[canvasId]) {
        chartInstances[canvasId].destroy();
    }
    const ctx = document.getElementById(canvasId);
    if (!ctx) return null;
    chartInstances[canvasId] = new Chart(ctx, config);
    return chartInstances[canvasId];
}

// ─── Router ─────────────────────────────────────────────────
const views = {
    dashboard: { title: 'Dashboard', render: (c) => window.renderDashboard(c) },
    transactions: { title: 'Ledger & Activity', render: (c) => window.renderTransactions(c) },
    analysis: { title: 'Anomalies & Forecast', render: (c) => window.renderAnalysis(c) },
    scenarios: { title: 'What-If Simulator', render: (c) => window.renderScenarios(c) },
    recommendations: { title: 'Recommendations', render: (c) => window.renderRecommendations(c) },
    approval: { title: 'Approval Gate', render: (c) => window.renderApproval(c) },
    audit: { title: 'Audit Trail', render: (c) => renderAudit(c) },
};

let currentView = 'dashboard';

async function navigateTo(viewName) {
    if (!views[viewName]) viewName = 'dashboard';
    currentView = viewName;
    
    // Update active nav styling
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.toggle('active', link.dataset.view === viewName);
    });
    
    // Update page title
    const titleEl = document.getElementById('page-title');
    if (titleEl) titleEl.textContent = views[viewName].title;
    
    // Render view inside container
    const container = document.getElementById('view-container');
    if (container) {
        try {
            showSkeleton(container);
            await views[viewName].render(container);
        } catch (e) {
            console.error('Error rendering view ' + viewName + ':', e);
            showEmpty(container, 'alertTriangle', 'Failed to load ' + views[viewName].title, e.message);
        }
    }
    
    // Close mobile drawer if open
    closeMobileDrawer();
}

function closeMobileDrawer() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if (sidebar) sidebar.classList.remove('open');
    if (overlay) overlay.classList.remove('active');
}

// ─── Global Badges Counter ──────────────────────────────────
async function updateBadges() {
    try {
        const [recs, actions] = await Promise.all([
            apiGet('/api/recommendations'),
            apiGet('/api/pending-actions'),
        ]);
        
        const recBadge = document.getElementById('rec-badge');
        if (recBadge) {
            const activeRecs = (recs.recommendations || []).filter(r => r.status === 'active');
            if (activeRecs.length > 0) {
                recBadge.textContent = activeRecs.length;
                recBadge.style.display = 'inline-block';
            } else {
                recBadge.style.display = 'none';
            }
        }
        
        const approvalBadge = document.getElementById('approval-badge');
        if (approvalBadge) {
            const pendingActions = (actions.actions || []).filter(a => a.status === 'pending');
            if (pendingActions.length > 0) {
                approvalBadge.textContent = pendingActions.length;
                approvalBadge.style.display = 'inline-block';
            } else {
                approvalBadge.style.display = 'none';
            }
        }
    } catch (e) {
        console.warn('Error updating badges:', e);
    }
}

// ─── Edit Action Modal ──────────────────────────────────────
function openEditModalById(actionId) {
    const action = window.pendingActionsCache?.[actionId];
    if (!action) {
        showToast('Action details not found in cache. Refreshing view...', 'warning');
        return;
    }
    openEditModal(action);
}

function openEditModal(action) {
    const modal = document.getElementById('edit-modal');
    const body = document.getElementById('edit-modal-body');
    const title = document.getElementById('edit-modal-title');
    
    title.textContent = `Edit Parameters: ${action.title}`;
    
    let params;
    try {
        params = typeof action.original_params === 'string' 
            ? JSON.parse(action.original_params) : (action.original_params || {});
    } catch { params = {}; }
    
    let formHtml = `
        <div class="form-group">
            <label class="form-label" for="edit-amount">Authorized Amount (₹)</label>
            <input class="form-input" type="number" id="edit-amount" 
                   value="${action.amount || ''}" step="100" min="0" placeholder="e.g. 5000">
        </div>
    `;
    
    for (const [key, val] of Object.entries(params)) {
        formHtml += `
            <div class="form-group">
                <label class="form-label" for="param-${key}">${key.replace(/_/g, ' ')}</label>
                <input class="form-input" type="text" id="param-${key}" 
                       data-param="${key}" value="${val}">
            </div>
        `;
    }
    
    body.innerHTML = formHtml;
    
    document.getElementById('edit-modal-save').onclick = async () => {
        const newAmount = parseFloat(document.getElementById('edit-amount').value);
        const newParams = {};
        
        body.querySelectorAll('[data-param]').forEach(input => {
            const key = input.dataset.param;
            let val = input.value;
            if (!isNaN(val) && val !== '') val = Number(val);
            newParams[key] = val;
        });
        
        try {
            await apiPost(`/api/pending-actions/${action.id}/edit`, {
                amount: isNaN(newAmount) ? null : newAmount,
                params: newParams,
            });
            showToast('Parameters updated & authorized!', 'success');
            modal.style.display = 'none';
            navigateTo('approval');
            updateBadges();
        } catch (e) {
            showToast('Error saving: ' + e.message, 'error');
        }
    };
    
    modal.style.display = 'flex';
}

// ─── Institutional Audit Trail View ─────────────────────────
async function renderAudit(container) {
    try {
        const data = await apiGet('/api/audit-trail?limit=100');
        
        if (!data.trail || data.trail.length === 0) {
            showEmpty(container, 'audit', 'No audit events recorded yet', 'Run the analysis pipeline or execute actions to populate the cryptographic audit log.');
            return;
        }
        
        let html = `
            <div class="section-header">
                <div>
                    <h2 class="section-title">Cryptographic Decision Audit Ledger</h2>
                    <div class="card-subtitle">Append-only, immutable record of every autonomous proposal, human gate decision, and execution outcome.</div>
                </div>
                <span class="badge badge-low">${data.count} Events Recorded</span>
            </div>
            <div class="card">
                <div class="audit-timeline">
        `;
        
        for (const event of data.trail) {
            const isBlocked = event.event_type === 'execution_blocked';
            const isApproved = event.event_type === 'approved';
            const isRejected = event.event_type === 'rejected';
            const isExecuted = event.event_type === 'executed_successfully';
            
            const badgeClass = isBlocked ? 'badge-high' : isApproved ? 'badge-success' : isRejected ? 'badge-rejected' : isExecuted ? 'badge-executed' : 'badge-low';
            
            html += `
                <div class="audit-event ${event.event_type}">
                    <div class="audit-event-header">
                        <div class="flex items-center gap-1">
                            <span class="badge ${badgeClass}">${event.event_type.replace(/_/g, ' ').toUpperCase()}</span>
                            ${event.action_id ? `<span style="font-size:11px;color:var(--text-tertiary);font-family:monospace">#${event.action_id}</span>` : ''}
                        </div>
                        <div class="audit-event-time">${formatDateTime(event.timestamp)}</div>
                    </div>
                    ${event.event_data ? `
                        <div class="audit-event-data">${typeof event.event_data === 'object' ? JSON.stringify(event.event_data, null, 2) : event.event_data}</div>
                    ` : ''}
                </div>
            `;
        }
        
        html += '</div></div>';
        container.innerHTML = html;
    } catch (e) {
        showEmpty(container, 'alertTriangle', 'Failed to load audit ledger', e.message);
    }
}

// ─── Application Bootstrap ──────────────────────────────────
function initApp() {
    // Navigation click listeners
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const view = link.dataset.view;
            if (view) navigateTo(view);
        });
    });
    
    // Mobile Drawer Toggle
    const menuBtn = document.getElementById('menu-toggle');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    
    if (menuBtn && sidebar && overlay) {
        menuBtn.addEventListener('click', () => {
            sidebar.classList.toggle('open');
            overlay.classList.toggle('active');
        });
        overlay.addEventListener('click', closeMobileDrawer);
    }
    
    // Top-bar Run Analysis button
    const runBtn = document.getElementById('btn-run-analysis');
    if (runBtn) {
        runBtn.addEventListener('click', async () => {
            const originalText = runBtn.innerHTML;
            runBtn.disabled = true;
            runBtn.innerHTML = `${icon('refresh', 14)} Running models...`;
            
            try {
                const result = await apiPost('/api/anomalies/detect');
                const recResult = await apiPost('/api/recommendations/generate').catch(() => ({}));
                showToast(`Pipeline complete: ${result.anomalies?.length || 0} anomalies evaluated · Action barriers updated`, 'success');
                
                // Refresh current view & badges
                navigateTo(currentView);
                updateBadges();
            } catch (e) {
                showToast('Analysis error: ' + e.message, 'error');
            } finally {
                runBtn.disabled = false;
                runBtn.innerHTML = originalText;
            }
        });
    }
    
    // Modal Close handlers
    const modal = document.getElementById('edit-modal');
    const modalClose = document.getElementById('edit-modal-close');
    const modalCancel = document.getElementById('edit-modal-cancel');
    const modalBackdrop = document.getElementById('edit-modal-backdrop');
    
    if (modal) {
        if (modalClose) modalClose.addEventListener('click', () => modal.style.display = 'none');
        if (modalCancel) modalCancel.addEventListener('click', () => modal.style.display = 'none');
        if (modalBackdrop) modalBackdrop.addEventListener('click', () => modal.style.display = 'none');
    }
    
    // Keyboard Shortcuts
    document.addEventListener('keydown', (e) => {
        // Esc closes modal
        if (e.key === 'Escape' && modal && modal.style.display === 'flex') {
            modal.style.display = 'none';
            return;
        }
        
        // Don't trigger number shortcuts if typing in input/textarea/select
        if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;
        
        const keyMap = {
            '1': 'dashboard',
            '2': 'transactions',
            '3': 'analysis',
            '4': 'scenarios',
            '5': 'recommendations',
            '6': 'approval',
            '7': 'audit',
        };
        
        if (keyMap[e.key]) {
            navigateTo(keyMap[e.key]);
        }
    });
    
    // Load initial view & counters
    navigateTo('dashboard');
    updateBadges();
}

// ─── Exports for Global View Modules ────────────────────────
window.API = window.API || API;
window.icon = icon;
window.formatCurrency = formatCurrency;
window.formatDate = formatDate;
window.formatDateTime = formatDateTime;
window.cleanTitle = cleanTitle;
window.apiGet = apiGet;
window.apiPost = apiPost;
window.showToast = showToast;
window.showLoading = showLoading;
window.showSkeleton = showSkeleton;
window.showEmpty = showEmpty;
window.CHART_COLORS = CHART_COLORS;
window.getOrCreateChart = getOrCreateChart;
window.navigateTo = navigateTo;
window.updateBadges = updateBadges;
window.openEditModalById = openEditModalById;
window.initApp = initApp;

// Auto-run if DOM is already parsed
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(initApp, 10);
} else {
    document.addEventListener('DOMContentLoaded', initApp);
}
