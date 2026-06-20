# Security model

This tool handles bank credentials, so its design is deliberately conservative.

## Principles

- **Credentials stay local.** Bank/card logins and your Supabase login are stored
  in the **OS keychain** (via `keytar`) — encrypted at rest, scoped to your OS
  user. They are never written to disk, never put in `.env`, and never committed.
  `.gitignore` blocks `.env` and any `*.secret`/`secrets.json` files.
- **The cloud never sees credentials.** Scraping runs only on your machine. The
  dashboard and Supabase only ever receive the already-scraped transaction data.
- **Least privilege to Supabase.** The tool signs in **as you** (email/password)
  with the **anon (public) key** and is therefore bound by the same Row Level
  Security as the dashboard. The `service_role` key is never used.
- **Read/insert only.** It reads your latest snapshot + category rules and
  inserts a new snapshot. It never deletes data and never moves money.

## Local server hardening (`npm run serve`)

The button calls a server that runs only on your machine. It is protected by
three independent layers:

1. **Loopback bind.** It listens on `127.0.0.1` only — not reachable from the
   LAN or internet.
2. **Secret token.** `POST /sync` requires the `x-sync-token` header to match a
   32-byte random token generated at setup (kept in the keychain, compared in
   constant time). Without it, requests are rejected `401`.
3. **Origin allow-list + CORS.** Only the origins in `ALLOWED_ORIGINS` (the live
   dashboard + localhost) may call it. A random website you visit cannot trigger
   a sync (no token, wrong origin).

A single in-flight sync is enforced (`429` on overlap).

## What you are responsible for

- Keep your OS user account locked/encrypted — keychain security inherits from it.
- Don't paste the sync token anywhere except the dashboard prompt. Rotate it with
  `npm run secrets:clear` if it leaks.
- Only run `npm run serve` when you want the button to work; stop it otherwise.
- 2FA/OTP: if a provider challenges every login, run with `SHOW_BROWSER=true` and
  complete the prompt interactively.

## What is NOT protected

- Anything with access to your unlocked OS user session can read the keychain —
  this tool is only as secure as your machine.
- The Supabase anon key is public by design; your data is protected by RLS, not
  by hiding that key.
