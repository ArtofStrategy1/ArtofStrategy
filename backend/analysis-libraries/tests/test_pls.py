import pytest
import pandas as pd
import numpy as np
import io
import json
from unittest.mock import MagicMock, AsyncMock, patch
from starlette.datastructures import UploadFile
from fastapi import HTTPException

# Module to test
from analysis_modules import pls_analysis

# --- Fixtures ---

@pytest.fixture
def mock_pls_file():
    """Provides a mock CSV file for PLS."""
    csv_content = (
        "qual1,qual2,qual3,sat1,sat2,sat3,loy1,loy2,loy3\n"
        "7,6,7,8,7,8,9,8,9\n"
        "5,5,6,6,5,6,6,5,6\n"
        "6,7,6,7,6,7,7,6,7\n"
        "4,5,4,5,4,5,4,5,4\n"
        "8,7,8,9,8,9,9,9,9\n"
        "5,6,5,6,6,5,6,6,5\n"
        "7,7,7,8,8,8,8,8,8\n"
        "6,5,6,7,7,6,7,7,6\n"
        "8,8,8,9,9,9,9,9,9\n"
        "5,4,5,4,4,5,5,4,5\n"
    )
    file_like_object = io.BytesIO(csv_content.encode('utf-8'))
    
    mock_file = MagicMock(spec=UploadFile)
    mock_file.filename = "pls_data.csv"
    mock_file.read = AsyncMock(return_value=file_like_object.getvalue())
    return mock_file

@pytest.fixture
def mock_pls_df():
    """Provides a mock DataFrame for internal function testing."""
    return pd.read_csv(io.StringIO(MOCK_PLS_CSV))

@pytest.fixture
def mock_plspm(mocker):
    """Mocks the entire plspm library and its classes."""
    # Mock Config object and its methods
    mock_config_obj = MagicMock()
    mock_config_obj.add_lv = MagicMock()
    mocker.patch('analysis_modules.pls_analysis.plspm.config.Config', return_value=mock_config_obj)

    # Mock Structure object
    mock_structure_obj = MagicMock()
    mock_structure_obj.add_path = MagicMock()
    mock_structure_obj.path.return_value = {} # Return empty path dict
    mocker.patch('analysis_modules.pls_analysis.plspm.config.Structure', return_value=mock_structure_obj)
    
    # Mock MV object
    mocker.patch('analysis_modules.pls_analysis.plspm.config.MV', MagicMock())
    
    # Mock Plspm class and its methods
    mock_plspm_obj = MagicMock()
    mock_plspm_obj.bootstrap.return_value = MagicMock() # Return a mock bootstrap result
    
    # Mock methods that return DataFrames
    mock_plspm_obj.inner_summary.return_value = pd.DataFrame(
        {'type': ['Exogenous', 'Endogenous', 'Endogenous'],
         'r_squared': [0.0, 0.65, 0.72], 
         'ave': [0.8, 0.7, 0.9]}, 
        index=['Quality', 'Satisfaction', 'Loyalty']
    )
    mock_plspm_obj.unidimensionality.return_value = pd.DataFrame(
        {'cronbach_alpha': [0.85, 0.88, 0.90], 'dillon_goldstein_rho': [0.9, 0.92, 0.95]},
        index=['Quality', 'Satisfaction', 'Loyalty']
    )
    mock_plspm_obj.outer_model.return_value = pd.DataFrame(
        {
            'Quality': [0.9, 0.8, 0.85, 0, 0, 0, 0, 0, 0],
            'Satisfaction': [0, 0, 0, 0.8, 0.9, 0.85, 0, 0, 0],
            'Loyalty': [0, 0, 0, 0, 0, 0, 0.9, 0.95, 0.92]
        },
        index=['qual1_clean', 'qual2_clean', 'qual3_clean', 'sat1_clean', 'sat2_clean', 'sat3_clean', 'loy1_clean', 'loy2_clean', 'loy3_clean']
    )
    
    # Mock bootstrap paths
    mock_bootstrap_paths = pd.DataFrame(
        {'original': [0.806, 0.850], 't stat.': [10.0, 12.0], 'p-value': [0.000, 0.000], 'significant': [True, True]},
        index=pd.MultiIndex.from_tuples([('Quality', 'Satisfaction'), ('Satisfaction', 'Loyalty')])
    )
    mock_plspm_obj.bootstrap.return_value.paths.return_value = mock_bootstrap_paths
    
    mocker.patch('analysis_modules.pls_analysis.Plspm', return_value=mock_plspm_obj)
    return mock_plspm_obj

