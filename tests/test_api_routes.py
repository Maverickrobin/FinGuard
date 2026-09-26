"""API route tests for FinGuard."""
import pytest
from fastapi.testclient import TestClient

from backend.app import app
from backend.database import init_db
from backend.ingestion.synthetic_generator import generate_synthetic_data
from backend.approval.gate import create_pending_action


@pytest.fixture(scope="module", autouse=True)
def setup_test_db():
    init_db()
    generate_synthetic_data()


@pytest.fixture
def client():
    return TestClient(app)


def test_dashboard_endpoint(client):
    response = client.get("/api/dashboard")
    assert response.status_code == 200
    data = response.json()
    assert "balance" in data
    assert "monthly_summary" in data
    assert "category_breakdown" in data
    assert "goals" in data
    assert "anomaly_count" in data


def test_transactions_endpoint(client):
    response = client.get("/api/transactions?page=1&per_page=10")
    assert response.status_code == 200
    data = response.json()
    assert "transactions" in data
    assert "total" in data
    assert len(data["transactions"]) == 10


def test_anomalies_endpoint(client):
    response = client.get("/api/anomalies")
    assert response.status_code == 200
    data = response.json()
    assert "anomalies" in data
    assert len(data["anomalies"]) > 0


def test_forecast_endpoint(client):
    response = client.get("/api/forecast?days=90")
    assert response.status_code == 200
    data = response.json()
    assert "daily" in data
    assert "starting_balance" in data


def test_scenario_endpoint(client):
    response = client.post("/api/scenario", json={"overrides": {"Dining": -0.30}, "days": 90})
    assert response.status_code == 200
    data = response.json()
    assert "baseline" in data
    assert "scenario" in data
    assert "comparison" in data


def test_api_approval_gate_enforcement(client):
    """Verify HTTP API strictly enforces 403 when executing unapproved actions."""
    action_id = create_pending_action(
        action_type="cancel_subscription",
        title="Cancel Netflix",
        description="Cancel Netflix",
        amount=899.0,
        rationale="Price increase",
        impact_level="high",
        original_params={"merchant": "Netflix"},
    )

    # 1. Direct attempt to execute MUST return 403 Forbidden
    exec_resp = client.post(f"/api/pending-actions/{action_id}/execute")
    assert exec_resp.status_code == 403
    error_detail = exec_resp.json()["detail"]
    assert error_detail["error"] == "APPROVAL_REQUIRED"
    assert error_detail["action_id"] == action_id
    assert error_detail["current_status"] == "pending"

    # 2. Approve the action
    appr_resp = client.post(f"/api/pending-actions/{action_id}/approve")
    assert appr_resp.status_code == 200
    assert appr_resp.json()["action"]["status"] == "approved"

    # 3. Now execution succeeds
    exec_resp_2 = client.post(f"/api/pending-actions/{action_id}/execute")
    assert exec_resp_2.status_code == 200
    assert exec_resp_2.json()["success"] is True

    # 4. Attempting to re-execute returns 409 Conflict
    exec_resp_3 = client.post(f"/api/pending-actions/{action_id}/execute")
    assert exec_resp_3.status_code == 409


def test_audit_trail_endpoints(client):
    response = client.get("/api/audit-trail")
    assert response.status_code == 200
    assert "trail" in response.json()

    summary_resp = client.get("/api/audit-summary")
    assert summary_resp.status_code == 200
