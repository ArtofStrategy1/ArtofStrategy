// volumes/functions/login-user-v2/index.ts
import { serve } from 'https://deno.land/std@0.131.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

serve(async (req) => {
  const headers = new Headers({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  })

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers })
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers }
    )
  }

  try {
    const body = await req.json()

    if (!body.email || !body.password) {
      return new Response(
        JSON.stringify({ error: 'Email and password are required' }),
        { status: 400, headers }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || 'https://supabase.data2int.com'
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY') || 'your-anon-key'
    const supabase = createClient(supabaseUrl, supabaseKey)

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: body.email,
      password: body.password,
    })

    if (authError || !authData?.user || !authData?.session) {
      return new Response(
        JSON.stringify({
          error: 'Login failed',
          details: authError?.message || 'Authentication error',
        }),
        { status: 401, headers }
      )
    }

    // Attempt to fetch mirrored profile (optional)
    const { data: profileData, error: profileError } = await supabase
      .from('users')
      .select('id, created_at, full_name, role, is_premium')
      .eq('auth_user_id', authData.user.id)
      .maybeSingle()

    // Build user object
    const userPayload: any = {
      id: profileData?.id || null,
      email: authData.user.email,
      created_at: profileData?.created_at || null,
      // metadata from Supabase auth user
      user_metadata: authData.user.user_metadata || {},
      app_metadata: authData.user.app_metadata || {},
      // optionally include mirrored fields for convenience
      profile: profileData || null,
    }

    if (profileError && !profileData) {
      // Log but don't necessarily block login; include a warning
      console.error('Profile fetch error:', profileError)
      userPayload.profile_warning = 'Could not load profile data'
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Login successful',
        user: userPayload,
        session: {
          access_token: authData.session.access_token,
          refresh_token: authData.session.refresh_token,
          expires_at: authData.session.expires_at,
        },
      }),
      { headers }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: 'Server error',
        details: error instanceof Error ? error.message : String(error),
      }),
      { status: 500, headers }
    )
  }
})
