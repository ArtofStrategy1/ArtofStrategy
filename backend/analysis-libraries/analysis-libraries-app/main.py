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
# Make sure predictive_analysis is importable
from analysis_modules import predictive_analysis # ADDED IMPORT

# --- Import save functions ---
# Assuming these exist and work as intended
# from save_modules import save_pdf, save_docx

app = FastAPI(docs_url="/")

# --- CORS ---
# (Keep your existing CORS configuration)
origins = [
    "https://data2int.com",    # Main domain
    "https://elijah.data2int.com",  # Dev domain
    "http://localhost:8080",       # For local testing
    "http://127.0.0.1:8080",        # For local testing
    "http://localhost:8000",       # For python -m http.server
    "http://127.0.0.1:8000",        # For python -m http.server
    "http://10.0.0.243:8000"        # From server log
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/api/data-analysis")
async def run_analysis_router(
    analysis_type: str = Form(...),
    # Common data inputs
    data_file: Optional[UploadFile] = File(None),
    data_text: Optional[str] = Form(None),
    # SEM specific inputs
    measurement_syntax: Optional[str] = Form(None),
    structural_syntax: Optional[str] = Form(None),
    # --- Predictive Analysis specific inputs ---
    # These names match the keys sent from the JS generatePredictiveAnalysis function
    dateColumn: Optional[str] = Form(None), # Matches JS key
    targetColumn: Optional[str] = Form(None), # Matches JS key
    forecastPeriods: Optional[str] = Form(None), # Matches JS key, received as string
    confidenceLevel: Optional[str] = Form(None), # Matches JS key, received as string
    modelType: Optional[str] = Form(None) # Matches JS key
):
    """
    Routes analysis requests based on analysis_type.
    Handles data input (file or text) and specific parameters for each type.
    """
    data_payload: Union[UploadFile, str, None] = None
    input_filename: str = "unknown"
    is_file_upload: bool = False

    try:
        # --- Determine data source ---
        if data_file:
            # Basic validation (can be more robust)
            filename_lower = data_file.filename.lower()
            # Allow common extensions
            if not filename_lower.endswith(('.csv', '.xlsx', '.xls')):
                raise HTTPException(status_code=400, detail="Invalid file type. Please upload a CSV or Excel file.")
            data_payload = data_file
            input_filename = data_file.filename
            is_file_upload = True
            print(f"Processing uploaded file: {input_filename}")
        elif data_text:
            data_payload = data_text
            input_filename = "pasted_data.csv" # Assign a default name
            is_file_upload = False
            print(f"Processing pasted text data.")
        else:
            # Raise error only if the specific analysis type *requires* data
            if analysis_type in ["sem", "predictive"]: # Add other types needing data
                 raise HTTPException(status_code=400, detail="No data provided. Please either upload a file or paste text data.")
            # Allow analysis types that might not need data (if any)

        # --- Route based on analysis_type ---
        if analysis_type == "sem":
            if not measurement_syntax and not structural_syntax:
                raise HTTPException(status_code=400, detail="SEM requires at least Measurement Syntax or Structural Syntax.")
            if not data_payload: # SEM requires data
                raise HTTPException(status_code=400, detail="SEM requires data (file or text).")

            print(f"Routing to SEM Analysis...")
            results = await sem_analysis.perform_sem(
                data_payload=data_payload,
                is_file_upload=is_file_upload,
                input_filename=input_filename,
                measurement_syntax=measurement_syntax or "",
                structural_syntax=structural_syntax or ""
            )
            return JSONResponse(content=results)

        # --- PREDICTIVE ANALYSIS ROUTE ---
        elif analysis_type == "predictive":
            if not data_payload: # Predictive requires data
                raise HTTPException(status_code=400, detail="Predictive analysis requires data (file or text).")
            if not dateColumn:
                raise HTTPException(status_code=400, detail="Predictive analysis requires a date column selection.")
            if not targetColumn:
                raise HTTPException(status_code=400, detail="Predictive analysis requires a target column selection.")

            # Safely convert string parameters from Form to expected types
            try:
                periods = int(forecastPeriods) if forecastPeriods else 12 # Default 12
            except (ValueError, TypeError):
                raise HTTPException(status_code=400, detail="Invalid format for Forecast Periods (must be an integer).")

            try:
                # Ensure confidence level is treated as float between 0 and 1
                level = float(confidenceLevel) if confidenceLevel else 0.90 # Default 0.90
                if not (0 < level < 1):
                    raise ValueError("Confidence level must be between 0 and 1 (exclusive).")
            except (ValueError, TypeError):
                raise HTTPException(status_code=400, detail="Invalid format for Confidence Level (e.g., use 0.95 for 95%).")

            # Use model type directly, provide default if missing
            model = modelType if modelType else "auto" # Default 'auto'

            print(f"Routing to Predictive Analysis...")
            print(f"  Date Column: {dateColumn}")
            print(f"  Target Column: {targetColumn}")
            print(f"  Periods: {periods}")
            print(f"  Confidence: {level}")
            print(f"  Model Type: {model}")

            # Call the predictive analysis function with validated parameters
            # Using Pythonic names for parameters passed to the function
            results = await predictive_analysis.perform_prediction(
                data_payload=data_payload,
                is_file_upload=is_file_upload,
                input_filename=input_filename,
                date_column=dateColumn, # Pass the original string name
                target_column=targetColumn, # Pass the original string name
                forecast_periods=periods, # Pass the converted integer
                confidence_level=level, # Pass the converted float
                model_type=model # Pass the string
            )
            return JSONResponse(content=results)

        # --- Add other analysis types here ---
        # elif analysis_type == "some_other_analysis":
        #     results = await some_other_module.run(...)
        #     return JSONResponse(content=results)

        else:
            raise HTTPException(status_code=400, detail=f"Unsupported analysis_type: {analysis_type}")

    except HTTPException as http_exc:
        # Re-raise HTTP exceptions directly
        print(f"HTTP Exception: {http_exc.status_code} - {http_exc.detail}")
        raise http_exc
    except Exception as e:
        # Catch any other unexpected errors
        print(f"Error during {analysis_type} analysis: {type(e).__name__} - {e}")
        print(traceback.format_exc()) # Log the full traceback for debugging
        raise HTTPException(status_code=500, detail=f"An internal server error occurred: {str(e)}")
    finally:
        # Ensure uploaded file stream is closed
        if is_file_upload and isinstance(data_payload, UploadFile):
            try:
                await data_payload.close()
                print(f"Closed uploaded file: {input_filename}")
            except Exception as close_err:
                print(f"Warning: Could not close file {input_filename}. Error: {close_err}")
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
            pdf_bytes = save_pdf.create_pdf_report(analysis_data)
            
            return StreamingResponse(
                io.BytesIO(pdf_bytes),
                media_type="application/pdf",
                headers={"Content-Disposition": "attachment; filename=SAGE_Analysis.pdf"}
            )
            
        elif format == "docx":
            # Call your new DOCX module
            docx_bytes = save_docx.create_docx_report(analysis_data)
            
            return StreamingResponse(
                io.BytesIO(docx_bytes),
                media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                headers={"Content-Disposition": "attachment; filename=SAGE_Analysis.docx"}
            )
            
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