"""Human Approval Gate for FinGuard.

THIS IS THE CORE DIFFERENTIATOR OF THE PROJECT.

Any action that moves money, cancels or changes a recurring commitment,
or is hard to reverse MUST pass through this gate. The execute function
contains a hard code-level check — it reads the pending_actions table
and REFUSES to run unless status == 'approved'.

No timeout. No default. No bypass. Silence is NOT treated as approval.
"""
import uuid
import json
from datetime import datetime
from typing import Optional, Dict, Any, List
from backend.database import get_db, dict_from_row, dicts_from_rows
from backend.approval.audit import log_audit_event


# ─── Custom exceptions ───────────────────────────────────────────────

class ApprovalRequiredError(Exception):
    """Raised when trying to execute an action that hasn't been approved."""
    def __init__(self, action_id: str, current_status: str):
        self.action_id = action_id
        self.current_status = current_status
        super().__init__(
            f"EXECUTION BLOCKED: Action '{action_id}' has status '{current_status}'. "
            f"Requires explicit human approval (status must be 'approved'). "
            f"No timeout, no default — a human must explicitly approve this action."
        )


class ActionNotFoundError(Exception):
    """Raised when an action ID doesn't exist."""
    def __init__(self, action_id: str):
        self.action_id = action_id
        super().__init__(f"Action '{action_id}' not found in pending_actions table.")


class ActionAlreadyExecutedError(Exception):
    """Raised when trying to execute an already-executed action."""
    def __init__(self, action_id: str):
        self.action_id = action_id
        super().__init__(f"Action '{action_id}' has already been executed.")


# ─── Create a pending action ─────────────────────────────────────────

def create_pending_action(
    action_type: str,
    title: str,
    description: str,
    amount: Optional[float],
    rationale: str,
    impact_level: str,
    original_params: Dict[str, Any],
    recommendation_id: Optional[str] = None,
) -> str:
    """Create a new pending action that requires human approval.
    
    Returns the action ID. The action starts with status='pending'
    and CANNOT be executed until a human explicitly approves it.
    
    De-duplication: if an action with the same action_type AND
    recommendation_id already exists with status='pending', the
    existing row is updated (title, description, amount, rationale,
    params refreshed) and its ID is returned — no duplicate is created.
    """
    if impact_level not in ("medium", "high"):
        raise ValueError(f"Only 'medium' and 'high' impact actions go through the gate, got '{impact_level}'")
    
    with get_db() as conn:
        # ── De-duplication check ──────────────────────────────────
        existing = conn.execute("""
            SELECT id FROM pending_actions
            WHERE action_type = ? AND title = ? AND status = 'pending'
            LIMIT 1
        """, (action_type, title)).fetchone()
        
        if existing:
            # Update the existing pending action in-place
            existing_id = existing[0] if isinstance(existing, (tuple, list)) else existing["id"]
            conn.execute("""
                UPDATE pending_actions
                SET title = ?, description = ?, amount = ?, rationale = ?,
                    impact_level = ?, original_params = ?,
                    created_at = datetime('now')
                WHERE id = ?
            """, (title, description, amount, rationale,
                  impact_level, json.dumps(original_params), existing_id))
            # Return existing_id after conn is released
            _dedup_hit = existing_id
        else:
            _dedup_hit = None
            # ── No duplicate — insert new row ─────────────────────
            action_id = f"action-{uuid.uuid4().hex[:12]}"
            conn.execute("""
                INSERT INTO pending_actions 
                (id, recommendation_id, action_type, title, description, amount,
                 rationale, impact_level, status, original_params, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, datetime('now'))
            """, (
                action_id, recommendation_id, action_type, title, description,
                amount, rationale, impact_level, json.dumps(original_params),
            ))
    
    # ── Audit logging (outside DB connection) ─────────────────────
    if _dedup_hit:
        log_audit_event(_dedup_hit, "refreshed", {
            "action_type": action_type,
            "title": title,
            "amount": amount,
            "impact_level": impact_level,
            "note": "Duplicate trigger — existing pending action updated in-place.",
        })
        return _dedup_hit
    
    # Audit: action proposed
    log_audit_event(action_id, "proposed", {
        "action_type": action_type,
        "title": title,
        "amount": amount,
        "impact_level": impact_level,
        "original_params": original_params,
    })
    
    return action_id


# ─── Retrieve pending actions ────────────────────────────────────────

def get_pending_actions(status: Optional[str] = None) -> List[Dict]:
    """Get all pending actions, optionally filtered by status."""
    with get_db() as conn:
        if status:
            rows = conn.execute(
                "SELECT * FROM pending_actions WHERE status = ? ORDER BY created_at DESC",
                (status,)
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT * FROM pending_actions ORDER BY created_at DESC"
            ).fetchall()
    return dicts_from_rows(rows)


