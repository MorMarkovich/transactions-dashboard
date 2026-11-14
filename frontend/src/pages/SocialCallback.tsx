import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { LoaderCircle } from 'lucide-react'
import AuthFrame from '../components/common/AuthFrame'
import { completeSocialLogin, SOCIAL_CALLBACK_PATH } from '../lib/socialAuth'

export default function SocialCallback() {
  const navigate = useNavigate()
  const result = useRef<ReturnType<typeof completeSocialLogin> | null>(null)

  useEffect(() => {
    let active = true
    if (!result.current) {
      const url = new URL(window.location.href)
      window.history.replaceState(window.history.state, '', SOCIAL_CALLBACK_PATH)
      result.current = completeSocialLogin(url)
    }
    void result.current.then(({ returnTo, mode, error }) => {
      if (!active) return
      if (error) {
        navigate(mode === 'register' ? '/login?mode=register' : '/login', {
          replace: true, state: { from: returnTo, socialError: error },
        })
      } else {
        navigate(returnTo, { replace: true })
      }
    })
    return () => { active = false }
  }, [navigate])

  return (
    <AuthFrame title="מתחברים לפנקס" headingRef={element => element?.focus()}>
      <div className="auth-callback-status" role="status">
        <LoaderCircle className="animate-spin" size={20} aria-hidden="true" />
        משלימים את ההתחברות…
      </div>
    </AuthFrame>
  )
}
