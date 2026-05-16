import { useNavigate } from 'react-router-dom'

export default function Onboarding() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-[#F8FAFF] flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl border border-gray-100 p-6 text-center">
        <div className="flex justify-center gap-2 mb-6">
          <div className="w-6 h-2 bg-[#1A56DB] rounded-full"></div>
          <div className="w-2 h-2 bg-gray-200 rounded-full"></div>
          <div className="w-2 h-2 bg-gray-200 rounded-full"></div>
        </div>
        <div className="w-16 h-16 bg-[#EBF2FF] rounded-2xl flex items-center justify-center mx-auto mb-4">
          <span className="text-3xl">🏪</span>
        </div>
        <h2 className="text-lg font-bold text-[#0F172A] mb-2">Bienvenue sur TekaBien !</h2>
        <p className="text-sm text-[#64748B] leading-relaxed mb-2">
          Boutique, vente en ligne, service ou artisanat — TekaBien s'adapte à ton activité.
        </p>
        <p className="text-sm text-[#64748B] leading-relaxed mb-6">
          Commence par enregistrer ta première vente. C'est simple et rapide.
        </p>
        <button
          onClick={() => navigate('/')}
          className="w-full bg-[#1A56DB] text-white rounded-xl py-3 font-semibold text-sm"
        >
          Commencer maintenant →
        </button>
      </div>
    </div>
  )
}