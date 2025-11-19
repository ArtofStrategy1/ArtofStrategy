// volumes/functions/create-user/index.ts
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

    // Extract first and last name from metadata
    const firstName = body.metadata?.first_name || ''
    const lastName = body.metadata?.last_name || ''
    const role = body.metadata?.role || 'basic'

    // Initialize Supabase clients
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || 'https://supabase.data2int.com'
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
    
    // Service role client for admin operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)
    // Anon client for regular signup (triggers emails)
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey)

    // Step 1: Use regular signup (this will send confirmation email automatically)
    const { data: signupData, error: signupError } = await supabaseClient.auth.signUp({
      email: body.email,
      password: body.password,
      options: {
        data: {
          first_name: firstName,
          last_name: lastName,
          full_name: `${firstName} ${lastName}`.trim(),
          role: role
        }
      }
    })

    if (signupError) {
      return new Response(
        JSON.stringify({ 
          error: 'User signup failed', 
          details: signupError.message 
        }),
        { status: 400, headers }
      )
    }

    // Step 2: Create profile in users table using service role
    // (only if user was created successfully)
    if (signupData.user) {
      const { data: userData, error: userError } = await supabaseAdmin
        .from('users')
        .insert([
          {
            auth_user_id: signupData.user.id,
            first_name: firstName,
            last_name: lastName
          }
        ])
        .select()

      if (userError) {
        console.error('Failed to create user profile:', userError)
        // Don't delete the auth user here since email confirmation is pending
        // The user profile can be created later via a webhook or when they first login
        
        return new Response(
          JSON.stringify({
            success: true,
            message: 'User created successfully, confirmation email sent',
            note: 'User profile will be created upon email confirmation',
            user: {
              auth_user_id: signupData.user.id,
              email: signupData.user.email,
              email_verified: false,
              confirmation_sent_at: signupData.user.confirmation_sent_at
            }
          }),
          { headers }
        )
      }

      // Success - both auth user and profile created
      return new Response(
        JSON.stringify({
          success: true,
          message: 'User created successfully, confirmation email sent',
          user: {
            id: userData[0].id,
            auth_user_id: signupData.user.id,
            email: signupData.user.email,
            first_name: userData[0].first_name,
            last_name: userData[0].last_name,
            email_verified: false,
            confirmation_sent_at: signupData.user.confirmation_sent_at
          }
        }),
        { headers }
      )
    }

    // Fallback response
    return new Response(
      JSON.stringify({
        success: true,
        message: 'User signup initiated, confirmation email sent',
        user: {
          email: body.email,
          email_verified: false
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