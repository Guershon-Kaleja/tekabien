import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useEffect, useState, lazy, Suspense } from 'react'
import { supabase } from './lib/supabase'
import { OfflineProvider } from './context/OfflineContext'
import Navbar from './components/Navbar'
import SplashScreen from './components/SplashScreen'

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

const NO_NAVBAR = ['/login', '/onboarding', '/expired', '/reset-password']

function AppRoutes({ session }) {
  const { pathname } = useLocation()
  const showNavbar = session && !NO_NAVBAR.includes(pathname)

  return (
    <>
      <div key={pathname} className="page-enter">
        <Routes>
          <Route path="/login" element={!session ? <Login /> : <Navigate to="/" />} />
          <Route path="/onboarding" element={session ? <Onboarding /> : <Navigate to="/login" />} />
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
      </div>
      {showNavbar && <Navbar />}
    </>
  )
}

function App() {
  const [session, setSession] = useState(null)
  const [authReady, setAuthReady] = useState(false)
  const [splashDone, setSplashDone] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setAuthReady(true)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => setSession(session)
    )
    return () => subscription.unsubscribe()
  }, [])

  const showSplash = !splashDone || !authReady

  return (
    <>
      {showSplash && <SplashScreen onDone={() => setSplashDone(true)} />}
      {authReady && (
        <BrowserRouter>
          <OfflineProvider>
            <div className="max-w-md mx-auto bg-[#EEF2F7] min-h-screen">
              <Suspense fallback={<div className="min-h-screen bg-[#EEF2F7]" />}>
                <AppRoutes session={session} />
              </Suspense>
            </div>
          </OfflineProvider>
        </BrowserRouter>
      )}
    </>
  )
}

export default App