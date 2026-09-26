"""Approval gate API routes.

These routes expose the approval gate to the frontend.
The actual gate logic lives in backend/approval/gate.py.
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict, Any
from backend.approval.gate import (
    get_pending_actions, get_pending_action, mark_action_shown,
    approve_action, edit_and_approve_action, reject_action,
    execute_action,
    ApprovalRequiredError, ActionNotFoundError, ActionAlreadyExecutedError,
)
from backend.approval.audit import get_audit_trail, get_audit_summary

router = APIRouter(prefix="/api", tags=["approval"])


class EditApproveRequest(BaseModel):
    edited_params: Dict[str, Any]


class RejectRequest(BaseModel):
    reason: str = ""


@router.get("/pending-actions")
def api_get_pending_actions(status: Optional[str] = None):
    """Get all pending actions, optionally filtered by status."""
    actions = get_pending_actions(status=status)
    return {"actions": actions, "count": len(actions)}


@router.get("/pending-actions/{action_id}")
def api_get_action(action_id: str):
    """Get a specific pending action."""
    action = get_pending_action(action_id)
    if action is None:
        raise HTTPException(status_code=404, detail=f"Action '{action_id}' not found")
    return action


@router.post("/pending-actions/{action_id}/shown")
def api_mark_shown(action_id: str):
    """Mark an action as shown to the user."""
    mark_action_shown(action_id)
    return {"success": True}


@router.post("/pending-actions/{action_id}/approve")
def api_approve(action_id: str):
    """Approve a pending action.
    
    This is the ONLY way to make the action executable.
    """
    try:
        action = approve_action(action_id)
        return {"success": True, "action": action}
    except ActionNotFoundError:
        raise HTTPException(status_code=404, detail=f"Action '{action_id}' not found")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/pending-actions/{action_id}/edit-approve")
def api_edit_approve(action_id: str, request: EditApproveRequest):
    """Edit an action's parameters, then approve it."""
    try:
        action = edit_and_approve_action(action_id, request.edited_params)
        return {"success": True, "action": action}
    except ActionNotFoundError:
        raise HTTPException(status_code=404, detail=f"Action '{action_id}' not found")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/pending-actions/{action_id}/reject")
def api_reject(action_id: str, request: RejectRequest):
    """Reject a pending action. It will NOT be executed."""
    try:
        action = reject_action(action_id, reason=request.reason)
        return {"success": True, "action": action}
    except ActionNotFoundError:
        raise HTTPException(status_code=404, detail=f"Action '{action_id}' not found")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/pending-actions/{action_id}/execute")
def api_execute(action_id: str):
    """Execute an approved action.
    
    ╔══════════════════════════════════════════════════════════╗
    ║  This endpoint calls execute_action() which has a       ║
    ║  HARD CODE-LEVEL CHECK: it refuses to run unless        ║
    ║  status == 'approved'.                                  ║
    ║  No timeout. No default. No bypass.                     ║
    ╚══════════════════════════════════════════════════════════╝
    """
    try:
        result = execute_action(action_id)
        return result
    except ActionNotFoundError:
        raise HTTPException(status_code=404, detail=f"Action '{action_id}' not found")
    except ApprovalRequiredError as e:
        raise HTTPException(
            status_code=403,
            detail={
                "error": "APPROVAL_REQUIRED",
                "message": str(e),
                "action_id": e.action_id,
                "current_status": e.current_status,
            }
        )
    except ActionAlreadyExecutedError:
        raise HTTPException(status_code=409, detail="Action already executed")


@router.get("/audit-trail")
def api_get_audit_trail(action_id: Optional[str] = None, limit: int = 100):
    """Get the audit trail."""
    trail = get_audit_trail(action_id=action_id, limit=limit)
    return {"trail": trail, "count": len(trail)}


@router.get("/audit-summary")
def api_get_audit_summary():
    """Get audit event summary."""
    return get_audit_summary()