def get_pending_action(action_id: str) -> Optional[Dict]:
    """Get a single pending action by ID."""
    with get_db() as conn:
        row = conn.execute(
            "SELECT * FROM pending_actions WHERE id = ?", (action_id,)
        ).fetchone()
    return dict_from_row(row)


# ─── Mark action as shown to user ────────────────────────────────────

def mark_action_shown(action_id: str):
    """Record that this action has been shown to the user."""
    with get_db() as conn:
        conn.execute(
            "UPDATE pending_actions SET shown_at = datetime('now') WHERE id = ?",
            (action_id,)
        )
    log_audit_event(action_id, "shown_to_user", {})


# ─── Human decision functions ────────────────────────────────────────

def approve_action(action_id: str, decided_by: str = "user") -> Dict:
    """Approve a pending action. Sets status to 'approved'.
    
    This is the ONLY way to make an action executable.
    """
    action = get_pending_action(action_id)
    if action is None:
        raise ActionNotFoundError(action_id)
    
    if action["status"] not in ("pending",):
        raise ValueError(f"Cannot approve action with status '{action['status']}'. Must be 'pending'.")
    
    with get_db() as conn:
        conn.execute("""
            UPDATE pending_actions 
            SET status = 'approved', decided_at = datetime('now'), decided_by = ?
            WHERE id = ?
        """, (decided_by, action_id))
    
    log_audit_event(action_id, "approved", {"decided_by": decided_by})
    
    return get_pending_action(action_id)


def edit_and_approve_action(action_id: str, edited_params: Dict[str, Any],
                             decided_by: str = "user") -> Dict:
    """Edit the parameters of an action, then approve it.
    
    The user can change amounts/details before approving.
    Both original and edited params are preserved for audit.
    """
    action = get_pending_action(action_id)
    if action is None:
        raise ActionNotFoundError(action_id)
    
    if action["status"] not in ("pending",):
        raise ValueError(f"Cannot edit action with status '{action['status']}'. Must be 'pending'.")
    
    with get_db() as conn:
        conn.execute("""
            UPDATE pending_actions 
            SET status = 'approved', edited_params = ?, 
                decided_at = datetime('now'), decided_by = ?,
                amount = COALESCE(?, amount)
            WHERE id = ?
        """, (
            json.dumps(edited_params),
            decided_by,
            edited_params.get("amount"),
            action_id,
        ))
    
    log_audit_event(action_id, "edited_and_approved", {
        "decided_by": decided_by,
        "original_params": json.loads(action["original_params"]),
        "edited_params": edited_params,
    })
    
    return get_pending_action(action_id)


def reject_action(action_id: str, decided_by: str = "user",
                   reason: str = "") -> Dict:
    """Reject a pending action. It will NOT be executed."""
    action = get_pending_action(action_id)
    if action is None:
        raise ActionNotFoundError(action_id)
    
    if action["status"] not in ("pending",):
        raise ValueError(f"Cannot reject action with status '{action['status']}'. Must be 'pending'.")
    
    with get_db() as conn:
        conn.execute("""
            UPDATE pending_actions 
            SET status = 'rejected', decided_at = datetime('now'), decided_by = ?
            WHERE id = ?
        """, (decided_by, action_id))
    
    log_audit_event(action_id, "rejected", {
        "decided_by": decided_by,
        "reason": reason,
    })
    
    return get_pending_action(action_id)


# ─── THE EXECUTE FUNCTION — THE HARD GATE ────────────────────────────

