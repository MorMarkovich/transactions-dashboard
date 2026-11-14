import { useEffect, useRef } from 'react'
import { Sun, Moon, Menu, X, Search, PanelsTopLeft, ChevronDown, Settings } from 'lucide-react'
import { NavLink, useSearchParams } from 'react-router-dom'
import { useTheme } from '../../context/ThemeContext'
import { useAuth } from '../../lib/AuthContext'
import SignOutButton from './SignOutButton'

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
  const accountMenu = useRef<HTMLDetailsElement>(null)
  const accountTrigger = useRef<HTMLElement>(null)

  useEffect(() => {
    const menu = accountMenu.current
    if (!menu) return
    const closeOnOutsidePress = (event: PointerEvent) => {
      if (!menu.contains(event.target as Node)) menu.open = false
    }
    document.addEventListener('pointerdown', closeOnOutsidePress)
    return () => document.removeEventListener('pointerdown', closeOnOutsidePress)
  }, [])

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
      <details
        className="orbit-account-menu"
        ref={accountMenu}
        onBlur={event => {
          if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) {
            event.currentTarget.open = false
          }
        }}
        onKeyDown={event => {
          if (event.key !== 'Escape' || !event.currentTarget.open) return
          event.stopPropagation()
          event.currentTarget.open = false
          accountTrigger.current?.focus()
        }}
      >
        <summary className="orbit-account" ref={accountTrigger} aria-label={`תפריט חשבון - ${displayName}`}>
          <span className="orbit-account-avatar" aria-hidden="true">{initials}</span>
          <span className="orbit-account-name">{displayName}</span>
          <ChevronDown size={14} aria-hidden="true" />
        </summary>
        <div className="orbit-account-actions">
          <NavLink
            to={href('/account')}
            onClick={() => { if (accountMenu.current) accountMenu.current.open = false }}
          >
            <Settings size={18} aria-hidden="true" />
            הגדרות חשבון
          </NavLink>
          <SignOutButton className="orbit-account-sign-out" />
        </div>
      </details>
    </div>
  </header>
}
