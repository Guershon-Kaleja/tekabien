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
    console.log('OrderNumber:', orderNumber)

    // Status 2 = Succès selon la documentation
    if (statusCode === 2 && reference) {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      )

      // Chercher la transaction en attente par référence
      const { data: pendingPayment } = await supabase
        .from('payments')
        .select('*')
        .eq('reference', reference)
        .eq('status', 'pending')
        .single()

      console.log('Paiement trouvé:', JSON.stringify(pendingPayment))

      if (pendingPayment) {
        const expires = new Date()
        expires.setMonth(expires.getMonth() + 1)

        // Activer le plan
        await supabase
          .from('users')
          .update({
            plan: pendingPayment.plan,
            plan_expires: expires.toISOString()
          })
          .eq('id', pendingPayment.user_id)

        // Marquer le paiement comme complété
        await supabase
          .from('payments')
          .update({ status: 'completed', order_number: orderNumber })
          .eq('reference', reference)

        console.log('Plan activé pour user:', pendingPayment.user_id)
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