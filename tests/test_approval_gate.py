"""Tests for FinGuard Human Approval Gate.

CRITICAL TEST SUITE:
Verifies the non-negotiable requirement that any high/medium impact action
is strictly blocked from executing without explicit human approval.
"""
import pytest
import os
import json
import sqlite3
from unittest.mock import patch

from backend.database import init_db, get_db
from backend.approval.gate import (
    create_pending_action,
    get_pending_action,
    get_pending_actions,
    approve_action,
    edit_and_approve_action,
    reject_action,
    execute_action,
    ApprovalRequiredError,
    ActionAlreadyExecutedError,
    ActionNotFoundError,
)
from backend.approval.audit import get_audit_trail, get_audit_summary


def setup_function():
    """Ensure clean database before each test."""
    init_db()


def test_hard_gate_blocks_execution_without_approval():
    """TEST 1: Execution MUST be blocked if status is 'pending'."""
    action_id = create_pending_action(
        action_type="cancel_subscription",
        title="Cancel Netflix",
        description="Cancel Netflix subscription to save money",
        amount=899.0,
        rationale="Subscription price increased by 38%",
        impact_level="high",
        original_params={"merchant": "Netflix", "amount": 899.0},
    )

    action = get_pending_action(action_id)
    assert action is not None
    assert action["status"] == "pending"

    # ATTEMPT TO EXECUTE WITHOUT APPROVAL MUST RAISE ApprovalRequiredError
    with pytest.raises(ApprovalRequiredError) as exc_info:
        execute_action(action_id)

    assert exc_info.value.action_id == action_id
    assert exc_info.value.current_status == "pending"
    assert "EXECUTION BLOCKED" in str(exc_info.value)
    assert "Requires explicit human approval" in str(exc_info.value)

    # Verify audit event was recorded for blocked execution
    audit_trail = get_audit_trail(action_id)
    event_types = [e["event_type"] for e in audit_trail]
    assert "execution_blocked" in event_types


def test_approve_then_execute_succeeds():
    """TEST 2: Explicit human approval allows execution to proceed."""
    action_id = create_pending_action(
        action_type="adjust_budget",
        title="Adjust Dining Budget",
        description="Lower dining budget to ₹4,000",
        amount=4000.0,
        rationale="Current spending exceeds category budget",
        impact_level="medium",
        original_params={"category": "Dining", "new_limit": 4000.0},
    )

    # Explicit approval
    approved_action = approve_action(action_id, decided_by="user_atharva")
    assert approved_action["status"] == "approved"
    assert approved_action["decided_by"] == "user_atharva"

    # Execution now succeeds
    result = execute_action(action_id)
    assert result["success"] is True
    assert result["action"]["status"] == "executed"

    # Verify database state
    final_action = get_pending_action(action_id)
    assert final_action["status"] == "executed"
    assert final_action["executed_at"] is not None


def test_cannot_execute_twice():
    """TEST 3: An executed action cannot be executed again."""
    action_id = create_pending_action(
        action_type="set_spending_alert",
        title="Set Shopping Alert",
        description="Alert when shopping crosses ₹5,000",
        amount=5000.0,
        rationale="Shopping volatility",
        impact_level="medium",
        original_params={"category": "Shopping", "threshold": 5000.0},
    )

    approve_action(action_id)
    execute_action(action_id)

    with pytest.raises(ActionAlreadyExecutedError):
        execute_action(action_id)


def test_rejected_action_cannot_be_executed():
    """TEST 4: Rejected actions are permanently blocked from execution."""
    action_id = create_pending_action(
        action_type="pause_sip",
        title="Pause SIP",
        description="Pause mutual fund SIP",
        amount=5000.0,
        rationale="Temporary cashflow buffer",
        impact_level="high",
        original_params={"fund": "HDFC Index Fund"},
    )

    reject_action(action_id, decided_by="user_atharva", reason="I want to keep investing")

    action = get_pending_action(action_id)
    assert action["status"] == "rejected"

    # Attempt to execute rejected action must raise ApprovalRequiredError
    with pytest.raises(ApprovalRequiredError) as exc_info:
        execute_action(action_id)

    assert exc_info.value.current_status == "rejected"


def test_edit_and_approve_executes_with_new_params():
    """TEST 5: User can edit parameters before approval, and execution honors edits."""
    action_id = create_pending_action(
        action_type="adjust_budget",
        title="Adjust Dining Budget",
        description="Reduce dining budget",
        amount=3000.0,
        rationale="Category overage",
        impact_level="medium",
        original_params={"category": "Dining", "new_limit": 3000.0},
    )

    # Human user edits new_limit to ₹4,500 instead of ₹3,000 and approves
    edited_params = {"category": "Dining", "new_limit": 4500.0, "amount": 4500.0}
    action = edit_and_approve_action(action_id, edited_params=edited_params, decided_by="user_atharva")

    assert action["status"] == "approved"
    assert json.loads(action["edited_params"]) == edited_params
    assert action["amount"] == 4500.0

    # Execution uses the edited parameters
    result = execute_action(action_id)
    assert result["success"] is True
    assert result["result"]["new_limit"] == 4500.0


def test_nonexistent_action_raises_not_found():
    """TEST 6: Invalid action IDs raise ActionNotFoundError."""
    with pytest.raises(ActionNotFoundError):
        execute_action("action-nonexistent-123")


def test_audit_trail_captures_complete_lifecycle():
    """TEST 7: Audit log records full timeline of actions and decisions."""
    action_id = create_pending_action(
        action_type="transfer_to_savings",
        title="Transfer to Emergency Fund",
        description="Move surplus to savings",
        amount=10000.0,
        rationale="Surplus balance detected",
        impact_level="high",
        original_params={"amount": 10000.0, "goal_id": "goal-emergency-fund"},
    )

    approve_action(action_id, decided_by="user_atharva")
    execute_action(action_id)

    trail = get_audit_trail(action_id)
    events = [t["event_type"] for t in trail]

    assert "proposed" in events
    assert "approved" in events
    assert "execution_started" in events
    assert "executed_successfully" in events
