// Deno/TypeScript Code for 'create-stripe-session'

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from 'https://esm.sh/stripe@13.11.0';

console.log("--- [Stripe Session Creator] Function loaded ---");

// Check and log the existence and type of the critical secret key
const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
const keyType = stripeSecretKey ? (stripeSecretKey.startsWith('sk_live') ? 'LIVE' : (stripeSecretKey.startsWith('sk_test') ? 'TEST' : 'UNKNOWN')) : 'MISSING';
console.log(`[DEBUG] STRIPE API Mode: ${keyType}`); // <--- NEW LOGGING: Shows TEST or LIVE

// Initialize Stripe using the Secret Key
const stripe = new Stripe(stripeSecretKey || '', {
    apiVersion: '2023-10-16',
    httpClient: Stripe.createFetchHttpClient(),
});

// IMPORTANT: Set your application's domain/URL here
const YOUR_APP_URL = 'https://supabase.sageaios.com'; 

serve(async (req) => {
    console.log(`\n--- [REQUEST START] Method: ${req.method} ---`);
    
    // 1. Method Check
    if (req.method !== 'POST') {
        console.warn(`[ERROR 405] Method was ${req.method}. Expected POST.`);
        return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
    }

    // 2. Request Body Safety Check
    const reqClone = req.clone();
    const bodyText = await reqClone.text();
    let body;

    try {
        if (!bodyText) {
            console.error('[ERROR 400] Request body was empty.');
            return new Response(JSON.stringify({ error: 'Request body is empty' }), { status: 400 });
        }
        
        console.log(`[DEBUG] Received body text: ${bodyText.substring(0, 100)}...`);
        body = JSON.parse(bodyText);
    } catch (e) {
        console.error(`[ERROR 400] Invalid JSON in request body: ${e.message}`);
        return new Response(JSON.stringify({ error: 'Invalid JSON in request body' }), { status: 400 });
    }
    
    const { price_id, user_id } = body;

    try {
        // 3. Input Validation
        if (!price_id || !user_id) {
            console.error(`[ERROR 400] Missing critical inputs. Price ID: ${price_id}, User ID: ${user_id}`);
            return new Response(JSON.stringify({ error: 'Missing price_id or user_id in request body' }), { status: 400 });
        }

        console.log(`[DEBUG] Validated Inputs - Price ID: ${price_id}, User ID: ${user_id}`);
        console.log(`[DEBUG] Attempting session creation in ${keyType} mode...`); // <--- NEW LOG

        const successUrl = `${YOUR_APP_URL}/?payment_success=true&session_id={CHECKOUT_SESSION_ID}`;
        const cancelUrl = `${YOUR_APP_URL}/?canceled=true`;
        
        // 4. Create the Checkout Session
        const session = await stripe.checkout.sessions.create({
            line_items: [{
                price: price_id,
                quantity: 1,
            }],
            mode: 'subscription', 
            client_reference_id: user_id, 
            success_url: successUrl,
            cancel_url: cancelUrl,
            automatic_tax: { enabled: true },
            allow_promotion_codes: true,
        });

        console.log(`[DEBUG] Stripe session successfully created. Session ID: ${session.id}`);
        
        // 5. Return the Session ID and URL to the client
        return new Response(
            JSON.stringify({ id: session.id, url: session.url }), 
            {
                headers: { 'Content-Type': 'application/json' },
                status: 200,
            }
        );

    } catch (err) {
        // Handle Stripe API errors specifically
        if (err.type && err.type === 'StripeInvalidRequestError') {
             // This is the "No such price" error
            console.error(`[ERROR 400] STRIPE API ERROR: ${err.message}`);
            return new Response(JSON.stringify({ error: `Stripe Request Error: ${err.message}` }), { status: 400 });
        }
        
        console.error(`[ERROR 500] UNHANDLED LOGIC ERROR: ${err.message}`);
        return new Response(JSON.stringify({ error: `Failed to create checkout session: ${err.message}` }), { status: 500 });
    } finally {
        console.log("--- [REQUEST END] ---");
    }
});