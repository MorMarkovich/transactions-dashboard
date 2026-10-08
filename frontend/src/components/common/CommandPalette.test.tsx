import {describe,it,expect,vi} from 'vitest'
import {render,screen,fireEvent} from '@testing-library/react'
import {MemoryRouter} from 'react-router-dom'
import {ThemeProvider} from '../../context/ThemeContext'
import CommandPalette from './CommandPalette'
HTMLElement.prototype.scrollIntoView = vi.fn()
describe('Orbit command search',()=>{
 it.each(['סקירה','ניהול מידע','חיסכון'])('finds the navigation label %s',label=>{render(<MemoryRouter><ThemeProvider><CommandPalette isOpen onClose={()=>{}}/></ThemeProvider></MemoryRouter>);fireEvent.change(screen.getByPlaceholderText('חפש עמוד או פעולה...'),{target:{value:label}});expect(screen.getByRole('button',{name: new RegExp(label)})).toBeInTheDocument()})
 it('Escape dismisses only the palette layer',()=>{const close=vi.fn(),background=vi.fn();render(<div onKeyDown={background}><MemoryRouter><ThemeProvider><CommandPalette isOpen onClose={close}/></ThemeProvider></MemoryRouter></div>);fireEvent.keyDown(screen.getByPlaceholderText('חפש עמוד או פעולה...'),{key:'Escape'});expect(close).toHaveBeenCalledOnce();expect(background).not.toHaveBeenCalled()})
})
