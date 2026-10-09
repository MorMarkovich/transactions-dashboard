"""
Data loading functions for transaction files
"""
import pandas as pd
from typing import Dict

from .isracard_pdf_parser import parse_isracard_pdf


def _read_csv_rows(file_path: str) -> pd.DataFrame:
    """Read a CSV of unknown encoding/delimiter, tolerating title lines and ragged rows."""
    import csv
    import io
    raw = open(file_path, 'rb').read()
    text = None
    for encoding in ('utf-8-sig', 'windows-1255', 'iso-8859-8'):
        try:
            text = raw.decode(encoding)
            break
        except UnicodeDecodeError:
            continue
    if text is None:
        raise ValueError("Could not read CSV file with any encoding")
    sample = text[:4096]
    try:
        delimiter = csv.Sniffer().sniff(sample, delimiters=',;\t|').delimiter
    except csv.Error:
        delimiter = ','
    rows = [r for r in csv.reader(io.StringIO(text), delimiter=delimiter) if any(c.strip() for c in r)]
    if not rows:
        raise ValueError("Empty CSV file")
    width = max(len(r) for r in rows)
    return pd.DataFrame([r + [''] * (width - len(r)) for r in rows])


def load_transaction_file(file_path: str) -> pd.DataFrame:
    """Load transaction file (Excel, CSV, or Isracard PDF)"""
    if file_path.lower().endswith('.pdf'):
        # Isracard exports statements as PDF (Excel export isn't offered for
        # all card types). Parse into a DataFrame, then re-emit as the raw
        # positional layout the rest of the pipeline (clean_dataframe →
        # process_data) expects: a header row of Hebrew column names with
        # an empty title row before it so detect_header_row finds it.
        parsed = parse_isracard_pdf(file_path)
        if parsed.empty:
            raise ValueError("No transactions extracted from PDF")
        header = list(parsed.columns)
        rows = [[''] * len(header), header] + parsed.values.tolist()
        return pd.DataFrame(rows)

    if file_path.lower().endswith(('.xlsx', '.xls')):
        # Try to load all sheets and combine
        excel_file = None
        try:
            excel_file = pd.ExcelFile(file_path)
            sheets = excel_file.sheet_names
            
            # Filter relevant sheets (skip empty or summary sheets)
            relevant_sheets = [s for s in sheets if s not in ['סיכום', 'Summary', 'תקציר']]
            
            if not relevant_sheets:
                relevant_sheets = sheets[:1]  # Take first sheet if no relevant found
            
            # Load and combine sheets
            dfs = []
            for sheet in relevant_sheets:
                try:
                    df = pd.read_excel(excel_file, sheet_name=sheet, header=None)
                    if not df.empty:
                        dfs.append(df)
                except Exception:
                    continue
            
            if not dfs:
                raise ValueError("No valid data found in file")
            
            # Combine all sheets
            result = pd.concat(dfs, ignore_index=True) if len(dfs) > 1 else dfs[0]
            
            # Explicitly close the ExcelFile to release the file handle
            excel_file.close()
            excel_file = None
            
            return result
        except Exception as e:
            if excel_file is not None:
                try:
                    excel_file.close()
                except:
                    pass
            raise ValueError(f"Error loading Excel file: {str(e)}")
    
    elif file_path.lower().endswith('.csv'):
        return _read_csv_rows(file_path)

    else:
        raise ValueError(f"Unsupported file format: {file_path}")
