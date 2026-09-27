"""Synthetic transaction generator for FinGuard.

Generates 6 months of realistic transactions for a single persona
with 3 deliberately planted anomalies:
  1. Netflix subscription price hike (₹649 → ₹899 in month 4)
  2. Unusually large ₹45,000 electronics purchase in month 3
  3. Month 5 discretionary spending spree that outpaces income

Seed = 42 for full reproducibility.
"""
import random
import uuid
import json
from datetime import datetime, timedelta
from typing import List, Dict
from backend.database import get_db

SEED = 42
START_DATE = datetime(2025, 4, 1)  # 6 months: Apr-Sep 2025
END_DATE = datetime(2025, 9, 30)
STARTING_BALANCE = 45_000.0  # Opening bank balance

# ─── Persona: Priya Sharma ───────────────────────────────────────────
PERSONA = {
    "name": "Priya Sharma",
    "age": 28,
    "occupation": "Software Engineer",
    "city": "Bangalore",
    "salary": 85_000,
    "salary_day": 1,
}

# ─── Recurring charges ───────────────────────────────────────────────
RECURRING = [
    {
        "name": "Rent",
        "description_templates": [
            "NEFT-LANDLORD-{ref} Rent Payment",
            "UPI/priya.sharma@okaxis/Rent Transfer",
        ],
        "amount": 22_000,
        "day": 5,
        "variance": 0,  # Fixed amount
        "category": "Rent",
    },
    {
        "name": "Car EMI",
        "description_templates": [
            "EMI/HDFC AUTO LOAN/{ref}",
            "NACH-HDFC-CARLOAN-EMI",
        ],
        "amount": 12_500,
        "day": 10,
        "variance": 0,
        "category": "EMI",
    },
    {
        "name": "Netflix",
        "description_templates": [
            "POS/NETFLIX.COM/AMSTERDAM",
            "NETFLIX SUBSCRIPTION",
        ],
        "amount": 649,  # Will be hiked to 899 in month 4 (anomaly #1)
        "day": 15,
        "variance": 0,
        "category": "Subscriptions",
    },
    {
        "name": "Spotify",
        "description_templates": [
            "POS/SPOTIFY INDIA/STOCKHOLM",
            "SPOTIFY PREMIUM",
        ],
        "amount": 119,
        "day": 15,
        "variance": 0,
        "category": "Subscriptions",
    },
    {
        "name": "Mobile Recharge",
        "description_templates": [
            "UPI/JIO PREPAID/{ref}",
            "PHONEPE/JIORECHG/priya",
        ],
        "amount": 399,
        "day": 20,
        "variance": 0,
        "category": "Utilities",
    },
    {
        "name": "Electricity",
        "description_templates": [
            "BESCOM BILL PAYMENT/ONLINE",
            "UPI/BESCOM/{ref}",
        ],
        "amount": 1_800,
        "day": 18,
        "variance": 400,  # ₹1400-2200
        "category": "Utilities",
    },
    {
        "name": "SIP Mutual Fund",
        "description_templates": [
            "NACH-GROWW-SIP-{ref}",
            "SIP/AXIS BLUECHIP/GROWW",
        ],
        "amount": 5_000,
        "day": 7,
        "variance": 0,
        "category": "Investments",
    },
]

# ─── Discretionary spending patterns ─────────────────────────────────
GROCERIES = {
    "merchants": [
        ("BigBasket", ["UPI/BIGBASKET/{ref}", "POS/BIGBASKET/BANGALORE"]),
        ("DMart", ["POS/DMART READY/WHITEFIELD", "UPI/DMART/{ref}"]),
        ("More Supermarket", ["POS/MORE MEGASTORE/BANGALORE"]),
        ("Zepto", ["UPI/ZEPTO/{ref}", "ZEPTO GROCERY ORDER"]),
    ],
    "monthly_trips": (4, 7),
    "amount_range": (450, 1_800),
    "category": "Groceries",
}

