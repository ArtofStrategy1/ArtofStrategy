# analysis_modules/pls_analysis.py

import io
import pandas as pd
import numpy as np
import traceback
import re
import json
import httpx
import graphviz
import base64
from typing import Optional, Tuple, List, Dict, Any, Union
from starlette.datastructures import UploadFile
from fastapi import HTTPException
from scipy.stats import t

# --- Import the correct PLS-SEM library ---
try:
    import plspm
    from plspm.plspm import Plspm
    from plspm.config import Config
    from plspm.scheme import Scheme
    from plspm.mode import Mode
    print("DEBUG: Successfully imported 'plspm' library.")
except ImportError:
    print("CRITICAL WARNING: 'plspm' library not found. PLS-SEM analysis will fail.")
    Plspm = None

# --- Configuration ---
OLLAMA_URL = "https://ollama.sageaios.com/api/generate"
OLLAMA_MODEL = "llama3.1:latest" # Using the latest Llama 3.1

def debug_dataframe(df: pd.DataFrame, stage_name: str, show_sample_rows: int = 5):
    """
     comprehensive debugging for dataframe at each stage.

    Prints shape, columns, data types, memory usage, missing values, non-numeric value detection,
    descriptive statistics, and a correlation matrix to the console for debugging purposes.

    Args:
        df (pd.DataFrame): The pandas DataFrame to inspect.
        stage_name (str): A label for the current processing stage (used in logs).
        show_sample_rows (int, optional): Number of rows to print from head/tail. Defaults to 5.

    Returns:
        dict: A dictionary containing problematic non-numeric values found in object columns.
    """
    """Comprehensive debugging for dataframe at each stage"""
    print(f"\n{'='*80}")
    print(f"🔍 DEBUG: {stage_name}")
    print(f"{'='*80}")
    print(f"Shape: {df.shape}")
    print(f"Columns: {list(df.columns)}")
    print(f"Data types:\n{df.dtypes}")
    print(f"Memory usage: {df.memory_usage(deep=True).sum() / 1024:.2f} KB")
    
    # Check for missing values
    missing_summary = df.isnull().sum()
    total_missing = missing_summary.sum()
    print(f"\nMissing values (total: {total_missing}):")
    for col, missing_count in missing_summary.items():
        if missing_count > 0:
            print(f"  ✗ {col}: {missing_count} ({missing_count/len(df)*100:.1f}%)")
        else:
            print(f"  ✓ {col}: 0")
    
    # Check for non-numeric data
    print(f"\nNon-numeric value detection:")
    problematic_values = {}
    numeric_cols_for_stats = []
    for col in df.columns:
        if df[col].dtype == 'object':
            # Check which values are non-numeric
            non_numeric_mask = ~df[col].astype(str).str.match(r'^-?\d*\.?\d*$', na=False)
            non_numeric_values = df.loc[non_numeric_mask, col].unique()
            if len(non_numeric_values) > 0:
                problematic_values[col] = non_numeric_values
                print(f"  ✗ {col} (object): Contains non-numeric values like {non_numeric_values[:5]}")
            else:
                print(f"  ✓ {col} (object): All appear numeric, recommend conversion")
        elif pd.api.types.is_numeric_dtype(df[col]):
            print(f"  ✓ {col} (numeric): Already numeric dtype ({df[col].dtype})")
            numeric_cols_for_stats.append(col)
        else:
            print(f"  ? {col} (other): Dtype {df[col].dtype}")

    # Show descriptive statistics
    try:
        print(f"\nDescriptive statistics (for {len(numeric_cols_for_stats)} numeric cols):")
        if len(numeric_cols_for_stats) > 0:
            stats = df[numeric_cols_for_stats].describe()
            print(stats)
        else:
            print("  No numeric columns available for statistics")
    except Exception as e:
        print(f"  Could not compute statistics: {e}")
    
    # Show correlation matrix for numeric columns
    try:
        if len(numeric_cols_for_stats) > 1:
            corr = df[numeric_cols_for_stats].corr()
            print(f"\nCorrelation matrix (for {len(numeric_cols_for_stats)} numeric cols):")
            print(corr.round(3))
            
            # Check for perfect correlations
            perfect_corr = []
            for i in range(len(corr.columns)):
                for j in range(i+1, len(corr.columns)):
                    corr_val = corr.iloc[i, j]
                    if abs(corr_val) > 0.99 and not pd.isna(corr_val):
                        perfect_corr.append((corr.columns[i], corr.columns[j], corr_val))
            
            if perfect_corr:
                print(f"\n⚠️ PERFECT CORRELATIONS DETECTED:")
                for col1, col2, val in perfect_corr:
                    print(f"  {col1} <-> {col2}: r = {val:.6f}")
            else:
                print(f"\n✓ No perfect correlations detected")
        else:
            print(f"\nNot enough numeric columns for correlation matrix")
    except Exception as e:
        print(f"Could not compute correlations: {e}")
    
    # Show sample data
    print(f"\nFirst {show_sample_rows} rows:")
    print(df.head(show_sample_rows))
    
    if len(df) > show_sample_rows:
        print(f"\nLast {show_sample_rows} rows:")
        print(df.tail(show_sample_rows))
    
    print(f"{'='*80}\n")
    
    return problematic_values

async def read_data(data_payload: Union[UploadFile, str], is_file_upload: bool, input_filename: str) -> pd.DataFrame:
    """
    Reads data from either an uploaded file or a text string into a pandas DataFrame.
    
    Detects CSV (comma, semicolon, auto-sep) or Excel formats. Logs debug info about the read process.
    Does NOT perform automatic numeric conversion at this stage.

    Args:
        data_payload (Union[UploadFile, str]): The input data, either an UploadFile object or a raw string.
        is_file_upload (bool): True if the payload is a file, False if it is a text string.
        input_filename (str): The name of the file (used for extension detection).

    Returns:
        pd.DataFrame: The loaded pandas DataFrame.

    Raises:
        HTTPException: If file is empty, invalid type, or parsing fails.
        TypeError: If `is_file_upload` is True but payload is not `UploadFile`.
    """
    """
    Reads data from either an uploaded file or a text string into a pandas DataFrame.
    REMOVED automatic numeric conversion.
    """
    print(f"🚀 DEBUG: read_data starting. is_file_upload={is_file_upload}, filename='{input_filename}'")
    df = None
    na_vals = ['-', '', ' ', 'NA', 'N/A', 'null', 'None', '#N/A', '#VALUE!', '#DIV/0!', 'NaN', 'nan']
    
    try:
        if is_file_upload:
            print(f"🔍 DEBUG: read_data processing file: {input_filename}")
            if not isinstance(data_payload, UploadFile):
                raise TypeError(f"Expected UploadFile but received {type(data_payload)}")
            
            contents = await data_payload.read()
            if not contents:
                raise HTTPException(status_code=400, detail="Uploaded file is empty.")
            print(f"✓ DEBUG: read_data file read {len(contents)} bytes.")
            
            filename_lower = input_filename.lower()
            if filename_lower.endswith('.csv'):
                print("📄 DEBUG: read_data detected CSV.")
                try:
                    decoded_content = contents.decode('utf-8')
                    print(f"✓ DEBUG: Successfully decoded as UTF-8, length: {len(decoded_content)}")
                except UnicodeDecodeError:
                    print("⚠️ DEBUG: read_data UTF-8 failed, trying latin1.")
                    decoded_content = contents.decode('latin1')
                    print(f"✓ DEBUG: Successfully decoded as latin1, length: {len(decoded_content)}")
                
                lines = decoded_content.split('\n')[:5]
                print(f"📋 DEBUG: First 5 lines of raw CSV content:")
                for i, line in enumerate(lines):
                    print(f"  Line {i+1}: '{line[:100]}{'...' if len(line) > 100 else ''}'")
                
                data_io = io.StringIO(decoded_content)
                try:
                    print("🔄 DEBUG: read_data trying CSV with comma delimiter.")
                    df = pd.read_csv(data_io, na_values=na_vals, sep=',', engine='python')
                    print(f"✓ DEBUG: Comma delimiter successful, shape: {df.shape}")
                except Exception as comma_err:
                    print(f"✗ DEBUG: Comma delimiter failed: {comma_err}")
                    data_io.seek(0)
                    try:
                        print("🔄 DEBUG: read_data trying CSV with semicolon delimiter.")
                        df = pd.read_csv(data_io, na_values=na_vals, sep=';', engine='python')
                        print(f"✓ DEBUG: Semicolon delimiter successful, shape: {df.shape}")
                    except Exception as semi_err:
                        print(f"✗ DEBUG: Semicolon delimiter failed: {semi_err}")
                        data_io.seek(0)
                        print("🔄 DEBUG: read_data trying CSV with auto-delimiter.")
                        df = pd.read_csv(data_io, na_values=na_vals, sep=None, engine='python')
                        print(f"✓ DEBUG: Auto-delimiter successful, shape: {df.shape}")
                        
            elif filename_lower.endswith(('.xlsx', '.xls')):
                print("📊 DEBUG: read_data detected Excel file.")
                data_io = io.BytesIO(contents)
                df = pd.read_excel(data_io, na_values=na_vals)
                print(f"✓ DEBUG: Excel read successful, shape: {df.shape}")
            else:
                raise HTTPException(400, "Invalid file type. Please upload CSV or Excel.")
        else:
            print("📝 DEBUG: read_data processing pasted text.")
            if not isinstance(data_payload, str) or not data_payload.strip():
                raise HTTPException(status_code=400, detail="Pasted text data is empty.")
            
            lines = data_payload.strip().split('\n')[:5]
            print(f"📋 DEBUG: First 5 lines of pasted content:")
            for i, line in enumerate(lines):
                print(f"  Line {i+1}: '{line[:100]}{'...' if len(line) > 100 else ''}'")
            
            data_io = io.StringIO(data_payload)
            try:
                print("🔄 DEBUG: read_data trying CSV with comma delimiter.")
                df = pd.read_csv(data_io, na_values=na_vals, sep=',', engine='python')
                print(f"✓ DEBUG: Comma delimiter successful, shape: {df.shape}")
            except Exception as comma_err:
                print(f"✗ DEBUG: Comma delimiter failed: {comma_err}")
                data_io.seek(0)
                try:
                    print("🔄 DEBUG: read_data trying CSV with semicolon delimiter.")
                    df = pd.read_csv(data_io, na_values=na_vals, sep=';', engine='python')
                    print(f"✓ DEBUG: Semicolon delimiter successful, shape: {df.shape}")
                except Exception as semi_err:
                    print(f"✗ DEBUG: Semicolon delimiter failed: {semi_err}")
                    data_io.seek(0)
                    print("🔄 DEBUG: read_data trying CSV with tab delimiter.")
                    df = pd.read_csv(data_io, na_values=na_vals, sep='\t', engine='python')
                    print(f"✓ DEBUG: Tab delimiter successful, shape: {df.shape}")
                    
        if df is None or df.empty:
            raise HTTPException(status_code=400, detail="Data is empty after loading.")
        
        debug_dataframe(df, "RAW DATA LOADED (before any processing)")
        
        return df

    except HTTPException:
        raise
    except Exception as e:
        print(f"💥 DEBUG: Exception in read_data: {e}")
        print(f"💥 DEBUG: Exception type: {type(e)}")
        print(traceback.format_exc())
        raise HTTPException(status_code=400, detail=f"Error loading data: {str(e)}")

def clean_column_names(df: pd.DataFrame) -> Tuple[pd.DataFrame, Dict[str, str], Dict[str, str]]:
    """
    Cleans DataFrame column names to be valid Python/plspm identifiers.

    Replaces non-alphanumeric characters with underscores, handles duplicates by appending counters,
    and maps original names to clean names.

    Args:
        df (pd.DataFrame): The DataFrame with original column names.

    Returns:
        Tuple[pd.DataFrame, Dict[str, str], Dict[str, str]]: 
            - DataFrame with cleaned column names.
            - clean_to_original mapping (Dict[clean, original]).
            - original_to_clean mapping (Dict[original, clean]).
    """
    """Cleans DataFrame column names to be valid Python/plspm identifiers."""
    print("🔧 DEBUG: clean_column_names starting...")
    
    debug_dataframe(df, "BEFORE COLUMN CLEANING")
    
    original_column_names = df.columns.tolist()
    print(f"📋 DEBUG: Original column names: {original_column_names}")
    
    cleaned_column_names = []
    cleaning_log = {}
    
    for i, col in enumerate(df.columns):
        original_col = str(col)
        clean_col = re.sub(r'[^A-Za-z0-9_]+', '_', original_col)
        if clean_col and clean_col[0].isdigit():
            clean_col = '_' + clean_col
        clean_col = clean_col.strip('_')
        if not clean_col:
            clean_col = f"unnamed_col_{i}"
        
        cleaning_log[original_col] = clean_col
        cleaned_column_names.append(clean_col)
        
        if original_col != clean_col:
            print(f"🔄 DEBUG: Column renamed: '{original_col}' → '{clean_col}'")
        else:
            print(f"✓ DEBUG: Column unchanged: '{original_col}'")
    
    # Handle duplicates
    final_names = []
    name_counts = {}
    duplicate_log = {}
    
    for original_name, clean_name in zip(original_column_names, cleaned_column_names):
        if clean_name in name_counts:
            name_counts[clean_name] += 1
            final_name = f"{clean_name}_{name_counts[clean_name]}"
            duplicate_log[original_name] = final_name
            print(f"🔁 DEBUG: Duplicate resolved: '{original_name}' → '{final_name}'")
        else:
            name_counts[clean_name] = 0
            final_name = clean_name
            
        final_names.append(final_name)
            
    df.columns = final_names
    name_mapping = dict(zip(final_names, original_column_names))
    reverse_name_mapping = dict(zip(original_column_names, final_names))
    
    print(f"📋 DEBUG: Final column names: {final_names}")
    print(f"🗺️ DEBUG: Clean-to-Original mapping: {name_mapping}")
    print(f"🗺️ DEBUG: Original-to-Clean mapping: {reverse_name_mapping}")
    
    debug_dataframe(df, "AFTER COLUMN CLEANING")
    
    print("✅ DEBUG: clean_column_names finished.")
    return df, name_mapping, reverse_name_mapping

