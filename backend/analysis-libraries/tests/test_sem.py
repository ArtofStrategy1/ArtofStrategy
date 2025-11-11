import pytest
import pandas as pd
import numpy as np
import io
import semopy
from unittest.mock import MagicMock, AsyncMock, patch
from starlette.datastructures import UploadFile
from fastapi import HTTPException
import sys, os

# Add the folder that contains "analysis-libraries-app"
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'analysis-libraries-app')))

# Module to test
from analysis_modules import sem_analysis

# --- Fixtures ---

@pytest.fixture
def mock_sem_file():
    """Provides a mock CSV file for SEM."""
    csv_content = (
        "x1,x2,x3,y1,y2,y3\n"
        "7,6,7,5,6,7\n"
        "5,4,5,4,5,4\n"
        "6,5,6,5,6,5\n"
        "8,7,8,6,7,6\n"
        "4,3,4,3,4,3\n"
        "7,6,7,5,6,7\n"
        "5,4,5,4,5,4\n"
        "6,5,6,5,6,5\n"
        "8,7,8,6,7,6\n"
        "4,3,4,3,4,3\n"
        "7,6,7,5,6,7\n"
        "5,4,5,4,5,4\n"
        "6,5,6,5,6,5\n"
        "8,7,8,6,7,6\n"
        "4,3,4,3,4,3\n"
    )
    file_like_object = io.BytesIO(csv_content.encode('utf-8'))
    
    mock_file = MagicMock(spec=UploadFile)
    mock_file.filename = "sem_data.csv"
    mock_file.read = AsyncMock(return_value=file_like_object.getvalue())
    return mock_file

@pytest.fixture
def mock_semopy_model():
    """Mocks the semopy.Model object and its methods."""
    mock_model = MagicMock(spec=semopy.Model)
    mock_model.vars = {'observed': {'x1', 'x2', 'x3', 'y1', 'y2', 'y3'}, 'latent': {'F1', 'F2'}}
    mock_model.param_vals = [1] * 10 # Mock 10 parameters
    
    # Mock the fit result
    mock_fit_result = MagicMock()
    mock_fit_result.success = True
    mock_fit_result.message = "Optimization terminated successfully."
    mock_model.fit.return_value = mock_fit_result
    
    return mock_model

@pytest.fixture
def mock_semopy_inspect():
    """Mocks the semopy.inspect function return value (a DataFrame)."""
    estimates_data = {
        'lval': ['F1', 'F1', 'F1', 'F2', 'F2', 'F2', 'F2'],
        'op': ['=~', '=~', '=~', '=~', '=~', '=~', '~'],
        'rval': ['x1', 'x2', 'x3', 'y1', 'y2', 'y3', 'F1'],
        'Estimate': ['0.9', '0.85', '0.92', '0.88', '0.91', '0.86', '0.5'],
        'Std. Err': ['0.1', '0.1', '0.1', '0.1', '0.1', '0.1', '0.1'],
        'z-value': ['9.0', '8.5', '9.2', '8.8', '9.1', '8.6', '5.0'],
        'p-value': ['0.000', '0.000', '0.000', '0.000', '0.000', '0.000', '0.000']
    }
    return pd.DataFrame(estimates_data)

@pytest.fixture
def mock_semopy_calc_stats():
    """Mocks the semopy.calc_stats function return value (a DataFrame)."""
    stats_data = {
        'chi2': [1.23], 'chi2 p-value': [0.54], 'RMSEA': [0.01],
        'CFI': [0.99], 'TLI': [0.99], 'SRMR': [0.02]
    }
    return pd.DataFrame(stats_data)

@pytest.fixture
def mock_semopy_semplot():
    """Mocks the semopy.semplot function to return a mock plot object."""
    mock_plot = MagicMock()
    mock_plot.source = 'digraph G { F1 -> F2 [label="0.500\\np-val: 0.00"]; }'
    
    # Mock the graph_attr, node_attr, edge_attr as dictionaries
    mock_plot.graph_attr = {}
    mock_plot.node_attr = {}
    mock_plot.edge_attr = {}
    
    # Mock the body as a list
    mock_plot.body = ['F1 [shape="ellipse"]', 'F2 [shape="ellipse"]']
    
    # Mock the edge method
    mock_plot.edge = MagicMock()
    
    return mock_plot

