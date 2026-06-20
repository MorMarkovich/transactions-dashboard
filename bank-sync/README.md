# bank-sync

Local, on-demand **bank & credit-card auto-import** for מנתח עסקאות. It scrapes
your Israeli bank/credit accounts **on your own machine** using
[`israeli-bank-scrapers`](https://github.com/eshaham/israeli-bank-scrapers),
categorizes the transactions exactly like the dashboard, and writes the merged
snapshot to Supabase. The dashboard then loads it — no file uploads.

**Your bank passwords never leave this computer.** They're stored in your OS
keychain and used only by this local tool. The cloud (and the dashboard) only
ever see the already-scraped data in Supabase. See [SECURITY.md](./SECURITY.md).

Supported providers: **Leumi, Discount, MAX, Isracard.**

---

## Setup (one time)

Requires Node 18+. From this folder:

```bash
npm install
cp .env.example .env          # set SUPABASE_ANON_KEY; keep PORT=4000
npm run setup                 # enter bank logins + your dashboard (Supabase) login
```

`npm run setup`:
- asks for each provider's login (masked) and stores them in your OS keychain,
- asks for your **dashboard email + password** (used to sign into Supabase as you),
- prints a **sync token** — copy it; you'll paste it into the dashboard once.

`.env` holds only non-secret config:

| var | meaning |
|---|---|
| `SUPABASE_URL` / `SUPABASE_ANON_KEY` | same values the dashboard uses (anon key is public) |
| `PORT` | local server port (default **4000** — must match the dashboard's `VITE_SYNC_URL`) |
| `ALLOWED_ORIGINS` | browser origins allowed to trigger a sync (includes the live site + localhost) |
| `PROVIDERS` | which providers to sync |
| `MONTHS_BACK` | how far back to fetch each run (default 3) |
| `SHOW_BROWSER` | `true` opens a real browser for OTP/2FA |

---

## Usage

**Terminal test:**
```bash
npm run sync          # scrape now and write to Supabase (set SHOW_BROWSER=true if a provider needs an OTP)
```

**For the dashboard button:**
```bash
npm run serve         # starts the localhost service on 127.0.0.1:4000
```
Then open the dashboard, click **"רענן מהבנקים"**, and paste the sync token once
(stored in your browser's localStorage on this machine). The dashboard reloads
with the freshly synced transactions.

To rotate the token or remove everything from the keychain:
```bash
npm run secrets:clear
```

---

## How it fits the dashboard

```
[ רענן מהבנקים button ]  →  POST http://127.0.0.1:4000/sync (x-sync-token)
        (browser)                         │
                                          ▼
                         [ this tool: scrape locally → categorize ]
                                          │
                                          ▼
                         [ Supabase saved_transactions (insert) ]
                                          │
        dashboard restore flow  ◄─────────┘
   (getLatestTransactions → /restore-session → render)
```

- Transactions are written in the dashboard's Hebrew-keyed shape; the backend's
  `/restore-session` then dedups, runs its AI fallback for anything left as
  `שונות`, applies your saved category rules, and strips lump-sum card payments —
  identical to an uploaded file.
- Each sync **merges** new transactions into the latest snapshot (dedup by
  date+amount+description), so history accumulates and re-running is safe.

## Tests

```bash
npm test              # categorizer + normalizer (no network, no credentials)
```
