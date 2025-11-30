================================================================================
SAGE AI - ANALYSIS API DOCUMENTATION
================================================================================

ACTUAL PROJECT PATH: /home/elijah/data2int/backend/analysis-libraries
MAIN PROJECT PATH: /app
MODULES PATH: /app/analysis_modules
DATA FILES PATH: /app/analysis_modules/data-files
DOCKER FILE PATH: /app/Dockerfile

--------------------------------------------------------------------------------
1.  PROJECT OVERVIEW
--------------------------------------------------------------------------------

This repository contains the high-performance Python backend for the S.A.G.E.
Analysis Engine. Built on FastAPI and asynchronous Python, it serves as a
computational core for advanced statistical modeling, machine learning, and
AI-driven business insights.

KEY FEATURES:

  - Asynchronous Processing: Utilizes non-blocking I/O for heavy data uploads and
    external AI calls.
  - Multi-Paradigm Analysis: Supports Regression (OLS/ML), Time-Series Forecasting,
    Structural Equation Modeling (CB-SEM & PLS-SEM), and Causal Analysis (DEMATEL).
  - AI-Enhanced Insights: Tightly integrated with an external Ollama instance
    (Llama 3.1) to convert raw statistical outputs into narrative business strategies.
  - Dynamic Visualization: Generates context-aware chart configurations based on
    data topology (e.g., suggesting heatmaps for correlations).
  - Robust Data Handling: Unified logic to parse CSV/Excel inputs, handle missing
    values, and standardize data types across all modules.

--------------------------------------------------------------------------------
2.  TECH STACK & PREREQUISITES
--------------------------------------------------------------------------------

CORE TECHNOLOGIES:

  - Runtime:        Python 3.11 (Slim Bookworm)
  - Web Framework:  FastAPI (Uvicorn)
  - Data Science:   Pandas, NumPy, Scipy
  - Statistics:     Statsmodels, Semopy (CB-SEM), Plspm (PLS-SEM)
  - Machine Learning: Scikit-Learn
  - Visualization:  Graphviz (System-level), Matplotlib, Seaborn
  - AI Integration: HTTPX (Async client for Ollama)

PREREQUISITES:
To run or modify this stack, the following tools are required:

1.  Docker: For containerization and system-level dependency management (Graphviz).
2.  Python 3.11+: For local development.
3.  Ollama Instance: An accessible instance of Ollama running `llama3.1`.

ENVIRONMENT VARIABLES & CONFIGURATION:
These configurations are hardcoded or set via Docker ENV.

[ SKLEARN_ALLOW_DEPRECATED_SKLEARN_PACKAGE_INSTALL ]
Set to "True" in Dockerfile to ensure compatibility with specific ML libraries.

[ OLLAMA_URL ]
Configured internally as "[https://ollama.sageaios.com/api/generate](https://www.google.com/search?q=https://ollama.sageaios.com/api/generate)".
Target for LLM inference requests.

[ DATA_FILES_DIR ]
Absolute path mapped to /app/analysis_modules/data-files for serving samples.

--------------------------------------------------------------------------------
3.  ARCHITECTURE & SECURITY
--------------------------------------------------------------------------------

A. MODULAR ROUTING PATTERN
The `main.py` acts as a central orchestrator.

1.  Ingest: Accepts `Multipart/Form-Data` (Files) or `Form-Data` (Raw Text).
2.  Validate: `get_data_payload` helper standardizes inputs to Pandas DataFrames.
3.  Dispatch: Routes valid data to specialized modules in `/analysis_modules`.
4.  Augment: Modules calculate stats, then query the LLM to interpret results.
5.  Response: Returns JSON-serializable objects containing stats + narrative text.

B. SECURITY & RELIABILITY

  - Resource Management: `safe_close_file` ensures uploaded file descriptors are
    released immediately after processing to prevent memory leaks.
  - Input Sanitization: Filenames and column headers are sanitized to remove
    special characters before analysis to prevent injection or logic errors.
  - CORS Policy: Strictly allowlisted domains (data2int.com, sageaios.com, local).

--------------------------------------------------------------------------------
4.  FUNCTION REFERENCE
--------------------------------------------------------------------------------

--- STATISTICAL & ML ENDPOINTS ---

