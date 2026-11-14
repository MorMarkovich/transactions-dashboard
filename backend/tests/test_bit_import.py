import json

from fastapi.testclient import TestClient

from app.api import routes
from app.core import security
from app.main import app

client = TestClient(app)


def ledger_row(id_, day, amount, desc='העברה בביט', owner='משותף'):
    return {'id': id_, 'תאריך': f'2026-10-{day:02d}', 'סכום': amount,
            'תיאור': desc, 'קטגוריה': 'העברת כספים', '_owner': owner}


def restore(rows, **extra):
    resp = client.post('/api/restore-session', json={'transactions': rows, **extra})
    assert resp.status_code == 200, resp.text
    return resp.json()['session_id']


def upload(session, records, *, owner='', selected=None, encoding='utf-8-sig'):
    raw = ('תאריך הפעולה;סכום;סיבת ההעברה;סוג הפעולה;סטטוס הפעולה\n' + records).encode(encoding)
    data = {'owner': owner}
    if selected is not None:
        data['selected'] = json.dumps(selected)
    return client.post('/api/transactions/bit-import', params={'sessionId': session},
                       files={'file': ('bit.csv', raw, 'text/csv')}, data=data)


def test_bit_preview_matches_one_to_one_and_saves_by_fingerprint(monkeypatch):
    rows = [ledger_row(17, 7, -123.45), ledger_row(25, 12, -90), ledger_row(34, 12, 123.45),
            ledger_row(41, 7, -123.45, 'בדיקה', owner='אישי')]
    sid = restore(rows)
    records = ('06/10/2026;123.45;מתנה ליום הולדת;שליחה;בוצעה\n'
               '12/10/2026;90;תודה רבה;שליחה;בוצעה\n'
               '12/10/2026;123.45;החזר עבור ארוחה במסעדה;קבלת כסף;בוצעה\n')
    assert upload(sid, records).status_code == 400
    response = upload(sid, records, owner='משותף', encoding='utf-16')
    assert response.status_code == 200, response.text
    preview = response.json()
    assert preview['counts'] == {'total': 3, 'unknown_reason': 2}
    item, = preview['proposals']
    assert item['transaction_id'] == 17
    assert item['category'] == 'אירועים ומתנות'
    assert item['transaction_date'] == '2026-10-07'

    stored = []
    def save(items):
        stored.extend({'txn_key': row['txn_key'], 'category': row['category'], 'subcategory': row['subcategory']}
                      for row in items)
        return {row['txn_key'] for row in items}
    monkeypatch.setattr(routes, 'save_new_bit_overrides', save)
    assert upload(sid, records, owner='משותף', selected=[item['txn_key']]).json() == {'updated': 1, 'skipped': 0}
    assert upload(sid, records, owner='משותף', selected=[item['txn_key']]).status_code == 409
    restored = restore(rows, transaction_overrides=stored)
    result = client.get('/api/transactions', params={'sessionId': restored}).json()
    assert result['total'] == len(rows)
    match = next(row for row in result['transactions'] if row['id'] == 17)
    assert match['קטגוריה'] == 'אירועים ומתנות'
    assert match['_locked'] is True


def test_bit_preview_rejects_ambiguity_including_rows_with_no_reason():
    sid = restore([ledger_row(1, 8, -90), ledger_row(2, 10, -100), ledger_row(3, 11, -100)])
    response = upload(sid,
        '08/10/2026;90;מתנה;שליחה;בוצעה\n'
        '08/10/2026;90;;שליחה;בוצעה\n'
        '10/10/2026;100;מתנה;שליחה;בוצעה\n'
        '08/10/2026;90;מתנה;שליחה;בוטל\n')
    assert response.status_code == 200, response.text
    assert response.json() == {'proposals': [], 'counts': {'total': 4, 'ambiguous': 3, 'not_completed': 1}}


def test_bit_preview_cannot_access_another_users_session(monkeypatch):
    sid = restore([ledger_row(17, 7, -123.45)])

    async def authenticate(_):
        return 'another-user'

    monkeypatch.setattr(security, '_authenticate', authenticate)
    assert upload(sid, '07/10/2026;123.45;מתנה;שליחה;בוצעה\n').status_code == 404



def test_clear_reason_can_classify_incoming_and_ignores_generic_description():
    sid = restore([ledger_row(1, 8, 60), ledger_row(2, 8, -60)])
    raw = ('תאריך,סכום,תיאור,סיבת ההעברה,כיוון,סטטוס\n'
           '08/10/2026,60,שכר דירה,מתנה לחג,קבלת כסף,בוצעה\n').encode('utf-8-sig')
    response = client.post('/api/transactions/bit-import', params={'sessionId': sid},
                           files={'file': ('bit.csv', raw, 'text/csv')})
    assert response.status_code == 200, response.text
    proposal, = response.json()['proposals']
    assert proposal['transaction_id'] == 1
    assert proposal['category'] == 'אירועים ומתנות'
