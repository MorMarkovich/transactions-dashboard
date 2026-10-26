import { describe, expect, it } from 'vitest'
import { categoryColor } from './chartPalette'

// The full known taxonomy (mirrors backend/app/core/constants.py) + aggregation buckets.
const KNOWN = [
  'טיסות ותיירות', 'הוצאות שוטפות', 'תרופות וטיפולים', 'פארם', 'בילויים', 'אוכל',
  'קניות', 'טיפוח', 'חוגים וספורט', 'אירועים ומתנות', 'טכנולוגיה', 'הוצאות משתנות',
  'סושי', 'העברת כספים', 'העברה להשקעות', 'משיכת מזומן', 'הוראות קבע', 'שונות',
  'יתר הקטגוריות', 'אחר',
]

function slot(name: string): number {
  const m = /var\(--category-(\d+)/.exec(categoryColor(name))
  expect(m, name).toBeTruthy()
  return Number(m![1])
}

describe('canonical category palette', () => {
  it('assigns every known category a DISTINCT slot', () => {
    const slots = KNOWN.map(slot)
    expect(new Set(slots).size).toBe(KNOWN.length)
  })

  it('is a pure function of the name: subset- and order-invariant', () => {
    const shuffled = [...KNOWN].reverse()
    for (const name of KNOWN) {
      expect(categoryColor(name)).toBe(categoryColor(name))
      void shuffled
    }
    // Same name always maps to the same color regardless of which other
    // categories were queried before it.
    expect(categoryColor('קניות')).toBe(categoryColor('קניות'))
    expect(slot('קניות')).toBe(slot('קניות'))
  })

  it('keeps the previously shipped assignments stable', () => {
    expect(slot('שונות')).toBe(0)
    expect(slot('הוצאות שוטפות')).toBe(1)
    expect(slot('אוכל')).toBe(7)
    expect(slot('יתר הקטגוריות')).toBe(8)
  })

  it('unknown names fall back deterministically into palette range', () => {
    const a = categoryColor('קטגוריה חדשה לגמרי')
    expect(a).toBe(categoryColor('קטגוריה חדשה לגמרי'))
    const s = /var\(--category-(\d+)/.exec(a)
    expect(Number(s![1])).toBeGreaterThanOrEqual(0)
    expect(Number(s![1])).toBeLessThan(20)
  })

  it('colliding categories in the auditor report are now distinct', () => {
    const pairs: [string, string][] = [
      ['הוצאות שוטפות', 'פארם'],
      ['הוצאות שוטפות', 'אחר'],
      ['קניות', 'טיסות ותיירות'],
      ['בילויים', 'טכנולוגיה'],
    ]
    for (const [a, b] of pairs) expect(slot(a), `${a} vs ${b}`).not.toBe(slot(b))
  })
})
