"""
Export service for generating Excel files
"""
import math

import pandas as pd
from io import BytesIO
from typing import Optional

# Column order in the exported workbook. Optional columns are included only
# when the session data actually carries them, so slimmer datasets still export.
_EXPORT_COLUMNS = ['תאריך', 'תאריך_חיוב', 'תיאור', 'קטגוריה', 'קטגוריה_משנה', 'הערות', 'סכום']
_DATE_COLUMNS = ('תאריך', 'תאריך_חיוב')
_AMOUNT_COLUMN = 'סכום'

_COLUMN_WIDTHS = {
    'תאריך': 12,
    'תאריך_חיוב': 12,
    'תיאור': 40,
    'קטגוריה': 18,
    'קטגוריה_משנה': 18,
    'הערות': 30,
    'סכום': 14,
}


def _is_missing(value) -> bool:
    """True for None/NaN/NaT/pd.NA scalars; False for real values incl. strings."""
    if value is None:
        return True
    if isinstance(value, str):
        return False
    try:
        return bool(pd.isna(value))
    except (TypeError, ValueError):
        return False


def export_to_excel(df: pd.DataFrame, filters: Optional[dict] = None) -> BytesIO:
    """ייצוא ל-Excel עם עיצוב מקצועי.

    Semantics contract with the ledger the user sees:
    - Amounts stay SIGNED (expenses negative, income positive) — never abs().
    - Dates are real Excel date cells (sortable/filterable), blank when missing.
    - The sheet is right-to-left with a ₪ currency format (red for negatives).
    - Billing date, subcategory and user notes are preserved when present.
    """
    output = BytesIO()

    columns = [c for c in _EXPORT_COLUMNS if c in df.columns]
    export_df = df[columns].copy()
    for col in _DATE_COLUMNS:
        if col in export_df.columns:
            export_df[col] = pd.to_datetime(export_df[col], errors='coerce')

    # Uploaded descriptions are untrusted. Disabling formula/URL conversion
    # prevents spreadsheet-formula injection when a value begins with =, +,
    # -, or @ and the exported workbook is opened. nan_inf_to_errors is a
    # last-resort guard so a stray NaN/Inf can never crash the export.
    with pd.ExcelWriter(
        output,
        engine='xlsxwriter',
        engine_kwargs={'options': {
            'strings_to_formulas': False,
            'strings_to_urls': False,
            'nan_inf_to_errors': True,
        }},
    ) as writer:
        workbook = writer.book
        worksheet = workbook.add_worksheet('עסקאות')
        writer.sheets['עסקאות'] = worksheet

        header_format = workbook.add_format({
            'bold': True,
            'bg_color': '#667eea',
            'font_color': 'white',
            'align': 'right',
            'valign': 'vcenter',
            'border': 1,
        })
        text_format = workbook.add_format({
            'align': 'right',
            'valign': 'vcenter',
            'border': 1,
        })
        date_format = workbook.add_format({
            'align': 'right',
            'valign': 'vcenter',
            'border': 1,
            'num_format': 'dd/mm/yyyy',
        })
        amount_format = workbook.add_format({
            'align': 'right',
            'valign': 'vcenter',
            'border': 1,
            'num_format': '#,##0.00 "₪";[Red]-#,##0.00 "₪"',
        })

        for col_num, value in enumerate(columns):
            worksheet.write(0, col_num, value, header_format)

        for row_idx, row in enumerate(export_df.itertuples(index=False, name=None), start=1):
            for col_num, (col, value) in enumerate(zip(columns, row)):
                if col in _DATE_COLUMNS:
                    if _is_missing(value):
                        worksheet.write_blank(row_idx, col_num, None, date_format)
                    else:
                        worksheet.write_datetime(row_idx, col_num, pd.Timestamp(value).to_pydatetime(), date_format)
                elif col == _AMOUNT_COLUMN:
                    if _is_missing(value) or (isinstance(value, float) and math.isinf(value)):
                        worksheet.write_blank(row_idx, col_num, None, amount_format)
                    else:
                        worksheet.write_number(row_idx, col_num, float(value), amount_format)
                else:
                    if _is_missing(value):
                        worksheet.write_blank(row_idx, col_num, None, text_format)
                    else:
                        worksheet.write(row_idx, col_num, str(value), text_format)

        # Hebrew RTL layout, readable on screen, and fits one page wide when
        # printed so the amount column never spills onto a second page.
        worksheet.right_to_left()
        worksheet.freeze_panes(1, 0)
        if columns:
            worksheet.autofilter(0, 0, max(len(export_df), 1), len(columns) - 1)
        worksheet.set_landscape()
        worksheet.fit_to_pages(1, 0)
        for col_num, col in enumerate(columns):
            worksheet.set_column(col_num, col_num, _COLUMN_WIDTHS.get(col, 18))

    output.seek(0)
    return output
