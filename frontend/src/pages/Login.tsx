import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { safeReturnTo } from '../lib/returnTo'
import { useAuth } from '../lib/AuthContext'
import { ArrowLeft, LoaderCircle } from 'lucide-react'
import AuthFrame from '../components/common/AuthFrame'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type Page = 'login' | 'register' | 'reset'

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const { signIn, signUp, resetPassword } = useAuth()

  const [page, setPage] = useState<Page>(() => new URLSearchParams(location.search).get('mode') === 'register' ? 'register' : 'login')
  // Move focus to the page heading when it mounts: on every
  // login/register/reset switch the clicked control unmounts during the
  // transition, so without this keyboard and screen-reader users are
  // dropped back to <body>. A stable callback ref fires exactly on
  // mount/unmount - independent of animation timing or
  // prefers-reduced-motion - and a stable identity means no re-fires on
  // unrelated re-renders.
  const focusHeading = useCallback((el: HTMLHeadingElement | null) => {
    el?.focus()
  }, [])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(() => {
    try {
      if (sessionStorage.getItem('transactions-dashboard:session-expired')) {
        sessionStorage.removeItem('transactions-dashboard:session-expired')
        return 'ההתחברות פגה. יש להתחבר מחדש.'
      }
    } catch { /* ignore */ }
    return ''
  })
  const [success, setSuccess] = useState(() => new URLSearchParams(window.location.search).get('account_deleted') === '1' ? 'החשבון והנתונים שלו נמחקו.' : '')

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

  // ---- Handlers -----------------------------------------------------------

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
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
    navigate(safeReturnTo((location.state as { from?: unknown } | null)?.from), { replace: true })
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
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

  const title = page === 'register' ? 'יצירת חשבון' : page === 'reset' ? 'איפוס סיסמה' : 'ברוך הבא לפנקס'
  const description = page === 'register' ? 'פתחו חשבון והתחילו לעקוב אחר הכסף שלכם.' : page === 'reset' ? 'נשלח אליכם קישור לבחירת סיסמה חדשה.' : 'התחברו לחשבון שלכם.'
  const submitLabel = page === 'register' ? 'צור חשבון' : page === 'reset' ? 'שלח קישור' : 'התחבר'

  useEffect(() => {
    document.title = `${title} | פנקס`
    return () => { document.title = 'פנקס' }
  }, [title])

  return (
    <AuthFrame key={page} title={title} description={description} headingRef={focusHeading}>
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
        {page === 'login' && <button type="button" className="auth-text-button auth-forgot" onClick={() => switchPage('reset')}>שכחתי סיסמה</button>}
        {error && <p className="auth-feedback auth-error" role="alert">{error}</p>}
        {success && <p className="auth-feedback auth-success" role="status">{success}</p>}
        <button type="submit" className="auth-submit" disabled={loading || (page !== 'login' && Boolean(success))}>
          {submitLabel}{loading ? <LoaderCircle size={18} className="animate-spin" /> : <ArrowLeft size={18} />}
        </button>
      </form>
      <div className="auth-switch">
        {page === 'login' ? <><span>חדשים בפנקס?</span> <button type="button" className="auth-text-button" onClick={() => switchPage('register')}>צור חשבון חדש</button></>
          : <button type="button" className="auth-text-button" onClick={() => switchPage('login')}>{page === 'reset' ? 'חזור' : 'חזור להתחברות'}</button>}
      </div>
    </AuthFrame>
  )
}
