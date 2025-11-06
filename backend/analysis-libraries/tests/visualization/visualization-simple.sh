#!/bin/bash

# Simple Visualization Test Script
API_URL="https://analysis.data2int.com"

echo "Testing Visualization Analysis..."

# Create sample data
echo "Creating sample data..."
cat > sample_data.csv << EOF
date,sales,category,region,profit_margin
2023-01-01,1500,Electronics,North,0.25
2023-01-02,2300,Clothing,South,0.18
2023-01-03,1800,Electronics,East,0.22
2023-01-04,2100,Books,West,0.30
2023-01-05,1900,Clothing,North,0.20
2023-01-06,2500,Electronics,South,0.28
2023-01-07,1200,Books,East,0.35
2023-01-08,2800,Electronics,West,0.24
2023-01-09,1600,Clothing,North,0.19
2023-01-10,2200,Books,South,0.32
EOF

# Test 1: Check API status
echo "1. Checking API status..."
curl -X GET "$API_URL/status"
echo ""

# Test 2: Basic visualization (auto-generate)
echo "2. Testing basic visualization analysis..."
curl -X POST "$API_URL/api/data-analysis" \
  -F "analysis_type=visualization" \
  -F "data_file=@sample_data.csv" \
  > response.json

if [ $? -eq 0 ]; then
    echo "✅ Basic visualization test successful"
    echo "Response saved to response.json"
else
    echo "❌ Basic visualization test failed"
fi

# Test 3: Custom charts
echo "3. Testing custom chart configurations..."
curl -X POST "$API_URL/api/data-analysis" \
  -F "analysis_type=visualization" \
  -F "data_file=@sample_data.csv" \
  -F 'chart_configs=[
    {"chart_type":"histogram","columns":["sales"],"bins":5},
    {"chart_type":"pie","columns":["category"]},
    {"chart_type":"bar","columns":["region"]}
  ]' \
  > custom_response.json

if [ $? -eq 0 ]; then
    echo "✅ Custom charts test successful"
    echo "Response saved to custom_response.json"
else
    echo "❌ Custom charts test failed"
fi

# Clean up
echo "Cleaning up..."
rm -f sample_data.csv

echo "Test completed!"
echo "Check response.json and custom_response.json for results"