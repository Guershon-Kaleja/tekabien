import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState, lazy, Suspense } from 'react'
import { supabase } from './lib/supabase'
import useAutoLogout from './hooks/useAutoLogout'
import InstallBanner from './components/InstallBanner'

const Login = lazy(() => import('./pages/Login'))
const Onboarding = lazy(() => import('./pages/Onboarding'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Ventes = lazy(() => import('./pages/Ventes'))
const Stocks = lazy(() => import('./pages/Stocks'))
const Clients = lazy(() => import('./pages/Clients'))
const Depenses = lazy(() => import('./pages/Depenses'))
const Rapports = lazy(() => import('./pages/Rapports'))
const Expired = lazy(() => import('./pages/Expired'))
const ResetPassword = lazy(() => import('./pages/ResetPassword'))
const Profil = lazy(() => import('./pages/Profil'))

function DesktopRedirect() {
  return (
    <div className="min-h-screen bg-[#EEF2F7] flex items-center justify-center p-8">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-10 text-center">
        <img src="/icon-192.png" alt="TekaBien" className="w-20 h-20 rounded-2xl mx-auto mb-6" />
        <h1 className="text-2xl font-black text-[#0F172A] mb-2">
          <span className="text-[#1A56DB]">Teka</span>
          <span className="text-[#F5A623]">Bien</span>
        </h1>
        <p className="text-[#64748B] text-sm mb-2">Fini le cahier, place au digital</p>

        <div className="bg-[#EEF2F7] rounded-2xl p-4 my-6">
          <p className="text-sm font-semibold text-[#0F172A] mb-1">
            📱 Application mobile uniquement
          </p>
          <p className="text-xs text-[#64748B] leading-relaxed">
            TekaBien est conçu pour les smartphones. 
            Scannez le QR code ou téléchargez l'app sur votre téléphone Android.
          </p>
        </div>

        {/* QR Code — pointe vers Google Play */}
        <div className="bg-white border-2 border-gray-100 rounded-2xl p-4 mb-6 inline-block">
          <img
            src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=https://play.google.com/store/apps/details?id=com.tekabien`}
            alt="QR Code TekaBien"
            className="w-36 h-36 mx-auto"
          />
          <p className="text-xs text-[#64748B] mt-2">Scanner avec votre téléphone</p>
        </div>

        {/* Boutons */}
        <div className="space-y-3">
          <a
            href="https://play.google.com/store/apps/details?id=com.tekabien"
            className="flex items-center justify-center gap-3 bg-black text-white px-6 py-3 rounded-xl font-semibold text-sm hover:bg-gray-900 transition-colors"
          >
            <span className="text-xl">▶</span>
            <div className="text-left">
              <p className="text-xs text-gray-400">Disponible sur</p>
              <p className="text-sm font-bold">Google Play</p>
            </div>
          </a>

          <div className="flex items-center justify-center gap-3 bg-gray-100 text-gray-400 px-6 py-3 rounded-xl text-sm">
            <span className="text-xl"></span>
            <div className="text-left">
              <p className="text-xs">Bientôt sur</p>
              <p className="text-sm font-medium">App Store</p>
            </div>
          </div>
        </div>

        <p className="text-xs text-[#64748B] mt-6">
          En savoir plus sur{' '}
          <a href="https://tekabien.com" className="text-[#1A56DB] font-medium hover:underline">
            tekabien.com
          </a>
        </p>
      </div>
    </div>
  )
}

function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [retrying, setRetrying] = useState(false)
  const [retryFailed, setRetryFailed] = useState(false)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const handleRetry = async () => {
    setRetrying(true)
    setRetryFailed(false)
    try {
      await fetch('https://www.google.com/favicon.ico', {
        mode: 'no-cors',
        cache: 'no-store'
      })
      window.location.reload()
    } catch {
      setRetrying(false)
      setRetryFailed(true)
    }
  }

  useAutoLogout()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => setSession(session)
    )
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // PC et tablette → page redirection
  if (!isMobile) {
    return <DesktopRedirect />
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFF] flex items-center justify-center">
        <div className="text-center">
          <img src="/icon-192.png" alt="TekaBien" className="w-16 h-16 rounded-2xl mx-auto mb-4" />
          <p className="text-[#1A56DB] font-bold text-xl">TekaBien</p>
          <p className="text-[#64748B] text-sm mt-1">Chargement...</p>
        </div>
      </div>
    )
  }

  if (!isOnline) {
    return (
      <div className="min-h-screen bg-[#EEF2F7] flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-white rounded-2xl border border-gray-200 p-8 text-center shadow-sm">
          <div className="w-20 h-20 bg-[#FFFBEB] rounded-full flex items-center justify-center mx-auto mb-5">
            <span className="text-4xl">📶</span>
          </div>
          <h2 className="text-lg font-bold text-[#0F172A] mb-2">Pas de connexion</h2>
          <p className="text-sm text-[#64748B] leading-relaxed mb-2">
            TekaBien nécessite une connexion internet pour fonctionner.
          </p>
          <p className="text-xs text-[#64748B] mb-6">
            Vérifie ton réseau Airtel, Orange, M-Pesa ou Africell et réessaie.
          </p>
          <button
            onClick={handleRetry}
            disabled={retrying}
            className="w-full bg-[#1A56DB] text-white rounded-xl py-3 font-semibold text-sm mb-3 disabled:opacity-50"
          >
            {retrying ? '🔄 Vérification...' : '🔄 Réessayer'}
          </button>
          {retryFailed && (
            <p className="text-xs text-[#DC2626] font-medium mb-3">
              Toujours pas de connexion — vérifie ton réseau
            </p>
          )}
          <p className="text-xs text-[#64748B]">
            Tes données sont sauvegardées — rien n'est perdu.
          </p>
        </div>
      </div>
    )
  }

  return (
    <BrowserRouter>
      <div className="max-w-md mx-auto bg-[#EEF2F7] min-h-screen">
        <InstallBanner />
        <Suspense fallback={
          <div className="bg-[#EEF2F7] flex items-center justify-center" style={{ height: '100dvh' }}>
            <div className="text-center">
              <img src="/icon-192.png" alt="TekaBien" className="w-16 h-16 rounded-2xl mx-auto mb-4" />
              <p className="text-[#1A56DB] font-bold text-xl">TekaBien</p>
            </div>
          </div>
        }>
          <Routes>
            <Route path="/login" element={!session ? <Login /> : <Navigate to="/" />} />
            <Route path="/onboarding" element={<Onboarding />} />
            <Route path="/" element={session ? <Dashboard /> : <Navigate to="/login" />} />
            <Route path="/ventes" element={session ? <Ventes /> : <Navigate to="/login" />} />
            <Route path="/stocks" element={session ? <Stocks /> : <Navigate to="/login" />} />
            <Route path="/clients" element={session ? <Clients /> : <Navigate to="/login" />} />
            <Route path="/depenses" element={session ? <Depenses /> : <Navigate to="/login" />} />
            <Route path="/rapports" element={session ? <Rapports /> : <Navigate to="/login" />} />
            <Route path="/expired" element={<Expired />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/profil" element={session ? <Profil /> : <Navigate to="/login" />} />
          </Routes>
        </Suspense>
      </div>
    </BrowserRouter>
  )
}

export default App