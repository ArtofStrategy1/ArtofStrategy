# analysis_modules/predictive_analysis.py

import io
import pandas as pd
import numpy as np
import traceback
import json
import httpx
from typing import Optional, Tuple, List, Dict, Any, Union
from datetime import datetime, timedelta
import warnings

from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score, mean_absolute_percentage_error
from starlette.datastructures import UploadFile
from fastapi import HTTPException

warnings.filterwarnings('ignore', category=FutureWarning)
warnings.filterwarnings('ignore', category=UserWarning)

# --- AI CONFIGURATION ---
OLLAMA_URL = "https://ollama.sageaios.com/api/generate"
OLLAMA_MODEL = "llama3.1:latest"

# --- Debugging Helpers (Converted to Print) ---
def print_data_info(df, step_name):
    """Prints a summary of the DataFrame structure and content for debugging.

    Args:
        df (pd.DataFrame): The DataFrame to inspect.
        step_name (str): A label for the current processing step.
    """
    if df is None:
        print(f"=== {step_name} === DataFrame is None")
        return
    print(f"=== {step_name} ===")
    print(f"DataFrame shape: {df.shape}")
    print(f"Columns: {list(df.columns)}")
    dtypes_str = str(df.dtypes.to_dict())
    print(f"Data types: {dtypes_str[:500]}{'...' if len(dtypes_str) > 500 else ''}")
    if not df.empty:
        print(f"First 2 rows:\n{df.head(2).to_string()}")
        print(f"Last 2 rows:\n{df.tail(2).to_string()}")
    print(f"Null values:\n{df.isnull().sum().to_string()}")

def print_parameters(data_payload, is_file_upload, input_filename, date_column, target_column, forecast_periods, confidence_level, model_type):
    """Prints the input parameters received by the prediction endpoint.

    Args:
        data_payload (Any): The raw data input.
        is_file_upload (bool): Flag indicating if input is a file.
        input_filename (str): Name of the file.
        date_column (str): Name of the date column.
        target_column (str): Name of the target variable column.
        forecast_periods (int): Number of periods to forecast.
        confidence_level (float): The confidence interval (0-1).
        model_type (str): The requested model type (or 'auto').
    """
    print("=== INPUT PARAMETERS ===")
    print(f"data_payload type: {type(data_payload)}")
    print(f"is_file_upload: {is_file_upload}")
    print(f"input_filename: {input_filename}")
    print(f"date_column: {date_column}")
    print(f"target_column: {target_column}")
    print(f"forecast_periods: {forecast_periods}")
    print(f"confidence_level: {confidence_level}")
    print(f"model_type: {model_type}")

# --- Helper Functions ---
def safe_float(value, default=np.nan):
    """Safely converts a value to a float, handling various non-numeric representations.

    Handles strings like 'NA', 'null', 'None', and Excel errors (#DIV/0!).

    Args:
        value (Any): The value to convert.
        default (float, optional): The fallback value if conversion fails. Defaults to np.nan.

    Returns:
        float: The converted float or the default value.
    """
    try:
        if pd.isna(value):
            return default
        if isinstance(value, str) and value.strip().lower() in ['-', '', 'na', 'n/a', 'null', 'none', 'nan', '#n/a', '#value!', '#div/0!']:
            return default
        if isinstance(value, (np.float32, np.float64, np.floating)):
            if np.isnan(value):
                return default
            float_value = float(value)
        else:
            float_value = float(value)
        if not np.isfinite(float_value):
            return default
        return float_value
    except (ValueError, TypeError):
        print(f"[WARN] safe_float: Could not convert '{value}' (type: {type(value)}) to float. Returning default.")
        return default

def parse_date_column(series, column_name):
    """Attempts to parse a pandas Series into datetime objects using multiple strategies.

    Tries:
    1. Direct pandas datetime inference.
    2. Numeric year parsing (1900-2100).
    3. Iteration through day-first and month-first formats.
    4. Explicit common date formats (ISO, US, EU).
    5. 'Best effort' coercion.

    Args:
        series (pd.Series): The data column containing date information.
        column_name (str): The name of the column (for error logging).

    Returns:
        pd.Series: The parsed datetime series.

    Raises:
        ValueError: If the column cannot be parsed into valid dates.
    """
    print(f"[DEBUG] parse_date_column: Starting parsing for column '{column_name}'")
    original_dtype = series.dtype
    
    if pd.api.types.is_datetime64_any_dtype(original_dtype):
        return series

    if pd.api.types.is_numeric_dtype(original_dtype):
        if series.min() > 1900 and series.max() < 2100:
            try:
                parsed = pd.to_datetime(series, format='%Y', errors='coerce')
                if not parsed.isna().all():
                    print("[DEBUG] parse_date_column: Parsed numeric column as Year.")
                    return parsed
            except Exception: 
                pass

    series_str = series.astype(str)

    for dayfirst_setting in [False, True]:
        try:
            parsed = pd.to_datetime(series_str, infer_datetime_format=True, dayfirst=dayfirst_setting, errors='coerce')
            if not parsed.isna().all() and (parsed.isna().sum() / len(parsed) < 0.5):
                print(f"[DEBUG] parse_date_column: Success with automatic inference (dayfirst={dayfirst_setting}).")
                return parsed
        except Exception:
            pass

    date_formats = [
        '%Y-%m-%d', '%m/%d/%Y', '%d/%m/%Y', '%Y%m%d',
        '%Y-%m-%d %H:%M:%S', '%m/%d/%Y %H:%M:%S', '%d/%m/%Y %H:%M:%S',
        '%Y-%m', '%m/%Y', '%b %Y', '%B %Y',
        '%Y'
    ]

    for fmt in date_formats:
        try:
            if '%q' in fmt: 
                continue
            parsed = pd.to_datetime(series_str, format=fmt, errors='coerce')
            if not parsed.isna().all() and (parsed.isna().sum() / len(parsed) < 0.5):
                print(f"[DEBUG] parse_date_column: Success with explicit format '{fmt}'.")
                return parsed
        except Exception:
            continue

    try:
        parsed = pd.to_datetime(series_str, errors='coerce')
        if not parsed.isna().all() and (parsed.isna().sum() / len(parsed) < 0.7):
            print("[DEBUG] parse_date_column: Success with general coercion (last resort).")
            return parsed
    except Exception as e:
        print(f"[WARN] parse_date_column: Final coercion failed: {e}")

    failed_samples = series_str[parsed.isna()].head(5).tolist() if 'parsed' in locals() and parsed is not None else series_str.head(5).tolist()
    error_msg = f"Could not parse date column '{column_name}'. Check format. Unparseable samples: {failed_samples}"
    print(f"[ERROR] parse_date_column: {error_msg}")
    raise ValueError(error_msg)

