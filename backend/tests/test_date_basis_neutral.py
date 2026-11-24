"""Date-basis month attribution + neutral-financing aggregate contracts.

Approved rules (see CLAUDE.md "Income-month shift" and PR161 constants):
- Month grouping goes through _month_series, honoring the חודש/חודש_חיוב columns
  bank-sync bakes in (incl. the end-of-month salary shift).
- Billing basis: card rows group by חודש_חיוב; bank rows have no billing date
  and must fall back to the canonical חודש — never silently vanish.
- תנועות מימון rows stay visible in the ledger but are excluded from
  income/expense aggregation.
"""
from datetime import date, datetime, timezone

import pandas as pd
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.api import routes


def _row(date, amount, desc, cat, billing=None, owner='מור', bank=False, month=None, bmonth=None):
    d = pd.Timestamp(date)
    bd = pd.Timestamp(billing) if billing else pd.NaT
    return {
        'תאריך': d, 'סכום': float(amount), 'תיאור': desc, 'קטגוריה': cat, 'קטגוריה_משנה': '',
        'סכום_מוחלט': abs(float(amount)), 'חודש': month or d.strftime('%m/%Y'),
        'יום_בשבוע': d.dayofweek, 'תאריך_חיוב': bd,
        'חודש_חיוב': (bmonth if bmonth is not None else (bd.strftime('%m/%Y') if billing else None)),
        'הערות': None, '_provider': 'isracard', '_owner': owner, '_is_bank_row': bank, 'id': None,
    }


def _freeze_month_overview_clock(monkeypatch, instant):
    class Clock:
        @staticmethod
        def now(tz=None):
            return instant.astimezone(tz) if tz else instant.replace(tzinfo=None)

    monkeypatch.setattr(routes, 'datetime', Clock)


@pytest.fixture()
def client(monkeypatch):
    _freeze_month_overview_clock(monkeypatch, datetime(2026, 11, 25, 9, tzinfo=timezone.utc))
    df = pd.DataFrame([
        # card rows: purchased in Oct, billed in Nov (boundary) / Oct (same month)
        _row('2026-10-31', -500, 'מסעדת הגנה', 'אוכל', billing='2026-11-02'),
        _row('2026-10-02', -100, 'קפה לנדוור', 'אוכל', billing='2026-10-02'),
        # bank row: no billing date — ATM withdrawal stays an expense
        _row('2026-10-30', -400, 'משיכת מזומן בנק דיסקונט', 'משיכת מזומן', bank=True),
        # shifted salary: bank-sync attributes it (both month columns) to 10/2026
        _row('2026-09-28', 10000, 'משכורת', 'הכנסה', bank=True, month='10/2026', bmonth='10/2026'),
        # neutral financing shell rows (owner שלי)
        _row('2026-10-02', -9200, 'העברות לקרדיט', 'תנועות מימון', billing='2026-10-02', owner='שלי'),
        _row('2026-10-02', 9200, 'העברות לקרדיט', 'תנועות מימון', billing='2026-10-02', owner='שלי'),
    ])
    routes.sessions['t-datebasis'] = df
    with TestClient(app) as c:
        yield c
    routes.sessions.pop('t-datebasis', None)


def test_billing_basis_keeps_bank_rows_in_canonical_month(client):
    """Billing basis: bank rows (no billing date) fall back to חודש — Oct total
    includes the 400 ATM withdrawal and the 100 same-month card charge."""
    r = client.get('/api/charts/v2/month-overview',
                   params={'sessionId': 't-datebasis', 'month': '10/2026', 'date_type': 'billing'})
    assert r.status_code == 200
    body = r.json()
    assert body['total_expenses'] == 500.0  # 100 card + 400 ATM
    assert body['total_income'] == 10000.0  # shifted salary stays in 10/2026
    pace = body['cumulative_expenses']
    assert len(pace) == 31
    assert [pace[0], pace[1], pace[28], pace[29], pace[30]] == [0, 100, 100, 500, 500]


def test_billing_basis_keeps_card_rows_in_billing_month(client):
    """The 31/10 purchase billed 02/11 lands in Nov under billing basis,
    in Oct under transaction basis."""
    billing = client.get('/api/charts/v2/month-overview',
                         params={'sessionId': 't-datebasis', 'month': '11/2026', 'date_type': 'billing'}).json()
    txn = client.get('/api/charts/v2/month-overview',
                     params={'sessionId': 't-datebasis', 'month': '10/2026', 'date_type': 'transaction'}).json()
    assert billing['total_expenses'] == 500.0
    assert txn['total_expenses'] == 1000.0  # 500 + 100 + 400
    assert billing['cumulative_expenses'][:2] == [0, 500]
    assert txn['cumulative_expenses'][-2:] == [500, 1000]


