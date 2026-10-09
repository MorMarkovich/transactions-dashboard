import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import OnboardingWizard, { UPLOAD_FILES_EVENT, UPLOAD_STATE_EVENT } from './OnboardingWizard'

describe('OnboardingWizard', () => {
  it('renders the three steps, upload and sample actions', () => {
    render(<OnboardingWizard onLoadSample={vi.fn()} />)
    expect(screen.getByText('מייצאים קובץ')).toBeTruthy()
    expect(screen.getByText('בחרו קובץ להעלאה')).toBeTruthy()
    expect(screen.getByText('נסו עם נתוני דוגמה')).toBeTruthy()
  })

  it('dispatches valid files and rejects other types', () => {
    render(<OnboardingWizard onLoadSample={vi.fn()} />)
    const seen: File[][] = []
    const h = (e: Event) => seen.push((e as CustomEvent<File[]>).detail)
    window.addEventListener(UPLOAD_FILES_EVENT, h)
    const input = screen.getByTestId('onboarding-file-input')
    fireEvent.change(input, { target: { files: [new File(['x'], 'a.txt')] } })
    expect(seen).toHaveLength(0)
    expect(screen.getByRole('alert').textContent).toContain('xlsx')
    fireEvent.change(input, { target: { files: [new File(['x'], 'a.xlsx')] } })
    expect(seen).toHaveLength(1)
    window.removeEventListener(UPLOAD_FILES_EVENT, h)
  })

  it('shows upload progress and errors from the sidebar', () => {
    render(<OnboardingWizard onLoadSample={vi.fn()} />)
    act(() => {
      window.dispatchEvent(new CustomEvent(UPLOAD_STATE_EVENT, { detail: { uploading: true, status: 'מעלה קובץ...', error: null } }))
    })
    expect(screen.getByText('מעלה קובץ...')).toBeTruthy()
    act(() => {
      window.dispatchEvent(new CustomEvent(UPLOAD_STATE_EVENT, { detail: { uploading: false, status: '', error: 'שגיאה בהעלאת הקובץ' } }))
    })
    expect(screen.getByRole('alert').textContent).toBe('שגיאה בהעלאת הקובץ')
  })

  it('shows an error when the sample fails to load', async () => {
    render(<OnboardingWizard onLoadSample={vi.fn().mockRejectedValue(new Error('x'))} />)
    await act(async () => { fireEvent.click(screen.getByText('נסו עם נתוני דוגמה')) })
    expect(screen.getByRole('alert').textContent).toContain('נתוני הדוגמה')
  })
})
