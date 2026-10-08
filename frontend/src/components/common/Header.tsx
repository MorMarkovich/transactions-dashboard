import { Sun, Moon, Menu, X, Search, Orbit } from 'lucide-react'
import { NavLink, useSearchParams } from 'react-router-dom'
import { useTheme } from '../../context/ThemeContext'

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
  const [params] = useSearchParams()
  const session = params.get('session_id')
  const href = (to: string) => session ? `${to}?${new URLSearchParams({session_id:session})}` : to
  return <header className="app-topbar orbit-topbar">
    <NavLink to={href('/')} className="orbit-brand" aria-label="ORBIT - סקירה">
      <Orbit size={27}/><strong dir="ltr">ORBIT</strong><span>התמונה הפיננסית שלך</span>
    </NavLink>
    <nav className="orbit-nav" aria-label="ניווט ראשי">
      {ORBIT_NAV.map(({to,label})=><NavLink key={to} to={href(to)} end={to==='/'}>{label}</NavLink>)}
    </nav>
    <div className="orbit-tools">
      <button onClick={onCommandPalette} aria-label="חיפוש" title="חיפוש (Ctrl+K / ⌘K)"><Search size={18}/></button>
      <button onClick={toggleTheme} aria-label={theme==='dark'?'מעבר למצב בהיר':'מעבר למצב כהה'}>{theme==='dark'?<Sun size={18}/>:<Moon size={18}/>}</button>
      <button onClick={onToggleSidebar} aria-label={sidebarOpen?'סגור תפריט':'פתח תפריט'} aria-expanded={sidebarOpen}>{sidebarOpen?<X size={18}/>:<Menu size={18}/>}</button>
    </div>
  </header>
}
