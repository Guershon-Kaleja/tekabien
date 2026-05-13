import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { sanitize } from '../lib/validation'
import { canAddSale, getPlanLimits } from '../lib/planLimits'
import { saveSaleOffline, getCleanPendingSales, getPendingSales, markSaleSynced, isOnline } from '../lib/offlineDB'
import Header from '../components/Header'
import Navbar from '../components/Navbar'
import usePlanCheck from '../hooks/usePlanCheck'

export default function Ventes() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  usePlanCheck()
  const [activeTab, setActiveTab] = useState(
    searchParams.get('tab') === 'history' ? 'history' : 'new'
  )
  const [products, setProducts] = useState([])
  const [clients, setClients] = useState([])
  const [selected, setSelected] = useState(null)
  const [selectedClient, setSelectedClient] = useState(null)
  const [quantity, setQuantity] = useState(1)
  const [payment, setPayment] = useState('cash')
  const [search, setSearch] = useState('')
  const [historySearch, setHistorySearch] = useState('')
  const [clientSearch, setClientSearch] = useState('')
  const [showClientPicker, setShowClientPicker] = useState(false)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [userId, setUserId] = useState(null)
  const [userPlan, setUserPlan] = useState('free')
  const [todaySalesCount, setTodaySalesCount] = useState(0)
  const [error, setError] = useState('')
  const [online, setOnline] = useState(isOnline())
  const [showOnlineBanner, setShowOnlineBanner] = useState(true)
  const [pendingCount, setPendingCount] = useState(0)
  const [allSales, setAllSales] = useState([])
  const [salesLoading, setSalesLoading] = useState(false)
  const [historyFilter, setHistoryFilter] = useState('today')

  const paymentLabel = (method) => ({
    cash: 'Cash', airtel: 'Airtel Money',
    orange: 'Orange Money', mpesa: 'M-Pesa', credit: 'Crédit'
  })[method] || method

  const paymentColor = (method) => ({
    cash: '#16A34A', airtel: '#EF4444',
    orange: '#F97316', mpesa: '#8B5CF6', credit: '#F5A623'
  })[method] || '#64748B'

  const syncPendingSales = async (uid) => {
    try {
      const id = uid || userId
      if (!id) {
        setPendingCount(0)
        return
      }

      const pending = await getCleanPendingSales(id)
      if (pending.length === 0) {
        setPendingCount(0)
        return
      }

      for (const { local_id, saleData } of pending) {
        console.log('=== SYNC SALE ===')
        console.log('saleData:', JSON.stringify(saleData))

        const { error: saleError } = await supabase.from('sales').insert(saleData)
        console.log('Sale insert error:', saleError)

        if (!saleError) {
          await markSaleSynced(local_id)

          // Mettre à jour le stock dans Supabase
          if (saleData.product_id) {
            const { data: product, error: productError } = await supabase
              .from('products')
              .select('quantity')
              .eq('id', saleData.product_id)
              .eq('user_id', id)
              .single()

            console.log('Product found:', product, 'error:', productError)

            if (product) {
              const newQty = Math.max(0, product.quantity - saleData.quantity)
              const { error: updateError } = await supabase
                .from('products')
                .update({ quantity: newQty })
                .eq('id', saleData.product_id)
                .eq('user_id', id)

              console.log('Stock update error:', updateError, 'new qty:', newQty)
            }
          }
        }
      }

      setPendingCount(0)
      fetchData()
    } catch (err) {
      console.error('Erreur synchronisation:', err)
      setPendingCount(0)
    }
  }

  const fetchData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setUserId(user.id)

    const { data: userData } = await supabase
      .from('users')
      .select('plan')
      .eq('id', user.id)
      .single()
    if (userData) setUserPlan(userData.plan)

    const { data: productsData } = await supabase
      .from('products')
      .select('*')
      .eq('user_id', user.id)
      .order('name')
    if (productsData) setProducts(productsData)

    const { data: clientsData } = await supabase
      .from('customers')
      .select('*')
      .eq('user_id', user.id)
      .order('name')
    if (clientsData) setClients(clientsData)

    const startOfDay = new Date()
    startOfDay.setHours(0, 0, 0, 0)
    const { data: salesData } = await supabase
      .from('sales')
      .select('id')
      .eq('user_id', user.id)
      .gte('created_at', startOfDay.toISOString())
    if (salesData) setTodaySalesCount(salesData.length)

    const pending = await getCleanPendingSales(user.id)
    setPendingCount(pending.length)
    if (pending.length > 0 && navigator.onLine) {
      syncPendingSales(user.id)
    }
  }

  const fetchAllSales = async () => {
    setSalesLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const start = new Date()
    if (historyFilter === 'today') start.setHours(0, 0, 0, 0)
    else if (historyFilter === 'week') start.setDate(start.getDate() - 7)
    else if (historyFilter === 'month') start.setDate(1)

    let query = supabase
      .from('sales')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100)

    if (historyFilter !== 'all') {
      query = query.gte('created_at', start.toISOString())
    }

    const { data } = await query
    if (data) setAllSales(data)
    setSalesLoading(false)
  }

  useEffect(() => {
    fetchData()

    const handleOnline = () => {
      setOnline(true)
      setShowOnlineBanner(true)
      setTimeout(() => setShowOnlineBanner(false), 3000)
      fetchData()
    }
    const handleOffline = () => setOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    const timer = setTimeout(() => setShowOnlineBanner(false), 3000)

    return () => {
      clearTimeout(timer)
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  useEffect(() => {
    if (activeTab === 'history') fetchAllSales()
  }, [activeTab, historyFilter])

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase())
  )

  const filteredClients = clients.filter(c =>
    c.name.toLowerCase().includes(clientSearch.toLowerCase())
  )

  const filteredHistory = allSales.filter(s =>
    s.product_name.toLowerCase().includes(historySearch.toLowerCase()) ||
    (s.customer_name && s.customer_name.toLowerCase().includes(historySearch.toLowerCase())) ||
    paymentLabel(s.payment_method).toLowerCase().includes(historySearch.toLowerCase())
  )

  const total = selected ? selected.price_sell * quantity : 0

  const formatFC = (amount) =>
    new Intl.NumberFormat('fr-FR').format(Math.round(amount)) + ' FC'

  const formatDateTime = (dateStr) => {
    const d = new Date(dateStr)
    return d.toLocaleDateString('fr-FR', {
      day: '2-digit', month: '2-digit'
    }) + ' à ' + d.toLocaleTimeString('fr-FR', {
      hour: '2-digit', minute: '2-digit'
    })
  }

  const handleConfirm = async () => {
    if (!selected) { setError('Sélectionne un produit'); return }
    if (quantity <= 0) { setError('La quantité doit être supérieure à 0'); return }
    if (quantity > selected.quantity) {
      setError(`Stock insuffisant — ${selected.quantity} unités disponibles`)
      return
    }
    if (!canAddSale(userPlan, todaySalesCount)) {
      setError(`Limite atteinte — ton plan permet ${getPlanLimits(userPlan).maxSalesPerDay} ventes par jour.`)
      return
    }
    if (payment === 'credit' && !selectedClient) {
      setError('Sélectionne un client pour la vente à crédit')
      return
    }
    setError('')
    setLoading(true)

    const saleData = {
      user_id: userId,
      product_id: selected.id,
      product_name: sanitize(selected.name),
      quantity,
      total,
      cost: (selected.price_buy || 0) * quantity,
      payment_method: payment,
      customer_id: payment === 'credit' ? selectedClient?.id : null,
      customer_name: payment === 'credit' ? selectedClient?.name : null,
    }

    if (!isOnline()) {
      await saveSaleOffline(saleData)
      setPendingCount(prev => prev + 1)
      setSuccess(true)
      setTodaySalesCount(prev => prev + 1)

      // Mettre à jour le stock localement
      setProducts(prev => prev.map(p =>
        p.id === selected.id
          ? { ...p, quantity: p.quantity - quantity }
          : p
      ))

      setTimeout(() => {
        setSuccess(false)
        setSelected(null)
        setQuantity(1)
        setPayment('cash')
        setSelectedClient(null)
        setError('')
      }, 1500)
      setLoading(false)
      return
    }

    const { error: saleError } = await supabase.from('sales').insert(saleData)

    if (!saleError) {
      await supabase
        .from('products')
        .update({ quantity: selected.quantity - quantity })
        .eq('id', selected.id)

      if (payment === 'credit' && selectedClient) {
        await supabase.from('debts').insert({
          user_id: userId,
          customer_id: selectedClient.id,
          amount: total,
          paid: 0,
          status: 'pending',
          note: `Vente crédit — ${sanitize(selected.name)}`,
        })

        await supabase
          .from('customers')
          .update({ total_debt: selectedClient.total_debt + total })
          .eq('id', selectedClient.id)
      }

      setSuccess(true)
      setTodaySalesCount(prev => prev + 1)
      setTimeout(() => {
        setSuccess(false)
        setSelected(null)
        setQuantity(1)
        setPayment('cash')
        setSelectedClient(null)
        setError('')
        fetchData()
      }, 1500)
    } else {
      setError("Erreur lors de l'enregistrement — réessaie")
      console.error('Sale error:', saleError)
    }

    setLoading(false)
  }

  const paymentMethods = [
    { id: 'cash', label: 'Cash', color: '#16A34A' },
    { id: 'airtel', label: 'Airtel Money', color: '#EF4444' },
    { id: 'orange', label: 'Orange Money', color: '#F97316' },
    { id: 'mpesa', label: 'M-Pesa', color: '#8B5CF6' },
    { id: 'credit', label: 'Crédit client', color: '#F5A623' },
  ]

  const limitReached = !canAddSale(userPlan, todaySalesCount)
  const totalHistory = filteredHistory.reduce((sum, s) => sum + s.total, 0)

  const getInitials = (name) =>
    name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)

  return (
    <div className="min-h-screen bg-[#EEF2F7] pb-8">

      <Header title="Ventes" />

      <div className="flex bg-white border-b border-gray-200">
        <button
          onClick={() => setActiveTab('new')}
          className={`flex-1 py-3 text-xs font-semibold transition-colors ${
            activeTab === 'new'
              ? 'text-[#1A56DB] border-b-2 border-[#1A56DB]'
              : 'text-[#64748B]'
          }`}
        >
          + Nouvelle vente
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`flex-1 py-3 text-xs font-semibold transition-colors ${
            activeTab === 'history'
              ? 'text-[#1A56DB] border-b-2 border-[#1A56DB]'
              : 'text-[#64748B]'
          }`}
        >
          📋 Historique
        </button>
      </div>

      {activeTab === 'new' && (
        <>
          {!online ? (
            <div className="bg-[#FFFBEB] border-b border-yellow-200 px-4 py-2 flex items-center gap-2">
              <span className="text-sm">📶</span>
              <div className="flex-1">
                <p className="text-xs text-[#B45309] font-medium">Mode hors ligne</p>
                <p className="text-xs text-[#64748B]">Les ventes seront synchronisées au retour du réseau</p>
              </div>
              {pendingCount > 0 && (
                <span className="text-xs font-bold bg-[#F5A623] text-white px-2 py-1 rounded-full">
                  {pendingCount} en attente
                </span>
              )}
            </div>
          ) : pendingCount > 0 ? (
            <div className="bg-[#EBF2FF] border-b border-blue-200 px-4 py-2 flex items-center gap-2">
              <span className="text-sm">🔄</span>
              <p className="text-xs text-[#1A56DB] font-medium">
                {pendingCount} vente{pendingCount > 1 ? 's' : ''} en cours de synchronisation...
              </p>
            </div>
          ) : showOnlineBanner ? (
            <div className="bg-[#F0FDF4] border-b border-green-200 px-4 py-2 flex items-center gap-2">
              <span className="text-sm">✅</span>
              <p className="text-xs text-[#16A34A] font-medium">
                Connecté — synchronisation automatique active
              </p>
            </div>
          ) : null}

          {limitReached && (
            <div className="bg-[#FEF2F2] px-4 py-3 flex items-center justify-between border-b border-red-200">
              <div>
                <p className="text-xs font-semibold text-[#DC2626]">
                  Limite de {getPlanLimits(userPlan).maxSalesPerDay} ventes/jour atteinte
                </p>
                <p className="text-xs text-[#64748B]">Passe au Pro pour des ventes illimitées</p>
              </div>
              <button
                onClick={() => navigate('/expired')}
                className="text-xs font-semibold bg-[#DC2626] text-white px-3 py-1.5 rounded-lg"
              >
                Passer au Pro
              </button>
            </div>
          )}

          {success && (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
              <div className="bg-white rounded-2xl p-8 text-center mx-4">
                <div className="w-16 h-16 bg-[#F0FDF4] rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-4xl">✅</span>
                </div>
                <p className="text-lg font-bold text-[#0F172A]">Vente enregistrée !</p>
                <p className="text-sm text-[#64748B] mt-1">{formatFC(total)}</p>
                {payment === 'credit' && selectedClient && (
                  <p className="text-xs text-[#F5A623] mt-2">
                    💳 Dette ajoutée pour {selectedClient.name}
                  </p>
                )}
                {!online && (
                  <p className="text-xs text-[#F5A623] mt-2">
                    📶 Sera synchronisée au retour du réseau
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="px-4 pt-4">
            <div className="bg-white rounded-xl border border-gray-200 px-3 py-3 flex items-center gap-2 mb-4">
              <span className="text-gray-400">🔍</span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Chercher un produit..."
                className="flex-1 text-sm outline-none text-[#0F172A] placeholder-gray-400"
              />
            </div>

            <p className="text-xs font-semibold text-[#64748B] uppercase tracking-wide mb-1">
              {search ? 'Résultats' : 'Produits récents'}
            </p>

            {!selected && !search && products.length > 0 && (
              <p className="text-xs text-[#1A56DB] mb-3 flex items-center gap-1">
                <span>👆</span> Appuie sur un produit pour l'ajouter à la vente
              </p>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-3">
                <p className="text-xs text-[#DC2626] font-medium">{error}</p>
              </div>
            )}

            {products.length === 0 ? (
              <div className="text-center py-8 bg-white rounded-xl border border-gray-200 mb-4">
                <p className="text-3xl mb-2">📦</p>
                <p className="text-sm font-semibold text-[#0F172A]">Aucun produit</p>
                <p className="text-xs text-[#64748B] mt-1">Ajoute d'abord des produits dans Stocks</p>
                <button
                  onClick={() => navigate('/stocks')}
                  className="mt-3 text-xs text-[#1A56DB] font-medium"
                >
                  Aller aux stocks →
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 mb-4">
                {filtered.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      if (limitReached) {
                        setError('Limite atteinte — passe au Pro')
                        return
                      }
                      setSelected(p)
                      setQuantity(1)
                      setError('')
                    }}
                    className={`text-left p-3 rounded-xl border transition-all ${
                      selected?.id === p.id
                        ? 'border-[#1A56DB] bg-[#EBF2FF] border-2'
                        : limitReached
                        ? 'border-gray-200 bg-gray-50 opacity-50'
                        : 'border-gray-200 bg-white'
                    }`}
                  >
                    <p className="text-xs font-semibold text-[#0F172A] mb-1">{p.name}</p>
                    <p className="text-sm font-bold text-[#1A56DB]">{formatFC(p.price_sell)}</p>
                    <p className={`text-xs mt-1 ${
                      p.quantity <= p.alert_threshold ? 'text-[#DC2626]' : 'text-[#64748B]'
                    }`}>
                      {p.quantity <= p.alert_threshold ? '⚠️ ' : ''}Stock : {p.quantity}
                    </p>
                  </button>
                ))}
              </div>
            )}

            {!selected && products.length > 0 && !limitReached && (
              <div className="bg-[#EBF2FF] border border-[#1A56DB]/20 rounded-xl p-4 text-center mt-2">
                <p className="text-2xl mb-2">☝️</p>
                <p className="text-sm font-semibold text-[#1A56DB]">Sélectionne un produit</p>
                <p className="text-xs text-[#64748B] mt-1">Appuie sur un produit ci-dessus pour commencer</p>
              </div>
            )}

            {selected && (
              <>
                <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex items-center justify-between mb-2">
                  <div>
                    <p className="text-xs text-[#64748B]">Produit sélectionné</p>
                    <p className="text-sm font-bold text-[#0F172A]">{selected.name}</p>
                  </div>
                  <button
                    onClick={() => { setSelected(null); setQuantity(1); setError('') }}
                    className="text-xs text-[#DC2626] font-medium"
                  >
                    Changer
                  </button>
                </div>

                <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex items-center justify-between mb-4">
                  <p className="text-sm font-semibold text-[#0F172A]">Quantité</p>
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      className="w-8 h-8 bg-[#EBF2FF] rounded-lg flex items-center justify-center text-[#1A56DB] font-bold"
                    >
                      −
                    </button>
                    <span className="text-lg font-bold text-[#0F172A] w-6 text-center">{quantity}</span>
                    <button
                      onClick={() => setQuantity(Math.min(selected.quantity, quantity + 1))}
                      className="w-8 h-8 bg-[#EBF2FF] rounded-lg flex items-center justify-center text-[#1A56DB] font-bold"
                    >
                      +
                    </button>
                  </div>
                </div>

                <p className="text-xs font-semibold text-[#64748B] uppercase tracking-wide mb-2">
                  Mode de paiement
                </p>
                <div className="grid grid-cols-2 gap-2 mb-4">
                  {paymentMethods.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => {
                        setPayment(m.id)
                        if (m.id !== 'credit') setSelectedClient(null)
                      }}
                      className={`flex items-center gap-2 p-3 rounded-xl border text-sm font-medium transition-all ${
                        payment === m.id
                          ? 'border-[#1A56DB] bg-[#EBF2FF] text-[#1A56DB] border-2'
                          : 'border-gray-200 bg-white text-[#0F172A]'
                      } ${m.id === 'credit' ? 'col-span-2' : ''}`}
                    >
                      <div
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ background: m.color }}
                      />
                      {m.label}
                    </button>
                  ))}
                </div>

                {payment === 'credit' && (
                  <div className="mb-4">
                    <p className="text-xs font-semibold text-[#64748B] uppercase tracking-wide mb-2">
                      Client en crédit
                    </p>
                    {selectedClient ? (
                      <div className="bg-[#FFFBEB] border border-yellow-200 rounded-xl p-3 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-[#F5A623] rounded-full flex items-center justify-center text-white text-xs font-bold">
                            {getInitials(selectedClient.name)}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-[#0F172A]">{selectedClient.name}</p>
                            <p className="text-xs text-[#64748B]">{selectedClient.phone || 'Pas de téléphone'}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => setSelectedClient(null)}
                          className="text-xs text-[#DC2626] font-medium"
                        >
                          Changer
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setShowClientPicker(true)}
                        className="w-full border-2 border-dashed border-[#F5A623] bg-[#FFFBEB] text-[#B45309] rounded-xl py-3 text-sm font-medium flex items-center justify-center gap-2"
                      >
                        👤 Sélectionner un client
                      </button>
                    )}
                    {clients.length === 0 && (
                      <p className="text-xs text-[#64748B] mt-2 text-center">
                        Aucun client —{' '}
                        <span
                          onClick={() => navigate('/clients')}
                          className="text-[#1A56DB] cursor-pointer font-medium"
                        >
                          Ajouter un client
                        </span>
                      </p>
                    )}
                  </div>
                )}

                <div className="bg-[#0F172A] rounded-xl px-4 py-4 flex items-center justify-between mb-3">
                  <p className="text-sm text-white/70">Total à payer</p>
                  <p className="text-2xl font-bold text-white">{formatFC(total)}</p>
                </div>

                <button
                  onClick={handleConfirm}
                  disabled={loading || limitReached}
                  className="w-full bg-[#16A34A] text-white rounded-xl py-4 font-bold text-sm flex items-center justify-center gap-2 mb-2 disabled:opacity-50"
                >
                  ✓ {loading ? 'Enregistrement...' : online ? 'Confirmer la vente' : 'Enregistrer (hors ligne)'}
                </button>
                <button
                  onClick={() => { setSelected(null); setQuantity(1); setError(''); setSelectedClient(null) }}
                  className="w-full bg-white border border-gray-200 text-[#64748B] rounded-xl py-3 font-medium text-sm mb-4"
                >
                  Annuler
                </button>
              </>
            )}
          </div>
        </>
      )}

      {activeTab === 'history' && (
        <div className="px-4 pt-4 pb-8">

          <div className="bg-white rounded-xl border border-gray-200 p-3 mb-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-[#64748B] uppercase tracking-wide mb-1">Total</p>
              <p className="text-xl font-bold text-[#1A56DB]">{formatFC(totalHistory)}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-[#64748B] uppercase tracking-wide mb-1">Transactions</p>
              <p className="text-xl font-bold text-[#0F172A]">{filteredHistory.length}</p>
            </div>
          </div>

          <div className="flex gap-2 mb-3">
            {[
              { id: 'today', label: "Aujourd'hui" },
              { id: 'week', label: 'Semaine' },
              { id: 'month', label: 'Mois' },
              { id: 'all', label: 'Tout' },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setHistoryFilter(f.id)}
                className={`flex-1 py-2 rounded-xl text-xs font-medium border transition-all ${
                  historyFilter === f.id
                    ? 'bg-[#1A56DB] text-white border-[#1A56DB]'
                    : 'bg-white text-[#64748B] border-gray-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="bg-white rounded-xl border border-gray-200 px-3 py-3 flex items-center gap-2 mb-4">
            <span className="text-gray-400">🔍</span>
            <input
              value={historySearch}
              onChange={(e) => setHistorySearch(e.target.value)}
              placeholder="Chercher dans l'historique..."
              className="flex-1 text-sm outline-none text-[#0F172A] placeholder-gray-400"
            />
            {historySearch && (
              <button onClick={() => setHistorySearch('')} className="text-gray-400 text-sm">✕</button>
            )}
          </div>

          {salesLoading ? (
            <p className="text-center text-[#64748B] text-sm py-8">Chargement...</p>
          ) : filteredHistory.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-3xl mb-2">🛒</p>
              <p className="text-sm font-semibold text-[#0F172A]">Aucune vente</p>
              <p className="text-xs text-[#64748B] mt-1">
                {historySearch ? 'Aucun résultat pour cette recherche' : 'Aucune vente pour cette période'}
              </p>
            </div>
          ) : (
            filteredHistory.map((sale) => (
              <div key={sale.id} className="bg-white rounded-xl border border-gray-200 p-3 flex items-center gap-3 mb-2">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: paymentColor(sale.payment_method) + '20' }}
                >
                  <span className="text-sm">🛒</span>
                </div>
                <div className="flex-1">
                  <p className="text-xs font-semibold text-[#0F172A]">{sale.product_name}</p>
                  <p className="text-xs text-[#64748B]">
                    {formatDateTime(sale.created_at)} · {paymentLabel(sale.payment_method)}
                  </p>
                  {sale.customer_name && (
                    <p className="text-xs text-[#F5A623] font-medium">👤 {sale.customer_name}</p>
                  )}
                  <p className="text-xs text-[#64748B]">Qté : {sale.quantity}</p>
                </div>
                <span className="text-sm font-bold text-[#1A56DB]">{formatFC(sale.total)}</span>
              </div>
            ))
          )}
        </div>
      )}

      {showClientPicker && (
        <div className="fixed inset-0 bg-black/50 flex items-end z-50">
          <div className="bg-white rounded-t-2xl w-full p-5 max-h-[70vh] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-[#0F172A]">Choisir un client</h2>
              <button onClick={() => setShowClientPicker(false)} className="text-[#64748B] text-xl">✕</button>
            </div>
            <div className="bg-[#EEF2F7] rounded-xl px-3 py-2 flex items-center gap-2 mb-3">
              <span className="text-gray-400">🔍</span>
              <input
                value={clientSearch}
                onChange={(e) => setClientSearch(e.target.value)}
                placeholder="Chercher un client..."
                className="flex-1 text-sm outline-none bg-transparent text-[#0F172A] placeholder-gray-400"
              />
            </div>
            <div className="overflow-y-auto flex-1">
              {filteredClients.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-3xl mb-2">👥</p>
                  <p className="text-sm font-semibold text-[#0F172A]">Aucun client trouvé</p>
                  <button
                    onClick={() => { setShowClientPicker(false); navigate('/clients') }}
                    className="mt-3 text-xs text-[#1A56DB] font-medium"
                  >
                    Ajouter un client →
                  </button>
                </div>
              ) : (
                filteredClients.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => {
                      setSelectedClient(c)
                      setShowClientPicker(false)
                      setClientSearch('')
                      setError('')
                    }}
                    className="w-full flex items-center gap-3 p-3 rounded-xl border border-gray-100 bg-white mb-2 text-left"
                  >
                    <div className="w-9 h-9 rounded-full bg-[#EBF2FF] flex items-center justify-center text-sm font-bold text-[#1A56DB] flex-shrink-0">
                      {getInitials(c.name)}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-[#0F172A]">{c.name}</p>
                      <p className="text-xs text-[#64748B]">{c.phone || 'Pas de téléphone'}</p>
                    </div>
                    {c.total_debt > 0 && (
                      <span className="text-xs text-[#DC2626] font-medium">
                        {formatFC(c.total_debt)} dû
                      </span>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      <Navbar />

    </div>
  )
}