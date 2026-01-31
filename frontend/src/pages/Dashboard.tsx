import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import MetricsGrid from '../components/metrics/MetricsGrid'
import DonutChart from '../components/charts/DonutChart'
import BarChart from '../components/charts/BarChart'
import WeekdayChart from '../components/charts/WeekdayChart'
import CategoryList from '../components/category/CategoryList'
import EmptyState from '../components/common/EmptyState'
import { transactionsApi } from '../services/api'
import type { MetricsData, ChartData, CategoryData } from '../services/types'

export default function Dashboard() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const sessionId = searchParams.get('session_id')
  
  const [metrics, setMetrics] = useState<MetricsData | null>(null)
  const [donutChart, setDonutChart] = useState<ChartData | null>(null)
  const [monthlyChart, setMonthlyChart] = useState<ChartData | null>(null)
  const [weekdayChart, setWeekdayChart] = useState<ChartData | null>(null)
  const [categories, setCategories] = useState<CategoryData[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!sessionId) return

    const loadData = async () => {
      setLoading(true)
      try {
        const [metricsData, donutData, monthlyData, weekdayData] = await Promise.all([
          transactionsApi.getMetrics(sessionId),
          transactionsApi.getDonutChart(sessionId),
          transactionsApi.getMonthlyChart(sessionId),
          transactionsApi.getWeekdayChart(sessionId),
        ])

        setMetrics(metricsData)
        setDonutChart(donutData)
        setMonthlyChart(monthlyData)
        setWeekdayChart(weekdayData)

        // Extract categories from donut chart data
        if (donutData.data && donutData.data[0]?.labels) {
          const cats: CategoryData[] = donutData.data[0].labels.map((label, i) => ({
            קטגוריה: label,
            סכום_מוחלט: donutData.data[0].values?.[i] || 0,
          }))
          setCategories(cats)
        }
      } catch (error: any) {
        console.error('Error loading dashboard data:', error)
        // If session not found (404), redirect to home without session to prompt upload
        if (error.response?.status === 404) {
          navigate('/', { replace: true })
        }
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [sessionId])

  if (!sessionId) {
    return (
      <>
        <EmptyState
          icon="📊"
          title="ברוכים הבאים לדאשבורד!"
          text="העלה קובץ אקסל או CSV מחברת האשראי שלך כדי להתחיל בניתוח"
        />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-lg)', marginTop: 'var(--space-xl)' }}>
          <div className="feature-card">
            <div className="feature-icon">📊</div>
            <div className="feature-title">ניתוח ויזואלי</div>
            <div className="feature-desc">גרפים אינטראקטיביים וחכמים לתובנות מיידיות</div>
          </div>
          <div className="feature-card">
            <div className="feature-icon">🏷️</div>
            <div className="feature-title">קטגוריות אוטומטיות</div>
            <div className="feature-desc">זיהוי אוטומטי של קטגוריות מהקובץ המקורי</div>
          </div>
          <div className="feature-card">
            <div className="feature-icon">📑</div>
            <div className="feature-title">תמיכה מלאה</div>
            <div className="feature-desc">Excel עם מספר גליונות, CSV בעברית מלאה</div>
          </div>
        </div>
      </>
    )
  }

  if (loading) {
    return <div className="loading">טוען נתונים...</div>
  }

  if (!metrics) {
    return <div className="error">שגיאה בטעינת הנתונים</div>
  }

  return (
    <div>
      <MetricsGrid metrics={metrics} />
      
      <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 'var(--space-lg)', marginTop: 'var(--space-xl)' }}>
        <div>
          <div className="section-title">
            <span>📅</span> הוצאות לפי חודש
          </div>
          {monthlyChart && <BarChart data={monthlyChart} />}

          <div className="section-title" style={{ marginTop: 'var(--space-lg)' }}>
            <span>📆</span> התפלגות לפי יום בשבוע
          </div>
          {weekdayChart && <WeekdayChart data={weekdayChart} />}
        </div>

        <div>
          <div className="section-title">
            <span>🥧</span> חלוקה לפי קטגוריה
          </div>
          {donutChart && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px 0' }}>
              <DonutChart data={donutChart} />
            </div>
          )}

          <div className="section-title" style={{ marginTop: 'var(--space-lg)' }}>
            <span>📋</span> פירוט קטגוריות
          </div>
          {categories.length > 0 && <CategoryList categories={categories} />}
        </div>
      </div>
    </div>
  )
}
