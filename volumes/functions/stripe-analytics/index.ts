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

    // --- TAB 1: OVERVIEW (UPDATED FOR REAL 12-MONTH DATA) ---
    if (tab === 'overview') {
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
          expand: ['data.customer', 'data.plan.product'] 
      });

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