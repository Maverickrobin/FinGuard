/* ══════════════════════════════════════════════════════════════════
   FinGuard Profiles & Onboarding Module
   Multi-profile support, landing screen, CSV ingestion & live pipeline.
   ══════════════════════════════════════════════════════════════════ */

// ─── Profile Storage & State ──────────────────────────────────────────

function getActiveProfileId() {
    return localStorage.getItem('finguard_active_profile_id') || 'demo';
}

function setActiveProfileId(profileId) {
    localStorage.setItem('finguard_active_profile_id', profileId);
}

function getActiveProfileObject() {
    try {
        const stored = localStorage.getItem('finguard_active_profile_obj');
        if (stored) return JSON.parse(stored);
    } catch {}
    return {
        id: 'demo',
        name: 'Priya Sharma',
        role: 'Software Engineer',
        income: 85000,
        city: 'Bangalore',
        is_demo: true,
    };
}

function setActiveProfileObject(profileObj) {
    localStorage.setItem('finguard_active_profile_id', profileObj.id);
    localStorage.setItem('finguard_active_profile_obj', JSON.stringify(profileObj));
    updateSidebarProfile(profileObj);
    updateTopBarProfile(profileObj);
}

function updateSidebarProfile(profile) {
    const nameEl = document.querySelector('.persona-name');
    const roleEl = document.querySelector('.persona-role');
    const avatarEl = document.querySelector('.persona-avatar');

    if (nameEl) nameEl.textContent = profile.name;
    if (roleEl) {
        const inc = profile.income ? ` • ₹${Math.round(profile.income / 1000)}k/mo` : '';
        roleEl.textContent = `${profile.role}${inc}`;
    }
    if (avatarEl) {
        const initials = profile.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
        avatarEl.textContent = initials || 'US';
    }
}

function updateTopBarProfile(profile) {
    const pill = document.getElementById('profile-topbar-pill');
    if (pill) {
        const isDemo = profile.id === 'demo' || profile.is_demo;
        pill.innerHTML = `
            <span class="persona-avatar-sm">${profile.name[0] || 'U'}</span>
            <span style="font-weight:600">${profile.name}</span>
            <span class="badge ${isDemo ? 'badge-low' : 'badge-success'}" style="font-size:10px;padding:1px 6px">
                ${isDemo ? 'DEMO' : 'ACTIVE'}
            </span>
            <span style="color:var(--text-tertiary);margin-left:4px">▼</span>
        `;
    }
}

// ─── Landing / Login Screen ──────────────────────────────────────────

