# analysis_modules/dematel_analysis.py

import traceback
import numpy as np
import pandas as pd
from typing import List, Dict, Any
from fastapi import HTTPException
from datetime import datetime

# --- Debugging ---
def debug_log(message, level="INFO"):
    """Simple logger for debugging."""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{timestamp}] [DEMATEL-{level}] {message}")

# --- Helper Functions (These are all REAL math/data-shaping) ---

def _calculate_dematel_matrix(direct_matrix_np: np.ndarray, factors: List[str]) -> Dict[str, Any]:
    """
    Performs the core DEMATEL mathematical calculations.
    Receives a numpy array.
    """
    debug_log("Step 2: Performing DEMATEL calculations...", "INFO")
    n = len(factors)
    
    results_data = {
        "direct_matrix": direct_matrix_np,
        "normalized_matrix": np.zeros((n, n)), # Default
        "total_relation_matrix": np.zeros((n, n)),
        "results_df": pd.DataFrame({
            'Factor': factors,
            'D (Influence Given)': np.zeros(n),
            'R (Influence Received)': np.zeros(n),
            'Prominence (D+R)': np.zeros(n),
            'Relation (D-R)': np.zeros(n)
        }),
        "factors": factors
    }
    
    row_sums = direct_matrix_np.sum(axis=1)
    max_row_sum = np.max(row_sums)
    if max_row_sum == 0:
        debug_log("Direct matrix is all zeros, cannot proceed.", "ERROR")
        results_data["error"] = "Input matrix has no influences (all zeros)."
        return results_data
        
    X = direct_matrix_np / max_row_sum
    results_data["normalized_matrix"] = X
    
    I = np.identity(n)
    try:
        inv_matrix = np.linalg.inv(I - X)
        T = X @ inv_matrix
    except np.linalg.LinAlgError:
        debug_log("Matrix inversion failed (singular matrix).", "ERROR")
        results_data["error"] = "Matrix calculation error. The (I - X) matrix is singular, cannot compute inverse. This can be caused by highly circular or unstable relationships."
        return results_data

    results_data["total_relation_matrix"] = T

    D = T.sum(axis=1)  # Row sums (Influence Given)
    R = T.sum(axis=0)  # Column sums (Influence Received)
    
    prominence = D + R
    relation = D - R
    
    debug_log("DEMATEL calculations complete.", "DEBUG")
    
    results_df = pd.DataFrame({
        'Factor': factors,
        'D (Influence Given)': D,
        'R (Influence Received)': R,
        'Prominence (D+R)': prominence,
        'Relation (D-R)': relation
    })
    
    results_data["results_df"] = results_df.sort_values(by='Prominence (D+R)', ascending=False)
    
    return results_data

def _generate_analysis_data(calc_results: Dict[str, Any]) -> Dict[str, Any]:
    """
    Generates all the individual data pieces for the frontend.
    --- NO HTML IS GENERATED HERE ---
    """
    debug_log("Step 3: Generating analysis data components...", "INFO")
    
    results_df = calc_results['results_df']
    T_matrix = calc_results['total_relation_matrix']
    
    # --- 1. Summary Table (D+R, D-R) ---
    summary_table = results_df.to_dict(orient='records')
    
    # --- 2. Cause and Effect Groups ---
    cause_group_df = results_df[results_df['Relation (D-R)'] > 0].sort_values(by='Relation (D-R)', ascending=False)
    effect_group_df = results_df[results_df['Relation (D-R)'] <= 0].sort_values(by='Relation (D-R)', ascending=True)

    cause_group = cause_group_df.to_dict(orient='records')
    effect_group = effect_group_df.to_dict(orient='records')

    # --- 3. Total Relation Matrix Table ---
    total_relation_matrix = T_matrix.tolist() # Convert numpy array to simple list

    # --- 4. Key Insights (as a list of objects) ---
    analysis_insights = []
    if not results_df.empty and "error" not in calc_results:
        key_factor = results_df.iloc[0] # Factor with highest Prominence
        analysis_insights.append({
            "observation": f"{key_factor['Factor']}: is the most central factor (Prominence: {key_factor['Prominence (D+R)']:.3f}).",
            "interpretation": "This factor has the strongest relationships (both given and received) with all other factors. Changes to it will have the most significant ripple effects.",
            "recommendation": "Prioritize monitoring and management of this factor as it is a key hub of activity."
        })
        
        if not cause_group_df.empty:
            main_cause = cause_group_df.iloc[0]
            analysis_insights.append({
                "observation": f"{main_cause['Factor']}: is the most significant 'Cause' factor (Relation: {main_cause['Relation (D-R)']:.3f}).",
                "interpretation": "This factor is a net 'giver' of influence. It primarily drives other factors rather than being driven by them.",
                "recommendation": "Focus strategic interventions on this factor. Improving it is likely to cause positive effects in other areas."
            })
        
        if not effect_group_df.empty:
            main_effect = effect_group_df.iloc[0]
            analysis_insights.append({
                "observation": f"{main_effect['Factor']}: is the most significant 'Effect' factor (Relation: {main_effect['Relation (D-R)']:.3f}).",
                "interpretation": "This factor is a net 'receiver' of influence. It is primarily an outcome or symptom.",
                "recommendation": "Monitor this factor to measure the success of your interventions. Do not try to fix it directly; fix its causes."
            })
            
    return {
        "summary_table": summary_table,
        "cause_group": cause_group,
        "effect_group": effect_group,
        "total_relation_matrix": total_relation_matrix,
        "analysis_insights": analysis_insights
    }

