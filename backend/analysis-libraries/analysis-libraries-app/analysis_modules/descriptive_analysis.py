# analysis_modules/descriptive_analysis.py

import io
import pandas as pd
import numpy as np
import traceback
import json
import httpx  # Using httpx for async requests to Ollama
from typing import Optional, Dict, Any, Union, List
from starlette.datastructures import UploadFile
from fastapi import HTTPException
from scipy import stats
from collections import Counter

# --- NEW: OLLAMA Configuration ---
OLLAMA_URL = "https://ollama.sageaios.com/api/generate"
OLLAMA_MODEL = "llama3.1:latest"

# --- Helper to load data (Unchanged) ---
async def load_dataframe(
    data_payload: Union[UploadFile, str],
    is_file_upload: bool,
    input_filename: str
) -> pd.DataFrame:
    """
    Asynchronously loads a pandas DataFrame from an uploaded file or a raw string.

    This function handles file format detection (CSV vs Excel) based on the filename extension,
    decodes bytes, handles common missing value markers, and creates the DataFrame.

    Args:
        data_payload (Union[UploadFile, str]): The input data, either as a Starlette UploadFile
            object or a raw string (for pasted text).
        is_file_upload (bool): Flag indicating if the payload is a file upload.
        input_filename (str): The name of the file, used to determine the parser (CSV or Excel).

    Returns:
        pd.DataFrame: A pandas DataFrame containing the loaded data.

    Raises:
        TypeError: If `is_file_upload` is True but `data_payload` is not an UploadFile.
        HTTPException: If the file is empty, the file type is invalid, or parsing fails.
    """
    print("📊 Loading data...")
    filename_lower = input_filename.lower()
    na_vals = ['-', '', ' ', 'NA', 'N/A', 'null', 'None', '#N/A', '#VALUE!', '#DIV/0!', 'NaN', 'nan']
    
    try:
        if is_file_upload:
            if not isinstance(data_payload, UploadFile):
                raise TypeError(f"Expected UploadFile but received {type(data_payload)}")
            
            contents = await data_payload.read()
            if not contents:
                raise HTTPException(status_code=400, detail="Uploaded file is empty.")
            
            if filename_lower.endswith('.csv'):
                try:
                    decoded_content = contents.decode('utf-8')
                except UnicodeDecodeError:
                    decoded_content = contents.decode('latin1')
                data_io = io.StringIO(decoded_content)
                df = pd.read_csv(data_io, na_values=na_vals, sep=None, engine='python')
                
            elif filename_lower.endswith(('.xlsx', '.xls')):
                data_io = io.BytesIO(contents)
                df = pd.read_excel(data_io, na_values=na_vals)
            else:
                raise HTTPException(status_code=400, detail="Invalid file type. Please upload CSV or Excel file.")
        else:
            if not isinstance(data_payload, str) or not data_payload.strip():
                raise HTTPException(status_code=400, detail="Pasted text data is empty.")
            data_io = io.StringIO(data_payload)
            df = pd.read_csv(data_io, na_values=na_vals, sep=None, engine='python')
        
        if df.empty:
            raise HTTPException(status_code=400, detail="Data is empty after loading.")
        
        print(f"✅ Data loaded successfully. Shape: {df.shape}")
        return df

    except Exception as e:
        print(f"❌ Error loading data: {e}\n{traceback.format_exc()}")
        raise HTTPException(status_code=400, detail=f"Failed to read data: {e}")

