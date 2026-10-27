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
    monkeypatch.setenv('TAVILY_FREE_KEY_SHA256', hashlib.sha256(b'synthetic-search').hexdigest())
    agent._search_checks.clear()
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


@pytest.mark.parametrize('descriptor', ['העברה לחשבון 123456', 'person@example.org', 'משכורת', 'עסק 123456789', 'העברות לקרדיט', 'ישראכרט גביה'])
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


@pytest.mark.parametrize('paygo_limit', [None, 0])
def test_verified_free_account_accepts_explicit_null_or_zero_limit(setup, monkeypatch, paygo_limit):
    calls = []
    def request(method, url, **kwargs):
        calls.append(url.rsplit('/', 1)[-1])
        if url.endswith('/usage'):
            return {'account': {'current_plan': 'Researcher', 'plan_limit': 1000,
                    'plan_usage': 0, 'paygo_limit': paygo_limit, 'paygo_usage': 0}}
        assert url.endswith('/search')
        return {'results': []}
    monkeypatch.setattr(agent, '_request', request)
    assert agent.identify('Synthetic Store') is None
    assert calls == ['usage', 'search']


@pytest.mark.parametrize('change', [
    {'current_plan': 'Bootstrap'}, {'paygo_limit': 100}, {'paygo_usage': 1},
    {'paygo_limit': '0'}, {'paygo_limit': False}, {'paygo_usage': False},
    {'plan_limit': 1001}, {'plan_limit': 0}, {'plan_usage': -1},
    {'plan_usage': None}, {'plan_usage': 1000}, {'missing_paygo_limit': True},
])
def test_paid_unknown_or_exhausted_account_stops_before_search(setup, monkeypatch, change):
    account = {'current_plan': 'Researcher', 'plan_limit': 1000,
               'plan_usage': 0, 'paygo_limit': None, 'paygo_usage': 0}
    if 'missing_paygo_limit' in change:
        account.pop('paygo_limit')
    else:
        account.update(change)
    calls = []
    def request(method, url, **kwargs):
        calls.append(url)
        assert url.endswith('/usage'), 'Search must not run'
        return {'account': account}
    monkeypatch.setattr(agent, '_request', request)
    with pytest.raises(HTTPException):
        agent.identify('Synthetic Store')
    assert len(calls) == 1


def test_unverified_search_key_stops_before_reservation(setup, monkeypatch):
    monkeypatch.delenv('TAVILY_FREE_KEY_SHA256')
    monkeypatch.setattr(agent.store, 'claim', lambda m: pytest.fail('claim'))
    monkeypatch.setattr(agent, '_request', lambda *a, **kw: pytest.fail('provider call'))
    with pytest.raises(HTTPException):
        agent.identify('Synthetic Store')


@pytest.mark.parametrize('finish_reason', ['STOP', 'MAX_TOKENS'])
def test_current_free_model_contract_and_complete_json_only(setup, monkeypatch, finish_reason):
    def request(method, url, **kwargs):
        if url.endswith('/usage'):
            return {'account': {'current_plan': 'Researcher', 'plan_limit': 1000,
                    'plan_usage': 0, 'paygo_limit': None, 'paygo_usage': 0}}
        if url.endswith('/search'):
            return {'results': [{'url': VERDICT['source_url'], 'content': 'A supermarket.'}]}
        assert url.endswith('/v1beta/models/gemini-3.5-flash-lite:generateContent')
        body = kwargs['json']
        assert 'tools' not in body
        assert body['generationConfig']['thinkingConfig'] == {'thinkingLevel': 'minimal'}
        assert body['generationConfig']['responseMimeType'] == 'application/json'
        return {'candidates': [{'finishReason': finish_reason, 'content': {'parts': [
            {'thought': True, 'text': 'Private model reasoning'},
            {'text': json.dumps(VERDICT)},
        ]}}]}
    monkeypatch.setattr(agent, '_request', request)
    result = agent.identify('Synthetic Store')
    assert bool(result) == (finish_reason == 'STOP')
    if result:
        assert result['category'] == VERDICT['category']


FREE_USAGE = {'account': {'current_plan': 'Researcher', 'plan_limit': 1000,
              'plan_usage': 0, 'paygo_limit': None, 'paygo_usage': 0}}


def test_many_concurrent_merchants_share_one_usage_check(setup, monkeypatch):
    from concurrent.futures import ThreadPoolExecutor
    calls = []
    monkeypatch.setattr(agent, '_request', lambda *a, **k: calls.append(a[1]) or FREE_USAGE)
    with ThreadPoolExecutor(max_workers=12) as pool:
        list(pool.map(lambda _: agent._reserve_search_credit('https://api.tavily.com', {}), range(30)))
    assert calls == ['https://api.tavily.com/usage']
    assert list(agent._search_checks.values())[0]['remaining'] == 970


def test_last_free_credit_is_reserved_only_once(setup, monkeypatch):
    calls = []
    usage = {'account': {**FREE_USAGE['account'], 'plan_usage': 999}}
    monkeypatch.setattr(agent, '_request', lambda *a, **k: calls.append(a[1]) or usage)
    agent._reserve_search_credit('https://api.tavily.com', {})
    with pytest.raises(HTTPException) as caught:
        agent._reserve_search_credit('https://api.tavily.com', {})
    assert caught.value.status_code == 429
    assert len(calls) == 1


def test_expired_approval_is_not_reused_after_failed_refresh(setup, monkeypatch):
    now = [0]
    monkeypatch.setattr(agent, 'monotonic', lambda: now[0])
    calls = []
    def usage(*args, **kwargs):
        calls.append(args[1])
        if len(calls) > 1:
            raise HTTPException(429, 'Temporary rate limit')
        return FREE_USAGE
    monkeypatch.setattr(agent, '_request', usage)
    agent._reserve_search_credit('https://api.tavily.com', {})
    now[0] = 599
    agent._reserve_search_credit('https://api.tavily.com', {})
    now[0] = 600
    for _ in range(3):
        with pytest.raises(HTTPException):
            agent._reserve_search_credit('https://api.tavily.com', {})
    assert len(calls) == 2


def test_verified_key_rotation_requires_new_usage_check(setup, monkeypatch):
    calls = []
    monkeypatch.setattr(agent, '_request', lambda *a, **k: calls.append(a[1]) or FREE_USAGE)
    agent._reserve_search_credit('https://api.tavily.com', {})
    monkeypatch.setenv('TAVILY_API_KEY', 'rotated-key')
    with pytest.raises(HTTPException):
        agent._reserve_search_credit('https://api.tavily.com', {})
    monkeypatch.setenv('TAVILY_FREE_KEY_SHA256', hashlib.sha256(b'rotated-key').hexdigest())
    agent._reserve_search_credit('https://api.tavily.com', {})
    assert len(calls) == 2


def test_foreign_trip_never_uses_business_cache_or_providers(setup, monkeypatch):
    monkeypatch.setattr(agent.store, 'read_resolved', lambda *a: pytest.fail('Trip cache override'))
    monkeypatch.setattr(agent, '_request', lambda *a, **k: pytest.fail('Trip lookup'))
    assert agent.identify('SHINSEGAE DEPARTMENT S SEOUL KR') is None
