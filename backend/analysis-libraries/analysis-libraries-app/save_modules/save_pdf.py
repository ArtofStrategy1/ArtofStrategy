# /home/elijah/data2int/backend/analysis-libraries/analysis-libraries-app/save_modules/save_pdf.py

import io
import pandas as pd
import pygraphviz as pgv
import base64
from fpdf import FPDF
from typing import Dict, Any, List
import traceback
import json
import os

# --- Constants ---
FONT_FAMILY = "DejaVu"
FONT_REGULAR_PATH = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
FONT_BOLD_PATH = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"

# --- HELPER FUNCTIONS ---

def _setup_fonts(pdf: FPDF):
    # (Keep this function as is)
    print("--- DEBUG: Attempting to add fonts ---") 
    font_added = False
    try:
        print(f"--- DEBUG: Checking path: {FONT_REGULAR_PATH}") 
        if not os.path.exists(FONT_REGULAR_PATH): print(f"!!! ERROR: Regular font file NOT FOUND") 
        else: print(f"--- DEBUG: Regular font file FOUND."); pdf.add_font(FONT_FAMILY, "", FONT_REGULAR_PATH)
            
        print(f"--- DEBUG: Checking path: {FONT_BOLD_PATH}") 
        if not os.path.exists(FONT_BOLD_PATH): print(f"!!! ERROR: Bold font file NOT FOUND") 
        else: print(f"--- DEBUG: Bold font file FOUND."); pdf.add_font(FONT_FAMILY, "B", FONT_BOLD_PATH)
            
        if FONT_FAMILY.lower() in pdf.fonts: print("--- DEBUG: Successfully added DejaVu fonts to FPDF object."); font_added = True
        else: print("!!! ERROR: Added font but FPDF does not seem to recognize it.") 

    except RuntimeError as e: print(f"!!! ERROR: Runtime error adding DejaVu fonts. Error: {e}") 
    except Exception as e: print(f"!!! UNEXPECTED ERROR during font setup: {e}"); print(traceback.format_exc()) 
        
    if not font_added: print("!!! Falling back to Helvetica"); pdf.set_font("Helvetica", "", 10) 

def _set_font(pdf: FPDF, style="", size=10):
    # (Keep this function as is)
    font_to_use = "Helvetica" 
    try:
        if FONT_FAMILY.lower() in pdf.fonts: pdf.set_font(FONT_FAMILY, style, size); font_to_use = FONT_FAMILY 
        else: pdf.set_font("Helvetica", style, size) 
    except RuntimeError as e: print(f"!!! ERROR: Runtime error setting font to {FONT_FAMILY}. Error: {e}"); pdf.set_font("Helvetica", style, size); font_to_use = "Helvetica"
    return font_to_use 

# --- REMOVED _check_page_break function ---

def _add_heading(pdf: FPDF, item: Dict[str, Any]):
    # (No page break check needed here anymore)
    level = item.get("level", 1)
    text = str(item.get("data", "Unnamed Heading"))
    print(f"  > Adding Heading (L{level}): {text[:50]}...")
    
    pdf.set_x(pdf.l_margin) 

    current_font = "Unknown"
    line_height = 10 
    if level == 1: current_font = _set_font(pdf, "B", 16); pdf.ln(10)
    elif level == 2: current_font = _set_font(pdf, "B", 14); pdf.ln(8)
    else: current_font = _set_font(pdf, "B", 12); pdf.ln(6)
        
    print(f"--- DEBUG (Heading): Font={current_font} at X={pdf.get_x():.2f}")
    
    available_width = pdf.w - pdf.l_margin - pdf.r_margin
    pdf.multi_cell(available_width, line_height, text) 
    
    _set_font(pdf, "", 10) 


