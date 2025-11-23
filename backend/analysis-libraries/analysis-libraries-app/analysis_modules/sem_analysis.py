# analysis_modules/sem_analysis.py

import io
import pandas as pd
import semopy
import traceback
import re
import json
import httpx  # Required for async API calls to Ollama
from typing import Optional, Tuple, List, Dict, Any, Union
import numpy as np
from sklearn.preprocessing import StandardScaler
from starlette.datastructures import UploadFile
from fastapi import HTTPException

# --- FIX: 'inspect' moved to submodule in newer semopy versions ---
from semopy import Optimizer, calc_stats, semplot
from semopy.inspector import inspect 

# --- CONFIGURATION ---
OLLAMA_URL = "https://ollama.sageaios.com/api/generate"
MODEL_NAME = "llama3.1:latest"

# --- Helper Functions ---

def safe_float(value, default=np.nan):
    """
    Safely converts a value to a float, handling various string representations and NaNs.

    This function checks for common "empty" string indicators and standardizes them to
    the default value (usually np.nan). It also rounds valid floats to 4 decimal places.

    Args:
        value (Any): The input value to convert (string, number, or None).
        default (float, optional): The value to return if conversion fails. Defaults to np.nan.

    Returns:
        float: The converted float value rounded to 4 decimals, or the default value.
    """
    """
    Safely convert value to float, handling common issues, rounding to 4 decimals.
    """
    if pd.isna(value) or value in ['-', '', ' ', 'None', 'nan', 'NA']:
        return default
    if isinstance(value, (np.float32, np.float64, np.floating)):
        if np.isnan(value):
            return default
        value = float(value)
    try:
        float_value = float(value)
        if not np.isfinite(float_value):
            return default
        return round(float_value, 4)
    except (ValueError, TypeError):
        return default

