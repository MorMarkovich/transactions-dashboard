import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Lock, CheckCircle2 } from 'lucide-react'
import { useAuth } from '../lib/AuthContext'
import Input from '../components/ui/Input'
import Button from '../components/ui/Button'

export default function ResetPassword() {
  const navigate = useNavigate()
  const { user, loading, passwordRecovery, updatePassword, clearPasswordRecovery, signOut } = useAuth()

  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // If the user lands here without a recovery token AND isn't already in a
  // recovery flow, send them to login. Wait for auth to load first.
  useEffect(() => {
    if (loading) return
    if (!passwordRecovery && !user) {
      navigate('/login', { replace: true })
    }
  }, [loading, passwordRecovery, user, navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password.length < 6) {
      setError('סיסמה חייבת להכיל 6+ תווים')
      return
    }
    if (password !== password2) {
      setError('הסיסמאות אינן תואמות')
      return
    }

    setSubmitting(true)
    const { error: err } = await updatePassword(password)
    setSubmitting(false)

    if (err) {
      setError(err)
      return
    }
    setSuccess(true)
    clearPasswordRecovery()
    // Sign out so the user has to log in with the new password (clearer UX).
    setTimeout(async () => {
      await signOut()
      navigate('/login', { replace: true })
    }, 1800)
  }

  if (loading) return null

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        direction: 'rtl',
        background: 'var(--bg-primary)',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '420px',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderRadius: '16px',
          padding: '32px 28px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
        }}
      >
        <h1
          style={{
            margin: '0 0 8px',
            fontSize: '1.5rem',
            fontWeight: 700,
            color: 'var(--text-primary)',
          }}
        >
          איפוס סיסמה
        </h1>
        <p
          style={{
            margin: '0 0 24px',
            fontSize: '0.9rem',
            color: 'var(--text-secondary)',
          }}
        >
          הזן סיסמה חדשה לחשבון שלך
        </p>

        {success ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '14px',
              borderRadius: '10px',
              background: 'rgba(34, 197, 94, 0.1)',
              border: '1px solid rgba(34, 197, 94, 0.3)',
              color: 'var(--text-primary)',
              fontSize: '0.9rem',
            }}
          >
            <CheckCircle2 size={20} color="rgb(34, 197, 94)" />
            הסיסמה עודכנה. מעביר אותך לכניסה...
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <Input
                type="password"
                placeholder="סיסמה חדשה"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                icon={<Lock size={18} />}
                aria-label="סיסמה חדשה"
                autoComplete="new-password"
              />
              <Input
                type="password"
                placeholder="אישור סיסמה"
                value={password2}
                onChange={(e) => setPassword2(e.target.value)}
                icon={<Lock size={18} />}
                aria-label="אישור סיסמה"
                autoComplete="new-password"
              />
            </div>

            {error && (
              <p
                role="alert"
                style={{
                  margin: '12px 0 0',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: 'rgb(239, 68, 68)',
                  fontSize: '0.85rem',
                }}
              >
                {error}
              </p>
            )}

            <Button
              type="submit"
              disabled={submitting}
              style={{ width: '100%', marginTop: '20px' }}
            >
              {submitting ? 'מעדכן...' : 'עדכן סיסמה'}
            </Button>
          </form>
        )}
      </div>
    </div>
  )
}
