#!/bin/bash

echo "=== Creating New User: Eli Furlonge ==="

# Set the user details
EMAIL="supadatain@gmail.com"
PASSWORD="Supabase1@"
TIER="premium"

echo "Email: $EMAIL"
echo "Name: Eli Furlonge"
echo "Tier: $TIER"
echo "Password: $PASSWORD"
echo ""

# Make the API call to create user with tier
echo "Sending user creation request..."
RESPONSE=$(curl -s -X POST https://supabase.data2int.com/functions/v1/create-user-v3 \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"$EMAIL\", \"password\": \"$PASSWORD\", \"metadata\": {\"first_name\": \"Eli\", \"last_name\": \"Furlonge\", \"tier\": \"$TIER\"}}")

echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"

echo ""
echo "=== User Creation Completed ==="

# Check if successful
if echo "$RESPONSE" | grep -q '"success":true'; then
  echo "✓ User created successfully!"
  echo "User will receive verification email at $EMAIL"
else
  echo "✗ User creation failed"
  echo "Check the response above for details"
fi
echo ""