# --- NEW: LLM Insights Generator ---
async def get_llm_insights(stats_summary: Dict, context: str) -> List[Dict[str, str]]:
    """
    Generates actionable business insights using an external LLM (Ollama) based on statistical summaries.

    Constructs a prompt containing the business context and the calculated statistics,
    then queries the LLM to interpret skewness, variability, and central tendencies.
    It includes robust error handling to return fallback insights if the API call fails.

    Args:
        stats_summary (Dict): A dictionary containing summaries of numerical (mean, median, etc.)
            and categorical (mode, unique count) variables.
        context (str): A string describing the business context or background of the data.

    Returns:
        List[Dict[str, str]]: A list of dictionaries, where each dictionary represents an insight
            with keys "observation", "interpretation", and "business_implication".
            Returns a list containing an error object if the process fails.
    """
    """
    Calls Ollama to generate business insights based on statistical summary.
    This logic is moved from your frontend JS file.
    """
    print("🤖 Calling LLM for insights...")
    prompt = f"""
        You are a meticulous senior data analyst. Accuracy is paramount. Use the provided statistics and business context to generate 6-8 specific, actionable business insights.

        **BUSINESS CONTEXT:**
        \"\"\"
        {context}
        \"\"\"

        **CALCULATED STATISTICAL SUMMARY:**
        \"\"\"
        {json.dumps(stats_summary, indent=2)}
        \"\"\"

        **TASK:**
        Generate **6 to 8** specific, actionable business insights. Each insight MUST be accurate and directly interpret the provided STATISTICAL SUMMARY within the BUSINESS CONTEXT.

        **For each insight:**
        1.  **Observation:** State the specific statistical finding *exactly* as calculated (e.g., "Mean for 'Age' (XX.X) is [correctly state: higher/lower] than Median (YY.Y)").
        2.  **Accurate Interpretation:** Explain the practical meaning.
            * **SKEWNESS RULE:**
                * If Mean > Median: Interpret as potential **right-skewness** (tail to higher values, possible high outliers).
                * If Mean < Median: Interpret as potential **left-skewness** (tail to lower values, possible low outliers).
                * If Mean ≈ Median: Interpret as roughly symmetric.
            * **Variability:** High Std Dev relative to Mean implies high variability/inconsistency. Low Std Dev implies consistency.
            * **Categorical Mode:** A high percentage for the mode indicates concentration in that category.
        3.  **Business Implication/Recommendation:** Connect the *accurate* interpretation to the BUSINESS CONTEXT. Suggest potential actions or investigations.

        **CRITICAL REQUIREMENTS:**
        - **NUMERICAL ACCURACY:** All statements about numbers MUST be correct.
        - **CORRECT INTERPRETATION:** Skewness direction MUST follow the Mean vs. Median rule.
        - **Context Link:** Link insights to BUSINESS CONTEXT.
        - **Actionable:** Insights should lead to next steps.

        **RETURN FORMAT:**
        Provide ONLY a valid JSON object with a list of **6 to 8** insight objects:
        {{
          "business_insights": [
            {{
              "observation": "Accurate observation statement...",
              "interpretation": "Correct interpretation based on rules...",
              "business_implication": "Recommendation linked to context..."
            }}
            // ... 6 to 8 insights total ...
          ]
        }}
    """
    
    try:
        async with httpx.AsyncClient(timeout=300.0) as client:
            response = await client.post(
                OLLAMA_URL,
                json={
                    "model": OLLAMA_MODEL,
                    "prompt": prompt,
                    "stream": False,
                    "format": "json"
                }
            )
            response.raise_for_status() # Raise error on 4xx/5xx
            
            data = response.json()
            if "response" not in data:
                raise Exception("Invalid response from Ollama: 'response' key missing.")
                
            parsed_json = json.loads(data["response"]) # The response is a JSON *string*
            
            if "business_insights" not in parsed_json or not isinstance(parsed_json["business_insights"], list):
                raise Exception("Invalid JSON structure from Ollama: 'business_insights' list missing.")
                
            print(f"✅ LLM generated {len(parsed_json['business_insights'])} insights.")
            return parsed_json["business_insights"]
            
    except httpx.RequestError as e:
        print(f"❌ HTTP error calling Ollama: {e}")
        return [{"observation": "Error", "interpretation": f"Failed to connect to Ollama: {e}", "business_implication": "Could not generate insights."}]
    except json.JSONDecodeError as e:
        print(f"❌ Error parsing Ollama JSON response: {e}")
        return [{"observation": "Error", "interpretation": f"Invalid JSON received from AI: {e}", "business_implication": "Could not generate insights."}]
    except Exception as e:
        print(f"❌ Unexpected error in get_llm_insights: {e}\n{traceback.format_exc()}")
        return [{"observation": "Error", "interpretation": str(e), "business_implication": "Could not generate insights."}]

