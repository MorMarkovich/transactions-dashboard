# Security policy

## Supported version

Security updates are applied to the latest `main` branch.

## Reporting a vulnerability

Report suspected vulnerabilities privately to the repository owner. Do not
open a public issue containing credentials, financial records, access tokens,
or a working exploit.

## Deployment requirements

- Never set `AUTH_DISABLED` on Render or any internet-accessible deployment.
- Store `ANTHROPIC_API_KEY` only as a Render secret (`sync: false`).
- Keep Supabase Row Level Security policies from `supabase_setup.sql` enabled.
- Restrict `ALLOWED_ORIGINS` to the deployed dashboard origin.
- Rotate any credential immediately if it is exposed in logs or Git history.

The local `bank-sync` tool pins `israeli-bank-scrapers` and overrides its
browser engine to a patched Puppeteer release. Keep the lockfile committed,
run `npm audit --omit=dev` before upgrades, use the tool only on a trusted
workstation, and never expose its local listener to the network.
