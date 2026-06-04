import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.42.0'
import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'

// master가 타 사용자의 PIN(=Auth 비밀번호)을 재설정 (분실 대응).
// newPin 미지정 시 6자리 임시 PIN을 서버에서 발급하여 반환.
// 평문 PIN은 절대 로깅하지 않음.
serve(async (req: Request) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      (Deno as any).env.get('SUPABASE_URL') ?? '',
      (Deno as any).env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 1) 인증 검증
    const authHeader = req.headers.get('authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      })
    }

    const token = authHeader.split(' ')[1]
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)

    if (authError || !user) {
      return new Response(JSON.stringify({ error: authError?.message || 'Unauthorized' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      })
    }

    // 2) master 권한 검증 (서버 측 강제)
    if (user.app_metadata?.role !== 'master') {
      return new Response(JSON.stringify({ error: 'Forbidden: Only master users can reset PINs' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      })
    }

    // 3) 입력 파싱
    const body = await req.json()
    const userId: string | undefined = body.userId
    let newPin: string | undefined = body.newPin

    if (!userId) {
      return new Response(JSON.stringify({ error: 'Missing userId' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    // 3-1) 본인 PIN은 이 경로 금지 (본인 변경은 별도 흐름)
    if (userId === user.id) {
      return new Response(JSON.stringify({ error: 'Cannot reset your own PIN via this endpoint' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    // 3-2) 대상 사용자 조회 (PIN 갱신 전) — 미존재/타 master 차단
    const { data: targetData, error: getError } = await supabaseAdmin.auth.admin.getUserById(userId)

    if (getError || !targetData?.user) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404,
      })
    }

    // 타 master의 PIN 강제 재설정 금지 (defensive)
    if (targetData.user.app_metadata?.role === 'master') {
      return new Response(JSON.stringify({ error: "Forbidden: Cannot reset another master's PIN" }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      })
    }

    // 4) newPin 미지정 시 6자리 임시 PIN 발급 (CSPRNG)
    let generated = false
    if (!newPin) {
      const buf = new Uint32Array(1)
      crypto.getRandomValues(buf)
      newPin = String(buf[0] % 1000000).padStart(6, '0')
      generated = true
    }

    // PIN 형식 검증: 숫자 6자리 (invite-user 정책과 동일)
    if (!/^\d{6}$/.test(newPin)) {
      return new Response(JSON.stringify({ error: 'PIN must be 6 digits' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    // 5) Auth 비밀번호 갱신 (service_role admin API) — 평문 PIN 로깅 금지
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      { password: newPin }
    )

    if (updateError) {
      console.error('Error resetting user PIN:', updateError.message)
      return new Response(JSON.stringify({ error: updateError.message }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      })
    }

    console.log(`PIN reset for user ${userId} by master ${user.id} (generated=${generated})`)

    // 감사 로그 기록 (성공 분기). PIN 값은 절대 기록하지 않음 — action/대상만.
    try {
      await supabaseAdmin.from('audit_log').insert({
        actor_id: user.id,
        actor_name: user.user_metadata?.name ?? 'system',
        actor_role: user.app_metadata?.role ?? null,
        action: 'pin_reset',
        target_table: 'user_auth',
        target_id: userId,
        after: { generated },
        summary: `${user.user_metadata?.name ?? '관리자'} 가 사용자(${userId}) PIN을 재설정`,
      })
    } catch (auditErr) {
      console.error('audit_log insert failed (pin_reset):', auditErr)
    }

    // 6) master가 신규 PIN을 직접 전달할 수 있도록 평문 반환.
    //    (분실 대응 — 직원에게 즉시 안내. 응답은 master 화면에서만 1회 노출)
    return new Response(JSON.stringify({
      message: 'PIN reset successfully',
      pin: newPin,
      generated,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error: any) {
    console.error('Edge Function error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
