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
    password: ''
  })

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value })
    setError('')
  }

  const handleSignup = async () => {
    if (!form.shop_name || form.shop_name.trim().length < 2) {
      setError('Le nom de ta boutique doit avoir au moins 2 caractères')
      return
    }
    if (!form.password || form.password.length < 6) {
      setError('Le mot de passe doit avoir au moins 6 caractères')
      return
    }
    if (!form.email) {
      setError('Donne ton adresse email')
      return
    }

    setLoading(true)

    const { data, error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    if (data.user) {
      await supabase.from('users').insert({
        id: data.user.id,
        shop_name: sanitize(form.shop_name),
        phone: sanitize(form.phone),
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
    if (!form.email || !form.password) {
      setError('Remplis ton email et ton mot de passe')
      return
    }
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({
      email: form.email,
      password: form.password,
    })
    if (error) {
      setError('Email ou mot de passe incorrect')
    }
    setLoading(false)
  }

  const handleForgotPassword = async () => {
    if (!form.email) {
      setError('Entre ton email')
      return
    }
    setLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(form.email, {
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
              Fini le cahier, place au digital. Gère ta boutique depuis ton téléphone.
            </p>

            <div className="text-left mb-6 space-y-3">
              {[
                { icon: '🛒', title: 'Enregistre tes ventes', sub: "En 3 clics, plus vite qu'un cahier" },
                { icon: '📦', title: 'Suis tes stocks', sub: "Alertes automatiques quand c'est bas" },
                { icon: '👥', title: 'Gère les dettes clients', sub: 'Ne perds plus jamais un franc' },
                { icon: '📶', title: 'Fonctionne sans internet', sub: 'Même quand le réseau coupe' },
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
                  Nom de ta boutique
                </label>
                <input
                  name="shop_name"
                  value={form.shop_name}
                  onChange={handleChange}
                  placeholder="Ex: Boutique Mama Jeanne"
                  className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm text-[#0F172A] outline-none focus:border-[#1A56DB]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#64748B] uppercase tracking-wide mb-2">
                  Numéro de téléphone
                </label>
                <input
                  name="phone"
                  value={form.phone}
                  onChange={handleChange}
                  placeholder="+243 8X XXX XXXX"
                  className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm text-[#0F172A] outline-none focus:border-[#1A56DB]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#64748B] uppercase tracking-wide mb-2">
                  Email
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
                  Mot de passe
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
            </div>

            <button
              onClick={handleSignup}
              disabled={loading}
              className="w-full bg-[#1A56DB] text-white rounded-xl py-3 font-semibold text-sm mt-5 disabled:opacity-50"
            >
              {loading ? 'Création...' : 'Créer mon compte gratuit'}
            </button>
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
                  Email
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
              <span
                onClick={() => setTab('signup')}
                className="text-[#1A56DB] font-medium cursor-pointer"
              >
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