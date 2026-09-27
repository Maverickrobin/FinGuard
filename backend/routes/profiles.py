"""Profile management and transaction onboarding routes for FinGuard."""
import io
import csv
import uuid
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Any
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Header
from pydantic import BaseModel

from backend.database import (
    get_db, dicts_from_rows, get_all_profiles, save_profile_metadata,
    delete_profile, set_active_profile
)
from backend.categorization.engine import categorize_transactions
from backend.analysis.anomaly_detector import detect_anomalies
from backend.recommendations.agent import generate_recommendations

router = APIRouter(prefix="/api/profiles", tags=["profiles"])


class ProfileCreateRequest(BaseModel):
    name: str
    role: str = "Working Professional"
    income: float = 75000.0
    city: str = "Bangalore"
    starting_balance: float = 35000.0


class ManualTransaction(BaseModel):
    date: str
    description: str
    amount: float
    type: str  # 'credit' | 'debit'


class QuickAddRequest(BaseModel):
    template_type: Optional[str] = None  # 'tech_pro' | 'freelancer' | 'student'
    transactions: Optional[List[ManualTransaction]] = None


@router.get("")
def list_profiles():
    """List all available profiles."""
    return {"profiles": get_all_profiles()}


@router.post("")
def create_profile(req: ProfileCreateRequest):
    """Create a new user profile with isolated ledger."""
    profile_id = f"user_{uuid.uuid4().hex[:8]}"
    created_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    profile_data = {
        "id": profile_id,
        "name": req.name.strip(),
        "role": req.role.strip(),
        "income": float(req.income),
        "city": req.city.strip(),
        "starting_balance": float(req.starting_balance),
        "is_demo": False,
        "created_at": created_at,
    }

    # Save metadata
    save_profile_metadata(profile_data)

    # Initialize the profile's dedicated database
    set_active_profile(profile_id)
    with get_db(profile_id=profile_id) as conn:
        # Scale budgets proportionally to their declared monthly income
        inc = float(req.income)
        budgets = [
            ("Groceries", round(inc * 0.10, 0)),
            ("Dining", round(inc * 0.08, 0)),
            ("Rent", round(inc * 0.25, 0)),
            ("Shopping", round(inc * 0.08, 0)),
            ("Entertainment", round(inc * 0.04, 0)),
            ("Transport", round(inc * 0.05, 0)),
            ("Utilities", round(inc * 0.05, 0)),
            ("Subscriptions", round(inc * 0.02, 0)),
            ("Investments", round(inc * 0.15, 0)),
        ]
        for cat, limit in budgets:
            conn.execute(
                "INSERT OR REPLACE INTO budgets (category, monthly_limit) VALUES (?, ?)",
                (cat, max(1000.0, limit))
            )

        # Set up a realistic 18-month Emergency Fund savings goal
        future_deadline = (datetime.now() + timedelta(days=540)).strftime("%Y-%m-%d")
        conn.execute("""
            INSERT OR REPLACE INTO goals
            (id, name, target_amount, current_amount, deadline, monthly_contribution, status)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            f"goal-emergency-{profile_id}",
            "Emergency Fund (6 months runway)",
            round(inc * 4.5, 0),
            round(req.starting_balance * 0.5, 0),
            future_deadline,
            round(inc * 0.12, 0),
            "active"
        ))

    return {"success": True, "profile": profile_data}


@router.delete("/{profile_id}")
def remove_profile(profile_id: str):
    """Delete a custom profile and its data."""
    if profile_id == "demo":
        raise HTTPException(status_code=400, detail="Cannot delete default Priya Sharma demo profile.")
    success = delete_profile(profile_id)
    return {"success": success}


@router.post("/{profile_id}/upload-csv")
async def upload_csv(
    profile_id: str,
    file: UploadFile = File(...)
):
    """Real CSV upload pipeline: Parse -> Ingest -> Categorize -> Detect Anomalies -> Generate Recommendations."""
    if profile_id == "demo":
        raise HTTPException(status_code=400, detail="Cannot overwrite demo profile. Create your own profile to upload data.")

    content = await file.read()
    text = content.decode("utf-8", errors="replace")
    
    # Process CSV
    transactions = _parse_csv_text(text)
    if not transactions:
        raise HTTPException(status_code=400, detail="No valid transactions parsed from CSV. Please check date and amount columns.")

    result = _ingest_and_run_pipeline(profile_id, transactions)
    return result


@router.post("/{profile_id}/quick-add")
def quick_add(profile_id: str, req: QuickAddRequest):
    """Quick-add transactions from a template or manual entry."""
    if profile_id == "demo":
        raise HTTPException(status_code=400, detail="Cannot modify demo profile.")

    # Generate or parse transactions
    if req.template_type:
        transactions = _generate_template_transactions(req.template_type)
    elif req.transactions:
        transactions = [t.dict() for t in req.transactions]
    else:
        raise HTTPException(status_code=400, detail="Specify a template_type or provide transaction rows.")

    if not transactions:
        raise HTTPException(status_code=400, detail="No transactions provided.")

    result = _ingest_and_run_pipeline(profile_id, transactions)
    return result


# ─── Helper Functions ─────────────────────────────────────────────────────────

def _parse_csv_text(csv_text: str) -> List[Dict]:
    """Flexible parser for various bank CSV column formats."""
    f = io.StringIO(csv_text.strip())
    reader = csv.reader(f)
    rows = list(reader)
    if not rows:
        return []

    # Detect header row
    header_idx = -1
    for i, r in enumerate(rows[:10]):
        row_str = " ".join(r).lower()
        if any(kw in row_str for kw in ("date", "amount", "description", "narration", "particulars", "debit")):
            header_idx = i
            break

    if header_idx == -1:
        header_idx = 0

    header = [c.strip().lower() for c in rows[header_idx]]
    data_rows = rows[header_idx + 1:]

    # Map column names
    date_col = next((i for i, h in enumerate(header) if any(k in h for k in ("date", "txn date", "value date"))), None)
    desc_col = next((i for i, h in enumerate(header) if any(k in h for k in ("description", "narration", "particulars", "details", "remark"))), None)
    amt_col = next((i for i, h in enumerate(header) if h in ("amount", "transaction amount", "net amount")), None)
    debit_col = next((i for i, h in enumerate(header) if "debit" in h or "withdrawal" in h), None)
    credit_col = next((i for i, h in enumerate(header) if "credit" in h or "deposit" in h), None)
    type_col = next((i for i, h in enumerate(header) if h in ("type", "dr/cr", "cr/dr", "txn type")), None)

    transactions = []
    
    for r in data_rows:
        if not r or len(r) <= max(filter(lambda x: x is not None, [date_col, desc_col, amt_col])):
            continue

        # Extract date
        raw_date = r[date_col].strip() if date_col is not None and date_col < len(r) else ""
        parsed_date = _clean_date(raw_date)
        if not parsed_date:
            continue

        # Extract description
        desc = r[desc_col].strip() if desc_col is not None and desc_col < len(r) else "Transaction"
        if not desc:
            desc = "Transaction"

        # Determine amount and type
        amount = 0.0
        txn_type = "debit"

        if debit_col is not None and credit_col is not None:
            deb_str = _clean_num(r[debit_col]) if debit_col < len(r) else ""
            cred_str = _clean_num(r[credit_col]) if credit_col < len(r) else ""
            if deb_str and float(deb_str) > 0:
                amount = float(deb_str)
                txn_type = "debit"
            elif cred_str and float(cred_str) > 0:
                amount = float(cred_str)
                txn_type = "credit"
        elif amt_col is not None and amt_col < len(r):
            raw_amt = _clean_num(r[amt_col])
            if raw_amt:
                amt_val = float(raw_amt)
                if amt_val < 0:
                    amount = abs(amt_val)
                    txn_type = "debit"
                else:
                    amount = amt_val
                    # Check type column if available
                    if type_col is not None and type_col < len(r):
                        t_val = r[type_col].lower()
                        txn_type = "credit" if any(w in t_val for w in ("cr", "credit", "deposit")) else "debit"
                    else:
                        txn_type = "debit"

        if amount > 0:
            transactions.append({
                "date": parsed_date,
                "description": desc,
                "amount": round(amount, 2),
                "type": txn_type,
            })

    return transactions


def _clean_num(val_str: str) -> str:
    """Clean numeric currency string (strip commas, symbols)."""
    return "".join(c for c in val_str if c.isdigit() or c in (".", "-"))


def _clean_date(date_str: str) -> Optional[str]:
    """Parse various common date formats to YYYY-MM-DD."""
    cleaned = date_str.strip().split(" ")[0]
    formats = [
        "%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y", "%d-%m-%Y",
        "%Y/%m/%d", "%d.%m.%Y", "%d %b %Y", "%d %B %Y"
    ]
    for fmt in formats:
        try:
            dt = datetime.strptime(cleaned, fmt)
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            pass
    return None


def _ingest_and_run_pipeline(profile_id: str, transactions: List[Dict]) -> Dict:
    """Run full ingestion, categorization, anomaly detection, and recommendation pipeline on scoped database."""
    set_active_profile(profile_id)

    # Sort chronologically to compute running balance
    transactions.sort(key=lambda t: t["date"])

    with get_db(profile_id=profile_id) as conn:
        # Check initial balance
        last_row = conn.execute("SELECT balance_after FROM transactions ORDER BY date DESC LIMIT 1").fetchone()
        running_balance = float(last_row["balance_after"]) if last_row and last_row["balance_after"] else 25000.0

        inserted_count = 0
        for t in transactions:
            txn_id = f"txn_{uuid.uuid4().hex[:12]}"
            amt = float(t["amount"])
            if t["type"] == "credit":
                running_balance += amt
            else:
                running_balance -= amt

            # Check if recurring heuristic
            is_recurring = 0
            rec_group = None
            desc_lower = t["description"].lower()
            if any(w in desc_lower for w in ("salary", "rent", "emi", "loan", "netflix", "spotify", "bescom", "electricity", "jio", "airtel", "sip")):
                is_recurring = 1
                rec_group = t["description"].split()[0].upper()

            conn.execute("""
                INSERT INTO transactions
                (id, date, description, amount, type, balance_after,
                 raw_description, category, is_recurring, recurring_group_id, category_source)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'uploaded')
            """, (
                txn_id, t["date"], t["description"], amt, t["type"],
                round(running_balance, 2), t["description"],
                t.get("category"), is_recurring, rec_group
            ))
            inserted_count += 1

    # 1. Real tiered categorization
    cat_result = categorize_transactions(force_recategorize=True)

    # 2. Real anomaly detection
    anomalies = detect_anomalies()

    # 3. Real recommendations synthesis
    recs = generate_recommendations()

    return {
        "success": True,
        "profile_id": profile_id,
        "transactions_ingested": inserted_count,
        "categorized_count": cat_result.get("categorized", 0),
        "anomalies_detected": len(anomalies),
        "recommendations_generated": len(recs),
    }


def _generate_template_transactions(template_type: str) -> List[Dict]:
    """Generates realistic starter transactions across the last 90 days for fallback templates."""
    now = datetime.now()
    txns = []

    def d(days_ago):
        return (now - timedelta(days=days_ago)).strftime("%Y-%m-%d")

    if template_type == "freelancer":
        txns.extend([
            {"date": d(85), "description": "Upwork Escrow Client Payout", "amount": 65000, "type": "credit"},
            {"date": d(75), "description": "WeWork Shared Desk Pass", "amount": 8500, "type": "debit"},
            {"date": d(70), "description": "Adobe Creative Cloud Annual", "amount": 4200, "type": "debit"},
            {"date": d(60), "description": "Client Web App Retainer Phase 1", "amount": 80000, "type": "credit"},
            {"date": d(55), "description": "House Rent via NEFT", "amount": 20000, "type": "debit"},
            {"date": d(45), "description": "Zomato Dinner Order", "amount": 850, "type": "debit"},
            {"date": d(30), "description": "Upwork Project Delivery Bonus", "amount": 95000, "type": "credit"},
            {"date": d(25), "description": "Amazon India Camera Lens", "amount": 28000, "type": "debit"},
            {"date": d(15), "description": "Electricity BESCOM Bill", "amount": 2100, "type": "debit"},
            {"date": d(5), "description": "Swiggy Gourmet Order", "amount": 1200, "type": "debit"},
        ])
    elif template_type == "student":
        txns.extend([
            {"date": d(88), "description": "Monthly Stipend Credit", "amount": 25000, "type": "credit"},
            {"date": d(85), "description": "Hostel PG Rent Payment", "amount": 10000, "type": "debit"},
            {"date": d(70), "description": "College Mess Food Charges", "amount": 3500, "type": "debit"},
            {"date": d(60), "description": "Metro Card Recharge", "amount": 1000, "type": "debit"},
            {"date": d(58), "description": "Monthly Stipend Credit", "amount": 25000, "type": "credit"},
            {"date": d(45), "description": "Bookstore Academic Textbooks", "amount": 2400, "type": "debit"},
            {"date": d(30), "description": "Netflix Mobile Subscription", "amount": 199, "type": "debit"},
            {"date": d(28), "description": "Monthly Stipend Credit", "amount": 25000, "type": "credit"},
            {"date": d(14), "description": "Cafe Coffee Day Study Session", "amount": 450, "type": "debit"},
            {"date": d(3), "description": "Zepto Quick Snack Order", "amount": 320, "type": "debit"},
        ])
    else:  # tech_pro default
        txns.extend([
            {"date": d(89), "description": "Salary Credit Infosys Bangalore", "amount": 75000, "type": "credit"},
            {"date": d(85), "description": "Apartment Rent Transfer", "amount": 18000, "type": "debit"},
            {"date": d(80), "description": "Groww Mutual Fund SIP", "amount": 7000, "type": "debit"},
            {"date": d(70), "description": "BigBasket Monthly Groceries", "amount": 4500, "type": "debit"},
            {"date": d(59), "description": "Salary Credit Infosys Bangalore", "amount": 75000, "type": "credit"},
            {"date": d(55), "description": "HDFC Auto Loan EMI", "amount": 11000, "type": "debit"},
            {"date": d(45), "description": "Amazon India Monitor Purchase", "amount": 14500, "type": "debit"},
            {"date": d(30), "description": "Salary Credit Infosys Bangalore", "amount": 75000, "type": "credit"},
            {"date": d(25), "description": "Swiggy Food Delivery Indiranagar", "amount": 1150, "type": "debit"},
            {"date": d(18), "description": "Bescom Electricity Payment", "amount": 1950, "type": "debit"},
            {"date": d(10), "description": "Netflix 4K Subscription", "amount": 649, "type": "debit"},
            {"date": d(2), "description": "Cult.fit Monthly Membership", "amount": 1750, "type": "debit"},
        ])

    return txns
