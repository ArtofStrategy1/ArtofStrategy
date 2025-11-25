import { serve } from 'https://deno.land/std@0.131.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'
import Stripe from 'https://esm.sh/stripe@13.11.0'

console.log("[Init] Starting stripe-sync-full...")

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
})

serve(async (req) => {
  // 1. CORS & Options
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
  if (req.method === 'OPTIONS') return new Response('ok', { headers })

  try {
    // 2. Admin Security Check (Copy-pasted from previous function)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const authHeader = req.headers.get('authorization')
    if (!authHeader) throw new Error('Missing auth header')
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    
    if (authError || !user) throw new Error('Invalid token')

    // Check Whitelist (Add your email here)
    const ALLOWED_ADMIN_EMAILS = Deno.env.get('ADMIN_EMAILS')?.split(',').map(email => email.trim()) || [];
    if (!ALLOWED_EMAILS.includes(user.email ?? '')) throw new Error('Unauthorized email')

    console.log(`[Auth] Admin ${user.email} authorized to sync.`)

    // 3. SYNC LOGIC
    const results = { products: 0, prices: 0, customers: 0, subscriptions: 0, errors: [] as string[] }

    // --- A. Sync Products ---
    console.log("Syncing Products...")
    const products = await stripe.products.list({ limit: 100, active: true })
    for (const product of products.data) {
      const { error } = await supabaseAdmin
        .from('products')
        .upsert({
          id: product.id,
          active: product.active,
          name: product.name,
          description: product.description,
          image: product.images?.[0] || null,
          metadata: product.metadata
        })
      if (error) results.errors.push(`Product ${product.id}: ${error.message}`)
      else results.products++
    }

    // --- B. Sync Prices ---
    console.log("Syncing Prices...")
    const prices = await stripe.prices.list({ limit: 100, active: true })
    for (const price of prices.data) {
      const { error } = await supabaseAdmin
        .from('prices')
        .upsert({
          id: price.id,
          product_id: typeof price.product === 'string' ? price.product : price.product.id,
          active: price.active,
          currency: price.currency,
          description: price.nickname,
          type: price.type,
          unit_amount: price.unit_amount,
          interval: price.recurring?.interval,
          interval_count: price.recurring?.interval_count,
          trial_period_days: price.recurring?.trial_period_days,
          metadata: price.metadata
        })
      if (error) results.errors.push(`Price ${price.id}: ${error.message}`)
      else results.prices++
    }

    // --- C. Sync Customers (The Tricky Part) ---
    console.log("Syncing Customers...")
    // Note: We fetch ALL customers from Stripe to find matches
    const stripeCustomers = await stripe.customers.list({ limit: 100 })
    
    for (const cust of stripeCustomers.data) {
      const email = cust.email
      if (!email) continue // Skip if no email in Stripe

      // Find matching Supabase Auth User
      // We use admin.listUsers to find the UUID for this email
      // Note: This is efficient for small batches, but listing ALL users is heavy for huge apps.
      // A direct DB query to auth.users via Supabase Admin Client isn't standard, 
      // so we assume the email matches an existing user.
      
      // Hack: We try to find the user ID from the `auth.users` table directly if using Service Role 
      // (Requires schema permissions), OR we assume you want to skip orphaned customers.
      // Here we will try to map based on your existing Auth Users.
      
      // We'll actually skip the explicit lookup loop for performance and use an RPC or direct insert 
      // if we knew the ID. Since we don't, we'll look them up one by one (slow but safe).
      const { data: users } = await supabaseAdmin.auth.admin.listUsers()
      const match = users.users.find(u => u.email?.toLowerCase() === email.toLowerCase())

      if (match) {
        const { error } = await supabaseAdmin
          .from('customers')
          .upsert({
            id: match.id, // The UUID from Supabase Auth
            stripe_customer_id: cust.id,
            email: email
          })
        if (error) results.errors.push(`Customer ${email}: ${error.message}`)
        else results.customers++
      } else {
        // Optional: Create a user? No, too risky for a sync script.
        console.log(`Skipping Stripe Customer ${email} - No matching Supabase User found.`)
      }
    }

    // --- D. Sync Subscriptions ---
    console.log("Syncing Subscriptions...")
    const subscriptions = await stripe.subscriptions.list({ limit: 100, status: 'all' })
    
    for (const sub of subscriptions.data) {
      // We need the User UUID. We can look it up via the 'customers' table we just populated.
      const { data: customerRecord } = await supabaseAdmin
        .from('customers')
        .select('id')
        .eq('stripe_customer_id', sub.customer)
        .single()

      if (customerRecord) {
        const { error } = await supabaseAdmin
          .from('subscriptions')
          .upsert({
            id: sub.id,
            user_id: customerRecord.id,
            status: sub.status,
            metadata: sub.metadata,
            price_id: sub.items.data[0].price.id,
            quantity: sub.items.data[0].quantity,
            cancel_at_period_end: sub.cancel_at_period_end,
            created_at: new Date(sub.created * 1000).toISOString(),
            current_period_start: new Date(sub.current_period_start * 1000).toISOString(),
            current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
            stripe_subscription_id: sub.id,
            stripe_customer_id: typeof sub.customer === 'string' ? sub.customer : sub.customer.id
          })
        if (error) results.errors.push(`Sub ${sub.id}: ${error.message}`)
        else results.subscriptions++
      }
    }

    return new Response(JSON.stringify({ success: true, results }), { headers })

  } catch (error) {
    console.error(error)
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
})