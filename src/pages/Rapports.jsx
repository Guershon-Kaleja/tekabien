import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import Header from '../components/Header'
import Navbar from '../components/Navbar'
import usePlanCheck from '../hooks/usePlanCheck'

export default function Rapports() {
  const navigate = useNavigate()
  usePlanCheck()
  const [period, setPeriod] = useState('today')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [showCustom, setShowCustom] = useState(false)
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    totalSales: 0,
    totalCost: 0,
    salesCount: 0,
    totalExpenses: 0,
    netProfit: 0,
    creditPending: 0,
    creditAmount: 0,
    topProducts: [],
    paymentMethods: [],
    salesByDay: [],
  })

  useEffect(() => {
    if (period !== 'custom') fetchStats()
  }, [period])

  const getDateRange = () => {
    const start = new Date()
    const end = new Date()

    if (period === 'today') {
      start.setHours(0, 0, 0, 0)
    } else if (period === 'week') {
      start.setDate(start.getDate() - 7)
      start.setHours(0, 0, 0, 0)
    } else if (period === 'month') {
      start.setDate(1)
      start.setHours(0, 0, 0, 0)
    } else if (period === 'custom') {
      return {
        start: customStart ? new Date(customStart).toISOString() : new Date().toISOString(),
        end: customEnd ? new Date(customEnd + 'T23:59:59').toISOString() : new Date().toISOString(),
      }
    }

    return { start: start.toISOString(), end: end.toISOString() }
  }

  const fetchStats = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { start, end } = getDateRange()

    const { data: salesData } = await supabase
      .from('sales')
      .select('*')
      .eq('user_id', user.id)
      .gte('created_at', start)
      .lte('created_at', end)
      .order('created_at', { ascending: true })

    const { data: expensesData } = await supabase
      .from('expenses')
      .select('amount')
      .eq('user_id', user.id)
      .gte('created_at', start)
      .lte('created_at', end)

    if (salesData && expensesData) {
      const encaissees = salesData.filter(s => s.encaissee !== false)
      const credits = salesData.filter(s => s.encaissee === false)

      const totalSales = encaissees.reduce((sum, s) => sum + s.total, 0)
      const totalCost = encaissees.reduce((sum, s) => sum + (s.cost || 0), 0)
      const totalExpenses = expensesData.reduce((sum, e) => sum + e.amount, 0)
      const netProfit = totalSales - totalCost - totalExpenses
      const creditAmount = credits.reduce((sum, s) => sum + s.total, 0)

      const productMap = {}
      encaissees.forEach(s => {
        if (!productMap[s.product_name]) {
          productMap[s.product_name] = { name: s.product_name, total: 0, margin: 0, count: 0 }
        }
        productMap[s.product_name].total += s.total
        productMap[s.product_name].margin += s.total - (s.cost || 0)
        productMap[s.product_name].count += s.quantity
      })
      const topProducts = Object.values(productMap)
        .sort((a, b) => b.margin - a.margin)
        .slice(0, 5)

      const paymentMap = {}
      encaissees.forEach(s => {
        if (!paymentMap[s.payment_method]) paymentMap[s.payment_method] = 0
        paymentMap[s.payment_method] += s.total
      })
      const paymentMethods = Object.entries(paymentMap)
        .map(([method, total]) => ({ method, total }))
        .sort((a, b) => b.total - a.total)

      const dayMap = {}
      encaissees.forEach(s => {
        const day = new Date(s.created_at).toLocaleDateString('fr-FR', {
          day: '2-digit', month: '2-digit'
        })
        if (!dayMap[day]) dayMap[day] = { day, total: 0, count: 0 }
        dayMap[day].total += s.total
        dayMap[day].count += 1
      })
      const salesByDay = Object.values(dayMap)

      setStats({
        totalSales,
        totalCost,
        salesCount: encaissees.length,
        totalExpenses,
        netProfit,
        creditPending: credits.length,
        creditAmount,
        topProducts,
        paymentMethods,
        salesByDay,
      })
    }
    setLoading(false)
  }

  const handleCustomSearch = () => {
    if (!customStart) return
    if (!customEnd) setCustomEnd(customStart)
    fetchStats()
    setShowCustom(false)
  }

  const formatFC = (amount) =>
    new Intl.NumberFormat('fr-FR').format(Math.round(amount)) + ' FC'

  const formatFCShort = (amount) => {
    if (amount >= 1000000) return (amount / 1000000).toFixed(1) + 'M'
    if (amount >= 1000) return (amount / 1000).toFixed(0) + 'k'
    return Math.round(amount).toString()
  }

  const paymentLabel = (method) => ({
    cash: 'Cash', airtel: 'Airtel',
    orange: 'Orange', mpesa: 'M-Pesa', credit: 'Crédit'
  })[method] || method

  const paymentColor = (method) => ({
    cash: '#16A34A', airtel: '#EF4444',
    orange: '#F97316', mpesa: '#8B5CF6', credit: '#F5A623'
  })[method] || '#64748B'

  const COLORS = ['#16A34A', '#EF4444', '#F97316', '#8B5CF6', '#F5A623', '#1A56DB']

  const maxMargin = stats.topProducts[0]?.margin || 1

  const getPeriodLabel = () => {
    if (period === 'today') return "Aujourd'hui"
    if (period === 'week') return '7 derniers jours'
    if (period === 'month') return 'Ce mois'
    if (period === 'custom' && customStart) {
      return customEnd && customEnd !== customStart
        ? `${new Date(customStart).toLocaleDateString('fr-FR')} → ${new Date(customEnd).toLocaleDateString('fr-FR')}`
        : new Date(customStart).toLocaleDateString('fr-FR')
    }
    return 'Période'
  }

  return (
    <div className="min-h-screen bg-[#EEF2F7] pb-24">

      <div className="bg-[#1A56DB] px-4 pt-0 pb-4">
        <Header title="Rapports" />
        <div className="bg-white/12 rounded-xl p-3 border border-white/20">
          <p className="text-blue-200 text-xs uppercase tracking-wide mb-1">Bénéfice net — {getPeriodLabel()}</p>
          <p className={`text-3xl font-bold ${stats.netProfit >= 0 ? 'text-green-300' : 'text-red-300'}`}>
            {stats.netProfit >= 0 ? '+' : ''}{formatFC(stats.netProfit)}
          </p>
          <p className="text-blue-200 text-xs mt-1">
            {stats.netProfit >= 0 ? "✅ Tu gagnes de l'argent" : "⚠️ Tu perds de l'argent"}
          </p>
          <div className="grid grid-cols-3 gap-2 mt-3">
            <div className="bg-white/10 rounded-lg p-2 text-center">
              <p className="text-blue-200 text-xs mb-1">Encaissé</p>
              <p className="text-white font-bold text-sm">{formatFC(stats.totalSales)}</p>
            </div>
            <div className="bg-white/10 rounded-lg p-2 text-center">
              <p className="text-blue-200 text-xs mb-1">Coût achat</p>
              <p className="text-yellow-300 font-bold text-sm">{formatFC(stats.totalCost)}</p>
            </div>
            <div className="bg-white/10 rounded-lg p-2 text-center">
              <p className="text-blue-200 text-xs mb-1">Dépenses</p>
              <p className="text-red-300 font-bold text-sm">{formatFC(stats.totalExpenses)}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 pt-4">

        {/* Filtres période */}
        <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
          {[
            { id: 'today', label: "Auj." },
            { id: 'week', label: '7 jours' },
            { id: 'month', label: 'Ce mois' },
            { id: 'custom', label: '📅 Date' },
          ].map((p) => (
            <button
              key={p.id}
              onClick={() => {
                setPeriod(p.id)
                if (p.id === 'custom') {
                  setShowCustom(true)
                } else {
                  setShowCustom(false)
                }
              }}
              className={`flex-shrink-0 px-4 py-2 rounded-xl text-xs font-medium border transition-all ${
                period === p.id
                  ? 'bg-[#1A56DB] text-white border-[#1A56DB]'
                  : 'bg-white text-[#64748B] border-gray-200'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Sélecteur date personnalisée */}
        {showCustom && (
          <div className="bg-white rounded-xl border border-[#1A56DB] p-4 mb-4">
            <p className="text-xs font-semibold text-[#1A56DB] uppercase tracking-wide mb-4">
              📅 Choisir une période
            </p>
            <div className="space-y-3 mb-4">
              <div>
                <label className="block text-xs font-semibold text-[#64748B] uppercase tracking-wide mb-2">
                  Du
                </label>
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm outline-none focus:border-[#1A56DB]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#64748B] uppercase tracking-wide mb-2">
                  Au
                </label>
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm outline-none focus:border-[#1A56DB]"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleCustomSearch}
                className="flex-1 bg-[#1A56DB] text-white rounded-xl py-3 text-sm font-semibold"
              >
                Voir les stats
              </button>
              <button
                onClick={() => { setShowCustom(false); setPeriod('today') }}
                className="px-4 bg-white border border-gray-200 text-[#64748B] rounded-xl py-3 text-sm font-medium"
              >
                Annuler
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <p className="text-center text-[#64748B] text-sm py-8">Chargement...</p>
        ) : (
          <>
            {/* Ventes crédit en attente */}
            {stats.creditPending > 0 && (
              <div className="bg-[#FFFBEB] border border-yellow-200 rounded-xl p-3 mb-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-[#B45309]">
                    ⏳ {stats.creditPending} vente{stats.creditPending > 1 ? 's' : ''} crédit en attente
                  </p>
                  <p className="text-xs text-[#64748B] mt-0.5">
                    Non comptabilisées — {formatFC(stats.creditAmount)}
                  </p>
                </div>
                <button
                  onClick={() => navigate('/clients')}
                  className="text-xs text-[#B45309] font-medium bg-yellow-100 px-3 py-1.5 rounded-lg"
                >
                  Voir clients
                </button>
              </div>
            )}

            {/* Graphique ventes par jour */}
            {stats.salesByDay.length > 1 && (
              <>
                <p className="text-xs font-semibold text-[#64748B] uppercase tracking-wide mb-3">
                  Évolution des ventes
                </p>
                <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={stats.salesByDay} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
                      <XAxis
                        dataKey="day"
                        tick={{ fontSize: 10, fill: '#64748B' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 10, fill: '#64748B' }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={formatFCShort}
                        width={40}
                      />
                      <Tooltip
                        formatter={(value) => [formatFC(value), 'Ventes']}
                        labelStyle={{ fontSize: 12 }}
                        contentStyle={{ borderRadius: 8, fontSize: 12 }}
                      />
                      <Bar dataKey="total" fill="#1A56DB" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </>
            )}

            {/* Graphique modes de paiement */}
            {stats.paymentMethods.length > 0 && (
              <>
                <p className="text-xs font-semibold text-[#64748B] uppercase tracking-wide mb-3">
                  Répartition des paiements
                </p>
                <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={stats.paymentMethods}
                        dataKey="total"
                        nameKey="method"
                        cx="50%"
                        cy="50%"
                        outerRadius={70}
                        label={({ method, percent }) =>
                          `${paymentLabel(method)} ${(percent * 100).toFixed(0)}%`
                        }
                        labelLine={false}
                      >
                        {stats.paymentMethods.map((entry, index) => (
                          <Cell
                            key={entry.method}
                            fill={paymentColor(entry.method) || COLORS[index % COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => formatFC(value)} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex flex-wrap gap-2 justify-center mt-2">
                    {stats.paymentMethods.map((pm) => (
                      <div key={pm.method} className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full" style={{ background: paymentColor(pm.method) }} />
                        <span className="text-xs text-[#64748B]">{paymentLabel(pm.method)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Top produits */}
            <p className="text-xs font-semibold text-[#64748B] uppercase tracking-wide mb-3">
              Top produits (par marge)
            </p>

            {stats.topProducts.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 p-6 text-center mb-4">
                <p className="text-3xl mb-2">📦</p>
                <p className="text-sm font-semibold text-[#0F172A]">Aucune vente encaissée</p>
                <p className="text-xs text-[#64748B] mt-1">Enregistre des ventes pour voir les stats</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
                {stats.topProducts.map((p, i) => (
                  <div key={p.name} className="mb-3 last:mb-0">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-[#1A56DB] w-4">{i + 1}</span>
                        <p className="text-sm font-medium text-[#0F172A]">{p.name}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold text-[#16A34A]">+{formatFC(p.margin)}</p>
                        <p className="text-xs text-[#64748B]">{p.count} vendus</p>
                      </div>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${Math.round((p.margin / maxMargin) * 100)}%`,
                          background: '#16A34A'
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Modes de paiement liste */}
            <p className="text-xs font-semibold text-[#64748B] uppercase tracking-wide mb-3">
              Détail des paiements
            </p>

            {stats.paymentMethods.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 p-6 text-center mb-4">
                <p className="text-3xl mb-2">💳</p>
                <p className="text-sm font-semibold text-[#0F172A]">Aucune donnée</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
                {stats.paymentMethods.map((pm) => (
                  <div key={pm.method} className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-0">
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ background: paymentColor(pm.method) }}
                    />
                    <p className="text-sm text-[#0F172A] flex-1">{paymentLabel(pm.method)}</p>
                    <p className="text-sm font-bold text-[#0F172A]">{formatFC(pm.total)}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Accès rapide */}
            <p className="text-xs font-semibold text-[#64748B] uppercase tracking-wide mb-3">
              Accès rapide
            </p>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <button
                onClick={() => navigate('/depenses')}
                className="bg-white rounded-xl border border-gray-200 p-4 text-left"
              >
                <span className="text-2xl">💰</span>
                <p className="text-sm font-semibold text-[#0F172A] mt-2">Dépenses</p>
                <p className="text-xs text-[#64748B] mt-1">Gérer les sorties</p>
              </button>
              <button
                onClick={() => navigate('/clients')}
                className="bg-white rounded-xl border border-gray-200 p-4 text-left"
              >
                <span className="text-2xl">👥</span>
                <p className="text-sm font-semibold text-[#0F172A] mt-2">Clients</p>
                <p className="text-xs text-[#64748B] mt-1">Voir les dettes</p>
              </button>
            </div>
          </>
        )}

      </div>

      <Navbar />

    </div>
  )
}