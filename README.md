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

The free plan spins down after ~15 min idle (~30s cold start on first request).

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
```

## 🗄️ Supabase setup

Run `supabase_setup.sql` once in the Supabase SQL editor to create the required tables and RLS policies.

## 📁 Supported file formats

- **MAX** — Excel from MAX credit cards
- **Leumi** — CSV from Bank Leumi
- **Discount** — Excel from Bank Discount
- **Generic** — any file with date / description / amount columns

## 📄 License

MIT
