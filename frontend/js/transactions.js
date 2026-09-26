/* ══════════════════════════════════════════════════════════════════
   FinGuard Ledger & Activity View — High-Density Financial Ledger
   ══════════════════════════════════════════════════════════════════ */

let txnCurrentPage = 1;
let txnFilters = { search: '', category: '', type: '', month: '' };

async function renderTransactions(container) {
    try {
        let params = `page=${txnCurrentPage}&per_page=25`;
        if (txnFilters.category) params += `&category=${encodeURIComponent(txnFilters.category)}`;
        if (txnFilters.type) params += `&type=${encodeURIComponent(txnFilters.type)}`;
        if (txnFilters.month) params += `&month=${encodeURIComponent(txnFilters.month)}`;
        
        const [data, catData] = await Promise.all([
            apiGet(`/api/transactions?${params}`),
            apiGet('/api/categories'),
        ]);

        const transactions = data.transactions || [];
        const categories = catData.categories || [];

        // Client-side text search filter if user searched description
        const displayTxns = txnFilters.search 
            ? transactions.filter(t => 
                (t.merchant_name && t.merchant_name.toLowerCase().includes(txnFilters.search.toLowerCase())) ||
                (t.description && t.description.toLowerCase().includes(txnFilters.search.toLowerCase()))
              )
            : transactions;

        let html = `
            <div class="section-header">
                <div>
                    <h2 class="section-title">Verified Transaction Ledger</h2>
                    <div class="card-subtitle">Continuous feed indexed from linked accounts with anomaly detection tags.</div>
                </div>
                <span class="badge badge-low">${data.total} Historical Records</span>
            </div>

            <!-- Precision Filter Toolbar -->
            <div class="card mb-2" style="padding:14px 18px">
                <div class="filters-bar" style="margin-bottom:0">
                    <!-- Text Search -->
                    <div style="position:relative;flex:1;min-width:200px">
                        <input class="form-input" type="text" id="txn-search-input" 
                               placeholder="Search merchant or description..." 
                               value="${txnFilters.search || ''}"
                               oninput="handleTxnSearch(this.value)">
                    </div>

                    <!-- Type Filter -->
                    <select class="form-select" id="txn-filter-type" onchange="handleFilterChange('type', this.value)">
                        <option value="">All Flows (In & Out)</option>
                        <option value="credit" ${txnFilters.type === 'credit' ? 'selected' : ''}>Inflow (Credits)</option>
                        <option value="debit" ${txnFilters.type === 'debit' ? 'selected' : ''}>Outflow (Debits)</option>
                    </select>

                    <!-- Category Filter -->
                    <select class="form-select" id="txn-filter-category" onchange="handleFilterChange('category', this.value)">
                        <option value="">All Categories</option>
                        ${categories.map(c => 
                            `<option value="${c}" ${txnFilters.category === c ? 'selected' : ''}>${c}</option>`
                        ).join('')}
                    </select>

                    <!-- Month Filter -->
                    <select class="form-select" id="txn-filter-month" onchange="handleFilterChange('month', this.value)">
                        <option value="">All Historical Cycles</option>
                        <option value="2025-09" ${txnFilters.month === '2025-09' ? 'selected' : ''}>Sep 2025 (Current)</option>
                        <option value="2025-08" ${txnFilters.month === '2025-08' ? 'selected' : ''}>Aug 2025</option>
                        <option value="2025-07" ${txnFilters.month === '2025-07' ? 'selected' : ''}>Jul 2025</option>
                        <option value="2025-06" ${txnFilters.month === '2025-06' ? 'selected' : ''}>Jun 2025</option>
                        <option value="2025-05" ${txnFilters.month === '2025-05' ? 'selected' : ''}>May 2025</option>
                        <option value="2025-04" ${txnFilters.month === '2025-04' ? 'selected' : ''}>Apr 2025</option>
                    </select>

                    ${(txnFilters.search || txnFilters.category || txnFilters.type || txnFilters.month) ? `
                        <button class="btn btn-ghost btn-sm" onclick="resetTxnFilters()">
                            ${icon('x', 12)} Reset
                        </button>
                    ` : ''}
                </div>
            </div>

            <!-- Ledger Table -->
            <div class="card">
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th style="width:110px">Date</th>
                                <th>Merchant & Description</th>
                                <th style="width:140px">Category</th>
                                <th style="width:120px;text-align:right">Amount</th>
                                <th style="width:120px;text-align:right">Post-Balance</th>
                                <th style="width:130px;text-align:right">Pattern</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${displayTxns.length === 0 ? `
                                <tr>
                                    <td colspan="6" style="text-align:center;padding:40px;color:var(--text-tertiary)">
                                        No transactions match your active filter criteria.
                                    </td>
                                </tr>
                            ` : displayTxns.map(txn => {
                                const isCredit = txn.type === 'credit';
                                return `
                                    <tr>
                                        <td style="color:var(--text-tertiary);font-size:12px">
                                            ${formatDate(txn.date)}
                                        </td>
                                        <td>
                                            <div style="font-weight:600;color:var(--text-primary);font-size:13px">
                                                ${txn.merchant_name || txn.description}
                                            </div>
                                            ${txn.merchant_name && txn.description !== txn.merchant_name ? `
                                                <div style="font-size:11px;color:var(--text-tertiary);line-height:1.2">
                                                    ${txn.description}
                                                </div>
                                            ` : ''}
                                        </td>
                                        <td>
                                            <span class="badge badge-low">${txn.category || 'General'}</span>
                                            ${txn.flagged_for_review ? `
                                                <span class="badge badge-high" title="Anomaly flagged by statistical outlier model" style="margin-left:4px">
                                                    ${icon('alertTriangle', 10)} Flagged
                                                </span>
                                            ` : ''}
                                        </td>
                                        <td style="text-align:right" class="${isCredit ? 'amount-credit' : 'amount-debit'}">
                                            ${isCredit ? '+' : '-'}${formatCurrency(txn.amount)}
                                        </td>
                                        <td style="text-align:right;font-size:12px;color:var(--text-secondary)">
                                            ${formatCurrency(txn.balance_after)}
                                        </td>
                                        <td style="text-align:right">
                                            ${txn.is_recurring ? `
                                                <span class="badge badge-low" style="font-size:10px" title="Detected as recurring commitment">
                                                    ${icon('refresh', 9)} Recurring
                                                </span>
                                            ` : `
                                                <span style="font-size:11px;color:var(--text-tertiary)">One-off</span>
                                            `}
                                        </td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>

                <!-- Pagination -->
                <div class="flex items-center justify-between" style="padding-top:14px;border-top:1px solid var(--border-subtle);margin-top:12px">
                    <span style="font-size:12px;color:var(--text-tertiary)">
                        Showing page ${data.page} of ${data.pages} (${data.total} total)
                    </span>
                    <div class="flex items-center gap-1">
                        <button class="btn btn-secondary btn-sm" 
                                onclick="changeTxnPage(${txnCurrentPage - 1})"
                                ${txnCurrentPage <= 1 ? 'disabled' : ''}>
                            ← Previous
                        </button>
                        <button class="btn btn-secondary btn-sm" 
                                onclick="changeTxnPage(${txnCurrentPage + 1})"
                                ${txnCurrentPage >= data.pages ? 'disabled' : ''}>
                            Next →
                        </button>
                    </div>
                </div>
            </div>
        `;

        container.innerHTML = html;
    } catch (e) {
        showEmpty(container, 'alertTriangle', 'Failed to load ledger', e.message);
    }
}

let searchDebounceTimeout = null;
function handleTxnSearch(val) {
    clearTimeout(searchDebounceTimeout);
    searchDebounceTimeout = setTimeout(() => {
        txnFilters.search = val;
        renderTransactions(document.getElementById('view-container'));
    }, 200);
}

function handleFilterChange(field, val) {
    txnFilters[field] = val;
    txnCurrentPage = 1;
    renderTransactions(document.getElementById('view-container'));
}

function resetTxnFilters() {
    txnFilters = { search: '', category: '', type: '', month: '' };
    txnCurrentPage = 1;
    renderTransactions(document.getElementById('view-container'));
}

function changeTxnPage(page) {
    txnCurrentPage = page;
    renderTransactions(document.getElementById('view-container'));
}

// Exports
window.renderTransactions = renderTransactions;
window.handleTxnSearch = handleTxnSearch;
window.handleFilterChange = handleFilterChange;
window.resetTxnFilters = resetTxnFilters;
window.changeTxnPage = changeTxnPage;
