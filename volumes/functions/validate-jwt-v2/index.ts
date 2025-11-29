/**
 * -----------------------------------------------------------------------------
 * @name        validate-jwt-v2
 * @description CORE SECURITY HELPER. This function is designed to be called 
 * internally by other Edge Functions (e.g., /statistics) that require a high 
 * degree of security and user context verification.
 * -----------------------------------------------------------------------------
 * @method      POST
 * @base_url    /functions/v1/validate-jwt-v2
 * -----------------------------------------------------------------------------
 * @security    Service Role Key is required. It performs **explicit, self-contained** * validation checks on a forwarded JWT:
 * 1. Checks JWT format, extracts payload (Base64 decode).
 * 2. Checks token expiration time (`exp` claim).
 * 3. Verifies user exists in the local **'users' profile table** using the JWT's `sub` (UUID).
 * -----------------------------------------------------------------------------
 * @payload     { headers: { authorization: 'Bearer ...' }, body?: object, method?: string }
 * @returns     { success: true, authenticated_user: object, shouldStop: false, ... } 
 * @error_model Returns a structured JSON response with `shouldStop: true` on failure 
 * (401 or 404), instructing the calling function to immediately halt.
 * -----------------------------------------------------------------------------
 * @env         SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * @author      Elijah Furlonge
 * -----------------------------------------------------------------------------
 */

import { serve } from 'https://deno.land/std@0.131.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

serve(async (req) => {
  const headers = new Headers({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Content-Type': 'application/json',
  })

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers })
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers }
    )
  }

  try {
    const body = await req.json()
    
    // Get the authorization header from the forwarded request
    const authHeader = body.headers?.authorization || body.headers?.Authorization

    if (!authHeader) {
      return new Response(
        JSON.stringify({
          error: 'No authorization header provided',
          status: 401,
          shouldStop: true
        }),
        { status: 401, headers }
      )
    }

    const token = authHeader.replace('Bearer ', '')

    if (!token) {
      return new Response(
        JSON.stringify({
          error: 'No token provided',
          status: 401,
          shouldStop: true
        }),
        { status: 401, headers }
      )
    }

    // Decode JWT without verification (to see the payload)
    let decodedPayload
    try {
      const base64Payload = token.split('.')[1]
      decodedPayload = JSON.parse(atob(base64Payload))
    } catch (error) {
      return new Response(
        JSON.stringify({
          error: 'Invalid token format',
          status: 401,
          shouldStop: true
        }),
        { status: 401, headers }
      )
    }
    
    console.log('JWT Payload:', decodedPayload)
    
    // Check if token is expired
    const currentTime = Math.floor(Date.now() / 1000)
    if (decodedPayload.exp && decodedPayload.exp < currentTime) {
      return new Response(
        JSON.stringify({
          error: 'Token has expired',
          current_time: currentTime,
          token_exp: decodedPayload.exp,
          status: 401,
          shouldStop: true
        }),
        { status: 401, headers }
      )
    }
    
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    //const supabase = createClient(supabaseUrl, supabaseKey)
    const supabase = createClient(supabaseUrl, supabaseKey, {
      db: { schema: 'publicv2' }
    })

    // Verify user exists in your users table
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, created_at')
      .eq('auth_user_id', decodedPayload.sub)
      .single()

    if (userError || !userData) {
      return new Response(
        JSON.stringify({
          error: 'User not found in database',
          status: 404,
          shouldStop: true
        }),
        { status: 404, headers }
      )
    }
    
    // Extract user information from the JWT
    const userId = decodedPayload.sub // Supabase user ID
    const userEmail = decodedPayload.email
    const userRole = decodedPayload.user_metadata?.role || 'user'
    
    // Return validated user info along with original request
    return new Response(
      JSON.stringify({
        success: true,
        // Original request data
        body: body.body || body,
        // Add authenticated user info
        authenticated_user: {
          id: userId,
          email: userEmail,
          role: userRole,
          token_exp: decodedPayload.exp,
          db_user_id: userData.id // Your internal user ID
        },
        // Original headers and method
        headers: body.headers,
        method: body.method,
        shouldStop: false
      }),
      { headers }
    )
    
  } catch (error) {
    console.error('JWT validation error:', error)
    return new Response(
      JSON.stringify({
        error: 'Server error during validation',
        details: error.message,
        status: 500,
        shouldStop: true
      }),
      { status: 500, headers }
    )
  }
})