import { useState } from 'react'
import { ArrowLeft, ChevronDown } from 'lucide-react'
import type { MonthOverviewData } from '../../services/types'
import { formatCurrency } from '../../utils/formatting'
import { formatMonthLabel } from '../../utils/monthComparison'
import { get_icon } from '../../utils/constants'
import Skeleton from '../ui/Skeleton'

interface Props {
  month: string | null
  overview: MonthOverviewData | null
  loading: boolean
  failed: boolean
  onRetry: () => void
  onCategory: (name: string, month: string) => void
}

export default function MonthlyCategories({ month, overview, loading, failed, onRetry, onCategory }: Props) {
  const [expanded, setExpanded] = useState(false)
  const categories = (overview?.categories ?? []).filter(item => item.expenses > 0).sort((a, b) => b.expenses - a.expenses)
  const shown = expanded ? categories : categories.slice(0, 5)
  const total = overview?.total_expenses ?? 0

  return (
    <section className="finance-panel finance-categories" aria-labelledby="finance-categories-title" aria-busy={loading}>
      <div className="finance-section-heading"><div>
        <h2 id="finance-categories-title">לאן הלך הכסף?</h2>
        {month && <p>הוצאות לפי קטגוריה · {formatMonthLabel(month)}</p>}
      </div></div>
      {loading ? <Skeleton variant="rectangular" height={190} /> : failed ? (
        <div className="finance-retry"><p role="status">לא ניתן לטעון את פירוט החודש.</p><button type="button" className="finance-action" onClick={onRetry}>נסו שוב</button></div>
      ) : shown.length > 0 && month ? (
        <>
          <ul className="finance-rank">
            {shown.map(item => {
              const share = total > 0 ? item.expenses / total : 0
              return (
                <li key={item.name}>
                  <button type="button" onClick={() => onCategory(item.name, month)}>
                    <span className="finance-category-icon" aria-hidden="true">{get_icon(item.name)}</span>
                    <span className="finance-category-name">{item.name}<span className="finance-rank-track" aria-hidden="true"><i style={{ width: `${share * 100}%` }} /></span></span>
                    <span className="finance-category-value">
                      <strong><bdi dir="ltr">{formatCurrency(item.expenses)}</bdi></strong>
                      <small><bdi dir="ltr">{(share * 100).toLocaleString('he-IL', { maximumFractionDigits: 1 })}%</bdi></small>
                    </span>
                    <ArrowLeft size={14} aria-hidden="true" />
                  </button>
                </li>
              )
            })}
          </ul>
          {categories.length > 5 && <button type="button" className="finance-text-action" aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>
            {expanded ? 'הצגת פחות קטגוריות' : `כל ${categories.length} הקטגוריות`} <ChevronDown size={15} aria-hidden="true" />
          </button>}
        </>
      ) : <p className="finance-muted">אין הוצאות להצגה בחודש ובסינון שנבחרו.</p>}
    </section>
  )
}
