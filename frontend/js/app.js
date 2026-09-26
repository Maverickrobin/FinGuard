/* ═══════════════════════════════════════════════════════════
   FinGuard App — Main controller, router, utilities
   ═══════════════════════════════════════════════════════════ */

const API = '';  // Same origin

// ─── Utility functions ──────────────────────────────────────
function formatCurrency(amount) {
    if (amount == null || isNaN(amount)) return '₹0';
    const abs = Math.abs(amount);
    if (abs >= 10000000) return '₹' + (amount / 10000000).toFixed(2) + ' Cr';
    if (abs >= 100000) return '₹' + (amount / 100000).toFixed(2) + ' L';
    return '₹' + amount.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDateTime(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

async function apiGet(path) {
    const res = await fetch(API + path);
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return res.json();
}

async function apiPost(path, body = {}) {
    const res = await fetch(API + path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(typeof err.detail === 'string' ? err.detail : JSON.stringify(err.detail));
    }
    return res.json();
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(20px)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

function showLoading(container) {
    container.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
}

function showEmpty(container, icon, text, hint = '') {
    container.innerHTML = `
        <div class="empty-state">
            <div class="empty-state-icon">${icon}</div>
            <div class="empty-state-text">${text}</div>
            ${hint ? `<div class="empty-state-hint">${hint}</div>` : ''}
        </div>
    `;
}

// ─── Chart theme ────────────────────────────────────────────
const CHART_COLORS = {
    primary: '#6366f1',
    primaryLight: '#818cf8',
    secondary: '#22d3ee',
    success: '#34d399',
    warning: '#fbbf24',
    danger: '#f87171',
    info: '#60a5fa',
    grid: 'rgba(148, 163, 184, 0.08)',
    text: '#94a3b8',
};

if (typeof Chart !== 'undefined') {
    Chart.defaults.color = CHART_COLORS.text;
    Chart.defaults.borderColor = CHART_COLORS.grid;
    Chart.defaults.font.family = "'Inter', sans-serif";
    Chart.defaults.font.size = 12;
    Chart.defaults.plugins.legend.labels.usePointStyle = true;
    Chart.defaults.plugins.legend.labels.pointStyleWidth = 8;
    Chart.defaults.animation.duration = 600;
}

// Destroy chart by canvas ID if it exists
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

// Export all core utilities to window for view modules
window.API = API;
window.formatCurrency = formatCurrency;
window.formatDate = formatDate;
window.formatDateTime = formatDateTime;
window.apiGet = apiGet;
window.apiPost = apiPost;
window.showToast = showToast;
window.showLoading = showLoading;
window.showEmpty = showEmpty;
window.CHART_COLORS = CHART_COLORS;
window.getOrCreateChart = getOrCreateChart;

// ─── Router ─────────────────────────────────────────────────
const views = {
    dashboard: { title: 'Dashboard', render: (c) => window.renderDashboard(c) },
    transactions: { title: 'Transactions', render: (c) => window.renderTransactions(c) },
    analysis: { title: 'Anomalies & Forecast', render: (c) => window.renderAnalysis(c) },
    scenarios: { title: 'Scenario Simulator', render: (c) => window.renderScenarios(c) },
    recommendations: { title: 'Recommendations', render: (c) => window.renderRecommendations(c) },
    approval: { title: 'Approval Gate', render: (c) => window.renderApproval(c) },
    audit: { title: 'Audit Trail', render: (c) => renderAudit(c) },
};

let currentView = 'dashboard';

async function navigateTo(viewName) {
    if (!views[viewName]) return;
    
    currentView = viewName;
    
    // Update nav
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.toggle('active', link.dataset.view === viewName);
    });
    
    // Update title
    const titleEl = document.getElementById('page-title');
    if (titleEl) titleEl.textContent = views[viewName].title;
    
    // Render view
    const container = document.getElementById('view-container');
    showLoading(container);
    
    try {
        await views[viewName].render(container);
    } catch (e) {
        console.error('View render error:', e);
        container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">⚠️</div><div class="empty-state-text">Error loading view</div><div class="empty-state-hint">${e.message || ''}</div></div>`;
    }
    
    // Close mobile sidebar
    document.getElementById('sidebar')?.classList.remove('open');
}

// ─── Init ───────────────────────────────────────────────────
let isAppInitialized = false;

function initApp() {
    if (isAppInitialized) return;
    isAppInitialized = true;

    // Nav links
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            navigateTo(link.dataset.view);
        });
    });
    
    // Mobile menu
    document.getElementById('menu-toggle')?.addEventListener('click', () => {
        document.getElementById('sidebar')?.classList.toggle('open');
    });
    
    // Run analysis button
    document.getElementById('btn-run-analysis')?.addEventListener('click', async () => {
        try {
            showToast('Running analysis pipeline...', 'info');
            
            // Run anomaly detection
            await apiPost('/api/anomalies/detect');
            
            // Generate recommendations
            const result = await apiPost('/api/recommendations/generate');
            
            showToast(`Analysis complete! ${result.count} recommendations generated.`, 'success');
            
            // Update badges
            updateBadges();
            
            // Refresh current view
            navigateTo(currentView);
        } catch (e) {
            showToast('Analysis failed: ' + e.message, 'error');
        }
    });
    
    // Modal close
    document.getElementById('edit-modal-close')?.addEventListener('click', closeModal);
    document.getElementById('edit-modal-cancel')?.addEventListener('click', closeModal);
    document.querySelector('.modal-backdrop')?.addEventListener('click', closeModal);
    
    // Load initial view
    navigateTo('dashboard');
    updateBadges();
}

