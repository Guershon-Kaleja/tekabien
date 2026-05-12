import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { initiatePayment, checkPaymentStatus } from '../lib/labyrinthe'

export default function Expired() {
  const navigate = useNavigate()
  const [step, setStep] = useState('choice')
  const [plan, setPlan] = useState('pro')
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [orderNumber, setOrderNumber] = useState('')
  const [checking, setChecking] = useState(false)

  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  const detectOperator = (phone) => {
    const clean = phone.replace(/\s/g, '').replace('+243', '0').replace('+', '')
    if (/^0(99|97|98)/.test(clean)) return { name: 'Airtel Money', color: '#EF4444', icon: '📱' }
    if (/^0(84|85|89)/.test(clean)) return { name: 'Orange Money', color: '#F97316', icon: '📱' }
    if (/^0(81|82|83)/.test(clean)) return { name: 'M-Pesa', color: '#8B5CF6', icon: '📱' }
    return null
  }

  const handleInitiatePayment = async () => {
    if (!phone || phone.length < 9) {
      setError('Entre un numéro de téléphone valide')
      return
    }
    const operator = detectOperator(phone)
    if (!operator) {
      setError('Opérateur non reconnu — vérifie ton numéro')
      return
    }
    setError('')
    setLoading(true)

    const amount = plan === 'pro' ? 0.1 : 0.2

    const result = await initiatePayment({
      phone,
      amount,
      currency: 'USD',
      plan,
    })

    if (result.success) {
      setOrderNumber(result.reference)
      setStep('verify')
    } else {
      setError(result.error || 'Erreur lors du paiement — réessaie')
    }

    setLoading(false)
  }

  const handleVerifyPayment = async () => {
    if (!orderNumber) {
      setError('Référence de paiement manquante')
      return
    }
    setError('')
    setChecking(true)

    const result = await checkPaymentStatus(orderNumber)

    if (result.paid) {
      const { data: { session } } = await supabase.auth.getSession()
      const user = session?.user
      if (!user) return

      const expires = new Date()
      expires.setMonth(expires.getMonth() + 1)

      await supabase
        .from('users')
        .update({
          plan,
          plan_expires: expires.toISOString()
        })
        .eq('id', user.id)

      setStep('success')
      setTimeout(() => navigate('/'), 2000)
    } else if (result.failed) {
      setError('Paiement échoué — solde insuffisant ou annulé. Réessaie avec un autre numéro.')
      setStep('choice')
    } else {
      setError('Paiement en attente. Attends quelques secondes et réessaie.')
    }

    setChecking(false)
  }

  return (
    <div className="min-h-screen bg-[#EEF2F7] flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">

        <div className="bg-[#1A56DB] p-6 text-center">
          <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <span className="text-4xl">
              {step === 'success' ? '🎉' : '⏰'}
            </span>
          </div>
          <h1 className="text-white font-bold text-xl">
            {step === 'success' ? 'Paiement confirmé !' : 'Essai terminé'}
          </h1>
          <p className="text-blue-200 text-sm mt-1">
            {step === 'success'
              ? 'Ton plan est actif. Redirection...'
              : 'Ton essai gratuit de 30 jours est expiré'
            }
          </p>
        </div>

        <div className="p-6">

          {step === 'choice' && (
            <>
              <div className="bg-[#F0FDF4] border border-green-200 rounded-xl p-4 mb-5">
                <p className="text-[#16A34A] font-bold text-sm mb-1">Continue avec TekaBien Pro</p>
                <p className="text-[#16A34A] text-xs leading-relaxed">
                  Toutes tes données sont sauvegardées. Continue à gérer ta boutique.
                </p>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4">
                  <p className="text-xs text-[#DC2626] font-medium">{error}</p>
                </div>
              )}

              <p className="text-xs font-semibold text-[#64748B] uppercase tracking-wide mb-3">
                Choisis ton plan
              </p>

              <div className="grid grid-cols-2 gap-3 mb-5">
                {[
                  { id: 'pro', price: '3$', label: 'Pro', desc: 'Pour les boutiques individuelles' },
                  { id: 'business', price: '6$', label: 'Business', desc: 'Multi-utilisateurs + SMS' },
                ].map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setPlan(p.id)}
                    className={`p-3 rounded-xl border-2 text-left transition-all ${
                      plan === p.id
                        ? 'border-[#1A56DB] bg-[#EBF2FF]'
                        : 'border-gray-200 bg-white'
                    }`}
                  >
                    <p className="text-xl font-bold text-[#1A56DB]">{p.price}</p>
                    <p className="text-xs font-semibold text-[#0F172A]">{p.label}/mois</p>
                    <p className="text-xs text-[#64748B] mt-1">{p.desc}</p>
                  </button>
                ))}
              </div>

              <div className="mb-4">
                <label className="block text-xs font-semibold text-[#64748B] uppercase tracking-wide mb-2">
                  Ton numéro Mobile Money
                </label>
                <input
                  value={phone}
                  onChange={(e) => { setPhone(e.target.value); setError('') }}
                  placeholder="Ex: 0891000200"
                  className={`w-full border rounded-xl px-3 py-3 text-sm outline-none focus:border-[#1A56DB] ${
                    error ? 'border-[#DC2626]' : 'border-gray-200'
                  }`}
                />
                {(() => {
                  const operator = detectOperator(phone)
                  if (phone.length >= 4 && operator) {
                    return (
                      <div className="flex items-center gap-2 mt-2 bg-[#F0FDF4] border border-green-200 rounded-lg px-3 py-2">
                        <span>{operator.icon}</span>
                        <span className="text-xs font-semibold" style={{ color: operator.color }}>
                          {operator.name} détecté ✅
                        </span>
                      </div>
                    )
                  }
                  if (phone.length >= 4 && !operator) {
                    return (
                      <div className="flex items-center gap-2 mt-2 bg-[#FEF2F2] border border-red-200 rounded-lg px-3 py-2">
                        <span className="text-xs text-[#DC2626] font-medium">
                          ❌ Opérateur non reconnu — vérifie ton numéro
                        </span>
                      </div>
                    )
                  }
                  return (
                    <p className="text-xs text-[#64748B] mt-1">
                      Airtel Money, Orange Money ou M-Pesa
                    </p>
                  )
                })()}
              </div>

              <button
                onClick={handleInitiatePayment}
                disabled={loading}
                className="w-full bg-[#1A56DB] text-white rounded-xl py-3 font-semibold text-sm mb-3 disabled:opacity-50"
              >
                {loading ? 'Envoi de la demande...' : `Payer ${plan === 'pro' ? '3$' : '6$'}/mois`}
              </button>

              <button
                onClick={handleLogout}
                className="w-full bg-white border border-gray-200 text-[#64748B] rounded-xl py-3 font-medium text-sm"
              >
                Se déconnecter
              </button>
            </>
          )}

          {step === 'verify' && (
            <>
              <div className="bg-[#FFFBEB] border border-yellow-200 rounded-xl p-4 mb-4">
                <p className="text-[#B45309] font-bold text-sm mb-1">⏳ Demande envoyée</p>
                <p className="text-[#B45309] text-xs leading-relaxed">
                  Une demande de paiement a été envoyée sur ton téléphone. Entre ton code PIN pour confirmer.
                </p>
              </div>

              <div className="bg-white border border-gray-200 rounded-xl p-3 mb-4">
                <p className="text-xs text-[#64748B] mb-1">Plan sélectionné</p>
                <p className="text-sm font-bold text-[#0F172A]">
                  {plan === 'pro' ? 'Pro — 3$/mois' : 'Business — 6$/mois'}
                </p>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4">
                  <p className="text-xs text-[#DC2626] font-medium">{error}</p>
                  <p className="text-xs text-[#64748B] mt-1">
                    Tu peux réessayer ou changer de numéro.
                  </p>
                </div>
              )}

              <button
                onClick={handleVerifyPayment}
                disabled={checking}
                className="w-full bg-[#16A34A] text-white rounded-xl py-3 font-semibold text-sm mb-2 disabled:opacity-50"
              >
                {checking ? 'Vérification...' : "J'ai confirmé le paiement ✓"}
              </button>

              <button
                onClick={() => {
                  setStep('choice')
                  setError('')
                  setOrderNumber('')
                }}
                className="w-full bg-white border border-gray-200 text-[#64748B] rounded-xl py-3 font-medium text-sm mb-2"
              >
                Réessayer avec un autre numéro
              </button>

              <button
                onClick={handleLogout}
                className="w-full bg-white border border-gray-200 text-[#64748B] rounded-xl py-3 font-medium text-sm"
              >
                Se déconnecter
              </button>
            </>
          )}

          {step === 'success' && (
            <div className="text-center py-4">
              <p className="text-4xl mb-4">🎉</p>
              <p className="text-lg font-bold text-[#0F172A] mb-2">Bienvenue dans TekaBien Pro !</p>
              <p className="text-sm text-[#64748B]">Redirection vers ton dashboard...</p>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}