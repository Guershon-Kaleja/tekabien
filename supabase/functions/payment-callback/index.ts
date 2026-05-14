import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  console.log('=== CALLBACK RECU ===')
  console.log('Method:', req.method)
  console.log('URL:', req.url)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const rawBody = await req.text()
    console.log('Raw body:', rawBody)
    console.log('Body length:', rawBody.length)

    let body = {}
    try {
      body = JSON.parse(rawBody)
      console.log('Parsed body:', JSON.stringify(body))
    } catch (e) {
      console.log('Parse error:', String(e))
    }

    const statusCode = parseInt(body?.results?.status?.code)
    const orderNumber = body?.orderNumber
    const reference = body?.reference

    console.log('Status code:', statusCode)
    console.log('OrderNumber:', orderNumber)
    console.log('Reference:', reference)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const identifier = orderNumber || reference
    if (!identifier) {
      console.log('Pas de référence trouvée')
      return new Response(JSON.stringify({ received: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .select('*')
      .or(`reference.eq.${identifier},order_number.eq.${identifier}`)
      .single()

    console.log('Payment trouvé:', JSON.stringify(payment))
    console.log('Payment error:', JSON.stringify(paymentError))

    if (payment && statusCode === 2) {
      await supabase
        .from('payments')
        .update({ status: 'completed', order_number: orderNumber })
        .eq('id', payment.id)

      const { data: currentUser } = await supabase
        .from('users')
        .select('plan_expires')
        .eq('id', payment.user_id)
        .single()

      const baseDate = currentUser?.plan_expires && new Date(currentUser.plan_expires) > new Date()
        ? new Date(currentUser.plan_expires)
        : new Date()

      const expires = new Date(baseDate)
      expires.setMonth(expires.getMonth() + 1)

      await supabase
        .from('users')
        .update({
          plan: payment.plan,
          plan_expires: expires.toISOString()
        })
        .eq('id', payment.user_id)

      console.log('✅ Plan activé pour user:', payment.user_id, 'plan:', payment.plan)

    } else if (payment && statusCode === 3) {
      await supabase
        .from('payments')
        .update({ status: 'failed' })
        .eq('id', payment.id)

      console.log('❌ Paiement échoué')
    } else {
      console.log('Condition non remplie — payment:', !!payment, 'statusCode:', statusCode)
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.log('Erreur callback:', String(error))
    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  }
})