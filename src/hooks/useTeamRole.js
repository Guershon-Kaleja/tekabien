import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function useTeamRole() {
  const [teamRole, setTeamRole] = useState('owner')
  const [ownerId, setOwnerId] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchRole = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from('users')
        .select('team_role, owner_id')
        .eq('id', user.id)
        .single()

      if (data) {
        setTeamRole(data.team_role || 'owner')
        setOwnerId(data.owner_id)
      }
      setLoading(false)
    }
    fetchRole()
  }, [])

  const isOwner = teamRole === 'owner'
  const isStaff = teamRole === 'staff'

  // L'ID à utiliser pour les requêtes — si employé, utilise l'ID du patron
  const effectiveUserId = isStaff ? ownerId : null

  return { teamRole, ownerId, isOwner, isStaff, effectiveUserId, loading }
}