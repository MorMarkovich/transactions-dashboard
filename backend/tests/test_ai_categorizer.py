"""The two-phase AI categorizer: known merchants classified directly, unknown
merchants MUST be verified via web search before getting a category.

The Anthropic client is faked — these tests pin the orchestration contract:
  - phase 1 may only classify merchants it recognizes; unknowns go to phase 2
  - phase 2 answers are discarded when the model didn't actually search
  - installment suffixes are stripped so all installments resolve together
  - resolutions are cached per base merchant
"""
import json

import pytest

from app.services import ai_categorizer
from app.services.ai_categorizer import categorize_transactions, _base_desc


class _Block:
    def __init__(self, type_, text=""):
        self.type = type_
        self.text = text


class _Response:
    def __init__(self, blocks):
        self.content = blocks


def _text_response(payload, searched=False):
    blocks = []
    if searched:
        blocks.append(_Block("server_tool_use"))
        blocks.append(_Block("web_search_tool_result"))
    blocks.append(_Block("text", json.dumps(payload, ensure_ascii=False)))
    return _Response(blocks)


class _FakeMessages:
    def __init__(self, handler):
        self._handler = handler
        self.calls = []

    def create(self, **kwargs):
        self.calls.append(kwargs)
        return self._handler(kwargs)


class _FakeClient:
    def __init__(self, handler):
        self.messages = _FakeMessages(handler)


@pytest.fixture(autouse=True)
def _fresh_state(monkeypatch):
    monkeypatch.setattr(ai_categorizer, "_CACHE", {})
    monkeypatch.setattr(ai_categorizer, "_SUBCAT_CACHE", {})
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")


def _install(monkeypatch, handler):
    client = _FakeClient(handler)
    monkeypatch.setattr(ai_categorizer, "_get_client", lambda: client)
    return client


def test_installment_suffix_stripped():
    assert _base_desc("איקאה (תשלום 3/12)") == "איקאה"
    assert _base_desc("  שופרסל דיל  ") == "שופרסל דיל"
    assert _base_desc("מסעדה (לא תשלום)") == "מסעדה (לא תשלום)"


def test_known_merchant_classified_without_search(monkeypatch):
    def handler(kwargs):
        assert "tools" not in kwargs  # phase 1 must not search
        return _text_response([{"index": 0, "category": "מזון וצריכה"}])

    client = _install(monkeypatch, handler)
    result = categorize_transactions(["שופרסל אקספרס"])
    assert result == {0: "מזון וצריכה"}
    assert len(client.messages.calls) == 1


def test_unknown_merchant_goes_to_web_search(monkeypatch):
    def handler(kwargs):
        if "tools" not in kwargs:  # phase 1: doesn't recognize it
            return _text_response([{"index": 0, "unknown": True}])
        # phase 2: must carry the web search tool, and searches
        assert kwargs["tools"][0]["type"] == "web_search_20250305"
        return _text_response([{"index": 0, "category": "חיות מחמד"}], searched=True)

    client = _install(monkeypatch, handler)
    result = categorize_transactions(["פטשופ הכפר"])
    assert result == {0: "חיות מחמד"}
    assert len(client.messages.calls) == 2


def test_search_phase_answer_without_searching_is_discarded(monkeypatch):
    def handler(kwargs):
        if "tools" not in kwargs:
            return _text_response([{"index": 0, "unknown": True}])
        # phase 2 answers WITHOUT any search blocks → must be thrown away
        return _text_response([{"index": 0, "category": "אופנה"}], searched=False)

    _install(monkeypatch, handler)
    result = categorize_transactions(["בוטיק עלום"])
    assert result == {}
    assert ai_categorizer._CACHE["בוטיק עלום"] == "שונות"


def test_search_disabled_leaves_unknowns_uncategorized(monkeypatch):
    monkeypatch.setenv("AI_WEB_SEARCH", "0")

    def handler(kwargs):
        assert "tools" not in kwargs
        return _text_response([{"index": 0, "unknown": True}])

    client = _install(monkeypatch, handler)
    result = categorize_transactions(["עסק מסתורי"])
    assert result == {}
    assert len(client.messages.calls) == 1  # no phase-2 call at all


def test_installments_resolve_together_and_cache(monkeypatch):
    def handler(kwargs):
        return _text_response([{"index": 0, "category": "עיצוב הבית"}])

    client = _install(monkeypatch, handler)
    result = categorize_transactions([
        "איקאה (תשלום 1/3)", "איקאה (תשלום 2/3)", "איקאה (תשלום 3/3)",
    ])
    # one API call for one unique base merchant, all three rows categorized
    assert result == {0: "עיצוב הבית", 1: "עיצוב הבית", 2: "עיצוב הבית"}
    assert len(client.messages.calls) == 1

    # second run: served entirely from cache
    result2 = categorize_transactions(["איקאה (תשלום 3/3)"])
    assert result2 == {0: "עיצוב הבית"}
    assert len(client.messages.calls) == 1


