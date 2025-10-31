import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.42.0'
import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'

serve(async (req) => {
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
        status: 401,
      })
    }
    const token = authHeader.split(' ')[1]

    // 1. Create a client with the user's JWT to validate the user
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '', // Use ANON key here
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      }
    )

    // 2. Get user data from the JWT
    const { data: userData, error: userError } = await supabase.auth.getUser()

    if (userError || !userData.user) {
      console.error('Auth error in getUser:', userError?.message || 'User not found');
      return new Response(JSON.stringify({ error: userError?.message || 'Unauthorized: Invalid user token.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      })
    }

    const authenticatedUser = userData.user;
    const userPermissions = authenticatedUser.app_metadata?.permissions || [];
    const userRole = authenticatedUser.app_metadata?.role; // Check for master role

    // Authorization check: Only master or users with 'users:manage' permission can list users
    if (userRole !== 'master' && !userPermissions.includes('users:manage')) {
      return new Response(JSON.stringify({ error: 'Forbidden: Insufficient permissions.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      })
    }

    // 3. Initialize a separate service role client for privileged operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Fetch all users
    const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers()

    if (error) {
      console.error('Error listing users with service role:', error)
      return new Response(JSON.stringify({ error: error.message }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      })
    }

    // Format users for response
    const formattedUsers = users.map(u => ({
      id: u.id,
      email: u.email,
      role: u.app_metadata?.role, // Keep role for master check
      permissions: u.app_metadata?.permissions || [],
      memo: u.user_metadata?.memo || '',
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at,
    }))

    return new Response(JSON.stringify(formattedUsers), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    console.error('Edge Function error:', error)
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})