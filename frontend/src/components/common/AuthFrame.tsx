import type { ReactNode, Ref } from 'react'
import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import PublicHeader from './PublicHeader'

interface AuthFrameProps {
  title: string
  description?: string
  headingRef?: Ref<HTMLHeadingElement>
  children: ReactNode
}

export default function AuthFrame({ title, description, headingRef, children }: AuthFrameProps) {
  return (
    <div className="pinkas-auth" dir="rtl">
      <a href="#main-content" className="pinkas-skip">דילוג לתוכן</a>
      <PublicHeader actions={<Link to="/" className="auth-home-link"><ArrowRight size={16} aria-hidden="true" /> לעמוד הבית</Link>} />
      <main id="main-content" className="pinkas-auth-main">
        <div className="pinkas-auth-card">
          <div className="pinkas-auth-heading">
            <h1 tabIndex={-1} ref={headingRef}>{title}</h1>
            {description && <p>{description}</p>}
          </div>
          {children}
        </div>
      </main>
    </div>
  )
}
