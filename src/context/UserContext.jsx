import { createContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const UserContext = createContext(null)
const PROFILE_CACHE_KEY = 'tb_user_profile'

export function UserProvider({ children }) {
  const [userPlan, setUserPlan] = useState(null)
  const [planExpires, setPlanExpires] = useState(null)
  const [currency, setCurrency] = useState('FC')
  const [shopName, setShopName] = useState('')
  const [userId, setUserId] = useState(null)
  const [role, setRole] = useState(null)

  const applyProfile = (data) => {
    setUserPlan(data.plan)
    setPlanExpires(data.plan_expires)
    setCurrency(data.currency || 'FC')
    setShopName(data.shop_name || '')
    setRole(data.role)
  }

  useEffect(() => {
    const loadUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)

      // Affiche immédiatement le profil depuis le cache local
      const cached = localStorage.getItem(PROFILE_CACHE_KEY)
      if (cached) {
        try {
          const profile = JSON.parse(cached)
          if (profile.id === user.id) applyProfile(profile)
        } catch {}
      }

      // Tente de rafraîchir depuis Supabase
      let { data } = await supabase
        .from('users')
        .select('plan, plan_expires, currency, shop_name, role')
        .eq('id', user.id)
        .single()

      if (!data) {
        const defaultExpires = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
        await supabase.from('users').insert({
          id: user.id,
          email: user.email,
          shop_name: '',
          phone: '',
          role: 'user',
          plan: 'trial',
          plan_expires: defaultExpires,
          currency: 'FC',
        })
        data = { plan: 'trial', plan_expires: defaultExpires, currency: 'FC', shop_name: '', role: 'user' }
      }

      applyProfile(data)
      localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify({ ...data, id: user.id }))
    }

    loadUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      loadUser()
    })

    return () => subscription.unsubscribe()
  }, [])

  return (
    <UserContext.Provider value={{ userPlan, planExpires, currency, setCurrency, shopName, userId, role, setUserPlan, setPlanExpires }}>
      {children}
    </UserContext.Provider>
  )
}

export { UserContext }