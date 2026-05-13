import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'

const LABYRINTHE_BASE_URL = 'https://api.labyrinthe-rdc.com/api/V1'
const LABYRINTHE_TOKEN = Deno.env.get('LABYRINTHE_TOKEN')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const CALLBACK_URL = `${SUPABASE_URL}/functions/v1/payment-callback`

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    const { action, phone, amount, currency } = body

    console.log('=== TekaBien Payment Function ===')
    console.log('Action:', action)
    console.log('Body reçu:', JSON.stringify(body))

    if (action === 'pay') {
      const payloadToLabyrinthe = {
        token: LABYRINTHE_TOKEN,
        phone,
        amount: parseFloat(amount),
        currency: currency || 'USD',
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
      console.log('Réponse Labyrinthe:', JSON.stringify(data))

      // Utiliser orderNumber de Labyrinthe comme référence
      if (data?.success) {
        return new Response(JSON.stringify({
          success: true,
          reference: data.orderNumber,  // on utilise orderNumber de Labyrinthe
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