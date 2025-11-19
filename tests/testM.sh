#!/bin/bash

PDF_FILE="/root/Supabase/supabase-project/Tesla.pdf"

# Check if file exists
if [ ! -f "$PDF_FILE" ]; then
  echo "❌ Error: File '$PDF_FILE' not found in current directory"
  exit 1
fi

echo "=== Found PDF: $PDF_FILE ==="

echo -e "\n=== Getting Supabase JWT Token ==="
TOKEN=$(curl -s -X POST https://supabase.data2int.com/functions/v1/login-user-v4 \
  -H "Content-Type: application/json" \
  -d '{
    "email": "elijahfurlonge@yahoo.com",
    "password": "Indiana07@"
  }' | jq -r '.session.access_token')

if [ "$TOKEN" = "null" ] || [ -z "$TOKEN" ]; then
  echo "❌ Failed to get token"
  exit 1
fi

echo "✅ Token received: ${TOKEN:0:30}..."

echo -e "\n=== Testing JWT Validation ==="
curl -X POST https://supabase.data2int.com/functions/v1/validate-jwt-v3 \
  -H "Content-Type: application/json" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNjQwOTk1MjAwLCJleHAiOjE5NTYzNTUyMDB9.KHXKQpsN6MNB08H_IPxP4Gh0gjcsvXG9IeJuK3XpnAU" \
  -d "{
    \"headers\": {
      \"authorization\": \"Bearer $TOKEN\"
    },
    \"body\": {
      \"test\": \"validation\"
    }
  }"

echo -e "\n=== Uploading pdf to Analysis Workflow ==="

# Option 1: Multipart form upload
curl -X POST https://n8n.data2int.com/webhook-test/analysis-ev3 \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@$PDF_FILE" \
  -F "templateId=swot" \
  -F "customerName=Tesla" \
  -F "location=Ottawa" \
  -F "framework=BlueOcean" \
  -F "sections=introduction" \
  -F "messageId=1755500000000"

echo -e "\n✅ PDF upload complete"