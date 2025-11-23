# analysis_modules/prescriptive_analysis.py

import io
import pandas as pd
import numpy as np
import traceback
import json
import httpx
from typing import Optional, Dict, Any, Union, List, Tuple
from starlette.datastructures import UploadFile
from fastapi import HTTPException
from datetime import datetime
import warnings
warnings.filterwarnings('ignore')

# --- OLLAMA Configuration ---
OLLAMA_URL = "https://ollama.sageaios.com/api/generate"
OLLAMA_MODEL = "llama3.1:latest"

# --- JSON Serialization Helper ---
def convert_numpy_types(obj):
    """Recursively converts numpy/pandas types to native Python types for JSON serialization.

    Handles dictionaries, lists, tuples, numpy arrays, pandas Series, and specific
    numpy scalar types (integers, floats, booleans). Also handles NaN/Infinity
    to ensure validity for JSON output.

    Args:
        obj (Any): The object to convert.

    Returns:
        Any: The input object with all numpy types replaced by Python natives.
    """
    
    # Check for collections first
    if isinstance(obj, dict):
        return {key: convert_numpy_types(value) for key, value in obj.items()}
    
    if isinstance(obj, (list, tuple, np.ndarray, pd.Series, pd.Index)):
        return [convert_numpy_types(item) for item in obj]
    
    # Handle None / pd.NA / np.nan
    if obj is None or pd.isna(obj):
        return None
    
    # Handle numpy types
    if isinstance(obj, np.integer):
        return int(obj)
    if isinstance(obj, np.floating):
        if np.isnan(obj) or np.isinf(obj):
            return None
        return float(obj)
    if isinstance(obj, np.bool_):
        return bool(obj)
    if hasattr(obj, 'item'):
        return convert_numpy_types(obj.item())
    if isinstance(obj, float):
        if np.isnan(obj) or np.isinf(obj):
            return None
        return obj

    return obj

# --- Helper to load data ---
async def load_dataframe(
    data_payload: Union[UploadFile, str],
    is_file_upload: bool,
    input_filename: str
) -> pd.DataFrame:
    """Asynchronously loads a DataFrame from an uploaded file or raw text string.

    Supports CSV and Excel formats. Performs initial cleaning of column names
    (removing special characters and spaces) to ensure compatibility with downstream analysis.

    Args:
        data_payload (Union[UploadFile, str]): The file object or raw CSV string.
        is_file_upload (bool): Flag indicating if the payload is a file.
        input_filename (str): The name of the file (used for extension detection).

    Returns:
        pd.DataFrame: The loaded and cleaned DataFrame.

    Raises:
        HTTPException(400): If the file type is unsupported, data is empty, or loading fails.
    """
    print("📊 Loading data for prescriptive analysis...")
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
        
        # Clean column names
        df.columns = df.columns.str.replace(r'[^\w\s]', '', regex=True).str.replace(' ', '_')
        print(f"✅ Data loaded. Cleaned columns: {df.columns.tolist()}")
        return df

    except Exception as e:
        print(f"❌ Error loading data: {e}\n{traceback.format_exc()}")
        raise HTTPException(status_code=400, detail=f"Failed to read data: {e}")

# --- Helper to load context file or text ---
async def load_business_context(
    context_file: Optional[UploadFile] = None,
    context_text: Optional[str] = None
) -> str:
    """Retrieves business context text from either an uploaded file or a string.

    Used to extract the specific business goals or constraints needed for the
    prescriptive analysis.

    Args:
        context_file (Optional[UploadFile], optional): A file containing the context. Defaults to None.
        context_text (Optional[str], optional): Raw text string of the context. Defaults to None.

    Returns:
        str: The extracted business context string, or a default message if none provided.
    """
    if context_file:
        try:
            contents = await context_file.read()
            business_context = contents.decode('utf-8')
            print("✅ Business context file loaded.")
            return business_context.strip()
        except Exception as e:
            print(f"Warning: Could not read context file: {e}")
            return f"Error reading context file: {e}"
    elif context_text and context_text.strip():
        print("✅ Business context text loaded.")
        return context_text.strip()
    else:
        return "No business context provided."

