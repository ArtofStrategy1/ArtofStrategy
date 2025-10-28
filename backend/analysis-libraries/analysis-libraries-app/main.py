# main.py
import io
import pandas as pd
import traceback
import re
import json
from typing import Optional, Tuple, List, Dict, Any, Union

from fastapi import FastAPI, Form, File, UploadFile, HTTPException
from starlette.responses import JSONResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware

# --- Import analysis functions ---
from analysis_modules import sem_analysis
from analysis_modules import predictive_analysis

# --- Import save functions ---
from save_modules import save_pdf, save_docx

app = FastAPI(docs_url="/")

# --- CORS ---
origins = [
    "https://data2int.com",    # Main domain
    "https://elijah.data2int.com",  # Dev domain
    "http://localhost:8080",       # For local testing
    "http://127.0.0.1:8080",       # For local testing
    "http://localhost:8000",       # For python -m http.server
    "http://127.0.0.1:8000",       # For python -m http.server
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
    data_file: Optional[UploadFile] = File(None),
    data_text: Optional[str] = Form(None),
    measurement_syntax: Optional[str] = Form(None),
    structural_syntax: Optional[str] = Form(None),
    # Predictive analysis parameters
    date_column: Optional[str] = Form(None),
    metric_column: Optional[str] = Form(None),
    forecast_horizon: Optional[str] = Form(None),
    model_type: Optional[str] = Form(None)
):
    """
    Routes analysis requests. Accepts data via file upload OR text paste.
    Supports both SEM and Predictive Analysis with their respective parameters.
    """
    # Define data_payload and filename earlier
    data_payload: Union[UploadFile, str, None] = None
    input_filename: str = "unknown"
    is_file_upload: bool = False

    try:
        # --- Determine data source ---
        if data_file:
            filename_lower = data_file.filename.lower()
            if not filename_lower.endswith(('.csv', '.xlsx', '.xls')):
                raise HTTPException(status_code=400, detail="Invalid file type. Please upload a CSV or Excel file.")
            data_payload = data_file # Pass the UploadFile object
            input_filename = data_file.filename
            is_file_upload = True
            print(f"Processing uploaded file: {input_filename}")
        elif data_text:
            data_payload = data_text # Pass the raw string
            input_filename = "pasted_data.csv" # Assume CSV for text
            is_file_upload = False
            print(f"Processing pasted text data.")
        else:
            raise HTTPException(status_code=400, detail="No data provided. Please either upload a file or paste text data.")

        # --- Route based on analysis_type ---
        if analysis_type == "sem":
            if not measurement_syntax and not structural_syntax:
                raise HTTPException(status_code=400, detail="SEM requires at least Measurement Syntax or Structural Syntax.")

            measurement_part = measurement_syntax if measurement_syntax else ""
            structural_part = structural_syntax if structural_syntax else ""

            print(f"Routing to SEM Analysis...")

            results = await sem_analysis.perform_sem(
                data_payload=data_payload,
                is_file_upload=is_file_upload,
                input_filename=input_filename,
                measurement_syntax=measurement_part,
                structural_syntax=structural_part
            )
            return JSONResponse(content=results)

        elif analysis_type == "predictive":
            # Validate predictive analysis parameters
            if not date_column:
                raise HTTPException(status_code=400, detail="Predictive analysis requires a date column.")
            if not metric_column:
                raise HTTPException(status_code=400, detail="Predictive analysis requires a metric column.")
            if not forecast_horizon:
                forecast_horizon = "year"  # Default to 1 year
            if not model_type:
                model_type = "auto"  # Default to auto-detection

            print(f"Routing to Predictive Analysis...")

            results = await predictive_analysis.perform_prediction(
                data_payload=data_payload,
                is_file_upload=is_file_upload,
                input_filename=input_filename,
                date_column=date_column,
                metric_column=metric_column,
                forecast_horizon=forecast_horizon,
                model_type=model_type
            )
            return JSONResponse(content=results)

        # === Add elif blocks for other analysis types ===
        # elif analysis_type == "regression":
        #     results = await regression_analysis.perform_regression(...)
        #     return JSONResponse(content=results)

        else:
            raise HTTPException(status_code=400, detail=f"Unsupported analysis_type: {analysis_type}")

    except HTTPException as http_exc:
        raise http_exc
    except Exception as e:
        print(f"Error during {analysis_type} analysis: {e}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"An internal server error occurred: {str(e)}")
    finally:
        # Ensure uploaded file is closed if it exists and is UploadFile
        if is_file_upload and isinstance(data_payload, UploadFile):
            await data_payload.close()

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