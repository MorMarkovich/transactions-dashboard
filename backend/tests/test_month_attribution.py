"""Regression tests for shift-aware month attribution.

bank-sync moves an end-of-month salary into the month it belongs to and records
that in the חודש / חודש_חיוב columns. Every month view must honor those columns
instead of re-deriving the month from the raw date — otherwise income lands in
the wrong month and per-month savings rates stop making sense.
"""
import pandas as pd
import pytest

from app.api.routes import (
    sessions, get_month_overview, get_monthly_v2, _month_series, _month_key,
)


def _setup(key, rows):
    df = pd.DataFrame(rows)
    df['תאריך'] = pd.to_datetime(df['תאריך'])
    if 'תאריך_חיוב' in df.columns:
        df['תאריך_חיוב'] = pd.to_datetime(df['תאריך_חיוב'])
    df['סכום_מוחלט'] = df['סכום'].abs()
    sessions[key] = df
    return key


# Salary dated 2026-04-30 but attributed (חודש) to 05/2026 by the income shift.
SHIFTED = [
    {'תאריך': '2026-04-30', 'סכום': 13000, 'תיאור': 'ישראכרט מש משכורת', 'קטגוריה': 'שונות',
     'חודש': '05/2026', 'חודש_חיוב': '05/2026', 'תאריך_חיוב': '2026-05-01'},
    {'תאריך': '2026-05-10', 'סכום': -500, 'תיאור': 'שופרסל', 'קטגוריה': 'מזון וצריכה',
     'חודש': '05/2026', 'חודש_חיוב': '05/2026', 'תאריך_חיוב': '2026-05-10'},
]


@pytest.mark.asyncio
async def test_shifted_salary_counts_in_attributed_month():
    sid = _setup('t-shift-1', SHIFTED)
    may = await get_month_overview(sid, '05/2026', 'transaction')
    assert may['total_income'] == 13000  # salary belongs to May (its attributed month)


@pytest.mark.asyncio
async def test_shifted_salary_absent_from_raw_date_month():
    sid = _setup('t-shift-2', SHIFTED)
    apr = await get_month_overview(sid, '04/2026', 'transaction')
    # The 2026-04-30 date must NOT pull the salary into April — that was the bug.
    assert apr['total_income'] == 0


@pytest.mark.asyncio
async def test_month_overview_and_buttons_agree():
    sid = _setup('t-shift-3', SHIFTED)
    months = [m['month'] for m in (await get_monthly_v2(sid, 'transaction'))['months']]
    # The expense is in May, so the month button is May — the same month the
    # overview attributes the income to.
    assert '05/2026' in months
    may = await get_month_overview(sid, '05/2026', 'transaction')
    assert may['total_income'] == 13000 and may['total_expenses'] == 500


def test_month_series_falls_back_when_column_missing():
    df = pd.DataFrame({'תאריך': pd.to_datetime(['2026-04-30'])})
    assert list(_month_series(df, 'transaction')) == ['04/2026']


def test_month_key_sorts_chronologically():
    assert sorted(['12/2025', '01/2026', '03/2025'], key=_month_key) == ['03/2025', '12/2025', '01/2026']
