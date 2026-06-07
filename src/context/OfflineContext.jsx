import { createContext, useContext, useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { getPendingCount, sync, pull } from '../lib/syncEngine'
import { UserContext } from './UserContext'

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
    if (userId && navigator.onLine) {
      pull(userId).then(refreshPending)
    } else if (userId) {
      refreshPending()
    }
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
