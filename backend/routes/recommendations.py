"""Recommendation API routes."""
from fastapi import APIRouter
from backend.recommendations.agent import generate_recommendations, get_recommendations

router = APIRouter(prefix="/api", tags=["recommendations"])


@router.get("/recommendations")
def api_get_recommendations(status: str = None):
    """Get stored recommendations."""
    return {"recommendations": get_recommendations(status=status)}


@router.post("/recommendations/generate")
def api_generate_recommendations():
    """Run the full recommendation pipeline.
    
    1. Check triggers (deterministic)
    2. Classify impact (deterministic)
    3. Phrase recommendation (LLM or template)
    4. Route high-impact to approval gate
    """
    recommendations = generate_recommendations()
    return {
        "recommendations": recommendations,
        "count": len(recommendations),
        "high_impact": sum(1 for r in recommendations if r["impact_level"] == "high"),
        "medium_impact": sum(1 for r in recommendations if r["impact_level"] == "medium"),
        "low_impact": sum(1 for r in recommendations if r["impact_level"] == "low"),
    }