def test_spending_pace_stops_at_local_today_and_preserves_short_months():
    expenses = pd.DataFrame({
        'תאריך': pd.to_datetime(['2024-03-01', '2024-03-18', '2024-03-19']),
        'סכום_מוחלט': [7.25, 10.50, 200],
    })
    today = date(2024, 3, 18)
    pace = routes._cumulative_expenses(expenses, '03/2024', 'transaction', today)
    assert pace == [7.25] * 17 + [17.75]
    assert routes._cumulative_expenses(expenses.iloc[:0], '02/2024', 'transaction', today) == [0] * 29
    assert routes._cumulative_expenses(expenses.iloc[:0], '04/2024', 'transaction', today) == []


def test_month_overview_uses_israel_midnight_for_billing_pace(client, monkeypatch):
    _freeze_month_overview_clock(monkeypatch, datetime(2026, 4, 30, 21, 1, tzinfo=timezone.utc))
    monkeypatch.setitem(routes.sessions, 'midnight-pace', pd.DataFrame([
        _row('2026-04-28', -101, 'קפה', 'אוכל', billing='2026-05-01'),
        _row('2026-04-29', -77, 'מסעדה', 'אוכל', billing='2026-05-02'),
    ]))
    response = client.get('/api/charts/v2/month-overview', params={
        'sessionId': 'midnight-pace', 'month': '05/2026', 'date_type': 'billing',
    })
    assert response.status_code == 200
    assert response.json()['cumulative_expenses'] == [101]
    assert response.json()['total_expenses'] == 178


@pytest.mark.parametrize('legacy_date', [pd.NaT, pd.Timestamp('2024-02-29')])
def test_spending_pace_does_not_invent_day_for_legacy_month_attribution(legacy_date):
    expenses = pd.DataFrame({
        'תאריך': pd.Series([legacy_date], dtype='datetime64[ns]'),
        'סכום_מוחלט': [100],
    })
    assert routes._cumulative_expenses(expenses, '03/2024', 'billing', date(2024, 4, 1)) is None


def test_category_snapshot_billing_no_crash_with_bank_rows(client):
    """Regression: snapshot used to 500 (None חודש_חיוב) on any bank expense row."""
    r = client.get('/api/charts/v2/category-snapshot',
                   params={'sessionId': 't-datebasis', 'date_type': 'billing',
                           'month_from': '10/2026', 'month_to': '11/2026'})
    assert r.status_code == 200
    totals = {c['name']: c['total'] for c in r.json()['categories']}
    assert totals['אוכל'] == 600.0
    assert totals['משיכת מזומן'] == 400.0


def test_transactions_aggregates_exclude_financing_but_ledger_keeps_rows(client):
    """Financing shell rows stay visible in the ledger list but are excluded
    from every monetary aggregate."""
    r = client.get('/api/transactions',
                   params={'sessionId': 't-datebasis', 'start_date': '2026-09-01',
                           'end_date': '2026-11-30', 'page_size': 50})
    assert r.status_code == 200
    body = r.json()
    assert body['total'] == 6                      # all rows visible in the ledger
    assert body['total_expenses'] == 1000.0        # 500 + 100 + 400, no -9200 leg
    assert body['total_income'] == 10000.0         # no +9200 leg
    assert all(c['name'] != 'תנועות מימון' for c in body['category_breakdown'])


def test_session_df_not_mutated_and_aggregates_consistent(client):
    """Endpoints must not mutate the stored session frame (no added helper
    columns, same row count), stats must not count financing rows, the ledger
    pagination total must count visible rows, and category_breakdown must sum
    to total_expenses."""
    before_cols = list(routes.sessions['t-datebasis'].columns)
    before_len = len(routes.sessions['t-datebasis'])
    client.get('/api/charts/v2/category-snapshot',
               params={'sessionId': 't-datebasis', 'date_type': 'billing'})
    client.get('/api/charts/v2/month-overview',
               params={'sessionId': 't-datebasis', 'month': '10/2026', 'date_type': 'billing'})
    r = client.get('/api/transactions',
                   params={'sessionId': 't-datebasis', 'start_date': '2026-09-01',
                           'end_date': '2026-11-30', 'page_size': 50})
    after = routes.sessions['t-datebasis']
    assert list(after.columns) == before_cols
    assert len(after) == before_len
    body = r.json()
    assert body['expense_count'] + body['income_count'] == 4  # shell rows excluded from counts
    assert body['total'] == 6                                  # ledger pagination counts visible rows
    assert round(sum(c['total'] for c in body['category_breakdown']), 2) == body['total_expenses']


def test_avg_transaction_uses_shell_excluded_denominator(client):
    """avg_transaction is the EXPENSE average (matching /trends and /budget):
    total_expenses / expense_count, both shell-excluded -> 1000/3 = 333.33,
    not deflated by the 2 visible shell rows (which would give 1000/5 = 200).
    The no-expense fallback divides total_amount by the shell-excluded count."""
    r = client.get('/api/transactions',
                   params={'sessionId': 't-datebasis', 'start_date': '2026-09-01',
                           'end_date': '2026-11-30', 'page_size': 50})
    assert r.status_code == 200
    body = r.json()
    assert body['total_amount'] == 11000.0
    assert body['total_expenses'] == 1000.0
    assert body['expense_count'] == 3
    assert body['avg_transaction'] == 333.33
