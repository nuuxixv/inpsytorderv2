    import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
    import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.43.0'
    
    console.log('Hello from Functions!')
     
     serve(async (req) => {
       // CORS 헤더 정의
       const corsHeaders = {
         'Access-Control-Allow-Origin': 'http://localhost:5173', // 프론트엔드 오리진
         'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
       }
     
       // OPTIONS 요청 처리 (가장 먼저 실행)
       if (req.method === 'OPTIONS') {
         return new Response('ok', { headers: corsHeaders })
       }
     
       // 실제 요청 본문 파싱
       const {
         customer_name,
         email,
         phone_number,
         shipping_address,
         inpsyt_id,
         customer_request,
         cart, // Array of { product_id, quantity }
         event_id,
       } = await req.json()
     
       const supabaseClient = createClient(
         Deno.env.get('SUPABASE_URL') ?? '',
         Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
       )
    
       try {
         // 1. Fetch products and event details for server-side calculation
         const { data: products, error: productsError } = await supabaseClient
           .from('products')
           .select('id, list_price, is_discountable')
           .in(
             'id',
             cart.map((item) => item.product_id)
           )
         if (productsError) throw productsError
    
         const { data: event, error: eventError } = await supabaseClient
           .from('events')
           .select('id, discount_rate')
           .eq('id', event_id)
           .single()
         if (eventError) throw eventError
    
         const discountRate = event ? event.discount_rate : 0
    
         // 2. Recalculate costs on the server-side
         let totalOriginalPrice = 0
         let totalDiscountedPrice = 0
    
         cart.forEach((item) => {
           const product = products.find((p) => p.id === item.product_id)
           if (product) {
             const quantity = item.quantity || 0
             const originalPrice = product.list_price || 0
    
             totalOriginalPrice += originalPrice * quantity
    
             const discountedPrice = product.is_discountable
               ? Math.round(originalPrice * (1 - discountRate))
               : originalPrice
             totalDiscountedPrice += discountedPrice * quantity
           }
         })
    
         const SHIPPING_FEE = 3000
         const FREE_SHIPPING_THRESHOLD = 30000
    
         const totalDiscountAmount = totalOriginalPrice - totalDiscountedPrice
         const shippingCost =
           totalOriginalPrice >= FREE_SHIPPING_THRESHOLD || totalOriginalPrice === 0
             ? 0
             : SHIPPING_FEE
         const finalCost = totalDiscountedPrice + shippingCost
    
         // 3. Insert order and order items in a transaction
         const { data: newOrder, error: orderError } = await supabaseClient
           .from('orders')
           .insert({
             customer_name,
             email,
             phone_number,
             shipping_address,
             inpsyt_id,
             customer_request,
             total_cost: totalOriginalPrice,
             discount_amount: totalDiscountAmount,
             delivery_fee: shippingCost,
             final_payment: finalCost,
             is_email_sent: false,
             event_id,
           })
           .select()
           .single()
    
         if (orderError) throw orderError
    
         const orderItemsData = cart.map((item) => {
           const product = products.find((p) => p.id === item.product_id)
           const originalPrice = product ? product.list_price : 0
           const priceAtPurchase = product.is_discountable
             ? Math.round(originalPrice * (1 - discountRate))
             : originalPrice
    
           return {
             order_id: newOrder.id,
             product_id: item.product_id,
             quantity: item.quantity,
             price_at_purchase: priceAtPurchase,
           }
         })
    
         const { error: itemsError } = await supabaseClient
           .from('order_items')
           .insert(orderItemsData)
    
         if (itemsError) throw itemsError
    
         return new Response(JSON.stringify({ success: true, order: newOrder }), {
           headers: { 'Content-Type': 'application/json', ...corsHeaders }, // 여기에 corsHeaders 추가
           status: 200,
         })
       } catch (error) {
         console.error('Error creating order:', error)
         return new Response(JSON.stringify({ error: error.message }), {
           headers: { 'Content-Type': 'application/json', ...corsHeaders }, // 여기에 corsHeaders 추가
           status: 400,
         })
       }
     })