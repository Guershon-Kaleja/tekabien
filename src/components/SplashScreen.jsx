import { useEffect, useState } from 'react'

export default function SplashScreen({ onDone }) {
  const [phase, setPhase] = useState('in') // 'in' | 'hold' | 'out'

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('hold'), 600)
    const t2 = setTimeout(() => setPhase('out'), 3200)
    const t3 = setTimeout(() => onDone(), 3700)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [onDone])

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: '#1A56DB',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        transition: 'opacity 0.5s ease',
        opacity: phase === 'out' ? 0 : 1,
        pointerEvents: phase === 'out' ? 'none' : 'all',
      }}
    >
      <div
        style={{
          transition: 'transform 0.6s cubic-bezier(0.34,1.56,0.64,1), opacity 0.6s ease',
          transform: phase === 'in' ? 'scale(0.6)' : 'scale(1)',
          opacity: phase === 'in' ? 0 : 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px',
        }}
      >
        <img
          src="/icon-192.png"
          alt="TekaBien"
          style={{ width: 96, height: 96, borderRadius: 24 }}
        />
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: '#fff', fontWeight: 800, fontSize: 28, margin: 0, letterSpacing: '-0.5px' }}>
            TekaBien
          </p>
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, margin: '4px 0 0' }}>
            Gestion simple, vente rapide
          </p>
        </div>
      </div>
    </div>
  )
}
