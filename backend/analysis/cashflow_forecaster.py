"""Cash flow forecaster for FinGuard.

Projects known recurring income/expenses forward, adds a variability
term for discretionary spend from recent averages (30-day SMA),
computes daily balance trajectory, and surfaces the first date
the balance crosses zero.

This is the SINGLE forecast function — the scenario engine reuses
it with adjusted parameters rather than building a second model.
"""
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
import pandas as pd
import numpy as np
from backend.database import get_db, dicts_from_rows


DEFAULT_FORECAST_DAYS = 90


def forecast_cashflow(
    days: int = DEFAULT_FORECAST_DAYS,
    overrides: Optional[Dict[str, float]] = None,
    start_date: Optional[str] = None,
) -> Dict:
    """Forecast cash flow for the next N days.
    
    Args:
        days: Number of days to forecast.
        overrides: Dict of category → adjustment.
            - If value is between -1 and 1, treat as percentage change
              (e.g., -0.30 = reduce by 30%)
            - If |value| > 1, treat as absolute change
              (e.g., 3000 = increase by ₹3000/month)
        start_date: Start forecasting from this date (YYYY-MM-DD).
                    Defaults to the last transaction date.
    
    Returns:
        Dict with forecast data, zero-crossing info, and summary.
    """
    overrides = overrides or {}
    
    # ─── Gather historical data ───
    with get_db() as conn:
        rows = conn.execute("""
            SELECT * FROM transactions ORDER BY date DESC LIMIT 1
        """).fetchone()
        
        if rows is None:
            return {"error": "No transaction data available"}
        
        last_txn = dict(rows)
        
        all_rows = conn.execute("""
            SELECT * FROM transactions ORDER BY date
        """).fetchall()
    
    df = pd.DataFrame(dicts_from_rows(all_rows))
    df["date"] = pd.to_datetime(df["date"])
    df["amount"] = df["amount"].astype(float)
    
    # Starting point
    if start_date:
        forecast_start = pd.Timestamp(start_date)
    else:
        forecast_start = df["date"].max() + timedelta(days=1)
    
    current_balance = float(last_txn["balance_after"])
    
    # ─── Analyze recurring transactions ───
    recurring_items = _extract_recurring_patterns(df)
    
    # ─── Analyze discretionary spending patterns (30-day SMA) ───
    discretionary_daily = _estimate_daily_discretionary(df)
    
    # ─── Apply overrides ───
    recurring_items = _apply_overrides_recurring(recurring_items, overrides)
    discretionary_daily = _apply_overrides_discretionary(
        discretionary_daily, overrides
    )
    
    # ─── Project forward day by day ───
    daily_forecast = []
    balance = current_balance
    zero_crossing_date = None
    
    for day_offset in range(days):
        date = forecast_start + timedelta(days=day_offset)
        day_of_month = date.day
        
        daily_income = 0.0
        daily_expense = 0.0
        daily_items = []
        
        # Check recurring items
        for item in recurring_items:
            if item["day_of_month"] == day_of_month:
                if item["type"] == "credit":
                    daily_income += item["amount"]
                    daily_items.append({
                        "name": item["name"],
                        "amount": item["amount"],
                        "type": "credit",
                    })
                else:
                    daily_expense += item["amount"]
                    daily_items.append({
                        "name": item["name"],
                        "amount": item["amount"],
                        "type": "debit",
                    })
        
        # Add discretionary spending (spread across the month,
        # slightly weighted toward weekends)
        is_weekend = date.weekday() >= 5
        disc_multiplier = 1.3 if is_weekend else 0.9
        disc_amount = discretionary_daily * disc_multiplier
        
        # Add small deterministic weekend/weekday variance for realism
        rng = np.random.RandomState(42 + day_offset)
        noise = rng.normal(0, disc_amount * 0.05)
        disc_amount = max(0, disc_amount + noise)
        
        daily_expense += disc_amount
        
        # Update balance
        net = daily_income - daily_expense
        balance += net
        
        daily_forecast.append({
            "date": date.strftime("%Y-%m-%d"),
            "income": round(daily_income, 2),
            "expense": round(daily_expense, 2),
            "discretionary": round(disc_amount, 2),
            "net": round(net, 2),
            "balance": round(balance, 2),
            "items": daily_items,
        })
        
        # Check for zero crossing
        if balance <= 0 and zero_crossing_date is None:
            zero_crossing_date = date.strftime("%Y-%m-%d")
    
    # ─── Compute weekly aggregates ───
    weekly_forecast = _aggregate_weekly(daily_forecast)
    
    # ─── Monthly summary ───
    monthly_summary = _aggregate_monthly(daily_forecast)
    
    return {
        "starting_balance": round(current_balance, 2),
        "forecast_start": forecast_start.strftime("%Y-%m-%d"),
        "forecast_days": days,
        "overrides_applied": overrides,
        "daily": daily_forecast,
        "weekly": weekly_forecast,
        "monthly": monthly_summary,
        "zero_crossing_date": zero_crossing_date,
        "final_balance": round(balance, 2),
        "recurring_items": recurring_items,
        "daily_discretionary_estimate": round(discretionary_daily, 2),
    }


