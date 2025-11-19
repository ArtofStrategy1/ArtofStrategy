import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@13.11.0'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
})

// Create two clients - one for each schema
const supabasePublic = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  {
    db: { schema: 'public' } // For Stripe tables
  }
)

const supabaseV2 = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  {
    db: { schema: 'publicv2' } // For users table
  }
)

serve(async (req) => {
  const { method } = req

  if (method === 'OPTIONS') {
    return new Response('ok', { 
      headers: { 
        'Access-Control-Allow-Origin': '*', 
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' 
      } 
    })
  }

  try {
    if (method !== 'POST') {
      throw new Error('Method not allowed')
    }

    // Get the authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new Error('Unauthorized - JWT token required')
    }

    const token = authHeader.replace('Bearer ', '')
    
    // Get user from token using the main auth client
    const { data: { user }, error: userError } = await supabasePublic.auth.getUser(token)
    if (userError || !user) {
      console.error('Auth error:', userError)
      throw new Error('Unauthorized')
    }

    console.log('Authenticated user:', user.email)

    const { amount, currency = 'usd' } = await req.json()

    if (!amount || amount < 50) {
      throw new Error('Amount must be at least $0.50')
    }

    // Create or get Stripe customer - look in public.customers table
    console.log('Looking for customer with user_id:', user.id)
    let { data: customer, error: customerError } = await supabasePublic
      .from('customers')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .single()

    console.log('Customer query result:', { customer, customerError })

    if (!customer) {
      console.log('Creating new Stripe customer for user:', user.email)
      
      // Create Stripe customer
      const stripeCustomer = await stripe.customers.create({
        email: user.email,
        metadata: { supabase_user_id: user.id }
      })

      console.log('Created Stripe customer:', stripeCustomer.id)

      // Insert into public.customers table (references auth.users directly)
      const { data: newCustomer, error: insertError } = await supabasePublic
        .from('customers')
        .insert({
          user_id: user.id, // This references auth.users(id) directly
          stripe_customer_id: stripeCustomer.id,
          email: user.email
        })
        .select()
        .single()

      if (insertError) {
        console.error('Customer insert error:', insertError)
        throw new Error(`Failed to create customer record: ${insertError.message}`)
      }

      customer = newCustomer
      console.log('Created customer record:', customer)
    }

    // Create payment intent
    console.log('Creating payment intent for customer:', customer.stripe_customer_id)
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency,
      customer: customer.stripe_customer_id,
      metadata: { supabase_user_id: user.id }
    })

    console.log('Created payment intent:', paymentIntent.id)

    // Store payment intent in public.payment_intents table
    const { data: paymentRecord, error: paymentError } = await supabasePublic
      .from('payment_intents')
      .insert({
        stripe_payment_intent_id: paymentIntent.id,
        user_id: user.id, // This also references auth.users(id) directly
        amount,
        currency,
        status: paymentIntent.status
      })
      .select()
      .single()

    if (paymentError) {
      console.error('Payment intent insert error:', paymentError)
      // Don't fail here, just log the error
    } else {
      console.log('Created payment intent record:', paymentRecord)
    }

    return new Response(
      JSON.stringify({ client_secret: paymentIntent.client_secret }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      }
    )
  } catch (error) {
    console.error('Function error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      }
    )
  }
})