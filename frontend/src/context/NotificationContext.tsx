import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'

export interface AppNotification {
  id: string
  type: 'anomaly' | 'upload' | 'insight'
  title: string
  message: string
  time: string
  read: boolean
}

interface NotificationContextValue {
  notifications: AppNotification[]
  setNotifications: (items: AppNotification[]) => void
  clearNotifications: () => void
}

const NotificationContext = createContext<NotificationContextValue>({
  notifications: [],
  setNotifications: () => {},
  clearNotifications: () => {},
})

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotificationsState] = useState<AppNotification[]>([])

  const setNotifications = useCallback((items: AppNotification[]) => {
    setNotificationsState(items)
  }, [])

  const clearNotifications = useCallback(() => {
    setNotificationsState([])
  }, [])

  return (
    <NotificationContext.Provider value={{ notifications, setNotifications, clearNotifications }}>
      {children}
    </NotificationContext.Provider>
  )
}

export function useAppNotifications() {
  return useContext(NotificationContext)
}
