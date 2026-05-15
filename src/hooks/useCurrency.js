import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function useCurrency() {
  const [currency, setCurrency] = useState('FC')

  useEffect(() => {
    const fetchCurrency = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('users')
        .select('currency')
        .eq('id', user.id)
        .single()
      if (data?.currency) setCurrency(data.currency)
    }
    fetchCurrency()
  }, [])

  const formatAmount = (amount) => {
    if (currency === 'USD') {
      return '$' + new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)
    }
    return new Intl.NumberFormat('fr-FR').format(Math.round(amount)) + ' FC'
  }

  return { currency, formatAmount }
}