"""User choices, dictionary collisions and in-flight automatic work."""
import pandas as pd
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.api import routes
from app.services.data_processor import normalize_merchant

client = TestClient(app)

def restore(desc, rules=(), category='שונות', subcategory=''):
    response = client.post('/api/restore-session', json={'transactions': [
        {'id': 1, 'תאריך': '2026-10-01', 'תיאור': desc, 'סכום': -12,
         'קטגוריה': category, 'קטגוריה_משנה': subcategory}], 'category_rules': list(rules)})
    assert response.status_code == 200, response.text
    sid = response.json()['session_id']
    return sid, routes.sessions[sid]

@pytest.mark.parametrize('desc,category,sub', [
    ('כיתן גנים פ"ת-גמא', 'קניות', 'דברים לבית'),
    ('מיקה מקס בני ברק', 'קניות', 'דברים לבית'),
    ('MERKAZA ירכא', 'אוכל', 'קניות גדולות'),
    ('MAXIMA LT X 777', 'טיסות ותיירות', ''),
    ('NEW YORKER LIETUVA 0', 'טיסות ותיירות', ''),
    ('MAYA MOBILE LTD', 'טיסות ותיירות', ''),
    ('KSP הלגונה', 'קניות', 'אלקטרוניקה'),
    ('PAYPAL *STEAM', 'טכנולוגיה', ''),
    ('PAYPAL *TEMU', 'קניות', 'קניות אונליין'),
    ('טרקלין חשמל', 'קניות', 'אלקטרוניקה'),
    ('מרפאת חיות', 'סושי', ''),
    ('EXAMPLE SINGAPORE', 'שונות', ''),
    ('חנות הירקון', 'שונות', ''),
    ('GAP SINGAPORE SG', 'טיסות ותיירות', ''),
])
def test_catalog_accuracy(desc, category, sub):
    _, df = restore(desc)
    assert df.iloc[0]['קטגוריה'] == category
    if sub:
        assert df.iloc[0]['קטגוריה_משנה'] == sub

@pytest.mark.parametrize('subcategory', ['קניות שבת', ''])
def test_manual_choice_survives_reload_catalog_and_subcategory_seeds(subcategory):
    rule = {'merchant': 'שופרסל דיל', 'category': 'קניות', 'subcategory': subcategory, 'source': 'manual'}
    _, df = restore('שופרסל דיל', [rule])
    assert df.iloc[0]['קטגוריה'] == 'קניות'
    assert df.iloc[0]['קטגוריה_משנה'] == subcategory
    assert bool(df.iloc[0]['_manual_rule'])

@pytest.mark.parametrize('desc,key', [('BOLT EUO2610011234', 'bolt euo')])
def test_user_confirmed_trip_rule(desc,key):
    _, df = restore(desc, [{'merchant': key, 'category': 'טיסות ותיירות', 'source': 'manual'}])
    assert df.iloc[0]['קטגוריה'] == 'טיסות ותיירות'
    assert normalize_merchant(desc) == key


def test_invalid_manual_rule_does_not_shadow_valid_choice():
    rules = [
        {'merchant': 'שופרסל דיל', 'category': 'קניות', 'source': 'manual', 'updated_at': '2026-10-01'},
        {'merchant': 'שופרסל דיל', 'category': 'invalid', 'source': 'manual', 'updated_at': '2026-10-02'},
    ]
    _, df = restore('שופרסל דיל', rules)
    assert df.iloc[0]['קטגוריה'] == 'קניות'


def test_manual_edit_during_ai_categorize_is_not_overwritten(monkeypatch):
    sid, df = restore('עסק ללא התאמה')
    def delayed(descriptions, *args, **kwargs):
        df.loc[:, 'קטגוריה'] = 'קניות'
        df.loc[:, '_manual_rule'] = True
        return {0: 'אוכל'}
    monkeypatch.setattr(routes, 'categorize_transactions', delayed)
    response = client.post('/api/ai-categorize', json={'session_id': sid})
    assert response.status_code == 200, response.text
    assert df.iloc[0]['קטגוריה'] == 'קניות'
    assert not response.json()['ai_categorized']


def test_automatic_merchant_edit_respects_manual_rule():
    sid, df = restore('עסק ללא התאמה', [{'merchant': 'עסק ללא התאמה', 'category': 'קניות', 'source': 'manual'}])
    response = client.post('/api/merchants/category', json={'session_id': sid, 'merchant': 'עסק ללא התאמה', 'category': 'אוכל', 'source': 'ai'})
    assert response.status_code == 200, response.text
    assert df.iloc[0]['קטגוריה'] == 'קניות'


def test_trip_confirmation_pins_the_levi_purchase_only():
    from app.services.data_processor import txn_fingerprint
    rows = [{'id': i, 'תאריך': f'2026-10-{i:02}', 'תיאור': 'LEVI S', 'סכום': -12, 'קטגוריה': 'שונות'} for i in (1, 2)]
    response = client.post('/api/restore-session', json={'transactions': rows,
        'transaction_overrides': [{'txn_key': txn_fingerprint('2026-10-01', -12, 'LEVI S'), 'category': 'טיסות ותיירות'}]})
    assert response.status_code == 200, response.text
    df = routes.sessions[response.json()['session_id']]
    assert df.iloc[0]['קטגוריה'] == 'טיסות ותיירות'
    assert df.iloc[1]['קטגוריה'] == 'קניות'
