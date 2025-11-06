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

# --- Import save functions ---
# Assuming these exist and work as intended
# from save_modules import save_pdf, save_docx

app = FastAPI(docs_url="/")

# --- CORS ---
origins = [
    "https://data2int.com",       # Main domain
    "https://elijah.data2int.com",   # Dev domain
    "https://matthew.data2int.com", # Add other subdomains as needed
    "http://localhost:8080",       # For local testing
    "http://127.0.0.1:8080",      # For local testing
    "http://localhost:8000",       # For python -m http.server
    "http://127.0.0.1:8000",       # For python -m http.server
    "http://10.0.0.243:8000"       # From server log
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
    """
    Determines the data source (file or text) and returns
    (payload, filename, is_file_upload_flag).
    Raises HTTPException if no data is provided.
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
    """Safely closes an uploaded file if it exists."""
    if file and isinstance(file, UploadFile):
        try:
            await file.close()
            print(f"Closed uploaded file: {file.filename}")
        except Exception as close_err:
            # Log warning, but don't crash the request
            print(f"Warning: Could not close file {file.filename}. Error: {close_err}")

# --- Analysis Endpoints ---

@app.post("/api/sem")
async def run_sem_analysis(
    data_file: Optional[UploadFile] = File(None),
    data_text: Optional[str] = Form(None),
    measurement_syntax: Optional[str] = Form(None),
    structural_syntax: Optional[str] = Form(None)
):
    """Runs Structural Equation Modeling (SEM) analysis."""
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
            structural_syntax=structural_syntax or ""
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
    """Runs Predictive (forecasting) analysis."""
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
    dematel_factors: str = Form(...), # JSON string list
    dematel_matrix: str = Form(...)  # JSON string 2D list
):
    """Runs DEMATEL analysis (no data file required)."""
    try:
        # 1. Validate and convert DEMATEL parameters
        try:
            factors_list = json.loads(dematel_factors)
            matrix_list = json.loads(dematel_matrix)
        except json.JSONDecodeError:
            raise HTTPException(status_code=400, detail="Invalid JSON format for DEMATEL factors or matrix.")
        
        # 2. Run analysis
        print(f"Routing to DEMATEL Analysis with {len(factors_list)} factors...")
        results = await dematel_analysis.perform_dematel(
            factors=factors_list,
            direct_matrix=matrix_list
        )
        return JSONResponse(content=results)

    except HTTPException as http_exc:
        print(f"HTTP Exception in DEMATEL: {http_exc.status_code} - {http_exc.detail}")
        raise http_exc
    except Exception as e:
        print(f"Error during DEMATEL analysis: {type(e).__name__} - {e}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"An internal server error occurred: {str(e)}")
    # No 'finally' block needed as no files are uploaded


@app.post("/api/descriptive")
async def run_descriptive_analysis(
    data_file: Optional[UploadFile] = File(None),
    data_text: Optional[str] = Form(None),
    context_file: Optional[UploadFile] = File(None),
    descriptive_analysis_types: Optional[str] = Form(None) # JSON string list
):
    """Runs Descriptive analysis."""
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
    """Runs Visualization analysis and suggestions."""
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


# Add this to your main.py file after the other analysis imports

# --- Import regression analysis function ---
from analysis_modules import regression_analysis

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
    """Runs Regression analysis."""
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
    """
    Generates a PDF or DOCX file from a JSON object of analysis results.
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
    """Returns the API status."""
    return {"status": "Analysis API is running"}

if __name__ == '__main__':
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)