import { useMemo } from 'react'
import { motion } from 'framer-motion'
import type { CategoryData } from '../../services/types'
import { get_icon } from '../../utils/constants'
import { formatCurrency, formatPercent } from '../../utils/formatting'
import ProgressBar from '../ui/ProgressBar'
import './CategoryList.css'

interface CategoryListProps {
  categories: CategoryData[]
}

// Module-level constants - outside the component to avoid recreation on each render
const ICON_GRADIENTS = [
  'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
  'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
  'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
  'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
  'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)',
  'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)',
] as const

const BAR_COLORS = [
  '#667eea',
  '#f5576c',
  '#4facfe',
  '#43e97b',
  '#fa709a',
  '#b794f4',
  '#a0aec0',
] as const

const cardVariants = {
  hidden: { opacity: 0, x: 20 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: {
      delay: i * 0.06,
      duration: 0.35,
      ease: [0.4, 0, 0.2, 1] as const,
    },
  }),
}

export default function CategoryList({ categories }: CategoryListProps) {
  const { sortedCategories, total } = useMemo(() => {
    const sorted = [...categories].sort(
      (a, b) => b.סכום_מוחלט - a.סכום_מוחלט,
    )
    const sum = sorted.reduce((acc, cat) => acc + cat.סכום_מוחלט, 0)
    return { sortedCategories: sorted, total: sum }
  }, [categories])

  const percentages = useMemo(
    () =>
      sortedCategories.map((cat) =>
        total > 0 ? (cat.סכום_מוחלט / total) * 100 : 0,
      ),
    [sortedCategories, total],
  )

  if (sortedCategories.length === 0) {
    return (
      <div
        style={{
          textAlign: 'center',
          padding: 'var(--space-xl)',
          color: 'var(--text-muted)',
        }}
      >
        אין נתוני קטגוריות להצגה
      </div>
    )
  }

  return (
    <div className="category-list">
      {sortedCategories.map((category, index) => {
        const percent = percentages[index]
        const gradient = ICON_GRADIENTS[index % ICON_GRADIENTS.length]
        const barColor = BAR_COLORS[index % BAR_COLORS.length]

        return (
          <motion.div
            key={category.קטגוריה}
            className="category-card"
            custom={index}
            variants={cardVariants}
            initial="hidden"
            animate="visible"
          >
            {/* Icon */}
            <div
              className="category-icon-wrapper"
              style={{ background: gradient }}
            >
              {get_icon(category.קטגוריה)}
            </div>

            {/* Name + Progress Bar */}
            <div className="category-info">
              <div className="category-name">{category.קטגוריה}</div>
              <ProgressBar
                value={percent}
                color={barColor}
                height={6}
                animated
              />
            </div>

            {/* Amount + Percentage */}
            <div className="category-stats">
              <div className="category-amount">
                {formatCurrency(category.סכום_מוחלט)}
              </div>
              <div className="category-percent">
                {formatPercent(percent)}
              </div>
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}
