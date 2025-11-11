import pytest
import pandas as pd
import numpy as np
import io
import json
from unittest.mock import MagicMock, AsyncMock, patch
from starlette.datastructures import UploadFile
from fastapi import HTTPException

# Module to test
from analysis_modules import visualization_analysis

# --- Fixtures ---

@pytest.fixture
def mock_viz_file():
    """Provides a mock CSV file for visualization."""
    csv_content = (
        "Date,Sales_Revenue,Marketing_Spend,Region,Customer_Satisfaction\n"
        "2024-01-01,10000,500,North,4.5\n"
        "2024-02-01,12000,600,North,4.2\n"
        "2024-03-01,15000,700,South,4.8\n"
        "2024-04-01,13000,650,South,4.6\n"
        "2024-05-01,18000,800,West,4.9\n"
        "2024-06-01,20000,900,West,5.0\n"
    )
    file_like_object = io.BytesIO(csv_content.encode('utf-8'))
    
    mock_file = MagicMock(spec=UploadFile)
    mock_file.filename = "viz_data.csv"
    mock_file.read = AsyncMock(return_value=file_like_object.getvalue())
    return mock_file

@pytest.fixture
def mock_viz_context_file():
    """Provides a mock context file for visualization."""
    context_content = "Show me the trend of Sales_Revenue over Date and the correlation between Sales_Revenue and Marketing_Spend. Also, what are the sales by Region?"
    file_like_object = io.BytesIO(context_content.encode('utf-8'))
    
    mock_file = MagicMock(spec=UploadFile)
    mock_file.filename = "context.txt"
    mock_file.read = AsyncMock(return_value=file_like_object.getvalue())
    return mock_file

@pytest.fixture
def mock_viz_df():
    """Provides a mock DataFrame for internal function testing."""
    return pd.read_csv(io.StringIO(MOCK_VIZ_CSV))

# --- Tests for visualization_analysis.py ---

def test_detect_column_types(mock_viz_df):
    """Tests the column type detection logic."""
    col_info = visualization_analysis.detect_column_types(mock_viz_df)
    
    assert col_info["Date"]["data_type"] == "datetime"
    assert col_info["Sales_Revenue"]["data_type"] == "numerical"
    assert col_info["Marketing_Spend"]["data_type"] == "numerical"
    assert col_info["Region"]["data_type"] == "categorical"
    assert col_info["Customer_Satisfaction"]["data_type"] == "numerical"
    assert col_info["Region"]["unique_count"] == 3

def test_create_bar_chart_aggregation(mock_viz_df):
    """Tests the bar chart with the new aggregation logic."""
    viz = visualization_analysis.create_bar_chart(
        mock_viz_df, 
        column="Region", 
        value_col="Sales_Revenue"
    )
    
    assert viz["chart_type"] == "bar"
    assert "Total Sales_Revenue by Region" in viz["title"]
    assert "categories" in viz["data"]
    assert "values" in viz["data"]
    assert "North" in viz["data"]["categories"]
    # Sum of Sales for North: 10000 + 12000 = 22000
    north_index = viz["data"]["categories"].index("North")
    assert viz["data"]["values"][north_index] == 22000

def test_create_pie_chart_aggregation(mock_viz_df):
    """Tests the pie chart with the new aggregation logic."""
    viz = visualization_analysis.create_pie_chart(
        mock_viz_df, 
        column="Region", 
        value_col="Sales_Revenue"
    )
    assert viz["chart_type"] == "pie"
    assert "Distribution of Sales_Revenue by Region" in viz["title"]
    assert "labels" in viz["data"]
    assert "values" in viz["data"]
    assert "North" in viz["data"]["labels"]
    north_index = viz["data"]["labels"].index("North")
    assert viz["data"]["values"][north_index] == 22000

@pytest.mark.asyncio
async def test_get_chart_plan_from_llm():
    """Mocks the Ollama call for getting a chart plan."""
    mock_context = "Show sales by region."
    mock_col_info = {
        "Sales": {"data_type": "numerical"},
        "Region": {"data_type": "categorical"}
    }
    
    # Mock the JSON *string* inside the 'response' key
    mock_ai_response = {
        "chart_configs": [
            {"chart_type": "bar", "columns": ["Region", "Sales"], "reason": "Test plan"}
        ]
    }
    mock_ollama_response = {"response": json.dumps(mock_ai_response)}

    with patch("httpx.AsyncClient") as mock_client:
        mock_async_client_instance = mock_client.return_value
        mock_async_client_instance.__aenter__.return_value = mock_async_client_instance
        
        mock_post_response = MagicMock()
        mock_post_response.json.return_value = mock_ollama_response
        mock_post_response.raise_for_status = MagicMock()
        
        mock_async_client_instance.post = AsyncMock(return_value=mock_post_response)
        
        plan = await visualization_analysis._get_chart_plan_from_llm(mock_context, mock_col_info)
        
        assert plan is not None
        assert len(plan) == 1
        assert plan[0]["chart_type"] == "bar"

