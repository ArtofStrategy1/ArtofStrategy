import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import Stripe from "https://esm.sh/stripe@13.11.0?target=deno"

// --- DEBUG: Environment Check ---
console.log("--- SERVER STARTUP ---")
console.log(`STRIPE_SECRET_KEY present: ${!!Deno.env.get('STRIPE_SECRET_KEY')}`)
console.log(`STRIPE_WEBHOOK_SIGNING_SECRET present: ${!!Deno.env.get('STRIPE_WEBHOOK_SIGNING_SECRET')}`)
console.log(`SUPABASE_URL present: ${!!Deno.env.get('SUPABASE_URL')}`)
console.log(`SUPABASE_SERVICE_ROLE_KEY present: ${!!Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`)
// --------------------------------

// Initialize Stripe
const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') as string, {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
})

const cryptoProvider = Stripe.createSubtleCryptoProvider()

serve(async (req) => {
  const requestId = crypto.randomUUID().split('-')[0] // Short ID for log correlation
  console.log(`[${requestId}] Incoming Request: ${req.method} ${req.url}`)

  // 1. Verify Request Signature
  const signature = req.headers.get('Stripe-Signature')
  console.log(`[${requestId}] Signature Header: ${signature ? 'Present' : 'Missing'}`)
  
  const body = await req.text()
  console.log(`[${requestId}] Body Length: ${body.length} chars`)
  
  let event
  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature!,
      Deno.env.get('STRIPE_WEBHOOK_SIGNING_SECRET')!,
      undefined,
      cryptoProvider
    )
    console.log(`[${requestId}] Event Verified: ${event.type} (ID: ${event.id})`)
  } catch (err) {
    console.error(`[${requestId}] ❌ Signature Verification Failed: ${err.message}`)
    return new Response(`Webhook Error: ${err.message}`, { status: 400 })
  }

  // 2. Initialize Supabase Admin
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { db: { schema: 'publicv2' } }
  )

  const dataObject = event.data.object as any

  try {
    switch (event.type) {
      
      // === A. NEW SUBSCRIPTION CREATED ===
      case 'checkout.session.completed': {
        const userId = dataObject.client_reference_id
        const customerId = dataObject.customer
        
        console.log(`[${requestId}] Handling 'checkout.session.completed'`)
        console.log(`[${requestId}] >> Found UserId: ${userId}`)
        console.log(`[${requestId}] >> Found CustomerId: ${customerId}`)

        if (userId && customerId) {
          console.log(`[${requestId}] >> Updating Supabase 'users'...`)
          const { error, data } = await supabase
            .from('users')
            .update({
              stripe_customer_id: customerId,
              tier: 'premium',
              status: 'active',
              cancel_at_period_end: false,
              current_period_end: null 
            })
            .eq('auth_user_id', userId)
            .select() // Add select to see if a row was actually matched

          if (error) {
            console.error(`[${requestId}] ❌ DB Update Error:`, error)
            throw error
          } else {
            console.log(`[${requestId}] ✅ User updated successfully. Rows affected: ${data?.length}`)
          }
        } else {
            console.warn(`[${requestId}] ⚠️ Missing userId or customerId, skipping update.`)
        }
        break
      }

      // === B. SUBSCRIPTION EXPIRED / DELETED ===
      case 'customer.subscription.deleted': {
        console.log(`[${requestId}] Handling 'customer.subscription.deleted'`)
        console.log(`[${requestId}] >> Customer: ${dataObject.customer}`)

        const { error, data } = await supabase
          .from('users')
          .update({
            tier: 'basic',
            plan_id: null,
            plan_name: null,
            status: 'canceled',
            cancel_at_period_end: false,
            current_period_end: null 
          })
          .eq('stripe_customer_id', dataObject.customer)
          .select()

        if (error) {
            console.error(`[${requestId}] ❌ DB Update Error:`, error)
            throw error
        } else {
            console.log(`[${requestId}] ✅ Subscription deleted in DB. Rows affected: ${data?.length}`)
        }
        break
      }

      // === C. SUBSCRIPTION UPDATED ===
      case 'customer.subscription.updated': {
        console.log(`[${requestId}] Handling 'customer.subscription.updated'`)
        console.log(`[${requestId}] >> Customer: ${dataObject.customer}`)

        const status = dataObject.status
        const priceId = dataObject.items?.data[0]?.price?.id 
        const cancelAtPeriodEnd = dataObject.cancel_at_period_end 
        
        console.log(`[${requestId}] >> Status: ${status}`)
        console.log(`[${requestId}] >> Price ID: ${priceId}`)
        console.log(`[${requestId}] >> Cancel At Period End: ${cancelAtPeriodEnd}`)

        // Date Conversion
        let currentPeriodEnd = null
        if (dataObject.current_period_end) {
           currentPeriodEnd = new Date(dataObject.current_period_end * 1000).toISOString()
        }
        console.log(`[${requestId}] >> Current Period End (ISO): ${currentPeriodEnd}`)

        // Handle different statuses
        if (status === 'canceled' || status === 'unpaid' || status === 'incomplete_expired') {
          console.log(`[${requestId}] >> Processing Downgrade/Cancellation...`)
          
          const { error } = await supabase.from('users')
            .update({ 
                tier: 'basic', 
                status: status, 
                plan_id: null,
                plan_name: null,
                cancel_at_period_end: false,
                current_period_end: null 
            })
            .eq('stripe_customer_id', dataObject.customer)
            
          if (error) console.error(`[${requestId}] ❌ Downgrade Error:`, error)
          else console.log(`[${requestId}] ✅ Downgrade processed.`)

        } else if (status === 'active' || status === 'trialing') {
          console.log(`[${requestId}] >> Processing Active/Trialing Update...`)
          
          let planName = 'Individual' 
          
          if (priceId) {
              console.log(`[${requestId}] >> Fetching plan name for priceId: ${priceId}`)
              const { data: planData, error: planError } = await supabase
                  .from('stripe_plans')
                  .select('name')
                  .eq('id', priceId)
                  .single()
              
              if (planError) {
                  console.warn(`[${requestId}] ⚠️ Plan lookup error (using default):`, planError.message)
              }

              if (planData && planData.name) {
                  planName = planData.name
                  console.log(`[${requestId}] >> Mapped Price ID to Name: ${planName}`)
              } else {
                  console.log(`[${requestId}] >> No plan name found, using default: ${planName}`)
              }
          }

          const updatePayload = {
            tier: 'premium',
            status: status,
            plan_id: priceId,
            plan_name: planName,
            cancel_at_period_end: cancelAtPeriodEnd,
            current_period_end: currentPeriodEnd
          }
          
          console.log(`[${requestId}] >> Update Payload:`, JSON.stringify(updatePayload))

          const { error } = await supabase.from('users')
            .update(updatePayload)
            .eq('stripe_customer_id', dataObject.customer)

          if (error) console.error(`[${requestId}] ❌ Active Update Error:`, error)
          else console.log(`[${requestId}] ✅ Active status updated.`)
        }
        break
      }
      
      default:
        console.log(`[${requestId}] ℹ️ Unhandled event type: ${event.type}`)
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json' },
    })

  } catch (err) {
    console.error(`[${requestId}] ❌ Database/Logic Error: ${err.message}`)
    if (err.stack) console.error(err.stack)
    return new Response(`Database Error: ${err.message}`, { status: 400 })
  }
})