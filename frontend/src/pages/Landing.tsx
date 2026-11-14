import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowDown, ArrowLeft, ChevronDown, LayoutGrid, ListFilter, LockKeyhole, ReceiptText, Wallet } from 'lucide-react'
import PinkasBrand from '../components/common/PinkasBrand'

const activity = [
  { name: 'קניות לבית', category: 'אוכל', amount: '₪486', icon: 'shopping' },
  { name: 'ארוחת ערב', category: 'בילויים', amount: '₪218', icon: 'dining' },
  { name: 'נסיעות', category: 'הוצאות משתנות', amount: '₪86', icon: 'travel' },
]
const months = ['יונ׳', 'יול׳', 'אוג׳', 'ספט׳', 'אוק׳', 'נוב׳']
const spending = [48, 57, 51, 75, 85, 70]
const features = [
  { icon: LayoutGrid, title: 'סקירה חודשית', text: 'ראו הכנסות והוצאות יחד, עם השוואה לחודש הקודם ופירוט לפי קטגוריה.' },
  { icon: ReceiptText, title: 'כל העסקאות במקום אחד', text: 'חפשו לפי בית עסק, סננו לפי תקופה ועדכנו קטגוריה ישירות מתוך העסקה.' },
  { icon: Wallet, title: 'תקציב וחיסכון', text: 'עקבו אחר תקציב לפי קטגוריה והתקדמות לעבר יעדי החיסכון שלכם.' },
]
const questions = [
  { title: 'איך מוסיפים תנועות לפנקס?', text: 'אחרי ההתחברות אפשר לייבא דוחות מהבנק או מחברת האשראי. בחשבונות שהוגדר בהם סנכרון מקומי אפשר גם לרענן ישירות ממסך החשבונות.' },
  { title: 'אפשר לתקן קטגוריה של עסקה?', text: 'כן. פתחו את העסקה, בחרו קטגוריה ותת־קטגוריה ושמרו את השינוי.' },
  { title: 'אפשר להתרשם לפני שמוסיפים נתונים?', text: 'כן. אחרי ההתחברות אפשר לפתוח את הדשבורד עם נתוני דוגמה. הדוגמה אינה נשמרת בחשבון.' },
]

export default function Landing() {
  const [view, setView] = useState<'overview' | 'activity'>('overview')

  return (
    <div className="pinkas-landing" dir="rtl">
      <a href="#main-content" className="pinkas-skip">דילוג לתוכן</a>
      <div className="landing-hero">
        <header className="landing-nav landing-width">
          <PinkasBrand />
          <nav aria-label="ניווט באתר"><a href="#features">יכולות</a><a href="#preview">הדגמה</a><a href="#faq">שאלות נפוצות</a></nav>
          <div className="landing-nav-actions"><Link to="/login">התחברות</Link><Link to="/login?mode=register" className="landing-pill">פתיחת חשבון</Link></div>
        </header>
        <main id="main-content" className="landing-width">
          <h1>כל הכסף שלכם.<br /><span>תמונה אחת ברורה.</span></h1>
          <div className="landing-hero-grid">
            <div className="landing-intro">
              <p>הכנסות, הוצאות ועסקאות במקום אחד. ראו לאן הכסף הולך, מה השתנה מהחודש שעבר ואיפה אתם עומדים מול התקציב.</p>
              <div className="landing-actions">
                <Link to="/login?mode=register" className="landing-pill">פתיחת חשבון <ArrowLeft size={18} /></Link>
                <a href="#preview" className="landing-demo-link">הצצה לדשבורד <ArrowDown size={16} /></a>
              </div>
              <span className="landing-privacy"><LockKeyhole size={15} /> גישה לנתונים דרך החשבון שלכם</span>
            </div>
            <section id="preview" className="landing-preview" aria-label="הדגמת פנקס">
              <div className="landing-preview-head">
                <div className="landing-switcher" aria-label="תצוגת הדגמה">
                  <button type="button" aria-pressed={view === 'overview'} onClick={() => setView('overview')}>סקירה</button>
                  <button type="button" aria-pressed={view === 'activity'} onClick={() => setView('activity')}>עסקאות</button>
                </div>
                <span>נתוני דוגמה</span>
              </div>
              {view === 'overview' ? (
                <div className="landing-preview-body">
                  <div className="landing-preview-summary">
                    <div><span>הוצאות החודש</span><strong dir="ltr">₪8,460</strong><small><ArrowDown size={14} /> 18% פחות מהחודש שעבר</small></div>
                    <div className="landing-chart" dir="ltr" role="img" aria-label="גרף הוצאות לדוגמה מיוני עד נובמבר, עם ירידה בנובמבר">
                      {spending.map((value, index) => <div key={months[index]}><i style={{ height: `${value}%` }} /><span>{months[index]}</span></div>)}
                    </div>
                  </div>
                  <div className="landing-preview-totals"><div><span>הכנסות</span><strong dir="ltr">₪12,800</strong></div><div><span>הכנסות פחות הוצאות</span><strong dir="ltr">₪4,340</strong></div></div>
                </div>
              ) : (
                <div className="landing-preview-body landing-activity">
                  <h2>עסקאות אחרונות <ListFilter size={17} /></h2>
                  {activity.map(({ name, category, amount, icon }) => (
                    <div className="landing-activity-row" key={name}><span className={`landing-activity-icon ${icon}`}><ReceiptText size={17} /></span><div><strong>{name}</strong><small>{category}</small></div><bdi>{amount}</bdi></div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </main>
      </div>
      <section id="features" className="landing-features landing-width" aria-labelledby="features-title">
        <h2 id="features-title">ככה נראה הכסף<br />כשכל המידע במקום אחד.</h2>
        <div>{features.map(({ icon: Icon, title, text }) => <article key={title}><Icon size={26} /><h3>{title}</h3><p>{text}</p></article>)}</div>
      </section>
      <section id="faq" className="landing-faq landing-width" aria-labelledby="faq-title">
        <h2 id="faq-title">שאלות נפוצות</h2>
        <div>{questions.map(({ title, text }) => <details key={title}><summary>{title}<ChevronDown size={20} /></summary><p>{text}</p></details>)}</div>
      </section>
      <footer className="landing-footer"><div className="landing-width"><PinkasBrand /><Link to="/login">התחברות <ArrowLeft size={17} /></Link></div></footer>
    </div>
  )
}
