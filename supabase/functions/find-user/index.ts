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

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token)

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Token invalide' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      })
    }

    const { email } = await req.json()

    if (!email) {
      return new Response(JSON.stringify({ error: 'Email requis' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // Chercher par email via listUsers
    const { data: listData, error: listError } = await supabaseAdmin.auth.admin.listUsers({
      perPage: 1000,
    })

    console.log('listUsers error:', listError, 'total:', listData?.users?.length)

    const targetAuthUser = listData?.users?.find(
      u => u.email?.toLowerCase() === email.toLowerCase()
    )

    console.log('targetAuthUser found:', !!targetAuthUser, targetAuthUser?.id)

    if (!targetAuthUser) {
      return new Response(JSON.stringify({ found: false }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    // Récupérer le profil
    const { data: targetProfile } = await supabaseAdmin
      .from('users')
      .select('id, shop_name, phone')
      .eq('id', targetAuthUser.id)
      .single()

    console.log('targetProfile:', JSON.stringify(targetProfile))

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
    console.log('Erreur:', String(error))
    return new Response(JSON.stringify({ error: String(error) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})