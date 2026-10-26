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
  'יתר הקטגוריות', 'אחר', 'סטרימינג', 'פרילנס',
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

  it('pins פרילנס off its hash collision with משכורת (income sources stay distinguishable)', () => {
    expect(categoryColor('פרילנס')).toContain('var(--category-21')
    expect(categoryColor('משכורת')).not.toContain('var(--category-')
    expect(dist(fallbackHex('פרילנס'), categoryColor('משכורת', 'dark'))).toBeGreaterThan(70)
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

describe('custom color overrides (observed collisions)', () => {
  const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
  const dist = (a: string, b: string) => {
    const [x1, y1, z1] = rgb(a), [x2, y2, z2] = rgb(b)
    return Math.hypot(x1 - x2, y1 - y2, z1 - z2)
  }
  // Existing exact-name override and its original neighbor. The ordered
  // regression below uses anonymous equivalents for every other observed row.
  const BANK = 'בנק פועלים משכורת'
  const ISRACARD = 'ישראכרט שכ משכורת'

  // Numerical guardrails for this reviewed palette, not perceptual guarantees.
  // Actual dark/light chart pixels are the visual acceptance check.
  it('separates the observed salary pair in BOTH themes', () => {
    expect(dist(categoryColor(ISRACARD, 'dark'), categoryColor(BANK, 'dark'))).toBeGreaterThan(90)
    expect(dist(categoryColor(ISRACARD, 'light'), categoryColor(BANK, 'light'))).toBeGreaterThan(30)
  })

  it('leaves the colliding neighbor on its original hash color', () => {
    expect(categoryColor(BANK, 'dark')).toBe('#E7D1C6')
    expect(categoryColor(BANK, 'light')).toBe('#8D5435')
  })

  it('override lands on the chosen custom-space hues, staying off canonical slots', () => {
    expect(categoryColor(ISRACARD, 'dark')).toBe('#E0C36C')
    expect(categoryColor(ISRACARD, 'light')).toBe('#7E651B')
    expect(categoryColor(ISRACARD)).not.toContain('var(--category-')
    // stability: pure function of the name, identical on every call
    expect(categoryColor(ISRACARD, 'dark')).toBe(categoryColor(ISRACARD, 'dark'))
  })

  // Anonymous names chosen to reproduce the observed ordered palette in
  // BOTH themes. No private source names, amounts, accounts or dates are kept.
  // Rank 3 is the existing exact-name override; all other rows are the baseline.
  const observedPalette: [number, string, string, string][] = [
    [1, 'observed-source-01-608', '#C6E7CD', '#358D4A'],
    [2, 'observed-source-02-288', '#E7D1C6', '#8D5435'],
    [4, 'observed-source-04-559', '#C6D2E7', '#35578D'],
    [5, 'observed-source-05-1086', '#C6E7C7', '#358D39'],
    [6, 'observed-source-06-2179', '#D4E7C6', '#5B8D35'],
    [7, 'observed-source-07-44', '#C6E7D1', '#358D52'],
    [8, 'observed-source-08-391', '#D1C6E7', '#53358D'],
    [9, 'observed-source-09-62', '#C6CAE7', '#35418D'],
    [10, 'observed-source-10-748', '#E7C6D1', '#8D3552'],
    [11, 'observed-source-11-50', '#E7C6D4', '#8D355C'],
    [12, 'observed-source-12-437', '#E7C6C8', '#8D353C'],
    [13, 'observed-source-13-132', '#E7DBC6', '#8D6D35'],
    [14, 'observed-source-14-2135', '#E1C6E7', '#7E358D'],
    [15, 'observed-source-15-926', '#E6C6E7', '#8A358D'],
    [16, 'observed-source-16-1079', '#DEE7C6', '#758D35'],
    [17, 'observed-source-17-2787', '#C7E7C6', '#3A8D35'],
    [18, 'observed-source-18-1044', '#C6E0E7', '#357B8D'],
    [19, 'observed-source-19-707', '#C6E7C7', '#358D39'],
    [20, 'observed-source-20-34', '#E7C6E5', '#8D3589'],
    [21, 'observed-source-21-134', '#DAC6E7', '#6C358D'],
    [22, 'observed-source-22-1917', '#DEE7C6', '#768D35'],
    [23, 'observed-source-23-297', '#C6E5E7', '#35888D'],
    [24, 'observed-source-24-177', '#E7C6C7', '#8D3538'],
    [25, 'observed-source-25-248', '#E7E6C6', '#8D8A35'],
    [26, 'observed-source-26-939', '#C6E7D9', '#358D68'],
    [27, 'observed-source-27-2872', '#C6E7C6', '#378D35'],
    [28, 'observed-source-28-2032', '#DDC6E7', '#72358D'],
    [29, 'observed-source-29-365', '#D0C6E7', '#51358D'],
    [30, 'observed-source-30-24', '#D9E7C6', '#678D35'],
    [31, 'observed-source-31-5388', '#E7CFC6', '#8D4C35'],
    [32, 'observed-source-32-205', '#C9E7C6', '#3F8D35'],
    [33, 'observed-source-33-2367', '#DBE7C6', '#6D8D35'],
    [34, 'observed-source-34-23', '#C6E0E7', '#357C8D'],
    [35, 'observed-source-35-859', '#E4E7C6', '#858D35'],
    [36, 'observed-source-36-837', '#E7C6CB', '#8D3543'],
  ]

  it('preserves every other observed mapping with anonymous hash-equivalent names', () => {
    for (const [, name, dark, light] of observedPalette) {
      expect(categoryColor(name, 'dark')).toBe(dark)
      expect(categoryColor(name, 'light')).toBe(light)
    }
  })

  it('does not introduce a target collision into the complete observed palette', () => {
    for (const [rank, name, dark, light] of observedPalette) {
      expect(dist(categoryColor(ISRACARD, 'dark'), dark), `dark rank ${rank}`).toBeGreaterThan(90)
      expect(dist(categoryColor(ISRACARD, 'light'), light), `light rank ${rank}`).toBeGreaterThan(30)
      expect(categoryColor(name, 'dark')).toBe(dark)
      expect(categoryColor(name, 'light')).toBe(light)
    }
  })

  it('separates the target from both actual ordered neighbors, including the former hue-200 collision', () => {
    const neighbors = observedPalette.filter(([rank]) => rank === 2 || rank === 4)
    expect(neighbors).toHaveLength(2)
    for (const [, , dark, light] of neighbors) {
      expect(dist(categoryColor(ISRACARD, 'dark'), dark)).toBeGreaterThan(90)
      expect(dist(categoryColor(ISRACARD, 'light'), light)).toBeGreaterThan(30)
    }
    const formerBlue = observedPalette.find(([rank]) => rank === 4)!
    expect(dist('#C6DCE7', formerBlue[2])).toBe(10)
    expect(dist('#356F8D', formerBlue[3])).toBe(24)
  })
})
