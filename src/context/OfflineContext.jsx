import { createContext, useContext, useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { getPendingCount, sync, pull } from '../lib/syncEngine'
import { UserContext } from './UserContext'
import { localDb } from '../lib/localDb'
import { requestNotificationPermission, notifyOverdueDebts, scheduleDailySummary } from '../lib/notifications'

export const OfflineContext = createContext({
  isOnline: true,
  pendingCount: 0,
  syncing: false,
  triggerSync: () => {},
})

export function OfflineProvider({ children }) {
  const { userId } = useContext(UserContext)
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [pendingCount, setPendingCount] = useState(0)
  const [syncing, setSyncing] = useState(false)
  const syncingRef = useRef(false)

  const refreshPending = useCallback(async () => {
    const count = await getPendingCount()
    setPendingCount(count)
  }, [])

  const triggerSync = useCallback(async () => {
    if (!userId || syncingRef.current || !navigator.onLine) return
    syncingRef.current = true
    setSyncing(true)
    try {
      await sync(userId)
    } finally {
      syncingRef.current = false
      setSyncing(false)
      await refreshPending()
    }
  }, [userId, refreshPending])

  // Pull initial quand le userId est disponible et qu'on est en ligne
  useEffect(() => {
    if (!userId) return

    const init = async () => {
      await requestNotificationPermission().catch(() => {})

      if (navigator.onLine) await pull(userId)
      await refreshPending()

      // Vérification dettes en retard
      const today = new Date().toISOString().split('T')[0]
      const overdueDebts = await localDb.debts
        .where('user_id').equals(userId)
        .and(d => d.status === 'pending' && d.due_date && d.due_date < today)
        .toArray()

      if (overdueDebts.length) {
        const customerIds = [...new Set(overdueDebts.map(d => d.customer_id).filter(Boolean))]
        const customers = await localDb.customers.bulkGet(customerIds)
        const clientsMap = Object.fromEntries(customers.filter(Boolean).map(c => [c.id, c]))
        const overdueClients = customerIds.map(id => clientsMap[id]).filter(Boolean)
        notifyOverdueDebts(overdueClients).catch(() => {})
      }

      // Résumé quotidien
      const startOfDay = new Date()
      startOfDay.setHours(0, 0, 0, 0)
      const todaySales = await localDb.sales
        .where('user_id').equals(userId)
        .and(s => new Date(s.created_at) >= startOfDay)
        .toArray()
      const totalToday = todaySales.reduce((sum, s) => sum + (s.total || 0), 0)
      scheduleDailySummary(todaySales.length, totalToday).catch(() => {})
    }

    init()
  }, [userId, refreshPending])

  // Détection online/offline
  useEffect(() => {
    const goOnline = async () => {
      setIsOnline(true)
      await triggerSync()
    }
    const goOffline = () => setIsOnline(false)

    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [triggerSync])

  const value = useMemo(
    () => ({ isOnline, pendingCount, syncing, triggerSync, refreshPending }),
    [isOnline, pendingCount, syncing, triggerSync, refreshPending]
  )

  return (
    <OfflineContext.Provider value={value}>
      {children}
    </OfflineContext.Provider>
  )
}

export function useOffline() {
  return useContext(OfflineContext)
}
