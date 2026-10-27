"""Cost/privacy boundaries and reuse across categorization, audit and subtypes."""
import hashlib
import json
import pytest
from fastapi import HTTPException
from app.services import free_merchant_agent as agent, ai_categorizer as legacy


@pytest.fixture
def setup(monkeypatch):
    monkeypatch.setenv('AI_PROVIDER', 'gemini-free')
    monkeypatch.setenv('GEMINI_API_KEY', 'synthetic-gemini')
    monkeypatch.setenv('GEMINI_FREE_KEY_SHA256', hashlib.sha256(b'synthetic-gemini').hexdigest())
    monkeypatch.setenv('TAVILY_API_KEY', 'synthetic-search')
    saved = {}
    monkeypatch.setattr(agent.store, 'read_resolved', lambda m: saved.get(m))
    monkeypatch.setattr(agent.store, 'claim', lambda m: {'status': 'claimed', 'lease_token': 'lease'})
    monkeypatch.setattr(agent.store, 'finish', lambda m, lease, result, state: saved.update({m: result}) if state == 'resolved' else None)
    return saved


VERDICT = {'category': 'אוכל', 'subcategory': 'קניות גדולות', 'confidence': .95,
           'source_url': 'https://example.org/merchant', 'reason': 'source'}


def test_resolved_business_is_not_queried_again_across_phases(setup, monkeypatch):
    calls = []
    monkeypatch.setattr(agent, '_identify', lambda m: calls.append(m) or dict(VERDICT))
    assert legacy.categorize_transactions(['PAYPAL *Synthetic Store (תשלום 1/3)']) == {0: 'אוכל'}
    assert legacy.audit_merchants([{'merchant': 'SYNTHETIC STORE', 'current': 'קניות'}])[0]['category'] == 'אוכל'
    assert legacy.suggest_subcategories('אוכל', [{'merchant': 'Synthetic Store'}], [])[0]['subcategory'] == 'קניות גדולות'
    assert calls == ['synthetic store']


def test_cache_still_works_without_provider_keys(setup, monkeypatch):
    setup['synthetic store'] = dict(VERDICT)
    monkeypatch.delenv('GEMINI_API_KEY')
    monkeypatch.setattr(agent, '_request', lambda *a, **k: pytest.fail('network'))
    assert agent.identify('Synthetic Store')['category'] == 'אוכל'


@pytest.mark.parametrize('descriptor', ['העברה לחשבון 123456', 'person@example.org', 'משכורת', 'עסק 123456789'])
def test_financial_identifiers_are_not_sent(setup, monkeypatch, descriptor):
    monkeypatch.setattr(agent.store, 'read_resolved', lambda m: pytest.fail('lookup'))
    assert agent.identify(descriptor) is None


def test_free_mode_cannot_create_anthropic_client(setup, monkeypatch):
    monkeypatch.setenv('ANTHROPIC_API_KEY', 'synthetic-paid-key')
    assert legacy._get_client() is None


def test_rotated_unverified_gemini_key_stops_before_search(setup, monkeypatch):
    monkeypatch.setenv('GEMINI_API_KEY', 'different-key')
    monkeypatch.setattr(agent.store, 'claim', lambda m: pytest.fail('claim'))
    with pytest.raises(HTTPException, match='503'):
        agent.identify('Synthetic Store')


@pytest.mark.parametrize('status', ['deferred', 'quota'])
def test_duplicate_inflight_and_quota_do_not_search(setup, monkeypatch, status):
    monkeypatch.setattr(agent.store, 'claim', lambda m: {'status': status})
    monkeypatch.setattr(agent, '_identify', lambda m: pytest.fail('search'))
    if status == 'quota':
        with pytest.raises(HTTPException): agent.identify('Synthetic Store')
    else:
        assert agent.identify('Synthetic Store') is None


def test_provider_failure_is_persisted_and_not_guessed(setup, monkeypatch):
    records = []
    def fail(_): raise HTTPException(429, 'quota')
    monkeypatch.setattr(agent, '_identify', fail)
    monkeypatch.setattr(agent.store, 'finish', lambda *a: records.append(a))
    with pytest.raises(HTTPException): agent.identify('Synthetic Store')
    assert records[0][-1] == 'error'


def test_subcategory_does_not_cross_parent_category(setup):
    setup['synthetic store'] = dict(VERDICT)
    assert agent.subcategorize('קניות', [{'merchant': 'Synthetic Store'}]) == []
