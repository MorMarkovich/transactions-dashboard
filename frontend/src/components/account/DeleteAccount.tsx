import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Trash2 } from 'lucide-react'
import { useAuth } from '../../lib/AuthContext'
import { supabase } from '../../lib/supabase'
import { isSampleActive, clearSampleSession } from '../../lib/sampleMode'
import { clearDeletedAccountStorage } from '../../lib/deleteAccountStorage'
import Button from '../ui/Button'
import Input from '../ui/Input'
import Modal from '../ui/Modal'

const OWNER_EMAIL = 'markovich23@gmail.com'
const CONFIRM_TEXT = 'מחק את החשבון'

export default function DeleteAccount() {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const inFlight = useRef(false)
  const protectedAccount = !user || user.email?.trim().toLowerCase() === OWNER_EMAIL || isSampleActive()

  if (protectedAccount) return null

  const close = () => {
    if (inFlight.current) return
    setOpen(false)
    setConfirmation('')
    setError('')
  }

  const remove = async () => {
    if (inFlight.current || confirmation !== CONFIRM_TEXT || protectedAccount) return
    inFlight.current = true
    setBusy(true)
    setError('')
    try {
      // No user id argument: the RPC can delete only auth.uid().
      const { error: rpcError } = await supabase.rpc('delete_my_account')
      if (rpcError) throw rpcError
      // Deletion already succeeded. A sign-out failure must not offer a retry
      // of the deletion or imply that the account is still present.
      try { await supabase.auth.signOut({ scope: 'local' }) } catch { /* no live account remains */ }
      clearSampleSession()
      clearDeletedAccountStorage(user.id)
      window.location.replace('/login?account_deleted=1')
    } catch {
      setError('לא הצלחנו למחוק את החשבון. לא התקבל אישור למחיקה. נסו שוב מאוחר יותר.')
      inFlight.current = false
      setBusy(false)
    }
  }

  return (
    <section dir="rtl" style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid var(--border-color)' }}>
      <h3 style={{ margin: '0 0 8px', color: 'var(--danger)' }}>מחיקת חשבון</h3>
      <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>
        מחיקה לצמיתות של החשבון וכל הנתונים שלו, כולל עסקאות, הכנסות והגדרות. לא ניתן לשחזר אותם.
      </p>
      <Button variant="danger" icon={<Trash2 size={16} />} onClick={() => setOpen(true)}>מחק את החשבון</Button>
      {createPortal(<Modal isOpen={open} onClose={close} title="מחיקת חשבון לצמיתות" size="sm">
        <div>
          <p style={{ lineHeight: 1.7 }}>החשבון {user.email} וכל הנתונים שלו יימחקו לצמיתות. הפעולה אינה ניתנת לביטול.</p>
          <Input label={`להמשך, הקלידו: ${CONFIRM_TEXT}`} aria-label="אישור מחיקת חשבון" value={confirmation} onChange={e => setConfirmation(e.target.value)} disabled={busy} autoComplete="off" />
          {error && <p role="alert" style={{ color: 'var(--danger)', lineHeight: 1.7 }}>{error}</p>}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 20 }}>
            <Button variant="secondary" onClick={close} disabled={busy}>ביטול</Button>
            <Button variant="danger" onClick={remove} disabled={confirmation !== CONFIRM_TEXT || busy} loading={busy}>מחק לצמיתות</Button>
          </div>
        </div>
      </Modal>, document.body)}
    </section>
  )
}
