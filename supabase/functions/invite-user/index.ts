import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.42.0'
import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'

serve(async (req: Request) => {
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
      (Deno as any).env.get('SUPABASE_URL') ?? '',
      (Deno as any).env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Verify user's role
    const authHeader = req.headers.get('authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200, // Return 200 for debugging
      })
    }

    const token = authHeader.split(' ')[1]
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)

    if (authError || !user) {
      return new Response(JSON.stringify({ error: authError?.message || 'Unauthorized' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    const userRole = user.app_metadata?.role
    if (userRole !== 'master') {
      return new Response(JSON.stringify({ error: 'Forbidden: Only master users can manage users' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    // Parse request body
    const body = await req.json()
    const { email, name, role, password } = body

    if (!email || !name || !role || !password) {
      return new Response(JSON.stringify({ error: 'Missing email, name, role, or password in request' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    // Determine initial permissions/role based on selected role
    let appMetadataRole = 'operator';
    let appMetadataPermissions: string[] = [];
    
    if (role === 'master') {
      appMetadataRole = 'master';
      appMetadataPermissions = ['master'];
    } else if (role === 'onsite') {
      appMetadataPermissions = ['orders:view', 'events:view'];
    } else {
      // fulfillment_book or fulfillment_test
      appMetadataPermissions = ['orders:view', 'orders:edit', 'products:view'];
    }

    // Create user directly with password (confirming immediately)
    console.log(`Attempting to create user: ${email}`);
    const { data, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name },
      app_metadata: { role: appMetadataRole, permissions: appMetadataPermissions } 
    })

    if (createError) {
      console.error('Auth User Creation Error:', createError)
      return new Response(JSON.stringify({ error: `Auth Error: ${createError.message}` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    // Insert into public.user_profiles
    if (data && data.user) {
      const { error: profileError } = await supabaseAdmin
        .from('user_profiles')
        .upsert([{
          id: data.user.id,
          email: email,
          name: name,
          role: role
        }]);

      if (profileError) {
        console.error('Profile Sync Error:', profileError);
        // Don't fail the whole request but report it
        return new Response(JSON.stringify({ 
          message: 'User created but profile sync failed', 
          error: profileError.message,
          user: data.user 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        })
      }
      console.log(`User created and profile synced: ${data.user.id}`);
    }

    return new Response(JSON.stringify({ message: 'User created successfully', user: data.user }), {
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
