"""A bank refresh restores the normalized snapshot and applies per-row Bit purposes."""
from fastapi.testclient import TestClient

from app.main import app
from app.services.data_processor import txn_fingerprint

client = TestClient(app)


def transfer(id_, description='העברה בביט', **fields):
    return {
        'id': id_, 'תאריך': '2026-10-07', 'תיאור': description,
        'סכום': -id_, 'קטגוריה': 'שונות', '_provider': 'leumi',
        **fields,
    }


def load_snapshot(rows, **overrides):
    response = client.post('/api/restore-session', json={'transactions': rows, **overrides})
    assert response.status_code == 200, response.text
    session = response.json()['session_id']
    result = client.get('/api/transactions', params={'sessionId': session}).json()
    return session, {row['id']: row for row in result['transactions']}


def test_refresh_uses_provider_details_per_transfer_without_a_file():
    rows = [
        transfer(1, _bank_memo='מתנה ליום הולדת'),
        transfer(2, הערות='שכר דירה'),  # snapshot from an older local sync
        transfer(3, 'העברה בביט - מסעדה'),
        transfer(4, _bank_memo='החזר למסעדה', קטגוריה='בילויים'),
        transfer(5, 'BIT TRANSFER', _bank_memo=''),
        transfer(6, 'ביט משיכה לחשבון בנק', _bank_memo='חתונה'),
        transfer(7, 'ביטוח ישיר', _bank_memo='מתנה'),
        transfer(8, _bank_memo='מסעדה וחניה'),
    ]
    _, ledger = load_snapshot(rows)
    assert (ledger[1]['קטגוריה'], ledger[2]['קטגוריה_משנה']) == ('אירועים ומתנות', 'שכר דירה')
    assert ledger[3]['קטגוריה_משנה'] == 'מסעדות וברים'
    assert all(ledger[i]['קטגוריה'] == 'העברת כספים' for i in (4, 5, 8))
    assert 6 not in ledger
    assert ledger[7]['קטגוריה'] == 'הוצאות שוטפות'
    assert ledger[1].get('_locked') is False


def test_refresh_does_not_treat_user_notes_as_bank_memos_or_undo_manual_selection():
    rows = [transfer(11, הערות='מתנה'), transfer(12, _bank_memo='ארוחה במסעדה')]
    keys = [txn_fingerprint(row['תאריך'], row['סכום'], row['תיאור']) for row in rows]
    _, ledger = load_snapshot(
        rows,
        transaction_notes=[{'txn_key': keys[0], 'note': 'מתנה'}],
        transaction_overrides=[{'txn_key': keys[1], 'category': 'קניות', 'subcategory': 'ריהוט'}],
    )
    assert ledger[11]['הערות'] == 'מתנה'
    assert ledger[11]['קטגוריה'] == 'העברת כספים'
    assert ledger[12]['קטגוריה'] == 'קניות'
    assert ledger[12]['קטגוריה_משנה'] == 'ריהוט'
    assert ledger[12]['_locked'] is True
