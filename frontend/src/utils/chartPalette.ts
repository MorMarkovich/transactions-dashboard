// Canonical category → color mapping. Pure function of the category NAME:
// stable across pages, filters, subsets and ordering. Every category in the
// app's known taxonomy owns an explicit slot (distinct by construction);
// unknown future names fall back to a deterministic hash slot, where rare
// collisions are resolved by the visible label/tooltip, not by shifting
// another category's color.
const colors = [
  '#50F1CD', // 0  teal
  '#519AFB', // 1  blue
  '#DD73D5', // 2  magenta
  '#FFB773', // 3  peach
  '#D5E36E', // 4  lime
  '#F77995', // 5  rose
  '#79A5BC', // 6  steel blue
  '#B2ADEE', // 7  lavender
  '#7891A3', // 8  gray-blue (aggregation bucket)
  '#3DD68C', // 9  green
  '#FFD43B', // 10 yellow
  '#FF6B6B', // 11 red
  '#4CC9F0', // 12 sky
  '#9775FA', // 13 violet
  '#E8590C', // 14 burnt orange
  '#F783AC', // 15 hot pink
  '#15AABF', // 16 deep cyan
  '#E9C46A', // 17 sand
  '#8D99AE', // 18 slate
  '#94A3B8', // 19 light slate (other bucket)
]
// Slot per known category. Mirrors backend/app/core/constants.py taxonomy
// (CATEGORY_ICONS) plus the aggregation buckets. Keep in sync when the
// taxonomy changes.
const known: Record<string, number> = {
  'שונות': 0,
  'הוצאות שוטפות': 1,
  'העברת כספים': 2,
  'חוגים וספורט': 3,
  'משיכת מזומן': 4,
  'תרופות וטיפולים': 5,
  'הוצאות משתנות': 6,
  'אוכל': 7,
  'יתר הקטגוריות': 8,
  'טיסות ותיירות': 9,
  'פארם': 10,
  'בילויים': 11,
  'קניות': 12,
  'טיפוח': 13,
  'אירועים ומתנות': 14,
  'טכנולוגיה': 15,
  'סושי': 16,
  'העברה להשקעות': 17,
  'הוראות קבע': 18,
  'אחר': 19,
}
export type ChartTheme = 'light' | 'dark'

function currentTheme(): ChartTheme {
  return typeof document !== 'undefined' && document.documentElement.dataset.theme === 'light'
    ? 'light'
    : 'dark'
}

// theme defaults to the live DOM attribute for non-React callers; React
// consumers should use useCategoryColor, which passes the ThemeContext theme
// explicitly so colors recompute the moment the theme toggles.
export function categoryColor(name: string, theme?: ChartTheme): string {
  const knownIdx = known[name]
  if (knownIdx !== undefined) return `var(--category-${knownIdx}, ${colors[knownIdx]})`
  return customColor(name, theme ?? currentTheme())
}

// Unknown names (custom categories, subcategory names) get a color from an
// EXTENDED custom space, kept visually separate from the pinned canonical
// palette in BOTH themes: pastel (l=84%) in dark mode where canonicals are
// vivid mid-tones, muted deep (l=38%) in light mode where canonicals are
// saturated mid-darks. Pure deterministic function of the NAME plus the
// active theme - same color in every view, subset, ordering and session,
// with no registry and no persistence. Distinctness among custom names is
// best-effort by golden-angle hue dispersion, not guaranteed for arbitrary
// name sets; the known colliding pair from production
// (ביטוח / מנויים ושירותים) is covered by tests.
function customColor(name: string, theme: ChartTheme): string {
  const h = hashSlotRaw(name)
  const hue = (h * 137.508) % 360
  return theme === 'light' ? hslToHex(hue, 45, 38) : hslToHex(hue, 40, 84)
}

function hashSlotRaw(name: string): number {
  let hash = 0
  for (const c of name) hash = (hash * 31 + c.charCodeAt(0)) >>> 0
  return hash
}

function hslToHex(h: number, s: number, l: number): string {
  s /= 100
  l /= 100
  const k = (n: number) => (n + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  const t = (x: number) => Math.round(255 * x).toString(16).padStart(2, '0')
  return (`#${t(f(0))}${t(f(8))}${t(f(4))}`).toUpperCase()
}
