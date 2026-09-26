/* Approval Gate View — THE CORE DIFFERENTIATOR
   
   Shows pending actions with three real options:
   ✓ Approve — sets status to 'approved', enabling execution
   ✏️ Edit   — lets user change amount/params before approving
   ✕ Reject  — blocks execution permanently
   
   No silent default. No timeout. No bypass.
*/

async function renderApproval(container) {
    try {
        const allActions = await apiGet('/api/pending-actions');
        const actions = allActions.actions || [];
        
        const pending = actions.filter(a => a.status === 'pending');
        const decided = actions.filter(a => a.status !== 'pending');

        let html = `
            <!-- Gate Explanation -->
            <div class="card mb-3" style="border-left:4px solid var(--accent-danger);background:rgba(248,113,113,0.04)">
                <div class="flex items-center gap-2 mb-1">
                    <span style="font-size:24px">🔐</span>
                    <div>
                        <div style="font-weight:700;font-size:15px">Human Approval Gate</div>
                        <div style="font-size:12px;color:var(--text-tertiary)">
                            High-impact financial decisions are <strong>blocked from executing</strong> until you explicitly approve them.
                            No timeout, no default — your silence is NOT treated as approval.
                        </div>
                    </div>
                </div>
            </div>

            <!-- Stats -->
            <div class="stats-grid">
                <div class="stat-card accent-warning">
                    <div class="stat-label">Pending Review</div>
                    <div class="stat-value">${pending.length}</div>
                </div>
                <div class="stat-card accent-success">
                    <div class="stat-label">Approved</div>
                    <div class="stat-value">${actions.filter(a => a.status === 'approved' || a.status === 'executed').length}</div>
                </div>
                <div class="stat-card accent-danger">
                    <div class="stat-label">Rejected</div>
                    <div class="stat-value">${actions.filter(a => a.status === 'rejected').length}</div>
                </div>
                <div class="stat-card accent-primary">
                    <div class="stat-label">Executed</div>
                    <div class="stat-value">${actions.filter(a => a.status === 'executed').length}</div>
                </div>
            </div>
        `;

        // Pending actions
        if (pending.length > 0) {
            html += `
                <div class="section-header">
                    <h2 class="section-title">⏳ Awaiting Your Decision</h2>
                </div>
            `;
            html += pending.map(a => renderApprovalCard(a)).join('');
        } else {
            html += `
                <div class="card mb-3">
                    <div class="empty-state" style="padding:32px">
                        <div class="empty-state-icon">✅</div>
                        <div class="empty-state-text">No pending actions</div>
                        <div class="empty-state-hint">All high-impact actions have been decided.</div>
                    </div>
                </div>
            `;
        }

        // Decided actions
        if (decided.length > 0) {
            html += `
                <div class="section-header mt-3">
                    <h2 class="section-title">📋 Decision History</h2>
                </div>
            `;
            html += decided.map(a => renderDecidedCard(a)).join('');
        }

        container.innerHTML = html;
        
        // Mark pending actions as shown
        for (const a of pending) {
            apiPost(`/api/pending-actions/${a.id}/shown`).catch(() => {});
        }

    } catch (e) {
        showEmpty(container, '❌', 'Failed to load approval gate', e.message);
    }
}

