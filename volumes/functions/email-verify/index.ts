/**
 * -----------------------------------------------------------------------------
 * @name        email-verify
 * @description Serves as the landing page for the custom verification link sent 
 * by the 'custom-signup' function. It uses the Service Role Key to bypass RLS 
 * and perform the following critical operations:
 * 1. Validates the provided token against the token stored in Auth metadata.
 * 2. Checks token expiration time.
 * 3. Marks the user's email as confirmed in Supabase Auth.
 * 4. Updates the 'publicv2.users' profile (email_verified=true).
 * 5. Redirects the user to the success or failure landing page.
 * -----------------------------------------------------------------------------
 * @method      GET (Expected method via confirmation link)
 * @base_url    /functions/v1/email-verify
 * -----------------------------------------------------------------------------
 * @security    Service Role Key is required for admin-level user updates.
 * @params      ?token={UUID}&type=signup&user_id={UUID}
 * @redirects   302 Found (To 'https://sageaios.com/auth/verified?...')
 * -----------------------------------------------------------------------------
 * @env         SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * @author      Elijah Furlonge
 * -----------------------------------------------------------------------------
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

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
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
          'Location': 'https://sageaios.com/auth/verified?already=true'
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
        'Location': 'https://sageaios.com/auth/verified?success=true'
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