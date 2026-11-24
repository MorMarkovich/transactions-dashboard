import { ArrowLeft } from 'lucide-react'
import type { RawMonthlyData } from '../../services/types'
import { formatCurrency } from '../../utils/formatting'
import { formatMonthLabel, isOpenMonth } from '../../utils/monthComparison'

interface Props {
  months: RawMonthlyData['months']
  selectedMonth: string | null
  onSelect: (month: string) => void
  onCompare: () => void
}

const axisFormat = new Intl.NumberFormat('he-IL', { notation: 'compact', maximumFractionDigits: 1 })

export default function MonthlyActivity({ months, selectedMonth, onSelect, onCompare }: Props) {
  const index = months.findIndex(item => item.month === selectedMonth)
  const start = index < 0 ? Math.max(0, months.length - 6) : Math.min(Math.max(0, index - 4), Math.max(0, months.length - 6))
  const visible = months.slice(start, start + 6)
  const maximum = Math.max(1, ...visible.flatMap(month => [month.amount, month.income ?? 0]))
  const step = 10 ** Math.floor(Math.log10(maximum)) / 2
  const scale = Math.ceil(maximum / step) * step
  const selected = months[index]

  return (
    <section className="finance-panel finance-activity" aria-labelledby="finance-activity-title">
      <div className="finance-section-heading">
        <div>
          <h2 id="finance-activity-title">הכנסות מול הוצאות</h2>
          <p>לפי חודש</p>
        </div>
        <button type="button" className="finance-text-action" onClick={onCompare}>השוואת חודשים <ArrowLeft size={16} aria-hidden="true" /></button>
      </div>
      {!visible.length ? <p className="finance-muted">אין פעילות חודשית בסינון שנבחר.</p> : <>
      <div className="finance-chart-key">
        <span><i className="finance-expense-marker" aria-hidden="true" /> הוצאות</span>
        <span><i className="finance-income-marker" aria-hidden="true" /> הכנסות</span>
      </div>
      <div className="finance-chart">
        <div className="finance-axis" aria-hidden="true">
          {[scale, scale / 2, 0].map(tick => <span key={tick}>{axisFormat.format(tick)}</span>)}
        </div>
        <div className="finance-plot" role="group" aria-label="בחירת חודש בתרשים" style={{ '--plot-months': visible.length } as React.CSSProperties}>
        {visible.map(item => {
          const income = item.income ?? 0
          const label = formatMonthLabel(item.month)
          const open = isOpenMonth(item.month)
          return (
            <button type="button" key={item.month} aria-pressed={item.month === selectedMonth} onClick={() => onSelect(item.month)}
              aria-label={`${label}${open ? ', נתונים עד כה' : ''}, הוצאות ${formatCurrency(item.amount)}, הכנסות ${formatCurrency(income)}`}>
              <div className="finance-bar-pair" aria-hidden="true">
                <i className="finance-expense-marker" style={{ height: `${item.amount / scale * 100}%` }} />
                <i className="finance-income-marker" style={{ height: `${income / scale * 100}%` }} />
              </div>
              <span aria-hidden="true">{item.month.slice(0, 2)}/{item.month.slice(-2)}{open && <sup>*</sup>}</span>
            </button>
          )
        })}
        </div>
      </div>
      {selected && <div className="finance-plot-values">
        <strong>{formatMonthLabel(selected.month)}</strong>
        <span>הוצאות <bdi dir="ltr">{formatCurrency(selected.amount)}</bdi></span>
        <span>הכנסות <bdi dir="ltr">{formatCurrency(selected.income ?? 0)}</bdi></span>
      </div>}
      {visible.some(item => isOpenMonth(item.month)) && <p className="finance-muted finance-chart-note">* נתונים עד כה</p>}
      </>}
    </section>
  )
}