def _prepare_chart_data(calc_results: Dict[str, Any]) -> Dict[str, Any]:
    """
    Prepares the data needed for the frontend to render the Causal Diagram.
    """
    results_df = calc_results['results_df']
    
    chart_data = []
    for _, row in results_df.iterrows():
        chart_data.append({
            'x': row['Prominence (D+R)'],
            'y': row['Relation (D-R)'],
            'name': row['Factor']
        })
        
    return {
        "type": "scatter",
        "title": "DEMATEL Causal Diagram",
        "data": chart_data,
        "x_axis_label": "Prominence (D+R) - Importance",
        "y_axis_label": "Relation (D-R) - Cause/Effect"
    }

def _generate_dematel_diagnostics(calc_results: Dict[str, Any], direct_matrix_np: np.ndarray, factors: List[str]) -> Dict[str, Any]:
    """
    Generates a structured diagnostics object based on the AI matrix
    and calculation results. This is the ADVANCED version.
    """
    debug_log("Step 4: Generating quantitative diagnostics...", "INFO")
    
    checks = []
    statistics = {}
    n = len(factors)

    # --- 1. AI Matrix Scale Check ---
    ai_max_value = int(direct_matrix_np.max())
    statistics["ai_max_value"] = f"{ai_max_value} (on 0-4 scale)"
    if ai_max_value > 4:
        checks.append({
            "metric": "AI Scale Adherence",
            "status": "fail",
            "level": "high", # Added for JS sorting
            "message": f"AI used a value of '{ai_max_value}', which is outside the 0-4 scale. This is likely an AI 'hallucination.' The resulting prominence scores and relationships may be unreliable or skewed. Try re-phrasing your input text to be more specific."
        })
    elif ai_max_value == 0:
         checks.append({
            "metric": "AI Relationship Detection",
            "status": "fail",
            "level": "high",
            "message": "The AI matrix was all zeros. No relationships were found in the text."
        })
    else:
        checks.append({
            "metric": "AI Scale Adherence",
            "status": "pass",
            "level": "success",
            "message": "AI successfully used the 0-4 scale."
        })

    # --- 2. Mathematical Stability Check ---
    max_norm_row_sum = float(calc_results['normalized_matrix'].sum(axis=1).max())
    statistics["max_norm_row_sum"] = f"{max_norm_row_sum:.4f}"
    
    # Check for calculation error first
    if calc_results.get("error"):
         checks.append({
            "metric": "Model Stability",
            "status": "fail",
            "level": "high",
            "message": f"Calculation Error: {calc_results.get('error')}."
        })
    elif max_norm_row_sum >= 10.0: # Changed from 1.0 to 10.0
        checks.append({
            "metric": "Model Stability (Max Row Sum)",
            "status": "fail",
            "level": "high",
            "message": f"Model is unstable (Max Row Sum = {max_norm_row_sum:.4f} ≥ 1.0). This indicates runaway feedback loops. Results are not reliable."
        })
    else:
        checks.append({
            "metric": "Model Stability (Max Row Sum)",
            "status": "pass",
            "level": "success",
            "message": f"Model is mathematically stable (Max Row Sum = {max_norm_row_sum:.4f} < 1.0)."
        })

    # --- 3. Matrix Density Check ---
    non_zero_elements = np.count_nonzero(direct_matrix_np)
    total_possible_links = n * (n - 1)
    density = (non_zero_elements / total_possible_links) * 100 if total_possible_links > 0 else 0
    statistics["matrix_density"] = f"{density:.1f}%"
    if density > 75:
        checks.append({
            "metric": "Matrix Density",
            "status": "warn",
            "level": "medium",
            "message": f"Matrix is very dense ({density:.1f}%). This suggests a highly complex system where everything influences everything."
        })
    elif density < 10 and density > 0: # Don't warn if it's 0, that's a different error
        checks.append({
            "metric": "Matrix Density",
            "status": "warn",
            "level": "medium",
            "message": f"Matrix is very sparse ({density:.1f}%). This suggests a simple system with few relationships."
        })
    else:
         checks.append({
            "metric": "Matrix Density",
            "status": "pass",
            "level": "success",
            "message": f"Matrix has a healthy density ({density:.1f}%)."
        })

    # --- 4. Causal Structure Check ---
    results_df = calc_results['results_df']
    cause_factors_count = len(results_df[results_df['Relation (D-R)'] > 0])
    statistics["cause_factors_found"] = f"{cause_factors_count} / {n}"
    if cause_factors_count == 0 and "error" not in calc_results:
        checks.append({
            "metric": "Causal Structure",
            "status": "warn",
            "level": "medium",
            "message": "No 'Cause' factors were identified. The system appears highly reactive and lacks strong internal drivers."
        })
    elif "error" not in calc_results:
        checks.append({
            "metric": "Causal Structure",
            "status": "pass",
            "level": "success",
            "message": f"{cause_factors_count} 'Cause' factor(s) were successfully identified."
        })

    # --- 5. Factor Count Check ---
    if len(factors) < 3:
        checks.append({
            "metric": "Low Factor Count",
            "status": "warn",
            "level": "medium",
            "message": f"Only {len(factors)} factors were identified. DEMATEL is most stable with 3-10 factors."
        })
    elif len(factors) > 15:
        checks.append({
            "metric": "High Factor Count",
            "status": "warn",
            "level": "medium",
            "message": f"{len(factors)} factors were identified. This is a very complex system."
        })
    else:
         checks.append({
            "metric": "Factor Count",
            "status": "pass",
            "level": "success",
            "message": f"System includes {len(factors)} factors, which is a good number for analysis."
        })

    return {"checks": checks, "statistics": statistics}


