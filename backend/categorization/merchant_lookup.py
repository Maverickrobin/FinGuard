"""Merchant lookup table for Tier-1 categorization.

~150 common Indian merchants mapped to categories.
Uses rapidfuzz for fuzzy matching (threshold ≥ 85).
"""
from rapidfuzz import fuzz, process
from typing import Optional, Tuple, Dict

# Category enum — all categorization must use these values
CATEGORIES = [
    "Salary", "Rent", "EMI", "Investments", "Subscriptions",
    "Utilities", "Groceries", "Dining", "Fuel", "Shopping",
    "Entertainment", "Transport", "Health", "Education",
    "Insurance", "Gifts", "Travel", "Miscellaneous",
]

# Merchant → Category mapping (~150 merchants)
MERCHANT_DB: Dict[str, str] = {
    # ─── Food Delivery / Dining ───
    "Swiggy": "Dining",
    "Zomato": "Dining",
    "Dominos": "Dining",
    "Pizza Hut": "Dining",
    "McDonalds": "Dining",
    "KFC": "Dining",
    "Burger King": "Dining",
    "Subway": "Dining",
    "Starbucks": "Dining",
    "Cafe Coffee Day": "Dining",
    "CCD": "Dining",
    "Third Wave Coffee": "Dining",
    "Blue Tokai": "Dining",
    "Toit Brewpub": "Dining",
    "Barbeque Nation": "Dining",
    "Haldirams": "Dining",
    "Chaayos": "Dining",
    "Dunkin Donuts": "Dining",
    "Baskin Robbins": "Dining",
    
    # ─── Groceries ───
    "BigBasket": "Groceries",
    "Big Basket": "Groceries",
    "DMart": "Groceries",
    "D-Mart": "Groceries",
    "Zepto": "Groceries",
    "Blinkit": "Groceries",
    "Instamart": "Groceries",
    "JioMart": "Groceries",
    "More Supermarket": "Groceries",
    "More Megastore": "Groceries",
    "Spencer": "Groceries",
    "Reliance Fresh": "Groceries",
    "Star Bazaar": "Groceries",
    "Nature's Basket": "Groceries",
    "Grofers": "Groceries",
    "Country Delight": "Groceries",
    
    # ─── Shopping ───
    "Amazon": "Shopping",
    "Flipkart": "Shopping",
    "Myntra": "Shopping",
    "Ajio": "Shopping",
    "Croma": "Shopping",
    "Reliance Digital": "Shopping",
    "Vijay Sales": "Shopping",
    "Nykaa": "Shopping",
    "Meesho": "Shopping",
    "Snapdeal": "Shopping",
    "Tata Cliq": "Shopping",
    "Shoppers Stop": "Shopping",
    "Lifestyle": "Shopping",
    "Westside": "Shopping",
    "H&M": "Shopping",
    "Zara": "Shopping",
    "Uniqlo": "Shopping",
    "Decathlon": "Shopping",
    "IKEA": "Shopping",
    "Pepperfry": "Shopping",
    "Urban Ladder": "Shopping",
    
    # ─── Subscriptions ───
    "Netflix": "Subscriptions",
    "Spotify": "Subscriptions",
    "Amazon Prime": "Subscriptions",
    "Disney Hotstar": "Subscriptions",
    "Hotstar": "Subscriptions",
    "YouTube Premium": "Subscriptions",
    "Apple": "Subscriptions",
    "Google One": "Subscriptions",
    "Sony LIV": "Subscriptions",
    "JioCinema": "Subscriptions",
    "Zee5": "Subscriptions",
    "LinkedIn Premium": "Subscriptions",
    "Audible": "Subscriptions",
    "Kindle Unlimited": "Subscriptions",
    
    # ─── Transport ───
    "Uber": "Transport",
    "Ola": "Transport",
    "Ola Cabs": "Transport",
    "Rapido": "Transport",
    "Metro Card": "Transport",
    "BMTC": "Transport",
    "IRCTC": "Travel",
    "MakeMyTrip": "Travel",
    "Goibibo": "Travel",
    "Cleartrip": "Travel",
    "IndiGo": "Travel",
    "Air India": "Travel",
    "Vistara": "Travel",
    "SpiceJet": "Travel",
    "RedBus": "Travel",
    
    # ─── Fuel ───
    "HP Petrol": "Fuel",
    "HP Fuel": "Fuel",
    "Indian Oil": "Fuel",
    "IOCL": "Fuel",
    "Bharat Petroleum": "Fuel",
    "BPCL": "Fuel",
    "Shell": "Fuel",
    
    # ─── Utilities ───
    "BESCOM": "Utilities",
    "BWSSB": "Utilities",
    "Jio": "Utilities",
    "Jio Prepaid": "Utilities",
    "Airtel": "Utilities",
    "Vi": "Utilities",
    "Vodafone": "Utilities",
    "Tata Play": "Utilities",
    "ACT Fibernet": "Utilities",
    "Hathway": "Utilities",
    
    # ─── Entertainment ───
    "BookMyShow": "Entertainment",
    "PVR": "Entertainment",
    "PVR Cinemas": "Entertainment",
    "INOX": "Entertainment",
    "Cinepolis": "Entertainment",
    "Steam": "Entertainment",
    "PlayStation": "Entertainment",
    "Xbox": "Entertainment",
    
    # ─── Health ───
    "Apollo Pharmacy": "Health",
    "Apollo Hospital": "Health",
    "Practo": "Health",
    "Cult.fit": "Health",
    "Cultfit": "Health",
    "PharmEasy": "Health",
    "1mg": "Health",
    "Netmeds": "Health",
    "MediBuddy": "Health",
    "HealthifyMe": "Health",
    
    # ─── Education ───
    "Udemy": "Education",
    "Coursera": "Education",
    "Unacademy": "Education",
    "BYJU'S": "Education",
    "Skillshare": "Education",
    "Brilliant": "Education",
    
    # ─── Insurance ───
    "LIC": "Insurance",
    "ICICI Prudential": "Insurance",
    "HDFC Life": "Insurance",
    "Star Health": "Insurance",
    "PolicyBazaar": "Insurance",
    
    # ─── Investments ───
    "Groww": "Investments",
    "Zerodha": "Investments",
    "Kite": "Investments",
    "Coin": "Investments",
    "Paytm Money": "Investments",
    "Smallcase": "Investments",
    "ET Money": "Investments",
}

