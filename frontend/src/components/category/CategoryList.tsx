import type { CategoryData } from '../../services/types'
import { get_icon } from '../../utils/constants'
import './CategoryList.css'

interface CategoryListProps {
  categories: CategoryData[]
}

export default function CategoryList({ categories }: CategoryListProps) {
  const total = categories.reduce((sum, cat) => sum + cat.סכום_מוחלט, 0)
  const iconGradients = [
    'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
    'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
  ]
  const barColors = ['#667eea', '#f5576c', '#4facfe', '#43e97b', '#fa709a', '#b794f4', '#a0aec0']

  const formatCurrency = (value: number) => {
    return `₪${Math.abs(value).toLocaleString('he-IL', { maximumFractionDigits: 0 })}`
  }

  return (
    <div className="category-list">
      {categories.map((category, index) => {
        const percent = total > 0 ? (category.סכום_מוחלט / total) * 100 : 0
        const gradient = iconGradients[index % iconGradients.length]
        const barColor = barColors[index % barColors.length]
        
        return (
          <div key={index} className="category-card">
            <div className="category-icon-wrapper" style={{ background: gradient }}>
              {get_icon(category.קטגוריה)}
            </div>
            <div className="category-info">
              <div className="category-name">{category.קטגוריה}</div>
              <div className="category-bar-container">
                <div 
                  className="category-bar" 
                  style={{ width: `${percent}%`, background: barColor }}
                />
              </div>
            </div>
            <div className="category-stats">
              <div className="category-amount">{formatCurrency(category.סכום_מוחלט)}</div>
              <div className="category-percent">{percent.toFixed(1)}%</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
