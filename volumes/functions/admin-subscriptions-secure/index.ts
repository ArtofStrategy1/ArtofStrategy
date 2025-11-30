/**
 * -----------------------------------------------------------------------------
 * @name        admin-subscriptions-secure
 * @description Centralizes financial data for the Admin Dashboard. 
 * Aggregates data from Stripe (MRR, Charges, Subs) and Supabase (User Counts).
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
    console.log("--- [DEBUG] START: admin-stripe-analytics function called ---");

    // 1. Setup Supabase
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { db: { schema: 'publicv2' } }
    )

    // 2. Auth Check
    const authHeader = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!authHeader) {
        console.error("--- [DEBUG] ERROR: Missing Authorization header ---");
        return new Response(JSON.stringify({ error: 'Missing Authorization header' }), { status: 401, headers })
    }

    const { data: { user }, error } = await supabase.auth.getUser(authHeader)
    
    if (error || !user) {
        console.error("--- [DEBUG] ERROR: Invalid user token:", error);
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 403, headers })
    }

    // Allowed Admin Emails
    const ALLOWED_EMAILS = Deno.env.get('ADMIN_EMAILS')?.split(',').map(email => email.trim()) || [];
    console.log(`--- [DEBUG] User identified: ${user.email}. Checking allowlist... ---`);
    
    if (!ALLOWED_EMAILS.includes(user.email || '')) {
      console.error(`--- [DEBUG] ERROR: User ${user.email} is NOT in admin allowlist ---`);
      return new Response(JSON.stringify({ error: 'Unauthorized: Admin Access Only' }), { status: 403, headers })
    }
    console.log("--- [DEBUG] Admin authorization successful ---");

    // 3. Handle Tabs
    const url = new URL(req.url)
    const tab = url.searchParams.get('tab') || 'overview'
    console.log(`--- [DEBUG] Processing Tab: ${tab} ---`);

    // --- TAB 1: OVERVIEW ---
    if (tab === 'overview') {
      console.log("--- [DEBUG] Fetching Overview Data (Stripe + DB)... ---");
      
      const [charges, subs, userCount] = await Promise.all([
          stripe.charges.list({ limit: 5 }),
          stripe.subscriptions.list({ limit: 100, status: 'active' }),
          supabase.from('users').select('*', { count: 'exact', head: true })
      ]);

      console.log(`--- [DEBUG] Stripe Charges Fetched: ${charges.data.length} ---`);
      console.log(`--- [DEBUG] Stripe Active Subs Fetched: ${subs.data.length} ---`);
      console.log(`--- [DEBUG] DB User Count: ${userCount.count} ---`);

      // Calculate MRR
      const mrr = subs.data.reduce((acc, sub) => acc + (sub.items.data[0].price.unit_amount || 0), 0)
      console.log(`--- [DEBUG] Calculated MRR: ${mrr} ---`);

      // Calculate Trend
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
        trend: trendData,
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
      console.log("--- [DEBUG] Fetching Stripe Transactions... ---");
      const charges = await stripe.charges.list({ limit: 20 })
      console.log(`--- [DEBUG] Transactions Fetched: ${charges.data.length} ---`);

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
      console.log("--- [DEBUG] Fetching Stripe Subscriptions (Expanded)... ---");
      
      const subs = await stripe.subscriptions.list({ 
          limit: 20, 
          status: 'all',
          expand: ['data.customer', 'data.plan.product'] 
      });
      console.log(`--- [DEBUG] Subscriptions Fetched: ${subs.data.length} ---`);
      
      // Debug first subscription to verify expansion
      if (subs.data.length > 0) {
          const firstSub = subs.data[0];
          console.log("--- [DEBUG] First Subscription Customer Data:", JSON.stringify(firstSub.customer));
          console.log("--- [DEBUG] First Subscription Product Data:", JSON.stringify(firstSub.plan?.product));
      }

      return new Response(JSON.stringify({
        success: true,
        pagination: {
            page: 1,
            totalPages: 1,
            total: subs.data.length
        },
        data: subs.data.map((s: any) => {
            const productObj = s.plan?.product; 
            const productName = (typeof productObj === 'object') ? productObj.name : 'Unknown Product';
            const productDesc = (typeof productObj === 'object') ? (productObj.description || '') : '';

            const customerObj = s.customer;
            const customerEmail = (typeof customerObj === 'object') ? customerObj.email : 'Unknown Email';

            return {
                id: s.id,
                stripe_subscription_id: s.id,
                status: s.status,
                customer_email: customerEmail,
                product_name: productName,
                product_desc: productDesc,
                plan_amount: s.plan?.amount || 0,
                plan_interval: s.plan?.interval || 'month',
                current_period_start: s.current_period_start * 1000, 
                current_period_end: s.current_period_end * 1000,
                cancel_at_period_end: s.cancel_at_period_end
            };
        })
      }), { headers })
    }

    // --- TAB 4: CUSTOMERS ---
    if (tab === 'customers') {
        console.log("--- [DEBUG] Fetching Database Customers (users table)... ---");
        
        const { data: profiles, error } = await supabase
            .from('users')
            .select('*')
            .order('id', { ascending: false })
            .limit(20)
        
        if (error) {
            console.error("--- [DEBUG] DB Query Error:", error);
            throw error
        }

        console.log(`--- [DEBUG] Customers Fetched: ${profiles ? profiles.length : 0} ---`);
        if (profiles && profiles.length > 0) {
             console.log("--- [DEBUG] First Customer Data:", JSON.stringify(profiles[0]));
        }

        return new Response(JSON.stringify({
            success: true,
            data: profiles.map((p: any) => ({
                id: p.id,
                email: p.email,
                stripe_customer_id: p.stripe_customer_id,
                subscription_status: p.tier === 'premium' ? 'active' : 'free', 
                plan_name: p.tier ? p.tier.toUpperCase() : 'BASIC',
                created_at: p.created_at
            }))
        }), { headers })
    }

    console.error(`--- [DEBUG] ERROR: Unknown Tab Requested (${tab}) ---`);
    return new Response(JSON.stringify({ error: 'Tab not found' }), { headers })

  } catch (err) {
    console.error("--- [DEBUG] CRITICAL UNHANDLED EXCEPTION ---");
    console.error(err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers })
  }
})