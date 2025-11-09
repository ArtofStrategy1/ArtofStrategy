#!/bin/bash
# PLS Analysis Test Script
API_URL="https://analysis.data2int.com"

echo "🧪 Testing PLS Analysis..."
echo "=========================="

# Create sample PLS data (manufacturing process optimization example)
echo "📊 Creating sample PLS data..."
cat > pls_data.csv << EOF
temperature,pressure,catalyst_conc,ph_level,reaction_time,moisture,yield
85.2,2.3,0.15,7.2,120,0.05,78.5
87.1,2.5,0.18,7.4,115,0.04,81.2
82.8,2.1,0.12,6.9,125,0.06,75.8
89.3,2.7,0.20,7.6,110,0.03,84.1
84.5,2.2,0.14,7.1,122,0.055,77.9
88.7,2.6,0.19,7.5,112,0.035,82.6
83.1,2.0,0.11,6.8,128,0.065,74.2
90.5,2.8,0.22,7.8,108,0.025,86.3
86.0,2.4,0.16,7.3,118,0.045,79.7
87.8,2.55,0.185,7.45,114,0.038,81.8
81.9,1.9,0.10,6.7,130,0.07,72.5
91.2,2.9,0.23,7.9,106,0.02,87.9
85.8,2.35,0.155,7.25,119,0.048,78.9
88.2,2.58,0.19,7.52,113,0.036,82.1
83.7,2.05,0.125,6.95,126,0.062,76.3
89.8,2.75,0.21,7.7,109,0.028,85.2
84.2,2.18,0.135,7.05,123,0.058,77.1
87.5,2.52,0.175,7.42,116,0.042,80.8
82.3,1.95,0.105,6.75,129,0.068,73.7
90.8,2.85,0.225,7.85,107,0.022,87.1
86.5,2.42,0.165,7.35,117,0.046,80.2
88.9,2.62,0.195,7.58,111,0.032,83.4
81.5,1.85,0.095,6.65,132,0.072,71.8
92.1,3.0,0.24,8.0,105,0.018,89.2
85.0,2.28,0.145,7.18,121,0.052,78.1
EOF

# Create manufacturing context file
echo "📝 Creating manufacturing context..."
cat > manufacturing_context.txt << EOF
PLS Analysis for Chemical Manufacturing Process Optimization

We are analyzing the relationship between process parameters and product yield 
in our chemical manufacturing process. The goal is to identify which process 
variables most strongly influence yield and understand their combined effects.

Process Variables:
- Temperature: Reaction temperature (°C)
- Pressure: System pressure (bar)  
- Catalyst concentration: Active catalyst percentage
- pH level: Solution pH
- Reaction time: Process duration (minutes)
- Moisture: Environmental moisture content

Target Variable:
- Yield: Product yield percentage

Business Objectives:
1. Identify key process drivers for yield optimization
2. Understand variable interactions and latent factors
3. Develop predictive model for process control
4. Reduce process variability and improve efficiency

This analysis will inform our process control strategy and help optimize 
manufacturing parameters for maximum yield.
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

# Test 2: Basic PLS analysis (auto-optimize components)
echo "2️⃣ Testing basic PLS analysis (auto-optimize components)..."
curl -s -X POST "$API_URL/api/pls" \
  -F "data_file=@pls_data.csv" \
  -F "target_column=yield" \
  -F "context_file=@manufacturing_context.txt" \
  > basic_pls_response.json

if [ $? -eq 0 ]; then
    echo "✅ Basic PLS test successful"
    echo "📄 Response saved to basic_pls_response.json"
    
    # Check if response contains expected fields
    if grep -q "model_summary" basic_pls_response.json && grep -q "vip_scores" basic_pls_response.json; then
        echo "✅ Response contains model summary and VIP scores"
    else
        echo "⚠️ Response may be incomplete - check basic_pls_response.json"
    fi
else
    echo "❌ Basic PLS test failed"
fi
echo ""

# Test 3: Custom PLS with specific features and components
echo "3️⃣ Testing custom PLS with specific features and components..."
curl -s -X POST "$API_URL/api/pls" \
  -F "data_file=@pls_data.csv" \
  -F "target_column=yield" \
  -F 'feature_columns=["temperature", "pressure", "catalyst_conc", "ph_level"]' \
  -F "n_components=3" \
  -F "test_size=0.25" \
  -F "scale_data=true" \
  -F "context_file=@manufacturing_context.txt" \
  > custom_pls_response.json

if [ $? -eq 0 ]; then
    echo "✅ Custom PLS test successful"
    echo "📄 Response saved to custom_pls_response.json"
    
    # Check if response contains expected components
    if grep -q "n_components.*3" custom_pls_response.json; then
        echo "✅ Custom component count found in response"
    else
        echo "⚠️ Custom components may not be set correctly - check custom_pls_response.json"
    fi
