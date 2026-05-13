import { supabase } from './supabase'

const FUNCTION_URL = `https://qoeextvpjhgqjrnzwkcj.supabase.co/functions/v1/labyrinthe-payment`

const getHeaders = async () => {
  const { data: { session } } = await supabase.auth.getSession()
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session?.access_token || ''}`,
    'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
  }
}

export const initiatePayment = async ({ phone, amount, currency = 'USD', plan }) => {
  try {
    const cleanPhone = phone
      .replace(/\s/g, '')
      .replace('+243', '0')
      .replace('+', '')

    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user
    if (!user) throw new Error('Utilisateur non connecté')

    const headers = await getHeaders()

    const payload = {
      action: 'pay',
      phone: cleanPhone,
      amount: parseFloat(amount),
      currency,
      plan,
      userId: user.id,
    }

    console.log('Payload envoyé:', payload)

    const response = await fetch(FUNCTION_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    })

    const data = await response.json()
    console.log('Réponse complète:', data)

    if (data?.success) {
      await supabase.from('payments').insert({
        user_id: user.id,
        reference: data.reference,
        order_number: data.orderNumber,
        plan,
        amount: parseFloat(amount),
        currency,
        status: 'pending',
      })

      return {
        success: true,
        reference: data.reference,
        orderNumber: data.orderNumber,
        message: data.message,
      }
    }

    return {
      success: false,
      error: data?.message || 'Erreur de paiement',
      errors: data?.errors,
    }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

export const checkPaymentStatus = async (reference) => {
  try {
    const { data, error } = await supabase
      .from('payments')
      .select('status')
      .eq('reference', reference)
      .single()

    if (error) throw new Error(error.message)

    return {
      success: true,
      paid: data?.status === 'completed',
      failed: data?.status === 'failed',
      pending: data?.status === 'pending',
    }
  } catch (err) {
    return { success: false, paid: false, error: err.message }
  }
}