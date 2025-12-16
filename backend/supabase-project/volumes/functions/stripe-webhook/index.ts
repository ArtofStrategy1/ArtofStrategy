/**
 * -----------------------------------------------------------------------------
 * @name        stripe-webhook
 * @description CRITICAL SYNC FUNCTION. Securely processes Stripe events to keep 
 * the user profile ('publicv2.users') and Auth metadata ('auth.users') 
 * synchronized with the user's billing status. Includes robust failsafe logic.
 * -----------------------------------------------------------------------------
 * @method      POST
 * @base_url    /functions/v1/stripe-webhook
 * -----------------------------------------------------------------------------
 * @security    Strict Signature Verification (Stripe-Signature) is MANDATORY. 
 * Requires Service Role Key for admin-level database and Auth updates.
 * @events_handled
 * 1. checkout.session.completed: Links 'stripe_customer_id' via 'client_reference_id' (auth_user_id).
 * 2. customer.subscription.created/updated: Syncs 'tier', 'status', 'plan_id', 'upgraded_at'.
 * 3. customer.subscription.deleted: Downgrades user to 'basic' tier.
 * @logic       Includes a **Race Condition Failsafe** (using Stripe API lookup 
 * and email fallback) if the user record isn't immediately found by Customer ID.
 * All updates are mirrored to Auth App/User Metadata via the `syncAuthMetadata` helper.
 * -----------------------------------------------------------------------------
 * @env         STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, 
 * SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * @author      Elijah Furlonge
 * -----------------------------------------------------------------------------
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import Stripe from "https://esm.sh/stripe@13.11.0?target=deno"

// --- DEBUG: Environment Check ---
const missingVars = []
if (!Deno.env.get('STRIPE_SECRET_KEY')) missingVars.push('STRIPE_SECRET_KEY')
if (!Deno.env.get('STRIPE_WEBHOOK_SECRET')) missingVars.push('STRIPE_WEBHOOK_SECRET')
if (!Deno.env.get('SUPABASE_URL')) missingVars.push('SUPABASE_URL')
if (!Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')) missingVars.push('SUPABASE_SERVICE_ROLE_KEY')

if (missingVars.length > 0) {
  console.error(`🚨 CRITICAL STARTUP ERROR: Missing Env Vars: ${missingVars.join(', ')}`)
} else {
  console.log(`🔍 Env Check Passed: All keys present.`)
}

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') as string, {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
})

const cryptoProvider = Stripe.createSubtleCryptoProvider()

Deno.serve(async (req) => {
  const reqId = crypto.randomUUID().split('-')[0]
  const timerLabel = `⏱️ [${reqId}] Duration`
  console.time(timerLabel)
  
  console.log(`\n=== 🟢 [${reqId}] WEBHOOK RECEIVED ===`)
  console.log(`ℹ️ [${reqId}] Method: ${req.method} | URL: ${req.url}`)

  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')
  const signature = req.headers.get('Stripe-Signature')
  
  // DEBUG: Header Inspection
  console.log(`ℹ️ [${reqId}] Headers - Signature Present: ${!!signature}, Length: ${signature?.length || 0}`)

  if (!webhookSecret || !signature) {
    console.error(`❌ [${reqId}] Config Error: Missing Webhook Secret or Signature header`)
    console.timeEnd(timerLabel)
    return new Response('Config Error', { status: 400 })
  }

  const body = await req.text()
  console.log(`ℹ️ [${reqId}] Body received. Length: ${body.length} chars`)

  let event

  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      webhookSecret,
      undefined,
      cryptoProvider
    )
    console.log(`✅ [${reqId}] Signature Verified Successfully.`)
  } catch (err) {
    console.error(`❌ [${reqId}] Signature Verification Failed: ${err.message}`)
    console.timeEnd(timerLabel)
    return new Response(`Webhook Error: ${err.message}`, { status: 400 })
  }

  // Initialize Supabase Admin
  console.log(`ℹ️ [${reqId}] Initializing Supabase Admin Client...`)
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { 
      db: { schema: 'publicv2' }, 
      auth: { persistSession: false, autoRefreshToken: false } 
    }
  )

  const d = event.data.object as any
  console.log(`ℹ️ [${reqId}] Event: ${event.type} | Resource ID: ${event.data.object.id}`)

  // Helper to sync Auth Metadata
  const syncAuthMetadata = async (authId: string, tier: string) => {
    console.log(`👉 [${reqId}][SyncAuth] Starting sync for AuthID: ${authId} -> Tier: ${tier}`)
    try {
      const payload = {
        app_metadata: { tier: tier, role: tier },
        user_metadata: { tier: tier, role: tier }
      }
      
      const { data, error } = await supabase.auth.admin.updateUserById(authId, payload)
      
      if (error) {
        console.error(`❌ [${reqId}][SyncAuth] Update Failed:`, error.message)
        console.error(`   [${reqId}][SyncAuth] Error Details:`, JSON.stringify(error))
      } else {
        console.log(`✅ [${reqId}][SyncAuth] Success. User metadata updated.`)
      }
    } catch (err) {
      console.error(`❌ [${reqId}][SyncAuth] EXCEPTION:`, err)
    }
  }

  try {
    switch (event.type) {
      // ============================================================
      // 1. CHECKOUT: Link User & Upgrade Metadata
      // ============================================================
      case 'checkout.session.completed': {
        console.log(`📂 [${reqId}] Processing 'checkout.session.completed'`)
        
        const userId = d.client_reference_id
        const customerId = d.customer
        const userEmail = d.customer_details?.email

        console.log(`🔍 [${reqId}] Extracted Data:`)
        console.log(`   - client_reference_id (auth_id): ${userId}`)
        console.log(`   - customer (stripe_id): ${customerId}`)
        console.log(`   - email: ${userEmail}`)

        if (!userId) {
          console.error(`❌ [${reqId}] CRITICAL: 'client_reference_id' is MISSING in session object.`)
          console.log(`   [${reqId}] Dump of session object keys: ${Object.keys(d).join(', ')}`)
          break
        }

        // 1a. Update Public Table
        console.log(`⏳ [${reqId}] DB: Updating publicv2.users where auth_user_id = ${userId}...`)
        
        const updatePayload = {
            stripe_customer_id: customerId,
            status: 'active',
            tier: 'premium',
            upgraded_at: new Date().toISOString()
        }

        // --- DEBUG: Explicit Payload Log ---
        console.log(`📦 [${reqId}] PRE-UPDATE PAYLOAD (Checkout):`)
        console.log(JSON.stringify(updatePayload, null, 2))

        const { error, count, data: dbData } = await supabase
          .from('users')
          .update(updatePayload)
          .eq('auth_user_id', userId)
          .select('id', { count: 'exact' }) // ensure we request count

        console.log(`   [${reqId}] DB Result: Count=${count}, Error=${error ? error.message : 'None'}`)

        if (error) {
          console.error(`❌ [${reqId}] DB Link Error Details:`, JSON.stringify(error))
        } else if (count === 0) {
          console.error(`⚠️ [${reqId}] Link Failed: User ${userId} not found in 'publicv2.users'.`)
          
          // Fallback: Try Email
          if (userEmail) {
            console.log(`🔄 [${reqId}] FALLBACK: Attempting Link by Email: ${userEmail}`)
            
            console.log(`📦 [${reqId}] PRE-UPDATE PAYLOAD (Fallback):`)
            console.log(JSON.stringify(updatePayload, null, 2))

            const { data: fallbackUser, error: emailErr } = await supabase
              .from('users')
              .update(updatePayload)
              .eq('email', userEmail)
              .select('auth_user_id')
              .single()
              
            if (emailErr) {
                 console.error(`❌ [${reqId}] Fallback DB Error:`, emailErr.message)
            }

            if (fallbackUser?.auth_user_id) {
              console.log(`✅ [${reqId}] Fallback Link Successful! Auth ID found: ${fallbackUser.auth_user_id}`)
              await syncAuthMetadata(fallbackUser.auth_user_id, 'premium')
            } else {
              console.error(`❌ [${reqId}] Fallback Link Failed. User not found by email or update failed.`)
            }
          } else {
             console.log(`⚠️ [${reqId}] No email available for fallback.`)
          }
        } else {
          console.log(`✅ [${reqId}] Database Linked Successfully (Row ID: ${dbData?.[0]?.id}).`)
          await syncAuthMetadata(userId, 'premium')
        }
        break
      }

      // ============================================================
      // 2. SUBSCRIPTION: Update Plan, Tier & Metadata
      // ============================================================
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        console.log(`📂 [${reqId}] Processing '${event.type}'`)

        const customerId = d.customer
        const status = d.status
        const productId = d.items?.data[0]?.price?.product
        
        console.log(`🔍 [${reqId}] Sub Update Context:`)
        console.log(`   - Customer: ${customerId}`)
        console.log(`   - Status: ${status}`)
        console.log(`   - Product ID: ${productId}`)

        // Determine Target Tier
        let newTier = 'basic'
        let dbPlanId = null

        if (['active', 'trialing', 'incomplete'].includes(status)) {
            newTier = 'premium'
            console.log(`   [${reqId}] Status '${status}' maps to 'premium'.`)
            
            // Map Plan ID
            if (productId) {
                console.log(`⏳ [${reqId}] DB: Looking up plan for product ${productId}...`)
                const { data: planData, error: planError } = await supabase
                    .from('stripe_plans')
                    .select('id')
                    .eq('stripe_product_id', productId)
                    .maybeSingle()
                
                if (planError) {
                    console.error(`❌ [${reqId}] Plan Lookup Error:`, planError.message)
                }

                if (planData) {
                    dbPlanId = planData.id
                    console.log(`✅ [${reqId}] Plan Found: ID ${dbPlanId}`)
                } else {
                    console.warn(`⚠️ [${reqId}] No plan found in 'stripe_plans' for product ${productId}`)
                }
            } else {
                console.log(`ℹ️ [${reqId}] No Product ID in subscription items.`)
            }
        } else {
            console.log(`   [${reqId}] Status '${status}' maps to 'basic'.`)
        }

        // 1. Update Public DB
        console.log(`⏳ [${reqId}] DB: Updating user by stripe_customer_id: ${customerId}`)
        
        const updatePayload = {
          tier: newTier,
          status: status,
          plan_id: dbPlanId,
          upgraded_at: new Date().toISOString()
        }

        // --- DEBUG: Explicit Payload Log ---
        console.log(`📦 [${reqId}] PRE-UPDATE PAYLOAD (Subscription):`)
        console.log(`   -> PLAN_ID to be inserted: ${dbPlanId}`) 
        console.log(JSON.stringify(updatePayload, null, 2))

        const { data: updatedUsers, error } = await supabase
            .from('users')
            .update(updatePayload)
            .eq('stripe_customer_id', customerId)
            .select('auth_user_id') 

        if (error) {
            console.error(`❌ [${reqId}] DB Update Failed:`, error.message)
        } 
        
        // Check if update actually hit a row
        if (!error && (!updatedUsers || updatedUsers.length === 0)) {
            // Race Condition Failsafe
            console.warn(`⚠️ [${reqId}] Race Condition: User not found by stripe_customer_id [${customerId}].`)
            console.log(`🔄 [${reqId}] Initiating Stripe Customer Lookup Failsafe...`)
            
            try {
                const stripeCustomer = await stripe.customers.retrieve(customerId)
                
                // Type guard for deleted customer
                if (stripeCustomer.deleted) {
                    console.error(`❌ [${reqId}] Stripe Customer ${customerId} is marked as deleted.`)
                } else {
                    console.log(`   [${reqId}] Stripe User Found. Email: ${stripeCustomer.email}`)
                    
                    if (stripeCustomer.email) {
                        const email = stripeCustomer.email
                        const failsafePayload = { 
                            tier: newTier,
                            status: status,
                            plan_id: dbPlanId,
                            stripe_customer_id: customerId, // IMPORTANT: Link the ID now
                            upgraded_at: new Date().toISOString()
                        }
                        
                        console.log(`⏳ [${reqId}] DB: Trying update via email '${email}'...`)
                        
                        // --- DEBUG: Explicit Payload Log (Failsafe) ---
                        console.log(`📦 [${reqId}] PRE-UPDATE PAYLOAD (Failsafe):`)
                        console.log(JSON.stringify(failsafePayload, null, 2))

                        const { data: retryData, error: retryError } = await supabase
                            .from('users')
                            .update(failsafePayload)
                            .eq('email', email)
                            .select('auth_user_id')
                            .single()

                        if (retryError) {
                            console.error(`❌ [${reqId}] Failsafe DB Update Error:`, retryError.message)
                        }

                        if (retryData?.auth_user_id) {
                            console.log(`✅ [${reqId}] Failsafe Recovery Successful!`)
                            await syncAuthMetadata(retryData.auth_user_id, newTier)
                        } else {
                            console.error(`❌ [${reqId}] Failsafe Failed. User email not found in DB.`)
                        }
                    } else {
                        console.warn(`⚠️ [${reqId}] Stripe Customer has no email. Cannot perform fallback lookup.`)
                    }
                }
            } catch (e) { 
                console.error(`❌ [${reqId}] Stripe Lookup Exception:`, e) 
            }
        } else if (updatedUsers && updatedUsers.length > 0) {
            // 2. Sync Metadata (Standard Flow)
            const authId = updatedUsers[0]?.auth_user_id
            if (authId) {
                console.log(`✅ [${reqId}] DB Update Success. Found Auth ID: ${authId}`)
                await syncAuthMetadata(authId, newTier)
            } else {
                console.warn(`⚠️ [${reqId}] DB Updated, but 'auth_user_id' column was null. Cannot sync metadata.`)
            }
        }
        break
      }

      // ============================================================
      // 3. DELETION
      // ============================================================
      case 'customer.subscription.deleted': {
        console.log(`📂 [${reqId}] Processing 'customer.subscription.deleted'`)
        console.log(`🗑️ [${reqId}] Target Customer: ${d.customer}`)
        
        console.log(`⏳ [${reqId}] DB: Downgrading user to basic...`)
        
        const deletePayload = { tier: 'basic', plan_id: null, status: 'canceled' }
        console.log(`📦 [${reqId}] PRE-UPDATE PAYLOAD (Deletion):`)
        console.log(JSON.stringify(deletePayload, null, 2))

        const { data: deletedUser, error: delError } = await supabase
          .from('users')
          .update(deletePayload)
          .eq('stripe_customer_id', d.customer)
          .select('auth_user_id')
          .single()

        if (delError) {
             console.error(`❌ [${reqId}] DB Downgrade Error:`, delError.message)
        }

        if (deletedUser?.auth_user_id) {
             console.log(`✅ [${reqId}] Downgrade complete. Syncing auth metadata...`)
             await syncAuthMetadata(deletedUser.auth_user_id, 'basic')
        } else {
             console.warn(`⚠️ [${reqId}] User not found for downgrade or auth_user_id missing.`)
        }
        break
      }
      
      default:
        console.log(`ℹ️ [${reqId}] Unhandled Event Type: ${event.type}. Skipping.`)
    }

    console.log(`=== 🏁 [${reqId}] WEBHOOK COMPLETE ===`)
    console.timeEnd(timerLabel)
    
    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json' },
    })

  } catch (err) {
    console.error(`❌ [${reqId}] FATAL UNCAUGHT ERROR: ${err.message}`)
    console.error(err)
    console.timeEnd(timerLabel)
    return new Response(`Server Error: ${err.message}`, { status: 400 })
  }
})