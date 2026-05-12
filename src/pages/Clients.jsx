import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { validateClient, validateDebt, sanitize } from '../lib/validation'
import { canAddClient, getPlanLimits } from '../lib/planLimits'
import Header from '../components/Header'
import Navbar from '../components/Navbar'
import usePlanCheck from '../hooks/usePlanCheck'

export default function Clients() {
  usePlanCheck()
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('tous')
  const [userId, setUserId] = useState(null)
  const [userPlan, setUserPlan] = useState('free')
  const [showForm, setShowForm] = useState(false)
  const [showDebtForm, setShowDebtForm] = useState(false)
  const [selectedClient, setSelectedClient] = useState(null)
  const [form, setForm] = useState({ name: '', phone: '' })
  const [debtForm, setDebtForm] = useState({ amount: '', note: '' })
  const [formErrors, setFormErrors] = useState({})
  const [debtErrors, setDebtErrors] = useState({})

  useEffect(() => { fetchClients() }, [])

  const fetchClients = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setUserId(user.id)

    const { data: userData } = await supabase
      .from('users')
      .select('plan')
      .eq('id', user.id)
      .single()
    if (userData) setUserPlan(userData.plan)

    const { data } = await supabase
      .from('customers')
      .select('*')
      .eq('user_id', user.id)
      .order('name')
    if (data) setClients(data)
    setLoading(false)
  }

  const handleAddClient = async () => {
    if (!canAddClient(userPlan, clients.length)) {
      setFormErrors({
        name: `Limite atteinte — ton plan permet ${getPlanLimits(userPlan).maxClients} clients max. Passe au Pro pour continuer.`
      })
      return
    }

    const errors = validateClient(form)
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors)
      return
    }
    setFormErrors({})

    const { error } = await supabase.from('customers').insert({
      user_id: userId,
      name: sanitize(form.name),
      phone: sanitize(form.phone),
      total_debt: 0,
    })
    if (!error) {
      setShowForm(false)
      setForm({ name: '', phone: '' })
      fetchClients()
    }
  }

  const handleAddDebt = async () => {
    const errors = validateDebt(debtForm)
    if (Object.keys(errors).length > 0) {
      setDebtErrors(errors)
      return
    }
    setDebtErrors({})

    const amount = parseFloat(debtForm.amount)
    const { error } = await supabase.from('debts').insert({
      user_id: userId,
      customer_id: selectedClient.id,
      amount,
      paid: 0,
      status: 'pending',
      note: sanitize(debtForm.note),
    })
    if (!error) {
      await supabase
        .from('customers')
        .update({ total_debt: selectedClient.total_debt + amount })
        .eq('id', selectedClient.id)
      setShowDebtForm(false)
      setDebtForm({ amount: '', note: '' })
      fetchClients()
    }
  }

  const handlePaid = async (client) => {
    await supabase
      .from('customers')
      .update({ total_debt: 0 })
      .eq('id', client.id)
    await supabase
      .from('debts')
      .update({ status: 'paid', paid: client.total_debt })
      .eq('customer_id', client.id)
      .eq('status', 'pending')
    fetchClients()
  }

  const handleWhatsApp = (client) => {
    const msg = encodeURIComponent(
      `Bonjour ${client.name}, nous vous rappelons que vous avez une dette de ${formatFC(client.total_debt)} à notre boutique. Merci de régulariser dès que possible.`
    )
    const phone = client.phone?.replace(/\s/g, '').replace('+', '')
    window.open(`https://wa.me/${phone}?text=${msg}`, '_blank')
  }

  const formatFC = (amount) =>
    new Intl.NumberFormat('fr-FR').format(Math.round(amount)) + ' FC'

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
            <p className="text-white text-2xl font-bold">{formatFC(totalDebt)}</p>
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
                </div>
                <div className="text-right">
                  <p className={`text-base font-bold ${c.total_debt > 0 ? 'text-[#DC2626]' : 'text-[#16A34A]'}`}>
                    {formatFC(c.total_debt)}
                  </p>
                  <p className="text-xs text-[#64748B]">{c.total_debt > 0 ? 'doit' : 'À jour ✓'}</p>
                </div>
              </div>
              {c.total_debt > 0 && (
                <div className="flex gap-2">
                  <button
                    onClick={() => handlePaid(c)}
                    className="flex-1 bg-[#F0FDF4] text-[#16A34A] rounded-lg py-2 text-xs font-semibold flex items-center justify-center gap-1"
                  >
                    ✓ Remboursé
                  </button>
                  <button
                    onClick={() => handleWhatsApp(c)}
                    className="flex-1 bg-[#EBF2FF] text-[#1A56DB] rounded-lg py-2 text-xs font-semibold flex items-center justify-center gap-1"
                  >
                    💬 Rappel WhatsApp
                  </button>
                </div>
              )}
              {c.total_debt === 0 && (
                <button
                  onClick={() => { setSelectedClient(c); setShowDebtForm(true) }}
                  className="w-full bg-[#FEF2F2] text-[#DC2626] rounded-lg py-2 text-xs font-semibold"
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
                <label className="block text-xs font-semibold text-[#64748B] uppercase tracking-wide mb-1">
                  Nom du client
                </label>
                <input
                  value={form.name}
                  onChange={(e) => {
                    setForm({ ...form, name: e.target.value })
                    if (formErrors.name) setFormErrors({ ...formErrors, name: null })
                  }}
                  placeholder="Ex: Mama Mutombo"
                  className={`w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#1A56DB] ${
                    formErrors.name ? 'border-[#DC2626]' : 'border-gray-200'
                  }`}
                />
                {formErrors.name && (
                  <p className="text-xs text-[#DC2626] mt-1">{formErrors.name}</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#64748B] uppercase tracking-wide mb-1">
                  Téléphone
                </label>
                <input
                  value={form.phone}
                  onChange={(e) => {
                    setForm({ ...form, phone: e.target.value })
                    if (formErrors.phone) setFormErrors({ ...formErrors, phone: null })
                  }}
                  placeholder="+243 8X XXX XXXX"
                  className={`w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#1A56DB] ${
                    formErrors.phone ? 'border-[#DC2626]' : 'border-gray-200'
                  }`}
                />
                {formErrors.phone && (
                  <p className="text-xs text-[#DC2626] mt-1">{formErrors.phone}</p>
                )}
              </div>
            </div>
            <button
              onClick={handleAddClient}
              className="w-full bg-[#1A56DB] text-white rounded-xl py-3 font-semibold text-sm mt-4"
            >
              Ajouter le client
            </button>
          </div>
        </div>
      )}

      {/* Modal ajout dette */}
      {showDebtForm && selectedClient && (
        <div className="fixed inset-0 bg-black/50 flex items-end z-50">
          <div className="bg-white rounded-t-2xl w-full p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-[#0F172A]">Dette — {selectedClient.name}</h2>
              <button onClick={() => { setShowDebtForm(false); setDebtErrors({}) }} className="text-[#64748B] text-xl">✕</button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#64748B] uppercase tracking-wide mb-1">
                  Montant (FC)
                </label>
                <input
                  type="number"
                  value={debtForm.amount}
                  onChange={(e) => {
                    setDebtForm({ ...debtForm, amount: e.target.value })
                    if (debtErrors.amount) setDebtErrors({ ...debtErrors, amount: null })
                  }}
                  placeholder="Ex: 5000"
                  className={`w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#1A56DB] ${
                    debtErrors.amount ? 'border-[#DC2626]' : 'border-gray-200'
                  }`}
                />
                {debtErrors.amount && (
                  <p className="text-xs text-[#DC2626] mt-1">{debtErrors.amount}</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#64748B] uppercase tracking-wide mb-1">
                  Note (optionnel)
                </label>
                <input
                  value={debtForm.note}
                  onChange={(e) => setDebtForm({ ...debtForm, note: e.target.value })}
                  placeholder="Ex: Achat sucre et savon"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#1A56DB]"
                />
              </div>
            </div>
            <button
              onClick={handleAddDebt}
              className="w-full bg-[#DC2626] text-white rounded-xl py-3 font-semibold text-sm mt-4"
            >
              Enregistrer la dette
            </button>
          </div>
        </div>
      )}

      <Navbar />

    </div>
  )
}