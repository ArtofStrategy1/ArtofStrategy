import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
}

Deno.serve(async (req) => {
  console.log('=== EDGE FUNCTION START ===')
  console.log('Request method:', req.method)

  // 1. Handle CORS Preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // 2. Validate Method
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { 
      status: 405, 
      headers: corsHeaders 
    })
  }

  try {
    const body = await req.json()
    console.log('Request body received:', JSON.stringify(body, null, 2))
    
    if (!body.email || !body.password) {
      console.error('Missing email or password')
      return new Response(JSON.stringify({ error: 'Email and password are required' }), { 
        status: 400, 
        headers: corsHeaders 
      })
    }

    const firstName = body.metadata?.first_name || ''
    const lastName = body.metadata?.last_name || ''
    const role = 'basic'
    
    // Tier validation
    let tier = body.metadata?.tier || 'basic'
    if (!['basic', 'premium'].includes(tier)) {
      tier = 'basic'
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const resendApiKey = Deno.env.get('RESEND_API_KEY')

    console.log('Environment check:')
    console.log('- SUPABASE_URL:', supabaseUrl)
    console.log('- RESEND_API_KEY:', resendApiKey ? `${resendApiKey.substring(0, 10)}...` : 'MISSING')

    if (!supabaseServiceKey) {
      return new Response(JSON.stringify({
        error: 'Server configuration error',
        details: 'Service key not configured'
      }), { status: 500, headers: corsHeaders })
    }

    // Initialize Supabase Admin client with publicv2 schema
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      db: { schema: 'publicv2' },
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    console.log('=== STEP 1: CREATING AUTH USER (NO EMAIL) ===')
    
    const signupOptions = {
      email: body.email,
      password: body.password,
      email_confirm: false, // Disable auto email
      user_metadata: { // Note: In createUser, it's user_metadata, not options.data
          first_name: firstName,
          last_name: lastName,
          full_name: `${firstName} ${lastName}`.trim(),
          role,
          tier,
          email_confirmed: false
      }
    }
    
    console.log('Creating auth user without email confirmation...')
    
    const { data: signUpData, error: signUpError } = await supabaseAdmin.auth.admin.createUser(signupOptions)

    if (signUpError) {
      console.error('Signup failed:', signUpError)
      if (signUpError.message?.includes('already registered') || signUpError.message?.includes('unique')) {
        return new Response(JSON.stringify({
          error: 'User already exists',
          details: 'An account with this email already exists'
        }), { status: 409, headers: corsHeaders })
      }
      return new Response(JSON.stringify({
        error: 'User creation failed',
        details: signUpError.message
      }), { status: 400, headers: corsHeaders })
    }

    if (!signUpData.user) {
      return new Response(JSON.stringify({
        error: 'User creation failed',
        details: 'No user returned from signup'
      }), { status: 400, headers: corsHeaders })
    }

    console.log('Auth user created successfully with ID:', signUpData.user.id)

    // === STEP 2: CREATE PROFILE ===
    console.log('=== STEP 2: CREATING PROFILE ===')
    
    const profileData = {
      auth_user_id: signUpData.user.id,
      first_name: firstName,
      last_name: lastName,
      email: body.email,
      tier: tier,
      created_at: new Date().toISOString()
    }
    
    try {
      const { data: userData, error: userError } = await supabaseAdmin
        .from('users')
        .insert([profileData])
        .select()
        .single()

      if (userError) {
        console.error('User profile creation failed:', userError)
        
        // Clean up auth user if profile fails
        try {
          await supabaseAdmin.auth.admin.deleteUser(signUpData.user.id)
        } catch (cleanupError) {
          console.error('Failed to clean up auth user:', cleanupError)
        }
        
        return new Response(JSON.stringify({
          error: 'User profile creation failed',
          details: userError.message
        }), { status: 400, headers: corsHeaders })
      }

      console.log('Profile created successfully with ID:', userData.id)

      // === STEP 3: SEND EMAIL ===
      console.log('=== STEP 3: SENDING CUSTOM EMAIL VIA RESEND ===')
      
      try {
        const confirmationToken = crypto.randomUUID()
        const expirationTime = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
        
        // Update user metadata with token
        await supabaseAdmin.auth.admin.updateUserById(signUpData.user.id, {
          app_metadata: {
            ...signUpData.user.app_metadata,
            confirmation_token: confirmationToken,
            confirmation_expires_at: expirationTime.toISOString(),
            role,
            tier
          }
        })

        const confirmationUrl = `https://supabase.sageaios.com/functions/v1/email-verify?token=${confirmationToken}&type=signup&user_id=${signUpData.user.id}`

        const emailHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to Sage AI</title>
</head>
<body style="background-color: #f8fafc; margin: 0; padding: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;">
    <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);">
        <div style="background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); padding: 40px 30px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">Welcome to Sage AI!</h1>
            <p style="color: rgba(255, 255, 255, 0.9); margin: 10px 0 0 0; font-size: 16px;">Your journey into intelligent data begins now</p>
        </div>
        <div style="padding: 40px 30px;">
            <h2 style="color: #1f2937; margin: 0 0 20px 0; font-size: 24px; font-weight: 600;">Almost there${firstName ? `, ${firstName}` : ''}!</h2>
            <p style="color: #4b5563; line-height: 1.6; margin: 0 0 30px 0; font-size: 16px;">
                Please verify your email address by clicking the button below:
            </p>
            <div style="text-align: center; margin: 40px 0;">
                <a href="${confirmationUrl}" style="background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); color: #ffffff; text-decoration: none; padding: 16px 32px; border-radius: 8px; font-weight: 600; display: inline-block;">
                    ✉️ Verify My Email Address
                </a>
            </div>
             <p style="color: #6b7280; font-size: 14px; text-align: center;">
                Link not working? Copy this URL:<br>
                <a href="${confirmationUrl}" style="color: #4f46e5; word-break: break-all;">${confirmationUrl}</a>
            </p>
        </div>
    </div>
</body>
</html>`

        // Send email via Resend
        const emailResponse = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'SAGE AI <noreply@data2int.com>',
            to: [body.email],
            subject: 'Welcome to Sage AI - Please confirm your email',
            html: emailHtml,
          }),
        })

        if (!emailResponse.ok) {
          const errRes = await emailResponse.text()
          console.error('Failed to send email via Resend:', errRes)
        } else {
          console.log('Confirmation email sent successfully via Resend')
        }

      } catch (emailError) {
        console.error('Email sending failed:', emailError)
      }

      const successResponse = {
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
      }

      console.log('=== SUCCESS RESPONSE ===')
      return new Response(JSON.stringify(successResponse), { headers: corsHeaders })

    } catch (profileError) {
      console.error('Profile creation exception:', profileError)
      // Attempt cleanup
      try { await supabaseAdmin.auth.admin.deleteUser(signUpData.user.id) } catch (e) {}

      return new Response(JSON.stringify({
        error: 'User profile creation failed',
        details: profileError.message
      }), { status: 500, headers: corsHeaders })
    }

  } catch (error) {
    console.error('=== SERVER ERROR ===', error)
    return new Response(JSON.stringify({
      error: 'Server error',
      details: error.message
    }), { status: 500, headers: corsHeaders })
  }
})