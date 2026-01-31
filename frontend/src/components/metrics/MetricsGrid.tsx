import type { MetricsData } from '../../services/types'
import './MetricsGrid.css'

interface MetricsGridProps {
  metrics: MetricsData
}

export default function MetricsGrid({ metrics }: MetricsGridProps) {
  const formatCurrency = (value: number) => {
    return `₪${Math.abs(value).toLocaleString('he-IL', { maximumFractionDigits: 0 })}`
  }

  return (
    <div className="metrics-grid">
      <div className="metric-card">
        <div className="metric-icon-wrapper" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
          <span className="metric-icon">💳</span>
        </div>
        <span className="metric-value">{metrics.total_transactions.toLocaleString('he-IL')}</span>
        <div className="metric-label">עסקאות</div>
      </div>
      
      <div className="metric-card">
        <div className="metric-icon-wrapper" style={{ background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' }}>
          <span className="metric-icon">📉</span>
        </div>
        <span className="metric-value">{formatCurrency(metrics.total_expenses)}</span>
        <div className="metric-label">הוצאות</div>
        {metrics.trend && (
          <div className={`metric-trend ${metrics.trend}`}>
            {metrics.trend === 'up' ? '↑' : '↓'}
          </div>
        )}
      </div>
      
      <div className="metric-card">
        <div className="metric-icon-wrapper" style={{ background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' }}>
          <span className="metric-icon">📈</span>
        </div>
        <span className="metric-value">{formatCurrency(metrics.total_income)}</span>
        <div className="metric-label">הכנסות</div>
      </div>
      
      <div className="metric-card">
        <div className="metric-icon-wrapper" style={{ background: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)' }}>
          <span className="metric-icon">📊</span>
        </div>
        <span className="metric-value">{formatCurrency(metrics.average_transaction)}</span>
        <div className="metric-label">ממוצע לעסקה</div>
      </div>
    </div>
  )
}
