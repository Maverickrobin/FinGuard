/* ══════════════════════════════════════════════════════════════════
   FinGuard Recommendations View — Autonomous Intelligence Feed
   Categorized by impact level and governance barrier.
   ══════════════════════════════════════════════════════════════════ */

async function renderRecommendations(container) {
    try {
        const data = await apiGet('/api/recommendations');
        const recs = data.recommendations || [];

        if (recs.length === 0) {
            container.innerHTML = `
                <div class="card">
                    <div class="empty-state">
                        <div class="empty-state-icon">${icon('sparkles', 44)}</div>
                        <div class="empty-state-text">No Recommendations Generated Yet</div>
                        <div class="empty-state-hint">Run the continuous analysis pipeline to evaluate transaction history and trigger actions.</div>
                        <button class="btn btn-primary mt-2" onclick="runRecommendations()">
                            ${icon('zap', 13)}
                            Evaluate & Generate
                        </button>
                    </div>
                </div>
            `;
            return;
        }

        // Group by impact level
        const high = recs.filter(r => r.impact_level === 'high');
        const medium = recs.filter(r => r.impact_level === 'medium');
        const low = recs.filter(r => r.impact_level === 'low');

        let html = `
            <div class="section-header">
                <div>
                    <h2 class="section-title">Autonomous Financial Recommendations</h2>
                    <div class="card-subtitle">Synthesized from anomaly detection, discretionary variance, and budget boundaries.</div>
                </div>
                <div class="flex items-center gap-1">
                    <button class="btn btn-secondary btn-sm" onclick="runRecommendations()">
                        ${icon('refresh', 13)}
                        Re-evaluate Models
                    </button>
                </div>
            </div>

            <!-- Impact Distribution Stats -->
            <div class="stats-grid">
                <div class="stat-card" style="border-left:3px solid var(--rose)">
                    <div class="stat-header">
                        <span class="stat-label">High Impact</span>
                        <span class="stat-icon" style="color:var(--rose)">${icon('lock', 14)}</span>
                    </div>
                    <div class="stat-value" style="color:var(--rose)">${high.length}</div>
                    <div class="stat-subtext">Requires human approval</div>
                </div>
                <div class="stat-card" style="border-left:3px solid var(--amber)">
                    <div class="stat-header">
                        <span class="stat-label">Medium Impact</span>
                        <span class="stat-icon" style="color:var(--amber)">${icon('alertTriangle', 14)}</span>
                    </div>
                    <div class="stat-value" style="color:var(--amber)">${medium.length}</div>
                    <div class="stat-subtext">Budget cap adjustments</div>
                </div>
                <div class="stat-card">
                    <div class="stat-header">
                        <span class="stat-label">Insights</span>
                        <span class="stat-icon" style="color:var(--sky)">${icon('info', 14)}</span>
                    </div>
                    <div class="stat-value">${low.length}</div>
                    <div class="stat-subtext">Informational guidance</div>
                </div>
            </div>
        `;

        // High impact section
        if (high.length > 0) {
            html += `
                <div class="section-header mt-2 mb-1">
                    <span style="font-size:12px;font-weight:700;color:var(--rose-light);text-transform:uppercase;letter-spacing:0.04em">
                        High Impact · Governed by Approval Gate (${high.length})
                    </span>
                </div>
            `;
            html += high.map(r => renderRecCard(r)).join('');
        }

        // Medium impact section
        if (medium.length > 0) {
            html += `
                <div class="section-header mt-3 mb-1">
                    <span style="font-size:12px;font-weight:700;color:var(--amber-light);text-transform:uppercase;letter-spacing:0.04em">
                        Medium Impact · Discretionary Adjustments (${medium.length})
                    </span>
                </div>
            `;
            html += medium.map(r => renderRecCard(r)).join('');
        }

        // Low impact section
        if (low.length > 0) {
            html += `
                <div class="section-header mt-3 mb-1">
                    <span style="font-size:12px;font-weight:700;color:var(--sky-light);text-transform:uppercase;letter-spacing:0.04em">
                        Low Impact · Advisory Insights (${low.length})
                    </span>
                </div>
            `;
            html += low.map(r => renderRecCard(r)).join('');
        }

        container.innerHTML = html;

    } catch (e) {
        showEmpty(container, 'alertTriangle', 'Failed to load recommendations', e.message);
    }
}

function renderRecCard(rec) {
    const isHigh = rec.impact_level === 'high';
    const isMedium = rec.impact_level === 'medium';
    const badgeClass = isHigh ? 'badge-high' : isMedium ? 'badge-medium' : 'badge-low';

    return `
        <div class="rec-card ${rec.impact_level}">
            <div class="flex justify-between items-center mb-1">
                <div class="flex items-center gap-1">
                    <span style="font-size:14px;font-weight:600;color:var(--text-primary)">${cleanTitle(rec.title)}</span>
                    <span class="badge ${badgeClass}">${rec.impact_level.toUpperCase()}</span>
                    <span class="badge ${rec.status === 'active' ? 'badge-low' : 'badge-success'}">${rec.status.toUpperCase()}</span>
                </div>
                <span style="font-size:11px;color:var(--text-tertiary)">
                    Trigger: <code>${rec.trigger_type}</code>
                </span>
            </div>
            <p style="font-size:13px;color:var(--text-secondary);margin:8px 0;line-height:1.55">
                ${rec.description}
            </p>
            ${isHigh ? `
                <div style="margin-top:12px;padding-top:10px;border-top:1px solid var(--border-subtle)">
                    <button class="btn btn-warning btn-sm" onclick="navigateTo('approval')">
                        ${icon('lock', 12)}
                        Review in Approval Gate →
                    </button>
                </div>
            ` : ''}
            ${isMedium && rec.status === 'active' ? `
                <div style="margin-top:12px;display:flex;gap:8px;padding-top:10px;border-top:1px solid var(--border-subtle)">
                    <button class="btn btn-success btn-sm" onclick="acceptRec('${rec.id}')">
                        ${icon('check', 12)} Accept Adjustment
                    </button>
                    <button class="btn btn-ghost btn-sm" onclick="dismissRec('${rec.id}')">
                        ${icon('x', 12)} Dismiss
                    </button>
                </div>
            ` : ''}
        </div>
    `;
}

async function runRecommendations() {
    try {
        showToast('Running anomaly pipeline & recommendation engine...', 'info');
        await apiPost('/api/anomalies/detect');
        await apiPost('/api/recommendations/generate');
        showToast('Recommendations refreshed successfully.', 'success');
        renderRecommendations(document.getElementById('view-container'));
        updateBadges();
    } catch (e) {
        showToast('Error: ' + e.message, 'error');
    }
}

async function acceptRec(recId) {
    try {
        await apiPost(`/api/recommendations/${recId}/accept`);
        showToast('Recommendation accepted.', 'success');
        renderRecommendations(document.getElementById('view-container'));
        updateBadges();
    } catch (e) {
        showToast('Error: ' + e.message, 'error');
    }
}

async function dismissRec(recId) {
    try {
        await apiPost(`/api/recommendations/${recId}/dismiss`);
        showToast('Recommendation dismissed.', 'info');
        renderRecommendations(document.getElementById('view-container'));
        updateBadges();
    } catch (e) {
        showToast('Error: ' + e.message, 'error');
    }
}

// Exports
window.renderRecommendations = renderRecommendations;
window.runRecommendations = runRecommendations;
window.acceptRec = acceptRec;
window.dismissRec = dismissRec;
