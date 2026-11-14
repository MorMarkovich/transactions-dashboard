import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { authErrorMessage } from '../lib/AuthContext'
import { ArrowLeft, LoaderCircle } from 'lucide-react'
import AuthFrame from '../components/common/AuthFrame'

// ---------------------------------------------------------------------------
// Landing page for the password-recovery email link. Supabase parses the
// #access_token&type=recovery hash into a session and fires PASSWORD_RECOVERY;
// only then do we show the new-password form.
// ---------------------------------------------------------------------------
type Status = 'checking' | 'ready' | 'invalid' | 'done'

export default function ResetPassword() {
  const navigate = useNavigate()
  const [status, setStatus] = useState<Status>('checking')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')

  useEffect(() => {
    document.title = 'איפוס סיסמה | פנקס'
    return () => { document.title = 'פנקס' }
  }, [])

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setStatus('ready')
    })
    // Deliberately NO hash/session fallback: only the PASSWORD_RECOVERY event
    // opens the form. A forged hash token must never let the form act on an
    // unrelated already-authenticated session. If the link is bad, expired or
    // already consumed, no event arrives and we show the invalid state.
    const timer = window.setTimeout(() => {
      setStatus((s) => (s === 'checking' ? 'invalid' : s))
    }, 8000)
    return () => { subscription.unsubscribe(); window.clearTimeout(timer) }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!password || !password2) { setError('נא למלא את כל השדות'); return }
    if (password.length < 6) { setError('סיסמה חייבת להכיל 6+ תווים'); return }
    if (password !== password2) { setError('הסיסמאות לא תואמות'); return }
    setLoading(true)
    setError('')
    const { error: err } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (err) { setError(authErrorMessage(err) ?? 'משהו השתבש. נסו שוב מאוחר יותר'); return }
    setStatus('done')
    window.setTimeout(() => navigate('/', { replace: true }), 1800)
  }

  const title = status === 'ready' ? 'בחירת סיסמה חדשה'
    : status === 'invalid' ? 'הקישור לא תקין'
    : status === 'done' ? 'הסיסמה עודכנה' : 'איפוס סיסמה'

  return (
    <AuthFrame title={title} description="עדכון הסיסמה לחשבון פנקס.">
      {status === 'checking' && <p role="status">מאמת את הקישור…</p>}
      {status === 'invalid' && <>
        <p className="auth-feedback auth-error" role="alert">קישור האיפוס פג תוקף או שכבר נוצל. אפשר לבקש קישור חדש מעמוד ההתחברות.</p>
        <Link to="/login" className="auth-submit">לעמוד ההתחברות <ArrowLeft size={18} /></Link>
      </>}
      {status === 'ready' && <form className="pinkas-auth-form" onSubmit={handleSubmit}>
        <label>סיסמה חדשה
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" dir="rtl" required />
        </label>
        <label>אימות סיסמה חדשה
          <input type="password" value={password2} onChange={(event) => setPassword2(event.target.value)} autoComplete="new-password" dir="rtl" required />
        </label>
        {error && <p className="auth-feedback auth-error" role="alert">{error}</p>}
        <button type="submit" className="auth-submit" disabled={loading}>שמור סיסמה חדשה {loading ? <LoaderCircle size={18} className="animate-spin" /> : <ArrowLeft size={18} />}</button>
      </form>}
      {status === 'done' && <p className="auth-feedback auth-success" role="status">הדשבורד ייפתח מיד.</p>}
    </AuthFrame>
  )
}
