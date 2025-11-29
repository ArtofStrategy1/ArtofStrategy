import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import Stripe from "https://esm.sh/stripe@13.11.0?target=deno"

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') as string, {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
})

const cryptoProvider = Stripe.createSubtleCryptoProvider()

Deno.serve(async (req) => {
  const reqId = crypto.randomUUID().split('-')[0]
  console.log(`\n=== 🟢 [${reqId}] WEBHOOK RECEIVED ===`)

  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')
  const signature = req.headers.get('Stripe-Signature')
  
  if (!webhookSecret || !signature) {
    console.error(`❌ [${reqId}] Config Error: Missing Webhook Secret`)
    return new Response('Config Error', { status: 400 })
  }

  const body = await req.text()
  let event

  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      webhookSecret,
      undefined,
      cryptoProvider
    )
  } catch (err) {
    console.error(`❌ [${reqId}] Signature Verification Failed: ${err.message}`)
    return new Response(`Webhook Error: ${err.message}`, { status: 400 })
  }

  // Initialize Supabase Admin
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { 
      db: { schema: 'publicv2' }, 
      auth: { persistSession: false, autoRefreshToken: false } 
    }
  )

  const d = event.data.object as any
  console.log(`ℹ️ [${reqId}] Event: ${event.type} | ID: ${event.id}`)

  // Helper to sync Auth Metadata
  const syncAuthMetadata = async (authId: string, tier: string) => {
    try {
      console.log(`🔄 [${reqId}] Syncing Auth Metadata for ${authId} to '${tier}'...`)
      const { error } = await supabase.auth.admin.updateUserById(authId, {
        app_metadata: { tier: tier, role: tier }, // Sync role as well if you use it
        user_metadata: { tier: tier, role: tier }
      })
      if (error) console.error(`❌ [${reqId}] Metadata Sync Failed:`, error.message)
      else console.log(`✅ [${reqId}] Metadata Synced.`)
    } catch (err) {
      console.error(`❌ [${reqId}] Metadata Sync Exception:`, err)
    }
  }

  try {
    switch (event.type) {
      // ============================================================
      // 1. CHECKOUT: Link User & Upgrade Metadata
      // ============================================================
      case 'checkout.session.completed': {
        const userId = d.client_reference_id
        const customerId = d.customer
        const userEmail = d.customer_details?.email

        console.log(`🔍 [${reqId}] Checkout Context: User[${userId}] | Cust[${customerId}]`)

        if (!userId) {
          console.error(`❌ [${reqId}] CRITICAL: No client_reference_id in session!`)
          break
        }

        // 1a. Update Public Table
        const { error, count } = await supabase
          .from('users')
          .update({
            stripe_customer_id: customerId,
            status: 'active',
            tier: 'premium'
          })
          .eq('auth_user_id', userId)
          .select('id', { count: 'exact' })

        if (error) {
          console.error(`❌ [${reqId}] DB Link Error:`, error)
        } else if (count === 0) {
          console.error(`⚠️ [${reqId}] Link Failed: User ${userId} not found in DB.`)
          
          // Fallback: Try Email
          if (userEmail) {
            console.log(`🔄 [${reqId}] Attempting Fallback Link by Email: ${userEmail}`)
            // We need to select auth_user_id to update metadata
            const { data: fallbackUser, error: emailErr } = await supabase
              .from('users')
              .update({ stripe_customer_id: customerId, status: 'active', tier: 'premium' })
              .eq('email', userEmail)
              .select('auth_user_id')
              .single()
              
            if (fallbackUser?.auth_user_id) {
              console.log(`✅ [${reqId}] Fallback Link Successful!`)
              // Sync Metadata via Fallback ID
              await syncAuthMetadata(fallbackUser.auth_user_id, 'premium')
            } else {
              console.error(`❌ [${reqId}] Fallback Link Failed. User missing.`)
            }
          }
        } else {
          console.log(`✅ [${reqId}] Database Linked.`)
          // 1b. Sync Metadata (Primary Path)
          await syncAuthMetadata(userId, 'premium')
        }
        break
      }

      // ============================================================
      // 2. SUBSCRIPTION: Update Plan, Tier & Metadata
      // ============================================================
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const customerId = d.customer
        const status = d.status
        const productId = d.items?.data[0]?.price?.product
        
        const cancelAtPeriodEnd = d.cancel_at_period_end
        let currentPeriodEnd = null
        if (d.current_period_end) {
           currentPeriodEnd = new Date(d.current_period_end * 1000).toISOString()
        }

        console.log(`🔍 [${reqId}] Sub Update: Cust[${customerId}] | Status[${status}]`)

        // Determine Target Tier
        let newTier = 'basic'
        let dbPlanId = null

        if (['active', 'trialing', 'incomplete'].includes(status)) {
            newTier = 'premium'
            // Map Plan ID
            if (productId) {
                const { data: planData } = await supabase
                    .from('stripe_plans')
                    .select('id')
                    .eq('stripe_product_id', productId)
                    .maybeSingle()
                if (planData) dbPlanId = planData.id
            }
        }

        // 1. Update Public DB and RETURN auth_user_id
        const { data: updatedUsers, error } = await supabase
            .from('users')
            .update({
              tier: newTier,
              status: status,
              plan_id: dbPlanId,
              cancel_at_period_end: cancelAtPeriodEnd,
              current_period_end: currentPeriodEnd
            })
            .eq('stripe_customer_id', customerId)
            .select('auth_user_id') // Important: We need this ID to update metadata

        if (error) {
            console.error(`❌ [${reqId}] DB Update Failed:`, error)
        } else if (!updatedUsers || updatedUsers.length === 0) {
            // Race Condition Failsafe (Same as before)
            console.warn(`⚠️ [${reqId}] Race Condition: Customer ID not found. Trying Email...`)
            try {
                const stripeCustomer = await stripe.customers.retrieve(customerId)
                if (stripeCustomer && !stripeCustomer.deleted && stripeCustomer.email) {
                    const email = stripeCustomer.email
                    const { data: retryData } = await supabase
                        .from('users')
                        .update({ 
                            tier: newTier,
                            status: status,
                            plan_id: dbPlanId,
                            cancel_at_period_end: cancelAtPeriodEnd,
                            current_period_end: currentPeriodEnd,
                            stripe_customer_id: customerId 
                        })
                        .eq('email', email)
                        .select('auth_user_id')
                        .single()

                    if (retryData?.auth_user_id) {
                        console.log(`✅ [${reqId}] Failsafe Success.`)
                        await syncAuthMetadata(retryData.auth_user_id, newTier)
                    } else {
                        console.error(`❌ [${reqId}] Failsafe Failed.`)
                    }
                }
            } catch (e) { console.error(`❌ [${reqId}] Stripe Lookup Error:`, e) }
        } else {
            // 2. Sync Metadata (Standard Path)
            // Note: updatedUsers is an array because .select() returns an array by default
            const authId = updatedUsers[0]?.auth_user_id
            if (authId) {
                console.log(`✅ [${reqId}] DB Updated. Syncing Metadata...`)
                await syncAuthMetadata(authId, newTier)
            } else {
                console.warn(`⚠️ [${reqId}] DB Updated, but auth_user_id was null. Cannot sync metadata.`)
            }
        }
        break
      }

      // ============================================================
      // 3. DELETION
      // ============================================================
      case 'customer.subscription.deleted': {
        console.log(`🗑️ [${reqId}] Sub Deleted: ${d.customer}`)
        
        const { data: deletedUser } = await supabase
          .from('users')
          .update({ tier: 'basic', plan_id: null, status: 'canceled' })
          .eq('stripe_customer_id', d.customer)
          .select('auth_user_id')
          .single()

        if (deletedUser?.auth_user_id) {
            await syncAuthMetadata(deletedUser.auth_user_id, 'basic')
        }
        break
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json' },
    })

  } catch (err) {
    console.error(`❌ [${reqId}] Fatal Error: ${err.message}`)
    return new Response(`Server Error: ${err.message}`, { status: 400 })
  }
})