DINING = {
    "merchants": [
        ("Swiggy", ["UPI/SWIGGY/{ref}", "SWIGGY ORDER #{ref}"]),
        ("Zomato", ["UPI/ZOMATO/{ref}", "ZOMATO ONLINE ORDER"]),
        ("Third Wave Coffee", ["POS/THIRD WAVE COFFEE/INDIRANAGAR"]),
        ("Toit Brewpub", ["POS/TOIT BREWPUB/INDIRANAGAR"]),
        ("Cafe Coffee Day", ["POS/CCD/KORAMANGALA"]),
        ("Starbucks", ["POS/STARBUCKS/PHOENIX MALL"]),
    ],
    "monthly_trips": (6, 12),
    "amount_range": (150, 1_200),
    "category": "Dining",
}

FUEL = {
    "merchants": [
        ("HP Petrol Pump", ["POS/HP FUEL STN/WHITEFIELD", "UPI/HP PETROL/{ref}"]),
        ("Indian Oil", ["POS/IOCL FUEL/MARATHON", "UPI/INDIANOIL/{ref}"]),
    ],
    "monthly_trips": (2, 4),
    "amount_range": (800, 2_000),
    "category": "Fuel",
}

SHOPPING = {
    "merchants": [
        ("Amazon", ["POS/AMAZON.IN/AMZN MKTP", "AMAZON PAY EMI/{ref}"]),
        ("Flipkart", ["UPI/FLIPKART/{ref}", "FLIPKART ORDER"]),
        ("Myntra", ["POS/MYNTRA/ONLINE", "UPI/MYNTRA/{ref}"]),
        ("Croma", ["POS/CROMA/KORAMANGALA"]),
    ],
    "monthly_trips": (1, 4),
    "amount_range": (500, 4_500),
    "category": "Shopping",
}

ENTERTAINMENT = {
    "merchants": [
        ("BookMyShow", ["UPI/BOOKMYSHOW/{ref}", "POS/PVR CINEMAS/FORUM MALL"]),
        ("Sony LIV", ["SONYLIV SUBSCRIPTION"]),
    ],
    "monthly_trips": (0, 2),
    "amount_range": (200, 800),
    "category": "Entertainment",
}

TRANSPORT = {
    "merchants": [
        ("Uber", ["UPI/UBER INDIA/{ref}", "UBER TRIP"]),
        ("Ola", ["UPI/OLA CABS/{ref}", "OLA RIDE"]),
        ("Rapido", ["UPI/RAPIDO/{ref}"]),
    ],
    "monthly_trips": (3, 8),
    "amount_range": (80, 500),
    "category": "Transport",
}

HEALTH = {
    "merchants": [
        ("Cult.fit", ["UPI/CULTFIT/{ref}", "CULT.FIT MEMBERSHIP"]),
        ("Apollo Pharmacy", ["POS/APOLLO PHARMACY/WHITEFIELD"]),
        ("Practo", ["UPI/PRACTO/{ref}"]),
    ],
    "monthly_trips": (0, 2),
    "amount_range": (200, 2_000),
    "category": "Health",
}

DISCRETIONARY_CATEGORIES = [GROCERIES, DINING, FUEL, SHOPPING, ENTERTAINMENT, TRANSPORT, HEALTH]


def _make_ref():
    """Generate a random reference number."""
    return str(random.randint(100000000, 999999999))


def _random_day_in_month(year: int, month: int, min_day: int = 1, max_day: int = 28) -> datetime:
    """Pick a random day within a month."""
    day = random.randint(min_day, min(max_day, 28))
    return datetime(year, month, day)


