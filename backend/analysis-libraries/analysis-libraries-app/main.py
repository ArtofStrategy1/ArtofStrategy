# main.py
import io
import pandas as pd
import traceback
import json
from typing import Optional, Tuple, List, Dict, Any, Union

from fastapi import FastAPI, Form, File, UploadFile, HTTPException
from starlette.responses import JSONResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware

# --- Import analysis functions ---
from analysis_modules import sem_analysis
from analysis_modules import predictive_analysis
from analysis_modules import dematel_analysis
from analysis_modules import descriptive_analysis
from analysis_modules import visualization_analysis
from analysis_modules import pls_analysis
from analysis_modules import prescriptive_analysis
# --- Import save functions ---
# Assuming these exist and work as intended
# from save_modules import save_pdf, save_docx

# --- Import regression analysis function ---
from analysis_modules import regression_analysis

app = FastAPI(docs_url="/")

# --- CORS ---
origins = [
    "https://data2int.com",       # Main domain
    "https://elijah.data2int.com",   # Dev domain
    "https://matthew.data2int.com", # Dev domain
    "http://localhost:8080",       # For local testing
    "http://127.0.0.1:8080",      # For local testing
    "http://localhost:8000",       # For python -m http.server
    "http://10.0.0.243:8000",       # From server log
    ## New sageaios.com ##
    "https://sageaios.com",       # Main domain
    "https://elijah.sageaios.com",   # Dev domain
    "https://matthew.sageaios.com", # Dev domain
    "https://khaled.sageaios.com"   
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Helper Functions ---

def get_data_payload(
    data_file: Optional[UploadFile], 
    data_text: Optional[str]
) -> Tuple[Union[UploadFile, str], str, bool]:
    """Determines the data source (file upload or raw text) and validates the input.

    Checks if a file was uploaded or if text was pasted. If a file is provided,
    it validates the extension (.csv, .xlsx, .xls).

    Args:
        data_file (Optional[UploadFile]): The file object uploaded by the user.
        data_text (Optional[str]): Raw CSV/JSON text pasted by the user.

    Returns:
        Tuple[Union[UploadFile, str], str, bool]: A tuple containing:
            - The data payload (File object or string).
            - The filename (or "pasted_data").
            - A boolean flag (True if file upload, False if text).

    Raises:
        HTTPException(400): If the file type is invalid or if no data is provided.
    """
    if data_file:
        filename = data_file.filename or "unknown"
        print(f"Processing uploaded file: {filename}")
        # Validate file type for analysis
        filename_lower = filename.lower()
        if not filename_lower.endswith(('.csv', '.xlsx', '.xls')):
            raise HTTPException(status_code=400, detail="Invalid data file type. Please upload a CSV or Excel file.")
        return data_file, filename, True
    elif data_text:
        print(f"Processing pasted text data.")
        return data_text, "pasted_data", False
    else:
        # This error is raised if neither file nor text is provided
        raise HTTPException(status_code=400, detail="No data provided. Please either upload a file or paste text data.")

async def safe_close_file(file: Optional[UploadFile]):
    """Safely closes an uploaded file stream if it exists.
    
    Attempting to close a file that is already closed or None usually raises
    an error; this function handles that gracefully to prevent server crashes.

    Args:
        file (Optional[UploadFile]): The file object to close.
    """
    if file and isinstance(file, UploadFile):
        try:
            await file.close()
            print(f"Closed uploaded file: {file.filename}")
        except Exception as close_err:
            # Log warning, but don't crash the request
            print(f"Warning: Could not close file {file.filename}. Error: {close_err}")

# --- Analysis Endpoints ---
@app.post("/api/prescriptive")
async def run_prescriptive_analysis(
    data_file: Optional[UploadFile] = File(None),
    data_text: Optional[str] = Form(None),
    business_goal: str = Form(...),
    context_file: Optional[UploadFile] = File(None)
):
    """Runs Prescriptive Analysis to generate actionable recommendations based on business goals.

    Takes a dataset and a specific business goal (e.g., "Increase retention") and
    uses the prescriptive engine to determine optimal actions.

    Args:
        data_file (Optional[UploadFile]): The source dataset (CSV/Excel).
        data_text (Optional[str]): The source dataset as raw text.
        business_goal (str): The specific outcome the user wants to achieve.
        context_file (Optional[UploadFile]): Additional context document (PDF/Doc) to aid analysis.

    Returns:
        JSONResponse: A JSON object containing the analysis results and recommendations.

    Raises:
        HTTPException(400): If the business goal is missing.
        HTTPException(500): If an internal processing error occurs.
    """
    try:
        # 1. Get data
        data_payload, input_filename, is_file_upload = get_data_payload(data_file, data_text)

        # 2. Validate business goal
        if not business_goal or not business_goal.strip():
            raise HTTPException(status_code=400, detail="Business goal is required for prescriptive analysis.")

        # 3. Run analysis
        print(f"Routing to Prescriptive Analysis...")
        print(f"   Business goal: {business_goal[:100]}...")  # Show first 100 chars
        
        results = await prescriptive_analysis.perform_prescriptive_analysis(
            data_payload=data_payload,
            is_file_upload=is_file_upload,
            input_filename=input_filename,
            business_goal=business_goal,
            context_file=context_file
        )
        return JSONResponse(content=results)

    except HTTPException as http_exc:
        print(f"HTTP Exception in Prescriptive: {http_exc.status_code} - {http_exc.detail}")
        raise http_exc
    except Exception as e:
        print(f"Error during Prescriptive analysis: {type(e).__name__} - {e}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"An internal server error occurred: {str(e)}")
    finally:
        # Ensure uploaded file streams are closed
        await safe_close_file(data_file)
        await safe_close_file(context_file)


@app.post("/api/pls")
async def run_pls_analysis(
    data_file: Optional[UploadFile] = File(None),
    data_text: Optional[str] = Form(None),
    measurement_syntax: Optional[str] = Form(None),
    structural_syntax: Optional[str] = Form(None)
):
    """Runs Partial Least Squares Structural Equation Modeling (PLS-SEM) analysis.

    Processes the data using the provided measurement (outer model) and 
    structural (inner model) syntax.

    Args:
        data_file (Optional[UploadFile]): The source dataset (CSV/Excel).
        data_text (Optional[str]): The source dataset as raw text.
        measurement_syntax (Optional[str]): Syntax defining the latent variables and indicators.
        structural_syntax (Optional[str]): Syntax defining relationships between latent variables.

    Returns:
        JSONResponse: The PLS-SEM path coefficients, R-squared values, and validity metrics.

    Raises:
        HTTPException(400): If neither measurement nor structural syntax is provided.
        HTTPException(500): If the analysis engine fails.
    """
    try:
        # 1. Get data (uses your existing helper)
        data_payload, input_filename, is_file_upload = get_data_payload(data_file, data_text)

        # 2. Validate PLS-SEM-specific parameters (copied from SEM)
        if not measurement_syntax and not structural_syntax:
            raise HTTPException(status_code=400, detail="PLS-SEM requires at least Measurement Syntax or Structural Syntax.")

        # 3. Run analysis
        print(f"Routing to PLS-SEM Analysis...")
        
        # This now calls the new 'perform_pls_sem' function 
        # which we will create in 'pls_analysis.py'
        results = await pls_analysis.perform_pls_sem( 
            data_payload=data_payload,
            is_file_upload=is_file_upload,
            input_filename=input_filename,
            measurement_syntax=measurement_syntax or "",
            structural_syntax=structural_syntax or ""
        )
        return JSONResponse(content=results)

    except HTTPException as http_exc:
        print(f"HTTP Exception in PLS-SEM: {http_exc.status_code} - {http_exc.detail}")
        raise http_exc
    except Exception as e:
        print(f"Error during PLS-SEM analysis: {type(e).__name__} - {e}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"An internal server error occurred: {str(e)}")
    finally:
        # Ensure uploaded file stream is closed (copied from SEM)
        await safe_close_file(data_file)

@app.post("/api/sem")
async def run_sem_analysis(
    data_file: Optional[UploadFile] = File(None),
    data_text: Optional[str] = Form(None),
    measurement_syntax: Optional[str] = Form(None),
    structural_syntax: Optional[str] = Form(None),
    context_text: Optional[str] = Form("")  # <--- NEW FIELD
):
    """Runs Covariance-Based Structural Equation Modeling (CB-SEM) analysis.

    Uses the 'lavaan' or 'semopy' syntax to model relationships between observed
    and latent variables.

    Args:
        data_file (Optional[UploadFile]): The source dataset.
        data_text (Optional[str]): The source dataset as text.
        measurement_syntax (Optional[str]): Syntax defining latent variable mappings.
        structural_syntax (Optional[str]): Syntax defining regressions between variables.
        context_text (Optional[str]): Optional text context to help interpret results.

    Returns:
        JSONResponse: Model fit indices (CFI, RMSEA), coefficients, and p-values.

    Raises:
        HTTPException(400): If syntax is missing.
        HTTPException(500): If the SEM solver fails (e.g., non-convergence).
    """
    try:
        # 1. Get data
        data_payload, input_filename, is_file_upload = get_data_payload(data_file, data_text)

        # 2. Validate SEM-specific parameters
        if not measurement_syntax and not structural_syntax:
            raise HTTPException(status_code=400, detail="SEM requires at least Measurement Syntax or Structural Syntax.")

        # 3. Run analysis
        print(f"Routing to SEM Analysis...")
        results = await sem_analysis.perform_sem(
            data_payload=data_payload,
            is_file_upload=is_file_upload,
            input_filename=input_filename,
            measurement_syntax=measurement_syntax or "",
            structural_syntax=structural_syntax or "",
            context_text=context_text  # <--- PASS TO MODULE
        )
        return JSONResponse(content=results)

    except HTTPException as http_exc:
        print(f"HTTP Exception in SEM: {http_exc.status_code} - {http_exc.detail}")
        raise http_exc
    except Exception as e:
        print(f"Error during SEM analysis: {type(e).__name__} - {e}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"An internal server error occurred: {str(e)}")
    finally:
        # Ensure uploaded file stream is closed
        await safe_close_file(data_file)


@app.post("/api/predictive")
async def run_predictive_analysis(
    data_file: Optional[UploadFile] = File(None),
    data_text: Optional[str] = Form(None),
    dateColumn: str = Form(...),
    targetColumn: str = Form(...),
    forecastPeriods: Optional[str] = Form(None),
    confidenceLevel: Optional[str] = Form(None),
    modelType: Optional[str] = Form(None)
):
    """Runs time-series forecasting (Predictive Analysis) on the provided dataset.

    Generates future predictions based on historical data using the specified
    date and target columns.

    Args:
        data_file (Optional[UploadFile]): The source dataset.
        data_text (Optional[str]): The source dataset as text.
        dateColumn (str): The column name containing datetime values.
        targetColumn (str): The column name containing the values to forecast.
        forecastPeriods (Optional[str]): Number of future periods to predict (default: 12).
        confidenceLevel (Optional[str]): Statistical confidence level, e.g., 0.95 (default: 0.90).
        modelType (Optional[str]): Specific algorithm to use (default: 'auto').

    Returns:
        JSONResponse: Forecasted data points, confidence intervals, and trend analysis.

    Raises:
        HTTPException(400): If parameters (periods, confidence) are malformed or out of range.
        HTTPException(500): If the forecasting model fails.
    """
    try:
        # 1. Get data
        data_payload, input_filename, is_file_upload = get_data_payload(data_file, data_text)

        # 2. Validate and convert predictive parameters
        try:
            periods = int(forecastPeriods) if forecastPeriods else 12 # Default 12
        except (ValueError, TypeError):
            raise HTTPException(status_code=400, detail="Invalid format for Forecast Periods (must be an integer).")
        
        try:
            level = float(confidenceLevel) if confidenceLevel else 0.90 # Default 0.90
            if not (0 < level < 1):
                raise ValueError("Confidence level must be between 0 and 1 (exclusive).")
        except (ValueError, TypeError):
            raise HTTPException(status_code=400, detail="Invalid format for Confidence Level (e.g., use 0.95 for 95%).")

        model = modelType if modelType else "auto" # Default 'auto'

        # 3. Run analysis
        print(f"Routing to Predictive Analysis...")
        results = await predictive_analysis.perform_prediction(
            data_payload=data_payload,
            is_file_upload=is_file_upload,
            input_filename=input_filename,
            date_column=dateColumn,
            target_column=targetColumn,
            forecast_periods=periods,
            confidence_level=level,
            model_type=model
        )
        return JSONResponse(content=results)

    except HTTPException as http_exc:
        print(f"HTTP Exception in Predictive: {http_exc.status_code} - {http_exc.detail}")
        raise http_exc
    except Exception as e:
        print(f"Error during Predictive analysis: {type(e).__name__} - {e}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"An internal server error occurred: {str(e)}")
    finally:
        # Ensure uploaded file stream is closed
        await safe_close_file(data_file)


@app.post("/api/dematel")
async def run_dematel_analysis(
    analysis_type: str = Form("dematel"),  # Default to matrix analysis for backward compatibility
    # For text processing (NEW)
    user_text: str = Form(None),
    # For direct matrix input (EXISTING)
    dematel_factors: str = Form(None),
    dematel_matrix: str = Form(None)
):
    """
    Runs DEMATEL (Decision Making Trial and Evaluation Laboratory) analysis.
    
    Supports two modes:
    1. Text Analysis: Analyzes user-provided text to extract factors and relationships automatically via AI
    2. Matrix Analysis: Analyzes cause-and-effect relationships based on pre-defined factors and matrix
    
    Args:
        analysis_type (str): Either "dematel_from_text" or "dematel" (default).
        user_text (str): Raw text for AI analysis (required for text mode).
        dematel_factors (str): JSON string representation of the list of factors (required for matrix mode).
        dematel_matrix (str): JSON string representation of the 2D influence matrix (required for matrix mode).
    
    Returns:
        JSONResponse: The Prominence and Relation values, classifying factors as cause or effect,
                     plus diagnostics and visualizations.
    
    Raises:
        HTTPException(400): If the input parameters are missing or malformed.
        HTTPException(500): If AI processing or matrix calculation fails.
    """
    try:
        if analysis_type == "dematel_from_text":
            # NEW: Process text through Ollama in backend
            if not user_text:
                raise HTTPException(
                    status_code=400, 
                    detail="user_text is required for text analysis mode"
                )
            
            print(f"🔍 Processing DEMATEL from text (length: {len(user_text)})")
            results = await dematel_analysis.perform_dematel_from_text(user_text)
            
        elif analysis_type == "dematel":
            # EXISTING: Process factors and matrix directly
            if not dematel_factors or not dematel_matrix:
                raise HTTPException(
                    status_code=400, 
                    detail="dematel_factors and dematel_matrix are required for matrix analysis mode"
                )
            
            # Validate and convert DEMATEL parameters
            try:
                factors_list = json.loads(dematel_factors)
                matrix_list = json.loads(dematel_matrix)
            except json.JSONDecodeError as json_err:
                raise HTTPException(
                    status_code=400, 
                    detail=f"Invalid JSON format for DEMATEL factors or matrix: {str(json_err)}"
                )
            
            print(f"🔢 Processing DEMATEL from factors/matrix ({len(factors_list)} factors)")
            results = await dematel_analysis.perform_dematel(
                factors=factors_list,
                direct_matrix=matrix_list
            )
            
        else:
            raise HTTPException(
                status_code=400, 
                detail=f"Unknown analysis_type: '{analysis_type}'. Use 'dematel_from_text' or 'dematel'."
            )
        
        return JSONResponse(content=results)
        
    except HTTPException as http_exc:
        print(f"HTTP Exception in DEMATEL: {http_exc.status_code} - {http_exc.detail}")
        raise http_exc
    except Exception as e:
        print(f"Error during DEMATEL analysis: {type(e).__name__} - {e}")
        print(traceback.format_exc())
        raise HTTPException(
            status_code=500, 
            detail=f"An internal server error occurred during DEMATEL analysis: {str(e)}"
        )

@app.post("/api/descriptive")
async def run_descriptive_analysis(
    data_file: Optional[UploadFile] = File(None),
    data_text: Optional[str] = Form(None),
    context_file: Optional[UploadFile] = File(None),
    descriptive_analysis_types: Optional[str] = Form(None) # JSON string list
):
    """Runs Descriptive Analysis (Summary Statistics).

    Calculates mean, median, mode, standard deviation, and other statistical
    descriptions for the provided dataset.

    Args:
        data_file (Optional[UploadFile]): The source dataset.
        data_text (Optional[str]): The source dataset as text.
        context_file (Optional[UploadFile]): Optional file providing extra context.
        descriptive_analysis_types (Optional[str]): JSON string list of specific stats to run (e.g., ["mean", "correlation"]).

    Returns:
        JSONResponse: A dictionary of calculated statistics.

    Raises:
        HTTPException(400): If analysis_types JSON is malformed.
        HTTPException(500): If data processing fails.
    """
    try:
        # 1. Get data
        data_payload, input_filename, is_file_upload = get_data_payload(data_file, data_text)

        # 2. Parse analysis types (optional parameter)
        analysis_types_list = None
        if descriptive_analysis_types:
            try:
                analysis_types_list = json.loads(descriptive_analysis_types)
            except json.JSONDecodeError:
                raise HTTPException(status_code=400, detail="Invalid JSON format for analysis types.")
        
        # 3. Run analysis
        print(f"Routing to Descriptive Analysis...")
        print(f"   Analysis types requested: {analysis_types_list or 'all (default)'}")
        
        results = await descriptive_analysis.perform_descriptive_analysis(
            data_payload=data_payload,
            is_file_upload=is_file_upload,
            input_filename=input_filename,
            context_file=context_file,
            analysis_types=analysis_types_list
        )
        return JSONResponse(content=results)

    except HTTPException as http_exc:
        print(f"HTTP Exception in Descriptive: {http_exc.status_code} - {http_exc.detail}")
        raise http_exc
    except Exception as e:
        print(f"Error during Descriptive analysis: {type(e).__name__} - {e}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"An internal server error occurred: {str(e)}")
    finally:
        # Ensure *both* uploaded file streams are closed
        await safe_close_file(data_file)
        await safe_close_file(context_file)


@app.post("/api/visualization")
async def run_visualization_analysis(
    data_file: Optional[UploadFile] = File(None),
    data_text: Optional[str] = Form(None),
    context_file: Optional[UploadFile] = File(None),
    chart_configs: Optional[str] = Form(None) # JSON string with chart configurations
):
    """Generates charts and visualizations based on the dataset.

    Can automatically suggest charts or build specific charts based on the
    provided configuration.

    Args:
        data_file (Optional[UploadFile]): The source dataset.
        data_text (Optional[str]): The source dataset as text.
        context_file (Optional[UploadFile]): Optional context file.
        chart_configs (Optional[str]): JSON string defining chart types and axes.

    Returns:
        JSONResponse: Plotly JSON configuration or image data for the generated charts.

    Raises:
        HTTPException(400): If chart_configs JSON is malformed.
        HTTPException(500): If visualization generation fails.
    """
    try:
        # 1. Get data
        data_payload, input_filename, is_file_upload = get_data_payload(data_file, data_text)

        # 2. Parse chart configurations (optional parameter)
        chart_configs_list = None
        if chart_configs:
            try:
                chart_configs_list = json.loads(chart_configs)
            except json.JSONDecodeError:
                raise HTTPException(status_code=400, detail="Invalid JSON format for chart configurations.")
        
        # 3. Run analysis
        print(f"Routing to Visualization Analysis...")
        print(f"   Chart configs: {chart_configs_list or 'auto-generate suggestions'}")
        
        results = await visualization_analysis.perform_visualization_analysis(
            data_payload=data_payload,
            is_file_upload=is_file_upload,
            input_filename=input_filename,
            context_file=context_file,
            chart_configs=chart_configs_list
        )
        return JSONResponse(content=results)

    except HTTPException as http_exc:
        print(f"HTTP Exception in Visualization: {http_exc.status_code} - {http_exc.detail}")
        raise http_exc
    except Exception as e:
        print(f"Error during Visualization analysis: {type(e).__name__} - {e}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"An internal server error occurred: {str(e)}")
    finally:
        # Ensure *both* uploaded file streams are closed
        await safe_close_file(data_file)
        await safe_close_file(context_file)


# --- Add this endpoint after your other analysis endpoints ---

@app.post("/api/regression")
async def run_regression_analysis(
    data_file: Optional[UploadFile] = File(None),
    data_text: Optional[str] = Form(None),
    target_column: str = Form(...),
    feature_columns: Optional[str] = Form(None),  # JSON string list
    model_types: Optional[str] = Form(None),      # JSON string list
    test_size: Optional[str] = Form(None),        # Float as string
    context_file: Optional[UploadFile] = File(None)
):
    """Runs standard Regression Analysis to predict a continuous target variable.

    Supports multiple model types (Linear, Ridge, Lasso, RandomForest, etc.)
    and allows configuration of train/test splits.

    Args:
        data_file (Optional[UploadFile]): The source dataset.
        data_text (Optional[str]): The source dataset as text.
        target_column (str): The name of the dependent variable column.
        feature_columns (Optional[str]): JSON list of independent variable columns.
        model_types (Optional[str]): JSON list of algorithms to test (e.g., ["linear", "random_forest"]).
        test_size (Optional[str]): String representation of float (0.1 to 0.5) for the test split.
        context_file (Optional[UploadFile]): Optional context file.

    Returns:
        JSONResponse: Regression metrics (R2, MSE) and model coefficients.

    Raises:
        HTTPException(400): If JSON parsing fails, invalid model types are requested, or test size is out of bounds.
        HTTPException(500): If regression fitting fails.
    """
    try:
        # 1. Get data
        data_payload, input_filename, is_file_upload = get_data_payload(data_file, data_text)

        # 2. Validate and convert regression parameters
        # Parse feature columns
        parsed_feature_columns = None
        if feature_columns:
            try:
                parsed_feature_columns = json.loads(feature_columns)
                if not isinstance(parsed_feature_columns, list):
                    raise ValueError("Feature columns must be a list")
            except json.JSONDecodeError:
                raise HTTPException(status_code=400, detail="Invalid JSON format for feature columns.")

        # Parse model types
        parsed_model_types = None
        if model_types:
            try:
                parsed_model_types = json.loads(model_types)
                if not isinstance(parsed_model_types, list):
                    raise ValueError("Model types must be a list")
                # Validate model types
                valid_models = ['linear', 'ridge', 'lasso', 'elastic_net', 'random_forest', 'gradient_boosting']
                for model in parsed_model_types:
                    if model not in valid_models:
                        raise ValueError(f"Invalid model type: {model}. Valid options: {valid_models}")
            except json.JSONDecodeError:
                raise HTTPException(status_code=400, detail="Invalid JSON format for model types.")

        # Parse test size
        parsed_test_size = 0.2  # Default
        if test_size:
            try:
                parsed_test_size = float(test_size)
                if not (0.1 <= parsed_test_size <= 0.5):
                    raise ValueError("Test size must be between 0.1 and 0.5")
            except (ValueError, TypeError):
                raise HTTPException(status_code=400, detail="Invalid test size. Must be a number between 0.1 and 0.5 (e.g., 0.2 for 20%).")

        # 3. Run analysis
        print(f"Routing to Regression Analysis...")
        print(f"   Target column: {target_column}")
        print(f"   Feature columns: {parsed_feature_columns or 'auto-detect'}")
        print(f"   Model types: {parsed_model_types or 'default models'}")
        print(f"   Test size: {parsed_test_size}")
        
        results = await regression_analysis.perform_regression_analysis(
            data_payload=data_payload,
            is_file_upload=is_file_upload,
            input_filename=input_filename,
            target_column=target_column,
            feature_columns=parsed_feature_columns,
            model_types=parsed_model_types,
            test_size=parsed_test_size,
            context_file=context_file
        )
        return JSONResponse(content=results)

    except HTTPException as http_exc:
        print(f"HTTP Exception in Regression: {http_exc.status_code} - {http_exc.detail}")
        raise http_exc
    except Exception as e:
        print(f"Error during Regression analysis: {type(e).__name__} - {e}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"An internal server error occurred: {str(e)}")
    finally:
        # Ensure uploaded file streams are closed
        await safe_close_file(data_file)
        await safe_close_file(context_file)

# Currently being worked on.
# --- Save Document Endpoint ---
@app.post("/api/export")
async def export_analysis_report(
    format: str = Form(...),
    analysis_data_json: str = Form(...) # We'll receive the results JSON as a string
):
    """Exports the analysis results into a downloadable document (PDF or DOCX).
    
    Current implementation is partial; raises 501 Not Implemented for actual export logic
    until the save modules are fully integrated.

    Args:
        format (str): The desired file format ('pdf' or 'docx').
        analysis_data_json (str): The analysis results (as a JSON string) to include in the report.

    Returns:
        StreamingResponse: The downloadable file stream.

    Raises:
        HTTPException(400): If the JSON data is invalid or the format is not supported.
        HTTPException(501): If the requested export format is not yet implemented.
        HTTPException(500): If file generation fails.
    """
    try:
        # Parse the JSON string sent from the frontend
        analysis_data = json.loads(analysis_data_json)
        
        if not analysis_data:
            raise HTTPException(status_code=400, detail="No analysis data provided.")

        if format == "pdf":
            # Call your new PDF module
            # pdf_bytes = save_pdf.create_pdf_report(analysis_data)
            # 
            # return StreamingResponse(
            #     io.BytesIO(pdf_bytes),
            #     media_type="application/pdf",
            #     headers={"Content-Disposition": "attachment; filename=SAGE_Analysis.pdf"}
            # )
            raise HTTPException(status_code=501, detail="PDF export not yet implemented.")
            
        elif format == "docx":
            # Call your new DOCX module
            # docx_bytes = save_docx.create_docx_report(analysis_data)
            # 
            # return StreamingResponse(
            #     io.BytesIO(docx_bytes),
            #     media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            #     headers={"Content-Disposition": "attachment; filename=SAGE_Analysis.docx"}
            # )
            raise HTTPException(status_code=501, detail="DOCX export not yet implemented.")
            
        else:
            raise HTTPException(status_code=400, detail="Invalid format. Must be 'pdf' or 'docx'.")

    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON data provided.")
    except Exception as e:
        print(f"Error during file export: {e}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"An internal server error occurred: {str(e)}")

# --- Status Endpoint ---
@app.get("/status")
def read_root():
    """Checks the health of the API.

    Returns:
        dict: A status message indicating the API is running.
    """
    return {"status": "Analysis API is running"}

if __name__ == '__main__':
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)