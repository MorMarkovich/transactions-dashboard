// Stable colors across pages, filters and ordering. Orbit's luminous category marks.
const colors = ['#50F1CD','#519AFB','#DD73D5','#FFB773','#D5E36E','#F77995','#79A5BC','#B2ADEE']
const known: Record<string,string> = {'שונות':colors[0],'הוצאות שוטפות':colors[1],'העברת כספים':colors[2],'חוגים וספורט':colors[3],'משיכת מזומן':colors[4],'תרופות וטיפולים':colors[5],'הוצאות משתנות':colors[6],'אוכל':colors[7],'יתר הקטגוריות':'#7891A3'}
export function categoryColor(name: string): string {
 const color = known[name]
 if (color) return `var(--category-${colors.indexOf(color) < 0 ? 8 : colors.indexOf(color)}, ${color})`
 let hash=0;for(const c of name) hash=(hash*31+c.charCodeAt(0))>>>0
 return `var(--category-${hash%colors.length}, ${colors[hash%colors.length]})`
}
