import { useNavigate } from 'react-router-dom'
import { useOffline } from '../context/OfflineContext'

export default function Header({ title, showBack = true, showAdd = false, onAdd }) {
  const navigate = useNavigate()
  const { isOnline } = useOffline()

  return (
    <div className="bg-[#1A56DB] px-4 pb-4 flex items-center justify-between" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 1rem)' }}>
      <div className="flex items-center gap-3">
        {showBack && (
          <button
            onClick={() => navigate(-1)}
            className="w-8 h-8 bg-white/15 rounded-lg flex items-center justify-center"
          >
            <span className="text-white">←</span>
          </button>
        )}
        <div className="flex items-center gap-2">
          <h1 className="text-white font-semibold text-base">{title}</h1>
          {!isOnline && (
            <span className="w-2 h-2 rounded-full bg-yellow-300 inline-block" title="Hors connexion" />
          )}
        </div>
      </div>
      {showAdd && (
        <button
          onClick={onAdd}
          className="w-8 h-8 bg-white/15 rounded-lg flex items-center justify-center"
        >
          <span className="text-white font-bold text-lg">+</span>
        </button>
      )}
    </div>
  )
}