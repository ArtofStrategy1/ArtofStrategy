# analysis_modules/visualization_analysis.py

import io
import pandas as pd
import numpy as np
import traceback
import json
import httpx
from typing import Optional, Dict, Any, Union, List, Tuple
from starlette.datastructures import UploadFile
from fastapi import HTTPException
from collections import Counter
from datetime import datetime, timedelta
import warnings
warnings.filterwarnings('ignore')

# --- OLLAMA Configuration ---
OLLAMA_URL = "https://ollama.data2int.com/api/generate"
OLLAMA_MODEL = "llama3.1:latest" # Use the model you prefer

# --- JSON Serialization Helper (Corrected for Array/Series check) ---
def convert_numpy_types(obj):
    """Convert numpy/pandas types to native Python types for JSON serialization, handling NaN/Inf and arrays."""
    
    # --- NEW: Check for collections FIRST ---
    # 1. Check for dicts (recurse)
    if isinstance(obj, dict):
        return {key: convert_numpy_types(value) for key, value in obj.items()}
    
    # 2. Check for list-like types (recurse)
    # This now correctly catches np.ndarray and pd.Series *before* the isna() check
    if isinstance(obj, (list, tuple, np.ndarray, pd.Series, pd.Index)):
        return [convert_numpy_types(item) for item in obj]
    
    # --- Now it's safe to check for single values ---
    
    # 3. Handle None / pd.NA / np.nan (after collection checks)
    # pd.isna() is safe here because we know obj is not an array/list
    if obj is None or pd.isna(obj):
        return None
    
    # 4. Handle numpy integers
    if isinstance(obj, np.integer):
        return int(obj)
    
    # 5. Handle numpy floats
    if isinstance(obj, np.floating):
        # Check for NaN, Infinity, -Infinity
        if np.isnan(obj) or np.isinf(obj):
            return None  # JSON standard does not support NaN/Inf
        return float(obj)
    
    # 6. Handle numpy boolean
    if isinstance(obj, np.bool_):
        return bool(obj)
        
    # 7. Handle other single numpy values (like np.int64, np.float64)
    if hasattr(obj, 'item'):
        # Extract the Python native type and recurse
        return convert_numpy_types(obj.item())
    
    # 8. Handle standard Python floats (just in case)
    if isinstance(obj, float):
        if np.isnan(obj) or np.isinf(obj):
            return None
        return obj

    # 9. Return all other types as-is (e.g., str)
    return obj

# --- Helper to load data ---
async def load_dataframe(
    data_payload: Union[UploadFile, str],
    is_file_upload: bool,
    input_filename: str
) -> pd.DataFrame:
    """Load data from file upload or text input"""
    print("📊 Loading data for visualization analysis...")
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
        
        # --- NEW: Clean column names ---
        df.columns = df.columns.str.replace(r'[^\w\s]', '', regex=True).str.replace(' ', '_')
        print(f"✅ Data loaded. Cleaned columns: {df.columns.tolist()}")
        return df

    except Exception as e:
        print(f"❌ Error loading data: {e}\n{traceback.format_exc()}")
        raise HTTPException(status_code=400, detail=f"Failed to read data: {e}")

# --- NEW: Helper to load context file ---
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

# --- Data Type Detection (Unchanged) ---
def detect_column_types(df: pd.DataFrame) -> Dict[str, Dict[str, Any]]:
    """Detect and categorize column types for visualization recommendations"""
    column_info = {}
    
    for col in df.columns:
        series = df[col].dropna()
        if len(series) == 0:
            info = {'name': col, 'data_type': 'empty', 'unique_count': 0, 'null_count': len(df[col])}
            column_info[col] = info
            continue
            
        info = {
            'name': col,
            'total_count': len(df[col]),
            'null_count': df[col].isnull().sum(),
            'unique_count': series.nunique(),
            'data_type': 'unknown'
        }
        
        # Try to convert to numeric
        numeric_series = pd.to_numeric(series, errors='coerce')
        numeric_ratio = numeric_series.notna().sum() / len(series)
        
        # Try to convert to datetime
        datetime_converted = 0
        try:
            # More robust datetime parsing
            if series.astype(str).str.match(r'^\d{4}-\d{2}-\d{2}$').all():
                pd.to_datetime(series, format='%Y-%m-%d', errors='raise')
                datetime_converted = len(series)
            elif series.astype(str).str.match(r'^\d{1,2}/\d{1,2}/\d{4}$').all():
                pd.to_datetime(series, format='%m/%d/%Y', errors='raise')
                datetime_converted = len(series)
            else:
                # General fallback
                pd.to_datetime(series, errors='raise')
                datetime_converted = len(series)
        except:
            pass
        
        datetime_ratio = datetime_converted / len(series)
        
        # Determine primary type
        if numeric_ratio > 0.8:
            if series.nunique() < 10 and all(isinstance(x, (int, float)) and x == int(x) for x in numeric_series.dropna()):
                info['data_type'] = 'categorical_numeric'
            else:
                info['data_type'] = 'numerical'
            info['min_value'] = float(numeric_series.min())
            info['max_value'] = float(numeric_series.max())
            info['mean_value'] = float(numeric_series.mean())
        elif datetime_ratio > 0.8:
            info['data_type'] = 'datetime'
            info['sample_values'] = series.head(5).astype(str).tolist()
        elif series.nunique() < len(series) * 0.5:
            info['data_type'] = 'categorical'
            info['top_categories'] = {str(k): int(v) for k, v in series.value_counts().head(10).to_dict().items()}
        else:
            info['data_type'] = 'text'
            info['sample_values'] = series.head(5).astype(str).tolist()
        
        column_info[col] = info
    
    return column_info

# --- Chart Generation Functions (Updated) ---

