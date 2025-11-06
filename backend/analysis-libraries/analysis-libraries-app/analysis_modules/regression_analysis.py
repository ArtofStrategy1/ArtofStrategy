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
OLLAMA_URL = "https://ollama.data2int.com/api/generate"
OLLAMA_MODEL = "llama3.1:latest"

# --- JSON Serialization Helper (ULTRA SAFE VERSION) ---
def safe_convert(obj):
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
    """Loads the business context from the optional context file."""
    business_context = "No business context provided."
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
    """Basic statistical analysis with guaranteed JSON-safe outputs"""
    print("📊 Performing basic statistical analysis...")
    
    try:
        correlations = {}
        
        # --- ROBUSTNESS FIX ---
        # Check if X is a numpy array, if not, something is wrong
        if not isinstance(X, np.ndarray):
             raise TypeError(f"X must be a numpy array, but got {type(X)}")

        # Case 1: X is a 2D array (multiple features)
        if X.ndim == 2:
            if X.shape[1] != len(feature_names):
                raise ValueError(f"X columns ({X.shape[1]}) != feature_names length ({len(feature_names)})")
            
            for i, feature in enumerate(feature_names):
                corr = np.corrcoef(X[:, i], y)[0, 1]
                correlations[feature] = safe_convert(corr)
        
        # Case 2: X is a 1D array (only ONE feature)
        elif X.ndim == 1:
            if len(feature_names) != 1:
                raise ValueError(f"X is 1D, but feature_names list has {len(feature_names)} features.")
            
            print(f"Calculating correlation for 1D array (single feature: {feature_names[0]})")
            corr = np.corrcoef(X, y)[0, 1]
            correlations[feature_names[0]] = safe_convert(corr)
        
        else:
            raise ValueError(f"X has unsupported dimensions: {X.ndim}")
        # --- END OF FIX ---

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

