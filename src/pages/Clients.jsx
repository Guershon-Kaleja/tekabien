import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { validateClient, sanitize } from '../lib/validation'
import { canAddClient, getPlanLimits } from '../lib/planLimits'
import Header from '../components/Header'
import Navbar from '../components/Navbar'
import usePlanCheck from '../hooks/usePlanCheck'
import useCurrency from '../hooks/useCurrency'

export default function Clients() {
  usePlanCheck()
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('tous')
  const [userId, setUserId] = useState(null)
  const [userPlan, setUserPlan] = useState('free')

  // Modals
  const [showForm, setShowForm] = useState(false)
  const [showEditForm, setShowEditForm] = useState(false)
  const [showDebtForm, setShowDebtForm] = useState(false)
  const [showPayForm, setShowPayForm] = useState(false)
  const [showEditDebt, setShowEditDebt] = useState(false)
  const [showHistory, setShowHistory] = useState(false)

  const [selectedClient, setSelectedClient] = useState(null)
  const [form, setForm] = useState({ name: '', phone: '' })
  const [editForm, setEditForm] = useState({ name: '', phone: '' })
  const [debtForm, setDebtForm] = useState({ amount: '', note: '' })
  const [payForm, setPayForm] = useState({ amount: '', note: '' })
  const [editDebtAmount, setEditDebtAmount] = useState('')
  const [debtHistory, setDebtHistory] = useState([])

  const [formErrors, setFormErrors] = useState({})
  const [editErrors, setEditErrors] = useState({})
  const [debtErrors, setDebtErrors] = useState({})
  const [payErrors, setPayErrors] = useState({})

  useEffect(() => { fetchClients() }, [])

  const fetchClients = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setUserId(user.id)

    const { data: userData } = await supabase
      .from('users').select('plan').eq('id', user.id).single()
    if (userData) setUserPlan(userData.plan)

    const { data } = await supabase
      .from('customers').select('*').eq('user_id', user.id).order('name')
    if (data) setClients(data)
    setLoading(false)
  }

  const fetchDebtHistory = async (client) => {
    const { data } = await supabase
      .from('debt_payments')
      .select('*')
      .eq('customer_id', client.id)
      .order('created_at', { ascending: false })
    if (data) setDebtHistory(data)
  }

  const normalizePhone = (phone) => {
    const clean = phone.replace(/\s/g, '').replace('+243', '0').replace('+', '')
    if (clean.length === 9 && !clean.startsWith('0')) return '0' + clean
    return clean
  }

  const handleAddClient = async () => {
    if (!canAddClient(userPlan, clients.length)) {
      setFormErrors({ name: `Limite atteinte — ${getPlanLimits(userPlan).maxClients} clients max. Passe au Pro.` })
      return
    }
    const normalizedForm = { ...form, phone: form.phone ? normalizePhone(form.phone) : '' }
    const errors = validateClient(normalizedForm)
    if (Object.keys(errors).length > 0) { setFormErrors(errors); return }
    setFormErrors({})

    const { error } = await supabase.from('customers').insert({
      user_id: userId,
      name: sanitize(normalizedForm.name),
      phone: sanitize(normalizedForm.phone),
      total_debt: 0,
      total_paid: 0,
    })
    if (!error) {
      setShowForm(false)
      setForm({ name: '', phone: '' })
      fetchClients()
    }
  }

  const handleEditClient = async () => {
    const normalizedForm = { ...editForm, phone: editForm.phone ? normalizePhone(editForm.phone) : '' }
    const errors = validateClient(normalizedForm)
    if (Object.keys(errors).length > 0) { setEditErrors(errors); return }
    setEditErrors({})

    const { error } = await supabase
      .from('customers')
      .update({
        name: sanitize(normalizedForm.name),
        phone: sanitize(normalizedForm.phone),
      })
      .eq('id', selectedClient.id)

    if (!error) {
      setShowEditForm(false)
      setSelectedClient(null)
      fetchClients()
    }
  }

  const handleAddDebt = async () => {
    if (!debtForm.amount || parseFloat(debtForm.amount) <= 0) {
      setDebtErrors({ amount: 'Le montant doit être supérieur à 0' }); return
    }
    setDebtErrors({})
    const amount = parseFloat(debtForm.amount)

    const { error } = await supabase.from('debts').insert({
      user_id: userId,
      customer_id: selectedClient.id,
      amount, paid: 0, status: 'pending',
      note: sanitize(debtForm.note),
    })
    if (!error) {
      await supabase.from('customers')
        .update({ total_debt: selectedClient.total_debt + amount })
        .eq('id', selectedClient.id)
      setShowDebtForm(false)
      setDebtForm({ amount: '', note: '' })
      fetchClients()
    }
  }

  const handleEditDebt = async () => {
    if (!editDebtAmount || parseFloat(editDebtAmount) < 0) return
    const newAmount = parseFloat(editDebtAmount)

    await supabase.from('customers')
      .update({ total_debt: newAmount })
      .eq('id', selectedClient.id)

    setShowEditDebt(false)
    setEditDebtAmount('')
    fetchClients()
  }

  const handlePartialPay = async () => {
    const amount = parseFloat(payForm.amount)
    if (!amount || amount <= 0) {
      setPayErrors({ amount: 'Le montant doit être supérieur à 0' }); return
    }
    if (amount > selectedClient.total_debt) {
      setPayErrors({ amount: `Le montant ne peut pas dépasser la dette (${formatAmount(selectedClient.total_debt)})` }); return
    }
    setPayErrors({})

    const newDebt = selectedClient.total_debt - amount
    const newPaid = (selectedClient.total_paid || 0) + amount

    // Enregistrer le remboursement
    await supabase.from('debt_payments').insert({
      user_id: userId,
      customer_id: selectedClient.id,
      amount,
      note: sanitize(payForm.note) || 'Remboursement partiel',
    })

    // Mettre à jour la dette
    await supabase.from('customers')
      .update({ total_debt: newDebt, total_paid: newPaid })
      .eq('id', selectedClient.id)

    // Si dette soldée → comptabiliser les ventes crédit
    if (newDebt === 0) {
      await supabase.from('sales')
        .update({ encaissee: true })
        .eq('customer_id', selectedClient.id)
        .eq('payment_method', 'credit')
        .eq('encaissee', false)

      await supabase.from('debts')
        .update({ status: 'paid', paid: selectedClient.total_debt })
        .eq('customer_id', selectedClient.id)
        .eq('status', 'pending')
    }

    setShowPayForm(false)
    setPayForm({ amount: '', note: '' })
    fetchClients()
  }

  const handleFullPay = async (client) => {
    await supabase.from('debt_payments').insert({
      user_id: userId,
      customer_id: client.id,
      amount: client.total_debt,
      note: 'Remboursement total',
    })

    await supabase.from('customers')
      .update({ total_debt: 0, total_paid: (client.total_paid || 0) + client.total_debt })
      .eq('id', client.id)

    await supabase.from('debts')
      .update({ status: 'paid', paid: client.total_debt })
      .eq('customer_id', client.id).eq('status', 'pending')

    await supabase.from('sales')
      .update({ encaissee: true })
      .eq('customer_id', client.id)
      .eq('payment_method', 'credit').eq('encaissee', false)

    fetchClients()
  }

  const handleWhatsApp = (client) => {
    const msg = encodeURIComponent(
      `Bonjour ${client.name}, nous vous rappelons que vous avez une dette de ${formatAmount(client.total_debt)} à notre boutique. Merci de régulariser dès que possible.`
    )
    const phone = client.phone?.replace(/\s/g, '').replace('+', '')
    window.open(`https://wa.me/${phone}?text=${msg}`, '_blank')
  }

  const { formatAmount, currency } = useCurrency()

  const formatDate = (dateStr) =>
    new Date(dateStr).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' }) +
    ' à ' + new Date(dateStr).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })

  const totalDebt = clients.reduce((sum, c) => sum + c.total_debt, 0)
  const lateCount = clients.filter(c => c.total_debt > 0).length

  const filtered = clients.filter(c => {
    const matchSearch = c.name.toLowerCase().includes(search.toLowerCase())
    const matchFilter = filter === 'tous' ? true :
      filter === 'dette' ? c.total_debt > 0 : c.total_debt === 0
    return matchSearch && matchFilter
  })

  const getInitials = (name) =>
    name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)

  return (
    <div className="min-h-screen bg-[#EEF2F7] pb-24">

      <div className="bg-[#1A56DB] px-4 pt-0 pb-4">
        <Header title="Clients & Dettes" showAdd onAdd={() => setShowForm(true)} />
        <div className="bg-white/12 rounded-xl p-3 border border-white/20 flex items-center justify-between">
          <div>
            <p className="text-blue-200 text-xs uppercase tracking-wide mb-1">Total dû</p>
            <p className="text-white text-2xl font-bold">{formatAmount(totalDebt)}</p>
            <p className="text-blue-200 text-xs mt-1">par {clients.length} clients</p>
          </div>
          <div className="bg-red-500/30 rounded-xl px-4 py-3 text-center">
            <p className="text-red-200 text-2xl font-bold">{lateCount}</p>
            <p className="text-blue-200 text-xs">En retard</p>
          </div>
        </div>
      </div>

      <div className="px-4 pt-4">

        <div className="bg-white rounded-xl border border-gray-200 px-3 py-3 flex items-center gap-2 mb-3">
          <span className="text-gray-400">🔍</span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Chercher un client..."
            className="flex-1 text-sm outline-none text-[#0F172A] placeholder-gray-400"
          />
        </div>

        <div className="flex gap-2 mb-4">
          {[
            { id: 'tous', label: 'Tous' },
            { id: 'dette', label: 'En dette' },
            { id: 'ok', label: 'À jour' },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`px-4 py-2 rounded-full text-xs font-medium border transition-all ${
                filter === f.id
                  ? 'bg-[#1A56DB] text-white border-[#1A56DB]'
                  : 'bg-white text-[#64748B] border-gray-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="text-center text-[#64748B] text-sm py-8">Chargement...</p>
        ) : filtered.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-3xl mb-2">👥</p>
            <p className="text-sm font-semibold text-[#0F172A]">Aucun client</p>
            <p className="text-xs text-[#64748B] mt-1">Ajoute ton premier client</p>
          </div>
        ) : (
          filtered.map((c) => (
            <div
              key={c.id}
              className="bg-white rounded-xl border border-gray-200 p-3 mb-2"
              style={{ borderLeft: c.total_debt > 0 ? '3px solid #DC2626' : '3px solid #16A34A' }}
            >
              <div className="flex items-center gap-3 mb-2">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                  style={{
                    background: c.total_debt > 0 ? '#FEF2F2' : '#F0FDF4',
                    color: c.total_debt > 0 ? '#DC2626' : '#16A34A'
                  }}
                >
                  {getInitials(c.name)}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-[#0F172A]">{c.name}</p>
                  <p className="text-xs text-[#64748B]">{c.phone || 'Pas de téléphone'}</p>
                  {c.total_paid > 0 && (
                    <p className="text-xs text-[#16A34A]">✓ {formatAmount(c.total_paid)} déjà remboursé</p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1">
                  <p className={`text-base font-bold ${c.total_debt > 0 ? 'text-[#DC2626]' : 'text-[#16A34A]'}`}>
                    {formatAmount(c.total_debt)}
                  </p>
                  <p className="text-xs text-[#64748B]">{c.total_debt > 0 ? 'doit' : 'À jour ✓'}</p>
                </div>
              </div>

              {/* Boutons d'action */}
              <div className="flex gap-2 mb-2">
                <button
                  onClick={() => {
                    setSelectedClient(c)
                    setEditForm({ name: c.name, phone: c.phone || '' })
                    setShowEditForm(true)
                  }}
                  className="flex-1 bg-[#EBF2FF] text-[#1A56DB] rounded-lg py-2 text-xs font-semibold"
                >
                  ✏️ Modifier
                </button>
                <button
                  onClick={() => {
                    setSelectedClient(c)
                    fetchDebtHistory(c)
                    setShowHistory(true)
                  }}
                  className="flex-1 bg-[#F8FAFC] text-[#64748B] rounded-lg py-2 text-xs font-semibold border border-gray-200"
                >
                  📋 Historique
                </button>
              </div>

              {c.total_debt > 0 && (
                <div className="flex gap-2">
                  <button
                    onClick={() => { setSelectedClient(c); setShowPayForm(true) }}
                    className="flex-1 bg-[#FFFBEB] text-[#B45309] rounded-lg py-2 text-xs font-semibold border border-yellow-200"
                  >
                    💰 Paiement partiel
                  </button>
                  <button
                    onClick={() => handleFullPay(c)}
                    className="flex-1 bg-[#F0FDF4] text-[#16A34A] rounded-lg py-2 text-xs font-semibold"
                  >
                    ✓ Tout remboursé
                  </button>
                </div>
              )}

              {c.total_debt > 0 && (
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => {
                      setSelectedClient(c)
                      setEditDebtAmount(c.total_debt.toString())
                      setShowEditDebt(true)
                    }}
                    className="flex-1 bg-white border border-gray-200 text-[#64748B] rounded-lg py-2 text-xs font-medium"
                  >
                    ✏️ Modifier dette
                  </button>
                  <button
                    onClick={() => handleWhatsApp(c)}
                    className="flex-1 bg-[#EBF2FF] text-[#1A56DB] rounded-lg py-2 text-xs font-semibold"
                  >
                    💬 WhatsApp
                  </button>
                </div>
              )}

              {c.total_debt === 0 && (
                <button
                  onClick={() => { setSelectedClient(c); setShowDebtForm(true) }}
                  className="w-full bg-[#FEF2F2] text-[#DC2626] rounded-lg py-2 text-xs font-semibold mt-1"
                >
                  + Ajouter une dette
                </button>
              )}
            </div>
          ))
        )}

        <button
          onClick={() => setShowForm(true)}
          className={`w-full border border-dashed rounded-xl py-3 text-sm font-medium flex items-center justify-center gap-2 mt-2 ${
            canAddClient(userPlan, clients.length)
              ? 'border-[#1A56DB] text-[#1A56DB]'
              : 'border-gray-300 text-[#64748B]'
          }`}
        >
          {canAddClient(userPlan, clients.length)
            ? '+ Ajouter un client'
            : `Limite atteinte (${getPlanLimits(userPlan).maxClients} max) — Passe au Pro`
          }
        </button>
      </div>

      {/* Modal ajout client */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-end z-50">
          <div className="bg-white rounded-t-2xl w-full p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-[#0F172A]">Nouveau client</h2>
              <button onClick={() => { setShowForm(false); setFormErrors({}) }} className="text-[#64748B] text-xl">✕</button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#64748B] uppercase tracking-wide mb-1">Nom du client</label>
                <input
                  value={form.name}
                  onChange={(e) => { setForm({ ...form, name: e.target.value }); setFormErrors({ ...formErrors, name: null }) }}
                  placeholder="Ex: Mama Mutombo"
                  className={`w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#1A56DB] ${formErrors.name ? 'border-[#DC2626]' : 'border-gray-200'}`}
                />
                {formErrors.name && <p className="text-xs text-[#DC2626] mt-1">{formErrors.name}</p>}
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#64748B] uppercase tracking-wide mb-1">Téléphone</label>
                <input
                  value={form.phone}
                  onChange={(e) => { setForm({ ...form, phone: e.target.value }); setFormErrors({ ...formErrors, phone: null }) }}
                  placeholder="Ex: 0891234567"
                  className={`w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#1A56DB] ${formErrors.phone ? 'border-[#DC2626]' : 'border-gray-200'}`}
                />
                {formErrors.phone && <p className="text-xs text-[#DC2626] mt-1">{formErrors.phone}</p>}
              </div>
            </div>
            <button onClick={handleAddClient} className="w-full bg-[#1A56DB] text-white rounded-xl py-3 font-semibold text-sm mt-4">
              Ajouter le client
            </button>
          </div>
        </div>
      )}

      {/* Modal modifier client */}
      {showEditForm && selectedClient && (
        <div className="fixed inset-0 bg-black/50 flex items-end z-50">
          <div className="bg-white rounded-t-2xl w-full p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-[#0F172A]">Modifier — {selectedClient.name}</h2>
              <button onClick={() => { setShowEditForm(false); setEditErrors({}) }} className="text-[#64748B] text-xl">✕</button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#64748B] uppercase tracking-wide mb-1">Nom</label>
                <input
                  value={editForm.name}
                  onChange={(e) => { setEditForm({ ...editForm, name: e.target.value }); setEditErrors({ ...editErrors, name: null }) }}
                  className={`w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#1A56DB] ${editErrors.name ? 'border-[#DC2626]' : 'border-gray-200'}`}
                />
                {editErrors.name && <p className="text-xs text-[#DC2626] mt-1">{editErrors.name}</p>}
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#64748B] uppercase tracking-wide mb-1">Téléphone</label>
                <input
                  value={editForm.phone}
                  onChange={(e) => { setEditForm({ ...editForm, phone: e.target.value }); setEditErrors({ ...editErrors, phone: null }) }}
                  className={`w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#1A56DB] ${editErrors.phone ? 'border-[#DC2626]' : 'border-gray-200'}`}
                />
                {editErrors.phone && <p className="text-xs text-[#DC2626] mt-1">{editErrors.phone}</p>}
              </div>
            </div>
            <button onClick={handleEditClient} className="w-full bg-[#1A56DB] text-white rounded-xl py-3 font-semibold text-sm mt-4">
              Enregistrer les modifications
            </button>
          </div>
        </div>
      )}

      {/* Modal ajouter dette */}
      {showDebtForm && selectedClient && (
        <div className="fixed inset-0 bg-black/50 flex items-end z-50">
          <div className="bg-white rounded-t-2xl w-full p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-[#0F172A]">Dette — {selectedClient.name}</h2>
              <button onClick={() => { setShowDebtForm(false); setDebtErrors({}) }} className="text-[#64748B] text-xl">✕</button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#64748B] uppercase tracking-wide mb-1">Montant ({currency})</label>
                <input
                  type="number"
                  value={debtForm.amount}
                  onChange={(e) => { setDebtForm({ ...debtForm, amount: e.target.value }); setDebtErrors({ ...debtErrors, amount: null }) }}
                  placeholder="Ex: 5000"
                  className={`w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#1A56DB] ${debtErrors.amount ? 'border-[#DC2626]' : 'border-gray-200'}`}
                />
                {debtErrors.amount && <p className="text-xs text-[#DC2626] mt-1">{debtErrors.amount}</p>}
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#64748B] uppercase tracking-wide mb-1">Note (optionnel)</label>
                <input
                  value={debtForm.note}
                  onChange={(e) => setDebtForm({ ...debtForm, note: e.target.value })}
                  placeholder="Ex: Achat sucre et savon"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#1A56DB]"
                />
              </div>
            </div>
            <button onClick={handleAddDebt} className="w-full bg-[#DC2626] text-white rounded-xl py-3 font-semibold text-sm mt-4">
              Enregistrer la dette
            </button>
          </div>
        </div>
      )}

      {/* Modal modifier montant dette */}
      {showEditDebt && selectedClient && (
        <div className="fixed inset-0 bg-black/50 flex items-end z-50">
          <div className="bg-white rounded-t-2xl w-full p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-[#0F172A]">Modifier dette — {selectedClient.name}</h2>
              <button onClick={() => setShowEditDebt(false)} className="text-[#64748B] text-xl">✕</button>
            </div>
            <div className="bg-[#FFFBEB] border border-yellow-200 rounded-xl p-3 mb-4">
              <p className="text-xs text-[#B45309]">⚠️ Dette actuelle : <span className="font-bold">{formatAmount(selectedClient.total_debt)}</span></p>
              <p className="text-xs text-[#64748B] mt-1">Modifie uniquement pour corriger une erreur.</p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#64748B] uppercase tracking-wide mb-1">Nouveau montant ({currency})</label>
              <input
                type="number"
                value={editDebtAmount}
                onChange={(e) => setEditDebtAmount(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#1A56DB]"
              />
            </div>
            <button onClick={handleEditDebt} className="w-full bg-[#F5A623] text-white rounded-xl py-3 font-semibold text-sm mt-4">
              Mettre à jour
            </button>
          </div>
        </div>
      )}

      {/* Modal paiement partiel */}
      {showPayForm && selectedClient && (
        <div className="fixed inset-0 bg-black/50 flex items-end z-50">
          <div className="bg-white rounded-t-2xl w-full p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-[#0F172A]">Paiement — {selectedClient.name}</h2>
              <button onClick={() => { setShowPayForm(false); setPayErrors({}) }} className="text-[#64748B] text-xl">✕</button>
            </div>
            <div className="bg-[#FEF2F2] border border-red-200 rounded-xl p-3 mb-4">
              <p className="text-xs text-[#DC2626]">Dette restante : <span className="font-bold">{formatAmount(selectedClient.total_debt)}</span></p>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#64748B] uppercase tracking-wide mb-1">Montant remboursé ({currency})</label>
                <input
                  type="number"
                  value={payForm.amount}
                  onChange={(e) => { setPayForm({ ...payForm, amount: e.target.value }); setPayErrors({ ...payErrors, amount: null }) }}
                  placeholder={`Max: ${formatAmount(selectedClient.total_debt)}`}
                  className={`w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#1A56DB] ${payErrors.amount ? 'border-[#DC2626]' : 'border-gray-200'}`}
                />
                {payErrors.amount && <p className="text-xs text-[#DC2626] mt-1">{payErrors.amount}</p>}
                {payForm.amount && parseFloat(payForm.amount) > 0 && parseFloat(payForm.amount) <= selectedClient.total_debt && (
                  <p className="text-xs text-[#16A34A] mt-1">
                    Reste après paiement : {formatAmount(selectedClient.total_debt - parseFloat(payForm.amount))}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#64748B] uppercase tracking-wide mb-1">Note (optionnel)</label>
                <input
                  value={payForm.note}
                  onChange={(e) => setPayForm({ ...payForm, note: e.target.value })}
                  placeholder="Ex: Versement espèces"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#1A56DB]"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={handlePartialPay}
                className="flex-1 bg-[#16A34A] text-white rounded-xl py-3 font-semibold text-sm"
              >
                Confirmer le paiement
              </button>
              <button
                onClick={() => {
                  setPayForm({ amount: selectedClient.total_debt.toString(), note: 'Remboursement total' })
                }}
                className="px-3 bg-[#F0FDF4] text-[#16A34A] rounded-xl py-3 text-xs font-semibold border border-green-200"
              >
                Tout
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal historique remboursements */}
      {showHistory && selectedClient && (
        <div className="fixed inset-0 bg-black/50 flex items-end z-50">
          <div className="bg-white rounded-t-2xl w-full p-5 max-h-[70vh] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-bold text-[#0F172A]">{selectedClient.name}</h2>
                <p className="text-xs text-[#64748B]">Historique des remboursements</p>
              </div>
              <button onClick={() => setShowHistory(false)} className="text-[#64748B] text-xl">✕</button>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-3 mb-4 flex justify-between">
              <div>
                <p className="text-xs text-[#64748B]">Dette actuelle</p>
                <p className="text-base font-bold text-[#DC2626]">{formatAmount(selectedClient.total_debt)}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-[#64748B]">Total remboursé</p>
                <p className="text-base font-bold text-[#16A34A]">{formatAmount(selectedClient.total_paid || 0)}</p>
              </div>
            </div>
            <div className="overflow-y-auto flex-1">
              {debtHistory.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-3xl mb-2">📋</p>
                  <p className="text-sm font-semibold text-[#0F172A]">Aucun remboursement</p>
                  <p className="text-xs text-[#64748B] mt-1">Les remboursements apparaîtront ici</p>
                </div>
              ) : (
                debtHistory.map((p) => (
                  <div key={p.id} className="bg-white border border-gray-100 rounded-xl p-3 mb-2 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-[#0F172A]">{p.note || 'Remboursement'}</p>
                      <p className="text-xs text-[#64748B]">{formatDate(p.created_at)}</p>
                    </div>
                    <p className="text-sm font-bold text-[#16A34A]">+{formatAmount(p.amount)}</p>
                  </div>
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