/**
 * Enhanced user creation with direct Resend email integration
 * Only works with publicv2 schema
 */

import { serve } from 'https://deno.land/std@0.131.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

serve(async (req) => {
  console.log('=== EDGE FUNCTION START ===')
  console.log('Request method:', req.method)
  
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
    console.log('Request body received:', JSON.stringify(body, null, 2))
    
    if (!body.email || !body.password) {
      console.error('Missing email or password')
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
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const resendApiKey = Deno.env.get('RESEND_API_KEY') || 're_iXKQvKau_8k3SJvk8NdULzUkLVo2Dod3B'

    console.log('Environment check:')
    console.log('- SUPABASE_URL:', supabaseUrl)
    console.log('- RESEND_API_KEY:', resendApiKey ? `${resendApiKey.substring(0, 10)}...` : 'MISSING')

    if (!supabaseServiceKey) {
      return new Response(JSON.stringify({
        error: 'Server configuration error',
        details: 'Service key not configured'
      }), { status: 500, headers })
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      db: { schema: 'publicv2' }
    })

    console.log('=== STEP 1: CREATING AUTH USER (NO EMAIL) ===')
    
    // Create user with email confirmation disabled initially
    const signupOptions = {
      email: body.email,
      password: body.password,
      email_confirm: false, // Disable auto email
      options: {
        data: {
          first_name: firstName,
          last_name: lastName,
          full_name: `${firstName} ${lastName}`.trim(),
          role,
          tier,
          email_confirmed: false
        }
      }
    }
    
    console.log('Creating auth user without email confirmation...')
    
    const { data: signUpData, error: signUpError } = await supabaseAdmin.auth.admin.createUser(signupOptions)

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

    console.log('Auth user created successfully with ID:', signUpData.user.id)

    // Step 2: Create profile
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
        
        // Clean up auth user
        try {
          await supabaseAdmin.auth.admin.deleteUser(signUpData.user.id)
        } catch (cleanupError) {
          console.error('Failed to clean up auth user:', cleanupError)
        }
        
        return new Response(JSON.stringify({
          error: 'User profile creation failed',
          details: userError.message
        }), { status: 400, headers })
      }

      console.log('Profile created successfully with ID:', userData.id)

      // Step 3: Generate confirmation token and send email via Resend
      console.log('=== STEP 3: SENDING CUSTOM EMAIL VIA RESEND ===')
      
      try {
        // Generate a simple confirmation token (you might want to make this more secure)
        const confirmationToken = crypto.randomUUID()
        const expirationTime = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
        
        // Store token in user metadata for verification later
        await supabaseAdmin.auth.admin.updateUserById(signUpData.user.id, {
          app_metadata: {
            ...signUpData.user.app_metadata,
            confirmation_token: confirmationToken,
            confirmation_expires_at: expirationTime.toISOString(),
            role,
            tier
          }
        })

        // Create confirmation URL with proper domain
        const confirmationUrl = `https://supabase.data2int.com/functions/v1/email-verify?token=${confirmationToken}&type=signup&user_id=${signUpData.user.id}`

        // Beautiful Data2Int email template
        const emailHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to Data2Int</title>
</head>
<body style="background-color: #f8fafc; margin: 0; padding: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;">
    <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);">
        
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); padding: 40px 30px; text-align: center;">
            <div style="background-color: rgba(255, 255, 255, 0.1); width: 80px; height: 80px; border-radius: 50%; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center;">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M2 17L12 22L22 17" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M2 12L12 17L22 12" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            </div>
            <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">Welcome to Data2Int!</h1>
            <p style="color: rgba(255, 255, 255, 0.9); margin: 10px 0 0 0; font-size: 16px;">Your journey into intelligent data begins now</p>
        </div>

        <!-- Content -->
        <div style="padding: 40px 30px;">
            <h2 style="color: #1f2937; margin: 0 0 20px 0; font-size: 24px; font-weight: 600;">Almost there${firstName ? `, ${firstName}` : ''}!</h2>
            
            <p style="color: #4b5563; line-height: 1.6; margin: 0 0 20px 0; font-size: 16px;">
                Thank you for joining Data2Int! We're excited to help you unlock the power of your data with our advanced analytics platform.
            </p>
            
            <p style="color: #4b5563; line-height: 1.6; margin: 0 0 30px 0; font-size: 16px;">
                To complete your registration and secure your account, please verify your email address by clicking the button below:
            </p>

            <!-- CTA Button -->
            <div style="text-align: center; margin: 40px 0;">
                <a href="${confirmationUrl}" 
                   style="background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); 
                          color: #ffffff; 
                          text-decoration: none; 
                          padding: 16px 32px; 
                          border-radius: 8px; 
                          font-weight: 600; 
                          font-size: 16px; 
                          display: inline-block;
                          box-shadow: 0 4px 14px rgba(79, 70, 229, 0.3);">
                    ✉️ Verify My Email Address
                </a>
            </div>

            <!-- Alternative Link -->
            <div style="background-color: #f9fafb; border-radius: 8px; padding: 20px; margin: 30px 0;">
                <p style="color: #6b7280; font-size: 14px; margin: 0 0 10px 0; font-weight: 500;">
                    Button not working? Copy and paste this link:
                </p>
                <p style="margin: 0;">
                    <a href="${confirmationUrl}" 
                       style="color: #4f46e5; word-break: break-all; font-size: 14px; text-decoration: underline;">
                        ${confirmationUrl}
                    </a>
                </p>
            </div>

            <!-- What's Next -->
            <div style="border-left: 4px solid #4f46e5; padding-left: 20px; margin: 30px 0;">
                <h3 style="color: #1f2937; margin: 0 0 15px 0; font-size: 18px; font-weight: 600;">What's next?</h3>
                <ul style="color: #4b5563; margin: 0; padding-left: 20px; line-height: 1.6;">
                    <li style="margin-bottom: 8px;">Complete your profile setup</li>
                    <li style="margin-bottom: 8px;">Explore our data integration tools</li>
                    <li style="margin-bottom: 8px;">Connect your first data source</li>
                    <li>Start building powerful analytics dashboards</li>
                </ul>
            </div>

            <!-- Security Notice -->
            <div style="background-color: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 16px; margin: 30px 0;">
                <p style="color: #92400e; font-size: 14px; margin: 0; font-weight: 500;">
                    🔒 <strong>Security Notice:</strong> This verification link will expire in 24 hours for your protection. If you didn't create this account, you can safely ignore this email.
                </p>
            </div>
        </div>

        <!-- Footer -->
        <div style="background-color: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
            <p style="color: #6b7280; font-size: 14px; margin: 0 0 15px 0;">
                Need help? Contact our support team at 
                <a href="mailto:support@data2int.com" style="color: #4f46e5; text-decoration: none;">support@data2int.com</a>
            </p>
            
            <div style="margin: 20px 0;">
                <a href="https://elijah.data2int.com" style="color: #4f46e5; text-decoration: none; margin: 0 15px; font-size: 14px;">Website</a>
                <a href="https://docs.data2int.com" style="color: #4f46e5; text-decoration: none; margin: 0 15px; font-size: 14px;">Documentation</a>
                <a href="https://elijah.data2int.com/contact" style="color: #4f46e5; text-decoration: none; margin: 0 15px; font-size: 14px;">Contact Us</a>
            </div>
            
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 25px 0;">
            
            <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                © 2025 Data2Int. All rights reserved.<br>
                Transform your data. Empower your decisions.
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
            from: 'SAGE Project <noreply@data2int.com>',
            to: [body.email],
            subject: 'Welcome to Data2Int - Please confirm your email',
            html: emailHtml,
          }),
        })

        const emailResult = await emailResponse.json()
        console.log('Resend email result:', emailResult)

        if (!emailResponse.ok) {
          console.error('Failed to send email via Resend:', emailResult)
          // Don't fail the entire operation, just log the error
        } else {
          console.log('Confirmation email sent successfully via Resend')
        }

      } catch (emailError) {
        console.error('Email sending failed:', emailError)
        // Continue with success response even if email fails
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
      return new Response(JSON.stringify(successResponse), { headers })

    } catch (profileError) {
      console.error('Profile creation exception:', profileError)
      
      try {
        await supabaseAdmin.auth.admin.deleteUser(signUpData.user.id)
      } catch (cleanupError) {
        console.error('Cleanup failed:', cleanupError)
      }

      return new Response(JSON.stringify({
        error: 'User profile creation failed',
        details: profileError.message
      }), { status: 500, headers })
    }

  } catch (error) {
    console.error('=== SERVER ERROR ===')
    console.error('Server error:', error)
    
    return new Response(JSON.stringify({
      error: 'Server error',
      details: error.message
    }), { status: 500, headers })
  }
})