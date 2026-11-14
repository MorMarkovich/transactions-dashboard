import {describe,it,expect,vi} from 'vitest'
import {render,screen,fireEvent} from '@testing-library/react'
import {MemoryRouter} from 'react-router-dom'
import Header, {ORBIT_NAV} from './Header'
import {ThemeProvider} from '../../context/ThemeContext'
vi.mock('../../lib/AuthContext',()=>({useAuth:()=>({user:{email:'mor@example.com',user_metadata:{full_name:'Mor M'}}})}))
const setup=(props={})=>render(<MemoryRouter initialEntries={['/income?session_id=real-session']}><ThemeProvider><Header {...props}/></ThemeProvider></MemoryRouter>)
describe('Orbit navigation',()=>{
 it('keeps all nine real pages and the session in horizontal navigation',()=>{setup();const nav=screen.getByRole('navigation',{name:'ניווט ראשי'});expect(nav.querySelectorAll('a')).toHaveLength(9);for(const {to,label} of ORBIT_NAV)expect(screen.getByRole('link',{name:label})).toHaveAttribute('href',`${to}?session_id=real-session`);expect(screen.getByRole('link',{name:'הכנסות'})).toHaveAttribute('aria-current','page')})
 it('keeps search, theme and the management drawer accessible',()=>{const search=vi.fn(),drawer=vi.fn();setup({onCommandPalette:search,onToggleSidebar:drawer});fireEvent.click(screen.getByRole('button',{name:'חיפוש'}));expect(search).toHaveBeenCalledOnce();fireEvent.click(screen.getByRole('button',{name:'פתח תפריט'}));expect(drawer).toHaveBeenCalledOnce();fireEvent.click(screen.getByRole('button',{name:'מעבר למצב בהיר'}));expect(screen.getByRole('button',{name:'מעבר למצב כהה'})).toBeInTheDocument()})
 it('puts the account menu at the extreme left and preserves the settings link', () => {
   setup()
   const trigger = screen.getByLabelText('תפריט חשבון - Mor M')
   const menu = trigger.closest('details')!
   expect(menu).toBe(menu.closest('.orbit-tools')?.lastElementChild)
   expect(menu).not.toHaveAttribute('open')
   fireEvent.click(trigger)
   expect(menu).toHaveAttribute('open')
   expect(screen.getByRole('link', { name: 'הגדרות חשבון' })).toHaveAttribute('href', '/account?session_id=real-session')
   expect(screen.getByRole('button', { name: 'התנתק' })).toBeVisible()
   fireEvent.keyDown(trigger, { key: 'Escape' })
   expect(menu).not.toHaveAttribute('open')
   expect(trigger).toHaveFocus()
 })
})