# --- MAIN FUNCTION (REWRITTEN) ---
async def perform_descriptive_analysis(
    data_payload: Union[UploadFile, str],
    is_file_upload: bool,
    input_filename: str,
    context_file: Optional[UploadFile] = None, # Added to accept context file
    analysis_types: List[str] = None # This is no longer used, but kept for signature
) -> Dict[str, Any]:
    """
    Orchestrates the complete descriptive analysis pipeline for a dataset.

    This function performs the following steps:
    1. Loads the dataframe from the input source.
    2. Reads an optional business context file.
    3. Iterates through all columns to calculate statistics:
       - For numerical columns: Mean, median, std dev, min/max, IQR.
       - For categorical columns: Mode, unique count, frequency tables.
    4. Generates visualization data structures (histograms for numerical, bar charts for categorical).
    5. Calls an LLM to generate narrative insights based on the calculated stats and context.
    6. Formats the final output into a specific JSON structure required by the frontend.

    Args:
        data_payload (Union[UploadFile, str]): The dataset to analyze.
        is_file_upload (bool): Whether the payload is a file upload.
        input_filename (str): The name of the input file.
        context_file (Optional[UploadFile]): An optional text file containing business context.
        analysis_types (List[str], optional): Deprecated argument kept for compatibility. Defaults to None.

    Returns:
        Dict[str, Any]: A dictionary containing the analysis results, structured as:
            - 'summary': Overview of dataset dimensions and variable types.
            - 'numerical_summary': List of stats for numerical variables.
            - 'categorical_summary': List of stats for categorical variables.
            - 'visualizations': List of chart data objects.
            - 'business_insights': List of AI-generated insights.

    Raises:
        HTTPException: If the file upload fails or is invalid.
        Exception: Catches generic errors during analysis and returns a structured error response 
            instead of crashing, allowing the frontend to display the error message.
    """
    """
    Main function to perform descriptive analysis.
    
    REWRITTEN to match the *exact* JSON output structure required by
    the frontend's renderDescriptivePage_DA() function.
    """
    print("🚀 Starting Descriptive Analysis (Frontend-Compatible)...")
    
    try:
        # 1. Load Data
        df = await load_dataframe(data_payload, is_file_upload, input_filename)
        
        # 2. Load Context (if provided)
        business_context = "No business context document provided."
        if context_file:
            try:
                contents = await context_file.read()
                business_context = contents.decode('utf-8')
            except Exception as e:
                print(f"Warning: Could not read context file. {e}")
                business_context = "Error reading context file. Proceeding without it."
        
        # 3. Initialize result lists (as expected by frontend)
        numerical_summary = []
        categorical_summary = []
        visualizations = []
        numerical_vars_count = 0
        categorical_vars_count = 0
        
        stats_for_llm = { # Simplified summary for the LLM prompt
            "numerical_highlights": [],
            "categorical_highlights": []
        }

        # 4. Loop through columns and calculate stats
        print("🔍 Analyzing columns...")
        for col in df.columns:
            series = df[col]
            non_null_series = series.dropna()
            if len(non_null_series) == 0:
                continue # Skip empty columns

            # --- Detect Type ---
            numeric_series = pd.to_numeric(series, errors='coerce')
            is_numeric = (numeric_series.notna().sum() / len(non_null_series)) > 0.8
            
            if is_numeric:
                # --- Handle NUMERICAL Column ---
                numerical_vars_count += 1
                numeric_series = numeric_series.dropna()
                if len(numeric_series) < 2: continue # Not enough data to analyze
                
                count = int(numeric_series.count())
                mean = round(float(numeric_series.mean()), 2)
                median = round(float(numeric_series.median()), 2)
                std_dev = round(float(numeric_series.std()), 2)
                min_val = round(float(numeric_series.min()), 2)
                max_val = round(float(numeric_series.max()), 2)
                q1 = round(float(numeric_series.quantile(0.25)), 2)
                q3 = round(float(numeric_series.quantile(0.75)), 2)
                iqr = round(q3 - q1, 2)
                
                # Append to numerical_summary list
                numerical_summary.append({
                    "variable": col,
                    "count": count,
                    "mean": mean,
                    "median": median,
                    "std_dev": std_dev,
                    "min": min_val,
                    "max": max_val,
                    "q1": q1,
                    "q3": q3,
                    "iqr": iqr
                })
                
                # Append data for LLM
                stats_for_llm["numerical_highlights"].append({
                    "variable": col,
                    "mean": mean,
                    "median": median,
                    "std_dev": std_dev,
                    "min": min_val,
                    "max": max_val
                })
                
                # Append data for Plotly (NO matplotlib)
                visualizations.append({
                    "chart_type": "histogram",
                    "variable": col,
                    "data": numeric_series.tolist(), # Send raw data
                    "title": f"Distribution of {col}"
                })

            else:
                # --- Handle CATEGORICAL Column ---
                categorical_vars_count += 1
                series = series.astype(str) # Ensure all are strings
                count = int(series.count())
                value_counts = series.value_counts()
                unique_categories = int(series.nunique())
                mode = value_counts.index[0] if not value_counts.empty else "N/A"
                
                frequencies = []
                for category, cat_count in value_counts.items():
                    frequencies.append({
                        "category": str(category),
                        "count": int(cat_count),
                        "percentage": round((cat_count / count) * 100, 2)
                    })
                
                # Append to categorical_summary list
                categorical_summary.append({
                    "variable": col,
                    "count": count,
                    "unique_categories": unique_categories,
                    "mode": str(mode),
                    "frequencies": frequencies
                })
                
                # Append data for LLM
                stats_for_llm["categorical_highlights"].append({
                    "variable": col,
                    "unique_categories": unique_categories,
                    "mode": str(mode),
                    "top_category_pct": frequencies[0]["percentage"] if frequencies else 0
                })
                
                # Append data for Plotly (NO matplotlib)
                # Frontend expects data as an object: {category: count}
                MAX_BAR_CATEGORIES = 15
                top_freq = frequencies[:MAX_BAR_CATEGORIES]
                bar_data = {item["category"]: item["count"] for item in top_freq}
                
                visualizations.append({
                    "chart_type": "bar",
                    "variable": col,
                    "data": bar_data, # Send data as {key: value} object
                    "title": f"Frequency of Top {len(top_freq)} Categories in {col}"
                })
        
        print("✅ Column analysis complete.")

        # 5. Create the 'summary' object
        summary_interpretation = (
            f"The dataset contains {len(df)} records across {len(df.columns)} variables "
            f"({numerical_vars_count} numerical, {categorical_vars_count} categorical). "
            f"Analysis summarizes central tendency, dispersion, and frequencies."
        )
        
        summary = {
            "rows": int(len(df)),
            "columns": int(len(df.columns)),
            "numerical_vars": numerical_vars_count,
            "categorical_vars": categorical_vars_count,
            "interpretation": summary_interpretation
        }
        
        # Add summary to LLM stats
        stats_for_llm["overview"] = summary

        # 6. Call LLM for insights
        business_insights = await get_llm_insights(stats_for_llm, business_context)

        # 7. Assemble final response in the *exact* format the frontend needs
        response_data = {
            "summary": summary,
            "numerical_summary": numerical_summary,
            "categorical_summary": categorical_summary,
            "visualizations": visualizations,
            "business_insights": business_insights
        }
        
        print("✅ Descriptive analysis (Frontend-Compatible) completed.")
        return response_data
        
    except HTTPException as http_exc:
        print(f"❌ HTTP Exception in descriptive_analysis: {http_exc.detail}")
        raise http_exc
    except Exception as e:
        error_msg = f"❌ Unexpected error in descriptive analysis: {type(e).__name__}: {str(e)}"
        print(f"{error_msg}\n{traceback.format_exc()}")
        # Return an error in the *expected* format so the frontend can handle it
        return {
            "summary": {"interpretation": f"Analysis Failed: {e}"},
            "numerical_summary": [],
            "categorical_summary": [],
            "visualizations": [],
            "business_insights": [{"observation": "Error", "interpretation": str(e), "business_implication": "Analysis could not be completed."}]
        }