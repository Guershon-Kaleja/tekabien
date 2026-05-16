import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { sanitize } from '../lib/validation'

export default function Login() {
  const navigate = useNavigate()
  const [tab, setTab] = useState('welcome')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [form, setForm] = useState({
    shop_name: '',
    phone: '',
    email: '',
    password: '',
    confirm_password: '',
  })

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

  const normalizePhone = (phone) => {
    const clean = phone.replace(/\s/g, '').replace('+243', '0').replace('+', '')
    if (clean.length === 9 && !clean.startsWith('0')) return '0' + clean
    return clean
  }

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value })
    setError('')
  }

  const handleSignup = async () => {
    if (!form.shop_name || form.shop_name.trim().length < 2) {
      setError("Entre le nom de ton activité")
      return
    }
    if (!form.email || !emailRegex.test(form.email)) {
      setError('Entre une adresse email valide')
      return
    }
    if (!form.password || form.password.length < 6) {
      setError('Le mot de passe doit avoir au moins 6 caractères')
      return
    }
    if (form.password !== form.confirm_password) {
      setError('Les mots de passe ne correspondent pas')
      return
    }

    setLoading(true)
    setError('')

    const { data, error } = await supabase.auth.signUp({
      email: form.email.trim().toLowerCase(),
      password: form.password,
    })

    if (error) {
      if (error.message.includes('already registered')) {
        setError('Cet email est déjà utilisé — connecte-toi')
      } else {
        setError(error.message)
      }
      setLoading(false)
      return
    }

    if (data.user) {
      await supabase.from('users').insert({
        id: data.user.id,
        shop_name: sanitize(form.shop_name.trim()),
        phone: form.phone ? normalizePhone(form.phone) : '',
        email: form.email.trim().toLowerCase(),
        language: 'fr',
        role: 'user',
        plan: 'trial',
        plan_expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      })
      navigate('/onboarding')
    }

    setLoading(false)
  }

  const handleLogin = async () => {
    if (!form.email) {
      setError('Entre ton email ou numéro de téléphone')
      return
    }
    if (!form.password) {
      setError('Entre ton mot de passe')
      return
    }
    setLoading(true)
    setError('')

    let emailToUse = form.email.trim().toLowerCase()

    if (!emailRegex.test(form.email)) {
      const raw = form.email.replace(/\s/g, '')
      let clean = raw.replace('+243', '').replace('+', '')
      if (!clean.startsWith('0')) clean = '0' + clean

      const response = await fetch(
        'https://qoeextvpjhgqjrnzwkcj.supabase.co/functions/v1/phone-login',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({ phone: clean }),
        }
      )

      const result = await response.json()

      if (!result.found || !result.email) {
        setError('Numéro non trouvé — essaie avec ton email')
        setLoading(false)
        return
      }

      emailToUse = result.email
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: emailToUse,
      password: form.password,
    })

    if (error) {
      setError('Email/numéro ou mot de passe incorrect')
    }
    setLoading(false)
  }

  const handleForgotPassword = async () => {
    if (!form.email || !emailRegex.test(form.email)) {
      setError('Entre une adresse email valide')
      return
    }
    setLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(form.email.trim().toLowerCase(), {
      redirectTo: `${window.location.origin}/reset-password`
    })
    if (error) {
      setError('Erreur — vérifie ton email')
    } else {
      setSuccess(true)
      setError('')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-[#EEF2F7] flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">

        <div className="flex border-b border-gray-100">
          {['welcome', 'signup', 'login'].map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setError(''); setSuccess(false) }}
              className={`flex-1 py-3 text-xs font-semibold transition-colors ${
                tab === t
                  ? 'text-[#1A56DB] border-b-2 border-[#1A56DB]'
                  : 'text-[#64748B]'
              }`}
            >
              {t === 'welcome' ? 'Accueil' : t === 'signup' ? "S'inscrire" : 'Se connecter'}
            </button>
          ))}
        </div>

        {tab === 'welcome' && (
          <div className="p-6 text-center">
            <div className="w-16 h-16 bg-[#0F172A] rounded-2xl flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">🏪</span>
            </div>
            <h1 className="text-2xl font-bold text-[#0F172A] mb-2">TekaBien</h1>
            <p className="text-[#64748B] text-sm mb-6 leading-relaxed">
              Fini le cahier, place au digital. Gère ton activité depuis ton téléphone.
            </p>
            <div className="text-left mb-6 space-y-3">
              {[
                { icon: '🛒', title: 'Enregistre tes ventes', sub: "En 3 clics, plus vite qu'un cahier" },
                { icon: '📦', title: 'Suis tes stocks', sub: "Alertes automatiques quand c'est bas" },
                { icon: '👥', title: 'Gère les dettes clients', sub: 'Ne perds plus jamais un franc' },
                { icon: '📊', title: 'Rapports détaillés', sub: 'Suis ta trésorerie en temps réel' },
              ].map((f, i) => (
                <div key={i} className="flex items-center gap-3 p-3 bg-[#EEF2F7] rounded-xl">
                  <span className="text-xl">{f.icon}</span>
                  <div>
                    <p className="text-sm font-semibold text-[#0F172A]">{f.title}</p>
                    <p className="text-xs text-[#64748B]">{f.sub}</p>
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={() => setTab('signup')}
              className="w-full bg-[#1A56DB] text-white rounded-xl py-3 font-semibold text-sm mb-3"
            >
              Essayer gratuitement — 30 jours
            </button>
            <button
              onClick={() => setTab('login')}
              className="w-full border border-[#1A56DB] text-[#1A56DB] rounded-xl py-3 font-medium text-sm"
            >
              Se connecter
            </button>
          </div>
        )}

        {tab === 'signup' && (
          <div className="p-6">
            <div className="flex items-center gap-2 bg-[#F0FDF4] border border-green-200 rounded-xl p-3 mb-5">
              <span>🎁</span>
              <p className="text-xs text-[#16A34A] font-medium">30 jours gratuits — aucune carte requise</p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4">
                <p className="text-xs text-red-600">{error}</p>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#64748B] uppercase tracking-wide mb-2">
                  Nom de ton activité *
                </label>
                <input
                  name="shop_name"
                  value={form.shop_name}
                  onChange={handleChange}
                  placeholder="Ex: Ventes en ligne, Salon Merveille..."
                  className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm text-[#0F172A] outline-none focus:border-[#1A56DB]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#64748B] uppercase tracking-wide mb-2">
                  Numéro de téléphone (optionnel)
                </label>
                <input
                  name="phone"
                  value={form.phone}
                  onChange={handleChange}
                  placeholder="Ex: 0891234567"
                  className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm text-[#0F172A] outline-none focus:border-[#1A56DB]"
                />
                <p className="text-xs text-[#64748B] mt-1">Airtel, Orange, M-Pesa ou Africell</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#64748B] uppercase tracking-wide mb-2">
                  Email *
                </label>
                <input
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="ton@email.com"
                  className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm text-[#0F172A] outline-none focus:border-[#1A56DB]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#64748B] uppercase tracking-wide mb-2">
                  Mot de passe *
                </label>
                <input
                  name="password"
                  type="password"
                  value={form.password}
                  onChange={handleChange}
                  placeholder="Minimum 6 caractères"
                  className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm text-[#0F172A] outline-none focus:border-[#1A56DB]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#64748B] uppercase tracking-wide mb-2">
                  Confirmer le mot de passe *
                </label>
                <input
                  name="confirm_password"
                  type="password"
                  value={form.confirm_password}
                  onChange={handleChange}
                  placeholder="Répète ton mot de passe"
                  className={`w-full border rounded-xl px-3 py-3 text-sm text-[#0F172A] outline-none focus:border-[#1A56DB] ${
                    form.confirm_password && form.password !== form.confirm_password
                      ? 'border-[#DC2626]'
                      : 'border-gray-200'
                  }`}
                />
                {form.confirm_password && form.password !== form.confirm_password && (
                  <p className="text-xs text-[#DC2626] mt-1">Les mots de passe ne correspondent pas</p>
                )}
                {form.confirm_password && form.password === form.confirm_password && form.confirm_password.length >= 6 && (
                  <p className="text-xs text-[#16A34A] mt-1">✅ Les mots de passe correspondent</p>
                )}
              </div>
            </div>

            <button
              onClick={handleSignup}
              disabled={loading}
              className="w-full bg-[#1A56DB] text-white rounded-xl py-3 font-semibold text-sm mt-5 disabled:opacity-50"
            >
              {loading ? 'Création...' : 'Créer mon compte gratuit'}
            </button>

            <p className="text-center text-xs text-[#64748B] mt-4">
              Déjà un compte ?{' '}
              <span onClick={() => setTab('login')} className="text-[#1A56DB] font-medium cursor-pointer">
                Se connecter
              </span>
            </p>
          </div>
        )}

        {tab === 'login' && (
          <div className="p-6">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4">
                <p className="text-xs text-red-600">{error}</p>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#64748B] uppercase tracking-wide mb-2">
                  Email ou numéro de téléphone
                </label>
                <input
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="ton@email.com ou 0891234567"
                  className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm text-[#0F172A] outline-none focus:border-[#1A56DB]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#64748B] uppercase tracking-wide mb-2">
                  Mot de passe
                </label>
                <input
                  name="password"
                  type="password"
                  value={form.password}
                  onChange={handleChange}
                  onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                  placeholder="Ton mot de passe"
                  className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm text-[#0F172A] outline-none focus:border-[#1A56DB]"
                />
              </div>
            </div>

            <div className="text-right mt-2 mb-4">
              <span
                onClick={() => { setTab('forgot'); setError(''); setSuccess(false) }}
                className="text-xs text-[#1A56DB] font-medium cursor-pointer"
              >
                Mot de passe oublié ?
              </span>
            </div>

            <button
              onClick={handleLogin}
              disabled={loading}
              className="w-full bg-[#1A56DB] text-white rounded-xl py-3 font-semibold text-sm disabled:opacity-50"
            >
              {loading ? 'Connexion...' : 'Se connecter'}
            </button>

            <p className="text-center text-xs text-[#64748B] mt-4">
              Pas encore de compte ?{' '}
              <span onClick={() => setTab('signup')} className="text-[#1A56DB] font-medium cursor-pointer">
                S'inscrire gratuitement
              </span>
            </p>
          </div>
        )}

        {tab === 'forgot' && (
          <div className="p-6">
            <p className="text-sm text-[#64748B] mb-4 leading-relaxed">
              Entre ton adresse email — on t'envoie un lien pour réinitialiser ton mot de passe.
            </p>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4">
                <p className="text-xs text-red-600">{error}</p>
              </div>
            )}

            {success && (
              <div className="bg-[#F0FDF4] border border-green-200 rounded-xl p-3 mb-4">
                <p className="text-xs text-[#16A34A] font-medium">
                  ✅ Email envoyé ! Vérifie ta boîte mail.
                </p>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-[#64748B] uppercase tracking-wide mb-2">
                Email
              </label>
              <input
                name="email"
                value={form.email}
                onChange={handleChange}
                placeholder="ton@email.com"
                className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm outline-none focus:border-[#1A56DB]"
              />
            </div>

            <button
              onClick={handleForgotPassword}
              disabled={loading}
              className="w-full bg-[#1A56DB] text-white rounded-xl py-3 font-semibold text-sm mt-4 disabled:opacity-50"
            >
              {loading ? 'Envoi...' : 'Envoyer le lien'}
            </button>

            <button
              onClick={() => { setTab('login'); setError(''); setSuccess(false) }}
              className="w-full bg-white border border-gray-200 text-[#64748B] rounded-xl py-3 font-medium text-sm mt-2"
            >
              Retour
            </button>
          </div>
        )}

      </div>
    </div>
  )
}