import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.43.0'
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req) => {

  // OPTIONS 요청 처리 (가장 먼저 실행)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // 실제 요청 본문 파싱
  const parsedBody = await req.json()
  const {
    customer_name,
    phone_number,
    shipping_address,
    inpsyt_id,
    customer_request,
    cart, // Array of { product_id, quantity }
    event_id,
  } = parsedBody
  // 현장구매 여부 — 미전송(구 프론트) 대비 안전 기본값 false
  const is_on_site_sale = parsedBody.is_on_site_sale ?? false

  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  try {
    // 1. Fetch products, event details, and site settings for server-side calculation
    const { data: settings, error: settingsError } = await supabaseClient
      .from('site_settings')
      .select('free_shipping_threshold, shipping_cost')
      .single()
    
    if (settingsError) {
      console.error('Settings fetch error:', settingsError)
    }

    const productIds = cart.map((item: any) => item.product_id)

    // is_active 를 함께 조회 (판매중지 상품 우회 주문 차단).
    // is_active 컬럼이 없는 환경(마이그레이션 미적용)에서는 select 실패 → 필터 없이 재조회하여 기존 동작 보존.
    let products: any[] | null = null
    let hasIsActive = true

    const withActive = await supabaseClient
      .from('products')
      .select('id, name, product_code, category, list_price, is_discountable, is_active')
      .in('id', productIds)

    if (withActive.error) {
      // is_active 컬럼 부재 등으로 실패 시 graceful fallback (회귀 0)
      console.warn('is_active select 실패 — 필터 스킵 fallback:', withActive.error.message)
      hasIsActive = false
      const { data: fallbackProducts, error: fallbackError } = await supabaseClient
        .from('products')
        .select('id, name, product_code, category, list_price, is_discountable')
        .in('id', productIds)
      if (fallbackError) throw fallbackError
      products = fallbackProducts
    } else {
      products = withActive.data
    }

    // is_active=false 상품이 하나라도 있으면 전체 거부 (부분 주문 금지)
    if (hasIsActive) {
      const hasInactive = products?.some((p) => p.is_active === false)
      if (hasInactive) {
        return new Response(
          JSON.stringify({
            error: '판매중지된 상품이 포함되어 있습니다. 장바구니를 확인해 주세요.',
          }),
          {
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
            status: 400,
          }
        )
      }
    }

    const { data: event, error: eventError } = await supabaseClient
      .from('events')
      .select('id, name, discount_rate')
      .eq('id', event_id)
      .single()
    if (eventError) throw eventError

    const discountRate = event ? event.discount_rate : 0

    // 2. Recalculate costs on the server-side
    let totalOriginalPrice = 0
    let totalDiscountedPrice = 0

    cart.forEach((item: any) => {
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

    const SHIPPING_FEE = settings?.shipping_cost ?? 3000
    const FREE_SHIPPING_THRESHOLD = settings?.free_shipping_threshold ?? 30000

    const totalDiscountAmount = totalOriginalPrice - totalDiscountedPrice
    // 현장구매는 배송이 없으므로 배송비 무조건 0. 그 외에는 정가 기준 무료배송 임계치 로직 유지.
    const shippingCost = is_on_site_sale
      ? 0
      : totalOriginalPrice >= FREE_SHIPPING_THRESHOLD || totalOriginalPrice === 0
        ? 0
        : SHIPPING_FEE
    const finalCost = totalDiscountedPrice + shippingCost

    // 3. Insert order and order items
    const { data: newOrder, error: orderError } = await supabaseClient
      .from('orders')
      .insert({
        customer_name,
        phone_number,
        shipping_address,
        inpsyt_id,
        customer_request,
        total_cost: totalOriginalPrice,
        discount_amount: totalDiscountAmount,
        delivery_fee: shippingCost,
        final_payment: finalCost,
        is_on_site_sale,
        event_id,
        status_history: [{ status: 'pending', changed_at: new Date().toISOString() }],
      })
      .select()
      .single()

    if (orderError) throw orderError

    const orderItemsData = cart.map((item: any) => {
      const product = products.find((p) => p.id === item.product_id)
      const originalPrice = product ? product.list_price : 0
      const priceAtPurchase = product.is_discountable
        ? Math.round(originalPrice * (1 - discountRate))
        : (product ? originalPrice : 0)

      return {
        order_id: newOrder.id,
        product_id: item.product_id,
        quantity: item.quantity,
        price_at_purchase: priceAtPurchase,
        product_name: product?.name || null,
        product_code: product?.product_code || null,
        category: product?.category || null,
        list_price: product?.list_price || null,
      }
    })

    const { error: itemsError } = await supabaseClient
      .from('order_items')
      .insert(orderItemsData)

    if (itemsError) throw itemsError

    // 4. 알림톡 연동 예정 (카카오 비즈 채널 심사 통과 후 구현)

    return new Response(JSON.stringify({ success: true, order: newOrder }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
      status: 200,
    })
  } catch (error: any) {
    console.error('Error creating order:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
      status: 500,
    })
  }
})
