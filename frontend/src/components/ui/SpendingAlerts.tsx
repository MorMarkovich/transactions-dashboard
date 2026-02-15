import { useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle, TrendingUp, Repeat, DollarSign, X } from 'lucide-react'
import type { MetricsData, AnomalyItem, RecurringTransaction, ForecastData } from '../../services/types'
import { formatCurrency } from '../../utils/formatting'

// ─── Types ─────────────────────────────────────────────────────────────

interface Alert {
  id: string
  type: 'warning' | 'danger' | 'info'
  icon: React.ReactNode
  title: string
  description: string
}

interface SpendingAlertsProps {
  metrics?: MetricsData | null
  anomalies?: AnomalyItem[]
  recurring?: RecurringTransaction[]
  forecast?: ForecastData | null
  dismissedAlerts?: Set<string>
  onDismiss?: (id: string) => void
}

const COLORS = {
  warning: { bg: 'rgba(245, 158, 11, 0.08)', border: 'rgba(245, 158, 11, 0.2)', icon: '#f59e0b' },
  danger: { bg: 'rgba(239, 68, 68, 0.08)', border: 'rgba(239, 68, 68, 0.2)', icon: '#ef4444' },
  info: { bg: 'rgba(59, 130, 246, 0.08)', border: 'rgba(59, 130, 246, 0.2)', icon: '#3b82f6' },
}

export default function SpendingAlerts({
  metrics,
  anomalies = [],
  recurring = [],
  forecast,
  dismissedAlerts = new Set(),
  onDismiss,
}: SpendingAlertsProps) {
  const alerts = useMemo<Alert[]>(() => {
    const result: Alert[] = []

    // High spending alert
    if (metrics && Math.abs(metrics.total_expenses) > Math.abs(metrics.total_income) && metrics.total_income > 0) {
      const overspend = Math.abs(metrics.total_expenses) - metrics.total_income
      result.push({
        id: 'overspend',
        type: 'danger',
        icon: <AlertTriangle size={18} />,
        title: 'הוצאות עולות על ההכנסות',
        description: `ההוצאות שלך גבוהות ב-${formatCurrency(overspend)} מההכנסות`,
      })
    }

    // Forecast trending up
    if (forecast?.trend_direction === 'up') {
      result.push({
        id: 'forecast-up',
        type: 'warning',
        icon: <TrendingUp size={18} />,
        title: 'מגמת עלייה בהוצאות',
        description: `התחזית לחודש הבא: ${formatCurrency(forecast.forecast_amount)}`,
      })
    }

    // Anomalies (significant deviations)
    anomalies.slice(0, 3).forEach((a, i) => {
      result.push({
        id: `anomaly-${i}`,
        type: 'warning',
        icon: <AlertTriangle size={18} />,
        title: `חריגה: ${a.description}`,
        description: `${formatCurrency(a.amount)} (ממוצע קטגוריה: ${formatCurrency(a.category_mean)})`,
      })
    })

    // High-cost recurring subscriptions
    recurring
      .filter((r) => r.average_amount > 200)
      .slice(0, 2)
      .forEach((r, i) => {
        result.push({
          id: `recurring-${i}`,
          type: 'info',
          icon: <Repeat size={18} />,
          title: `מנוי חוזר: ${r.merchant}`,
          description: `${formatCurrency(r.average_amount)} כל ${r.interval_days} ימים (${r.count} חיובים)`,
        })
      })

    // High average transaction
    if (metrics && Math.abs(metrics.average_transaction) > 500) {
      result.push({
        id: 'high-avg',
        type: 'info',
        icon: <DollarSign size={18} />,
        title: 'ממוצע עסקה גבוה',
        description: `הממוצע שלך ${formatCurrency(Math.abs(metrics.average_transaction))} לעסקה`,
      })
    }

    return result.filter((a) => !dismissedAlerts.has(a.id))
  }, [metrics, anomalies, recurring, forecast, dismissedAlerts])

  if (alerts.length === 0) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <AnimatePresence>
        {alerts.map((alert, idx) => {
          const colors = COLORS[alert.type]
          return (
            <motion.div
              key={alert.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, height: 0, marginBottom: 0 }}
              transition={{ delay: idx * 0.05, duration: 0.25 }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 16px',
                borderRadius: '12px',
                background: colors.bg,
                border: `1px solid ${colors.border}`,
                direction: 'rtl',
              }}
            >
              <span style={{ color: colors.icon, flexShrink: 0 }}>{alert.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {alert.title}
                </p>
                <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {alert.description}
                </p>
              </div>
              {onDismiss && (
                <button
                  onClick={() => onDismiss(alert.id)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '4px',
                    color: 'var(--text-muted)',
                    flexShrink: 0,
                  }}
                >
                  <X size={14} />
                </button>
              )}
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
