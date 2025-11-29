/**
 * -----------------------------------------------------------------------------
 * @name        admin-send-email
 * @description Securely sends HTML emails via Resend API. 
 * Enforces 3 layers of security before sending:
 * 1. Valid Supabase JWT (Auth Header)
 * 2. Email Allowlist (Check vs ADMIN_EMAILS env var)
 * 3. DB Role Check (Must be 'admin' in 'publicv2.users')
 * @method      POST
 * @route       /functions/v1/send-email
 * -----------------------------------------------------------------------------
 * @payload     { 
 * to: string, 
 * message: string, 
 * subject?: string,          // Optional override
 * original_subject?: string  // For "Re: ..." subject lines
 * }
 * @returns     { success: true, data: ResendResponse } or 401/403/500 Error
 * -----------------------------------------------------------------------------
 * @env         RESEND_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ADMIN_EMAILS
 * @author      Elijah Furlonge
 * -----------------------------------------------------------------------------
 */

import { serve } from 'https://deno.land/std@0.131.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

const ALLOWED_ADMIN_EMAILS = Deno.env.get('ADMIN_EMAILS')?.split(',').map(email => email.trim()) || [];

serve(async (req) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Content-Type': 'application/json',
  }

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers })
  }

  try {
    // 1. Initialize Supabase Client
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
      db: { schema: 'publicv2' }
    })

    // ------------------------------------------------------------------
    // SECURITY LAYER 1: JWT token verification
    // ------------------------------------------------------------------
    const authHeader = req.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({
        error: 'Unauthorized - JWT token required'
      }), { status: 401, headers })
    }

    const token = authHeader.substring(7)
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      return new Response(JSON.stringify({
        error: 'Unauthorized - Invalid JWT token'
      }), { status: 401, headers })
    }

    // ------------------------------------------------------------------
    // SECURITY LAYER 2: Email whitelist verification
    // ------------------------------------------------------------------
    if (!ALLOWED_ADMIN_EMAILS.includes(user.email)) {
      console.warn(`Unauthorized access attempt by: ${user.email}`)
      return new Response(JSON.stringify({
        error: 'Access denied - Email not authorized'
      }), { status: 403, headers })
    }

    // ------------------------------------------------------------------
    // SECURITY LAYER 3: Database admin tier verification
    // ------------------------------------------------------------------
    const { data: adminUser, error: adminCheckError } = await supabase
      .from('users')
      .select('tier, email')
      .eq('auth_user_id', user.id)
      .single()

    if (adminCheckError || !adminUser || adminUser.tier !== 'admin') {
      console.warn(`Non-admin tier attempt by: ${user.email}`)
      return new Response(JSON.stringify({
        error: 'Access denied - Admin privileges required'
      }), { status: 403, headers })
    }

    // ------------------------------------------------------------------
    // BUSINESS LOGIC: Send Email
    // ------------------------------------------------------------------
    if (req.method === 'POST') {
      const { to, subject, message, original_subject } = await req.json()

      // Basic Input Validation
      if (!to || !message) {
        return new Response(JSON.stringify({ 
          error: 'Missing required fields: to, message' 
        }), { status: 400, headers })
      }

      // Construct Subject
      const emailSubject = subject || `Re: ${original_subject || 'Your Inquiry at S.A.G.E.'}`

      // Construct Professional HTML Body
      const emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: sans-serif; color: #333; line-height: 1.6; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: #4f46e5; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
                .content { border: 1px solid #e5e7eb; border-top: none; padding: 30px; border-radius: 0 0 8px 8px; background: #fff; }
                .footer { margin-top: 20px; font-size: 12px; color: #666; text-align: center; }
                .quote { border-left: 3px solid #e5e7eb; padding-left: 15px; color: #666; font-style: italic; margin: 20px 0; }
            </style>
        </head>
        <body style="background-color: #f3f4f6;">
            <div class="container">
                <div class="header">
                    <h2 style="margin:0;">Response from S.A.G.E. Support</h2>
                </div>
                <div class="content">
                    <p>Hello,</p>
                    <p>${message.replace(/\n/g, '<br>')}</p>
                    
                    <br>
                    <p>Best regards,<br>The S.A.G.E. Admin Team</p>
                    
                    <div class="quote">
                        <strong>Regarding your inquiry:</strong><br>
                        "${original_subject || 'Contact Form Submission'}"
                    </div>
                </div>
                <div class="footer">
                    &copy; ${new Date().getFullYear()} Data2Int. All rights reserved.
                </div>
            </div>
        </body>
        </html>`

      console.log(`Sending secure email to ${to} via Resend...`)

      const resendRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: 'SAGE Support <noreply@data2int.com>',
          to: [to],
          subject: emailSubject,
          html: emailHtml,
        }),
      })

      const resendData = await resendRes.json()

      if (!resendRes.ok) {
        console.error('Resend API Error:', resendData)
        throw new Error(resendData.message || 'Failed to send email provider')
      }

      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Email sent successfully',
        data: resendData,
        authenticated_admin: user.email
      }), { status: 200, headers })
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers })

  } catch (error) {
    console.error('Secure Function Error:', error)
    return new Response(JSON.stringify({ 
      error: 'Internal server error', 
      details: error.message 
    }), { status: 500, headers })
  }
})