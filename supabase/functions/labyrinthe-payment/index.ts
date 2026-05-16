import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const LABYRINTHE_BASE_URL = 'https://api.labyrinthe-rdc.com/api/V1'
const LABYRINTHE_TOKEN = Deno.env.get('LABYRINTHE_TOKEN')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const WEBHOOK_SECRET = Deno.env.get('WEBHOOK_SECRET')
const CALLBACK_URL = `${SUPABASE_URL}/functions/v1/payment-callback?secret=${WEBHOOK_SECRET}`

// Prix par plan, devise et durée (en mois)
const PLAN_PRICES = {
  pro: {
    USD: { 1: 0.1, 3: 0.27, 6: 0.51, 12: 0.96 },
    CDF: { 1: 280, 3: 756, 6: 1428, 12: 2688 },
  },
  business: {
    USD: { 1: 0.2, 3: 0.54, 6: 1.02, 12: 1.92 },
    CDF: { 1: 560, 3: 1512, 6: 2856, 12: 5376 },
  },
}

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://tekabien.vercel.app',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    const { action, phone, plan, currency, duration = 1 } = body

    if (action === 'pay') {

      const authHeader = req.headers.get('Authorization')
      if (!authHeader) {
        return new Response(JSON.stringify({ success: false, message: 'Non authentifié' }), {
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
        return new Response(JSON.stringify({ success: false, message: 'Token invalide' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401,
        })
      }

      const userId = user.id

      if (!plan || !PLAN_PRICES[plan]) {
        return new Response(JSON.stringify({ success: false, message: 'Plan invalide' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        })
      }

      if (!currency || !['USD', 'CDF'].includes(currency)) {
        return new Response(JSON.stringify({ success: false, message: 'Devise invalide' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        })
      }

      const validDurations = [1, 3, 6, 12]
      if (!validDurations.includes(parseInt(duration))) {
        return new Response(JSON.stringify({ success: false, message: 'Durée invalide' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        })
      }

      const serverAmount = PLAN_PRICES[plan][currency][parseInt(duration)]

      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      )

      const { data: userData } = await supabase
        .from('users')
        .select('plan, plan_expires')
        .eq('id', userId)
        .single()

      if (!userData) {
        return new Response(JSON.stringify({ success: false, message: 'Utilisateur introuvable' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 404,
        })
      }

      // Rate limiting — max 3 tentatives en 10 minutes
      const { data: recentPayments } = await supabase
        .from('payments')
        .select('id')
        .eq('user_id', userId)
        .gte('created_at', new Date(Date.now() - 10 * 60 * 1000).toISOString())

      if (recentPayments && recentPayments.length >= 3) {
        return new Response(JSON.stringify({
          success: false,
          message: 'Trop de tentatives — attends 10 minutes avant de réessayer'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 429,
        })
      }

      const payloadToLabyrinthe = {
        token: LABYRINTHE_TOKEN,
        phone,
        amount: serverAmount,
        currency,
        country: 'CD',
        callback: CALLBACK_URL,
      }

      console.log('=== Paiement initié — plan:', plan, 'duration:', duration, 'currency:', currency, 'amount:', serverAmount, '===')

      const response = await fetch(`${LABYRINTHE_BASE_URL}/payment/mobile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payloadToLabyrinthe),
      })

      const data = await response.json()

      console.log('Réponse Labyrinthe — success:', data?.success, 'orderNumber:', data?.orderNumber)

      if (data?.success) {
        await supabase.from('payments').insert({
          user_id: userId,
          reference: data.orderNumber,
          order_number: data.orderNumber,
          plan,
          amount: serverAmount,
          currency,
          duration: parseInt(duration),
          status: 'pending',
        })

        return new Response(JSON.stringify({
          success: true,
          reference: data.orderNumber,
          orderNumber: data.orderNumber,
          message: data.message,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        })
      }

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: response.status,
      })
    }

    return new Response(JSON.stringify({ error: 'Action non reconnue' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })

  } catch (error) {
    console.log('Erreur:', String(error))
    return new Response(JSON.stringify({ error: String(error) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})