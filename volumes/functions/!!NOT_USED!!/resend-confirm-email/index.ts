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
    if (!body.email) {
      return new Response(JSON.stringify({ error: 'Email is required' }), { status: 400, headers })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || 'https://supabase.data2int.com'
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseServiceKey) {
      return new Response(JSON.stringify({ error: 'Server configuration error' }), { status: 500, headers })
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    // Get user by email
    const { data: { users }, error: getUserError } = await supabaseAdmin.auth.admin.listUsers()
    
    if (getUserError) {
      console.error('Error getting users:', getUserError)
      return new Response(JSON.stringify({ error: 'User lookup failed' }), { status: 400, headers })
    }

    const user = users.find(u => u.email === body.email)
    if (!user) {
      return new Response(JSON.stringify({ error: 'User not found' }), { status: 404, headers })
    }

    if (user.email_confirmed_at) {
      return new Response(JSON.stringify({ error: 'Email already verified' }), { status: 400, headers })
    }

    // Generate new confirmation token and send email
    const { error: resendError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'signup',
      email: body.email
    })

    if (resendError) {
      console.error('Resend error:', resendError)
      return new Response(JSON.stringify({ error: 'Failed to resend verification email' }), { status: 400, headers })
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Verification email resent successfully'
    }), { headers })

  } catch (error) {
    console.error('Server error in resend-verification:', error)
    return new Response(JSON.stringify({
      error: 'Server error',
      details: error.message
    }), { status: 500, headers })
  }
})