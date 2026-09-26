"""Dashboard and transaction API routes."""
from fastapi import APIRouter, Query
from typing import Optional
from backend.database import get_db, dicts_from_rows
from backend.categorization.engine import (
    categorize_transactions, save_user_override, get_flagged_transactions
)
from backend.categorization.merchant_lookup import CATEGORIES

router = APIRouter(prefix="/api", tags=["dashboard"])


@router.get("/dashboard")
def get_dashboard():
    """Get dashboard summary data."""
    with get_db() as conn:
        # Total balance
        last_txn = conn.execute(
            "SELECT balance_after FROM transactions ORDER BY date DESC LIMIT 1"
        ).fetchone()
        balance = last_txn["balance_after"] if last_txn else 0
        
        # Monthly income/expense for last 6 months
        monthly = conn.execute("""
            SELECT 
                strftime('%Y-%m', date) as month,
                SUM(CASE WHEN type = 'credit' THEN amount ELSE 0 END) as income,
                SUM(CASE WHEN type = 'debit' THEN amount ELSE 0 END) as expense
            FROM transactions
            GROUP BY month
            ORDER BY month
        """).fetchall()
        
        # Category breakdown (current month or latest month)
        latest_month = conn.execute(
            "SELECT strftime('%Y-%m', date) as m FROM transactions ORDER BY date DESC LIMIT 1"
        ).fetchone()
        month_key = latest_month["m"] if latest_month else ""
        
        categories = conn.execute("""
            SELECT category, SUM(amount) as total, COUNT(*) as count
            FROM transactions
            WHERE type = 'debit' AND strftime('%Y-%m', date) = ?
            GROUP BY category
            ORDER BY total DESC
        """, (month_key,)).fetchall()
        
        # Budget vs actual
        budgets = conn.execute("SELECT * FROM budgets").fetchall()
        budget_map = {b["category"]: b["monthly_limit"] for b in budgets}
        
        budget_comparison = []
        for cat in categories:
            limit = budget_map.get(cat["category"], None)
            budget_comparison.append({
                "category": cat["category"],
                "spent": round(cat["total"], 2),
                "budget": limit,
                "percentage": round((cat["total"] / limit) * 100, 1) if limit else None,
            })
        
        # Goals
        goals = conn.execute("SELECT * FROM goals").fetchall()
        
        # Anomaly count
        anomaly_count = conn.execute(
            "SELECT COUNT(*) as c FROM anomalies WHERE acknowledged = 0"
        ).fetchone()["c"]
        
        # Pending actions count
        pending_count = conn.execute(
            "SELECT COUNT(*) as c FROM pending_actions WHERE status = 'pending'"
        ).fetchone()["c"]
        
        # Transaction count
        txn_count = conn.execute(
            "SELECT COUNT(*) as c FROM transactions"
        ).fetchone()["c"]
    
    return {
        "balance": round(balance, 2),
        "monthly_summary": dicts_from_rows(monthly),
        "category_breakdown": budget_comparison,
        "goals": dicts_from_rows(goals),
        "anomaly_count": anomaly_count,
        "pending_actions_count": pending_count,
        "transaction_count": txn_count,
        "current_month": month_key,
    }


@router.get("/transactions")
def get_transactions(
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=10, le=200),
    category: Optional[str] = None,
    type: Optional[str] = None,
    month: Optional[str] = None,
    flagged: Optional[bool] = None,
):
    """Get paginated transactions with filters."""
    offset = (page - 1) * per_page
    
    with get_db() as conn:
        query = "SELECT * FROM transactions WHERE 1=1"
        count_query = "SELECT COUNT(*) as total FROM transactions WHERE 1=1"
        params = []
        
        if category:
            query += " AND category = ?"
            count_query += " AND category = ?"
            params.append(category)
        
        if type:
            query += " AND type = ?"
            count_query += " AND type = ?"
            params.append(type)
        
        if month:
            query += " AND strftime('%Y-%m', date) = ?"
            count_query += " AND strftime('%Y-%m', date) = ?"
            params.append(month)
        
        if flagged is not None:
            query += " AND flagged_for_review = ?"
            count_query += " AND flagged_for_review = ?"
            params.append(1 if flagged else 0)
        
        total = conn.execute(count_query, params).fetchone()["total"]
        
        query += " ORDER BY date DESC LIMIT ? OFFSET ?"
        rows = conn.execute(query, params + [per_page, offset]).fetchall()
    
    return {
        "transactions": dicts_from_rows(rows),
        "total": total,
        "page": page,
        "per_page": per_page,
        "pages": (total + per_page - 1) // per_page,
    }


@router.get("/categories")
def get_categories():
    """Get available categories."""
    return {"categories": CATEGORIES}


@router.post("/categorize")
def run_categorization(force: bool = False):
    """Run the categorization pipeline."""
    result = categorize_transactions(force_recategorize=force)
    return result


@router.post("/override-category")
def override_category(transaction_id: str, category: str,
                       description_pattern: str = None):
    """Save a user category override."""
    with get_db() as conn:
        # Update this specific transaction
        conn.execute(
            "UPDATE transactions SET category = ?, category_source = 'user_override', "
            "category_confidence = 1.0, flagged_for_review = 0 WHERE id = ?",
            (category, transaction_id),
        )
        
        # Get the description for the override pattern
        if not description_pattern:
            row = conn.execute(
                "SELECT description FROM transactions WHERE id = ?",
                (transaction_id,)
            ).fetchone()
            if row:
                description_pattern = row["description"]
    
    if description_pattern:
        save_user_override(description_pattern, category)
    
    return {"success": True, "transaction_id": transaction_id, "category": category}


@router.get("/flagged")
def get_flagged():
    """Get transactions flagged for user review."""
    return {"transactions": get_flagged_transactions()}
