import { useState } from 'react'
import { useAuth } from '../lib/AuthContext'
import { CreditCard, Mail, Lock, User, ArrowLeft, Loader2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

type Page = 'login' | 'register' | 'reset'

export default function Login() {
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

  const clearForm = () => { setEmail(''); setPassword(''); setPassword2(''); setName(''); setError(''); setSuccess(''); }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) { setError('נא למלא את כל השדות'); return }
    setLoading(true); setError('')
    const { error } = await signIn(email, password)
    if (error) setError(error)
    setLoading(false)
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name || !email || !password || !password2) { setError('נא למלא את כל השדות'); return }
    if (password !== password2) { setError('הסיסמאות לא תואמות'); return }
    if (password.length < 6) { setError('סיסמה חייבת להכיל 6+ תווים'); return }
    setLoading(true); setError('')
    const { error } = await signUp(email, password, name)
    if (error) { setError(error); setLoading(false); return }
    setSuccess('נרשמת בהצלחה! בדוק את המייל')
    setLoading(false)
    setTimeout(() => { clearForm(); setPage('login') }, 2000)
  }

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) { setError('נא להזין מייל'); return }
    setLoading(true); setError('')
    const { error } = await resetPassword(email)
    if (error) { setError(error); setLoading(false); return }
    setSuccess('נשלח קישור לאיפוס')
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'linear-gradient(135deg, #0b1120 0%, #1a1040 50%, #0b1120 100%)' }}>
      {/* Background orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 right-1/4 w-96 h-96 rounded-full opacity-20 blur-[120px]" style={{ background: '#818cf8' }} />
        <div className="absolute bottom-1/4 left-1/4 w-80 h-80 rounded-full opacity-15 blur-[100px]" style={{ background: '#a78bfa' }} />
      </div>

      <div className="relative z-10 w-full max-w-[920px] grid grid-cols-1 md:grid-cols-2 gap-0 md:gap-0">
        {/* Left: Branding */}
        <div className="hidden md:flex flex-col justify-center p-10">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-6" style={{ background: 'linear-gradient(135deg, #818cf8, #6d28d9)', boxShadow: '0 8px 32px rgba(129,140,248,0.3)' }}>
            <CreditCard className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-3xl font-extrabold text-white mb-3">מנתח עסקאות</h1>
          <p className="text-[#94a3b8] text-base leading-relaxed mb-8">
            ניתוח חכם של הוצאות כרטיס האשראי שלך. העלה קבצים מכל בנק, קבל תובנות מיידיות.
          </p>
          <div className="flex gap-6">
            {[
              { icon: '🔒', text: 'מוצפן ומאובטח' },
              { icon: '📊', text: 'ניתוח AI' },
              { icon: '☁️', text: 'שמירה בענן' },
            ].map((f, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-lg">{f.icon}</span>
                <span className="text-xs text-[#64748b]">{f.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Form Card */}
        <div className="rounded-3xl p-8 md:p-10" style={{ background: 'rgba(22,29,47,0.8)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.06)', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
          {/* Mobile logo */}
          <div className="md:hidden flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #818cf8, #6d28d9)' }}>
              <CreditCard className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-extrabold text-white">מנתח עסקאות</span>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={page}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.2 }}
            >
              {/* LOGIN */}
              {page === 'login' && (
                <form onSubmit={handleLogin}>
                  <h2 className="text-xl font-bold text-white mb-1">ברוך הבא 👋</h2>
                  <p className="text-sm text-[#94a3b8] mb-6">התחבר לחשבון שלך</p>

                  <div className="space-y-3">
                    <InputField icon={<Mail size={18} />} type="email" placeholder="אימייל" value={email} onChange={setEmail} />
                    <InputField icon={<Lock size={18} />} type="password" placeholder="סיסמה" value={password} onChange={setPassword} />
                  </div>

                  <button type="button" onClick={() => { clearForm(); setPage('reset') }} className="text-xs text-[#818cf8] hover:text-[#a78bfa] mt-2 block transition-colors">שכחתי סיסמה</button>

                  {error && <ErrorMsg text={error} />}

                  <GradientButton loading={loading} text="התחבר" />

                  <div className="flex items-center gap-3 my-5">
                    <div className="flex-1 h-px bg-white/5" />
                    <span className="text-xs text-[#64748b]">חדש כאן?</span>
                    <div className="flex-1 h-px bg-white/5" />
                  </div>

                  <button type="button" onClick={() => { clearForm(); setPage('register') }}
                    className="w-full py-2.5 rounded-xl text-sm font-semibold text-[#818cf8] border border-[#818cf8]/20 hover:bg-[#818cf8]/5 transition-all">
                    צור חשבון חדש
                  </button>
                </form>
              )}

              {/* REGISTER */}
              {page === 'register' && (
                <form onSubmit={handleRegister}>
                  <h2 className="text-xl font-bold text-white mb-1">יצירת חשבון ✨</h2>
                  <p className="text-sm text-[#94a3b8] mb-6">הרשמה תוך שניות</p>

                  <div className="space-y-3">
                    <InputField icon={<User size={18} />} placeholder="שם מלא" value={name} onChange={setName} />
                    <InputField icon={<Mail size={18} />} type="email" placeholder="אימייל" value={email} onChange={setEmail} />
                    <div className="grid grid-cols-2 gap-3">
                      <InputField icon={<Lock size={18} />} type="password" placeholder="סיסמה" value={password} onChange={setPassword} />
                      <InputField icon={<Lock size={18} />} type="password" placeholder="אימות" value={password2} onChange={setPassword2} />
                    </div>
                  </div>

                  {error && <ErrorMsg text={error} />}
                  {success && <SuccessMsg text={success} />}

                  <GradientButton loading={loading} text="צור חשבון" />

                  <button type="button" onClick={() => { clearForm(); setPage('login') }}
                    className="w-full mt-3 py-2 text-sm text-[#64748b] hover:text-white flex items-center justify-center gap-1 transition-colors">
                    <ArrowLeft size={14} /> חזור להתחברות
                  </button>
                </form>
              )}

              {/* RESET */}
              {page === 'reset' && (
                <form onSubmit={handleReset}>
                  <h2 className="text-xl font-bold text-white mb-1">איפוס סיסמה 🔑</h2>
                  <p className="text-sm text-[#94a3b8] mb-6">נשלח לך קישור למייל</p>

                  <InputField icon={<Mail size={18} />} type="email" placeholder="אימייל" value={email} onChange={setEmail} />

                  {error && <ErrorMsg text={error} />}
                  {success && <SuccessMsg text={success} />}

                  <GradientButton loading={loading} text="שלח קישור" />

                  <button type="button" onClick={() => { clearForm(); setPage('login') }}
                    className="w-full mt-3 py-2 text-sm text-[#64748b] hover:text-white flex items-center justify-center gap-1 transition-colors">
                    <ArrowLeft size={14} /> חזור
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

// --- Sub-components ---

function InputField({ icon, type = 'text', placeholder, value, onChange }: {
  icon: React.ReactNode; type?: string; placeholder: string; value: string; onChange: (v: string) => void
}) {
  return (
    <div className="relative">
      <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[#64748b]">{icon}</div>
      <input
        type={type} placeholder={placeholder} value={value} onChange={e => onChange(e.target.value)}
        className="w-full bg-[#1e2740] border border-white/6 rounded-xl py-3 pr-10 pl-4 text-sm text-white placeholder-[#4a5568] outline-none focus:border-[#818cf8] focus:ring-2 focus:ring-[#818cf8]/10 transition-all"
      />
    </div>
  )
}

function GradientButton({ loading, text }: { loading: boolean; text: string }) {
  return (
    <button type="submit" disabled={loading}
      className="w-full mt-5 py-3 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-60"
      style={{ background: 'linear-gradient(135deg, #818cf8, #6d28d9)', boxShadow: '0 4px 20px rgba(129,140,248,0.25)' }}>
      {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : text}
    </button>
  )
}

function ErrorMsg({ text }: { text: string }) {
  return <div className="mt-3 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium">{text}</div>
}

function SuccessMsg({ text }: { text: string }) {
  return <div className="mt-3 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">{text}</div>
}