# --- Data Analysis Helper ---
def analyze_data_structure(df: pd.DataFrame) -> Dict[str, Any]:
    """Profiles the dataset to identify column types, quality metrics, and potential drivers.

    Classifies columns as numerical or categorical, detects potential outcome variables
    (e.g., 'revenue', 'churn') based on keywords, and calculates basic statistics
    (mean, std, missing values) to feed into the LLM context.

    Args:
        df (pd.DataFrame): The dataset to analyze.

    Returns:
        Dict[str, Any]: A dictionary containing column metadata, data quality stats,
            and classification of potential drivers/outcomes.
    """
    print("🔍 Analyzing data structure for prescriptive insights...")
    
    analysis = {
        "numerical_columns": [],
        "categorical_columns": [],
        "potential_outcome_columns": [],
        "potential_driver_columns": [],
        "data_quality": {
            "total_rows": len(df),
            "total_columns": len(df.columns),
            "missing_data_percentage": (df.isnull().sum().sum() / (len(df) * len(df.columns))) * 100,
            "duplicate_rows": df.duplicated().sum()
        }
    }
    
    for col in df.columns:
        # Check if numerical
        numeric_series = pd.to_numeric(df[col], errors='coerce')
        numeric_ratio = numeric_series.notna().sum() / len(df) if len(df) > 0 else 0
        
        if numeric_ratio > 0.8:
            analysis["numerical_columns"].append({
                "name": col,
                "mean": float(numeric_series.mean()) if not numeric_series.empty else 0,
                "std": float(numeric_series.std()) if not numeric_series.empty else 0,
                "min": float(numeric_series.min()) if not numeric_series.empty else 0,
                "max": float(numeric_series.max()) if not numeric_series.empty else 0,
                "unique_count": int(numeric_series.nunique())
            })
            
            # Potential outcome columns (things we might want to optimize)
            if any(keyword in col.lower() for keyword in [
                'revenue', 'sales', 'profit', 'cost', 'churn', 'satisfaction', 
                'retention', 'conversion', 'performance', 'efficiency', 'score'
            ]):
                analysis["potential_outcome_columns"].append(col)
            else:
                analysis["potential_driver_columns"].append(col)
                
        else:
            # Categorical column
            unique_count = df[col].nunique()
            analysis["categorical_columns"].append({
                "name": col,
                "unique_count": int(unique_count),
                "top_categories": df[col].value_counts().head(5).to_dict()
            })
            analysis["potential_driver_columns"].append(col)
    
    print(f"✅ Data structure analyzed: {len(analysis['numerical_columns'])} numerical, {len(analysis['categorical_columns'])} categorical columns")
    return analysis

