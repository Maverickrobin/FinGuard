/* Recommendations View */
async function renderRecommendations(container) {
    try {
        const data = await apiGet('/api/recommendations');
        const recs = data.recommendations || [];

        if (recs.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">💡</div>
                    <div class="empty-state-text">No recommendations yet</div>
                    <div class="empty-state-hint">Click "⚡ Run Analysis" in the top bar to generate recommendations.</div>
                    <button class="btn btn-primary mt-2" onclick="runRecommendations()">Generate Recommendations</button>
                </div>
            `;
            return;
        }

        // Group by impact level
        const high = recs.filter(r => r.impact_level === 'high');
        const medium = recs.filter(r => r.impact_level === 'medium');
        const low = recs.filter(r => r.impact_level === 'low');

        let html = `
            <div class="section-header mb-2">
                <h2 class="section-title">${recs.length} Recommendations</h2>
                <button class="btn btn-secondary btn-sm" onclick="runRecommendations()">🔄 Refresh</button>
            </div>

            <div class="stats-grid mb-3">
                <div class="stat-card accent-danger">
                    <div class="stat-label">High Impact</div>
                    <div class="stat-value">${high.length}</div>
                    <div class="stat-change">Requires approval</div>
                </div>
                <div class="stat-card accent-warning">
                    <div class="stat-label">Medium Impact</div>
                    <div class="stat-value">${medium.length}</div>
                    <div class="stat-change">Accept or dismiss</div>
                </div>
                <div class="stat-card accent-info">
                    <div class="stat-label">Low Impact</div>
                    <div class="stat-value">${low.length}</div>
                    <div class="stat-change">Informational</div>
                </div>
            </div>
        `;

        // High impact
        if (high.length > 0) {
            html += `<h3 style="color:var(--accent-danger);font-size:14px;margin-bottom:12px;text-transform:uppercase;letter-spacing:0.5px">🔴 High Impact — Requires Human Approval</h3>`;
            html += high.map(r => renderRecCard(r)).join('');
        }

        // Medium impact
        if (medium.length > 0) {
            html += `<h3 style="color:var(--accent-warning);font-size:14px;margin:20px 0 12px;text-transform:uppercase;letter-spacing:0.5px">🟡 Medium Impact</h3>`;
            html += medium.map(r => renderRecCard(r)).join('');
        }

        // Low impact
        if (low.length > 0) {
            html += `<h3 style="color:var(--accent-info);font-size:14px;margin:20px 0 12px;text-transform:uppercase;letter-spacing:0.5px">🔵 Insights</h3>`;
            html += low.map(r => renderRecCard(r)).join('');
        }

        container.innerHTML = html;

    } catch (e) {
        showEmpty(container, '❌', 'Failed to load recommendations', e.message);
    }
}

function renderRecCard(rec) {
    return `
        <div class="rec-card ${rec.impact_level}">
            <div class="flex justify-between items-center mb-1">
                <div>
                    <span style="font-size:15px;font-weight:700">${rec.title}</span>
                    <span class="badge badge-${rec.impact_level}" style="margin-left:8px">${rec.impact_level}</span>
                    <span class="badge badge-${rec.status === 'active' ? 'pending' : rec.status}" style="margin-left:4px">${rec.status}</span>
                </div>
                <span style="font-size:11px;color:var(--text-tertiary)">${rec.trigger_type?.replace(/_/g, ' ')}</span>
            </div>
            <p style="font-size:13px;color:var(--text-secondary);margin:8px 0;line-height:1.6">${rec.description}</p>
            ${rec.impact_level === 'high' 
                ? `<div style="margin-top:10px">
                    <a href="#" class="btn btn-danger btn-sm" onclick="event.preventDefault(); navigateTo('approval')">
                        🔐 View in Approval Gate
                    </a>
                  </div>` 
                : ''}
            ${rec.impact_level === 'medium' 
                ? `<div style="margin-top:10px;display:flex;gap:8px">
                    <button class="btn btn-success btn-sm" onclick="acceptRec('${rec.id}')">✓ Accept</button>
                    <button class="btn btn-ghost btn-sm" onclick="dismissRec('${rec.id}')">✕ Dismiss</button>
                  </div>` 
                : ''}
        </div>
    `;
}

async function runRecommendations() {
    try {
        showToast('Generating recommendations...', 'info');
        await apiPost('/api/anomalies/detect');
        const result = await apiPost('/api/recommendations/generate');
        showToast(`Generated ${result.count} recommendations (${result.high_impact} high impact)`, 'success');
        renderRecommendations(document.getElementById('view-container'));
        updateBadges();
    } catch (e) {
        showToast('Error: ' + e.message, 'error');
    }
}

async function acceptRec(recId) {
    showToast('Recommendation accepted', 'success');
}

async function dismissRec(recId) {
    showToast('Recommendation dismissed', 'info');
}
