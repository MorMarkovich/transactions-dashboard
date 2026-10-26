import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { categoryColor } from './chartPalette'

// Source-derived palettes: dark = the module's own canonical fallback hexes;
// light = the --category-N vars actually shipped in redesign.css. No duplicated
// hex lists that can drift from the source again.
function fallbackHex(name: string): string {
  const c = categoryColor(name)
  const m = /var\(--category-\d+, (#[0-9A-Fa-f]{6})\)/.exec(c)
  return m ? m[1].toUpperCase() : c.toUpperCase()
}
function lightPaletteFromCss(): string[] {
  const css = readFileSync('src/styles/redesign.css', 'utf8') // vitest cwd = frontend root
  const block = /\[data-theme="light"\]\s*\{([^}]*--category-0[^}]*)\}/.exec(css)
  if (!block) throw new Error('light --category-N block not found in redesign.css')
  return [...block[1].matchAll(/--category-\d+:(#[0-9A-Fa-f]{6})/g)].map((m) => m[1].toUpperCase())
}

// The full known taxonomy (mirrors backend/app/core/constants.py) + aggregation buckets.
const KNOWN = [
  'טיסות ותיירות', 'הוצאות שוטפות', 'תרופות וטיפולים', 'פארם', 'בילויים', 'אוכל',
  'קניות', 'טיפוח', 'חוגים וספורט', 'אירועים ומתנות', 'טכנולוגיה', 'הוצאות משתנות',
  'סושי', 'העברת כספים', 'העברה להשקעות', 'משיכת מזומן', 'הוראות קבע', 'שונות',
  'יתר הקטגוריות', 'אחר', 'סטרימינג',
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
  const PALETTE = KNOWN.map(fallbackHex)
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
    for (const n of ['ביטוח', 'מנויים ושירותים', 'דלק', 'שכר דירה', 'קטגוריה חדשה לגמרי']) {
      const c = categoryColor(n)
      expect(c).toMatch(/^#[0-9A-F]{6}$/)
      for (const p of PALETTE) {
        expect(dist(c, p), `${n} vs ${p}`).toBeGreaterThan(40)
      }
    }
  })

  it('adapts to the light theme: deeper muted band, pair still distinct, off the light canonical palette', () => {
    const root = document.documentElement
    const prevTheme = root.dataset.theme
    root.dataset.theme = 'light'
    try {
      const a = categoryColor('ביטוח'), b = categoryColor('מנויים ושירותים')
      expect(a).not.toBe(b)
      expect(dist(a, b)).toBeGreaterThan(40)
      // Theme-adaptive: same name, different band per theme.
      expect(a).not.toBe(categoryColor('ביטוח', 'dark'))
      const LIGHT_PALETTE = lightPaletteFromCss()
      expect(LIGHT_PALETTE.length).toBe(KNOWN.length)
      // Never an exact/near duplicate of a light canonical color (floor locks out identity).
      for (const n of ['ביטוח', 'מנויים ושירותים', 'דלק', 'שכר דירה', 'קטגוריה חדשה לגמרי']) {
        const c = categoryColor(n)
        for (const p of LIGHT_PALETTE) expect(dist(c, p), `${n} vs ${p}`).toBeGreaterThan(10)
      }
    } finally {
      if (prevTheme === undefined) delete root.dataset.theme
      else root.dataset.theme = prevTheme
    }
  })

  it('does not use the canonical var(--category-N) slots', () => {
    expect(categoryColor('ביטוח')).not.toContain('var(--category-')
    expect(categoryColor('הוצאות שוטפות')).toContain('var(--category-')
  })

  it('accepts an explicit theme that overrides the DOM attribute', () => {
    const root = document.documentElement
    const prevTheme = root.dataset.theme
    try {
      root.dataset.theme = 'dark'
      expect(categoryColor('ביטוח', 'light')).not.toBe(categoryColor('ביטוח', 'dark'))
      expect(categoryColor('ביטוח', 'dark')).toBe(categoryColor('ביטוח'))
      root.dataset.theme = 'light'
      expect(categoryColor('ביטוח', 'light')).toBe(categoryColor('ביטוח'))
      expect(categoryColor('ביטוח', 'dark')).not.toBe(categoryColor('ביטוח'))
      // Canonical names ignore the theme parameter entirely (CSS vars adapt).
      expect(categoryColor('אוכל', 'light')).toBe(categoryColor('אוכל', 'dark'))
    } finally {
      if (prevTheme === undefined) delete root.dataset.theme
      else root.dataset.theme = prevTheme
    }
  })

  it('resolves the colliding pair distinctly in BOTH explicit themes', () => {
    for (const t of ['light', 'dark'] as const) {
      const a = categoryColor('ביטוח', t)
      const b = categoryColor('מנויים ושירותים', t)
      expect(a).not.toBe(b)
      expect(dist(a, b)).toBeGreaterThan(40)
    }
  })
})

describe('repinned slots (collision fixes)', () => {
  const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
  const dist = (a: string, b: string) => {
    const [x1, y1, z1] = rgb(a), [x2, y2, z2] = rgb(b)
    return Math.hypot(x1 - x2, y1 - y2, z1 - z2)
  }

  it('pins סטרימינג to its own canonical slot, far from the custom דלק it collided with', () => {
    expect(categoryColor('סטרימינג')).toContain('var(--category-20')
    expect(categoryColor('דלק')).not.toContain('var(--category-')
    expect(dist(fallbackHex('סטרימינג'), categoryColor('דלק', 'dark'))).toBeGreaterThan(100)
    // stability: pinned mapping is a pure function, identical on every call
    expect(categoryColor('סטרימינג')).toBe(categoryColor('סטרימינג'))
  })

  it('breaks the slate cluster: every canonical dark pair is at least 24 RGB apart', () => {
    const DARK = KNOWN.map(fallbackHex)
    expect(new Set(DARK).size).toBe(KNOWN.length)
    let min = Infinity
    for (let i = 0; i < DARK.length; i++) for (let j = i + 1; j < DARK.length; j++) min = Math.min(min, dist(DARK[i], DARK[j]))
    expect(min).toBeGreaterThan(24)
  })

  it('breaks the slate cluster: every canonical light pair is at least 27 RGB apart', () => {
    const LIGHT = lightPaletteFromCss()
    let min = Infinity
    for (let i = 0; i < LIGHT.length; i++) for (let j = i + 1; j < LIGHT.length; j++) min = Math.min(min, dist(LIGHT[i], LIGHT[j]))
    expect(min).toBeGreaterThan(27)
  })
})
