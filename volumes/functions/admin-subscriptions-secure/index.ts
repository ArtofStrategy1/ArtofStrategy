/**
 * -----------------------------------------------------------------------------
 * @name        admin-stripe-analytics
 * @description Centralizes financial data for the Admin Dashboard. 
 * Aggregates data from Stripe (MRR, Charges, Subs) and Supabase (User Counts).
 * Enforces 2 layers of security (JWT & Email Allowlist).
 * -----------------------------------------------------------------------------
 * @method      GET
 * @base_url    /functions/v1/admin-stripe-analytics
 * -----------------------------------------------------------------------------
 * @params      ?tab=[TAB_NAME]
 * * 1. tab=overview
 * - Fetches MRR, Active Subs count, Total Users, & Recent Transactions.
 * - Calculates 6-month trend data.
 * * 2. tab=transactions
 * - Lists recent Stripe charges (limit 20) with payment method details.
 * * 3. tab=subscriptions
 * - Lists Stripe subscriptions with EXPANDED customer & product data.
 * * 4. tab=customers
 * - Lists raw user data from Supabase 'users' table.
 * - Maps DB 'tier' to frontend 'subscription_status'.
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
    // 1. Setup Supabase (Targeting publicv2 schema)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { db: { schema: 'publicv2' } }
    )

    // 2. Auth Check (Security)
    const authHeader = req.headers.get('authorization')?.replace('Bearer ', '')
    const { data: { user }, error } = await supabase.auth.getUser(authHeader)
    
    // Allowed Admin Emails
    const ALLOWED_EMAILS = Deno.env.get('ADMIN_EMAILS')?.split(',').map(email => email.trim()) || [];
    
    if (!user || !ALLOWED_EMAILS.includes(user.email || '')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 403, headers })
    }

    // 3. Handle Tabs
    const url = new URL(req.url)
    const tab = url.searchParams.get('tab') || 'overview'

    // --- TAB 1: OVERVIEW ---
    if (tab === 'overview') {
      // Fetch Stripe Data and DB counts in parallel
      const [charges, subs, userCount] = await Promise.all([
          stripe.charges.list({ limit: 5 }),
          stripe.subscriptions.list({ limit: 100, status: 'active' }),
          supabase.from('users').select('*', { count: 'exact', head: true })
      ]);

      // Calculate MRR from Stripe data
      const mrr = subs.data.reduce((acc, sub) => acc + (sub.items.data[0].price.unit_amount || 0), 0)

      // Calculate Trend (Simplified for demo)
      const trendData = []
      const now = new Date()
      for (let i = 5; i >= 0; i--) {
         const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
         trendData.push({ month: d.toLocaleString('default', { month: 'short' }), mrr: mrr/100 });
      }

      return new Response(JSON.stringify({
        success: true,
        stats: {
          mrr: mrr,
          active_count: subs.data.length,
          total_customers: userCount.count || 0,
          avg_order_value: (mrr / (subs.data.length || 1) / 100).toFixed(2)
        },
        trend: trendData, // Returns chart data
        transactions: charges.data.map((c: any) => ({
          id: c.id,
          amount: c.amount,
          status: c.status,
          created: c.created * 1000,
          customer_email: c.billing_details?.email || 'Unknown'
        }))
      }), { headers })
    }

    // --- TAB 2: TRANSACTIONS ---
    if (tab === 'transactions') {
      const charges = await stripe.charges.list({ limit: 20 })
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
      // 1. Fetch subscriptions from Stripe AND expand 'customer' and 'data.plan.product'
      const subs = await stripe.subscriptions.list({ 
          limit: 20, 
          status: 'all',
          expand: ['data.customer', 'data.plan.product'] // <--- THIS IS THE KEY FIX
      });

      return new Response(JSON.stringify({
        success: true,
        pagination: { // Adding pagination structure to match frontend expectations
            page: 1,
            totalPages: 1, // Simplified for now
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

    // --- TAB 4: CUSTOMERS (The Critical Fix) ---
    if (tab === 'customers') {
        // Query your 'users' table
        const { data: profiles, error } = await supabase
            .from('users')
            .select('*')
            .order('id', { ascending: false })
            .limit(20)
        
        if (error) throw error

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

    return new Response(JSON.stringify({ error: 'Tab not found' }), { headers })

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers })
  }
})