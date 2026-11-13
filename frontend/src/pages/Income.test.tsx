import { describe, expect, it, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { IncomeAnalysisData } from '../services/types'

const getIncomeAnalysis = vi.fn()
vi.mock('../lib/supabase', () => ({ supabase: {} }))
vi.mock('../services/api', () => ({
  transactionsApi: { getIncomeAnalysis: (...a: unknown[]) => getIncomeAnalysis(...a) },
}))
// Recharts needs layout sizes jsdom cannot provide; the charts are not under test here.
vi.mock('../components/charts/BarChart', () => ({ default: () => <div data-testid="bar-chart" /> }))

import Income from './Income'

const rows = [
  { id: 1, date: '2026-10-24', source: 'בנק פועלים משכורת', amount: 14500, category: 'שונות', subcategory: '', account: 'isracard', notes: 'תלוש אוקטובר', month: '10/2026' },
  { id: 2, date: '2026-10-23', source: 'FREELANCE PAYMENT', amount: 900, category: 'שונות', subcategory: '', account: 'isracard', notes: '', month: '10/2026' },
]
const payload: IncomeAnalysisData = {
  transactions: rows as IncomeAnalysisData['transactions'],
  total: 15400, count: 2, average: 7700,
  months: [{ name: '10/2026', value: 15400, count: 2 }],
  sources: [{ name: 'בנק פועלים משכורת', value: 14500, count: 1 }, { name: 'FREELANCE PAYMENT', value: 900, count: 1 }],
  categories: [{ name: 'שונות', value: 15400, count: 2 }],
} as IncomeAnalysisData

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/income?session_id=test-session']}>
      <Income />
    </MemoryRouter>,
  )
}

async function expandFirstRow() {
  await waitFor(() => expect(screen.getByText('כל ההכנסות (2)')).toBeTruthy())
  fireEvent.click(screen.getByText('בנק פועלים משכורת', { selector: 'td strong bdi' }).closest('tr')!)
  await waitFor(() => expect(screen.getByText('תלוש אוקטובר')).toBeTruthy())
}

describe('Income page interaction state', () => {
  beforeEach(() => {
    getIncomeAnalysis.mockReset()
    getIncomeAnalysis.mockResolvedValue(payload)
  })

  it('closes the expanded detail when a search filters its row out', async () => {
    renderPage()
    await expandFirstRow()
    fireEvent.change(screen.getByPlaceholderText('מקור, חשבון או הערה'), { target: { value: 'zzz-no-match' } })
    await waitFor(() => expect(screen.queryByText('תלוש אוקטובר')).toBeNull())
    expect(screen.getByText(/אין הכנסות שמתאימות/)).toBeTruthy()
  })

  it('keeps the expanded detail while its row still matches the search', async () => {
    renderPage()
    await expandFirstRow()
    fireEvent.change(screen.getByPlaceholderText('מקור, חשבון או הערה'), { target: { value: 'משכורת' } })
    await new Promise((r) => setTimeout(r, 50))
    expect(screen.getByText('תלוש אוקטובר')).toBeTruthy()
  })

  it('closes the expanded detail when a server filter change removes its row', async () => {
    renderPage()
    await expandFirstRow()
    getIncomeAnalysis.mockResolvedValueOnce({ ...payload, transactions: [payload.transactions[1]], count: 1, total: 900, average: 900 })
    // open the source dropdown and pick FREELANCE
    const trigger = screen.getAllByRole('combobox', { expanded: false }).find((el) => el.getAttribute('aria-label') === 'מקור')!
    fireEvent.click(trigger)
    fireEvent.click(await screen.findByRole('option', { name: /FREELANCE PAYMENT/ }))
    await waitFor(() => expect(screen.queryByText('תלוש אוקטובר')).toBeNull())
  })

  it('shows a retryable error state instead of a misleading empty state when the load fails', async () => {
    getIncomeAnalysis.mockRejectedValueOnce(new Error('Network Error'))
    renderPage()
    await waitFor(() => expect(screen.getByText('לא הצלחנו לטעון את ההכנסות')).toBeTruthy())
    expect(screen.queryByText('אין הכנסות בסינון הזה')).toBeNull()
    expect(screen.queryByText('אין הכנסות להצגה')).toBeNull()
    // retry recovers
    fireEvent.click(screen.getByText('נסו שוב'))
    await waitFor(() => expect(screen.getByText('כל ההכנסות (2)')).toBeTruthy())
    expect(getIncomeAnalysis).toHaveBeenCalledTimes(2)
  })

  it('keeps showing the previous data with a warning when a refetch fails', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText('כל ההכנסות (2)')).toBeTruthy())
    getIncomeAnalysis.mockRejectedValueOnce(new Error('500'))
    const trigger = screen.getAllByRole('combobox', { expanded: false }).find((el) => el.getAttribute('aria-label') === 'מקור')!
    fireEvent.click(trigger)
    fireEvent.click(await screen.findByRole('option', { name: /FREELANCE PAYMENT/ }))
    await waitFor(() => expect(screen.getByText('העדכון האחרון נכשל - מוצגים הנתונים הקודמים.')).toBeTruthy())
    expect(screen.getByText('כל ההכנסות (2)')).toBeTruthy()
  })
})
