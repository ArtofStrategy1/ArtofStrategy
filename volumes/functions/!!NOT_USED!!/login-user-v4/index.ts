// volumes/functions/login/index.ts
import { serve } from 'https://deno.land/std@0.131.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

serve(async (req) => {
  // CORS headers
  const headers = new Headers({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Content-Type': 'application/json',
  })

  // Handle preflight CORS request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers })
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers }
    )
  }

  try {
    // Parse request body
    const body = await req.json()
    
    // Validate request data
    if (!body.email || !body.password) {
      return new Response(
        JSON.stringify({ error: 'Email and password are required' }),
        { status: 400, headers }
      )
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || 'https://supabase.data2int.com'
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY') || 'your-anon-key'
    //const supabase = createClient(supabaseUrl, supabaseKey)
    const supabase = createClient(supabaseUrl, supabaseKey, {
      db: { schema: 'publicv3' }
    })

    // Sign in the user
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: body.email,
      password: body.password
    })

    if (authError) {
      return new Response(
        JSON.stringify({ 
          error: 'Login failed', 
          details: authError.message 
        }),
        { status: 401, headers }
      )
    }

    // Get user profile
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, created_at')
      .eq('auth_user_id', authData.user.id)
      .single()
    
    if (userError) {
      return new Response(
        JSON.stringify({ 
          error: 'User profile not found', 
          details: userError.message 
        }),
        { status: 404, headers }
      )
    }

    // Return success response
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Login successful',
        user: {
          id: userData.id,
          email: authData.user.email,
          created_at: userData.created_at
        },
        session: {
          access_token: authData.session.access_token,
          refresh_token: authData.session.refresh_token,
          expires_at: authData.session.expires_at
        }
      }),
      { headers }
    )
  } catch (error) {
    // Handle unexpected errors
    return new Response(
      JSON.stringify({ 
        error: 'Server error', 
        details: error.message 
      }),
      { status: 500, headers }
    )
  }
})