def parse_lavaan_syntax(measurement_syntax: str, structural_syntax: str, reverse_name_mapping: Dict[str, str]) -> Tuple[Config, Dict[str, List[str]], List[Tuple[str, str]]]:
    """
    Parses lavaan-style syntax into the dictionary format required by plspm.
    
    Parses both measurement models (Latent =~ item1 + item2) and structural models (Target ~ Source).
    Validates that indicators exist in the dataset using the reverse_name_mapping.

    Args:
        measurement_syntax (str): String defining latent variables and their indicators.
        structural_syntax (str): String defining relationships between latent variables.
        reverse_name_mapping (Dict[str, str]): Mapping from original column names to cleaned names.

    Returns:
        Tuple[Config, Dict[str, List[str]], List[Tuple[str, str]]]:
            - `config`: The plspm Config object ready for analysis.
            - `blocks`: Dictionary mapping latent variables to list of indicator column names.
            - `structure_paths`: List of tuples representing (source, target) paths.

    Raises:
        HTTPException: If syntax is invalid, indicators are missing, or blocks/paths are empty.
    """
    """
    Parses lavaan-style syntax into the dictionary format required by plspm.
    MODIFIED: Now returns the Config object, the 'blocks' dictionary, AND the 'structure_paths' list.
    """
    print("🔍 DEBUG: parse_lavaan_syntax starting...")
    print(f"📝 DEBUG: Measurement syntax received:\n{measurement_syntax}")
    print(f"📝 DEBUG: Structural syntax received:\n{structural_syntax}")
    
    structure_paths = [] # This list is what we need to return
    blocks = {}
    
    def clean_line(line):
        cleaned = line.split('#')[0].strip() # Remove comments
        return cleaned

    # --- Parse Measurement Model ---
    try:
        print("📊 DEBUG: Parsing measurement syntax...")
        measurement_lines = measurement_syntax.split('\n')
        
        for line_num, line in enumerate(measurement_lines, 1):
            original_line = line
            line = clean_line(line)
            
            if "=~" in line and line.strip():
                print(f"  ✓ Found measurement line: '{line}'")
                parts = line.split("=~")
                if len(parts) != 2:
                    print(f"  ✗ Invalid syntax - expected exactly one '=~', got {len(parts)-1}")
                    continue
                    
                latent_variable = parts[0].strip()
                print(f"  📍 Latent variable: '{latent_variable}'")
                indicators = []
                
                indicator_text = parts[1].strip()
                print(f"  📝 Raw indicators text: '{indicator_text}'")
                
                for item in indicator_text.split("+"):
                    item = item.strip()
                    if not item:
                        continue
                    
                    if '*' in item:
                        var_name = item.split('*')[-1].strip()
                    else:
                        var_name = item
                    
                    if var_name in reverse_name_mapping:
                        cleaned_name = reverse_name_mapping[var_name]
                        indicators.append(cleaned_name)
                        print(f"    ✓ Mapped '{var_name}' → '{cleaned_name}'")
                    else:
                        print(f"    ✗ Variable '{var_name}' not found in data columns!")
                        print(f"      Available columns: {list(reverse_name_mapping.keys())}")
                        raise ValueError(f"Indicator '{var_name}' in Measurement Model not found in data. Check for typos or ensure it's in your file.")
                
                if indicators:
                    blocks[latent_variable] = indicators
                    print(f"  ✅ Created latent variable '{latent_variable}' with {len(indicators)} indicators: {indicators}")
                else:
                    print(f"  ⚠️ No valid indicators found for '{latent_variable}'")
            else:
                if line.strip():
                    print(f"  ⏭️ Skipping non-measurement line: '{line}'")
                    
    except Exception as e:
        print(f"💥 DEBUG: Exception in measurement syntax parsing: {e}")
        print(traceback.format_exc())
        raise HTTPException(status_code=400, detail=f"Error parsing Measurement Model: {e}")

    print(f"📋 DEBUG: Final measurement model blocks: {blocks}")
    if not blocks:
        raise HTTPException(status_code=400, detail="Measurement Model is empty or invalid. Use syntax like: Factor1 =~ item1 + item2")

    # --- Parse Structural Model ---
    try:
        print("🏗️ DEBUG: Parsing structural syntax...")
        structural_lines = structural_syntax.split('\n')
        
        for line_num, line in enumerate(structural_lines, 1):
            original_line = line
            line = clean_line(line)
            
            if "~" in line and "=~" not in line and line.strip():
                print(f"  ✓ Found structural line: '{line}'")
                parts = line.split("~")
                if len(parts) != 2:
                    print(f"  ✗ Invalid syntax - expected exactly one '~', got {len(parts)-1}")
                    continue
                    
                target = parts[0].strip()
                print(f"  🎯 Target variable: '{target}'")
                sources = []
                
                sources_text = parts[1].strip()
                print(f"  📝 Raw sources text: '{sources_text}'")
                
                for item in sources_text.split("+"):
                    item = item.strip()
                    if not item:
                        continue
                    
                    if '*' in item:
                        var_name = item.split('*')[-1].strip()
                    else:
                        var_name = item
                    sources.append(var_name)
                
                print(f"  📤 Source variables: {sources}")
                
                for source in sources:
                    if source not in blocks:
                        print(f"  ✗ Source variable '{source}' not defined in Measurement Model")
                        print(f"    Available latent variables: {list(blocks.keys())}")
                        raise ValueError(f"Source variable '{source}' not defined in Measurement Model")
                    if target not in blocks:
                        print(f"  ✗ Target variable '{target}' not defined in Measurement Model")
                        print(f"    Available latent variables: {list(blocks.keys())}")
                        raise ValueError(f"Target variable '{target}' not defined in Measurement Model")
                    
                    path = (source, target)
                    structure_paths.append(path) # Add to the list
                    print(f"  ✅ Created structural path: {source} → {target}")
            else:
                if line.strip():
                    print(f"  ⏭️ Skipping non-structural line: '{line}'")
                    
    except Exception as e:
        print(f"💥 DEBUG: Exception in structural syntax parsing: {e}")
        print(traceback.format_exc())
        raise HTTPException(status_code=400, detail=f"Error parsing Structural Model: {e}")

    print(f"🏗️ DEBUG: Final structural paths: {structure_paths}")
    if not structure_paths:
        raise HTTPException(status_code=400, detail="Structural Model is empty. Use syntax like: Factor2 ~ Factor1")

    # --- Create plspm configuration ---
    try:
        print("⚙️ DEBUG: Building plspm config object...")
        print(f"📋 DEBUG: Blocks for config: {blocks}")
        print(f"🔗 DEBUG: Paths for config: {structure_paths}")
        
        structure_config = plspm.config.Structure()
        for source, target in structure_paths:
            print(f"    Adding path to structure: {source} → {target}")
            structure_config.add_path([source], [target])
        
        print("    Creating main Config object...")
        config = plspm.config.Config(structure_config.path(), default_scale=plspm.scale.Scale.NUM)
        
        for latent, indicators in blocks.items():
            print(f"    Adding latent variable '{latent}' with {len(indicators)} indicators...")
            print(f"      Indicators: {indicators}")
            mv_list = []
            for ind in indicators:
                mv = plspm.config.MV(ind)
                mv_list.append(mv)
                print(f"        Created MV object for: {ind}")
            config.add_lv(latent, Mode.A, *mv_list)
            print(f"    ✅ Added latent variable '{latent}'")
        
        print("✅ DEBUG: plspm Config() created successfully.")
        
        # --- MODIFICATION: Return 'structure_paths' as well ---
        return config, blocks, structure_paths
        
    except Exception as e:
        print(f"💥 DEBUG: Error building plspm config: {e}")
        print(f"💥 DEBUG: Exception type: {type(e)}")
        print(traceback.format_exc())
        raise HTTPException(status_code=400, detail=f"Error building model configuration: {e}")

def generate_path_diagram(
    path_coefficients: List[Dict[str, Any]], 
    reliability_validity: List[Dict[str, Any]], 
    model_evaluation: Dict[str, Any],
    measurement_syntax: str,
    outer_loadings: Optional[pd.DataFrame],
    name_mapping: Dict[str, str],
    reverse_name_mapping: Dict[str, str],
    output_format: str = 'png'
) -> Tuple[str, bool]:
    """
    Generates a PLS-SEM path diagram dynamically based on actual model results using Graphviz.
    
    Visualizes latent constructs, indicators, loadings, and path coefficients (indicating significance).
    Returns an HTML string containing the base64 encoded image.

    Args:
        path_coefficients (List[Dict[str, Any]]): List of path coefficient dictionaries.
        reliability_validity (List[Dict[str, Any]]): List of reliability stats (used for R2 mapping if needed).
        model_evaluation (Dict[str, Any]): Dictionary containing R-squared values.
        measurement_syntax (str): The original measurement syntax string.
        outer_loadings (Optional[pd.DataFrame]): DataFrame of outer loadings.
        name_mapping (Dict[str, str]): Clean-to-original name mapping.
        reverse_name_mapping (Dict[str, str]): Original-to-clean name mapping.
        output_format (str, optional): output format for graphviz. Defaults to 'png'.

    Returns:
        Tuple[str, bool]:
            - HTML string embedding the diagram (or error message).
            - Boolean indicating success.
    """
    """
    Generates PLS-SEM path diagram dynamically based on actual model results.
    Fixed to handle missing data more gracefully.
    """
    try:
        print("="*50)
        print("DEBUG: Starting path diagram generation")
        
        if not path_coefficients and not reliability_validity:
            print("DEBUG: No data for diagram generation")
            return '<div class="p-4 text-center text-yellow-400"><p>⚠️ No data available for diagram generation.</p></div>', False

        # Create Graphviz diagram
        dot = graphviz.Digraph(
            comment='PLS-SEM Path Model',
            format=output_format,
            graph_attr={
                'bgcolor': 'white',
                'rankdir': 'LR',
                'dpi': '150',
                'nodesep': '0.7',
                'ranksep': '1.5',
                'size': '15,10!',
                'ratio': 'auto'
            },
            node_attr={
                'fontname': 'Arial', 'fontsize': '10', 'fontcolor': 'black',
                'color': 'black', 'style': 'filled'
            },
            edge_attr={
                'fontname': 'Arial', 'fontsize': '9', 'fontcolor': 'black',
                'color': 'black'
            }
        )

        # Parse measurement model for construct-indicator relationships
        construct_indicators = {}
        if measurement_syntax:
            for line in measurement_syntax.split('\n'):
                line = line.split('#')[0].strip()
                if "=~" in line and line.strip():
                    parts = line.split("=~")
                    if len(parts) == 2:
                        latent_variable = parts[0].strip()
                        indicators = []
                        for item in parts[1].split("+"):
                            item = item.strip()
                            if item:
                                var_name = item.split('*')[-1].strip()
                                # Use the *original* name from the user's syntax
                                indicators.append(var_name)
                        if indicators:
                            construct_indicators[latent_variable] = indicators

        # Get construct names
        construct_names = set(construct_indicators.keys())
        for path in path_coefficients:
            if path.get('path') and ' -> ' in path['path']:
                source, target = path['path'].split(' -> ')
                construct_names.add(source.strip())
                construct_names.add(target.strip())

        # Get R-squared values
        r_squared_map = {}
        if model_evaluation and 'r_squared_values' in model_evaluation:
            for rsq in model_evaluation['r_squared_values']:
                r_squared_map[rsq['variable']] = rsq.get('r_squared', 0.0)

        # Add construct nodes
        for construct_name in construct_names:
            r_sq = r_squared_map.get(construct_name, 0.0)
            label = f"{construct_name}"
            if r_sq > 0:
                label += f"\\nR²={r_sq:.3f}"
            
            dot.node(
                construct_name,
                label=label,
                shape='ellipse',
                fillcolor='#DAE8FC',
                color='#3B82F6',
                penwidth='1.5'
            )

        # Add indicator nodes and measurement edges
        all_indicators = set()
        for construct_name, indicators in construct_indicators.items():
            for indicator_original_name in indicators:
                if indicator_original_name not in all_indicators:
                    all_indicators.add(indicator_original_name)
                    dot.node(
                        indicator_original_name,
                        label=indicator_original_name,
                        shape='box',
                        fillcolor='#FEF9C3',
                        color='#F59E0B',
                        penwidth='1'
                    )
                
                # Get loading value
                loading_value = 0.0
                if outer_loadings is not None and not outer_loadings.empty:
                    try:
                        # Use original names for lookup
                        if indicator_original_name in outer_loadings.index and construct_name in outer_loadings.columns:
                            loading_value = float(outer_loadings.loc[indicator_original_name, construct_name])
                    except Exception as e:
                        print(f"DEBUG: Could not get loading for {indicator_original_name}->{construct_name}: {e}")

                dot.edge(
                    construct_name, indicator_original_name,
                    label=f'{loading_value:.3f}' if loading_value != 0.0 else '',
                    arrowhead='none',
                    style='dashed',
                    color='gray'
                )

        # Add structural edges
        for path in path_coefficients:
            if path.get('path') and ' -> ' in path['path']:
                source, target = path['path'].split(' -> ')
                source, target = source.strip(), target.strip()
                
                coefficient = float(path.get('coefficient', 0.0))
                p_value = float(path.get('p_value', 1.0))
                is_significant = p_value < 0.05
                
                label = f"β = {coefficient:.3f}"
                if p_value < 0.001:
                    label += "***"
                elif p_value < 0.01:
                    label += "**"
                elif p_value < 0.05:
                    label += "*"
                
                if source in construct_names and target in construct_names:
                    dot.edge(
                        source, target,
                        label=label,
                        arrowhead='normal',
                        style='solid',
                        penwidth='2',
                        color='green' if is_significant else 'gray',
                        fontcolor='green' if is_significant else 'gray'
                    )

        # Generate diagram
        try:
            png_data = dot.pipe(format='png')
            png_b64 = base64.b64encode(png_data).decode('utf-8')
            
            html_template = f"""
            <div class="path-diagram-container" style="text-align: center; background: rgba(255,255,255,0.05); border-radius: 12px; padding: 20px; margin: 10px 0;">
                <h3 style="color: white; margin-bottom: 1rem; font-size: 1.5rem; font-weight: 700;">🧬 PLS-SEM Path Model</h3>
                
                <div style="background: rgba(255,255,255,0.95); border-radius: 8px; padding: 20px; margin-bottom: 15px; text-align: center; overflow-x: auto;">
                    <img src="data:image/png;base64,{png_b64}" 
                         style="max-width: 100%; height: auto; border: 1px solid #ddd; border-radius: 4px;" 
                         alt="PLS-SEM Path Diagram" 
                         title="Complete PLS-SEM Path Model"/>
                </div>
                
                <div style="display: flex; justify-content: center; gap: 30px; margin-top: 1rem; font-size: 0.875rem; color: white; flex-wrap: wrap;">
                    <div><span style="display: inline-block; width: 12px; height: 12px; background: #DAE8FC; border: 1px solid #3B82F6; border-radius: 50%; margin-right: 5px;"></span> Latent Construct</div>
                    <div><span style="display: inline-block; width: 12px; height: 12px; background: #FEF9C3; border: 1px solid #F59E0B; margin-right: 5px;"></span> Observed Indicator</div>
                    <div><span style="color: green; font-weight: bold;">→</span> Significant Path (p < 0.05)</div>
                    <div><span style="color: gray;">→</span> Non-Significant Path</div>
                    <div><span styleF="color: gray;">- - -</span> Measurement Loading</div>
                </div>
            </div>
            """
            return html_template, True
            
        except Exception as png_error:
            print(f"DEBUG: PNG generation failed: {png_error}")
            return f'<div class="p-4 text-center text-red-400">Diagram generation failed: {str(png_error)}</div>', False
            
    except Exception as e:
        print(f"ERROR: Diagram generation failed: {e}")
        return f'<div class="p-4 text-center text-red-400">Diagram error: {str(e)}</div>', False

