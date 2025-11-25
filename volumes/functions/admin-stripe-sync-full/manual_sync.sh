#!/bin/bash

# --- CONFIGURATION ---
# We pull these directly from your index-latest.txt settings
SUPABASE_URL="https://supabase.data2int.com"
ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNjQwOTk1MjAwLCJleHAiOjE5NTYzNTUyMDB9.KHXKQpsN6MNB08H_IPxP4Gh0gjcsvXG9IeJuK3XpnAU"
FUNCTION_URL="${SUPABASE_URL}/functions/v1/admin-stripe-sync-full"

echo "========================================"
echo "   🛠️  MANUAL STRIPE SYNC TOOL  🛠️"
echo "========================================"
echo "This script will trigger the admin-stripe-sync-full function."
echo "You must log in as an ADMIN user to proceed."
echo ""

# 1. Ask for Credentials
read -p "Enter Admin Email: " EMAIL
read -s -p "Enter Admin Password: " PASSWORD
echo ""
echo ""

# 2. Login to get Access Token
echo "🔄 Authenticating..."

LOGIN_RESPONSE=$(curl -s -X POST "${SUPABASE_URL}/auth/v1/token?grant_type=password" \
  -H "apikey: ${ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${EMAIL}\",\"password\":\"${PASSWORD}\"}")

# Extract Token (using grep/sed to avoid needing 'jq' installed)
ACCESS_TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"access_token":"[^"]*' | grep -o '[^"]*$')

if [ -z "$ACCESS_TOKEN" ]; then
  echo "❌ Login Failed."
  echo "Server response: $LOGIN_RESPONSE"
  exit 1
fi

echo "✅ Login Successful."

# 3. Trigger the Sync Function
echo "⏳ Triggering Sync Function... (This may take 10-20 seconds)"

SYNC_RESPONSE=$(curl -s -X POST "${FUNCTION_URL}" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{}')

echo ""
echo "========================================"
echo "   🔍  RESULT  🔍"
echo "========================================"
echo "$SYNC_RESPONSE"
echo "========================================"