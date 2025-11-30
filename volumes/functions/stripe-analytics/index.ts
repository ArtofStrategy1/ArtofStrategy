/**
 * -----------------------------------------------------------------------------
 * @name        stripe-analytics
 * @description Centralized admin dashboard endpoint for viewing financial and 
 * user statistics. Aggregates data from Stripe (MRR, Invoices, Subscriptions) 
 * and the Supabase 'users' table across four distinct data views (tabs).
 * Enforces email allowlist security for admin-only access.
 * 
 * @routes
 * 1. GET /?tab=overview      - Financial KPIs, 12-month revenue trend, recent transactions
 * 2. GET /?tab=transactions  - Detailed payment history with customer info
 * 3. GET /?tab=subscriptions - Active/inactive subscriptions with expanded customer/product data
 * 4. GET /?tab=customers     - User profiles from database with subscription mapping
 * -----------------------------------------------------------------------------
 * @method      GET
 * @base_url    /functions/v1/stripe-analytics
 * -----------------------------------------------------------------------------
 * @params      ?tab=overview|transactions|subscriptions|customers
 * @headers     Authorization: Bearer <jwt_token>
 * -----------------------------------------------------------------------------
 * @responses   
 * overview: { stats: {mrr, active_count, total_customers, avg_order_value}, trend: [12_months], transactions: [recent_5] }
 * transactions: { data: [{id, amount, currency, status, created, customer_email, payment_method, last4}] }
 * subscriptions: { data: [{id, status, customer_email, product_name, plan_amount, current_period_*}], pagination }
 * customers: { data: [{id, email, stripe_customer_id, subscription_status, plan_name, created_at}] }
 * -----------------------------------------------------------------------------
 * @features
 * - Real 12-month revenue trend from paid Stripe invoices
 * - MRR calculation from active subscriptions (yearly plans converted to monthly)
 * - Expanded Stripe objects for full customer/product details
 * - Database tier mapping to subscription status (premium->active, other->free)
 * -----------------------------------------------------------------------------
 * @security
 * - JWT token validation via Supabase auth
 * - Email allowlist check (ADMIN_EMAILS environment variable)
 * - Service role database access (publicv2 schema)
 * -----------------------------------------------------------------------------
 * @env         STRIPE_SECRET_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ADMIN_EMAILS
 * @author      Elijah Furlonge
 * -----------------------------------------------------------------------------
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@13.11.0'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
})

serve(async (req) => {
  // CORS Headers
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  }

  if (req.method === 'OPTIONS') return new Response('ok', { headers })

  try {
    console.log("--- [DEBUG] START: stripe-analytics function called ---");

    // 1. Setup Supabase (Targeting publicv2 schema)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { db: { schema: 'publicv2' } }
    )

    // 2. Auth Check (Security)
    const authHeader = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!authHeader) console.warn("--- [DEBUG] WARN: Missing Auth Header ---");

    const { data: { user }, error } = await supabase.auth.getUser(authHeader)
    
    if (error) console.error("--- [DEBUG] Auth Error:", error);
    if (user) console.log(`--- [DEBUG] Authenticated User: ${user.email} ---`);

    // Allowed Admin Emails
    const ALLOWED_EMAILS = Deno.env.get('ADMIN_EMAILS')?.split(',').map(email => email.trim()) || [];
    
    if (!user || !ALLOWED_EMAILS.includes(user.email || '')) {
      console.error(`--- [DEBUG] Unauthorized Access Attempt: ${user?.email} ---`);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 403, headers })
    }

    // 3. Handle Tabs
    const url = new URL(req.url)
    const tab = url.searchParams.get('tab') || 'overview'
    console.log(`--- [DEBUG] Processing Tab: "${tab}" ---`);

    // --- TAB 1: OVERVIEW (UPDATED FOR REAL 12-MONTH DATA) ---
    if (tab === 'overview') {
      console.log("--- [DEBUG] Overview: Starting parallel fetch... ---");
      
      // Calculate date range (1 year ago from 1st of month to fix date bugs)
      const d = new Date();
      d.setDate(1); 
      d.setFullYear(d.getFullYear() - 1);
      const oneYearAgo = Math.floor(d.getTime() / 1000);

      // Fetch Invoices (for trend), Subscriptions (for stats), and DB counts in parallel
      const [invoices, subs, userCount] = await Promise.all([
          stripe.invoices.list({ 
              status: 'paid', 
              created: { gte: oneYearAgo },
              limit: 100 
          }),
          stripe.subscriptions.list({ limit: 100, status: 'active' }),
          supabase.from('users').select('*', { count: 'exact', head: true })
      ]);

      console.log(`--- [DEBUG] Overview: Fetched ${invoices.data.length} paid invoices. ---`);
      console.log(`--- [DEBUG] Overview: Fetched ${subs.data.length} active subscriptions. ---`);
      console.log(`--- [DEBUG] Overview: Fetched ${userCount.count} total users. ---`);

      // A. Build 12-Month Trend from Invoices
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const trendMap = new Map<string, number>();

      // Initialize 12-month zero-fill map
      for (let i = 11; i >= 0; i--) {
          const dateIter = new Date();
          dateIter.setDate(1); 
          dateIter.setMonth(dateIter.getMonth() - i);
          const key = monthNames[dateIter.getMonth()];
          trendMap.set(key, 0);
      }

      // Aggregate invoice amounts
      for (const inv of invoices.data) {
          const invoiceDate = new Date(inv.created * 1000);
          const key = monthNames[invoiceDate.getMonth()];
          if (trendMap.has(key)) {
              trendMap.set(key, trendMap.get(key)! + (inv.amount_paid || 0));
          }
      }

      const trendData = Array.from(trendMap, ([month, val]) => ({ 
          month, 
          mrr: val / 100 // Convert to dollars for the graph
      }));

      // B. Calculate Current MRR from Active Subscriptions
      let currentMrrCents = 0;
      for (const sub of subs.data) {
          const item = sub.items.data[0];
          let amount = item.price.unit_amount || 0;
          if (item.price.recurring?.interval === 'year') {
              amount = Math.floor(amount / 12);
          }
          currentMrrCents += amount * (item.quantity || 1);
      }
      console.log(`--- [DEBUG] Overview: Calculated MRR: ${currentMrrCents} cents ---`);

      return new Response(JSON.stringify({
        success: true,
        stats: {
          mrr: currentMrrCents, // Passed in cents
          active_count: subs.data.length,
          total_customers: userCount.count || 0,
          avg_order_value: subs.data.length > 0 ? ((currentMrrCents / subs.data.length) / 100).toFixed(2) : "0.00"
        },
        trend: trendData, // Real 12-month data
        // Return simplified recent transactions for the feed
        transactions: invoices.data.slice(0, 5).map((inv: any) => ({
          id: inv.id,
          amount: inv.amount_paid,
          status: inv.status,
          created: inv.created * 1000,
          customer_email: inv.customer_email || 'Unknown'
        }))
      }), { headers })
    }

    // --- TAB 2: TRANSACTIONS ---
    if (tab === 'transactions') {
      console.log("--- [DEBUG] Transactions: Fetching recent charges... ---");
      const charges = await stripe.charges.list({ limit: 20 })
      console.log(`--- [DEBUG] Transactions: Found ${charges.data.length} charges. ---`);
      
      return new Response(JSON.stringify({
        success: true,
        data: charges.data.map((c: any) => ({
           id: c.id,
           amount: c.amount,
           currency: c.currency,
           status: c.status,
           created: c.created * 1000,
           customer_email: c.billing_details?.email || 'Unknown',
           payment_method: c.payment_method_details?.type,
           last4: c.payment_method_details?.card?.last4
        }))
      }), { headers })
    }

    // --- TAB 3: SUBSCRIPTIONS ---
    if (tab === 'subscriptions') {
      console.log("--- [DEBUG] Subscriptions: Fetching list with expansion... ---");
      
      // 1. Fetch subscriptions from Stripe AND expand 'customer' and 'data.plan.product'
      const subs = await stripe.subscriptions.list({ 
          limit: 20, 
          status: 'all',
          expand: ['data.customer', 'data.plan.product'] // <--- THIS IS THE KEY FIX
      });
      
      console.log(`--- [DEBUG] Subscriptions: Found ${subs.data.length} records. ---`);
      if (subs.data.length > 0) {
          // Debug the first item to ensure expansion worked
          const first = subs.data[0];
          console.log(`--- [DEBUG] First Sub ID: ${first.id} ---`);
          console.log(`--- [DEBUG] First Sub Customer Email: ${first.customer?.email} ---`);
          console.log(`--- [DEBUG] First Sub Product Name: ${first.plan?.product?.name} ---`);
      } else {
          console.warn("--- [DEBUG] WARNING: Stripe returned 0 subscriptions. ---");
      }

      return new Response(JSON.stringify({
        success: true,
        pagination: { 
            page: 1,
            totalPages: 1, 
            total: subs.data.length
        },
        data: subs.data.map((s: any) => {
            // 2. Safely extract product info (it handles if product is missing or deleted)
            const productObj = s.plan?.product; 
            const productName = (typeof productObj === 'object') ? productObj.name : 'Unknown Product';
            const productDesc = (typeof productObj === 'object') ? (productObj.description || '') : '';

            // 3. Safely extract customer info
            const customerObj = s.customer;
            const customerEmail = (typeof customerObj === 'object') ? customerObj.email : 'Unknown Email';

            return {
                id: s.id,
                stripe_subscription_id: s.id,
                status: s.status,
                customer_email: customerEmail, // Now populated!
                product_name: productName,     // Now populated!
                product_desc: productDesc,     // Now populated!
                plan_amount: s.plan?.amount || 0,
                plan_interval: s.plan?.interval || 'month',
                // 4. Fix Dates: Stripe uses Seconds, JS uses Milliseconds. Multiply by 1000.
                current_period_start: s.current_period_start * 1000, 
                current_period_end: s.current_period_end * 1000,
                cancel_at_period_end: s.cancel_at_period_end
            };
        })
      }), { headers })
    }

    // --- TAB 4: CUSTOMERS ---
    if (tab === 'customers') {
        console.log("--- [DEBUG] Customers: Fetching from Supabase (publicv2.users)... ---");
        
        const { data: profiles, error } = await supabase
            .from('users')
            .select('*')
            .order('id', { ascending: false })
            .limit(20)
        
        if (error) {
            console.error("--- [DEBUG] Customers DB Error:", error);
            throw error
        }
        console.log(`--- [DEBUG] Customers: Found ${profiles?.length} users. ---`);

        return new Response(JSON.stringify({
            success: true,
            data: profiles.map((p: any) => ({
                id: p.id,
                email: p.email,
                stripe_customer_id: p.stripe_customer_id,
                // MAPPING FIX:
                // Frontend expects 'subscription_status', but DB has 'tier'.
                // Frontend expects 'plan_name', DB has 'tier'.
                subscription_status: p.tier === 'premium' ? 'active' : 'free', 
                plan_name: p.tier ? p.tier.toUpperCase() : 'BASIC',
                created_at: p.created_at
            }))
        }), { headers })
    }

    console.warn(`--- [DEBUG] Unknown Tab requested: ${tab} ---`);
    return new Response(JSON.stringify({ error: 'Tab not found' }), { headers })

  } catch (err) {
    console.error("--- [DEBUG] CRITICAL ERROR ---", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers })
  }
})