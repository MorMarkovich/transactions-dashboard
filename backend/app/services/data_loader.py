"""
Data loading functions for transaction files
"""
import pandas as pd
from typing import Dict

from .isracard_pdf_parser import parse_isracard_pdf


def _guess_delimiter_by_counts(sample: str) -> str:
    """בחירת מפריד לפי המספר המינימלי של מופעים בכל אחת מהשורות הלא-ריקות
    הראשונות — יציב גם כשהרחרחן של csv נכשל. ברירת מחדל: פסיק."""
    lines = [line for line in sample.splitlines() if line.strip()][:5]
    best, best_score = ',', 0
    for candidate in (',', ';', '\t', '|'):
        counts = [line.count(candidate) for line in lines]
        score = min(counts) if counts else 0
        if score > best_score:
            best, best_score = candidate, score
    return best


def _read_csv_rows(file_path: str) -> pd.DataFrame:
    """Read a CSV of unknown encoding/delimiter, tolerating title lines and ragged rows."""
    import csv
    import io
    import codecs
    raw = open(file_path, 'rb').read()
    text = None
    # UTF-16 (עם BOM) מיוצר על ידי חלק מכלי הייצוא; נזהה לפי ה-BOM לפני
    # שרשרת הקידודים הרגילה, כי cp1255/iso-8859-8 "מצליחים" לפענח כל רצף בתים.
    if raw.startswith(codecs.BOM_UTF16_LE) or raw.startswith(codecs.BOM_UTF16_BE):
        text = raw.decode('utf-16')
    else:
        for encoding in ('utf-8-sig', 'windows-1255', 'iso-8859-8'):
            try:
                text = raw.decode(encoding)
                break
            except UnicodeDecodeError:
                continue
    if text is None:
        raise ValueError("Could not read CSV file with any encoding")
    # הרחרחן נכשל על שורות ריקות (CRLF בסוף קובץ), לכן הדגימה מורכבת
    # משורות לא-ריקות בלבד.
    sample = '\n'.join(line for line in text.splitlines() if line.strip())[:4096]
    try:
        delimiter = csv.Sniffer().sniff(sample, delimiters=',;\t|').delimiter
    except csv.Error:
        # הרחרחן נכשל גם על שורות עם מספר שדות שונה או גרשיים לא מאוזנים
        # (סה"כ) — נופלים לספירת מפרידים יציבה בשורות הראשונות.
        delimiter = _guess_delimiter_by_counts(sample)
    rows = [r for r in csv.reader(io.StringIO(text), delimiter=delimiter) if any(c.strip() for c in r)]
    if not rows:
        raise ValueError("Empty CSV file")
    width = max(len(r) for r in rows)
    return pd.DataFrame([r + [''] * (width - len(r)) for r in rows])


def _align_sheet_columns(dfs: list) -> list:
    """Promote each sheet's header row to real column names (dropping the
    title/preamble rows above it) so sheets combine by column name even when
    their layouts differ. Sheets without a detectable header keep positional
    columns, mapped onto the first promoted sheet's names when widths match.
    """
    from .data_processor import _row_looks_like_header  # local import: avoids a module cycle
    from ..utils.validators import detect_header_row

    promoted = []
    for df in dfs:
        header_row = detect_header_row(df)
        if header_row > 0 or _row_looks_like_header(df.iloc[0]):
            cols = [str(c).strip() for c in df.iloc[header_row].tolist()]
            df = df.iloc[header_row + 1:].reset_index(drop=True)
            df.columns = cols
        promoted.append(df)

    def _has_named_columns(d) -> bool:
        return all(isinstance(c, str) for c in d.columns)

    ref = next((d for d in promoted if _has_named_columns(d)), None)
    if ref is not None:
        aligned = []
        for d in promoted:
            if not _has_named_columns(d) and len(d.columns) == len(ref.columns):
                d = d.copy()
                d.columns = ref.columns
            aligned.append(d)
        promoted = aligned
    return promoted


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

            # Align sheets by header NAME before combining: concatenating raw
            # positional frames misaligns sheets whose column order differs,
            # which silently drops the later sheets' rows downstream.
            dfs = _align_sheet_columns(dfs)

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