def test_invalid_category_rejected(monkeypatch):
    def handler(kwargs):
        return _text_response([{"index": 0, "category": "אחר"}])

    _install(monkeypatch, handler)
    assert categorize_transactions(["עסק כלשהו"]) == {}


def test_audit_merchants_runs_end_to_end(monkeypatch):
    # Executes the real audit_merchants (not mocked at the route level like
    # test_ai_audit.py) so a broken prompt constant or parse path fails here.
    def handler(kwargs):
        assert kwargs["system"]  # audit must carry its own system prompt
        return _text_response([
            {"index": 0, "category": "מזון וצריכה", "confidence": 0.9, "reason": "רשת סופרמרקטים"},
        ])

    _install(monkeypatch, handler)
    out = ai_categorizer.audit_merchants([
        {"merchant": "שופרסל דיל", "current": "אופנה", "issuer": "מזון", "count": 4, "total": 512.0},
    ])
    assert out == [
        {"index": 0, "category": "מזון וצריכה", "confidence": 0.9, "reason": "רשת סופרמרקטים"},
    ]


def test_suggest_subcategories_two_phase_validates_and_searches(monkeypatch):
    def handler(kwargs):
        assert "סופרים" in kwargs["messages"][0]["content"]  # existing names offered
        if "tools" not in kwargs:
            # phase 1: certain merchants only; junk names must be rejected
            return _text_response([
                {"index": 0, "subcategory": "מעדניות"},
                {"index": 1, "subcategory": "אחר"},              # legend bucket → rejected → phase 2
                {"index": 2, "subcategory": "מזון וצריכה"},      # parent name → rejected → phase 2
                {"index": 3, "unknown": True},
            ])
        # phase 2: mandatory search over the unresolved merchants
        assert kwargs["tools"][0]["type"] == "web_search_20250305"
        return _text_response([
            {"index": 0, "subcategory": ""},
            {"index": 1, "subcategory": ""},
            {"index": 2, "subcategory": "שוקי אוכל"},
        ], searched=True)

    _install(monkeypatch, handler)
    out = ai_categorizer.suggest_subcategories(
        "מזון וצריכה",
        [
            {"merchant": "מעדניית הגליל", "count": 2, "total": 400.0},
            {"merchant": "עסק א", "count": 1, "total": 50.0},
            {"merchant": "עסק ב", "count": 1, "total": 60.0},
            {"merchant": "עסק ג", "count": 1, "total": 70.0},
        ],
        ["סופרים", "מאפיות"],
    )
    assert out == [
        {"index": 0, "subcategory": "מעדניות"},
        {"index": 1, "subcategory": ""},
        {"index": 2, "subcategory": ""},
        {"index": 3, "subcategory": "שוקי אוכל"},
    ]


def test_suggest_subcategories_unsearched_answers_discarded_and_cached(monkeypatch):
    def handler(kwargs):
        if "tools" not in kwargs:
            return _text_response([{"index": 0, "unknown": True}])
        # phase 2 answers WITHOUT searching → must be thrown away
        return _text_response([{"index": 0, "subcategory": "בוטיקים"}], searched=False)

    client = _install(monkeypatch, handler)
    items = [{"merchant": "בוטיק עלום", "count": 1, "total": 100.0}]
    out = ai_categorizer.suggest_subcategories("אופנה", items, [])
    assert out == [{"index": 0, "subcategory": ""}]
    # The miss is cached: a second run makes NO further API calls.
    calls_before = len(client.messages.calls)
    out2 = ai_categorizer.suggest_subcategories("אופנה", items, [])
    assert out2 == [{"index": 0, "subcategory": ""}]
    assert len(client.messages.calls) == calls_before


def test_categorize_passes_issuer_hint(monkeypatch):
    def handler(kwargs):
        assert "ענף לפי חברת האשראי: מזון" in kwargs["messages"][0]["content"]
        return _text_response([{"index": 0, "category": "מזון וצריכה"}])

    _install(monkeypatch, handler)
    result = categorize_transactions(["מכולת השכונה"], ["מזון"])
    assert result == {0: "מזון וצריכה"}


def test_phase2_api_error_keeps_merchant_uncategorized(monkeypatch):
    def handler(kwargs):
        if "tools" not in kwargs:
            return _text_response([{"index": 0, "unknown": True}])
        raise RuntimeError("web search not available on this account")

    _install(monkeypatch, handler)
    # No searchless-guess fallback: the merchant stays שונות
    assert categorize_transactions(["עסק לא ידוע"]) == {}
    assert ai_categorizer._CACHE["עסק לא ידוע"] == "שונות"
