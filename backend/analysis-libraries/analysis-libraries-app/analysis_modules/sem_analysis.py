# analysis_modules/sem_analysis.py

import io
import pandas as pd
import semopy
import traceback
import re
import json
from typing import Optional, Tuple, List, Dict, Any, Union
import numpy as np

from sklearn.preprocessing import StandardScaler
# Import UploadFile from starlette, not fastapi, for type hinting if needed
from starlette.datastructures import UploadFile
from fastapi import HTTPException
from semopy import Optimizer
from semopy.inspector import inspect
from semopy import calc_stats
from semopy import semplot # Import semplot

# --- Helper Functions ---

def safe_float(value, default=np.nan):
    """
    Safely convert value to float, handling common issues, rounding to 4 decimals.
    Returns np.nan on failure by default.
    """
    if pd.isna(value) or value in ['-', '', ' ', 'None', 'nan']:
        return default
    if isinstance(value, (np.float32, np.float64, np.floating)):
        if np.isnan(value):
            return default
        value = float(value) # Convert numpy float to Python float
    try:
        float_value = float(value)
        # Check for infinity or extremely large numbers which might cause issues downstream
        if not np.isfinite(float_value):
            print(f"Warning: Non-finite float value encountered: {value}")
            return default
        return round(float_value, 4)
    except (ValueError, TypeError):
        return default

