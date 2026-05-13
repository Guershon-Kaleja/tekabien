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

  // Répondre IMMÉDIATEMENT avec 200 comme demandé par Labyrinthe
  const responsePromise = new Response(JSON.stringify({ received: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status: 200,
  })

  try {
    const body = await req.json()
    console.log('=== Callback Labyrinthe reçu ===')
    console.log('Body complet:', JSON.stringify(body))

    const statusCode = body?.results?.status?.code
    const orderNumber = body?.orderNumber
    const reference = body?.reference

    console.log('Status code:', statusCode)
    console.log('OrderNumber:', orderNumber)
    console.log('Reference:', reference)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // Chercher le paiement par orderNumber OU reference
    const identifier = orderNumber || reference
    if (!identifier) {
      console.log('Pas de référence trouvée dans le callback')
      return responsePromise
    }

    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .select('*')
      .or(`reference.eq.${identifier},order_number.eq.${identifier}`)
      .single()

    console.log('Payment trouvé:', JSON.stringify(payment))
    console.log('Payment error:', JSON.stringify(paymentError))

    if (!payment) {
      console.log('Aucun paiement trouvé pour:', identifier)
      return responsePromise
    }

    if (statusCode === 2) {
      // Paiement réussi
      await supabase
        .from('payments')
        .update({ status: 'completed', order_number: orderNumber })
        .eq('id', payment.id)

      // Calculer la nouvelle date d'expiration
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

    } else if (statusCode === 3) {
      // Paiement échoué
      await supabase
        .from('payments')
        .update({ status: 'failed' })
        .eq('id', payment.id)

      console.log('❌ Paiement échoué pour:', identifier)
    }

  } catch (error) {
    console.log('Erreur callback:', String(error))
  }

  return responsePromise
})