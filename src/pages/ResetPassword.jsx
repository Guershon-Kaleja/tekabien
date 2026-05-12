import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function ResetPassword() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [validSession, setValidSession] = useState(false)

  useEffect(() => {
    supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setValidSession(true)
      }
    })
  }, [])

  const handleReset = async () => {
    if (!password || password.length < 6) {
      setError('Le mot de passe doit avoir au moins 6 caractères')
      return
    }
    if (password !== confirm) {
      setError('Les mots de passe ne correspondent pas')
      return
    }
    setError('')
    setLoading(true)

    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      setError('Erreur — réessaie ou demande un nouveau lien')
    } else {
      setSuccess(true)
      setTimeout(() => navigate('/'), 3000)
    }

    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-[#EEF2F7] flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">

        <div className="bg-[#1A56DB] p-6 text-center">
          <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <span className="text-4xl">{success ? '✅' : '🔑'}</span>
          </div>
          <h1 className="text-white font-bold text-xl">
            {success ? 'Mot de passe mis à jour !' : 'Nouveau mot de passe'}
          </h1>
          <p className="text-blue-200 text-sm mt-1">
            {success ? 'Redirection vers le dashboard...' : 'Entre ton nouveau mot de passe'}
          </p>
        </div>

        <div className="p-6">
          {success ? (
            <div className="text-center py-4">
              <p className="text-sm text-[#64748B]">
                Tu vas être redirigé vers ton dashboard dans quelques secondes.
              </p>
            </div>
          ) : (
            <>
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4">
                  <p className="text-xs text-[#DC2626]">{error}</p>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#64748B] uppercase tracking-wide mb-2">
                    Nouveau mot de passe
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setError('') }}
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
                    value={confirm}
                    onChange={(e) => { setConfirm(e.target.value); setError('') }}
                    placeholder="Répète ton mot de passe"
                    className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm outline-none focus:border-[#1A56DB]"
                  />
                </div>
              </div>

              <button
                onClick={handleReset}
                disabled={loading}
                className="w-full bg-[#1A56DB] text-white rounded-xl py-3 font-semibold text-sm mt-5 disabled:opacity-50"
              >
                {loading ? 'Mise à jour...' : 'Mettre à jour le mot de passe'}
              </button>

              <button
                onClick={() => navigate('/login')}
                className="w-full bg-white border border-gray-200 text-[#64748B] rounded-xl py-3 font-medium text-sm mt-2"
              >
                Retour à la connexion
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}