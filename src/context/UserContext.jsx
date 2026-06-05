import { createContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const UserContext = createContext(null)

export function UserProvider({ children }) {
  const [userPlan, setUserPlan] = useState(null)
  const [planExpires, setPlanExpires] = useState(null)
  const [currency, setCurrency] = useState('FC')
  const [shopName, setShopName] = useState('')
  const [userId, setUserId] = useState(null)
  const [role, setRole] = useState(null)

  useEffect(() => {
    const loadUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)

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

      setUserPlan(data.plan)
      setPlanExpires(data.plan_expires)
      setCurrency(data.currency || 'FC')
      setShopName(data.shop_name || '')
      setRole(data.role)
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