# --- Tests for pls_analysis.py ---

def test_clean_column_names():
    """Tests the column name cleaning utility."""
    df = pd.DataFrame(columns=["Test Col 1", "Test Col 2 (Special)", "3rd Col"])
    df_clean, mapping, rev_mapping = pls_analysis.clean_column_names(df)
    assert list(df_clean.columns) == ["Test_Col_1", "Test_Col_2_Special", "_3rd_Col"]
    assert mapping["Test_Col_1"] == "Test Col 1"
    assert rev_mapping["Test Col 1"] == "Test_Col_1"

def test_parse_lavaan_syntax():
    """Tests the syntax parser."""
    meas = "Quality =~ qual1 + qual2\nSatisfaction =~ sat1 + sat2"
    struc = "Satisfaction ~ Quality"
    rev_mapping = {
        "qual1": "qual1_clean", "qual2": "qual2_clean",
        "sat1": "sat1_clean", "sat2": "sat2_clean"
    }
    
    config, blocks, structure_paths = pls_analysis.parse_lavaan_syntax(meas, struc, rev_mapping)
    
    assert "Quality" in blocks
    assert blocks["Quality"] == ["qual1_clean", "qual2_clean"]
    assert ("Quality", "Satisfaction") in structure_paths

@pytest.mark.asyncio
async def test_perform_pls_sem_success(mocker, mock_plspm, mock_pls_file, mock_pls_df):
    """
    Tests the main perform_pls_sem function on a successful run.
    Mocks all external plspm, httpx, and graphviz calls.
    """
    
    # 1. Mock file loading
    mocker.patch('analysis_modules.pls_analysis.read_data', AsyncMock(return_value=mock_pls_df.copy()))
    
    # 2. Mock AI Insights (httpx)
    mock_ai_insights_response = {
        "model_evaluation": {"interpretation": "Mock AI interpretation for R²."},
        "path_coefficients": [
            {"path": "Quality -> Satisfaction", "interpretation": "Mock AI path interp 1"},
            {"path": "Satisfaction -> Loyalty", "interpretation": "Mock AI path interp 2"}
        ],
        "reliability_validity": [
            {"construct": "Quality", "assessment": "Mock AI assessment for Quality"},
            {"construct": "Satisfaction", "assessment": "Mock AI assessment for Satisfaction"},
            {"construct": "Loyalty", "assessment": "Mock AI assessment for Loyalty"}
        ],
        "business_recommendations": [
            {"priority": "High", "recommendation": "Mock recommendation 1", "insight_link": "Test", "action_items": [], "kpis_to_track": [], "timeline": "Test", "resources": "Test"}
        ]
    }
    # We patch the *internal* helper function
    mocker.patch('analysis_modules.pls_analysis.generate_ai_insights', AsyncMock(return_value=mock_ai_insights_response))
    
    # 3. Mock Path Diagram (graphviz)
    mock_diagram_html = "<div>Mock Diagram HTML</div>"
    mocker.patch('analysis_modules.pls_analysis.generate_path_diagram', return_value=(mock_diagram_html, True))
    
    mock_data_file = MagicMock(spec=UploadFile)
    mock_data_file.filename = "test.csv"
    
    # 4. Define Syntax
    measurement_syntax = """
        Quality =~ qual1 + qual2 + qual3
        Satisfaction =~ sat1 + sat2 + sat3
        Loyalty =~ loy1 + loy2 + loy3
    """
    structural_syntax = """
        Satisfaction ~ Quality
        Loyalty ~ Satisfaction
    """
    
    # 5. Run the function
    results = await perform_pls_sem(
        data_payload=mock_data_file,
        is_file_upload=True,
        input_filename="test.csv",
        measurement_syntax=measurement_syntax,
        structural_syntax=structural_syntax
    )
    
    # 6. Assert results
    assert results is not None
    assert results["diagram_available"] is True
    assert results["path_diagram"] == mock_diagram_html
    
    # Check data summary
    assert results["data_summary"]["total_rows"] == 10
    assert results["data_summary"]["analysis_rows"] == 10
    
    # Check reliability
    assert len(results["reliability_validity"]) == 3
    assert results["reliability_validity"][0]["construct"] == "Quality"
    assert results["reliability_validity"][0]["cronbachs_alpha"] == 0.85
    assert results["reliability_validity"][0]["ave"] == 0.8
    assert "Mock AI assessment for Quality" in results["reliability_validity"][0]["assessment"]
    
    # Check paths
    assert len(results["path_coefficients"]) == 2
    assert results["path_coefficients"][0]["path"] == "Quality -> Satisfaction"
    assert results["path_coefficients"][0]["coefficient"] == 0.806
    assert results["path_coefficients"][0]["p_value"] == 0.000
    assert results["path_coefficients"][0]["significant"] is True
    assert "Mock AI path interp 1" in results["path_coefficients"][0]["interpretation"]
    
    # Check R-squared
    assert len(results["model_evaluation"]["r_squared_values"]) == 3
    assert results["model_evaluation"]["r_squared_values"][1]["variable"] == "Satisfaction"
    assert results["model_evaluation"]["r_squared_values"][1]["r_squared"] == 0.65
    assert "Mock AI interpretation" in results["model_evaluation"]["interpretation"]
    
    # Check Discriminant Validity (HTMT and Fornell-Larcker)
    assert "discriminant_validity_htmt" in results
    assert "discriminant_validity_fornell_larcker" in results
    assert len(results["discriminant_validity_htmt"]["headers"]) == 3
    assert len(results["discriminant_validity_fornell_larcker"]["rows"]) == 3
    
    # Check recommendations
    assert len(results["business_recommendations"]) == 1
    assert results["business_recommendations"][0]["recommendation"] == "Mock recommendation 1"
    
    # Check outer loadings (new v4 feature)
    assert "outer_loadings_json" in results
    assert results["outer_loadings_json"]["headers"] == ["Quality", "Satisfaction", "Loyalty"]
    assert results["outer_loadings_json"]["rows"][0]["indicator"] == "qual1"
    assert results["outer_loadings_json"]["rows"][0]["Quality"] == 0.9

