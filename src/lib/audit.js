import { supabase } from './supabase'

export const logAction = async (action, targetUserId = null, details = null) => {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  await supabase.from('audit_logs').insert({
    admin_id: user.id,
    action,
    target_user_id: targetUserId,
    details,
  })
}