# S.A.G.E. Analytics Backend

![Python](https://img.shields.io/badge/Python-3.11-blue?style=for-the-badge&logo=python)
![FastAPI](https://img.shields.io/badge/FastAPI-0.104-009688?style=for-the-badge&logo=fastapi)
![Docker](https://img.shields.io/badge/Docker_Compose-Enabled-2496ED?style=for-the-badge&logo=docker)
![Ollama](https://img.shields.io/badge/AI-Ollama_Powered-orange?style=for-the-badge)

**S.A.G.E. (Statistical Analytics & Generation Engine)** is a high-performance analytics API built with Python 3.11 and FastAPI. It serves as the computational brain for advanced data platforms, bridging the gap between rigorous statistical modeling and generative AI.

Unlike standard dashboard backends, S.A.G.E. automates advanced methodologies—including Structural Equation Modeling (SEM), Predictive Forecasting, and Regression—and pipes the statistical results into a local LLM (Ollama) to generate human-readable, strategic business insights.

## Key Features

### Advanced Data Analysis
* **Descriptive Analysis:** Automated calculation of central tendencies and distributions.
* **Predictive Analytics:** Time-series forecasting using Linear, Seasonal, and Trend decomposition.
* **Regression Analysis:** OLS regression with diagnostics (Heteroscedasticity, Normality) via `statsmodels`.
* **Structural Equation Modeling (SEM):**
    * **CB-SEM:** Covariance-based modeling using `semopy`. 

[Image of structural equation modeling path diagram]

    * **PLS-SEM:** Partial Least Squares modeling using `plspm` with bootstrapping.
* **DEMATEL:** Causal relationship discovery and influence matrix calculation.
* **Prescriptive Analytics:** Converts business goals and data snapshots into implementation roadmaps.

### AI-Augmented Insights
* **Integrated with Ollama:** Connects to a self-hosted AI instance running `llama3.1:latest`.
* **Context-Aware:** Analysis modules send statistical outputs to the LLM to generate qualitative business recommendations.

### Automated Reporting
* **PDF Generation:** Uses `fpdf2` to compile visual charts and AI insights into professional reports.
* **Word Export:** Uses `python-docx` for editable analytic summaries.

## Tech Stack

* **Framework:** FastAPI, Uvicorn, Starlette
* **Data & ML:** Pandas (v2.1.3), NumPy (v1.26.4), Scikit-Learn, SciPy
* **Statistical Engines:** Statsmodels, Semopy, Plspm
* **Visualization:** Matplotlib, Seaborn, Graphviz
* **Reporting:** FPDF2, Python-Docx
* **Infrastructure:** Docker Compose, HTTPX (Async Client)

## Project Structure

```text
.
├── analysis-libraries-app/     # Application Source Code
│   ├── main.py                 # FastAPI entry point
│   ├── analysis_modules/       # Statistical engines (SEM, Regression, etc.)
│   └── save_modules/           # Export logic (save_pdf.py, save_docx.py)
├── requirements.txt            # Pinned Python dependencies
├── Dockerfile                  # Container configuration (Python 3.11 Slim)
└── docker-compose.yml          # Orchestration config

----------------------------------------------------------------------------------------------------------------------------
----------------------------------------------------------------------------------------------------------------------------

Prerequisites:

- Docker & Docker Compose

- Ollama: Running locally or on a network-accessible server.

1. Build and Start Services:

docker compose up -d --build analysis-libraries

2. Managing the Application

To restart the backend service (e.g., after code changes):

docker compose down analysis-libraries

docker compose up -d analysis-libraries

3. Configure AI (Ollama)

Ensure your Ollama instance is running. By default, the backend expects Ollama at: https://ollama.sageaios.com/api/generate

To run locally, update the OLLAMA_URL constant in the analysis modules to http://host.docker.internal:11434/api/generate

----------------------------------------------------------------------------------------------------------------------------
----------------------------------------------------------------------------------------------------------------------------

API Documentation:

Once running, access the Swagger UI at http://localhost:8000/ to test endpoints directly.

Endpoint            Method     Description                     Input Data
/api/descriptive    POST       Summary stats & AI insights     File + Context
/api/regression     POST       OLS Regression & Diagnostics    File + Target Col + Models
/api/sem            POST       CB-SEM Analysis                 File + Lavaan Syntax
/api/pls            POST       PLS-SEM & Path Diagrams         File + Measurement/Structural Syntax
/api/predictive     POST       Time-series Forecasting         File + Date/Target Cols
/api/prescriptive   POST       Goal-oriented Recommendations   File + Business Goal
/api/dematel        POST       Causal Relationship Analysis    Text Description or Matrix
/api/visualization  POST       AI Chart Suggestions            File + Context
/api/export         POST       Generate PDF/DOCX Reports       Analysis JSON + Format