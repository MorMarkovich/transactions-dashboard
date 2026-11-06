import React from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import SavingsGoals from '../src/pages/SavingsGoals'
import { MotionConfig } from 'framer-motion'
import '../src/index.css'

// seed synthetic goals
const goals = [
  { id: 'g1', name: 'חופשה באירופה', target_amount: 1000, current_amount: 800, category: 'חופשה', color: '#34d399', created_at: '2026-01-01T00:00:00.000Z' },
  { id: 'g2', name: 'רכב חדש', target_amount: 50000, current_amount: 1200, category: 'רכב', color: '#818cf8', created_at: '2026-01-02T00:00:00.000Z' },
  { id: 'g3', name: 'קרן חירום', target_amount: 20000, current_amount: 20000, category: 'חירום', color: '#f87171', created_at: '2026-01-03T00:00:00.000Z' },
]
localStorage.setItem('savings-goals-user-audit-user-1', JSON.stringify(goals))

// open the add-funds editor on the first goal after mount, via query flag
const theme = new URLSearchParams(location.search).get('theme') || 'dark'
document.documentElement.dataset.theme = theme
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
function setReactValue(input: HTMLInputElement, v: string) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!
  setter.call(input, v)
  input.dispatchEvent(new Event('input', { bubbles: true }))
}
function byText(t: string) {
  return Array.from(document.querySelectorAll('button')).find((b) => b.textContent?.includes(t)) as HTMLButtonElement | undefined
}
;(async () => {
  const mode = new URLSearchParams(location.search).get('autoclick')
  if (!mode) return
  await sleep(300)
  const breakStorage = () => {
    Storage.prototype.setItem = () => { throw new DOMException('QuotaExceededError') }
  }
  if (mode === 'funds-over' || mode === 'funds-fail') {
    if (mode === 'funds-fail') breakStorage()
    byText('הוסף כסף')?.click()
    await sleep(150)
    setReactValue(document.querySelector('input[placeholder="סכום"]') as HTMLInputElement, mode === 'funds-over' ? '1500' : '150')
    await sleep(100)
    ;(document.querySelector('button[title="אישור"]') as HTMLButtonElement)?.click()
  } else if (mode === 'add-fail') {
    breakStorage()
    byText('הוסף יעד')?.click()
    await sleep(150)
    setReactValue(document.querySelector('input[aria-label="שם היעד"]') as HTMLInputElement, 'יעד כושל')
    setReactValue(document.querySelector('input[aria-label="סכום יעד (₪)"]') as HTMLInputElement, '500')
    await sleep(100)
    byText('הוסף')?.click()
  } else if (mode === 'delete-confirm' || mode === 'delete-fail') {
    if (mode === 'delete-fail') breakStorage()
    ;(document.querySelector('button[title="מחק יעד"]') as HTMLButtonElement)?.click()
    await sleep(150)
    if (mode === 'delete-fail') byText('למחוק?')?.click()
  } else if (mode === 'form') {
    byText('הוסף יעד')?.click()
  } else if (mode === 'funds') {
    byText('הוסף כסף')?.click()
  }
})()
createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <MotionConfig reducedMotion="always"><MemoryRouter>
      <div className="main-content" style={{ padding: 16, maxWidth: 1100, margin: '0 auto' }}>
        <SavingsGoals />
      </div>
    </MemoryRouter></MotionConfig>
  </React.StrictMode>,
)
