# 🛡️ FinGuard — AI-Powered Personal Finance & Financial Risk Agent

> **Built for Bit N Build Hackathon**  
> An intelligent financial risk guardian that detects spending anomalies, forecasts cash flow, models what-if scenarios, and delivers actionable recommendations — while enforcing an **uncompromising, code-level Human Approval Gate** for high-impact financial actions.

---

## 🚀 The Non-Negotiable Core: Hard Human Approval Gate

Most AI agents treat safety as a system prompt instruction: *"Please ask the user before transferring money."*  
In the real world, prompts can hallucinate, system instructions can be bypassed, and autonomous loops can accidentally trigger irreversible financial damage.

**FinGuard is built differently.**  
In FinGuard, human oversight is enforced at the **code level**, not the prompt level:

```python
def execute_action(action_id: str) -> Dict:
    action = get_pending_action(action_id)
    if action is None:
        raise ActionNotFoundError(action_id)

    # ══════════════════════════════════════════════════════════════
    #  THE HARD GATE — Refuses execution unless status is 'approved'
    # ══════════════════════════════════════════════════════════════
    if action["status"] != "approved":
        log_audit_event(action_id, "execution_blocked", {
            "current_status": action["status"],
            "reason": "Action has not been approved by a human.",
        })
        raise ApprovalRequiredError(action_id, action["status"])

    # Execution proceeds only after passing this gate
    ...
```

### Guarantees Enforced:
1. **Zero Silent Approvals**: No timeout or default can ever convert silence into approval.
2. **Three Explicit Human Choices**:
   - **✓ Approve**: Authorizes the action to be executed.
   - **✏️ Edit**: Allows the user to inspect and adjust parameters (e.g., reduce transfer amount or tweak budget limits) before approving.
   - **✕ Reject**: Permanently cancels the proposed action.
3. **Immutable Audit Trail**: Every state transition (`proposed` → `shown` → `edited` → `approved` / `rejected` → `executed`) is logged to the `audit_log` table with precise timestamps and context.
4. **Idempotency & Replay Defense**: Actions already executed cannot be re-executed (`ActionAlreadyExecutedError`).

---

## 🏗️ System Architecture & Data Flow

```mermaid
graph TD
    A[Synthetic Data Generator] -->|6 months Seeded Data| B[(SQLite Database)]
    B --> C[3-Tier Categorization Engine]
    C -->|Tier 1: RapidFuzz Merchant Lookup| B
    C -->|Tier 2: Regex & Keyword Rules| B
    C -->|Tier 3: Gemini Flash LLM Fallback| B
    
    B --> D[Anomaly Detector]
    B --> E[90-Day Cash Flow Forecaster]
    E --> F[What-If Scenario Simulator]
    
    D --> G[Deterministic Recommendation Triggers]
    E --> G
    
    G --> H[Deterministic Impact Classifier]
    H -->|Low Impact: Insights| I[Dashboard Insights]
    H -->|Medium / High Impact| J[Approval Gate Queue]
    
    J --> K{Human Decision}
    K -->|Approve| L[Hard Gate: execute_action()]
    K -->|Edit Parameters| L
    K -->|Reject| M[Block Execution & Log]
    
    L --> N[Apply Action & Record Audit Trail]
```

---

## ⚡ Key Capabilities

### 1. Stage 1: Data Ingestion & Persona Modeling
- Models **Priya Sharma** (28, Software Engineer in Bangalore) earning ₹85,000/month with realistic recurring expenses (Rent ₹22k, Car EMI ₹12.5k, SIPs, utilities) and typical discretionary expenses.
- **Seeded Anomalies** for demonstration:
  - 📈 **Subscription Price Increase**: Netflix increases from ₹649 to ₹899 (+38.5%) in month 4.
  - 💳 **Outlier Transaction**: Unusually large ₹45,000 shopping expense in month 3.
  - ⚠️ **Cash Flow Strain**: Elevated discretionary spending causing near-zero cash flow buffer.

