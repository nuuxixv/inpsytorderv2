import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.43.0'
import { corsHeaders } from '../_shared/cors.ts'

// ─── 원샷 API 설정 (환경변수로 관리) ───────────────────────────
// TODO: 원샷 고객센터에서 받은 후 Supabase 환경변수에 등록
// supabase secrets set ONESHOT_API_KEY=...
// supabase secrets set ONESHOT_API_URL=...
const ONESHOT_API_KEY = Deno.env.get('ONESHOT_API_KEY')
const ONESHOT_API_URL = Deno.env.get('ONESHOT_API_URL')  // ex) https://api.one-shot.co.kr/alimtalk/send
const FRONTEND_URL = Deno.env.get('FRONTEND_URL') ?? 'https://inpsytorder.vercel.app'

// 카카오 알림톡 템플릿 코드 (원샷 관리자에서 확인)
const TEMPLATE_CODE = 'inpsytorder_order1'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  try {
    const { order_id } = await req.json()
    if (!order_id) {
      return new Response(JSON.stringify({ error: 'order_id is required' }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
        status: 400,
      })
    }

    // 1. 주문 정보 조회
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, customer_name, phone_number, is_on_site_sale, access_token, events(name)')
      .eq('id', order_id)
      .single()

    if (orderError || !order) {
      return new Response(JSON.stringify({ error: '주문을 찾을 수 없습니다.' }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
        status: 404,
      })
    }

    // 2. 현장 수령 주문은 알림톡 발송 안 함
    if (order.is_on_site_sale) {
      return new Response(JSON.stringify({ skipped: true, reason: '현장 수령 주문' }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
        status: 200,
      })
    }

    // 3. 발송에 필요한 변수 구성
    const recipientPhone = order.phone_number?.replace(/-/g, '') ?? ''
    const customerName = order.customer_name ?? ''
    const eventName = order.events?.name ?? ''
    const statusUrl = `${FRONTEND_URL}/order/status/${order.access_token}`

    if (!recipientPhone) {
      return new Response(JSON.stringify({ error: '수신자 연락처가 없습니다.' }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
        status: 400,
      })
    }

    // 4. 원샷 API 호출
    // TODO: 원샷 API 명세 확인 후 아래 payload 구조 수정 필요
    if (!ONESHOT_API_KEY || !ONESHOT_API_URL) {
      console.error('ONESHOT_API_KEY 또는 ONESHOT_API_URL 환경변수 미설정')
      return new Response(JSON.stringify({ error: '알림톡 API 설정이 완료되지 않았습니다.' }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
        status: 503,
      })
    }

    const apiResponse = await fetch(ONESHOT_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // TODO: 원샷 인증 방식에 맞게 수정 (API Key 방식 또는 Basic Auth 등)
        'Authorization': `Bearer ${ONESHOT_API_KEY}`,
      },
      body: JSON.stringify({
        // TODO: 원샷 알림톡 발송 파라미터 명세에 맞게 수정
        template_code: TEMPLATE_CODE,
        recipient_no: recipientPhone,
        template_parameter: {
          NAME: customerName,
          SYMPO: eventName,
          URL: statusUrl,
        },
      }),
    })

    if (!apiResponse.ok) {
      const errorBody = await apiResponse.text()
      console.error('원샷 API 오류:', errorBody)
      return new Response(JSON.stringify({ error: '알림톡 발송 실패', detail: errorBody }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
        status: 502,
      })
    }

    // 5. 발송 성공 시 이력 기록
    await supabase
      .from('orders')
      .update({ alimtalk_sent_at: new Date().toISOString() })
      .eq('id', order_id)

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
      status: 200,
    })

  } catch (err: any) {
    console.error('send-alimtalk error:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
      status: 500,
    })
  }
})
