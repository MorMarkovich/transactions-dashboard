"""
Sample Transaction Data Generator
=================================
Generates realistic credit card transaction data with Hebrew support
for testing the Transaction Analyzer dashboard.

Run this script to create sample Excel and CSV files.
"""

import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import random
import os

# Seed for reproducibility
np.random.seed(42)
random.seed(42)

# =============================================================================
# MERCHANT DATA (English and Hebrew)
# =============================================================================

MERCHANTS = {
    'Food & Dining': [
        ('Aroma Espresso Bar', 'ארומה אספרסו בר'),
        ('Cafe Cafe', 'קפה קפה'),
        ('Landwer Cafe', 'קפה לנדוור'),
        ('McDonalds', 'מקדונלדס'),
        ('Pizza Hut', 'פיצה האט'),
        ('Sushi Mushi', 'סושי מושי'),
        ('Giraffe Noodle Bar', 'ג\'ירף נודל בר'),
        ('Burgers Bar', 'בורגרס בר'),
        ('Cafe Neto', 'קפה נטו'),
        ('Cofix', 'קופיקס'),
        ('Aldo Ice Cream', 'גלידה אלדו'),
        ('Hummus Eliyahu', 'חומוס אליהו'),
        ('Shipudei Hadera', 'שיפודי חדרה'),
        ('Meat Bar', 'מיט בר'),
        ('Cafe Greg', 'קפה גרג'),
    ],
    'Groceries': [
        ('Shufersal', 'שופרסל'),
        ('Rami Levy', 'רמי לוי'),
        ('Yochananof', 'יוחננוף'),
        ('Victory', 'ויקטורי'),
        ('Mega', 'מגה'),
        ('Hatzi Hinam', 'חצי חינם'),
        ('Osher Ad', 'אושר עד'),
        ('AM:PM', 'AM:PM'),
        ('Yellow', 'יילו'),
        ('Yenot Bitan', 'יינות ביתן'),
    ],
    'Transportation': [
        ('Paz Gas Station', 'תחנת דלק פז'),
        ('Sonol', 'סונול'),
        ('Delek', 'דלק'),
        ('Dor Alon', 'דור אלון'),
        ('Ten Gas Station', 'תחנת דלק טן'),
        ('Gett Taxi', 'גט מונית'),
        ('Yango', 'יאנגו'),
        ('Israel Railways', 'רכבת ישראל'),
        ('Egged Bus', 'אגד'),
        ('Dan Bus', 'דן'),
        ('Ahuzat Hahof Parking', 'אחוזת החוף חניה'),
        ('City Parking', 'חניון עירוני'),
    ],
    'Shopping': [
        ('IKEA', 'איקאה'),
        ('Ace Hardware', 'אייס'),
        ('Fox', 'פוקס'),
        ('Castro', 'קסטרו'),
        ('Zara', 'זארה'),
        ('H&M', 'H&M'),
        ('Renuar', 'רנואר'),
        ('Golf', 'גולף'),
        ('Hamashbir', 'המשביר'),
        ('KSP Computers', 'KSP מחשבים'),
        ('Bug Electronics', 'באג'),
        ('Azrieli Mall', 'קניון עזריאלי'),
        ('Dizengoff Center', 'דיזנגוף סנטר'),
        ('Grand Canyon Mall', 'גרנד קניון'),
        ('Amazon', 'אמזון'),
        ('AliExpress', 'אלי אקספרס'),
    ],
    'Entertainment': [
        ('Netflix', 'נטפליקס'),
        ('Spotify', 'ספוטיפיי'),
        ('Yes TV', 'יס'),
        ('Hot Cable', 'הוט'),
        ('Partner TV', 'פרטנר TV'),
        ('Cinema City', 'סינמה סיטי'),
        ('Yes Planet', 'יס פלאנט'),
        ('Rav Chen Cinema', 'רב חן'),
        ('Lev Cinema', 'לב'),
        ('Habima Theater', 'תיאטרון הבימה'),
        ('Cameri Theater', 'תיאטרון הקאמרי'),
        ('Apple Music', 'אפל מיוזיק'),
    ],
    'Bills & Utilities': [
        ('Israel Electric', 'חברת החשמל'),
        ('Bezeq', 'בזק'),
        ('Partner', 'פרטנר'),
        ('Cellcom', 'סלקום'),
        ('Pelephone', 'פלאפון'),
        ('012 Smile', '012 סמייל'),
        ('HOT Internet', 'הוט אינטרנט'),
        ('Bezeq Internet', 'בזק אינטרנט'),
        ('Mekorot Water', 'מקורות'),
        ('Mei Avivim', 'מי אביבים'),
        ('Municipality Tax', 'ארנונה'),
        ('Harel Insurance', 'הראל ביטוח'),
        ('Migdal Insurance', 'מגדל ביטוח'),
        ('Clal Insurance', 'כלל ביטוח'),
    ],
    'Health': [
        ('Super-Pharm', 'סופר-פארם'),
        ('Be Pharm', 'בי פארם'),
        ('Maccabi Health', 'מכבי'),
        ('Clalit Health', 'כללית'),
        ('Leumit Health', 'לאומית'),
        ('Meuhedet Health', 'מאוחדת'),
        ('Dr. Levy Clinic', 'ד"ר לוי'),
        ('Dental Clinic', 'מרפאת שיניים'),
        ('Opticana', 'אופטיקנה'),
        ('GNC', 'GNC'),
    ],
    'ATM & Cash': [
        ('ATM Withdrawal', 'משיכת כספומט'),
        ('Bank Hapoalim ATM', 'כספומט בנק הפועלים'),
        ('Bank Leumi ATM', 'כספומט בנק לאומי'),
        ('Discount Bank ATM', 'כספומט בנק דיסקונט'),
        ('Mizrahi Bank ATM', 'כספומט בנק מזרחי'),
    ],
    'Travel': [
        ('Booking.com', 'בוקינג'),
        ('Airbnb', 'אירביאנבי'),
        ('El Al Airlines', 'אל על'),
        ('Israir', 'ישראייר'),
        ('Arkia', 'ארקיע'),
        ('Dan Hotel', 'מלון דן'),
        ('Fattal Hotels', 'מלונות פתאל'),
        ('Isrotel', 'ישרוטל'),
    ],
    'Education': [
        ('Tel Aviv University', 'אוניברסיטת תל אביב'),
        ('Hebrew University', 'האוניברסיטה העברית'),
        ('Technion', 'הטכניון'),
        ('Steimatzky Books', 'סטימצקי'),
        ('Tzomet Sfarim', 'צומת ספרים'),
        ('Udemy', 'יודמי'),
        ('Coursera', 'קורסרה'),
    ],
}


