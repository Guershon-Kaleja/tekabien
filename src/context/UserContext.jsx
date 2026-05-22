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

      const { data } = await supabase
        .from('users')
        .select('plan, plan_expires, currency, shop_name, role')
        .eq('id', user.id)
        .single()

      if (data) {
        setUserPlan(data.plan)
        setPlanExpires(data.plan_expires)
        setCurrency(data.currency || 'FC')
        setShopName(data.shop_name || '')
        setRole(data.role)
      }
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