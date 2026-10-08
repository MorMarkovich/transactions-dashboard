import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { previousMonth, spendingChange, categoryChanges } from './monthComparison'
import MonthlyPulse from '../components/dashboard/MonthlyPulse'
import { transactionsApi } from '../services/api'
vi.mock('../services/api', () => ({ transactionsApi: { scopeSession: vi.fn(), getMonthOverview: vi.fn() } }))
const current = {month:'10/2026', total_expenses:200, total_income:500, transaction_count:3, categories:[{name:'אוכל',expenses:200,income:0}]}
const prior = {month:'09/2026', total_expenses:100, total_income:500, transaction_count:2, categories:[{name:'אוכל',expenses:100,income:0}]}
const props = {userId:'test-user',sessionId:'sid',month:'10/2026',overview:current,loading:false,dateType:'billing' as const,owner:null,category:'',subcategories:[],refreshKey:0,onApplyView:vi.fn(),onCategory:vi.fn(),onTransactions:vi.fn()}
beforeEach(() => { localStorage.clear(); vi.clearAllMocks(); vi.mocked(transactionsApi.scopeSession).mockResolvedValue('scoped'); vi.mocked(transactionsApi.getMonthOverview).mockResolvedValue(prior) })
describe('calendar comparisons', () => {
  it('crosses year boundaries', () => expect(previousMonth('01/2026')).toBe('12/2025'))
  it('does not skip a missing month', () => expect(previousMonth('10/2026')).toBe('09/2026'))
  it('rejects malformed months', () => { expect(previousMonth('13/2026')).toBeNull(); expect(previousMonth('x')).toBeNull() })
  it('never invents a percentage from zero', () => expect(spendingChange(200,0)).toEqual({amount:200,percent:null}))
  it('handles decreases and unchanged spend', () => { expect(spendingChange(50,100).percent).toBe(-50); expect(spendingChange(100,100).amount).toBe(0) })
  it('includes categories removed since last month', () => expect(categoryChanges({...current,categories:[]},prior)[0].amount).toBe(-100))
})
describe('MonthlyPulse', () => {
  it('renders three separate cards with exact real-data amounts and a negative net', () => {
    const {container}=render(<MonthlyPulse {...props} overview={{...current,total_expenses:39184.66,total_income:32071.59,transaction_count:143}}/>);
    expect(container.querySelector('.pulse-first-row')?.children).toHaveLength(3);
    expect(container.querySelector('.pulse-spending')?.textContent).toContain('39,184.66');
    expect(container.querySelector('.pulse-income')?.textContent).toContain('32,071.59');
    expect(container.querySelector('.pulse-net')?.textContent).toContain('-₪7,113.07');
    expect(container.querySelector('.pulse-net .amount-negative')).toBeInTheDocument();
  })
  it('uses the same scope and date basis for comparison', async () => { render(<MonthlyPulse {...props} category="אוכל" subcategories={['סופרים קטנים']} owner="מור"/>); await waitFor(() => expect(transactionsApi.getMonthOverview).toHaveBeenCalledWith('scoped','09/2026','billing',expect.any(AbortSignal))); expect(transactionsApi.scopeSession).toHaveBeenCalledWith('sid','מור',expect.any(AbortSignal),'אוכל',['סופרים קטנים']); expect(screen.getByText('לא יתרת חשבון הבנק')).toBeInTheDocument() })
  it('opens the category drilldown', async () => { render(<MonthlyPulse {...props}/>); fireEvent.click(await screen.findByRole('button',{name:/אוכל/})); expect(props.onCategory).toHaveBeenCalledWith('אוכל') })
  it('saves and reapplies filters without pinning the month', async () => { render(<MonthlyPulse {...props} category="אוכל"/>); fireEvent.click(screen.getByText('תצוגות שמורות')); fireEvent.change(screen.getByLabelText('שם התצוגה'),{target:{value:'בית'}}); fireEvent.click(screen.getByText('שמור תצוגה')); fireEvent.click(screen.getByRole('button',{name:'בית'})); expect(props.onApplyView).toHaveBeenCalledWith(expect.objectContaining({name:'בית',category:'אוכל'})); expect(JSON.parse(localStorage.getItem('dashboard-views:test-user')!)[0]).not.toHaveProperty('month'); fireEvent.click(screen.getByLabelText('מחק תצוגה בית')); expect(localStorage.getItem('dashboard-views:test-user')).toBe('[]') })
  it('shows missing history instead of a fabricated comparison', async () => { vi.mocked(transactionsApi.getMonthOverview).mockResolvedValue({...prior,transaction_count:0}); render(<MonthlyPulse {...props}/>); expect(await screen.findByText('אין עסקאות בחודש הקודם להשוואה')).toBeInTheDocument() })
  it('does not show stale current month amounts', () => { render(<MonthlyPulse {...props} month="11/2026" loading={true}/>); expect(screen.getByText('טוען...')).toBeInTheDocument() })
  it('surfaces a comparison request failure', async () => { vi.mocked(transactionsApi.getMonthOverview).mockRejectedValue(new Error('offline')); render(<MonthlyPulse {...props}/>); expect(await screen.findByText('ההשוואה אינה זמינה כרגע')).toBeInTheDocument() })
})
