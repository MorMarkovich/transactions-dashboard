import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { CreditCard, Mail, Lock, User, ArrowLeft, LogIn } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import Input from '../components/ui/Input'
import Button from '../components/ui/Button'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type Page = 'login' | 'register' | 'reset'

// ---------------------------------------------------------------------------
// Feature badges shown on branding panel
// ---------------------------------------------------------------------------
const FEATURES: readonly { icon: string; text: string }[] = [
  { icon: '\u{1F512}', text: '\u05DE\u05D0\u05D5\u05D1\u05D8\u05D7' },
  { icon: '\u{1F4CA}', text: '\u05E0\u05D9\u05EA\u05D5\u05D7 \u05D7\u05DB\u05DD' },
  { icon: '\u2601\uFE0F', text: '\u05E9\u05DE\u05D9\u05E8\u05D4 \u05D1\u05E2\u05E0\u05DF' },
  { icon: '\u{1F1EE}\u{1F1F1}', text: '\u05E2\u05D1\u05E8\u05D9\u05EA \u05DE\u05DC\u05D0\u05D4' },
]

// ---------------------------------------------------------------------------
// Animation variants for form page transitions
// ---------------------------------------------------------------------------
const pageVariants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -16 },
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function Login() {
  const navigate = useNavigate()
  const { signIn, signUp, resetPassword } = useAuth()

  const [page, setPage] = useState<Page>('login')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

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
  }

  // ---- Handlers -----------------------------------------------------------

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) {
      setError('\u05E0\u05D0 \u05DC\u05DE\u05DC\u05D0 \u05D0\u05EA \u05DB\u05DC \u05D4\u05E9\u05D3\u05D5\u05EA')
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
    navigate('/')
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name || !email || !password || !password2) {
      setError('\u05E0\u05D0 \u05DC\u05DE\u05DC\u05D0 \u05D0\u05EA \u05DB\u05DC \u05D4\u05E9\u05D3\u05D5\u05EA')
      return
    }
    if (password !== password2) {
      setError('\u05D4\u05E1\u05D9\u05E1\u05DE\u05D0\u05D5\u05EA \u05DC\u05D0 \u05EA\u05D5\u05D0\u05DE\u05D5\u05EA')
      return
    }
    if (password.length < 6) {
      setError('\u05E1\u05D9\u05E1\u05DE\u05D4 \u05D7\u05D9\u05D9\u05D1\u05EA \u05DC\u05D4\u05DB\u05D9\u05DC 6+ \u05EA\u05D5\u05D5\u05D9\u05DD')
      return
    }
    setLoading(true)
    setError('')
    const { error: err } = await signUp(email, password, name)
    if (err) {
      setError(err)
      setLoading(false)
      return
    }
    setSuccess('\u05E0\u05E8\u05E9\u05DE\u05EA \u05D1\u05D4\u05E6\u05DC\u05D7\u05D4! \u05D1\u05D3\u05D5\u05E7 \u05D0\u05EA \u05D4\u05DE\u05D9\u05D9\u05DC')
    setLoading(false)
    setTimeout(() => switchPage('login'), 2500)
  }

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) {
      setError('\u05E0\u05D0 \u05DC\u05D4\u05D6\u05D9\u05DF \u05DE\u05D9\u05D9\u05DC')
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
    setSuccess('\u05E0\u05E9\u05DC\u05D7 \u05E7\u05D9\u05E9\u05D5\u05E8 \u05DC\u05D0\u05D9\u05E4\u05D5\u05E1')
    setLoading(false)
  }

  const handleGuest = () => {
    navigate('/')
  }

  // ---- Render -------------------------------------------------------------

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: 'var(--bg-primary)' }}
    >
      {/* Background gradient orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
        <div
          className="absolute top-1/4 right-1/4 w-96 h-96 rounded-full opacity-20 blur-[120px]"
          style={{ background: '#818cf8' }}
        />
        <div
          className="absolute bottom-1/4 left-1/4 w-80 h-80 rounded-full opacity-15 blur-[100px]"
          style={{ background: '#a78bfa' }}
        />
      </div>

      {/* Split container: RTL layout - branding on right (order-2), form on left (order-1) */}
      <div className="relative z-10 w-full max-w-[960px] grid grid-cols-1 md:grid-cols-2 gap-0">

        {/* ─── Right side: Branding panel (hidden on mobile) ─────────── */}
        <div className="hidden md:flex flex-col justify-center p-10 order-2">
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
          >
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center mb-6"
              style={{
                background: 'linear-gradient(135deg, #818cf8, #6d28d9)',
                boxShadow: '0 8px 32px rgba(129,140,248,0.3)',
              }}
            >
              <CreditCard className="w-7 h-7 text-white" />
            </div>

            <h1
              className="text-3xl font-extrabold mb-3"
              style={{ color: 'var(--text-primary)' }}
            >
              {'\u05DE\u05E0\u05EA\u05D7 \u05E2\u05E1\u05E7\u05D0\u05D5\u05EA'}
            </h1>
            <p
              className="text-base leading-relaxed mb-8"
              style={{ color: 'var(--text-secondary)' }}
            >
              {'\u05E0\u05D9\u05EA\u05D5\u05D7 \u05D7\u05DB\u05DD \u05E9\u05DC \u05D4\u05D5\u05E6\u05D0\u05D5\u05EA \u05DB\u05E8\u05D8\u05D9\u05E1 \u05D4\u05D0\u05E9\u05E8\u05D0\u05D9 \u05E9\u05DC\u05DA. \u05D4\u05E2\u05DC\u05D4 \u05E7\u05D1\u05E6\u05D9\u05DD \u05DE\u05DB\u05DC \u05D1\u05E0\u05E7, \u05E7\u05D1\u05DC \u05EA\u05D5\u05D1\u05E0\u05D5\u05EA \u05DE\u05D9\u05D9\u05D3\u05D9\u05D5\u05EA.'}
            </p>

            {/* Feature badges */}
            <div className="flex flex-wrap gap-3">
              {FEATURES.map((f, i) => (
                <span
                  key={i}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 14px',
                    borderRadius: '9999px',
                    background: 'rgba(129,140,248,0.08)',
                    border: '1px solid rgba(129,140,248,0.15)',
                    fontSize: '0.8125rem',
                    fontWeight: 500,
                    color: 'var(--text-secondary)',
                  }}
                >
                  <span>{f.icon}</span>
                  {f.text}
                </span>
              ))}
            </div>
          </motion.div>
        </div>

        {/* ─── Left side: Form Card ──────────────────────────────────── */}
        <div
          className="rounded-3xl p-8 md:p-10 order-1"
          style={{
            background: 'var(--bg-card)',
            backdropFilter: 'blur(20px)',
            border: '1px solid var(--border-color)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          }}
        >
          {/* Mobile logo (visible only on small screens) */}
          <div className="md:hidden flex items-center gap-3 mb-8">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #818cf8, #6d28d9)' }}
            >
              <CreditCard className="w-5 h-5 text-white" />
            </div>
            <span
              className="text-xl font-extrabold"
              style={{ color: 'var(--text-primary)' }}
            >
              {'\u05DE\u05E0\u05EA\u05D7 \u05E2\u05E1\u05E7\u05D0\u05D5\u05EA'}
            </span>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={page}
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.2 }}
            >
              {/* ── LOGIN ─────────────────────────────────────────────── */}
              {page === 'login' && (
                <form onSubmit={handleLogin} noValidate>
                  <h2
                    className="text-xl font-bold mb-1"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {'\u05D1\u05E8\u05D5\u05DA \u05D4\u05D1\u05D0 \uD83D\uDC4B'}
                  </h2>
                  <p
                    className="text-sm mb-6"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {'\u05D4\u05EA\u05D7\u05D1\u05E8 \u05DC\u05D7\u05E9\u05D1\u05D5\u05DF \u05E9\u05DC\u05DA'}
                  </p>

                  <div className="space-y-3">
                    <Input
                      type="email"
                      placeholder={'\u05D0\u05D9\u05DE\u05D9\u05D9\u05DC'}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      icon={<Mail size={18} />}
                      aria-label={'\u05DB\u05EA\u05D5\u05D1\u05EA \u05D0\u05D9\u05DE\u05D9\u05D9\u05DC'}
                      aria-invalid={!!error || undefined}
                      autoComplete="email"
                    />
                    <Input
                      type="password"
                      placeholder={'\u05E1\u05D9\u05E1\u05DE\u05D4'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      icon={<Lock size={18} />}
                      aria-label={'\u05E1\u05D9\u05E1\u05DE\u05D4'}
                      aria-invalid={!!error || undefined}
                      autoComplete="current-password"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => switchPage('reset')}
                    className="text-xs mt-2 block transition-colors"
                    style={{ color: 'var(--accent-primary, #818cf8)' }}
                  >
                    {'\u05E9\u05DB\u05D7\u05EA\u05D9 \u05E1\u05D9\u05E1\u05DE\u05D4'}
                  </button>

                  {error && <ErrorMsg text={error} />}

                  <div style={{ marginTop: '1.25rem' }}>
                    <Button
                      type="submit"
                      variant="primary"
                      size="lg"
                      fullWidth
                      loading={loading}
                      icon={!loading ? <LogIn size={18} /> : undefined}
                    >
                      {'\u05D4\u05EA\u05D7\u05D1\u05E8'}
                    </Button>
                  </div>

                  {/* Divider */}
                  <div className="flex items-center gap-3 my-5">
                    <div className="flex-1 h-px" style={{ background: 'var(--border-color)' }} />
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {'\u05D7\u05D3\u05E9 \u05DB\u05D0\u05DF?'}
                    </span>
                    <div className="flex-1 h-px" style={{ background: 'var(--border-color)' }} />
                  </div>

                  <Button
                    type="button"
                    variant="secondary"
                    size="md"
                    fullWidth
                    onClick={() => switchPage('register')}
                  >
                    {'\u05E6\u05D5\u05E8 \u05D7\u05E9\u05D1\u05D5\u05DF \u05D7\u05D3\u05E9'}
                  </Button>

                  <button
                    type="button"
                    onClick={handleGuest}
                    className="w-full mt-3 py-2 text-sm flex items-center justify-center gap-1 transition-colors"
                    style={{ color: 'var(--text-muted)' }}
                    aria-label={'\u05D4\u05DE\u05E9\u05DA \u05DB\u05D0\u05D5\u05E8\u05D7'}
                  >
                    {'\u05D4\u05DE\u05E9\u05DA \u05DB\u05D0\u05D5\u05E8\u05D7'}
                  </button>
                </form>
              )}

              {/* ── REGISTER ──────────────────────────────────────────── */}
              {page === 'register' && (
                <form onSubmit={handleRegister} noValidate>
                  <h2
                    className="text-xl font-bold mb-1"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {'\u05D9\u05E6\u05D9\u05E8\u05EA \u05D7\u05E9\u05D1\u05D5\u05DF \u2728'}
                  </h2>
                  <p
                    className="text-sm mb-6"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {'\u05D4\u05E8\u05E9\u05DE\u05D4 \u05EA\u05D5\u05DA \u05E9\u05E0\u05D9\u05D5\u05EA'}
                  </p>

                  <div className="space-y-3">
                    <Input
                      placeholder={'\u05E9\u05DD \u05DE\u05DC\u05D0'}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      icon={<User size={18} />}
                      aria-label={'\u05E9\u05DD \u05DE\u05DC\u05D0'}
                      aria-invalid={!!error || undefined}
                      autoComplete="name"
                    />
                    <Input
                      type="email"
                      placeholder={'\u05D0\u05D9\u05DE\u05D9\u05D9\u05DC'}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      icon={<Mail size={18} />}
                      aria-label={'\u05DB\u05EA\u05D5\u05D1\u05EA \u05D0\u05D9\u05DE\u05D9\u05D9\u05DC'}
                      aria-invalid={!!error || undefined}
                      autoComplete="email"
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <Input
                        type="password"
                        placeholder={'\u05E1\u05D9\u05E1\u05DE\u05D4'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        icon={<Lock size={18} />}
                        aria-label={'\u05E1\u05D9\u05E1\u05DE\u05D4'}
                        aria-invalid={!!error || undefined}
                        autoComplete="new-password"
                      />
                      <Input
                        type="password"
                        placeholder={'\u05D0\u05D9\u05DE\u05D5\u05EA \u05E1\u05D9\u05E1\u05DE\u05D4'}
                        value={password2}
                        onChange={(e) => setPassword2(e.target.value)}
                        icon={<Lock size={18} />}
                        aria-label={'\u05D0\u05D9\u05DE\u05D5\u05EA \u05E1\u05D9\u05E1\u05DE\u05D4'}
                        aria-invalid={!!error || undefined}
                        autoComplete="new-password"
                      />
                    </div>
                  </div>

                  {error && <ErrorMsg text={error} />}
                  {success && <SuccessMsg text={success} />}

                  <div style={{ marginTop: '1.25rem' }}>
                    <Button
                      type="submit"
                      variant="primary"
                      size="lg"
                      fullWidth
                      loading={loading}
                    >
                      {'\u05E6\u05D5\u05E8 \u05D7\u05E9\u05D1\u05D5\u05DF'}
                    </Button>
                  </div>

                  <button
                    type="button"
                    onClick={() => switchPage('login')}
                    className="w-full mt-3 py-2 text-sm flex items-center justify-center gap-1 transition-colors"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    <ArrowLeft size={14} />
                    {'\u05D7\u05D6\u05D5\u05E8 \u05DC\u05D4\u05EA\u05D7\u05D1\u05E8\u05D5\u05EA'}
                  </button>
                </form>
              )}

              {/* ── RESET PASSWORD ────────────────────────────────────── */}
              {page === 'reset' && (
                <form onSubmit={handleReset} noValidate>
                  <h2
                    className="text-xl font-bold mb-1"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {'\u05D0\u05D9\u05E4\u05D5\u05E1 \u05E1\u05D9\u05E1\u05DE\u05D4 \uD83D\uDD11'}
                  </h2>
                  <p
                    className="text-sm mb-6"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {'\u05E0\u05E9\u05DC\u05D7 \u05DC\u05DA \u05E7\u05D9\u05E9\u05D5\u05E8 \u05DC\u05DE\u05D9\u05D9\u05DC'}
                  </p>

                  <Input
                    type="email"
                    placeholder={'\u05D0\u05D9\u05DE\u05D9\u05D9\u05DC'}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    icon={<Mail size={18} />}
                    aria-label={'\u05DB\u05EA\u05D5\u05D1\u05EA \u05D0\u05D9\u05DE\u05D9\u05D9\u05DC \u05DC\u05D0\u05D9\u05E4\u05D5\u05E1'}
                    aria-invalid={!!error || undefined}
                    autoComplete="email"
                  />

                  {error && <ErrorMsg text={error} />}
                  {success && <SuccessMsg text={success} />}

                  <div style={{ marginTop: '1.25rem' }}>
                    <Button
                      type="submit"
                      variant="primary"
                      size="lg"
                      fullWidth
                      loading={loading}
                    >
                      {'\u05E9\u05DC\u05D7 \u05E7\u05D9\u05E9\u05D5\u05E8'}
                    </Button>
                  </div>

                  <button
                    type="button"
                    onClick={() => switchPage('login')}
                    className="w-full mt-3 py-2 text-sm flex items-center justify-center gap-1 transition-colors"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    <ArrowLeft size={14} />
                    {'\u05D7\u05D6\u05D5\u05E8'}
                  </button>
                </form>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ErrorMsg({ text }: { text: string }) {
  return (
    <div
      role="alert"
      style={{
        marginTop: '0.75rem',
        padding: '0.5rem 0.75rem',
        borderRadius: '8px',
        background: 'rgba(239,68,68,0.1)',
        border: '1px solid rgba(239,68,68,0.2)',
        color: 'var(--accent-danger, #ef4444)',
        fontSize: '0.8125rem',
        fontWeight: 500,
      }}
    >
      {text}
    </div>
  )
}

function SuccessMsg({ text }: { text: string }) {
  return (
    <div
      role="status"
      style={{
        marginTop: '0.75rem',
        padding: '0.5rem 0.75rem',
        borderRadius: '8px',
        background: 'rgba(16,185,129,0.1)',
        border: '1px solid rgba(16,185,129,0.2)',
        color: 'var(--accent-secondary, #10b981)',
        fontSize: '0.8125rem',
        fontWeight: 500,
      }}
    >
      {text}
    </div>
  )
}
