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
    const body = await req.json()
    console.log('=== Callback Labyrinthe reçu ===')
    console.log('Body:', JSON.stringify(body))

    const statusCode = body?.results?.status?.code
    const reference = body?.reference
    const orderNumber = body?.orderNumber

    console.log('Status code:', statusCode)
    console.log('Reference:', reference)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    if (reference) {
      if (statusCode === 2) {
        // Paiement réussi
        const { data: payment } = await supabase
          .from('payments')
          .select('*')
          .eq('reference', reference)
          .single()

        console.log('Payment trouvé:', JSON.stringify(payment))

        if (payment) {
          // Mettre à jour le statut du paiement
          await supabase
            .from('payments')
            .update({ status: 'completed', order_number: orderNumber })
            .eq('reference', reference)

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

          // Activer le plan
          await supabase
            .from('users')
            .update({
              plan: payment.plan,
              plan_expires: expires.toISOString()
            })
            .eq('id', payment.user_id)

          console.log('Plan activé pour user:', payment.user_id)
        }
      } else if (statusCode === 3) {
        // Paiement échoué
        await supabase
          .from('payments')
          .update({ status: 'failed' })
          .eq('reference', reference)

        console.log('Paiement échoué pour reference:', reference)
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.log('Erreur callback:', String(error))
    return new Response(JSON.stringify({ error: String(error) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})