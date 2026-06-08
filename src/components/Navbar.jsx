import { useNavigate, useLocation } from 'react-router-dom'
import { hapticLight } from '../lib/haptics'

const items = [
  { icon: '🏠', label: 'Accueil', path: '/' },
  { icon: '🛒', label: 'Ventes', path: '/ventes' },
  { icon: '📦', label: 'Stocks', path: '/stocks' },
  { icon: '👥', label: 'Clients', path: '/clients' },
  { icon: '📊', label: 'Rapports', path: '/rapports' },
]

export default function Navbar() {
  const navigate = useNavigate()
  const { pathname } = useLocation()

  const handleNav = (path) => {
    if (pathname === path) return
    hapticLight()
    navigate(path)
  }

  return (
    <div
      className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 flex justify-around px-1 z-40"
      style={{ paddingTop: '6px', paddingBottom: 'max(env(safe-area-inset-bottom), 4px)' }}
    >
      {items.map((item) => (
        <button
          key={item.path}
          onClick={() => handleNav(item.path)}
          className="flex flex-col items-center gap-0.5 flex-1 relative"
        >
          {pathname === item.path && (
            <div className="absolute -top-[7px] left-1/4 right-1/4 h-0.5 bg-[#1A56DB] rounded-full" />
          )}
          <span className={`text-lg leading-none transition-transform duration-150 ${pathname === item.path ? 'scale-110' : ''}`}>
            {item.icon}
          </span>
          <span className={`text-[10px] font-medium transition-colors duration-150 ${
            pathname === item.path ? 'text-[#1A56DB]' : 'text-[#64748B]'
          }`}>
            {item.label}
          </span>
        </button>
      ))}
    </div>
  )
}