# Verify — run the dashboard end-to-end in a sandbox

How to launch the full app (FastAPI backend + Vite frontend) with synthetic
data and a fabricated login, so frontend/backend changes can be observed in a
real browser. No bank credentials or Supabase account needed.

## Backend (pandas 2.x — the sandbox's pandas 3 breaks FastAPI's JSON encoder)

```bash
python3 -m venv /tmp/venv
/tmp/venv/bin/pip install -q "pandas<3" -r backend/requirements.txt
cd backend && /tmp/venv/bin/python -m uvicorn app.main:app --port 8000 &
```

## Seed a session (no auth required — sessions are in-memory)

POST synthetic Hebrew transactions to `/api/restore-session`:
rows need `id`, `תאריך` (ISO date), `תיאור`, `סכום` (negative = expense),
optional `קטגוריה`, `תאריך_חיוב`, `_owner` (מור/שלי/משותף). Spread rows over
several months to light up the monthly views. The response returns
`session_id` — every page takes it as `?session_id=...`.

## Frontend

```bash
cd frontend && npm ci
VITE_API_URL=http://localhost:8000 \
VITE_SUPABASE_URL=https://example.supabase.co \
VITE_SUPABASE_ANON_KEY=dummy-anon-key \
npx vite --port 5173 --strictPort   # run in background
```

There is no committed `.env` — the dummy Supabase values are required or
`createClient` throws at boot.

## Bypass the auth guard (Playwright)

Supabase-js trusts the session stored in localStorage. Before page load, set
key `sb-example-auth-token` ("example" = host part of VITE_SUPABASE_URL) to a
JSON session: `{access_token: <any 3-part JWT-shaped string>, token_type:
"bearer", expires_at: <far future epoch>, expires_in, refresh_token, user:
{id, email, role: "authenticated", user_metadata, app_metadata, created_at}}`.
Supabase network calls fail silently (they're `.catch`-guarded); backend data
flows normally. Chromium lives at `/opt/pw-browsers/chromium`
(use `executablePath`, don't `playwright install`).

## Gotchas

- Start background servers with the harness's run-in-background mode; a `&`
  inside a one-shot shell command dies with the shell.
- RTL check for Recharts: collect x-axis `svg text` matching `\d{2}/\d{4}`
  and sort by `getBoundingClientRect().x` — months must run newest→oldest
  left→right (i.e. chronological right→left).
- `npm run lint` has ~38 pre-existing problems on main; compare counts, don't
  expect zero.
