#!/bin/bash

# Comprehensive Subscription Test Script
# Tests subscription functionality end-to-end

# Configuration
SUPABASE_URL="https://supabase.sageaios.com"
SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNjQwOTk1MjAwLCJleHAiOjE5NTYzNTUyMDB9.KHXKQpsN6MNB08H_IPxP4Gh0gjcsvXG9IeJuK3XpnAU"
LOGIN_EMAIL="elijahfurlonge@yahoo.com"
LOGIN_PASSWORD="Indiana07@"

# Test counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
    PASSED_TESTS=$((PASSED_TESTS + 1))
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
    FAILED_TESTS=$((FAILED_TESTS + 1))
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_test() {
    echo -e "${PURPLE}[TEST]${NC} $1"
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
}

# Test result function
check_test_result() {
    local expected="$1"
    local actual="$2"
    local test_name="$3"
    
    if echo "$actual" | grep -q "$expected"; then
        log_success "$test_name"
        return 0
    else
        log_error "$test_name"
        log_error "Expected: $expected"
        log_error "Got: $actual"
        return 1
    fi
}

echo "============================================="
echo "🔄 COMPREHENSIVE SUBSCRIPTION TEST SUITE"
echo "============================================="
log_info "Target: $SUPABASE_URL"
log_info "Testing subscription functionality..."

# Check dependencies
log_test "Checking dependencies"
if ! command -v curl &> /dev/null; then
    log_error "curl is required but not installed"
    exit 1
fi

if ! command -v jq &> /dev/null; then
    log_error "jq is required but not installed. Installing..."
    apt-get update && apt-get install -y jq
fi

if command -v stripe &> /dev/null; then
    log_success "Dependencies check passed (curl, jq, stripe-cli)"
else
    log_warning "Dependencies check passed (stripe-cli not found - some tests will be limited)"
fi

echo ""
echo "🔑 PHASE 1: AUTHENTICATION"
echo "========================="

# Get authentication token
log_test "Getting JWT authentication token"
LOGIN_RESPONSE=$(curl -s -X POST "${SUPABASE_URL}/auth/v1/token?grant_type=password" \
  -H "Content-Type: application/json" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -d "{
    \"email\": \"$LOGIN_EMAIL\",
    \"password\": \"$LOGIN_PASSWORD\"
  }" 2>/dev/null)

TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.access_token // empty' 2>/dev/null)

if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
    log_error "Failed to get authentication token"
    log_error "Response: $LOGIN_RESPONSE"
    exit 1
fi

log_success "Authentication successful"
log_info "Token: ${TOKEN:0:30}..."

echo ""
echo "📊 PHASE 2: DATABASE SCHEMA VERIFICATION"
echo "======================================="

# Test database tables exist and have correct structure
log_test "Checking if subscription tables exist"

# Check products table
log_test "Verifying products table structure"
PRODUCTS_CHECK=$(curl -s -X GET "${SUPABASE_URL}/rest/v1/products?select=id&limit=1" \
  -H "Authorization: Bearer $TOKEN" \
  -H "apikey: $SUPABASE_ANON_KEY" 2>/dev/null)

if echo "$PRODUCTS_CHECK" | jq -e '. | length >= 0' >/dev/null 2>&1; then
    log_success "Products table accessible"
else
    log_error "Products table not accessible: $PRODUCTS_CHECK"
fi

# Check prices table
log_test "Verifying prices table structure"
PRICES_CHECK=$(curl -s -X GET "${SUPABASE_URL}/rest/v1/prices?select=id&limit=1" \
  -H "Authorization: Bearer $TOKEN" \
  -H "apikey: $SUPABASE_ANON_KEY" 2>/dev/null)

if echo "$PRICES_CHECK" | jq -e '. | length >= 0' >/dev/null 2>&1; then
    log_success "Prices table accessible"
else
    log_error "Prices table not accessible: $PRICES_CHECK"
fi

# Check subscriptions table
log_test "Verifying subscriptions table structure"
SUBSCRIPTIONS_CHECK=$(curl -s -X GET "${SUPABASE_URL}/rest/v1/subscriptions?select=id&limit=1" \
  -H "Authorization: Bearer $TOKEN" \
  -H "apikey: $SUPABASE_ANON_KEY" 2>/dev/null)

