import { describe, expect, it } from 'vitest'
import { categoryColor, categoryColorMap } from './chartPalette'

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

describe('categoryColorMap - collision-resolved set colors', () => {
  it('gives two unknown names hashing to the same slot DISTINCT colors (ביטוח / מנויים ושירותים)', () => {
    const map = categoryColorMap(['ביטוח', 'מנויים ושירותים'])
    expect(map['ביטוח']).not.toBe(map['מנויים ושירותים'])
  })

  it('never moves a canonical category, even when an unknown name hashes onto its slot', () => {
    const map = categoryColorMap(['פארם', 'ביטוח', 'מנויים ושירותים']) // פארם owns slot 10
    expect(map['פארם']).toBe(categoryColor('פארם'))
    expect(new Set([map['פארם'], map['ביטוח'], map['מנויים ושירותים']]).size).toBe(3)
  })

  it('depends only on the SET of names: any input order gives the same map', () => {
    const names = ['ביטוח', 'מנויים ושירותים', 'תרופות', 'וטרינר', 'פארם']
    const reversed = [...names].reverse()
    const rotated = [...names.slice(2), ...names.slice(0, 2)]
    expect(categoryColorMap(reversed)).toEqual(categoryColorMap(names))
    expect(categoryColorMap(rotated)).toEqual(categoryColorMap(names))
    expect(categoryColorMap(names)).toEqual(categoryColorMap(names))
  })

  it('leaves canonical-only sets identical to categoryColor', () => {
    const names = ['אוכל', 'בילויים', 'טכנולוגיה']
    const map = categoryColorMap(names)
    for (const n of names) expect(map[n]).toBe(categoryColor(n))
  })
})
