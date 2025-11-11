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
from analysis_modules import regression_analysis

# --- Fixtures ---

@pytest.fixture
def mock_regression_file():
    """Provides a mock CSV file for regression."""
    csv_content = (
        "Sales,Marketing,Website_Traffic,Region\n"
        "5000,500,10000,North\n"
        "6000,600,12000,South\n"
        "5500,550,11000,North\n"
        "7000,700,13000,West\n"
        "6500,650,12500,South\n"
        "5200,520,10500,North\n"
        "6300,630,12200,South\n"
        "5800,580,11500,North\n"
        "7500,750,13500,West\n"
        "6800,680,12800,South\n"
        "5300,530,10800,North\n"
        "6600,660,12400,South\n"
        "5900,590,11800,North\n"
        "7800,780,13800,West\n"
        "7100,710,13100,South\n"
    )
    file_like_object = io.BytesIO(csv_content.encode('utf-8'))
    
    mock_file = MagicMock(spec=UploadFile)
    mock_file.filename = "regression_data.csv"
    mock_file.read = AsyncMock(return_value=file_like_object.getvalue())
    return mock_file

@pytest.fixture
def mock_statsmodels_result():
    """Mocks the fitted OLS result object from statsmodels."""
    mock_result = MagicMock()
    mock_result.rsquared = 0.95
    mock_result.rsquared_adj = 0.94
    mock_result.fvalue = 150.0
    mock_result.f_pvalue = 0.0001
    mock_result.nobs = 15.0
    mock_result.llf = -100.0
    mock_result.aic = 208.0
    mock_result.bic = 212.0
    mock_result.resid = np.random.randn(15)
    mock_result.predict.return_value = np.random.rand(15) * 1000 + 5000
    
    # Mock params (coefficients)
    mock_result.params = pd.Series(
        [100.0, 5.0, 0.1, 50.0, 100.0], 
        index=['const', 'Marketing', 'Website_Traffic', 'Region_South', 'Region_West']
    )
    # Mock bse (std errors)
    mock_result.bse = pd.Series(
        [10.0, 0.5, 0.01, 20.0, 25.0],
        index=['const', 'Marketing', 'Website_Traffic', 'Region_South', 'Region_West']
    )
    # Mock tvalues
    mock_result.tvalues = pd.Series(
        [10.0, 10.0, 10.0, 2.5, 4.0],
        index=['const', 'Marketing', 'Website_Traffic', 'Region_South', 'Region_West']
    )
    # Mock pvalues
    mock_result.pvalues = pd.Series(
        [0.000, 0.000, 0.000, 0.025, 0.001],
        index=['const', 'Marketing', 'Website_Traffic', 'Region_South', 'Region_West']
    )
    # Mock confidence intervals
    mock_result.conf_int.return_value = pd.DataFrame(
        [[80.0, 120.0], [4.0, 6.0], [0.08, 0.12], [5.0, 95.0], [40.0, 160.0]],
        index=['const', 'Marketing', 'Website_Traffic', 'Region_South', 'Region_West'],
        columns=[0, 1]
    )
    
    # Mock model attributes for diagnostics
    mock_result.model = MagicMock()
    mock_result.model.exog = np.random.rand(15, 5) # Mock exog for Breusch-Pagan
    
    return mock_result

# --- Tests for regression_analysis.py ---

@pytest.mark.asyncio
async def test_perform_regression_analysis_integration(mock_regression_file, mock_statsmodels_result):
    """
    Integration test for the main regression function.
    Mocks file loading and the core statsmodels functions.
    """
    
    feature_cols = ["Marketing", "Website_Traffic", "Region"]
    target_col = "Sales"
    
    # 1. Patch file loading
    with patch("analysis_modules.regression_analysis.load_dataframe", new_callable=AsyncMock) as mock_load_df:
        # Create a real DataFrame to be returned by the mock
        file_bytes = await mock_regression_file.read()
        mock_df = pd.read_csv(io.StringIO(file_bytes.decode('utf-8')))

        mock_load_df.return_value = mock_df
        
        # 2. Patch context loading
        with patch("analysis_modules.regression_analysis._load_context", AsyncMock(return_value="Test context")):
            
            # 3. Patch statsmodels
            with patch("statsmodels.api.OLS") as mock_OLS:
                # Mock the OLS().fit() chain
                mock_OLS.return_value.fit.return_value = mock_statsmodels_result
                
                # 4. Patch diagnostic functions
                with patch("statsmodels.stats.stattools.durbin_watson", MagicMock(return_value=1.95)):
                    with patch("statsmodels.stats.diagnostic.het_breuschpagan", MagicMock(return_value=(0.1, 0.55, 0.2, 0.6))):
                        with patch("scipy.stats.jarque_bera", MagicMock(return_value=(1.5, 0.45))):
                            
                            # 5. Patch sklearn models
                            with patch("analysis_modules.regression_analysis.train_basic_models") as mock_train_basic:
                                mock_train_basic.return_value = {
                                    "random_forest": {"test_r2": 0.92, "test_rmse": 150.0},
                                    "ridge": {"test_r2": 0.94, "test_rmse": 130.0}
                                }
                                
                                # 6. Run the main function
                                results = await regression_analysis.perform_regression_analysis(
                                    data_payload=mock_regression_file,
                                    is_file_upload=True,
                                    input_filename="regression_data.csv",
                                    target_column=target_col,
                                    feature_columns=feature_cols,
                                    model_types=['random_forest', 'ridge'],
                                    test_size=0.2,
                                    context_file=None
                                )
                                
                                # 7. Assert the final structure
                                assert "statsmodels_results" in results
                                assert "sklearn_comparison" in results
                                assert "statistical_analysis" in results
                                assert "dataset_info" in results
                                
                                # Check statsmodels results
                                res_sm = results["statsmodels_results"]
                                assert res_sm["model_summary"]["r_squared"] == 0.95
                                assert len(res_sm["coefficients"]) == 5 # const + 2 num + 2 dummies (from 3 cats)
                                assert res_sm["coefficients"][1]["variable"] == "Marketing"
                                assert res_sm["coefficients"][1]["p_value"] == 0.000
                                assert res_sm["diagnostics"]["durbin_watson"]["statistic"] == 1.95
                                assert "Good" in res_sm["diagnostics"]["breusch_pagan_pvalue"]["interpretation"]
                                
                                # Check sklearn comparison
                                res_sk = results["sklearn_comparison"]
                                assert res_sk["random_forest"]["test_r2"] == 0.92
                                
                                # Check stats
                                res_stats = results["statistical_analysis"]
                                assert "correlations" in res_stats
                                assert "Marketing" in res_stats["correlations"]

@pytest.mark.asyncio
async def test_regression_analysis_insufficient_data(mock_regression_file):
    """
    Tests that regression fails if data is insufficient after cleaning.
    """
    # 1. Mock load_dataframe to return a small DataFrame
    file_bytes = await mock_regression_file.read()
    mock_df = pd.read_csv(io.StringIO(file_bytes.decode('utf-8')))

    
    with patch("analysis_modules.regression_analysis.load_dataframe", AsyncMock(return_value=mock_df)):
        
        # 2. Run and expect failure
        with pytest.raises(ValueError) as exc_info:
            await regression_analysis.perform_regression_analysis(
                data_payload=mock_regression_file,
                is_file_upload=True,
                input_filename="test.csv",
                target_column="Sales",
                feature_columns=["Marketing"],
                model_types=["linear"],
                test_size=0.2,
                context_file=None
            )
            
        # 3. Assert error
        assert "Insufficient data" in str(exc_info.value)