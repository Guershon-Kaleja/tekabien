import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const FUNCTION_URL = `https://qoeextvpjhgqjrnzwkcj.supabase.co/functions/v1/get-users`
const ADMIN_ACTION_URL = `https://qoeextvpjhgqjrnzwkcj.supabase.co/functions/v1/admin-action`

export default function Admin() {
  const navigate = useNavigate()
  const [users, setUsers] = useState([])
  const [filteredUsers, setFilteredUsers] = useState([])
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeTrials: 0,
    paidUsers: 0,
    freeUsers: 0,
    newThisWeek: 0,
    revenueUSD: 0,
    revenueCDF: 0,
    conversionRate: 0,
  })
  const [setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [adminEmail, setAdminEmail] = useState('')
  const [adminPassword, setAdminPassword] = useState('')
  const [authError, setAuthError] = useState('')
  const [search, setSearch] = useState('')
  const [planFilter, setPlanFilter] = useState('tous')
  const [selectedUser, setSelectedUser] = useState(null)
  const [activatingMonths, setActivatingMonths] = useState(1)
  const [actionLoading, setActionLoading] = useState(false)

  const handleAdminLogin = async () => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: adminEmail,
      password: adminPassword,
    })
    if (error) { setAuthError('Email ou mot de passe incorrect'); return }
    if (data.user?.email !== 'admin@tekabien.com') {
      await supabase.auth.signOut()
      setAuthError('Accès refusé')
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

      if (data.users) {
        const users = data.users
        const payments = data.payments || []
        setUsers(users)
        setFilteredUsers(users)
        setPayments(payments)

        const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        const newThisWeek = users.filter(u => new Date(u.created_at) > oneWeekAgo).length
        const trials = users.filter(u => u.plan === 'trial').length
        const pros = users.filter(u => u.plan === 'pro').length
        const frees = users.filter(u => u.plan === 'free').length
        const conversionRate = trials + pros > 0 ? Math.round((pros / (trials + pros)) * 100) : 0

        // Revenus réels depuis payments
        const thisMonth = new Date()
        thisMonth.setDate(1)
        thisMonth.setHours(0, 0, 0, 0)
        const monthPayments = payments.filter(p =>
          p.status === 'completed' && new Date(p.created_at) >= thisMonth
        )
        const revenueUSD = monthPayments
          .filter(p => p.currency === 'USD')
          .reduce((sum, p) => sum + p.amount, 0)
        const revenueCDF = monthPayments
          .filter(p => p.currency === 'CDF')
          .reduce((sum, p) => sum + p.amount, 0)

        setStats({
          totalUsers: users.length,
          activeTrials: trials,
          paidUsers: pros,
          freeUsers: frees,
          newThisWeek,
          revenueUSD,
          revenueCDF,
          conversionRate,
        })
      }
    } catch (err) {
      console.error('Erreur fetchAdminData:', err)
    }
    setLoading(false)
  }

  const applyFilters = (searchVal, planVal, usersList) => {
    let result = usersList
    if (searchVal) {
      result = result.filter(u =>
        u.shop_name?.toLowerCase().includes(searchVal.toLowerCase()) ||
        u.email?.toLowerCase().includes(searchVal.toLowerCase())
      )
    }
    if (planVal !== 'tous') {
      result = result.filter(u => u.plan === planVal)
    }
    setFilteredUsers(result)
  }

  const handleSearch = (val) => {
    setSearch(val)
    applyFilters(val, planFilter, users)
  }

  const handlePlanFilter = (val) => {
    setPlanFilter(val)
    applyFilters(search, val, users)
  }

  const handleAction = async (action, userId, plan = 'pro', months = 1) => {
    setActionLoading(true)
    const { data: { session } } = await supabase.auth.getSession()
    await fetch(ADMIN_ACTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ action, userId, plan, months }),
    })
    setActionLoading(false)
    setSelectedUser(null)
    fetchAdminData()
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A'
    return new Date(dateStr).toLocaleDateString('fr-FR')
  }

  const getPlanBadge = (plan) => {
    const styles = {
      trial: { bg: 'rgba(245,166,35,0.2)', color: '#F5A623', label: 'Essai' },
      pro: { bg: 'rgba(22,163,74,0.2)', color: '#16A34A', label: 'Pro' },
      free: { bg: 'rgba(100,116,139,0.2)', color: '#94A3B8', label: 'Gratuit' },
      disabled: { bg: 'rgba(220,38,38,0.2)', color: '#DC2626', label: 'Désactivé' },
    }
    const s = styles[plan] || styles.free
    return (
      <span className="text-xs font-bold px-2 py-1 rounded-full" style={{ background: s.bg, color: s.color }}>
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
              <label className="block text-xs font-semibold text-[#94A3B8] uppercase tracking-wide mb-1">Email admin</label>
              <input
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                placeholder="admin@tekabien.com"
                className="w-full bg-[#0F172A] border border-[#2D3F55] rounded-xl px-3 py-3 text-sm text-white outline-none focus:border-[#1A56DB]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#94A3B8] uppercase tracking-wide mb-1">Mot de passe</label>
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
          <button onClick={handleAdminLogin} className="w-full bg-[#1A56DB] text-white rounded-xl py-3 font-semibold text-sm mt-4">
            Accéder au panneau
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0F172A] pb-8">

      {/* Header */}
      <div className="bg-[#1A56DB] px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/')} className="w-8 h-8 bg-white/15 rounded-lg flex items-center justify-center">
            <span className="text-white">←</span>
          </button>
          <div>
            <h1 className="text-white font-semibold">Panneau Admin</h1>
            <p className="text-blue-200 text-xs">TekaBien Dashboard</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchAdminData} className="text-xs bg-white/20 text-white px-3 py-1 rounded-full font-medium">
            🔄
          </button>
          <button
            onClick={async () => {
              await supabase.auth.signOut()
              setIsAdmin(false)
              navigate('/login')
            }}
            className="text-xs bg-white/20 text-white px-3 py-1 rounded-full font-medium"
          >
            Sortir
          </button>
        </div>
      </div>

      <div className="px-4 pt-4">

        {/* Stats principales */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          {[
            { label: 'Total users', value: stats.totalUsers, color: '#1A56DB', icon: '👥' },
            { label: 'Nouveaux / semaine', value: stats.newThisWeek, color: '#F5A623', icon: '🆕' },
            { label: 'En essai', value: stats.activeTrials, color: '#F5A623', icon: '⏳' },
            { label: 'Pro payants', value: stats.paidUsers, color: '#16A34A', icon: '💎' },
            { label: 'Gratuit', value: stats.freeUsers, color: '#94A3B8', icon: '🔒' },
            { label: 'Conversion', value: `${stats.conversionRate}%`, color: '#16A34A', icon: '📈' },
          ].map((s, i) => (
            <div key={i} className="rounded-xl p-3 border" style={{ background: '#1E293B', borderColor: '#2D3F55' }}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm">{s.icon}</span>
                <p className="text-xs uppercase tracking-wide" style={{ color: '#94A3B8' }}>{s.label}</p>
              </div>
              <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Revenus réels ce mois */}
        <div className="rounded-xl p-4 border mb-4" style={{ background: '#1E293B', borderColor: '#2D3F55' }}>
          <p className="text-xs uppercase tracking-wide mb-3" style={{ color: '#94A3B8' }}>💰 Revenus réels ce mois</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs" style={{ color: '#64748B' }}>En USD</p>
              <p className="text-xl font-bold text-[#16A34A]">${stats.revenueUSD.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-xs" style={{ color: '#64748B' }}>En FC</p>
              <p className="text-xl font-bold text-[#16A34A]">{stats.revenueCDF.toLocaleString('fr-FR')} FC</p>
            </div>
          </div>
          <p className="text-xs mt-2" style={{ color: '#64748B' }}>
            Montants prélevés — Labyrinthe 7% déjà déduit côté client
          </p>
        </div>

        {/* Recherche + Filtres */}
        <div className="mb-3">
          <input
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Rechercher par nom ou email..."
            className="w-full bg-[#1E293B] border border-[#2D3F55] rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-[#1A56DB] mb-2"
          />
          <div className="flex gap-2">
            {[
              { id: 'tous', label: 'Tous' },
              { id: 'trial', label: 'Essai' },
              { id: 'pro', label: 'Pro' },
              { id: 'free', label: 'Gratuit' },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => handlePlanFilter(f.id)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  planFilter === f.id
                    ? 'bg-[#1A56DB] text-white'
                    : 'text-[#94A3B8]'
                }`}
                style={planFilter !== f.id ? { background: '#1E293B' } : {}}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Liste utilisateurs */}
        <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: '#94A3B8' }}>
          Utilisateurs ({filteredUsers.length})
        </p>

        {loading ? (
          <p className="text-center text-[#94A3B8] text-sm py-8">Chargement...</p>
        ) : filteredUsers.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-3xl mb-2">👥</p>
            <p className="text-sm font-semibold text-white">Aucun utilisateur trouvé</p>
          </div>
        ) : (
          filteredUsers.map((u) => (
            <div key={u.id} className="rounded-xl p-3 mb-3 border" style={{ background: '#1E293B', borderColor: '#2D3F55' }}>
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-white">{u.shop_name}</p>
                  <p className="text-xs" style={{ color: '#94A3B8' }}>{u.email || 'Pas d\'email'}</p>
                  <p className="text-xs mt-1" style={{ color: '#64748B' }}>
                    📅 Inscrit le {formatDate(u.created_at)}
                  </p>
                  {u.plan_expires && (
                    <p className="text-xs mt-0.5" style={{ color: '#64748B' }}>
                      ⏰ Expire le {formatDate(u.plan_expires)}
                    </p>
                  )}
                </div>
                {getPlanBadge(u.plan)}
              </div>

              <button
                onClick={() => setSelectedUser(selectedUser?.id === u.id ? null : u)}
                className="w-full py-2 rounded-lg text-xs font-medium mt-2 text-center"
                style={{ background: '#0F172A', color: '#94A3B8' }}
              >
                {selectedUser?.id === u.id ? '▲ Fermer actions' : '▼ Gérer ce compte'}
              </button>

              {selectedUser?.id === u.id && (
                <div className="mt-3 space-y-2">
                  {/* Activer Pro avec durée */}
                  <div>
                    <p className="text-xs mb-1.5" style={{ color: '#94A3B8' }}>Activer Pro — choisir durée :</p>
                    <div className="grid grid-cols-4 gap-1 mb-2">
                      {[1, 3, 6, 12].map((m) => (
                        <button
                          key={m}
                          onClick={() => setActivatingMonths(m)}
                          className={`py-1.5 rounded-lg text-xs font-medium ${
                            activatingMonths === m ? 'bg-[#16A34A] text-white' : 'text-[#94A3B8]'
                          }`}
                          style={activatingMonths !== m ? { background: '#0F172A' } : {}}
                        >
                          {m}m
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={() => handleAction('activate', u.id, 'pro', activatingMonths)}
                      disabled={actionLoading}
                      className="w-full py-2 rounded-lg text-xs font-semibold disabled:opacity-50"
                      style={{ background: 'rgba(22,163,74,0.2)', color: '#16A34A' }}
                    >
                      ✓ Activer Pro {activatingMonths} mois
                    </button>
                  </div>

                  {/* Autres actions */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleAction('activate', u.id, 'trial', 1)}
                      disabled={actionLoading}
                      className="py-2 rounded-lg text-xs font-semibold disabled:opacity-50"
                      style={{ background: 'rgba(245,166,35,0.2)', color: '#F5A623' }}
                    >
                      🔄 Remettre en essai
                    </button>
                    <button
                      onClick={() => handleAction('disable', u.id)}
                      disabled={actionLoading}
                      className="py-2 rounded-lg text-xs font-semibold disabled:opacity-50"
                      style={{ background: 'rgba(220,38,38,0.2)', color: '#DC2626' }}
                    >
                      ✕ Passer en gratuit
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}