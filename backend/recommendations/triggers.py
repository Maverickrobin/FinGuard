"""Deterministic trigger conditions for recommendations.

These are pure Python functions — NO LLM. They decide WHETHER to
generate a recommendation based on concrete numeric conditions.

The LLM is only called AFTER a trigger fires, to phrase the
recommendation in natural language.
"""
from typing import List, Dict, Optional
from datetime import datetime
import pandas as pd
from backend.database import get_db, dicts_from_rows
from backend.analysis.anomaly_detector import get_anomalies
from backend.analysis.cashflow_forecaster import forecast_cashflow


def check_all_triggers() -> List[Dict]:
    """Run all trigger checks and return fired triggers.
    
    Each fired trigger includes the raw data context needed
    for the LLM to phrase a recommendation.
    """
    fired = []
    
    fired.extend(_trigger_forecast_zero_crossing())
    fired.extend(_trigger_recurring_charge_jump())
    fired.extend(_trigger_recurring_charge_drop())
    fired.extend(_trigger_category_over_budget())
    fired.extend(_trigger_goal_off_pace())
    fired.extend(_trigger_spending_trend_up())
    
    return fired


def _trigger_forecast_zero_crossing() -> List[Dict]:
    """Trigger: Cash flow forecast crosses zero within 90 days."""
    forecast = forecast_cashflow(days=90)
    
    if forecast.get("zero_crossing_date"):
        days_until = (
            datetime.strptime(forecast["zero_crossing_date"], "%Y-%m-%d")
            - datetime.now()
        ).days
        
        return [{
            "trigger_type": "forecast_zero_crossing",
            "severity": "high" if days_until <= 30 else "medium",
            "context": {
                "zero_crossing_date": forecast["zero_crossing_date"],
                "days_until": max(0, days_until),
                "current_balance": forecast["starting_balance"],
                "final_balance": forecast["final_balance"],
                "monthly_summary": forecast.get("monthly", []),
            },
            "suggested_action": {
                "type": "adjust_budget",
                "params": {
                    "category": "Dining",  # Default — LLM can refine
                    "new_limit": 3000,
                },
            },
        }]
    
    return []


def _trigger_recurring_charge_jump() -> List[Dict]:
    """Trigger: A recurring charge jumped >15% from previous (genuine price hike)."""
    anomalies = get_anomalies()
    
    triggers = []
    for a in anomalies:
        if a["anomaly_type"] == "recurring_price_change" and a["severity"] in ("medium", "high"):
            expected = a.get("expected_value", 0)
            actual = a.get("actual_value", 0)
            
            # CRITICAL: Only fire if charge genuinely increased
            if actual <= expected or expected <= 0:
                continue
            
            change_pct = round(((actual - expected) / expected) * 100, 1)
            merchant = a["description"].split(" charge")[0] if " charge" in a["description"] else "Unknown"
            category = a.get("category", "Subscriptions")
            
            # Subscriptions can be cancelled; utilities/bills are adjusted via budget
            if category == "Subscriptions" or merchant.lower() in ("netflix", "spotify", "prime", "hotstar"):
                action = {
                    "type": "cancel_subscription",
                    "params": {
                        "merchant": merchant,
                        "amount": actual,
                    },
                }
            else:
                action = {
                    "type": "adjust_budget",
                    "params": {
                        "category": category,
                        "new_limit": round(actual * 1.15, 0),
                    },
                }
            
            triggers.append({
                "trigger_type": "recurring_charge_jump",
                "severity": a["severity"],
                "context": {
                    "anomaly_id": a["id"],
                    "description": a["description"],
                    "expected_value": expected,
                    "actual_value": actual,
                    "category": category,
                    "merchant": merchant,
                    "change_pct": change_pct,
                    "severity": a["severity"],
                },
                "suggested_action": action,
            })
    
    return triggers


def _trigger_recurring_charge_drop() -> List[Dict]:
    """Trigger: A recurring charge dropped (positive savings insight)."""
    anomalies = get_anomalies()
    
    triggers = []
    for a in anomalies:
        if a["anomaly_type"] == "recurring_price_drop":
            expected = a.get("expected_value", 0)
            actual = a.get("actual_value", 0)
            savings = round(expected - actual, 2)
            merchant = a["description"].split(" bill")[0].split(" charge")[0] if " bill" in a["description"] or " charge" in a["description"] else "Unknown"
            change_pct = round(((expected - actual) / expected) * 100, 1) if expected > 0 else 0
            
            triggers.append({
                "trigger_type": "recurring_charge_drop",
                "severity": "low",
                "context": {
                    "anomaly_id": a["id"],
                    "description": a["description"],
                    "expected_value": expected,
                    "actual_value": actual,
                    "savings": savings,
                    "merchant": merchant,
                    "category": a.get("category", "Utilities"),
                    "change_pct": change_pct,
                },
                "suggested_action": None,  # Informational insight only
            })
    
    return triggers


