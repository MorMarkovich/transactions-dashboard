"""
Data loading functions for transaction files
"""
import pandas as pd
from typing import Dict


def load_transaction_file(file_path: str) -> pd.DataFrame:
    """Load transaction file (Excel or CSV)"""
    if file_path.endswith('.xlsx') or file_path.endswith('.xls'):
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
    
    elif file_path.endswith('.csv'):
        # Try different encodings
        encodings = ['utf-8', 'utf-8-sig', 'windows-1255', 'iso-8859-8']
        for encoding in encodings:
            try:
                df = pd.read_csv(file_path, encoding=encoding, header=None)
                return df
            except (UnicodeDecodeError, pd.errors.EmptyDataError):
                continue
        raise ValueError("Could not read CSV file with any encoding")
    
    else:
        raise ValueError(f"Unsupported file format: {file_path}")
