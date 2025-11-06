#!/bin/bash
# Simple Regression Test Script
API_URL="https://analysis.data2int.com"

echo "🧪 Testing Regression Analysis..."
echo "================================="

# Create sample regression data
echo "📊 Creating sample regression data..."
cat > regression_data.csv << EOF
marketing_spend,product_price,customer_rating,region,sales_revenue
5000,29.99,4.2,North,15000
7500,34.99,4.5,South,22000
3000,24.99,3.8,East,12000
9000,39.99,4.7,West,28000
4500,27.99,4.0,North,16500
6800,32.99,4.4,South,20500
2800,22.99,3.5,East,10800
8200,37.99,4.6,West,25200
5200,30.99,4.1,North,17800
6200,33.99,4.3,South,19200
3500,25.99,3.9,East,13500
7800,36.99,4.5,West,24800
4800,28.99,4.0,North,16200
6500,31.99,4.2,South,20800
3200,23.99,3.7,East,11500
8500,38.99,4.8,West,26500
5500,29.99,4.3,North,18500
7200,35.99,4.4,South,23200
2900,21.99,3.6,East,10200
8800,40.99,4.9,West,29800
EOF

# Create business context file
echo "📝 Creating business context..."
cat > business_context.txt << EOF
We are analyzing sales revenue prediction for our e-commerce platform.
The goal is to understand how marketing spend, product pricing, and customer ratings
impact sales revenue across different regions.

Key business questions:
1. Which factors most strongly predict sales revenue?
2. Is there a optimal marketing spend level for ROI?
3. How does pricing strategy affect revenue?
4. Are there regional differences in sales patterns?

This analysis will inform our Q2 marketing budget allocation and pricing strategy.
EOF

echo ""

# Test 1: Check API status
echo "1️⃣ Checking API status..."
status_response=$(curl -s -X GET "$API_URL/status")
if [[ $status_response == *"running"* ]]; then
    echo "✅ API is running"
else
    echo "❌ API status check failed"
    echo "Response: $status_response"
fi
echo ""

# Test 2: Basic regression analysis (auto-detect features)
echo "2️⃣ Testing basic regression analysis (auto-detect features)..."
curl -s -X POST "$API_URL/api/regression" \
  -F "data_file=@regression_data.csv" \
  -F "target_column=sales_revenue" \
  -F "context_file=@business_context.txt" \
  > basic_regression_response.json

if [ $? -eq 0 ]; then
    echo "✅ Basic regression test successful"
    echo "📄 Response saved to basic_regression_response.json"
    
    # Check if response contains expected fields
    if grep -q "model_results" basic_regression_response.json; then
        echo "✅ Response contains model results"
    else
        echo "⚠️ Response may be incomplete - check basic_regression_response.json"
    fi
else
    echo "❌ Basic regression test failed"
fi
echo ""

# Test 3: Custom regression with specific features and models
echo "3️⃣ Testing custom regression with specific features..."
curl -s -X POST "$API_URL/api/regression" \
  -F "data_file=@regression_data.csv" \
  -F "target_column=sales_revenue" \
  -F 'feature_columns=["marketing_spend", "product_price", "customer_rating"]' \
  -F 'model_types=["linear", "ridge", "random_forest"]' \
  -F "test_size=0.25" \
  -F "context_file=@business_context.txt" \
  > custom_regression_response.json

if [ $? -eq 0 ]; then
    echo "✅ Custom regression test successful"
    echo "📄 Response saved to custom_regression_response.json"
    
    # Check if response contains expected models
    if grep -q "linear" custom_regression_response.json && \
       grep -q "ridge" custom_regression_response.json && \
       grep -q "random_forest" custom_regression_response.json; then
        echo "✅ All requested models found in response"
    else
        echo "⚠️ Some models may be missing - check custom_regression_response.json"
    fi
else
    echo "❌ Custom regression test failed"
fi
echo ""

# Test 4: Test with text data instead of file
echo "4️⃣ Testing with pasted text data..."
sample_text_data="marketing_spend,product_price,customer_rating,sales_revenue
5000,29.99,4.2,15000
7500,34.99,4.5,22000
3000,24.99,3.8,12000
9000,39.99,4.7,28000
4500,27.99,4.0,16500"

