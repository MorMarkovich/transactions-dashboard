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

describe('custom (unknown) category colors - extended pastel space', () => {
  const PALETTE = [
    '#50F1CD', '#519AFB', '#DD73D5', '#FFB773', '#D5E36E', '#F77995', '#79A5BC',
    '#B2ADEE', '#7891A3', '#3DD68C', '#FFD43B', '#FF6B6B', '#4CC9F0', '#9775FA',
    '#E8590C', '#F783AC', '#15AABF', '#E9C46A', '#8D99AE', '#94A3B8',
  ]
  const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
  const dist = (a: string, b: string) => {
    const [x1, y1, z1] = rgb(a), [x2, y2, z2] = rgb(b)
    return Math.hypot(x1 - x2, y1 - y2, z1 - z2)
  }

  it('is a pure function of the name: stable across views, subsets, order and reloads', () => {
    for (const n of ['ביטוח', 'מנויים ושירותים', 'קטגוריה חדשה לגמרי']) {
      expect(categoryColor(n)).toBe(categoryColor(n))
    }
  })

  it('resolves the production-colliding pair ביטוח / מנויים ושירותים to clearly distinct colors', () => {
    const a = categoryColor('ביטוח'), b = categoryColor('מנויים ושירותים')
    expect(a).not.toBe(b)
    expect(dist(a, b)).toBeGreaterThan(40)
  })

  it('never lands on or near any canonical palette color (unknown vs canonical co-render)', () => {
    for (const n of ['ביטוח', 'מנויים ושירותים', 'סטרימינג', 'שכר דירה', 'קטגוריה חדשה לגמרי']) {
      const c = categoryColor(n)
      expect(c).toMatch(/^#[0-9A-F]{6}$/)
      for (const p of PALETTE) {
        expect(dist(c, p), `${n} vs ${p}`).toBeGreaterThan(40)
      }
    }
  })

  it('does not use the canonical var(--category-N) slots', () => {
    expect(categoryColor('ביטוח')).not.toContain('var(--category-')
    expect(categoryColor('הוצאות שוטפות')).toContain('var(--category-')
  })
})
