// Loads NON-secret runtime config from .env. Secrets (bank passwords, Supabase
// login, sync token) come from the OS keychain — never from here.
import 'dotenv/config'
import { SUPPORTED } from './providers.js'

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
}

export function assertConfig() {
  const missing = []
  if (!config.supabaseUrl) missing.push('SUPABASE_URL')
  if (!config.supabaseAnonKey) missing.push('SUPABASE_ANON_KEY')
  if (missing.length) {
    throw new Error(`Missing config in .env: ${missing.join(', ')}. Copy .env.example to .env and fill it in.`)
  }
}