def generate_amount(category: str) -> float:
    """Generate a realistic transaction amount based on category."""
    
    amount_ranges = {
        'Food & Dining': (25, 250),
        'Groceries': (50, 800),
        'Transportation': (20, 400),
        'Shopping': (50, 2000),
        'Entertainment': (30, 200),
        'Bills & Utilities': (100, 1500),
        'Health': (30, 500),
        'ATM & Cash': (100, 1000),
        'Travel': (500, 5000),
        'Education': (100, 3000),
    }
    
    min_val, max_val = amount_ranges.get(category, (20, 500))
    
    # Use log-normal distribution for more realistic amounts
    mean = (min_val + max_val) / 2
    std = (max_val - min_val) / 4
    amount = np.random.normal(mean, std)
    amount = max(min_val, min(max_val, amount))
    
    return round(amount, 2)


def generate_transactions(
    num_transactions: int = 200,
    start_date: datetime = None,
    end_date: datetime = None,
    use_hebrew: bool = True
) -> pd.DataFrame:
    """Generate sample transaction data."""
    
    if start_date is None:
        start_date = datetime.now() - timedelta(days=365)
    if end_date is None:
        end_date = datetime.now()
    
    transactions = []
    
    # Category distribution (weighted)
    category_weights = {
        'Food & Dining': 0.25,
        'Groceries': 0.20,
        'Transportation': 0.15,
        'Shopping': 0.12,
        'Entertainment': 0.08,
        'Bills & Utilities': 0.08,
        'Health': 0.05,
        'ATM & Cash': 0.04,
        'Travel': 0.02,
        'Education': 0.01,
    }
    
    categories = list(category_weights.keys())
    weights = list(category_weights.values())
    
    for _ in range(num_transactions):
        # Random date
        days_range = (end_date - start_date).days
        random_days = random.randint(0, days_range)
        trans_date = start_date + timedelta(days=random_days)
        
        # Random category
        category = random.choices(categories, weights=weights)[0]
        
        # Random merchant
        merchants = MERCHANTS[category]
        merchant = random.choice(merchants)
        
        # Use Hebrew or English name
        if use_hebrew and random.random() > 0.3:
            merchant_name = merchant[1]  # Hebrew
        else:
            merchant_name = merchant[0]  # English
        
        # Generate amount (negative for expenses)
        amount = -generate_amount(category)
        
        # Sometimes add income transactions
        if random.random() < 0.05:
            amount = abs(amount) * random.uniform(10, 50)  # Salary or refund
            merchant_name = random.choice(['Salary', 'משכורת', 'Refund', 'החזר', 'Transfer', 'העברה'])
            category = 'Income'
        
        transactions.append({
            'תאריך': trans_date.strftime('%d/%m/%Y'),
            'תיאור': merchant_name,
            'קטגוריה': category if use_hebrew else category,
            'סכום': amount,
            'סוג עסקה': 'רגילה' if random.random() > 0.1 else 'תשלומים',
            'מספר כרטיס': f'**** {random.randint(1000, 9999)}',
        })
    
    # Sort by date
    df = pd.DataFrame(transactions)
    df['תאריך'] = pd.to_datetime(df['תאריך'], dayfirst=True)
    df = df.sort_values('תאריך').reset_index(drop=True)
    df['תאריך'] = df['תאריך'].dt.strftime('%d/%m/%Y')
    
    return df


