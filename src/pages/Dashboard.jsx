import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Navbar from '../components/Navbar'
import usePlanCheck from '../hooks/usePlanCheck'

export default function Dashboard() {
  const navigate = useNavigate()
  usePlanCheck()
  const [shopName, setShopName] = useState('')
  const [todaySales, setTodaySales] = useState(0)
  const [salesCount, setSalesCount] = useState(0)
  const [netProfit, setNetProfit] = useState(0)
  const [debtCount, setDebtCount] = useState(0)
  const [totalDebt, setTotalDebt] = useState(0)
  const [lowStock, setLowStock] = useState([])
  const [lastSales, setLastSales] = useState([])
  const [loading, setLoading] = useState(true)
  const [trialDaysLeft, setTrialDaysLeft] = useState(null)
  const [userPlan, setUserPlan] = useState(null)
  const [planExpires, setPlanExpires] = useState(null)

  const today = new Date()
  const dateStr = today.toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  })

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const startOfDay = new Date()
    startOfDay.setHours(0, 0, 0, 0)

    const { data: userData } = await supabase
      .from('users')
      .select('shop_name, plan, plan_expires')
      .eq('id', user.id)
      .single()

    if (userData) {
      setShopName(userData.shop_name)
      setUserPlan(userData.plan)
      setPlanExpires(userData.plan_expires)

      if (userData.plan === 'trial' && userData.plan_expires) {
        const expires = new Date(userData.plan_expires)
        const now = new Date()
        const diff = Math.ceil((expires - now) / (1000 * 60 * 60 * 24))
        setTrialDaysLeft(diff > 0 ? diff : 0)
      }
    }

    const { data: salesData } = await supabase
      .from('sales')
      .select('*')
      .eq('user_id', user.id)
      .gte('created_at', startOfDay.toISOString())
      .order('created_at', { ascending: false })

    if (salesData) {
      setTodaySales(salesData.reduce((sum, s) => sum + s.total, 0))
      setSalesCount(salesData.length)
      setLastSales(salesData.slice(0, 3))
    }

    const { data: expensesData } = await supabase
      .from('expenses')
      .select('amount')
      .eq('user_id', user.id)
      .gte('created_at', startOfDay.toISOString())

    if (salesData && expensesData) {
      const totalSales = salesData.reduce((sum, s) => sum + s.total, 0)
      const totalCost = salesData.reduce((sum, s) => sum + (s.cost || 0), 0)
      const totalExpenses = expensesData.reduce((sum, e) => sum + e.amount, 0)
      setNetProfit(totalSales - totalCost - totalExpenses)
    }

    const { data: customersData } = await supabase
      .from('customers')
      .select('total_debt')
      .eq('user_id', user.id)
      .gt('total_debt', 0)

    if (customersData) {
      setDebtCount(customersData.length)
      setTotalDebt(customersData.reduce((sum, c) => sum + c.total_debt, 0))
    }

    const { data: productsData } = await supabase
      .from('products')
      .select('*')
      .eq('user_id', user.id)

    if (productsData) {
      setLowStock(productsData.filter(p => p.quantity <= p.alert_threshold))
    }

    setLoading(false)
  }

  const formatFC = (amount) =>
    new Intl.NumberFormat('fr-FR').format(Math.round(amount)) + ' FC'

  const formatTime = (dateStr) =>
    new Date(dateStr).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })

  const paymentLabel = (method) => ({
    cash: 'Cash', airtel: 'Airtel Money',
    orange: 'Orange Money', mpesa: 'M-Pesa', credit: 'Crédit'
  })[method] || method

  const getPlanBannerBg = () => {
    if (userPlan === 'trial' && trialDaysLeft <= 5) return 'bg-[#FEF2F2]'
    if (userPlan === 'trial') return 'bg-[#FFFBEB]'
    if (userPlan === 'pro' || userPlan === 'business') return 'bg-[#F0FDF4]'
    if (userPlan === 'free') return 'bg-[#F8FAFC]'
    return 'bg-[#FEF2F2]'
  }

  const getPlanTextColor = () => {
    if (userPlan === 'pro' || userPlan === 'business') return 'text-[#16A34A]'
    if (userPlan === 'trial' && trialDaysLeft <= 5) return 'text-[#DC2626]'
    if (userPlan === 'trial') return 'text-[#B45309]'
    if (userPlan === 'free') return 'text-[#64748B]'
    return 'text-[#64748B]'
  }

  const getPlanIcon = () => {
    if (userPlan === 'pro' || userPlan === 'business') return '✅'
    if (userPlan === 'trial' && trialDaysLeft <= 5) return '⚠️'
    if (userPlan === 'trial') return '🎁'
    if (userPlan === 'free') return '🔒'
    return '🔒'
  }

  const getPlanLabel = () => {
    if (userPlan === 'pro') return 'Plan Pro actif'
    if (userPlan === 'business') return 'Plan Business actif'
    if (userPlan === 'trial' && trialDaysLeft === 0) return "Ton essai expire aujourd'hui !"
    if (userPlan === 'trial' && trialDaysLeft > 0) return `Il te reste ${trialDaysLeft} jour${trialDaysLeft > 1 ? 's' : ''} d'essai`
    if (userPlan === 'free') return 'Plan gratuit — fonctionnalités limitées'
    return ''
  }

  const getPlanSub = () => {
    if ((userPlan === 'pro' || userPlan === 'business') && planExpires) {
      return `Renouvellement le ${new Date(planExpires).toLocaleDateString('fr-FR')}`
    }
    if (userPlan === 'trial') return 'Passe au Pro pour continuer sans interruption'
    if (userPlan === 'free') return '20 ventes/j · 5 produits · 3 clients max'
    return ''
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#EEF2F7] flex items-center justify-center">
        <p className="text-[#1A56DB] font-semibold">Chargement...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#EEF2F7] pb-24">

      <div className="bg-[#1A56DB] px-4 pt-4 pb-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.2)' }}>
              <span className="text-lg">🏪</span>
            </div>
            <div>
              <p className="text-white font-semibold text-sm">{shopName}</p>
              <p className="text-xs capitalize" style={{ color: 'rgba(255,255,255,0.7)' }}>{dateStr}</p>
            </div>
          </div>
          <button
            onClick={() => navigate('/profil')}
            className="flex items-center gap-1 px-2 py-1 rounded-lg"
            style={{ background: 'rgba(255,255,255,0.15)' }}
          >
            <span className="text-white text-sm">👤</span>
            <span className="text-white text-xs font-medium">Profil</span>
          </button>
        </div>
        <div className="rounded-xl p-3 border" style={{ background: 'rgba(255,255,255,0.12)', borderColor: 'rgba(255,255,255,0.2)' }}>
          <p className="text-xs uppercase tracking-wide mb-1" style={{ color: 'rgba(255,255,255,0.7)' }}>Ventes du jour</p>
          <p className="text-white text-3xl font-bold">{formatFC(todaySales)}</p>
          <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.7)' }}>{salesCount} ventes enregistrées</p>
        </div>
      </div>

      {/* Bandeau plan */}
      {userPlan && userPlan !== 'admin' && (
        <div className={`px-4 py-3 flex items-center justify-between ${getPlanBannerBg()}`}>
          <div className="flex items-center gap-2">
            <span className="text-lg">{getPlanIcon()}</span>
            <div>
              <p className={`text-xs font-semibold ${getPlanTextColor()}`}>
                {getPlanLabel()}
              </p>
              <p className="text-xs text-[#64748B]">
                {getPlanSub()}
              </p>
            </div>
          </div>

          {userPlan === 'trial' && (
            <button
              onClick={() => navigate('/expired')}
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg whitespace-nowrap ${
                trialDaysLeft <= 5
                  ? 'bg-[#DC2626] text-white'
                  : 'bg-[#F5A623] text-white'
              }`}
            >
              Passer au Pro
            </button>
          )}

          {userPlan === 'free' && (
            <button
              onClick={() => navigate('/expired')}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg whitespace-nowrap bg-[#1A56DB] text-white"
            >
              Passer au Pro
            </button>
          )}

          {(userPlan === 'pro' || userPlan === 'business') && (
            <span className={`text-xs font-bold px-3 py-1.5 rounded-lg ${
              userPlan === 'pro' ? 'bg-[#16A34A] text-white' : 'bg-[#1A56DB] text-white'
            }`}>
              {userPlan === 'pro' ? 'PRO' : 'BUSINESS'}
            </span>
          )}
        </div>
      )}

      <div className="px-4 pt-4">

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-white rounded-xl p-3 border border-gray-200">
            <p className="text-xs text-[#64748B] uppercase tracking-wide mb-1">Bénéfice net</p>
            <p className={`text-xl font-bold ${netProfit >= 0 ? 'text-[#16A34A]' : 'text-[#DC2626]'}`}>
              {formatFC(netProfit)}
            </p>
            <p className="text-xs text-[#64748B] mt-1">marge - dépenses</p>
          </div>
          <div className="bg-white rounded-xl p-3 border border-gray-200">
            <p className="text-xs text-[#64748B] uppercase tracking-wide mb-1">Clients en dette</p>
            <p className="text-xl font-bold text-[#DC2626]">{debtCount}</p>
            <p className="text-xs text-[#64748B] mt-1">{formatFC(totalDebt)} dus</p>
          </div>
        </div>

        <button
          onClick={() => navigate('/ventes')}
          className="w-full bg-[#1A56DB] text-white rounded-xl py-3 font-semibold text-sm flex items-center justify-center gap-2 mb-2"
        >
          + Enregistrer une vente
        </button>
        <button
          onClick={() => navigate('/stocks')}
          className="w-full bg-white border border-[#1A56DB] text-[#1A56DB] rounded-xl py-3 font-medium text-sm flex items-center justify-center gap-2 mb-2"
        >
          📦 Voir les stocks
        </button>

        {lowStock.length > 0 && (
          <>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-[#0F172A] uppercase tracking-wide">Alertes</p>
              <p
                onClick={() => navigate('/stocks')}
                className="text-xs text-[#1A56DB] cursor-pointer"
              >
                Voir tout
              </p>
            </div>
            {lowStock.slice(0, 2).map((p) => (
              <div key={p.id} className="bg-white rounded-xl p-3 flex items-center gap-3 mb-2 border border-gray-200">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(220,38,38,0.1)' }}>
                  <span className="text-sm">⚠️</span>
                </div>
                <div className="flex-1">
                  <p className="text-xs font-semibold text-[#0F172A]">{p.name}</p>
                  <p className="text-xs text-[#64748B]">Stock bas — {p.quantity} unités restantes</p>
                </div>
                <span className="text-xs font-semibold px-2 py-1 rounded-full bg-red-50 text-[#DC2626]">
                  Urgent
                </span>
              </div>
            ))}
          </>
        )}

        {lastSales.length > 0 && (
          <>
            <div className="flex items-center justify-between mb-2 mt-2">
              <p className="text-xs font-semibold text-[#0F172A] uppercase tracking-wide">Dernières ventes</p>
              <p
                onClick={() => navigate('/ventes?tab=history')}
                className="text-xs text-[#1A56DB] cursor-pointer"
              >
                Voir tout
              </p>
            </div>
            {lastSales.map((sale) => (
              <div key={sale.id} className="bg-white rounded-xl p-3 flex items-center gap-3 mb-2 border border-gray-200">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(26,86,219,0.1)' }}>
                  <span className="text-sm">🛒</span>
                </div>
                <div className="flex-1">
                  <p className="text-xs font-semibold text-[#0F172A]">{sale.product_name}</p>
                  <p className="text-xs text-[#64748B]">
                    Vendu à {formatTime(sale.created_at)} · {paymentLabel(sale.payment_method)}
                  </p>
                </div>
                <span className="text-xs font-bold text-[#1A56DB]">{formatFC(sale.total)}</span>
              </div>
            ))}
          </>
        )}

        {lastSales.length === 0 && (
          <div className="text-center py-8">
            <p className="text-4xl mb-3">🛒</p>
            <p className="text-sm font-semibold text-[#0F172A]">Aucune vente aujourd'hui</p>
            <p className="text-xs mt-1 text-[#64748B]">Commence par enregistrer ta première vente</p>
          </div>
        )}

      </div>

      <Navbar />

    </div>
  )
}