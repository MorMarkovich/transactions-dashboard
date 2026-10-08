import {describe,it,expect} from 'vitest'
import {render,screen} from '@testing-library/react'
import {defaultMonth} from './defaultMonth'
import {formatCurrency,formatDate,ltrIsolate} from './formatting'
import {categoryColor} from './chartPalette'
import AnimatedNumber from '../components/ui/AnimatedNumber'
describe('studio display invariants',()=>{
 const now=new Date('2026-10-08T12:00:00Z')
 it('does not default to a future billing month',()=>expect(defaultMonth(['09/2026','10/2026','11/2026'],null,now)).toBe('10/2026'))
 it('preserves the user choice even if it is future',()=>expect(defaultMonth(['10/2026','11/2026'],'11/2026',now)).toBe('11/2026'))
 it('falls back to the last available non-future month',()=>expect(defaultMonth(['08/2026','09/2026','11/2026'],'missing',now)).toBe('09/2026'))
 it('sorts months chronologically across years',()=>expect(defaultMonth(['01/2026','12/2025'],null,now)).toBe('01/2026'))
 it('handles empty data',()=>expect(defaultMonth([],null,now)).toBeNull())
 it('isolates signed currency and zero',()=>{expect(formatCurrency(-1234.5)).toBe(ltrIsolate('-₪1,234.50'));expect(formatCurrency(0)).toBe(ltrIsolate('₪0'));expect(formatCurrency(5,true)).toBe(ltrIsolate('+₪5.00'))})
 it('isolates dates',()=>expect(formatDate('2026-10-08')).toBe(ltrIsolate('08/10/2026')))
 it('shows the exact value on first render',()=>{render(<AnimatedNumber value={33311.19} formatter={formatCurrency}/>);expect(screen.getByText(formatCurrency(33311.19))).toBeInTheDocument()})
 it('keeps category colors stable independent of list position',()=>expect(categoryColor('אוכל')).toBe(categoryColor('אוכל')))
})
