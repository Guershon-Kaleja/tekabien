import { useState, useEffect } from 'react'

export default function InstallBanner() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    // Détecter iOS
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
    // Détecter si déjà installé en PWA
    const isInstalled = window.navigator.standalone === true
    // Détecter si déjà fermé
    const dismissed = localStorage.getItem('ios_banner_dismissed')

    if (isIOS && !isInstalled && !dismissed) {
      setShow(true)
    }
  }, [])

  if (!show) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-white border-t border-gray-200 shadow-xl">
      <div className="max-w-md mx-auto">
        <div className="flex items-start gap-3">
          <img src="/icon-192.png" alt="TekaBien" className="w-12 h-12 rounded-xl flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-bold text-[#0F172A] mb-1">
              Installer TekaBien sur votre iPhone
            </p>
            <p className="text-xs text-[#64748B] leading-relaxed mb-3">
              TekaBien n'est pas encore sur l'App Store mais vous pouvez l'installer facilement :
            </p>
            <div className="space-y-2">
             {[
                { step: '1', text: 'Appuyez sur les 3 points ··· en en bas à droite', icon: '⋯' },
                { step: '2', text: 'Appuyez sur "Partager"', icon: '⬆️' },
                { step: '3', text: 'Appuyez encore sur les 3 points ···', icon: '⋯' },
                { step: '4', text: 'Appuyez sur "+" ou "Écran d\'accueil"', icon: '➕' },
                ].map((s) => (
                <div key={s.step} className="flex items-center gap-2">
                    <span className="w-5 h-5 bg-[#1A56DB] text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {s.step}
                    </span>
                    <span className="text-xs text-[#64748B]">{s.icon} {s.text}</span>
                </div>
                ))}
            </div>
          </div>
          <button
            onClick={() => {
              localStorage.setItem('ios_banner_dismissed', 'true')
              setShow(false)
            }}
            className="text-[#64748B] text-xl flex-shrink-0"
          >
            ✕
          </button>
        </div>

        {/* Flèche pointant vers le bas (bouton partager iOS) */}
        <div className="flex justify-center mt-3">
          <div className="flex items-center gap-2 bg-[#EBF2FF] rounded-xl px-4 py-2">
            <span className="text-[#1A56DB] text-lg">⬆️</span>
            <p className="text-xs text-[#1A56DB] font-semibold">
              Le bouton Partager est en bas de Safari
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}