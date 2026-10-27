from types import SimpleNamespace as NS
import pytest
from app.services.ai_categorizer import _response_searched, _verified_results, _indexed_results, _classify_via_search

URL = 'https://merchant.example/about'
def response(content):
    return NS(content=[NS(type='server_tool_use'), NS(type='web_search_tool_result', content=content)])

def valid():
    return response([{'type': 'web_search_result', 'url': URL}])

@pytest.mark.parametrize('content', [None, [], {'type': 'web_search_tool_result_error', 'error_code': 'max_uses_exceeded'}])
def test_failed_or_empty_search_is_not_evidence(content):
    assert not _response_searched(response(content))

@pytest.mark.parametrize('changes', [{'source_url': 'https://invented.example'}, {'confidence': .6}, {'confidence': '0.99'}, {'confidence': True}, {'confidence': float('nan')}])
def test_fabricated_source_or_uncertain_answer_rejected(changes):
    item = {'index': 0, 'category': 'אוכל', 'source_url': URL, 'confidence': .95, **changes}
    assert _verified_results(valid(), [item], 1) == []

@pytest.mark.parametrize('items', [[None], {'index': 0}, [{'index': True}], [{'index': '0'}], [{'index': .1}], [{'index': 1}], [{'index': 0}, {'index': 0}]])
def test_invalid_indices_never_reassign_a_merchant(items):
    assert _indexed_results(items, 1) == []

def test_each_merchant_needs_its_own_search(monkeypatch):
    monkeypatch.setenv('AI_SEARCH_BATCH', '100')
    calls = []
    def create(**kwargs):
        calls.append(kwargs)
        return response([])
    client = NS(messages=NS(create=create))
    assert _classify_via_search(client, 'test', [{'base': 'One'}, {'base': 'Two'}]) == {}
    assert len(calls) == 2
    assert 'Two' not in calls[0]['messages'][0]['content']
