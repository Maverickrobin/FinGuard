"""Audit trail logging for FinGuard approval gate.

Every state transition of a pending action is logged here
with a timestamp. This provides a complete, immutable audit
trail of what was proposed, shown, decided, and executed.
"""
import json
from datetime import datetime
from typing import Dict, Any, List, Optional
from backend.database import get_db, dicts_from_rows


def log_audit_event(action_id: str, event_type: str,
                     event_data: Dict[str, Any] = None):
    """Log an audit event for a pending action.
    
    Event types:
        - proposed: Action was created
        - shown_to_user: Action was displayed to the user
        - approved: User approved the action
        - edited_and_approved: User modified and approved the action
        - rejected: User rejected the action
        - execution_started: Execution began
        - execution_blocked: Execution was refused (approval check failed)
        - executed_successfully: Action completed
        - execution_failed: Action failed during execution
    """
    with get_db() as conn:
        conn.execute("""
            INSERT INTO audit_log (action_id, event_type, event_data, timestamp)
            VALUES (?, ?, ?, datetime('now'))
        """, (
            action_id,
            event_type,
            json.dumps(event_data) if event_data else None,
        ))


def get_audit_trail(action_id: Optional[str] = None,
                     limit: int = 100) -> List[Dict]:
    """Get audit trail, optionally filtered by action ID."""
    with get_db() as conn:
        if action_id:
            rows = conn.execute(
                "SELECT * FROM audit_log WHERE action_id = ? ORDER BY timestamp ASC",
                (action_id,)
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT * FROM audit_log ORDER BY timestamp DESC LIMIT ?",
                (limit,)
            ).fetchall()
    
    results = dicts_from_rows(rows)
    # Parse JSON event_data
    for r in results:
        if r.get("event_data"):
            try:
                r["event_data"] = json.loads(r["event_data"])
            except (json.JSONDecodeError, TypeError):
                pass
    return results


def get_audit_summary() -> Dict:
    """Get a summary of all audit events."""
    with get_db() as conn:
        rows = conn.execute("""
            SELECT event_type, COUNT(*) as count 
            FROM audit_log 
            GROUP BY event_type
        """).fetchall()
    
    return {row["event_type"]: row["count"] for row in rows}
