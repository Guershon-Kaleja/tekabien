import { useOffline } from '../context/OfflineContext'

export default function OfflineBanner() {
  const { isOnline, pendingCount, syncing } = useOffline()

  if (isOnline && pendingCount === 0) return null

  if (!isOnline) {
    return (
      <div className="bg-[#FFFBEB] border-b border-yellow-200 px-4 py-2 flex items-center gap-2">
        <span className="text-sm">📶</span>
        <div className="flex-1">
          <p className="text-xs font-semibold text-[#92400E]">Mode hors connexion</p>
          {pendingCount > 0 && (
            <p className="text-xs text-[#92400E]">{pendingCount} modification{pendingCount > 1 ? 's' : ''} en attente</p>
          )}
        </div>
      </div>
    )
  }

  if (syncing) {
    return (
      <div className="bg-[#EFF6FF] border-b border-blue-200 px-4 py-2 flex items-center gap-2">
        <span className="text-sm">🔄</span>
        <p className="text-xs font-semibold text-[#1E40AF]">Synchronisation en cours...</p>
      </div>
    )
  }

  if (pendingCount > 0) {
    return (
      <div className="bg-[#FFFBEB] border-b border-yellow-200 px-4 py-2 flex items-center gap-2">
        <span className="text-sm">⏳</span>
        <p className="text-xs font-semibold text-[#92400E]">
          {pendingCount} modification{pendingCount > 1 ? 's' : ''} à synchroniser
        </p>
      </div>
    )
  }

  return null
}
