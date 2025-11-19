/**
 * Only works with publicv2 schema and gmail smtp.
 */

import { serve } from 'https://deno.land/std@0.131.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

serve(async (req) => {
  const headers = new Headers({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Content-Type': 'application/json',
  })

  if (req.method === 'OPTIONS') return new Response('ok', { headers })
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers })
  }

  try {
    const body = await req.json()
    if (!body.email || !body.password) {
      return new Response(JSON.stringify({ error: 'Email and password are required' }), { status: 400, headers })
    }

    const firstName = body.metadata?.first_name || ''
    const lastName = body.metadata?.last_name || ''
    const role = 'basic'
    
    // Accept tier from request, validate, default to 'basic'
    let tier = body.metadata?.tier || 'basic'
    if (!['basic', 'premium'].includes(tier)) {
      tier = 'basic'
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || 'https://supabase.data2int.com'
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseServiceKey) {
      console.error('SUPABASE_SERVICE_ROLE_KEY not found')
      return new Response(JSON.stringify({
        error: 'Server configuration error',
        details: 'Service key not configured'
      }), { status: 500, headers })
    }

    const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey)
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      db: { schema: 'publicv3' }
    })

    // Step 1: Sign up (triggers Gmail SMTP)
    console.log('Creating auth user for:', body.email)
    const { data: signUpData, error: signUpError } = await supabaseAnon.auth.signUp({
      email: body.email,
      password: body.password,
      options: {
        data: {
          first_name: firstName,
          last_name: lastName,
          full_name: `${firstName} ${lastName}`.trim(),
          role,
          tier
        }
      }
    })

    if (signUpError) {
      console.error('Signup failed:', signUpError)
      if (signUpError.message?.includes('already registered')) {
        return new Response(JSON.stringify({
          error: 'User already exists',
          details: 'An account with this email already exists'
        }), { status: 409, headers })
      }
      return new Response(JSON.stringify({
        error: 'User creation failed',
        details: signUpError.message
      }), { status: 400, headers })
    }

    if (!signUpData.user) {
      return new Response(JSON.stringify({
        error: 'User creation failed',
        details: 'No user returned from signup'
      }), { status: 400, headers })
    }

    console.log('Auth user created successfully:', signUpData.user.id)

    // Step 2: Update app_metadata
    try {
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
        signUpData.user.id,
        {
          app_metadata: {
            role,
            tier,
            provider: 'email',
            providers: ['email'],
            email_verified: false,
            created_at: new Date().toISOString()
          }
        }
      )
      if (updateError) {
        console.error('Warning: Failed to update user app_metadata:', updateError)
      } else {
        console.log('App metadata updated successfully')
      }
    } catch (metaError) {
      console.error('App metadata update failed:', metaError)
    }

    // Step 3: Insert into profile table
    console.log('Creating profile in publicv2.users for user:', signUpData.user.id)
    try {
      const { data: userData, error: userError } = await supabaseAdmin
        .from('users')
        .insert([{
          auth_user_id: signUpData.user.id,
          first_name: firstName,
          last_name: lastName,
          email: body.email,
          tier: tier,
          created_at: new Date().toISOString()
        }])
        .select()
        .single()

      if (userError) {
        console.error('User profile creation failed:', userError)
        
        // Try to clean up the auth user
        try {
          await supabaseAdmin.auth.admin.deleteUser(signUpData.user.id)
          console.log('Cleaned up auth user after profile creation failure')
        } catch (cleanupError) {
          console.error('Failed to clean up auth user:', cleanupError)
        }
        
        return new Response(JSON.stringify({
          error: 'User profile creation failed',
          details: userError.message || 'Database error',
          code: userError.code,
          hint: userError.hint
        }), { status: 400, headers })
      }

      console.log('Profile created successfully:', userData.id)

      return new Response(JSON.stringify({
        success: true,
        message: 'Account created successfully! Please check your email to verify your account.',
        user: {
          id: userData.id,
          auth_user_id: signUpData.user.id,
          email: signUpData.user.email,
          first_name: userData.first_name,
          last_name: userData.last_name,
          tier: userData.tier,
          email_confirmed: false
        },
        next_steps: {
          message: 'A verification email has been sent to your email address.',
          action: 'Please check your inbox and click the verification link to activate your account.'
        }
      }), { headers })

    } catch (profileError) {
      console.error('Profile creation exception:', profileError)
      
      // Clean up auth user on any profile creation failure
      try {
        await supabaseAdmin.auth.admin.deleteUser(signUpData.user.id)
        console.log('Cleaned up auth user after profile exception')
      } catch (cleanupError) {
        console.error('Cleanup failed:', cleanupError)
      }

      return new Response(JSON.stringify({
        error: 'User profile creation failed',
        details: profileError.message || 'Database connection error'
      }), { status: 500, headers })
    }

  } catch (error) {
    console.error('Server error in create-user-v3:', error)
    return new Response(JSON.stringify({
      error: 'Server error',
      details: error.message
    }), { status: 500, headers })
  }
})