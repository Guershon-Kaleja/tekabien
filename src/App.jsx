import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import useAutoLogout from './hooks/useAutoLogout'
import Login from './pages/Login'
import Onboarding from './pages/Onboarding'
import Dashboard from './pages/Dashboard'
import Ventes from './pages/Ventes'
import Stocks from './pages/Stocks'
import Clients from './pages/Clients'
import Depenses from './pages/Depenses'
import Admin from './pages/Admin'
import Rapports from './pages/Rapports'
import Expired from './pages/Expired'
import ResetPassword from './pages/ResetPassword'
import Profil from './pages/Profil'

function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

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

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFF] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-[#0F172A] rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-white text-2xl">🏪</span>
          </div>
          <p className="text-[#1A56DB] font-bold text-xl">TekaBien</p>
          <p className="text-[#64748B] text-sm mt-1">Chargement...</p>
        </div>
      </div>
    )
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={!session ? <Login /> : <Navigate to="/" />} />
        <Route path="/onboarding" element={session ? <Onboarding /> : <Navigate to="/login" />} />
        <Route path="/" element={session ? <Dashboard /> : <Navigate to="/login" />} />
        <Route path="/ventes" element={session ? <Ventes /> : <Navigate to="/login" />} />
        <Route path="/stocks" element={session ? <Stocks /> : <Navigate to="/login" />} />
        <Route path="/clients" element={session ? <Clients /> : <Navigate to="/login" />} />
        <Route path="/depenses" element={session ? <Depenses /> : <Navigate to="/login" />} />
        <Route path="/tb-admin-2025" element={<Admin />} />
        <Route path="/rapports" element={session ? <Rapports /> : <Navigate to="/login" />} />
        <Route path="/expired" element={<Expired />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/profil" element={session ? <Profil /> : <Navigate to="/login" />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App