### 2. Stage 2: 3-Tier Categorization Pipeline
- **Tier 1 (Fuzzy Merchant Database)**: Matches ~150 popular Indian merchants (Swiggy, Zomato, Zepto, DMart, BESCOM, Cult.fit, etc.) using `rapidfuzz` token set ratio with threshold ≥ 85.
- **Tier 2 (Regex & Rule Engine)**: Detects salary credits, house rent, EMIs, and mutual fund SIPs from transaction narratives.
- **Tier 3 (LLM Fallback)**: Batched categorization using Google Gemini 2.0 Flash with strict schema validation against a fixed 18-category financial enum, with automatic heuristic fallback if offline.

### 3. Stage 3: Risk Analysis Core
- **Anomaly Detection**:
  - 60-day rolling mean and standard deviation per category (flags transactions > 2σ).
  - Recurring price tracker that flags jumps > 15% across consecutive billing cycles for identical merchants.
- **Cash Flow Forecaster**:
  - 90-day forward projection modeling recurring debits and discretionary 30-day Simple Moving Average (SMA).
  - Daily projected balance tracking with **Zero-Crossing Detection** (flags the exact calendar date balance is projected to fall below ₹0).
- **What-If Scenario Simulator**:
  - Dynamic simulation of spending adjustments (e.g., -30% dining, +₹3,000 rent hike, bonus credits) showing side-by-side comparison against baseline cash flow.

### 4. Stage 4 & 5: Recommendation Engine & Hard Approval Gate
- **Deterministic Triggers**: Independent rule functions evaluate budget overages, upcoming zero-crossing dates, recurring charge surges, and lagging savings goals.
- **Impact Classifier**: Deterministically scores impact level (Low / Medium / High) based on:
  - Whether the action moves money or modifies recurring financial commitments.
  - Transaction amount threshold (e.g. > ₹5,000).
  - Reversibility of the proposed action.
- **Approval Gate Controller**:
  - High and Medium impact actions are locked into `pending_actions` table.
  - Frontend provides a visual cockpit showing Pending Decisions, Impact Badge, Rationale, and Action Controls (**Approve**, **Edit & Approve**, **Reject**).
  - Hard server check guarantees no action executes without explicit authorization.

---

## 💻 Tech Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Backend** | Python 3.12 + FastAPI | High-performance asynchronous REST API |
| **Data Engine** | Pandas + NumPy | Rolling statistics, cash flow series & projections |
| **Fuzzy Matching**| RapidFuzz | Rapid sub-millisecond merchant fuzzy matching |
| **Database** | SQLite3 | Zero-configuration local database with ACID transactions |
| **LLM Engine** | Google Gemini 2.0 Flash | Transaction categorization fallback & recommendation phrasing |
| **Frontend** | Vanilla HTML5, CSS3, ES6+ JS | Lightweight SPA with zero build steps |
| **Styling** | Custom CSS Glassmorphism | Dark theme, neon accents, responsive layout |
| **Charts** | Chart.js 4.4 | Income/Expense trendlines, donut category splits, cash flow forecast curves |

---

## 🛠️ Quick Start & Running Locally

### 1. Clone & Setup Environment

