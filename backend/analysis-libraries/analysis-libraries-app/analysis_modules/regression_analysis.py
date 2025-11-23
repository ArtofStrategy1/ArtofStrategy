# analysis_modules/regression_analysis.py

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

# Statistical libraries
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LinearRegression, Ridge, Lasso, ElasticNet
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.metrics import mean_squared_error, r2_score, mean_absolute_error
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.feature_selection import SelectKBest, f_regression
from scipy import stats
import statsmodels.api as sm
from statsmodels.stats.diagnostic import het_breuschpagan, het_white
from statsmodels.stats.stattools import durbin_watson

# --- OLLAMA Configuration ---
OLLAMA_URL = "https://ollama.sageaios.com/api/generate"
OLLAMA_MODEL = "llama3.1:latest"

# --- JSON Serialization Helper (ULTRA SAFE VERSION) ---
def safe_convert(obj):
    """
    Safely converts numpy/pandas types to standard Python types for JSON serialization.

    This function handles a wide variety of types including pandas NA/NaN, numpy integers,
    floats, booleans, strings, and standard collections. It recursively converts
    dictionaries and lists.

    Args:
        obj (Any): The object to be converted.

    Returns:
        Union[int, float, bool, str, list, dict, None]: The converted object suitable for
            JSON serialization. Returns "conversion_error" string if conversion fails.
    """
    """Ultra-safe conversion that handles all possible numpy/pandas types"""
    if obj is None:
        return None
    
    # Handle pandas NA/NaN
    try:
        if pd.isna(obj):
            return None
    except (TypeError, ValueError):
        pass
    
    # Handle numpy types
    if hasattr(obj, 'dtype'):
        if np.issubdtype(obj.dtype, np.integer):
            return int(obj)
        elif np.issubdtype(obj.dtype, np.floating):
            if np.isnan(obj) or np.isinf(obj):
                return None
            return float(obj)
        elif np.issubdtype(obj.dtype, np.bool_):
            return bool(obj)
    
    # Handle basic numpy types without dtype
    if isinstance(obj, (np.integer, np.int8, np.int16, np.int32, np.int64)):
        return int(obj)
    if isinstance(obj, (np.floating, np.float16, np.float32, np.float64)):
        if np.isnan(obj) or np.isinf(obj):
            return None
        return float(obj)
    if isinstance(obj, (np.bool_, np.bool8)):
        return bool(obj)
    if isinstance(obj, (np.str_, np.unicode_)):
        return str(obj)
    
    # Handle regular Python types
    if isinstance(obj, (int, float, str, bool)):
        return obj
    
    # Handle collections
    if isinstance(obj, dict):
        return {str(k): safe_convert(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [safe_convert(item) for item in obj]
    if isinstance(obj, (np.ndarray, pd.Series)):
        return [safe_convert(item) for item in obj.tolist()]
    
    # Final fallback - convert to string
    try:
        return str(obj)
    except:
        return "conversion_error"

# --- Helper to load data ---
async def load_dataframe(
    data_payload: Union[UploadFile, str],
    is_file_upload: bool,
    input_filename: str
) -> pd.DataFrame:
    """
    Asynchronously loads a DataFrame from an uploaded file or a raw string input.

    Handles CSV and Excel files, cleans column names by removing special characters,
    and standardizes missing value representations.

    Args:
        data_payload (Union[UploadFile, str]): The input data, either as a file object
            or a raw string content.
        is_file_upload (bool): Flag indicating if the payload is a file upload.
        input_filename (str): The name of the file (used to determine format).

    Returns:
        pd.DataFrame: A pandas DataFrame containing the loaded and cleaned data.

    Raises:
        HTTPException: If the file type is invalid (400), the content is empty (400),
            or an error occurs during parsing (400).
        TypeError: If `is_file_upload` is True but `data_payload` is not an UploadFile.
    """
    """Load data from file upload or text input"""
    print("📊 Loading data for regression analysis...")
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

# --- Helper to load context file ---
async def _load_context(context_file: Optional[UploadFile]) -> str:
    """
    Reads the business context from an optional uploaded text file.

    Args:
        context_file (Optional[UploadFile]): The uploaded text file containing context.

    Returns:
        str: The content of the context file, or a default string if no file is provided
            or an error occurs.
    """
    """Loads the business context from the optional context file."""
    business_context = "No specific business context provided."
    if context_file:
        try:
            contents = await context_file.read()
            business_context = contents.decode('utf-8')
            print("✅ Business context file loaded.")
        except Exception as e:
            print(f"Warning: Could not read context file: {e}")
            business_context = f"Error reading context file: {e}"
    return business_context

# --- Simple Model Training (Focused Version) ---
def train_basic_models(X_train, X_test, y_train, y_test, model_types: List[str] = None) -> Dict[str, Any]:
    """
    Trains multiple regression models (Linear, Ridge, Random Forest) for comparison.

    This function scales the data for linear models and performs training and prediction
    on the provided train/test splits. It ensures all output metrics are JSON-safe.

    Args:
        X_train (array-like): Training features.
        X_test (array-like): Testing features.
        y_train (array-like): Training target values.
        y_test (array-like): Testing target values.
        model_types (List[str], optional): List of model names to train. 
            Defaults to ['linear', 'random_forest'] if None.

    Returns:
        Dict[str, Any]: A dictionary where keys are model names and values are dictionaries
            containing performance metrics (R2, RMSE) and sample predictions.
    """
    """Train regression models with guaranteed JSON-safe outputs"""
    print("🤖 Training regression models...")
    
    if model_types is None:
        model_types = ['linear', 'random_forest']
    
    results = {}
    
    # Scale data for linear models
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)
    
    for model_name in model_types:
        try:
            if model_name == 'linear':
                model = LinearRegression()
                model.fit(X_train_scaled, y_train)
                y_pred_train = model.predict(X_train_scaled)
                y_pred_test = model.predict(X_test_scaled)
            elif model_name == 'ridge':
                model = Ridge(alpha=1.0)
                model.fit(X_train_scaled, y_train)
                y_pred_train = model.predict(X_train_scaled)
                y_pred_test = model.predict(X_test_scaled)
            elif model_name == 'random_forest':
                model = RandomForestRegressor(n_estimators=50, random_state=42)
                model.fit(X_train, y_train)
                y_pred_train = model.predict(X_train)
                y_pred_test = model.predict(X_test)
            else:
                continue
            
            # Calculate metrics with safe conversion
            results[model_name] = {
                'train_r2': safe_convert(r2_score(y_train, y_pred_train)),
                'test_r2': safe_convert(r2_score(y_test, y_pred_test)),
                'train_rmse': safe_convert(np.sqrt(mean_squared_error(y_train, y_pred_train))),
                'test_rmse': safe_convert(np.sqrt(mean_squared_error(y_test, y_pred_test))),
                'predictions_sample': safe_convert(y_pred_test[:5].tolist())
            }
            
            print(f"✅ {model_name}: R² = {results[model_name]['test_r2']:.4f}")
            
        except Exception as e:
            print(f"❌ Error training {model_name}: {e}")
            results[model_name] = {'error': str(e)}
    
    return results

# --- Basic Statistical Analysis ---
def basic_statistics(X, y, feature_names: List[str]) -> Dict[str, Any]:
    """
    Performs basic statistical analysis including correlations and target descriptive stats.

    Args:
        X (Union[np.ndarray, List]): Feature data array.
        y (Union[np.ndarray, List]): Target data array.
        feature_names (List[str]): List of names corresponding to the columns in X.

    Returns:
        Dict[str, Any]: A dictionary containing:
            - 'correlations': Dictionary of feature-target correlation coefficients.
            - 'target_stats': Descriptive statistics (mean, std, min, max) of the target.
            - 'sample_size': The number of observations.
            Returns an error dictionary if calculation fails.
    """
    """Basic statistical analysis with guaranteed JSON-safe outputs"""
    print("📊 Performing basic statistical analysis...")
    
    try:
        correlations = {}
        
        # Check if X is a numpy array
        if not isinstance(X, np.ndarray):
             X = np.array(X)

        # Case 1: X is a 2D array (multiple features)
        if X.ndim == 2:
            if X.shape[1] != len(feature_names):
                # Fallback if dimensions don't match
                print("Warning: Feature names length mismatch in correlation calc. Truncating.")
            
            # Safe correlation calculation
            for i in range(min(X.shape[1], len(feature_names))):
                feature = feature_names[i]
                try:
                    corr = np.corrcoef(X[:, i], y)[0, 1]
                    correlations[feature] = safe_convert(corr)
                except:
                    correlations[feature] = None
        
        # Case 2: X is a 1D array
        elif X.ndim == 1 and len(feature_names) >= 1:
            corr = np.corrcoef(X, y)[0, 1]
            correlations[feature_names[0]] = safe_convert(corr)
        
        # Basic descriptive stats
        stats_results = {
            'correlations': correlations,
            'target_stats': {
                'mean': safe_convert(np.mean(y)),
                'std': safe_convert(np.std(y)),
                'min': safe_convert(np.min(y)),
                'max': safe_convert(np.max(y))
            },
            'sample_size': safe_convert(len(y))
        }
        
        return stats_results
        
    except Exception as e:
        print(f"❌ Error in statistical analysis: {e}")
        print(traceback.format_exc())
        return {'error': str(e)}

# --- NEW: AI Insight Generation ---
async def generate_regression_ai_insights(
    model_summary: Dict,
    coefficients: List[Dict],
    diagnostics: Dict,
    business_context: str
) -> List[Dict[str, str]]:
    """
    Generates narrative business insights using an external LLM (Ollama) based on regression results.

    Constructs a prompt containing model performance metrics, significant coefficients,
    and diagnostic results, then queries the Ollama API for actionable insights.

    Args:
        model_summary (Dict): Summary statistics of the regression model (R-squared, etc.).
        coefficients (List[Dict]): List of coefficient dictionaries containing p-values.
        diagnostics (Dict): Diagnostic test results (Durbin-Watson, Normality, etc.).
        business_context (str): Contextual information about the dataset/business problem.

    Returns:
        List[Dict[str, str]]: A list of insight dictionaries. Each dictionary contains:
            "observation", "technical_interpretation", "business_implication", and "confidence_level".
            Returns an empty list if the API call or parsing fails.
    
    Raises:
        ValueError: If the API returns a response that is not a valid list.
    """
    """
    Generates narrative insights using Ollama based on regression results.
    """
    print("🤖 Generating AI Insights for Regression via Ollama...")

    # 1. Filter for significant coefficients (p < 0.1) to reduce token count
    sig_coeffs = [
        f"{c['variable']}: coef={c['coefficient']:.4f} (p={c['p_value']:.4f})" 
        for c in coefficients 
        if isinstance(c['p_value'], (int, float)) and c['p_value'] < 0.1 and c['variable'] != 'const'
    ]
    # Take top 10 significant features
    sig_coeffs_str = "; ".join(sig_coeffs[:10]) if sig_coeffs else "No statistically significant features found."

    # 2. Extract key metrics
    r2_score_val = model_summary.get('r_squared')
    adj_r2 = model_summary.get('adj_r_squared')
    target_var = model_summary.get('dependent_variable')
    
    # 3. Construct Prompt
    prompt = f"""
    Act as a Senior Statistician and Business Consultant. Interpret the following Ordinary Least Squares (OLS) regression results for the target variable: "{target_var}".

    ### MODEL PERFORMANCE:
    - R-Squared: {r2_score_val} (Interpretation: How much variance is explained?)
    - Adjusted R-Squared: {adj_r2}

    ### KEY DRIVERS (Significant Features):
    {sig_coeffs_str}

    ### DIAGNOSTICS:
    - Durbin-Watson: {diagnostics['durbin_watson']['statistic']} ({diagnostics['durbin_watson']['interpretation']})
    - Normality (Jarque-Bera): {diagnostics['jarque_bera_pvalue']['interpretation']}
    - Heteroscedasticity (Breusch-Pagan): {diagnostics['breusch_pagan_pvalue']['interpretation']}

    ### BUSINESS CONTEXT:
    {business_context}

    ### INSTRUCTIONS:
    Provide 4 distinct, actionable insights in valid JSON format.
    1. Overall Model Fit & Reliability.
    2. Primary Driver Analysis (What impacts {target_var} the most?).
    3. Diagnostic Warning (If model has flaws like autocorrelation, mention it; otherwise confirm robustness).
    4. Strategic Recommendation based on the drivers.

    Return ONLY a raw JSON array. No markdown. Keys: "observation", "technical_interpretation", "business_implication", "confidence_level" (High/Medium/Low).
    """

    payload = {
        "model": OLLAMA_MODEL,
        "prompt": prompt,
        "stream": False,
        "format": "json",
        "options": {"temperature": 0.3, "num_ctx": 4096}
    }

    try:
        async with httpx.AsyncClient(timeout=35.0) as client:
            response = await client.post(OLLAMA_URL, json=payload)
            response.raise_for_status()
            
            result = response.json()
            generated_text = result.get('response', '')
            clean_json = generated_text.replace("```json", "").replace("```", "").strip()
            
            insights = json.loads(clean_json)
            if isinstance(insights, list) and len(insights) > 0:
                print(f"✅ AI successfully generated {len(insights)} insights.")
                return insights
            else:
                raise ValueError("AI Output not a list")

    except Exception as e:
        print(f"⚠️ AI Insight Generation Failed: {e}")
        return [] # Fallback will be handled in main function

# --- Main Regression Function ---
async def perform_regression_analysis(
    data_payload: Union[UploadFile, str],
    is_file_upload: bool,
    input_filename: str,
    target_column: str,
    feature_columns: Optional[List[str]] = None,
    model_types: Optional[List[str]] = None,
    test_size: float = 0.2,
    context_file: Optional[UploadFile] = None
) -> Dict[str, Any]:
    """
    Performs a full OLS regression analysis with Statsmodels, Sklearn validation, and AI-generated insights.

    This function orchestrates the entire analysis pipeline:
    1. Loads and preprocesses the data (imputation, one-hot encoding).
    2. Runs an OLS regression using Statsmodels.
    3. Calculates regression diagnostics (residuals, heteroscedasticity, autocorrelation).
    4. Trains comparative Sklearn models for validation.
    5. Generates narrative insights via AI (Ollama).
    6. Assembles a comprehensive JSON response.

    Args:
        data_payload (Union[UploadFile, str]): Input data source.
        is_file_upload (bool): Whether the input is a file upload.
        input_filename (str): Name of the input file.
        target_column (str): The name of the dependent variable column.
        feature_columns (Optional[List[str]]): List of independent variable columns. 
            If None, auto-detects numeric columns.
        model_types (Optional[List[str]]): List of additional model types to train for comparison.
        test_size (float): Proportion of the dataset to include in the test split. Defaults to 0.2.
        context_file (Optional[UploadFile]): Optional file containing business context.

    Returns:
        Dict[str, Any]: A dictionary containing:
            - 'statsmodels_results': OLS summary, coefficients, and diagnostics.
            - 'sklearn_comparison': Performance metrics of comparative models.
            - 'statistical_analysis': Basic descriptive stats and correlations.
            - 'dataset_info': Metadata about the processed dataset.
            - 'insights': AI-generated or fallback narrative insights.
            - 'metadata': Analysis timestamp and status.

    Raises:
        ValueError: If target column is missing, required columns are missing, or data size is insufficient.
    """
    """
    Performs a full OLS regression analysis with Statsmodels, 
    Sklearn validation, and AI-generated insights.
    """
    
    print("🚀 Starting Statsmodels Regression Analysis...")
    
    try:
        # 1. Load data and context
        df = await load_dataframe(data_payload, is_file_upload, input_filename)
        business_context = await _load_context(context_file)
        
        # 2. Validate columns
        if target_column not in df.columns:
            raise ValueError(f"Target column '{target_column}' not found.")
        
        if not feature_columns:
            print("No feature columns specified, auto-detecting all numeric except target.")
            feature_columns = [col for col in df.select_dtypes(include=np.number).columns if col != target_column]
            
        cols_to_use = [target_column] + feature_columns
        missing_cols = [col for col in cols_to_use if col not in df.columns]
        if missing_cols:
            raise ValueError(f"Missing columns: {missing_cols}")

        # 3. Prepare Data (handling categorical & NaNs)
        df_clean = df[cols_to_use].copy()
        df_clean[target_column] = pd.to_numeric(df_clean[target_column], errors='coerce')
        df_clean = df_clean.dropna(subset=[target_column])
        
        if len(df_clean) < 10:
            raise ValueError(f"Insufficient data. Need at least 10 rows, got {len(df_clean)}")
        
        numerical_features = df_clean[feature_columns].select_dtypes(include=np.number).columns.tolist()
        categorical_features = df_clean[feature_columns].select_dtypes(exclude=np.number).columns.tolist()
        
        X_processed = df_clean[feature_columns].copy()
        
        if numerical_features:
            print(f"Imputing numerical features: {numerical_features}")
            for col in numerical_features:
                X_processed[col] = pd.to_numeric(X_processed[col], errors='coerce')
                X_processed[col] = X_processed[col].fillna(X_processed[col].median())
        
        if categorical_features:
            print(f"One-hot encoding categorical features: {categorical_features}")
            X_processed = pd.get_dummies(X_processed, columns=categorical_features, drop_first=True, dummy_na=True)
        
        X_processed = X_processed.fillna(0) # Fill any remaining NaNs

        y_series = df_clean[target_column]
        final_feature_names = X_processed.columns.tolist()
        
        X = X_processed.values.astype(float)
        y = y_series.values.astype(float)
        
        print(f"✅ Prepared data: {X.shape[0]} rows, {X.shape[1]} features")

        # 4. --- Run Statsmodels OLS ---
        print("Running statsmodels.api.OLS...")
        X_const = sm.add_constant(X_processed.astype(float))
        
        model = sm.OLS(y, X_const).fit()
        
        # 5. --- Run Diagnostics ---
        print("Running model diagnostics...")
        residuals = model.resid
        predicted = model.predict()
        
        residuals_plot_data = [
            {"predicted": safe_convert(p), "residual": safe_convert(r)} 
            for p, r in zip(predicted, residuals)
        ]

        # Diagnostics Tests
        dw_stat = durbin_watson(residuals)
        dw_interp = "Positive autocorrelation (Bad)" if dw_stat < 1.5 else "Negative autocorrelation (Bad)" if dw_stat > 2.5 else "No significant autocorrelation (Good)"
        
        try:
            bp_test = het_breuschpagan(residuals, model.model.exog)
            bp_pvalue = bp_test[1]
            bp_interp = "Evidence of heteroscedasticity (Bad)." if bp_pvalue < 0.05 else "Residuals variance is constant (Good)."
        except:
            bp_pvalue, bp_interp = None, "Test failed (possible singular matrix)"

        try:
            jb_test = stats.jarque_bera(residuals)
            jb_pvalue = jb_test[1]
            jb_interp = "Residuals NOT normal (Bad)." if jb_pvalue < 0.05 else "Residuals are normally distributed (Good)."
        except:
            jb_pvalue, jb_interp = None, "Test failed"
        
        diagnostics = {
            "durbin_watson": {"statistic": safe_convert(dw_stat), "interpretation": dw_interp},
            "breusch_pagan_pvalue": {"statistic": safe_convert(bp_pvalue), "interpretation": bp_interp},
            "jarque_bera_pvalue": {"statistic": safe_convert(jb_pvalue), "interpretation": jb_interp},
            "residuals_plot_data": residuals_plot_data
        }

        # 6. --- Extract Coefficients ---
        print("Extracting coefficients...")
        coeffs_list = []
        for i, var_name in enumerate(model.params.index):
            coeffs_list.append({
                "variable": str(var_name),
                "coefficient": safe_convert(model.params[i]),
                "std_error": safe_convert(model.bse[i]),
                "t_statistic": safe_convert(model.tvalues[i]),
                "p_value": safe_convert(model.pvalues[i]),
                "conf_int_low": safe_convert(model.conf_int().iloc[i, 0]),
                "conf_int_high": safe_convert(model.conf_int().iloc[i, 1]),
            })

        # 7. --- Extract Model Summary Stats ---
        print("Extracting model summary...")
        model_summary = {
            "dependent_variable": str(target_column),
            "r_squared": safe_convert(model.rsquared),
            "adj_r_squared": safe_convert(model.rsquared_adj),
            "f_statistic": safe_convert(model.fvalue),
            "prob_f_statistic": safe_convert(model.f_pvalue),
            "observations": safe_convert(model.nobs),
            "model_ll": safe_convert(model.llf),
            "aic": safe_convert(model.aic),
            "bic": safe_convert(model.bic),
            "equation": f"{target_column} = {coeffs_list[0]['coefficient']:.3f} + " + \
                        " + ".join([f"{c['coefficient']:.3f} * {c['variable']}" for c in coeffs_list if c['variable'] != 'const'])
        }

        # 8. --- Run Sklearn Models for Comparison ---
        print("Running sklearn models for comparison...")
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=test_size, random_state=42)
        sklearn_models = train_basic_models(X_train, X_test, y_train, y_test, model_types=['random_forest', 'ridge'])

        # 9. --- GENERATE INSIGHTS (AI + FALLBACK) ---
        ai_insights = await generate_regression_ai_insights(
            model_summary, coeffs_list, diagnostics, business_context
        )
        
        if not ai_insights:
            # Fallback heuristic insights if AI fails
            r2_val = model.rsquared
            r2_text = "excellent" if r2_val > 0.8 else "moderate" if r2_val > 0.5 else "weak"
            ai_insights = [
                {
                    "observation": f"The model explains {r2_val*100:.1f}% of the variance in {target_column}.",
                    "technical_interpretation": f"R-squared of {r2_val:.3f} indicates a {r2_text} fit.",
                    "business_implication": "Use predictions with caution and validate against domain knowledge.",
                    "confidence_level": "Medium"
                }
            ]

        # 10. --- Assemble Final Response ---
        response_data = {
            "statsmodels_results": {
                "model_summary": model_summary,
                "coefficients": coeffs_list,
                "diagnostics": diagnostics
            },
            "sklearn_comparison": sklearn_models,
            "statistical_analysis": basic_statistics(X, y, final_feature_names),
            "dataset_info": {
                "original_rows": safe_convert(len(df)),
                "clean_rows": safe_convert(len(df_clean)),
                "target_column": str(target_column),
                "original_feature_columns": [str(col) for col in feature_columns],
                "final_feature_columns_after_encoding": [str(col) for col in final_feature_names],
                "features_count": safe_convert(len(final_feature_names))
            },
            "insights": ai_insights, # Added AI insights here
            "metadata": {
                "analysis_timestamp": datetime.now().isoformat(),
                "input_filename": str(input_filename),
                "analysis_type": "regression"
            }
        }
        
        print(f"✅ Statsmodels regression analysis completed successfully!")
        return response_data
        
    except Exception as e:
        error_msg = f"❌ Error in regression analysis: {str(e)}"
        print(f"{error_msg}\n{traceback.format_exc()}")
        
        # Return error response
        return {
            "dataset_info": {"error": str(e)},
            "model_results": {},
            "statistical_analysis": {"error": str(e)},
            "metadata": {
                "error": True,
                "error_message": str(e),
                "analysis_timestamp": datetime.now().isoformat()
            }
        }