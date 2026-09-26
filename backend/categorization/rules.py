"""Tier-2 categorization: keyword/regex rules.

High-value recurring categories that should be detected
regardless of merchant match: salary, rent, EMI, SIP, etc.
"""
import re
from typing import Optional, Tuple

# (compiled_regex, category, confidence)
RULES = [
    # Salary patterns
    (re.compile(r'SALARY|SAL(?:ARY)?[\s/]|PAYROLL|STIPEND|COMPENSATION', re.I),
     "Salary", 0.95),
    
    # Rent patterns
    (re.compile(r'RENT\s|RENT\b|HOUSE\s*RENT|LANDLORD|RENTAL', re.I),
     "Rent", 0.95),
    
    # EMI patterns
    (re.compile(r'\bEMI\b|EQUATED\s*MONTHLY|LOAN\s*(REPAY|EMI)|AUTO\s*LOAN|HOME\s*LOAN|PERSONAL\s*LOAN', re.I),
     "EMI", 0.95),
    
    # SIP / Investment patterns
    (re.compile(r'\bSIP\b|MUTUAL\s*FUND|SYSTEMATIC\s*INVEST|NAV\s*PURCHASE|BLUECHIP|INDEX\s*FUND', re.I),
     "Investments", 0.90),
    
    # Insurance
    (re.compile(r'INSURANCE|PREMIUM\s*PAY|LIFE\s*COVER|HEALTH\s*POLICY|TERM\s*PLAN', re.I),
     "Insurance", 0.90),
    
    # NACH / Auto-debit (catch recurring debits)
    (re.compile(r'NACH[\s/-]', re.I),
     None, 0.0),  # NACH alone isn't enough — return None to fall through
    
    # Fuel
    (re.compile(r'FUEL|PETROL|DIESEL|PETROLEUM|FUEL\s*STN|GAS\s*STATION', re.I),
     "Fuel", 0.90),
    
    # Recharge / Telecom
    (re.compile(r'RECHARGE|PREPAID|POSTPAID|BROADBAND|FIBERNET|ELECTRICITY|BILL\s*PAY|WATER\s*BILL', re.I),
     "Utilities", 0.85),
    
    # Subscriptions
    (re.compile(r'SUBSCRIPTION|MONTHLY\s*PLAN|ANNUAL\s*PLAN|RENEWAL', re.I),
     "Subscriptions", 0.85),
]


def match_rule(description: str) -> Optional[Tuple[str, float]]:
    """Check if a transaction description matches any keyword/regex rule.
    
    Returns: (category, confidence) or None if no match.
    """
    for pattern, category, confidence in RULES:
        if pattern.search(description):
            if category is not None:
                return (category, confidence)
    
    return None