# --- LLM-based Prescriptive Analysis ---
async def generate_prescriptive_insights(
    business_goal: str,
    data_snippet: str,
    data_analysis: Dict[str, Any]
) -> Dict[str, Any]:
    """Interacts with an LLM to generate prescriptive business insights.

    Constructs a detailed prompt containing data summaries, samples, and the business goal.
    Queries the configured Ollama model to receive structured JSON containing
    insights, prescriptions, and implementation priorities.

    Args:
        business_goal (str): The specific objective the user wants to achieve.
        data_snippet (str): A CSV string representation of the first N rows.
        data_analysis (Dict[str, Any]): The structural analysis of the dataset.

    Returns:
        Dict[str, Any]: Structured JSON response containing insights, prescriptions,
            and implementation priorities.

    Raises:
        Exception: If the LLM response is invalid, malformed, or missing required fields.
    """
    print("🤖 Generating prescriptive insights using LLM...")
    
    # Prepare data context for the LLM
    data_context = f"""
    Dataset Overview:
    - Total Rows: {data_analysis['data_quality']['total_rows']}
    - Total Columns: {data_analysis['data_quality']['total_columns']}
    - Missing Data: {data_analysis['data_quality']['missing_data_percentage']:.1f}%
    
    Numerical Columns:
    {json.dumps([col['name'] for col in data_analysis['numerical_columns']], indent=2)}
    
    Categorical Columns:
    {json.dumps([col['name'] for col in data_analysis['categorical_columns']], indent=2)}
    
    Potential Outcome Variables (what we might optimize):
    {json.dumps(data_analysis['potential_outcome_columns'], indent=2)}
    
    Potential Driver Variables (what might influence outcomes):
    {json.dumps(data_analysis['potential_driver_columns'], indent=2)}
    """
    
    # Truncate data snippet if too long
    MAX_DATA_LENGTH = 10000
    if len(data_snippet) > MAX_DATA_LENGTH:
        data_snippet = data_snippet[:MAX_DATA_LENGTH] + "\n\n[Data truncated for analysis...]"
    
    prompt = f"""
    You are a highly skilled prescriptive analytics consultant. Your task is to analyze the business goal and dataset to recommend specific, data-driven actions.

    **BUSINESS GOAL:**
    {business_goal}

    **DATA CONTEXT:**
    {data_context}

    **DATA SAMPLE:**
    ```csv
    {data_snippet}
    ```

    **ANALYSIS REQUIREMENTS:**
    1. **Data Insights (3-5 insights):** Identify key patterns, correlations, or segments in the data that relate to the business goal.
    2. **Prescriptive Recommendations (3-4 recommendations):** Provide specific, actionable recommendations based on the data insights.
    3. **Implementation Roadmap:** For each recommendation, provide concrete next steps.

    **CRITICAL CONSTRAINTS:**
    - Base ALL insights and recommendations ONLY on the provided data
    - Ensure recommendations are specific and measurable
    - Link each recommendation clearly to a data insight
    - Provide realistic impact and effort estimates

    **RETURN FORMAT (JSON ONLY):**
    {{
      "main_goal": "{business_goal}",
      "data_insights": [
        {{
          "insight": "Specific finding from the data analysis",
          "implication": "Why this matters for achieving the business goal",
          "supporting_evidence": "Specific data points that support this insight"
        }}
      ],
      "prescriptions": [
        {{
          "recommendation": "Clear, specific action title",
          "rationale": "How this action addresses the business goal using the data insights",
          "impact": "High/Medium/Low",
          "effort": "High/Medium/Low",
          "action_items": ["Specific step 1", "Specific step 2", "Specific step 3"],
          "expected_outcome": "Measurable outcome linked to the business goal",
          "kpis_to_track": ["KPI 1", "KPI 2", "KPI 3"],
          "timeline": "Realistic timeline for implementation",
          "resources_needed": ["Resource 1", "Resource 2"]
        }}
      ],
      "implementation_priority": [
        {{
          "rank": 1,
          "recommendation": "Title of highest priority recommendation",
          "justification": "Why this should be implemented first"
        }}
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
                    "format": "json",
                    "options": {
                        "num_ctx": 32768,
                        "temperature": 0.7
                    }
                }
            )
            response.raise_for_status()
            
            data = response.json()
            if "response" not in data:
                raise Exception("Invalid response from Ollama (missing 'response' key)")
            
            parsed_data = json.loads(data["response"])
            
            # Validate required fields
            required_fields = ["main_goal", "data_insights", "prescriptions"]
            for field in required_fields:
                if field not in parsed_data:
                    raise Exception(f"Missing required field: {field}")
            
            if not isinstance(parsed_data["data_insights"], list) or len(parsed_data["data_insights"]) < 2:
                raise Exception("At least 2 data insights are required")
                
            if not isinstance(parsed_data["prescriptions"], list) or len(parsed_data["prescriptions"]) < 2:
                raise Exception("At least 2 prescriptions are required")
            
            # Validate prescription structure
            for prescription in parsed_data["prescriptions"]:
                required_prescription_fields = ["recommendation", "rationale", "impact", "effort", "action_items", "expected_outcome", "kpis_to_track"]
                for field in required_prescription_fields:
                    if field not in prescription:
                        raise Exception(f"Missing required prescription field: {field}")
                        
                if not isinstance(prescription["action_items"], list) or not isinstance(prescription["kpis_to_track"], list):
                    raise Exception("action_items and kpis_to_track must be lists")
            
            print(f"✅ Generated {len(parsed_data['data_insights'])} insights and {len(parsed_data['prescriptions'])} prescriptions")
            return parsed_data
            
    except json.JSONDecodeError as e:
        print(f"❌ JSON decode error: {e}")
        raise Exception(f"Invalid JSON response from LLM: {e}")
    except Exception as e:
        print(f"❌ Error generating prescriptive insights: {e}")
        raise Exception(f"Failed to generate prescriptive analysis: {e}")

# --- Risk Assessment ---
def assess_implementation_risks(prescriptions: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Calculates risk scores for generated prescriptions based on effort and impact.

    Applies heuristic logic to determine if a recommendation is Low, Medium, or High risk.
    Adds mitigation strategies and risk factors to the output.

    Args:
        prescriptions (List[Dict[str, Any]]): A list of prescription objects containing
            'effort' and 'impact' fields.

    Returns:
        List[Dict[str, Any]]: The prescriptions enriched with risk analysis, scores,
            and mitigation strategies.
    """
    print("⚠️ Assessing implementation risks...")
    
    risk_assessments = []
    
    for prescription in prescriptions:
        effort = prescription.get("effort", "Medium")
        impact = prescription.get("impact", "Medium")
        
        # Simple risk scoring based on effort and impact
        risk_score = 1  # Low risk
        risk_factors = []
        
        if effort == "High":
            risk_score += 1
            risk_factors.append("High implementation effort required")
            
        if impact == "Low":
            risk_score += 1
            risk_factors.append("Uncertain impact on business goal")
        
        if len(prescription.get("action_items", [])) > 5:
            risk_score += 1
            risk_factors.append("Complex implementation with many steps")
        
        # Determine risk level
        if risk_score <= 2:
            risk_level = "Low"
        elif risk_score == 3:
            risk_level = "Medium"
        else:
            risk_level = "High"
        
        risk_assessments.append({
            "recommendation": prescription["recommendation"],
            "risk_level": risk_level,
            "risk_score": risk_score,
            "risk_factors": risk_factors,
            "mitigation_suggestions": [
                "Start with a pilot program to test effectiveness",
                "Monitor KPIs closely during implementation",
                "Have rollback plan ready if results are not as expected"
            ]
        })
    
    return risk_assessments

