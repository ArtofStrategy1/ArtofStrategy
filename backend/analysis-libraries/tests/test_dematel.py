import pytest
import numpy as np
import pandas as pd
from unittest.mock import patch, AsyncMock, MagicMock
from fastapi import HTTPException

# Import the functions to test
from analysis_modules.dematel_analysis import (
    perform_dematel,
    _calculate_dematel_matrix,
    _generate_analysis_data,
    _prepare_chart_data,
    _generate_dematel_diagnostics
)

# --- Fixture for a stable calculation result ---
@pytest.fixture
def stable_calc_results():
    """Provides a fixture for a stable, valid DEMATEL calculation result."""
    factors = ["A", "B", "C"]
    n = len(factors)
    direct_matrix_np = np.array([[0, 2, 1], [3, 0, 1], [0, 1, 0]])
    normalized_matrix = direct_matrix_np / 4.0 # Max row sum is 4
    
    # Mock T = X * (I - X)^-1
    # This is a mock T matrix, not the real calculation, for test stability
    total_relation_matrix = np.array([
        [0.2, 0.7, 0.4],
        [0.9, 0.4, 0.7],
        [0.2, 0.4, 0.2]
    ])
    
    D = total_relation_matrix.sum(axis=1) # [1.3, 2.0, 0.8]
    R = total_relation_matrix.sum(axis=0) # [1.3, 1.5, 1.3]
    Prominence = D + R # [2.6, 3.5, 2.1]
    Relation = D - R   # [0.0, 0.5, -0.5]
    
    results_df = pd.DataFrame({
        'Factor': factors,
        'D (Influence Given)': D,
        'R (Influence Received)': R,
        'Prominence (D+R)': Prominence,
        'Relation (D-R)': Relation
    }).sort_values(by='Prominence (D+R)', ascending=False)
    
    return {
        "direct_matrix": direct_matrix_np,
        "normalized_matrix": normalized_matrix,
        "total_relation_matrix": total_relation_matrix,
        "results_df": results_df,
        "factors": factors
    }

# --- Unit Tests for Helper Functions ---

def test_calculate_dematel_matrix_stable():
    """
    Tests the core math function with a known stable matrix.
    We don't need to mock np.linalg.inv here, we can use a real one.
    """
    factors = ["A", "B", "C"]
    direct_matrix = np.array([[0, 1, 0], [1, 0, 1], [0, 1, 0]])
    
    results = _calculate_dematel_matrix(direct_matrix, factors)
    
    assert "error" not in results
    assert results["results_df"] is not None
    assert results["total_relation_matrix"] is not None
    
    # Check D+R for factor 'B' (should be highest)
    prominence_B = results["results_df"][results["results_df"]["Factor"] == "B"]["Prominence (D+R)"].values[0]
    assert prominence_B > 0
    assert prominence_B == results["results_df"]["Prominence (D+R)"].max()
    
    # Check D-R for 'B' (should be positive - cause)
    relation_B = results["results_df"][results["results_df"]["Factor"] == "B"]["Relation (D-R)"].values[0]
    assert relation_B > 0

def test_calculate_dematel_matrix_unstable():
    """
    Tests the core math function with a known singular (unstable) matrix.
    """
    factors = ["A", "B"]
    # This matrix (I - X) will be singular
    direct_matrix = np.array([[0, 2], [2, 0]]) # Max row sum is 2
    # X = [[0, 1], [1, 0]]
    # I - X = [[1, -1], [-1, 1]] -> Determinant is 1*1 - (-1*-1) = 0
    
    results = _calculate_dematel_matrix(direct_matrix, factors)
    
    assert "error" in results
    assert "singular" in results["error"]