# Pre-compute list of merchant names for fuzzy matching
_MERCHANT_NAMES = list(MERCHANT_DB.keys())

FUZZY_THRESHOLD = 85  # Minimum score for a match


def lookup_merchant(description: str) -> Optional[Tuple[str, str, float]]:
    """Look up a transaction description against the merchant database.
    
    Returns: (merchant_name, category, confidence_score) or None if no match.
    Uses rapidfuzz for fuzzy matching with threshold ≥ 85.
    """
    # Clean description for matching
    cleaned = _clean_for_matching(description)
    
    # Try exact substring first (fastest)
    for merchant, category in MERCHANT_DB.items():
        if merchant.upper() in cleaned.upper():
            return (merchant, category, 1.0)
    
    # Fuzzy match
    result = process.extractOne(
        cleaned,
        _MERCHANT_NAMES,
        scorer=fuzz.token_set_ratio,
        score_cutoff=FUZZY_THRESHOLD,
    )
    
    if result:
        merchant_name, score, _ = result
        return (merchant_name, MERCHANT_DB[merchant_name], score / 100.0)
    
    return None


def _clean_for_matching(description: str) -> str:
    """Clean a transaction description for merchant matching.
    
    Strips reference numbers, payment prefixes, location suffixes.
    """
    import re
    
    text = description.upper()
    
    # Remove common prefixes
    for prefix in ["UPI/", "POS/", "NEFT/", "IMPS/", "NACH/", "RTGS/",
                    "POS ", "UPI ", "NEFT ", "IMPS "]:
        if text.startswith(prefix):
            text = text[len(prefix):]
    
    # Remove reference numbers (sequences of 6+ digits)
    text = re.sub(r'\b\d{6,}\b', '', text)
    
    # Remove UPI handles (@okaxis, @ybl, etc.)
    text = re.sub(r'@\w+', '', text)
    
    # Remove trailing location info after last /
    parts = text.split('/')
    if len(parts) > 1:
        # Keep first two meaningful parts
        text = ' '.join(parts[:2])
    
    # Clean up whitespace
    text = re.sub(r'\s+', ' ', text).strip()
    
    return text
