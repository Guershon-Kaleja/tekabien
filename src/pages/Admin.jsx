import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { logAction } from '../lib/audit'

const FUNCTION_URL = `https://qoeextvpjhgqjrnzwkcj.supabase.co/functions/v1/get-users`

export default function Admin() {
  const navigate = useNavigate()
  const [users, setUsers] = useState([])
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeTrials: 0,
    paidUsers: 0,
    revenue: 0,
  })
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [adminEmail, setAdminEmail] = useState('')
  const [adminPassword, setAdminPassword] = useState('')
  const [authError, setAuthError] = useState('')

  const handleAdminLogin = async () => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: adminEmail,
      password: adminPassword,
    })

    if (error) {
      setAuthError('Email ou mot de passe incorrect')
      return
    }

    if (data.user?.email !== 'admin@tekabien.com') {
      await supabase.auth.signOut()
      setAuthError('Accès refusé — vous n\'êtes pas administrateur')
      return
    }

    setIsAdmin(true)
    fetchAdminData()
  }

  const fetchAdminData = async () => {
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const response = await fetch(FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
      })

      const data = await response.json()
      console.log('Admin data:', data)

      if (data.users) {
        setUsers(data.users)
        setStats({
          totalUsers: data.users.length,
          activeTrials: data.users.filter(u => u.plan === 'trial').length,
          paidUsers: data.users.filter(u => u.plan === 'pro').length,
          revenue: data.users.filter(u => u.plan === 'pro').length * 3,
        })
      }
    } catch (err) {
      console.error('Erreur fetchAdminData:', err)
    }
    setLoading(false)
  }

  const handleActivatePlan = async (userId, plan) => {
    const expires = new Date()
    expires.setDate(expires.getDate() + 30)

    await supabase
      .from('users')
      .update({ plan, plan_expires: expires.toISOString() })
      .eq('id', userId)

    await logAction(
      `activate_${plan}`,
      userId,
      `Plan ${plan} activé jusqu'au ${expires.toLocaleDateString('fr-FR')}`
    )

    fetchAdminData()
  }

  const handleDisableUser = async (userId) => {
    await supabase
      .from('users')
      .update({ plan: 'disabled' })
      .eq('id', userId)

    await logAction('disable_user', userId, 'Compte désactivé par l\'admin')

    fetchAdminData()
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A'
    return new Date(dateStr).toLocaleDateString('fr-FR')
  }

  const getPlanBadge = (plan) => {
    const styles = {
      trial: { bg: '#FFFBEB', color: '#B45309', label: 'Essai' },
      pro: { bg: '#F0FDF4', color: '#16A34A', label: 'Pro' },
      free: { bg: '#F8FAFF', color: '#64748B', label: 'Gratuit' },
      disabled: { bg: '#FEF2F2', color: '#DC2626', label: 'Désactivé' },
    }
    const s = styles[plan] || styles.free
    return (
      <span
        className="text-xs font-semibold px-2 py-1 rounded-full"
        style={{ background: s.bg, color: s.color }}
      >
        {s.label}
      </span>
    )
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-[#0F172A] flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-[#1E293B] rounded-2xl p-6 border border-[#2D3F55]">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-[#1A56DB] rounded-2xl flex items-center justify-center mx-auto mb-3">
              <span className="text-3xl">🔐</span>
            </div>
            <h1 className="text-white font-bold text-lg">Panneau Admin</h1>
            <p className="text-[#94A3B8] text-sm mt-1">TekaBien — Accès restreint</p>
          </div>

          {authError && (
            <div className="bg-red-900/30 border border-red-800 rounded-xl p-3 mb-4">
              <p className="text-red-400 text-xs">{authError}</p>
            </div>
          )}

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-[#94A3B8] uppercase tracking-wide mb-1">
                Email admin
              </label>
              <input
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                placeholder="admin@tekabien.com"
                className="w-full bg-[#0F172A] border border-[#2D3F55] rounded-xl px-3 py-3 text-sm text-white outline-none focus:border-[#1A56DB]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#94A3B8] uppercase tracking-wide mb-1">
                Mot de passe
              </label>
              <input
                type="password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAdminLogin()}
                placeholder="••••••••"
                className="w-full bg-[#0F172A] border border-[#2D3F55] rounded-xl px-3 py-3 text-sm text-white outline-none focus:border-[#1A56DB]"
              />
            </div>
          </div>

          <button
            onClick={handleAdminLogin}
            className="w-full bg-[#1A56DB] text-white rounded-xl py-3 font-semibold text-sm mt-4"
          >
            Accéder au panneau
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0F172A] pb-8">

      <div className="bg-[#1A56DB] px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="w-8 h-8 bg-white/15 rounded-lg flex items-center justify-center"
          >
            <span className="text-white">←</span>
          </button>
          <h1 className="text-white font-semibold">Panneau Admin</h1>
        </div>
        <button
          onClick={async () => {
            await logAction('admin_logout', null, 'Déconnexion admin')
            await supabase.auth.signOut()
            setIsAdmin(false)
            navigate('/login')
          }}
          className="text-xs bg-white/20 text-white px-3 py-1 rounded-full font-medium"
        >
          Déconnexion
        </button>
      </div>

      <div className="px-4 pt-4">

        <div className="grid grid-cols-2 gap-3 mb-6">
          {[
            { label: 'Total utilisateurs', value: stats.totalUsers, color: '#1A56DB' },
            { label: 'En essai', value: stats.activeTrials, color: '#F5A623' },
            { label: 'Clients payants', value: stats.paidUsers, color: '#16A34A' },
            { label: 'Revenus/mois', value: `${stats.revenue}$`, color: '#16A34A' },
          ].map((s, i) => (
            <div key={i} className="rounded-xl p-3 border" style={{ background: '#1E293B', borderColor: '#2D3F55' }}>
              <p className="text-xs uppercase tracking-wide mb-1" style={{ color: '#94A3B8' }}>{s.label}</p>
              <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
            </div>
          ))}
        </div>

        <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: '#94A3B8' }}>
          Utilisateurs ({users.length})
        </p>

        {loading ? (
          <p className="text-center text-[#94A3B8] text-sm py-8">Chargement...</p>
        ) : users.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-3xl mb-2">👥</p>
            <p className="text-sm font-semibold text-white">Aucun utilisateur pour l'instant</p>
            <p className="text-xs mt-1" style={{ color: '#94A3B8' }}>
              Les nouveaux inscrits apparaîtront ici
            </p>
          </div>
        ) : (
          users.map((u) => (
            <div key={u.id} className="rounded-xl p-3 mb-3 border" style={{ background: '#1E293B', borderColor: '#2D3F55' }}>
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="text-sm font-semibold text-white">{u.shop_name}</p>
                  <p className="text-xs" style={{ color: '#94A3B8' }}>{u.phone || 'Pas de téléphone'}</p>
                  <p className="text-xs mt-1" style={{ color: '#64748B' }}>
                    Inscrit le {formatDate(u.created_at)}
                  </p>
                  {u.plan_expires && (
                    <p className="text-xs mt-1" style={{ color: '#64748B' }}>
                      Expire le {formatDate(u.plan_expires)}
                    </p>
                  )}
                </div>
                {getPlanBadge(u.plan)}
              </div>

              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => handleActivatePlan(u.id, 'pro')}
                  className="flex-1 py-2 rounded-lg text-xs font-semibold"
                  style={{ background: 'rgba(22,163,74,0.2)', color: '#16A34A' }}
                >
                  ✓ Activer Pro
                </button>
                <button
                  onClick={() => handleDisableUser(u.id)}
                  className="py-2 px-3 rounded-lg text-xs font-semibold"
                  style={{ background: 'rgba(220,38,38,0.2)', color: '#DC2626' }}
                >
                  ✕
                </button>
              </div>
            </div>
          ))
        )}

      </div>
    </div>
  )
}