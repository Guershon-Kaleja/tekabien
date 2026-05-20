import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://tekabien-admin.vercel.app',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Non autorisé' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    )
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Non autorisé' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      })
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )
    const { data: userData } = await supabaseAdmin
      .from('users').select('role').eq('id', user.id).single()
    if (userData?.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Accès refusé' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      })
    }

    const { action, userId, plan, months = 1 } = await req.json()

    // Validation UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!userId || !uuidRegex.test(userId)) {
      return new Response(JSON.stringify({ error: 'userId invalide' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    // Validation action
    if (!['activate', 'disable'].includes(action)) {
      return new Response(JSON.stringify({ error: 'Action invalide' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    if (action === 'activate') {
      const validPlans = ['pro', 'trial', 'free']
      const validMonths = [1, 3, 6, 12]

      if (!validPlans.includes(plan)) {
        return new Response(JSON.stringify({ error: 'Plan invalide' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        })
      }

      if (plan !== 'trial' && !validMonths.includes(parseInt(months))) {
        return new Response(JSON.stringify({ error: 'Durée invalide' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        })
      }

      const expires = new Date()
      if (plan === 'trial') {
        
        expires.setDate(expires.getDate() + 14)
      } else {
        expires.setMonth(expires.getMonth() + parseInt(months))
      }

      await supabaseAdmin.from('users')
        .update({ plan, plan_expires: expires.toISOString() })
        .eq('id', userId)
    }

    if (action === 'disable') {
      await supabaseAdmin.from('users')
        .update({ plan: 'free' })
        .eq('id', userId)
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})