def _generate_transaction(date: datetime, description: str, amount: float,
                          txn_type: str, category: str = None,
                          merchant: str = None, is_recurring: bool = False,
                          recurring_group: str = None) -> Dict:
    """Create a single transaction dict."""
    return {
        "id": str(uuid.uuid4()),
        "date": date.strftime("%Y-%m-%d"),
        "description": description.replace("{ref}", _make_ref()),
        "raw_description": description.replace("{ref}", _make_ref()),
        "amount": round(amount, 2),
        "type": txn_type,
        "category": category,
        "merchant_name": merchant,
        "is_recurring": 1 if is_recurring else 0,
        "recurring_group_id": recurring_group,
    }


def _generate_salary(year: int, month: int) -> Dict:
    """Generate monthly salary credit."""
    day = PERSONA["salary_day"]
    # Adjust for weekends
    date = datetime(year, month, day)
    while date.weekday() >= 5:  # Saturday/Sunday
        date += timedelta(days=1)
    
    desc_templates = [
        f"NEFT/TECHCORP SOLUTIONS/SAL/{date.strftime('%b').upper()}-{year}",
        f"SALARY CREDIT TECHCORP/{date.strftime('%m')}/{year}",
    ]
    return _generate_transaction(
        date=date,
        description=random.choice(desc_templates),
        amount=PERSONA["salary"],
        txn_type="credit",
        category="Salary",
        merchant="TechCorp Solutions",
        is_recurring=True,
        recurring_group="SALARY",
    )


def _generate_recurring(year: int, month: int, recurring_def: Dict,
                         month_index: int) -> Dict:
    """Generate a recurring charge for a given month."""
    amount = recurring_def["amount"]
    
    # ─── ANOMALY #1: Netflix price hike in month 4 ───
    if recurring_def["name"] == "Netflix" and month_index >= 3:
        amount = 899  # Up from 649
    
    if recurring_def["variance"] > 0:
        amount += random.uniform(-recurring_def["variance"], recurring_def["variance"])
        amount = max(amount, recurring_def["amount"] * 0.5)  # Floor at 50%
    
    day = recurring_def["day"]
    date = datetime(year, month, day)
    # Adjust for weekends for bank debits
    while date.weekday() >= 5:
        date += timedelta(days=1)
    
    desc = random.choice(recurring_def["description_templates"])
    
    return _generate_transaction(
        date=date,
        description=desc,
        amount=round(amount, 2),
        txn_type="debit",
        category=recurring_def["category"],
        merchant=recurring_def["name"],
        is_recurring=True,
        recurring_group=recurring_def["name"].upper().replace(" ", "_"),
    )


def _generate_discretionary(year: int, month: int, cat_def: Dict,
                              month_index: int) -> List[Dict]:
    """Generate discretionary spending transactions for a month."""
    min_trips, max_trips = cat_def["monthly_trips"]
    min_amt, max_amt = cat_def["amount_range"]
    
    # ─── ANOMALY #3: Month 5 (index 4) spending spree ───
    multiplier = 1.0
    if month_index == 4:  # Month 5 (Aug 2025)
        if cat_def["category"] in ("Dining", "Shopping", "Entertainment"):
            multiplier = 2.5  # 2.5x normal spending
        elif cat_def["category"] in ("Groceries", "Transport"):
            multiplier = 1.5
    
    num_trips = random.randint(min_trips, max_trips)
    if multiplier > 1:
        num_trips = int(num_trips * multiplier)
    
    transactions = []
    for _ in range(num_trips):
        merchant_name, desc_templates = random.choice(cat_def["merchants"])
        amount = random.uniform(min_amt, max_amt)
        if multiplier > 1:
            amount *= random.uniform(1.0, multiplier * 0.8)
        
        date = _random_day_in_month(year, month)
        
        transactions.append(_generate_transaction(
            date=date,
            description=random.choice(desc_templates),
            amount=round(amount, 2),
            txn_type="debit",
            category=cat_def["category"],
            merchant=merchant_name,
        ))
    
    return transactions


