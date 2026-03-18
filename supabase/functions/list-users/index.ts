import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.42.0'
import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'

serve(async (req: Request) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200, 
      })
    }
    const token = authHeader.split(' ')[1]

    const supabase = createClient(
      (Deno as any).env.get('SUPABASE_URL') ?? '',
      (Deno as any).env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      }
    )

    const { data: userData, error: userError } = await supabase.auth.getUser()

    if (userError || !userData.user) {
      console.error('Auth error in getUser:', userError?.message || 'User not found');
      return new Response(JSON.stringify({ error: userError?.message || 'Unauthorized: Invalid user token.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    const authenticatedUser = userData.user;
    const userPermissions = authenticatedUser.app_metadata?.permissions || [];
    const userRole = authenticatedUser.app_metadata?.role;

    if (userRole !== 'master' && !userPermissions.includes('users:manage')) {
      return new Response(JSON.stringify({ error: 'Forbidden: Insufficient permissions.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    const supabaseAdmin = createClient(
      (Deno as any).env.get('SUPABASE_URL') ?? '',
      (Deno as any).env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers()

    if (error) {
      console.error('Error listing users:', error)
      return new Response(JSON.stringify({ error: error.message }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    // Fetch user profiles to get names and specialized roles
    const { data: profiles, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .select('id, name, role');

    if (profileError) {
      console.error('Error fetching user profiles:', profileError);
    }

    const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));

    const formattedUsers = users.map((u: any) => {
      const profileInfo = profileMap.get(u.id);
      return {
        id: u.id,
        email: u.email,
        name: profileInfo?.name || '알 수 없음',
        role: profileInfo?.role || u.app_metadata?.role || 'operator',
        permissions: u.app_metadata?.permissions || [],
        memo: u.user_metadata?.memo || '',
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at,
      };
    });

    return new Response(JSON.stringify(formattedUsers), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error: any) {
    console.error('Fatal Edge Function error:', error)
    return new Response(JSON.stringify({ error: `System Error: ${error.message}` }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  }
})