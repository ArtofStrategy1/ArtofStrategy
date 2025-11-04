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
OLLAMA_MODEL = "llama3.1:latest"

# --- JSON Serialization Helper ---
def convert_numpy_types(obj):
    """Convert numpy/pandas types to native Python types for JSON serialization"""
    if isinstance(obj, np.integer):
        return int(obj)
    elif isinstance(obj, np.floating):
        return float(obj)
    elif isinstance(obj, np.ndarray):
        return obj.tolist()
    elif isinstance(obj, (pd.Series, pd.Index)):
        return obj.tolist()
    elif isinstance(obj, dict):
        return {key: convert_numpy_types(value) for key, value in obj.items()}
    elif isinstance(obj, list):
        return [convert_numpy_types(item) for item in obj]
    elif hasattr(obj, 'item'):  # Single numpy values
        return obj.item()
    else:
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
        
        print(f"✅ Data loaded successfully. Shape: {df.shape}")
        return df

    except Exception as e:
        print(f"❌ Error loading data: {e}\n{traceback.format_exc()}")
        raise HTTPException(status_code=400, detail=f"Failed to read data: {e}")

# --- Data Type Detection ---
def detect_column_types(df: pd.DataFrame) -> Dict[str, Dict[str, Any]]:
    """Detect and categorize column types for visualization recommendations"""
    column_info = {}
    
    for col in df.columns:
        series = df[col].dropna()
        if len(series) == 0:
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
            pd.to_datetime(series, errors='raise')
            datetime_converted = len(series)
        except:
            try:
                # Try common date formats
                for fmt in ['%Y-%m-%d', '%m/%d/%Y', '%d/%m/%Y', '%Y-%m-%d %H:%M:%S']:
                    pd.to_datetime(series, format=fmt, errors='raise')
                    datetime_converted = len(series)
                    break
            except:
                pass
        
        datetime_ratio = datetime_converted / len(series)
        
        # Determine primary type
        if datetime_ratio > 0.8:
            info['data_type'] = 'datetime'
            info['sample_values'] = series.head(5).astype(str).tolist()
        elif numeric_ratio > 0.8:
            if series.nunique() < 10 and all(isinstance(x, (int, float)) and x == int(x) for x in numeric_series.dropna()):
                info['data_type'] = 'categorical_numeric'
            else:
                info['data_type'] = 'numerical'
            info['min_value'] = float(numeric_series.min())
            info['max_value'] = float(numeric_series.max())
            info['mean_value'] = float(numeric_series.mean())
        elif series.nunique() < len(series) * 0.5:
            info['data_type'] = 'categorical'
            info['top_categories'] = {str(k): int(v) for k, v in series.value_counts().head(10).to_dict().items()}
        else:
            info['data_type'] = 'text'
            info['sample_values'] = series.head(5).astype(str).tolist()
        
        column_info[col] = info
    
    return column_info

# --- Chart Generation Functions ---

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
        return {"error": "No valid numerical data found"}
    
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

def create_bar_chart(df: pd.DataFrame, column: str, max_categories: int = 20) -> Dict[str, Any]:
    """Create bar chart data for categorical columns"""
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

def create_pie_chart(df: pd.DataFrame, column: str, max_slices: int = 10) -> Dict[str, Any]:
    """Create pie chart data for categorical columns"""
    series = df[column].dropna()
    value_counts = series.value_counts()
    
    # Group small categories into "Others" if there are too many
    if len(value_counts) > max_slices:
        top_categories = value_counts.head(max_slices - 1)
        others_count = value_counts.iloc[max_slices - 1:].sum()
        
        # Combine top categories with "Others"
        pie_data = top_categories.to_dict()
        if others_count > 0:
            pie_data["Others"] = others_count
    else:
        pie_data = value_counts.to_dict()
    
    total_count = len(series)
    
    # Prepare data for pie chart
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
        return {"error": "No valid data points found"}
    
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
    except:
        x_series = pd.to_numeric(df[x_col], errors='coerce')
        datetime_x = False
    
    y_series = pd.to_numeric(df[y_col], errors='coerce')
    
    # Create clean dataframe and sort by x
    plot_df = pd.DataFrame({
        'x': x_series,
        'y': y_series
    }).dropna().sort_values('x')
    
    if len(plot_df) == 0:
        return {"error": "No valid data points found"}
    
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
        return {"error": "No valid numerical data found"}
    
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