def _generate_large_purchase(year: int, month: int) -> Dict:
    """ANOMALY #2: Unusually large ₹45,000 electronics purchase in month 3."""
    date = _random_day_in_month(year, month, min_day=10, max_day=25)
    return _generate_transaction(
        date=date,
        description="POS/CROMA ELECTRONICS/KORAMANGALA/LAPTOP STAND+MECH KB",
        amount=45_000.0,
        txn_type="debit",
        category="Shopping",
        merchant="Croma",
    )


def generate_synthetic_data():
    """Generate all synthetic transactions and store in SQLite.
    
    Idempotent — skips generation if transactions already exist.
    """
    with get_db() as conn:
        count = conn.execute("SELECT COUNT(*) FROM transactions").fetchone()[0]
        if count > 0:
            print(f"  ✓ Synthetic data already present ({count} transactions)")
            return
    
    random.seed(SEED)
    all_transactions = []
    
    current = START_DATE
    month_index = 0
    
    while current <= END_DATE:
        year, month = current.year, current.month
        
        # Salary
        all_transactions.append(_generate_salary(year, month))
        
        # Recurring charges
        for rec in RECURRING:
            all_transactions.append(_generate_recurring(year, month, rec, month_index))
        
        # Discretionary spending
        for cat_def in DISCRETIONARY_CATEGORIES:
            all_transactions.extend(
                _generate_discretionary(year, month, cat_def, month_index)
            )
        
        # ─── ANOMALY #2: Large purchase in month 3 (June 2025) ───
        if month_index == 2:
            all_transactions.append(_generate_large_purchase(year, month))
        
        # Move to next month
        if month == 12:
            current = datetime(year + 1, 1, 1)
        else:
            current = datetime(year, month + 1, 1)
        month_index += 1
    
    # Sort by date
    all_transactions.sort(key=lambda t: t["date"])
    
    # Calculate running balance
    balance = STARTING_BALANCE
    for txn in all_transactions:
        if txn["type"] == "credit":
            balance += txn["amount"]
        else:
            balance -= txn["amount"]
        txn["balance_after"] = round(balance, 2)
    
    # Insert into database
    with get_db() as conn:
        for txn in all_transactions:
            conn.execute("""
                INSERT INTO transactions 
                (id, date, description, amount, type, balance_after,
                 raw_description, category, merchant_name, is_recurring,
                 recurring_group_id, category_source, category_confidence)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                txn["id"], txn["date"], txn["description"], txn["amount"],
                txn["type"], txn["balance_after"], txn["raw_description"],
                txn["category"], txn["merchant_name"], txn["is_recurring"],
                txn["recurring_group_id"], "synthetic", 1.0,
            ))
        
        # Also set up default budgets
        default_budgets = [
            ("Groceries", 6000), ("Dining", 5000), ("Fuel", 4000),
            ("Shopping", 5000), ("Entertainment", 2000), ("Transport", 3000),
            ("Health", 3000), ("Utilities", 3000), ("Subscriptions", 1500),
        ]
        for cat, limit in default_budgets:
            conn.execute(
                "INSERT OR IGNORE INTO budgets (category, monthly_limit) VALUES (?, ?)",
                (cat, limit),
            )
        
        # Set up a savings goal with realistic 18-month future timeline
        future_goal_deadline = (datetime.now() + timedelta(days=540)).strftime("%Y-%m-%d")
        conn.execute("""
            INSERT OR REPLACE INTO goals 
            (id, name, target_amount, current_amount, deadline, monthly_contribution, status)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            "goal-emergency-fund",
            "Emergency Fund (6 months expenses)",
            300000, 45000, future_goal_deadline, 8000, "active",
        ))
    
    print(f"  ✓ Generated {len(all_transactions)} synthetic transactions (Apr-Sep 2025)")
    print(f"    → Anomaly #1: Netflix price hike ₹649→₹899 from Jul 2025")
    print(f"    → Anomaly #2: ₹45,000 electronics purchase in Jun 2025")
    print(f"    → Anomaly #3: Spending spree in Aug 2025 (outpaces income)")
