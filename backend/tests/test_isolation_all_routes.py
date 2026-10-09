"""Tenant isolation across EVERY /api route.

1. Static guard: any parameter that carries a session id must use one of the two
   names the auth dependency inspects (query/JSON `sessionId` or `session_id`).
   A route that accepted the id via a path, form field or another name would
   bypass the ownership check.
2. Dynamic: user B presenting user A's real session id gets 404 on every route,
   for the query-string and JSON-body forms, and A's data never appears.
"""
import pytest
from fastapi.routing import APIRoute
from fastapi.testclient import TestClient

from app.core import security
from app.main import app  # noqa: F401
from app.api.routes import router

client = TestClient(app)
API_ROUTES = [r for r in router.routes if isinstance(r, APIRoute)]
PREFIX = "/api"
SESSION_NAMES = {"sessionId", "session_id"}


def _field_names(route):
    d = route.dependant
    names = {"path": [p.name for p in d.path_params], "query": [p.name for p in d.query_params],
             "header": [p.name for p in d.header_params], "cookie": [p.name for p in d.cookie_params]}
    body = []
    for f in d.body_params:
        model = getattr(f, "type_", None)
        fields = getattr(model, "model_fields", None)
        body.extend(list(fields) if fields else [f.name])
    names["body"] = body
    return names


def test_routes_were_discovered():
    assert len(API_ROUTES) >= 40


@pytest.mark.parametrize("route", API_ROUTES, ids=lambda r: f"{sorted(r.methods)[0]} {r.path}")
def test_session_id_only_travels_in_inspected_places(route):
    n = _field_names(route)
    for kind in ("path", "header", "cookie"):
        assert not [x for x in n[kind] if "session" in x.lower()], (route.path, kind, n[kind])
    for kind in ("query", "body"):
        bad = [x for x in n[kind] if "session" in x.lower() and x not in SESSION_NAMES]
        assert not bad, (route.path, kind, bad)


@pytest.fixture(scope="module")
def two_users():
    mp = pytest.MonkeyPatch()
    mp.setattr(security, "AUTH_DISABLED", False)

    async def fake_authenticate(credentials):
        if not credentials:
            raise security.HTTPException(status_code=401, detail="Authentication required")
        return credentials.credentials

    mp.setattr(security, "_authenticate", fake_authenticate)
    mp.setattr(security, "_rate_limit", lambda *a, **k: None)
    alice = {"Authorization": "Bearer alice"}
    rows = [{"id": 1, "תאריך": "2026-09-03", "סכום": -123.45, "תיאור": "SECRET-ALICE-MERCHANT", "קטגוריה": "אוכל"}]
    r = client.post("/api/restore-session", json={"transactions": rows}, headers=alice)
    assert r.status_code == 200, r.text
    sid = r.json()["session_id"]
    assert client.get("/api/transactions", params={"sessionId": sid}, headers=alice).status_code == 200
    yield sid
    security.unbind_session(sid)
    mp.undo()


@pytest.mark.parametrize("route", API_ROUTES, ids=lambda r: f"{sorted(r.methods)[0]} {r.path}")
def test_other_user_gets_404_on_every_route(route, two_users):
    sid = two_users
    bob = {"Authorization": "Bearer bob"}
    path = PREFIX + route.path
    for method in sorted(route.methods - {"HEAD", "OPTIONS"}):
        variants = [{"params": {"sessionId": sid}}, {"params": {"session_id": sid}}]
        if method in {"POST", "PUT", "PATCH", "DELETE"}:
            variants += [{"json": {"session_id": sid}}, {"json": {"sessionId": sid}}]
        for kwargs in variants:
            resp = client.request(method, path.replace("{", "x").replace("}", ""), headers=bob, **kwargs)
            assert resp.status_code == 404, (method, path, kwargs, resp.status_code, resp.text[:200])
            assert "SECRET-ALICE-MERCHANT" not in resp.text


def test_owner_still_reads_own_data_and_anonymous_is_rejected(two_users):
    sid = two_users
    own = client.get("/api/transactions", params={"sessionId": sid}, headers={"Authorization": "Bearer alice"})
    assert own.status_code == 200 and "SECRET-ALICE-MERCHANT" in own.text
    assert client.get("/api/transactions", params={"sessionId": sid}).status_code == 401