def _add_paragraph(pdf: FPDF, item: Dict[str, Any]):
    # (No page break check needed here anymore)
    text = str(item.get("data", ""))
    print(f"  > Adding Paragraph: {text[:80]}...") 
    
    pdf.set_x(pdf.l_margin) 
    current_font = _set_font(pdf, "", 10)
    print(f"--- DEBUG (Paragraph): Font={current_font} at X={pdf.get_x():.2f}")
    
    # (Keep debugging prints for now)
    page_width = pdf.w; left_margin = pdf.l_margin; right_margin = pdf.r_margin
    current_x = pdf.get_x(); current_y = pdf.get_y()
    available_width = page_width - left_margin - right_margin 
    effective_width_at_cursor = page_width - current_x - right_margin 
    print(f"--- DEBUG (Paragraph - Before multi_cell):")
    print(f"    Page Width (pdf.w): {page_width:.2f}pt, Margins L/R: {left_margin:.2f}/{right_margin:.2f}")
    print(f"    Cursor X/Y: {current_x:.2f}/{current_y:.2f}, Effective Width: {effective_width_at_cursor:.2f}pt")
    print(f"    Full Text:\n------\n{text}\n------")

    try:
        line_height = 10
        pdf.multi_cell(available_width, line_height, text) 
        pdf.ln(5) 
        
    except TypeError as te: 
        print(f"!!! TYPE ERROR in _add_paragraph: {te}") 
        print(traceback.format_exc())
        try:
            pdf.set_text_color(255, 0, 0); 
            pdf.multi_cell(available_width, line_height, f"[ERROR rendering paragraph: TypeError - Check Logs]")
            pdf.set_text_color(0, 0, 0); pdf.ln(5)
        except Exception as inner_e: print(f"!!! CRITICAL: Failed rendering error msg: {inner_e}")
        
    except Exception as e: 
        print(f"!!! OTHER ERROR in _add_paragraph: {e}") 
        print(traceback.format_exc())
        raise e 


def _add_list_item(pdf: FPDF, item: Dict[str, Any]):
    # (No page break check needed here anymore)
    text = str(item.get("data", ""))
    print(f"  > Adding List Item: {text[:50]}...")
    
    pdf.set_x(pdf.l_margin) 
    current_font = _set_font(pdf, "", 10)
    print(f"--- DEBUG (List): Font={current_font} at X={pdf.get_x():.2f}") 
    
    line_height = 10
    bullet_width = 10
    pdf.cell(bullet_width, line_height, chr(8226), 0, 0) 
    
    text_width = pdf.w - pdf.l_margin - pdf.r_margin - bullet_width
    pdf.multi_cell(text_width, line_height, text) 


