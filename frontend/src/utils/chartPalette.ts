const colors = ['#A99BFF','#66C7EB','#55D8B0','#F4BE76','#FF8C9C','#A9B6D2','#B4CF81','#D39BCF']
const known: Record<string,string> = {'הוצאות שוטפות':colors[0],'הוצאות משתנות':colors[1],'משיכת מזומן':colors[2],'אוכל':colors[3],'תרופות וטיפולים':colors[4],'בילויים':colors[5],'אירועים ומתנות':colors[6],'העברת כספים':colors[7],'יתר הקטגוריות':'#65718D'}
export function categoryColor(name: string): string {
 if (known[name]) return known[name]
 let hash=0;for(const c of name) hash=(hash*31+c.charCodeAt(0))>>>0
 return colors[hash%colors.length]
}
