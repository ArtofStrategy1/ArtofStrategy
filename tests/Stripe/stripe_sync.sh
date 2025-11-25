#!/bin/bash

# ==========================================
# Stripe "PULL" Script (Sync to Database)
# ==========================================

# Configuration
SUPABASE_URL="https://supabase.sageaios.com"
SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNjQwOTk1MjAwLCJleHAiOjE5NTYzNTUyMDB9.KHXKQpsN6MNB08H_IPxP4Gh0gjcsvXG9IeJuK3XpnAU"
LOGIN_EMAIL="elijahfurlonge@yahoo.com"
LOGIN_PASSWORD="Indiana07@"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Step 1: Authenticating... ===${NC}"

# 1. Login to get the JWT
LOGIN_RESPONSE=$(curl -s -X POST "${SUPABASE_URL}/auth/v1/token?grant_type=password" \
  -H "Content-Type: application/json" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -d "{ \"email\": \"$LOGIN_EMAIL\", \"password\": \"$LOGIN_PASSWORD\" }")

# Extract Token (No JQ version to be safe)
TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"access_token":"[^"]*' | grep -o '[^"]*$')

if [ -z "$TOKEN" ]; then
  echo -e "${RED}❌ Login failed.${NC}"
  exit 1
fi
echo -e "${GREEN}✅ Authenticated!${NC}"

# 2. Trigger the Pull
echo -e "\n${BLUE}=== Step 2: Pulling Data from Stripe -> Database ===${NC}"
echo "Triggering 'sync-products' function..."

SYNC_RESPONSE=$(curl -s -X POST "${SUPABASE_URL}/functions/v1/stripe-sync-products" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json")

echo "Response: $SYNC_RESPONSE"

# 3. Verify Results
echo -e "\n${BLUE}=== Step 3: verifying Database Content ===${NC}"

# Count Products
PROD_COUNT=$(curl -s -I -X GET "${SUPABASE_URL}/rest/v1/products?select=id" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "Range: 0-99" | grep -i "content-range" | cut -d '/' -f 2 | tr -d '\r')

# Count Prices
PRICE_COUNT=$(curl -s -I -X GET "${SUPABASE_URL}/rest/v1/prices?select=id" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "Range: 0-99" | grep -i "content-range" | cut -d '/' -f 2 | tr -d '\r')

echo -e "${GREEN}✅ Database Status:${NC}"
echo " > Products in DB: $PROD_COUNT"
echo " > Prices in DB:   $PRICE_COUNT"

echo -e "\nYour database is now synced with Stripe."