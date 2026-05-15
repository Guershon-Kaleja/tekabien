import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const LABYRINTHE_BASE_URL = 'https://api.labyrinthe-rdc.com/api/V1'
const LABYRINTHE_TOKEN = Deno.env.get('LABYRINTHE_TOKEN')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const WEBHOOK_SECRET = Deno.env.get('WEBHOOK_SECRET')
const CALLBACK_URL = `${SUPABASE_URL}/functions/v1/payment-callback?secret=${WEBHOOK_SECRET}`

// Montants fixes côté serveur — ne peuvent pas être modifiés par le frontend
const PLAN_PRICES = {
  pro: { USD: 0.1, CDF: 280 },
  business: { USD: 0.2, CDF: 560 },
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
    const { action, phone, plan, currency } = body

    console.log('=== TekaBien Payment Function ===')
    console.log('Action:', action)

    if (action === 'pay') {

      // Extraire userId depuis le JWT — pas depuis le body
      const authHeader = req.headers.get('Authorization')
      if (!authHeader) {
        return new Response(JSON.stringify({
          success: false,
          message: 'Non authentifié'
        }), {
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
        return new Response(JSON.stringify({
          success: false,
          message: 'Token invalide'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401,
        })
      }

      const userId = user.id
      console.log('UserId depuis JWT:', userId)

      // Vérifier que le plan est valide
      if (!plan || !PLAN_PRICES[plan]) {
        return new Response(JSON.stringify({
          success: false,
          message: 'Plan invalide'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        })
      }

      // Vérifier que la devise est valide
      if (!currency || !['USD', 'CDF'].includes(currency)) {
        return new Response(JSON.stringify({
          success: false,
          message: 'Devise invalide'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        })
      }

      // Calculer le montant côté serveur — ignore le montant du frontend
      const serverAmount = PLAN_PRICES[plan][currency]
      console.log('Montant serveur:', serverAmount, currency, 'pour plan:', plan)

      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      )

      // Vérifier que l'utilisateur existe
      const { data: userData } = await supabase
        .from('users')
        .select('plan, plan_expires')
        .eq('id', userId)
        .single()

      if (!userData) {
        return new Response(JSON.stringify({
          success: false,
          message: 'Utilisateur introuvable'
        }), {
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

      console.log('Recent payments:', recentPayments?.length)

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

      console.log('Payload vers Labyrinthe:', JSON.stringify(payloadToLabyrinthe))

      const response = await fetch(`${LABYRINTHE_BASE_URL}/payment/mobile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payloadToLabyrinthe),
      })

      const data = await response.json()

      console.log('Réponse Labyrinthe RAW:', JSON.stringify(data))

      if (data?.success) {
        // Stocker le paiement avec le montant serveur — pas celui du frontend
        await supabase.from('payments').insert({
          user_id: userId,
          reference: data.orderNumber,
          order_number: data.orderNumber,
          plan,
          amount: serverAmount,
          currency,
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