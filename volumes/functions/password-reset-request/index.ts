// supabase/functions/password-reset-request/index.ts
import { serve } from 'https://deno.land/std@0.131.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

serve(async (req) => {
  console.log('=== PASSWORD RESET REQUEST HANDLER ===')
  
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
    console.log('Request body:', body)
    
    if (!body.email) {
      return new Response(JSON.stringify({ error: 'Email is required' }), { status: 400, headers })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || 'https://supabase.data2int.com'
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const resendApiKey = Deno.env.get('RESEND_API_KEY') || 're_iXKQvKau_8k3SJvk8NdULzUkLVo2Dod3B'

    if (!supabaseServiceKey) {
      return new Response(JSON.stringify({ error: 'Server config error' }), { status: 500, headers })
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      db: { schema: 'publicv2' }
    })

    console.log('=== STEP 1: CHECK IF USER EXISTS ===')
    
    // Check if user exists in both auth and profile
    let userId = null
    let firstName = ''
    
    try {
      // First check our profile table
      const { data: profileData, error: profileError } = await supabaseAdmin
        .from('users')
        .select('auth_user_id, first_name')
        .eq('email', body.email)
        .single()

      if (profileError || !profileData) {
        console.log('User not found in profile table')
        // Don't reveal if user exists - return success for security
        return new Response(JSON.stringify({
          success: true,
          message: 'If an account exists, a password reset link has been sent.',
        }), { headers })
      }

      userId = profileData.auth_user_id
      firstName = profileData.first_name || ''

      // Verify user exists in auth
      const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.getUserById(userId)

      if (authError || !authUser) {
        console.log('User not found in auth table')
        return new Response(JSON.stringify({
          success: true,
          message: 'If an account exists, a password reset link has been sent.',
        }), { headers })
      }

      console.log('User found:', authUser.user.email)

    } catch (error) {
      console.log('Error checking user:', error)
      return new Response(JSON.stringify({
        success: true,
        message: 'If an account exists, a password reset link has been sent.',
      }), { headers })
    }

    console.log('=== STEP 2: GENERATE CUSTOM RESET TOKEN ===')
    
    // Generate custom reset token
    const resetToken = crypto.randomUUID()
    const expirationTime = new Date(Date.now() + 60 * 60 * 1000) // 1 hour
    
    // Store token in user's app_metadata
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      app_metadata: {
        password_reset_token: resetToken,
        password_reset_expires_at: expirationTime.toISOString(),
        password_reset_requested_at: new Date().toISOString()
      }
    })

    if (updateError) {
      console.error('Failed to store reset token:', updateError)
      return new Response(JSON.stringify({
        success: true,
        message: 'If an account exists, a password reset link has been sent.',
      }), { headers })
    }

    console.log('Reset token generated and stored')

    // Create reset URL with your domain
    const resetUrl = `https://elijah.data2int.com/auth/reset-password?token=${resetToken}&email=${encodeURIComponent(body.email)}`

    console.log('=== STEP 3: SENDING EMAIL VIA RESEND ===')
    
    const emailHtml = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Password Reset - Data2Int</title>
    </head>
    <body style="background-color: #f8fafc; margin: 0; padding: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);">
            
            <div style="background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); padding: 40px 30px; text-align: center;">
                <div style="background-color: rgba(255, 255, 255, 0.1); width: 80px; height: 80px; border-radius: 50%; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center;">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </div>
                <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">Password Reset Request</h1>
                <p style="color: rgba(255, 255, 255, 0.9); margin: 10px 0 0 0; font-size: 16px;">Data2Int Account Security</p>
            </div>

            <div style="padding: 40px 30px;">
                <h2 style="color: #1f2937; margin: 0 0 20px 0; font-size: 24px; font-weight: 600;">Reset your password${firstName ? `, ${firstName}` : ''}</h2>
                <p style="color: #4b5563; line-height: 1.6; margin: 0 0 20px 0; font-size: 16px;">
                    Someone requested a password reset for your Data2Int account. If this was not you, please ignore this email.
                </p>
                <p style="color: #4b5563; line-height: 1.6; margin: 0 0 30px 0; font-size: 16px;">
                    To create a new password, click the button below. This link will expire in 1 hour for your security.
                </p>

                <div style="text-align: center; margin: 40px 0;">
                    <a href="${resetUrl}" 
                       style="background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); 
                              color: #ffffff; text-decoration: none; padding: 16px 32px; 
                              border-radius: 8px; font-weight: 600; font-size: 16px; 
                              display: inline-block; box-shadow: 0 4px 14px rgba(79, 70, 229, 0.3);">
                        🔒 Reset My Password
                    </a>
                </div>

                <div style="background-color: #f9fafb; border-radius: 8px; padding: 20px; margin: 30px 0;">
                    <p style="color: #6b7280; font-size: 14px; margin: 0 0 10px 0; font-weight: 500;">
                        Button not working? Copy and paste this link:
                    </p>
                    <p style="margin: 0;">
                        <a href="${resetUrl}" 
                           style="color: #4f46e5; word-break: break-all; font-size: 14px; text-decoration: underline;">
                            ${resetUrl}
                        </a>
                    </p>
                </div>

                <!-- Security Notice -->
                <div style="background-color: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 16px; margin: 30px 0;">
                    <p style="color: #92400e; font-size: 14px; margin: 0; font-weight: 500;">
                        🔒 <strong>Security Notice:</strong> This reset link will expire in 1 hour. If you didn't request this reset, please secure your account immediately.
                    </p>
                </div>
            </div>

            <div style="background-color: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
                <p style="color: #6b7280; font-size: 14px; margin: 0 0 15px 0;">
                    Need help? Contact our support team at 
                    <a href="mailto:support@data2int.com" style="color: #4f46e5; text-decoration: none;">support@data2int.com</a>
                </p>
                
                <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 25px 0;">
                
                <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                    © 2025 Data2Int. All rights reserved.<br>
                    Transform your data. Empower your decisions.
                </p>
            </div>
        </div>
    </body>
    </html>
    `
    
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
        subject: 'Reset your password for Data2Int',
        html: emailHtml,
      }),
    })

    if (!emailResponse.ok) {
        console.error('Failed to send email:', await emailResponse.json())
    } else {
        console.log('Password reset email sent successfully.')
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'If an account exists, a password reset link has been sent.',
    }), { headers })

  } catch (error) {
    console.error('=== SERVER ERROR ===', error)
    return new Response(JSON.stringify({
      error: 'Server error',
      details: error.message
    }), { status: 500, headers })
  }
})