# --- Tests for sem_analysis.py ---

@pytest.mark.asyncio
async def test_perform_sem_integration(
    mock_sem_file, 
    mock_semopy_model, 
    mock_semopy_inspect, 
    mock_semopy_calc_stats,
    mock_semopy_semplot
):
    """
    Integration test for the main perform_sem function.
    Mocks all external semopy calls and the internal load_dataframe.
    """
    
    # 1. Patch file loading *inside the sem_analysis module*
    # This assumes sem_analysis.py has its own `load_dataframe` function.
    with patch("analysis_modules.sem_analysis.load_dataframe", new_callable=AsyncMock) as mock_load_df:
        # Create a real DataFrame to be returned
        mock_df = pd.read_csv(io.StringIO(await mock_sem_file.read().decode('utf-8')))
        mock_load_df.return_value = mock_df
        
        # 2. Patch semopy.Model
        with patch("semopy.Model", MagicMock(return_value=mock_semopy_model)):
            
            # 3. Patch semopy.inspect
            with patch("semopy.inspect", MagicMock(return_value=mock_semopy_inspect)):
                
                # 4. Patch semopy.calc_stats
                with patch("semopy.calc_stats", MagicMock(return_value=mock_semopy_calc_stats)):
                    
                    # 5. Patch semopy.semplot
                    with patch("semopy.semplot", MagicMock(return_value=mock_semopy_semplot)):
                        
                        # 6. Run the main function
                        measurement_syntax = "F1 =~ x1 + x2 + x3\nF2 =~ y1 + y2 + y3"
                        structural_syntax = "F2 ~ F1"
                        
                        results = await sem_analysis.perform_sem(
                            data_payload=mock_sem_file,
                            is_file_upload=True,
                            input_filename="sem_data.csv",
                            measurement_syntax=measurement_syntax,
                            structural_syntax=structural_syntax
                        )
                        
                        # 7. Assert the final structure
                        assert "message" in results
                        assert "estimates_csv_content" in results
                        assert "fit_indices_csv_content" in results
                        assert "path_diagram_dot" in results
                        assert "model_variables" in results
                        
                        # Check content
                        assert "SEM analysis completed successfully" in results["message"]
                        assert "F2,~,F1,0.5" in results["estimates_csv_content"]
                        assert "chi2,chi2 p-value,RMSEA" in results["fit_indices_csv_content"]
                        assert "0.17,0.05" in results["fit_indices_csv_content"] # CFI
                        assert 'digraph G' in results["path_diagram_dot"]
                        assert "F1" in results["model_variables"]["latent"]
                        assert "x1" in results["model_variables"]["observed"]

@pytest.mark.asyncio
async def test_perform_sem_non_numeric_data(mocker, mock_sem_file):
    """
    Tests that non-numeric data raises a 400 error *before* fitting.
    """
    # 1. Mock file loading
    mocker.patch(
        'analysis_modules.sem_analysis.load_dataframe',
        AsyncMock(return_value=MOCK_DF.copy().astype(str)) # Force all to string
    )
    
    # 2. Mock semopy.Model (it will get called)
    mock_model_obj = MagicMock()
    mock_model_obj.vars = {'observed': ['x1', 'x2', 'x3', 'y1', 'y2', 'y3'], 'latent': ['F1', 'F2']}
    mocker.patch('analysis_modules.sem_analysis.semopy.Model', return_value=mock_model_obj)
    
    # 3. Run and expect failure
    with pytest.raises(HTTPException) as exc_info:
        await sem_analysis.perform_sem(
            data_payload=mock_sem_file,
            is_file_upload=True,
            input_filename="test.csv",
            measurement_syntax="F1 =~ x1 + x2 + x3",
            structural_syntax=""
        )
        
    # 4. Assert error
    assert exc_info.value.status_code == 400
    assert "Non-numeric data found" in exc_info.value.detail
    assert "x1" in exc_info.value.detail