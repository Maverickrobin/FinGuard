"""Scenario engine for FinGuard.

NOT a separate model — this is parameterized reuse of the cash flow
forecaster. The user provides adjustments (e.g., "cut dining 30%",
"rent +₹3000") and we call the SAME forecast function with overrides.
"""
from typing import Dict, List, Optional
from backend.analysis.cashflow_forecaster import forecast_cashflow


# Predefined scenario templates for the UI
SCENARIO_TEMPLATES = [
    {
        "id": "cut_dining",
        "name": "Cut dining by 30%",
        "description": "Reduce dining out expenses by 30%",
        "overrides": {"Dining": -0.30},
        "icon": "🍽️",
    },
    {
        "id": "cut_shopping",
        "name": "Cut shopping by 50%",
        "description": "Reduce shopping expenses by half",
        "overrides": {"Shopping": -0.50},
        "icon": "🛍️",
    },
    {
        "id": "rent_increase",
        "name": "Rent increases by ₹3,000",
        "description": "Simulate a rent increase of ₹3,000/month",
        "overrides": {"Rent": 3000},
        "icon": "🏠",
    },
    {
        "id": "salary_hike",
        "name": "10% salary hike",
        "description": "Simulate a 10% increase in monthly salary",
        "overrides": {"Salary": 0.10},
        "icon": "💰",
    },
    {
        "id": "austerity",
        "name": "Full austerity mode",
        "description": "Cut all discretionary spending by 40%",
        "overrides": {
            "Dining": -0.40,
            "Shopping": -0.40,
            "Entertainment": -0.40,
            "Transport": -0.20,
        },
        "icon": "📉",
    },
    {
        "id": "increase_sip",
        "name": "Increase SIP by ₹3,000",
        "description": "Increase monthly SIP investment by ₹3,000",
        "overrides": {"Investments": 3000},
        "icon": "📈",
    },
]


def run_scenario(
    overrides: Dict[str, float],
    days: int = 90,
    scenario_name: str = "Custom Scenario",
) -> Dict:
    """Run a what-if scenario by calling the forecaster with overrides.
    
    This is the SAME forecast function, just with adjusted inputs.
    No separate model.
    
    Args:
        overrides: Dict of category → adjustment
        days: Forecast horizon
        scenario_name: Name for display
    
    Returns:
        Scenario results including comparison with baseline.
    """
    # Run baseline (no overrides)
    baseline = forecast_cashflow(days=days)
    
    # Run scenario (with overrides)
    scenario = forecast_cashflow(days=days, overrides=overrides)
    
    # Compare
    comparison = {
        "scenario_name": scenario_name,
        "overrides": overrides,
        "baseline_final_balance": baseline["final_balance"],
        "scenario_final_balance": scenario["final_balance"],
        "balance_difference": round(
            scenario["final_balance"] - baseline["final_balance"], 2
        ),
        "baseline_zero_crossing": baseline["zero_crossing_date"],
        "scenario_zero_crossing": scenario["zero_crossing_date"],
        "days_gained": _calculate_days_gained(
            baseline["zero_crossing_date"],
            scenario["zero_crossing_date"],
        ),
    }
    
    return {
        "comparison": comparison,
        "baseline": baseline,
        "scenario": scenario,
    }


def run_template_scenario(template_id: str, days: int = 90) -> Dict:
    """Run a predefined scenario template."""
    template = next(
        (t for t in SCENARIO_TEMPLATES if t["id"] == template_id),
        None
    )
    
    if template is None:
        raise ValueError(f"Unknown scenario template: {template_id}")
    
    return run_scenario(
        overrides=template["overrides"],
        days=days,
        scenario_name=template["name"],
    )


def get_scenario_templates() -> List[Dict]:
    """Get all available scenario templates."""
    return SCENARIO_TEMPLATES


def _calculate_days_gained(baseline_zero: Optional[str],
                            scenario_zero: Optional[str]) -> Optional[int]:
    """Calculate how many days the scenario delays/advances zero-crossing."""
    if baseline_zero is None and scenario_zero is None:
        return None  # Neither crosses zero
    
    if baseline_zero is not None and scenario_zero is None:
        return None  # Scenario avoids zero crossing entirely (good!)
    
    if baseline_zero is None and scenario_zero is not None:
        return None  # Scenario causes zero crossing (bad!)
    
    from datetime import datetime
    base_date = datetime.strptime(baseline_zero, "%Y-%m-%d")
    scen_date = datetime.strptime(scenario_zero, "%Y-%m-%d")
    
    return (scen_date - base_date).days
