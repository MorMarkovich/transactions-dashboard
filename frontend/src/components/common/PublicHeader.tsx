import type { ReactNode } from 'react'
import { Moon, Sun } from 'lucide-react'
import { useTheme } from '../../context/ThemeContext'
import PinkasBrand from './PinkasBrand'

interface PublicHeaderProps {
  children?: ReactNode
  actions: ReactNode
}

export default function PublicHeader({ children, actions }: PublicHeaderProps) {
  const { theme, toggleTheme } = useTheme()
  const themeLabel = theme === 'dark' ? 'מעבר למצב בהיר' : 'מעבר למצב כהה'

  return (
    <header className="pinkas-public-header">
      <div className="pinkas-public-nav pinkas-public-width">
        <PinkasBrand />
        {children}
        <div className="pinkas-public-actions">
          {actions}
          <button type="button" className="pinkas-theme-toggle" onClick={toggleTheme} aria-label={themeLabel} title={themeLabel}>
            {theme === 'dark' ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
          </button>
        </div>
      </div>
    </header>
  )
}
