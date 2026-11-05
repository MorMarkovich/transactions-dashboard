import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { User, Mail, Lock, Trash2 } from 'lucide-react'
import Card from '../components/ui/Card'
import Input from '../components/ui/Input'
import Button from '../components/ui/Button'

// ---------------------------------------------------------------------------
// Signed-in account management: display name, email change (confirmed by
// email), password change. Account/data deletion lives in Data Management.
// ---------------------------------------------------------------------------
export default function AccountSettings() {
  const { user, updateDisplayName, updateEmail, updatePassword } = useAuth()

  const currentName = (user?.user_metadata?.full_name as string | undefined) || ''
  const currentEmail = user?.email || ''

  // Profile
  const [name, setName] = useState(currentName)
  const [nameMsg, setNameMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [nameLoading, setNameLoading] = useState(false)

  // Email
  const [newEmail, setNewEmail] = useState('')
  const [emailMsg, setEmailMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [emailLoading, setEmailLoading] = useState(false)

  // Password
  const [pw1, setPw1] = useState('')
  const [pw2, setPw2] = useState('')
  const [pwMsg, setPwMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [pwLoading, setPwLoading] = useState(false)

  useEffect(() => {
    document.title = 'הגדרות חשבון | פנקס'
    return () => { document.title = 'פנקס' }
  }, [])

  const initials = (currentName || currentEmail.split('@')[0] || 'מ')
    .split(' ').map((w) => w[0]).join('').slice(0, 2)

  const handleNameSave = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) { setNameMsg({ kind: 'err', text: 'נא להזין שם' }); return }
    if (trimmed === currentName) { setNameMsg({ kind: 'err', text: 'השם לא השתנה' }); return }
    setNameLoading(true)
    setNameMsg(null)
    const { error } = await updateDisplayName(trimmed)
    setNameLoading(false)
    setNameMsg(error ? { kind: 'err', text: error } : { kind: 'ok', text: 'השם עודכן' })
  }

  const handleEmailSave = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = newEmail.trim()
    if (!trimmed) { setEmailMsg({ kind: 'err', text: 'נא להזין כתובת מייל חדשה' }); return }
    if (trimmed.toLowerCase() === currentEmail.toLowerCase()) { setEmailMsg({ kind: 'err', text: 'זוהי כתובת המייל הנוכחית' }); return }
    setEmailLoading(true)
    setEmailMsg(null)
    const { error } = await updateEmail(trimmed)
    setEmailLoading(false)
    if (error) { setEmailMsg({ kind: 'err', text: error }); return }
    setNewEmail('')
    setEmailMsg({ kind: 'ok', text: `נשלחו מיילי אימות גם לכתובת הנוכחית וגם אל ${trimmed}. השינוי יושלם רק אחרי אישור הקישור בשניהם.` })
  }

  const handlePasswordSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!pw1 || !pw2) { setPwMsg({ kind: 'err', text: 'נא למלא את כל השדות' }); return }
    if (pw1.length < 6) { setPwMsg({ kind: 'err', text: 'סיסמה חייבת להכיל 6+ תווים' }); return }
    if (pw1 !== pw2) { setPwMsg({ kind: 'err', text: 'הסיסמאות לא תואמות' }); return }
    setPwLoading(true)
    setPwMsg(null)
    const { error } = await updatePassword(pw1)
    setPwLoading(false)
    if (error) { setPwMsg({ kind: 'err', text: error }); return }
    setPw1('')
    setPw2('')
    setPwMsg({ kind: 'ok', text: 'הסיסמה עודכנה' })
  }

  return (
    <div dir="rtl" style={{ maxWidth: '640px', marginInline: 'auto', padding: '24px 16px 48px' }}>
      <h1 style={{ margin: '0 0 4px', fontSize: '1.375rem', fontWeight: 800, color: 'var(--text-primary)' }}>
        הגדרות חשבון
      </h1>
      <p style={{ margin: '0 0 20px', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
        ניהול פרטי ההתחברות והפרופיל שלך
      </p>

      {/* Profile */}
      <Card padding="md" className="glass-card">
        <SectionTitle icon={<User size={16} />} title="פרופיל" />
        <p style={{ margin: '0 0 12px', fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          השם מוצג באפליקציה בלבד; ההתחברות תמיד מתבצעת עם כתובת המייל.
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
          <div
            aria-hidden="true"
            style={{
              width: '44px', height: '44px', borderRadius: '9999px', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'linear-gradient(135deg, #818cf8, #6d28d9)', color: '#fff', fontWeight: 700,
            }}
          >
            {initials}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9375rem' }}>{currentName || '—'}</div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', direction: 'ltr', textAlign: 'right' }}>{currentEmail}</div>
          </div>
        </div>
        <form onSubmit={handleNameSave} noValidate style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '180px' }}>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="שם מלא (מוצג באפליקציה)"
              icon={<User size={18} />}
              aria-label="שם מלא"
              autoComplete="name"
            />
          </div>
          <Button type="submit" variant="primary" size="md" loading={nameLoading}>שמור</Button>
        </form>
        <Msg msg={nameMsg} />
      </Card>

      {/* Email */}
      <Card padding="md" className="glass-card">
        <SectionTitle icon={<Mail size={16} />} title="כתובת מייל" />
        <p style={{ margin: '0 0 12px', fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          זוהי הכתובת שמשמשת להתחברות: <span dir="ltr">{currentEmail}</span>. לאחר השמירה נשלח מייל אימות גם לכתובת הנוכחית וגם לחדשה, והשינוי נכנס לתוקף רק אחרי אישור בשתיהן.
        </p>
        <form onSubmit={handleEmailSave} noValidate style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '180px' }}>
            <Input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="מייל חדש"
              icon={<Mail size={18} />}
              aria-label="כתובת מייל חדשה"
              autoComplete="email"
            />
          </div>
          <Button type="submit" variant="primary" size="md" loading={emailLoading}>עדכן מייל</Button>
        </form>
        <Msg msg={emailMsg} />
      </Card>

      {/* Password */}
      <Card padding="md" className="glass-card">
        <SectionTitle icon={<Lock size={16} />} title="סיסמה" />
        <form onSubmit={handlePasswordSave} noValidate>
          <div className="space-y-3">
            <Input
              type="password"
              value={pw1}
              onChange={(e) => setPw1(e.target.value)}
              placeholder="סיסמה חדשה"
              icon={<Lock size={18} />}
              aria-label="סיסמה חדשה"
              autoComplete="new-password"
            />
            <Input
              type="password"
              value={pw2}
              onChange={(e) => setPw2(e.target.value)}
              placeholder="אימות סיסמה חדשה"
              icon={<Lock size={18} />}
              aria-label="אימות סיסמה חדשה"
              autoComplete="new-password"
            />
          </div>
          <div style={{ marginTop: '12px' }}>
            <Button type="submit" variant="primary" size="md" loading={pwLoading}>עדכן סיסמה</Button>
          </div>
        </form>
        <Msg msg={pwMsg} />
      </Card>

      {/* Danger zone pointer */}
      <Card padding="md" className="glass-card">
        <SectionTitle icon={<Trash2 size={16} />} title="מחיקת חשבון" />
        <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          מחיקת החשבון והנתונים זמינה בעמוד{' '}
          <Link to="/data-management" style={{ color: 'var(--accent)', fontWeight: 600 }}>ניהול מידע</Link>.
        </p>
      </Card>
    </div>
  )
}

function SectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
      <span style={{ color: 'var(--accent-primary, #818cf8)', display: 'inline-flex' }}>{icon}</span>
      <h2 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-primary)' }}>{title}</h2>
    </div>
  )
}

function Msg({ msg }: { msg: { kind: 'ok' | 'err'; text: string } | null }) {
  if (!msg) return null
  const ok = msg.kind === 'ok'
  return (
    <div
      role={ok ? 'status' : 'alert'}
      style={{
        marginTop: '0.75rem', padding: '0.5rem 0.75rem', borderRadius: '8px', fontSize: '0.8125rem', fontWeight: 500,
        background: ok ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
        border: ok ? '1px solid rgba(16,185,129,0.2)' : '1px solid rgba(239,68,68,0.2)',
        color: ok ? 'var(--success)' : 'var(--accent-danger, #ef4444)',
      }}
    >
      {msg.text}
    </div>
  )
}
