import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const secret = url.searchParams.get('secret')
    const expectedSecret = Deno.env.get('WEBHOOK_SECRET')

    if (!secret || secret !== expectedSecret) {
      return new Response(JSON.stringify({ error: 'Non autorisé' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      })
    }

    const rawBody = await req.text()

    let body = {}
    try {
      body = JSON.parse(rawBody)
    } catch (e) {

    }

    const statusCode = parseInt(body?.results?.status?.code)
    const orderNumber = body?.orderNumber
    const reference = body?.reference

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const identifier = orderNumber || reference
    if (!identifier) {
     
      return new Response(JSON.stringify({ received: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    let payment = null

    const { data: byRef } = await supabase
      .from('payments')
      .select('*')
      .eq('reference', identifier)
      .maybeSingle()

    if (byRef) {
      payment = byRef
    } else {
      const { data: byOrder } = await supabase
        .from('payments')
        .select('*')
        .eq('order_number', identifier)
        .maybeSingle()
      if (byOrder) payment = byOrder
    }

    if (payment && payment.status === 'pending' && statusCode === 2) {

      await supabase
        .from('payments')
        .update({ status: 'completed', order_number: orderNumber })
        .eq('id', payment.id)

      const { data: currentUser } = await supabase
        .from('users')
        .select('plan, plan_expires')
        .eq('id', payment.user_id)
        .single()

      const now = new Date()
      const currentExpires = currentUser?.plan_expires ? new Date(currentUser.plan_expires) : null
      const baseDate = currentExpires && currentExpires > now ? currentExpires : now

      const duration = payment.duration || 1
      const expires = new Date(baseDate)
      expires.setMonth(expires.getMonth() + duration)

      await supabase
        .from('users')
        .update({
          plan: payment.plan,
          plan_expires: expires.toISOString()
        })
        .eq('id', payment.user_id)

    } else if (payment && payment.status === 'pending' && statusCode === 3) {
      await supabase
        .from('payments')
        .update({ status: 'failed' })
        .eq('id', payment.id)

    } else {
      
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    
    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  }
})