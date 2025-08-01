import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.31.8'
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

    console.log('Received orderId:', orderId);
    console.log('Received updates:', JSON.stringify(updates, null, 2));
    console.log('Received items:', JSON.stringify(items, null, 2));

    // Update order in 'orders' table
    console.log('Attempting to update orders table...');
    const { data: updatedOrderData, error: orderError } = await supabaseClient
      .from('orders')
      .update(updates)
      .eq('id', orderId)
      .select();

    if (orderError) {
      console.error('Error updating orders table:', orderError);
      throw orderError
    }
    console.log('Successfully updated orders table:', updatedOrderData);

    // Delete existing order_items for this order
    console.log('Attempting to delete existing order items...');
    console.log('Attempting to delete existing order items for orderId:', orderId);
    const { error: deleteItemsError } = await supabaseClient
      .from('order_items')
      .delete()
      .eq('order_id', orderId)

    if (deleteItemsError) {
      console.error('Error deleting order items:', deleteItemsError);
      throw deleteItemsError
    }
    console.log('Successfully deleted existing order items.');

    // Insert new order_items
    console.log('Attempting to insert new order items:', JSON.stringify(items, null, 2));
    const { error: insertItemsError } = await supabaseClient
      .from('order_items')
      .insert(items)

    if (insertItemsError) {
      console.error('Error inserting new order items:', insertItemsError);
      throw insertItemsError
    }
    console.log('Successfully inserted new order items.');

    return new Response(JSON.stringify({ message: 'Order updated successfully!' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    console.error('Error in update-order function:', error.message)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400, // Bad Request or Internal Server Error
    })
  }
})