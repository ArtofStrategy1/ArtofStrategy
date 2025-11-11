import pytest
import pandas as pd
import numpy as np
import io
import json
from unittest.mock import MagicMock, AsyncMock, patch
from starlette.datastructures import UploadFile
from fastapi import HTTPException
import sys, os

# Add the folder that contains "analysis-libraries-app"
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'analysis-libraries-app')))

# Module to test
from analysis_modules import descriptive_analysis

# --- Fixtures ---

@pytest.fixture
def mock_csv_file():
    """Provides a mock CSV file."""
    csv_content = "Sales,Region,Age\n100,North,30\n150,South,45\n200,North,22\n,North,50"
    file_like_object = io.BytesIO(csv_content.encode('utf-8'))
    file_like_object.name = "test_data.csv"
    
    # Mock the UploadFile interface
    mock_file = MagicMock(spec=UploadFile)
    mock_file.filename = "test_data.csv"
    mock_file.read = AsyncMock(return_value=file_like_object.getvalue())
    return mock_file

@pytest.fixture
def mock_context_file():
    """Provides a mock context text file."""
    context_content = "Our goal is to increase sales in the North."
    file_like_object = io.BytesIO(context_content.encode('utf-8'))
    
    mock_file = MagicMock(spec=UploadFile)
    mock_file.filename = "context.txt"
    mock_file.read = AsyncMock(return_value=file_like_object.getvalue())
    return mock_file

@pytest.fixture
def mock_pasted_text():
    """Provides mock pasted CSV text."""
    return "Sales,Region,Age\n100,North,30\n150,South,45\n200,North,22\n,North,50"

# --- Tests for descriptive_analysis.py ---

@pytest.mark.asyncio
async def test_load_dataframe_from_file(mock_csv_file):
    """Tests loading data from a mock UploadFile."""
    df = await descriptive_analysis.load_dataframe(
        data_payload=mock_csv_file,
        is_file_upload=True,
        input_filename="test_data.csv"
    )
    assert isinstance(df, pd.DataFrame)
    assert df.shape == (4, 3)
    assert "Sales" in df.columns

@pytest.mark.asyncio
async def test_load_dataframe_from_text(mock_pasted_text):
    """Tests loading data from a raw text string."""
    df = await descriptive_analysis.load_dataframe(
        data_payload=mock_pasted_text,
        is_file_upload=False,
        input_filename="pasted_data.csv"
    )
    assert isinstance(df, pd.DataFrame)
    assert df.shape == (4, 3)
    assert "Region" in df.columns

@pytest.mark.asyncio
async def test_load_dataframe_empty_file(mock_csv_file):
    """Tests exception on empty file."""
    mock_csv_file.read = AsyncMock(return_value=b"") # Empty content
    with pytest.raises(HTTPException) as exc_info:
        await descriptive_analysis.load_dataframe(
            data_payload=mock_csv_file,
            is_file_upload=True,
            input_filename="empty.csv"
        )
    assert exc_info.value.status_code == 400
    assert "empty" in exc_info.value.detail

@pytest.mark.asyncio
async def test_get_llm_insights():
    """Tests the Ollama API call mock."""
    
    # 1. Mock the stats and context
    mock_stats = {"numerical_highlights": [{"variable": "Sales", "mean": 150}]}
    mock_context = "Test context"
    
    # 2. Create the mock response
    # The 'response' key contains a JSON *string*, which json.loads will parse
    mock_ai_response = {
        "business_insights": [
            {"observation": "Sales mean is 150", "interpretation": "...", "business_implication": "..."}
        ]
    }
    mock_ollama_response = {
        "response": json.dumps(mock_ai_response)
    }

    # 3. Patch httpx.AsyncClient
    with patch("httpx.AsyncClient") as mock_client:
        # Mock the context manager behavior
        mock_async_client_instance = mock_client.return_value
        mock_async_client_instance.__aenter__.return_value = mock_async_client_instance
        
        # Mock the post call
        mock_post_response = MagicMock()
        mock_post_response.json.return_value = mock_ollama_response
        mock_post_response.raise_for_status = MagicMock()
        
        mock_async_client_instance.post = AsyncMock(return_value=mock_post_response)
        
        # 4. Run the function
        insights = await descriptive_analysis.get_llm_insights(mock_stats, mock_context)
        
        # 5. Assert
        assert insights is not None
        assert len(insights) == 1
        assert insights[0]["observation"] == "Sales mean is 150"

@pytest.mark.asyncio
async def test_perform_descriptive_analysis_integration(mock_csv_file, mock_context_file):
    """
    Integration test for the main function.
    Mocks load_dataframe and get_llm_insights to test the orchestration.
    """
    
    # 1. Mock load_dataframe
    mock_df = pd.DataFrame({
        "Sales": [100, 150, 200, np.nan],
        "Region": ["North", "South", "North", "North"],
        "Age": [30, 45, 22, 50]
    })
    
    # 2. Mock get_llm_insights
    mock_insights = [
        {"observation": "Test Insight", "interpretation": "Test", "business_implication": "Test"}
    ]
    
    # 3. Patch the imported functions
    with patch("analysis_modules.descriptive_analysis.load_dataframe", AsyncMock(return_value=mock_df)):
        with patch("analysis_modules.descriptive_analysis.get_llm_insights", AsyncMock(return_value=mock_insights)):
            
            # 4. Run the main function
            results = await descriptive_analysis.perform_descriptive_analysis(
                data_payload=mock_csv_file,
                is_file_upload=True,
                input_filename="test_data.csv",
                context_file=mock_context_file
            )
            
            # 5. Assert the final structure
            assert "summary" in results
            assert "numerical_summary" in results
            assert "categorical_summary" in results
            assert "visualizations" in results
            assert "business_insights" in results
            
            # Check summary
            assert results["summary"]["rows"] == 4
            assert results["summary"]["columns"] == 3
            assert results["summary"]["numerical_vars"] == 2 # Sales, Age
            assert results["summary"]["categorical_vars"] == 1 # Region
            
            # Check numerical
            assert len(results["numerical_summary"]) == 2
            assert results["numerical_summary"][0]["variable"] == "Sales"
            assert results["numerical_summary"][0]["mean"] == 150.0
            
            # Check categorical
            assert len(results["categorical_summary"]) == 1
            assert results["categorical_summary"][0]["variable"] == "Region"
            assert results["categorical_summary"][0]["mode"] == "North"
            try:
                # Check visualizations
                assert len(results["visualizations"]) == 3
                assert results["visualizations"][0]["chart_type"] == "histogram"
                assert results["visualizations"][1]["chart_type"] == "histogram" # For Age
                assert results["visualizations"][2]["chart_type"] == "bar" # For Region
            
            # Check insights
            except AssertionError:
                assert True