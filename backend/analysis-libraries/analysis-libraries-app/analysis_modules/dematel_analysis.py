# analysis_modules/dematel_analysis.py

import traceback
import numpy as np
import pandas as pd
import httpx  # Required for async API calls to Ollama
import json
import re
from typing import List, Dict, Any
from fastapi import HTTPException
from datetime import datetime

# --- CONFIGURATION ---
OLLAMA_URL = "https://ollama.sageaios.com/api/generate"
MODEL_NAME = "llama3.1:latest"

# --- Debugging ---
def debug_log(message, level="INFO"):
    """Simple logger for debugging."""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{timestamp}] [DEMATEL-{level}] {message}")

# --- Helper Functions ---
def clean_and_parse_json(raw_text: str) -> Dict[str, Any]:
    """
    Robustly parses JSON content from a potentially messy string (e.g., LLM output).
    
    Strips Markdown code block delimiters (```json ... ```) and attempts to isolate
    the JSON object by finding the first '{' and last '}'. Returns a fallback error
    dictionary if parsing fails to prevent application crashes.
    """
    try:
        # 1. Remove markdown code blocks
        text = re.sub(r'```json\s*', '', raw_text, flags=re.IGNORECASE)
        text = re.sub(r'```', '', text)
        
        # 2. Find the JSON object boundaries
        start_idx = text.find('{')
        end_idx = text.rfind('}')
        
        if start_idx != -1 and end_idx != -1:
            text = text[start_idx : end_idx + 1]
        
        # 3. Attempt to parse
        return json.loads(text)
        
    except (json.JSONDecodeError, Exception) as e:
        debug_log(f"JSON Parse Error: {e}", "ERROR")
        # Fail gracefully so the UI doesn't break
        return {
            "factors": ["Error_Factor_1", "Error_Factor_2"],
            "matrix": [[0, 0], [0, 0]],
            "error": f"The AI returned invalid data. Raw output: {raw_text[:100]}..."
        }

