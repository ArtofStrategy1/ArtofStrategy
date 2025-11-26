// supabase/functions/password-reset-verify/index.ts
import { serve } from 'https://deno.land/std@0.131.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

serve(async (req) => {
  console.log('=== PASSWORD RESET VERIFY HANDLER ===')
  
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
    console.log('Verification request:', body)
    
    const { token, email, newPassword } = body

    if (!token || !email || !newPassword) {
      return new Response(JSON.stringify({
        error: 'Missing required fields',
        details: 'Token, email, and new password are required'
      }), { status: 400, headers })
    }

    if (newPassword.length < 6) {
      return new Response(JSON.stringify({
        error: 'Password too short',
        details: 'Password must be at least 6 characters long'
      }), { status: 400, headers })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || 'https://supabase.sageaios.com'
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseServiceKey) {
      return new Response(JSON.stringify({
        error: 'Server configuration error'
      }), { status: 500, headers })
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      db: { schema: 'publicv2' }
    })

    console.log('=== STEP 1: FIND USER BY EMAIL ===')
    
    // Get user from profile table
    const { data: profileData, error: profileError } = await supabaseAdmin
      .from('users')
      .select('auth_user_id')
      .eq('email', email)
      .single()

    if (profileError || !profileData) {
      console.error('User not found in profile:', profileError)
      return new Response(JSON.stringify({
        error: 'Invalid reset link',
        details: 'User not found'
      }), { status: 404, headers })
    }

    const userId = profileData.auth_user_id
    console.log('Found user ID:', userId)

    console.log('=== STEP 2: VERIFY RESET TOKEN ===')
    
    // Get user and verify token
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.getUserById(userId)

    if (authError || !authUser) {
      console.error('Auth user not found:', authError)
      return new Response(JSON.stringify({
        error: 'Invalid reset link',
        details: 'Auth user not found'
      }), { status: 404, headers })
    }

    const storedToken = authUser.user.app_metadata?.password_reset_token
    const expiresAt = authUser.user.app_metadata?.password_reset_expires_at

    console.log('Token verification:', {
      provided: token,
      stored: storedToken,
      expiresAt
    })

    if (!storedToken || storedToken !== token) {
      return new Response(JSON.stringify({
        error: 'Invalid reset token',
        details: 'Token does not match or has been used'
      }), { status: 400, headers })
    }

    // Check if token has expired
    if (expiresAt && new Date() > new Date(expiresAt)) {
      return new Response(JSON.stringify({
        error: 'Reset link expired',
        details: 'Please request a new password reset link'
      }), { status: 400, headers })
    }

    console.log('=== STEP 3: UPDATE PASSWORD ===')
    
    // Update user's password
    const { error: passwordUpdateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: newPassword,
      app_metadata: {
        ...authUser.user.app_metadata,
        password_reset_token: null, // Clear the token after use
        password_reset_expires_at: null,
        password_reset_used_at: new Date().toISOString()
      }
    })

    if (passwordUpdateError) {
      console.error('Failed to update password:', passwordUpdateError)
      return new Response(JSON.stringify({
        error: 'Password update failed',
        details: passwordUpdateError.message
      }), { status: 500, headers })
    }

    console.log('Password updated successfully')

    console.log('=== STEP 4: INVALIDATE ALL SESSIONS ===')
    
    // For security, sign out all existing sessions
    try {
      const { error: signOutError } = await supabaseAdmin.auth.admin.signOut(userId, 'global')
      if (signOutError) {
        console.log('Warning: Failed to sign out user sessions:', signOutError)
      }
    } catch (signOutErr) {
      console.log('Warning: Sign out error:', signOutErr)
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Password updated successfully. Please log in with your new password.',
      redirect: '/auth/login'
    }), { headers })

  } catch (error) {
    console.error('=== PASSWORD RESET VERIFY ERROR ===')
    console.error('Error:', error)
    
    return new Response(JSON.stringify({
      error: 'Password reset failed',
      details: error.message
    }), { status: 500, headers })
  }
})