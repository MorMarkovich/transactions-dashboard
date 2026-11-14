import { Sun, Moon, Menu, X, Search, PanelsTopLeft } from 'lucide-react'
import { NavLink, useSearchParams } from 'react-router-dom'
import { useTheme } from '../../context/ThemeContext'
import { useAuth } from '../../lib/AuthContext'

interface HeaderProps {
  onToggleSidebar?: () => void
  sidebarOpen?: boolean
  onCommandPalette?: () => void
}
export const ORBIT_NAV = [
  {to:'/',label:'סקירה'}, {to:'/transactions',label:'עסקאות'},
  {to:'/monthly',label:'השוואת חודשים'}, {to:'/trends',label:'מגמות'},
  {to:'/merchants',label:'בתי עסק'}, {to:'/budget',label:'תקציב'},
  {to:'/income',label:'הכנסות'}, {to:'/savings',label:'חיסכון'},
  {to:'/data-management',label:'ניהול מידע'},
]
export default function Header({ onToggleSidebar, sidebarOpen, onCommandPalette }: HeaderProps) {
  const { theme, toggleTheme } = useTheme()
  const { user } = useAuth()
  const [params] = useSearchParams()
  const session = params.get('session_id')
  const href = (to: string) => session ? `${to}?${new URLSearchParams({session_id:session})}` : to

  const displayName =
    (user?.user_metadata?.full_name as string | undefined) ||
    user?.email?.split('@')[0] ||
    'משתמש'
  const initials = displayName
    .split(' ')
    .map((w: string) => w[0])
    .join('')
    .slice(0, 2)

  return <header className="app-topbar orbit-topbar">
    <NavLink to={href('/')} className="orbit-brand" aria-label="פנקס - סקירה">
      <span className="pinkas-mark"><PanelsTopLeft size={19} aria-hidden="true" /></span><strong>פנקס</strong>
    </NavLink>
    <nav className="orbit-nav" aria-label="ניווט ראשי">
      {ORBIT_NAV.map(({to,label})=><NavLink key={to} to={href(to)} end={to==='/'}>{label}</NavLink>)}
    </nav>
    <div className="orbit-tools">
      <button onClick={onCommandPalette} aria-label="חיפוש" title="חיפוש (Ctrl+K / ⌘K)"><Search size={18}/></button>
      <button onClick={toggleTheme} aria-label={theme==='dark'?'מעבר למצב בהיר':'מעבר למצב כהה'}>{theme==='dark'?<Sun size={18}/>:<Moon size={18}/>}</button>
      <button onClick={onToggleSidebar} aria-label={sidebarOpen?'סגור תפריט':'פתח תפריט'} aria-expanded={sidebarOpen}>{sidebarOpen?<X size={18}/>:<Menu size={18}/>}</button>
      {/* Account entry: last child of the tools row = the extreme LEFT corner
          of the top bar in this RTL layout. Do not move it into the drawer. */}
      <NavLink
        to={href('/account')}
        className={({ isActive }) => `orbit-account${isActive ? ' active' : ''}`}
        aria-label={`הגדרות חשבון - ${displayName}`}
        title="הגדרות חשבון"
      >
        <span className="orbit-account-avatar" aria-hidden="true">{initials}</span>
        <span className="orbit-account-name">{displayName}</span>
      </NavLink>
    </div>
  </header>
}
