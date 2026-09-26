"""Tiered categorization engine for FinGuard.

Pipeline: User Overrides → Tier 1 (Merchant Lookup) → Tier 2 (Rules) 
          → Tier 3 (LLM) → Flag for Review

The engine processes transactions through each tier in order,
stopping at the first match. Unmatched or low-confidence results
are flagged for user review.
"""
from typing import List, Dict, Optional
from backend.database import get_db, dicts_from_rows
from backend.categorization.merchant_lookup import lookup_merchant
from backend.categorization.rules import match_rule
from backend.categorization.llm_fallback import categorize_batch_llm


def categorize_transaction(description: str, amount: Optional[float] = None) -> tuple:
    """Categorize a single transaction description without requiring database persistence.
    
    Returns: (category, confidence, source)
    """
    # 0. User override
    override = _check_user_override(description)
    if override:
        return (override[0], override[1], "user_override")
    
    # 1. Tier 1: Merchant lookup
    merchant_match = lookup_merchant(description)
    if merchant_match:
        merchant_name, category, confidence = merchant_match
        return (category, confidence, "merchant_db")
    
    # 2. Tier 2: Rules
    rule_match = match_rule(description)
    if rule_match:
        category, confidence = rule_match
        return (category, confidence, "rules")
    
    # 3. Tier 3: LLM / heuristic fallback
    batch_res = categorize_batch_llm([{"index": 0, "description": description}])
    if batch_res:
        res = batch_res[0]
        return (res["category"], res.get("confidence", 0.5), "llm")
    
    return ("Miscellaneous", 0.3, "default")


def categorize_transactions(transaction_ids: Optional[List[str]] = None,
                             force_recategorize: bool = False):
    """Run the categorization pipeline on transactions.
    
    Args:
        transaction_ids: Specific IDs to categorize. None = all uncategorized.
        force_recategorize: If True, re-categorize even if already done.
    """
    with get_db() as conn:
        if transaction_ids:
            placeholders = ','.join(['?' for _ in transaction_ids])
            query = f"SELECT * FROM transactions WHERE id IN ({placeholders})"
            rows = conn.execute(query, transaction_ids).fetchall()
        elif force_recategorize:
            rows = conn.execute("SELECT * FROM transactions").fetchall()
        else:
            rows = conn.execute(
                "SELECT * FROM transactions WHERE category_source = 'synthetic' OR category IS NULL"
            ).fetchall()
    
    transactions = dicts_from_rows(rows)
    
    if not transactions:
        return {"categorized": 0, "flagged": 0}
    
    llm_queue = []  # Transactions that need LLM categorization
    categorized_count = 0
    flagged_count = 0
    
    for txn in transactions:
        desc = txn["description"]
        txn_id = txn["id"]
        
        # ─── Step 0: Check user overrides (highest priority) ───
        override = _check_user_override(desc)
        if override:
            _update_category(txn_id, override[0], override[1], "user_override",
                              override[2])
            categorized_count += 1
            continue
        
        # ─── Step 1: Tier 1 — Merchant lookup (fuzzy) ───
        merchant_match = lookup_merchant(desc)
        if merchant_match:
            merchant_name, category, confidence = merchant_match
            _update_category(txn_id, category, confidence, "merchant_lookup",
                              merchant_name)
            categorized_count += 1
            continue
        
        # ─── Step 2: Tier 2 — Keyword/regex rules ───
        rule_match = match_rule(desc)
        if rule_match:
            category, confidence = rule_match
            _update_category(txn_id, category, confidence, "rule")
            categorized_count += 1
            continue
        
        # ─── Step 3: Queue for Tier 3 (LLM) ───
        llm_queue.append({
            "index": len(llm_queue),
            "id": txn_id,
            "description": desc,
        })
    
    # ─── Process LLM queue in batches ───
    if llm_queue:
        llm_results = categorize_batch_llm(llm_queue)
        
        for result in llm_results:
            idx = result["index"]
            txn_id = llm_queue[idx]["id"]
            category = result["category"]
            confidence = result.get("confidence", 0.5)
            merchant = result.get("merchant")
            
            # Flag low-confidence for review
            should_flag = confidence < 0.7
            
            _update_category(
                txn_id, category, confidence, "llm",
                merchant, should_flag
            )
            
            if should_flag:
                flagged_count += 1
            else:
                categorized_count += 1
    
    return {
        "categorized": categorized_count,
        "flagged": flagged_count,
        "llm_processed": len(llm_queue),
    }


def save_user_override(description_pattern: str, category: str,
                        merchant_name: str = None):
    """Save a user correction as a permanent override.
    
    This is the "learns from you" feature — user corrections
    take precedence over all tiers in future categorizations.
    """
    with get_db() as conn:
        conn.execute("""
            INSERT OR REPLACE INTO user_overrides 
            (description_pattern, merchant_name, category)
            VALUES (?, ?, ?)
        """, (description_pattern.upper(), merchant_name, category))


def get_flagged_transactions() -> List[Dict]:
    """Get transactions flagged for user review."""
    with get_db() as conn:
        rows = conn.execute("""
            SELECT * FROM transactions 
            WHERE flagged_for_review = 1
            ORDER BY date DESC
        """).fetchall()
    return dicts_from_rows(rows)


def _check_user_override(description: str) -> Optional[tuple]:
    """Check if a description matches any user override."""
    with get_db() as conn:
        rows = conn.execute("SELECT * FROM user_overrides").fetchall()
    
    desc_upper = description.upper()
    for row in rows:
        if row["description_pattern"] in desc_upper:
            return (row["category"], 1.0, row["merchant_name"])
    
    return None


def _update_category(txn_id: str, category: str, confidence: float,
                      source: str, merchant_name: str = None,
                      flag_for_review: bool = False):
    """Update a transaction's category in the database."""
    with get_db() as conn:
        conn.execute("""
            UPDATE transactions 
            SET category = ?, category_confidence = ?, category_source = ?,
                merchant_name = COALESCE(?, merchant_name),
                flagged_for_review = ?
            WHERE id = ?
        """, (category, confidence, source, merchant_name,
              1 if flag_for_review else 0, txn_id))
