import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.42.0'
import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'

serve(async (req) => {
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }

  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Verify user's role
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

    const userPermissions = user.app_metadata?.permissions || [];
    // Check if the calling user has 'master' role (which implies all permissions)
    // Or if they have 'users:manage' permission
    if (!userPermissions.includes('master') && !userPermissions.includes('users:manage')) {
      return new Response(JSON.stringify({ error: 'Forbidden: Only master users or users with users:manage permission can update user permissions' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      })
    }

    // Parse request body
    const { userId, newPermissions } = await req.json()

    if (!userId || !Array.isArray(newPermissions)) {
      return new Response(JSON.stringify({ error: 'Missing userId or newPermissions (must be an array)' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    // Update user's permissions
    const { error } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      { app_metadata: { permissions: newPermissions } }
    )

    if (error) {
      console.error('Error updating user permissions:', error)
      return new Response(JSON.stringify({ error: error.message }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      })
    }

    // 감사 로그 기록 (성공 분기). 실패해도 본 작업은 성공 처리 — 기록 누락만.
    try {
      await supabaseAdmin.from('audit_log').insert({
        actor_id: user.id,
        actor_name: user.user_metadata?.name ?? 'system',
        actor_role: user.app_metadata?.role ?? null,
        action: 'permission_change',
        target_table: 'user_auth',
        target_id: userId,
        after: { permissions: newPermissions },
        summary: `${user.user_metadata?.name ?? '관리자'} 가 사용자(${userId}) 권한을 변경 (${newPermissions.length}개)`,
      })
    } catch (auditErr) {
      console.error('audit_log insert failed (permission_change):', auditErr)
    }

    return new Response(JSON.stringify({ message: 'User permissions updated successfully' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    console.error('Edge Function error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