def _trigger_category_over_budget() -> List[Dict]:
    """Trigger: A spending category is trending over its budget."""
    with get_db() as conn:
        budgets = conn.execute("SELECT * FROM budgets").fetchall()
        
        # Get current month's spending
        now = datetime.now()
        month_start = now.strftime("%Y-%m-01")
        month_end = now.strftime("%Y-%m-28")  # Safe end
        
        # Use latest month's data if no current month data
        latest_month = conn.execute("""
            SELECT strftime('%Y-%m', date) as month 
            FROM transactions 
            ORDER BY date DESC LIMIT 1
        """).fetchone()
        
        if latest_month:
            month_key = latest_month["month"]
            month_start = f"{month_key}-01"
            month_end = f"{month_key}-28"
        
        spending = conn.execute("""
            SELECT category, SUM(amount) as total
            FROM transactions
            WHERE type = 'debit' AND date >= ? AND date <= ?
            GROUP BY category
        """, (month_start, month_end)).fetchall()
    
    spending_map = {row["category"]: row["total"] for row in spending}
    
    triggers = []
    for budget in budgets:
        cat = budget["category"]
        limit = budget["monthly_limit"]
        spent = spending_map.get(cat, 0)
        
        if spent > limit * 0.9:  # >90% of budget
            pct = (spent / limit) * 100
            triggers.append({
                "trigger_type": "category_over_budget",
                "severity": "high" if pct >= 120 else "medium",
                "context": {
                    "category": cat,
                    "budget_limit": limit,
                    "amount_spent": round(spent, 2),
                    "percentage": round(pct, 1),
                    "overage": round(max(0, spent - limit), 2),
                },
                "suggested_action": {
                    "type": "set_spending_alert",
                    "params": {
                        "category": cat,
                        "threshold": limit,
                    },
                },
            })
    
    return triggers


def _trigger_goal_off_pace() -> List[Dict]:
    """Trigger: A financial goal is falling behind pace."""
    with get_db() as conn:
        goals = conn.execute(
            "SELECT * FROM goals WHERE status = 'active'"
        ).fetchall()
    
    triggers = []
    now = datetime.now()
    
    for goal in goals:
        if not goal["deadline"]:
            continue
        
        try:
            deadline = datetime.strptime(goal["deadline"], "%Y-%m-%d")
        except ValueError:
            continue
        
        # Calendar months calculation: (years diff * 12) + months diff
        months_remaining = (deadline.year - now.year) * 12 + (deadline.month - now.month)
        
        # Guard against past or near-zero deadlines (which cause division into huge monthly spikes)
        if months_remaining <= 0:
            # If target already met, skip
            if goal["current_amount"] >= goal["target_amount"]:
                continue
            # For overdue/passed targets, assume a realistic 12-month recovery horizon
            months_remaining = 12
            effective_deadline_str = f"{goal['deadline']} (Recovery 12mo)"
        else:
            effective_deadline_str = goal["deadline"]
        
        remaining_amount = goal["target_amount"] - goal["current_amount"]
        if remaining_amount <= 0:
            continue
        
        required_monthly = round(remaining_amount / months_remaining, 2)
        current_contrib = goal["monthly_contribution"] or 0
        
        if current_contrib < required_monthly * 0.8:
            shortfall = round(required_monthly - current_contrib, 2)
            triggers.append({
                "trigger_type": "goal_off_pace",
                "severity": "medium",
                "context": {
                    "goal_id": goal["id"],
                    "goal_name": goal["name"],
                    "target_amount": goal["target_amount"],
                    "current_amount": goal["current_amount"],
                    "remaining": round(remaining_amount, 2),
                    "months_remaining": round(months_remaining, 1),
                    "required_monthly": required_monthly,
                    "current_contribution": current_contrib,
                    "monthly_shortfall": shortfall,
                    "deadline": effective_deadline_str,
                },
                "suggested_action": {
                    "type": "update_goal_contribution",
                    "params": {
                        "goal_id": goal["id"],
                        "monthly_contribution": required_monthly,
                    },
                },
            })
    
    return triggers


def _trigger_spending_trend_up() -> List[Dict]:
    """Trigger: A category's spending is trending upward month-over-month."""
    with get_db() as conn:
        rows = conn.execute("""
            SELECT strftime('%Y-%m', date) as month, category, SUM(amount) as total
            FROM transactions
            WHERE type = 'debit' AND category IS NOT NULL
            GROUP BY month, category
            ORDER BY month
        """).fetchall()
    
    if not rows:
        return []
    
    df = pd.DataFrame(dicts_from_rows(rows))
    
    triggers = []
    
    for category, group in df.groupby("category"):
        if len(group) < 3:
            continue
        
        # Skip fixed recurring
        if category in ("Rent", "EMI", "Investments", "Insurance"):
            continue
        
        group = group.sort_values("month")
        amounts = group["total"].values
        
        # Check if last 2-3 months are consistently increasing
        if len(amounts) >= 3 and all(amounts[i] > amounts[i-1] for i in range(-2, 0)):
            growth_rate = (amounts[-1] - amounts[-3]) / amounts[-3]
            
            if growth_rate > 0.20:  # >20% growth over 3 months
                triggers.append({
                    "trigger_type": "spending_trend_up",
                    "severity": "low",
                    "context": {
                        "category": category,
                        "recent_months": [
                            {"month": m, "amount": round(a, 2)}
                            for m, a in zip(group["month"].values[-3:], amounts[-3:])
                        ],
                        "growth_rate": round(growth_rate * 100, 1),
                    },
                    "suggested_action": None,  # Insight only
                })
    
    return triggers
