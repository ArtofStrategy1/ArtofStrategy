/**
 * -----------------------------------------------------------------------------
 * @name        redeem-promo
 * @description User endpoint to redeem promotional codes for premium access.
 * Validates promo codes, checks usage limits/expiration, and upgrades user tier.
 * Updates both public users table and auth metadata for seamless access control.
 * 
 * @routes
 * 1. POST /redeem-promo - Validate and redeem promo code for premium unlock
 * -----------------------------------------------------------------------------
 * @method      POST
 * @base_url    /functions/v1/redeem-promo
 * -----------------------------------------------------------------------------
 * @headers     Authorization: Bearer <jwt_token>
 *              Content-Type: application/json
 * @payload     { "code": "PROMO2024" }
 * -----------------------------------------------------------------------------
 * @responses   
 * Success: { success: true, message: "Premium unlocked for 30 days!" }
 * Errors: { error: "Invalid or inactive promo code" | "Promo code has expired" | "Promo code limit reached" }
 * -----------------------------------------------------------------------------
 * @validation
 * - Code exists and is_active = true
 * - Current date between starts_at and expires_at
 * - times_used < max_uses (if max_uses is set)
 * - User has valid JWT token
 * -----------------------------------------------------------------------------
 * @side_effects
 * - Updates users table: tier='premium', premium_until=+duration_days, plan_id, status='active'
 * - Updates auth metadata: app_metadata.tier = 'premium'
 * - Increments promo_codes.times_used counter
 * -----------------------------------------------------------------------------
 * @env         SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * @author      Elijah Furlonge
 * -----------------------------------------------------------------------------
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

// --- 1. Define CORS Headers ---
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  db: { schema: 'publicv2' }
});

serve(async (req) => {
  // --- 2. Handle CORS Preflight Request ---
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log("--- [DEBUG] START: redeem-promo called ---");

    // Auth Check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
        return new Response(JSON.stringify({ error: "Missing Authorization header" }), { 
            status: 401, 
            headers: { ...corsHeaders, "Content-Type": "application/json" } 
        });
    }
    
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
        return new Response(JSON.stringify({ error: "Invalid token" }), { 
            status: 401, 
            headers: { ...corsHeaders, "Content-Type": "application/json" } 
        });
    }

    // Parse Body
    const { code } = await req.json();
    if (!code) {
        return new Response(JSON.stringify({ error: "Code is required" }), { 
            status: 400, 
            headers: { ...corsHeaders, "Content-Type": "application/json" } 
        });
    }

    // Validate Code
    const { data: promo, error: promoError } = await supabase
      .from("promo_codes")
      .select("*")
      .eq("code", code)
      .eq("is_active", true)
      .single();

    if (promoError || !promo) {
      return new Response(JSON.stringify({ error: "Invalid or inactive promo code" }), { 
          status: 400, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    // Date & Usage Checks
    const now = new Date();
    if (promo.starts_at && new Date(promo.starts_at) > now) {
         return new Response(JSON.stringify({ error: "Promo code is not active yet" }), { 
             status: 400, 
             headers: { ...corsHeaders, "Content-Type": "application/json" } 
         });
    }
    if (promo.expires_at && new Date(promo.expires_at) < now) {
         return new Response(JSON.stringify({ error: "Promo code has expired" }), { 
             status: 400, 
             headers: { ...corsHeaders, "Content-Type": "application/json" } 
         });
    }
    
    // Limit Check (Your specific requirement)
    if (promo.max_uses !== null && promo.times_used >= promo.max_uses) {
      return new Response(JSON.stringify({ error: "Promo code limit reached" }), { 
          status: 400, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    // Process 'premium_unlock'
    if (!promo.type || promo.type === 'premium_unlock') {
        
        // Get Plan ID
        const { data: plan } = await supabase
            .from('stripe_plans')
            .select('id')
            .eq('name', 'Individual') 
            .single();
            
        if (!plan) {
            return new Response(JSON.stringify({ error: "Plan configuration error" }), { 
                status: 500, 
                headers: { ...corsHeaders, "Content-Type": "application/json" } 
            });
        }

        // Calculate Expiration
        const durationDays = promo.duration_days || 30; 
        const premiumUntil = new Date();
        premiumUntil.setDate(premiumUntil.getDate() + durationDays);

        // Update Public Database Table
        const updateData = {
            tier: 'premium',
            status: 'active',
            plan_id: plan.id,
            usage_count: 0, 
            upgraded_at: new Date().toISOString(),
            premium_until: premiumUntil.toISOString()
        };

        const { error: updateError } = await supabase
            .from('users')
            .update(updateData)
            .eq('auth_user_id', user.id);

        if (updateError) {
             console.error("DB Update Error:", updateError);
             return new Response(JSON.stringify({ error: "Failed to update user profile" }), { 
                 status: 500, 
                 headers: { ...corsHeaders, "Content-Type": "application/json" } 
             });
        }

        // Update Auth Metadata
        await supabase.auth.admin.updateUserById(
          user.id,
          {
            app_metadata: { tier: 'premium' }, 
            user_metadata: { tier: 'premium' }
          }
        );

        // Increment Usage
        await supabase.from('promo_codes')
            .update({ times_used: promo.times_used + 1 })
            .eq('id', promo.id);

        return new Response(JSON.stringify({ 
            success: true, 
            message: `Premium unlocked for ${durationDays} days!` 
        }), { 
            headers: { ...corsHeaders, "Content-Type": "application/json" } 
        });
    }

    return new Response(JSON.stringify({ error: "Unknown promo type" }), { 
        status: 400, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });

  } catch (err) {
    console.error("--- CRITICAL ERROR ---", err);
    return new Response(JSON.stringify({ error: "Internal Server Error" }), { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }
});