window.initApp = initApp;

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    setTimeout(initApp, 0);
}

async function updateBadges() {
    try {
        const pending = await apiGet('/api/pending-actions?status=pending');
        const badge = document.getElementById('approval-badge');
        if (pending.count > 0) {
            badge.textContent = pending.count;
            badge.style.display = 'inline-flex';
        } else {
            badge.style.display = 'none';
        }
        
        const recs = await apiGet('/api/recommendations?status=active');
        const recBadge = document.getElementById('rec-badge');
        if (recs.recommendations.length > 0) {
            recBadge.textContent = recs.recommendations.length;
            recBadge.style.display = 'inline-flex';
        } else {
            recBadge.style.display = 'none';
        }
    } catch (e) {
        // Badges are non-critical
    }
}

function closeModal() {
    document.getElementById('edit-modal').style.display = 'none';
}

function openEditModalById(actionId) {
    const action = (window.pendingActionsCache && window.pendingActionsCache[actionId]) || null;
    if (action) {
        openEditModal(action);
    } else {
        apiGet(`/api/pending-actions/${actionId}`)
            .then(act => openEditModal(act))
            .catch(err => showToast('Failed to load action: ' + err.message, 'error'));
    }
}

function openEditModal(action) {
    const modal = document.getElementById('edit-modal');
    const title = document.getElementById('edit-modal-title');
    const body = document.getElementById('edit-modal-body');
    const saveBtn = document.getElementById('edit-modal-save');
    
    title.textContent = `Edit: ${action.title}`;
    
    let params;
    try {
        params = typeof action.original_params === 'string' 
            ? JSON.parse(action.original_params) 
            : action.original_params;
    } catch { params = {}; }
    
    let formHtml = '';
    for (const [key, value] of Object.entries(params)) {
        formHtml += `
            <div class="form-group">
                <label class="form-label">${key.replace(/_/g, ' ')}</label>
                <input class="form-input" name="${key}" value="${value}" 
                       type="${typeof value === 'number' ? 'number' : 'text'}"
                       step="any">
            </div>
        `;
    }
    
    if (action.amount != null) {
        formHtml += `
            <div class="form-group">
                <label class="form-label">Amount (₹)</label>
                <input class="form-input" name="amount" value="${action.amount}" type="number" step="any">
            </div>
        `;
    }
    
    body.innerHTML = formHtml;
    
    saveBtn.onclick = async () => {
        const formData = {};
        body.querySelectorAll('input').forEach(input => {
            formData[input.name] = input.type === 'number' ? parseFloat(input.value) : input.value;
        });
        
        try {
            await apiPost(`/api/pending-actions/${action.id}/edit-approve`, {
                edited_params: formData,
            });
            showToast('Action edited and approved!', 'success');
            closeModal();
            navigateTo(currentView);
            updateBadges();
        } catch (e) {
            showToast('Error: ' + e.message, 'error');
        }
    };
    
    modal.style.display = 'flex';
}

// Render audit view (simple table from audit trail)
async function renderAudit(container) {
    try {
        const data = await apiGet('/api/audit-trail?limit=100');
        
        if (!data.trail || data.trail.length === 0) {
            showEmpty(container, '📋', 'No audit events yet', 'Run the analysis pipeline to generate events.');
            return;
        }
        
        let html = `
            <div class="section-header">
                <h2 class="section-title">Audit Trail</h2>
                <span class="badge badge-low">${data.count} events</span>
            </div>
            <div class="card">
                <div class="audit-timeline">
        `;
        
        for (const event of data.trail) {
            const eventClass = event.event_type.replace(/\s/g, '_');
            html += `
                <div class="audit-event ${eventClass}">
                    <div class="audit-event-type">${event.event_type.replace(/_/g, ' ').toUpperCase()}</div>
                    <div class="audit-event-time">${formatDateTime(event.timestamp)} · Action: ${event.action_id || 'N/A'}</div>
                    ${event.event_data ? `<div class="audit-event-data">${typeof event.event_data === 'object' ? JSON.stringify(event.event_data, null, 2) : event.event_data}</div>` : ''}
                </div>
            `;
        }
        
        html += '</div></div>';
        container.innerHTML = html;
    } catch (e) {
        showEmpty(container, '❌', 'Failed to load audit trail', e.message);
    }
}
