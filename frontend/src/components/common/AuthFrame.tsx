import type { ReactNode, Ref } from 'react'
import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import PinkasBrand from './PinkasBrand'

interface AuthFrameProps {
  title: string
  description?: string
  headingRef?: Ref<HTMLHeadingElement>
  children: ReactNode
}

export default function AuthFrame({ title, description, headingRef, children }: AuthFrameProps) {
  return (
    <div className="pinkas-auth" dir="rtl">
      <header className="pinkas-auth-nav landing-width">
        <PinkasBrand />
        <Link to="/" className="auth-home-link"><ArrowRight size={16} /> לעמוד הבית</Link>
      </header>
      <main className="pinkas-auth-main">
        <h1 tabIndex={-1} ref={headingRef}>{title}</h1>
        {description && <p>{description}</p>}
        <div className="pinkas-auth-card">{children}</div>
      </main>
    </div>
  )
}
