import { useEffect, useState, useContext } from 'react'
import { supabase } from '../lib/supabase'
import { validateProduct, sanitize } from '../lib/validation'
import { canAddProduct, getPlanLimits } from '../lib/planLimits'
import Header from '../components/Header'
import Navbar from '../components/Navbar'
import usePlanCheck from '../hooks/usePlanCheck'
import useCurrency from '../hooks/useCurrency'
import { UserContext } from '../context/UserContext'

export default function Stocks() {
  usePlanCheck()
  const { userPlan, userId: contextUserId } = useContext(UserContext)
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('tous')
  const [showForm, setShowForm] = useState(false)
  const [formErrors, setFormErrors] = useState({})
  const [form, setForm] = useState({
    name: '', price_sell: '', price_buy: '',
    quantity: '', alert_threshold: '5', category: 'alimentation'
  })
  const [editProduct, setEditProduct] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [editErrors, setEditErrors] = useState({})
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null)
  const [restock, setRestock] = useState(null)
  const [restockQty, setRestockQty] = useState('')
  const [restockError, setRestockError] = useState('')

  const { formatAmount, currency } = useCurrency()

  useEffect(() => {
    if (contextUserId) fetchProducts()
  }, [contextUserId])

  const fetchProducts = async () => {
    if (!contextUserId) return

    const { data: productsData } = await supabase
      .from('products')
      .select('*')
      .eq('user_id', contextUserId)
      .order('name')

    if (productsData) setProducts(productsData)
    setLoading(false)
  }

  const handleAdd = async () => {
    if (!canAddProduct(userPlan, products.length)) {
      setFormErrors({
        name: `Limite atteinte — ton plan permet ${getPlanLimits(userPlan).maxProducts} produits max. Passe au Pro pour continuer.`
      })
      return
    }

    const errors = validateProduct(form)
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors)
      return
    }
    setFormErrors({})

    const { error } = await supabase.from('products').insert({
      user_id: contextUserId,
      name: sanitize(form.name),
      price_sell: parseFloat(form.price_sell),
      price_buy: parseFloat(form.price_buy) || 0,
      quantity: parseInt(form.quantity),
      alert_threshold: parseInt(form.alert_threshold) || 5,
      category: sanitize(form.category),
    })

    if (!error) {
      setShowForm(false)
      setForm({ name: '', price_sell: '', price_buy: '', quantity: '', alert_threshold: '5', category: 'alimentation' })
      fetchProducts()
    }
  }

  const handleEdit = async () => {
    const errors = validateProduct(editForm)
    if (Object.keys(errors).length > 0) {
      setEditErrors(errors)
      return
    }
    setEditErrors({})

    const { error } = await supabase
      .from('products')
      .update({
        name: sanitize(editForm.name),
        price_sell: parseFloat(editForm.price_sell),
        price_buy: parseFloat(editForm.price_buy) || 0,
        quantity: parseInt(editForm.quantity),
        alert_threshold: parseInt(editForm.alert_threshold) || 5,
        category: sanitize(editForm.category),
      })
      .eq('id', editProduct.id)

    if (!error) {
      setEditProduct(null)
      fetchProducts()
    }
  }

  const handleDelete = async (product) => {
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', product.id)

    if (!error) {
      setShowDeleteConfirm(null)
      fetchProducts()
    }
  }

  const handleRestock = async () => {
    const qty = parseInt(restockQty)
    if (!qty || qty <= 0) {
      setRestockError('Entre une quantité valide')
      return
    }
    setRestockError('')

    const { error } = await supabase
      .from('products')
      .update({ quantity: restock.quantity + qty })
      .eq('id', restock.id)

    if (!error) {
      setRestock(null)
      setRestockQty('')
      fetchProducts()
    }
  }

  const totalValue = products.reduce((sum, p) => sum + p.price_sell * p.quantity, 0)
  const lowStockCount = products.filter(p => p.quantity <= p.alert_threshold).length

  const filtered = products.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase())
    const matchFilter = filter === 'tous' ? true : p.quantity <= p.alert_threshold
    return matchSearch && matchFilter
  })

  const getStockPercent = (p) => {
    const max = Math.max(p.quantity, p.alert_threshold * 3)
    return Math.min(100, Math.round((p.quantity / max) * 100))
  }

  const getStockColor = (p) => {
    if (p.quantity <= p.alert_threshold) return '#DC2626'
    if (p.quantity <= p.alert_threshold * 2) return '#F5A623'
    return '#16A34A'
  }

  const fields = [
    { key: 'name', label: 'Nom du produit', placeholder: 'Ex: Sucre 1kg' },
    { key: 'price_sell', label: `Prix de vente (${currency})`, placeholder: '1500', type: 'number' },
    { key: 'price_buy', label: `Prix d'achat (${currency})`, placeholder: '1000', type: 'number' },
    { key: 'quantity', label: 'Quantité en stock', placeholder: '10', type: 'number' },
    { key: 'alert_threshold', label: 'Alerte stock bas à', placeholder: '5', type: 'number' },
  ]

  return (
    <div className="min-h-screen bg-[#EEF2F7] pb-24">

      <div className="bg-[#1A56DB] px-4 pt-0 pb-4">
        <Header title="Mes stocks" showAdd onAdd={() => setShowForm(true)} />
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Produits', value: products.length, color: 'white' },
            { label: 'Stock bas', value: lowStockCount, color: lowStockCount > 0 ? '#fca5a5' : 'white' },
            { label: `Valeur ${currency}`, value: new Intl.NumberFormat('fr-FR').format(Math.round(totalValue)), color: 'white' },
          ].map((s, i) => (
            <div key={i} className="bg-white/12 rounded-xl p-2 text-center border border-white/20">
              <p className="font-bold text-base" style={{ color: s.color }}>{s.value}</p>
              <p className="text-blue-200 text-xs mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="px-4 pt-4">

        <div className="bg-white rounded-xl border border-gray-200 px-3 py-3 flex items-center gap-2 mb-3">
          <span className="text-gray-400">🔍</span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Chercher un produit..."
            className="flex-1 text-sm outline-none text-[#0F172A] placeholder-gray-400"
          />
        </div>

        <div className="flex gap-2 mb-4">
          {['tous', 'stock bas'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-full text-xs font-medium border transition-all ${
                filter === f
                  ? 'bg-[#1A56DB] text-white border-[#1A56DB]'
                  : 'bg-white text-[#64748B] border-gray-200'
              }`}
            >
              {f === 'tous' ? 'Tous' : 'Stock bas'}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="text-center text-[#64748B] text-sm py-8">Chargement...</p>
        ) : filtered.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-3xl mb-2">📦</p>
            <p className="text-sm font-semibold text-[#0F172A]">Aucun produit</p>
            <p className="text-xs text-[#64748B] mt-1">Ajoute ton premier produit</p>
          </div>
        ) : (
          filtered.map((p) => (
            <div
              key={p.id}
              className="bg-white rounded-xl border border-gray-200 p-3 mb-2"
              style={{ borderLeft: `3px solid ${getStockColor(p)}` }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: getStockColor(p) + '20' }}
                >
                  <span className="text-lg">📦</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[#0F172A] truncate">{p.name}</p>
                  <p className="text-xs text-[#64748B]">{formatAmount(p.price_sell)}/unité</p>
                  <div className="mt-1 h-1 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${getStockPercent(p)}%`, background: getStockColor(p) }}
                    />
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-lg font-bold" style={{ color: getStockColor(p) }}>{p.quantity}</p>
                  <p className="text-xs text-[#64748B]">unités</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 mt-3">
                <button
                  onClick={() => { setRestock(p); setRestockQty(''); setRestockError('') }}
                  className="bg-[#F0FDF4] text-[#16A34A] rounded-lg py-2 text-xs font-semibold"
                >
                  + Stock
                </button>
                <button
                  onClick={() => {
                    setEditProduct(p)
                    setEditForm({
                      name: p.name,
                      price_sell: p.price_sell.toString(),
                      price_buy: p.price_buy?.toString() || '0',
                      quantity: p.quantity.toString(),
                      alert_threshold: p.alert_threshold?.toString() || '5',
                      category: p.category || 'alimentation',
                    })
                    setEditErrors({})
                  }}
                  className="bg-[#EBF2FF] text-[#1A56DB] rounded-lg py-2 text-xs font-semibold"
                >
                  ✏️ Modifier
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(p)}
                  className="bg-[#FEF2F2] text-[#DC2626] rounded-lg py-2 text-xs font-semibold"
                >
                  🗑️ Suppr.
                </button>
              </div>
            </div>
          ))
        )}

        <button
          onClick={() => setShowForm(true)}
          className={`w-full border border-dashed rounded-xl py-3 text-sm font-medium flex items-center justify-center gap-2 mt-2 ${
            canAddProduct(userPlan, products.length)
              ? 'border-[#1A56DB] text-[#1A56DB]'
              : 'border-gray-300 text-[#64748B]'
          }`}
        >
          {canAddProduct(userPlan, products.length)
            ? '+ Ajouter un produit'
            : `Limite atteinte (${getPlanLimits(userPlan).maxProducts} max) — Passe au Pro`
          }
        </button>
      </div>

      {restock && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-[#0F172A]">Réapprovisionner</h2>
              <button onClick={() => setRestock(null)} className="text-[#64748B] text-xl">✕</button>
            </div>
            <div className="bg-[#EEF2F7] rounded-xl p-3 mb-4">
              <p className="text-xs text-[#64748B]">Produit</p>
              <p className="text-sm font-bold text-[#0F172A]">{restock.name}</p>
              <p className="text-xs text-[#64748B] mt-1">
                Stock actuel : <span className="font-semibold" style={{ color: getStockColor(restock) }}>{restock.quantity} unités</span>
              </p>
            </div>
            <div className="mb-4">
              <label className="block text-xs font-semibold text-[#64748B] uppercase tracking-wide mb-2">
                Quantité à ajouter
              </label>
              <div className="flex items-center gap-2 w-full">
                <button
                  onClick={() => setRestockQty(prev => Math.max(1, (parseInt(prev) || 0) - 1).toString())}
                  className="w-12 h-12 bg-[#EBF2FF] rounded-lg flex items-center justify-center text-[#1A56DB] font-bold text-lg flex-shrink-0"
                >−</button>
                <input
                  type="number"
                  value={restockQty}
                  onChange={(e) => { setRestockQty(e.target.value); setRestockError('') }}
                  placeholder="0"
                  className={`flex-1 min-w-0 border rounded-xl px-3 py-2.5 text-sm text-center font-bold text-[#0F172A] outline-none focus:border-[#1A56DB] ${
                    restockError ? 'border-[#DC2626]' : 'border-gray-200'
                  }`}
                />
                <button
                  onClick={() => setRestockQty(prev => ((parseInt(prev) || 0) + 1).toString())}
                  className="w-12 h-12 bg-[#EBF2FF] rounded-lg flex items-center justify-center text-[#1A56DB] font-bold text-lg flex-shrink-0"
                >+</button>
              </div>
              {restockError && <p className="text-xs text-[#DC2626] mt-1">{restockError}</p>}
              {restockQty && parseInt(restockQty) > 0 && (
                <p className="text-xs text-[#16A34A] mt-2 text-center font-medium">
                  Nouveau stock : {restock.quantity + (parseInt(restockQty) || 0)} unités
                </p>
              )}
            </div>
            <button
              onClick={handleRestock}
              className="w-full bg-[#16A34A] text-white rounded-xl py-3 font-semibold text-sm"
            >
              Confirmer le réapprovisionnement
            </button>
          </div>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-end z-50">
          <div className="bg-white rounded-t-2xl w-full p-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-[#0F172A]">Nouveau produit</h2>
              <button onClick={() => { setShowForm(false); setFormErrors({}) }} className="text-[#64748B] text-xl">✕</button>
            </div>
            <div className="space-y-3">
              {fields.map((f) => (
                <div key={f.key}>
                  <label className="block text-xs font-semibold text-[#64748B] uppercase tracking-wide mb-1">
                    {f.label}
                  </label>
                  <input
                    type={f.type || 'text'}
                    value={form[f.key]}
                    onChange={(e) => {
                      setForm({ ...form, [f.key]: e.target.value })
                      if (formErrors[f.key]) setFormErrors({ ...formErrors, [f.key]: null })
                    }}
                    placeholder={f.placeholder}
                    className={`w-full border rounded-xl px-3 py-2.5 text-sm text-[#0F172A] outline-none focus:border-[#1A56DB] ${
                      formErrors[f.key] ? 'border-[#DC2626]' : 'border-gray-200'
                    }`}
                  />
                  {formErrors[f.key] && (
                    <p className="text-xs text-[#DC2626] mt-1">{formErrors[f.key]}</p>
                  )}
                </div>
              ))}
            </div>
            <button
              onClick={handleAdd}
              className="w-full bg-[#1A56DB] text-white rounded-xl py-3 font-semibold text-sm mt-4"
            >
              Ajouter le produit
            </button>
          </div>
        </div>
      )}

      {editProduct && (
        <div className="fixed inset-0 bg-black/50 flex items-end z-50">
          <div className="bg-white rounded-t-2xl w-full p-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-[#0F172A]">Modifier — {editProduct.name}</h2>
              <button onClick={() => { setEditProduct(null); setEditErrors({}) }} className="text-[#64748B] text-xl">✕</button>
            </div>
            <div className="space-y-3">
              {fields.map((f) => (
                <div key={f.key}>
                  <label className="block text-xs font-semibold text-[#64748B] uppercase tracking-wide mb-1">
                    {f.label}
                  </label>
                  <input
                    type={f.type || 'text'}
                    value={editForm[f.key] || ''}
                    onChange={(e) => {
                      setEditForm({ ...editForm, [f.key]: e.target.value })
                      if (editErrors[f.key]) setEditErrors({ ...editErrors, [f.key]: null })
                    }}
                    placeholder={f.placeholder}
                    className={`w-full border rounded-xl px-3 py-2.5 text-sm text-[#0F172A] outline-none focus:border-[#1A56DB] ${
                      editErrors[f.key] ? 'border-[#DC2626]' : 'border-gray-200'
                    }`}
                  />
                  {editErrors[f.key] && (
                    <p className="text-xs text-[#DC2626] mt-1">{editErrors[f.key]}</p>
                  )}
                </div>
              ))}
            </div>
            <button
              onClick={handleEdit}
              className="w-full bg-[#1A56DB] text-white rounded-xl py-3 font-semibold text-sm mt-4"
            >
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
              <h2 className="text-base font-bold text-[#0F172A]">Supprimer ce produit ?</h2>
              <p className="text-sm text-[#64748B] mt-1">
                <span className="font-semibold text-[#0F172A]">{showDeleteConfirm.name}</span> sera supprimé définitivement.
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

      <Navbar />

    </div>
  )
}