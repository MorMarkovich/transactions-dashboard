# 💳 מנתח עסקאות כרטיס אשראי

דאשבורד מקצועי לניתוח עסקאות כרטיס אשראי עם תמיכה מלאה בעברית ו-RTL.

## 🛠️ Stack

- **Frontend:** React 19 + TypeScript + Vite + Tailwind, Recharts, Framer Motion
- **Backend:** FastAPI (Python 3.11), Pandas, Supabase, Anthropic AI categorization
- **Auth & storage:** Supabase
- **Deployment:** Render (single Docker service — backend serves the built SPA at `/` and the API at `/api/*`)

## 🚀 Production deployment (Render)

Deployment is fully described by `render.yaml` + the root `Dockerfile`.

1. Push to `main` — Render reads `render.yaml` from the default branch.
2. In the Render dashboard: **New + → Blueprint** → connect this repo.
3. When prompted, supply the three secrets:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `ANTHROPIC_API_KEY`
4. Apply. First build is ~5–8 min (npm ci + vite build + python deps).

Health check: `GET /health` → `{"status":"healthy"}`.

The Blueprint uses Render's Starter plan so the dashboard remains available
without free-tier spin-downs.

## 💻 Local development

Two processes — backend on `:8000`, frontend dev server on `:5173` proxies `/api` to the backend.

```bash
# Backend
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Frontend (in a separate terminal)
cd frontend
npm install
npm run dev  # http://localhost:5173
```

Frontend environment variables (create `frontend/.env.local`):

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

Backend environment variables:

```
ANTHROPIC_API_KEY=...  # required for AI categorization
SUPABASE_URL=...       # may use the same value as VITE_SUPABASE_URL
SUPABASE_ANON_KEY=...  # may use the same value as VITE_SUPABASE_ANON_KEY
ALLOWED_ORIGINS=http://localhost:5173
```

The browser automatically attaches the signed-in user's Supabase access token
to every API request. Never enable `AUTH_DISABLED` in a deployed environment;
it exists only for isolated automated tests. To avoid sending merchant names to
the optional AI categorizer, set `VITE_AUTO_AI=false` before building the
frontend.

## 🗄️ Supabase setup

Run `supabase_setup.sql` in the Supabase SQL editor to create or update the
required tables, indexes, and RLS policies. The script is idempotent and safe to
re-run after deployment updates.

## 📁 Supported file formats

- **MAX** — Excel from MAX credit cards
- **Leumi** — CSV from Bank Leumi
- **Discount** — Excel from Bank Discount
- **Isracard** — PDF statement
- **Generic** — any file with date / description / amount columns

## 🔒 Security and privacy

- `/api/*` requires a valid Supabase access token; dataframe sessions are
  temporary, user-bound, rate-limited, and expire automatically.
- Uploaded files are size/type checked, processed in temporary storage, and
  deleted after processing. Do not commit real financial exports to Git.
- Supabase Row Level Security remains the durable-data authorization boundary.
- Merchant names may be sent to Anthropic when automatic AI categorization is
  enabled. Set `VITE_AUTO_AI=false` before building to keep that feature off.
- Keep `ANTHROPIC_API_KEY` in Render/Supabase secret settings, never in source
  control. The Supabase anon key is public by design; RLS must remain enabled.

## 📄 License

MIT
