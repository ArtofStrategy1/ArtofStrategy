#!/bin/bash

# Test script for Supabase stats Edge Function
# Based on your existing authentication setup

set -e  # Exit on any error

echo "Testing Stats Edge Function..."

# Configuration (update these to match your setup)
SUPABASE_URL="https://supabase.data2int.com"  # Your Docker Supabase URL
ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNjQwOTk1MjAwLCJleHAiOjE5NTYzNTUyMDB9.KHXKQpsN6MNB08H_IPxP4Gh0gjcsvXG9IeJuK3XpnAU"
TEST_EMAIL="furl0041@algonquinlive.com"
TEST_PASSWORD="Indiana07@"

echo "Step 1: Login to get access token..."

# Login and get access token
LOGIN_RESPONSE=$(curl -s -X POST \
  "${SUPABASE_URL}/auth/v1/token?grant_type=password" \
  -H "Content-Type: application/json" \
  -H "apikey: ${ANON_KEY}" \
  -d "{
    \"email\": \"${TEST_EMAIL}\",
    \"password\": \"${TEST_PASSWORD}\"
  }")

echo "Login Response: $LOGIN_RESPONSE"

# Extract access token using jq (install with: sudo apt install jq)
ACCESS_TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.access_token // empty')

if [ -z "$ACCESS_TOKEN" ] || [ "$ACCESS_TOKEN" = "null" ]; then
  echo "Login failed! Response:"
  echo "$LOGIN_RESPONSE" | jq '.'
  exit 1
fi

echo "Login successful! Token: ${ACCESS_TOKEN:0:20}..."

echo "Step 2: Call stats function..."

# Test the stats function
STATS_RESPONSE=$(curl -s -X POST \
  "${SUPABASE_URL}/functions/v1/stats" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "apikey: ${ANON_KEY}" \
  -d '{}')

echo "Stats Response:"
echo "$STATS_RESPONSE" | jq '.'

# Check if response contains expected data
if echo "$STATS_RESPONSE" | jq -e '.database_status and .pinecone_status' > /dev/null; then
  echo "Stats function working correctly!"
  
  # Show key stats
  echo ""
  echo "Summary:"
  echo "Database Users: $(echo "$STATS_RESPONSE" | jq -r '.database_status.total_users // "N/A"')"
  echo "Database Queries: $(echo "$STATS_RESPONSE" | jq -r '.database_status.total_queries // "N/A"')"
  echo "Pinecone Status: $(echo "$STATS_RESPONSE" | jq -r '.pinecone_status.status // "N/A"')"
  echo "Total Vectors: $(echo "$STATS_RESPONSE" | jq -r '.pinecone_status.total_vectors // "N/A"')"
  echo "Book Vectors: $(echo "$STATS_RESPONSE" | jq -r '.pinecone_status.book_namespace_vectors // "N/A"')"
else
  echo "Stats function returned unexpected response!"
  exit 1
fi

echo ""
echo "All tests passed!"