import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@13.11.0'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
})

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const body = await req.text()
  const signature = req.headers.get('stripe-signature')

  if (!signature) {
    return new Response('No signature', { status: 400 })
  }

  try {
    const event = stripe.webhooks.constructEvent(
      body,
      signature,
      Deno.env.get('STRIPE_WEBHOOK_SECRET') || ''
    )

    console.log('Webhook event type:', event.type)

    switch (event.type) {
      case 'payment_intent.succeeded':
        await handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent)
        break
      case 'payment_intent.payment_failed':
        await handlePaymentIntentFailed(event.data.object as Stripe.PaymentIntent)
        break
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await handleSubscriptionChange(event.data.object as Stripe.Subscription)
        break
      default:
        console.log('Unhandled event type:', event.type)
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('Webhook error:', error)
    return new Response('Webhook error', { status: 400 })
  }
})

async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  await supabase
    .from('payment_intents')
    .update({ status: 'succeeded', updated_at: new Date().toISOString() })
    .eq('stripe_payment_intent_id', paymentIntent.id)
}

async function handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent) {
  await supabase
    .from('payment_intents')
    .update({ status: 'failed', updated_at: new Date().toISOString() })
    .eq('stripe_payment_intent_id', paymentIntent.id)
}

async function handleSubscriptionChange(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string
  
  // Get user from customer
  const { data: customer } = await supabase
    .from('customers')
    .select('user_id')
    .eq('stripe_customer_id', customerId)
    .single()

  if (!customer) return

  const subscriptionData = {
    user_id: customer.user_id,
    stripe_subscription_id: subscription.id,
    stripe_customer_id: customerId,
    status: subscription.status,
    current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
    current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
    cancel_at_period_end: subscription.cancel_at_period_end,
    updated_at: new Date().toISOString()
  }

  await supabase
    .from('subscriptions')
    .upsert(subscriptionData, { onConflict: 'stripe_subscription_id' })
}