"""The month-by-month category comparison endpoint.

Returns, per (category, month), the amount and that cell's share of the month's
total expenses (pct_of_month), plus month-over-month deltas. Uses the shift-aware
_month_series so months agree with the rest of the dashboard. Handlers are called
directly (the sandbox's numpy-int JSON quirk only bites the ASGI encoder).
"""
import pandas as pd
import pytest

from app.api.routes import sessions, get_category_monthly_comparison


def _mk(key, rows):
    df = pd.DataFrame(rows)
    df['תאריך'] = pd.to_datetime(df['תאריך'])
    if 'תאריך_חיוב' in df.columns:
        df['תאריך_חיוב'] = pd.to_datetime(df['תאריך_חיוב'])
    df['סכום_מוחלט'] = df['סכום'].abs()
    sessions[key] = df
    return key


ROWS = [
    {'תאריך': '2026-01-05', 'סכום': -200, 'תיאור': 'שופרסל', 'קטגוריה': 'מזון וצריכה', 'חודש': '01/2026'},
    {'תאריך': '2026-01-08', 'סכום': -100, 'תיאור': 'חשמל', 'קטגוריה': 'דלק, חשמל וגז', 'חודש': '01/2026'},
    {'תאריך': '2025-12-10', 'סכום': -300, 'תיאור': 'שופרסל', 'קטגוריה': 'מזון וצריכה', 'חודש': '12/2025'},
]


@pytest.mark.asyncio
async def test_months_sorted_chronologically():
    res = await get_category_monthly_comparison(_mk('cmp1', ROWS), 'transaction')
    assert res['months'] == ['12/2025', '01/2026']  # not string-sorted


@pytest.mark.asyncio
async def test_pct_of_month_sums_to_100():
    res = await get_category_monthly_comparison(_mk('cmp2', ROWS), 'transaction')
    for m in res['months']:
        total_pct = round(sum(c['months'][m]['pct_of_month'] for c in res['categories']), 0)
        assert total_pct == 100


@pytest.mark.asyncio
async def test_month_totals_and_grand_total():
    res = await get_category_monthly_comparison(_mk('cmp3', ROWS), 'transaction')
    assert res['month_totals'] == {'12/2025': 300, '01/2026': 300}
    assert res['grand_total'] == 600


@pytest.mark.asyncio
async def test_empty_session_contract():
    sessions['cmp_empty'] = pd.DataFrame(
        {'תאריך': pd.to_datetime([]), 'סכום': [], 'סכום_מוחלט': [], 'קטגוריה': []}
    )
    res = await get_category_monthly_comparison('cmp_empty', 'transaction')
    assert res == {"months": [], "categories": [], "month_totals": {}, "grand_total": 0}


@pytest.mark.asyncio
async def test_shift_aware_uses_attributed_month():
    # Dated 2025-12-31 but attributed to 01/2026 via the חודש column.
    sid = _mk('cmp_shift', [
        {'תאריך': '2025-12-31', 'סכום': -150, 'תיאור': 'שופרסל',
         'קטגוריה': 'מזון וצריכה', 'חודש': '01/2026'},
    ])
    res = await get_category_monthly_comparison(sid, 'transaction')
    assert res['months'] == ['01/2026']


@pytest.mark.asyncio
async def test_billing_date_type_uses_billing_month():
    sid = _mk('cmp_bill', [
        {'תאריך': '2026-01-31', 'סכום': -150, 'תיאור': 'שופרסל', 'קטגוריה': 'מזון וצריכה',
         'חודש': '01/2026', 'חודש_חיוב': '02/2026', 'תאריך_חיוב': '2026-02-02'},
    ])
    res = await get_category_monthly_comparison(sid, 'billing')
    assert res['months'] == ['02/2026']