Function: perform_regression_analysis (POST /api/regression)
Description: Performs Ordinary Least Squares (OLS) regression with deep diagnostics.
Logic:

  - Imputes missing numerical data and One-Hot encodes categorical data.
  - Runs Statsmodels OLS for detailed coefficients and p-values.
  - Validates results against Scikit-Learn Random Forest/Ridge models.
  - Checks assumptions: Durbin-Watson (Autocorrelation), Jarque-Bera (Normality).
    Payload:     { target_column, feature_columns, test_size, model_types }

Function: perform_prediction (POST /api/predictive)
Description: Time-series forecasting with automated model selection.
Logic:

  - Validates date formats using a multi-strategy parser.
  - Runs "Tournament" validation: Tests Linear, Seasonal, and Trend models.
  - Selects best model based on cross-validation (MAPE/R2).
  - Generates confidence intervals and future trajectory analysis.
    Payload:     { dateColumn, targetColumn, forecastPeriods, confidenceLevel }

Function: perform_sem (POST /api/sem)
Description: Covariance-Based Structural Equation Modeling (CB-SEM).
Logic:

  - Uses `semopy` solver.
  - Parses Lavaan-style syntax for Measurement and Structural models.
  - Outputs fit indices (CFI, RMSEA), parameter estimates, and a Graphviz DOT diagram.

Function: perform_pls_sem (POST /api/pls)
Description: Partial Least Squares Structural Equation Modeling (PLS-SEM).
Logic:

  - Uses `plspm` library.
  - Calculates Cronbach's Alpha, Composite Reliability, and AVE.
  - Performs Discriminant Validity checks (HTMT, Fornell-Larcker).
  - Generates HTML/Base64 visualizations of the path model.

--- AI & DECISION SUPPORT ENDPOINTS ---

Function: perform_prescriptive_analysis (POST /api/prescriptive)
Description: Optimization engine for business goals.
Logic:

  - Profiles data to find potential drivers and outcomes.
  - Feeds data samples + Business Goal to LLM.
  - Returns "Prescriptions" (Action items) with calculated Effort/Impact scores.
  - Includes a heuristic Risk Assessment module.

Function: perform_dematel (POST /api/dematel)
Description: Causal modeling for complex factors.
Modes:

1.  Text Mode: LLM extracts factors/relationships from raw text.
2.  Matrix Mode: User provides direct influence matrix.
    Output:      Prominence (D+R) vs Relation (D-R) coordinates for plotting.

Function: perform_visualization_analysis (POST /api/visualization)
Description: Intelligent chart generation.
Logic:

  - 3-Step Process:
    1.  Analyze column metadata (Types, Unique counts).
    2.  Ask LLM for a "Chart Plan" based on user context.
    3.  Execute plan to generate Plotly-compatible JSON (Bar, Line, Heatmap).

Function: perform_descriptive_analysis (POST /api/descriptive)
Description: Summary statistics generator.
Logic:

  - Numerical: Mean, Median, StdDev, IQR, Skewness.
  - Categorical: Frequencies, Mode.
  - LLM Integration: Generates narrative insights (e.g., detecting skewness).

--- UTILITY ENDPOINTS ---

Function: download_sample_file (GET /api/samples/{category}/{filename})
Description: Serves static CSV sample files for user testing.
Security:    Includes directory traversal protection.

Function: export_analysis_report (POST /api/export)
Description: [In Development] Exports analysis JSON to PDF or DOCX.

--------------------------------------------------------------------------------
5.  DEPLOYMENT & OPERATION GUIDE (DOCKER)
--------------------------------------------------------------------------------

This project utilizes a standard Dockerfile for building the Python environment.

BUILDING THE IMAGE:
docker build -t sage-analysis-backend .

STARTING THE CONTAINER:
docker run -p 8000:8000 sage-analysis-backend
(Exposes the FastAPI server on port 8000)

SYSTEM DEPENDENCIES:
The Dockerfile installs `graphviz` and `libgraphviz-dev` via apt-get.
These are CRITICAL for the SEM and Visualization modules. If running
outside Docker, ensure these are installed on the host OS.

VIEWING LOGS:
docker logs -f [container_id]
(Helpful for debugging Python tracebacks or Ollama connection errors)

HEALTH CHECK:
GET http://localhost:8000/status
Response: {"status": "Analysis API is running"}

================================================================================ 
END OF DOCUMENTATION
================================================================================ 