import { useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

const TIMEOUT = 30 * 60 * 1000 // 30 minutes

export default function useAutoLogout() {
  const timer = useRef(null)

  const resetTimer = () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      await supabase.auth.signOut()
      window.location.href = '/login'
    }, TIMEOUT)
  }

  useEffect(() => {
    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart']
    events.forEach(e => window.addEventListener(e, resetTimer))
    resetTimer()

    return () => {
      events.forEach(e => window.removeEventListener(e, resetTimer))
      if (timer.current) clearTimeout(timer.current)
    }
  }, [])
}