#!/bin/bash

# Stripe Integration Test Script
# Based on your existing admin test script pattern

# Configuration
SUPABASE_URL="https://supabase.sageaios.com"
SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNjQwOTk1MjAwLCJleHAiOjE5NTYzNTUyMDB9.KHXKQpsN6MNB08H_IPxP4Gh0gjcsvXG9IeJuK3XpnAU"
LOGIN_EMAIL="elijahfurlonge@yahoo.com"
LOGIN_PASSWORD="Indiana07@"

echo "=== Stripe Integration Test Script ==="
echo "Supabase URL: $SUPABASE_URL"

echo -e "\n=== Getting Supabase JWT Token ==="
echo "Attempting login to: ${SUPABASE_URL}/auth/v1/token"
echo "Email: $LOGIN_EMAIL"

# Get auth token (same as your admin script)
LOGIN_RESPONSE=$(curl -s -X POST "${SUPABASE_URL}/auth/v1/token?grant_type=password" \
  -H "Content-Type: application/json" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -d "{
    \"email\": \"$LOGIN_EMAIL\",
    \"password\": \"$LOGIN_PASSWORD\"
  }")

echo "Login response: $LOGIN_RESPONSE"

# Check if jq is available
if ! command -v jq &> /dev/null; then
  echo "❌ jq is not installed. Installing..."
  apt-get update && apt-get install -y jq
fi

# Extract token
TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.access_token // empty')

if [ "$TOKEN" = "null" ] || [ -z "$TOKEN" ]; then
  echo "❌ Failed to get token"
  ERROR=$(echo "$LOGIN_RESPONSE" | jq -r '.error_description // .error // .message // empty')
  if [ -n "$ERROR" ]; then
    echo "Error: $ERROR"
  fi
  exit 1
fi

echo "✅ Token received: ${TOKEN:0:30}..."

# Helper function for Stripe API calls
make_stripe_request() {
  local method=$1
  local endpoint=$2
  local data=$3
  
  local url="${SUPABASE_URL}/functions/v1${endpoint}"
  
  echo "DEBUG: Making request to $url"
  echo "DEBUG: Method: $method"
  echo "DEBUG: Token: ${TOKEN:0:30}..."
  
  if [ -n "$data" ]; then
    curl -s -X "$method" "$url" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $TOKEN" \
      -d "$data"
  else
    curl -s -X "$method" "$url" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $TOKEN"
  fi
}

echo -e "\n=== Testing Stripe Functions Accessibility ==="

echo -e "\n--- Testing webhook endpoint (should return 'No signature') ---"
WEBHOOK_RESPONSE=$(curl -s -X POST "${SUPABASE_URL}/functions/v1/stripe-webhook" \
  -H "Content-Type: application/json" \
  -d '{"test": "data"}')
echo "Webhook Response: $WEBHOOK_RESPONSE"
if echo "$WEBHOOK_RESPONSE" | grep -q "No signature"; then
  echo "✅ Webhook endpoint is accessible and responding correctly"
else
  echo "❌ Webhook endpoint test failed"
fi

echo -e "\n--- Testing payment intent creation ---"
PAYMENT_RESPONSE=$(make_stripe_request "POST" "/stripe-create-payment-intent" \
  '{"amount": 1000, "currency": "usd"}')
echo "Payment Intent Response: $PAYMENT_RESPONSE"

if echo "$PAYMENT_RESPONSE" | grep -q "client_secret"; then
  echo "✅ Payment intent creation successful"
  CLIENT_SECRET=$(echo "$PAYMENT_RESPONSE" | jq -r '.client_secret // empty')
  echo "Client secret received: ${CLIENT_SECRET:0:20}..."
elif echo "$PAYMENT_RESPONSE" | grep -q "error"; then
  echo "❌ Payment intent creation failed"
  ERROR_MSG=$(echo "$PAYMENT_RESPONSE" | jq -r '.error // empty')
  echo "Error: $ERROR_MSG"
else
  echo "❌ Unexpected response from payment intent endpoint"
fi

echo -e "\n=== Testing with Different Payment Amounts ==="

echo -e "\n--- Testing $5.00 payment ---"
PAYMENT_5_RESPONSE=$(make_stripe_request "POST" "/stripe-create-payment-intent" \
  '{"amount": 500, "currency": "usd"}')
echo "Response: $PAYMENT_5_RESPONSE"

echo -e "\n--- Testing $50.00 payment ---"
PAYMENT_50_RESPONSE=$(make_stripe_request "POST" "/stripe-create-payment-intent" \
  '{"amount": 5000, "currency": "usd"}')
echo "Response: $PAYMENT_50_RESPONSE"

echo -e "\n--- Testing invalid amount (too small) ---"
INVALID_PAYMENT_RESPONSE=$(make_stripe_request "POST" "/stripe-create-payment-intent" \
  '{"amount": 10, "currency": "usd"}')
echo "Response: $INVALID_PAYMENT_RESPONSE"
if echo "$INVALID_PAYMENT_RESPONSE" | grep -q "at least"; then
  echo "✅ Validation working - rejected small amount"
else
  echo "⚠️ Small amount validation may not be working"
fi

echo -e "\n=== Testing Stripe Webhook from Dashboard ==="
echo "📝 Manual Test Required:"
echo "1. Go to your Stripe Dashboard: https://dashboard.stripe.com"
echo "2. Navigate to Developers → Webhooks"
echo "3. Click on your webhook endpoint"
echo "4. Scroll down and click 'Send test webhook'"
echo "5. Choose 'payment_intent.succeeded' event"
echo "6. Click 'Send test webhook'"
echo "7. Check the webhook delivery status"
echo ""
echo "Expected: You should see a successful delivery (200 status)"

echo -e "\n=== Checking Database Tables ==="
echo "📝 Check your Supabase database for these tables:"
echo "- customers"
echo "- payment_intents"
echo "- products"
echo "- prices" 
echo "- subscriptions"
echo ""
echo "After running payment tests, check if data appears in:"
echo "- customers table (new Stripe customer should be created)"
echo "- payment_intents table (payment intent records)"

echo -e "\n=== Environment Variables Check ==="
echo "📝 Verify these environment variables are set in your Supabase:"
echo "- STRIPE_SECRET_KEY (should start with sk_test_)"
echo "- STRIPE_WEBHOOK_SECRET (should start with whsec_)"
echo "- SUPABASE_URL"
echo "- SUPABASE_SERVICE_ROLE_KEY"

echo -e "\n=== Stripe Integration Test Complete ==="
echo ""
echo "✅ Function accessibility tests completed"
echo "✅ Payment creation tests completed" 
echo "⚠️ Manual webhook test required (see instructions above)"
echo ""
echo "📝 Next Steps:"
echo "1. If payment creation works, test with real Stripe test cards"
echo "2. Set up frontend integration using client_secret"
echo "3. Test webhook delivery from Stripe dashboard"
echo "4. Monitor database for payment records"
echo "5. Test with different payment scenarios"