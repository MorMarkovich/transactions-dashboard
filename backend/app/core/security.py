"""Authentication, authorization, and lightweight abuse protection.

Supabase remains the source of identity. API callers send their Supabase access
token as a Bearer token; this module validates it against Supabase Auth and
caches only a hash of the token for a short period. Backend dataframe sessions
are then bound to that authenticated user.
"""
from __future__ import annotations

from collections import defaultdict, deque
from contextvars import ContextVar
import hashlib
import json
import os
import time
from typing import AsyncIterator

import httpx
from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer


_bearer = HTTPBearer(auto_error=False)
_current_user: ContextVar[str] = ContextVar("current_user", default="")

_token_cache: dict[str, tuple[str, float]] = {}
_session_owners: dict[str, tuple[str, float]] = {}
_rate_events: dict[tuple[str, str], deque[float]] = defaultdict(deque)
_active_ai_users: set[str] = set()

AUTH_DISABLED = os.environ.get("AUTH_DISABLED", "").lower() in {"1", "true", "yes"}
if AUTH_DISABLED and os.environ.get("RENDER", "").lower() == "true":
    raise RuntimeError("AUTH_DISABLED must never be enabled on Render")
SUPABASE_URL = (os.environ.get("SUPABASE_URL") or os.environ.get("VITE_SUPABASE_URL") or "").rstrip("/")
SUPABASE_ANON_KEY = os.environ.get("SUPABASE_ANON_KEY") or os.environ.get("VITE_SUPABASE_ANON_KEY") or ""
SESSION_TTL_SECONDS = max(300, int(os.environ.get("SESSION_TTL_SECONDS", "21600")))


def current_user_id() -> str:
    """Return the authenticated user for the current request/context."""
    user_id = _current_user.get()
    if not user_id:
        # Direct unit tests call route handlers without running dependencies.
        # Production HTTP requests always pass through authorize_api_request.
        return "test-user" if AUTH_DISABLED or "PYTEST_CURRENT_TEST" in os.environ else ""
    return user_id


def bind_session(session_id: str, user_id: str | None = None) -> None:
    owner = user_id or current_user_id()
    if not owner:
        raise RuntimeError("Cannot create an API session without an authenticated user")
    _session_owners[session_id] = (owner, time.monotonic() + SESSION_TTL_SECONDS)


def unbind_session(session_id: str) -> None:
    _session_owners.pop(session_id, None)


def session_owner(session_id: str) -> str | None:
    record = _session_owners.get(session_id)
    if not record:
        return None
    owner, expires_at = record
    if expires_at <= time.monotonic():
        _session_owners.pop(session_id, None)
        return None
    return owner


def _rate_limit(user_id: str, bucket: str, limit: int, window_seconds: int) -> None:
    now = time.monotonic()
    events = _rate_events[(user_id, bucket)]
    cutoff = now - window_seconds
    while events and events[0] < cutoff:
        events.popleft()
    if len(events) >= limit:
        retry_after = max(1, int(window_seconds - (now - events[0])))
        raise HTTPException(
            status_code=429,
            detail="Too many requests. Please try again later.",
            headers={"Retry-After": str(retry_after)},
        )
    events.append(now)


async def _authenticate(credentials: HTTPAuthorizationCredentials | None) -> str:
    if AUTH_DISABLED:
        return "test-user"
    if not credentials or credentials.scheme.lower() != "bearer" or not credentials.credentials:
        raise HTTPException(status_code=401, detail="Authentication required")
    if not SUPABASE_URL or not SUPABASE_ANON_KEY:
        raise HTTPException(status_code=503, detail="Authentication service is not configured")

    token = credentials.credentials
    token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
    cached = _token_cache.get(token_hash)
    now = time.monotonic()
    if cached and cached[1] > now:
        return cached[0]

    try:
        async with httpx.AsyncClient(timeout=7.0) as client:
            response = await client.get(
                f"{SUPABASE_URL}/auth/v1/user",
                headers={
                    "apikey": SUPABASE_ANON_KEY,
                    "Authorization": f"Bearer {token}",
                },
            )
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=503, detail="Authentication service unavailable") from exc

    if response.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid or expired access token")
    try:
        user_id = str(response.json()["id"])
    except (KeyError, TypeError, ValueError) as exc:
        raise HTTPException(status_code=503, detail="Invalid authentication response") from exc
    _token_cache[token_hash] = (user_id, now + 60)
    return user_id


async def authorize_api_request(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> AsyncIterator[str]:
    """Authenticate an API request and enforce ownership/rate limits."""
    user_id = await _authenticate(credentials)
    context_token = _current_user.set(user_id)
    path = request.url.path
    # Progress polling is read-only and intentionally runs while an AI job is
    # active. Only the expensive mutation endpoints take the per-user AI lock.
    is_ai = path in {
        "/api/ai-categorize",
        "/api/ai-audit",
        "/api/ai-subcategorize",
        "/api/ai-subcategorize-all",
    }

    if not AUTH_DISABLED:
        _rate_limit(user_id, "general", 240, 60)
    if not AUTH_DISABLED and path in {"/api/upload", "/api/restore-session"}:
        _rate_limit(user_id, "ingest", 30, 600)
    if not AUTH_DISABLED and is_ai:
        _rate_limit(user_id, "ai", 60, 3600)
        if user_id in _active_ai_users:
            _current_user.reset(context_token)
            raise HTTPException(status_code=429, detail="An AI operation is already running")
        _active_ai_users.add(user_id)

    try:
        session_id = request.query_params.get("sessionId") or request.query_params.get("session_id")
        content_type = request.headers.get("content-type", "")
        if not session_id and request.method in {"POST", "PUT", "PATCH", "DELETE"} and "application/json" in content_type:
            try:
                payload = json.loads((await request.body()) or b"{}")
                if isinstance(payload, dict):
                    session_id = payload.get("session_id") or payload.get("sessionId")
            except (json.JSONDecodeError, UnicodeDecodeError):
                pass

        if session_id:
            owner = session_owner(str(session_id))
            if not AUTH_DISABLED and owner is None:
                raise HTTPException(status_code=404, detail="Session not found")
            if owner is not None and owner != user_id:
                # Do not reveal that another user's session exists.
                raise HTTPException(status_code=404, detail="Session not found")

        yield user_id
    finally:
        if not AUTH_DISABLED and is_ai:
            _active_ai_users.discard(user_id)
        _current_user.reset(context_token)
