/**
 * -----------------------------------------------------------------------------
 * @name        create-portal-session
 * @description Creates a secure, temporary URL for the Stripe Customer Billing 
 * Portal. This allows authenticated users to manage their subscriptions, 
 * payment methods, and billing history without exposing any sensitive keys.
 * -----------------------------------------------------------------------------
 * @method      POST
 * @base_url    /functions/v1/create-portal-session
 * -----------------------------------------------------------------------------
 * @security    JWT Authentication is required. Uses the Anon Key pattern, relying 
 * on the user's JWT to enforce access control (RLS-Friendly pattern).
 * @flow        1. Authenticate user via JWT.
 * 2. Look up 'stripe_customer_id' in publicv2.users.
 * 3. Create Stripe Billing Portal session.
 * -----------------------------------------------------------------------------
 * @returns     { url: string } - The redirect URL for the Stripe Portal.
 * @env         SUPABASE_URL, SUPABASE_ANON_KEY, STRIPE_SECRET_KEY
 * @author      Elijah Furlonge
 * -----------------------------------------------------------------------------
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@13.11.0'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'), {
  apiVersion: '2023-10-16',
})

serve(async (req) => {
  // CORS Headers
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }

  if (req.method === 'OPTIONS') return new Response('ok', { headers })

  try {
    console.log(">>> [START] create-portal-session function invoked")

    // 1. Setup Supabase with PUBLICV2 Schema
    console.log("DEBUG: Checking Environment Variables:", {
        hasSupabaseUrl: !!Deno.env.get('SUPABASE_URL'),
        hasSupabaseKey: !!Deno.env.get('SUPABASE_ANON_KEY'),
        hasStripeKey: !!Deno.env.get('STRIPE_SECRET_KEY')
    })

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { 
        global: { headers: { Authorization: req.headers.get('Authorization')! } },
        db: { schema: 'publicv2' } // <--- Key Change: Sets schema to publicv2
      }
    )

    // 2. Get Current User
    console.log("DEBUG: Fetching user from Auth header...")
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError) {
        console.error("ERROR: Auth check failed:", authError)
        throw new Error('Authentication failed: ' + authError.message)
    }
    if (!user) {
        console.error("ERROR: No user found in session.")
        throw new Error('Not authenticated')
    }
    console.log(`DEBUG: User authenticated successfully. User ID: ${user.id}`)

    // 3. Get User's Stripe Customer ID from Database
    console.log(`DEBUG: Querying 'users' table (schema: publicv2) for auth_user_id: ${user.id}`)
    
    const { data: profile, error: dbError } = await supabase
      .from('users') 
      .select('stripe_customer_id, email') 
      .eq('auth_user_id', user.id)
      .single()

    if (dbError) {
      console.error("ERROR: Database query failed:", dbError)
      if (dbError.code === 'PGRST116') {
         throw new Error('User profile not found in database.')
      }
      throw new Error('Database error: ' + dbError.message)
    }

    console.log("DEBUG: Profile found:", profile)

    if (!profile?.stripe_customer_id) {
      console.error(`ERROR: User ${user.id} has no stripe_customer_id in DB.`)
      throw new Error('No billing account found. Please subscribe first to create a customer record.')
    }

    // 4. Create Stripe Portal Session
    // Use the origin from the request, or fallback to your site
    const returnUrl = req.headers.get('origin') || 'https://sageaios.com'
    console.log(`DEBUG: Creating Stripe Portal Session. Customer: ${profile.stripe_customer_id}, Return URL: ${returnUrl}`)

    const session = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: returnUrl, 
    })

    console.log("DEBUG: Stripe Session created successfully:", session.url)
    console.log(">>> [END] Function completed successfully")

    return new Response(JSON.stringify({ url: session.url }), { headers })

  } catch (err) {
    console.error(">>> [FATAL ERROR] Exception caught:", err)
    return new Response(JSON.stringify({ error: err.message }), { status: 400, headers })
  }
})