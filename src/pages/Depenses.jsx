import { useEffect, useState, useContext } from 'react'
import { supabase } from '../lib/supabase'
import { validateExpense, sanitize } from '../lib/validation'
import Header from '../components/Header'
import Navbar from '../components/Navbar'
import usePlanCheck from '../hooks/usePlanCheck'
import useCurrency from '../hooks/useCurrency'
import { UserContext } from '../context/UserContext'

export default function Depenses() {
  usePlanCheck()
  const { userId } = useContext(UserContext)
  const [expenses, setExpenses] = useState([])
  const [sales, setSales] = useState([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('today')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ category: 'marchandises', amount: '', note: '' })
  const [formErrors, setFormErrors] = useState({})
  const [editExpense, setEditExpense] = useState(null)
  const [editForm, setEditForm] = useState({ category: 'marchandises', amount: '', note: '' })
  const [editErrors, setEditErrors] = useState({})
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null)
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [showCustom, setShowCustom] = useState(false)

  const { formatAmount, currency } = useCurrency()

  const categories = [
    { id: 'marchandises', label: 'Achat marchandises', icon: '🛍️' },
    { id: 'transport', label: 'Transport', icon: '🚗' },
    { id: 'loyer', label: 'Loyer', icon: '🏠' },
    { id: 'salaire', label: 'Salaire', icon: '👤' },
    { id: 'electricite', label: 'Électricité', icon: '💡' },
    { id: 'livraison', label: 'Livraison', icon: '🚚' },
    { id: 'publicite', label: 'Publicité', icon: '📣' },
    { id: 'internet', label: 'Internet/Téléphone', icon: '📱' },
    { id: 'emballage', label: 'Emballage', icon: '📦' },
    { id: 'autre', label: 'Autre', icon: '📌' },
  ]

  useEffect(() => {
    if (userId) fetchData()
  }, [period, userId])

  const getDateRange = () => {
    const now = new Date()
    const start = new Date()
    if (period === 'today') start.setHours(0, 0, 0, 0)
    else if (period === 'week') start.setDate(now.getDate() - 7)
    else if (period === 'month') { start.setDate(1); start.setHours(0, 0, 0, 0) }
    else if (period === 'custom') {
      return {
        start: customStart ? new Date(customStart).toISOString() : new Date().toISOString(),
        end: customEnd ? new Date(customEnd + 'T23:59:59').toISOString() : new Date(customStart + 'T23:59:59').toISOString(),
      }
    }
    return { start: start.toISOString(), end: new Date().toISOString() }
  }

  const fetchData = async () => {
    if (!userId) return

    const { start, end } = getDateRange()

    const [
      { data: expData },
      { data: salesData },
    ] = await Promise.all([
      supabase.from('expenses').select('*').eq('user_id', userId).gte('created_at', start).lte('created_at', end).order('created_at', { ascending: false }),
      supabase.from('sales').select('total, cost, encaissee').eq('user_id', userId).gte('created_at', start).lte('created_at', end),
    ])

    if (expData) setExpenses(expData)
    if (salesData) setSales(salesData)
    setLoading(false)
  }

  const handleAdd = async () => {
    const errors = validateExpense(form)
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors)
      return
    }
    setFormErrors({})

    const tempExpense = {
      id: `temp-${Date.now()}`,
      user_id: userId,
      category: form.category,
      amount: parseFloat(form.amount),
      note: sanitize(form.note),
      created_at: new Date().toISOString(),
    }

    setExpenses(prev => [tempExpense, ...prev])
    setShowForm(false)
    setForm({ category: 'marchandises', amount: '', note: '' })

    const { error } = await supabase.from('expenses').insert({
      user_id: userId,
      category: tempExpense.category,
      amount: tempExpense.amount,
      note: tempExpense.note,
    })

    if (error) {
      setExpenses(prev => prev.filter(e => e.id !== tempExpense.id))
      setShowForm(true)
    } else {
      fetchData()
    }
  }

  const handleEdit = async () => {
    const errors = validateExpense(editForm)
    if (Object.keys(errors).length > 0) {
      setEditErrors(errors)
      return
    }
    setEditErrors({})

    const oldExpense = editExpense
    const updated = {
      ...editExpense,
      category: editForm.category,
      amount: parseFloat(editForm.amount),
      note: sanitize(editForm.note),
    }

    setExpenses(prev => prev.map(e => e.id === editExpense.id ? updated : e))
    setEditExpense(null)

    const { error } = await supabase
      .from('expenses')
      .update({
        category: updated.category,
        amount: updated.amount,
        note: updated.note,
      })
      .eq('id', editExpense.id)

    if (error) {
      setExpenses(prev => prev.map(e => e.id === oldExpense.id ? oldExpense : e))
    }
  }

  const handleDelete = async (expense) => {
    setExpenses(prev => prev.filter(e => e.id !== expense.id))
    setShowDeleteConfirm(null)

    const { error } = await supabase
      .from('expenses')
      .delete()
      .eq('id', expense.id)

    if (error) {
      setExpenses(prev => [expense, ...prev])
    }
  }

  const encaissees = sales.filter(s => s.encaissee !== false)
  const totalIncome = encaissees.reduce((sum, s) => sum + s.total, 0)
  const totalCost = encaissees.reduce((sum, s) => sum + (s.cost || 0), 0)
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0)
  const netProfit = totalIncome - totalCost - totalExpenses

  const getCategoryIcon = (cat) => categories.find(c => c.id === cat)?.icon || '📌'
  const getCategoryLabel = (cat) => categories.find(c => c.id === cat)?.label || cat

  const formatDate = (dateStr) =>
    new Date(dateStr).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })

  const CategoryGrid = ({ value, onChange }) => (
    <div className="grid grid-cols-3 gap-2">
      {categories.map((cat) => (
        <button
          key={cat.id}
          onClick={() => onChange(cat.id)}
          className={`p-2 rounded-xl border text-xs font-medium flex flex-col items-center gap-1 transition-all ${
            value === cat.id
              ? 'border-[#1A56DB] bg-[#EBF2FF] text-[#1A56DB]'
              : 'border-gray-200 bg-white text-[#64748B]'
          }`}
        >
          <span className="text-lg">{cat.icon}</span>
          <span className="text-center leading-tight">{cat.label.split(' ')[0]}</span>
        </button>
      ))}
    </div>
  )

  return (
    <div className="min-h-screen bg-[#EEF2F7] pb-24">

      <div className="bg-[#1A56DB] px-4 pt-0 pb-4">
        <Header title="Dépenses & Trésorerie" showAdd onAdd={() => setShowForm(true)} />
        <div className="bg-white/12 rounded-xl p-3 border border-white/20">
          <p className="text-blue-200 text-xs uppercase tracking-wide mb-1">Bénéfice net</p>
          <p className={`text-3xl font-bold ${netProfit >= 0 ? 'text-green-300' : 'text-red-300'}`}>
            {netProfit >= 0 ? '+' : ''}{formatAmount(netProfit)}
          </p>
          <p className="text-blue-200 text-xs mt-1">
            {netProfit >= 0 ? "✅ Tu gagnes de l'argent" : "⚠️ Tu perds de l'argent"}
          </p>
          <div className="grid grid-cols-3 gap-2 mt-3">
            <div className="bg-white/10 rounded-lg p-2">
              <p className="text-blue-200 text-xs mb-1">Ventes</p>
              <p className="text-green-300 font-bold text-sm">{formatAmount(totalIncome)}</p>
            </div>
            <div className="bg-white/10 rounded-lg p-2">
              <p className="text-blue-200 text-xs mb-1">Coût achat</p>
              <p className="text-yellow-300 font-bold text-sm">{formatAmount(totalCost)}</p>
            </div>
            <div className="bg-white/10 rounded-lg p-2">
              <p className="text-blue-200 text-xs mb-1">Dépenses</p>
              <p className="text-red-300 font-bold text-sm">{formatAmount(totalExpenses)}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 pt-4">

        <div className="flex gap-2 mb-4">
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
                if (p.id === 'custom') setShowCustom(true)
                else setShowCustom(false)
              }}
              className={`flex-1 py-2 rounded-xl text-xs font-medium border transition-all ${
                period === p.id
                  ? 'bg-[#1A56DB] text-white border-[#1A56DB]'
                  : 'bg-white text-[#64748B] border-gray-200'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <p className="text-xs font-semibold text-[#64748B] uppercase tracking-wide mb-3">
          Dépenses
        </p>

        {loading ? (
          <p className="text-center text-[#64748B] text-sm py-8">Chargement...</p>
        ) : expenses.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-3xl mb-2">💰</p>
            <p className="text-sm font-semibold text-[#0F172A]">Aucune dépense</p>
            <p className="text-xs text-[#64748B] mt-1">Enregistre ta première dépense</p>
          </div>
        ) : (
          expenses.map((e) => (
            <div key={e.id} className="bg-white rounded-xl border border-gray-200 p-3 mb-2"
              style={{ borderLeft: '3px solid #DC2626' }}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-red-50 rounded-xl flex items-center justify-center flex-shrink-0">
                  <span className="text-lg">{getCategoryIcon(e.category)}</span>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-[#0F172A]">{getCategoryLabel(e.category)}</p>
                  <p className="text-xs text-[#64748B]">
                    {e.note || 'Aucune note'} · {formatDate(e.created_at)}
                  </p>
                </div>
                <span className="text-sm font-bold text-[#DC2626]">- {formatAmount(e.amount)}</span>
              </div>

              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => {
                    setEditExpense(e)
                    setEditForm({
                      category: e.category,
                      amount: e.amount.toString(),
                      note: e.note || '',
                    })
                    setEditErrors({})
                  }}
                  className="flex-1 bg-[#EBF2FF] text-[#1A56DB] rounded-lg py-2 text-xs font-semibold"
                >
                  ✏️ Modifier
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(e)}
                  className="flex-1 bg-[#FEF2F2] text-[#DC2626] rounded-lg py-2 text-xs font-semibold"
                >
                  🗑️ Supprimer
                </button>
              </div>
            </div>
          ))
        )}

        <button
          onClick={() => setShowForm(true)}
          className="w-full bg-[#1A56DB] text-white rounded-xl py-3 text-sm font-semibold flex items-center justify-center gap-2 mt-2"
        >
          + Ajouter une dépense
        </button>

      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-end z-50">
          <div className="bg-white rounded-t-2xl w-full p-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-[#0F172A]">Nouvelle dépense</h2>
              <button onClick={() => { setShowForm(false); setFormErrors({}) }} className="text-[#64748B] text-xl">✕</button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#64748B] uppercase tracking-wide mb-2">Catégorie</label>
                <CategoryGrid value={form.category} onChange={(id) => setForm({ ...form, category: id })} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#64748B] uppercase tracking-wide mb-1">
                  Montant ({currency})
                </label>
                <input
                  type="number"
                  value={form.amount}
                  onChange={(e) => {
                    setForm({ ...form, amount: e.target.value })
                    if (formErrors.amount) setFormErrors({ ...formErrors, amount: null })
                  }}
                  placeholder="Ex: 5000"
                  className={`w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#1A56DB] ${
                    formErrors.amount ? 'border-[#DC2626]' : 'border-gray-200'
                  }`}
                />
                {formErrors.amount && <p className="text-xs text-[#DC2626] mt-1">{formErrors.amount}</p>}
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#64748B] uppercase tracking-wide mb-1">Note (optionnel)</label>
                <input
                  value={form.note}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                  placeholder="Ex: Achat chez le grossiste"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#1A56DB]"
                />
              </div>
            </div>
            <button onClick={handleAdd} className="w-full bg-[#1A56DB] text-white rounded-xl py-3 font-semibold text-sm mt-4">
              Enregistrer la dépense
            </button>
          </div>
        </div>
      )}

      {editExpense && (
        <div className="fixed inset-0 bg-black/50 flex items-end z-50">
          <div className="bg-white rounded-t-2xl w-full p-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-[#0F172A]">Modifier la dépense</h2>
              <button onClick={() => { setEditExpense(null); setEditErrors({}) }} className="text-[#64748B] text-xl">✕</button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#64748B] uppercase tracking-wide mb-2">Catégorie</label>
                <CategoryGrid value={editForm.category} onChange={(id) => setEditForm({ ...editForm, category: id })} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#64748B] uppercase tracking-wide mb-1">
                  Montant ({currency})
                </label>
                <input
                  type="number"
                  value={editForm.amount}
                  onChange={(e) => {
                    setEditForm({ ...editForm, amount: e.target.value })
                    if (editErrors.amount) setEditErrors({ ...editErrors, amount: null })
                  }}
                  placeholder="Ex: 5000"
                  className={`w-full border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#1A56DB] ${
                    editErrors.amount ? 'border-[#DC2626]' : 'border-gray-200'
                  }`}
                />
                {editErrors.amount && <p className="text-xs text-[#DC2626] mt-1">{editErrors.amount}</p>}
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#64748B] uppercase tracking-wide mb-1">Note (optionnel)</label>
                <input
                  value={editForm.note}
                  onChange={(e) => setEditForm({ ...editForm, note: e.target.value })}
                  placeholder="Ex: Achat chez le grossiste"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#1A56DB]"
                />
              </div>
            </div>
            <button onClick={handleEdit} className="w-full bg-[#1A56DB] text-white rounded-xl py-3 font-semibold text-sm mt-4">
              Enregistrer les modifications
            </button>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-5">
            <div className="text-center mb-4">
              <p className="text-3xl mb-3">🗑️</p>
              <h2 className="text-base font-bold text-[#0F172A]">Supprimer cette dépense ?</h2>
              <p className="text-sm text-[#64748B] mt-1">
                <span className="font-semibold text-[#0F172A]">{getCategoryLabel(showDeleteConfirm.category)}</span> — {formatAmount(showDeleteConfirm.amount)} sera supprimée définitivement.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="flex-1 bg-white border border-gray-200 text-[#64748B] rounded-xl py-3 font-medium text-sm"
              >
                Annuler
              </button>
              <button
                onClick={() => handleDelete(showDeleteConfirm)}
                className="flex-1 bg-[#DC2626] text-white rounded-xl py-3 font-semibold text-sm"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}

      {showCustom && (
          <div className="fixed inset-0 bg-black/50 flex items-end z-50">
            <div className="bg-white rounded-t-2xl w-full px-5 pt-5 pb-10">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-base font-bold text-[#0F172A]">📅 Choisir une période</h2>
                <button
                  onClick={() => { setShowCustom(false); setPeriod('today') }}
                  className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-[#64748B]"
                >✕</button>
              </div>
              <div className="mb-4">
                <label className="block text-xs font-semibold text-[#64748B] uppercase tracking-wide mb-2">Du</label>
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  style={{ WebkitAppearance: 'none' }}
                  className="w-full border border-gray-200 rounded-xl px-4 py-4 text-sm outline-none focus:border-[#1A56DB] bg-white text-[#0F172A]"
                />
              </div>
              <div className="mb-6">
                <label className="block text-xs font-semibold text-[#64748B] uppercase tracking-wide mb-2">Au (optionnel)</label>
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  style={{ WebkitAppearance: 'none' }}
                  className="w-full border border-gray-200 rounded-xl px-4 py-4 text-sm outline-none focus:border-[#1A56DB] bg-white text-[#0F172A]"
                />
              </div>
              <button
                onClick={() => {
                  if (!customStart) return
                  if (!customEnd) setCustomEnd(customStart)
                  setShowCustom(false)
                  fetchData()
                }}
                disabled={!customStart}
                className="w-full bg-[#1A56DB] text-white rounded-xl py-4 text-sm font-bold disabled:opacity-50"
              >
                Voir les dépenses
              </button>
            </div>
          </div>
        )}

      <Navbar />

    </div>
  )
}