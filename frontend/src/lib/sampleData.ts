// Fictional household transactions for the onboarding "try with sample data"
// option. Generated relative to today so the dashboard always shows recent
// months. Deterministic (seeded) so the demo looks the same on every click.
type Row = Record<string, unknown>

function rng(seed: number) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

const pad = (n: number) => String(n).padStart(2, '0')
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

export function buildSampleTransactions(today: Date = new Date()): Row[] {
  const rand = rng(20261009)
  const rows: Row[] = []
  const add = (d: Date, desc: string, cat: string, amount: number) => {
    if (d > today) return
    rows.push({
      תאריך: iso(d),
      תאריך_חיוב: iso(d),
      תיאור: desc,
      קטגוריה: cat,
      סכום: Math.round(amount * 100) / 100,
      _source_file: 'נתוני דוגמה',
    })
  }
  const between = (lo: number, hi: number) => lo + rand() * (hi - lo)

  for (let back = 3; back >= 0; back--) {
    const first = new Date(today.getFullYear(), today.getMonth() - back, 1)
    const day = (n: number) => new Date(first.getFullYear(), first.getMonth(), n)

    add(day(1), 'משכורת - חברת הייטק', 'שונות', 14200)
    add(day(10), 'משכורת - בן/בת זוג', 'שונות', 9300)
    add(day(2), 'שכר דירה', 'הוצאות שוטפות', -5200)
    add(day(5), 'ארנונה - עירייה', 'הוצאות שוטפות', -640)
    add(day(8), 'חברת החשמל', 'הוצאות שוטפות', -between(280, 520))
    add(day(9), 'סלקום', 'הוצאות שוטפות', -149.9)
    add(day(9), 'בזק אינטרנט', 'הוצאות שוטפות', -119.9)
    add(day(12), 'נטפליקס', 'הוצאות שוטפות', -54.9)
    add(day(15), 'הפניקס ביטוחים', 'הוצאות שוטפות', -310)
    add(day(3), 'מכון כושר סיטי', 'חוגים וספורט', -229)

    const shops = ['שוק מרכזי דיל', 'סופר השכונה', 'מינימרקט ירוק', 'חנות הירקות']
    for (let i = 0; i < 9; i++) {
      add(day(1 + Math.floor(rand() * 27)), shops[i % shops.length], 'אוכל', -between(90, 460))
    }
    const food = ['קפה פינתי', 'פיצה איטליה', 'בית קפה הגינה', 'המבורגר הבית', 'סושי בר']
    for (let i = 0; i < 6; i++) {
      add(day(1 + Math.floor(rand() * 27)), food[i % food.length], 'בילויים', -between(38, 240))
    }
    for (let i = 0; i < 3; i++) {
      add(day(2 + Math.floor(rand() * 26)), 'תחנת דלק ירוקה', 'הוצאות משתנות', -between(180, 330))
    }
    add(day(6 + Math.floor(rand() * 18)), 'חניון העיר', 'הוצאות משתנות', -between(20, 70))
    for (let i = 0; i < 2; i++) {
      add(day(1 + Math.floor(rand() * 27)), 'סופר פארם', 'פארם', -between(45, 190))
    }
    add(day(14 + Math.floor(rand() * 12)), 'מכבי שירותי בריאות', 'תרופות וטיפולים', -between(40, 160))
    add(day(4 + Math.floor(rand() * 22)), 'חנות בגדים אופנה', 'קניות', -between(120, 540))
    add(day(4 + Math.floor(rand() * 22)), 'חנות אונליין לבית', 'קניות', -between(60, 380))
    if (back === 1) add(day(20), 'חופשה - מלון ים המלח', 'טיסות ותיירות', -2850)
  }
  return rows
}
