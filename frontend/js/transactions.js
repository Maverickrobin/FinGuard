/* Transactions View */
let txnCurrentPage = 1;
let txnFilters = {};

async function renderTransactions(container) {
    try {
        let params = `page=${txnCurrentPage}&per_page=30`;
        if (txnFilters.category) params += `&category=${txnFilters.category}`;
        if (txnFilters.type) params += `&type=${txnFilters.type}`;
        if (txnFilters.month) params += `&month=${txnFilters.month}`;
        
        const data = await apiGet(`/api/transactions?${params}`);
        const categories = await apiGet('/api/categories');
        
        let html = `
            <!-- Filters -->
            <div class="filters-bar">
                <select class="form-select" id="txn-filter-type" onchange="filterTransactions()">
                    <option value="">All Types</option>
                    <option value="credit" ${txnFilters.type === 'credit' ? 'selected' : ''}>Credit</option>
                    <option value="debit" ${txnFilters.type === 'debit' ? 'selected' : ''}>Debit</option>
                </select>
                <select class="form-select" id="txn-filter-category" onchange="filterTransactions()">
                    <option value="">All Categories</option>
                    ${categories.categories.map(c => 
                        `<option value="${c}" ${txnFilters.category === c ? 'selected' : ''}>${c}</option>`
                    ).join('')}
                </select>
                <select class="form-select" id="txn-filter-month" onchange="filterTransactions()">
                    <option value="">All Months</option>
                    <option value="2025-09" ${txnFilters.month === '2025-09' ? 'selected' : ''}>Sep 2025</option>
                    <option value="2025-08" ${txnFilters.month === '2025-08' ? 'selected' : ''}>Aug 2025</option>
                    <option value="2025-07" ${txnFilters.month === '2025-07' ? 'selected' : ''}>Jul 2025</option>
                    <option value="2025-06" ${txnFilters.month === '2025-06' ? 'selected' : ''}>Jun 2025</option>
                    <option value="2025-05" ${txnFilters.month === '2025-05' ? 'selected' : ''}>May 2025</option>
                    <option value="2025-04" ${txnFilters.month === '2025-04' ? 'selected' : ''}>Apr 2025</option>
                </select>
                <span style="font-size:12px;color:var(--text-tertiary);margin-left:auto">
                    ${data.total} transactions
                </span>
            </div>

            <!-- Table -->
            <div class="card">
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Description</th>
                                <th>Category</th>
                                <th>Amount</th>
                                <th>Balance</th>
                                <th>Source</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${data.transactions.map(txn => `
                                <tr>
                                    <td>${formatDate(txn.date)}</td>
                                    <td style="max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" 
                                        title="${txn.description}">
                                        ${txn.merchant_name ? `<strong>${txn.merchant_name}</strong><br>` : ''}
                                        <span style="font-size:11px;color:var(--text-tertiary)">${txn.description}</span>
                                    </td>
                                    <td>
                                        <span class="badge badge-low">${txn.category || 'Uncategorized'}</span>
                                        ${txn.flagged_for_review ? '<span title="Flagged for review" style="cursor:help">⚠️</span>' : ''}
                                    </td>
                                    <td class="${txn.type === 'credit' ? 'amount-credit' : 'amount-debit'}">
                                        ${txn.type === 'credit' ? '+' : '-'}${formatCurrency(txn.amount)}
                                    </td>
                                    <td style="font-size:12px">${formatCurrency(txn.balance_after)}</td>
                                    <td>
                                        <span style="font-size:11px;color:var(--text-tertiary)">
                                            ${txn.category_source || '—'}
                                            ${txn.is_recurring ? ' 🔄' : ''}
                                        </span>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- Pagination -->
            <div class="pagination">
                <button class="btn btn-secondary btn-sm" 
                        onclick="changeTxnPage(${txnCurrentPage - 1})"
                        ${txnCurrentPage <= 1 ? 'disabled' : ''}>← Prev</button>
                <span class="page-info">Page ${data.page} of ${data.pages}</span>
                <button class="btn btn-secondary btn-sm" 
                        onclick="changeTxnPage(${txnCurrentPage + 1})"
                        ${txnCurrentPage >= data.pages ? 'disabled' : ''}>Next →</button>
            </div>
        `;

        container.innerHTML = html;
    } catch (e) {
        showEmpty(container, '❌', 'Failed to load transactions', e.message);
    }
}

function filterTransactions() {
    txnFilters.type = document.getElementById('txn-filter-type').value;
    txnFilters.category = document.getElementById('txn-filter-category').value;
    txnFilters.month = document.getElementById('txn-filter-month').value;
    txnCurrentPage = 1;
    renderTransactions(document.getElementById('view-container'));
}

function changeTxnPage(page) {
    if (page < 1) return;
    txnCurrentPage = page;
    renderTransactions(document.getElementById('view-container'));
}

// Export to window
window.renderTransactions = renderTransactions;
window.filterTransactions = filterTransactions;
window.changeTxnPage = changeTxnPage;
