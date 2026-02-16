import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { Receipt, TrendingDown, TrendingUp, Calculator } from 'lucide-react'
import type { MetricsData } from '../../services/types'
import { formatCurrency, formatNumber } from '../../utils/formatting'
import AnimatedNumber from '../ui/AnimatedNumber'
import SparklineChart from '../charts/SparklineChart'
import './MetricsGrid.css'

interface MetricsGridProps {
  metrics: MetricsData
  monthlyAmounts?: number[]
}

interface MetricCardConfig {
  key: string
  label: string
  icon: React.ReactNode
  iconBg: string
  gradientBg: string
  sparklineColor: string
  accentColor: string
  getRawValue: (m: MetricsData) => number
  formatter: (v: number) => string
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

export default function MetricsGrid({ metrics, monthlyAmounts }: MetricsGridProps) {
  const cards = useMemo<MetricCardConfig[]>(
    () => [
      {
        key: 'total_transactions',
        label: 'סך עסקאות',
        icon: <Receipt size={22} color="#fff" />,
        iconBg: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        gradientBg: 'var(--gradient-stat-purple)',
        sparklineColor: '#818cf8',
        accentColor: 'var(--accent)',
        getRawValue: (m) => m.total_transactions,
        formatter: formatNumber,
      },
      {
        key: 'total_expenses',
        label: 'סך הוצאות',
        icon: <TrendingDown size={22} color="#fff" />,
        iconBg: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
        gradientBg: 'var(--gradient-stat-red)',
        sparklineColor: '#f5576c',
        accentColor: 'var(--danger)',
        getRawValue: (m) => Math.abs(m.total_expenses),
        formatter: formatCurrency,
      },
      {
        key: 'total_income',
        label: 'סך הכנסות',
        icon: <TrendingUp size={22} color="#fff" />,
        iconBg: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
        gradientBg: 'var(--gradient-stat-blue)',
        sparklineColor: '#4facfe',
        accentColor: 'var(--info)',
        getRawValue: (m) => m.total_income,
        formatter: formatCurrency,
      },
      {
        key: 'average_transaction',
        label: 'ממוצע לעסקה',
        icon: <Calculator size={22} color="#fff" />,
        iconBg: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
        gradientBg: 'var(--gradient-stat-green)',
        sparklineColor: '#43e97b',
        accentColor: 'var(--success)',
        getRawValue: (m) => Math.abs(m.average_transaction),
        formatter: formatCurrency,
      },
    ],
    [],
  )

  const rawValues = useMemo(
    () => cards.map((card) => card.getRawValue(metrics)),
    [cards, metrics],
  )

  // Generate sparkline data from monthly amounts or use placeholder
  const sparklineData = useMemo(() => {
    if (monthlyAmounts && monthlyAmounts.length > 1) {
      return monthlyAmounts.slice(-7)
    }
    return [3, 5, 4, 7, 6, 8, 7]
  }, [monthlyAmounts])

  return (
    <div className="card-grid-responsive" style={{ position: 'relative', zIndex: 1 }}>
      {cards.map((card, index) => (
        <motion.div
          key={card.key}
          custom={index}
          variants={cardVariants}
          initial="hidden"
          animate="visible"
        >
          <div
            className="stat-card-compact"
            style={{ background: card.gradientBg }}
          >
            <div
              className="stat-icon"
              style={{ background: card.iconBg, borderRadius: 'var(--radius-lg)' }}
            >
              {card.icon}
            </div>
            <div className="stat-content">
              <div className="stat-value">
                <AnimatedNumber value={rawValues[index]} formatter={card.formatter} />
              </div>
              <div className="stat-label">{card.label}</div>
              {card.key === 'total_expenses' && metrics.trend && (
                <div className={`stat-trend ${metrics.trend === 'up' ? 'up' : 'down'}`}>
                  {metrics.trend === 'up' ? '↑ עלייה' : '↓ ירידה'}
                </div>
              )}
            </div>
            <div className="stat-sparkline">
              <SparklineChart
                data={sparklineData}
                color={card.sparklineColor}
                width={64}
                height={28}
              />
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  )
}
