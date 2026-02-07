import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { Receipt, TrendingDown, TrendingUp, Calculator } from 'lucide-react'
import type { MetricsData } from '../../services/types'
import { formatCurrency, formatNumber } from '../../utils/formatting'
import Card from '../ui/Card'
import Badge from '../ui/Badge'
import './MetricsGrid.css'

interface MetricsGridProps {
  metrics: MetricsData
}

interface MetricCardConfig {
  key: string
  label: string
  icon: React.ReactNode
  gradient: string
  getValue: (m: MetricsData) => string
  isCurrency: boolean
}

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.1,
      duration: 0.4,
      ease: [0.4, 0, 0.2, 1] as const,
    },
  }),
}

export default function MetricsGrid({ metrics }: MetricsGridProps) {
  const cards = useMemo<MetricCardConfig[]>(
    () => [
      {
        key: 'total_transactions',
        label: 'סך עסקאות',
        icon: <Receipt size={24} color="#fff" />,
        gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        getValue: (m) => formatNumber(m.total_transactions),
        isCurrency: false,
      },
      {
        key: 'total_expenses',
        label: 'סך הוצאות',
        icon: <TrendingDown size={24} color="#fff" />,
        gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
        getValue: (m) => formatCurrency(Math.abs(m.total_expenses)),
        isCurrency: true,
      },
      {
        key: 'total_income',
        label: 'סך הכנסות',
        icon: <TrendingUp size={24} color="#fff" />,
        gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
        getValue: (m) => formatCurrency(m.total_income),
        isCurrency: true,
      },
      {
        key: 'average_transaction',
        label: 'ממוצע לעסקה',
        icon: <Calculator size={24} color="#fff" />,
        gradient: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
        getValue: (m) => formatCurrency(Math.abs(m.average_transaction)),
        isCurrency: true,
      },
    ],
    [],
  )

  const formattedValues = useMemo(
    () => cards.map((card) => card.getValue(metrics)),
    [cards, metrics],
  )

  return (
    <div className="metrics-grid">
      {cards.map((card, index) => (
        <motion.div
          key={card.key}
          custom={index}
          variants={cardVariants}
          initial="hidden"
          animate="visible"
        >
          <Card className="metric-card" hover padding="lg">
            <div
              className="metric-icon-wrapper"
              style={{ background: card.gradient }}
            >
              {card.icon}
            </div>

            <span className="metric-value">{formattedValues[index]}</span>

            <div className="metric-label">{card.label}</div>

            {card.key === 'total_expenses' && metrics.trend && (
              <div style={{ marginTop: 'var(--space-sm)' }}>
                <Badge
                  variant={metrics.trend === 'up' ? 'danger' : 'success'}
                  size="sm"
                >
                  {metrics.trend === 'up' ? (
                    <>
                      <TrendingUp size={12} />
                      עלייה
                    </>
                  ) : (
                    <>
                      <TrendingDown size={12} />
                      ירידה
                    </>
                  )}
                </Badge>
              </div>
            )}
          </Card>
        </motion.div>
      ))}
    </div>
  )
}
