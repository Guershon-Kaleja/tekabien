import { useContext } from 'react'
import { UserContext } from '../context/UserContext'

export default function useCurrency() {
  const { currency } = useContext(UserContext)

  const formatAmount = (amount) => {
    if (currency === 'USD') {
      return '$' + new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)
    }
    return new Intl.NumberFormat('fr-FR').format(Math.round(amount)) + ' FC'
  }

  return { currency, formatAmount }
}