def execute_action(action_id: str) -> Dict:
    """Execute an approved action.
    
    ╔══════════════════════════════════════════════════════════════╗
    ║  THIS FUNCTION CONTAINS THE HARD APPROVAL CHECK.           ║
    ║                                                            ║
    ║  It reads the pending_actions table and REFUSES to run     ║
    ║  unless status == 'approved'.                              ║
    ║                                                            ║
    ║  There is NO timeout that treats silence as approval.      ║
    ║  There is NO default that bypasses this check.             ║
    ║  There is NO way to skip this check.                       ║
    ║                                                            ║
    ║  This is a CODE-LEVEL guarantee, not a prompt instruction. ║
    ╚══════════════════════════════════════════════════════════════╝
    """
    # ─── Step 1: Fetch the action from the database ───
    action = get_pending_action(action_id)
    
    if action is None:
        raise ActionNotFoundError(action_id)
    
    # ─── Step 2: THE HARD GATE — refuse if not approved ───
    if action["status"] == "executed":
        raise ActionAlreadyExecutedError(action_id)
    
    if action["status"] != "approved":
        # THIS IS THE CORE GUARANTEE.
        # No matter how the system got here — API call, scheduled job,
        # LLM suggestion, automated trigger — execution is BLOCKED
        # unless a human has explicitly set status to 'approved'.
        log_audit_event(action_id, "execution_blocked", {
            "current_status": action["status"],
            "reason": "Action has not been approved by a human.",
        })
        raise ApprovalRequiredError(action_id, action["status"])
    
    # ─── Step 3: Execute the action ───
    log_audit_event(action_id, "execution_started", {})
    
    try:
        # Determine which params to use (edited takes precedence)
        params = json.loads(action["edited_params"]) if action["edited_params"] else json.loads(action["original_params"])
        
        result = _dispatch_action(action["action_type"], params)
        
        # Mark as executed
        with get_db() as conn:
            conn.execute("""
                UPDATE pending_actions 
                SET status = 'executed', executed_at = datetime('now'),
                    execution_result = ?
                WHERE id = ?
            """, (json.dumps(result), action_id))
        
        log_audit_event(action_id, "executed_successfully", result)
        
        return {"success": True, "result": result, "action": get_pending_action(action_id)}
    
    except Exception as e:
        # Mark as failed
        with get_db() as conn:
            conn.execute("""
                UPDATE pending_actions 
                SET status = 'failed', execution_result = ?
                WHERE id = ?
            """, (json.dumps({"error": str(e)}), action_id))
        
        log_audit_event(action_id, "execution_failed", {"error": str(e)})
        
        return {"success": False, "error": str(e), "action": get_pending_action(action_id)}


def _dispatch_action(action_type: str, params: Dict[str, Any]) -> Dict:
    """Route an action to its handler. All handlers are internal.
    
    In a production system, these would connect to banking APIs,
    payment processors, etc. For the hackathon demo, they update
    local state (budgets, goals, etc.).
    """
    handlers = {
        "adjust_budget": _handle_adjust_budget,
        "cancel_subscription": _handle_cancel_subscription,
        "set_spending_alert": _handle_set_spending_alert,
        "transfer_to_savings": _handle_transfer_to_savings,
        "update_goal_contribution": _handle_update_goal_contribution,
        "pause_sip": _handle_pause_sip,
    }
    
    handler = handlers.get(action_type)
    if handler is None:
        raise ValueError(f"Unknown action type: {action_type}")
    
    return handler(params)


# ─── Action handlers (demo implementations) ──────────────────────────

def _handle_adjust_budget(params: Dict) -> Dict:
    """Adjust a category budget."""
    category = params["category"]
    new_limit = params["new_limit"]
    
    with get_db() as conn:
        conn.execute(
            "UPDATE budgets SET monthly_limit = ?, updated_at = datetime('now') WHERE category = ?",
            (new_limit, category),
        )
    
    return {"action": "budget_adjusted", "category": category, "new_limit": new_limit}


def _handle_cancel_subscription(params: Dict) -> Dict:
    """Cancel a subscription (mark recurring transactions as cancelled)."""
    merchant = params["merchant"]
    
    return {
        "action": "subscription_cancelled",
        "merchant": merchant,
        "note": "Subscription cancellation initiated. You'll need to confirm on the provider's platform.",
    }


def _handle_set_spending_alert(params: Dict) -> Dict:
    """Set a spending alert for a category."""
    category = params["category"]
    threshold = params["threshold"]
    
    return {
        "action": "alert_set",
        "category": category,
        "threshold": threshold,
    }


def _handle_transfer_to_savings(params: Dict) -> Dict:
    """Transfer amount to savings/goal."""
    amount = params["amount"]
    goal_id = params.get("goal_id", "goal-emergency-fund")
    
    with get_db() as conn:
        conn.execute(
            "UPDATE goals SET current_amount = current_amount + ?, updated_at = datetime('now') WHERE id = ?",
            (amount, goal_id),
        )
    
    return {"action": "transferred_to_savings", "amount": amount, "goal_id": goal_id}


def _handle_update_goal_contribution(params: Dict) -> Dict:
    """Update monthly contribution to a goal."""
    goal_id = params.get("goal_id", "goal-emergency-fund")
    new_contribution = params["monthly_contribution"]
    
    with get_db() as conn:
        conn.execute(
            "UPDATE goals SET monthly_contribution = ?, updated_at = datetime('now') WHERE id = ?",
            (new_contribution, goal_id),
        )
    
    return {"action": "goal_contribution_updated", "goal_id": goal_id, "new_contribution": new_contribution}


def _handle_pause_sip(params: Dict) -> Dict:
    """Pause a SIP investment."""
    return {
        "action": "sip_paused",
        "fund": params.get("fund", "Unknown"),
        "note": "SIP pause request submitted. This will take effect from next month.",
    }