def create_frequency_table(df: pd.DataFrame, column: str, max_categories: int = 50) -> Dict[str, Any]:
    """Create frequency table for categorical or numerical columns"""
    series = df[column].dropna()
    value_counts = series.value_counts().head(max_categories)
    
    # Calculate percentages and cumulative percentages
    total_count = len(series)
    percentages = (value_counts / total_count * 100).round(2)
    cumulative_count = value_counts.cumsum()
    cumulative_percentage = (cumulative_count / total_count * 100).round(2)
    
    frequency_data = []
    for i, (value, count) in enumerate(value_counts.items()):
        frequency_data.append({
            "value": str(value),
            "frequency": int(count),
            "percentage": float(percentages.iloc[i]),
            "cumulative_frequency": int(cumulative_count.iloc[i]),
            "cumulative_percentage": float(cumulative_percentage.iloc[i])
        })
    
    return {
        "chart_type": "frequency_table",
        "title": f"Frequency Table for {column}",
        "data": {
            "table": frequency_data,
            "total_count": int(total_count),
            "unique_values": int(len(value_counts)),
            "statistics": {
                "mode": str(value_counts.index[0]) if not value_counts.empty else "N/A",
                "mode_frequency": int(value_counts.iloc[0]) if not value_counts.empty else 0,
                "mode_percentage": float(percentages.iloc[0]) if not percentages.empty else 0
            }
        },
        "x_label": column,
        "y_label": "Frequency"
    }

def create_histogram(df: pd.DataFrame, column: str, bins: int = 30) -> Dict[str, Any]:
    """Create histogram data for numerical columns"""
    series = pd.to_numeric(df[column], errors='coerce').dropna()
    
    if len(series) == 0:
        return {"error": f"No valid numerical data found for histogram in column {column}"}
    
    # Calculate histogram
    counts, bin_edges = np.histogram(series, bins=bins)
    
    # Create bin labels (midpoints)
    bin_centers = [(bin_edges[i] + bin_edges[i+1]) / 2 for i in range(len(bin_edges)-1)]
    
    return {
        "chart_type": "histogram",
        "title": f"Distribution of {column}",
        "data": {
            "values": series.tolist(),
            "bins": bin_edges.tolist(),
            "bin_centers": bin_centers,
            "counts": counts.tolist(),
            "density": (counts / len(series)).tolist(),
            "statistics": {
                "mean": float(series.mean()),
                "median": float(series.median()),
                "std": float(series.std()),
                "min": float(series.min()),
                "max": float(series.max()),
                "skewness": float(series.skew()) if len(series) > 1 else 0
            }
        },
        "x_label": column,
        "y_label": "Frequency"
    }

# --- MODIFIED: This function now handles aggregation by a value column ---
def create_bar_chart(df: pd.DataFrame, column: str, value_col: str = None, max_categories: int = 20) -> Dict[str, Any]:
    """Create bar chart data. If value_col is given, aggregates by sum."""
    
    if value_col:
        # --- NEW: Aggregation Logic ---
        print(f"Creating aggregated bar chart for {column} by sum of {value_col}")
        try:
            clean_df = df[[column, value_col]].dropna()
            value_series = pd.to_numeric(clean_df[value_col], errors='coerce')
            if value_series.isna().all():
                return {"error": f"No valid numerical data in value column {value_col}"}
            
            # Apply the numeric conversion before grouping
            clean_df[value_col] = value_series
            grouped = clean_df.groupby(column)[value_col].sum().sort_values(ascending=False).head(max_categories)
        
            return {
                "chart_type": "bar",
                "title": f"Total {value_col} by {column}",
                "data": {
                    "categories": [str(x) for x in grouped.index.tolist()],
                    "values": [float(x) for x in grouped.values.tolist()],
                    "percentages": [float(x) for x in (grouped / grouped.sum() * 100).round(2).tolist()]
                },
                "x_label": column,
                "y_label": f"Total {value_col}"
            }
        except Exception as e:
            return {"error": f"Failed to aggregate {column} by {value_col}: {e}"}
    else:
        # --- OLD: Frequency Logic ---
        print(f"Creating frequency bar chart for {column}")
        series = df[column].dropna()
        value_counts = series.value_counts().head(max_categories)
        
        return {
            "chart_type": "bar",
            "title": f"Frequency Distribution of {column}",
            "data": {
                "categories": [str(x) for x in value_counts.index.tolist()],
                "values": [int(x) for x in value_counts.values.tolist()],
                "percentages": [float(x) for x in (value_counts / len(series) * 100).round(2).tolist()]
            },
            "x_label": column,
            "y_label": "Count"
        }

# --- MODIFIED: This function now handles aggregation by a value column ---
def create_pie_chart(df: pd.DataFrame, column: str, value_col: str = None, max_slices: int = 10) -> Dict[str, Any]:
    """Create pie chart data. If value_col is given, aggregates by sum."""
    
    if value_col:
        # --- NEW: Aggregation Logic ---
        print(f"Creating aggregated pie chart for {column} by sum of {value_col}")
        try:
            clean_df = df[[column, value_col]].dropna()
            value_series = pd.to_numeric(clean_df[value_col], errors='coerce')
            if value_series.isna().all():
                return {"error": f"No valid numerical data in value column {value_col}"}
            
            clean_df[value_col] = value_series
            grouped = clean_df.groupby(column)[value_col].sum().sort_values(ascending=False)
            
            if len(grouped) > max_slices:
                top_categories = grouped.head(max_slices - 1)
                others_sum = grouped.iloc[max_slices - 1:].sum()
                pie_data = top_categories.to_dict()
                if others_sum > 0:
                    pie_data["Others"] = others_sum
            else:
                pie_data = grouped.to_dict()
            
            total_value = sum(pie_data.values())
            labels = list(pie_data.keys())
            values = list(pie_data.values())
            percentages = [(v / total_value * 100) for v in values]
            
            return {
                "chart_type": "pie",
                "title": f"Distribution of {value_col} by {column}",
                "data": {
                    "labels": [str(label) for label in labels],
                    "values": [float(v) for v in values],
                    "percentages": [round(float(p), 2) for p in percentages],
                    "total_count": float(total_value) # This is a sum, not a count
                },
                "x_label": column,
                "y_label": f"Total {value_col}"
            }
        except Exception as e:
            return {"error": f"Failed to aggregate {column} by {value_col}: {e}"}
    else:
        # --- OLD: Frequency Logic ---
        print(f"Creating frequency pie chart for {column}")
        series = df[column].dropna()
        value_counts = series.value_counts()
        
        if len(value_counts) > max_slices:
            top_categories = value_counts.head(max_slices - 1)
            others_count = value_counts.iloc[max_slices - 1:].sum()
            pie_data = top_categories.to_dict()
            if others_count > 0:
                pie_data["Others"] = others_count
        else:
            pie_data = value_counts.to_dict()
        
        total_count = len(series)
        
        labels = list(pie_data.keys())
        values = list(pie_data.values())
        percentages = [(v / total_count * 100) for v in values]
        
        return {
            "chart_type": "pie",
            "title": f"Distribution of {column}",
            "data": {
                "labels": [str(label) for label in labels],
                "values": [int(v) for v in values],
                "percentages": [round(float(p), 2) for p in percentages],
                "total_count": int(total_count)
            },
            "x_label": column,
            "y_label": "Percentage"
        }

