import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { sanitize } from '../lib/validation'
import Header from '../components/Header'
import Navbar from '../components/Navbar'

export default function Profil() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [user, setUser] = useState(null)
  const [form, setForm] = useState({ shop_name: '', phone: '', currency: 'FC' })
  const [passwordForm, setPasswordForm] = useState({ current: '', new: '', confirm: '' })
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState('')
  const [activeTab, setActiveTab] = useState('profil')
  const [userPlan, setUserPlan] = useState(null)
  const [planExpires, setPlanExpires] = useState(null)

  // Équipe
  const [teamMembers, setTeamMembers] = useState([])
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteError, setInviteError] = useState('')
  const [inviteSuccess, setInviteSuccess] = useState('')
  const [inviting, setInviting] = useState(false)
  const [teamRole, setTeamRole] = useState('owner')

  useEffect(() => { fetchProfile() }, [])

  const fetchProfile = async () => {
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser) return
    setUser(authUser)

    const { data } = await supabase
      .from('users')
      .select('shop_name, phone, plan, plan_expires, currency, team_role')
      .eq('id', authUser.id)
      .single()

    if (data) {
      setForm({
        shop_name: data.shop_name || '',
        phone: data.phone || '',
        currency: data.currency || 'FC',
      })
      setUserPlan(data.plan)
      setPlanExpires(data.plan_expires)
      setTeamRole(data.team_role || 'owner')
    }

    // Charger les membres de l'équipe
    await fetchTeamMembers(authUser.id)

    setLoading(false)
  }

  const fetchTeamMembers = async (ownerId) => {
    const { data } = await supabase
      .from('team_members')
      .select(`
        id,
        role,
        created_at,
        member:member_id (
          id,
          shop_name,
          phone
        )
      `)
      .eq('owner_id', ownerId)
      .order('created_at', { ascending: false })

    if (data) setTeamMembers(data)
  }

  const handleInviteMember = async () => {
    if (!inviteEmail || !inviteEmail.includes('@')) {
      setInviteError('Entre un email valide')
      return
    }
    setInviteError('')
    setInviting(true)

    // Chercher l'utilisateur par email
    const { data: authUsers } = await supabase
      .from('users')
      .select('id, shop_name')
      .eq('email', inviteEmail.trim().toLowerCase())
      .single()

    if (!authUsers) {
      setInviteError("Aucun compte trouvé avec cet email — l'utilisateur doit d'abord s'inscrire sur TekaBien")
      setInviting(false)
      return
    }

    if (authUsers.id === user.id) {
      setInviteError('Tu ne peux pas t\'ajouter toi-même')
      setInviting(false)
      return
    }

    // Vérifier si déjà membre
    const { data: existing } = await supabase
      .from('team_members')
      .select('id')
      .eq('owner_id', user.id)
      .eq('member_id', authUsers.id)
      .single()

    if (existing) {
      setInviteError('Cet utilisateur est déjà dans ton équipe')
      setInviting(false)
      return
    }

    // Ajouter le membre
    const { error: insertError } = await supabase
      .from('team_members')
      .insert({
        owner_id: user.id,
        member_id: authUsers.id,
        role: 'staff',
      })

    if (insertError) {
      setInviteError('Erreur lors de l\'invitation — réessaie')
      setInviting(false)
      return
    }

    // Mettre à jour le profil du membre
    await supabase
      .from('users')
      .update({
        owner_id: user.id,
        team_role: 'staff',
      })
      .eq('id', authUsers.id)

    setInviteSuccess(`${authUsers.shop_name} a été ajouté à ton équipe ✅`)
    setInviteEmail('')
    setTimeout(() => setInviteSuccess(''), 4000)
    fetchTeamMembers(user.id)
    setInviting(false)
  }

  const handleRemoveMember = async (member) => {
    await supabase
      .from('team_members')
      .delete()
      .eq('id', member.id)

    // Réinitialiser le profil du membre
    await supabase
      .from('users')
      .update({
        owner_id: null,
        team_role: 'owner',
      })
      .eq('id', member.member.id)

    fetchTeamMembers(user.id)
  }

  const handleSaveProfile = async () => {
    if (!form.shop_name || form.shop_name.trim().length < 2) {
      setError('Le nom de ta boutique doit avoir au moins 2 caractères')
      return
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
      .eq('id', user.id)

    if (error) {
      setError('Erreur lors de la sauvegarde — réessaie')
    } else {
      setSuccess('Profil mis à jour avec succès ✅')
      setTimeout(() => setSuccess(''), 3000)
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
      setPasswordForm({ current: '', new: '', confirm: '' })
      setTimeout(() => setPasswordSuccess(''), 3000)
    }

    setSaving(false)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/login')
  }

  const getPlanLabel = (plan) => ({
    trial: 'Essai gratuit', pro: 'Pro',
    business: 'Business', free: 'Gratuit',
  })[plan] || plan

  const getPlanColor = (plan) => ({
    trial: '#B45309', pro: '#16A34A',
    business: '#1A56DB', free: '#64748B',
  })[plan] || '#64748B'

  const getPlanBg = (plan) => ({
    trial: '#FFFBEB', pro: '#F0FDF4',
    business: '#EBF2FF', free: '#F8FAFF',
  })[plan] || '#F8FAFF'

  const tabs = [
    { id: 'profil', label: '👤 Profil' },
    { id: 'securite', label: '🔒 Sécurité' },
    { id: 'abonnement', label: '💳 Abonnement' },
    ...(userPlan === 'business' && teamRole === 'owner'
      ? [{ id: 'equipe', label: '👥 Équipe' }]
      : []
    ),
  ]

  if (loading) {
    return (
      <div className="min-h-screen bg-[#EEF2F7] flex items-center justify-center">
        <p className="text-[#1A56DB] font-semibold">Chargement...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#EEF2F7] pb-24">

      <Header title="Mon profil" />

      {/* Bannière employé */}
      {teamRole === 'staff' && (
        <div className="bg-[#EBF2FF] border-b border-blue-200 px-4 py-2">
          <p className="text-xs text-[#1A56DB] font-medium">👤 Tu es employé — accès limité aux ventes</p>
        </div>
      )}

      <div className="flex bg-white border-b border-gray-200 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex-shrink-0 flex-1 py-3 text-xs font-semibold transition-colors ${
              activeTab === t.id
                ? 'text-[#1A56DB] border-b-2 border-[#1A56DB]'
                : 'text-[#64748B]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="px-4 pt-4">

        {activeTab === 'profil' && (
          <>
            <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-4 text-center">
              <div className="w-16 h-16 bg-[#1A56DB] rounded-2xl flex items-center justify-center mx-auto mb-3">
                <span className="text-3xl">{teamRole === 'staff' ? '👤' : '🏪'}</span>
              </div>
              <p className="text-base font-bold text-[#0F172A]">{form.shop_name}</p>
              <p className="text-xs text-[#64748B] mt-1">{user?.email}</p>
              <span
                className="inline-block text-xs font-semibold px-3 py-1 rounded-full mt-2"
                style={{ background: getPlanBg(userPlan), color: getPlanColor(userPlan) }}
              >
                {teamRole === 'staff' ? '👤 Employé' : `Plan ${getPlanLabel(userPlan)}`}
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
                Informations
              </p>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#64748B] uppercase tracking-wide mb-2">
                    {teamRole === 'staff' ? 'Ton nom' : 'Nom de la boutique'}
                  </label>
                  <input
                    value={form.shop_name}
                    onChange={(e) => { setForm({ ...form, shop_name: e.target.value }); setError('') }}
                    placeholder="Ex: Boutique Mama Jeanne"
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
                  <label className="block text-xs font-semibold text-[#64748B] uppercase tracking-wide mb-2">
                    Email
                  </label>
                  <input
                    value={user?.email || ''}
                    disabled
                    className="w-full border border-gray-100 bg-gray-50 rounded-xl px-3 py-3 text-sm text-[#64748B] outline-none cursor-not-allowed"
                  />
                </div>

                {teamRole === 'owner' && (
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
                            form.currency === c.id
                              ? 'border-[#1A56DB] bg-[#EBF2FF]'
                              : 'border-gray-200 bg-white'
                          }`}
                        >
                          <p className="text-lg font-bold text-[#1A56DB]">{c.symbol}</p>
                          <p className="text-xs font-semibold text-[#0F172A]">{c.id}</p>
                          <p className="text-xs text-[#64748B] mt-1">{c.desc}</p>
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-[#64748B] mt-2">
                      ⚠️ Changer la devise n'affecte pas les montants existants.
                    </p>
                  </div>
                )}
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
              onClick={handleLogout}
              className="w-full bg-white border border-red-200 text-[#DC2626] rounded-xl py-3 font-semibold text-sm"
            >
              Se déconnecter
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
            <div
              className="rounded-xl p-4 mb-4 border"
              style={{ background: getPlanBg(userPlan), borderColor: getPlanColor(userPlan) + '40' }}
            >
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-bold text-[#0F172A]">Plan actuel</p>
                <span
                  className="text-xs font-bold px-3 py-1.5 rounded-lg text-white"
                  style={{ background: getPlanColor(userPlan) }}
                >
                  {getPlanLabel(userPlan).toUpperCase()}
                </span>
              </div>
              {planExpires && (
                <p className="text-xs text-[#64748B]">
                  {userPlan === 'trial' ? 'Essai expire le' : 'Renouvellement le'} {new Date(planExpires).toLocaleDateString('fr-FR')}
                </p>
              )}
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
              <p className="text-xs font-semibold text-[#64748B] uppercase tracking-wide mb-4">
                Comparaison des plans
              </p>
              {[
                { feature: 'Ventes illimitées', free: false, pro: true, business: true },
                { feature: 'Produits illimités', free: false, pro: true, business: true },
                { feature: 'Clients illimités', free: false, pro: true, business: true },
                { feature: 'Rapports complets', free: false, pro: true, business: true },
                { feature: 'Export PDF', free: false, pro: true, business: true },
                { feature: 'Mode offline', free: true, pro: true, business: true },
                { feature: 'Multi-utilisateurs', free: false, pro: false, business: true },
              ].map((f, i) => (
                <div key={i} className="flex items-center py-2 border-b border-gray-100 last:border-0">
                  <p className="text-xs text-[#0F172A] flex-1">{f.feature}</p>
                  <div className="flex gap-4">
                    <span className={`text-xs w-8 text-center ${f.free ? 'text-[#16A34A]' : 'text-gray-300'}`}>{f.free ? '✓' : '✗'}</span>
                    <span className={`text-xs w-8 text-center ${f.pro ? 'text-[#16A34A]' : 'text-gray-300'}`}>{f.pro ? '✓' : '✗'}</span>
                    <span className={`text-xs w-8 text-center ${f.business ? 'text-[#16A34A]' : 'text-gray-300'}`}>{f.business ? '✓' : '✗'}</span>
                  </div>
                </div>
              ))}
              <div className="flex items-center mt-3">
                <p className="text-xs text-[#64748B] flex-1">Prix/mois</p>
                <div className="flex gap-4">
                  <span className="text-xs font-bold text-[#64748B] w-8 text-center">0$</span>
                  <span className="text-xs font-bold text-[#16A34A] w-8 text-center">3$</span>
                  <span className="text-xs font-bold text-[#1A56DB] w-8 text-center">6$</span>
                </div>
              </div>
            </div>

            {(userPlan === 'trial' || userPlan === 'free') && (
              <button
                onClick={() => navigate('/expired')}
                className="w-full bg-[#1A56DB] text-white rounded-xl py-3 font-semibold text-sm"
              >
                Passer au Pro — 3$/mois
              </button>
            )}

            {(userPlan === 'pro' || userPlan === 'business') && (
              <button
                onClick={() => navigate('/expired')}
                className="w-full bg-white border border-[#1A56DB] text-[#1A56DB] rounded-xl py-3 font-semibold text-sm"
              >
                Renouveler mon abonnement
              </button>
            )}
          </>
        )}

        {activeTab === 'equipe' && userPlan === 'business' && (
          <>
            <div className="bg-[#EBF2FF] border border-blue-200 rounded-xl p-4 mb-4">
              <p className="text-xs font-semibold text-[#1A56DB] mb-1">👥 Gestion d'équipe Business</p>
              <p className="text-xs text-[#64748B]">
                Invite des employés — ils pourront enregistrer des ventes depuis leur propre compte.
              </p>
            </div>

            {/* Inviter un employé */}
            <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
              <p className="text-xs font-semibold text-[#64748B] uppercase tracking-wide mb-3">
                Inviter un employé
              </p>

              {inviteSuccess && (
                <div className="bg-[#F0FDF4] border border-green-200 rounded-xl p-3 mb-3">
                  <p className="text-xs text-[#16A34A] font-medium">{inviteSuccess}</p>
                </div>
              )}

              {inviteError && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-3">
                  <p className="text-xs text-[#DC2626]">{inviteError}</p>
                </div>
              )}

              <div className="mb-3">
                <label className="block text-xs font-semibold text-[#64748B] uppercase tracking-wide mb-2">
                  Email de l'employé
                </label>
                <input
                  value={inviteEmail}
                  onChange={(e) => { setInviteEmail(e.target.value); setInviteError('') }}
                  placeholder="employe@email.com"
                  className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm outline-none focus:border-[#1A56DB]"
                />
                <p className="text-xs text-[#64748B] mt-1">
                  L'employé doit d'abord créer un compte TekaBien
                </p>
              </div>

              <button
                onClick={handleInviteMember}
                disabled={inviting}
                className="w-full bg-[#1A56DB] text-white rounded-xl py-3 font-semibold text-sm disabled:opacity-50"
              >
                {inviting ? 'Invitation...' : '+ Ajouter à mon équipe'}
              </button>
            </div>

            {/* Liste des membres */}
            <p className="text-xs font-semibold text-[#64748B] uppercase tracking-wide mb-3">
              Membres de l'équipe ({teamMembers.length})
            </p>

            {teamMembers.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 p-6 text-center">
                <p className="text-3xl mb-2">👥</p>
                <p className="text-sm font-semibold text-[#0F172A]">Aucun employé</p>
                <p className="text-xs text-[#64748B] mt-1">Invite ton premier employé ci-dessus</p>
              </div>
            ) : (
              teamMembers.map((m) => (
                <div key={m.id} className="bg-white rounded-xl border border-gray-200 p-3 mb-2 flex items-center gap-3">
                  <div className="w-9 h-9 bg-[#EBF2FF] rounded-full flex items-center justify-center text-sm font-bold text-[#1A56DB] flex-shrink-0">
                    {m.member?.shop_name?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-[#0F172A]">{m.member?.shop_name || 'Employé'}</p>
                    <p className="text-xs text-[#64748B]">{m.member?.phone || 'Pas de téléphone'}</p>
                    <span className="text-xs bg-[#EBF2FF] text-[#1A56DB] px-2 py-0.5 rounded-full font-medium">
                      Employé
                    </span>
                  </div>
                  <button
                    onClick={() => handleRemoveMember(m)}
                    className="text-xs text-[#DC2626] bg-[#FEF2F2] px-3 py-2 rounded-lg font-medium"
                  >
                    Retirer
                  </button>
                </div>
              ))
            )}
          </>
        )}

      </div>

      <Navbar />

    </div>
  )
}