async def perform_regression_analysis(
    data_payload: Union[UploadFile, str],
    is_file_upload: bool,
    input_filename: str,
    target_column: str,
    feature_columns: Optional[List[str]] = None, # Expecting a list from main.py
    model_types: Optional[List[str]] = None,
    test_size: float = 0.2,
    context_file: Optional[UploadFile] = None
) -> Dict[str, Any]:
    """
    Performs a full OLS (Ordinary Least Squares) regression analysis
    using statsmodels for rich statistical inference and diagnostics.
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
        
        X_processed = X_processed.fillna(0) # Fill any remaining NaNs after encoding/imputing

        y_series = df_clean[target_column]
        final_feature_names = X_processed.columns.tolist()
        
        # Convert to numpy arrays for sklearn
        X = X_processed.values.astype(float)
        
        #
        # --- THIS IS THE FIX ---
        y = y_series.values.astype(float) # Ensure y is also a float array
        # --- END OF FIX ---
        #
        
        print(f"✅ Prepared data: {X.shape[0]} rows, {X.shape[1]} features")

        # 4. --- Run Statsmodels OLS ---
        print("Running statsmodels.api.OLS...")
        X_const = sm.add_constant(X_processed.astype(float)) # CRITICAL: Add constant for intercept
        
        model = sm.OLS(y, X_const).fit() # Use the already-float-converted y
        
        # 5. --- Run Diagnostics ---
        print("Running model diagnostics...")
        residuals = model.resid
        predicted = model.predict()
        
        residuals_plot_data = [
            {"predicted": safe_convert(p), "residual": safe_convert(r)} 
            for p, r in zip(predicted, residuals)
        ]

        dw_stat = durbin_watson(residuals)
        dw_interp = "Indeterminate"
        if dw_stat < 1.5: dw_interp = "Positive autocorrelation (Bad)"
        elif dw_stat > 2.5: dw_interp = "Negative autocorrelation (Bad)"
        else: dw_interp = "No significant autocorrelation (Good)"
        
        bp_test = het_breuschpagan(residuals, model.model.exog)
        bp_pvalue = bp_test[1]
        bp_interp = f"p = {bp_pvalue:.3f}. "
        if bp_pvalue < 0.05:
            bp_interp += "Evidence of heteroscedasticity (Bad). Residuals spread is uneven."
        else:
            bp_interp += "No evidence of heteroscedasticity (Good). Residuals spread is even."

        jb_test = stats.jarque_bera(residuals)
        jb_pvalue = jb_test[1]
        jb_interp = f"p = {jb_pvalue:.3f}. "
        if jb_pvalue < 0.05:
            jb_interp += "Residuals are likely NOT normally distributed (Bad)."
        else:
            jb_interp += "Residuals appear to be normally distributed (Good)."
        
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
                "std_error": safe_convert(model.bse[i]), # Corrected to .bse
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

        # 9. --- Assemble Final Response ---
        response_data = {
            "statsmodels_results": {
                "model_summary": model_summary,
                "coefficients": coeffs_list,
                "diagnostics": diagnostics
            },
            "sklearn_comparison": sklearn_models,
            "statistical_analysis": basic_statistics(X, y, final_feature_names), # Use X, not X_processed
            "dataset_info": {
                "original_rows": safe_convert(len(df)),
                "clean_rows": safe_convert(len(df_clean)),
                "target_column": str(target_column),
                "original_feature_columns": [str(col) for col in feature_columns],
                "final_feature_columns_after_encoding": [str(col) for col in final_feature_names],
                "features_count": safe_convert(len(final_feature_names))
            },
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
            "dataset_info": {"error": str(e)}, # This is what the JS function will check
            "model_results": {},
            "statistical_analysis": {"error": str(e)},
            "metadata": {
                "error": True,
                "error_message": str(e),
                "analysis_timestamp": datetime.now().isoformat()
            }
        }
    """
    Performs a full OLS (Ordinary Least Squares) regression analysis
    using statsmodels for rich statistical inference and diagnostics.
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
        
        X_processed = X_processed.fillna(0) # Fill any remaining NaNs after encoding/imputing

        y_series = df_clean[target_column]
        final_feature_names = X_processed.columns.tolist()
        
        # 4. --- Run Statsmodels OLS ---
        print("Running statsmodels.api.OLS...")
        X_const = sm.add_constant(X_processed.astype(float)) # CRITICAL: Add constant for intercept
        y = y_series.astype(float)
        
        model = sm.OLS(y, X_const).fit()
        
        # 5. --- Run Diagnostics ---
        print("Running model diagnostics...")
        residuals = model.resid
        predicted = model.predict()
        
        # Residuals Plot data
        residuals_plot_data = [
            {"predicted": safe_convert(p), "residual": safe_convert(r)} 
            for p, r in zip(predicted, residuals)
        ]

        # Durbin-Watson (Autocorrelation)
        dw_stat = durbin_watson(residuals)
        dw_interp = "Indeterminate"
        if dw_stat < 1.5: dw_interp = "Positive autocorrelation (Bad)"
        elif dw_stat > 2.5: dw_interp = "Negative autocorrelation (Bad)"
        else: dw_interp = "No significant autocorrelation (Good)"
        
        # Breusch-Pagan (Heteroscedasticity)
        bp_test = het_breuschpagan(residuals, model.model.exog)
        bp_pvalue = bp_test[1]
        bp_interp = f"p = {bp_pvalue:.3f}. "
        if bp_pvalue < 0.05:
            bp_interp += "Evidence of heteroscedasticity (Bad). Residuals spread is uneven."
        else:
            bp_interp += "No evidence of heteroscedasticity (Good). Residuals spread is even."

        # Jarque-Bera (Normality of Residuals)
        jb_test = stats.jarque_bera(residuals)
        jb_pvalue = jb_test[1]
        jb_interp = f"p = {jb_pvalue:.3f}. "
        if jb_pvalue < 0.05:
            jb_interp += "Residuals are likely NOT normally distributed (Bad)."
        else:
            jb_interp += "Residuals appear to be normally distributed (Good)."
        
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
                #
                # --- THIS IS THE FIX ---
                "std_error": safe_convert(model.bse[i]), # Changed from model.stderr
                # --- END OF FIX ---
                #
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
        X_train, X_test, y_train, y_test = train_test_split(X_processed, y, test_size=test_size, random_state=42)
        
        # Use a defined list for comparison, e.g., 'random_forest'
        sklearn_models = train_basic_models(X_train, X_test, y_train, y_test, model_types=['random_forest', 'ridge'])

        # 9. --- Assemble Final Response ---
        response_data = {
            "statsmodels_results": {
                "model_summary": model_summary,
                "coefficients": coeffs_list,
                "diagnostics": diagnostics
            },
            "sklearn_comparison": sklearn_models, # Results from other models
            "statistical_analysis": basic_statistics(X_processed.values, y, final_feature_names), # Correlations
            "dataset_info": {
                "original_rows": safe_convert(len(df)),
                "clean_rows": safe_convert(len(df_clean)),
                "target_column": str(target_column),
                "original_feature_columns": [str(col) for col in feature_columns],
                "final_feature_columns_after_encoding": [str(col) for col in final_feature_names],
                "features_count": safe_convert(len(final_feature_names))
            },
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
            "metadata": {
                "error": True,
                "error_message": str(e),
                "analysis_timestamp": datetime.now().isoformat()
            }
        }
    """
    Performs a full OLS (Ordinary Least Squares) regression analysis
    using statsmodels for rich statistical inference and diagnostics.
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
        
        X_processed = X_processed.fillna(0) # Fill any remaining NaNs after encoding/imputing

        y_series = df_clean[target_column]
        final_feature_names = X_processed.columns.tolist()
        
        # 4. --- Run Statsmodels OLS ---
        print("Running statsmodels.api.OLS...")
        X_const = sm.add_constant(X_processed.astype(float)) # CRITICAL: Add constant for intercept
        y = y_series.astype(float)
        
        model = sm.OLS(y, X_const).fit()
        
        # 5. --- Run Diagnostics ---
        print("Running model diagnostics...")
        residuals = model.resid
        predicted = model.predict()
        
        # Residuals Plot data
        residuals_plot_data = [
            {"predicted": safe_convert(p), "residual": safe_convert(r)} 
            for p, r in zip(predicted, residuals)
        ]

        # Durbin-Watson (Autocorrelation)
        dw_stat = durbin_watson(residuals)
        dw_interp = "Indeterminate"
        if dw_stat < 1.5: dw_interp = "Positive autocorrelation (Bad)"
        elif dw_stat > 2.5: dw_interp = "Negative autocorrelation (Bad)"
        else: dw_interp = "No significant autocorrelation (Good)"
        
        # Breusch-Pagan (Heteroscedasticity)
        bp_test = het_breuschpagan(residuals, model.model.exog)
        bp_pvalue = bp_test[1]
        bp_interp = f"p = {bp_pvalue:.3f}. "
        if bp_pvalue < 0.05:
            bp_interp += "Evidence of heteroscedasticity (Bad). Residuals spread is uneven."
        else:
            bp_interp += "No evidence of heteroscedasticity (Good). Residuals spread is even."

        # Jarque-Bera (Normality of Residuals)
        jb_test = stats.jarque_bera(residuals)
        jb_pvalue = jb_test[1]
        jb_interp = f"p = {jb_pvalue:.3f}. "
        if jb_pvalue < 0.05:
            jb_interp += "Residuals are likely NOT normally distributed (Bad)."
        else:
            jb_interp += "Residuals appear to be normally distributed (Good)."
        
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
                "std_error": safe_convert(model.stderr[i]),
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
        X_train, X_test, y_train, y_test = train_test_split(X_processed, y, test_size=test_size, random_state=42)
        
        # Use a defined list for comparison, e.g., 'random_forest'
        sklearn_models = train_basic_models(X_train, X_test, y_train, y_test, model_types=['random_forest', 'ridge'])

        # 9. --- Assemble Final Response ---
        response_data = {
            "statsmodels_results": {
                "model_summary": model_summary,
                "coefficients": coeffs_list,
                "diagnostics": diagnostics
            },
            "sklearn_comparison": sklearn_models, # Results from other models
            "statistical_analysis": basic_statistics(X_processed.values, y, final_feature_names), # Correlations
            "dataset_info": {
                "original_rows": safe_convert(len(df)),
                "clean_rows": safe_convert(len(df_clean)),
                "target_column": str(target_column),
                "original_feature_columns": [str(col) for col in feature_columns],
                "final_feature_columns_after_encoding": [str(col) for col in final_feature_names],
                "features_count": safe_convert(len(final_feature_names))
            },
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
            "metadata": {
                "error": True,
                "error_message": str(e),
                "analysis_timestamp": datetime.now().isoformat()
            }
        }
    """
    Robust regression analysis that handles numerical and categorical data
    with guaranteed JSON compatibility.
    """
    
    print("🚀 Starting Robust Regression Analysis...")
    
    try:
        # 1. Load data and context
        df = await load_dataframe(data_payload, is_file_upload, input_filename)
        business_context = await _load_context(context_file)
        
        # 2. Basic data validation
        if target_column not in df.columns:
            raise ValueError(f"Target column '{target_column}' not found. Available: {list(df.columns)}")
        
        # If no features are specified, use all columns except the target
        if not feature_columns:
            print("No feature columns specified, auto-detecting all columns except target.")
            feature_columns = [col for col in df.columns if col != target_column]
            
        if not feature_columns:
            raise ValueError("No valid feature columns found.")
            
        # Ensure all specified columns exist
        cols_to_use = [target_column] + feature_columns
        missing_cols = [col for col in cols_to_use if col not in df.columns]
        if missing_cols:
            raise ValueError(f"Missing columns in data: {missing_cols}. Available: {list(df.columns)}")
        
        # 3. Clean and Prepare Data
        df_clean = df[cols_to_use].copy()
        print(f"Original rows: {len(df_clean)}")
        
        # Drop rows where the *target* is missing
        # Also ensure target is numeric *before* dropping NaNs
        df_clean[target_column] = pd.to_numeric(df_clean[target_column], errors='coerce')
        df_clean = df_clean.dropna(subset=[target_column])
        
        print(f"Rows after dropping target NaNs: {len(df_clean)}")

        if len(df_clean) < 10:
            raise ValueError(f"Insufficient data after cleaning. Need at least 10 rows, got {len(df_clean)}")
        
        # 4. Preprocessing: Identify categorical and numerical features
        X_df = df_clean[feature_columns]
        y_series = df_clean[target_column]
        
        numerical_features = X_df.select_dtypes(include=np.number).columns.tolist()
        categorical_features = X_df.select_dtypes(exclude=np.number).columns.tolist()
        
        print(f"Numerical features identified: {numerical_features}")
        print(f"Categorical features identified: {categorical_features}")

        # --- THIS IS THE CORRECTED LOGIC ---
        X_processed = X_df.copy()

        # A. Handle numerical features: Impute missing with median
        if numerical_features:
            print(f"Imputing missing values in numerical features with median...")
            for col in numerical_features:
                if X_processed[col].isnull().any():
                    median_val = X_processed[col].median()
                    X_processed[col] = X_processed[col].fillna(median_val)
        
        # B. Handle categorical features: One-hot encode
        if categorical_features:
            print(f"Applying one-hot encoding (pd.get_dummies) to: {categorical_features}")
            # get_dummies is the correct way for linear regression
            # It handles NaNs automatically by creating an "na" column if dummy_na=True
            X_processed = pd.get_dummies(X_processed, columns=categorical_features, drop_first=True, dummy_na=True)
        
        # Get final feature names *after* encoding
        final_feature_names = X_processed.columns.tolist()
        
        # Convert to numpy arrays for sklearn
        X = X_processed.values.astype(float)
        y = y_series.values
        # --- END OF CORRECTED LOGIC ---
        
        print(f"✅ Prepared data: {X.shape[0]} rows, {X.shape[1]} features")

        # 6. Split data
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=test_size, random_state=42
        )
        
        # 7. Train models
        model_results = train_basic_models(X_train, X_test, y_train, y_test, model_types)
        
        # 8. Basic statistics (using the *encoded* data)
        stats_results = basic_statistics(X, y, final_feature_names)
        
        # 9. Create response (all safe conversions)
        response_data = {
            "dataset_info": {
                "original_rows": safe_convert(len(df)),
                "clean_rows": safe_convert(len(df_clean)),
                "target_column": str(target_column),
                "original_feature_columns": [str(col) for col in feature_columns],
                "final_feature_columns_after_encoding": [str(col) for col in final_feature_names],
                "features_count": safe_convert(len(final_feature_names))
            },
            "model_results": model_results,
            "statistical_analysis": stats_results,
            "data_splits": {
                "train_size": safe_convert(len(X_train)),
                "test_size": safe_convert(len(X_test)),
                "test_ratio": safe_convert(test_size)
            },
            "insights": [
                {
                    "observation": "Regression analysis completed successfully",
                    "interpretation": f"Analyzed {len(final_feature_names)} final features (after encoding) to predict {target_column}",
                    "recommendation": "Review model performance metrics to select best approach"
                }
            ],
            "metadata": {
                "analysis_timestamp": datetime.now().isoformat(),
                "input_filename": str(input_filename),
                "analysis_type": "regression"
            }
        }
        
        print(f"✅ Robust regression analysis completed successfully!")
        return response_data
        
    except Exception as e:
        error_msg = f"❌ Error in regression analysis: {str(e)}"
        print(f"{error_msg}\n{traceback.format_exc()}")
        
        # Return error response with safe conversion
        return {
            "dataset_info": {"error": str(e)},
            "model_results": {},
            "statistical_analysis": {"error": str(e)},
            "insights": [
                {
                    "observation": "Analysis Failed", 
                    "interpretation": str(e), 
                    "recommendation": "Check data format, column names, and parameters"
                }
            ],
            "metadata": {
                "error": True,
                "error_message": str(e),
                "analysis_timestamp": datetime.now().isoformat()
            }
        }
    """Simplified regression analysis with guaranteed JSON compatibility"""
    
    print("🚀 Starting Simplified Regression Analysis...")
    
    try:
        # 1. Load data and context
        df = await load_dataframe(data_payload, is_file_upload, input_filename)
        business_context = await _load_context(context_file)
        
        # 2. Basic data validation
        if target_column not in df.columns:
            raise ValueError(f"Target column '{target_column}' not found. Available: {list(df.columns)}")
        
        # 3. Prepare features
        if feature_columns is None:
            # Auto-select numeric columns
            numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
            feature_columns = [col for col in numeric_cols if col != target_column]
        
        if not feature_columns:
            raise ValueError("No valid feature columns found")
        
        # 4. Clean data and handle categorical variables
        # Keep only specified columns and remove NaN
        cols_to_use = [target_column] + feature_columns
        df_clean = df[cols_to_use].dropna()
        
        if len(df_clean) < 10:
            raise ValueError(f"Insufficient data after cleaning. Need at least 10 rows, got {len(df_clean)}")
        
        # 5. Handle categorical variables and prepare X and y
        processed_features = []
        feature_data = []
        
        for col in feature_columns:
            series = df_clean[col]
            
            # Try to convert to numeric
            numeric_converted = pd.to_numeric(series, errors='coerce')
            numeric_ratio = numeric_converted.notna().sum() / len(series)
            
            if numeric_ratio > 0.8:  # Mostly numeric
                feature_data.append(numeric_converted.values)
                processed_features.append(col)
                print(f"✅ Using {col} as numeric feature")
            else:  # Categorical - encode it
                try:
                    encoder = LabelEncoder()
                    encoded_values = encoder.fit_transform(series.astype(str))
                    feature_data.append(encoded_values.astype(float))
                    processed_features.append(f"{col}_encoded")
                    print(f"✅ Encoded {col} as categorical feature ({len(encoder.classes_)} categories)")
                except Exception as e:
                    print(f"⚠️ Skipping {col} due to encoding error: {e}")
                    continue
        
        if not feature_data:
            raise ValueError("No valid features could be processed")
        
        # Combine all features
        X = np.column_stack(feature_data)
        y = pd.to_numeric(df_clean[target_column], errors='coerce').values
        
        # Remove any rows where target conversion failed
        valid_mask = ~np.isnan(y)
        X = X[valid_mask]
        y = y[valid_mask]
        
        if len(X) < 10:
            raise ValueError(f"Insufficient valid data after processing. Need at least 10 rows, got {len(X)}")
            
        print(f"✅ Prepared data: {X.shape[0]} rows, {X.shape[1]} features")
        
        # 6. Split data
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=test_size, random_state=42
        )
        
        # 7. Train models
        model_results = train_basic_models(X_train, X_test, y_train, y_test, model_types)
        
        # 8. Basic statistics
        stats_results = basic_statistics(X, y, processed_features)
        
        # 9. Create response (all safe conversions)
        response_data = {
            "dataset_info": {
                "original_rows": safe_convert(len(df)),
                "clean_rows": safe_convert(len(df_clean)),
                "target_column": str(target_column),
                "feature_columns": [str(col) for col in feature_columns],
                "processed_features": [str(col) for col in processed_features],
                "features_count": safe_convert(len(processed_features))
            },
            "model_results": model_results,
            "statistical_analysis": stats_results,
            "data_splits": {
                "train_size": safe_convert(len(X_train)),
                "test_size": safe_convert(len(X_test)),
                "test_ratio": safe_convert(test_size)
            },
            "insights": [
                {
                    "observation": "Regression analysis completed successfully",
                    "interpretation": f"Analyzed {len(feature_columns)} features to predict {target_column}",
                    "recommendation": "Review model performance metrics to select best approach"
                }
            ],
            "metadata": {
                "analysis_timestamp": datetime.now().isoformat(),
                "input_filename": str(input_filename),
                "analysis_type": "regression"
            }
        }
        
        print(f"✅ Regression analysis completed successfully!")
        return response_data
        
    except Exception as e:
        error_msg = f"❌ Error in regression analysis: {str(e)}"
        print(f"{error_msg}\n{traceback.format_exc()}")
        
        # Return error response with safe conversion
        return {
            "dataset_info": {"error": str(e)},
            "model_results": {},
            "statistical_analysis": {"error": str(e)},
            "insights": [
                {
                    "observation": "Analysis Failed", 
                    "interpretation": str(e), 
                    "recommendation": "Check data format and parameters"
                }
            ],
            "metadata": {
                "error": True,
                "error_message": str(e),
                "analysis_timestamp": datetime.now().isoformat()
            }
        }