def test_generate_analysis_data(stable_calc_results):
    """
    Tests the data-shaping function.
    """
    analysis_data = _generate_analysis_data(stable_calc_results)
    
    assert "summary_table" in analysis_data
    assert "cause_group" in analysis_data
    assert "effect_group" in analysis_data
    assert "analysis_insights" in analysis_data
    
    # Check summary
    assert len(analysis_data["summary_table"]) == 3
    assert analysis_data["summary_table"][0]["Factor"] == "B" # Highest prominence
    
    # Check cause/effect groups
    assert len(analysis_data["cause_group"]) == 1
    assert analysis_data["cause_group"][0]["Factor"] == "B"
    assert len(analysis_data["effect_group"]) == 2
    assert analysis_data["effect_group"][0]["Factor"] == "C" # Most negative relation
    
    # Check insights
    assert len(analysis_data["analysis_insights"]) == 3
    assert "most central factor" in analysis_data["analysis_insights"][0]["observation"]
    assert "'Cause' factor" in analysis_data["analysis_insights"][1]["observation"]
    assert "'Effect' factor" in analysis_data["analysis_insights"][2]["observation"]

def test_prepare_chart_data(stable_calc_results):
    """
    Tests the chart data preparation.
    """
    chart_data = _prepare_chart_data(stable_calc_results)
    
    assert chart_data["type"] == "scatter"
    assert "Causal Diagram" in chart_data["title"]
    assert len(chart_data["data"]) == 3
    
    # Check coordinates for Factor 'B' (highest prominence, positive relation)
    factor_B_data = next(item for item in chart_data["data"] if item["name"] == "B")
    assert factor_B_data["x"] == 3.5 # Prominence
    assert factor_B_data["y"] == 0.5 # Relation

def test_generate_dematel_diagnostics_good(stable_calc_results):
    """
    Tests the diagnostics generator with good, stable data.
    """
    diagnostics = _generate_dematel_diagnostics(
        stable_calc_results, 
        stable_calc_results["direct_matrix"], 
        stable_calc_results["factors"]
    )
    
    assert "checks" in diagnostics
    assert "statistics" in diagnostics
    
    assert len(diagnostics["checks"]) == 5
    
    # Check that key tests passed
    check_stability = next(c for c in diagnostics["checks"] if c["metric"] == "Model Stability (Max Row Sum)")
    check_scale = next(c for c in diagnostics["checks"] if c["metric"] == "AI Scale Adherence")
    check_causal = next(c for c in diagnostics["checks"] if c["metric"] == "Causal Structure")
    
    assert check_stability["status"] == "pass"
    assert check_scale["status"] == "pass"
    assert check_causal["status"] == "pass"
    
    # Check statistics
    assert diagnostics["statistics"]["ai_max_value"] == "4 (on 0-4 scale)"
    assert float(diagnostics["statistics"]["max_norm_row_sum"]) < 1.0


# --- Test for Main Endpoint Function ---

@pytest.mark.asyncio
async def test_perform_dematel_success():
    """
    Tests the main perform_dematel endpoint function.
    This function is simpler as it's mostly math.
    """
    factors = ["Price", "Quality", "Service"]
    matrix = [
        [0, 3, 2],
        [1, 0, 1],
        [1, 2, 0]
    ]
    
    results = await perform_dematel(factors, matrix)
    
    assert "error" not in results
    assert "analysis_type" in results and results["analysis_type"] == "dematel"
    
    # Check for all top-level keys
    assert "summary_table" in results
    assert "cause_group" in results
    assert "effect_group" in results
    assert "total_relation_matrix" in results
    assert "analysis_insights" in results
    assert "chart_data" in results
    assert "diagnostics" in results
    assert "raw_data" in results
    
    # Check diagnostics
    assert results["diagnostics"]["checks"][0]["status"] == "pass" # AI Scale Adherence
    assert results["diagnostics"]["checks"][1]["status"] == "pass" # Model Stability
    
    # Check results
    assert results["chart_data"]["data"][0]["name"] == "Price"
    assert results["chart_data"]["data"][0]["y"] > 0 # Price (D-R) should be positive
    
    assert results["analysis_insights"][0]["observation"].startswith("Price") # Price has highest D+R
    assert results["analysis_insights"][1]["observation"].startswith("Price") # Price has highest D-R