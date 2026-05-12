"""
Data loading functions for transaction files
"""
import os
import pandas as pd


def load_transaction_file(file_path: str) -> pd.DataFrame:
    """Load transaction file (Excel, CSV, or PDF)."""
    lower = file_path.lower()
    if lower.endswith('.xlsx') or lower.endswith('.xls'):
        return _load_excel(file_path)
    if lower.endswith('.csv'):
        return _load_csv(file_path)
    if lower.endswith('.pdf'):
        return _load_pdf(file_path)
    raise ValueError(f"Unsupported file format: {os.path.basename(file_path)}")


def _load_excel(file_path: str) -> pd.DataFrame:
    excel_file = None
    try:
        excel_file = pd.ExcelFile(file_path)
        sheets = excel_file.sheet_names
        relevant_sheets = [s for s in sheets if s not in ['סיכום', 'Summary', 'תקציר']]
        if not relevant_sheets:
            relevant_sheets = sheets[:1]
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
        result = pd.concat(dfs, ignore_index=True) if len(dfs) > 1 else dfs[0]
        excel_file.close()
        excel_file = None
        return result
    except Exception as e:
        if excel_file is not None:
            try:
                excel_file.close()
            except Exception:
                pass
        raise ValueError(f"Error loading Excel file: {str(e)}")


def _load_csv(file_path: str) -> pd.DataFrame:
    encodings = ['utf-8', 'utf-8-sig', 'windows-1255', 'iso-8859-8']
    tried = []
    for encoding in encodings:
        try:
            return pd.read_csv(file_path, encoding=encoding, header=None)
        except (UnicodeDecodeError, pd.errors.EmptyDataError) as e:
            tried.append(f"{encoding}: {type(e).__name__}")
            continue
    raise ValueError(
        "Could not read CSV file with any of the attempted encodings ("
        + ", ".join(tried) + ")"
    )


def _load_pdf(file_path: str) -> pd.DataFrame:
    """Delegate to the AI-powered PDF extractor.

    Israeli statements come in many layouts (Isracard, MAX, CAL, AmEx,
    Hapoalim, Leumi, …). Hebrew is often glyph-reversed by pdfplumber and
    table detection rarely works. The extractor passes the page text to
    Claude which returns structured transactions; a regex fallback is used
    when ANTHROPIC_API_KEY isn't configured.
    """
    from .pdf_extractor import extract_pdf_transactions
    return extract_pdf_transactions(file_path)
