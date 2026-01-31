import { ReactNode, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import Header from './Header'
import Sidebar from './Sidebar'
import './Layout.css'

interface LayoutProps {
  children: ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const sessionId = searchParams.get('session_id')
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(sessionId)

  const handleFileUploaded = (newSessionId: string) => {
    setCurrentSessionId(newSessionId)
    navigate(`/?session_id=${newSessionId}`)
  }

  return (
    <div className="layout">
      <Header />
      <div className="layout-content">
        <Sidebar sessionId={currentSessionId} onFileUploaded={handleFileUploaded} />
        <main className="main-content">
          {children}
        </main>
      </div>
    </div>
  )
}