@pytest.mark.asyncio
async def test_perform_pls_sem_data_cleaning(mocker):
    """
    Tests that the data cleaning pipeline correctly processes and validates data.
    """
    # 1. Create mock data with issues
    mock_csv_content = (
        "qual1,qual2,sat1,sat2,loy1,loy2,extra_col\n"
        "7,6,7,7,9,8,text\n"
        "5,5,6,5,6,5,text\n"
        "6,7,6,6,7,6,text\n"
        "4,5,4,4,4,5,text\n"
        "8,7,8,8,9,9,text\n"
        "5,6,6,5,6,6,text\n"
        "7,7,7,8,8,8,text\n"
        "6,5,7,7,7,7,text\n"
        "8,8,9,9,9,9,text\n"
        "5,4,4,4,5,4,text\n"
        "NA,5,5,5,5,5,text\n" # This row should be dropped
        "5,5,text,5,5,5,text\n" # This should be coerced to NaN and dropped
    )
    mock_df_dirty = pd.read_csv(io.StringIO(mock_csv_content))
    
    # 2. Mock file loading
    mocker.patch('analysis_modules.pls_analysis.read_data', AsyncMock(return_value=mock_df_dirty.copy()))
    
    # 3. Mocks for plspm, AI, and diagram (same as success test)
    mocker.patch('analysis_modules.pls_analysis.generate_ai_insights', AsyncMock(return_value={
        "model_evaluation": {}, "path_coefficients": [], "reliability_validity": [], "business_recommendations": []
    }))
    mocker.patch('analysis_modules.pls_analysis.generate_path_diagram', return_value=("<div>Mock</div>", True))
    mock_plspm(mocker) # Use the fixture
    
    mock_data_file = MagicMock(spec=UploadFile)
    mock_data_file.filename = "test.csv"
    
    # 4. Define Syntax (omitting 'extra_col')
    measurement_syntax = """
        Quality =~ qual1 + qual2
        Satisfaction =~ sat1 + sat2
        Loyalty =~ loy1 + loy2
    """
    structural_syntax = "Satisfaction ~ Quality\nLoyalty ~ Satisfaction"
    
    # 5. Run the function
    results = await perform_pls_sem(
        data_payload=mock_data_file,
        is_file_upload=True,
        input_filename="test.csv",
        measurement_syntax=measurement_syntax,
        structural_syntax=structural_syntax
    )
    
    # 6. Assert cleaning results
    assert results is not None
    assert "error" not in results
    assert results["data_summary"]["total_rows"] == 12
    assert results["data_summary"]["analysis_rows"] == 10 # 2 rows dropped
    assert "Removed 2 rows with missing values" in [s for s in results["data_summary"]["cleaning_log"]["steps"]]