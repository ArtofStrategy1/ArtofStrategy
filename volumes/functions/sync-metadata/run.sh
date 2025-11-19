#!/bin/bash

# Configuration
SUPABASE_URL="https://supabase.data2int.com"
SUPABASE_SERVICE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE2NDA5OTUyMDAsImV4cCI6MTk1NjM1NTIwMH0.hl86eEP9zpgtKJlBtwRy4snn2mune8fKwA7Jhfx5NJo"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔄 Starting metadata sync...${NC}\n"

# Fetch all users from publicv2.users
echo -e "${BLUE}📥 Fetching users from database...${NC}"
USERS_RESPONSE=$(curl -s -X GET "${SUPABASE_URL}/rest/v1/users?select=*" \
  -H "apikey: ${SUPABASE_SERVICE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_KEY}" \
  -H "Content-Type: application/json" \
  -H "Accept-Profile: publicv2" \
  -H "Content-Profile: publicv2")

# Check if request was successful
if [ $? -ne 0 ]; then
  echo -e "${RED}❌ Failed to fetch users${NC}"
  exit 1
fi

# Check if response is valid JSON
if ! echo "$USERS_RESPONSE" | jq empty 2>/dev/null; then
  echo -e "${RED}❌ Invalid response from server${NC}"
  echo "Response: $USERS_RESPONSE"
  exit 1
fi

# Count users
USER_COUNT=$(echo "$USERS_RESPONSE" | jq '. | length')
echo -e "${GREEN}✅ Found ${USER_COUNT} users${NC}\n"

# Create temp files for counters (to fix bash subshell counter issue)
SUCCESS_FILE=$(mktemp)
FAILED_FILE=$(mktemp)
FAILED_USERS_FILE=$(mktemp)
echo "0" > "$SUCCESS_FILE"
echo "0" > "$FAILED_FILE"

# Process each user
echo "$USERS_RESPONSE" | jq -c '.[]' | while read -r user; do
  USER_ID=$(echo "$user" | jq -r '.id')
  AUTH_USER_ID=$(echo "$user" | jq -r '.auth_user_id')
  EMAIL=$(echo "$user" | jq -r '.email // "no-email"')
  FIRST_NAME=$(echo "$user" | jq -r '.first_name // ""')
  LAST_NAME=$(echo "$user" | jq -r '.last_name // ""')
  TIER=$(echo "$user" | jq -r '.tier // "basic"')
  
  # Skip if no auth_user_id
  if [ "$AUTH_USER_ID" = "null" ] || [ -z "$AUTH_USER_ID" ]; then
    echo -e "${YELLOW}⚠️  Skipping user ${USER_ID} (${EMAIL}) - no auth_user_id${NC}"
    FAILED_COUNT=$(cat "$FAILED_FILE")
    echo $((FAILED_COUNT + 1)) > "$FAILED_FILE"
    echo "$EMAIL (no auth_user_id)" >> "$FAILED_USERS_FILE"
    continue
  fi
  
  echo -e "${BLUE}🔧 Updating ${EMAIL}...${NC}"
  
  # Prepare full name
  FULL_NAME="${FIRST_NAME} ${LAST_NAME}"
  FULL_NAME=$(echo "$FULL_NAME" | xargs)  # Trim whitespace
  
  # Escape special characters for JSON
  FIRST_NAME_ESC=$(echo "$FIRST_NAME" | sed 's/"/\\"/g' | sed "s/'/\\'/g")
  LAST_NAME_ESC=$(echo "$LAST_NAME" | sed 's/"/\\"/g' | sed "s/'/\\'/g")
  FULL_NAME_ESC=$(echo "$FULL_NAME" | sed 's/"/\\"/g' | sed "s/'/\\'/g")
  
  # Update auth metadata
  HTTP_CODE=$(curl -s -w "%{http_code}" -o /tmp/sync_response_$$.json -X PUT \
    "${SUPABASE_URL}/auth/v1/admin/users/${AUTH_USER_ID}" \
    -H "apikey: ${SUPABASE_SERVICE_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_SERVICE_KEY}" \
    -H "Content-Type: application/json" \
    -d "{
      \"user_metadata\": {
        \"first_name\": \"${FIRST_NAME_ESC}\",
        \"last_name\": \"${LAST_NAME_ESC}\",
        \"full_name\": \"${FULL_NAME_ESC}\"
      },
      \"app_metadata\": {
        \"role\": \"basic\",
        \"tier\": \"${TIER}\",
        \"provider\": \"email\",
        \"providers\": [\"email\"]
      }
    }")
  
  if [ "$HTTP_CODE" = "200" ]; then
    echo -e "   ${GREEN}✅ Success${NC}"
    SUCCESS_COUNT=$(cat "$SUCCESS_FILE")
    echo $((SUCCESS_COUNT + 1)) > "$SUCCESS_FILE"
  else
    ERROR_MSG=$(cat /tmp/sync_response_$$.json 2>/dev/null | jq -r '.message // .error // "Unknown error"')
    echo -e "   ${RED}❌ Failed (HTTP $HTTP_CODE): $ERROR_MSG${NC}"
    FAILED_COUNT=$(cat "$FAILED_FILE")
    echo $((FAILED_COUNT + 1)) > "$FAILED_FILE"
    echo "$EMAIL (HTTP $HTTP_CODE)" >> "$FAILED_USERS_FILE"
  fi
  
  rm -f /tmp/sync_response_$$.json
done

# Read final counts
SUCCESS_COUNT=$(cat "$SUCCESS_FILE")
FAILED_COUNT=$(cat "$FAILED_FILE")

# Print summary
echo -e "\n=================================================="
echo -e "${BLUE}📊 SYNC COMPLETE${NC}"
echo -e "=================================================="
echo -e "${GREEN}✅ Successful: ${SUCCESS_COUNT}${NC}"
echo -e "${RED}❌ Failed: ${FAILED_COUNT}${NC}"

if [ -s "$FAILED_USERS_FILE" ]; then
  echo -e "\n${RED}❌ Failed users:${NC}"
  while IFS= read -r failed_user; do
    echo -e "   - ${failed_user}"
  done < "$FAILED_USERS_FILE"
fi

# Cleanup temp files
rm -f "$SUCCESS_FILE" "$FAILED_FILE" "$FAILED_USERS_FILE"

echo ""