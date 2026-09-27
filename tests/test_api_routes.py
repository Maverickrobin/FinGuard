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


def test_scenario_dual_series_and_headline_delta(client):
    """Verify scenario returns dual series, parameter aliases, and headline delta."""
    # Test multi-lever parameter aliases (sip, salary, dining)
    payload = {
        "overrides": {
            "sip": 0.20,
            "salary": 0.10,
            "Dining": -0.25
        },
        "days": 90
    }
    response = client.post("/api/scenario", json=payload)
    assert response.status_code == 200
    data = response.json()
    
    assert "baseline" in data
    assert "scenario" in data
    assert "comparison" in data
    
    # Dual series verification
    assert "daily" in data["baseline"]
    assert "daily" in data["scenario"]
    assert len(data["baseline"]["daily"]) > 0
    assert len(data["scenario"]["daily"]) == len(data["baseline"]["daily"])
    
    # Headline delta banner verification
    comparison = data["comparison"]
    assert "headline_delta" in comparison
    assert "status" in comparison["headline_delta"]
    assert "headline" in comparison["headline_delta"]
    assert "detail" in comparison["headline_delta"]
    assert "balance_difference" in comparison


def test_profiles_endpoints_and_isolation(client):
    """Verify profile creation, isolated data processing, and deletion."""
    # 1. List profiles (demo profile present)
    get_res = client.get("/api/profiles")
    assert get_res.status_code == 200
    profiles = get_res.json()["profiles"]
    assert any(p["id"] == "demo" for p in profiles)

    # 2. Create custom profile
    create_res = client.post("/api/profiles", json={
        "name": "Arjun Patel",
        "role": "Consultant",
        "income": 120000,
        "starting_balance": 50000
    })
    assert create_res.status_code == 200
    profile_id = create_res.json()["profile"]["id"]
    assert profile_id.startswith("user_")

    # 3. Quick-add template transactions to Arjun
    quick_res = client.post(
        f"/api/profiles/{profile_id}/quick-add",
        json={"template_type": "freelancer"}
    )
    assert quick_res.status_code == 200
    assert quick_res.json()["transactions_ingested"] > 0

    # 4. Verify data isolation: Arjun's transactions are NOT visible under demo profile
    demo_dash = client.get("/api/dashboard", headers={"X-Profile-ID": "demo"})
    arjun_dash = client.get("/api/dashboard", headers={"X-Profile-ID": profile_id})
    assert demo_dash.status_code == 200
    assert arjun_dash.status_code == 200
    assert demo_dash.json()["balance"] != arjun_dash.json()["balance"]

    # 5. Clean up: Delete Arjun's profile
    del_res = client.delete(f"/api/profiles/{profile_id}")
    assert del_res.status_code == 200
    assert del_res.json()["success"] is True

    # 6. Verify Arjun is no longer listed
    list_after = client.get("/api/profiles").json()["profiles"]
    assert not any(p["id"] == profile_id for p in list_after)