async def call_ollama_for_insights(prompt: str) -> Dict[str, Any]:
    """
    Helper function to call Ollama from the backend to generate qualitative insights.

    Sends a POST request to the Ollama API with the configured model and prompt.

    Args:
        prompt (str): The prompt text to send to the LLM.

    Returns:
        Dict[str, Any]: The parsed JSON response from the LLM containing insights.

    Raises:
        HTTPException: If connection fails (500), response is invalid JSON (500), 
            or specific API keys are missing.
    """
    """Helper to call Ollama from the backend to generate qualitative insights."""
    print(f"DEBUG: Contacting Ollama at {OLLAMA_URL}...")
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
            
            response_json = response.json()
            if "response" not in response_json:
                raise ValueError("Ollama response missing 'response' key.")
                
            insights_data = json.loads(response_json["response"])
            return insights_data

    except httpx.ConnectError as e:
        raise HTTPException(status_code=500, detail=f"Could not connect to AI service at {OLLAMA_URL}. Is it running?")
    except json.JSONDecodeError as e:
        print(f"DEBUG: JSON Parse Error - Raw response: {response_json.get('response', 'N/A')}")
        raise HTTPException(status_code=500, detail="AI service returned invalid JSON.")
    except Exception as e:
        print(f"DEBUG: Ollama error: {e}")
        raise HTTPException(status_code=500, detail=f"Error generating insights: {str(e)}")

def calculate_degrees_of_freedom(n_observations: int, n_parameters: int) -> int:
    """
    Calculate degrees of freedom for t-test in PLS-SEM context.
    
    Formula: max(1, n_observations - n_parameters - 1)

    Args:
        n_observations (int): Number of rows in the dataset.
        n_parameters (int): Number of estimated parameters (paths + weights).

    Returns:
        int: The calculated degrees of freedom.
    """
    """
    Calculate degrees of freedom for t-test in PLS-SEM context.
    """
    return max(1, n_observations - n_parameters - 1)

def check_data_quality(df: pd.DataFrame) -> Dict[str, Any]:
    """
    Comprehensive data quality checks for PLS-SEM analysis.
    
    Checks for perfect correlations and sample size adequacy based on rule of thumb.
    Does NOT check for outliers via IQR as it is inappropriate for Likert-scale data.

    Args:
        df (pd.DataFrame): The DataFrame to check.

    Returns:
        Dict[str, Any]: Dictionary containing boolean 'has_issues', a list of 'issues',
            'data_shape', and 'missing_values' count.
    """
    """
    Comprehensive data quality checks for PLS-SEM analysis.
    --- V2: REMOVED outlier check, as it's inappropriate for Likert-scale data. ---
    """
    issues = []
    
    # Check for perfect correlations
    numeric_df = df.select_dtypes(include=[np.number])
    if len(numeric_df.columns) > 1:
        corr_matrix = numeric_df.corr()
        
        # Find perfect correlations (excluding diagonal)
        perfect_corrs = []
        for i in range(len(corr_matrix.columns)):
            for j in range(i+1, len(corr_matrix.columns)):
                corr_val = corr_matrix.iloc[i, j]
                if abs(corr_val) > 0.98: # Very high correlation threshold
                    perfect_corrs.append({
                        'var1': corr_matrix.columns[i],
                        'var2': corr_matrix.columns[j], 
                        'correlation': corr_val
                    })
        
        if perfect_corrs:
            issues.append({
                'type': 'perfect_correlation',
                'message': f"Found {len(perfect_corrs)} near-perfect correlations",
                'details': perfect_corrs
            })
    
    # Check sample size adequacy
    min_sample_size = max(50, len(df.columns) * 5) # Rule of thumb: 5-10 obs per variable
    if len(df) < min_sample_size:
        issues.append({
            'type': 'small_sample',
            'message': f"Sample size ({len(df)}) may be too small. Recommended: {min_sample_size}+",
            'details': {'current': len(df), 'recommended': min_sample_size}
        })
    
    # --- OUTLIER BLOCK REMOVED ---
    # The IQR outlier check was removed from here as it is
    # not suitable for Likert-scale data.
    
    return {
        'has_issues': len(issues) > 0,
        'issues': issues,
        'data_shape': df.shape,
        'missing_values': df.isnull().sum().sum()
    }

def clean_and_validate_data(df: pd.DataFrame) -> Tuple[pd.DataFrame, Dict[str, Any]]:
    """
    Enhanced data cleaning with validation for PLS-SEM analysis.
    
    Performs the following steps:
    1. Extracts numeric values from messy object columns.
    2. Converts all columns to numeric (coercing errors).
    3. Handles perfect correlations by removing redundant variables.
    4. Removes rows with missing values.

    Args:
        df (pd.DataFrame): The raw DataFrame.

    Returns:
        Tuple[pd.DataFrame, Dict[str, Any]]: 
            - The cleaned DataFrame.
            - A cleaning log dictionary detailing steps taken and final quality.
    """
    """
    Enhanced data cleaning with validation for PLS-SEM analysis.
    This function now performs all numeric conversion and NA handling.
    """
    print("🧹 Enhanced data cleaning and validation...")
    
    original_shape = df.shape
    cleaning_log = {'original_shape': original_shape, 'steps': []}
    
    # Step 1: Handle problematic text values more intelligently
    for col in df.columns:
        if df[col].dtype == 'object':
            # Try to extract numeric parts from mixed text-number values
            def extract_numeric(val):
                if pd.isna(val):
                    return val
                
                str_val = str(val).strip()
                
                # Extract leading digits (including potential decimals)
                match = re.match(r'^(\d+\.?\d*|\.\d+)', str_val)
                if match:
                    try:
                        return float(match.group(1))
                    except (ValueError, TypeError):
                        return np.nan
                
                # If no leading digits, return NaN
                return np.nan
            
            original_non_numeric = df[col].apply(lambda x: not pd.api.types.is_numeric_dtype(x) if pd.notna(x) else False).sum()
            
            if original_non_numeric > 0:
                print(f"    Attempting to extract numeric from {col}: {original_non_numeric} problematic values")
                df[col] = df[col].apply(extract_numeric)
                cleaning_log['steps'].append(f"Extracted numeric from {col}: converted {original_non_numeric} mixed values")
    
    # Step 2: Convert all columns to numeric, coercing errors
    for col in df.columns:
        if not pd.api.types.is_numeric_dtype(df[col]):
            df[col] = pd.to_numeric(df[col], errors='coerce')
    
    # Step 3: Handle perfect correlations by removing one of the correlated variables
    quality_check_before_na = check_data_quality(df)
    
    if quality_check_before_na['has_issues']:
        for issue in quality_check_before_na['issues']:
            if issue['type'] == 'perfect_correlation':
                print(f"⚠️  Handling perfect correlations...")
                for corr_pair in issue['details']:
                    var1, var2 = corr_pair['var1'], corr_pair['var2']
                    # Remove the variable with more missing values, or the second one if equal
                    missing1 = df[var1].isnull().sum()
                    missing2 = df[var2].isnull().sum()
                    
                    to_remove = var2 if missing1 <= missing2 else var1
                    
                    if to_remove in df.columns:
                        print(f"    Removing {to_remove} due to perfect correlation with {var1 if to_remove == var2 else var2} (r={corr_pair['correlation']:.4f})")
                        df = df.drop(columns=[to_remove])
                        cleaning_log['steps'].append(f"Removed {to_remove} due to perfect correlation")
    
    # Step 4: Remove rows with missing values
    rows_before = len(df)
    df = df.dropna()
    rows_after = len(df)
    
    if rows_before != rows_after:
        cleaning_log['steps'].append(f"Removed {rows_before - rows_after} rows with missing values")
    
    cleaning_log['final_shape'] = df.shape
    
    # Final quality check
    final_quality = check_data_quality(df)
    cleaning_log['final_quality'] = final_quality
    
    print(f"    Final data shape: {df.shape}")
    print(f"    Cleaning steps: {len(cleaning_log['steps'])}")
    
    return df, cleaning_log

