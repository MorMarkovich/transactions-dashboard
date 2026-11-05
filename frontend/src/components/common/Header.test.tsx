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
 it('puts the account entry at the extreme left of the top bar',()=>{setup();const account=screen.getByRole('link',{name:'הגדרות חשבון - Mor M'});expect(account).toHaveAttribute('href','/account?session_id=real-session');const tools=account.closest('.orbit-tools');expect(tools).not.toBeNull();expect(tools!.lastElementChild).toBe(account)})
})
