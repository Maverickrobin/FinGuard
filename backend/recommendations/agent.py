"""Recommendation agent for FinGuard.

Orchestrates the full recommendation pipeline:
1. Triggers (deterministic) decide WHETHER to recommend
2. Impact classifier (deterministic) scores the level
3. LLM (optional) phrases the recommendation for the user
4. High-impact actions are routed to the approval gate

The LLM's job is phrasing/tailoring — NOT deciding risk.
"""
import uuid
import json
import os
from typing import List, Dict
from backend.database import get_db
from backend.recommendations.triggers import check_all_triggers
from backend.recommendations.impact_classifier import classify_trigger
from backend.approval.gate import create_pending_action

# Try to import Gemini
try:
    import google.generativeai as genai
    HAS_GENAI = True
except ImportError:
    HAS_GENAI = False


def generate_recommendations() -> List[Dict]:
    """Run the full recommendation pipeline.
    
    1. Check all triggers
    2. For each fired trigger, classify impact
    3. Generate human-readable recommendation (LLM or template)
    4. Route high-impact to approval gate
    
    Returns list of generated recommendations.
    """
    # Step 1: Check triggers
    fired_triggers = check_all_triggers()
    
    if not fired_triggers:
        return []
    
    recommendations = []
    
    for trigger in fired_triggers:
        # Step 2: Classify impact (deterministic — NOT the LLM)
        impact = classify_trigger(trigger)
        
        # Step 3: Generate recommendation text
        rec = _generate_recommendation_text(trigger, impact)
        
        # Step 4: Store in database
        rec_id = f"rec-{uuid.uuid4().hex[:12]}"
        
        with get_db() as conn:
            conn.execute("""
                INSERT OR IGNORE INTO recommendations
                (id, trigger_type, title, description, impact_level,
                 action_type, action_params, related_anomaly_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                rec_id,
                trigger["trigger_type"],
                rec["title"],
                rec["description"],
                impact["level"],
                trigger.get("suggested_action", {}).get("type"),
                json.dumps(trigger.get("suggested_action", {}).get("params", {})),
                trigger.get("context", {}).get("anomaly_id"),
            ))
        
        result = {
            "id": rec_id,
            "trigger_type": trigger["trigger_type"],
            "title": rec["title"],
            "description": rec["description"],
            "impact_level": impact["level"],
            "impact_score": impact["score"],
            "impact_reasoning": impact["reasoning"],
            "context": trigger["context"],
            "suggested_action": trigger.get("suggested_action"),
        }
        
        # Step 5: Route high-impact to approval gate
        if impact["level"] in ("high", "medium") and trigger.get("suggested_action"):
            action = trigger["suggested_action"]
            action_id = create_pending_action(
                action_type=action["type"],
                title=rec["title"],
                description=rec["description"],
                amount=action["params"].get("amount") or trigger["context"].get("actual_value"),
                rationale=rec["description"],
                impact_level=impact["level"],
                original_params=action["params"],
                recommendation_id=rec_id,
            )
            result["pending_action_id"] = action_id
        
        recommendations.append(result)
    
    return recommendations


def _generate_recommendation_text(trigger: Dict, impact: Dict) -> Dict:
    """Generate a human-readable recommendation.
    
    Uses LLM if available, falls back to templates.
    The LLM is ONLY for phrasing — the decision to recommend
    was already made by the trigger, and the impact level was
    already set by the classifier.
    """
    api_key = os.environ.get("GEMINI_API_KEY", "")
    
    if HAS_GENAI and api_key:
        try:
            return _llm_phrase_recommendation(trigger, impact)
        except Exception as e:
            print(f"  ⚠ LLM phrasing failed, using template: {e}")
    
    # Fallback to templates
    return _template_recommendation(trigger, impact)


def _llm_phrase_recommendation(trigger: Dict, impact: Dict) -> Dict:
    """Use Gemini to phrase a recommendation nicely."""
    genai.configure(api_key=os.environ["GEMINI_API_KEY"])
    model = genai.GenerativeModel("gemini-2.0-flash")
    
    prompt = f"""You are a friendly financial advisor. Write a short recommendation 
for this trigger. Be specific with numbers. No jargon.

Trigger type: {trigger['trigger_type']}
Impact level: {impact['level']}
Context data: {json.dumps(trigger['context'], indent=2)}

Respond with JSON:
{{"title": "Short title (max 10 words)", "description": "2-3 sentence explanation with specific numbers"}}
"""
    
    response = model.generate_content(
        prompt,
        generation_config=genai.GenerationConfig(
            response_mime_type="application/json",
            temperature=0.3,
        ),
    )
    
    return json.loads(response.text)


def _template_recommendation(trigger: Dict, impact: Dict) -> Dict:
    """Template-based recommendation fallback."""
    trigger_type = trigger["trigger_type"]
    ctx = trigger.get("context", {})
    
    templates = {
        "forecast_zero_crossing": {
            "title": "⚠️ Cash flow shortfall projected",
            "description": (
                f"Your balance is projected to go negative on "
                f"{ctx.get('zero_crossing_date', 'N/A')} "
                f"({ctx.get('days_until', '?')} days from now). "
                f"Current balance: ₹{ctx.get('current_balance', 0):,.0f}. "
                f"Consider reducing discretionary spending or increasing income."
            ),
        },
        "recurring_charge_jump": {
            "title": "💰 Subscription price increased",
            "description": (
                f"{ctx.get('description', 'A recurring charge changed')}. "
                f"That's a {ctx.get('change_pct', 0):.0f}% increase. "
                f"Review whether this subscription is still worth the new price."
            ),
        },
        "category_over_budget": {
            "title": f"📊 {ctx.get('category', 'Category')} spending over budget",
            "description": (
                f"You've spent ₹{ctx.get('amount_spent', 0):,.0f} on "
                f"{ctx.get('category', '?')} this month — "
                f"{ctx.get('percentage', 0):.0f}% of your ₹{ctx.get('budget_limit', 0):,.0f} budget. "
                + (f"You are ₹{ctx.get('overage', 0):,.0f} over budget." if ctx.get('overage', 0) > 0 else "Close to the limit.")
            ),
        },
        "goal_off_pace": {
            "title": f"🎯 {ctx.get('goal_name', 'Goal')} needs attention",
            "description": (
                f"To reach ₹{ctx.get('target_amount', 0):,.0f} by "
                f"{ctx.get('deadline', 'deadline')}, you need ₹{ctx.get('required_monthly', 0):,.0f}/month "
                f"but are contributing ₹{ctx.get('current_contribution', 0):,.0f}/month. "
                f"Shortfall: ₹{ctx.get('monthly_shortfall', 0):,.0f}/month."
            ),
        },
        "spending_trend_up": {
            "title": f"📈 {ctx.get('category', 'Category')} spending trending up",
            "description": (
                f"Your {ctx.get('category', '?')} spending has increased "
                f"{ctx.get('growth_rate', 0):.0f}% over the last 3 months. "
                f"This is informational — keep an eye on it."
            ),
        },
    }
    
    template = templates.get(trigger_type, {
        "title": "💡 Financial insight",
        "description": f"Trigger: {trigger_type}. Review your recent activity.",
    })
    
    return template


def get_recommendations(status: str = None) -> List[Dict]:
    """Get stored recommendations."""
    with get_db() as conn:
        if status:
            rows = conn.execute(
                "SELECT * FROM recommendations WHERE status = ? ORDER BY created_at DESC",
                (status,)
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT * FROM recommendations ORDER BY created_at DESC"
            ).fetchall()
    
    from backend.database import dicts_from_rows
    results = dicts_from_rows(rows)
    
    for r in results:
        if r.get("action_params"):
            try:
                r["action_params"] = json.loads(r["action_params"])
            except (json.JSONDecodeError, TypeError):
                pass
    
    return results