# --- Main Prescriptive Analysis Function ---
async def perform_prescriptive_analysis(
    data_payload: Union[UploadFile, str],
    is_file_upload: bool,
    input_filename: str,
    business_goal: str,
    context_file: Optional[UploadFile] = None
) -> Dict[str, Any]:
    """Orchestrates the end-to-end prescriptive analysis workflow.

    1. Loads and cleans the dataframe.
    2. Loads optional business context.
    3. Analyzes data structure (columns, types, quality).
    4. Generates insights via LLM based on data samples.
    5. Assesses implementation risks for generated recommendations.
    6. Formats the final response for the frontend.

    Args:
        data_payload (Union[UploadFile, str]): The source data.
        is_file_upload (bool): True if source is a file.
        input_filename (str): Filename for format detection.
        business_goal (str): The target business objective.
        context_file (Optional[UploadFile], optional): Supplementary context file.

    Returns:
        Dict[str, Any]: The complete analysis result including insights, prescriptions,
            and risk assessments.
    
    Raises:
        HTTPException: Propagates errors encountered during loading or analysis.
    """
    print("🚀 Starting Prescriptive Analysis...")
    
    try:
        # 1. Load data
        df = await load_dataframe(data_payload, is_file_upload, input_filename)
        
        # 2. Load business context (if business_goal is from file)
        if not business_goal.strip() and context_file:
            business_goal = await load_business_context(context_file=context_file)
        
        if not business_goal.strip():
            raise HTTPException(status_code=400, detail="Business goal is required for prescriptive analysis")
        
        # 3. Analyze data structure
        data_analysis = analyze_data_structure(df)
        
        # 4. Prepare data snippet for LLM
        data_snippet = df.head(20).to_csv(index=False)  # First 20 rows
        
        # 5. Generate prescriptive insights using LLM
        prescriptive_results = await generate_prescriptive_insights(
            business_goal, 
            data_snippet, 
            data_analysis
        )
        
        # 6. Assess implementation risks
        risk_assessments = assess_implementation_risks(prescriptive_results["prescriptions"])
        
        # 7. Prepare final response
        response_data = {
            "business_goal": business_goal,
            "dataset_info": {
                "rows": len(df),
                "columns": len(df.columns),
                "data_quality": data_analysis["data_quality"],
                "column_analysis": {
                    "numerical_columns": len(data_analysis["numerical_columns"]),
                    "categorical_columns": len(data_analysis["categorical_columns"]),
                    "potential_outcomes": data_analysis["potential_outcome_columns"],
                    "potential_drivers": data_analysis["potential_driver_columns"]
                }
            },
            "data_insights": prescriptive_results["data_insights"],
            "prescriptions": prescriptive_results["prescriptions"],
            "implementation_priority": prescriptive_results.get("implementation_priority", []),
            "risk_assessment": risk_assessments,
            "metadata": {
                "analysis_timestamp": datetime.now().isoformat(),
                "input_filename": input_filename,
                "model_used": OLLAMA_MODEL,
                "total_insights": len(prescriptive_results["data_insights"]),
                "total_prescriptions": len(prescriptive_results["prescriptions"])
            }
        }
        
        # 8. Convert numpy types for JSON serialization
        response_data = convert_numpy_types(response_data)
        
        print(f"✅ Prescriptive analysis completed. Generated {len(prescriptive_results['data_insights'])} insights and {len(prescriptive_results['prescriptions'])} prescriptions.")
        return response_data
        
    except HTTPException as http_exc:
        print(f"❌ HTTP Exception in prescriptive analysis: {http_exc.detail}")
        raise http_exc
    except Exception as e:
        error_msg = f"❌ Unexpected error in prescriptive analysis: {type(e).__name__}: {str(e)}"
        print(f"{error_msg}\n{traceback.format_exc()}")
        
        # Return error response
        response_data = {
            "business_goal": business_goal if 'business_goal' in locals() else "Unknown",
            "dataset_info": {"error": str(e), "rows": 0, "columns": 0},
            "data_insights": [],
            "prescriptions": [],
            "implementation_priority": [],
            "risk_assessment": [],
            "metadata": {
                "error": True,
                "error_message": str(e),
                "analysis_timestamp": datetime.now().isoformat()
            }
        }
        return convert_numpy_types(response_data)