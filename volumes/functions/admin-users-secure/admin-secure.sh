#!/bin/bash

# Admin Users API Test Script
# Based on your existing script pattern

# ================================
# CONFIGURATION - UPDATE THESE!
# ================================
BASE_URL="https://supabase.data2int.com/functions/v1/admin-users-secure"
SUPABASE_URL="https://supabase.data2int.com"
SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNjQwOTk1MjAwLCJleHAiOjE5NTYzNTUyMDB9.KHXKQpsN6MNB08H_IPxP4Gh0gjcsvXG9IeJuK3XpnAU"
ADMIN_SECRET="YLNyOk6IOf71Jr4CC515wT8QQlgxUsFpGB4FzVkY"
LOGIN_EMAIL="supadatain@gmail.com"
LOGIN_PASSWORD="Supabase1@"

# Test user ID (optional - set this to test user-specific operations)
TEST_USER_ID=""

echo "=== Admin Users API Test Script ==="
echo "Base URL: $BASE_URL"
echo "Supabase URL: $SUPABASE_URL"

echo -e "\n=== Getting Supabase JWT Token via Auth API ==="
echo "Attempting login to: ${SUPABASE_URL}/auth/v1/token"
echo "Email: $LOGIN_EMAIL"

# Use the standard Supabase auth endpoint
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

# Extract token from standard Supabase auth response
TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.access_token // empty')

if [ "$TOKEN" = "null" ] || [ -z "$TOKEN" ]; then
  echo "❌ Failed to get token"
  echo "Checking for errors in response..."
  ERROR=$(echo "$LOGIN_RESPONSE" | jq -r '.error_description // .error // .message // empty')
  if [ -n "$ERROR" ]; then
    echo "Error: $ERROR"
  fi
  
  echo "Available keys in response:"
  echo "$LOGIN_RESPONSE" | jq -r 'keys[]?' 2>/dev/null || echo "Invalid JSON response"
  exit 1
fi

echo "✅ Token received: ${TOKEN:0:30}..."

# Helper function for admin API calls with debug info
make_admin_request() {
  local method=$1
  local endpoint=$2
  local data=$3
  local extra_headers=$4
  
  local url="${BASE_URL}${endpoint}"
  
  echo "DEBUG: Making request to $url"
  echo "DEBUG: Method: $method"
  echo "DEBUG: Admin Secret: ${ADMIN_SECRET:0:10}..."
  echo "DEBUG: Token: ${TOKEN:0:30}..."
  
  if [ -n "$data" ]; then
    curl -s -X "$method" "$url" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $TOKEN" \
      -H "x-admin-secret: $ADMIN_SECRET" \
      ${extra_headers:+-H "$extra_headers"} \
      -d "$data"
  else
    curl -s -X "$method" "$url" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $TOKEN" \
      -H "x-admin-secret: $ADMIN_SECRET" \
      ${extra_headers:+-H "$extra_headers"}
  fi
}

echo -e "\n=== Testing Security: No Auth Headers ==="
NO_AUTH_RESPONSE=$(curl -s "${BASE_URL}/users")
echo "Response: $NO_AUTH_RESPONSE"
if echo "$NO_AUTH_RESPONSE" | grep -q "Unauthorized\|error"; then
  echo "✅ Security test passed - blocked unauthorized access"
else
  echo "❌ Security test failed - should block unauthorized access"
fi

