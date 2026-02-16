import { useState, useCallback } from 'react'
import type {
  AnomalyItem,
  RecurringTransaction,
  ForecastData,
} from '../services/types'

// ─── Types ────────────────────────────────────────────────────────────

export type NotificationType = 'anomaly' | 'budget' | 'recurring' | 'forecast'
export type NotificationSeverity = 'info' | 'warning' | 'danger'

export interface NotificationItem {
  id: string
  type: NotificationType
  title: string
  message: string
  severity: NotificationSeverity
}

interface GenerateNotificationsParams {
  anomalies?: AnomalyItem[]
  recurring?: RecurringTransaction[]
  forecast?: ForecastData | null
  budgetGoals?: { category: string; limit: number }[]
  categorySpending?: Map<string, number>
}

// ─── Storage ──────────────────────────────────────────────────────────

const DISMISSED_KEY = 'notification-dismissed-ids'

function loadDismissedIds(): Set<string> {
  try {
    const stored = localStorage.getItem(DISMISSED_KEY)
    return stored ? new Set(JSON.parse(stored)) : new Set()
  } catch {
    return new Set()
  }
}

function saveDismissedIds(ids: Set<string>) {
  localStorage.setItem(DISMISSED_KEY, JSON.stringify(Array.from(ids)))
}

// ─── Hook ─────────────────────────────────────────────────────────────

export function useNotifications() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(loadDismissedIds)

  const generateNotifications = useCallback(
    ({
      anomalies = [],
      recurring = [],
      forecast = null,
      budgetGoals = [],
      categorySpending = new Map(),
    }: GenerateNotificationsParams) => {
      const items: NotificationItem[] = []

      // Anomaly notifications
      for (const anomaly of anomalies) {
        items.push({
          id: `anomaly-${anomaly.date}-${anomaly.description}`,
          type: 'anomaly',
          title: 'עסקה חריגה',
          message: `עסקה חריגה: ${anomaly.description}`,
          severity: 'warning',
        })
      }

      // Forecast notifications
      if (forecast && forecast.trend_direction === 'up') {
        items.push({
          id: 'forecast-trend-up',
          type: 'forecast',
          title: 'תחזית הוצאות',
          message: 'תחזית עלייה בהוצאות',
          severity: 'warning',
        })
      }

      // Recurring notifications
      if (recurring.length > 5) {
        items.push({
          id: `recurring-count-${recurring.length}`,
          type: 'recurring',
          title: 'תשלומים קבועים',
          message: `יש לך ${recurring.length} תשלומים קבועים`,
          severity: 'info',
        })
      }

      // Budget notifications
      for (const goal of budgetGoals) {
        const spent = categorySpending.get(goal.category) ?? 0
        if (goal.limit > 0 && spent > goal.limit) {
          items.push({
            id: `budget-over-${goal.category}`,
            type: 'budget',
            title: 'חריגה מתקציב',
            message: `חריגה מתקציב בקטגוריה: ${goal.category}`,
            severity: 'danger',
          })
        } else if (goal.limit > 0 && spent / goal.limit > 0.8) {
          items.push({
            id: `budget-warning-${goal.category}`,
            type: 'budget',
            title: 'אזהרת תקציב',
            message: `ניצול גבוה של תקציב בקטגוריה: ${goal.category}`,
            severity: 'warning',
          })
        }
      }

      // Filter out dismissed
      const filtered = items.filter((item) => !dismissedIds.has(item.id))
      setNotifications(filtered)

      return filtered
    },
    [dismissedIds],
  )

  const markAsRead = useCallback(
    (id: string) => {
      const updated = new Set(dismissedIds)
      updated.add(id)
      setDismissedIds(updated)
      saveDismissedIds(updated)
      setNotifications((prev) => prev.filter((n) => n.id !== id))
    },
    [dismissedIds],
  )

  const markAllRead = useCallback(() => {
    const updated = new Set(dismissedIds)
    for (const n of notifications) {
      updated.add(n.id)
    }
    setDismissedIds(updated)
    saveDismissedIds(updated)
    setNotifications([])
  }, [dismissedIds, notifications])

  const unreadCount = notifications.length

  return {
    notifications,
    unreadCount,
    markAsRead,
    markAllRead,
    generateNotifications,
  }
}
