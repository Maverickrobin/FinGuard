"""Analysis API routes — anomalies, forecast, scenarios."""
from fastapi import APIRouter
from pydantic import BaseModel
from typing import Dict, Optional
from backend.analysis.anomaly_detector import detect_anomalies, get_anomalies, acknowledge_anomaly
from backend.analysis.cashflow_forecaster import forecast_cashflow
from backend.analysis.scenario_engine import (
    run_scenario, run_template_scenario, get_scenario_templates
)

router = APIRouter(prefix="/api", tags=["analysis"])


class ScenarioRequest(BaseModel):
    overrides: Dict[str, float]
    days: int = 90
    name: str = "Custom Scenario"


@router.get("/anomalies")
def api_get_anomalies(severity: Optional[str] = None):
    """Get detected anomalies."""
    return {"anomalies": get_anomalies(severity=severity)}


@router.post("/anomalies/detect")
def api_detect_anomalies():
    """Run anomaly detection."""
    anomalies = detect_anomalies()
    return {"anomalies": anomalies, "count": len(anomalies)}


@router.post("/anomalies/{anomaly_id}/acknowledge")
def api_acknowledge_anomaly(anomaly_id: str):
    """Acknowledge an anomaly."""
    acknowledge_anomaly(anomaly_id)
    return {"success": True}


@router.get("/forecast")
def api_get_forecast(days: int = 90):
    """Get cash flow forecast."""
    return forecast_cashflow(days=days)


@router.post("/scenario")
def api_run_scenario(request: ScenarioRequest):
    """Run a custom what-if scenario."""
    return run_scenario(
        overrides=request.overrides,
        days=request.days,
        scenario_name=request.name,
    )


@router.get("/scenario/templates")
def api_get_templates():
    """Get predefined scenario templates."""
    return {"templates": get_scenario_templates()}


@router.post("/scenario/template/{template_id}")
def api_run_template(template_id: str, days: int = 90):
    """Run a predefined scenario template."""
    return run_template_scenario(template_id, days=days)
