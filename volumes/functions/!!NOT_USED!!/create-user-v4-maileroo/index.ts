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

  // Function to send custom email via Maileroo template
  async function sendCustomVerificationEmail(email, firstName, lastName, verificationToken) {
    const mailerooApiKey = 'b1f8f3697c1a28d8caa9d65e0d31c8d77fc24753e2253674a2de42cdfea6c494'
    const templateId = 3095
    const verificationUrl = `https://supabase.data2int.com/auth/v1/verify?token=${verificationToken}&type=signup&redirect_to=https://supabase.data2int.com/dashboard`
    
    const emailPayload = {
      from: {
        address: "noreply@data2int.com", // Replace with your verified domain
        display_name: "Data2Int Team"
      },
      to: {
        address: email,
        display_name: `${firstName} ${lastName}`.trim()
      },
      subject: "Welcome! Please verify your email address", // Can include template variables like {{ first_name }}
      template_id: templateId,
      template_data: {
        first_name: firstName,
        last_name: lastName,
        full_name: `${firstName} ${lastName}`.trim(),
        email: email,
        verification_url: verificationUrl,
        verification_link: verificationUrl, // Alternative variable name
        company_name: "Data2Int",
        support_email: "support@data2int.com",
        dashboard_url: "https://supabase.data2int.com/dashboard"
      },
      tracking: true, // Enable open/click tracking
      tags: {
        campaign: "user-verification",
        type: "signup",
        source: "api"
      }
    }

    try {
      console.log('Sending email with payload:', JSON.stringify(emailPayload, null, 2))
      
      const response = await fetch('https://smtp.maileroo.com/api/v2/emails/template', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': mailerooApiKey
        },
        body: JSON.stringify(emailPayload)
      })

      console.log('Maileroo response status:', response.status)
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error('Maileroo API error response:', errorText)
        throw new Error(`Maileroo API error: ${response.status} - ${errorText}`)
      }

      const result = await response.json()
      console.log('Maileroo success response:', JSON.stringify(result, null, 2))
      return result
    } catch (error) {
      console.error('Failed to send custom email:', error)
      throw error
    }
  }

  try {
    const body = await req.json()
    if (!body.email || !body.password) {
      return new Response(JSON.stringify({ error: 'Email and password are required' }), { status: 400, headers })
    }

    const firstName = body.metadata?.first_name || ''
    const lastName = body.metadata?.last_name || ''
    const role = 'basic'

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || 'https://supabase.data2int.com'
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey)
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      db: { schema: 'publicv2' }
    })

    // Step 1: Sign up WITHOUT sending confirmation email
    const { data: signUpData, error: signUpError } = await supabaseAnon.auth.signUp({
      email: body.email,
      password: body.password,
      options: {
        data: {
          first_name: firstName,
          last_name: lastName,
          full_name: `${firstName} ${lastName}`.trim(),
          role
        },
        emailRedirectTo: body.redirectTo || 'https://supabase.data2int.com/dashboard'
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

    // Step 2: Update app_metadata
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      signUpData.user.id,
      {
        app_metadata: {
          role,
          provider: 'email',
          providers: ['email'],
          email_verified: false,
          created_at: new Date().toISOString()
        }
      }
    )
    if (updateError) console.error('Warning: Failed to update user app_metadata:', updateError)

    // Step 3: Insert into profile table
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .insert([{
        auth_user_id: signUpData.user.id,
        first_name: firstName,
        last_name: lastName,
        created_at: new Date().toISOString()
      }])
      .select()
      .single()

    if (userError) {
      console.error('User profile creation failed:', userError)
      try {
        await supabaseAdmin.auth.admin.deleteUser(signUpData.user.id)
        console.log('Cleaned up auth user after profile creation failure')
      } catch (cleanupError) {
        console.error('Failed to clean up auth user:', cleanupError)
      }
      return new Response(JSON.stringify({
        error: 'User profile creation failed',
        details: userError.message
      }), { status: 400, headers })
    }

    // Step 4: Generate verification token and send custom email
    try {
      // Generate a verification token using Supabase Admin
      const { data: tokenData, error: tokenError } = await supabaseAdmin.auth.admin.generateLink({
        type: 'signup',
        email: body.email,
        options: {
          redirectTo: body.redirectTo || 'https://supabase.data2int.com/dashboard'
        }
      })

      if (tokenError) {
        console.error('Failed to generate verification token:', tokenError)
        // Continue without custom email - user can still login but won't be verified
      } else {
        // Extract token from the verification URL
        const urlParams = new URL(tokenData.properties.hashed_token_link).searchParams
        const token = urlParams.get('token')
        
        if (token) {
          await sendCustomVerificationEmail(body.email, firstName, lastName, token)
          console.log('Custom verification email sent successfully')
        }
      }
    } catch (emailError) {
      console.error('Failed to send custom verification email:', emailError)
      // Don't fail the entire request - user is still created
    }

    console.log('User created successfully:', {
      auth_user_id: signUpData.user.id,
      email: signUpData.user.email,
      profile_id: userData.id,
      custom_verification_email_sent: true
    })

    return new Response(JSON.stringify({
      success: true,
      message: 'Account created successfully! Please check your email to verify your account.',
      user: {
        id: userData.id,
        auth_user_id: signUpData.user.id,
        email: signUpData.user.email,
        first_name: userData.first_name,
        last_name: userData.last_name,
        email_confirmed: false
      },
      next_steps: {
        message: 'A custom verification email has been sent to your email address.',
        action: 'Please check your inbox and click the verification link to activate your account.'
      }
    }), { headers })

  } catch (error) {
    console.error('Server error in create-user-v3:', error)
    return new Response(JSON.stringify({
      error: 'Server error',
      details: error.message
    }), { status: 500, headers })
  }
})