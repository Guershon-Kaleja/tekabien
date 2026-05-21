import { useEffect, useContext } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { UserContext } from '../context/UserContext'

export default function usePlanCheck() {
  const navigate = useNavigate()
  const { userId, userPlan, planExpires, role, setUserPlan } = useContext(UserContext)

  const checkPlan = async () => {
    if (!userId) return
    if (role === 'admin') return

    if (userPlan === 'disabled') {
      navigate('/expired')
      return
    }

    if ((userPlan === 'trial' || userPlan === 'pro') && planExpires) {
      const expires = new Date(planExpires)
      const gracePeriod = new Date(expires.getTime() + 3 * 24 * 60 * 60 * 1000)
      if (new Date() > gracePeriod) {
        await supabase.from('users').update({ plan: 'free' }).eq('id', userId)
        setUserPlan('free')
        return
      }
    }
  }

  useEffect(() => {
    checkPlan()
  }, [userId, userPlan])
}