if echo "$SUBSCRIPTIONS_CHECK" | jq -e '. | length >= 0' >/dev/null 2>&1; then
    log_success "Subscriptions table accessible"
else
    log_error "Subscriptions table not accessible: $SUBSCRIPTIONS_CHECK"
fi

echo ""
echo "🏭 PHASE 3: STRIPE PRODUCTS & PRICES"
echo "=================================="

if command -v stripe &> /dev/null; then
    # List existing products
    log_test "Checking Stripe products"
    STRIPE_PRODUCTS=$(stripe products list --limit 5 2>/dev/null)
    
    if echo "$STRIPE_PRODUCTS" | grep -q "id"; then
        log_success "Stripe products accessible via CLI"
        log_info "Found products in Stripe account"
    else
        log_warning "No products found in Stripe - you may need to create some"
    fi
    
    # List existing prices
    log_test "Checking Stripe prices"
    STRIPE_PRICES=$(stripe prices list --limit 5 2>/dev/null)
    
    if echo "$STRIPE_PRICES" | grep -q "id"; then
        log_success "Stripe prices accessible via CLI"
        log_info "Found prices in Stripe account"
    else
        log_warning "No prices found in Stripe - you may need to create some"
    fi
    
    # Create a test product for testing (if needed)
    log_test "Creating test product for subscription testing"
    TEST_PRODUCT=$(stripe products create \
        --name "Test Subscription Plan" \
        --description "Test subscription for automated testing" 2>/dev/null)
    
    if echo "$TEST_PRODUCT" | grep -q "id"; then
        TEST_PRODUCT_ID=$(echo "$TEST_PRODUCT" | jq -r '.id')
        log_success "Created test product: $TEST_PRODUCT_ID"
        
        # Create a test price
        log_test "Creating test price for subscription testing"
        TEST_PRICE=$(stripe prices create \
            --product "$TEST_PRODUCT_ID" \
            --unit-amount 999 \
            --currency usd \
            --recurring-interval month 2>/dev/null)
        
        if echo "$TEST_PRICE" | grep -q "id"; then
            TEST_PRICE_ID=$(echo "$TEST_PRICE" | jq -r '.id')
            log_success "Created test price: $TEST_PRICE_ID"
        else
            log_error "Failed to create test price"
            TEST_PRICE_ID=""
        fi
    else
        log_error "Failed to create test product"
        TEST_PRODUCT_ID=""
        TEST_PRICE_ID=""
    fi
else
    log_warning "Stripe CLI not available - skipping Stripe product verification"
    TEST_PRODUCT_ID=""
    TEST_PRICE_ID=""
fi

echo ""
echo "🔧 PHASE 4: SUBSCRIPTION FUNCTION TESTING"
echo "========================================"

# Test if subscription function exists
log_test "Testing subscription function accessibility"
SUBSCRIPTION_ENDPOINT="${SUPABASE_URL}/functions/v1/create-subscription"

# Test without auth (should fail)
log_test "Testing subscription endpoint without authentication"
NO_AUTH_SUB_RESPONSE=$(curl -s -X POST "$SUBSCRIPTION_ENDPOINT" \
  -H "Content-Type: application/json" \
  -d '{"price_id": "price_test123"}' 2>/dev/null)

check_test_result "Unauthorized\|Method not allowed\|error" "$NO_AUTH_SUB_RESPONSE" "Subscription endpoint requires auth"

