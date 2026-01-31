import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import LineChart from '../components/charts/LineChart'
import EmptyState from '../components/common/EmptyState'
import { transactionsApi } from '../services/api'
import type { ChartData } from '../services/types'

export default function Trends() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const sessionId = searchParams.get('session_id')
  
  const [trendChart, setTrendChart] = useState<ChartData | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!sessionId) return

    const loadTrendData = async () => {
      setLoading(true)
      try {
        const data = await transactionsApi.getTrendChart(sessionId)
        setTrendChart(data)
      } catch (error: any) {
        console.error('Error loading trend data:', error)
        if (error.response?.status === 404) {
          navigate('/', { replace: true })
        }
      } finally {
        setLoading(false)
      }
    }

    loadTrendData()
  }, [sessionId])

  if (!sessionId) {
    return (
      <EmptyState
        icon="📈"
        title="מגמות ונתונים"
        text="העלה קובץ כדי לראות מגמות"
      />
    )
  }

  if (loading) {
    return <div className="loading">טוען נתונים...</div>
  }

  return (
    <div>
      <div className="section-title">
        <span>📈</span> מגמת מאזן מצטבר
      </div>
      {trendChart && <LineChart data={trendChart} />}
    </div>
  )
}