def create_scatter_plot(df: pd.DataFrame, x_col: str, y_col: str, color_col: str = None) -> Dict[str, Any]:
    """Create scatter plot data for two numerical columns"""
    # Convert to numeric and remove NaN
    x_series = pd.to_numeric(df[x_col], errors='coerce')
    y_series = pd.to_numeric(df[y_col], errors='coerce')
    
    # Create a clean dataframe
    plot_df = pd.DataFrame({
        'x': x_series,
        'y': y_series
    })
    
    if color_col and color_col in df.columns:
        plot_df['color'] = df[color_col]
    
    plot_df = plot_df.dropna(subset=['x', 'y'])
    
    if len(plot_df) == 0:
        return {"error": f"No valid data points found for scatter plot between {x_col} and {y_col}"}
    
    # Calculate correlation
    correlation = plot_df['x'].corr(plot_df['y'])
    
    result = {
        "chart_type": "scatter",
        "title": f"{y_col} vs {x_col}",
        "data": {
            "x": [float(x) for x in plot_df['x'].tolist()],
            "y": [float(y) for y in plot_df['y'].tolist()],
            "correlation": float(correlation) if not np.isnan(correlation) else None
        },
        "x_label": x_col,
        "y_label": y_col
    }
    
    if color_col and 'color' in plot_df.columns:
        result["data"]["color"] = [str(c) for c in plot_df['color'].tolist()]
        result["color_label"] = color_col
    
    return result

def create_line_chart(df: pd.DataFrame, x_col: str, y_col: str) -> Dict[str, Any]:
    """Create line chart data, typically for time series"""
    # Try to convert x to datetime
    try:
        x_series = pd.to_datetime(df[x_col])
        datetime_x = True
        print(f"Column {x_col} identified as datetime for line chart.")
    except:
        x_series = pd.to_numeric(df[x_col], errors='coerce')
        datetime_x = False
        print(f"Column {x_col} identified as numeric for line chart.")
    
    y_series = pd.to_numeric(df[y_col], errors='coerce')
    
    # Create clean dataframe and sort by x
    plot_df = pd.DataFrame({
        'x': x_series,
        'y': y_series
    }).dropna().sort_values('x')
    
    if len(plot_df) == 0:
        return {"error": f"No valid data points found for line chart between {x_col} and {y_col}"}
    
    # Convert datetime to string for JSON serialization
    if datetime_x:
        x_data = plot_df['x'].dt.strftime('%Y-%m-%d %H:%M:%S').tolist()
    else:
        x_data = [float(x) for x in plot_df['x'].tolist()]
    
    return {
        "chart_type": "line",
        "title": f"{y_col} over {x_col}",
        "data": {
            "x": x_data,
            "y": [float(y) for y in plot_df['y'].tolist()],
            "is_time_series": datetime_x
        },
        "x_label": x_col,
        "y_label": y_col
    }

def create_area_chart(df: pd.DataFrame, x_col: str, y_cols: List[str]) -> Dict[str, Any]:
    """Create area chart data for multiple series over x-axis"""
    # Try to convert x to datetime
    try:
        x_series = pd.to_datetime(df[x_col])
        datetime_x = True
    except:
        x_series = pd.to_numeric(df[x_col], errors='coerce')
        datetime_x = False
    
    # Prepare data for each y column
    plot_data = {"x": x_series}
    for y_col in y_cols:
        plot_data[y_col] = pd.to_numeric(df[y_col], errors='coerce')
    
    plot_df = pd.DataFrame(plot_data).dropna().sort_values('x')
    
    if len(plot_df) == 0:
        return {"error": "No valid data points found"}
    
    # Convert datetime to string for JSON serialization
    if datetime_x:
        x_data = plot_df['x'].dt.strftime('%Y-%m-%d %H:%M:%S').tolist()
    else:
        x_data = [float(x) for x in plot_df['x'].tolist()]
    
    # Prepare y data for each series
    series_data = {}
    for y_col in y_cols:
        series_data[y_col] = [float(y) for y in plot_df[y_col].tolist()]
    
    return {
        "chart_type": "area",
        "title": f"Area Chart: {', '.join(y_cols)} over {x_col}",
        "data": {
            "x": x_data,
            "series": series_data,
            "is_time_series": datetime_x,
            "series_names": y_cols
        },
        "x_label": x_col,
        "y_label": "Values"
    }