def _add_csv_table(pdf: FPDF, item: Dict[str, Any]):
    # (No page break check needed here anymore, will add page AFTER)
    csv_string = item.get("data", "")
    print(f"  > Adding CSV Table: {len(csv_string)} bytes...")
    if not csv_string: print("    ! WARN: CSV string is empty."); return
        
    try:
        df = pd.read_csv(io.StringIO(csv_string))
        df = df.fillna('NA')
        print(f"    - Parsed CSV with {len(df.index)} rows and {len(df.columns)} cols.")
        
        num_cols = len(df.columns)
        if num_cols == 0: print("    ! WARN: CSV has 0 columns."); return

        page_width = pdf.w - pdf.l_margin - pdf.r_margin 
        if page_width <= 0: raise ValueError("PDF page has no usable horizontal space.")
             
        header_font_size = 8; row_font_size = 7
        if num_cols > 10: header_font_size = 6; row_font_size = 5; print(f"    ! WARN: Many cols ({num_cols}), reducing font.")
        elif num_cols > 7: header_font_size = 7; row_font_size = 6; print(f"    ! NOTE: >7 cols ({num_cols}), reducing font slightly.")

        _set_font(pdf, "B", header_font_size); line_height_header = pdf.font_size * 2.5
        _set_font(pdf, "", row_font_size); line_height_row = pdf.font_size * 2.5
        
        col_width = page_width / num_cols
        min_col_width = 5 
        if col_width < min_col_width: print(f"    ! WARN: Col width ({col_width:.2f}pt) too small."); col_width = max(col_width, 1) 

        # --- Draw Header ---
        current_font = _set_font(pdf, "B", header_font_size) 
        print(f"--- DEBUG (Table Header): Font={current_font} {header_font_size}pt, Col Width: {col_width:.2f}pt") 
        pdf.set_x(pdf.l_margin) 
        for col in df.columns:
            try: pdf.cell(col_width, line_height_header, str(col), border=1, align='C')
            except ValueError as ve: print(f"    ! ERROR in header cell: {ve}."); pdf.cell(col_width, line_height_header, "ERR", border=1, align='C'); pdf.set_x(pdf.get_x()) 
        pdf.ln(line_height_header)
        
        # --- Draw Rows ---
        current_font = _set_font(pdf, "", row_font_size) 
        print(f"--- DEBUG (Table Rows): Font={current_font} {row_font_size}pt, Col Width: {col_width:.2f}pt") 
        for row_idx, row in df.iterrows():
             # Removed per-row page check
             pdf.set_x(pdf.l_margin) 
             x_start = pdf.get_x(); y_start = pdf.get_y(); max_cell_height = line_height_row 
             
             temp_y = y_start 
             try:
                cell_heights = [pdf.multi_cell(max(1, col_width), line_height_row / 1.5, str(item), border=0, align='C', dry_run=True, output='HEIGHT') for idx, item in enumerate(row)]
                max_cell_height = max(cell_heights) if cell_heights else 0
             except ValueError as ve: print(f"    ! WARN row height calc: {ve}."); max_cell_height = line_height_row 
             max_cell_height = max(max_cell_height, line_height_row) 

             pdf.set_xy(x_start, y_start) 
             for idx, item in enumerate(row): 
                current_x = pdf.get_x(); current_y = pdf.get_y()
                pdf.rect(current_x, current_y, col_width, max_cell_height) 
                try: pdf.multi_cell(max(1, col_width), line_height_row / 1.5 , str(item), border=0, align='C', new_x='RIGHT', new_y='TOP', max_line_height=pdf.font_size) 
                except ValueError as ve: print(f"    ! ERROR row cell {idx}: {ve}."); pdf.set_xy(current_x + 1, current_y + 1); pdf.multi_cell(max(1, col_width - 2), line_height_row / 1.5, "ERR", border=0, align='C') 
                pdf.set_xy(current_x + col_width, current_y) 
            
             pdf.ln(max_cell_height) 
        pdf.ln(5) # Space after table
            
    except Exception as e:
        print(f"    ! ERROR: Failed to render CSV table: {e}") 
        print(traceback.format_exc()) 
        _set_font(pdf, "", 10); pdf.set_text_color(255, 0, 0)
        pdf.multi_cell(0, 10, f"Error rendering table: {e}")
        pdf.set_text_color(0, 0, 0)


def _add_dot_image(pdf: FPDF, item: Dict[str, Any]):
    # (No page break check needed here anymore, will add page AFTER)
    dot_string = item.get("data", "")
    print(f"  > Adding DOT Image: {len(dot_string)} bytes...")
    if not dot_string: print("    ! WARN: DOT string is empty."); return
        
    try:
        pdf.set_x(pdf.l_margin) 
        
        G = pgv.AGraph(string=dot_string); G.layout(prog="dot")
        img_bytes = G.draw(format="png"); img_io = io.BytesIO(img_bytes)
        print("    - Successfully rendered DOT string to PNG.")
        
        max_img_width = pdf.w - pdf.l_margin - pdf.r_margin
        
        pdf.image(img_io, x=pdf.l_margin, y=pdf.get_y(), w=max_img_width) 
        pdf.ln(10) # Add space AFTER image (fpdf advances Y automatically)
        
    except Exception as e:
        print(f"    ! ERROR: Failed to render DOT image: {e}"); print(traceback.format_exc())
        _set_font(pdf, "", 10); pdf.set_text_color(255, 0, 0)
        pdf.multi_cell(0, 10, f"Error rendering DOT diagram...\nError: {e}")
        pdf.set_text_color(0, 0, 0)


def _add_base64_image(pdf: FPDF, item: Dict[str, Any]):
    # (No page break check needed here anymore, will add page AFTER)
    b64_string = item.get("data", "")
    print(f"  > Adding Base64 Image: {len(b64_string)} bytes...")
    if not b64_string: print("    ! WARN: Base64 string is empty."); return
        
    try:
        pdf.set_x(pdf.l_margin) 
        
        if "," in b64_string: b64_string = b64_string.split(",")[1]
            
        img_bytes = base64.b64decode(b64_string); img_io = io.BytesIO(img_bytes)
        print("    - Successfully decoded Base64 image.")

        max_img_width = pdf.w - pdf.l_margin - pdf.r_margin
        
        pdf.image(img_io, x=pdf.l_margin, y=pdf.get_y(), w=max_img_width)
        pdf.ln(10) 
        
    except Exception as e:
        print(f"    ! ERROR: Failed to render Base64 image: {e}"); print(traceback.format_exc())
        _set_font(pdf, "", 10); pdf.set_text_color(255, 0, 0)
        pdf.multi_cell(0, 10, f"Error rendering Base64 image...\nError: {e}")
        pdf.set_text_color(0, 0, 0)