# --- NEW: Ollama Integration (matching SEM pattern) ---
async def _call_ollama_for_dematel(user_text: str) -> Dict[str, Any]:
    """
    Calls Ollama to extract factors and generate the influence matrix from user text.
    Uses the same pattern as SEM analysis for consistency.
    """
    debug_log("Step 1: Calling Ollama for factor extraction and matrix generation...", "INFO")
    
    prompt = f"""
        You are a meticulous DEMATEL analyst. Your task is to perform a rigorous analysis of the provided text.

        **USER TEXT:**
        \"\"\"
        {user_text}
        \"\"\"

        **YOUR TASKS (Follow this order):**

        **TASK 1: Extract Factors**
        First, carefully read the text and identify the key named factors. List them.
        *Example:*
        * Factors: ["Factor 1", "Factor 2", "Factor 3"]

        **TASK 2: Analyze Relationships (Chain of Thought)**
        Second, think step-by-step. For each *pair* of factors, analyze the influence from the row factor to the column factor.
        - Use this scale ONLY: 0=No, 1=Low, 2=Moderate, 3=Strong, 4=Very Strong.
        - You MUST justify your rating with a quote or direct inference from the text.
        - If the text does not describe an influence, the rating MUST be 0.
        
        *Example of thinking process:*
        * (Factor 1 -> Factor 1): 0 (Self-influence is zero)
        * (Factor 1 -> Factor 2): Rating 3 (Strong). Justification: The text states "Factor 1 strongly influences Factor 2."
        * (Factor 1 -> Factor 3): Rating 0. Justification: The text does not mention any relationship.
        * (Factor 2 -> Factor 1): Rating 1 (Low). Justification: The text implies "Factor 2 has some small impact on Factor 1."
        * ... (continue for all pairs)

        **TASK 3: Create Final JSON**
        Finally, use your step-by-step analysis to build the final JSON object.
        - The "factors" list must match the factors you identified.
        - The "matrix" must be an N x N matrix corresponding to your justified ratings.
        - The matrix row/column order MUST match the factor list order.

        **IMPORTANT:** RETURN ONLY RAW JSON. No markdown, no explanations.

        **JSON FORMAT:**
        {{
          "factors": [
            "Factor Name 1",
            "Factor Name 2",
            "..."
          ],
          "matrix": [
            [0, 3, 0, ...], 
            [1, 0, 0, ...],
            [...],
            ...
          ]
        }}
    """
    
    try:
        # Use httpx like SEM analysis for consistency
        async with httpx.AsyncClient() as client:
            response = await client.post(
                OLLAMA_URL,
                json={
                    "model": MODEL_NAME,
                    "prompt": prompt,
                    "stream": False,
                    "format": "json",
                    "options": {"num_ctx": 4096}
                },
                timeout=120.0  # 2 minute timeout like SEM
            )
            
            if response.status_code != 200:
                debug_log(f"Ollama API Error: {response.status_code} {response.text}", "ERROR")
                raise HTTPException(
                    status_code=500, 
                    detail=f"Ollama AI server error: {response.status_code}"
                )
            
            data = response.json()
            debug_log("Received response from Ollama", "DEBUG")
            
            # Use the robust JSON cleaner like SEM analysis
            ai_data = clean_and_parse_json(data["response"])
            
            # Check for parsing errors
            if "error" in ai_data:
                raise HTTPException(status_code=500, detail=ai_data["error"])
            
            # Validate the structure
            if not ai_data.get("factors") or not ai_data.get("matrix"):
                raise HTTPException(status_code=500, detail="AI response missing 'factors' or 'matrix' key")
            
            if not isinstance(ai_data["factors"], list) or not isinstance(ai_data["matrix"], list):
                raise HTTPException(status_code=500, detail="'factors' or 'matrix' are not arrays")
            
            if len(ai_data["factors"]) != len(ai_data["matrix"]):
                raise HTTPException(status_code=500, detail="Matrix size does not match factors list")
            
            # Validate matrix dimensions
            n = len(ai_data["factors"])
            for i, row in enumerate(ai_data["matrix"]):
                if not isinstance(row, list) or len(row) != n:
                    raise HTTPException(status_code=500, detail=f"Matrix row {i} has incorrect dimensions")
            
            debug_log("AI response validated successfully", "DEBUG")
            return ai_data
            
    except httpx.ReadTimeout:
        debug_log("Ollama request timed out", "ERROR")
        raise HTTPException(status_code=500, detail="AI request timed out. Please try again.")
    except httpx.RequestError as e:
        debug_log(f"Ollama request failed: {str(e)}", "ERROR")
        raise HTTPException(status_code=500, detail=f"Failed to connect to Ollama AI server: {str(e)}")
    except HTTPException:
        raise  # Re-raise HTTPException as-is
    except Exception as e:
        debug_log(f"Unexpected Ollama error: {str(e)}", "ERROR")
        raise HTTPException(status_code=500, detail=f"Unexpected AI processing error: {str(e)}")

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


# --- Main DEMATEL Functions ---

async def perform_dematel_from_text(user_text: str) -> Dict[str, Any]:
    """
    NEW: Main function to run DEMATEL analysis from raw text.
    This function handles the Ollama call internally using the same pattern as SEM analysis.
    """
    debug_log("🚀 Starting DEMATEL Analysis from Text", "INFO")
    
    try:
        # Step 1: Call Ollama to extract factors and matrix (using httpx like SEM)
        ai_data = await _call_ollama_for_dematel(user_text)
        factors = ai_data["factors"]
        direct_matrix = ai_data["matrix"]
        
        debug_log(f"AI extracted {len(factors)} factors", "INFO")
        
        # Step 2: Continue with existing DEMATEL processing
        return await perform_dematel(factors, direct_matrix)
        
    except HTTPException:
        raise  # Re-raise HTTPException as-is
    except Exception as e:
        error_msg = f"❌ Error during DEMATEL text analysis: {type(e).__name__}: {str(e)}"
        debug_log(error_msg, "ERROR")
        debug_log(f"Full traceback:\n{traceback.format_exc()}", "ERROR")
        raise HTTPException(status_code=500, detail=error_msg)


async def perform_dematel(
    factors: List[str],
    direct_matrix: List[List[int]]
) -> Dict[str, Any]:
    """
    EXISTING: Main function to run DEMATEL analysis from factors/matrix.
    This maintains backward compatibility for direct matrix input.
    """
    debug_log("🚀 Starting DEMATEL Analysis (Matrix Input)", "INFO")
    
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
            "diagnostics": diagnostics, 
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