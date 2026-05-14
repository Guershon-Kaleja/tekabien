import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function usePlanCheck() {
  const navigate = useNavigate()

  const checkPlan = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data, error } = await supabase
      .from('users')
      .select('plan, plan_expires, role')
      .eq('id', user.id)
      .single()

    console.log('PlanCheck data:', data, 'error:', error)

    if (!data) return

    if (data.role === 'admin') return

    if (data.plan === 'disabled') {
      navigate('/expired')
      return
    }

    if ((data.plan === 'trial' || data.plan === 'pro' || data.plan === 'business') && data.plan_expires) {
      const expires = new Date(data.plan_expires)
      const gracePeriod = new Date(expires.getTime() + 3 * 24 * 60 * 60 * 1000)
      if (new Date() > gracePeriod) {
        navigate('/expired')
        return
      }
    }

    // plan === 'free' → accès au dashboard avec limites ✅
  }

  useEffect(() => {
    checkPlan()
  }, [])
}