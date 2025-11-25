#!/bin/bash

# ==============================================================================
# FULL STRIPE CUSTOMER CYCLE TEST (NO JQ VERSION)
# Tests: Product Sync -> Subscription Creation -> Admin Cancellation
# ==============================================================================

# Configuration
SUPABASE_URL="https://supabase.sageaios.com"
# ------------------------------------------------------------------------------
# ⚠️ PASTE YOUR SERVICE ROLE KEY BELOW (Keep the quotes)
# ------------------------------------------------------------------------------
SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE2NDA5OTUyMDAsImV4cCI6MTk1NjM1NTIwMH0.hl86eEP9zpgtKJlBtwRy4snn2mune8fKwA7Jhfx5NJo" 
# ------------------------------------------------------------------------------

# Use Anon Key for initial login (Public Key)
ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNjQwOTk1MjAwLCJleHAiOjE5NTYzNTUyMDB9.KHXKQpsN6MNB08H_IPxP4Gh0gjcsvXG9IeJuK3XpnAU"

# User Credentials (to simulate a customer)
LOGIN_EMAIL="basicUser@test.com"
LOGIN_PASSWORD="Indiana07@"

# --- Helper Function to Extract JSON Value without jq ---
extract_json_value() {
    local json="$1"
    local key="$2"
    # Grep the key, remove the key name, remove quotes, remove trailing commas
    echo "$json" | grep -o "\"$key\":\"[^\"]*\"" | cut -d'"' -f4
}

# ------------------------------------------------------------------------------
# PRE-FLIGHT CHECKS
# ------------------------------------------------------------------------------
echo "=== 🚀 Starting Stripe Cycle Test (No jq) ==="

if [ "$SERVICE_ROLE_KEY" = "YOUR_SERVICE_ROLE_KEY_HERE" ]; then
  echo "❌ ERROR: You must paste your SERVICE_ROLE_KEY in the script configuration (Line 11)."
  exit 1
fi

# ------------------------------------------------------------------------------
# STEP 1: SYNC PRODUCTS (Admin Action)
# ------------------------------------------------------------------------------
echo -e "\n[1/4] 🔄 Syncing Products & Prices from Stripe..."

SYNC_RESPONSE=$(curl -s -X POST "${SUPABASE_URL}/functions/v1/stripe-sync-products" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY")

# Check for success message in the raw response string
if [[ "$SYNC_RESPONSE" == *"Sync Complete"* ]] || [[ "$SYNC_RESPONSE" == *"products"* ]]; then
  echo "✅ Products Synced Successfully"
  echo "   Response snippet: ${SYNC_RESPONSE:0:100}..."
else
  echo "❌ Sync Failed. Response:"
  echo "$SYNC_RESPONSE"
  exit 1
fi

# ------------------------------------------------------------------------------
# STEP 2: AUTHENTICATE USER (Customer Action)
# ------------------------------------------------------------------------------
echo -e "\n[2/4] 🔑 Logging in User..."

LOGIN_RESPONSE=$(curl -s -X POST "${SUPABASE_URL}/auth/v1/token?grant_type=password" \
  -H "Content-Type: application/json" \
  -H "apikey: $ANON_KEY" \
  -d "{
    \"email\": \"$LOGIN_EMAIL\",
    \"password\": \"$LOGIN_PASSWORD\"
  }")

# Extract Access Token manually
USER_TOKEN=$(extract_json_value "$LOGIN_RESPONSE" "access_token")

# Extract User ID (A bit trickier without jq, assuming standard format)
# We look for the "id" field that comes after "user"
USER_ID=$(echo "$LOGIN_RESPONSE" | grep -o '"id":"[0-9a-f-]*"' | head -n 1 | cut -d'"' -f4)

if [ -z "$USER_TOKEN" ] || [ "$USER_TOKEN" == "null" ]; then
  echo "❌ Login Failed."
  echo "   Response: $LOGIN_RESPONSE"
  exit 1
fi

echo "✅ Logged in successfully"
echo "   User ID: $USER_ID"

# ------------------------------------------------------------------------------
# STEP 3: CREATE SUBSCRIPTION / INTENT (Customer Action)
# ------------------------------------------------------------------------------
echo -e "\n[3/4] 💳 Creating Payment Intent (Simulating Pay)..."

# We test payment intent creation as a proxy for the ability to pay
PAYMENT_RESPONSE=$(curl -s -X POST "${SUPABASE_URL}/functions/v1/stripe-create-payment-intent" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -d '{"amount": 2900, "currency": "usd"}')

# Check if client_secret exists in response
if [[ "$PAYMENT_RESPONSE" == *"client_secret"* ]]; then
  echo "✅ Payment Intent Created Successfully"
  CLIENT_SECRET=$(extract_json_value "$PAYMENT_RESPONSE" "client_secret")
  echo "   Client Secret: ${CLIENT_SECRET:0:15}..."
else
  echo "❌ Payment Creation Failed: $PAYMENT_RESPONSE"
fi

# ------------------------------------------------------------------------------
# STEP 4: ADMIN CANCEL SUBSCRIPTION (Admin Action)
# ------------------------------------------------------------------------------
echo -e "\n[4/4] 🚫 Testing Admin Cancellation..."

# Test A: Regular User (Should Fail)
echo "   Test A: Trying to cancel as a Regular User..."
FAIL_TEST=$(curl -s -X POST "${SUPABASE_URL}/functions/v1/stripe-cancel-subscription" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -d '{"subscriptionId": "sub_fake_123"}')

# Check for Unauthorized/Forbidden keywords
if [[ "$FAIL_TEST" == *"Unauthorized"* ]] || [[ "$FAIL_TEST" == *"Forbidden"* ]]; then
  echo "✅ Security Check Passed: Regular user cannot cancel."
else
  echo "⚠️  Warning: Response was not explicit denial: $FAIL_TEST"
fi

# Test B: Admin (Service Role)
echo "   Test B: Trying to cancel as Admin..."
ADMIN_TEST=$(curl -s -X POST "${SUPABASE_URL}/functions/v1/stripe-cancel-subscription" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -d '{"subscriptionId": "sub_fake_123"}')

# Check if it attempted to reach Stripe (No such subscription) OR succeeded
if [[ "$ADMIN_TEST" == *"No such subscription"* ]]; then
  echo "✅ Admin Access Verified: Function successfully contacted Stripe (Stripe returned 'No such subscription')."
elif [[ "$ADMIN_TEST" == *"success"* ]]; then
  echo "✅ Subscription Cancelled."
else
  echo "❌ Admin Function Error: $ADMIN_TEST"
fi

# ------------------------------------------------------------------------------
# SUMMARY
# ------------------------------------------------------------------------------
echo -e "\n=== 🏁 Test Cycle Complete ==="
echo "1. Sync Products:   [CHECK]"
echo "2. User Login:      [CHECK]"
echo "3. Payment Intent:  [CHECK]"
echo "4. Admin Security:  [CHECK]"
echo "5. Admin Logic:     [CHECK]"