def create_treemap(df: pd.DataFrame, category_col: str, value_col: str = None, max_categories: int = 20) -> Dict[str, Any]:
    """Create treemap data for hierarchical categorical data"""
    if value_col is None:
        # Use frequency counts if no value column specified
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
        # Use specified value column
        clean_df = df[[category_col, value_col]].dropna()
        value_series = pd.to_numeric(clean_df[value_col], errors='coerce')
        
        if value_series.isna().all():
            return {"error": f"No valid numerical data found in {value_col}"}
        
        # Group by category and sum values
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
            "title": f"Treemap of {category_col} (by {value_col})",
            "data": {
                "nodes": treemap_data,
                "total_value": float(total_value),
                "value_type": "sum",
                "value_column": value_col
            },
            "x_label": category_col,
            "y_label": value_col
        }

# --- Visualization Recommendations ---
def suggest_visualizations(column_info: Dict[str, Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Suggest appropriate visualizations based on data types"""
    suggestions = []
    
    numerical_cols = [col for col, info in column_info.items() if info['data_type'] == 'numerical']
    categorical_cols = [col for col, info in column_info.items() if info['data_type'] == 'categorical']
    datetime_cols = [col for col, info in column_info.items() if info['data_type'] == 'datetime']
    
    # Single variable visualizations
    for col, info in column_info.items():
        if info['data_type'] == 'numerical':
            # Frequency table for numerical data
            suggestions.append({
                "chart_type": "frequency_table",
                "title": f"Frequency Table of {col}",
                "columns": [col],
                "reason": "Detailed frequency distribution with statistics"
            })
            
            # Histogram for distribution
            suggestions.append({
                "chart_type": "histogram",
                "title": f"Distribution of {col}",
                "columns": [col],
                "reason": "Shows the distribution and frequency of numerical values"
            })
            
            # Box plot for outliers and quartiles
            suggestions.append({
                "chart_type": "box",
                "title": f"Box Plot of {col}",
                "columns": [col],
                "reason": "Displays quartiles, median, and outliers"
            })
        
        elif info['data_type'] == 'categorical' and info['unique_count'] < 50:
            # Frequency table for categorical data
            suggestions.append({
                "chart_type": "frequency_table",
                "title": f"Frequency Table of {col}",
                "columns": [col],
                "reason": "Complete frequency breakdown with percentages"
            })
            
            # Bar chart for frequency distribution
            suggestions.append({
                "chart_type": "bar",
                "title": f"Bar Chart of {col}",
                "columns": [col],
                "reason": "Shows frequency distribution of categories"
            })
            
            # Pie chart for proportions (if reasonable number of categories)
            if info['unique_count'] <= 10:
                suggestions.append({
                    "chart_type": "pie",
                    "title": f"Pie Chart of {col}",
                    "columns": [col],
                    "reason": "Shows proportional distribution of categories"
                })
            
            # Treemap for hierarchical view
            suggestions.append({
                "chart_type": "treemap",
                "title": f"Treemap of {col}",
                "columns": [col],
                "reason": "Hierarchical view of category sizes"
            })
    
    # Two variable relationships
    for i, col1 in enumerate(numerical_cols):
        for col2 in numerical_cols[i+1:]:
            # Scatter plot for correlation
            suggestions.append({
                "chart_type": "scatter",
                "title": f"{col2} vs {col1}",
                "columns": [col1, col2],
                "reason": "Explores relationship between two numerical variables"
            })
    
    # Time series visualizations
    if datetime_cols and numerical_cols:
        for date_col in datetime_cols:
            for num_col in numerical_cols[:3]:  # Limit to avoid too many suggestions
                # Line chart for trends
                suggestions.append({
                    "chart_type": "line",
                    "title": f"{num_col} over time",
                    "columns": [date_col, num_col],
                    "reason": "Shows trend over time"
                })
        
        # Area chart for multiple series over time (if multiple numerical columns)
        if len(numerical_cols) > 1:
            for date_col in datetime_cols:
                suggestions.append({
                    "chart_type": "area",
                    "title": f"Multiple series over time",
                    "columns": [date_col] + numerical_cols[:3],  # Limit to 3 series
                    "reason": "Shows multiple trends over time with cumulative effect"
                })
    
    # Grouped analysis
    if categorical_cols and numerical_cols:
        for cat_col in categorical_cols[:3]:  # Limit to avoid too many suggestions
            for num_col in numerical_cols[:3]:
                if column_info[cat_col]['unique_count'] < 20:  # Reasonable number of groups
                    # Grouped box plot
                    suggestions.append({
                        "chart_type": "box_grouped",
                        "title": f"{num_col} by {cat_col}",
                        "columns": [num_col, cat_col],
                        "reason": f"Compares {num_col} distribution across {cat_col} categories"
                    })
                    
                    # Treemap with values
                    suggestions.append({
                        "chart_type": "treemap",
                        "title": f"Treemap of {cat_col} by {num_col}",
                        "columns": [cat_col, num_col],
                        "reason": f"Shows {cat_col} categories sized by {num_col} values"
                    })
    
    # Correlation heatmap
    if len(numerical_cols) > 2:
        suggestions.append({
            "chart_type": "heatmap",
            "title": "Correlation Matrix",
            "columns": numerical_cols,
            "reason": "Shows correlations between all numerical variables"
        })
    
    return suggestions

# --- LLM Insights for Visualizations ---
async def get_visualization_insights(visualizations: List[Dict], context: str) -> List[Dict[str, str]]:
    """Generate insights about the visualizations using LLM"""
    print("🤖 Generating visualization insights...")
    
    # Prepare summary for LLM
    viz_summary = []
    for viz in visualizations:
        if 'error' not in viz:
            summary_item = {
                "chart_type": viz["chart_type"],
                "title": viz["title"],
                "key_statistics": {}
            }
            
            if viz["chart_type"] == "histogram" and "data" in viz:
                stats = viz["data"].get("statistics", {})
                summary_item["key_statistics"] = {
                    "mean": stats.get("mean"),
                    "median": stats.get("median"),
                    "std": stats.get("std")
                }
            elif viz["chart_type"] == "scatter" and "data" in viz:
                summary_item["key_statistics"] = {
                    "correlation": viz["data"].get("correlation")
                }
            elif viz["chart_type"] == "bar" and "data" in viz:
                data = viz["data"]
                if "categories" in data and "percentages" in data:
                    top_category = data["categories"][0] if data["categories"] else "None"
                    top_percentage = data["percentages"][0] if data["percentages"] else 0
                    summary_item["key_statistics"] = {
                        "top_category": top_category,
                        "top_percentage": top_percentage
                    }
            elif viz["chart_type"] == "pie" and "data" in viz:
                data = viz["data"]
                if "labels" in data and "percentages" in data:
                    top_category = data["labels"][0] if data["labels"] else "None"
                    top_percentage = data["percentages"][0] if data["percentages"] else 0
                    summary_item["key_statistics"] = {
                        "top_category": top_category,
                        "top_percentage": top_percentage
                    }
            elif viz["chart_type"] == "frequency_table" and "data" in viz:
                stats = viz["data"].get("statistics", {})
                summary_item["key_statistics"] = {
                    "mode": stats.get("mode"),
                    "mode_percentage": stats.get("mode_percentage")
                }
            
            viz_summary.append(summary_item)
    
    prompt = f"""
    You are a senior data analyst reviewing visualization results. Provide 4-6 specific, actionable insights based on the visualizations and business context.

    **BUSINESS CONTEXT:**
    \"\"\"
    {context}
    \"\"\"

    **VISUALIZATION SUMMARY:**
    \"\"\"
    {json.dumps(viz_summary, indent=2)}
    \"\"\"

    **TASK:**
    Generate **4 to 6** insights about patterns, trends, or anomalies visible in the visualizations. Each insight should be:
    1. **Specific** - Reference actual chart types and statistical findings
    2. **Actionable** - Suggest next steps or investigations
    3. **Business-relevant** - Connect to the business context provided

    **RETURN FORMAT:**
    Provide ONLY a valid JSON object:
    {{
      "visualization_insights": [
        {{
          "observation": "Specific finding from the visualizations...",
          "interpretation": "What this means for the business...",
          "recommendation": "Suggested action or investigation..."
        }}
        // ... 4 to 6 insights total ...
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
                
            print(f"✅ Generated {len(parsed_json['visualization_insights'])} visualization insights")
            return parsed_json["visualization_insights"]
            
    except Exception as e:
        print(f"❌ Error generating insights: {e}")
        return [{
            "observation": "Error generating insights",
            "interpretation": f"Could not analyze visualizations: {str(e)}",
            "recommendation": "Review visualizations manually for patterns"
        }]

# --- Main Visualization Analysis Function ---
async def perform_visualization_analysis(
    data_payload: Union[UploadFile, str],
    is_file_upload: bool,
    input_filename: str,
    context_file: Optional[UploadFile] = None,
    chart_configs: Optional[List[Dict[str, Any]]] = None
) -> Dict[str, Any]:
    """
    Main function to perform visualization analysis
    
    Args:
        data_payload: File or text data
        is_file_upload: Whether data is from file upload
        input_filename: Name of input file
        context_file: Optional business context file
        chart_configs: Optional specific chart configurations
                      Format: [{"chart_type": "histogram", "columns": ["column1"]}, ...]
    """
    print("🚀 Starting Visualization Analysis...")
    
    try:
        # 1. Load data
        df = await load_dataframe(data_payload, is_file_upload, input_filename)
        
        # 2. Load context
        business_context = "No business context provided."
        if context_file:
            try:
                contents = await context_file.read()
                business_context = contents.decode('utf-8')
            except Exception as e:
                print(f"Warning: Could not read context file: {e}")
        
        # 3. Analyze column types
        column_info = detect_column_types(df)
        
        # 4. Generate visualizations
        visualizations = []
        
        if chart_configs:
            # Use specific chart configurations provided
            for config in chart_configs:
                chart_type = config.get("chart_type")
                columns = config.get("columns", [])
                
                try:
                    if chart_type == "frequency_table" and len(columns) >= 1:
                        viz = create_frequency_table(df, columns[0], config.get("max_categories", 50))
                    elif chart_type == "histogram" and len(columns) >= 1:
                        viz = create_histogram(df, columns[0], config.get("bins", 30))
                    elif chart_type == "bar" and len(columns) >= 1:
                        viz = create_bar_chart(df, columns[0], config.get("max_categories", 20))
                    elif chart_type == "pie" and len(columns) >= 1:
                        viz = create_pie_chart(df, columns[0], config.get("max_slices", 10))
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
                    elif chart_type == "heatmap":
                        viz = create_heatmap(df, columns if columns else None)
                    elif chart_type == "treemap" and len(columns) >= 1:
                        value_col = columns[1] if len(columns) > 1 else None
                        viz = create_treemap(df, columns[0], value_col, config.get("max_categories", 20))
                    else:
                        viz = {"error": f"Unsupported chart type or insufficient columns: {chart_type}"}
                    
                    visualizations.append(viz)
                    
                except Exception as e:
                    print(f"Error creating {chart_type} chart: {e}")
                    visualizations.append({"error": f"Failed to create {chart_type}: {str(e)}"})
        
        else:
            # Auto-generate suggested visualizations
            suggestions = suggest_visualizations(column_info)
            
            # Create visualizations for top suggestions (limit to prevent overload)
            for suggestion in suggestions[:15]:  # Increased limit to accommodate more chart types
                try:
                    chart_type = suggestion["chart_type"]
                    columns = suggestion["columns"]
                    
                    if chart_type == "frequency_table":
                        viz = create_frequency_table(df, columns[0])
                    elif chart_type == "histogram":
                        viz = create_histogram(df, columns[0])
                    elif chart_type == "bar":
                        viz = create_bar_chart(df, columns[0])
                    elif chart_type == "pie":
                        viz = create_pie_chart(df, columns[0])
                    elif chart_type == "scatter":
                        viz = create_scatter_plot(df, columns[0], columns[1])
                    elif chart_type == "line":
                        viz = create_line_chart(df, columns[0], columns[1])
                    elif chart_type == "area":
                        viz = create_area_chart(df, columns[0], columns[1:])
                    elif chart_type == "box":
                        viz = create_box_plot(df, columns[0])
                    elif chart_type == "box_grouped":
                        viz = create_box_plot(df, columns[0], columns[1])
                    elif chart_type == "heatmap":
                        viz = create_heatmap(df, columns)
                    elif chart_type == "treemap":
                        value_col = columns[1] if len(columns) > 1 else None
                        viz = create_treemap(df, columns[0], value_col)
                    else:
                        continue
                    
                    # Add suggestion metadata
                    viz["suggestion_reason"] = suggestion["reason"]
                    visualizations.append(viz)
                    
                except Exception as e:
                    print(f"Error creating suggested {chart_type} chart: {e}")
        
        # 5. Generate insights
        insights = await get_visualization_insights(visualizations, business_context)
        
        # 6. Prepare response
        response_data = {
            "dataset_info": {
                "rows": int(len(df)),
                "columns": int(len(df.columns)),
                "column_info": column_info
            },
            "visualizations": visualizations,
            "suggestions": suggest_visualizations(column_info) if not chart_configs else [],
            "insights": insights,
            "metadata": {
                "analysis_timestamp": datetime.now().isoformat(),
                "input_filename": input_filename,
                "total_visualizations": int(len(visualizations))
            }
        }
        
        # Convert all numpy/pandas types to native Python types
        response_data = convert_numpy_types(response_data)
        
        print(f"✅ Visualization analysis completed. Generated {len(visualizations)} visualizations.")
        return response_data
        
    except HTTPException as http_exc:
        print(f"❌ HTTP Exception in visualization analysis: {http_exc.detail}")
        raise http_exc
    except Exception as e:
        error_msg = f"❌ Unexpected error in visualization analysis: {type(e).__name__}: {str(e)}"
        print(f"{error_msg}\n{traceback.format_exc()}")
        return {
            "dataset_info": {"error": str(e)},
            "visualizations": [],
            "suggestions": [],
            "insights": [{"observation": "Error", "interpretation": str(e), "recommendation": "Check data format and try again"}],
            "metadata": {"error": True, "error_message": str(e)}
        }