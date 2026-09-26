"""Anomaly detection for FinGuard.

Two detection methods:
1. Per-category rolling mean/std — flags transactions ~2-2.5 std deviations
   from the category average.
2. Same-merchant recurring price comparison — catches subscription price
   hikes that wouldn't look like a category-level outlier.
"""
import uuid
import json
from datetime import datetime, timedelta
from typing import List, Dict
import pandas as pd
import numpy as np
from backend.database import get_db, dicts_from_rows


# Thresholds
CATEGORY_STD_THRESHOLD = 2.0     # Flag if > 2 std deviations from mean
RECURRING_PRICE_CHANGE_PCT = 0.15  # Flag if recurring charge changes >15%
MIN_TRANSACTIONS_FOR_STATS = 3     # Need at least 3 txns to compute stats


def detect_anomalies() -> List[Dict]:
    """Run anomaly detection on all transactions.
    
    Returns list of detected anomalies.
    """
    # Clear previous anomalies (re-detect fresh)
    with get_db() as conn:
        conn.execute("DELETE FROM anomalies")
    
    anomalies = []
    
    # Method 1: Per-category statistical outliers
    anomalies.extend(_detect_category_outliers())
    
    # Method 2: Recurring charge price changes
    anomalies.extend(_detect_recurring_price_changes())
    
    # Store anomalies in database
    with get_db() as conn:
        for a in anomalies:
            conn.execute("""
                INSERT OR IGNORE INTO anomalies 
                (id, transaction_id, anomaly_type, description, severity,
                 category, expected_value, actual_value, deviation_score)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                a["id"], a.get("transaction_id"), a["anomaly_type"],
                a["description"], a["severity"], a.get("category"),
                a.get("expected_value"), a.get("actual_value"),
                a.get("deviation_score", 0),
            ))
    
    return anomalies


def _detect_category_outliers() -> List[Dict]:
    """Detect transactions that are statistical outliers within their category."""
    with get_db() as conn:
        rows = conn.execute("""
            SELECT * FROM transactions 
            WHERE type = 'debit' AND category IS NOT NULL
            ORDER BY date
        """).fetchall()
    
    if not rows:
        return []
    
    df = pd.DataFrame(dicts_from_rows(rows))
    df["amount"] = df["amount"].astype(float)
    df["date"] = pd.to_datetime(df["date"])
    
    anomalies = []
    
    # Group by category and check each transaction
    for category, group in df.groupby("category"):
        if len(group) < MIN_TRANSACTIONS_FOR_STATS:
            continue
        
        # Skip fixed recurring categories (rent, EMI) — handled by method 2
        if category in ("Rent", "EMI", "Salary"):
            continue
        
        mean_amount = group["amount"].mean()
        std_amount = group["amount"].std()
        
        if std_amount == 0 or np.isnan(std_amount):
            continue
        
        for _, txn in group.iterrows():
            deviation = (txn["amount"] - mean_amount) / std_amount
            
            if abs(deviation) >= CATEGORY_STD_THRESHOLD:
                severity = "high" if abs(deviation) >= 3.0 else "medium"
                
                anomalies.append({
                    "id": f"anomaly-{uuid.uuid4().hex[:12]}",
                    "transaction_id": txn["id"],
                    "anomaly_type": "category_outlier",
                    "description": (
                        f"Unusual {category} spend of ₹{txn['amount']:,.0f} — "
                        f"typically ₹{mean_amount:,.0f} ± ₹{std_amount:,.0f} "
                        f"({deviation:+.1f}σ from average)"
                    ),
                    "severity": severity,
                    "category": category,
                    "expected_value": round(mean_amount, 2),
                    "actual_value": txn["amount"],
                    "deviation_score": round(abs(deviation), 2),
                })
    
    return anomalies


def _detect_recurring_price_changes() -> List[Dict]:
    """Detect price changes in recurring charges from the same merchant.
    
    This specifically catches subscription price hikes (e.g., Netflix ₹649→₹899)
    that wouldn't show up as category-level outliers because subscriptions
    are a low-variance category.
    """
    with get_db() as conn:
        rows = conn.execute("""
            SELECT * FROM transactions 
            WHERE is_recurring = 1 AND type = 'debit' AND merchant_name IS NOT NULL
            ORDER BY merchant_name, date
        """).fetchall()
    
    if not rows:
        return []
    
    df = pd.DataFrame(dicts_from_rows(rows))
    df["amount"] = df["amount"].astype(float)
    df["date"] = pd.to_datetime(df["date"])
    
    anomalies = []
    
    for merchant, group in df.groupby("merchant_name"):
        if len(group) < 2:
            continue
        
        group = group.sort_values("date")
        amounts = group["amount"].values
        
        # Compare each charge to the previous one
        for i in range(1, len(amounts)):
            prev_amount = amounts[i - 1]
            curr_amount = amounts[i]
            
            if prev_amount == 0:
                continue
            
            pct_change = (curr_amount - prev_amount) / prev_amount
            
            if abs(pct_change) >= RECURRING_PRICE_CHANGE_PCT:
                txn = group.iloc[i]
                direction = "increased" if pct_change > 0 else "decreased"
                severity = "high" if abs(pct_change) >= 0.30 else "medium"
                
                anomalies.append({
                    "id": f"anomaly-{uuid.uuid4().hex[:12]}",
                    "transaction_id": txn["id"],
                    "anomaly_type": "recurring_price_change",
                    "description": (
                        f"{merchant} charge {direction} by {abs(pct_change)*100:.0f}%: "
                        f"₹{prev_amount:,.0f} → ₹{curr_amount:,.0f}"
                    ),
                    "severity": severity,
                    "category": txn.get("category", "Unknown"),
                    "expected_value": prev_amount,
                    "actual_value": curr_amount,
                    "deviation_score": round(abs(pct_change) * 100, 1),
                })
    
    return anomalies


def get_anomalies(severity: str = None, acknowledged: bool = None) -> List[Dict]:
    """Retrieve detected anomalies with optional filters."""
    with get_db() as conn:
        query = "SELECT * FROM anomalies WHERE 1=1"
        params = []
        
        if severity:
            query += " AND severity = ?"
            params.append(severity)
        
        if acknowledged is not None:
            query += " AND acknowledged = ?"
            params.append(1 if acknowledged else 0)
        
        query += " ORDER BY deviation_score DESC"
        
        rows = conn.execute(query, params).fetchall()
    
    return dicts_from_rows(rows)


def acknowledge_anomaly(anomaly_id: str):
    """Mark an anomaly as acknowledged by the user."""
    with get_db() as conn:
        conn.execute(
            "UPDATE anomalies SET acknowledged = 1 WHERE id = ?",
            (anomaly_id,)
        )