else
    echo "❌ Custom PLS test failed"
fi
echo ""

# Test 4: Test with text data instead of file
echo "4️⃣ Testing with pasted text data..."
sample_text_data="temperature,pressure,catalyst_conc,ph_level,yield
85.2,2.3,0.15,7.2,78.5
87.1,2.5,0.18,7.4,81.2
82.8,2.1,0.12,6.9,75.8
89.3,2.7,0.20,7.6,84.1
84.5,2.2,0.14,7.1,77.9
88.7,2.6,0.19,7.5,82.6"

curl -s -X POST "$API_URL/api/pls" \
  -F "data_text=$sample_text_data" \
  -F "target_column=yield" \
  -F "n_components=2" \
  -F "scale_data=false" \
  > text_pls_response.json

if [ $? -eq 0 ]; then
    echo "✅ Text data PLS test successful"
    echo "📄 Response saved to text_pls_response.json"
else
    echo "❌ Text data PLS test failed"
fi
echo ""

# Test 5: Error handling - invalid target column
echo "5️⃣ Testing error handling (invalid target column)..."
error_response=$(curl -s -X POST "$API_URL/api/pls" \
  -F "data_file=@pls_data.csv" \
  -F "target_column=invalid_column_name" 2>&1)

if [[ $error_response == *"error"* ]] || [[ $error_response == *"400"* ]] || [[ $error_response == *"not found"* ]]; then
    echo "✅ Error handling test successful - API properly rejected invalid target"
else
    echo "⚠️ Error handling may not be working as expected"
    echo "Response: $error_response"
fi
echo ""

# Test 6: Error handling - invalid number of components
echo "6️⃣ Testing error handling (invalid components)..."
error_response=$(curl -s -X POST "$API_URL/api/pls" \
  -F "data_file=@pls_data.csv" \
  -F "target_column=yield" \
  -F "n_components=0" 2>&1)

if [[ $error_response == *"error"* ]] || [[ $error_response == *"400"* ]]; then
    echo "✅ Error handling test successful - API properly rejected invalid component count"
else
    echo "⚠️ Error handling may not be working as expected"
    echo "Response: $error_response"
fi
echo ""

# Test 7: Performance test with larger dataset
echo "7️⃣ Testing performance with larger dataset..."
echo "📊 Generating larger dataset (200 rows)..."

# Generate larger dataset
cat > large_pls_data.csv << EOF
temp,pressure,catalyst,ph,time,moisture,additive1,additive2,yield
EOF

# Generate 200 rows of synthetic data with more complex relationships
for i in {1..200}; do
    # Base parameters with some correlation structure
    temp=$((RANDOM % 1500 + 8000))  # 80.0 - 95.0
    temp_decimal=$(echo "scale=1; $temp/100" | bc)
    
    pressure=$((RANDOM % 100 + 180))  # 1.8 - 2.8
    pressure_decimal=$(echo "scale=2; $pressure/100" | bc)
    
    catalyst=$((RANDOM % 15 + 8))  # 0.08 - 0.23
    catalyst_decimal=$(echo "scale=3; $catalyst/100" | bc)
    
    ph=$((RANDOM % 150 + 650))  # 6.5 - 8.0
    ph_decimal=$(echo "scale=1; $ph/100" | bc)
    
    time=$((RANDOM % 30 + 105))  # 105 - 135
    
    moisture=$((RANDOM % 6 + 2))  # 0.02 - 0.08
    moisture_decimal=$(echo "scale=3; $moisture/100" | bc)
    
    additive1=$((RANDOM % 50 + 10))  # 0.10 - 0.60
    add1_decimal=$(echo "scale=2; $additive1/100" | bc)
    
    additive2=$((RANDOM % 30 + 5))  # 0.05 - 0.35
    add2_decimal=$(echo "scale=2; $additive2/100" | bc)
    
    # Complex yield calculation with interactions
    base_yield=$(echo "scale=2; ($temp_decimal * 0.5) + ($pressure_decimal * 8) + ($catalyst_decimal * 100) + ($ph_decimal * 2) - ($time * 0.1) - ($moisture_decimal * 50)" | bc)
    noise=$((RANDOM % 400 - 200))  # ±2.0 random noise
    noise_decimal=$(echo "scale=2; $noise/100" | bc)
    final_yield=$(echo "scale=1; $base_yield + $noise_decimal" | bc)
    
    echo "$temp_decimal,$pressure_decimal,$catalyst_decimal,$ph_decimal,$time,$moisture_decimal,$add1_decimal,$add2_decimal,$final_yield" >> large_pls_data.csv