def clean_and_parse_json(raw_text: str) -> Dict[str, Any]:
    """
    Robustly parses JSON content from a potentially messy string (e.g., LLM output).

    Strips Markdown code block delimiters (```json ... ```) and attempts to isolate
    the JSON object by finding the first '{' and last '}'. Returns a fallback error
    dictionary if parsing fails to prevent application crashes.

    Args:
        raw_text (str): The raw string output from the LLM.

    Returns:
        Dict[str, Any]: The parsed JSON object, or a dictionary describing the error
            if parsing failed.
    """
    """
    Robustly extracts JSON from AI output. 
    Strips Markdown (```json ... ```) and finds the first '{' and last '}'.
    Returns a fallback error object if parsing fails.
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
        print(f"⚠️ JSON Parse Error: {e}")
        # Fail gracefully so the UI doesn't break
        return {
            "model_fit_status": "AI Parse Error",
            "fit_explanation": f"The AI returned invalid data. Raw output: {raw_text[:50]}...",
            "key_findings": ["Could not parse AI insights."],
            "strategic_implications": "Please review the statistical tables manually."
        }

async def generate_sem_interpretation(fit_indices, estimates_df, context_text=""):
    """
    Asynchronously generates a business-friendly interpretation of SEM results using an external LLM.

    Constructs a prompt summarizing model fit metrics (CFI, RMSEA, etc.) and significant
    path coefficients, then sends this to the Ollama API to get a strategic analysis.

    Args:
        fit_indices (pd.DataFrame): DataFrame containing model fit statistics.
        estimates_df (pd.DataFrame): DataFrame containing parameter estimates and p-values.
        context_text (str, optional): Business context or hypothesis description provided by the user.

    Returns:
        Optional[Dict[str, Any]]: A dictionary containing the AI-generated interpretation,
            or None if the API call fails.
    """
    """
    Sends SEM statistics to Ollama to generate a business-friendly interpretation.
    """
    try:
        # 1. Summarize Model Fit
        fit_summary = "--- MODEL FIT METRICS ---\n"
        if not fit_indices.empty:
            keys = ['CFI', 'TLI', 'RMSEA', 'SRMR', 'chi2_pvalue', 'GFI']
            for k in keys:
                col_name = next((col for col in fit_indices.columns if k.lower() in col.lower()), None)
                if col_name:
                    val = fit_indices.iloc[0][col_name]
                    fit_summary += f"{k}: {val}\n"
        
        # 2. Summarize Significant Relationships
        path_summary = "\n--- SIGNIFICANT PATHS (p < 0.05) ---\n"
        if not estimates_df.empty:
            estimates_df['p-value'] = pd.to_numeric(estimates_df['p-value'], errors='coerce')
            estimates_df['Estimate'] = pd.to_numeric(estimates_df['Estimate'], errors='coerce')
            
            sig_paths = estimates_df[
                (estimates_df['op'] == '~') & 
                (estimates_df['p-value'] < 0.05)
            ]
            
            if not sig_paths.empty:
                for _, row in sig_paths.iterrows():
                    path_summary += f"Path: {row['lval']} -> {row['rval']} (Strength: {row['Estimate']:.3f})\n"
            else:
                path_summary += "No statistically significant structural paths found.\n"
        else:
            path_summary += "No estimates available.\n"

        # 3. Build Prompt
        prompt = f"""
        You are an expert statistician. Interpret these Structural Equation Model (SEM) results.
        
        **BUSINESS CONTEXT:** {context_text if context_text else "General Context"}
        **STATS:** {fit_summary}
        {path_summary}

        **TASK:**
        Provide a JSON object with:
        1. "model_fit_status": "Good/Mixed/Poor" (Rule: CFI>0.9, RMSEA<0.08 is good).
        2. "fit_explanation": Brief explanation.
        3. "key_findings": List of 2-3 plain English findings from the paths.
        4. "strategic_implications": What the business should do.

        **IMPORTANT:** RETURN ONLY RAW JSON.
        """

        # 4. Call Ollama (Increased timeout to 120s)
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
                timeout=120.0
            )
            
            if response.status_code != 200:
                print(f"AI Error: {response.status_code}")
                return None
            
            data = response.json()
            # Use the robust cleaner instead of raw json.loads
            return clean_and_parse_json(data['response'])

    except httpx.ReadTimeout:
        print("⚠️ AI Generation Timed Out.")
        return None
    except Exception as e:
        print(f"AI Generation Failed: {e}")
        return None

# --- Main SEM Function ---
async def perform_sem(
    data_payload: Union[UploadFile, str],
    is_file_upload: bool,
    input_filename: str,
    measurement_syntax: str,
    structural_syntax: str,
    context_text: str = ""
) -> Dict[str, Any]:
    """
    Orchestrates the full Structural Equation Modeling (SEM) analysis pipeline.

    This function handles data loading, cleaning, standardization, model specification (using semopy syntax),
    model fitting, statistic calculation (estimates, fit indices), visualization generation,
    and AI-driven interpretation.

    Args:
        data_payload (Union[UploadFile, str]): The input data source (file or text).
        is_file_upload (bool): Flag indicating if the payload is a file upload.
        input_filename (str): Name of the input file.
        measurement_syntax (str): The measurement model syntax (e.g., 'Latent =~ x1 + x2').
        structural_syntax (str): The structural model syntax (e.g., 'Target ~ Source').
        context_text (str, optional): Business context provided by the user for AI insights.

    Returns:
        Dict[str, Any]: A dictionary containing:
            - 'estimates_csv_content': Parameter estimates CSV string.
            - 'fit_indices_csv_content': Model fit indices CSV string.
            - 'path_diagram_dot': Graphviz DOT source for the path diagram.
            - 'warnings': Dictionary of data warnings (e.g., high correlations).
            - 'model_variables': Lists of observed and latent variables.
            - 'ai_interpretation': The AI-generated analysis results.

    Raises:
        HTTPException: If data loading fails, syntax is invalid, insufficient data exists,
            or the SEM analysis encounters a critical error.
        TypeError: If input types are incorrect.
    """
    
    print("🚀 Starting SEM analysis...")
    
    # Combine Syntax
    model_syntax_combined = measurement_syntax.strip()
    if structural_syntax.strip():
        separator = "\n\n" if measurement_syntax.strip() else ""
        model_syntax_combined += separator + structural_syntax.strip()

    if not model_syntax_combined:
         raise HTTPException(status_code=400, detail="Combined model syntax is empty.")

    # Initialize vars
    df = None
    estimates_df = pd.DataFrame()
    fit_indices_df = pd.DataFrame()
    obs_vars = set()
    latent_vars = set()

    try:
        # --- 1. Load Data ---
        print(f"   Step 1: Loading data...")
        na_vals = ['-', '', ' ', 'NA', 'N/A', 'null', 'None', 'NaN', 'nan']

        if is_file_upload:
            if not isinstance(data_payload, UploadFile):
                 raise TypeError("Expected UploadFile")
            contents = await data_payload.read()
            if input_filename.lower().endswith('.csv'):
                try:
                    df = pd.read_csv(io.StringIO(contents.decode('utf-8')), na_values=na_vals)
                except:
                    df = pd.read_csv(io.StringIO(contents.decode('latin1')), na_values=na_vals)
            elif input_filename.lower().endswith(('.xlsx', '.xls')):
                df = pd.read_excel(io.BytesIO(contents), na_values=na_vals)
        else:
            if not isinstance(data_payload, str):
                 raise TypeError("Expected string for text input")
            df = pd.read_csv(io.StringIO(data_payload), na_values=na_vals)

        if df is None or df.empty:
            raise HTTPException(status_code=400, detail="Data loading failed or data is empty.")

        # --- 2. Clean Columns ---
        df.columns = [re.sub(r'\W+', '_', col).strip('_') for col in df.columns]
        
        # --- 3. Initialize Model ---
        print("   Step 3: Initializing SEM model...")
        model_obj = semopy.Model(model_syntax_combined)
        obs_vars = set(model_obj.vars.get('observed', []))
        latent_vars = set(model_obj.vars.get('latent', []))

        # --- 4. Data Prep ---
        print("   Step 4: Preparing data...")
        missing = obs_vars - set(df.columns)
        if missing:
            raise HTTPException(status_code=400, detail=f"Variables in syntax not found in data: {list(missing)}")

        df_model = df[list(obs_vars)].apply(pd.to_numeric, errors='coerce').dropna()
        if len(df_model) < 10:
            raise HTTPException(status_code=400, detail="Insufficient data (less than 10 valid rows).")

        # --- 5. Standardize ---
        scaler = StandardScaler()
        df_std = pd.DataFrame(scaler.fit_transform(df_model), columns=df_model.columns)

        # --- 6. Check Correlations ---
        corr_matrix = df_std.corr().abs()
        upper = corr_matrix.where(np.triu(np.ones(corr_matrix.shape), k=1).astype(bool))
        high_corr = [column for column in upper.columns if any(upper[column] > 0.90)]
        warnings_dict = {}
        if high_corr:
            warnings_dict['high_correlation'] = f"Variables with correlation > 0.90: {high_corr}"

        # --- 7. Fit Model ---
        print("   Step 7: Fitting model...")
        fit_res = model_obj.fit(df_std)
        fit_success = getattr(fit_res, 'success', True)

        # --- 8. Inspect Estimates ---
        estimates_df = inspect(model_obj)
        estimates_df.replace('-', np.nan, inplace=True)

        # --- 9. Calculate Fit Stats ---
        try:
            stats = calc_stats(model_obj)
            if isinstance(stats, dict):
                fit_indices_df = pd.DataFrame([stats])
            elif isinstance(stats, pd.DataFrame):
                fit_indices_df = stats.T if stats.shape[0] > 1 else stats
            else:
                fit_indices_df = pd.DataFrame()
        except Exception as e:
            print(f"   Warning: Fit stats calculation failed: {e}")
            fit_indices_df = pd.DataFrame()

        # --- 10. Generate Diagram ---
        path_diagram_dot = None
        try:
            plot = semplot(model_obj, "sem.png", show=False)
            path_diagram_dot = plot.source
        except Exception as e:
            print(f"   Warning: Diagram generation failed: {e}")

        # --- 11. AI INTERPRETATION (Robust) ---
        print("   Step 11: Generating AI Interpretation...")
        ai_result = await generate_sem_interpretation(
            fit_indices_df, 
            estimates_df, 
            context_text
        )

        # --- 12. Format Output ---
        estimates_csv = estimates_df.to_csv(index=False)
        fit_indices_csv = fit_indices_df.to_csv(index=False)

        response_data = {
            "message": "SEM analysis completed.",
            "estimates_csv_content": estimates_csv,
            "fit_indices_csv_content": fit_indices_csv,
            "path_diagram_dot": path_diagram_dot,
            "warnings": warnings_dict,
            "model_variables": {
                "observed": sorted(list(obs_vars)),
                "latent": sorted(list(latent_vars))
            },
            "data_summary": {
                "rows_used": len(df_model),
                "columns_used": list(df_model.columns)
            },
            "ai_interpretation": ai_result
        }

        return response_data

    except HTTPException as he:
        raise he
    except Exception as e:
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"SEM Analysis Error: {str(e)}")