def _extract_recurring_patterns(df: pd.DataFrame) -> List[Dict]:
    """Extract recurring income/expense patterns from transaction history."""
    recurring = df[df["is_recurring"] == 1].copy()
    
    if recurring.empty:
        return []
    
    items = []
    
    for group_id, group in recurring.groupby("recurring_group_id"):
        if group_id is None:
            continue
        
        # Use the most recent amount
        latest = group.sort_values("date").iloc[-1]
        
        # Determine typical day of month
        days = group["date"].dt.day
        typical_day = int(days.mode().iloc[0]) if len(days.mode()) > 0 else int(days.median())
        
        items.append({
            "name": group_id.replace("_", " ").title(),
            "amount": round(float(latest["amount"]), 2),
            "type": latest["type"],
            "category": latest["category"],
            "day_of_month": typical_day,
            "merchant": latest.get("merchant_name", ""),
        })
    
    return items


def _estimate_daily_discretionary(df: pd.DataFrame) -> float:
    """Estimate daily discretionary spending using 30-day SMA.
    
    Discretionary = everything that's not recurring.
    """
    non_recurring_debits = df[
        (df["is_recurring"] == 0) & (df["type"] == "debit")
    ].copy()
    
    if non_recurring_debits.empty:
        return 0.0
    
    # Get last 60 days of data for a stable average
    cutoff = df["date"].max() - timedelta(days=60)
    recent = non_recurring_debits[non_recurring_debits["date"] >= cutoff]
    
    if recent.empty:
        recent = non_recurring_debits
    
    total_spend = recent["amount"].sum()
    date_range = (recent["date"].max() - recent["date"].min()).days + 1
    
    if date_range <= 0:
        return 0.0
    
    daily_avg = total_spend / date_range
    return round(daily_avg, 2)


def _normalize_overrides(overrides: Dict[str, float]) -> Dict[str, float]:
    """Normalize override keys and handle aliases."""
    normalized = {}
    alias_map = {
        "sip": "Investments",
        "investments": "Investments",
        "investment": "Investments",
        "salary": "Salary",
        "rent": "Rent",
        "dining": "Dining",
        "shopping": "Shopping",
        "entertainment": "Entertainment",
        "transport": "Transport",
        "groceries": "Groceries",
        "utilities": "Utilities",
        "emi": "EMI",
        "subscriptions": "Subscriptions",
    }
    for k, v in overrides.items():
        canonical = alias_map.get(k.lower(), k)
        normalized[canonical] = v
    return normalized


def _apply_overrides_recurring(items: List[Dict],
                                 overrides: Dict[str, float]) -> List[Dict]:
    """Apply overrides to recurring items."""
    norm_overrides = _normalize_overrides(overrides)
    for item in items:
        category = item.get("category", "")
        if category in norm_overrides:
            adjustment = norm_overrides[category]
            if -1 <= adjustment <= 1:
                # Percentage change
                item["amount"] = round(item["amount"] * (1 + adjustment), 2)
            else:
                # Absolute change
                item["amount"] = round(max(0, item["amount"] + adjustment), 2)
    return items


def _apply_overrides_discretionary(daily_avg: float,
                                    overrides: Dict[str, float]) -> float:
    """Apply overrides to discretionary spending estimate."""
    norm_overrides = _normalize_overrides(overrides)
    # Check for discretionary categories
    disc_categories = ["Dining", "Shopping", "Entertainment", "Transport", "Groceries"]
    
    total_adjustment = 0.0
    adjustment_count = 0
    
    for cat in disc_categories:
        if cat in norm_overrides:
            adj = norm_overrides[cat]
            if -1 <= adj <= 1:
                total_adjustment += adj
            else:
                # Convert absolute to approximate percentage
                # Assume each discretionary category is ~20% of total
                total_adjustment += adj / (daily_avg * 30 * 0.2) if daily_avg > 0 else 0
            adjustment_count += 1
    
    if adjustment_count > 0:
        avg_adjustment = total_adjustment / len(disc_categories)
        daily_avg *= (1 + avg_adjustment)
    
    return max(0, daily_avg)


def _aggregate_weekly(daily: List[Dict]) -> List[Dict]:
    """Aggregate daily forecast into weekly buckets."""
    weekly = []
    current_week = {
        "week_start": daily[0]["date"] if daily else "",
        "income": 0, "expense": 0, "net": 0,
    }
    
    for i, day in enumerate(daily):
        current_week["income"] += day["income"]
        current_week["expense"] += day["expense"]
        current_week["net"] += day["net"]
        current_week["balance"] = day["balance"]
        
        if (i + 1) % 7 == 0 or i == len(daily) - 1:
            current_week["week_end"] = day["date"]
            current_week = {k: round(v, 2) if isinstance(v, float) else v 
                           for k, v in current_week.items()}
            weekly.append(current_week)
            if i < len(daily) - 1:
                current_week = {
                    "week_start": daily[i + 1]["date"],
                    "income": 0, "expense": 0, "net": 0,
                }
    
    return weekly


def _aggregate_monthly(daily: List[Dict]) -> List[Dict]:
    """Aggregate daily forecast into monthly buckets."""
    monthly = {}
    
    for day in daily:
        month_key = day["date"][:7]  # YYYY-MM
        
        if month_key not in monthly:
            monthly[month_key] = {
                "month": month_key,
                "income": 0, "expense": 0, "net": 0,
                "min_balance": float('inf'),
            }
        
        monthly[month_key]["income"] += day["income"]
        monthly[month_key]["expense"] += day["expense"]
        monthly[month_key]["net"] += day["net"]
        monthly[month_key]["min_balance"] = min(
            monthly[month_key]["min_balance"], day["balance"]
        )
        monthly[month_key]["end_balance"] = day["balance"]
    
    result = []
    for m in sorted(monthly.values(), key=lambda x: x["month"]):
        result.append({k: round(v, 2) if isinstance(v, float) else v 
                       for k, v in m.items()})
    
    return result
