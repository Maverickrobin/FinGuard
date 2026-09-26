"""Tier-3 categorization: LLM fallback for unmatched transactions.

Only called for transactions that didn't match Tier 1 (merchant lookup)
or Tier 2 (keyword/regex rules). Batches 10-20 transactions per call
and constrains output to the fixed category enum.
"""
import json
import os
from typing import List, Dict, Tuple

from backend.categorization.merchant_lookup import CATEGORIES

# Try to import google.generativeai, fall back gracefully
try:
    import google.generativeai as genai
    HAS_GENAI = True
except ImportError:
    HAS_GENAI = False


BATCH_SIZE = 15  # Batch 10-20 per call

SYSTEM_PROMPT = f"""You are a financial transaction categorizer for an Indian bank account.

Given a list of transaction descriptions, categorize each one into EXACTLY ONE of these categories:
{json.dumps(CATEGORIES)}

Respond with a JSON array of objects, each with:
- "index": the transaction index (0-based)
- "category": one of the categories above
- "confidence": your confidence (0.0 to 1.0)
- "merchant": extracted merchant name if identifiable, else null

RULES:
- Use ONLY the categories listed above. No other categories.
- If unsure, use "Miscellaneous" with low confidence.
- confidence < 0.7 means the transaction should be flagged for user review.
- Respond ONLY with the JSON array, no other text.
"""


def categorize_batch_llm(transactions: List[Dict]) -> List[Dict]:
    """Categorize a batch of transactions using Gemini.
    
    Args:
        transactions: List of dicts with 'index' and 'description' keys.
    
    Returns:
        List of dicts with 'index', 'category', 'confidence', 'merchant'.
    """
    api_key = os.environ.get("GEMINI_API_KEY", "")
    
    if not HAS_GENAI or not api_key:
        # Fall back to simple keyword-based guess
        return _fallback_categorize(transactions)
    
    genai.configure(api_key=api_key)
    model = genai.GenerativeModel("gemini-2.0-flash")
    
    results = []
    
    # Process in batches
    for i in range(0, len(transactions), BATCH_SIZE):
        batch = transactions[i:i + BATCH_SIZE]
        
        prompt = "Categorize these transactions:\n\n"
        for txn in batch:
            prompt += f'{txn["index"]}. "{txn["description"]}"\n'
        
        try:
            response = model.generate_content(
                [SYSTEM_PROMPT, prompt],
                generation_config=genai.GenerationConfig(
                    response_mime_type="application/json",
                    temperature=0.1,
                ),
            )
            
            parsed = json.loads(response.text)
            if isinstance(parsed, list):
                for item in parsed:
                    # Validate category is in our enum
                    if item.get("category") not in CATEGORIES:
                        item["category"] = "Miscellaneous"
                        item["confidence"] = 0.3
                    results.append(item)
            else:
                results.extend(_fallback_categorize(batch))
                
        except Exception as e:
            print(f"  ⚠ LLM categorization failed: {e}")
            results.extend(_fallback_categorize(batch))
    
    return results


def _fallback_categorize(transactions: List[Dict]) -> List[Dict]:
    """Simple keyword fallback when LLM is unavailable.
    
    This ensures the app works without an API key during demo.
    """
    keyword_map = {
        "GROCERY": "Groceries", "FOOD": "Dining", "RESTAURANT": "Dining",
        "CAFE": "Dining", "COFFEE": "Dining", "SWIGGY": "Dining",
        "ZOMATO": "Dining", "UBER": "Transport", "OLA": "Transport",
        "RAPIDO": "Transport", "FUEL": "Fuel", "PETROL": "Fuel",
        "AMAZON": "Shopping", "FLIPKART": "Shopping", "MYNTRA": "Shopping",
        "NETFLIX": "Subscriptions", "SPOTIFY": "Subscriptions",
        "CINEMA": "Entertainment", "MOVIE": "Entertainment",
        "PHARMACY": "Health", "DOCTOR": "Health", "HOSPITAL": "Health",
        "INSURANCE": "Insurance", "RENT": "Rent", "EMI": "EMI",
        "SALARY": "Salary", "RECHARGE": "Utilities", "BILL": "Utilities",
    }
    
    results = []
    for txn in transactions:
        desc = txn["description"].upper()
        category = "Miscellaneous"
        confidence = 0.4
        
        for keyword, cat in keyword_map.items():
            if keyword in desc:
                category = cat
                confidence = 0.65
                break
        
        results.append({
            "index": txn["index"],
            "category": category,
            "confidence": confidence,
            "merchant": None,
        })
    
    return results
