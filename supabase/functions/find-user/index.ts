import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
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

    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    )

    // Vérifier le token
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token)

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Token invalide' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      })
    }

    // Vérifier que l'utilisateur est Business
    const { data: userData } = await supabaseAuth
      .from('users')
      .select('plan')
      .eq('id', user.id)
      .single()

    if (userData?.plan !== 'business') {
      return new Response(JSON.stringify({ error: 'Plan Business requis' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      })
    }

    const { email } = await req.json()

    if (!email) {
      return new Response(JSON.stringify({ error: 'Email requis' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    // Chercher l'utilisateur par email avec service role
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers()
    const targetAuthUser = authUsers?.users?.find(
      u => u.email?.toLowerCase() === email.toLowerCase()
    )

    if (!targetAuthUser) {
      return new Response(JSON.stringify({ found: false }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    // Récupérer les infos du profil
    const { data: targetProfile } = await supabaseAdmin
      .from('users')
      .select('id, shop_name, phone')
      .eq('id', targetAuthUser.id)
      .single()

    return new Response(JSON.stringify({
      found: true,
      user: {
        id: targetAuthUser.id,
        email: targetAuthUser.email,
        shop_name: targetProfile?.shop_name,
        phone: targetProfile?.phone,
      }
    }), {
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