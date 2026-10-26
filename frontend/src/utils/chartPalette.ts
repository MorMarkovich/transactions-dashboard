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
function hashSlot(name: string): number {
  let hash = 0
  for (const c of name) hash = (hash * 31 + c.charCodeAt(0)) >>> 0
  return hash % colors.length
}
export function categoryColor(name: string): string {
  const idx = known[name] ?? hashSlot(name)
  return `var(--category-${idx}, ${colors[idx]})`
}

// Collision-resolved colors for a set of names rendered together (one donut,
// one stacked chart). Canonical names always keep their slot. Unknown names
// keep their hash slot when free, otherwise walk forward to the next slot
// unused within this set - two unknown names never share a color, and an
// unknown name never takes a canonical sibling's slot. Assignment follows
// input order, so every surface rendering the same ordered list agrees.
export function categoryColorMap(names: readonly string[]): Record<string, string> {
  const used = new Set<number>()
  for (const name of names) {
    if (known[name] !== undefined) used.add(known[name])
  }
  const out: Record<string, string> = {}
  for (const name of names) {
    if (known[name] !== undefined) {
      out[name] = `var(--category-${known[name]}, ${colors[known[name]]})`
      continue
    }
    let idx = hashSlot(name)
    while (used.has(idx)) idx = (idx + 1) % colors.length
    used.add(idx)
    out[name] = `var(--category-${idx}, ${colors[idx]})`
  }
  return out
}
