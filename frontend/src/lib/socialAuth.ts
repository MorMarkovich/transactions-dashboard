import { AuthClient } from '@supabase/supabase-js'
import { supabase, supabaseKey, supabaseUrl } from './supabase'
import { safeReturnTo } from './returnTo'

export type SocialProvider = 'google' | 'apple'
export const SOCIAL_CALLBACK_PATH = '/auth/callback'
export const SOCIAL_PROVIDER_LABEL: Record<SocialProvider, string> = { apple: 'Apple', google: 'Google' }

const ATTEMPT_KEY = 'pinkas-social-login'
const SOCIAL_STORAGE_KEY = 'pinkas-social-auth'
const VERIFIER_KEY = `${SOCIAL_STORAGE_KEY}-code-verifier`

const ATTEMPT_LIFETIME = 15 * 60 * 1000
const RETRY_MESSAGE = 'לא הצלחנו להשלים את ההתחברות. אפשר לנסות שוב או להתחבר באימייל.'

interface SocialAttempt {
  provider: SocialProvider
  returnTo: string
  mode: 'login' | 'register'
  createdAt: number
}

type SocialResult = Pick<SocialAttempt, 'returnTo' | 'mode'> & { error: string | null }

let socialClient: InstanceType<typeof AuthClient> | undefined

function getAuthUrl() {
  return new URL('auth/v1', `${supabaseUrl.replace(/\/$/, '')}/`)
}

function getSocialClient() {
  // Use PKCE for social sign-in without changing cross-device confirmation and
  // password recovery links used by the primary browser client.
  socialClient ??= new AuthClient({
    url: getAuthUrl().href,
    headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
    storageKey: SOCIAL_STORAGE_KEY,
    storage: {
      getItem: (key) => key === VERIFIER_KEY ? sessionStorage.getItem(key) : null,
      setItem: (key, value) => { if (key === VERIFIER_KEY) sessionStorage.setItem(key, value) },
      removeItem: (key) => { if (key === VERIFIER_KEY) sessionStorage.removeItem(key) },
    },
    flowType: 'pkce',
    detectSessionInUrl: false,
    autoRefreshToken: false,
  })
  return socialClient
}

export async function startSocialLogin(provider: SocialProvider, from: unknown, mode: SocialAttempt['mode']): Promise<string | null> {
  try {
    const settingsUrl = new URL(`${getAuthUrl().href}/settings`)
    const response = await fetch(settingsUrl, { headers: { apikey: supabaseKey }, cache: 'no-store', signal: AbortSignal.timeout(8000) })
    if (!response.ok) return RETRY_MESSAGE
    const { external } = await response.json()
    if (external?.[provider] === false) {
      return `התחברות עם ${SOCIAL_PROVIDER_LABEL[provider]} עדיין לא זמינה. בינתיים אפשר להתחבר באימייל.`
    }
    if (external?.[provider] !== true) return RETRY_MESSAGE

    const attempt: SocialAttempt = { provider, returnTo: safeReturnTo(from), mode, createdAt: Date.now() }
    sessionStorage.setItem(ATTEMPT_KEY, JSON.stringify(attempt))
    const { error } = await getSocialClient().signInWithOAuth({
      provider,
      options: {
        redirectTo: new URL(SOCIAL_CALLBACK_PATH, window.location.origin).href,
        ...(provider === 'google' ? { queryParams: { prompt: 'select_account' } } : {}),
      },
    })
    if (!error) return null
  } catch { /* the form can recover from network or storage failures */ }
  clearSocialAttempt()
  return RETRY_MESSAGE
}

function clearSocialAttempt() {
  try {
    sessionStorage.removeItem(ATTEMPT_KEY)
    sessionStorage.removeItem(VERIFIER_KEY)
  } catch { /* storage is unavailable */ }
}

function readAttempt(): SocialAttempt | null {
  const raw = sessionStorage.getItem(ATTEMPT_KEY)
  sessionStorage.removeItem(ATTEMPT_KEY)
  if (!raw) return null
  const parsed = JSON.parse(raw) as Partial<SocialAttempt> | null
  if (!parsed || (parsed.provider !== 'google' && parsed.provider !== 'apple')
    || typeof parsed.createdAt !== 'number' || !Number.isFinite(parsed.createdAt)
    || Date.now() - parsed.createdAt > ATTEMPT_LIFETIME) return null
  return {
    provider: parsed.provider, createdAt: parsed.createdAt,
    returnTo: safeReturnTo(parsed.returnTo), mode: parsed.mode === 'register' ? 'register' : 'login',
  }
}

export async function completeSocialLogin(url: URL): Promise<SocialResult> {
  let returnTo = '/'
  let mode: SocialResult['mode'] = 'login'
  try {
    const attempt = readAttempt()
    if (attempt) ({ returnTo, mode } = attempt)
    const fragment = new URLSearchParams(url.hash.slice(1))
    const error = url.searchParams.get('error') ?? fragment.get('error')
    const errorCode = url.searchParams.get('error_code') ?? fragment.get('error_code')
    const code = url.searchParams.get('code')
    if (error === 'access_denied' || errorCode === 'access_denied') {
      return { returnTo, mode, error: 'ההתחברות בוטלה. אפשר לנסות שוב.' }
    }
    if (error || errorCode || !code || !attempt) return { returnTo, mode, error: RETRY_MESSAGE }

    const result = await getSocialClient().exchangeCodeForSession(code)
    if (result.error || !result.data.session) return { returnTo, mode, error: RETRY_MESSAGE }
    const { access_token, refresh_token } = result.data.session
    const signedIn = await supabase.auth.setSession({ access_token, refresh_token })
    return { returnTo, mode, error: signedIn.error || !signedIn.data.session ? RETRY_MESSAGE : null }
  } catch {
    return { returnTo, mode, error: RETRY_MESSAGE }
  } finally {
    clearSocialAttempt()
  }
}
