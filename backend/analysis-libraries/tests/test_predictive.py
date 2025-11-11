import pytest
import pandas as pd
import numpy as np
import io
from unittest.mock import MagicMock, AsyncMock, patch
from starlette.datastructures import UploadFile
from fastapi import HTTPException
from datetime import datetime
import sys, os

# Add the folder that contains "analysis-libraries-app"
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'analysis-libraries-app')))

# Module to test
from analysis_modules import predictive_analysis

# --- Fixtures ---

@pytest.fixture
def mock_timeseries_file():
    """Provides a mock time-series CSV file."""
    csv_content = (
        "Date,Revenue\n"
        "2023-01-01,100\n"
        "2023-02-01,110\n"
        "2023-03-01,105\n"
        "2023-04-01,120\n"
        "2023-05-01,130\n"
        "2023-06-01,125\n"
        "2023-07-01,140\n"
        "2023-08-01,150\n"
        "2023-09-01,145\n"
        "2023-10-01,160\n"
        "2023-11-01,170\n"
        "2023-12-01,165\n"
        "2024-01-01,180\n"
        "2024-02-01,190\n"
        "2024-03-01,185\n"
        "2024-04-01,200\n"
        "2024-05-01,210\n"
        "2024-06-01,205\n"
        "2024-07-01,220\n"
        "2024-08-01,230\n"
        "2024-09-01,225\n"
        "2024-10-01,240\n"
        "2024-11-01,250\n"
        "2024-12-01,245\n"
    )
    file_like_object = io.BytesIO(csv_content.encode('utf-8'))
    
    mock_file = MagicMock(spec=UploadFile)
    mock_file.filename = "time_series.csv"
    mock_file.read = AsyncMock(return_value=file_like_object.getvalue())
    return mock_file

@pytest.fixture
def mock_timeseries_df():
    """Provides a mock DataFrame for testing internal functions."""
    dates = pd.date_range(start="2023-01-01", periods=24, freq="MS")
    revenue = np.linspace(100, 330, 24) + np.sin(np.arange(24) * np.pi / 6) * 10
    df = pd.DataFrame({"Date": dates, "Revenue": revenue})
    return df

# --- Tests for predictive_analysis.py ---

@pytest.mark.asyncio
async def test_perform_prediction_integration(mock_timeseries_file, mock_timeseries_df):
    """
    Integration test for the main function.
    Mocks the file loading but runs the internal forecasting logic.
    """
    
    # 1. Patch the load_dataframe function *within the predictive_analysis module*
    # This mock assumes main.py passes the file to perform_prediction, which then calls
    # a loader. We must patch the loader *where it is called*.
    # Based on your main.py, load_dataframe is NOT in predictive_analysis.py.
    # Instead, main.py calls predictive_analysis.perform_prediction *after* loading data.
    # But wait, predictive_analysis.py *also* has a load_dataframe function.
    # This is confusing. I will test the functions *inside* predictive_analysis.py.
    
    # Re-reading: main.py does *not* load the data. It passes the payload.
    # predictive_analysis.py *does* load the data. My test must mock this.
    
    # Create a mock for the read_csv/read_excel calls *inside* load_dataframe
    with patch("pandas.read_csv", MagicMock(return_value=mock_timeseries_df)):
        with patch("pandas.read_excel", MagicMock(return_value=mock_timeseries_df)):
            
            # 2. Run the main function
            results = await predictive_analysis.perform_prediction(
                data_payload=mock_timeseries_file,
                is_file_upload=True,
                input_filename="time_series.csv",
                date_column="Date",
                target_column="Revenue",
                forecast_periods=12,
                confidence_level=0.95,
                model_type="auto"
            )
            
            # 3. Assert the final structure
            assert "predictions" in results
            assert "historical_data" in results
            assert "model_performance" in results
            assert "business_context" in results
            assert "insights" in results
            
            assert len(results["predictions"]) == 12
            assert len(results["historical_data"]) == 24
            assert results["model_performance"]["model_used"] == "Linear Regression"
            assert results["business_context"]["trajectory"] == "Strong Growth"
            assert len(results["insights"]) > 0

@pytest.mark.asyncio
async def test_perform_prediction_insufficient_data(mock_timeseries_file):
    """
    Tests that the function raises an HTTPException if data is insufficient.
    """
    # 1. Mock load_dataframe to return a small DataFrame
    small_df = pd.read_csv(io.StringIO(await mock_timeseries_file.read().decode('utf-8'))).head(3)
    
    with patch("pandas.read_csv", MagicMock(return_value=small_df)):
        # 2. Run and expect failure
        with pytest.raises(HTTPException) as exc_info:
            await predictive_analysis.perform_prediction(
                data_payload=mock_timeseries_file,
                is_file_upload=True,
                input_filename="test.csv",
                date_column="Date",
                target_column="Revenue",
                forecast_periods=6,
                confidence_level=0.95,
                model_type="auto"
            )
            
        # 3. Assert error
        assert exc_info.value.status_code == 400
        assert "Insufficient valid data" in exc_info.value.detail

@pytest.mark.parametrize("date_series, expected_first_date", [
    (pd.Series(["2023-01-01", "2023-02-01"]), datetime(2023, 1, 1)),
    (pd.Series(["01/02/2023", "01/03/2023"]), datetime(2023, 1, 2)), # default dayfirst=False
    (pd.Series(["02.01.2023", "03.01.2023"]), datetime(2023, 1, 2)), # default dayfirst=False
    (pd.Series([2023, 2024]), datetime(2023, 1, 1)),
    (pd.Series(["2023-01", "2023-02"]), datetime(2023, 1, 1)),
])
def test_parse_date_column_success(date_series, expected_first_date):
    """Tests various successful date parsing formats."""
    parsed = predictive_analysis.parse_date_column(date_series, "Date")
    assert pd.api.types.is_datetime64_any_dtype(parsed)
    assert parsed.iloc[0] == expected_first_date

def test_parse_date_column_fail():
    """Tests that unparseable dates raise an error."""
    series = pd.Series(["not a date", "definitely not a date"])
    with pytest.raises(ValueError) as exc_info:
        predictive_analysis.parse_date_column(series, "Date")
    assert "Could not parse date column" in str(exc_info.value)

def test_perform_linear_forecast(mock_timeseries_df):
    """Tests the linear forecast logic."""
    results = predictive_analysis.perform_linear_forecast(
        mock_timeseries_df, "Date", "Revenue", 12, 0.95
    )
    assert "predictions" in results
    assert len(results["predictions"]) == 12
    assert "metrics" in results
    assert results["metrics"]["r_squared"] > 0.9 # Should be a very good fit
    assert results["model_name"] == "Linear Regression"

def test_analyze_business_context(mock_timeseries_df):
    """
    Tests the business context generation logic.
    """
    df = mock_timeseries_df.head(6) # 6 months of data
    predictions = [
        {'predicted_value': 140},
        {'predicted_value': 150},
        {'predicted_value': 145}
    ]
    
    context = predictive_analysis.analyze_business_context(df, 'Revenue', predictions, 'Revenue')
    
    assert context["trajectory"] == "Strong Growth"
    assert "Expansion opportunity" in context["business_implication"]
    assert context["risk_level"] == "Low"