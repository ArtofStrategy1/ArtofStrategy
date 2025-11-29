/**
 * -----------------------------------------------------------------------------
 * @name        insert-contact
 * @description Handles anonymous submissions from the public contact form.
 * Performs rigorous validation on all required fields (name, email, subject, 
 * message) before inserting the record into the 'contacts' table (publicv2).
 * -----------------------------------------------------------------------------
 * @method      POST
 * @base_url    /functions/v1/insert-contact
 * -----------------------------------------------------------------------------
 * @security    Service Role Key is required to perform the insert operation, 
 * allowing submissions from unauthenticated users.
 * @payload     { 
 * first_name: string, 
 * last_name: string, 
 * email: string, 
 * subject: string, 
 * message: string, 
 * company_name?: string, 
 * phone?: string 
 * }
 * @returns     { success: true, message: string, contact: { ... } }
 * @errors      400 Validation Error, 405 Method Not Allowed, 500 Server Error
 * -----------------------------------------------------------------------------
 * @env         SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * @author      Elijah Furlonge
 * -----------------------------------------------------------------------------
 */

import { serve } from 'https://deno.land/std@0.131.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

serve(async (req) => {
  // CORS headers
  const headers = new Headers({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Content-Type': 'application/json',
  })

  // Handle preflight CORS request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers })
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers }
    )
  }

  try {
    // Initialize Supabase client - following your project pattern
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    const supabase = createClient(supabaseUrl, supabaseKey, {
      db: { schema: 'publicv2' }
    })

    // Parse request body
    const body = await req.json()

    // Validate required fields
    const { first_name, last_name, company_name, email, phone, subject, message } = body

    if (!first_name || typeof first_name !== 'string' || first_name.trim().length === 0) {
      return new Response(
        JSON.stringify({
          error: 'Validation error',
          details: 'First name is required and must be a non-empty string'
        }),
        { status: 400, headers }
      )
    }

    if (!last_name || typeof last_name !== 'string' || last_name.trim().length === 0) {
      return new Response(
        JSON.stringify({
          error: 'Validation error',
          details: 'Last name is required and must be a non-empty string'
        }),
        { status: 400, headers }
      )
    }

    if (!email || typeof email !== 'string' || email.trim().length === 0) {
      return new Response(
        JSON.stringify({
          error: 'Validation error',
          details: 'Email is required and must be a non-empty string'
        }),
        { status: 400, headers }
      )
    }

    // Basic email validation
    const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/
    if (!emailRegex.test(email.trim())) {
      return new Response(
        JSON.stringify({
          error: 'Validation error',
          details: 'Invalid email format'
        }),
        { status: 400, headers }
      )
    }

    if (!subject || typeof subject !== 'string' || subject.trim().length === 0) {
      return new Response(
        JSON.stringify({
          error: 'Validation error',
          details: 'Subject is required and must be a non-empty string'
        }),
        { status: 400, headers }
      )
    }

    if (!message || typeof message !== 'string' || message.trim().length < 5) {
      return new Response(
        JSON.stringify({
          error: 'Validation error',
          details: 'Message is required and must be at least 5 characters long'
        }),
        { status: 400, headers }
      )
    }

    // Validate optional fields if provided
    if (company_name && typeof company_name === 'string' && company_name.trim().length === 0) {
      // Allow empty string, will be converted to null in insert
    } else if (company_name && typeof company_name !== 'string') {
      return new Response(
        JSON.stringify({
          error: 'Validation error',
          details: 'Company name must be a string if provided'
        }),
        { status: 400, headers }
      )
    }

    if (phone && typeof phone === 'string' && phone.trim().length === 0) {
      // Allow empty string, will be converted to null in insert
    } else if (phone && typeof phone !== 'string') {
      return new Response(
        JSON.stringify({
          error: 'Validation error',
          details: 'Phone must be a string if provided'
        }),
        { status: 400, headers }
      )
    }

    // Insert contact into the database
    const { data: contactData, error: insertError } = await supabase
      .from('contacts')
      .insert({
        first_name: first_name.trim(),
        last_name: last_name.trim(),
        company_name: company_name && company_name.trim() !== '' ? company_name.trim() : null,
        email: email.trim().toLowerCase(),
        phone: phone && phone.trim() !== '' ? phone.trim() : null,
        subject: subject.trim(),
        message: message.trim(),
        is_approved: false
      })
      .select()
      .single()

    if (insertError) {
      return new Response(
        JSON.stringify({
          error: 'Database error',
          details: 'Failed to save contact form. Please try again later.'
        }),
        { status: 500, headers }
      )
    }

    // Return success response
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Contact form submitted successfully',
        contact: {
          id: contactData.id,
          created_at: contactData.created_at,
          first_name: contactData.first_name,
          last_name: contactData.last_name,
          email: contactData.email,
          subject: contactData.subject
        }
      }),
      { headers }
    )

  } catch (error) {
    // Handle unexpected errors
    return new Response(
      JSON.stringify({
        error: 'Server error',
        details: error.message
      }),
      { status: 500, headers }
    )
  }
})