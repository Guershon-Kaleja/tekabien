import { useNavigate } from 'react-router-dom'

export default function Header({ title, showBack = true, showAdd = false, onAdd }) {
  const navigate = useNavigate()

  return (
    <div className="bg-[#1A56DB] px-4 py-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        {showBack && (
          <button
            onClick={() => navigate(-1)}
            className="w-8 h-8 bg-white/15 rounded-lg flex items-center justify-center"
          >
            <span className="text-white">←</span>
          </button>
        )}
        <h1 className="text-white font-semibold text-base">{title}</h1>
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