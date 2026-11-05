import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { CreditCard, Lock, ArrowRight } from 'lucide-react'
import Input from '../components/ui/Input'
import Button from '../components/ui/Button'

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
    if (err) { setError(err.message); return }
    setStatus('done')
    window.setTimeout(() => navigate('/', { replace: true }), 1800)
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-6"
      style={{ background: 'var(--bg-primary)', direction: 'rtl' }}
    >
      <div className="fixed inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
        <div className="absolute top-1/4 right-1/4 w-96 h-96 rounded-full opacity-20 blur-[120px]" style={{ background: '#818cf8' }} />
        <div className="absolute bottom-1/4 left-1/4 w-80 h-80 rounded-full opacity-15 blur-[100px]" style={{ background: '#a78bfa' }} />
      </div>

      <div
        className="relative z-10 w-full max-w-[420px] rounded-3xl p-6 sm:p-8"
        style={{
          background: 'var(--bg-card)',
          backdropFilter: 'blur(20px)',
          border: '1px solid var(--border-color)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        }}
      >
        <div className="flex items-center gap-3 mb-6">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #818cf8, #6d28d9)' }}
          >
            <CreditCard className="w-5 h-5 text-white" />
          </div>
          <span className="text-lg font-extrabold" style={{ color: 'var(--text-primary)' }}>פנקס</span>
        </div>

        {status === 'checking' && (
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>מאמת את הקישור…</p>
        )}

        {status === 'invalid' && (
          <div>
            <h2 className="text-xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>הקישור לא תקין 🔑</h2>
            <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
              קישור האיפוס פג תוקף או שכבר נוצל. בקש קישור חדש מעמוד ההתחברות.
            </p>
            <Link to="/login" style={{ textDecoration: 'none' }}>
              <Button type="button" variant="primary" size="lg" fullWidth icon={<ArrowRight size={16} />}>
                לעמוד ההתחברות
              </Button>
            </Link>
          </div>
        )}

        {status === 'ready' && (
          <form onSubmit={handleSubmit} noValidate>
            <h2 className="text-xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>בחירת סיסמה חדשה 🔑</h2>
            <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>הזן סיסמה חדשה לחשבון שלך</p>
            <div className="space-y-3">
              <Input
                type="password"
                placeholder="סיסמה חדשה"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                icon={<Lock size={18} />}
                aria-label="סיסמה חדשה"
                aria-invalid={!!error || undefined}
                autoComplete="new-password"
              />
              <Input
                type="password"
                placeholder="אימות סיסמה חדשה"
                value={password2}
                onChange={(e) => setPassword2(e.target.value)}
                icon={<Lock size={18} />}
                aria-label="אימות סיסמה חדשה"
                aria-invalid={!!error || undefined}
                autoComplete="new-password"
              />
            </div>
            {error && (
              <div role="alert" style={{ marginTop: '0.75rem', padding: '0.5rem 0.75rem', borderRadius: '8px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: 'var(--accent-danger, #ef4444)', fontSize: '0.8125rem', fontWeight: 500 }}>
                {error}
              </div>
            )}
            <div style={{ marginTop: '1.25rem' }}>
              <Button type="submit" variant="primary" size="lg" fullWidth loading={loading}>
                שמור סיסמה חדשה
              </Button>
            </div>
          </form>
        )}

        {status === 'done' && (
          <div>
            <h2 className="text-xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>הסיסמה עודכנה ✓</h2>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>מעביר אותך לדשבורד…</p>
          </div>
        )}
      </div>
    </div>
  )
}