async function renderLandingScreen(container) {
    try {
        const data = await apiGet('/api/profiles');
        const profiles = data.profiles || [];
        const customProfiles = profiles.filter(p => p.id !== 'demo' && !p.is_demo);

        let html = `
            <div class="landing-hero">
                <div class="landing-badge">
                    <span class="pulse-dot"></span> Institutional Risk Governance
                </div>
                <h1 class="landing-title">Welcome to FinGuard</h1>
                <p class="landing-subtitle">
                    Autonomous personal finance intelligence with code-governed approval gates. Choose an experience below:
                </p>

                <!-- Dual Path Grid -->
                <div class="landing-grid">
                    <!-- Path 1: Priya Sharma Demo -->
                    <div class="landing-card demo-card" onclick="selectDemoProfile()">
                        <div class="landing-card-header">
                            <span class="badge badge-low" style="font-weight:700">REHEARSED DEMO STORY</span>
                            <span class="landing-card-icon">${icon('shieldCheck', 24)}</span>
                        </div>
                        <div class="landing-persona-row">
                            <div class="persona-avatar" style="width:44px;height:44px;font-size:16px">PS</div>
                            <div>
                                <h3 style="margin:0 0 2px 0;font-size:18px;color:var(--text-primary)">Priya Sharma</h3>
                                <div style="font-size:13px;color:var(--text-secondary)">Software Engineer, Bangalore • ₹85k/month</div>
                            </div>
                        </div>
                        <p class="landing-card-desc">
                            Explore the complete curated reference dataset with pre-planted anomalies (Netflix price hike, discretionary variance), 90-day cashflow forecast, and governed human approval gate.
                        </p>
                        <div class="landing-features">
                            <div class="landing-feat-item">✔ 245 seeded transactions across 6 months</div>
                            <div class="landing-feat-item">✔ 3 planted anomalies with deterministic triggers</div>
                            <div class="landing-feat-item">✔ Working approval barrier with cryptographic audit log</div>
                        </div>
                        <button class="btn btn-primary" style="width:100%;margin-top:18px">
                            Explore Priya's Demo →
                        </button>
                    </div>

                    <!-- Path 2: Create Your Profile -->
                    <div class="landing-card create-card" onclick="openOnboardingModal()">
                        <div class="landing-card-header">
                            <span class="badge badge-success" style="font-weight:700">LIVE INGESTION & RISK ENGINE</span>
                            <span class="landing-card-icon" style="color:var(--emerald)">${icon('sparkles', 24)}</span>
                        </div>
                        <div class="landing-persona-row">
                            <div class="persona-avatar" style="width:44px;height:44px;font-size:16px;background:var(--emerald-subtle);color:var(--emerald-light);border-color:var(--emerald)">+</div>
                            <div>
                                <h3 style="margin:0 0 2px 0;font-size:18px;color:var(--text-primary)">Create Your Profile</h3>
                                <div style="font-size:13px;color:var(--text-secondary)">Upload bank CSV or use quick-add starter templates</div>
                            </div>
                        </div>
                        <p class="landing-card-desc">
                            Ingest your own financial transactions through the identical pipeline: tiered categorization (Merchant DB + Rules), anomaly detector, and custom risk governance.
                        </p>
                        <div class="landing-features">
                            <div class="landing-feat-item">✔ Real CSV statement ingestion & categorization</div>
                            <div class="landing-feat-item">✔ Fully isolated SQLite ledger & audit trail</div>
                            <div class="landing-feat-item">✔ Quick-add starter templates for testing without CSV</div>
                        </div>
                        <button class="btn btn-success" style="width:100%;margin-top:18px">
                            ${icon('zap', 14)} Create Profile & Onboard →
                        </button>
                    </div>
                </div>

                ${customProfiles.length > 0 ? `
                    <!-- Saved Custom Profiles Section -->
                    <div style="margin-top:40px;width:100%;max-width:860px">
                        <div class="section-header mb-1">
                            <div>
                                <h3 style="font-size:15px;font-weight:700;color:var(--text-primary)">Previously Created Profiles</h3>
                                <div class="card-subtitle">Resume an existing user session on their isolated ledger</div>
                            </div>
                        </div>
                        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px">
                            ${customProfiles.map(p => `
                                <div class="card p-2" style="cursor:pointer;display:flex;align-items:center;justify-content:space-between" onclick="selectCustomProfile('${p.id}')">
                                    <div class="flex items-center gap-1">
                                        <div class="persona-avatar-sm">${p.name[0] || 'U'}</div>
                                        <div>
                                            <div style="font-weight:600;font-size:14px;color:var(--text-primary)">${p.name}</div>
                                            <div style="font-size:11px;color:var(--text-tertiary)">${p.role} · ₹${Math.round(p.income/1000)}k/mo</div>
                                        </div>
                                    </div>
                                    <div class="flex items-center gap-1">
                                        <button class="btn btn-secondary btn-sm" title="Open Dashboard">Open →</button>
                                        <button class="btn btn-ghost btn-sm" style="color:var(--rose-light)" onclick="event.stopPropagation();deleteCustomProfile('${p.id}')" title="Delete Profile">${icon('x', 12)}</button>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
            </div>
        `;

        container.innerHTML = html;

        // Hide sidebar navigation while on landing page
        const sidebar = document.getElementById('sidebar');
        if (sidebar) sidebar.style.display = 'none';
        const topBar = document.querySelector('.top-bar');
        if (topBar) topBar.style.display = 'none';

    } catch (e) {
        showEmpty(container, 'alertTriangle', 'Failed to load landing view', e.message);
    }
}

function selectDemoProfile() {
    const demoObj = {
        id: 'demo',
        name: 'Priya Sharma',
        role: 'Software Engineer',
        income: 85000,
        city: 'Bangalore',
        is_demo: true,
    };
    setActiveProfileObject(demoObj);
    restoreAppLayout();
    navigateTo('dashboard');
    showToast('Loaded demo story: Priya Sharma', 'success');
}

async function selectCustomProfile(profileId) {
    try {
        const data = await apiGet('/api/profiles');
        const profile = (data.profiles || []).find(p => p.id === profileId);
        if (profile) {
            setActiveProfileObject(profile);
            restoreAppLayout();
            navigateTo('dashboard');
            showToast(`Switched to profile: ${profile.name}`, 'success');
        }
    } catch (e) {
        showToast('Error switching profile: ' + e.message, 'error');
    }
}

async function deleteCustomProfile(profileId) {
    if (!confirm('Are you sure you want to delete this profile and its isolated ledger?')) return;
    try {
        await apiDelete(`/api/profiles/${profileId}`);
        showToast('Profile deleted.', 'info');
        renderLandingScreen(document.getElementById('view-container'));
    } catch (e) {
        showToast('Error deleting profile: ' + e.message, 'error');
    }
}

function restoreAppLayout() {
    const sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.style.display = 'flex';
    const topBar = document.querySelector('.top-bar');
    if (topBar) topBar.style.display = 'flex';
}

function openProfileSwitcherModal() {
    apiGet('/api/profiles').then(data => {
        const profiles = data.profiles || [];
        const activeId = getActiveProfileId();

        const modal = document.getElementById('edit-modal');
        const title = document.getElementById('edit-modal-title');
        const body = document.getElementById('edit-modal-body');
        const saveBtn = document.getElementById('edit-modal-save');

        title.textContent = 'Switch Active Profile';
        saveBtn.style.display = 'none';

        let html = `
            <div style="margin-bottom:16px;font-size:13px;color:var(--text-secondary)">
                FinGuard isolates transactions, anomalies, approval queues, and audit logs per profile.
            </div>
            <div style="display:flex;flex-direction:column;gap:10px">
                ${profiles.map(p => {
                    const isSelected = p.id === activeId;
                    return `
                        <div class="card p-2" style="cursor:pointer;border-color:${isSelected ? 'var(--brand)' : 'var(--border-subtle)'};background:${isSelected ? 'var(--brand-subtle)' : 'var(--bg-card)'}" onclick="switchProfileFromModal('${p.id}')">
                            <div class="flex items-center justify-between">
                                <div class="flex items-center gap-1">
                                    <div class="persona-avatar-sm">${p.name[0] || 'U'}</div>
                                    <div>
                                        <div style="font-weight:600;font-size:14px;color:var(--text-primary)">
                                            ${p.name} ${isSelected ? '<span class="badge badge-success" style="font-size:10px">CURRENT</span>' : ''}
                                        </div>
                                        <div style="font-size:12px;color:var(--text-tertiary)">${p.role} · ₹${Math.round(p.income/1000)}k/mo</div>
                                    </div>
                                </div>
                                <span style="font-size:12px;color:var(--brand-light);font-weight:600">Select →</span>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
            <div style="margin-top:16px;padding-top:14px;border-top:1px solid var(--border-subtle);display:flex;justify-content:space-between">
                <button class="btn btn-secondary btn-sm" onclick="showLandingViewFromModal()">
                    ${icon('sliders', 12)} Return to Landing Screen
                </button>
                <button class="btn btn-primary btn-sm" onclick="closeModal();openOnboardingModal()">
                    ${icon('zap', 12)} + Create New Profile
                </button>
            </div>
        `;

        body.innerHTML = html;
        modal.style.display = 'flex';
    }).catch(e => {
        showToast('Error loading profiles: ' + e.message, 'error');
    });
}

function switchProfileFromModal(profileId) {
    closeModal();
    if (profileId === 'demo') {
        selectDemoProfile();
    } else {
        selectCustomProfile(profileId);
    }
}

function showLandingViewFromModal() {
    closeModal();
    localStorage.removeItem('finguard_active_profile_id');
    renderLandingScreen(document.getElementById('view-container'));
}

function closeModal() {
    const modal = document.getElementById('edit-modal');
    if (modal) modal.style.display = 'none';
}

// ─── Onboarding Wizard Modal ─────────────────────────────────────────

let onboardingStep = 1;
let currentCreatedProfile = null;
let selectedTab = 'csv';

function openOnboardingModal() {
    onboardingStep = 1;
    currentCreatedProfile = null;
    selectedTab = 'csv';

    const modal = document.getElementById('edit-modal');
    const title = document.getElementById('edit-modal-title');
    const saveBtn = document.getElementById('edit-modal-save');
    
    title.textContent = 'Create Your Profile — Step 1 of 2';
    saveBtn.style.display = 'none';

    renderOnboardingStep1();
    modal.style.display = 'flex';
}

function renderOnboardingStep1() {
    const body = document.getElementById('edit-modal-body');
    const title = document.getElementById('edit-modal-title');
    title.textContent = 'Create Profile · Step 1: Your Information';

    body.innerHTML = `
        <div style="margin-bottom:16px;font-size:13px;color:var(--text-secondary)">
            Set up your profile identity. We'll size your baseline budgets and emergency savings goal based on your monthly income.
        </div>
        <div class="form-group">
            <label class="form-label" for="ob-name">Full Name *</label>
            <input class="form-input" type="text" id="ob-name" placeholder="e.g. Rahul Verma" value="Rahul Verma">
        </div>
        <div class="form-group">
            <label class="form-label" for="ob-role">Occupation / Role</label>
            <input class="form-input" type="text" id="ob-role" placeholder="e.g. Product Manager" value="Product Manager">
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div class="form-group">
                <label class="form-label" for="ob-income">Monthly Income (₹) *</label>
                <input class="form-input" type="number" id="ob-income" placeholder="75000" value="75000" step="1000">
            </div>
            <div class="form-group">
                <label class="form-label" for="ob-balance">Current Bank Balance (₹)</label>
                <input class="form-input" type="number" id="ob-balance" placeholder="30000" value="30000" step="1000">
            </div>
        </div>
        <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:20px;padding-top:14px;border-top:1px solid var(--border-subtle)">
            <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
            <button class="btn btn-primary" onclick="submitOnboardingStep1()">
                Next: Add Spending Activity →
            </button>
        </div>
    `;
}

async function submitOnboardingStep1() {
    const name = document.getElementById('ob-name')?.value.trim();
    const role = document.getElementById('ob-role')?.value.trim() || 'Working Professional';
    const income = parseFloat(document.getElementById('ob-income')?.value) || 75000;
    const balance = parseFloat(document.getElementById('ob-balance')?.value) || 30000;

    if (!name) {
        showToast('Please provide your name to create a profile.', 'warning');
        return;
    }

    try {
        const res = await apiPost('/api/profiles', {
            name,
            role,
            income,
            starting_balance: balance,
        });

        currentCreatedProfile = res.profile;
        renderOnboardingStep2();
    } catch (e) {
        showToast('Error creating profile: ' + e.message, 'error');
    }
}

function renderOnboardingStep2() {
    const body = document.getElementById('edit-modal-body');
    const title = document.getElementById('edit-modal-title');
    title.textContent = `Onboard Activity · ${currentCreatedProfile.name}`;

    body.innerHTML = `
        <div style="margin-bottom:14px;font-size:13px;color:var(--text-secondary)">
            Feed financial transactions into your isolated ledger. FinGuard will categorize, evaluate variance, and detect anomalies.
        </div>

        <!-- Activity Method Tabs -->
        <div class="flex items-center gap-1 mb-2" style="background:var(--bg-elevated);padding:4px;border-radius:var(--radius-sm)">
            <button class="btn btn-sm ${selectedTab === 'csv' ? 'btn-primary' : 'btn-ghost'}" style="flex:1" onclick="switchOnboardingTab('csv')">
                ${icon('receipt', 13)} Upload Bank CSV
            </button>
            <button class="btn btn-sm ${selectedTab === 'template' ? 'btn-primary' : 'btn-ghost'}" style="flex:1" onclick="switchOnboardingTab('template')">
                ${icon('sliders', 13)} Starter Templates
            </button>
            <button class="btn btn-sm ${selectedTab === 'manual' ? 'btn-primary' : 'btn-ghost'}" style="flex:1" onclick="switchOnboardingTab('manual')">
                ${icon('edit', 13)} Quick Manual
            </button>
        </div>

        <div id="tab-content-container">
            ${selectedTab === 'csv' ? renderCsvTabContent() : selectedTab === 'template' ? renderTemplateTabContent() : renderManualTabContent()}
        </div>
    `;
}

function switchOnboardingTab(tab) {
    selectedTab = tab;
    renderOnboardingStep2();
}

function renderCsvTabContent() {
    return `
        <div style="border:2px dashed var(--border-default);border-radius:var(--radius-md);padding:24px;text-align:center;background:var(--bg-elevated);margin-bottom:14px" id="drop-zone">
            <div style="color:var(--brand-light);margin-bottom:10px">${icon('receipt', 36)}</div>
            <div style="font-weight:600;font-size:14px;color:var(--text-primary);margin-bottom:4px">
                Upload Bank Statement CSV
            </div>
            <div style="font-size:12px;color:var(--text-tertiary);margin-bottom:14px">
                Supported columns: Date, Description/Narration, Amount, Type (or Debit/Credit)
            </div>
            <input type="file" id="csv-file-input" accept=".csv" style="display:none" onchange="handleCsvFileSelected(this.files[0])">
            <div class="flex items-center justify-center gap-1">
                <button class="btn btn-secondary btn-sm" onclick="document.getElementById('csv-file-input').click()">
                    Browse CSV File
                </button>
                <button class="btn btn-ghost btn-sm" onclick="downloadSampleCsv()">
                    📥 Download Sample CSV
                </button>
            </div>
            <div id="file-name-display" style="font-size:12px;color:var(--emerald-light);margin-top:10px;font-weight:600;display:none"></div>
        </div>

        <div style="display:flex;justify-content:space-between;align-items:center;padding-top:14px;border-top:1px solid var(--border-subtle)">
            <button class="btn btn-secondary" onclick="renderOnboardingStep1()">← Back</button>
            <button class="btn btn-primary" id="btn-process-csv" onclick="submitCsvUpload()" disabled>
                Upload & Run Live Pipeline →
            </button>
        </div>
    `;
}

function renderTemplateTabContent() {
    return `
        <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:18px">
            <label class="card p-2" style="cursor:pointer;display:flex;gap:12px;align-items:flex-start">
                <input type="radio" name="quick-template" value="tech_pro" checked style="margin-top:4px">
                <div>
                    <div style="font-weight:600;font-size:14px;color:var(--text-primary)">Tech Professional Preset</div>
                    <div style="font-size:12px;color:var(--text-secondary)">Salary credits, apartment rent, SIP mutual fund, groceries, food delivery, and Netflix.</div>
                </div>
            </label>

            <label class="card p-2" style="cursor:pointer;display:flex;gap:12px;align-items:flex-start">
                <input type="radio" name="quick-template" value="freelancer" style="margin-top:4px">
                <div>
                    <div style="font-weight:600;font-size:14px;color:var(--text-primary)">Freelancer & Consultant Preset</div>
                    <div style="font-size:12px;color:var(--text-secondary)">Multiple irregular client disbursements, coworking membership, software tools, equipment.</div>
                </div>
            </label>

            <label class="card p-2" style="cursor:pointer;display:flex;gap:12px;align-items:flex-start">
                <input type="radio" name="quick-template" value="student" style="margin-top:4px">
                <div>
                    <div style="font-weight:600;font-size:14px;color:var(--text-primary)">Early Career / Student Preset</div>
                    <div style="font-size:12px;color:var(--text-secondary)">Monthly stipend, PG hostel rent, textbooks, metro transit, and budget subscriptions.</div>
                </div>
            </label>
        </div>

        <div style="display:flex;justify-content:space-between;align-items:center;padding-top:14px;border-top:1px solid var(--border-subtle)">
            <button class="btn btn-secondary" onclick="renderOnboardingStep1()">← Back</button>
            <button class="btn btn-success" onclick="submitQuickTemplate()">
                ${icon('zap', 13)} Ingest Preset & Run Engine →
            </button>
        </div>
    `;
}

function renderManualTabContent() {
    const today = new Date().toISOString().split('T')[0];
    return `
        <div style="font-size:12px;color:var(--text-secondary);margin-bottom:10px">
            Add a few starter transactions below:
        </div>
        <div id="manual-rows-container" style="display:flex;flex-direction:column;gap:8px;margin-bottom:14px">
            <div class="manual-txn-row" style="display:grid;grid-template-columns:120px 1fr 90px 90px;gap:8px">
                <input class="form-input form-input-sm txn-date" type="date" value="${today}">
                <input class="form-input form-input-sm txn-desc" type="text" placeholder="Description (e.g. Salary, Rent)" value="TechCorp Salary Credit">
                <input class="form-input form-input-sm txn-amt" type="number" placeholder="Amount" value="75000">
                <select class="form-input form-input-sm txn-type">
                    <option value="credit" selected>Credit</option>
                    <option value="debit">Debit</option>
                </select>
            </div>
            <div class="manual-txn-row" style="display:grid;grid-template-columns:120px 1fr 90px 90px;gap:8px">
                <input class="form-input form-input-sm txn-date" type="date" value="${today}">
                <input class="form-input form-input-sm txn-desc" type="text" placeholder="Description" value="House Rent Transfer">
                <input class="form-input form-input-sm txn-amt" type="number" placeholder="Amount" value="18000">
                <select class="form-input form-input-sm txn-type">
                    <option value="debit" selected>Debit</option>
                    <option value="credit">Credit</option>
                </select>
            </div>
            <div class="manual-txn-row" style="display:grid;grid-template-columns:120px 1fr 90px 90px;gap:8px">
                <input class="form-input form-input-sm txn-date" type="date" value="${today}">
                <input class="form-input form-input-sm txn-desc" type="text" placeholder="Description" value="Swiggy Food Order">
                <input class="form-input form-input-sm txn-amt" type="number" placeholder="Amount" value="650">
                <select class="form-input form-input-sm txn-type">
                    <option value="debit" selected>Debit</option>
                    <option value="credit">Credit</option>
                </select>
            </div>
        </div>
        <button class="btn btn-ghost btn-sm mb-2" onclick="addManualTxnRow()">+ Add Row</button>

        <div style="display:flex;justify-content:space-between;align-items:center;padding-top:14px;border-top:1px solid var(--border-subtle)">
            <button class="btn btn-secondary" onclick="renderOnboardingStep1()">← Back</button>
            <button class="btn btn-primary" onclick="submitManualTransactions()">
                Submit & Run Pipeline →
            </button>
        </div>
    `;
}

function addManualTxnRow() {
    const container = document.getElementById('manual-rows-container');
    if (!container) return;
    const today = new Date().toISOString().split('T')[0];
    const row = document.createElement('div');
    row.className = 'manual-txn-row';
    row.style.display = 'grid';
    row.style.gridTemplateColumns = '120px 1fr 90px 90px';
    row.style.gap = '8px';
    row.innerHTML = `
        <input class="form-input form-input-sm txn-date" type="date" value="${today}">
        <input class="form-input form-input-sm txn-desc" type="text" placeholder="Description">
        <input class="form-input form-input-sm txn-amt" type="number" placeholder="Amount">
        <select class="form-input form-input-sm txn-type">
            <option value="debit">Debit</option>
            <option value="credit">Credit</option>
        </select>
    `;
    container.appendChild(row);
}

let selectedCsvFile = null;

function handleCsvFileSelected(file) {
    if (!file) return;
    selectedCsvFile = file;
    const nameDisplay = document.getElementById('file-name-display');
    const processBtn = document.getElementById('btn-process-csv');
    if (nameDisplay) {
        nameDisplay.textContent = `Selected: ${file.name} (${Math.round(file.size / 1024)} KB)`;
        nameDisplay.style.display = 'block';
    }
    if (processBtn) processBtn.disabled = false;
}

function downloadSampleCsv() {
    const csvContent = `Date,Description,Amount,Type\n` +
        `2025-07-01,TechCorp Solutions Salary Credit,75000,credit\n` +
        `2025-07-05,NEFT House Rent Landlord,18000,debit\n` +
        `2025-07-07,Groww Mutual Fund SIP,5000,debit\n` +
        `2025-07-10,BigBasket Weekly Groceries,2400,debit\n` +
        `2025-07-15,Netflix Subscription,649,debit\n` +
        `2025-07-18,Bescom Electricity Bill,1850,debit\n` +
        `2025-07-22,Swiggy Dinner Order,850,debit\n` +
        `2025-08-01,TechCorp Solutions Salary Credit,75000,credit\n` +
        `2025-08-05,NEFT House Rent Landlord,18000,debit\n` +
        `2025-08-15,Netflix Subscription,899,debit\n` +
        `2025-08-25,Amazon Shopping Purchase,8500,debit\n` +
        `2025-09-01,TechCorp Solutions Salary Credit,75000,credit\n` +
        `2025-09-05,NEFT House Rent Landlord,18000,debit\n` +
        `2025-09-18,Bescom Electricity Bill,2150,debit\n`;

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'finguard_sample_transactions.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Downloaded sample CSV template.', 'success');
}

async function submitCsvUpload() {
    if (!selectedCsvFile || !currentCreatedProfile) return;
    showPipelineProgressModal();

    try {
        const formData = new FormData();
        formData.append('file', selectedCsvFile);

        const res = await apiPost(`/api/profiles/${currentCreatedProfile.id}/upload-csv`, formData);
        finishOnboarding(res);
    } catch (e) {
        showToast('CSV Ingestion error: ' + e.message, 'error');
        renderOnboardingStep2();
    }
}

async function submitQuickTemplate() {
    if (!currentCreatedProfile) return;
    const selected = document.querySelector('input[name="quick-template"]:checked')?.value || 'tech_pro';
    showPipelineProgressModal();

    try {
        const res = await apiPost(`/api/profiles/${currentCreatedProfile.id}/quick-add`, {
            template_type: selected,
        });
        finishOnboarding(res);
    } catch (e) {
        showToast('Template Ingestion error: ' + e.message, 'error');
        renderOnboardingStep2();
    }
}

async function submitManualTransactions() {
    if (!currentCreatedProfile) return;
    const rows = document.querySelectorAll('.manual-txn-row');
    const txns = [];

    rows.forEach(r => {
        const date = r.querySelector('.txn-date')?.value;
        const desc = r.querySelector('.txn-desc')?.value.trim();
        const amt = parseFloat(r.querySelector('.txn-amt')?.value);
        const type = r.querySelector('.txn-type')?.value;

        if (date && desc && !isNaN(amt) && amt > 0) {
            txns.append ? txns.append({ date, description: desc, amount: amt, type }) : txns.push({ date, description: desc, amount: amt, type });
        }
    });

    if (txns.length === 0) {
        showToast('Please add at least one valid transaction.', 'warning');
        return;
    }

    showPipelineProgressModal();

    try {
        const res = await apiPost(`/api/profiles/${currentCreatedProfile.id}/quick-add`, {
            transactions: txns,
        });
        finishOnboarding(res);
    } catch (e) {
        showToast('Manual Ingestion error: ' + e.message, 'error');
        renderOnboardingStep2();
    }
}

function showPipelineProgressModal() {
    const body = document.getElementById('edit-modal-body');
    const title = document.getElementById('edit-modal-title');
    title.textContent = 'Running Financial Risk Pipeline';

    body.innerHTML = `
        <div style="text-align:center;padding:24px 10px">
            <div class="spinner" style="margin:0 auto 16px auto"></div>
            <h3 style="font-size:16px;color:var(--text-primary);margin-bottom:6px">Executing FinGuard Risk Pipeline</h3>
            <div style="font-size:13px;color:var(--text-secondary);margin-bottom:24px">
                Processing ${currentCreatedProfile?.name}'s transactions on isolated ledger...
            </div>

            <div style="display:flex;flex-direction:column;gap:12px;max-width:380px;margin:0 auto;text-align:left;font-size:13px">
                <div class="flex items-center gap-1" id="step-ingest">
                    <span style="color:var(--emerald)">✔</span> Ingesting transactions into SQLite database
                </div>
                <div class="flex items-center gap-1" id="step-cat">
                    <span style="color:var(--emerald)">✔</span> Running Tier 1 & 2 Categorization rules
                </div>
                <div class="flex items-center gap-1" id="step-anom">
                    <span style="color:var(--emerald)">✔</span> Evaluating rolling variances for statistical anomalies
                </div>
                <div class="flex items-center gap-1" id="step-rec">
                    <span style="color:var(--emerald)">✔</span> Synthesizing governed risk recommendations
                </div>
            </div>
        </div>
    `;
}

function finishOnboarding(result) {
    setTimeout(() => {
        closeModal();
        setActiveProfileObject(currentCreatedProfile);
        restoreAppLayout();
        navigateTo('dashboard');
        showToast(
            `Profile initialized! Ingested ${result.transactions_ingested} transactions, ${result.anomalies_detected} anomalies detected.`,
            'success'
        );
    }, 900);
}

// ─── Exports ──────────────────────────────────────────────────────────
window.getActiveProfileId = getActiveProfileId;
window.setActiveProfileId = setActiveProfileId;
window.getActiveProfileObject = getActiveProfileObject;
window.setActiveProfileObject = setActiveProfileObject;
window.updateSidebarProfile = updateSidebarProfile;
window.updateTopBarProfile = updateTopBarProfile;
window.renderLandingScreen = renderLandingScreen;
window.selectDemoProfile = selectDemoProfile;
window.selectCustomProfile = selectCustomProfile;
window.deleteCustomProfile = deleteCustomProfile;
window.openProfileSwitcherModal = openProfileSwitcherModal;
window.switchProfileFromModal = switchProfileFromModal;
window.showLandingViewFromModal = showLandingViewFromModal;
window.openOnboardingModal = openOnboardingModal;
window.renderOnboardingStep1 = renderOnboardingStep1;
window.submitOnboardingStep1 = submitOnboardingStep1;
window.renderOnboardingStep2 = renderOnboardingStep2;
window.switchOnboardingTab = switchOnboardingTab;
window.handleCsvFileSelected = handleCsvFileSelected;
window.downloadSampleCsv = downloadSampleCsv;
window.submitCsvUpload = submitCsvUpload;
window.submitQuickTemplate = submitQuickTemplate;
window.submitManualTransactions = submitManualTransactions;
window.addManualTxnRow = addManualTxnRow;
window.closeModal = closeModal;
