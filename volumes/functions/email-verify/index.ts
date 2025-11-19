/**
 * Email verification handler for custom Resend emails
 * Handles the confirmation link and marks user as verified in Supabase Auth
 */

import { serve } from 'https://deno.land/std@0.131.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

serve(async (req) => {
  console.log('=== EMAIL VERIFICATION HANDLER ===')
  
  const headers = new Headers({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Content-Type': 'application/json',
  })

  if (req.method === 'OPTIONS') return new Response('ok', { headers })
  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers })
  }

  try {
    const url = new URL(req.url)
    const token = url.searchParams.get('token')
    const type = url.searchParams.get('type')
    const userId = url.searchParams.get('user_id')

    console.log('Verification request:', { token, type, userId })

    if (!token || !userId || type !== 'signup') {
      return new Response(JSON.stringify({
        error: 'Invalid verification link',
        details: 'Missing or invalid parameters'
      }), { status: 400, headers })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || 'https://supabase.data2int.com'
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseServiceKey) {
      return new Response(JSON.stringify({
        error: 'Server configuration error'
      }), { status: 500, headers })
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      db: { schema: 'publicv2' }
    })

    // Get user and verify token
    console.log('Fetching user:', userId)
    
    const { data: user, error: fetchError } = await supabaseAdmin.auth.admin.getUserById(userId)

    if (fetchError || !user) {
      console.error('User not found:', fetchError)
      return new Response(JSON.stringify({
        error: 'User not found',
        details: 'Invalid user ID'
      }), { status: 404, headers })
    }

    console.log('User found:', user.user.email)
    console.log('User metadata:', user.user.app_metadata)

    // Check if user is already verified
    if (user.user.email_confirmed_at) {
      console.log('User already verified')
      // Redirect to success page or login
      return new Response(null, {
        status: 302,
        headers: new Headers({
          'Location': 'https://elijah.data2int.com/auth/verified?already=true'
        })
      })
    }

    // Verify the confirmation token
    const storedToken = user.user.app_metadata?.confirmation_token
    const expiresAt = user.user.app_metadata?.confirmation_expires_at

    console.log('Token verification:', {
      provided: token,
      stored: storedToken,
      expiresAt
    })

    if (!storedToken || storedToken !== token) {
      return new Response(JSON.stringify({
        error: 'Invalid confirmation token',
        details: 'Token does not match or has been used'
      }), { status: 400, headers })
    }

    // Check if token has expired
    if (expiresAt && new Date() > new Date(expiresAt)) {
      return new Response(JSON.stringify({
        error: 'Confirmation link expired',
        details: 'Please request a new confirmation email'
      }), { status: 400, headers })
    }

    // Mark user as email confirmed in Supabase Auth
    console.log('Confirming user email...')
    
    const { error: confirmError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      email_confirm: true,
      app_metadata: {
        ...user.user.app_metadata,
        confirmation_token: null, // Clear the token after use
        confirmation_expires_at: null,
        email_verified: true,
        verified_at: new Date().toISOString()
      }
    })

    if (confirmError) {
      console.error('Failed to confirm user:', confirmError)
      return new Response(JSON.stringify({
        error: 'Verification failed',
        details: confirmError.message
      }), { status: 500, headers })
    }

    console.log('User email confirmed successfully')

    // Update user profile if needed
    try {
      const { error: profileError } = await supabaseAdmin
        .from('users')
        .update({ 
          email_verified: true,
          verified_at: new Date().toISOString()
        })
        .eq('auth_user_id', userId)

      if (profileError) {
        console.error('Warning: Failed to update profile:', profileError)
      }
    } catch (updateError) {
      console.error('Profile update error:', updateError)
    }

    // Redirect to success page
    return new Response(null, {
      status: 302,
      headers: new Headers({
        'Location': 'https://elijah.data2int.com/auth/verified?success=true'
      })
    })

  } catch (error) {
    console.error('=== VERIFICATION ERROR ===')
    console.error('Verification error:', error)
    
    return new Response(JSON.stringify({
      error: 'Verification failed',
      details: error.message
    }), { status: 500, headers })
  }
})