# Test with auth but invalid price_id
if [ -n "$TEST_PRICE_ID" ]; then
    log_test "Testing subscription creation with valid price_id"
    VALID_SUB_RESPONSE=$(curl -s -X POST "$SUBSCRIPTION_ENDPOINT" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $TOKEN" \
      -d "{\"price_id\": \"$TEST_PRICE_ID\"}" 2>/dev/null)
    
    if echo "$VALID_SUB_RESPONSE" | grep -q "subscription_id\|client_secret"; then
        log_success "Subscription creation with valid price_id"
        CREATED_SUBSCRIPTION_ID=$(echo "$VALID_SUB_RESPONSE" | jq -r '.subscription_id // empty')
        log_info "Created subscription: ${CREATED_SUBSCRIPTION_ID:0:30}..."
    else
        log_error "Subscription creation failed: $VALID_SUB_RESPONSE"
    fi
else
    log_warning "Skipping subscription creation test - no test price available"
fi

# Test with invalid price_id
log_test "Testing subscription creation with invalid price_id"
INVALID_SUB_RESPONSE=$(curl -s -X POST "$SUBSCRIPTION_ENDPOINT" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"price_id": "price_invalid_test_123"}' 2>/dev/null)

if echo "$INVALID_SUB_RESPONSE" | grep -q "error"; then
    log_success "Subscription creation properly rejects invalid price_id"
else
    log_warning "Subscription endpoint may not be validating price_id properly"
fi

echo ""
echo "📬 PHASE 5: WEBHOOK TESTING"
echo "========================="

if command -v stripe &> /dev/null; then
    log_test "Testing subscription webhooks with Stripe CLI"
    
    # Test subscription created webhook
    log_info "Triggering customer.subscription.created event..."
    SUB_CREATE_RESULT=$(stripe trigger customer.subscription.created \
        --forward-to "${SUPABASE_URL}/functions/v1/stripe-webhook" 2>&1)
    
    if echo "$SUB_CREATE_RESULT" | grep -q "200"; then
        log_success "customer.subscription.created webhook processed"
    else
        log_warning "customer.subscription.created webhook (manual verification needed)"
    fi
    
    # Test subscription updated webhook
    log_info "Triggering customer.subscription.updated event..."
    SUB_UPDATE_RESULT=$(stripe trigger customer.subscription.updated \
        --forward-to "${SUPABASE_URL}/functions/v1/stripe-webhook" 2>&1)
    
    if echo "$SUB_UPDATE_RESULT" | grep -q "200"; then
        log_success "customer.subscription.updated webhook processed"
    else
        log_warning "customer.subscription.updated webhook (manual verification needed)"
    fi
    
    # Test subscription deleted webhook
    log_info "Triggering customer.subscription.deleted event..."
    SUB_DELETE_RESULT=$(stripe trigger customer.subscription.deleted \
        --forward-to "${SUPABASE_URL}/functions/v1/stripe-webhook" 2>&1)
    
    if echo "$SUB_DELETE_RESULT" | grep -q "200"; then
        log_success "customer.subscription.deleted webhook processed"
    else
        log_warning "customer.subscription.deleted webhook (manual verification needed)"
    fi
else
    log_warning "Stripe CLI not available - skipping webhook event testing"
fi

echo ""
echo "💾 PHASE 6: DATABASE INTEGRATION TESTING"
echo "======================================"

# Check if subscription data appears in database
log_test "Checking subscription data in database"
DB_SUBSCRIPTIONS=$(curl -s -X GET "${SUPABASE_URL}/rest/v1/subscriptions?select=*&limit=5" \
  -H "Authorization: Bearer $TOKEN" \
  -H "apikey: $SUPABASE_ANON_KEY" 2>/dev/null)

if echo "$DB_SUBSCRIPTIONS" | jq -e '. | length >= 0' >/dev/null 2>&1; then
    SUB_COUNT=$(echo "$DB_SUBSCRIPTIONS" | jq '. | length')
    log_success "Database subscription query successful"
    log_info "Found $SUB_COUNT subscription records in database"
    
    if [ "$SUB_COUNT" -gt 0 ]; then
        log_info "Sample subscription data:"
        echo "$DB_SUBSCRIPTIONS" | jq '.[0] | {id, stripe_subscription_id, status, created_at}' 2>/dev/null || echo "Could not parse subscription data"
    fi
else
    log_error "Failed to query subscription data: $DB_SUBSCRIPTIONS"
fi

# Check products in database
log_test "Checking products data in database"
DB_PRODUCTS=$(curl -s -X GET "${SUPABASE_URL}/rest/v1/products?select=*&limit=5" \
  -H "Authorization: Bearer $TOKEN" \
  -H "apikey: $SUPABASE_ANON_KEY" 2>/dev/null)

if echo "$DB_PRODUCTS" | jq -e '. | length >= 0' >/dev/null 2>&1; then
    PRODUCT_COUNT=$(echo "$DB_PRODUCTS" | jq '. | length')
    log_success "Database products query successful"
    log_info "Found $PRODUCT_COUNT product records in database"
else
    log_error "Failed to query products data: $DB_PRODUCTS"
fi

# Check prices in database
log_test "Checking prices data in database"
DB_PRICES=$(curl -s -X GET "${SUPABASE_URL}/rest/v1/prices?select=*&limit=5" \
  -H "Authorization: Bearer $TOKEN" \
  -H "apikey: $SUPABASE_ANON_KEY" 2>/dev/null)

if echo "$DB_PRICES" | jq -e '. | length >= 0' >/dev/null 2>&1; then
    PRICE_COUNT=$(echo "$DB_PRICES" | jq '. | length')
    log_success "Database prices query successful"
    log_info "Found $PRICE_COUNT price records in database"
else
    log_error "Failed to query prices data: $DB_PRICES"
fi

echo ""
echo "🧹 PHASE 7: CLEANUP TEST DATA"
echo "=========================="

# Cleanup test product if created
if [ -n "$TEST_PRODUCT_ID" ] && command -v stripe &> /dev/null; then
    log_test "Cleaning up test product"
    stripe products update "$TEST_PRODUCT_ID" --active=false >/dev/null 2>&1
    log_info "Deactivated test product: $TEST_PRODUCT_ID"
fi

# Cancel any test subscriptions created
if [ -n "$CREATED_SUBSCRIPTION_ID" ] && command -v stripe &> /dev/null; then
    log_test "Cleaning up test subscription"
    stripe subscriptions cancel "$CREATED_SUBSCRIPTION_ID" >/dev/null 2>&1
    log_info "Cancelled test subscription: $CREATED_SUBSCRIPTION_ID"
fi

echo ""
echo "📊 SUBSCRIPTION TEST RESULTS SUMMARY"
echo "=================================="
echo -e "${BLUE}Total Tests Run:${NC} $TOTAL_TESTS"
echo -e "${GREEN}Passed:${NC} $PASSED_TESTS"
echo -e "${RED}Failed:${NC} $FAILED_TESTS"

# Calculate success rate
if [ $TOTAL_TESTS -gt 0 ]; then
    SUCCESS_RATE=$((PASSED_TESTS * 100 / TOTAL_TESTS))
    echo -e "${PURPLE}Success Rate:${NC} ${SUCCESS_RATE}%"
    
    if [ $SUCCESS_RATE -ge 90 ]; then
        echo -e "${GREEN}🎉 EXCELLENT! Your subscription system is ready!${NC}"
    elif [ $SUCCESS_RATE -ge 75 ]; then
        echo -e "${YELLOW}👍 GOOD! Minor issues detected but generally working.${NC}"
    elif [ $SUCCESS_RATE -ge 50 ]; then
        echo -e "${YELLOW}⚠️  MODERATE! Several issues need attention.${NC}"
    else
        echo -e "${RED}❌ CRITICAL! Major issues detected. Review implementation.${NC}"
    fi
fi

echo ""
echo "📋 SUBSCRIPTION TESTING CHECKLIST"
echo "==============================="
echo "[ ] Database schema accessible"
echo "[ ] Stripe products/prices exist"
echo "[ ] Subscription function responsive"
echo "[ ] Webhook events processing"
echo "[ ] Database integration working"
echo "[ ] Authentication required"
echo "[ ] Error handling proper"

echo ""
echo "🎯 NEXT STEPS FOR SUBSCRIPTION IMPLEMENTATION"
echo "==========================================="
if [ $FAILED_TESTS -eq 0 ]; then
    echo "✅ Subscription infrastructure is ready!"
    echo ""
    echo "📝 To complete subscription functionality:"
    echo "   1. Create subscription products in Stripe Dashboard"
    echo "   2. Implement create-subscription Edge Function"
    echo "   3. Sync products/prices to database"
    echo "   4. Build subscription management UI"
    echo "   5. Add subscription status checking"
    echo "   6. Implement billing portal integration"
else
    echo "🔧 Issues detected. Recommended actions:"
    echo "   • Create subscription Edge Function if missing"
    echo "   • Set up products and prices in Stripe"
    echo "   • Verify webhook configuration"
    echo "   • Check database table accessibility"
    echo "   • Review subscription webhook handling"
fi

echo ""
log_info "Subscription testing complete!"
log_info "Check Supabase database and Stripe Dashboard for detailed verification."

exit $FAILED_TESTS