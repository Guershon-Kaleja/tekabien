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

export const initiatePayment = async ({ phone, plan, currency = 'USD', duration = 1 }) => {
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
      plan,
      currency,
      duration: parseInt(duration) || 1,
    }

    const response = await fetch(FUNCTION_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    })

    const data = await response.json()

    if (data?.success) {
      return {
        success: true,
        reference: data.orderNumber,
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