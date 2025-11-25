// Deno/TypeScript Code for 'get-stripe-plans'

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

console.log("--- [Stripe Plans Fetcher] Function loaded ---");

// Initialize Supabase client using the Service Role Key
// This key allows bypassing RLS, which is necessary for a secure function call
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', 
  { db: { schema: 'publicv2' } }
);

serve(async (req) => {
    // Only allow GET requests
    if (req.method !== 'GET') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
    }

    try {
        console.log("Fetching active Stripe plans from publicv2.stripe_plans...");
        
        // 1. Query the database securely
        const { data, error } = await supabase
          .from('stripe_plans')
          .select('*')
          .eq('active', true) // Filter to only show active plans
          .order('price', { ascending: true }); // Order by price for display

        if (error) {
            console.error("Database Query Error:", error);
            throw new Error(error.message);
        }

        // 2. Return the data as JSON
        return new Response(
            JSON.stringify({ plans: data }),
            {
                headers: { 'Content-Type': 'application/json' },
                status: 200,
            }
        );

    } catch (err) {
        console.error(`Logic Error: ${err.message}`);
        return new Response(JSON.stringify({ error: `Server error: ${err.message}` }), { status: 500 });
    }
});