```bash
# Clone the repository
git clone <repo-url>
cd "Bit N BUild Hackathon"

# Create virtual environment and install dependencies
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 2. Optional: Configure Gemini API Key
To enable optional live Gemini LLM categorization and phrased recommendations:
```bash
export GEMINI_API_KEY="your-gemini-api-key"
```
*(Note: FinGuard includes built-in heuristic fallbacks, so the system runs completely offline without an API key!)*

### 3. Run Application

```bash
python run.py
```

Open your browser to:
👉 **http://localhost:8000**

---

## 🧪 Verification & Automated Tests

To run the automated test suite verifying the Approval Gate, Anomaly Detection, Categorization, and Cash Flow Forecaster:

```bash
.venv/bin/pytest tests/ -v
```

All 11+ tests verify:
- [x] Hard gate blocks execution when status is `pending`
- [x] Hard gate blocks execution when status is `rejected`
- [x] Approval transitions action and permits single execution
- [x] Replay attacks are blocked (`ActionAlreadyExecutedError`)
- [x] User can edit parameters before approval and execution honors edits
- [x] Anomaly detector identifies planted Netflix price jump and large transactions
- [x] 90-day cash flow projections and zero-crossing detection
- [x] What-If scenario engine computes baseline vs. adjusted trajectories

---

## 📂 Project Structure

```
├── backend/
│   ├── app.py                       # FastAPI application & route mounting
│   ├── database.py                  # SQLite schema & connection helpers
│   ├── analysis/
│   │   ├── anomaly_detector.py      # Rolling 60-day & subscription price anomaly engine
│   │   ├── cashflow_forecaster.py   # 90-day forward cash flow projection & zero-crossing
│   │   └── scenario_engine.py       # Parameterized what-if simulation engine
│   ├── approval/
│   │   ├── gate.py                  # THE HARD APPROVAL GATE (Code-level execution lock)
│   │   └── audit.py                 # Comprehensive audit trail logging
│   ├── categorization/
│   │   ├── engine.py                # 3-tier categorization orchestrator
│   │   ├── merchant_lookup.py       # Tier 1: RapidFuzz Indian merchant database
│   │   ├── rules.py                 # Tier 2: Regex patterns (Salary, Rent, EMI, SIP)
│   │   └── llm_fallback.py          # Tier 3: Gemini 2.0 Flash LLM categorizer
│   ├── ingestion/
│   │   └── synthetic_generator.py   # Priya Sharma persona generator with 3 planted anomalies
│   ├── recommendations/
│   │   ├── triggers.py              # Deterministic financial trigger conditions
│   │   ├── impact_classifier.py     # Deterministic low/medium/high scoring
│   │   └── agent.py                 # Recommendation orchestrator & gate routing
│   └── routes/
│       ├── approval.py              # /api/pending-actions, /api/approve, /api/execute
│       ├── analysis.py              # /api/anomalies, /api/forecast, /api/scenario
│       ├── dashboard.py             # /api/dashboard, /api/transactions
│       └── recommendations.py       # /api/recommendations
├── frontend/
│   ├── index.html                   # Single Page Application cockpit shell
│   ├── css/
│   │   └── style.css                # Premium dark glassmorphic design system
│   └── js/
│       ├── app.js                   # Client-side router, toasts, modal controllers
│       ├── approval.js              # Approval gate UI (Approve, Edit, Reject cards)
│       ├── dashboard.js             # Financial summary, charts, goals progress
│       ├── transactions.js          # Filterable, paginated transaction ledger
│       ├── analysis.js              # Anomaly inspection & 90-day forecast chart
│       ├── scenarios.js             # Interactive what-if sandbox
│       └── recommendations.js       # Recommendation cards grouped by risk level
├── seeds/
│   └── merchants.json               # Seed catalog of 150+ Indian merchants
├── tests/
│   ├── test_approval_gate.py        # Core differentiator unit tests
│   └── test_analysis.py             # Categorization, anomaly & forecaster tests
├── requirements.txt
├── run.py                           # Single-entry bootstrapper
└── README.md
```

---

## 🏆 Hackathon Evaluation Checklist

| Evaluation Criterion | FinGuard Implementation |
|----------------------|-------------------------|
| **Hard Human Approval Gate** | Implemented directly inside `execute_action()` in `backend/approval/gate.py`. Refuses execution unless status is `approved`. |
| **No Default / Timeout Bypass** | Silence is strictly unapproved. State must be explicitly modified by user action. |
| **Full Decision Capabilities** | Dedicated UI and API endpoints for **Approve**, **Edit** (with customized parameters), and **Reject**. |
| **Comprehensive Audit Logging** | Complete event stream recorded in `audit_log` with timestamp, actor, and parameter snapshots. |
| **Anomaly Detection** | Dual-mode detector: rolling category standard deviations (> 2σ) and recurring subscription jump tracker. |
| **Cash Flow Forecasting** | 90-day projection modeling recurring expenses, discretionary SMA, and automated zero-crossing detection. |
| **What-If Scenario Simulation** | Interactive sliders and preset templates to test budget cuts, rent hikes, and income adjustments. |
| **Tiered Categorization** | RapidFuzz fuzzy merchant lookup + regex rules + Gemini 2.0 Flash fallback with offline resilience. |
| **Production-Ready UX** | Dark glassmorphism dashboard, real-time Chart.js graphs, filterable ledgers, modal editors, and toast notifications. |
