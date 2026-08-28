"""Regression tests for the HTTP authentication and ownership boundary."""
from fastapi.testclient import TestClient

from app.core import security
from app.main import app


client = TestClient(app)


def test_api_rejects_anonymous_requests_when_auth_is_enabled(monkeypatch):
    monkeypatch.setattr(security, "AUTH_DISABLED", False)
    response = client.get("/api/test")
    assert response.status_code == 401
    assert response.json() == {"detail": "Authentication required"}
    assert response.headers["cache-control"] == "no-store"
    assert response.headers["x-content-type-options"] == "nosniff"
    assert "default-src 'self'" in response.headers["content-security-policy"]
    assert "http://127.0.0.1:4000" in response.headers["content-security-policy"]


def test_session_ids_cannot_cross_user_boundaries(monkeypatch):
    monkeypatch.setattr(security, "AUTH_DISABLED", False)

    async def fake_authenticate(credentials):
        return credentials.credentials

    monkeypatch.setattr(security, "_authenticate", fake_authenticate)
    security.bind_session("alice-session", "alice")
    try:
        response = client.get(
            "/api/transactions",
            params={"sessionId": "alice-session"},
            headers={"Authorization": "Bearer bob"},
        )
        assert response.status_code == 404
        assert response.json() == {"detail": "Session not found"}
    finally:
        security.unbind_session("alice-session")


def test_expired_session_is_rejected(monkeypatch):
    monkeypatch.setattr(security, "AUTH_DISABLED", False)

    async def fake_authenticate(_credentials):
        return "alice"

    monkeypatch.setattr(security, "_authenticate", fake_authenticate)
    security._session_owners["expired-session"] = ("alice", 0)
    response = client.get(
        "/api/transactions",
        params={"sessionId": "expired-session"},
        headers={"Authorization": "Bearer token"},
    )
    assert response.status_code == 404
