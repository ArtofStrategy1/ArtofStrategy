#!/bin/bash

# Quick Production Test for analysis.data2int.com
echo "🚀 Quick Production API Test"
echo "============================"
echo "🌐 Testing: https://analysis.data2int.com"
echo ""

# Check API status
echo "📡 Checking API status..."
response=$(curl -s "https://analysis.data2int.com/status")
if [ $? -eq 0 ]; then
    echo "✅ API is live!"
    echo "   Response: $response"
else
    echo "❌ API is not responding"
    exit 1
fi

echo ""
echo "🧪 Testing predictive analysis..."

# Test data for your strategic platform
TEST_DATA="Date,Revenue_USD
2021-Q1,800000
2021-Q2,850000
2021-Q3,820000
2021-Q4,900000
2022-Q1,950000
2022-Q2,1050000
2022-Q3,980000
2022-Q4,1150000
2023-Q1,1200000
2023-Q2,1350000
2023-Q3,1280000
2023-Q4,1450000
2024-Q1,1320000
2024-Q2,1480000"

echo "📊 Sample strategic data:"
echo "$TEST_DATA"
echo ""

# Make the API call to your production server
echo "🔄 Calling production API..."
response=$(curl -s -X POST "https://analysis.data2int.com/api/analysis" \
    -F "analysis_type=predictive" \
    -F "data_text=$TEST_DATA" \
    -F "date_column=Date" \
    -F "metric_column=Revenue_USD" \
    -F "forecast_horizon=year" \
    -F "model_type=auto")

echo "📨 Production API Response:"
echo ""

# Check if response contains predictions
if echo "$response" | grep -q "predictions"; then
    echo "✅ SUCCESS! Production predictive analysis is working!"
    echo ""
    
    # Extract key information using jq if available
    if command -v jq >/dev/null 2>&1; then
        echo "📊 Key Results from Production:"
        echo "$response" | jq -r '
        "Model Used: " + .model_performance.model_used,
        "Trend Detected: " + .model_performance.trend,
        "R-squared: " + (.model_performance.r_squared | tostring),
        "MAPE: " + (.model_performance.mape | tostring) + "%",
        "Predictions Generated: " + (.predictions | length | tostring)
        '
        
        echo ""
        echo "🔮 Sample Forecasts from Production:"
        echo "$response" | jq -r '.predictions[0:3][] | .period + ": $" + (.predicted_value | tostring)'
        
        echo ""
        echo "💡 Business Insight from Production:"
        echo "$response" | jq -r '.insights[0].title + ": " + (.insights[0].description | .[0:150]) + "..."'
    else
        echo "📋 Raw response (first 500 chars):"
        echo "$response" | head -c 500
        echo "..."
        echo ""
        echo "💡 Install jq for formatted output: apt-get install jq"
    fi
    
    echo ""
    echo "🎉 Your production API is ready for strategic analysis!"
    echo "🌐 API Documentation: https://analysis.data2int.com/"
    
else
    echo "❌ FAILED! No predictions found in production response."
    echo "🔍 Response details:"
    echo "$response"
    echo ""
    echo "💡 Check Docker logs: docker logs [container-name]"
fi

echo ""
echo "🏁 Production test complete!"