def test_execute_chart_plan(mock_viz_df):
    """Tests the function that executes the AI's chart plan."""
    df = mock_viz_df.copy()
    
    # Plan from the LLM
    chart_plan = [
        {"chart_type": "line", "columns": ["Date", "Sales_Revenue"], "reason": "Test trend"},
        {"chart_type": "bar", "columns": ["Region", "Sales_Revenue"], "reason": "Test aggregate"},
        {"chart_type": "histogram", "columns": ["Customer_Satisfaction"], "reason": "Test distribution"},
        {"chart_type": "bad_chart", "columns": ["Sales_Revenue"], "reason": "Test failure"},
        {"chart_type": "scatter", "columns": ["MISSING_COL", "Sales_Revenue"], "reason": "Test missing col"}
    ]
    
    visualizations = visualization_analysis._execute_chart_plan(df, chart_plan)
    
    assert len(visualizations) == 5
    
    # Check success cases
    assert "error" not in visualizations[0]
    assert visualizations[0]["chart_type"] == "line"
    assert visualizations[0]["suggestion_reason"] == "Test trend"
    
    assert "error" not in visualizations[1]
    assert visualizations[1]["chart_type"] == "bar"
    assert "Total Sales_Revenue by Region" in visualizations[1]["title"]
    assert visualizations[1]["data"]["categories"] == ["West", "South", "North"]
    assert visualizations[1]["data"]["values"][0] == 38000 # 18k + 20k
    
    assert "error" not in visualizations[2]
    assert visualizations[2]["chart_type"] == "histogram"
    
    # Check failure cases
    assert "error" in visualizations[3]
    assert "Unsupported chart type" in visualizations[3]["error"]
    
    assert "error" in visualizations[4]
    assert "Column 'MISSING_COL' requested by AI not found" in visualizations[4]["error"]

@pytest.mark.asyncio
async def test_perform_visualization_analysis_integration(mock_viz_file, mock_viz_context_file, mock_viz_df):
    """
    Integration test for the main visualization function.
    Mocks file loading and all three Ollama calls.
    """
    
    # 1. Mock file/context loading
    mock_context = await mock_viz_context_file.read().decode('utf-8')
    
    # 2. Mock Ollama call 1: Chart Plan
    mock_chart_plan_response = {
        "response": json.dumps({
            "chart_configs": [
                {"chart_type": "line", "columns": ["Date", "Sales_Revenue"], "reason": "Sales trend"},
                {"chart_type": "bar", "columns": ["Region", "Sales_Revenue"], "reason": "Sales by Region"}
            ]
        })
    }
    
    # 3. Mock Ollama call 2: Insights
    mock_insights_response = {
        "response": json.dumps({
            "visualization_insights": [
                {"observation": "Sales are trending up", "interpretation": "...", "recommendation": "..."}
            ]
        })
    }
    
    # 4. Mock Ollama call 3: Suggestions
    mock_suggestions_response = {
        "response": json.dumps({
            "chart_configs": [
                {"chart_type": "heatmap", "columns": ["Sales_Revenue", "Marketing_Spend"], "reason": "Test suggestion"}
            ]
        })
    }
    
    # 5. Patch httpx.AsyncClient
    with patch("httpx.AsyncClient") as mock_client:
        mock_async_client_instance = mock_client.return_value
        mock_async_client_instance.__aenter__.return_value = mock_async_client_instance
        
        # Configure the mock post to return different responses based on the call
        mock_async_client_instance.post.side_effect = [
            # First call (Chart Plan)
            AsyncMock(json=MagicMock(return_value=mock_chart_plan_response), raise_for_status=MagicMock()),
            # Second call (Insights)
            AsyncMock(json=MagicMock(return_value=mock_insights_response), raise_for_status=MagicMock()),
            # Third call (Suggestions)
            AsyncMock(json=MagicMock(return_value=mock_suggestions_response), raise_for_status=MagicMock())
        ]
        
        # 6. Patch file loading
        with patch("analysis_modules.visualization_analysis.load_dataframe", AsyncMock(return_value=mock_viz_df)):
            with patch("analysis_modules.visualization_analysis._load_context", AsyncMock(return_value=mock_context)):
                
                # 7. Run main function
                results = await visualization_analysis.perform_visualization_analysis(
                    data_payload=mock_viz_file,
                    is_file_upload=True,
                    input_filename="viz_data.csv",
                    context_file=mock_viz_context_file
                )
                
                # 8. Assert final structure
                assert "dataset_info" in results
                assert "visualizations" in results
                assert "insights" in results
                assert "suggestions" in results
                
                assert results["dataset_info"]["rows"] == 6
                assert len(results["visualizations"]) == 2
                assert results["visualizations"][0]["chart_type"] == "line"
                assert results["visualizations"][1]["chart_type"] == "bar"
                assert "Sales trend" in results["visualizations"][0]["suggestion_reason"]
                
                assert len(results["insights"]) == 1
                assert "Sales are trending up" in results["insights"][0]["observation"]
                
                assert len(results["suggestions"]) == 1
                assert "heatmap" in results["suggestions"][0]["reason"]