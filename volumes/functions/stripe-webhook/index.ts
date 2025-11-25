import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@13.11.0'

console.log("--- [Webhook] Function script loaded ---")

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
})

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', // Requires SERVICE_ROLE_KEY for admin functions
  { db: { schema: 'publicv2' } }
)

serve(async (req) => {
  const signature = req.headers.get('stripe-signature')
  if (!signature) return new Response('No signature', { status: 400 })

  const body = await req.text()
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')
  let event

  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret!)
  } catch (err) {
    console.error(`Webhook Signature Error: ${err.message}`)
    return new Response(`Webhook Error: ${err.message}`, { status: 400 })
  }

  try {
    const session = event.data.object
    const userUuid = session.client_reference_id 
    const customerId = session.customer

    // 1. Handle Successful Payment (Checkout Completed)
    if (event.type === 'checkout.session.completed') {
      console.log("--- [Webhook] Checkout Completed ---")

      if (userUuid) {
        // --- DATA INTEGRITY: Update publicv2.users (Source of Truth) ---
        const { error: dbError } = await supabase
          .from('users')
          .update({ 
            tier: 'premium',
            status: 'active',
            stripe_customer_id: customerId,
            plan_id: session.metadata?.plan_id || 'premium',
            upgraded_at: new Date().toISOString()
          })
          .eq('auth_user_id', userUuid)

        if (dbError) {
            console.error('DB Table Update Failed:', dbError)
            throw dbError
        }
        
        // --- FRONTEND OPTIMIZATION: Update Auth Metadata (Fast Check) ---
        // This makes the user's session object immediately reflect their new tier
        const { error: authError } = await supabase.auth.admin.updateUserById(
            userUuid, {
                app_metadata: {
                    tier: 'premium',
                    role: 'premium' 
                }
            }
        );

        if (authError) {
            console.error('Auth Metadata Update Failed (Ignore if user is unconfirmed):', authError)
        }
        
        console.log("Success! User tier and metadata upgraded to Premium.")

      } else {
          console.warn('No client_reference_id found. Payment was for an anonymous/untracked user.')
      }
    }

    // 2. Handle Cancellations/Updates
    if (event.type === 'customer.subscription.deleted') {
      const customerId = session.customer
      
      // Update publicv2.users to 'basic'
      const { data: userData, error: dbError } = await supabase
        .from('users')
        .update({ 
            tier: 'basic',
            status: 'active'
        })
        .eq('stripe_customer_id', customerId)
        .select('auth_user_id') // Get UUID to update metadata

      if (dbError) throw dbError

      // Update Auth Metadata to 'basic' (if user found)
      if (userData?.length) {
          await supabase.auth.admin.updateUserById(
              userData[0].auth_user_id, {
                  app_metadata: { tier: 'basic', role: 'basic' }
              }
          );
      }
    }

    return new Response(JSON.stringify({ received: true }), { 
        headers: { 'Content-Type': 'application/json' },
        status: 200 
    })

  } catch (err) {
    console.error(`Logic Error: ${err.message}`)
    return new Response(JSON.stringify({ error: err.message }), { status: 400 })
  }
})