import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://tekabien.vercel.app',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Rate limiting en mémoire : max 5 tentatives / 2 min par numéro
const attempts = new Map<string, { count: number; resetAt: number }>()

function isRateLimited(phone: string): boolean {
  const now = Date.now()
  const entry = attempts.get(phone)
  if (!entry || now > entry.resetAt) {
    attempts.set(phone, { count: 1, resetAt: now + 2 * 60 * 1000 })
    return false
  }
  if (entry.count >= 5) return true
  entry.count++
  return false
}

const GENERIC_ERROR = 'Numéro ou mot de passe incorrect'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { phone, password } = await req.json()

    if (!phone || !password) {
      await new Promise((r) => setTimeout(r, 500))
      return new Response(JSON.stringify({ success: false, error: GENERIC_ERROR }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      })
    }

    const cleanPhone = phone.replace(/\s/g, '').replace('+243', '0').replace('+', '')
    if (!/^\d{10}$/.test(cleanPhone) || !/^0[7-9]/.test(cleanPhone)) {
      await new Promise((r) => setTimeout(r, 500))
      return new Response(JSON.stringify({ success: false, error: GENERIC_ERROR }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      })
    }

    if (isRateLimited(cleanPhone)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Trop de tentatives — attends 2 minutes' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 429 }
      )
    }

    // Lookup email via Service Role (pas de RLS)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const { data } = await supabaseAdmin
      .from('users')
      .select('email')
      .eq('phone', cleanPhone)
      .limit(1)
      .maybeSingle()

    if (!data?.email) {
      await new Promise((r) => setTimeout(r, 500))
      return new Response(JSON.stringify({ success: false, error: GENERIC_ERROR }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      })
    }

    // Auth côté serveur — l'email n'est jamais renvoyé au client
    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    )

    const { data: authData, error: authError } = await supabaseAuth.auth.signInWithPassword({
      email: data.email,
      password,
    })

    if (authError || !authData.session) {
      await new Promise((r) => setTimeout(r, 500))
      return new Response(JSON.stringify({ success: false, error: GENERIC_ERROR }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      })
    }

    return new Response(
      JSON.stringify({
        success: true,
        access_token: authData.session.access_token,
        refresh_token: authData.session.refresh_token,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch {
    await new Promise((r) => setTimeout(r, 500))
    return new Response(JSON.stringify({ success: false, error: GENERIC_ERROR }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 401,
    })
  }
})
