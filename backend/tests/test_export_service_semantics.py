"""Byte-level semantics tests for the exported workbook.

The export must match what the user sees in the ledger: signed amounts,
real dates, RTL Hebrew layout, and the visible columns (billing date,
subcategory, notes) preserved.
"""
import datetime

import pandas as pd
from openpyxl import load_workbook

from app.services.export_service import export_to_excel


def _frame() -> pd.DataFrame:
    return pd.DataFrame([
        {'תאריך': pd.Timestamp('2026-09-10'), 'תאריך_חיוב': pd.Timestamp('2026-09-12'),
         'תיאור': 'משכורת חודשית', 'קטגוריה': 'הכנסות', 'קטגוריה_משנה': None, 'הערות': None, 'סכום': 18000.0},
        {'תאריך': pd.Timestamp('2026-09-02'), 'תאריך_חיוב': pd.NaT,
         'תיאור': 'סופר קטן שכונה', 'קטגוריה': 'אוכל', 'קטגוריה_משנה': 'סופרים קטנים', 'הערות': 'קניות לשבוע', 'סכום': -87.90},
        {'תאריך': pd.Timestamp('2026-09-20'), 'תאריך_חיוב': pd.NaT,
         'תיאור': 'הלוואה - משיכה', 'קטגוריה': 'תנועות מימון', 'קטגוריה_משנה': None, 'הערות': None, 'סכום': 5000.0},
        {'תאריך': pd.Timestamp('2026-09-25'), 'תאריך_חיוב': pd.NaT,
         'תיאור': 'החזר הלוואה', 'קטגוריה': 'תנועות מימון', 'קטגוריה_משנה': None, 'הערות': None, 'סכום': -5000.0},
        {'תאריך': pd.NaT, 'תאריך_חיוב': pd.NaT,
         'תיאור': 'עסקה ללא תאריך', 'קטגוריה': 'שונות', 'קטגוריה_משנה': None, 'הערות': None, 'סכום': -10.0},
    ])


def _sheet(df: pd.DataFrame):
    return load_workbook(export_to_excel(df))['עסקאות']


def test_amounts_keep_their_sign():
    ws = _sheet(_frame())
    headers = [c.value for c in ws[1]]
    amount_col = headers.index('סכום') + 1
    amounts = [ws.cell(row=r, column=amount_col).value for r in range(2, 7)]
    assert amounts == [18000.0, -87.9, 5000.0, -5000.0, -10.0]
    # Loan drawdown and its repayment must stay distinguishable.
    assert amounts[2] != amounts[3]


def test_nat_date_row_exports_blank_instead_of_crashing():
    ws = _sheet(_frame())  # must not raise
    headers = [c.value for c in ws[1]]
    date_col = headers.index('תאריך') + 1
    # Row 6 has the NaT date: blank cell, and the row itself still exported.
    assert ws.cell(row=6, column=date_col).value in (None, '')
    assert ws.cell(row=6, column=headers.index('תיאור') + 1).value == 'עסקה ללא תאריך'


def test_dates_are_real_excel_date_cells():
    ws = _sheet(_frame())
    headers = [c.value for c in ws[1]]
    cell = ws.cell(row=2, column=headers.index('תאריך') + 1)
    assert isinstance(cell.value, datetime.datetime)
    assert cell.value.date() == datetime.date(2026, 9, 10)
    assert 'dd/mm/yyyy' in cell.number_format.lower()


def test_sheet_is_right_to_left():
    ws = _sheet(_frame())
    assert ws.sheet_view.rightToLeft


def test_amount_cells_have_shekel_currency_format():
    ws = _sheet(_frame())
    headers = [c.value for c in ws[1]]
    cell = ws.cell(row=2, column=headers.index('סכום') + 1)
    assert '₪' in cell.number_format
    assert '#,##0.00' in cell.number_format


def test_visible_columns_are_preserved():
    ws = _sheet(_frame())
    headers = [c.value for c in ws[1]]
    assert headers == ['תאריך', 'תאריך_חיוב', 'תיאור', 'קטגוריה', 'קטגוריה_משנה', 'הערות', 'סכום']
    # Values land too: subcategory + note of row 3, billing date of row 2.
    assert ws.cell(row=3, column=headers.index('קטגוריה_משנה') + 1).value == 'סופרים קטנים'
    assert ws.cell(row=3, column=headers.index('הערות') + 1).value == 'קניות לשבוע'
    assert isinstance(ws.cell(row=2, column=headers.index('תאריך_חיוב') + 1).value, datetime.datetime)


def test_missing_optional_columns_still_export():
    df = pd.DataFrame([{
        'תאריך': pd.Timestamp('2026-08-28'), 'תיאור': 'ווט קניון',
        'קטגוריה': 'קניות', 'סכום': -199.95,
    }])
    ws = _sheet(df)
    assert [c.value for c in ws[1]] == ['תאריך', 'תיאור', 'קטגוריה', 'סכום']
    assert ws.cell(row=2, column=4).value == -199.95


def test_formula_injection_still_blocked():
    df = pd.DataFrame([{
        'תאריך': pd.Timestamp('2026-08-28'), 'תיאור': '=HYPERLINK("https://example.invalid","click")',
        'קטגוריה': 'שונות', 'סכום': -10.0,
    }])
    ws = _sheet(df)
    cell = ws.cell(row=2, column=2)
    assert cell.value.startswith('=HYPERLINK')
    assert cell.data_type == 's'


def test_print_fits_one_page_wide():
    ws = _sheet(_frame())
    # fitToWidth=1 is Excel's default and is omitted from the XML; what must
    # hold: fit-to-page enabled, height unlimited (0), width default-or-1.
    assert str(ws.page_setup.fitToHeight) == '0'
    assert ws.page_setup.fitToWidth in (None, 1, '1')
    assert ws.sheet_properties.pageSetUpPr.fitToPage


def test_none_and_nan_text_cells_are_blank_not_crash():
    df = _frame()
    df.loc[0, 'הערות'] = None
    df.loc[1, 'קטגוריה_משנה'] = float('nan')
    ws = _sheet(df)  # must not raise
    headers = [c.value for c in ws[1]]
    assert ws.cell(row=2, column=headers.index('הערות') + 1).value in (None, '')
    assert ws.cell(row=3, column=headers.index('קטגוריה_משנה') + 1).value in (None, '')


def test_financing_rows_stay_in_export():
    ws = _sheet(_frame())
    headers = [c.value for c in ws[1]]
    cat_col = headers.index('קטגוריה') + 1
    cats = [ws.cell(row=r, column=cat_col).value for r in range(2, 7)]
    assert cats.count('תנועות מימון') == 2