echo -e "\n=== Testing Security: Wrong Admin Secret ==="
WRONG_SECRET_RESPONSE=$(curl -s "${BASE_URL}/users" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-admin-secret: wrong-secret")
echo "Response: $WRONG_SECRET_RESPONSE"
if echo "$WRONG_SECRET_RESPONSE" | grep -q "Unauthorized\|error"; then
  echo "✅ Security test passed - blocked wrong admin secret"
else
  echo "❌ Security test failed - should block wrong admin secret"
fi

echo -e "\n=== Testing API: Get User Statistics (Debug Mode) ==="
echo "DEBUG: Making request to ${BASE_URL}/users/stats"
echo "DEBUG: Method: GET"
echo "DEBUG: Admin Secret: ${ADMIN_SECRET:0:10}..."
echo "DEBUG: Token: ${TOKEN:0:30}..."

STATS_RESPONSE=$(curl -s -v "${BASE_URL}/users/stats" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-admin-secret: $ADMIN_SECRET" 2>&1)

echo "Full debug response: $STATS_RESPONSE"
echo "Filtered response: $(echo "$STATS_RESPONSE" | grep -E '^\{.*\}

echo -e "\n=== Testing API: List Users ==="
LIST_RESPONSE=$(make_admin_request "GET" "/users?page=1&limit=5")
echo "Response: $LIST_RESPONSE"
if echo "$LIST_RESPONSE" | grep -q "data\|success"; then
  echo "✅ List users test passed"
else
  echo "❌ List users test failed"
fi

echo -e "\n=== Testing API: Search Users ==="
SEARCH_RESPONSE=$(make_admin_request "GET" "/users?search=test")
echo "Response: $SEARCH_RESPONSE"
if echo "$SEARCH_RESPONSE" | grep -q "data\|success"; then
  echo "✅ Search users test passed"
else
  echo "❌ Search users test failed"
fi

# Test specific user operations if TEST_USER_ID is set
if [ -n "$TEST_USER_ID" ]; then
  echo -e "\n=== Testing API: Get Specific User ==="
  USER_RESPONSE=$(make_admin_request "GET" "/users/$TEST_USER_ID")
  echo "Response: $USER_RESPONSE"
  if echo "$USER_RESPONSE" | grep -q "data\|success"; then
    echo "✅ Get user test passed"
  else
    echo "❌ Get user test failed"
  fi

  echo -e "\n=== Testing API: Update User ==="
  UPDATE_RESPONSE=$(make_admin_request "PUT" "/users/$TEST_USER_ID" '{"first_name": "Test Updated"}')
  echo "Response: $UPDATE_RESPONSE"
  if echo "$UPDATE_RESPONSE" | grep -q "success\|updated"; then
    echo "✅ Update user test passed"
  else
    echo "❌ Update user test failed"
  fi
else
  echo -e "\n⚠️  Skipping user-specific tests (no TEST_USER_ID set)"
fi

echo -e "\n=== Testing API: Bulk Operation ==="
CONFIRMATION_TOKEN="test-user-$(date +%s)"
BULK_RESPONSE=$(make_admin_request "POST" "/users/bulk-action" \
  '{"action": "upgrade-to-premium", "userIds": [999999]}' \
  "x-operation-confirm: $CONFIRMATION_TOKEN")
echo "Response: $BULK_RESPONSE"
# This should fail gracefully due to invalid user ID, but not be unauthorized
if echo "$BULK_RESPONSE" | grep -q "success\|error.*not.*found\|User not found"; then
  echo "✅ Bulk operation test passed (expected failure for invalid user ID)"
else
  echo "❌ Bulk operation test failed"
fi

echo -e "\n=== Testing API: Invalid Route ==="
INVALID_RESPONSE=$(make_admin_request "GET" "/invalid-endpoint")
echo "Response: $INVALID_RESPONSE"
if echo "$INVALID_RESPONSE" | grep -q "not found\|Route not found"; then
  echo "✅ Invalid route test passed"
else
  echo "❌ Invalid route test failed"
fi

echo -e "\n=== Testing Rate Limiting ==="
echo "Making 35 rapid requests to test rate limiting..."
BLOCKED_COUNT=0
for i in {1..35}; do
  RATE_RESPONSE=$(make_admin_request "GET" "/users/stats")
  if echo "$RATE_RESPONSE" | grep -q "Rate limit\|429"; then
    BLOCKED_COUNT=$((BLOCKED_COUNT + 1))
  fi
  
  # Show progress every 10 requests
  if [ $((i % 10)) -eq 0 ]; then
    echo "Completed $i/35 requests..."
  fi
done

echo "Rate limit test: $BLOCKED_COUNT requests blocked out of 35"
if [ $BLOCKED_COUNT -gt 0 ]; then
  echo "✅ Rate limiting is working"
else
  echo "⚠️  Rate limiting may not be working (no blocked requests detected)"
fi

echo -e "\n=== Admin API Test Complete ==="
echo "✅ Security tests completed"
echo "✅ API functionality tests completed"
echo "✅ Rate limiting tests completed"

echo -e "\n📝 Next Steps:"
echo "1. Review any failed tests above"
echo "2. Set TEST_USER_ID variable to test user-specific operations"
echo "3. Monitor admin_audit_log table for security events"
echo "4. Deploy to production when all tests pass" || echo 'No JSON found')"

echo -e "\n=== Testing Function Existence ==="
PING_RESPONSE=$(curl -s -X OPTIONS "${BASE_URL}/users/stats")
echo "OPTIONS response: $PING_RESPONSE"

echo -e "\n=== Testing API: List Users ==="

echo -e "\n=== Testing API: List Users ==="
LIST_RESPONSE=$(make_admin_request "GET" "/users?page=1&limit=5")
echo "Response: $LIST_RESPONSE"
if echo "$LIST_RESPONSE" | grep -q "data\|success"; then
  echo "✅ List users test passed"
else
  echo "❌ List users test failed"
fi

echo -e "\n=== Testing API: Search Users ==="
SEARCH_RESPONSE=$(make_admin_request "GET" "/users?search=test")
echo "Response: $SEARCH_RESPONSE"
if echo "$SEARCH_RESPONSE" | grep -q "data\|success"; then
  echo "✅ Search users test passed"
else
  echo "❌ Search users test failed"
fi

# Test specific user operations if TEST_USER_ID is set
if [ -n "$TEST_USER_ID" ]; then
  echo -e "\n=== Testing API: Get Specific User ==="
  USER_RESPONSE=$(make_admin_request "GET" "/users/$TEST_USER_ID")
  echo "Response: $USER_RESPONSE"
  if echo "$USER_RESPONSE" | grep -q "data\|success"; then
    echo "✅ Get user test passed"
  else
    echo "❌ Get user test failed"
  fi

  echo -e "\n=== Testing API: Update User ==="
  UPDATE_RESPONSE=$(make_admin_request "PUT" "/users/$TEST_USER_ID" '{"first_name": "Test Updated"}')
  echo "Response: $UPDATE_RESPONSE"
  if echo "$UPDATE_RESPONSE" | grep -q "success\|updated"; then
    echo "✅ Update user test passed"
  else
    echo "❌ Update user test failed"
  fi
else
  echo -e "\n⚠️  Skipping user-specific tests (no TEST_USER_ID set)"
fi

echo -e "\n=== Testing API: Bulk Operation ==="
CONFIRMATION_TOKEN="test-user-$(date +%s)"
BULK_RESPONSE=$(make_admin_request "POST" "/users/bulk-action" \
  '{"action": "upgrade-to-premium", "userIds": [999999]}' \
  "x-operation-confirm: $CONFIRMATION_TOKEN")
echo "Response: $BULK_RESPONSE"
# This should fail gracefully due to invalid user ID, but not be unauthorized
if echo "$BULK_RESPONSE" | grep -q "success\|error.*not.*found\|User not found"; then
  echo "✅ Bulk operation test passed (expected failure for invalid user ID)"
else
  echo "❌ Bulk operation test failed"
fi

echo -e "\n=== Testing API: Invalid Route ==="
INVALID_RESPONSE=$(make_admin_request "GET" "/invalid-endpoint")
echo "Response: $INVALID_RESPONSE"
if echo "$INVALID_RESPONSE" | grep -q "not found\|Route not found"; then
  echo "✅ Invalid route test passed"
else
  echo "❌ Invalid route test failed"
fi

echo -e "\n=== Testing Rate Limiting ==="
echo "Making 35 rapid requests to test rate limiting..."
BLOCKED_COUNT=0
for i in {1..35}; do
  RATE_RESPONSE=$(make_admin_request "GET" "/users/stats")
  if echo "$RATE_RESPONSE" | grep -q "Rate limit\|429"; then
    BLOCKED_COUNT=$((BLOCKED_COUNT + 1))
  fi
  
  # Show progress every 10 requests
  if [ $((i % 10)) -eq 0 ]; then
    echo "Completed $i/35 requests..."
  fi
done

echo "Rate limit test: $BLOCKED_COUNT requests blocked out of 35"
if [ $BLOCKED_COUNT -gt 0 ]; then
  echo "✅ Rate limiting is working"
else
  echo "⚠️  Rate limiting may not be working (no blocked requests detected)"
fi

echo -e "\n=== Admin API Test Complete ==="
echo "✅ Security tests completed"
echo "✅ API functionality tests completed"
echo "✅ Rate limiting tests completed"

echo -e "\n📝 Next Steps:"
echo "1. Review any failed tests above"
echo "2. Set TEST_USER_ID variable to test user-specific operations"
echo "3. Monitor admin_audit_log table for security events"
echo "4. Deploy to production when all tests pass"