def generate_multi_sheet_excel(filename: str = 'sample_transactions.xlsx'):
    """Generate an Excel file with multiple sheets (cards/months)."""
    
    print(f"Generating {filename}...")
    
    # Generate data for different "cards" or time periods
    now = datetime.now()
    
    sheets = {
        'Visa Gold': generate_transactions(
            150, 
            now - timedelta(days=180),
            now,
            use_hebrew=True
        ),
        'Mastercard': generate_transactions(
            100,
            now - timedelta(days=180),
            now,
            use_hebrew=True
        ),
        'American Express': generate_transactions(
            50,
            now - timedelta(days=90),
            now,
            use_hebrew=False
        ),
    }
    
    with pd.ExcelWriter(filename, engine='openpyxl') as writer:
        for sheet_name, df in sheets.items():
            df.to_excel(writer, sheet_name=sheet_name, index=False)
    
    print(f"Created {filename} with sheets: {list(sheets.keys())}")
    return filename


def generate_csv(filename: str = 'sample_transactions.csv'):
    """Generate a CSV file with transaction data."""
    
    print(f"Generating {filename}...")
    
    df = generate_transactions(200, use_hebrew=True)
    df.to_csv(filename, index=False, encoding='utf-8-sig')
    
    print(f"Created {filename} with {len(df)} transactions")
    return filename


def main():
    """Generate all sample files."""
    
    print("=" * 50)
    print("Sample Transaction Data Generator")
    print("=" * 50)
    print()
    
    # Create output directory if needed
    output_dir = 'sample_data'
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
    
    # Generate files
    excel_file = os.path.join(output_dir, 'sample_transactions.xlsx')
    csv_file = os.path.join(output_dir, 'sample_transactions.csv')
    
    generate_multi_sheet_excel(excel_file)
    generate_csv(csv_file)
    
    print()
    print("=" * 50)
    print("Sample data generated successfully!")
    print(f"Files created in: {os.path.abspath(output_dir)}")
    print()
    print("You can now upload these files to the dashboard.")
    print("=" * 50)


if __name__ == "__main__":
    main()
