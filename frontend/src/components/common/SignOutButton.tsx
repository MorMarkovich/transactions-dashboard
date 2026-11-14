import { useState } from 'react'
import { LogOut } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../lib/AuthContext'

export default function SignOutButton({ className }: { className: string }) {
  const { signOut } = useAuth()
  const navigate = useNavigate()
  const [pending, setPending] = useState(false)
  const [failed, setFailed] = useState(false)

  const handleSignOut = async () => {
    if (pending) return
    setPending(true)
    setFailed(false)
    try {
      await signOut()
      navigate('/login', { replace: true })
    } catch {
      setFailed(true)
    } finally {
      setPending(false)
    }
  }

  return <>
    <button type="button" className={className} aria-disabled={pending} onClick={handleSignOut}>
      <LogOut size={18} aria-hidden="true" />
      {pending ? 'מתנתק…' : 'התנתק'}
    </button>
    {failed && <p className="sign-out-error" role="alert">ההתנתקות נכשלה. אפשר לנסות שוב.</p>}
  </>
}