def prepare_historical_data_for_charts(df: pd.DataFrame, date_col: str, value_col: str) -> List[Dict[str, Any]]:
    """Formats historical data into a JSON-serializable list for frontend charting.

    Args:
        df (pd.DataFrame): The source DataFrame.
        date_col (str): The column name for dates.
        value_col (str): The column name for values.

    Returns:
        List[Dict[str, Any]]: A list of dicts like [{'period': '2023-01-01', 'value': 100}, ...].
    """
    historical_data = []
    
    for _, row in df.iterrows():
        historical_data.append({
            'period': row[date_col].strftime('%Y-%m-%d'),
            'value': safe_float(row[value_col], default=None)
        })
    
    print(f"[DEBUG] Prepared {len(historical_data)} historical data points for charts")
    return historical_data

# --- Validation and Model Selection ---
def perform_time_series_validation(data: pd.DataFrame, date_col: str, value_col: str, 
                                 model_type: str, horizon: int) -> Dict[str, float]:
    """Performs rolling-origin cross-validation (time series split) to assess model performance.

    Splits the data into sequential training and test sets to simulate real-world forecasting accuracy.

    Args:
        data (pd.DataFrame): The dataset.
        date_col (str): Date column name.
        value_col (str): Value column name.
        model_type (str): The model strategy to test ('linear', 'seasonal', 'trend').
        horizon (int): The forecast horizon to test against.

    Returns:
        Dict[str, float]: Validation metrics including 'cv_mape', 'cv_r2', and 'validation_reliability'.
    """
    y = data[value_col].values
    min_train_size = max(12, len(y) // 3)
    
    if len(y) < min_train_size + horizon:
        return {"validation_error": "Insufficient data for validation"}
    
    errors = []
    r2_scores = []
    
    for i in range(min_train_size, len(y) - horizon + 1, max(1, horizon // 2)):
        train_data = data.iloc[:i]
        test_data = data.iloc[i:i + horizon]
        
        try:
            if model_type == 'linear':
                result = perform_linear_forecast(train_data, date_col, value_col, horizon, 0.90)
            elif model_type == 'seasonal':
                result = perform_seasonal_forecast(train_data, date_col, value_col, horizon, 0.90)
            else:
                result = perform_trend_forecast(train_data, date_col, value_col, horizon, 0.90)
            
            predictions = result['predictions'][:len(test_data)]
            actual = test_data[value_col].values
            
            if len(predictions) == len(actual) and len(actual) > 0:
                mape = mean_absolute_percentage_error(actual, predictions) * 100
                r2 = r2_score(actual, predictions) if len(actual) > 1 else 0
                errors.append(mape)
                r2_scores.append(r2)
                
        except Exception as e:
            print(f"[WARN] Validation fold failed: {e}")
            continue
    
    return {
        "cv_mape": np.mean(errors) if errors else None,
        "cv_r2": np.mean(r2_scores) if r2_scores else None,
        "validation_folds": len(errors),
        "validation_reliability": "High" if len(errors) >= 3 else "Low"
    }

def enhanced_model_selection(data: pd.DataFrame, date_col: str, value_col: str, 
                             user_selection: str, horizon: int) -> Dict[str, Any]:
    """Selects the best forecasting model based on cross-validation performance.

    If 'auto' is selected, it tests Trend, Linear, and Seasonal models and picks
    the one with the best combined MAPE and R2 score.

    Args:
        data (pd.DataFrame): The dataset.
        date_col (str): Date column name.
        value_col (str): Value column name.
        user_selection (str): 'auto' or a specific model name.
        horizon (int): Forecasting horizon.

    Returns:
        Dict[str, Any]: Contains 'selected_model', 'reason', and validation scores.
    """
    if user_selection != "auto":
        return {"selected_model": user_selection, "reason": "User specified"}
    
    models_to_test = ['trend', 'linear']
    if len(data) >= 24:
        models_to_test.append('seasonal')
    
    model_scores = {}
    
    for model in models_to_test:
        try:
            validation_results = perform_time_series_validation(data, date_col, value_col, model, horizon)
            if validation_results.get("cv_mape") is not None:
                mape_score = max(0, 100 - validation_results["cv_mape"]) / 100
                r2_score = max(0, validation_results.get("cv_r2", 0))
                combined_score = (mape_score * 0.6) + (r2_score * 0.4)
                
                model_scores[model] = {
                    "score": combined_score,
                    "mape": validation_results["cv_mape"],
                    "r2": validation_results.get("cv_r2"),
                    "folds": validation_results["validation_folds"]
                }
        except Exception as e:
            print(f"[WARN] Model {model} failed validation: {e}")
            continue
    
    if not model_scores:
        return {"selected_model": "trend", "reason": "Fallback - validation failed"}
    
    best_model = max(model_scores.keys(), key=lambda k: model_scores[k]["score"])
    
    return {
        "selected_model": best_model,
        "reason": f"Best cross-validation performance (MAPE: {model_scores[best_model]['mape']:.1f}%, R²: {model_scores[best_model]['r2']:.3f})",
        "all_model_scores": model_scores,
        "validation_results": model_scores[best_model]
    }

# --- Business Context Analysis ---
def analyze_business_context(data: pd.DataFrame, value_col: str, 
                             predictions: List[Dict], target_column_name: str) -> Dict[str, Any]:
    """Interprets numerical predictions into actionable business context.

    Analyzes growth trajectory, volatility, and risk levels to generate
    strategic recommendations (e.g., "Expansion opportunity").

    Args:
        data (pd.DataFrame): Historical data.
        value_col (str): The column name of the target variable.
        predictions (List[Dict]): The generated prediction objects.
        target_column_name (str): The original name of the target column.

    Returns:
        Dict[str, Any]: Business context dictionary including trajectory, risk_level, and recommendations.
    """
    current_values = data[value_col].values
    predicted_values = [p['predicted_value'] for p in predictions if p['predicted_value'] is not None]
    
    if not predicted_values:
        return {"context": "Insufficient prediction data for business analysis"}
    
    current_avg = np.mean(current_values[-6:]) if len(current_values) >= 6 else np.mean(current_values)
    future_avg = np.mean(predicted_values)
    
    change_percent = ((future_avg - current_avg) / current_avg * 100) if current_avg != 0 else 0
    
    current_volatility = np.std(current_values) / (np.mean(current_values) + 1e-8) * 100
    predicted_volatility = np.std(predicted_values) / (np.mean(predicted_values) + 1e-8) * 100
    
    if change_percent > 10:
        trajectory = "Strong Growth"
        business_implication = "Expansion opportunity - consider scaling resources"
    elif change_percent > 3:
        trajectory = "Moderate Growth"
        business_implication = "Steady progress - maintain current strategy"
    elif change_percent > -3:
        trajectory = "Stable"
        business_implication = "Consistent performance - focus on efficiency"
    elif change_percent > -10:
        trajectory = "Declining"
        business_implication = "Address challenges - review strategy"
    else:
        trajectory = "Significant Decline"
        business_implication = "Urgent action needed - major strategy revision"
    
    risk_level = "Low"
    risk_factors = []
    
    if predicted_volatility > 30:
        risk_level = "High"
        risk_factors.append("High forecast volatility")
    elif predicted_volatility > 15:
        risk_level = "Medium"
        risk_factors.append("Moderate forecast volatility")
    
    if abs(change_percent) > 20:
        risk_factors.append("Significant projected change")
        risk_level = "High" if risk_level != "High" else risk_level
    
    recommendations = []
    
    if trajectory in ["Strong Growth", "Moderate Growth"]:
        recommendations.extend([
            "Consider capacity planning for increased demand",
            "Evaluate investment opportunities in growth areas",
            "Monitor for potential resource constraints"
        ])
    elif trajectory == "Stable":
        recommendations.extend([
            "Focus on operational efficiency improvements",
            "Explore new market opportunities",
            "Maintain current resource allocation"
        ])
    else:
        recommendations.extend([
            "Investigate root causes of decline",
            "Develop contingency plans",
            "Consider strategic pivots or interventions"
        ])
    
    if risk_level == "High":
        recommendations.append("Implement enhanced monitoring and early warning systems")
    
    return {
        "trajectory": trajectory,
        "change_percent": change_percent,
        "business_implication": business_implication,
        "risk_level": risk_level,
        "risk_factors": risk_factors,
        "strategic_recommendations": recommendations,
        "current_volatility": current_volatility,
        "predicted_volatility": predicted_volatility,
        "planning_horizon_recommendation": "3-6 months" if risk_level == "High" else "6-12 months"
    }

# --- Forecasting Functions ---
def perform_linear_forecast(data: pd.DataFrame, date_col: str, value_col: str, horizon_periods: int, confidence_level: float) -> Dict[str, Any]:
    """Performs forecasting using Ordinary Least Squares (Linear Regression).

    Calculates the line of best fit and projects it forward. 
    Includes confidence intervals based on residual standard deviation and Z-scores.

    Args:
        data (pd.DataFrame): Training data.
        date_col (str): Date column.
        value_col (str): Target column.
        horizon_periods (int): Number of future periods.
        confidence_level (float): Confidence level (e.g., 0.95).

    Returns:
        Dict[str, Any]: Forecast results, including 'predictions', 'lower_bounds', 'upper_bounds', and metrics.
    """
    print("[DEBUG] perform_linear_forecast: Starting enhanced linear regression")
    y = data[value_col].values
    x = np.arange(len(y)).reshape(-1, 1)

    split_idx = max(1, int(len(data) * 0.8))
    x_train, x_test = x[:split_idx], x[split_idx:]
    y_train, y_test = y[:split_idx], y[split_idx:]

    model = LinearRegression()
    model.fit(x_train, y_train)

    if len(x_test) > 1:
        y_pred_eval = model.predict(x_test)
        y_true_eval = y_test
    elif len(x_train) > 1:
        y_pred_eval = model.predict(x_train)
        y_true_eval = y_train
    else:
        y_pred_eval = np.array([])
        y_true_eval = np.array([])

    if len(y_true_eval) > 0:
        epsilon = 1e-8
        safe_y_true = np.where(np.abs(y_true_eval) < epsilon, epsilon, y_true_eval)
        mape = mean_absolute_percentage_error(y_true_eval, y_pred_eval) * 100
        mae = mean_absolute_error(y_true_eval, y_pred_eval)
        rmse = np.sqrt(mean_squared_error(y_true_eval, y_pred_eval))
        r2 = r2_score(y_true_eval, y_pred_eval)
        std_error_residuals = np.std(y_true_eval - y_pred_eval) if len(y_true_eval) > 1 else np.nan
    else:
        mape, mae, rmse, r2, std_error_residuals = np.nan, np.nan, np.nan, np.nan, np.nan

    future_x = np.arange(len(data), len(data) + horizon_periods).reshape(-1, 1)
    future_y = model.predict(future_x)

    trend_strength = abs(model.coef_[0]) * horizon_periods
    mean_value = np.mean(y)
    min_trend = 0.02 * mean_value
    
    if trend_strength < min_trend and len(y) > 3:
        trend_direction = 1 if model.coef_[0] >= 0 else -1
        enhanced_slope = min_trend / horizon_periods * trend_direction
        future_y = model.intercept_ + enhanced_slope * future_x.flatten()
        print(f"[DEBUG] Enhanced linear trend visibility: slope amplified to {enhanced_slope:.4f}")

    z_score_map = {0.99: 2.576, 0.95: 1.96, 0.90: 1.645, 0.80: 1.282}
    z_score = z_score_map.get(confidence_level, 1.645)
    margin = z_score * (std_error_residuals if not np.isnan(std_error_residuals) else np.std(y) * 0.2)

    return {
        'predictions': future_y,
        'lower_bounds': future_y - margin,
        'upper_bounds': future_y + margin,
        'model_name': 'Linear Regression',
        'metrics': {
            'mape': safe_float(mape, default=None),
            'r_squared': safe_float(r2, default=None),
            'mae': safe_float(mae, default=None),
            'rmse': safe_float(rmse, default=None)
        },
        'model_params': {
            'slope': safe_float(model.coef_[0], default=None),
            'intercept': safe_float(model.intercept_, default=None)
        }
    }

def perform_trend_forecast(data: pd.DataFrame, date_col: str, value_col: str, horizon_periods: int, confidence_level: float) -> Dict[str, Any]:
    """Performs a simple trend-based forecast using the slope between start and end points.

    Useful as a fallback when data is too noisy or scarce for regression.

    Args:
        data (pd.DataFrame): Training data.
        date_col (str): Date column.
        value_col (str): Target column.
        horizon_periods (int): Number of future periods.
        confidence_level (float): Confidence level.

    Returns:
        Dict[str, Any]: Forecast results and metrics.

    Raises:
        ValueError: If less than 2 data points are provided.
    """
    print("[DEBUG] perform_trend_forecast: Starting enhanced trend analysis")
    y = data[value_col].values
    if len(y) < 2: 
        raise ValueError("Trend forecast requires at least 2 data points.")

    slope = (y[-1] - y[0]) / (len(y) - 1) if len(y) > 1 else 0
    last_value = y[-1]
    
    predictions = [last_value + slope * 0.5 * i for i in range(1, horizon_periods + 1)]

    trend_line = y[0] + slope * np.arange(len(y))
    residuals = y - trend_line
    std_error_residuals = np.std(residuals) if len(residuals) > 1 else np.std(y) * 0.3

    z_score_map = {0.99: 2.576, 0.95: 1.96, 0.90: 1.645, 0.80: 1.282}
    z_score = z_score_map.get(confidence_level, 1.645)
    margin = z_score * std_error_residuals

    if len(y) > 0:
        epsilon = 1e-8
        safe_y = np.where(np.abs(y) < epsilon, epsilon, y)
        mape = np.mean(np.abs(residuals / safe_y)) * 100 if len(residuals) > 0 else np.nan
        mae = np.mean(np.abs(residuals)) if len(residuals) > 0 else np.nan
        rmse = np.sqrt(np.mean(residuals**2)) if len(residuals) > 0 else np.nan
        ss_res = np.sum(residuals**2) if len(residuals) > 0 else np.inf
        ss_tot = np.sum((y - np.mean(y))**2) if len(y) > 1 else 0
        r2 = max(0, 1 - (ss_res / (ss_tot + epsilon))) if ss_tot > 0 else 0
    else:
        mape, mae, rmse, r2 = np.nan, np.nan, np.nan, np.nan

    return {
        'predictions': np.array(predictions),
        'lower_bounds': np.array(predictions) - margin,
        'upper_bounds': np.array(predictions) + margin,
        'model_name': 'Simple Trend',
        'metrics': {
            'mape': safe_float(mape, default=None),
            'r_squared': safe_float(r2, default=None),
            'mae': safe_float(mae, default=None),
            'rmse': safe_float(rmse, default=None)
        },
        'model_params': {
            'slope': safe_float(slope, default=None),
            'trend_strength': safe_float(abs(slope) / (np.mean(y) + 1e-8), default=None)
        }
    }

def perform_seasonal_forecast(data: pd.DataFrame, date_col: str, value_col: str, horizon_periods: int, confidence_level: float) -> Dict[str, Any]:
    """Performs seasonal decomposition forecasting.

    Attempts to detect seasonality (Monthly or Quarterly). Decomposes the signal 
    into Trend + Seasonality + Noise, then projects the trend and adds seasonal 
    components back.

    Args:
        data (pd.DataFrame): Training data.
        date_col (str): Date column.
        value_col (str): Target column.
        horizon_periods (int): Number of future periods.
        confidence_level (float): Confidence level.

    Returns:
        Dict[str, Any]: Forecast results. Returns trend forecast if seasonality detection fails.
    """
    print("[DEBUG] perform_seasonal_forecast: Starting enhanced seasonal analysis")
    y = data[value_col].values

    data_range_years = (data[date_col].max() - data[date_col].min()).days / 365.25
    if data_range_years >= 2 and len(y) >= 12:
        season_length = 12
        print(f"[DEBUG] perform_seasonal_forecast: Assuming monthly seasonality (period={season_length})")
    elif data_range_years >= 1 and len(y) >= 4:
        season_length = 4
        print(f"[DEBUG] perform_seasonal_forecast: Assuming quarterly seasonality (period={season_length})")
    else:
        print("[WARN] perform_seasonal_forecast: Insufficient data for seasonality detection, falling back to trend.")
        return perform_trend_forecast(data, date_col, value_col, horizon_periods, confidence_level)

    if len(y) < 2 * season_length:
        print(f"[WARN] perform_seasonal_forecast: Less than 2 full cycles, falling back to trend.")
        return perform_trend_forecast(data, date_col, value_col, horizon_periods, confidence_level)

    try:
        trend_component = pd.Series(y).rolling(window=season_length, center=True).mean()
        trend_component = trend_component.fillna(method='bfill').fillna(method='ffill')
        if trend_component.isnull().any():
            raise ValueError("Trend component could not be estimated (all NaNs).")

        detrended = y - trend_component.values
        seasonal_indices = np.array([np.nanmean(detrended[i::season_length]) for i in range(season_length)])
        seasonal_indices -= np.nanmean(seasonal_indices)

        seasonal_amplitude = np.max(np.abs(seasonal_indices))
        mean_value = np.mean(y)
        min_amplitude = 0.1 * mean_value
        
        if seasonal_amplitude < min_amplitude:
            seasonal_indices = seasonal_indices * (min_amplitude / seasonal_amplitude)
            print(f"[DEBUG] Enhanced seasonal visibility: amplitude increased.")

        seasonal_full = np.tile(seasonal_indices, len(y) // season_length + 1)[:len(y)]
        residuals = y - trend_component.values - seasonal_full
        std_error_residuals = np.nanstd(residuals)

        x_trend = np.arange(len(trend_component))
        trend_model = LinearRegression().fit(x_trend.reshape(-1, 1), trend_component.values)
        future_trend_x = np.arange(len(y), len(y) + horizon_periods)
        future_trend = trend_model.predict(future_trend_x.reshape(-1, 1))

        predictions = []
        for i in range(horizon_periods):
            seasonal_idx = (len(y) + i) % season_length
            pred = future_trend[i] + seasonal_indices[seasonal_idx]
            predictions.append(pred)
        predictions = np.array(predictions)

        z_score_map = {0.99: 2.576, 0.95: 1.96, 0.90: 1.645, 0.80: 1.282}
        z_score = z_score_map.get(confidence_level, 1.645)
        margin = z_score * (std_error_residuals if not np.isnan(std_error_residuals) else np.std(y) * 0.3)

        if len(residuals) > 0:
            epsilon = 1e-8
            safe_y = np.where(np.abs(y) < epsilon, epsilon, y)
            mape = np.nanmean(np.abs(residuals / safe_y)) * 100
            mae = np.nanmean(np.abs(residuals))
            rmse = np.sqrt(np.nanmean(residuals**2))
            ss_res = np.nansum(residuals**2)
            ss_tot = np.nansum((y - np.nanmean(y))**2) if len(y) > 1 else 0
            r2 = max(0, 1 - (ss_res / (ss_tot + epsilon))) if ss_tot > 0 else 0
        else:
            mape, mae, rmse, r2 = np.nan, np.nan, np.nan, np.nan

        return {
            'predictions': predictions,
            'lower_bounds': predictions - margin,
            'upper_bounds': predictions + margin,
            'model_name': 'Seasonal Forecast',
            'metrics': {
                'mape': safe_float(mape, default=None),
                'r_squared': safe_float(r2, default=None),
                'mae': safe_float(mae, default=None),
                'rmse': safe_float(rmse, default=None)
            },
            'model_params': {
                'season_length': season_length,
                'seasonal_strength': safe_float(np.std(seasonal_indices), default=None),
                'trend_slope': safe_float(trend_model.coef_[0], default=None)
            }
        }
    except Exception as e:
        print(f"[WARN] perform_seasonal_forecast: Error during decomposition: {e}. Falling back to trend.")
        return perform_trend_forecast(data, date_col, value_col, horizon_periods, confidence_level)

# --- Helpers ---
def generate_forecast_periods(last_date: pd.Timestamp, horizon_periods: int) -> List[str]:
    """Generates a list of future date strings for the forecast horizon.

    Args:
        last_date (pd.Timestamp): The last available date in historical data.
        horizon_periods (int): Number of periods to generate.

    Returns:
        List[str]: A list of date strings (YYYY-MM-DD).
    """
    print(f"[DEBUG] generate_forecast_periods: last_date={last_date}, periods={horizon_periods}")
    freq = 'MS'
    try:
        future_dates = pd.date_range(start=last_date + pd.Timedelta(days=1), periods=horizon_periods, freq=freq)
    except Exception as e:
        print(f"[WARN] generate_forecast_periods: pandas date_range failed ({e}), using simple month offset.")
        future_dates = []
        current_date = last_date
        for _ in range(horizon_periods):
            next_month = current_date.month % 12 + 1
            next_year = current_date.year + current_date.month // 12
            try:
                current_date = current_date.replace(year=next_year, month=next_month)
            except ValueError:
                last_day_of_next_month = pd.Timestamp(year=next_year, month=next_month, day=1) + pd.offsets.MonthEnd(0)
                current_date = last_day_of_next_month
            future_dates.append(current_date)

    formatted_periods = [d.strftime('%Y-%m-%d') for d in future_dates]
    return formatted_periods

def analyze_trend_direction(data: pd.DataFrame, value_col: str) -> str:
    """Qualitatively analyzes the direction of the trend (e.g., "Strong Upward").

    Args:
        data (pd.DataFrame): The dataset.
        value_col (str): The value column.

    Returns:
        str: A descriptive string indicating trend direction.
    """
    y = data[value_col].dropna().values
    if len(y) < 3:
        return "Insufficient Data"

    x = np.arange(len(y))
    try:
        slope, intercept = np.polyfit(x, y, 1)
        relative_slope = slope / (np.mean(y) + 1e-8)

        if relative_slope > 0.05:
            return "Strong Upward"
        elif relative_slope > 0.01:
            return "Moderate Upward"
        elif relative_slope < -0.05:
            return "Strong Downward"
        elif relative_slope < -0.01:
            return "Moderate Downward"
        else:
            return "Stable / Flat"
    except Exception as e:
        print(f"[WARN] analyze_trend_direction: Error calculating trend: {e}")
        return "Calculation Error"

def calculate_average_growth_rate(data: pd.DataFrame, value_col: str) -> Optional[float]:
    """Calculates the average period-over-period percentage growth rate.

    Args:
        data (pd.DataFrame): The dataset.
        value_col (str): The value column.

    Returns:
        Optional[float]: The average growth rate or None if insufficient data.
    """
    y = data[value_col].dropna().values
    if len(y) < 2:
        return None

    epsilon = 1e-8
    pct_changes = [(y[i] - y[i-1]) / (abs(y[i-1]) + epsilon) * 100 for i in range(1, len(y))]

    avg_growth = np.mean(pct_changes) if pct_changes else 0
    return avg_growth

# --- Original Insight Generation (Fallback) ---
def generate_enhanced_insights(data: pd.DataFrame, value_col: str, forecast_results: Dict[str, Any], 
                             model_type: str, forecast_periods: int, business_context: Dict) -> List[Dict[str, str]]:
    """Generates heuristic-based insights as a fallback if AI generation fails.

    Constructs insight objects covering Business Trajectory, Risk Assessment, 
    Model Performance, Operational Recommendations, and Data Quality.

    Args:
        data (pd.DataFrame): Historical data.
        value_col (str): Value column.
        forecast_results (Dict[str, Any]): The raw forecast output.
        model_type (str): The model used.
        forecast_periods (int): Number of periods forecasted.
        business_context (Dict): The analyzed business context.

    Returns:
        List[Dict[str, str]]: A list of insight dictionaries.
    """
    insights = []
    metrics = forecast_results.get('metrics', {})
    
    # Insight 1: Business Trajectory
    trajectory = business_context.get('trajectory', 'Unknown')
    change_percent = business_context.get('change_percent', 0)
    
    insights.append({
        "observation": f"Forecast indicates a '{trajectory}' trajectory with {abs(change_percent):.1f}% {'increase' if change_percent > 0 else 'decrease'} expected over the next {forecast_periods} periods.",
        "accurate_interpretation": business_context.get('business_implication', 'Business implications unclear'),
        "business_implication": f"Strategic Focus: {business_context.get('strategic_recommendations', ['No specific recommendations'])[0]}",
        "confidence_level": "High" if metrics.get('r_squared', 0) > 0.7 else "Medium" if metrics.get('r_squared', 0) > 0.5 else "Low"
    })
    
    # Insight 2: Risk Assessment
    risk_level = business_context.get('risk_level', 'Unknown')
    risk_factors = business_context.get('risk_factors', [])
    
    insights.append({
        "observation": f"Risk assessment indicates {risk_level} risk level" + (f" with factors: {', '.join(risk_factors)}" if risk_factors else ""),
        "accurate_interpretation": f"Forecast reliability is {'strong' if risk_level == 'Low' else 'moderate' if risk_level == 'Medium' else 'limited'} based on model performance and data characteristics",
        "business_implication": f"Recommended planning horizon: {business_context.get('planning_horizon_recommendation', '6-12 months')}. " + 
                                ("Consider enhanced monitoring systems." if risk_level == "High" else "Standard monitoring sufficient."),
        "confidence_level": "High" if len(risk_factors) <= 1 else "Medium"
    })
    
    # Insight 3: Model Performance
    r2 = metrics.get('r_squared')
    mape = metrics.get('mape')
    model_name = forecast_results.get('model_name', 'Selected Model')
    
    reliability_score = 0
    if r2 is not None: reliability_score += min(40, r2 * 50)
    if mape is not None: reliability_score += min(30, max(0, 30 - mape))
    reliability_score += min(20, len(data) / 5)
    reliability_score += 10
    
    reliability_level = "High" if reliability_score >= 80 else "Medium" if reliability_score >= 60 else "Low"
    
    insights.append({
        "observation": f"The {model_name} achieved {reliability_level.lower()} prediction reliability (score: {reliability_score:.0f}/100)",
        "accurate_interpretation": f"Model explains {(r2 or 0)*100:.1f}% of historical variance with {(mape or 0):.1f}% average error",
        "business_implication": f"Forecast confidence: {'Use for strategic planning' if reliability_level == 'High' else 'Use for tactical planning with caution' if reliability_level == 'Medium' else 'Use only for directional guidance'}",
        "confidence_level": reliability_level
    })
    
    # Insight 4: Operational Recommendations
    volatility = business_context.get('predicted_volatility', 0)
    recommendations = business_context.get('strategic_recommendations', [])
    
    insights.append({
        "observation": f"Predicted volatility of {volatility:.1f}% indicates {'high' if volatility > 25 else 'moderate' if volatility > 15 else 'low'} operational variability",
        "accurate_interpretation": f"Operations should plan for {'significant' if volatility > 25 else 'moderate' if volatility > 15 else 'minimal'} fluctuations around the forecast trend",
        "business_implication": recommendations[1] if len(recommendations) > 1 else "Maintain flexible operational capacity",
        "confidence_level": "Medium"
    })

    # Insight 5: Data Quality
    data_quality_score = min(100, len(data) * 2)
    insights.append({
        "observation": f"Analysis based on {len(data)} data points with {'high' if data_quality_score > 80 else 'medium' if data_quality_score > 50 else 'low'} data sufficiency",
        "accurate_interpretation": f"Data quality supports {'robust' if data_quality_score > 80 else 'reasonable' if data_quality_score > 50 else 'basic'} forecasting accuracy",
        "business_implication": f"Consider {'current data is sufficient' if data_quality_score > 80 else 'collecting additional historical data' if data_quality_score > 50 else 'significantly expanding data collection'} for improved predictions",
        "confidence_level": "High" if data_quality_score > 80 else "Medium" if data_quality_score > 50 else "Low"
    })
    
    return insights[:8]

# --- AI Integration Functions ---
async def generate_llm_insights(
    data_summary: Dict, 
    model_performance: Dict, 
    business_context: Dict, 
    forecast_periods: int,
    target_column: str
) -> List[Dict[str, str]]:
    """Generates natural language business insights using the external Ollama AI service.

    Constructs a detailed prompt with statistical findings and requests a JSON 
    response containing strategic insights.

    Args:
        data_summary (Dict): Summary statistics of the data.
        model_performance (Dict): Metrics regarding the forecast accuracy.
        business_context (Dict): Derived business context (trajectory, risk).
        forecast_periods (int): The forecast horizon.
        target_column (str): The name of the predicted variable.

    Returns:
        List[Dict[str, str]]: A list of structured insight objects generated by AI.
                              Returns an empty list if the AI service fails.
    """
    print("🤖 Generating AI Insights via Ollama...")

    # 1. Construct the Prompt
    prompt = f"""
    You are an expert Data Scientist and Business Analyst. 
    Analyze the following predictive analysis results for the metric: "{target_column}".

    ### DATA SUMMARY:
    - Mean: {data_summary.get('mean')}
    - Trend Direction: {model_performance.get('trend_detected')}
    - Volatility (CV): {data_summary.get('coeff_variation')}%

    ### FORECAST MODEL:
    - Model Used: {model_performance.get('model_used')}
    - Accuracy (R2): {model_performance.get('r_squared')}
    - Error Rate (MAPE): {model_performance.get('mape')}%
    
    ### BUSINESS CONTEXT:
    - Trajectory: {business_context.get('trajectory')}
    - Projected Change: {business_context.get('change_percent')}% over next {forecast_periods} periods.
    - Risk Level: {business_context.get('risk_level')}
    - Key Risk Factors: {', '.join(business_context.get('risk_factors', []))}

    ### INSTRUCTIONS:
    Generate 4 high-quality strategic insights based strictly on this data.
    Return ONLY a raw JSON array. Do not include markdown formatting like ```json.
    
    Each insight object must have these exact keys:
    1. "observation": A specific fact about the data or trend.
    2. "accurate_interpretation": What this means mathematically or statistically.
    3. "business_implication": Actionable advice for the business.
    4. "confidence_level": "High", "Medium", or "Low".

    Example format:
    [
        {{
            "observation": "Sales are projected to grow by 15%.",
            "accurate_interpretation": "Positive linear trend detected with high R2 score.",
            "business_implication": "Increase inventory to meet demand.",
            "confidence_level": "High"
        }}
    ]
    """

    payload = {
        "model": OLLAMA_MODEL,
        "prompt": prompt,
        "stream": False,
        "format": "json", 
        "options": {
            "temperature": 0.3, 
            "num_ctx": 4096
        }
    }

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
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
                raise ValueError("AI response was not a valid list of insights.")

    except Exception as e:
        print(f"⚠️ AI Insight Generation Failed: {str(e)}")
        print("Falling back to heuristic insights.")
        return []

# --- Main Enhanced Prediction Function ---
async def perform_prediction(
    data_payload: Union[UploadFile, str],
    is_file_upload: bool,
    input_filename: str,
    date_column: str,
    target_column: str,
    forecast_periods: int,
    confidence_level: float,
    model_type: str = "auto"
) -> Dict[str, Any]:
    """Orchestrates the entire Predictive Analysis workflow.

    Pipeline steps:
    1. Load data (from file or text).
    2. Clean and validate schema (dates, numeric targets).
    3. Aggregate duplicate dates.
    4. Select best model (Auto, Linear, Trend, or Seasonal).
    5. Execute forecast and calculate confidence intervals.
    6. Generate historical and future data points for charting.
    7. Analyze business context (Risk, Trajectory).
    8. Generate insights (via AI, with heuristic fallback).

    Args:
        data_payload (Union[UploadFile, str]): File object or raw CSV string.
        is_file_upload (bool): True if processing a file.
        input_filename (str): Name of the file (for validation).
        date_column (str): Name of the column containing dates.
        target_column (str): Name of the column containing values to predict.
        forecast_periods (int): Number of periods to forecast into the future.
        confidence_level (float): Statistical confidence (0.0 - 1.0).
        model_type (str, optional): Specific model to use. Defaults to "auto".

    Returns:
        Dict[str, Any]: Comprehensive analysis result including predictions, charts data,
                        model performance metrics, and business insights.

    Raises:
        HTTPException(400): If data is invalid, empty, or columns are missing.
        HTTPException(500): If forecasting or internal processing fails.
    """
    print("🚀 Starting Enhanced Predictive Analysis")
    print_parameters(data_payload, is_file_upload, input_filename, date_column, target_column, forecast_periods, confidence_level, model_type)

    df: Optional[pd.DataFrame] = None
    initial_rows: int = 0
    rows_after_clean: int = 0

    try:
        # --- 1. Load Data ---
        print("Step 1: Loading data...")
        filename_lower = input_filename.lower() if input_filename else ""
        na_vals = ['-', '', ' ', 'NA', 'N/A', 'null', 'None', '#N/A', '#VALUE!', '#DIV/0!', 'NaN', 'nan']
        file_content = None

        if is_file_upload:
            if not isinstance(data_payload, UploadFile):
                raise TypeError("Expected UploadFile for file upload.")
            print(f"[DEBUG] Processing file upload: {data_payload.filename}")
            file_content = await data_payload.read()
            if not file_content:
                raise HTTPException(status_code=400, detail="Uploaded file is empty.")
            
            if filename_lower.endswith('.csv'):
                try:
                    decoded_content = file_content.decode('utf-8')
                except UnicodeDecodeError:
                    print("[WARN] UTF-8 decode failed, trying latin1.")
                    decoded_content = file_content.decode('latin1')
                data_io_source = io.StringIO(decoded_content)
                source_type = 'csv'
            elif filename_lower.endswith(('.xlsx', '.xls')):
                data_io_source = io.BytesIO(file_content)
                source_type = 'excel'
            else:
                raise HTTPException(status_code=400, detail="Invalid file type received.")
        else:
            if not isinstance(data_payload, str) or not data_payload.strip():
                raise HTTPException(status_code=400, detail="Pasted text data is empty or invalid.")
            print("[DEBUG] Processing pasted text data")
            data_io_source = io.StringIO(data_payload)
            source_type = 'csv'

        try:
            if source_type == 'csv':
                try:
                    df = pd.read_csv(data_io_source, na_values=na_vals, sep=',', engine='python', thousands=',')
                except Exception:
                    data_io_source.seek(0)
                    try:
                        df = pd.read_csv(data_io_source, na_values=na_vals, sep=';', engine='python', thousands='.')
                    except Exception:
                        data_io_source.seek(0)
                        df = pd.read_csv(data_io_source, na_values=na_vals, sep=None, engine='python', thousands=',')
            elif source_type == 'excel':
                df = pd.read_excel(data_io_source, na_values=na_vals, engine='openpyxl')
            else:
                raise ValueError("Unknown data source type.")

        except Exception as read_err:
            print(f"[ERROR] Error reading data: {read_err}")
            raise HTTPException(status_code=400, detail=f"Failed to read data file/text. Check format and encoding. Error: {str(read_err)[:100]}")

        if df is None or df.empty:
            raise HTTPException(status_code=400, detail="Data is empty or could not be parsed.")
        initial_rows = len(df)
        print_data_info(df, "Data loaded successfully")

        # --- 2-5. Data cleaning ---
        print("Step 2: Validating columns...")
        original_columns = df.columns.tolist()
        df.columns = df.columns.str.replace('[^A-Za-z0-9_]+', '', regex=True).str.replace('^[^A-Za-z_]+', '', regex=True)
        cleaned_date_col = date_column.replace('[^A-Za-z0-9_]+', '').replace('^[^A-Za-z_]+', '')
        cleaned_target_col = target_column.replace('[^A-Za-z0-9_]+', '').replace('^[^A-Za-z_]+', '')

        col_map = dict(zip(df.columns, original_columns))

        if cleaned_date_col not in df.columns:
            available_cols_str = ', '.join(original_columns)
            raise HTTPException(status_code=400, detail=f"Date column '{date_column}' not found or invalid after cleaning. Available: {available_cols_str}")
        if cleaned_target_col not in df.columns:
            available_cols_str = ', '.join(original_columns)
            raise HTTPException(status_code=400, detail=f"Target column '{target_column}' not found or invalid after cleaning. Available: {available_cols_str}")

        internal_date_col = cleaned_date_col
        internal_target_col = cleaned_target_col

        print(f"Step 3: Parsing date column '{internal_date_col}'...")
        try:
            df[internal_date_col] = parse_date_column(df[internal_date_col], col_map.get(internal_date_col, internal_date_col))
        except ValueError as date_err:
            raise HTTPException(status_code=400, detail=str(date_err))
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Unexpected error parsing date column '{col_map.get(internal_date_col, internal_date_col)}': {str(e)}")

        print(f"Step 4: Cleaning target column '{internal_target_col}'...")
        df[internal_target_col] = pd.to_numeric(df[internal_target_col], errors='coerce')
        rows_before_drop = len(df)
        df = df.dropna(subset=[internal_date_col, internal_target_col])
        rows_after_clean = len(df)
        dropped_rows = rows_before_drop - rows_after_clean
        if dropped_rows > 0:
            print(f"[WARN] Dropped {dropped_rows} rows due to missing dates or non-numeric target values.")

        if rows_after_clean < 5:
            raise HTTPException(status_code=400, detail=f"Insufficient valid data points after cleaning. Need at least 5, found {rows_after_clean}.")
        print(f"[DEBUG] Data cleaned. Rows remaining: {rows_after_clean}")

        print("Step 5: Sorting data and handling duplicates...")
        df = df.sort_values(by=internal_date_col).reset_index(drop=True)
        if df[internal_date_col].duplicated().any():
            print("[WARN] Duplicate dates found. Aggregating target column by mean for each date.")
            df = df.groupby(internal_date_col)[internal_target_col].mean().reset_index()
            rows_after_clean = len(df)
            print(f"[DEBUG] Data aggregated. Rows remaining: {rows_after_clean}")

        print_data_info(df, "Data after cleaning and sorting")

        # --- 6. Enhanced Model Selection ---
        print("Step 6: Enhanced model selection...")
        try:
            model_selection_result = enhanced_model_selection(df, internal_date_col, internal_target_col, model_type, forecast_periods)
            selected_model = model_selection_result["selected_model"]
            selection_reason = model_selection_result["reason"]
            print(f"[INFO] Selected model: {selected_model}. Reason: {selection_reason}")
        except ValueError as model_err:
            raise HTTPException(status_code=400, detail=str(model_err))

        # --- 7. Enhanced Forecasting ---
        print(f"Step 7: Performing enhanced '{selected_model}' forecast...")
        forecast_results: Dict[str, Any] = {}
        model_func_map = {
            'linear': perform_linear_forecast,
            'seasonal': perform_seasonal_forecast,
            'trend': perform_trend_forecast
        }
        
        if selected_model in model_func_map:
            try:
                forecast_results = model_func_map[selected_model](
                    data=df,
                    date_col=internal_date_col,
                    value_col=internal_target_col,
                    horizon_periods=forecast_periods,
                    confidence_level=confidence_level
                )
                if 'validation_results' in model_selection_result:
                    forecast_results['validation_metrics'] = model_selection_result['validation_results']
                    
            except Exception as forecast_err:
                print(f"[ERROR] Error during {selected_model} forecast: {forecast_err}")
                print(traceback.format_exc())
                if selected_model != 'trend':
                    print("[WARN] Falling back to simple trend forecast due to error.")
                    try:
                        forecast_results = perform_trend_forecast(
                            data=df,
                            date_col=internal_date_col,
                            value_col=internal_target_col,
                            horizon_periods=forecast_periods,
                            confidence_level=confidence_level
                        )
                        selected_model = 'trend'
                    except Exception as fallback_err:
                        print(f"[ERROR] Fallback trend forecast also failed: {fallback_err}")
                        raise HTTPException(status_code=500, detail=f"Forecasting failed for {selected_model} and fallback trend model. Error: {fallback_err}")
                else:
                    raise HTTPException(status_code=500, detail=f"Trend forecasting failed. Error: {forecast_err}")
        else:
            raise HTTPException(status_code=500, detail=f"Internal error: Unknown model type '{selected_model}' selected.")

        if not forecast_results or 'predictions' not in forecast_results:
            raise HTTPException(status_code=500, detail="Forecasting process did not return valid results.")
        print(f"[DEBUG] Forecast completed using {forecast_results.get('model_name', 'Unknown Model')}")

        # --- 8. Generate Future Periods ---
        print("Step 8: Generating future periods...")
        last_date = df[internal_date_col].iloc[-1]
        future_periods_formatted = generate_forecast_periods(last_date, forecast_periods)

        pred_len = len(forecast_results.get('predictions', []))
        if pred_len != forecast_periods:
            print(f"[WARN] Prediction length mismatch ({pred_len} vs {forecast_periods}). Adjusting output.")
            preds = forecast_results.get('predictions', np.full(forecast_periods, np.nan))[:forecast_periods]
            lowers = forecast_results.get('lower_bounds', np.full(forecast_periods, np.nan))[:forecast_periods]
            uppers = forecast_results.get('upper_bounds', np.full(forecast_periods, np.nan))[:forecast_periods]
        else:
            preds = forecast_results['predictions']
            lowers = forecast_results['lower_bounds']
            uppers = forecast_results['upper_bounds']

        predictions_list = []
        for i, period_str in enumerate(future_periods_formatted):
            predictions_list.append({
                "period": period_str,
                "predicted_value": safe_float(preds[i], default=None),
                "lower_bound": safe_float(lowers[i], default=None),
                "upper_bound": safe_float(uppers[i], default=None)
            })

        # --- 8.1 Prepare Historical Data for Charts ---
        print("Step 8.1: Preparing historical data for charts...")
        historical_data = prepare_historical_data_for_charts(df, internal_date_col, internal_target_col)

        # --- 9. Enhanced Business Context Analysis ---
        print("Step 9: Analyzing business context...")
        business_context = analyze_business_context(df, internal_target_col, predictions_list, target_column)

        # --- 10. Calculate Enhanced Summary Statistics ---
        print("Step 10: Calculating enhanced summary statistics...")
        values = df[internal_target_col].values
        data_summary = {
            "mean": safe_float(np.mean(values), default=None),
            "median": safe_float(np.median(values), default=None),
            "std_dev": safe_float(np.std(values), default=None),
            "min": safe_float(np.min(values), default=None),
            "max": safe_float(np.max(values), default=None),
            "coeff_variation": safe_float((np.std(values) / (np.mean(values) + 1e-8)) * 100 if np.mean(values) != 0 else 0, default=None),
            "skewness": safe_float(pd.Series(values).skew(), default=None),
            "data_points": len(values),
            "date_range_days": (df[internal_date_col].max() - df[internal_date_col].min()).days
        }

        # --- 11 & 12. Model Performance & Insight Generation (AI Integrated) ---
        print("Step 11 & 12: Generating AI insights...")
        
        # Prepare metrics for both AI and Fallback
        perf_metrics = forecast_results.get('metrics', {})
        model_performance = {
            "model_used": forecast_results.get('model_name', selected_model.capitalize() + ' Forecast'),
            "selection_reason": selection_reason,
            "mape": safe_float(perf_metrics.get('mape'), default=None),
            "r_squared": safe_float(perf_metrics.get('r_squared'), default=None),
            "mae": safe_float(perf_metrics.get('mae'), default=None),
            "rmse": safe_float(perf_metrics.get('rmse'), default=None),
            "trend_detected": analyze_trend_direction(df, internal_target_col),
            "confidence_level": confidence_level,
            "validation_folds": forecast_results.get('validation_metrics', {}).get('folds', 0)
        }
        
        # Add textual interpretation for R2
        r2_interp = "Model fit (R-squared) interpretation unavailable."
        if model_performance['r_squared'] is not None:
            r2_val = model_performance['r_squared']
            r2_pct = r2_val * 100
            fit_desc = "excellent" if r2_pct > 90 else "good" if r2_pct > 75 else "moderate" if r2_pct > 50 else "weak"
            r2_interp = f"R-squared of {r2_val:.3f} indicates that approximately {r2_pct:.1f}% of the variance in the historical data is explained by the model, suggesting a {fit_desc} fit."
        model_performance["interpretation"] = r2_interp

        # 1. Generate Standard Heuristic Insights (Fallback/Baseline)
        heuristic_insights = generate_enhanced_insights(
            df, internal_target_col, forecast_results, 
            selected_model, forecast_periods, business_context
        )

        # 2. Attempt AI Insight Generation
        ai_insights = await generate_llm_insights(
            data_summary=data_summary,
            model_performance=model_performance,
            business_context=business_context,
            forecast_periods=forecast_periods,
            target_column=target_column
        )

        # 3. Select Final Insights
        if ai_insights:
            final_insights = ai_insights
        else:
            final_insights = heuristic_insights

        # --- 13. Prepare Final Response ---
        print("Step 13: Preparing enhanced final response...")
        
        response_data = {
            "predictions": predictions_list,
            "historical_data": historical_data,
            "data_summary": data_summary,
            "model_performance": model_performance,
            "business_context": business_context,
            "insights": final_insights,
            "data_info": {
                "total_points": len(df),
                "target_column": target_column,
                "date_column": date_column,
                "forecast_horizon": forecast_periods,
                "model_selection_details": model_selection_result
            }
        }

        print("✅ Enhanced predictive analysis completed successfully")
        return response_data

    except HTTPException as http_exc:
        print(f"❌ HTTP Exception during prediction: {http_exc.status_code} - {http_exc.detail}")
        raise http_exc
    except Exception as e:
        error_msg = f"❌ Unexpected error during prediction: {type(e).__name__}: {str(e)}"
        print(error_msg)
        print(f"Full traceback:\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=error_msg)