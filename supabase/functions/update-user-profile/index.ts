import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.42.0'
import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'

// master가 타 사용자의 name / department 를 수정.
// 권한(role)은 별도 함수(update-user-role)에서 처리하므로 여기서 변경하지 않음.
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
      return new Response(JSON.stringify({ error: 'Forbidden: Only master users can update profiles' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      })
    }

    // 3) 입력 파싱
    const { userId, name, department } = await req.json()

    if (!userId) {
      return new Response(JSON.stringify({ error: 'Missing userId' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    // 전달된 필드만 부분 업데이트 (undefined는 제외)
    const updates: Record<string, string> = {}
    if (typeof name === 'string') {
      const trimmed = name.trim()
      if (!trimmed) {
        return new Response(JSON.stringify({ error: 'Name cannot be empty' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        })
      }
      updates.name = trimmed
    }
    if (typeof department === 'string') {
      updates.department = department.trim()
    }

    if (Object.keys(updates).length === 0) {
      return new Response(JSON.stringify({ error: 'Nothing to update (name or department required)' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    // 4) user_profiles 업데이트 (service_role → RLS 우회)
    const { data: updated, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .update(updates)
      .eq('id', userId)
      .select('id')

    if (profileError) {
      console.error('Error updating user profile:', profileError.message)
      return new Response(JSON.stringify({ error: profileError.message }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      })
    }

    // 대상 프로필 미존재 → 404 (영향 행 0건)
    if (!updated || updated.length === 0) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404,
      })
    }

    // 5) name 변경 시 Auth user_metadata.name 도 동기화 (invite-user가 양쪽에 기록함)
    if (updates.name) {
      const { error: metaError } = await supabaseAdmin.auth.admin.updateUserById(
        userId,
        { user_metadata: { name: updates.name } }
      )
      if (metaError) {
        console.error('Error syncing auth metadata name:', metaError.message)
        // 프로필은 이미 갱신됨 — 부분 성공 보고
        return new Response(JSON.stringify({
          message: 'Profile updated but auth name sync failed',
          error: metaError.message,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 207,
        })
      }
    }

    return new Response(JSON.stringify({ message: 'User profile updated successfully' }), {
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
