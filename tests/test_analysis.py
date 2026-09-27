"""Tests for Categorization, Anomaly Detection, Cash Flow Forecasting, and Scenarios."""
import pytest
from datetime import datetime

from backend.database import init_db, get_db
from backend.ingestion.synthetic_generator import generate_synthetic_data
from backend.categorization.engine import categorize_transaction
from backend.categorization.merchant_lookup import lookup_merchant
from backend.analysis.anomaly_detector import detect_anomalies
from backend.analysis.cashflow_forecaster import forecast_cashflow
from backend.analysis.scenario_engine import run_scenario


def setup_module():
    """Ensure database has synthetic data seeded."""
    init_db()
    generate_synthetic_data()


def test_categorization_engine():
    """Verify tiered categorization pipeline."""
    # Tier 1 - Known merchant via fuzzy matching
    cat, conf, source = categorize_transaction("SWIGGY BANGALORE ORDER #12345", 450.0)
    assert cat == "Dining"
    assert conf >= 0.85
    assert source == "merchant_db"

    # Tier 1 - Groceries
    cat, conf, source = categorize_transaction("ZEPTO QUICK COMMERCE", 320.0)
    assert cat == "Groceries"
    assert conf >= 0.85

    # Tier 2 - Salary regex
    cat, conf, source = categorize_transaction("ACH CREDIT INFOSYS SALARY FOR OCT", 85000.0)
    assert cat == "Salary"
    assert conf >= 0.90
    assert source == "rules"

    # Tier 2 - Rent regex
    cat, conf, source = categorize_transaction("UPI/HOUSE RENT TRANSFER TO LANDLORD", 22000.0)
    assert cat == "Rent"
    assert conf >= 0.90
    assert source == "rules"


def test_anomaly_detection_detects_planted_anomalies():
    """Verify anomaly detector finds the planted anomalies in Priya's data:
    1. Netflix price jump (649 -> 899)
    2. Large shopping purchase (~45,000)
    """
    anomalies = detect_anomalies()
    assert len(anomalies) > 0

    anomaly_types = [a["anomaly_type"] for a in anomalies]
    
    # Must flag recurring price change
    assert "recurring_price_change" in anomaly_types
    netflix_anomaly = next((a for a in anomalies if "Netflix" in a["description"] or "Subscriptions" in a.get("category", "")), None)
    assert netflix_anomaly is not None

    # Must flag category outliers (such as the large 45,000 shopping purchase)
    assert "category_outlier" in anomaly_types


def test_cashflow_forecasting():
    """Verify 90-day cash flow forecasting with daily projections."""
    forecast = forecast_cashflow(days=90)
    
    assert "starting_balance" in forecast
    assert "final_balance" in forecast
    assert "daily" in forecast
    assert len(forecast["daily"]) == 90
    assert "zero_crossing_date" in forecast
    assert "monthly" in forecast


def test_scenario_simulation():
    """Verify what-if scenario engine applies parameter overrides."""
    # Scenario: Reduce Dining spending by 30%
    result = run_scenario(
        overrides={"Dining": -0.30},
        days=90
    )
    
    assert "baseline" in result
    assert "scenario" in result
    assert "comparison" in result
    assert "final_balance" in result["scenario"]
    # Reducing spending should result in a higher or equal final balance
    assert result["scenario"]["final_balance"] >= result["baseline"]["final_balance"]


def test_recurring_charge_drop_vs_hike():
    """Verify that decreased recurring charges are not flagged as price hikes."""
    from backend.analysis.anomaly_detector import detect_anomalies
    anomalies = detect_anomalies()
    
    # Anomaly types must distinguish drop vs hike
    for a in anomalies:
        if a["anomaly_type"] == "recurring_price_change":
            # For hikes, actual must be greater than expected
            assert a["actual_value"] > a["expected_value"]
        elif a["anomaly_type"] == "recurring_price_drop":
            # For drops, actual must be less than expected and severity should be low
            assert a["actual_value"] < a["expected_value"]
            assert a["severity"] == "low"


def test_goal_off_pace_calculation():
    """Verify Emergency Fund goal calculation produces a realistic monthly shortfall, not ₹255k."""
    from backend.recommendations.triggers import check_all_triggers
    triggers = check_all_triggers()
    
    goal_trigger = next((t for t in triggers if t.get("trigger_type") == "goal_off_pace"), None)
    if goal_trigger:
        ctx = goal_trigger["context"]
        # Required monthly contribution must be reasonable (< ₹50,000)
        assert ctx["required_monthly"] < 50000, f"implausible required monthly: {ctx['required_monthly']}"
        assert ctx["months_remaining"] >= 6, f"months remaining too low: {ctx['months_remaining']}"


def test_impact_classifier_consistency():
    """Verify impact tier is consistent with anomaly severity."""
    from backend.recommendations.impact_classifier import classify_trigger
    
    # High severity anomaly -> High impact recommendation
    high_trigger = {
        "trigger_type": "recurring_charge_jump",
        "severity": "high",
        "context": {"actual_value": 899.0, "severity": "high"}
    }
    assert classify_trigger(high_trigger)["level"] == "high"
    
    # Medium severity anomaly -> Medium impact recommendation
    med_trigger = {
        "trigger_type": "recurring_charge_jump",
        "severity": "medium",
        "context": {"actual_value": 2200.0, "severity": "medium"}
    }
    assert classify_trigger(med_trigger)["level"] == "medium"