def create_box_plot(df: pd.DataFrame, column: str, group_by: str = None) -> Dict[str, Any]:
    """Create box plot data for numerical columns"""
    series = pd.to_numeric(df[column], errors='coerce').dropna()
    
    if len(series) == 0:
        return {"error": f"No valid numerical data found for box plot in column {column}"}
    
    if group_by and group_by in df.columns:
        # Grouped box plot
        groups = {}
        for group_name in df[group_by].dropna().unique():
            group_data = pd.to_numeric(df[df[group_by] == group_name][column], errors='coerce').dropna()
            if len(group_data) > 0:
                q1 = group_data.quantile(0.25)
                q3 = group_data.quantile(0.75)
                iqr = q3 - q1
                outliers = group_data[(group_data < q1 - 1.5 * iqr) | (group_data > q3 + 1.5 * iqr)]
                
                groups[str(group_name)] = {
                    "values": [float(x) for x in group_data.tolist()],
                    "q1": float(q1),
                    "median": float(group_data.median()),
                    "q3": float(q3),
                    "min": float(group_data.min()),
                    "max": float(group_data.max()),
                    "outliers": [float(x) for x in outliers.tolist()]
                }
        
        return {
            "chart_type": "box_grouped",
            "title": f"Box Plot of {column} by {group_by}",
            "data": groups,
            "x_label": group_by,
            "y_label": column
        }
    else:
        # Single box plot
        q1 = series.quantile(0.25)
        q3 = series.quantile(0.75)
        iqr = q3 - q1
        outliers = series[(series < q1 - 1.5 * iqr) | (series > q3 + 1.5 * iqr)]
        
        return {
            "chart_type": "box",
            "title": f"Box Plot of {column}",
            "data": {
                "values": [float(x) for x in series.tolist()],
                "q1": float(q1),
                "median": float(series.median()),
                "q3": float(q3),
                "min": float(series.min()),
                "max": float(series.max()),
                "outliers": [float(x) for x in outliers.tolist()]
            },
            "x_label": column,
            "y_label": "Value"
        }

def create_heatmap(df: pd.DataFrame, columns: List[str] = None) -> Dict[str, Any]:
    """Create correlation heatmap for numerical columns"""
    if columns is None:
        # Auto-select numerical columns
        numerical_cols = []
        for col in df.columns:
            if pd.to_numeric(df[col], errors='coerce').notna().sum() / len(df) > 0.8:
                numerical_cols.append(col)
        columns = numerical_cols
    
    if len(columns) < 2:
        return {"error": "Need at least 2 numerical columns for correlation heatmap"}
    
    # Create numerical dataframe
    num_df = df[columns].apply(pd.to_numeric, errors='coerce')
    correlation_matrix = num_df.corr()
    
    # Convert to format suitable for heatmap
    heatmap_data = []
    for i, row_name in enumerate(correlation_matrix.index):
        for j, col_name in enumerate(correlation_matrix.columns):
            heatmap_data.append({
                "x": col_name,
                "y": row_name,
                "value": float(correlation_matrix.iloc[i, j]) if not np.isnan(correlation_matrix.iloc[i, j]) else 0
            })
    
    return {
        "chart_type": "heatmap",
        "title": "Correlation Heatmap",
        "data": {
            "matrix": heatmap_data,
            "columns": correlation_matrix.columns.tolist(),
            "rows": correlation_matrix.index.tolist(),
            "correlation_matrix": correlation_matrix.round(3).to_dict()
        },
        "x_label": "Variables",
        "y_label": "Variables"
    }

# --- MODIFIED: This function now handles aggregation by a value column ---
def create_treemap(df: pd.DataFrame, category_col: str, value_col: str = None, max_categories: int = 20) -> Dict[str, Any]:
    """Create treemap data. If value_col is given, aggregates by sum."""
    
    if value_col is None:
        # --- OLD: Frequency Logic ---
        print(f"Creating frequency treemap for {category_col}")
        series = df[category_col].dropna()
        value_counts = series.value_counts().head(max_categories)
        
        treemap_data = []
        total_count = len(series)
        
        for category, count in value_counts.items():
            treemap_data.append({
                "name": str(category),
                "value": int(count),
                "percentage": round((count / total_count) * 100, 2)
            })
        
        return {
            "chart_type": "treemap",
            "title": f"Treemap of {category_col} (by frequency)",
            "data": {
                "nodes": treemap_data,
                "total_value": total_count,
                "value_type": "frequency"
            },
            "x_label": category_col,
            "y_label": "Frequency"
        }
    
    else:
        # --- NEW: Aggregation Logic ---
        print(f"Creating aggregated treemap for {category_col} by sum of {value_col}")
        try:
            clean_df = df[[category_col, value_col]].dropna()
            value_series = pd.to_numeric(clean_df[value_col], errors='coerce')
            
            if value_series.isna().all():
                return {"error": f"No valid numerical data found in {value_col}"}
            
            clean_df[value_col] = value_series
            grouped = clean_df.groupby(category_col)[value_col].agg(['sum', 'count', 'mean']).reset_index()
            grouped = grouped.sort_values('sum', ascending=False).head(max_categories)
            
            treemap_data = []
            total_value = grouped['sum'].sum()
            
            for _, row in grouped.iterrows():
                treemap_data.append({
                    "name": str(row[category_col]),
                    "value": float(row['sum']),
                    "count": int(row['count']),
                    "average": float(row['mean']),
                    "percentage": round((row['sum'] / total_value) * 100, 2) if total_value > 0 else 0
                })
            
            return {
                "chart_type": "treemap",
                "title": f"Treemap of {category_col} (by Total {value_col})",
                "data": {
                    "nodes": treemap_data,
                    "total_value": float(total_value),
                    "value_type": "sum",
                    "value_column": value_col
                },
                "x_label": category_col,
                "y_label": value_col
            }
        except Exception as e:
            return {"error": f"Failed to aggregate {column} by {value_col}: {e}"}

