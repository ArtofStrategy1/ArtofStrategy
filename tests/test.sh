#!/bin/bash

echo "=== Getting Supabase JWT Token ==="
TOKEN=$(curl -s -X POST https://supabase.data2int.com/functions/v1/login-user \
  -H "Content-Type: application/json" \
  -d '{
    "email": "furl0041@algonquinlive.com",
    "password": "Indiana07@"
  }' | jq -r '.session.access_token')

if [ "$TOKEN" = "null" ] || [ -z "$TOKEN" ]; then
  echo "❌ Failed to get token"
  exit 1
fi

echo "✅ Token received: ${TOKEN:0:30}..."

echo -e "\n=== Testing JWT Validation ==="
curl -X POST https://supabase.data2int.com/functions/v1/validate-jwt \
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

echo -e "\n=== Testing Analysis Workflow ==="
curl -X POST https://n8n.data2int.com/webhook-test/analysis-e \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "templateId": "swot",
    "customerName": "Ottawa Hospital",
    "location": "Ottawa",
    "useCase": "Patient Scheduling and Optimization.",
    "prompt": "Analyze the complex patient scheduling challenges facing Ottawa Hospital and develop a comprehensive optimization strategy. Focus on reducing wait times, improving resource allocation, and enhancing patient flow efficiency.",
    "framework": "BlueOcean,SCAMPER",
    "sections": "introduction,missionstatement",
    "messageId": 1755500000000
  }'