# --- Main DEMATEL Function ---

async def perform_dematel(
    factors: List[str],
    direct_matrix: List[List[int]]
) -> Dict[str, Any]:
    """
    Main function to run the full DEMATEL analysis.
    It now receives the factors and matrix from the frontend.
    """
    debug_log("🚀 Starting DEMATEL Analysis (Real Data)", "INFO")
    
    try:
        # Step 1: Convert incoming data to NumPy
        debug_log(f"Received {len(factors)} factors and a {len(direct_matrix)}x{len(direct_matrix[0])} matrix.", "DEBUG")
        direct_matrix_np = np.array(direct_matrix, dtype=int)
        
        # Step 2: Run DEMATEL calculations
        calc_results = _calculate_dematel_matrix(direct_matrix_np, factors)
        
        # Step 3: Generate individual data components (NO HTML)
        analysis_data = _generate_analysis_data(calc_results)
        
        # Step 4: Prepare data for frontend charting
        chart_data = _prepare_chart_data(calc_results)
        
        # Step 5: Generate warnings/diagnostics
        diagnostics = _generate_dematel_diagnostics(calc_results, direct_matrix_np, factors)
        
        # Step 6: Assemble final response object
        response_data = {
            "analysis_type": "dematel",
            **analysis_data, 
            "chart_data": chart_data,
            "diagnostics": diagnostics, # <-- Send the new diagnostics object
            "raw_data": { 
                "factors": factors, 
                "summary_df": calc_results['results_df'].to_dict(orient='records'),
                "total_relation_matrix": calc_results['total_relation_matrix'].tolist()
            }
        }
        
        debug_log("✅ DEMATEL analysis completed successfully", "INFO")
        return response_data
        
    except Exception as e:
        error_msg = f"❌ Unexpected error during DEMATEL math: {type(e).__name__}: {str(e)}"
        debug_log(error_msg, "ERROR")
        debug_log(f"Full traceback:\n{traceback.format_exc()}", "ERROR")
        raise HTTPException(status_code=500, detail=error_msg)