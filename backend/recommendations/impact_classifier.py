"""Deterministic impact classifier for recommendations.

THIS IS A FUNCTION, NOT AN LLM CALL.

Scores every recommendation as low / medium / high impact based on:
- Does it move money or change a commitment?
- Amount vs rupee/percentage threshold
- Reversibility
- Confidence of the underlying signal
- Is it recurring (compounding) vs one-off?

The LLM never sets its own tier. This function does.
"""
from typing import Dict, Optional


# Thresholds
HIGH_AMOUNT_THRESHOLD = 5000        # ₹5,000
MEDIUM_AMOUNT_THRESHOLD = 1000      # ₹1,000
HIGH_CONFIDENCE_THRESHOLD = 0.8
MEDIUM_CONFIDENCE_THRESHOLD = 0.5


def classify_impact(
    moves_money: bool,
    amount: float,
    recurring: bool,
    reversible: bool,
    signal_confidence: float,
    changes_commitment: bool = False,
) -> Dict:
    """Classify the impact level of a recommendation.
    
    Returns:
        Dict with 'level' ('low'/'medium'/'high'), 'score' (0-100),
        and 'reasoning' explaining the classification.
    """
    score = 0
    reasons = []
    
    # ─── Factor 1: Does it move money? ───
    if moves_money:
        score += 30
        reasons.append("Involves money movement")
    
    # ─── Factor 2: Amount ───
    if amount >= HIGH_AMOUNT_THRESHOLD:
        score += 25
        reasons.append(f"Large amount (₹{amount:,.0f})")
    elif amount >= MEDIUM_AMOUNT_THRESHOLD:
        score += 15
        reasons.append(f"Moderate amount (₹{amount:,.0f})")
    else:
        score += 5
        reasons.append(f"Small amount (₹{amount:,.0f})")
    
    # ─── Factor 3: Recurring (compounding effect) ───
    if recurring:
        score += 20
        reasons.append("Recurring/compounding effect")
    
    # ─── Factor 4: Reversibility ───
    if not reversible:
        score += 15
        reasons.append("Hard to reverse")
    
    # ─── Factor 5: Signal confidence ───
    if signal_confidence < MEDIUM_CONFIDENCE_THRESHOLD:
        score -= 10
        reasons.append(f"Low confidence signal ({signal_confidence:.0%})")
    elif signal_confidence >= HIGH_CONFIDENCE_THRESHOLD:
        score += 5
        reasons.append(f"High confidence signal ({signal_confidence:.0%})")
    
    # ─── Factor 6: Changes commitment ───
    if changes_commitment:
        score += 15
        reasons.append("Changes a recurring commitment")
    
    # ─── Classify ───
    # HIGH: moves money AND (large amount OR recurring)
    # This is the rule from the spec, applied strictly
    if moves_money and (amount >= HIGH_AMOUNT_THRESHOLD or recurring):
        level = "high"
    elif moves_money and amount < HIGH_AMOUNT_THRESHOLD and not recurring:
        level = "medium"
    elif changes_commitment:
        level = "high"
    elif score >= 60:
        level = "high"
    elif score >= 30:
        level = "medium"
    else:
        level = "low"
    
    return {
        "level": level,
        "score": min(100, max(0, score)),
        "reasoning": "; ".join(reasons),
        "factors": {
            "moves_money": moves_money,
            "amount": amount,
            "recurring": recurring,
            "reversible": reversible,
            "signal_confidence": signal_confidence,
            "changes_commitment": changes_commitment,
        },
    }


def classify_trigger(trigger: Dict) -> Dict:
    """Classify a trigger's impact based on its type and context."""
    trigger_type = trigger["trigger_type"]
    context = trigger.get("context", {})
    action = trigger.get("suggested_action", {})
    
    if trigger_type == "forecast_zero_crossing":
        return classify_impact(
            moves_money=True,
            amount=abs(context.get("final_balance", 0)),
            recurring=True,
            reversible=True,
            signal_confidence=0.85,
            changes_commitment=False,
        )
    
    elif trigger_type == "recurring_charge_jump":
        return classify_impact(
            moves_money=True,
            amount=context.get("actual_value", 0),
            recurring=True,
            reversible=True,
            signal_confidence=0.95,
            changes_commitment=True,
        )
    
    elif trigger_type == "category_over_budget":
        return classify_impact(
            moves_money=False,
            amount=context.get("overage", 0),
            recurring=False,
            reversible=True,
            signal_confidence=0.90,
        )
    
    elif trigger_type == "goal_off_pace":
        return classify_impact(
            moves_money=True,
            amount=context.get("monthly_shortfall", 0),
            recurring=True,
            reversible=True,
            signal_confidence=0.80,
        )
    
    elif trigger_type == "spending_trend_up":
        return classify_impact(
            moves_money=False,
            amount=0,
            recurring=False,
            reversible=True,
            signal_confidence=0.70,
        )
    
    else:
        return classify_impact(
            moves_money=False,
            amount=0,
            recurring=False,
            reversible=True,
            signal_confidence=0.50,
        )
