// Loads NON-secret runtime config from .env. Secrets (bank passwords, Supabase
// login, sync token) come from the OS keychain — never from here.
import 'dotenv/config'
import { SUPPORTED } from './providers.js'
import { parseOwnerKeywords } from './owner.js'

function list(value, fallback) {
  if (!value) return fallback
  return value.split(',').map((s) => s.trim()).filter(Boolean)
}

export const config = {
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
  port: Number(process.env.PORT) || 4000,
  allowedOrigins: list(process.env.ALLOWED_ORIGINS, [
    'https://transactions-dashboard-bfxn.onrender.com',
    'http://localhost:5173',
    'http://localhost:5174',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:5174',
  ]),
  providers: list(process.env.PROVIDERS, SUPPORTED).filter((p) => SUPPORTED.includes(p)),
  monthsBack: Number(process.env.MONTHS_BACK) || 3,
  showBrowser: String(process.env.SHOW_BROWSER || '').toLowerCase() === 'true',
  // Use an already-installed Chrome instead of the (often broken on Apple
  // Silicon) bundled Chromium. Defaults to the standard macOS Chrome path.
  chromePath: process.env.CHROME_PATH
    || (process.platform === 'darwin'
      ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
      : ''),
  // Debug: leave the scraper's browser window open after it finishes/fails so
  // you can see what the bank showed. Use with `npm run sync` only.
  keepBrowserOpen: String(process.env.KEEP_BROWSER_OPEN || '').toLowerCase() === 'true',
  // Navigation/element timeout (ms) — the library default of 30s is too short
  // for slow SPAs like Discount. Plus a couple of navigation retries.
  scrapeTimeout: process.env.SCRAPE_TIMEOUT !== undefined ? Number(process.env.SCRAPE_TIMEOUT) : 120000,
  navRetryCount: process.env.NAV_RETRY !== undefined ? Number(process.env.NAV_RETRY) : 2,
  // Pause between accounts (ms) so logins don't fire back-to-back — reduces
  // anti-bot blocks. A longer wait when two accounts share a provider (e.g.
  // two Isracard cards), which is the most block-prone case.
  accountDelayMs: process.env.ACCOUNT_DELAY_MS !== undefined ? Number(process.env.ACCOUNT_DELAY_MS) : 4000,
  sameProviderDelayMs: process.env.SAME_PROVIDER_DELAY_MS !== undefined ? Number(process.env.SAME_PROVIDER_DELAY_MS) : 20000,
  // Income-month attribution for salaries near a month boundary:
  // 'next' = late-month pay counts as the following month, 'prev' = early-month
  // pay counts as the previous month, 'none' = leave as-is.
  incomeShiftDirection: process.env.INCOME_SHIFT || 'next',
  incomeShiftDay: process.env.INCOME_SHIFT_DAY !== undefined ? Number(process.env.INCOME_SHIFT_DAY) : undefined,
  salaryMin: process.env.SALARY_MIN !== undefined ? Number(process.env.SALARY_MIN) : 0,
  // false (default) = split installments so each monthly charge is its own line
  // on its billing date, matching the card statement. true = one combined line.
  combineInstallments: String(process.env.COMBINE_INSTALLMENTS || '').toLowerCase() === 'true',
  // Owner name → keywords used to attribute joint-account rows to a person.
  ownerKeywords: parseOwnerKeywords(process.env.OWNER_KEYWORDS),
}

export function assertConfig() {
  const missing = []
  if (!config.supabaseUrl) missing.push('SUPABASE_URL')
  if (!config.supabaseAnonKey) missing.push('SUPABASE_ANON_KEY')
  if (missing.length) {
    throw new Error(`Missing config in .env: ${missing.join(', ')}. Copy .env.example to .env and fill it in.`)
  }
}