curl -s -X POST "$API_URL/api/regression" \
  -F "data_text=$sample_text_data" \
  -F "target_column=sales_revenue" \
  -F 'model_types=["linear"]' \
  > text_regression_response.json

if [ $? -eq 0 ]; then
    echo "✅ Text data regression test successful"
    echo "📄 Response saved to text_regression_response.json"
else
    echo "❌ Text data regression test failed"
fi
echo ""

# Test 5: Error handling - invalid target column
echo "5️⃣ Testing error handling (invalid target column)..."
error_response=$(curl -s -X POST "$API_URL/api/regression" \
  -F "data_file=@regression_data.csv" \
  -F "target_column=invalid_column_name" 2>&1)

if [[ $error_response == *"error"* ]] || [[ $error_response == *"400"* ]] || [[ $error_response == *"not found"* ]]; then
    echo "✅ Error handling test successful - API properly rejected invalid target"
else
    echo "⚠️ Error handling may not be working as expected"
    echo "Response: $error_response"
fi
echo ""

# Test 6: Performance test with larger dataset
echo "6️⃣ Testing performance with larger dataset..."
echo "📊 Generating larger dataset (100 rows)..."

# Generate larger dataset
cat > large_regression_data.csv << EOF
marketing_spend,product_price,customer_rating,region,sales_revenue
EOF

# Generate 100 rows of synthetic data
for i in {1..100}; do
    marketing=$((RANDOM % 8000 + 2000))
    price=$((RANDOM % 2000 + 2000))
    price_decimal=$(echo "scale=2; $price/100" | bc)
    rating=$((RANDOM % 20 + 30))
    rating_decimal=$(echo "scale=1; $rating/10" | bc)
    regions=("North" "South" "East" "West")
    region=${regions[$((RANDOM % 4))]}
    # Simple revenue calculation with some noise
    revenue=$((marketing * 2 + $(echo "$price_decimal * 100" | bc | cut -d. -f1) * 5 + $(echo "$rating_decimal * 1000" | bc | cut -d. -f1) + RANDOM % 2000))
    echo "$marketing,$price_decimal,$rating_decimal,$region,$revenue" >> large_regression_data.csv
done

start_time=$(date +%s)
curl -s -X POST "$API_URL/api/regression" \
  -F "data_file=@large_regression_data.csv" \
  -F "target_column=sales_revenue" \
  -F 'model_types=["linear", "random_forest"]' \
  > large_regression_response.json
end_time=$(date +%s)

duration=$((end_time - start_time))

if [ $? -eq 0 ]; then
    echo "✅ Large dataset test successful"
    echo "⏱️ Processing time: ${duration} seconds"
    echo "📄 Response saved to large_regression_response.json"
else
    echo "❌ Large dataset test failed"
fi
echo ""

# Summary and analysis
echo "📋 TEST SUMMARY"
echo "================"

response_files=(
    "basic_regression_response.json"
    "custom_regression_response.json" 
    "text_regression_response.json"
    "large_regression_response.json"
)

echo "📁 Generated files:"
for file in "${response_files[@]}"; do
    if [ -f "$file" ]; then
        size=$(wc -c < "$file")
        echo "   $file (${size} bytes)"
    fi
done

echo ""
echo "🔍 Quick results check:"

# Check basic regression results
if [ -f "basic_regression_response.json" ]; then
    echo "📊 Basic regression:"
    
    # Extract R² scores if available
    if command -v jq &> /dev/null; then
        r2_scores=$(jq -r '.model_results | to_entries[] | "\(.key): R² = \(.value.test_r2 // "N/A")"' basic_regression_response.json 2>/dev/null)
        if [ ! -z "$r2_scores" ]; then
            echo "$r2_scores" | head -3
        else
            echo "   Response structure differs from expected - check file manually"
        fi
    else
        echo "   Install 'jq' for detailed JSON parsing"
    fi
fi

echo ""
echo "🧹 Cleanup options:"
echo "   Keep files: All response files saved for analysis"
echo "   Clean up: Run 'rm -f *regression*.csv *regression*.json business_context.txt'"

echo ""
echo "✅ Regression Analysis Testing Complete!"
echo "📖 Check the JSON response files for detailed results"