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
    const firstName = body.metadata?.first_name
    const lastName = body.metadata?.last_name
    const role = 'basic' // Server-controlled, not from user input

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || 'https://supabase.data2int.com'
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || 'your-service-role-key'
    const supabase = createClient(supabaseUrl, supabaseKey)

    // SECURITY FIX: Move role to app_metadata (application-controlled)
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: body.email,
      password: body.password,
      email_confirm: true,
      // USER-EDITABLE DATA (user can modify via client)
      user_metadata: {
        first_name: firstName,
        last_name: lastName,
        full_name: `${firstName} ${lastName}`.trim()
      },
      // APPLICATION-CONTROLLED DATA (only server/admin can modify)
      app_metadata: {
        role: role,
        provider: 'email',
        providers: ['email'],
        email_verified: false // Will be updated after confirmation
      }
    })

    if (authError) {
      console.error('Auth user creation failed:', authError)
      return new Response(
        JSON.stringify({
          error: 'User creation failed',
          details: authError.message
        }),
        { status: 400, headers }
      )
    }

    // Create a profile for the new user with names
    const { data: userData, error: userError } = await supabase
      .from('users')
      .insert([
        {
          auth_user_id: authData.user.id,
          first_name: firstName,
          last_name: lastName
        }
      ])
      .select()

    if (userError) {
      console.error('User profile creation failed:', userError)
      
      // If profile creation fails, try to clean up by deleting the auth user
      try {
        await supabase.auth.admin.deleteUser(authData.user.id)
        console.log('Cleaned up auth user after profile creation failure')
      } catch (cleanupError) {
        console.error('Failed to clean up auth user after profile creation failure:', cleanupError)
      }

      return new Response(
        JSON.stringify({
          error: 'User profile creation failed',
          details: userError.message
        }),
        { status: 400, headers }
      )
    }

    console.log('User created successfully:', {
      auth_user_id: authData.user.id,
      email: authData.user.email,
      profile_id: userData[0]?.id
    })

    // Return success response
    return new Response(
      JSON.stringify({
        success: true,
        message: 'User created successfully. Please check your email to verify your account.',
        user: {
          id: userData[0].id,
          auth_user_id: authData.user.id,
          email: authData.user.email,
          first_name: userData[0].first_name,
          last_name: userData[0].last_name,
          email_confirmed: authData.user.email_confirmed_at !== null,
          // Don't expose role in response for security
          // role: 'basic' // Remove this
        }
      }),
      { headers }
    )
  } catch (error) {
    console.error('Server error in create-user function:', error)
    
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