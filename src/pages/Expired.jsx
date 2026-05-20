import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { initiatePayment } from '../lib/labyrinthe'

export default function Expired() {
  const navigate = useNavigate()
  const [step, setStep] = useState('choice')
  const [currency, setCurrency] = useState('USD')
  const [duration, setDuration] = useState(1)
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [hasActivePlan, setHasActivePlan] = useState(false)
  const [currentPlan, setCurrentPlan] = useState(null)
  const [previousExpiry, setPreviousExpiry] = useState(null)
  const [retryDisabled, setRetryDisabled] = useState(false)
  const [currentReference, setCurrentReference] = useState(null)

  const basePrices = {
    pro: { USD: 5, CDF: 12000 },
  }

  const discounts = { 1: 0, 3: 10, 6: 15, 12: 20 }

  const durations = [
    { months: 1, label: '1 mois', badge: null },
    { months: 3, label: '3 mois', badge: '-10%' },
    { months: 6, label: '6 mois', badge: '-15%' },
    { months: 12, label: '12 mois', badge: '-20%' },
  ]

  const getPrice = (c, d) => {
    const base = basePrices.pro[c]
    const discount = discounts[d] || 0
    const monthly = base * (1 - discount / 100)
    const total = monthly * d
    return { monthly, total }
  }

  const formatPrice = (amount, c) => {
    if (c === 'USD') return `$${amount.toFixed(2)}`
    return `${Math.round(amount).toLocaleString('fr-FR')} FC`
  }

  useEffect(() => {
    const checkPlan = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const { data } = await supabase
        .from('users')
        .select('plan, plan_expires')
        .eq('id', session.user.id)
        .single()

      if (data) {
        setCurrentPlan(data.plan)
        setPreviousExpiry(data.plan_expires)
        if ((data.plan === 'pro' || data.plan === 'trial') && data.plan_expires) {
          const expires = new Date(data.plan_expires)
          const grace = new Date(expires.getTime() + 3 * 24 * 60 * 60 * 1000)
          if (new Date() < grace) setHasActivePlan(true)
        }
      }
    }
    checkPlan()
  }, [])

  useEffect(() => {
    if (step !== 'verify' || !currentReference) return

    let attempts = 0
    const maxAttempts = 20

    const interval = setInterval(async () => {
      attempts++

      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const { data: payment } = await supabase
        .from('payments')
        .select('status')
        .eq('reference', currentReference)
        .single()

      if (payment?.status === 'failed') {
        clearInterval(interval)
        setError('Paiement échoué — mauvais PIN ou solde insuffisant. Réessaie.')
        setStep('choice')
        return
      }

      if (payment?.status === 'completed') {
        const { data } = await supabase
          .from('users')
          .select('plan, plan_expires')
          .eq('id', session.user.id)
          .single()

        if (data?.plan === 'pro') {
          const expires = new Date(data.plan_expires)
          const previous = previousExpiry ? new Date(previousExpiry) : new Date()

          if (expires > new Date() && expires > previous) {
            clearInterval(interval)
            setStep('success')
            setTimeout(() => navigate('/'), 2000)
            return
          }
        }
      }

      if (attempts >= maxAttempts) {
        clearInterval(interval)
        setError('Délai dépassé — si tu as payé, contacte le support.')
        setStep('choice')
      }
    }, 3000)

    return () => clearInterval(interval)
  }, [step, currentReference, previousExpiry])

  const detectOperator = (phone) => {
    const clean = phone.replace(/\s/g, '').replace('+243', '0').replace('+', '')
    if (/^0(97|98|99)/.test(clean)) return { name: 'Airtel Money', color: '#EF4444' }
    if (/^0(80|84|85|89)/.test(clean)) return { name: 'Orange Money', color: '#F97316' }
    if (/^0(81|82|83)/.test(clean)) return { name: 'M-Pesa (Vodacom)', color: '#8B5CF6' }
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

    const result = await initiatePayment({
      phone,
      plan: 'pro',
      currency,
      duration,
    })

    if (result.success) {
      setCurrentReference(result.reference)
      setStep('verify')
      setRetryDisabled(true)
      setTimeout(() => setRetryDisabled(false), 10000)
    } else {
      setError(result.error || 'Erreur lors du paiement — réessaie')
    }

    setLoading(false)
  }

  const { monthly, total } = getPrice(currency, duration)

  return (
    <div className="min-h-screen bg-[#EEF2F7] flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">

        <div className="bg-[#1A56DB] p-6 text-center">
          <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <span className="text-4xl">
              {step === 'success' ? '🎉' : hasActivePlan ? '💳' : currentPlan === 'free' ? '🚀' : '⏰'}
            </span>
          </div>
          <h1 className="text-white font-bold text-xl">
            {step === 'success'
              ? 'Paiement confirmé !'
              : hasActivePlan && currentPlan === 'pro'
              ? 'Renouveler mon abonnement'
              : hasActivePlan && currentPlan === 'trial'
              ? 'Passer au Pro'
              : currentPlan === 'free'
              ? 'Passer au Pro'
              : 'Essai terminé'}
          </h1>

          <p className="text-blue-200 text-sm mt-1">
            {step === 'success'
              ? 'Ton plan est actif. Redirection...'
              : hasActivePlan && currentPlan === 'pro'
              ? 'Continue à utiliser TekaBien sans interruption'
              : hasActivePlan && currentPlan === 'trial'
              ? 'Débloque toutes les fonctionnalités Pro'
              : currentPlan === 'free'
              ? 'Débloque toutes les fonctionnalités'
              : 'Ton essai gratuit est expiré'}
          </p>
          {hasActivePlan && (
            <span className="inline-block mt-2 text-xs font-bold bg-white/20 text-white px-3 py-1 rounded-full">
              Plan Pro actif
            </span>
          )}
        </div>

        <div className="p-5">

          {step === 'choice' && (
            <>
              {hasActivePlan && (
                <div className="bg-[#EBF2FF] border border-blue-200 rounded-xl p-3 mb-4">
                  <p className="text-[#1A56DB] font-bold text-sm mb-1">Renouvellement anticipé</p>
                  <p className="text-[#1A56DB] text-xs">Les mois seront ajoutés à ta date actuelle.</p>
                </div>
              )}

              {!hasActivePlan && currentPlan === 'free' && (
                <div className="bg-[#EBF2FF] border border-blue-200 rounded-xl p-3 mb-4">
                  <p className="text-[#1A56DB] font-bold text-sm mb-1">🚀 Passe au Pro</p>
                  <p className="text-[#1A56DB] text-xs">Ventes illimitées, produits illimités, rapports complets.</p>
                </div>
              )}

              {!hasActivePlan && currentPlan !== 'free' && (
                <div className="bg-[#F0FDF4] border border-green-200 rounded-xl p-3 mb-4">
                  <p className="text-[#16A34A] font-bold text-sm mb-1">Continue avec TekaBien Pro</p>
                  <p className="text-[#16A34A] text-xs">Toutes tes données sont sauvegardées.</p>
                </div>
              )}

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4">
                  <p className="text-xs text-[#DC2626] font-medium">{error}</p>
                </div>
              )}

              {/* Plan Pro uniquement */}
              <div className="bg-[#EBF2FF] border-2 border-[#1A56DB] rounded-xl p-4 mb-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-sm font-bold text-[#0F172A]">Plan Pro</p>
                    <p className="text-xs text-[#64748B]">Toutes les fonctionnalités débloquées</p>
                  </div>
                  <span className="text-xs font-bold bg-[#1A56DB] text-white px-2 py-1 rounded-lg">PRO</span>
                </div>
                <p className="text-xl font-bold text-[#1A56DB]">
                  {formatPrice(monthly, currency)}<span className="text-sm font-normal text-[#64748B]">/mois</span>
                </p>
                {duration > 1 && (
                  <p className="text-xs text-[#16A34A] mt-1">
                    🎉 {discounts[duration]}% de réduction — {formatPrice(total, currency)} total
                  </p>
                )}
              </div>

              {/* Choix durée */}
              <p className="text-xs font-semibold text-[#64748B] uppercase tracking-wide mb-2">Durée</p>
              <div className="grid grid-cols-2 gap-2 mb-4">
                {durations.map((d) => {
                  const { monthly: m, total: t } = getPrice(currency, d.months)
                  return (
                    <button
                      key={d.months}
                      onClick={() => setDuration(d.months)}
                      className={`p-3 rounded-xl border-2 text-left transition-all relative ${
                        duration === d.months ? 'border-[#1A56DB] bg-[#EBF2FF]' : 'border-gray-200 bg-white'
                      }`}
                    >
                      {d.badge && (
                        <span className="absolute top-2 right-2 text-xs font-bold bg-[#16A34A] text-white px-1.5 py-0.5 rounded-full">
                          {d.badge}
                        </span>
                      )}
                      <p className="text-sm font-bold text-[#1A56DB]">{d.label}</p>
                      <p className="text-xs text-[#0F172A] font-medium">{formatPrice(t, currency)} total</p>
                      <p className="text-xs text-[#64748B]">{formatPrice(m, currency)}/mois</p>
                    </button>
                  )
                })}
              </div>

              {/* Résumé économie */}
              {duration > 1 && (
                <div className="bg-[#F0FDF4] border border-green-200 rounded-xl p-3 mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-[#16A34A]">
                      🎉 Tu économises {discounts[duration]}%
                    </p>
                    <p className="text-xs text-[#64748B]">
                      vs {duration} × {formatPrice(basePrices.pro[currency], currency)} = {formatPrice(basePrices.pro[currency] * duration, currency)}
                    </p>
                  </div>
                  <p className="text-sm font-bold text-[#16A34A]">
                    -{formatPrice((basePrices.pro[currency] * duration) - total, currency)}
                  </p>
                </div>
              )}

              {/* Choix devise */}
              <p className="text-xs font-semibold text-[#64748B] uppercase tracking-wide mb-2">Devise</p>
              <div className="grid grid-cols-2 gap-2 mb-4">
                {[
                  { id: 'USD', label: 'Dollar', symbol: '$' },
                  { id: 'CDF', label: 'Franc congolais', symbol: 'FC' },
                ].map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setCurrency(c.id)}
                    className={`p-3 rounded-xl border-2 text-left transition-all ${
                      currency === c.id ? 'border-[#1A56DB] bg-[#EBF2FF]' : 'border-gray-200 bg-white'
                    }`}
                  >
                    <p className="text-lg font-bold text-[#1A56DB]">{c.symbol}</p>
                    <p className="text-xs font-semibold text-[#0F172A]">{c.id}</p>
                    <p className="text-xs text-[#64748B]">{c.label}</p>
                  </button>
                ))}
              </div>

              {/* Numéro téléphone */}
              <div className="mb-4">
                <label className="block text-xs font-semibold text-[#64748B] uppercase tracking-wide mb-2">
                  Numéro Mobile Money
                </label>
                <input
                  value={phone}
                  onChange={(e) => { setPhone(e.target.value); setError('') }}
                  placeholder="Ex: 0891234567"
                  className={`w-full border rounded-xl px-3 py-3 text-sm outline-none focus:border-[#1A56DB] ${
                    error ? 'border-[#DC2626]' : 'border-gray-200'
                  }`}
                />
                {(() => {
                  const operator = detectOperator(phone)
                  if (phone.length >= 4 && operator) {
                    return (
                      <div className="flex items-center gap-2 mt-2 bg-[#F0FDF4] border border-green-200 rounded-lg px-3 py-2">
                        <span className="text-xs font-semibold" style={{ color: operator.color }}>
                          📱 {operator.name} détecté ✅
                        </span>
                      </div>
                    )
                  }
                  if (phone.length >= 4 && !operator) {
                    return (
                      <p className="text-xs text-[#DC2626] mt-1">❌ Opérateur non reconnu</p>
                    )
                  }
                  return <p className="text-xs text-[#64748B] mt-1">Airtel, Orange et M-Pesa </p>
                })()}
              </div>

              <button
                onClick={handleInitiatePayment}
                disabled={loading}
                className="w-full bg-[#1A56DB] text-white rounded-xl py-3 font-semibold text-sm mb-3 disabled:opacity-50"
              >
                {loading
                  ? 'Envoi de la demande...'
                  : `Payer ${formatPrice(total, currency)} pour ${duration} mois`
                }
              </button>

              <button
                onClick={() => navigate('/')}
                className="w-full bg-[#EBF2FF] text-[#1A56DB] rounded-xl py-3 font-medium text-sm"
              >
                ← Retour au dashboard
              </button>
            </>
          )}

          {step === 'verify' && (
            <>
              <div className="bg-[#FFFBEB] border border-yellow-200 rounded-xl p-4 mb-4">
                <p className="text-[#B45309] font-bold text-sm mb-1">⏳ Demande envoyée</p>
                <p className="text-[#B45309] text-xs">Entre ton code PIN sur ton téléphone pour confirmer.</p>
              </div>

              <div className="bg-white border border-gray-200 rounded-xl p-3 mb-4">
                <p className="text-xs text-[#64748B] mb-1">Récapitulatif</p>
                <p className="text-sm font-bold text-[#0F172A]">Pro — {duration} mois</p>
                <p className="text-sm font-bold text-[#1A56DB]">{formatPrice(total, currency)} total</p>
                {duration > 1 && (
                  <p className="text-xs text-[#16A34A]">🎉 {discounts[duration]}% de réduction appliquée</p>
                )}
              </div>

              <div className="bg-[#EBF2FF] border border-blue-200 rounded-xl p-4 mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 border-2 border-[#1A56DB] border-t-transparent rounded-full animate-spin flex-shrink-0"></div>
                  <div>
                    <p className="text-xs text-[#1A56DB] font-semibold">Activation automatique en cours</p>
                    <p className="text-xs text-[#64748B] mt-0.5">Dès que tu confirmes le PIN, ton plan sera activé</p>
                  </div>
                </div>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4">
                  <p className="text-xs text-[#DC2626] font-medium">{error}</p>
                </div>
              )}

              <button
                onClick={() => { setStep('choice'); setError(''); setCurrentReference(null) }}
                disabled={retryDisabled}
                className="w-full bg-white border border-gray-200 text-[#64748B] rounded-xl py-3 font-medium text-sm mb-2 disabled:opacity-50"
              >
                {retryDisabled ? 'Attends quelques secondes...' : 'Réessayer avec un autre numéro'}
              </button>

              <button
                onClick={() => navigate('/')}
                className="w-full bg-[#EBF2FF] text-[#1A56DB] rounded-xl py-3 font-medium text-sm"
              >
                ← Retour au dashboard
              </button>
            </>
          )}

          {step === 'success' && (
            <div className="text-center py-4">
              <p className="text-4xl mb-4">🎉</p>
              <p className="text-lg font-bold text-[#0F172A] mb-2">
                {hasActivePlan ? 'Abonnement renouvelé !' : 'Bienvenue dans TekaBien Pro !'}
              </p>
              <p className="text-sm text-[#16A34A] font-medium mb-1">
                {duration} mois activés
                {duration > 1 && ` — ${discounts[duration]}% de réduction appliquée`}
              </p>
              <p className="text-sm text-[#64748B]">Redirection vers ton dashboard...</p>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}