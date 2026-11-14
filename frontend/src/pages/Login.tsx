import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { safeReturnTo } from '../lib/returnTo'
import { SOCIAL_PROVIDER_LABEL, startSocialLogin, type SocialProvider } from '../lib/socialAuth'
import { useAuth } from '../lib/AuthContext'
import { ArrowLeft, LoaderCircle } from 'lucide-react'
import AuthFrame from '../components/common/AuthFrame'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type Page = 'login' | 'register' | 'reset'
const SOCIAL_PROVIDERS: SocialProvider[] = ['apple', 'google']

interface LoginLocationState { from?: unknown; socialError?: string }

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const routeState = location.state as LoginLocationState | null
  const { signIn, signUp, resetPassword } = useAuth()

  const [page, setPage] = useState<Page>(() => new URLSearchParams(location.search).get('mode') === 'register' ? 'register' : 'login')
  // Restore focus when the user switches between the forms.
  const focusHeading = useCallback((el: HTMLHeadingElement | null) => {
    el?.focus()
  }, [])
  const [loading, setLoading] = useState(false)
  const [socialPending, setSocialPending] = useState<SocialProvider | null>(null)
  const activeSocialAttempt = useRef<SocialProvider | null>(null)
  const busy = loading || socialPending !== null
  const [error, setError] = useState(() => {
    if (routeState?.socialError) return routeState.socialError
    try {
      if (sessionStorage.getItem('transactions-dashboard:session-expired')) {
        sessionStorage.removeItem('transactions-dashboard:session-expired')
        return 'ההתחברות פגה. יש להתחבר מחדש.'
      }
    } catch { /* ignore */ }
    return ''
  })
  const [success, setSuccess] = useState(() => new URLSearchParams(location.search).get('account_deleted') === '1' ? 'החשבון והנתונים שלו נמחקו.' : '')

  // Form fields
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [name, setName] = useState('')

  const clearForm = () => {
    setEmail('')
    setPassword('')
    setPassword2('')
    setName('')
    setError('')
    setSuccess('')
  }

  const switchPage = (target: Page) => {
    clearForm()
    setPage(target)
    if (target === 'reset') setEmail(email)
  }

  useEffect(() => {
    const restoreButtons = (event: PageTransitionEvent) => {
      if (event.persisted) {
        activeSocialAttempt.current = null
        setSocialPending(null)
      }
    }
    window.addEventListener('pageshow', restoreButtons)
    return () => window.removeEventListener('pageshow', restoreButtons)
  }, [])

  const handleSocialLogin = async (provider: SocialProvider) => {
    if (loading || activeSocialAttempt.current || page === 'reset') return
    activeSocialAttempt.current = provider
    setSocialPending(provider)
    setError('')
    setSuccess('')
    const message = await startSocialLogin(provider, routeState?.from, page)
    if (message) {
      activeSocialAttempt.current = null
      setSocialPending(null)
      setError(message)
    }
  }

  // ---- Handlers -----------------------------------------------------------

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading || activeSocialAttempt.current) return
    if (!email || !password) {
      setError('נא למלא את כל השדות')
      return
    }
    setLoading(true)
    setError('')
    const { error: err } = await signIn(email, password)
    if (err) {
      setError(err)
      setLoading(false)
      return
    }
    // Return to the page the auth guard bounced away from, when there is one.
    navigate(safeReturnTo(routeState?.from), { replace: true })
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading || activeSocialAttempt.current) return
    const trimmedName = name.trim()
    if (!trimmedName || !email || !password || !password2) {
      setError('נא למלא את כל השדות')
      return
    }
    if (password !== password2) {
      setError('הסיסמאות לא תואמות')
      return
    }
    if (password.length < 6) {
      setError('סיסמה חייבת להכיל לפחות 6 תווים')
      return
    }
    setLoading(true)
    setError('')
    const { error: err, needsConfirmation } = await signUp(email, password, trimmedName)
    if (err) {
      setError(err)
      setLoading(false)
      return
    }
    setLoading(false)
    if (needsConfirmation) {
      // Stay on the register page with a persistent instruction: the account
      // only works after the emailed link is opened. Clear the password
      // fields: the values are no longer needed, and an accidental second
      // tap on the submit button must hit client validation rather than
      // re-calling signUp and tripping the email rate limit.
      setPassword('')
      setPassword2('')
      setSuccess(`שלחנו מייל אימות אל ${email}. לחצו על הקישור במייל כדי להפעיל את החשבון, ואז התחברו. (בדקו גם בספאם)`)
      return
    }
    // Confirmation is off: a session already exists and the app redirects.
    setSuccess('נרשמת בהצלחה!')
  }

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading || activeSocialAttempt.current) return
    if (!email) {
      setError('נא להזין כתובת אימייל')
      return
    }
    setLoading(true)
    setError('')
    const { error: err } = await resetPassword(email)
    if (err) {
      setError(err)
      setLoading(false)
      return
    }
    setSuccess('נשלח קישור לאיפוס')
    setLoading(false)
  }

  const title = page === 'register' ? 'יצירת חשבון' : page === 'reset' ? 'איפוס סיסמה' : 'כניסה לפנקס'
  const description = page === 'register' ? 'פתחו חשבון והתחילו לעקוב אחר הכסף שלכם.' : page === 'reset' ? 'נשלח אליכם קישור לבחירת סיסמה חדשה.' : 'התחברו לחשבון שלכם.'
  const submitLabel = page === 'register' ? 'צור חשבון' : page === 'reset' ? 'שלח קישור' : 'התחבר'

  useEffect(() => {
    document.title = `${title} | פנקס`
    return () => { document.title = 'פנקס' }
  }, [title])

  return (
    <AuthFrame key={page} title={title} description={description} headingRef={focusHeading}>
      {page !== 'reset' && <>
        <div className="auth-social" role="group" aria-label="כניסה עם חשבון קיים">
          {SOCIAL_PROVIDERS.map(provider => (
            <button key={provider} type="button" disabled={busy} aria-busy={socialPending === provider}
              onClick={() => { void handleSocialLogin(provider) }}>
              {socialPending === provider
                ? <LoaderCircle size={18} className="animate-spin" aria-hidden="true" />
                : <img src={`/auth/${provider}.png`} alt="" width="18" height="18" />}
              <span>המשיכו עם <bdi>{SOCIAL_PROVIDER_LABEL[provider]}</bdi></span>
            </button>
          ))}
        </div>
        {socialPending && <p className="auth-social-status" role="status">פותחים את מסך הכניסה של <bdi>{SOCIAL_PROVIDER_LABEL[socialPending]}</bdi>…</p>}
        <div className="auth-method-divider"><span>או עם אימייל</span></div>
      </>}
      {error && <p className="auth-feedback auth-error" role="alert">{error}</p>}
      <form className="pinkas-auth-form" onSubmit={page === 'register' ? handleRegister : page === 'reset' ? handleReset : handleLogin}>
        {page === 'register' && <label>שם מלא
          <input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" required />
        </label>}
        <label>{page === 'reset' ? 'כתובת אימייל לאיפוס' : 'כתובת אימייל'}
          <input type="email" placeholder="אימייל" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" dir="rtl" required />
        </label>
        {page !== 'reset' && <label>סיסמה
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={page === 'register' ? 'new-password' : 'current-password'} aria-describedby={page === 'register' ? 'password-requirement' : undefined} dir="rtl" required />
        </label>}
        {page === 'register' && <>
          <small id="password-requirement">לפחות 6 תווים.</small>
          <label>אימות סיסמה
            <input type="password" value={password2} onChange={(event) => setPassword2(event.target.value)} autoComplete="new-password" dir="rtl" required />
          </label>
        </>}
        {page === 'login' && <button type="button" className="auth-text-button auth-forgot" disabled={busy} onClick={() => switchPage('reset')}>שכחתי סיסמה</button>}
        {success && <p className="auth-feedback auth-success" role="status">{success}</p>}
        <button type="submit" className="auth-submit" disabled={busy || (page !== 'login' && Boolean(success))}>
          {submitLabel}{loading ? <LoaderCircle size={18} className="animate-spin" /> : <ArrowLeft size={18} />}
        </button>
      </form>
      <div className="auth-switch">
        {page === 'login' ? <><span>חדשים בפנקס?</span> <button type="button" className="auth-text-button" disabled={busy} onClick={() => switchPage('register')}>צור חשבון חדש</button></>
          : <button type="button" className="auth-text-button" disabled={busy} onClick={() => switchPage('login')}>{page === 'reset' ? 'חזור' : 'חזור להתחברות'}</button>}
      </div>
    </AuthFrame>
  )
}