def calculate_htmt(pls: Plspm, model_df: pd.DataFrame, blocks: Dict[str, List[str]], name_mapping: Dict[str, str]) -> Dict[str, Any]:
    """
    Manually calculates the HTMT (Heterotrait-Monotrait Ratio) matrix.

    Computes heterotrait correlations and monotrait correlations from the indicator correlation matrix,
    then derives HTMT values.

    Args:
        pls (Plspm): The fitted PLS model object (used primarily for context/validation here).
        model_df (pd.DataFrame): The DataFrame containing indicator data.
        blocks (Dict[str, List[str]]): Dictionary mapping constructs to indicators.
        name_mapping (Dict[str, str]): Mapping from internal to original names.

    Returns:
        Dict[str, Any]: A dictionary representing the HTMT matrix with 'headers' and 'rows'.
            Returns error details if calculation fails.
    """
    """
    Manually calculates the HTMT (Heterotrait-Monotrait Ratio) matrix.
    """
    print("DEBUG: Manually calculating HTMT...")
    try:
        construct_names = list(blocks.keys())
        htmt_matrix = pd.DataFrame(index=construct_names, columns=construct_names, dtype=float)
        
        # Initialize diagonal to NaN
        for construct in construct_names:
            htmt_matrix.loc[construct, construct] = np.nan
        
        # Get indicator data and correlation matrix
        indicator_data = model_df
        indicator_corr = indicator_data.corr()
        
        for i, con1 in enumerate(construct_names):
            for j, con2 in enumerate(construct_names):
                if i == j:
                    continue  # Skip diagonal
                
                # Get indicators for both constructs
                indicators1 = blocks[con1]
                indicators2 = blocks[con2]
                
                # Calculate heterotrait correlations (between constructs)
                inter_corr_vals = []
                for ind1 in indicators1:
                    for ind2 in indicators2:
                        if ind1 in indicator_corr.index and ind2 in indicator_corr.columns:
                            inter_corr_vals.append(abs(indicator_corr.loc[ind1, ind2]))
                
                if not inter_corr_vals:
                    htmt_matrix.loc[con1, con2] = 0.0
                    continue
                
                mean_hetero = np.mean(inter_corr_vals)
                
                # Calculate monotrait correlations (within each construct)
                mono_corr_1_vals = []
                for k in range(len(indicators1)):
                    for l in range(k+1, len(indicators1)):
                        ind1, ind2 = indicators1[k], indicators1[l]
                        if ind1 in indicator_corr.index and ind2 in indicator_corr.columns:
                            mono_corr_1_vals.append(abs(indicator_corr.loc[ind1, ind2]))
                
                mono_corr_2_vals = []
                for k in range(len(indicators2)):
                    for l in range(k+1, len(indicators2)):
                        ind1, ind2 = indicators2[k], indicators2[l]
                        if ind1 in indicator_corr.index and ind2 in indicator_corr.columns:
                            mono_corr_2_vals.append(abs(indicator_corr.loc[ind1, ind2]))
                
                mean_mono_1 = np.mean(mono_corr_1_vals) if mono_corr_1_vals else 1.0
                mean_mono_2 = np.mean(mono_corr_2_vals) if mono_corr_2_vals else 1.0
                
                # Calculate HTMT
                denominator = np.sqrt(mean_mono_1 * mean_mono_2)
                htmt_value = mean_hetero / denominator if denominator > 0 else 0.0
                
                htmt_matrix.loc[con1, con2] = htmt_value
        
        # Format for frontend
        headers = [name_mapping.get(col, col) for col in htmt_matrix.columns]
        rows = []
        for index, row in htmt_matrix.iterrows():
            row_data = {"construct": name_mapping.get(index, index)}
            for col_name in htmt_matrix.columns:
                mapped_col = name_mapping.get(col_name, col_name)
                row_data[mapped_col] = row[col_name] if not pd.isna(row[col_name]) else None
            rows.append(row_data)
            
        return {"headers": headers, "rows": rows}

    except Exception as e:
        print(f"⚠️ DEBUG: Manual HTMT calculation failed: {e}")
        return {"headers": ["HTMT calculation failed"], "rows": [{"construct": str(e)}]}

async def extract_statistical_results(
    pls: Plspm, 
    bootstrap_data: Any, 
    n_observations: int,
    n_parameters: int,
    name_mapping: Dict[str, str],
    model_df_clean: pd.DataFrame,
    blocks: Dict[str, List[str]]
) -> Dict[str, Any]:
    """
    Extracts all statistical results from the plspm object.
    
    Includes Model Fit (R2), Path Coefficients (with significance via bootstrap if available),
    Reliability (Alpha, CR, AVE), Discriminant Validity (HTMT, Fornell-Larcker), and Outer Loadings.

    Args:
        pls (Plspm): The fitted PLS model object.
        bootstrap_data (Any): Result object from pls.bootstrap(), or None.
        n_observations (int): Number of observations used.
        n_parameters (int): Number of estimated parameters.
        name_mapping (Dict[str, str]): Mapping from internal to original names.
        model_df_clean (pd.DataFrame): The cleaned DataFrame used for analysis.
        blocks (Dict[str, List[str]]): The block definition dictionary.

    Returns:
        Dict[str, Any]: A comprehensive dictionary of statistical results.

    Raises:
        HTTPException: If extraction fails (500).
    """
    """
    Extracts all statistical results from the plspm object.
    --- V9: FIXED Fornell-Larcker manual calculation ---
    """
    print("DEBUG: extract_statistical_results starting...")
    results = {}
    
    try:
        # --- 1. Model Evaluation (R-Squared only) ---
        print("DEBUG: Calculating Model Fit (R-Squared)...")
        r_squared_values = []
        model_fit_interpretation = "Model fit interpretation unavailable."
        
        inner_summary_df = pls.inner_summary()
        for index, row in inner_summary_df.iterrows():
            if 'r_squared' in row:
                r_squared_values.append({
                    "variable": name_mapping.get(index, index),
                    "r_squared": float(row['r_squared'])
                })
        
        if r_squared_values:
             model_fit_interpretation = f"Model R-squared values range from {min(r['r_squared'] for r in r_squared_values):.3f} to {max(r['r_squared'] for r in r_squared_values):.3f}."
        
        print("⚠️ DEBUG: Global fit indices (SRMR, NFI) are not supported by this library. Skipping.")
        model_fit_interpretation += " Global fit indices (SRMR, NFI) are not provided by this method."

        results['model_evaluation'] = {
            "r_squared_values": r_squared_values,
            "interpretation": model_fit_interpretation,
            "srmr": 0.0, # Set to 0.0 as placeholder
            "nfi": 0.0,  # Set to 0.0 as placeholder
            "rfi": 0.0,  # Set to 0.0 as placeholder
            "chi_squared": 0.0 # Set to 0.0 as placeholder
        }

        # --- 2. Path Coefficients (from bootstrap) ---
        print("DEBUG: Calculating Path Coefficients...")
        path_list = []
        degrees_of_freedom = calculate_degrees_of_freedom(n_observations, n_parameters)
        
        if bootstrap_data is not None:
            try:
                bootstrap_path_df = bootstrap_data.paths()
                print(f"DEBUG: Bootstrap paths DataFrame shape: {bootstrap_path_df.shape}")
                print(f"DEBUG: Bootstrap paths DataFrame index: {bootstrap_path_df.index}")
                print(f"DEBUG: Bootstrap paths DataFrame columns: {bootstrap_path_df.columns}")
                
                for index, row in bootstrap_path_df.iterrows():
                    print(f"DEBUG: Processing path index: {index} (type: {type(index)})")
                    
                    # Handle different index formats
                    if isinstance(index, tuple) and len(index) == 2:
                        source, target = index
                    elif isinstance(index, str) and ' -> ' in index:
                        source, target = index.split(' -> ')
                    elif isinstance(index, str) and '→' in index:
                        source, target = index.split('→')
                    elif isinstance(index, tuple) and len(index) > 2:
                        # If tuple has more than 2 elements, take first two
                        source, target = index[0], index[1]
                        print(f"DEBUG: Index had {len(index)} elements, using first two: {source} -> {target}")
                    else:
                        print(f"DEBUG: Skipping unrecognized index format: {index}")
                        continue
                    
                    source, target = str(source).strip(), str(target).strip()
                    original_source = name_mapping.get(source, source)
                    original_target = name_mapping.get(target, target)
                    
                    coeff = float(row.get('original', 0.0))
                    t_stat = float(row.get('t stat.', row.get('t_stat', row.get('t_statistic', 0.0))))
                    
                    if t_stat != 0 and degrees_of_freedom > 0:
                        p_val = t.sf(abs(t_stat), df=degrees_of_freedom) * 2
                    else:
                        p_val = 1.0
                    
                    path_list.append({
                        "path": f"{original_source} -> {original_target}",
                        "coefficient": coeff,
                        "t_statistic": t_stat,
                        "p_value": p_val,
                        "significant": p_val < 0.05
                    })
                    
            except Exception as path_err:
                print(f"⚠️ DEBUG: Bootstrap paths failed: {path_err}")
                print(traceback.format_exc())
                # Fall back to non-bootstrap method
                bootstrap_data = None
        
        if bootstrap_data is None:
            # Fallback to inner_model if bootstrap failed
            print("DEBUG: Bootstrap failed, using inner_model for paths (no p-values).")
            try:
                inner_model_df = pls.inner_model()
                print(f"DEBUG: Inner model DataFrame:")
                print(inner_model_df)
                
                for index, row in inner_model_df.iterrows():
                    # Handle different formats
                    if 'from' in row and 'to' in row:
                        source, target = row['from'], row['to']
                        coeff = float(row.get('estimate', 0.0))
                    elif isinstance(index, str) and ' -> ' in index:
                        source, target = index.split(' -> ')
                        coeff = float(row.get('estimate', row.iloc[0] if len(row) > 0 else 0.0))
                    elif isinstance(index, tuple) and len(index) >= 2:
                        source, target = str(index[0]), str(index[1])
                        coeff = float(row.get('estimate', row.iloc[0] if len(row) > 0 else 0.0))
                    else:
                        continue
                        
                    original_source = name_mapping.get(source, source)
                    original_target = name_mapping.get(target, target)
                    
                    path_list.append({
                        "path": f"{original_source} -> {original_target}",
                        "coefficient": coeff,
                        "t_statistic": None,
                        "p_value": None,
                        "significant": None
                    })
            except Exception as inner_err:
                print(f"⚠️ DEBUG: Inner model fallback also failed: {inner_err}")
                print(traceback.format_exc())
                
        results['path_coefficients'] = path_list
        print(f"DEBUG: Path coefficients calculated: {len(path_list)} paths.")

        # --- 3. Reliability & Validity ---
        print("DEBUG: Calculating Reliability/Validity...")
        reliability_list = []
        unidim_df = pls.unidimensionality()
        inner_summary_df_for_ave = pls.inner_summary()
        
        for index, row in unidim_df.iterrows():
            original_name = name_mapping.get(index, index)
            alpha = float(row.get('cronbach_alpha', 0.0))
            cr = float(row.get('dillon_goldstein_rho', 0.0))
            
            ave = 0.0
            if index in inner_summary_df_for_ave.index:
                ave = float(inner_summary_df_for_ave.loc[index, 'ave'])
            
            reliability_list.append({
                "construct": original_name,
                "cronbachs_alpha": alpha,
                "composite_reliability": cr,
                "ave": ave
            })
        results['reliability_validity'] = reliability_list
        print(f"DEBUG: Reliability calculated: {len(reliability_list)} constructs.")

        # --- 4. Discriminant Validity - HTMT (MANUAL CALCULATION) ---
        print("DEBUG: Manually calculating HTMT...")
        htmt_data = calculate_htmt(pls, model_df_clean, blocks, name_mapping)
        results['discriminant_validity_htmt'] = htmt_data

        # --- 5. Discriminant Validity - Fornell-Larcker (MANUAL CALCULATION) ---
        print("DEBUG: Manually calculating Fornell-Larcker...")
        flc_data = {"headers": [], "rows": []}
        
        try:
            # Get construct correlations
            construct_names = list(blocks.keys())
            
            # Calculate construct scores first
            construct_scores = {}
            for construct, indicators in blocks.items():
                # Simple average of indicators for each construct
                construct_scores[construct] = model_df_clean[indicators].mean(axis=1)
            
            # Create DataFrame of construct scores
            construct_df = pd.DataFrame(construct_scores)
            
            # Calculate correlations between constructs
            construct_corr = construct_df.corr()
            print(f"DEBUG: Construct correlations:\n{construct_corr}")
            
            # Get AVE values from reliability results - FIXED MAPPING
            ave_values = {}
            print(f"DEBUG: Available constructs in blocks: {list(blocks.keys())}")
            print(f"DEBUG: Available reliability entries: {[item['construct'] for item in reliability_list]}")

            for construct in construct_names:
                # Map internal construct name to original name
                original_name = name_mapping.get(construct, construct)
                print(f"DEBUG: Looking for AVE - Internal: '{construct}' -> Original: '{original_name}'")
                
                # Find the corresponding reliability entry
                found_ave = False
                for rel_item in reliability_list:
                    if rel_item['construct'] == original_name:
                        ave_values[construct] = rel_item['ave']
                        print(f"DEBUG: ✓ Mapped AVE for {construct} ({original_name}): {rel_item['ave']:.3f}")
                        found_ave = True
                        break
                
                if not found_ave:
                    print(f"WARNING: ✗ No AVE found for construct {construct} -> {original_name}")
                    # Try direct name match as fallback
                    for rel_item in reliability_list:
                        if rel_item['construct'].lower() == construct.lower():
                            ave_values[construct] = rel_item['ave']
                            print(f"DEBUG: ✓ Fallback match for {construct}: {rel_item['ave']:.3f}")
                            found_ave = True
                            break
                    
                    if not found_ave:
                        ave_values[construct] = 0.0

            print(f"DEBUG: Final AVE mapping: {ave_values}")
            
            # Build Fornell-Larcker matrix
            flc_matrix = construct_corr.copy()
            
            # Set diagonal to square root of AVE
            for construct in construct_names:
                ave_val = ave_values.get(construct, 0.0)
                sqrt_ave = np.sqrt(ave_val) if ave_val > 0 else 0.0
                flc_matrix.loc[construct, construct] = sqrt_ave
                print(f"DEBUG: {construct} - AVE: {ave_val:.3f}, sqrt(AVE): {sqrt_ave:.3f}")
            
            print(f"DEBUG: Fornell-Larcker matrix:\n{flc_matrix}")
            
            # Format for frontend
            flc_data = {
                "headers": [name_mapping.get(col, col) for col in flc_matrix.columns],
                "rows": []
            }
            
            for index, row in flc_matrix.iterrows():
                row_data = {"construct": name_mapping.get(index, index)}
                for col_name in flc_matrix.columns:
                    mapped_col = name_mapping.get(col_name, col_name)
                    row_data[mapped_col] = row[col_name] if not pd.isna(row[col_name]) else None
                flc_data["rows"].append(row_data)
            
            print(f"DEBUG: Manual Fornell-Larcker calculated successfully.")
            
        except Exception as flc_err:
            print(f"⚠️ DEBUG: Manual Fornell-Larcker calculation failed: {flc_err}")
            print(traceback.format_exc())
            flc_data = {"headers": ["Manual Fornell-Larcker calculation failed"], "rows": [{"construct": str(flc_err)}]}

        results['discriminant_validity_fornell_larcker'] = flc_data
        
        # --- 6. Outer Loadings (for diagram) ---
        print("DEBUG: Extracting Outer Loadings...")
        outer_loadings_df = pls.outer_model()
        print(f"DEBUG: Raw outer_loadings_df shape: {outer_loadings_df.shape}")
        print(f"DEBUG: Raw outer_loadings_df columns: {list(outer_loadings_df.columns)}")
        print(f"DEBUG: Raw outer_loadings_df index: {list(outer_loadings_df.index)}")
        
        # Map index (indicators) and columns (constructs) back to original names
        outer_loadings_df.index = outer_loadings_df.index.map(lambda x: name_mapping.get(x, x))
        outer_loadings_df.columns = outer_loadings_df.columns.map(lambda x: name_mapping.get(x, x))
        results['outer_loadings_df'] = outer_loadings_df
        print(f"DEBUG: Mapped outer_loadings_df shape: {outer_loadings_df.shape}")
        print(f"DEBUG: Mapped outer_loadings_df:\n{outer_loadings_df}")
        print(f"DEBUG: Outer loadings extracted.")

        print("DEBUG: extract_statistical_results finished.")
        return results

    except Exception as e:
        print(f"💥 DEBUG: Error during statistical extraction: {e}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Error extracting statistical results: {e}")

