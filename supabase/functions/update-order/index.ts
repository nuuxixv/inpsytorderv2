import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from './deps.ts'
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { orderId, updates, items } = await req.json()

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          persistSession: false,
        },
      }
    )

    // Call the RPC function
    const { error } = await supabaseClient.rpc('update_order_details', {
      order_id_param: orderId,
      updates_param: updates,
      items_param: items,
    })

    if (error) {
      console.error('Error calling RPC function:', error)
      throw error
    }

    return new Response(JSON.stringify({ message: 'Order updated successfully!' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    console.error('Error in update-order function:', JSON.stringify(error, null, 2))
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})