# --- Main SEM Analysis Function ---
async def perform_sem(
    data_payload: Union[UploadFile, str], # Can be UploadFile or raw string
    is_file_upload: bool,             # Flag indicating the type of data_payload
    input_filename: str,              # Original filename or default for text
    measurement_syntax: str,
    structural_syntax: str
) -> Dict[str, Any]:
    """
    Performs SEM analysis using data from file/text and split syntax.
    Relies on is_file_upload flag to process data_payload correctly.
    Returns results including estimates and fit indices as CSV strings.
    """
    print("🚀 Starting SEM analysis in module...")
    print(f"   Data source: {'File' if is_file_upload else 'Text'}, Filename: {input_filename}")

    # --- Combine Measurement and Structural Syntax ---
    model_syntax_combined = measurement_syntax.strip()
    if structural_syntax.strip():
        separator = "\n\n" if measurement_syntax.strip() else "" # Add separator only if both parts exist
        model_syntax_combined += separator + structural_syntax.strip()

    if not model_syntax_combined:
         # Should be caught by frontend/main.py, but double-check
         raise HTTPException(status_code=400, detail="Combined model syntax is empty.")

    # --- Initialize variables ---
    original_column_names = []; cleaned_column_names = []
    df = None; df_standardized = None; model_obj = None; fit_result_obj = None
    estimates_df = pd.DataFrame(); fit_indices_df = pd.DataFrame() # Use DF for fit indices
    obs_vars = set()  # Define obs_vars outside the try block
    latent_vars = set() # --- NEW --- Define latent_vars outside

    # --- Main Processing Block ---
    try:
        # --- 1. Load Data (Handles UploadFile or str based on flag) ---
        try:
            print(f"   Step 1: Loading data...")
            filename_lower = input_filename.lower()
            na_vals = ['-', '', ' ', 'NA', 'N/A', 'null', 'None', '#N/A', '#VALUE!', '#DIV/0!', 'NaN', 'nan']
            data_io_source = None # Will hold the stream (BytesIO or StringIO)

            # Process based on the flag passed from main.py
            if is_file_upload:
                # Ensure data_payload is indeed an UploadFile object
                if not isinstance(data_payload, UploadFile):
                    raise TypeError(f"Internal Error: Expected UploadFile but received {type(data_payload)}")
                print(f"   Reading uploaded file content...")
                contents = await data_payload.read()
                if not contents: raise HTTPException(status_code=400, detail="Uploaded file is empty.")

                if filename_lower.endswith('.csv'):
                    try:
                        decoded_content = contents.decode('utf-8')
                        print("   Decoded as UTF-8.")
                    except UnicodeDecodeError:
                        decoded_content = contents.decode('latin1') # Fallback encoding
                        print("   Decoded as latin1.")
                    data_io_source = io.StringIO(decoded_content)
                elif filename_lower.endswith(('.xlsx', '.xls')):
                    data_io_source = io.BytesIO(contents) # Excel needs BytesIO
                else: # Should be caught earlier, but double-check
                    raise HTTPException(400, "Invalid file type.")

            else: # is_file_upload is False, data_payload should be string
                print("   Processing pasted text data (assuming CSV)...")
                if not isinstance(data_payload, str):
                    raise TypeError(f"Internal Error: Expected string for pasted data but received {type(data_payload)}")
                if not data_payload.strip():
                    raise HTTPException(status_code=400, detail="Pasted text data is empty.")
                data_io_source = io.StringIO(data_payload) # Create stream from string

            # --- Read into Pandas DataFrame ---
            print(f"   Parsing data into DataFrame...")
            if filename_lower.endswith('.csv'):
                data_io_source.seek(0)
                try: # Try comma first
                    df = pd.read_csv(data_io_source, na_values=na_vals, sep=',', engine='python')
                except Exception as e_comma:
                    print(f"   Comma delimiter failed ({str(e_comma)[:50]}...). Trying semicolon...")
                    data_io_source.seek(0)
                    try: # Try semicolon
                        df = pd.read_csv(data_io_source, na_values=na_vals, sep=';', engine='python')
                    except Exception as e_semi:
                        print(f"   Semicolon delimiter failed ({str(e_semi)[:50]}...). Trying auto-detect...")
                        data_io_source.seek(0)
                        try: # Try auto-detect (sep=None)
                            df = pd.read_csv(data_io_source, na_values=na_vals, sep=None, engine='python')
                            print(f"   Auto-detected delimiter.")
                        except Exception as e_auto:
                            raise ValueError(f"Failed to parse CSV with comma, semicolon, or auto-detect. Error: {str(e_auto)[:100]}...")

            elif filename_lower.endswith(('.xlsx', '.xls')):
                 # Pass BytesIO directly to read_excel
                 df = pd.read_excel(data_io_source, na_values=na_vals)

            # --- Post-load Validation ---
            if df is None: raise ValueError("DataFrame creation failed.")
            print(f"   Data loaded. Shape: {df.shape}")
            if df.empty: raise HTTPException(status_code=400, detail="Data is empty after loading.")
            if df.shape[1] <= 1:
                first_line_preview = "N/A"
                if isinstance(data_io_source, io.StringIO): data_io_source.seek(0); first_line_preview = repr(data_io_source.readline(100))
                raise HTTPException(status_code=400, detail=f"Loaded with {df.shape[1]} column(s). Check delimiter/format. Preview: {first_line_preview}")

        except HTTPException as http_exc: raise http_exc # Let HTTP errors pass through
        except Exception as e:
            print(f"   Data loading failed. Traceback:\n{traceback.format_exc()}")
            raise HTTPException(status_code=400, detail=f"Error reading/parsing data: {str(e)}")


        # --- 2. Clean Column Names ---
        print("   Step 2: Cleaning column names...")
        original_column_names = df.columns.tolist()
        df.columns = [re.sub(r'^\d', '_\\g<0>', re.sub(r'\W+', '_', col)).strip('_') for col in df.columns]
        cleaned_column_names = df.columns.tolist()
        if original_column_names != cleaned_column_names:
            print(f"   Renamed columns: {dict(zip(original_column_names, cleaned_column_names))}")


        # --- 3. Initialize Semopy Model & Get Observed Vars ---
        print("   Step 3: Initializing SEM model...")
        try:
            cleaned_lines = [line.strip() for line in model_syntax_combined.splitlines() if line.strip() and not line.strip().startswith('#')]
            model_syntax_cleaned = "\n".join(cleaned_lines)
            if not model_syntax_cleaned: raise ValueError("Effective syntax is empty after comment removal.")

            model_obj = semopy.Model(model_syntax_cleaned)
            if not hasattr(model_obj, 'vars') or 'observed' not in model_obj.vars:
                 raise ValueError("Could not parse model structure. Check syntax validity.")

            # --- MODIFIED --- Get both observed and latent vars
            obs_vars = set(model_obj.vars.get('observed', []))
            latent_vars = set(model_obj.vars.get('latent', [])) # <-- Extract latent vars

            if not obs_vars: raise ValueError("No observed variables found in the provided syntax.")
            print(f"   Observed variables in model: {obs_vars}")
            print(f"   Latent variables in model: {latent_vars}") # <-- Log latent vars

        except Exception as model_err:
            print(f"   Model initialization failed. Traceback:\n{traceback.format_exc()}")
            raise HTTPException(status_code=400, detail=f"Syntax Error or Model Setup Failed: {str(model_err)}")


        # --- 4. Prepare Data for Model ---
        print("   Step 4: Preparing data for analysis...")
        missing_in_data = obs_vars - set(cleaned_column_names)
        if missing_in_data:
            missing_original = [orig for orig, clean in zip(original_column_names, cleaned_column_names) if clean in missing_in_data]
            raise HTTPException(status_code=400, detail=f"Variable(s) in syntax not found in data: {missing_original or list(missing_in_data)}. Available (original): {original_column_names}")

        df_model_data = df[list(obs_vars)].copy()

        print("   Converting data to numeric...")
        for col in df_model_data.columns:
             df_model_data[col] = pd.to_numeric(df_model_data[col], errors='coerce')

        n_coerced_total = 0
        coerced_details = []
        for col in df_model_data.columns:
             n_coerced = df_model_data[col].isnull().sum() - (df[col].isnull().sum() if col in df else 0)
             if n_coerced > 0:
                 n_coerced_total += n_coerced
                 coerced_details.append(f"'{col}': {n_coerced}")
        if n_coerced_total > 0: print(f"   Warning: {n_coerced_total} non-numeric values coerced to NaN in columns: {', '.join(coerced_details)}")

        initial_rows = len(df_model_data)
        rows_with_na = df_model_data.isnull().any(axis=1).sum()
        df_model_data.dropna(inplace=True)
        rows_after_dropna = len(df_model_data)
        rows_dropped = initial_rows - rows_after_dropna
        print(f"   Rows before NA drop: {initial_rows}. Rows containing NA: {rows_with_na}.")
        print(f"   Rows after NA drop: {rows_after_dropna}. Rows dropped: {rows_dropped}")

        min_required_rows = len(obs_vars) + 1
        if rows_after_dropna < min_required_rows:
             raise HTTPException(status_code=400, detail=f"Insufficient valid data ({rows_after_dropna} rows) after cleaning for {len(obs_vars)} variables. Min required: {min_required_rows}.")
        elif rows_after_dropna < 50:
             print(f"   Warning: Sample size ({rows_after_dropna}) is small, results might be unstable.")


        # --- 5. Standardize Data ---
        print("   Step 5: Standardizing data...")
        try:
            scaler = StandardScaler()
            df_standardized_np = scaler.fit_transform(df_model_data.values)
            df_standardized = pd.DataFrame(df_standardized_np, columns=df_model_data.columns)
        except Exception as scale_err:
             print(f"   Standardization failed. Traceback:\n{traceback.format_exc()}")
             raise HTTPException(status_code=500, detail=f"Error standardizing data: {str(scale_err)}")


        # --- 6. Correlation Check ---
        print("   Step 6: Checking correlations...")
        high_corr_warning = None
        try:
            corr_matrix = df_standardized.corr()
            high_corr_threshold = 0.90
            upper_tri = corr_matrix.where(np.triu(np.ones(corr_matrix.shape), k=1).astype(bool))
            high_corr_pairs_series = upper_tri[upper_tri.abs() > high_corr_threshold].stack()
            if not high_corr_pairs_series.empty:
                high_corr_list = [f"{idx[0]}<->{idx[1]}({val:.3f})" for idx, val in high_corr_pairs_series.items()]
                high_corr_warning = f"High correlations (> {high_corr_threshold}) found: " + "; ".join(high_corr_list)
                print(f"   WARNING: {high_corr_warning}")
            else: print(f"   No high correlations (> {high_corr_threshold}) found.")
        except Exception as corr_err:
            print(f"   Warning: Correlation check failed: {corr_err}")
            high_corr_warning = "Correlation check failed."


        # --- 7. Sample Size Check ---
        print("   Step 7: Checking sample size...")
        size_warning = None; sample_size_ok = None; num_params = 'N/A'
        try:
            model_obj.load_dataset(df_standardized)
            if hasattr(model_obj, 'param_vals') and model_obj.param_vals is not None:
                num_params = len(model_obj.param_vals)
                rec_min = max(num_params * 5, 100)
                if rows_after_dropna < rec_min:
                    size_warning = f"Sample size ({rows_after_dropna}) may be small for {num_params} params. Rec min: {rec_min}."
                    sample_size_ok = False
                else: sample_size_ok = True
                print(f"   Parameters: {num_params}. Sample size adequate: {sample_size_ok}.")
            else: size_warning = "Cannot determine parameter count."
        except Exception as param_err: size_warning = f"Sample size check failed: {param_err}"
        if size_warning: print(f"   Warning: {size_warning}")


        # --- 8. Fit SEM Model ---
        print("   Step 8: Fitting SEM model...")
        objective_function = 'MLW'
        fit_success = False; fit_message = "Fit not attempted."
        try:
            fit_result_obj = model_obj.fit(df_standardized, obj=objective_function)
            fit_success = getattr(fit_result_obj, 'success', False)
            fit_message = getattr(fit_result_obj, 'message', 'No message.')
            print(f"   Fit finished. Success: {fit_success}, Message: {fit_message}")
            if not fit_success: raise RuntimeError(f"Model did not converge: {fit_message}")

            # --- 9. Inspect Results (Estimates) ---
            print("   Step 9: Inspecting estimates...")
            estimates_df = inspect(model_obj)
            if estimates_df is None or estimates_df.empty:
                print("   Warning: inspect() returned no estimates.")
                estimates_df = pd.DataFrame()
            else:
                estimates_df.replace('-', np.nan, inplace=True)
                heywood_warning = None
                try:
                    estimates_df['Estimate_Num'] = pd.to_numeric(estimates_df['Estimate'], errors='coerce')
                    estimates_df['Std_Err_Num'] = pd.to_numeric(estimates_df['Std. Err'], errors='coerce')
                    estimates_df['z_value_Num'] = pd.to_numeric(estimates_df['z-value'], errors='coerce')
                    estimates_df['p_value_Num'] = pd.to_numeric(estimates_df['p-value'], errors='coerce')

                    heywood_loadings = estimates_df[(estimates_df['op'] == '=~') & (estimates_df['Estimate_Num'].abs() > 1.05)]
                    heywood_variances = estimates_df[(estimates_df['op'] == '~~') & (estimates_df['lval'] == estimates_df['rval']) & (estimates_df['Estimate_Num'] < -0.001)]
                    if not heywood_loadings.empty or not heywood_variances.empty:
                        heywood_warning = "Potential Heywood cases (std loading > ~1 or negative variance)."
                        print(f"   WARNING: {heywood_warning}")
                except Exception as check_err: print(f"   Warning: Heywood check failed: {check_err}")


            # --- 10. Calculate Fit Statistics ---
            print("   Step 10: Calculating fit statistics...")
            stats_result = calc_stats(model_obj)
            if isinstance(stats_result, pd.DataFrame):
                fit_indices_df = stats_result
                print(f"   Fit stats calculated (type: DataFrame).")
            elif isinstance(stats_result, dict):
                fit_indices_df = pd.DataFrame([stats_result])
                print(f"   Fit stats calculated (type: Dict).")
            else:
                fit_indices_df = pd.DataFrame([{'error': f"Unexpected stats type {type(stats_result)}."}])
                print(f"   Warning: Unexpected fit stats type {type(stats_result)}.")

            # --- 10a. Generate Path Diagram (DOT String) ---
            print("   Step 10a: Generating path diagram...")
            path_diagram_dot = None # Default
            plot_warning = None
            try:
                # Run semplot
                plot_obj = semplot(model_obj, "sem_plot.png", show=False)

                if plot_obj and hasattr(plot_obj, 'source'):

                    # --- STYLING BLOCK (Light Theme with White BG) ---
                    plot_obj.graph_attr['bgcolor'] = 'white' # <-- Set background to white
                    plot_obj.graph_attr['rankdir'] = 'TB' # <-- Top-to-Bottom layout

                    # Set global node attributes
                    plot_obj.node_attr['fontcolor'] = '#000000' # Black text
                    plot_obj.node_attr['color'] = '#000000'     # Black border

                    # Set global edge (arrow) attributes
                    plot_obj.edge_attr['color'] = '#000000'     # Black arrow
                    plot_obj.edge_attr['fontcolor'] = '#000000' # Black label text

                    # Override node styles
                    new_body = []
                    for line in plot_obj.body:
                        if 'fillcolor="lightcyan"' in line:
                            line = line.replace('fillcolor="lightcyan"', 'fillcolor="#E0F2F1"') # Light teal
                        elif 'shape="box"' in line:
                            line = line.replace('shape="box"', 'shape="box", style="filled", fillcolor="white"')
                        new_body.append(line)
                    plot_obj.body = new_body
                    # --- END OF STYLING BLOCK ---

                    # --- CUSTOM LABEL BLOCK ---
                    if estimates_df is not None and not estimates_df.empty:
                        for _, row in estimates_df.iterrows():
                            op = row['op']
                            if op in ('~', '=~'): # Only for paths
                                lval, rval = row['lval'], row['rval']
                                estimate = safe_float(row['Estimate'], default=None)
                                p_value = safe_float(row.get('p_value_Num'), default=None)

                                new_label = ""
                                if estimate is not None:
                                    new_label += f"{estimate:.3f}"
                                    if p_value is not None:
                                        p_val_str = f"{p_value:.2f}"
                                        if p_value < 0.01:
                                            p_val_str = "0.00"
                                        new_label += f"\np-val: {p_val_str}"

                                if new_label:
                                    plot_obj.edge(row['lval'], row['rval'], label=new_label)
                    # --- END OF CUSTOM LABEL BLOCK ---

                    path_diagram_dot = plot_obj.source # Get the *final* styled source
                    print("   Path diagram DOT string generated and styled.")
                else:
                    plot_warning = "semplot did not return a valid plot object."

            except Exception as plot_err:
                plot_warning = f"Path diagram generation failed: {str(plot_err)}"
                print(f"   Warning: {plot_warning}\n{traceback.format_exc()}")
            # --- END OF Path Diagram Generation ---

        except RuntimeError as convergence_error:
            raise HTTPException(status_code=422, detail=f"Model Convergence Error: {str(convergence_error)}. Check model spec, data quality, or sample size.")
        except Exception as fit_err:
            print(f"   Error during fit/results. Traceback:\n{traceback.format_exc()}")
            raise HTTPException(status_code=500, detail=f"Error during model fitting or result calculation: {str(fit_err)}")

        # --- 11. Format Results for API Response ---
        print("   Step 11: Formatting results...")

        try:
            cols_to_format = ['Estimate', 'Std. Err', 'z-value', 'p-value']
            for col in cols_to_format:
                if col in estimates_df.columns:
                    num_col = col + '_Num' if col + '_Num' in estimates_df else col
                    estimates_df[col] = estimates_df[num_col].apply(lambda x: safe_float(x, default='NA'))

            estimates_df_final = estimates_df.drop(columns=[c for c in estimates_df.columns if c.endswith('_Num')], errors='ignore')
            estimates_csv = estimates_df_final.to_csv(index=False, na_rep='NA')
        except Exception as e_est_csv:
            print(f"Error formatting estimates CSV: {e_est_csv}")
            estimates_csv = "Error formatting estimates."


        try:
            fit_indices_formatted = pd.DataFrame()
            if not fit_indices_df.empty:
                for col in fit_indices_df.columns:
                    if fit_indices_df[col].dtype != 'object' or 'error' not in col.lower():
                        fit_indices_formatted[col] = fit_indices_df[col].apply(lambda x: safe_float(x, default='NA'))
                    else:
                        fit_indices_formatted[col] = fit_indices_df[col]

            fit_indices_csv = fit_indices_formatted.to_csv(index=False, na_rep='NA')
        except Exception as e_fit_csv:
            print(f"Error formatting fit indices CSV: {e_fit_csv}")
            fit_indices_csv = "Error formatting fit indices."


        # Compile warnings
        warnings_dict = {}
        if size_warning: warnings_dict['sample_size'] = size_warning
        if high_corr_warning: warnings_dict['high_correlation'] = high_corr_warning
        if 'heywood_warning' in locals() and heywood_warning: warnings_dict['heywood_case'] = heywood_warning
        if plot_warning: warnings_dict['path_diagram'] = plot_warning


        # --- Final JSON Response ---
        response_data = {
            "message": "SEM analysis completed successfully." if fit_success else "SEM analysis completed but failed to converge.",
            "estimates_csv_content": estimates_csv,
            "fit_indices_csv_content": fit_indices_csv,
            "path_diagram_dot": path_diagram_dot,
            "warnings": warnings_dict if warnings_dict else None,
            "model_variables": { # <-- NEW section
                "observed": sorted(list(obs_vars)),
                "latent": sorted(list(latent_vars))
            },
            "data_summary": {
                 "rows_input": initial_rows + rows_dropped,
                 "rows_used": rows_after_dropna,
                 "rows_dropped_na": rows_dropped,
                 "columns_used": df_standardized.columns.tolist()
            }
        }
        print("✅ SEM analysis finished successfully.")
        return response_data

    # --- Top Level Error Handling ---
    except HTTPException as http_exc:
        print(f"❌ HTTP Exception in perform_sem: {http_exc.status_code} - {http_exc.detail}")
        raise http_exc
    except Exception as e:
        error_msg = f"❌ Unexpected internal error in SEM module: {type(e).__name__}: {str(e)}"
        print(f"{error_msg}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=error_msg)