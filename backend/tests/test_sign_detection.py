"""
Regression: CC files with refunds must still be sign-flipped.

A MAX statement that contains a couple of refund rows (negative amounts
in the source) used to cross the 3% "mixed-sign" threshold in
process_data, get misidentified as a bank statement, and skip the
sign-flip — leaving every regular CC charge as positive (i.e. classified
as income instead of expense).
"""
import pandas as pd
from app.services.data_processor import process_data


def test_cc_file_with_few_refunds_still_flips_signs():
    # 48 CC charges (positive in source = expense) + 2 refunds (negative in source
    # = refund/credit). 2/50 = 4%, which crosses the 3% bank-statement threshold.
    rows = []
    for i in range(48):
        rows.append({'תאריך': f'2026-04-{(i%28)+1:02d}', 'תאריך חיוב': '2026-05-15',
                     'סכום חיוב': 100 + i, 'שם בית העסק': f'merchant {i}', 'קטגוריה': 'שונות'})
    rows.append({'תאריך': '2025-09-20', 'תאריך חיוב': '2026-05-10',
                 'סכום חיוב': -4221.15, 'שם בית העסק': 'אל על נתיבי אויר לישראל', 'קטגוריה': 'טיסות ותיירות'})
    rows.append({'תאריך': '2025-10-01', 'תאריך חיוב': '2026-05-10',
                 'סכום חיוב': -500.00, 'שם בית העסק': 'refund merchant', 'קטגוריה': 'שונות'})
    df = pd.DataFrame(rows)

    processed = process_data(df, 'תאריך', 'סכום חיוב', 'שם בית העסק', 'קטגוריה', 'תאריך חיוב')

    # 48 expense rows must now be NEGATIVE (got flipped from source positive)
    expense_count = (processed['סכום'] < 0).sum()
    income_count = (processed['סכום'] > 0).sum()
    assert expense_count == 48, (
        f"Expected 48 expense (negative) rows, got {expense_count}. "
        f"Sign-flip likely skipped because the file was misidentified as a bank statement."
    )
    assert income_count == 2, f"Expected 2 income (positive) refund rows, got {income_count}"


def test_bank_statement_keeps_original_signs():
    """Bank statements with 'זכות/חובה' column must NOT be sign-flipped."""
    rows = [
        {'תאריך': '2026-05-01', '₪ זכות/חובה': -3800, 'תיאור התנועה': 'משיכת שיק'},
        {'תאריך': '2026-05-06', '₪ זכות/חובה': 10600, 'תיאור התנועה': 'בנק פועלים משכורת'},
        {'תאריך': '2026-05-08', '₪ זכות/חובה': -50, 'תיאור התנועה': 'עמלת בנק'},
    ]
    df = pd.DataFrame(rows)
    processed = process_data(df, 'תאריך', '₪ זכות/חובה', 'תיאור התנועה', None, None)

    # Signs must be preserved
    salary_row = processed[processed['תיאור'].str.contains('משכורת')]
    rent_row = processed[processed['תיאור'].str.contains('שיק')]
    assert (salary_row['סכום'] > 0).all(), "salary must stay positive"
    assert (rent_row['סכום'] < 0).all(), "rent withdrawal must stay negative"
