import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.43.0'
import { corsHeaders } from '../_shared/cors.ts'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const FRONTEND_URL = Deno.env.get('FRONTEND_URL') ?? 'https://inpsytorder.vercel.app'

serve(async (req) => {

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
    // 1. Fetch products, event details, and site settings for server-side calculation
    const { data: settings, error: settingsError } = await supabaseClient
      .from('site_settings')
      .select('free_shipping_threshold, shipping_cost')
      .single()
    
    if (settingsError) {
      console.error('Settings fetch error:', settingsError)
    }

    const { data: products, error: productsError } = await supabaseClient
      .from('products')
      .select('id, list_price, is_discountable')
      .in(
        'id',
        cart.map((item: any) => item.product_id)
      )
    if (productsError) throw productsError

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
    const shippingCost =
      totalOriginalPrice >= FREE_SHIPPING_THRESHOLD || totalOriginalPrice === 0
        ? 0
        : SHIPPING_FEE
    const finalCost = totalDiscountedPrice + shippingCost

    // 3. Insert order and order items
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
      }
    })

    const { error: itemsError } = await supabaseClient
      .from('order_items')
      .insert(orderItemsData)

    if (itemsError) throw itemsError

    // 4. 접수 확인 이메일 발송 (이메일이 있고 Resend 키가 있을 때만)
    if (email && RESEND_API_KEY) {
      const statusUrl = `${FRONTEND_URL}/order/status/${newOrder.id}`
      const eventName = event?.name ?? ''

      const emailHtml = `<!DOCTYPE html>
<html lang="ko">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f5f6f8;font-family:-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo','Noto Sans KR',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f6f8;padding:40px 20px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:16px;overflow:hidden;">
        <!-- 헤더 -->
        <tr>
          <td style="background:#2B398F;padding:32px 40px;text-align:center;">
            <p style="margin:0;color:rgba(255,255,255,0.7);font-size:13px;">${eventName}</p>
            <h1 style="margin:8px 0 0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.02em;">주문이 접수되었습니다</h1>
          </td>
        </tr>
        <!-- 본문 -->
        <tr>
          <td style="padding:36px 40px;">
            <p style="margin:0 0 8px;font-size:16px;color:#1a1a1a;">안녕하세요, <strong>${customer_name}</strong>님.</p>
            <p style="margin:0 0 24px;font-size:14px;color:#666;line-height:1.7;">
              주문이 성공적으로 접수되었습니다.<br>
              담당자에게 카드를 건네어 결제를 완료해주세요.
            </p>
            <!-- 금액 요약 -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f9ff;border-radius:10px;padding:16px;margin-bottom:28px;">
              <tr>
                <td style="font-size:13px;color:#666;padding:4px 16px;">최종 결제금액</td>
                <td style="font-size:16px;font-weight:700;color:#2B398F;text-align:right;padding:4px 16px;">${finalCost.toLocaleString()}원</td>
              </tr>
            </table>
            <!-- CTA 버튼 -->
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center">
                  <a href="${statusUrl}"
                     style="display:inline-block;background:#2B398F;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;padding:16px 40px;border-radius:12px;letter-spacing:-0.01em;">
                    주문 내역 확인하기
                  </a>
                </td>
              </tr>
            </table>
            <p style="margin:20px 0 0;font-size:12px;color:#aaa;text-align:center;line-height:1.6;">
              이 링크를 저장해두시면 언제든지 주문 상태를 확인하실 수 있습니다.
            </p>
          </td>
        </tr>
        <!-- 푸터 -->
        <tr>
          <td style="padding:20px 40px;border-top:1px solid #f0f0f0;text-align:center;">
            <p style="margin:0;font-size:11px;color:#bbb;">인싸이트 / 학지사 · 문의는 담당 부스로 문의해주세요.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

      // 이메일 발송 실패해도 주문 자체는 성공 처리 (fire-and-forget)
      fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: 'onboarding@resend.dev',
          to: email,
          subject: `[인싸이트] 주문이 접수되었습니다`,
          html: emailHtml,
        }),
      }).then(async (res) => {
        if (res.ok) {
          await supabaseClient.from('orders').update({ is_email_sent: true }).eq('id', newOrder.id)
        } else {
          const err = await res.json()
          console.error('Resend error:', err)
        }
      }).catch((err) => {
        console.error('Email send failed (non-blocking):', err)
      })
    }

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
