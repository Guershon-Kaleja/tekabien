import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function useTeamRole() {
  const [teamRole, setTeamRole] = useState('owner')
  const [ownerId, setOwnerId] = useState(null)
  const [pendingInvite, setPendingInvite] = useState(null)
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

      if (data?.team_role === 'staff' && data?.owner_id) {
        setTeamRole('staff')
        setOwnerId(data.owner_id)
      }

      // Vérifier si invitation pending
      const { data: invite } = await supabase
        .from('team_members')
        .select(`
          id,
          status,
          role,
          owner_id,
          owner:owner_id (
            id,
            shop_name
          )
        `)
        .eq('member_id', user.id)
        .eq('status', 'pending')
        .maybeSingle()

      if (invite) setPendingInvite(invite)

      setLoading(false)
    }
    fetchRole()
  }, [])

  const acceptInvite = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !pendingInvite) return

    // Mettre à jour le statut dans team_members
    const { error: updateError } = await supabase
      .from('team_members')
      .update({ status: 'accepted' })
      .eq('id', pendingInvite.id)

    if (updateError) {
      console.error('Erreur update team_members:', updateError)
      return
    }

    // Mettre à jour le profil de l'employé
    const { error: userError } = await supabase
      .from('users')
      .update({
        owner_id: pendingInvite.owner_id,
        team_role: 'staff',
      })
      .eq('id', user.id)

    if (userError) {
      console.error('Erreur update users:', userError)
      return
    }

    setTeamRole('staff')
    setOwnerId(pendingInvite.owner_id)
    setPendingInvite(null)
    window.location.reload()
  }

  const refuseInvite = async () => {
    if (!pendingInvite) return

    await supabase
      .from('team_members')
      .update({ status: 'refused' })
      .eq('id', pendingInvite.id)

    setPendingInvite(null)
  }

  const isOwner = teamRole === 'owner'
  const isStaff = teamRole === 'staff'

  return { teamRole, ownerId, isOwner, isStaff, pendingInvite, acceptInvite, refuseInvite, loading }
}