# --- Map item types to the functions ---
RENDER_MAP = {
    "heading": _add_heading,
    "paragraph": _add_paragraph,
    "list_item": _add_list_item,
    "table_csv": _add_csv_table,
    "image_dot": _add_dot_image,
    "image_base64": _add_base64_image,
}

# --- MAIN FUNCTION ---
def create_pdf_report(data: Dict[Any, Any]) -> bytes:
    """
    Generates PDF report using explicit page breaks between major items.
    """
    print("\n--- create_pdf_report: PDF Generation STARTED ---")
    
    pdf = FPDF(format='A4') 

    _setup_fonts(pdf) 
    # Auto page break is still useful for *within* multi_cell, but we add manual breaks too
    pdf.set_auto_page_break(True, margin=15) 
    pdf.add_page()
    
    pdf.set_margins(left=15, top=15, right=15) 
    pdf.set_x(pdf.l_margin) 
    
    current_font = _set_font(pdf, "B", 18) 
    print(f"--- DEBUG (Title): Font={current_font}, Page Width={pdf.w:.2f}pt") 
    pdf.cell(0, 10, "S.A.G.E. Analysis Report", 0, 1, "C") 
    pdf.ln(10)

    report_content: List[Dict[str, Any]] = data.get("report_content", [])
    print(f"Found {len(report_content)} items in 'report_content'.")
    
    if not report_content:
        # ... (error handling for empty content) ...
        print(" ! WARN: 'report_content' list is empty.")
        pdf.set_x(pdf.l_margin); current_font = _set_font(pdf, "", 12) 
        print(f"--- DEBUG (Error Msg): Font={current_font} at X={pdf.get_x():.2f}") 
        pdf.set_text_color(255, 0, 0); pdf.multi_cell(0, 10, "No exportable content..."); pdf.set_text_color(0, 0, 0)

    # --- Loop through items, adding explicit page breaks ---
    needs_page_break_after = ['table_csv', 'image_dot', 'image_base64'] # Add page break after these types

    for i, item in enumerate(report_content):
        item_type = item.get("type")
        print(f"\nProcessing item {i+1}/{len(report_content)}: type='{item_type}'")
        render_function = RENDER_MAP.get(item_type)
        
        if render_function:
            try:
                render_function(pdf, item)
                
                # --- ADD EXPLICIT PAGE BREAK ---
                if item_type in needs_page_break_after and i < len(report_content) - 1: # Don't add break after last item
                     print(f"--- DEBUG: Adding explicit page break after item type: {item_type} ---")
                     pdf.add_page()
                     _set_font(pdf, "", 10) # Reset font on new page
                # --- END PAGE BREAK ---

            except Exception as e:
                # ... (error handling for rendering failure remains the same) ...
                print(f"  ! CRITICAL ERROR processing item {i+1}: {e}")
                print(traceback.format_exc())
                pdf.set_x(pdf.l_margin); current_font = _set_font(pdf, "B", 10) 
                print(f"--- DEBUG (Render Error): Font={current_font} at X={pdf.get_x():.2f}") 
                pdf.set_text_color(255, 0, 0); pdf.multi_cell(0, 10, f"--- ERROR RENDERING ITEM '{item_type}' ---\n{e}"); pdf.set_text_color(0, 0, 0)
        else:
            # ... (warning for unknown type remains the same) ...
            print(f"  ! WARN: Unknown content type: '{item_type}'")
            pdf.set_x(pdf.l_margin); current_font = _set_font(pdf, "I", 10) 
            print(f"--- DEBUG (Unknown Type): Font={current_font} at X={pdf.get_x():.2f}") 
            pdf.set_text_color(255, 165, 0); pdf.multi_cell(0, 10, f"Unknown content type: '{item_type}'"); pdf.set_text_color(0, 0, 0)

    print("--- PDF Generation FINISHED. Returning bytes. ---")
    return pdf.output(dest='S') # Output as bytes