# --- NEW: Function to get a "Chart Plan" from the LLM (V3.1 - Bug Fix) ---
async def _get_chart_plan_from_llm(context: str, column_info: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Step 1: Ask the LLM to create a list of chart configurations
    based on user context and available data columns.
    V3.1: Fixes IndexError if no numerical columns are present.
    """
    print("🤖 Asking LLM for a visualization plan (V3.1 - Advanced)...")
    
    # Prepare a simplified list of columns for the prompt
    column_summary = []
    numerical_cols = []
    categorical_cols = []
    
    for name, info in column_info.items():
        col_type = info.get('data_type', 'unknown')
        sample = ""
        if col_type == 'categorical':
            sample = f"(e.g., {', '.join(list(info.get('top_categories', {}).keys())[:3])})"
            categorical_cols.append(name)
        elif col_type == 'numerical':
            sample = f"(e.g., from {info.get('min_value', 'N/A')} to {info.get('max_value', 'N/A')})"
            numerical_cols.append(name)
        elif col_type == 'datetime':
            sample = f"(e.g., {info.get('sample_values', ['N/A'])[0]})"
        
        column_summary.append(f"- {name} (Type: {col_type}) {sample}")
    
    column_list_str = "\n".join(column_summary)
    
    # --- PROMPT V3.1: Fixed the error-causing line ---
    prompt = f"""
    You are an expert data analyst. Your job is to create a visualization plan based on a user's request and a list of available data columns.
    You must create a chart configuration for **EVERY** question in the user's request, AND then add 1-2 advanced charts for deeper context.

    **User's Request (Business Context):**
    \"\"\"
    {context}
    \"\"\"

    **Available Data Columns:**
    \"\"\"
    {column_list_str}
    \"\"\"

    **TASK:**
    Generate a JSON list of chart configurations. The list must contain:
    1.  **Contextual Charts:** One chart for **EACH** question/topic in the user's request (e.g., line chart for trends, scatter for correlation, etc.).
    2.  **Advanced Charts:** 1-2 *additional* advanced charts (like a 'heatmap' or 'treemap') to provide deeper context, even if not explicitly asked for.

    **RULES:**
    1.  **ANSWER ALL QUESTIONS:** Do not skip any part of the user's request.
    2.  **USE CORRECT COLUMNS:** Match the columns *exactly* from the "Available Data Columns" list.
    3.  **PRIORITIZE AGGREGATION:** When asked about performance (e.g., "sales by region"), you MUST aggregate a numerical column (like "Sales_Revenue").
    4.  **Column Format:** The 'columns' field must be a list.
        - For 'bar', 'pie', 'treemap' with aggregation: `["Categorical_Column", "Value_Column_To_Sum"]` (e.g., ["Region", "Sales_Revenue"])
        - For 'line', 'scatter': `["X_Column", "Y_Column"]` (e.g., ["Date", "Sales_Revenue"])
        - For 'histogram': `["Numerical_Column"]` (e.g., ["Customer_Satisfaction"])
        - For 'box_grouped': `["Numerical_Column_To_Plot", "Categorical_Column_To_Group_By"]` (e.g., ["Customer_Satisfaction", "Region"])
        
        # --- THIS IS THE FIX ---
        - For 'heatmap': `["Numerical_Col_1", "Numerical_Col_2", "..."]` (List all numerical columns)
        # --- END OF FIX ---

    **JSON RETURN FORMAT (Provide ONLY this JSON):**
    {{
      "chart_configs": [
        // 1. Charts that answer the user's questions
        {{
          "chart_type": "line",
          "columns": ["Date", "Sales_Revenue"],
          "reason": "Answers the 'sales trend over time' question."
        }},
        {{
          "chart_type": "scatter",
          "columns": ["Marketing_Spend", "Sales_Revenue"],
          "reason": "Answers the 'marketing vs. sales' correlation question."
        }},
        {{
          "chart_type": "bar",
          "columns": ["Product_Category", "Sales_Revenue"],
          "reason": "Answers 'product category performance' by summing revenue."
        }},
        {{
          "chart_type": "histogram",
          "columns": ["Customer_Satisfaction"],
          "reason": "Answers the 'customer satisfaction distribution' question."
        }},
        {{
          "chart_type": "box_grouped",
          "columns": ["Customer_Satisfaction", "Region"],
          "reason": "To deep-dive on satisfaction 'by region', as requested."
        }},
        
        // 2. Additional advanced charts for context
        {{
          "chart_type": "heatmap",
          "columns": {json.dumps(numerical_cols)},
          "reason": "Provides a correlation matrix for all numerical variables."
        }},
        {{
          "chart_type": "treemap",
          "columns": ["Region", "Sales_Revenue"],
          "reason": "Provides a hierarchical view of revenue by region."
        }}
      ]
    }}
    """
    
    try:
        # Only add the heatmap suggestion if there are enough numerical columns
        # This makes the prompt logic even safer
        safe_numerical_cols = json.dumps(numerical_cols) if len(numerical_cols) >= 2 else "[]"
        
        # We need to re-build the prompt *if* numerical_cols is empty
        if len(numerical_cols) < 2:
            prompt = f"""
            You are an expert data analyst. Your job is to create a visualization plan based on a user's request and a list of available data columns.
            You must create a chart configuration for **EVERY** question in the user's request, AND then add 1-2 advanced charts for deeper context.

            **User's Request (Business Context):**
            \"\"\"
            {context}
            \"\"\"

            **Available Data Columns:**
            \"\"\"
            {column_list_str}
            \"\"\"

            **TASK:**
            Generate a JSON list of chart configurations. The list must contain:
            1.  **Contextual Charts:** One chart for **EACH** question/topic in the user's request (e.g., line chart for trends, scatter for correlation, etc.).
            2.  **Advanced Charts:** 1-2 *additional* advanced charts (like a 'treemap') to provide deeper context. (Skipping 'heatmap' as there are not enough numerical columns).

            **RULES:**
            1.  **ANSWER ALL QUESTIONS:** Do not skip any part of the user's request.
            2.  **USE CORRECT COLUMNS:** Match the columns *exactly* from the "Available Data Columns" list.
            3.  **PRIORITIZE AGGREGATION:** When asked about performance (e.g., "sales by region"), you MUST aggregate a numerical column (like "Sales_Revenue").
            4.  **Column Format:** The 'columns' field must be a list.
                - For 'bar', 'pie', 'treemap' with aggregation: `["Categorical_Column", "Value_Column_To_Sum"]` (e.g., ["Region", "Sales_Revenue"])
                - For 'line', 'scatter': `["X_Column", "Y_Column"]` (e.g., ["Date", "Sales_Revenue"])
                - For 'histogram': `["Numerical_Column"]` (e.g., ["Customer_Satisfaction"])
                - For 'box_grouped': `["Numerical_Column_To_Plot", "Categorical_Column_To_Group_By"]` (e.g., ["Customer_Satisfaction", "Region"])
                - For 'heatmap': `["Numerical_Col_1", "Numerical_Col_2", "..."]` (List all numerical columns)

            **JSON RETURN FORMAT (Provide ONLY this JSON):**
            {{
              "chart_configs": [
                // 1. Charts that answer the user's questions
                {{
                  "chart_type": "line",
                  "columns": ["Date", "Sales_Revenue"],
                  "reason": "Answers the 'sales trend over time' question."
                }},
                {{
                  "chart_type": "scatter",
                  "columns": ["Marketing_Spend", "Sales_Revenue"],
                  "reason": "Answers the 'marketing vs. sales' correlation question."
                }},
                {{
                  "chart_type": "bar",
                  "columns": ["Product_Category", "Sales_Revenue"],
                  "reason": "Answers 'product category performance' by summing revenue."
                }},
                {{
                  "chart_type": "histogram",
                  "columns": ["Customer_Satisfaction"],
                  "reason": "Answers the 'customer satisfaction distribution' question."
                }},
                {{
                  "chart_type": "box_grouped",
                  "columns": ["Customer_Satisfaction", "Region"],
                  "reason": "To deep-dive on satisfaction 'by region', as requested."
                }},
                
                // 2. Additional advanced charts for context
                {{
                  "chart_type": "treemap",
                  "columns": ["Region", "Sales_Revenue"],
                  "reason": "Provides a hierarchical view of revenue by region."
                }}
              ]
            }}
            """

        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(
                OLLAMA_URL,
                json={
                    "model": OLLAMA_MODEL,
                    "prompt": prompt,
                    "stream": False,
                    "format": "json"
                }
            )
            response.raise_for_status()
            
            data = response.json()
            if "response" not in data:
                raise Exception("Invalid response from Ollama (missing 'response' key)")
            
            parsed_json = json.loads(data["response"])
            
            if "chart_configs" not in parsed_json or not isinstance(parsed_json["chart_configs"], list):
                raise Exception("Invalid JSON structure from Ollama (missing 'chart_configs' list)")
                
            print(f"✅ LLM created a plan with {len(parsed_json['chart_configs'])} charts.")
            return parsed_json["chart_configs"]
            
    except Exception as e:
        print(f"❌ Error getting chart plan from LLM: {e}")
        # Fallback: return empty list so it doesn't crash
        return []
        
# --- NEW: Function to execute the chart plan ---
def _execute_chart_plan(df: pd.DataFrame, chart_configs: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Step 2: Loop through the AI's plan and execute the chart functions.
    """
    print(f"⚙️ Executing plan for {len(chart_configs)} charts...")
    visualizations = []
    
    for config in chart_configs:
        chart_type = config.get("chart_type")
        columns = config.get("columns", [])
        reason = config.get("reason", "No reason provided by AI.")
        
        try:
            if not columns:
                raise ValueError("No columns specified by AI.")
            
            # Ensure all columns exist in the DataFrame
            for col in columns:
                if col not in df.columns:
                    raise ValueError(f"Column '{col}' requested by AI not found in data. Available: {df.columns.tolist()}")
    
            # --- MODIFIED: This logic now correctly routes aggregation charts ---
            if chart_type == "frequency_table" and len(columns) >= 1:
                viz = create_frequency_table(df, columns[0])
            elif chart_type == "histogram" and len(columns) >= 1:
                viz = create_histogram(df, columns[0])
            elif chart_type == "bar" and len(columns) >= 1:
                value_col = columns[1] if len(columns) > 1 else None # Use 2nd col as value if provided
                viz = create_bar_chart(df, columns[0], value_col=value_col)
            elif chart_type == "pie" and len(columns) >= 1:
                value_col = columns[1] if len(columns) > 1 else None # Use 2nd col as value if provided
                viz = create_pie_chart(df, columns[0], value_col=value_col)
            elif chart_type == "scatter" and len(columns) >= 2:
                color_col = columns[2] if len(columns) > 2 else None
                viz = create_scatter_plot(df, columns[0], columns[1], color_col)
            elif chart_type == "line" and len(columns) >= 2:
                viz = create_line_chart(df, columns[0], columns[1])
            elif chart_type == "area" and len(columns) >= 2:
                viz = create_area_chart(df, columns[0], columns[1:])
            elif chart_type == "box" and len(columns) >= 1:
                group_by = columns[1] if len(columns) > 1 else None
                viz = create_box_plot(df, columns[0], group_by)
            elif chart_type == "box_grouped" and len(columns) >= 2:
                viz = create_box_plot(df, columns[0], columns[1])
            elif chart_type == "heatmap":
                viz = create_heatmap(df, columns if columns else None)
            elif chart_type == "treemap" and len(columns) >= 1:
                value_col = columns[1] if len(columns) > 1 else None # Use 2nd col as value if provided
                viz = create_treemap(df, columns[0], value_col=value_col)
            else:
                viz = {"error": f"Unsupported chart type or insufficient columns from AI plan: {chart_type}"}
            
            viz["suggestion_reason"] = reason # Pass the AI's reason to the frontend
            visualizations.append(viz)
            
        except Exception as e:
            print(f"Error creating {chart_type} chart: {e}")
            visualizations.append({"error": f"Failed to create {chart_type}: {str(e)}", "suggestion_reason": reason})
    
    print(f"✅ Plan executed. {len(visualizations)} charts/tables created.")
    return visualizations

# --- NEW: Function to get insights AFTER charts are made (V2 - Deeper Analysis) ---
async def _get_insights_from_results(visualizations: List[Dict], context: str) -> List[Dict[str, str]]:
    """
    Step 3: Send the results of the *executed plan* to the LLM for interpretation.
    This version (V2) explicitly asks for cross-correlation and temporal analysis.
    """
    print("🤖 Generating insights on executed chart plan (V2 - Deep Dive)...")
    
    # Prepare a summary of the *actual* chart results for the LLM
    viz_summary = []
    for viz in visualizations:
        if 'error' not in viz:
            summary_item = {
                "chart_type": viz["chart_type"],
                "title": viz["title"],
                "reason": viz.get("suggestion_reason", "N/A"),
                "key_statistics": {}
            }
            
            # Extract key stats from each chart's data
            stats = viz.get("data", {}).get("statistics", {})
            if not stats and "data" in viz: # Handle charts without a 'statistics' sub-key
                if viz["chart_type"] == "scatter":
                    stats = {"correlation": viz["data"].get("correlation")}
                elif viz["chart_type"] == "bar" or viz["chart_type"] == "pie" or viz["chart_type"] == "treemap":
                    if "categories" in viz["data"] and "percentages" in viz["data"]:
                        top_cat = viz["data"]["categories"][0] if viz["data"]["categories"] else "N/A"
                        top_pct = viz["data"]["percentages"][0] if viz["data"]["percentages"] else "N/A"
                        stats = {"top_category": top_cat, "top_percentage": top_pct}
                    elif "nodes" in viz["data"]: # Handle treemap data
                        top_node = viz["data"]["nodes"][0] if viz["data"]["nodes"] else {}
                        stats = {"top_category": top_node.get("name"), "top_percentage": top_node.get("percentage")}
                elif viz["chart_type"] == "histogram":
                    stats = viz["data"].get("statistics", {})
                elif viz["chart_type"] == "line":
                    # For line charts, find start, end, min, max
                    y_data = viz["data"].get("y", [])
                    if y_data:
                        stats = {
                            "start_value": y_data[0],
                            "end_value": y_data[-1],
                            "min_value": min(y_data),
                            "max_value": max(y_data),
                            "average_value": np.mean(y_data)
                        }
            
            summary_item["key_statistics"] = {k: v for k, v in stats.items() if v is not None}
            viz_summary.append(summary_item)
    
    # --- PROMPT V2: More demanding analysis ---
    prompt = f"""
    You are a senior data analyst. You have a set of chart results.
    Your task is to find the deepest, most actionable insights by **connecting the charts together**.

    **Original Business Context:**
    \"\"\"
    {context}
    \"\"\"

    **Chart Results:**
    \"\"\"
    {json.dumps(viz_summary, indent=2)}
    \"\"\"

    **TASK:**
    Generate **3 to 5 critical insights**. You MUST go beyond simple observations.
    
    **CRITICAL ANALYSIS REQUIREMENTS:**
    1.  **Cross-Chart Correlation:** You MUST find at least one insight by correlating results from *different* charts (e.g., "Does the region with the highest Sales (from bar chart) also have the highest Customer Satisfaction (from box plot)?").
    2.  **Temporal Analysis:** You MUST analyze the line chart. Look for seasonality, spikes, or dips (e.g., "The line chart shows a spike in June. This suggests...").
    3.  **Distribution Analysis:** You MUST comment on the Histogram/Box Plot. Are there outliers? Is it skewed? What does this imply (e.g., "The satisfaction histogram is right-skewed, which is good, but...").
    4.  **Actionable Recommendations:** Every insight MUST have a concrete recommendation.

    **RETURN FORMAT (Provide ONLY this JSON):**
    {{
      "visualization_insights": [
        {{
          "observation": "Cross-chart finding, e.g., 'The scatter plot shows a high 0.9 correlation for Marketing/Sales, AND the bar chart shows the 'West' region has both the highest sales and highest marketing spend.'",
          "interpretation": "What this connection means, e.g., 'This suggests the high sales in the West are strongly linked to its high marketing budget, validating the correlation.'",
          "recommendation": "A specific action, e.g., 'Pilot a 10% marketing budget increase in the 'North' region to test if it replicates the West's success.'"
        }},
        {{
          "observation": "Temporal finding, e.g., 'The 'Sales over Time' line chart shows a significant spike in June across all regions.'",
          "interpretation": "This indicates a strong seasonal effect, possibly due to a mid-year sale or external factor not in the data.",
          "recommendation": "Investigate the cause of the June spike. If it's a repeatable event (like a sale), ensure inventory and marketing are prepared for it next year."
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
                    "format": "json"
                }
            )
            response.raise_for_status()
            
            data = response.json()
            if "response" not in data:
                raise Exception("Invalid response from Ollama")
                
            parsed_json = json.loads(data["response"])
            
            if "visualization_insights" not in parsed_json:
                raise Exception("Invalid JSON structure from Ollama")
                
            print(f"✅ Generated {len(parsed_json['visualization_insights'])} deep insights.")
            return parsed_json["visualization_insights"]
            
    except Exception as e:
        print(f"❌ Error generating insights (V2): {e}")
        return [{
            "observation": "Error generating deep insights",
            "interpretation": f"Could not analyze visualizations: {str(e)}",
            "recommendation": "Review visualizations manually for patterns"
        }]

# --- NEW: Function to get suggestions AFTER charts are made ---
async def _get_suggestions_from_results(
    context: str, 
    column_info: Dict[str, Any], 
    generated_charts: List[Dict]
) -> List[Dict[str, Any]]:
    """
    Step 4: Ask the LLM to suggest *new* charts to run next.
    """
    print("🤖 Generating suggestions for further analysis...")
    
    # Summarize columns again
    column_summary = []
    for name, info in column_info.items():
        col_type = info.get('data_type', 'unknown')
        column_summary.append(f"- {name} (Type: {col_type})")
    column_list_str = "\n".join(column_summary)
    
    # Summarize charts already made
    charts_made_summary = [
        f"- {viz.get('title', 'Untitled Chart')} (Type: {viz.get('chart_type')})"
        for viz in generated_charts if 'error' not in viz
    ]
    charts_made_str = "\n".join(charts_made_summary)

    prompt = f"""
    You are an expert data analyst. A junior analyst has already created some charts based on a user's request.
    Your job is to suggest **3-4 new, advanced, or deeper-dive visualizations** that would provide *additional* value.

    **Original User Request:**
    \"\"\"
    {context}
    \"\"\"

    **Available Data Columns:**
    \"\"\"
    {column_list_str}
    \"\"\"
    
    **Charts Already Generated:**
    \"\"\"
    {charts_made_str}
    \"\"\"

    **TASK:**
    Suggest **3-4 new, different charts** that were NOT in the "Charts Already Generated" list.
    Focus on multi-variable analysis, deep dives, or correlations that were missed.

    **RULES:**
    1.  **DO NOT** suggest charts that are already on the list.
    2.  **BE ADVANCED:** Suggest things like Heatmaps, Grouped Box Plots, or Scatter Plots with a 3rd variable (color).
    3.  **USE CORRECT COLUMNS:** Match the columns *exactly* from the "Available Data Columns" list.
    4.  **JSON FORMAT:** Use the "chart_configs" format.

    **JSON RETURN FORMAT (Provide ONLY this JSON):**
    {{
      "chart_configs": [
        {{
          "chart_type": "heatmap",
          "columns": ["List_of_Numerical_Cols_for_Heatmap"],
          "reason": "To see the correlation between all key numerical metrics at a glance."
        }},
        {{
          "chart_type": "box_grouped",
          "columns": ["Customer_Satisfaction", "Product_Category"],
          "reason": "To deep-dive into satisfaction scores for each product, not just by region."
        }},
        {{
          "chart_type": "scatter",
          "columns": ["Customer_Satisfaction", "Sales_Revenue", "Region"],
          "reason": "To explore if higher satisfaction *and* region are correlated with revenue."
        }}
      ]
    }}
    """
    
    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(
                OLLAMA_URL,
                json={
                    "model": OLLAMA_MODEL,
                    "prompt": prompt,
                    "stream": False,
                    "format": "json"
                }
            )
            response.raise_for_status()
            
            data = response.json()
            if "response" not in data:
                raise Exception("Invalid response from Ollama (missing 'response' key)")
            
            parsed_json = json.loads(data["response"])
            
            if "chart_configs" not in parsed_json or not isinstance(parsed_json["chart_configs"], list):
                raise Exception("Invalid JSON structure from Ollama (missing 'chart_configs' list)")
                
            print(f"✅ LLM created {len(parsed_json['chart_configs'])} new suggestions.")
            
            # Convert to the simple suggestion format the frontend expects
            suggestions = []
            for config in parsed_json["chart_configs"]:
                suggestions.append({
                    "title": config.get("reason", "Suggested Chart").split('.')[0], # Use first part of reason as title
                    "columns": config.get("columns", []),
                    "reason": config.get("reason", "No reason provided.")
                })
            return suggestions
            
    except Exception as e:
        print(f"❌ Error getting suggestions from LLM: {e}")
        return [] # Return empty list on failure

# --- NEW: Main function with 3-step context-aware workflow ---
async def perform_visualization_analysis(
    data_payload: Union[UploadFile, str],
    is_file_upload: bool,
    input_filename: str,
    context_file: Optional[UploadFile] = None,
    chart_configs: Optional[List[Dict[str, Any]]] = None 
) -> Dict[str, Any]:
    
    print("🚀 Starting NEW context-aware Visualization Analysis...")
    
    try:
        # 1. Load data
        df = await load_dataframe(data_payload, is_file_upload, input_filename)
        
        # 2. Load context
        business_context = await _load_context(context_file)
        
        # 3. Analyze column types
        column_info = detect_column_types(df)

        print("=== COLUMN TYPE DEBUG ===")
        for col_name, col_info in column_info.items():
            print(f"{col_name}: {col_info['data_type']} (unique: {col_info.get('unique_count', 'N/A')})")
        print("========================")
        
        # 4. Get chart plan
        if not chart_configs:
            chart_configs = await _get_chart_plan_from_llm(business_context, column_info)
            if not chart_configs:
                print("Warning: LLM did not return a chart plan.")
        else:
            print("Using user-provided chart configurations.")
        
        # 5. Execute chart plan
        visualizations = _execute_chart_plan(df, chart_configs)
        
        # 6. Generate insights based on the *results* of the plan
        insights = await _get_insights_from_results(visualizations, business_context)

        # --- NEW: Step 7 - Get *new* suggestions ---
        suggestions = await _get_suggestions_from_results(business_context, column_info, visualizations)
        
        # --- MODIFIED: Step 8 - Prepare response ---
        response_data = {
            "dataset_info": {
                "rows": int(len(df)),
                "columns": int(len(df.columns)),
                "column_info": column_info
            },
            "visualizations": visualizations,
            "suggestions": suggestions, # --- NOW POPULATED ---
            "insights": insights,
            "metadata": {
                "analysis_timestamp": datetime.now().isoformat(),
                "input_filename": input_filename,
                "total_visualizations": int(len(visualizations))
            }
        }
        
        # 9. Convert all numpy/pandas types
        response_data = convert_numpy_types(response_data)
        
        print(f"✅ Context-aware visualization analysis completed. Generated {len(visualizations)} visualizations and {len(suggestions)} suggestions.")
        return response_data
        
    except HTTPException as http_exc:
        # ... (rest of function is unchanged) ...
        print(f"❌ HTTP Exception in visualization analysis: {http_exc.detail}")
        raise http_exc
    except Exception as e:
        error_msg = f"❌ Unexpected error in visualization analysis: {type(e).__name__}: {str(e)}"
        print(f"{error_msg}\n{traceback.format_exc()}")
        response_data = {
            "dataset_info": {"error": str(e), "rows": 0, "columns": 0, "column_info": {}},
            "visualizations": [],
            "suggestions": [],
            "insights": [{"observation": "Analysis Failed", "interpretation": str(e), "recommendation": "Check data format and try again"}],
            "metadata": {"error": True, "error_message": str(e), "analysis_timestamp": datetime.now().isoformat()}
        }
        return convert_numpy_types(response_data)
        
# --- NEW: Helper to safely close files, to be used in main.py ---
async def safe_close_file(file: Optional[UploadFile]):
    """Safely closes an uploaded file if it exists."""
    if file and isinstance(file, UploadFile):
        try:
            await file.close()
            print(f"Closed uploaded file: {file.filename}")
        except Exception as close_err:
            # Log warning, but don't crash the request
            print(f"Warning: Could not close file {file.filename}. Error: {close_err}")