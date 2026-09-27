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
    days_gained = _calculate_days_gained(
        baseline["zero_crossing_date"],
        scenario["zero_crossing_date"],
    )
    
    bal_diff = round(
        scenario["final_balance"] - baseline["final_balance"], 2
    )

    headline_delta = _compute_headline_delta(
        baseline_final=baseline["final_balance"],
        scenario_final=scenario["final_balance"],
        baseline_zero=baseline["zero_crossing_date"],
        scenario_zero=scenario["zero_crossing_date"],
        days=days,
        days_gained=days_gained,
    )

    comparison = {
        "scenario_name": scenario_name,
        "overrides": overrides,
        "baseline_final_balance": baseline["final_balance"],
        "scenario_final_balance": scenario["final_balance"],
        "balance_difference": bal_diff,
        "final_balance_diff": bal_diff,
        "baseline_zero_crossing": baseline["zero_crossing_date"],
        "scenario_zero_crossing": scenario["zero_crossing_date"],
        "days_gained": days_gained,
        "headline_delta": headline_delta,
    }
    
    return {
        "comparison": comparison,
        "baseline": baseline,
        "scenario": scenario,
        "scenario_name": scenario_name,
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
        return None  # Scenario avoids zero crossing entirely
    
    if baseline_zero is None and scenario_zero is not None:
        return None  # Scenario causes zero crossing
    
    from datetime import datetime
    base_date = datetime.strptime(baseline_zero, "%Y-%m-%d")
    scen_date = datetime.strptime(scenario_zero, "%Y-%m-%d")
    
    return (scen_date - base_date).days


def _compute_headline_delta(
    baseline_final: float,
    scenario_final: float,
    baseline_zero: Optional[str],
    scenario_zero: Optional[str],
    days: int,
    days_gained: Optional[int],
) -> Dict:
    """Compute an authoritative headline delta comparing baseline vs scenario."""
    bal_diff = round(scenario_final - baseline_final, 2)
    
    if baseline_zero and not scenario_zero:
        subtext = f"Simulated overrides prevent cash balance from dropping below zero across all {days} days."
        return {
            "status": "shortfall_eliminated",
            "headline": f"Shortfall eliminated (was {baseline_zero})",
            "subtext": subtext,
            "detail": subtext,
            "badge": "No Shortfall Projected",
            "badge_type": "success",
            "days_gained": None,
            "balance_difference": bal_diff,
        }
    elif baseline_zero and scenario_zero:
        if days_gained is not None and days_gained > 0:
            subtext = f"Baseline shortfall on {baseline_zero} delayed to {scenario_zero} (+{days_gained} days of runway)."
            return {
                "status": "shortfall_delayed",
                "headline": f"Shortfall pushed back {days_gained} days",
                "subtext": subtext,
                "detail": subtext,
                "badge": f"+{days_gained} Days Runway",
                "badge_type": "warning",
                "days_gained": days_gained,
                "balance_difference": bal_diff,
            }
        elif days_gained is not None and days_gained < 0:
            subtext = f"Deficit occurs sooner on {scenario_zero} compared to baseline {baseline_zero}."
            return {
                "status": "shortfall_advanced",
                "headline": f"Shortfall accelerated by {abs(days_gained)} days",
                "subtext": subtext,
                "detail": subtext,
                "badge": f"{days_gained} Days Runway",
                "badge_type": "danger",
                "days_gained": days_gained,
                "balance_difference": bal_diff,
            }
        else:
            subtext = f"Shortfall occurs on {scenario_zero}. Net liquidity difference: ₹{bal_diff:+,.0f}."
            return {
                "status": "shortfall_unchanged",
                "headline": f"Shortfall date unchanged ({scenario_zero})",
                "subtext": subtext,
                "detail": subtext,
                "badge": "Date Unchanged",
                "badge_type": "neutral",
                "days_gained": 0,
                "balance_difference": bal_diff,
            }
    elif not baseline_zero and scenario_zero:
        subtext = f"Baseline was solvent, but this scenario creates a liquidity breach on {scenario_zero}."
        return {
            "status": "shortfall_created",
            "headline": f"Deficit triggered on {scenario_zero}",
            "subtext": subtext,
            "detail": subtext,
            "badge": "Deficit Created",
            "badge_type": "danger",
            "days_gained": None,
            "balance_difference": bal_diff,
        }
    else:
        # Neither crosses zero
        if bal_diff >= 0:
            subtext = f"Both baseline and scenario remain fully solvent through {days} days. Ending balance improves by ₹{bal_diff:,.0f}."
            return {
                "status": "solvent_gain",
                "headline": f"No shortfall projected (+₹{bal_diff:,.0f} ending reserve)",
                "subtext": subtext,
                "detail": subtext,
                "badge": f"+₹{bal_diff:,.0f} Net Delta",
                "badge_type": "success",
                "days_gained": None,
                "balance_difference": bal_diff,
            }
        else:
            subtext = f"Both baseline and scenario remain solvent through {days} days. Ending balance is lower by ₹{abs(bal_diff):,.0f}."
            return {
                "status": "solvent_loss",
                "headline": f"No shortfall projected ({bal_diff:+,.0f} reserve decrease)",
                "subtext": subtext,
                "detail": subtext,
                "badge": f"₹{bal_diff:,.0f} Net Delta",
                "badge_type": "warning",
                "days_gained": None,
                "balance_difference": bal_diff,
            }
