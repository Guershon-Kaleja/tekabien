import { useNavigate } from 'react-router-dom'

const items = [
  { icon: '🏠', label: 'Accueil', path: '/' },
  { icon: '🛒', label: 'Ventes', path: '/ventes' },
  { icon: '📦', label: 'Stocks', path: '/stocks' },
  { icon: '👥', label: 'Clients', path: '/clients' },
  { icon: '📊', label: 'Rapports', path: '/rapports' },
]

export default function Navbar() {
  const navigate = useNavigate()
  const current = window.location.pathname

  return (
    <div
        className="fixed bottom-0 w-full max-w-md bg-white border-t border-gray-100 flex justify-around py-2 px-2 z-40"
        style={{ 
          paddingBottom: 'env(safe-area-inset-bottom, 8px)',
          left: '50%',
          transform: 'translateX(-50%)',
          WebkitTransform: 'translateX(-50%)',
          position: 'fixed',
          willChange: 'transform',
        }}
      >
      {items.map((item) => (
        <button
          key={item.path}
          onClick={() => navigate(item.path)}
          className="flex flex-col items-center gap-1 flex-1"
        >
          <span className={`text-xl ${current === item.path ? 'scale-110' : ''}`}>
            {item.icon}
          </span>
          <span className={`text-xs font-medium ${
            current === item.path ? 'text-[#1A56DB]' : 'text-[#64748B]'
          }`}>
            {item.label}
          </span>
          {current === item.path && (
            <div className="w-1 h-1 rounded-full bg-[#1A56DB]" />
          )}
        </button>
      ))}
    </div>
  )
}