done

start_time=$(date +%s)
curl -s -X POST "$API_URL/api/pls" \
  -F "data_file=@large_pls_data.csv" \
  -F "target_column=yield" \
  -F "test_size=0.3" \
  > large_pls_response.json
end_time=$(date +%s)

duration=$((end_time - start_time))

if [ $? -eq 0 ]; then
    echo "✅ Large dataset test successful"
    echo "⏱️ Processing time: ${duration} seconds"
    echo "📄 Response saved to large_pls_response.json"
else
    echo "❌ Large dataset test failed"
fi
echo ""

# Test 8: Test without scaling
echo "8️⃣ Testing PLS without data scaling..."
curl -s -X POST "$API_URL/api/pls" \
  -F "data_file=@pls_data.csv" \
  -F "target_column=yield" \
  -F "scale_data=false" \
  -F "n_components=2" \
  > unscaled_pls_response.json

if [ $? -eq 0 ]; then
    echo "✅ Unscaled PLS test successful"
    echo "📄 Response saved to unscaled_pls_response.json"
else
    echo "❌ Unscaled PLS test failed"
fi
echo ""

# Summary and analysis
echo "📋 TEST SUMMARY"
echo "================"

response_files=(
    "basic_pls_response.json"
    "custom_pls_response.json" 
    "text_pls_response.json"
    "large_pls_response.json"
    "unscaled_pls_response.json"
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

# Check basic PLS results
if [ -f "basic_pls_response.json" ]; then
    echo "📊 Basic PLS analysis:"
    
    # Extract key metrics if available
    if command -v jq &> /dev/null; then
        # Check for model summary
        components=$(jq -r '.model_summary.n_components // "N/A"' basic_pls_response.json 2>/dev/null)
        cv_r2=$(jq -r '.model_summary.cv_r2_score // "N/A"' basic_pls_response.json 2>/dev/null)
        n_features=$(jq -r '.model_summary.n_features // "N/A"' basic_pls_response.json 2>/dev/null)
        
        echo "   Components: $components"
        echo "   CV R²: $cv_r2"
        echo "   Features: $n_features"
        
        # Check for VIP scores
        vip_check=$(jq -r '.vip_scores_csv' basic_pls_response.json 2>/dev/null | head -3)
        if [ ! -z "$vip_check" ] && [ "$vip_check" != "null" ]; then
            echo "   ✅ VIP scores available"
        else
            echo "   ⚠️ VIP scores may be missing"
        fi
        
        # Check for plots
        plot_check=$(jq -r '.plots | keys[]' basic_pls_response.json 2>/dev/null)
        if [ ! -z "$plot_check" ]; then
            echo "   📈 Available plots: $(echo $plot_check | tr '\n' ' ')"
        else
            echo "   ⚠️ Plots may be missing"
        fi
        
    else
        echo "   Install 'jq' for detailed JSON parsing"
    fi
fi

echo ""
echo "🔍 VIP Score Analysis:"
if [ -f "basic_pls_response.json" ] && command -v jq &> /dev/null; then
    # Extract and display top VIP scores
    vip_scores=$(jq -r '.vip_scores_csv' basic_pls_response.json 2>/dev/null)
    if [ ! -z "$vip_scores" ] && [ "$vip_scores" != "null" ]; then
        echo "   Top important features (VIP ≥ 1.0):"
        echo "$vip_scores" | grep -E "(Feature|[1-9]\.[0-9])" | head -5
    fi
fi

echo ""
echo "📊 Performance Comparison:"
if command -v jq &> /dev/null; then
    for file in basic_pls_response.json custom_pls_response.json; do
        if [ -f "$file" ]; then
            filename=$(basename "$file" .json)
            test_r2=$(jq -r '.performance_metrics_csv' "$file" 2>/dev/null | grep "R²" | grep -o '[0-9]\+\.[0-9]\+' | tail -1)
            components=$(jq -r '.model_summary.n_components // "N/A"' "$file" 2>/dev/null)
            echo "   $filename: Test R² = ${test_r2:-N/A}, Components = $components"
        fi
    done
fi

echo ""
echo "🧹 Cleanup options:"
echo "   Keep files: All response files saved for analysis"
echo "   Clean up: Run 'rm -f *pls*.csv *pls*.json manufacturing_context.txt'"

echo ""
echo "✅ PLS Analysis Testing Complete!"
echo "📖 Check the JSON response files for detailed results"
echo "🎯 Key validation points:"
echo "   - VIP scores for variable importance"
echo "   - Component optimization results"
echo "   - Predicted vs actual plots"
echo "   - Feature loadings analysis"