function renderApprovalCard(action) {
    let params;
    try {
        params = typeof action.original_params === 'string' 
            ? JSON.parse(action.original_params) : (action.original_params || {});
    } catch { params = {}; }

    return `
        <div class="approval-card ${action.impact_level}">
            <div class="approval-card-header">
                <div>
                    <div class="approval-card-title">${action.title}</div>
                    <div class="approval-card-meta">
                        <span class="badge badge-${action.impact_level}">${action.impact_level} impact</span>
                        <span style="margin-left:8px">${action.action_type?.replace(/_/g, ' ')}</span>
                        <span style="margin-left:8px;color:var(--text-tertiary)">
                            Created ${formatDateTime(action.created_at)}
                        </span>
                    </div>
                </div>
                <span class="badge badge-pending" style="font-size:13px;padding:6px 14px">
                    ⏳ PENDING
                </span>
            </div>

            <div class="approval-card-body">
                <div class="approval-card-description">${action.description}</div>
                
                ${action.amount != null ? `
                    <div class="approval-card-amount">
                        <div>
                            <div class="label">Amount</div>
                            <div class="value">${formatCurrency(action.amount)}</div>
                        </div>
                    </div>
                ` : ''}

                <div class="approval-card-rationale">
                    <strong>Rationale:</strong> ${action.rationale}
                </div>

                ${Object.keys(params).length > 0 ? `
                    <div style="margin-top:12px;padding:10px 14px;background:var(--bg-tertiary);border-radius:var(--radius-sm)">
                        <div style="font-size:11px;color:var(--text-tertiary);text-transform:uppercase;margin-bottom:6px">Parameters</div>
                        ${Object.entries(params).map(([k, v]) => `
                            <div style="display:flex;justify-content:space-between;padding:3px 0;font-size:13px">
                                <span style="color:var(--text-tertiary)">${k.replace(/_/g, ' ')}</span>
                                <span style="color:var(--text-primary);font-weight:500">${typeof v === 'number' ? formatCurrency(v) : v}</span>
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
            </div>

            <div class="approval-card-actions">
                <button class="btn btn-success" onclick="approveAction('${action.id}')">
                    ✓ Approve
                </button>
                <button class="btn btn-warning" onclick='openEditModal(${JSON.stringify(action).replace(/'/g, "\\'")})'>
                    ✏️ Edit & Approve
                </button>
                <button class="btn btn-danger" onclick="rejectAction('${action.id}')">
                    ✕ Reject
                </button>
            </div>
        </div>
    `;
}

function renderDecidedCard(action) {
    const statusColors = {
        approved: 'var(--accent-success)',
        rejected: 'var(--accent-danger)',
        executed: 'var(--accent-primary)',
        failed: 'var(--accent-danger)',
        edited: 'var(--accent-warning)',
    };
    
    const statusIcons = {
        approved: '✓',
        rejected: '✕',
        executed: '⚡',
        failed: '❌',
        edited: '✏️',
    };

    return `
        <div class="approval-card" style="opacity:0.85;border-left-color:${statusColors[action.status] || 'var(--border-default)'}">
            <div class="flex justify-between items-center">
                <div>
                    <span style="font-weight:600">${action.title}</span>
                    <span class="badge badge-${action.status}" style="margin-left:8px">
                        ${statusIcons[action.status] || ''} ${action.status}
                    </span>
                </div>
                <div style="text-align:right;font-size:12px;color:var(--text-tertiary)">
                    ${action.amount != null ? `<div style="font-weight:600;color:var(--text-primary)">${formatCurrency(action.amount)}</div>` : ''}
                    <div>Decided ${formatDateTime(action.decided_at)}</div>
                    ${action.executed_at ? `<div>Executed ${formatDateTime(action.executed_at)}</div>` : ''}
                </div>
            </div>
            ${action.status === 'approved' && action.executed_at === null ? `
                <div style="margin-top:10px">
                    <button class="btn btn-primary btn-sm" onclick="executeAction('${action.id}')">
                        ⚡ Execute Now
                    </button>
                </div>
            ` : ''}
        </div>
    `;
}

async function approveAction(actionId) {
    try {
        await apiPost(`/api/pending-actions/${actionId}/approve`);
        showToast('Action approved! You can now execute it.', 'success');
        
        // Auto-execute after approval
        try {
            await apiPost(`/api/pending-actions/${actionId}/execute`);
            showToast('Action executed successfully!', 'success');
        } catch (execErr) {
            showToast('Approved but execution pending.', 'info');
        }
        
        renderApproval(document.getElementById('view-container'));
        updateBadges();
    } catch (e) {
        showToast('Error: ' + e.message, 'error');
    }
}

async function rejectAction(actionId) {
    try {
        await apiPost(`/api/pending-actions/${actionId}/reject`, { reason: 'Rejected by user' });
        showToast('Action rejected.', 'info');
        renderApproval(document.getElementById('view-container'));
        updateBadges();
    } catch (e) {
        showToast('Error: ' + e.message, 'error');
    }
}

async function executeAction(actionId) {
    try {
        const result = await apiPost(`/api/pending-actions/${actionId}/execute`);
        if (result.success) {
            showToast('Action executed successfully!', 'success');
        } else {
            showToast('Execution failed: ' + (result.error || 'Unknown error'), 'error');
        }
        renderApproval(document.getElementById('view-container'));
    } catch (e) {
        // The 403 from the hard gate will be caught here
        if (e.message.includes('APPROVAL_REQUIRED')) {
            showToast('🔐 BLOCKED: This action requires explicit human approval!', 'error');
        } else {
            showToast('Error: ' + e.message, 'error');
        }
    }
}
