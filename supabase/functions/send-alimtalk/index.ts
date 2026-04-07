import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.43.0'
import { corsHeaders } from '../_shared/cors.ts'

const FRONTEND_URL = Deno.env.get('FRONTEND_URL') ?? 'https://inpsytorder.vercel.app'

// 원샷 설정 (Supabase 환경변수로 관리)
// supabase secrets set ONESHOT_SENDER_KEY=799de9af7fd86b7301222f39715f012c33d8ed85
// supabase secrets set ONESHOT_CALLBACK=발신번호(원샷에 등록된 번호, 하이픈 없이)
const SENDER_KEY = Deno.env.get('ONESHOT_SENDER_KEY')
const CALLBACK = Deno.env.get('ONESHOT_CALLBACK')
const ENDPOINT = 'https://api2.msgagent.com/api/webshot/send/kakao/AT/inpsyt2'
const TEMPLATE_CODE = 'inpsytorder_paid1'

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

    // 2. 현장 수령 주문은 발송 안 함
    if (order.is_on_site_sale) {
      return new Response(JSON.stringify({ skipped: true, reason: '현장 수령 주문' }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
        status: 200,
      })
    }

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

    if (!SENDER_KEY || !CALLBACK) {
      console.error('ONESHOT_SENDER_KEY 또는 ONESHOT_CALLBACK 환경변수 미설정')
      return new Response(JSON.stringify({ error: '알림톡 API 설정이 완료되지 않았습니다.' }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
        status: 503,
      })
    }

    // 3. 템플릿 본문 (승인된 템플릿과 정확히 일치해야 함)
    const msg = `${customerName}님, 안녕하세요.\n${eventName}에서 결제가 완료되었습니다.\n\n주문 내역은 아래에서 확인하실 수 있습니다.`

    // 4. 원샷 API 호출 (multipart/form-data)
    const formData = new FormData()
    formData.append('id', 'inpsyt2')
    formData.append('PHONE', recipientPhone)
    formData.append('CALLBACK', CALLBACK)
    formData.append('MSG', msg)
    formData.append('SENDER_KEY', SENDER_KEY)
    formData.append('TEMPLATE_CODE', TEMPLATE_CODE)
    formData.append('BTN_TYPES', 'WL')           // 웹링크 버튼
    formData.append('BTN_TXTS', '주문내역 확인하기')
    formData.append('BTN_URLS1', statusUrl)       // 모바일
    formData.append('BTN_URLS2', statusUrl)       // PC
    // 카카오 미사용자 SMS 대체 발송
    formData.append('FAILED_TYPE', 'SMS')
    formData.append('FAILED_MSG', `[인싸이트] ${customerName}님, ${eventName} 결제가 완료되었습니다. 주문 조회: ${statusUrl}`)

    const apiResponse = await fetch(ENDPOINT, {
      method: 'POST',
      body: formData,
    })

    const responseText = await apiResponse.text()

    if (!apiResponse.ok) {
      console.error('원샷 API 오류:', responseText)
      return new Response(JSON.stringify({ error: '알림톡 발송 실패', detail: responseText }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
        status: 502,
      })
    }

    // 5. 발송 성공 시 이력 기록
    await supabase
      .from('orders')
      .update({ alimtalk_sent_at: new Date().toISOString() })
      .eq('id', order_id)

    console.log(`알림톡 발송 완료 — 주문 ${order_id}, 수신: ${recipientPhone}`)

    return new Response(JSON.stringify({ success: true, response: responseText }), {
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