def make_json_serializable(obj):
    """
    Recursively convert numpy types to native Python types for JSON serialization.

    Args:
        obj (Any): The object to convert (dict, list, scalar, etc.).

    Returns:
        Any: The converted object safe for JSON dumping.
    """
    """
    Recursively convert numpy types to native Python types for JSON serialization.
    """
    if isinstance(obj, dict):
        return {k: make_json_serializable(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [make_json_serializable(item) for item in obj]
    elif isinstance(obj, tuple):
        return tuple(make_json_serializable(item) for item in obj)
    elif isinstance(obj, (np.bool_, bool)):
        return bool(obj)
    elif isinstance(obj, (np.integer, int)):
        return int(obj)
    elif isinstance(obj, (np.floating, float)):
        return float(obj)
    elif isinstance(obj, np.ndarray):
        return obj.tolist()
    elif isinstance(obj, (np.str_, str)):
        return str(obj)
    elif pd.isna(obj):
        return None
    elif hasattr(obj, 'item'):  # Handle any remaining numpy scalars
        return obj.item()
    else:
        return obj

async def generate_ai_insights(
    stats_results: Dict[str, Any], 
    user_input: Dict[str, str],
    user_critique: str # This is the new parameter from your prompt
) -> Dict[str, Any]:
    """
    Calls Ollama with statistical results to generate qualitative insights
    and recommendations based on the user's critique.
    
    Constructs a detailed prompt with statistical data and user goals, then parses
    the JSON response from the LLM.

    Args:
        stats_results (Dict[str, Any]): The extracted statistical results.
        user_input (Dict[str, str]): The user's original syntax input.
        user_critique (str): The user's specific critique or goals.

    Returns:
        Dict[str, Any]: A dictionary containing AI-generated evaluations and recommendations.
    """
    """
    Calls Ollama with statistical results to generate qualitative insights
    and recommendations based on the user's critique.
    FIXED: Now handles JSON serialization of numpy types.
    """
    print("DEBUG: generate_ai_insights starting...")
    
    # Prune stats for the prompt and make JSON serializable
    prompt_stats = {
        "model_evaluation": stats_results.get("model_evaluation", {}),
        "path_coefficients": stats_results.get("path_coefficients", []),
        "reliability_validity": stats_results.get("reliability_validity", [])
    }
    
    # Convert numpy types to JSON-serializable types
    prompt_stats = make_json_serializable(prompt_stats)
    
    print("DEBUG: Stats prepared for AI prompt, checking JSON serialization...")
    try:
        test_json = json.dumps(prompt_stats, indent=2)
        print("✅ DEBUG: JSON serialization test passed")
    except Exception as json_err:
        print(f"❌ DEBUG: JSON serialization test failed: {json_err}")
        # If still fails, create a simplified version
        prompt_stats = {
            "model_evaluation": {"r_squared_count": len(stats_results.get("model_evaluation", {}).get("r_squared_values", []))},
            "path_coefficients_count": len(stats_results.get("path_coefficients", [])),
            "reliability_validity_count": len(stats_results.get("reliability_validity", []))
        }
        print("DEBUG: Using simplified stats for AI prompt due to serialization issues")
    
    # Create AI prompt
    prompt = f"""
    You are an expert data scientist and strategic consultant specializing in PLS-SEM.
    A user has run a model and provided a specific critique of the initial results.
    Your task is to analyze the user's critique alongside the *final statistical data*
    and generate high-quality, actionable recommendations that DIRECTLY address their concerns.

    **USER'S MODEL:**
    Measurement: {user_input['measurementModel']}
    Structural: {user_input['structuralModel']}

    **USER'S CRITIQUE / GOALS:**
    "{user_critique}"

    **FINAL STATISTICAL RESULTS:**
    {json.dumps(prompt_stats, indent=2)}

    **TASKS (Based on Critique & Stats):**
    1.  **Analyze Reliability/Validity:** Based on the stats, provide a qualitative `assessment` for each construct in `reliability_validity`. Directly address the user's critique (e.g., if they noted CR=0.684, your assessment MUST mention this).
    2.  **Analyze Paths:** Based on the stats, provide a qualitative `interpretation` for each path in `path_coefficients`, noting significance and business meaning.
    3.  **Analyze R-Squared:** Based on the stats, provide an `interpretation` for `model_evaluation`, addressing the user's concern about low R² values.
    4.  **Generate Recommendations:** Create 3-4 `business_recommendations` as Python objects. These MUST be specific, actionable, and *directly address the user's critique* (e.g., recommend specific ways to improve the 'Quality' construct, suggest new predictors for 'Satisfaction').
        - `priority`: "High", "Medium", "Low"
        - `recommendation`: "Action title"
        - `insight_link`: "Based on [Specific Stat, e.g., 'Quality CR < 0.7']..."
        - `action_items`: ["Specific step 1", "Specific step 2"]
        - `kpis_to_track`: ["KPI 1", "KPI 2"]
        - `timeline`: "e.g., Immediate, Q1-Q2"
        - `resources`: "e.g., Data Analyst, Marketing Team"

    **RETURN FORMAT (JSON ONLY):**
    {{
      "model_evaluation": {{
        "interpretation": "Overall model assessment, specifically addressing R-squared concerns..."
      }},
      "path_coefficients": [
        {{ "path": "...", "interpretation": "Practical meaning...", "significant": true }}
      ],
      "reliability_validity": [
        {{ "construct": "...", "assessment": "Reliability/validity evaluation, addressing CRITIQUE..." }}
      ],
      "business_recommendations": [
        {{
          "priority": "High",
          "recommendation": "Urgently Improve 'Quality' Construct Reliability",
          "insight_link": "Quality construct Composite Reliability is 0.684, which is below the 0.7 threshold.",
          "action_items": [
            "Review indicators for 'Quality' for conceptual ambiguity or poor wording.",
            "Consider adding 1-2 new, validated indicators for 'Quality' from existing literature.",
            "Test model by removing the indicator with the weakest outer loading."
          ],
          "kpis_to_track": ["Composite Reliability (CR)", "AVE", "Cronbach's Alpha"],
          "timeline": "Immediate (Before further analysis)",
          "resources": "Data Analyst / Researcher"
        }}
      ]
    }}
    """
    
    try:
        print("🤖 DEBUG: Calling AI for insights (v3)...")
        ai_response = await call_ollama_for_insights(prompt)
        
        # Validate response structure
        required_keys = ['model_evaluation', 'path_coefficients', 'reliability_validity', 'business_recommendations']
        if not all(key in ai_response for key in required_keys):
            raise ValueError("AI response missing required keys")
            
        print("✅ DEBUG: AI insights generated successfully (v3)")
        return ai_response

    except Exception as e:
        print(f"⚠️ DEBUG: AI insights failed (v3), using statistical fallback: {e}")
        print(traceback.format_exc())
        
        # Create a basic fallback
        fallback_recommendations = [
            {
                "priority": "High",
                "recommendation": "AI Service Error",
                "insight_link": f"The AI insights service failed: {str(e)}",
                "action_items": ["Review the 'Reliability' and 'Paths' tabs for raw statistical data."],
                "kpis_to_track": ["N/A"],
                "timeline": "N/A",
                "resources": "N/A"
            }
        ]
        
        return {
            "model_evaluation": {"interpretation": "AI insights unavailable."},
            "path_coefficients": [],
            "reliability_validity": [],
            "business_recommendations": fallback_recommendations
        }

# --- MAIN FUNCTION (REORGANIZED) ---
async def perform_pls_sem(
    data_payload: Union[UploadFile, str], 
    is_file_upload: bool, 
    input_filename: str, 
    measurement_syntax: str, 
    structural_syntax: str
) -> Dict[str, Any]:
    """
    Performs PLS-SEM analysis using the 'plspm' library.
    
    (Reorganized Version)
    Coordinates the entire analysis pipeline: loading data, cleaning names, parsing syntax,
    validating data, running PLS-SEM, calculating stats, generating AI insights, 
    and creating path diagrams.

    Args:
        data_payload (Union[UploadFile, str]): The input data.
        is_file_upload (bool): Whether input is a file.
        input_filename (str): Name of the input file.
        measurement_syntax (str): Measurement model syntax.
        structural_syntax (str): Structural model syntax.

    Returns:
        Dict[str, Any]: Comprehensive analysis results including stats, diagram, and insights.

    Raises:
        HTTPException: If any step of the process fails.
    """
    """
    Performs PLS-SEM analysis using the 'plspm' library.
    --- V5: FIXED JSON serialization and variable reference errors ---
    """
    if not Plspm:
        raise HTTPException(status_code=500, detail="PLS-SEM library 'plspm' not available.")

    print("🚀 Starting PLS-SEM analysis with comprehensive debugging...")
    
    # --- This is the user's critique, hardcoded as requested ---
    user_critique = ""
    
    try:
        # Step 1: Load data (no numeric conversion yet)
        print("\n" + "="*60)
        print("    STEP 1: LOADING DATA")
        print("="*60)
        df_raw = await read_data(data_payload, is_file_upload, input_filename)
        
        # Step 2: Clean column names
        print("\n" + "="*60)
        print("    STEP 2: CLEANING COLUMN NAMES")
        print("="*60)
        df_named, name_mapping, reverse_name_mapping = clean_column_names(df_raw)
        
        # Step 3: Parse syntax
        print("\n" + "="*60)
        print("    STEP 3: PARSING SYNTAX")
        print("="*60)
        config, blocks, structure_paths = parse_lavaan_syntax(measurement_syntax, structural_syntax, reverse_name_mapping)

        # Step 4: Final Data Prep & Validation
        print("\n" + "="*60)
        print("    STEP 4: FINAL DATA PREPARATION & VALIDATION")
        print("="*60)
        
        all_indicators = list(set([item for sublist in blocks.values() for item in sublist]))
        print(f"Model requires {len(all_indicators)} indicators: {all_indicators}")
        
        try:
            model_df = df_named[all_indicators].copy()
        except KeyError as e:
            missing_cols = list(set(all_indicators) - set(df_named.columns))
            original_missing = [name_mapping.get(c, c) for c in missing_cols]
            print(f"❌ ERROR: Model syntax refers to columns not in the data: {original_missing}")
            raise HTTPException(status_code=400, detail=f"Syntax error. Columns not found in data: {original_missing}")

        debug_dataframe(model_df, "STEP 4A: PRE-CLEANING MODEL DATA")
        
        model_df_clean, cleaning_log = clean_and_validate_data(model_df)
        
        debug_dataframe(model_df_clean, "STEP 4B: FINAL VALIDATED MODEL DATA")
        
        if cleaning_log['final_quality']['has_issues']:
            print("🚨 WARNING: Data quality issues found. Raising exception.")
            issues_str = "; ".join([f"{issue['type']}: {issue['message']}" for issue in cleaning_log['final_quality']['issues']])
            raise HTTPException(
                status_code=400, 
                detail=f"Data Quality Error: {issues_str}. Please clean your data."
            )
        
        if len(model_df_clean) < 30:
            raise HTTPException(
                status_code=400, 
                detail=f"Insufficient data: only {len(model_df_clean)} complete rows remain for the model. Need at least 30."
            )

        # Step 5: Run PLS-SEM analysis
        print("\n" + "="*60)
        print("    STEP 5: RUNNING PLS-SEM MODEL")
        print("="*60)
        bootstrap_results = None
        
        try:
            print("🔧 Initializing PLS model...")
            pls = Plspm(model_df_clean, config, Scheme.PATH, 100, 0.0000001, bootstrap=True)
            print("✅ PLS model initialized successfully")
            
            try:
                print("🎲 Starting bootstrap analysis...")
                bootstrap_results = pls.bootstrap()
                print("✅ Bootstrapping completed successfully")
            except Exception as bootstrap_err:
                print(f"⚠️ Bootstrap failed: {bootstrap_err}")
                print(traceback.format_exc())
                print("    Continuing without bootstrap (p-values unavailable)")
                bootstrap_results = None
                
        except Exception as model_err:
            print(f"💥 Model fitting error: {model_err}")
            print(traceback.format_exc())
            raise HTTPException(
                status_code=400, 
                detail=f"PLS-SEM model failed to converge. Check data quality and model specification: {str(model_err)}"
            )

        # Step 6: Extract statistical results
        print("\n" + "="*60)
        print("    STEP 6: EXTRACTING STATISTICAL RESULTS")
        print("="*60)
        
        n_observations = len(model_df_clean)
        n_parameters = len(all_indicators) + len(structure_paths)  # FIXED: was path_coefficients, now structure_paths
        
        statistical_results = await extract_statistical_results(
            pls=pls,
            bootstrap_data=bootstrap_results,
            n_observations=n_observations,
            n_parameters=n_parameters,
            name_mapping=name_mapping,
            model_df_clean=model_df_clean,
            blocks=blocks
        )

        # Step 7: Generate AI insights
        print("\n" + "="*60)
        print("    STEP 7: GENERATING AI INSIGHTS")
        print("="*60)
        
        user_input_dict = {
            "measurementModel": measurement_syntax,
            "structuralModel": structural_syntax
        }
        
        ai_insights = await generate_ai_insights(
            stats_results=statistical_results,
            user_input=user_input_dict,
            user_critique=user_critique
        )

        # Step 8: Generate path diagram
        print("\n" + "="*60)
        print("    STEP 8: GENERATING PATH DIAGRAM")
        print("="*60)
        
        # Get outer loadings for diagram but keep a copy
        outer_loadings_df_for_diagram = statistical_results.get('outer_loadings_df', None)
        print(f"📊 Outer loadings for diagram: {outer_loadings_df_for_diagram.shape if outer_loadings_df_for_diagram is not None else 'None'}")
        
        try:
            path_diagram_html, diagram_success = generate_path_diagram(
                statistical_results['path_coefficients'],
                statistical_results['reliability_validity'],
                statistical_results['model_evaluation'],
                measurement_syntax,
                outer_loadings_df_for_diagram,
                name_mapping,
                reverse_name_mapping,
                output_format='png'
            )
        except Exception as diagram_err:
            print(f"⚠️ Diagram generation failed: {diagram_err}")
            print(traceback.format_exc())
            path_diagram_html = f'<div class="p-4 text-center text-yellow-400">⚠️ Diagram unavailable: {diagram_err}</div>'
            diagram_success = False

        # Step 9: Prepare final results
        print("\n" + "="*60)
        print("    STEP 9: PREPARING FINAL RESULTS")
        print("="*60)
        
        # Convert outer_loadings_df to JSON format FIRST
        outer_loadings_json = None
        if 'outer_loadings_df' in statistical_results and isinstance(statistical_results['outer_loadings_df'], pd.DataFrame):
            print("DEBUG: Converting outer_loadings_df to JSON format...")
            df_loadings = statistical_results['outer_loadings_df']
            outer_loadings_json = {
                "headers": [col for col in df_loadings.columns],
                "rows": [
                    {"indicator": index, **row.to_dict()} 
                    for index, row in df_loadings.iterrows()
                ]
            }
            # Remove the non-serializable DataFrame
            del statistical_results['outer_loadings_df']

        # Convert statistical_results and ai_insights to JSON-safe format BEFORE merging
        print("DEBUG: Converting statistical and AI results to JSON-serializable format...")
        statistical_results = make_json_serializable(statistical_results)
        ai_insights = make_json_serializable(ai_insights)
        
        # Clean other variables
        user_input_dict = make_json_serializable(user_input_dict)
        cleaning_log = make_json_serializable(cleaning_log)
        
        # Build final_results with already-clean data
        final_results = {
            **statistical_results,
            "model_evaluation": {
                **statistical_results["model_evaluation"],
                "interpretation": ai_insights["model_evaluation"].get("interpretation", "AI interpretation failed.")
            },
            "path_coefficients": [
                {**stat_path, "interpretation": next((ai_path.get("interpretation", "AI interpretation failed.") for ai_path in ai_insights.get("path_coefficients", []) if ai_path.get("path") == stat_path.get("path")), "AI interpretation failed.")}
                for stat_path in statistical_results["path_coefficients"]
            ],
            "reliability_validity": [
                {**stat_rel, "assessment": next((ai_rel.get("assessment", "AI assessment failed.") for ai_rel in ai_insights.get("reliability_validity", []) if ai_rel.get("construct") == stat_rel.get("construct")), "AI assessment failed.")}
                for stat_rel in statistical_results["reliability_validity"]
            ],
            "business_recommendations": ai_insights.get("business_recommendations", []),
            "path_diagram": path_diagram_html,
            "diagram_available": make_json_serializable(diagram_success),
            "userInput": user_input_dict,
            "data_summary": {
                "total_rows": len(df_raw),
                "analysis_rows": len(model_df_clean),
                "missing_rows": len(model_df) - len(model_df_clean),
                "variables": list(name_mapping.values()),
                "cleaning_log": cleaning_log
            },
            "outer_loadings_json": outer_loadings_json,
            # ADD BOOTSTRAP INFO:
            "bootstrap_results": {
                "available": bootstrap_results is not None,
                "n_bootstrap": 1000 if bootstrap_results is not None else 0,
                "method": "Bootstrap" if bootstrap_results is not None else "None",
                "confidence_intervals": bootstrap_results is not None
            }
        }
        
        # Final conversion to ensure everything is JSON-safe
        print("DEBUG: Final JSON-serialization pass...")
        final_results = make_json_serializable(final_results)
        
        # Test JSON serialization before returning
        try:
            test_json = json.dumps(final_results)
            print("✅ DEBUG: Final results JSON serialization test passed")
        except Exception as json_err:
            print(f"❌ DEBUG: Final results JSON serialization failed: {json_err}")
            print(f"Error type: {type(json_err)}")
            
            # Find problematic fields
            for key, value in final_results.items():
                try:
                    json.dumps({key: value})
                    print(f"  ✅ {key}: OK")
                except Exception as field_err:
                    print(f"  ❌ {key}: {field_err}")
                    print(f"    Value type: {type(value)}")
                    if hasattr(value, '__dict__'):
                        print(f"    Value dict: {vars(value)}")
            
            # Create fallback response
            final_results = {
                "error": "JSON serialization failed",
                "message": str(json_err),
                "path_coefficients": [],
                "reliability_validity": [],
                "business_recommendations": ai_insights.get("business_recommendations", []),
                "model_evaluation": {"interpretation": "Serialization error occurred"},
                "data_summary": {"error": "Could not serialize data summary"}
            }
        
        print("✅ PLS-SEM analysis completed successfully")
        return final_results

    except HTTPException:
        raise
    except Exception as e:
        error_msg = f"Unexpected error: {type(e).__name__}: {str(e)}"
        print(f"💥 {error_msg}")
        print(f"💥 Full traceback:")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=error_msg)
    """
    Performs PLS-SEM analysis using the 'plspm' library.
    --- V5: FIXED JSON serialization and variable reference errors ---
    """
    if not Plspm:
        raise HTTPException(status_code=500, detail="PLS-SEM library 'plspm' not available.")

    print("🚀 Starting PLS-SEM analysis with comprehensive debugging...")
    
    # --- This is the user's critique, hardcoded as requested ---
    user_critique = """
    Model Fit & Reliability (5/10)
    Major Concerns:
    - Poor Quality construct reliability (α=0.825, CR=0.684): CR below 0.7 threshold
    - Low Satisfaction R² (0.181): Only 18.1% variance explained - concerning
    - Zero Quality R² (0.000): Expected for exogenous construct but limits model scope
    - Loyalty explanation (24.2%): Moderate but could be improved
    Critical Issues:
    - Reliability inconsistency: Cronbach's α acceptable but CR poor for Quality
    - Missing discriminant validity: No Fornell-Larcker criterion or HTMT ratios
    - AVE concerns: Some AVE values below 0.7 threshold
    - Model explanatory power: Overall variance explained is modest
    Recommendations:
    - Urgently improve Quality measurement: Add/modify indicators
    - Conduct full validity assessment (discriminant validity crucial)
    - Consider additional predictors to improve R² values
    - Report complete fit indices (SRMR, NFI if available) 
    
    Recommendations (6/10)
    Positives:
    - Actionable focus on Quality improvement
    - Recognition of key relationships
    - Practical KPI suggestions (loyalty rate, satisfaction rate)
    Limitations:
    - Generic recommendations: Lacks specificity for your context
    - Missing prioritization: Which quality aspects matter most?
    - No segmentation analysis: Different customer groups may need different approaches
    - Limited scope: Doesn't address satisfaction drivers specifically
    Improvements Needed:
    - Industry-specific quality improvement strategies
    - Segmented recommendations based on customer profiles
    - Timeline and resource allocation for improvements
    - Additional KPIs (NPS, customer lifetime value, retention metrics)
    """
    
    try:
        # Step 1: Load data (no numeric conversion yet)
        print("\n" + "="*60)
        print("    STEP 1: LOADING DATA")
        print("="*60)
        df_raw = await read_data(data_payload, is_file_upload, input_filename)
        
        # Step 2: Clean column names
        print("\n" + "="*60)
        print("    STEP 2: CLEANING COLUMN NAMES")
        print("="*60)
        df_named, name_mapping, reverse_name_mapping = clean_column_names(df_raw)
        
        # Step 3: Parse syntax
        print("\n" + "="*60)
        print("    STEP 3: PARSING SYNTAX")
        print("="*60)
        config, blocks, structure_paths = parse_lavaan_syntax(measurement_syntax, structural_syntax, reverse_name_mapping)

        # Step 4: Final Data Prep & Validation
        print("\n" + "="*60)
        print("    STEP 4: FINAL DATA PREPARATION & VALIDATION")
        print("="*60)
        
        all_indicators = list(set([item for sublist in blocks.values() for item in sublist]))
        print(f"Model requires {len(all_indicators)} indicators: {all_indicators}")
        
        try:
            model_df = df_named[all_indicators].copy()
        except KeyError as e:
            missing_cols = list(set(all_indicators) - set(df_named.columns))
            original_missing = [name_mapping.get(c, c) for c in missing_cols]
            print(f"❌ ERROR: Model syntax refers to columns not in the data: {original_missing}")
            raise HTTPException(status_code=400, detail=f"Syntax error. Columns not found in data: {original_missing}")

        debug_dataframe(model_df, "STEP 4A: PRE-CLEANING MODEL DATA")
        
        model_df_clean, cleaning_log = clean_and_validate_data(model_df)
        
        debug_dataframe(model_df_clean, "STEP 4B: FINAL VALIDATED MODEL DATA")
        
        if cleaning_log['final_quality']['has_issues']:
            print("🚨 WARNING: Data quality issues found. Raising exception.")
            issues_str = "; ".join([f"{issue['type']}: {issue['message']}" for issue in cleaning_log['final_quality']['issues']])
            raise HTTPException(
                status_code=400, 
                detail=f"Data Quality Error: {issues_str}. Please clean your data."
            )
        
        if len(model_df_clean) < 30:
            raise HTTPException(
                status_code=400, 
                detail=f"Insufficient data: only {len(model_df_clean)} complete rows remain for the model. Need at least 30."
            )

        # Step 5: Run PLS-SEM analysis
        print("\n" + "="*60)
        print("    STEP 5: RUNNING PLS-SEM MODEL")
        print("="*60)
        bootstrap_results = None
        
        try:
            print("🔧 Initializing PLS model...")
            pls = Plspm(model_df_clean, config, Scheme.PATH, 100, 0.0000001, bootstrap=True)
            print("✅ PLS model initialized successfully")
            
            try:
                print("🎲 Starting bootstrap analysis...")
                bootstrap_results = pls.bootstrap()
                print("✅ Bootstrapping completed successfully")
            except Exception as bootstrap_err:
                print(f"⚠️ Bootstrap failed: {bootstrap_err}")
                print(traceback.format_exc())
                print("    Continuing without bootstrap (p-values unavailable)")
                bootstrap_results = None
                
        except Exception as model_err:
            print(f"💥 Model fitting error: {model_err}")
            print(traceback.format_exc())
            raise HTTPException(
                status_code=400, 
                detail=f"PLS-SEM model failed to converge. Check data quality and model specification: {str(model_err)}"
            )

        # Step 6: Extract statistical results
        print("\n" + "="*60)
        print("    STEP 6: EXTRACTING STATISTICAL RESULTS")
        print("="*60)
        
        n_observations = len(model_df_clean)
        n_parameters = len(all_indicators) + len(structure_paths)  # FIXED: was path_coefficients, now structure_paths
        
        statistical_results = await extract_statistical_results(
            pls=pls,
            bootstrap_data=bootstrap_results,
            n_observations=n_observations,
            n_parameters=n_parameters,
            name_mapping=name_mapping,
            model_df_clean=model_df_clean,
            blocks=blocks
        )

        # Step 7: Generate AI insights
        print("\n" + "="*60)
        print("    STEP 7: GENERATING AI INSIGHTS")
        print("="*60)
        
        user_input_dict = {
            "measurementModel": measurement_syntax,
            "structuralModel": structural_syntax
        }
        
        ai_insights = await generate_ai_insights(
            stats_results=statistical_results,
            user_input=user_input_dict,
            user_critique=user_critique
        )

        # Step 8: Generate path diagram
        print("\n" + "="*60)
        print("    STEP 8: GENERATING PATH DIAGRAM")
        print("="*60)
        
        # Get outer loadings for diagram but keep a copy
        outer_loadings_df_for_diagram = statistical_results.get('outer_loadings_df', None)
        print(f"📊 Outer loadings for diagram: {outer_loadings_df_for_diagram.shape if outer_loadings_df_for_diagram is not None else 'None'}")
        
        try:
            path_diagram_html, diagram_success = generate_path_diagram(
                statistical_results['path_coefficients'],
                statistical_results['reliability_validity'],
                statistical_results['model_evaluation'],
                measurement_syntax,
                outer_loadings_df_for_diagram,
                name_mapping,
                reverse_name_mapping,
                output_format='png'
            )
        except Exception as diagram_err:
            print(f"⚠️ Diagram generation failed: {diagram_err}")
            print(traceback.format_exc())
            path_diagram_html = f'<div class="p-4 text-center text-yellow-400">⚠️ Diagram unavailable: {diagram_err}</div>'
            diagram_success = False

        # Step 9: Prepare final results
        print("\n" + "="*60)
        print("    STEP 9: PREPARING FINAL RESULTS")
        print("="*60)
        
        # Convert outer_loadings_df to JSON format FIRST
        outer_loadings_json = None
        if 'outer_loadings_df' in statistical_results and isinstance(statistical_results['outer_loadings_df'], pd.DataFrame):
            print("DEBUG: Converting outer_loadings_df to JSON format...")
            df_loadings = statistical_results['outer_loadings_df']
            outer_loadings_json = {
                "headers": [col for col in df_loadings.columns],
                "rows": [
                    {"indicator": index, **row.to_dict()} 
                    for index, row in df_loadings.iterrows()
                ]
            }
            # Remove the non-serializable DataFrame
            del statistical_results['outer_loadings_df']

        # Convert statistical_results and ai_insights to JSON-safe format BEFORE merging
        print("DEBUG: Converting statistical and AI results to JSON-serializable format...")
        statistical_results = make_json_serializable(statistical_results)
        ai_insights = make_json_serializable(ai_insights)
        
        # Clean other variables
        user_input_dict = make_json_serializable(user_input_dict)
        cleaning_log = make_json_serializable(cleaning_log)
        
        # Build final_results with already-clean data
        final_results = {
            **statistical_results,
            "model_evaluation": {
                **statistical_results["model_evaluation"],
                "interpretation": ai_insights["model_evaluation"].get("interpretation", "AI interpretation failed.")
            },
            "path_coefficients": [
                {**stat_path, "interpretation": next((ai_path.get("interpretation", "AI interpretation failed.") for ai_path in ai_insights.get("path_coefficients", []) if ai_path.get("path") == stat_path.get("path")), "AI interpretation failed.")}
                for stat_path in statistical_results["path_coefficients"]
            ],
            "reliability_validity": [
                {**stat_rel, "assessment": next((ai_rel.get("assessment", "AI assessment failed.") for ai_rel in ai_insights.get("reliability_validity", []) if ai_rel.get("construct") == stat_rel.get("construct")), "AI assessment failed.")}
                for stat_rel in statistical_results["reliability_validity"]
            ],
            "business_recommendations": ai_insights.get("business_recommendations", []),
            "path_diagram": path_diagram_html,
            "diagram_available": make_json_serializable(diagram_success),
            "userInput": user_input_dict,
            "data_summary": {
                "total_rows": len(df_raw),
                "analysis_rows": len(model_df_clean),
                "missing_rows": len(model_df) - len(model_df_clean),
                "variables": list(name_mapping.values()),
                "cleaning_log": cleaning_log
            },
            "outer_loadings_json": outer_loadings_json
        }
        
        # Final conversion to ensure everything is JSON-safe
        print("DEBUG: Final JSON-serialization pass...")
        final_results = make_json_serializable(final_results)
        
        # Test JSON serialization before returning
        try:
            test_json = json.dumps(final_results)
            print("✅ DEBUG: Final results JSON serialization test passed")
        except Exception as json_err:
            print(f"❌ DEBUG: Final results JSON serialization failed: {json_err}")
            print(f"Error type: {type(json_err)}")
            
            # Find problematic fields
            for key, value in final_results.items():
                try:
                    json.dumps({key: value})
                    print(f"  ✅ {key}: OK")
                except Exception as field_err:
                    print(f"  ❌ {key}: {field_err}")
                    print(f"    Value type: {type(value)}")
                    if hasattr(value, '__dict__'):
                        print(f"    Value dict: {vars(value)}")
            
            # Create fallback response
            final_results = {
                "error": "JSON serialization failed",
                "message": str(json_err),
                "path_coefficients": [],
                "reliability_validity": [],
                "business_recommendations": ai_insights.get("business_recommendations", []),
                "model_evaluation": {"interpretation": "Serialization error occurred"},
                "data_summary": {"error": "Could not serialize data summary"}
            }
        
        print("✅ PLS-SEM analysis completed successfully")
        return final_results

    except HTTPException:
        raise
    except Exception as e:
        error_msg = f"Unexpected error: {type(e).__name__}: {str(e)}"
        print(f"💥 {error_msg}")
        print(f"💥 Full traceback:")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=error_msg)
    """
    Performs PLS-SEM analysis using the 'plspm' library.
    --- V4: FIX ---
    - Converts outer_loadings_df to a JSON-serializable dict 
    - Adds this new dict to the final_results.
    """
    if not Plspm:
        raise HTTPException(status_code=500, detail="PLS-SEM library 'plspm' not available.")

    print("🚀 Starting PLS-SEM analysis with comprehensive debugging...")
    
    # --- This is the user's critique, hardcoded as requested ---
    user_critique = """
    Model Fit & Reliability (5/10)
    Major Concerns:
    - Poor Quality construct reliability (α=0.825, CR=0.684): CR below 0.7 threshold
    - Low Satisfaction R² (0.181): Only 18.1% variance explained - concerning
    - Zero Quality R² (0.000): Expected for exogenous construct but limits model scope
    - Loyalty explanation (24.2%): Moderate but could be improved
    Critical Issues:
    - Reliability inconsistency: Cronbach's α acceptable but CR poor for Quality
    - Missing discriminant validity: No Fornell-Larcker criterion or HTMT ratios
    - AVE concerns: Some AVE values below 0.7 threshold
    - Model explanatory power: Overall variance explained is modest
    Recommendations:
    - Urgently improve Quality measurement: Add/modify indicators
    - Conduct full validity assessment (discriminant validity crucial)
    - Consider additional predictors to improve R² values
    - Report complete fit indices (SRMR, NFI if available) 
    
    Recommendations (6/10)
    Positives:
    - Actionable focus on Quality improvement
    - Recognition of key relationships
    - Practical KPI suggestions (loyalty rate, satisfaction rate)
    Limitations:
    - Generic recommendations: Lacks specificity for your context
    - Missing prioritization: Which quality aspects matter most?
    - No segmentation analysis: Different customer groups may need different approaches
    - Limited scope: Doesn't address satisfaction drivers specifically
    Improvements Needed:
    - Industry-specific quality improvement strategies
    - Segmented recommendations based on customer profiles
    - Timeline and resource allocation for improvements
    - Additional KPIs (NPS, customer lifetime value, retention metrics)
    """
    
    try:
        # Step 1: Load data (no numeric conversion yet)
        print("\n" + "="*60)
        print("    STEP 1: LOADING DATA")
        print("="*60)
        df_raw = await read_data(data_payload, is_file_upload, input_filename)
        
        # Step 2: Clean column names
        print("\n" + "="*60)
        print("    STEP 2: CLEANING COLUMN NAMES")
        print("="*60)
        df_named, name_mapping, reverse_name_mapping = clean_column_names(df_raw)
        
        # Step 3: Parse syntax
        print("\n" + "="*60)
        print("    STEP 3: PARSING SYNTAX")
        print("="*60)
        config, blocks, structure_paths = parse_lavaan_syntax(measurement_syntax, structural_syntax, reverse_name_mapping)

        # Step 4: Final Data Prep & Validation
        print("\n" + "="*60)
        print("    STEP 4: FINAL DATA PREPARATION & VALIDATION")
        print("="*60)
        
        all_indicators = list(set([item for sublist in blocks.values() for item in sublist]))
        print(f"Model requires {len(all_indicators)} indicators: {all_indicators}")
        
        try:
            model_df = df_named[all_indicators].copy()
        except KeyError as e:
            missing_cols = list(set(all_indicators) - set(df_named.columns))
            original_missing = [name_mapping.get(c, c) for c in missing_cols]
            print(f"❌ ERROR: Model syntax refers to columns not in the data: {original_missing}")
            raise HTTPException(status_code=400, detail=f"Syntax error. Columns not found in data: {original_missing}")

        debug_dataframe(model_df, "STEP 4A: PRE-CLEANING MODEL DATA")
        
        model_df_clean, cleaning_log = clean_and_validate_data(model_df)
        
        debug_dataframe(model_df_clean, "STEP 4B: FINAL VALIDATED MODEL DATA")
        
        if cleaning_log['final_quality']['has_issues']:
            print("🚨 WARNING: Data quality issues found. Raising exception.")
            issues_str = "; ".join([f"{issue['type']}: {issue['message']}" for issue in cleaning_log['final_quality']['issues']])
            raise HTTPException(
                status_code=400, 
                detail=f"Data Quality Error: {issues_str}. Please clean your data."
            )
        
        if len(model_df_clean) < 30:
            raise HTTPException(
                status_code=400, 
                detail=f"Insufficient data: only {len(model_df_clean)} complete rows remain for the model. Need at least 30."
            )

        # Step 5: Run PLS-SEM analysis
        print("\n" + "="*60)
        print("    STEP 5: RUNNING PLS-SEM MODEL")
        print("="*60)
        bootstrap_results = None
        
        try:
            print("🔧 Initializing PLS model...")
            pls = Plspm(model_df_clean, config, Scheme.PATH, 100, 0.0000001, bootstrap=True)
            print("✅ PLS model initialized successfully")
            
            try:
                print("🎲 Starting bootstrap analysis...")
                bootstrap_results = pls.bootstrap()
                print("✅ Bootstrapping completed successfully")
            except Exception as bootstrap_err:
                print(f"⚠️ Bootstrap failed: {bootstrap_err}")
                print(traceback.format_exc())
                print("    Continuing without bootstrap (p-values unavailable)")
                bootstrap_results = None
                
        except Exception as model_err:
            print(f"💥 Model fitting error: {model_err}")
            print(traceback.format_exc())
            raise HTTPException(
                status_code=400, 
                detail=f"PLS-SEM model failed to converge. Check data quality and model specification: {str(model_err)}"
            )

        # Step 6: Extract statistical results
        print("\n" + "="*60)
        print("    STEP 6: EXTRACTING STATISTICAL RESULTS")
        print("="*60)
        
        n_observations = len(model_df_clean)
        n_parameters = len(all_indicators) + len(structure_paths)  # FIXED: was path_coefficients, now structure_paths
        
        statistical_results = await extract_statistical_results(
            pls=pls,
            bootstrap_data=bootstrap_results,
            n_observations=n_observations,
            n_parameters=n_parameters,
            name_mapping=name_mapping,
            model_df_clean=model_df_clean,
            blocks=blocks
        )

        # Step 7: Generate AI insights
        print("\n" + "="*60)
        print("    STEP 7: GENERATING AI INSIGHTS")
        print("="*60)
        
        user_input_dict = {
            "measurementModel": measurement_syntax,
            "structuralModel": structural_syntax
        }
        
        ai_insights = await generate_ai_insights(
            stats_results=statistical_results,
            user_input=user_input_dict,
            user_critique=user_critique # Pass the critique to the AI
        )

        # Step 8: Generate path diagram
        print("\n" + "="*60)
        print("    STEP 8: GENERATING PATH DIAGRAM")
        print("="*60)
        
        # --- CHANGE 1: Use .get() instead of .pop() ---
        # We need to *keep* this DataFrame to pass to the frontend
        outer_loadings_df_for_diagram = statistical_results.get('outer_loadings_df', None)
        print(f"📊 Outer loadings for diagram: {outer_loadings_df_for_diagram.shape if outer_loadings_df_for_diagram is not None else 'None'}")
        
        try:
            path_diagram_html, diagram_success = generate_path_diagram(
                statistical_results['path_coefficients'],
                statistical_results['reliability_validity'],
                statistical_results['model_evaluation'],
                measurement_syntax,
                outer_loadings_df_for_diagram, # Pass the dataframe to the diagram generator
                name_mapping,
                reverse_name_mapping,
                output_format='png'
            )
        except Exception as diagram_err:
            print(f"⚠️ Diagram generation failed: {diagram_err}")
            print(traceback.format_exc())
            path_diagram_html = f'<div class="p-4 text-center text-yellow-400">⚠️ Diagram unavailable: {diagram_err}</div>'
            diagram_success = False

        # Step 9: Prepare final results
        print("\n" + "="*60)
        print("    STEP 9: PREPARING FINAL RESULTS")
        print("="*60)
        
        # --- CHANGE 2: Convert DataFrame to JSON-friendly dict ---
        # We do this *before* building the final_results dict
        outer_loadings_json = None
        if 'outer_loadings_df' in statistical_results and isinstance(statistical_results['outer_loadings_df'], pd.DataFrame):
            print("DEBUG: Converting outer_loadings_df to JSON format...")
            df_loadings = statistical_results['outer_loadings_df']
            outer_loadings_json = {
                "headers": [col for col in df_loadings.columns],
                "rows": [
                    # 'indicator' is the row's index (the item name)
                    {"indicator": index, **row.to_dict()} 
                    for index, row in df_loadings.iterrows()
                ]
            }
            # Remove the non-serializable DataFrame from the dict
            del statistical_results['outer_loadings_df']
        # --- END OF CHANGE 2 ---

        # Merge stats and AI insights
        final_results = {
            **statistical_results,
            "model_evaluation": {
                **statistical_results["model_evaluation"],
                "interpretation": ai_insights["model_evaluation"].get("interpretation", "AI interpretation failed.")
            },
            "path_coefficients": [
                {**stat_path, "interpretation": next((ai_path.get("interpretation", "AI interpretation failed.") for ai_path in ai_insights.get("path_coefficients", []) if ai_path.get("path") == stat_path.get("path")), "AI interpretation failed.")}
                for stat_path in statistical_results["path_coefficients"]
            ],
            "reliability_validity": [
                {**stat_rel, "assessment": next((ai_rel.get("assessment", "AI assessment failed.") for ai_rel in ai_insights.get("reliability_validity", []) if ai_rel.get("construct") == stat_rel.get("construct")), "AI assessment failed.")}
                for stat_rel in statistical_results["reliability_validity"]
            ],
            "business_recommendations": ai_insights.get("business_recommendations", []),
            "path_diagram": path_diagram_html,
            "diagram_available": diagram_success,
            "userInput": user_input_dict,
            "data_summary": {
                "total_rows": len(df_raw),
                "analysis_rows": len(model_df_clean),
                "missing_rows": len(model_df) - len(model_df_clean), # Missing from selected columns
                "variables": list(name_mapping.values()),
                "cleaning_log": cleaning_log
            },
            # --- CHANGE 3: Add the new JSON-friendly data ---
            "outer_loadings_json": outer_loadings_json
            # --- END OF CHANGE 3 ---
        }
        
        print("✅ PLS-SEM analysis completed successfully")
        return final_results

    except HTTPException:
        raise
    except Exception as e:
        error_msg = f"Unexpected error: {type(e).__name__}: {str(e)}"
        print(f"💥 {error_msg}")
        print(f"💥 Full traceback:")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=error_msg)
    """
    Performs PLS-SEM analysis using the 'plspm' library.
    REORGANIZED to fix data cleaning pipeline and use native stats.
    """
    if not Plspm:
        raise HTTPException(status_code=500, detail="PLS-SEM library 'plspm' not available.")

    print("🚀 Starting PLS-SEM analysis with comprehensive debugging...")
    
    # --- This is the user's critique, hardcoded as requested ---
    user_critique = """
    Model Fit & Reliability (5/10)
    Major Concerns:
    - Poor Quality construct reliability (α=0.825, CR=0.684): CR below 0.7 threshold
    - Low Satisfaction R² (0.181): Only 18.1% variance explained - concerning
    - Zero Quality R² (0.000): Expected for exogenous construct but limits model scope
    - Loyalty explanation (24.2%): Moderate but could be improved
    Critical Issues:
    - Reliability inconsistency: Cronbach's α acceptable but CR poor for Quality
    - Missing discriminant validity: No Fornell-Larcker criterion or HTMT ratios
    - AVE concerns: Some AVE values below 0.7 threshold
    - Model explanatory power: Overall variance explained is modest
    Recommendations:
    - Urgently improve Quality measurement: Add/modify indicators
    - Conduct full validity assessment (discriminant validity crucial)
    - Consider additional predictors to improve R² values
    - Report complete fit indices (SRMR, NFI if available) 
    
    Recommendations (6/10)
    Positives:
    - Actionable focus on Quality improvement
    - Recognition of key relationships
    - Practical KPI suggestions (loyalty rate, satisfaction rate)
    Limitations:
    - Generic recommendations: Lacks specificity for your context
    - Missing prioritization: Which quality aspects matter most?
    - No segmentation analysis: Different customer groups may need different approaches
    - Limited scope: Doesn't address satisfaction drivers specifically
    Improvements Needed:
    - Industry-specific quality improvement strategies
    - Segmented recommendations based on customer profiles
    - Timeline and resource allocation for improvements
    - Additional KPIs (NPS, customer lifetime value, retention metrics)
    """
    
    try:
        # Step 1: Load data (no numeric conversion yet)
        print("\n" + "="*60)
        print("    STEP 1: LOADING DATA")
        print("="*60)
        df_raw = await read_data(data_payload, is_file_upload, input_filename)
        
        # Step 2: Clean column names
        print("\n" + "="*60)
        print("    STEP 2: CLEANING COLUMN NAMES")
        print("="*60)
        df_named, name_mapping, reverse_name_mapping = clean_column_names(df_raw)
        
        # Step 3: Parse syntax
        print("\n" + "="*60)
        print("    STEP 3: PARSING SYNTAX")
        print("="*60)
        # --- MODIFICATION: Receive 'structure_paths' ---
        config, blocks, structure_paths = parse_lavaan_syntax(measurement_syntax, structural_syntax, reverse_name_mapping)

        # Step 4: Final Data Prep & Validation
        print("\n" + "="*60)
        print("    STEP 4: FINAL DATA PREPARATION & VALIDATION")
        print("="*60)
        
        all_indicators = list(set([item for sublist in blocks.values() for item in sublist]))
        print(f"Model requires {len(all_indicators)} indicators: {all_indicators}")
        
        try:
            model_df = df_named[all_indicators].copy()
        except KeyError as e:
            missing_cols = list(set(all_indicators) - set(df_named.columns))
            original_missing = [name_mapping.get(c, c) for c in missing_cols]
            print(f"❌ ERROR: Model syntax refers to columns not in the data: {original_missing}")
            raise HTTPException(status_code=400, detail=f"Syntax error. Columns not found in data: {original_missing}")

        debug_dataframe(model_df, "STEP 4A: PRE-CLEANING MODEL DATA")
        
        # --- THIS IS THE CORRECTED DATA CLEANING WORKFLOW ---
        model_df_clean, cleaning_log = clean_and_validate_data(model_df)
        
        debug_dataframe(model_df_clean, "STEP 4B: FINAL VALIDATED MODEL DATA")
        
        if cleaning_log['final_quality']['has_issues']:
            print("🚨 WARNING: Data quality issues found. Raising exception.")
            issues_str = "; ".join([f"{issue['type']}: {issue['message']}" for issue in cleaning_log['final_quality']['issues']])
            raise HTTPException(
                status_code=400, 
                detail=f"Data Quality Error: {issues_str}. Please clean your data."
            )
        
        if len(model_df_clean) < 30:
            raise HTTPException(
                status_code=400, 
                detail=f"Insufficient data: only {len(model_df_clean)} complete rows remain for the model. Need at least 30."
            )
        # --- END OF CORRECTED WORKFLOW ---

        # Step 5: Run PLS-SEM analysis
        print("\n" + "="*60)
        print("    STEP 5: RUNNING PLS-SEM MODEL")
        print("="*60)
        bootstrap_results = None
        
        try:
            print("🔧 Initializing PLS model...")
            pls = Plspm(model_df_clean, config, Scheme.PATH, 100, 0.0000001, bootstrap=True)
            print("✅ PLS model initialized successfully")
            
            try:
                print("🎲 Starting bootstrap analysis...")
                bootstrap_results = pls.bootstrap()
                print("✅ Bootstrapping completed successfully")
            except Exception as bootstrap_err:
                print(f"⚠️ Bootstrap failed: {bootstrap_err}")
                print(traceback.format_exc())
                print("    Continuing without bootstrap (p-values unavailable)")
                bootstrap_results = None
                
        except Exception as model_err:
            print(f"💥 Model fitting error: {model_err}")
            print(traceback.format_exc())
            raise HTTPException(
                status_code=400, 
                detail=f"PLS-SEM model failed to converge. Check data quality and model specification: {str(model_err)}"
            )

        # Step 6: Extract statistical results
        print("\n" + "="*60)
        print("    STEP 6: EXTRACTING STATISTICAL RESULTS")
        print("="*60)
        
        n_observations = len(model_df_clean)
        n_parameters = len(all_indicators) + len(path_coefficients) # Estimate
        
        statistical_results = await extract_statistical_results(
            pls=pls,
            bootstrap_data=bootstrap_results,
            n_observations=n_observations,
            n_parameters=n_parameters,
            name_mapping=name_mapping
        )

        # Step 7: Generate AI insights
        print("\n" + "="*60)
        print("    STEP 7: GENERATING AI INSIGHTS")
        print("="*60)
        
        user_input_dict = {
            "measurementModel": measurement_syntax,
            "structuralModel": structural_syntax
        }
        
        ai_insights = await generate_ai_insights(
            stats_results=statistical_results,
            user_input=user_input_dict,
            user_critique=user_critique # Pass the critique to the AI
        )

        # Step 8: Generate path diagram
        print("\n" + "="*60)
        print("    STEP 8: GENERATING PATH DIAGRAM")
        print("="*60)
        
        outer_loadings_df = statistical_results.pop('outer_loadings_df', None)
        print(f"📊 Outer loadings for diagram: {outer_loadings_df.shape if outer_loadings_df is not None else 'None'}")
        
        try:
            path_diagram_html, diagram_success = generate_path_diagram(
                statistical_results['path_coefficients'], # Use the calculated paths
                statistical_results['reliability_validity'],
                statistical_results['model_evaluation'],
                measurement_syntax,
                outer_loadings_df,
                name_mapping,
                reverse_name_mapping,
                output_format='png'
            )
        except Exception as diagram_err:
            print(f"⚠️ Diagram generation failed: {diagram_err}")
            print(traceback.format_exc())
            path_diagram_html = f'<div class="p-4 text-center text-yellow-400">⚠️ Diagram unavailable: {diagram_err}</div>'
            diagram_success = False

        # Step 9: Prepare final results
        print("\n" + "="*60)
        print("    STEP 9: PREPARING FINAL RESULTS")
        print("="*60)
        
        # Merge stats and AI insights
        final_results = {
            **statistical_results,
            "model_evaluation": {
                **statistical_results["model_evaluation"],
                "interpretation": ai_insights["model_evaluation"].get("interpretation", "AI interpretation failed.")
            },
            "path_coefficients": [
                {**stat_path, "interpretation": next((ai_path.get("interpretation", "AI interpretation failed.") for ai_path in ai_insights.get("path_coefficients", []) if ai_path.get("path") == stat_path.get("path")), "AI interpretation failed.")}
                for stat_path in statistical_results["path_coefficients"]
            ],
            "reliability_validity": [
                {**stat_rel, "assessment": next((ai_rel.get("assessment", "AI assessment failed.") for ai_rel in ai_insights.get("reliability_validity", []) if ai_rel.get("construct") == stat_rel.get("construct")), "AI assessment failed.")}
                for stat_rel in statistical_results["reliability_validity"]
            ],
            "business_recommendations": ai_insights.get("business_recommendations", []),
            "path_diagram": path_diagram_html,
            "diagram_available": diagram_success,
            "userInput": user_input_dict,
            "data_summary": {
                "total_rows": len(df_raw),
                "analysis_rows": len(model_df_clean),
                "missing_rows": len(model_df) - len(model_df_clean), # Missing from selected columns
                "variables": list(name_mapping.values()),
                "cleaning_log": cleaning_log
            }
        }
        
        # CRITICAL: Convert all numpy types to JSON-serializable types before returning
        print("DEBUG: Converting final results to JSON-serializable format...")
        final_results = make_json_serializable(final_results)
        
        # Test JSON serialization before returning
        try:
            test_json = json.dumps(final_results)
            print("✅ DEBUG: Final results JSON serialization test passed")
        except Exception as json_err:
            print(f"❌ DEBUG: Final results JSON serialization failed: {json_err}")
            # Find the problematic fields
            for key, value in final_results.items():
                try:
                    json.dumps({key: value})
                    print(f"  ✅ {key}: OK")
                except Exception as field_err:
                    print(f"  ❌ {key}: {field_err}")
                    # Try to fix common issues
                    if isinstance(value, dict):
                        final_results[key] = make_json_serializable(value)
                    elif isinstance(value, list):
                        final_results[key] = make_json_serializable(value)
            
            # Test again after fixes
            try:
                test_json = json.dumps(final_results)
                print("✅ DEBUG: Final results JSON serialization test passed after fixes")
            except Exception as final_err:
                print(f"❌ DEBUG: Final results still not serializable: {final_err}")
                # Last resort: create a minimal response
                final_results = {
                    "error": "JSON serialization failed",
                    "message": str(final_err),
                    "path_coefficients": [],
                    "reliability_validity": [],
                    "business_recommendations": ai_insights.get("business_recommendations", [])
                }
        
        print("✅ PLS-SEM analysis completed successfully")
        return final_results

    except HTTPException:
        raise
    except Exception as e:
        error_msg = f"Unexpected error: {type(e).__name__}: {str(e)}"
        print(f"💥 {error_msg}")
        print(f"💥 Full traceback:")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=error_msg)