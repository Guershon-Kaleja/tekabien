import { useEffect, useState, useContext } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { sanitize } from '../lib/validation'
import Header from '../components/Header'
import Navbar from '../components/Navbar'
import { UserContext } from '../context/UserContext'
import { hapticLight, hapticSuccess, hapticError } from '../lib/haptics'

export default function Profil() {
  const navigate = useNavigate()
  const { userId, shopName, userPlan: ctxPlan, currency: ctxCurrency, setCurrency: setContextCurrency } = useContext(UserContext)
  const [saving, setSaving] = useState(false)
  const [user, setUser] = useState(null)
  // Pré-rempli depuis le cache UserContext — affichage immédiat
  const [form, setForm] = useState({
    shop_name: shopName || '',
    phone: '',
    currency: ctxCurrency || 'FC',
  })
  const [passwordForm, setPasswordForm] = useState({ new: '', confirm: '' })
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState('')
  const [activeTab, setActiveTab] = useState('profil')
  const [userPlan, setUserPlan] = useState(ctxPlan || null)
  const [planExpires, setPlanExpires] = useState(null)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [payments, setPayments] = useState([])
  const [paymentsLoaded, setPaymentsLoaded] = useState(false)
  const [showDeleteAccount, setShowDeleteAccount] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deletingAccount, setDeletingAccount] = useState(false)

  const DISPLAY_PRICES = {
    USD: { 1: 5, 3: 13.50, 6: 25.50, 12: 48 },
    CDF: { 1: 12000, 3: 32400, 6: 61200, 12: 115200 },
  }

  // Récupère seulement phone + email + plan_expires (les champs non cachés)
  useEffect(() => {
    if (!userId) return
    supabase.from('users')
      .select('phone, plan, plan_expires, currency, email')
      .eq('id', userId).single()
      .then(({ data }) => {
        if (!data) return
        setUser({ email: data.email })
        setForm(prev => ({
          ...prev,
          phone: data.phone || '',
          currency: data.currency || prev.currency,
        }))
        setUserPlan(data.plan)
        setPlanExpires(data.plan_expires)
      })
  }, [userId])

  // Paiements chargés uniquement quand l'onglet est ouvert
  useEffect(() => {
    if (activeTab !== 'paiements' || paymentsLoaded || !userId) return
    supabase.from('payments').select('*')
      .eq('user_id', userId).eq('status', 'completed')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (data) setPayments(data)
        setPaymentsLoaded(true)
      })
  }, [activeTab, paymentsLoaded, userId])

  const handleSaveProfile = async () => {
    if (!form.shop_name || form.shop_name.trim().length < 2) {
      setError('Le nom de ta boutique doit avoir au moins 2 caractères')
      return
    }
    if (form.phone) {
      const cleanPhone = form.phone.replace(/\s/g, '').replace('+243', '0').replace('+', '')
      if (!/^\d+$/.test(cleanPhone) || cleanPhone.length !== 10 || !/^0[7-9]/.test(cleanPhone)) {
        setError('Numéro invalide — doit commencer par 07x, 08x ou 09x et avoir 10 chiffres')
        return
      }
    }
    setError('')
    setSaving(true)

    const { error } = await supabase
      .from('users')
      .update({
        shop_name: sanitize(form.shop_name),
        phone: sanitize(form.phone),
        currency: form.currency,
      })
      .eq('id', userId)

    if (!error) {
      hapticSuccess()
      setSuccess('Profil mis à jour avec succès ✅')
      setContextCurrency(form.currency)
      setTimeout(() => setSuccess(''), 3000)
    } else {
      hapticError()
    }
    setSaving(false)
  }

  const handleChangePassword = async () => {
    if (!passwordForm.new || passwordForm.new.length < 6) {
      setPasswordError('Le mot de passe doit avoir au moins 6 caractères')
      return
    }
    if (passwordForm.new !== passwordForm.confirm) {
      setPasswordError('Les mots de passe ne correspondent pas')
      return
    }
    setPasswordError('')
    setSaving(true)

    const { error } = await supabase.auth.updateUser({ password: passwordForm.new })

    if (error) {
      setPasswordError('Erreur — réessaie')
    } else {
      setPasswordSuccess('Mot de passe mis à jour ✅')
      setPasswordForm({ new: '', confirm: '' })
      setTimeout(() => setPasswordSuccess(''), 3000)
    }
    setSaving(false)
  }

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'SUPPRIMER') return
    setDeletingAccount(true)

    try {
      await supabase.from('sales').delete().eq('user_id', userId)
      await supabase.from('products').delete().eq('user_id', userId)
      await supabase.from('debt_payments').delete().eq('user_id', userId)
      await supabase.from('debts').delete().eq('user_id', userId)
      await supabase.from('customers').delete().eq('user_id', userId)
      await supabase.from('expenses').delete().eq('user_id', userId)
      await supabase.from('payments').update({ user_id: null }).eq('user_id', userId)
      await supabase.from('users').delete().eq('id', userId)
      await supabase.auth.signOut() // ← ajoute cette ligne
      navigate('/login')
    } catch {
      setDeletingAccount(false)
      setShowDeleteAccount(false)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/login')
  }

  const getPlanLabel = (plan) => ({ trial: 'Essai gratuit', pro: 'Pro', free: 'Gratuit' })[plan] || plan
  const getPlanColor = (plan) => ({ trial: '#B45309', pro: '#16A34A', free: '#64748B' })[plan] || '#64748B'
  const getPlanBg = (plan) => ({ trial: '#FFFBEB', pro: '#F0FDF4', free: '#F8FAFC' })[plan] || '#F8FAFC'

  return (
    <div className="min-h-screen bg-[#EEF2F7] pb-32">

      <Header title="Mon profil" />

      <div className="flex bg-white border-b border-gray-200">
        {[
          { id: 'profil', label: '👤 Profil' },
          { id: 'securite', label: '🔒 Sécurité' },
          { id: 'abonnement', label: '💳 Abonnement' },
          { id: 'paiements', label: '📋 Paiements' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => { hapticLight(); setActiveTab(t.id) }}
            className={`flex-1 py-2 px-0 text-[9px] font-semibold transition-colors text-center ${
              activeTab === t.id
                ? 'text-[#1A56DB] border-b-2 border-[#1A56DB]'
                : 'text-[#64748B]'
            }`}
          >
            <span className="block text-base">{t.id === 'profil' ? '👤' : t.id === 'securite' ? '🔒' : t.id === 'abonnement' ? '💳' : '📋'}</span>
            <span className="block">{t.id === 'profil' ? 'Profil' : t.id === 'securite' ? 'Sécurité' : t.id === 'abonnement' ? 'Abo.' : 'Paiements'}</span>
          </button>
        ))}
      </div>

      <div className="px-4 pt-4">

        {activeTab === 'profil' && (
          <>
            <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-4 text-center">
              <img src="/icon-192.png" alt="TekaBien" className="w-16 h-16 rounded-2xl mx-auto mb-3" />
              <p className="text-base font-bold text-[#0F172A]">{form.shop_name}</p>
              <p className="text-xs text-[#64748B] mt-1">{user?.email}</p>
              <span className="inline-block text-xs font-semibold px-3 py-1 rounded-full mt-2"
                style={{ background: getPlanBg(userPlan), color: getPlanColor(userPlan) }}>
                Plan {getPlanLabel(userPlan)}
              </span>
            </div>

            {success && (
              <div className="bg-[#F0FDF4] border border-green-200 rounded-xl p-3 mb-4">
                <p className="text-xs text-[#16A34A] font-medium">{success}</p>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4">
                <p className="text-xs text-[#DC2626]">{error}</p>
              </div>
            )}

            <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
              <p className="text-xs font-semibold text-[#64748B] uppercase tracking-wide mb-4">
                Informations de ton activité
              </p>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#64748B] uppercase tracking-wide mb-2">
                    Nom de ton activité
                  </label>
                  <input
                    value={form.shop_name}
                    onChange={(e) => { setForm({ ...form, shop_name: e.target.value }); setError('') }}
                    placeholder="Ex: Ventes en ligne, Salon Merveille..."
                    className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm text-[#0F172A] outline-none focus:border-[#1A56DB]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#64748B] uppercase tracking-wide mb-2">
                    Numéro de téléphone
                  </label>
                  <input
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="+243 8X XXX XXXX"
                    className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm text-[#0F172A] outline-none focus:border-[#1A56DB]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#64748B] uppercase tracking-wide mb-2">Email</label>
                  <input
                    value={user?.email || ''}
                    disabled
                    className="w-full border border-gray-100 bg-gray-50 rounded-xl px-3 py-3 text-sm text-[#64748B] outline-none cursor-not-allowed"
                  />
                  <p className="text-xs text-[#64748B] mt-1">L'email ne peut pas être modifié</p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#64748B] uppercase tracking-wide mb-2">
                    Devise de la boutique
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { id: 'FC', label: 'Franc Congolais', symbol: 'FC', desc: 'Ex: 5 000 FC' },
                      { id: 'USD', label: 'Dollar américain', symbol: '$', desc: 'Ex: $2.50' },
                    ].map((c) => (
                      <button
                        key={c.id}
                        onClick={() => setForm({ ...form, currency: c.id })}
                        className={`p-3 rounded-xl border-2 text-left transition-all ${
                          form.currency === c.id ? 'border-[#1A56DB] bg-[#EBF2FF]' : 'border-gray-200 bg-white'
                        }`}
                      >
                        <p className="text-lg font-bold text-[#1A56DB]">{c.symbol}</p>
                        <p className="text-xs font-semibold text-[#0F172A]">{c.id}</p>
                        <p className="text-xs text-[#64748B] mt-1">{c.desc}</p>
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-[#64748B] mt-2">
                    ⚠️ Changer la devise n'affecte pas les montants existants — uniquement l'affichage.
                  </p>
                </div>
              </div>
              <button
                onClick={handleSaveProfile}
                disabled={saving}
                className="w-full bg-[#1A56DB] text-white rounded-xl py-3 font-semibold text-sm mt-4 disabled:opacity-50"
              >
                {saving ? 'Sauvegarde...' : 'Sauvegarder les modifications'}
              </button>
            </div>

            <button
              onClick={() => setShowLogoutConfirm(true)}
              className="w-full bg-white border border-red-200 text-[#DC2626] rounded-xl py-3 font-semibold text-sm"
            >
              Se déconnecter
            </button>

            <button
              onClick={() => setShowDeleteAccount(true)}
              className="w-full bg-white border border-red-200 text-[#DC2626] rounded-xl py-3 font-semibold text-sm mt-3"
            >
              🗑️ Supprimer mon compte
            </button>
          </>
        )}

        {activeTab === 'securite' && (
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs font-semibold text-[#64748B] uppercase tracking-wide mb-4">
              Changer le mot de passe
            </p>
            {passwordSuccess && (
              <div className="bg-[#F0FDF4] border border-green-200 rounded-xl p-3 mb-4">
                <p className="text-xs text-[#16A34A] font-medium">{passwordSuccess}</p>
              </div>
            )}
            {passwordError && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4">
                <p className="text-xs text-[#DC2626]">{passwordError}</p>
              </div>
            )}
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#64748B] uppercase tracking-wide mb-2">
                  Nouveau mot de passe
                </label>
                <input
                  type="password"
                  value={passwordForm.new}
                  onChange={(e) => { setPasswordForm({ ...passwordForm, new: e.target.value }); setPasswordError('') }}
                  placeholder="Minimum 6 caractères"
                  className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm outline-none focus:border-[#1A56DB]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#64748B] uppercase tracking-wide mb-2">
                  Confirmer le mot de passe
                </label>
                <input
                  type="password"
                  value={passwordForm.confirm}
                  onChange={(e) => { setPasswordForm({ ...passwordForm, confirm: e.target.value }); setPasswordError('') }}
                  placeholder="Répète ton nouveau mot de passe"
                  className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm outline-none focus:border-[#1A56DB]"
                />
              </div>
            </div>
            <button
              onClick={handleChangePassword}
              disabled={saving}
              className="w-full bg-[#1A56DB] text-white rounded-xl py-3 font-semibold text-sm mt-4 disabled:opacity-50"
            >
              {saving ? 'Mise à jour...' : 'Changer le mot de passe'}
            </button>
          </div>
        )}

        {activeTab === 'abonnement' && (
          <>
            <div className="rounded-xl p-4 mb-4 border"
              style={{ background: getPlanBg(userPlan), borderColor: getPlanColor(userPlan) + '40' }}>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-bold text-[#0F172A]">Plan actuel</p>
                <span className="text-xs font-bold px-3 py-1.5 rounded-lg text-white"
                  style={{ background: getPlanColor(userPlan) }}>
                  {getPlanLabel(userPlan).toUpperCase()}
                </span>
              </div>
              {planExpires && (
                <p className="text-xs text-[#64748B]">
                  {userPlan === 'trial' ? 'Essai expire le' : 'Renouvellement le'}{' '}
                  {new Date(planExpires).toLocaleDateString('fr-FR')}
                </p>
              )}
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
              <div className="flex items-center mb-3">
                <p className="text-xs font-semibold text-[#64748B] uppercase tracking-wide flex-1">Fonctionnalités</p>
                <div className="flex gap-3">
                  <p className="text-xs font-bold text-[#64748B] w-16 text-center">Gratuit</p>
                  <p className="text-xs font-bold text-[#16A34A] w-16 text-center">Pro</p>
                </div>
              </div>
              {[
                { feature: 'Ventes par jour', free: '5/jour', pro: 'Illimitées' },
                { feature: 'Produits', free: '5 max', pro: 'Illimités' },
                { feature: 'Clients', free: '3 max', pro: 'Illimités' },
                { feature: 'Rapports complets', free: false, pro: true },
                { feature: 'Export PDF', free: false, pro: true },
              ].map((f, i) => (
                <div key={i} className={`flex items-center py-2 ${i < 4 ? 'border-b border-gray-100' : ''}`}>
                  <p className="text-xs text-[#0F172A] flex-1">{f.feature}</p>
                  <div className="flex gap-3">
                    <span className={`text-xs w-16 text-center font-medium ${
                      f.free === true ? 'text-[#16A34A]' : f.free === false ? 'text-gray-300' : 'text-[#64748B]'
                    }`}>
                      {f.free === true ? '✓' : f.free === false ? '✗' : f.free}
                    </span>
                    <span className={`text-xs w-16 text-center font-medium ${
                      f.pro === true ? 'text-[#16A34A]' : f.pro === false ? 'text-gray-300' : 'text-[#16A34A]'
                    }`}>
                      {f.pro === true ? '✓' : f.pro === false ? '✗' : f.pro}
                    </span>
                  </div>
                </div>
              ))}
              <div className="flex items-center mt-3 pt-2 border-t border-gray-100">
                <p className="text-xs font-semibold text-[#0F172A] flex-1">Prix/mois</p>
                <div className="flex gap-3">
                  <span className="text-xs font-bold text-[#64748B] w-16 text-center">0$</span>
                  <span className="text-xs font-bold text-[#16A34A] w-16 text-center">5$</span>
                </div>
              </div>
            </div>

            {(userPlan === 'trial' || userPlan === 'free') && (
              <button onClick={() => navigate('/expired')}
                className="w-full bg-[#1A56DB] text-white rounded-xl py-3 font-semibold text-sm mb-3">
                Passer au Pro — 5$/mois
              </button>
            )}

            {userPlan === 'pro' && (
              <button onClick={() => navigate('/expired')}
                className="w-full bg-white border border-[#1A56DB] text-[#1A56DB] rounded-xl py-3 font-semibold text-sm mb-3">
                Renouveler mon abonnement
              </button>
            )}

            {(userPlan === 'trial' || userPlan === 'free') && (
              <div className="bg-[#F0FDF4] border border-green-200 rounded-xl p-4">
                <p className="text-xs font-semibold text-[#16A34A] mb-2">✨ Pourquoi passer au Pro ?</p>
                <div className="space-y-1.5">
                  {[
                    'Ventes illimitées — sans restriction',
                    'Produits et clients illimités',
                    'Rapports détaillés avec graphiques',
                    'Export PDF pour la comptabilité',
                  ].map((a, i) => (
                    <p key={i} className="text-xs text-[#64748B] flex items-center gap-2">
                      <span className="text-[#16A34A]">✓</span> {a}
                    </p>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {activeTab === 'paiements' && (
          <div>
            <p className="text-xs font-semibold text-[#64748B] uppercase tracking-wide mb-4">
              Historique des paiements
            </p>
            {payments.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-3xl mb-2">💳</p>
                <p className="text-sm font-semibold text-[#0F172A]">Aucun paiement</p>
                <p className="text-xs text-[#64748B] mt-1">Tes paiements apparaîtront ici</p>
              </div>
            ) : (
              payments.map((p) => (
                <div key={p.id} className="bg-white rounded-xl border border-gray-200 p-4 mb-3">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-sm font-bold text-[#0F172A]">Plan Pro — {p.duration} mois</p>
                      <p className="text-xs text-[#64748B]">{new Date(p.created_at).toLocaleDateString('fr-FR')}</p>
                    </div>
                    <span className="text-xs font-bold px-2 py-1 rounded-full bg-[#F0FDF4] text-[#16A34A]">
                      ✅ Payé
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold text-[#1A56DB]">
                      {p.currency === 'USD'
                        ? `$${DISPLAY_PRICES.USD[p.duration] || p.amount}`
                        : `${(DISPLAY_PRICES.CDF[p.duration] || p.amount).toLocaleString('fr-FR')} FC`
                      }
                    </p>
                    <p className="text-xs text-[#64748B]">{p.duration} mois</p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

      </div>

      {/* Modals — hors des blocs activeTab */}
      {showDeleteAccount && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-5">
            <div className="text-center mb-4">
              <p className="text-3xl mb-3">⚠️</p>
              <h2 className="text-base font-bold text-[#0F172A]">Supprimer mon compte ?</h2>
              <p className="text-sm text-[#64748B] mt-2 leading-relaxed">
                Toutes tes données seront supprimées définitivement — ventes, stocks, clients, dépenses.
              </p>
              <div className="mt-4">
                <p className="text-xs font-semibold text-[#64748B] mb-2">
                  Tape <span className="text-[#DC2626] font-bold">SUPPRIMER</span> pour confirmer
                </p>
                <input
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="SUPPRIMER"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#DC2626] text-center font-bold"
                />
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => { setShowDeleteAccount(false); setDeleteConfirmText('') }}
                className="flex-1 bg-white border border-gray-200 text-[#64748B] rounded-xl py-3 font-medium text-sm"
              >
                Annuler
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleteConfirmText !== 'SUPPRIMER' || deletingAccount}
                className="flex-1 bg-[#DC2626] text-white rounded-xl py-3 font-semibold text-sm disabled:opacity-50"
              >
                {deletingAccount ? 'Suppression...' : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showLogoutConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-5">
            <div className="text-center mb-4">
              <p className="text-3xl mb-3">👋</p>
              <h2 className="text-base font-bold text-[#0F172A]">Se déconnecter ?</h2>
              <p className="text-sm text-[#64748B] mt-1">
                Tu devras te reconnecter pour accéder à ton compte.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 bg-white border border-gray-200 text-[#64748B] rounded-xl py-3 font-medium text-sm"
              >
                Annuler
              </button>
              <button
                onClick={handleLogout}
                className="flex-1 bg-[#DC2626] text-white rounded-xl py-3 font-semibold text-sm"
              >
                Se déconnecter
              </button>
            </div>
          </div>
        </div>
      )}

      <Navbar />
    </div>
  )
}