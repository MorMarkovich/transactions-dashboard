import { useId, useState } from 'react'
import { Area, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, XAxis, YAxis } from 'recharts'
import { formatCompactShekel, formatCurrency } from '../../utils/formatting'
import { formatMonthLabel, spendingChange } from '../../utils/monthComparison'

interface SpendingPaceProps {
  month: string
  dateType: 'billing' | 'transaction'
  current: number[]
  priorMonth: string | null
  previous: number[] | null
  comparisonLoading: boolean
  onRetry?: () => void
}

export default function SpendingPace({ month, dateType, current, priorMonth, previous, comparisonLoading, onRetry }: SpendingPaceProps) {
  const gradientId = useId()
  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  const lastDay = current.length
  const previousLength = previous?.length || 0
  const defaultDay = previousLength > 0 ? Math.min(lastDay, previousLength) : lastDay
  const day = Math.min(selectedDay ?? defaultDay, lastDay)
  const thisAmount = current[day - 1]
  const priorAmount = previous?.[day - 1]
  const delta = priorAmount === undefined ? null : spendingChange(thisAmount, priorAmount)
  const series = Array.from({ length: lastDay + 1 }, (_, index) => ({
    day: index,
    current: index === 0 ? 0 : current[index - 1],
    previous: previousLength > 0 ? (index === 0 ? 0 : previous?.[index - 1] ?? null) : null,
  }))
  const ticks = Array.from(new Set([1, Math.ceil(lastDay / 3), Math.ceil(lastDay * 2 / 3), lastDay]))
  const currentLabel = formatMonthLabel(month)
  const priorLabel = priorMonth ? formatMonthLabel(priorMonth) : null
  const selectedDayText = `עד יום ${day} בחודש`
  const comparisonMessage = comparisonLoading ? 'טוענים חודש קודם…'
    : onRetry ? 'טעינת החודש הקודם נכשלה.'
      : previousLength ? 'החודש הקודם הסתיים לפני היום הזה.'
        : 'אין נתוני השוואה לחודש הקודם.'
  const differenceText = delta && delta.amount !== 0 ? formatCurrency(Math.abs(delta.amount)) : null
  const differenceLabel = !delta ? comparisonMessage
    : delta.amount === 0 ? 'הוצאה זהה עד אותו יום'
      : delta.amount > 0 ? 'יותר עד אותו יום' : 'פחות עד אותו יום'

  return (
    <section className="finance-pace" aria-labelledby="finance-pace-title">
      <div className="finance-section-heading">
        <div>
          <h2 id="finance-pace-title">קצב ההוצאות</h2>
          <p>{dateType === 'billing' ? 'מצטבר לפי תאריך חיוב, או תאריך עסקה כשאין תאריך חיוב' : 'מצטבר לפי תאריך עסקה'}</p>
        </div>
        <span className="finance-pace-day">{selectedDayText}</span>
      </div>
      <div className="finance-pace-chart" aria-hidden="true" dir="ltr">
        <ResponsiveContainer width="100%" height={172} minWidth={0}>
          <ComposedChart data={series} margin={{ top: 12, right: 9, bottom: 0, left: 1 }} accessibilityLayer={false}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.24} />
                <stop offset="100%" stopColor="var(--accent)" stopOpacity={0.015} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis dataKey="day" type="number" domain={[0, lastDay]} ticks={ticks} axisLine={false} tickLine={false}
              tickMargin={6} tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
            <YAxis width={43} tickCount={4} tickFormatter={formatCompactShekel} axisLine={false} tickLine={false}
              tick={{ fill: 'var(--text-muted)', fontSize: 10 }} />
            <Area type="stepAfter" dataKey="current" stroke="var(--accent)" strokeWidth={2.5} fill={`url(#${gradientId})`}
              isAnimationActive={false} dot={false} activeDot={false} />
            {previousLength > 0 && <Line type="stepAfter" dataKey="previous" stroke="var(--finance-expense)" strokeWidth={2}
              strokeDasharray="4 5" isAnimationActive={false} dot={false} activeDot={false} />}
            <ReferenceLine x={day} stroke="var(--text-muted)" strokeDasharray="2 4" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      {lastDay > 1 && (
        <div className="finance-pace-scale" dir="ltr"><input
          className="finance-pace-slider"
          type="range"
          dir="ltr"
          min={1}
          max={lastDay}
          value={day}
          onChange={event => setSelectedDay(Number(event.target.value))}
          aria-label="יום להשוואת ההוצאות"
          aria-valuetext={`${selectedDayText}, ${currentLabel}: ${formatCurrency(thisAmount)}${priorAmount !== undefined ? `, ${priorLabel}: ${formatCurrency(priorAmount)}` : ''}. ${differenceText ? differenceText + ' ' : ''}${differenceLabel}`}
        /></div>
      )}
      <dl className="finance-pace-values">
        <div>
          <dt><i className="finance-pace-marker" aria-hidden="true" />{currentLabel}</dt>
          <dd><bdi dir="ltr">{formatCurrency(thisAmount)}</bdi></dd>
        </div>
        {previousLength > 0 && (
          <div>
            <dt><i className="finance-pace-marker-previous" aria-hidden="true" />{priorLabel}</dt>
            <dd>{priorAmount === undefined ? '—' : <bdi dir="ltr">{formatCurrency(priorAmount)}</bdi>}</dd>
          </div>
        )}
      </dl>
      <div className="finance-pace-summary">
        <p className="finance-pace-delta">
          {differenceText && delta && <><bdi dir="ltr" className={delta.amount > 0 ? 'amount-negative' : 'amount-positive'}>{differenceText}</bdi>{' '}</>}
          {differenceLabel}
        </p>
        {onRetry && <button type="button" className="finance-action" onClick={onRetry}>נסו שוב</button>}
      </div>
    </section>
  )
}
